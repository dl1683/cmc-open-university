// Entropy: surprise measured in bits. It is the floor under lossless
// compression, the loss behind language-model training, and the shared unit
// for reasoning about uncertainty.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'entropy',
  title: 'Entropy & Information',
  category: 'Concepts',
  summary: 'Information = surprise = -log2(p). Entropy connects coin flips, compression floors, cross-entropy, perplexity, and language-model loss.',
  controls: [
    { id: 'view', label: 'Trace', type: 'select', options: ['from surprise to LLM loss'], defaultValue: 'from surprise to LLM loss' },
  ],
  run,
};


const log2 = (x) => Math.log(x) / Math.LN2;
const entropy = (dist) => dist.reduce((h, p) => (p > 0 ? h - p * log2(p) : h), 0);
const crossEntropy = (p, q) => p.reduce((h, pi, i) => (pi > 0 ? h - pi * log2(q[i]) : h), 0);

const OUTCOMES = ['sun', 'cloud', 'rain', 'snow'];
const CERTAIN = [1, 0, 0, 0];
const UNIFORM = [0.25, 0.25, 0.25, 0.25];
const SKEWED = [0.7, 0.2, 0.05, 0.05];

export function* run(input) {
  if (String(input.view) !== 'from surprise to LLM loss') throw new InputError('Pick the walkthrough.');

  const curve = {
    id: 'info',
    label: '-log2(p)',
    points: Array.from({ length: 99 }, (_, i) => {
      const p = (i + 1) / 100;
      return { x: p, y: -log2(p) };
    }),
  };
  yield {
    state: plotState({
      axes: { x: { label: 'probability of the event' }, y: { label: 'information (bits)' } },
      series: [curve],
      markers: [
        { id: 'coin', x: 0.5, y: 1, label: 'coin flip: 1 bit' },
        { id: 'rare', x: 0.01, y: -log2(0.01), label: 'p=1%: 6.6 bits' },
      ],
    }),
    highlight: {},
    explanation: 'Shannon made information measurable by tying it to surprise. An event with probability p carries -log2(p) bits. A fair coin flip carries 1 bit, a certain event carries 0 bits, and a 1-in-100 event carries about 6.6 bits. The logarithm matters because independent probabilities multiply while information adds.',
  };

  const dists = [
    { id: 'certain', label: 'certain', p: CERTAIN },
    { id: 'skewed', label: 'skewed', p: SKEWED },
    { id: 'uniform', label: 'uniform', p: UNIFORM },
  ];
  yield {
    state: matrixState({
      title: 'Entropy H = expected surprise, in bits per outcome',
      rows: dists.map((d) => ({ id: d.id, label: d.label })),
      columns: [...OUTCOMES.map((o, j) => ({ id: `o${j}`, label: o })), { id: 'H', label: 'H (bits)' }],
      values: dists.map((d) => [...d.p, entropy(d.p)]),
      format: (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2)),
    }),
    highlight: { active: dists.map((d) => `${d.id}:H`) },
    explanation: `Entropy is the distribution's average surprise: H = sum p * -log2(p). Always-sunny has H = 0 because the report gives no new information. Four equally likely outcomes give H = 2 bits. The skewed forecast lands at ${entropy(SKEWED).toFixed(2)} bits because one outcome is common but the rare outcomes still have to be named.`,
    invariant: 'H is maximal for uniform distributions and zero for certainty.',
  };

  yield {
    state: matrixState({
      title: 'Optimal code lengths near -log2(p): the Huffman connection',
      rows: OUTCOMES.map((o, j) => ({ id: `r${j}`, label: o })),
      columns: [{ id: 'p', label: 'p' }, { id: 'bits', label: '-log2(p)' }, { id: 'code', label: 'code length' }],
      values: SKEWED.map((p) => [p, -log2(p), Math.ceil(-log2(p))]),
      format: (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2)),
    }),
    highlight: { active: ['r0:code', 'r3:code'] },
    explanation: `Entropy is the lossless compression floor. A good code spends about -log2(p) bits on each symbol: "sun" at 70% earns a short code, while "snow" at 5% needs a longer one. Huffman coding gets close with whole-bit code lengths, so the readout shows both the ideal fractional length and the integer code length.`,
  };

  yield {
    state: matrixState({
      title: 'Cross-entropy: the cost of believing the wrong distribution',
      rows: [{ id: 'truth', label: 'reality p' }, { id: 'model', label: 'model q' }],
      columns: OUTCOMES.map((o, j) => ({ id: `o${j}`, label: o })),
      values: [SKEWED, UNIFORM],
    }),
    highlight: { active: OUTCOMES.map((_, j) => `model:o${j}`) },
    explanation: `Cross-entropy measures the cost of using model q to encode events drawn from reality p. Modeling the skewed weather as uniform costs ${crossEntropy(SKEWED, UNIFORM).toFixed(2)} bits per outcome instead of the optimal ${entropy(SKEWED).toFixed(2)}. The overpayment, ${(crossEntropy(SKEWED, UNIFORM) - entropy(SKEWED)).toFixed(2)} bits here, is KL divergence.`,
  };

  yield {
    state: matrixState({
      title: 'LLM loss is cross-entropy',
      rows: [{ id: 'truth', label: 'reality p' }, { id: 'model', label: 'model q' }],
      columns: OUTCOMES.map((o, j) => ({ id: `o${j}`, label: o })),
      values: [SKEWED, UNIFORM],
    }),
    highlight: { found: OUTCOMES.map((_, j) => `truth:o${j}`) },
    explanation: 'Replace weather labels with next tokens and the table becomes language-model training. The model distribution q is penalized by the negative log probability it assigns to the observed token. Perplexity is 2^H, so it reports cross-entropy as an effective number of choices.',
  };

  yield {
    state: matrixState({
      title: 'One quantity, threaded through the site',
      rows: [{ id: 'truth', label: 'reality p' }, { id: 'model', label: 'model q' }],
      columns: OUTCOMES.map((o, j) => ({ id: `o${j}`, label: o })),
      values: [SKEWED, UNIFORM],
    }),
    highlight: {},
    explanation: 'The same bit accounting appears across the site. Huffman coding builds codes near the entropy floor, decision trees pick splits by entropy reduction, knowledge distillation transfers soft distributions, quantization works when values carry less information than their raw bits suggest, and language-model loss is measured in cross-entropy.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The surprise curve plots -log2(p) against probability. Watch how the curve explodes as p approaches zero: that is the penalty for confident wrong predictions made visible. A coin flip at p = 0.5 costs 1 bit of surprise. A rare event at p = 0.01 costs 6.6 bits. The shape of this curve is the entire engine behind cross-entropy loss.',
        {
          type: 'callout',
          text: 'Entropy is expected surprise: the least average number of bits needed when the probabilities are true.',
        },
        'The entropy table shows three distributions over four weather outcomes and their entropies. Active cells highlight H, the average surprise. Certain distributions have H = 0 because nothing is unknown. Uniform distributions have maximal H because every outcome is equally surprising. The skewed distribution lands between, because common outcomes contribute little surprise while rare ones contribute a lot.',
        'The cross-entropy frame compares reality p against a model q. The gap between H(p, q) and H(p) is KL divergence: the bits wasted because the model is wrong. When the animation replaces weather labels with tokens, the same table becomes language-model training loss.',
      
        {type: 'image', src: './assets/gifs/entropy.gif', alt: 'Animated walkthrough of the entropy visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A loss function collapses every prediction a model makes into a single number: how wrong is it? Gradient descent needs this number to be differentiable so it can compute a direction to improve. Without a loss function, there is no gradient, and without a gradient, there is no learning.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Binary_entropy_plot.svg',
          alt: 'Binary entropy curve peaking at probability one half',
          caption: 'Binary entropy is highest when the two outcomes are equally likely and falls to zero at certainty. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Binary_entropy_plot.svg',
        },
        'Entropy and cross-entropy solve the specific problem of measuring wrongness for probability distributions. A classifier outputs probabilities over classes. A language model outputs probabilities over tokens. The loss must say not just "right or wrong" but "how far from right," and it must do so in a way that gradient descent can act on. Cross-entropy is the standard answer for classification, and the reason traces back to Shannon 1948: it measures the cost, in bits, of believing the wrong distribution.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural way to measure a classifier is accuracy: count how many predictions match the label, divide by total. A model that gets 95 out of 100 right scores 0.95. Accuracy is intuitive, directly interpretable, and what you ultimately care about in deployment.',
        'For regression, the obvious loss is the raw error: |y - y_hat|. Subtract prediction from target, take the absolute value, average across samples. Both accuracy and absolute error make immediate sense to anyone looking at the results.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Accuracy is a step function. A model that predicts P(cat) = 0.51 and one that predicts P(cat) = 0.99 both get the same accuracy score: 1. The derivative of a step function is zero everywhere except at the boundary, where it is undefined. Gradient descent cannot use it. There is no slope to follow.',
        'Accuracy also hides magnitude. A model that assigns P(cat) = 0.51 to a cat image is barely right, but accuracy treats it identically to P(cat) = 0.99. Worse, a model that assigns P(cat) = 0.49 is counted as completely wrong despite being almost right. The loss function must distinguish near-misses from catastrophic failures, because the gradient needs to know which direction to push and how hard.',
        'Absolute error |y - y_hat| is differentiable almost everywhere, but its derivative is constant (+1 or -1), providing no information about distance from the target. A prediction that is off by 0.01 gets the same gradient magnitude as one off by 100.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For regression, mean squared error replaces accuracy: L = (1/n) * sum((y_i - y_hat_i)^2). Squaring makes the function differentiable everywhere, and the gradient dL/dy_hat = -2(y - y_hat)/n is proportional to the error. Large errors produce large gradients; small errors produce small gradients. The optimizer naturally focuses effort where the model is most wrong.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Huffman_tree_2.svg',
          alt: 'Huffman coding tree assigning shorter codes to more likely symbols',
          caption: 'Huffman coding is the constructive side of entropy: common events get short codes and rare events get long codes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Huffman_tree_2.svg',
        },
        'For classification, cross-entropy replaces accuracy. Given C classes, the true label is a one-hot vector y and the model outputs a probability distribution y_hat (typically via softmax). The loss is: L = -sum(y_c * log(y_hat_c)) for c = 1 to C. With one-hot labels, this simplifies to L = -log(y_hat_correct), the negative log of the probability assigned to the true class.',
        'Binary cross-entropy handles the two-class case directly: L = -[y * log(p) + (1 - y) * log(1 - p)]. When y = 1, only the -log(p) term survives. When y = 0, only the -log(1 - p) term survives. The logarithm is the key: -log(0.9) = 0.105, a small penalty for being right. -log(0.1) = 2.303, a harsh penalty for being wrong. -log(0.01) = 4.605, catastrophic. The log curve makes confident wrong predictions orders of magnitude more expensive than uncertain ones.',
        'Softmax converts raw logits z into probabilities: p_c = exp(z_c) / sum(exp(z_j)). In practice, softmax and cross-entropy are computed together for numerical stability. The combined gradient has a clean form: dL/dz_c = p_c - y_c. For the correct class, this is (p_correct - 1), pushing the logit up. For wrong classes, this is p_wrong, pushing them down. The gradient vanishes only when p_correct = 1 and all others are 0, which is the perfect prediction.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Cross-entropy is the negative log-likelihood of the observed data under the model distribution. Minimizing cross-entropy is equivalent to maximizing the likelihood that the model assigns to the correct labels. This is not a coincidence or a convenience: it is a direct consequence of how log-likelihood decomposes over independent samples.',
        'From information theory: cross-entropy H(p, q) = -sum(p_c * log(q_c)) measures the expected number of bits needed to encode events from p using a code optimized for q. The entropy H(p) = -sum(p_c * log(p_c)) is the minimum achievable cost. The difference, KL(p || q) = H(p, q) - H(p), is the KL divergence: the extra bits wasted because q is not p. Since H(p) is constant for fixed labels, minimizing cross-entropy is exactly minimizing KL divergence, which is zero only when q = p. The model is trained to match the true distribution.',
        'The log also has a calibration property. A model trained with cross-entropy learns to output calibrated probabilities: if it says 0.7 for many examples, roughly 70% of them should be correct. This happens because the log-likelihood objective is a proper scoring rule. It is uniquely minimized when the predicted distribution matches the true conditional distribution.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Computing cross-entropy costs O(C) per sample for C classes: one log evaluation per class, one multiply, one sum. For ImageNet with 1,000 classes, that is 1,000 operations per image. For a language model with a 50,000-token vocabulary, the softmax denominator (sum of 50,000 exponentials) dominates, not the loss itself. Approximations like sampled softmax or hierarchical softmax exist to reduce this bottleneck.',
        'Numerical stability matters. Computing log(softmax(z)) naively can overflow (exp of large logits) or underflow (log of tiny probabilities). The log-sum-exp trick subtracts max(z) before exponentiating: log(softmax(z_c)) = z_c - max(z) - log(sum(exp(z_j - max(z)))). This keeps all intermediate values in a safe floating-point range. Every deep learning framework implements this fused operation (log_softmax or cross_entropy_with_logits) for exactly this reason.',
        'Label smoothing (Szegedy 2016) replaces the hard one-hot target [1, 0, 0] with a soft target [0.9, 0.05, 0.05]. The model no longer needs to drive logits to infinity to minimize loss, which prevents overconfidence and improves generalization. The cost is a slightly higher minimum achievable loss, since H(p) > 0 for smoothed labels.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Cross-entropy is the default loss for classification in every neural network framework. Image classifiers (ResNet, ViT), language models (GPT, BERT), speech recognition, recommendation systems, and medical diagnosis all train with cross-entropy. Whenever the output is a probability distribution over discrete choices, cross-entropy is the standard objective.',
        'Language modeling is the largest-scale use case. Next-token prediction is cross-entropy: the model outputs a distribution over the vocabulary, the loss is -log(p_observed_token), averaged over all positions in the sequence. Perplexity, the standard evaluation metric, is 2^(cross-entropy): a model with cross-entropy 3.0 bits per token has perplexity 8, meaning it is as uncertain as choosing uniformly among 8 options.',
        'MSE is the standard for regression: predicting house prices, stock returns, sensor readings, or any continuous target. It is the maximum-likelihood loss when errors are Gaussian, and its gradient is proportional to the residual.',
        'Focal loss (Lin et al. 2017) extends cross-entropy for class imbalance by multiplying by (1 - p_correct)^gamma. Easy examples with high p_correct contribute almost nothing to the gradient. Hard examples dominate. This made single-stage object detectors (RetinaNet) competitive with two-stage methods.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MSE is sensitive to outliers because the squared term amplifies large errors. A single target value that is off by 100 contributes 10,000 to the loss, dominating the gradient for that batch. Huber loss fixes this by switching from quadratic to linear beyond a threshold delta, combining MSE smoothness near zero with outlier robustness far from zero.',
        'Cross-entropy assumes correct labels. Noisy labels (human annotation errors, crowdsourced disagreements) poison the training signal because cross-entropy heavily penalizes confident predictions that disagree with the label, even when the label is wrong. Label smoothing, mixup, and noise-robust losses (symmetric cross-entropy, generalized cross-entropy) mitigate this.',
        'Class imbalance breaks standard cross-entropy. If 99% of samples are negative, the model learns to predict negative for everything and achieves low average loss. Weighted cross-entropy scales the loss per class inversely to frequency. Focal loss down-weights easy examples. Both are patches on the same underlying problem: the average does not reflect what you care about.',
        'Adversarial robustness requires different objectives entirely. Cross-entropy on clean data does not teach the model to resist small adversarial perturbations. Adversarial training (Madry et al. 2018) replaces the clean loss with a worst-case loss over a perturbation set, which is more expensive and produces different internal representations.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Binary classification. True label y = 1 (positive). Model predicts p = 0.9. Cross-entropy: L = -log(0.9) = 0.105 nats. Gradient with respect to p: dL/dp = -1/p = -1.11. The gradient pushes p upward toward 1.',
        'Same label y = 1, but model predicts p = 0.1. Now L = -log(0.1) = 2.303 nats, twenty-two times larger. Gradient: dL/dp = -1/0.1 = -10. The gradient is ten times stronger, driving p hard toward 1. The log curve makes the penalty and the corrective force both scale with the severity of the mistake.',
        'Three-class problem. True label: cat (one-hot [1, 0, 0]). Model A outputs [0.7, 0.2, 0.1]: L = -log(0.7) = 0.357 nats. Model B outputs [0.4, 0.4, 0.2]: L = -log(0.4) = 0.916 nats. Model C outputs [0.1, 0.5, 0.4]: L = -log(0.1) = 2.303 nats. Only the probability assigned to the true class matters. Model C is most wrong and pays most. The softmax-cross-entropy gradient for Model C is [0.1 - 1, 0.5, 0.4] = [-0.9, 0.5, 0.4]: a strong push to increase the cat logit and decrease the others.',
        'Full cross-entropy with soft labels. True distribution p = [0.7, 0.2, 0.1], model q = [0.6, 0.3, 0.1]. H(p, q) = -0.7 * log(0.6) - 0.2 * log(0.3) - 0.1 * log(0.1) = 0.358 + 0.241 + 0.230 = 0.829 nats. Entropy H(p) = 0.802 nats. KL divergence = 0.829 - 0.802 = 0.027 nats. The 0.027 nats is the cost of the model being wrong about the distribution shape.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Shannon 1948, "A Mathematical Theory of Communication," defined entropy and the information-theoretic framework. Kullback and Leibler 1951, "On Information and Sufficiency," formalized KL divergence. Lin et al. 2017, "Focal Loss for Dense Object Detection," introduced focal loss for class imbalance. Szegedy et al. 2016, "Rethinking the Inception Architecture," introduced label smoothing. Goodfellow et al. 2016, "Deep Learning" (Chapter 6), covers loss functions and maximum likelihood in depth.',
        'Prerequisites: logarithms (log turns products into sums), probability distributions (probabilities sum to one), and basic calculus (derivatives of log and exp). Study Gradient Descent to see how cross-entropy gradients drive parameter updates. Study Softmax to understand the function that produces the probability distribution cross-entropy consumes. Study Backpropagation for how loss gradients flow through layers. Study Activation Functions for the nonlinearities between layers. Study Logistic Regression as the simplest model trained with binary cross-entropy. Study Focal Loss for the class-imbalance extension.',
      ],
    },
  ],
};
