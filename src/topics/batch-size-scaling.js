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
    explanation: 'As the minibatch grows, the gradient estimate gets quieter and the epoch contains fewer optimizer updates. The plot is showing the core bargain: more parallel work per step, but fewer chances for the optimizer to change direction.',
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
    explanation: 'The matrix separates the effects that often get blurred together. A large batch can keep hardware busy and reduce noise, but it also removes update diversity. Validation decides whether that parallelism preserved learning or only changed the path.',
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
    explanation: 'Synchronous data parallelism makes one global batch from many local batches. The all-reduce averages those gradients before a single update, so network delay and stragglers become part of the training algorithm, not just system overhead.',
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
    explanation: 'This table is the failure checklist for large-batch runs. Past the useful knee, extra batch can vanish into communication, memory pressure, or worse validation. Scaling is only a win when time to the same target quality falls.',
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
    explanation: 'The dashed choice is the naive jump: use the large-batch learning rate immediately. Warmup ramps toward that rate so early unstable gradients do not take oversized steps before the representation has settled.',
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
    explanation: 'The table ties the learning-rate multiplier to global batch size. The rule is empirical: try to preserve per-epoch progress with a larger step, then use warmup because the first epochs are the most fragile.',
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
    explanation: 'Gradient accumulation changes the effective batch seen by the optimizer, not the amount of parallel hardware. It can fix memory limits, but it usually trades fewer updates for more time per update rather than producing distributed speedup.',
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
    explanation: 'The final scoreboard rejects throughput alone. A scaled run wins only if it reaches the same validation target sooner or cheaper; faster examples per second can still lose if accuracy drops or accelerator cost rises.',
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
      heading: 'Why This Topic Exists',
      paragraphs: [
        'Batch-size scaling exists because modern training is limited by two different clocks. One clock is statistical: how many optimizer updates are needed to reach a target validation quality? The other clock is physical: how fast can accelerators process examples, exchange gradients, and apply updates? A small minibatch gives many noisy updates and often trains well, but it may leave a large cluster underused. A very large minibatch keeps many devices busy, but it reduces update count and changes the path taken by optimization.',
        'The topic matters because "more GPUs" is not a training algorithm. If batch size grows without changing the learning-rate schedule, regularization, synchronization strategy, and validation discipline, the run can become faster in examples per second and worse in the metric that matters. Large-batch training became credible because work such as the ImageNet-in-1-hour result showed a controlled recipe: synchronous data parallelism, linear learning-rate scaling, warmup, and an honest comparison to the small-batch baseline.',
        {type: 'callout', text: 'Batch size is useful only while statistical progress, optimizer stability, and hardware throughput improve the same target metric.'},
      ],
    },
    {
      heading: 'The Naive Approach',
      paragraphs: [
        'The naive approach is to keep the old training recipe and simply increase the global batch. If one GPU used a batch of 256, then 32 GPUs can use a global batch of 8192, run fewer steps per epoch, and finish sooner. That arithmetic is only about throughput. It ignores the fact that stochastic gradient descent learns from a sequence of updates, not from epochs as an abstract unit. Fewer updates mean fewer chances to correct direction, react to curvature, and benefit from gradient noise.',
        'A second naive approach is to raise the learning rate immediately in proportion to the larger batch. That can work after the model has entered a stable regime, but early training is fragile. Features are not formed, batch statistics are unsettled, and the loss surface can be steep. Jumping to a large step on the first iteration can throw the model into a poor region or cause divergence. Warmup exists because the large-batch learning rate is often useful later than it is at the start.',
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        'A minibatch gradient is an estimate of the full-data gradient. Larger batches reduce variance in that estimate. That is good up to a point, because each update points more reliably downhill. Past a critical batch size, however, the extra examples mostly confirm a direction that was already clear. The run pays for more examples per update without getting proportional learning progress. The critical batch is not a universal constant; it depends on model, data, optimizer, schedule, and target quality.',
        'The scaling insight is therefore conditional: increase batch size only while time to the same validation target improves. The right objective is not maximum examples per second. It is lower wall-clock time or lower cost to reach a specified quality. A large batch is successful when the hardware parallelism saves more time than the optimization changes lose. This is why large-batch work always needs a matched baseline, not just a throughput chart.',
      ],
    },
    {
      heading: 'How The System Works',
      paragraphs: [
        'In synchronous data-parallel training, each worker receives a local minibatch, runs forward and backward passes, and computes gradients for its shard. The workers then participate in an all-reduce or equivalent synchronization step. The gradients are averaged into one global gradient, and the optimizer applies one update. The global batch is the sum of local batches across workers, possibly multiplied by gradient accumulation steps.',
        'The linear scaling rule says that if the global batch is multiplied by k, try multiplying the learning rate by k. The intuition is per-epoch progress: a larger batch takes fewer updates per epoch, so each update must move farther to keep total progress similar. Warmup ramps from a smaller learning rate to the scaled learning rate over the first part of training. Decay then reduces the rate as optimization approaches a basin. This recipe couples batch size, learning rate, schedule, and optimizer state.',
      ],
    },
    {
      heading: 'What The Visual Is Proving',
      paragraphs: [
        'The noise-scale view proves that batch size changes two quantities at once. The gradient becomes less noisy, but the epoch contains fewer updates. That is why the plot cannot be read as "larger is cleaner, so larger is better." Cleaner estimates help until the lost update opportunities and reduced stochasticity become more important. The useful knee is where additional batch stops improving time to target.',
        'The warmup view proves that large-batch training needs a schedule, not a single number. The dangerous curve jumps to the scaled learning rate before the model is ready. The safer curve ramps upward, lets early representations stabilize, and then uses the larger step. The validation scoreboard proves the final rule: a scaled run wins only if it reaches the same or better validation quality sooner or cheaper than the baseline.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'Large-batch scaling works when the gradient noise at the baseline batch is still high enough that averaging more examples improves the update, and when the learning-rate schedule compensates for fewer updates. It also works when the system can keep accelerators busy while hiding or reducing communication overhead. In that regime, each synchronized step costs more computation but uses enough parallel hardware that wall-clock time drops.',
        'Warmup works because early gradients can be poorly conditioned. The network begins with random or pretrained weights that may not yet produce stable internal statistics. A large learning rate can amplify transient gradient directions. A ramp gives the optimizer time to move into a region where the scaled step is less destructive. In practice, warmup is also a tuning bridge: it makes large runs less sensitive to the exact first-epoch dynamics.',
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        'The first cost is communication. All-reduce has to move gradient data across devices, and synchronous training waits for slow workers. Good implementations overlap communication with computation, use topology-aware collectives, shard optimizer state, and tune local batch size so each worker has enough work to amortize overhead. The second cost is memory. Larger local batches consume activation memory, which may force activation checkpointing, mixed precision, gradient accumulation, or smaller models.',
        'The third cost is quality risk. Large batches can reach lower training loss while generalizing worse, especially if regularization, augmentation, epoch count, or learning-rate decay are copied blindly. The fourth cost is economic. A run that finishes in half the time on eight times the hardware may be a worse purchase. Cost per target quality should include accelerator hours, failed tuning runs, communication efficiency, energy, and the opportunity cost of occupying a cluster.',
      ],
    },
    {
      heading: 'Real Uses',
      paragraphs: [
        'Large-batch methods are used in vision training, language-model pretraining, recommender systems, speech models, contrastive learning, and large-scale fine-tuning. They are especially useful when data parallelism is the cleanest way to use many accelerators. Modern recipes combine large batches with AdamW or SGD variants, warmup, cosine or linear decay, gradient clipping, mixed precision, activation checkpointing, and optimized collective communication. At very large scale, pipeline and tensor parallelism may join data parallelism, but batch-size scaling remains the simplest lever for exposing parallel work.',
        'Gradient accumulation is related but different. It increases the effective batch by summing gradients over multiple microbatches before an optimizer step. It can solve memory limits and imitate the optimizer behavior of a larger batch, but it does not by itself create more wall-clock parallelism. More GPUs can reduce time per update if communication is efficient. Accumulation usually increases time per update while reducing the number of updates. Mixing the two without measuring time to quality causes confusion.',
      ],
    },
    {
      heading: 'Failure Modes And Limits',
      paragraphs: [
        'Scaling stops helping at several ceilings. Past the critical batch, more examples give little statistical benefit. If communication dominates, devices wait instead of computing. If local batches are too small, kernels run inefficiently. If local batches are too large, memory pressure forces slower techniques. If the learning rate is too aggressive, the run diverges. If it is too conservative, the large batch wastes updates. If validation quality lags, the speedup is not a success.',
        'The most common reporting failure is to show examples per second without the quality target. A serving team should ask: did the scaled run reach the same validation metric, with the same data budget and comparable regularization, at lower wall-clock time or lower total cost? Another failure is to tune the scaled run heavily while leaving the baseline weak. Fair comparison means matching effort, reporting failed runs when possible, and separating hardware efficiency from model quality.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Study Gradient Descent and Backpropagation first, because batch size changes the update sequence produced by those algorithms. Then study Learning-Rate Schedules & Warmup, Loss Landscapes & Optimization Geometry, and Learning Curves & Bias-Variance to understand why the same training loss can produce different validation behavior. Study Parameter Server Case Study, all-reduce collectives, mixed precision, gradient accumulation, and distributed optimizer sharding for the systems side. The primary large-batch reference is Accurate, Large Minibatch SGD: Training ImageNet in 1 Hour, which is useful because it shows the recipe and the discipline around preserving accuracy.',
      ],
    },
  ],
};
