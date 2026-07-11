const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Paths
const concordanceYamlPath = path.join(__dirname, '..', 'assets', 'concordance.yaml');
const sectionsTxtPath = path.join(__dirname, '..', 'assets', 'sections.txt');
const dataDir = path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ============================================================
// Parse concordance.yaml
// ============================================================
const yamlContent = fs.readFileSync(concordanceYamlPath, 'utf8');
const rawEntries = yaml.load(yamlContent);

// Step 1: Build a map of name -> entry (with references, without aliases)
const nameToEntry = new Map();
const seeMap = new Map(); // aliasName -> targetName

for (const entry of rawEntries) {
  if (entry.see) {
    seeMap.set(entry.name, entry.see);
  } else {
    // Normalize references: deduplicate by section, merge subsections
    const refs = (entry.references || []).map(r => ({
      section: r.section,
      subsections: r.subsections || [],
      priority: r.priority || 'normal'
    }));

    // Deduplicate by section name, merging subsections
    const sectionMap = new Map();
    for (const ref of refs) {
      if (sectionMap.has(ref.section)) {
        const existing = sectionMap.get(ref.section);
        existing.subsections = [...new Set([...existing.subsections, ...ref.subsections])];
        // Keep 'normal' priority if any reference is normal
        if (ref.priority === 'normal') {
          existing.priority = 'normal';
        }
      } else {
        sectionMap.set(ref.section, { ...ref });
      }
    }

    nameToEntry.set(entry.name, {
      name: entry.name,
      references: Array.from(sectionMap.values())
    });
  }
}

// Step 2: Resolve see references, matching target names to entry names
// Entry names can contain multiple forms: "Bring (out, down, in), Brought"
// "see: Bring" should match this entry.

function findEntryByName(targetName) {
  const t = targetName.toLowerCase().trim();
  
  // Exact match
  for (const [name] of nameToEntry) {
    if (name.toLowerCase() === t) return name;
  }
  
  // Entry name starts with target followed by space/comma/parenthesis/hyphen
  for (const [name] of nameToEntry) {
    const nl = name.toLowerCase();
    if (nl === t || nl.startsWith(t + ' ') || nl.startsWith(t + ',') || 
        nl.startsWith(t + '(') || nl.startsWith(t + '-') || nl.startsWith(t + ';')) {
      return name;
    }
  }
  
  // Target appears as a whole word in the entry name (with word boundaries)
  for (const [name] of nameToEntry) {
    const nl = name.toLowerCase();
    const regex = new RegExp('(^|[,\\s\\(\\-])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([,\\s\\)\\-]|$)', 'i');
    if (regex.test(nl)) return name;
  }
  
  return null;
}

function resolveSee(aliasName, visited = new Set()) {
  if (visited.has(aliasName)) return null;
  visited.add(aliasName);

  const target = seeMap.get(aliasName);
  if (!target) return aliasName;
  
  if (seeMap.has(target)) {
    return resolveSee(target, visited);
  }
  return target;
}

const resolvedEntries = [];
const aliasMap = new Map();

for (const [aliasName, targetName] of seeMap) {
  const resolved = resolveSee(aliasName);
  if (!resolved) continue;
  
  const matchedName = findEntryByName(resolved);
  if (matchedName && nameToEntry.has(matchedName)) {
    if (!aliasMap.has(matchedName)) {
      aliasMap.set(matchedName, []);
    }
    aliasMap.get(matchedName).push(aliasName);
  } else {
    console.warn(`Could not resolve "see: ${resolved}" for alias "${aliasName}"`);
  }
}

// Build final entries with aliases, preserving original YAML order
let idx = 0;
for (const [name, entry] of nameToEntry) {
  const aliases = aliasMap.get(name) || [];
  resolvedEntries.push({
    name: entry.name,
    references: entry.references,
    aliases: aliases,
    index: idx++
  });
}

fs.writeFileSync(
  path.join(dataDir, 'concordance.json'),
  JSON.stringify(resolvedEntries, null, 2),
  'utf8'
);
console.log(`Wrote ${resolvedEntries.length} concordance entries to data/concordance.json`);

// ============================================================
// Parse sections.txt
// ============================================================
const sectionsContent = fs.readFileSync(sectionsTxtPath, 'utf8');
const lines = sectionsContent.split('\n').filter(line => line.trim() !== '');

const sections = [];

// The file has a hierarchy. Let's detect it by leading tabs/spaces.
// Format: each line has optional leading whitespace for indentation,
// then the section title, then a tab or multiple spaces, then the page number.
// Top-level items (no indent): "Contents", "Introduction", "Concordance Of Themes & Words", "English Index", "Greek Index", "Index to Proper Names", "List of Greek Roots"
// Under "Concordance Of Themes & Words": indented items with section title + page number
// Under those: further indented subsections

// Parse lines using tab-based indentation
// Each line is: [tabs]Title\tPageNumber
const parsedLines = [];
for (const line of lines) {
  // Count leading tab characters
  const tabCount = line.match(/^\t*/)[0].length;
  const trimmed = line.trim();
  
  // Split by last tab to separate title from page number
  const lastTabIdx = trimmed.lastIndexOf('\t');
  if (lastTabIdx !== -1) {
    const title = trimmed.substring(0, lastTabIdx).trim();
    const pageStr = trimmed.substring(lastTabIdx + 1).trim();
    const pageNum = parseInt(pageStr, 10);
    if (!isNaN(pageNum)) {
      parsedLines.push({
        indent: tabCount,
        title: title,
        page: pageNum
      });
      continue;
    }
  }
  
  // Line without a page number
  if (trimmed) {
    parsedLines.push({
      indent: tabCount,
      title: trimmed,
      page: null
    });
  }
}

// Build a flat list of ALL sections with page numbers and indent level
for (const item of parsedLines) {
  if (item.page !== null) {
    sections.push({
      title: item.title,
      page: item.page,
      indent: item.indent
    });
  }
}

const allSections = {
  sections: sections
};

fs.writeFileSync(
  path.join(dataDir, 'sections.json'),
  JSON.stringify(allSections, null, 2),
  'utf8'
);
console.log(`Wrote ${sections.length} sections to data/sections.json`);
