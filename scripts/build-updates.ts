import fs from 'fs-extra';

// Matches conventional-changelog version headers, e.g.
// "# [0.12.0](https://...compare/v0.11.1...v0.12.0) (2026-10-21)" or "# 0.1.0 (2026-08-15)"
const versionHeader = /^#{1,2} \[?(\d+\.\d+\.\d+)\]?/;

type Update = {
  version: string;
  title: string;
  content: string;
};

const changelog = fs.readFileSync('./CHANGELOG.md', 'utf8');

const updates: Update[] = [];
let current: { version: string; lines: string[] } | undefined;

const finishCurrent = () => {
  if (!current) return;

  updates.push({
    version: current.version,
    title: `Version ${current.version}`,
    content: current.lines.join('\n').trim() || 'No notable changes.',
  });
};

changelog.split(/\r?\n/).forEach((line) => {
  const match = line.match(versionHeader);
  if (match) {
    finishCurrent();
    current = { version: match[1], lines: [] };
    return;
  }

  current?.lines.push(line);
});

finishCurrent();

// CHANGELOG.md is newest-first, which is the order updates.json requires.
fs.writeJsonSync('public/updates.json', { updates }, { spaces: 2 });
console.info(`Wrote ${updates.length} updates to updates.json!`);
