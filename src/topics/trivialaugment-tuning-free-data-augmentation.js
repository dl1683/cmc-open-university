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
        "Read the animation as the execution trace for TrivialAugment: Tuning-Free Data Augmentation. A minimal augmentation baseline: pick one transform, pick one magnitude bin, apply it, and benchmark the cheap baseline first..",
        {type: "callout", text: "TrivialAugment treats the augmentation catalog as the policy: one sampled operation plus one sampled magnitude is the whole baseline."},
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/trivialaugment-tuning-free-data-augmentation.gif', alt: 'Animated walkthrough of the trivialaugment tuning free data augmentation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why TrivialAugment exists',
      paragraphs: [
        `TrivialAugment is a data augmentation method for image classification that asks an uncomfortable question: how much of the gain from automatic augmentation comes from clever policy search, and how much comes from simply applying a reasonable random transformation during training? Its rule is intentionally small. For each training image, sample one augmentation operation from a fixed catalog, sample one magnitude from a fixed set of bins, apply that one transformation, and keep the original label. There is no controller, no reinforcement-learning search, no learned schedule, and no dataset-specific tuning loop for the number of operations or their strength.`,
        `That simplicity matters because augmentation research had accumulated a lot of machinery. AutoAugment searched for policies over operations, probabilities, and magnitudes. RandAugment simplified the space, but still left two important knobs: how many operations to apply and how strong they should be. TrivialAugment removes those knobs and keeps only the augmentation space itself. The paper\'s central result is not that randomness is magic. It is that a brutally simple baseline can be strong enough that more expensive policy-search methods must prove their additional cost with clean evidence.`,
        `The method exists to discipline experimentation. If a cheap tuning-free baseline gives most of the benefit, then a complex augmentation system is no longer automatically impressive. It has to beat variance, extra compute, implementation risk, and the maintenance burden of carrying a policy-search pipeline. That makes TrivialAugment useful even when it is not the final method: it is the first serious baseline a vision training recipe should have to beat.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The naive approach to augmentation is manual recipe design. A practitioner decides that images should sometimes be cropped, flipped, rotated, color-shifted, or blurred, then tunes the exact probabilities and strengths by validation performance. That can work, but it turns preprocessing into a pile of hidden hyperparameters. Worse, the recipe often becomes dataset folklore: the settings that worked for one benchmark get copied elsewhere without checking whether the label-preserving assumptions still hold.`,
        `Automatic augmentation tried to remove some of that hand design by searching over policies. The wall is cost and brittleness. A search method must train many candidate policies or proxy models, then transfer a selected policy to the final training run. Even when the search is cheaper than full training, it adds more moving parts than the underlying idea seems to deserve. If final gains are small, they can disappear under seed variance, different model sizes, different data preprocessing, or a slightly changed augmentation implementation.`,
        `RandAugment was an important simplification because it removed policy probabilities and schedules. It kept a single shared magnitude and a count of operations per image. TrivialAugment pushes the reduction further. It says: before tuning operation count and magnitude, ask whether the operation catalog alone already gives enough useful stochasticity. If it does, then the optimization wall was partly self-inflicted.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core idea is that the augmentation space is the policy. A catalog contains operations such as identity, shear, translate, rotate, brightness, color, contrast, sharpness, posterize, solarize, equalize, autocontrast, and cutout-style masking. For each training example, the algorithm samples one operation uniformly and samples one magnitude bin uniformly from the allowed bins for that operation. It applies that transformation and sends the result to the learner with the same label.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/4/4b/Fractal_fern_explained.png`, alt: `Affine transformation example showing reflected, rotated, translated, and scaled fern parts`, caption: `Affine transformations are the geometric primitives behind many image augmentations; TrivialAugment samples from a catalog of such label-preserving changes instead of searching a policy. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Fractal_fern_explained.png.`},
        `This is not the same as saying every transformation is equally safe. The operation catalog is a human-designed hypothesis about invariances in the data. A small rotation should not change whether a natural image contains a dog. A moderate color shift usually should not change whether a photograph contains a truck. But those assumptions are domain-dependent. Rotating a digit can turn a six into something closer to a nine. Cropping a medical scan can remove the evidence. Color changes can destroy signals in pathology or satellite imagery. TrivialAugment removes tuning, not judgment.`,
        `The method\'s appeal comes from separating two questions that are often blurred together. First, do random label-preserving views improve generalization? Second, do we need a searched policy to choose those views? TrivialAugment answers the second question with a strong default: try the simplest random policy before paying for search.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A typical implementation starts by defining a fixed number of magnitude bins, often thirty-one in the wide version used by libraries. Each operation maps a bin index to an operation-specific strength. For rotation, a high bin means a larger angle. For translation, it means a larger pixel shift. For posterize, the direction of the mapping may be less intuitive because fewer bits means a stronger effect. Some operations, such as equalize or autocontrast, may ignore magnitude entirely. The algorithm can still sample a bin for every operation because the operation itself decides how to interpret it.`,
        `During training, the input pipeline receives an image. It samples an operation from the catalog. It samples a magnitude bin. It applies the transformation. The transformed image is normalized and batched like any other training example. Nothing about the model architecture changes. The loss function does not know whether the view came from a hand-tuned crop recipe, RandAugment, TrivialAugment, or no augmentation at all.`,
        `The method is cheap because it performs one image edit per sample. There is no outer loop that searches for a policy. There is no validation controller updating augmentation probabilities. There is no need to train a smaller proxy model first. The main operational concern is whether the input pipeline can keep the accelerators fed. If augmentation runs on CPU and becomes the bottleneck, the training job can slow down even though the algorithm itself is conceptually simple. Frameworks such as Torchvision and NVIDIA DALI provide implementations because the engineering details still matter at scale.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `TrivialAugment works when the catalog contains transformations that preserve the class while changing nuisance details. A classifier should not memorize that a dog class only appears under a certain brightness, crop, or color balance. Random transformations force the model to learn features that survive those changes. This is ordinary regularization, but applied through the data distribution rather than through the weights.`,
        `The one-operation rule also avoids some failure modes of stacking many transformations. If every image receives several strong edits, the training distribution can drift too far from the test distribution. A single random edit gives diversity without always producing heavily distorted views. It also makes the effect easier to reason about. When performance drops, you can inspect the operation catalog and magnitude bins instead of debugging a long policy sequence.`,
        `The deeper reason it can compete with searched methods is that the marginal value of precise policy choice may be smaller than expected. Once the catalog contains useful invariances, a model sees many different views across epochs. The learner does not need the optimal transform on every image. It needs enough plausible variation to avoid brittle shortcuts. In that regime, random coverage of the augmentation space can be surprisingly effective.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `TrivialAugment is most useful as an image-classification default and as a research baseline. If a paper proposes a new automatic augmentation method, it should compare against no augmentation, conventional crop-and-flip recipes, RandAugment, and TrivialAugment under matched training budgets. If the new method only beats weak baselines, the claim is incomplete.`,
        `In production work, it is useful during early model development. Teams often need a robust training recipe before they have time to run large sweeps. TrivialAugment gives a low-tuning way to test whether stronger augmentation helps at all. It is also attractive for repeated training pipelines where dataset shifts happen often, because fewer knobs mean fewer stale settings to retune after every data refresh.`,
        `It is less natural for domains where transformations must be physically or semantically constrained. Medical imaging, industrial inspection, remote sensing, OCR, geospatial mapping, and fine-grained product recognition all require a more careful invariance audit. TrivialAugment can still be used there, but the catalog should be narrowed to transformations that domain experts agree preserve the target label.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study ordinary data augmentation first: random crops, flips, color jitter, Cutout, MixUp, and RandAugment. Then study validation leakage and distribution shift, because augmentation policies can quietly improve benchmark numbers while harming the target distribution.',
        'For model-selection context, study calibration, robustness benchmarks, AutoAugment, RandAugment, and ablation design. The lasting lesson is that augmentation is a distribution-design choice, not decoration around the training loop.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The biggest failure mode is label corruption. If an operation changes the class, the model is trained on noisy labels. This can be subtle. A traffic sign classifier may depend on orientation. A medical label may depend on a small structure that cutout removes. A satellite class may depend on color bands that ordinary photo augmentations distort. Tuning-free does not mean validation-free; the catalog is still a scientific claim about the data.`,
        `The second failure mode is data leakage. Augmentation must happen inside the training pipeline after the train-validation-test split. If augmented near-copies are generated first and then split, validation examples can become transformed siblings of training examples. That makes performance look better without improving generalization. Data Leakage and Contamination is the right companion topic because augmentation pipelines are a common source of accidental leakage.`,
        `The main tradeoff is between simplicity and adaptivity. TrivialAugment has almost no search cost and few knobs, but it cannot learn that some operations are especially useful for a dataset or that some classes are harmed by certain transformations. Searched policies can, in principle, adapt more precisely. The engineering question is whether that precision is worth the complexity. A good workflow treats TrivialAugment as the floor: if a more complicated method cannot beat it by more than noise under honest evaluation, the simple method wins.`,
        `Study the original TrivialAugment paper at https://arxiv.org/abs/2103.10158, the official implementation at https://github.com/automl/trivialaugment, Torchvision TrivialAugmentWide, and NVIDIA DALI\'s auto-augmentation docs. Then study RandAugment Policy Search, Contrastive Learning: SimCLR, Dropout, Regularization, Data Leakage and Contamination, and Benchmark Variance and Model Selection. Those topics explain the larger lesson: augmentation is not just image editing; it is a claim about invariance, evaluation discipline, and the cost of tuning.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `Collect more data: expensive, slow, sometimes impossible (medical imaging, rare events). Data augmentation creates synthetic training examples from existing data via label-preserving transformations. For images: flip, rotate, crop, color jitter, scale. For text: synonym replacement, back-translation, random insertion/deletion.`,
        `Augmentation is implicit regularization -- it tells the model "these transformed inputs should have the same label," which smooths the loss landscape and reduces overfitting. The transformations must be domain-appropriate: horizontal flip is fine for object detection (a cat flipped is still a cat) but wrong for digit recognition (a flipped 6 is not a 6).`,
        `Advanced methods go beyond single-image edits. Mixup (Zhang et al. 2018) interpolates between two training examples and their labels, producing soft targets that encourage linear behavior between training clusters. CutMix (Yun et al. 2019) pastes a patch from one image onto another with proportional label mixing, preserving more local structure than pixel-level interpolation.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: Krizhevsky et al. 2012 (AlexNet, popularized augmentation for CNNs), Zhang et al. 2018 (Mixup), Yun et al. 2019 (CutMix), Cubuk et al. 2019 (AutoAugment -- learned augmentation policies), DeVries & Taylor 2017 (Cutout/random erasing). The TrivialAugment paper itself is Mueller & Hutter 2021 (https://arxiv.org/abs/2103.10158).`,
        `Study next: Regularization (augmentation as implicit regularization -- the broader family this belongs to), Dropout (another regularization technique that works by random omission during training), Transfer Learning (pretrain on augmented data, fine-tune on the target task), Generative Models (synthetic data generation beyond simple transforms -- GANs and diffusion models can create entirely new training examples).`,
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you list 5 augmentation transforms for images and explain which are label-preserving vs. label-altering?',
            'Can you explain why Mixup works (it encourages linear behavior between training examples)?',
            'Can you explain when augmentation can hurt (domain-inappropriate transforms that create impossible inputs)?',
            'Can you compute the Mixup interpolation: lambda=0.3, image A (label: cat=1.0), image B (label: dog=1.0) -- what is the mixed label? (Answer: cat=0.3, dog=0.7.)',
          ],
        },
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        `Mixup example: lambda sampled from Beta(0.2, 0.2), draw lambda=0.7. Image A: cat (one-hot [1,0,0]). Image B: dog (one-hot [0,1,0]). Mixed image: 0.7*A + 0.3*B. Mixed label: [0.7, 0.3, 0.0]. The network trains to predict this soft label -- it learns that this image is "mostly cat, somewhat dog."`,
        `At test time, augmentation is off; the model outputs hard predictions. Result: the decision boundary becomes smoother, and the model generalizes better to unseen examples that fall between training clusters. Trace the math yourself: pick two images from different classes, choose a lambda, compute the mixed label, and verify it sums to 1.0.`,
      ],
    },
  ],
};
