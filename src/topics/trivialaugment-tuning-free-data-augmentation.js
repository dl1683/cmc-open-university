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
  yield {
    state: trivialGraph('TrivialAugment samples exactly one operation'),
    highlight: { active: ['image', 'op', 'mag', 'apply', 'e-image-op', 'e-image-mag', 'e-op-apply', 'e-mag-apply'], found: ['view', 'train'] },
    explanation: 'TrivialAugment removes policy search and even removes the N knob from RandAugment. For each image, choose one augmentation operation and one magnitude bin at random, then train on the transformed view.',
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
    explanation: 'The algorithm is intentionally almost embarrassing. The work shifts from searching a complex policy to checking whether the augmentation space itself contains label-preserving operations.',
    invariant: 'The augmentation space is the policy.',
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
    explanation: 'The ladder is the teaching point. If a tuning-free baseline is competitive, expensive policy search must justify its cost with honest held-out gains.',
  };

  yield {
    state: trivialGraph('Simplicity makes the baseline hard to dismiss'),
    highlight: { active: ['op', 'mag', 'apply', 'view', 'train', 'e-op-apply', 'e-mag-apply', 'e-apply-view', 'e-view-train'] },
    explanation: 'Because the policy is so small, failures are easier to diagnose. If performance is poor, inspect the operation catalog, magnitude bins, domain semantics, and training pipeline before inventing a larger search system.',
  };
}

function* baselineDiscipline() {
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
    explanation: 'The generic shape is common in ML systems: a tiny baseline captures most of the gain, and a complex search adds a small uncertain margin. The margin must beat variance, cost, and implementation risk.',
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
    explanation: 'Tuning-free does not mean evaluation-free. Medical images, digits, satellite images, traffic signs, and product photos all have different invariances. A safe catalog in one domain can corrupt labels in another.',
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
    explanation: 'TrivialAugment belongs in the same family as RandAugment and SimCLR: augmentation teaches invariance. Data Leakage and benchmark variance decide whether the claimed gain is real.',
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
      heading: 'What it is',
      paragraphs: [
        'TrivialAugment is a tuning-free image augmentation method. For each training image, choose exactly one augmentation operation at random, choose a magnitude bin at random, apply it, and keep the label. The surprise in the paper is that such a small baseline can compete with or outperform more elaborate automatic augmentation methods: https://arxiv.org/abs/2103.10158.',
        'This topic follows RandAugment Policy Search. RandAugment keeps two knobs, N and M. TrivialAugment removes even those knobs from the training recipe. The remaining design choice is the augmentation space: which operations are allowed and which magnitude bins are possible.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The algorithm samples one operation from a predefined catalog such as rotate, shear, translate, color, contrast, posterize, solarize, or cutout-style transforms. It then samples a magnitude bin for that operation. Because only one transform is applied per image, the method is cheap and easy to implement. The official repository describes it as a simple state-of-the-art performing augmentation algorithm: https://github.com/automl/trivialaugment.',
        'The deeper lesson is baseline discipline. If a parameter-free random baseline works well, then complicated augmentation search must prove it is worth the extra search cost, implementation complexity, and benchmark variance. The simple method becomes a strong floor for future claims.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The runtime cost is one image transform per training sample, usually inside the input pipeline. There is no proxy-task controller, no learned policy, and no tuning loop for N or M. That makes TrivialAugment attractive when you want a robust augmentation default before spending search budget. The simplicity also makes ablations cheap: compare no augmentation, RandAugment, and TrivialAugment under the same seeds and budget before claiming policy search helps. NVIDIA DALI documents TrivialAugment as a parameter-free scheme where each sample receives one randomly selected augmentation and magnitude bin: https://docs.nvidia.com/deeplearning/dali/user-guide/docs/auto_aug/trivial_augment.html.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'TrivialAugment is useful as a default image-classification augmentation baseline, a cheap competitor to RandAugment, and a sanity check for expensive augmentation research. Torchvision includes TrivialAugmentWide as a dataset-independent transform inspired by the paper: https://docs.pytorch.org/vision/main/generated/torchvision.transforms.TrivialAugmentWide.html.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Tuning-free is not domain-free. A transform that preserves labels on natural images can break labels for medical scans, digits, traffic signs, satellite imagery, or quality-control photos. The augmentation catalog must still be reviewed. Also, do not apply augmentation before splitting data; near-duplicate transformed samples can leak across train and validation, exactly as Data Leakage & Contamination warns.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources: TrivialAugment paper at https://arxiv.org/abs/2103.10158, official implementation at https://github.com/automl/trivialaugment, NVIDIA DALI TrivialAugment docs at https://docs.nvidia.com/deeplearning/dali/user-guide/docs/auto_aug/trivial_augment.html, and Torchvision TrivialAugmentWide docs at https://docs.pytorch.org/vision/main/generated/torchvision.transforms.TrivialAugmentWide.html. Study RandAugment Policy Search, Contrastive Learning: SimCLR, Dropout, Regularization, Data Leakage & Contamination, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
