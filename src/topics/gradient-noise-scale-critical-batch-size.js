// Gradient noise scale explains why batch size has a useful knee instead of
// being a monotonic "bigger is better" training knob.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'gradient-noise-scale-critical-batch-size',
  title: 'Gradient Noise Scale & Critical Batch Size',
  category: 'AI & ML',
  summary: 'A practical batch-size primer: separate gradient signal from gradient variance, find the critical batch knee, and scale without wasting updates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['noise meter', 'scaling decision'], defaultValue: 'noise meter' },
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

function signalGraph(title) {
  return graphState({
    nodes: [
      { id: 'data', label: 'data', x: 0.8, y: 3.7, note: 'full set' },
      { id: 'sample', label: 'sample', x: 2.4, y: 2.3, note: 'mini' },
      { id: 'mean', label: 'mean', x: 4.3, y: 2.3, note: 'signal' },
      { id: 'var', label: 'var', x: 4.3, y: 5.1, note: 'noise' },
      { id: 'gns', label: 'GNS', x: 6.3, y: 3.7, note: 'noise/signal' },
      { id: 'batch', label: 'batch', x: 8.2, y: 3.7, note: 'knee' },
    ],
    edges: [
      { id: 'e-data-sample', from: 'data', to: 'sample' },
      { id: 'e-sample-mean', from: 'sample', to: 'mean' },
      { id: 'e-sample-var', from: 'sample', to: 'var' },
      { id: 'e-mean-gns', from: 'mean', to: 'gns' },
      { id: 'e-var-gns', from: 'var', to: 'gns' },
      { id: 'e-gns-batch', from: 'gns', to: 'batch' },
    ],
  }, { title });
}

function* noiseMeter() {
  yield {
    state: signalGraph('A minibatch gradient has signal and noise'),
    highlight: { active: ['data', 'sample', 'mean', 'var', 'e-data-sample', 'e-sample-mean', 'e-sample-var'], found: ['gns', 'batch'] },
    explanation: 'A minibatch gradient is an estimate. The mean points toward the full-data direction; the variance is sampling noise. Gradient noise scale asks how much variance there is relative to squared signal.',
    invariant: 'Batch size controls the estimator, not just the hardware load.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'global batch size', min: 0, max: 9000 }, y: { label: 'relative gain', min: 0, max: 105 } },
      series: [
        { id: 'speed', label: 'time speedup', points: [
          { x: 64, y: 6 }, { x: 256, y: 22 }, { x: 1024, y: 62 }, { x: 2048, y: 82 }, { x: 4096, y: 92 }, { x: 8192, y: 96 },
        ] },
        { id: 'eff', label: 'data efficiency', points: [
          { x: 64, y: 98 }, { x: 256, y: 96 }, { x: 1024, y: 88 }, { x: 2048, y: 74 }, { x: 4096, y: 52 }, { x: 8192, y: 30 },
        ] },
      ],
      markers: [
        { id: 'small', x: 256, y: 96, label: 'small' },
        { id: 'knee', x: 2048, y: 78, label: 'knee' },
        { id: 'waste', x: 8192, y: 40, label: 'waste' },
      ],
    }),
    highlight: { active: ['speed', 'eff', 'knee'], compare: ['small', 'waste'] },
    explanation: 'Below the critical batch, larger batches usually improve wall-clock speed with limited loss in data efficiency. Past the knee, updates become expensive and less statistically useful.',
  };

  yield {
    state: labelMatrix(
      'What gradient noise buys and costs',
      [
        { id: 'small', label: 'small batch' },
        { id: 'near', label: 'near knee' },
        { id: 'huge', label: 'huge batch' },
        { id: 'accum', label: 'accum' },
      ],
      [
        { id: 'signal', label: 'gradient' },
        { id: 'benefit', label: 'benefit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['noisy', 'many updates', 'slow wall time'],
        ['clean enough', 'best trade', 'schedule care'],
        ['very clean', 'GPU busy', 'wasted data'],
        ['same stats', 'fits memory', 'not faster'],
      ],
    ),
    highlight: { active: ['near:benefit', 'near:risk'], compare: ['small:risk', 'huge:risk', 'accum:benefit'] },
    explanation: 'The sweet spot is not minimum noise. It is enough averaging to exploit parallelism while keeping enough update diversity and enough updates per epoch to reach the target quality cheaply.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'training progress', min: 0, max: 100 }, y: { label: 'scale', min: 0, max: 100 } },
      series: [
        { id: 'gns', label: 'noise scale', points: [
          { x: 0, y: 18 }, { x: 20, y: 28 }, { x: 40, y: 44 }, { x: 60, y: 63 }, { x: 80, y: 78 }, { x: 100, y: 88 },
        ] },
        { id: 'batch', label: 'adaptive batch', points: [
          { x: 0, y: 14 }, { x: 20, y: 22 }, { x: 40, y: 38 }, { x: 60, y: 58 }, { x: 80, y: 76 }, { x: 100, y: 86 },
        ] },
      ],
      markers: [
        { id: 'early', x: 10, y: 20, label: 'early' },
        { id: 'late', x: 90, y: 84, label: 'late' },
      ],
    }),
    highlight: { active: ['gns', 'batch'], found: ['late'] },
    explanation: 'McCandlish et al. observed that noise scale can increase as training progresses. That supports adaptive batch schedules: start smaller when signal is strong, then grow the batch when larger batches are statistically useful.',
  };
}

