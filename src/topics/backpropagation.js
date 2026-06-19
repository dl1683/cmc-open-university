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
      title: `Forward pass recap: prediction Å· = ${r2(out)}, truth y = ${r2(y)}`,
      rows: [{ id: 'a', label: 'a' }],
      columns: hidden,
      values: [a.map(r2)],
    }),
    highlight: {},
    explanation: `Same 2-3-1 network as Neural Network Forward Pass, same input [${X.join(', ')}]: hidden activations a = [${a.map(r2).join(', ')}], prediction Å· = ${r2(out)}. But the CORRECT answer is ${y}. Loss = (Å· âˆ’ y)² = ${r3(loss)}. The question backpropagation answers: which of the 13 weights deserves how much blame — and in which direction should each one move?`,
  };

  const dOut = 2 * (out - y);
  yield {
    state: matrixState({
      title: 'The seed gradient: dL/dÅ· = 2(Å· âˆ’ y)',
      rows: [{ id: 'g', label: 'âˆ‚L' }],
      columns: [{ id: 'dy', label: 'âˆ‚Å·' }],
      values: [[r3(dOut)]],
    }),
    highlight: { active: ['g:dy'] },
    explanation: `Differentiate the loss: dL/dÅ· = 2(Å· âˆ’ y) = ${r3(dOut)}. ${dOut > 0 ? 'Positive: the prediction is too HIGH, so anything that pushed Å· up gets positive blame.' : 'Negative: the prediction is too LOW.'} This single number is the seed — every other gradient in the network is this, multiplied backward through the chain rule.`,
  };

  const dW2 = a.map((aj) => aj * dOut);
  yield {
    state: matrixState({
      title: 'Output-layer gradients: âˆ‚L/âˆ‚Wâ‚‚ = a Ã— dL/dÅ·',
      rows: [{ id: 'gw2', label: 'âˆ‚Wâ‚‚' }],
      columns: hidden,
      values: [dW2.map(r3)],
    }),
    highlight: { active: ['gw2:h1'] },
    explanation: `Chain rule, step one: each output weight's blame = (the activation it carried) Ã— (the downstream error): âˆ‚L/âˆ‚Wâ‚‚ = [${dW2.map(r3).join(', ')}]. Read the middle one: neuron 2's activation was 0, so its weight carried NOTHING into the error — zero blame, zero learning. Blame flows only through paths that actually fired.`,
  };

  const dA = W2.map((w) => w * dOut);
  const dZ = dA.map((g, j) => (z[j] > 0 ? g : 0));
  yield {
    state: matrixState({
      title: "Through ReLU: âˆ‚L/âˆ‚z = âˆ‚L/âˆ‚a âŠ™ ReLU′(z)",
      rows: [{ id: 'da', label: 'âˆ‚a' }, { id: 'dz', label: 'âˆ‚z' }],
      columns: hidden,
      values: [dA.map(r3), dZ.map(r3)],
    }),
    highlight: { active: ['dz:h1'] },
    explanation: `Step two: pass the blame through the activation. ReLU's derivative is 1 where z was positive, 0 where it was negative — so neuron 2 (z = ${r2(z[1])} < 0) BLOCKS its gradient entirely: âˆ‚L/âˆ‚z = [${dZ.map(r3).join(', ')}]. The gate that silenced it forward silences its learning backward. (This is exactly the "dead ReLU" risk from Activation Functions.)`,
    invariant: 'Gradients flow backward through precisely the paths the data flowed forward.',
  };

  const dW1 = [0, 1].map((i) => [0, 1, 2].map((j) => X[i] * dZ[j]));
  yield {
    state: matrixState({
      title: 'Input-layer gradients: âˆ‚L/âˆ‚Wâ‚ = x âŠ— âˆ‚L/âˆ‚z',
      rows: [{ id: 'rx1', label: 'xâ‚' }, { id: 'rx2', label: 'xâ‚‚' }],
      columns: hidden,
      values: dW1.map((row) => row.map(r3)),
    }),
    highlight: {},
    explanation: `Step three: the first layer. Each weight's blame = (its input) Ã— (its neuron's blame): an outer product. Note the sign flips on the xâ‚‚ row — xâ‚‚ = ${X[1]} is negative, so increasing those weights DECREASES the prediction. The chain rule handles all of this bookkeeping mechanically; in PyTorch this entire process is the single call loss.backward().`,
  };

  const W2n = W2.map((w, j) => w - lr * dW2[j]);
  const B2n = B2 - lr * dOut;
  const W1n = W1.map((row, i) => row.map((w, j) => w - lr * dW1[i][j]));
  const B1n = B1.map((b, j) => b - lr * dZ[j]);
  const after = forward(W1n, B1n, W2n, B2n);
  const newLoss = (after.out - y) ** 2;

  yield {
    state: matrixState({
      title: `Update (lr=${lr}) and re-run: loss ${r3(loss)} â†’ ${r3(newLoss)}`,
      rows: [{ id: 'before', label: 'before' }, { id: 'after', label: 'after' }],
      columns: [{ id: 'pred', label: 'Å·' }, { id: 'l', label: 'loss' }],
      values: [[r2(out), r3(loss)], [r2(after.out), r3(newLoss)]],
    }),
    highlight: { active: ['after:l'] },
    explanation: `Every weight takes one step against its gradient: w â† w âˆ’ ${lr}Â·âˆ‚L/âˆ‚w (that's Gradient Descent). Then run the SAME input forward again: Å· moves from ${r2(out)} to ${r2(after.out)}, and the loss drops from ${r3(loss)} to ${r3(newLoss)}. The network is measurably less wrong — after ONE step.`,
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
    explanation: `Forward â†’ loss â†’ backward â†’ update. That four-beat loop, repeated millions of times over millions of examples, is ALL that "training a neural network" means — including the LLM you might be reading this with. Backprop's deeper claim: it computes the gradient for every one of n weights in one backward sweep costing about as much as the forward pass — not n separate experiments. That efficiency is why deep learning is possible at all.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation builds a computation graph for a 2-input, 3-hidden, 1-output network, then runs one complete training step through it. Each panel corresponds to one stage: forward pass values, the seed gradient at the loss, gradient flow back through each layer, and the parameter update.',
        'Forward pass values appear left to right: inputs become pre-activations, pre-activations become post-activations through ReLU, activations become the prediction. The numbers in each cell are the cached intermediate values that the backward pass will need.',
        'Gradient flow arrows run right to left -- the reverse direction. Highlighted cells mark the gradient currently being computed. A zero gradient means that neuron was gated off by ReLU during the forward pass, so no error signal passes through it backward either. The forward gate and the backward gate are the same gate.',
        'The final panel reruns the forward pass with updated weights. The before-and-after loss comparison is the payoff: if the loss dropped, the gradients pointed downhill and the learning rate was small enough to follow them. One backward sweep, all weights updated, network measurably less wrong.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A neural network predicts by multiplying inputs through layers of weights. When the prediction is wrong, the loss quantifies the error as a single number. But that number does not say which of the thousands or millions of weights caused the mistake, or which direction each one should move. Training requires the partial derivative of the loss with respect to every weight -- the full gradient vector -- so each parameter can be nudged in the direction that reduces the error.',
        'Manual differentiation is possible for small networks but impractical at scale. A modern language model has billions of parameters. Computing each gradient by hand, even once, is not a real option. The field needed an algorithm that could compute all gradients mechanically, in one pass, from any differentiable computation graph.',
        'Reverse-mode automatic differentiation was first described by Linnainmaa in 1970 as a method for propagating rounding errors. Werbos applied the idea to neural networks in 1974. Rumelhart, Hinton, and Williams popularized it in their 1986 Nature paper "Learning Representations by Back-Propagating Errors," showing that multi-layer networks could learn useful internal representations when trained this way. Every neural network trained since -- from LeNet to GPT-4 -- uses backpropagation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Numerical differentiation estimates each gradient independently. For a weight w_i, add a tiny perturbation epsilon, rerun the forward pass, and compute the finite difference: dL/dw_i is approximately (L(w_i + epsilon) - L(w_i)) / epsilon. This requires no calculus and no knowledge of layer internals -- just the ability to evaluate the loss.',
        'For a network with 10 weights, run 11 forward passes (one baseline plus one per weight) and you have a usable gradient vector. The estimates are noisy but functional. Any engineer confronting the gradient problem for the first time would reach for this: perturb, measure, repeat. It is the finite-difference method from introductory numerical analysis, applied weight by weight.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Numerical differentiation costs one forward pass per parameter. A network with n weights needs n + 1 forward passes to estimate one gradient vector. For 10 weights that is fine. For a million weights it means a million forward passes per training step. GPT-3 has 175 billion parameters -- 175 billion forward passes for a single gradient update, before the optimizer even takes one step.',
        'The cost is linear in the number of parameters, and training typically requires thousands to millions of gradient updates. The total work is n times the number of steps, which puts numerical differentiation beyond any feasible compute budget for modern networks.',
        'There is also a precision problem. Epsilon must be small enough to approximate a true derivative but large enough to survive floating-point roundoff. In deep networks, the finite-difference errors compound through many layers. The method becomes both too slow and too noisy exactly where it matters most. Training needs all n gradients in one backward pass, not n separate experiments.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Backpropagation has two phases. The forward pass runs the input through the network left to right, computing and caching every intermediate value: pre-activations z, post-activations a, and the final prediction y_hat. The backward pass then walks the computation graph in reverse topological order, applying the chain rule at each node to propagate the gradient of the loss back to every parameter.',
        'The chain rule says: if y = f(g(h(x))), then dy/dx = df/dg * dg/dh * dh/dx. Each factor is a local derivative -- the derivative of one operation with respect to its immediate input. Backpropagation multiplies these local derivatives together, working from the loss backward toward the input, accumulating the global derivative along the way.',
        'The backward pass starts at the loss. For squared error L = (y_hat - y)^2, the seed gradient is dL/dy_hat = 2(y_hat - y). This single number is the starting signal. Every other gradient in the network is this seed, multiplied backward through chain-rule factors at each operation.',
        'At each node in the graph, the rule is the same: dL/dx = dL/dy * dy/dx, where y is the node output and x is its input. Three operations cover most of neural network arithmetic. A multiply gate distributes: if y = w * a, then dL/dw = dL/dy * a and dL/da = dL/dy * w. An add gate copies: if y = a + b, then dL/da = dL/dy and dL/db = dL/dy. A ReLU gate switches: if y = max(0, x), then dL/dx = dL/dy when x > 0, and dL/dx = 0 when x <= 0.',
        'For the output layer, each weight gradient equals the activation it carried times the seed: dL/dw2_j = a_j * dL/dy_hat. If a hidden neuron produced zero activation, its weight gets zero gradient -- that path carried nothing forward and receives no blame backward.',
        'Through ReLU, the gradient is gated. A neuron with positive pre-activation passes its gradient unchanged. A neuron with negative pre-activation blocks the gradient entirely. The same gate that silenced the neuron forward silences its learning backward.',
        'At the first layer, weight gradients form the outer product of the input vector and the post-ReLU error vector: dL/dw1_ij = x_i * dL/dz_j. A negative input flips the gradient sign. Bias gradients equal the downstream error directly, since the derivative of an addition by a constant is 1.',
        'After all gradients are computed, the optimizer updates each weight: w <- w - lr * dL/dw. That is gradient descent. Adam, momentum, and weight decay modify this update rule, but they all consume the same gradient vector that backprop produced.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The chain rule of calculus guarantees that the derivative of a composition f(g(h(x))) equals the product of each function\'s local derivative evaluated at its input: f\'(g(h(x))) * g\'(h(x)) * h\'(x). A neural network is exactly such a composition -- input, linear transform, activation, another linear transform, loss -- and each operation has a known, simple local derivative. The chain rule lets you multiply these together to get the exact derivative of the loss with respect to any weight, no matter how deep.',
        'The efficiency comes from the direction of computation. Reverse mode computes dL/dy at the output once, then reuses it for every output-layer weight. The gradient flowing back to the hidden layer is computed once, then reused for every first-layer weight. Each intermediate result is shared, not recomputed. This is the same dynamic-programming insight that makes Viterbi and forward-backward algorithms efficient: compute partial results once, propagate, reuse.',
        'Reverse-mode autodiff computes the gradient of one scalar (the loss) with respect to all n parameters in one backward pass -- O(n) total work, same as the forward pass. Forward-mode autodiff would need one pass per parameter. Numerical differentiation would need n + 1 forward passes. The reverse structure is what makes training networks with billions of parameters feasible.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The backward pass costs roughly 2-3x the forward pass in compute. The same matrix multiplications run in reverse, plus local derivative evaluations at each node. But the critical point: this cost is independent of parameter count in the sense that one backward pass covers all parameters. A network with 100 weights and one with 100 billion weights both need exactly one backward pass.',
        'Memory is the harder cost. The backward pass needs the intermediate activations cached during the forward pass -- every pre-activation, every post-activation, every intermediate matrix product. The gradient for every parameter must also be stored, and the optimizer adds its own state (Adam keeps two extra vectors per parameter: running mean and variance of past gradients). For large transformers, activation memory -- not compute -- is typically the binding constraint.',
        'Activation checkpointing trades compute for memory: discard some cached activations during the forward pass and recompute them during the backward pass when needed. This can reduce activation memory from O(L) to O(sqrt(L)) for L layers, at the cost of roughly one additional forward pass. Mixed-precision training (fp16 or bf16 for the forward pass, fp32 for gradient accumulation) cuts memory and bandwidth further, but requires loss scaling to prevent gradient underflow in low-precision formats.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Every neural network trained since 1986 uses backpropagation. Convolutional networks for images, recurrent networks for sequences, transformers for language, diffusion models for generation, graph neural networks, reinforcement-learning policy networks, and plain tabular MLPs -- all trained by forward pass, loss, backward pass, update. Fine-tuning a pretrained model uses the same algorithm; the only difference is which layers receive gradient updates and which are frozen.',
        'Modern frameworks hide the backward pass entirely. PyTorch builds the computation graph dynamically during the forward pass, then loss.backward() runs the entire backward pass and populates every parameter\'s .grad attribute. TensorFlow uses GradientTape to record operations and compute gradients on demand. JAX uses jax.grad to transform a forward function into a gradient function. The programmer writes only the forward computation; the framework derives and executes the backward pass automatically. This is automatic differentiation in daily practice.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Vanishing gradients: gradients are products of many local derivatives, one per layer. If each factor is less than 1, the product shrinks exponentially with depth. Sigmoid saturates with a maximum derivative of 0.25, so ten sigmoid layers multiply the gradient by roughly 0.25^10 -- about one millionth. Early layers receive almost no learning signal. ResNet skip connections fix this by adding a gradient highway that bypasses the shrinking chain. LSTM gating fixes it for sequences. Batch normalization and layer normalization stabilize the scale of activations and gradients across layers.',
        'Exploding gradients: the opposite failure. If local derivatives exceed 1, gradients grow exponentially and the update overshoots wildly, often producing NaN losses. Gradient clipping caps the gradient norm before the optimizer step. Careful weight initialization (Xavier for sigmoid/tanh, He for ReLU) keeps gradients in a stable range at the start of training.',
        'Non-differentiable operations break the chain rule. Hard thresholds, argmax, discrete sampling, and integer indexing have no derivative or a zero derivative everywhere useful. Straight-through estimators pretend the derivative is 1 through a non-differentiable step. Gumbel-softmax relaxes discrete choices into differentiable soft choices. Reinforcement learning uses policy gradients to estimate the gradient without differentiating through the environment at all.',
        'Second-order methods that need the Hessian (the matrix of all second derivatives) are expensive: the Hessian for n parameters is n-by-n, which is infeasible for large networks. Approximations like K-FAC and L-BFGS exist but add complexity and rarely outperform well-tuned first-order methods with Adam.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A minimal 2-layer network with no activation function, so every gradient is pure arithmetic. Input x = 2. First-layer weight w1 = 0.5. Second-layer weight w2 = 0.3. Bias b = 0.1.',
        'Forward pass: hidden value h = w1 * x = 0.5 * 2 = 1.0. Output y_hat = w2 * h + b = 0.3 * 1.0 + 0.1 = 0.4. Target y = 1.0. Loss L = (y_hat - y)^2 = (0.4 - 1.0)^2 = (-0.6)^2 = 0.36.',
        'Backward pass, step 1 -- the seed: dL/dy_hat = 2(y_hat - y) = 2(0.4 - 1.0) = 2(-0.6) = -1.2. Negative seed means the prediction is too low; anything that pushed y_hat down gets negative blame, meaning "increase this weight."',
        'Backward pass, step 2 -- output layer: dL/dw2 = dL/dy_hat * h = -1.2 * 1.0 = -1.2. dL/db = dL/dy_hat * 1 = -1.2 (bias derivative is always 1). dL/dh = dL/dy_hat * w2 = -1.2 * 0.3 = -0.36. The chain rule propagates the error through w2 to reach the hidden layer.',
        'Backward pass, step 3 -- first layer: dL/dw1 = dL/dh * x = -0.36 * 2 = -0.72. Every gradient computed, one pass, no numerical approximation.',
        'Update with learning rate lr = 0.1: w1_new = 0.5 - 0.1 * (-0.72) = 0.5 + 0.072 = 0.572. w2_new = 0.3 - 0.1 * (-1.2) = 0.3 + 0.12 = 0.42. b_new = 0.1 - 0.1 * (-1.2) = 0.1 + 0.12 = 0.22.',
        'Verify with a new forward pass: h_new = 0.572 * 2 = 1.144. y_hat_new = 0.42 * 1.144 + 0.22 = 0.48048 + 0.22 = 0.70048. New loss = (0.70048 - 1.0)^2 = (-0.29952)^2 = 0.08971. Loss dropped from 0.36 to 0.09. Three weights, three gradients, one backward pass. That is backpropagation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Linnainmaa, "The Representation of the Cumulative Rounding Error of an Algorithm as a Taylor Expansion of the Local Rounding Errors" (1970) -- the first description of reverse-mode automatic differentiation, the mathematical foundation beneath backpropagation. Rumelhart, Hinton & Williams, "Learning Representations by Back-Propagating Errors," Nature (1986) -- the paper that demonstrated backprop could train multi-layer networks to learn internal representations, launching modern neural network research.',
        'Prerequisites: Neural Network Forward Pass (the forward computation that backprop differentiates through). The chain rule from single-variable calculus is the only mathematical prerequisite; multivariable calculus helps but is not required to follow the algorithm.',
        'Next steps by role. Optimizers that consume backprop gradients: Gradient Descent, Adam Optimizer. Gradient flow and stability: Activation Functions (their derivatives control which paths carry blame), ResNet and skip connections (gradient highways through deep networks). The general framework: computational graphs and automatic differentiation. Memory efficiency during backprop: activation checkpointing and gradient checkpointing.',
      ],
    },
  ],
};

