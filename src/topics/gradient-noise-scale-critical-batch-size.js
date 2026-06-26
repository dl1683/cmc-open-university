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
  const numNodes = 6;
  const numEdges = 6;
  const kneeSize = 2048;
  const batchRegimes = ['small batch', 'near knee', 'huge batch', 'accum'];

  yield {
    state: signalGraph('A minibatch gradient has signal and noise'),
    highlight: { active: ['data', 'sample', 'mean', 'var', 'e-data-sample', 'e-sample-mean', 'e-sample-var'], found: ['gns', 'batch'] },
    explanation: `The graph splits a minibatch gradient into ${numNodes} nodes showing signal and noise. Gradient noise scale asks whether the scatter is large compared with the squared signal, because that ratio predicts how much extra batch can still help.`,
    invariant: `Batch size controls the estimator across ${numEdges} data-flow edges, not just the hardware load.`,
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
    explanation: `The two curves show why "bigger batch" has a knee near batch size ${kneeSize}. Below it, parallelism improves wall-clock time without wasting many examples. Beyond it, each update costs more data while adding little new statistical information.`,
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
    explanation: `The sweet spot across ${batchRegimes.length} regimes — ${batchRegimes.join(', ')} — is not the quietest possible gradient. It is the smallest batch near ${kneeSize} that keeps hardware useful while leaving enough update diversity.`,
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
    explanation: `The rising curve means the useful batch size can change during training. Early on, signal is strong enough that small batches well below ${kneeSize} are efficient; later, larger batches can average noise without wasting as much learning opportunity.`,
  };
}

