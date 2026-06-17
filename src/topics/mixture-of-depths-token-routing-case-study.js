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
      heading: 'Why this exists',
      paragraphs: [
        `Dense transformers spend roughly the same block compute on every token position. That is simple and powerful, but it is wasteful when a sequence contains punctuation, repeated context, easy glue words, and a few hard tokens that carry the real burden of reasoning or prediction.`,
        `Mixture-of-Depths exists to ask a sharper question at each transformer block: which token positions need this layer right now? A learned router scores positions, the top k positions run the block, and the rest route around it through the residual path.`,
        `The goal is adaptive compute without an uncontrolled dynamic graph. The token identities can change by layer, but the capacity k is fixed ahead of time. That gives the model freedom to allocate depth while giving the system a predictable compute budget.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious approach is the dense transformer. Every token runs every attention and MLP block. This is easy to batch, easy to reason about, and well matched to accelerator kernels. It also means low-value positions get the same layer budget as high-value positions.`,
        `A second approach is early exit. A token or request stops after enough layers. That can save compute, but it makes depth feel like a one-way stopping decision. Once a token exits, it usually does not return to later layers.`,
        `MoD hits the wall from a different angle. It lets a token skip one block and be selected again later. The model can build sparse depth paths through the network instead of assigning every position the same full depth or one permanent exit point.`,
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        `The core insight is to separate compute budget from compute assignment. The budget is static: each MoD block can process k token positions. The assignment is dynamic: the router chooses which positions get that block for this input and this layer.`,
        `The invariant is that the sequence shape survives the route. A bypassed token is not deleted, shortened, or removed from the model state. It carries its residual hidden representation forward. Selected tokens are updated by the block, then scattered back into their original positions.`,
        `That invariant makes the architecture trainable and composable. Later blocks still see a full sequence. Attention masks, position ids, cache layout, and downstream layers can keep a stable view of token positions.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The token-budget view starts with a dense block and then shows the MoD change. Every token receives a router score, but only the top k scores enter the block. The capacity line stays flat while the chosen token identities change.`,
        `The route-around graph shows the implementation shape: gather, run, scatter. Selected hidden states are gathered into a compact buffer. The block runs attention and MLP on that selected set according to the mask policy. The updated states scatter back, while bypassed states continue through the residual path.`,
        `The layer table shows the difference from early exit. A token can skip layer 4, run layer 8, and skip layer 12. Depth becomes a per-token path through the stack rather than a single shared ladder that every token climbs in lockstep.`,
      ],
    },
    {
      heading: 'Core data structures',
      paragraphs: [
        `The main runtime structures are a router score vector per block, a top-k index list, a gather buffer of selected hidden states, an attention mask, a scatter map back to full sequence order, and route statistics for observability. These are plain data structures, but a mistake in them changes model behavior.`,
        `The top-k list is the control plane. It says which token rows are allowed to spend this block. The gather buffer is the temporary compact tensor that makes the selected work efficient. The scatter map is the contract that restores the full sequence without swapping positions or losing bypassed states.`,
        `The attention mask deserves special care. If selected tokens can attend to the wrong positions, or if decoding uses route decisions that depend on future tokens, the model may look good offline and fail online. Routing is not just a speed trick; it changes the computation graph.`,
      ],
    },
    {
      heading: 'Case study: Mixture-of-Depths',
      paragraphs: [
        `Raposo et al. describe MoD as dynamic token-level compute under a static total budget. A block has a fixed capacity. The router chooses the top scoring positions, those positions participate in attention and MLP, and the rest route around the block.`,
        `The paper reports that MoD models can match baseline performance under comparable training budgets while using fewer forward-pass FLOPs, and it discusses faster sampling after additional routing work for inference. The exact win depends on model size, capacity, kernels, and serving shape, so the systems claim should be measured rather than assumed.`,
        `The subtle point is hardware sympathy. Many adaptive-computation methods create variable work that accelerators dislike. MoD keeps a predictable per-block capacity while letting the model learn which positions deserve that capacity.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `At a block, the router reads the current hidden states and produces one score per token position. The implementation selects the top k scores. Selected positions are gathered into a smaller tensor, the block computation runs on that selected tensor, and the results scatter back to the full sequence.`,
        `The residual path carries bypassed tokens forward. That means the model does not create holes in the sequence. A bypassed token still has a representation at the next layer, and it may be selected later.`,
        `Training has to make routing learnable. Top-k selection is discrete, so implementations use routing losses, straight-through choices, auxiliary objectives, or design choices that keep gradients useful. The paper details one approach; the general lesson is that the router must learn importance without collapsing to trivial patterns.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `MoD works when useful computation is unevenly distributed across token positions and layers. Some tokens need more depth because they bind entities, carry numbers, close brackets, disambiguate references, or determine the next token. Other positions can preserve state for one layer without much loss.`,
        `The residual path makes skipping safe enough to attempt. A bypassed token is not replaced with zero and not removed from context. It keeps its hidden state and remains available to later computation.`,
        `The fixed capacity makes the systems story plausible. If each block processes exactly k positions, the runtime can allocate predictable buffers and schedule known shapes. The graph is adaptive in identity, not in total amount of work.`,
      ],
    },
    {
      heading: 'Correctness and serving constraints',
      paragraphs: [
        `MoD does not have correctness in the database sense. It has a behavioral contract: the serving route must match the route policy the model was trained or adapted to use. If training chooses tokens with information that live decoding cannot see, the offline result is not a valid serving result.`,
        `Autoregressive generation is the hard case. During live sampling, future tokens do not exist. A route decision for the current step must use available prefix information. The MoD paper discusses predictive routing for efficient decoder-only inference so the online decision avoids future leakage.`,
        `Serving also has to preserve causal masks, position mapping, KV-cache semantics, and batch consistency. A scatter bug, mask bug, or route-cache mismatch can silently change which tokens communicate. That is a model bug, not only an optimization bug.`,
      ],
    },
    {
      heading: 'Relation to adaptive compute',
      paragraphs: [
        `MoD belongs to a longer adaptive-computation family. Adaptive Computation Time lets recurrent networks learn how many internal steps to take. Universal Transformers bring recurrence in depth to transformer positions and add dynamic per-position halting. AdaTape changes the number of input tape tokens. Early-exit methods stop or verify generation at shallower layers.`,
        `Mixture of Experts is adjacent but not the same. MoE usually asks which expert processes this token. MoD asks whether this token receives this block. One routes across expert capacity; the other routes across depth capacity.`,
        `The shared motivation is that large models waste compute unevenly. The hard engineering problem is to expose adaptivity in a form that hardware can run efficiently and operators can inspect.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The potential savings come from skipping block computation for some positions. The new costs are router evaluation, top-k selection, gather and scatter movement, mask construction, route telemetry, and extra serving complexity.`,
        `FLOPs are not the whole story. If gather and scatter break fusion, fragment batches, or force inefficient kernels, the wall-clock win can shrink. If top-k tie churn changes shapes or memory access patterns, p99 latency can get worse even while average FLOPs fall.`,
        `Capacity is a quality knob. Low k saves compute but can starve important positions. High k behaves more like a dense transformer. The useful setting is a measured quality-speed knee, not the smallest capacity that still runs.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `MoD is strongest when token importance is uneven and the skipped block compute is much larger than routing overhead. Long contexts, mixed-format documents, code, math, retrieval-augmented prompts, and serving regimes with strict budgets are natural candidates.`,
        `It also has a clear research value: it turns token-level importance into an explicit route that can be logged and studied. If the router consistently spends compute on entities, numbers, rare syntax, or task-critical spans, it gives researchers a handle on where depth is being used.`,
        `The fixed-budget design is the practical advantage over more free-form dynamic compute. Systems teams can plan for a known amount of work per block, then measure whether dynamic token identity actually improves quality per unit time.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `MoD fails when routing overhead eats the savings, when the router starves rare but important tokens, when selected-token attention loses information that dense attention would have used, or when serving cannot reproduce the training route causally.`,
        `It can also fail at the tail. A model may look faster on average while a serving system suffers from route instability, gather/scatter overhead, inefficient cache behavior, or batch fragmentation. Static capacity reduces shape chaos, but it does not remove all irregularity.`,
        `Quality regressions may be subtle. A skipped punctuation token might not matter in one task and might matter a lot in code, math, tables, or legal text. The evaluation set has to include the token types the router is tempted to under-serve.`,
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        `Do not confuse static budget with easy deployment. The runtime still needs fast top-k, stable gather/scatter, mask tests, route telemetry, kernel profiling, and canary slices that reveal skipped important tokens. The router can collapse onto easy patterns or produce noisy tie churn.`,
        `Measure accepted quality, wall-clock latency, p50 and p99, tokens per second, copy overhead, batch effects, KV-cache interaction, and route stability. Compare against dense transformers, Mixture of Experts, early exit, speculative decoding, KV-cache optimization, and better batching under the same quality target.`,
        `Log route distributions by layer, token class, prompt length, and task family. Look for starvation of rare tokens, future-leak differences between offline and online routing, and layers where the router behaves like a constant mask. If the route is invisible, the failure will be invisible too.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources include Mixture-of-Depths at https://arxiv.org/abs/2404.02258 and the arXiv HTML version at https://arxiv.org/html/2404.02258v1. Background adaptive-computation sources include Adaptive Computation Time, Universal Transformers, and AdaTape.`,
        `Study Adaptive Computation Time Halting, AdaTape Adaptive Token Bank, Perceiver IO Latent Array Bottleneck, Mixture of Experts, Early-Exit Transformer Layer Skipping, Transformer Inference Roofline, KV Cache, Attention Mechanism, Multi-Head Attention, Load Balancer, Gradient Flow, LLM Continuous Batching, and Heterogeneous AI Compute Workload Router next.`,
      ],
    },
  ],
};
