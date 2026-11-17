/* Pages 9–13 */

/* ---------- Page 9 — Compare ---------- */
function Page9({ st, set, beat }) {
  const struck = beat >= 1 || !!st.submitted;
  const text = st.text || '';
  const submitted = st.submitted;
  const editing = st.editing;
  const [err, setErr] = useState(false);
  const submit = () => {
    if (!text.trim()) { FX.tap('bad'); setErr(true); return; }
    FX.tap('ok'); setErr(false);
    set({ submitted: text.trim(), editing: false, self: editing ? undefined : st.self });
  };
  const rows = [
    ['single', 'Produces a response', 'user', 'The user'],
    ['workflow', 'Executes predefined steps', 'rules', 'Human-designed rules'],
    ['agent', 'Selects actions based on context', 'model', 'The model, within boundaries'],
  ];
  return (
    <div className="page" data-screen-label="09 Compare">
      <PageHead kicker="Compare" title="Compare the Three Systems" />
      <div className="p9">
        <div className="stack" style={{ gap: 14 }}>
          <div className="card flat display">
            <div className="minis">
              <div data-hl="m-single"><LineDiagram width={210} /></div>
              <div data-hl="m-workflow" style={{ justifyContent: 'center' }}><ChainMini width={200} /></div>
              <div data-hl="m-agent"><LoopMini width={124} /></div>
            </div>
          </div>
          <table className="ctable display">
            <thead><tr><th>Approach</th><th>AI's Role</th><th data-hl="deciders">Who Determines the Next Action?</th></tr></thead>
            <tbody>
              {rows.map(([a, role, who, lbl]) => (
                <tr key={a} data-hl={'row-' + a}>
                  <td><span className="cell-a"><Icon name={APPROACHES[a].icon} size={20} />{APPROACHES[a].lower}</span></td>
                  <td>{role}</td>
                  <td><DeciderBadge who={who} label={lbl} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p9-line">
            <div className={'crossed ' + (struck ? 'is-struck' : '')} data-hl="crossed" aria-label="Not the difference: number of prompts, number of tools, number of steps">
              <span>Number of prompts</span><span>Number of tools</span><span>Number of steps</span>
            </div>
            <Icon name="right" size={22} style={{ color: 'var(--ink3)' }} />
            <div className="howq" data-hl="howq">How is the next action determined?</div>
          </div>
        </div>
        <div className="qcard">
          <div className="q-head" style={{ marginBottom: 10 }}>
            <label className="q-text" htmlFor="p9-text">In one sentence, explain what makes an AI agent different from a fixed workflow.</label>
            <FF icon="hand">Type, then submit</FF>
          </div>
          <textarea id="p9-text" className={'textarea ' + (err ? 'is-error' : '')} rows={3} value={text} readOnly={!!submitted && !editing} aria-invalid={err}
            onChange={e => { set({ text: e.target.value }); if (err) setErr(false); }} placeholder="Write one sentence…" />
          {(!submitted || editing) && (
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn tap" disabled={editing && text.trim() === submitted} onClick={submit}>
                <Icon name="check" size={17} sw={2.4} /> {editing ? 'Resubmit' : 'Submit'}
              </button>
            </div>
          )}
          {err && <Feedback kind="error" text="Please write a sentence before submitting." />}
          {submitted && !editing && (
            <div className="stack reveal" style={{ marginTop: 14, gap: 12 }}>
              <div className="modelx"><span className="label-mono">Model explanation</span>A fixed workflow follows steps and major rules defined before execution, while an AI agent uses context to determine its next action during execution.</div>
              <Choice mode="any" ff="Tap to choose" options={[
                { id: 'ok', label: 'My explanation captured this distinction.', fb: '' },
                { id: 'rev', label: 'I need to revise my explanation.', fb: '' },
              ]} state={st.self} onChange={self => set({ self, editing: self.last === 'rev' })} className="selfcheck" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
PAGES.push({
  id: 'p9', phase: 2, title: 'Compare the Three Systems',
  narration: () => [
    { t: 'So how do you tell them apart? Ask who determines what happens next.', hl: 'deciders', key: true },
    { t: 'The number of prompts, the number of tools, the number of steps — none of those decide it.', hl: 'crossed' },
    { t: 'A workflow can use five tools and still not be an agent.', hl: 'row-workflow' },
    { t: 'And an agent can be just one loop.', hl: 'row-agent' },
    { t: 'The approach is decided by who decides, not by how much happens.', hl: 'howq', key: true },
  ],
  isComplete: (st) => !!(st.submitted && st.self && st.self.solved && !st.editing),
  lockHint: 'Submit a sentence and complete the self-check',
  Component: Page9,
});

/* ---------- Product card mockups (Page 10) ---------- */
function ProductShape({ k, color }) {
  const shapes = {
    mug: <><rect x="10" y="14" width="22" height="24" rx="3" /><path d="M32 20h4a4 4 0 0 1 0 8h-4" fill="none" stroke={color} strokeWidth="3" /></>,
    bottle: <><rect x="17" y="4" width="8" height="8" rx="1.5" /><rect x="12" y="11" width="18" height="31" rx="5" /></>,
    bag: <><path d="M8 16h28l-3 26H11z" /><path d="M15 16a7 7 0 0 1 14 0" fill="none" stroke={color} strokeWidth="3" /></>,
    lamp: <><path d="M12 6h18l5 16H7z" /><rect x="19" y="22" width="4" height="16" /><rect x="12" y="38" width="18" height="4" rx="2" /></>,
    shoe: <path d="M5 26c6 0 9-8 13-8 2 4 7 6 14 7 4 1 6 4 6 8v3H5z" />,
  };
  return <svg viewBox="0 0 44 44" width="100%" height="100%" fill={color}>{shapes[k]}</svg>;
}
const P10_ITEMS = ['mug', 'bottle', 'bag', 'lamp', 'shoe'];
const P10_BEFORE = [
  { bg: 'linear-gradient(135deg,#FF8A65,#FFD54F)', c: '#5D1D8A', pos: { left: '8%', top: '10%', width: '50%' } },
  { bg: '#1B1B1B', c: '#00E5FF', pos: { left: '8%', top: '10%', width: '50%' } },
  { bg: '#E3F2FD', c: '#E53935', pos: { left: '8%', top: '10%', width: '50%' } },
  { bg: 'repeating-linear-gradient(45deg,#C8E6C9,#C8E6C9 6px,#A5D6A7 6px,#A5D6A7 12px)', c: '#4E342E', pos: { left: '8%', top: '10%', width: '50%' } },
  { bg: '#F8BBD0', c: '#1A237E', pos: { left: '30%', top: '45%', width: '62%' } },
];
const P10_Q1 = [
  { id: 'single', label: 'A single LLM call', fb: 'That is the current approach, and it is the one failing. One request per photo, with no shared style guide and no check, is exactly why the photos do not match.' },
  { id: 'workflow', label: 'A fixed workflow', correct: true, fb: 'Correct. The style rules can be written down in advance, and the same steps repeat for every photo. The current problem is a lack of a fixed specification and a check. Once the style guide and the checklist exist, the same process runs for every card.' },
  { id: 'agent', label: 'An AI agent', fb: 'It seems like judging style is a decision. But here the criteria for background, layout and colors are fixed in advance. The work needs a specification and a check, not runtime decision-making. Agents can apply the predefined checklist, but it is unnecessary, since the fixed workflow can already fulfill the current needs.' },
];
const P10_Q2 = [
  { id: 'guide', label: "The app's visual style can be written down as a fixed guide.", correct: true, fb: 'Correct. The defining evidence is that the criteria can be fixed before execution. That is what makes a workflow the best fit.' },
  { id: 'diff', label: 'Each photo needs a different visual idea.', fb: 'Not quite. The products are different, but the style is the same for every photo. Do not confuse product variety with style variety. The style is what must stay consistent.' },
  { id: 'judge', label: 'The image model needs to judge whether each photo looks good.', fb: "Not quite. 'Looks good' here means a check against fixed criteria, but not a runtime decision. This is what a workflow does, but is not a decisive and direct evidence for the choice of workflow." },
  { id: 'one', label: 'The photos must be made one at a time.', fb: 'Not quite. Making photos one at a time does not make the approach a single call. The process repeats the same steps for every photo — that is a workflow.' },
];
const approachLabel = (o) => <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon name={APPROACHES[o.id].icon} size={19} />{o.label}</span>;
function Page10({ st, set }) {
  return (
    <div className="page" data-screen-label="10 Practice 1">
      <PageHead kicker="Practice 1" title="Shopping App Product Photos" />
      <div className="p10">
        <div className="stack" style={{ gap: 14 }}>
          <div className="scenario" data-hl="scenario">
            <span className="label-mono">Scenario</span>
            You are building a shopping app for a course project. The app needs product photos for dozens of items, and all the photos must share the same visual style, including the same background, the same card layout, and the same overall tone, so the app looks like one product, not a collage. The app already has a defined visual style: a plain background, the product centered, and the app's two brand colors. Right now you generate each photo with a single request to an image model. The results are poor: many photos repeat the same composition, and many do not match the app's visual tone. You keep writing extra prompts to fix each photo, but the next photo breaks the style again.
          </div>
          <div className="card flat stack display" style={{ gap: 10 }} aria-label="Before and after product cards">
            <div className="prow">
              <span className="prow-k">Before</span>
              <div className="pcards">
                {P10_BEFORE.map((b, i) => (
                  <div key={i} className="pcard" style={{ background: b.bg }}>
                    <div className="prod" style={{ ...b.pos, aspectRatio: '1' }}><ProductShape k={i === 3 ? 'mug' : P10_ITEMS[i]} color={b.c} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="prow">
              <span className="prow-k">After</span>
              <div className="pcards after">
                {P10_ITEMS.map(k => (
                  <div key={k} className="pcard"><div className="prod"><ProductShape k={k} color="#1F4E79" /></div><div className="bar" /></div>
                ))}
              </div>
            </div>
            <div className="prow">
              <span />
              <div className="checklist"><span><Icon name="check" size={14} sw={2.8} /> Background</span><span><Icon name="check" size={14} sw={2.8} /> Layout</span><span><Icon name="check" size={14} sw={2.8} /> Colors</span></div>
            </div>
            <ChainDiagram compact steps={[{ label: 'Fixed style guide' }, { label: 'Generate', ai: true }, { label: 'Check against guide' }, { label: 'Publish or retry' }]} />
          </div>
        </div>
        <div data-hl="questions">
          <QSeq st={st} set={set} items={[
            { key: 'q1', tag: 'Q1', q: 'Which approach fits this task best?', options: P10_Q1, renderLabel: approachLabel },
            { key: 'q2', tag: 'Q2', q: 'Which evidence best supports your decision?', options: P10_Q2 },
          ]} />
        </div>
      </div>
    </div>
  );
}
PAGES.push({
  id: 'p10', phase: 3, title: 'Practice 1: Shopping App Product Photos',
  narration: () => [
    { t: 'Now try it yourself.', hl: 'scenario' },
    { t: 'Read the scenario and decide which approach fits best.', hl: 'questions' },
  ],
  isComplete: (st) => !!(st.q1 && st.q1.solved && st.q2 && st.q2.solved),
  lockHint: 'Answer Q1 and Q2 correctly',
  Component: Page10,
});

/* ---------- Page 11 — Practice 2 ---------- */
function SlideThumb({ kind }) {
  if (kind === 'flow') return (
    <div className="slide"><svg viewBox="0 0 160 100" width="100%" height="100%">
      <rect x="12" y="10" width="70" height="7" rx="3" fill="#1C2130" />
      {[0, 1, 2].map(i => <g key={i}><rect x={14 + i * 50} y="42" width="34" height="24" rx="5" fill="#fff" stroke="#1C2130" strokeWidth="1.6" />{i < 2 && <path d={`M${49 + i * 50} 54h12`} stroke="#1C2130" strokeWidth="1.6" />}</g>)}
    </svg></div>
  );
  if (kind === 'chart') return (
    <div className="slide"><svg viewBox="0 0 160 100" width="100%" height="100%">
      <rect x="12" y="10" width="56" height="7" rx="3" fill="#1C2130" />
      {[30, 46, 38, 62].map((h, i) => <rect key={i} x={26 + i * 30} y={88 - h} width="18" height={h} rx="2" fill={i === 3 ? '#C2410C' : '#94A3B8'} />)}
      <path d="M18 88h128" stroke="#1C2130" strokeWidth="1.4" />
    </svg></div>
  );
  return (
    <div className="slide" style={{ background: 'linear-gradient(160deg,#3E5C76,#1D2D44)' }}><svg viewBox="0 0 160 100" width="100%" height="100%">
      <circle cx="118" cy="34" r="14" fill="#F4D58D" opacity=".9" />
      <path d="M0 78 L40 52 L70 70 L104 44 L160 76 V100 H0z" fill="#0D1321" opacity=".7" />
      <rect x="14" y="84" width="84" height="6" rx="3" fill="#fff" />
    </svg></div>
  );
}
const P11_Q1 = [
  { id: 'single', label: 'A single LLM call', fb: 'One request produces one deck with no check and no revision. The first version is often wrong for the content, and nothing catches it.' },
  { id: 'workflow', label: 'A fixed workflow', fb: 'A workflow could use a fixed slide template, but the template cannot decide which visual the content needs.' },
  { id: 'agent', label: 'An AI agent', correct: true, fb: "Correct. The visual type depends on interpreting the content of each part. That mapping cannot be written down as a fixed rule, because the same outline could be arranged differently. And the revision requests ('too crowded,' 'make the results stand out') are open-ended, so that the system must decide what to change." },
];
const P11_Q2 = [
  { id: 'outline', label: "The app designs the slides from the student's outline.", fb: 'Not quite. A workflow can also take an outline as input (fill in a template). The input alone does not make it an agent.' },
  { id: 'interp', label: 'The app decides which visual fits each part by interpreting the content.', correct: true, fb: 'Correct. The deciding evidence is that the next action (which visual to use) depends on interpreting this specific content.' },
  { id: 'tmpl', label: 'The app uses a fixed and predefined slide template.', fb: 'Not quite. The template is the fixed part of the task, not the whole task. The decision-making on which visual fits this content is not fixed in the template.' },
];
const P11_Q3 = [
  { id: 1, label: 'Step 1 — take the outline', short: 'Take the outline', fb: 'Not quite. Taking the outline is just receiving the input. The outline is given; there is nothing to decide.' },
  { id: 2, label: 'Step 2 — apply the slide template', short: 'Apply the slide template', fb: 'Not quite. Applying the template is a fixed rule. Nothing is decided at runtime.' },
  { id: 3, label: 'Step 3 — generate the visuals', short: 'Generate the visuals', correct: true, fb: 'Correct. Step 3 is where the decision lives – which visual fits this content. That depends on interpreting the content and cannot be written down in advance. The other steps are fixed rules or file operations.' },
  { id: 4, label: 'Step 4 — export the deck', short: 'Export the deck', fb: 'Not quite. Exporting is a file operation. The format and the destination are fixed in advance.' },
];
function Q3Chain({ st, set }) {
  const q3 = st.q3 || {};
  const pick = (o) => {
    FX.tap(o.correct ? 'ok' : 'bad');
    quizAttempt('p11-q3', !!o.correct, (q3.n || 0) + 1, o.label);
    const tried = (q3.tried || []).includes(o.id) ? q3.tried : [...(q3.tried || []), o.id];
    set({ q3: { tried, solved: !!o.correct, ever: !!q3.ever || !!o.correct, last: o.id, n: (q3.n || 0) + 1 } });
  };
  const last = P11_Q3.find(o => o.id === q3.last);
  return (
    <>
      <p className="q3-text">Suppose the slide app is built as a fixed workflow with four steps: (1) take the outline, (2) apply the slide template, (3) generate the visuals, (4) export the deck. The team wants to add one agent step — the step where the system must make a judgment that cannot be written down in advance. Which step should it be?</p>
      <div className="q-head" style={{ margin: '4px 0 8px' }}><span className="label-mono">Workflow</span><FF>Tap a step</FF></div>
      <div className="decchain" role="radiogroup" aria-label="Workflow steps">
        {P11_Q3.map((o, i) => {
          const sel = q3.last === o.id;
          const agent = sel && o.correct;
          const wrong = sel && !o.correct;
          return (
            <Fragment key={o.id}>
              <button type="button" role="radio" aria-checked={sel} className={`decstep tap ${wrong ? 'is-wrong' : ''} ${agent ? 'is-agent' : ''}`}
                aria-label={o.label} onClick={() => pick(o)}>
                <span className="dn">STEP {o.id}</span>
                {agent ? <Icon name="loop" size={22} sw={2.2} /> : wrong ? <Icon name="x" size={18} sw={2.4} /> : <Icon name="rules" size={18} style={{ color: 'var(--rules-ink)' }} />}
                <span>{o.short}</span>
              </button>
              {i < 3 && <span className="carrow" aria-hidden="true"><svg viewBox="0 0 30 12" width="30" height="12"><path d="M1 6H25" /><path d="M21 1.5L27 6L21 10.5" /></svg></span>}
            </Fragment>
          );
        })}
      </div>
      <div aria-live="polite">{last && <Feedback key={last.id} kind={last.correct ? 'ok' : 'bad'} text={last.fb} />}</div>
    </>
  );
}
function Page11({ st, set }) {
  return (
    <div className="page" data-screen-label="11 Practice 2">
      <PageHead kicker="Practice 2" title="Presentation Slide Designer" />
      <div className="p10">
        <div className="stack" style={{ gap: 14 }}>
          <div className="scenario" data-hl="scenario">
            <span className="label-mono">Scenario</span>
            You are preparing a class presentation, and you need slides. You paste your talk outline into a slide app: the first part explains how a method works, the middle part shows your results, the last part tells a story about why the work matters. The app designs the slides. The methods part becomes a flowchart, the results part becomes a chart, the story part becomes a single image with one line of text. You look at the draft and type, 'This slide is too crowded.' The app spreads the content across two slides. You then type, 'Make the results stand out.' The app makes the chart bigger and bolder. Each time, the app has to figure out what to change and what 'stand out' means for this slide.
          </div>
          <div className="card flat display p11-vis">
            <div className="stack" style={{ gap: 10 }}>
              <div className="slides3">
                {[['flow', 'Method'], ['chart', 'Results'], ['img', 'Story']].map(([k, l]) => <div key={k}><SlideThumb kind={k} /><div className="slide-k">{l}</div></div>)}
              </div>
              <div className="req">
                <div className="bubble bubble-user">This slide is too crowded.</div>
                <div className="bubble bubble-user">Make the results stand out.</div>
              </div>
            </div>
            <LoopMini width={176} nodes={['Read content', 'Decide visual', 'Generate', 'Check', 'Revise']} goal="Outline" out={null} />
          </div>
        </div>
        <div data-hl="questions">
          <QSeq st={st} set={set} items={[
            { key: 'q1', tag: 'Q1', q: 'Which approach fits this task best?', options: P11_Q1, renderLabel: approachLabel },
            { key: 'q2', tag: 'Q2', q: 'Which feature makes this the best fit?', options: P11_Q2 },
            { key: 'q3', tag: 'Q3 · Where is the decision?', options: P11_Q3, render: () => <Q3Chain st={st} set={set} /> },
          ]} />
        </div>
      </div>
    </div>
  );
}
PAGES.push({
  id: 'p11', phase: 3, title: 'Practice 2: Presentation Slide Designer',
  narration: () => [
    { t: 'Now try it yourself.', hl: 'scenario' },
    { t: 'Read the scenario and decide which approach fits best.', hl: 'questions' },
  ],
  isComplete: (st) => !!(st.q1 && st.q1.solved && st.q2 && st.q2.solved && st.q3 && st.q3.solved),
  lockHint: 'Answer Q1, Q2, and Q3 correctly',
  Component: Page11,
});

/* ---------- Page 12 — Return ---------- */
const P12_OPTS = [
  { id: 1, label: 'Where decisions occur', key: true },
  { id: 2, label: 'Whether the path can be predefined', key: true },
  { id: 3, label: 'Whether changing conditions require different actions', key: true },
  { id: 4, label: 'Whether the technology is marketed as agentic', key: false },
];
const choiceLabel = (id) => (APPROACHES[id] ? APPROACHES[id].label : 'an option');
function explanationOf(saved) {
  if (!saved) return '';
  const t = (saved.text || '').trim().replace(/[.!?]+$/, '');
  return t ? t.charAt(0).toLowerCase() + t.slice(1) + '.' : '';
}
function Page12({ st, set, all }) {
  const saved = all.p3 && all.p3.saved;
  const sel = st.sel || [];
  const toggle = (id) => { FX.tap(); set({ sel: sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id], submitted: false }); };
  const versions = [
    ['A', 'Generate five headline directions.', 'single'],
    ['B', 'Resize an approved visual and export the same formats every week.', 'workflow'],
    ['C', 'Inspect different designs, determine the most important issue, choose an action, revise, and evaluate the result.', 'agent'],
  ];
  return (
    <div className="page" data-screen-label="12 Return">
      <PageHead kicker="Reflect" title="Return to the Opening Decision" />
      <div className="p12">
        <div className="stack" style={{ gap: 14 }}>
          <div className="mychoice" data-hl="mychoice">
            <span className="mychoice-k">YOUR PAGE 3 CHOICE</span>
            {saved ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                  <span className="amark"><Icon name={APPROACHES[saved.choice].icon} size={22} /></span>
                  <b style={{ fontFamily: 'var(--f-head)', fontSize: 21 }}>{choiceLabel(saved.choice)}</b>
                </div>
                <blockquote>{saved.text}</blockquote>
              </>
            ) : <p style={{ marginTop: 8, color: 'var(--ink2)' }}>No choice saved.</p>}
            <div className="keepchange" data-hl="keep">
              <Choice mode="any" q="Would you keep or change your choice?" ff="Tap to choose" layout="row" state={st.kc}
                onChange={kc => set({ kc, newChoice: kc.last === 'keep' ? null : st.newChoice })}
                options={[
                  { id: 'keep', label: 'Keep my choice', fb: 'Kept. Check it against the three versions of the task.', fbKind: 'info' },
                  { id: 'change', label: 'Change my choice', fb: st.newChoice ? `Changed to ${choiceLabel(st.newChoice)}.` : 'Pick the system you would choose now.', fbKind: 'info' },
                ]} />
              {st.kc && st.kc.last === 'change' && (
                <div className="chips" role="radiogroup" aria-label="New choice" style={{ marginTop: 8 }}>
                  {['single', 'workflow', 'agent'].filter(a => !saved || a !== saved.choice).map(a => (
                    <button key={a} type="button" role="radio" aria-checked={st.newChoice === a} aria-pressed={st.newChoice === a} className="chip tap"
                      onClick={() => { FX.tap(); set({ newChoice: a }); }} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <Icon name={APPROACHES[a].icon} size={16} />{APPROACHES[a].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="card flat display" style={{ fontSize: 16 }}>
            <p data-hl="note1">"Create a promotional visual" did not provide enough information to choose a system.</p>
            <p data-hl="note2" style={{ marginTop: 8, color: 'var(--ink2)' }}>The deliverable may look similar. What changes is how the work proceeds and where decisions occur.</p>
          </div>
        </div>
        <div className="stack" style={{ gap: 14 }}>
          <div data-hl="branches">
            <div className="task-root">Campus Sustainability Week — three versions of the task</div>
            <div className="branches display">
              {versions.map(([v, t, a]) => {
                const d = APPROACHES[a].decider;
                const mine = saved && saved.choice === a;
                return (
                  <div key={v} className={'branch ' + (mine ? 'is-mine' : '')} style={{ borderLeft: `5px solid ${DECIDERS[d].color}` }}>
                    <span className="amark"><Icon name={APPROACHES[a].icon} size={21} /></span>
                    <div><div className="branch-v">VERSION {v}{mine && <span className="mine-tag">your choice</span>}</div><div className="branch-t">{t}</div></div>
                    <div className="branch-fit"><small>Best fit</small><b>{APPROACHES[a].label}</b><DeciderBadge who={d} size="sm" /></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="qcard">
            <div className="q-head" style={{ marginBottom: 10 }}>
              <div className="q-text">What information should you examine before designing an agent? Select all that apply:</div>
              <FF>Tap all that apply</FF>
            </div>
            <div className="checkgrid" role="group">
              {P12_OPTS.map(o => {
                const on = sel.includes(o.id);
                const mark = st.submitted && on ? (o.key ? 'is-right' : 'is-wrong') : st.submitted && o.key ? 'is-missed' : '';
                return (
                  <button key={o.id} type="button" role="checkbox" aria-checked={on} className={'checkopt tap ' + mark} onClick={() => toggle(o.id)}>
                    <span className="box" aria-hidden="true">{on && <Icon name="check" size={15} sw={3} />}</span>
                    <span>{o.label}</span>
                    {st.submitted && on && <span className="key" aria-hidden="true">{o.key ? <Icon name="check" size={18} sw={2.8} /> : <Icon name="x" size={17} sw={2.6} />}</span>}
                    {st.submitted && on && <span className="sr-only">{o.key ? '(worth examining)' : '(a label, not the work)'}</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn tap" disabled={!sel.length || st.submitted} onClick={() => { FX.tap('ok'); quizAttempt('p12-reflection', sel.length === 3 && !sel.includes(4), (st.rn || 0) + 1, sel.join(',')); set({ submitted: true, everSubmitted: true, rn: (st.rn || 0) + 1 }); }}><Icon name="check" size={17} sw={2.4} /> Submit</button>
            </div>
            <div aria-live="polite">{st.submitted && <Feedback kind="hint" text="To design an agent intentionally, examine the work — not the label attached to the technology." />}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
PAGES.push({
  id: 'p12', phase: 4, title: 'Return to the Opening Decision',
  narration: (all) => {
    const s = all.p3 && all.p3.saved;
    const first = s
      ? `At the beginning, you selected ${choiceLabel(s.choice)} because ${explanationOf(s)}`
      : 'At the beginning, you made an initial choice.';
    return [
      { t: first, hl: 'mychoice', dyn: true },
      { t: "But 'create a promotional visual' did not provide enough information to choose a system.", hl: 'note1' },
      { parts: [
        { t: 'The deliverable may look similar.', hl: 'branches' },
        { t: 'What changes is how the work proceeds and where decisions occur.', hl: 'keep' },
      ], key: true },
    ];
  },
  isComplete: (st) => !!((st.everSubmitted || st.submitted) && st.kc && (st.kc.last === 'keep' || st.newChoice)),
  lockHint: 'Keep or change your choice, then submit the reflection',
  Component: Page12,
});

/* ---------- Page 13 — Summary ---------- */
function DifyMock() {
  const nodes = [
    { x: 24, y: 96, t: 'Start', c: '#2970FF', i: 'right' },
    { x: 214, y: 40, t: 'LLM', c: '#6938EF', i: 'model', sel: true },
    { x: 214, y: 156, t: 'Knowledge', c: '#16B364', i: 'rules' },
    { x: 404, y: 96, t: 'IF / ELSE', c: '#06AED4', i: 'chain' },
    { x: 594, y: 40, t: 'Agent', c: '#C11574', i: 'loop' },
    { x: 594, y: 156, t: 'End', c: '#F79009', i: 'check' },
  ];
  const edge = (a, b) => { const A = nodes[a], B = nodes[b]; const x1 = A.x + 150, y1 = A.y + 26, x2 = B.x, y2 = B.y + 26, m = (x1 + x2) / 2; return `M${x1} ${y1} C${m} ${y1} ${m} ${y2} ${x2} ${y2}`; };
  return (
    <div className="dify" aria-label="Stylized mockup of a workflow canvas with boxes and arrows">
      <svg viewBox="0 0 770 230" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0 }}>
        {[[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5]].map(([a, b], i) => <path key={i} d={edge(a, b)} fill="none" stroke="#98A2B3" strokeWidth="1.6" />)}
        {[[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5]].map(([a, b], i) => <circle key={'c' + i} cx={nodes[b].x} cy={nodes[b].y + 26} r="3.5" fill="#2970FF" />)}
        {nodes.map(n => (
          <foreignObject key={n.t} x={n.x} y={n.y} width="152" height="60">
            <div className={'dnode ' + (n.sel ? 'sel' : '')}>
              <div className="dnode-h"><span className="dnode-i" style={{ background: n.c }}><Icon name={n.i} size={13} sw={2.4} /></span>{n.t}</div>
              <div className="dnode-b" /><div className="dnode-b" />
            </div>
          </foreignObject>
        ))}
      </svg>
      <div className="dify-toolbar" aria-hidden="true"><i /><i /><i /><i /></div>
    </div>
  );
}
function Page13({ st, set }) {
  return (
    <div className="page" data-screen-label="13 Summary">
      <PageHead kicker="Reflect" title="Summary and Transition" />
      <div className="stack" style={{ gap: 'clamp(12px, 2vh, 20px)' }}>
        <div className="sum3 display" data-hl="sum3">
          <div className="sumcard user"><div className="sumcard-d"><LineDiagram width={220} /></div><b>SINGLE LLM CALL</b><p>The user controls the next step.</p></div>
          <div className="sumcard rules"><div className="sumcard-d"><ChainMini width={200} /></div><b>FIXED WORKFLOW</b><p>Predefined rules control the major path.</p></div>
          <div className="sumcard model"><div className="sumcard-d"><LoopMini width={128} /></div><b>AI AGENT</b><p>The model determines the next action based on context, within defined human boundaries.</p></div>
        </div>
        <div className="core" data-hl="core">The goal is not a more agentic system. It's knowing <em>when an agent is needed</em> — so the agent you build is truly necessary.</div>
        <div className="p13-bottom">
          <div className="stack" style={{ gap: 16 }}>
            <UnitMap checked highlight={1} hl="unitmap" labels={[['Module 1', 'Distinguish'], ['Module 2', 'Map the Workflow'], ['Module 3', 'Match the Workflow to AI']]} />
            <div><button type="button" className="bigbtn tap" data-track="continue-workflow-mapping" onClick={() => { FX.tap('ok'); try { window.Track && window.Track.event('lesson_complete', {}); } catch (e) {} set({ finished: true }); }}>Continue to Workflow Mapping <Icon name="right" size={20} /></button></div>
          </div>
          <div data-hl="dify">
            <DifyMock />
            <p className="dify-cap">In Module 3, you will build this in Dify — the boxes and arrows you just learned are real.</p>
          </div>
        </div>
      </div>
      {st.finished && (
        <div className="modal-back" onClick={() => set({ finished: false })}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Module 1 complete" onClick={e => e.stopPropagation()}>
            <div className="done-ic"><Icon name="check" size={28} sw={2.8} /></div>
            <p>Module 1 complete — you can now tell a single call, a workflow, and an agent apart. Module 2 (workflow mapping) comes next.</p>
            <div style={{ marginTop: 22 }}><button type="button" className="btn ghost tap" autoFocus onClick={() => { FX.tap(); set({ finished: false }); }}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
PAGES.push({
  id: 'p13', phase: 4, title: 'Summary and Transition',
  narration: () => [
    { t: 'You have now seen three ways AI can participate in work.', hl: 'sum3' },
    { t: 'The purpose of this distinction is not to discourage you from building an agent. It is to help you design agency deliberately, where the work actually requires runtime decision-making.', hl: 'core', key: true },
    { parts: [
      { t: 'Next, you will map a challenging workflow and identify where decisions, predictability, and variability occur.', hl: 'unitmap' },
      { t: 'Once you know where the decisions are, you can determine what your agent should actually do.', hl: 'dify' },
    ] },
  ],
  isComplete: () => true,
  Component: Page13,
});
