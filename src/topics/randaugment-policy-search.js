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
      heading: 'Why it exists',
      paragraphs: [
        'Data augmentation exists because most vision models should ignore many changes in the input. A dog is still a dog after small shifts in color, crop, contrast, translation, or rotation. A model that only sees the exact training image can learn accidental details: the background, the camera, the lighting, the border, or a particular pose. Augmentation forces the learner to see many valid versions of the same example, so the easiest solution is to learn the class signal instead of memorizing one picture.',
        'RandAugment exists because augmentation policy design became its own expensive optimization problem. Hand-built policies work, but they depend on expert taste and dataset habits. Earlier automated methods searched over operation choices, probabilities, magnitudes, and operation order. That can find strong policies, but the search can be expensive, hard to reproduce, and tied to a small proxy task. RandAugment asks a sharper question: if a fixed catalog of reasonable transforms already contains the useful ingredients, how much policy search do we actually need?',
      ],
    },
    {
      heading: 'The naive baseline',
      paragraphs: [
        'The first naive baseline is to train on the raw images. That often gives high training accuracy and weaker validation accuracy because the model has no pressure to be invariant to nuisance changes. The second baseline is to add a few hand-written transforms, such as random crop and horizontal flip, and hope they fit the domain. That is better, but it leaves performance on the table when color, geometry, cutout, or contrast changes would teach useful invariance.',
        'The more sophisticated naive answer is full policy search. Search methods such as AutoAugment treat augmentation as a learned policy: choose operations, choose probabilities, choose magnitudes, and compose sub-policies. The problem is that the search space grows quickly. Searching on the full target training run can be too costly, so teams often search on a reduced dataset or smaller model and transfer the policy. That transfer is the weak point. The right strength of regularization depends on model capacity, dataset size, training length, and label semantics.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that the catalog can stay broad while the search becomes tiny. RandAugment removes learned operation probabilities and per-operation magnitudes. For each image, it samples N operations from a fixed catalog and applies them with one shared magnitude M. N is the count of transforms. M is the strength. Instead of learning a controller, the practitioner tunes two numbers on the real task.',
        'This works because the important question is usually not the exact hand-crafted recipe. It is the level of label-preserving nuisance variation the model can tolerate. If the catalog is reasonable, random sampling already creates a large family of views. The validation set then chooses the strength of regularization. RandAugment turns augmentation from a large architecture-search problem into a small regularization-strength problem.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The first view proves the search-space collapse. The table with N and M is not saying augmentation became trivial. It is saying the policy surface has been compressed into two global controls. The graph after it shows why this is still powerful: every minibatch can see a fresh randomized view, even though the policy description is short. One image might receive rotation and shear. Another might receive color and cutout. The system is simple, but the training stream is varied.',
        'The regularization-strength view proves the tradeoff. The best M is not always the largest M. Weak augmentation leaves the model free to memorize training views. Strong augmentation can destroy the label and create noise. The plot also shows why proxy search is fragile: a small model and a large model can prefer different strengths. The lesson is not that RandAugment always chooses N equals 2 or M equals 9. The lesson is that augmentation should be tuned as a task-specific regularizer.',
      ],
    },
    {
      heading: 'How the algorithm works',
      paragraphs: [
        'A typical implementation begins with a catalog of label-preserving operations: rotate, shear, translate, posterize, solarize, color, contrast, brightness, sharpness, equalize, invert, autocontrast, and cutout. Some operations have natural magnitudes, such as rotation angle or translation distance. Others are effectively on or off. RandAugment maps the global M value into the valid range for each operation, then applies the selected operations to the training image.',
        'During training, for each image, sample N operations, apply them with magnitude M, keep the original label, and feed the transformed image to the model. The policy is stochastic at training time. Validation and test images are not randomly distorted in the same way; evaluation should measure the model on the intended distribution. The practical search is usually a small grid over N and M, sometimes with the catalog or maximum magnitude adjusted for the domain.',
        'The data structure is simple: an operation catalog, a magnitude mapping table, a sampler, and validation records for each N and M pair. That simplicity is the point. The model training run remains the expensive part. RandAugment tries to avoid spending a second large budget on a separate policy-learning controller.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'RandAugment works for the same reason other regularizers work: it makes the memorizing solution less attractive. If the image changes shape, color, crop, and local occlusion across epochs, the model cannot rely as easily on one brittle cue. It must find features that survive the allowed transformations. That is the same broad idea behind dropout, weight decay, mixup, and contrastive learning, but applied to the input distribution.',
        'The method also works because randomness composes. A small catalog can create many possible training views when operations are sampled repeatedly. The exact sequence is less important than the distribution of views. Validation then checks whether those views preserve the task. When the validation curve improves, the model is learning useful invariance. When it falls, the transform distribution has crossed from regularization into label corruption or underfitting.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The main cost is input-pipeline work. Some operations are cheap, but heavy image transforms can move the bottleneck from the GPU to CPU preprocessing, storage, or data-loader workers. Strong augmentation can also require more training steps before the model settles. RandAugment reduces policy-search cost, but it does not remove the need to run validation sweeps and inspect transformed samples.',
        'The main tradeoff is semantic safety. A horizontal flip is harmless for many animal photos and wrong for some traffic-sign, medical, satellite, and text-recognition tasks. Rotation can preserve a flower label and change a digit label. Cutout can improve robustness or erase the only object. Object detection, segmentation, OCR, and pose estimation often need label transforms too, not just image transforms. The catalog must be designed for the task, and M must be low enough that labels remain true.',
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        'RandAugment is commonly used in image classification pipelines where a strong baseline is needed without a long augmentation-search project. It is also useful in semi-supervised learning, where the model benefits from consistent predictions across transformed views. Robustness experiments use it to test whether nuisance variation improves performance on corrupted or shifted data. Self-supervised and contrastive methods share the same intuition: transformed views should preserve identity while removing shortcuts.',
        'In production, RandAugment is a good default when the team can inspect samples, run a small N and M sweep, and monitor validation by slice. It is not only for academic benchmarks. Retail image search, document image classification, agricultural imagery, manufacturing inspection, and mobile vision models can all benefit when the catalog matches the physical invariances of the domain.',
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        'The most common failure is treating augmentation as image improvement. RandAugment is not trying to make prettier images. It is trying to create training examples that preserve the label while removing shortcuts. If the chosen transforms change the answer, the pipeline is injecting label noise. If they are too weak, the model still overfits. If they are too expensive, the GPU waits for the input loader.',
        'Another limit is that RandAugment searches over strength, not over the truth of the catalog. The method assumes the catalog is sensible. It will not discover that vertical flips are invalid for chest X-rays or that rotation breaks text labels unless validation or sample audit exposes the problem. It also does not solve data leakage. Augmentation must be applied within the training protocol, and validation data must stay independent.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study the RandAugment paper at https://arxiv.org/abs/1909.13719 and the NeurIPS record at https://papers.nips.cc/paper/2020/hash/d85b63ef0ccb114d0a3bb7b7d808028f-Abstract.html. Then connect it to Regularization: L1 & L2, Dropout, Cross-Validation, Data Leakage & Contamination, Contrastive Learning: SimCLR, Mixup Data Augmentation, Adversarial Examples, Dataset Shift, and Hyperparameter Search. The next question is always the same: what invariances are true for this task, and how much pressure can the model take before those invariances become false?',
      ],
    },
  ],
};
