// Domain-adversarial training: learn features that solve the source task
// while making source and target domains hard to tell apart.

import { graphState, scatterState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'domain-adversarial-networks',
  title: 'Domain-Adversarial Neural Networks',
  category: 'AI & ML',
  summary: 'Unsupervised domain adaptation with a gradient reversal layer: keep label signal, erase domain signal.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['gradient reversal', 'domain adaptation'], defaultValue: 'gradient reversal' },
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

function dannGraph(title) {
  return graphState({
    nodes: [
      { id: 'source', label: 'source data', x: 0.7, y: 2.0, note: 'labeled' },
      { id: 'target', label: 'target data', x: 0.7, y: 5.8, note: 'unlabeled' },
      { id: 'features', label: 'feature extractor', x: 3.0, y: 3.9, note: 'shared weights' },
      { id: 'label', label: 'label head', x: 5.6, y: 2.2, note: 'predict class' },
      { id: 'grl', label: 'gradient reversal', x: 5.4, y: 5.2, note: 'flip sign' },
      { id: 'domain', label: 'domain head', x: 7.8, y: 5.2, note: 'source vs target' },
    ],
    edges: [
      { id: 'e-source-feat', from: 'source', to: 'features', weight: 'examples' },
      { id: 'e-target-feat', from: 'target', to: 'features', weight: 'examples' },
      { id: 'e-feat-label', from: 'features', to: 'label', weight: 'class features' },
      { id: 'e-feat-grl', from: 'features', to: 'grl', weight: 'features' },
      { id: 'e-grl-domain', from: 'grl', to: 'domain', weight: 'reversed gradient' },
    ],
  }, { title });
}

function beforeScatter() {
  return scatterState({
    axes: { x: { label: 'feature 1', min: -1, max: 8 }, y: { label: 'feature 2', min: -1, max: 8 } },
    points: [
      { id: 's0', x: 1.0, y: 1.2, clusterId: 'source-cat' },
      { id: 's1', x: 1.6, y: 1.0, clusterId: 'source-cat' },
      { id: 's2', x: 2.0, y: 1.7, clusterId: 'source-dog' },
      { id: 's3', x: 2.5, y: 2.2, clusterId: 'source-dog' },
      { id: 't0', x: 5.2, y: 5.1, clusterId: 'target-cat' },
      { id: 't1', x: 5.8, y: 5.5, clusterId: 'target-cat' },
      { id: 't2', x: 6.4, y: 4.8, clusterId: 'target-dog' },
      { id: 't3', x: 7.0, y: 5.7, clusterId: 'target-dog' },
    ],
  }, { title: 'Before adaptation: the model separates domains first' });
}

function afterScatter() {
  return scatterState({
    axes: { x: { label: 'domain-invariant feature', min: -1, max: 8 }, y: { label: 'label feature', min: -1, max: 8 } },
    points: [
      { id: 's0', x: 2.0, y: 1.0, clusterId: 'cat' },
      { id: 't0', x: 2.3, y: 1.2, clusterId: 'cat' },
      { id: 's1', x: 2.6, y: 1.4, clusterId: 'cat' },
      { id: 't1', x: 2.8, y: 1.1, clusterId: 'cat' },
      { id: 's2', x: 5.4, y: 5.2, clusterId: 'dog' },
      { id: 't2', x: 5.6, y: 5.5, clusterId: 'dog' },
      { id: 's3', x: 6.1, y: 5.7, clusterId: 'dog' },
      { id: 't3', x: 6.3, y: 5.3, clusterId: 'dog' },
    ],
  }, { title: 'After adaptation: domains mix while classes stay separable' });
}

function* gradientReversal() {
  yield {
    state: dannGraph('Two objectives pull on the same feature extractor'),
    highlight: { active: ['source', 'features', 'label', 'e-source-feat', 'e-feat-label'], compare: ['target', 'domain'] },
    explanation: 'The graph shows two losses pulling on one feature extractor. The label head learns the labeled source task; the domain head tries to detect whether a feature came from source or target data.',
  };

  yield {
    state: dannGraph('The domain head learns to detect the shift'),
    highlight: { active: ['source', 'target', 'features', 'domain', 'e-source-feat', 'e-target-feat', 'e-feat-grl', 'e-grl-domain'], compare: ['label'] },
    explanation: 'A strong domain classifier is a warning. It means the features still expose dataset artifacts such as camera style, vocabulary, lighting, scanner type, geography, or collection pipeline.',
    invariant: 'Good adaptation needs task-discriminative features that are domain-indiscriminate.',
  };

  yield {
    state: dannGraph('Gradient reversal flips the domain loss on the way back'),
    highlight: { active: ['grl', 'e-feat-grl', 'e-grl-domain'], found: ['features'], compare: ['domain'] },
    explanation: 'Gradient reversal is identity on the forward pass and sign flip on the backward pass. The domain head learns to separate domains, while the feature extractor receives the opposite signal and learns to hide them.',
  };

  yield {
    state: labelMatrix(
      'The feature extractor receives two signals',
      [
        { id: 'label', label: 'label loss' },
        { id: 'domain', label: 'domain loss' },
        { id: 'feature', label: 'feature extractor' },
        { id: 'result', label: 'target behavior' },
      ],
      [
        { id: 'direction', label: 'gradient direction' },
        { id: 'goal', label: 'goal' },
      ],
      [
        ['normal', 'predict source labels'],
        ['reversed', 'confuse domain head'],
        ['combined', 'keep class, remove domain'],
        ['source-like accuracy', 'without target labels'],
      ],
    ),
    highlight: { found: ['feature:goal', 'result:goal'], active: ['domain:direction'] },
    explanation: 'The table shows the combined objective. Label loss keeps task signal; reversed domain loss removes source-only signal. The adversary is a training pressure, not an external attacker.',
  };
}

function* domainAdaptation() {
  yield {
    state: labelMatrix(
      'The unsupervised domain adaptation setting',
      [
        { id: 'source', label: 'source domain' },
        { id: 'target', label: 'target domain' },
        { id: 'labels', label: 'target labels' },
        { id: 'risk', label: 'main risk' },
      ],
      [
        { id: 'example', label: 'example' },
        { id: 'available', label: 'available?' },
      ],
      [
        ['product photos', 'labeled'],
        ['phone photos', 'unlabeled'],
        ['phone labels', 'not available'],
        ['shortcut features', 'very available'],
      ],
    ),
    highlight: { active: ['source:available', 'target:available'], removed: ['labels:available'], compare: ['risk:available'] },
    explanation: 'The setting matrix exposes the constraint. Source labels are available, target examples are visible, but target labels are missing, so the model can align distributions without directly measuring target accuracy during training.',
  };

  yield {
    state: beforeScatter(),
    highlight: { active: ['s0', 's1', 's2', 's3'], compare: ['t0', 't1', 't2', 't3'] },
    explanation: 'Before adaptation, the scatter is organized by domain first. That can look good on source validation while failing on the deployment distribution.',
  };

  yield {
    state: afterScatter(),
    highlight: { found: ['s0', 't0', 's1', 't1', 's2', 't2', 's3', 't3'] },
    explanation: 'After alignment, source and target examples mix inside each class. The label boundary can transfer only because the representation kept class structure while reducing domain structure.',
    invariant: 'Alignment is useful only if it preserves task structure.',
  };

  yield {
    state: labelMatrix(
      'When DANN works and when it breaks',
      [
        { id: 'covariate', label: 'covariate shift' },
        { id: 'labelshift', label: 'label shift' },
        { id: 'conditional', label: 'conditional shift' },
        { id: 'negative', label: 'negative transfer' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['same task, shifted inputs', 'best fit'],
        ['class priors changed', 'needs correction'],
        ['label meaning changed', 'alignment can hurt'],
        ['domains forced together wrongly', 'target accuracy drops'],
      ],
    ),
    highlight: { found: ['covariate:risk'], removed: ['conditional:risk', 'negative:risk'], compare: ['labelshift:risk'] },
    explanation: 'The failure table names the tax. If labels, class priors, or conditional relationships changed, forced alignment can erase useful structure and lower target accuracy.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'gradient reversal') yield* gradientReversal();
  else if (view === 'domain adaptation') yield* domainAdaptation();
  else throw new InputError('Pick a DANN view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Domain-Adversarial Neural Networks solve a common deployment problem: the labels live in one distribution, but the model will be used in another. A classifier trained on product photos may be deployed on phone photos. A sentiment model trained on movie reviews may be used on support tickets. A medical model trained at one hospital may face a different scanner, protocol, or patient mix. The source task is known, but the target domain is only partly visible.',
        'The hard setting is unsupervised domain adaptation. Source examples have labels. Target examples exist, but target labels are unavailable or too expensive to collect at training time. The learner must use target inputs without using target answers. That constraint rules out ordinary supervised fine-tuning and makes evaluation fragile: source validation can look strong while target accuracy collapses.',
      ],
    },
    {
      heading: 'The naive baseline and the wall',
      paragraphs: [
        'The naive baseline is simple and reasonable: train a model on the labeled source data, choose the checkpoint with the best source validation score, and hope the learned features transfer. This can work when the source and target differ only in harmless ways, or when the source data is broad enough that the model learns the underlying task instead of the collection pipeline.',
        'The wall appears when the easiest source features are domain shortcuts. Background texture, camera angle, vocabulary, geography, scanner noise, compression artifacts, or website template can become predictive in the source set. Those features may vanish, reverse, or change scale in the target domain. The model did not learn the task badly; it learned a representation that solved the source task too specifically.',
        'A second naive move is to mix source and target inputs during training without target labels. That exposes the model to target examples, but it does not say which features should be shared. The network can still carry a domain bit through the representation and let the label head depend on source-only structure. Exposure alone is not alignment.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to train one representation against two judges. The label head asks whether the features still solve the source task. The domain head asks whether the same features reveal where an example came from. The feature extractor is rewarded for label usefulness and penalized for domain recognizability.',
        'This is adversarial pressure used as a training tool. The adversary is not trying to steal the model or fool it at inference time. It is a small classifier inside the training loop. If the domain classifier can easily separate source from target features, the representation still contains domain-specific information. If the label head remains accurate while the domain classifier becomes confused, the features are closer to what DANN wants: task-discriminative and domain-indiscriminate.',
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        'A DANN has three learned parts. The feature extractor maps source and target examples into a shared feature space. The label predictor reads source features and learns the supervised task from source labels. The domain classifier reads both source and target features and predicts a binary domain label such as source versus target.',
        'The gradient reversal layer sits between the feature extractor and the domain classifier. On the forward pass, it behaves like the identity function, so the domain classifier sees the same features it would normally see. On the backward pass, it multiplies the gradient by a negative coefficient. The domain classifier updates normally to improve domain prediction. The feature extractor receives the opposite gradient, so it updates toward features that make domain prediction harder.',
        'Training alternates inside ordinary backpropagation rather than through a separate game loop. The total objective combines source label loss with reversed domain loss, usually controlled by a schedule that increases adversarial pressure after the label signal has started to form. Too little pressure leaves domain shortcuts. Too much pressure too early can erase useful class information before the label head has a stable boundary.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The graph view shows the causal structure. Source data flows through the feature extractor to the label head, so the representation cannot ignore the task. Source and target data also flow through the feature extractor to the domain head, so the representation is tested for domain leakage. The gradient reversal edge is the only strange part: it says that the domain head and feature extractor want opposite things.',
        'The scatter view shows the desired geometry. Before adaptation, points separate mostly by domain. A boundary learned on the source cloud may not transfer because the target cloud sits elsewhere. After adaptation, source and target examples mix inside each class cluster. The visual does not prove target accuracy by itself; it proves the intended invariant: domain should stop being the first separator while class structure remains visible.',
        'The failure table matters as much as the success view. Domain confusion is useful only when there is a shared labeling rule underneath the shift. If the target domain changes class priors, adds missing classes, or changes what labels mean, forcing the distributions together can hide the very structure the task needs.',
      ],
    },
    {
      heading: 'Why it can work',
      paragraphs: [
        'The correctness argument is a representation argument, not a guarantee that every dataset will adapt. If source and target share a labeling function, and if there exists a feature space where examples with the same label align across domains, then a good feature extractor should keep label evidence and discard domain evidence. The label loss preserves the first property. The reversed domain loss pressures the second.',
        'The domain classifier gives the feature extractor a moving test. A weak domain classifier cannot expose much leakage, so the feature extractor receives little useful pressure. A strong domain classifier finds domain cues, and the reversed gradient points the extractor away from them. At equilibrium, the domain classifier should be close to guessing from the shared features, while the label head still predicts source labels well.',
        'This argument depends on the right kind of shift. Covariate shift is the friendly case: input style changes, but the task relation is stable. Conditional shift is harder: the relationship between input and label changes. Label shift changes class priors. In those cases, matching feature distributions can make the model more confident and less correct.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The training cost is modest compared with a whole new model, but it is not free. DANN adds a domain head, a second loss, a reversal coefficient, more hyperparameters, and extra batches containing target examples. Each update must balance task performance against domain confusion. When input size doubles, the feature extractor and label head cost scale like ordinary neural training, while the domain branch adds another classifier pass over source and target features.',
        'The evaluation cost is often larger than the compute cost. The target labels are missing by definition, so the team can easily tune against source accuracy and domain confusion while fooling itself about the real deployment metric. A serious workflow needs small target-label audits, proxy tests with known limits, monitoring after deployment, and strict data-leakage discipline so target evaluation examples do not become training hints.',
        'The main tax is negative transfer. If domain and class are entangled, removing domain information can remove class information. A medical scanner might correlate with a disease prevalence because of referral patterns. A writing domain might correlate with sentiment because the product category changed. DANN can erase those signals without knowing whether they are spurious or necessary.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'DANN-style adaptation fits image classification across camera styles, OCR across rendering conditions, speech across microphones, sentiment across domains, sensor models across devices, robotics policies across simulators and hardware, and medical imaging across acquisition pipelines. The common pattern is labeled source data, unlabeled target data, and a belief that the same task survives the shift.',
        'It is the wrong tool when the product can afford direct target labels and the deployment risk is high enough that indirect alignment is not acceptable. It is also weak when target classes are missing from source, when new target-only classes appear, when labels mean different things, or when the deployment distribution will keep drifting after the alignment set is collected.',
        'Do not read domain-invariant as task-correct. A representation can hide domain identity and still put target examples on the wrong side of the label boundary. Do not read unlabeled target data as validation. It can shape the representation, but it cannot certify target task accuracy without labels or a trusted downstream signal.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Domain-Adversarial Training of Neural Networks in JMLR at https://jmlr.org/papers/v17/15-239.html and the arXiv version at https://arxiv.org/abs/1505.07818. Study Backpropagation first, because gradient reversal is only a special backward-pass rule. Study Embeddings & Similarity to understand the feature-space geometry. Study Cross-Validation & Honest Evaluation and Data Leakage before using target-domain probes. Then compare DANN with fine-tuning, self-training, domain-specific batch normalization, invariant risk minimization, and adversarial examples so the word adversarial does not collapse several different ideas into one bucket.',
      ],
    },
  ],
};
