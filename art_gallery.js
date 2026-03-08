(() => {
  const filters = Array.from(document.querySelectorAll('.art-filter'));
  const tiles = Array.from(document.querySelectorAll('.art-tile'));

  const lightbox = document.querySelector('.art-lightbox');
  const lightboxTitle = document.getElementById('art-lightbox-title');
  const lightboxCaption = document.querySelector('.art-lightbox-caption');
  const lightboxGallery = document.querySelector('.art-lightbox-gallery');

  const pdfSection = document.querySelector('.art-pdf-section');
  const pdfToggleList = document.querySelector('.art-pdf-toggle-list');
  const pdfViewerWrap = document.querySelector('.art-pdf-viewer-wrap');
  const pdfViewer = document.querySelector('.art-pdf-viewer');

  const closeButtons = Array.from(document.querySelectorAll('[data-close-lightbox]'));

  let lastFocusedTile = null;

  function setActiveFilter(activeButton) {
    filters.forEach((btn) => {
      const isActive = btn === activeButton;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  function applyFilter(filter) {
    const normalized = (filter || 'all').toLowerCase();

    tiles.forEach((tile) => {
        const categories = (tile.dataset.category || '')
        .toLowerCase()
        .split(' ')
        .filter(Boolean);

        const show =
        normalized === 'all' ||
        categories.includes(normalized);
      tile.hidden = !show;
    });
  }

  filters.forEach((button) => {
    button.addEventListener('click', () => {
      setActiveFilter(button);
      applyFilter(button.dataset.filter);
    });
  });

  function isVideo(src) {
    return /\.(mp4|webm|ogg)$/i.test(src);
  }

  function buildMedia(tile) {
    return (tile.dataset.media || tile.dataset.images || '')
      .split('|')
      .map((src) => src.trim())
      .filter(Boolean);
  }

  function buildPdfs(tile) {
    return (tile.dataset.pdfs || '')
      .split('|')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const parts = entry.split('::');
        const label = (parts[0] || 'PDF').trim();
        const src = (parts[1] || '').trim();
        return { label, src };
      })
      .filter((item) => item.src);
  }

  function resetPdfViewer() {
    if (!pdfSection || !pdfToggleList || !pdfViewerWrap || !pdfViewer) return;

    pdfToggleList.innerHTML = '';
    pdfViewer.src = '';
    pdfViewerWrap.hidden = true;
    pdfSection.hidden = true;
  }

  function openPdf(src, activeButton) {
    if (!pdfViewer || !pdfViewerWrap || !pdfToggleList) return;

    pdfViewer.src = src;
    pdfViewerWrap.hidden = false;

    const buttons = Array.from(pdfToggleList.querySelectorAll('.art-pdf-toggle'));
    buttons.forEach((button) => {
      const isActive = button === activeButton;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  function renderPdfSection(tile) {
    if (!pdfSection || !pdfToggleList || !pdfViewerWrap || !pdfViewer) return;

    const pdfs = buildPdfs(tile);
    resetPdfViewer();

    if (!pdfs.length) return;

    pdfSection.hidden = false;

    pdfs.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'art-pdf-toggle';
      button.textContent = item.label;
      button.setAttribute('aria-pressed', 'false');

      button.addEventListener('click', () => {
        openPdf(item.src, button);
      });

      pdfToggleList.appendChild(button);

      if (index === 0) {
        openPdf(item.src, button);
      }
    });
  }

  function openLightbox(tile) {
    if (!lightbox || !lightboxTitle || !lightboxCaption || !lightboxGallery) return;

    lastFocusedTile = tile;

    const title = tile.dataset.title || 'Artwork';
    const caption = tile.dataset.caption || '';
    const media = buildMedia(tile);

    lightboxTitle.textContent = title;
    lightboxCaption.textContent = caption;
    lightboxGallery.innerHTML = '';

    media.forEach((src, index) => {
      const item = document.createElement('figure');
      item.className = 'art-lightbox-item';

      if (isVideo(src)) {
        const video = document.createElement('video');
        video.className = 'art-lightbox-video';
        video.src = src;
        video.controls = true;
        video.playsInline = true;
        preload = 'metadata';
        item.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.className = 'art-lightbox-image';
        img.src = src;
        img.alt = `${title} ${index + 1}`;
        item.appendChild(img);
      }

      lightboxGallery.appendChild(item);
    });

    renderPdfSection(tile);

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

    if (lightboxGallery) {
      lightboxGallery.innerHTML = '';
    }

    resetPdfViewer();

    if (lastFocusedTile) {
      lastFocusedTile.focus();
    }
  }

  tiles.forEach((tile) => {
    tile.addEventListener('click', () => {
      openLightbox(tile);
    });
  });

  closeButtons.forEach((button) => {
    button.addEventListener('click', closeLightbox);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox && !lightbox.hidden) {
      closeLightbox();
    }
  });

  applyFilter('all');
})();