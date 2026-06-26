// AI safety eval slice risk register: map risk classes and deployment slices
// to eval cases, thresholds, owners, mitigations, and release decisions.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ai-safety-eval-slice-risk-register-case-study',
  title: 'AI Safety Eval Slice Risk Register Case Study',
  category: 'AI & ML',
  summary: 'A governance-to-evaluation case study: risk register rows, eval slices, thresholds, human labels, judge calibration, mitigation owners, and release gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['risk register', 'slice gates'], defaultValue: 'risk register' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function riskGraph(title) {
  return graphState({
    nodes: [
      { id: 'risk', label: 'risk', x: 0.7, y: 3.4, note: 'row' },
      { id: 'slice', label: 'slice', x: 2.3, y: 2.0, note: 'traffic' },
      { id: 'eval', label: 'eval', x: 2.3, y: 4.8, note: 'cases' },
      { id: 'human', label: 'hum', x: 4.0, y: 2.0, note: 'labels' },
      { id: 'judge', label: 'judge', x: 4.0, y: 4.8, note: 'score' },
      { id: 'thresh', label: 'thr', x: 5.8, y: 3.4, note: 'gate' },
      { id: 'mit', label: 'mit', x: 7.4, y: 2.0, note: 'owner' },
      { id: 'ship', label: 'ship', x: 7.4, y: 4.8, note: 'decide' },
      { id: 'audit', label: 'audit', x: 9.0, y: 3.4, note: 'packet' },
    ],
    edges: [
      { id: 'e-risk-slice', from: 'risk', to: 'slice' },
      { id: 'e-risk-eval', from: 'risk', to: 'eval' },
      { id: 'e-slice-human', from: 'slice', to: 'human' },
      { id: 'e-eval-judge', from: 'eval', to: 'judge' },
      { id: 'e-human-thresh', from: 'human', to: 'thresh' },
      { id: 'e-judge-thresh', from: 'judge', to: 'thresh' },
      { id: 'e-thresh-mit', from: 'thresh', to: 'mit' },
      { id: 'e-thresh-ship', from: 'thresh', to: 'ship' },
      { id: 'e-mit-audit', from: 'mit', to: 'audit' },
      { id: 'e-ship-audit', from: 'ship', to: 'audit' },
    ],
  }, { title });
}

function* riskRegister() {
  yield {
    state: riskGraph('Safety eval slice risk register'),
    highlight: { active: ['risk', 'slice', 'eval', 'human', 'judge', 'e-risk-slice', 'e-risk-eval', 'e-slice-human', 'e-eval-judge'], found: ['thresh'] },
    explanation: 'The graph turns a safety score into a release-control path. Each risk must connect to a traffic slice, eval cases, human anchors, judge scores, thresholds, owners, and a decision.',
    invariant: 'A safety score without a slice and risk owner is not a control.',
  };

  yield {
    state: labelMatrix(
      'Risk register rows',
      [
        { id: 'inj', label: 'inject' },
        { id: 'harm', label: 'harm' },
        { id: 'bias', label: 'bias' },
        { id: 'priv', label: 'priv' },
        { id: 'auto', label: 'agency' },
      ],
      [
        { id: 'slice', label: 'slice' },
        { id: 'thr', label: 'thr' },
        { id: 'owner', label: 'own' },
      ],
      [
        ['tool', '0', 'sec'],
        ['chat', 'low', 'safe'],
        ['hire', 'gap', 'ml'],
        ['RAG', '0', 'sec'],
        ['agent', 'low', 'prod'],
      ],
    ),
    highlight: { active: ['inj:thr', 'priv:thr', 'auto:thr'], compare: ['bias:thr'], found: ['inj:owner', 'priv:owner'] },
    explanation: 'The threshold column is slice-specific. A tool-injection failure may have zero tolerance, while a low-severity chat miss can route to monitoring or human review.',
  };

  yield {
    state: riskGraph('Human anchors calibrate judge gates'),
    highlight: { active: ['human', 'judge', 'thresh', 'e-human-thresh', 'e-judge-thresh'], compare: ['eval'], found: ['ship'] },
    explanation: 'The human and judge nodes meet at the gate. LLM judges are useful only when the register stores human agreement, judge version, slice thresholds, and drift checks.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'release week', min: 0, max: 8 }, y: { label: 'open high-risk gaps', min: 0, max: 12 } },
      series: [
        { id: 'raw', label: 'without register', points: [{ x: 0, y: 2 }, { x: 2, y: 5 }, { x: 4, y: 8 }, { x: 6, y: 10 }, { x: 8, y: 11 }] },
        { id: 'owned', label: 'owned register', points: [{ x: 0, y: 2 }, { x: 2, y: 3 }, { x: 4, y: 3 }, { x: 6, y: 2 }, { x: 8, y: 1 }] },
      ],
      markers: [
        { id: 'gate', x: 4, y: 3, label: 'gate' },
      ],
    }),
    highlight: { active: ['owned', 'gate'], compare: ['raw'] },
    explanation: 'The plot shows the cost of missing ownership. Aggregate scores can look stable while high-risk gaps accumulate; owned rows turn failures into scheduled work.',
  };
}

