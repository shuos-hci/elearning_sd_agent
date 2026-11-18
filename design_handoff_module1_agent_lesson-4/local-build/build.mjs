// Builds ../Module1-local.html : one self-contained file (React, compiled JSX, CSS, audio, Milo art all inlined).
// Usage:  cd local-build && npm install && npm run build      (re-run after editing anything in ../frontend)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import babel from '@babel/core';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const fe = path.join(root, 'frontend');
const read = (p) => fs.readFileSync(p, 'utf8');
const b64 = (p) => fs.readFileSync(p).toString('base64');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');

// 1. audio + manifest + teacher art -> inline data
const audioDir = path.join(root, 'audio');
const audio = {};
for (const f of fs.readdirSync(audioDir).filter((f) => f.endsWith('.mp3')))
  audio[f.replace(/\.mp3$/, '')] = 'data:audio/mpeg;base64,' + b64(path.join(audioDir, f));
const manifest = JSON.parse(read(path.join(audioDir, 'manifest.json')));
const milo = {};
for (const p of ['base', 'arm-left', 'arm-right']) // Milo layers (frontend/milo.jsx reads window.__BYA_INLINE__.milo)
  milo[p] = 'data:image/png;base64,' + b64(path.join(root, 'assets/milo', p + '.png'));

const inlineData = `window.__BYA_INLINE__ = ${JSON.stringify({ audio, manifest, milo })};`;

// 2. compile JSX (same load order as frontend/index.html), patching asset lookups to the inline data
const order = ['core', 'milo', 'narrator', 'pages-a', 'pages-b', 'pages-c', 'app'];
const compiled = order.map((n) => {
  let src = read(path.join(fe, n + '.jsx'));
  if (n === 'narrator') {
    src = src
      .replace(/fetch\(AUDIO_DIR \+ 'manifest\.json'.*\n/, "st.manifest = (window.__BYA_INLINE__ || {}).manifest || null;\n")
      .replace("const src = AUDIO_DIR + fileName(st.si) + '.mp3';", "const src = ((window.__BYA_INLINE__ || {}).audio || {})[fileName(st.si)] || (AUDIO_DIR + fileName(st.si) + '.mp3');");
  }
  return babel.transformSync(src, { presets: ['@babel/preset-react'], filename: n + '.jsx', compact: false }).code;
});

// 3. assemble
const req = (m) => path.join(here, 'node_modules', m);
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Build Your First AI Agent — Module 1 (local)</title>
<style>
${read(path.join(fe, 'styles.css'))}
</style>
</head>
<body>
<div id="root"></div>
<script>${safe(inlineData)}</script>
<script>${safe(read(path.join(fe, 'config.js')))}</script>
<script>${safe(read(path.join(fe, 'analytics.js')))}</script>
<script>${safe(read(req('react/umd/react.production.min.js')))}</script>
<script>${safe(read(req('react-dom/umd/react-dom.production.min.js')))}</script>
${compiled.map((c) => `<script>\n${safe(c)}\n</script>`).join('\n')}
</body>
</html>`;
const out = path.join(root, 'Module1-local.html');
fs.writeFileSync(out, html);
console.log('wrote', out, (html.length / 1048576).toFixed(2) + ' MB');
