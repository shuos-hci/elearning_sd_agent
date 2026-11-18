/* App shell (Round 2): start screen, header + progress, narration controls, top-right sound/CC toggles,
   staged reveal + Milo (content highlights instead of pointing), Scene 2 onboarding, captions,
   navigation gating, fit-to-viewport, analytics hooks. */
const PHASES = ['Hook', 'Learn', 'Compare', 'Practice', 'Reflect'];
const LS_KEY = 'bya-m1-v3';
const SS_KEY = 'bya-m1-session'; // per-session prefs: { audio, cc, onboarded }

/* A saved record is only used if it is structurally valid (page index in range, plain-object state) — otherwise it is ignored. */
function loadSaved() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY));
    const obj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
    if (!obj(raw) || !Number.isInteger(raw.idx) || raw.idx < 0 || raw.idx >= PAGES.length || !obj(raw.state) || !obj(raw.seen) || !obj(raw.maxSeg)) return null;
    return { idx: raw.idx, state: raw.state, seen: raw.seen, maxSeg: raw.maxSeg, para: obj(raw.para) ? raw.para : {}, rev: obj(raw.rev) ? raw.rev : {}, version: raw.version === 'A' || raw.version === 'B' ? raw.version : null, attempt: typeof raw.attempt === 'string' && raw.attempt ? raw.attempt : null }; // para = current explanation paragraph per page, rev = revealed-through segment per page
  } catch (e) { return null; }
}
/* "Continue" is offered only when the record shows real progress: a later page, any answer, a visited page (even page 1) or narration progress.
   (The app writes an empty record on every load, so the mere existence of a record is not progress.) */
function hasSavedProgress(s) {
  return !!s && (s.idx > 0 || Object.keys(s.state).length > 0 || Object.keys(s.seen).some(k => s.seen[k]) || Object.keys(s.maxSeg).some(k => s.maxSeg[k] > 0));
}
function loadSess() { try { return JSON.parse(sessionStorage.getItem(SS_KEY)) || {}; } catch (e) { return {}; } }
function saveSess(p) { try { sessionStorage.setItem(SS_KEY, JSON.stringify({ ...loadSess(), ...p })); } catch (e) {} }
const track = (...a) => { try { window.Track && window.Track.event(...a); } catch (e) {} };

/* ---------- Fit page content to the viewport (no vertical scroll) ---------- */
function useFitToStage(stageRef, fitRef, innerRef, key) {
  useLayoutEffect(() => {
    const stage = stageRef.current, fit = fitRef.current, inner = innerRef.current;
    if (!stage || !fit || !inner) return;
    let raf = 0;
    let s = 1;
    const apply = (v) => {
      s = v;
      inner.style.width = `calc(100% / ${v})`;
      inner.style.transform = `translateX(-50%) scale(${v})`;
    };
    apply(1);
    const MIN = 0.8;
    const run = () => {
      const cs = getComputedStyle(stage);
      const avail = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2;
      const h = inner.offsetHeight;
      let target = window.innerWidth >= 1100 ? Math.max(MIN, Math.min(1, avail / h)) : 1;
      if (target < s - 0.004 || target > s * 1.025 || (target === 1 && s !== 1 && avail / h >= 1)) apply(target);
      fit.style.height = Math.ceil(inner.offsetHeight * s) + 'px';
      fit.dataset.scale = s.toFixed(3);
    };
    const schedule = () => { run(); cancelAnimationFrame(raf); raf = requestAnimationFrame(run); };
    const late = [120, 500, 1200].map(t => setTimeout(run, t));
    run();
    const ro = new ResizeObserver(schedule);
    ro.observe(inner.firstElementChild || inner);
    ro.observe(stage);
    window.addEventListener('resize', schedule);
    return () => { ro.disconnect(); window.removeEventListener('resize', schedule); cancelAnimationFrame(raf); late.forEach(clearTimeout); };
  }, [key]);
}

/* ---------- Caption preference (Version A; remembered across visits). The version itself lives in the attempt record, see loadSaved ---------- */
const PREF_KEY = 'bya-m1-prefs'; // { cc: boolean } — Version A only: captions default to on, then remember the learner's choice
function loadPrefs() { try { const p = JSON.parse(localStorage.getItem(PREF_KEY)); return { cc: p && typeof p.cc === 'boolean' ? p.cc : true }; } catch (e) { return { cc: true }; } }
function savePrefs(p) { try { localStorage.setItem(PREF_KEY, JSON.stringify({ ...loadPrefs(), ...p })); } catch (e) {} }

/* ---------- Explanation paragraphs ----------
   page.paras groups the page's narration segments (contiguous index ranges, by meaning) and names each paragraph's main target.
   Segments flagged `fb` (feedback derived from page state) are appended as their own paragraph. Both modes use these boundaries. */
const segKey = (s) => s.hl || (s.parts && s.parts[0] && s.parts[0].hl) || null;
const segText = (s) => (s.parts ? s.parts.map(p => p.t).join(' ') : s.t);
function buildParas(page, segs) {
  const base = segs.filter(s => !s.fb).length;
  const out = (page.paras && page.paras.length ? page.paras.map(p => ({ first: p.s[0], last: p.s[1], main: p.main })) : segs.slice(0, base).map((s, i) => ({ first: i, last: i, main: segKey(s) })));
  for (let i = base; i < segs.length;) { let j = i; while (j + 1 < segs.length && segs[j + 1].fb) j++; out.push({ first: i, last: j, main: segKey(segs[i]), fb: true }); i = j + 1; }
  return out.map(p => ({ ...p, text: segs.slice(p.first, p.last + 1).map(segText).join(' ') }));
}

/* ---------- Version selection (A/B study): shown once, before anything else — before any welcome narration ----------
   Version A = narration (captions optional); Version B = silent reading with captions. Participant-facing text stays neutral:
   only "Version A" / "Version B" are shown. The choice is locked for the attempt and saved with the progress. */
function VersionGate({ onConfirm }) {
  const [sel, setSel] = useState(null);
  const onKey = (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const n = e.currentTarget.dataset.version === 'A' ? 'B' : 'A'; setSel(n); const b = e.currentTarget.parentElement.querySelector(`[data-version="${n}"]`); b && b.focus(); } };
  return (
    <div className="vg" data-screen-label="00 Version">
      <div className="vg-ring vg-ring-tl" aria-hidden="true" /><div className="vg-ring vg-ring-br" aria-hidden="true" />
      <main className="vg-card">
        <h1 id="vg-q">Please select the version assigned to you.</h1>
        <div className="vg-opts" role="radiogroup" aria-labelledby="vg-q">
          {['A', 'B'].map(v => (
            <button key={v} type="button" role="radio" aria-checked={sel === v} data-version={v} data-track={'version-' + v} tabIndex={sel === v || (!sel && v === 'A') ? 0 : -1}
              className={'vg-opt tap' + (sel === v ? ' is-on' : '')} onClick={() => setSel(v)} onKeyDown={onKey} autoFocus={v === 'A'}>
              <span className="vg-mark" aria-hidden="true">{sel === v && <Icon name="check" size={18} sw={3} />}</span>
              Version {v}
            </button>
          ))}
        </div>
        <button type="button" className="vg-go tap" data-track="version-confirm" disabled={!sel} onClick={() => sel && onConfirm(sel)}>Continue <Icon name="right" size={22} sw={2.2} /></button>
        <p className="vg-note">This choice is locked once you continue.</p>
      </main>
    </div>
  );
}
const newAttemptId = () => { try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {} return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); };

