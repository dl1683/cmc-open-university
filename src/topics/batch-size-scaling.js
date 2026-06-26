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
  const smallBatch = sizes[1];
  const largeBatch = sizes[sizes.length - 1];
  yield {
    state: plotState({
      axes: { x: { label: 'minibatch size', min: 0, max: 8500 }, y: { label: 'relative amount', min: 0, max: 105 } },
      series: [
        { id: 'noise', label: 'gradient noise', points: noise },
        { id: 'steps', label: 'updates per epoch', points: steps.map((p) => ({ x: p.x, y: Math.min(100, p.y / 1000) })) },
      ],
      markers: [
        { id: 'small', x: smallBatch, y: 50, label: 'small batch' },
        { id: 'large', x: largeBatch, y: 6, label: 'large batch' },
      ],
    }),
    highlight: { active: ['noise', 'steps'], found: ['small', 'large'] },
    explanation: `As the minibatch grows from ${sizes[0]} to ${largeBatch}, the gradient estimate gets quieter and the epoch contains fewer optimizer updates. The plot shows the core bargain across ${sizes.length} batch sizes: more parallel work per step, but fewer chances for the optimizer to change direction.`,
  };

  const effectCount = 4;
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
    explanation: `The matrix separates ${effectCount} effects that often get blurred together. A large batch can keep hardware busy and reduce noise, but it also removes update diversity. Validation decides whether that parallelism preserved learning or only changed the path.`,
    invariant: 'Batch size is an optimization hyperparameter, not just a hardware knob.',
  };

  const sgdStages = ['workers', 'local minibatch', 'gradient sync', 'optimizer step'];
  yield {
    state: labelMatrix(
      'Distributed synchronous SGD',
      [
        { id: 'workers', label: sgdStages[0] },
        { id: 'local', label: sgdStages[1] },
        { id: 'allreduce', label: sgdStages[2] },
        { id: 'step', label: sgdStages[3] },
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
    explanation: `Synchronous data parallelism makes one global batch from many local batches across ${sgdStages.length} stages. The all-reduce averages those gradients before a single ${sgdStages[3]}, so network delay and stragglers become part of the training algorithm, not just system overhead.`,
  };

  const ceilings = ['critical batch', 'communication', 'memory', 'quality'];
  yield {
    state: labelMatrix(
      'When scaling stops helping',
      [
        { id: 'critical', label: ceilings[0] },
        { id: 'comm', label: ceilings[1] },
        { id: 'memory', label: ceilings[2] },
        { id: 'quality', label: ceilings[3] },
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
    explanation: `This table is the failure checklist with ${ceilings.length} ceilings for large-batch runs. Past the useful knee, extra batch can vanish into ${ceilings[1]}, ${ceilings[2]} pressure, or worse ${ceilings[3]}. Scaling is only a win when time to the same target quality falls.`,
  };
}

function* linearWarmup() {
  const maxLR = 8;
  const warmupEpochs = 5;
  const totalEpochs = 20;
  const constant = Array.from({ length: totalEpochs + 1 }, (_, i) => ({ x: i, y: i === 0 ? maxLR : maxLR }));
  const warmup = Array.from({ length: totalEpochs + 1 }, (_, i) => ({ x: i, y: i < warmupEpochs ? 1 + (7 * i) / warmupEpochs : maxLR - (i - warmupEpochs) * 0.18 }));
  yield {
    state: plotState({
      axes: { x: { label: 'epoch', min: 0, max: totalEpochs }, y: { label: 'learning rate multiplier', min: 0, max: 9 } },
      series: [
        { id: 'constant', label: 'jump to large LR', points: constant },
        { id: 'warmup', label: 'linear warmup then decay', points: warmup },
      ],
      markers: [
        { id: 'danger', x: 1, y: maxLR, label: 'early shock' },
        { id: 'stable', x: warmupEpochs, y: maxLR, label: 'warmed up' },
      ],
    }),
    highlight: { active: ['constant', 'danger'], found: ['warmup', 'stable'] },
    explanation: `The dashed choice is the naive jump: use the large-batch learning rate ${maxLR}x immediately. Warmup ramps over ${warmupEpochs} epochs so early unstable gradients do not take oversized steps before the representation has settled.`,
  };

  const baseBatch = 256;
  const baseLR = 0.1;
  const scale4 = 4;
  const scale16 = 16;
  yield {
    state: labelMatrix(
      'Linear scaling rule',
      [
        { id: 'base', label: 'base run' },
        { id: 'x4', label: `${scale4}x batch` },
        { id: 'x16', label: `${scale16}x batch` },
        { id: 'warm', label: 'warmup' },
      ],
      [
        { id: 'batch', label: 'batch' },
        { id: 'lr', label: 'learning rate' },
        { id: 'reason', label: 'reason' },
      ],
      [
        [`${baseBatch}`, `${baseLR}`, 'known stable baseline'],
        [`${baseBatch * scale4}`, `${baseLR * scale4}`, 'same per-epoch update scale'],
        [`${baseBatch * scale16}`, `${baseLR * scale16}`, 'needs care early'],
        ['first epochs', 'ramp upward', 'avoid optimization shock'],
      ],
    ),
    highlight: { active: ['x4:lr', 'x16:lr', 'warm:lr'], found: ['base:reason'] },
    explanation: `The table ties the learning-rate multiplier to global batch size. At ${scale4}x the batch (${baseBatch * scale4}), the LR scales to ${baseLR * scale4}; at ${scale16}x (${baseBatch * scale16}), it reaches ${baseLR * scale16}. Warmup is needed because the first epochs are the most fragile.`,
    invariant: 'Large-batch training changes both the batch and the optimizer schedule.',
  };

  const approaches = ['accumulation', 'more GPUs', 'sync SGD', 'async SGD'];
  yield {
    state: labelMatrix(
      'Gradient accumulation is not the same as more throughput',
      [
        { id: 'accum', label: approaches[0] },
        { id: 'parallel', label: approaches[1] },
        { id: 'sync', label: approaches[2] },
        { id: 'async', label: approaches[3] },
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
    explanation: `${approaches[0]} changes the effective batch seen by the optimizer, not the amount of parallel hardware. It can fix memory limits, but unlike ${approaches[1]}, it usually trades fewer updates for more time per update rather than producing distributed speedup.`,
  };

  const signals = ['training loss', 'validation loss', 'speedup', 'cost per target'];
  yield {
    state: labelMatrix(
      'Validation keeps scaling honest',
      [
        { id: 'train', label: signals[0] },
        { id: 'val', label: signals[1] },
        { id: 'speed', label: signals[2] },
        { id: 'cost', label: signals[3] },
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
    explanation: `The final scoreboard checks ${signals.length} signals and rejects throughput alone. A scaled run wins only if ${signals[1]} reaches the same target sooner or ${signals[3]} drops; faster examples per second can still lose if accuracy drops or accelerator cost rises.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization shows two linked views. The noise-scale view plots gradient variance against batch size, showing how each doubling reduces noise but also halves the number of optimizer updates per epoch. The warmup view traces two learning-rate curves over the first training steps: one that jumps immediately to the scaled rate (dangerous) and one that ramps linearly (safe). Watch how the validation scoreboard at the end compares the scaled run to a small-batch baseline on the same quality target.',
        'Each frame advances one logical step. The highlighted element is the quantity changing in that step. Pause on any frame to read the annotation. The goal is to see that batch-size scaling is not a single knob but a coupled system: batch, learning rate, warmup duration, and quality target must move together.',
        {type: 'image', src: './assets/gifs/batch-size-scaling.gif', alt: 'Animated walkthrough of the batch size scaling visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Training a neural network is governed by two clocks. The statistical clock counts optimizer updates: each update adjusts weights using a gradient estimated from a minibatch of examples. The physical clock counts wall-clock seconds: how fast hardware can process examples, synchronize gradients across devices, and apply the update. A small minibatch produces many noisy updates per epoch and usually trains well, but it can leave a 256-GPU cluster sitting idle. A very large minibatch keeps all devices busy, but it reduces the number of updates per epoch and changes the optimization trajectory.',
        'Batch-size scaling is the discipline of increasing the minibatch while preserving final model quality. It matters because "use more GPUs" is not an algorithm. If you scale from batch 256 on 1 GPU to batch 8192 on 32 GPUs without adjusting the learning rate, warmup schedule, and regularization, the run finishes faster in wall-clock but may produce a worse model. The Goyal et al. ImageNet-in-1-hour result (2017) showed that a careful recipe -- linear learning-rate scaling, gradual warmup, synchronized SGD -- could train ResNet-50 on 256 GPUs in one hour to the same 76.3% top-1 accuracy as the single-GPU baseline.',
        {type: 'callout', text: 'Batch size is useful only while statistical progress, optimizer stability, and hardware throughput improve the same target metric.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious first attempt is to keep the existing training recipe unchanged and just increase the global batch. If one GPU used batch 256 and you now have 32 GPUs, set global batch to 8192. The epoch sees 32x fewer optimizer steps, so training finishes in fewer iterations. This arithmetic is pure throughput: it treats the epoch as a fixed work unit and ignores that stochastic gradient descent (SGD) learns from a sequence of updates, not from the epoch as an indivisible chunk. Fewer updates mean fewer chances to correct direction, escape saddle points, and benefit from the implicit regularization of gradient noise.',
        'The second obvious move is to multiply the learning rate by the same factor as the batch. The intuition is sound in steady state: a batch that is k times larger produces a gradient with k times less variance, so you can afford a step k times bigger. But early in training the loss surface is steep, batch normalization statistics are unsettled, and weight magnitudes are far from their trained values. Jumping to a large learning rate on iteration 1 can throw the model into a bad basin or diverge entirely. This is the failure that motivated warmup schedules.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the critical batch size, B_crit. Below B_crit, doubling the batch roughly halves the number of steps to reach a quality target -- you get near-linear speedup in wall-clock time. Above B_crit, doubling the batch barely reduces steps because the gradient estimate is already accurate enough that extra samples add almost no new information. You are paying twice the compute per update for nearly the same learning progress.',
        'McCandlish et al. (2018) formalized this. They defined the gradient noise scale B_noise = tr(Sigma) / |G|^2, where Sigma is the covariance of per-sample gradients and G is the full-batch gradient. When your batch B << B_noise, each sample contributes new directional information. When B >> B_noise, you are averaging out noise that was already negligible. B_noise is not fixed: it starts high (random weights, diverse gradients) and drops as training converges and gradients align. So the useful batch size shrinks as training progresses, which is why some practitioners decay the batch or switch to smaller batches late in training.',
        'Hitting the wall does not mean training fails. It means additional parallelism stops buying proportional speedup. The run still converges, but you are burning GPU-hours for marginal time savings. Recognizing the wall requires measuring time-to-quality, not just throughput.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Gradient_descent.svg', alt: 'Gradient descent on a surface showing the optimization path toward a minimum', caption: 'Gradient descent follows the steepest downhill direction. Batch size controls how many samples contribute to each gradient estimate, trading noise for compute. (Source: Wikimedia Commons)'},
        'A minibatch gradient g_B is a Monte Carlo estimate of the true gradient G = (1/N) sum_i grad L(x_i). The variance of this estimate scales as Var(g_B) ~ sigma^2 / B, where sigma^2 is the per-sample gradient variance. Doubling B halves the variance -- the estimate becomes more accurate. But accuracy is only useful if the current estimate is noisy enough to hurt. Once Var(g_B) is small relative to |G|^2, further noise reduction does not change the update direction meaningfully.',
        'The scaling insight is therefore conditional: increase batch size only while time to the same validation target improves. The correct objective is not maximum examples per second. It is minimum wall-clock time or minimum total cost to reach a specified quality. A large-batch run succeeds when hardware parallelism saves more time than the optimization changes lose. This is why every serious large-batch paper includes a matched small-batch baseline trained with equal tuning effort, not just a throughput chart.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In synchronous data-parallel training, each of K workers receives a local minibatch of size B_local, runs the forward and backward pass, and computes local gradients. The workers then execute an all-reduce: each device sends its gradients and receives the averaged result. The optimizer applies one update using this averaged gradient. The global batch is B_global = K * B_local (times gradient accumulation steps, if used). The all-reduce cost scales with the number of parameters, not the batch size, so larger batches amortize communication overhead.',
        'The linear scaling rule says: if you multiply B_global by k, multiply the base learning rate by k. The reasoning is that with k times fewer updates per epoch, each update must move k times farther to achieve similar per-epoch progress. Warmup ramps the learning rate from a small initial value to the scaled value over the first W steps (typically 5-10% of total training). This gives the network time to build reasonable internal representations before taking large steps. After warmup, the schedule continues with cosine decay or step decay, just as the small-batch baseline would.',
        'The noise-scale view in the animation shows both sides of the tradeoff. As batch size grows, gradient noise drops (good), but updates per epoch also drop (bad). The curve bends at B_crit, and past that knee, more batch gives diminishing returns. The warmup view shows the learning-rate trajectory. The unsafe curve jumps to lr * k on step 1 and destabilizes. The safe curve ramps linearly over W steps, letting early features form before scaling the step size.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Large-batch scaling works in the regime where gradient noise is the bottleneck. When B << B_crit, each sample in the batch contributes genuinely new directional information, so averaging more samples produces a better update at the cost of more FLOPs per step. Since those FLOPs run in parallel across devices, wall-clock time per step barely increases while learning per step improves. The net effect is faster convergence in real time.',
        'Warmup works because the loss surface near initialization is poorly conditioned. The Hessian has large eigenvalues in directions the network has not yet learned to stabilize. A large learning rate amplifies updates along these steep directions, causing oscillation or divergence. Ramping the rate gives the optimizer time to move into a flatter region where the scaled step size is safe. Empirically, warmup also reduces sensitivity to the exact random seed and initialization, making large-batch runs more reproducible.',
        'The combination works because it decouples the two problems. The linear scaling rule handles the steady-state relationship between batch and learning rate. Warmup handles the transient instability at the start. Together, they let you run at 32x batch with a proportionally larger learning rate and still match the small-batch model\'s final accuracy, as demonstrated by Goyal et al. on ResNet-50 with batches up to 8192.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Communication cost dominates at scale. An all-reduce on a model with P parameters moves O(P) bytes per step regardless of batch size. For a 100M-parameter model in fp16, that is roughly 200 MB per all-reduce. On a ring of 32 GPUs connected by 200 Gbps InfiniBand, the ring all-reduce takes about 2 * 200MB * 31/32 / 25 GB/s ~ 16 ms. If the forward-backward pass on a local batch takes 50 ms, communication is 24% of step time. Good implementations overlap the last layers\' gradient computation with the first layers\' all-reduce to hide this latency.',
        'Memory cost scales with local batch size. Each sample in the batch stores activations for the backward pass. For ResNet-50 with batch 32 per GPU in fp32, activation memory is roughly 4 GB. Doubling local batch to 64 pushes this to ~8 GB, which may exceed GPU memory. Mitigations include mixed precision (halves activation size), gradient checkpointing (recomputes activations instead of storing them, trading 30% more compute for 60-80% less activation memory), and gradient accumulation (simulates a larger batch without increasing peak memory).',
        'Economic cost is subtle. Training ImageNet on 256 GPUs for 1 hour costs roughly 256 GPU-hours. The single-GPU baseline takes ~90 hours, so 90 GPU-hours. The large-batch run uses 2.8x more total compute to finish 90x faster. Whether this is worthwhile depends on whether you value researcher time, cluster opportunity cost, or raw GPU-hours. Cost-to-quality is the honest metric.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Large-batch training is standard in vision (ResNet, ViT), language-model pretraining (GPT, LLaMA use global batches of millions of tokens), speech (Wav2Vec 2.0), and contrastive learning (CLIP uses batch sizes of 32K+ to sample enough negative pairs). In each case, data parallelism is the simplest way to exploit hundreds or thousands of accelerators. The recipes combine large batches with AdamW or SGD with momentum, linear warmup, cosine or linear decay, gradient clipping, mixed precision, and optimized NCCL collectives.',
        'Gradient accumulation is a related technique that deserves distinction. It sums gradients over multiple microbatches before applying one optimizer step, simulating a larger batch without requiring more devices. This solves memory limits but does not add wall-clock parallelism -- each microbatch runs sequentially. In practice, teams combine both: gradient accumulation across microbatches within each device and data parallelism across devices. Confusing the two leads to incorrect throughput claims.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Past B_crit, more batch buys almost nothing statistically. The run converges in about the same number of updates whether you use B_crit or 10 * B_crit, so the extra compute is wasted. The critical batch is task-dependent: McCandlish et al. reported B_noise values ranging from ~10^3 for simple tasks to ~10^6 for large language models. You need to measure it for your specific setup.',
        'Communication overhead can erase speedups. If all-reduce takes 40% of step time, adding more GPUs increases communication cost faster than it reduces per-device compute. Topology matters: a 64-GPU cluster with 100 Gbps cross-node bandwidth behaves very differently from 64 GPUs on NVLink within a single node. When communication dominates, pipeline or tensor parallelism may be better than data parallelism with larger batches.',
        'Generalization gaps are the subtlest failure. Keskar et al. (2017) showed that large-batch SGD can converge to sharp minima that generalize worse, even when training loss matches the small-batch baseline. Mitigations include longer training, stronger augmentation, LARS/LAMB optimizers (which scale learning rates per layer), and label smoothing. But the core risk remains: optimizing throughput metrics without checking validation quality is the most common mistake in large-batch training.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose you train ResNet-50 on ImageNet (1.28M training images) with a single GPU at batch 256 and base learning rate 0.1. One epoch is 1.28M / 256 = 5,000 steps. Training for 90 epochs means 450,000 total updates. On one V100, each step takes ~0.3s, so total training time is 450,000 * 0.3s = 37.5 hours.',
        'Now scale to 32 GPUs with global batch 8192 (= 32 * 256). Apply the linear scaling rule: lr = 0.1 * (8192/256) = 3.2. Use warmup over the first 5 epochs (5,000 / 32 = 156 steps at the new batch size, but we do 5 * 1.28M/8192 = 781 warmup steps). One epoch is now 1.28M / 8192 = 156 steps, and 90 epochs = 14,062 total updates. Each step takes ~0.35s (the extra 0.05s is all-reduce overhead). Total time: 14,062 * 0.35s = 1.37 hours, about 27x faster than the baseline.',
        'Check the economics: 32 GPUs * 1.37 hours = 43.8 GPU-hours, vs 37.5 GPU-hours for the baseline. You spent 17% more total compute to finish 27x faster. The model reaches 76.3% top-1 accuracy in both cases. Whether the 17% compute premium is worth the 27x time speedup depends on your constraints -- but this is a successful scaling result because quality was preserved.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational reference is Goyal et al., "Accurate, Large Minibatch SGD: Training ImageNet in 1 Hour" (2017), which established the linear scaling rule and warmup recipe. McCandlish et al., "An Empirical Model of Large-Batch Training" (2018), formalized the critical batch size and gradient noise scale. Keskar et al., "On Large-Batch Training for Deep Learning: Generalization Gap and Sharp Minima" (2017), identified the generalization risk. You et al., "Large Batch Training of Convolutional Networks" (2017), introduced LARS for per-layer learning-rate scaling.',
        'Study gradient descent and backpropagation first, since batch size directly modifies the update sequence those algorithms produce. Then study learning-rate schedules and warmup to understand the coupling between batch size and step size. Loss landscapes and optimization geometry explain why sharp vs. flat minima matter for generalization. On the systems side, study all-reduce collectives, mixed precision training, gradient accumulation, and distributed optimizer sharding (ZeRO) to understand the hardware constraints that make batch-size scaling necessary in the first place.',
      ],
    },
  ],
};
