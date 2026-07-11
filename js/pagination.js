/**
 * Pagination module - page navigation bar at bottom
 */
import Viewer from './viewer.js';

export default (function () {
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  const pageInput = document.getElementById('page-input');
  const pageTotal = document.querySelector('.page-total');
  let totalPages = 800;
  let currentPage = 1;

  function init(total) {
    totalPages = total;
    pageTotal.textContent = '/ ' + totalPages;
    pageInput.max = totalPages;

    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        navigateTo(currentPage - 1);
      }
    });

    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        navigateTo(currentPage + 1);
      }
    });

    pageInput.addEventListener('change', () => {
      let page = parseInt(pageInput.value, 10);
      if (isNaN(page) || page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      pageInput.value = page;
      navigateTo(page);
    });

    pageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        let page = parseInt(pageInput.value, 10);
        if (isNaN(page) || page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        pageInput.value = page;
        navigateTo(page);
      }
    });

    // Listen for page changes from viewer (scroll)
    document.addEventListener('pagechanged', (e) => {
      updatePaginationUI(e.detail.page);
    });

    // Zoom controls
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomInBtn = document.getElementById('zoom-in');

    zoomOutBtn.addEventListener('click', () => {
      Viewer.changeZoom(-0.10);
    });

    zoomInBtn.addEventListener('click', () => {
      Viewer.changeZoom(0.10);
    });
  }

  function navigateTo(pageNum) {
    if (pageNum < 1 || pageNum > totalPages) return;
    currentPage = pageNum;
    updatePaginationUI(pageNum);
    Viewer.goToPage(pageNum);
  }

  function updatePaginationUI(pageNum) {
    currentPage = pageNum;
    pageInput.value = pageNum;
    prevBtn.disabled = (pageNum <= 1);
    nextBtn.disabled = (pageNum >= totalPages);
  }

  function getCurrentPage() {
    return currentPage;
  }

  return {
    init,
    navigateTo,
    getCurrentPage
  };
})();