function* scalingDecision() {
  yield {
    state: labelMatrix(
      'Estimating the knee',
      [
        { id: 'small', label: 'small run' },
        { id: 'large', label: 'large run' },
        { id: 'mean', label: 'mean' },
        { id: 'var', label: 'variance' },
      ],
      [
        { id: 'measure', label: 'measure' },
        { id: 'use', label: 'use' },
      ],
      [
        ['grad norm', 'sample signal'],
        ['grad norm', 'reduce noise'],
        ['direction', 'true push'],
        ['scatter', 'batch knee'],
      ],
    ),
    highlight: { active: ['mean:use', 'var:use'], found: ['small:measure', 'large:measure'] },
    explanation: 'You do not need to mythologize batch size. Measure gradients at different batch sizes, estimate signal and variance, and treat the critical batch as an empirical quantity for this model and data regime.',
  };

  yield {
    state: signalGraph('Two valid goals imply different batch choices'),
    highlight: { active: ['gns', 'batch', 'e-gns-batch'], compare: ['mean', 'var'] },
    explanation: 'Compute-efficient training chooses smaller batches to use each example well. Time-efficient training chooses larger batches up to the knee to finish sooner. Confusing those goals creates bad benchmark claims.',
  };

  yield {
    state: labelMatrix(
      'Source map',
      [
        { id: 'goyal', label: 'Goyal' },
        { id: 'keskar', label: 'Keskar' },
        { id: 'smith', label: 'Smith' },
        { id: 'mcc', label: 'GNS' },
      ],
      [
        { id: 'lesson', label: 'lesson' },
        { id: 'control', label: 'control' },
      ],
      [
        ['large can work', 'warmup'],
        ['sharp minima risk', 'validate'],
        ['batch vs LR', 'schedule'],
        ['critical batch', 'measure'],
      ],
    ),
    highlight: { active: ['goyal:control', 'mcc:lesson', 'mcc:control'], compare: ['keskar:lesson', 'smith:control'] },
    explanation: 'The literature is not a single slogan. Large batches can work with warmup, small-batch noise can help, batch growth can substitute for LR decay, and gradient noise scale gives a measurement story.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'epoch', min: 0, max: 100 }, y: { label: 'training temperature', min: 0, max: 100 } },
      series: [
        { id: 'lr', label: 'LR decay', points: [
          { x: 0, y: 90 }, { x: 25, y: 75 }, { x: 50, y: 48 }, { x: 75, y: 24 }, { x: 100, y: 12 },
        ] },
        { id: 'batch', label: 'batch growth', points: [
          { x: 0, y: 90 }, { x: 25, y: 76 }, { x: 50, y: 50 }, { x: 75, y: 26 }, { x: 100, y: 14 },
        ] },
      ],
      markers: [
        { id: 'same', x: 50, y: 50, label: 'same noise' },
        { id: 'cool', x: 90, y: 18, label: 'cool' },
      ],
    }),
    highlight: { active: ['lr', 'batch', 'same'], found: ['cool'] },
    explanation: 'Smith and Le framed learning-rate decay and batch-size increase as two ways to reduce training noise. That makes batch schedules part of optimizer design, not merely cluster plumbing.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'noise meter') yield* noiseMeter();
  else if (view === 'scaling decision') yield* scalingDecision();
  else throw new InputError('Pick a gradient-noise-scale view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Gradient noise scale is a way to reason about minibatch training quantitatively. A minibatch gradient has a signal component, the average direction you would get from much more data, and a noise component, the variation caused by sampling only part of the dataset. The gradient noise scale compares those pieces and predicts the largest batch size that is still statistically useful. McCandlish et al. present it as a simple statistic that predicts useful batch-size limits across supervised learning, reinforcement learning, and generative-model settings: https://arxiv.org/abs/1812.06162.',
        'This topic extends Batch Size Scaling. Linear scaling and warmup explain how to make a large batch train stably. Gradient noise scale explains when making the batch larger is likely to stop paying for itself.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Small batches give noisy gradients. That can waste steps, but it can also act like a source of exploration and regularization. Large batches average away noise, expose parallel work, and make each optimizer step more expensive in data. The critical batch size is the knee where more examples per update mostly reduce noise that no longer limits progress.',
        'In practical terms, a team can compare gradients at different batch sizes, estimate the ratio of gradient variance to squared gradient signal, and choose a batch near the useful knee. Below that knee, adding batch often improves wall-clock time with limited loss in data efficiency. Far above it, training may still use the hardware but consumes extra examples per useful update.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The core tradeoff is compute efficiency versus time efficiency. Compute-efficient runs use smaller batches and more updates because every example contributes more statistical value. Time-efficient runs use larger batches and more devices to finish sooner. Neither is universally correct. The right choice depends on accelerator cost, launch deadline, target metric, and whether the training job is limited by communication, memory, input pipeline, or optimization.',
        'Gradient accumulation deserves special care. Accumulation can create a large effective batch when memory is tight, but it does not automatically create wall-clock speedup. It changes the gradient statistics without adding parallel workers. That distinction matters when comparing one-GPU prototypes to distributed runs using GPU All-Reduce.',
      ],
    },
    {
      heading: 'Case-study connections',
      paragraphs: [
        'Goyal et al. showed that ImageNet training could scale to minibatches of 8192 with linear learning-rate scaling and warmup while preserving accuracy: https://arxiv.org/abs/1706.02677. Keskar et al. warned that large-batch methods can converge to sharper minima and worse generalization in some regimes: https://arxiv.org/abs/1609.04836. Smith and Le argued that increasing batch size can play a role similar to learning-rate decay by reducing SGD noise: https://arxiv.org/abs/1711.00489.',
        'Taken together, the lesson is disciplined rather than ideological. Large batch is not always bad, small batch is not always virtuous, and throughput alone is not the metric. Measure the knee, preserve validation quality, and price the run by time to target quality.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat the critical batch as a constant for a whole field. It depends on the model, dataset, optimizer, training stage, and loss value. McCandlish et al. report that noise scale can change over the course of training, which is why adaptive batch schedules are plausible. Also, sharp-minima arguments are useful diagnostics, not a universal proof that any large batch will generalize poorly.',
        'Another trap is benchmarking only examples per second. A larger batch can improve throughput while increasing cost to reach the same validation score. For honest comparisons, report validation quality, number of optimizer updates, examples processed, hardware count, wall-clock time, and total cost.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: An Empirical Model of Large-Batch Training at https://arxiv.org/abs/1812.06162, ImageNet in 1 Hour at https://arxiv.org/abs/1706.02677, On Large-Batch Training and Sharp Minima at https://arxiv.org/abs/1609.04836, and Don\'t Decay the Learning Rate, Increase the Batch Size at https://arxiv.org/abs/1711.00489. Study Batch Size Scaling, Gradient Descent, Learning-Rate Schedules & Warmup, Loss Landscapes & Optimization Geometry, Regularization, Benchmark Variance & Model Selection, and GPU All-Reduce next.',
      ],
    },
  ],
};
