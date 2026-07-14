/**
 * Search module - fuzzy search with Fuse.js
 * Two-tier: fast substring for short queries, Fuse for 3+ chars
 */
import Pagination from './pagination.js';
import Fuse from 'fuse.js';

export default (function () {
  let fuse = null;
  let aliasToEntry = new Map();
  let allEntries = [];
  let sections = [];
  let sectionPageMap = new Map();

  const searchInput = document.getElementById('search-input');
  const searchContainer = document.getElementById('search-container');
  const searchResults = document.getElementById('search-results');
  const searchPanel = document.getElementById('search-panel');
  const searchPanelResults = document.getElementById('search-panel-results');
  const searchClose = document.getElementById('search-close');

  let isMobile = false;
  let debounceTimer = null;
  let desktopSearchInput = null;

  function init(concordanceData, sectionsData) {
    allEntries = concordanceData;
    sections = sectionsData.sections || [];

    for (const section of sections) {
      sectionPageMap.set(section.title.toLowerCase(), section.page);
    }

    for (const entry of allEntries) {
      if (entry.aliases && entry.aliases.length > 0) {
        for (const alias of entry.aliases) {
          aliasToEntry.set(alias.toLowerCase(), entry);
        }
      }
    }

    // Safe Fuse options - no ignoreLocation, reasonable distance
    fuse = new Fuse(allEntries, {
      keys: ['name'],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true
    });

    detectMobile();
    setupEvents();
    setupDesktopSearchInput();
  }

  function detectMobile() {
    isMobile = window.innerWidth <= 768;
  }

  function setupEvents() {
    searchInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      const query = this.value.trim();
      if (query.length >= 2) {
        debounceTimer = setTimeout(() => doSearch(query), 50);
      } else {
        clearResults();
      }
    });

    searchInput.addEventListener('focus', function () {
      const query = this.value.trim();
      if (query.length >= 2) {
        showResults();
      }
    });

    searchClose.addEventListener('click', function () {
      if (searchResults.classList.contains('visible')) {
        searchInput.value = '';
        clearResults();
        searchInput.blur();
      } else if (searchInput.value.trim().length > 0) {
        searchInput.value = '';
        searchInput.focus();
      }
    });
  }

  function setupDesktopSearchInput() {
    const wrapper = document.createElement('div');
    wrapper.className = 'search-input-wrapper';
    wrapper.innerHTML = '<span class="search-icon">⌕</span><input type="text" class="search-input" placeholder="Search entries..." autocomplete="off">';
    searchPanel.insertBefore(wrapper, searchPanelResults);
    desktopSearchInput = wrapper.querySelector('.search-input');

    desktopSearchInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      const query = this.value.trim();
      if (query.length >= 2) {
        debounceTimer = setTimeout(() => doDesktopSearch(query), 50);
      } else {
        clearDesktopResults();
      }
    });

    // Resizable panel (desktop only)
    const resizeHandle = searchPanel.querySelector('.search-panel-resize-handle');
    if (resizeHandle) {
      let isResizing = false;
      let startX = 0;
      let startWidth = 0;

      const savedWidth = parseInt(localStorage.getItem('searchPanelWidth'), 10);
      if (savedWidth && savedWidth >= 220 && savedWidth <= 600) {
        searchPanel.style.setProperty('--search-panel-width', savedWidth + 'px');
      }

      resizeHandle.addEventListener('mousedown', function (e) {
        isResizing = true;
        startX = e.clientX;
        startWidth = searchPanel.getBoundingClientRect().width;
        resizeHandle.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });

      document.addEventListener('mousemove', function (e) {
        if (!isResizing) return;
        const delta = startX - e.clientX;
        const newWidth = Math.max(220, Math.min(600, startWidth + delta));
        searchPanel.style.setProperty('--search-panel-width', newWidth + 'px');
      });

      document.addEventListener('mouseup', function () {
        if (!isResizing) return;
        isResizing = false;
        resizeHandle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        const finalWidth = searchPanel.getBoundingClientRect().width;
        localStorage.setItem('searchPanelWidth', Math.round(finalWidth));
      });
    }
  }

  function doSearch(query) {
    const results = performSearch(query);
    renderResults(searchResults, results, 30);
    showResults();
  }

  function doDesktopSearch(query) {
    const results = performSearch(query);
    renderResults(searchPanelResults, results, 50);
  }

  function performSearch(query) {
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length >= 2);
    if (keywords.length === 0) return [];

    // Track best score and matched alias per entry across all keywords
    const entryMap = new Map(); // entry name -> { entry, score, matchedAlias }

    for (const kw of keywords) {
      // Fuse search per keyword
      const fuseResults = fuse.search(kw, { limit: 150 });
      for (const r of fuseResults) {
        const existing = entryMap.get(r.item.name);
        if (!existing || r.score < existing.score) {
          entryMap.set(r.item.name, { entry: r.item, score: r.score, matchedAlias: null });
        }
      }

      // Alias search per keyword
      for (const [alias, entry] of aliasToEntry) {
        if (alias.includes(kw)) {
          const existing = entryMap.get(entry.name);
          if (!existing || 0.05 < existing.score) {
            entryMap.set(entry.name, { entry, score: 0.05, matchedAlias: alias });
          } else if (existing && !existing.matchedAlias && existing.score === 0.05) {
            existing.matchedAlias = alias;
          }
        }
      }
    }

    // Convert map to sorted array
    const results = Array.from(entryMap.values()).map(r => ({
      entry: r.entry,
      matchedAlias: r.matchedAlias,
      score: r.score
    }));

    // Three-tier ranking for whole-word token matches:
    // Tier 1 (score -2): keyword matches the FIRST token (entry starts with it)
    // Tier 2 (score -1): keyword matches any other whole-word token
    // Tier 3 (score 0+): fuzzy Fuse match or alias substring only
    // Within each tier, ties broken by YAML index (entry.index)
    for (const result of results) {
      const tokens = result.entry.name.toLowerCase().split(/[\s,\-\(\)]+/).filter(Boolean);
      for (const kw of keywords) {
        const tokenIdx = tokens.indexOf(kw);
        if (tokenIdx !== -1) {
          result.score = tokenIdx === 0 ? -2 : -1;
          break;
        }
      }
    }

    results.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return (a.entry.index || 0) - (b.entry.index || 0);
    });
    return results;
  }

  function renderResults(container, results, max) {
    container.innerHTML = '';
    if (results.length === 0) {
      container.innerHTML = '<div class="search-no-results">No matching entries found</div>';
      return;
    }
    for (const r of results.slice(0, max)) {
      container.appendChild(createResultItem(r));
    }
    if (results.length > max) {
      const more = document.createElement('div');
      more.className = 'search-no-results';
      more.textContent = '... and ' + (results.length - max) + ' more results. Refine your search.';
      container.appendChild(more);
    }
  }

  function createResultItem(result) {
    const { entry, matchedAlias } = result;
    const item = document.createElement('div');
    item.className = 'search-result-item';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'search-result-name';
    nameDiv.textContent = entry.name;
    if (matchedAlias) {
      const hint = document.createElement('span');
      hint.className = 'alias-hint';
      hint.textContent = ' (from ' + matchedAlias + ')';
      nameDiv.appendChild(hint);
    }
    item.appendChild(nameDiv);

    if (entry.references && entry.references.length > 0) {
      const refsDiv = document.createElement('div');
      refsDiv.className = 'search-result-refs';
      for (const ref of entry.references) {
        const page = findSectionPage(ref.section);
        const el = document.createElement('div');
        el.className = 'search-result-section';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = '→ ' + ref.section;
        el.appendChild(nameSpan);
        if (ref.subsections && ref.subsections.length > 0) {
          const subs = document.createElement('span');
          subs.className = 'subsections';
          subs.textContent = ref.subsections.join(', ');
          el.appendChild(subs);
        }
        if (page) {
          el.style.cursor = 'pointer';
          el.title = 'Go to page ' + page;
          el.addEventListener('click', () => {
            Pagination.navigateTo(page);
            if (isMobile) searchResults.classList.remove('visible');
          });
        }
        refsDiv.appendChild(el);
      }
      item.appendChild(refsDiv);
    }

    return item;
  }

  function findSectionPage(name) {
    const key = name.toLowerCase().trim();
    if (sectionPageMap.has(key)) return sectionPageMap.get(key);
    for (const [t, page] of sectionPageMap) {
      if (t.includes(key)) return page;
    }
    return null;
  }

  function showResults() {
    if (searchResults.innerHTML.trim() !== '') {
      searchResults.classList.add('visible');
      searchClose.textContent = '\u00D7';
      searchClose.setAttribute('aria-label', 'Close search');
    }
  }

  function clearResults() {
    searchResults.innerHTML = '';
    searchResults.classList.remove('visible');
    searchClose.textContent = '\u2315';
    searchClose.setAttribute('aria-label', 'Search');
  }

  function clearDesktopResults() {
    searchPanelResults.innerHTML = '';
  }

  return { init };
})();