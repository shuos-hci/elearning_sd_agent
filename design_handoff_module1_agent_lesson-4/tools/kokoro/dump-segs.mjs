// Dev helper: prints every page's narration segments (index, key, parts) from the real page definitions.
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { createRequire } from 'node:module';
const root = path.resolve(import.meta.dirname, '../..'), fe = path.join(root, 'frontend'); const req = createRequire(path.join(root, 'local-build/package.json'));
const babel = req('@babel/core'), React = req('react');
const ctx = vm.createContext({ React, console, setTimeout, clearTimeout, requestAnimationFrame: () => 0, cancelAnimationFrame() {}, ResizeObserver: class {}, MutationObserver: class {}, document: { getElementById: () => null, addEventListener() {}, querySelectorAll: () => [] }, navigator: {}, localStorage: { getItem: () => null, setItem() {} }, sessionStorage: { getItem: () => null, setItem() {} } });
ctx.window = ctx; ctx.addEventListener = () => {}; ctx.matchMedia = () => ({ matches: false, addEventListener() {} });
['core', 'pages-a', 'pages-b', 'pages-c'].forEach(n => vm.runInContext(babel.transformSync(fs.readFileSync(path.join(fe, n + '.jsx'), 'utf8'), { presets: [req.resolve('@babel/preset-react')], filename: n }).code, ctx));
const P = vm.runInContext('PAGES', ctx);
P.forEach((pg, i) => { console.log(`\n== p${i + 1} ${pg.id} "${pg.title}"`); pg.narration({ p3: { saved: { choice: 'agent', text: 'It seems simplest' } } }).forEach((s, k) => console.log(`  [${k}]${s.key ? ' KEY' : ''} ${s.parts ? 'parts: ' + s.parts.map(p => `(${p.hl}) ${p.t}`).join(' ‖ ') : `(${s.hl}) ${s.t}`}`)); });
