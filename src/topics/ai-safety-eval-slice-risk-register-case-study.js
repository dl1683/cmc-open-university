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
    explanation: 'A safety eval program needs a risk register that maps each risk to traffic slices, evaluation cases, human labels, judge scores, thresholds, owners, and release decisions.',
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
    explanation: 'Thresholds vary by risk and slice. A tool-injection failure may have zero tolerance, while a low-severity chat policy miss may route to monitoring and human review.',
  };

  yield {
    state: riskGraph('Human anchors calibrate judge gates'),
    highlight: { active: ['human', 'judge', 'thresh', 'e-human-thresh', 'e-judge-thresh'], compare: ['eval'], found: ['ship'] },
    explanation: 'LLM judges are useful only when calibrated against human anchors. The register should store judge version, human agreement, slice-specific thresholds, and drift checks.',
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
    explanation: 'The register turns failures into owned work. Without ownership, high-risk gaps accumulate while aggregate scores hide them.',
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
    explanation: 'A release should be blocked by critical slice failures even when the average score is high. Admin, minor-user, and tool-use slices often need special gates.',
  };

  yield {
    state: riskGraph('Mitigation owners close slice gaps'),
    highlight: { active: ['thresh', 'mit', 'audit', 'e-thresh-mit', 'e-mit-audit'], compare: ['ship'], found: ['risk', 'slice'] },
    explanation: 'When a slice gate fails, the register assigns an owner and mitigation: policy change, prompt boundary, tool scope, retrieval trust, labeling refresh, or rollout rollback.',
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
    explanation: 'A hiring assistant passes general quality tests but fails a disability-related slice. The register blocks release, assigns mitigation, reruns the slice, and stores the evidence packet.',
  };

  yield {
    state: riskGraph('Release decisions feed the audit packet'),
    highlight: { active: ['ship', 'audit', 'e-ship-audit'], found: ['thresh', 'mit'], compare: ['judge'] },
    explanation: 'The audit packet should show why a release shipped, what slices were tested, what thresholds applied, which failures were fixed, and what residual risks were accepted.',
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
    {
      heading: 'What it is',
      paragraphs: [
        'An AI safety eval slice risk register is the table that connects risk governance to runnable evaluation. It maps risk classes to deployment slices, test cases, thresholds, human labels, judge calibration, owners, mitigation status, and release decisions.',
        'LLM Evaluation Harnesses covers cases and judges. Human Evaluation Labeling Queue covers labeling. AI Audit Evidence Packet covers governance evidence. This module shows the linking structure that keeps those pieces aligned.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'A register row includes risk id, taxonomy source, product surface, user group, traffic slice, eval suite, human anchor set, judge version, threshold, owner, mitigation, status, residual risk, and audit packet id.',
        'Slices matter because average scores hide harm. A model can pass broad chat tests while failing on tool access, minors, medical use, hiring, finance, disability-related prompts, or multilingual traffic.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Define risk classes, map them to product slices, attach eval cases, calibrate automated judges with human labels, set thresholds, run gates before release, assign owners to failed slices, and store rerun evidence after mitigation.',
        'The register is not a spreadsheet for show. It is a release-control data structure. Feature flags, canaries, guardrails, eval harnesses, and audit packets should all point back to it.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A hiring assistant passes average helpfulness tests but fails a disability accommodation slice. The register marks bias and discrimination risk, blocks release for the hiring slice, assigns an owner, updates the rubric and policy, reruns human-anchored tests, and stores the pass evidence.',
        'The release decision now has an explanation: the general score was not enough; the high-risk slice needed a separate gate. That is exactly why the register exists.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Common failures are stale slices, unclear owners, judge drift, thresholds copied from low-risk surfaces to high-risk surfaces, and residual risks accepted without written rationale. Another failure is treating missing data as a pass.',
        'The register should mark gaps explicitly. Unknown risk is not green; it is work to be scheduled, scoped, or escalated.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NIST AI RMF Playbook at https://airc.nist.gov/airmf-resources/playbook/, NIST AI RMF at https://www.nist.gov/itl/ai-risk-management-framework, OpenAI Preparedness Framework at https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf, Anthropic Responsible Scaling Policy at https://www.anthropic.com/responsible-scaling-policy, and Google SAIF at https://saif.google/.',
        'Study next: LLM Red-Team Attack Taxonomy Queue Case Study, Jailbreak Mutation Search Graph Case Study, AI Incident Corrective Action Ledger Case Study, LLM Judge Calibration & Drift Monitor, Human Evaluation Labeling Queue Case Study, and AI Audit Evidence Packet Case Study.',
      ],
    },
  ],
};
