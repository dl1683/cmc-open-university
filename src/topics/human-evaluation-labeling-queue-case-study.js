// Human evaluation pipeline: assignment queues, rubric records, blinded review,
// agreement checks, adjudication, and eval-set versioning for LLM systems.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'human-evaluation-labeling-queue-case-study',
  title: 'Human Evaluation Labeling Queue Case Study',
  category: 'AI & ML',
  summary: 'A production human-eval data pipeline: task queues, rater assignment, rubric records, agreement checks, adjudication, active sampling, and drift controls.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['label queue', 'agreement loop'], defaultValue: 'label queue' },
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

function queueGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'case', label: 'case', x: 0.7, y: 3.8, note: notes.case ?? 'item' },
      { id: 'slice', label: 'slice', x: 2.1, y: 2.9, note: notes.slice ?? 'risk' },
      { id: 'queue', label: 'queue', x: 2.1, y: 5.5, note: notes.queue ?? 'priority' },
      { id: 'route', label: 'route', x: 3.8, y: 3.8, note: notes.route ?? 'assign' },
      { id: 'raterA', label: 'rater A', x: 5.5, y: 3.0, note: notes.raterA ?? 'blind' },
      { id: 'raterB', label: 'rater B', x: 5.5, y: 5.1, note: notes.raterB ?? 'blind' },
      { id: 'labels', label: 'labels', x: 7.1, y: 3.8, note: notes.labels ?? 'records' },
      { id: 'agg', label: 'agg', x: 8.4, y: 3.0, note: notes.agg ?? 'vote' },
      { id: 'adj', label: 'adj', x: 8.4, y: 5.0, note: notes.adj ?? 'resolve' },
      { id: 'set', label: 'eval set', x: 9.7, y: 3.8, note: notes.set ?? 'version' },
    ],
    edges: [
      { id: 'e-case-slice', from: 'case', to: 'slice' },
      { id: 'e-case-queue', from: 'case', to: 'queue' },
      { id: 'e-slice-route', from: 'slice', to: 'route' },
      { id: 'e-queue-route', from: 'queue', to: 'route' },
      { id: 'e-route-a', from: 'route', to: 'raterA' },
      { id: 'e-route-b', from: 'route', to: 'raterB' },
      { id: 'e-a-labels', from: 'raterA', to: 'labels' },
      { id: 'e-b-labels', from: 'raterB', to: 'labels' },
      { id: 'e-labels-agg', from: 'labels', to: 'agg' },
      { id: 'e-labels-adj', from: 'labels', to: 'adj' },
      { id: 'e-agg-set', from: 'agg', to: 'set' },
      { id: 'e-adj-set', from: 'adj', to: 'set' },
    ],
  }, { title });
}

function agreementGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'rubric', label: 'rubric', x: 0.8, y: 3.8, note: notes.rubric ?? 'criteria' },
      { id: 'task', label: 'task', x: 2.4, y: 3.8, note: notes.task ?? 'blind' },
      { id: 'votes', label: 'votes', x: 4.1, y: 3.8, note: notes.votes ?? 'labels' },
      { id: 'agree', label: 'agree', x: 5.9, y: 2.3, note: notes.agree ?? 'score' },
      { id: 'conflict', label: 'conflict', x: 5.9, y: 5.4, note: notes.conflict ?? 'queue' },
      { id: 'calib', label: 'calib', x: 7.7, y: 2.3, note: notes.calib ?? 'training' },
      { id: 'judge', label: 'judge', x: 7.7, y: 5.4, note: notes.judge ?? 'model' },
      { id: 'gate', label: 'gate', x: 9.4, y: 3.8, note: notes.gate ?? 'ship?' },
    ],
    edges: [
      { id: 'e-rubric-task', from: 'rubric', to: 'task' },
      { id: 'e-task-votes', from: 'task', to: 'votes' },
      { id: 'e-votes-agree', from: 'votes', to: 'agree' },
      { id: 'e-votes-conflict', from: 'votes', to: 'conflict' },
      { id: 'e-agree-calib', from: 'agree', to: 'calib' },
      { id: 'e-conflict-judge', from: 'conflict', to: 'judge' },
      { id: 'e-calib-gate', from: 'calib', to: 'gate' },
      { id: 'e-judge-gate', from: 'judge', to: 'gate' },
    ],
  }, { title });
}

