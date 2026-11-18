// Shared audio helpers (identical to the ones that produced approved sample B).
import fs from 'node:fs';
import { SoundTouch } from '@soundtouchjs/core';

export function readWav(p) { // float32 / int16 mono PCM
  const b = fs.readFileSync(p); const fmt = b.readUInt16LE(20), ch = b.readUInt16LE(22), sr = b.readUInt32LE(24), bits = b.readUInt16LE(34);
  let o = 12, data; while (o < b.length) { const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4); if (id === 'data') { data = b.subarray(o + 8, o + 8 + n); break; } o += 8 + n + (n & 1); }
  const f = fmt === 3 ? new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length)) : Float32Array.from({ length: data.length / 2 }, (_, i) => data.readInt16LE(i * 2) / 32768);
  if (ch !== 1) throw new Error('mono expected'); return { x: f, sr };
}
export function writeWav16(p, x, sr) {
  const b = Buffer.alloc(44 + x.length * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  fs.writeFileSync(p, b);
}
export const rms = (x) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
export const peak = (x) => x.reduce((a, v) => Math.max(a, Math.abs(v)), 0);

export function pitchShift(x, sr, semis) {
  const st = new SoundTouch({ sampleRate: sr });
  st.pitchSemitones = semis; st.tempo = 1; st.rate = 1;
  const pad = Math.round(sr * 0.5), total = x.length + pad;
  const out = []; const buf = new Float32Array(8192 * 2);
  const drain = () => { let n; while ((n = st.outputBuffer.frameCount) > 0) { const k = Math.min(n, 8192); st.outputBuffer.extract(buf, 0, k); st.outputBuffer.receive(k); for (let i = 0; i < k; i++) out.push(buf[2 * i]); } };
  for (let i = 0; i < total; i += 4096) {
    const k = Math.min(4096, total - i), c = new Float32Array(k * 2);
    for (let j = 0; j < k; j++) { const v = i + j < x.length ? x[i + j] : 0; c[2 * j] = c[2 * j + 1] = v; }
    st.inputBuffer.putSamples(c); st.process(); drain();
  }
  return Float32Array.from(out);
}
// envelope lag (ms) of y vs x, to remove the processing latency without changing tempo
export function lag(x, y, sr) {
  const hop = Math.round(sr * 0.005), env = (s) => Array.from({ length: Math.floor(s.length / hop) }, (_, i) => { let a = 0; for (let j = 0; j < hop; j++) a += s[i * hop + j] ** 2; return Math.sqrt(a / hop); });
  const ex = env(x), ey = env(y); let best = 0, bs = -1;
  for (let l = -20; l <= 60; l++) { let s = 0; for (let i = 0; i < ex.length; i++) s += ex[i] * (ey[i + l] || 0); if (s > bs) { bs = s; best = l; } }
  return best * hop;
}

