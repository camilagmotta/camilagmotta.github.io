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
  const MAGNET_GAP = 0;
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
     MATTER.JS MINI GAME
     ========================= */
  const hasMatter = typeof window.Matter !== "undefined";
  let Engine, Bodies, Body, Composite, Events, Vector;
  if (hasMatter) ({ Engine, Bodies, Body, Composite, Events, Vector } = window.Matter);

  // HUD
  const hud = document.createElement("div");
  hud.className = "play-hud";
  hud.innerHTML = `
    <button type="button" id="togglePlay">Play mode: OFF</button>
    <div><strong>Score:</strong> <span id="score">0</span></div>
    <div><strong>Combo:</strong> <span id="combo">x1</span></div>
    <div class="mini">WASD move · Space jump · E grab · Click throw</div>
  `;
  document.body.appendChild(hud);

  const btn = hud.querySelector("#togglePlay");
  const scoreEl = hud.querySelector("#score");
  const comboEl = hud.querySelector("#combo");
// Prevent Space/Enter from “clicking” the play button when it has focus
btn.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
  }
});


  let score = 0;
  let combo = 1;
  let comboTimer = null;

  // DOM game elements
  const playerEl = document.createElement("div");
  playerEl.className = "player";
  playerEl.style.display = "none";
  stage.appendChild(playerEl);

  // Targets container
  const targetEls = [];
  const TARGET_COUNT = 3;

  // Matter state
  let engine = null;
  let playerBody = null;
  let targetBodies = [];
  let tileBodies = new Map();
  let held = null;

  const keys = { a:false, d:false, w:false, s:false, space:false };
  let facing = 1;

  // Mouse aim
  let aim = { x: 0, y: 0 };

  // Sound (tiny pop)
  let audioCtx = null;
  function popSound() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "square";
      o.frequency.value = 420;
      g.gain.value = 0.06;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
      o.stop(audioCtx.currentTime + 0.09);
    } catch(e) {}
  }

  function particleBurst(x, y, n = 10) {
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.className = "p";
      p.style.left = x + "px";
      p.style.top = y + "px";
      stage.appendChild(p);

      const ang = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 4;
      const dx = Math.cos(ang) * sp;
      const dy = Math.sin(ang) * sp;

      let t = 0;
      const tick = () => {
        t += 1;
        const ox = dx * t;
        const oy = dy * t + 0.08 * t * t; // tiny gravity
        p.style.transform = `translate(${ox}px, ${oy}px) scale(${1 - t/22})`;
        p.style.opacity = String(1 - t/22);
        if (t < 22) requestAnimationFrame(tick);
        else p.remove();
      };
      requestAnimationFrame(tick);
    }
  }

  function stageSize() {
    const rect = stage.getBoundingClientRect();
    return { w: rect.width, h: rect.height, top: rect.top, left: rect.left };
  }

  function tileMass(el) {
    if (el.classList.contains("t-xl")) return 6;
    if (el.classList.contains("t-lg")) return 4;
    if (el.classList.contains("t-md")) return 2.8;
    return 2.0;
  }

  function enablePlayMode() {
    if (!hasMatter) {
      alert("Matter.js not loaded. Add the CDN script tag above drag.js.");
      return;
    }
    playMode = true;
    document.body.classList.add("play-mode");

    btn.textContent = "Play mode: ON";
    // If the button has focus, Space/Enter can trigger a click. Blur it so Space is free for jumping.
    try { btn.blur(); } catch(e) {}
    score = 0; combo = 1;
    scoreEl.textContent = "0";
    comboEl.textContent = "x1";

    // stop any hover videos
    document.querySelectorAll(".project-video").forEach(v => { try { v.pause(); } catch(e){} });

    engine = Engine.create();
    engine.gravity.y = 1.25;

    const { w, h, top } = stageSize();
    const footerH = getFooterHeight();
    const playH = Math.max(240, Math.min(h, window.innerHeight - footerH - top));

    // bounds
    const ground = Bodies.rectangle(w/2, playH + 40, w + 400, 80, { isStatic:true });
    const leftWall = Bodies.rectangle(-40, playH/2, 80, playH + 400, { isStatic:true });
    const rightWall = Bodies.rectangle(w+40, playH/2, 80, playH + 400, { isStatic:true });
    const ceiling = Bodies.rectangle(w/2, -40, w + 400, 80, { isStatic:true });
    Composite.add(engine.world, [ground, leftWall, rightWall, ceiling]);

    // player
    playerBody = Bodies.rectangle(140, 120, 44, 56, {
      friction: 0.02,
      restitution: 0.0,
      density: 0.002
    });
    Composite.add(engine.world, playerBody);

    playerEl.style.display = "block";

    // targets
    targetBodies = [];
    // create target DOM els if not yet
    while (targetEls.length < TARGET_COUNT) {
      const t = document.createElement("div");
      t.className = "target";
      t.textContent = "★";
      t.style.display = "none";
      stage.appendChild(t);
      targetEls.push(t);
    }

    for (let i = 0; i < TARGET_COUNT; i++) {
      const tx = clamp(520 + Math.random() * (w - 640), 220, w - 100);
      const ty = clamp(120 + Math.random() * (playH - 260), 120, playH - 120);
      const body = Bodies.circle(tx, ty, 30, { isStatic:true });
      Composite.add(engine.world, body);
      targetBodies.push(body);

      const el = targetEls[i];
      el.style.display = "flex";
      el.style.left = (tx - 30) + "px";
      el.style.top = (ty - 30) + "px";
      el.style.transform = "scale(1)";
    }


    // Make tiles into uniform “pickup” blocks in play mode
    tiles.forEach((el) => {
      el.classList.add("play-mini");
    });

    // tiles -> bodies
    tileBodies.clear();
    tiles.forEach((el) => {
      el.classList.remove("play-mini");
      const left = parseFloat(el.style.left) || 0;
      const top = parseFloat(el.style.top) || 0;
      const bw = el.offsetWidth;
      const bh = el.offsetHeight;

      const body = Bodies.rectangle(left + bw/2, top + bh/2, bw, bh, {
        friction: 0.12,
        restitution: 0.22,
        density: 0.0015 * tileMass(el)
      });

      Composite.add(engine.world, body);
      tileBodies.set(el, body);

      el.dataset._savedPointer = el.style.pointerEvents || "";
      el.style.pointerEvents = "none";
    });

    // scoring
    Events.on(engine, "collisionStart", (evt) => {
      for (const p of evt.pairs) {
        const a = p.bodyA, b = p.bodyB;

        const targetHit = getTargetHit(a, b);
        if (!targetHit) continue;

        // score + combo
        score += 10 * combo;
        scoreEl.textContent = String(score);

        combo = Math.min(10, combo + 1);
        comboEl.textContent = "x" + combo;

        clearTimeout(comboTimer);
        comboTimer = setTimeout(() => {
          combo = 1;
          comboEl.textContent = "x1";
        }, 1500);

        // juice: pop + particles + sound
        const tBody = targetHit.body;
        const tEl = targetHit.el;
        tEl.style.transform = "scale(1.08)";
        setTimeout(() => tEl.style.transform = "scale(1)", 120);

        particleBurst(tBody.position.x - 4, tBody.position.y - 4, 14);
        popSound();
      }
    });

    requestAnimationFrame(tick);
  }

  function getTargetHit(a, b) {
    // tile hits any target?
    for (let i = 0; i < targetBodies.length; i++) {
      const tb = targetBodies[i];
      const isHit = (a === tb && isTileBody(b)) || (b === tb && isTileBody(a));
      if (isHit) return { body: tb, el: targetEls[i] };
    }
    return null;
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
    targetEls.forEach(t => t.style.display = "none");

    tiles.forEach((el) => {
      el.classList.remove("play-mini");
      el.style.pointerEvents = el.dataset._savedPointer || "";
      delete el.dataset._savedPointer;
      el.style.transform = ""; // remove rotation
    });

    engine = null;
    playerBody = null;
    targetBodies = [];
    tileBodies.clear();
    held = null;
    combo = 1;
    comboEl.textContent = "x1";
  }

  function onGroundNow() {
    if (!playerBody) return false;
    return Math.abs(playerBody.velocity.y) < 1.2;
  }

  function nearestTileToPlayer(maxDist = 150) {
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
    const n = nearestTileToPlayer(170);
    if (!n) return;
    held = n;
    Body.setAngularVelocity(n.body, 0);
    Body.setVelocity(n.body, { x: 0, y: 0 });
  }

  function throwHeldTowardMouse() {
    if (!held || !playerBody) return;

    const b = held.body;
    held = null;

    // direction: player -> mouse (stage coords)
    const dir = { x: aim.x - playerBody.position.x, y: aim.y - playerBody.position.y };
    const len = Math.hypot(dir.x, dir.y) || 1;
    const nx = dir.x / len;
    const ny = dir.y / len;

    // power
    const power = 16;
    Body.setVelocity(b, { x: nx * power, y: ny * power });

    // little spin
    Body.setAngularVelocity(b, nx * 0.25);
  }

  function tick() {
    if (!engine) return;

    Engine.update(engine, 1000 / 60);

    // Movement
    if (playerBody) {
      const speed = 0.9;
      const vx = playerBody.velocity.x;

      if (keys.a) { facing = -1; Body.setVelocity(playerBody, { x: clamp(vx - speed, -8, 8), y: playerBody.velocity.y }); }
      if (keys.d) { facing = 1;  Body.setVelocity(playerBody, { x: clamp(vx + speed, -8, 8), y: playerBody.velocity.y }); }

      if (keys.space && onGroundNow()) {
        Body.setVelocity(playerBody, { x: playerBody.velocity.x, y: -12 });
      }

      playerEl.style.left = (playerBody.position.x - 22) + "px";
      playerEl.style.top = (playerBody.position.y - 28) + "px";
    }

    // Held tile follows player (like carrying)
    if (held && playerBody) {
      const carryX = playerBody.position.x + facing * 54;
      const carryY = playerBody.position.y - 30;
      Body.setPosition(held.body, { x: carryX, y: carryY });
      Body.setVelocity(held.body, { x: 0, y: 0 });
      Body.setAngle(held.body, 0);
    }

    // Sync tiles
    for (const [el, body] of tileBodies.entries()) {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      el.style.left = (body.position.x - w / 2) + "px";
      el.style.top = (body.position.y - h / 2) + "px";
      el.style.transform = `rotate(${body.angle}rad)`;
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
      if (playMode) e.preventDefault(); // stop page scroll / focused-button click
    }

    if (!playMode) return;

    if (e.key === "e" || e.key === "E") grab();
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "a" || e.key === "A") keys.a = false;
    if (e.key === "d" || e.key === "D") keys.d = false;
    if (e.key === "w" || e.key === "W") keys.w = false;
    if (e.key === "s" || e.key === "S") keys.s = false;
    if (e.code === "Space") keys.space = false;
  });

  // Mouse aim + click throw
  window.addEventListener("mousemove", (e) => {
    if (!playMode) return;
    const r = stage.getBoundingClientRect();
    aim.x = e.clientX - r.left;
    aim.y = e.clientY - r.top;
  });

  window.addEventListener("mousedown", (e) => {
    if (!playMode) return;
    // avoid clicking the HUD
    const hudRect = hud.getBoundingClientRect();
    if (e.clientX >= hudRect.left && e.clientX <= hudRect.right && e.clientY >= hudRect.top && e.clientY <= hudRect.bottom) return;

    throwHeldTowardMouse();
  });
})();