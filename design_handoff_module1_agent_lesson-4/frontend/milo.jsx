/* Milo — the 2D learning guide (replaces the human teacher).
   The approved drawing (assets/milo/milo-original.png) is split into three full-canvas layers by tools/kokoro/cut-milo.mjs:
     base.png (head + body), arm-left.png (waving arm), arm-right.png (open hand).
   Stacking them reproduces the original exactly; the arms rotate about their shoulders and an SVG overlay draws the
   blink / happy eyes and the speaking mouth. Poses are set with data-pose (see "Milo" in styles.css):
     idle (cover) · wave · self · present · invite · rest (in lesson) · explain · think · celebrate
   Props:  speaking — true only while narration audio is actually audible → mouth moves (amplitude-driven when `levelFn`
           returns a loudness, otherwise a gated cycle); cue — {id, rect}: "activate that content": the right arm points toward
           the rect from its fixed shoulder and a small teal signal pulses at the fingertip — only when `cue.gesture` (a new area of the page). */
function miloSrc(k) {
  const m = window.__BYA_INLINE__ && window.__BYA_INLINE__.milo;
  return (m && m[k]) || `assets/milo/${k}.png`;
}
// geometry measured from the artwork (canvas 1299×1211)
const MILO_EYES = [{ x: 549, y: 420, rx: 32, ry: 59 }, { x: 757, y: 372, rx: 30, ry: 57 }];
const MILO_MOUTH = { x: 680, y: 482, tilt: -13 };       // centre + tilt of the original smile (which is masked, never shown)
const MILO_FINGERTIP = { x: 1180, y: 788 };              // tip of the open hand (right arm)
const MILO_ARM_REST_DEG = 5.9;                           // direction of that hand from its shoulder at --ar: 0
const prefersReducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

/* mouth: rest → small → wide, only while `speaking` (set immediately back to rest when it stops) */
function useMouth(ref, speaking, levelFn) {
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const set = (m) => { if (el.dataset.mouth !== m) el.dataset.mouth = m; };
    if (!speaking) { set('rest'); return; }
    let raf = 0, next = 0, sm = 0, cur = 'small';
    const tick = (t) => {
      const lvl = levelFn ? levelFn() : null;
      if (lvl != null) { // gentle, smoothed, with hysteresis so it never flickers
        sm = sm * 0.65 + lvl * 0.35;
        const up = cur === 'rest' ? 0.05 : 0.035, wide = cur === 'wide' ? 0.1 : 0.125;
        cur = sm > wide ? 'wide' : sm > up ? 'small' : 'rest'; set(cur);
      } else if (t >= next) { // no meter (Web Speech / suspended audio context): varied cycle gated by real playback
        const r = Math.random(); cur = r < 0.5 ? 'small' : r < 0.78 ? 'wide' : 'rest'; set(cur);
        next = t + 110 + Math.random() * 110;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); set('rest'); };
  }, [speaking, levelFn]);
}

/* activation gesture: point the attached arm toward the target, pulse the fingertip once */
function usePoint(ref, cue) {
  useEffect(() => {
    const el = ref.current; if (!el || !cue || !cue.gesture || prefersReducedMotion()) return;
    const r = el.getBoundingClientRect(), t = cue.rect;
    const px = r.left + r.width * 0.5781, py = r.top + r.height * 0.6152;           // right shoulder on screen
    const nx = Math.max(t.left, Math.min(px, t.right)), ny = Math.max(t.top, Math.min(py, t.bottom)); // nearest point of the target
    const deg = Math.max(-78, Math.min(14, Math.atan2(ny - py, nx - px) * 180 / Math.PI - MILO_ARM_REST_DEG));
    el.style.setProperty('--point', deg.toFixed(1) + 'deg');
    el.classList.remove('is-pointing', 'is-signal'); void el.offsetWidth; el.classList.add('is-pointing', 'is-signal');
    const t1 = setTimeout(() => el.classList.remove('is-signal'), 1100), t2 = setTimeout(() => el.classList.remove('is-pointing'), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); el.classList.remove('is-pointing', 'is-signal'); };
  }, [cue && cue.id]);
}

