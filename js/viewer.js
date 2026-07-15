/**
 * Viewer module - Uses content-visibility: auto for virtual scrolling
 * All page wrappers are created on init, images load immediately.
 * Supports zoom via --zoom-width CSS variable.
 * Supports external image host with fallback to local book/ directory.
 */
export default (function () {
  let currentPage = 1;
  let totalPages = 800;
  let zoomLevel = 1.0;
  const minZoomLevel = 0.3
  const maxZoomLevel = 5.0
  const container = document.getElementById('image-container');
  const viewer = document.getElementById('viewer');
  const imageWrappers = new Map();

  // Image URL base – set via health check on init
  const LOCAL_BASE = 'book/';
  const REMOTE_BASE = 'https://modern-concordance.kithlo.com/book/';
  const SESSION_KEY = 'mc_image_base';
  let imageBaseUrl = LOCAL_BASE;

  /**
   * Check if the remote host is reachable by fetching alive.txt.
   * Result is cached in sessionStorage for the lifetime of the browsing session.
   */
  async function detectImageBase() {
    // In dev mode, always use local images — skip remote health check
    if (import.meta.env.DEV) {
      imageBaseUrl = LOCAL_BASE;
      console.log('Image base: local (book/) – dev mode');
      return;
    }

    // Check sessionStorage first
    try {
      const cached = sessionStorage.getItem(SESSION_KEY);
      if (cached === REMOTE_BASE || cached === LOCAL_BASE) {
        imageBaseUrl = cached;
        console.log('Image base (cached):', imageBaseUrl);
        return;
      }
    } catch (e) { /* sessionStorage unavailable */ }

    // Perform health check against remote host
    try {
      const resp = await fetch('https://modern-concordance.kithlo.com/alive.txt', {
        method: 'GET',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      });
      if (resp.ok) {
        imageBaseUrl = REMOTE_BASE;
        console.log('Image base: remote (https://modern-concordance.kithlo.com/book/)');
      } else {
        imageBaseUrl = LOCAL_BASE;
        console.log('Image base: local (book/) – remote returned', resp.status);
      }
    } catch (e) {
      imageBaseUrl = LOCAL_BASE;
      console.log('Image base: local (book/) – remote check failed:', e.message);
    }

    // Cache result
    try {
      sessionStorage.setItem(SESSION_KEY, imageBaseUrl);
    } catch (e) { /* sessionStorage unavailable */ }
  }

  async function init(total) {
    totalPages = total;

    const savedZoom = parseFloat(localStorage.getItem('zoomLevel'));
    if (savedZoom && savedZoom >= minZoomLevel && savedZoom <= maxZoomLevel) {
      zoomLevel = savedZoom;
    }

    // Detect best image source before creating page wrappers
    await detectImageBase();

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

  function buildImageSrc(pageNum, base) {
    return base + 'page_' + pageNum + '.jpg';
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

    // Start with the detected base; on error, try the other base once
    img.src = buildImageSrc(pageNum, imageBaseUrl);
    img.onload = function () {
      img.classList.add('loaded');
      placeholder.remove();
    };
    img.onerror = function () {
      // If we were using the remote and it failed, try local fallback
      if (imageBaseUrl === REMOTE_BASE && img.src.indexOf(REMOTE_BASE) === 0) {
        const fallbackSrc = buildImageSrc(pageNum, LOCAL_BASE);
        if (img.src !== fallbackSrc) {
          img.src = fallbackSrc;
          return;
        }
      }
      placeholder.textContent = 'Page ' + pageNum + ' (failed to load)';
    };
    wrapper.appendChild(img);

    container.appendChild(wrapper);
    imageWrappers.set(pageNum, wrapper);
    return wrapper;
  }

  function changeZoom(level) {
    zoomLevel = Math.max(minZoomLevel, Math.min(maxZoomLevel, level + zoomLevel));
    localStorage.setItem('zoomLevel', zoomLevel);
    applyZoom();
    return zoomLevel;
  }

  function applyZoom() {
    const px = Math.round(zoomLevel * 600) + 'px';
    container.style.setProperty('--zoom-width', px);
    const pct = Math.round(zoomLevel * 100) + '%';
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