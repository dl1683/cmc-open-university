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
      heading: `What it is`,
      paragraphs: [
        `Batch Normalization and Layer Normalization re-standardize the signal at every layer to keep it from exploding or vanishing. The visualization shows weights 1.75× larger than 1 growing to 50× by layer 8; weights 0.55× smaller shrink by layer 6—forward activations compound like backward gradients. The fix: at every layer, measure mean μ and standard deviation σ, standardize to mean 0 / variance 1, then re-dress with learnable γ (scale) and β (shift). This third step matters: the network can undo it if needed, so normalization reshapes optimization GEOMETRY, not function family. The entire BN-vs-LN war is one choice: which axis to normalize across.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Normalization in three steps: measure activations' mean and std; standardize (subtract mean, divide by std); re-dress with learned γ and β. Why it works: predictably scaled inputs at each layer let gradients propagate cleanly; the optimizer takes bigger steps. Training loss falls 3× faster, learning rates go 10× higher. Santurkar et al. (2018) deliberately re-injected distribution shift after BatchNorm—training still worked great. The mechanism is not fixing covariate shift; it is smoothing the loss landscape. Bigger steps become trustworthy because gradients change slowly.`,
        `BatchNorm (columns of the visualization's 3×4 batch): standardize each feature across its batchmates. Feature 2's [110, 90, 130]→[0, −1.22, 1.22]. This couples samples—outputs depend on batchmates. LayerNorm (rows): standardize each sample across its features, batch-independent. BatchNorm needs running statistics at inference and a model.eval() switch. LayerNorm is identical at batch 1 or 1,000. Vision keeps BatchNorm (big batches); transformers use LayerNorm twice per block; LLMs use RMSNorm (LayerNorm without mean subtraction, just divide by RMS and multiply by γ).`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Training: O(B × D) to measure and standardize (negligible vs. matrix ops). Storage: O(D) for running stats (BatchNorm) or scale/shift (LayerNorm). The payoff: 3× faster convergence, 10× higher learning rates, freedom from initialization tuning. The price: one extra pass over activations and two learned parameters per layer.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `BatchNorm became standard in vision (Ioffe & Szegedy, 2015)—nearly every CNN carries it. ImageNet classifiers, detectors, segmentation all depend on it. LayerNorm is universal in transformers: BERT, GPT, T5, all modern LLMs. RMSNorm is standard in LLaMA-class LLMs. Deep networks are fragile about scale; normalization is not optional.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Forgetting model.eval() at BatchNorm inference: during training it uses batch stats; at test time it uses running averages. Forget the switch and you compute from batch-size-1 data—garbage. Small batches make statistics noisy. Sequences break coupling: should "the" in your sentence normalize against someone else's words just because they share a batch? LayerNorm sidesteps all this, asking a cruder statistical question. RMSNorm drops even the mean. None are strictly better—different compromises. Misconception: γ and β are fixed after training. False—they are learned like weights.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Vanishing & Exploding Gradients explains the backward disease normalization helps. Transformer Block shows LayerNorm in action—pre-norm placement stabilizes stacks. Learning-Rate Schedules & Warmup: schedules reduce lr over time; normalization lets you start higher. Loss Landscapes & Optimization Geometry explains Santurkar's smoothness finding. Dropout complements normalization for clean, generalizable features.`,
      ],
    },
  ],
};

