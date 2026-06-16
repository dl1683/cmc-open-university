// LLM judge calibration and drift monitor: anchor human labels, bias probes,
// agreement matrices, and rollout gates for automated graders.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-judge-calibration-drift-monitor-case-study',
  title: 'LLM Judge Calibration & Drift Monitor',
  category: 'AI & ML',
  summary: 'A production evaluation case study: calibrate LLM judges against human anchors, detect position and verbosity bias, monitor drift, and gate releases with agreement evidence.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['anchor set', 'bias audit', 'drift watch'], defaultValue: 'anchor set' },
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

function judgeGraph(title) {
  return graphState({
    nodes: [
      { id: 'case', label: 'case', x: 0.7, y: 3.7, note: 'input' },
      { id: 'ans', label: 'answer', x: 2.2, y: 2.0, note: 'candidate' },
      { id: 'ref', label: 'ref', x: 2.2, y: 5.4, note: 'gold' },
      { id: 'rubric', label: 'rubric', x: 4.0, y: 3.7, note: 'criteria' },
      { id: 'judge', label: 'judge', x: 5.6, y: 3.7, note: 'grader' },
      { id: 'human', label: 'human', x: 7.0, y: 2.0, note: 'label' },
      { id: 'cal', label: 'calib', x: 7.0, y: 5.4, note: 'fit' },
      { id: 'gate', label: 'gate', x: 8.7, y: 3.0, note: 'ship' },
      { id: 'log', label: 'log', x: 8.7, y: 5.4, note: 'audit' },
    ],
    edges: [
      { id: 'e-case-ans', from: 'case', to: 'ans' },
      { id: 'e-case-ref', from: 'case', to: 'ref' },
      { id: 'e-ans-rubric', from: 'ans', to: 'rubric' },
      { id: 'e-ref-rubric', from: 'ref', to: 'rubric' },
      { id: 'e-rubric-judge', from: 'rubric', to: 'judge' },
      { id: 'e-judge-human', from: 'judge', to: 'human', weight: 'compare' },
      { id: 'e-human-cal', from: 'human', to: 'cal', weight: 'anchors' },
      { id: 'e-judge-cal', from: 'judge', to: 'cal', weight: 'scores' },
      { id: 'e-cal-gate', from: 'cal', to: 'gate', weight: 'trust' },
      { id: 'e-cal-log', from: 'cal', to: 'log', weight: 'evidence' },
    ],
  }, { title });
}

function* anchorSet() {
  yield {
    state: judgeGraph('A judge score starts as a claim to calibrate'),
    highlight: { active: ['case', 'ans', 'rubric', 'judge', 'e-case-ans', 'e-ans-rubric', 'e-rubric-judge'], compare: ['human', 'cal'] },
    explanation: 'An LLM judge is a scalable grader, not ground truth. The first structure is a calibration graph: candidate answer, reference material, rubric, judge score, human label, and evidence log.',
  };

  yield {
    state: labelMatrix(
      'Anchor case record',
      [
        { id: 'case', label: 'case id' },
        { id: 'rubric', label: 'rubric' },
        { id: 'ref', label: 'ref' },
        { id: 'human', label: 'human' },
        { id: 'judge', label: 'judge' },
        { id: 'slice', label: 'slice' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['stable id', 'replay'],
        ['version', 'same rule'],
        ['gold text', 'grounding'],
        ['label+risk', 'anchor'],
        ['score+why', 'audit'],
        ['domain', 'drift'],
      ],
    ),
    highlight: { active: ['human:stores', 'judge:stores', 'rubric:stores'], found: ['slice:why'] },
    explanation: 'The anchor set is a table of cases with human labels and judge outputs under versioned rubrics. It lets the team ask whether the automated grader still matches the process it is replacing.',
    invariant: 'A judge cannot be calibrated without stable human anchors.',
  };

  yield {
    state: judgeGraph('Human anchors turn judge disagreement into data'),
    highlight: { active: ['judge', 'human', 'cal', 'e-judge-human', 'e-human-cal', 'e-judge-cal'], found: ['gate', 'log'] },
    explanation: 'Agreement and disagreement both matter. Agreement supports automation. Disagreement exposes vague rubrics, hard domains, weak references, or a judge that cannot solve the task it is grading.',
  };

  yield {
    state: labelMatrix(
      'Agreement by slice',
      [
        { id: 'easy', label: 'easy' },
        { id: 'hard', label: 'hard' },
        { id: 'policy', label: 'policy' },
        { id: 'rare', label: 'rare' },
        { id: 'attack', label: 'attack' },
      ],
      [
        { id: 'agree', label: 'agree' },
        { id: 'action', label: 'action' },
      ],
      [
        ['0.92', 'auto ok'],
        ['0.61', 'human gate'],
        ['0.74', 'rubric fix'],
        ['0.68', 'more labels'],
        ['0.57', 'red team'],
      ],
    ),
    highlight: { active: ['hard:action', 'policy:action', 'attack:action'], compare: ['easy:action'] },
    explanation: 'A single agreement number hides the useful part. Slice-level agreement says where automated judging can be trusted and where human review or rubric repair remains mandatory.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'human rate', min: 0, max: 1 }, y: { label: 'judge rate', min: 0, max: 1 } },
      series: [
        { id: 'bins', label: 'bins', points: [{ x: 0.1, y: 0.12 }, { x: 0.3, y: 0.34 }, { x: 0.5, y: 0.59 }, { x: 0.7, y: 0.78 }, { x: 0.9, y: 0.94 }] },
        { id: 'over', label: 'over', points: [{ x: 0.1, y: 0.28 }, { x: 0.3, y: 0.48 }, { x: 0.5, y: 0.68 }, { x: 0.7, y: 0.85 }, { x: 0.9, y: 0.98 }] },
      ],
      markers: [
        { id: 'bad', x: 0.3, y: 0.48, label: 'over' },
      ],
    }),
    highlight: { active: ['bins'], compare: ['over', 'bad'] },
    explanation: 'Calibration compares judge-positive rates with human-positive rates. If the judge is systematically over-accepting a slice, a threshold tweak or rubric rewrite is safer than trusting raw scores.',
  };
}

