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
    explanation: 'A domain-adversarial neural network has one shared feature extractor and two heads. The label head learns the source task from labeled source data. The domain head tries to tell whether features came from source or target data.',
  };

  yield {
    state: dannGraph('The domain head learns to detect the shift'),
    highlight: { active: ['source', 'target', 'features', 'domain', 'e-source-feat', 'e-target-feat', 'e-feat-grl', 'e-grl-domain'], compare: ['label'] },
    explanation: 'If the domain classifier easily separates source from target, the features still encode dataset-specific artifacts: camera style, vocabulary, lighting, scanner type, geography, or collection pipeline.',
    invariant: 'Good adaptation needs task-discriminative features that are domain-indiscriminate.',
  };

  yield {
    state: dannGraph('Gradient reversal flips the domain loss on the way back'),
    highlight: { active: ['grl', 'e-feat-grl', 'e-grl-domain'], found: ['features'], compare: ['domain'] },
    explanation: 'The gradient reversal layer is the elegant trick. Forward pass: it is the identity. Backward pass: it multiplies the domain gradient by a negative constant. The domain head improves, while the feature extractor is trained to fool it.',
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
    explanation: 'This is adversarial training used constructively. The adversary is not attacking the classifier; it is forcing the representation to drop domain information that would fail at test time.',
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
    explanation: 'In unsupervised domain adaptation, labels exist in the source domain but not in the target domain. The target examples are visible, so the model can learn the target distribution, but it cannot directly train on target labels.',
  };

  yield {
    state: beforeScatter(),
    highlight: { active: ['s0', 's1', 's2', 's3'], compare: ['t0', 't1', 't2', 't3'] },
    explanation: 'A normal network may learn features that classify source data but separate domains even more strongly. That looks good on source validation and fails on the deployment distribution.',
  };

  yield {
    state: afterScatter(),
    highlight: { found: ['s0', 't0', 's1', 't1', 's2', 't2', 's3', 't3'] },
    explanation: 'After adversarial alignment, source and target examples with the same class sit near each other. The label boundary can transfer because it no longer depends on the source-only artifact.',
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
    explanation: 'Domain alignment is not magic. If target labels mean something different, forcing domains together can destroy useful structure. Evaluation needs target proxies, small labeled audits, or downstream monitoring.',
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
      heading: 'What it is',
      paragraphs: [
        'Domain-Adversarial Neural Networks are a practical recipe for unsupervised domain adaptation. The model learns from labeled source data and unlabeled target data. It trains features that predict the source label while making the source and target domains hard to distinguish.',
        'The local corpus includes a domain-adversarial neural network writeup because this idea is a useful bridge between representation learning and robustness. It is not an attack like FGSM. It is adversarial pressure used to remove shortcut domain information from the representation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A DANN has a shared feature extractor, a label predictor, and a domain classifier. The label predictor is trained normally on source labels. The domain classifier receives both source and target features and tries to predict the domain. Between the feature extractor and domain classifier sits a gradient reversal layer.',
        'The gradient reversal layer is identity in the forward pass. During backpropagation, it multiplies the gradient by a negative coefficient. As a result, the domain classifier gets better at detecting source versus target, while the feature extractor gets better at hiding domain information. The two losses create features that keep label signal and discard domain signal.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The method adds another head, another loss, a schedule for the reversal coefficient, and more evaluation complexity. It assumes there is a representation where source and target can align without destroying the task. That assumption is false when label semantics shift or when target classes are missing from the source domain.',
        'The largest operational risk is negative transfer: the adaptation objective improves domain confusion while target task accuracy worsens. A serious deployment needs target-domain probes, small labeled audits, monitoring, and Data Leakage discipline so target evaluation does not leak into model selection.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'DANN-style adaptation appears in computer vision, sentiment analysis, medical imaging, speech, fraud, sensor data, robotics, and any place where training and deployment distributions differ. It connects naturally to Convolution, Embeddings & Similarity, Adversarial Examples & FGSM, Saliency Maps & Feature Attribution, and Cross-Validation & Honest Evaluation.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Domain-invariant does not mean task-correct. Removing domain information can remove useful class information if domain and label are entangled. Another misconception is that unlabeled target data is enough for validation. It can help train alignment, but it cannot prove target task accuracy without labels or credible proxy tests.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Domain-Adversarial Training of Neural Networks in JMLR at https://jmlr.org/papers/v17/15-239.html and the arXiv version at https://arxiv.org/abs/1505.07818. Study Backpropagation, Convolution, Embeddings & Similarity, Adversarial Examples & FGSM, Data Leakage, and Cross-Validation & Honest Evaluation next.',
      ],
    },
  ],
};
