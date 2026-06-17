// Differential privacy accounting: track privacy loss across repeated private
// training rounds and gate releases when the budget is spent.

import { matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'dp-privacy-accountant-budget-ledger-case-study',
  title: 'DP Privacy Accountant Budget Ledger Case Study',
  category: 'AI & ML',
  summary: 'A differential-privacy accounting case study: clipping and noise parameters, RDP/PRV-style budget ledgers, epsilon composition, release gates, utility frontier, and audit evidence.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['epsilon ledger', 'budget gate'], defaultValue: 'epsilon ledger' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function epsilonPlot(title) {
  return plotState({
    axes: { x: { label: 'rounds', min: 0, max: 100 }, y: { label: 'epsilon', min: 0, max: 10 } },
    series: [
      { id: 'eps', label: 'eps', points: [{ x: 0, y: 0 }, { x: 10, y: 0.9 }, { x: 25, y: 2.1 }, { x: 50, y: 4.2 }, { x: 75, y: 6.8 }, { x: 100, y: 9.6 }] },
      { id: 'cap', label: 'cap', points: [{ x: 0, y: 8 }, { x: 100, y: 8 }] },
    ],
    markers: [
      { id: 'warn', x: 75, y: 6.8, label: 'warn' },
      { id: 'stop', x: 100, y: 9.6, label: 'stop' },
    ],
  });
}

