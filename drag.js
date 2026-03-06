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
     DRAGGABLE + RANDOM POSITIONS
     ========================= */
  const stage = document.querySelector(".tile-stage");
  if (!stage) return;

  const isMobile = window.matchMedia("(max-width: 860px)").matches;
  if (isMobile) return;

  const tiles = Array.from(stage.querySelectorAll(".tile"));
  if (!tiles.length) return;

  stage.style.position = "relative";
  stage.classList.add("is-randomizing");

  const JUST_DRAGGED_MS = 600;

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

  function overlaps(a, b, gap = 24) {
    return !(
      a.right + gap <= b.left ||
      a.left >= b.right + gap ||
      a.bottom + gap <= b.top ||
      a.top >= b.bottom + gap
    );
  }

  function randomizePositions() {
    const placed = [];

    const aboutTile = stage.querySelector(".about-tile");
    if (aboutTile) {
      placed.push({
        left: aboutTile.offsetLeft - 28,
        top: aboutTile.offsetTop - 28,
        right: aboutTile.offsetLeft + aboutTile.offsetWidth + 28,
        bottom: aboutTile.offsetTop + aboutTile.offsetHeight + 28
      });
    }

    tiles.forEach((el, i) => {
      el.dataset.id = el.dataset.id || "tile-" + i;
      el.style.position = "absolute";

      const { maxX, maxY } = getMaxXY(el);

      let placedRect = null;
      let attempts = 0;
      const maxAttempts = 300;

      while (attempts < maxAttempts) {
        const x = Math.floor(Math.random() * Math.max(1, maxX + 1));
        const y = Math.floor(Math.random() * Math.max(1, maxY + 1));

        const testRect = {
          left: x,
          top: y,
          right: x + el.offsetWidth,
          bottom: y + el.offsetHeight
        };

        const hitsBlockedArea = placed.some((rect) => overlaps(testRect, rect, 28));

        if (!hitsBlockedArea) {
          placedRect = testRect;
          break;
        }

        attempts++;
      }

      if (!placedRect) {
        const x = Math.floor(Math.random() * Math.max(1, maxX + 1));
        const y = Math.floor(Math.random() * Math.max(1, maxY + 1));

        placedRect = {
          left: x,
          top: y,
          right: x + el.offsetWidth,
          bottom: y + el.offsetHeight
        };
      }

      el.style.left = placedRect.left + "px";
      el.style.top = placedRect.top + "px";
      el.dataset.justDraggedUntil = "0";

      placed.push(placedRect);
    });
  }

  tiles.forEach((el) => {
    if (el.tagName.toLowerCase() === "a") {
      if (!el.dataset.href) el.dataset.href = el.getAttribute("href") || "";
      el.removeAttribute("href");

      el.setAttribute("role", "link");
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    }
  });

  function revealTiles() {
    stage.classList.remove("is-randomizing");

    requestAnimationFrame(() => {
      tiles.forEach((tile, i) => {
        setTimeout(() => {
          tile.classList.add("ready");
        }, i * 70);
      });
    });
  }

  function initializeLayout() {
    randomizePositions();
    revealTiles();
  }

  if (document.readyState === "complete") {
    initializeLayout();
  } else {
    window.addEventListener("load", initializeLayout, { once: true });
  }

  window.addEventListener("resize", () => {
    tiles.forEach((el) => {
      const left = parseFloat(el.style.left) || 0;
      const top = parseFloat(el.style.top) || 0;
      const { maxX, maxY } = getMaxXY(el);

      el.style.left = clamp(left, 0, maxX) + "px";
      el.style.top = clamp(top, 0, maxY) + "px";
    });
  });

  function bringToFront(el) {
    const maxZ = tiles.reduce(
      (m, t) => Math.max(m, parseInt(getComputedStyle(t).zIndex) || 10),
      10
    );
    el.style.zIndex = String(Math.min(maxZ + 1, 999));
  }

  function maybeNavigate(el) {
    const until = parseInt(el.dataset.justDraggedUntil || "0", 10);
    if (Date.now() < until) return;

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

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;

      let nextLeft = startLeft + dx;
      let nextTop = startTop + dy;

      const { maxX, maxY } = getMaxXY(el);
      nextLeft = clamp(nextLeft, 0, maxX);
      nextTop = clamp(nextTop, 0, maxY);

      el.style.left = nextLeft + "px";
      el.style.top = nextTop + "px";
    });

    el.addEventListener("pointerup", () => {
      if (startX === null) return;

      el.style.cursor = "grab";

      if (moved) {
        el.dataset.justDraggedUntil = String(Date.now() + JUST_DRAGGED_MS);
      } else {
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

    el.addEventListener("keydown", (e) => {
      if (el.tagName.toLowerCase() !== "a") return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        maybeNavigate(el);
      }
    });
  });

  document.querySelectorAll(".project-tile").forEach((tile) => {
    const expanded = tile.getAttribute("data-expanded-h");
    if (expanded) {
      tile.style.setProperty("--expanded-h", `${parseInt(expanded, 10)}px`);
    }

    const video = tile.querySelector(".project-video");
    if (!video) return;

    video.pause();

    tile.addEventListener("mouseenter", () => {
      video.currentTime = 0;
      const p = video.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    });

    tile.addEventListener("mouseleave", () => {
      video.pause();
      video.currentTime = 0;
    });
  });
})();