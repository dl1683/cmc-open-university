// Activation functions: the nonlinearity that lets neural networks learn
// curves instead of lines. Sigmoid, tanh, ReLU — same job, different rules.

import { plotState } from '../core/state.js';

export const topic = {
  id: 'activation-functions',
  title: 'Activation Functions',
  category: 'AI & ML',
  summary: 'Sigmoid, tanh, and ReLU compared on one chart — and why networks need nonlinearity at all.',
  controls: [
    { id: 'focus', label: 'Spotlight', type: 'select', options: ['tour all three', 'sigmoid', 'tanh', 'relu'], defaultValue: 'tour all three' },
  ],
  run,
};

const FUNCS = [
  {
    id: 'sigmoid', label: 'sigmoid', fn: (x) => 1 / (1 + Math.exp(-x)),
    blurb: 'SIGMOID squashes everything into (0, 1) — readable as a probability, which is why it still ends binary classifiers. Its flaw: for |x| > 4 the curve is nearly FLAT, so the gradient is nearly zero. Stack many sigmoid layers and gradients vanish on the way back — early deep nets simply stopped learning.',
  },
  {
    id: 'tanh', label: 'tanh', fn: (x) => Math.tanh(x),
    blurb: 'TANH is sigmoid\'s centered sibling: range (−1, 1), zero in the middle. Zero-centered outputs make optimization smoother, which is why tanh ruled the RNN era. Same disease though: flat tails, vanishing gradients.',
  },
  {
    id: 'relu', label: 'ReLU', fn: (x) => Math.max(0, x),
    blurb: 'ReLU is almost insultingly simple — max(0, x) — and it won. The positive side has slope exactly 1 forever: gradients flow undiminished through dozens of layers, which is a big part of why deep learning got DEEP. Its flaw: a neuron stuck on the negative side outputs 0 with 0 gradient — permanently dead. Fixes like Leaky ReLU and GELU (used in Transformers) soften that corner.',
  },
];

const xs = Array.from({ length: 81 }, (_, i) => -6 + i * 0.15);
const series = (subset) => subset.map((f) => ({
  id: f.id,
  label: f.label,
  points: xs.map((x) => ({ x, y: f.fn(x) })),
}));
const AXES = { x: { label: 'input x' }, y: { label: 'output' } };

export function* run(input) {
  const focus = String(input.focus);

  yield {
    state: plotState({ axes: AXES, series: series([]).concat([{ id: 'line', label: 'no activation (line)', points: xs.map((x) => ({ x, y: x / 6 })) }]) }),
    highlight: { active: ['line'] },
    explanation: 'First, the WHY. A neural layer computes weights × inputs — a linear function. Stack a hundred linear layers and you still get… one linear function. A network with no activation can only ever draw straight lines, no matter how big it is. The activation function is the bend between layers that makes deep learning expressive.',
  };

  const chosen = focus === 'tour all three' ? FUNCS : FUNCS.filter((f) => f.id === focus);
  const shown = [];
  for (const f of chosen) {
    shown.push(f);
    yield {
      state: plotState({ axes: AXES, series: series(focus === 'tour all three' ? shown : chosen) }),
      highlight: { active: [f.id], visited: shown.slice(0, -1).map((s) => s.id) },
      explanation: f.blurb,
      invariant: 'What matters for training is the SLOPE: gradient descent can only learn through regions where the curve isn\'t flat.',
    };
  }

  yield {
    state: plotState({ axes: AXES, series: series(FUNCS) }),
    highlight: {},
    explanation: 'All three on one chart. Read them as gradient highways: sigmoid and tanh choke off traffic at the edges; ReLU keeps one lane wide open forever. History in one picture — sigmoid (1990s) → tanh (2000s RNNs) → ReLU (2012, AlexNet) → GELU, a smoothed ReLU, inside today\'s Transformers. One bend between matrix multiplies, and it decides whether a hundred-layer network can learn at all. (These curves live on a 2D chart because the function IS 2D — but a real layer bends a high-dimensional space; that surface view is where richer visuals would shine.)',
  };
}
