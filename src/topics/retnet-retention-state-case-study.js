// RetNet retention state: decay-weighted recurrent memory with parallel,
// recurrent, and chunkwise execution views.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'retnet-retention-state-case-study',
  title: 'RetNet Retention State Case Study',
  category: 'Papers',
  summary: 'A RetNet case study: decay-weighted retention state, multi-scale heads, parallel training, recurrent decode, and chunkwise long-context execution.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['retention state', 'execution modes', 'deployment fit'], defaultValue: 'retention state' },
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

function retentionGraph(title) {
  return graphState({
    nodes: [
      { id: 'x', label: 'x_t', x: 0.7, y: 3.8, note: 'token' },
      { id: 'q', label: 'Q', x: 2.4, y: 2.2, note: 'read' },
      { id: 'k', label: 'K', x: 2.4, y: 3.8, note: 'addr' },
      { id: 'v', label: 'V', x: 2.4, y: 5.4, note: 'data' },
      { id: 'decay', label: 'decay', x: 4.5, y: 3.0, note: 'gamma' },
      { id: 'write', label: 'write', x: 4.5, y: 4.8, note: 'K x V' },
      { id: 'state', label: 'ret state', x: 6.8, y: 3.8, note: 'matrix' },
      { id: 'out', label: 'y_t', x: 9.0, y: 3.8, note: 'output' },
    ],
    edges: [
      { id: 'e-x-q', from: 'x', to: 'q' },
      { id: 'e-x-k', from: 'x', to: 'k' },
      { id: 'e-x-v', from: 'x', to: 'v' },
      { id: 'e-k-write', from: 'k', to: 'write' },
      { id: 'e-v-write', from: 'v', to: 'write' },
      { id: 'e-decay-state', from: 'decay', to: 'state' },
      { id: 'e-write-state', from: 'write', to: 'state' },
      { id: 'e-q-state', from: 'q', to: 'state' },
      { id: 'e-state-out', from: 'state', to: 'out' },
    ],
  }, { title });
}

function chunkGraph(title) {
  return graphState({
    nodes: [
      { id: 'c1', label: 'chunk 1', x: 0.8, y: 2.4, note: 'parallel' },
      { id: 's1', label: 'sum 1', x: 2.8, y: 2.4, note: 'state' },
      { id: 'c2', label: 'chunk 2', x: 0.8, y: 4.2, note: 'parallel' },
      { id: 's2', label: 'sum 2', x: 2.8, y: 4.2, note: 'state' },
      { id: 'c3', label: 'chunk 3', x: 0.8, y: 6.0, note: 'parallel' },
      { id: 's3', label: 'sum 3', x: 2.8, y: 6.0, note: 'state' },
      { id: 'scan', label: 'scan', x: 5.0, y: 4.2, note: 'carry' },
      { id: 'read', label: 'local read', x: 7.0, y: 4.2, note: 'inside' },
      { id: 'out', label: 'tokens', x: 9.0, y: 4.2, note: 'outputs' },
    ],
    edges: [
      { id: 'e-c1-s1', from: 'c1', to: 's1' },
      { id: 'e-c2-s2', from: 'c2', to: 's2' },
      { id: 'e-c3-s3', from: 'c3', to: 's3' },
      { id: 'e-s1-scan', from: 's1', to: 'scan' },
      { id: 'e-s2-scan', from: 's2', to: 'scan' },
      { id: 'e-s3-scan', from: 's3', to: 'scan' },
      { id: 'e-scan-read', from: 'scan', to: 'read' },
      { id: 'e-read-out', from: 'read', to: 'out' },
    ],
  }, { title });
}

