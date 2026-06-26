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
  const graph = dannGraph('Two objectives pull on the same feature extractor');
  const nodeCount = graph.data.nodes.length;
  const edgeCount = graph.data.edges.length;
  const nodeLabels = graph.data.nodes.map(n => n.label);
  const grlNode = graph.data.nodes.find(n => n.id === 'grl');
  const featureNode = graph.data.nodes.find(n => n.id === 'features');
  const signalRows = ['label loss', 'domain loss', 'feature extractor', 'target behavior'];
  const signalCount = signalRows.length;

  yield {
    state: graph,
    highlight: { active: ['source', 'features', 'label', 'e-source-feat', 'e-feat-label'], compare: ['target', 'domain'] },
    explanation: `The graph shows ${nodeCount} components connected by ${edgeCount} edges, with two losses pulling on one ${featureNode.label}. The label head learns the labeled source task; the domain head tries to detect whether a feature came from source or target data.`,
  };

  yield {
    state: dannGraph('The domain head learns to detect the shift'),
    highlight: { active: ['source', 'target', 'features', 'domain', 'e-source-feat', 'e-target-feat', 'e-feat-grl', 'e-grl-domain'], compare: ['label'] },
    explanation: `A strong domain classifier is a warning across all ${nodeCount} nodes. It means the features still expose dataset artifacts such as camera style, vocabulary, lighting, scanner type, geography, or collection pipeline.`,
    invariant: `Good adaptation needs task-discriminative features that are domain-indiscriminate — the ${featureNode.label} (${featureNode.note}) must serve both objectives.`,
  };

  yield {
    state: dannGraph('Gradient reversal flips the domain loss on the way back'),
    highlight: { active: ['grl', 'e-feat-grl', 'e-grl-domain'], found: ['features'], compare: ['domain'] },
    explanation: `The "${grlNode.label}" layer (${grlNode.note}) is identity on the forward pass and sign flip on the backward pass. The domain head learns to separate domains, while the ${featureNode.label} receives the opposite signal and learns to hide them.`,
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
    explanation: `The table shows ${signalCount} rows mapping the combined objective. Label loss keeps task signal; reversed domain loss removes source-only signal. The adversary is a training pressure across the ${nodeLabels.join(', ')} pipeline, not an external attacker.`,
  };
}

