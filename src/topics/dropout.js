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
        `Dropout is a simple but radical regularization technique: during training, randomly silence (set to zero) a fraction of neurons in each layer on every batch. The silence rate p — typically 0.5 for fully-connected layers, 0.1–0.3 for Transformers — means each neuron has p chance of being dropped and 1−p chance of surviving. No neuron knows if it will survive the next batch, so no neuron can lean on its neighbors' outputs. The disease dropout cures is co-adaptation: neurons learning to rely on quirks and errors of their neighbors instead of learning robust features. This is overfitting in mechanism form.`,
        `The inventor's insight: with n neurons and dropout rate p, you're not training one network — you're training 2^n different sub-networks, all sharing the same weight matrix. Each batch trains a different random sub-network. At inference, the full unscaled network fires, so it approximates an ensemble average of all those sub-networks. This is the Random Forest strategy — average many noisy learners — running inside a single network, with shared parameters.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Training: (1) For each neuron in each batch, flip a coin with probability p. (2) If it lands on dropout, set that neuron's activation to 0. (3) Scale all surviving neurons by 1/(1−p) — this is inverted dropout. The scaling preserves the expected total activation: if p = 0.5, survivors are scaled by 2, so the layer's signal stays the same size on average. (4) Backpropagation treats dropped neurons as gated: both forward activations (the 0 signal) and backward gradients (the blame) are blocked. A dropped neuron gets no gradient, so it cannot learn from that batch.`,
        `Inference: dropout turns OFF. All neurons fire at their natural strength, unscaled. The scale factor 1/(1−p) was applied during training, so the books are already balanced. The full network now approximates the ensemble vote of the 2^n sub-networks the training saw. With n = 8, that's 256 sub-networks. In AlexNet (2012), researchers used dropout with p = 0.5 on the two largest fully-connected layers to reduce overfitting on ImageNet. Modern Transformers (GPT, BERT) use lower rates — 0.1–0.2 — or skip dropout entirely because vast training datasets provide natural regularization.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The computational cost is negligible: sampling binary masks and element-wise multiplication. Memory is also unchanged — you're not storing extra sub-networks. The real cost is training time: dropout adds noise to every batch, so convergence is slower. The payoff is typically 1–5% lower test error (depending on dataset size and model capacity). On massive datasets with modern LLMs (billions of tokens), dropout is often dropped entirely because the data itself prevents overfitting. The trade-off is noise during training for robustness at test time.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Dropout is a foundational technique in computer vision (convolutional and fully-connected layers) and NLP (Transformers use it lightly, around 0.1). You will see it in: medical image classification (high-stakes domains where robustness is critical), recommendation systems (where co-adaptation of neurons is a real risk), and any supervised task where the training set is small relative to model capacity. AlexNet's use of p = 0.5 in 2012 was transformative — it proved overfitting could be controlled without massive datasets, which opened the door to deep learning on resource-constrained problems. Modern LLMs and vision models skip it because their training data is so large that the network cannot overfit even without dropout. But smaller, task-specific models still use it as the first line of defense.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Misconception 1: Dropout doubles inference cost. Wrong — inference is unchanged; the scaling happens only in training. Misconception 2: Dropout should be applied to input layers. Almost never — dropping raw input features loses information; it's usually applied only to hidden layers and sometimes the embedding layer. Misconception 3: Dropout replaces other regularization. False — it works alongside L2 weight decay, learning-rate schedules, and data augmentation; they are independent levers. Pitfall 1: forgetting to turn dropout OFF at inference (some frameworks do this automatically, others require explicit eval mode). Pitfall 2: using p = 0.5 uniformly across all layers — deeper networks benefit from lower rates. Pitfall 3: applying dropout during inference by mistake, which injects unnecessary noise into predictions.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `To deepen your intuition, explore Neural Network Forward Pass to see how activations flow; Backpropagation to understand how gradients are blocked at dropped neurons; Random Forest to recognize the ensemble structure that dropout mimics; and Gradient Descent to see how noise from dropout changes the optimization landscape. Activation Functions pairs naturally with dropout — the shapes of ReLU, sigmoid, and tanh change how dropout's signal scaling affects outputs.`,
      ],
    },
  ],
};
