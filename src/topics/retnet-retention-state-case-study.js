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
    explanation: 'The RetNet paper emphasizes one mechanism with three execution views: parallel for training, recurrent for decoding, and chunkwise recurrent for long sequences.',
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
    explanation: 'Chunkwise recurrent mode is the bridge. Each chunk can be encoded in parallel, while summaries move across chunks through a recurrent scan. That gives long-sequence training a practical schedule.',
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
    {
      heading: 'What it is',
      paragraphs: [
        'RetNet, or Retentive Network, is a sequence-model architecture that replaces full self-attention with a retention mechanism. The goal is the same impossible triangle pursued by RWKV, Mamba, Kimi Linear, and other attention alternatives: train in parallel, decode with low memory, and keep competitive quality.',
        'The data structure at the center is a decay-weighted retention state. Instead of storing every previous key and value row as a growing KV Cache, each head maintains a recurrent summary. A new token writes key-value evidence into that state, the old state decays, and the current query reads from the summary.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The retention state can be viewed three ways. In parallel mode, retention resembles a causal attention map with decay factors in the lower triangle, so training can process many tokens together. In recurrent mode, inference carries one state forward and updates it token by token. In chunkwise recurrent mode, chunks are encoded in parallel while chunk summaries are passed forward recurrently.',
        'Multi-scale retention uses different decay behavior across heads. Some heads forget quickly, making them good for local syntax or recent facts. Others decay slowly, giving the model a longer memory horizon. That multi-scale design is the core reason RetNet is more than a plain RNN with a new name.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The serving promise is smaller decode memory. A Transformer cache grows with layers, tokens, KV heads, head dimension, and precision. RetNet recurrent decode carries fixed-size state for a layer instead of one stored row per past token. That directly attacks the KV-cache concurrency problem described in Transformer Inference Roofline and Hybrid Attention State Budget.',
        'The cost is compressed history. Full attention can directly compare the current query to old token keys. RetNet must have preserved the needed information in its retention state. The implementation also needs efficient scan kernels, stable decay settings, chunk boundaries, and quantization behavior that does not corrupt long-horizon state.',
      ],
    },
    {
      heading: 'Complete case study: long-context serving',
      paragraphs: [
        'Imagine an always-on assistant that summarizes a long meeting while answering interruptions. Full attention gives exact access to the transcript but grows a large KV cache for every active user. RetNet offers a different route: store the evolving transcript in retention state, keep decode memory flatter, and reserve exact retrieval or hybrid attention for facts that must be quoted precisely.',
        'The release gate cannot be a single perplexity number. It should include normal short tasks, long-context QA, needle retrieval, quote accuracy, chunk-boundary tests, p95 latency, HBM footprint, INT8 or INT4 serving sweeps, and protected slices where exact recall matters. If compressed state loses the decisive fact, lower memory did not buy a usable system.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not read RetNet as "attention is obsolete." It is a serious architecture point with a different memory representation. Linear or constant-state decode helps only if quality, kernels, batching, and quantization survive the workload. A conventional Transformer with excellent kernels may still win in many settings.',
        'Also do not equate recurrent state with free long-term memory. Decay rates can forget too aggressively, state size can bottleneck capacity, chunking can create boundary artifacts, and aggregate benchmarks can hide exact-recall failures. The right evaluation compares memory, latency, throughput, and task-specific recall together.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Retentive Network: A Successor to Transformer for Large Language Models at https://arxiv.org/abs/2307.08621, Microsoft Research publication page at https://www.microsoft.com/en-us/research/publication/retentive-network-a-successor-to-transformer-for-large-language-models/, and the Microsoft TorchScale repository at https://github.com/microsoft/torchscale. Recent follow-up context includes A Survey of Retentive Network at https://arxiv.org/abs/2506.06708 and DRetHTR for handwritten text recognition at https://arxiv.org/abs/2602.17387.',
        'Study Attention Mechanism, KV Cache, Transformer Inference Roofline, RWKV Recurrent Transformer, Selective State Space Models: Mamba, Kimi Linear Attention, Hybrid Attention State Budget Case Study, FNet Fourier Token Mixing Case Study, Titans Test-Time Neural Memory Case Study, MatMul-Free Language Modeling, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
