(() => {

  /* =========================
     RANDOMIZE TILE COLORS
     ========================= */

  const COLOR_CLASSES = [
    "c-pink",
    "c-green",
    "c-yellow",
    "c-blue",
    "c-white",
    "c-black"
  ];

  function randomColor() {
    return COLOR_CLASSES[Math.floor(Math.random() * COLOR_CLASSES.length)];
  }

  const allTiles = document.querySelectorAll(".tile");

  allTiles.forEach(tile => {
    // Remove existing color classes
    COLOR_CLASSES.forEach(c => tile.classList.remove(c));

    // Assign new random one
    tile.classList.add(randomColor());
  });


  /* =========================
     DRAG SYSTEM (unchanged)
     ========================= */

  const stage = document.querySelector(".tile-stage");
  if (!stage) return;

  const isMobile = window.matchMedia("(max-width: 860px)").matches;
  if (isMobile) return;

  const tiles = Array.from(stage.querySelectorAll(".tile"));
  if (!tiles.length) return;

  const pageKey = "tilepos:" + location.pathname;
  const saved = JSON.parse(localStorage.getItem(pageKey) || "{}");

  stage.style.position = "relative";

  const JUST_DRAGGED_MS = 450;

  tiles.forEach((el, i) => {
    const id = el.dataset.id || (el.dataset.id = "tile-" + i);
    el.style.position = "absolute";

    const pos = saved[id];
    if (pos) {
      el.style.left = pos.x + "px";
      el.style.top = pos.y + "px";
    } else {
      el.style.left = el.offsetLeft + "px";
      el.style.top = el.offsetTop + "px";
    }

    el.dataset.justDraggedUntil = "0";
  });

  function bringToFront(el) {
    const maxZ = tiles.reduce(
      (m, t) => Math.max(m, parseInt(getComputedStyle(t).zIndex) || 0),
      0
    );
    el.style.zIndex = maxZ + 1;
  }

  function savePos(el) {
    const id = el.dataset.id;
    const x = parseFloat(el.style.left);
    const y = parseFloat(el.style.top);

    const current = JSON.parse(localStorage.getItem(pageKey) || "{}");
    current[id] = { x, y };
    localStorage.setItem(pageKey, JSON.stringify(current));
  }

  tiles.forEach((el) => {
    el.style.cursor = "grab";
    el.style.userSelect = "none";
    el.style.touchAction = "none";

    if (el.tagName.toLowerCase() === "a") {
      el.addEventListener("click", (e) => {
        const until = parseInt(el.dataset.justDraggedUntil || "0", 10);
        const now = Date.now();
        if (now < until) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    }

    let startX = null;
    let startY = null;
    let startLeft = 0;
    let startTop = 0;
    let moved = false;

    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      bringToFront(el);
      el.style.cursor = "grabbing";

      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseFloat(el.style.left) || 0;
      startTop = parseFloat(el.style.top) || 0;
      moved = false;

      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener("pointermove", (e) => {
      if (startX === null) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;

      el.style.left = startLeft + dx + "px";
      el.style.top = startTop + dy + "px";
    });

    el.addEventListener("pointerup", () => {
      if (startX === null) return;

      el.style.cursor = "grab";

      if (moved) {
        savePos(el);
        el.dataset.justDraggedUntil = String(Date.now() + JUST_DRAGGED_MS);
      }

      startX = null;
      startY = null;
    });

  });

})();