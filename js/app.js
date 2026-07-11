/**
 * Main application controller
 * Initializes all modules in the correct order
 */
import DataStore from './data.js';
import Viewer from './viewer.js';
import Pagination from './pagination.js';
import Sections from './sections.js';
import Search from './search.js';

const TOTAL_PAGES = 800;

async function init() {
  // Load data first
  const ok = await DataStore.init();
  if (!ok) {
    document.body.innerHTML = '<div style="padding:40px;text-align:center;color:red;">Failed to load data files. Please ensure data/concordance.json and data/sections.json exist.</div>';
    return;
  }

  const concordanceData = DataStore.getConcordance();
  const sectionsData = DataStore.getSections();

  // Initialize viewer (loads images)
  Viewer.init(TOTAL_PAGES);

  // Initialize pagination (bottom bar)
  Pagination.init(TOTAL_PAGES);

  // Initialize sections panel (left sidebar)
  Sections.init(sectionsData);

  // Initialize search (right panel desktop / top bar mobile)
  Search.init(concordanceData, sectionsData);

  // Load first page
  Viewer.goToPage(1);

  console.log('Modern Concordance initialized successfully.');
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}