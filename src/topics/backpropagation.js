// Backpropagation: the forward pass ran left to right; now the ERROR runs
// right to left, assigning blame to every weight via the chain rule —
// and one small update makes the same network measurably less wrong.

import { matrixState, parseNumber, InputError } from '../core/state.js';

export const topic = {
  id: 'backpropagation',
  title: 'Backpropagation',
  category: 'AI & ML',
  summary: 'Run the error backward through the network, blame every weight, nudge them all — loss drops.',
  controls: [
    { id: 'target', label: 'Correct answer y', type: 'number', defaultValue: '0.5' },
    { id: 'lr', label: 'Learning rate', type: 'select', options: ['0.02', '0.05', '0.1'], defaultValue: '0.05' },
  ],
  run,
};

// The exact network from Neural Network Forward Pass — same frozen weights.
const X = [2, -1];
const W1 = [
  [0.5, -0.6, 0.8],
  [0.4, 0.9, -0.3],
];
const B1 = [0.1, -0.2, 0.05];
const W2 = [0.7, -0.5, 0.6];
const B2 = 0.15;

const relu = (v) => Math.max(0, v);
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

function forward(w1, b1, w2, b2) {
  const z = [0, 1, 2].map((j) => X[0] * w1[0][j] + X[1] * w1[1][j] + b1[j]);
  const a = z.map(relu);
  const out = a[0] * w2[0] + a[1] * w2[1] + a[2] * w2[2] + b2;
  return { z, a, out };
}

