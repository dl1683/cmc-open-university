// TrivialAugment: choose one random augmentation and one random magnitude,
// showing how a simple baseline can beat expensive policy search.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'trivialaugment-tuning-free-data-augmentation',
  title: 'TrivialAugment: Tuning-Free Data Augmentation',
  category: 'Papers',
  summary: 'A minimal augmentation baseline: pick one transform, pick one magnitude bin, apply it, and benchmark the cheap baseline first.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['one random op', 'baseline discipline'], defaultValue: 'one random op' },
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

function trivialGraph(title) {
  return graphState({
    nodes: [
      { id: 'image', label: 'image', x: 0.8, y: 3.5, note: 'sample' },
      { id: 'op', label: 'op', x: 2.8, y: 2.0, note: 'random' },
      { id: 'mag', label: 'magnitude', x: 2.8, y: 5.0, note: 'random bin' },
      { id: 'apply', label: 'apply', x: 5.0, y: 3.5, note: 'one edit' },
      { id: 'view', label: 'view', x: 7.1, y: 3.5, note: 'same label' },
      { id: 'train', label: 'train', x: 8.9, y: 3.5, note: 'regularize' },
    ],
    edges: [
      { id: 'e-image-op', from: 'image', to: 'op' },
      { id: 'e-image-mag', from: 'image', to: 'mag' },
      { id: 'e-op-apply', from: 'op', to: 'apply' },
      { id: 'e-mag-apply', from: 'mag', to: 'apply' },
      { id: 'e-apply-view', from: 'apply', to: 'view' },
      { id: 'e-view-train', from: 'view', to: 'train' },
    ],
  }, { title });
}

