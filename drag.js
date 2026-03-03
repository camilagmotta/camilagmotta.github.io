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
     DRAGGABLE TILES (STAGE ONLY)
     ========================= */
  const stage = document.querySelector(".tile-stage");
  if (!stage) return;

  const isMobile = window.matchMedia("(max-width: 860px)").matches;
  if (isMobile) return;

  const tiles = Array.from(stage.querySelectorAll(".tile"));
  if (!tiles.length) return;

  stage.style.position = "relative";

  const pageKey = "tilepos:" + location.pathname;
  const saved = JSON.parse(localStorage.getItem(pageKey) || "{}");

  // How long after a drag we ignore clicks (prevents “release click” opening link)
  const JUST_DRAGGED_MS = 600;

  // IMPORTANT: disable browser default navigation on stage tiles that are <a>
  tiles.forEach((el) => {
    if (el.tagName.toLowerCase() === "a") {
      // Store href and remove it so the browser can't navigate automatically
      if (!el.dataset.href) el.dataset.href = el.getAttribute("href") || "";
      el.removeAttribute("href");

      // Keep it accessible as a link
      el.setAttribute("role", "link");
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    }
  });

  // Apply saved positions (px) or lock the initial ones to px
  tiles.forEach((el, i) => {
    const id = el.dataset.id || (el.dataset.id = "tile-" + i);
    el.style.position = "absolute";

    const pos = saved[id];
    if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
      el.style.left = pos.x + "px";
      el.style.top = pos.y + "px";
    } else {
      el.style.left = el.offsetLeft + "px";
      el.style.top = el.offsetTop + "px";
    }

    el.dataset.justDraggedUntil = "0";
  });

  function bringToFront(el) {
    const maxZ = tiles.reduce((m, t) => Math.max(m, parseInt(getComputedStyle(t).zIndex) || 0), 0);
    el.style.zIndex = String(maxZ + 1);
  }

  function savePos(el) {
    const id = el.dataset.id;
    const x = parseFloat(el.style.left) || 0;
    const y = parseFloat(el.style.top) || 0;

    const current = JSON.parse(localStorage.getItem(pageKey) || "{}");
    current[id] = { x, y };
    localStorage.setItem(pageKey, JSON.stringify(current));
  }

  function maybeNavigate(el) {
    const until = parseInt(el.dataset.justDraggedUntil || "0", 10);
    if (Date.now() < until) return; // ignore click right after drag

    const href = el.dataset.href;
    if (href) window.location.href = href;
  }

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

      // Lower threshold so it counts as a drag more easily
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;

      el.style.left = startLeft + dx + "px";
      el.style.top = startTop + dy + "px";
    });

    el.addEventListener("pointerup", (e) => {
      if (startX === null) return;

      el.style.cursor = "grab";

      if (moved) {
        savePos(el);
        el.dataset.justDraggedUntil = String(Date.now() + JUST_DRAGGED_MS);
      } else {
        // This was a deliberate click (no drag) → now navigate
        if (el.tagName.toLowerCase() === "a") maybeNavigate(el);
      }

      startX = null;
      startY = null;
    });

    el.addEventListener("pointercancel", () => {
      el.style.cursor = "grab";
      startX = null;
      startY = null;
    });

    // Keyboard open (Enter / Space)
    el.addEventListener("keydown", (e) => {
      if (el.tagName.toLowerCase() !== "a") return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        maybeNavigate(el);
      }
    });
  });
})();