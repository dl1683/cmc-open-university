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
      heading: 'Why This Exists',
      paragraphs: [
        'An LLM judge calibration and drift monitor exists because automated evaluation is useful only when the evaluator is also evaluated. A judge model can grade thousands of candidate answers, but a grade from a model is not ground truth. It is a measurement produced by a fallible instrument. The monitor stores the evidence needed to decide when that instrument is reliable enough to use.',
        'The core job is to connect judge scores with human anchor labels, rubric versions, slice tags, bias probes, drift alerts, and release gates. That turns a vague statement like "the judge says this model is better" into a traceable claim: on these cases, under this rubric, for these slices, with these known biases, the judge agreed with humans often enough to automate this part of the workflow.',
      ],
    },
    {
      heading: 'Why Raw Judge Scores Fail',
      paragraphs: [
        'The obvious approach is to ask a strong model to grade every answer, average the scores, and optimize against that number. It is cheap, fast, and tempting. It also hides the main risk: the judge is another model with its own error distribution. If the judge prefers verbose answers, rewards confident wording, misses rare facts, or changes behavior after a prompt update, the product can optimize toward the wrong target.',
        'A single leaderboard score makes the problem worse. It can hide false approvals on dangerous slices, false rejections on useful improvements, or a judge that agrees with humans on easy examples while failing on policy, legal, medical, math, or adversarial cases. Calibration exists because the average is not the decision. The decision is where the judge can safely replace or reduce human review.',
      ],
    },
    {
      heading: 'Core Insight: Scores Need Anchors',
      paragraphs: [
        'The fundamental record binds a stable case id, the user input, candidate answer, reference material, rubric id, human label, rater confidence, judge id, judge prompt, judge score, judge rationale, slice tags, timestamp, and release version. Every field matters because every field can explain a later disagreement. A score without the rubric, judge version, and sample frame is not reproducible evidence.',
        'From these records the system builds confusion matrices, agreement-by-slice tables, calibration bins, bias-probe reports, and drift charts. The judge output has two meanings. It grades the candidate answer, and it becomes a data point about judge behavior. Store enough context to replay the same anchor cases when the judge model, prompt, rubric, candidate model, or product policy changes.',
      ],
    },
    {
      heading: 'Calibration Workflow',
      paragraphs: [
        'Calibration starts with human anchors. A representative set of cases is labeled by trained reviewers under a stable rubric. The same cases are scored by the judge. The monitor compares the two, computes agreement, separates false positives from false negatives, and reports results by slice instead of only reporting a global score.',
        'The workflow then becomes a release gate. High-agreement slices can move to judge-only scoring or judge-first triage. Low-agreement slices keep human review. Slices with unclear disagreement become rubric work. Slices with too little evidence become labeling work. The system does not ask whether the judge is good in the abstract; it asks where the judge is good enough for this decision.',
      ],
    },
    {
      heading: 'Bias Probes',
      paragraphs: [
        'Bias probes are evaluation cases for the evaluator. A position probe swaps answer order in A/B comparisons and checks whether the winner changes. A verbosity probe pads an answer with irrelevant text and checks whether length alone raises the score. A self-preference probe blinds or changes model identity to see whether the judge favors outputs from its own model family. A style probe tests whether tone is being confused with correctness.',
        'Good probes are mechanical and repeatable. They do not depend on intuition after the fact. If the same content receives different grades because it appears first, uses more words, mimics the judge style, or avoids hard reference facts, the monitor should record a judge risk. The mitigation may be shuffling order, hiding identity, changing the rubric, adding references, or keeping humans in the loop.',
      ],
    },
    {
      heading: 'Drift Monitoring',
      paragraphs: [
        'Drift monitoring asks whether the judge is still the same instrument over time. Agreement can fall because the judge model changed, the judge prompt changed, the rubric changed, the candidate model learned a new style, the user mix shifted, or the policy being judged moved. Without versioned evidence, these causes collapse into one confusing number.',
        'A useful drift alert includes judge version, rubric version, candidate model, sample frame, slice, trigger threshold, and owner. It should be possible to rerun the old judge on the new anchor sample, rerun the new judge on the old anchor sample, and decide whether the regression comes from evaluator drift, data drift, or a real product-quality change.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The anchor-set graph teaches that a judge score is only one node in a larger evidence graph. The candidate answer, reference, rubric, human label, calibration fit, release gate, and audit log all have to stay connected. If the judge node is copied without the other nodes, the organization has a number but not a trustworthy measurement.',
        'The bias-audit views teach invariants. A pairwise judgment should not flip only because answer order changed. A factual answer should not win only because unrelated words were added. The drift chart teaches that time is a dimension of the data structure: agreement by slice can decay week by week, so the gate needs stored versions and replayable anchors, not just a dashboard snapshot.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The monitor works because it treats the judge as a classifier with measurable errors. Human anchors define the reference labels. The confusion matrix separates true approvals, true rejections, false approvals, and false rejections. The cost of those cells is not symmetric. A false approval may ship a dangerous answer. A false rejection may block a useful model improvement.',
        'Slice-level reporting makes the result actionable. Overall agreement can be high while one critical slice fails. Calibration bins make score interpretation concrete: when the judge assigns 0.8 confidence, humans should agree roughly at that rate if the score is calibrated. If not, thresholds need adjustment or the rubric needs repair before the score becomes a gate.',
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        'A support team upgrades a policy judge. The old judge agrees with human labels on 0.78 of anchor cases. The new judge reaches 0.84 overall, so a naive dashboard would approve it. The slice table changes the decision. Billing-policy agreement is only 0.62, pairwise swaps expose position bias, and verbosity probes show that padded answers win too often.',
        'The release becomes partial. The new judge is enabled for low-risk formatting, retrieval-quality, and citation-completeness checks. Billing and policy-edge cases stay human-gated. The rubric is rewritten to penalize unsupported verbosity. Pairwise comparisons randomize answer order. The anchor set receives more billing examples before the next promotion attempt. The system ships the improvement without pretending the risk disappeared.',
      ],
    },
    {
      heading: 'Operational Guidance',
      paragraphs: [
        'Version everything: judge model, judge prompt, rubric, candidate model, reference set, sample frame, and score thresholds. Keep anchor cases stable enough for longitudinal comparison, but refresh part of the set so the monitor does not overfit to old traffic. Use duplicate human labels and adjudication on high-risk or high-disagreement examples.',
        'Use active sampling to spend human review where it buys the most information. Send uncertain cases, high-impact product areas, disagreement clusters, rare slices, adversarial prompts, and drift-alert examples to humans first. A calibration program does not need humans on every example; it needs human labels where the judge boundary is uncertain or costly.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The main cost is human labeling. A judge monitor saves review time only after enough anchor labels exist to show where automation is safe. High-risk slices may need double labels, adjudication, and periodic relabeling. That can feel slower than a judge-only dashboard, but it prevents the team from optimizing a product against an unmeasured evaluator.',
        'The second cost is latency and storage. Pairwise swaps, verbosity probes, reference-grounded runs, and replay jobs can multiply judge calls. The system also stores prompts, rubrics, rationales, labels, versions, and traces. The tradeoff is worth it when judge scores control releases, customer-facing quality claims, agent grading, or safety gates. It is less worth it for low-stakes sorting where a rough heuristic is enough.',
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        'The most common failure is treating judge agreement as permanent. Agreement can decay after a model update, product-policy change, traffic shift, or prompt edit. Another failure is anchoring only easy examples. The judge then looks reliable while the cases that matter most remain unmeasured.',
        'A second class of failures comes from leakage and coupling. If the candidate model is trained directly to satisfy the same judge that acts as the release gate, the system may learn judge-specific shortcuts. If the judge sees model names, output order, or style cues, it may grade metadata instead of correctness. If rubric changes and judge changes happen together, attribution becomes weak.',
      ],
    },
    {
      heading: 'Implementation Checklist',
      paragraphs: [
        'A practical implementation needs stable case ids, immutable input snapshots, rubric versioning, human label provenance, judge prompt logging, score and rationale storage, slice tags, and replay tooling. It also needs dashboards that show false approvals, false rejections, calibration bins, and disagreement examples, not only aggregate agreement.',
        'Release gates should be explicit. For example: offline anchor pass before shadow use, bias probes below threshold before canary, slice-level agreement above threshold before automation, and rollback if weekly drift crosses the alert floor. The gate can be partial. Automating safe slices while routing risky slices to humans is usually better than an all-or-nothing decision.',
      ],
    },
    {
      heading: 'Where It Matters',
      paragraphs: [
        'This system wins anywhere model outputs are used to choose model releases, rank retrieval pipelines, grade agent traces, score customer-support answers, approve policy decisions, or claim benchmark progress. It is especially useful when the evaluator is cheaper than humans but the cost of a wrong decision is high.',
        'It fails when the task has a crisp deterministic checker, when the rubric is too vague for humans to apply, or when the team has no budget for anchor labels. It also fails if the judge becomes the training target without independent checks. A calibration packet tells future teams why a judge was trusted, which slices were excluded, what evidence supported a rollout, and which probes were known weaknesses.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary sources to compare are OpenAI evals guidance, MT-Bench and Chatbot Arena, G-Eval, surveys of LLM-as-a-judge, and work on human grounding for judge reliability. Read them with a practical question in mind: what evidence would convince you to let this evaluator replace a human on a specific slice?',
        'Inside this curriculum, study LLM Evaluation Golden Sets, Human Evaluation Labeling Queue, Calibration and Reliability Diagrams, Precision and Recall with Confusion Matrix, Benchmark Variance and Model Selection, RAG Evaluation, AI Audit Evidence Packet, Data Leakage and Contamination, and LLM Model Rollout Shadow Canary Ledger.',
      ],
    },
  ],
};
