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
      heading: `Why this exists`,
      paragraphs: [
        `A Vision Transformer starts with a useful fiction: split the image into patches, turn each patch into a token, mix all tokens with attention, then read the final patch tokens as a spatial feature map. That fiction is powerful because it lets the same backbone support classification, detection, segmentation, depth, retrieval, and object discovery. Each output patch token still has a location, so a downstream head can reshape tokens back into rows and columns.`,
        `Register tokens exist because large ViTs learned to violate that fiction. In several supervised and self-supervised backbones, especially DINOv2-style models, low-information background patches can become high-norm outliers late in the network. Those patches often look like sky, sand, wall, or empty background in the image, but internally they act like scratch space. The model has found a place to store global computation, and it chooses boring spatial cells because damaging them hurts classification less than damaging object patches.`,
        `That behavior is clever from the model's point of view and harmful from the user's point of view. A dense head does not know that a sky patch is now an internal register. It treats the token as spatial evidence. The result can be a rough feature map, a misleading attention visualization, a bad object mask, or an unexplained high-norm spot in a supposedly empty region.`,
      ],
    },
    {
      heading: `The baseline approach`,
      paragraphs: [
        `The ordinary ViT sequence is simple: patch embeddings, optional positional embeddings, and often a CLS token for global classification. Every transformer block lets the tokens attend to one another. At the end, classification reads a pooled vector or the CLS token, while dense tasks keep the patch tokens and rebuild a grid.`,
        `The obvious assumption is that the CLS token is enough global workspace. If the model needs global context, the CLS token can collect it; if a patch needs context, attention can bring that context into the patch representation. For many tasks this works. A patch representing a dog ear can still attend to the rest of the dog, and a patch representing blank sky can remain a blank-sky feature.`,
        `The baseline fails when the model needs more internal memory than the sequence layout explicitly provides. A single CLS token is often optimized for the final global objective, not for all intermediate bookkeeping. Patch tokens are plentiful, attention-visible, and already part of every layer. If some patches carry little semantic evidence, the model can press them into service as internal workspace.`,
      ],
    },
    {
      heading: `Where the baseline fails`,
      paragraphs: [
        `The failure is a role conflict. Patch tokens are asked to be two things at once: spatial evidence and general-purpose state. That is not a formal type error in the model, but it is a contract error for downstream systems. A token at row 6, column 12 should mean something about that image region. If it has become a scratchpad, the grid no longer means what the feature consumer thinks it means.`,
        `The symptoms are visible because scratch tokens often develop unusually high norms. They can produce bright attention spots in dull background, holes in smooth feature maps, and object-discovery behavior that depends on artifacts rather than image objects. The bug is subtle because top-line classification can remain strong. The model can win the training objective while making its intermediate features harder to use.`,
        `The wall is especially important for foundation backbones. A backbone is not a closed classifier; it is an upstream supplier of features. If the feature contract is noisy, every downstream task inherits the noise. Post-processing can hide some artifacts, but it does not repair the architectural reason the model used spatial cells as non-spatial memory.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `The insight is to give the model honest workspace. Register tokens are extra learned embeddings appended to the input sequence. They do not correspond to image patches. They attend with the patch tokens through the transformer blocks, but downstream dense heads can ignore them when rebuilding the patch grid.`,
        `This is a small data-structure change with a large semantic effect. The sequence now has patch positions, optional CLS position, and k register positions. Patch positions keep spatial meaning. Register positions are allowed to become global scratch slots. The invariant is direct: only patch tokens are reshaped into image maps; register tokens are model workspace.`,
        `That invariant turns an accidental behavior into an explicit interface. Instead of hoping the model never overloads boring background patches, the architecture supplies tokens whose purpose is to be overloaded. The model still gets flexible attention-based computation, but the feature grid is less likely to carry internal bookkeeping artifacts.`,
      ],
    },
    {
      heading: `Mechanism`,
      paragraphs: [
        `Implementation starts by creating k learned register embeddings with the same hidden size as patch embeddings. For each image, the input builder concatenates patch tokens, positional information, optional CLS token, and the register tokens in a fixed layout. The transformer blocks do not need special register logic; ordinary self-attention lets every token exchange information with every other token.`,
        `The output side is where discipline matters. A classifier may read a pooled representation, the CLS token, patches, registers, or a combination depending on the model design. A dense head should select only patch indices, reshape those patch tokens into the original patch grid, and drop the registers. Feature extraction APIs should document the sequence layout so callers know which slice is spatial.`,
        `Telemetry should watch token norms by role. If patch tokens still show late high-norm background spikes, the register count may be too low, the training setup may not encourage the intended role separation, or the artifact may have a different cause. If register norms grow while patch maps smooth out, the registers are doing the job they were added to do.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Registers work because attention is already a global communication system. A patch can write information into a register by attending to it, and later patches can read from that register through attention. The model does not need a separate memory API. It only needs non-spatial tokens that are visible during the same computation as the patches.`,
        `The design also changes the optimization pressure. Without registers, a low-information patch can be the cheapest place to store global state. With registers, the model has dedicated learned slots that are not penalized for losing spatial purity. Patch tokens are still free to carry global context, but they do not need to act as anonymous scratch registers.`,
        `The benefit is not that registers force perfect interpretability. They do not. The benefit is that they align the architecture with the downstream contract. Dense consumers expect patch tokens to be spatial. Register tokens absorb some non-spatial work, so feature maps tend to become smoother and less polluted by high-norm background artifacts.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `The cost is extra sequence length. If an image has N patch tokens and k registers, attention runs over N plus k tokens. With full attention, the extra work is roughly proportional to the added query, key, and value interactions. Small k is usually modest, but the cost is real on high-resolution images and large batch sizes.`,
        `The behavioral tradeoff is choosing enough registers without turning them into a new sink for waste. Too few registers may leave scratch pressure in patch tokens. Too many registers spend compute and memory while giving the optimizer more tokens whose roles may be hard to inspect. In practice, the register count is a model design parameter that should be swept against artifact metrics, dense-task quality, and latency.`,
        `The operational cost is contract management. Training, fine-tuning, inference, export, quantization, and feature extraction all need to agree on sequence layout. A checkpoint with registers is not shape-compatible with the same model definition without registers. A dense head that forgets to drop register positions can silently produce maps with fake cells.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Register tokens are strongest when the patch grid is a product, not just an internal step. Object discovery, semantic segmentation, depth estimation, correspondence, saliency analysis, and retrieval all benefit from patch features that preserve spatial meaning. The more consumers reuse the backbone, the more valuable a clean feature contract becomes.`,
        `They are also useful when a model family is distributed as infrastructure. A register-aware DINOv2-style backbone can give downstream teams cleaner maps without forcing every team to detect and remove artifacts independently. This matters for open checkpoints, model hubs, and production feature services where the backbone may serve many unknown consumers.`,
        `The idea generalizes beyond this paper. It belongs to a broader family of learned workspace designs: CLS tokens, Set Transformer inducing points, Perceiver latent arrays, memory tokens, and adaptive token banks. The common pattern is to separate tokens that represent external data from tokens that provide internal computation capacity.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Registers are not a universal vision fix. A small classifier whose intermediate patch maps are never inspected may see little value. A model with artifacts caused by data bias, bad normalization, poor positional handling, or downstream head design will not be repaired merely by adding workspace tokens.`,
        `They can also fail through integration mistakes. If fine-tuning drops the registers but keeps a head trained with them, behavior changes. If export tools reorder tokens, dense consumers can read the wrong slice. If a serving system exposes "last hidden state" without layout metadata, clients may treat registers as image patches. The architecture is simple, but the interface must be explicit.`,
        `Another limit is interpretability. A register is a workspace slot, not a named variable. It may collect useful state, but it does not automatically explain what the model is computing. Register tokens reduce one artifact source; they do not make all attention maps faithful explanations.`,
      ],
    },
    {
      heading: `Implementation guidance`,
      paragraphs: [
        `Start by deciding the sequence layout and write it down: patch slice, CLS position if present, register slice, and output slices exposed by the API. Make this layout a named constant rather than an implicit offset scattered through the model, feature extractor, and dense heads.`,
        `Train and infer with the same register count. Initialize registers as learned parameters, include them in checkpoint loading, and test shape compatibility in export paths. If the model is fine-tuned for dense prediction, verify that the head receives only patch tokens. Unit tests should assert the number of spatial tokens equals grid height times grid width before reshaping.`,
        `Measure the actual problem. Track token norms by role and layer, dense-task quality, feature-map smoothness, attention artifact frequency, throughput, and memory. Compare against a no-register model and against simple post-processing. A good register-token result should reduce artifacts without hiding a large latency regression or a downstream indexing bug.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `Suppose an image shows a dog on a beach. Dog patches and edge patches carry strong visual evidence. Flat sand and sky patches carry less. In a baseline ViT, one flat sky patch may become a high-norm token because the model uses it to store global state about the whole image. A mask decoder later reads that sky token as a sky feature and gets a distorted map.`,
        `With four register tokens, the sequence has dedicated non-spatial slots. The dog, sand, and sky patches still attend globally, but the model can store some global bookkeeping in the registers. The dense head then receives only the patch slice. The sky cell is more likely to remain a sky feature instead of secretly acting as an internal notebook.`,
        `This example also shows the correct mental model. Registers do not remove global information from patch tokens. Patch tokens still become contextual representations. The improvement is that the highest-pressure scratch role has explicit capacity, so low-information spatial patches are less likely to become accidental registers.`,
      ],
    },
    {
      heading: `Sources and study next`,
      paragraphs: [
        `Primary sources: Vision Transformers Need Registers at https://arxiv.org/abs/2309.16588, OpenReview at https://openreview.net/forum?id=2dnO3LLiJ1, the DINOv2 repository at https://github.com/facebookresearch/dinov2, and the Hugging Face DINOv2-with-registers documentation at https://huggingface.co/docs/transformers/en/model_doc/dinov2_with_registers.`,
        `Study attention first: Attention Mechanism, Multi-Head Attention, Positional Encoding, and Transformer Block. Then study learned workspace designs: Set Transformer Inducing Points, Perceiver IO Latent Array Bottleneck, AdaTape Adaptive Token Bank, Byte Latent Transformer, and StreamingLLM Attention Sinks. For deployment context, study Transformer Inference Roofline and Activation Checkpointing so the extra-token cost is not treated as free.`,
      ],
    },
  ],
};
