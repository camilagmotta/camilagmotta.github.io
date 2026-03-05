
(() => {
  const playBtn = document.getElementById("playGameBtn");
  const exitBtn = document.getElementById("exitGameBtn");
  const homeTiles = document.getElementById("homeTiles");
  const gameStage = document.getElementById("gameStage");
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const hudLevelTitle = document.getElementById("hudLevelTitle");
  const hudKeys = document.getElementById("hudKeys");

  if (!playBtn || !exitBtn || !homeTiles || !gameStage || !canvas || !ctx) return;

  // --- Canvas sizing (fit the board container) ---
  function resizeCanvasToDisplaySize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(240, Math.floor(rect.height));
    const need = (canvas.width !== Math.floor(w * dpr)) || (canvas.height !== Math.floor(h * dpr));
    if (need) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { w, h, dpr };
  }

  // --- World constants ---
  const TILE = 64;
  const GRAVITY = 2400;
  const MOVE_ACCEL = 5200;
  const MAX_SPEED = 520;
  const JUMP_V = 860;
  const FRICTION = 0.80;

  // Hand-drawn-ish palette (uses your site ink variable if present)
  function getCSSVar(name, fallback){
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function getInk() {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
    return v || "#23102d";
  }

  // --- Input ---
  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    // prevent scroll on space when game active
    if (!isRunning) return;
    if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.code === "Escape") stopGame();
  }, { passive: false });

  window.addEventListener("keyup", (e) => keys.delete(e.code));

  // --- Helpers ---
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rectsOverlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // Swept AABB-ish resolution (axis-separated)
  function moveAndCollide(body, solids, dt) {
    // X
    body.x += body.vx * dt;
    for (const s of solids) {
      if (!rectsOverlap(body, s)) continue;
      if (body.vx > 0) body.x = s.x - body.w;
      else if (body.vx < 0) body.x = s.x + s.w;
      body.vx = 0;
    }
    // Y
    body.y += body.vy * dt;
    body.onGround = false;
    for (const s of solids) {
      if (!rectsOverlap(body, s)) continue;
      if (body.vy > 0) {
        body.y = s.y - body.h;
        body.vy = 0;
        body.onGround = true;
      } else if (body.vy < 0) {
        body.y = s.y + s.h;
        body.vy = 0;
      }
    }
  }

  function snapToGrid(v) {
    return Math.round(v / TILE) * TILE;
  }

  // --- Level format ---
  // World units: origin (0,0) top-left of board.
  // We keep a roomy world and render with a camera that fits.
  const levels = [
    {
      name: "Level 01",
      w: 15 * TILE,
      h: 8 * TILE,
      spawn: { x: 1 * TILE, y: 6 * TILE - 48 },
      door:  { x: 13 * TILE, y: 6 * TILE - 96, w: 64, h: 96 },
      keys:  [
        { x: 6 * TILE + 10, y: 4 * TILE - 10, r: 16 },
        { x: 9 * TILE + 14, y: 3 * TILE - 10, r: 16 },
        { x: 12 * TILE + 10, y: 5 * TILE - 10, r: 16 },
      ],
      fixed: [
        // floor
        ...Array.from({ length: 15 }, (_, i) => ({ x: i*TILE, y: 7*TILE, w: TILE, h: TILE })),
        // small ledge to teach jumping
        { x: 4*TILE, y: 6*TILE, w: 2*TILE, h: TILE },
      ],
      tiles: [
        // minimum: 1 movable tile to reach higher key route comfortably
        { x: 8*TILE, y: 6*TILE, w: TILE, h: TILE },
      ]
    },
    {
      name: "Level 02",
      w: 16 * TILE,
      h: 9 * TILE,
      spawn: { x: 1 * TILE, y: 7 * TILE - 48 },
      door:  { x: 14 * TILE, y: 7 * TILE - 96, w: 64, h: 96 },
      keys:  [
        { x: 7 * TILE + 10, y: 5 * TILE - 10, r: 16 },
        { x: 10 * TILE + 10, y: 3 * TILE - 10, r: 16 },
      ],
      fixed: [
        ...Array.from({ length: 16 }, (_, i) => ({ x: i*TILE, y: 8*TILE, w: TILE, h: TILE })),
        // gap you must solve with tile placement
        { x: 5*TILE, y: 8*TILE, w: 1*TILE, h: TILE, hole: true }, // marker, removed below
        { x: 6*TILE, y: 8*TILE, w: 1*TILE, h: TILE, hole: true },
        // platforms
        { x: 3*TILE, y: 6*TILE, w: 2*TILE, h: TILE },
        { x: 9*TILE, y: 6*TILE, w: 2*TILE, h: TILE },
        { x: 12*TILE, y: 5*TILE, w: 2*TILE, h: TILE },
      ],
      tiles: [
        { x: 4*TILE, y: 7*TILE, w: TILE, h: TILE },
      ]
    },
    {
      name: "Level 03",
      w: 17 * TILE,
      h: 9 * TILE,
      spawn: { x: 1 * TILE, y: 7 * TILE - 48 },
      door:  { x: 15 * TILE, y: 7 * TILE - 96, w: 64, h: 96 },
      keys:  [
        { x: 6 * TILE + 10, y: 6 * TILE - 10, r: 16 },
        { x: 9 * TILE + 10, y: 4 * TILE - 10, r: 16 },
        { x: 12 * TILE + 10, y: 2 * TILE - 10, r: 16 },
      ],
      fixed: [
        ...Array.from({ length: 17 }, (_, i) => ({ x: i*TILE, y: 8*TILE, w: TILE, h: TILE })),
        // taller climb
        { x: 4*TILE, y: 6*TILE, w: 2*TILE, h: TILE },
        { x: 7*TILE, y: 5*TILE, w: 2*TILE, h: TILE },
        { x: 10*TILE, y: 4*TILE, w: 2*TILE, h: TILE },
        { x: 13*TILE, y: 3*TILE, w: 2*TILE, h: TILE },
      ],
      tiles: [
        { x: 5*TILE, y: 7*TILE, w: TILE, h: TILE },
      ]
    },
    {
      name: "Level 04",
      w: 18 * TILE,
      h: 9 * TILE,
      spawn: { x: 1 * TILE, y: 7 * TILE - 48 },
      door:  { x: 16 * TILE, y: 7 * TILE - 96, w: 64, h: 96 },
      keys:  [
        { x: 6 * TILE + 10, y: 4 * TILE - 10, r: 16 },
        { x: 11 * TILE + 10, y: 3 * TILE - 10, r: 16 },
        { x: 14 * TILE + 10, y: 5 * TILE - 10, r: 16 },
      ],
      fixed: [
        ...Array.from({ length: 18 }, (_, i) => ({ x: i*TILE, y: 8*TILE, w: TILE, h: TILE })),
        // ledges + a moving platform
        { x: 3*TILE, y: 6*TILE, w: 2*TILE, h: TILE },
        { x: 8*TILE, y: 6*TILE, w: 2*TILE, h: TILE },
        { x: 13*TILE, y: 6*TILE, w: 2*TILE, h: TILE },
      ],
      moving: [
        { x: 6*TILE, y: 5*TILE, w: 2*TILE, h: TILE, t: 0, range: 4*TILE, speed: 1.0 }
      ],
      tiles: [
        { x: 9*TILE, y: 7*TILE, w: TILE, h: TILE },
      ]
    }
  ];

  // remove "holes" from level 2 floor
  levels[1].fixed = levels[1].fixed.filter(r => !r.hole);

  // --- Game state ---
  let isRunning = false;
  let rafId = 0;

  let levelIndex = 0;
  let player, fixed, movable, moving, door, keysLeft;

  // Mouse dragging (for movable tiles)
  let mouse = { x: 0, y: 0, down: false };
  let dragging = null; // {tile, offX, offY, startX, startY}

  function resetLevel(i) {
    levelIndex = clamp(i, 0, levels.length - 1);
    const L = levels[levelIndex];

    player = {
      x: L.spawn.x, y: L.spawn.y,
      w: 34, h: 48,
      vx: 0, vy: 0,
      onGround: false,
      jumps: 2,
    };

    fixed = L.fixed.map(r => ({ ...r }));
    movable = (L.tiles || []).map((t, idx) => ({ ...t, id: idx }));
    moving = (L.moving || []).map(m => ({ ...m }));
    door = { ...L.door };

    keysLeft = L.keys.map((k, idx) => ({ ...k, id: idx, taken: false }));

    hudLevelTitle.textContent = L.name;
    hudKeys.textContent = `Keys: 0/${keysLeft.length}`;
  }

  function allSolids() {
    // moving platforms treated as solids
    return [...fixed, ...movable, ...moving.map(m => ({ x: m.x, y: m.y, w: m.w, h: m.h }))];
  }

  function keysCollectedCount() {
    return keysLeft.filter(k => k.taken).length;
  }

  function mousePosInWorld() {
    // Convert from canvas CSS pixels -> world via current camera
    const rect = canvas.getBoundingClientRect();
    const cx = mouse.x - rect.left;
    const cy = mouse.y - rect.top;
    // current camera mapping is stored each frame
    return screenToWorld(cx, cy);
  }

  let cam = { scale: 1, ox: 0, oy: 0, vw: 0, vh: 0, ww: 0, wh: 0 };
  function computeCamera(viewW, viewH, worldW, worldH) {
    const pad = 20;
    const s = Math.min((viewW - pad*2) / worldW, (viewH - pad*2) / worldH);
    const scale = clamp(s, 0.25, 1.0);
    const ox = (viewW - worldW * scale) / 2;
    const oy = (viewH - worldH * scale) / 2;
    cam = { scale, ox, oy, vw: viewW, vh: viewH, ww: worldW, wh: worldH };
  }
  function worldToScreen(x, y) {
    return { x: cam.ox + x * cam.scale, y: cam.oy + y * cam.scale };
  }
  function screenToWorld(x, y) {
    return { x: (x - cam.ox) / cam.scale, y: (y - cam.oy) / cam.scale };
  }

  // --- Mouse handlers for dragging tiles ---
  function pickTileAt(worldX, worldY) {
    for (let i = movable.length - 1; i >= 0; i--) {
      const t = movable[i];
      if (worldX >= t.x && worldX <= t.x + t.w && worldY >= t.y && worldY <= t.y + t.h) return t;
    }
    return null;
  }

  function isValidTilePlacement(tile, proposed) {
    // stay in bounds
    if (proposed.x < 0 || proposed.y < 0 || proposed.x + tile.w > levels[levelIndex].w || proposed.y + tile.h > levels[levelIndex].h) return false;

    // don't overlap fixed or moving or other movable
    const test = { x: proposed.x, y: proposed.y, w: tile.w, h: tile.h };

    for (const s of fixed) if (rectsOverlap(test, s)) return false;
    for (const m of moving) if (rectsOverlap(test, m)) return false;
    for (const t of movable) {
      if (t === tile) continue;
      if (rectsOverlap(test, t)) return false;
    }
    // avoid covering the door area
    if (rectsOverlap(test, door)) return false;

    return true;
  }

  canvas.addEventListener("mousedown", (e) => {
    if (!isRunning) return;
    mouse.down = true;
    mouse.x = e.clientX;
    mouse.y = e.clientY;

    const p = mousePosInWorld();
    const t = pickTileAt(p.x, p.y);
    if (t) {
      dragging = {
        tile: t,
        offX: p.x - t.x,
        offY: p.y - t.y,
        startX: t.x,
        startY: t.y
      };
    }
  });

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (!isRunning || !dragging) return;

    const p = mousePosInWorld();
    const proposed = { x: p.x - dragging.offX, y: p.y - dragging.offY };
    // keep smooth while dragging, but clamp
    proposed.x = clamp(proposed.x, 0, levels[levelIndex].w - dragging.tile.w);
    proposed.y = clamp(proposed.y, 0, levels[levelIndex].h - dragging.tile.h);

    // allow overlap while dragging for feel, but don't allow going through fixed too much:
    // We'll accept temporarily and validate on drop.
    dragging.tile.x = proposed.x;
    dragging.tile.y = proposed.y;
  });

  window.addEventListener("mouseup", () => {
    if (!isRunning) return;
    mouse.down = false;
    if (!dragging) return;

    const t = dragging.tile;
    // snap + validate, otherwise revert
    const snapped = { x: snapToGrid(t.x), y: snapToGrid(t.y) };
    if (isValidTilePlacement(t, snapped)) {
      t.x = snapped.x;
      t.y = snapped.y;
    } else {
      t.x = dragging.startX;
      t.y = dragging.startY;
    }
    dragging = null;
  });

  // --- Main loop ---
  let last = 0;

  function step(ts) {
    if (!isRunning) return;
    rafId = requestAnimationFrame(step);

    const { w: viewW, h: viewH } = resizeCanvasToDisplaySize();
    const L = levels[levelIndex];
    computeCamera(viewW, viewH, L.w, L.h);

    const dt = clamp((ts - last) / 1000, 0, 1/30);
    last = ts;

    update(dt);
    render(viewW, viewH);
  }

  function update(dt) {
    const L = levels[levelIndex];

    // moving platforms
    for (const m of moving) {
      m.t += dt * m.speed;
      m.x = (6*TILE) + Math.sin(m.t) * (m.range/2); // centered-ish
    }

    // Input -> acceleration
    const left = keys.has("KeyA");
    const right = keys.has("KeyD");
    const up = keys.has("KeyW"); // optional for climb vibe
    const wantJump = keys.has("Space");

    let ax = 0;
    if (left) ax -= MOVE_ACCEL;
    if (right) ax += MOVE_ACCEL;

    player.vx += ax * dt;
    player.vx = clamp(player.vx, -MAX_SPEED, MAX_SPEED);

    // friction if no input
    if (!left && !right) player.vx *= Math.pow(FRICTION, dt * 60);

    // Gravity
    player.vy += GRAVITY * dt;
    player.vy = clamp(player.vy, -2000, 2000);

    // Jump (edge-trigger)
    if (wantJump && !player._jumpHeld) {
      if (player.jumps > 0) {
        player.vy = -JUMP_V;
        player.jumps -= 1;
      }
    }
    player._jumpHeld = wantJump;

    // If dragging a tile, we still simulate player normally.

    const solids = allSolids();

    // Move + collide player
    const beforeY = player.y;
    moveAndCollide(player, solids, dt);

    if (player.onGround) player.jumps = 2;

    // Pushing tiles by walking into them (simple)
    for (const t of movable) {
      if (!rectsOverlap(player, t)) continue;
      // if player is horizontally intersecting, push tile sideways slightly
      if (player.vx > 0) {
        const proposed = { x: t.x + 240*dt, y: t.y };
        if (!dragging && isValidTilePlacement(t, proposed)) t.x = proposed.x;
      } else if (player.vx < 0) {
        const proposed = { x: t.x - 240*dt, y: t.y };
        if (!dragging && isValidTilePlacement(t, proposed)) t.x = proposed.x;
      }
    }

    // Collect keys
    for (const k of keysLeft) {
      if (k.taken) continue;
      const kr = { x: k.x - k.r, y: k.y - k.r, w: k.r*2, h: k.r*2 };
      if (rectsOverlap(player, kr)) {
        k.taken = true;
        hudKeys.textContent = `Keys: ${keysCollectedCount()}/${keysLeft.length}`;
      }
    }

    // Door check
    const haveAll = keysCollectedCount() === keysLeft.length;
    if (haveAll && rectsOverlap(player, door)) {
      if (levelIndex < levels.length - 1) {
        resetLevel(levelIndex + 1);
      } else {
        // loop back to level 1 for now
        resetLevel(0);
      }
    }

    // Prevent falling out
    player.x = clamp(player.x, 0, L.w - player.w);
    if (player.y > L.h + 200) resetLevel(levelIndex); // respawn if fell far
  }

  function render(viewW, viewH) {
    const ink = getInk();
    ctx.clearRect(0, 0, viewW, viewH);

    // Background
    ctx.fillStyle = getCSSVar("--bg", "#C7E0C3");
    ctx.fillRect(0, 0, viewW, viewH);

    // World border
    const topLeft = worldToScreen(0, 0);
    ctx.lineWidth = 5;
    ctx.strokeStyle = ink;
    ctx.strokeRect(topLeft.x, topLeft.y, cam.ww * cam.scale, cam.wh * cam.scale);

    // Draw fixed blocks
    for (const r of fixed) drawBlock(r, ink, false);
    for (const m of moving) drawBlock(m, ink, true);
    for (const t of movable) drawBlock(t, ink, false, true);

    // Keys
    for (const k of keysLeft) {
      if (k.taken) continue;
      const p = worldToScreen(k.x, k.y);
      const rr = k.r * cam.scale;
      ctx.lineWidth = 4;
      ctx.strokeStyle = ink;
      // simple "key" doodle: circle + stem
      ctx.beginPath();
      ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x + rr, p.y);
      ctx.lineTo(p.x + rr + rr*1.2, p.y);
      ctx.lineTo(p.x + rr + rr*1.2, p.y + rr*0.6);
      ctx.stroke();
    }

    // Door
    const haveAll = keysCollectedCount() === keysLeft.length;
    const d = worldToScreen(door.x, door.y);
    ctx.lineWidth = 5;
    ctx.strokeStyle = ink;
    ctx.fillStyle = haveAll ? "rgba(90,139,83,0.45)" : "rgba(224,195,215,0.45)";
    ctx.fillRect(d.x, d.y, door.w * cam.scale, door.h * cam.scale);
    ctx.strokeRect(d.x, d.y, door.w * cam.scale, door.h * cam.scale);
    // knob
    ctx.beginPath();
    ctx.arc(d.x + door.w*cam.scale*0.78, d.y + door.h*cam.scale*0.55, 6, 0, Math.PI*2);
    ctx.stroke();

    // Player (stick-ish)
    drawPlayer(player, ink);
  }

  function drawBlock(r, ink, isMoving=false, isMovable=false) {
    const p = worldToScreen(r.x, r.y);
    const w = r.w * cam.scale;
    const h = r.h * cam.scale;

    ctx.lineWidth = 5;
    ctx.strokeStyle = ink;

    if (isMovable) ctx.fillStyle = "rgba(224,195,215,0.65)";
    else if (isMoving) ctx.fillStyle = "rgba(161,109,144,0.55)";
    else ctx.fillStyle = "rgba(199,224,195,0.35)";

    ctx.fillRect(p.x, p.y, w, h);
    ctx.strokeRect(p.x, p.y, w, h);
  }

  function drawPlayer(pl, ink) {
    const p = worldToScreen(pl.x, pl.y);
    const s = cam.scale;

    // body rect for clarity
    ctx.lineWidth = 4;
    ctx.strokeStyle = ink;
    ctx.fillStyle = "rgba(255,255,255,0.0)";
    ctx.strokeRect(p.x, p.y, pl.w*s, pl.h*s);

    // stick figure inside the rect
    const cx = p.x + (pl.w*s)/2;
    const headY = p.y + 12*s;
    const headR = 10*s;

    ctx.beginPath();
    ctx.arc(cx, headY, headR, 0, Math.PI*2);
    ctx.stroke();

    // torso
    ctx.beginPath();
    ctx.moveTo(cx, headY + headR);
    ctx.lineTo(cx, p.y + 32*s);
    ctx.stroke();

    // legs
    ctx.beginPath();
    ctx.moveTo(cx, p.y + 32*s);
    ctx.lineTo(cx - 10*s, p.y + 44*s);
    ctx.moveTo(cx, p.y + 32*s);
    ctx.lineTo(cx + 10*s, p.y + 44*s);
    ctx.stroke();

    // arms
    ctx.beginPath();
    ctx.moveTo(cx, p.y + 24*s);
    ctx.lineTo(cx - 12*s, p.y + 30*s);
    ctx.moveTo(cx, p.y + 24*s);
    ctx.lineTo(cx + 12*s, p.y + 30*s);
    ctx.stroke();
  }

  // --- Start/Stop ---
  function startGame() {
    homeTiles.classList.add("is-hidden");
    gameStage.classList.remove("is-hidden");
    gameStage.setAttribute("aria-hidden", "false");

    resetLevel(0);
    isRunning = true;
    last = performance.now();
    resizeCanvasToDisplaySize();
    rafId = requestAnimationFrame(step);
  }

  function stopGame() {
    isRunning = false;
    cancelAnimationFrame(rafId);
    homeTiles.classList.remove("is-hidden");
    gameStage.classList.add("is-hidden");
    gameStage.setAttribute("aria-hidden", "true");
    keys.clear();
    dragging = null;
  }

  playBtn.addEventListener("click", () => {
    if (isRunning) return;
    startGame();
  });

  exitBtn.addEventListener("click", () => stopGame());

  window.addEventListener("resize", () => {
    if (!isRunning) return;
    resizeCanvasToDisplaySize();
  });
})();
