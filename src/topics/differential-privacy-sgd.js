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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/differential-privacy-sgd.gif', alt: 'Animated walkthrough of the differential privacy sgd visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why it exists',
      paragraphs: [
        `Ordinary stochastic gradient descent was designed to find useful patterns, not to limit what a trained model reveals about the people who supplied the data. If one patient record, chat message, location trace, or user action can noticeably change the model, then an attacker may be able to test whether that record was present. Membership inference, training-data extraction, and memorization are all symptoms of the same basic problem: training turns private examples into public parameters.`,
        {type: `callout`, text: `DP-SGD makes training auditable by clipping each example before aggregation, adding calibrated noise, and charging every step to a privacy ledger.`},
        `A naive privacy plan is to hide the raw data and release only the model. That helps against direct database access, but it does not answer the machine-learning question. The model is a compressed consequence of the data. If a rare example creates a large gradient, and that gradient repeatedly steers training, the final parameters can still carry a detectable trace. Federated learning keeps data on devices, and secure aggregation hides individual updates from the server, but neither automatically limits how much one participant can affect the final model. Differential Privacy SGD, or DP-SGD, adds that missing influence bound.`,
        `The goal is not secrecy by obscurity. Differential privacy is a formal promise about neighboring datasets: train on dataset D, train on dataset D prime that differs in one person, and the distributions over released models should be close. An observer should not become much more confident that the person was included after seeing the output. DP-SGD is the training algorithm that makes this kind of promise plausible for gradient-based models.`,
      ],
    },
    {
      heading: 'The naive wall',
      paragraphs: [
        `The simplest way to train privately seems to be: compute the average minibatch gradient, add noise, and continue. That fails because the average may already be dominated by one example. Suppose three examples have gradient norm near 1 and one rare example has norm 80. If you average first, the rare example has already moved the batch direction. Adding noise afterward hides the average imperfectly, but it does not repair the unbounded sensitivity of the computation.`,
        {type: `image`, src: `https://www.nist.gov/sites/default/files/images/2021/12/17/DP-machine-learning-1.png`, alt: `NIST diagram of differential privacy in a machine learning workflow`, caption: `DP in machine learning is a training-release contract, not just access control around the raw dataset. Source: https://www.nist.gov/sites/default/files/images/2021/12/17/DP-machine-learning-1.png`},
        `Sensitivity is the maximum amount the output can change when one record changes. Differential privacy needs bounded sensitivity before noise can be calibrated. If a single example can create an arbitrarily large update, no fixed amount of useful noise can hide its presence. You either add so much noise that learning collapses, or you release a model whose privacy claim depends on hope rather than mathematics.`,
        `This is why DP-SGD computes per-example gradients. In ordinary deep learning frameworks, a batch gradient is often produced directly because that is efficient. DP-SGD needs the gradient for each example separately so each contribution can be clipped before averaging. This is a real systems cost, but it is the step that turns privacy from a slogan into an auditable mechanism.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The visual model starts with individual rows because DP-SGD is about bounding individual influence before aggregation. The outlier gradient is the important case. It is not ignored, but it is projected back to the clipping radius so one record cannot dominate the batch update.`,
        `The second view teaches the privacy ledger. Lower epsilon is stronger privacy, but it normally costs accuracy because the optimizer receives a noisier signal. The composition table is the release warning: privacy loss accumulates across rounds, hyperparameter trials, checkpoints, and repeated releases. A private training run is not only an optimizer loop; it is an accounting process.`,
      ],
    },
    {
      heading: 'Core insight and mechanism',
      paragraphs: [
        `The core insight is that useful learning can continue after each record's influence has been bounded and hidden inside calibrated randomness. The invariant is local: before gradients are averaged, every example contributes at most the clip norm C. Once that sensitivity bound exists, the Gaussian mechanism and privacy accountant can reason about how much one person might have changed the released model.`,
        {type: `image`, src: `https://docs.opendp.org/en/stable/_images/theory_a-framework-to-understand-dp_11_0.png`, alt: `OpenDP plot comparing probability regions under adjacent datasets`, caption: `Differential privacy reasons about neighboring output distributions, so clipping and noise must make those distributions hard to distinguish. Source: https://docs.opendp.org/en/stable/_images/theory_a-framework-to-understand-dp_11_0.png`},
        `A DP-SGD step has five parts. First, sample a minibatch, usually with randomness that the privacy accountant understands. Second, compute one gradient per example. Third, clip each gradient to a norm bound C. If a gradient already has norm below C, keep it. If it is larger, scale it down so its norm is exactly C. Fourth, average the clipped gradients and add Gaussian noise whose scale is tied to C and the noise multiplier. Fifth, apply the optimizer update and record the privacy cost.`,
        `Clipping creates the bound. Noise creates uncertainty. Accounting tracks how uncertainty degrades over repeated training. The order matters. Clip before average; otherwise one record can influence the average too much. Add noise after averaging; otherwise the optimizer receives one noisy contribution per example rather than a controlled noisy estimate of the batch update. Account every step; otherwise many small releases can add up to a large privacy leak.`,
        `The animation's clipping view follows this logic. The outlier gradient is not discarded. It still contributes in the same direction, but only up to the allowed norm. That is an important distinction: DP-SGD is not outlier removal. It is bounded participation. The noisy-update table then shows why the optimizer still learns. The clipped average carries signal from the batch, while the Gaussian noise makes nearby datasets harder to distinguish.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Differential privacy is a statement about distributions, not about identical models. Training is randomized through minibatch sampling and added noise. If Alice is in the dataset, there is a distribution over possible final models. If Alice is removed, there is another distribution. DP asks that these two distributions remain close enough that seeing one sampled model does not reveal much about which dataset was used.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg`, alt: `Layered neural network diagram with colored nodes and connections`, caption: `The released neural network is a compressed consequence of training data, so privacy must bound individual influence before parameters are published. Source: https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg`},
        `Epsilon measures the maximum privacy loss in the comparison. Smaller epsilon means the two output distributions are closer and the privacy promise is stronger. Delta allows a small probability of exceptional failure in approximate differential privacy. Neither number is meaningful without the training details that produced it: sampling rate, noise multiplier, clipping norm, number of steps, and the accountant method.`,
        `Subsampling helps because any one record is not used in every step. Clipping helps because, when a record is used, its effect is bounded. Noise helps because a bounded change can be hidden by a calibrated random perturbation. Composition is the hard part: every step reveals a little information, and privacy loss accumulates. A model may keep improving after the privacy budget says the release should stop. In a serious deployment, the accountant is a release gate, not a chart for decoration.`,
      ],
    },
    {
      heading: 'Costs and tuning tradeoffs',
      paragraphs: [
        `The clip norm C controls how much any one example can say before noise is added. Too small a C crushes useful gradients and biases training. Too large a C weakens the sensitivity bound and requires more noise. Practitioners often inspect gradient norm distributions, tune C on public or held-out data, and watch whether minority or rare examples are being clipped more aggressively than common examples.`,
        `The noise multiplier controls privacy strength. More noise usually lowers epsilon, but it also lowers the signal-to-noise ratio of the update. Larger batches can help average signal before noise is added, but they change optimization and sampling behavior. More training steps can improve accuracy, but they spend more privacy budget. There is no free privacy setting. The real tuning problem is a frontier: privacy budget on one axis, model utility on the other.`,
        `Evaluation should report both. A DP model with a vague "privacy-preserving" label is not enough. Report epsilon, delta, accountant assumptions, clipping norm, noise multiplier, sampling rate, training steps, task metrics, and slice metrics. Then test the model for memorization and membership leakage anyway. Differential privacy is a formal upper bound under stated assumptions; empirical attacks are still useful because implementations, preprocessing, repeated releases, and data pipelines often violate tidy assumptions.`,
      ],
    },
    {
      heading: 'Where it wins and where it is used',
      paragraphs: [
        `DP-SGD is most natural when examples are sensitive and the trained model will be shared, queried, or reused. Medical prediction, mobile keyboard models, telemetry, user-behavior modeling, location data, private text, and personalization all create this shape. The method is also important for large-model safety research because it gives a concrete way to discuss memorization rather than merely hoping a model will not repeat private records.`,
        `It often appears with other privacy layers. Federated learning moves training to devices. Secure aggregation hides individual device updates from the coordinator. Access control limits who can trigger training and read artifacts. Data retention policies limit how long raw examples exist. DP-SGD limits the influence of any one example on the released model. These layers answer different threats, so replacing one with another usually leaves a gap.`,
        `The mechanism can operate at different units of privacy. Example-level DP bounds one row. User-level DP bounds all records from one user, which is usually what people expect but is harder because one user may contribute many examples. Event-level privacy may be acceptable for telemetry but weak for sensitive personal histories. Always name the protected unit. Without that, the epsilon number is easy to overstate.`,
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        `Build the pipeline so privacy accounting is automatic, not a spreadsheet after training. The code that samples batches, clips gradients, adds noise, counts steps, and releases checkpoints should feed the same accountant. If engineers can run extra experiments or publish intermediate models outside the ledger, the formal guarantee no longer describes the real release process.`,
        `Treat per-example gradients as a performance requirement. They often increase memory use and reduce throughput compared with ordinary SGD. Use libraries that implement vectorized per-example gradients, ghost clipping, or microbatching carefully, and verify that clipping is mathematically equivalent to clipping each example before the batch average.`,
        `Document the protected unit and the threat model. Example-level privacy, user-level privacy, cross-device federated training, and central DP on a server are different commitments. A release note should say what unit is protected, which data was private, which data was public, what accountant was used, and what outputs count as releases.`,
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        `DP-SGD can fail by being too weak or too expensive. Weak settings produce impressive accuracy and a large epsilon that offers little practical comfort. Strong settings may make the model unusable, especially on small datasets, rare classes, long-tail language, or groups whose gradients are already noisy. Privacy can also redistribute error: the global metric may look acceptable while small slices lose recall because their signal is clipped or drowned by noise.`,
        `It does not solve fairness, poisoning, truthfulness, or access control. A private model can be biased. A private model can learn a poisoned correlation. A private model can still be deployed in an unsafe product. DP-SGD narrows one channel of leakage: the influence of an individual training unit on the released model. Treat it as a precise tool, not a general certificate of responsible AI.`,
        `It also complicates experimentation. Hyperparameter search can spend privacy budget if it repeatedly uses private data. Releasing multiple checkpoints, leaderboards, or model variants can compose privacy loss. Choosing the best run after looking at private validation results can leak information unless that selection is accounted for. The clean training-loop diagram is only the beginning; the whole release process needs a privacy ledger.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Gradient Descent first so the update rule is familiar, then Batch Size Scaling to understand signal averaging, Federated Learning and Secure Aggregation to separate privacy layers, and Membership Inference Shadow Model Case Study to see the attack DP-SGD is designed to constrain. The original paper "Deep Learning with Differential Privacy" introduced the modern recipe. "The Algorithmic Foundations of Differential Privacy" gives the theory. Practical work should add implementation audits, slice evaluation, and memorization tests before claiming a model is safe to release.`,
      ],
    },
  ],
};