function* oneRandomOp() {
  const nodeCount = 6;
  const edgeCount = 6;
  const opsPerImage = 1;
  const sampledOp = 'solarize';
  const sampledBin = 17;
  const ladderMethods = ['AutoAug', 'RandAug', 'Trivial'];

  yield {
    state: trivialGraph('TrivialAugment samples exactly one operation'),
    highlight: { active: ['image', 'op', 'mag', 'apply', 'e-image-op', 'e-image-mag', 'e-op-apply', 'e-mag-apply'], found: ['view', 'train'] },
    explanation: `TrivialAugment removes policy search and even removes the N knob from RandAugment. For each image, choose ${opsPerImage} augmentation operation and ${opsPerImage} magnitude bin at random, then train on the transformed view across a ${nodeCount}-node pipeline.`,
  };

  yield {
    state: labelMatrix(
      'One sample draw',
      [
        { id: 'op', label: 'operation' },
        { id: 'mag', label: 'magnitude' },
        { id: 'label', label: 'label' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['solarize', 'uniform op'],
        ['bin 17', 'uniform bin'],
        ['unchanged', 'must preserve class'],
      ],
    ),
    highlight: { active: ['op:value', 'mag:value'], found: ['label:rule'] },
    explanation: `The algorithm is intentionally almost embarrassing: it drew "${sampledOp}" at bin ${sampledBin}. The work shifts from searching a complex policy to checking whether the augmentation space itself contains label-preserving operations.`,
    invariant: `The augmentation space is the policy — ${opsPerImage} op and ${opsPerImage} magnitude replace the entire search.`,
  };

  yield {
    state: labelMatrix(
      'Augmentation-policy ladder',
      [
        { id: 'auto', label: 'AutoAug' },
        { id: 'rand', label: 'RandAug' },
        { id: 'trivial', label: 'Trivial' },
      ],
      [
        { id: 'search', label: 'search' },
        { id: 'knobs', label: 'knobs' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['large', 'many', 'expensive'],
        ['small', 'N and M', 'tune target'],
        ['none', 'space only', 'try first'],
      ],
    ),
    highlight: { active: ['trivial:search', 'trivial:knobs', 'trivial:lesson'], compare: ['auto:search', 'rand:knobs'] },
    explanation: `The ${ladderMethods.length}-method ladder is the teaching point. If ${ladderMethods[2]} (tuning-free) is competitive, expensive policy search like ${ladderMethods[0]} must justify its cost with honest held-out gains.`,
  };

  yield {
    state: trivialGraph('Simplicity makes the baseline hard to dismiss'),
    highlight: { active: ['op', 'mag', 'apply', 'view', 'train', 'e-op-apply', 'e-mag-apply', 'e-apply-view', 'e-view-train'] },
    explanation: `Because the policy is so small (${opsPerImage} op, ${opsPerImage} magnitude, ${nodeCount} pipeline nodes, ${edgeCount} edges), failures are easier to diagnose. Inspect the operation catalog and magnitude bins before inventing a larger search system.`,
  };
}

function* baselineDiscipline() {
  const trivialScore = 84;
  const searchScore = 85.5;
  const margin = searchScore - trivialScore;
  const validationChecks = 4;
  const connectedMethods = ['RandAug', 'SimCLR'];

  yield {
    state: plotState({
      axes: { x: { label: 'method complexity', min: 0, max: 4 }, y: { label: 'validation score', min: 70, max: 90 } },
      series: [
        { id: 'baseline', label: 'baseline frontier', points: [
          { x: 0.5, y: 80 }, { x: 1.0, y: 84 }, { x: 2.2, y: 85 }, { x: 3.7, y: 85.5 },
        ] },
      ],
      markers: [
        { id: 'trivial', x: 1.0, y: 84, label: 'Trivial' },
        { id: 'search', x: 3.7, y: 85.5, label: 'policy search' },
      ],
    }),
    highlight: { active: ['baseline', 'trivial'], compare: ['search'] },
    explanation: `The generic shape is common in ML systems: Trivial scores ${trivialScore} while policy search adds only ${margin} points to reach ${searchScore}. That small margin must beat variance, cost, and implementation risk.`,
  };

  yield {
    state: labelMatrix(
      'What still needs validation',
      [
        { id: 'domain', label: 'domain' },
        { id: 'labels', label: 'labels' },
        { id: 'pipeline', label: 'pipeline' },
        { id: 'slices', label: 'slices' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['is op safe?', 'semantic damage'],
        ['class unchanged?', 'label noise'],
        ['CPU bottleneck?', 'slow input'],
        ['who gets worse?', 'hidden regression'],
      ],
    ),
    highlight: { found: ['domain:question', 'labels:question', 'pipeline:question', 'slices:question'] },
    explanation: `Tuning-free does not mean evaluation-free. All ${validationChecks} checks must pass: domain safety, label preservation, pipeline throughput, and slice regression. A safe catalog in one domain can corrupt labels in another.`,
  };

  yield {
    state: labelMatrix(
      'Connection map',
      [
        { id: 'rand', label: 'RandAug' },
        { id: 'simclr', label: 'SimCLR' },
        { id: 'leak', label: 'leakage' },
        { id: 'bench', label: 'variance' },
      ],
      [
        { id: 'shared', label: 'shared idea' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['random views', 'bad magnitudes'],
        ['invariance task', 'shortcut views'],
        ['split order', 'near-copy test'],
        ['compare methods', 'lucky run'],
      ],
    ),
    highlight: { active: ['rand:shared', 'simclr:shared', 'leak:risk', 'bench:risk'] },
    explanation: `TrivialAugment belongs in the same family as ${connectedMethods.join(' and ')}: augmentation teaches invariance. Data leakage and benchmark variance decide whether the ${margin}-point margin from policy search is real.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'one random op') yield* oneRandomOp();
  else if (view === 'baseline discipline') yield* baselineDiscipline();
  else throw new InputError('Pick a TrivialAugment view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The graph shows one training image moving through a tiny augmentation pipeline. Active nodes mark the random operation and magnitude draw; the found node is the transformed view that keeps the original label.',
        {type: 'callout', text: 'TrivialAugment treats the augmentation catalog as the policy: one sampled operation plus one sampled magnitude is the whole baseline.'},
        'In the baseline view, the plot compares method complexity with validation score. The visual point is not that randomness is magic; it is that a cheap baseline can make expensive policy search justify its extra cost.',
        {type: 'image', src: './assets/gifs/trivialaugment-tuning-free-data-augmentation.gif', alt: 'Animated walkthrough of the trivialaugment tuning free data augmentation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Data augmentation creates transformed training examples that should keep the same label. It exists because models overfit to accidental details when the training set is smaller or narrower than the real distribution.',
        'TrivialAugment exists to ask whether automatic augmentation needs a searched policy at all. It keeps a catalog of plausible image edits, samples one edit and one magnitude, and benchmarks that simple rule before paying for policy search.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to hand tune crops, flips, rotations, color jitter, cutout, and probabilities until validation accuracy improves. That can work, but it turns preprocessing into a hidden hyperparameter system.',
        'AutoAugment-style methods automate the search by training candidate policies and choosing the best one. RandAugment simplified that search, but it still left knobs for operation count and magnitude.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Policy search costs compute, implementation time, and experimental attention. If the final gain over a simple baseline is 1.5 percentage points, seed variance, model choice, or preprocessing details can erase the claimed advantage.',
        'The deeper wall is label preservation. A rotation may preserve a dog label, but it can change a digit label, and a crop can remove the only medical feature that made an image positive.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The augmentation catalog is already a hypothesis about invariance. TrivialAugment treats that catalog as the policy: choose one operation uniformly, choose one magnitude bin uniformly, apply it, and keep the label.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Fractal_fern_explained.png', alt: 'Affine transformation example showing reflected, rotated, translated, and scaled fern parts', caption: 'Affine transformations are the geometric primitives behind many image augmentations; TrivialAugment samples from a catalog of such label-preserving changes instead of searching a policy. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Fractal_fern_explained.png.'},
        'This separates two questions. First ask whether random label-preserving views help; only after that ask whether a learned or tuned policy improves enough to justify itself.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Define a fixed operation catalog such as rotate, translate, shear, brightness, contrast, solarize, posterize, equalize, and identity. Define magnitude bins, often 31 bins in wide implementations, and let each operation map a bin to its own strength scale.',
        'For each training image, sample one operation and one magnitude bin, apply the edit, normalize the image, and train on it with the original label. The model architecture and loss function do not change.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works when the sampled edits change nuisance details while preserving class identity. The classifier is forced to learn features that survive small changes in position, color, contrast, and local occlusion.',
        'The one-operation rule also limits distribution drift. Stacking many strong edits can create images unlike the test distribution, while one random edit gives diversity without making every example heavily distorted.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The algorithmic cost is one image transform per training example and no outer policy-search loop. If policy search would train 50 candidate policies and one final model, TrivialAugment removes those 50 extra training jobs.',
        'The practical cost can move to the input pipeline. If CPU augmentation takes 4 ms per image and the accelerator consumes images faster than that, training becomes input-bound unless transforms are batched, cached, or moved to optimized libraries.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'TrivialAugment is a strong first baseline for image classification experiments. A new augmentation method should beat no augmentation, crop-and-flip, RandAugment, and TrivialAugment under matched training budgets.',
        'It is useful in production training pipelines that refresh data often. Fewer knobs mean fewer stale settings to retune after the data distribution changes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the catalog contains label-changing operations. Orientation-sensitive digits, medical images, industrial defects, satellite bands, and OCR can all be harmed by generic photo augmentations.',
        'It also fails as evidence when augmentation leaks across splits. If augmented near-copies are created before train-validation-test splitting, validation accuracy can rise without true generalization.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the catalog has 14 operations and 31 magnitude bins. For one image, TrivialAugment draws solarize and bin 17, applies that one edit, and keeps the class label unchanged.',
        'If the simple baseline scores 84.0 percent and a searched policy scores 85.5 percent, the gain is 1.5 points. That gain must exceed run-to-run variance, extra search compute, slower iteration, and the risk that the searched policy overfits the validation set.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Muller and Hutter, TrivialAugment: Tuning-free Yet State-of-the-Art Data Augmentation, 2021. Also study AutoAugment, RandAugment, Mixup, CutMix, Cutout, and Torchvision TrivialAugmentWide implementations.',
        'Study regularization, dropout, contrastive learning, data leakage, benchmark variance, and distribution shift next. These explain why augmentation is a claim about invariance and evaluation, not decoration around the training loop.',
      ],
    },
  ],
};
