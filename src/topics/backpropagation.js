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
      heading: `Why this exists`,
      paragraphs: [
        `Backpropagation exists because a neural network can be wrong in millions of tiny ways at once. A prediction comes from many weights, biases, activations, and matrix multiplies. Training needs to answer a practical question after every batch: which parameters helped cause this loss, and which direction should each one move next?`,
        `A forward pass only tells you the prediction and the loss. That is not enough to train. If the network predicts 0.9 when the target is 0.5, you know the output is too high, but you do not yet know whether the first hidden neuron should increase, whether a bias should fall, or whether a weight connected to a silent ReLU mattered at all. Backpropagation turns that single loss into a gradient for every trainable value.`,
        `The useful definition is simple: backpropagation is reverse-mode automatic differentiation applied to a neural network computation graph. The network runs forward, stores the intermediate values needed for derivatives, seeds the backward pass from the loss, and applies the chain rule from right to left.`,
      ],
    },
    {
      heading: `The naive approach`,
      paragraphs: [
        `The naive way to assign blame is to perturb one parameter at a time. Add a tiny epsilon to weight 1, rerun the network, measure whether the loss changed, undo the change, and repeat for weight 2, weight 3, and so on. This finite-difference idea is easy to understand and useful for checking a small implementation, but it is hopeless as a training method.`,
        `The cost breaks immediately. A model with one million parameters would need about one million extra forward passes to estimate one gradient vector. A modern language model has billions of parameters. Even if the estimates were accurate, the training loop would be too slow by orders of magnitude. The estimates are also noisy because epsilon must be small enough to approximate a derivative but large enough to survive floating-point roundoff.`,
        `Another naive approach is local tweaking: increase weights that appear on paths to a good answer and decrease weights that appear on paths to a bad one. That fails because neural networks are composed systems. A weight can push an activation up, an activation can be gated by ReLU, another weight can flip the sign, and the loss can curve differently depending on the output. Blame is not visible from topology alone. It has to be computed through the actual numeric path the example took.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is that the chain rule can be organized as dynamic programming on the computation graph. You do not need to differentiate the whole network separately for every parameter. Start with the derivative of the loss with respect to the output. Then reuse that downstream derivative as you walk backward through each operation.`,
        `If y_hat = a1*w1 + a2*w2 + b, then the derivative of the loss with respect to w1 is the downstream error times a1. The derivative with respect to a1 is the downstream error times w1. One local rule gives two pieces of reusable information. Matrix multiply, addition, ReLU, softmax, normalization, and attention all have local derivative rules like this. Backprop just composes them in reverse order.`,
        `This is why backprop scales. A backward pass touches each operation and each edge of the graph in a structured way. It is not one experiment per parameter. It is one reverse sweep that shares intermediate gradients. That efficiency is the difference between neural networks as a clever idea and neural networks as a trainable technology.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Training begins with a forward pass. The model receives an input, computes hidden pre-activations, applies activation functions, produces an output, and computes a scalar loss. During that pass, the system keeps values needed later: inputs to layers, pre-activation values for ReLU gates, activations feeding the next layer, and sometimes normalization statistics or attention probabilities.`,
        `The backward pass starts at the loss. For squared error, dL/dy_hat = 2*(y_hat - y). That number is the seed gradient. It says how the loss changes if the prediction moves upward. The output-layer weights then receive gradients equal to hidden activation times that seed. If a hidden activation was zero, the weight attached to it gets zero gradient on this example because that path carried no signal into the output.`,
        `The gradient then moves through the activation function. A ReLU passes the gradient through when its pre-activation was positive and blocks it when the pre-activation was negative. Sigmoid and tanh pass scaled gradients that can become small near saturation. This is why Activation Functions are not cosmetic. They decide how signal moves forward and how blame moves backward.`,
        `For a dense layer, the first-layer weight gradients form an outer product: input value times hidden-layer error. A negative input can flip the sign of the gradient. Bias gradients receive the downstream error directly because adding a bias has derivative 1. After gradients are computed, the optimizer applies an update. Plain stochastic gradient descent uses w <- w - learning_rate * gradient. Momentum, RMSProp, Adam, weight decay, and learning-rate schedules change the update rule, but they still depend on the gradient backprop provides.`,
      ],
    },
    {
      heading: `What the visual is proving`,
      paragraphs: [
        `The visual uses a tiny 2-3-1 network so the whole training step can fit on the screen. The first panel is not training yet. It is the stored forward pass: hidden activations, prediction, target, and loss. Those cached activations are the data the backward pass will reuse.`,
        `The seed-gradient panel proves that the loss starts the backward pass with one number. The output-layer panel proves that a weight only receives blame through the activation it carried. The hidden neuron with zero activation is important: its outgoing weight may exist, but it did not affect this prediction, so it receives no output-layer gradient for this example.`,
        `The ReLU panel proves that gates matter in both directions. A neuron silenced on the forward pass can also block learning on the backward pass. The first-layer panel proves that input signs matter; a negative input reverses the direction of the weight update. The final panel proves the practical point: after one gradient step, the same input is rerun and the loss drops. The animation is not only showing derivatives. It is showing why those derivatives become learning.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Backprop works because every operation has a local derivative, and the chain rule tells you how to multiply local effects into global effects. The derivative at a weight does not need to know the entire network in one formula. It needs the input value that reached the weight and the downstream gradient that returned from the rest of the graph.`,
        `The guarantee is narrower than beginners sometimes assume. Backprop gives the gradient of the loss you wrote for the computation you executed. It does not guarantee that the loss matches the real goal, that the data is clean, that the optimizer will find a good minimum, or that one step will improve every future example. It supplies accurate local slope information. Training still has to use that information well.`,
      ],
    },
    {
      heading: `Cost and tradeoffs`,
      paragraphs: [
        `The major cost win is that one backward traversal gives gradients for all parameters. For dense neural networks, backward compute is usually on the same order as forward compute, often roughly two to three times a forward pass once all gradient calculations are included. That is expensive, but it is not one forward pass per weight. This scaling fact is why billion-parameter training is possible at all.`,
        `The harsher cost is often memory. Training must keep activations for backward, parameter gradients, optimizer state, and sometimes master fp32 copies of weights. Adam can require much more memory than plain SGD because it stores running first and second moments. Larger batches increase activation memory. Longer sequences increase it again. In transformer training, activation memory is a major reason training is far more expensive than inference.`,
        `The common tradeoff is recomputation. Gradient checkpointing discards selected activations during the forward pass and recomputes them during backward to save memory. Mixed precision reduces memory bandwidth and storage but requires numerical care. Distributed training adds communication costs because gradients must be reduced across devices.`,
      ],
    },
    {
      heading: `Real uses`,
      paragraphs: [
        `Backpropagation trains almost every modern neural model: image classifiers, speech models, recommenders, diffusion models, language models, graph neural networks, tabular MLPs, and reinforcement-learning value or policy networks. Fine-tuning also uses it. The model starts from pretrained weights, computes task loss on new examples, backpropagates through the chosen layers, and updates a smaller or larger part of the network.`,
      ],
    },
    {
      heading: `Failure modes`,
      paragraphs: [
        `The first failure mode is a bad objective. If the loss rewards the wrong behavior, backprop will faithfully optimize the wrong behavior. A recommender can learn clickbait, a language model can learn benchmark shortcuts, and a classifier can learn dataset artifacts. Gradients do not know intent. They only know the loss surface.`,
        `The second failure mode is unstable optimization. A learning rate that is too high can overshoot and increase loss. A learning rate that is too low can waste compute. Deep products of Jacobians can create vanishing or exploding gradients. Dead ReLUs can block learning for units that rarely activate. Poor initialization can make early gradients useless. Normalization, residual connections, gradient clipping, careful initialization, and learning-rate warmup exist because raw backprop through deep systems is often fragile.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Neural Network Forward Pass before this topic if the cached activations are not clear. Then read Gradient Descent for the simplest update rule, Activation Functions for derivative gates, and Vanishing and Exploding Gradients for the depth failure modes. Momentum, RMSProp and Adam show how optimizers reshape raw gradients into more useful steps.`,
        `After that, connect backprop to BatchNorm and LayerNorm, Residual Networks, Learning-Rate Schedules and Warmup, The Loss Landscape in 3D, Automatic Differentiation, and Gradient Checkpointing. The recurring question is always the same: what computation produced the loss, what local derivatives does it expose, and what does the optimizer do with the gradient it receives?`,
      ],
    },
  ],
};
