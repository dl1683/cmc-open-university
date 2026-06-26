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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the first view as a ledger, not as a model-training dashboard. Active cells are the mechanism parameters that determine the privacy calculation; found cells are fields already recorded as evidence for the release decision.',
        'The safe inference rule is that a checkpoint can move forward only when its epsilon, delta, accountant method, and training parameters are bound to the same run. If a row changes the clip norm, noise multiplier, sampling rate, or step count, the old privacy number no longer describes the new release.',
        {type: 'callout', text: `A privacy accountant is a release gate that composes actual training parameters into cumulative privacy loss before accuracy can tempt the team past its budget.`},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Differential privacy is a promise about individual influence. In machine learning, the promise usually says that changing one person in the training data should not change the released model too much, with privacy loss summarized by epsilon and a small failure probability called delta.',
        'The problem is repetition. One private training step, one private checkpoint, and one public release can each consume part of the privacy budget. A privacy accountant exists because the team needs an auditable budget ledger before validation accuracy tempts it to keep spending.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to add clipping and noise during training, then compute epsilon at the end. Clipping limits the norm of each example gradient, and Gaussian noise hides part of any one example contribution.',
        'That approach feels reasonable because the privacy mechanism is already in the training loop. A team can see loss, accuracy, and a final accountant number, so it is tempting to treat the privacy review as a report generated after the run.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that privacy loss composes while the experiment is still running. If the cap is epsilon 6 at delta 1e-6, a checkpoint at epsilon 5.8 may be releasable while a later checkpoint at epsilon 7.1 is not, even if the later model is more accurate.',
        'A final spreadsheet cannot repair a run whose assumptions changed. If the accountant assumes Poisson sampling but the job used fixed batches, or if the noise multiplier changed halfway through, the release claim is no longer tied to the mechanism that actually touched the data.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A privacy accountant is a composition engine plus a release gate. It receives the real training parameters, computes cumulative privacy loss, and records whether the candidate release is still inside policy.',
        'The ledger is the data structure that makes the math operational. Each row binds model version, data population, clip norm, noise multiplier, sampling rate, step count, delta, accountant method, epsilon, and gate outcome into one release artifact.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'DP-SGD starts by clipping each per-example gradient to a norm cap C. It then adds random noise scaled by C and a noise multiplier, samples minibatches from the data, and repeats the process for many steps.',
        'The accountant combines the sampling rate, noise multiplier, number of steps, and target delta using a formal composition bound. Implementations may use Renyi Differential Privacy, privacy random variables, or another accountant, so the method and library version belong in the ledger.',
        'The release gate compares the resulting epsilon with policy and utility checks. If the checkpoint passes privacy but fails accuracy, it should not ship; if it passes accuracy but exceeds the privacy cap, it should not ship under the old claim.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a binding argument. Differential privacy composition lets the accountant upper-bound cumulative privacy loss when the mechanism parameters and sampling assumptions are known.',
        'The ledger is correct only if every release decision refers to the same mechanism that produced the checkpoint. Because each row records the parameters and the cap check, a reviewer can reconstruct why the release was allowed or stopped.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The training cost is not just the accountant. Per-example gradients are more expensive than ordinary batch gradients, clipping can add memory pressure, and noise can require more steps to recover utility.',
        'Cost behaves like a coupled budget. More steps usually improve learning but spend more privacy; more noise improves privacy but weakens signal; a smaller sampling rate can help privacy but may slow convergence.',
        'Operationally, the ledger also costs discipline. The training job must emit parameters automatically, the release process must reject missing evidence, and policy owners must define epsilon and delta caps before the best checkpoint is known.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Privacy accounting is used when private data trains models or powers repeated analytics. Health models, financial-risk models, education systems, mobile telemetry, federated learning, and ad measurement all face the same budget problem.',
        'The ledger is most useful when releases repeat. A company may publish checkpoints, run ablations, fine-tune on the same population, and share metrics with internal teams; the accountant prevents each team from pretending the population is fresh.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The ledger fails when it records a different world from the one that ran. Wrong sampling assumptions, omitted delta, changed clipping, extra fine-tuning, or a new data population can break the link between epsilon and the release.',
        'Differential privacy also has a narrow scope. It bounds individual influence under the stated mechanism; it does not prove lawful collection, prevent every group-level harm, or replace membership-inference audits and product review.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose policy allows epsilon <= 6 at delta 1e-6. A run uses clip norm C=1.0, noise multiplier 1.2, sampling rate q=0.01, and an accountant that reports epsilon 0.09 per 1,000 steps over this range.',
        'After 50,000 steps, the ledger records epsilon about 4.5 and validation accuracy 88.7 percent, so the candidate can continue to other release checks. After 80,000 steps, epsilon is about 7.2 and accuracy is 90.1 percent, so the later checkpoint is more accurate but outside the privacy cap.',
        'The behavioral cost is visible in the numbers. The extra 30,000 steps bought 1.4 accuracy points but spent 2.7 epsilon, and the gate chooses the earlier checkpoint unless the team retrains with more noise or obtains a new policy approval.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Abadi et al., Deep Learning with Differential Privacy, then read TensorFlow Privacy and Opacus accountant documentation to see how real APIs record noise, clipping, sampling, steps, epsilon, and delta.',
        'Next study DP-SGD, membership inference, model inversion, privacy random variables, Renyi Differential Privacy, audit evidence packets, and benchmark variance. The next mental model is that privacy is not a label on a model; it is a budgeted release process.',
      ],
    },
  ],
};
