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
      heading: 'How to read the animation',
      paragraphs: [
        'The token-budget view shows a transformer block with a fixed capacity. Capacity is the number of token positions allowed to run the block at that layer. Active nodes are selected tokens, found nodes have been scattered back into sequence order, and compare nodes show tokens that route around the block through the residual path.',
        'The route-around view shows gather, compute, and scatter. Gather collects selected hidden states into a compact tensor, compute runs the block on those states, and scatter writes results back to the original positions. The safe inference is that skipped tokens are not deleted; they carry their previous representation forward and may be selected by a later layer.',
        {type:'callout', text:'MoD keeps layer compute predictable by fixing capacity while letting the router decide which token positions spend that capacity.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/34/Transformer%2C_full_architecture.png', alt:'Diagram of a standard transformer encoder-decoder architecture with attention and feed-forward blocks.', caption:'Standard transformer architecture. Image by dvgodoy, CC BY 4.0, Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Dense transformers spend roughly the same block compute on every token position. That is simple and efficient for batching, but it can waste work when a sequence contains easy punctuation, repeated boilerplate, and a few hard tokens that carry the next-token decision. Mixture-of-Depths asks which positions need this layer now.',
        'The goal is adaptive depth with a predictable systems budget. The router can change which token positions receive a block, but the block processes a fixed number of positions. That gives the model dynamic assignment without letting runtime work grow unpredictably for each input.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is the dense transformer. Every token runs every attention and feed-forward block, so tensor shapes are stable and kernels are mature. It is easy to train and easy to reason about because all positions climb the same layer stack.',
        'Another approach is early exit, where a token or request stops after enough layers. That can save compute, but it makes depth a one-way decision. A token that exits early usually cannot skip one block, return later, and spend compute where it matters.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The dense wall is uniform spending. If a 2,048-token sequence runs 32 layers, each layer touches all 2,048 positions even if many positions are easy for that layer. The model has no built-in way to spend depth unevenly across positions.',
        'The dynamic-compute wall is hardware irregularity. If each input chooses arbitrary amounts of work, batching, kernel fusion, and latency predictability suffer. A useful design must adapt token identity while keeping total layer work stable enough for accelerators and serving systems.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Mixture-of-Depths separates compute budget from compute assignment. The budget is fixed: each MoD block processes k token positions. The assignment is learned: a router scores all positions and selects the top k for this layer and input.',
        'The sequence-shape invariant makes the design composable. Selected tokens are updated and returned to their original positions. Bypassed tokens keep their residual representation, so later layers still see a full sequence with stable positions, masks, and downstream layout.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At each MoD block, the router reads the current hidden state for every token position and emits one score per position. The implementation selects the top k scores, gathers those hidden states, runs the block computation, and scatters updated states back. Tokens outside the top k route around through the residual path.',
        'Training must make routing learnable even though top-k selection is discrete. Implementations use routing losses, straight-through estimators, auxiliary objectives, or related tricks so the router learns which positions deserve compute. Serving must use a causal route policy for autoregressive generation because future tokens are not available during live decoding.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The behavioral correctness argument is that every layer preserves sequence length and position identity. A bypassed token is not zeroed, dropped, or shifted; it remains available to attention and later routing decisions. That makes sparse depth paths compatible with the rest of the transformer stack.',
        'The systems argument is fixed capacity. If each block always processes k positions, the runtime can allocate fixed gather buffers and plan work per layer. The graph is adaptive in which tokens receive compute, not in the amount of block compute promised to the scheduler.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'If sequence length is n and block capacity is k, the expensive block work targets k positions instead of n. With n = 1,024 and k = 256, that layer spends block compute on 25 percent of positions. Doubling n to 2,048 while keeping k = 256 keeps block capacity flat, although router scoring still reads all positions.',
        'The new costs are router evaluation, top-k selection, gather, scatter, mask handling, route telemetry, and harder serving. FLOPs can fall while wall-clock latency barely improves if gather and scatter break efficient kernels. Capacity is therefore a quality-speed knob, not a free reduction.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Mixture-of-Depths is useful when token importance is uneven and block computation is much larger than routing overhead. Long prompts, code, math, retrieval-augmented inputs, and mixed-format documents are natural test cases. The access pattern is a full sequence where only some positions need a given layer.',
        'It is also useful as a research probe. Route logs can show which tokens receive depth by layer, token type, and task. If the router spends compute on numbers, entities, brackets, rare syntax, or retrieved facts, the route becomes an interpretable budget trace.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MoD fails when routing overhead eats the saved block compute. It also fails when the router starves rare task-bearing tokens, such as punctuation in code, table delimiters, or legal terms. Average language-model quality can hide those regressions unless the evaluation slices are specific.',
        'Autoregressive serving is a sharp failure surface. If training uses route decisions that depend on future tokens, live decoding cannot reproduce them. Mask bugs, scatter bugs, route-cache mismatch, and batch fragmentation can silently change model behavior while the code still runs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A 12-layer model processes a 1,024-token prompt. A dense block updates all 1,024 positions in every layer, so the stack performs 12,288 token-block updates. If 6 layers are MoD layers with k = 256 and 6 remain dense, the total is 6 times 1,024 plus 6 times 256, or 7,680 token-block updates before routing overhead.',
        'That is a 37.5 percent reduction in token-block updates, but not necessarily a 37.5 percent latency reduction. The router still scores 1,024 positions in each MoD layer, top-k must select 256, and gather/scatter move tensors. The design wins only if the skipped block work is larger than those added costs at the target batch and hardware shape.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are "Mixture-of-Depths: Dynamically allocating compute in transformer-based language models" at https://arxiv.org/abs/2404.02258 and the arXiv HTML version at https://arxiv.org/html/2404.02258v1. Background sources include Adaptive Computation Time, Universal Transformers, AdaTape, and Mixture of Experts papers.',
        'Study Attention Mechanism, Multi-Head Attention, KV Cache, Mixture of Experts, Early-Exit Transformer Layer Skipping, Adaptive Computation Time Halting, Transformer Inference Roofline, LLM Continuous Batching, and Heterogeneous AI Compute Workload Router next. Start with the topic that explains the data shape, then move to the production system.',
      ],
    },
  ],
};