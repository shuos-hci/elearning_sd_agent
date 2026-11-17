/* Pages 1–4 (+ Matcher, shared by P4 and P7) */
window.PAGES = window.PAGES || [];

/* ---------- Matcher: tap a token, then tap a target (click-to-match, no drag needed) ---------- */
function Matcher({ tokens, targets, answers, state = {}, set, hint, layout = 'row', trayLabel = 'Tap an answer, then tap where it belongs', renderToken, renderTarget, trayHl, disabled }) {
  const matched = state.matched || {};
  const [armed, setArmed] = useState(null);
  const [shake, setShake] = useState(null);
  const [bounce, setBounce] = useState(null);
  const allDone = targets.every(t => matched[t.id]);
  const place = (tid) => {
    if (matched[tid]) return;
    if (!armed) { setShake(tid); setTimeout(() => setShake(null), 420); return; }
    if (answers[tid] === armed) {
      FX.tap('ok');
      set({ matched: { ...matched, [tid]: armed }, hint: false });
      setArmed(null);
    } else {
      FX.tap('bad');
      setShake(tid); setBounce(armed); set({ hint: true }); setArmed(null);
      setTimeout(() => { setShake(null); setBounce(null); }, 480);
    }
  };
  const used = Object.values(matched);
  return { allDone, armed, matched, ui: {
    tray: (
      <div className="mtray" data-hl={trayHl}>
        <div className="q-head"><span className="label-mono">{trayLabel}</span><FF>{armed ? 'Now tap a slot' : 'Tap to pick up'}</FF></div>
        <div className="tray" role="group" aria-label="Answers">
          {tokens.map(tk => {
            const isUsed = used.includes(tk.id);
            return (
              <button key={tk.id} type="button" className={`tray-badge tap ${bounce === tk.id ? 'is-bounce' : ''} ${armed === tk.id ? 'is-armed' : ''}`} disabled={isUsed || disabled} aria-pressed={armed === tk.id}
                onClick={() => { FX.tap(); setArmed(armed === tk.id ? null : tk.id); }}>
                {renderToken(tk, isUsed)}
                {isUsed && <span className="sr-only">(placed)</span>}
              </button>
            );
          })}
        </div>
      </div>
    ),
    slot: (tid) => (
      <button type="button" className={`mslot ${matched[tid] ? 'is-filled' : 'tap'} ${armed && !matched[tid] ? 'is-armed' : ''} ${shake === tid ? 'is-shake' : ''}`}
        disabled={disabled}
        aria-label={matched[tid] ? `Matched: ${tokens.find(t => t.id === matched[tid]).label}, correct` : 'Place the selected answer here'}
        onClick={() => place(tid)}>
        {matched[tid]
          ? <>{renderToken(tokens.find(t => t.id === matched[tid]), false, true)}<span className="mslot-ok"><Icon name="check" size={18} sw={2.8} /></span></>
          : <span className="mslot-empty">{armed ? 'Place here' : 'Empty slot'}</span>}
      </button>
    ),
    feedback: (
      <div aria-live="polite">
        {state.hint && !allDone && <Feedback kind="hint" text={hint} />}
      </div>
    ),
  } };
}
window.useMatcher = Matcher;

