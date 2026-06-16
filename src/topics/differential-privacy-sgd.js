// DP-SGD: clip each example's gradient, average the bounded updates, add
// calibrated noise, and account for privacy loss over repeated training rounds.

import { matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'differential-privacy-sgd',
  title: 'Differential Privacy SGD',
  category: 'AI & ML',
  summary: 'Train with bounded individual influence: per-example clipping, Gaussian noise, privacy accounting, and the accuracy tradeoff.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['clipping and noise', 'privacy accounting'], defaultValue: 'clipping and noise' },
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

function* clippingAndNoise() {
  yield {
    state: labelMatrix(
      'Per-example gradients before and after clipping',
      [
        { id: 'a', label: 'example A' },
        { id: 'b', label: 'example B' },
        { id: 'c', label: 'example C' },
        { id: 'outlier', label: 'rare outlier' },
      ],
      [
        { id: 'raw', label: 'raw norm' },
        { id: 'clipped', label: 'after clip C=1' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['0.7', '0.7', 'kept'],
        ['1.0', '1.0', 'kept'],
        ['0.4', '0.4', 'kept'],
        ['8.2', '1.0', 'bounded'],
      ],
    ),
    highlight: { active: ['outlier:raw'], found: ['outlier:clipped'], compare: ['a:clipped', 'b:clipped', 'c:clipped'] },
    explanation: 'DP-SGD starts by computing gradients per training example, not only for the whole minibatch. Every example is clipped to a maximum norm C. That bound is the privacy lever: one record cannot push the update arbitrarily far.',
    invariant: 'The contribution of one example is bounded before averaging.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'gradient x', min: -1.5, max: 4.5 }, y: { label: 'gradient y', min: -1.5, max: 4.5 } },
      markers: [
        { id: 'gA', x: 0.6, y: 0.3, label: 'A' },
        { id: 'gB', x: 0.9, y: 0.4, label: 'B' },
        { id: 'gC', x: 0.2, y: 0.3, label: 'C' },
        { id: 'rawOut', x: 4.0, y: 3.2, label: 'raw outlier' },
        { id: 'clipOut', x: 0.8, y: 0.6, label: 'clipped outlier' },
      ],
      vectors: [
        { id: 'clip', label: 'project to norm C', from: { x: 4.0, y: 3.2 }, to: { x: 0.8, y: 0.6 } },
      ],
    }),
    highlight: { active: ['clip'], removed: ['rawOut'], found: ['clipOut'] },
    explanation: 'Clipping changes only gradients whose norm is too large. In high-dimensional neural nets this is not a cosmetic detail: without clipping, a rare or memorized record can dominate the average and make privacy accounting meaningless.',
  };

  yield {
    state: labelMatrix(
      'Average, then add Gaussian noise',
      [
        { id: 'avg', label: 'clipped average' },
        { id: 'noise', label: 'noise sample' },
        { id: 'sent', label: 'optimizer update' },
        { id: 'signal', label: 'tradeoff' },
      ],
      [
        { id: 'x', label: 'x component' },
        { id: 'y', label: 'y component' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['+0.63', '+0.40', 'bounded signal'],
        ['-0.18', '+0.27', 'privacy noise'],
        ['+0.45', '+0.67', 'noisy update'],
        ['more noise', 'less leakage', 'less accuracy'],
      ],
    ),
    highlight: { active: ['noise:x', 'noise:y'], found: ['sent:x', 'sent:y'], compare: ['signal:meaning'] },
    explanation: 'After averaging clipped gradients, DP-SGD adds calibrated noise. The optimizer sees a noisy estimate of the training direction. The privacy guarantee comes from making neighboring datasets produce similar output distributions.',
  };

  yield {
    state: labelMatrix(
      'The DP-SGD training loop',
      [
        { id: 'sample', label: 'sample minibatch' },
        { id: 'perex', label: 'per-example grads' },
        { id: 'clip', label: 'clip' },
        { id: 'noise', label: 'add noise' },
        { id: 'account', label: 'account' },
      ],
      [
        { id: 'why', label: 'why it exists' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['subsampling amplifies privacy', 'randomness to track'],
        ['needed for clipping', 'more memory and compute'],
        ['bound one record', 'biases gradient'],
        ['hide participation', 'lowers signal-to-noise'],
        ['compose over rounds', 'epsilon budget is finite'],
      ],
    ),
    highlight: { found: ['perex:why', 'clip:why', 'noise:why', 'account:why'] },
    explanation: 'The algorithm is simple enough to fit in one table, but the engineering is not free. Per-example gradients, clipping, noising, and accounting all change the training system and the model-quality budget.',
  };
}

function* privacyAccounting() {
  yield {
    state: labelMatrix(
      'Neighboring datasets should look nearly the same',
      [
        { id: 'd', label: 'dataset D' },
        { id: 'dprime', label: 'dataset D prime' },
        { id: 'mechanism', label: 'training run' },
        { id: 'observer', label: 'observer' },
      ],
      [
        { id: 'contains', label: 'difference' },
        { id: 'sees', label: 'what is visible' },
      ],
      [
        ['Alice included', 'final model distribution'],
        ['Alice removed', 'almost same distribution'],
        ['random sampling + noise', 'not deterministic'],
        ['model outputs', 'cannot be too sure'],
      ],
    ),
    highlight: { active: ['d:contains', 'dprime:contains'], found: ['mechanism:sees', 'observer:sees'] },
    explanation: 'Differential privacy is a statement about two neighboring datasets that differ in one person. A mechanism is private when an observer seeing the output cannot confidently tell which neighboring dataset was used.',
    invariant: 'Privacy is about distributions over outputs, not hiding a row in a database table.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'epsilon privacy loss', min: 0, max: 12 }, y: { label: 'validation accuracy', min: 60, max: 95 } },
      series: [
        { id: 'frontier', label: 'typical privacy-utility frontier', points: [{ x: 0.5, y: 68 }, { x: 1.0, y: 74 }, { x: 2.0, y: 81 }, { x: 4.0, y: 87 }, { x: 8.0, y: 90 }, { x: 12.0, y: 91 }] },
      ],
      markers: [
        { id: 'strict', x: 1.0, y: 74, label: 'strict privacy' },
        { id: 'loose', x: 8.0, y: 90, label: 'looser privacy' },
      ],
    }),
    highlight: { active: ['frontier'], compare: ['strict', 'loose'] },
    explanation: 'Lower epsilon is stronger privacy, but usually requires more noise and hurts utility. Higher epsilon gives the optimizer a cleaner signal but weaker privacy. The right point depends on data sensitivity and product risk.',
  };

  yield {
    state: labelMatrix(
      'Composition consumes privacy budget',
      [
        { id: 'r1', label: '1 round' },
        { id: 'r10', label: '10 rounds' },
        { id: 'r100', label: '100 rounds' },
        { id: 'r1000', label: '1000 rounds' },
      ],
      [
        { id: 'gain', label: 'learning gain' },
        { id: 'privacy', label: 'privacy cost' },
      ],
      [
        ['tiny', 'small'],
        ['visible', 'moderate'],
        ['stronger model', 'large'],
        ['maybe overfit', 'budget exhausted'],
      ],
    ),
    highlight: { active: ['r100:gain'], removed: ['r1000:privacy'], compare: ['r1:privacy'] },
    explanation: 'Every private training step spends privacy budget. Accountants track how sampling, clipping, noise, and repeated rounds compose. The model may keep improving after the privacy budget says to stop.',
  };

  yield {
    state: labelMatrix(
      'What DP-SGD protects, and what it does not',
      [
        { id: 'membership', label: 'membership inference' },
        { id: 'memorization', label: 'memorization' },
        { id: 'fairness', label: 'group fairness' },
        { id: 'poisoning', label: 'poisoning' },
      ],
      [
        { id: 'dp', label: 'DP-SGD helps?' },
        { id: 'extra', label: 'still needs' },
      ],
      [
        ['yes', 'good accounting'],
        ['yes', 'audits and red-teaming'],
        ['not directly', 'slice metrics'],
        ['not enough', 'robust aggregation'],
      ],
    ),
    highlight: { found: ['membership:dp', 'memorization:dp'], compare: ['fairness:extra', 'poisoning:extra'] },
    explanation: 'DP-SGD is a privacy tool, not a full responsible-AI system. It reduces one person influence on the learned model. It does not automatically solve fairness, poisoned data, bad labels, or weak evaluation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'clipping and noise') yield* clippingAndNoise();
  else if (view === 'privacy accounting') yield* privacyAccounting();
  else throw new InputError('Pick a DP-SGD view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Differential Privacy SGD is stochastic gradient descent redesigned so a single training example has bounded influence on the final model. The core move is per-example clipping followed by calibrated noise. Clip first so one example cannot dominate the update; add noise so neighboring datasets induce similar output distributions.',
        'This page is the missing privacy primer behind Federated Learning & Secure Aggregation. Federated learning keeps raw data decentralized, secure aggregation hides individual updates from the server, and DP-SGD limits how much any one participant can affect the learned model.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A DP-SGD step samples a minibatch, computes each example gradient separately, clips each gradient to norm C, averages the clipped gradients, adds Gaussian noise, and applies the optimizer update. The accountant records how much privacy loss this randomized step consumes. Repeating the step composes privacy loss over training.',
        'The guarantee is not that the model never changes when one record changes. The guarantee is distributional: the final model should be nearly as likely under dataset D as under neighboring dataset D prime. Epsilon measures privacy loss; lower epsilon is stronger privacy. Delta allows a small failure probability in approximate differential privacy.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'DP-SGD costs accuracy, compute, memory, and iteration speed. Per-example gradients are more expensive than ordinary batch gradients. Clipping biases large gradients. Noise lowers signal-to-noise ratio, especially for small batches or rare groups. Privacy accounting can force early stopping even when validation metrics are still improving.',
        'The parameters interact. Clip norm controls sensitivity. Noise multiplier controls privacy strength. Sampling rate affects amplification. Number of steps controls composition. Batch Size Scaling matters because larger batches can improve signal averaging, but they also change sampling and optimization behavior.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'DP-SGD is used or studied for training on sensitive text, telemetry, medical data, mobile data, user logs, and privacy-sensitive personalization. It is also important for evaluating whether large models memorize training records. In production, it is often combined with secure aggregation, access controls, data retention limits, red-team audits, and slice-level evaluation.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Differential privacy is not encryption, anonymization, or access control. It limits influence on outputs. It does not guarantee fairness, robustness, or truthfulness. A private model can still be biased. A private model can still be attacked with poisoned inputs. A private model can still perform badly on minority slices if evaluation only reports global averages.',
        'Another misconception is that privacy is a one-time switch. Epsilon is spent across training runs, hyperparameter searches, repeated releases, and sometimes user-level aggregation. A serious deployment needs a privacy budget policy, not only a training flag.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Deep Learning with Differential Privacy at https://arxiv.org/abs/1607.00133, The Algorithmic Foundations of Differential Privacy at https://www.cis.upenn.edu/~aaroth/Papers/privacybook.pdf, Federated Averaging at https://arxiv.org/abs/1602.05629, and Practical Secure Aggregation at https://eprint.iacr.org/2017/281. Study Gradient Descent, Batch Size Scaling, Federated Learning & Secure Aggregation, Data Leakage, Membership Inference Shadow Model Case Study, Model Inversion Confidence Attack, LLM Training Data Extraction, PII Redaction Token Span Pipeline, and Uncertainty: Teaching Models to Say "I Don\'t Know" next.',
      ],
    },
  ],
};
