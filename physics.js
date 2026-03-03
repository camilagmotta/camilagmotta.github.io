(() => {
  // ======================
  // SETTINGS
  // ======================
  const ENABLE_ON_MOBILE = true; // set false if you want no physics on phones
  const COLOR_CLASSES = ["c-pink", "c-green", "c-yellow", "c-blue", "c-white", "c-black"];

  const GRAVITY_ON = 1;     // gravity AFTER first grab
  const GRAVITY_OFF = 0;    // gravity BEFORE first grab
  const BOUNCE = 0.15;
  const FRICTION = 0.25;
  const AIR_FRICTION = 0.02;

  const BORDER_THICKNESS = 200;
  const SPAWN_PADDING = 20; // space from edges when random spawning

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

  // Make stage a positioning context
  stage.style.position = "relative";
  stage.style.overflow = "hidden";
  stage.style.minHeight = stage.style.minHeight || "70vh";

  // Randomize colors each reload
  function randomColor() {
    return COLOR_CLASSES[Math.floor(Math.random() * COLOR_CLASSES.length)];
  }
  tiles.forEach((tile) => {
    COLOR_CLASSES.forEach((c) => tile.classList.remove(c));
    tile.classList.add(randomColor());
  });

  // ======================
  // MATTER SETUP
  // ======================
  const { Engine, Render, Runner, Bodies, Body, Composite, Mouse, MouseConstraint, Events } = Matter;

  const engine = Engine.create();
  engine.world.gravity.y = GRAVITY_OFF; // OFF until first grab

  const render = Render.create({
    element: stage,
    engine,
    options: {
      width: stage.clientWidth,
      height: stage.clientHeight,
      wireframes: false,
      background: "transparent",
    }
  });

  // Keep canvas invisible (we render DOM)
  render.canvas.style.position = "absolute";
  render.canvas.style.left = "0";
  render.canvas.style.top = "0";
  render.canvas.style.width = "100%";
  render.canvas.style.height = "100%";
  render.canvas.style.pointerEvents = "none";

  Render.run(render);
  const runner = Runner.create();
  Runner.run(runner, engine);

  // ======================
  // BOUNDS (WALLS)
  // ======================
  function addBounds() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;

    Composite.add(engine.world, [
      Bodies.rectangle(w / 2, h + BORDER_THICKNESS / 2, w + BORDER_THICKNESS * 2, BORDER_THICKNESS, { isStatic: true }),
      Bodies.rectangle(w / 2, -BORDER_THICKNESS / 2, w + BORDER_THICKNESS * 2, BORDER_THICKNESS, { isStatic: true }),
      Bodies.rectangle(-BORDER_THICKNESS / 2, h / 2, BORDER_THICKNESS, h + BORDER_THICKNESS * 2, { isStatic: true }),
      Bodies.rectangle(w + BORDER_THICKNESS / 2, h / 2, BORDER_THICKNESS, h + BORDER_THICKNESS * 2, { isStatic: true }),
    ]);
  }
  addBounds();

  // ======================
  // RANDOM SPAWN POSITIONS
  // ======================
  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  // IMPORTANT: set DOM tiles to a clean base so transforms work
  tiles.forEach((el) => {
    el.style.position = "absolute";
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.willChange = "transform";
    el.style.touchAction = "none";

    // Disable native anchor navigation; we handle it manually
    if (el.tagName.toLowerCase() === "a") {
      if (!el.dataset.href) el.dataset.href = el.getAttribute("href") || "";
      el.removeAttribute("href");
      el.setAttribute("role", "link");
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    }
  });

  // Create physics bodies in random places
  const bodies = new Map();

  tiles.forEach((el, i) => {
    const rect = el.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // Random position inside stage bounds
    const maxX = Math.max(SPAWN_PADDING, stage.clientWidth - w - SPAWN_PADDING);
    const maxY = Math.max(SPAWN_PADDING, stage.clientHeight - h - SPAWN_PADDING);

    const x = rand(SPAWN_PADDING, maxX);
    const y = rand(SPAWN_PADDING, maxY);

    // Body centered
    const body = Bodies.rectangle(x + w / 2, y + h / 2, w, h, {
      restitution: BOUNCE,
      friction: FRICTION,
      frictionAir: AIR_FRICTION,
      isStatic: true, // FROZEN until first grab
    });

    body.label = "tile";
    body.plugin = { el };
    body._tileIndex = i;

    Composite.add(engine.world, body);
    bodies.set(el, body);
  });

  // ======================
  // MOUSE / TOUCH DRAGGING
  // ======================
  const mouse = Mouse.create(stage);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: {
      stiffness: 0.18,
      damping: 0.12,
      render: { visible: false }
    }
  });
  Composite.add(engine.world, mouseConstraint);

  // Prevent scroll when dragging on touch
  stage.addEventListener("touchmove", (e) => {
    if (mouseConstraint.body) e.preventDefault();
  }, { passive: false });

  // ======================
  // ENABLE PHYSICS ON FIRST GRAB
  // ======================
  let physicsEnabled = false;
  let draggedRecentlyUntil = 0;

  function enablePhysics() {
    if (physicsEnabled) return;
    physicsEnabled = true;

    // Turn on gravity
    engine.world.gravity.y = GRAVITY_ON;

    // Make all tiles dynamic
    bodies.forEach((body) => {
      Body.setStatic(body, false);
      // Tiny nudge so stacked overlaps separate a bit once physics begins
      Body.setVelocity(body, { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5 });
    });
  }

  // When user starts dragging ANY body, enable physics
  Events.on(mouseConstraint, "startdrag", () => {
    enablePhysics();
    draggedRecentlyUntil = Date.now() + 700; // block click right after drag
  });

  // ======================
  // CLICK TO OPEN (only if not just dragged)
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
  // SYNC PHYSICS → DOM
  // ======================
  Events.on(engine, "afterUpdate", () => {
    bodies.forEach((body, el) => {
      const r = el.getBoundingClientRect();
      const w = r.width;
      const h = r.height;

      const x = body.position.x - w / 2;
      const y = body.position.y - h / 2;

      el.style.transform = `translate(${x}px, ${y}px) rotate(${body.angle}rad)`;
    });
  });

  // ======================
  // RESIZE: reload (simple/stable)
  // ======================
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => location.reload(), 250);
  });
})();