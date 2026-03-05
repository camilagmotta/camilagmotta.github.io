(() => {
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

  function randomizePositions() {
    if (isMobile) return;
    tiles.forEach((el, i) => {
      el.dataset.id = el.dataset.id || "tile-" + i;
      el.style.position = "absolute";

      const { maxX, maxY } = getMaxXY(el);

      const pad = 8;
      const x = Math.floor(Math.random() * Math.max(1, maxX - pad)) + pad / 2;
      const y = Math.floor(Math.random() * Math.max(1, maxY - pad)) + pad / 2;

      el.style.left = clamp(x, 0, maxX) + "px";
      el.style.top = clamp(y, 0, maxY) + "px";
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
      el.classList.remove("play-mini");
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
    if (href) window.location.href = href;
  }

  /* =========================
     JUICY MAGNET SNAP (drag mode)
     ========================= */
  const SNAP_IN = 16;
  const SNAP_OUT = 52;
  const MAGNET_GAP = 10;
  const PULL = 0.62;
// Overlap needed for snapping (dynamic, so big/small tiles still snap nicely)
function minOverlapForSnap(aLen, bLen){
  // 25% of the smaller dimension, clamped
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
     DRAGGING (Edit mode)
     ========================= */
  const JUST_DRAGGED_MS = 600;
  let playMode = false;

  if (!isMobile) {
    tiles.forEach((el) => {
      el.classList.remove("play-mini");
      el.style.cursor = "grab";
      el.style.userSelect = "none";
      el.style.touchAction = "none";

      let startX = null;
      let startY = null;
      let startLeft = 0;
      let startTop = 0;
      let moved = false;

      el.addEventListener("pointerdown", (e) => {
        if (playMode) return;
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
        if (playMode) return;
        if (startX === null) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;

        let nextLeft = startLeft + dx;
        let nextTop = startTop + dy;

        const st = el._dragState || (el._dragState = { snap: { x: null, y: null } });
        const m = magnetStep(el, nextLeft, nextTop, st);
        nextLeft = m.left;
        nextTop = m.top;

        const bounds = getMaxXY(el);
        nextLeft = clamp(nextLeft, 0, bounds.maxX);
        nextTop = clamp(nextTop, 0, bounds.maxY);

        el.style.left = nextLeft + "px";
        el.style.top = nextTop + "px";
      });

      el.addEventListener("pointerup", () => {
        if (playMode) return;
        if (startX === null) return;

        el.style.cursor = "grab";

        if (moved) el.dataset.justDraggedUntil = String(Date.now() + JUST_DRAGGED_MS);
        else if (el.tagName.toLowerCase() === "a") maybeNavigate(el);

        startX = null;
        startY = null;
        setHint(el, false);
        el._dragState = null;
      });

      el.addEventListener("pointercancel", () => {
        if (playMode) return;
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
     Project hover video + expand height
     ========================= */
  document.querySelectorAll(".project-tile").forEach((tile) => {
    const expanded = tile.getAttribute("data-expanded-h");
    if (expanded) tile.style.setProperty("--expanded-h", `${parseInt(expanded, 10)}px`);
    const video = tile.querySelector(".project-video");
    if (!video) return;

    video.pause();

    tile.addEventListener("mouseenter", () => {
      if (playMode) return;
      video.currentTime = 0;
      const p = video.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    });

    tile.addEventListener("mouseleave", () => {
      video.pause();
      video.currentTime = 0;
    });
  });

  /* =========================
  /* =========================
     MATTER.JS — PATH + KEY + DOOR GAME
     =========================
     Edit mode: drag & snap tiles to build platforms.
     Play mode: player can move/jump on those platforms, collect key, reach door.
  */
  const hasMatter = typeof window.Matter !== "undefined";
  let Engine, Bodies, Body, Composite, Events;
  if (hasMatter) ({ Engine, Bodies, Body, Composite, Events } = window.Matter);

  // HUD
  const hud = document.createElement("div");
  hud.className = "play-hud";
  hud.innerHTML = `
    <button type="button" id="togglePlay">Play mode: OFF</button>
    <div><strong>Level:</strong> <span id="level">1</span></div>
    <div><strong>Key:</strong> <span id="keyState">NO</span></div>
    <div class="mini">Drag tiles to build a path · WASD move · Space jump</div>
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
  doorEl.innerHTML = `<span class="door-icon">🚪</span><span class="door-label">EXIT</span>`;
  stage.appendChild(doorEl);

  function stageSize() {
    const rect = stage.getBoundingClientRect();
    return { w: rect.width, h: rect.height, top: rect.top, left: rect.left };
  }

  // Matter state
  let engine = null;
  let playerBody = null;
  let tileBodies = new Map(); // el -> body (static)
  let keyBody = null;
  let doorBody = null;

  let level = 1;
  let hasKey = false;

  const keys = { a:false, d:false, w:false, s:false, space:false };

  function setKeyState(v) {
    hasKey = !!v;
    keyStateEl.textContent = hasKey ? "YES" : "NO";
    keyStateEl.style.opacity = hasKey ? "1" : "0.7";
  }

  function stagePlayHeight() {
    const rect = stage.getBoundingClientRect();
    const footerH = getFooterHeight();
    // the portion of stage visible above the footer
    const usable = Math.max(240, Math.min(rect.height, window.innerHeight - footerH - rect.top));
    return usable;
  }

  function buildStaticTileBodies() {
    tileBodies.clear();
    tiles.forEach((el) => {
      const left = parseFloat(el.style.left) || 0;
      const top = parseFloat(el.style.top) || 0;
      const bw = el.offsetWidth;
      const bh = el.offsetHeight;

      const body = Bodies.rectangle(left + bw/2, top + bh/2, bw, bh, {
        isStatic: true,
        friction: 0.6,
        restitution: 0.0,
        label: "tile"
      });

      Composite.add(engine.world, body);
      tileBodies.set(el, body);

      // prevent link clicking while in play mode
      el.dataset._savedPointer = el.style.pointerEvents || "";
      el.style.pointerEvents = "none";
    });
  }

  function placeDoorAndKey() {
    const { w } = stageSize();
    const playH = stagePlayHeight();

    // Door fixed on the right
    const doorW = 72;
    const doorH = 110;
    const doorX = w - 70;
    const doorY = clamp(playH - 160, 120, playH - 140);

    doorEl.style.display = "flex";
    doorEl.style.left = (doorX - doorW/2) + "px";
    doorEl.style.top = (doorY - doorH/2) + "px";

    doorBody = Bodies.rectangle(doorX, doorY, doorW, doorH, {
      isStatic: true,
      isSensor: true,
      label: "door"
    });
    Composite.add(engine.world, doorBody);

    // Key somewhere NOT on the far right 
    const kR = 18;
    let kx = 140 + Math.random() * (w - 380);
    kx = Math.min(kx, w - 260);
    kx = clamp(kx, 110, w - 240);

    let ky = 110 + Math.random() * (playH - 260);
    ky = clamp(ky, 90, playH - 170);

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

    // Remove focus from the button so Space doesn't toggle it
    btn.blur();
    btn.textContent = "Play mode: ON";

    levelEl.textContent = String(level);
    setKeyState(false);

    // stop any hover videos
    document.querySelectorAll(".project-video").forEach(v => { try { v.pause(); } catch(e){} });

    engine = Engine.create();
    engine.gravity.y = 1.0;

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

    // tiles as static platforms
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
          try { Composite.remove(engine.world, keyBody); } catch(e) {}
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
  }

  function disablePlayMode() {
    playMode = false;
    document.body.classList.remove("play-mode");
    btn.textContent = "Play mode: OFF";

    playerEl.style.display = "none";
    keyEl.style.display = "none";
    doorEl.style.display = "none";

    tiles.forEach((el) => {
      el.style.pointerEvents = el.dataset._savedPointer || "";
      delete el.dataset._savedPointer;
      el.style.transform = "";
    });

    engine = null;
    playerBody = null;
    tileBodies.clear();
    keyBody = null;
    doorBody = null;
    setKeyState(false);
  }

  function onGroundNow() {
    if (!playerBody) return false;
    // simple heuristic; good enough for this playful portfolio
    return Math.abs(playerBody.velocity.y) < 1.2;
  }

  function nextLevel() {
    doorEl.classList.remove("door-pop");
    void doorEl.offsetWidth;
    doorEl.classList.add("door-pop");

    level += 1;
    levelEl.textContent = String(level);

    // reset key + player (tiles stay where the player built them)
    setKeyState(false);

    if (engine && doorBody) {
      try { Composite.remove(engine.world, doorBody); } catch(e) {}
      doorBody = null;
    }
    if (engine && keyBody) {
      try { Composite.remove(engine.world, keyBody); } catch(e) {}
      keyBody = null;
    }
    keyEl.style.display = "none";

    placeDoorAndKey();
    resetPlayer();
  }

  function tick() {
    if (!engine) return;

    Engine.update(engine, 1000 / 60);

    // Movement
    if (playerBody) {
      const accel = 0.70;
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
    if (e.key === "w" || e.key === "W") keys.w = true;
    if (e.key === "s" || e.key === "S") keys.s = true;

    if (e.code === "Space") {
      keys.space = true;
      if (playMode) e.preventDefault(); // stop page scroll
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "a" || e.key === "A") keys.a = false;
    if (e.key === "d" || e.key === "D") keys.d = false;
    if (e.key === "w" || e.key === "W") keys.w = false;
    if (e.key === "s" || e.key === "S") keys.s = false;
    if (e.code === "Space") keys.space = false;
  });
})();