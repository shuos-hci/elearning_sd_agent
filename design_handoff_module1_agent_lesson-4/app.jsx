/* App shell: start screen, header, progress, narration controls + follow-along highlight, navigation gating, fit-to-viewport */
const PHASES = ['Hook', 'Learn', 'Compare', 'Practice', 'Reflect'];
const LS_KEY = 'bya-m1-v2';
const PREF_KEY = 'bya-m1-prefs';

function loadSaved() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch (e) { return null; } }
function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch (e) { return {}; } }

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
      const avail = stage.clientHeight - 2;
      const h = inner.offsetHeight;
      let target = window.innerWidth >= 1100 ? Math.max(MIN, Math.min(1, avail / h)) : 1;
      // hysteresis so the layout never ping-pongs
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

/* ---------- Follow-along highlight: soft ring + "you are here" pulsing dot ---------- */
function FollowHighlight({ hl, accent, stageRef }) {
  const ringRef = useRef(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const ring = ringRef.current;
      if (ring) {
        const el = hl ? document.querySelector(`[data-hl="${hl}"]`) : null;
        if (el) {
          const r = el.getBoundingClientRect();
          const st = stageRef.current ? stageRef.current.getBoundingClientRect() : null;
          const inFooter = el.closest('.bottombar, .topbar');
          const visible = r.width > 0 && r.height > 0 && (inFooter || !st || (r.bottom > st.top && r.top < st.bottom));
          if (visible) {
            const pad = 6;
            ring.style.opacity = '1';
            ring.style.transform = `translate(${r.left - pad}px, ${r.top - pad}px)`;
            ring.style.width = r.width + pad * 2 + 'px';
            ring.style.height = r.height + pad * 2 + 'px';
          } else ring.style.opacity = '0';
        } else ring.style.opacity = '0';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hl]);
  return (
    <div className="follow" ref={ringRef} style={{ '--acc': accent }} aria-hidden="true">
      <span className="follow-dot" />
    </div>
  );
}

