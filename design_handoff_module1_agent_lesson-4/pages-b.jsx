/* Pages 5–8 (+ QSeq: sequential questions that collapse once answered) */

/* ---------- QSeq ---------- */
function QSeq({ items, st, set, tagPrefix = 'Q' }) {
  // items: [{ key, tag, q, options, ff, layout, render? }]
  const open = st._open || {};
  let firstUnsolved = items.findIndex(it => !(st[it.key] && (st[it.key].ever || st[it.key].solved)));
  if (firstUnsolved < 0) firstUnsolved = items.length;
  return (
    <div className="qseq">
      {items.map((it, i) => {
        if (i > firstUnsolved) return null;
        const s = st[it.key] || {};
        const solved = !!s.solved;
        const label = solved ? (it.options.find(o => o.id === s.last) || {}).short || (it.options.find(o => o.id === s.last) || {}).label : '';
        const nextTouched = items[i + 1] && st[items[i + 1].key] && st[items[i + 1].key].last != null;
        if (solved && nextTouched && !open[it.key]) {
          return <Answered key={it.key} tag={it.tag} label={label} onEdit={() => { FX.tap(); set({ _open: { ...open, [it.key]: true } }); }} />;
        }
        return (
          <div key={it.key} className="qcard reveal" data-hl={it.hl}>
            <div className="qcard-top">
              <span className="qstep-tag">{it.tag}</span>
              {solved && nextTouched && <button type="button" className="linkbtn tap" onClick={() => { FX.tap(); set({ _open: { ...open, [it.key]: false } }); }}>Collapse</button>}
            </div>
            {it.render ? it.render() : (
              <Choice q={it.q} options={it.options} state={s} ff={it.ff} layout={it.layout} prefix={it.prefix} renderLabel={it.renderLabel} visibleCount={it.visibleCount}
                onChange={v => set({ [it.key]: v })} />
            )}
            {it.after}
          </div>
        );
      })}
    </div>
  );
}
window.QSeq = QSeq;

/* ---------- Page 5 — Single LLM call ---------- */
const P5_OPTS = [
  { id: 'a', label: 'The model automatically continues.', fb: 'Not quite — the model only produces a response. It does not decide what happens next. Maya does.' },
  { id: 'b', label: 'Maya decides whether to accept, revise, or stop.', correct: true, fb: 'Correct. Maya evaluates the response and determines the next action.' },
];
function Page5({ st, set, beat }) {
  const lit = beat >= 1 ? 3 : 2;
  const gray = beat >= 2;
  const solved = st.q && st.q.solved;
  return (
    <div className="page" data-screen-label="05 Single LLM Call">
      <PageHead kicker={<><Icon name="bubble" size={16} /> Approach 1</>} title="Single LLM Call" />
      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <div className="card">
            <div className="chat">
              <div className="bubble bubble-user">
                <div className="bubble-who"><Icon name="user" size={13} sw={2.4} /> Maya</div>
                Give me five headline ideas for Campus Sustainability Week.
              </div>
              <div className={'bubble bubble-model ' + (gray ? 'is-gray' : '')} data-hl="headlines" aria-label="The model produces five headline ideas">
                <div className="bubble-who"><Icon name="model" size={13} sw={2.4} /> Model</div>
                <ul className="hl-list" aria-hidden="true">
                  {[78, 64, 86, 58, 72].map((w, i) => <li key={i}><span className="n">{i + 1}</span><i style={{ width: w + '%' }} /></li>)}
                </ul>
              </div>
              <div className="retry-cue" style={{ opacity: gray ? 1 : 0 }}><Icon name="replay" size={16} sw={2.2} /> try again?</div>
            </div>
          </div>
          <div className="card flat" style={{ padding: '14px 18px' }} data-hl="line">
            <div className="label-mono" style={{ marginBottom: 6 }}>Process: USER REQUEST → MODEL RESPONSE</div>
            <LineDiagram lit={lit} hlReturn="return" />
          </div>
        </div>
        <div className="stack">
          <div className="qcard">
            <Choice q="The headlines are not quite right. Who determines what happens next?" options={P5_OPTS} state={st.q} onChange={q => set({ q })} />
          </div>
          {solved && <Summary kind="single" title="Single LLM Call" items={['One bounded request', 'One primary response', 'The user determines the next action']} />}
        </div>
      </div>
    </div>
  );
}
PAGES.push({
  id: 'p5', phase: 1, title: 'Single LLM Call', accent: 'var(--user)',
  narration: () => [
    { t: 'In a single LLM call, the user gives the model one bounded request, and the model produces one primary response.', hl: 'line' },
    { parts: [
      { t: 'The model produces a response,', hl: 'headlines' },
      { t: 'but it does not manage a continuing process.', hl: 'return' },
    ] },
    { t: 'This may be enough for a focused task. But what if Maya repeats the same production process every week?', hl: 'headlines' },
  ],
  isComplete: (st) => !!(st.q && st.q.solved),
  lockHint: 'Answer the question correctly',
  Component: Page5,
});

