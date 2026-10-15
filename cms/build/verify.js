#!/usr/bin/env node
'use strict';
// Builds the site into a temp folder and compares each page with the page
// that is already in the site folder. Whitespace, comments and entity
// spelling are ignored. Anything else is reported as a difference.
//   node verify.js --site <site folder>
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { build } = require('./render');

const i = process.argv.indexOf('--site');
const site = path.resolve(i > -1 ? process.argv[i + 1] : '.');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flcc-verify-'));
const r = build(site, tmp);
r.warnings.forEach(w => console.warn('warning: ' + w));

function tokens(html) {
  html = html.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&times;/g, '×')
    .replace(/&copy;/g, '©').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  return (html.match(/<[^>]+>|[^<]+/g) || [])
    .map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

let bad = 0;
for (const f of r.written.filter(f => f.endsWith('.html'))) {
  const a = tokens(fs.readFileSync(path.join(site, f), 'utf8'));
  const b = tokens(fs.readFileSync(path.join(tmp, f), 'utf8'));
  if (a.join('\n') === b.join('\n')) { console.log('MATCH   ' + f + '  (' + a.length + ' tokens)'); continue; }
  bad++;
  console.log('DIFFERS ' + f);
  fs.writeFileSync(path.join(tmp, f + '.old.txt'), a.join('\n') + '\n');
  fs.writeFileSync(path.join(tmp, f + '.new.txt'), b.join('\n') + '\n');
  try { execFileSync('diff', ['-u', path.join(tmp, f + '.old.txt'), path.join(tmp, f + '.new.txt')], { encoding: 'utf8' }); }
  catch (e) { console.log(String(e.stdout || '').split('\n').slice(0, 60).join('\n')); }
}

// gallery data: compare what the browser would see
function load(p) { const c = { window: {} }; vm.createContext(c); vm.runInContext(fs.readFileSync(p, 'utf8'), c); return c.window; }
const oldG = load(path.join(site, 'assets/data/gallery.js'));
const newG = load(path.join(tmp, 'assets/data/gallery.js'));
const same = JSON.stringify(oldG) === JSON.stringify(newG);
console.log((same ? 'MATCH   ' : 'DIFFERS ') + 'assets/data/gallery.js  (' + newG.FLCC_GALLERY.length + ' photos)');
if (!same) bad++;
console.log('\nTemp build kept at ' + tmp);
process.exit(bad ? 1 : 0);
