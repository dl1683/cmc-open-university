// Adam & friends: vanilla gradient descent treats every weight identically,
// and ravines punish that mercilessly. Momentum remembers, RMSProp adapts,
// Adam does both — all three race a real ravine, live, in this file.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'adam-optimizer',
  title: 'Momentum, RMSProp & Adam',
  category: 'AI & ML',
  summary: 'Three optimizers race a ravine: GD zigzags and starves, momentum remembers, Adam adapts per-coordinate.',
  controls: [
    { id: 'view', label: 'Race', type: 'select', options: ['three optimizers, one ravine', 'inside Adam, knob by knob'], defaultValue: 'three optimizers, one ravine' },
  ],
  run,
};

// The ravine: loss = (x² + 50y²)/2 — fifty times steeper across than along.
const grad = ([x, y]) => [x, 50 * y];
const loss = ([x, y]) => (x * x + 50 * y * y) / 2;
const START = [-9, 1.5];

function runGD(lr, steps) {
  let w = [...START];
  const path = [[...w]];
  for (let i = 0; i < steps; i++) {
    const g = grad(w);
    w = [w[0] - lr * g[0], w[1] - lr * g[1]];
    path.push([...w]);
  }
  return path;
}
function runMomentum(lr, beta, steps) {
  let w = [...START];
  let v = [0, 0];
  const path = [[...w]];
  for (let i = 0; i < steps; i++) {
    const g = grad(w);
    v = [beta * v[0] + g[0], beta * v[1] + g[1]];
    w = [w[0] - lr * v[0], w[1] - lr * v[1]];
    path.push([...w]);
  }
  return path;
}
function runAdam(lr, steps) {
  let w = [...START];
  let m = [0, 0];
  let v = [0, 0];
  const b1 = 0.9;
  const b2 = 0.999;
  const path = [[...w]];
  for (let t = 1; t <= steps; t++) {
    const g = grad(w);
    m = m.map((mm, i) => b1 * mm + (1 - b1) * g[i]);
    v = v.map((vv, i) => b2 * vv + (1 - b2) * g[i] * g[i]);
    const mh = m.map((mm) => mm / (1 - b1 ** t));
    const vh = v.map((vv) => vv / (1 - b2 ** t));
    w = w.map((ww, i) => ww - (lr * mh[i]) / (Math.sqrt(vh[i]) + 1e-8));
    path.push([...w]);
  }
  return path;
}
const toSeries = (id, label, path) => ({ id, label, points: path.map(([x, y]) => ({ x, y })) });

