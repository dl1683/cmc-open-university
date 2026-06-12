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
      heading: 'What it is',
      paragraphs: [
        `Gradient descent is the algorithm that trains neural networks. Given a loss function that measures how wrong a model is, gradient descent repeatedly computes the slope (gradient) of the loss with respect to the model's weights and takes a step in the opposite direction — downhill. After thousands or millions of steps, the loss becomes small (the model becomes accurate), and training stops. The mechanism is elegantly simple: follow the steepest downhill direction until you reach a valley.`,
        `The core update rule is just one line: new_weight = old_weight - learning_rate * gradient. The learning rate is a scalar that controls how big each step is. Too small and training is slow. Too large and the algorithm bounces around the valley and diverges. This one hyperparameter, tuned by hand or by second-order methods, is the difference between convergence and collapse.`
      ]
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Gradient descent requires three ingredients: a loss function (measuring error), a way to compute its gradient with respect to each weight (backpropagation via the chain rule), and a learning rate to scale the step. In the demo, the loss is the simple parabola (w - 3)^2 + 1, with a global minimum at w = 3 and gradient 2(w - 3). In real neural networks, the loss is a function of billions of weights, computed via billions of operations, but the gradient is computed automatically by frameworks like PyTorch and TensorFlow using reverse-mode autodiff (backpropagation).`,
        `The algorithm is iterative: compute the loss and gradient for the current weights, take a step opposite the gradient, and repeat. Early in training, far from the minimum, gradients are large and steps are large. Near the minimum, gradients are small and steps shrink automatically, allowing fine-grained convergence. If the learning rate is well-tuned, the trajectory spirals into the valley and loss monotonically decreases. If the learning rate is too large (like 1.05 in the demo), the algorithm bounces across the valley, overshooting repeatedly, and loss diverges to infinity.`
      ]
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Gradient descent's cost per iteration is one forward pass (computing loss) and one backward pass (computing gradients). For a neural network with P parameters on a batch of N inputs, backpropagation costs roughly 2-3x the forward pass (one multiply-accumulate per weight and operation, done twice — once forward, once backward). Modern neural networks have P in the billions, and datasets have N in the millions, so each training step costs billions of floating-point operations. The total cost of training is iterations x cost_per_iteration: a modern language model might run 300 billion steps at 10^11 FLOPs per step, totaling ~10^21 FLOPs (petaflop-days of compute). Convergence speed depends on the loss surface geometry (steep early, plateau later) and the learning rate choice.`
      ]
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Gradient descent, or variants of it, trains every neural network in production: GPT models, image classifiers (ResNets, Vision Transformers), speech models, recommendation systems, everything. The variants matter: stochastic gradient descent (SGD) uses one or a small batch of examples per step instead of the full dataset, trading gradient accuracy for speed and is now standard. Momentum-based methods (SGD with momentum, Adam) accumulate past gradients to accelerate convergence in the face of plateaus and oscillations. Adam is especially popular because it adapts the per-parameter learning rate automatically, reducing the need for manual tuning.`,
        `Beyond supervised learning, gradient descent applies to any problem where you can define a loss. Reinforcement learning uses policy gradients. Generative models use adversarial losses. Contrastive learning (SimCLR, CLIP) uses distance losses on embeddings. The core loop — compute gradient, step opposite it — is universal.`
      ]
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A widespread misconception: gradient descent always finds the global optimum. It does not. In high-dimensional loss surfaces (billions of dimensions), there are many local minima, saddle points, and plateaus. The algorithm converges to whatever local minimum it finds first, which depends on the initialization and learning rate schedule. Recent research suggests that in neural networks, many local minima are equally good (have similar loss), so this is less catastrophic than it sounds, but it is not a global guarantee.`,
        `Another pitfall: confusing the learning rate with the gradient magnitude. A large gradient does not require a large learning rate — the learning rate is a separate tuning dial. If the gradient is large, the step is large; if you also set a large learning rate, the step becomes huge, causing divergence. Frameworks often use adaptive methods (Adam) to mitigate this, but manual learning rate scheduling (starting large, decaying over time) is still needed in practice.`,
        `Finally, gradient descent does not work without a differentiable loss. If you want to train a neural network for something discrete (like discrete choice problems or combinatorial optimization), you need to relax the problem to a continuous approximation first, or use reinforcement learning (policy gradients) instead.`
      ]
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Explore Activation Functions next to understand why gradients vanish or explode in deep networks — a problem gradient descent must solve through careful architecture. Learn about Softmax & Temperature to see how loss functions are designed for classification (cross-entropy with softmax). If you want to understand modern optimization, research adaptive methods like Adam, momentum, and learning rate schedules — they all extend this core idea. For a deeper look at loss surfaces, study loss landscape visualization papers or experiment with varying the loss function shape. When you are ready, study Attention Mechanism to see what modern neural networks look like beyond simple MLPs, and read about Embeddings & Similarity to understand how neural networks learn representations that gradient descent optimizes.`
      ]
    }
  ]
};