/* ---------- Page 1 — Hook ---------- */
const P1_FRAMES = [
  { k: 'Original brief', v: 'brand', bars: 1, note: null },
  { k: 'First AI result', v: 'd1', bars: 2, note: 'The approved brand colors are replaced.' },
  { k: 'Revised prompt → New misalignment', v: 'd2', bars: 4, note: 'The target audience changes.' },
  { k: 'Another correction → Further drift', v: 'd3', bars: 7, note: 'The visual style moves away from the original direction.' },
];
function Page1({ beat }) {
  const shown = beat >= 3 ? 4 : beat >= 2 ? 3 : beat >= 1 ? 2 : 1;
  const showPromptNote = beat >= 4;
  const showQ = beat >= 6;
  return (
    <div className="page" data-screen-label="01 Hook">
      <div className="kicker">Round by round</div>
      <div className="spiral" data-hl="spiral">
        {P1_FRAMES.map((f, i) => (
          <div key={i} className={'sframe ' + (i < shown ? '' : 'is-hidden')} data-hl={'f' + i}>
            <div className="sframe-k"><span>{f.k}</span><span>{String(i + 1).padStart(2, '0')}</span></div>
            <Poster v={f.v} />
            <div className="promptbar" aria-hidden="true">
              <div className="pb-meta"><span>prompt</span><span>{[18, 46, 97, 164][i]} words</span></div>
              {Array.from({ length: f.bars }).map((_, j) => <i key={j} style={{ width: j === f.bars - 1 ? '62%' : '100%' }} />)}
            </div>
            <div className="drift-note">{f.note && <><span className="drift-x" aria-hidden="true"><Icon name="x" size={12} sw={3} /></span><span>{f.note}</span></>}</div>
          </div>
        ))}
      </div>
      <div className="drift-note drift-sum" data-hl="prompts" style={{ opacity: showPromptNote ? 1 : 0 }}>
        <span className="drift-x" aria-hidden="true"><Icon name="x" size={12} sw={3} /></span><span>The prompt becomes longer while the result becomes less aligned.</span>
      </div>
      <h2 className={'bigq ' + (showQ ? '' : 'is-hidden')} data-hl="bigq">Who should decide what happens next?</h2>
    </div>
  );
}
PAGES.push({
  id: 'p1', phase: 0, title: 'The Misalignment Spiral',
  narration: () => [
    { t: 'Have you ever given AI a task, revised the prompt again and again, and somehow ended up further away from what you wanted?', hl: 'spiral' },
    { t: 'The colors changed.', hl: 'f1' },
    { t: 'The audience shifted.', hl: 'f2' },
    { t: 'The result no longer felt aligned with the original goal.', hl: 'f3' },
    { t: 'You added more instructions, but each correction seemed to create another problem.', hl: 'prompts' },
    { t: 'What if the problem is not simply the prompt?', hl: 'spiral' },
    { t: 'What if AI is making decisions it should not be making — or waiting for you to make decisions it could have handled?', hl: 'bigq', key: true },
    { t: 'That question is at the center of building an effective AI agent.', hl: 'bigq' },
  ],
  isComplete: () => true,
  Component: Page1,
});

/* ---------- Page 2 — Orientation ---------- */
function Page2({ beat }) {
  const stages = ['DECIDE', 'DESIGN', 'BUILD', 'EVALUATE'];
  const showUnit = beat >= 1;
  const hl = beat >= 2 ? 0 : -1;
  return (
    <div className="page" data-screen-label="02 Orientation">
      <PageHead kicker="Course and module" title="Build Your First AI Agent" hl="title" />
      <div className="stack" style={{ gap: 'clamp(18px, 3vh, 30px)' }}>
        <section data-hl="coursemap">
          <div className="label-mono" style={{ marginBottom: 10 }}>From a real work problem to an evaluated AI agent</div>
          <div className="coursemap">
            {stages.map((s, i) => (
              <div key={s} data-hl={'st' + i} className={`cstage is-on ${i === 0 && showUnit ? 'is-unit' : ''}`}>
                <span className="cstage-n">0{i + 1}</span>
                <span className="cstage-t">{s}</span>
              </div>
            ))}
          </div>
        </section>
        <section style={{ opacity: showUnit ? 1 : .12, transition: 'opacity .6s' }}>
          <UnitMap highlight={hl} hl="unitmap" modHl="mod1" />
        </section>
        <section className="goalcard" data-hl="goal" style={{ opacity: hl === 0 ? 1 : .12, transition: 'opacity .6s' }}>
          <span className="amark" style={{ background: '#2c3346', color: '#fff' }}><Icon name="model" size={22} /></span>
          <div>
            <div className="label-mono">Today's Goal</div>
            <b>Identify what makes an AI system agentic.</b>
          </div>
        </section>
      </div>
    </div>
  );
}
PAGES.push({
  id: 'p2', phase: 0, title: 'Course and Module Orientation',
  narration: () => [
    { parts: [
      { t: 'Welcome to Build Your First AI Agent.', hl: 'title' },
      { t: 'In this course, you will begin with a real work problem and move through four stages:', hl: 'coursemap' },
      { t: 'deciding where an agent is appropriate,', hl: 'st0' },
      { t: 'designing its architecture,', hl: 'st1' },
      { t: 'building a minimum prototype,', hl: 'st2' },
      { t: 'and evaluating how well it works.', hl: 'st3' },
    ] },
    { t: 'We will begin with Unit 1: From Workflow to AI Approach.', hl: 'unitmap' },
    { t: 'Today, we will focus on Module 1: what distinguishes an AI agent from a single LLM call and a fixed workflow.', hl: 'mod1', key: true },
    { t: "Let's begin with a quick decision.", hl: 'next' },
  ],
  isComplete: () => true,
  Component: Page2,
});

