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
      heading: 'Why this exists',
      paragraphs: [
        'Gradient descent exists because most useful models have too many parameters to tune by hand and no closed-form solution for the best setting. A neural network may have billions of weights. A recommendation model, logistic regressor, or differentiable simulator may have enough parameters that trial-and-error search is hopeless.',
        'The way out is to define a loss: one number that says how wrong the model is on the current data. If changing a parameter slightly would raise the loss, move the parameter the other way. Repeat that simple local move many times, and the model gradually becomes less wrong.',
        'This is why gradient descent sits underneath so much modern machine learning. Backpropagation supplies the gradient efficiently. The optimizer decides how to use it. The animation shows one weight and one curve because the real idea is easier to see in one dimension before it becomes a billion-dimensional training run.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is random search: try many settings, keep the best one, and hope. That collapses as dimensions grow. Ten choices for each of a billion weights is not a search space; it is a refusal to train.',
        'A second approach is manual tuning. That can work for a two-parameter toy model, but it cannot coordinate millions of interacting weights. A weight that helps one example may hurt another, and a hidden-layer weight only matters through everything downstream of it.',
        'A third shortcut is to solve for the optimum directly. Some convex models allow this, but deep networks, large recommenders, policy models, and differentiable pipelines usually do not. Gradient descent trades a perfect one-shot answer for a cheap local step that can be repeated at scale.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that the gradient is a local instruction. It tells how the loss would change if the parameter moved a little. A positive gradient means increasing the parameter raises loss, so the update moves left. A negative gradient means increasing the parameter lowers loss, so the update moves right.',
        'The update is w = w - learning_rate * gradient. The minus sign is the whole idea: move opposite the slope. The learning rate decides how much to trust that local slope before measuring again.',
        'In many dimensions, the gradient is a vector with one component per parameter. It points in the direction of steepest local increase in loss, so the negative gradient points downhill. Training is not magic; it is repeated measurement and correction.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A training step has three phases. First, the forward pass turns inputs into predictions and a scalar loss. Second, reverse-mode autodiff applies the chain rule from the loss back to every parameter. Third, the optimizer updates the parameters using those gradients.',
        'Full-batch gradient descent measures the gradient over the entire dataset before each update. That is often too expensive. Stochastic or minibatch gradient descent estimates the gradient from a sample of examples, making each step cheaper and noisier.',
        'Practical optimizers add memory and control. Momentum averages recent directions. RMSProp and Adam track gradient scale. AdamW separates weight decay from the gradient update. Learning-rate schedules and warmup change step size over time so training can move quickly early and settle later.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The dot is the current parameter value, the curve is the loss, and the arrow is the update. When the dot is left of the minimum, the slope points uphill to the left, so the update moves right. When the dot is right of the minimum, the update moves left.',
        'The large learning-rate setting proves that the formula can be correct and still fail. If the step is too large for the curvature of the loss surface, the update overshoots the valley, lands higher, and may diverge. Learning rate is not decoration; it is the control knob that decides whether the local slope is useful.',
        'The shrinking steps near the bottom prove another important fact. The gradient gets smaller on flatter terrain, so plain gradient descent naturally takes smaller steps as it approaches a smooth minimum. Real training adds schedules because noisy, high-dimensional loss surfaces need more control than this toy parabola.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Gradient descent works when the loss is differentiable enough that local slope contains useful information about nearby points. The algorithm does not need to understand the whole surface. It only needs the current loss, the current gradient, and a step size small enough that the local approximation remains useful.',
        'Backpropagation makes the method practical for deep networks. The chain rule reuses intermediate derivatives so the cost of computing all parameter gradients is roughly a small multiple of the forward pass, rather than one separate experiment per weight.',
        'Minibatch noise can help rather than merely hurt. A noisy gradient is less exact, but it is much cheaper, and the noise can keep training from settling too early in sharp or brittle regions. This is one reason training curves are judged by trends and validation behavior, not by every individual step.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Each step costs roughly one forward pass plus one backward pass. The backward pass is often about twice the forward compute because it must propagate gradients and store or recompute activations. Large models repeat that loop over enormous datasets, so a simple update rule becomes an expensive training job.',
        'The main tradeoff is step quality versus step cost. Larger batches estimate the true gradient better but cost more memory and compute per update. Smaller batches are cheaper and noisier. Adam-style optimizers can reduce tuning pain but store extra moment tensors for every parameter, increasing memory pressure.',
        'The learning rate is the dangerous dial. Too low wastes compute; too high overshoots and can make loss explode. Schedules, warmup, gradient clipping, weight decay, early stopping, and validation checks are the control system around the basic update.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Gradient descent wins whenever the objective is differentiable and parameters are too numerous for direct search. It trains image classifiers, language models, speech recognizers, diffusion models, retrieval embeddings, matrix factorization systems, recommender rankers, and logistic regression models.',
        'It also appears outside ordinary supervised learning. Reinforcement-learning systems descend policy-gradient losses. Differentiable physics and graphics tune parameters through simulation. Representation-learning systems optimize contrastive losses so related items move closer in embedding space.',
        'The method is most powerful when paired with a good loss, clean data, and a model class that can represent the task. Gradient descent is an optimizer, not a guarantee that the objective is worth optimizing.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The biggest misconception is that gradient descent guarantees the global optimum. It can under some convex losses with careful step sizes. Deep networks are non-convex, so the practical promise is weaker: find a useful low-loss region, not prove the best possible parameters.',
        'Another mistake is expecting loss to fall on every minibatch. Stochastic gradients are noisy. Short-term loss can rise while the long-term trend improves. Watch validation curves, moving averages, and downstream metrics rather than overreacting to one update.',
        'A deeper failure is optimizing the wrong thing. If labels leak, targets are noisy, the data distribution is wrong, or the loss rewards the wrong behavior, more training only improves the wrong objective. Many training failures are specification and data failures wearing optimizer clothing.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Read Backpropagation for the gradient engine, then Momentum, RMSProp & Adam for practical optimizer variants. Learning-Rate Schedules & Warmup and Early Stopping & Patience explain the control loop around training. Activations as 3D Origami shows why nonlinear layers reshape the surface, while The Loss Landscape, in 3D shows the terrain these updates actually cross. Then study Regularization: L1 & L2, Dropout, Logistic Regression, and Neural Network Forward Pass.',
      ],
    },
  ],
};
