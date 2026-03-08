(() => {

  const filters = Array.from(document.querySelectorAll('.art-filter'));
  const tiles = Array.from(document.querySelectorAll('.art-tile'));

  const lightbox = document.querySelector('.art-lightbox');
  const lightboxTitle = document.getElementById('art-lightbox-title');
  const lightboxCaption = document.querySelector('.art-lightbox-caption');
  const lightboxGallery = document.querySelector('.art-lightbox-gallery');

  const closeButtons = Array.from(document.querySelectorAll('[data-close-lightbox]'));

  let lastFocusedTile = null;

  function setActiveFilter(activeButton) {
    filters.forEach(btn => {
      const active = btn === activeButton;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function applyFilter(filter) {

    const normalized = (filter || 'all').toLowerCase();

    tiles.forEach(tile => {

      const category = (tile.dataset.category || '').toLowerCase();

      const show =
        normalized === 'all' ||
        category === normalized;

      tile.hidden = !show;

    });

  }

  filters.forEach(button => {

    button.addEventListener('click', () => {

      setActiveFilter(button);
      applyFilter(button.dataset.filter);

    });

  });

  function isVideo(src) {

    return src.match(/\.(mp4|webm|ogg)$/i);

  }

  function buildMedia(tile) {

    const media = (tile.dataset.media || tile.dataset.images || '')
      .split('|')
      .map(src => src.trim())
      .filter(Boolean);

    return media;

  }

  function openLightbox(tile) {

    if (!lightbox) return;

    lastFocusedTile = tile;

    const title = tile.dataset.title || 'Artwork';
    const caption = tile.dataset.caption || '';

    const media = buildMedia(tile);

    lightboxTitle.textContent = title;
    lightboxCaption.textContent = caption;

    lightboxGallery.innerHTML = '';

    media.forEach((src, index) => {

      const figure = document.createElement('figure');
      figure.className = 'art-lightbox-item';

      if (isVideo(src)) {

        const video = document.createElement('video');

        video.className = 'art-lightbox-video';
        video.src = src;
        video.controls = true;
        video.playsInline = true;

        figure.appendChild(video);

      } else {

        const img = document.createElement('img');

        img.className = 'art-lightbox-image';
        img.src = src;
        img.alt = `${title} ${index + 1}`;

        figure.appendChild(img);

      }

      lightboxGallery.appendChild(figure);

    });

    lightbox.hidden = false;
    lightbox.setAttribute('aria-hidden', 'false');

    document.body.style.overflow = 'hidden';

    const closeBtn = lightbox.querySelector('.art-lightbox-close');
    if (closeBtn) closeBtn.focus();

  }

  function closeLightbox() {

    if (!lightbox) return;

    lightbox.hidden = true;
    lightbox.setAttribute('aria-hidden', 'true');

    document.body.style.overflow = '';

    lightboxGallery.innerHTML = '';

    if (lastFocusedTile) {
      lastFocusedTile.focus();
    }

  }

  tiles.forEach(tile => {

    tile.addEventListener('click', () => {

      openLightbox(tile);

    });

  });

  closeButtons.forEach(button => {

    button.addEventListener('click', closeLightbox);

  });

  document.addEventListener('keydown', (event) => {

    if (event.key === 'Escape' && !lightbox.hidden) {
      closeLightbox();
    }

  });

  applyFilter('all');

})();