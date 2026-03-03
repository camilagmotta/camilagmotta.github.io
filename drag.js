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
  });

  function bringToFront(el) {
    const maxZ = tiles.reduce((m, t) => Math.max(m, parseInt(getComputedStyle(t).zIndex) || 0), 0);
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

  tiles.forEach(el => {
    el.style.cursor = "grab";
    el.style.userSelect = "none";
    el.style.touchAction = "none";

    let startX, startY, startLeft, startTop, moved;

    el.addEventListener("pointerdown", e => {
      e.preventDefault();
      bringToFront(el);

      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseFloat(el.style.left);
      startTop = parseFloat(el.style.top);
      moved = false;

      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener("pointermove", e => {
      if (startX == null) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;

      el.style.left = startLeft + dx + "px";
      el.style.top = startTop + dy + "px";
    });

    el.addEventListener("pointerup", e => {
      if (startX == null) return;

      if (moved) {
        savePos(el);
      } else if (el.tagName.toLowerCase() === "a") {
        window.location.href = el.href;
      }

      startX = null;
      startY = null;
    });
  });
})();