/* ---------- Page 6 — Fixed workflow ---------- */
const P6_STEPS = [
  { id: 'resize', label: 'Resize the design', short: 'Resize', ai: true },
  { id: 'check', label: 'Check the required dimensions', short: 'Check dimensions' },
  { id: 'name', label: 'Apply file-naming rules', short: 'Apply naming rules', ai: true },
  { id: 'export', label: 'Export to predefined folders', short: 'Export' },
];
const P6_POOL_ORDER = ['name', 'export', 'resize', 'check'];
const P6_CORRECT = ['resize', 'check', 'name', 'export'];
const P6_MIS = [
  { id: 'a', label: 'Yes, because it contains multiple steps.', fb: 'Not quite — count the steps or the tools all you like; the question is whether the path was defined in advance. It was.' },
  { id: 'b', label: 'Yes, because it uses several tools.', fb: 'Not quite — count the steps or the tools all you like; the question is whether the path was defined in advance. It was.' },
  { id: 'c', label: 'No, because its major path is predefined.', correct: true, fb: 'Correct. Multiple steps and automation do not automatically create agency.' },
];
const P6_EDGE_FB = 'The workflow has no predefined rule for this case, so it cannot choose a path on its own — it must stop and notify Maya (or follow a rule Maya defined in advance).';
const P6_EDGE = [
  { id: 'a', label: 'Stop and notify Maya', fb: P6_EDGE_FB, fbKind: 'hint' },
  { id: 'b', label: 'Search another asset library', fb: P6_EDGE_FB, fbKind: 'hint' },
  { id: 'c', label: 'Generate a replacement logo', fb: P6_EDGE_FB, fbKind: 'hint' },
];
const stepById = (id) => P6_STEPS.find(s => s.id === id);

function DeliverableMock({ kind }) {
  const dims = { poster: [54, 72], social: [56, 56], banner: [96, 30] }[kind];
  const label = { poster: 'Large poster', social: 'Social post', banner: 'Email banner' }[kind];
  return (
    <div className="deliv">
      <div className="deliv-art" style={{ width: dims[0], height: dims[1] }}><i /><b /></div>
      <span>{label}</span>
    </div>
  );
}

