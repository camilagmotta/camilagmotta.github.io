(() => {
  const projectTiles = Array.from(document.querySelectorAll('.project-tile'));
  const lightbox = document.querySelector('.project-lightbox');
  const lightboxTitle = document.getElementById('project-lightbox-title');
  const lightboxCaption = document.querySelector('.project-lightbox-caption');
  const lightboxGallery = document.querySelector('.project-lightbox-gallery');

  const pdfSection = document.querySelector('.project-pdf-section');
  const pdfToggleList = document.querySelector('.project-pdf-toggle-list');
  const pdfViewerWrap = document.querySelector('.project-pdf-viewer-wrap');
  const pdfViewer = document.querySelector('.project-pdf-viewer');

  const closeButtons = Array.from(document.querySelectorAll('[data-close-project-lightbox]'));

  let lastFocusedTile = null;

  function isVideo(src) {
    return /\.(mp4|webm|ogg)$/i.test(src);
  }

  function buildMedia(tile) {
    return (tile.dataset.media || '')
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

    const buttons = Array.from(pdfToggleList.querySelectorAll('.project-pdf-toggle'));
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
      button.className = 'project-pdf-toggle';
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

    const title = tile.dataset.title || tile.querySelector('h2')?.textContent || 'Project';
    const caption = tile.dataset.caption || '';
    const media = buildMedia(tile);

    lightboxTitle.textContent = title;
    lightboxCaption.textContent = caption;
    lightboxGallery.innerHTML = '';

    media.forEach((src, index) => {
      const item = document.createElement('figure');
      item.className = 'project-lightbox-item';

      if (isVideo(src)) {
        const video = document.createElement('video');
        video.className = 'project-lightbox-video';
        video.src = src;
        video.controls = true;
        video.playsInline = true;
        video.preload = 'metadata';
        item.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.className = 'project-lightbox-image';
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

    const closeBtn = lightbox.querySelector('.project-lightbox-close');
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

  projectTiles.forEach((tile) => {
    const mode = (tile.dataset.projectMode || 'link').toLowerCase();

    if (mode === 'lightbox') {
      tile.addEventListener('click', (event) => {
        event.preventDefault();
        openLightbox(tile);
      });
    }
  });

  closeButtons.forEach((button) => {
    button.addEventListener('click', closeLightbox);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox && !lightbox.hidden) {
      closeLightbox();
    }
  });
})();