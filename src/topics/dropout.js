// Dropout: during training, randomly silence neurons so none can lean on
// the others. Every batch trains a different sub-network; at inference the
// whole ensemble answers at once.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'dropout',
  title: 'Dropout',
  category: 'AI & ML',
  summary: 'Randomly silence neurons during training — an ensemble of sub-networks sharing one set of weights.',
  controls: [
    { id: 'rate', label: 'Dropout rate p', type: 'select', options: ['0.5', '0.25', '0 (off)'], defaultValue: '0.5' },
  ],
  run,
};

// A hidden layer of 8 activations (from some forward pass upstream).
const ACTIVATIONS = [0.8, 1.4, 0.3, 2.1, 0.6, 1.1, 1.7, 0.4];

// Pre-rolled "random" masks (1 = keep) so every run is reproducible.
// In a real framework these come from an RNG fresh every batch.
const MASKS = {
  '0.5': [
    [1, 0, 1, 0, 0, 1, 0, 1],
    [0, 1, 0, 1, 1, 0, 1, 0],
    [1, 1, 0, 0, 1, 0, 0, 1],
  ],
  '0.25': [
    [1, 1, 0, 1, 1, 1, 0, 1],
    [0, 1, 1, 1, 0, 1, 1, 1],
    [1, 0, 1, 1, 1, 0, 1, 1],
  ],
  '0 (off)': [
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
  ],
};

const r2 = (v) => Math.round(v * 100) / 100;

