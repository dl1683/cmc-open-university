// Fully Sharded Data Parallel: PyTorch's practical sharded data-parallel
// wrapper, gathering parameters just in time and resharding after use.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'fully-sharded-data-parallel',
  title: 'Fully Sharded Data Parallel',
  category: 'Systems',
  summary: 'PyTorch FSDP shards parameters, gradients, and optimizer state across data-parallel ranks, then all-gathers modules just in time.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['reshard lifecycle', 'wrapping strategy'], defaultValue: 'reshard lifecycle' },
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

function fsdpGraph(title) {
  return graphState({
    nodes: [
      { id: 'r0', label: 'rank 0', x: 0.9, y: 1.4, note: 'param shard A' },
      { id: 'r1', label: 'rank 1', x: 0.9, y: 3.6, note: 'param shard B' },
      { id: 'r2', label: 'rank 2', x: 0.9, y: 5.8, note: 'param shard C' },
      { id: 'module', label: 'wrapped module', x: 3.5, y: 3.6, note: 'FSDP unit' },
      { id: 'gather', label: 'all-gather params', x: 5.8, y: 2.1, note: 'full weights briefly' },
      { id: 'compute', label: 'forward/backward', x: 7.3, y: 3.6, note: 'local micro-batch' },
      { id: 'scatter', label: 'reduce-scatter grads', x: 5.8, y: 5.2, note: 'owners get shards' },
      { id: 'optim', label: 'optimizer shard', x: 9.1, y: 3.6, note: 'local update' },
    ],
    edges: [
      { id: 'e-r0-module', from: 'r0', to: 'module', weight: 'owned shard' },
      { id: 'e-r1-module', from: 'r1', to: 'module', weight: 'owned shard' },
      { id: 'e-r2-module', from: 'r2', to: 'module', weight: 'owned shard' },
      { id: 'e-module-gather', from: 'module', to: 'gather', weight: 'pre-forward' },
      { id: 'e-gather-compute', from: 'gather', to: 'compute', weight: 'full params' },
      { id: 'e-compute-scatter', from: 'compute', to: 'scatter', weight: 'gradients' },
      { id: 'e-scatter-optim', from: 'scatter', to: 'optim', weight: 'sharded grads' },
    ],
  }, { title });
}

function* reshardLifecycle() {
  const numRanks = 3;
  const numPhases = 4; // gather, compute, scatter, reshard
  const strategies = ['DDP', 'ZeRO stage 3', 'FSDP', 'tensor parallel'];

  yield {
    state: fsdpGraph('Idle state: each rank owns only shards'),
    highlight: { active: ['r0', 'r1', 'r2', 'module'], compare: ['gather', 'compute'] },
    explanation: `Read the ${numRanks} rank nodes as the resting layout. Parameters, gradients, and optimizer state are partitioned across ${numRanks} ranks, so the long-lived footprint is sharded rather than fully replicated.`,
  };

  yield {
    state: fsdpGraph('Pre-forward: all-gather full parameters for one module'),
    highlight: { active: ['module', 'gather', 'e-module-gather', 'e-gather-compute'], found: ['compute'] },
    explanation: `Before a wrapped module runs, ${numRanks} ranks all-gather the shards needed to materialize that module's parameters. Full weights exist briefly, just around the computation that needs them.`,
    invariant: `FSDP keeps full parameters temporary across ${numRanks} ranks; shards are the resting state throughout all ${numPhases} lifecycle phases.`,
  };

  yield {
    state: fsdpGraph('Backward: reduce-scatter gradients to shard owners'),
    highlight: { active: ['compute', 'scatter', 'e-compute-scatter', 'e-scatter-optim'], found: ['optim'] },
    explanation: `Backward computes gradients, then reduce-scatters them so each of the ${numRanks} ranks keeps the reduced gradient shard it owns. The optimizer step can then run locally on each owner shard.`,
  };

  yield {
    state: labelMatrix(
      'FSDP compared with adjacent strategies',
      [
        { id: 'ddp', label: 'DDP' },
        { id: 'zero3', label: 'ZeRO stage 3' },
        { id: 'fsdp', label: 'FSDP' },
        { id: 'tensor', label: 'tensor parallel' },
      ],
      [
        { id: 'state', label: 'resting state' },
        { id: 'communication', label: 'communication pattern' },
      ],
      [
        ['full replica per rank', 'gradient all-reduce'],
        ['sharded state', 'gather/scatter around layers'],
        ['sharded module state', 'gather/reshard around wrapped units'],
        ['sharded tensor math', 'in-layer collectives'],
      ],
    ),
    highlight: { active: ['fsdp:state', 'fsdp:communication'], found: ['zero3:state'], compare: ['ddp:state'] },
    explanation: `FSDP is conceptually close to ZeRO stage 3 but exposed as a PyTorch module-wrapping strategy. This table compares ${strategies.length} strategies: ${strategies.join(', ')}. Tensor parallelism splits the math inside a layer; FSDP shards the data-parallel training state.`,
  };
}

