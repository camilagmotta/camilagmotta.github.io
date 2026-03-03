(() => {
  // ====== SETTINGS ======
  const ENABLE_ON_MOBILE = true; // set false if you want physics only on desktop
  const COLOR_CLASSES = ["c-pink", "c-green", "c-yellow", "c-blue", "c-white", "c-black"];
  const STAGE_SELECTOR = ".tile-stage";
  const TILE_SELECTOR = ".tile-stage .tile";
  const GRAVITY_Y = 1;        // 1 = normal gravity
  const BOUNCE = 0.15;        // restitution (0..1)
  const FRICTION = 0.25;      // surface friction
  const AIR_FRICTION = 0.02;  // slows motion
  const BORDER_THICKNESS = 200;

  // ====== BASIC GUARDS ======
  const stage = document.querySelector(STAGE_SELECTOR);
  if (!stage) return;

  const isNarrow = window.matchMedia("(max-width: 860px)").matches;
  if (isNarrow && !ENABLE_ON_MOBILE) return;

  const tiles = Array.from(document.querySelectorAll(TILE_SELECTOR));
  if (!tiles.length) return;

  // Make stage a positioning context for DOM transforms
  stage.style.position = "relative";
  stage.style.overflow = "hidden";
  stage.style.minHeight = stage.style.minHeight || "70vh";

  // Randomize colors each load (between your existing classes)
  function randomColor() {
    return COLOR_CLASSES[Math.floor(Math.random() * COLOR_CLASSES.length)];
  }
  tiles.forEach((tile) => {
    COLOR_CLASSES.forEach((c) => tile.classList.remove(c));
    tile.classList.add(randomColor());
  });

  // ====== MATTER.JS SETUP ======
  const { Engine, Render, Runner, Bodies, Body, Composite, Mouse, MouseConstraint, Events } = Matter;

  const engine = Engine.create();
  engine.world.gravity.y = GRAVITY_Y;

  // Use a transparent canvas overlay so physics can track mouse/touch
  const stageRect = stage.getBoundingClientRect();

  const render = Render.create({
    element: stage,
    engine,
    options: {
      width: stage.clientWidth,
      height: stage.clientHeight,
      wireframes: false,
      background: "transparent",
      hasBounds: true
    }
  });

  // Hide the canvas (we render DOM tiles, not canvas graphics)
  render.canvas.style.position = "absolute";
  render.canvas.style.left = "0";
  render.canvas.style.top = "0";
  render.canvas.style.width = "100%";
  render.canvas.style.height = "100%";
  render.canvas.style.pointerEvents = "none"; // DOM gets pointer events

  Render.run(render);
  const runner = Runner.create();
  Runner.run(runner, engine);

  // ====== WALLS (BOUNDARIES) ======
  function addBounds() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;

    Composite.add(engine.world, [
      // floor
      Bodies.rectangle(w / 2, h + BORDER_THICKNESS / 2, w + BORDER_THICKNESS * 2, BORDER_THICKNESS, { isStatic: true }),
      // ceiling
      Bodies.rectangle(w / 2, -BORDER_THICKNESS / 2, w + BORDER_THICKNESS * 2, BORDER_THICKNESS, { isStatic: true }),
      // left wall
      Bodies.rectangle(-BORDER_THICKNESS / 2, h / 2, BORDER_THICKNESS, h + BORDER_THICKNESS * 2, { isStatic: true }),
      // right wall
      Bodies.rectangle(w + BORDER_THICKNESS / 2, h / 2, BORDER_THICKNESS, h + BORDER_THICKNESS * 2, { isStatic: true })
    ]);
  }

  addBounds();

  // ====== CREATE BODIES FOR EACH TILE ======
  // We’ll store original href and remove it so dragging never auto-navigates.
  const bodies = new Map();

  tiles.forEach((el, i) => {
    // Store and disable default navigation
    if (el.tagName.toLowerCase() === "a") {
      if (!el.dataset.href) el.dataset.href = el.getAttribute("href") || "";
      el.removeAttribute("href");
      el.setAttribute("role", "link");
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    }

    // Ensure DOM tile is ready for transforms
    el.style.position = "absolute";
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.willChange = "transform";
    el.style.touchAction = "none";

    // Initial position from inline left/top (your existing layout)
    // Convert to px relative to stage
    const left = parseFloat((el.style.left || "0").replace("px", "")) || el.offsetLeft;
    const top  = parseFloat((el.style.top  || "0").replace("px", "")) || el.offsetTop;

    // Size from layout
    const r = el.getBoundingClientRect();
    const w = r.width;
    const h = r.height;

    // Matter bodies are positioned by center
    const body = Bodies.rectangle(left + w / 2, top + h / 2, w, h, {
      restitution: BOUNCE,
      friction: FRICTION,
      frictionAir: AIR_FRICTION
    });

    body.label = "tile";
    body.plugin = { el };

    Composite.add(engine.world, body);
    bodies.set(el, body);
  });

  // ====== MOUSE/TOUCH DRAGGING (PHYSICS GRAB) ======
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

  // Prevent the page from scrolling when dragging on touch
  stage.addEventListener("touchmove", (e) => {
    if (mouseConstraint.body) e.preventDefault();
  }, { passive: false });

  // ====== CLICK TO OPEN (ONLY IF YOU DID NOT DRAG) ======
  let draggedRecentlyUntil = 0;

  Events.on(mouseConstraint, "startdrag", () => {
    draggedRecentlyUntil = Date.now() + 700; // block click right after drag
  });

  stage.addEventListener("click", (e) => {
    // If we just dragged, ignore click
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

  // Keyboard open (Enter / Space)
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

  // ====== SYNC PHYSICS → DOM (each frame) ======
  Events.on(engine, "afterUpdate", () => {
    bodies.forEach((body, el) => {
      const w = el.getBoundingClientRect().width;
      const h = el.getBoundingClientRect().height;

      // Convert body center to top-left, then apply translate+rotate
      const x = body.position.x - w / 2;
      const y = body.position.y - h / 2;

      el.style.transform = `translate(${x}px, ${y}px) rotate(${body.angle}rad)`;
    });
  });

  // ====== HANDLE RESIZE ======
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Rebuild everything on resize (simple + stable)
      location.reload();
    }, 250);
  });
})();