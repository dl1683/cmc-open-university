// RandAugment: automated data augmentation with two knobs instead of a huge
// learned policy search space.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'randaugment-policy-search',
  title: 'RandAugment Policy Search',
  category: 'AI & ML',
  summary: 'A practical augmentation recipe: choose N random transforms, apply a shared magnitude M, and tune regularization strength on the target task.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['N and M knobs', 'regularization strength'], defaultValue: 'N and M knobs' },
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

function* nAndMKnobs() {
  yield {
    state: labelMatrix(
      'N and M only',
      [
        { id: 'n', label: 'N' },
        { id: 'm', label: 'M' },
        { id: 'ops', label: 'O' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'ex', label: 'ex' },
      ],
      [
        ['count', '2'],
        ['mag', '9'],
        ['ops', 'rot'],
      ],
    ),
    highlight: { active: ['n:role', 'm:role'], found: ['ops:ex'] },
    explanation: 'RandAugment removes the separate controller that searches a giant augmentation policy. For each image, pick N transforms from a fixed catalog and apply them with a shared magnitude M.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'img', label: 'image', x: 0.8, y: 3.8, note: 'training sample' },
        { id: 'draw1', label: 'draw op', x: 2.8, y: 2.4, note: 'random' },
        { id: 'draw2', label: 'draw op', x: 2.8, y: 5.2, note: 'random' },
        { id: 'm', label: 'M', x: 4.8, y: 3.8, note: 'shared strength' },
        { id: 'aug', label: 'augmented', x: 7.0, y: 3.8, note: 'new view' },
        { id: 'train', label: 'train', x: 9.0, y: 3.8, note: 'same label' },
      ],
      edges: [
        { id: 'e-img-draw1', from: 'img', to: 'draw1', weight: '' },
        { id: 'e-img-draw2', from: 'img', to: 'draw2', weight: '' },
        { id: 'e-draw1-m', from: 'draw1', to: 'm', weight: '' },
        { id: 'e-draw2-m', from: 'draw2', to: 'm', weight: '' },
        { id: 'e-m-aug', from: 'm', to: 'aug', weight: '' },
        { id: 'e-aug-train', from: 'aug', to: 'train', weight: '' },
      ],
    }, { title: 'Every minibatch sees fresh randomized views' }),
    highlight: { active: ['draw1', 'draw2', 'm'], found: ['aug'] },
    explanation: 'The random draw changes per sample and per epoch. That cheap randomness creates useful input diversity without learning a custom policy on a proxy dataset.',
    invariant: 'The label stays the same; only nuisance factors change.',
  };

  yield {
    state: labelMatrix(
      'A tiny catalog can produce many views',
      [
        { id: 'rotate', label: 'rotate' },
        { id: 'color', label: 'color' },
        { id: 'shear', label: 'shear' },
        { id: 'cutout', label: 'cutout' },
      ],
      [
        { id: 'picked', label: 'picked?' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['yes', 'angle'],
        ['no', 'skip'],
        ['yes', 'slant'],
        ['no', 'skip'],
      ],
    ),
    highlight: { found: ['rotate:picked', 'shear:picked'], removed: ['color:picked', 'cutout:picked'] },
    explanation: 'With N=2, this image received rotate and shear. Another image might receive color and cutout. The policy is not one fixed recipe; it is a randomized recipe family.',
  };

  yield {
    state: labelMatrix(
      'Search-space collapse',
      [
        { id: 'auto', label: 'AutoAug' },
        { id: 'rand', label: 'RandAug' },
        { id: 'target', label: 'target' },
      ],
      [
        { id: 'search', label: 'search' },
        { id: 'proxy', label: 'proxy?' },
        { id: 'knobs', label: 'knobs' },
      ],
      [
        ['huge', 'yes', 'many'],
        ['small', 'no', 'N,M'],
        ['direct', 'no', 'tune M'],
      ],
    ),
    highlight: { active: ['rand:search', 'rand:knobs', 'target:search'], compare: ['auto:search'] },
    explanation: 'The paper reports a massive reduction in policy-search space. That matters because augmentation strength should be tuned on the actual model and dataset, not only transferred from a small proxy task.',
  };
}

