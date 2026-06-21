// Weight initialization: scale initial weights so signals neither explode
// nor vanish — Xavier for tanh, Kaiming for ReLU, the variance-preservation
// principle that makes deep networks trainable.

import { plotState } from '../core/state.js';

export const topic = {
  title: 'Weight Initialization',
  slug: 'weight-initialization',
  category: 'AI / ML',
  summary:
    'Scale initial weights so signals neither explode nor vanish — Xavier for tanh, Kaiming for ReLU, the variance-preservation principle.',
  defaultInput: 'layers: 5, width: 256, activation: relu',
};

// ---------------------------------------------------------------- helpers

function parseInput(raw) {
  const text = String(raw ?? topic.defaultInput);
  const layersMatch = text.match(/layers\s*:\s*(\d+)/i);
  const widthMatch = text.match(/width\s*:\s*(\d+)/i);
  const actMatch = text.match(/activation\s*:\s*(\w+)/i);
  const layers = layersMatch ? Math.max(2, Math.min(20, Number(layersMatch[1]))) : 5;
  const width = widthMatch ? Math.max(4, Math.min(1024, Number(widthMatch[1]))) : 256;
  const activation = actMatch ? actMatch[1].toLowerCase() : 'relu';
  return { layers, width, activation };
}

// Seeded PRNG (xorshift32) for reproducible demos.
function xorshift(seed) {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

// Sample from N(0, std) using Box-Muller.
function gaussianSample(rng, std) {
  const u1 = rng() || 1e-10;
  const u2 = rng();
  return std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Simulate forward pass through `numLayers` layers of `width` neurons,
// returning the variance of activations at each layer.
function simulateVariance(numLayers, width, std, activationFn, seed) {
  const rng = xorshift(seed);
  // Input: unit-variance Gaussian vector.
  let activations = Array.from({ length: width }, () => gaussianSample(rng, 1.0));
  const variances = [variance(activations)];

  for (let l = 1; l < numLayers; l++) {
    const next = new Array(width);
    for (let j = 0; j < width; j++) {
      let sum = 0;
      for (let i = 0; i < width; i++) {
        sum += gaussianSample(rng, std) * activations[i];
      }
      next[j] = activationFn(sum);
    }
    activations = next;
    variances.push(variance(activations));
  }
  return variances;
}

function variance(arr) {
  const n = arr.length;
  if (n === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  return arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
}

// Activation functions.
const ACT = {
  relu: (x) => Math.max(0, x),
  tanh: (x) => Math.tanh(x),
  sigmoid: (x) => 1 / (1 + Math.exp(-x)),
  linear: (x) => x,
};

// ---------------------------------------------------------- visualization

const SEED = 42;
const AXES = { x: { label: 'Layer' }, y: { label: 'Activation variance (log₁₀)' } };

function varianceSeries(id, label, variances) {
  return {
    id,
    label,
    points: variances.map((v, i) => ({ x: i, y: Math.log10(Math.max(v, 1e-30)) })),
  };
}

export function* run(input) {
  const { layers, width, activation } = parseInput(input);
  const actFn = ACT[activation] ?? ACT.relu;
  const fanIn = width;
  const fanOut = width;

  // Step 1: Show the network setup.
  yield {
    state: plotState({ axes: AXES, series: [] }),
    highlight: {},
    explanation:
      `A ${layers}-layer network, ${width} neurons per layer, activation: ${activation}. ` +
      'We will push a unit-variance input through this network under four initialization strategies and track how activation variance changes layer by layer.',
  };

  // Step 2: Too-large init (std = 1.0).
  const varLarge = simulateVariance(layers, width, 1.0, actFn, SEED);
  const sLarge = varianceSeries('large', 'std = 1.0 (too large)', varLarge);
  yield {
    state: plotState({ axes: AXES, series: [sLarge] }),
    highlight: { active: ['large'] },
    explanation:
      'With std = 1.0, each neuron sums ' + width + ' weighted inputs. The pre-activation variance grows by a factor of ~' + width +
      ' per layer. Activations explode: gradients overflow, weights diverge, and training fails immediately.',
  };

  // Step 3: Too-small init (std = 0.01).
  const varSmall = simulateVariance(layers, width, 0.01, actFn, SEED);
  const sSmall = varianceSeries('small', 'std = 0.01 (too small)', varSmall);
  yield {
    state: plotState({ axes: AXES, series: [sLarge, sSmall] }),
    highlight: { active: ['small'], visited: ['large'] },
    explanation:
      'With std = 0.01, each layer multiplies variance by ~' + width + ' * 0.01² = ' +
      (width * 0.0001).toFixed(4) + '. Activations collapse toward zero within a few layers. ' +
      'Gradients vanish and early layers receive no useful learning signal.',
  };

  // Step 4: Xavier init (std = sqrt(2 / (fan_in + fan_out))).
  const xavierStd = Math.sqrt(2 / (fanIn + fanOut));
  const varXavier = simulateVariance(layers, width, xavierStd, ACT.tanh, SEED);
  const sXavier = varianceSeries('xavier', `Xavier (std ≈ ${xavierStd.toFixed(4)})`, varXavier);
  yield {
    state: plotState({ axes: AXES, series: [sLarge, sSmall, sXavier] }),
    highlight: { active: ['xavier'], visited: ['large', 'small'] },
    explanation:
      `Xavier initialization sets std = sqrt(2 / (fan_in + fan_out)) = ${xavierStd.toFixed(4)}. ` +
      'This preserves variance through layers when the activation is symmetric around zero (tanh, linear). ' +
      'The curve stays near log₁₀(variance) ≈ 0, meaning variance ≈ 1 at every layer.',
  };

  // Step 5: Kaiming init (std = sqrt(2 / fan_in)).
  const kaimingStd = Math.sqrt(2 / fanIn);
  const varKaiming = simulateVariance(layers, width, kaimingStd, ACT.relu, SEED);
  const sKaiming = varianceSeries('kaiming', `Kaiming (std ≈ ${kaimingStd.toFixed(4)})`, varKaiming);
  yield {
    state: plotState({ axes: AXES, series: [sLarge, sSmall, sXavier, sKaiming] }),
    highlight: { active: ['kaiming'], visited: ['large', 'small', 'xavier'] },
    explanation:
      `Kaiming initialization sets std = sqrt(2 / fan_in) = ${kaimingStd.toFixed(4)}. ` +
      'The extra factor of 2 compensates for ReLU zeroing out roughly half the activations. ' +
      'Without that correction, Xavier applied to ReLU networks would halve the variance at each layer.',
  };

  // Step 6: Comparison summary.
  yield {
    state: plotState({ axes: AXES, series: [sLarge, sSmall, sXavier, sKaiming] }),
    highlight: {},
    explanation:
      'All four strategies side by side. The two extremes (std = 1.0 and std = 0.01) diverge rapidly. ' +
      'Xavier and Kaiming stay flat because they set Var(w) so that Var(output) ≈ Var(input) at each layer. ' +
      'The only difference is the correction factor: Xavier assumes a symmetric activation, Kaiming corrects for ReLU\'s dead half.',
    invariant: 'A good initialization keeps the variance curve flat: neither growing nor shrinking across layers.',
  };
}

// ---------------------------------------------------------------- article

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        {type: 'callout', text: 'Initialization is a variance-control problem: the starting weight scale decides whether signal and gradient survive depth.'},
        'The plot shows layer number on the horizontal axis and the log₁₀ of activation variance on the vertical axis. Each line is one initialization strategy. A flat line near zero means variance stays close to 1 at every layer — the signal propagates cleanly.',
        'A line that climbs steeply means activations are exploding: variance multiplies at each layer until numbers overflow. A line that drops steeply means activations are vanishing: the signal decays toward zero and the network goes silent. The invariant across all frames is that a good initialization keeps the line flat.',
        'Watch the contrast between the first two strategies (too large, too small) and the last two (Xavier, Kaiming). The gap between those pairs is the entire difference between a network that trains and one that does not.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Depth makes variance preservation matter: each layer receives the scale produced by the previous layer. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
        'A neural network starts with random weights and adjusts them by gradient descent. The initial random values are not a formality. Each layer multiplies the input by a weight matrix, and the variance of the output depends on the variance of the weights, the number of inputs (fan-in), and the activation function. If the per-layer variance factor is even slightly above 1, it compounds exponentially across depth. A 50-layer network with a per-layer factor of 1.01 ends at 1.01⁵⁰ ≈ 1.64 — mild growth. With a factor of 2: 2⁵⁰ ≈ 10¹⁵ — total explosion.',
        'The same compounding works in reverse for backpropagation. Gradients travel backward through the same weight matrices. If the forward signal explodes, gradients also explode. If the forward signal vanishes, gradients vanish too. Training is impossible in either regime. Weight initialization is the cheapest intervention that determines whether a deep network can learn at all.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first thing a learner tries is setting all weights to zero. The network produces the same output for every input, every neuron computes the same gradient, and every weight receives the same update. All neurons remain identical forever. This is the symmetry problem: zero initialization makes depth and width useless because every neuron is a copy of every other.',
        'The next attempt is random initialization with some arbitrary standard deviation. Pick std = 1.0 and a 256-wide layer multiplies variance by roughly 256 per layer. Pick std = 0.01 and variance is multiplied by 256 * 0.01² = 0.0256, shrinking to zero within a few layers. Both choices seem reasonable until you watch what happens across more than two or three layers.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The margin between stable and catastrophic is narrow. Consider a single fully connected layer with fan-in n. If each weight is drawn from N(0, σ²), the output variance is n * σ² * Var(input). For the signal to neither grow nor shrink, we need n * σ² = 1, which gives σ = 1/√n. Miss by a factor of 2 and the per-layer multiplier is 2. Over 50 layers: 2⁵⁰ ≈ 10¹⁵.',
        'Activation functions complicate the picture. ReLU zeros out negative inputs, so roughly half the signal disappears at each layer. A variance-preserving init for a linear layer will halve the variance at each ReLU layer. Tanh and sigmoid saturate for large inputs, compressing variance further. The init strategy must account for the specific activation.',
        'Early deep learning research hit this wall repeatedly. Networks deeper than a handful of layers refused to train. The solution was not a better optimizer or more data — it was choosing the right initial scale.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Choose Var(w) so that Var(output) = Var(input) at every layer. This is the variance-preservation principle. If each layer preserves signal magnitude in the forward pass, it also preserves gradient magnitude in the backward pass. A deep network initialized this way starts training with useful gradients at every layer, from the output back to the input.',
        'The activation function determines the correction factor. For a linear layer or a symmetric activation like tanh (near the origin): Var(w) = 1/n suffices (or 2/(fan_in + fan_out) to balance forward and backward). For ReLU, which kills half the distribution: Var(w) = 2/n. The extra factor of 2 replaces the energy lost to the dead half of ReLU.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Rectifier_and_softplus_functions.svg', alt: 'Rectifier and softplus activation curves', caption: 'ReLU changes the variance math because half of a zero-mean input distribution is clipped to zero. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Rectifier_and_softplus_functions.svg.'},
        'Xavier initialization (Glorot & Bengio, 2010) sets Var(w) = 2 / (fan_in + fan_out). The denominator averages forward and backward fan to preserve variance in both directions. When using a uniform distribution: weights are drawn from U(-√(6/(fan_in + fan_out)), √(6/(fan_in + fan_out))). When using a Gaussian: std = √(2/(fan_in + fan_out)). This was designed for tanh and sigmoid activations, where the useful region near zero is roughly linear.',
        'Kaiming initialization (He et al., 2015) sets Var(w) = 2 / fan_in. The factor of 2 compensates for ReLU zeroing out the negative half of the pre-activation distribution. For Leaky ReLU with slope a on the negative side, the factor becomes 2 / (1 + a²). The derivation assumes the biases are zero and the weights are independent, which holds at initialization.',
        'Orthogonal initialization (Saxe et al., 2014) constructs W so that W^T W = I. This is exact variance preservation for linear networks: the singular values are all 1, so no direction is amplified or suppressed. In practice, orthogonal init is generated by computing the SVD of a random Gaussian matrix and taking the orthogonal factor.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Consider a single neuron y = Σ wᵢxᵢ with n inputs. If wᵢ and xᵢ are independent with zero mean, then Var(y) = n * Var(w) * Var(x). Setting Var(w) = 1/n gives Var(y) = Var(x). This is exact for linear layers.',
        'For ReLU, E[max(0, z)²] = Var(z)/2 when z is zero-mean Gaussian, because the positive half carries half the variance. So Var(ReLU(y)) = Var(y)/2. To keep Var(output) = Var(input), we need n * Var(w) * (1/2) = 1, giving Var(w) = 2/n. That is Kaiming initialization.',
        'Xavier\'s 2/(fan_in + fan_out) comes from averaging the forward constraint (Var(w) = 1/fan_in) and the backward constraint (Var(w) = 1/fan_out). When fan_in = fan_out, both agree. When they differ, the harmonic mean trades off forward and backward variance preservation. The approximation is that tanh ≈ identity near zero, which is accurate when activations are small at initialization.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Initialization costs O(total parameters) time — one random draw per weight. For a network with millions of parameters, this takes milliseconds. There is zero runtime cost: initialization happens once before training and never again. The storage cost is the weights themselves, which exist regardless of how they are initialized.',
        'The impact on training is large. Proper initialization can be the difference between a network that converges in 100 epochs and one that does not converge at all. It is the cheapest and highest-leverage intervention in deep learning: no extra compute, no extra memory, no extra hyperparameters beyond choosing the strategy.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every modern neural network uses some form of careful weight initialization. PyTorch defaults to Kaiming uniform for linear and convolutional layers. TensorFlow/Keras defaults to Glorot (Xavier) uniform. These defaults exist because random initialization with an arbitrary scale was a common source of training failures.',
        'Residual networks (He et al., 2016) use Kaiming initialization and add skip connections. The skip connections provide an identity path that preserves gradients independently of the learned layers, but the learned branches still need proper init to contribute useful signal from the start.',
        'Transfer learning and fine-tuning bypass initialization for pretrained layers: the weights start at a known good point. But any new layers (classification heads, adapters, LoRA matrices) still need proper initialization. LoRA specifically initializes one matrix to zero and the other to Kaiming or Gaussian, so the adapter starts as an identity and learns incremental changes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Very deep networks (100+ layers) cannot rely on initialization alone. Even with perfect per-layer variance preservation, small numerical errors compound over many layers. Residual connections are essential: they provide a direct gradient path that bypasses the multiplicative chain. Batch normalization and layer normalization also reduce sensitivity to initialization by re-centering and re-scaling activations at each layer.',
        'The variance-preservation derivation assumes independent weights, zero biases, and specific activation statistics. In practice, batch normalization, dropout, attention mechanisms, and other components break these assumptions. The formulas still provide good starting points, but they are not exact guarantees for complex architectures.',
        'For very wide networks approaching the neural tangent kernel regime, initialization interacts with the learning rate and parameterization. Standard parameterization (SP) and maximal update parameterization (μP) prescribe different init scales and learning rates to ensure consistent training dynamics across widths. The simple Kaiming formula may not be optimal when scaling width by orders of magnitude.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A single hidden layer with fan_in = 784 (MNIST input) and fan_out = 256.',
        'Xavier (Glorot) Gaussian: std = √(2 / (784 + 256)) = √(2 / 1040) = √0.001923 ≈ 0.0439. Each weight is drawn from N(0, 0.0439²). Xavier uniform: limit = √(6 / 1040) ≈ 0.0760. Each weight is drawn from U(-0.0760, 0.0760).',
        'Kaiming (He) Gaussian: std = √(2 / 784) = √0.002551 ≈ 0.0505. The extra factor of 2 vs. Xavier compensates for ReLU. Kaiming uniform: limit = √(6 / 784) ≈ 0.0875.',
        'Check: with Kaiming init, the pre-activation variance at the hidden layer is 784 * 0.0505² ≈ 784 * 0.00255 ≈ 2.0. After ReLU, half the values are zeroed, so the output variance is 2.0 / 2 = 1.0 — matching the input variance. The signal propagates cleanly.',
        'With a naive std = 1.0: pre-activation variance = 784 * 1.0 = 784. The hidden layer already has variance 784× too large. After two such layers, variance ≈ 784² ≈ 600,000. The network is unusable.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Xavier Glorot and Yoshua Bengio, "Understanding the difficulty of training deep feedforward neural networks" (AISTATS 2010) — derived the fan-in/fan-out variance formula for symmetric activations. Kaiming He, Xiangyu Zhang, Shaoqing Ren, and Jian Sun, "Delving Deep into Rectifiers" (ICCV 2015) — derived the ReLU correction factor and showed it enables training of very deep networks. Andrew Saxe, James McClelland, and Surya Ganguli, "Exact solutions to the nonlinear dynamics of learning in deep linear networks" (ICLR 2014) — orthogonal initialization and the theory of learning dynamics in deep linear networks.',
        'Study next: Vanishing & Exploding Gradients to see the pathology that bad initialization causes. Batch Normalization and Layer Normalization for the runtime approach to scale control. Residual connections for the architectural approach to gradient preservation in very deep networks. LoRA for how careful initialization extends to parameter-efficient fine-tuning.',
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Prerequisites: matrix multiplication (a layer is a matrix-vector product), variance (the quantity being preserved), and the forward pass of a neural network (where weights are applied). Understanding ReLU and tanh from the activation functions topic is essential because the init formula depends on which activation is used.',
        'This topic unlocks: understanding why deep networks became trainable before residual connections existed (Kaiming init made 30+ layer plain networks feasible), why different frameworks have different default initializations (Xavier vs. Kaiming, uniform vs. Gaussian), why fine-tuning and transfer learning partly bypass the init problem (pretrained weights are already in a good region), and the connection between init scale and learning rate (both control the magnitude of updates relative to the weights).',
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you compute the Xavier and Kaiming standard deviations for a layer with fan_in = 512 and fan_out = 128?',
            'Can you explain why all-zero initialization causes a symmetry problem that random initialization does not?',
            'Can you explain why ReLU requires a different init formula than tanh?',
            'Can you explain what happens to activation variance in a 20-layer network if the per-layer variance factor is 1.5?',
          ],
        },
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Compute the Kaiming std for fan_in = 512: std = √(2/512) = √0.00391 ≈ 0.0625. Now compute Xavier std for the same layer with fan_out = 512: std = √(2/1024) = √0.00195 ≈ 0.0442. Kaiming is larger by a factor of √2 ≈ 1.41. That factor is the ReLU correction.',
        'Estimate the activation variance after 10 layers with std = 0.1 and fan_in = 100. Per-layer factor: 100 * 0.01 = 1.0 for a linear activation — stable. For ReLU: the factor is 0.5 (half the signal zeroed), so after 10 layers variance ≈ 0.5¹⁰ ≈ 0.001. The network is nearly dead. Now try Kaiming: per-layer factor = 100 * (2/100) * 0.5 = 1.0. Stable, as designed.',
      ],
    },
  ],
};