function App() {
  const saved = useMemo(loadSaved, []);
  const prefs0 = useMemo(loadPrefs, []);
  const narrator = useMemo(() => createNarrator(), []);
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(saved ? saved.idx || 0 : 0);
  const [state, setState] = useState(saved ? saved.state || {} : {});
  const [seen, setSeen] = useState(saved ? saved.seen || {} : {});
  const [maxSeg, setMaxSeg] = useState(saved ? saved.maxSeg || {} : {});
  const [sounds, setSounds] = useState(prefs0.sounds !== false);
  const [ns, setNs] = useState({ status: 'idle', seg: 0, hl: null, segCount: 0, audio: true });
  const [justUnlocked, setJustUnlocked] = useState(false);
  const stageRef = useRef(null), fitRef = useRef(null), innerRef = useRef(null);

  useEffect(() => narrator.subscribe(setNs), [narrator]);
  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify({ idx, state, seen, maxSeg })); }, [idx, state, seen, maxSeg]);
  useEffect(() => { localStorage.setItem(PREF_KEY, JSON.stringify({ sounds, audio: ns.audio })); FX.on = sounds && ns.audio; }, [sounds, ns.audio]);

  const page = PAGES[idx];
  const pst = state[page.id] || {};
  const complete = page.isComplete(pst, state);

  useEffect(() => {
    if (!started) return;
    narrator.load(page.narration(state));
    setSeen(s => ({ ...s, [page.id]: true }));
    if (stageRef.current) stageRef.current.scrollTop = 0;
    // eslint-disable-next-line
  }, [idx, started]);
  useEffect(() => () => narrator.stop(), [narrator]);

  useFitToStage(stageRef, fitRef, innerRef, started + ':' + idx);

  // beat = furthest narration segment reached on this page (drives synced reveals)
  const liveSeg = ns.status === 'ended' ? 99 : ns.seg;
  const beat = Math.max(liveSeg, maxSeg[page.id] || 0);
  useEffect(() => {
    if (!started) return;
    if (liveSeg > (maxSeg[page.id] || 0)) setMaxSeg(m => ({ ...m, [page.id]: liveSeg }));
    // eslint-disable-next-line
  }, [liveSeg, idx]);

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

  // mark narrated elements so they get the "replay" affordance
  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => {
      document.querySelectorAll('[data-hl]').forEach(el => {
        const ok = narrator.segOfHl(el.getAttribute('data-hl')) >= 0 && !el.closest('.bottombar') && !el.matches('button, .tap');
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

  const begin = (opts = {}) => {
    narrator.unlock(); FX.unlock();
    if (opts.fresh) { setState({}); setSeen({}); setMaxSeg({}); setIdx(0); }
    narrator.setAudio(opts.audio !== false);
    FX.on = sounds && opts.audio !== false;
    FX.tap();
    setStarted(true);
  };

  if (!started) return <StartScreen onStart={begin} resumeIdx={saved && saved.idx > 0 ? saved.idx : 0} supported={narrator.supported} />;

  const PageComp = page.Component;
  const playing = ns.status === 'playing';
  const showHl = ns.status === 'playing' || ns.status === 'paused';
  const segCount = ns.segCount || 1;
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><b>Build Your First AI Agent</b><span>Unit 1 · Module 1 — Distinguish</span></div>
        <ol className="progress" aria-label="Lesson progress">
          {PHASES.map((p, i) => (
            <li key={p} className={i === page.phase ? 'is-current' : i < page.phase ? 'is-done' : ''} aria-current={i === page.phase ? 'step' : undefined}>
              <span className="pdot">{i < page.phase ? <Icon name="check" size={10} sw={3.2} /> : i + 1}</span>{p}
            </li>
          ))}
        </ol>
        <div className="narr" role="group" aria-label="Narration controls">
          <div className="narr-prog" aria-label={`Narration part ${Math.min(ns.seg + 1, segCount)} of ${segCount}`}>
            <span className="narr-count">{ns.status === 'ended' ? 'Done' : `${Math.min(ns.seg + 1, segCount)} of ${segCount}`}</span>
            <span className="narr-dots">
              {Array.from({ length: segCount }).map((_, i) => (
                <button key={i} type="button" className={`ndot ${ns.status !== 'ended' && i === ns.seg ? 'is-cur' : ''} ${ns.status === 'ended' || i < ns.seg ? 'is-past' : ''}`}
                  aria-label={`Play narration part ${i + 1}`} onClick={() => { FX.tap(); narrator.playSeg(i); }} />
              ))}
            </span>
          </div>
          <button type="button" className="nbtn is-primary" onClick={() => { FX.tap(); playing ? narrator.pause() : narrator.play(); }} aria-label={playing ? 'Pause narration' : 'Play narration'} title={playing ? 'Pause' : 'Play'}>
            <Icon name={playing ? 'pause' : 'play'} size={17} />
          </button>
          <button type="button" className="nbtn" onClick={() => { FX.tap(); narrator.replay(); }} aria-label="Replay narration from the start" title="Replay"><Icon name="replay" size={18} /></button>
          <span className="nsep" aria-hidden="true" />
          <button type="button" className="nbtn is-toggle" aria-pressed={ns.audio} onClick={() => narrator.setAudio(!ns.audio)} aria-label={ns.audio ? 'Turn audio off' : 'Turn audio on'} title={ns.audio ? 'Audio on' : 'Audio off'}>
            <Icon name={ns.audio ? 'vol' : 'volOff'} size={18} />
          </button>
          <button type="button" className="nbtn is-toggle" aria-pressed={sounds} disabled={!ns.audio} onClick={() => { const v = !sounds; setSounds(v); FX.on = v && ns.audio; if (v) FX.tap(); }} aria-label={sounds ? 'Turn click sounds off' : 'Turn click sounds on'} title={!ns.audio ? 'Click sounds (off while audio is off)' : sounds ? 'Click sounds on' : 'Click sounds off'}>
            <Icon name={sounds && ns.audio ? 'note' : 'noteOff'} size={18} />
          </button>
        </div>
      </header>

      <main className="stage" ref={stageRef} onClick={onStageClick}>
        <div className="fit" ref={fitRef}>
          <div className="fit-inner" ref={innerRef}>
            <PageComp key={page.id} st={pst} set={setPage} say={say} beat={beat} seg={ns.status === 'ended' ? 99 : ns.seg} hl={showHl ? ns.hl : null} all={state} />
          </div>
        </div>
      </main>

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
          <button type="button" className="navbtn tap" onClick={() => go(-1)} disabled={idx === 0}><Icon name="left" size={18} /> Back</button>
          {idx < PAGES.length - 1 && (
            <button type="button" data-hl="next" className={`navbtn next tap ${complete ? '' : 'is-locked'} ${justUnlocked ? 'just-unlocked' : ''}`} onClick={() => go(1)} disabled={!complete} aria-disabled={!complete}>
              {complete ? <>Next <Icon name="right" size={18} /></> : <><Icon name="lock" size={16} /> Next</>}
            </button>
          )}
        </div>
        <div className="bb-badge-space" aria-hidden="true" />
      </footer>
      <FollowHighlight hl={showHl ? ns.hl : null} accent={page.accent || 'var(--focus)'} stageRef={stageRef} />
    </div>
  );
}

function StartScreen({ onStart, resumeIdx, supported }) {
  return (
    <div className="start" data-screen-label="00 Start">
      <div className="start-card">
        <div className="start-k">Unit 1 · Module 1 · About 15 minutes</div>
        <h1>Build Your First AI Agent</h1>
        <p className="start-sub">A self-paced interactive lesson. Each page has narration and something to try.</p>
        <div className="start-code" aria-label="Who decides">
          <div><DeciderBadge who="user" /><Icon name="bubble" size={22} /></div>
          <div><DeciderBadge who="rules" /><Icon name="chain" size={22} /></div>
          <div><DeciderBadge who="model" /><Icon name="loop" size={22} /></div>
        </div>
        <div className="start-actions">
          <button type="button" className="bigbtn tap" autoFocus onClick={() => onStart({})}>
            <Icon name="vol" size={20} /> {resumeIdx ? `Resume at page ${resumeIdx + 1}` : 'Start with audio'}
          </button>
          {resumeIdx > 0 && <button type="button" className="ghostbtn tap" onClick={() => onStart({ fresh: true })}><Icon name="replay" size={18} /> Start over</button>}
          <button type="button" className="ghostbtn tap" onClick={() => onStart({ audio: false })}><Icon name="volOff" size={18} /> Continue without audio</button>
        </div>
        <p className="start-note"><Icon name="info" size={16} />{supported ? 'Tapping start enables narration. You can pause, replay, or mute it on every page.' : 'Narration is not supported in this browser — the lesson works fully without audio.'}</p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
