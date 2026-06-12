// A neural network forward pass, number by number: a tiny 2-3-1 network
// turns two inputs into one prediction. Matrix multiply, add bias, bend,
// repeat — that is the entire secret.

import { matrixState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'nn-forward-pass',
  title: 'Neural Network Forward Pass',
  category: 'AI & ML',
  summary: 'Watch two inputs flow through a tiny 2-3-1 network: weights, biases, ReLU, prediction.',
  controls: [
    { id: 'inputs', label: 'Inputs x₁, x₂', type: 'number-list', defaultValue: '2, -1' },
  ],
  run,
};

// Fixed "trained" weights. In a real model these came from Gradient Descent;
// here they are frozen so every run is reproducible and checkable by hand.
const W1 = [
  [0.5, -0.6, 0.8],
  [0.4, 0.9, -0.3],
];
const B1 = [0.1, -0.2, 0.05];
const W2 = [[0.7], [-0.5], [0.6]];
const B2 = [0.15];

const relu = (x) => Math.max(0, x);
const round2 = (x) => Math.round(x * 100) / 100;

export function* run(input) {
  const [x1, x2] = parseNumberList(input.inputs, { min: 2, max: 2, label: 'inputs' }).map(round2);

  const hiddenCols = [0, 1, 2].map((j) => ({ id: `h${j}`, label: `h${j + 1}` }));
  const inputCols = [{ id: 'x1', label: 'x₁' }, { id: 'x2', label: 'x₂' }];

  yield {
    state: matrixState({
      title: 'Layer 1 weights W₁ (inputs × hidden neurons)',
      rows: inputCols.map((c) => ({ id: `r${c.id}`, label: c.label })),
      columns: hiddenCols,
      values: W1,
    }),
    highlight: {},
    explanation: `A neural network is layers of numbers. This one has 2 inputs, 3 hidden neurons, 1 output — and these are its first-layer WEIGHTS: column j holds what hidden neuron j pays attention to. Weight w[i][j] means "how much input i matters to neuron j". Training (see Gradient Descent) is nothing more than nudging these numbers; today they're frozen so we can watch data flow.`,
  };

  const z = [0, 1, 2].map((j) => round2(x1 * W1[0][j] + x2 * W1[1][j] + B1[j]));
  yield {
    state: matrixState({
      title: 'Hidden pre-activations z = x·W₁ + b₁',
      rows: [{ id: 'z', label: 'z' }],
      columns: hiddenCols,
      values: [z],
    }),
    highlight: { active: hiddenCols.map((c) => c.id) },
    explanation: `Feed in x = [${x1}, ${x2}]. Each hidden neuron computes a WEIGHTED SUM of the inputs plus its bias: z₁ = ${x1}×${W1[0][0]} + ${x2}×${W1[1][0]} + ${B1[0]} = ${z[0]}; same recipe gives z₂ = ${z[1]}, z₃ = ${z[2]}. So far this is pure linear algebra — and a stack of ONLY these steps could never learn a curve.`,
    invariant: 'Every neuron = weighted sum of the previous layer + bias, then a nonlinearity.',
  };

  const a = z.map(relu).map(round2);
  const clipped = z.map((v, j) => (v < 0 ? `h${j}` : null)).filter(Boolean);
  yield {
    state: matrixState({
      title: 'Hidden activations a = ReLU(z)',
      rows: [{ id: 'a', label: 'a' }],
      columns: hiddenCols,
      values: [a],
    }),
    highlight: clipped.length ? { removed: clipped } : {},
    explanation: `Now the bend: ReLU(z) = max(0, z) (see Activation Functions). ${clipped.length
      ? `Neuron${clipped.length > 1 ? 's' : ''} ${clipped.map((id) => Number(id.slice(1)) + 1).join(' and ')} computed negative z, so ReLU silences ${clipped.length > 1 ? 'them' : 'it'} to exactly 0 — for THIS input, ${clipped.length > 1 ? 'those neurons' : 'that neuron'} simply doesn't participate. Different inputs wake different neurons; that input-dependent routing is where the network's expressive power lives.`
      : `All three z values were positive, so they pass through unchanged this time — but feed in different inputs and some neurons will be silenced to 0. That input-dependent switching is the nonlinearity doing its job.`}`,
  };

  const out = round2(a[0] * W2[0][0] + a[1] * W2[1][0] + a[2] * W2[2][0] + B2[0]);
  yield {
    state: matrixState({
      title: 'Output = a·W₂ + b₂',
      rows: [{ id: 'out', label: 'ŷ' }],
      columns: [{ id: 'y', label: 'prediction' }],
      values: [[out]],
    }),
    highlight: { active: ['out:y'] },
    explanation: `The output layer is the same recipe once more: ŷ = ${a[0]}×${W2[0][0]} + ${a[1]}×${W2[1][0]} + ${a[2]}×${W2[2][0]} + ${B2[0]} = ${out}. For classification you'd push this through Softmax & Temperature to get probabilities; for regression, ${out} IS the answer.`,
  };

  yield {
    state: matrixState({
      title: 'The whole network, end to end',
      rows: [{ id: 'flow', label: 'x→ŷ' }],
      columns: [
        { id: 'in', label: `[${x1}, ${x2}]` },
        { id: 'hid', label: `[${a.join(', ')}]` },
        { id: 'pred', label: String(out) },
      ],
      values: [[0.2, 0.55, 0.95]],
    }),
    highlight: {},
    explanation: `That's a complete forward pass: multiply, add, bend — twice. Everything else is scale: GPT-class models do this exact dance with thousands of dimensions per layer and ~100 layers, mixing in Attention Mechanism blocks between the multiplies. And when the prediction is wrong, the error flows BACKWARD through these same weights to compute the nudge each one needs — gradient descent's backpropagation, the other half of the story.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `A neural network is a stack of matrix multiplies and bends. This 2-3-1 network has 2 inputs, 3 hidden neurons, and 1 output. You feed inputs through a first layer (multiply by W₁, add bias b₁, apply ReLU), then through a second layer (multiply by W₂, add bias b₂) to get a prediction. The weights are frozen here so you can trace the numbers: input [2, -1] flows through hidden activations to a single prediction. In a real model, Gradient Descent would tune these 13 numbers (6 + 3 weights, 4 biases) on thousands of examples until the predictions are correct.`,
        `Scale matters only in degree, not kind. Replace "2 inputs" with 12,288 embeddings, "3 hidden" with 4,096 dimensions, add 100 layers and Attention Mechanism blocks, and you have a 7 billion-parameter GPT model. The forward pass is identical: multiply, add bias, bend, repeat. Everything is the same recipe played at different scales.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Given x₁ = 2, x₂ = -1, compute the hidden layer: each neuron j sums weighted inputs plus bias. Neuron 1: z₁ = 2·(0.5) + (-1)·(0.4) + 0.1 = 0.3. Neuron 2: z₂ = 2·(-0.6) + (-1)·(0.9) - 0.2 = -2.3. Neuron 3: z₃ = 2·(0.8) + (-1)·(-0.3) + 0.05 = 1.95. Then ReLU clips negatives to zero: a = [0.3, 0, 1.95]. That input-dependent routing (neuron 2 silenced) is where nonlinearity lives — different inputs activate different neurons.`,
        `The output layer repeats the recipe: ŷ = 0.3·(0.7) + 0·(-0.5) + 1.95·(0.6) + 0.15 ≈ 1.41. For classification, pass through Softmax & Temperature to get probabilities; for regression, that number is your answer. Every neuron (except inputs) computes: weighted sum → add bias → nonlinearity → becomes input to the next layer. No loops, no hidden state — just linear algebra with a bend in the middle.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `This network does 9 multiplications and 10 additions per forward pass. Modern hardware handles millions per second, so inference is fast. Memory is the bottleneck: a 7B-parameter GPT model's weights occupy ~28 GB of GPU memory alone. Store activations and gradients during training and you need 100+ GB. Quantizing weights to 4-bit integers cuts memory by 8×, barely hurting accuracy.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Every trained model runs forward passes: GPT for text, ResNets for images, transformers for sequences. Your phone runs them when you unlock with your face; banks run millions daily for fraud detection. When you talk to GPT, it runs a forward pass for each token it generates, using its frozen weights to predict the next word. The KV Cache trick stores old hidden states so you do not recompute them; but the core forward pass never changes.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Neurons are not intelligent — they are dumb weighted sums. Intelligence emerges from tuning thousands of them. ReLU silencing is not a bug; it is the feature: neurons contribute zero when their input is negative, creating input-dependent routing. ReLU is one of many bends — Softmax & Temperature, sigmoid, tanh, GELU each behave differently. Training is hard (months, millions of dollars for GPT); forward passes are mechanically simple.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Next, explore the bends that make learning possible: Activation Functions. Then learn Gradient Descent, which nudges weights backward from prediction errors. Master Attention Mechanism — the innovation that powers transformers — which mixes information across the entire input. For classification, use Softmax & Temperature to turn predictions into probabilities. For large models, KV Cache makes generation fast.`,
      ],
    },
  ],
};

