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
    explanation: 'The graph splits a minibatch gradient into useful direction and sampling scatter. Gradient noise scale asks whether the scatter is large compared with the squared signal, because that ratio predicts how much extra batch can still help.',
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
    explanation: 'The two curves show why "bigger batch" has a knee. Below it, parallelism improves wall-clock time without wasting many examples. Beyond it, each update costs more data while adding little new statistical information.',
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
    explanation: 'The sweet spot is not the quietest possible gradient. It is the smallest batch that keeps hardware useful while leaving enough update diversity and enough updates per epoch to reach the target cheaply.',
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
    explanation: 'The rising curve means the useful batch size can change during training. Early on, signal is strong enough that small batches are efficient; later, larger batches can average noise without wasting as much learning opportunity.',
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
    explanation: 'This table turns batch choice into measurement. Sample gradients at different sizes, estimate mean signal and variance, and treat the critical batch as a property of this model, data, optimizer, and training stage.',
  };

  yield {
    state: signalGraph('Two valid goals imply different batch choices'),
    highlight: { active: ['gns', 'batch', 'e-gns-batch'], compare: ['mean', 'var'] },
    explanation: 'The same noise-scale estimate supports two honest goals. Compute-efficient training spends examples carefully with smaller batches; time-efficient training spends more examples per update to finish sooner. Benchmark claims need to say which goal they optimized.',
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
    explanation: 'The source map prevents slogan learning. Large batches can work with warmup, small-batch noise can help generalization, batch growth can cool training like LR decay, and noise scale gives a way to measure the regime.',
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
    explanation: 'Both curves cool the stochasticity of training. Decaying the learning rate makes each update smaller; growing the batch makes each gradient less noisy. That is why batch schedules belong with optimizer design, not just cluster planning.',
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
      heading: 'Why this exists',
      paragraphs: [
        `Batch size is one of the first knobs people touch when a training run gets expensive. A larger batch can keep more accelerators busy, reduce the number of all-reduce rounds per example, and make a job finish sooner in wall-clock time. It can also waste tokens, images, or environment steps if each optimizer update no longer learns much more than a smaller update would have learned. Gradient noise scale exists to separate those two stories.`,
        `A minibatch gradient is an estimate of the full-batch gradient. Part of it is signal: the direction the whole dataset would push the parameters. Part of it is sampling noise: the wobble caused by looking at only some examples. The gradient noise scale compares the variance of that estimate with the squared size of the signal. McCandlish et al. used it to predict the largest useful batch size across supervised learning, reinforcement learning, and generative-model training: https://arxiv.org/abs/1812.06162.`,
        {type: `callout`, text: `The critical batch is the point where extra examples mostly clean up an update direction the optimizer already knew.`},
      ],
    },
    {
      heading: 'The naive batch-size rule',
      paragraphs: [
        `The obvious rule is to make the batch as large as the hardware allows, then raise the learning rate and add warmup until the run does not diverge. That rule is not foolish. If each device is underused, larger batches can improve throughput. If communication dominates, doing more local work per synchronization can help. If a team has a fixed deadline, time efficiency may matter more than example efficiency.`,
        `The rule breaks because stability is not the same as usefulness. A huge batch can produce a very clean gradient and still be a bad bargain. The optimizer may take fewer, more expensive updates. Validation quality may arrive after processing more examples than a smaller-batch run needed. The cluster dashboard can look better while the training economics get worse.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The useful question is not "how large can the batch be?" The useful question is "how much noise is still large enough to justify averaging more examples before taking an update?" When sampling noise is large compared with the true gradient signal, increasing the batch can improve the update. When noise is already small compared with the signal, more averaging mostly buys a prettier estimate of the same direction.`,
        `That creates a knee. Below the knee, batch growth often improves wall-clock speed without burning too much data efficiency. Near the knee, the batch is large enough to expose parallelism but small enough to preserve many useful optimizer steps. Far beyond the knee, the run may still scale in examples per second, but each step consumes more data for little additional learning.`,
        {type: `image`, src: `https://ar5iv.labs.arxiv.org/html/1812.06162/assets/figures/Misc/basic-scaling.png`, alt: `Large batch scaling plot from McCandlish et al. showing a useful batch-size knee`, caption: `McCandlish et al. visualize the batch-size knee where time scaling and example efficiency start to diverge. Source: ar5iv rendering of arXiv:1812.06162, https://ar5iv.labs.arxiv.org/html/1812.06162`},
      ],
    },
    {
      heading: 'How the mechanism works',
      paragraphs: [
        `In practice, a trainer estimates gradient statistics from measurements at different batch sizes. A small batch gives a noisy estimate. A larger batch reduces noise. By comparing gradient norms and variance, the training system can estimate how much of the update is stable signal and how much is sampling scatter. The critical batch is roughly the scale where extra examples stop reducing the error that matters.`,
        {type: `image`, src: `https://ar5iv.labs.arxiv.org/html/1812.06162/assets/figures/Misc/optimal-step-illustration.png`, alt: `Optimal step illustration for noisy gradient estimates and batch size`, caption: `The optimal-step illustration separates direction quality from raw hardware use: extra examples matter only while they materially improve the update. Source: ar5iv rendering of arXiv:1812.06162, https://ar5iv.labs.arxiv.org/html/1812.06162`},
        `The estimate is not a universal constant. It depends on the model, dataset, optimizer, loss value, and training stage. McCandlish et al. reported that noise scale tends to increase as loss falls, which means the useful batch can grow during a run. That is why batch-size schedules can make sense. Early training may be efficient with smaller batches. Later training may benefit from larger batches because the signal is weaker and averaging noise is more valuable.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The noise-meter view proves that batch size controls an estimator, not just a hardware load. The mean node is the useful push. The variance node is the sampling scatter. The GNS node exists because the ratio between those quantities is what decides whether another example in the batch is informative or mostly redundant.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/f/f3/Stogra.png`, alt: `Stochastic gradient descent path with noisy updates`, caption: `Stochastic-gradient paths make the core tradeoff visible: smaller batches inject noise, while larger batches average it away. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Stogra.png`},
        `The scaling-decision view proves that two honest scoreboards can disagree. Time speedup can keep rising because devices stay busy. Data efficiency can fall because each update costs more examples. The critical batch marker is the bend where those curves stop telling the same story. The source map adds the historical lesson: large batches can work with warmup, small-batch noise can help generalization, and batch growth can cool training in a way that resembles learning-rate decay.`,
      ],
    },
    {
      heading: 'Why the method works',
      paragraphs: [
        `The correctness argument is statistical rather than combinatorial. A minibatch gradient is an unbiased or approximately unbiased estimate of the gradient for the training objective under the sampling scheme. Averaging more independent examples reduces variance, but it does not change the expected direction. Once variance is small enough relative to the signal and learning-rate schedule, the next examples mostly refine an update the optimizer already knew how to take.`,
        `This explains both the power and the limit. Gradient noise scale is useful because it measures the regime the run is in. It is not magic because the estimate can be noisy, the data may be correlated, the optimizer may use momentum or adaptive moments, and the validation target may care about generalization rather than only training loss. It should guide experiments, not replace them. Treat the number as a map of likely waste, then confirm the choice with real learning curves.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `The main tradeoff is compute efficiency versus time efficiency. Compute-efficient training spends examples carefully and accepts more optimizer updates. Time-efficient training spends more examples per update to finish sooner on a larger machine. A lab training a one-off frontier model, a startup paying cloud bills, and a researcher running ablations may choose different points even when the noise estimate is the same.`,
        `Gradient accumulation needs separate accounting. Accumulation creates a larger effective batch when memory is tight, but it does not create the same wall-clock benefit as adding more parallel workers. It changes the gradient statistics without necessarily increasing device-level concurrency. Honest reports should include validation quality, optimizer updates, examples or tokens processed, hardware count, wall-clock time, and total cost to target quality.`,
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        `Gradient noise scale is useful when the training job is expensive enough that a small pilot measurement can prevent a much larger waste. It is especially helpful for distributed training plans, batch-size warmup, comparing compute-efficient and time-efficient settings, and explaining why a scaling run improved throughput but not cost to quality.`,
        `It fails when treated as a slogan. The critical batch is not a field-wide number, and it is not guaranteed to transfer across architectures, data mixtures, optimizer settings, or training phases. Sharp-minima warnings are also diagnostics, not a proof that every large batch generalizes poorly. The safest stance is disciplined: measure the knee, preserve validation quality, and price the full path to the target metric.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: An Empirical Model of Large-Batch Training at https://arxiv.org/abs/1812.06162, ImageNet in 1 Hour at https://arxiv.org/abs/1706.02677, On Large-Batch Training and Sharp Minima at https://arxiv.org/abs/1609.04836, and Do not Decay the Learning Rate, Increase the Batch Size at https://arxiv.org/abs/1711.00489. In this curriculum, study Batch Size Scaling first, then Gradient Descent, Learning-Rate Schedules and Warmup, Natural Gradient and Fisher Information, Benchmark Variance and Model Selection, and GPU All-Reduce. The through-line is simple: optimization knobs are only useful when they are tied to the behavior they change.`,
      ],
    },
  ],
};
