// Vision Transformer registers: extra learned tokens give ViTs a dedicated
// workspace so background patch tokens do not become accidental scratchpads.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'vision-transformer-register-tokens-case-study',
  title: 'Vision Transformer Register Tokens',
  category: 'Papers',
  summary: 'Register tokens as dedicated ViT workspace: high-norm background artifacts, smoother feature maps, cleaner attention, and the data structures needed to serve them.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['artifact sink', 'register tokens'], defaultValue: 'artifact sink' },
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

function vitGraph(title, withRegisters = false) {
  const nodes = [
    { id: 'image', label: 'image', x: 0.4, y: 3.8, note: 'pixels' },
    { id: 'patch', label: 'patches', x: 2.3, y: 3.8, note: 'grid' },
    { id: 'cls', label: 'CLS', x: 3.6, y: 2.4, note: 'global' },
    { id: 'block', label: 'ViT', x: 5.4, y: 3.8, note: 'blocks' },
    { id: 'map', label: 'feat map', x: 7.5, y: 3.8, note: 'dense' },
    { id: 'head', label: 'head', x: 9.3, y: 3.8, note: 'task' },
  ];
  const edges = [
    { id: 'e-image-patch', from: 'image', to: 'patch', weight: '' },
    { id: 'e-patch-block', from: 'patch', to: 'block', weight: '' },
    { id: 'e-cls-block', from: 'cls', to: 'block', weight: '' },
    { id: 'e-block-map', from: 'block', to: 'map', weight: '' },
    { id: 'e-map-head', from: 'map', to: 'head', weight: '' },
  ];
  if (withRegisters) {
    nodes.splice(3, 0, { id: 'regs', label: 'regs', x: 3.6, y: 5.2, note: 'scratch' });
    edges.splice(3, 0, { id: 'e-regs-block', from: 'regs', to: 'block', weight: '' });
  } else {
    nodes.splice(4, 0, { id: 'sink', label: 'bg sink', x: 5.3, y: 5.5, note: 'high norm' });
    edges.splice(4, 0, { id: 'e-block-sink', from: 'block', to: 'sink', weight: 'stash' });
    edges.splice(5, 0, { id: 'e-sink-map', from: 'sink', to: 'map', weight: 'artifact' });
  }
  return graphState({ nodes, edges }, { title });
}

