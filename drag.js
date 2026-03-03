(() => {
  const stage = document.querySelector(".tile-stage");
  if (!stage) return;

  const isMobile = window.matchMedia("(max-width: 860px)").matches;
  if (isMobile) return;

  const tiles = Array.from(stage.querySelectorAll(".tile"));
  if (!tiles.length) return;

  const pageKey = "tilepos:" + location.pathname;
  const saved = JSON.parse(localStorage.getItem(pageKey) || "{}");

  stage.style.position = "relative";

  // Track if a tile was just dragged (so the release doesn't "click" the link)
  const JUST_DRAGGED_MS = 450;

  // Set initial px positions + apply saved
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

    // Used to suppress click after dragging
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
    // Make it feel draggable
    el.style.cursor = "grab";
    el.style.userSelect = "none";
    el.style.touchAction = "none";

    // If it's a link tile, we handle navigation ourselves
    // (This prevents the browser from opening it when you start dragging)
    if (el.tagName.toLowerCase() === "a") {
      el.addEventListener("click", (e) => {
        const until = parseInt(el.dataset.justDraggedUntil || "0", 10);
        const now = Date.now();

        // If tile was just dragged, ignore this click.
        if (now < until) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Otherwise: allow normal navigation.
        // (No preventDefault here.)
      });
    }

    let startX = null;
    let startY = null;
    let startLeft = 0;
    let startTop = 0;
    let moved = false;

    el.addEventListener("pointerdown", (e) => {
      // Prevent text selection + prevent default link drag behavior
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
        // Block link click that might happen on release
        el.dataset.justDraggedUntil = String(Date.now() + JUST_DRAGGED_MS);
      }

      startX = null;
      startY = null;
    });

    el.addEventListener("pointercancel", () => {
      el.style.cursor = "grab";
      startX = null;
      startY = null;
    });
  });
})();