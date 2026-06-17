// SimCLR contrastive learning: create two augmented views of the same image,
// pull them together, and push all other batch examples apart.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'contrastive-learning-simclr',
  title: 'Contrastive Learning: SimCLR',
  category: 'AI & ML',
  summary: 'Self-supervised representation learning: augment each image twice, make positives close, and use the batch as negatives.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['positive pairs', 'batch negatives'], defaultValue: 'positive pairs' },
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

function simclrGraph(title) {
  return graphState({
    nodes: [
      { id: 'img', label: 'image', x: 0.8, y: 3.8, note: 'no label' },
      { id: 'crop1', label: 'crop + color', x: 2.8, y: 2.3, note: 'view 1' },
      { id: 'crop2', label: 'blur + crop', x: 2.8, y: 5.3, note: 'view 2' },
      { id: 'enc1', label: 'encoder', x: 5.0, y: 2.3, note: 'shared weights' },
      { id: 'enc2', label: 'encoder', x: 5.0, y: 5.3, note: 'shared weights' },
      { id: 'z1', label: 'projection z1', x: 7.3, y: 2.3, note: 'contrastive space' },
      { id: 'z2', label: 'projection z2', x: 7.3, y: 5.3, note: 'positive' },
    ],
    edges: [
      { id: 'e-img-crop1', from: 'img', to: 'crop1', weight: 'augment' },
      { id: 'e-img-crop2', from: 'img', to: 'crop2', weight: 'augment' },
      { id: 'e-crop1-enc1', from: 'crop1', to: 'enc1', weight: 'view' },
      { id: 'e-crop2-enc2', from: 'crop2', to: 'enc2', weight: 'view' },
      { id: 'e-enc1-z1', from: 'enc1', to: 'z1', weight: 'MLP head' },
      { id: 'e-enc2-z2', from: 'enc2', to: 'z2', weight: 'MLP head' },
      { id: 'e-z1-z2', from: 'z1', to: 'z2', weight: 'pull close' },
    ],
  }, { title });
}

