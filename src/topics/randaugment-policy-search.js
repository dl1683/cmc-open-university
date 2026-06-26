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
  const knobRows = [
    { id: 'n', label: 'N' },
    { id: 'm', label: 'M' },
    { id: 'ops', label: 'O' },
  ];
  const knobCols = [
    { id: 'role', label: 'role' },
    { id: 'ex', label: 'ex' },
  ];
  const knobValues = [
    ['count', '2'],
    ['mag', '9'],
    ['ops', 'rot'],
  ];
  yield {
    state: labelMatrix('N and M only', knobRows, knobCols, knobValues),
    highlight: { active: ['n:role', 'm:role'], found: ['ops:ex'] },
    explanation: `RandAugment removes the separate controller that searches a giant augmentation policy. For each image, pick ${knobRows[0].label} transforms from a fixed catalog and apply them with a shared magnitude ${knobRows[1].label} — just ${knobRows.length} knobs instead of a learned policy.`,
  };

  const pipelineNodes = [
    { id: 'img', label: 'image', x: 0.8, y: 3.8, note: 'training sample' },
    { id: 'draw1', label: 'draw op', x: 2.8, y: 2.4, note: 'random' },
    { id: 'draw2', label: 'draw op', x: 2.8, y: 5.2, note: 'random' },
    { id: 'm', label: 'M', x: 4.8, y: 3.8, note: 'shared strength' },
    { id: 'aug', label: 'augmented', x: 7.0, y: 3.8, note: 'new view' },
    { id: 'train', label: 'train', x: 9.0, y: 3.8, note: 'same label' },
  ];
  const pipelineEdges = [
    { id: 'e-img-draw1', from: 'img', to: 'draw1', weight: '' },
    { id: 'e-img-draw2', from: 'img', to: 'draw2', weight: '' },
    { id: 'e-draw1-m', from: 'draw1', to: 'm', weight: '' },
    { id: 'e-draw2-m', from: 'draw2', to: 'm', weight: '' },
    { id: 'e-m-aug', from: 'm', to: 'aug', weight: '' },
    { id: 'e-aug-train', from: 'aug', to: 'train', weight: '' },
  ];
  yield {
    state: graphState({
      nodes: pipelineNodes,
      edges: pipelineEdges,
    }, { title: 'Every minibatch sees fresh randomized views' }),
    highlight: { active: ['draw1', 'draw2', 'm'], found: ['aug'] },
    explanation: `The random draw changes per sample and per epoch across ${pipelineNodes.length} pipeline stages connected by ${pipelineEdges.length} edges. That cheap randomness creates useful input diversity without learning a custom policy on a proxy dataset.`,
    invariant: `The label stays the same — the "${pipelineNodes[pipelineNodes.length - 1].note}" constraint holds; only nuisance factors change.`,
  };

  const catalogOps = [
    { id: 'rotate', label: 'rotate' },
    { id: 'color', label: 'color' },
    { id: 'shear', label: 'shear' },
    { id: 'cutout', label: 'cutout' },
  ];
  const catalogPicked = [
    ['yes', 'angle'],
    ['no', 'skip'],
    ['yes', 'slant'],
    ['no', 'skip'],
  ];
  const pickedOps = catalogOps.filter((_, i) => catalogPicked[i][0] === 'yes');
  yield {
    state: labelMatrix(
      'A tiny catalog can produce many views',
      catalogOps,
      [
        { id: 'picked', label: 'picked?' },
        { id: 'effect', label: 'effect' },
      ],
      catalogPicked,
    ),
    highlight: { found: ['rotate:picked', 'shear:picked'], removed: ['color:picked', 'cutout:picked'] },
    explanation: `With N=${pickedOps.length}, this image received ${pickedOps.map(o => o.label).join(' and ')} from a catalog of ${catalogOps.length} operations. The policy is not one fixed recipe; it is a randomized recipe family.`,
  };

  const methods = [
    { id: 'auto', label: 'AutoAug' },
    { id: 'rand', label: 'RandAug' },
    { id: 'target', label: 'target' },
  ];
  const compareValues = [
    ['huge', 'yes', 'many'],
    ['small', 'no', 'N,M'],
    ['direct', 'no', 'tune M'],
  ];
  yield {
    state: labelMatrix(
      'Search-space collapse',
      methods,
      [
        { id: 'search', label: 'search' },
        { id: 'proxy', label: 'proxy?' },
        { id: 'knobs', label: 'knobs' },
      ],
      compareValues,
    ),
    highlight: { active: ['rand:search', 'rand:knobs', 'target:search'], compare: ['auto:search'] },
    explanation: `${methods[0].label} requires a "${compareValues[0][0]}" search with ${compareValues[0][2]} knobs, while ${methods[1].label} collapses to just ${compareValues[1][2]}. That matters because augmentation strength should be tuned on the actual model and dataset, not only transferred from a small proxy task.`,
  };
}