function* wrappingStrategy() {
  const wrapOptions = ['whole model', 'transformer block', 'tiny layers', 'hybrid shard'];
  const knobs = ['mixed precision', 'activation checkpointing', 'CPU offload', 'state dict'];
  const failures = ['OOM at gather', 'slow step time', 'bad checkpoint', 'loss diverges'];

  yield {
    state: labelMatrix(
      'Auto-wrap granularity',
      [
        { id: 'whole', label: 'whole model' },
        { id: 'block', label: 'transformer block' },
        { id: 'layer', label: 'tiny layers' },
        { id: 'hybrid', label: 'hybrid shard' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['simple boundary', 'large peak all-gather'],
        ['natural memory unit', 'more collectives'],
        ['fine memory control', 'too much overhead'],
        ['node-local shards', 'mesh planning complexity'],
      ],
    ),
    highlight: { active: ['block:benefit', 'block:risk'], compare: ['whole:risk', 'layer:risk'] },
    explanation: `Read each of the ${wrapOptions.length} rows as a candidate wrapper boundary. FSDP performance depends heavily on this choice: transformer-block wrapping often balances peak memory and collective overhead better than ${wrapOptions[2]} or ${wrapOptions[0]} wrapping.`,
  };

  yield {
    state: fsdpGraph('Forward prefetch and backward prefetch hide communication'),
    highlight: { active: ['gather', 'compute', 'scatter'], found: ['e-module-gather', 'e-compute-scatter'] },
    explanation: `Production FSDP overlaps communication with compute where possible across all ${wrapOptions.length} wrap granularities. It can prefetch upcoming parameters and reduce-scatter gradients while later backward work is still running.`,
  };

  yield {
    state: labelMatrix(
      'Operational knobs',
      [
        { id: 'precision', label: 'mixed precision' },
        { id: 'checkpoint', label: 'activation checkpointing' },
        { id: 'cpu', label: 'CPU offload' },
        { id: 'state', label: 'state dict' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'caveat', label: 'caveat' },
      ],
      [
        ['lower param/grad bytes', 'numerical policy matters'],
        ['lower activation memory', 'extra recompute'],
        ['free GPU memory', 'PCIe latency'],
        ['save/load sharded weights', 'checkpoint format planning'],
      ],
    ),
    highlight: { found: ['precision:helps', 'checkpoint:helps'], active: ['state:caveat'] },
    explanation: `FSDP is one memory lever inside a training plan. These ${knobs.length} knobs — ${knobs.join(', ')} — determine whether the memory savings translate into a usable job.`,
  };

  yield {
    state: labelMatrix(
      'Failure diagnosis',
      [
        { id: 'oom', label: 'OOM at gather' },
        { id: 'slow', label: 'slow step time' },
        { id: 'checkpoint', label: 'bad checkpoint' },
        { id: 'numerics', label: 'loss diverges' },
      ],
      [
        { id: 'likely', label: 'likely cause' },
        { id: 'response', label: 'response' },
      ],
      [
        ['wrap too coarse', 'wrap smaller units'],
        ['collective overhead', 'coarsen wrap or improve overlap'],
        ['state dict mismatch', 'choose full/local/sharded format'],
        ['precision/reduction issue', 'audit mixed precision policy'],
      ],
    ),
    highlight: { active: ['oom:response', 'slow:response'], found: ['checkpoint:response'] },
    explanation: `FSDP debugging is memory-layout debugging. This table covers ${failures.length} failure modes: ${failures.join(', ')}. The key questions are where full parameters temporarily exist, when they are released, and what checkpoint format the job expects.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'reshard lifecycle') yield* reshardLifecycle();
  else if (view === 'wrapping strategy') yield* wrappingStrategy();
  else throw new InputError('Pick an FSDP view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The reshard-lifecycle view shows the FSDP memory lifecycle on a directed graph. Rank nodes on the left represent the resting state: each rank stores only its parameter shard, its gradient shard, and its optimizer shard. The all-gather node is the momentary reconstruction point where full parameters briefly exist. The compute node is the only interval where the complete module must be resident. The reduce-scatter node returns reduced gradients to shard owners. Watch the highlight move from left to right: sharded rest, temporary full copy, compute, scatter back to shards. If any highlighted node holds full parameters longer than its computation window, the memory invariant is broken.',
        {type: 'image', src: './assets/gifs/fully-sharded-data-parallel.gif', alt: 'Animated walkthrough of the fully sharded data parallel visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The wrapping-strategy view shifts to a table layout comparing four wrapper granularities and four operational knobs. Active cells highlight the recommended choices; compare cells show dangerous alternatives. The failure-diagnosis table maps symptoms (OOM at gather, slow step time) to specific wrap-policy fixes. Read each row as one debugging hypothesis.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Training a large neural network requires storing four things per parameter on each GPU: the parameter itself, its gradient, and two optimizer states (for Adam, the first and second moment estimates). A 7-billion-parameter model in mixed precision needs roughly 2 bytes per parameter for the fp16 weights, 2 bytes for the fp16 gradient, plus 4 + 4 + 4 bytes for the fp32 master weight, first moment, and second moment. That totals about 16 bytes per parameter, or 112 GB of optimizer-related state alone. A single 80 GB A100 cannot hold it, and the parameters themselves are the smallest piece.',
        {type: 'callout', text: 'FSDP saves memory by changing parameter ownership over time: shards are long-lived, full parameters exist only around the module that is currently computing.'},
        'Fully Sharded Data Parallel (FSDP) is PyTorch\'s answer to this memory crisis. Instead of giving every GPU a full copy of all training state, FSDP partitions parameters, gradients, and optimizer state across ranks so each rank stores only 1/N of the total, where N is the number of GPUs. Full parameters are reconstructed temporarily, one module at a time, only when that module needs to compute. PyTorch exposes this as a module wrapper inspired by the ZeRO stage 3 algorithm from DeepSpeed.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The standard PyTorch scaling path is Distributed Data Parallel (DDP). Each GPU holds a full copy of the model. The training batch is split across GPUs so each processes a different subset of examples. After backward, an all-reduce averages the gradients, and every rank applies the same optimizer step to its local replica. DDP is conceptually simple and scales throughput well: add GPUs, process more examples per step.',
        'DDP works well when the model fits on one GPU. The programming model is familiar, checkpointing is straightforward, and the only communication is gradient all-reduce. For a 150-million-parameter model, the full training state is under 3 GB, comfortably inside any modern accelerator.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'DDP replicates everything. Adding GPUs increases throughput but does not reduce per-rank memory. A model that exhausts one GPU\'s memory will also exhaust each of eight GPUs under DDP, because every rank carries the same 112 GB of training state. The all-reduce only synchronizes gradients; it does not eliminate any stored bytes. DDP solves the wrong problem at the wrong layer: it distributes work, not memory.',
        'A naive fix is to shard the model, but sharding at the wrong granularity creates new problems. Wrapping the entire model as one FSDP unit means the pre-forward all-gather must reconstruct all parameters at once, causing a memory peak as large as the unsharded case. Wrapping every tiny layer individually spreads the memory but floods the network with thousands of small collectives, each with non-trivial latency. The wall is not just "too big for one GPU." It is that the obvious fixes either replicate the problem or trade memory pressure for communication overhead.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Not every byte needs to exist on every GPU at every moment. Parameters are needed in full only during the forward and backward pass of the module they belong to. Gradients are needed in reduced form only by the rank that owns the corresponding parameter shard. Optimizer state is naturally local to the shard owner. Once these lifetimes are separated, the system can replace a single static copy of everything with a sequence of short-lived, bounded working sets.',
        'FSDP operationalizes this insight by introducing a temporal contract: each rank permanently stores 1/N of the parameters, gradients, and optimizer state. Before a wrapped module executes, ranks all-gather the shards to reconstruct the full parameter tensor. After computation, the full copy is discarded. After backward, reduce-scatter sends each gradient shard to its owner. The optimizer updates only local shards. Memory cost shifts from O(model) per rank to O(model/N) per rank, plus a temporary O(module) peak during each wrapped unit\'s execution.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The FSDP lifecycle has four phases: gather, compute, scatter, reshard. At rest, rank 0 owns shard A of a module\'s parameters, rank 1 owns shard B, and rank 2 owns shard C. Each rank also stores the corresponding slices of optimizer state. Before the wrapped module runs its forward pass, every rank calls all-gather to collect shards from the other ranks, reconstructing the full parameter tensor locally. Each rank then runs the forward pass on its own micro-batch using these full parameters.',
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/2304.11277/assets/x1.png', alt: 'FSDP algorithm overview showing wrapped units gathered for computation and resharded afterward', caption: 'The FSDP paper shows full parameters materialized one wrapped unit at a time, then discarded after forward or backward work. Source: Zhao et al., PyTorch FSDP, ar5iv.'},
        'After forward, the full parameter copy can be freed immediately (or retained for backward, depending on configuration). During backward, all-gather reconstructs the parameters again for gradient computation. Once gradients are computed, reduce-scatter both sums them across ranks and distributes only the owner shard to each rank. Each rank then runs its optimizer step on just its local shard. The wrapper boundary controls peak memory: transformer-block wrapping is the common choice because one block is large enough to amortize communication latency but small enough that its full parameters fit comfortably alongside other memory consumers.',
        'FSDP can also prefetch upcoming parameter shards during compute, overlapping communication with arithmetic. Hybrid sharding restricts the shard group to a subset of ranks (often one node) to keep all-gather traffic on fast intra-node links while using all-reduce across nodes. These are tuning choices, not changes to the fundamental lifecycle.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from a conservation argument. Every rank computes with identical full parameters (reconstructed by all-gather from the same shards), so forward outputs match DDP. Every rank produces gradients for its own micro-batch, and reduce-scatter sums these gradients and delivers each shard to its owner, which is mathematically identical to all-reduce followed by slicing. The optimizer step on each shard uses the same reduced gradient that a full-replica optimizer would use for that slice. The final updated shards, when concatenated, produce the same parameter tensor that DDP would produce after one step.',
        'The design also works because transformer architectures have natural module boundaries. A transformer block contains enough parameters (tens of millions to billions) and enough compute (matrix multiplications, attention, feedforward) to hide the latency of a collective. The next block does not need the previous block\'s full parameters to remain resident. This sequential module structure means FSDP\'s gather-compute-scatter cycle aligns with the natural execution order rather than fighting it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Memory per rank drops from O(model) under DDP to O(model/N) at rest under FSDP, where N is the world size. The temporary peak during one wrapped unit\'s execution is O(module_params) for the all-gathered parameters, plus activations for the local micro-batch. For a 7B-parameter model on 8 GPUs, resting memory drops from roughly 112 GB per rank to roughly 14 GB per rank, plus a peak of maybe 2-4 GB for one transformer block\'s reconstructed parameters.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Nvidia_GV100_GPU.png', alt: 'Nvidia GV100 GPU die with many compute units', caption: 'FSDP exists because accelerator memory is finite: model state, optimizer state, activations, and communication buffers compete on the same device. Source: Wikimedia Commons, Nvidia, public domain.'},
        'Communication cost is higher than DDP. DDP performs one gradient all-reduce per step, moving 2 * model_size bytes total (the ring-reduce standard). FSDP performs one all-gather per wrapped unit in forward, another in backward, and one reduce-scatter in backward. For a model with L wrapped units, that is 3L collectives per step instead of one. Each all-gather and reduce-scatter moves O(module_params) bytes. The total communication volume is roughly 3 * model_size bytes per step, about 1.5x DDP. The tradeoff is memory savings in exchange for more frequent, smaller collectives that can overlap with compute.',
        'FSDP does not reduce activation memory. Activations are produced by the local forward pass and stored for backward. Activation checkpointing (recomputing activations during backward instead of storing them) is a separate orthogonal lever. Mixed precision reduces parameter and gradient bytes but does not change the sharding math. CPU offload moves optimizer state to host RAM, trading PCIe latency for GPU memory. These knobs compose with FSDP but are not part of it.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Large language model pretraining is the flagship use case. Teams training 7B to 70B+ parameter models on clusters of 8 to thousands of GPUs use FSDP because it lets them keep the familiar per-module programming model while sharding memory across ranks. Meta\'s Llama models were trained using FSDP. The PyTorch ecosystem provides native integration with torchrun, torch.distributed.checkpoint for sharded saves, and FSDP2 (fully_shard) for composability with tensor parallelism.',
        'Supervised fine-tuning (SFT) and reinforcement learning from human feedback (RLHF) on pretrained models also benefit. These jobs often run on smaller clusters (8-64 GPUs) where DDP would run out of memory due to large optimizer state, especially with full-parameter fine-tuning rather than LoRA. Research labs running many experiments with large optimizers (like Adafactor or Shampoo, which store more state than Adam) use FSDP to fit jobs that would otherwise require model parallelism.',
        'Multimodal training, where a vision encoder and language model are jointly optimized, fits naturally because each component can be wrapped as a separate FSDP unit with its own sharding policy.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'FSDP fails when communication dominates compute. On clusters with slow inter-node networks (10 Gbps Ethernet instead of 400 Gbps InfiniBand), all-gather latency can stall the forward pass. Hybrid sharding mitigates this by keeping all-gathers intra-node, but it reduces the memory benefit because only node-local ranks share shards.',
        'It also fails when the wrap policy is wrong. Wrapping the whole model as one unit gives no memory benefit because the all-gather reconstructs everything at once. Wrapping every linear layer individually creates thousands of tiny collectives that saturate the network with latency-bound messages. The correct granularity is problem-specific and requires profiling.',
        'Checkpoint management is a common operational failure. FSDP supports full state dicts (reconstruct the whole model, save like DDP), sharded state dicts (save each rank\'s shard directly), and local state dicts. Switching between these or changing world size between save and load requires careful format planning. Teams that treat checkpointing as an afterthought often discover their saves are unloadable when they try to resume on a different number of GPUs.',
        'FSDP does not help when the bottleneck is activation memory rather than parameter/optimizer memory. A model that fits in parameter memory but OOMs on activations during a long-sequence forward pass needs activation checkpointing or sequence parallelism, not more parameter sharding.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider training a 13B-parameter model with Adam in mixed precision on 8 A100 80GB GPUs. Per-parameter memory: 2 bytes (fp16 param) + 2 bytes (fp16 grad) + 4 bytes (fp32 master weight) + 4 bytes (fp32 moment 1) + 4 bytes (fp32 moment 2) = 16 bytes. Total training state: 13B * 16 bytes = 208 GB. Under DDP, each of the 8 GPUs needs 208 GB for training state alone, far beyond the 80 GB capacity.',
        'Under FSDP with full sharding across 8 ranks, each rank stores 208 / 8 = 26 GB of sharded training state at rest. The model has 40 transformer blocks, each with about 325M parameters. Wrapping at the block level means each all-gather reconstructs 325M * 2 bytes = 650 MB of fp16 parameters. The peak memory per rank is roughly 26 GB (sharded state) + 650 MB (one block\'s gathered params) + activations + communication buffers. With activation checkpointing and a micro-batch size of 1-2, this fits within 80 GB.',
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/2304.11277/assets/x4.png', alt: 'Full sharding example across 16 GPUs', caption: 'Flat parameters are concatenated, padded, and chunked so each rank owns a shard with layouts ready for all-gather and reduce-scatter. Source: Zhao et al., PyTorch FSDP, ar5iv.'},
        'Communication per step: 40 blocks * 2 all-gathers (forward + backward) * 650 MB + 40 reduce-scatters * 650 MB = 78 GB total collective traffic per rank. On 400 Gbps InfiniBand (about 50 GB/s effective), the raw transfer time is about 1.6 seconds, but overlap with compute hides most of it. The job that was impossible under DDP now runs with about 50-60% compute efficiency, spending the rest on communication and synchronization.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary reference: Zhao et al., "PyTorch FSDP: Experiences on Scaling Fully Sharded Data Parallel," VLDB 2023 (https://www.vldb.org/pvldb/vol16/p3848-huang.pdf). PyTorch FSDP documentation: https://docs.pytorch.org/docs/stable/fsdp.html. The underlying theory comes from Rajbhandari et al., "ZeRO: Memory Optimizations Toward Training Trillion Parameter Models," SC 2020 (https://arxiv.org/abs/1910.02054). For the FairScale precursor implementation, see https://github.com/facebookresearch/fairscale.',
        'Study ZeRO Optimizer next for the theoretical foundation FSDP builds on. Study GPU All-Reduce to understand the collectives FSDP replaces and uses. Study Tensor Parallelism for the complementary approach of splitting math inside layers rather than sharding state across ranks. Study Pipeline Parallelism for splitting model depth across stages. Study Activation Checkpointing for the orthogonal memory lever that FSDP does not cover. A useful exercise before any large training run is to build a byte ledger: list parameters, gradients, optimizer state, activations, and communication buffers, assign each a size in bytes and a lifetime, and check which parallelism strategy addresses which term.',
      ],
    },
  ],
};
