/* App shell (Round 2): start screen, header + progress, narration controls, top-right sound/CC toggles,
   staged reveal + teacher pointing (replaces the R1 highlight box), Scene 2 onboarding, captions,
   navigation gating, fit-to-viewport, analytics hooks. */
const PHASES = ['Hook', 'Learn', 'Compare', 'Practice', 'Reflect'];
const LS_KEY = 'bya-m1-v3';
const SS_KEY = 'bya-m1-session'; // per-session prefs: { audio, cc, onboarded }

function loadSaved() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch (e) { return null; } }
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

/* ---------- Staged reveal (Fix 13): elements appear when their narration segment starts ---------- */
function useStagedReveal(stageRef, map, seg, part, beat, ended, key) {
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
        const shown = ended || beat > s || (seg > s) || (seg === s && part >= p);
        el.classList.add('stg');
        el.classList.toggle('is-in', !!shown);
        if (shown) el.removeAttribute('inert'); else el.setAttribute('inert', '');
      });
    };
    apply();
    const mo = new MutationObserver(() => { mo.disconnect(); apply(); mo.observe(root, { childList: true, subtree: true }); });
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [map, seg, part, beat, ended, key]);
}

/* ---------- Teacher agent (Fix 12): poses + pointing hand ---------- */
const POSES = ['wave', 'point', 'think', 'celebrate'];
function Hand({ dir }) {
  // small hand cursor in the teacher's illustration style (mustard cuff, warm skin, dark outline)
  const rot = dir === 'corner' ? 38 : dir === 'up' ? 90 : dir === 'down' ? 90 : dir === 'left' ? 180 : 0;
  return (
    <svg viewBox="0 0 64 40" width="44" height="28" style={{ transform: `rotate(${rot}deg)`, overflow: 'visible' }} aria-hidden="true">
      <rect x="1" y="9" width="14" height="22" rx="4" fill="#D9A441" stroke="#3B2A25" strokeWidth="2" />
      <path d="M15 12 h8 l26 -1 a4.5 4.5 0 0 1 0 9 h-14 v2 h4 a4 4 0 0 1 0 8 h-6 a4 4 0 0 1 0 0 h-18 z" fill="#F4C7A9" stroke="#3B2A25" strokeWidth="2" strokeLinejoin="round" />
      <path d="M33 22 h6 M33 30 h3" stroke="#3B2A25" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function Teacher({ pose, hl, small, stageRef, visible }) {
  const handRef = useRef(null), outRef = useRef(null), figRef = useRef(null);
  const [corner, setCorner] = useState('bl');
  const [dir, setDir] = useState('right');
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const hand = handRef.current, out = outRef.current, fig = figRef.current;
      if (hand && out && fig) {
        const el = hl ? document.querySelector(`[data-hl="${hl}"]`) : null;
        const st = stageRef.current && stageRef.current.getBoundingClientRect();
        let placed = false;
        if (el && st && window.innerWidth >= 1100) {
          const r = el.getBoundingClientRect();
          const inFooter = !!el.closest('.bottombar');
          const vis = r.width > 0 && r.height > 0 && (inFooter || (r.bottom > st.top + 4 && r.top < st.bottom - 4));
          if (vis) {
            let x, y, d;
            if (inFooter) { d = 'up'; x = r.left + r.width / 2 - 12; y = r.top - 40; }
            else { d = 'corner'; x = r.left - 34; y = r.top - 30; }
            x = Math.max(2, Math.min(window.innerWidth - 50, x)); y = Math.max(st.top - 30, y);
            setDir(d);
            hand.style.opacity = '1';
            hand.style.transform = `translate(${x}px, ${y}px)`;
            out.style.opacity = '0';
            placed = true;
            // teacher swaps corner if the target sits near her zone
            const fr = fig.getBoundingClientRect();
            const near = r.left < fr.right + 60 && r.bottom > fr.top - 40 && !inFooter;
            setCorner(c => (near ? (c === 'bl' ? 'tl' : c) : (c === 'tl' && !(r.top < st.top + 220 && r.left < fr.right + 60) ? 'bl' : c)));
          }
        }
        if (!placed) {
          hand.style.opacity = '0';
          // subtle fallback outline only when pointing cannot be placed
          if (el && el.getBoundingClientRect().width > 0) {
            const r = el.getBoundingClientRect();
            out.style.opacity = '1';
            out.style.transform = `translate(${r.left - 4}px, ${r.top - 4}px)`;
            out.style.width = r.width + 8 + 'px'; out.style.height = r.height + 8 + 'px';
          } else out.style.opacity = '0';
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hl]);
  return (
    <>
      <div ref={figRef} className={`teacher ${small ? 'is-small' : ''} corner-${corner} ${visible ? '' : 'is-off'}`} aria-hidden="true">
        {POSES.map(p => <img key={p} src={`assets/teacher/${p}.png`} alt="" className={pose === p ? 'is-on' : ''} draggable="false" />)}
      </div>
      <div ref={handRef} className={'teacher-hand dir-' + dir} aria-hidden="true"><Hand dir={dir} /></div>
      <div ref={outRef} className="soft-outline" aria-hidden="true" />
    </>
  );
}

/* ---------- Top-right toggles: sound (all narration audio) + CC ---------- */
function CornerToggles({ audio, cc, onAudio, onCC, showCC = true }) {
  return (
    <div className="corner-tg" role="group" aria-label="Sound and captions">
      <button type="button" className="ctg tap" aria-pressed={audio} onClick={onAudio} data-track="sound-toggle"
        aria-label={audio ? 'Sound on — turn all narration audio off' : 'Sound off — turn narration audio on'} title={audio ? 'Sound on' : 'Sound off'}>
        <Icon name={audio ? 'vol' : 'volOff'} size={19} />
      </button>
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
    <div className="onb-ill"><span className="onb-card" /><span className="onb-hand"><Hand dir="right" /></span></div>
  );
  if (k === 2) return (
    <div className="onb-ill"><span className="onb-opt is-on"><Icon name="check" size={13} sw={3} /></span><span className="onb-opt" /><span className="onb-next">Next <Icon name="right" size={12} /></span></div>
  );
  return (
    <div className="onb-ill"><span className="onb-ic"><Icon name="vol" size={18} /></span><span className="onb-ic"><b>CC</b></span></div>
  );
}
function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const steps = [
    'Listen to the teacher — she points at what she is talking about.',
    'Answer by tapping an option — Next unlocks when you finish.',
    'Use the icons at the top right for sound and captions.',
  ];
  const finish = (how) => { FX.tap(); track('button_click', { target: 'onboarding-' + how, value: how }); onDone(); };
  return (
    <div className="onb-back" role="dialog" aria-modal="true" aria-label="How this lesson works">
      <div className="onb">
        <button type="button" className="onb-skip tap" onClick={() => finish('skip')} data-track="onboarding-skip">Skip <Icon name="right" size={14} /></button>
        <div className="onb-teacher"><img src="assets/teacher/wave.png" alt="Your teacher waving hello" /></div>
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
  const narrator = useMemo(() => createNarrator(), []);
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(saved ? saved.idx || 0 : 0);
  const [state, setState] = useState(saved ? saved.state || {} : {});
  const [seen, setSeen] = useState(saved ? saved.seen || {} : {});
  const [maxSeg, setMaxSeg] = useState(saved ? saved.maxSeg || {} : {});
  const [audio, setAudioS] = useState(sess0.audio !== false);
  const [cc, setCC] = useState(!!sess0.cc);
  const [onb, setOnb] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const NS0 = { status: 'idle', seg: 0, part: 0, hl: null, segCount: 0, audio: true, caption: '', scene: 0 };
  const ns0 = NS0;
  const [justUnlocked, setJustUnlocked] = useState(false);
  const stageRef = useRef(null), fitRef = useRef(null), innerRef = useRef(null);

  const [nsRaw, setNsRaw] = useState(ns0);
  useEffect(() => narrator.subscribe(setNsRaw), [narrator]);
  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify({ idx, state, seen, maxSeg })); }, [idx, state, seen, maxSeg]);
  useEffect(() => { saveSess({ audio, cc }); FX.on = audio; narrator.setAudio(audio); }, [audio]);
  useEffect(() => { saveSess({ cc }); }, [cc]);

  const page = PAGES[idx];
  const pst = state[page.id] || {};
  // ignore narrator snapshots that still belong to the previous page
  const ns = nsRaw.scene === idx + 1 ? nsRaw : { ...NS0, segCount: page.narration(state).length };
  const complete = page.isComplete(pst, state, Math.max(maxSeg[page.id] || 0, ns.status === 'ended' ? 99 : ns.seg));
  const sceneNo = idx + 1;

  // staging map from the page's INITIAL narration (appended feedback segments are never staged)
  const stageMap = useMemo(() => {
    const m = {};
    page.narration(state).forEach((s, si) => {
      const parts = s.parts || [{ t: s.t, hl: s.hl }];
      parts.forEach((p, pi) => { const k = p.hl || s.hl; if (k && k !== 'next' && !(k in m)) m[k] = [si, pi]; });
    });
    return m;
    // eslint-disable-next-line
  }, [idx, started]);

  const startNarration = useCallback(() => { narrator.load(page.narration(state), sceneNo); }, [idx, state]);

  useEffect(() => {
    if (!started) return;
    track('scene_enter', { scene: sceneNo });
    const t0 = Date.now();
    if (page.id === 'p2' && !loadSess().onboarded) { narrator.stop(sceneNo); setOnb(true); }
    else narrator.load(page.narration(state), sceneNo);
    setSeen(s => ({ ...s, [page.id]: true }));
    if (stageRef.current) stageRef.current.scrollTop = 0;
    return () => track('scene_exit', { scene: sceneNo, value: Math.round((Date.now() - t0) / 1000) });
    // eslint-disable-next-line
  }, [idx, started]);
  useEffect(() => () => narrator.stop(), [narrator]);

  useFitToStage(stageRef, fitRef, innerRef, started + ':' + idx + ':' + cc);

  const ended = ns.status === 'ended';
  const liveSeg = ended ? 99 : ns.seg;
  const beat = Math.max(liveSeg, maxSeg[page.id] || 0);
  useEffect(() => {
    if (!started) return;
    if (liveSeg > (maxSeg[page.id] || 0)) setMaxSeg(m => ({ ...m, [page.id]: liveSeg }));
    // eslint-disable-next-line
  }, [liveSeg, idx]);
  const beatSaved = maxSeg[page.id] || 0;
  useStagedReveal(stageRef, stageMap, onb ? -1 : ns.seg, ns.part || 0, onb ? -1 : beatSaved, ended && !onb, idx + ':' + started);

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
  const say = useCallback((segs) => narrator.append(segs), [narrator]);

  const go = (d) => {
    const n = idx + d;
    if (n < 0 || n >= PAGES.length) return;
    if (d > 0 && !complete) return;
    FX.tap();
    setIdx(n);
  };

  // tap a narrated (display) element → replay just its narration segment
  const onStageClick = (e) => {
    if (e.target.closest('button, a, input, textarea, label, [role="radio"], [role="checkbox"], .tap')) return;
    const el = e.target.closest('[data-hl]');
    if (!el) return;
    const seg = narrator.segOfHl(el.getAttribute('data-hl'));
    if (seg >= 0) { FX.tap(); narrator.playSeg(seg); }
  };
  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => {
      document.querySelectorAll('.stage [data-hl]').forEach(el => {
        const ok = narrator.segOfHl(el.getAttribute('data-hl')) >= 0 && !el.matches('button, .tap');
        el.classList.toggle('narr-target', ok);
        if (ok) el.setAttribute('title', 'Tap to replay this part of the narration');
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

  const toggleAudio = () => { const v = !audio; setAudioS(v); FX.on = v; if (v) FX.tap(); };
  const toggleCC = () => { FX.tap(); setCC(!cc); };

  const begin = (opts = {}) => {
    narrator.unlock(); FX.unlock();
    if (opts.fresh) { setState({}); setSeen({}); setMaxSeg({}); setIdx(0); }
    narrator.setAudio(audio);
    FX.on = audio;
    FX.tap();
    track('session_start', {});
    setStarted(true);
  };
  const closeOnb = () => { saveSess({ onboarded: true }); setOnb(false); narrator.load(page.narration(state), sceneNo); };

  if (!started) return <StartScreen onStart={begin} resumeIdx={saved && saved.idx > 0 ? saved.idx : 0} audio={audio} onAudio={toggleAudio} />;

  const PageComp = page.Component;
  const playing = ns.status === 'playing';
  const live = ns.status === 'playing' || ns.status === 'paused';
  const segCount = ns.segCount || 1;
  const interactive = !!page.lockHint;
  const pose = onb ? 'wave' : celebrate ? 'celebrate' : playing ? 'point' : (interactive && !complete) ? 'think' : 'point';
  return (
    <div className={'app' + (cc ? ' has-cc' : '')}>
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
          <div className="narr" role="group" aria-label="Narration controls">
            <div className="narr-prog" aria-label={`Narration part ${Math.min(ns.seg + 1, segCount)} of ${segCount}`}>
              <span className="narr-count">{ended ? 'Done' : `${Math.min(ns.seg + 1, segCount)} of ${segCount}`}</span>
              <span className="narr-dots">
                {Array.from({ length: segCount }).map((_, i) => (
                  <button key={i} type="button" className={`ndot ${!ended && i === ns.seg ? 'is-cur' : ''} ${ended || i < ns.seg ? 'is-past' : ''}`}
                    aria-label={`Play narration part ${i + 1}`} data-track={'narr-dot-' + (i + 1)} onClick={() => { FX.tap(); narrator.playSeg(i); }} />
                ))}
              </span>
            </div>
            <button type="button" className="nbtn is-primary" data-track="narr-playpause" onClick={() => { FX.tap(); playing ? narrator.pause() : narrator.play(); }} aria-label={playing ? 'Pause narration' : 'Play narration'} title={playing ? 'Pause' : 'Play'}>
              <Icon name={playing ? 'pause' : 'play'} size={17} />
            </button>
            <button type="button" className="nbtn" data-track="narr-replay" onClick={() => { FX.tap(); narrator.replay(); }} aria-label="Replay narration from the start" title="Replay"><Icon name="replay" size={18} /></button>
          </div>
          <span className="nsep" aria-hidden="true" />
          <CornerToggles audio={audio} cc={cc} onAudio={toggleAudio} onCC={toggleCC} />
        </div>
      </header>

      <main className="stage" ref={stageRef} onClick={onStageClick}>
        <div className="fit" ref={fitRef}>
          <div className="fit-inner" ref={innerRef}>
            <PageComp key={page.id} st={pst} set={setPage} say={say} beat={onb ? -1 : beat} seg={ended ? 99 : ns.seg} hl={live ? ns.hl : null} all={state} />
          </div>
        </div>
      </main>

      {cc && (
        <div className="caption-bar" aria-live="polite">
          <span className="caption-k">CC</span>
          <p>{live && ns.caption ? ns.caption : <span className="caption-idle">{ended ? 'Narration finished — tap a dot or Replay to hear it again.' : 'Captions will appear here while the teacher speaks.'}</span>}</p>
        </div>
      )}

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
      <Teacher pose={pose} hl={live && !onb ? ns.hl : null} small={interactive} stageRef={stageRef} visible={!onb} />
      {onb && <Onboarding onDone={closeOnb} />}
    </div>
  );
}

function StartScreen({ onStart, resumeIdx, audio, onAudio }) {
  return (
    <div className="start" data-screen-label="01 Start">
      <div className="start-top"><CornerToggles audio={audio} onAudio={onAudio} showCC={false} /></div>
      <div className="start-card">
        <div className="start-k">Unit 1 · Module 1 · About 15 minutes</div>
        <h1>Build Your First AI Agent</h1>
        <ul className="start-lines">
          <li><span className="sl-k">The course</span>Learn to tell a single LLM call, a fixed workflow, and an AI agent apart.</li>
          <li><span className="sl-k">The scenario</span>Maya needs AI to help create visuals for Campus Sustainability Week.</li>
          <li><span className="sl-k">You will</span>Listen to your teacher, then tap to decide who should determine what happens next.</li>
        </ul>
        <div className="start-actions">
          <button type="button" className="startbtn tap" autoFocus data-track="start" onClick={() => onStart({})}>
            Start <Icon name="right" size={22} sw={2.2} />
          </button>
          {resumeIdx > 0 && <button type="button" className="linkbtn tap start-over" data-track="start-over" onClick={() => onStart({ fresh: true })}>Start from the beginning instead</button>}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
