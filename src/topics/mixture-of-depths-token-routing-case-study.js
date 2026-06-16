// Mixture-of-Depths: keep the total transformer compute budget static, but
// let a learned top-k router choose which token positions spend it at each block.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'mixture-of-depths-token-routing-case-study',
  title: 'Mixture-of-Depths Token Routing',
  category: 'Papers',
  summary: 'A top-k router gives each transformer block a fixed token capacity while dynamically deciding which positions run attention and MLP.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['token budget', 'route around'], defaultValue: 'token budget' },
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

function modBlockGraph(title) {
  return graphState({
    nodes: [
      { id: 'tokens', label: 'tokens', x: 0.6, y: 3.8, note: 'batch' },
      { id: 'router', label: 'router', x: 2.4, y: 3.8, note: 'score' },
      { id: 'topk', label: 'top-k', x: 4.0, y: 2.4, note: 'cap' },
      { id: 'run', label: 'block', x: 5.8, y: 2.4, note: 'attn+MLP' },
      { id: 'skip', label: 'residual', x: 5.8, y: 5.2, note: 'bypass' },
      { id: 'scatter', label: 'scatter', x: 7.6, y: 3.8, note: 'restore' },
      { id: 'next', label: 'next L', x: 9.2, y: 3.8, note: 'depth' },
    ],
    edges: [
      { id: 'e-tokens-router', from: 'tokens', to: 'router', weight: 'hidden' },
      { id: 'e-router-topk', from: 'router', to: 'topk', weight: 'scores' },
      { id: 'e-topk-run', from: 'topk', to: 'run', weight: 'chosen' },
      { id: 'e-router-skip', from: 'router', to: 'skip', weight: 'others' },
      { id: 'e-run-scatter', from: 'run', to: 'scatter', weight: 'updated' },
      { id: 'e-skip-scatter', from: 'skip', to: 'scatter', weight: 'unchanged' },
      { id: 'e-scatter-next', from: 'scatter', to: 'next', weight: 'sequence' },
    ],
  }, { title });
}