function* scalingDecision() {
  const measurements = ['small run', 'large run', 'mean', 'variance'];
  const sources = ['Goyal', 'Keskar', 'Smith', 'GNS'];
  const coolingMethods = 2; // LR decay and batch growth

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
    explanation: `This table turns batch choice into ${measurements.length} measurements: ${measurements.join(', ')}. Sample gradients at different sizes, estimate mean signal and variance, and treat the critical batch as a property of this model, data, optimizer, and training stage.`,
  };

  yield {
    state: signalGraph('Two valid goals imply different batch choices'),
    highlight: { active: ['gns', 'batch', 'e-gns-batch'], compare: ['mean', 'var'] },
    explanation: `The same noise-scale estimate supports ${coolingMethods} honest goals. Compute-efficient training spends examples carefully with smaller batches; time-efficient training spends more examples per update to finish sooner. Benchmark claims need to say which goal they optimized.`,
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
    explanation: `The source map covers ${sources.length} foundational papers — ${sources.join(', ')} — to prevent slogan learning. Large batches can work with warmup, small-batch noise can help generalization, batch growth can cool training like LR decay, and noise scale gives a way to measure the regime.`,
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
    explanation: `Both ${coolingMethods} curves cool the stochasticity of training. Decaying the learning rate makes each update smaller; growing the batch makes each gradient less noisy. That is why batch schedules belong with optimizer design, not just cluster planning.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views, selectable in the controls. The noise-meter view traces how a minibatch gradient decomposes into signal (the mean gradient direction) and noise (the sampling variance around it), then combines them into the gradient noise scale ratio that predicts the critical batch size. Each node lights up as it enters the computation. The scaling-decision view shows the same idea from the optimizer\'s perspective: two curves (time speedup vs. data efficiency) diverge at the batch-size knee, and a source map connects four foundational papers to the controls they introduced.',
        'Use the play button to step through at reading pace, or drag the slider to jump. The plot frames overlay labeled markers at key batch sizes so you can see where the knee falls. The matrix frames use row-column highlighting to compare regimes side by side.',
        {type: 'image', src: './assets/gifs/gradient-noise-scale-critical-batch-size.gif', alt: 'Animated walkthrough of the gradient noise scale critical batch size visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Every neural network trains by computing gradients -- partial derivatives of a loss function with respect to each parameter -- and using those gradients to update the parameters toward lower loss. Computing the gradient over the entire dataset is called full-batch gradient descent. It gives the exact direction of steepest descent, but it is usually too expensive: a language model with billions of parameters and trillions of tokens would need to process every token before making a single update. So practitioners use minibatch gradient descent instead. They sample a small subset of examples (the batch), compute the gradient on that subset alone, and update immediately.',
        'The minibatch gradient is a statistical estimate. Like any estimate drawn from a sample, it has two components: the expected value (which equals the true full-batch gradient, assuming uniform random sampling) and the sampling variance (the scatter around that expected value caused by which examples happened to land in this batch). The expected value is the signal -- the direction the optimizer actually wants to move. The variance is the noise -- the random wobble that makes any single minibatch update imperfect.',
        'Gradient noise scale (GNS) is a single number that captures how noisy the current gradient estimate is relative to the signal. Formally, it is the ratio of the trace of the gradient covariance matrix to the squared L2 norm of the true gradient: B_noise = tr(Sigma) / |G|^2. McCandlish et al. introduced this quantity in "An Empirical Model of Large-Batch Training" (arXiv:1812.06162) and showed it predicts a critical batch size -- the batch size beyond which adding more examples per update yields diminishing returns. This article explains what that ratio means, why it creates a knee, and how practitioners use it to avoid wasting compute.',
        {type: 'callout', text: 'The critical batch is the point where extra examples mostly clean up an update direction the optimizer already knew.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest batch-size strategy is to make the batch as large as GPU memory allows. If you have 8 GPUs with 80 GB each, you calculate the maximum number of examples that fit after accounting for model weights, optimizer state, and activations. You set that as your batch size, scale the learning rate linearly (Goyal et al., "ImageNet in 1 Hour," arXiv:1706.02677), add a few hundred steps of learning-rate warmup so the early updates don\'t diverge, and start training. This strategy is not unreasonable. It keeps all devices busy, amortizes the communication cost of gradient synchronization, and finishes the run in fewer optimizer steps -- which means fewer all-reduce rounds, fewer checkpoint saves, and less wall-clock time.',
        'If memory still has room, you might try gradient accumulation: compute gradients on smaller micro-batches, sum them across several forward-backward passes, and apply a single update with the accumulated gradient. This achieves the same gradient statistics as a larger batch without exceeding memory. Accumulation is especially common on single-GPU setups or when training with very long sequences that consume most of the memory.',
        'Teams with access to large clusters sometimes push further: 64 or 256 GPUs running data-parallel training with batches of 32k, 64k, or even millions of examples per update. The reasoning is that more parallelism means faster wall-clock time, and if the learning-rate scaling rule holds, final accuracy should be preserved. The 2017 Facebook result training ImageNet in one hour with a batch of 8,192 seemed to confirm this: linear scaling worked, and the model matched the small-batch baseline.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The strategy of "fill the hardware, scale the learning rate" hits a wall because stability is not the same as efficiency. A training run can be numerically stable -- gradients finite, loss decreasing, no NaN explosions -- while still being wasteful. The waste is subtle: each optimizer update processes more examples, so the run completes in fewer steps, but it also consumes more data per step. If the total number of examples processed to reach a target validation loss increases, the run used more compute even though it took fewer steps.',
        'Concretely, consider a ResNet-50 trained to 76% top-1 ImageNet accuracy. At batch size 256, this requires roughly 90 epochs, or about 115,000 updates processing ~29 million examples total. At batch size 8,192, Goyal et al. showed it can reach the same accuracy in roughly 90 epochs as well -- about 3,600 updates -- but now each epoch still processes the full 1.28M-image dataset, so the total example count is similar. However, at batch size 65,536, many experiments show you need more than 90 epochs to reach the same accuracy. You finish each epoch faster, but you need more of them, so total examples processed grows. The wall is visible: beyond some batch size, you are paying more compute for the same result.',
        'Keskar et al. ("On Large-Batch Training for Deep Learning," arXiv:1609.04836) documented a second failure mode: large-batch training tends to converge to sharp minima in the loss landscape -- regions where the loss is low but changes steeply in nearby directions. Models in sharp minima generalize poorly because the training loss and test loss disagree. Small-batch training, with its noisy gradient updates, naturally bounces away from sharp minima and settles in flatter regions. This means that even when a large-batch run reaches the same training loss, it may reach worse test accuracy.',
        'The wall, then, has two faces. The compute face: beyond some batch size, total examples to target quality grows, so the run is more expensive even if it is faster. The generalization face: the optimizer may find qualitatively worse solutions. Both faces point to the same underlying phenomenon -- the gradient estimate becomes "too clean" relative to what the optimizer can productively use -- but they manifest differently in loss curves, validation gaps, and compute budgets.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that there is a measurable quantity -- the gradient noise scale -- that tells you when you have crossed from "more examples improve the update" into "more examples mostly refine a direction you already knew." The transition is not a cliff; it is a smooth knee. But the knee is real and predictable, and it separates two regimes with very different economics.',
        'Think of it this way. Suppose the true gradient has magnitude |G| = 1.0 in some normalized sense, and the per-example gradient variance is tr(Sigma) = 1000. With a batch of 10 examples, the variance of your gradient estimate is tr(Sigma)/B = 100 -- the noise standard deviation is 10, dwarfing the signal of 1.0. Your update direction is almost random. Doubling the batch to 20 cuts variance to 50 and noise to ~7.1. Still very noisy, but a meaningful improvement: you have materially better information about which way to step. Now suppose you are at batch 10,000. Variance is tr(Sigma)/B = 0.1, noise is ~0.32. The signal of 1.0 dominates. Doubling to 20,000 cuts variance to 0.05 and noise to ~0.22. The update direction barely changes -- it was already accurate to within about 18 degrees, and now it is accurate to about 13 degrees. You spent twice the compute for a negligible improvement in direction quality.',
        'The gradient noise scale B_noise = tr(Sigma) / |G|^2 is exactly the batch size at which signal and noise are balanced. When B << B_noise, the gradient estimate is noise-dominated, and each additional example in the batch materially improves the update. When B >> B_noise, the estimate is signal-dominated, and additional examples are mostly wasted. The critical batch size is approximately B_crit = B_noise.',
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/1812.06162/assets/figures/Misc/basic-scaling.png', alt: 'Large batch scaling plot from McCandlish et al. showing a useful batch-size knee', caption: 'McCandlish et al. visualize the batch-size knee where time scaling and example efficiency start to diverge. Source: ar5iv rendering of arXiv:1812.06162, https://ar5iv.labs.arxiv.org/html/1812.06162'},
        'McCandlish et al. showed this knee is not a property of a single architecture or dataset. They measured it across image classifiers (ResNets on CIFAR-10, ImageNet), language models (LSTMs on Penn Treebank), and reinforcement learning agents (Atari games). The critical batch size varied enormously -- from hundreds to millions -- but the shape of the tradeoff curve was always the same: a knee separating the region where batch growth is cheap from the region where it is wasteful.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Measuring the gradient noise scale requires estimating two quantities from sampled gradients: the squared norm of the true gradient |G|^2 and the trace of the covariance tr(Sigma). In practice, you cannot compute the true gradient (that would require a full-batch pass), so you estimate both from minibatch statistics. One approach: compute gradients on two different batch sizes, say B_small and B_large, during the same region of training. The gradient from the larger batch is a less noisy estimate of the true gradient, and the difference in variance between the two estimates lets you back out tr(Sigma) and |G|^2 separately.',
        'McCandlish et al. give the key formulas. If g_B is the mean gradient from a batch of size B, then E[|g_B|^2] = |G|^2 + tr(Sigma)/B. This is because the expected squared norm of a noisy estimate equals the squared norm of the true value plus the variance of the noise. With two batch sizes B1 and B2, you get two equations and two unknowns, which you can solve: |G|^2 = (B2 * E[|g_B2|^2] - B1 * E[|g_B1|^2]) / (B2 - B1), and tr(Sigma) = B1 * B2 * (E[|g_B1|^2] - E[|g_B2|^2]) / (B2 - B1). The noise scale is then B_noise = tr(Sigma) / |G|^2.',
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/1812.06162/assets/figures/Misc/optimal-step-illustration.png', alt: 'Optimal step illustration for noisy gradient estimates and batch size', caption: 'The optimal-step illustration separates direction quality from raw hardware use: extra examples matter only while they materially improve the update. Source: ar5iv rendering of arXiv:1812.06162, https://ar5iv.labs.arxiv.org/html/1812.06162'},
        'The critical batch size B_crit is then used to reason about the tradeoff between two goals. If you train with B << B_crit, each update is noisy but cheap in examples, so you maximize data efficiency (learning per example processed). If you train with B >> B_crit, each update is clean but expensive, so you maximize time efficiency (learning per optimizer step, which maps to wall-clock speed on parallel hardware). At B = B_crit, you are at the knee: a balanced point where neither dimension is grossly wasted.',
        'A critical practical detail: B_noise is not constant during training. It depends on the current loss, the local curvature, and the data distribution at the current parameter values. McCandlish et al. found that B_noise typically increases as training progresses and loss decreases. Intuitively, as the model gets closer to a minimum, the true gradient |G| shrinks (the model is nearly converged), while per-example variance tr(Sigma) remains substantial (different examples still disagree about fine-grained parameter adjustments). This means the useful batch size grows over training. A batch of 256 might be optimal early on, while a batch of 4,096 becomes optimal later. This is the theoretical basis for batch-size schedules: start small, grow the batch as training progresses.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on the bias-variance decomposition of the minibatch gradient estimator. Under uniform random sampling without replacement (or with replacement for large datasets), the minibatch gradient g_B = (1/B) * sum_{i in batch} grad_i is an unbiased estimator of the full gradient G = E[grad_i]. Its variance is Var(g_B) = Sigma / B, where Sigma is the covariance of per-example gradients. This is the standard result for the variance of a sample mean: averaging B independent samples reduces variance by a factor of B.',
        'The optimizer update is approximately delta_theta = -eta * g_B, where eta is the learning rate. The quality of this update depends on how close g_B is to G in direction. When |g_B - G| is large compared to |G|, the update direction is unreliable -- the optimizer is mostly stepping in random directions, and useful progress happens only in expectation over many steps. When |g_B - G| is small compared to |G|, the update is nearly identical to the full-batch update, and additional noise reduction is pointless.',
        'The transition between these regimes happens at B ~ B_noise = tr(Sigma) / |G|^2. At this batch size, the noise magnitude sqrt(tr(Sigma)/B) equals the signal magnitude |G|. Below it, noise dominates and each additional example genuinely improves the update. Above it, signal dominates and you are paying compute to polish an already-good direction. This is not an approximation or heuristic -- it is a direct consequence of the central limit theorem applied to gradient averaging.',
        'The reason the framework works across tasks (vision, language, RL) is that the argument depends only on the sampling statistics of the gradient, not on the architecture or loss function. Any setting where gradients are estimated from random subsets of data will exhibit this signal-noise tradeoff. The specific value of B_noise varies (it depends on model size, data heterogeneity, and training stage), but the shape of the tradeoff curve is universal.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost of measuring B_noise is small relative to the cost of a full training run. You need gradient norms from two batch sizes over a window of training steps -- typically a few hundred steps at each size. For a run that will take tens of thousands of steps, this pilot measurement costs less than 1% of the total compute. The measurement can be done at the beginning of training and periodically re-measured as training progresses.',
        'The real cost question is the tradeoff between compute efficiency and time efficiency. McCandlish et al. formalize this with two quantities: S_min (the minimum number of optimizer steps to reach a target loss, achieved with infinite batch size) and E_min (the minimum number of examples to reach that loss, achieved with batch size 1). Any practical training run uses more steps than S_min and more examples than E_min. The ratio B/B_crit determines where you sit on the tradeoff curve. At B = B_crit, you use roughly 2x the minimum steps and 2x the minimum examples -- a balanced compromise. At B = 10 * B_crit, you use close to S_min steps but ~10x E_min examples.',
        'For a concrete cost comparison: suppose B_crit = 2,048 for a particular model and dataset. Training with B = 256 (well below the knee) requires ~8x more optimizer steps than B = 2,048 but processes only ~1.1x the minimum total examples. Training with B = 16,384 (well above the knee) requires ~1.1x the minimum steps but processes ~8x the minimum examples. If your bottleneck is wall-clock time and you have 64 GPUs, the large batch finishes sooner despite burning more data. If your bottleneck is cloud cost (priced per GPU-hour times number of GPUs), the small batch is cheaper because it processes fewer total examples.',
        'Gradient accumulation adds a subtlety. Accumulating 8 micro-batches of 256 gives the same gradient statistics as a single batch of 2,048, but it does not give the same wall-clock speed because the 8 micro-batches run sequentially on the same device. Accumulation is a memory trick, not a parallelism trick. When comparing batch strategies, you must separately track effective batch size (for gradient statistics) and parallel width (for wall-clock time).',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Large language model pre-training is the most visible application. GPT-3 used batch-size warmup: starting with a small batch and gradually increasing it over the first few billion tokens. This is exactly the strategy the noise-scale framework recommends, because B_noise is low early in training (strong signal, model far from convergence) and grows as the model improves. The specific schedule -- often starting at batch 256 or 512 and ramping to 2M+ tokens per batch -- is tuned per model but follows the predicted shape.',
        'Distributed training systems use B_crit to decide cluster sizing. If a team measures B_crit = 4,096 for their model, they know that scaling beyond ~4,096 examples per update (across all data-parallel workers) gives diminishing returns in convergence speed. This caps the useful degree of data parallelism and tells the team when to invest in pipeline or tensor parallelism instead. Google\'s PaLM training and Meta\'s LLaMA training both reflect this reasoning: they choose data-parallel degrees that stay near the critical batch for their model scale.',
        'Hyperparameter search benefits too. Instead of sweeping batch size as an independent hyperparameter (which multiplies the search space), practitioners can measure B_noise at a single training checkpoint and set the batch size to B_crit, then sweep only learning rate and schedule. This reduces the search space and avoids wasting expensive runs on batch sizes far above the knee.',
        'Reinforcement learning exhibits the same phenomenon but with much noisier gradients. McCandlish et al. found B_crit values in the hundreds of thousands for some Atari games, reflecting the enormous variance in reward-based gradient estimates. This explains why RL training often benefits from very large batch collection (millions of environment steps per update) in a way that supervised learning on clean labels does not.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The noise-scale framework assumes that the gradient estimator is approximately unbiased and that per-example gradients are approximately independent. These assumptions break in several common settings. When data is not shuffled properly (e.g., examples within a batch come from the same document or video), per-example gradients are correlated, and the effective batch size is smaller than the nominal batch size. The framework does not account for this without modification.',
        'Adaptive optimizers like Adam complicate the picture. Adam rescales each parameter\'s gradient by a running estimate of its second moment, which changes the effective signal-to-noise ratio in a parameter-dependent way. The scalar B_noise = tr(Sigma)/|G|^2 treats all parameters equally, but Adam does not. In practice, the noise scale is still a useful proxy, but the exact knee may differ from the scalar prediction. Some researchers compute per-layer or per-parameter-group noise scales for more accurate estimates.',
        'The framework also assumes a fixed loss target. In practice, the relationship between batch size and final quality is more complex. Keskar et al.\'s sharp-minima observation suggests that small-batch noise may improve generalization by steering the optimizer toward flat minima. If the goal is not just "reach training loss X" but "reach the best test accuracy," the optimal batch size may be below B_crit because the noise itself is serving a regularization function. This is an active research area with no clean resolution.',
        'Finally, the measurement of B_noise can be noisy itself, especially when the gradient covariance is high-rank and tr(Sigma) is estimated from a small number of batches. In very large models, computing per-example gradients is expensive (it requires storing or recomputing individual backward passes), so the measurement is often approximated. These approximations introduce uncertainty in the knee estimate, which means the framework is best used as a guide (batch size should be within 2-4x of B_crit) rather than a precise prescription.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose you are training a 300M-parameter transformer language model on a 100B-token dataset. You run a pilot measurement at step 1,000 using two batch sizes: B1 = 128 sequences and B2 = 2,048 sequences (each sequence is 2,048 tokens). You compute the mean squared gradient norm at each batch size over 50 steps: E[|g_128|^2] = 4.2 and E[|g_2048|^2] = 0.35.',
        'Solving the two equations: |G|^2 = (2048 * 0.35 - 128 * 4.2) / (2048 - 128) = (716.8 - 537.6) / 1920 = 0.0934. And tr(Sigma) = 128 * 2048 * (4.2 - 0.35) / (2048 - 128) = 262144 * 3.85 / 1920 = 525.7. So B_noise = 525.7 / 0.0934 = 5,630. The critical batch size is approximately 5,630 sequences, or about 11.5M tokens per update.',
        'With this measurement in hand, you make a decision. Your cluster has 32 GPUs, each fitting 16 sequences per micro-batch, for a maximum parallel batch of 512 sequences. That is well below B_crit = 5,630, so you are in the compute-efficient regime: every example is well-used, but you are leaving wall-clock speedup on the table. You could add gradient accumulation to reach an effective batch of 4,096 (8 accumulation steps), which puts you near the knee. This gives a good balance: the gradient quality is substantially better than at 512 (variance reduced by 8x), you are near B_crit so you are not wasting data, and the wall-clock time per update increases by 8x micro-batch time but the number of updates needed drops by roughly 4-6x.',
        'At step 20,000, you re-measure and find B_noise has grown to ~12,000 sequences. The model has improved, |G|^2 has shrunk, and the useful batch size has doubled. You increase accumulation to reach an effective batch of 8,192, staying near the new knee. This is a simple batch schedule driven by periodic B_noise measurement -- no hyperparameter sweep required, just two gradient-norm measurements every few thousand steps.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Stogra.png', alt: 'Stochastic gradient descent path with noisy updates', caption: 'Stochastic-gradient paths make the core tradeoff visible: smaller batches inject noise, while larger batches average it away. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Stogra.png'},
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The primary source for gradient noise scale and critical batch size is McCandlish et al., "An Empirical Model of Large-Batch Training" (arXiv:1812.06162, 2018). The linear scaling rule for learning rate comes from Goyal et al., "Accurate, Large Minibatch SGD: Training ImageNet in 1 Hour" (arXiv:1706.02677, 2017). The sharp-minima concern with large batches is from Keskar et al., "On Large-Batch Training for Deep Learning: Generalization Gap and Sharp Minima" (arXiv:1609.04836, 2016). The equivalence between batch growth and learning-rate decay is from Smith et al., "Don\'t Decay the Learning Rate, Increase the Batch Size" (arXiv:1711.00489, 2017).',
        'For prerequisite understanding, study gradient descent (what the optimizer is doing with the gradient), then learning-rate schedules and warmup (the other half of the noise-temperature story), then batch-size scaling (the empirical scaling laws that B_noise connects to). For deeper theory, study natural gradient and Fisher information (which generalize the scalar noise scale to a matrix), and stochastic optimization convergence proofs (which formalize when and why minibatch SGD converges).',
        'For adjacent topics, study GPU all-reduce (the communication primitive that makes data-parallel batch growth useful), mixed-precision training (which changes the memory constraint that determines maximum batch size per device), and gradient accumulation (which decouples effective batch size from device memory). The connecting principle across all of these: every optimization knob has a regime where it helps and a regime where it wastes resources, and the boundary between those regimes is measurable.',
      ],
    },
  ],
};
