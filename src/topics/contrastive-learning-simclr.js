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
      heading: 'What it is',
      paragraphs: [
        'SimCLR is a contrastive self-supervised learning framework. It learns visual representations without human labels by creating two augmented views of the same image and training the encoder to place those two views close together while pushing views from other images away. The model is not told "this is a dog." It is told "these two distorted views came from the same source image; those others did not."',
        'The local notes highlight the key teaching point: data augmentation is not a side trick here. It defines the learning task. Random cropping, resizing, color distortion, and blur tell the encoder what variation should be ignored. If the augmentations are too weak, the task is trivial. If they destroy the semantic object, the task becomes noisy.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A minibatch of images is augmented twice, producing two views per image. Both views pass through the same Convolution encoder and then through a projection MLP. The NT-Xent loss compares each view against the other views in the batch. Its positive is the sibling view from the same image. Its negatives are the views from other images. Softmax & Temperature controls how sharply similarity scores are converted into probabilities.',
        'After pretraining, the projection head is often discarded and the encoder representation is evaluated with a linear probe or fine-tuned on a labeled task. This is why contrastive learning connects to Embeddings & Similarity: it shapes a space where semantic closeness becomes geometric closeness.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'SimCLR benefits from large batches because more examples provide more negatives. That creates a richer classification problem but raises accelerator memory and synchronization costs. The paper also reports benefits from more training steps and larger models. This links the method to Batch Size Scaling: self-supervised representation learning can be more hungry for batch and compute than the supervised baseline.',
        'The biggest design cost is choosing augmentations. Strong color distortion helped in SimCLR because color can be a shortcut. Random cropping helped define global and local views without specialized architecture. But different domains need different invariances. Medical images, satellite images, code, audio, and product photos should not inherit ImageNet augmentations blindly.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Contrastive learning appears in vision pretraining, image retrieval, multimodal embedding models, recommendation, audio representation learning, face verification, anomaly detection, and weak-label settings where labels are expensive. CLIP-like systems extend the same pull-together/push-apart idea across text and images, while RAG and vector search systems consume the resulting embedding spaces.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The main misconception is that self-supervised means assumption-free. It is full of assumptions: which augmentations preserve identity, which negatives are truly different, which projection head is used, how large the batch is, and which downstream task will judge the representation. False negatives can push semantically similar examples apart. A model can also learn augmentation artifacts rather than semantic features if the pipeline leaks shortcuts.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: SimCLR at https://arxiv.org/abs/2002.05709, the PMLR paper at https://proceedings.mlr.press/v119/chen20j.html, and the Google Research SimCLR repository at https://github.com/google-research/simclr. Study Embeddings & Similarity, Convolution, Softmax & Temperature, Batch Size Scaling, K-Means Clustering, and Product Quantization for Vector Search next.',
      ],
    },
  ],
};
