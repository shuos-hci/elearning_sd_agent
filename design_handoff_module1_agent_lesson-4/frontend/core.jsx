/* Core: icons, visual code (deciders + approaches), structure diagrams, questions, narrator, click FX */
const { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, Fragment } = React;

/* ---------------- Icons ---------------- */
const ICON_PATHS = {
  user: <><circle cx="12" cy="7.8" r="3.6"/><path d="M4.6 20.4c.6-4 3.7-6.2 7.4-6.2s6.8 2.2 7.4 6.2"/></>,
  rules: <><rect x="4.5" y="3" width="15" height="18" rx="2.2"/><path d="M7.8 8.2l1.4 1.4 2.4-2.6"/><path d="M13.8 8.6h2.8"/><path d="M7.8 13.2l1.4 1.4 2.4-2.6"/><path d="M13.8 13.6h2.8"/><path d="M7.8 17.6h8.8"/></>,
  model: <path d="M12 2.6l2.5 6.9 6.9 2.5-6.9 2.5L12 21.4l-2.5-6.9L2.6 12l6.9-2.5z"/>,
  bubble: <path d="M5 4.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4.5 3.5v-3.5H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/>,
  chain: <><rect x="1.6" y="8.5" width="5.4" height="7" rx="1.2"/><rect x="9.3" y="8.5" width="5.4" height="7" rx="1.2"/><rect x="17" y="8.5" width="5.4" height="7" rx="1.2"/><path d="M7 12h2.3M14.7 12H17"/></>,
  loop: <><path d="M19.4 12.4a7.5 7.5 0 1 1-2.1-5.7"/><path d="M19.6 3.6v3.8h-3.8"/></>,
  check: <path d="M4.5 12.5l4.6 4.6L19.5 6.7"/>,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9"/></>,
  play: <path d="M7.5 4.8v14.4l12-7.2z" fill="currentColor"/>,
  pause: <><rect x="6.2" y="4.8" width="3.8" height="14.4" rx="1" fill="currentColor"/><rect x="14" y="4.8" width="3.8" height="14.4" rx="1" fill="currentColor"/></>,
  replay: <><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.3 3.6v3.8h3.8"/></>,
  vol: <><path d="M4 9.5h3.4L12 5.6v12.8l-4.6-3.9H4z"/><path d="M15.4 9.2a4 4 0 0 1 0 5.6M17.9 6.6a7.6 7.6 0 0 1 0 10.8"/></>,
  volOff: <><path d="M4 9.5h3.4L12 5.6v12.8l-4.6-3.9H4z"/><path d="M15.8 9.6l4.8 4.8M20.6 9.6l-4.8 4.8"/></>,
  note: <><path d="M9 17.5V5.8l10-2.2v11.6"/><circle cx="6.6" cy="17.6" r="2.5"/><circle cx="16.6" cy="15.4" r="2.5"/></>,
  noteOff: <><path d="M9 17.5V5.8l10-2.2v11.6"/><circle cx="6.6" cy="17.6" r="2.5"/><circle cx="16.6" cy="15.4" r="2.5"/><path d="M3 3l18 18"/></>,
  right: <path d="M5 12h14M13 6l6 6-6 6"/>,
  left: <path d="M19 12H5M11 6l-6 6 6 6"/>,
  down: <path d="M12 5v14M6 13l6 6 6-6"/>,
  alert: <><path d="M12 3.6l9.4 16.4H2.6z"/><path d="M12 10v4.4M12 17.3v.2"/></>,
  bulb: <><path d="M9.2 18.2h5.6M10.2 21h3.6"/><path d="M12 3a6 6 0 0 0-3.7 10.7c.7.6 1 1.3 1 2.1v.4h5.4v-.4c0-.8.4-1.5 1-2.1A6 6 0 0 0 12 3z"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5.6M12 7.7v.2"/></>,
  hand: <><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10"/><path d="M12 10V4.5a1.5 1.5 0 0 1 3 0V10"/><path d="M15 10V6.5a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6.5 7-3 0-4.6-1.6-6-4l-1.9-3.4a1.5 1.5 0 0 1 2.6-1.5L9 13"/></>,
  undo: <><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></>,
};
function Icon({ name, size = 20, sw = 1.9, className = '', style, x, y }) {
  return (
    <svg className={'ic ' + className} width={size} height={size} x={x} y={y} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={style}>{ICON_PATHS[name]}</svg>
  );
}

