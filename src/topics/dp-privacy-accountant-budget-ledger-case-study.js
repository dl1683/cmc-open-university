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
    explanation: 'A privacy accountant records the training mechanism parameters: clipping norm, noise multiplier, sampling rate, number of steps, target delta, and accounting method.',
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
    explanation: 'Repeated private training consumes budget. The exact accountant may use RDP, PRV, or another analysis, but the product decision still needs a ledger with a stop rule.',
    invariant: 'Budget is consumed by repeated releases, not by intent.',
  };
  yield {
    state: epsilonPlot('Epsilon spend rises as rounds compose'),
    highlight: { active: ['eps'], compare: ['cap'], removed: ['stop'], found: ['warn'] },
    explanation: 'A curve makes the release risk visible. Validation accuracy can still improve after the privacy cap, but the accountant says the run should stop or change parameters.',
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
      heading: 'What it is',
      paragraphs: [
        'A privacy accountant tracks cumulative privacy loss for a differentially private training run. In DP-SGD, each step clips per-example gradients, adds noise, and composes privacy loss over repeated sampling and updates. The accountant turns those parameters into an epsilon-delta claim.',
        'The budget ledger is the operational version of the math. It records the accounting method, sampling assumptions, noise multiplier, clipping norm, number of steps, target delta, epsilon, and release decision.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The accountant receives mechanism parameters from training. It composes privacy loss across steps or rounds using an analysis such as Renyi Differential Privacy or a PRV accountant. The exact method matters, because different accountants can give different bounds for the same training run.',
        'The release gate compares the resulting epsilon and delta against a policy. It should also include model utility, slice regressions, privacy attack audits, and whether the accounting assumptions match the production data pipeline.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'A private text-classification model trains for 90 rounds. At round 50, epsilon is 4.2 and validation quality is acceptable. At round 90, epsilon exceeds the product cap. The model at round 90 may be more accurate, but the privacy budget says it cannot ship under the current policy.',
        'The team can stop at the earlier checkpoint, retrain with more noise, reduce sampling, lower rounds, or request a new review. What it should not do is publish a model with a stale privacy report.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'Differential privacy claims are easy to overstate when accounting is disconnected from training. A privacy accountant ledger keeps the claim tied to concrete parameters and code versions.',
        'The ledger also makes repeated releases visible. A single private training run is not the whole story if the same data population is used across many experiments, checkpoints, or product launches.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not report epsilon without delta, sampling assumptions, noise multiplier, clipping norm, and accounting method. Do not keep training after a budget gate fails just because validation accuracy improved. Do not reuse an old privacy report after changing data, batch construction, or training code.',
        'Do not treat privacy accounting as a unit conversion. It is part of the release evidence packet and should be reviewable by privacy, ML, and product owners.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: TensorFlow Privacy tutorial at https://www.tensorflow.org/responsible_ai/privacy/tutorials/classification_privacy, Opacus PrivacyEngine at https://opacus.ai/api/privacy_engine.html, Opacus DP-SGD privacy script at https://opacus.ai/api/compute_dp_sgd_privacy.html, and Deep Learning with Differential Privacy at https://arxiv.org/abs/1607.00133. Study Differential Privacy SGD, Membership Inference Shadow Model, Model Inversion Confidence Attack, and LLM Judge Calibration Drift Monitor next.',
      ],
    },
  ],
};
