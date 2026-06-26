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
      `With std = 1.0, each neuron sums ${width} weighted inputs. The pre-activation variance grows by a factor of ~${width} per layer. Activations explode: gradients overflow, weights diverge, and training fails immediately.`,
  };

  // Step 3: Too-small init (std = 0.01).
  const varSmall = simulateVariance(layers, width, 0.01, actFn, SEED);
  const sSmall = varianceSeries('small', 'std = 0.01 (too small)', varSmall);
  yield {
    state: plotState({ axes: AXES, series: [sLarge, sSmall] }),
    highlight: { active: ['small'], visited: ['large'] },
    explanation:
      `With std = 0.01, each layer multiplies variance by ~${width} * 0.01² = ${(width * 0.0001).toFixed(4)}. Activations collapse toward zero within a few layers. Gradients vanish and early layers receive no useful learning signal.`,
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
      `All four strategies side by side for a ${layers}-layer, ${width}-wide ${activation} network. The two extremes (std = 1.0 and std = 0.01) diverge rapidly. Xavier (std ${xavierStd.toFixed(4)}) and Kaiming (std ${kaimingStd.toFixed(4)}) stay flat because they set Var(w) so that Var(output) ≈ Var(input) at each layer.`,
    invariant: `A good initialization keeps the variance curve flat across all ${layers} layers: neither growing nor shrinking.`,
  };
}

// ---------------------------------------------------------------- article

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        {type: 'callout', text: 'Initialization is a variance-control problem: the starting weight scale decides whether signal and gradient survive depth.'},
        'Read the plot as variance over depth. Variance means the average squared spread of activations or gradients around their mean. Active highlights show the initialization being tested, and found highlights show layers where the signal stays near scale 1.',
        {type: 'image', src: './assets/gifs/weight-initialization.gif', alt: 'Animated walkthrough of the weight initialization visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is multiplication across layers. If each layer multiplies variance by 2, ten layers multiply it by 1024. If each layer multiplies variance by 0.5, ten layers shrink it to about 0.001.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Depth makes variance preservation matter: each layer receives the scale produced by the previous layer. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
        'A neural network starts before learning with random weights. Those weights decide the scale of signals moving forward and gradients moving backward. If the scale grows or shrinks at every layer, training can fail before the optimizer has a useful chance.',
        'Weight initialization exists to choose a random scale that breaks symmetry without destroying signal. It is cheap, but it sets the initial numerical regime for the whole network.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to set all weights to zero. That makes every neuron in the same layer compute the same value and receive the same gradient. The network never breaks symmetry, so width is wasted.',
        'The next obvious approach is to draw small random weights from a fixed range such as -0.01 to 0.01. This breaks symmetry, but the same scale is wrong for layers with very different fan-in, which means number of input connections.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is compounding. A layer with 1,000 inputs sums many weighted values, while a layer with 10 inputs sums far fewer. One fixed random scale cannot preserve variance in both layers.',
        'Activation functions change the math too. ReLU clips negative values to zero, so it removes part of the signal distribution. Sigmoid and tanh can saturate when inputs are too large, causing gradients to vanish.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Choose the weight variance from the layer shape and activation. Xavier initialization balances fan-in and fan-out for roughly symmetric activations. Kaiming initialization uses 2 divided by fan-in for ReLU-like activations because ReLU drops about half of a zero-centered signal.',
        'The goal is not magic randomness. The goal is preserving expected scale so activations and gradients remain numerically usable across depth.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Rectifier_and_softplus_functions.svg', alt: 'Rectifier and softplus activation curves', caption: 'ReLU changes the variance math because half of a zero-mean input distribution is clipped to zero. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Rectifier_and_softplus_functions.svg.'},
        'For a linear layer with fan-in n, a rough variance-preserving choice is Var(w)=1/n. Xavier uses 2/(fan_in+fan_out) to balance forward and backward flow. Kaiming uses 2/fan_in for ReLU because the activation keeps the positive side and zeros the negative side.',
        'In code, a normal Kaiming draw uses standard deviation sqrt(2/fan_in). A uniform draw uses bounds chosen so the uniform distribution has the same variance.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof sketch uses independence and variance addition. If inputs have variance v and weights have variance a, then the sum of n independent weighted inputs has variance about n*a*v. Setting a=1/n keeps the output variance near v before activation.',
        'For ReLU, about half the mass becomes zero under the idealized symmetric assumption. Multiplying the weight variance by 2 compensates for that loss. The invariant is expected variance near constant from layer to layer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Initialization itself is O(number of weights) because every parameter receives one random value. The runtime cost after that is zero; the chosen scale affects training behavior, not inference complexity.',
        'The cost of a bad choice is paid through optimization. Exploding activations can overflow or force tiny learning rates. Vanishing activations and gradients make early layers learn slowly. Doubling depth doubles the number of compounding steps, so small scale errors become visible quickly.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Xavier is common with tanh-like or roughly linear regimes, and Kaiming is common with ReLU-family networks. Orthogonal initialization is often used for recurrent or deep linear-style settings where singular values matter.',
        'Modern frameworks expose these initializers because training stability is a default engineering concern. Residual connections, normalization layers, and optimizer choices reduce the burden, but they do not make initialization irrelevant.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The formulas rely on assumptions: independent weights, roughly independent activations, zero-centered inputs, and a matching activation function. Real networks violate those assumptions with normalization, attention, residual paths, gated activations, embeddings, and weight sharing.',
        'Initialization also does not fix bad data scaling or an excessive learning rate. If inputs have wildly different magnitudes, the first layer can still receive a broken numerical problem even with a good initializer.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A ReLU layer has fan-in 100. Kaiming normal uses variance 2/100=0.02 and standard deviation sqrt(0.02), about 0.141. If input variance is 1, the pre-activation variance is about 100*0.02*1=2.',
        'After ReLU removes about half the distribution, the scale returns near 1 under the simplified derivation. If the same layer used standard deviation 1, the pre-activation variance would be 100 and the next layers would start from an already inflated signal.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Glorot and Bengio, Understanding the difficulty of training deep feedforward neural networks, at https://proceedings.mlr.press/v9/glorot10a.html, and He et al., Delving Deep into Rectifiers, at https://arxiv.org/abs/1502.01852. For orthogonal initialization, read Saxe et al., Exact solutions to the nonlinear dynamics of learning in deep linear neural networks, at https://arxiv.org/abs/1312.6120.',
        'Study Backpropagation, Gradient Descent, Activation Functions, Batch Normalization, Residual Networks, and Attention Initialization next. The unifying idea is keeping signal and gradient scales usable while depth grows.',
      ],
    },
  ],
};
