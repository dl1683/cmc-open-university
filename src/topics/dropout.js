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
    explanation: `The disease dropout cures: CO-ADAPTATION. With every neuron always present, neurons learn to lean on each other — fragile committees where one member's quirks cover another's mistakes, which is overfitting in mechanism form. ${p === 0 ? 'You picked p = 0, so dropout is OFF — watch what does NOT happen.' : `The cure is almost comic: every training batch, silence each neuron with probability p = ${p}.`}`,
  };

  for (let batch = 0; batch < masks.length; batch += 1) {
    const mask = masks[batch];
    const dropped = mask.map((m, j) => (m === 0 ? `a:n${j}` : null)).filter(Boolean);
    const values = ACTIVATIONS.map((a, j) => (mask[j] === 0 ? 0 : a * scale));
    yield {
      state: layer(values, `Training batch ${batch + 1}${p > 0 ? ` — ${dropped.length} of 8 neurons dropped` : ' — nothing dropped'}`),
      highlight: dropped.length ? { removed: dropped } : {},
      explanation: p === 0
        ? `Batch ${batch + 1}: all 8 neurons participate, every batch, forever. The network trains fine — but nothing stops neuron 4 from quietly relying on neuron 7's output instead of learning a robust feature of its own.`
        : `Batch ${batch + 1}: a fresh coin flip per neuron drops ${dropped.length} of them — their activations become 0, and Backpropagation sends them no blame either (the gate blocks both directions). Survivors are scaled by 1/(1−p) = ${r2(scale)} so the layer's total signal keeps the same expected size ("inverted dropout"). This batch effectively trains a DIFFERENT sub-network.`,
      invariant: p === 0 ? undefined : 'Expected activation is preserved: each survivor is scaled up by exactly the probability of surviving.',
    };
  }

  yield {
    state: layer(ACTIVATIONS, 'Inference: the full network, no dropout, no scaling'),
    highlight: { active: cols.map((c) => `a:${c.id}`) },
    explanation: `At inference, dropout turns OFF: all 8 neurons fire, unscaled (the 1/(1−p) during training already balanced the books). ${p === 0 ? 'With p = 0 there was never a difference between training and inference — and never any regularization either.' : `Here is the beautiful reading: with 8 neurons there are 2⁸ = 256 possible sub-networks, and training sampled a new one every batch — all SHARING the same weights. Inference with the full network approximates averaging that entire ensemble. Sound familiar? It's the Random Forest move — average many noisy learners — smuggled inside a single network.`}`,
  };

  yield {
    state: layer(ACTIVATIONS, 'Dropout in one line'),
    highlight: {},
    explanation: `One line of code — mask, scale, train — and the network is forced to learn REDUNDANT, individually-useful features, because no neuron can count on any other being awake. Classic rates: 0.5 in old fully-connected nets (AlexNet used exactly that), 0.1–0.3 in modern Transformers — and today's largest LLMs often skip it entirely, because oceans of training data regularize on their own. Knowing when a technique stops being needed is as instructive as the technique itself.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Dropout is regularization by sabotage. During training, it randomly sets a fraction of activations to zero, forcing the network to make a good prediction even when some internal features disappear. Srivastava, Hinton, Krizhevsky, Sutskever, and Salakhutdinov formalized it in the 2014 JMLR paper "Dropout"; AlexNet had already used 50% dropout in its fully connected layers to fight ImageNet overfitting.`,
        `The intuition is ensemble learning with shared weights. A layer with n units has many possible sub-networks depending on which units survive. Each minibatch trains one sampled sub-network, but all sub-networks reuse the same parameters. At test time, dropout is disabled and the full model approximates an average over those thinned networks, a neural cousin of Random Forest variance reduction.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Most frameworks use inverted dropout. If the drop probability is p, each activation survives with probability 1 - p. Surviving activations are divided by 1 - p during training, so their expected scale matches inference. With p = 0.5, survivors are doubled. With p = 0.1, survivors are multiplied by 1.11. Backpropagation follows the same mask: a dropped unit contributes zero activation and receives zero gradient for that batch.`,
        `Dropout is usually applied after dense layers, attention or feed-forward projections, and sometimes embeddings. It is not normally applied to normalization statistics or arbitrary input pixels unless the task explicitly benefits from feature masking. In transformers, common rates are 0.0 to 0.1 for large pretraining and 0.1 to 0.3 for smaller fine-tuning runs, because huge datasets already act as a regularizer.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The direct compute cost is tiny: sample a binary mask and multiply activations elementwise. The indirect cost is noisier optimization. Training may need more steps because the Neural Network Forward Pass changes stochastically from batch to batch. Memory overhead is one mask per dropped tensor during training, often stored compactly. Inference cost is zero when implemented correctly: dropout is off, and the model runs as an ordinary dense network.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Dropout remains standard in small and medium neural systems: medical classifiers with limited labels, recommender models with sparse user histories, tabular neural nets, and fine-tuned language models where the downstream dataset is much smaller than the base pretraining corpus. It also supports uncertainty estimates. Gal and Ghahramani's 2016 MC-dropout view runs dropout at inference multiple times and treats prediction variance as approximate Bayesian uncertainty, which connects directly to Uncertainty: Teaching Models to Say "I Don't Know".`,
        `Large foundation-model pretraining often uses less dropout than older CNNs because data scale, weight decay, augmentation, and model architecture already provide regularization. That does not make dropout obsolete; it makes it a context-dependent tool rather than a default knob.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The classic bug is forgetting evaluation mode. In PyTorch, model.eval() disables dropout; missing that call makes predictions random and depresses accuracy. Another mistake is setting p = 0.5 everywhere. That was useful for AlexNet's dense layers, not a universal law. Attention blocks, convolutional layers, and small datasets need separate validation.`,
        `Dropout also does not replace Regularization: L1 & L2, data augmentation, or Early Stopping & Patience. It reduces co-adaptation, but it cannot fix leakage, mislabeled data, or a model too small for the problem. Too much dropout causes underfitting: both training and validation loss stay high because the network is repeatedly denied the capacity it needs.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Neural Network Forward Pass and Backpropagation to see exactly where masks act. Random Forest gives the ensemble analogy; Regularization: L1 & L2 gives the penalty-based alternative. Vanishing & Exploding Gradients explains why masking interacts with depth, and Learning-Rate Schedules & Warmup shows how noisy training is stabilized in practice.`,
      ],
    },
  ],
};