(() => {
  /* =========================================================
     Tile Portfolio — Drag, Snap Grid, + Path Game (Index only)
     - Edit mode: drag tiles, magnet snap + grid snap
     - Game mode (index.html only): tiles shrink into blank blocks.
       Player must collect key then reach door. Tiles can still be moved.
     ========================================================= */

  /* =========================
     RANDOMIZE TILE COLORS
     ========================= */
  const COLOR_CLASSES = ["c-pink", "c-green", "c-yellow", "c-blue", "c-white", "c-black"];
  function randomColor() {
    return COLOR_CLASSES[Math.floor(Math.random() * COLOR_CLASSES.length)];
  }
  document.querySelectorAll(".tile").forEach((tile) => {
    COLOR_CLASSES.forEach((c) => tile.classList.remove(c));
    tile.classList.add(randomColor());
  });

  /* =========================
     STAGE / TILES
     ========================= */
  const stage = document.querySelector(".tile-stage");
  if (!stage) return;

  const isMobile = window.matchMedia("(max-width: 860px)").matches;
  const tiles = Array.from(stage.querySelectorAll(".tile"));
  const GAME_ENABLED = document.body.classList.contains("game-page"); // game only on index

  function getFooterHeight() {
    const footer =
      document.querySelector(".tile-footer") ||
      document.querySelector("footer") ||
      document.querySelector(".footer");
    if (!footer) return 0;
    const rect = footer.getBoundingClientRect();
    return Math.max(0, rect.height || 0);
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function getMaxXY(el) {
    const stageRect = stage.getBoundingClientRect();
    const footerH = getFooterHeight();

    const maxX = Math.max(0, stage.clientWidth - el.offsetWidth);

    const usableBottomInViewport = (window.innerHeight - footerH) - stageRect.top;
    const maxYViewport = usableBottomInViewport - el.offsetHeight;

    const maxYStage = stage.clientHeight - el.offsetHeight;

    const maxY = Math.max(0, Math.min(maxYViewport, maxYStage));
    return { maxX, maxY };
  }

  /* =========================
     Grid snapping (satisfying!)
     ========================= */
  const GRID = 20;                 // keep in sync with CSS grid look
  const GRID_SNAP_ON_DRAG = true;  // keep movement on-grid while dragging

  function snapToGrid(v) {
    return Math.round(v / GRID) * GRID;
  }

  /* =========================
     Initial random positions
     ========================= */
  function randomizePositions() {
    if (isMobile) return;
    tiles.forEach((el, i) => {
      el.dataset.id = el.dataset.id || "tile-" + i;
      el.style.position = "absolute";

      const { maxX, maxY } = getMaxXY(el);

      const pad = 8;
      const x = Math.floor(Math.random() * Math.max(1, maxX - pad)) + pad / 2;
      const y = Math.floor(Math.random() * Math.max(1, maxY - pad)) + pad / 2;

      el.style.left = clamp(snapToGrid(x), 0, maxX) + "px";
      el.style.top = clamp(snapToGrid(y), 0, maxY) + "px";
      el.dataset.justDraggedUntil = "0";
    });
  }

  // Disable default navigation on stage tiles that are <a>
  tiles.forEach((el) => {
    if (el.tagName.toLowerCase() === "a") {
      if (!el.dataset.href) el.dataset.href = el.getAttribute("href") || "";
      el.removeAttribute("href");
      el.setAttribute("role", "link");
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    }
  });

  randomizePositions();

  window.addEventListener("resize", () => {
    if (isMobile) return;
    tiles.forEach((el) => {
      const left = parseFloat(el.style.left) || 0;
      const top = parseFloat(el.style.top) || 0;
      const { maxX, maxY } = getMaxXY(el);
      el.style.left = clamp(left, 0, maxX) + "px";
      el.style.top = clamp(top, 0, maxY) + "px";
    });
  });

  function bringToFront(el) {
    const maxZ = tiles.reduce((m, t) => Math.max(m, parseInt(getComputedStyle(t).zIndex) || 10), 10);
    el.style.zIndex = String(Math.min(maxZ + 1, 999));
  }

  function maybeNavigate(el) {
    const until = parseInt(el.dataset.justDraggedUntil || "0", 10);
    if (Date.now() < until) return;
    const href = el.dataset.href;
    // navigation disabled in play mode (even if GAME_ENABLED)
    if (href && !playMode) window.location.href = href;
  }

  /* =========================
     Magnet snap (tile-to-tile)
     ========================= */
  const SNAP_IN = 16;
  const SNAP_OUT = 52;
  const MAGNET_GAP = 0;
  const PULL = 0.62;

  function minOverlapForSnap(aLen, bLen) {
    return Math.max(10, Math.min(80, Math.floor(Math.min(aLen, bLen) * 0.25)));
  }

  function overlap1D(a1, a2, b1, b2) {
    return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
  }

  function rectFromLT(el, left, top) {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    return { left, top, right: left + w, bottom: top + h, w, h };
  }

  function setHint(el, on) {
    el.classList.toggle("snap-hint", !!on);
  }

  function pop(el) {
    el.classList.remove("snap-pop");
    void el.offsetWidth;
    el.classList.add("snap-pop");
    clearTimeout(el._popTO);
    el._popTO = setTimeout(() => el.classList.remove("snap-pop"), 180);
  }

  function magnetStep(el, nextLeft, nextTop, dragState) {
    const me = rectFromLT(el, nextLeft, nextTop);
    let bestX = null;
    let bestY = null;

    for (const other of tiles) {
      if (other === el) continue;

      const oL = parseFloat(other.style.left) || 0;
      const oT = parseFloat(other.style.top) || 0;
      const o = rectFromLT(other, oL, oT);

      const vOverlap = overlap1D(me.top, me.bottom, o.top, o.bottom);
      const hOverlap = overlap1D(me.left, me.right, o.left, o.right);

      if (vOverlap >= minOverlapForSnap(me.h, o.h)) {
        const xTargets = [o.left, o.right - me.w, o.right + MAGNET_GAP, (o.left - MAGNET_GAP) - me.w];
        for (const t of xTargets) {
          const dist = Math.abs(me.left - t);
          if (!bestX || dist < bestX.dist) bestX = { target: t, dist };
        }
      }

      if (hOverlap >= minOverlapForSnap(me.w, o.w)) {
        const yTargets = [o.top, o.bottom - me.h, o.bottom + MAGNET_GAP, (o.top - MAGNET_GAP) - me.h];
        for (const t of yTargets) {
          const dist = Math.abs(me.top - t);
          if (!bestY || dist < bestY.dist) bestY = { target: t, dist };
        }
      }
    }

    if (!dragState.snap) dragState.snap = { x: null, y: null };

    // release
    if (dragState.snap.x !== null && Math.abs(nextLeft - dragState.snap.x) > SNAP_OUT) dragState.snap.x = null;
    if (dragState.snap.y !== null && Math.abs(nextTop - dragState.snap.y) > SNAP_OUT) dragState.snap.y = null;

    // engage
    let popped = false;
    if (dragState.snap.x === null && bestX && bestX.dist <= SNAP_IN) { dragState.snap.x = bestX.target; popped = true; }
    if (dragState.snap.y === null && bestY && bestY.dist <= SNAP_IN) { dragState.snap.y = bestY.target; popped = true; }
    if (popped) pop(el);

    const hintOn =
      dragState.snap.x !== null || dragState.snap.y !== null ||
      (bestX && bestX.dist <= SNAP_OUT) ||
      (bestY && bestY.dist <= SNAP_OUT);

    setHint(el, hintOn);

    // pull X
    const tx = (dragState.snap.x !== null) ? dragState.snap.x : (bestX && bestX.dist <= SNAP_OUT ? bestX.target : null);
    if (tx !== null) {
      const dx = tx - nextLeft;
      nextLeft += dx * ((dragState.snap.x !== null) ? PULL : PULL * 0.55);
      if (Math.abs(dx) <= 1.2) nextLeft = tx;
    }

    // pull Y
    const ty = (dragState.snap.y !== null) ? dragState.snap.y : (bestY && bestY.dist <= SNAP_OUT ? bestY.target : null);
    if (ty !== null) {
      const dy = ty - nextTop;
      nextTop += dy * ((dragState.snap.y !== null) ? PULL : PULL * 0.55);
      if (Math.abs(dy) <= 1.2) nextTop = ty;
    }

    return { left: nextLeft, top: nextTop };
  }

  /* =========================
     DRAGGING (Edit + Play)
     ========================= */
  const JUST_DRAGGED_MS = 600;
  let playMode = false;

  // Matter hooks for moving tile bodies while dragging in play mode
  let tileBodies = new Map(); // el -> body (static)
  function syncTileBodyPosition(el) {
    if (!tileBodies || !tileBodies.has(el)) return;
    const body = tileBodies.get(el);
    if (!body || !window.Matter) return;
    const left = parseFloat(el.style.left) || 0;
    const top = parseFloat(el.style.top) || 0;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    window.Matter.Body.setPosition(body, { x: left + w / 2, y: top + h / 2 });
  }

  if (!isMobile) {
    tiles.forEach((el) => {
      el.style.cursor = "grab";
      el.style.userSelect = "none";
      el.style.touchAction = "none";

      let startX = null;
      let startY = null;
      let startLeft = 0;
      let startTop = 0;
      let moved = false;

      el.addEventListener("pointerdown", (e) => {
        // allow dragging in both edit mode and play mode (on index)
        if (playMode && !GAME_ENABLED) return;

        e.preventDefault();
        bringToFront(el);
        el.style.cursor = "grabbing";

        startX = e.clientX;
        startY = e.clientY;
        el._dragState = { snap: { x: null, y: null } };

        startLeft = parseFloat(el.style.left) || 0;
        startTop = parseFloat(el.style.top) || 0;
        moved = false;

        el.setPointerCapture(e.pointerId);
      });

      el.addEventListener("pointermove", (e) => {
        if (startX === null) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;

        let nextLeft = startLeft + dx;
        let nextTop = startTop + dy;

        // Magnet snap first (tile-to-tile), then grid snap
        const st = el._dragState || (el._dragState = { snap: { x: null, y: null } });
        const m = magnetStep(el, nextLeft, nextTop, st);
        nextLeft = m.left;
        nextTop = m.top;

        if (GRID_SNAP_ON_DRAG) {
          nextLeft = snapToGrid(nextLeft);
          nextTop = snapToGrid(nextTop);
        }

        const bounds = getMaxXY(el);
        nextLeft = clamp(nextLeft, 0, bounds.maxX);
        nextTop = clamp(nextTop, 0, bounds.maxY);

        el.style.left = nextLeft + "px";
        el.style.top = nextTop + "px";

        // If in play mode: move the physics platform too
        if (playMode) syncTileBodyPosition(el);
      });

      el.addEventListener("pointerup", () => {
        if (startX === null) return;

        el.style.cursor = "grab";

        if (GRID_SNAP_ON_DRAG) {
          const bounds = getMaxXY(el);
          const left = clamp(snapToGrid(parseFloat(el.style.left) || 0), 0, bounds.maxX);
          const top = clamp(snapToGrid(parseFloat(el.style.top) || 0), 0, bounds.maxY);
          el.style.left = left + "px";
          el.style.top = top + "px";
          if (playMode) syncTileBodyPosition(el);
        }

        if (moved) el.dataset.justDraggedUntil = String(Date.now() + JUST_DRAGGED_MS);
        else if (el.tagName.toLowerCase() === "a") maybeNavigate(el);

        startX = null;
        startY = null;
        setHint(el, false);
        el._dragState = null;
      });

      el.addEventListener("pointercancel", () => {
        el.style.cursor = "grab";
        startX = null;
        startY = null;
        setHint(el, false);
        el._dragState = null;
      });

      el.addEventListener("keydown", (e) => {
        if (playMode) return;
        if (el.tagName.toLowerCase() !== "a") return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          maybeNavigate(el);
        }
      });
    });
  }

  /* =========================
     Project hover video (only in edit mode)
     ========================= */
  document.querySelectorAll(".project-tile").forEach((tile) => {
    const expanded = tile.getAttribute("data-expanded-h");
    if (expanded) tile.style.setProperty("--expanded-h", `${parseInt(expanded, 10)}px`);
    const video = tile.querySelector(".project-video");
    if (!video) return;

    try { video.pause(); } catch (_) {}

    tile.addEventListener("mouseenter", () => {
      if (playMode) return;
      video.currentTime = 0;
      const p = video.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    });

    tile.addEventListener("mouseleave", () => {
      try { video.pause(); } catch (_) {}
      video.currentTime = 0;
    });
  });

  /* =========================
     GAME: PATH + KEY + DOOR (INDEX ONLY)
     ========================= */
  if (!GAME_ENABLED) return;

  const hasMatter = typeof window.Matter !== "undefined";
  let Engine, Bodies, Body, Composite, Events;
  if (hasMatter) ({ Engine, Bodies, Body, Composite, Events } = window.Matter);

  // HUD
  const hud = document.createElement("div");
  hud.className = "play-hud";
  hud.innerHTML = `
    <button type="button" id="togglePlay">Game mode: OFF</button>
    <div><strong>Level:</strong> <span id="level">1</span></div>
    <div><strong>Key:</strong> <span id="keyState">NO</span></div>
    <div class="mini">Drag blocks to build a path · A/D move · Space jump</div>
  `;
  document.body.appendChild(hud);

  const btn = hud.querySelector("#togglePlay");
  const levelEl = hud.querySelector("#level");
  const keyStateEl = hud.querySelector("#keyState");

  // Prevent Space/Enter "clicking" the button when it has focus
  btn.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.key === "Enter") e.preventDefault();
  });

  // DOM game elements
  const playerEl = document.createElement("div");
  playerEl.className = "player";
  playerEl.style.display = "none";
  stage.appendChild(playerEl);

  const keyEl = document.createElement("div");
  keyEl.className = "key";
  keyEl.style.display = "none";
  keyEl.textContent = "🔑";
  stage.appendChild(keyEl);

  const doorEl = document.createElement("div");
  doorEl.className = "door";
  doorEl.style.display = "none";
  doorEl.innerHTML = `<span class="door-icon">🚪</span>`;
  stage.appendChild(doorEl);

  function stageSize() {
    const rect = stage.getBoundingClientRect();
    return { w: rect.width, h: rect.height, top: rect.top, left: rect.left };
  }

  function stagePlayHeight() {
    const rect = stage.getBoundingClientRect();
    const footerH = getFooterHeight();
    const usable = Math.max(260, Math.min(rect.height, window.innerHeight - footerH - rect.top));
    return usable;
  }

  // Matter state
  let engine = null;
  let playerBody = null;
  let keyBody = null;
  let doorBody = null;

  let level = 1;
  let hasKey = false;

  const keys = { a:false, d:false, space:false };

  function setKeyState(v) {
    hasKey = !!v;
    keyStateEl.textContent = hasKey ? "YES" : "NO";
    keyStateEl.style.opacity = hasKey ? "1" : "0.7";
  }

  function applyPlayTileSkin(on) {
    tiles.forEach((el) => {
      el.classList.toggle("play-mini", on);
      el.classList.toggle("play-blank", on);
    });
  }

  function buildStaticTileBodies() {
    tileBodies = new Map();
    tiles.forEach((el) => {
      const left = parseFloat(el.style.left) || 0;
      const top = parseFloat(el.style.top) || 0;
      const bw = el.offsetWidth;
      const bh = el.offsetHeight;

      const body = Bodies.rectangle(left + bw/2, top + bh/2, bw, bh, {
        isStatic: true,
        friction: 0.85,
        restitution: 0.0,
        label: "tile"
      });

      Composite.add(engine.world, body);
      tileBodies.set(el, body);
    });
  }

  function placeDoorAndKey() {
    const { w } = stageSize();
    const playH = stagePlayHeight();

    // Difficulty ramp: spawn higher and closer to the top as levels increase
    const t = clamp((level - 1) / 10, 0, 1); // 0..1 over ~10 levels
    const highMin = 70 + 40 * t;
    const highMax = 170 + 140 * t;

    // Door fixed on the right, gradually higher
    const doorW = 68;
    const doorH = 108;
    const doorX = w - 70;
    let doorY = playH - (140 + 170 * t);
    doorY = clamp(doorY, highMin, playH - 120);

    doorEl.style.display = "flex";
    doorEl.style.left = snapToGrid(doorX - doorW/2) + "px";
    doorEl.style.top = snapToGrid(doorY - doorH/2) + "px";

    doorBody = Bodies.rectangle(doorX, doorY, doorW, doorH, {
      isStatic: true,
      isSensor: true,
      label: "door"
    });
    Composite.add(engine.world, doorBody);

    // Key away from the door, also higher with difficulty
    const kR = 18;
    const keyXMin = 120;
    const keyXMax = Math.max(180, w - 320);
    let kx = keyXMin + Math.random() * (keyXMax - keyXMin);
    kx = snapToGrid(clamp(kx, keyXMin, keyXMax));

    let ky = (playH - (200 + 240 * t)) + Math.random() * (110 + 120 * t);
    ky = snapToGrid(clamp(ky, highMin, playH - 170));

    keyEl.style.display = "flex";
    keyEl.style.left = (kx - kR) + "px";
    keyEl.style.top = (ky - kR) + "px";

    keyBody = Bodies.circle(kx, ky, kR, {
      isStatic: true,
      isSensor: true,
      label: "key"
    });
    Composite.add(engine.world, keyBody);
  }

  function resetPlayer() {
    const playH = stagePlayHeight();
    const x = 90;
    const y = Math.min(120, playH - 220);
    if (!playerBody) return;
    Body.setPosition(playerBody, { x, y });
    Body.setVelocity(playerBody, { x: 0, y: 0 });
    Body.setAngle(playerBody, 0);
    Body.setAngularVelocity(playerBody, 0);
  }

  function enablePlayMode() {
    if (!hasMatter) {
      alert("Matter.js not loaded. Add the CDN script tag above drag.js.");
      return;
    }

    playMode = true;
    document.body.classList.add("play-mode");

    btn.blur(); // Space should jump, not toggle
    btn.textContent = "Game mode: ON";
    levelEl.textContent = String(level);
    setKeyState(false);

    // Shrink tiles into blank blocks
    applyPlayTileSkin(true);

    // Wait one frame so CSS sizing applies before building bodies
    requestAnimationFrame(() => {
      engine = Engine.create();

      // Difficulty ramp: slightly stronger gravity over time
      const g = clamp(1.2 + (level - 1) * 0.04, 1.2, 1.85);
      engine.gravity.y = g;

      const { w } = stageSize();
      const playH = stagePlayHeight();

      // bounds
      const ground = Bodies.rectangle(w/2, playH + 40, w + 400, 80, { isStatic:true, label:"ground" });
      const leftWall = Bodies.rectangle(-40, playH/2, 80, playH + 400, { isStatic:true });
      const rightWall = Bodies.rectangle(w+40, playH/2, 80, playH + 400, { isStatic:true });
      const ceiling = Bodies.rectangle(w/2, -40, w + 400, 80, { isStatic:true });
      Composite.add(engine.world, [ground, leftWall, rightWall, ceiling]);

      // player
      playerBody = Bodies.rectangle(90, 120, 44, 56, {
        friction: 0.02,
        restitution: 0.0,
        density: 0.002,
        label: "player"
      });
      Composite.add(engine.world, playerBody);

      playerEl.style.display = "block";

      // tiles as static platforms (movable by dragging)
      buildStaticTileBodies();

      // door + key
      placeDoorAndKey();

      // collision logic
      Events.on(engine, "collisionStart", (evt) => {
        for (const pair of evt.pairs) {
          const a = pair.bodyA;
          const b = pair.bodyB;

          // key pickup
          if (!hasKey && keyBody && ((a === playerBody && b === keyBody) || (b === playerBody && a === keyBody))) {
            setKeyState(true);
            try { Composite.remove(engine.world, keyBody); } catch(_) {}
            keyBody = null;
            keyEl.style.display = "none";
          }

          // door reach
          if (hasKey && doorBody && ((a === playerBody && b === doorBody) || (b === playerBody && a === doorBody))) {
            nextLevel();
          }
        }
      });

      requestAnimationFrame(tick);
    });
  }

  function disablePlayMode() {
    playMode = false;
    document.body.classList.remove("play-mode");

    btn.textContent = "Game mode: OFF";

    playerEl.style.display = "none";
    keyEl.style.display = "none";
    doorEl.style.display = "none";

    // Restore tiles
    applyPlayTileSkin(false);

    engine = null;
    playerBody = null;
    tileBodies = new Map();
    keyBody = null;
    doorBody = null;
    setKeyState(false);
  }

  function onGroundNow() {
    if (!playerBody) return false;
    return Math.abs(playerBody.velocity.y) < 1.2;
  }

  function nextLevel() {
    // little door pop
    doorEl.classList.remove("door-pop");
    void doorEl.offsetWidth;
    doorEl.classList.add("door-pop");

    level += 1;
    levelEl.textContent = String(level);

    // reset key + player (tiles stay where player placed them)
    setKeyState(false);

    if (engine && doorBody) { try { Composite.remove(engine.world, doorBody); } catch(_) {} }
    if (engine && keyBody) { try { Composite.remove(engine.world, keyBody); } catch(_) {} }
    doorBody = null;
    keyBody = null;
    keyEl.style.display = "none";

    placeDoorAndKey();
    resetPlayer();
  }

  function tick() {
    if (!engine) return;

    Engine.update(engine, 1000 / 60);

    // Movement
    if (playerBody) {
      const accel = 0.95;
      const vx = playerBody.velocity.x;

      if (keys.a) Body.setVelocity(playerBody, { x: clamp(vx - accel, -7.5, 7.5), y: playerBody.velocity.y });
      if (keys.d) Body.setVelocity(playerBody, { x: clamp(vx + accel, -7.5, 7.5), y: playerBody.velocity.y });

      if (keys.space && onGroundNow()) {
        Body.setVelocity(playerBody, { x: playerBody.velocity.x, y: -12 });
      }

      playerEl.style.left = (playerBody.position.x - 22) + "px";
      playerEl.style.top = (playerBody.position.y - 28) + "px";
    }

    requestAnimationFrame(tick);
  }

  // Toggle play
  btn.addEventListener("click", () => {
    if (playMode) disablePlayMode();
    else enablePlayMode();
  });

  // Keyboard controls
  window.addEventListener("keydown", (e) => {
    if (e.key === "a" || e.key === "A") keys.a = true;
    if (e.key === "d" || e.key === "D") keys.d = true;

    if (e.code === "Space") {
      keys.space = true;
      if (playMode) e.preventDefault(); // stop page scroll
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "a" || e.key === "A") keys.a = false;
    if (e.key === "d" || e.key === "D") keys.d = false;
    if (e.code === "Space") keys.space = false;
  });
})();