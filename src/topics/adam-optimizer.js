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
        `Adam is an optimizer: the rule that turns gradients into weight updates. Gradient Descent uses one global learning rate, so the steepest direction caps every coordinate. In this demo the terrain is the ravine loss = (x^2 + 50y^2)/2. The y direction is fifty times steeper than x. Plain descent at lr = 0.038 zigzags across the steep wall and still has loss 4.06 after 30 steps. Adam tracks direction and scale separately, so at step 20 its loss is 0.40, more than 20x below plain descent at the same moment. Loss Landscapes & Optimization Geometry is the terrain; Adam is the walking strategy.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Adam keeps two exponential moving averages for every parameter. The first moment m is smoothed gradient direction, the same memory idea behind momentum with beta1 = 0.9. The second moment v is a smoothed average of squared gradients, usually beta2 = 0.999, which estimates how loud each coordinate normally is. The update is learning_rate times corrected m divided by sqrt(corrected v) plus epsilon. That shrinks steps in steep coordinates and amplifies quiet ones, a diagonal preconditioner rather than the full curvature machinery in The Hessian: Curvature & Newton's Step or Natural Gradient & Fisher Information.`,
        `The bias correction is not decoration. Both averages start at zero, so the raw first average after one constant unit gradient is only 0.10. Dividing by 1 - beta^t removes that startup bias. The inside-Adam view shows this explicitly: corrected m is already 1.00 at step 1, while raw m is still catching up. AdamW then repairs weight decay by applying the decay directly to weights instead of letting it get divided by the adaptive denominator.`,
      ],
    },
    {
      heading: `How the visual model teaches it`,
      paragraphs: [
        `In the ravine view, watch why one learning rate fails. The steep y-direction forces plain gradient descent to use a cautious global step, so the shallow x-direction barely moves. Momentum cancels alternating wall-to-wall motion and keeps the along-valley component. Adam adds per-coordinate scaling so steep coordinates shrink and quiet coordinates get a usable step.`,
        `In the inside-Adam view, read m as direction memory and v as scale memory. Bias correction is a startup repair, not a cosmetic formula. AdamW then separates weight decay from adaptive scaling so the regularization knob behaves like a leash instead of being divided away by the variance estimate.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The obvious optimizer is gradient descent: compute the gradient, multiply by one learning rate, and move downhill. That works on round, well-scaled bowls, but neural-network losses often have ravines where one direction is steep and another is shallow. One global learning rate must be small enough not to explode in the steep direction, so it crawls in the shallow direction.`,
        `Momentum fixes part of that wall by remembering direction. It cancels oscillation across the ravine and compounds movement along the floor. Adam keeps that benefit and adds a scale estimate for each coordinate, so every parameter gets a step size adjusted to its own gradient history.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `Adam is a diagonal preconditioner with momentum. The first moment says which way the parameter has been pushed. The second moment says how large the squared gradients usually are. Dividing by the square root of the second moment makes loud coordinates quieter and quiet coordinates usable.`,
        `This is not full Newton optimization. Adam does not know the full curvature matrix or interactions between weights. It uses cheap per-parameter statistics that are good enough to make many deep-learning problems train quickly without hand-scaling every layer.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Adam works because many training failures are scale failures before they are direction failures. If one parameter sees gradients one hundred times larger than another, a single learning rate either explodes the loud parameter or starves the quiet one. Adam's second moment estimate normalizes those histories so each coordinate can move on a more comparable scale.`,
        `Momentum adds the other half. Gradients that keep pointing the same way accumulate into a steadier direction, while alternating gradients are damped. The result is not a perfect curvature method, but it is a cheap update rule that handles ravines, noisy mini-batches, and uneven layer scales well enough to be a strong default.`,
      ],
    },
    {
      heading: `Complete case study`,
      paragraphs: [
        `A transformer fine-tuning run starts unstable. Plain SGD needs a tiny learning rate because some layers have large gradients. With AdamW, the large-gradient coordinates are normalized, the small-gradient coordinates still move, and decoupled weight decay keeps weights from drifting without being distorted by the adaptive denominator.`,
        `The training team still needs warmup, gradient clipping, validation curves, and learning-rate decay. Adam makes the first optimization problem easier, but it does not remove data quality, model capacity, or evaluation discipline. A bad run can still be a data split problem rather than an optimizer problem.`,
      ],
    },
    {
      heading: `Cost and complexity`,
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
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Adam is not a cure for bad data, dead gradients, or a model with the wrong inductive bias. Vanishing & Exploding Gradients can leave early layers without useful signal no matter how clever the optimizer is. Adam can also generalize slightly worse than noisy SGD on some vision tasks because its normalized steps may not filter sharp minima as strongly. Regularization: L1 & L2 and data quality often beat optimizer fiddling. Treat beta values as timescales, not magic constants: beta1 controls direction memory, and beta2 controls how slowly the scale estimate moves.`,
      ],
    },
    {
      heading: `Operational signals`,
      paragraphs: [
        `Track training loss, validation loss, gradient norm, update norm, effective learning rate, AdamW weight decay, clipping rate, beta settings, warmup progress, and optimizer-state memory. These signals tell whether the optimizer is helping or hiding a deeper failure.`,
        `The most useful diagnostic is the ratio between update size and parameter size. If updates are tiny, the model may be stuck or the learning rate too low. If updates are huge or clipping constantly fires, the run may need warmup, a smaller rate, better initialization, or cleaner batches.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Adam can fail quietly by making bad objectives train smoothly. If the labels are wrong, the validation split leaks, or the loss rewards the wrong behavior, Adam will optimize the wrong target efficiently. Fast descent is not the same as useful learning.`,
        `It can also produce different generalization behavior from SGD. Adaptive normalization changes the geometry of the path through parameter space. On some vision problems, carefully tuned SGD with momentum still wins final accuracy, even if Adam reaches low training loss faster. The right optimizer is an empirical choice tied to the task, schedule, and regularization.`,
      ],
    },
    {
      heading: `What to remember`,
      paragraphs: [
        `Adam combines direction memory with per-coordinate scale memory. AdamW adds weight decay in the right place. That combination is why it became the default for transformers and many generative models.`,
        `For course design, teach Adam after gradient descent, momentum, and loss geometry. Students should see the ravine first, then understand why m, v, bias correction, and decoupled decay are each solving a specific problem.`,
        `The practical habit is to log optimizer behavior as part of the experiment, not as an afterthought. Learning rate, betas, weight decay, warmup, clipping, and optimizer-state memory are part of the result because changing them can change both training dynamics and final model behavior.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `After this page, focus on the baseline update, the geometry that creates ravines, and the pages on richer preconditioning. The main habit is diagnostic order: inspect data first, inspect gradient flow second, and only then tune the optimizer. Optimizers are powerful, but they are often the most entertaining knob rather than the true bottleneck.`,
      ],
    },
  ],
};
