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

  // Footer boundary (supports: <footer>, .footer, .tile-footer)
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

  // Disable default navigation on stage tiles that are <a> (so dragging doesn't instantly click)
  tiles.forEach((el) => {
    if (el.tagName.toLowerCase() === "a") {
      if (!el.dataset.href) el.dataset.href = el.getAttribute("href") || "";
      el.removeAttribute("href");
      el.setAttribute("role", "link");
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    }
  });

  // New random layout every reload
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
    if (href) window.location.href = href;
  }

  /* =========================
     JUICY MAGNET SNAP (nice feel, easy detach)
     ========================= */
  const SNAP_IN = 12;
  const SNAP_OUT = 40;
  const MAGNET_GAP = 0;
  const PULL = 0.50;
  const OVERLAP_MIN = 26;

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

      if (vOverlap >= OVERLAP_MIN) {
        const xTargets = [
          o.left,
          o.right - me.w,
          o.right + MAGNET_GAP,
          (o.left - MAGNET_GAP) - me.w
        ];
        for (const t of xTargets) {
          const dist = Math.abs(me.left - t);
          if (!bestX || dist < bestX.dist) bestX = { target: t, dist };
        }
      }

      if (hOverlap >= OVERLAP_MIN) {
        const yTargets = [
          o.top,
          o.bottom - me.h,
          o.bottom + MAGNET_GAP,
          (o.top - MAGNET_GAP) - me.h
        ];
        for (const t of yTargets) {
          const dist = Math.abs(me.top - t);
          if (!bestY || dist < bestY.dist) bestY = { target: t, dist };
        }
      }
    }

    if (!dragState.snap) dragState.snap = { x: null, y: null };

    // release
    if (dragState.snap.x && Math.abs(nextLeft - dragState.snap.x) > SNAP_OUT) dragState.snap.x = null;
    if (dragState.snap.y && Math.abs(nextTop - dragState.snap.y) > SNAP_OUT) dragState.snap.y = null;

    // engage
    let popped = false;
    if (!dragState.snap.x && bestX && bestX.dist <= SNAP_IN) { dragState.snap.x = bestX.target; popped = true; }
    if (!dragState.snap.y && bestY && bestY.dist <= SNAP_IN) { dragState.snap.y = bestY.target; popped = true; }
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
      el.style.cursor = "grab";
      el.style.userSelect = "none";
      el.style.touchAction = "none";

      let startX = null;
      let startY = null;
      let startLeft = 0;
      let startTop = 0;
      let moved = false;

      el.addEventListener("pointerdown", (e) => {
        if (playMode) return; // disable drag in play mode

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

        if (moved) {
          el.dataset.justDraggedUntil = String(Date.now() + JUST_DRAGGED_MS);
        } else {
          if (el.tagName.toLowerCase() === "a") maybeNavigate(el);
        }

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
      if (playMode) return; // don't fight game mode
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
     MATTER.JS MINI GAME (Play mode)
     ========================= */
  const hasMatter = typeof window.Matter !== "undefined";
  let Engine, Bodies, Body, Composite, Events;
  if (hasMatter) {
    ({ Engine, Bodies, Body, Composite, Events } = window.Matter);
  }

  // HUD
  const hud = document.createElement("div");
  hud.className = "play-hud";
  hud.innerHTML = `
    <button type="button" id="togglePlay">Play mode: OFF</button>
    <div><strong>Score:</strong> <span id="score">0</span></div>
    <div style="opacity:.7;">WASD move · Space jump · E grab · F throw</div>
  `;
  document.body.appendChild(hud);

  const btn = hud.querySelector("#togglePlay");
  const scoreEl = hud.querySelector("#score");
  let score = 0;

  // DOM game elements
  const playerEl = document.createElement("div");
  playerEl.className = "player";
  playerEl.style.display = "none";
  stage.appendChild(playerEl);

  const targetEl = document.createElement("div");
  targetEl.className = "target";
  targetEl.style.display = "none";
  targetEl.textContent = "★";
  stage.appendChild(targetEl);

  // Matter state
  let engine = null;
  let playerBody = null;
  let ground = null;
  let leftWall = null;
  let rightWall = null;
  let ceiling = null;
  let targetBody = null;
  let tileBodies = new Map(); // el -> body
  let held = null;

  const keys = { w:false, a:false, s:false, d:false, space:false };
  let facing = 1;

  function stageSize() {
    const rect = stage.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }

  function tileMass(el) {
    if (el.classList.contains("t-xl")) return 6;
    if (el.classList.contains("t-lg")) return 4;
    if (el.classList.contains("t-md")) return 2.8;
    return 2.0;
  }

  function enablePlayMode() {
    if (!hasMatter) {
      alert("Matter.js not loaded. Make sure you added the script tag above drag.js.");
      return;
    }
    playMode = true;
    document.body.classList.add("play-mode");

    btn.textContent = "Play mode: ON";
    score = 0;
    scoreEl.textContent = "0";

    // Hide hover video behavior by pausing any playing videos
    document.querySelectorAll(".project-video").forEach(v => { try { v.pause(); } catch(e){} });

    // Init Matter
    engine = Engine.create();
    engine.gravity.y = 1.25;

    const { w, h } = stageSize();
    const footerH = getFooterHeight();

    // Arena bounds (keep above footer)
    const playH = Math.max(200, Math.min(h, window.innerHeight - footerH - stage.getBoundingClientRect().top));

    ground = Bodies.rectangle(w/2, playH + 40, w + 400, 80, { isStatic:true });
    leftWall = Bodies.rectangle(-40, playH/2, 80, playH + 400, { isStatic:true });
    rightWall = Bodies.rectangle(w+40, playH/2, 80, playH + 400, { isStatic:true });
    ceiling = Bodies.rectangle(w/2, -40, w + 400, 80, { isStatic:true });

    Composite.add(engine.world, [ground, leftWall, rightWall, ceiling]);

    // Player
    playerBody = Bodies.rectangle(140, 120, 44, 56, {
      friction: 0.02,
      restitution: 0.0,
      density: 0.002
    });
    Composite.add(engine.world, playerBody);

    playerEl.style.display = "block";

    // Target
    const tx = Math.min(w - 120, 820);
    const ty = Math.min(playH - 120, 320);
    targetBody = Bodies.circle(tx, ty, 30, { isStatic:true });
    Composite.add(engine.world, targetBody);

    targetEl.style.display = "flex";
    targetEl.style.left = (tx - 30) + "px";
    targetEl.style.top = (ty - 30) + "px";

    // Convert tiles to physics bodies
    tileBodies.clear();
    tiles.forEach((el) => {
      const left = parseFloat(el.style.left) || 0;
      const top = parseFloat(el.style.top) || 0;
      const bw = el.offsetWidth;
      const bh = el.offsetHeight;

      const body = Bodies.rectangle(left + bw/2, top + bh/2, bw, bh, {
        friction: 0.12,
        restitution: 0.15,
        density: 0.0015 * tileMass(el)
      });

      Composite.add(engine.world, body);
      tileBodies.set(el, body);

      // During play mode: don't let clicks navigate
      el.dataset._savedPointer = el.style.pointerEvents || "";
      el.style.pointerEvents = "none";
    });

    // Scoring when any tile hits the target
    Events.on(engine, "collisionStart", (evt) => {
      for (const p of evt.pairs) {
        const a = p.bodyA, b = p.bodyB;
        if (!targetBody) continue;

        const isTargetHit =
          (a === targetBody && isTileBody(b)) ||
          (b === targetBody && isTileBody(a));

        if (isTargetHit) {
          score += 10;
          scoreEl.textContent = String(score);
          // small “hit feedback”
          targetEl.style.transform = "scale(1.06)";
          setTimeout(() => targetEl.style.transform = "scale(1)", 120);
        }
      }
    });

    // Start loop
    requestAnimationFrame(tick);
  }

  function isTileBody(body) {
    for (const b of tileBodies.values()) if (b === body) return true;
    return false;
  }

  function disablePlayMode() {
    playMode = false;
    document.body.classList.remove("play-mode");
    btn.textContent = "Play mode: OFF";

    playerEl.style.display = "none";
    targetEl.style.display = "none";

    // Restore tile interactivity
    tiles.forEach((el) => {
      el.style.pointerEvents = el.dataset._savedPointer || "";
      delete el.dataset._savedPointer;
      // reset any rotation from physics
      el.style.transform = "";
    });

    // Tear down engine
    engine = null;
    playerBody = null;
    targetBody = null;
    tileBodies.clear();
    held = null;
  }

  function onGroundNow() {
    if (!playerBody) return false;
    // very simple ground check: close to play floor level
    // (good enough for a portfolio toy)
    return Math.abs(playerBody.velocity.y) < 1.2;
  }

  function nearestTileToPlayer(maxDist = 140) {
    if (!playerBody) return null;
    let best = null;
    let bestD = Infinity;
    const px = playerBody.position.x;
    const py = playerBody.position.y;

    for (const [el, body] of tileBodies.entries()) {
      const dx = body.position.x - px;
      const dy = body.position.y - py;
      const d = Math.hypot(dx, dy);
      if (d < bestD && d <= maxDist) {
        bestD = d;
        best = { el, body };
      }
    }
    return best;
  }

  function grab() {
    if (held) return;
    const n = nearestTileToPlayer(160);
    if (!n) return;
    held = n;

    // Make it lighter & stop tumbling while held
    Body.setAngularVelocity(n.body, 0);
    Body.setVelocity(n.body, { x: 0, y: 0 });
  }

  function throwHeld() {
    if (!held) return;
    const b = held.body;
    held = null;

    // Throw impulse
    const power = 14;
    Body.setVelocity(b, { x: facing * power, y: -8 });
    Body.setAngularVelocity(b, facing * 0.22);
  }

  function tick() {
    if (!engine) return;

    // Step physics
    Engine.update(engine, 1000 / 60);

    // Controls
    if (playerBody) {
      const speed = 0.9;
      const vx = playerBody.velocity.x;

      if (keys.a) { facing = -1; Body.setVelocity(playerBody, { x: clamp(vx - speed, -8, 8), y: playerBody.velocity.y }); }
      if (keys.d) { facing = 1;  Body.setVelocity(playerBody, { x: clamp(vx + speed, -8, 8), y: playerBody.velocity.y }); }

      // Jump (only if nearly grounded)
      if (keys.space && onGroundNow()) {
        Body.setVelocity(playerBody, { x: playerBody.velocity.x, y: -12 });
      }

      // Update player DOM
      playerEl.style.left = (playerBody.position.x - 22) + "px";
      playerEl.style.top = (playerBody.position.y - 28) + "px";
    }

    // Hold behavior: keep held tile hovering near player
    if (held && playerBody) {
      const carryX = playerBody.position.x + facing * 54;
      const carryY = playerBody.position.y - 30;
      Body.setPosition(held.body, { x: carryX, y: carryY });
      Body.setVelocity(held.body, { x: 0, y: 0 });
      Body.setAngle(held.body, 0);
    }

    // Sync tile DOM to physics bodies
    for (const [el, body] of tileBodies.entries()) {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      el.style.left = (body.position.x - w / 2) + "px";
      el.style.top = (body.position.y - h / 2) + "px";
      el.style.transform = `rotate(${body.angle}rad)`;
    }

    requestAnimationFrame(tick);
  }

  // Toggle button
  btn.addEventListener("click", () => {
    if (playMode) disablePlayMode();
    else enablePlayMode();
  });

  // Keyboard controls
  window.addEventListener("keydown", (e) => {
    if (e.key === "w" || e.key === "W") keys.w = true;
    if (e.key === "a" || e.key === "A") keys.a = true;
    if (e.key === "s" || e.key === "S") keys.s = true;
    if (e.key === "d" || e.key === "D") keys.d = true;
    if (e.code === "Space") keys.space = true;

    if (!playMode) return;

    if (e.key === "e" || e.key === "E") grab();
    if (e.key === "f" || e.key === "F") throwHeld();
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "w" || e.key === "W") keys.w = false;
    if (e.key === "a" || e.key === "A") keys.a = false;
    if (e.key === "s" || e.key === "S") keys.s = false;
    if (e.key === "d" || e.key === "D") keys.d = false;
    if (e.code === "Space") keys.space = false;
  });
})();