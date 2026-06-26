// DP-SGD: clip each example's gradient, average the bounded updates, add
// calibrated noise, and account for privacy loss over repeated training rounds.

import { matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'differential-privacy-sgd',
  title: 'Differential Privacy SGD',
  category: 'AI & ML',
  summary: 'Train with bounded individual influence: per-example clipping, Gaussian noise, privacy accounting, and the accuracy tradeoff.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['clipping and noise', 'privacy accounting'], defaultValue: 'clipping and noise' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function* clippingAndNoise() {
  const clipNorm = 1;
  const examples = [
    { id: 'a', label: 'example A' },
    { id: 'b', label: 'example B' },
    { id: 'c', label: 'example C' },
    { id: 'outlier', label: 'rare outlier' },
  ];
  const rawNorms = [0.7, 1.0, 0.4, 8.2];
  yield {
    state: labelMatrix(
      'Per-example gradients before and after clipping',
      examples,
      [
        { id: 'raw', label: 'raw norm' },
        { id: 'clipped', label: `after clip C=${clipNorm}` },
        { id: 'effect', label: 'effect' },
      ],
      [
        [String(rawNorms[0]), String(rawNorms[0]), 'kept'],
        [String(rawNorms[1]), String(rawNorms[1]), 'kept'],
        [String(rawNorms[2]), String(rawNorms[2]), 'kept'],
        [String(rawNorms[3]), String(clipNorm), 'bounded'],
      ],
    ),
    highlight: { active: ['outlier:raw'], found: ['outlier:clipped'], compare: ['a:clipped', 'b:clipped', 'c:clipped'] },
    explanation: `Read the ${examples.length} rows as individual records before averaging. DP-SGD must compute per-example gradients so the outlier (raw norm ${rawNorms[3]}) can be clipped to C=${clipNorm}; if clipping happens only after averaging, one record has already had too much influence.`,
    invariant: `The contribution of one example is bounded to norm ${clipNorm} before averaging across ${examples.length} examples.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'gradient x', min: -1.5, max: 4.5 }, y: { label: 'gradient y', min: -1.5, max: 4.5 } },
      markers: [
        { id: 'gA', x: 0.6, y: 0.3, label: 'A' },
        { id: 'gB', x: 0.9, y: 0.4, label: 'B' },
        { id: 'gC', x: 0.2, y: 0.3, label: 'C' },
        { id: 'rawOut', x: 4.0, y: 3.2, label: 'raw outlier' },
        { id: 'clipOut', x: 0.8, y: 0.6, label: 'clipped outlier' },
      ],
      vectors: [
        { id: 'clip', label: 'project to norm C', from: { x: 4.0, y: 3.2 }, to: { x: 0.8, y: 0.6 } },
      ],
    }),
    highlight: { active: ['clip'], removed: ['rawOut'], found: ['clipOut'] },
    explanation: `Clipping changes only gradients whose norm exceeds C=${clipNorm}. In high-dimensional neural nets this is not a cosmetic detail: without clipping, a rare or memorized record (norm ${rawNorms[3]}) can dominate the average and make privacy accounting meaningless.`,
  };

  yield {
    state: labelMatrix(
      'Average, then add Gaussian noise',
      [
        { id: 'avg', label: 'clipped average' },
        { id: 'noise', label: 'noise sample' },
        { id: 'sent', label: 'optimizer update' },
        { id: 'signal', label: 'tradeoff' },
      ],
      [
        { id: 'x', label: 'x component' },
        { id: 'y', label: 'y component' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['+0.63', '+0.40', 'bounded signal'],
        ['-0.18', '+0.27', 'privacy noise'],
        ['+0.45', '+0.67', 'noisy update'],
        ['more noise', 'less leakage', 'less accuracy'],
      ],
    ),
    highlight: { active: ['noise:x', 'noise:y'], found: ['sent:x', 'sent:y'], compare: ['signal:meaning'] },
    explanation: `After averaging ${examples.length} clipped gradients (each bounded to norm ${clipNorm}), DP-SGD adds calibrated noise. The optimizer still moves, but it sees a noisy direction so neighboring datasets are harder to distinguish from the final model.`,
  };

  const loopSteps = [
    { id: 'sample', label: 'sample minibatch' },
    { id: 'perex', label: 'per-example grads' },
    { id: 'clip', label: 'clip' },
    { id: 'noise', label: 'add noise' },
    { id: 'account', label: 'account' },
  ];
  yield {
    state: labelMatrix(
      'The DP-SGD training loop',
      loopSteps,
      [
        { id: 'why', label: 'why it exists' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['subsampling amplifies privacy', 'randomness to track'],
        ['needed for clipping', 'more memory and compute'],
        ['bound one record', 'biases gradient'],
        ['hide participation', 'lowers signal-to-noise'],
        ['compose over rounds', 'epsilon budget is finite'],
      ],
    ),
    highlight: { found: ['perex:why', 'clip:why', 'noise:why', 'account:why'] },
    explanation: `The algorithm is simple enough to fit in one table with ${loopSteps.length} steps, but the engineering is not free. ${loopSteps.map(s => s.label).join(', ')} all change the training system and the model-quality budget.`,
  };
}

function* privacyAccounting() {
  const neighborRows = [
    { id: 'd', label: 'dataset D' },
    { id: 'dprime', label: 'dataset D prime' },
    { id: 'mechanism', label: 'training run' },
    { id: 'observer', label: 'observer' },
  ];
  yield {
    state: labelMatrix(
      'Neighboring datasets should look nearly the same',
      neighborRows,
      [
        { id: 'contains', label: 'difference' },
        { id: 'sees', label: 'what is visible' },
      ],
      [
        ['Alice included', 'final model distribution'],
        ['Alice removed', 'almost same distribution'],
        ['random sampling + noise', 'not deterministic'],
        ['model outputs', 'cannot be too sure'],
      ],
    ),
    highlight: { active: ['d:contains', 'dprime:contains'], found: ['mechanism:sees', 'observer:sees'] },
    explanation: `Differential privacy is a statement about ${neighborRows.length} actors (${neighborRows.map(r => r.label).join(', ')}). Two neighboring datasets differ in one person. A mechanism is private when the "${neighborRows[3].label}" seeing the output cannot confidently tell which neighboring dataset was used.`,
    invariant: `Privacy across ${neighborRows.length} perspectives is about distributions over outputs, not hiding a row in a database table.`,
  };

  const strictEps = 1.0;
  const strictAcc = 74;
  const looseEps = 8.0;
  const looseAcc = 90;
  const frontierPoints = [{ x: 0.5, y: 68 }, { x: strictEps, y: strictAcc }, { x: 2.0, y: 81 }, { x: 4.0, y: 87 }, { x: looseEps, y: looseAcc }, { x: 12.0, y: 91 }];
  yield {
    state: plotState({
      axes: { x: { label: 'epsilon privacy loss', min: 0, max: 12 }, y: { label: 'validation accuracy', min: 60, max: 95 } },
      series: [
        { id: 'frontier', label: 'typical privacy-utility frontier', points: frontierPoints },
      ],
      markers: [
        { id: 'strict', x: strictEps, y: strictAcc, label: 'strict privacy' },
        { id: 'loose', x: looseEps, y: looseAcc, label: 'looser privacy' },
      ],
    }),
    highlight: { active: ['frontier'], compare: ['strict', 'loose'] },
    explanation: `Lower epsilon (e.g. ${strictEps}) is stronger privacy, but usually requires more noise and hurts utility (accuracy ${strictAcc}%). Higher epsilon (e.g. ${looseEps}) gives the optimizer a cleaner signal but weaker privacy (accuracy ${looseAcc}%). The frontier spans ${frontierPoints.length} measured points.`,
  };

  const roundCounts = [1, 10, 100, 1000];
  const roundRows = roundCounts.map(n => ({ id: `r${n}`, label: `${n} round${n > 1 ? 's' : ''}` }));
  yield {
    state: labelMatrix(
      'Composition consumes privacy budget',
      roundRows,
      [
        { id: 'gain', label: 'learning gain' },
        { id: 'privacy', label: 'privacy cost' },
      ],
      [
        ['tiny', 'small'],
        ['visible', 'moderate'],
        ['stronger model', 'large'],
        ['maybe overfit', 'budget exhausted'],
      ],
    ),
    highlight: { active: ['r100:gain'], removed: ['r1000:privacy'], compare: ['r1:privacy'] },
    explanation: `Every private training step spends privacy budget across ${roundRows.length} scale points from ${roundCounts[0]} to ${roundCounts[roundCounts.length - 1]} rounds. Accountants track how sampling, clipping, noise, and repeated rounds compose. The model may keep improving after the ledger says the release should stop.`,
  };

  const protectionRows = [
    { id: 'membership', label: 'membership inference' },
    { id: 'memorization', label: 'memorization' },
    { id: 'fairness', label: 'group fairness' },
    { id: 'poisoning', label: 'poisoning' },
  ];
  yield {
    state: labelMatrix(
      'What DP-SGD protects, and what it does not',
      protectionRows,
      [
        { id: 'dp', label: 'DP-SGD helps?' },
        { id: 'extra', label: 'still needs' },
      ],
      [
        ['yes', 'good accounting'],
        ['yes', 'audits and red-teaming'],
        ['not directly', 'slice metrics'],
        ['not enough', 'robust aggregation'],
      ],
    ),
    highlight: { found: ['membership:dp', 'memorization:dp'], compare: ['fairness:extra', 'poisoning:extra'] },
    explanation: `DP-SGD is a privacy tool covering ${protectionRows.length} threat categories, not a full responsible-AI system. It helps with ${protectionRows[0].label} and ${protectionRows[1].label}, but does not automatically solve ${protectionRows[2].label} or ${protectionRows[3].label}.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'clipping and noise') yield* clippingAndNoise();
  else if (view === 'privacy accounting') yield* privacyAccounting();
  else throw new InputError('Pick a DP-SGD view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        `The clipping-and-noise view shows a minibatch of four examples, each with its own gradient vector. One outlier has a much larger norm than the rest. Watch how clipping scales it down to the bound C while leaving smaller gradients untouched. After clipping, the view averages the clipped gradients and adds Gaussian noise to produce the final update. The key thing to track: the outlier still contributes in the same direction, but its magnitude is capped so it cannot dominate.`,
        `The privacy-accounting view tracks how epsilon grows step by step. Each training iteration consumes a slice of the privacy budget. The composition table shows the cumulative cost after 10, 100, and 1,000 steps under different noise multipliers. Notice that stronger noise (higher multiplier) slows the budget drain but also shrinks the useful signal in each update. The tradeoff between accuracy and privacy is visible as two curves diverging.`,
        {type: 'image', src: './assets/gifs/differential-privacy-sgd.gif', alt: 'Animated walkthrough of the differential privacy sgd visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Stochastic gradient descent (SGD) updates a model\'s parameters by computing how much the loss changes with respect to each parameter -- a vector called the gradient -- and stepping in the direction that reduces loss. Standard SGD was designed to find useful patterns, not to limit what the trained model reveals about the people who supplied the data. Every gradient carries information about the example that produced it, and after thousands of steps those traces accumulate in the released parameters.`,
        {type: `callout`, text: `DP-SGD makes training auditable by clipping each example before aggregation, adding calibrated noise, and charging every step to a privacy ledger.`},
        `The threat is concrete. Membership inference attacks train a classifier to guess whether a specific record was in the training set by probing the model\'s outputs. Training-data extraction attacks recover verbatim training text from language models. Both succeed because the model memorized individual examples too faithfully. Hiding the raw dataset and releasing only the model is not enough: the model is a compressed consequence of the data, and compression does not automatically erase individual traces.`,
        `Differential Privacy SGD (DP-SGD) solves this by bounding how much any single training example can influence the released model. It does this through three mechanisms applied at every training step: per-example gradient clipping, calibrated Gaussian noise addition, and formal privacy accounting. The result is a mathematical guarantee -- parameterized by epsilon and delta -- on how distinguishable two training runs are when they differ by one person\'s data.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The simplest idea is to train normally and add noise to the final model. Train with ordinary SGD for as many epochs as you want, then perturb every parameter with random noise before release. This is cheap, easy to implement, and preserves the full training signal until the very end. You could also try training on an anonymized version of the dataset -- removing names, hashing identifiers, masking rare values -- and releasing the resulting model without any noise at all.`,
        `Another natural attempt is to aggregate before adding noise. Compute the average gradient across the minibatch, add Gaussian noise to that average, and use the noisy average as the update. This is how many people first imagine private training should work: the average pools information from many examples, so individual contributions should be diluted. The noise then blurs whatever individual signal remains.`,
        `Both approaches feel reasonable because they follow the intuition that privacy means hiding. Hide the data behind a model, or hide individual gradients behind an average, or hide parameters behind noise. The problem is that none of these approaches provide a formal bound on individual influence without additional structure.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `Adding noise only to the final model fails because the model has already memorized individual examples during training. A language model trained on medical records may have encoded rare phrasings verbatim in its parameters. Post-hoc noise must be enormous to mask those traces, and enormous noise destroys utility. There is no principled way to calibrate the noise because you do not know how much any single example influenced the final parameters.`,
        {type: `image`, src: `https://www.nist.gov/sites/default/files/images/2021/12/17/DP-machine-learning-1.png`, alt: `NIST diagram of differential privacy in a machine learning workflow`, caption: `DP in machine learning is a training-release contract, not just access control around the raw dataset. Source: https://www.nist.gov/sites/default/files/images/2021/12/17/DP-machine-learning-1.png`},
        `Adding noise to the average gradient fails for a different reason: the average itself may have unbounded sensitivity. Sensitivity, in differential privacy, is the maximum change in the output when one input record changes. Consider a batch of four examples where three have gradient norm near 1 and one outlier has norm 80. The average gradient has norm roughly 20.75. Remove the outlier and replace it with a normal example: the average drops to about 1. That is a change of nearly 20 in the output from swapping one record. No fixed noise calibration can hide a change whose magnitude is unpredictable.`,
        `Anonymization fails because it removes identifiers but not statistical uniqueness. A 45-year-old with a rare diagnosis in a specific zip code may be the only such person in the dataset. The model learns a pattern that effectively identifies them without ever seeing their name. De-identification protects against casual lookup, not against inference from learned patterns.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Bound individual influence before aggregation, not after. If every example\'s gradient is clipped to a maximum norm C before the batch average is computed, then swapping any single example can change the average by at most 2C/B, where B is the batch size. This quantity -- the sensitivity -- is now a known constant. Once sensitivity is known, the Gaussian mechanism from differential privacy theory tells you exactly how much noise to add: noise with standard deviation proportional to C * sigma / B, where sigma is the noise multiplier, hides the bounded change.`,
        {type: `image`, src: `https://docs.opendp.org/en/stable/_images/theory_a-framework-to-understand-dp_11_0.png`, alt: `OpenDP plot comparing probability regions under adjacent datasets`, caption: `Differential privacy reasons about neighboring output distributions, so clipping and noise must make those distributions hard to distinguish. Source: https://docs.opendp.org/en/stable/_images/theory_a-framework-to-understand-dp_11_0.png`},
        `The insight is that clipping makes the sensitivity problem tractable, and tractable sensitivity makes noise calibration principled. Without clipping, sensitivity is infinite (any example can produce an arbitrarily large gradient), so no finite noise suffices. With clipping, sensitivity is exactly 2C/B, so the required noise is finite and computable. The entire formal privacy guarantee flows from this one structural change to the training loop.`,
        `Clipping is not outlier removal. An example with gradient norm 80 and clip bound C = 1 is not thrown away. Its gradient is scaled down to norm 1 -- it still contributes in the same direction, just with bounded magnitude. The information about direction survives; only the disproportionate magnitude is removed. This means DP-SGD is bounded participation, not censorship.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A single DP-SGD step has five operations. First, sample a minibatch by including each training example independently with probability q = B/N, where B is the expected batch size and N is the dataset size. This Poisson sampling is important: the privacy accountant relies on the fact that each example has only a q chance of appearing in any given step. Second, compute the gradient of the loss with respect to model parameters for each sampled example individually. Standard deep learning frameworks compute one aggregate batch gradient; DP-SGD needs per-example gradients, which costs more memory and compute.`,
        `Third, clip each per-example gradient. For example i, compute the L2 norm of its gradient g_i. If the norm is at most C, keep g_i unchanged. If the norm exceeds C, replace g_i with g_i * (C / norm(g_i)), which rescales the vector to have norm exactly C while preserving its direction. Fourth, average the clipped gradients and add Gaussian noise: the update is (1/B) * sum(clipped_g_i) + N(0, sigma^2 * C^2 * I / B^2), where sigma is the noise multiplier and I is the identity matrix. Fifth, apply the noisy update to the model parameters and record the privacy cost of this step in the accountant.`,
        `The privacy accountant tracks cumulative privacy loss across all steps. Early implementations used strong composition theorems that give loose bounds. The Renyi Differential Privacy (RDP) accountant computes tighter bounds by tracking Renyi divergences at multiple orders and converting to (epsilon, delta)-DP at the end. The Moments Accountant from the original Abadi et al. (2016) paper is mathematically equivalent to RDP accounting. Modern implementations use numerical composition or the Privacy Loss Distribution (PLD) framework for even tighter tracking.`,
        `The entire mechanism relies on the order of operations: clip, then average, then noise, then account. Reordering breaks the guarantee. If you average before clipping, sensitivity is unbounded. If you add noise before averaging, you get noisier updates without the variance reduction from averaging. If you skip accounting, you have no bound on cumulative leakage.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Differential privacy is a statement about distributions, not about individual models. Train on dataset D containing Alice\'s data, and you get a distribution over possible models (from the randomness of sampling and noise). Train on D\' that is identical except Alice\'s record is removed, and you get a different distribution. The (epsilon, delta)-DP guarantee says: for any set of possible outputs S, Pr[model in S | trained on D] <= e^epsilon * Pr[model in S | trained on D\'] + delta. When epsilon is small, these two probabilities are close, so observing the released model tells you almost nothing about whether Alice was present.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg`, alt: `Layered neural network diagram with colored nodes and connections`, caption: `The released neural network is a compressed consequence of training data, so privacy must bound individual influence before parameters are published. Source: https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg`},
        `Three mechanisms combine to make this guarantee hold. Clipping ensures bounded sensitivity: removing Alice changes the clipped batch average by at most 2C/B. Gaussian noise with standard deviation proportional to C * sigma / B creates statistical overlap between the two output distributions -- the noise is large enough relative to the sensitivity that the distributions become hard to distinguish. Subsampling amplifies privacy: because Alice appears in any given batch with probability q = B/N, her expected influence is further reduced by a factor related to q. The privacy amplification by subsampling lemma shows that a mechanism with per-step privacy (epsilon_step) applied to a Poisson-sampled batch achieves effective per-step privacy roughly q * epsilon_step.`,
        `Composition across T steps is where the formal accounting matters. Naive composition says total epsilon is T * epsilon_step, which is too loose. Advanced composition and RDP give sub-linear growth: total epsilon grows roughly as sqrt(T) * epsilon_step for the Gaussian mechanism. This sub-linear scaling is what makes DP-SGD practical -- training for 10,000 steps does not cost 10,000 times the per-step privacy, but rather about 100 times. The accountant computes exact composition rather than relying on these asymptotic approximations.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Per-example gradients are the main computational cost. Standard backpropagation computes one gradient for the entire batch in O(B * P) time, where P is the parameter count. DP-SGD needs B separate gradients, each of size P, before clipping. Naive implementation multiplies memory by B. Optimized approaches exist: ghost clipping computes per-example gradient norms without materializing full per-example gradients, then only fully computes gradients for examples that need rescaling. Opacus (PyTorch) and TensorFlow Privacy provide vectorized per-example gradient computation that runs 2-5x slower than standard training rather than B times slower.`,
        `The noise adds negligible compute cost -- generating Gaussian random numbers is fast -- but it reduces the signal-to-noise ratio of each update. Larger batches help: if you double B, the signal in the average doubles but the noise (which scales as C * sigma / B) halves relative to the signal. Google\'s work on DP-SGD for large language models uses batch sizes of 2,048 to 8,192 to maintain reasonable signal-to-noise ratios. The tradeoff is that larger batches require more memory and may change optimization dynamics.`,
        `Privacy budget consumption scales with the number of training steps. A model trained for 10,000 steps at noise multiplier 1.0 with batch sampling rate 0.01 might achieve epsilon around 3 to 8, depending on the accountant. Achieving epsilon below 1 -- strong privacy -- typically requires either fewer steps, more noise, larger batches, or pre-training on public data followed by short private fine-tuning. The cost is real: DP-SGD models on CIFAR-10 historically achieved 70-80% accuracy versus 95%+ for non-private training, though the gap has narrowed with better architectures and pre-training strategies.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Apple uses DP-SGD for training on-device keyboard prediction models with federated learning. Each device computes local gradients, clips them, and sends noisy updates to the server. The server aggregates across millions of devices, where the per-device noise partially cancels. Google applies DP-SGD to train the Gboard next-word prediction model with formal (epsilon, delta)-DP guarantees. These deployments work because the user base is large enough that the noise-to-signal ratio remains manageable after aggregation.`,
        `The U.S. Census Bureau used differential privacy (though not DP-SGD specifically) for the 2020 Census, bringing formal privacy guarantees into government data releases. In healthcare, DP-SGD enables hospitals to collaboratively train diagnostic models without sharing patient records, using federated learning with per-example clipping as the privacy layer. The formal guarantee lets institutions quantify and contractually bound the privacy risk of participation.`,
        `DP-SGD is also used in large language model safety research. Measuring how much a model memorizes specific training examples is a privacy question. DP-SGD provides both a practical defense (clipping and noise reduce memorization) and a theoretical framework (epsilon quantifies the worst-case information leakage). Research groups use it to study the memorization-generalization tradeoff: how much privacy budget is needed before a model stops reproducing rare training sequences verbatim.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Small datasets suffer most. When N is small, the sampling rate q = B/N is large, privacy amplification by subsampling is weak, and each step costs more budget. A hospital with 500 patient records training a model for 1,000 steps will burn through its privacy budget quickly and end up with either a large epsilon (weak guarantee) or a noisy, unusable model. DP-SGD is most effective when N is large -- millions of examples -- so that each example has minimal influence even before clipping.`,
        `Fairness can degrade under DP-SGD. Clipping disproportionately affects rare subgroups whose gradients are larger (because the model has not yet learned their patterns). Noise affects all subgroups equally in absolute terms, but small subgroups have fewer examples to average over, so the noise-to-signal ratio is worse. A model that achieves 85% accuracy overall with epsilon = 3 might achieve 90% on the majority group and 60% on a minority group. The privacy guarantee is uniform, but the accuracy cost is not.`,
        `The guarantee only covers what DP-SGD controls. If the same private data is used for data exploration, feature engineering, hyperparameter tuning, and model selection outside the accountant, the formal epsilon underestimates the true leakage. Releasing multiple models, intermediate checkpoints, or training curves from the same private data composes additional privacy loss. DP-SGD bounds one step of the pipeline; the entire data lifecycle needs accounting to make the guarantee meaningful.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Consider a batch of 4 examples with a 3-dimensional parameter space. Clip norm C = 1.0, noise multiplier sigma = 1.0. The four per-example gradients are: g1 = [0.3, 0.4, 0.0] with norm 0.5, g2 = [0.1, -0.2, 0.6] with norm 0.64, g3 = [2.0, 1.5, -1.0] with norm 2.69, g4 = [0.0, 0.5, -0.3] with norm 0.58.`,
        `Clipping step: g1, g2, and g4 have norms below C = 1.0, so they stay unchanged. g3 has norm 2.69, which exceeds C, so it is rescaled: g3_clipped = [2.0, 1.5, -1.0] * (1.0 / 2.69) = [0.743, 0.557, -0.372]. The direction of g3 is preserved, but its magnitude drops from 2.69 to 1.0. Without clipping, g3 would contribute 4-5x more than the other examples to the average. After clipping, its contribution is comparable.`,
        `Averaging step: avg = (1/4) * ([0.3, 0.4, 0.0] + [0.1, -0.2, 0.6] + [0.743, 0.557, -0.372] + [0.0, 0.5, -0.3]) = [0.286, 0.314, -0.018]. Noise step: sample z from N(0, I) -- suppose z = [0.42, -0.31, 0.15]. The noisy update is avg + (sigma * C / B) * z = [0.286, 0.314, -0.018] + (1.0 * 1.0 / 4) * [0.42, -0.31, 0.15] = [0.286 + 0.105, 0.314 - 0.078, -0.018 + 0.038] = [0.391, 0.236, 0.020]. The noise has shifted each coordinate by 0.04 to 0.1 -- comparable to the signal magnitude, which is the regime where one-person changes are masked.`,
        `Privacy cost: this single step with Poisson sampling rate q, noise multiplier sigma = 1.0, and clip norm C = 1.0 has a per-step RDP cost that depends on q and the RDP order alpha. For q = 0.01 and alpha = 10, the per-step RDP epsilon is approximately 0.005. After 1,000 such steps, the cumulative RDP epsilon at order 10 is about 5.0, which converts to approximately (epsilon = 2.3, delta = 1e-5) in standard DP. Doubling sigma to 2.0 would roughly halve the per-step cost, cutting the final epsilon to about 1.1 at the same delta -- stronger privacy, but each update carries more noise relative to signal.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `The foundational paper is Abadi et al. 2016, "Deep Learning with Differential Privacy," which introduced per-example gradient clipping, the Gaussian mechanism applied per step, and the moments accountant for tight composition. Dwork and Roth 2014, "The Algorithmic Foundations of Differential Privacy," provides the mathematical theory underlying all DP mechanisms -- sensitivity, composition, and the Gaussian and Laplace mechanisms. Mironov 2017, "Renyi Differential Privacy of the Sampled Gaussian Mechanism," formalized the RDP accountant that most modern implementations use.`,
        `For practical implementation, Opacus (PyTorch) and TensorFlow Privacy are the standard libraries. Both handle per-example gradient computation, clipping, noise injection, and privacy accounting. The OpenDP project provides a framework-agnostic privacy accounting library. Balle et al. 2020, "Hypothesis Testing Interpretations and Renyi Differential Privacy," gives the tightest known conversion from RDP to standard DP.`,
        `Study Gradient Descent first so the update rule is concrete, then Batch Size Scaling to understand how aggregation affects signal-to-noise ratio. Federated Learning and Secure Aggregation address complementary privacy layers -- data locality and communication privacy, respectively. The Membership Inference topic shows the attack that DP-SGD directly constrains: if you understand how membership inference probes a model, the motivation for bounding per-example influence becomes visceral rather than abstract.`,
      ],
    },
  ],
};
