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
      heading: `What it is`,
      paragraphs: [
        `Gradient descent is the workhorse update rule behind modern machine learning: define a loss, measure how each weight changes that loss, then nudge the weights downhill. The one-line rule is w = w - learning_rate * gradient. Backpropagation supplies the gradient efficiently; gradient descent chooses the step. That distinction matters. Backprop is bookkeeping through the computation graph, while the optimizer decides how aggressively to change the model.`,
        `The demo uses a friendly parabola, but real training lives on a high-dimensional surface with ridges, saddles, flat basins, and noisy minibatches. Neural networks rarely train with full-batch descent over the entire dataset. They use stochastic or minibatch gradient descent, so each step is a cheap, noisy estimate of the true slope. That noise is not merely tolerated; it often helps the optimizer escape sharp traps and settle into flatter regions that generalize better.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A training step has three phases. First, the Neural Network Forward Pass turns inputs into predictions and a scalar loss. Second, reverse-mode autodiff applies the chain rule from the loss back to every parameter. Third, the optimizer updates the parameters. Plain SGD uses the raw gradient. Momentum, RMSProp & Adam adds memory: momentum averages velocity, RMSProp tracks squared gradients, and Adam combines both with bias correction.`,
        `The learning rate is the dangerous dial. Too low wastes compute; too high overshoots and can make loss explode. Learning-Rate Schedules & Warmup solves this by starting cautiously, rising to a useful step size, then decaying so training can settle. Early Stopping & Patience adds a validation signal: stop when held-out loss stops improving, even if training loss keeps falling.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Each step costs roughly one forward pass plus one backward pass; the backward pass is often about 2x the forward compute because it must propagate gradients and save or recompute activations. A useful language-model rule of thumb is about 6 * parameters * training tokens floating-point operations. That puts GPT-3's 175B-parameter, 300B-token training run near 3e23 FLOPs, not because the update rule is complex but because the loop is repeated over enormous data. Memory also matters: optimizer state for Adam stores two extra moment tensors per parameter, which is why large training jobs fight memory as much as arithmetic.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every production neural model is trained by some descendant of this loop: ResNet image classifiers, BERT encoders, GPT-style language models, speech recognizers, diffusion models, recommenders, and CLIP-like contrastive systems. The details vary. Computer vision often uses SGD with momentum and weight decay. Transformers commonly use AdamW with warmup and cosine or linear decay. Reinforcement-learning systems may optimize policy-gradient losses, while retrieval models optimize contrastive losses over learned embedding spaces.`,
        `The same idea also appears outside deep nets: logistic regression, matrix factorization, and differentiable physics all choose parameters by descending a loss. The Loss Landscape, in 3D is the right mental model once the demo parabola feels too clean.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest misconception is that the algorithm guarantees the global optimum. It does for some convex losses under careful step-size conditions; deep networks are non-convex, so there is no such general promise. Another error is expecting loss to decrease every minibatch. With stochastic gradients, short-term loss can rise while the long-term trend improves. That is normal; watch validation curves and moving averages.`,
        `A second trap is blaming the optimizer for data or model problems. If features leak labels, if targets are noisy, or if the architecture cannot represent the task, more steps only polish the wrong objective. Regularization: L1 & L2, dropout, and better data splits often matter more than changing optimizers.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Backpropagation for the gradient engine, then Momentum, RMSProp & Adam for practical optimizer variants. Learning-Rate Schedules & Warmup and Early Stopping & Patience explain the control loop around training. Activations as 3D Origami shows why nonlinear layers reshape the surface, while The Loss Landscape, in 3D shows the terrain these updates actually cross.`,
      ],
    },
  ],
};