function Page6({ st, set, seg }) {
  const order = st.order || [];
  const checked = st.checked;
  const ran = !!st.ran;
  const [runIdx, setRunIdx] = useState(ran ? 99 : -1);
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const ordered = checked === 'right';
  const pool = P6_POOL_ORDER.filter(id => !order.includes(id));

  const addStep = (id, at) => {
    if (ordered) return;
    FX.tap();
    let next = order.filter(x => x !== id);
    if (at == null || at >= next.length) next.push(id); else next.splice(at, 0, id);
    next = next.slice(0, 4);
    const upd = { order: next, checked: undefined };
    if (next.length === 4) {
      upd.checked = next.every((x, i) => x === P6_CORRECT[i]) ? 'right' : 'wrong';
      setTimeout(() => FX.tap(upd.checked === 'right' ? 'ok' : 'bad'), 120);
    }
    set(upd);
  };
  const removeStep = (id) => { if (ordered) return; FX.tap(); set({ order: order.filter(x => x !== id), checked: undefined }); };
  const reset = () => { FX.tap(); set({ order: [], checked: undefined }); };
  const run = () => {
    FX.tap(); setRunIdx(0);
    let i = 0;
    const tick = () => { i++; setRunIdx(i); if (i < 5) setTimeout(tick, 650); else set({ ran: true }); };
    setTimeout(tick, 650);
  };
  const misSolved = st.mis && st.mis.solved;
  const edgeDone = st.edge && st.edge.solved;

  return (
    <div className="page" data-screen-label="06 Fixed Workflow">
      <PageHead kicker={<><Icon name="chain" size={16} /> Approach 2</>} title="Fixed Workflow" sub="Every approved design must be prepared in the same way."
        right={<div className="delivs" data-hl="delivs"><DeliverableMock kind="poster" /><DeliverableMock kind="social" /><DeliverableMock kind="banner" /></div>} />
      <div className="p6">
        {/* Part 1 */}
        <div className="part card" data-hl="chain">
          <div className="part-top">
            <span className={'part-n ' + (ran ? 'is-done' : '')}>{ran ? <Icon name="check" size={15} sw={2.8} /> : 1}</span>
            <div className="q-text">Arrange the steps in the order the system should perform them.</div>
          </div>
          {!ordered && (
            <>
              <div className="q-head"><span className="label-mono">Unsorted steps</span><FF>Tap in sequence — or drag</FF></div>
              <div className="pool" role="group" aria-label="Unsorted steps">
                {pool.map(id => {
                  const s = stepById(id);
                  return (
                    <button key={id} type="button" className="pstep tap" draggable data-hl={'s-' + id}
                      onDragStart={(e) => { setDragId(id); e.dataTransfer.setData('text/plain', id); }}
                      onDragEnd={() => { setDragId(null); setOver(null); }}
                      onClick={() => addStep(id)}>
                      <span className="grip" aria-hidden="true">⋮⋮</span>{s.label}
                    </button>
                  );
                })}
                {pool.length === 0 && <span className="muted-line">All steps placed.</span>}
              </div>
            </>
          )}
          {!ordered ? (
            <>
              <div className={'slots ' + (checked === 'wrong' ? 'is-wrong' : '')}>
                {[0, 1, 2, 3].map(i => {
                  const id = order[i];
                  const s = id && stepById(id);
                  return (
                    <Fragment key={i}>
                      {s ? (
                        <button type="button" className="slot is-filled tap" data-hl={'s-' + id} onClick={() => removeStep(id)} aria-label={`Step ${i + 1}: ${s.label}. Tap to remove`}
                          onDragOver={(e) => { e.preventDefault(); setOver(i); }} onDragLeave={() => setOver(null)}
                          onDrop={(e) => { e.preventDefault(); const d = e.dataTransfer.getData('text/plain') || dragId; setOver(null); if (d) addStep(d, i); }}>
                          <span className="slot-n">{i + 1}</span>{s.label}
                        </button>
                      ) : (
                        <div className={`slot ${over === i ? 'is-over' : ''}`}
                          onDragOver={(e) => { e.preventDefault(); setOver(i); }} onDragLeave={() => setOver(null)}
                          onDrop={(e) => { e.preventDefault(); const d = e.dataTransfer.getData('text/plain') || dragId; setOver(null); if (d) addStep(d, i); }}>
                          <span className="slot-n">{i + 1}</span>—
                        </div>
                      )}
                      {i < 3 && <span className={'carrow ' + (checked === 'wrong' ? 'is-gap' : '')} aria-hidden="true">
                        {checked === 'wrong' ? <span className="gap-mark">×</span> : <svg viewBox="0 0 30 12" width="30" height="12" style={{ opacity: .3 }}><path d="M1 6H25" /><path d="M21 1.5L27 6L21 10.5" /></svg>}
                      </span>}
                    </Fragment>
                  );
                })}
              </div>
              <div className="chain-tag" data-hl="tag"><Icon name="rules" size={15} sw={2} /> defined in advance</div>
            </>
          ) : (
            <ChainDiagram input="Approved design" active={runIdx} tagHl="tag"
              steps={P6_STEPS.map(s => ({ label: s.short, ai: s.ai, hl: 's-' + s.id }))} />
          )}
          <div aria-live="polite">
            {checked === 'wrong' && (
              <div className="fb fb-bad">
                <span className="fb-ic"><Icon name="x" size={15} sw={2.4} /></span>
                <div className="fb-body"><p>The chain does not connect. The correct order is: Resize → Check dimensions → Apply naming rules → Export.</p>
                  <button type="button" className="btn ghost tap" style={{ marginTop: 10, minHeight: 40 }} onClick={reset}><Icon name="undo" size={16} /> Clear and retry</button></div>
              </div>
            )}
          </div>
          {ordered && (
            <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn tap" onClick={run} disabled={runIdx >= 0 && runIdx < 5}>
                <Icon name="play" size={15} /> {ran ? 'Run again' : 'Run Workflow'}
              </button>
              {ran && <span className="predef reveal"><Icon name="rules" size={20} /> The path is predefined.</span>}
            </div>
          )}
        </div>

        <div className="stack" style={{ gap: 14 }}>
          {/* Part 2 */}
          {misSolved && st.edge && st.edge.last != null && !(st._open || {}).mis ? (
            <Answered tag="2 · Is it an AI agent?" label="No, because its major path is predefined." onEdit={() => { FX.tap(); set({ _open: { mis: true } }); }} />
          ) : (
            <div className={'part card ' + (ran ? '' : 'is-locked')}>
              <div className="part-top"><span className={'part-n ' + (misSolved ? 'is-done' : '')}>{misSolved ? <Icon name="check" size={15} sw={2.8} /> : 2}</span>
                {!ran && <span className="muted-line"><Icon name="lock" size={14} /> Finish part 1 first</span>}</div>
              <Choice q="This workflow contains four steps and two AI tools. Is it an AI agent?" options={P6_MIS} state={st.mis} onChange={mis => set({ mis })} />
              {misSolved && st.edge && st.edge.last != null && <button type="button" className="linkbtn tap" onClick={() => { FX.tap(); set({ _open: {} }); }}>Collapse</button>}
            </div>
          )}
          {/* Part 3 */}
          <div className={'part card edge ' + (misSolved ? '' : 'is-locked')} data-hl="edge">
            <div className="part-top"><span className={'part-n ' + (edgeDone ? 'is-done' : '')}>{edgeDone ? <Icon name="check" size={15} sw={2.8} /> : 3}</span>
              <div className="edge-warn"><Icon name="alert" size={16} sw={2.2} /> Official logo not found.</div></div>
            <ChainDiagram compact tag={false} state="broken" gapAfter={1} input="Approved design"
              steps={P6_STEPS.map((s, i) => ({ label: s.short, dim: i > 1 }))} />
            <Choice mode="any" q="What can the workflow do here?" options={P6_EDGE} state={st.edge} onChange={edge => set({ edge })} layout="row" prefix={() => '?'} />
          </div>
          {edgeDone && <Summary kind="workflow" title="Fixed Workflow" items={['Steps and order are defined in advance', 'Major decision rules are predefined', 'The system executes within that structure']} />}
        </div>
      </div>
    </div>
  );
}
PAGES.push({
  id: 'p6', phase: 1, title: 'Fixed Workflow', accent: 'var(--rules)',
  narration: () => [
    { t: "Maya's poster needs to become three things: a large poster, a small social post, and an email banner.", hl: 'delivs' },
    { t: 'The same four steps run for each one.', hl: 'chain' },
    { parts: [
      { t: 'Resize,', hl: 's-resize' },
      { t: 'check the dimensions,', hl: 's-check' },
      { t: 'apply the naming rule,', hl: 's-name' },
      { t: 'export.', hl: 's-export' },
    ] },
    { t: 'The steps are fixed. The rules are fixed. The model does not decide anything while it runs.', hl: 'tag', key: true },
    { t: 'What happens if the logo is missing? The workflow has no step for that. It stops, and a person has to step in.', hl: 'edge' },
  ],
  isComplete: (st) => !!(st.ran && st.mis && st.mis.solved && st.edge && st.edge.solved),
  lockHint: 'Complete all three parts',
  Component: Page6,
});

