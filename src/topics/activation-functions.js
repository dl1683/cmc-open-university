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

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `An activation function is a nonlinear transformation applied to the output of each neuron in a neural network. It sits between layers and introduces curvature — without it, stacking a hundred linear layers still produces a single linear function, unable to learn any curved relationship in data. Activation functions like sigmoid, tanh, and ReLU apply a nonlinear bend to each neuron's weighted sum, allowing the network to express complex patterns. The choice of activation function shapes which networks can train efficiently and how deep they can go.`,
        `Different activation functions suit different problems. Sigmoid squashes values to (0, 1) and was historically used in the final layer of binary classifiers. Tanh squashes to (-1, 1), zero-centered, favored in recurrent networks. ReLU (rectified linear unit) is max(0, x) — almost insultingly simple — and is now standard in nearly every deep architecture because its constant gradient (slope = 1 on the positive side) allows learning to flow unimpeded through dozens of layers.`
      ]
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Sigmoid is defined as 1 / (1 + exp(-x)). It squashes the entire real line into (0, 1), with an S-shaped curve. The curve is steep near x = 0 and flat for |x| > 4, so gradients (slopes) are small at the extremes. When you backpropagate through many sigmoid layers, gradients multiply together (chain rule), and each one is less than 1, causing products to shrink exponentially — this is the vanishing gradient problem that crippled deep learning in the 1990s.`,
        `Tanh is defined as (exp(x) - exp(-x)) / (exp(x) + exp(-x)) — a shifted, scaled sigmoid that outputs (-1, 1) instead of (0, 1). Being zero-centered (mean output = 0) helps optimization but suffers the same vanishing gradient problem on the tails. ReLU (rectified linear unit) is max(0, x) — zero for negative inputs, identity for positive. The gradient is 0 for x less than 0 and 1 for x greater than 0, so it never shrinks. Backpropagating through hundreds of ReLU layers, gradients stay large and flow undiminished. The cost: neurons that get stuck in the negative region (dead neurons) output 0 forever with zero gradient, unable to recover. Leaky ReLU (0.01x for x less than 0) and GELU (a smooth approximation to ReLU) fix this.`
      ]
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Evaluating an activation function is O(n) in the number of neurons: one exponential or max operation per neuron. Sigmoid and tanh require computing exp(), slightly more expensive than ReLU's simple max. For a layer with millions of neurons (common in modern networks), this is still negligible compared to the preceding matrix multiplication. The real cost is in backpropagation: gradients flow through the activation function's derivative. ReLU's derivative (1 or 0) is cheap; sigmoid and tanh require recomputing the exponential or storing intermediate values. In practice, ReLU's gradient efficiency (not having to shrink) matters more than raw compute cost.`
      ]
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Sigmoid is still used in binary classification (the final layer outputs probability 0-1) and in gating mechanisms within LSTMs and GRUs. Tanh similarly gates information in recurrent architectures. ReLU and its variants (Leaky ReLU, ELU, GELU) dominate modern deep learning: every Transformer uses GELU (a smooth ReLU) in its feedforward layers, every ResNet uses ReLU, every modern CNN uses ReLU or a variant. The shift happened around 2012 when AlexNet won ImageNet using ReLU and demonstrated that deep, ReLU-based networks could learn from large datasets without vanishing gradients.`,
        `Beyond these classics, researchers use Swish (x * sigmoid(x)), Mish, and others in specialized domains. The choice of activation function is now rarely a major hyperparameter — ReLU works universally well — but understanding why (gradient flow, nonlinearity) is essential for designing and debugging deep networks.`
      ]
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A widespread misconception: more complicated activations are better. Sigmoid sounds fancy and matches human intuition (squashing to probabilities), but it causes training to fail at depth. ReLU's simplicity is not laziness; it is sophistication in disguise — it solves the gradient problem elegantly. For hidden layers, default to ReLU; only use sigmoid or tanh if you have a specific reason (gating, probability bounds).`,
        `Another pitfall: confusing activation functions with normalization. Batch normalization also helps gradients flow, but it works alongside activation functions, not instead of them. A network with no activation (all linear) still cannot learn curves, even with perfect normalization.`,
        `Finally, dead neurons in ReLU are easy to dismiss but can silently degrade a network. If a large fraction of neurons output 0 forever, you've wasted capacity. Monitoring neuron sparsity (fraction of activations that are 0) is good practice; if sparsity creeps above 50%, consider Leaky ReLU or GELU.`
      ]
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Understand why gradient flow matters by studying Gradient Descent — it shows how networks learn through backpropagation. Study Attention Mechanism to see GELU in action (used in all modern Transformers). For deeper understanding, research the vanishing gradient problem and how ReLU solved it; read papers on LSTM and GRU, which gate information using sigmoid and tanh. Learn about batch normalization, which works hand-in-hand with activation functions. When you are ready, experiment with different activations in a small network and observe training dynamics: ReLU converges faster, while sigmoid may stall. For a mathematical view, study how activation functions affect the Lipschitz constant of neural networks and how that impacts generalization.`
      ]
    }
  ]
};