/* ---------- Explanation panel: one complete paragraph + paragraph controls (shared by both modes) ---------- */
function ExplainPanel({ panelRef, mode, showText, texts, k, n, showNav, reviewStyle, onBack, onNext, playing, onPlay, onPause, onReplay, blocked }) {
  return (
    <section className={'xpanel' + (showText ? '' : ' is-compact')} ref={panelRef} aria-label="Explanation">
      {/* Captions off (Narration only): the text area is removed entirely; the panel shrinks to the paragraph + audio controls.
          Captions on: every paragraph of the page is stacked in one grid cell (only the current one visible) so the panel keeps the height
          of the tallest one while moving between paragraphs. */}
      {showText && (
        <div className="xp-text" aria-live="polite">
          {texts.map((t, i) => <p key={i} className={i === k ? '' : 'xp-ghost'} aria-hidden={i === k ? undefined : 'true'}>{t}</p>)}
        </div>
      )}
      <div className="xp-ctl" role="group" aria-label="Explanation controls">
        {showNav && <div className={'xp-nav' + (reviewStyle ? ' is-review' : '')} aria-label={reviewStyle ? 'Repeat a part of this page' : undefined}>
          <button type="button" className="xp-b tap" data-track="para-back" onClick={onBack} disabled={k <= 0}><Icon name="left" size={16} /> Back</button>
          <span className="xp-count" aria-label={`Explanation ${k + 1} of ${n}`}>{k + 1} / {n}</span>
          <button type="button" className="xp-b is-next tap" data-track="para-continue" onClick={onNext} disabled={k >= n - 1}>Continue <Icon name="right" size={16} /></button>
        </div>}
        {mode === 'narration' && (
          <div className="xp-audio">
            <button type="button" className="xp-ic tap" data-track="narr-playpause" onClick={playing ? onPause : onPlay} aria-label={playing ? 'Pause narration' : 'Play this explanation'} title={playing ? 'Pause' : 'Play'}><Icon name={playing ? 'pause' : 'play'} size={18} /></button>
            <button type="button" className="xp-ic tap" data-track="narr-replay" onClick={onReplay} aria-label="Replay this explanation from the start" title="Replay"><Icon name="replay" size={18} /></button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- Staged reveal (Fix 13): elements appear when their narration segment starts ---------- */
function useStagedReveal(stageRef, map, seg, part, key) {
  // seg/part = how far the lesson has been revealed: the live narration position, or "everything through segment N" (part = Infinity)
  useEffect(() => {
    const root = stageRef.current;
    if (!root) return;
    const apply = () => {
      root.querySelectorAll('[data-hl], [data-hlr]').forEach(el => {
        const k = el.getAttribute('data-hlr') || el.getAttribute('data-hl');
        const at = map[k];
        if (!at) { el.classList.remove('stg', 'is-in'); return; }
        const [s, p] = at;
        const earlierChild = [...el.querySelectorAll('[data-hl], [data-hlr]')].some(ch => {
          const ck = ch.getAttribute('data-hlr') || ch.getAttribute('data-hl'); const ca = map[ck];
          return ca && (ca[0] < s || (ca[0] === s && ca[1] < p));
        });
        if (earlierChild) { el.classList.remove('stg', 'is-in'); el.removeAttribute('inert'); return; }
        const shown = seg > s || (seg === s && part >= p);
        el.classList.add('stg');
        el.classList.toggle('is-in', !!shown);
        if (shown) el.removeAttribute('inert'); else el.setAttribute('inert', '');
      });
    };
    apply();
    const mo = new MutationObserver(() => { mo.disconnect(); apply(); mo.observe(root, { childList: true, subtree: true }); });
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [map, seg, part, key]);
}

/* ---------- Milo (replaces the teacher): fixed reserved area bottom-left, above the caption strip / footer ----------
   Milo stays in his corner. When the narration moves to a NEW AREA he makes a small arm gesture with a brief teal signal at his hand;
   the instruction itself is carried by the floating teaching cursor (FloatingCursor) which glides from target to target and never
   returns to him. Poses: explain · think · celebrate · rest (wave in the onboarding). */
function MiloGuide({ pose, small, visible, speaking, levelFn, cue }) {
  return <div className={`milo-guide ${small ? 'is-small' : ''} ${visible ? '' : 'is-off'}`}><Milo pose={pose} decorative speaking={speaking} levelFn={levelFn} cue={cue} /></div>;
}

/* ---------- Milo's floating teaching cursor ----------
   An instructional overlay (not the learner's mouse): flat SVG arrow — teal fill, navy outline, ivory inset, mustard dot — with a faint
   teal halo. First target of a page: fades in beside it. Next targets: the same cursor glides (350–500 ms ease-in-out) from where it is
   to the next one; if a target arrives mid-flight it re-targets from its current visible position (a single tween, nothing queued).
   On arrival it nudges 4 px toward the target once, then stays still. Placement picks the spot (tip at an edge of the target) where the
   arrow covers the least text and stays clear of captions, navigation and Milo. pointer-events: none, aria-hidden; the system cursor is
   untouched. Hidden while the learner answers; reduced motion → no travel, no nudge. */
function CursorSVG({ size = 38, className = '' }) {
  return (
    <svg className={className} width={size} height={size * 140 / 124} viewBox="0 0 124 140" aria-hidden="true" focusable="false" style={{ overflow: 'visible' }}>
      <path d="M12 10L112 73L84 88L98 108Q104 118 95 124Q88 129 81 123L60 102L36 119Z" fill="#16A092" stroke="#1C2130" strokeWidth="6" strokeLinejoin="round" />
      <path d="M31 32L35 72L54 50Z" fill="#F4EBD3" stroke="#F4EBD3" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="86" cy="112" r="5.4" fill="#FBB92D" />
    </svg>
  );
}
const CUR_TIP = { x: 12 / 124, y: 10 / 124 };   // tip inside the 124×140 box, as fractions of the width
const CUR_BODY = { w: 100 / 124, h: 118 / 124 };   // the arrow's body relative to its width, measured from the tip (rotation 0 = tip up-left)
// placement candidates: [rotation°, anchor x fraction, anchor y fraction, dx, dy] — tip lands on that point of the target's edge
const CUR_CANDIDATES = [[0, .72, 1, 0, 2], [0, 1, .55, 2, 0], [90, .28, 1, 0, 2], [180, .72, 0, 0, -2], [-90, .28, 0, 0, -2], [180, 0, .55, -2, 0], [-90, 1, .55, 2, 0], [90, 0, .55, -2, 0]];
const rectArea = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

function FloatingCursor({ cue, hidden }) {
  const root = useRef(null), nudge = useRef(null), rot = useRef(null);
  const S = useRef({ pos: null, from: null, t0: 0, dur: 420, tween: false, raf: 0, fade: 0, el: null, cand: 0, angle: 0, obst: null, evalAt: 0, on: false });
  const active = !!cue && !hidden;
  useEffect(() => {
    const st = S.current, reduce = prefersReducedMotion();
    const size = () => (window.innerWidth >= 1100 ? 40 : 32);
    const R = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
    // Containers are bigger than what they show: point at the union of the visible boxes/text inside (relative to the target, so it follows layout moves).
    const contentRel = (el) => {
      const T = R(el), box = (e) => { const cs = getComputedStyle(e); return (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') || (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none'); };
      if (box(el) || el.matches('svg, img')) return { dl: 0, dt: 0, w: T.w, h: T.h };
      let u = null; const add = (q) => { const l = Math.max(q.l, T.l), t = Math.max(q.t, T.t), r = Math.min(q.r, T.r), b = Math.min(q.b, T.b); if (r - l < 2 || b - t < 2) return; u = u ? { l: Math.min(u.l, l), t: Math.min(u.t, t), r: Math.max(u.r, r), b: Math.max(u.b, b) } : { l, t, r, b }; };
      let n = 0; const w = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      for (let x = w.nextNode(); x && n < 500; x = w.nextNode(), n++) {
        const pe = x.nodeType === 3 ? x.parentElement : x; if (!pe || pe.closest('.stg:not(.is-in), [inert]')) continue;
        const cs = getComputedStyle(pe); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
        if (x.nodeType === 3) { if (!x.nodeValue.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(x); const q = rg.getBoundingClientRect(); add({ l: q.left, t: q.top, r: q.right, b: q.bottom }); }
        else if (box(x) || x.matches('svg, img')) add(R(x));
      }
      return u ? { dl: u.l - T.l, dt: u.t - T.t, w: u.r - u.l, h: u.b - u.t } : { dl: 0, dt: 0, w: T.w, h: T.h };
    };
    const area = (T) => { const c = st.rel || { dl: 0, dt: 0, w: T.w, h: T.h }; return { l: T.l + c.dl, t: T.t + c.dt, r: T.l + c.dl + c.w, b: T.t + c.dt + c.h, w: c.w, h: c.h }; };
    // everything the arrow should not cover: visible text, controls; plus zones it must stay out of
    const collect = () => {
      const text = [], zones = [], tgt = st.el;
      document.querySelectorAll('.stage, .bottombar, .topbar').forEach(box => {
        const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          if (!n.nodeValue.trim()) continue; const pe = n.parentElement; if (!pe) continue;
          const cs = getComputedStyle(pe); if (cs.visibility === 'hidden' || +cs.opacity === 0 || pe.closest('.stg:not(.is-in), [inert]')) continue;
          const rg = document.createRange(); rg.selectNodeContents(n); const q = rg.getBoundingClientRect(); if (q.width > 1 && q.height > 1) text.push({ l: q.left, t: q.top, r: q.right, b: q.bottom });
        }
      });
      document.querySelectorAll('.stage button, .stage input, .stage textarea, .bottombar button').forEach(e => { const q = R(e); if (q.w > 2 && !(tgt && tgt.contains(e))) text.push(q); });
      document.querySelectorAll('.stage svg:not(.mcursor-svg), .stage img').forEach(e => { // diagram graphics / icons are content too
        if (e.closest('.stg:not(.is-in), [inert], .milo, .mcursor') || (tgt && tgt.contains(e))) return; const q = R(e); if (q.w > 6 && q.h > 6) text.push(q); });
      [['.xpanel', 8], ['.topbar', 8], ['.bottombar', 8], ['.milo-guide', 10]].forEach(([sel, pad]) => { const e = document.querySelector(sel); if (e && !(tgt && (tgt.closest(sel) || e.contains(tgt)))) { const q = R(e); zones.push({ l: q.l - pad, t: q.t - pad, r: q.r + pad, b: q.b + pad }); } });
      return { text, zones };
    };
    // the arrow's body box for a candidate at a given tip point (rotation about the tip)
    const bodyBox = (c, tx, ty, s) => {
      const a = c[0] * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a), xs = [], ys = [];
      [[0, 0], [CUR_BODY.w * s, 0], [CUR_BODY.w * s, CUR_BODY.h * s], [0, CUR_BODY.h * s]].forEach(([x, y]) => { xs.push(tx + x * cos - y * sin); ys.push(ty + x * sin + y * cos); });
      return { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
    };
    const tipFor = (c, r) => [r.l + c[1] * r.w + c[3], r.t + c[2] * r.h + c[4]];
    const score = (c, r, s, ob) => {
      const [tx, ty] = tipFor(c, r), bx = bodyBox(c, tx, ty, s); let p = 0;
      const sh = { l: bx.l + 2, t: bx.t + 2, r: bx.r - 2, b: bx.b - 2 };
      ob.text.forEach(q => { p += rectArea(sh, q); }); ob.zones.forEach(z => { p += rectArea(sh, z) * 12; });
      const out = (bx.r - bx.l) * (bx.b - bx.t) - rectArea(bx, { l: 6, t: 6, r: window.innerWidth - 6, b: window.innerHeight - 6 }); p += out * 12;
      return p;
    };
    const choose = (r, s) => { // lowest penalty wins; keep the current one unless another is clearly better (no jitter)
      const ob = st.obst = collect(); const sc = CUR_CANDIDATES.map((c, i) => score(c, r, s, ob) + i * 40);
      let best = 0; sc.forEach((v, i) => { if (v < sc[best]) best = i; });
      if (st.pos && sc[st.cand] <= sc[best] + 150) return st.cand; return best;
    };
    const apply = (x, y) => { root.current.style.transform = `translate(${x}px, ${y}px)`; };
    const setAngle = (deg) => { const d = deg - st.angle; st.angle += ((d % 360) + 540) % 360 - 180; rot.current.style.transform = `rotate(${st.angle}deg)`; };
    const startNudge = () => {
      if (reduce || !nudge.current) return; const a = (st.angle) * Math.PI / 180, ux = -Math.SQRT1_2, uy = -Math.SQRT1_2; // tip direction at rotation 0 = up-left
      nudge.current.style.setProperty('--nx', (ux * Math.cos(a) - uy * Math.sin(a)) * 4 + 'px'); nudge.current.style.setProperty('--ny', (ux * Math.sin(a) + uy * Math.cos(a)) * 4 + 'px');
      nudge.current.classList.remove('is-nudge'); void nudge.current.offsetWidth; nudge.current.classList.add('is-nudge');
    };
    const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const loop = (now) => {
      let el = st.el;
      if (!el || !el.isConnected) { // React replaced the node: find the same target again, or let the cursor go
        el = st.key && [...document.querySelectorAll(`[data-hl="${st.key}"]`)].find(e => e.getBoundingClientRect().width > 4);
        if (el) st.el = el; else { st.on = false; root.current.classList.remove('is-on'); st.raf = 0; st.pos = null; st.tween = false; return; }
      }
      const s = size(), T0 = R(el); if (!st.rel || now - st.evalAt > 300) st.rel = contentRel(el); const r = area(T0); root.current.style.setProperty('--cs', s + 'px');
      if (r.b < 0 || r.t > window.innerHeight || r.r < 0 || r.l > window.innerWidth) { root.current.classList.remove('is-on'); } else if (st.on) root.current.classList.add('is-on');
      if (!st.obst || now - st.evalAt > 300) { st.cand = choose(r, s); st.evalAt = now; setAngle(CUR_CANDIDATES[st.cand][0]); }
      const c = CUR_CANDIDATES[st.cand]; let [tx, ty] = tipFor(c, r);
      tx = Math.max(4, Math.min(window.innerWidth - 4, tx)); ty = Math.max(4, Math.min(window.innerHeight - 4, ty));
      if (st.tween) { // one tween toward the CURRENT desired point: re-targeting is just resetting `from`
        const t = Math.min(1, (now - st.t0) / st.dur), e = ease(t);
        st.pos = [st.from[0] + (tx - st.from[0]) * e, st.from[1] + (ty - st.from[1]) * e];
        if (t >= 1) { st.tween = false; st.pos = [tx, ty]; startNudge(); }
      } else st.pos = [tx, ty]; // at rest it simply follows layout changes (scroll, resize, reveals)
      apply(st.pos[0], st.pos[1]);
      st.raf = requestAnimationFrame(loop);
    };
    clearTimeout(st.fade);
    if (active) {
      const first = !st.on; st.el = cue.el; st.key = cue.key; st.obst = null;
      if (first || reduce || !st.pos) { // first target of the page: appear beside it, no travel
        st.tween = false; st.pos = null;
        const s = size(); st.rel = contentRel(cue.el); const r = area(R(cue.el)); root.current.style.setProperty('--cs', s + 'px'); st.cand = choose(r, s); st.evalAt = performance.now(); setAngle(CUR_CANDIDATES[st.cand][0]);
        const [tx, ty] = tipFor(CUR_CANDIDATES[st.cand], r); st.pos = [tx, ty]; apply(tx, ty);
        st.on = true; root.current.classList.add('is-on');
        if (!reduce) setTimeout(startNudge, 260);
      } else { st.from = st.pos.slice(); st.t0 = performance.now(); st.rel = contentRel(cue.el); const to = area(R(cue.el)); st.dur = Math.max(350, Math.min(500, 350 + Math.hypot(to.l - st.pos[0], to.t - st.pos[1]) * 0.12)); st.tween = true; st.cand = st.cand; st.evalAt = 0; }
      if (!st.raf) st.raf = requestAnimationFrame(loop);
    } else if (st.on) { // no active target: fade out, then forget the position
      st.on = false; root.current.classList.remove('is-on'); st.tween = false;
      st.fade = setTimeout(() => { cancelAnimationFrame(st.raf); st.raf = 0; st.pos = null; st.el = null; }, 320);
    }
    return () => clearTimeout(st.fade);
  }, [cue && cue.id, active]);
  useEffect(() => () => { cancelAnimationFrame(S.current.raf); clearTimeout(S.current.fade); }, []);
  return (
    <div ref={root} className="mcursor" aria-hidden="true">
      <div ref={nudge} className="mcursor-nudge" onAnimationEnd={e => e.currentTarget.classList.remove('is-nudge')}>
        <div ref={rot} className="mcursor-rot"><CursorSVG size={40} className="mcursor-svg" /></div>
      </div>
    </div>
  );
}

/* ---------- Top-right toggles: sound (all narration audio) + CC ---------- */
function CornerToggles({ audio, cc, onAudio, onCC, showCC = true, showSound = true }) {
  return (
    <div className="corner-tg" role="group" aria-label="Sound and captions">
      {showSound && <button type="button" className="ctg tap" aria-pressed={audio} onClick={onAudio} data-track="sound-toggle"
        aria-label={audio ? 'Sound on — turn all narration audio off' : 'Sound off — turn narration audio on'} title={audio ? 'Sound on' : 'Sound off'}>
        <Icon name={audio ? 'vol' : 'volOff'} size={19} />
      </button>}
      {showCC && (
        <button type="button" className="ctg ctg-cc tap" aria-pressed={cc} onClick={onCC} data-track="cc-toggle"
          aria-label={cc ? 'Captions on — hide captions' : 'Captions off — show captions'} title={cc ? 'Captions on' : 'Captions off'}>
          <span className="cc-t">CC</span>
        </button>
      )}
    </div>
  );
}

/* ---------- Scene 2 onboarding (Fix 10) ---------- */
function OnbIllus({ k }) {
  if (k === 1) return (
    <div className="onb-ill"><span className="onb-card"><span className="onb-cur"><CursorSVG size={17} /></span></span></div>
  );
  if (k === 2) return (
    <div className="onb-ill"><span className="onb-opt is-on"><Icon name="check" size={13} sw={3} /></span><span className="onb-opt" /><span className="onb-next">Next <Icon name="right" size={12} /></span></div>
  );
  return (
    <div className="onb-ill"><span className="onb-ic"><Icon name="vol" size={18} /></span><span className="onb-ic"><b>CC</b></span></div>
  );
}
function Onboarding({ onDone, version }) {
  const [step, setStep] = useState(0);
  const steps = version === 'B' ? [
    'Read each explanation — Milo’s cursor shows the part being explained.',
    'Answer by tapping an option — Next unlocks when you finish.',
    'Use Back and Continue under the lesson to move through the explanations.',
  ] : [
    'Listen to Milo — his cursor shows the part being explained.',
    'Answer by tapping an option — Next unlocks when you finish.',
    'Use Back and Continue under the lesson to move through each explanation. Use the icons at the top right for sound and captions.',
  ];
  const finish = (how) => { FX.tap(); track('button_click', { target: 'onboarding-' + how, value: how }); onDone(); };
  return (
    <div className="onb-back" role="dialog" aria-modal="true" aria-label="How this lesson works">
      <div className="onb">
        <button type="button" className="onb-skip tap" onClick={() => finish('skip')} data-track="onboarding-skip">Skip <Icon name="right" size={14} /></button>
        <div className="onb-teacher"><Milo pose="wave" label="Milo, your learning guide, waving hello" /></div>
        <div className="onb-body">
          <div className="label-mono">How this lesson works · {step + 1} of 3</div>
          <ol className="onb-steps">
            {steps.map((t, i) => (
              <li key={i} className={i === step ? 'is-cur' : i < step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
                <OnbIllus k={i + 1} />
                <span>{t}</span>
              </li>
            ))}
          </ol>
          <div className="onb-actions">
            <button type="button" className="linkbtn tap" onClick={() => finish('skip-intro')} data-track="onboarding-skip-intro">Skip intro</button>
            {step < 2
              ? <button type="button" className="btn tap" autoFocus onClick={() => { FX.tap(); setStep(step + 1); }} data-track="onboarding-next">Next tip <Icon name="right" size={16} /></button>
              : <button type="button" className="btn tap" autoFocus onClick={() => finish('done')} data-track="onboarding-done">Got it <Icon name="check" size={16} sw={2.4} /></button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const saved = useMemo(loadSaved, []);
  const sess0 = useMemo(loadSess, []);
  const prefs0 = useMemo(loadPrefs, []);
  const narrator = useMemo(() => createNarrator(), []);
  const [started, setStarted] = useState(false);
  // A/B study: the version is chosen once on the first screen, locked for the attempt and saved with the progress (never switchable)
  const [version, setVersion] = useState(saved ? saved.version : null);      // 'A' (narration + optional captions) | 'B' (silent, captions always shown) | null = not chosen yet
  const [attemptId, setAttemptId] = useState(saved ? saved.attempt : null);
  const versionRef = useRef(version); versionRef.current = version;
  const mode = version === 'B' ? 'caption' : 'narration';                    // internal behaviour derived from the locked version
  const modeRef = useRef(mode); modeRef.current = mode;
  const [cue, setCue] = useState(null); // {id, el, rect, gesture}: the target the teaching cursor points at
  const [answering, setAnswering] = useState(false); // the learner is answering → the cursor stays away until the next target
  const [hold, setHold] = useState(null); // Narration: the last narrated target stays indicated while the learner reads the finished paragraph
  const lastCenter = useRef(null);
  const [idx, setIdx] = useState(saved ? saved.idx || 0 : 0);
  const [state, setState] = useState(saved ? saved.state || {} : {});
  const [seen, setSeen] = useState(saved ? saved.seen || {} : {});
  const [maxSeg, setMaxSeg] = useState(saved ? saved.maxSeg || {} : {});
  const [paraMap, setParaMap] = useState(saved ? saved.para || {} : {});  // current explanation paragraph per page
  const [revMap, setRevMap] = useState(saved ? saved.rev || {} : {});     // content revealed through this segment, per page
  const [audio, setAudioS] = useState(sess0.audio !== false);
  const [cc, setCC] = useState(prefs0.cc);
  const [onb, setOnb] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const NS0 = { status: 'idle', seg: 0, part: 0, hl: null, segCount: 0, audio: true, caption: '', scene: 0 };
  const [justUnlocked, setJustUnlocked] = useState(false);
  const stageRef = useRef(null), fitRef = useRef(null), innerRef = useRef(null), appRef = useRef(null), panelRef = useRef(null);

  const [nsRaw, setNsRaw] = useState(NS0);
  useEffect(() => narrator.subscribe(setNsRaw), [narrator]);
  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify({ idx, state, seen, maxSeg, para: paraMap, rev: revMap, version, attempt: attemptId })); }, [idx, state, seen, maxSeg, paraMap, revMap, version, attemptId]);
  useEffect(() => { try { window.Track && window.Track.setContext && window.Track.setContext({ version, attempt_id: attemptId }); } catch (e) {} }, [version, attemptId]);
  // Sound (session) + version: only Version A may ever make sound. Version B (and the version screen) keep the narrator off completely
  // (no audio, no speech, no timers, no click tones)
  useEffect(() => { saveSess({ audio }); FX.on = audio && version === 'A'; narrator.setEnabled(version === 'A'); narrator.setAudio(audio); }, [audio, version]);
  useEffect(() => { savePrefs({ cc }); }, [cc]);

  const page = PAGES[idx];
  const pst = state[page.id] || {};
  const sceneNo = idx + 1;
  const segs = useMemo(() => page.narration(state), [idx, state]);      // includes derived feedback segments (flagged fb)
  const paras = useMemo(() => buildParas(page, segs), [idx, segs]);
  const parasRef = useRef(paras); parasRef.current = paras;
  const paraIdx = Math.max(0, Math.min(paras.length - 1, paraMap[page.id] || 0));
  const para = paras[paraIdx];
  // ignore narrator snapshots that still belong to the previous page
  const ns = nsRaw.scene === sceneNo ? nsRaw : { ...NS0 };
  const live = mode === 'narration' && (ns.status === 'playing' || ns.status === 'paused');
  const playing = mode === 'narration' && ns.status === 'playing';
  const rev = revMap[page.id] ?? -1;
  // Version A: the first listen flows through the whole page without stopping; Back / Continue appear only once the page has been heard,
  // as a quiet way to repeat parts. Version B always shows them (they are its way of moving through the explanations).
  const baseLast = (paras.filter(p => !p.fb).slice(-1)[0] || { last: -1 }).last;   // last narration segment of the page itself (feedback excluded)
  const heardAll = rev >= baseLast && baseLast >= 0;
  const showNav = mode === 'caption' || heardAll;
  const revRef = useRef(rev); revRef.current = rev; const baseLastRef = useRef(baseLast); baseLastRef.current = baseLast; const playEnd = useRef(-1);
  // furthest reveal: live narration position, or everything through the last completed/skipped/entered paragraph
  const posSeg = live && ns.seg > rev ? ns.seg : rev, posPart = live && ns.seg > rev ? (ns.part || 0) : Infinity;
  const beat = Math.max(live ? ns.seg : -1, maxSeg[page.id] || 0, rev);
  const complete = page.isComplete(pst, state, beat);

  // staging map from the page's base narration (derived feedback segments are never staged)
  const stageMap = useMemo(() => {
    const m = {};
    segs.forEach((s, si) => {
      if (s.fb) return;
      const parts = s.parts || [{ t: s.t, hl: s.hl }];
      parts.forEach((p, pi) => { const k = p.hl || s.hl; if (k && k !== 'next' && !(k in m)) m[k] = [si, pi]; });
    });
    return m;
    // eslint-disable-next-line
  }, [idx, started]);

  const markRevealed = (pid, L) => {
    setRevMap(m => ((m[pid] ?? -1) >= L ? m : { ...m, [pid]: L }));
    setMaxSeg(m => ((m[pid] || 0) >= L ? m : { ...m, [pid]: L }));
  };
  // enter a paragraph: everything before it is revealed; Caption Only reveals all of it at once, Narration plays it and reveals as it is spoken
  const startPara = (P, k, opts = {}) => {
    const p = P[k]; if (!p) return;
    if (p.first > 0) markRevealed(page.id, p.first - 1);
    setHold(null);
    if (modeRef.current === 'caption') { markRevealed(page.id, p.last); return; }
    // continuous = the first listen: play from this paragraph straight through to the end of the page (no stop at paragraph ends)
    const end = opts.continuous && !p.fb ? baseLastRef.current : p.last;
    playEnd.current = end; narrator.playRange(p.first, end);
  };
  const goPara = (k) => {
    const P = parasRef.current; if (!P.length) return;
    k = Math.max(0, Math.min(P.length - 1, k));
    const cur = P[paraIdx]; if (cur) markRevealed(page.id, cur.last); // leaving a paragraph reveals whatever it still owed
    narrator.stop();                                                   // stop audio, speech, mouth and pending callbacks first: never two voices
    setParaMap(m => ({ ...m, [page.id]: k }));
    startPara(P, k);
  };

  useEffect(() => { if (started) narrator.setSegs(segs); }, [segs, started]); // keeps the narrator's segment list current (feedback appears)
  useEffect(() => {
    if (!started) return;
    track('scene_enter', { scene: sceneNo });
    const t0 = Date.now();
    narrator.prepare(segs, sceneNo);
    setHold(null);
    if (page.id === 'p2' && !loadSess().onboarded) setOnb(true);
    else { const done = revRef.current >= baseLastRef.current && baseLastRef.current >= 0; const k0 = done ? 0 : Math.max(0, Math.min(paras.length - 1, paraMap[page.id] || 0)); if (done) setParaMap(m => ({ ...m, [page.id]: 0 })); startPara(paras, k0, { continuous: true }); }
    setSeen(s => ({ ...s, [page.id]: true }));
    if (stageRef.current) stageRef.current.scrollTop = 0;
    return () => track('scene_exit', { scene: sceneNo, value: Math.round((Date.now() - t0) / 1000) });
    // eslint-disable-next-line
  }, [idx, started]);
  useEffect(() => () => narrator.stop(), [narrator]);

  // Narration: a paragraph that has finished playing is fully revealed and waits for Continue
  const rangeDone = mode === 'narration' && ns.status === 'ended' && !onb;
  useEffect(() => { if (started && rangeDone) markRevealed(page.id, Math.max(playEnd.current, para ? para.last : -1)); /* eslint-disable-next-line */ }, [rangeDone]);
  // while the narration flows, the panel follows it paragraph by paragraph and everything already spoken stays revealed
  const liveParaIdx = live ? paras.findIndex(p => ns.seg >= p.first && ns.seg <= p.last) : -1;
  useEffect(() => { if (started && liveParaIdx >= 0 && liveParaIdx !== paraIdx) setParaMap(m => ({ ...m, [page.id]: liveParaIdx })); /* eslint-disable-next-line */ }, [liveParaIdx]);
  useEffect(() => { if (started && live && ns.seg > 0) markRevealed(page.id, ns.seg - 1); /* eslint-disable-next-line */ }, [ns.seg, live]);
  // a feedback paragraph appears after the learner answers → move to it (the learner caused it)
  const prevLen = useRef({});
  useEffect(() => {
    if (!started || onb) return;
    const pl = prevLen.current[page.id]; prevLen.current[page.id] = paras.length;
    if (pl != null && paras.length > pl) goPara(paras.length - 1);
    // eslint-disable-next-line
  }, [paras.length, idx, started, onb]);

  useFitToStage(stageRef, fitRef, innerRef, started + ':' + idx + ':' + mode + ':' + cc);
  useEffect(() => { // Milo / cursor / content keep clear of the explanation panel whatever its height
    const app = appRef.current, p = panelRef.current; if (!app || !p) return;
    const f = app.querySelector('.bottombar');
    const set = () => { app.style.setProperty('--cc-h', Math.round(p.getBoundingClientRect().height) + 'px'); if (f) app.style.setProperty('--footer-h', Math.round(f.getBoundingClientRect().height) + 'px'); };
    set(); const ro = new ResizeObserver(set); ro.observe(p); if (f) ro.observe(f); window.addEventListener('resize', set);
    return () => { ro.disconnect(); window.removeEventListener('resize', set); };
  }, [started, mode]);
  useEffect(() => {
    if (!started || !live) return;
    if (ns.seg > (maxSeg[page.id] || 0)) setMaxSeg(m => ({ ...m, [page.id]: ns.seg }));
    // eslint-disable-next-line
  }, [ns.seg, live, idx]);
  useStagedReveal(stageRef, stageMap, onb ? -1 : posSeg, onb ? 0 : posPart, idx + ':' + started);

  // the target the teaching cursor indicates: Narration → what is being spoken (kept after the paragraph ends); Caption Only → the paragraph's main target
  const liveHl = live ? ns.hl : null;
  useEffect(() => { if (liveHl) setHold(liveHl); }, [liveHl]);
  const hlKey = started && !onb ? (mode === 'caption' ? (para && para.main) || null : (liveHl || (rangeDone ? hold : null))) : null;
  const lastCueKey = useRef(null), cueSeq = useRef(0);
  const levelFn = useCallback(() => narrator.level(), [narrator]);
  useEffect(() => {
    if (!hlKey) { lastCueKey.current = null; lastCenter.current = null; setCue(null); return; }
    if (hlKey === lastCueKey.current) return;
    lastCueKey.current = hlKey; setAnswering(false);
    const ae = document.activeElement;
    if (ae && ae.matches && ae.matches('textarea, input')) { setCue(null); return; }
    const raf = requestAnimationFrame(() => {
      const all = [...document.querySelectorAll(`[data-hl="${hlKey}"]`)];
      const pool = all.length ? all : [...document.querySelectorAll(`[data-hlr="${hlKey}"]`)]; // primary target = first data-hl match
      const el = pool.find(e => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && !e.matches('[role="radio"], [role="checkbox"], .chip, .optcard, .qopt'); });
      if (!el) { setCue(null); return; }
      const r = el.getBoundingClientRect(), c = [(r.left + r.right) / 2, (r.top + r.bottom) / 2], pc = lastCenter.current;
      const gesture = !pc || Math.hypot(c[0] - pc[0], c[1] - pc[1]) > 260; // Milo only gestures for a new area of the page
      lastCenter.current = c;
      setCue({ id: ++cueSeq.current, key: hlKey, el, gesture, rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } });
    });
    return () => cancelAnimationFrame(raf);
  }, [hlKey, idx]);

  useEffect(() => { // the learner starts answering (pointer or keyboard on an answer control inside the lesson stage) → hide the teaching cursor
    if (!started) return;
    const on = (e) => { const t = e.target; if (t && t.closest && t.closest('.stage') && t.closest('button, input, textarea, select, label, [role="radio"], [role="checkbox"], .chip, .optcard, .qopt')) setAnswering(true); };
    document.addEventListener('pointerdown', on, true); document.addEventListener('keydown', on, true);
    return () => { document.removeEventListener('pointerdown', on, true); document.removeEventListener('keydown', on, true); };
  }, [started]);

  // Opening: as soon as the page is ready, try to play the welcome (Narration only; the browser may refuse audible autoplay → 'blocked')
  const introOver = useRef(false); // set by 'Skip intro' so a pending autoplay attempt can never start the welcome afterwards
  useEffect(() => {
    if (started || version !== 'A') return;
    let t; const go = () => { t = setTimeout(() => { if (!introOver.current && versionRef.current === 'A') narrator.load(WELCOME_SEGS, 0); }, 250); };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
    return () => { clearTimeout(t); window.removeEventListener('load', go); };
  }, [version]);

  // celebrate pose after a correct answer
  useEffect(() => {
    let t;
    const on = () => { setCelebrate(true); clearTimeout(t); t = setTimeout(() => setCelebrate(false), 2200); };
    window.addEventListener('lesson:correct', on);
    return () => { window.removeEventListener('lesson:correct', on); clearTimeout(t); };
  }, []);
  useEffect(() => { setCelebrate(false); }, [idx]);

  const prevComplete = useRef(complete);
  useEffect(() => {
    if (complete && !prevComplete.current) { setJustUnlocked(true); setTimeout(() => setJustUnlocked(false), 800); }
    prevComplete.current = complete;
  }, [complete, idx]);

  const setPage = useCallback((patch) => {
    setState(s => ({ ...s, [page.id]: { ...(s[page.id] || {}), ...patch } }));
  }, [page.id]);
  const say = useCallback(() => {}, []); // feedback is now derived from page state (see P3_FEEDBACK / P7_FEEDBACK)

  const go = (d) => {
    const n = idx + d;
    if (n < 0 || n >= PAGES.length) return;
    if (d > 0 && !complete) return;
    FX.tap();
    setIdx(n);
  };

  // Narration: tap a narrated (display) element → play the explanation paragraph it belongs to
  const paraOfKey = (key) => { const si = segs.findIndex(s => (s.parts ? s.parts.some(p => p.hl === key) : false) || s.hl === key); return si < 0 ? -1 : parasRef.current.findIndex(p => si >= p.first && si <= p.last); };
  const onStageClick = (e) => {
    if (mode !== 'narration' || e.target.closest('button, a, input, textarea, label, [role="radio"], [role="checkbox"], .tap')) return;
    const el = e.target.closest('[data-hl]');
    if (!el) return;
    const pi = paraOfKey(el.getAttribute('data-hl'));
    if (pi >= 0) { FX.tap(); goPara(pi); }
  };
  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => {
      document.querySelectorAll('.stage [data-hl]').forEach(el => {
        const ok = mode === 'narration' && paraOfKey(el.getAttribute('data-hl')) >= 0 && !el.matches('button, .tap');
        el.classList.toggle('narr-target', ok);
        if (ok) el.setAttribute('title', 'Tap to hear this explanation again'); else el.removeAttribute('title');
      });
    }, 50);
    return () => clearTimeout(t);
  });

  useEffect(() => {
    const onKey = (e) => {
      if (!started) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'input') return;
      if (e.altKey && e.key === 'ArrowRight') go(1);
      if (e.altKey && e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const toggleAudio = () => { const v = !audio; setAudioS(v); FX.on = v && version === 'A'; if (v) FX.tap(); };
  const toggleCC = () => { FX.tap(); setCC(!cc); };
  // First screen: the participant confirms the version assigned to them. Allowed exactly once; afterwards there is no way to change it.
  // (An older saved attempt without a recorded version is also asked once here and never assigned silently.)
  const chooseVersion = (v) => {
    if (versionRef.current || (v !== 'A' && v !== 'B')) return;
    const att = attemptId || newAttemptId();
    versionRef.current = v;
    try { window.Track && window.Track.setContext && window.Track.setContext({ version: v, attempt_id: att }); } catch (e) {}
    if (v === 'A') { narrator.setEnabled(true); narrator.unlock(); FX.unlock(); FX.on = audio; narrator.setAudio(audio); } // this click is the gesture that lets the welcome autoplay
    else { narrator.setEnabled(false); FX.on = false; }
    track('button_click', { target: 'version-confirm', value: v });
    setAttemptId(att); setVersion(v);
  };
  const playPara = () => { if (para) { FX.tap(); setHold(null); narrator.unlock(); startPara(paras, paraIdx, { continuous: !heardAll }); } };
  const pausePara = () => { FX.tap(); narrator.pause(); };
  const resumeOrPlay = () => { if (ns.status === 'paused') { FX.tap(); narrator.play(); } else playPara(); };

  // "Play welcome" (cover; shown when the browser blocked autoplay or after switching back to Narration): this click is the allowed interaction
  const playWelcome = () => {
    narrator.unlock(); FX.unlock(); FX.on = audio; narrator.setAudio(audio);
    FX.tap();
    narrator.load(WELCOME_SEGS, 0); // scene 0 → audio/scene0-seg1.mp3, Web Speech fallback if the file is missing
  };
  // 'Skip intro': stop the welcome audio + mouth; the cover then shows the two course entry choices (it does not enter the lesson)
  const skipIntro = () => { introOver.current = true; narrator.stop(); };
  const begin = (opts = {}) => {
    narrator.stop(); // end the welcome narration (the first paragraph starts in the page effect)
    narrator.unlock(); FX.unlock();
    if (opts.fresh) { // a new attempt: same participant version, fresh progress and a new attempt id
      const att = newAttemptId(); try { window.Track && window.Track.setContext && window.Track.setContext({ version, attempt_id: att }); } catch (e) {}
      setAttemptId(att); setState({}); setSeen({}); setMaxSeg({}); setParaMap({}); setRevMap({}); setIdx(0);
    }
    narrator.setAudio(audio);
    FX.on = audio && version === 'A';
    FX.tap();
    track('session_start', {});
    setStarted(true);
  };
  const closeOnb = () => { saveSess({ onboarded: true }); setOnb(false); startPara(paras, paraIdx, { continuous: true }); };

  if (!version) return <VersionGate onConfirm={chooseVersion} />;
  if (!started) return (
    <StartScreen onPlay={playWelcome} onSkip={skipIntro} onStart={begin} canContinue={hasSavedProgress(saved)}
      audio={audio} onAudio={toggleAudio} cc={cc} onCC={toggleCC} ns={nsRaw.scene === 0 ? nsRaw : NS0} levelFn={levelFn} mode={mode} />
  );

  const PageComp = page.Component;
  const interactive = !!page.lockHint;
  const pose = onb ? 'wave' : celebrate ? 'celebrate'
    : mode === 'caption' ? ((interactive && !complete && paraIdx === paras.length - 1) ? 'think' : 'explain')
    : playing ? 'explain' : (interactive && !complete) ? 'think' : 'rest';
  const showText = mode === 'caption' || cc;
  return (
    <div className={'app mode-' + mode} ref={appRef}>
      <header className="topbar">
        <div className="brand"><b>Build Your First AI Agent</b><span>Unit 1 · Module 1 — Distinguish</span></div>
        <ol className="progress" aria-label="Lesson progress">
          {PHASES.map((p, i) => (
            <li key={p} className={i === page.phase ? 'is-current' : i < page.phase ? 'is-done' : ''} aria-current={i === page.phase ? 'step' : undefined}>
              <span className="pdot">{i < page.phase ? <Icon name="check" size={10} sw={3.2} /> : i + 1}</span>{p}
            </li>
          ))}
        </ol>
        <div className="tb-right">
          {version === 'A' && <CornerToggles audio={audio} cc={cc} onAudio={toggleAudio} onCC={toggleCC} />}
        </div>
      </header>

      <main className="stage" ref={stageRef} onClick={onStageClick}>
        <div className="fit" ref={fitRef}>
          <div className="fit-inner" ref={innerRef}>
            <PageComp key={page.id} st={pst} set={setPage} say={say} beat={onb ? -1 : beat} seg={mode === 'caption' ? -1 : (live ? ns.seg : -1)} hl={live ? ns.hl : null} all={state} />
          </div>
        </div>
      </main>

      <ExplainPanel panelRef={panelRef} mode={mode} showText={showText} texts={paras.map(p => p.text)} k={paraIdx} n={paras.length} showNav={showNav} reviewStyle={mode === 'narration'}
        onBack={() => { FX.tap(); goPara(paraIdx - 1); }} onNext={() => { FX.tap(); goPara(paraIdx + 1); }}
        playing={playing} onPlay={resumeOrPlay} onPause={pausePara} onReplay={playPara} />

      <footer className="bottombar">
        <div className="bb-left">
          <div className="pager">
            <span>Page {idx + 1} of {PAGES.length}</span>
            <span className="pager-dots" aria-hidden="true">
              {PAGES.map((p, i) => <i key={p.id} className={i === idx ? 'is-cur' : seen[p.id] ? 'is-seen' : ''} />)}
            </span>
          </div>
          {idx < PAGES.length - 1 && !complete && page.lockHint && <span className="lock-hint" title={page.lockHint}><Icon name="lock" size={15} /> <span className="lock-hint-t">{page.lockHint}</span></span>}
        </div>
        <div className="bb-nav" role="group" aria-label="Page navigation">
          <button type="button" className="navbtn tap" data-track="nav-back" onClick={() => go(-1)} disabled={idx === 0}><Icon name="left" size={18} /> Back</button>
          {idx < PAGES.length - 1 && (
            <button type="button" data-hl="next" data-track="nav-next" className={`navbtn next tap ${complete ? '' : 'is-locked'} ${justUnlocked ? 'just-unlocked' : ''}`} onClick={() => go(1)} disabled={!complete} aria-disabled={!complete}>
              {complete ? <>Next <Icon name="right" size={18} /></> : <><Icon name="lock" size={16} /> Next</>}
            </button>
          )}
        </div>
        <div className="bb-badge-space" aria-hidden="true" />
      </footer>
      <MiloGuide pose={pose} small={interactive} visible={!onb} speaking={!!ns.speaking && playing} levelFn={levelFn} cue={cue} />
      <FloatingCursor key={idx} cue={cue} hidden={answering || onb} />
      {onb && <Onboarding onDone={closeOnb} version={version} />}
    </div>
  );
}

/* ---------- Start screen: the approved ivory course cover ----------
   Flow: cover loads → the welcome narration starts by itself (scene 0 → audio/scene0-seg1.mp3, Web Speech fallback if the file is
   missing; silent timed text if Sound is off). "Skip intro" (text only) is available while it plays. The two course entry choices —
   "Start new" and "Continue" — appear only when the welcome ends naturally or the learner clicks "Skip intro" (which stops the audio
   and mouth but does NOT enter the lesson). Then "Skip intro" disappears; nothing replays and nothing is entered automatically.
   "Continue" is enabled only when there is valid saved progress. If the browser refuses audible autoplay the narrator reports
   'blocked': a "Play welcome" button is shown (one click plays the intro on this cover) and Milo's mouth stays still.
   The script is split into PARTS only so Milo's gestures can follow the narration; captions show it whole. */
const WELCOME_PARTS = [
  'Hi, welcome to Build Your First AI Agent!',
  'I’m Milo, your learning guide.',
  'I’ll explain key ideas and guide you through the activities step by step.',
  'Are you ready? Let’s start our learning journey together!',
];
const WELCOME_SEGS = [{ parts: WELCOME_PARTS.map(t => ({ t })) }];
const WELCOME_TEXT = WELCOME_PARTS.join(' ');
const WELCOME_GESTURES = ['wave', 'self', 'present', 'invite']; // Milo pose per narration part

function CoverCards() {
  const ink = '#1C2130';
  return (
    <div className="cv-cards" aria-hidden="true">
      <div className="cv-card cv-card-1">
        <svg viewBox="0 0 200 150"><path d="M100 18C148 14 188 36 186 70C184 104 148 126 106 124C96 124 86 123 78 120L42 140L54 110C32 98 16 82 18 62C20 34 54 20 100 18Z" fill="#5B9BD0" stroke={ink} strokeWidth="6" strokeLinejoin="round" /></svg>
      </div>
      <div className="cv-card cv-card-2">
        <svg viewBox="0 0 200 150"><g stroke={ink} strokeWidth="6" strokeLinejoin="round"><path d="M56 76H80M120 76H144" fill="none" strokeLinecap="round" />{[12, 78, 144].map((x, i) => <rect key={x} className={'cv-box cv-box-' + i} x={x} y="52" width="44" height="46" rx="9" fill="#FBB92D" />)}</g></svg>
      </div>
      <div className="cv-card cv-card-3">
        <svg viewBox="0 0 200 150">
          <g className="cv-loop" fill="none" stroke="#8B4A7B" strokeWidth="15" strokeLinecap="round">
            <path d="M52 66A46 46 0 0 1 128 46" /><path d="M148 84A46 46 0 0 1 72 104" />
            <path d="M118 22L136 50L106 56Z" fill="#8B4A7B" strokeWidth="6" strokeLinejoin="round" /><path d="M82 128L64 100L94 94Z" fill="#8B4A7B" strokeWidth="6" strokeLinejoin="round" />
          </g>
          <path className="cv-spark" d="M168 18Q172 34 190 38Q172 42 168 58Q164 42 146 38Q164 34 168 18Z" fill="#FBB92D" stroke={ink} strokeWidth="5" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function StartScreen({ onPlay, onSkip, onStart, canContinue, audio, onAudio, cc, onCC, ns, levelFn, mode }) {
  const caption = mode === 'caption'; // Caption Only: no welcome audio; the full text and both entry choices are shown immediately
  const blocked = ns.status === 'blocked';
  const ended = ns.status === 'ended';
  const live = ns.status === 'playing' || ns.status === 'paused';
  const [skipped, setSkipped] = useState(false);
  const [done, setDone] = useState(false);   // welcome finished naturally (sticky)
  const [hello, setHello] = useState(true);  // one small wave when the cover first appears
  const primRef = useRef(null), playRef = useRef(null);
  const [seenChoices, setSeenChoices] = useState(false); // once the choices have been shown they stay (switching modes never hides or enters)
  const choices = seenChoices || caption || done || skipped;
  useEffect(() => { if (caption || done || skipped) setSeenChoices(true); }, [caption, done, skipped]);
  useEffect(() => { const t = setTimeout(() => setHello(false), 2600); return () => clearTimeout(t); }, []);
  useEffect(() => { if (ended) setDone(true); }, [ended]);
  useEffect(() => { // keyboard users land on the next useful control without stealing focus from something they chose
    const el = choices ? primRef.current : blocked ? playRef.current : null;
    if (el && (!document.activeElement || document.activeElement === document.body)) el.focus();
  }, [choices, blocked]);
  const part = live ? (ns.part || 0) : 0;
  const pose = live && !caption ? WELCOME_GESTURES[Math.min(part, WELCOME_GESTURES.length - 1)] : (done || skipped) ? 'idle' : hello ? 'wave' : 'idle';
  const skip = () => { onSkip(); setSkipped(true); };
  const startNew = <button ref={canContinue ? null : primRef} type="button" className={'cv-choice tap ' + (canContinue ? 'is-alt' : 'is-primary')} data-track="start-new" onClick={() => onStart({ fresh: true })}>Start new</button>;
  const cont = <button ref={canContinue ? primRef : null} type="button" className={'cv-choice tap ' + (canContinue ? 'is-primary' : 'is-alt')} data-track="continue" disabled={!canContinue}
    aria-describedby={canContinue ? undefined : 'cv-cont-note'} onClick={() => onStart({})}>Continue</button>;

  return (
    <div className="start cv" data-screen-label="01 Start">
      <div className="cv-ring cv-ring-tl" aria-hidden="true" /><div className="cv-ring cv-ring-br" aria-hidden="true" />
      <div className="start-top">{!caption && <CornerToggles audio={audio} cc={cc} onAudio={onAudio} onCC={onCC} />}</div>
      <div className="cv-stage">
        <svg className="cv-ticks" viewBox="0 0 1672 941" aria-hidden="true">
          <g stroke="#EADFC6" strokeWidth="14" strokeLinecap="round"><path d="M84 355L128 380M150 322L158 348M70 412L108 408M1484 738L1472 770M1524 742L1530 774M1560 714L1584 736" /></g>
        </svg>
        <div className="cv-k">Unit 1 · Module 1 · About 15 minutes</div>
        <h1>Build Your First AI Agent</h1>
        <p className="cv-sub">Who decides what happens next?</p>
        <Milo className="cv-milo" pose={pose} speaking={!!ns.speaking && ns.status === 'playing'} levelFn={levelFn} />
        <CoverCards />
        <div className="cv-bottom">
          {choices ? (
            <>
              <div className={'cv-choices' + (done ? ' is-ready' : '')} role="group" aria-label="Course entry">{startNew}{cont}</div>
              {!canContinue && <p id="cv-cont-note" className="cv-note">No saved progress yet</p>}
            </>
          ) : blocked ? (
            <>
              <button ref={playRef} type="button" className="cv-playbtn tap" data-track="play-welcome" onClick={onPlay} aria-label="Play welcome. Your browser blocked automatic sound.">
                <Icon name="play" size={22} /> Play welcome
              </button>
              <p className="cv-note">Your browser blocked automatic sound — press play to hear Milo.</p>
            </>
          ) : null}
        </div>
        {!choices && !caption && <button type="button" className="cv-skip tap" data-track="skip-intro" onClick={skip}>Skip intro</button>}
      </div>
      {(caption || cc) && <section className="xpanel is-cover" aria-label="Welcome text"><div className="xp-text" aria-live="polite"><p>{WELCOME_TEXT}</p></div></section>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
