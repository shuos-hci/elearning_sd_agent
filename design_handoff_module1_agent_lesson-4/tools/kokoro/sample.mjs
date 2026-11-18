// Standalone sample generator: kokoro-js, voice af_heart, speed 0.95, free local inference (q8 ONNX, CPU).
import { KokoroTTS } from 'kokoro-js';
const TEXT = "Hi, welcome to the course! I’m Milo, your learning guide. Together, we’ll explore three ways to use AI—and learn how to choose the right one for your task. Ready? Let’s get started!";
const out = process.argv[2] || 'sample-af_heart-0.95.wav';
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
const audio = await tts.generate(TEXT, { voice: 'af_heart', speed: 0.95 });
await audio.save(out);
console.log('saved', out, (audio.audio.length / audio.sampling_rate).toFixed(2) + 's @' + audio.sampling_rate + 'Hz');
