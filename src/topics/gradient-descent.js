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
