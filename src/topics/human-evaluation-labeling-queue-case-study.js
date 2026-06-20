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
      heading: 'Why This Exists',
      paragraphs: [
        "A human-evaluation labeling queue is the system that turns scattered human judgment into evidence a model team can trust. A product team may have thousands of model outputs, support tickets, safety reports, and edge cases. The queue decides which cases deserve human attention, who should review them, which rubric applies, how disagreement is resolved, and how the resulting labels become a versioned evaluation set.",
        "The problem is not simply getting people to click buttons. Human attention is expensive, inconsistent, and easy to bias. If the process does not preserve case identity, rater identity, rubric version, response order, model version, and adjudication history, the labels cannot answer the hard questions: did the model improve, did the safety behavior regress, did the rubric drift, or did the rater pool change?",
        {type:"callout", text:"A trustworthy label is a versioned process record, not a naked score detached from case, rater, rubric, and adjudication context."},
      ],
    },
    {
      heading: 'Naive Approach',
      paragraphs: [
        "The naive approach is to send a spreadsheet of model answers to a few reviewers and ask which answer is better. That can be useful during early exploration, but it breaks down quickly. The team cannot tell whether a score changed because the model improved, because the raters saw the model name, because examples were easier this week, or because the rubric changed from broad preference to factuality.",
        "A second naive approach is to label only obvious failures. That creates a repair set, not a benchmark. It over-represents visible failures and under-represents ordinary traffic. A release gate needs several lanes at once: fresh random traffic for coverage, risk slices for safety, known failures for regression testing, and repeated anchor cases for drift detection.",
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        "The wall is disagreement. Two competent raters can see the same answer differently because the instruction is ambiguous, the question requires domain knowledge, the response is partly correct, or the rubric mixes several criteria into one score. If the system only averages scores, it hides the most valuable information in the pipeline.",
        "The wall is also sampling pressure. Labeling every case is too slow and too expensive, but labeling only what looks interesting creates biased evidence. The queue must spend human time where it has the highest expected value: uncertain examples, high-risk examples, failures that block launch, and cases that calibrate raters or automated judges.",
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        "The core insight is that a human label is not a single value. It is a structured record produced by a controlled process. The record should say what case was reviewed, what the rater saw, which rubric version was used, what answer order was shown, what score or preference was chosen, what rationale was written, and whether the label was later aggregated or adjudicated.",
        "Once labels are records, the rest of the system becomes a set of ordinary data structures. A priority queue schedules work. A routing table assigns cases to raters. A matrix measures agreement. An adjudication log records conflict reasons. A versioned eval set freezes selected labels into a release artifact. This is why the queue view matters: the queue is the bridge between human work and repeatable measurement.",
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        "A production queue starts by creating a case object. The case contains the prompt or task, any needed context, the candidate outputs, source metadata, model and prompt versions, slice tags, risk tags, and the reason it was sampled. The queue then assigns priority. High-risk policy cases, fresh traffic from under-covered slices, recent production failures, and calibration anchors should not all wait in one flat FIFO line.",
        "Routing comes next. Some cases need one reviewer, some need two blinded independent reviewers, and some need a domain expert. The router balances workload, avoids conflicts of interest, hides model identity when needed, randomizes response order, and ensures repeated anchor cases appear often enough to reveal rater drift. The output is a label record, not a private opinion.",
        "Aggregation turns multiple label records into a usable case result. If raters agree, the system can aggregate directly. If they split, the case moves to conflict. Conflict can mean adjudication by an expert, a revised rubric, an added calibration example, or a decision that the task is too ambiguous for the current eval. The important part is to store the reason, not just the final winner.",
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        "The system works because it separates three concerns that are often mixed together: sampling, judgment, and release. Sampling decides what humans should inspect. Judgment applies a rubric to a blinded task. Release freezes a selected set of labels and metadata so future model comparisons use the same evidence. Mixing those concerns is how teams accidentally overfit to the visible examples they just discussed.",
        "Agreement metrics give the process feedback. High agreement does not prove the rubric is correct, but low agreement proves something needs investigation. A split may reveal a vague criterion, a confusing UI, a missing domain instruction, a rater training issue, or a genuinely hard case. Treating disagreement as an input to system design is the difference between measuring humans and learning from humans.",
        "Versioning makes the evidence reproducible. A model launch decision should be able to cite eval-set version, rubric version, rater pool, sample window, disagreement rate, adjudication policy, and slice coverage. Without those fields, a passing score is just a number without provenance.",
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        "Suppose a customer-support model produces two candidate answers for a refund request. The queue creates a case with the user question, order status, policy excerpt, model A output, model B output, tenant and language tags, and a sampling reason: recent refund-policy regressions. Because refunds are a high-risk slice, the case receives double blinded review.",
        "Rater A prefers model A because it cites the policy correctly. Rater B prefers model B because it sounds more empathetic. The agreement matrix marks a split, so the case enters adjudication. The adjudicator finds that the rubric asked for helpfulness but did not separately score policy compliance and tone. The final case result may choose model A, but the more important output is a rubric repair: split the criterion into factual policy correctness, actionability, and tone.",
        "That one case now improves the whole pipeline. Future labels use the clearer rubric, raters receive a calibration example, the eval set preserves the conflict reason, and automated judges can be checked against the same anchor. The queue did not merely produce a label; it found a weakness in the measurement system.",
      ],
    },
    {
      heading: 'What The Animation Teaches',
      paragraphs: [
        "The label-queue view shows the main path from case to eval set. A case is sliced by risk, placed in a priority queue, routed to blinded raters, turned into label rows, aggregated when agreement is clear, adjudicated when agreement splits, and finally written into a versioned evaluation artifact. The useful lesson is that human review is a pipeline with durable intermediate states.",
        "The agreement-loop view shows the quality loop around that pipeline. Rubrics create tasks, tasks produce votes, votes become agreement signals or conflict cases, and those outcomes feed calibration, automated judge checks, and release gates. The release gate should depend on the health of the labeling process as well as the model score.",
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        "The main cost is human time. Double review improves disagreement measurement, but it roughly doubles labeling cost for the selected cases. Expert review increases correctness on domain-heavy work, but it slows throughput. Active sampling reduces waste, but it can bias the eval set if the team forgets to keep a random fresh-traffic lane.",
        "Rubric shape is a tradeoff. Likert scales preserve nuance but drift between raters. Boolean checklist items improve agreement but can feel rigid. Pairwise preference works well for open-ended outputs, but it needs response-order randomization and side-bias checks. Expert adjudication resolves conflicts, but overusing it can hide a broken rubric.",
        "Automation is also a tradeoff. LLM judges can screen more cases than people can, but they inherit biases from training data, model family, prompt wording, answer length, and response position. They should be calibrated against human anchors and rechecked whenever the judged model, judge model, prompt, or rubric changes.",
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        "Human-evaluation queues win when the task cannot be scored by exact match. They are useful for open-ended writing quality, helpfulness, safety policy adherence, medical or legal review workflows, customer-support response quality, tool-use appropriateness, multilingual behavior, and preference data for reward modeling.",
        "They also win when a team needs defensible release evidence. A release review can inspect slice coverage, disagreement trends, adjudication reasons, rater drift, and sealed-holdout behavior instead of relying on a single leaderboard number. That makes the system more useful for production governance than an informal tasting panel.",
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        "The queue fails when the rubric is vague. If raters cannot tell what counts as success, more labels only create more expensive noise. It fails when rater identity and timing are not logged, because fatigue, training, and pool changes can move the target. It fails when cases are not blinded, because model reputation and answer order can influence the vote.",
        "It also fails when the eval set becomes public to the team. Once engineers repeatedly tune prompts against the same visible cases, the set stops measuring generalization. Keep a development set for iteration, a sealed holdout for release, and fresh production samples for drift. The queue should support all three lanes explicitly.",
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        "Common failure modes include label leakage, rubric drift, slice imbalance, adjudication shortcuts, rater overfitting to calibration examples, missing rationales, stale production samples, automated judge drift, and lack of replayable context. A label without the original prompt, candidate outputs, response order, and rubric version is often impossible to audit later.",
        "Another failure mode is treating disagreement as embarrassment. Disagreement is one of the best signals in the system. It marks ambiguous policy, unclear instruction, borderline behavior, or missing expertise. The conflict queue should feed rubric repair and new golden examples, not disappear into an average.",
      ],
    },
    {
      heading: 'Sources And Study Next',
      paragraphs: [
        "Industrial labeling systems such as Amazon SageMaker Ground Truth show the queue, worker, workflow, and active-labeling side of the problem. HELM shows the benchmark side: broad scenarios, multiple metrics, transparency, and standardized evaluation conditions. MT-Bench and Chatbot Arena show the preference-evaluation side with pairwise comparison and judge calibration. Health-evaluation work from Google Research is a good example of how precise boolean rubrics can improve consistency and throughput.",
        "Study Queue, Priority Queue, Message Queue, Rate Limiter, LLM Evaluation Harnesses, LLM Judge Calibration and Drift Monitor, RLHF and Preference Optimization, Benchmark Variance and Model Selection, Calibration and Reliability Diagrams, Data Leakage and Contamination, and Contextual Bandit Logged Policy Evaluation next. Together they explain how to schedule labels, preserve evidence, avoid overfitting, and turn preference data into model decisions.",
      ],
    },
  ],
};
