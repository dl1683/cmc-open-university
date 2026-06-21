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
    explanation: 'The useful split is dense work versus pairwise work. Projections and the MLP scale with n d^2. Attention scores and value mixing scale with n^2 d.',
    invariant: 'A rough decoder-layer estimate is 24 n d^2 + 4 n^2 d.',
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
    explanation: 'Different tricks attack different terms. A clean cost model prevents category errors: FlashAttention improves attention IO, while grouped-query attention mainly reduces KV cache traffic during decode.',
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
    explanation: 'The same transformer block changes character by phase. A formula for prompt FLOPs is not enough to explain decode latency, because cached decode is often limited by bytes moved.',
  };
}

function* contextCrossover() {
  yield {
    state: costPlot([
      { id: 'short', x: 4096, y: 1.7, label: '4k prompt' },
      { id: 'cross', x: 24576, y: 9.9, label: 'n = 6d' },
    ]),
    highlight: { active: ['dense'], compare: ['attention'], found: ['short', 'cross'] },
    explanation: 'With d fixed at 4096, dense terms dominate typical short contexts. The attention curve catches up near n = 6d because n^2 d eventually beats n d^2.',
  };

  yield {
    state: costPlot([
      { id: 'rag', x: 8192, y: 3.3, label: 'RAG prompt' },
      { id: 'agent', x: 32768, y: 17.6, label: 'agent trace' },
      { id: 'book', x: 65536, y: 70.4, label: 'book context' },
    ]),
    highlight: { active: ['attention'], compare: ['dense'], found: ['agent', 'book'] },
    explanation: 'Long context makes attention visible in the bill. Past a threshold, adding tokens is not just more input; it creates many more token pairs.',
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
    explanation: 'The formula becomes an architecture map. Short prompts want throughput. Repeated prompts want reuse. Very long prompts need a context policy, not only a faster kernel.',
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
        "Read the animation as the execution trace for Transformer Layer FLOPs Cost Model. A decoder-layer cost primer: why dense projections scale like n d^2, attention scales like n^2 d, and long context changes the bottleneck..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
        {type: "callout", text: "A FLOPs model is useful only when it names the tensor shape. Dense terms grow with tokens times width squared; attention terms grow with token pairs times width."},
      ],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `Transformer inference sounds like one cost until you try to make a serving decision. Then the word hides several different bills: dense matrix multiplies, attention over token pairs, KV-cache reads, activation movement, batching overhead, and queueing. A simple FLOPs model is useful because it separates the arithmetic shape before hardware details enter the argument.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/The-Transformer-model-architecture.png/250px-The-Transformer-model-architecture.png`, alt: `Transformer encoder-decoder architecture diagram.`, caption: `The architecture diagram gives each cost term a home: projections, attention, feed-forward blocks, residual paths, and normalization all live inside the repeated layer. Source: Wikimedia Commons, Llion Jones, CC BY 4.0.`},
        `This article focuses on one decoder layer. Let n be the number of prompt tokens and d be the model width. For a common dense transformer block with Q, K, V, output projection, and a feed-forward layer about four times wider than d, a rough forward-pass estimate is 24 n d^2 + 4 n^2 d. The constants are not universal, but the split is durable.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The common shortcut is to say attention is quadratic and stop there. That is partly true and often misleading. Attention has an n^2 term, but a normal decoder layer also has several n d^2 terms. When d is large and n is modest, the dense projections and MLP can dominate arithmetic. When n becomes very large, the pairwise term catches up and then passes them.`,
        `The second shortcut is to treat FLOPs as latency. FLOPs describe arithmetic work, especially in training and prompt prefill. Cached decode often waits on bytes: model weights, KV cache pages, memory bandwidth, kernel launch overhead, and scheduler decisions. A FLOPs model is the first map, not the whole serving system.`,
      ],
    },
    {
      heading: `The core split`,
      paragraphs: [
        `Dense work treats tokens mostly independently. Q, K, V, the attention output projection, and the MLP multiply each token representation by learned matrices. That is why their leading terms look like n d^2: more tokens means more rows, and wider models mean much larger matrices.`,
        `Attention is different. A query token compares against keys from other tokens, then uses those scores to mix values. In a full causal prompt, each new token can attend to many previous tokens, so the number of relationships grows with token pairs. That is where n^2 d comes from. The formula is not a theorem about every architecture; it is a clean way to separate per-token dense work from pairwise attention work.`,
      ],
    },
    {
      heading: `The rough formula`,
      paragraphs: [
        `A rough forward pass for one layer is 6 n d^2 for QKV, 2 n d^2 for the output projection, 16 n d^2 for a 4d feed-forward block, 2 n^2 d for QK scores, and 2 n^2 d for attention-value mixing. Added together, that gives 24 n d^2 + 4 n^2 d.`,
        `The important move is not memorizing 24 and 4. Different model families change multipliers with gated MLPs, grouped-query attention, mixture-of-experts, sparse attention, or sliding windows. The important move is asking which term a design decision actually changes. Quantization changes bytes and sometimes dense throughput. Windowing changes the attention pair count. Prefix caching changes repeated prompt work.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The first matrix separates dense rows from attention rows. QKV, output projection, and MLP are per-token matrix work. QK and AV are pairwise attention work. The optimizer matrix then prevents category errors: FlashAttention improves attention IO and materialization, grouped-query attention mainly reduces KV-cache size and bandwidth during serving, and mixture-of-experts changes which feed-forward experts run.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Example_of_a_naive_Roofline_model.svg/330px-Example_of_a_naive_Roofline_model.svg.png`, alt: `Naive roofline chart showing memory and compute limits.`, caption: `The FLOPs formula tells you arithmetic shape; a roofline adds the missing hardware question of whether those FLOPs are fed by enough byte reuse. Source: Wikimedia Commons, Tanzima, CC BY-SA 4.0.`},
        `The plot fixes d at 4096 and grows n. Dense terms rise linearly with n. Attention rises quadratically. Setting 24 n d^2 equal to 4 n^2 d gives n = 6d, so the crossover is around 24k tokens for d = 4096. A 4k chat, a 32k agent run, and a 128k document prompt are different workload shapes, not just bigger versions of the same request.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The model works because transformer layers are built from repeated matrix products whose shapes are visible. Multiplying n token vectors by d-by-d matrices creates n d^2 style work. Multiplying queries against keys creates a token-by-token score matrix, so the number of interactions grows like n^2. This is the same kind of reasoning used in basic algorithm analysis, but with tensor dimensions instead of list lengths.`,
        `The formula also explains why a fixed model can change bottlenecks as product behavior changes. If users mostly send short prompts, model width and dense throughput matter. If agents keep appending long histories, attention pairs and KV-cache capacity become visible. If traffic repeats the same system prompt, prefix reuse can matter more than raw arithmetic.`,
      ],
    },
    {
      heading: `Serving phases`,
      paragraphs: [
        `Training, prefill, and decode use the same layer but not the same accounting. Training processes many tokens and stores activations for backward pass. Prefill consumes the prompt in parallel and strongly exposes prompt FLOPs. Decode generates one token at a time while reusing old K and V vectors, so it often exposes memory bandwidth and cache movement rather than pure arithmetic.`,
        `This distinction matters in system design. A faster prefill kernel can lower time to first token for long prompts. A better KV-cache layout can increase concurrent decode capacity. Continuous batching can improve GPU utilization while many users decode. A single FLOPs number cannot tell those stories unless it is tied to the phase being measured.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Every lever has a cost. Windowed attention bounds the pair count but may remove useful distant context. Retrieval keeps n smaller but depends on chunking, ranking, and citation discipline. Prefix caching helps repeated prompts but adds cache lookup, invalidation, and memory pressure. Quantization improves memory traffic and capacity but can hurt quality if applied carelessly.`,
        `Grouped-query and multi-query attention reduce KV-cache footprint by sharing keys and values across query heads, but they change architecture assumptions. Mixture-of-experts can reduce active feed-forward work per token while adding routing, load balancing, expert placement, and communication costs. The formula helps by making each tradeoff name the term it attacks.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Use this model during early sizing. It helps estimate whether a long-context feature is likely to be a kernel problem, a cache policy problem, or a product-context problem. It also helps compare two ideas that sound similar. A request router, a prefix cache, a sliding window, and a bigger GPU all improve different parts of the serving stack.`,
        `It is especially useful when a team is tempted to buy context length as if it were free. Long context can be valuable, but the cost curve is not linear once full attention dominates. The correct question is not "can the model accept this many tokens?" The correct question is whether those tokens are worth their arithmetic, memory, and latency cost.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Do not use this as a benchmark replacement. Real latency includes memory bandwidth, tensor parallel communication, request queueing, p99 tail effects, cache fragmentation, scheduler policy, network transfer, and framework overhead. A layer can have modest FLOPs and still be slow if decode is memory-bound or if cache pages are scattered.`,
        `Also avoid treating FlashAttention as if it removes the mathematical n^2 relationship. It changes how attention is computed and stored so the GPU does less wasteful memory movement. That is a major win, but it does not make every very long context cheap. The same caution applies to any single optimization: it improves one part of the stack, not the whole serving problem.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `Use d = 4096 and n = 4096. Dense work is about 24 * 4096 * 4096^2, or 1.65 trillion FLOPs per layer. Attention work is about 4 * 4096^2 * 4096, or 0.27 trillion FLOPs per layer. At this context length, dense terms still dominate arithmetic.`,
        `Now raise n to 32768 with the same model width. Dense work grows 8x to about 13.2 trillion FLOPs, but attention grows 64x to about 17.6 trillion FLOPs. The model did not change; the prompt shape changed which term owns the bill.`,
        `This is why long-context product choices cannot be judged from a short-prompt benchmark. The same layer can look dense-dominated in chat and attention-dominated in agent traces or document analysis.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study The Transformer Block and Attention Mechanism to connect each term to layer structure. Then read Transformer Inference Roofline, KV Cache, Grouped-Query Attention, FlashAttention Case Study, Prefix Caching & RadixAttention, Sliding-Window Attention Context Policy, KV Cache Concurrency Capacity Model, LLM Continuous Batching, Prefill/Decode Disaggregation Case Study, and LLM Inference Cost Stack Case Study.`,
        `Primary sources worth reading are Attention Is All You Need at https://arxiv.org/abs/1706.03762, the JAX scaling book chapters on transformer and inference math at https://jax-ml.github.io/scaling-book/transformers/ and https://jax-ml.github.io/scaling-book/inference/, Efficiently Scaling Transformer Inference at https://arxiv.org/abs/2211.05102, and FlashAttention at https://arxiv.org/abs/2205.14135.`,
      ],
    },
],
};

