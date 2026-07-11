/**
 * Sections module - left sidebar with section list
 */
import Pagination from './pagination.js';

export default (function () {
  const panel = document.getElementById('sections-panel');
  const list = document.getElementById('sections-list');
  const toggleBtn = document.getElementById('sections-toggle');
  const closeBtn = document.getElementById('sections-close');
  let overlay = null;
  let sections = [];
  let isMobile = false;
  let isVisible = true;

  function init(sectionsData) {
    sections = sectionsData.sections || [];
    detectMobile();
    createOverlay();
    render();
    setupEvents();

    if (isMobile) {
      panel.classList.remove('visible');
      isVisible = false;
    } else {
      panel.classList.remove('hidden');
      isVisible = true;
    }
  }

  function detectMobile() {
    isMobile = window.innerWidth <= 768;
  }

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'sections-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => { hide(); });
  }

  function render() {
    list.innerHTML = '';
    sections.forEach((section) => {
      const item = document.createElement('div');
      item.className = 'section-item';
      item.dataset.page = section.page;

      if (section.indent === 0) {
        item.classList.add('section-header');
      } else {
        item.classList.add('section-sub');
      }

      item.innerHTML =
        '<span class="section-title">' + escapeHtml(section.title) + '</span>' +
        '<span class="section-page">' + section.page + '</span>';

      item.addEventListener('click', () => {
        Pagination.navigateTo(section.page);
        if (isMobile) {
          hide();
          document.getElementById('search-results').classList.remove('visible');
        }
      });
      list.appendChild(item);
    });
  }

  function setupEvents() {
    toggleBtn.addEventListener('click', () => {
      if (isVisible) { hide(); } else { show(); }
    });

    closeBtn.addEventListener('click', () => { hide(); });

    document.addEventListener('pagechanged', (e) => {
      updateActiveSection(e.detail.page);
    });

    window.addEventListener('resize', () => {
      const wasMobile = isMobile;
      detectMobile();
      if (wasMobile !== isMobile) {
        if (isMobile) {
          panel.classList.add('hidden');
          isVisible = false;
        } else {
          panel.classList.remove('hidden');
          panel.classList.remove('visible');
          isVisible = true;
        }
      }
    });
  }

  function show() {
    if (isMobile) {
      panel.classList.add('visible');
      overlay.classList.add('visible');
    } else {
      panel.classList.remove('hidden');
    }
    isVisible = true;
  }

  function hide() {
    if (isMobile) {
      panel.classList.remove('visible');
      overlay.classList.remove('visible');
    } else {
      panel.classList.add('hidden');
    }
    isVisible = false;
  }

  function updateActiveSection(pageNum) {
    let activeSection = null;
    for (const section of sections) {
      if (section.page <= pageNum) {
        if (!activeSection || section.page > activeSection.page) {
          activeSection = section;
        }
      }
    }

    const items = list.querySelectorAll('.section-item');
    items.forEach((item) => {
      const p = parseInt(item.dataset.page);
      if (activeSection && p === activeSection.page) {
        const titleEl = item.querySelector('.section-title');
        if (titleEl && titleEl.textContent.trim() === activeSection.title) {
          item.classList.add('active');
          return;
        }
      }
      item.classList.remove('active');
    });

    const activeItem = list.querySelector('.section-item.active');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return { init };
})();