function* artifactSink() {
  yield {
    state: labelMatrix(
      'Background patches become accidental workspace',
      [
        { id: 'object', label: 'object' },
        { id: 'edge', label: 'edge' },
        { id: 'sky', label: 'sky' },
        { id: 'sand', label: 'sand' },
        { id: 'blank', label: 'blank' },
      ],
      [
        { id: 'info', label: 'info' },
        { id: 'norm', label: 'norm' },
        { id: 'role', label: 'role' },
      ],
      [
        ['high', 'normal', 'semantic'],
        ['medium', 'normal', 'boundary'],
        ['low', 'spike', 'scratch'],
        ['low', 'spike', 'scratch'],
        ['low', 'spike', 'scratch'],
      ],
    ),
    highlight: { active: ['sky:norm', 'sand:norm', 'blank:norm'], compare: ['object:norm', 'edge:norm'] },
    explanation: 'The register-token paper identifies a strange ViT behavior: low-information background patches can become high-norm tokens during inference, apparently repurposed as internal computation workspace.',
  };

  yield {
    state: vitGraph('Without registers, a patch token may become a sink'),
    highlight: { active: ['sink', 'e-block-sink', 'e-sink-map'], found: ['map'], compare: ['patch'] },
    explanation: 'A normal ViT has patch tokens plus a classification token. If the model needs extra scratch space, it may overload a boring background patch. That pollutes feature maps used by dense downstream tasks.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'layer', min: 0, max: 24 }, y: { label: 'token norm', min: 0, max: 18 } },
      series: [
        { id: 'object', label: 'object', points: [
          { x: 1, y: 4 }, { x: 6, y: 5 }, { x: 12, y: 6 }, { x: 18, y: 7 }, { x: 24, y: 8 },
        ] },
        { id: 'bg', label: 'bg sink', points: [
          { x: 1, y: 3 }, { x: 6, y: 4 }, { x: 12, y: 6 }, { x: 18, y: 13 }, { x: 24, y: 16 },
        ] },
      ],
      markers: [
        { id: 'late', x: 19, y: 13, label: 'late spike' },
      ],
    }),
    highlight: { active: ['bg', 'late'], compare: ['object'] },
    explanation: 'The artifact shows up as a late-layer norm spike in background tokens. The patch still occupies a spatial cell, so its internal scratch role leaks into maps and attention visualizations.',
  };

  yield {
    state: labelMatrix(
      'Artifact symptoms',
      [
        { id: 'norm', label: 'high norm' },
        { id: 'attn', label: 'attn spot' },
        { id: 'map', label: 'map hole' },
        { id: 'disc', label: 'discover' },
        { id: 'dense', label: 'dense task' },
      ],
      [
        { id: 'seen', label: 'seen as' },
        { id: 'harm', label: 'harm' },
      ],
      [
        ['outlier', 'false sal'],
        ['bright dot', 'bad cue'],
        ['rough map', 'bad pixel'],
        ['object miss', 'weak masks'],
        ['noisy feat', 'lower score'],
      ],
    ),
    highlight: { active: ['norm:harm', 'attn:harm', 'map:harm'], found: ['dense:harm'] },
    explanation: 'The problem is not just aesthetic. High-norm background outliers can create spurious saliency, rough feature maps, weaker object discovery, and worse dense visual prediction.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'patchA', label: 'object', x: 0.8, y: 2.3, note: 'dog' },
        { id: 'patchB', label: 'sky', x: 0.8, y: 5.3, note: 'plain' },
        { id: 'attn', label: 'attention', x: 3.0, y: 3.8, note: 'global' },
        { id: 'sink', label: 'sink', x: 5.2, y: 5.3, note: 'stash' },
        { id: 'feat', label: 'features', x: 7.4, y: 3.8, note: 'map' },
        { id: 'mask', label: 'mask', x: 9.0, y: 3.8, note: 'object' },
      ],
      edges: [
        { id: 'e-patchA-attn', from: 'patchA', to: 'attn', weight: 'content' },
        { id: 'e-patchB-attn', from: 'patchB', to: 'attn', weight: 'empty' },
        { id: 'e-attn-sink', from: 'attn', to: 'sink', weight: 'store' },
        { id: 'e-sink-feat', from: 'sink', to: 'feat', weight: 'leak' },
        { id: 'e-feat-mask', from: 'feat', to: 'mask', weight: 'decode' },
      ],
    }, { title: 'The model uses a low-information patch as a scratch slot' }),
    highlight: { active: ['patchB', 'sink', 'e-attn-sink', 'e-sink-feat'], compare: ['patchA'], found: ['mask'] },
    explanation: 'The paper interprets these patches as repurposed registers: the model finds spatial positions with little image information and uses them for internal bookkeeping. The fix is to provide explicit slots for that role.',
  };

  yield {
    state: labelMatrix(
      'Observed model families',
      [
        { id: 'dino', label: 'DINOv2' },
        { id: 'clip', label: 'OpenCLIP' },
        { id: 'deit', label: 'DeiT-III' },
        { id: 'dense', label: 'dense' },
      ],
      [
        { id: 'issue', label: 'issue' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['artifacts', 'need slots'],
        ['artifacts', 'not enough'],
        ['artifacts', 'supervised too'],
        ['rough maps', 'registers help'],
      ],
    ),
    highlight: { active: ['dino:issue', 'clip:issue', 'dense:lesson'], compare: ['deit:lesson'] },
    explanation: 'The paper studies supervised and self-supervised ViTs and shows the register-token fix on dense visual prediction and object discovery. The lesson is architectural: give the model workspace instead of hoping patches stay pure.',
  };
}