/* ---------- Page 3 — Initial choice ---------- */
const P3_OPTIONS = [
  { id: 'single', title: 'Single LLM Call', desc: 'Give the model one request and receive one response.' },
  { id: 'workflow', title: 'Fixed Workflow', desc: 'Run the work through a predefined sequence.' },
  { id: 'agent', title: 'AI Agent', desc: 'Give the system a goal and allow it to determine how to proceed.' },
];
const P3_CHIPS = ['It seems simplest', 'It handles repetition', 'It can adapt to new problems'];
const cleanExplanation = (t) => t.replace(/\s+and\s*$/i, '').trim();
function Page3({ st, set, say }) {
  const choice = st.choice || null;
  const chip = st.chip || null;
  const text = st.text || '';
  const saved = st.saved;
  const [err, setErr] = useState(false);
  const taRef = useRef(null);
  const clean = cleanExplanation(text);
  const dirty = saved && (saved.choice !== choice || saved.text !== clean);
  const pickChip = (c) => {
    FX.tap();
    const t = c + ' and ';
    set({ chip: c, text: t }); setErr(false);
    requestAnimationFrame(() => { const ta = taRef.current; if (ta) { ta.focus(); ta.setSelectionRange(t.length, t.length); } });
  };
  const submit = () => {
    if (!clean) { FX.tap('bad'); setErr(true); return; }
    FX.tap('ok');
    setErr(false);
    set({ saved: { choice, chip, text: clean }, text: clean });
    if (!saved) say([
      { t: 'Choice saved. However, the deliverable alone does not tell us enough to choose a system.', hl: 'p3fb' },
      { t: 'To make a better decision, we need to look beneath the labels.', hl: 'next' },
    ]);
  };
  return (
    <div className="page" data-screen-label="03 Initial Choice">
      <PageHead kicker="A quick decision" title="Which system would you choose?" />
      <div className="stack">
        <div className="brief" aria-label="Brief card" data-hl="brief">
          <div className="brief-t"><span className="label-mono" style={{ color: '#b9bfcc' }}>Brief</span><b>Campus Sustainability Week</b></div>
          <div className="brief-cell"><span className="label-mono">Deliverables</span><span>Poster, social post, and email banner.</span></div>
          <div className="brief-cell"><span className="label-mono">Deadline</span><span>Tomorrow.</span></div>
          <div className="brief-cell"><span className="label-mono">Requirement</span><span>Follow university brand guidelines.</span></div>
        </div>
        <div data-hl="options">
          <div className="q-head" style={{ marginBottom: 10 }}><span className="label-mono">Choose one system</span><FF /></div>
          <div className="optcards" role="radiogroup" aria-label="Choose a system">
            {P3_OPTIONS.map(o => (
              <button key={o.id} type="button" role="radio" className={'optcard tap ' + (choice === o.id ? 'is-sel' : '')} aria-checked={choice === o.id}
                onClick={() => { FX.tap(); set({ choice: o.id }); setErr(false); }}>
                <span className="amark"><Icon name={APPROACHES[o.id].icon} size={22} /></span>
                <b>{o.title}</b>
                <p>{o.desc}</p>
                <span className="sel" aria-hidden="true">{choice === o.id && <Icon name="check" size={14} sw={2.8} />}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="qcard" style={{ opacity: choice ? 1 : .45, transition: 'opacity .3s' }}>
          <div className="q-head" style={{ marginBottom: 10 }}>
            <div className="q-text">What makes this approach seem appropriate for the task?</div>
            <FF>Tap a reason or type</FF>
          </div>
          <div className="p3-row">
            <div className="chips" role="group" aria-label="Quick reasons">
              {P3_CHIPS.map(c => (
                <button key={c} type="button" className="chip tap" aria-pressed={chip === c && text.startsWith(c)} disabled={!choice} onClick={() => pickChip(c)}>{c}</button>
              ))}
            </div>
          </div>
          <label className="sr-only" htmlFor="p3-text">Your explanation</label>
          <textarea id="p3-text" ref={taRef} className={'textarea p3-ta ' + (err ? 'is-error' : '')} rows={1} disabled={!choice}
            placeholder="Write one sentence…" aria-invalid={err}
            value={text} onChange={e => { set({ text: e.target.value }); if (err) setErr(false); }} />
          {chip && text.startsWith(chip) && !saved && <p className="hint-line"><Icon name="bulb" size={15} sw={2} /> Add a few words after 'and' if you like — or just press Save my choice.</p>}
          <div className="p3-act">
            <button className="btn tap" type="button" disabled={!choice || (saved && !dirty)} onClick={submit}>
              <Icon name="check" size={17} sw={2.4} /> Save my choice
            </button>
            {!choice && <span className="muted-line"><Icon name="info" size={15} /> Select an option first.</span>}
            <div aria-live="polite" className="p3-fb">
              {err && <Feedback kind="error" text="An explanation is required." />}
              {saved && (
                <div className="fb-pair" data-hl="p3fb">
                  <span className="fbp fbp-ok"><span className="fbp-ic"><Icon name="check" size={13} sw={2.8} /></span>Choice saved.</span>
                  <span className="fbp fbp-hint"><span className="fbp-ic"><Icon name="bulb" size={14} sw={2.2} /></span>However, the deliverable alone does not tell us enough to choose a system.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
PAGES.push({
  id: 'p3', phase: 0, title: 'Initial Choice',
  narration: () => [
    { t: 'Imagine that you need AI to help create promotional visuals for Campus Sustainability Week.', hl: 'brief' },
    { t: 'You can use the same underlying AI model in three different systems. Which would you choose?', hl: 'options' },
  ],
  isComplete: (st) => !!st.saved,
  lockHint: 'Choose an option and save your explanation',
  Component: Page3,
});

/* ---------- Page 4 — Central distinction ---------- */
const P4_APPROACHES = ['single', 'workflow', 'agent'];
const P4_ANSWERS = { single: 'user', workflow: 'rules', agent: 'model' };
const P4_TOKENS = [
  { id: 'user', label: 'The user' },
  { id: 'rules', label: 'Predefined rules' },
  { id: 'model', label: 'The model during execution' },
];
function Page4({ st, set, beat }) {
  const collapsed = st.collapsed || beat >= 1;
  useEffect(() => { if (beat >= 1 && !st.collapsed) set({ collapsed: true }); }, [beat]);
  const m = useMatcher({
    tokens: P4_TOKENS, targets: P4_APPROACHES.map(id => ({ id })), answers: P4_ANSWERS, state: st, set,
    hint: 'Think about who decides the next step in each system.', trayHl: 'badges', disabled: !collapsed,
    trayLabel: 'Predict: tap an answer, then tap the approach it belongs to',
    renderToken: (tk, used, placed) => <DeciderBadge who={tk.id} label={tk.label} size={placed ? 'sm' : 'lg'} />,
  });
  const lvl = ['Simple', '', 'Advanced'];
  const offs = collapsed ? [0, 0, 0] : [104, 52, 0];
  return (
    <div className="page p4" data-screen-label="04 Central Distinction">
      <div className="p4-head">
        <div className="notlevels"><s>Not three levels</s><span style={{ opacity: collapsed ? 1 : 0, transition: 'opacity .6s .6s' }}>Three control structures</span></div>
        <div className="cq-big">Who determines what happens next?</div>
      </div>
      <div className={'stairs ' + (collapsed ? 'is-collapsed' : '')} data-hl="stairs">
        {P4_APPROACHES.map((a, i) => (
          <div key={a} className="stair" style={{ transform: `translateY(${offs[i]}px)` }}>
            <div className="stair-box">
              <span className="amark"><Icon name={APPROACHES[a].icon} size={20} /></span>
              <b>{APPROACHES[a].label}</b>
            </div>
            <div className="stair-lvl">{lvl[i] || '\u00a0'}</div>
            <div className="stair-slotwrap">{m.ui.slot(a)}</div>
          </div>
        ))}
        {!collapsed && <button className="btn ghost tap collapse-btn" type="button" onClick={() => { FX.tap(); set({ collapsed: true }); }}>Collapse the staircase</button>}
      </div>
      <div className="p4-tray" style={{ opacity: collapsed ? 1 : 0, pointerEvents: collapsed ? 'auto' : 'none' }}>
        {m.ui.tray}
        {m.ui.feedback}
        {m.allDone && <Feedback kind="ok" text="Single LLM call → The user. Fixed workflow → Predefined rules. AI agent → The model during execution." />}
      </div>
    </div>
  );
}
PAGES.push({
  id: 'p4', phase: 1, title: 'The Central Distinction',
  narration: () => [
    { t: 'These systems are often presented as increasing levels of intelligence.', hl: 'stairs' },
    { t: 'But that framing can be misleading. The staircase collapses, and the three options move onto the same level.', hl: 'stairs' },
    { t: 'They are not simply three levels of AI. They are three ways of structuring how AI participates in work.', hl: 'badges', key: true },
    { t: "Let's begin with the form of AI assistance most people already use.", hl: 'next' },
  ],
  isComplete: (st) => P4_APPROACHES.every(a => (st.matched || {})[a]),
  lockHint: 'Match all three approaches correctly',
  Component: Page4,
});
