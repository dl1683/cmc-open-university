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
      heading: `What it is`,
      paragraphs: [
        `An activation function is the nonlinear bend between linear layers. Neural Network Forward Pass multiplies inputs by weights and adds biases; without a nonlinear activation between those matrix multiplies, a hundred layers still collapse to one linear function. The demo first draws that straight-line failure, then overlays sigmoid, tanh, and ReLU so you can read each curve as both an expressive bend and a gradient highway. The choice decides not just what the network can represent, but whether learning can pass through the representation at all.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Sigmoid maps every input into (0, 1), which is why Logistic Regression and binary output heads use it as a probability. Its hidden-layer problem is slope: for |x| above roughly 4, the curve is nearly flat. Backpropagation then multiplies tiny derivatives across layers, causing Vanishing & Exploding Gradients on the vanishing side. Tanh is zero-centered, which helps optimization because positive and negative activations balance, but its tails also flatten.`,
        `ReLU is max(0, x). On the positive side its derivative is exactly 1, so Gradient Descent can receive a strong signal through deep stacks. On the negative side the derivative is 0, which creates dead units if a neuron gets pushed permanently below zero. Leaky ReLU, ELU, Swish, and GELU soften that edge; modern transformers use GELU-like activations inside The Transformer Block. The demo stays 2-D because each activation is a one-input, one-output function, but real layers bend high-dimensional space.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Activation cost is O(neurons). Sigmoid and tanh require exponentials; ReLU is one max operation. That compute is small next to matrix multiplication, but the derivative behavior is decisive. A cheap activation with healthy slopes can train a deep model; a pretty activation with saturated tails can freeze it. Storing activations for the backward pass often costs more memory than evaluating the function itself.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Sigmoid remains common for binary probabilities and gates. Tanh appears in older recurrent networks and some bounded outputs. ReLU dominated CNNs after AlexNet because it made deep vision training practical. BatchNorm & LayerNorm often sit near activations to keep inputs in a useful scale range, while Activations as 3D Origami shows how these simple 1-D curves bend high-dimensional representation space. In practice, ReLU-family choices are defaults, not because they are fancy, but because their slopes are reliable.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Do not choose sigmoid for hidden layers just because probabilities feel intuitive; hidden units need trainable slopes, not probability semantics. Do not think normalization replaces activation; a perfectly normalized all-linear network is still linear. Do monitor ReLU sparsity, because many dead units mean wasted capacity, but some zeros are useful sparsity rather than a bug. More complex activations are not automatically better; the question is whether they improve optimization or generalization on your actual task.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `After this, connect the curves to forward passes, derivatives, gradient flow, and transformer feed-forward blocks. The lasting rule is simple: nonlinearity gives the model expressive power, but slope gives the optimizer a path to learn that power.`,
        `A good exercise is to sketch both the function and its derivative. The output curve tells you what values can flow forward; the derivative curve tells you where learning can flow backward. Hidden-layer activations live or die by the second sketch.`,
        `That is why the demo keeps returning to slope. Expressiveness without trainable slope is a promise the optimizer cannot collect before trusting it.`,
      ],
    },
  ],
};
