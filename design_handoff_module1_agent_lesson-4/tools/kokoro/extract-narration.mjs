// Extract every spoken segment from the lesson source (../../frontend) → narration-jobs.json.
// Runs the real page definitions in a VM so wording comes straight from the code, then cross-checks the
// existing audio/manifest.json text (hard fail on any wording difference).
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { createRequire } from 'node:module';
const root = path.resolve(import.meta.dirname, '../..'), fe = path.join(root, 'frontend');
const req = createRequire(path.join(root, 'local-build/package.json'));
const babel = req('@babel/core'), React = req('react');
const ctx = vm.createContext({ React, console, setTimeout, clearTimeout, requestAnimationFrame: () => 0, cancelAnimationFrame() {}, ResizeObserver: class { observe() {} disconnect() {} }, MutationObserver: class { observe() {} disconnect() {} },
  document: { getElementById: () => null, addEventListener() {}, querySelectorAll: () => [] }, navigator: {}, localStorage: { getItem: () => null, setItem() {} }, sessionStorage: { getItem: () => null, setItem() {} } });
ctx.window = ctx; ctx.addEventListener = () => {}; ctx.matchMedia = () => ({ matches: false, addEventListener() {} });
const load = (n) => vm.runInContext(babel.transformSync(fs.readFileSync(path.join(fe, n + '.jsx'), 'utf8'), { presets: [req.resolve('@babel/preset-react')], filename: n }).code, ctx, { filename: n });
['core', 'pages-a', 'pages-b', 'pages-c'].forEach(load);
const PAGES = vm.runInContext('PAGES', ctx);
const P3_CHIPS = vm.runInContext('P3_CHIPS', ctx), APPROACHES = vm.runInContext('APPROACHES', ctx);

const partsOf = (s) => (s.parts ? s.parts.map(p => p.t) : [s.t]);
const jobs = [];
const add = (name, parts, extra = {}) => jobs.push({ name, parts, ...extra });

// scene 0: the welcome (WELCOME_PARTS in app.jsx)
const appSrc = fs.readFileSync(path.join(fe, 'app.jsx'), 'utf8');
const wp = appSrc.match(/const WELCOME_PARTS = \[([\s\S]*?)\];/)[1];
add('scene0-seg1', vm.runInContext('[' + wp + ']', ctx));

// scenes 1–13: initial narration (page 12's first segment is dynamic → variants below)
PAGES.forEach((pg, i) => {
  const segs = pg.narration({});
  segs.forEach((s, k) => { if (s.dyn) return; add(`scene${i + 1}-seg${k + 1}`, partsOf(s)); });
});
// feedback segments (derived from page state: Page 3 once a choice is saved, Page 7 once the question is solved), numbered after the base segments
const FULL = { p3: { saved: { choice: 'agent', text: 'x' } }, p7: { q: { solved: true } } };
PAGES.forEach((pg, i) => {
  const base = pg.narration({}).length, full = pg.narration(FULL);
  full.slice(base).forEach((s, k) => { if (!s.fb) throw new Error(`page ${i + 1}: extra segment ${base + k} is not flagged fb`); add(`scene${i + 1}-seg${base + k + 1}`, partsOf(s)); });
});
// paragraph definitions: every page's `paras` must partition its base segments contiguously, in order
PAGES.forEach((pg, i) => {
  const base = pg.narration({}).length; let next = 0;
  (pg.paras || []).forEach((p, k) => { if (p.s[0] !== next || p.s[1] < p.s[0]) throw new Error(`page ${i + 1} paragraph ${k}: expected to start at segment ${next}, got ${p.s}`); next = p.s[1] + 1; if (!p.main) throw new Error(`page ${i + 1} paragraph ${k}: no main target`); });
  if (next !== base) throw new Error(`page ${i + 1}: paragraphs cover ${next} of ${base} segments`);
});
// page 12, segment 1 (dynamic): pre-render the finite variants — 3 approaches × 3 preset reasons, plus "no saved choice"
const p12 = PAGES[11];
const none = p12.narration({})[0]; add(none.audio, [none.t], { variant: true });
for (const choice of Object.keys(APPROACHES).filter(k => ['single', 'workflow', 'agent'].includes(k)))
  P3_CHIPS.forEach((chip, ci) => {
    const s = p12.narration({ p3: { saved: { choice, chip, text: chip } } })[0];
    add(s.audio, [s.t], { variant: true });
  });

// cross-check vs the existing manifest text (wording must be unchanged)
const man = JSON.parse(fs.readFileSync(path.join(root, 'audio/manifest.json'), 'utf8'));
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const accept = process.argv.includes('--accept') ? process.argv[process.argv.indexOf('--accept') + 1].split(',') : []; // clips whose wording was changed on purpose
const errs = []; const seen = new Set(); const changed = [];
for (const j of jobs) {
  if (j.name.startsWith('scene0') || j.variant) continue;
  seen.add(j.name); const m = man[j.name];
  if (!m) errs.push('no manifest entry for ' + j.name);
  else if (accept.includes(j.name) && norm(m.text) !== norm(j.parts.join(' '))) changed.push(j.name);
  else if (norm(m.text) !== norm(j.parts.join(' '))) errs.push(`TEXT MISMATCH ${j.name}\n  code:     ${j.parts.join(' ')}\n  manifest: ${m.text}`);
  else if (m.parts.length !== j.parts.length && !accept.includes(j.name)) errs.push('part count mismatch ' + j.name);
}
const generated = new Set(jobs.map(j => j.name)); // welcome + page-12 variants have no 'existing text' to compare against
for (const k of Object.keys(man)) if (!seen.has(k) && k !== 'scene12-seg1' && !generated.has(k)) errs.push('manifest entry not in code: ' + k);
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
fs.writeFileSync('narration-jobs.json', JSON.stringify(jobs, null, 1));
if (changed.length) console.log('wording changed on purpose (regenerate these):', changed.join(', '));
console.log(`${jobs.length} clips (${jobs.filter(j => j.parts.length > 1).length} multi-part, ${jobs.filter(j => j.variant).length} page-12 variants); wording matches manifest for all ${seen.size} existing clips`);
console.log(jobs.filter(j => j.variant).map(j => j.parts[0]).join('\n'));