/* ---------------- Click feedback: pop sound + vibration ---------------- */
const FX = {
  on: true, ctx: null,
  unlock() {
    try {
      if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {}
  },
  tap(kind = 'tap') {
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {}
    if (!this.on) return;
    this.unlock();
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'sine';
    const f0 = kind === 'ok' ? 880 : kind === 'bad' ? 520 : 720;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.62, t + 0.08);
    f.type = 'lowpass'; f.frequency.value = 2400;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
    o.connect(f); f.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.1);
  },
};

/* ---------------- Quiz hooks: teacher celebrates + analytics ---------------- */
const quizStart = {};
function quizAttempt(qid, correct, attemptNo, answer) {
  const now = Date.now();
  if (!quizStart[qid]) quizStart[qid] = now;
  try { window.Track && window.Track.quiz(qid, correct, attemptNo, answer, Math.round((now - quizStart[qid]) / 1000)); } catch (e) {}
  if (correct) { try { window.dispatchEvent(new Event('lesson:correct')); } catch (e) {} delete quizStart[qid]; }
}
window.quizAttempt = quizAttempt;

/* ---------------- Visual code ---------------- */
const DECIDERS = {
  user: { label: 'The user', icon: 'user', color: 'var(--user)' },
  rules: { label: 'Predefined rules', icon: 'rules', color: 'var(--rules)' },
  model: { label: 'The model', icon: 'model', color: 'var(--model)' },
};
const APPROACHES = {
  single: { label: 'Single LLM Call', lower: 'Single LLM call', icon: 'bubble', decider: 'user' },
  workflow: { label: 'Fixed Workflow', lower: 'Fixed workflow', icon: 'chain', decider: 'rules' },
  agent: { label: 'AI Agent', lower: 'AI agent', icon: 'loop', decider: 'model' },
};

function DeciderBadge({ who, label, size = 'md', solid = false, className = '' }) {
  const d = DECIDERS[who];
  return (
    <span className={`dbadge dbadge-${who} dbadge-${size} ${solid ? 'is-solid' : ''} ${className}`}>
      <Icon name={d.icon} size={size === 'sm' ? 14 : size === 'lg' ? 20 : 17} sw={2} />
      <span>{label || d.label}</span>
    </span>
  );
}
function ApproachMark({ kind, size = 22, className = '' }) {
  return <span className={'amark ' + className} title={APPROACHES[kind].label}><Icon name={APPROACHES[kind].icon} size={size} /></span>;
}
/* small feed-forward label: tells the learner what is tappable */
function FF({ children = 'Tap to choose', icon = 'hand' }) {
  return <span className="ff"><Icon name={icon} size={14} sw={2} />{children}</span>;
}

/* ---------------- Diagram: single call = straight line ---------------- */
function LineDiagram({ width = '100%', labels = ['User', 'Model', 'Response'], lit = 3, hlReturn }) {
  const icons = ['user', 'model', 'bubble'];
  const xs = [10, 210, 410];
  return (
    <svg className="diagram line-diagram" viewBox="0 0 560 168" style={{ width, height: 'auto' }} role="img"
      aria-label="Single LLM call: User to Model to Response, then back to the User. The user decides the next step.">
      <defs>
        <marker id="ah-ink" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--ink2)" /></marker>
        <marker id="ah-user" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--user)" /></marker>
      </defs>
      {xs.map((x, i) => (
        <g key={i} className={'ld-node ' + (i < lit ? 'is-lit' : '')} style={{ transitionDelay: i * 120 + 'ms' }}>
          <rect x={x} y="16" width="140" height="56" rx="12" fill="var(--card)" stroke={i === 0 ? 'var(--user)' : 'var(--line2)'} strokeWidth={i === 0 ? 2 : 1.5} />
          <Icon name={icons[i]} size={22} x={x + 16} y={33} style={{ color: i === 0 ? 'var(--user)' : 'var(--ink2)' }} />
          <text x={x + 46} y="50" className="svg-label" fontSize={17}>{labels[i]}</text>
        </g>
      ))}
      <path d="M152 44H204" stroke="var(--ink2)" strokeWidth="2" markerEnd="url(#ah-ink)" className={lit > 1 ? 'ld-a is-lit' : 'ld-a'} />
      <path d="M352 44H404" stroke="var(--ink2)" strokeWidth="2" markerEnd="url(#ah-ink)" className={lit > 2 ? 'ld-a is-lit' : 'ld-a'} />
      <g className={lit > 2 ? 'ld-a is-lit' : 'ld-a'} data-hl={hlReturn}>
        <path d="M480 76 C480 150 80 150 80 80" stroke="var(--user)" strokeWidth="2.6" fill="none" markerEnd="url(#ah-user)" />
        <rect x="236" y="117" width="88" height="27" rx="13.5" fill="var(--user)" />
        <Icon name="user" size={15} x={248} y={123} sw={2.4} style={{ color: '#fff' }} />
        <text x="268" y="135.5" fill="#fff" fontSize="13" fontWeight="700" letterSpacing="1.2" className="svg-mono">USER</text>
      </g>
    </svg>
  );
}

