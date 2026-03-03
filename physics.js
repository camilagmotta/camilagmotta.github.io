(() => {
  // ======================
  // SETTINGS (tuned for "satisfying drag & drop")
  // ======================
  const ENABLE_ON_MOBILE = true;

  const COLOR_CLASSES = ["c-pink", "c-green", "c-yellow", "c-blue", "c-white", "c-black"];

  // "Settle" behavior (small gravity for a moment after drop)
  const SETTLE_GRAVITY = 0.35;
  const SETTLE_MS = 700;

  // Physics feel
  const BOUNCE = 0.04;       // low bounce = less chaos
  const FRICTION = 0.85;     // high friction = stable piles
  const AIR_FRICTION = 0.12; // strong damping = stops quickly

  // Spawn
  const SPAWN_PADDING = 18;
  const MAX_SPAWN_TRIES = 80;

  const STAGE_SELECTOR = ".tile-stage";
  const TILE_SELECTOR = ".tile-stage .tile";

  // ======================
  // GUARDS
  // ======================
  const stage = document.querySelector(STAGE_SELECTOR);
  if (!stage) return;

  const isNarrow = window.matchMedia("(max-width: 860px)").matches;
  if (isNarrow && !ENABLE_ON_MOBILE) return;

  const tiles = Array.from(document.querySelectorAll(TILE_SELECTOR));
  if (!tiles.length) return;

  stage.style.position = "relative";
  stage.style.overflow = "hidden";
  stage.style.minHeight = stage.style.minHeight || "70vh";

  // ======================
  // Randomize colors each reload (using existing CSS classes)
  // ======================
  function randomColor() {
    return COLOR_CLASSES[Math.floor(Math.random() * COLOR_CLASSES.length)];
  }
  tiles.forEach((tile) => {
    COLOR_CLASSES.forEach((c) => tile.classList.remove(c));
    tile.classList.add(randomColor());
  });

  // ======================
  // MATTER (HEADLESS — NO RENDER CANVAS)
  // ======================
  const { Engine, Runner, Bodies, Body, Composite, Mouse, MouseConstraint, Events } = Matter;

  const engine = Engine.create();
  engine.world.gravity.y = 0;      // no gravity by default
  engine.enableSleeping = true;    // helps tiles settle and stop jittering

  const runner = Runner.create();
  Runner.run(runner, engine);

  // ======================
  // DOM prep + disable native link navigation (we handle click manually)
  // ======================
  tiles.forEach((el) => {
    el.style.position = "absolute";
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.willChange = "transform";
    el.style.touchAction = "none";
    el.style.userSelect = "none";
    el.style.cursor = "grab";

    if (el.tagName.toLowerCase() === "a") {
      if (!el.dataset.href) el.dataset.href = el.getAttribute("href") || "";
      el.removeAttribute("href");
      el.setAttribute("role", "link");
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    }
  });

  // ======================
  // Spawn positions (random, with simple overlap avoidance)
  // ======================
  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function rectsOverlap(a, b) {
    return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
  }

  const placed = [];

  function pickSpawn(w, h) {
    const maxX = Math.max(SPAWN_PADDING, stage.clientWidth - w - SPAWN_PADDING);
    const maxY = Math.max(SPAWN_PADDING, stage.clientHeight - h - SPAWN_PADDING);

    for (let i = 0; i < MAX_SPAWN_TRIES; i++) {
      const x = rand(SPAWN_PADDING, maxX);
      const y = rand(SPAWN_PADDING, maxY);

      const r = { x, y, w, h };
      const collides = placed.some(p => rectsOverlap(p, r));
      if (!collides) {
        placed.push(r);
        return { x, y };
      }
    }

    // fallback: allow overlap if too crowded
    const x = rand(SPAWN_PADDING, maxX);
    const y = rand(SPAWN_PADDING, maxY);
    return { x, y };
  }

  // ======================
  // Create bodies (start STATIC / frozen)
  // ======================
  const bodies = new Map();

  tiles.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const w = r.width;
    const h = r.height;

    const { x, y } = pickSpawn(w, h);

    const body = Bodies.rectangle(x + w / 2, y + h / 2, w, h, {
      restitution: BOUNCE,
      friction: FRICTION,
      frictionAir: AIR_FRICTION,
      isStatic: true,     // frozen at start
      sleepThreshold: 60,
      slop: 0.02
    });

    body.plugin = { el };
    body._tileIndex = i;

    Composite.add(engine.world, body);
    bodies.set(el, body);
  });

  // ======================
  // Walls (keep tiles inside stage)
  // ======================
  // Instead of thick bodies, use thin walls just outside the stage.
  function addBounds() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const t = 50;

    Composite.add(engine.world, [
      Bodies.rectangle(w / 2, h + t / 2, w + t * 2, t, { isStatic: true }),
      Bodies.rectangle(w / 2, -t / 2, w + t * 2, t, { isStatic: true }),
      Bodies.rectangle(-t / 2, h / 2, t, h + t * 2, { isStatic: true }),
      Bodies.rectangle(w + t / 2, h / 2, t, h + t * 2, { isStatic: true })
    ]);
  }
  addBounds();

  // ======================
  // Mouse/touch grabbing
  // ======================
  const mouse = Mouse.create(stage);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: {
      stiffness: 0.22,
      damping: 0.20,
      render: { visible: false }
    }
  });
  Composite.add(engine.world, mouseConstraint);

  // Prevent scrolling while actively grabbing
  stage.addEventListener("touchmove", (e) => {
    if (mouseConstraint.body) e.preventDefault();
  }, { passive: false });

  // ======================
  // Interaction logic:
  // - Physics OFF (static)
  // - On grab -> physics ON (dynamic, gravity 0)
  // - On release -> tiny settle gravity briefly -> freeze again
  // ======================
  let physicsActive = false;
  let settleTimer = null;
  let draggedRecentlyUntil = 0;

  function setAllStatic(isStatic) {
    bodies.forEach((b) => {
      Body.setStatic(b, isStatic);
      if (isStatic) {
        Body.setVelocity(b, { x: 0, y: 0 });
        Body.setAngularVelocity(b, 0);
      }
    });
  }

  function activatePhysics() {
    if (settleTimer) clearTimeout(settleTimer);
    engine.world.gravity.y = 0;
    setAllStatic(false);
    physicsActive = true;
  }

  function settleAndFreeze() {
    if (!physicsActive) return;

    // Gentle settle
    engine.world.gravity.y = SETTLE_GRAVITY;

    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      engine.world.gravity.y = 0;
      setAllStatic(true);      // freeze pile
      physicsActive = false;
    }, SETTLE_MS);
  }

  Events.on(mouseConstraint, "startdrag", () => {
    activatePhysics();
    draggedRecentlyUntil = Date.now() + 550;
  });

  Events.on(mouseConstraint, "enddrag", () => {
    // Only settle when user releases
    settleAndFreeze();
  });

  // ======================
  // Click to open (only if not just dragged)
  // ======================
  stage.addEventListener("click", (e) => {
    if (Date.now() < draggedRecentlyUntil) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const tile = e.target.closest(".tile");
    if (!tile) return;
    const href = tile.dataset.href;
    if (href) window.location.href = href;
  });

  stage.addEventListener("keydown", (e) => {
    const tile = e.target.closest(".tile");
    if (!tile) return;
    if (e.key === "Enter" || e.key === " ") {
      const href = tile.dataset.href;
      if (href) {
        e.preventDefault();
        window.location.href = href;
      }
    }
  });

  // ======================
  // Sync physics -> DOM
  // ======================
  Events.on(engine, "afterUpdate", () => {
    bodies.forEach((body, el) => {
      // Use the original size from body bounds (stable), not getBoundingClientRect() (changes when rotating)
      const w = body.bounds.max.x - body.bounds.min.x;
      const h = body.bounds.max.y - body.bounds.min.y;

      const x = body.position.x - w / 2;
      const y = body.position.y - h / 2;

      el.style.transform = `translate(${x}px, ${y}px) rotate(${body.angle}rad)`;
    });
  });

  // ======================
  // Resize: reload for stability
  // ======================
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => location.reload(), 250);
  });
})();