function* domainAdaptation() {
  const before = beforeScatter();
  const after = afterScatter();
  const sourcePoints = before.data.points.filter(p => p.id.startsWith('s'));
  const targetPoints = before.data.points.filter(p => p.id.startsWith('t'));
  const totalPoints = before.data.points.length;
  const beforeClusters = [...new Set(before.data.points.map(p => p.clusterId))];
  const afterClusters = [...new Set(after.data.points.map(p => p.clusterId))];
  const settingRows = ['source domain', 'target domain', 'target labels', 'main risk'];
  const failureModes = ['covariate shift', 'label shift', 'conditional shift', 'negative transfer'];

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
    explanation: `The setting matrix exposes the constraint across ${settingRows.length} rows. Source labels are available, target examples are visible, but target labels are missing, so the model can align distributions without directly measuring target accuracy during training.`,
  };

  yield {
    state: before,
    highlight: { active: ['s0', 's1', 's2', 's3'], compare: ['t0', 't1', 't2', 't3'] },
    explanation: `Before adaptation, the ${totalPoints} points (${sourcePoints.length} source, ${targetPoints.length} target) scatter into ${beforeClusters.length} domain-separated clusters (${beforeClusters.join(', ')}). That can look good on source validation while failing on the deployment distribution.`,
  };

  yield {
    state: after,
    highlight: { found: ['s0', 't0', 's1', 't1', 's2', 't2', 's3', 't3'] },
    explanation: `After alignment, source and target examples mix into ${afterClusters.length} class-based clusters (${afterClusters.join(', ')}). The label boundary can transfer only because the representation kept class structure while reducing domain structure.`,
    invariant: `Alignment is useful only if it preserves task structure — the ${afterClusters.length} post-adaptation clusters must reflect class identity, not domain identity.`,
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
    explanation: `The failure table names ${failureModes.length} shift types: ${failureModes.join(', ')}. If labels, class priors, or conditional relationships changed, forced alignment can erase useful structure and lower target accuracy.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Switch between two views using the dropdown. The gradient reversal view draws the DANN architecture as a directed graph: source and target data flow through a shared feature extractor, then split into a label head and a domain head connected through the gradient reversal layer. Active highlights trace whichever signal path the current step describes. The matrix step shows the two gradient directions side by side -- label loss flows normally, domain loss flows reversed.',
        'The domain adaptation view opens with a setting matrix that lays out what is labeled and what is not, then shows two scatter plots. The first scatters points by domain (source cluster far from target cluster). The second shows the same points after adaptation, now grouped by class instead of domain. Found highlights mark successfully aligned points. The final matrix lists four types of distribution shift and rates DANN\'s fitness for each.',
        {type: 'image', src: './assets/gifs/domain-adversarial-networks.gif', alt: 'Animated walkthrough of the domain adversarial networks visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Machine learning models break when the data they deploy on looks different from the data they trained on. A classifier trained on product photos with white backgrounds gets shipped to users who take phone photos with cluttered backgrounds. A sentiment model trained on movie reviews gets pointed at customer support tickets. The features that made training easy -- background color, review vocabulary -- become traps in the new setting.',
        'The fix seems obvious: collect labeled data from the target domain and retrain. But target labels are often expensive, slow, or impossible to get. A hospital might have thousands of unlabeled scans from a new machine but no radiologist time to annotate them. The labeled source data and the unlabeled target data both exist, but no supervised bridge connects them.',
        {type: 'callout', text: 'DANN works by keeping label evidence while making domain evidence hard to recover from the learned representation.'},
        'This is unsupervised domain adaptation: learn from labeled source examples and unlabeled target examples simultaneously, producing a model that works on the target distribution without ever seeing target labels during training.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Train on labeled source data, validate on a held-out source split, and deploy the best checkpoint. This baseline works when the shift between source and target is small or when the source dataset is diverse enough that the model latches onto the real task rather than collection artifacts. Many production systems run exactly this way and perform acceptably.',
        'A modest improvement feeds unlabeled target examples into the training loop alongside source data, hoping the network will learn features that describe both distributions. But the network has no incentive to do so. It can route source examples through one feature pathway and ignore target examples entirely, because only source labels generate loss.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The problem is not that the model learned poorly -- it learned the source task too well. Features like white backgrounds, specific font renderings, studio lighting, or formal vocabulary are genuinely predictive in the source domain. They correlate with the labels because of how the source data was collected, not because of the task itself. In the target domain those correlations vanish or reverse.',
        'Simply exposing the model to target examples does not break these shortcuts. The representation can carry a silent domain bit -- a feature dimension that encodes "this came from source" -- and the label head can lean on it. The network sees target data but has no reason to align with it. Exposure is not the same as alignment pressure.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Pit the feature extractor against two competing judges. The first judge is a label head that classifies source examples using the extracted features -- standard supervised learning. The second judge is a domain head that tries to tell whether each feature vector came from source or target data. Between the feature extractor and the domain head sits a gradient reversal layer (GRL): on the forward pass it acts as identity, but on the backward pass it multiplies the gradient by negative lambda.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored input, hidden, and output nodes', caption: 'DANN inserts a domain head beside the task head, so the shared hidden representation must satisfy two objectives. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
        'The domain head trains normally to get better at detecting domain origin. But the feature extractor receives the flipped gradient, so it is pushed to produce features that make domain detection harder. The label head simultaneously pulls the features toward task-useful structure. The extractor is trapped between two pressures: keep what helps classification, discard what reveals domain identity.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Three components train jointly. The feature extractor (often a CNN or transformer trunk) maps raw inputs from both domains into a shared feature vector. The label predictor is a small classifier head that reads source-domain features and outputs class probabilities -- it trains with standard cross-entropy on labeled source data. The domain classifier is another small head that reads features from both domains and outputs a binary prediction: source or target.',
        'The GRL connects the feature extractor to the domain classifier. During the forward pass, features flow through unchanged. During backpropagation, the GRL multiplies every gradient component by -lambda before passing it to the extractor. The domain classifier\'s weights update normally (they see the true gradient), so it keeps improving at domain detection. The extractor\'s weights get the negated signal, so wherever the domain classifier found a domain cue, the extractor learns to suppress it.',
        'Lambda follows a schedule. It starts near zero so the label head can form meaningful class features before domain pressure kicks in. Over training it ramps toward 1.0, gradually increasing the invariance pressure. Starting lambda too high erases class structure before the label head stabilizes. Leaving it too low lets domain shortcuts survive into the final model.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The argument rests on a geometric condition: if source and target share a labeling function and a feature space exists where same-class examples from both domains overlap, then the label loss preserves that class structure while the reversed domain loss collapses the domain gap. At convergence the domain classifier approaches 50% accuracy (chance for binary classification), meaning the features no longer encode domain identity. The label head, still trained on source labels, generalizes to target because the features it reads are now domain-agnostic.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg', alt: 'Several normal distribution curves with different means and variances', caption: 'Distribution shift is the geometric target: adaptation tries to remove domain separation while preserving task structure. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Normal_Distribution_PDF.svg.'},
        'The adversarial dynamic is self-correcting. A weak domain classifier cannot find subtle domain cues, so the extractor gets little pressure and retains shortcuts. A strong domain classifier exposes those cues, producing a large reversed gradient that pushes the extractor away from them. As the extractor improves, the classifier must find increasingly subtle signals or settle near chance. This feedback loop drives the representation toward the invariance boundary.',
        'The entire argument assumes covariate shift: the input distribution changes across domains but the relationship between inputs and labels stays the same. When class proportions shift, or when the same input means different things in different domains, forcing feature distributions together can actively hurt. The model becomes more confident on target data while being less correct.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Compute overhead is modest. The domain head is a small classifier (often one or two linear layers), and the GRL is a zero-parameter operation. Each training step processes a batch of source examples through both heads and a batch of target examples through the domain head only. Total per-step cost runs about 1.3 to 1.5 times a standard supervised model of the same backbone.',
        'The real cost is evaluation discipline. Target labels are missing by design, so the only training-time signals are source accuracy and domain confusion. Both can look excellent while target task accuracy is poor. Reliable development requires a small held-out set of target labels used solely for evaluation, never for training or model selection. Without that, lambda tuning becomes guesswork.',
        'Lambda scheduling adds a hyperparameter dimension that interacts with learning rate, batch size, and backbone depth. Grid search over lambda schedules using source validation is unreliable because the schedule that maximizes source accuracy often differs from the one that maximizes target accuracy. The practical overhead is experimental rigor, not GPU hours.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Visual recognition across camera conditions. Product photos to user-uploaded images, satellite imagery across seasons, histopathology slides across staining protocols or scanner manufacturers. The task-relevant features (shape, spatial structure, texture patterns) survive the shift; the domain artifacts (color calibration, background clutter, contrast curves) are exactly what DANN suppresses.',
        'Document OCR across rendering pipelines. Models trained on clean synthetic text transfer to degraded scans with different fonts, resolutions, and noise profiles. DANN aligns the feature spaces so character-shape features dominate over rendering-specific artifacts.',
        'Sentiment analysis across product categories. A model trained on electronics reviews adapts to restaurant reviews. Valence words and negation patterns carry across domains; category-specific jargon is the artifact to suppress. The same approach extends to cross-lingual transfer when paired with multilingual encoders.',
        'Sim-to-real robotics. A control policy trained in simulation faces real-world physics, textures, and sensor noise. DANN-style adaptation aligns simulated and real observation embeddings so the policy transfers without collecting labeled trajectories on the physical robot.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Negative transfer is the primary risk. When domain identity and class identity are entangled, suppressing domain signal destroys class signal. A medical scanner that correlates with disease prevalence (because referral patterns differ by hospital) carries information DANN cannot distinguish from a shortcut. Removing it lowers target accuracy below the unadapted baseline.',
        'DANN assumes identical label sets across domains. If the target contains classes absent from the source, or if some source classes never appear in the target, forced alignment merges unrelated categories. Partial domain adaptation and open-set recognition are separate techniques designed for this mismatch.',
        'Continuous distribution drift defeats DANN because the alignment is fixed at training time. If the target distribution keeps evolving after deployment -- new scanner firmware, seasonal content changes, shifting user demographics -- the adapted model degrades like any static model. DANN solves one-time adaptation, not ongoing tracking.',
        'Domain invariance does not guarantee task correctness. A representation can hide domain identity perfectly yet still place target examples on the wrong side of the decision boundary. Without target labels, there is no direct measurement of target task accuracy during training, only the proxy hope that alignment implies transferability.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Setup: 10,000 product photos of cats and dogs with labels (source), 5,000 phone photos of cats and dogs without labels (target). A ResNet-18 trained only on source achieves 95% source validation accuracy but 72% on a held-out target test set. Investigation reveals the model relies on white-background detection -- product photos always have white backgrounds, phone photos do not.',
        'Architecture: ResNet-18 backbone outputs a 512-dimensional feature vector. A linear label head maps 512 dims to 2 classes (cat, dog). A linear domain head maps 512 dims to 2 classes (source, target). The GRL sits between the backbone output and the domain head input.',
        'Training: lambda ramps linearly from 0 to 1.0 over 50 epochs. At epoch 0, domain accuracy is 98% -- features clearly encode which dataset each image came from. By epoch 25, domain accuracy drops to 74% as the extractor starts suppressing background-color features. By epoch 50, domain accuracy settles at 55%, near binary chance. Source label accuracy dips from 95% to 93%, a small cost of losing the background shortcut.',
        'Result: target test accuracy rises from 72% to 86%, a 14-point gain from suppressing the white-background shortcut. The remaining 7-point gap versus source reflects genuine difficulty (phone-photo blur, partial occlusion, cluttered scenes) that domain confusion alone cannot resolve. Adding data augmentation or a stronger backbone would address those residual errors through a different mechanism.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational paper is Ganin et al., "Domain-Adversarial Training of Neural Networks," JMLR 2016 (https://jmlr.org/papers/v17/15-239.html). The gradient reversal layer, the lambda schedule, and the theoretical framework for domain-adversarial adaptation originate here. The earlier workshop version appeared at ICML 2015 (arXiv: https://arxiv.org/abs/1505.07818).',
        'Study backpropagation first -- gradient reversal is a backward-pass modification, so understanding the chain rule is a prerequisite. Study embeddings and similarity to build intuition for the feature-space geometry DANN operates in. Review cross-validation and data leakage before designing target-domain evaluation protocols, since target label contamination is the most common experimental mistake in domain adaptation.',
        'After DANN, compare with fine-tuning (when some target labels exist), self-training with pseudo-labels on target data, domain-specific batch normalization (AdaBN), and invariant risk minimization (IRM). Note that "adversarial" in DANN refers to the domain classifier competing with the feature extractor, not to adversarial examples -- those are a separate concept involving input perturbations.',
      ],
    },
  ],
};
