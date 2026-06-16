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
    explanation: 'A human-evaluation system starts as a queue. Cases are sampled, sliced by risk, prioritized, and assigned to raters. The output is not a vibe; it is a versioned label record.',
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
    explanation: 'The label record is the core data structure. Store case id, rater id, rubric id, prompt/model versions, score or preference, and a short rationale for disagreement analysis.',
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
    explanation: 'Human labels need their own quality loop. Agreement metrics, conflict queues, calibration examples, and rater training decide whether the labels are reliable enough for model selection.',
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
      heading: 'What it is',
      paragraphs: [
        'A human-evaluation labeling queue is the operational layer that turns open-ended model behavior into usable evidence. It samples cases, assigns raters, applies a rubric, records labels, measures disagreement, adjudicates conflicts, and versions the resulting eval set.',
        'This is a data-structure problem as much as a people problem. The important objects are task queues, label records, rubric versions, rater assignments, agreement matrices, adjudication logs, and sealed holdouts. Without those objects, human evaluation becomes anecdote.',
      ],
    },
    {
      heading: 'Pipeline model',
      paragraphs: [
        'A production queue should store each case with input, context, model outputs, slice tags, risk level, sampling reason, and version ids. The router assigns cases to raters while controlling conflicts of interest, workload balance, domain expertise, and whether review is single, double, or expert-only.',
        'The label record should preserve case id, rater id, rubric id, response order, score or preference, rationale, timestamp, and adjudication state. That makes labels auditable, reproducible, and usable for both evaluation and preference optimization.',
      ],
    },
    {
      heading: 'Agreement and adjudication',
      paragraphs: [
        'Human labels are not magic ground truth. Agreement must be measured. A split between raters may mean the response is genuinely ambiguous, the rubric is underspecified, one rater is undertrained, or the task needs a domain expert. The disagreement queue is therefore one of the most valuable queues in the system.',
        'Adjudication should not merely pick a winner. It should record the reason: missing criterion, policy ambiguity, factual uncertainty, domain expertise needed, or rater error. Those reasons feed rubric revisions, rater training, and new golden cases.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'Amazon SageMaker Ground Truth is the industrial data-labeling reference point: it supports human workers, built-in task types, custom labeling workflows, and automated data labeling for certain task types using active learning: https://docs.aws.amazon.com/sagemaker/latest/dg/sms.html and https://docs.aws.amazon.com/sagemaker/latest/dg/sms-automated-labeling.html.',
        'HELM shows the research benchmark version of careful evaluation: broad scenarios, many metrics, standardized conditions, and transparency rather than one accuracy number: https://crfm.stanford.edu/helm/ and https://arxiv.org/abs/2211.09110.',
        'MT-Bench and Chatbot Arena show the preference-evaluation side: pairwise comparisons, human preference data, and LLM-as-a-judge validation, with reported agreement between strong judges and human preferences around the level of human-human agreement: https://arxiv.org/abs/2306.05685. LLM Judge Calibration & Drift Monitor is the operational sequel: store anchors, bias probes, agreement by slice, and drift gates around those automated judges. Google Research\'s health-evaluation work shows why rubric shape matters: adaptive precise boolean rubrics can reduce evaluation time while preserving or improving inter-rater agreement: https://research.google/blog/a-scalable-framework-for-evaluating-health-language-models/.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not call a human label ground truth unless the process deserves the name. A rushed rater with a vague rubric can be noisier than an automated judge. Do not average away disagreement; disagreement is evidence about ambiguity, policy, and rubric quality.',
        'Do not let the same visible cases become the whole eval. Keep a development set for iteration, a sealed holdout for release, and fresh production samples for drift. Do not ignore rater identity and timing: fatigue, rater pool changes, and exposure to model outputs can shift the target.',
        'Do not trust LLM judges without human calibration. Automated judges are useful for scale, but their biases must be measured against human-labeled slices and rechecked after model, prompt, or rubric changes.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study LLM Evaluation Harnesses, LLM Judge Calibration & Drift Monitor, Deep Research Evaluation Harness Case Study, RLHF & Preference Optimization, Process Reward Models & Verifier Search, Benchmark Variance & Model Selection, Calibration & Reliability Diagrams, Data Leakage & Contamination, Contextual Bandit Logged Policy Evaluation, Queue, Message Queue, and Rate Limiter next.',
      ],
    },
  ],
};