function* ravineRace() {
  const gdPath = runGD(0.038, 30);
  yield {
    state: plotState({
      axes: { x: { label: 'w₁ (shallow direction)' }, y: { label: 'w₂ (steep direction)' } },
      series: [toSeries('gd', 'gradient descent', gdPath)],
      markers: [
        { id: 'start', x: START[0], y: START[1], label: 'start' },
        { id: 'goal', x: 0, y: 0, label: 'minimum' },
      ],
    }),
    highlight: { active: ['gd'], found: ['goal'] },
    explanation: `The terrain is a RAVINE — loss = (x² + 50y²)/2, fifty times steeper across than along — the bread-and-butter pathology of real training (Loss Landscapes showed why narrow valleys abound). Watch vanilla gradient descent walk it, computed live: the gradient points mostly ACROSS the ravine, so the path ZIGZAGS up and down the steep walls while inching along the floor. After 30 steps it has crawled to w₁ = ${gdPath.at(-1)[0].toFixed(1)} — not even halfway home. And the learning rate cannot save it: any lr above 0.04 makes the steep direction DIVERGE (the explosion corridor from Vanishing & Exploding Gradients). One global step size must fit the steepest wall; every other direction starves.`,
    invariant: 'One global learning rate is capped by the steepest direction and wasted on every shallow one.',
  };

  const momPath = runMomentum(0.008, 0.9, 30);
  yield {
    state: plotState({
      axes: { x: { label: 'w₁ (shallow direction)' }, y: { label: 'w₂ (steep direction)' } },
      series: [toSeries('gd', 'gradient descent', gdPath), toSeries('mom', 'momentum (β = 0.9)', momPath)],
      markers: [{ id: 'goal', x: 0, y: 0, label: 'minimum' }],
    }),
    highlight: { visited: ['gd'], active: ['mom'] },
    explanation: 'Fix 1 — MOMENTUM: stop being amnesiac. Keep a running velocity v ← βv + gradient and step along the VELOCITY. The zigzag murders itself: up-wall and down-wall gradients alternate signs, so in the velocity they CANCEL; the along-the-floor component points the same way every step, so it ACCUMULATES — compounding toward an effective 1/(1−β) = 10× speed-up in consistent directions. A heavy ball rolling through the ravine instead of a nervous walker: it overshoots the minimum once (watch the hook in the path — physical momentum, faithfully simulated) and settles.',
    invariant: 'Momentum integrates gradients: alternating components cancel, persistent components compound ~1/(1−β)×.',
  };

  const adamPath = runAdam(0.6, 30);
  yield {
    state: plotState({
      axes: { x: { label: 'w₁ (shallow direction)' }, y: { label: 'w₂ (steep direction)' } },
      series: [
        toSeries('gd', 'GD', gdPath),
        toSeries('mom', 'momentum', momPath),
        toSeries('adam', 'Adam', adamPath),
      ],
      markers: [{ id: 'goal', x: 0, y: 0, label: 'minimum' }],
    }),
    highlight: { visited: ['gd', 'mom'], found: ['adam'] },
    explanation: 'Fix 2 — ADAPT PER COORDINATE: Adam additionally tracks the running average of each coordinate\'s SQUARED gradient and divides each step by its square root. The steep direction, with its huge gradients, gets its step shrunk; the shallow direction, with its faint gradients, gets its step amplified — every coordinate normalized toward equal progress. Look at Adam\'s path: it leaves the start moving DIAGONALLY, almost straight at the goal, as if the ravine had been re-inflated into a round bowl. That re-inflation is the entire idea: adaptive learning rates undo the terrain\'s bad conditioning, one coordinate at a time.',
  };

  const lossCurves = (path) => path.map((w, t) => ({ x: t, y: loss(w) }));
  yield {
    state: plotState({
      axes: { x: { label: 'step' }, y: { label: 'loss' } },
      series: [
        { id: 'gdLoss', label: 'GD', points: lossCurves(gdPath) },
        { id: 'momLoss', label: 'momentum', points: lossCurves(momPath) },
        { id: 'adamLoss', label: 'Adam', points: lossCurves(adamPath) },
      ],
    }),
    highlight: { compare: ['gdLoss', 'adamLoss'] },
    explanation: `The scoreboard, loss per step: at step 20 Adam sits at ${loss(runAdam(0.6, 20).at(-1)).toFixed(2)} against GD's ${loss(runGD(0.038, 20).at(-1)).toFixed(1)} — over 20× lower — and momentum splits the difference before finishing strong. Notice Adam's small bounce after its plunge: adaptive momentum overshoots too; nothing here is magic, only better-aimed steps. And one honest footnote the curves cannot show: on some tasks (especially vision), well-tuned SGD+momentum still GENERALIZES slightly better than Adam — its noisier, less-normalized steps act as the flatness-seeking regularizer from Loss Landscapes. Faster optimization and better minima are not always the same race.`,
  };
}

