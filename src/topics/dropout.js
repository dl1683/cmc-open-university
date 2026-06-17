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
      heading: `Why dropout exists`,
      paragraphs: [
        `Dropout exists because a large neural network can fit the training set for the wrong reason. A hidden unit can learn a feature that works only because another hidden unit always cleans up its mistakes. A downstream layer can depend on a brittle combination of units instead of learning a signal that survives small changes in the input, the batch, or the initialization. The training loss may fall, but the representation has become a private agreement among neurons rather than a reusable model of the task.`,
        `That failure is called co-adaptation. It is not just a vague synonym for overfitting. It is a mechanism: units become useful only in the presence of specific other units. If those companions are absent, noisy, or shifted at test time, the feature stops working. Dropout attacks that mechanism directly. It makes presence unreliable during training, so each unit and each path through the network has to carry useful information without assuming that every neighbor will be available.`,
      ],
    },
    {
      heading: `The obvious approach and the wall`,
      paragraphs: [
        `The obvious first response to overfitting is to shrink the model, add L2 weight decay, collect more data, or stop training earlier. Those are valid tools. A smaller model has less capacity, L2 discourages large weights, more data exposes more variation, and early stopping prevents late-stage memorization. The wall is that none of those directly says, "this internal feature must be useful even when its usual partner is gone." They control capacity from the outside.`,
        `A fully connected layer with every unit active on every batch can still build a fragile committee. Weight decay may keep the numbers small while the dependency remains. Early stopping may stop before the worst memorization phase but still preserve a representation with hidden dependencies. Dropout adds a different pressure: it corrupts the computation graph during training. The network does not merely pay a penalty for complexity; it must solve the task through many partial versions of itself.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `The core move is simple: during training, multiply an activation tensor by a random binary mask. A kept unit passes through. A dropped unit becomes zero. The mask changes from batch to batch, so each update trains a different thinned subnetwork. All of those subnetworks share the same parameters, so learning in one sampled path affects many future paths.`,
        `At inference, the mask is removed. The full network runs. With inverted dropout, the training-time survivors are scaled by 1/(1 - p), where p is the drop probability, so the expected activation size during training matches the activation size at inference. That scaling is the small accounting detail that makes the train/test contract clean. Training sees noisy partial networks. Inference sees one dense network whose activations already have the right expected scale.`,
      ],
    },
    {
      heading: `Mechanism and state`,
      paragraphs: [
        `The data structure is ordinary tensor state plus a mask. For a vector layer, the mask has one bit or one small value per activation. For a batch, frameworks usually create a mask with the same broadcast shape as the activation tensor. The forward pass computes masked_activation = activation * mask * scale. The backward pass uses the same mask, so a dropped activation sends no gradient through that branch for that batch.`,
        `That same-mask rule matters. If a unit was silent in the forward pass, its downstream effect was zero. Backpropagation must not pretend it contributed to the loss. The mask is therefore part of the temporary training state, like an activation saved for backward. Implementations also need a train/eval mode flag. In training mode, masks are sampled. In evaluation mode, dropout is disabled. Forgetting that switch is one of the easiest ways to ship a randomly degraded model.`,
        `Dropout is usually placed after dense layers, feed-forward projections, attention projections, embeddings, or other high-capacity transformations. It is not a universal operation to sprinkle anywhere. Applying it to normalization statistics, recurrent state, or structured signals without thinking can change the semantics of the model. Variants such as spatial dropout, attention dropout, and drop path exist because different tensors have different dependency structures.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Dropout works because it makes unreliable dependencies expensive. A downstream unit cannot safely encode "if neuron 7 says this, trust neuron 4 to finish the job" when neuron 7 may be zero on the next batch. The useful features are the ones that remain useful across many sampled masks. Training therefore favors redundancy, distributed representations, and features that carry their own evidence.`,
        `The ensemble interpretation is also useful. A network with n dropout-controlled units represents many possible subnetworks. Training samples a tiny fraction of them, but parameter sharing lets each update benefit related subnetworks. Inference with the full network is not the exact arithmetic average of every subnetwork, but it behaves like a cheap approximation to averaging many noisy predictors. That is the same variance-reduction instinct behind ensembles, packed into one set of weights.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `The direct cost is small. Sampling a mask and multiplying activations are linear in the number of affected activations. Memory overhead is the mask needed for backward, often stored compactly or regenerated with recorded random state. Inference cost should be zero because dropout is off. If inference is slower or random because of dropout, the deployment path is wrong.`,
        `The indirect cost is optimization noise. Every batch sees a damaged network, so the training loss can be noisier and convergence can require more updates. Too little dropout may do nothing. Too much dropout removes so much capacity that the model underfits: training loss stays high along with validation loss. The right rate is empirical. Older fully connected nets often used p around 0.5. Many modern transformer fine-tunes use smaller rates, and very large pretraining runs may use little or none because data scale, weight decay, augmentation, and architecture already regularize the model.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Dropout is useful when the model has more representational capacity than the data can safely supervise. Small and medium image classifiers, tabular neural networks, recommender systems with sparse histories, medical models with limited labels, and fine-tuned language models can all benefit. In those settings, the model can easily build private shortcuts. Randomly removing activations makes those shortcuts less dependable.`,
        `Dropout also gives a practical uncertainty trick. MC dropout keeps dropout active at inference, runs the same input multiple times, and treats variation across predictions as a rough uncertainty signal. That is not a substitute for a full uncertainty model, but it is useful when the question is whether the model is stable under its own sampled internal noise.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Dropout is the wrong tool when the problem is not co-adaptation or overfitting. It cannot fix data leakage, label errors, a broken train/test split, a model too small for the task, or a loss function misaligned with the real objective. It also should not be used as a ritual default. A convolutional feature map, an attention matrix, a residual branch, and a token embedding do not all respond to independent elementwise masking in the same way.`,
        `The operational failure is evaluation-mode drift. In PyTorch, model.eval() disables dropout. In Keras and other frameworks, the training flag controls the same distinction. If the flag is wrong, predictions become random, validation metrics become noisy, and exported models may not match offline evaluation. Another common mistake is comparing models while one has dropout active and the other does not. That measures a configuration bug, not regularization.`,
      ],
    },
    {
      heading: `Evaluation signals`,
      paragraphs: [
        `Use the training and validation curves together. Helpful dropout often raises training loss slightly while lowering validation loss or narrowing the train-validation gap. Underfitting dropout raises both. Useless dropout changes neither. The best signal is not whether dropout feels theoretically appropriate; it is whether held-out performance improves under the same data split, optimizer budget, and tuning discipline.`,
        `Also watch calibration, stability, and reproducibility. Heavy dropout can make optimization sensitive to random seeds. If MC dropout is used for uncertainty, score the uncertainty itself: do high-variance predictions correlate with errors, ambiguous inputs, or out-of-distribution examples? If not, the sampled variance is just noise wearing an uncertainty label.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Neural Network Forward Pass and Backpropagation to see where the mask sits in the computation graph. Study Regularization: L1 & L2 and Early Stopping & Patience to compare external capacity controls with dropout's internal corruption. Random Forest gives the ensemble analogy. Learning-Rate Schedules & Warmup explains how noisy training is stabilized. Uncertainty Quantification and Conformal Prediction show stricter ways to turn model doubt into decisions.`,
      ],
    },
  ],
};