function* retentionState() {
  yield {
    state: retentionGraph('Retention replaces token list reads with a state'),
    highlight: { active: ['k', 'v', 'write', 'state', 'e-k-write', 'e-v-write', 'e-write-state'], found: ['out'], compare: ['q'] },
    explanation: 'RetNet keeps a decay-weighted retention state. Each token writes a key-value outer product into state, old state decays, and the next query reads the compressed history.',
    invariant: 'The data structure is not a KV list. It is a per-head recurrent summary of past key-value evidence.',
  };

  yield {
    state: labelMatrix(
      'State update row',
      [
        { id: 'old', label: 'old S' },
        { id: 'decay', label: 'decay' },
        { id: 'write', label: 'write' },
        { id: 'read', label: 'read' },
        { id: 'next', label: 'next S' },
      ],
      [
        { id: 'stored', label: 'stored' },
        { id: 'op', label: 'op' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['history', 'carry', 'stale'],
        ['gamma*S', 'forget', 'short'],
        ['KxV', 'add', 'noise'],
        ['Q*S', 'lookup', 'blur'],
        ['state', 'keep', 'drift'],
      ],
    ),
    highlight: { active: ['decay:op', 'write:op', 'next:stored'], compare: ['read:risk'] },
    explanation: 'The recurrent form is a small ledger: decay the old state, add the new key-value write, then read with the current query. The benefit is fixed-size state; the cost is compressed memory.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'tokens back', min: 0, max: 12 }, y: { label: 'retention', min: 0, max: 1 } },
      series: [
        { id: 'fast', label: 'fast head', points: [
          { x: 0, y: 1.0 }, { x: 2, y: 0.42 }, { x: 4, y: 0.18 }, { x: 6, y: 0.08 }, { x: 8, y: 0.03 }, { x: 10, y: 0.01 },
        ] },
        { id: 'mid', label: 'mid head', points: [
          { x: 0, y: 1.0 }, { x: 2, y: 0.68 }, { x: 4, y: 0.46 }, { x: 6, y: 0.31 }, { x: 8, y: 0.21 }, { x: 10, y: 0.14 },
        ] },
        { id: 'slow', label: 'slow head', points: [
          { x: 0, y: 1.0 }, { x: 2, y: 0.88 }, { x: 4, y: 0.78 }, { x: 6, y: 0.69 }, { x: 8, y: 0.61 }, { x: 10, y: 0.54 },
        ] },
      ],
      markers: [
        { id: 'multi', x: 8, y: 0.61, label: 'multi-scale' },
      ],
    }),
    highlight: { active: ['fast', 'mid', 'slow'], found: ['multi'] },
    explanation: 'Multi-scale retention gives different heads different decay horizons. Some channels behave like short memory; others carry older evidence longer. This is how RetNet avoids one global forgetting rate.',
  };

  yield {
    state: labelMatrix(
      'Memory forms',
      [
        { id: 'attn', label: 'attention' },
        { id: 'rwkv', label: 'RWKV' },
        { id: 'mamba', label: 'Mamba' },
        { id: 'retnet', label: 'RetNet' },
      ],
      [
        { id: 'stored', label: 'keeps' },
        { id: 'read', label: 'read' },
        { id: 'trade', label: 'risk' },
      ],
      [
        ['KV', 'smx', 'cost'],
        ['state', 'gate', 'blur'],
        ['state', 'sel', 'kernel'],
        ['S', 'Q*S', 'gamma'],
      ],
    ),
    highlight: { active: ['retnet:stored', 'retnet:read'], compare: ['attn:stored'] },
    explanation: 'RetNet belongs beside RWKV and Mamba, but its state has a distinct attention-like shape: queries read a decay-weighted key-value summary rather than a raw hidden vector alone.',
  };

  yield {
    state: retentionGraph('The contract is compressed recall, not exact recall'),
    highlight: { active: ['state', 'decay', 'write', 'e-decay-state', 'e-write-state'], found: ['out'], compare: ['q', 'k', 'v'] },
    explanation: 'The clean mental model: RetNet turns long context into a rolling state. That can reduce decode memory, but tasks needing exact old-token lookup must prove the state preserved the needed fact.',
  };
}

