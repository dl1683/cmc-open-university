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
    { heading: 'How to read the animation', paragraphs: [
      'Read the animation as a token-layout problem inside a Vision Transformer. Active nodes show patch tokens and registers entering attention, while found nodes show patch features passed to downstream heads.',
      'A Vision Transformer, or ViT, splits an image into patch tokens. A register token is an extra learned token with no image location, used as workspace during transformer blocks.',
      {type:'callout', text:'Register tokens give a Vision Transformer explicit workspace so image patches can remain spatial evidence instead of becoming accidental scratch slots.'},
    ] },
    { heading: 'Why this exists', paragraphs: ['Dense vision tasks need patch features that still mean image regions. The register-token paper found that low-information background patches can become high-norm scratch tokens and pollute feature maps.'] },
    { heading: 'The obvious approach', paragraphs: ['The obvious ViT layout uses patch tokens plus a CLS token. That is enough for classification, but dense heads often reshape patch tokens back into a spatial grid.'] },
    { heading: 'The wall', paragraphs: ['The wall is missing workspace. Attention gives every token global communication, so the model may repurpose an unimportant background patch for internal bookkeeping.'] },
    { heading: 'The core insight', paragraphs: ['The core insight is to add explicit workspace tokens. Registers can carry non-spatial state while patch tokens remain spatial evidence for dense outputs.'] },
    { heading: 'How it works', paragraphs: ['The model appends k learned register embeddings to the input sequence. All tokens attend through the transformer, then dense heads discard register positions and reshape only patch positions.'] },
    { heading: 'Why it works', paragraphs: ['Correctness comes from role separation. Patch indices used by a segmentation or discovery head now refer only to image patches, not accidental scratch cells.'] },
    { heading: 'Cost and complexity', paragraphs: ['The cost is extra sequence length. With 196 patch tokens and 4 registers, attention grows from 196 by 196 to 200 by 200, about 4.1 percent more entries per head.'] },
    { heading: 'Real-world uses', paragraphs: ['Registers fit ViT backbones for segmentation, object discovery, retrieval features, and interpretability. They matter when downstream code consumes patch-level features directly.'] },
    { heading: 'Where it fails', paragraphs: ['Registers do not fix every ViT weakness. Data hunger, high-resolution attention cost, weak translation bias, and bad downstream heads can still dominate quality.'] },
    { heading: 'Worked example', paragraphs: ['A 224 by 224 image with 16 by 16 patches becomes 196 patch tokens. With CLS and 4 registers, the sequence has 201 tokens, so 12 heads use 201 by 201 by 12 attention scores in one layer.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Vision Transformers Need Registers at https://arxiv.org/abs/2309.16588 and An Image is Worth 16x16 Words at https://arxiv.org/abs/2010.11929. Study self-attention, ViT patch embedding, DINO features, and Swin Transformer next.'] },
  ],
};

