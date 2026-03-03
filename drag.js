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
     - Every page load: tiles start in new random positions
     - Tiles are clamped so they can't go under the footer
     ========================= */
  const stage = document.querySelector(".tile-stage");
  if (!stage) return;

  const isMobile = window.matchMedia("(max-width: 860px)").matches;
  if (isMobile) return;

  const tiles = Array.from(stage.querySelectorAll(".tile"));
  if (!tiles.length) return;

  stage.style.position = "relative";

  // How long after a drag we ignore clicks (prevents “release click” opening link)
  const JUST_DRAGGED_MS = 600;

  // =========================
// JUICY MAGNET SNAP (v2)
// =========================
const SNAP_IN = 12;      // snap engages when this close
const SNAP_OUT = 40;     // snap releases when pulled this far (bigger = easier to detach)
const MAGNET_GAP = 0;   // nice spacing snap (like tiles "park" with a gap)
const PULL = 0.5;       // softness: 0..1 (higher = stronger pull)
const OVERLAP_MIN = 26;  // requires overlap to avoid snapping from weird angles

function overlap1D(a1, a2, b1, b2) {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

function rectFromLT(el, left, top) {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  return { left, top, right: left + w, bottom: top + h, w, h };
}

function setHint(el, on) {
  el.classList.toggle("snap-hint", !!on);
}

function pop(el) {
  el.classList.remove("snap-pop");
  void el.offsetWidth; // retrigger animation
  el.classList.add("snap-pop");
  clearTimeout(el._popTO);
  el._popTO = setTimeout(() => el.classList.remove("snap-pop"), 180);
}

function magnetStep(el, nextLeft, nextTop, dragState) {
  const me = rectFromLT(el, nextLeft, nextTop);

  let bestX = null;
  let bestY = null;

  for (const other of tiles) {
    if (other === el) continue;

    const oL = parseFloat(other.style.left) || 0;
    const oT = parseFloat(other.style.top) || 0;
    const o = rectFromLT(other, oL, oT);

    const vOverlap = overlap1D(me.top, me.bottom, o.top, o.bottom);
    const hOverlap = overlap1D(me.left, me.right, o.left, o.right);

    // Only snap X if we overlap vertically enough
    if (vOverlap >= OVERLAP_MIN) {
      const xTargets = [
        o.left,                  // left-left
        o.right - me.w,          // right-right
        o.right + MAGNET_GAP,    // my left to their right + gap
        (o.left - MAGNET_GAP) - me.w // my right to their left - gap
      ];

      for (const t of xTargets) {
        const dist = Math.abs(me.left - t);
        if (!bestX || dist < bestX.dist) bestX = { axis: "x", target: t, dist };
      }
    }

    // Only snap Y if we overlap horizontally enough
    if (hOverlap >= OVERLAP_MIN) {
      const yTargets = [
        o.top,                   // top-top
        o.bottom - me.h,         // bottom-bottom
        o.bottom + MAGNET_GAP,   // my top to their bottom + gap
        (o.top - MAGNET_GAP) - me.h // my bottom to their top - gap
      ];

      for (const t of yTargets) {
        const dist = Math.abs(me.top - t);
        if (!bestY || dist < bestY.dist) bestY = { axis: "y", target: t, dist };
      }
    }
  }

  // --- Release logic (so it's not sticky)
  if (dragState.snap) {
  if (dragState.snap.x) {
    if (Math.abs(nextLeft - dragState.snap.x.target) > SNAP_OUT) dragState.snap.x = null;
  }
  if (dragState.snap.y) {
    if (Math.abs(nextTop - dragState.snap.y.target) > SNAP_OUT) dragState.snap.y = null;
  }
  if (!dragState.snap.x && !dragState.snap.y) setHint(el, false);
  }

// Make snap state hold 2 axes:
if (!dragState.snap) dragState.snap = { x: null, y: null };

// Engage snap per-axis (more satisfying)
let snappedThisFrame = false;

if (!dragState.snap.x && bestX && bestX.dist <= SNAP_IN) {
  dragState.snap.x = bestX;
  snappedThisFrame = true;
}
if (!dragState.snap.y && bestY && bestY.dist <= SNAP_IN) {
  dragState.snap.y = bestY;
  snappedThisFrame = true;
}

if (snappedThisFrame) pop(el);

// Hint if near either axis
const hintOn =
  !!dragState.snap.x || !!dragState.snap.y ||
  (bestX && bestX.dist <= SNAP_OUT) ||
  (bestY && bestY.dist <= SNAP_OUT);

setHint(el, hintOn);

// Soft pull X
const pullX = dragState.snap.x || (bestX && bestX.dist <= SNAP_OUT ? bestX : null);
if (pullX) {
  const delta = pullX.target - nextLeft;
  nextLeft += delta * (dragState.snap.x ? PULL : PULL * 0.55);
  if (Math.abs(delta) <= 1.2) nextLeft = pullX.target;
}

// Soft pull Y
const pullY = dragState.snap.y || (bestY && bestY.dist <= SNAP_OUT ? bestY : null);
if (pullY) {
  const delta = pullY.target - nextTop;
  nextTop += delta * (dragState.snap.y ? PULL : PULL * 0.55);
  if (Math.abs(delta) <= 1.2) nextTop = pullY.target;
}

  return { left: nextLeft, top: nextTop };
}

  // Footer boundary (supports: <footer>, .footer, .tile-footer)
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
    // Clamp within stage width, and within viewport area above footer.
    const stageRect = stage.getBoundingClientRect();
    const footerH = getFooterHeight();

    const maxX = Math.max(0, stage.clientWidth - el.offsetWidth);

    // Viewport bottom, minus footer, converted to stage-local coordinates
    const usableBottomInViewport = (window.innerHeight - footerH) - stageRect.top;
    const maxYViewport = usableBottomInViewport - el.offsetHeight;

    // Also clamp to stage height if the stage is smaller
    const maxYStage = stage.clientHeight - el.offsetHeight;

    const maxY = Math.max(0, Math.min(maxYViewport, maxYStage));
    return { maxX, maxY };
  }

  function randomizePositions() {
    tiles.forEach((el, i) => {
      el.dataset.id = el.dataset.id || "tile-" + i;
      el.style.position = "absolute";

      const { maxX, maxY } = getMaxXY(el);

      const pad = 8;
      const x = Math.floor(Math.random() * Math.max(1, maxX - pad)) + pad / 2;
      const y = Math.floor(Math.random() * Math.max(1, maxY - pad)) + pad / 2;

      el.style.left = clamp(x, 0, maxX) + "px";
      el.style.top = clamp(y, 0, maxY) + "px";
      el.dataset.justDraggedUntil = "0";
    });
  }

  // Disable default navigation on stage tiles that are <a>
  tiles.forEach((el) => {
    if (el.tagName.toLowerCase() === "a") {
      if (!el.dataset.href) el.dataset.href = el.getAttribute("href") || "";
      el.removeAttribute("href");

      el.setAttribute("role", "link");
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    }
  });

  // New random layout every reload
  randomizePositions();

  // Keep tiles in-bounds on resize
  window.addEventListener("resize", () => {
    tiles.forEach((el) => {
      const left = parseFloat(el.style.left) || 0;
      const top = parseFloat(el.style.top) || 0;
      const { maxX, maxY } = getMaxXY(el);
      el.style.left = clamp(left, 0, maxX) + "px";
      el.style.top = clamp(top, 0, maxY) + "px";
    });
  });

  function bringToFront(el)  
  {
    const maxZ = tiles.reduce((m, t) => Math.max(m, parseInt(getComputedStyle(t).zIndex) || 10), 10);
    el.style.zIndex = String(Math.min(maxZ + 1, 999)); // ✅ never climbs into footer range
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
      el._dragState = { snap: { x: null, y: null } };
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

      // ✅ JUICY MAGNET
      const st = el._dragState || (el._dragState = { snap: null });
      const m = magnetStep(el, nextLeft, nextTop, st);
      nextLeft = m.left;
      nextTop = m.top;

      // Keep within stage + above footer
      const bounds = getMaxXY(el);
      nextLeft = clamp(nextLeft, 0, bounds.maxX);
      nextTop = clamp(nextTop, 0, bounds.maxY);

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

      setHint(el, false);
      el._dragState = null;
    });

    el.addEventListener("pointercancel", () => {
      el.style.cursor = "grab";
      startX = null;
      startY = null;

      setHint(el, false);
      el._dragState = null;
    });

    el.addEventListener("keydown", (e) => {
      if (el.tagName.toLowerCase() !== "a") return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        maybeNavigate(el);
      }
    });
  });
    /* =========================
     Project hover video + expand height
     ========================= */
  document.querySelectorAll(".project-tile").forEach((tile) => {
    // Expand height from data-expanded-h (reliable cross-browser)
    const expanded = tile.getAttribute("data-expanded-h");
    if (expanded) tile.style.setProperty("--expanded-h", `${parseInt(expanded, 10)}px`);

    const video = tile.querySelector(".project-video");
    if (!video) return;

    // Make sure video starts hidden (CSS handles opacity)
    video.pause();

    tile.addEventListener("mouseenter", () => {
      // Some browsers block play unless muted (we set muted in HTML)
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