function* executionModes() {
  yield {
    state: labelMatrix(
      'Three views',
      [
        { id: 'parallel', label: 'parallel' },
        { id: 'recur', label: 'recurrent' },
        { id: 'chunk', label: 'chunkwise' },
      ],
      [
        { id: 'best', label: 'use' },
        { id: 'state', label: 'state' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['train', 'all tok', 'wide'],
        ['decode', 'one S', 'fixed'],
        ['long', 'ch S', 'linear'],
      ],
    ),
    highlight: { active: ['parallel:best', 'recur:best', 'chunk:best'], found: ['recur:state'] },
    explanation: 'The rows are schedules for the same retention rule. Training wants wide parallel work, decoding wants one carried state, and long sequences need chunk summaries so the scan does not become a serial bottleneck.',
    invariant: 'The same retention math can be scheduled differently for training and serving.',
  };

  yield {
    state: labelMatrix(
      'Parallel retention map',
      [
        { id: 't1', label: 't1' },
        { id: 't2', label: 't2' },
        { id: 't3', label: 't3' },
        { id: 't4', label: 't4' },
      ],
      [
        { id: 'k1', label: 'k1' },
        { id: 'k2', label: 'k2' },
        { id: 'k3', label: 'k3' },
        { id: 'k4', label: 'k4' },
      ],
      [
        ['1', '', '', ''],
        ['g', '1', '', ''],
        ['g2', 'g', '1', ''],
        ['g3', 'g2', 'g', '1'],
      ],
    ),
    highlight: { active: ['t4:k1', 't4:k2', 't4:k3', 't4:k4'], compare: ['t1:k1'] },
    explanation: 'In parallel form, the retention weights look like a causal lower-triangular map. Older keys are still visible, but they are discounted by powers of the decay factor.',
  };

  yield {
    state: retentionGraph('Recurrent decode updates one state per token'),
    highlight: { active: ['decay', 'write', 'state', 'out', 'e-decay-state', 'e-write-state', 'e-state-out'], compare: ['q'] },
    explanation: 'In recurrent decode, the runtime does not append a KV row for every past token. It updates the retention state once and carries that state to the next token.',
  };

  yield {
    state: chunkGraph('Chunkwise mode mixes local parallelism with carried state'),
    highlight: { active: ['c1', 'c2', 'c3', 's1', 's2', 's3'], found: ['scan', 'read'], compare: ['out'] },
    explanation: 'Chunkwise mode is the compromise. Tokens inside a chunk can run in parallel, but each chunk still exports a summary that later chunks depend on. Boundary tests matter because the carried state is compressed.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'seq len', min: 0, max: 145 }, y: { label: 'bytes', min: 0, max: 108 } },
      series: [
        { id: 'kv', label: 'KV', points: [
          { x: 8, y: 6 }, { x: 16, y: 12 }, { x: 32, y: 25 }, { x: 64, y: 50 }, { x: 128, y: 100 },
        ] },
        { id: 'ret', label: 'Ret S', points: [
          { x: 8, y: 9 }, { x: 16, y: 9 }, { x: 32, y: 9 }, { x: 64, y: 9 }, { x: 128, y: 9 },
        ] },
        { id: 'chunk', label: 'chunk', points: [
          { x: 8, y: 10 }, { x: 16, y: 12 }, { x: 32, y: 16 }, { x: 64, y: 24 }, { x: 128, y: 40 },
        ] },
      ],
      markers: [
        { id: 'cap', x: 128, y: 9, label: 'fixed' },
      ],
    }),
    highlight: { active: ['ret', 'chunk'], compare: ['kv'], found: ['cap'] },
    explanation: 'The serving appeal is memory shape. A Transformer cache grows with context. RetNet recurrent decode carries fixed state, while chunkwise mode adds bounded summaries for long training or batched processing.',
  };
}

