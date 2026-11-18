/* ---------------- Narrator (Round 2) ----------------
   Primary source: pre-generated Piper audio files, one per narration segment:
     audio/scene<N>-seg<M>.mp3      (N = page number 1–13, M = segment number from 1)
   audio/manifest.json (optional) gives each segment's duration and the start time of each PART,
   so the teacher can point at each part's element while the file plays.
   Fallback: if a file is missing or fails, the SAME segment is spoken with the Web Speech API
   (most natural en-US voice, rate 0.9, sentence/clause chunking with short pauses). Never silent.

   A page's narration is a list of SEGMENTS: { t, hl, key? } or { parts: [{ t, hl }], key? } or { ..., dyn: true }
   (dyn = text built at runtime, e.g. Page 12 recall of the learner's own choice → spoken by Web Speech, unless the segment
   also names a pre-rendered file with `audio`; if that file is missing it falls back to Web Speech as usual). */
const EMPHASIS = ['who decides', 'who determines', 'not an agent', 'not simply', 'none of those'];
function chunkText(text) {
  const out = [];
  const sentences = text.match(/[^.!?]+(?:[.!?]+["'”’)]*|$)/g) || [text];
  sentences.forEach((s) => {
    s = s.trim(); if (!s) return;
    const clauses = s.split(/(?<=[—:;])\s+|\s+(?=—)/).map(c => c.trim()).filter(Boolean);
    clauses.forEach((c, ci) => {
      const endPause = ci < clauses.length - 1 ? 220 : 290;
      const lc = c.toLowerCase();
      let cut = -1;
      for (const k of EMPHASIS) { const i = lc.indexOf(k); if (i > 8) { cut = i; break; } }
      const pieces = cut > 0 ? [[c.slice(0, cut).trim(), 160], [c.slice(cut).trim(), endPause]] : [[c, endPause]];
      pieces.forEach(([t, pause]) => {
        t = t.replace(/^—\s*/, '').trim();
        if (!t || t === '—') return;
        out.push({ text: t, pause });
      });
    });
  });
  return out;
}
function normSeg(s) {
  if (typeof s === 'string') return { parts: [{ t: s }] };
  if (s.parts) return s;
  return { ...s, parts: [{ t: s.t, hl: s.hl }] };
}
const AUDIO_DIR = 'audio/';
/* Narration pace: the prerecorded clips (Kokoro af_heart, speed 0.95, +1.5 st) play at 1.08× with pitch preserved — no second speed-up
   at synthesis. Everything that follows the audio uses media time (currentTime / part offsets from manifest.json), so captions, reveals,
   Milo's gestures and mouth stay in sync; the few wall-clock pieces (pauses between segments, silent-mode timers, Web Speech) use PACE. */
const PLAYBACK_RATE = 1.08;
const PACE = PLAYBACK_RATE;
const TTS_RATE = +(0.9 * PACE).toFixed(2); // Web Speech fallback: same slight speed-up (0.9 → ~0.97)

function createNarrator() {
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  const st = {
    segs: [], scene: 0, si: 0, pi: 0, status: 'idle', audio: true, token: 0, timers: [], voice: null,
    stopAt: null, mode: null, failed: {}, manifest: null, el: null, raf: 0,
    speaking: false, blocked: false, disabled: false, endAt: null, rangeFrom: 0, ctx: null, an: null, anBuf: null, anFailed: false,
  };
  const listeners = new Set();
  const seg = () => st.segs[Math.min(st.si, st.segs.length - 1)];
  const snap = () => {
    const s = seg();
    const p = s && s.parts[Math.min(st.pi, s.parts.length - 1)];
    const live = st.status === 'playing' || st.status === 'paused';
    return {
      status: st.status, seg: st.si, part: st.pi, segCount: st.segs.length, audio: st.audio, scene: st.scene,
      hl: live && p ? (p.hl || s.hl || null) : null,
      caption: live && s ? s.parts.map(x => x.t).join(' ') : '',
      source: st.mode, voice: st.voice ? st.voice.name : null,
      speaking: st.speaking, blocked: st.blocked, // speaking = audio is ACTUALLY audible right now; blocked = the browser refused autoplay
    };
  };
  const emit = () => { const s = snap(); listeners.forEach(f => f(s)); };
  const setSpeaking = (v) => { v = !!v; if (st.speaking !== v) { st.speaking = v; emit(); } };
  /* one shared <audio>; its events tell us whether sound is really playing (drives Milo's mouth) */
  function ensureEl() {
    if (!st.el) {
      const a = st.el = new Audio();
      const upd = () => setSpeaking(st.mode === 'file' && st.status === 'playing' && st.audio && !a.muted && !!a.src && !a.paused && !a.ended && a.readyState > 2);
      ['playing', 'pause', 'ended', 'waiting', 'stalled', 'emptied', 'error', 'seeking', 'timeupdate'].forEach(ev => a.addEventListener(ev, upd));
    }
    return st.el;
  }
  /* optional loudness meter (only when an AudioContext is already allowed to run; otherwise the mouth uses a gated cycle) */
  function ensureAnalyser(a) {
    if (st.an || st.anFailed) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { st.anFailed = true; return; }
      if (!st.ctx) st.ctx = new AC();
      if (st.ctx.state !== 'running') return; // never route the element through a suspended context (it would be silent)
      const src = st.ctx.createMediaElementSource(a), an = st.ctx.createAnalyser();
      an.fftSize = 512; src.connect(an); an.connect(st.ctx.destination); st.an = an; st.anBuf = new Uint8Array(an.fftSize);
    } catch (e) { st.anFailed = true; }
  }
  function block(my) { // autoplay refused: do NOT fall back to silent timers or Web Speech and pretend it is playing
    if (my !== st.token) return;
    hardStop(); st.blocked = true; st.status = 'blocked'; st.speaking = false; st.mode = null; emit();
  }

  /* ---- Web Speech fallback voice (Fix 1 rule) ---- */
  const PREFERRED = ['Microsoft Aria', 'Microsoft Jenny', 'Microsoft Ava', 'Microsoft Emma', 'Microsoft Michelle', 'Google US English', 'Samantha', 'Ava (Premium)', 'Zoe (Premium)', 'Ava (Enhanced)', 'Allison', 'Microsoft Zira', 'Microsoft Guy', 'Alex'];
  const ROBOTIC = /(espeak|compact|fred|albert|zarvox|trinoids|whisper|bad news|bells|boing|bubbles|cellos|deranged|hysterical|junior|ralph|kathy|princess|organ|superstar|wobble|jester|grandma|grandpa|rocko|shelley|flo|eddy|reed|sandy)/i;
  function pickVoice() {
    if (!synth) return null;
    const vs = synth.getVoices();
    if (!vs.length) return null;
    const us = vs.filter(v => /^en[-_]US/i.test(v.lang) && !ROBOTIC.test(v.name));
    const natural = us.filter(v => /natural|neural/i.test(v.name));
    if (natural.length) {
      for (const p of PREFERRED) { const v = natural.find(v => v.name.includes(p)); if (v) return v; }
      return natural[0];
    }
    for (const p of PREFERRED) { const v = us.find(v => v.name.includes(p)); if (v) return v; }
    const premium = us.find(v => /premium|enhanced|online/i.test(v.name));
    return premium || us.find(v => !v.localService) || us[0] || vs.find(v => /^en/i.test(v.lang)) || null;
  }
  if (synth) {
    st.voice = pickVoice();
    synth.addEventListener && synth.addEventListener('voiceschanged', () => { st.voice = pickVoice(); });
  }

  /* ---- manifest (part timings) ---- */
  try {
    fetch(AUDIO_DIR + 'manifest.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).then(j => { st.manifest = j; }).catch(() => {});
  } catch (e) {}

  const est = (t) => Math.max(700, (t.split(/\s+/).length * 370) / PACE);
  const clearTimers = () => { st.timers.forEach(clearTimeout); st.timers = []; cancelAnimationFrame(st.raf); };
  // a segment may name its own file via `audio` (used for pre-rendered variants of dynamic text, e.g. Page 12)
  const fileName = (i) => (st.segs[i] && st.segs[i].audio) || `scene${st.scene}-seg${i + 1}`;
  function hardStop() {
    st.token++; clearTimers(); st.speaking = false;
    if (synth) { try { synth.cancel(); } catch (e) {} }
    if (st.el) { try { st.el.onended = st.el.onerror = null; st.el.pause(); } catch (e) {} }
  }
  function afterSeg(my) {
    const s = st.segs[st.si];
    st.timers.push(setTimeout(() => { if (my !== st.token) return; startSeg(st.si + 1); }, (s && s.key ? 760 : 520) / PACE));
  }
  function setPart(i) { if (i !== st.pi) { st.pi = i; emit(); } }

  /* ---- timer mode (sound off): visuals still progress ---- */
  function playTimer(my) {
    st.mode = 'silent';
    const s = st.segs[st.si];
    let t = 0;
    s.parts.forEach((p, i) => {
      st.timers.push(setTimeout(() => { if (my === st.token) setPart(i); }, t));
      t += est(p.t) + 240 / PACE;
    });
    st.timers.push(setTimeout(() => { if (my === st.token) afterSeg(my); }, t - 240 / PACE));
  }

  /* ---- Web Speech fallback for one segment ---- */
  function playTTS(my) {
    st.mode = 'tts';
    const s = st.segs[st.si];
    if (!synth) { playTimer(my); return; }
    if (!st.voice) st.voice = pickVoice();
    const q = [];
    s.parts.forEach((p, pi) => chunkText(p.t).forEach((c, ci, arr) => q.push({ ...c, pi, lastOfPart: ci === arr.length - 1 })));
    let k = 0;
    const speakNext = () => {
      if (my !== st.token) return;
      if (k >= q.length) { afterSeg(my); return; }
      const c = q[k];
      setPart(c.pi);
      const u = new SpeechSynthesisUtterance(c.text);
      if (st.voice) { u.voice = st.voice; u.lang = st.voice.lang; } else u.lang = 'en-US';
      u.rate = TTS_RATE; u.pitch = 1.0;
      let done = false;
      const fin = () => { if (done || my !== st.token) return; done = true; setSpeaking(false); k++; st.timers.push(setTimeout(speakNext, k >= q.length ? 0 : c.lastOfPart ? 240 : c.pause)); };
      u.onstart = () => { if (my === st.token) setSpeaking(true); };
      u.onend = fin;
      u.onerror = (e) => { if (e && (e.error === 'interrupted' || e.error === 'canceled')) return; if (e && e.error === 'not-allowed') { block(my); return; } setSpeaking(false); st.timers.push(setTimeout(fin, est(c.text))); };
      try { synth.resume(); } catch (e) {}
      synth.speak(u);
      st.timers.push(setTimeout(function watch() { if (done || my !== st.token) return; if (synth.speaking || synth.pending) st.timers.push(setTimeout(watch, 1200)); else fin(); }, est(c.text) * 1.6 + 2200));
    };
    speakNext();
  }

  /* ---- file mode: HTML5 audio ---- */
  function partOffsets(s, dur) {
    const m = st.manifest && st.manifest[fileName(st.si)];
    if (m && Array.isArray(m.parts) && m.parts.length === s.parts.length) return m.parts;
    const words = s.parts.map(p => p.t.split(/\s+/).length);
    const tot = words.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    return words.map(w => { const o = (acc / tot) * (dur || 0); acc += w; return o; });
  }
  function playFile(my, resume) {
    st.mode = 'file';
    const s = st.segs[st.si];
    const a = ensureEl();
    ensureAnalyser(a);
    const src = AUDIO_DIR + fileName(st.si) + '.mp3';
    let failed = false;
    const fail = () => {
      if (failed || my !== st.token) return; failed = true;
      st.failed[st.scene + ':' + st.si] = true;
      try { a.pause(); } catch (e) {}
      playTTS(my);
    };
    a.onerror = fail;
    a.onended = () => { if (my !== st.token) return; setSpeaking(false); cancelAnimationFrame(st.raf); setPart(s.parts.length - 1); afterSeg(my); };
    if (!resume || !a.src || !a.src.endsWith(src)) { a.src = src; a.currentTime = 0; }
    a.defaultPlaybackRate = PLAYBACK_RATE; a.playbackRate = PLAYBACK_RATE; // (a new src resets to defaultPlaybackRate)
    a.preservesPitch = true; a.mozPreservesPitch = true; a.webkitPreservesPitch = true; // keep the voice pitch at the faster rate
    const p = a.play();
    if (p && p.catch) p.catch((e) => { if (e && e.name === 'AbortError') return; if (e && e.name === 'NotAllowedError') { block(my); return; } fail(); });
    // a stalled network request must not leave the page silent
    st.timers.push(setTimeout(() => { if (my === st.token && a.currentTime === 0 && !a.ended) fail(); }, 6000));
    const tick = () => {
      if (my !== st.token) return;
      if (s.parts.length > 1) {
        const offs = partOffsets(s, a.duration);
        let i = 0; offs.forEach((o, j) => { if (a.currentTime >= o - 0.05) i = j; });
        setPart(i);
      }
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
  }

  function startSeg(i, resume = false) {
    if (st.disabled) return; // Caption Only: nothing may ever speak or run on timers
    // 'ended' = the whole narration finished OR the requested paragraph range finished (the app then waits for the learner)
    if (i >= st.segs.length || (st.endAt != null && i >= st.endAt)) { st.status = 'ended'; st.stopAt = null; st.mode = null; st.speaking = false; emit(); return; }
    if (st.stopAt != null && i !== st.stopAt) { st.si = st.stopAt; st.stopAt = null; st.status = 'paused'; st.pi = 0; emit(); return; }
    hardStop();
    const my = st.token; st.blocked = false;
    st.si = i; if (!resume) st.pi = 0;
    st.status = 'playing'; emit();
    const s = st.segs[i];
    if (!st.audio) playTimer(my);
    else if ((s.dyn && !s.audio) || st.failed[st.scene + ':' + i]) playTTS(my);
    else playFile(my, resume);
  }

  return {
    subscribe(f) { listeners.add(f); return () => listeners.delete(f); },
    supported: true,
    unlock() {
      if (st.disabled) return;
      try { ensureEl(); st.el.muted = true; const p = st.el.play(); if (p && p.catch) p.catch(() => {}); st.el.pause(); st.el.muted = false; } catch (e) {}
      try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { if (!st.ctx) st.ctx = new AC(); if (st.ctx.state === 'suspended') st.ctx.resume(); } } catch (e) {}
      if (synth) { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } catch (e) {} }
    },
    load(segs, scene) { if (st.disabled) return; hardStop(); st.scene = scene; st.segs = segs.map(normSeg); st.si = 0; st.pi = 0; st.stopAt = null; st.endAt = null; st.rangeFrom = 0; startSeg(0); },
    // paragraph mode: load a page's segments WITHOUT playing, update them in place (feedback paragraphs appear), and play one range
    prepare(segs, scene) { hardStop(); st.scene = scene; st.segs = segs.map(normSeg); st.si = 0; st.pi = 0; st.stopAt = null; st.endAt = null; st.status = 'idle'; st.blocked = false; st.mode = null; emit(); },
    setSegs(segs) { st.segs = segs.map(normSeg); },
    playRange(from, to) { if (st.disabled || from < 0 || from >= st.segs.length) return; hardStop(); st.stopAt = null; st.rangeFrom = from; st.endAt = Math.min(to + 1, st.segs.length); startSeg(from); },
    // Caption Only switches the whole narrator off: stops audio + speech + timers and refuses to start anything until re-enabled
    setEnabled(on) { st.disabled = !on; if (!on) { hardStop(); st.status = 'idle'; st.blocked = false; st.mode = null; st.speaking = false; emit(); } },
    get enabled() { return !st.disabled; },
    append(segs) { if (segs && segs.length) st.segs = st.segs.concat(segs.map(normSeg)); },
    play() {
      if (st.disabled || st.status === 'playing') return;
      st.stopAt = null;
      if (st.status === 'ended' || st.status === 'idle' || st.status === 'blocked') { startSeg(st.status === 'blocked' ? st.si : st.rangeFrom); return; }
      startSeg(st.si, st.mode === 'file');
    },
    pause() { if (st.status !== 'playing') return; hardStop(); st.status = 'paused'; emit(); },
    replay() { if (st.disabled) return; st.stopAt = null; startSeg(st.rangeFrom); },
    playSeg(i) { if (i < 0 || i >= st.segs.length) return; st.stopAt = i; startSeg(i); },
    segOfHl(key) { return st.segs.findIndex(s => s.parts.some(p => (p.hl || s.hl) === key)); },
    hlMap() { // hl → [segIndex, partIndex] of its first mention
      const m = {};
      st.segs.forEach((s, si) => s.parts.forEach((p, pi) => { const k = p.hl || s.hl; if (k && !(k in m)) m[k] = [si, pi]; }));
      return m;
    },
    stop(scene) { hardStop(); if (scene != null) { st.scene = scene; st.segs = []; st.si = 0; st.pi = 0; } st.status = 'idle'; st.blocked = false; emit(); },
    setAudio(on) { if (st.disabled) { st.audio = on; return; } const wasPlaying = st.status === 'playing' || (st.status === 'blocked' && !on); hardStop(); st.audio = on; if (wasPlaying) startSeg(st.si); else emit(); },
    level() { // 0..1 loudness of what is playing now, or null when no meter is available (Web Speech / suspended context)
      if (!st.an || !st.speaking) return null;
      st.an.getByteTimeDomainData(st.anBuf); let s = 0; for (let i = 0; i < st.anBuf.length; i++) { const v = (st.anBuf[i] - 128) / 128; s += v * v; }
      return Math.sqrt(s / st.anBuf.length);
    },
    get state() { return snap(); },
  };
}
window.createNarrator = createNarrator;