function* tokenBudget() {
  yield {
    state: labelMatrix(
      'Dense transformers spend compute uniformly',
      [
        { id: 'the', label: 'the' },
        { id: 'comma', label: 'comma' },
        { id: 'entity', label: 'entity' },
        { id: 'math', label: 'math' },
        { id: 'code', label: 'code' },
        { id: 'quote', label: 'quote' },
      ],
      [
        { id: 'dense', label: 'dense block' },
        { id: 'need', label: 'likely need' },
      ],
      [
        ['runs', 'low'],
        ['runs', 'low'],
        ['runs', 'high'],
        ['runs', 'high'],
        ['runs', 'high'],
        ['runs', 'medium'],
      ],
    ),
    highlight: { active: ['entity:dense', 'math:dense', 'code:dense'], compare: ['the:dense', 'comma:dense'] },
    explanation: 'A normal transformer block spends attention and MLP compute on every token position. Mixture-of-Depths asks a sharper question: if the block can process only k positions, which tokens deserve this layer right now?',
  };

  yield {
    state: labelMatrix(
      'A fixed top-k capacity makes the graph predictable',
      [
        { id: 'the', label: 'the' },
        { id: 'comma', label: 'comma' },
        { id: 'entity', label: 'entity' },
        { id: 'math', label: 'math' },
        { id: 'code', label: 'code' },
        { id: 'quote', label: 'quote' },
      ],
      [
        { id: 'score', label: 'score' },
        { id: 'route', label: 'route' },
      ],
      [
        ['0.12', 'bypass'],
        ['0.08', 'bypass'],
        ['0.83', 'run'],
        ['0.91', 'run'],
        ['0.78', 'run'],
        ['0.44', 'bypass'],
      ],
    ),
    highlight: { active: ['entity:route', 'math:route', 'code:route'], compare: ['the:route', 'comma:route', 'quote:route'] },
    explanation: 'The router emits one scalar per token for the block. The top k scores run the block; the rest route around it through the residual path. Total compute is fixed because k is fixed before the pass starts.',
    invariant: 'The budget is static; only the selected token identities are dynamic.',
  };

  yield {
    state: modBlockGraph('MoD routes selected tokens through the block'),
    highlight: { active: ['router', 'topk', 'run', 'e-router-topk', 'e-topk-run'], found: ['skip', 'scatter'] },
    explanation: 'The implementation is a gather-run-scatter pattern. Gather selected hidden states into a compact block input, run attention and MLP for those selected positions, then scatter updated states back while bypassed positions keep their residual value.',
  };

  yield {
    state: labelMatrix(
      'Selected tokens can change by layer',
      [
        { id: 'tok1', label: 'the' },
        { id: 'tok2', label: 'enzyme' },
        { id: 'tok3', label: 'binds' },
        { id: 'tok4', label: 'Kcat' },
        { id: 'tok5', label: '=' },
        { id: 'tok6', label: '42' },
      ],
      [
        { id: 'L4', label: 'L4' },
        { id: 'L8', label: 'L8' },
        { id: 'L12', label: 'L12' },
      ],
      [
        ['skip', 'skip', 'run'],
        ['run', 'run', 'skip'],
        ['skip', 'run', 'run'],
        ['run', 'skip', 'run'],
        ['skip', 'skip', 'skip'],
        ['run', 'run', 'skip'],
      ],
    ),
    highlight: { active: ['tok2:L4', 'tok2:L8', 'tok4:L12', 'tok3:L12'], compare: ['tok1:L4', 'tok5:L12'] },
    explanation: 'This is not the same as early exit. A token can skip a middle block and later be selected again. MoD allocates compute across both sequence positions and model depth, rather than just deciding when to stop.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'layer', min: 0, max: 16 }, y: { label: 'selected tokens', min: 0, max: 8 } },
      series: [
        { id: 'capacity', label: 'capacity', points: [
          { x: 1, y: 3 }, { x: 4, y: 3 }, { x: 8, y: 3 }, { x: 12, y: 3 }, { x: 16, y: 3 },
        ] },
        { id: 'dense', label: 'dense', points: [
          { x: 1, y: 6 }, { x: 4, y: 6 }, { x: 8, y: 6 }, { x: 12, y: 6 }, { x: 16, y: 6 },
        ] },
      ],
      markers: [
        { id: 'budget', x: 8, y: 3, label: 'fixed k' },
      ],
    }),
    highlight: { active: ['capacity', 'budget'], compare: ['dense'] },
    explanation: 'Hardware likes fixed shapes. MoD keeps a predictable per-layer capacity even though the selected token identities change. That is the central systems trade: dynamic routing behavior with static tensor sizes.',
  };

  yield {
    state: labelMatrix(
      'Runtime data structures',
      [
        { id: 'scores', label: 'score vec' },
        { id: 'index', label: 'top-k idx' },
        { id: 'gather', label: 'gather buf' },
        { id: 'mask', label: 'attn mask' },
        { id: 'scatter', label: 'scatter map' },
        { id: 'stats', label: 'route stats' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['router logits', 'collapse'],
        ['chosen ids', 'tie churn'],
        ['hidden rows', 'copy cost'],
        ['visible keys', 'causal bug'],
        ['restore ids', 'wrong slot'],
        ['layer load', 'drift'],
      ],
    ),
    highlight: { active: ['index:stores', 'gather:stores', 'scatter:stores'], found: ['mask:risk', 'stats:risk'] },
    explanation: 'The data-structure burden is concrete: score vectors, top-k indices, gather buffers, attention masks, scatter maps, and route statistics. A routing bug is not cosmetic; it changes which tokens are allowed to communicate.',
  };
}

