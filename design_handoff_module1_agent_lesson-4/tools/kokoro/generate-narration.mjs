// Generate all course narration with Kokoro (kokoro-js, af_heart, speed 0.95, q8/CPU) → +1.5 semitone pitch shift
// (SoundTouch, tempo preserved) → speech-RMS loudness match to approved sample B → MP3. Writes to ./out (staging).
// Usage: node extract-narration.mjs && node generate-narration.mjs [--only scene1-seg1,scene2-seg3]
import fs from 'node:fs'; import path from 'node:path';
import { KokoroTTS } from 'kokoro-js';
import lamejs from '@breezystack/lamejs';
import { readWav, pitchShift, lag, peak } from './fx.mjs';

const VOICE = 'af_heart', SPEED = 0.95, SEMIS = 1.5, GAP_S = 0.24; // gap between PARTS of one segment (same as the Piper build)
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const jobs = JSON.parse(fs.readFileSync('narration-jobs.json', 'utf8')).filter(j => !only || only.includes(j.name));
fs.mkdirSync('out', { recursive: true });

// loudness measured on speech only (frames above -34 dBFS), target = approved sample B
const speechRms = (x, sr) => { const w = Math.round(sr * 0.02); let s = 0, n = 0; for (let i = 0; i + w <= x.length; i += w) { let e = 0; for (let j = 0; j < w; j++) e += x[i + j] ** 2; e /= w; if (Math.sqrt(e) > 0.02) { s += e; n++; } } return Math.sqrt(s / Math.max(1, n)); };
const B = readWav('heart-B-plus1.5st.wav'); const TARGET = speechRms(B.x, B.sr);
console.log(`loudness target (speech RMS of sample B): ${(20 * Math.log10(TARGET)).toFixed(2)} dBFS`);

function mp3(x, sr) {
  const enc = new lamejs.Mp3Encoder(1, sr, 96), out = [], pcm = Int16Array.from(x, v => Math.round(Math.max(-1, Math.min(1, v)) * 32767));
  for (let i = 0; i < pcm.length; i += 1152) { const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) out.push(Buffer.from(b)); }
  const f = enc.flush(); if (f.length) out.push(Buffer.from(f)); return Buffer.concat(out);
}

const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
const meta = {}; const t0 = Date.now(); let n = 0;
for (const j of jobs) {
  const sr0 = 24000, chunks = [], offs = []; let len = 0;
  for (let k = 0; k < j.parts.length; k++) {
    if (k) { const g = new Float32Array(Math.round(GAP_S * sr0)); chunks.push(g); len += g.length; }
    const a = await tts.generate(j.parts[k], { voice: VOICE, speed: SPEED });
    if (a.sampling_rate !== sr0) throw new Error('unexpected sample rate ' + a.sampling_rate);
    offs.push(len / sr0); chunks.push(a.audio); len += a.audio.length;
  }
  const x = new Float32Array(len); let o = 0; for (const c of chunks) { x.set(c, o); o += c.length; }
  const raw = pitchShift(x, sr0, SEMIS), l = lag(x, raw, sr0);       // identical processing to sample B
  let y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) y[i] = raw[i + l] || 0;
  let g = TARGET / speechRms(y, sr0), limited = false;
  if (peak(y) * g > 0.97) { g = 0.97 / peak(y); limited = true; }
  y = y.map(v => v * g);
  fs.writeFileSync(path.join('out', j.name + '.mp3'), mp3(y, sr0));
  meta[j.name] = { duration: +(y.length / sr0).toFixed(3), parts: offs.map(v => +v.toFixed(3)), text: j.parts.join(' '), gainDb: +(20 * Math.log10(g)).toFixed(2), limited, srcSeconds: +(x.length / sr0).toFixed(3) };
  console.log(`${++n}/${jobs.length} ${j.name} ${meta[j.name].duration}s gain ${meta[j.name].gainDb} dB${limited ? ' (peak-limited)' : ''}`);
}
const prev = fs.existsSync('out/meta.json') && only ? JSON.parse(fs.readFileSync('out/meta.json', 'utf8')) : {};
fs.writeFileSync('out/meta.json', JSON.stringify({ ...prev, ...meta }, null, 1));
console.log(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
