// Install generated clips (./out) into ../../audio and rewrite audio/manifest.json with real durations + part offsets.
// Durations come from the DECODED mp3 (macOS afinfo), so they include the encoder delay; later part offsets are shifted by the same delay.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const audio = path.resolve(import.meta.dirname, '../../audio');
const jobs = JSON.parse(fs.readFileSync('narration-jobs.json', 'utf8')), meta = JSON.parse(fs.readFileSync('out/meta.json', 'utf8'));
const decoded = (f) => +execFileSync('afinfo', [f], { encoding: 'utf8' }).match(/estimated duration: ([\d.]+)/)[1];
const manifest = {}, problems = [];
const key = (n) => { const m = n.match(/^scene(\d+)-seg(\d+)(?:-(.*))?$/); return [+m[1], +m[2], m[3] || '']; };
for (const j of jobs.slice().sort((a, b) => { const x = key(a.name), y = key(b.name); return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2]); })) {
  const f = path.join('out', j.name + '.mp3'), m = meta[j.name];
  if (!fs.existsSync(f) || !m) { problems.push('missing ' + j.name); continue; }
  const dur = decoded(f), delay = +(dur - m.duration).toFixed(3);
  if (delay < 0 || delay > 0.12) problems.push(`${j.name}: unexpected encoder delay ${delay}s`);
  manifest[j.name] = { duration: +dur.toFixed(3), parts: m.parts.map((p, i) => (i ? +(p + delay).toFixed(3) : 0)), text: m.text };
  fs.copyFileSync(f, path.join(audio, j.name + '.mp3'));
}
manifest['scene12-seg1'] = { dynamic: true, note: 'text depends on the learner\'s Page 3 answer; pre-rendered variants are scene12-seg1-<approach>-<reason 0-2> and scene12-seg1-none; a self-typed reason falls back to Web Speech', variants: jobs.filter(j => j.variant).map(j => j.name) };
const ordered = Object.fromEntries(Object.entries(manifest).sort((a, b) => { const x = key(a[0]), y = key(b[0]); return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2]); }));
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
fs.writeFileSync(path.join(audio, 'manifest.json'), JSON.stringify(ordered, null, 1) + '\n');
console.log(`installed ${jobs.length} clips + manifest into ${audio}`);
