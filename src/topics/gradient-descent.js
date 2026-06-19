// Gradient descent: roll downhill on the loss curve, one learning-rate-sized
// step at a time. The loop that trains every neural network.

import { plotState, parseNumber, InputError } from '../core/state.js';

export const topic = {
  id: 'gradient-descent',
  title: 'Gradient Descent',
  category: 'AI & ML',
  summary: 'Follow the slope downhill to minimize loss — the algorithm that trains every neural network.',
  controls: [
    { id: 'start', label: 'Start weight w', type: 'number', defaultValue: '-4' },
    { id: 'lr', label: 'Learning rate', type: 'select', options: ['0.1', '0.35', '0.8', '1.05 (too big!)'], defaultValue: '0.35' },
  ],
  run,
};

// A toy loss with its minimum at w = 3. Real losses have billions of
// dimensions, but the picture — and the update rule — are exactly this.
const loss = (w) => (w - 3) ** 2 + 1;
const gradient = (w) => 2 * (w - 3);

export function* run(input) {
  const start = parseNumber(input.start, { label: 'a start weight' });
  if (Math.abs(start - 3) > 12) throw new InputError('Start between −9 and 15 so the curve stays visible.');
  const lr = parseFloat(input.lr);

  const trajectory = [start];
  let w = start;
  for (let i = 0; i < 8 && Math.abs(gradient(w)) > 0.05; i += 1) {
    w -= lr * gradient(w);
    trajectory.push(w);
  }

  const xs = [...trajectory, -2, 8, 3];
  const lo = Math.min(...xs) - 1;
  const hi = Math.max(...xs) + 1;
  const curvePoints = Array.from({ length: 61 }, (_, i) => {
    const x = lo + (i / 60) * (hi - lo);
    return { x, y: loss(x) };
  });
  const axes = { x: { label: 'weight w' }, y: { label: 'loss' } };
  const curve = { id: 'loss', label: 'loss(w)', points: curvePoints };

  const frame = (upto, vectors = []) => plotState({
    axes,
    series: [curve],
    markers: trajectory.slice(0, upto + 1).map((tw, i) => ({
      id: `w${i}`, x: tw, y: loss(tw), label: i === upto ? `w = ${tw.toFixed(2)}` : '',
    })),
    vectors,
  });

  yield {
    state: frame(0),
    highlight: { active: ['w0'] },
    explanation: `The curve is the LOSS — how wrong the model is for each possible weight w. Training = finding the bottom. We cannot see the whole curve (in real models it has billions of dimensions); we can only feel the SLOPE under our feet. Start at w = ${start}.`,
  };

  for (let i = 1; i < trajectory.length; i += 1) {
    const prev = trajectory[i - 1];
    const grad = gradient(prev);
    yield {
      state: frame(i - 1, [{
        id: 'step',
        from: { x: prev, y: loss(prev) },
        to: { x: trajectory[i], y: loss(trajectory[i]) },
        label: `−lr × ${grad.toFixed(2)}`,
      }]),
      highlight: { active: [`w${i - 1}`] },
      explanation: `The gradient (slope) at w = ${prev.toFixed(2)} is ${grad.toFixed(2)} — ${grad > 0 ? 'uphill to the right, so step LEFT' : 'uphill to the left, so step RIGHT'}. Update rule: w ← w − learning_rate × gradient = ${prev.toFixed(2)} − ${lr} × ${grad.toFixed(2)} = ${trajectory[i].toFixed(2)}.`,
      invariant: 'Always step OPPOSITE the gradient — that is the steepest way down.',
    };
    yield {
      state: frame(i),
      highlight: { active: [`w${i}`], visited: trajectory.slice(0, i).map((_, k) => `w${k}`) },
      explanation: `Now at w = ${trajectory[i].toFixed(2)}, loss ${loss(trajectory[i]).toFixed(2)} ${loss(trajectory[i]) < loss(prev) ? '— lower than before. Progress.' : '— HIGHER than before! The step overshot the valley.'}`,
    };
  }

  const final = trajectory[trajectory.length - 1];
  const converged = Math.abs(gradient(final)) <= 0.05 || Math.abs(final - 3) < Math.abs(start - 3);
  yield {
    state: frame(trajectory.length - 1),
    highlight: { found: [`w${trajectory.length - 1}`] },
    explanation: converged
      ? `Settled at w = ${final.toFixed(2)} (the true minimum is 3). Notice the steps shrank automatically near the bottom — flatter slope, smaller gradient, smaller step. Replace this one weight with billions and this EXACT loop — forward pass, gradient, step — is how every neural network, including the LLM you might be reading this with, was trained.`
      : `It DIVERGED: with learning rate ${lr}, each step overshoots the valley and lands higher up the other side — the oscillation grows forever. Too-large learning rates are the classic way training "explodes" (loss → NaN). Try 0.35: same start, same rule, opposite outcome. Tuning this one number well is half of practical deep learning.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The curve is the loss function: how wrong the model is for each possible weight w. The dot is the current weight. The arrow from one dot to the next is one gradient descent update. The label on each arrow shows the gradient computation: the slope at the current point, multiplied by the learning rate, subtracted from the current weight.',
        'Watch the arrow directions. Left of the minimum the slope is negative, so the update moves right. Right of the minimum the slope is positive, so the update moves left. The arrow always points opposite the gradient. Near the bottom the curve flattens, so the gradient shrinks, the arrow shortens, and the steps slow down automatically.',
        'Try the "1.05 (too big!)" learning rate. The arrows overshoot the valley on every step, each landing higher than the last. Same formula, same curve, but the step size exceeds what the local curvature can tolerate. The update rule is correct and the training still diverges. That is the visual proof that learning rate is not a detail.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Augustin-Louis Cauchy published the first gradient descent method in 1847 to solve systems of equations. The problem he faced is the same one we face today: given a function of many variables, find the input that makes the output as small as possible. Closed-form solutions exist only for special cases. Linear regression has the normal equation, but it requires inverting a matrix, which is O(n^3) and breaks when features number in the millions. Neural networks have no closed form at all.',
        'Gradient descent replaces solving with searching. Define a loss function that measures error. Compute which direction makes the loss worse. Step the other way. The method needs only two things from the function: a value and a derivative. That pair is cheap to compute even when the function has billions of inputs, which is why the same algorithm Cauchy used to solve 19th-century equation systems now trains every large language model.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Grid search: divide each parameter axis into evenly spaced values, evaluate the loss at every combination, pick the lowest. For one parameter with 100 grid points, that is 100 evaluations. Manageable. Random search: sample parameter values from some distribution, evaluate each, keep the best. Both methods require no derivatives and make no assumptions about the loss surface.',
        'Grid search finds optima reliably in low dimensions. Random search often beats grids because it does not waste evaluations on unimportant dimensions (Bergstra & Bengio 2012 showed this for hyperparameter tuning). For a handful of parameters, both work.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Grid search is exponential in the number of parameters. 100 grid points per axis across 10 parameters means 100^10 = 10^20 evaluations. Across a million parameters (a small neural network), the grid has more points than atoms in the observable universe. Random search scales better but has no direction: each sample is independent of the last, so a million evaluations tell you nothing about where to look next.',
        'Both methods treat the loss as a black box. They never ask "which way is downhill?" That question has an answer: the gradient. Ignoring it wastes exponentially more compute than using it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Batch gradient descent computes the update using the full dataset. Start at a random parameter vector theta. Compute the average loss over all n training examples. Compute the gradient of that average loss with respect to every parameter. Update: theta <- theta - alpha * gradient_of_L(theta). Repeat. Alpha is the learning rate. Each step scans the entire dataset, so the gradient is exact but expensive.',
        'Stochastic gradient descent (Robbins and Monro, 1951) replaces the full-dataset gradient with the gradient from one randomly chosen example. The update is the same formula, but the gradient is noisy: it points roughly downhill on average, but any single step may point sideways or even uphill. The tradeoff: each step costs O(1) instead of O(n), so SGD can take n steps in the time batch GD takes one.',
        'Mini-batch SGD splits the difference. Sample a batch of B examples (typically 32 to 512), compute the average gradient over the batch, update. The gradient is less noisy than single-sample SGD and far cheaper than full-batch. This is what practitioners mean by "training": mini-batch SGD over shuffled data for many epochs.',
        'Learning rate schedules change alpha during training. A common pattern is warmup (start small, ramp up over the first few thousand steps) followed by cosine decay (gradually shrink alpha toward zero). The warmup prevents early steps from overshooting when the initial gradients are unreliable. The decay lets the optimizer settle into a minimum instead of bouncing around it.',
        'Momentum (Polyak, 1964) adds a velocity term: v <- beta * v - alpha * gradient; theta <- theta + v. With beta = 0.9, 90% of the previous velocity carries forward. Steps that consistently point in the same direction accelerate. Steps that oscillate (because the loss surface is elongated) get dampened. Momentum turns zig-zag paths into smoother curves toward the minimum.',
        'Adam (Kingma and Ba, 2015) combines momentum with per-parameter learning rate adaptation. It tracks both the mean gradient (first moment) and the mean squared gradient (second moment), then scales each parameter update by the ratio. Parameters with consistently large gradients get smaller effective learning rates; parameters with small gradients get larger ones. Adam is the default optimizer for most deep learning because it requires less learning rate tuning than SGD with momentum.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The gradient of a differentiable function at a point is a vector that points in the direction of steepest local increase. Moving opposite the gradient is the steepest local decrease. For a convex loss, every local minimum is the global minimum, so steepest descent eventually reaches it.',
        'The convergence rate depends on the problem. For a convex loss with Lipschitz-continuous gradients and a fixed learning rate alpha = 1/L (where L is the gradient Lipschitz constant), batch GD converges at rate O(1/T): after T steps, the gap to the optimum shrinks as 1/T. For strongly convex losses (the loss curves upward everywhere by at least a constant mu), convergence is linear: the gap shrinks by a constant factor each step, so O(log(1/epsilon)) steps reach epsilon accuracy.',
        'SGD converges at rate O(1/sqrt(T)) for convex losses because the gradient noise prevents the step size from shrinking as fast. The noise also has a benefit: for non-convex losses (like neural networks), stochastic gradients help escape sharp minima and saddle points. Empirically, SGD with momentum often finds flatter minima that generalize better than the sharp minima batch GD settles into.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'One gradient descent step requires one forward pass (compute the loss) and one backward pass (compute the gradient via backpropagation). The backward pass costs roughly 2 to 3 times the forward pass because it must propagate gradients through every layer and store intermediate activations.',
        'Batch GD: one step costs O(n) where n is the dataset size, because it sums gradients over all examples. For a dataset of 1 million examples, one step processes all 1 million. SGD: one step costs O(1) since it uses a single example, but it needs many more steps because each gradient is noisy. Mini-batch SGD with batch size B: one step costs O(B), typically 32 to 512.',
        'Memory cost depends on the optimizer. Plain SGD stores one copy of the parameters. Momentum adds one velocity vector (2x parameter memory). Adam stores the first moment, second moment, and parameters (3x parameter memory). For a 7-billion-parameter model at 32-bit precision, parameters alone are 28 GB; Adam triples that to 84 GB. This is why large-model training uses mixed precision and optimizer state sharding.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Every neural network ever trained used some variant of gradient descent. Image classifiers (ResNet, ConvNeXt), language models (GPT, LLaMA), speech recognizers (Whisper), diffusion models (Stable Diffusion), protein structure predictors (AlphaFold) all reach their parameters through gradient descent on a loss function.',
        'Outside deep learning, gradient descent trains logistic regression, linear regression (when the normal equation is too expensive), support vector machines (via subgradient methods), and matrix factorization for recommender systems. Reinforcement learning uses policy gradients to optimize expected reward. Differentiable physics simulators backpropagate through simulation steps to tune control parameters.',
        'The pattern that makes gradient descent the right tool: the objective is differentiable (or can be made differentiable with relaxations), the parameter space is continuous, and the number of parameters makes exhaustive search impossible.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Saddle points. In high-dimensional non-convex landscapes, saddle points (where the gradient is zero but the point is neither a minimum nor a maximum) vastly outnumber local minima. The gradient vanishes, and plain gradient descent stalls. Momentum and Adam help escape saddle points because accumulated velocity carries the optimizer through the flat region.',
        'Plateau regions and vanishing gradients. Deep networks with sigmoid or tanh activations can produce near-zero gradients in early layers, so parameters stop updating. ReLU activations, residual connections, and careful initialization (He or Xavier) are engineering responses to this failure.',
        'Learning rate sensitivity. Too large and the loss explodes. Too small and training takes forever. The optimal learning rate depends on the loss surface curvature, which changes during training. This is why learning rate schedules, warmup, and adaptive methods (Adam) exist: they automate what would otherwise require constant manual tuning.',
        'Local minima in non-convex losses. Gradient descent settles into whatever basin it falls into. Different random initializations can reach different minima with different generalization behavior. Ensemble methods, multiple restarts, and stochastic noise (from mini-batching) are partial mitigations, not guarantees.',
        'Optimizing the wrong objective. If the loss function does not capture what you actually want, gradient descent minimizes it faithfully and produces a model that is precisely wrong. Label noise, data leakage, distribution shift, and reward hacking are all cases where the optimizer succeeds but the system fails.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Minimize f(x) = x^2 + 4x + 4. This factors as (x + 2)^2, so the minimum is at x = -2 where f(-2) = 0. The derivative is f\'(x) = 2x + 4. Start at x = 4 with learning rate alpha = 0.1.',
        'Step 1: f\'(4) = 2(4) + 4 = 12. Update: x = 4 - 0.1 * 12 = 2.8. Loss: f(2.8) = (2.8 + 2)^2 = 23.04.',
        'Step 2: f\'(2.8) = 2(2.8) + 4 = 9.6. Update: x = 2.8 - 0.1 * 9.6 = 1.84. Loss: f(1.84) = (1.84 + 2)^2 = 14.7456.',
        'Step 3: f\'(1.84) = 2(1.84) + 4 = 7.68. Update: x = 1.84 - 0.1 * 7.68 = 1.072. Loss: f(1.072) = (1.072 + 2)^2 = 9.437.',
        'Step 4: f\'(1.072) = 2(1.072) + 4 = 6.144. Update: x = 1.072 - 0.1 * 6.144 = 0.4576. Loss: f(0.4576) = (0.4576 + 2)^2 = 6.040.',
        'Step 5: f\'(0.4576) = 2(0.4576) + 4 = 4.9152. Update: x = 0.4576 - 0.1 * 4.9152 = -0.0339. Loss: f(-0.0339) = (-0.0339 + 2)^2 = 3.866.',
        'After 5 steps, x moved from 4 to -0.034, closing most of the distance to the minimum at x = -2. The loss dropped from f(4) = 36 to f(-0.034) = 3.87. Each step takes a smaller bite because the gradient shrinks as x approaches the minimum: the first gradient was 12, the fifth was 4.9. The pattern: x_new = x - 0.1 * (2x + 4) = 0.8x - 0.4. Each step contracts the distance to -2 by a factor of 0.8. After 20 steps, x reaches approximately -1.96, within 0.04 of the minimum.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Cauchy, "Methode generale pour la resolution des systemes d\'equations simultanees," 1847 (gradient descent invented). Robbins and Monro, "A Stochastic Approximation Method," Annals of Mathematical Statistics, 1951 (SGD foundations). Polyak, "Some methods of speeding up the convergence of iteration methods," USSR Computational Mathematics and Mathematical Physics, 1964 (momentum). Kingma and Ba, "Adam: A Method for Stochastic Optimization," ICLR, 2015. Ruder, "An Overview of Gradient Descent Optimization Algorithms," arXiv:1609.04747, 2016 (comprehensive modern survey).',
        'Prerequisite gaps: Loss Functions (what gradient descent minimizes), Backpropagation (how gradients are computed through a network via the chain rule). Natural extensions: Adam Optimizer (adaptive per-parameter learning rates), Learning Rate Schedules (warmup, cosine decay, step decay). Production versions: mixed-precision training, gradient accumulation, distributed data parallelism. Contrasting alternatives: evolutionary strategies (gradient-free optimization), Bayesian optimization (for expensive black-box objectives), second-order methods like L-BFGS (use curvature information but do not scale to billions of parameters).',
      ],
    },
  ],
};
