(() => {
  "use strict";

  // Only run on the home page (index.html)
  const openBtn = document.getElementById("openGame");
  const overlay = document.getElementById("gameOverlay");
  const closeBtn = document.getElementById("closeGame");
  const startBtn = document.getElementById("startGame");
  const nextBtn = document.getElementById("nextLevel");
  const restartBtn = document.getElementById("restartLevel");
  const statusEl = document.getElementById("gameStatus");
  const canvas = document.getElementById("gameCanvas");

  if (!openBtn || !overlay || !closeBtn || !canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });

  /* =========================================================
     Small platformer engine (no dependencies)
     ========================================================= */

  const W = canvas.width;
  const H = canvas.height;

  const TILE = 64; // all tiles are the same size (requirement)

  const GRAVITY = 1500;
  const MOVE_SPEED = 280;
  const JUMP_VEL = 540;

  const keys = new Set();
  let lastTime = 0;
  let running = false;
  let paused = true;

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function copyRect(r) { return { x: r.x, y: r.y, w: r.w, h: r.h }; }

  function snapToTile(n) { return Math.round(n / TILE) * TILE; }

  /* =========================================================
     Level definitions
     - Each level has the minimum number of movable tiles needed to finish.
     - Difficulty ramps with higher ledges, gaps, and multiple keys.
     ========================================================= */

  const levels = [
    {
      name: "Level 1 — Warm-up",
      hint: "Pick up the tile (E) and use it as a step.",
      player: { x: 2 * TILE, y: 6 * TILE - 48 },
      door: { x: 13 * TILE + 8, y: 6 * TILE - 96, w: 48, h: 96 },
      keys: [{ x: 9 * TILE + 20, y: 4 * TILE + 18 }],
      solids: [
        // ground
        { x: 0, y: 6 * TILE, w: 15 * TILE, h: 3 * TILE },
        // small ledge
        { x: 8 * TILE, y: 5 * TILE, w: 3 * TILE, h: TILE },
        // door platform
        { x: 12 * TILE, y: 6 * TILE - TILE, w: 3 * TILE, h: TILE },
      ],
      movers: [],
      tiles: [
        { x: 6 * TILE, y: 5 * TILE, w: TILE, h: TILE },
      ],
    },
    {
      name: "Level 2 — Gap carry",
      hint: "Carry the tile across the gap, then climb.",
      player: { x: 1 * TILE, y: 6 * TILE - 48 },
      door: { x: 13 * TILE + 8, y: 3 * TILE - 96, w: 48, h: 96 },
      keys: [{ x: 8 * TILE + 18, y: 3 * TILE + 18 }],
      solids: [
        // ground left
        { x: 0, y: 6 * TILE, w: 6 * TILE, h: 3 * TILE },
        // ground right
        { x: 9 * TILE, y: 6 * TILE, w: 6 * TILE, h: 3 * TILE },
        // mid platform for key
        { x: 7 * TILE, y: 4 * TILE, w: 3 * TILE, h: TILE },
        // high platform for door
        { x: 12 * TILE, y: 3 * TILE, w: 3 * TILE, h: TILE },
      ],
      movers: [],
      tiles: [
        { x: 3 * TILE, y: 5 * TILE, w: TILE, h: TILE },
      ],
    },
    {
      name: "Level 3 — Two keys",
      hint: "Use the tile twice. Plan where you drop it.",
      player: { x: 2 * TILE, y: 6 * TILE - 48 },
      door: { x: 13 * TILE + 8, y: 2 * TILE - 96, w: 48, h: 96 },
      keys: [
        { x: 5 * TILE + 18, y: 4 * TILE + 18 },
        { x: 10 * TILE + 18, y: 2 * TILE + 18 },
      ],
      solids: [
        { x: 0, y: 6 * TILE, w: 15 * TILE, h: 3 * TILE },
        // first key platform
        { x: 4 * TILE, y: 5 * TILE, w: 3 * TILE, h: TILE },
        // tall pillar to make a tricky jump
        { x: 8 * TILE, y: 4 * TILE, w: TILE, h: 2 * TILE },
        // second key platform (higher)
        { x: 9 * TILE, y: 3 * TILE, w: 3 * TILE, h: TILE },
        // door platform (highest)
        { x: 12 * TILE, y: 2 * TILE, w: 3 * TILE, h: TILE },
      ],
      movers: [],
      tiles: [
        { x: 2 * TILE, y: 5 * TILE, w: TILE, h: TILE },
      ],
    },
    {
      name: "Level 4 — Moving lift",
      hint: "Time the moving platform. The tile helps you stabilize your route.",
      player: { x: 1 * TILE, y: 6 * TILE - 48 },
      door: { x: 13 * TILE + 8, y: 1 * TILE - 96, w: 48, h: 96 },
      keys: [
        { x: 6 * TILE + 18, y: 2 * TILE + 18 },
        { x: 10 * TILE + 18, y: 1 * TILE + 18 },
      ],
      solids: [
        // ground with a gap
        { x: 0, y: 6 * TILE, w: 5 * TILE, h: 3 * TILE },
        { x: 7 * TILE, y: 6 * TILE, w: 8 * TILE, h: 3 * TILE },
        // small waiting ledge
        { x: 5 * TILE, y: 5 * TILE, w: 2 * TILE, h: TILE },
        // high door platform
        { x: 12 * TILE, y: 1 * TILE, w: 3 * TILE, h: TILE },
        // key 2 platform (tiny)
        { x: 9 * TILE, y: 2 * TILE, w: 2 * TILE, h: TILE },
      ],
      movers: [
        // horizontal moving platform to cross the big gap
        { x: 5 * TILE, y: 4 * TILE, w: 2 * TILE, h: TILE, type: "sineX", amp: 2.0 * TILE, speed: 1.0 },
      ],
      tiles: [
        { x: 2 * TILE, y: 5 * TILE, w: TILE, h: TILE },
      ],
    }
  ];

  const state = {
    levelIndex: 0,
    solids: [],
    movers: [],
    tiles: [],
    keys: [],
    door: null,
    collected: 0,
    totalKeys: 0,
    holding: null,
    t: 0,
    player: {
      x: 0, y: 0,
      w: 40, h: 54,
      vx: 0, vy: 0,
      onGround: false,
      jumpsUsed: 0,
      face: 1,
    }
  };

  function loadLevel(i) {
    state.levelIndex = clamp(i, 0, levels.length - 1);
    const L = levels[state.levelIndex];

    state.solids = L.solids.map(copyRect);
    state.movers = (L.movers || []).map(m => ({...m, baseX: m.x, baseY: m.y }));
    state.tiles = L.tiles.map(r => ({ ...copyRect(r), vx: 0, vy: 0 }));
    state.keys = L.keys.map(k => ({...k, r: 14, got: false }));
    state.door = {...L.door, open: false};
    state.collected = 0;
    state.totalKeys = state.keys.length;
    state.holding = null;
    state.t = 0;

    state.player.x = L.player.x;
    state.player.y = L.player.y;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.onGround = false;
    state.player.jumpsUsed = 0;

    setStatus(`${L.name} — Keys: 0/${state.totalKeys}. ${L.hint}`);
    nextBtn.disabled = true;
  }

  function setStatus(html) {
    if (!statusEl) return;
    statusEl.innerHTML = html;
  }

  /* =========================================================
     Input
     ========================================================= */

  const input = {
    left: false, right: false, up: false, down: false,
    jumpPressed: false,
    interactPressed: false,
    restartPressed: false,
  };

  function onKeyDown(e) {
    if (!running || paused) return;

    const k = e.key.toLowerCase();
    if (k === "a") input.left = true;
    if (k === "d") input.right = true;
    if (k === "w") input.up = true;
    if (k === "s") input.down = true;

    if (e.code === "Space") {
      if (!input.jumpPressed) input.jumpPressed = true; // edge
      e.preventDefault();
    }

    if (k === "e") {
      if (!input.interactPressed) input.interactPressed = true; // edge
      e.preventDefault();
    }

    if (k === "r") {
      if (!input.restartPressed) input.restartPressed = true; // edge
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    const k = e.key.toLowerCase();
    if (k === "a") input.left = false;
    if (k === "d") input.right = false;
    if (k === "w") input.up = false;
    if (k === "s") input.down = false;
    if (e.code === "Space") input.jumpPressed = false;
    if (k === "e") input.interactPressed = false;
    if (k === "r") input.restartPressed = false;
  }

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp, { passive: true });

  /* =========================================================
     Physics helpers
     ========================================================= */

  function getAllSolids() {
    // movers are treated as solids for collision
    return state.solids.concat(state.movers).concat(state.tiles);
  }

  function resolveAxis(entity, others, axis) {
    // entity has x,y,w,h and may be moved; axis is "x" or "y"
    for (const o of others) {
      if (o === entity) continue;
      if (!rectsOverlap(entity, o)) continue;

      if (axis === "x") {
        const leftPen = (entity.x + entity.w) - o.x;
        const rightPen = (o.x + o.w) - entity.x;
        // choose smaller penetration depending on direction
        if (leftPen < rightPen) entity.x -= leftPen;
        else entity.x += rightPen;
      } else {
        const topPen = (entity.y + entity.h) - o.y;
        const bottomPen = (o.y + o.h) - entity.y;
        if (topPen < bottomPen) entity.y -= topPen;
        else entity.y += bottomPen;
      }
    }
  }

  function moveWithCollision(body, dx, dy, colliders, onHit) {
    // Move X
    if (dx !== 0) {
      body.x += dx;
      for (const c of colliders) {
        if (c === body) continue;
        if (!rectsOverlap(body, c)) continue;

        const fromLeft = dx > 0;
        const overlapX = fromLeft
          ? (body.x + body.w) - c.x
          : (c.x + c.w) - body.x;

        if (onHit) onHit("x", c, overlapX, fromLeft);

        body.x += fromLeft ? -overlapX : overlapX;
      }
    }

    // Move Y
    if (dy !== 0) {
      body.y += dy;
      for (const c of colliders) {
        if (c === body) continue;
        if (!rectsOverlap(body, c)) continue;

        const fromTop = dy > 0;
        const overlapY = fromTop
          ? (body.y + body.h) - c.y
          : (c.y + c.h) - body.y;

        if (onHit) onHit("y", c, overlapY, fromTop);

        body.y += fromTop ? -overlapY : overlapY;
      }
    }
  }

  function tryPushTile(tile, dx) {
    if (dx === 0) return false;
    const test = { ...tile, x: tile.x + dx, y: tile.y };
    const solids = state.solids.concat(state.movers).concat(state.tiles.filter(t => t !== tile));
    for (const s of solids) {
      if (rectsOverlap(test, s)) return false;
    }
    tile.x = test.x;
    return true;
  }

  function nearestTileToPlayer(maxDist = TILE * 1.25) {
    const p = state.player;
    const px = p.x + p.w / 2;
    const py = p.y + p.h / 2;

    let best = null;
    let bestD = Infinity;
    for (const t of state.tiles) {
      const tx = t.x + t.w / 2;
      const ty = t.y + t.h / 2;
      const d = Math.hypot(tx - px, ty - py);
      if (d < bestD && d <= maxDist) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  function placeHeldTile(t) {
    // put tile slightly in front of player, snapped to grid for satisfying placement
    const p = state.player;
    const dir = p.face || 1;

    let x = p.x + (dir > 0 ? p.w + 10 : -t.w - 10);
    let y = p.y + p.h - t.h;

    x = snapToTile(x);
    y = snapToTile(y);

    t.x = clamp(x, 0, W - t.w);
    t.y = clamp(y, 0, H - t.h);

    // If intersecting, nudge upward until clear (or give up)
    const solids = state.solids.concat(state.movers).concat(state.tiles.filter(o => o !== t));
    for (let i = 0; i < 8; i++) {
      let ok = true;
      for (const s of solids) {
        if (rectsOverlap(t, s)) { ok = false; break; }
      }
      if (ok) return;
      t.y -= 8;
    }
  }

  /* =========================================================
     Update
     ========================================================= */

  function update(dt) {
    state.t += dt;

    // Move platforms
    for (const m of state.movers) {
      if (m.type === "sineX") {
        const prevX = m.x;
        m.x = m.baseX + Math.sin(state.t * m.speed) * m.amp;
        m.dx = m.x - prevX;
      } else {
        m.dx = 0;
      }
    }

    const p = state.player;

    // Restart
    if (input.restartPressed) {
      input.restartPressed = false;
      loadLevel(state.levelIndex);
      return;
    }

    // Horizontal input (WASD)
    const ax = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    p.vx = ax * MOVE_SPEED;
    if (ax !== 0) p.face = ax;

    // Jump / double jump
    if (input.jumpPressed) {
      input.jumpPressed = false;
      if (p.onGround) {
        p.vy = -JUMP_VEL;
        p.onGround = false;
        p.jumpsUsed = 1;
      } else if (p.jumpsUsed < 2) {
        p.vy = -JUMP_VEL * 0.92;
        p.jumpsUsed += 1;
      }
    }

    // Interact (pick up / drop)
    if (input.interactPressed) {
      input.interactPressed = false;

      if (state.holding) {
        // drop
        state.holding.vx = 0;
        state.holding.vy = 0;
        placeHeldTile(state.holding);
        state.holding = null;
      } else {
        const t = nearestTileToPlayer();
        if (t) {
          state.holding = t;
        }
      }
    }

    // Gravity
    p.vy += GRAVITY * dt;

    // If holding, keep tile with player (no collision while held)
    if (state.holding) {
      const t = state.holding;
      const dir = p.face || 1;

      // Hover slightly above ground-line for readability
      let x = p.x + (dir > 0 ? p.w + 14 : -t.w - 14);
      let y = p.y + 6;

      t.x = clamp(x, 0, W - t.w);
      t.y = clamp(y, 0, H - t.h);
      t.vx = 0;
      t.vy = 0;
    } else {
      // Update tiles physics (they can fall + settle)
      const tileColliders = state.solids.concat(state.movers).concat(state.tiles);
      for (const t of state.tiles) {
        t.vy = (t.vy || 0) + GRAVITY * dt;
        const dx = (t.vx || 0) * dt;
        const dy = t.vy * dt;

        moveWithCollision(t, dx, dy, tileColliders, (axis, c, overlap, fromTop) => {
          if (axis === "y") {
            if (fromTop) t.vy = 0;
          }
          if (axis === "x") {
            t.vx = 0;
          }
        });

        // If a platform moved into the tile, carry it (simple)
        for (const m of state.movers) {
          if (m.dx && rectsOverlap({x: t.x, y: t.y + 1, w: t.w, h: t.h}, m)) {
            // tile is touching mover; attempt carry
            const can = tryPushTile(t, m.dx);
            if (!can) {
              // if can't carry, just ignore
            }
          }
        }

        // Keep tiles inside world
        if (t.y > H + TILE) {
          // fell out -> respawn to a safe spot
          t.x = 2 * TILE;
          t.y = 2 * TILE;
          t.vx = 0; t.vy = 0;
        }
      }
    }

    // Player collision: include tiles only if not held
    const colliders = state.holding
      ? state.solids.concat(state.movers)
      : state.solids.concat(state.movers).concat(state.tiles);

    // Horizontal move + push tiles
    const dx = p.vx * dt;
    let pushedTile = null;
    moveWithCollision(p, dx, 0, colliders, (axis, c, overlap, fromLeft) => {
      if (axis !== "x") return;
      // If we hit a tile, try to push it
      if (!state.holding && state.tiles.includes(c)) {
        const push = fromLeft ? overlap : -overlap;
        const ok = tryPushTile(c, push);
        if (ok) pushedTile = c;
      }
    });

    // Vertical move
    p.onGround = false;
    moveWithCollision(p, 0, p.vy * dt, colliders, (axis, c, overlap, fromTop) => {
      if (axis !== "y") return;
      if (fromTop) {
        // landed
        p.onGround = true;
        p.jumpsUsed = 0;
        p.vy = 0;

        // carry player with moving platforms
        if (state.movers.includes(c) && c.dx) {
          p.x = clamp(p.x + c.dx, 0, W - p.w);
          if (!state.holding) {
            // also gently carry adjacent tiles sitting on the mover
            for (const t of state.tiles) {
              if (rectsOverlap({x: t.x, y: t.y + 2, w: t.w, h: t.h}, c)) {
                tryPushTile(t, c.dx);
              }
            }
          }
        }
      } else {
        // hit head
        p.vy = 0;
      }
    });

    // Fall reset
    if (p.y > H + 120) {
      loadLevel(state.levelIndex);
      return;
    }

    // Collect keys
    for (const k of state.keys) {
      if (k.got) continue;
      const kr = { x: k.x - k.r, y: k.y - k.r, w: k.r * 2, h: k.r * 2 };
      if (rectsOverlap(p, kr)) {
        k.got = true;
        state.collected += 1;
      }
    }

    // Door open + win
    state.door.open = state.collected >= state.totalKeys;
    if (state.door.open && rectsOverlap(p, state.door)) {
      // Completed
      const done = state.levelIndex === levels.length - 1;
      if (done) {
        setStatus(`✨ Completed all levels! Press <strong>R</strong> to replay or <strong>Next level</strong> to loop.`);
        nextBtn.disabled = false;
      } else {
        setStatus(`✅ ${levels[state.levelIndex].name} complete! Press <strong>Next level</strong>.`);
        nextBtn.disabled = false;
      }
    } else {
      // live status line
      const L = levels[state.levelIndex];
      const tileHint = state.holding ? "Holding tile (E to drop)." : "E pick up tile.";
      const doorHint = state.door.open ? "Door is OPEN." : "Find all keys to open the door.";
      setStatus(`${L.name} — Keys: ${state.collected}/${state.totalKeys}. ${doorHint} ${tileHint}`);
    }
  }

  /* =========================================================
     Render
     ========================================================= */

  function drawGrid() {
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#ffffff";
    for (let x = 0; x < W; x += TILE) ctx.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += TILE) ctx.fillRect(0, y, W, 1);
    ctx.globalAlpha = 1;
  }

  function draw() {
    // background
    ctx.fillStyle = "#111315";
    ctx.fillRect(0, 0, W, H);

    drawGrid();

    // solids
    ctx.fillStyle = "#3a3f46";
    for (const s of state.solids) ctx.fillRect(s.x, s.y, s.w, s.h);

    // movers
    ctx.fillStyle = "#54606d";
    for (const m of state.movers) ctx.fillRect(m.x, m.y, m.w, m.h);

    // tiles (movable)
    ctx.fillStyle = "#f5cd6a";
    for (const t of state.tiles) {
      ctx.fillRect(t.x, t.y, t.w, t.h);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "#000000";
      ctx.fillRect(t.x + 6, t.y + 6, t.w - 12, t.h - 12);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#f5cd6a";
    }

    // keys
    for (const k of state.keys) {
      if (k.got) continue;
      ctx.fillStyle = "#7ec1ff";
      ctx.beginPath();
      ctx.arc(k.x, k.y, k.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(k.x + k.r - 2, k.y - 3, 10, 6);
      ctx.fillRect(k.x + k.r + 6, k.y - 2, 4, 4);
    }

    // door
    ctx.fillStyle = state.door.open ? "#a7bd53" : "#f48fc2";
    ctx.fillRect(state.door.x, state.door.y, state.door.w, state.door.h);
    ctx.fillStyle = "#111315";
    ctx.fillRect(state.door.x + 10, state.door.y + 10, state.door.w - 20, state.door.h - 20);

    // player
    const p = state.player;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    // face dot
    ctx.fillStyle = "#111315";
    ctx.fillRect(p.face > 0 ? p.x + p.w - 12 : p.x + 8, p.y + 16, 6, 6);

    // caption
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Level ${state.levelIndex + 1}/${levels.length} — ${levels[state.levelIndex].name}`, 14, 22);
  }

  /* =========================================================
     Main loop
     ========================================================= */

  function frame(tMs) {
    if (!running) return;

    const t = tMs / 1000;
    const dt = clamp(t - lastTime, 0, 1 / 30);
    lastTime = t;

    if (!paused) {
      update(dt);
      draw();
    }

    requestAnimationFrame(frame);
  }

  function start() {
    running = true;
    paused = false;
    lastTime = 0;
    loadLevel(state.levelIndex);
    requestAnimationFrame(frame);
  }

  function openOverlay() {
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    paused = true;
    // prevent page scrolling behind
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function closeOverlay() {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    paused = true;
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  /* =========================================================
     UI bindings
     ========================================================= */

  openBtn.addEventListener("click", () => {
    openOverlay();
    if (!running) {
      setStatus("Press <strong>Start</strong> to begin Level 1.");
    } else {
      paused = false;
    }
  });

  closeBtn.addEventListener("click", closeOverlay);

  overlay.addEventListener("click", (e) => {
    // Click outside the card closes
    if (e.target === overlay) closeOverlay();
  });

  startBtn?.addEventListener("click", () => {
    if (!running) {
      state.levelIndex = 0;
      start();
    }
    paused = false;
  });

  restartBtn?.addEventListener("click", () => {
    if (!running) return;
    loadLevel(state.levelIndex);
    paused = false;
  });

  nextBtn?.addEventListener("click", () => {
    if (!running) return;
    const next = (state.levelIndex + 1) % levels.length;
    loadLevel(next);
    paused = false;
  });

  // ESC closes overlay
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) {
      closeOverlay();
    }
  });

  // Pause/resume when overlay opens/closes (safety)
  const obs = new MutationObserver(() => {
    paused = !overlay.classList.contains("is-open");
  });
  obs.observe(overlay, { attributes: true, attributeFilter: ["class"] });

  // Preload initial frame
  loadLevel(0);
  draw();
})();