function* sliceGates() {
  yield {
    state: labelMatrix(
      'Release gate by slice',
      [
        { id: 'chat', label: 'chat' },
        { id: 'rag', label: 'RAG' },
        { id: 'tool', label: 'tool' },
        { id: 'admin', label: 'admin' },
        { id: 'minor', label: 'minor' },
      ],
      [
        { id: 'eval', label: 'eval' },
        { id: 'hum', label: 'hum' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['pass', 'ok', 'ship'],
        ['pass', 'ok', 'ship'],
        ['fail', 'bad', 'hold'],
        ['fail', 'bad', 'hold'],
        ['gap', 'need', 'hold'],
      ],
    ),
    highlight: { active: ['chat:gate', 'rag:gate'], removed: ['tool:gate', 'admin:gate', 'minor:gate'], compare: ['minor:eval'] },
    explanation: 'The gate matrix blocks by critical slice, not average score. Admin, minor-user, and tool-use slices can hold a release even when broad chat tests pass.',
  };

  yield {
    state: riskGraph('Mitigation owners close slice gaps'),
    highlight: { active: ['thresh', 'mit', 'audit', 'e-thresh-mit', 'e-mit-audit'], compare: ['ship'], found: ['risk', 'slice'] },
    explanation: 'A failed gate moves to mitigation instead of becoming a footnote. The row names an owner and a concrete move: policy change, prompt boundary, tool scope, retrieval trust, labeling refresh, or rollback.',
  };

  yield {
    state: labelMatrix(
      'Complete case: hiring assistant',
      [
        { id: 'base', label: 'base' },
        { id: 'slice', label: 'slice' },
        { id: 'fix', label: 'fix' },
        { id: 'rerun', label: 'rerun' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'score', label: 'score' },
        { id: 'act', label: 'act' },
      ],
      [
        ['bias', 'fail', 'hold'],
        ['disab', 'fail', 'own'],
        ['rubric', 'pass', 'rerun'],
        ['slice', 'pass', 'ship'],
      ],
    ),
    highlight: { removed: ['base:act', 'slice:act'], active: ['fix:act', 'rerun:act'], found: ['rerun:score'] },
    explanation: 'The hiring case shows why averages are unsafe. General quality passes, but the disability-related slice fails, so the register blocks release, assigns mitigation, reruns that slice, and stores the proof.',
  };

  yield {
    state: riskGraph('Release decisions feed the audit packet'),
    highlight: { active: ['ship', 'audit', 'e-ship-audit'], found: ['thresh', 'mit'], compare: ['judge'] },
    explanation: 'The release edge writes into the audit packet. A reviewer should see why the release shipped, which slices were tested, which thresholds applied, which failures were fixed, and which residual risks were accepted.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'risk register') yield* riskRegister();
  else if (view === 'slice gates') yield* sliceGates();
  else throw new InputError('Pick an AI safety eval-slice view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read the risk-register view as a release-control path. A slice is a product-relevant subset of traffic, such as tool use, hiring prompts, minors, private retrieval, or administrator actions.',
      'Active nodes are the current control fields, found nodes are evidence that can support a ship decision, and compare nodes show a score or slice that is not enough by itself. A high-risk slice cannot ship without threshold, owner, evidence, and decision.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      {type:'callout', text:'A blended safety score is not a release control. A 98% pass rate can still include every prompt injection case for an agent with payment access. The register exists to connect each risk to a deployment slice, a threshold, an owner, and a release decision — so governance becomes a control surface, not a slogan.'},
      'AI safety risk is uneven across product use. A model can pass general chat tests and still fail on tool permissions, private retrieval, hiring, health advice, child safety, or multilingual abuse.',
      'The register connects risk governance to runnable evaluation. It turns a risk name into eval cases, human labels, judge or metric versions, thresholds, owners, mitigation, release state, and audit evidence.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is one standard eval suite and one average pass rate. That catches broad regressions and gives teams a simple model-to-model comparison.',
      'The shortcut fails when stakes differ by slice. A 98 percent average can hide every payment-tool injection failure or every disability-accommodation failure in a hiring assistant.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is local risk. A product does not launch into an average user; it launches into concrete slices with different harm levels, owners, policies, and tolerance thresholds.',
      'If a slice has no cases, the team has not measured it. If it has failed cases and no owner, the failure cannot become work; if it has no threshold, the release gate has nothing to enforce.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Use slice-level gates instead of model-level scores. Each row binds one risk to one slice, one eval set, one threshold, one owner, one mitigation state, and one release decision.',
      'The invariant is row accountability. A green row means the named slice passed the named threshold under the named eval version, not that the whole model is safe everywhere.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Start with risks specific enough to test, such as prompt injection, privacy leakage, harmful advice, discrimination, unauthorized tool action, or jailbreak success. Map each risk to slices where product harm can occur.',
      'Attach eval cases and human labels. Store judge prompt, judge model, metric version, human agreement, threshold, date, owner, and rerun result because automated judges and policies drift.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is control traceability. For any ship or hold decision, the team can trace from decision to slice, threshold, eval result, human anchor, owner, mitigation, and residual-risk approval.',
      'The register does not guarantee safe behavior outside the tested surface. It guarantees that known measured gaps cannot be honestly hidden behind a blended score.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The cost is slice upkeep. More product surfaces mean more cases, labels, judge calibration, thresholds, owners, and reruns after policy or model changes.',
      'Cost behaves like coverage pressure. Five slices with 200 cases each may be operable, while 80 thin slices can create false precision and slow every release without improving control.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'The pattern fits AI agents, retrieval systems, hiring assistants, lending tools, education products, healthcare assistants, child-facing products, and frontier-model release processes. Each has local risks that an average score can hide.',
      'Enterprise teams also use the register as audit evidence. A reviewer can see which slices were tested, which thresholds applied, which failures blocked release, and which residual risks were accepted.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails when missing data becomes green. Unknown slices should remain gaps, not passes, because the absence of evidence is exactly what the gate must expose.',
      'It also fails when teams overfit the eval set. The register needs red-team discovery, incident intake, production monitoring, and periodic slice refresh so known cases do not become the whole safety program.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A hiring assistant has a broad quality score of 96 percent across 1,000 prompts. The disability-accommodation slice has 80 prompts, 12 failures, and a threshold of at most 2 failures, so the row blocks release despite the strong average.',
      'The owner changes the refusal rubric, adds 40 new accommodation cases, and reruns the slice. The row can ship only after the rerun has 1 failure out of 120, the judge version is recorded, and the release owner accepts residual risk.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Study the NIST AI Risk Management Framework, frontier-model preparedness and responsible-scaling frameworks, Google SAIF, human evaluation methods, LLM judge calibration, and red-team evaluation practice. Read each as a source for risks, thresholds, and evidence discipline.',
      'Next study incident corrective-action ledgers, audit evidence packets, prompt-injection threat models, human labeling queues, jailbreak mutation search, and feature-flag release gates.',
    ] },
  ],
};
