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
      heading: `What it is`,
      paragraphs: [
        `A forward pass is the computation a trained neural network runs to turn input numbers into output numbers. In this demo, the network has 2 inputs, 3 hidden neurons, and 1 output. It applies a first affine layer, a nonlinearity, and a second affine layer: xW1 + b1, then ReLU, then aW2 + b2. The 13 trainable parameters are 6 first-layer weights, 3 first-layer biases, 3 second-layer weights, and 1 output bias.`,
        `Nothing learns during a forward pass. The weights are fixed, and data flows left to right. Backpropagation is the separate reverse computation that later measures blame. Gradient Descent is the optimizer that changes weights using those gradients. In production, the same idea scales from a tiny fraud classifier to The Transformer Block inside a language model: multiply, add, normalize or activate, repeat.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `For input x = [2, -1], each hidden neuron computes a weighted sum plus bias. The demo's numbers give z1 = 0.7, z2 = -2.3, and z3 = 1.95 before the activation. ReLU, one of the core Activation Functions, keeps positive values and clips negatives to zero, so the hidden activation becomes [0.7, 0, 1.95]. That "zero" is not a bug; it is input-dependent gating. A different input might wake that second neuron and silence another.`,
        `The output layer repeats the same affine recipe: combine hidden activations with W2, add the output bias, and produce one prediction. For regression, the number itself can be the answer. For classification, logits usually pass through Softmax & Temperature to become probabilities. For deep networks, BatchNorm & LayerNorm may rescale activations between layers to keep distributions stable.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `For a dense layer with input width m and output width n, the main cost is O(mn) multiply-adds and O(mn) parameter storage. This tiny network performs 9 multiplications for the two weight matrices, plus bias additions and ReLU comparisons. A 7B-parameter model in fp16 stores about 14 GB of weights before activations, optimizer state, cache, or runtime overhead; fp32 would be about 28 GB. Quantization can store weights in 8-bit, 4-bit, or mixed formats, trading memory bandwidth and sometimes accuracy for speed.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every deployed neural model is mostly forward passes. A phone face-unlock model runs one over an image. A bank fraud model runs one over transaction features. A recommender scores user-item pairs. A language model runs one forward pass for the prompt prefill and then one smaller decode step per generated token. Attention Mechanism layers add token mixing, convolution layers add local image filters, and feed-forward layers add per-token transformations, but the execution mindset is the same: tensors flow through fixed learned parameters.`,
        `Training also uses forward passes. Each batch first runs forward to compute predictions and loss; only then does the backward pass compute gradients. Inference skips the backward half, which is why serving a model is usually much cheaper than training it.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `A neuron is not a miniature mind. It is a parameterized function: weighted sum, bias, activation. Interpretability becomes hard because millions or billions of such functions compose, not because any one neuron is magical. Another misconception is that deeper always means smarter. Depth increases expressivity and cost, but without data, optimization, normalization, and regularization, extra layers can make training worse.`,
        `Do not confuse logits with probabilities. The output number may need calibration, thresholding, or softmax. Do not confuse inference with learning either: if weights are not updated, the network is only applying what training already stored.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Activation Functions for the bends, then Backpropagation for the reverse-mode gradient calculation and Gradient Descent for the update rule. Softmax & Temperature explains classifier and decoder probabilities. The Transformer Block shows how this same feed-forward recipe sits beside attention in LLMs. BatchNorm & LayerNorm covers stabilization, and Quantization explains how the fixed weights can be stored more cheaply for inference.`,
      ],
    },
  ],
};
