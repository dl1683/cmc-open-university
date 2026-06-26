// MatMul-free language modeling: replace dense matrix multiplications with
// ternary-weight accumulations, lightweight recurrent token mixing, and fused kernels.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'matmul-free-language-modeling',
  title: 'MatMul-Free Language Modeling',
  category: 'Papers',
  summary: 'A language-model architecture that removes dense matrix multiplication from token and channel mixing using ternary weights, MLGRU, BitLinear, and fused kernels.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['ternary weights', 'MLGRU and BitLinear'], defaultValue: 'ternary weights' },
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

function* ternaryWeights() {
  yield {
    state: labelMatrix(
      'Dense vs ternary',
      [
        { id: 'fp', label: 'float' },
        { id: 'tern', label: '+1' },
        { id: 'zero', label: '0' },
      ],
      [
        { id: 'weight', label: 'w' },
        { id: 'operation', label: 'op' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['0.37', 'mul', 'high'],
        ['+1', 'add', 'low'],
        ['0', 'skip', 'low'],
      ],
    ),
    highlight: { active: ['tern:operation', 'zero:operation'], compare: ['fp:operation'] },
    explanation: `The ${topic.title} paper restricts many weights to {-1, 0, +1}. Multiplication by +1 becomes addition, by -1 becomes subtraction, and by 0 becomes a skipped contribution.`,
  };

  yield {
    state: labelMatrix(
      'A BitLinear step in miniature',
      [
        { id: 'x1', label: 'x1' },
        { id: 'x2', label: 'x2' },
        { id: 'x3', label: 'x3' },
        { id: 'sum', label: 'sum' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'w', label: 'w' },
        { id: 'contrib', label: 'contrib' },
      ],
      [
        ['0.8', '+1', '+0.8'],
        ['0.3', '-1', '-0.3'],
        ['0.5', '0', 'skip'],
        ['', '', '0.5'],
      ],
    ),
    highlight: { active: ['x1:contrib', 'x2:contrib', 'x3:contrib'], found: ['sum:contrib'] },
    explanation: `The arithmetic is still a dot product shape, but the weight side has been simplified so hardware can use additions, subtractions, skips, and compact weight storage in ${topic.title}.`,
    invariant: `The model buys efficiency by limiting the set of possible weights to ${'{-1, 0, +1}'} — only ${3} values.`,
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'act', label: 'activations', x: 0.8, y: 3.8, note: '8-bit' },
        { id: 'norm', label: 'RMSNorm', x: 2.6, y: 3.8, note: 'scale' },
        { id: 'quant', label: 'quantize', x: 4.4, y: 3.8, note: 'int8' },
        { id: 'tern', label: 'ternary W', x: 6.2, y: 3.8, note: '-1/0/+1' },
        { id: 'accum', label: 'accumulate', x: 8.2, y: 3.8, note: 'add/sub' },
      ],
      edges: [
        { id: 'e-act-norm', from: 'act', to: 'norm', weight: '' },
        { id: 'e-norm-quant', from: 'norm', to: 'quant', weight: '' },
        { id: 'e-quant-tern', from: 'quant', to: 'tern', weight: '' },
        { id: 'e-tern-accum', from: 'tern', to: 'accum', weight: '' },
      ],
    }, { title: 'Fused BitLinear reduces memory traffic' }),
    highlight: { active: ['norm', 'quant', 'tern'], found: ['accum'] },
    explanation: `The ${topic.title} writeup highlights fused BitLinear: combine normalization, quantization, and ternary accumulation so data does not bounce repeatedly between slow and fast memory.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'model scale', min: 0, max: 4 }, y: { label: 'loss gap vs baseline', min: 0, max: 1 } },
      series: [
        { id: 'gap', label: 'projected gap', points: [
          { x: 0.2, y: 0.75 }, { x: 0.7, y: 0.55 }, { x: 1.3, y: 0.38 }, { x: 2.0, y: 0.24 }, { x: 2.7, y: 0.14 }, { x: 3.5, y: 0.08 },
        ] },
      ],
      markers: [
        { id: 'scale', x: 2.7, y: 0.14, label: 'billion scale' },
      ],
    }),
    highlight: { active: ['gap'], found: ['scale'] },
    explanation: `The ${topic.title} paper reports that the performance gap narrows with scale. That is the research bet: simpler operations may become more attractive as the architecture and kernels mature.`,
  };
}

function* mlgruAndBitLinear() {
  yield {
    state: graphState({
      nodes: [
        { id: 'token', label: 'tokens', x: 0.8, y: 3.8, note: 'sequence' },
        { id: 'mlgru', label: 'MLGRU', x: 3.0, y: 2.4, note: 'token mixer' },
        { id: 'state', label: 'state', x: 5.0, y: 2.4, note: 'recurrent' },
        { id: 'bit', label: 'BitLinear', x: 3.0, y: 5.2, note: 'channel mixer' },
        { id: 'glu', label: 'GLU', x: 5.0, y: 5.2, note: 'gate' },
        { id: 'out', label: 'next block', x: 8.0, y: 3.8, note: 'residual stream' },
      ],
      edges: [
        { id: 'e-token-mlgru', from: 'token', to: 'mlgru', weight: '' },
        { id: 'e-mlgru-state', from: 'mlgru', to: 'state', weight: '' },
        { id: 'e-state-out', from: 'state', to: 'out', weight: '' },
        { id: 'e-token-bit', from: 'token', to: 'bit', weight: '' },
        { id: 'e-bit-glu', from: 'bit', to: 'glu', weight: '' },
        { id: 'e-glu-out', from: 'glu', to: 'out', weight: '' },
      ],
    }, { title: 'MatMul-free LM keeps token and channel mixers' }),
    highlight: { active: ['mlgru', 'bit', 'glu'], found: ['out'] },
    explanation: `The ${topic.title} architecture still needs a token mixer and a channel mixer. It swaps attention-like dense matrix work for MLGRU and dense feed-forward work for BitLinear plus GLU-style gating.`,
  };

  yield {
    state: labelMatrix(
      'What each replacement targets',
      [
        { id: 'attn', label: 'attention' },
        { id: 'ffn', label: 'FFN' },
        { id: 'norm', label: 'norm' },
        { id: 'grad', label: 'training' },
      ],
      [
        { id: 'replacement', label: 'replacement' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['MLGRU', 'linear-time mix'],
        ['BitLinear GLU', 'ternary channels'],
        ['RMSNorm fuse', 'less traffic'],
        ['STE', 'quantized grads'],
      ],
    ),
    highlight: { active: ['attn:replacement', 'ffn:replacement', 'norm:replacement'], compare: ['grad:replacement'] },
    explanation: `The ${topic.title} method is not just quantization. It redesigns the architecture around operations that can survive ternary weights and low-precision activations.`,
  };

  yield {
    state: labelMatrix(
      'What hardware sees',
      [
        { id: 'gpu', label: 'GPU' },
        { id: 'fpga', label: 'FPGA' },
        { id: 'cpu', label: 'CPU' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'challenge', label: 'challenge' },
      ],
      [
        ['mature matmul', 'custom kernels'],
        ['custom datapath', 'engineering effort'],
        ['cheap ops', 'memory bandwidth'],
      ],
    ),
    highlight: { found: ['fpga:strength'], compare: ['gpu:challenge', 'cpu:challenge'] },
    explanation: `A ${topic.title.split(' ').slice(0, 2).join('-')} model is partly an architecture claim and partly a hardware claim. If accelerators are optimized for dense matmul, the new operations need excellent kernels or custom hardware to win.`,
    invariant: `The best algorithm on paper must match the machine that runs it — ${topic.title}'s value depends on the target hardware.`,
  };

  yield {
    state: labelMatrix(
      'Read alongside',
      [
        { id: 'quant', label: 'Quant' },
        { id: 'rwkv', label: 'RWKV' },
        { id: 'mamba', label: 'Mamba' },
        { id: 'roof', label: 'Roofline' },
      ],
      [
        { id: 'shared issue', label: 'shared issue' },
        { id: 'question', label: 'question' },
      ],
      [
        ['low precision', 'what can be rounded?'],
        ['recurrent mix', 'what state is enough?'],
        ['linear scan', 'what replaces attention?'],
        ['bytes vs FLOPs', 'what bottleneck moved?'],
      ],
    ),
    highlight: { found: ['quant:question', 'rwkv:question', 'mamba:question', 'roof:question'] },
    explanation: `${topic.title} belongs to the same efficiency family as quantization, RWKV, Mamba, and roofline-aware serving: change the operation mix, then measure the new bottleneck.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ternary weights') yield* ternaryWeights();
  else if (view === 'MLGRU and BitLinear') yield* mlgruAndBitLinear();
  else throw new InputError('Pick a MatMul-free language-modeling view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
        'The ternary-weights view compares floating-point multiplication with weights limited to -1, 0, and +1. Active cells show additions, subtractions, and skips replacing learned multiplications. The MLGRU view separates token mixing from channel mixing so you can see which Transformer jobs are being replaced.',
        {type: 'callout', text: 'MatMul-free language modeling changes the primitive operation, so the real question is quality per watt on the hardware that will actually run it.'},
        {type: 'image', src: './assets/gifs/matmul-free-language-modeling.gif', alt: 'Animated walkthrough of the matmul free language modeling visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: [
        'Language models spend much of their work in dense matrix multiplication. That operation is fast on GPUs, but it drives energy, memory bandwidth, and serving cost. MatMul-free language modeling asks whether the architecture can learn with cheaper primitives instead of only compressing a dense Transformer after training.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious path keeps dense layers and makes them cheaper with quantization, sparsity, batching, and kernel fusion. This is a strong baseline because modern accelerators and compilers are built around dense tiles. Any MatMul-free design must beat a mature stack, not a toy competitor.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Matrix_multiplication_diagram_2.svg', alt: 'Matrix multiplication diagram showing rows and columns forming output entries', caption: 'Dense language-model layers spend their work in repeated matrix products: rows and columns produce each output activation. Source: Wikimedia Commons, Lakeworks, CC BY-SA 3.0 or GFDL.'},
      ], },
    { heading: 'The wall', paragraphs: [
        'Quantized matrix multiplication is still matrix multiplication. Sparse kernels can lose regularity, smaller dense models can lose quality, and every option remains tied to hardware optimized for dense algebra. Edge devices, custom accelerators, and power-limited systems may need a different operation mix.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Restrict many weights to {-1, 0, +1}. Multiplication by +1 becomes addition, multiplication by -1 becomes subtraction, and multiplication by 0 becomes a skipped input. The architecture then preserves the required jobs with MLGRU token mixing and BitLinear channel mixing.',
      ], },
    { heading: 'How it works', paragraphs: [
        'A BitLinear layer normalizes activations, quantizes them, combines them with ternary weights, and rescales the result. Training keeps hidden real-valued parameters while the forward pass uses restricted values. Straight-through estimator style gradients let optimization move the hidden weights even though the forward operation is discrete.',
        'MLGRU handles sequence mixing with recurrent state rather than dense attention-style products. Fused kernels matter because saved multiplications can be lost to extra memory movement. The implementation has to save bytes and operations together.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'There is no exact correctness proof because this is a learned architecture. The argument is that the network still supplies token mixing, channel mixing, nonlinearity, gating, normalization, and residual flow. If those roles remain, enough constrained operations can approximate useful language functions at scale.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'The intended savings are smaller weights, simpler arithmetic, and lower memory traffic. Ternary weights require far fewer bits than floating-point weights, and zero weights skip work. The hidden cost is kernel quality: dense matmul is so optimized that a simpler operation can lose if it maps poorly to the device.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Nvidia_GV100_GPU.png', alt: 'Nvidia GV100 GPU die showing many compute blocks', caption: 'Modern GPU silicon is heavily optimized around dense tensor throughput, so a MatMul-free model must prove that simpler operations map well to the target device. Source: Wikimedia Commons, Nvidia, public domain.'},
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'The strongest uses are local assistants, edge inference, offline privacy-preserving models, embedded systems, and custom accelerators. These settings may value quality per watt more than peak tensor-core throughput. The paper is also a probe into which parts of Transformer success come from architecture and which come from hardware convenience.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'It is not a drop-in conversion for arbitrary dense checkpoints. The training recipe, scale, recurrent mixer, normalization, and kernels are part of the claim. It can also fail on GPUs where mature dense kernels beat custom low-precision recurrent kernels end to end.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'For activations [0.8, 0.3, 0.5], a dense row [0.37, -0.22, 0.91] computes 0.8*0.37 + 0.3*(-0.22) + 0.5*0.91 = 0.685. A ternary row [+1, -1, 0] computes 0.8 - 0.3 + 0 = 0.5. The second row is less flexible, but it avoids learned floating-point multiplications in the inner step.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Start with Scalable MatMul-free Language Modeling and the public implementation. Study BitNet, quantization, structured sparsity, RWKV, Mamba, and inference roofline analysis next. The practical question is whether the changed operation mix moves the real hardware bottleneck.',
      ], },
  ],
};
