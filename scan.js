const fs = require('fs');
const path = require('path');

const DIR_PATH = './runtastic_export';

function getSportType(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Strategy 1: Look for the <type> tag (Standard Runtastic)
    const typeMatch = content.match(/<type>(.*?)<\/type>/i);
    if (typeMatch && typeMatch[1]) return typeMatch[1].toLowerCase();

    // Strategy 2: Fallback to the <name> tag
    const nameMatch = content.match(/<name>(.*?)<\/name>/i);
    if (nameMatch && nameMatch[1]) return `name-tag: ${nameMatch[1]}`;

    return 'unknown';
  } catch (e) {
    return 'error-reading-file';
  }
}

function runScan() {
  const files = fs.readdirSync(DIR_PATH).filter(file => file.endsWith('.gpx'));
  const stats = {};

  console.log(`\nScanning ${files.length} files in ${DIR_PATH}...\n`);

  files.forEach(file => {
    const type = getSportType(path.join(DIR_PATH, file));
    stats[type] = (stats[type] || 0) + 1;
  });

  console.log('====================================');
  console.log(' ACTIVITY SUMMARY (runtastic_export)');
  console.log('====================================');
  console.table(Object.keys(stats).map(type => ({
    'Activity Type': type,
    'Count': stats[type]
  })));
  console.log('====================================\n');
}

runScan();
