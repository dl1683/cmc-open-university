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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation traces a single forward pass through a 2-3-1 network: two inputs, three hidden neurons, one output. Each frame shows one stage of the computation: the weight matrix, the weighted sums (pre-activations), the ReLU activation, the output, and then the full end-to-end summary.',
        'Active (highlighted) cells are the values being computed right now. When a neuron\'s pre-activation is negative, ReLU silences it to zero and the animation marks it as removed -- that neuron contributes nothing to the output for this particular input. Different inputs activate different subsets of neurons; watch how changing the inputs in the control box reshapes which neurons fire.',
        'The key inference at each frame: the weighted sum is pure linear algebra (rotation, scaling, shifting). The ReLU bend is what makes the network more than a single matrix multiply. Without that bend, every layer would collapse into one.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'In 1943, Warren McCulloch and Walter Pitts published the first mathematical model of a neuron: a binary threshold unit that fires when the weighted sum of its inputs exceeds a threshold. It was a logic gate, not a learning machine, but it proved that networks of simple units could compute any Boolean function. The question shifted from "can a machine compute?" to "can a machine learn which computation to perform?"',
        'Frank Rosenblatt answered in 1958 with the Perceptron: a single-layer network with a learning rule that adjusted weights from labeled examples. The Perceptron could learn any linearly separable function -- and it came with a convergence proof. If a separating hyperplane exists, the algorithm finds it in finite steps. For a few years, connectionism looked like the path to artificial intelligence.',
        'Then in 1969, Marvin Minsky and Seymour Papert published Perceptrons, proving that a single-layer perceptron cannot learn XOR. The four points (0,0)=0, (0,1)=1, (1,0)=1, (1,1)=0 are not linearly separable -- no single line in 2D divides the 0-class from the 1-class. This was not a flaw in the learning rule. It was a representational limit: one layer of weights can only carve linear boundaries. The book chilled neural network research for over a decade.',
        'The fix was hiding layers. A multi-layer network with nonlinear activations can learn XOR and much more. Rumelhart, Hinton, and Williams showed in 1986 that backpropagation could train these deeper networks by propagating error gradients layer by layer. And Cybenko proved in 1989 that a single hidden layer with enough neurons and a squashing activation can approximate any continuous function to arbitrary precision (the Universal Approximation Theorem). The forward pass -- multiply by weights, add bias, apply nonlinearity, repeat -- is the computation that makes all of this work.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest learnable predictor is the linear model: y = Wx + b. It is fast, interpretable, and optimal when the true relationship is a hyperplane. Logistic regression extends it to classification by pushing the linear output through a sigmoid. These models work well when features are hand-engineered and the decision boundary is roughly linear.',
        'The wall is nonlinearity. XOR is the textbook example: no single line separates (0,0)/(1,1) from (0,1)/(1,0). But the same limit bites in practice everywhere. Classifying images by raw pixel sums fails because object identity depends on spatial patterns, not pixel averages. Predicting stock returns from raw prices fails because the relationship is nonlinear and context-dependent. Any problem where the answer depends on interactions between features -- not just their weighted sum -- defeats a linear model.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Stacking linear layers does not help. If layer 1 computes h = W1*x + b1 and layer 2 computes y = W2*h + b2, substitution gives y = W2*(W1*x + b1) + b2 = (W2*W1)*x + (W2*b1 + b2). The composition of two affine transforms is still one affine transform. Ten layers of linear maps collapse into a single matrix multiply. Depth without nonlinearity is an illusion.',
        'The fix is simple: insert a nonlinear activation between layers. ReLU(z) = max(0, z) is the most common choice. After the linear mix, ReLU zeros out negative values and passes positive values unchanged. This piecewise-linear bend means the composition of two layers is no longer reducible to one. Each layer can carve the input space into regions and build features that the next layer recombines. The forward pass alternates: linear transform, nonlinear activation, linear transform, nonlinear activation.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A neural network is a composed function whose intermediate values are learned representations. The first layer does not solve the whole task. It transforms raw input into features the next layer can use. A hidden activation is not just a number on the way to the answer -- it is the network\'s internal representation of the input at that depth.',
        'This is why depth matters more than width. Each layer composes features from the previous layer into higher-level abstractions. In a vision network, early layers detect edges, middle layers combine edges into textures and shapes, deep layers recognize objects. In a language model, early layers capture token identity, middle layers build syntactic structure, deep layers encode semantic meaning. A single wide layer could in theory approximate any function (Universal Approximation), but the number of neurons required can grow exponentially. Depth lets the network reuse features compositionally, which is dramatically more parameter-efficient.',
        'The forward pass is also the foundation of training. During inference, the output is consumed by an application. During training, the output is compared to a target to compute a loss. Backpropagation then flows error gradients backward through the same layers, using stored forward-pass activations to compute how each weight should change. No correct forward pass means no meaningful loss and no useful gradient.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A dense (fully connected) layer stores a weight matrix W of shape M-by-N and a bias vector b of shape N, where M is the input dimension and N is the output dimension. Given an input vector x of length M, the layer computes z = x*W + b, producing a vector of length N. For a batch of B examples, the input is a B-by-M matrix, and the output is B-by-N, with the bias broadcast across rows.',
        'The demo\'s hidden layer follows this rule exactly. For input x = [2, -1], each of the three hidden neurons reads one column of the 2-by-3 weight matrix, computes a weighted sum with the two inputs, and adds its scalar bias. The pre-activation values are z1 = 2*0.5 + (-1)*0.4 + 0.1 = 0.7, z2 = 2*(-0.6) + (-1)*0.9 + (-0.2) = -2.3, z3 = 2*0.8 + (-1)*(-0.3) + 0.05 = 1.95.',
        'ReLU converts these to [0.7, 0, 1.95]. The zero matters: for this input, the second neuron is inactive. It sends no signal to the output layer. Different inputs activate different subsets of neurons -- this input-dependent routing is the source of the network\'s expressive power. The output layer then combines the three hidden activations with a second weight matrix (3-by-1) and one bias to produce the final scalar prediction.',
        'In production frameworks, the forward pass also manages tensor metadata (shape, dtype, device placement, memory layout), gradient tape for training, and temporary buffers for attention masks, key-value caches, and intermediate activations. The math is simple; the runtime is a carefully scheduled sequence of matrix multiplications, memory transfers, and kernel launches.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A trained network\'s forward pass works because gradient descent has already shaped its parameters into useful transformations. A randomly initialized network also runs a forward pass, but its outputs are meaningless noise. Training iteratively adjusts weights so that useful input features produce strong signals and irrelevant features are suppressed. After training, the weights encode a function that generalizes to new inputs -- not by memorizing examples, but by learning the structure of the input-output relationship.',
        'Composition is the mechanism that lets this scale. A single ReLU neuron divides the input space with one hyperplane. A layer of N neurons divides it with N hyperplanes, creating up to 2^N regions. A second layer can combine these regions into more complex shapes. Deeper networks compose exponentially more decision regions per parameter than wide shallow networks. This is why a 100-layer transformer with 175 billion parameters can model language: each layer builds on the representations computed by the layer below, creating an abstraction hierarchy from tokens to syntax to semantics.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'A single dense layer with M inputs and N outputs costs O(M*N) multiplications plus N additions for bias. The demo\'s 2-3-1 network does 6 multiplies in layer 1 and 3 in layer 2 -- trivial. For GPT-scale models with hidden dimension 12,288 and 96 layers, each feed-forward block runs two matmuls of size 12,288 by 49,152, totaling roughly 2.4 billion multiplies per layer per token.',
        'Memory follows the same pattern. Inference stores activations for the current layer plus weight tensors. Training stores activations from every layer because backpropagation needs them for gradient computation. Doubling hidden dimension quadruples weight count per dense layer and doubles activation memory per layer. Doubling depth doubles both compute and activation memory linearly.',
        'On GPUs, the dominant cost is usually memory bandwidth for reading weight matrices, not arithmetic. Small batch sizes underuse the hardware because the GPU finishes the math before the next weight tile arrives from memory. Larger batches amortize the weight-read cost across more examples, improving throughput until memory limits hit.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every deployed neural system is built around forward passes. A fraud detector scores transactions by running account features through a feedforward network. Medical imaging classifiers run pixel arrays through convolutional layers (which are structured forward passes with weight sharing). Recommender systems score candidate items by forwarding user and item embeddings through interaction layers. Language models run a forward pass over the prompt (prefill) and then one forward pass per generated token (decode), each time producing a probability distribution over the vocabulary.',
        'Training is also dominated by forward passes. Each mini-batch runs forward to compute predictions and loss before backpropagation begins. Debugging training starts with forward-pass sanity checks: are shapes correct, are logits finite, is the loss nonzero, do activations saturate, can a tiny model overfit a tiny dataset? These checks catch most errors before optimizer settings matter.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A forward pass is only as good as its learned weights and its input representation. If serving-time features differ from training features (different normalization, different tokenization, shifted distributions), the computation executes perfectly and still produces wrong answers. Out-of-distribution inputs are dangerous because the network must produce some output -- it cannot say "I don\'t know" without explicit calibration or abstention mechanisms.',
        'Do not anthropomorphize neurons. A neuron computes a weighted sum, adds a bias, and applies an activation. Individual neurons rarely have clean semantic interpretations because features are distributed across many neurons and composed across layers. Do not confuse inference with learning: unless weights or adapter parameters are updated, a forward pass applies what training already stored. Prompting a language model changes the input context; it does not change the model\'s weights.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input: x = [2, -1]. Layer 1 weights W1 (shape 2x3), biases B1 (shape 3).',
        'Hidden pre-activations: z1 = 2*0.5 + (-1)*0.4 + 0.1 = 0.7. z2 = 2*(-0.6) + (-1)*0.9 + (-0.2) = -2.3. z3 = 2*0.8 + (-1)*(-0.3) + 0.05 = 1.95.',
        'ReLU activation: a = [max(0, 0.7), max(0, -2.3), max(0, 1.95)] = [0.7, 0, 1.95]. Neuron 2 is dead for this input because its pre-activation was negative.',
        'Output: y = 0.7*0.7 + 0*(-0.5) + 1.95*0.6 + 0.15 = 0.49 + 0 + 1.17 + 0.15 = 1.81. That single number is the network\'s prediction for input [2, -1] given these frozen weights.',
      ],
    },
    {
      heading: 'Worked example: XOR with a hidden layer',
      paragraphs: [
        'XOR cannot be solved by a single-layer perceptron. Here is a 2-2-1 network that solves it, with actual weights you can verify by hand.',
        'Inputs: (0,0), (0,1), (1,0), (1,1). Targets: 0, 1, 1, 0. Hidden layer: 2 neurons, W1 = [[1,1],[1,1]], b1 = [0,-1], activation = ReLU.',
        'Trace each input. (0,0): z = [0+0+0, 0+0-1] = [0,-1], h = ReLU = [0,0]. (0,1): z = [0+1+0, 0+1-1] = [1,0], h = [1,0]. (1,0): z = [1+0+0, 1+0-1] = [1,0], h = [1,0]. (1,1): z = [1+1+0, 1+1-1] = [2,1], h = [2,1].',
        'The hidden layer has remapped the four input points into a new space. In the original 2D space, XOR is not linearly separable. In the hidden space, the points that should output 1 -- (0,1) and (1,0) -- both land at [1,0], while (0,0) lands at [0,0] and (1,1) lands at [2,1]. A single line in this new space can separate them.',
        'Output layer: W2 = [1,-2], b2 = 0. y(0,0) = 0*1 + 0*(-2) = 0. y(0,1) = 1*1 + 0*(-2) = 1. y(1,0) = 1*1 + 0*(-2) = 1. y(1,1) = 2*1 + 1*(-2) = 0. XOR solved. The hidden layer\'s job was to create a representation where the problem becomes linearly separable. That is what every hidden layer in every neural network does.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'McCulloch & Pitts 1943 (A Logical Calculus of the Ideas Immanent in Nervous Activity -- first mathematical neuron model, binary threshold units computing Boolean functions). Rosenblatt 1958 (The Perceptron: A Probabilistic Model for Information Storage and Organization in the Brain -- single-layer learning with convergence proof). Minsky & Papert 1969 (Perceptrons -- proved single-layer networks cannot learn XOR, paused the field for a decade). Rumelhart, Hinton & Williams 1986 (Learning Representations by Back-propagating Errors -- made training multi-layer networks practical). Cybenko 1989 (Approximation by Superpositions of a Sigmoidal Function -- Universal Approximation Theorem). Hornik 1991 (generalized universal approximation to arbitrary activations).',
        'Study next: Backpropagation (how error gradients flow backward through these same layers to compute weight updates -- the other half of neural network training). Activation Functions (ReLU, sigmoid, tanh, GELU -- the nonlinear bends between layers that make depth useful; without them, the network collapses to a single linear transform). Gradient Descent (how computed gradients become actual weight updates -- learning rate, momentum, Adam). Loss Functions (what the network is trying to minimize -- MSE for regression, cross-entropy for classification, the choice shapes what "correct" means). Transformer (the modern architecture that replaced feedforward-only networks for sequence tasks -- attention layers interleaved with the same multiply-add-bend forward pass shown here).',
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Prerequisites: matrix multiplication (the forward pass is matmuls -- if you cannot multiply a 2x3 matrix by a 3x1 vector, start there), activation functions (what makes a network nonlinear), loss functions (what the network optimizes).',
        'This unlocks: all of deep learning. CNNs, RNNs, Transformers, GANs, autoencoders, diffusion models -- every one runs forward passes with the same multiply-add-bend discipline shown here, just with different layer types and tensor shapes.',
        'Transfer: a neural network is a differentiable function approximator. Any problem reducible to "learn a function from input-output examples" is a neural network candidate. Fraud detection, protein folding, speech recognition, image generation, and language modeling all reduce to this pattern.',
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you compute the forward pass for a 2-layer network: input x=[1,2], W1=[[0.5,0.3],[0.2,0.8]], b1=[0,0], activation=ReLU, W2=[0.4,0.6], b2=0? [h=ReLU([0.5*1+0.3*2, 0.2*1+0.8*2])=ReLU([1.1,1.8])=[1.1,1.8], y=0.4*1.1+0.6*1.8=1.52].',
            'Can you explain why a network without activations is just one big linear function? Composing linear functions: W2*(W1*x) = (W2*W1)*x -- the product of two matrices is still a matrix, so any number of linear layers collapses to one.',
            'Can you show that XOR requires a hidden layer? Draw the four points (0,0)=0, (0,1)=1, (1,0)=1, (1,1)=0 in 2D space and verify that no single straight line separates the 0-class from the 1-class.',
            'Can you explain the Universal Approximation Theorem in one sentence? A single hidden layer with enough neurons and a nonlinear activation can approximate any continuous function on a compact set to arbitrary precision.',
          ],
        },
      ],
    },
  ],
};

