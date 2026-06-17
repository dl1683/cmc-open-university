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
      heading: `Why This Exists`,
      paragraphs: [
        `A neural network forward pass is the computation that turns input tensors into output tensors using the network's current parameters. The input might be two numbers, an image, a token sequence, a graph, or a table row. The parameters are weights, biases, normalization statistics, embeddings, and other learned arrays. During a forward pass, those parameters are read, not changed. Data flows through layers, each layer applies a mathematical transform, and the final layer produces a prediction, score, embedding, reconstruction, or next-token logit.`,
        `The demo uses a tiny 2-3-1 network: two inputs, three hidden neurons, and one output. It computes an affine transform, applies ReLU, then computes another affine transform. That small example is enough to show the contract used by much larger models. A transformer block, a convolutional classifier, and a recommender tower all run forward passes. They differ in layer types and tensor shapes, but they share the same discipline: apply fixed learned parameters to activations in a defined order.`,
      ],
    },
    {
      heading: `The Obvious Approach And The Wall`,
      paragraphs: [
        `The obvious approach to prediction is to hand-write a rule: if income is high and debt is low, approve the loan; if a pixel pattern looks like an edge, mark the image; if a sentence contains certain words, classify it as spam. Hand-written rules hit a wall because real patterns are too numerous, noisy, and interacting. Neural networks replace thousands of brittle rules with arrays of parameters learned from data. The forward pass is how those learned parameters are applied after training.`,
        `A second wall appears if the model is only linear. A stack of affine layers without nonlinearities collapses into one affine layer. It can rotate, scale, and shift data, but it cannot carve curved decision regions or build input-dependent features. Activations such as ReLU, sigmoid, tanh, GELU, and softmax add the bends that make composition useful. The forward pass therefore alternates linear mixing with nonlinear operations and sometimes normalization, pooling, attention, or residual addition.`,
      ],
    },
    {
      heading: `The Core Insight`,
      paragraphs: [
        `The core insight is that a neural network is a composed function whose intermediate values are learned representations. The first layer does not need to solve the whole task. It only needs to transform raw input into features that later layers can use. A hidden activation is not just a number produced on the way to the answer; it is the current representation of the example at that depth. Later layers recombine those representations into more task-specific evidence.`,
        `This also explains why the same forward pass is central to both inference and training. In inference, the output is consumed by an application. In training, the output is compared with a target to compute a loss. The backward pass then reuses many stored forward values to compute gradients. Without a correct forward pass, there is no prediction, no loss, and no useful gradient.`,
      ],
    },
    {
      heading: `Mechanism And Data Structures`,
      paragraphs: [
        `The main data structures are tensors. A single example is often represented as a vector. A batch is a matrix or higher-rank tensor whose leading dimension is batch size. A dense layer stores a weight matrix and a bias vector. If activations have shape B by M and the layer maps M inputs to N outputs, the weight matrix has shape M by N, the bias has shape N, and the output has shape B by N. The layer computes output = input * weight + bias, with broadcasting used to add the bias to every row in the batch.`,
        `The demo's hidden layer follows exactly that rule. For input x = [2, -1], each hidden neuron reads one column of the first weight matrix, computes a weighted sum, and adds its bias. The pre-activation values are z1 = 0.7, z2 = -2.3, and z3 = 1.95. ReLU converts them to [0.7, 0, 1.95]. The zero is meaningful: for this input, the second hidden neuron is inactive and sends no positive signal to the next layer. The output layer then combines the three hidden activations with a second weight matrix and one output bias.`,
        `Implementations also store metadata: tensor shape, dtype, device placement, memory layout, and sometimes strides. During training, the framework stores activations or recomputes them later so the backward pass can calculate gradients. During inference, many of those saved training buffers are unnecessary, but large models still store temporary activations, key-value caches, attention masks, and output logits. The forward pass is simple in concept, but the runtime is a careful schedule of matrix multiplications, memory reads, kernel launches, and reductions.`,
      ],
    },
    {
      heading: `Why It Works`,
      paragraphs: [
        `A forward pass works because training has already shaped the parameters into useful transformations. A random network also has a forward pass, but its outputs are usually meaningless. Training adjusts weights so that useful signals survive and unhelpful signals are suppressed. Once learned, those weights define a function that can be evaluated quickly on new inputs. The model does not look up a stored answer for each example. It applies a parameterized computation that can generalize when the learned structure matches the data distribution.`,
        `Composition is the reason this scales. One layer can detect simple features, the next can combine them, and deeper layers can represent more abstract relationships. In language models, embedding layers turn token ids into vectors, attention mixes information across positions, feed-forward layers transform each position, and the final projection produces logits over the vocabulary. The output is still the result of a forward pass: read current activations, apply learned tensors, pass the result onward.`,
      ],
    },
    {
      heading: `Evaluation And Operational Signals`,
      paragraphs: [
        `For correctness, inspect output shapes, dtype, value ranges, and whether the final activation matches the task. Regression may need an unconstrained number. Binary classification may need a logit passed through sigmoid. Multiclass classification usually produces logits passed through softmax. Ranking systems may use scores without calibrated probabilities. If the downstream system expects probabilities, calibration matters; a high logit margin is not automatically a trustworthy probability.`,
        `For operations, monitor latency, throughput, memory use, batch size, device utilization, and numerical stability. On GPUs, dense layers are often limited by matrix-multiplication throughput or memory bandwidth. Small batches may underuse the device; huge batches may increase latency or exceed memory. In language models, prompt prefill is dominated by processing the input sequence, while token decoding repeatedly runs smaller forward passes that reuse a key-value cache. Quantization, fused kernels, compilation, and batching all change forward-pass economics without changing the mathematical function in the article's tiny example.`,
      ],
    },
    {
      heading: `Where It Is Useful`,
      paragraphs: [
        `Every deployed neural application is built around forward passes. A fraud model scores a transaction. A medical classifier scores an image. A recommender ranks candidate items. A speech model turns audio frames into token probabilities. A vision encoder produces embeddings for search. A language model runs a forward pass over the prompt and then another step for each generated token. Even when a system includes retrieval, rules, caching, or tools, the neural component still enters through this same left-to-right tensor computation.`,
        `Training workloads also spend much of their time in forward passes. Each mini-batch runs forward to compute predictions and a loss before backpropagation begins. Debugging training often starts by checking the forward pass on one batch: Are shapes correct? Are logits finite? Is the loss nonzero? Do activations saturate? Does a tiny model overfit a tiny dataset? These checks catch many errors before optimizer settings matter.`,
      ],
    },
    {
      heading: `Where It Fails`,
      paragraphs: [
        `A forward pass is only as good as the learned parameters and the input representation. If features at serving time differ from training features, the computation can be perfectly executed and still wrong. If a classifier receives out-of-distribution examples, it may produce confident logits because the function is forced to output something. If preprocessing is inconsistent, token ids, normalized values, or image channels can be shifted before the network even begins.`,
        `Do not anthropomorphize individual neurons. A neuron computes a weighted sum, bias, and activation. Interpretability becomes difficult because many such computations compose across layers and because features may be distributed. Do not confuse inference with learning either. Unless weights, adapter parameters, memory, or some external state are updated, a forward pass is applying what training already stored. Prompting a language model changes the input context; it does not update the model weights.`,
      ],
    },
    {
      heading: `What To Study Next`,
      paragraphs: [
        `Study activation functions to understand the bends that make neural networks more than linear maps. Study backpropagation and gradient descent to see how the same computation becomes trainable. Study softmax, logits, and calibration for classifier outputs. Study layer normalization, residual connections, attention, convolution, and transformer blocks to see richer layer contracts. For serving systems, study quantization, batching, key-value caches, and GPU memory bandwidth, because most production cost is paid while running forward passes at scale.`,
      ],
    },
  ],
};