function Milo({ pose = 'rest', className = '', style, label = 'Milo, your learning guide', decorative = false, speaking = false, levelFn = null, cue = null }) {
  const root = useRef(null);
  useMouth(root, speaking, levelFn);
  usePoint(root, cue);
  const M = MILO_MOUTH;
  return (
    <div ref={root} className={'milo ' + className} data-pose={pose} data-mouth="rest" style={style}
      {...(decorative ? { 'aria-hidden': 'true' } : { role: 'img', 'aria-label': label })}>
      <img className="milo-layer milo-base" src={miloSrc('base')} alt="" draggable="false" />
      <img className="milo-layer milo-arm milo-arm-l" src={miloSrc('arm-left')} alt="" draggable="false" />
      <div className="milo-layer milo-arm milo-arm-r">
        <img src={miloSrc('arm-right')} alt="" draggable="false" />
        <svg className="milo-signal" viewBox="0 0 1299 1211" aria-hidden="true" focusable="false">
          <circle className="sig sig-1" cx={MILO_FINGERTIP.x} cy={MILO_FINGERTIP.y} r="34" />
          <circle className="sig sig-2" cx={MILO_FINGERTIP.x} cy={MILO_FINGERTIP.y} r="34" />
          <circle className="sig sig-dot" cx={MILO_FINGERTIP.x} cy={MILO_FINGERTIP.y} r="18" />
        </svg>
      </div>
      <svg className="milo-layer milo-fx" viewBox="0 0 1299 1211" aria-hidden="true" focusable="false">
        {MILO_EYES.map((e, i) => (
          <g key={i} transform={`rotate(-15 ${e.x} ${e.y})`}>
            <ellipse className="milo-lid" cx={e.x} cy={e.y} rx={e.rx + 6} ry={e.ry + 6} fill="#262935" />
            <path className="milo-happy" d={`M${e.x - 26} ${e.y + 14}Q${e.x} ${e.y - 34} ${e.x + 26} ${e.y + 14}`} fill="none" stroke="#41D1AD" strokeWidth="15" strokeLinecap="round" />
          </g>
        ))}
        {/* the original smile is covered by a visor-coloured patch; the three mouths below replace it (only one is visible) */}
        <rect x="604" y="436" width="158" height="88" rx="34" fill="#252834" />
        <g transform={`translate(${M.x} ${M.y}) rotate(${M.tilt})`} fill="#41D1AD" stroke="none">
          <path className="mouth m-rest" d="M-55 1Q0 31 55 1" fill="none" stroke="#41D1AD" strokeWidth="17" strokeLinecap="round" />
          <path className="mouth m-small" d="M-40 -4Q0 -11 40 -4Q38 26 0 29Q-38 26 -40 -4Z" />
          <path className="mouth m-wide" d="M-48 -8Q0 -16 48 -8Q46 38 0 44Q-46 38 -48 -8Z" />
        </g>
        <g className="milo-think" fill="#F5E5D1" stroke="#1F2335" strokeWidth="7">
          <circle cx="930" cy="215" r="13" /><circle cx="985" cy="160" r="19" /><circle cx="1058" cy="92" r="27" />
        </g>
        <g className="milo-spark">
          {[[170, 260, 34, '#FBB92D'], [1085, 285, 30, '#41D1AD'], [1120, 520, 24, '#FBB92D'], [150, 450, 24, '#41D1AD']].map(([x, y, r, c], i) => (
            <path key={i} style={{ '--d': i * 0.12 + 's' }} transform={`translate(${x} ${y})`} fill={c} stroke="#1F2335" strokeWidth="6" strokeLinejoin="round"
              d={`M0 ${-r}Q${r * .18} ${-r * .18} ${r} 0Q${r * .18} ${r * .18} 0 ${r}Q${-r * .18} ${r * .18} ${-r} 0Q${-r * .18} ${-r * .18} 0 ${-r}Z`} />
          ))}
        </g>
      </svg>
    </div>
  );
}
window.Milo = Milo;
