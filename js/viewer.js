/**
 * Viewer module - Uses content-visibility: auto for virtual scrolling
 * All page wrappers are created on init, images load immediately.
 * Supports zoom via --zoom-width CSS variable.
 */
export default (function () {
  let currentPage = 1;
  let totalPages = 800;
  let zoomLevel = 1.0;
  const container = document.getElementById('image-container');
  const viewer = document.getElementById('viewer');
  const imageWrappers = new Map();

  function init(total) {
    totalPages = total;

    const savedZoom = parseFloat(localStorage.getItem('zoomLevel'));
    if (savedZoom && savedZoom >= 0.50 && savedZoom <= 2.0) {
      zoomLevel = savedZoom;
    }

    for (let p = 1; p <= totalPages; p++) {
      createPageWrapper(p);
    }
    applyZoom();

    // Alt + mouse wheel zoom
    viewer.addEventListener('wheel', (e) => {
      if (e.altKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.10 : 0.10;
        changeZoom(delta);
      }
    }, { passive: false });
  }

  function createPageWrapper(pageNum) {
    const wrapper = document.createElement('div');
    wrapper.className = 'page-image-wrapper';
    wrapper.dataset.page = pageNum;

    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'Page ' + pageNum;
    wrapper.appendChild(placeholder);

    const img = document.createElement('img');
    img.alt = 'Page ' + pageNum;
    img.loading = 'lazy';
    img.src = 'book/page_' + pageNum + '.jpg';
    img.onload = function () {
      img.classList.add('loaded');
      placeholder.remove();
    };
    img.onerror = function () {
      placeholder.textContent = 'Page ' + pageNum + ' (failed to load)';
    };
    wrapper.appendChild(img);

    container.appendChild(wrapper);
    imageWrappers.set(pageNum, wrapper);
    return wrapper;
  }

  function changeZoom(level) {
    zoomLevel = Math.max(0.50, Math.min(2.0, level + zoomLevel));
    localStorage.setItem('zoomLevel', zoomLevel);
    applyZoom();
    return zoomLevel;
  }

  function applyZoom() {
    const pct = Math.round(zoomLevel * 100) + '%';
    container.style.setProperty('--zoom-width', pct);
    document.getElementById('zoom-label').textContent = pct;
  }

  function goToPage(pageNum) {
    if (pageNum < 1 || pageNum > totalPages) return;
    currentPage = pageNum;

    const wrapper = imageWrappers.get(pageNum);
    if (wrapper) {
      wrapper.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }

  function getCurrentPage() {
    let bestPage = currentPage;
    let bestRatio = 0;

    for (const [pageNum, wrapper] of imageWrappers) {
      const rect = wrapper.getBoundingClientRect();
      const viewerRect = viewer.getBoundingClientRect();
      if (rect.bottom < viewerRect.top || rect.top > viewerRect.bottom) continue;

      const visibleTop = Math.max(rect.top, viewerRect.top);
      const visibleBottom = Math.min(rect.bottom, viewerRect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const ratio = visibleHeight / rect.height;

      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestPage = pageNum;
      }
    }

    if (bestRatio > 0) currentPage = bestPage;
    return currentPage;
  }

  let scrollTimeout;
  viewer.addEventListener('scroll', function () {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const page = getCurrentPage();
      document.dispatchEvent(new CustomEvent('pagechanged', { detail: { page } }));
    }, 150);
  });

  return { init, goToPage, getCurrentPage, changeZoom };
})();