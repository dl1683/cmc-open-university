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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for MatMul-Free Language Modeling. A language-model architecture that removes dense matrix multiplication from token and channel mixing using ternary weights, MLGRU, BitLinear, and fused kernels..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Modern language models are built around repeated linear projections. In a Transformer block, attention projects tokens into queries, keys, and values, then the feed-forward network applies large dense matrices to every token. Those matrix multiplications are exactly what current accelerators are good at, but they also define the energy, memory bandwidth, kernel design, and serving economics of the model.`,
        `MatMul-free language modeling asks whether that dependency is fundamental. The paper is not asking whether a trained Transformer can be compressed after the fact. It asks whether the architecture itself can be rebuilt so the main token and channel mixing operations avoid dense floating-point matrix multiplication, while still learning useful language representations at large scale.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The reasonable first attempt is to keep the Transformer and make its matrices cheaper. Quantize activations and weights. Use sparsity. Fuse kernels. Batch requests so tensor cores stay full. This is not a weak baseline; it is the reason dense Transformers became practical at all. The hardware, compilers, and serving stacks already know how to multiply dense tiles extremely fast.`,
        `The wall is that these techniques usually keep the same operation shape. A quantized matrix multiply is still a matrix multiply. A sparse matrix multiply can lose regularity and become bandwidth-bound. A smaller dense model may save compute but also lose capacity. If the goal is to run language models on cheaper, colder, or more specialized hardware, improving dense matmul may not be enough. The operation mix itself becomes the design target.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core move is to restrict many learned weights to the ternary set {-1, 0, +1}. Multiplication by +1 is addition, multiplication by -1 is subtraction, and multiplication by 0 is a skipped contribution. The dot-product shape is still recognizable, but the arithmetic units and weight storage no longer look like ordinary floating-point matmul.`,
        `That restriction alone would not make a language model. The architecture still needs two jobs: mix information across tokens and transform channels inside each token representation. MatMul-free LM pairs a MatMul-free Linear GRU token mixer with BitLinear-based channel mixing and GLU-style gates. The model keeps normalization, residual structure, gating, and training dynamics, but it changes the expensive primitive underneath those components.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A BitLinear layer begins by normalizing the input activation, commonly with RMSNorm, so the following low-precision arithmetic has a stable scale. Activations are quantized. The weight side is represented with ternary values. Accumulation becomes a sequence of adds, subtracts, and skips, followed by the scale factors needed to bring the result back into the residual stream.`,
        `Training needs a bridge around the fact that ternary projection is not smoothly differentiable. Like many quantization-aware systems, the method keeps trainable underlying parameters and uses straight-through estimator style gradients so optimization can move the hidden real-valued weights even though the forward pass uses restricted values. The trick is not that gradients become exact; the trick is that the noisy approximation is good enough for learning when the architecture, normalization, and scale are arranged around it.`,
        `For token mixing, MLGRU removes the dense hidden-state matrix work that makes ordinary recurrent units expensive. For channel mixing, BitLinear and gating replace the Transformer feed-forward block. Fused kernels matter because a naive implementation could spend the saved multiplications on extra memory reads and writes. The useful implementation tries to fuse normalization, quantization, ternary accumulation, and scaling so the data moves through the memory hierarchy once instead of bouncing between kernels.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `There is no simple correctness proof like there is for binary search. This is a learned architecture, so the argument is about representational capacity and optimization behavior. The invariant is that every block must still provide token mixing, channel mixing, nonlinearity, gating, and residual information flow. If those roles are preserved, the network may learn to compensate for restricted weights by distributing information differently across width, depth, gates, and normalization.`,
        `The paper\'s scaling claim is important for this reason. A tiny ternary model can look bad because the constraint removes too much freedom. At larger scale, redundancy can help: many cheap constrained operations may approximate the useful behavior of fewer expensive dense operations. That does not prove equivalence to a Transformer, but it explains why the research question becomes more plausible as model size grows.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The headline savings come from compact weights, simpler arithmetic, and lower memory traffic. A ternary weight can be represented with far fewer bits than a floating-point weight, and zero weights skip work entirely. If the kernel is fused well, fewer bytes move through memory and fewer expensive arithmetic units are needed per token.`,
        `The hidden costs are just as real. Recurrent token mixing may change parallelism across sequence positions. Quantization and scaling add bookkeeping. Custom kernels add engineering risk. On GPUs, dense matmul benefits from years of hardware and compiler investment, so a theoretically cheaper operation can lose if it maps poorly to the machine. On FPGAs or future specialized accelerators, the balance may change because additions, bit-level storage, and simple datapaths can be designed directly into the hardware.`,
        `This is why the right comparison is end to end: quality at a fixed training budget, latency at realistic batch sizes, memory use under the serving stack, and energy on the target device. Counting fewer multiplies is only a proxy. The bottleneck may move to memory bandwidth, recurrence scheduling, kernel launch overhead, or the cost of keeping enough model capacity after the weight restriction.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `The strongest use case is not a cloud GPU fleet that already runs dense Transformer kernels near peak utilization. The interesting use case is the frontier around edge inference, battery-limited devices, local assistants, low-cost serving, privacy-preserving offline models, and custom accelerators where dense tensor cores are not the only possible hardware story.`,
        `It is also useful as a research lens. MatMul-free LM forces a precise question: which parts of the Transformer are essential, and which parts are artifacts of the hardware we optimized around? If token mixing can be recurrent, if channel mixing can use ternary projections, and if low-precision gates can preserve quality, then some future language models may be co-designed with hardware in a deeper way than ordinary post-training compression allows.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `MatMul-free is not a drop-in replacement for every pretrained Transformer. You cannot usually take an arbitrary dense checkpoint, replace all matrices with ternary weights, and expect the same behavior. The architecture and training recipe are part of the claim. Data, scale, optimizer details, normalization, kernel quality, and evaluation tasks all matter.`,
        `It is also not the same as quantization, pruning, or sparsity. Quantization changes numeric precision. Pruning removes selected weights or structures. N:M sparsity constrains local sparsity patterns so hardware can skip work. MatMul-free language modeling changes the architecture around operations that are intended to avoid dense matrix multiplication in the first place. Those ideas are related, but they answer different engineering questions.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Scalable MatMul-free Language Modeling at https://arxiv.org/abs/2406.02528 and its implementation at https://github.com/ridgerchu/matmulfreellm. The next topics to study are Quantization for low-precision training and inference, Structured Pruning and N:M Sparsity for hardware-friendly skipping, Transformer Inference Roofline for the bytes-versus-FLOPs view, RWKV Recurrent Transformer and Selective State Space Models: Mamba for alternatives to attention, and Gradient Flow for the training-side reason straight-through estimators are both useful and risky.`,
      ],
    }
  ],
};

