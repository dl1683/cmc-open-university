// Transformer layer FLOPs cost model: split the dense per-token work from
// the pairwise attention work so long-context tradeoffs are visible.

import { matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'transformer-layer-flops-cost-model',
  title: 'Transformer Layer FLOPs Cost Model',
  category: 'AI & ML',
  summary: 'A decoder-layer cost primer: why dense projections scale like n d^2, attention scales like n^2 d, and long context changes the bottleneck.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['term breakdown', 'context crossover'], defaultValue: 'term breakdown' },
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

function costPlot(markers = []) {
  const d = 4096;
  const tokenCounts = [512, 1024, 2048, 4096, 8192, 16384, 24576, 32768, 65536];
  const dense = tokenCounts.map((n) => ({ x: n, y: (24 * n * d * d) / 1e12 }));
  const attention = tokenCounts.map((n) => ({ x: n, y: (4 * n * n * d) / 1e12 }));
  return plotState({
    axes: {
      x: { label: 'context tokens n', min: 0, max: 68000 },
      y: { label: 'relative TFLOPs per layer', min: 0, max: 75 },
    },
    series: [
      { id: 'dense', label: 'dense terms: 24 n d^2', points: dense },
      { id: 'attention', label: 'attention terms: 4 n^2 d', points: attention },
    ],
    markers,
  });
}

function* termBreakdown() {
  const d = 4096;
  const denseCoeff = 24;
  const attnCoeff = 4;
  const crossover = 6 * d;
  const qkvTerms = 3;         // Q, K, V each 2 n d^2
  const mlpWidth = 4;         // MLP is 4d wide
  const optimizations = ['FlashAttention', 'GQA', 'windowing', 'MoE', 'quantization'];

  yield {
    state: labelMatrix(
      'Decoder layer forward-pass terms',
      [
        { id: 'qkv', label: 'QKV' },
        { id: 'out', label: 'O proj' },
        { id: 'mlp', label: 'MLP' },
        { id: 'scores', label: 'QK' },
        { id: 'mix', label: 'AV' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'term', label: 'cost term' },
        { id: 'scales', label: 'axis' },
      ],
      [
        ['tok x d', '6 n d^2', 'n,d'],
        ['tok x d', '2 n d^2', 'n,d'],
        ['4d MLP', '16 n d^2', 'n,d'],
        ['pairs', '2 n^2 d', 'n^2'],
        ['pairs', '2 n^2 d', 'n^2'],
      ],
    ),
    highlight: { active: ['qkv:term', 'out:term', 'mlp:term'], compare: ['scores:term', 'mix:term'] },
    explanation: `The useful split is dense work versus pairwise work. ${qkvTerms} projections and the ${mlpWidth}d MLP scale with n d^2 (coefficient ${denseCoeff}). Attention scores and value mixing scale with n^2 d (coefficient ${attnCoeff}).`,
    invariant: `A rough decoder-layer estimate is ${denseCoeff} n d^2 + ${attnCoeff} n^2 d.`,
  };

  yield {
    state: labelMatrix(
      'Which optimization touches which term',
      [
        { id: 'flash', label: 'Flash' },
        { id: 'gqa', label: 'GQA/MQA' },
        { id: 'window', label: 'window' },
        { id: 'moe', label: 'MoE FFN' },
        { id: 'quant', label: 'quantization' },
      ],
      [
        { id: 'main', label: 'target' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['attn IO', 'fewer trips'],
        ['KV heads', 'less cache'],
        ['pairs', 'n^2 to n w'],
        ['MLP', 'fewer FFNs'],
        ['bytes', 'higher AI'],
      ],
    ),
    highlight: { active: ['flash:main', 'window:effect'], found: ['gqa:effect', 'moe:effect', 'quant:effect'] },
    explanation: `${optimizations.length} different tricks attack different terms. A clean cost model prevents category errors: ${optimizations[0]} improves attention IO, while grouped-query attention mainly reduces KV cache traffic during decode.`,
  };

  yield {
    state: labelMatrix(
      'Training, prefill, and cached decode use different accounting',
      [
        { id: 'train', label: 'training' },
        { id: 'prefill', label: 'prefill' },
        { id: 'decode', label: 'decode' },
        { id: 'long', label: 'long ctx' },
      ],
      [
        { id: 'parallelism', label: 'shape' },
        { id: 'dominant', label: 'question' },
      ],
      [
        ['all tokens', 'acts + FLOPs'],
        ['prompt', 'TTFT'],
        ['one token', 'bytes moved'],
        ['many old', 'KV capacity'],
      ],
    ),
    highlight: { active: ['prefill:dominant', 'decode:dominant'], compare: ['train:dominant', 'long:dominant'] },
    explanation: `The same transformer block changes character by phase. A formula based on ${denseCoeff} n d^2 + ${attnCoeff} n^2 d is not enough to explain decode latency, because cached decode is often limited by bytes moved.`,
  };
}

function* contextCrossover() {
  const d = 4096;
  const crossover = 6 * d;
  const denseCoeff = 24;
  const attnCoeff = 4;

  yield {
    state: costPlot([
      { id: 'short', x: 4096, y: 1.7, label: '4k prompt' },
      { id: 'cross', x: 24576, y: 9.9, label: 'n = 6d' },
    ]),
    highlight: { active: ['dense'], compare: ['attention'], found: ['short', 'cross'] },
    explanation: `With d fixed at ${d}, dense terms dominate typical short contexts. The attention curve catches up near n = ${crossover.toLocaleString()} (6d) because n^2 d eventually beats n d^2.`,
  };

  yield {
    state: costPlot([
      { id: 'rag', x: 8192, y: 3.3, label: 'RAG prompt' },
      { id: 'agent', x: 32768, y: 17.6, label: 'agent trace' },
      { id: 'book', x: 65536, y: 70.4, label: 'book context' },
    ]),
    highlight: { active: ['attention'], compare: ['dense'], found: ['agent', 'book'] },
    explanation: `Long context makes the ${attnCoeff} n^2 d attention term visible in the bill. Past the crossover at n = ${crossover.toLocaleString()}, adding tokens is not just more input; it creates many more token pairs.`,
  };

  yield {
    state: labelMatrix(
      'Design reading from the formula',
      [
        { id: 'short', label: 'chat' },
        { id: 'rag', label: 'RAG' },
        { id: 'agent', label: 'agent' },
        { id: 'corpus', label: 'corpus' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'first lever', label: 'lever' },
      ],
      [
        ['small n', 'batch + quant'],
        ['repeat prefix', 'prefix cache'],
        ['large state', 'KV policy'],
        ['huge n', 'window/RAG'],
      ],
    ),
    highlight: { found: ['short:first lever', 'rag:first lever', 'agent:first lever', 'corpus:first lever'] },
    explanation: `The ${denseCoeff} n d^2 + ${attnCoeff} n^2 d formula becomes an architecture map. Short prompts want throughput. Repeated prompts want reuse. Very long prompts (past ${crossover.toLocaleString()} tokens) need a context policy, not only a faster kernel.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'term breakdown') yield* termBreakdown();
  else if (view === 'context crossover') yield* contextCrossover();
  else throw new InputError('Pick a transformer FLOPs view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The tables split one decoder layer into dense terms and pairwise attention terms. Dense terms scale with tokens times width squared, while attention terms scale with token pairs times width.',
        'The plot fixes model width d and grows context length n. Watch the dense curve rise linearly and the attention curve bend upward quadratically as long context makes token pairs dominate.',
        {type: 'callout', text: 'A FLOPs model is useful only when it names the tensor shape. Dense terms grow with tokens times width squared; attention terms grow with token pairs times width.'},
        {type: 'image', src: './assets/gifs/transformer-layer-flops-cost-model.gif', alt: 'Animated walkthrough of the transformer layer flops cost model visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Transformer cost sounds singular until serving decisions force you to separate prompt length, model width, attention pairs, MLP width, KV cache, and bytes moved. A layer FLOPs model gives the first clean accounting before hardware effects enter.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/The-Transformer-model-architecture.png/250px-The-Transformer-model-architecture.png', alt: 'Transformer encoder-decoder architecture diagram.', caption: 'The architecture diagram gives each cost term a home: projections, attention, feed-forward blocks, residual paths, and normalization all live inside the repeated layer. Source: Wikimedia Commons, Llion Jones, CC BY 4.0.'},
        'For a common dense decoder layer, a rough forward-pass formula is 24 n d^2 + 4 n^2 d. The constants vary by architecture, but the split between per-token dense work and pairwise attention work is the durable lesson.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious shortcut is to say attention is quadratic and stop. That is true about the n^2 term, but it hides that QKV projections, output projection, and the MLP can dominate when d is large and n is modest.',
        'The second shortcut is to treat FLOPs as latency. FLOPs explain arithmetic, but cached decode can be limited by memory bandwidth and KV-cache residency rather than raw operation count.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Without a shape-aware model, teams optimize the wrong term. FlashAttention helps attention IO, grouped-query attention reduces KV bytes, quantization reduces bytes per weight, and mixture-of-experts changes active MLP work.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Example_of_a_naive_Roofline_model.svg/330px-Example_of_a_naive_Roofline_model.svg.png', alt: 'Naive roofline chart showing memory and compute limits.', caption: 'The FLOPs formula tells you arithmetic shape; a roofline adds the missing hardware question of whether those FLOPs are fed by enough byte reuse. Source: Wikimedia Commons, Tanzima, CC BY-SA 4.0.'},
        'Long context is the visible failure case. At short context, width-squared dense work can dominate; at very long context, token-pair work can overtake it even when the model weights are unchanged.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Dense work multiplies each token row by learned matrices, giving n d^2 terms. Attention compares token rows to token rows and mixes values over pairs, giving n^2 d terms.',
        'Setting 24 n d^2 equal to 4 n^2 d gives n = 6d. For d = 4096, the rough arithmetic crossover is about 24,576 tokens.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Q, K, and V projections cost about 6 n d^2 FLOPs, and the output projection costs about 2 n d^2. A 4d feed-forward block costs about 16 n d^2, so dense terms sum to about 24 n d^2.',
        'Attention scores QK^T cost about 2 n^2 d, and applying weights to values costs another 2 n^2 d. Together they contribute about 4 n^2 d, which becomes large when n grows past the width scale.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The model works because tensor dimensions determine multiply counts. Multiplying an n by d activation matrix by a d by d weight matrix creates n rows times d squared work.',
        'Attention creates an n by n score matrix. Each pairwise score and value mix touches d-sized vectors, so token pairs times width gives the n^2 d term.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For n = 4096 and d = 4096, dense work is about 24 * 4096 * 4096^2, or 1.65 trillion FLOPs per layer. Attention is about 4 * 4096^2 * 4096, or 0.27 trillion FLOPs.',
        'If n doubles from 4096 to 8192, dense work doubles but attention work quadruples. That behavior is why long-context features need a cost model, not only a maximum context length in a product spec.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Use this model to size long-prompt features, compare prefix caching against bigger GPUs, and explain why document-scale prompts are not just longer chats. It turns architecture choices into named cost terms.',
        'It is also a review tool for optimization claims. A method should say whether it changes dense FLOPs, attention pairs, bytes moved, KV cache size, or scheduling behavior.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The formula is not a benchmark. It excludes kernel efficiency, memory bandwidth, tensor-parallel communication, queueing, cache fragmentation, and framework overhead.',
        'It also changes with architecture. Gated MLPs, grouped-query attention, multi-query attention, mixture-of-experts, sparse attention, and sliding windows alter constants or terms, so the formula must be adapted before making decisions.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'With d = 4096 and n = 4096, dense work is about 1.65 TFLOPs per layer and attention is about 0.27 TFLOPs. Dense arithmetic is roughly six times larger at this context length.',
        'With the same d and n = 32768, dense work rises to about 13.2 TFLOPs, but attention rises to about 17.6 TFLOPs. The model did not change; the prompt length changed which term owns the arithmetic bill.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Vaswani et al., Attention Is All You Need; Pope et al., Efficiently Scaling Transformer Inference; and the JAX Scaling Book transformer and inference chapters. FlashAttention is the key source for IO-aware attention costs.',
        'Study the Transformer block, attention, transformer inference roofline, KV cache, grouped-query attention, prefix caching, sliding-window attention, continuous batching, and prefill/decode disaggregation next.',
      ],
    },
  ],
};