function* regularizationStrength() {
  const accMarkers = [
    { id: 'smallbest', x: 10, y: 84, label: 'small best' },
    { id: 'largebest', x: 15, y: 88, label: 'large best' },
  ];
  const mRange = { min: 0, max: 30 };
  yield {
    state: plotState({
      axes: { x: { label: 'augmentation magnitude M', ...mRange }, y: { label: 'validation accuracy', min: 70, max: 90 } },
      series: [
        { id: 'small', label: 'small model', points: [
          { x: 0, y: 78 }, { x: 5, y: 82 }, { x: 10, y: 84 }, { x: 15, y: 83 }, { x: 20, y: 80 }, { x: 25, y: 76 },
        ] },
        { id: 'large', label: 'large model', points: [
          { x: 0, y: 80 }, { x: 5, y: 83 }, { x: 10, y: 86 }, { x: 15, y: 88 }, { x: 20, y: 87 }, { x: 25, y: 84 },
        ] },
      ],
      markers: accMarkers,
    }),
    highlight: { active: ['small', 'large'], found: ['smallbest', 'largebest'] },
    explanation: `A key paper result: the small model peaks at M=${accMarkers[0].x} (${accMarkers[0].y}%) while the large model peaks at M=${accMarkers[1].x} (${accMarkers[1].y}%). Optimal augmentation strength depends on model and dataset scale.`,
  };

  const regimeRows = [
    { id: 'weak', label: 'too weak' },
    { id: 'right', label: 'right' },
    { id: 'strong', label: 'too strong' },
  ];
  const regimeOutcomes = [
    ['overfit', 'memorize views'],
    ['robust', 'stable features'],
    ['underfit', 'label noise'],
  ];
  yield {
    state: labelMatrix(
      'Augmentation is regularization',
      regimeRows,
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'model learns', label: 'model learns' },
      ],
      regimeOutcomes,
    ),
    highlight: { found: ['right:symptom', 'right:model learns'], compare: ['weak:symptom', 'strong:symptom'] },
    explanation: `The job is not to make images weird. The "${regimeRows[1].label}" regime produces "${regimeOutcomes[1][1]}" — apply enough nuisance variation that the model learns stable features without destroying the label semantics.`,
    invariant: `More augmentation is only better until it crosses from "${regimeOutcomes[1][0]}" to "${regimeOutcomes[2][0]}" — corrupting the task.`,
  };

  const monitorRows = [
    { id: 'train', label: 'train acc' },
    { id: 'val', label: 'val acc' },
    { id: 'corrupt', label: 'corrupt' },
    { id: 'examples', label: 'samples' },
  ];
  const monitorActions = [
    ['too high gap', 'raise M'],
    ['drops early', 'lower M'],
    ['improves', 'keep policy'],
    ['labels break', 'remove op'],
  ];
  yield {
    state: labelMatrix(
      'What to monitor',
      monitorRows,
      [
        { id: 'signal', label: 'signal' },
        { id: 'response', label: 'response' },
      ],
      monitorActions,
    ),
    highlight: { active: ['train:response', 'val:response', 'examples:response'], found: ['corrupt:signal'] },
    explanation: `A production augmentation policy should be audited across ${monitorRows.length} signals. If "${monitorRows[2].label}" shows "${monitorActions[3][0]}", the response is "${monitorActions[3][1]}" — the policy is no longer regularization; it is data poisoning.`,
  };

  const connectionRows = [
    { id: 'dropout', label: 'Dropout' },
    { id: 'contrast', label: 'SimCLR' },
    { id: 'data', label: 'Leakage' },
    { id: 'robust', label: 'Adversarial' },
  ];
  yield {
    state: labelMatrix(
      'Where RandAugment connects',
      connectionRows,
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
    explanation: `RandAugment connects to ${connectionRows.length} related ideas — ${connectionRows.map(r => r.label).join(', ')} — all part of a broader theme: controlled noise can teach invariance, but the chosen noise encodes assumptions about what should not matter.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a training-time policy search for data augmentation, which means changing training images while keeping their labels true. N is the number of transforms applied, and M is their shared strength.',
        {type: 'image', src: './assets/gifs/randaugment-policy-search.gif', alt: 'Animated walkthrough of the randaugment policy search visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is that an augmented image is useful only while the label remains valid. A stronger transform is not automatically better because it can cross from regularization into label corruption.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Vision models often memorize accidental cues in the training set. Data augmentation fights that by showing altered versions of the same labeled example, so the model learns features that survive safe changes.',
        {type: 'callout', text: 'RandAugment turns augmentation policy search into two regularization controls: how many transforms to apply and how strong they should be.'},
        'RandAugment exists because earlier automated augmentation systems searched too many policy choices. It asks a narrower question: with a fixed catalog of sensible transforms, how many transforms and how much strength should training use?',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is hand-built augmentation. A practitioner chooses random crops, flips, color jitter, or rotation based on domain knowledge and checks validation accuracy.',
        'A more automated approach is to search over many operation probabilities, magnitudes, and orderings. That can work, but it turns augmentation into a separate optimization problem that may cost as much attention as the model itself.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is search space. If 14 operations each have several probabilities and magnitudes, the number of possible policies grows faster than a team can test on the full dataset.',
        'There is also a transfer wall. A policy found on a small proxy task may not behave the same on the real model, resolution, dataset, or label set.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to remove most of the policy choices. RandAugment samples operations uniformly from a fixed catalog and tunes only N, the count of operations, and M, the magnitude applied to them.',
        'That simplification turns policy search into a small validation sweep. The catalog carries domain assumptions, while N and M control the pressure applied to the model.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each training image, RandAugment samples N operations such as rotate, shear, translate, solarize, or color adjustment. It applies each sampled operation at magnitude M, then trains on the transformed image with the original label.',
        'The team runs a grid over N and M, watches validation performance, and inspects samples. If validation improves and samples still mean the same thing, the policy is adding useful invariance.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Augmentation changes what reaches the network during training, forcing hidden layers to prefer features that survive safe input variation. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
        'Correctness is empirical but not arbitrary. The label-preservation invariant says that the transformed input must still belong to the same class, so training pressure teaches invariance instead of teaching wrong labels.',
        'Random sampling makes a small catalog behave like a larger distribution. The model does not memorize one transformed copy; it sees many views that make brittle cues less reliable.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'RandAugment reduces policy-search cost from many policy dimensions to two controls. If N has 4 candidate values and M has 10, the sweep has 40 settings instead of thousands of operation-probability combinations.',
        'The runtime cost moves into the input pipeline. When N doubles from 2 to 4, each image performs twice as many transforms, and a slow CPU data loader can starve the GPU even if the model code is unchanged.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RandAugment fits image classification baselines when a team wants strong regularization without a long policy-search project. It is useful for retail images, manufacturing inspection, crop imagery, and mobile vision when the catalog matches real variation.',
        'It also fits semi-supervised and self-supervised training where consistent predictions across transformed views are part of the training signal. The same label-safety audit still applies.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {type: 'image', src: 'https://docs.pytorch.org/tutorials/_images/fgsm_panda_image.png', alt: 'Panda image, perturbation, and adversarial result from an FGSM example', caption: 'Perturbation examples make the label-safety boundary concrete: input changes can teach robustness only while the task label remains valid. Source: PyTorch documentation.'},
        'It fails when the catalog is wrong for the domain. A vertical flip may preserve a flower class and break a chest X-ray label, while rotation may preserve a dog photo and change a digit.',
        'It also fails when augmentation hides leakage or validation mistakes. A better validation score is not evidence of robustness if the split is contaminated or the transformed validation policy differs from deployment.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a classifier reaches 82.0 percent validation accuracy with only random crop and flip. A RandAugment sweep tests N in {1, 2, 3} and M in {5, 10, 15}, and the best setting is N=2, M=10 with 85.4 percent accuracy.',
        'At N=3, M=15, accuracy falls to 80.8 percent after sample audit shows rotated text labels and over-solarized objects. The numbers show the behavior: moderate pressure removes shortcuts, while excessive pressure changes the task.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Cubuk et al., RandAugment: Practical Automated Data Augmentation with a Reduced Search Space. Then compare it with AutoAugment and TrivialAugment to see how each method spends validation budget.',
        'Study regularization, dropout, mixup, contrastive learning, adversarial examples, dataset shift, and cross-validation next. The common question is which input changes preserve the target and which ones silently rewrite it.',
      ],
    },
  ],
};