function* biasAudit() {
  yield {
    state: labelMatrix(
      'Bias probe suite',
      [
        { id: 'pos', label: 'position' },
        { id: 'verb', label: 'verbose' },
        { id: 'self', label: 'self pref' },
        { id: 'style', label: 'style' },
        { id: 'hard', label: 'hard q' },
      ],
      [
        { id: 'probe', label: 'probe' },
        { id: 'bad', label: 'bad sign' },
      ],
      [
        ['swap', 'first'],
        ['pad', 'long'],
        ['family', 'own'],
        ['tone', 'style'],
        ['ref', 'guess'],
      ],
    ),
    highlight: { active: ['pos:bad', 'verb:bad', 'self:bad', 'hard:bad'] },
    explanation: 'Bias probes are adversarial eval cases for the judge itself. Swap answer order, add irrelevant verbosity, change style, hide references, and test whether the same content receives the same judgment.',
    invariant: 'The evaluator needs evals too.',
  };

  yield {
    state: labelMatrix(
      'Pairwise swap audit',
      [
        { id: 'case1', label: 'case 1' },
        { id: 'case2', label: 'case 2' },
        { id: 'case3', label: 'case 3' },
        { id: 'case4', label: 'case 4' },
      ],
      [
        { id: 'ab', label: 'A/B' },
        { id: 'ba', label: 'B/A' },
        { id: 'flag', label: 'flag' },
      ],
      [
        ['A', 'A', 'stable'],
        ['A', 'B', 'pos bias'],
        ['tie', 'tie', 'stable'],
        ['B', 'A', 'pos bias'],
      ],
    ),
    highlight: { active: ['case2:flag', 'case4:flag'], compare: ['case1:flag', 'case3:flag'] },
    explanation: 'Pairwise judges should be invariant to answer order when the content is unchanged. A flip under A/B versus B/A is direct evidence of position bias.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'extra words', min: 0, max: 600 }, y: { label: 'win rate', min: 0.4, max: 0.9 } },
      series: [
        { id: 'base', label: 'base', points: [{ x: 0, y: 0.51 }, { x: 100, y: 0.53 }, { x: 300, y: 0.54 }, { x: 600, y: 0.55 }] },
        { id: 'biased', label: 'biased', points: [{ x: 0, y: 0.51 }, { x: 100, y: 0.61 }, { x: 300, y: 0.72 }, { x: 600, y: 0.84 }] },
      ],
      markers: [
        { id: 'alarm', x: 300, y: 0.72, label: 'alarm' },
      ],
    }),
    highlight: { active: ['biased', 'alarm'], compare: ['base'] },
    explanation: 'Verbosity bias shows up when a longer answer wins more often despite unchanged facts. The monitor should track this separately from legitimate completeness.',
  };

  yield {
    state: labelMatrix(
      'Judge confusion matrix',
      [
        { id: 'humok', label: 'human ok' },
        { id: 'humbad', label: 'human bad' },
      ],
      [
        { id: 'jok', label: 'judge ok' },
        { id: 'jbad', label: 'judge bad' },
      ],
      [
        ['TP', 'FN'],
        ['FP', 'TN'],
      ],
    ),
    highlight: { active: ['humok:jok', 'humbad:jbad'], compare: ['humok:jbad', 'humbad:jok'] },
    explanation: 'Once human labels exist, judge evaluation becomes a classifier problem. False positives ship bad answers. False negatives block useful improvements. The cost of those cells should set the gate.',
  };

  yield {
    state: labelMatrix(
      'Mitigation map',
      [
        { id: 'pos', label: 'position' },
        { id: 'verb', label: 'verbose' },
        { id: 'self', label: 'self pref' },
        { id: 'hard', label: 'hard q' },
      ],
      [
        { id: 'detect', label: 'detect' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['swap', 'shuffle'],
        ['len', 'rubric'],
        ['tag', 'blind'],
        ['ref', 'gold'],
      ],
    ),
    highlight: { active: ['pos:fix', 'verb:fix', 'self:fix', 'hard:fix'] },
    explanation: 'Bias controls should be mechanical. Randomize position, hide model identity, require references on hard tasks, and make the rubric punish unsupported verbosity.',
  };
}

