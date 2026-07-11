/**
 * Data loading module
 * Fetches and parses concordance.json and sections.json
 */
export default (function () {
  let concordanceData = [];
  let sectionsData = { concordanceSections: [], otherSections: [] };

  async function init() {
    try {
      const [concResp, sectResp] = await Promise.all([
        fetch('data/concordance.json'),
        fetch('data/sections.json')
      ]);
      concordanceData = await concResp.json();
      sectionsData = await sectResp.json();
      console.log(`Loaded ${concordanceData.length} concordance entries and ${sectionsData.sections.length} sections`);
      return true;
    } catch (err) {
      console.error('Failed to load data:', err);
      return false;
    }
  }

  function getConcordance() {
    return concordanceData;
  }

  function getSections() {
    return sectionsData;
  }

  return {
    init,
    getConcordance,
    getSections
  };
})();