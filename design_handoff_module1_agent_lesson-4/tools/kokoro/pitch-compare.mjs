// Pitch-shift comparison: A original, B +1.5 st, C +2.5 st. Duration/tempo preserved (SoundTouch time-stretch + resample),
// all outputs RMS-matched to A. No robotic effects. Usage: node pitch-compare.mjs [input.wav]
import { readWav, writeWav16, rms, peak, pitchShift, lag } from './fx.mjs';

const inFile = process.argv[2] || 'sample-af_heart-0.95.wav';
const { x, sr } = readWav(inFile);
const target = rms(x), report = [];
for (const [tag, semis] of [['A-original', 0], ['B-plus1.5st', 1.5], ['C-plus2.5st', 2.5]]) {
  let y;
  if (semis === 0) y = Float32Array.from(x);
  else {
    const raw = pitchShift(x, sr, semis), l = lag(x, raw, sr);
    y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) y[i] = raw[i + l] || 0;
    report.push(`  (processing latency removed: ${(l / sr * 1000).toFixed(0)} ms)`);
  }
  let g = target / rms(y); if (peak(y) * g > 0.97) g = 0.97 / peak(y); // keep headroom
  y = y.map(v => v * g);
  const f = `heart-${tag}.wav`; writeWav16(f, y, sr);
  report.unshift(`${f}: ${(y.length / sr).toFixed(3)}s  RMS ${(20 * Math.log10(rms(y))).toFixed(1)} dBFS  peak ${(20 * Math.log10(peak(y))).toFixed(1)} dBFS`);
}
console.log(report.join('\n'));