/* ---------- Page 7 — When agentic decisions help ---------- */
const P7_DESIGNS = [
  { id: 'A', who: 'user', text: 'Design A: the user writes the content and places every element.', poster: 'brand' },
  { id: 'B', who: 'rules', text: 'Design B: a fixed set of rules places the elements.', poster: 'grid' },
  { id: 'C', who: 'model', text: 'Design C: the model decides the layout while it works.', poster: 'free' },
];
const P7_ANS = { single: 'A', workflow: 'B', agent: 'C' };
const P7_OPTS = [
  { id: 'yes', label: 'Yes', fb: 'Not quite — each design has a different problem, so the same sequence will not work for all three.' },
  { id: 'no', label: 'No', correct: true, fb: 'Not reliably. The appropriate next action depends on what the system discovers in each case.' },
];
function Page7({ st, set, say }) {
  const sort = st.sort || {};
  const m = useMatcher({
    tokens: P7_DESIGNS.map(d => ({ id: d.id, label: 'Design ' + d.id })), targets: ['single', 'workflow', 'agent'].map(id => ({ id })), answers: P7_ANS,
    state: sort, set: (p) => set({ sort: { ...sort, ...p } }),
    hint: 'Think about who decides the next step in each system.', trayHl: 'designs', trayLabel: 'Tap a design, then tap the approach it belongs to',
    renderToken: (tk, used, placed) => placed
      ? <span className="dtoken is-placed">Design {tk.id}</span>
      : <span className={'dtoken ' + (used ? 'is-used' : '')}>{tk.label}</span>,
  });
  const onChange = (q) => {
    const was = st.q && st.q.solved;
    set({ q });
    if (q.solved && !was) say([
      { t: 'Not reliably. The appropriate next action depends on what the system discovers in each case.', hl: 'q7' },
      { t: 'This is where agentic decision-making can create value.', hl: 'next' },
    ]);
  };
  const problems = ['Poor text contrast', 'Inconsistent spacing', 'Incorrect brand assets'];
  return (
    <div className="page" data-screen-label="07 When Agency Helps">
      <PageHead kicker="Compare" title="When Agentic Decision-Making Becomes Useful" />
      <div className="cq-mid" data-hl="cq">Who decides what happens next?</div>
      <div className="p7">
        <div className="card stack" style={{ gap: 14 }}>
          <div className="dcards">
            {P7_DESIGNS.map(d => (
              <div key={d.id} className="dcard" data-hl={'d' + d.id}>
                <Poster v={d.poster === 'brand' ? 'brand' : 'brand'} className={'mini lay-' + d.poster} />
                <p><b>Design {d.id}:</b> {d.text.replace(/^Design [ABC]: /, '')}</p>
              </div>
            ))}
          </div>
          {m.ui.tray}
          <div className="sortrow" data-hl="sort">
            {['single', 'workflow', 'agent'].map(a => (
              <div key={a} className="sortcol">
                <div className="sortcol-h"><Icon name={APPROACHES[a].icon} size={18} /> {APPROACHES[a].label}</div>
                {m.ui.slot(a)}
              </div>
            ))}
          </div>
          {m.ui.feedback}
          {m.allDone && <Feedback kind="ok" text="Design A → Single LLM Call. Design B → Fixed Workflow. Design C → AI Agent." />}
        </div>
        <div className={'card stack ' + (m.allDone ? '' : 'part is-locked')} style={{ gap: 14 }} data-hl="review">
          <p className="psub" style={{ margin: 0 }}>Maya needs AI to review several designs.</p>
          <div className="probs">
            {problems.map((p, i) => <div key={p} className="callout"><span className="cn">{i + 1}</span>{p}</div>)}
          </div>
          <div>
            <div className="label-mono" style={{ marginBottom: 8 }}>One fixed revision sequence, applied to all three</div>
            <ChainDiagram compact tag={false} steps={[{ label: 'Increase text contrast' }, { label: 'Export' }]} input="Design" />
            <div className="fitrow" style={{ marginTop: 10 }}>
              <div className="fit ok"><Icon name="check" size={15} sw={2.6} /> 1 fits</div>
              <div className="fit no"><Icon name="x" size={15} sw={2.6} /> 2 does not fit</div>
              <div className="fit no"><Icon name="x" size={15} sw={2.6} /> 3 does not fit</div>
            </div>
          </div>
          <div data-hl="q7">
            <Choice q="Can Maya define one identical revision sequence for all three designs?" options={P7_OPTS} state={st.q} onChange={onChange} layout="row" />
          </div>
        </div>
      </div>
    </div>
  );
}
PAGES.push({
  id: 'p7', phase: 2, title: 'When Agentic Decision-Making Becomes Useful',
  narration: () => [
    { t: 'Three designs, three questions. For each one, ask: who decides what happens next?', hl: 'cq', key: true },
    { t: 'Design A: the user writes the content and places every element.', hl: 'dA' },
    { t: 'Design B: a fixed set of rules places the elements.', hl: 'dB' },
    { t: 'Design C: the model decides the layout while it works.', hl: 'dC' },
    { t: 'Sort them — which is a single call, which is a workflow, which is an agent?', hl: 'sort' },
    { t: 'Now Maya needs AI to review several designs. Each design may contain a different problem, and each problem may require a different action or tool.', hl: 'review' },
  ],
  isComplete: (st) => !!(st.sort && ['single', 'workflow', 'agent'].every(a => (st.sort.matched || {})[a]) && st.q && st.q.solved),
  lockHint: 'Sort the designs, then answer the question',
  Component: Page7,
});