/* ---------------- Diagram: fixed workflow = chain ---------------- */
function ChainDiagram({ steps, input, state = 'connected', active = -1, gapAfter = null, tag = true, compact = false, className = '', hl, tagHl }) {
  const all = input ? [{ label: input, input: true }, ...steps] : steps;
  return (
    <div className={`chain chain-${state} ${compact ? 'chain-compact' : ''} ${className}`} data-hl={hl}>
      <div className="chain-row">
        {all.map((st, i) => {
          const si = input ? i - 1 : i;
          const isGap = gapAfter !== null && si === gapAfter;
          return (
            <Fragment key={i}>
              <div data-hl={st.hl} className={`cstep ${st.input ? 'is-input' : ''} ${active === i ? 'is-active' : ''} ${active > i ? 'is-done' : ''} ${st.dim ? 'is-dim' : ''} ${st.lit ? 'is-active' : ''}`}>
                {st.ai && <span className="ai-chip">AI tool</span>}
                <span className="cstep-label">{st.label}</span>
              </div>
              {i < all.length - 1 && (
                <span className={`carrow ${isGap ? 'is-gap' : ''} ${active > i ? 'is-flow' : ''}`} aria-hidden="true" data-hlr={all[i + 1].hl}>
                  {isGap ? <span className="gap-mark">?</span> : <svg viewBox="0 0 30 12" width="30" height="12"><path d="M1 6H25" /><path d="M21 1.5L27 6L21 10.5" /></svg>}
                </span>
              )}
            </Fragment>
          );
        })}
      </div>
      {tag && <div className="chain-tag" data-hl={tagHl}><Icon name="rules" size={15} sw={2} /> defined in advance</div>}
    </div>
  );
}
function ChainMini({ n = 4, width = 220 }) {
  return (
    <svg className="diagram" viewBox="0 0 230 70" style={{ width, height: 'auto' }} role="img" aria-label="Fixed workflow: a chain of boxes defined in advance">
      <defs><marker id="ah-rules" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--rules)" /></marker></defs>
      {Array.from({ length: n }).map((_, i) => (
        <g key={i}>
          <rect x={4 + i * 58} y="12" width="36" height="30" rx="6" fill="var(--card)" stroke="var(--line2)" strokeWidth="1.6" />
          {i < n - 1 && <path d={`M${42 + i * 58} 27H${58 + i * 58}`} stroke="var(--rules)" strokeWidth="2.4" markerEnd="url(#ah-rules)" />}
        </g>
      ))}
      <text x="4" y="64" className="svg-mono" fontSize="11" fill="var(--rules-ink)" letterSpacing=".6">DEFINED IN ADVANCE</text>
    </svg>
  );
}