function* epsilonLedger() {
  yield {
    state: labelMatrix(
      'Privacy-accountant inputs',
      [
        { id: 'clip', label: 'clip C' },
        { id: 'noise', label: 'noise' },
        { id: 'sample', label: 'sample q' },
        { id: 'steps', label: 'steps' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'ledger', label: 'ledger' },
      ],
      [
        ['bound one ex', 'C=1.0'],
        ['hide part', 'sigma=1.2'],
        ['amp priv', 'q=.01'],
        ['compose', '100k'],
      ],
    ),
    highlight: { active: ['clip:role', 'noise:role', 'sample:role'], found: ['steps:ledger'] },
    explanation: 'Read this table as the contract between training and privacy review. The accountant cannot invent epsilon later; it needs the actual clip norm, noise multiplier, sampling rate, steps, delta, and method used.',
  };
  yield {
    state: labelMatrix(
      'Epsilon ledger',
      [
        { id: 'r1', label: 'r1' },
        { id: 'r20', label: 'r20' },
        { id: 'r50', label: 'r50' },
        { id: 'r90', label: 'r90' },
      ],
      [
        { id: 'eps', label: 'eps' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['0.1', 'ok'],
        ['1.8', 'ok'],
        ['4.2', 'ok'],
        ['8.6', 'stop'],
      ],
    ),
    highlight: { active: ['r1:eps', 'r20:eps', 'r50:eps'], removed: ['r90:gate'] },
    explanation: 'Repeated private training consumes budget. The exact accountant may use RDP, PRV, or another analysis, but the product decision still needs a ledger row and a stop rule for each candidate release.',
    invariant: 'Budget is consumed by repeated releases, not by intent.',
  };
  yield {
    state: epsilonPlot('Epsilon spend rises as rounds compose'),
    highlight: { active: ['eps'], compare: ['cap'], removed: ['stop'], found: ['warn'] },
    explanation: 'The curve is a warning display. Validation accuracy can still improve after the privacy cap, but the accountant says this run must stop, retune, or go back through review.',
  };
  yield {
    state: labelMatrix(
      'Release packet',
      [
        { id: 'model', label: 'model' },
        { id: 'acct', label: 'acct' },
        { id: 'delta', label: 'delta' },
        { id: 'proof', label: 'proof' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'status', label: 'status' },
      ],
      [
        ['v42', 'candidate'],
        ['PRV', 'attached'],
        ['1e-6', 'declared'],
        ['params', 'review'],
      ],
    ),
    highlight: { found: ['acct:status', 'delta:status', 'proof:status'], compare: ['model:status'] },
    explanation: 'The release packet should carry the accountant method, epsilon, delta, sampling assumptions, noise/clipping settings, code version, and whether the model is approved for release.',
  };
}

function* budgetGate() {
  yield {
    state: plotState({
      axes: { x: { label: 'epsilon', min: 0, max: 12 }, y: { label: 'accuracy', min: 65, max: 95 } },
      series: [
        { id: 'frontier', label: 'utility', points: [{ x: 0.8, y: 70 }, { x: 1.5, y: 77 }, { x: 3, y: 84 }, { x: 6, y: 89 }, { x: 10, y: 91 }] },
      ],
      markers: [
        { id: 'strict', x: 1.5, y: 77, label: 'strict' },
        { id: 'ship', x: 6, y: 89, label: 'ship?' },
        { id: 'too', x: 10, y: 91, label: 'too high' },
      ],
    }),
    highlight: { active: ['frontier'], found: ['ship'], compare: ['strict', 'too'] },
    explanation: 'The useful frontier is a product decision under privacy constraints. Lower epsilon usually means more noise and lower utility. Higher epsilon may not be acceptable for sensitive data.',
  };
  yield {
    state: labelMatrix(
      'Privacy knobs',
      [
        { id: 'clip', label: 'clip' },
        { id: 'noise', label: 'noise' },
        { id: 'batch', label: 'batch' },
        { id: 'rounds', label: 'rounds' },
      ],
      [
        { id: 'privacy', label: 'privacy' },
        { id: 'utility', label: 'utility' },
      ],
      [
        ['lower sens', 'may bias'],
        ['stronger', 'noisier'],
        ['sample amp', 'less signal'],
        ['more spend', 'more learn'],
      ],
    ),
    highlight: { active: ['clip:privacy', 'noise:privacy', 'batch:privacy', 'rounds:privacy'], compare: ['rounds:utility'] },
    explanation: 'The accountant is not separate from training. Clipping, noise, sampling, and round count jointly define the privacy-utility budget.',
  };
  yield {
    state: labelMatrix(
      'Gate conditions',
      [
        { id: 'eps', label: 'eps cap' },
        { id: 'eval', label: 'eval' },
        { id: 'slice', label: 'slices' },
        { id: 'attack', label: 'attack' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'outcome', label: 'outcome' },
      ],
      [
        ['eps <= 6', 'pass'],
        ['acc >= base', 'pass'],
        ['no regress', 'review'],
        ['MI audit', 'pass'],
      ],
    ),
    highlight: { found: ['eps:outcome', 'eval:outcome', 'attack:outcome'], compare: ['slice:outcome'] },
    explanation: 'A release gate should combine the privacy accountant with quality checks and attack audits. Passing epsilon alone does not prove that the model is useful or safe.',
  };
  yield {
    state: epsilonPlot('Stop, retune, or restart when the budget breaks'),
    highlight: { removed: ['stop'], active: ['cap'], compare: ['eps'], found: ['warn'] },
    explanation: 'When the budget breaks, the right action is explicit: stop training, increase noise and retrain, lower round count, change sampling, or request a new privacy review. The ledger prevents silent budget drift.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'epsilon ledger') yield* epsilonLedger();
  else if (view === 'budget gate') yield* budgetGate();
  else throw new InputError('Pick a DP accountant view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this topic exists',
      paragraphs: [
        `Differential privacy is not only a training trick. It is a release claim about how much one person's data can affect what an outside observer sees. In private machine learning, that claim is usually stated as epsilon and delta. Epsilon is the privacy-loss budget, and delta is a small failure probability. The lower the budget, the stronger the privacy guarantee, but the harder it is to keep model utility high.`,
        `The problem is that privacy loss composes. One noisy gradient step spends a little budget. One private checkpoint spends budget. Repeated experiments, releases, and model updates spend more. A team can start with a serious DP-SGD implementation and still lose track of what has been spent if accounting lives in a notebook, a model card, or a one-time review. The privacy accountant budget ledger exists to keep the mathematical guarantee connected to the actual training run and release decision.`,
      ],
    },
    {
      heading: 'The naive approaches',
      paragraphs: [
        `The first naive approach is to train with clipping and noise, then calculate epsilon at the end. That is too late. If the model has already crossed the policy cap, the best checkpoint may not be releasable. Worse, the run may have used batch construction, sampling, noise, or clipping settings that do not match the assumptions of the accountant. A final number cannot repair a broken mechanism.`,
        `The second naive approach is to treat epsilon as a static label. A team writes "DP model, epsilon 6" in a document and reuses that claim for later checkpoints, new data, changed batch sizes, or extra fine-tuning. That breaks the guarantee. The privacy claim belongs to a particular mechanism, data population, sampling process, step count, delta, accountant method, and release boundary. Change those, and the ledger needs a new row.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `A privacy accountant is a composition engine. It does not look at the model's weights and decide whether they feel private. It receives the mechanism parameters that determine privacy loss, then composes that loss across repeated accesses to the protected data. A budget ledger turns that composition into an operational control. Every candidate release has a recorded epsilon, delta, accounting method, code version, assumptions, and gate outcome.`,
        `That ledger changes the workflow. Training is no longer "run until validation accuracy stops improving." It becomes "train while the privacy budget, utility floor, and audit checks still pass." The ledger lets the team compare checkpoints on a privacy-utility frontier instead of pretending that accuracy is the only objective. It also creates evidence for reviewers who need to know exactly which run produced the released model.`,
      ],
    },
    {
      heading: 'How DP-SGD spends budget',
      paragraphs: [
        `DP-SGD changes ordinary gradient descent in two important ways. First, it clips each example's gradient to a maximum norm C. This bounds how much any one training example can influence the update. Second, it adds random noise, usually Gaussian noise scaled by a noise multiplier and the clipping norm. Sampling a minibatch also matters, because privacy amplification can make the effective privacy loss smaller when each step sees only a fraction of the data.`,
        `The accountant combines those details with the number of steps and the target delta. Common implementations use analyses based on Renyi Differential Privacy, privacy random variables, or related composition bounds. Different accountants can give different epsilon bounds for the same mechanism, so the method is part of the evidence. The ledger should not store only the final epsilon. It should store clip norm, noise multiplier, sampling rate, step count, delta, accountant type, library version, and any assumptions about replacement or Poisson sampling.`,
      ],
    },
    {
      heading: 'How the release gate works',
      paragraphs: [
        `A release gate compares the accountant result with policy. A simple gate might say epsilon must be at or below 6 for delta 1e-6. A better gate also checks utility, fairness slices, privacy attack audits, data lineage, and whether the accountant parameters were produced automatically from the training job rather than typed into a spreadsheet. Passing epsilon alone does not mean the model is useful, and passing accuracy alone does not mean the model is releasable.`,
        `When a candidate breaks the budget, the response should be explicit. The team can ship an earlier checkpoint, retrain with more noise, lower the number of steps, reduce the sampling rate, change clipping, use more public pretraining, or request a new privacy review. The wrong response is silent drift: keep training, keep the better validation number, and update the privacy report by hand. The ledger prevents that by making the stop condition visible before launch.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The input table is proving that a privacy claim is only as strong as its recorded mechanism. Clip norm bounds one person's contribution. Noise hides part of that contribution. Sampling rate affects amplification. Step count controls how many times the mechanism composes. If any of those fields are missing, the epsilon number has no audit trail.`,
        `The ledger and plot are proving that privacy budget can be spent while model quality is still improving. That is the uncomfortable product lesson. A later checkpoint can be more accurate and less releasable. The budget-gate view adds the second lesson: the decision is not "maximize epsilon." The decision is to choose a point on the privacy-utility frontier that satisfies policy, still performs well enough, and has enough evidence to survive review.`,
      ],
    },
    {
      heading: 'Why the ledger works',
      paragraphs: [
        `The ledger works because it turns an abstract composition theorem into a concrete control surface. Differential privacy has a strong property: once you know the mechanism and its parameters, you can bound cumulative privacy loss under composition. The accountant encodes that math. The ledger gives the organization a place to bind the math to a model version, training configuration, data population, and approval decision.`,
        `It also works as a coordination tool. Privacy reviewers need the parameters. ML engineers need to know which knobs affect utility. Product owners need a clear stop rule. Security teams may want membership-inference or extraction audits. Without a ledger, those concerns scatter across code, dashboards, tickets, and documents. With a ledger, the release packet can answer the basic question: what exactly are we claiming, and which evidence supports it?`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The privacy knobs are coupled. Lower clipping norms bound individual influence more tightly, but they can bias gradients and slow learning. More noise improves privacy, but it reduces signal. Smaller sampling rates can help privacy, but they may require more steps. More steps can improve accuracy, but they compose more loss. A useful budget ledger makes these tradeoffs visible instead of hiding them behind a single final metric.`,
        `There are also engineering costs. Per-example gradients are more expensive than ordinary batch gradients. Large models can make clipping and noise memory-heavy. Distributed training must preserve the accounting assumptions. Accountants are conservative in different ways, and the team must pick one method and document it. Finally, epsilon is not intuitive to most product users, so organizations still need policy, threat modeling, and plain-language release criteria.`,
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        `Privacy accounting is used in DP-SGD systems for health, finance, education, mobile telemetry, federated learning, keyboard prediction, ad measurement, and analytics over sensitive populations. It also applies when teams fine-tune or evaluate models on private user data. The key question is always the same: how much information about a single person can leak through the released artifact or query output?`,
        `A budget ledger is especially important when there are repeated releases. A company may train many checkpoints on the same population, publish multiple model versions, run ablations, and expose metrics to different teams. Each public or semi-public release can consume privacy budget. The ledger is the durable memory of those spends, so a later team cannot accidentally treat the same data population as fresh.`,
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        `The most common failure is a mismatched assumption. The accountant assumes Poisson sampling, but the pipeline uses fixed shuffled batches. The report assumes a particular clipping norm, but the training job changed it. Delta is omitted. The data population changes. Additional fine-tuning happens after the approved checkpoint. Any one of these breaks the connection between the guarantee and the release.`,
        `Differential privacy also does not solve every privacy problem. It bounds individual influence under the stated mechanism. It does not guarantee that training data was collected lawfully, that memorized public facts are harmless, that group-level harms disappear, or that a released model cannot be misused. Attack audits are still useful, but they are not a substitute for the DP proof. The ledger should keep those roles separate: proof parameters, empirical audits, utility checks, and final approval.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Read Deep Learning with Differential Privacy, the TensorFlow Privacy classification tutorial, and the Opacus PrivacyEngine documentation for concrete mechanisms and accountant APIs. Then study Differential Privacy SGD, Membership Inference Shadow Model, Model Inversion Confidence Attack, LLM Judge Calibration Drift Monitor, AI Audit Evidence Packet Case Study, and Benchmark Variance & Model Selection. The next useful mental model is that privacy accounting is not a footnote. It is a budgeted release system with math behind the gate.`,
      ],
    },
  ],
};
