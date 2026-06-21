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
      axes: { x: { label: 'wâ‚ (shallow direction)' }, y: { label: 'wâ‚‚ (steep direction)' } },
      series: [toSeries('gd', 'gradient descent', gdPath)],
      markers: [
        { id: 'start', x: START[0], y: START[1], label: 'start' },
        { id: 'goal', x: 0, y: 0, label: 'minimum' },
      ],
    }),
    highlight: { active: ['gd'], found: ['goal'] },
    explanation: `The terrain is a RAVINE — loss = (x² + 50y²)/2, fifty times steeper across than along — the bread-and-butter pathology of real training (Loss Landscapes showed why narrow valleys abound). Watch vanilla gradient descent walk it, computed live: the gradient points mostly ACROSS the ravine, so the path ZIGZAGS up and down the steep walls while inching along the floor. After 30 steps it has crawled to wâ‚ = ${gdPath.at(-1)[0].toFixed(1)} — not even halfway home. And the learning rate cannot save it: any lr above 0.04 makes the steep direction DIVERGE (the explosion corridor from Vanishing & Exploding Gradients). One global step size must fit the steepest wall; every other direction starves.`,
    invariant: 'One global learning rate is capped by the steepest direction and wasted on every shallow one.',
  };

  const momPath = runMomentum(0.008, 0.9, 30);
  yield {
    state: plotState({
      axes: { x: { label: 'wâ‚ (shallow direction)' }, y: { label: 'wâ‚‚ (steep direction)' } },
      series: [toSeries('gd', 'gradient descent', gdPath), toSeries('mom', 'momentum (β = 0.9)', momPath)],
      markers: [{ id: 'goal', x: 0, y: 0, label: 'minimum' }],
    }),
    highlight: { visited: ['gd'], active: ['mom'] },
    explanation: 'Fix 1 — MOMENTUM: stop being amnesiac. Keep a running velocity v â† βv + gradient and step along the VELOCITY. The zigzag murders itself: up-wall and down-wall gradients alternate signs, so in the velocity they CANCEL; the along-the-floor component points the same way every step, so it ACCUMULATES — compounding toward an effective 1/(1âˆ’β) = 10Ã— speed-up in consistent directions. A heavy ball rolling through the ravine instead of a nervous walker: it overshoots the minimum once (watch the hook in the path — physical momentum, faithfully simulated) and settles.',
    invariant: 'Momentum integrates gradients: alternating components cancel, persistent components compound ~1/(1âˆ’β)Ã—.',
  };

  const adamPath = runAdam(0.6, 30);
  yield {
    state: plotState({
      axes: { x: { label: 'wâ‚ (shallow direction)' }, y: { label: 'wâ‚‚ (steep direction)' } },
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
    explanation: `The scoreboard, loss per step: at step 20 Adam sits at ${loss(runAdam(0.6, 20).at(-1)).toFixed(2)} against GD\'s ${loss(runGD(0.038, 20).at(-1)).toFixed(1)} — over 20Ã— lower — and momentum splits the difference before finishing strong. Notice Adam\'s small bounce after its plunge: adaptive momentum overshoots too; nothing here is magic, only better-aimed steps. And one honest footnote the curves cannot show: on some tasks (especially vision), well-tuned SGD+momentum still GENERALIZES slightly better than Adam — its noisier, less-normalized steps act as the flatness-seeking regularizer from Loss Landscapes. Faster optimization and better minima are not always the same race.`,
  };
}

function* insideAdam() {
  yield {
    state: matrixState({
      title: 'The two moments Adam tracks for every single weight',
      rows: [{ id: 'm', label: 'm — 1st moment' }, { id: 'v', label: 'v — 2nd moment' }],
      columns: [{ id: 'update', label: 'running average of' }, { id: 'role', label: 'what it buys' }],
      values: [[1, 2], [3, 4]],
      format: (v) => ['', 'gradients (βâ‚ = 0.9)', 'direction memory — momentum', 'squared gradients (βâ‚‚ = 0.999)', 'per-weight step normalization'][v],
    }),
    highlight: { compare: ['m:role', 'v:role'] },
    explanation: 'Adam = ADAptive Moment estimation, and the name is the design: per weight, keep two exponential moving averages. The FIRST moment m is smoothed gradient — momentum\'s memory (which way have we been going?). The SECOND moment v is smoothed squared gradient — the scale detector (how loud is this coordinate?). The update divides one by the root of the other: step âˆ m/âˆšv. Direction from memory, size from typical loudness — every weight gets a personal learning rate, recomputed every step, for the cost of two extra numbers per parameter.',
  };

  const b1 = 0.9;
  const steps = [1, 2, 5, 10, 50];
  yield {
    state: matrixState({
      title: 'The bias correction: why mÌ‚ = m / (1 âˆ’ βâ‚áµ—)',
      rows: steps.map((t) => ({ id: `t${t}`, label: `step ${t}` })),
      columns: [{ id: 'raw', label: 'raw m (true grad = 1)' }, { id: 'fixed', label: 'corrected mÌ‚' }],
      values: steps.map((t) => [1 - b1 ** t, (1 - b1 ** t) / (1 - b1 ** t)]),
      format: (v) => v.toFixed(2),
    }),
    highlight: { removed: ['t1:raw', 't2:raw'], found: ['t1:fixed'] },
    explanation: 'The subtle third ingredient. Both averages start at ZERO, so early on they are biased low: with a constant true gradient of 1, the raw average reads 0.10 after one step, 0.19 after two — the optimizer would start timid for no reason. Adam divides by (1 âˆ’ βáµ—), exactly the fraction of weight the average has accumulated so far, and the estimate snaps to the true value from step one (right column). The factor melts to 1 as t grows. A two-line fix — and the difference between Adam and the unstable adaptive optimizers that preceded it was largely this kind of bookkeeping care.',
    invariant: 'An EMA initialized at zero underestimates by the factor (1 âˆ’ βáµ—); dividing it out unbiases every step.',
  };

  yield {
    state: matrixState({
      title: 'AdamW: where the weight-decay leash belongs',
      rows: [{ id: 'adam', label: 'Adam + L2 in the loss' }, { id: 'adamw', label: 'AdamW (decoupled)' }],
      columns: [{ id: 'path', label: 'decay travels' }, { id: 'effect', label: 'consequence' }],
      values: [[1, 2], [3, 4]],
      format: (v) => ['', 'through m and âˆšv scaling', 'big weights with big gradients dodge the leash', 'straight to the weight: w âˆ’= lrÂ·λÂ·w', 'every weight pays the same rent — λ works as designed'][v],
    }),
    highlight: { removed: ['adam:effect'], found: ['adamw:effect'] },
    explanation: 'One last repair, and it ties to Regularization: add the L2 penalty to the LOSS and its gradient λw flows through Adam\'s adaptive machinery — divided by âˆšv like everything else — so the weights with the largest gradients are precisely the ones whose decay gets scaled AWAY. The leash slackens exactly where it is needed. AdamW (Loshchilov & Hutter, 2017) DECOUPLES the decay: apply it directly to the weight, outside the adaptive scaling. That one-line relocation measurably improves transformers, which is why the optimizer line of essentially every modern LLM reads AdamW.',
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
      format: (v) => ['', 'the raw step', 'baseline; vision with schedules', 'velocity memory', 'classic CNN training', 'divide by âˆšEMA(g²)', 'RNNs, RL (Hinton\'s lecture 6!)', 'momentum + RMSProp + bias fix', 'the general-purpose default', 'decoupled decay', 'every transformer & LLM you have used'][v],
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
      heading: `Why this exists`,
      paragraphs: [
        `Adam is an optimizer: the rule that turns gradients into weight updates. Gradient Descent uses one global learning rate, so the steepest direction caps every coordinate. In this demo the terrain is the ravine loss = (x^2 + 50y^2)/2. The y direction is fifty times steeper than x. Plain descent at lr = 0.038 zigzags across the steep wall and still has loss 4.06 after 30 steps. Adam tracks direction and scale separately, so at step 20 its loss is 0.40, more than 20x below plain descent at the same moment. Loss Landscapes & Optimization Geometry is the terrain; Adam is the walking strategy.`,
        {type: `callout`, text: `Adam is cheap per-coordinate preconditioning: momentum remembers direction while the second moment rescales noisy or steep coordinates.`},
      ],
    },
    {
      heading: `How to read the animation`,
      paragraphs: [
        `In the ravine view, watch why one learning rate fails. The steep y-direction forces plain gradient descent to use a cautious global step, so the shallow x-direction barely moves. Momentum cancels alternating wall-to-wall motion and keeps the along-valley component. Adam adds per-coordinate scaling so steep coordinates shrink and quiet coordinates get a usable step.`,
        `In the inside-Adam view, read m as direction memory and v as scale memory. Bias correction is a startup repair, not a cosmetic formula. AdamW then separates weight decay from adaptive scaling so the regularization knob behaves like a leash instead of being divided away by the variance estimate.`,
        `The practical habit is to log optimizer behavior as part of the experiment, not as an afterthought. Learning rate, betas, weight decay, warmup, clipping, and optimizer-state memory are part of the result because changing them can change both training dynamics and final model behavior.`,
      
        {type: 'image', src: './assets/gifs/adam-optimizer.gif', alt: 'Animated walkthrough of the adam optimizer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `SGD: same learning rate for all parameters. But parameters have very different gradient magnitudes — embedding layers get sparse, large gradients; deep layers get small gradients. One learning rate cannot serve both.`,
        `AdaGrad (Duchi et al. 2011): accumulate squared gradients, divide the learning rate by their square root. Frequent-gradient parameters get smaller effective rates. Problem: the accumulated sum only grows — the learning rate monotonically decreases to zero.`,
        `RMSProp (Hinton, unpublished lecture 2012): use an exponential moving average of squared gradients instead of the sum. The denominator adapts but does not grow unboundedly.`,
        `Adam (Kingma & Ba 2015): combine RMSProp (adaptive learning rate) with momentum (exponential moving average of gradients). Two moving averages: m_t = beta1 * m_{t-1} + (1 - beta1) * g_t (first moment, the mean). v_t = beta2 * v_{t-1} + (1 - beta2) * g_t^2 (second moment, the variance). Bias correction: m-hat = m / (1 - beta1^t), v-hat = v / (1 - beta2^t). Update: theta = theta - lr * m-hat / (sqrt(v-hat) + epsilon). Default hyperparameters (beta1 = 0.9, beta2 = 0.999, epsilon = 1e-8) work well across almost all tasks.`,
        `Adam is the default optimizer for GPT, BERT, Stable Diffusion, and most deep learning research. AdamW (Loshchilov & Hutter 2019) adds decoupled weight decay, fixing the L2 regularization interaction where the penalty gets divided away by the adaptive denominator.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `A single global learning rate is capped by the steepest direction in the loss surface. In the ravine demo, the y-direction has curvature 50 and x-direction has curvature 1. Any learning rate above 0.04 makes y diverge. At lr = 0.038, x crawls because the rate that keeps y stable wastes 98% of the available step budget on the shallow direction.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/3/32/Rosenbrock_function.svg`, alt: `Rosenbrock function surface with curved valley`, caption: `The Rosenbrock valley is a classic ravine that exposes why one global step size zigzags across steep curvature. Source: Wikimedia Commons, Oleg Alexandrov, public domain.`},
        `Momentum fixes the direction problem but not the scale problem: it cancels oscillation across the ravine, but both coordinates still share one step size. AdaGrad fixes the scale problem but accumulates squared gradients forever, so its effective rate shrinks to zero on long runs. Neither alone is enough for the combination of noisy gradients, uneven curvature, and long training that defines modern deep learning.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `Adam is a diagonal preconditioner with momentum. The first moment says which way the parameter has been pushed. The second moment says how large the squared gradients usually are. Dividing by the square root of the second moment makes loud coordinates quieter and quiet coordinates usable.`,
        `This is not full Newton optimization. Adam does not know the full curvature matrix or interactions between weights. It uses cheap per-parameter statistics that are good enough to make many deep-learning problems train quickly without hand-scaling every layer.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Adam keeps two exponential moving averages for every parameter. The first moment m is smoothed gradient direction, the same memory idea behind momentum with beta1 = 0.9. The second moment v is a smoothed average of squared gradients, usually beta2 = 0.999, which estimates how loud each coordinate normally is. The update is learning_rate times corrected m divided by sqrt(corrected v) plus epsilon. That shrinks steps in steep coordinates and amplifies quiet ones, a diagonal preconditioner rather than the full curvature machinery in The Hessian: Curvature & Newton\'s Step or Natural Gradient & Fisher Information.`,
        `The bias correction is not decoration. Both averages start at zero, so the raw first average after one constant unit gradient is only 0.10. Dividing by 1 - beta^t removes that startup bias. The inside-Adam view shows this explicitly: corrected m is already 1.00 at step 1, while raw m is still catching up. AdamW then repairs weight decay by applying the decay directly to weights instead of letting it get divided by the adaptive denominator.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Adam works because many training failures are scale failures before they are direction failures. If one parameter sees gradients one hundred times larger than another, a single learning rate either explodes the loud parameter or starves the quiet one. Adam\'s second moment estimate normalizes those histories so each coordinate can move on a more comparable scale.`,
        `Momentum adds the other half. Gradients that keep pointing the same way accumulate into a steadier direction, while alternating gradients are damped. The result is not a perfect curvature method, but it is a cheap update rule that handles ravines, noisy mini-batches, and uneven layer scales well enough to be a strong default.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Adam is still O(parameters) per step, but it stores two extra numbers per parameter. With 32-bit optimizer state, a billion parameters need about 8 GB just for m and v, before weights, gradients, and activations. The arithmetic is cheap compared with a forward and backward pass; memory is the real bill. Learning-Rate Schedules & Warmup still matters because a large first adaptive step can be based on one noisy variance sample, so transformer recipes ramp up the rate before decaying it.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `AdamW is the default for language models, diffusion models, and The Transformer Block because decoupled weight decay makes the regularization knob behave predictably. A practical opener is AdamW with lr near 3e-4 and betas (0.9, 0.999), then tune for the task. Vision training is the main exception: well-tuned SGD with momentum can still win final test accuracy when the recipe is carefully scheduled.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Adam is not a cure for bad data, dead gradients, or a model with the wrong inductive bias. Vanishing & Exploding Gradients can leave early layers without useful signal no matter how clever the optimizer is. Adam can also generalize slightly worse than noisy SGD on some vision tasks because its normalized steps may not filter sharp minima as strongly. Regularization: L1 & L2 and data quality often beat optimizer fiddling. Treat beta values as timescales, not magic constants: beta1 controls direction memory, and beta2 controls how slowly the scale estimate moves.`,
        `Adam can fail quietly by making bad objectives train smoothly. If the labels are wrong, the validation split leaks, or the loss rewards the wrong behavior, Adam will optimize the wrong target efficiently. Fast descent is not the same as useful learning. The right optimizer is an empirical choice tied to the task, schedule, and regularization.`,
      ],
    },
    {
      heading: `Diagnostics`,
      paragraphs: [
        `Track training loss, validation loss, gradient norm, update norm, effective learning rate, AdamW weight decay, clipping rate, beta settings, warmup progress, and optimizer-state memory. These signals tell whether the optimizer is helping or hiding a deeper failure.`,
        `The most useful diagnostic is the ratio between update size and parameter size. If updates are tiny, the model may be stuck or the learning rate too low. If updates are huge or clipping constantly fires, the run may need warmup, a smaller rate, better initialization, or cleaner batches.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `Single parameter, beta1 = 0.9, beta2 = 0.999, lr = 0.001, epsilon = 1e-8. The gradient at step 1 is g = 2.0. Both m and v start at zero.`,
        `First moment: m1 = 0.9 * 0 + 0.1 * 2.0 = 0.2. Second moment: v1 = 0.999 * 0 + 0.001 * 4.0 = 0.004. Both are biased low because the averages just started.`,
        `Bias correction: m-hat = 0.2 / (1 - 0.9^1) = 0.2 / 0.1 = 2.0. v-hat = 0.004 / (1 - 0.999^1) = 0.004 / 0.001 = 4.0. The correction recovered the true gradient magnitude from one sample.`,
        `Update: lr * m-hat / (sqrt(v-hat) + epsilon) = 0.001 * 2.0 / (2.0 + 1e-8) = approximately 0.001. The bias correction made m-hat = 2.0 (the actual gradient), not 0.2 (the biased estimate). Without correction, the first steps would be 10x too small.`,
      ],
    },
    {
      heading: `Sources and study next`,
      paragraphs: [
        `Kingma & Ba 2015, "Adam: A Method for Stochastic Optimization" — the original paper deriving the bias correction and regret bounds. Loshchilov & Hutter 2019, "Decoupled Weight Decay Regularization" — fixes how weight decay interacts with adaptive scaling and defines AdamW, now the standard for training transformers. Duchi et al. 2011, "Adaptive Subgradient Methods for Online Learning and Stochastic Optimization" — AdaGrad, the first per-parameter adaptive rate.`,
        `Study next: Gradient Descent (the foundation Adam builds on). Learning Rate Schedules (warmup + cosine decay pairs with Adam in most transformer recipes). Backpropagation (computes the gradients Adam uses). Regularization (AdamW's weight decay — why decoupling matters). Loss Functions (what Adam minimizes).`,
      ],
    },
    {
      heading: `Learning map`,
      paragraphs: [
        `Prerequisites: Gradient Descent (Adam is an optimizer that consumes gradients, so the gradient computation must already make sense) and exponential moving averages (both moments are EMAs, and the bias correction formula follows directly from the EMA definition).`,
        `Unlocks: training transformers (AdamW is the standard optimizer), understanding per-parameter adaptation (why some layers need different effective rates), learning rate warmup (why Adam needs it less than SGD but still benefits from it in practice), and the SGD vs Adam debate in deep learning (when adaptive methods help and when they hurt generalization).`,
      ],
    },
    {
      heading: `Micro checks`,
      paragraphs: [
        `1D check: g_1 = 0.1 (gradient at step 1). beta1 = 0.9, beta2 = 0.999, lr = 0.001. m_1 = 0.9 * 0 + 0.1 * 0.1 = 0.01. v_1 = 0.999 * 0 + 0.001 * 0.01 = 0.00001. Bias-corrected: m-hat_1 = 0.01 / (1 - 0.9) = 0.1. v-hat_1 = 0.00001 / (1 - 0.999) = 0.01. Update: delta-theta = 0.001 * 0.1 / (sqrt(0.01) + 1e-8) = 0.001 * 0.1 / 0.1 = approximately 0.001.`,
        `The bias correction is crucial at early steps: without it, m_1 = 0.01 (10x too small because the moving average has not warmed up). After many steps, (1 - beta1^t) approaches 1 and the correction vanishes.`,
        `Verify that Adam's effective step size is bounded by approximately lr. The ratio |m-hat / (sqrt(v-hat) + epsilon)| is at most 1 by a Cauchy-Schwarz-like argument, so the step size is at most lr. This is why the default lr = 0.001 gives a stable starting point across diverse architectures.`,
      ],
    },
    {
      heading: `Try this now`,
      paragraphs: [
        `SGD vs Adam on two parameters. theta_1 has gradients [0.01, 0.01, 0.01, ...] (consistent, small). theta_2 has gradients [10, -10, 10, -10, ...] (oscillating, large).`,
        `SGD with lr = 0.001: theta_1 moves 0.00001 per step (slow). theta_2 oscillates plus-or-minus 0.01 (no net progress).`,
        `Adam: theta_1's v-hat is approximately 0.0001, so its effective rate is approximately 0.001 * 0.01 / 0.01 = 0.001. theta_2's v-hat is approximately 100, so its effective rate is approximately 0.001 * m-hat / 10. The momentum m-hat averages out the oscillation, and the large v-hat shrinks the step.`,
        `Adam automatically handles both cases — this is why one set of hyperparameters works across diverse architectures. The consistent parameter gets a usable step; the oscillating parameter gets damped momentum and a shrunk rate.`,
      ],
    },
  ],
};