/* ---------------- Diagram: agent = loop inside a boundary ---------------- */
function LoopMini({ nodes = ['Observe', 'Decide', 'Act', 'Check'], decide = 1, goal = 'Goal', out = 'Continue · Stop · Escalate', width = 260, label }) {
  const cx = 150, cy = 140, r = nodes.length > 4 ? 76 : 68;
  const n = nodes.length;
  const ang = (i) => (-90 + (360 / n) * i) * Math.PI / 180;
  const pt = (a, rr = r) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  const nw = nodes.length > 4 ? 96 : 84;
  const uid = useMemo(() => 'lm' + Math.random().toString(36).slice(2, 7), []);
  return (
    <svg className="diagram loop-mini" viewBox="0 0 300 268" style={{ width, height: 'auto' }} role="img"
      aria-label={label || `AI agent loop: ${goal}, then ${nodes.join(', ')}, then ${out}. The model decides, inside a boundary.`}>
      <defs><marker id={uid} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--ink2)" /></marker></defs>
      <rect x="4" y="4" width="292" height="260" rx="16" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeDasharray="6 5" />
      <rect x="92" y="18" width="116" height="28" rx="14" fill="var(--ink)" />
      <text x="150" y="37" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="600" className="svg-label">{goal}</text>
      <path d={`M150 47V${cy - r - 16}`} stroke="var(--ink2)" strokeWidth="1.8" markerEnd={`url(#${uid})`} />
      {nodes.map((_, i) => {
        const a0 = ang(i) + 0.42, a1 = ang((i + 1) % n) - 0.42 + (i === n - 1 ? 2 * Math.PI : 0);
        const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
        return <path key={'a' + i} d={`M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`} fill="none" stroke="var(--ink2)" strokeWidth="1.8" markerEnd={`url(#${uid})`} />;
      })}
      {nodes.map((t, i) => {
        const [x, y] = pt(ang(i));
        const isD = i === decide;
        return (
          <g key={t}>
            <rect x={x - nw / 2} y={y - 14} width={nw} height="28" rx="8" fill={isD ? 'var(--model)' : 'var(--card)'} stroke={isD ? 'var(--model)' : 'var(--line2)'} strokeWidth={1.5} />
            {isD && <Icon name="model" size={13} x={x - nw / 2 + 7} y={y - 6.5} sw={2.4} style={{ color: '#fff' }} />}
            <text x={x + (isD ? 7 : 0)} y={y + 5} textAnchor="middle" fontSize="13" fontWeight={isD ? 700 : 500} fill={isD ? '#fff' : 'var(--ink)'} className="svg-label">{t}</text>
          </g>
        );
      })}
      {out && <text x="150" y="254" textAnchor="middle" fontSize="12" className="svg-mono" fill="var(--ink2)" letterSpacing=".3">{out}</text>}
    </svg>
  );
}

/* ---------------- Unit map (Page 2 + Page 13) ---------------- */
function UnitMap({ highlight = -1, checked = false, labels, title = 'UNIT 1: FROM WORKFLOW TO AI APPROACH', hl, modHl }) {
  const mods = labels || [['Module 1', 'Distinguish'], ['Module 2', 'Map Workflow'], ['Module 3', 'Match to AI']];
  return (
    <div className="unitmap" data-hl={hl}>
      {title && <div className="unitmap-title">{title}</div>}
      <ol className="unitmap-row">
        {mods.map(([m, d], i) => (
          <Fragment key={m}>
            <li className={`umod ${highlight === i ? 'is-on' : ''} ${checked && i === 0 ? 'is-checked' : ''}`} data-hl={i === 0 ? modHl : undefined}>
              <span className="umod-k">{checked && i === 0 ? <><Icon name="check" size={15} sw={2.6} /> {m}</> : m}</span>
              <span className="umod-d">{d}</span>
            </li>
            {i < mods.length - 1 && <li className="umod-arrow" aria-hidden="true"><Icon name="right" size={18} /></li>}
          </Fragment>
        ))}
      </ol>
    </div>
  );
}

/* ---------------- Poster mockup ---------------- */
function Poster({ v = 'brand', className = '' }) {
  return (
    <div className={`poster poster-${v} ${className}`} aria-hidden="true">
      <div className="pst-logo"><span /></div>
      <div className="pst-shape" />
      <div className="pst-head">Campus<br />Sustainability<br />Week</div>
      <div className="pst-lines"><i /><i /></div>
      <div className="pst-chip" />
    </div>
  );
}

/* ---------------- Feedback ---------------- */
/* kinds: ok (✓ correct) · bad (✗ not quite) · hint (lightbulb) · info (i) · error (warning triangle, invalid input only) */
const FB_ICON = { ok: 'check', bad: 'x', hint: 'bulb', info: 'info', error: 'alert' };
function Feedback({ kind = 'ok', text, children, retry = true }) {
  return (
    <div className={'fb fb-' + kind}>
      <span className="fb-ic" aria-hidden="true"><Icon name={FB_ICON[kind]} size={kind === 'hint' || kind === 'info' ? 17 : 15} sw={2.4} /></span>
      <div className="fb-body">
        <p>{text}{children}</p>
        {kind === 'bad' && retry && <span className="fb-retry">Try another answer</span>}
      </div>
    </div>
  );
}

