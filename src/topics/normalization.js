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
    explanation: 'Vanishing & Exploding Gradients showed the BACKWARD pass dying of compounding; the forward pass has the same disease. Each layer multiplies the signal by its weights, so the activation SCALE compounds too: weights a touch large and by layer 8 activations are 50× too big — every sigmoid/GELU saturates, gradients die; a touch small and the signal fades to static by layer 6. Careful initialization (He/Xavier) sets the scale right at step 0 — but training MOVES the weights, and by epoch 10 the careful tuning is history. The scale needs to be enforced continuously, not just at birth.',
    invariant: 'Forward activations compound layer-by-layer exactly like backward gradients: the corridor near 1 is narrow.',
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
    explanation: 'The fix is statistical hygiene, layered: measure the activations\' mean and spread, standardize to mean 0 / variance 1, and then — the step everyone forgets — RE-DRESS the signal with two LEARNABLE parameters: scale γ and shift β. That third step matters philosophically: with γ and β the network can represent anything it could before (it can even learn to undo the normalization entirely). Normalization does not restrict WHAT the network can compute — it changes the GEOMETRY of the search, handing the optimizer coordinates where every layer\'s input is predictably scaled, every step of training.',
    invariant: 'γ and β preserve expressiveness: normalization reshapes the optimization landscape, not the function family.',
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
    explanation: 'What it buys, on the loss curve: the normalized network trains with a learning rate ~10× higher without detonating (the scale police catch what the big steps break), converges in a third of the epochs, and is dramatically less sensitive to initialization. When BatchNorm arrived (Ioffe & Szegedy, 2015) it was an overnight standard — nearly every CNN since carries it. The original explanation said it cures "internal covariate shift" (layers chasing each other\'s moving input distributions). Hold that phrase loosely — science had a follow-up.',
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
    explanation: 'The honest-science postscript (Santurkar et al., 2018, "How Does Batch Normalization Help Optimization?"): researchers deliberately RE-INJECTED distribution shift after every BatchNorm layer — if curing shift were the mechanism, this should break everything. Training stayed just as fast. The measured effect is different: BN makes the loss landscape dramatically SMOOTHER — gradients change more slowly, so big steps stay trustworthy (the Lipschitz story from Loss Landscapes). The lesson generalizes beyond BN: a technique can be a universal standard, work brilliantly, and still have its original explanation be wrong for years. Keep the technique; audit the story.',
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
    explanation: 'Here is the entire BatchNorm-vs-LayerNorm debate in one grid. A batch of three samples crosses a layer and produces these activations — feature 2 lives near 110, feature 3 near 0.4. To standardize, you need a mean and a std — but computed over WHAT? Down a COLUMN (this feature, across the batch — highlighted vertically)? Or along a ROW (this sample, across its features — highlighted horizontally)? Both are "normalization." They have wildly different operational personalities, and the choice quietly decided the architecture of modern AI.',
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
    explanation: 'BATCHNORM\'s answer: columns. Each feature gets standardized against ITS OWN batchmates — feature 2\'s mean of 110 and std of 16.3 (computed live from this grid) turn [110, 90, 130] into [0, −1.22, 1.22]. Elegant — but notice the dependency it just created: sample 1\'s normalized value depends on WHO ELSE IS IN THE BATCH. Your output changes if your batchmates change. That coupling is harmless during big-batch training and a slow-burning fuse everywhere else — inference, small batches, sequences.',
    invariant: 'BatchNorm couples samples: each output depends on the statistics of its batchmates.',
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
    explanation: 'The traps, enumerated. At inference there is no batch, so BN switches to running averages recorded during training — meaning the model literally has TWO MODES, and forgetting to flip the switch (model.eval()) is among the most-asked bug reports in deep learning history. Small batches make the statistics noise. And for sequences the whole idea bends: should the word "the" in your sentence be normalized against the words of MY sentence, just because we shared a batch? For transformers, that question demanded the other axis.',
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
    explanation: 'LAYERNORM\'s answer: rows. Each sample is standardized against ITSELF — its own mean and std across its features (again computed live above). Every coupling problem evaporates at once: no dependence on batchmates, identical behavior at batch size 1 or 1,000, no train/inference mode split, and every token in a sequence normalizes independently. The price: it asks "are this sample\'s features collectively too big?" rather than "is this feature unusual for the population?" — statistically cruder, operationally bulletproof. Transformers chose bulletproof.',
    invariant: 'LayerNorm is per-sample: same output for the same input, regardless of batch or mode.',
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
    explanation: 'The settlement, as the field actually shook out: vision kept BatchNorm (big homogeneous batches, fixed shapes — its traps rarely spring); every transformer block you have studied carries LayerNorm twice (the pre-norm placement that Vanishing & Exploding Gradients\' armor table promised); and the LLM era simplified further with RMSNORM — LayerNorm minus the mean subtraction, just divide by the root-mean-square and scale by γ — measurably cheaper at billions of activations, indistinguishable in quality. The through-line from both views: deep learning runs on keeping every signal, forward and backward, in a narrow corridor around scale 1 — init sets it, normalization holds it, and the axis you normalize across is destiny.',
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
      heading: 'Why this exists',
      paragraphs: [
        'Deep networks fail when the numbers inside them drift out of range. If each layer makes activations a little larger, later layers saturate and gradients become unreliable. If each layer makes activations a little smaller, the signal fades into numerical static. Initialization helps at step zero, but training moves the weights, so scale must be managed throughout training.',
        'BatchNorm and LayerNorm are two answers to that problem. Both standardize intermediate activations and then let the model learn scale and shift parameters. They do not make the network less expressive. They make the optimization geometry easier to navigate by keeping intermediate signals in a usable corridor.',
        'This page is about the axis choice. BatchNorm normalizes a feature across a batch of examples. LayerNorm normalizes one example across its features. That one difference explains much of the split between CNN-era vision models and transformer-era sequence models.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is careful initialization. Xavier and He initialization choose weight scales so signals begin in a reasonable range. That is necessary, but it is not enough. The optimizer immediately changes the weights, and the input distribution to each layer shifts as earlier layers learn.',
        'Another obvious approach is to lower the learning rate until nothing explodes. That can make training stable, but it slows learning and does not solve the deeper problem: every layer is still operating with changing input scale. Normalization gives the optimizer a better coordinate system instead of merely asking it to tiptoe.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is compounding. A tiny scale error at one layer is tolerable. The same error repeated across dozens or hundreds of layers becomes a training failure. This is the forward-pass cousin of vanishing and exploding gradients.',
        'The second wall is operational. BatchNorm uses statistics from the current batch during training, then running averages during inference. That creates a train/eval mode split and makes behavior sensitive to batch size. LayerNorm avoids that coupling, but it uses a different statistic and does not get the same population-level feature normalization that BatchNorm gets.',
        'The third wall is explanation. BatchNorm was introduced with the language of internal covariate shift, but later work showed that story was incomplete. The stronger lesson is that normalization smooths the optimization landscape and makes larger, more reliable gradient steps possible.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Normalize intermediate activations, then give the network learned parameters to restore any useful scale and offset. The normalized value is usually computed as (x - mean) / standard deviation, then transformed as gamma * normalized + beta. Gamma and beta are learned like other parameters.',
        'The learned scale and shift matter. Without them, normalization would force every layer into a fixed standardized shape. With them, the network can learn the scale it needs while the optimizer still benefits from stable coordinates.',
        'BatchNorm and LayerNorm differ mainly in what set of values produces the mean and variance. BatchNorm asks: how unusual is this feature compared with the same feature in the batch? LayerNorm asks: how large is this activation compared with the other features in the same example?',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The drift view shows why normalization is needed before formulas matter. Slightly too-large activations compound into saturation. Slightly too-small activations compound into silence. Normalization recenters and rescales the signal at each layer, so the next layer receives numbers it can use.',
        'The BatchNorm-versus-LayerNorm grid teaches the axis. BatchNorm uses a column statistic across examples in a batch, so one sample\'s normalized value depends on its batchmates. LayerNorm uses a row statistic inside one sample, so the same example receives the same normalization regardless of batch size.',
        'The animation also shows why gamma and beta are not cosmetic. After standardization, the model gets to re-dress the signal with learned scale and shift. That is what lets normalization help optimization without permanently removing representational flexibility.',
      ],
    },
    {
      heading: 'How BatchNorm works',
      paragraphs: [
        'For each feature or channel, BatchNorm computes a mean and variance over the mini-batch, normalizes the activations, then applies learned gamma and beta. During training, the batch statistics are live. During inference, the layer uses running averages accumulated during training.',
        'This works especially well in many convolutional networks because images often arrive in reasonably large, homogeneous batches and each channel has enough examples to estimate useful statistics. BatchNorm can make training faster, allow higher learning rates, and reduce sensitivity to initialization.',
        'The cost is coupling. A sample\'s normalized activation depends on the other samples in the batch. Small batches produce noisy estimates. Inference uses a different statistics path. Forgetting evaluation mode in a framework can cause a model to normalize with one-sample batch statistics and behave badly.',
      ],
    },
    {
      heading: 'How LayerNorm works',
      paragraphs: [
        'LayerNorm computes mean and variance within one sample, across its hidden features. It then applies learned scale and shift. There is no dependence on other samples in the batch and no running-average train/inference split.',
        'That makes LayerNorm a natural fit for sequence models and transformers. Generation often runs with batch size one, sequence lengths vary, and coupling one token or sentence to unrelated batchmates is undesirable. LayerNorm gives stable behavior for the same input whether it appears alone or inside a larger batch.',
        'Modern transformer variants often use RMSNorm, which removes the mean subtraction and divides by root-mean-square before applying a learned scale. RMSNorm keeps much of the practical benefit with slightly less computation and memory movement, which matters at LLM scale.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Normalization works by changing the geometry of optimization. Gradients become less sensitive to uncontrolled activation scale. The optimizer can take larger steps without sending later layers into saturation or silence.',
        'The historical explanation said BatchNorm reduced internal covariate shift: the changing input distribution seen by each layer. Later analysis by Santurkar and coauthors showed that reducing that shift was not the main mechanism. BatchNorm still helped even when distribution shift was deliberately reintroduced after normalization. The stronger measured effect was smoother optimization.',
        'That distinction matters for learning. A technique can be useful even when its first explanation is incomplete. The practical lesson is not to memorize a slogan. The practical lesson is to ask what property of the optimization problem changed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take a mini-batch with three examples and four features. Feature two might have values near 90, 110, and 130, while feature three has values near 0.2, 0.4, and 0.6. BatchNorm treats each feature column separately: feature two gets standardized using the mean and variance of the feature-two column.',
        'LayerNorm looks at one row at a time. For sample one, it computes statistics across that sample\'s four feature values and normalizes those values relative to each other. If sample one is later evaluated alone, it receives the same LayerNorm result. It would not receive the same BatchNorm result unless the same batch statistics were used.',
        'This is why BatchNorm feels natural in big-batch image classification and LayerNorm feels natural in autoregressive generation. They solve the same scale-control problem, but their operational contracts are different.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'BatchNorm wins in many vision models with stable shapes and sufficiently large batches. It is fast, well supported, and historically central to training deep convolutional networks. It can regularize slightly because the batch statistics add noise during training.',
        'LayerNorm wins in transformers, RNNs, autoregressive models, and variable-length sequence work. Its independence from batchmates makes it easier to reason about in serving, generation, and distributed training settings. RMSNorm wins when the model wants the LayerNorm-style contract with less arithmetic.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'BatchNorm struggles with tiny batches, distribution shifts between training and inference, unusual evaluation modes, and workloads where batchmates should not influence one another. It also requires careful handling in distributed training, where per-device batch statistics may be too small unless synchronized.',
        'LayerNorm is not automatically better. It does not use population statistics across a feature, and in some convolutional settings it may underperform BatchNorm. Normalization can also interact badly with residual placement, optimizer settings, mixed precision, and activation checkpointing if the whole block is not designed coherently.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'The main idea is scale control with learned escape hatches. Normalize the signal so optimization is stable, then let gamma and beta restore whatever scale and shift the network needs.',
        'The main choice is the axis. BatchNorm normalizes down the batch column. LayerNorm normalizes across the feature row. That axis choice decides batch coupling, inference behavior, and where each method fits best.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Vanishing and Exploding Gradients, Activation Functions, Learning-Rate Schedules & Warmup, Loss Landscapes & Optimization Geometry, The Transformer Block, Residual Networks, RMSNorm, and Neural Network Forward Pass next. A useful debugging habit is to log activation means and standard deviations by layer before changing optimizers or blaming the dataset.',
      ],
    },
  ],
};
