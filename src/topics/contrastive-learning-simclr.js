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
  const pipelineNodes = ['img', 'crop1', 'crop2', 'enc1', 'enc2', 'z1', 'z2'];
  const numViews = 2;
  yield {
    state: simclrGraph('Two augmented views define the positive pair'),
    highlight: { active: ['img', 'crop1', 'crop2', 'e-img-crop1', 'e-img-crop2'], compare: ['z1', 'z2'] },
    explanation: `SimCLR starts without labels. It creates ${numViews} different augmented views of the same image across a ${pipelineNodes.length}-node pipeline. Those ${numViews} views are the positive pair: the model should learn that they represent the same underlying object.`,
  };

  yield {
    state: simclrGraph('The same encoder maps both views into representation space'),
    highlight: { active: ['enc1', 'enc2', 'e-crop1-enc1', 'e-crop2-enc2'], found: ['z1', 'z2'] },
    explanation: `Both ${numViews} views pass through the same encoder with shared weights. The projection head maps representations into the space where the contrastive loss is applied. The representation before the projection head is what downstream tasks usually keep.`,
    invariant: `Augmentations across ${numViews} views define what the model should ignore.`,
  };

  const augmentations = [
    { id: 'crop', label: 'random crop' },
    { id: 'color', label: 'color distortion' },
    { id: 'blur', label: 'blur' },
    { id: 'weak', label: 'too weak' },
  ];
  yield {
    state: labelMatrix(
      'Augmentation strength is the teaching signal',
      augmentations,
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
    explanation: `${augmentations.length} augmentation strategies are compared (${augmentations.map(a => a.label).join(', ')}). Simple cropping plus strong color distortion did more than fancy augmentation policies. The augmentations define the self-supervised task.`,
  };

  const stages = [
    { id: 'pretrain', label: 'self-supervised pretrain' },
    { id: 'linear', label: 'linear probe' },
    { id: 'finetune', label: 'fine-tune' },
    { id: 'deploy', label: 'downstream model' },
  ];
  yield {
    state: labelMatrix(
      'After pretraining, labels become cheaper',
      stages,
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
    explanation: `Contrastive learning separates representation learning from label-heavy training across ${stages.length} stages (${stages.map(s => s.label).join(' -> ')}). The encoder learns reusable visual features before the task-specific classifier sees labels.`,
  };
}

function* batchNegatives() {
  const batchViews = [
    { id: 'cat1', label: 'cat view 1' },
    { id: 'cat2', label: 'cat view 2' },
    { id: 'dog1', label: 'dog view 1' },
    { id: 'car1', label: 'car view 1' },
  ];
  const numNegPerAnchor = batchViews.length - 2; // exclude self and positive
  yield {
    state: labelMatrix(
      'Every other view in the batch is a negative',
      batchViews,
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
    explanation: `With ${batchViews.length} views in this batch, each anchor gets 1 positive and ${numNegPerAnchor} negatives. The contrastive loss pulls the positive pair together and pushes all other examples apart. Bigger batches provide more negatives.`,
  };

  const lossComponents = [
    { id: 'pos', label: 'positive similarity' },
    { id: 'neg', label: 'negative similarities' },
    { id: 'temp', label: 'temperature' },
    { id: 'loss', label: 'loss' },
  ];
  yield {
    state: labelMatrix(
      'NT-Xent loss intuition',
      lossComponents,
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
    explanation: `SimCLR uses a softmax-style contrastive loss with ${lossComponents.length} components (${lossComponents.map(c => c.label).join(', ')}). The positive pair should win against all negatives. Temperature controls how sharply similarity differences affect the probabilities.`,
    invariant: `The loss needs both a positive pair and a set of ${numNegPerAnchor} negatives per anchor in this ${batchViews.length}-view batch.`,
  };

  const batchFactors = [
    { id: 'negatives', label: 'negative examples' },
    { id: 'coverage', label: 'semantic coverage' },
    { id: 'compute', label: 'compute cost' },
    { id: 'memory', label: 'memory cost' },
  ];
  yield {
    state: labelMatrix(
      'Why large batch helps contrastive learning',
      batchFactors,
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
    explanation: `${batchFactors.length} factors (${batchFactors.map(f => f.label).join(', ')}) change with batch size. Large batches make the self-supervised classification problem harder and more informative.`,
  };

  const failureModes = [
    { id: 'shortcut', label: 'augmentation shortcut' },
    { id: 'false', label: 'false negatives' },
    { id: 'collapse', label: 'representation collapse' },
    { id: 'transfer', label: 'bad transfer' },
  ];
  yield {
    state: labelMatrix(
      'Failure modes',
      failureModes,
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
    explanation: `Self-supervision has ${failureModes.length} failure modes (${failureModes.map(f => f.label).join(', ')}). The pretext task teaches exactly the invariances and distinctions encoded by augmentations, negatives, and data distribution.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. The "positive pairs" view traces a single image through SimCLR\'s pipeline: augment twice, encode both views with a shared encoder, project into contrastive space, and pull the projections together. Active (highlighted) nodes show the current stage; the compare color marks the projection targets the loss will act on. The "batch negatives" view zooms out to the full batch: a similarity matrix shows which pairs are positive (same source image) and which are negative (different images). Found cells are the positive pairs the model must identify; removed cells are negatives the model must push apart.',
        {type: 'image', src: './assets/gifs/contrastive-learning-simclr.gif', alt: 'Animated walkthrough of the contrastive learning simclr visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Each step explanation names the invariant or design choice being shown. When the explanation says "shared weights," that means the same encoder processes both augmented views, so the representation must work for any augmentation the pipeline can produce. When it says "pull close" on the final edge, that is the contrastive loss objective: high cosine similarity between positive projections, low similarity between everything else.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Training a deep vision model the standard way requires labeled data. A hospital may have ten million chest X-rays but only fifty thousand with radiologist annotations. A warehouse robot streams millions of frames per day; almost none carry task labels. Labeling is slow, expensive, subjective, and always narrower than the visual world the model will encounter at deployment. The question SimCLR answers is whether a neural network can learn useful visual features from raw images alone, before any human labels it.',
        {type: `callout`, text: `SimCLR learns useful visual features by making two augmented views agree while the rest of the batch supplies contrast.`},
        'SimCLR (Simple Framework for Contrastive Learning of Visual Representations) was published by Ting Chen, Simon Kornblith, Mohammad Norouzi, and Geoffrey Hinton at Google Research in 2020. It showed that a straightforward contrastive setup, with no special architectures or memory banks, could match supervised pretraining on ImageNet when the encoder was large enough and the batch was big enough. The core move is to create a training signal from the structure of the data itself: take one image, distort it two different ways, and train the model to recognize that those two distortions came from the same source.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable attempt is supervised pretraining. Collect a large labeled dataset like ImageNet (1.28 million images, 1,000 classes), train a classifier end-to-end, then transfer the learned encoder to a new task by fine-tuning or freezing it. This works well when the label set is large, diverse, and aligned with the target domain. It has been the dominant recipe since AlexNet in 2012.',
        'The second reasonable attempt is pixel-level self-supervision. An autoencoder masks or corrupts part of an image and trains the network to reconstruct the missing pixels. This produces a training signal without labels. Denoising autoencoders, inpainting, and colorization all follow this pattern. The network learns something about visual statistics because it must predict plausible pixels, and the signal is free.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Supervised pretraining hits a label wall. Every new domain needs new labels. A model pretrained on ImageNet consumer photos may not transfer well to satellite imagery, histopathology, or industrial inspection. Even within the same domain, the label set can be too narrow: a model trained to classify 1,000 object categories does not necessarily learn features that separate materials, textures, poses, or spatial relationships that matter for a downstream task the labels never mentioned.',
        'Reconstruction-based self-supervision hits a different wall: it optimizes for pixel fidelity, not semantic structure. A model can become excellent at reconstructing colors, textures, and local patterns while learning an embedding space where a red car and a red fire truck are closer than a red car and a blue car. Pixel-level loss rewards low-level statistics. It does not directly reward learning that two different crops of the same dog are the same dog. SimCLR\'s contrastive loss targets exactly that semantic invariance by operating in representation space rather than pixel space.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Augmentations define identity. If two random crops, color distortions, and Gaussian blurs come from the same image, they are declared to be the same thing. The model is trained to produce similar representations for those two views. Every other image in the batch is declared to be different, and the model is trained to produce dissimilar representations for those. The encoder never sees a class label. Instead, the augmentation pipeline implicitly tells the model what should and should not change identity: viewpoint, color palette, scale, and blur are noise; object shape, structure, and spatial layout are signal.',
        {type: `image`, src: `https://lilianweng.github.io/posts/2021-05-31-contrastive/SimCLR.png`, alt: `SimCLR framework diagram with two augmented views encoded and projected before maximizing agreement`, caption: `The SimCLR diagram makes the positive-pair contract explicit: two transforms from one image should agree in projection space. Source: Lilian Weng, https://lilianweng.github.io/posts/2021-05-31-contrastive/.`},
        'This makes augmentation choice the most important design decision in the entire system. Weak augmentation (a small crop shift, no color change) makes the task trivially easy: the two views are nearly identical, so the model can succeed by matching raw pixels. The encoder learns nothing transferable. Overly destructive augmentation (extreme crops that lose the object entirely, color inversion that changes semantics) makes the positive pair contradictory: the model is forced to agree that two unrelated patches are the same, so it learns noise. The useful regime is in between: augmentations strong enough that the model cannot cheat with pixel matching, but preserving enough of the semantic content that the agreement objective is meaningful.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A single training step proceeds as follows. Start with a minibatch of N images. Apply two independent random augmentations to each image, producing 2N augmented views. For a batch of 256 images, that is 512 views. Each augmented view passes through the same encoder (typically a ResNet-50), producing a representation vector h. That representation then passes through a projection head (a two-layer MLP with ReLU), producing a smaller vector z in the contrastive space. The loss is computed on z, but the downstream-useful representation is h.',
        'The loss function is NT-Xent (Normalized Temperature-scaled Cross-Entropy). For a single anchor view z_i whose positive partner is z_j, the loss is: L = -log( exp(sim(z_i, z_j) / tau) / sum_k exp(sim(z_i, z_k) / tau) ), where the sum runs over all 2N-1 other views in the batch (excluding the anchor itself), sim is cosine similarity, and tau is a temperature scalar. This is a (2N-1)-way classification problem: the model must identify which of the 2N-1 other views is the positive, with all others treated as negatives. The loss is computed symmetrically for both views in every positive pair, then averaged.',
        {type: `image`, src: `https://lilianweng.github.io/posts/2021-05-31-contrastive/SimCLR-algo.png`, alt: `SimCLR algorithm pseudocode showing two augmentations per sample, encoder, projector, pairwise similarity, and contrastive loss`, caption: `The algorithm view shows that every batch creates 2N views, pairwise similarities, and two symmetric losses per original image. Source: Lilian Weng, https://lilianweng.github.io/posts/2021-05-31-contrastive/.`},
        'Temperature tau controls the sharpness of the softmax distribution. Low tau (e.g., 0.05) makes the loss very sensitive to small similarity differences: the model is penalized harshly unless the positive is the clear winner. High tau (e.g., 1.0) flattens the distribution, tolerating more ambiguity. SimCLR found tau = 0.5 worked best on ImageNet, but the right value depends on the embedding dimension and the difficulty of the negatives.',
        'After contrastive pretraining is complete, the projection head is discarded. The encoder output h is the learned representation. Evaluation uses either a linear probe (freeze the encoder, train a linear classifier on labeled data) or full fine-tuning. The projection head acts as a buffer: it absorbs task-specific pressure from the contrastive loss so the encoder can learn more general features. Chen et al. showed that the representation before the projection head transfers substantially better than the representation after it.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument has two parts: invariance from positives and separation from negatives. Positives teach invariance: the encoder must map augmented views of the same image to nearby points. Because augmentations change low-level properties (color, crop, blur) while preserving high-level content (objects, layout), the encoder is forced to encode the high-level content to succeed at the task. Features that survive random cropping plus strong color distortion tend to be shape-based and object-level, which is exactly what downstream classifiers need.',
        'Negatives teach separation: if the model only pulled positives together without negative pressure, it could collapse by mapping every input to the same constant vector. That constant vector trivially achieves zero positive-pair distance, but it is useless. Negatives prevent collapse by penalizing the model when unrelated views are too similar. Each anchor must identify its positive among 2N-2 negatives, so the encoder must learn a geometry where different images occupy different regions of the embedding space. More negatives make this classification harder and more informative, which is why SimCLR benefits from large batches.',
        'A deeper reason SimCLR works connects to mutual information. The contrastive loss is a lower bound on the mutual information between the two views. Maximizing this bound forces the encoder to preserve information that is shared between augmented views (semantic content) while discarding information that is not shared (augmentation-specific noise). The projection head helps by providing a low-dimensional bottleneck where this information selection happens before the loss is applied.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each training step processes 2N views through the encoder and projection head, then computes a 2N x 2N similarity matrix. For a batch of N=4096 (the size used in the original paper), that is 8,192 forward passes and a similarity matrix with ~67 million entries per step. The encoder is typically a ResNet-50 with ~23 million parameters. The projection head adds a small MLP. The pairwise similarity computation is O(N^2 * d) where d is the projection dimension (128 in the original).',
        'Memory scales with batch size. Storing 8,192 projection vectors of dimension 128 in float32 costs about 4 MB, which is small. But storing the activations for 8,192 forward passes through a ResNet-50 for backpropagation is the real cost, requiring distributed training across multiple GPUs. The original SimCLR used 32 to 128 Cloud TPU cores. Training ran for 100 epochs on ImageNet, taking roughly 1.5 to 3 hours per epoch on 128 TPUs. Doubling the batch from 256 to 4096 improved top-1 linear evaluation accuracy from ~64% to ~69% on ImageNet, but required 16x more accelerator memory.',
        'The augmentation pipeline itself is cheap: random crop, color jitter, and Gaussian blur are CPU-bound image transforms that cost microseconds per image. The dominant cost is always the encoder forward and backward passes. After pretraining, the projection head is thrown away and the encoder is used directly, so inference cost is identical to any standard ResNet.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Medical imaging is a natural fit because labels require expert clinicians. A hospital can pretrain a SimCLR encoder on millions of unlabeled chest X-rays, then fine-tune a classifier on the few thousand that have radiologist annotations. Google Health used contrastive pretraining for dermatology and retinal imaging tasks where labeled data was a small fraction of available scans.',
        'Visual search and retrieval systems use SimCLR-style embeddings to find similar products, detect near-duplicates, or cluster images without predefined categories. Pinterest, for example, uses contrastive visual representations for recommendation. The key property is that the encoder learns a metric space where cosine distance correlates with visual similarity, so nearest-neighbor lookup becomes a product search engine without per-product labels.',
        'Robotics and autonomous systems use contrastive pretraining to learn visual features from the continuous stream of unlabeled video frames a robot collects during operation. The features transfer to downstream tasks like object grasping, navigation, and scene understanding with far less labeled demonstration data. SimCLR is also a conceptual ancestor of CLIP, which extends the contrastive idea to image-text pairs: instead of two augmented views, the positive pair is a matching image and caption. CLIP\'s success in zero-shot classification and text-guided retrieval traces directly back to the contrastive framework SimCLR established.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'False negatives are the most insidious failure mode. Two images in the same batch may show the same class, or even nearly the same scene. SimCLR treats them as negatives because it has no labels. The loss pushes their representations apart, actively harming the embedding for that category. With 4,096 images per batch drawn from a 1,000-class dataset, the expected number of same-class negative pairs per anchor is about 8. This problem worsens with smaller datasets or datasets with fewer, broader classes.',
        'Augmentation shortcuts appear when the augmentation pipeline leaves an easy-to-detect artifact. If random cropping always preserves a corner watermark, the model can match positives by detecting the watermark rather than learning object semantics. If color distortion is too mild, the model can succeed by matching color histograms. The SimCLR paper showed that removing color distortion dropped linear probe accuracy by about 8 percentage points on ImageNet because the model learned a color-histogram shortcut.',
        'Representation collapse happens when the encoder maps all inputs to the same region of embedding space. SimCLR\'s negatives prevent total collapse (the loss would be maximally bad), but partial collapse, where the representation ignores important axes of variation, can still occur. Domain transfer is another limit: an encoder pretrained on ImageNet consumer photos may learn features (textures, object shapes, indoor/outdoor cues) that are irrelevant to pathology slides or satellite imagery. Contrastive pretraining does not guarantee that the learned features will transfer; it only guarantees that the features capture invariances defined by the augmentation pipeline on the pretraining distribution.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a batch has N=4 images: a cat, a dog, a car, and a tree. SimCLR augments each twice, producing 8 views: cat-a, cat-b, dog-a, dog-b, car-a, car-b, tree-a, tree-b. Each view passes through the encoder (ResNet-50) and projection head (2-layer MLP), producing 8 projection vectors of dimension 128.',
        'Take cat-a as the anchor. Its positive is cat-b (same source image). Its negatives are dog-a, dog-b, car-a, car-b, tree-a, tree-b (6 negatives). Compute cosine similarity between cat-a and all 7 other views. Suppose the similarities are: cat-b = 0.85, dog-a = 0.30, dog-b = 0.25, car-a = 0.10, car-b = 0.12, tree-a = 0.15, tree-b = 0.18.',
        'With tau = 0.5, the NT-Xent numerator is exp(0.85 / 0.5) = exp(1.7) = 5.47. The denominator sums over all 7: exp(1.7) + exp(0.60) + exp(0.50) + exp(0.20) + exp(0.24) + exp(0.30) + exp(0.36) = 5.47 + 1.82 + 1.65 + 1.22 + 1.27 + 1.35 + 1.43 = 14.21. The loss for this anchor is -log(5.47 / 14.21) = -log(0.385) = 0.955. A perfect model would push the denominator terms toward zero and the positive similarity toward 1.0, driving the loss toward zero. The same computation runs symmetrically for cat-b as anchor (with cat-a as its positive), and for every other view in the batch. The total loss averages all 8 anchor losses.',
        'After pretraining on millions of images for hundreds of epochs, the projection head is discarded. The encoder output h (2,048 dimensions for ResNet-50) is the learned representation. A linear probe trained on this frozen representation achieved 69.3% top-1 accuracy on ImageNet in the original SimCLR paper, compared to 76.5% for a fully supervised ResNet-50. SimCLR v2 with a larger encoder (ResNet-152, 4x width) and semi-supervised fine-tuning closed the gap further, reaching 76.8% with only 1% of ImageNet labels.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The primary source is "A Simple Framework for Contrastive Learning of Visual Representations" by Chen, Kornblith, Norouzi, and Hinton (ICML 2020, arXiv:2002.05709). The follow-up, SimCLR v2, is "Big Self-Supervised Models are Strong Semi-Supervised Learners" (NeurIPS 2020, arXiv:2006.10029). Google Research released the official implementation at github.com/google-research/simclr. Lilian Weng\'s survey "Contrastive Representation Learning" (lilianweng.github.io/posts/2021-05-31-contrastive) provides excellent context across the contrastive learning family.',
        'For prerequisites, study Embeddings and Similarity (cosine similarity, metric spaces), Convolution (the encoder architecture), and Softmax and Temperature (the NT-Xent loss mechanics). For extensions, study BYOL and Barlow Twins to understand how negative-free methods avoid collapse without explicit negatives. Study CLIP to see how contrastive learning extends to image-text pairs. Study K-Means Clustering and Product Quantization to understand how contrastive embeddings are used in retrieval systems at scale. The central question connecting these topics is: what makes a good representation, and how much of that can be learned without human labels?',
      ],
    },
  ],
};
