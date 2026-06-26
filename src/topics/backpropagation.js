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
        'The animation builds a computation graph for a 2-input, 3-hidden, 1-output network and runs one complete training step through it. Each panel corresponds to one stage: forward pass values, the seed gradient at the loss, gradient flow back through each layer, and the parameter update. Watch the numbers, not the motion -- each cell holds a value the algorithm actually computes.',
        'Forward pass values appear left to right. Inputs become pre-activations (z), pre-activations become post-activations (a) through ReLU, and activations become the prediction y_hat. Every intermediate value is cached because the backward pass will need it. If a cell holds zero after ReLU, that neuron is dead for this input -- no signal went forward, and no gradient will go backward.',
        'Gradient flow runs right to left. Highlighted cells mark the gradient currently being computed. A zero gradient means ReLU gated that neuron off during the forward pass, so the backward pass cannot push error through it either. The forward gate and the backward gate are the same gate -- this is the single most important visual cue in the animation.',
        'The final panel reruns the forward pass with updated weights and compares loss before and after. If the loss dropped, the gradients pointed downhill and the learning rate was small enough to follow them. One backward sweep, all weights updated, network measurably less wrong.',
        {type: 'callout', text: 'Backpropagation makes every cached forward value reusable so one reverse sweep assigns blame to every weight.'},
        {type: 'image', src: './assets/gifs/backpropagation.gif', alt: 'Animated walkthrough of the backpropagation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A neural network predicts by multiplying inputs through layers of weights. When the prediction is wrong, a loss function collapses the entire error into a single number. But that number does not say which weight caused the mistake or which direction to move it. Training needs the partial derivative of the loss with respect to every weight -- the full gradient vector -- so each parameter can be nudged in the direction that reduces error.',
        'A partial derivative answers a precise question: if I increase this one weight by an infinitesimal amount and hold everything else fixed, how does the loss change? A positive derivative means the weight is pushing the loss up, so decreasing it helps. A negative derivative means increasing it helps. The gradient vector collects all of these answers into one object.',
        'Manual differentiation is possible for toy networks but absurd at scale. A modern language model has billions of parameters. Computing each gradient symbolically by hand is not a real option. The field needed an algorithm that could compute all gradients mechanically, in one pass, from any differentiable computation graph. Backpropagation is that algorithm.',
        'Reverse-mode automatic differentiation was first described by Linnainmaa in 1970 as a method for propagating rounding errors through chains of computation. Werbos applied the idea to neural networks in 1974. Rumelhart, Hinton, and Williams popularized it in their 1986 Nature paper "Learning Representations by Back-Propagating Errors," showing that multi-layer networks could learn useful internal representations when trained this way. Every neural network trained since uses backpropagation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Numerical differentiation estimates each gradient independently. For a weight w_i, add a tiny perturbation epsilon (say 0.0001), rerun the forward pass, and compute the finite difference: dL/dw_i is approximately (L(w_i + epsilon) - L(w_i)) / epsilon. This requires no calculus and no knowledge of layer internals -- just the ability to evaluate the loss function.',
        'For a network with 10 weights, run 11 forward passes (one baseline plus one per weight) and you have a usable gradient vector. The estimates are noisy but functional. Any engineer confronting the gradient problem for the first time would reach for this: perturb one weight, measure the loss change, compute the ratio, repeat. It is the finite-difference method from introductory numerical analysis, applied weight by weight.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Numerical differentiation costs one forward pass per parameter. A network with n weights needs n + 1 forward passes to estimate one gradient vector. For 10 weights that is fine. For a million weights it means a million forward passes per training step. GPT-3 has 175 billion parameters -- 175 billion forward passes for a single gradient update, before the optimizer even takes one step.',
        'Training typically requires thousands to millions of gradient updates. The total cost is proportional to n times the number of steps, which puts numerical differentiation beyond any feasible compute budget for modern networks. A single training run that takes days with backpropagation would take geological time with finite differences.',
        'There is also a precision problem. Epsilon must be small enough to approximate a true derivative but large enough to survive floating-point roundoff. In deep networks with many layers of multiplication, finite-difference errors compound. The method becomes both too slow and too noisy exactly where it matters most. What is needed is all n gradients from one backward pass, not n separate experiments.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The chain rule decomposes the derivative of a composition into a product of local derivatives. If the network computes L = f(g(h(x))), then dL/dx = (dL/df) * (df/dg) * (dg/dh) * (dh/dx). Each factor depends only on the operation at that node and the values that were already computed during the forward pass. No factor requires knowledge of the full network.',
        'Reverse mode exploits the fact that you want one scalar (the loss) differentiated with respect to many variables (all the weights). Start at the loss, compute one gradient, and at each node split the incoming gradient to all its inputs. Every path from a weight to the loss shares intermediate gradient values with other paths. Computing in reverse means you compute each shared value once and reuse it for every downstream weight. This is dynamic programming applied to differentiation -- the same principle that makes the Viterbi algorithm and matrix-chain multiplication efficient.',
        'The result: one forward pass to compute and cache all intermediate values, then one backward pass of comparable cost to compute all gradients. The total work is O(n) regardless of how deep the network is, compared to O(n) per parameter for finite differences. This efficiency gap is the reason deep learning is possible at all.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Backpropagation has two phases. The forward pass runs the input through the network left to right, computing and caching every intermediate value: pre-activations z (the weighted sum before activation), post-activations a (the output of the activation function), and the final prediction y_hat. The backward pass walks the computation graph in reverse topological order, applying the chain rule at each node to propagate the gradient of the loss back to every parameter.',
        'The backward pass starts at the loss. For squared error L = (y_hat - y)^2, the seed gradient is dL/dy_hat = 2(y_hat - y). This single number is the starting signal. Every other gradient in the network is this seed, multiplied backward through chain-rule factors at each operation.',
        'At each node, the rule is: dL/dx = dL/dy * dy/dx, where y is the node\'s output and x is its input. Three gate types cover most neural network arithmetic. A multiply gate distributes: if y = w * a, then dL/dw = dL/dy * a and dL/da = dL/dy * w. An add gate copies: if y = a + b, then dL/da = dL/dy and dL/db = dL/dy (derivative of addition is 1). A ReLU gate switches: if y = max(0, x), then dL/dx = dL/dy when x > 0, and dL/dx = 0 when x <= 0.',
        {type: 'image', src: 'https://emjayahn.github.io/2019/05/18/CS231n-Lecture04-Summary/Untitled-13d44613-a85b-4dcc-a807-8b114b0138c4.png', alt: 'Computation graph with addition and multiplication gates plus chain rule gradients.', caption: 'The graph shows the local chain-rule calculation that backprop repeats through a whole network. (Source: emjayahn.github.io)'},
        'For the output layer, each weight gradient equals the activation it carried times the seed: dL/dw2_j = a_j * dL/dy_hat. If a hidden neuron produced zero activation (ReLU killed it), its output-layer weight gets zero gradient. That path carried nothing forward and receives no blame backward.',
        'Through ReLU, the gradient is gated by the same condition that gated the activation. A neuron with positive pre-activation (z > 0) passes its gradient unchanged -- ReLU\'s derivative is 1 in this region. A neuron with negative pre-activation (z <= 0) blocks the gradient entirely -- ReLU\'s derivative is 0. The same gate that silenced the neuron forward silences its learning backward.',
        'At the first layer, weight gradients form the outer product of the input vector and the post-ReLU error vector: dL/dw1_ij = x_i * dL/dz_j. A negative input flips the gradient sign because the chain rule multiplies through x_i. Bias gradients equal the downstream error directly, since the derivative of (z + b) with respect to b is 1.',
        'After all gradients are computed, the optimizer updates each weight: w <- w - lr * dL/dw. That is gradient descent. More sophisticated optimizers (Adam, SGD with momentum, AdaGrad) modify this update rule, but they all consume the same gradient vector that backpropagation produced.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from the chain rule of calculus. If y = f(g(x)), then dy/dx = f\'(g(x)) * g\'(x). A neural network is a composition of differentiable operations -- linear transforms, activations, loss computation -- and each operation has a known, simple local derivative. Multiplying these local derivatives together along any path from a weight to the loss gives the exact partial derivative of the loss with respect to that weight. Backpropagation automates this multiplication in reverse topological order.',
        'Efficiency comes from the direction of traversal. The loss is one scalar, but there are n weights. Reverse mode starts from the one output and fans backward to all n inputs. At each node, the incoming gradient (already computed) is multiplied by the local derivative and sent to all of that node\'s inputs. Every intermediate gradient is computed once and reused for every weight downstream of it. Forward mode would start from one input weight and fan forward to the one output -- useful if you want one weight\'s gradient, but you would have to repeat it n times for all weights.',
        {type: 'image', src: 'https://emjayahn.github.io/2019/05/18/CS231n-Lecture04-Summary/Untitled-f2d8c1d9-1a28-4e16-8e35-83ff9f93045f.png', alt: 'Backpropagation diagram showing forward values and local gradients.', caption: 'Each node only needs its local derivative and the incoming gradient, which is why reverse-mode reuse works. (Source: emjayahn.github.io)'},
        'The cost comparison is decisive. Reverse-mode autodiff computes all n gradients in one backward pass -- O(n) total work, proportional to the forward pass. Forward-mode autodiff needs one pass per parameter: O(n^2) total for all gradients. Numerical differentiation needs n + 1 forward passes: also O(n^2) total, plus the noise from finite epsilon. Reverse mode is the only approach that scales to billions of parameters.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The backward pass costs roughly 2-3x the forward pass in compute. The same matrix multiplications run in reverse, plus local derivative evaluations at each node. The critical point: this cost does not grow with parameter count in the way finite differences do. A network with 100 weights and one with 100 billion weights both need exactly one backward pass. Double the parameters and the backward pass takes about twice as long (more operations), but it is still one pass, not 200 billion separate experiments.',
        'Memory is the harder cost. The backward pass needs the cached forward activations -- every pre-activation z, every post-activation a, every intermediate matrix product. Each parameter also needs storage for its gradient, and the optimizer adds its own state. Adam keeps two extra vectors per parameter (running mean and running variance of past gradients), tripling the per-parameter memory. For large transformers, activation memory is typically the binding constraint, not compute.',
        'Activation checkpointing trades compute for memory: discard some cached activations during the forward pass and recompute them during the backward pass when they are needed. This reduces activation memory from O(L) to O(sqrt(L)) for L layers, at the cost of roughly one extra forward pass. Mixed-precision training (fp16 or bf16 forward, fp32 gradient accumulation) halves activation memory and doubles throughput on GPUs with tensor cores, but requires loss scaling to prevent small gradients from underflowing to zero in low-precision formats.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every neural network trained since 1986 uses backpropagation. Convolutional networks for images, recurrent networks for sequences, transformers for language, diffusion models for generation, graph neural networks for molecular and social data, reinforcement-learning policy networks -- all trained by the same four-beat loop: forward pass, loss, backward pass, update. The architecture changes; the gradient algorithm does not.',
        'Fine-tuning a pretrained model is the same algorithm with a twist: some layers are frozen (excluded from gradient computation) and only the target layers receive updates. LoRA and adapter methods insert small trainable matrices into a frozen backbone; backpropagation computes gradients only for those inserted parameters, leaving the rest untouched.',
        'Modern frameworks hide the backward pass entirely. In PyTorch, calling loss.backward() traverses the dynamically built computation graph and populates every parameter\'s .grad attribute. TensorFlow\'s GradientTape records operations and computes gradients on demand. JAX\'s jax.grad transforms a forward function into a gradient function at the language level. The programmer writes only the forward computation; the framework derives and executes the backward pass. This is automatic differentiation as daily infrastructure.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Vanishing gradients: gradients are products of many local derivatives, one per layer. If each factor is less than 1, the product shrinks exponentially with depth. Sigmoid saturates with a maximum derivative of 0.25, so ten sigmoid layers multiply the gradient by roughly 0.25^10 -- about one millionth. Early layers receive almost no learning signal and stop learning. ResNet skip connections fix this by providing a gradient highway that bypasses the shrinking product chain. LSTM gating fixes it for sequences by adding a cell state that carries gradients across time steps without repeated multiplication.',
        'Exploding gradients: the opposite failure. If local derivatives exceed 1 at many layers, gradients grow exponentially and the optimizer takes a catastrophically large step, often producing NaN losses. Gradient clipping caps the gradient norm before the update step (typical threshold: 1.0). Careful weight initialization (Xavier for sigmoid/tanh, He for ReLU) keeps gradients in a stable range at the start of training by matching the variance of inputs and outputs at each layer.',
        'Non-differentiable operations break the chain rule. Hard thresholds, argmax, discrete sampling, and integer indexing have no derivative or a zero derivative everywhere. Straight-through estimators bypass the problem by pretending the derivative is 1 through the non-differentiable step. Gumbel-softmax relaxes discrete choices into differentiable soft choices with a temperature parameter. Reinforcement learning sidesteps the issue entirely by using policy gradients to estimate the gradient without differentiating through the environment.',
        'Memory scaling is the practical ceiling. Backpropagation must store all intermediate activations for the backward pass. For a transformer with hundreds of layers and long sequences, activation memory can exceed GPU RAM. Activation checkpointing, gradient accumulation over micro-batches, and model parallelism (splitting layers across multiple GPUs) are engineering responses, but they add complexity and slow training.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A minimal 2-layer network with no activation function, so every gradient is pure arithmetic. Input x = 2. First-layer weight w1 = 0.5. Second-layer weight w2 = 0.3. Bias b = 0.1. Target y = 1.0.',
        'Forward pass: hidden value h = w1 * x = 0.5 * 2 = 1.0. Output y_hat = w2 * h + b = 0.3 * 1.0 + 0.1 = 0.4. Loss L = (y_hat - y)^2 = (0.4 - 1.0)^2 = (-0.6)^2 = 0.36. The network\'s prediction is 0.4 but the correct answer is 1.0, so the squared error is 0.36.',
        'Backward pass, step 1 -- the seed: dL/dy_hat = 2(y_hat - y) = 2(0.4 - 1.0) = 2(-0.6) = -1.2. The negative sign means the prediction is too low. Anything that pushed y_hat down gets negative blame, which the update rule will interpret as "increase this weight."',
        'Backward pass, step 2 -- output layer: dL/dw2 = dL/dy_hat * h = -1.2 * 1.0 = -1.2. The gradient says w2 should increase (negative gradient, so subtracting it adds). dL/db = dL/dy_hat * 1 = -1.2 (bias derivative is always 1). dL/dh = dL/dy_hat * w2 = -1.2 * 0.3 = -0.36. This last gradient is the chain rule in action: it propagates the error through w2 to reach the hidden layer.',
        'Backward pass, step 3 -- first layer: dL/dw1 = dL/dh * x = -0.36 * 2 = -0.72. Three weights, three gradients, one backward pass, no numerical approximation. Each gradient is the exact partial derivative of the loss, computed by multiplying local derivatives along the path from that weight to the loss.',
        {type: 'image', src: 'https://emjayahn.github.io/2019/05/18/CS231n-Lecture04-Summary/Untitled-7a11e194-ea07-4922-a7b5-aa4346476acb.png', alt: 'Add, max, and multiply gates with their backward gradient behavior.', caption: 'Gate-level derivative rules connect the toy worked example to the reusable mechanics of automatic differentiation. (Source: emjayahn.github.io)'},
        'Update with learning rate lr = 0.1: w1_new = 0.5 - 0.1 * (-0.72) = 0.5 + 0.072 = 0.572. w2_new = 0.3 - 0.1 * (-1.2) = 0.3 + 0.12 = 0.42. b_new = 0.1 - 0.1 * (-1.2) = 0.1 + 0.12 = 0.22. Each weight moves opposite to its gradient, scaled by the learning rate.',
        'Verify with a new forward pass: h_new = 0.572 * 2 = 1.144. y_hat_new = 0.42 * 1.144 + 0.22 = 0.48048 + 0.22 = 0.70048. New loss = (0.70048 - 1.0)^2 = (-0.29952)^2 = 0.08971. Loss dropped from 0.36 to 0.09 -- a 75% reduction from a single step. The prediction moved from 0.4 to 0.7, closer to the target of 1.0. Repeat this loop thousands of times and the loss converges toward zero.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Linnainmaa, "The Representation of the Cumulative Rounding Error of an Algorithm as a Taylor Expansion of the Local Rounding Errors" (1970) -- the first description of reverse-mode automatic differentiation, the mathematical foundation beneath backpropagation. Rumelhart, Hinton & Williams, "Learning Representations by Back-Propagating Errors," Nature (1986) -- the paper that demonstrated backprop could train multi-layer networks to learn useful internal representations, launching modern neural network research. Goodfellow, Bengio & Courville, "Deep Learning" (2016), Chapter 6.5 -- the clearest modern textbook treatment of backprop as a special case of automatic differentiation.',
        'Prerequisites: Neural Network Forward Pass (the forward computation that backprop differentiates through). The chain rule from single-variable calculus is the only mathematical prerequisite. Multivariable calculus (partial derivatives) helps but is not required to follow the algorithm -- the chain rule applies the same way along each path.',
        'Next steps by role. Optimizers that consume backprop\'s gradients: Gradient Descent (the simplest update rule), Adam Optimizer (adaptive learning rates per parameter). Gradient flow and stability: Activation Functions (their derivatives control which paths carry blame), Batch Normalization (stabilizes gradient scale across layers). Architecture-level gradient solutions: ResNet and skip connections (gradient highways through very deep networks). The general framework: computational graphs and automatic differentiation.',
      ],
    },
  ],
};

