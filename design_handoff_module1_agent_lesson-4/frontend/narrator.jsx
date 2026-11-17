/* ---------------- Narrator (Round 2) ----------------
   Primary source: pre-generated Piper audio files, one per narration segment:
     audio/scene<N>-seg<M>.mp3      (N = page number 1–13, M = segment number from 1)
   audio/manifest.json (optional) gives each segment's duration and the start time of each PART,
   so the teacher can point at each part's element while the file plays.
   Fallback: if a file is missing or fails, the SAME segment is spoken with the Web Speech API
   (most natural en-US voice, rate 0.9, sentence/clause chunking with short pauses). Never silent.

   A page's narration is a list of SEGMENTS: { t, hl, key? } or { parts: [{ t, hl }], key? } or { ..., dyn: true }
   (dyn = text built at runtime, e.g. Page 12 recall of the learner's own choice → always spoken by Web Speech). */
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

function createNarrator() {
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  const st = {
    segs: [], scene: 0, si: 0, pi: 0, status: 'idle', audio: true, token: 0, timers: [], voice: null,
    stopAt: null, mode: null, failed: {}, manifest: null, el: null, raf: 0,
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
    };
  };
  const emit = () => { const s = snap(); listeners.forEach(f => f(s)); };

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

  const est = (t) => Math.max(700, t.split(/\s+/).length * 370);
  const clearTimers = () => { st.timers.forEach(clearTimeout); st.timers = []; cancelAnimationFrame(st.raf); };
  const fileName = (i) => `scene${st.scene}-seg${i + 1}`;
  function hardStop() {
    st.token++; clearTimers();
    if (synth) { try { synth.cancel(); } catch (e) {} }
    if (st.el) { try { st.el.onended = st.el.onerror = null; st.el.pause(); } catch (e) {} }
  }
  function afterSeg(my) {
    const s = st.segs[st.si];
    st.timers.push(setTimeout(() => { if (my !== st.token) return; startSeg(st.si + 1); }, s && s.key ? 760 : 520));
  }
  function setPart(i) { if (i !== st.pi) { st.pi = i; emit(); } }

  /* ---- timer mode (sound off): visuals still progress ---- */
  function playTimer(my) {
    st.mode = 'silent';
    const s = st.segs[st.si];
    let t = 0;
    s.parts.forEach((p, i) => {
      st.timers.push(setTimeout(() => { if (my === st.token) setPart(i); }, t));
      t += est(p.t) + 240;
    });
    st.timers.push(setTimeout(() => { if (my === st.token) afterSeg(my); }, t - 240));
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
      u.rate = 0.9; u.pitch = 1.0;
      let done = false;
      const fin = () => { if (done || my !== st.token) return; done = true; k++; st.timers.push(setTimeout(speakNext, k >= q.length ? 0 : c.lastOfPart ? 240 : c.pause)); };
      u.onend = fin;
      u.onerror = (e) => { if (e && (e.error === 'interrupted' || e.error === 'canceled')) return; st.timers.push(setTimeout(fin, est(c.text))); };
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
    if (!st.el) st.el = new Audio();
    const a = st.el;
    const src = AUDIO_DIR + fileName(st.si) + '.mp3';
    let failed = false;
    const fail = () => {
      if (failed || my !== st.token) return; failed = true;
      st.failed[st.scene + ':' + st.si] = true;
      try { a.pause(); } catch (e) {}
      playTTS(my);
    };
    a.onerror = fail;
    a.onended = () => { if (my !== st.token) return; cancelAnimationFrame(st.raf); setPart(s.parts.length - 1); afterSeg(my); };
    if (!resume || !a.src || !a.src.endsWith(src)) { a.src = src; a.currentTime = 0; }
    a.playbackRate = 1;
    const p = a.play();
    if (p && p.catch) p.catch((e) => { if (e && e.name === 'AbortError') return; fail(); });
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
    if (i >= st.segs.length) { st.status = 'ended'; st.stopAt = null; st.mode = null; emit(); return; }
    if (st.stopAt != null && i !== st.stopAt) { st.si = st.stopAt; st.stopAt = null; st.status = 'paused'; st.pi = 0; emit(); return; }
    hardStop();
    const my = st.token;
    st.si = i; if (!resume) st.pi = 0;
    st.status = 'playing'; emit();
    const s = st.segs[i];
    if (!st.audio) playTimer(my);
    else if (s.dyn || st.failed[st.scene + ':' + i]) playTTS(my);
    else playFile(my, resume);
  }

  return {
    subscribe(f) { listeners.add(f); return () => listeners.delete(f); },
    supported: true,
    unlock() {
      try { if (!st.el) st.el = new Audio(); st.el.muted = true; const p = st.el.play(); if (p && p.catch) p.catch(() => {}); st.el.pause(); st.el.muted = false; } catch (e) {}
      if (synth) { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } catch (e) {} }
    },
    load(segs, scene) { hardStop(); st.scene = scene; st.segs = segs.map(normSeg); st.si = 0; st.pi = 0; st.stopAt = null; startSeg(0); },
    append(segs) {
      if (!segs || !segs.length) return;
      const start = st.segs.length;
      st.segs = st.segs.concat(segs.map(normSeg));
      if (st.status !== 'playing') { st.stopAt = null; startSeg(start); } else emit();
    },
    play() {
      if (st.status === 'playing') return;
      st.stopAt = null;
      if (st.status === 'ended' || st.status === 'idle') { startSeg(0); return; }
      startSeg(st.si, st.mode === 'file');
    },
    pause() { if (st.status !== 'playing') return; hardStop(); st.status = 'paused'; emit(); },
    replay() { st.stopAt = null; startSeg(0); },
    playSeg(i) { if (i < 0 || i >= st.segs.length) return; st.stopAt = i; startSeg(i); },
    segOfHl(key) { return st.segs.findIndex(s => s.parts.some(p => (p.hl || s.hl) === key)); },
    hlMap() { // hl → [segIndex, partIndex] of its first mention
      const m = {};
      st.segs.forEach((s, si) => s.parts.forEach((p, pi) => { const k = p.hl || s.hl; if (k && !(k in m)) m[k] = [si, pi]; }));
      return m;
    },
    stop(scene) { hardStop(); if (scene != null) { st.scene = scene; st.segs = []; st.si = 0; st.pi = 0; } st.status = 'idle'; emit(); },
    setAudio(on) { const wasPlaying = st.status === 'playing'; hardStop(); st.audio = on; if (wasPlaying) startSeg(st.si); else emit(); },
    get state() { return snap(); },
  };
}
window.createNarrator = createNarrator;