/* ---------------- Single-answer question ---------------- */
/* state: { last, solved (current answer correct), ever (was ever correct), tried } */
function Choice({ q, qid, options, state = {}, onChange, mode = 'retry', layout = 'list', visibleCount, prefix, className = '', renderLabel, ff = 'Tap to choose', hl }) {
  const last = state.last;
  const lastOpt = options.find(o => o.id === last);
  const pick = (o) => {
    const ok = mode === 'any' ? true : !!o.correct;
    const tried = (state.tried || []).includes(o.id) ? state.tried : [...(state.tried || []), o.id];
    FX.tap(mode === 'any' ? 'tap' : ok ? 'ok' : 'bad');
    if (mode !== 'any') quizAttempt(qid || (typeof q === 'string' ? q : 'question'), ok, (state.n || 0) + 1, o.label);
    onChange({ last: o.id, solved: ok, ever: !!state.ever || ok, tried, n: (state.n || 0) + 1 });
  };
  const shown = visibleCount == null ? options : options.slice(0, visibleCount);
  return (
    <div className={'qblock ' + className} data-hl={hl}>
      {(q || ff) && (
        <div className="q-head">
          {q && <div className="q-text">{q}</div>}
          {ff && <FF>{ff}</FF>}
        </div>
      )}
      <div className={'q-opts q-' + layout} role="radiogroup" aria-label={typeof q === 'string' ? q : 'Options'}>
        {shown.map((o, i) => {
          const sel = o.id === last;
          const verdict = !sel ? '' : mode === 'any' ? 'is-pick' : o.correct ? 'is-right' : 'is-wrong';
          return (
            <button key={o.id} type="button" role="radio" aria-checked={sel}
              className={`qopt tap ${sel ? 'is-sel' : ''} ${verdict}`}
              onClick={() => pick(o)}>
              <span className="qopt-mark" aria-hidden="true">
                {sel ? <Icon name={verdict === 'is-wrong' ? 'x' : 'check'} size={15} sw={2.8} /> : (prefix ? prefix(i) : String.fromCharCode(65 + i))}
              </span>
              <span className="qopt-label">{renderLabel ? renderLabel(o, i) : o.label}</span>
              {sel && mode !== 'any' && <span className="sr-only">{o.correct ? '(correct)' : '(incorrect)'}</span>}
            </button>
          );
        })}
      </div>
      <div aria-live="polite">
        {lastOpt && lastOpt.fb && (
          <Feedback key={String(last)} kind={mode === 'any' ? (lastOpt.fbKind || 'info') : lastOpt.correct ? 'ok' : 'bad'} text={lastOpt.fb} />
        )}
      </div>
    </div>
  );
}

/* collapsed one-line record of an answered question (keeps sequential pages inside the viewport) */
function Answered({ tag, label, onEdit }) {
  return (
    <button type="button" className="answered tap" onClick={onEdit} aria-label={`${tag}: ${label}. Tap to review`}>
      <span className="answered-ic"><Icon name="check" size={14} sw={2.8} /></span>
      <span className="answered-tag">{tag}</span>
      <span className="answered-l">{label}</span>
      <span className="answered-edit">Review</span>
    </button>
  );
}

function Summary({ title, items, kind, hl }) {
  const a = APPROACHES[kind];
  return (
    <div className={'summary summary-' + (a ? a.decider : 'none')} data-hl={hl}>
      <div className="summary-h">{a && <Icon name={a.icon} size={19} />}<span>{title}</span></div>
      <ul>{items.map(t => <li key={t}>{t}</li>)}</ul>
    </div>
  );
}

function PageHead({ kicker, title, sub, hl, right }) {
  return (
    <header className="phead" data-hl={hl}>
      <div>
        {kicker && <div className="kicker">{kicker}</div>}
        <h1 className="ptitle">{title}</h1>
        {sub && <p className="psub">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

Object.assign(window, {
  Icon, FX, DECIDERS, APPROACHES, DeciderBadge, ApproachMark, FF, LineDiagram, ChainDiagram, ChainMini, LoopMini,
  UnitMap, Poster, Choice, Answered, Feedback, Summary, PageHead,
});
