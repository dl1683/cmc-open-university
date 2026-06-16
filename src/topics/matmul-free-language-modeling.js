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
    explanation: 'The MatMul-free paper restricts many weights to {-1, 0, +1}. Multiplication by +1 becomes addition, by -1 becomes subtraction, and by 0 becomes a skipped contribution.',
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
    explanation: 'The arithmetic is still a dot product shape, but the weight side has been simplified so hardware can use additions, subtractions, skips, and compact weight storage.',
    invariant: 'The model buys efficiency by limiting the set of possible weights.',
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
    explanation: 'The local writeup highlights fused BitLinear: combine normalization, quantization, and ternary accumulation so data does not bounce repeatedly between slow and fast memory.',
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
    explanation: 'The paper reports that the performance gap narrows with scale. That is the research bet: simpler operations may become more attractive as the architecture and kernels mature.',
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
    explanation: 'The architecture still needs a token mixer and a channel mixer. It swaps attention-like dense matrix work for MLGRU and dense feed-forward work for BitLinear plus GLU-style gating.',
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
    explanation: 'The method is not just quantization. It redesigns the architecture around operations that can survive ternary weights and low-precision activations.',
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
    explanation: 'A MatMul-free model is partly an architecture claim and partly a hardware claim. If accelerators are optimized for dense matmul, the new operations need excellent kernels or custom hardware to win.',
    invariant: 'The best algorithm on paper must match the machine that runs it.',
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
    explanation: 'MatMul-free LMs belong to the same efficiency family as quantization, RWKV, Mamba, and roofline-aware serving: change the operation mix, then measure the new bottleneck.',
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
    {
      heading: 'What it is',
      paragraphs: [
        'Scalable MatMul-free Language Modeling asks a direct question: can a language model remove dense matrix multiplication from its main architecture while keeping competitive quality? Matrix multiplication dominates Transformer attention and feed-forward layers. It also dictates hardware economics, because GPUs and TPUs are built around dense matmul throughput.',
        'The paper proposes a MatMul-free LM built around ternary weights, quantized activations, a MatMul-free Linear GRU token mixer, and a MatMul-free GLU-style channel mixer using BitLinear layers. The goal is not merely to store a normal Transformer in fewer bits. The goal is to change the primitive operations the model uses.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Ternary weights restrict parameters to -1, 0, and +1. That turns multiplication into subtract, skip, or add. Activations are quantized, commonly to low precision, and RMSNorm helps stabilize the scale. Because quantization and ternary projection are not normally differentiable, training uses straight-through estimator style gradients so backpropagation can still update the underlying parameters.',
        'The token mixer is MLGRU, a simplified recurrent unit that avoids dense matmul-heavy self-attention. The channel mixer uses BitLinear layers and gating to replace dense feed-forward blocks. The local corpus writeup emphasizes fused BitLinear: perform normalization, quantization, and ternary accumulation with fewer trips through memory. That is exactly the kind of kernel detail that decides whether an architecture is practical.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The promise is lower memory traffic and simpler arithmetic. The paper reports strong scaling behavior up to billion-parameter models, large memory reductions in optimized implementations, and a custom FPGA demonstration. The risk is that modern accelerators are extraordinarily good at dense matmul. Removing matmul helps only if the replacement operations map well to actual hardware and do not lose too much model quality.',
        'This is why the topic belongs next to Transformer Inference Roofline. A change in arithmetic changes the roofline point, but it may expose another bottleneck: memory bandwidth, kernel launch overhead, recurrence scheduling, or custom hardware constraints. The win must be measured end to end, not inferred from fewer multiplies alone.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MatMul-free models are research-stage, but the direction matters for edge inference, battery-limited devices, low-cost serving, specialized accelerators, and the economics of LLM deployment. If language modeling can tolerate ternary weights and recurrent token mixing at scale, future hardware may optimize for additions, bit operations, compact memory layouts, and fused low-precision kernels rather than only larger dense tensor cores.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'MatMul-free does not mean computation-free. It means the dominant primitive changes. Addition, subtraction, gating, recurrent state updates, quantization, and memory movement still cost real time and energy. Another misconception is that this is just ordinary Quantization or Structured Pruning and N:M Sparsity. Those compress a model or mask; MatMul-free language modeling redesigns the model around quantized, ternary-friendly components. Quality comparisons also need scale, data, training recipe, and hardware context.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Scalable MatMul-free Language Modeling at https://arxiv.org/abs/2406.02528 and the implementation at https://github.com/ridgerchu/matmulfreellm. For related efficiency ideas, study BitNet at https://arxiv.org/abs/2310.11453 and the roofline model at https://dl.acm.org/doi/10.1145/1498765.1498785. Study Quantization, Structured Pruning and N:M Sparsity, FNet Fourier Token Mixing Case Study, RWKV Recurrent Transformer, Selective State Space Models: Mamba, Transformer Inference Roofline, KV Cache, and Gradient Flow next.',
      ],
    },
  ],
};
