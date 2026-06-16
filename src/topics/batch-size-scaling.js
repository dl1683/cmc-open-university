// Batch-size scaling: distributed SGD gets faster only while optimization,
// generalization, and hardware efficiency all hold together.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'batch-size-scaling',
  title: 'Batch Size Scaling',
  category: 'AI & ML',
  summary: 'Why large minibatches need linear learning-rate scaling, warmup, and honest validation instead of just more GPUs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['noise scale', 'linear warmup'], defaultValue: 'noise scale' },
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

function* noiseScale() {
  const sizes = [32, 128, 512, 2048, 8192];
  const noise = sizes.map((x) => ({ x, y: 100 / Math.sqrt(x / 32) }));
  const steps = sizes.map((x) => ({ x, y: 100000 / (x / 32) }));
  yield {
    state: plotState({
      axes: { x: { label: 'minibatch size', min: 0, max: 8500 }, y: { label: 'relative amount', min: 0, max: 105 } },
      series: [
        { id: 'noise', label: 'gradient noise', points: noise },
        { id: 'steps', label: 'updates per epoch', points: steps.map((p) => ({ x: p.x, y: Math.min(100, p.y / 1000) })) },
      ],
      markers: [
        { id: 'small', x: 128, y: 50, label: 'small batch' },
        { id: 'large', x: 8192, y: 6, label: 'large batch' },
      ],
    }),
    highlight: { active: ['noise', 'steps'], found: ['small', 'large'] },
    explanation: 'Increasing batch size averages away gradient noise and reduces the number of updates per epoch. That is the bargain: more parallel work per step, fewer parameter updates, and a different optimization path.',
  };

  yield {
    state: labelMatrix(
      'What changes as batch size grows',
      [
        { id: 'noise', label: 'gradient noise' },
        { id: 'updates', label: 'updates' },
        { id: 'hardware', label: 'hardware use' },
        { id: 'generalize', label: 'generalization' },
      ],
      [
        { id: 'small', label: 'small batch' },
        { id: 'large', label: 'large batch' },
      ],
      [
        ['noisy but useful', 'stable but less exploratory'],
        ['many cheap steps', 'fewer expensive steps'],
        ['underuses many GPUs', 'high throughput if synchronized'],
        ['often robust', 'needs tuning and validation'],
      ],
    ),
    highlight: { active: ['noise:large', 'updates:large', 'hardware:large'], compare: ['generalize:large'] },
    explanation: 'Large batches are not automatically bad. They change the noise, update count, and hardware efficiency. The question is whether the optimizer can preserve accuracy while using the parallelism.',
    invariant: 'Batch size is an optimization hyperparameter, not just a hardware knob.',
  };

  yield {
    state: labelMatrix(
      'Distributed synchronous SGD',
      [
        { id: 'workers', label: 'workers' },
        { id: 'local', label: 'local minibatch' },
        { id: 'allreduce', label: 'gradient sync' },
        { id: 'step', label: 'optimizer step' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'failure', label: 'failure if weak' },
      ],
      [
        ['compute shards', 'stragglers'],
        ['keeps GPUs busy', 'too small to amortize overhead'],
        ['average gradients', 'network bottleneck'],
        ['apply one update', 'learning rate too aggressive'],
      ],
    ),
    highlight: { found: ['workers:role', 'allreduce:role', 'step:role'], compare: ['allreduce:failure'] },
    explanation: 'Distributed training increases global batch by splitting examples across workers, averaging gradients, and applying one optimizer step. The communication pattern is as important as the math.',
  };

  yield {
    state: labelMatrix(
      'When scaling stops helping',
      [
        { id: 'critical', label: 'critical batch' },
        { id: 'comm', label: 'communication' },
        { id: 'memory', label: 'memory' },
        { id: 'quality', label: 'quality' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'response', label: 'response' },
      ],
      [
        ['throughput rises but steps vanish', 'train longer or reduce batch'],
        ['GPUs wait on network', 'overlap and topology-aware all-reduce'],
        ['activations do not fit', 'checkpointing or accumulation'],
        ['validation gap widens', 'tune LR, regularization, data'],
      ],
    ),
    highlight: { active: ['critical:response', 'comm:response', 'quality:response'] },
    explanation: 'There is usually a point where adding batch gives less speed or worse validation. Scaling discipline means noticing the knee instead of buying more hardware blindly.',
  };
}