function* deploymentFit() {
  yield {
    state: graphState({
      nodes: [
        { id: 'workload', label: 'workload', x: 0.7, y: 3.8, note: 'long ctx' },
        { id: 'need', label: 'recall need', x: 2.6, y: 2.8, note: 'exact?' },
        { id: 'budget', label: 'HBM cap', x: 2.6, y: 4.8, note: 'bytes' },
        { id: 'route', label: 'route', x: 4.6, y: 3.8, note: 'model' },
        { id: 'retnet', label: 'RetNet', x: 6.7, y: 2.6, note: 'state' },
        { id: 'hybrid', label: 'hybrid', x: 6.7, y: 4.0, note: 'some attn' },
        { id: 'full', label: 'full attn', x: 6.7, y: 5.4, note: 'KV' },
        { id: 'eval', label: 'eval', x: 8.9, y: 3.8, note: 'prove' },
      ],
      edges: [
        { id: 'e-work-need', from: 'workload', to: 'need' },
        { id: 'e-work-budget', from: 'workload', to: 'budget' },
        { id: 'e-need-route', from: 'need', to: 'route' },
        { id: 'e-budget-route', from: 'budget', to: 'route' },
        { id: 'e-route-retnet', from: 'route', to: 'retnet' },
        { id: 'e-route-hybrid', from: 'route', to: 'hybrid' },
        { id: 'e-route-full', from: 'route', to: 'full' },
        { id: 'e-retnet-eval', from: 'retnet', to: 'eval' },
        { id: 'e-hybrid-eval', from: 'hybrid', to: 'eval' },
        { id: 'e-full-eval', from: 'full', to: 'eval' },
      ],
    }, { title: 'A RetNet migration is a route decision' }),
    highlight: { active: ['workload', 'budget', 'route', 'retnet'], found: ['eval'], compare: ['full'] },
    explanation: 'RetNet is attractive when long-context memory is the bottleneck. But the route still depends on exact-recall needs, kernel maturity, quantization, and task slices.',
  };

  yield {
    state: labelMatrix(
      'Fit ledger',
      [
        { id: 'stream', label: 'streaming' },
        { id: 'needle', label: 'needle' },
        { id: 'edge', label: 'edge' },
        { id: 'kernel', label: 'kernel' },
        { id: 'eval', label: 'eval' },
      ],
      [
        { id: 'good', label: 'good' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['fixed S', 'blur'],
        ['maybe', 'exact miss'],
        ['low mem', 'INT drift'],
        ['scan path', 'fallback'],
        ['slice win', 'avg hides'],
      ],
    ),
    highlight: { active: ['stream:good', 'edge:good', 'kernel:good'], compare: ['needle:risk', 'eval:risk'] },
    explanation: 'The production ledger should separate where RetNet should win from where it can fail. Streaming and edge memory are natural fits; exact retrieval and weak kernels are danger zones.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'memory', min: 0, max: 10 }, y: { label: 'recall', min: 0, max: 1 } },
      series: [
        { id: 'frontier', label: 'frontier', points: [
          { x: 1.2, y: 0.58 }, { x: 2.2, y: 0.68 }, { x: 4.5, y: 0.82 }, { x: 7.5, y: 0.91 }, { x: 9.5, y: 0.95 },
        ] },
      ],
      markers: [
        { id: 'ret', x: 1.5, y: 0.62, label: 'RetNet' },
        { id: 'mix', x: 4.6, y: 0.83, label: 'hybrid' },
        { id: 'attn', x: 9.2, y: 0.94, label: 'full attn' },
      ],
    }),
    highlight: { active: ['frontier', 'ret', 'mix'], compare: ['attn'] },
    explanation: 'For product architecture, the right question is not whether attention or retention wins universally. The useful answer is the memory-recall frontier for your workload.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'gamma', label: 'gamma' },
        { id: 'state', label: 'state cap' },
        { id: 'chunk', label: 'chunk' },
        { id: 'quant', label: 'quant' },
        { id: 'bench', label: 'bench' },
      ],
      [
        { id: 'bug', label: 'bug' },
        { id: 'test', label: 'test' },
      ],
      [
        ['fast', 'QA'],
        ['small', 'needle'],
        ['cut', 'bound'],
        ['drift', 'INT'],
        ['avg', 'slice'],
      ],
    ),
    highlight: { active: ['gamma:test', 'state:test', 'chunk:test', 'quant:test'], found: ['bench:test'] },
    explanation: 'Retention can fail quietly. The evaluation suite needs long QA, needle retrieval, boundary tests, quantized serving sweeps, and protected slices instead of one aggregate score.',
  };

  yield {
    state: chunkGraph('Study RetNet as one branch of the state-budget family'),
    highlight: { active: ['scan', 'read', 'out', 'e-scan-read', 'e-read-out'], found: ['s1', 's2', 's3'], compare: ['c1', 'c2', 'c3'] },
    explanation: 'RetNet completes a useful sequence-model ladder: full attention stores exact KV rows, RWKV and Mamba store recurrent state, RetNet stores decay-weighted retention state, and hybrid systems decide how much exact attention remains.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'retention state') yield* retentionState();
  else if (view === 'execution modes') yield* executionModes();
  else if (view === 'deployment fit') yield* deploymentFit();
  else throw new InputError('Pick a RetNet view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read the RetNet frames as a memory contract. Active nodes show the current token being projected into query, key, and value terms; found nodes show the carried retention state or output; compare nodes mark what full attention would have stored explicitly.',
      'Retention state means compressed recurrent memory. The safe inference rule is: if the state update applies the same decay, write, and read rule as the parallel form, the schedule changed but the retention computation stayed the same.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'RetNet, or Retentive Network, exists because Transformer serving stores a key-value cache that grows with context length. A key-value cache is the saved keys and values from earlier tokens, and it consumes accelerator memory for every active sequence.',
      'Long conversations, long documents, and high-concurrency serving can become memory-bound before they become compute-bound. RetNet tries to keep much of attention\'s useful history while carrying a bounded decay-weighted state during decoding.',
      {type:'callout', text:'RetNet turns long token history into a decay-weighted serving state so the same memory rule can train in parallel and decode with bounded cache pressure.'},
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is full attention. It keeps exact access to every previous token, which is valuable for quoting, copying, and precise long-range lookup.',
      'Another obvious approach is a plain recurrent neural network state. It keeps fixed memory during decoding, but classic recurrent models often lose long-range detail and train less efficiently at large scale. RetNet is an attempt to keep parallel training while offering recurrent serving.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is the memory growth of exact token history. For a decoder with 32 layers, 32 key-value heads, head dimension 128, and FP16 storage, one token costs 32 * 2 * 32 * 128 * 2 bytes, or 524288 bytes, across the cache. A 16000-token session is about 8 GB before batching overhead.',
      'That memory shape hurts batching. A server may have enough arithmetic throughput to generate tokens, but not enough high-bandwidth memory to keep many long caches resident. Sliding windows reduce memory but drop exact old context; retrieval adds another system with its own recall errors.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'RetNet replaces a growing list of old key-value rows with a retention state. Each token writes a key-value outer product into the state, the old state is multiplied by a decay factor, and the current query reads from the resulting matrix.',
      'The same rule has three schedules. Parallel mode supports training over many tokens, recurrent mode carries one state during decoding, and chunkwise mode processes local chunks in parallel while scanning summaries between chunks. The math is shared; the execution plan changes.',
    ] },
    { heading: 'How it works', paragraphs: [
      'At token t, the model computes a query Q, key K, and value V. The old retention state S is decayed by gamma, then the new write K x V is added, and the output is read by multiplying Q with S.',
      'Multi-scale retention gives different heads different decay horizons. A fast head may mostly remember nearby tokens, while a slow head keeps older evidence longer. This avoids one global forgetting rate and lets the model learn several memory time scales.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'It works when the task does not need exact old-token lookup for every decision. Many next-token decisions need topic, entity state, local syntax, and recent commitments more than they need a raw row for each old token.',
      'The correctness argument is schedule equivalence. If the recurrent update and the parallel lower-triangular retention computation produce the same weighted sum of past writes, then decoding with carried state is computing the same retention rule. The risk is not that recurrence is invalid; the risk is that compressed state did not preserve the fact the task needs.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The cost is exact recall. Full attention can compare a query against an old key directly, while RetNet can only use what survived in the compressed state. Slow decay preserves stale evidence; fast decay forgets useful evidence.',
      'The serving cost can be much flatter than a key-value cache, but it is not free. The retention state has per-layer and per-head matrices, chunkwise scans need kernels, and quantization can damage long-horizon state. Cost should be measured as memory per active session, p95 latency, throughput, and task recall by slice.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'RetNet-like memory is a fit for streaming generation, edge devices, always-on assistants, and long sessions where continuity matters more often than exact quotation. It is also useful as a design point in hybrid systems that combine local attention, recurrent state, and retrieval.',
      'The production question is not whether attention or retention wins universally. The useful question is how much exact token history the workload needs and how much compressed memory loss it can tolerate.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails on tasks that require exact old facts unless another mechanism preserves those facts. Legal quotation, code references, needle retrieval, and instruction exceptions can break if the key detail decays or is overwritten.',
      'It also fails when implementation details erase the theoretical win. Slow scan kernels, unstable decay, poor chunk boundaries, state quantization drift, and weak evaluation can make a lower-memory model worse in the product slices that matter.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Consider 100 concurrent sessions, each with 16000 tokens. With the cache arithmetic above, a full-attention model can require about 8 GB per session, or about 800 GB of key-value cache across those sessions. Even if grouped-query attention reduces that number, the memory still grows linearly with tokens.',
      'Now suppose a RetNet layer carries a 32-head state with 128 by 128 FP16 values per head. That is 32 * 128 * 128 * 2 bytes, or about 1 MB per layer, and 32 MB across 32 layers per session. The number is illustrative, but the behavior is the point: cache memory grows with context length, while recurrent state grows with model state size.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Retentive Network: A Successor to Transformer for Large Language Models at https://arxiv.org/abs/2307.08621, Microsoft Research publication page at https://www.microsoft.com/en-us/research/publication/retentive-network-a-successor-to-transformer-for-large-language-models/, and Microsoft TorchScale at https://github.com/microsoft/torchscale.',
      'Study Attention Mechanism, KV Cache, Transformer Inference Roofline, RWKV Recurrent Transformer, Selective State Space Models: Mamba, Kimi Linear Attention, Hybrid Attention State Budget Case Study, Titans Test-Time Neural Memory Case Study, and Benchmark Variance and Model Selection next.',
    ] },
  ],
};