function* regularizationStrength() {
  yield {
    state: plotState({
      axes: { x: { label: 'augmentation magnitude M', min: 0, max: 30 }, y: { label: 'validation accuracy', min: 70, max: 90 } },
      series: [
        { id: 'small', label: 'small model', points: [
          { x: 0, y: 78 }, { x: 5, y: 82 }, { x: 10, y: 84 }, { x: 15, y: 83 }, { x: 20, y: 80 }, { x: 25, y: 76 },
        ] },
        { id: 'large', label: 'large model', points: [
          { x: 0, y: 80 }, { x: 5, y: 83 }, { x: 10, y: 86 }, { x: 15, y: 88 }, { x: 20, y: 87 }, { x: 25, y: 84 },
        ] },
      ],
      markers: [
        { id: 'smallbest', x: 10, y: 84, label: 'small best' },
        { id: 'largebest', x: 15, y: 88, label: 'large best' },
      ],
    }),
    highlight: { active: ['small', 'large'], found: ['smallbest', 'largebest'] },
    explanation: 'A key paper result is that optimal augmentation strength depends on model and dataset scale. A larger model can often benefit from stronger regularization than a smaller one.',
  };

  yield {
    state: labelMatrix(
      'Augmentation is regularization',
      [
        { id: 'weak', label: 'too weak' },
        { id: 'right', label: 'right' },
        { id: 'strong', label: 'too strong' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'model learns', label: 'model learns' },
      ],
      [
        ['overfit', 'memorize views'],
        ['robust', 'stable features'],
        ['underfit', 'label noise'],
      ],
    ),
    highlight: { found: ['right:symptom', 'right:model learns'], compare: ['weak:symptom', 'strong:symptom'] },
    explanation: 'The job is not to make images weird. The job is to apply enough nuisance variation that the model learns stable features without destroying the label semantics.',
    invariant: 'More augmentation is only better until it starts corrupting the task.',
  };

  yield {
    state: labelMatrix(
      'What to monitor',
      [
        { id: 'train', label: 'train acc' },
        { id: 'val', label: 'val acc' },
        { id: 'corrupt', label: 'corrupt' },
        { id: 'examples', label: 'samples' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'response', label: 'response' },
      ],
      [
        ['too high gap', 'raise M'],
        ['drops early', 'lower M'],
        ['improves', 'keep policy'],
        ['labels break', 'remove op'],
      ],
    ),
    highlight: { active: ['train:response', 'val:response', 'examples:response'], found: ['corrupt:signal'] },
    explanation: 'A production augmentation policy should be audited with curves and actual images. If samples stop preserving the label, the policy is no longer regularization; it is data poisoning.',
  };

  yield {
    state: labelMatrix(
      'Where RandAugment connects',
      [
        { id: 'dropout', label: 'Dropout' },
        { id: 'contrast', label: 'SimCLR' },
        { id: 'data', label: 'Leakage' },
        { id: 'robust', label: 'Adversarial' },
      ],
      [
        { id: 'shared idea', label: 'shared idea' },
        { id: 'question', label: 'question' },
      ],
      [
        ['regularize', 'what noise is safe?'],
        ['two views', 'which invariances matter?'],
        ['split safety', 'did transforms leak labels?'],
        ['corruption', 'does robustness transfer?'],
      ],
    ),
    highlight: { found: ['dropout:question', 'contrast:question', 'data:question', 'robust:question'] },
    explanation: 'RandAugment is part of a broader theme: controlled noise can teach invariance, but the chosen noise encodes assumptions about what should not matter.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'N and M knobs') yield* nAndMKnobs();
  else if (view === 'regularization strength') yield* regularizationStrength();
  else throw new InputError('Pick a RandAugment view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'RandAugment is a practical automated data-augmentation method. Earlier automated augmentation systems searched over large policy spaces: which operation, which probability, which magnitude, and how operations should be composed. RandAugment collapses that into two knobs. N controls how many operations to apply. M controls the shared operation magnitude.',
        'For each training image, the algorithm randomly chooses N transformations from a fixed catalog and applies them with magnitude M. The label is unchanged. The model therefore sees many randomized views of the same underlying class, which acts as regularization. The local corpus summary gets the intuition right: high-quality input noise can make it harder for the model to memorize superficial details.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A typical image catalog includes operations such as rotate, shear, translate, posterize, solarize, contrast, color, brightness, sharpness, and cutout. RandAugment does not learn a separate probability and magnitude for every operation on a small proxy task. It samples uniformly from the catalog and tunes the global strength on the target task. That is the key simplification.',
        'The paper argues that optimal augmentation strength depends on model size and training-set size. A policy found on a small proxy task can under-regularize or over-regularize the actual training run. RandAugment is cheap enough to tune directly with the model and data you plan to use.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The runtime cost is mostly image preprocessing. The search cost is dramatically smaller than AutoAugment-style policy search because the space is parameterized by N and M rather than a combinatorial policy controller. The training cost can still increase if augmentation is CPU-bound or if strong transforms require more epochs to converge. In production, augmentation pipelines should be profiled like any other input pipeline.',
        'The main risk is invalid augmentation. A rotated digit may keep its label; a flipped medical image or traffic sign may not. Strong magnitude can help large models generalize, but past a point it creates label noise. The correct setting is empirical and domain-specific.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RandAugment is useful in image classification, object detection, semi-supervised learning, robustness experiments, and self-supervised pipelines. It connects to Contrastive Learning: SimCLR because both rely on meaningful transformed views. It connects to Dropout and Regularization because all three fight overfitting by injecting noise. It connects to Data Leakage because augmentation must be applied only within the training protocol, never in a way that leaks validation information.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'RandAugment is not a universal image-improvement filter. It is a training-time regularizer. It can hurt tasks where transformations change meaning, where labels are spatially delicate, or where the input pipeline becomes the bottleneck. It also does not remove the need for validation. The paper simplified the search space; it did not prove that every catalog operation is safe for every dataset.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RandAugment at https://arxiv.org/abs/1909.13719, the NeurIPS abstract at https://papers.nips.cc/paper/2020/hash/d85b63ef0ccb114d0a3bb7b7d808028f-Abstract.html, and the CVPRW paper at https://openaccess.thecvf.com/content_CVPRW_2020/papers/w40/Cubuk_Randaugment_Practical_Automated_Data_Augmentation_With_a_Reduced_Search_Space_CVPRW_2020_paper.pdf. Study Dropout, Regularization, Contrastive Learning: SimCLR, Data Leakage & Contamination, Adversarial Examples, and Cross-Validation next.',
      ],
    },
  ],
};