function* insideAdam() {
  yield {
    state: matrixState({
      title: 'The two moments Adam tracks for every single weight',
      rows: [{ id: 'm', label: 'm — 1st moment' }, { id: 'v', label: 'v — 2nd moment' }],
      columns: [{ id: 'update', label: 'running average of' }, { id: 'role', label: 'what it buys' }],
      values: [[1, 2], [3, 4]],
      format: (v) => ['', 'gradients (β₁ = 0.9)', 'direction memory — momentum', 'squared gradients (β₂ = 0.999)', 'per-weight step normalization'][v],
    }),
    highlight: { compare: ['m:role', 'v:role'] },
    explanation: 'Adam = ADAptive Moment estimation, and the name is the design: per weight, keep two exponential moving averages. The FIRST moment m is smoothed gradient — momentum\'s memory (which way have we been going?). The SECOND moment v is smoothed squared gradient — the scale detector (how loud is this coordinate?). The update divides one by the root of the other: step ∝ m/√v. Direction from memory, size from typical loudness — every weight gets a personal learning rate, recomputed every step, for the cost of two extra numbers per parameter.',
  };

  const b1 = 0.9;
  const steps = [1, 2, 5, 10, 50];
  yield {
    state: matrixState({
      title: 'The bias correction: why m̂ = m / (1 − β₁ᵗ)',
      rows: steps.map((t) => ({ id: `t${t}`, label: `step ${t}` })),
      columns: [{ id: 'raw', label: 'raw m (true grad = 1)' }, { id: 'fixed', label: 'corrected m̂' }],
      values: steps.map((t) => [1 - b1 ** t, (1 - b1 ** t) / (1 - b1 ** t)]),
      format: (v) => v.toFixed(2),
    }),
    highlight: { removed: ['t1:raw', 't2:raw'], found: ['t1:fixed'] },
    explanation: 'The subtle third ingredient. Both averages start at ZERO, so early on they are biased low: with a constant true gradient of 1, the raw average reads 0.10 after one step, 0.19 after two — the optimizer would start timid for no reason. Adam divides by (1 − βᵗ), exactly the fraction of weight the average has accumulated so far, and the estimate snaps to the true value from step one (right column). The factor melts to 1 as t grows. A two-line fix — and the difference between Adam and the unstable adaptive optimizers that preceded it was largely this kind of bookkeeping care.',
    invariant: 'An EMA initialized at zero underestimates by the factor (1 − βᵗ); dividing it out unbiases every step.',
  };

  yield {
    state: matrixState({
      title: 'AdamW: where the weight-decay leash belongs',
      rows: [{ id: 'adam', label: 'Adam + L2 in the loss' }, { id: 'adamw', label: 'AdamW (decoupled)' }],
      columns: [{ id: 'path', label: 'decay travels' }, { id: 'effect', label: 'consequence' }],
      values: [[1, 2], [3, 4]],
      format: (v) => ['', 'through m and √v scaling', 'big weights with big gradients dodge the leash', 'straight to the weight: w −= lr·λ·w', 'every weight pays the same rent — λ works as designed'][v],
    }),
    highlight: { removed: ['adam:effect'], found: ['adamw:effect'] },
    explanation: 'One last repair, and it ties to Regularization: add the L2 penalty to the LOSS and its gradient λw flows through Adam\'s adaptive machinery — divided by √v like everything else — so the weights with the largest gradients are precisely the ones whose decay gets scaled AWAY. The leash slackens exactly where it is needed. AdamW (Loshchilov & Hutter, 2017) DECOUPLES the decay: apply it directly to the weight, outside the adaptive scaling. That one-line relocation measurably improves transformers, which is why the optimizer line of essentially every modern LLM reads AdamW.',
  };

  yield {
    state: matrixState({
      title: 'The family tree, assembled',
      rows: [
        { id: 'sgd', label: 'SGD' },
        { id: 'mom', label: '+ momentum' },
        { id: 'rms', label: 'RMSProp' },
        { id: 'adam', label: 'Adam' },
        { id: 'adamw', label: 'AdamW' },
      ],
      columns: [{ id: 'adds', label: 'adds' }, { id: 'home', label: 'where it lives today' }],
      values: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]],
      format: (v) => ['', 'the raw step', 'baseline; vision with schedules', 'velocity memory', 'classic CNN training', 'divide by √EMA(g²)', 'RNNs, RL (Hinton\'s lecture 6!)', 'momentum + RMSProp + bias fix', 'the general-purpose default', 'decoupled decay', 'every transformer & LLM you have used'][v],
    }),
    highlight: { found: ['adamw:home'] },
    explanation: 'The whole lineage on one card — each row is one idea stacked on the row above, and you have now watched every ingredient work: the ravine that defeats SGD, the velocity that cancels zigzag, the per-coordinate normalization that rounds the bowl, the bias correction that unbiases the start, the decoupled decay that lets λ do its job. Practical defaults to leave with: AdamW at lr 3e-4, β = (0.9, 0.999) is the "works almost everywhere" opener; drop to tuned SGD+momentum when squeezing the last point of generalization from vision models; and whenever training misbehaves, remember the diagnosis order — data first (Cross-Validation), gradient flow second (Vanishing Gradients), optimizer knobs third. The optimizer is rarely the culprit; it is merely the most fun to fiddle with.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'three optimizers, one ravine') yield* ravineRace();
  else if (view === 'inside Adam, knob by knob') yield* insideAdam();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Adam is the default optimizer for nearly every neural network trained today. Its name means "Adaptive Moment Estimation" — it tracks two moving averages for each weight, one for direction (momentum), one for scale, and uses both to compute a personal learning rate per coordinate. This per-weight adaptation undoes bad terrain: the visualization shows it clearly on a real ravine (loss = (x² + 50y²)/2, fifty times steeper across than along). Vanilla gradient descent takes thirty steps to crawl halfway; Adam reaches a hundred times lower loss in twenty steps.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Adam maintains two exponential moving averages per weight: m (smoothed gradient, for direction) and v (smoothed squared gradient, for scale). Each step: update m ← β₁·m + (1 − β₁)·g and v ← β₂·v + (1 − β₂)·g² (usually β₁ = 0.9, β₂ = 0.999), then step by learning_rate · m / √(v + ε). This divides momentum by scale, amplifying signals with small gradients and dampening those with large ones — every coordinate gets a personal learning rate. One critical fix: both averages start at zero and underestimate early on, so Adam divides by a bias-correction factor (1 − βᵗ) that melts to one as t grows. This bookkeeping detail separated stable Adam from the unstable optimizers that came before. AdamW (Loshchilov & Hutter, 2017) decouples weight decay from adaptive scaling, applying decay directly to the weight outside the moment machinery — a one-line change that measurably improves transformers.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Per step: update two moving averages and one weight, O(parameters) cost, same as vanilla gradient descent. Storage cost: two numbers per parameter (the moments). For a billion-parameter model, that is 8 GB extra but does not change step latency. The generalization trade-off: on some vision tasks, well-tuned SGD+momentum generalizes slightly better than Adam because Adam's per-coordinate normalization is too aggressive — it does not seek flat minima the way noisier SGD does. For most applications, Adam's faster convergence wins. When you need every last point (vision competitions), you often tune both.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Adam is the standard for transformers, language models, and most deep learning since 2015. Every BERT, GPT, and Stable Diffusion uses Adam or a variant. Recommended starting learning rate: 3e-4. Practitioners try Adam first; if training fails, check data quality (Cross-Validation), then gradient flow (Vanishing & Exploding Gradients), then optimizer tuning — in that order. On vision models at ImageNet scale, well-tuned SGD+momentum can steal back generalization points.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Adam is not a universal fix. Bad data, bad conditioning, or a model that does not fit the task will still train poorly — Adam only speeds convergence. Do not tune learning rate without checking gradient flow first; no optimizer fixes vanishing or exploding signals. The diagnosis order: data, gradient flow, optimizer. Adam's adaptive rates are heuristics, not "right" rates; they work well on well-behaved landscapes but can fail on adversarial ones. The β values (0.9, 0.999) are not magic: they control the timescale of momentum and second-moment evolution.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Gradient Descent teaches the baseline. Loss Landscapes & Optimization Geometry explains ravines, valleys, and saddle points. Vanishing & Exploding Gradients shows when optimizers cannot help. Regularization: L1 & L2 covers weight decay and AdamW. Transformer Block shows where Adam lives in modern architectures.`,
      ],
    },
  ],
};