/* ---------- Page 8 — AI agent & boundaries ---------- */
const P8_LOOP = [
  { k: 'GOAL', t: null, cls: 'is-goal' },
  { k: 'OBSERVE', t: 'The headline is difficult to read, but the logo and brand colors are correct.' },
  { k: 'DECIDE', t: 'Improving contrast is more important than changing the overall visual style.', cls: 'is-decide' },
  { k: 'ACT', t: 'Adjust the text background and spacing.' },
  { k: 'CHECK', t: 'Does the revision now meet the readability and brand criteria?' },
  { k: 'CONTINUE · STOP · ESCALATE', t: 'The readability criterion is met. No additional revision is required.', cls: 'is-out' },
];
const P8_GOAL = 'Review each visual, identify its most important issue, and improve it while preserving the brand guidelines.';
const P8_OTHER_FB = 'That step follows a rule or a previous decision. The decision that sets the path is identifying the most important problem.';
const P8_LOG = [
  { id: 1, label: 'Read the brief', fb: P8_OTHER_FB },
  { id: 2, label: 'Read the brand guidelines', fb: P8_OTHER_FB },
  { id: 3, label: 'Identify the most important design problem', correct: true, fb: 'Correct. This decision determines which path the system will follow. Different designs may lead to different actions.' },
  { id: 4, label: 'Choose an appropriate tool', fb: 'Choosing a tool matters, but it follows from the problem identified. The decision that sets the path is identifying the most important problem.' },
  { id: 5, label: 'Revise the design', fb: P8_OTHER_FB },
  { id: 6, label: 'Evaluate the result', fb: P8_OTHER_FB },
];
const P8_HC = [
  { id: 'a', label: 'Allow the agent to proceed.', fb: 'Not quite — replacing official brand assets is an identity-related decision. It should remain under human control.' },
  { id: 'b', label: 'Require human approval.', correct: true, fb: 'Some consequential, subjective, or identity-related decisions should remain under human control.' },
  { id: 'c', label: 'Remove the brand guidelines.', fb: 'Removing the guidelines does not solve the problem — it removes the boundary that keeps the agent\'s work aligned with the brand.' },
];
function Page8({ st, set, beat, seg }) {
  const [cyc, setCyc] = useState(-1);
  useEffect(() => {
    if (seg !== 3) { setCyc(-1); return; }
    let i = 1; setCyc(1);
    const t = setInterval(() => { i = i >= 4 ? 1 : i + 1; setCyc(i); }, 1100);
    return () => clearInterval(t);
  }, [seg]);
  const loopLit = beat >= 3 ? 6 : beat >= 2 ? 3 : 1;
  const traceN = st.trace || 1;
  const logSolved = st.log && st.log.solved;
  const hcSolved = st.hc && st.hc.solved;
  const hcLast = st.hc && st.hc.last;
  return (
    <div className="page" data-screen-label="08 AI Agent">
      <PageHead kicker={<><Icon name="loop" size={16} /> Approach 3</>} title="AI Agent and Human Boundaries" />
      <div className="p8">
        <div className="setup">
          <div className="setup-block goal" data-hl="goal"><span className="label-mono">Goal</span><p>{P8_GOAL}</p></div>
          <div className={'setup-block ' + (beat >= 1 ? '' : 'is-dim')} data-hl="ctx"><span className="label-mono">Context</span>
            <ul><li>Design brief</li><li>Brand guidelines</li><li>Previously approved examples</li></ul></div>
          <div className={'setup-block ' + (beat >= 1 ? '' : 'is-dim')} data-hl="tools"><span className="label-mono">Tools</span>
            <ul><li>Image editor</li><li>Asset library</li><li>Accessibility checker</li><li>Export tool</li></ul></div>
          <div className={'setup-block bounds ' + (beat >= 1 ? '' : 'is-dim')} data-hl="bounds"><span className="label-mono">Boundaries</span>
            <ul><li>Do not replace official brand assets.</li><li>Request approval before changing the overall creative direction.</li></ul></div>
        </div>
        <div className="fence" data-hl="fence">
          <span className="fence-label">BOUNDARY</span>
          <div className="vloop" role="list" aria-label="Agent loop" data-hl="loop">
            {P8_LOOP.map((s, i) => (
              <Fragment key={s.k}>
                <div role="listitem" className={`vstep ${s.cls || ''} ${i < loopLit ? 'is-lit' : ''} ${cyc === i ? 'is-current' : ''}`}>
                  <span className="vstep-k">{s.cls === 'is-decide' && <Icon name="model" size={13} sw={2.4} />}{s.k}</span>
                  <span className="vstep-t">{s.t || <em>{P8_GOAL}</em>}</span>
                </div>
                {i < P8_LOOP.length - 1 && <div className="vdown" aria-hidden="true"><span><Icon name="down" size={14} /></span></div>}
              </Fragment>
            ))}
          </div>
          <div className="loopback"><Icon name="loop" size={13} /> Continue loops back to OBSERVE</div>
          <div className="gate-wrap" data-hl="gate">
            <span className="proposal-box"><Icon name="model" size={13} sw={2.4} /> "Replace the official university logo with a newly generated version."</span>
            <span className={'proposal-arrow ' + (hcSolved ? 'is-stopped' : '')} aria-hidden="true" />
            <span className={'gate ' + (hcLast === 'c' ? 'is-open' : '')} aria-label="Approval gate">
              <span className="gate-bar" /><span className="gate-t">APPROVAL</span>
            </span>
          </div>
        </div>
        <div className="p8-q">
          <QSeq st={st} set={set} items={[
            { key: 'log', tag: '1 · Activity log', render: () => (
              <>
                <Choice q="Which step most clearly demonstrates agentic decision-making?" options={P8_LOG} state={st.log}
                  onChange={log => set({ log, trace: 6 })} visibleCount={logSolved ? 6 : traceN} prefix={(i) => String(i + 1)} ff="Advance the log, then choose" />
                {!logSolved && traceN < 6 && (
                  <button type="button" className="btn ghost tap" style={{ marginTop: 10, minHeight: 44 }} onClick={() => { FX.tap(); set({ trace: traceN + 1 }); }}>
                    <Icon name="right" size={16} /> Next step in the log ({traceN}/6)
                  </button>
                )}
              </>
            ), options: P8_LOG },
            { key: 'hc', tag: '2 · Human-control decision', render: () => (
              <>
                <p style={{ marginBottom: 8 }}>The agent proposes: <b>"Replace the official university logo with a newly generated version."</b></p>
                <Choice q="What should happen next?" options={P8_HC} state={st.hc} onChange={hc => set({ hc })} />
              </>
            ), options: P8_HC },
          ]} />
          {hcSolved && (
            <div className="stack reveal" style={{ gap: 12 }}>
              <div className="statement"><span>Agency is delegated decision-making within boundaries.</span></div>
              <Summary kind="agent" title="AI Agent" items={['Works toward a defined goal', 'Interprets the current context', 'Determines the next action during execution', 'Uses tools within defined boundaries', 'Checks results and decides whether to continue, stop, or escalate']} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
PAGES.push({
  id: 'p8', phase: 2, title: 'AI Agent and Human Boundaries', accent: 'var(--model)',
  narration: () => [
    { t: 'Maya gives the system a goal.', hl: 'goal' },
    { parts: [
      { t: 'She also provides the context,', hl: 'ctx' },
      { t: 'tools, criteria,', hl: 'tools' },
      { t: 'and boundaries that the system may use.', hl: 'bounds' },
    ] },
    { t: 'Unlike the fixed workflow, Maya does not define every action in advance. The model must use the current situation to determine what to do next.', hl: 'loop' },
    { t: 'An AI agent is not simply a longer workflow. Its defining feature is that the model uses context to determine the next action during execution.', hl: 'loop', key: true },
    { parts: [
      { t: 'Agentic decision-making does not mean unlimited autonomy.', hl: 'fence' },
      { t: 'A well-designed agent operates within a defined goal, evaluation criteria, available tools, and human approval boundaries.', hl: 'gate' },
    ] },
  ],
  isComplete: (st) => !!(st.log && st.log.solved && st.hc && st.hc.solved),
  lockHint: 'Answer both questions correctly',
  Component: Page8,
});