export function* run(input) {
  const y = parseNumber(input.target, { label: 'the correct answer y' });
  if (Math.abs(y) > 10) throw new InputError('Keep y between -10 and 10 so the numbers stay readable.');
  const lr = parseFloat(input.lr);

  const hidden = [0, 1, 2].map((j) => ({ id: `h${j}`, label: `h${j + 1}` }));
  const { z, a, out } = forward(W1, B1, W2, B2);
  const loss = (out - y) ** 2;

  yield {
    state: matrixState({
      title: `Forward pass recap: prediction ŷ = ${r2(out)}, truth y = ${r2(y)}`,
      rows: [{ id: 'a', label: 'a' }],
      columns: hidden,
      values: [a.map(r2)],
    }),
    highlight: {},
    explanation: `Same 2-3-1 network as Neural Network Forward Pass, same input [${X.join(', ')}]: hidden activations a = [${a.map(r2).join(', ')}], prediction ŷ = ${r2(out)}. But the CORRECT answer is ${y}. Loss = (ŷ − y)² = ${r3(loss)}. The question backpropagation answers: which of the 13 weights deserves how much blame — and in which direction should each one move?`,
  };

  const dOut = 2 * (out - y);
  yield {
    state: matrixState({
      title: 'The seed gradient: dL/dŷ = 2(ŷ − y)',
      rows: [{ id: 'g', label: '∂L' }],
      columns: [{ id: 'dy', label: '∂ŷ' }],
      values: [[r3(dOut)]],
    }),
    highlight: { active: ['g:dy'] },
    explanation: `Differentiate the loss: dL/dŷ = 2(ŷ − y) = ${r3(dOut)}. ${dOut > 0 ? 'Positive: the prediction is too HIGH, so anything that pushed ŷ up gets positive blame.' : 'Negative: the prediction is too LOW.'} This single number is the seed — every other gradient in the network is this, multiplied backward through the chain rule.`,
  };

  const dW2 = a.map((aj) => aj * dOut);
  yield {
    state: matrixState({
      title: 'Output-layer gradients: ∂L/∂W₂ = a × dL/dŷ',
      rows: [{ id: 'gw2', label: '∂W₂' }],
      columns: hidden,
      values: [dW2.map(r3)],
    }),
    highlight: { active: ['gw2:h1'] },
    explanation: `Chain rule, step one: each output weight's blame = (the activation it carried) × (the downstream error): ∂L/∂W₂ = [${dW2.map(r3).join(', ')}]. Read the middle one: neuron 2's activation was 0, so its weight carried NOTHING into the error — zero blame, zero learning. Blame flows only through paths that actually fired.`,
  };

  const dA = W2.map((w) => w * dOut);
  const dZ = dA.map((g, j) => (z[j] > 0 ? g : 0));
  yield {
    state: matrixState({
      title: "Through ReLU: ∂L/∂z = ∂L/∂a ⊙ ReLU′(z)",
      rows: [{ id: 'da', label: '∂a' }, { id: 'dz', label: '∂z' }],
      columns: hidden,
      values: [dA.map(r3), dZ.map(r3)],
    }),
    highlight: { active: ['dz:h1'] },
    explanation: `Step two: pass the blame through the activation. ReLU's derivative is 1 where z was positive, 0 where it was negative — so neuron 2 (z = ${r2(z[1])} < 0) BLOCKS its gradient entirely: ∂L/∂z = [${dZ.map(r3).join(', ')}]. The gate that silenced it forward silences its learning backward. (This is exactly the "dead ReLU" risk from Activation Functions.)`,
    invariant: 'Gradients flow backward through precisely the paths the data flowed forward.',
  };

  const dW1 = [0, 1].map((i) => [0, 1, 2].map((j) => X[i] * dZ[j]));
  yield {
    state: matrixState({
      title: 'Input-layer gradients: ∂L/∂W₁ = x ⊗ ∂L/∂z',
      rows: [{ id: 'rx1', label: 'x₁' }, { id: 'rx2', label: 'x₂' }],
      columns: hidden,
      values: dW1.map((row) => row.map(r3)),
    }),
    highlight: {},
    explanation: `Step three: the first layer. Each weight's blame = (its input) × (its neuron's blame): an outer product. Note the sign flips on the x₂ row — x₂ = ${X[1]} is negative, so increasing those weights DECREASES the prediction. The chain rule handles all of this bookkeeping mechanically; in PyTorch this entire process is the single call loss.backward().`,
  };

  const W2n = W2.map((w, j) => w - lr * dW2[j]);
  const B2n = B2 - lr * dOut;
  const W1n = W1.map((row, i) => row.map((w, j) => w - lr * dW1[i][j]));
  const B1n = B1.map((b, j) => b - lr * dZ[j]);
  const after = forward(W1n, B1n, W2n, B2n);
  const newLoss = (after.out - y) ** 2;

  yield {
    state: matrixState({
      title: `Update (lr=${lr}) and re-run: loss ${r3(loss)} → ${r3(newLoss)}`,
      rows: [{ id: 'before', label: 'before' }, { id: 'after', label: 'after' }],
      columns: [{ id: 'pred', label: 'ŷ' }, { id: 'l', label: 'loss' }],
      values: [[r2(out), r3(loss)], [r2(after.out), r3(newLoss)]],
    }),
    highlight: { active: ['after:l'] },
    explanation: `Every weight takes one step against its gradient: w ← w − ${lr}·∂L/∂w (that's Gradient Descent). Then run the SAME input forward again: ŷ moves from ${r2(out)} to ${r2(after.out)}, and the loss drops from ${r3(loss)} to ${r3(newLoss)}. The network is measurably less wrong — after ONE step.`,
  };

  yield {
    state: matrixState({
      title: 'One complete training step',
      rows: [{ id: 'loop', label: 'loop' }],
      columns: [
        { id: 's1', label: 'forward' }, { id: 's2', label: 'loss' },
        { id: 's3', label: 'backward' }, { id: 's4', label: 'update' },
      ],
      values: [[0.25, 0.5, 0.75, 1.0]],
    }),
    highlight: {},
    explanation: `Forward → loss → backward → update. That four-beat loop, repeated millions of times over millions of examples, is ALL that "training a neural network" means — including the LLM you might be reading this with. Backprop's deeper claim: it computes the gradient for every one of n weights in one backward sweep costing about as much as the forward pass — not n separate experiments. That efficiency is why deep learning is possible at all.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Backpropagation is reverse-mode automatic differentiation applied to neural networks. Neural Network Forward Pass computes predictions and a loss; backprop walks the same computation graph backward and computes the derivative of that loss with respect to every trainable parameter. Those derivatives are gradients: local instructions for how each weight should move if the goal is to reduce this batch's loss.`,
        `The historical breakthrough was efficiency. Rumelhart, Hinton, and Williams popularized backprop for neural networks in 1986, but the underlying reverse-mode chain rule is broader than neural nets. One backward sweep gives gradients for millions or billions of weights without separately perturbing each weight. Gradient Descent and its descendants then decide how to turn those gradients into parameter updates.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start at the loss. For squared error, dL/dy_hat = 2(y_hat - y). That derivative flows into the output layer. A weight connecting hidden activation a_i to the output receives gradient a_i times the downstream error. If a_i was zero, that path contributed nothing on the forward pass and receives no weight gradient on this example. Bias gradients are simpler: they receive the downstream error directly because adding a bias has derivative 1.`,
        `Then the chain rule continues through Activation Functions. ReLU has derivative 1 for positive pre-activations and 0 for negative ones, so it blocks gradients through inactive units. Other activations have different derivatives. For the first layer, gradients are outer products: input value times hidden-layer error. Frameworks such as PyTorch, TensorFlow, and JAX build a graph of operations during the forward pass, store needed intermediates, and execute these vector-Jacobian products backward when you call backward or grad.`,
        `The update is separate: w <- w - learning_rate * gradient for plain SGD. Momentum, RMSProp & Adam alter that step using running averages. Learning-Rate Schedules & Warmup change step size over time. Backprop supplies the gradient; the optimizer decides how aggressively to trust it.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Backward compute is usually on the same order as forward compute, often roughly 2x to 3x a forward pass for dense networks once all gradient calculations are included. It is not one full pass per weight. That is the crucial scaling fact: a billion-parameter model gets a billion parameter gradients from one backward traversal of the graph. The memory cost is often harsher than the arithmetic. Training must keep activations needed for gradients, plus gradients, optimizer state, and sometimes master fp32 weights.`,
        `Gradient checkpointing trades compute for memory by discarding some activations and recomputing them during backward. Mixed precision reduces bandwidth. Batch size affects activation memory directly. These engineering choices are why training a model is far more expensive than merely running inference.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every major neural training pipeline uses backprop: language models, diffusion models, CNNs, recommender systems, reinforcement-learning value networks, and small tabular MLPs. It also powers adversarial examples, where the loss is differentiated with respect to the input image or text embedding instead of only the weights. In meta-learning and differentiable architecture search, researchers differentiate through parts of the training process itself.`,
        `Modern stability tricks exist because raw backprop through deep products of Jacobians can be hostile. BatchNorm & LayerNorm stabilize activation scales. Residual connections give gradients shorter routes. Gradient clipping tames rare spikes. These techniques are the practical answer to Vanishing & Exploding Gradients.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Backprop is exact for the computation you defined, not for the problem you wish you had. If the loss is misaligned, the gradients faithfully optimize the wrong thing. If the learning rate is too high, a step along the negative gradient can overshoot and increase loss. If the landscape has saddles, cliffs, or flat basins, gradients can be small or misleading. The Loss Landscape, in 3D shows why local downhill directions do not imply global success.`,
        `Vanishing gradients are not simply "ReLU kills half the signal." They come from multiplying many Jacobians whose singular values are often below 1; exploding gradients come from products above 1. ReLU helps compared with sigmoid or tanh in many settings, but dead ReLUs, bad initialization, and poor normalization can still break training. Backprop is calculus, not a guarantee of learnability.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Neural Network Forward Pass first, then Gradient Descent for the basic update. Activation Functions explain derivative gates. Vanishing & Exploding Gradients covers the depth failure modes, while BatchNorm & LayerNorm explains stabilization. The Loss Landscape, in 3D builds geometric intuition for why optimization can stall. Momentum, RMSProp & Adam and Learning-Rate Schedules & Warmup then show how real training loops turn raw gradients into usable progress.`,
      ],
    },
  ],
};