function* linearWarmup() {
  const constant = Array.from({ length: 21 }, (_, i) => ({ x: i, y: i === 0 ? 8 : 8 }));
  const warmup = Array.from({ length: 21 }, (_, i) => ({ x: i, y: i < 5 ? 1 + (7 * i) / 5 : 8 - (i - 5) * 0.18 }));
  yield {
    state: plotState({
      axes: { x: { label: 'epoch', min: 0, max: 20 }, y: { label: 'learning rate multiplier', min: 0, max: 9 } },
      series: [
        { id: 'constant', label: 'jump to large LR', points: constant },
        { id: 'warmup', label: 'linear warmup then decay', points: warmup },
      ],
      markers: [
        { id: 'danger', x: 1, y: 8, label: 'early shock' },
        { id: 'stable', x: 5, y: 8, label: 'warmed up' },
      ],
    }),
    highlight: { active: ['constant', 'danger'], found: ['warmup', 'stable'] },
    explanation: 'The linear-scaling rule says that if the batch grows k times, the learning rate can often grow k times. Warmup prevents the first few epochs from taking that full large step before the model has stabilized.',
  };

  yield {
    state: labelMatrix(
      'Linear scaling rule',
      [
        { id: 'base', label: 'base run' },
        { id: 'x4', label: '4x batch' },
        { id: 'x16', label: '16x batch' },
        { id: 'warm', label: 'warmup' },
      ],
      [
        { id: 'batch', label: 'batch' },
        { id: 'lr', label: 'learning rate' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['256', '0.1', 'known stable baseline'],
        ['1024', '0.4', 'same per-epoch update scale'],
        ['4096', '1.6', 'needs care early'],
        ['first epochs', 'ramp upward', 'avoid optimization shock'],
      ],
    ),
    highlight: { active: ['x4:lr', 'x16:lr', 'warm:lr'], found: ['base:reason'] },
    explanation: 'The rule is empirical but powerful: scale the learning rate with global batch, then use warmup to avoid the unstable beginning. This is the central move in the ImageNet-in-1-hour result.',
    invariant: 'Large-batch training changes both the batch and the optimizer schedule.',
  };

  yield {
    state: labelMatrix(
      'Gradient accumulation is not the same as more throughput',
      [
        { id: 'accum', label: 'accumulation' },
        { id: 'parallel', label: 'more GPUs' },
        { id: 'sync', label: 'sync SGD' },
        { id: 'async', label: 'async SGD' },
      ],
      [
        { id: 'what', label: 'what it changes' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['effective batch', 'more time per update'],
        ['wall-clock parallelism', 'communication and cost'],
        ['one consistent update', 'waits for slow workers'],
        ['higher throughput', 'stale gradients'],
      ],
    ),
    highlight: { compare: ['accum:cost', 'parallel:cost'], found: ['sync:what', 'async:cost'] },
    explanation: 'Accumulating gradients can simulate a larger batch on one device, but it does not reduce wall-clock time the same way more parallel workers can. The system and optimizer questions are linked but distinct.',
  };

  yield {
    state: labelMatrix(
      'Validation keeps scaling honest',
      [
        { id: 'train', label: 'training loss' },
        { id: 'val', label: 'validation loss' },
        { id: 'speed', label: 'speedup' },
        { id: 'cost', label: 'cost per target' },
      ],
      [
        { id: 'good', label: 'good sign' },
        { id: 'bad', label: 'bad sign' },
      ],
      [
        ['falls smoothly', 'falls only on train'],
        ['matches baseline', 'accuracy gap appears'],
        ['near-linear efficiency', 'network dominates'],
        ['lower total cost', 'faster but more expensive'],
      ],
    ),
    highlight: { active: ['val:good', 'speed:good', 'cost:good'], compare: ['val:bad', 'cost:bad'] },
    explanation: 'The right scoreboard is not just examples per second. Large-batch scaling wins only if validation quality and total cost hold up against the smaller-batch baseline.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'noise scale') yield* noiseScale();
  else if (view === 'linear warmup') yield* linearWarmup();
  else throw new InputError('Pick a batch-size view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Batch Size Scaling studies what happens when training uses much larger minibatches, usually to exploit many GPUs. A minibatch gradient is an estimate of the full-data gradient. Larger batches reduce that noise and expose more parallel work per optimizer step. They also reduce the number of updates per epoch and can change the optimization path. That is why batch size is both a systems knob and a learning hyperparameter.',
        'The classic large-batch result is Goyal et al.\'s ImageNet-in-1-hour work. They showed that distributed synchronous SGD could train ResNet-50 with a minibatch up to 8192 while preserving accuracy, using a linear learning-rate scaling rule and warmup. The message is not "always use huge batches." The message is that scaling can work when optimization details and hardware efficiency are handled together.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In distributed synchronous SGD, each worker processes a local minibatch, computes gradients, and participates in an all-reduce or parameter synchronization step. The gradients are averaged, then the optimizer applies one update. If the global batch is k times larger, the linear-scaling rule often tries a learning rate k times larger so the per-epoch progress stays comparable. Warmup ramps toward that larger rate over the first few epochs to avoid unstable early updates.',
        'This connects directly to Gradient Descent, Backpropagation, Learning-Rate Schedules & Warmup, and Parameter Server Case Study. The algorithmic loop and the communication system cannot be separated. Too little per-worker work wastes GPU time. Too much global batch can reduce update diversity, hurt validation, or make learning-rate tuning fragile.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Large-batch scaling has several ceilings. Communication can dominate when all-reduce traffic grows or when stragglers delay synchronous steps. Memory can limit local batch size, forcing gradient accumulation. Optimization can hit a critical batch size where larger batches provide less statistical benefit. Generalization can drift if the schedule, regularization, or number of training epochs is not adjusted.',
        'The cost scoreboard should include wall-clock time to target quality, hardware efficiency, validation accuracy, and total dollars. A run that is faster but uses vastly more accelerators may be economically worse. A run that reaches lower training loss but worse validation has failed the real objective.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Large-batch methods are used in vision training, language-model pretraining, recommender systems, contrastive learning, and any setting where data parallelism can keep many accelerators busy. Modern training stacks combine large batches with AdamW or SGD variants, warmup, cosine or linear decay, gradient clipping, mixed precision, activation checkpointing, and topology-aware collective communication.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The main misconception is that more batch is equivalent to more speed. Larger batches reduce the number of optimizer updates; they do not guarantee better time to quality. Another mistake is copying a learning rate without copying the batch, warmup, optimizer, model, and data regime. Finally, gradient accumulation can increase effective batch size without improving hardware parallelism. It may be necessary for memory, but it is not the same as adding synchronized workers.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Accurate, Large Minibatch SGD: Training ImageNet in 1 Hour at https://arxiv.org/abs/1706.02677. Study Scaling as Local Optimum Case Study, Gradient Descent, Backpropagation, Learning-Rate Schedules & Warmup, Parameter Server Case Study, Learning Curves & Bias-Variance, Loss Landscapes & Optimization Geometry, and Vanishing & Exploding Gradients next.',
      ],
    },
  ],
};