function* routeAround() {
  yield {
    state: modBlockGraph('Route around means residual, not deletion'),
    highlight: { active: ['skip', 'e-router-skip', 'e-skip-scatter'], found: ['scatter', 'next'], compare: ['run'] },
    explanation: 'A bypassed token is not dropped from the sequence. It carries its residual hidden state forward unchanged through this block. Later blocks may still select it, and other selected tokens may attend according to the mask policy.',
  };

  yield {
    state: labelMatrix(
      'MoE vs MoD',
      [
        { id: 'moe', label: 'MoE' },
        { id: 'mod', label: 'MoD' },
        { id: 'early', label: 'early exit' },
        { id: 'dense', label: 'dense' },
      ],
      [
        { id: 'choice', label: 'choice' },
        { id: 'budget', label: 'budget' },
      ],
      [
        ['which expert', 'fixed k'],
        ['which token', 'fixed k'],
        ['when stop', 'variable'],
        ['no route', 'all tokens'],
      ],
    ),
    highlight: { active: ['mod:choice', 'mod:budget'], compare: ['moe:choice', 'early:budget'] },
    explanation: 'MoD borrows routing intuition from Mixture of Experts, but the choice is not which expert processes a token. The choice is whether this token gets this transformer block or routes around it.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'prefix', label: 'prefix', x: 0.7, y: 3.8, note: 'seen' },
        { id: 'pred', label: 'pred route', x: 2.6, y: 3.8, note: 'causal' },
        { id: 'topk', label: 'top-k', x: 4.3, y: 3.8, note: 'cap' },
        { id: 'decode', label: 'decode', x: 6.0, y: 2.5, note: 'stream' },
        { id: 'train', label: 'train', x: 6.0, y: 5.0, note: 'teacher' },
        { id: 'audit', label: 'audit', x: 8.1, y: 3.8, note: 'gap' },
      ],
      edges: [
        { id: 'e-prefix-pred', from: 'prefix', to: 'pred', weight: 'hidden' },
        { id: 'e-pred-topk', from: 'pred', to: 'topk', weight: 'scores' },
        { id: 'e-topk-decode', from: 'topk', to: 'decode', weight: 'sample' },
        { id: 'e-train-audit', from: 'train', to: 'audit', weight: 'offline' },
        { id: 'e-decode-audit', from: 'decode', to: 'audit', weight: 'online' },
      ],
    }, { title: 'Autoregressive sampling needs causal route prediction' }),
    highlight: { active: ['pred', 'topk', 'decode'], found: ['audit'], compare: ['train'] },
    explanation: 'A decoder-only model cannot choose top-k using future tokens during live sampling. The paper discusses a predictive router for efficient inference, so the online route decision uses available prefix information instead of peeking ahead.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'block budget', min: 0.25, max: 1.0 }, y: { label: 'relative value', min: 0, max: 100 } },
      series: [
        { id: 'speed', label: 'speed', points: [
          { x: 0.25, y: 96 }, { x: 0.40, y: 84 }, { x: 0.55, y: 70 }, { x: 0.75, y: 50 }, { x: 1.0, y: 25 },
        ] },
        { id: 'quality', label: 'quality', points: [
          { x: 0.25, y: 66 }, { x: 0.40, y: 78 }, { x: 0.55, y: 89 }, { x: 0.75, y: 96 }, { x: 1.0, y: 100 },
        ] },
      ],
      markers: [
        { id: 'knee', x: 0.55, y: 89, label: 'knee' },
      ],
    }),
    highlight: { active: ['quality', 'knee'], compare: ['speed'] },
    explanation: 'Budget is a knob. Lower capacity makes each step cheaper but risks starving important tokens. Higher capacity approaches the dense transformer. The useful setting is a quality-speed knee, not the smallest possible k.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'collapse', label: 'collapse' },
        { id: 'copy', label: 'copy cost' },
        { id: 'mask', label: 'mask bug' },
        { id: 'future', label: 'future leak' },
        { id: 'tails', label: 'tail p99' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'control', label: 'control' },
      ],
      [
        ['same tokens', 'aux loss'],
        ['gather slow', 'kernel fuse'],
        ['bad attend', 'tests+audit'],
        ['offline win', 'causal route'],
        ['shape churn', 'bucket caps'],
      ],
    ),
    highlight: { active: ['collapse:control', 'mask:control', 'future:control'], compare: ['copy:symptom'] },
    explanation: 'The common failures are routing collapse, expensive gather/scatter, attention-mask mistakes, train-serving leakage in route selection, and tail latency from irregular shapes. A static budget helps, but it does not remove systems work.',
  };

  yield {
    state: labelMatrix(
      'Adaptive compute lineage',
      [
        { id: 'act', label: 'ACT' },
        { id: 'ut', label: 'Universal T' },
        { id: 'adatape', label: 'AdaTape' },
        { id: 'mod', label: 'MoD' },
        { id: 'layerskip', label: 'LayerSkip' },
      ],
      [
        { id: 'unit', label: 'unit' },
        { id: 'control', label: 'control' },
      ],
      [
        ['RNN step', 'halt prob'],
        ['position', 'halt depth'],
        ['extra token', 'read bank'],
        ['token block', 'top-k cap'],
        ['decode token', 'exit layer'],
      ],
    ),
    highlight: { active: ['mod:unit', 'mod:control'], found: ['act:control', 'ut:control'], compare: ['layerskip:control'] },
    explanation: 'MoD belongs in a longer adaptive-computation family. ACT learns how long to think, Universal Transformer applies dynamic depth to positions, AdaTape changes the input token budget, and LayerSkip exits or verifies during generation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'token budget') yield* tokenBudget();
  else if (view === 'route around') yield* routeAround();
  else throw new InputError('Pick a Mixture-of-Depths view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Mixture-of-Depths (MoD) is a transformer architecture that allocates compute dynamically across token positions while keeping the total block budget predictable. Each block has a fixed capacity k. A learned router scores the tokens, the top k positions run the self-attention and MLP computation, and the remaining positions route around the block through the residual path.',
        'The idea is close to Mixture of Experts but rotated ninety degrees. MoE asks which expert should process this token. MoD asks whether this token should receive this layer at all. The paper emphasizes that k is defined ahead of time, so tensor sizes and total compute are static even though the selected token identities are context-sensitive.',
      ],
    },
    {
      heading: 'Core data structures',
      paragraphs: [
        'The main structures are a router score vector per block, a top-k index list, a gather buffer of selected hidden states, an attention mask for the selected computation, a scatter map back into the full sequence, and route statistics by layer and token type. These are ordinary systems objects, but they sit inside a model block, so mistakes are model-behavior mistakes.',
        'The gather-run-scatter loop is the implementation shape. Selected tokens compact into a block input, run attention and MLP, then scatter back. Bypassed tokens preserve their residual hidden state. Unlike early exit, a bypassed token can be selected again later, so the routing pattern is a sparse path through depth rather than a single stopping time.',
      ],
    },
    {
      heading: 'Case study: Mixture-of-Depths',
      paragraphs: [
        'Raposo et al. describe MoD as dynamic token-level compute under a static total budget. The paper caps how many tokens can participate in self-attention and MLP at a block, chooses those tokens with top-k routing, and reports that MoD models can match baseline performance at equivalent training FLOPs and wall-clock time while using a fraction of forward-pass FLOPs. It also reports post-training sampling steps that can be more than 50 percent faster.',
        'The subtle point is hardware sympathy. Many adaptive-computation ideas create dynamic graphs that accelerators dislike. MoD keeps the total capacity known while letting the identities of selected tokens change. That means the allocator, compiler, and scheduler can reason about shapes, while the model still learns where compute matters.',
      ],
    },
    {
      heading: 'Sampling and serving',
      paragraphs: [
        'Autoregressive generation makes routing harder than offline training. A top-k decision over a full sequence can accidentally depend on future tokens that do not exist during streaming decode. The MoD paper discusses predictive routing for efficient decoder-only inference so live route decisions use available prefix information.',
        'Serving teams should measure accepted quality, copy overhead, kernel fusion, KV-cache interaction, route stability, and p99. A theoretical FLOP reduction can disappear if gather/scatter dominates, if route shapes fragment batches, or if routing around attention changes which tokens can communicate in surprising ways.',
      ],
    },
    {
      heading: 'Relation to adaptive compute',
      paragraphs: [
        'Adaptive Computation Time lets recurrent networks learn how many internal steps to take before emitting an output. Universal Transformers bring recurrence in depth to transformer positions and add dynamic per-position halting. AdaTape changes the input sequence itself by selecting a variable number of tape tokens. Perceiver IO fixes a latent working memory between huge inputs and task-specific output queries. Early-Exit Transformer Layer Skipping chooses when a generated token can stop or verify. MoD is the fixed-budget top-k member of the family.',
        'This family is useful because large models waste compute unevenly. Some tokens are syntax glue; others carry facts, code, math, or entity binding. The engineering problem is to make that adaptivity visible to hardware and auditable to operators.',
      ],
    },
    {
      heading: 'Production pitfalls',
      paragraphs: [
        'Do not confuse static budget with easy deployment. The runtime still needs fast top-k, stable gather/scatter, attention-mask correctness, route telemetry, and canary slices that reveal when important tokens are being skipped. The router can collapse onto easy patterns, starve rare tokens, or produce noisy tie churn that makes latency unstable.',
        'MoD should be compared against dense transformers, MoE, early exit, speculative decoding, KV-cache optimization, and batching under the same p99 and quality target. A lower FLOP count is not a win if wall-clock latency, route bugs, or quality regressions dominate.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Mixture-of-Depths at https://arxiv.org/abs/2404.02258 and the arXiv HTML paper at https://arxiv.org/html/2404.02258v1. Background adaptive-computation sources: Adaptive Computation Time at https://arxiv.org/abs/1603.08983, Universal Transformers at https://arxiv.org/abs/1807.03819, and AdaTape at https://research.google/blog/adatape-foundation-model-with-adaptive-computation-and-dynamic-read-and-write/.',
        'Study Adaptive Computation Time Halting, AdaTape Adaptive Token Bank, Perceiver IO Latent Array Bottleneck, Mixture of Experts, Early-Exit Transformer Layer Skipping, Transformer Inference Roofline, KV Cache, Attention Mechanism, Multi-Head Attention, Load Balancer, Gradient Flow, LLM Continuous Batching, and Heterogeneous AI Compute Workload Router next.',
      ],
    },
  ],
};