export function* run(input) {
  const rateKey = String(input.rate);
  const masks = MASKS[rateKey];
  if (!masks) throw new InputError('Pick a dropout rate.');
  const p = rateKey === '0 (off)' ? 0 : parseFloat(rateKey);
  const scale = 1 / (1 - p);

  const cols = ACTIVATIONS.map((_, j) => ({ id: `n${j}`, label: `n${j + 1}` }));
  const layer = (values, title) => matrixState({
    title,
    rows: [{ id: 'a', label: 'a' }],
    columns: cols,
    values: [values.map(r2)],
  });

  yield {
    state: layer(ACTIVATIONS, 'A hidden layer during training (8 neurons)'),
    highlight: {},
    explanation: `The disease dropout cures: CO-ADAPTATION. With every neuron always present, neurons learn to lean on each other — fragile committees where one member\'s quirks cover another\'s mistakes, which is overfitting in mechanism form. ${p === 0 ? 'You picked p = 0, so dropout is OFF — watch what does NOT happen.' : `The cure is almost comic: every training batch, silence each neuron with probability p = ${p}.`}`,
  };

  for (let batch = 0; batch < masks.length; batch += 1) {
    const mask = masks[batch];
    const dropped = mask.map((m, j) => (m === 0 ? `a:n${j}` : null)).filter(Boolean);
    const values = ACTIVATIONS.map((a, j) => (mask[j] === 0 ? 0 : a * scale));
    yield {
      state: layer(values, `Training batch ${batch + 1}${p > 0 ? ` — ${dropped.length} of 8 neurons dropped` : ' — nothing dropped'}`),
      highlight: dropped.length ? { removed: dropped } : {},
      explanation: p === 0
        ? `Batch ${batch + 1}: all 8 neurons participate, every batch, forever. The network trains fine — but nothing stops neuron 4 from quietly relying on neuron 7\'s output instead of learning a robust feature of its own.`
        : `Batch ${batch + 1}: a fresh coin flip per neuron drops ${dropped.length} of them — their activations become 0, and Backpropagation sends them no blame either (the gate blocks both directions). Survivors are scaled by 1/(1âˆ'p) = ${r2(scale)} so the layer\'s total signal keeps the same expected size ("inverted dropout"). This batch effectively trains a DIFFERENT sub-network.`,
      invariant: p === 0 ? undefined : 'Expected activation is preserved: each survivor is scaled up by exactly the probability of surviving.',
    };
  }

  yield {
    state: layer(ACTIVATIONS, 'Inference: the full network, no dropout, no scaling'),
    highlight: { active: cols.map((c) => `a:${c.id}`) },
    explanation: `At inference, dropout turns OFF: all 8 neurons fire, unscaled (the 1/(1âˆ'p) during training already balanced the books). ${p === 0 ? 'With p = 0 there was never a difference between training and inference — and never any regularization either.' : `Here is the beautiful reading: with 8 neurons there are 2⁸ = 256 possible sub-networks, and training sampled a new one every batch — all SHARING the same weights. Inference with the full network approximates averaging that entire ensemble. Sound familiar? It\'s the Random Forest move — average many noisy learners — smuggled inside a single network.`}`,
  };

  yield {
    state: layer(ACTIVATIONS, 'Dropout in one line'),
    highlight: {},
    explanation: `One line of code — mask, scale, train — and the network is forced to learn REDUNDANT, individually-useful features, because no neuron can count on any other being awake. Classic rates: 0.5 in old fully-connected nets (AlexNet used exactly that), 0.1–0.3 in modern Transformers — and today\'s largest LLMs often skip it entirely, because oceans of training data regularize on their own. Knowing when a technique stops being needed is as instructive as the technique itself.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The grid shows a hidden layer of 8 neurons. Each frame is one training batch. Grayed-out (removed) neurons have been zeroed by this batch\'s random mask: they produce no output and receive no gradient. The surviving neurons glow active, and their values are visibly larger than the originals because they have been scaled by 1/(1-p) to keep the layer\'s expected output unchanged.',
        'Track three things across frames. First, which neurons vanish: the mask is different every batch, so different neurons disappear each time. Second, survivor magnitudes: with p = 0.5, each survivor doubles, because it must carry the signal that two neurons would normally share. Third, the final frame: inference uses all neurons at their original scale, no mask, no scaling. That frame is the payoff -- the full ensemble answering at once.',
        'Set p = 0 to see what dropout removes: every batch uses the same 8 neurons, the same computation graph, the same opportunity for neurons to co-adapt. Compare with p = 0.5 and the difference is immediate.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Neural networks overfit by co-adapting features. A hidden unit learns something useful only because another hidden unit is always there to compensate for its mistakes. The pair works on training data, but the dependency is fragile: perturb one member and the other\'s output becomes meaningless. Training loss falls, validation loss stalls or rises, and the gap is not just "too many parameters" -- it is a structural failure where neurons form private agreements instead of learning independently useful representations.',
        'Srivastava, Hinton, Krizhevsky, Sutskever, and Salakhutdinov (2014) formalized this problem and proposed the fix. Hinton\'s original intuition (2012) came partly from biology: sexual reproduction forces genes to be individually useful because each offspring gets a random half of each parent\'s genome. Dropout applies the same pressure to neurons. The paper showed consistent improvements across vision, speech, text, and genetics tasks -- evidence that co-adaptation is a universal failure mode, not a dataset-specific quirk.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The standard tools against overfitting are L2 regularization (weight decay), early stopping, and reducing model size. L2 adds a penalty proportional to the squared magnitude of each weight, discouraging large values. Early stopping halts training when validation loss begins to rise. Smaller models simply have less capacity to memorize.',
        'These tools work and remain useful. L2 keeps weights small. Early stopping prevents late-stage memorization. A smaller model cannot fit noise it has no parameters for. All three are external controls: they limit how much the network can learn, or for how long, without saying anything about what the learned features look like internally.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'L2 penalizes magnitude but does not break co-adaptation. Two neurons can have small, well-regularized weights and still form a brittle partnership where each depends on the other\'s exact output. Weight decay makes the numbers small; it does not make the features independent.',
        'Early stopping halts training before the worst memorization, but the representation at the stopping point may already contain hidden dependencies. The train-validation gap narrowed, but the internal features are still fragile committees.',
        'The gap: none of these methods directly say "each neuron must be useful even when its usual partner is missing." They control capacity from the outside. Dropout controls it from the inside, by corrupting the computation graph itself.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'During training, randomly zero out each neuron\'s output with probability p. The typical rate is 0.5 for hidden layers and 0.1-0.2 for input layers. Each batch draws a fresh binary mask, so each batch trains a different thinned sub-network. A layer with n neurons has 2^n possible sub-networks, all sharing one set of weights.',
        'The survivors must be scaled so the layer\'s expected output stays the same. Inverted dropout multiplies each survivor by 1/(1-p). If p = 0.5, survivors double. The math: for any neuron with activation x, the expected output is (1-p) * x/(1-p) + p * 0 = x. Training sees noisy, partial networks. Inference sees the full network at its original scale with no correction needed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Forward pass: sample a binary mask m of the same shape as the activation vector, where each entry is 1 with probability (1-p) and 0 with probability p. Compute output = activation * m * (1/(1-p)). Dropped neurons produce zero. Survivors are amplified.',
        'Backward pass: the same mask gates the gradient. A neuron that was zero in the forward pass receives no gradient -- backpropagation cannot assign blame to something that did not contribute. The mask is temporary training state, stored alongside saved activations for the backward pass.',
        'Train/eval switch: during training, fresh masks are sampled every batch. At inference, dropout is disabled -- all neurons fire, unscaled. Forgetting this switch is one of the most common deployment bugs. In PyTorch, model.eval() disables dropout. In TensorFlow/Keras, the training flag controls it. A model deployed in training mode produces random, degraded predictions.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Each training step uses a different thinned network. With n droppable neurons, there are 2^n possible sub-networks, and training samples a new one every batch. All sub-networks share the same weight matrices, so a gradient update to one sub-network improves related sub-networks that overlap with it. At inference, the full network approximates an average over that entire ensemble -- the same variance-reduction principle behind random forests and bagging, packed into a single set of weights.',
        'Co-adaptation breaks because no neuron can rely on another being present. If neuron 4 develops a feature that only works when neuron 7 compensates for its errors, that feature fails on every batch where neuron 7 is dropped. The gradient pushes neuron 4 toward a feature that is useful on its own. Over many batches, this pressure produces distributed, redundant representations where each neuron carries independently useful information.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Compute cost per step is negligible: sampling a mask and doing an elementwise multiply are both O(n) in the number of activations. Memory cost is the mask itself, which must be stored for the backward pass -- one bit or one float per activation, depending on implementation.',
        'Training takes 2-3x more iterations to converge because each batch sees a damaged network. The optimization signal is noisier, and the effective model capacity per step is reduced. This is the real cost of dropout: not compute per step, but total steps to reach the same training loss.',
        'Inference cost is zero. Inverted dropout handles all the accounting during training, so the inference forward pass is identical to a network that never used dropout. If your inference path has dropout-related branches or scaling, something is wrong.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Fully connected layers with many parameters and limited training data. AlexNet (2012) used p = 0.5 on its large FC layers and dropout was essential to its ImageNet performance -- without it, the network overfit severely.',
        'NLP models before the attention era: LSTMs and GRUs on text classification, language modeling, and machine translation used dropout on recurrent inputs and outputs (though not naively on hidden state, which requires variational dropout to avoid destroying temporal memory).',
        'Computer vision classifiers on small-to-medium datasets. Medical imaging, satellite imagery, and specialized domains where labeled data is scarce and the model can easily memorize.',
        'Fine-tuning large pretrained models on small downstream datasets. The pretrained weights have high capacity; dropout during fine-tuning prevents the model from overfitting to the small target set. Typical rates: p = 0.1-0.3.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Small datasets where the model is also small. Dropout removes capacity, but if the model barely has enough capacity for the task, removing neurons makes it underfit. Both training and validation loss stay high.',
        'Convolutional layers in modern architectures. Batch normalization already provides regularization by normalizing activations to zero mean and unit variance across the batch, and applying dropout after batch norm shifts those statistics in ways that hurt performance. Most modern CNNs (ResNet, EfficientNet) use batch norm without dropout in convolutional layers.',
        'Transformers use dropout differently. Attention dropout (applied after softmax on the attention weights) and sub-layer dropout (applied to the output of each feed-forward and attention block) are standard at p = 0.1. But large language models trained on hundreds of billions of tokens often reduce or eliminate dropout entirely -- the sheer volume of data regularizes naturally, and each example is seen so few times that memorization is difficult.',
        'Dropout cannot fix data leakage, label errors, or a loss function misaligned with the real objective. It is a regularizer, not a debugger.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Layer with 4 neurons, activations: [2.0, 0.8, 1.5, 0.6]. Dropout rate p = 0.5.',
        'Sample mask: [1, 0, 1, 0]. Neurons 2 and 4 are dropped.',
        'Apply mask: [2.0, 0, 1.5, 0]. The dropped neurons contribute nothing to the forward pass and will receive no gradient in the backward pass.',
        'Scale survivors by 1/(1-p) = 1/0.5 = 2: [4.0, 0, 3.0, 0]. Each survivor doubles to compensate for the lost neurons.',
        'Verify the expected value is preserved. Take neuron 1 with activation 2.0. With probability 0.5 it survives and outputs 2.0 * 2 = 4.0. With probability 0.5 it is dropped and outputs 0. Expected value: 0.5 * 4.0 + 0.5 * 0 = 2.0 -- the original activation. The scaling exactly compensates for the probability of being dropped.',
        'Forward pass without dropout (or at inference): all neurons fire with original values [2.0, 0.8, 1.5, 0.6]. Because inverted dropout already matched expected values during training, inference needs no correction. The downstream layer sees the same expected input magnitude whether dropout is on or off.',
        'Next batch, new mask: [0, 1, 0, 1]. Now neurons 1 and 3 are dropped. Output: [0, 1.6, 0, 1.2]. A completely different sub-network trains on this batch. Over many batches, every neuron must learn to be useful regardless of which partners are present.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Srivastava et al. 2014, "Dropout: A Simple Way to Prevent Neural Networks from Overfitting" -- the comprehensive empirical paper with systematic experiments across vision, speech, text, and genetics. Hinton et al. 2012, "Improving Neural Networks by Preventing Co-Adaptation of Feature Detectors" -- the original proposal, motivated partly by analogy to sexual reproduction. Gal & Ghahramani 2016, "Dropout as a Bayesian Approximation" -- proves that dropout training approximates variational inference, giving a principled uncertainty interpretation (MC dropout).',
        'Batch normalization: the dominant regularizer in modern CNNs, interacts with dropout in subtle ways -- study the interaction before combining them. L2 regularization (weight decay): the external capacity penalty that complements dropout\'s internal corruption. Data augmentation: another way to fight overfitting by increasing effective dataset size rather than reducing model capacity. DropConnect (Wan et al. 2013): masks individual weights instead of entire neurons, finer granularity but higher cost. DropBlock (Ghiasi et al. 2018): drops contiguous regions of feature maps, designed for convolutional layers where spatial correlation makes single-neuron dropout ineffective.',
      ],
    },
  ],
};