function* labelQueue() {
  yield {
    state: queueGraph('Human evaluation is a data pipeline'),
    highlight: { active: ['case', 'queue', 'route', 'raterA', 'raterB', 'e-case-queue', 'e-queue-route'], found: ['labels'] },
    explanation: 'The naive baseline is to ask a few people which answer feels better. A production eval starts as a queue: sample cases, slice by risk, prioritize, assign raters, and emit versioned label records.',
    invariant: 'A human label is useful only when the task, rubric, rater, and version are preserved.',
  };

  yield {
    state: labelMatrix(
      'Label record schema',
      [
        { id: 'case', label: 'case' },
        { id: 'rater', label: 'rater' },
        { id: 'rubric', label: 'rubric' },
        { id: 'choice', label: 'choice' },
        { id: 'note', label: 'note' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['case id', 'replay'],
        ['rater id', 'bias audit'],
        ['rubric id', 'version'],
        ['score/vote', 'train/eval'],
        ['reason', 'debug'],
      ],
    ),
    highlight: { active: ['case:stores', 'rater:stores', 'rubric:stores', 'choice:stores'], found: ['note:why'] },
    explanation: 'The label record is the core data structure. Store case id, rater id, rubric id, response order, prompt/model versions, score or preference, and a short rationale so disagreement can be debugged.',
  };

  yield {
    state: queueGraph('Double review makes disagreement observable', {
      raterA: 'blind A',
      raterB: 'blind B',
      labels: 'two rows',
      agg: 'agree?',
      adj: 'if split',
    }),
    highlight: { active: ['route', 'raterA', 'raterB', 'labels', 'e-route-a', 'e-route-b', 'e-a-labels', 'e-b-labels'], found: ['agg'], compare: ['adj'] },
    explanation: 'Assigning the same case to two independent raters turns disagreement into data. If both agree, aggregate. If they split, send the case to adjudication or rubric repair.',
  };

  yield {
    state: labelMatrix(
      'Sampling lanes',
      [
        { id: 'fresh', label: 'fresh' },
        { id: 'risk', label: 'risk' },
        { id: 'fail', label: 'failures' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'source', label: 'source' },
        { id: 'goal', label: 'goal' },
      ],
      [
        ['new traffic', 'coverage'],
        ['policy edge', 'safety'],
        ['bad traces', 'repair'],
        ['old cases', 'drift'],
      ],
    ),
    highlight: { found: ['fresh:goal', 'risk:goal', 'fail:goal', 'audit:goal'] },
    explanation: 'A strong eval queue mixes random fresh traffic with deliberate slices: policy edges, production failures, rare entities, and old cases repeated to detect rater or model drift.',
  };

  yield {
    state: queueGraph('Active sampling spends human time where labels matter', {
      case: 'pool',
      slice: 'uncertain',
      queue: 'top k',
      route: 'send',
      labels: 'gain',
      set: 'refresh',
    }),
    highlight: { active: ['case', 'slice', 'queue', 'route', 'labels', 'e-case-slice', 'e-slice-route', 'e-route-a'], found: ['set'] },
    explanation: 'Human labels are expensive. Active sampling routes uncertain, high-risk, high-disagreement, or high-impact cases to people first while easy cases use exact checks or automated judges.',
  };

  yield {
    state: labelMatrix(
      'Release artifacts',
      [
        { id: 'labels', label: 'labels' },
        { id: 'set', label: 'eval set' },
        { id: 'rubric', label: 'rubric' },
        { id: 'audit', label: 'audit log' },
      ],
      [
        { id: 'artifact', label: 'artifact' },
        { id: 'blocks', label: 'blocks' },
      ],
      [
        ['label rows', 'unknown truth'],
        ['case split', 'overfit'],
        ['criteria', 'style drift'],
        ['disputes', 'silent bias'],
      ],
    ),
    highlight: { active: ['labels:artifact', 'set:artifact', 'rubric:artifact', 'audit:artifact'], compare: ['audit:blocks'] },
    explanation: 'The release should carry artifacts: label rows, eval-set version, rubric version, rater pool, disagreement rate, adjudication log, and slices with enough volume to trust.',
  };
}

function* agreementLoop() {
  yield {
    state: agreementGraph('Agreement is measured, not assumed'),
    highlight: { active: ['rubric', 'task', 'votes', 'agree', 'conflict', 'e-task-votes'], found: ['gate'] },
    explanation: 'Human labels need their own quality loop. Agreement metrics, conflict queues, calibration examples, and rater training decide whether the labels are reliable enough to steer model selection.',
    invariant: 'Humans are the ground-truth process, not an oracle.',
  };

  yield {
    state: labelMatrix(
      'Agreement matrix',
      [
        { id: 'bothYes', label: 'yes/yes' },
        { id: 'splitA', label: 'yes/no' },
        { id: 'splitB', label: 'no/yes' },
        { id: 'bothNo', label: 'no/no' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'action', label: 'action' },
      ],
      [
        ['clear pass', 'aggregate'],
        ['conflict', 'adjudicate'],
        ['conflict', 'adjudicate'],
        ['clear fail', 'aggregate'],
      ],
    ),
    highlight: { found: ['bothYes:action', 'bothNo:action'], active: ['splitA:action', 'splitB:action'] },
    explanation: 'A simple agreement matrix exposes where the rubric is crisp and where it fails. Conflicts are not waste; they are the cases that teach the team what the rubric missed.',
  };

  yield {
    state: labelMatrix(
      'Rubric shapes',
      [
        { id: 'likert', label: 'Likert' },
        { id: 'bool', label: 'boolean' },
        { id: 'pair', label: 'pairwise' },
        { id: 'expert', label: 'expert' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['nuance', 'scale drift'],
        ['agreement', 'too rigid'],
        ['preference', 'side bias'],
        ['domain', 'slow/cost'],
      ],
    ),
    highlight: { active: ['bool:helps', 'pair:helps', 'expert:helps'], compare: ['likert:risk', 'pair:risk'] },
    explanation: 'Rubric shape changes the data. Likert scores preserve nuance but drift. Boolean checklists improve consistency. Pairwise preference helps open-ended ranking but must randomize sides.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'rubric version', min: 0, max: 5 }, y: { label: 'relative score', min: 0, max: 100 } },
      series: [
        { id: 'agree', label: 'agree', points: [{ x: 0, y: 52 }, { x: 1, y: 58 }, { x: 2, y: 72 }, { x: 3, y: 77 }, { x: 4, y: 80 }, { x: 5, y: 81 }] },
        { id: 'time', label: 'time', points: [{ x: 0, y: 90 }, { x: 1, y: 82 }, { x: 2, y: 70 }, { x: 3, y: 58 }, { x: 4, y: 52 }, { x: 5, y: 50 }] },
        { id: 'cost', label: 'cost', points: [{ x: 0, y: 84 }, { x: 1, y: 78 }, { x: 2, y: 66 }, { x: 3, y: 61 }, { x: 4, y: 58 }, { x: 5, y: 58 }] },
      ],
      markers: [
        { id: 'bool', x: 2, y: 72, label: 'bool split' },
        { id: 'calib', x: 4, y: 80, label: 'calib set' },
      ],
    }),
    highlight: { active: ['agree', 'bool', 'calib'], compare: ['time', 'cost'] },
    explanation: 'Better rubrics can raise agreement while lowering time and cost. The Google health-evaluation work is a good modern example: more precise boolean rubrics can make scoring faster and more consistent than broad Likert ratings.',
  };

  yield {
    state: agreementGraph('Automated judges need human calibration'),
    highlight: { active: ['votes', 'judge', 'calib', 'gate', 'e-conflict-judge', 'e-calib-gate'], compare: ['rubric'] },
    explanation: 'LLM judges can scale human preferences, but they inherit position, verbosity, and model-family biases. Keep a human-calibrated slice and compare judge decisions against it before trusting automation.',
  };

  yield {
    state: labelMatrix(
      'Bias controls',
      [
        { id: 'blind', label: 'blind' },
        { id: 'shuffle', label: 'shuffle' },
        { id: 'calib', label: 'calib' },
        { id: 'drift', label: 'drift' },
      ],
      [
        { id: 'control', label: 'control' },
        { id: 'blocks', label: 'blocks' },
      ],
      [
        ['hide model', 'brand bias'],
        ['random side', 'position'],
        ['known cases', 'rater drift'],
        ['repeat cases', 'rubric drift'],
      ],
    ),
    highlight: { found: ['blind:blocks', 'shuffle:blocks', 'calib:blocks', 'drift:blocks'] },
    explanation: 'Human-eval quality comes from controls: blind model identity, randomize response order, seed calibration cases, repeat old cases, monitor rater slices, and record adjudication reasons.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'label queue') yield* labelQueue();
  else if (view === 'agreement loop') yield* agreementLoop();
  else throw new InputError('Pick a human-evaluation view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a measurement pipeline, not a crowd-work dashboard. Active items are cases currently being sampled, routed, labeled, or adjudicated; visited items have already produced process records; found items are labels that can enter a versioned evaluation set. A safe inference is that a label is trustworthy only when the case, rater, rubric, response order, and adjudication state are preserved.',
        {type:'callout', text:'A trustworthy label is a versioned process record, not a naked score detached from case, rater, rubric, and adjudication context.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
      'A model team often has thousands of prompts, outputs, support tickets, safety reports, and edge cases that cannot be scored by exact match. Humans can judge helpfulness, policy compliance, tone, factual support, and risk, but human attention is costly and inconsistent. A labeling queue exists to spend that attention where it creates evidence a release decision can use.',
      'The hard problem is not asking people to click a score. The hard problem is preserving enough context to know whether a model improved or the measurement process changed. A release score without case identity, rubric version, rater pool, response order, and adjudication history is just a number with weak provenance.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to send a spreadsheet of model answers to reviewers and ask which answer is better. That can find obvious problems during exploration, and it is fast to start. It breaks when the team tries to compare model versions, because the process does not control what raters saw or which rubric they applied.',
      'Another approach is to label only failures that engineers already noticed. That creates a repair list, not a benchmark. A release gate needs ordinary traffic, risk slices, known regressions, and calibration anchors because each lane answers a different question about model behavior.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is disagreement. Two careful raters can disagree because the instruction is ambiguous, the answer is partly correct, or the rubric mixes policy accuracy with tone. Averaging their scores hides the signal that the measurement itself may be under-specified.',
      'The second wall is sampling bias. Labeling every case is too expensive, but labeling only unusual cases makes the evaluation set unrepresentative. The queue has to choose cases by expected value while keeping enough random fresh traffic to estimate real behavior.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'The core insight is that a human label is a structured record produced by a controlled process. The record should include the case, candidate outputs, blinded order, rater id, rubric version, score or preference, rationale, sampling reason, and adjudication result. Once that is true, the label can be replayed and compared across model releases.',
      'The queue is built from ordinary data structures. A priority queue schedules cases, a routing table assigns raters, a matrix measures agreement, and an adjudication log records conflict resolution. The system turns subjective judgment into evidence by controlling the path that produced it.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The system first creates a case object with prompt, context, candidate outputs, model versions, prompt versions, slice tags, risk tags, and sampling reason. It then assigns priority based on release risk, uncertainty, under-covered slices, recent production failures, and calibration needs. High-risk medical or legal cases may require expert review, while ordinary preference cases may use trained general raters.',
      'Routing hides model identity when needed, randomizes response order, avoids conflicts of interest, and limits rater load. Aggregation handles agreement, while conflict sends the case to adjudication or rubric repair. The output is not only a final label; it is also evidence about rater agreement and rubric health.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is process reproducibility. If two model releases are compared on the same frozen eval-set version with the same rubric version and known rater protocol, score changes are more likely to reflect model behavior. If the cases, rubric, or rater pool changed, the system can say that the comparison is not clean.',
      'Disagreement becomes useful because it is stored instead of erased. A split can reveal a vague criterion, a missing policy example, a confusing UI, or a genuinely hard case. The queue improves the measurement system by routing conflict back into rubric edits and calibration examples.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Human time is the dominant cost. If a case takes 90 seconds and costs 0.75 USD per review, 10,000 single-review cases cost 7,500 USD and about 250 reviewer hours. Double review doubles that selected-case cost, so it should be spent where disagreement or risk matters.',
      'Rubric design also changes behavior. Pairwise preference is natural for open-ended answers but needs response-order randomization and side-bias checks. Boolean checklists improve agreement but can miss nuance, while broad Likert scores preserve nuance but drift across raters.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Human-evaluation queues win when outputs are open-ended and the cost of a bad release is real. They fit customer-support answers, safety-policy adherence, medical or legal review workflows, tool-use appropriateness, multilingual behavior, and preference data for reward modeling. They are also useful when automated judges need human anchors for calibration.',
      'The pattern supports governance because a launch review can inspect slice coverage, disagreement rates, adjudication reasons, and sealed-holdout behavior. That is stronger than a single leaderboard score. It lets the team distinguish model quality from measurement drift.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails when the rubric is vague. More labels do not fix a task that raters cannot interpret consistently. It also fails when model names, answer order, or prior reputation are visible, because those cues can steer the vote.',
      'It fails when the eval set becomes a training target for the team. If engineers repeatedly tune prompts against the same visible cases, the set stops measuring generalization. A healthy process separates development cases, sealed holdout cases, and fresh production samples.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Suppose a support model produces two answers for a refund request, and the queue samples the case because refund policy regressions rose last week. The case packet includes the user question, order status, policy excerpt, model A output, model B output, tenant, language, and risk tag. Because refunds are high-risk, the queue assigns two blinded raters and randomizes answer order.',
      'Rater 1 prefers A because it cites the refund policy correctly, while rater 2 prefers B because it sounds more empathetic. The conflict queue sends the case to adjudication, and the adjudicator finds that the rubric mixed policy correctness and tone into one helpfulness score. The final label may choose A, but the real output is a repaired rubric with separate policy, actionability, and tone fields.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Study Amazon SageMaker Ground Truth for managed labeling workflows, HELM for transparent model evaluation, MT-Bench and Chatbot Arena for pairwise preference evaluation, and recent LLM-as-judge calibration work. Then study Queue, Priority Queue, Message Queue, Benchmark Variance, Data Leakage, Calibration Curves, RLHF Preference Optimization, and LLM Judge Calibration Drift Monitor. The next skill is designing evaluation evidence that survives release review.',
    ] },
  ],
};