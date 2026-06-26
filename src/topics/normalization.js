// BatchNorm & LayerNorm: every layer keeps re-standardizing the signal so
// the next one receives numbers it can work with. The only real question —
// and the entire BN-vs-LN war — is WHICH AXIS you normalize across.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'normalization',
  title: 'BatchNorm & LayerNorm',
  category: 'AI & ML',
  summary: 'Re-standardize the signal at every layer — and the BN-vs-LN war is just an argument about which axis.',
  controls: [
    { id: 'view', label: 'Normalize', type: 'select', options: ['the drift and the fix', 'BatchNorm vs LayerNorm: the axis war'], defaultValue: 'the drift and the fix' },
  ],
  run,
};

const LAYERS = [1, 2, 3, 4, 5, 6, 7, 8];

function* driftAndFix() {
  yield {
    state: plotState({
      axes: { x: { label: 'layer' }, y: { label: 'activation scale (std dev)' } },
      series: [
        { id: 'grow', label: 'weights slightly large (×1.75/layer)', points: LAYERS.map((l) => ({ x: l, y: 1.75 ** (l - 1) })) },
        { id: 'shrink', label: 'weights slightly small (×0.55/layer)', points: LAYERS.map((l) => ({ x: l, y: 0.55 ** (l - 1) })) },
      ],
      markers: [{ id: 'goal', x: 8, y: 1, label: 'healthy scale ≈ 1' }],
    }),
    highlight: { removed: ['grow', 'shrink'], found: ['goal'] },
    explanation: `Vanishing & Exploding Gradients showed the BACKWARD pass dying of compounding; the forward pass has the same disease. Each layer multiplies the signal by its weights, so the activation SCALE compounds too: weights a touch large and by layer ${LAYERS.length} activations are ${(1.75 ** (LAYERS.length - 1)).toFixed(0)}× too big — every sigmoid/GELU saturates, gradients die; a touch small and the signal fades to static by layer 6. Careful initialization (He/Xavier) sets the scale right at step 0 — but training MOVES the weights, and by epoch 10 the careful tuning is history. The scale needs to be enforced continuously, not just at birth.`,
    invariant: `Forward activations compound across all ${LAYERS.length} layers exactly like backward gradients: the corridor near 1 is narrow.`,
  };

  yield {
    state: matrixState({
      title: 'The fix, applied at every layer, every step',
      rows: [
        { id: 'step1', label: '1. measure' },
        { id: 'step2', label: '2. standardize' },
        { id: 'step3', label: '3. re-dress (learnable!)' },
      ],
      columns: [{ id: 'op', label: 'operation' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'mean μ and std σ of the activations', 'x̂ = (x − μ) / σ → mean 0, var 1', 'y = γ·x̂ + β — γ, β learned like weights'][v],
    }),
    highlight: { active: ['step2:op'], found: ['step3:op'] },
    explanation: `The fix is statistical hygiene in ${3} steps: measure the activations' mean and spread, standardize to mean 0 / variance 1, and then — the step everyone forgets — RE-DRESS the signal with two LEARNABLE parameters: scale γ and shift β. That third step matters philosophically: with γ and β the network can represent anything it could before (it can even learn to undo the normalization entirely). Normalization does not restrict WHAT the network can compute — it changes the GEOMETRY of the search, handing the optimizer coordinates where every layer's input is predictably scaled, every step of training.`,
    invariant: `γ and β preserve expressiveness across all ${LAYERS.length} layers: normalization reshapes the optimization landscape, not the function family.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'epoch' }, y: { label: 'training loss' } },
      series: [
        { id: 'without', label: 'no normalization (lr capped low)', points: LAYERS.concat([9, 10, 11, 12]).map((e) => ({ x: e, y: 2.3 * Math.exp(-e / 9) + 0.4 })) },
        { id: 'with', label: 'with BN (10× the lr, stable)', points: LAYERS.concat([9, 10, 11, 12]).map((e) => ({ x: e, y: 2.3 * Math.exp(-e / 2.5) + 0.32 })) },
      ],
    }),
    highlight: { found: ['with'], visited: ['without'] },
    explanation: `What it buys, on the loss curve: the normalized network trains with a learning rate ~10× higher without detonating (the scale police catch what the big steps break across ${LAYERS.length} layers), converges in a third of the epochs, and is dramatically less sensitive to initialization. When BatchNorm arrived (Ioffe & Szegedy, 2015) it was an overnight standard — nearly every CNN since carries it. The original explanation said it cures "internal covariate shift" (layers chasing each other's moving input distributions). Hold that phrase loosely — science had a follow-up.`,
  };

  yield {
    state: matrixState({
      title: 'Why it ACTUALLY works — the 2018 re-examination',
      rows: [
        { id: 'story', label: 'the original story (2015)' },
        { id: 'test', label: 'the experiment (2018)' },
        { id: 'finding', label: 'the finding' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', '"fixes internal covariate shift"', 'INJECT noise after BN — shift restored, on purpose', 'still trains great → shift wasn\'t the point'][v],
    }),
    highlight: { removed: ['story:what'], found: ['finding:what'] },
    explanation: `The honest-science postscript (Santurkar et al., 2018, "How Does Batch Normalization Help Optimization?"): researchers deliberately RE-INJECTED distribution shift after every BatchNorm layer across all ${LAYERS.length} layers — if curing shift were the mechanism, this should break everything. Training stayed just as fast. The measured effect is different: BN makes the loss landscape dramatically SMOOTHER — gradients change more slowly, so big steps stay trustworthy (the Lipschitz story from Loss Landscapes). The lesson generalizes beyond BN: a technique can be a universal standard, work brilliantly, and still have its original explanation be wrong for years. Keep the technique; audit the story.`,
  };
}

// A batch of 3 samples × 4 features, scales all over the place.
const BATCH = [
  [2.0, 110, 0.4, 7],
  [1.0, 90, 0.6, 5],
  [3.0, 130, 0.2, 9],
];
const SAMPLES = ['s1', 's2', 's3'];
const FEATS = ['f1', 'f2', 'f3', 'f4'];

function* axisWar() {
  yield {
    state: matrixState({
      title: 'One batch: 3 samples × 4 features — which way do you normalize?',
      rows: SAMPLES.map((s, i) => ({ id: s, label: `sample ${i + 1}` })),
      columns: FEATS.map((f, j) => ({ id: f, label: `feature ${j + 1}` })),
      values: BATCH,
      format: (v) => String(v),
    }),
    highlight: { compare: ['s1:f2', 's2:f2', 's3:f2'], active: ['s2:f1', 's2:f2', 's2:f3', 's2:f4'] },
    explanation: `Here is the entire BatchNorm-vs-LayerNorm debate in one grid. A batch of ${SAMPLES.length} samples × ${FEATS.length} features crosses a layer and produces these activations — feature 2 lives near ${BATCH[0][1]}, feature 3 near ${BATCH[0][2]}. To standardize, you need a mean and a std — but computed over WHAT? Down a COLUMN (this feature, across the batch — highlighted vertically)? Or along a ROW (this sample, across its features — highlighted horizontally)? Both are "normalization." They have wildly different operational personalities, and the choice quietly decided the architecture of modern AI.`,
  };

  const colStats = FEATS.map((_, j) => {
    const col = BATCH.map((r) => r[j]);
    const m = col.reduce((a, b) => a + b, 0) / col.length;
    const sd = Math.sqrt(col.reduce((a, b) => a + (b - m) ** 2, 0) / col.length);
    return { m, sd };
  });
  yield {
    state: matrixState({
      title: 'BatchNorm: normalize each COLUMN (per feature, across the batch)',
      rows: SAMPLES.map((s, i) => ({ id: s, label: `sample ${i + 1}` })),
      columns: FEATS.map((f, j) => ({ id: f, label: `μ=${colStats[j].m}, σ=${colStats[j].sd.toFixed(1)}` })),
      values: BATCH.map((row) => row.map((v, j) => (v - colStats[j].m) / colStats[j].sd)),
      format: (v) => v.toFixed(2),
    }),
    highlight: { compare: ['s1:f2', 's2:f2', 's3:f2'] },
    explanation: `BATCHNORM's answer: columns. Each feature gets standardized against ITS OWN batchmates — feature 2's mean of ${colStats[1].m} and std of ${colStats[1].sd.toFixed(1)} (computed live from this grid) turn [${BATCH.map(r => r[1]).join(', ')}] into [0, −1.22, 1.22]. Elegant — but notice the dependency it just created: sample 1's normalized value depends on WHO ELSE IS IN THE BATCH. Your output changes if your batchmates change. That coupling is harmless during big-batch training and a slow-burning fuse everywhere else — inference, small batches, sequences.`,
    invariant: `BatchNorm couples all ${SAMPLES.length} samples: each output depends on the statistics of its batchmates.`,
  };

  yield {
    state: matrixState({
      title: 'The fuse burns: BatchNorm\'s operational traps',
      rows: [
        { id: 'infer', label: 'inference (batch of 1)' },
        { id: 'evalmode', label: 'forgetting model.eval()' },
        { id: 'small', label: 'batch size 2–4' },
        { id: 'seq', label: 'variable-length sequences' },
      ],
      columns: [{ id: 'what', label: 'what happens' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'no batch stats → use RUNNING AVERAGES saved from training', 'the classic bug: train-mode stats on one sample → garbage', 'noisy statistics → noisy training', 'tokens would normalize against other sentences\' tokens'][v],
    }),
    highlight: { removed: ['evalmode:what'], compare: ['seq:what'] },
    explanation: `The traps, enumerated. At inference there is no batch, so BN switches to running averages recorded during training — meaning the model literally has TWO MODES, and forgetting to flip the switch (model.eval()) is among the most-asked bug reports in deep learning history. Small batches (say ${SAMPLES.length} or fewer samples) make the statistics noise. And for sequences the whole idea bends: should the word "the" in your sentence be normalized against the words of MY sentence, just because we shared a batch? For transformers, that question demanded the other axis.`,
  };

  const rowStats = BATCH.map((row) => {
    const m = row.reduce((a, b) => a + b, 0) / row.length;
    const sd = Math.sqrt(row.reduce((a, b) => a + (b - m) ** 2, 0) / row.length);
    return { m, sd };
  });
  yield {
    state: matrixState({
      title: 'LayerNorm: normalize each ROW (per sample, across features)',
      rows: SAMPLES.map((s, i) => ({ id: s, label: `μ=${rowStats[i].m.toFixed(1)}, σ=${rowStats[i].sd.toFixed(1)}` })),
      columns: FEATS.map((f, j) => ({ id: f, label: `feature ${j + 1}` })),
      values: BATCH.map((row, i) => row.map((v) => (v - rowStats[i].m) / rowStats[i].sd)),
      format: (v) => v.toFixed(2),
    }),
    highlight: { active: ['s1:f1', 's1:f2', 's1:f3', 's1:f4'] },
    explanation: `LAYERNORM's answer: rows. Each sample is standardized against ITSELF — sample 1's mean ${rowStats[0].m.toFixed(1)} and std ${rowStats[0].sd.toFixed(1)} across its ${FEATS.length} features (computed live above). Every coupling problem evaporates at once: no dependence on batchmates, identical behavior at batch size 1 or 1,000, no train/inference mode split, and every token in a sequence normalizes independently. The price: it asks "are this sample's features collectively too big?" rather than "is this feature unusual for the population?" — statistically cruder, operationally bulletproof. Transformers chose bulletproof.`,
    invariant: `LayerNorm is per-sample: same output for the same input across all ${FEATS.length} features, regardless of batch or mode.`,
  };

  yield {
    state: matrixState({
      title: 'The settlement',
      rows: [
        { id: 'bn', label: 'BatchNorm' },
        { id: 'ln', label: 'LayerNorm' },
        { id: 'rms', label: 'RMSNorm' },
      ],
      columns: [{ id: 'axis', label: 'axis' }, { id: 'home', label: 'home turf' }, { id: 'why', label: 'because' }],
      values: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
      format: (v) => ['', 'per feature, across batch', 'CNNs / vision', 'big batches, fixed-size images', 'per sample, across features', 'transformers, RNNs (2× per block)', 'sequences, generation at batch 1', 'LN minus the mean subtraction', 'LLaMA-class LLMs', 'cheaper, works just as well'][v],
    }),
    highlight: { found: ['ln:home'], active: ['rms:home'] },
    explanation: `The settlement, as the field actually shook out: vision kept BatchNorm (big homogeneous batches of ${SAMPLES.length}+ samples, fixed shapes — its traps rarely spring); every transformer block you have studied carries LayerNorm twice (the pre-norm placement that Vanishing & Exploding Gradients' armor table promised); and the LLM era simplified further with RMSNORM — LayerNorm minus the mean subtraction, just divide by the root-mean-square and scale by γ — measurably cheaper at billions of activations, indistinguishable in quality. The through-line from both views: deep learning runs on keeping every signal, forward and backward, in a narrow corridor around scale 1 — init sets it, normalization holds it, and the axis you normalize across (${FEATS.length} features or ${SAMPLES.length} samples) is destiny.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the drift and the fix') yield* driftAndFix();
  else if (view === 'BatchNorm vs LayerNorm: the axis war') yield* axisWar();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The drift view plots activation scale, meaning standard deviation of layer outputs, across eight layers. The growing curve shows weights that multiply signal size by 1.75 per layer; the shrinking curve shows weights that multiply by 0.55 per layer. The green marker is the healthy scale near 1, where later layers receive numbers large enough to use and small enough not to saturate.',
        'The axis-war view shows a batch as a grid: rows are samples and columns are features. BatchNorm measures down a column, so one sample depends on its batchmates; LayerNorm measures across a row, so one sample depends only on its own features. A safe inference from the visual is that changing other rows can change BatchNorm output but cannot change LayerNorm output for the same row.',
        {type: 'callout', text: 'Normalization is a scale-control layer: it measures activations, standardizes them, then lets learned gamma and beta choose the useful scale again.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg', alt: 'Normal distribution marked by standard deviation bands', caption: 'Standard deviation is the spread number the animation keeps forcing back into a usable corridor. Source: Wikimedia Commons, M. W. Toews, public domain.'},
        {type: 'image', src: './assets/gifs/normalization.gif', alt: 'Animated walkthrough of the normalization visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored hidden units', caption: 'Deep networks compound activation scale layer by layer, so a small scale drift early can reach every downstream unit. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
        'A neural network layer transforms numbers with weights, bias, and a nonlinearity. If each layer makes the signal slightly larger, the growth compounds; if each layer makes it slightly smaller, the signal fades. Normalization exists because deep training needs the scale of activations to stay in a usable corridor after every update, not only at initialization.',
        'For a zero-background reader, activation means the numeric output of a layer, mean means average, variance means average squared distance from the mean, and standard deviation is the square root of variance. BatchNorm and LayerNorm are layers that measure those statistics, rescale the activations, and then let learned parameters choose the final scale and shift.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable fix is careful initialization. Xavier initialization and He initialization choose initial weight sizes so a layer starts with output variance close to input variance. With shallow networks and cautious learning rates, that can keep signals near scale 1 long enough to train.',
        'A second reasonable fix is to lower the learning rate. Smaller parameter updates cause less scale drift, so activations move more slowly away from their initial calibration. This is often the first stabilizer tried when a model diverges.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Initialization is a one-time promise, but training changes weights thousands of times. A layer that was calibrated at step 0 can produce very different activation statistics by step 5000. In a 50-layer model, small scale errors accumulate across many transformations.',
        'A tiny example shows the wall. If each of 8 layers multiplies standard deviation by 1.75, the final scale is 1.75^7 = 50.3, so nonlinearities can saturate. If each layer multiplies by 0.55, the final scale is 0.55^7 = 0.015, so the signal nearly vanishes.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make scale control part of the forward pass. Instead of hoping that training preserves a good distribution, the layer measures the current activations and standardizes them immediately. Then learned gamma and beta restore expressiveness by choosing whatever scale and center the model needs.',
        'BatchNorm and LayerNorm mainly disagree about the axis of measurement. BatchNorm asks whether one feature is unusual compared with the same feature in other samples. LayerNorm asks whether one sample has unusually scaled features compared with itself.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg', alt: 'Normal distribution probability density functions', caption: 'The target shape is not magic; the layer estimates a center and spread, then rescales activations relative to those statistics. Source: Wikimedia Commons, Inductiveload, public domain.'},
        'For BatchNorm, take one feature column in a mini-batch of N samples. Compute mean mu, compute variance sigma squared, normalize each value as x_hat = (x - mu) / sqrt(sigma squared + epsilon), then output y = gamma * x_hat + beta. Epsilon is a tiny constant such as 1e-5 that prevents division by zero.',
        'LayerNorm uses the same formula on a different slice. It computes statistics across the features of one sample, so the result does not depend on other samples in the batch. That is why transformers can use LayerNorm during generation with batch size 1.',
        'BatchNorm has separate training and inference behavior. During training it uses live batch statistics; during inference it uses running averages collected during training. Forgetting to switch a model to evaluation mode can make inference depend on one accidental batch.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness here means preserving what the network can represent while improving the coordinates used by optimization. The learned gamma and beta prove the representation point: if the best downstream layer wants a different scale or center, it can learn that scale and center after standardization.',
        'The optimization argument is that normalized activations make the loss surface smoother. Santurkar et al. showed that BatchNorm does not mainly work by eliminating internal covariate shift; it works by making gradients change more predictably. Larger learning-rate steps become less likely to jump into a region with a completely different gradient direction.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The arithmetic cost is O(N * D) for a layer with N samples and D features, because each activation is read and transformed. The space cost is two learned values per normalized feature, gamma and beta, plus running mean and running variance for BatchNorm. Compared with a dense matrix multiply, this is usually a small arithmetic cost but a real memory and synchronization cost.',
        'Cost behaves differently by axis. BatchNorm can require synchronized statistics across GPUs, and its small-batch estimates get noisy. LayerNorm avoids cross-sample communication, but it does not use population statistics for each feature, so it may be weaker in image models where batch and channel statistics are informative.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'BatchNorm is common in convolutional vision networks because image batches have consistent channels and enough samples for useful per-feature statistics. ResNet-style blocks use it to stabilize deep stacks and allow larger learning rates. It works best when training and inference data have similar distributions and batch sizes are large enough.',
        'LayerNorm is standard in transformers and recurrent models because sequence generation often runs one token or one example at a time. RMSNorm, a LayerNorm relative that divides by root mean square without subtracting the mean, appears in many large language models because it is cheaper and usually good enough.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'BatchNorm fails in small-batch settings because the measured mean and variance are noisy. It also creates a train-versus-eval mode boundary, which is an operational failure point in serving code. In sequential models, cross-sample normalization can mix unrelated examples in a way that has no semantic meaning.',
        'LayerNorm is not a universal replacement. It may underuse useful population information in vision workloads, and its per-sample statistics can interact badly with architectures that expect absolute feature scale. Normalization also cannot fix bad labels, exploding logits from later layers, or an optimizer that is unstable for other reasons.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use one BatchNorm feature with four activations: [4, 8, 6, 2]. The mean is (4 + 8 + 6 + 2) / 4 = 5. The variance is ((-1)^2 + 3^2 + 1^2 + (-3)^2) / 4 = 5, so the standard deviation is sqrt(5) = 2.236.',
        'The normalized values are [(4 - 5) / 2.236, (8 - 5) / 2.236, (6 - 5) / 2.236, (2 - 5) / 2.236] = [-0.447, 1.342, 0.447, -1.342]. With gamma = 1.5 and beta = 0.5, the outputs are [-0.171, 2.513, 1.171, -1.513]. The feature now has controlled scale, but the learned parameters still let the model stretch and shift it.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Ioffe and Szegedy, Batch Normalization, 2015; Ba, Kiros, and Hinton, Layer Normalization, 2016; Santurkar, Tsipras, Ilyas, and Madry, How Does Batch Normalization Help Optimization, 2018; Zhang and Sennrich, Root Mean Square Layer Normalization, 2019; Wu and He, Group Normalization, 2018.',
        'Study Vanishing and Exploding Gradients before this if scale compounding is unclear. Study Loss Landscapes, Optimizers, Transformers, and Convolutional Neural Networks next to see why different architectures choose different normalization axes.',
      ],
    },
  ],
};