function* positivePairs() {
  yield {
    state: simclrGraph('Two augmented views define the positive pair'),
    highlight: { active: ['img', 'crop1', 'crop2', 'e-img-crop1', 'e-img-crop2'], compare: ['z1', 'z2'] },
    explanation: 'SimCLR starts without labels. It creates two different augmented views of the same image. Those two views are the positive pair: the model should learn that they represent the same underlying object.',
  };

  yield {
    state: simclrGraph('The same encoder maps both views into representation space'),
    highlight: { active: ['enc1', 'enc2', 'e-crop1-enc1', 'e-crop2-enc2'], found: ['z1', 'z2'] },
    explanation: 'Both views pass through the same encoder. The projection head maps representations into the space where the contrastive loss is applied. The representation before the projection head is what downstream tasks usually keep.',
    invariant: 'Augmentations define what the model should ignore.',
  };

  yield {
    state: labelMatrix(
      'Augmentation strength is the teaching signal',
      [
        { id: 'crop', label: 'random crop' },
        { id: 'color', label: 'color distortion' },
        { id: 'blur', label: 'blur' },
        { id: 'weak', label: 'too weak' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['changes viewpoint', 'learn object not pixels'],
        ['changes color statistics', 'avoid color shortcut'],
        ['removes texture detail', 'use shape and context'],
        ['nearly identical views', 'model learns trivial invariance'],
      ],
    ),
    highlight: { active: ['crop:lesson', 'color:lesson', 'blur:lesson'], compare: ['weak:lesson'] },
    explanation: 'The local corpus notes emphasize this point: simple cropping plus strong color distortion did more than fancy augmentation policies. The augmentations define the self-supervised task.',
  };

  yield {
    state: labelMatrix(
      'After pretraining, labels become cheaper',
      [
        { id: 'pretrain', label: 'self-supervised pretrain' },
        { id: 'linear', label: 'linear probe' },
        { id: 'finetune', label: 'fine-tune' },
        { id: 'deploy', label: 'downstream model' },
      ],
      [
        { id: 'uses', label: 'uses' },
        { id: 'payoff', label: 'payoff' },
      ],
      [
        ['unlabeled images', 'general visual features'],
        ['frozen encoder', 'tests representation quality'],
        ['small labeled set', 'adapts to task'],
        ['encoder features', 'less label dependence'],
      ],
    ),
    highlight: { found: ['pretrain:payoff', 'linear:payoff', 'finetune:payoff'] },
    explanation: 'Contrastive learning separates representation learning from label-heavy training. The encoder learns reusable visual features before the task-specific classifier sees labels.',
  };
}

function* batchNegatives() {
  yield {
    state: labelMatrix(
      'Every other view in the batch is a negative',
      [
        { id: 'cat1', label: 'cat view 1' },
        { id: 'cat2', label: 'cat view 2' },
        { id: 'dog1', label: 'dog view 1' },
        { id: 'car1', label: 'car view 1' },
      ],
      [
        { id: 'cat1', label: 'cat1' },
        { id: 'cat2', label: 'cat2' },
        { id: 'dog1', label: 'dog1' },
        { id: 'car1', label: 'car1' },
      ],
      [
        ['self', 'positive', 'negative', 'negative'],
        ['positive', 'self', 'negative', 'negative'],
        ['negative', 'negative', 'self', 'negative'],
        ['negative', 'negative', 'negative', 'self'],
      ],
    ),
    highlight: { found: ['cat1:cat2', 'cat2:cat1'], removed: ['cat1:dog1', 'cat1:car1'] },
    explanation: 'The contrastive loss pulls the positive pair together and pushes all other examples in the batch apart. Bigger batches provide more negatives, which is one reason SimCLR benefits from large batches.',
  };

  yield {
    state: labelMatrix(
      'NT-Xent loss intuition',
      [
        { id: 'pos', label: 'positive similarity' },
        { id: 'neg', label: 'negative similarities' },
        { id: 'temp', label: 'temperature' },
        { id: 'loss', label: 'loss' },
      ],
      [
        { id: 'want', label: 'want' },
        { id: 'mechanism', label: 'mechanism' },
      ],
      [
        ['high', 'large numerator'],
        ['low', 'small denominator terms'],
        ['controls sharpness', 'Softmax & Temperature'],
        ['low when positive wins', 'cross-entropy over batch'],
      ],
    ),
    highlight: { active: ['pos:mechanism', 'neg:mechanism', 'temp:mechanism'], found: ['loss:want'] },
    explanation: 'SimCLR uses a softmax-style contrastive loss. The positive pair should win against all negatives. Temperature controls how sharply similarity differences affect the probabilities.',
    invariant: 'The loss needs both a positive pair and a set of negatives.',
  };

  yield {
    state: labelMatrix(
      'Why large batch helps contrastive learning',
      [
        { id: 'negatives', label: 'negative examples' },
        { id: 'coverage', label: 'semantic coverage' },
        { id: 'compute', label: 'compute cost' },
        { id: 'memory', label: 'memory cost' },
      ],
      [
        { id: 'small', label: 'small batch' },
        { id: 'large', label: 'large batch' },
      ],
      [
        ['few', 'many'],
        ['narrow comparison set', 'richer comparison set'],
        ['cheap step', 'expensive step'],
        ['fits easily', 'needs accelerator memory'],
      ],
    ),
    highlight: { active: ['negatives:large', 'coverage:large'], compare: ['compute:large', 'memory:large'] },
    explanation: 'Large batches make the self-supervised classification problem harder and more informative. Batch Size Scaling is therefore part of the SimCLR story, not just an engineering afterthought.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'shortcut', label: 'augmentation shortcut' },
        { id: 'false', label: 'false negatives' },
        { id: 'collapse', label: 'representation collapse' },
        { id: 'transfer', label: 'bad transfer' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'response', label: 'response' },
      ],
      [
        ['model keys on artifact', 'change augmentation policy'],
        ['same class pushed apart', 'larger data or supervised signal'],
        ['all embeddings similar', 'loss/design safeguards'],
        ['features miss target task', 'fine-tune and evaluate'],
      ],
    ),
    highlight: { active: ['shortcut:response', 'false:response', 'transfer:response'] },
    explanation: 'Self-supervision is not free truth. The pretext task teaches exactly the invariances and distinctions encoded by augmentations, negatives, and data distribution.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'positive pairs') yield* positivePairs();
  else if (view === 'batch negatives') yield* batchNegatives();
  else throw new InputError('Pick a SimCLR view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this topic exists',
      paragraphs: [
        `Deep vision models used to depend heavily on labeled datasets. Labels are expensive, slow, inconsistent, and often too narrow. A hospital may have millions of scans but only a small number with expert annotations. A retailer may have product photos but no clean taxonomy. A robot may collect frames continuously while only a small fraction receive task labels. The question behind SimCLR is simple: can the model learn useful visual features before humans label the data?`,
        `Contrastive self-supervision answers yes by creating a training signal from the data itself. SimCLR does not ask a human to name the object. It takes one image, creates two distorted views, and trains the model to recognize that those views came from the same source. At the same time, it pushes views from other images away. The result is an encoder that can be reused for classification, retrieval, clustering, detection, or fine-tuning with fewer labels.`,
      ],
    },
    {
      heading: 'The naive approaches',
      paragraphs: [
        `The first naive approach is supervised training from scratch. Collect labels, train a classifier, and hope the representation generalizes. This works when labels are abundant and aligned with the deployment task. It fails when labels are scarce, expensive, noisy, or too specific. A classifier trained only to separate a fixed set of classes may learn features that are good for that label set but weak for retrieval, anomaly detection, or a new domain.`,
        `The second naive approach is reconstruction. An autoencoder can hide part of an image and train the network to rebuild pixels. Reconstruction gives a self-supervised signal, but it can spend capacity on low-level detail that is not semantically useful. A model can become good at color, texture, and local continuity without learning an embedding space where related objects are close. SimCLR shifts the target from "rebuild the pixels" to "learn invariances that make two views of the same image agree."`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that augmentations define identity. If two random crops, color distortions, and blurs come from the same image, SimCLR treats them as a positive pair. The model is trained to keep them close in representation space. Other images in the same batch become negatives, and the model is trained to keep them farther away. The task forces the encoder to keep information that survives the augmentations and ignore information that the augmentations deliberately disturb.`,
        `This is why augmentation is not decoration in SimCLR. It is the curriculum. A weak augmentation pipeline makes the task trivial because the two views are nearly identical. The model can win by matching pixels. An overly destructive pipeline makes the task noisy because the two views may no longer preserve the same semantic object. The useful middle is domain-specific: strong enough to prevent shortcuts, but not so strong that it changes the meaning of the example.`,
      ],
    },
    {
      heading: 'How the algorithm works',
      paragraphs: [
        `A training step starts with a minibatch of N images. Each image is augmented twice, producing 2N views. The two views from the same source image are the positive pair. Every other view in the batch is treated as a negative for that anchor. Both views pass through the same encoder, often a convolutional network, so the encoder weights are shared. The encoder output then passes through a projection head, usually a small MLP, to produce the vector used by the contrastive loss.`,
        `The loss used in SimCLR is commonly called NT-Xent: normalized temperature-scaled cross entropy. For one anchor view, the loss computes similarity between the anchor and its positive, then compares that score with similarities to all negatives in the batch. A softmax turns those similarities into a probability distribution. Temperature controls how sharply the model reacts to similarity differences. Low temperature makes the competition sharper; high temperature smooths it.`,
        `After pretraining, the projection head is often discarded. The representation before the projection head is kept as the general-purpose embedding. Researchers evaluate it with a linear probe, where the encoder is frozen and only a linear classifier is trained, or they fine-tune the encoder on a labeled downstream task. This separation matters. The projection head can specialize for the contrastive objective while the encoder learns features that transfer better.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The positive-pair view is proving that labels can be replaced by a designed agreement task. One image becomes two views. The shared encoder maps both views into representation space. The model is rewarded when their projected vectors are close. The important lesson is not that the image was copied twice. The lesson is that the data pipeline states which changes should not alter identity: crop, color shift, blur, resize, or other domain-specific transforms.`,
        `The batch-negatives view is proving that agreement alone is not enough. If the model only pulled positives together, it could collapse and map everything to the same vector. Negatives create pressure to preserve distinctions between examples. A large batch gives each anchor many alternatives to beat, making the contrastive classification problem harder and more informative. The loss therefore depends on both sides: positives define invariance, negatives define separation.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `SimCLR works when the augmentations preserve semantic identity better than they preserve shortcuts. Random cropping forces the model to connect local and global views of the same object. Color distortion prevents easy dependence on color histograms. Blur can reduce texture shortcuts. Because the positive pair shares identity but not exact pixels, the encoder must learn features that survive those changes. Those features are often useful for downstream tasks.`,
        `The batch comparison also shapes the embedding space. Each anchor has to identify its positive among many negatives, so the model learns a geometry where related views have high similarity and unrelated views have lower similarity. This connects SimCLR to embeddings and nearest-neighbor search. The representation is valuable not because it stores a class label, but because distance in the learned space begins to reflect visual relatedness.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `SimCLR is compute-hungry. Every image is processed twice, and the contrastive loss compares many pairs in the batch. Large batches help because they provide more negatives, but they require more accelerator memory and often distributed synchronization. Longer pretraining and larger encoders can improve representation quality, but they raise cost. Batch size, temperature, optimizer settings, and projection-head design are not minor details. They are part of the method's performance envelope.`,
        `The main design tradeoff is the augmentation policy. ImageNet-style random crops and color distortion do not transfer automatically to every domain. In medical imaging, color or intensity changes may remove clinically meaningful information. In satellite imagery, rotation may or may not preserve the label. In audio, text, graphs, or code, the right positive-pair construction is completely different. Contrastive learning is powerful, but it moves much of the burden into defining transformations that preserve meaning.`,
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        `SimCLR-style contrastive learning is used for visual pretraining, image retrieval, product search, face verification, anomaly detection, medical-image representation learning, remote sensing, robotics perception, and label-efficient transfer. It is also a conceptual ancestor of many multimodal systems. CLIP-like models use a related contrastive idea across image and text pairs, pulling matching captions and images together while pushing mismatches apart.`,
        `The embeddings produced by contrastive learning can feed practical systems. A retrieval service can find visually similar products. A clustering job can group unlabeled images for review. A small labeled dataset can train a linear probe on top of a frozen encoder. A downstream detector can fine-tune from a stronger initialization than random weights. The value is not only accuracy; it is reducing dependence on a large clean label set for every new task.`,
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        `The most common failure is a bad positive definition. If augmentations are too weak, the model learns low-level matching. If augmentations destroy the object, positives become contradictory. If the data pipeline creates artifacts, the model may learn the artifact instead of semantics. False negatives are another problem: two different images in the batch may show the same class or even nearly the same object, yet the loss pushes them apart because SimCLR does not know their labels.`,
        `Collapse is the extreme failure where embeddings become uninformative. SimCLR's negatives help prevent that, but the broader lesson is that self-supervised learning needs a mechanism that prevents trivial solutions. Transfer can also fail. A representation learned from consumer photos may not serve pathology slides, industrial defects, or satellite scenes without careful fine-tuning. Good SimCLR practice includes domain-specific augmentations, downstream evaluation, false-negative awareness, and comparison with supervised and non-contrastive baselines.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Read the SimCLR paper, the PMLR version, and the Google Research SimCLR repository for the original method and ablations. Then study Embeddings & Similarity, Convolution, Softmax & Temperature, Batch Size Scaling, K-Means Clustering, Product Quantization for Vector Search, and Attention Mechanism. The next useful question is how SimCLR differs from methods that remove explicit negatives, such as BYOL-style and masked-image-modeling approaches. That comparison clarifies which parts of representation learning come from invariance, separation, prediction, and scale.`,
      ],
    },
  ],
};