function* driftWatch() {
  yield {
    state: plotState({
      axes: { x: { label: 'week', min: 1, max: 8 }, y: { label: 'agree', min: 0.55, max: 0.95 } },
      series: [
        { id: 'overall', label: 'overall', points: [{ x: 1, y: 0.84 }, { x: 2, y: 0.85 }, { x: 3, y: 0.83 }, { x: 4, y: 0.81 }, { x: 5, y: 0.77 }, { x: 6, y: 0.73 }, { x: 7, y: 0.70 }, { x: 8, y: 0.69 }] },
        { id: 'policy', label: 'policy', points: [{ x: 1, y: 0.79 }, { x: 2, y: 0.80 }, { x: 3, y: 0.76 }, { x: 4, y: 0.72 }, { x: 5, y: 0.66 }, { x: 6, y: 0.61 }, { x: 7, y: 0.58 }, { x: 8, y: 0.57 }] },
      ],
      markers: [
        { id: 'floor', x: 5, y: 0.75, label: 'floor' },
      ],
    }),
    highlight: { active: ['policy', 'floor'], compare: ['overall'] },
    explanation: 'Judge drift can be gradual. A new model, changed policy, shifted user mix, or stale rubric can lower agreement by slice before the overall dashboard looks scary.',
  };

  yield {
    state: labelMatrix(
      'Drift event fields',
      [
        { id: 'judge', label: 'judge' },
        { id: 'rubric', label: 'rubric' },
        { id: 'model', label: 'model' },
        { id: 'data', label: 'data' },
        { id: 'slice', label: 'slice' },
        { id: 'owner', label: 'owner' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['version', 'changed?'],
        ['version', 'rule drift'],
        ['candidate', 'new style'],
        ['sample id', 'mix shift'],
        ['domain', 'localize'],
        ['team', 'repair'],
      ],
    ),
    highlight: { active: ['judge:stores', 'rubric:stores', 'data:stores', 'slice:why'], found: ['owner:why'] },
    explanation: 'A drift alert needs provenance. Store judge version, rubric version, candidate model, sample frame, slice, trigger threshold, and owner so the alert can be investigated instead of ignored.',
  };

  yield {
    state: judgeGraph('Calibration gates decide automation scope'),
    highlight: { active: ['cal', 'gate', 'log', 'e-cal-gate', 'e-cal-log'], compare: ['judge'], found: ['human'] },
    explanation: 'The gate does not have to be all or nothing. High-agreement slices can use automated judging. Low-agreement slices route to human review until anchors and rubrics improve.',
  };

  yield {
    state: labelMatrix(
      'Release gate ladder',
      [
        { id: 'dev', label: 'dev' },
        { id: 'shadow', label: 'shadow' },
        { id: 'canary', label: 'canary' },
        { id: 'prod', label: 'prod' },
      ],
      [
        { id: 'needs', label: 'needs' },
        { id: 'block', label: 'block if' },
      ],
      [
        ['anchor pass', 'low agree'],
        ['no action', 'bias high'],
        ['small auto', 'slice fail'],
        ['owned run', 'drift'],
      ],
    ),
    highlight: { active: ['dev:needs', 'shadow:needs', 'canary:needs'], compare: ['prod:block'] },
    explanation: 'Judge automation should roll out like production software. Start with offline anchors, shadow labels, small automated slices, and explicit rollback if agreement or bias probes regress.',
  };

  yield {
    state: labelMatrix(
      'Case study: policy judge upgrade',
      [
        { id: 'old', label: 'old judge' },
        { id: 'new', label: 'new judge' },
        { id: 'anchor', label: 'anchors' },
        { id: 'bias', label: 'bias' },
        { id: 'ship', label: 'ship' },
      ],
      [
        { id: 'evidence', label: 'evidence' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['0.78', 'base'],
        ['0.84', 'better'],
        ['0.62', 'hold'],
        ['verb', 'fix'],
        ['partial', 'gate'],
      ],
    ),
    highlight: { active: ['new:decision', 'anchor:decision', 'bias:decision', 'ship:decision'], compare: ['old:evidence'] },
    explanation: 'A judge upgrade can be both better and unsafe. Here the new judge improves overall agreement but fails policy anchors and verbosity probes, so only low-risk slices are promoted.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'anchor set') yield* anchorSet();
  else if (view === 'bias audit') yield* biasAudit();
  else if (view === 'drift watch') yield* driftWatch();
  else throw new InputError('Pick an LLM judge calibration view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An LLM judge calibration and drift monitor is the evidence layer around automated grading. It stores human anchor labels, judge scores, rubric versions, bias probes, slice-level agreement, and drift alerts so a judge score can be treated as measured evidence rather than truth.',
        'This is the missing operational layer between LLM Evaluation Harnesses, Human Evaluation Labeling Queue, Calibration Curves, and AI Audit Evidence Packet. The harness can run a judge. The labeling queue can produce human labels. The calibration monitor decides where the judge is trusted, where it needs human review, and when it has drifted.',
      ],
    },
    {
      heading: 'Data structure',
      paragraphs: [
        'The main record binds case id, input, candidate answer, reference material, rubric id, human label, rater confidence, judge id, judge prompt, judge score, rationale, slice tags, timestamp, and release version. From those records the system builds confusion matrices, calibration bins, agreement-by-slice tables, bias probes, and control charts.',
        'The important distinction is that the judge is being evaluated. A judge output is not only a score for the candidate answer; it is also a data point about the judge. Store enough context to replay the same case when the judge model, rubric, candidate model, or policy changes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with an anchor set labeled by humans under a stable rubric. Run the judge on those same cases. Compute agreement, false positive rate, false negative rate, calibration by score bin, and disagreement by slice. Then add probe suites for known judge biases: answer order, verbosity, self-preference, style, and hard questions that require reference answers.',
        'The monitor promotes automation only where evidence supports it. A low-risk slice with high agreement can use judge-only scoring. A hard domain with low agreement routes to human review. If weekly agreement drops or bias probes regress, the gate pauses the judge, keeps the old rubric, or requires adjudication.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A support team upgrades its automated policy judge. Overall agreement with human labels improves from 0.78 to 0.84, so a naive dashboard would approve the new judge. The slice table tells a different story: billing policy agreement is 0.62, verbose answers win too often, and pairwise answer-order swaps flip several decisions.',
        'The safe release is partial. The new judge is enabled for low-risk formatting and retrieval-quality checks. Billing and policy-edge cases remain human-gated. The rubric is rewritten to penalize unsupported verbosity, answer order is randomized during pairwise judging, and the anchor set receives fresh policy examples before the next promotion attempt.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Calibration costs money because human anchors, duplicate labels, adjudication, and judge reruns are not free. The alternative is worse: a cheap judge that silently approves bad answers or blocks real improvements. Active sampling helps by sending high-impact, uncertain, high-disagreement, or drift-prone cases to humans first.',
        'Drift is unavoidable. Users change, candidate models change, policy changes, judges change, and rubrics become stale. Version every component and make alerts slice-specific. A single aggregate agreement line is not enough for production risk.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat LLM-as-a-judge as a free replacement for human evaluation. MT-Bench and Chatbot Arena showed strong judges can approximate human preferences at useful agreement levels, but they also studied position, verbosity, self-enhancement, and reasoning limits. Newer work on human grounding shows judge quality depends heavily on whether the judge can answer the question and whether human-written references are provided.',
        'Do not let the same judge that optimizes a model also be the only release gate for that model. Do not average away policy, rare-entity, attack, or hard-question slices. Do not let rubric changes and judge model changes happen in the same release without separate attribution.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OpenAI evals guide at https://developers.openai.com/api/docs/guides/evals, A Survey on LLM-as-a-Judge at https://arxiv.org/abs/2411.15594, MT-Bench and Chatbot Arena paper at https://arxiv.org/abs/2306.05685, G-Eval ACL paper at https://aclanthology.org/2023.emnlp-main.153/, and No Free Labels: Limitations of LLM-as-a-Judge Without Human Grounding at https://arxiv.org/html/2503.05061v1.',
        'Study LLM Evaluation Harnesses: Golden Sets and Judges, Human Evaluation Labeling Queue, LLM Model Rollout Shadow Canary Ledger, Calibration & Reliability Diagrams, Precision/Recall & Confusion Matrix, Benchmark Variance & Model Selection, RAG Evaluation, AI Audit Evidence Packet, and Data Leakage & Contamination next.',
      ],
    },
  ],
};
