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
      heading: 'What it is',
      paragraphs: [
        `Backpropagation is the algorithm that turns a single prediction error into a detailed blame assignment for every weight in a network. After the forward pass computes ŷ = f(x), you measure how wrong it is: loss = (ŷ − y)². Then backpropagation runs the chain rule backward through every layer, accumulating gradients that say "this weight should move left" or "this weight should move right" to reduce the loss. Each weight gets a number—its gradient—proportional to its responsibility for the error.`,
        `The key insight is symmetry: data flowed left-to-right through the network; error flows right-to-left through the exact same graph, just in reverse. ReLU neurons that silenced themselves forward (z < 0) silence themselves backward too (gradient = 0). Weights that never fired during the forward pass get zero blame and zero learning. The backward pass is not magic; it's just calculus applied methodically to every edge.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start with the loss gradient: dL/dŷ = 2(ŷ − y). This single number seeds everything. From there, the chain rule unfolds: for the output weight w₂ᵢ connected to hidden neuron i, the gradient is ∂L/∂w₂ᵢ = aᵢ × dL/dŷ. Activations act as gain; where the neuron fired strongly (a = 0.9), it bears more blame for the error. Where it didn't fire at all (a = 0), it bears none—no learning signal flows through dead paths.`,
        `Moving deeper, ReLU's derivative is the gatekeeper: ∂L/∂z = ∂L/∂a × (1 if z > 0, else 0). This is the dead ReLU problem in action—neurons stuck in the negative zone never receive learning signals and never update. Finally, input-layer gradients are an outer product: ∂L/∂W₁ = x ⊗ ∂L/∂z. If input x₂ is negative and the downstream gradient is positive, that weight's gradient is negative—increasing it would worsen the loss. PyTorch and JAX hide all this machinery behind loss.backward(), but every line you just read is what's happening inside.`,
        `The update step is gradient descent: w ← w − lr·∂L/∂w. One small step in the direction opposite to the gradient. In the visualization, you watch the loss drop in a single step—not by magic, but because we moved along the direction that locally reduces it. This is the fundamental reason training works: gradients point downhill.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `The stunning efficiency: one backward pass costs roughly as much as one forward pass. Not 100× the forward pass. Not "one pass per weight." Just one backward sweep computes gradients for all n weights simultaneously by reusing intermediate activations (z, a) and multiplying them left-to-right. This is dynamic programming on the chain rule—store the forward activations, then replay the chain rule backward, accumulating products. For a network with 1 billion weights, one batch gives you 1 billion gradients in the time of two forward passes. That arithmetic is why deep learning scales.`,
        `Practical cost: memory. You must store every intermediate activation z and a for every sample in the batch. A model with 7 billion parameters and batch size 32 needs to cache roughly 32 × (number of layers) × (layer widths) in GPU memory. Gradient computation itself is cheap; memory bandwidth and storage are the real constraint.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Every neural network trained in production uses backpropagation. Language models, vision systems, reinforcement learning agents—all rely on loss.backward() or equivalent. In research, backprop variants appear everywhere: gradient checkpointing trades recomputation for lower memory, mixed-precision backprop speeds training by computing gradients in lower precision, and gradient accumulation averages gradients over many batches when memory is tight. Automatic differentiation libraries like PyTorch's autograd and JAX build complex custom gradients for novel loss functions; they all bottom out at the chain rule.`,
        `Understanding backprop also unlocks gradient-based optimization beyond supervised learning: adversarial examples are found by backpropagating through the loss with respect to the input, not the weights; gradient-based meta-learning tunes hyperparameters by treating the inner loop's loss as a function of the learning rate, then differentiating it; neural architecture search uses architecture gradients. The mental model—"differentiate the loss with respect to anything"—opens entire research directions.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Vanishing gradients: early layers receive tiny gradients because each ReLU kills half the signal. By the time you reach layer 1, the product is near zero. This was a historic blocker in the 1990s—networks deeper than 3–4 layers were thought impossible. Fixes include ReLU itself (which preserves gradient flow better than tanh), residual connections, layer normalization, and careful initialization. Modern networks have 100+ layers precisely because these tricks broke the vanishing gradient ceiling.`,
        `Dead ReLU: once a neuron's weights drift so that z < 0 for all inputs, it outputs 0 forever, gets zero gradient forever, and never recovers. Some call this dead code in the network. Leaky ReLU (f(z) = max(0.01z, z)) and ELU prevent this by letting small gradients through on the negative side. Another misconception: gradients are guarantees. A large gradient means the loss is sensitive to a weight—it does not mean the direction is correct. With wrong hyperparameters, you can descend the gradient and still increase loss (saddle points, learning rate too high). Gradient descent is not magic; it is local optimization with no global guarantees.`,
        `One more: backprop computes the gradient assuming a fixed network architecture. If you add dropout during training, gradients estimate the loss under random gating. At test time, you must handle that mismatch (inference dropout requires averaging, or you use "inverted dropout" so test-time expectations align). Backprop is mechanically perfect, but the network's training-vs-test behavior is under your control.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Backpropagation is applied Gradient Descent—it computes the gradients that gradient descent uses to update weights. Then study Neural Network Forward Pass to see the forward half; the network architecture defines which weights exist. Activation Functions teach why ReLU blocks gradients where z < 0 and how that shapes learning. The chain rule is calculus; if derivatives feel shaky, recursion through Recursion and then the compositional mental model of Memoization (Dynamic Programming) will show why recomputing vs storing is the core tradeoff—backprop solves it by storing activations and replaying the chain rule, which IS dynamic programming on the composition f(g(h(x))).`,
      ],
    },
  ],
};

