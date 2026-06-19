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
      heading: 'How to read the animation',
      paragraphs: [
        'The drift view plots activation scale (standard deviation) across eight layers. Two curves show what happens when per-layer weight magnitude is slightly too large (1.75x) or slightly small (0.55x): the scale explodes or collapses within a few layers. The green marker at layer 8 marks the healthy corridor near scale 1. The fix view shows the three-step normalization operation -- measure, standardize, re-dress -- applied at every layer to hold activations in that corridor.',
        'The axis-war view lays out a 3-sample, 4-feature activation grid. Vertical highlights (blue) show BatchNorm: statistics computed down a column, one feature across the batch. Horizontal highlights (orange) show LayerNorm: statistics computed along a row, one sample across its features. Watch each cell\'s normalized value change depending on which axis is chosen, and notice that LayerNorm\'s output for a given sample never changes when you swap its batchmates.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Deep networks compound layer by layer. Each layer multiplies activations by a weight matrix, and the product\'s scale compounds: a per-layer factor of 1.75 reaches 50x by layer 8, saturating every nonlinearity. A factor of 0.55 shrinks to 0.01x, burying the signal in floating-point noise. The forward pass has the same compounding disease as the backward pass -- Vanishing & Exploding Gradients showed the gradient version; here is the activation version.',
        'Ioffe and Szegedy (2015) proposed Batch Normalization to fix this: at every layer, re-standardize the activations to mean 0, variance 1, then apply a learned scale and shift so the network can recover whatever distribution it needs. The paper framed the problem as "internal covariate shift" -- each layer\'s input distribution keeps changing as the layers before it update, forcing every layer to chase a moving target. BN became an overnight standard in CNNs and made training deep convolutional networks dramatically faster.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Before BN, the standard fix was careful initialization. Xavier initialization (2010) sets each layer\'s weights so the variance of the output matches the variance of the input, assuming linear activations. He initialization (2015) adjusts for ReLU\'s half-zeroing. Both keep activation scale near 1 at step zero.',
        'Paired with a small learning rate, careful init works for shallow networks. The first few layers stay near their calibrated scale for many epochs, and the learning rate is small enough that weight updates do not push the scale far from the corridor. This was sufficient for AlexNet-era architectures (5-8 convolutional layers).',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Initialization is a one-time calibration. Training moves the weights, and by epoch 10 the careful tuning is history. Each gradient step shifts every layer\'s weights slightly, which shifts the output distribution of that layer, which shifts the input distribution of the next layer. In a 50-layer network, a small weight change in layer 3 cascades into a large distribution change at layer 40.',
        'A small learning rate slows the drift but also slows convergence. Practitioners were stuck: use a large learning rate and watch training explode as activation scales compound, or use a small learning rate and wait days for the model to converge. Deeper networks made the tradeoff worse -- more layers means more compounding, which means a smaller safe learning rate, which means slower training. The field needed a way to enforce scale discipline continuously, not just at initialization.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a mini-batch of N samples with D features, BatchNorm processes each feature independently. Take feature j: collect its N values across the batch, compute their mean and variance, normalize each value to zero mean and unit variance, then apply learned parameters gamma_j and beta_j.',
        'Concretely: mu_j = (1/N) * sum of x_{i,j} for i = 1..N. sigma_j^2 = (1/N) * sum of (x_{i,j} - mu_j)^2. The normalized value is x_hat_{i,j} = (x_{i,j} - mu_j) / sqrt(sigma_j^2 + epsilon), where epsilon (typically 1e-5) prevents division by zero. The final output is y_{i,j} = gamma_j * x_hat_{i,j} + beta_j.',
        'The learnable gamma and beta are essential. Without them, normalization would force every layer\'s output to have exactly mean 0 and variance 1, stripping away information the network needs. With gamma and beta, the network can learn to undo the normalization entirely (set gamma = sigma, beta = mu) or settle on any other scale and shift. Normalization does not restrict what the network can represent -- it changes the geometry of the optimization, giving the optimizer coordinates where every layer\'s input is predictably scaled.',
        'Training uses live batch statistics. Inference uses running averages: an exponential moving average of mu and sigma^2 accumulated during training, typically with momentum 0.1 (new_running = 0.9 * old_running + 0.1 * batch_stat). This creates two modes -- train and eval -- and the model must be switched between them. Forgetting model.eval() at inference time is one of the most common bugs in deep learning: the model computes statistics from a single sample instead of the population averages, producing silent garbage.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The original explanation -- curing internal covariate shift -- held for three years. Santurkar, Tsipras, Ilyas, and Madry tested it directly in "How Does Batch Normalization Help Optimization?" (2018). They deliberately re-injected distribution shift after every BN layer by adding random noise to the normalized activations. If curing shift were the mechanism, this should destroy the benefit. Training stayed just as fast.',
        'The measured mechanism is different: BN smooths the loss landscape. The gradient of the loss changes more slowly as a function of the parameters (the loss has a smaller Lipschitz constant for its gradients). Smoother landscapes mean larger steps stay trustworthy -- the optimizer can use a higher learning rate without overshooting into a region where the gradient points in a completely different direction. This is why BN networks tolerate 10x larger learning rates: the landscape is flatter, so each step covers more useful ground.',
        'BN also acts as implicit regularization. Because batch statistics are noisy estimates of the true population statistics (they come from a finite mini-batch), every forward pass injects a small amount of noise into the activations. This noise is analogous to dropout: it prevents co-adaptation and improves generalization slightly. The effect is stronger with smaller batches, where the noise is larger.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'BN is O(N * D) per layer per forward pass: N samples times D features, each requiring a subtraction, division, multiplication, and addition. This is cheap compared to the O(N * D^2) matrix multiplications that produce the activations. For a layer with D = 512 features and a batch of N = 64, BN does about 130K arithmetic operations versus the 17M of the matmul.',
        'BN adds 2 * D learnable parameters per layer: one gamma and one beta per feature. For D = 512 that is 1,024 parameters -- negligible next to a weight matrix with D^2 = 262,144 entries. It also stores 2 * D running statistics (running mean and running variance) that are not trained by gradient descent but updated by exponential moving average.',
        'The hidden cost is operational. Running averages must be maintained and saved with the model checkpoint. In distributed training, batch statistics must be synchronized across GPUs (SyncBatchNorm), which adds communication overhead proportional to D at every layer. And the train/eval mode switch is a source of bugs that no amount of documentation fully prevents.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'CNNs are BN\'s home turf. ResNet, Inception, EfficientNet, and ConvNeXt all carry BN in every block. The fit is natural: image batches are large (32-256), every image has the same spatial dimensions, and each channel (feature) has consistent meaning across samples (edge detector, color channel, texture filter). Per-feature population statistics are genuinely informative in this setting.',
        'BN enabled the depth revolution. Pre-BN, training networks deeper than 20 layers was fragile. With BN, ResNet-152 trained stably at learning rates that would have diverged without it. The combination of BN and residual connections unlocked architectures with hundreds of layers, and BN\'s implicit regularization reduced overfitting enough that some teams dropped explicit dropout from their CNNs.',
        'Training converges faster with BN. Ioffe and Szegedy reported reaching the same validation accuracy in 14x fewer training steps on ImageNet. The higher learning rate covers more ground per step, and the smoother landscape means fewer steps are wasted on oscillation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Small batch sizes produce noisy statistics. With a batch of 2-4 samples, the sample mean and variance are poor estimates of the population values, and the noise feeds directly into the normalized activations. Medical imaging, reinforcement learning, and fine-tuning with limited GPU memory routinely use batch sizes this small. Group Normalization (Wu & He, 2018) was designed specifically for this case: it normalizes within feature groups per sample, avoiding batch coupling entirely.',
        'RNNs and Transformers process variable-length sequences. In a batch of sentences, BN would normalize the word "the" in sentence A against the words of sentence B, just because they share a batch slot. That cross-contamination is semantically meaningless. Ba, Kiros, and Hinton (2016) introduced Layer Normalization to fix this: normalize each sample across its own features (row statistics instead of column statistics), making each token independent of its batchmates.',
        'Online learning and single-sample inference during training break BN. If the batch is a single sample, the variance is zero and normalization is undefined. The running-average workaround only applies at inference time; during training, BN fundamentally requires a population. Autoregressive generation (producing one token at a time) is the extreme case: a normalization method that needs peers is architecturally incompatible with sequential decoding.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A batch of 4 samples, each with 2 features. The raw activations: sample 1 = [4, 10], sample 2 = [8, 6], sample 3 = [6, 14], sample 4 = [2, 10]. BN normalizes each feature (column) independently.',
        'Feature 1 values: [4, 8, 6, 2]. Mean mu_1 = (4 + 8 + 6 + 2) / 4 = 5. Variance sigma_1^2 = ((4-5)^2 + (8-5)^2 + (6-5)^2 + (2-5)^2) / 4 = (1 + 9 + 1 + 9) / 4 = 5. Standard deviation sigma_1 = sqrt(5) = 2.236. Normalized: x_hat = [(4-5)/2.236, (8-5)/2.236, (6-5)/2.236, (2-5)/2.236] = [-0.447, 1.342, 0.447, -1.342].',
        'Feature 2 values: [10, 6, 14, 10]. Mean mu_2 = 10. Variance sigma_2^2 = (0 + 16 + 16 + 0) / 4 = 8. Standard deviation sigma_2 = 2.828. Normalized: x_hat = [0, -1.414, 1.414, 0].',
        'Apply gamma = 1.5, beta = 0.5 to both features. Feature 1 output: y = 1.5 * x_hat + 0.5 = [-0.17, 2.51, 1.17, -1.51]. Feature 2 output: y = [0.5, -1.62, 2.62, 0.5]. The network has shifted each feature to a new learned center (0.5) and stretched by a learned factor (1.5). If the optimal representation happens to need mean 5 and std 2.236 for feature 1, the network can learn gamma = 2.236 and beta = 5 to recover the original distribution exactly.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Ioffe & Szegedy, "Batch Normalization: Accelerating Deep Network Training" (2015) -- introduced BN and the internal covariate shift hypothesis. Santurkar, Tsipras, Ilyas & Madry, "How Does Batch Normalization Help Optimization?" (2018) -- showed BN works by smoothing the loss landscape, not by reducing covariate shift. Ba, Kiros & Hinton, "Layer Normalization" (2016) -- proposed normalizing across features per sample to eliminate batch coupling. Zhang & Sennrich, "Root Mean Square Layer Normalization" (2019) -- simplified LayerNorm by dropping mean subtraction. Wu & He, "Group Normalization" (2018) -- normalizes within feature groups per sample, bridging BN and LN for small-batch vision.',
        'Study Layer Normalization next to see how changing the normalization axis from "per feature across the batch" to "per sample across features" solved the sequence and small-batch problems. Study Group Normalization for the hybrid approach used in diffusion models and small-batch vision. Study Instance Normalization for the per-sample, per-channel variant used in style transfer. Study RMSNorm for the simplified variant that powers LLaMA-class language models. Study Loss Landscapes to see why smoother optimization surfaces allow larger learning rates -- the same mechanism that explains BN\'s real benefit.',
      ],
    },
  ],
};
