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
    { id: 'inputs', label: 'Inputs xâ‚, xâ‚‚', type: 'number-list', defaultValue: '2, -1' },
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
  const inputCols = [{ id: 'x1', label: 'xâ‚' }, { id: 'x2', label: 'xâ‚‚' }];

  yield {
    state: matrixState({
      title: 'Layer 1 weights Wâ‚ (inputs Ã— hidden neurons)',
      rows: inputCols.map((c) => ({ id: `r${c.id}`, label: c.label })),
      columns: hiddenCols,
      values: W1,
    }),
    highlight: {},
    explanation: `A neural network is layers of numbers. This one has 2 inputs, 3 hidden neurons, 1 output — and these are its first-layer WEIGHTS: column j holds what hidden neuron j pays attention to. Weight w[i][j] means "how much input i matters to neuron j". Training (see Gradient Descent) is nothing more than nudging these numbers; today they\'re frozen so we can watch data flow.`,
  };

  const z = [0, 1, 2].map((j) => round2(x1 * W1[0][j] + x2 * W1[1][j] + B1[j]));
  yield {
    state: matrixState({
      title: 'Hidden pre-activations z = xÂ·Wâ‚ + bâ‚',
      rows: [{ id: 'z', label: 'z' }],
      columns: hiddenCols,
      values: [z],
    }),
    highlight: { active: hiddenCols.map((c) => c.id) },
    explanation: `Feed in x = [${x1}, ${x2}]. Each hidden neuron computes a WEIGHTED SUM of the inputs plus its bias: zâ‚ = ${x1}Ã—${W1[0][0]} + ${x2}Ã—${W1[1][0]} + ${B1[0]} = ${z[0]}; same recipe gives zâ‚‚ = ${z[1]}, zâ‚ƒ = ${z[2]}. So far this is pure linear algebra — and a stack of ONLY these steps could never learn a curve.`,
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
      ? `Neuron${clipped.length > 1 ? 's' : ''} ${clipped.map((id) => Number(id.slice(1)) + 1).join(' and ')} computed negative z, so ReLU silences ${clipped.length > 1 ? 'them' : 'it'} to exactly 0 — for THIS input, ${clipped.length > 1 ? 'those neurons' : 'that neuron'} simply doesn\'t participate. Different inputs wake different neurons; that input-dependent routing is where the network\'s expressive power lives.`
      : `All three z values were positive, so they pass through unchanged this time — but feed in different inputs and some neurons will be silenced to 0. That input-dependent switching is the nonlinearity doing its job.`}`,
  };

  const out = round2(a[0] * W2[0][0] + a[1] * W2[1][0] + a[2] * W2[2][0] + B2[0]);
  yield {
    state: matrixState({
      title: 'Output = aÂ·Wâ‚‚ + bâ‚‚',
      rows: [{ id: 'out', label: 'Å·' }],
      columns: [{ id: 'y', label: 'prediction' }],
      values: [[out]],
    }),
    highlight: { active: ['out:y'] },
    explanation: `The output layer is the same recipe once more: Å· = ${a[0]}Ã—${W2[0][0]} + ${a[1]}Ã—${W2[1][0]} + ${a[2]}Ã—${W2[2][0]} + ${B2[0]} = ${out}. For classification you\'d push this through Softmax & Temperature to get probabilities; for regression, ${out} IS the answer.`,
  };

  yield {
    state: matrixState({
      title: 'The whole network, end to end',
      rows: [{ id: 'flow', label: 'xâ†’Å·' }],
      columns: [
        { id: 'in', label: `[${x1}, ${x2}]` },
        { id: 'hid', label: `[${a.join(', ')}]` },
        { id: 'pred', label: String(out) },
      ],
      values: [[0.2, 0.55, 0.95]],
    }),
    highlight: {},
    explanation: `That\'s a complete forward pass: multiply, add, bend — twice. Everything else is scale: GPT-class models do this exact dance with thousands of dimensions per layer and ~100 layers, mixing in Attention Mechanism blocks between the multiplies. And when the prediction is wrong, the error flows BACKWARD through these same weights to compute the nudge each one needs — gradient descent\'s backpropagation, the other half of the story.`,
  };
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: ['The animation traces one inference computation through a 2-3-1 neural network: two inputs, three hidden neurons, and one output. A neuron computes a weighted sum, adds a bias, and applies an activation function. Removed cells mark hidden neurons whose ReLU activation becomes zero for the current input.', {type: 'callout', text: 'A forward pass is repeated affine mixing plus nonlinear gating; depth only helps because the gates prevent the layers from collapsing into one matrix.'}, {type: 'image', src: './assets/gifs/nn-forward-pass.gif', alt: 'Animated walkthrough of the nn forward pass visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    { heading: 'Why this exists', paragraphs: ['A forward pass is the computation a trained neural network runs to turn input values into a prediction. It is called forward because data move from input layer to hidden layers to output layer. Layered networks exist because many tasks need learned intermediate representations rather than one linear rule.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored input hidden and output nodes', caption: 'A layered network makes the forward path concrete: values move from inputs through hidden units to an output. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'}]},
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is a linear model, y = W x + b. It is fast, interpretable, and often the right baseline. Linear models fail when the target depends on feature interactions, as XOR shows: no single line separates (0,1) and (1,0) from (0,0) and (1,1).']},
    { heading: 'The wall', paragraphs: ['Stacking linear layers does not fix the problem. If h = W1 x + b1 and y = W2 h + b2, substitution gives y = (W2 W1) x + (W2 b1 + b2), which is still one affine map. The wall is representation: without nonlinearity, depth adds parameters but not a new kind of function.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Rectifier_and_softplus_functions.svg', alt: 'Rectifier and softplus activation curves', caption: 'The ReLU curve is the bend that stops stacked affine maps from reducing to one affine map. Source: Wikimedia Commons, Dan Stowell, CC0 1.0.'}]},
    { heading: 'The core insight', paragraphs: ['The core insight is alternating affine mixing and nonlinear gating. An affine map is a matrix multiply plus bias, and a gate such as ReLU changes the function depending on the input. Each hidden layer creates a representation that the next layer can reuse.']},
    { heading: 'How it works', paragraphs: ['A dense layer with input length M and output length N stores an M by N weight matrix W and a length-N bias vector b. Given input x, it computes z = x W + b. ReLU then transforms z by replacing negative values with zero and passing positive values through.']},
    { heading: 'Why it works', paragraphs: ['A trained forward pass works because training has already shaped the weights into useful transformations. The correctness of the computation is compositional: if each layer computes its affine map and activation, then the full network computes the composition of those functions. ReLU makes that composition piecewise nonlinear instead of one collapsed matrix.']},
    { heading: 'Cost and complexity', paragraphs: ['A dense layer costs O(M * N) multiplications for one example. The demo first layer has 2 inputs and 3 hidden units, so it uses 6 weight multiplications before adding 3 biases. Doubling both input and output width roughly quadruples dense-layer weight count.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Processor die showing dense compute units', caption: 'Large forward passes are scheduled onto hardware where arithmetic density and memory movement decide throughput. Source: Wikimedia Commons, KL and Intel, public domain.'}]},
    { heading: 'Real-world uses', paragraphs: ['Every deployed neural model runs forward passes. Fraud detectors score transactions, recommender systems rank items, medical imaging models classify scans, and language models run forward passes over prompts and generated tokens. Engineers also debug training by checking shapes, finite logits, activation health, and whether a tiny model can overfit a tiny dataset.']},
    { heading: 'Where it fails', paragraphs: ['A forward pass cannot fix bad weights or bad inputs. If serving uses different normalization, tokenization, feature order, or data distribution than training, the arithmetic can be perfect and the prediction still wrong. It also does not learn by itself; inference applies stored parameters unless weights or adapters are updated.']},
    { heading: 'Worked example', paragraphs: ['Use input x = [2, -1]. Hidden values are z1 = 2 * 0.5 + (-1) * 0.4 + 0.1 = 0.7, z2 = 2 * (-0.6) + (-1) * 0.9 - 0.2 = -2.3, and z3 = 2 * 0.8 + (-1) * (-0.3) + 0.05 = 1.95. ReLU gives [0.7, 0, 1.95], and the output is 0.7 * 0.7 + 0 * (-0.5) + 1.95 * 0.6 + 0.15 = 1.81.']},
    { heading: 'Sources and study next', paragraphs: ['Primary sources include McCulloch and Pitts on threshold neurons, Rosenblatt on the perceptron, Minsky and Papert on perceptron limits, Rumelhart, Hinton, and Williams on backpropagation, and Cybenko and Hornik on approximation. Study matrix multiplication, activation functions, loss functions, backpropagation, gradient descent, convolution, and transformers next.']},
  ],
};