function* registerTokens() {
  yield {
    state: vitGraph('Register tokens provide explicit scratch space', true),
    highlight: { active: ['regs', 'e-regs-block', 'block'], found: ['map'], compare: ['patch'] },
    explanation: 'Registers are extra learned tokens appended to the ViT input sequence. They participate in attention during the transformer blocks, but downstream dense heads can ignore them and read smoother patch features.',
    invariant: 'Registers are model workspace tokens; they are not image patches.',
  };

  yield {
    state: labelMatrix(
      'Register-token data structures',
      [
        { id: 'embed', label: 'reg embed' },
        { id: 'seq', label: 'seq buf' },
        { id: 'mask', label: 'attn mask' },
        { id: 'drop', label: 'drop idx' },
        { id: 'count', label: 'reg count' },
        { id: 'stats', label: 'stats' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['learned vecs', 'bad init'],
        ['patch+regs', 'shape bug'],
        ['visible', 'leak rule'],
        ['ignore regs', 'bad head'],
        ['k regs', 'cost creep'],
        ['norm maps', 'silent drift'],
      ],
    ),
    highlight: { active: ['embed:stores', 'seq:stores', 'drop:stores'], found: ['stats:risk'] },
    explanation: 'The implementation burden is small but concrete: learned register embeddings, a sequence layout, attention visibility, output indices to discard registers, a fixed register count, and feature-map telemetry.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'register tokens', min: 0, max: 8 }, y: { label: 'artifact score', min: 0, max: 10 } },
      series: [
        { id: 'artifact', label: 'artifact', points: [
          { x: 0, y: 9 }, { x: 1, y: 5 }, { x: 2, y: 2.5 }, { x: 4, y: 1 }, { x: 8, y: 0.8 },
        ] },
        { id: 'cost', label: 'seq cost', points: [
          { x: 0, y: 1 }, { x: 1, y: 1.5 }, { x: 2, y: 2 }, { x: 4, y: 3 }, { x: 8, y: 5 },
        ] },
      ],
      markers: [
        { id: 'knee', x: 4, y: 1, label: 'knee' },
      ],
    }),
    highlight: { active: ['artifact', 'knee'], compare: ['cost'] },
    explanation: 'Registers are not free. Each extra token joins attention. The practical question is how many registers remove artifacts before sequence cost starts to dominate.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'set', label: 'Set Xfmr', x: 0.7, y: 2.1, note: 'I pts' },
        { id: 'perc', label: 'Perceiver', x: 0.7, y: 5.4, note: 'latents' },
        { id: 'regs', label: 'registers', x: 3.2, y: 3.8, note: 'scratch' },
        { id: 'tape', label: 'AdaTape', x: 5.7, y: 2.1, note: 'tape' },
        { id: 'cls', label: 'CLS', x: 5.7, y: 5.4, note: 'global' },
        { id: 'lesson', label: 'lesson', x: 8.2, y: 3.8, note: 'slots' },
      ],
      edges: [
        { id: 'e-set-regs', from: 'set', to: 'regs', weight: 'learned' },
        { id: 'e-perc-regs', from: 'perc', to: 'regs', weight: 'memory' },
        { id: 'e-regs-tape', from: 'regs', to: 'tape', weight: 'tokens' },
        { id: 'e-regs-cls', from: 'regs', to: 'cls', weight: 'seq' },
        { id: 'e-regs-lesson', from: 'regs', to: 'lesson', weight: 'workspace' },
      ],
    }, { title: 'Register tokens are a learned memory-slot design' }),
    highlight: { active: ['regs', 'lesson'], compare: ['set', 'perc', 'tape'] },
    explanation: 'Registers belong to the same family as inducing points, Perceiver latents, and AdaTape tokens. They are explicit learned memory slots, but specialized for avoiding accidental scratch use inside ViT patch grids.',
  };

  yield {
    state: labelMatrix(
      'Deployment checklist',
      [
        { id: 'train', label: 'train' },
        { id: 'infer', label: 'infer' },
        { id: 'head', label: 'heads' },
        { id: 'export', label: 'export' },
        { id: 'watch', label: 'watch' },
      ],
      [
        { id: 'must', label: 'must do' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['include regs', 'mismatch'],
        ['same k', 'shape fail'],
        ['drop regs', 'bad map'],
        ['name slots', 'API drift'],
        ['norm maps', 'regress'],
      ],
    ),
    highlight: { active: ['train:must', 'infer:must', 'head:must'], found: ['watch:failure'] },
    explanation: 'The train and inference sequence shape must match. Dense heads should know which indices are patches and which are registers. Exported models need stable names for register count and sequence layout.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'zero', label: 'no regs' },
        { id: 'few', label: 'too few' },
        { id: 'many', label: 'too many' },
        { id: 'head', label: 'bad head' },
        { id: 'shift', label: 'domain' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['artifacts', 'add slots'],
        ['some spikes', 'raise k'],
        ['latency', 'cap k'],
        ['reg in map', 'drop idx'],
        ['new spikes', 'monitor'],
      ],
    ),
    highlight: { active: ['zero:fix', 'few:fix', 'head:fix'], compare: ['many:symptom'] },
    explanation: 'Registers are a clean fix only when the rest of the pipeline understands them. Too few leaves artifacts; too many spends tokens; and a dense head that treats registers like image patches reintroduces the bug.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'artifact sink') yield* artifactSink();
  else if (view === 'register tokens') yield* registerTokens();
  else throw new InputError('Pick a register-token view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation traces how a Vision Transformer processes an image. Image patches appear as tokens entering a sequence. Position embeddings are added to encode spatial location. Attention maps show which patches attend to which others across transformer layers. The CLS token aggregates a whole-image representation for classification.',
        'Active markers highlight the current processing step: patch extraction, embedding projection, position encoding, or attention computation. Found markers show outputs that are now determined. Compare markers contrast baseline ViT behavior against register-token augmented models.',
        'Watch how attention gives every patch global context from the first layer. In a CNN, a patch at the corner cannot see the opposite corner until many layers of convolution expand the receptive field. In a ViT, that same patch attends to every other patch immediately.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Convolutional neural networks dominated image recognition from AlexNet (2012) through EfficientNet (2019). They build spatial hierarchies by stacking small local filters, gradually expanding the receptive field. Dosovitskiy et al. asked a direct question in 2020: can a pure transformer, with no convolution at all, match or beat CNNs on image classification? The answer was ViT -- the Vision Transformer.',
        'The motivation was architectural unification. Transformers had already replaced RNNs for language. If the same architecture could handle images, a single design pattern would cover text, images, video, and audio. That simplification matters for research velocity, multi-modal models, and transfer learning across domains.',
        'ViT proved the answer is yes, but with a caveat: it needs more data than CNNs to reach the same accuracy. Trained on ImageNet-21k (14 million images) or JFT-300M (300 million images), ViT-Huge reached 90.45% top-1 accuracy on ImageNet, beating the best CNNs. Trained on ImageNet-1k alone (1.3 million images), it underperformed a well-tuned ResNet.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'CNNs are the obvious tool for image recognition. A ResNet-152 stacks 152 layers of 3x3 convolutions with skip connections. Each layer looks at a small local neighborhood, detects edges, textures, parts, and objects in a hierarchy. EfficientNet-B7 reached 84.4% top-1 on ImageNet with careful architecture search over width, depth, and resolution.',
        'The CNN approach works because images have strong local structure. A cat ear is made of edges, which are made of pixels. Local filters naturally capture this hierarchy. Translation equivariance comes for free: a filter that detects a vertical edge at one position detects the same edge at every position. Weight sharing across spatial positions keeps parameter counts manageable.',
        'For years this was enough. CNNs improved through deeper networks (VGG, ResNet), wider networks (WideResNet), architecture search (NASNet, EfficientNet), and attention modules bolted onto convolutional backbones (SE-Net, CBAM). The architecture was assumed necessary for vision.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'CNN receptive fields grow slowly. A 3x3 convolution sees 3x3 pixels. Two layers see 5x5. Ten layers see 21x21. To cover a 224x224 image, a CNN needs dozens of layers, and even then the effective receptive field -- the region that actually influences the output -- is often smaller than the theoretical maximum. Global context requires either very deep networks or explicit global pooling.',
        'Attention modules like SE-Net (channel attention) and CBAM (spatial + channel attention) were bolted onto CNNs to compensate. They help, but they are additions to an architecture that was not designed around attention. The convolution still does the heavy lifting; attention adjusts the result. There is no native mechanism for a pixel in the top-left corner to directly influence a pixel in the bottom-right corner in a single layer.',
        'Multi-modal learning exposed another wall. Language models use transformers. If vision uses CNNs, combining them requires adapters, projection layers, and architectural compromises. A shared transformer backbone for both vision and language would simplify architectures like CLIP, Flamingo, and GPT-4V.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'ViT splits an image into a grid of fixed-size patches. For a 224x224 image with 16x16 patches, that is 14 rows times 14 columns, producing 196 patches. Each patch is 16x16x3 = 768 values (height times width times RGB channels). A linear projection maps each flattened patch to an embedding vector of dimension D (typically 768 for ViT-Base).',
        'A learnable CLS token is prepended to the sequence, making 197 tokens total. Learned position embeddings are added to every token, including CLS, so the transformer knows spatial arrangement. Without position embeddings, the model would treat the patches as an unordered set and lose all spatial information.',
        'The token sequence passes through L transformer encoder layers (12 for ViT-Base, 24 for ViT-Large, 32 for ViT-Huge). Each layer applies multi-head self-attention followed by an MLP block, with layer normalization and residual connections. The attention mechanism lets every patch attend to every other patch, giving global receptive field from layer one.',
        'For classification, the final CLS token output feeds into a small MLP head that produces class probabilities. The CLS token has attended to all patches across all layers, so it carries a whole-image representation. For dense tasks like segmentation, the patch token outputs can be reshaped back into a 14x14 spatial grid.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Self-attention gives global receptive field from the first layer. Every patch can attend to every other patch, weighted by learned relevance. A patch showing a wheel can attend to a patch showing a road and a patch showing a car body, assembling object-level understanding without waiting for convolution to expand a local window across dozens of layers.',
        'Position embeddings learn spatial relationships during training. Nearby patches develop similar position embeddings; patches in the same row or column develop correlated embeddings. The model discovers 2D structure from 1D position indices without being told the image is a grid. This is weaker than the hard-coded translation equivariance of CNNs, which is why ViT needs more training data to learn what CNNs get for free.',
        'The CLS token acts as a global aggregator. It has no image content of its own, so its representation is shaped entirely by what it collects from the patch tokens through attention. After many layers of refinement, it becomes a compressed summary of the entire image, suitable for classification.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Self-attention is O(n squared) in the number of tokens, where n is the patch count. For a 224x224 image with 16x16 patches, n = 196 and the attention matrix is 196x196 = 38,416 entries per head per layer. That is manageable. For a 384x384 image with 16x16 patches, n = 576 and the matrix grows to 331,776 entries -- nearly 9 times larger. Doubling resolution roughly quadruples patch count and increases attention cost by 16 times.',
        'ViT-Base has 86 million parameters, comparable to ResNet-152. ViT-Large has 307 million. ViT-Huge has 632 million. The parameter count scales with embedding dimension squared and layer count. The compute cost per image is dominated by the attention and MLP blocks across all layers.',
        'The data hunger is the real cost. ViT trained on ImageNet-1k (1.3 million images) underperforms ResNet. It needs ImageNet-21k (14 million) or JFT-300M (300 million) to reach its full potential. CNNs encode locality and translation equivariance in their architecture; ViT must learn these priors from data. DeiT (Data-efficient Image Transformers) partially solved this with strong augmentation, regularization, and knowledge distillation from a CNN teacher, reaching 83.1% top-1 on ImageNet-1k without extra data.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'ViT-Huge achieved 90.45% top-1 on ImageNet when pre-trained on JFT-300M, surpassing the best CNNs. DeiT showed that data-efficient training with distillation can make ViTs competitive on ImageNet-1k alone. These results established ViTs as viable replacements for CNNs in classification.',
        'Swin Transformer introduced hierarchical windows, reducing attention from O(n squared) to O(n) by computing attention within local windows and shifting them across layers. This made ViTs practical for dense prediction tasks like object detection (using Swin as a backbone in Mask R-CNN) and semantic segmentation. DINO and DINOv2 showed that self-supervised ViTs learn powerful visual features without labels, producing features that transfer well to downstream tasks.',
        'SAM (Segment Anything) uses a ViT-Huge backbone pre-trained with a promptable segmentation objective on 1 billion masks. CLIP pairs a ViT image encoder with a text encoder for zero-shot classification. Florence, PaLI, and GPT-4V all use ViT-family encoders for multi-modal understanding. The architecture has become the default vision backbone for foundation models.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Data efficiency remains the core weakness. Without large-scale pre-training or careful regularization (DeiT-style), ViTs overfit on small datasets. CNNs still win when training data is limited because their inductive biases -- locality, translation equivariance, spatial hierarchy -- encode useful priors that ViTs must learn from examples.',
        'Quadratic attention cost limits resolution. Processing a 1024x1024 medical image with 16x16 patches produces 4,096 tokens and an attention matrix of 16.7 million entries per head per layer. Swin Transformer, linear attention variants, and FlashAttention address this, but they add architectural complexity or approximate the full attention pattern.',
        'ViTs lack the inductive bias for translation invariance that CNNs have by construction. A CNN trained to recognize a cat in the center generalizes to a cat in the corner because the same filters apply everywhere. A ViT must see cats at many positions during training to learn this invariance through position embeddings. With enough data this works, but it is learned rather than guaranteed.',
        'In this visualization, the register-token extension addresses another failure: ViT patch tokens can become accidental scratch space, producing high-norm artifacts in feature maps. Register tokens provide explicit workspace so patch tokens preserve spatial meaning for dense downstream tasks.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take a 224x224 RGB image. Divide it into a 14x14 grid of 16x16 patches. Each patch is 16 pixels times 16 pixels times 3 color channels = 768 scalar values. Flatten each patch into a 768-dimensional vector.',
        'Apply a learned linear projection (a 768x768 matrix for ViT-Base) to each flattened patch, producing 196 embedding vectors of dimension 768. Prepend a learnable CLS token (also dimension 768), making 197 tokens. Add learned position embeddings to each of the 197 tokens so the model knows patch (3, 7) is different from patch (10, 2).',
        'Pass the 197 tokens through 12 transformer encoder layers. In each layer, multi-head self-attention (with 12 heads in ViT-Base) lets every token attend to every other token. The attention matrix at each head is 197x197. After attention, an MLP with hidden dimension 3072 (4 times 768) transforms each token independently. Layer norm and residual connections wrap both sub-layers.',
        'After 12 layers, take the CLS token output (a single 768-dimensional vector) and feed it through an MLP head: a linear layer mapping 768 to 1000 class logits for ImageNet. The predicted class is the argmax of those 1000 logits.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Dosovitskiy et al., "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale" (2020), https://arxiv.org/abs/2010.11929. DeiT: Touvron et al., "Training data-efficient image transformers & distillation through attention" (2021). Swin: Liu et al., "Swin Transformer: Hierarchical Vision Transformer using Shifted Windows" (2021). Register tokens: Darcet et al., "Vision Transformers Need Registers" (2023), https://arxiv.org/abs/2309.16588.',
        'Prerequisites: Convolution (to understand what ViT replaces), Transformer Block (the encoder architecture ViT reuses), Self-Attention and Multi-Head Attention (the core mechanism). Extensions: Swin Transformer (hierarchical windows for dense tasks), DINO (self-supervised ViT training), FlashAttention (efficient attention computation). Contrasting alternatives: CNN architectures (ResNet, EfficientNet) for when data is scarce and inductive bias matters more than flexibility.',
      ],
    },
  ],
};

