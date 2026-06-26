// Activation rematerialization planner: profile activations, choose save versus
// recompute cuts, preserve replay semantics, and gate distributed training jobs.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'activation-rematerialization-budget-planner-case-study',
  title: 'Activation Rematerialization Budget Planner',
  category: 'Systems',
  summary: 'A production checkpointing case study: activation memory profiles, selective save/recompute policies, min-cut planning, distributed partitioning, and launch gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['memory plan', 'cut policy', 'distributed'], defaultValue: 'memory plan' },
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

function plannerGraph(title) {
  return graphState({
    nodes: [
      { id: 'model', label: 'model', x: 0.7, y: 3.6, note: 'blocks' },
      { id: 'profile', label: 'profile', x: 2.2, y: 2.0, note: 'bytes' },
      { id: 'ops', label: 'op cost', x: 2.2, y: 5.1, note: 'FLOPs' },
      { id: 'budget', label: 'budget', x: 4.0, y: 2.0, note: 'GB cap' },
      { id: 'planner', label: 'planner', x: 4.8, y: 3.6, note: 'cuts' },
      { id: 'save', label: 'save', x: 6.7, y: 2.0, note: 'bound' },
      { id: 'replay', label: 'replay', x: 6.7, y: 5.1, note: 'inside' },
      { id: 'train', label: 'train', x: 8.5, y: 3.6, note: 'step' },
      { id: 'trace', label: 'trace', x: 10.0, y: 3.6, note: 'gate' },
    ],
    edges: [
      { id: 'e-model-profile', from: 'model', to: 'profile', weight: 'live set' },
      { id: 'e-model-ops', from: 'model', to: 'ops', weight: 'cost' },
      { id: 'e-profile-budget', from: 'profile', to: 'budget', weight: 'peak' },
      { id: 'e-budget-planner', from: 'budget', to: 'planner', weight: 'cap' },
      { id: 'e-ops-planner', from: 'ops', to: 'planner', weight: 'penalty' },
      { id: 'e-planner-save', from: 'planner', to: 'save', weight: 'keep' },
      { id: 'e-planner-replay', from: 'planner', to: 'replay', weight: 'recomp' },
      { id: 'e-save-train', from: 'save', to: 'train', weight: 'load' },
      { id: 'e-replay-train', from: 'replay', to: 'train', weight: 'rerun' },
      { id: 'e-train-trace', from: 'train', to: 'trace', weight: 'metrics' },
    ],
  }, { title });
}

function cutGraph(title) {
  return graphState({
    nodes: [
      { id: 'x', label: 'x', x: 0.7, y: 3.5, note: 'input' },
      { id: 'mat', label: 'matmul', x: 2.2, y: 2.0, note: 'expensive' },
      { id: 'gelu', label: 'gelu', x: 3.8, y: 2.0, note: 'cheap' },
      { id: 'drop', label: 'dropout', x: 3.8, y: 5.0, note: 'rng' },
      { id: 'attn', label: 'attn', x: 5.4, y: 3.5, note: 'costly' },
      { id: 'norm', label: 'norm', x: 7.0, y: 3.5, note: 'small' },
      { id: 'loss', label: 'loss', x: 8.7, y: 3.5, note: 'bwd' },
      { id: 'cut', label: 'cut', x: 5.4, y: 1.1, note: 'save set' },
      { id: 'rng', label: 'rng', x: 5.4, y: 6.1, note: 'state' },
    ],
    edges: [
      { id: 'e-x-mat', from: 'x', to: 'mat', weight: 'act' },
      { id: 'e-mat-gelu', from: 'mat', to: 'gelu', weight: 'act' },
      { id: 'e-gelu-attn', from: 'gelu', to: 'attn', weight: 'act' },
      { id: 'e-x-drop', from: 'x', to: 'drop', weight: 'mask' },
      { id: 'e-drop-attn', from: 'drop', to: 'attn', weight: 'act' },
      { id: 'e-attn-norm', from: 'attn', to: 'norm', weight: 'act' },
      { id: 'e-norm-loss', from: 'norm', to: 'loss', weight: 'out' },
      { id: 'e-cut-attn', from: 'cut', to: 'attn', weight: 'restore' },
      { id: 'e-rng-drop', from: 'rng', to: 'drop', weight: 'same mask' },
    ],
  }, { title });
}

function* memoryPlan() {
  yield {
    state: plannerGraph('Rematerialization starts with a live-memory profile'),
    highlight: { active: ['model', 'profile', 'ops', 'budget', 'planner', 'e-model-profile', 'e-model-ops'], compare: ['train'], found: ['trace'] },
    explanation: 'Read this left to right as a budgeting pipeline. The planner needs activation sizes, operation costs, a memory cap, and correctness constraints before it can choose what to save and what to recompute.',
  };

  yield {
    state: labelMatrix(
      'Training memory ledger',
      [
        { id: 'param', label: 'param' },
        { id: 'optim', label: 'optim' },
        { id: 'grad', label: 'grad' },
        { id: 'act', label: 'act' },
        { id: 'temp', label: 'temp' },
      ],
      [
        { id: 'base', label: 'base' },
        { id: 'ac', label: 'AC' },
        { id: 'shard', label: 'shard' },
      ],
      [
        ['8G', '8G', '2G'],
        ['24G', '24G', '6G'],
        ['8G', '8G', '2G'],
        ['36G', '14G', '14G'],
        ['10G', '11G', '11G'],
      ],
    ),
    highlight: { active: ['act:base', 'act:ac'], found: ['param:shard', 'optim:shard', 'grad:shard'], compare: ['temp:ac'] },
    explanation: 'Checkpointing attacks activation memory. ZeRO and FSDP attack replicated parameter, optimizer, and gradient state. The ledger keeps those levers separate so a memory win is not misattributed.',
    invariant: 'A memory plan must account for every live bucket, not only model weights.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'peak GB', min: 20, max: 90 }, y: { label: 'tokens/s', min: 40, max: 115 } },
      series: [
        { id: 'eager', label: 'eager', points: [{ x: 86, y: 101 }, { x: 82, y: 103 }] },
        { id: 'plain', label: 'plain', points: [{ x: 52, y: 78 }, { x: 44, y: 69 }] },
        { id: 'sel', label: 'sel', points: [{ x: 66, y: 96 }, { x: 58, y: 91 }] },
        { id: 'budget', label: 'budg', points: [{ x: 72, y: 100 }, { x: 61, y: 93 }, { x: 51, y: 84 }] },
      ],
      markers: [
        { id: 'cap', x: 60, y: 92, label: 'cap' },
      ],
    }),
    highlight: { active: ['budget', 'cap'], compare: ['plain'], found: ['sel'] },
    explanation: 'A planner searches a Pareto curve: lower peak memory usually costs throughput, but selective and compiler-aware policies can avoid recomputing the most expensive operations.',
  };

  yield {
    state: labelMatrix(
      'Launch gate',
      [
        { id: 'fit', label: 'fit' },
        { id: 'step', label: 'step' },
        { id: 'loss', label: 'loss' },
        { id: 'rng', label: 'rng' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'gate', label: 'gate' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['peak<cap', 'OOM'],
        ['p95 ok', 'slow'],
        ['same', 'drift'],
        ['match', 'mask bug'],
        ['cut ids', 'blind'],
      ],
    ),
    highlight: { active: ['fit:gate', 'loss:gate', 'rng:gate'], compare: ['step:fail'], found: ['trace:gate'] },
    explanation: 'A checkpointing launch should gate on peak memory, step time, loss parity, RNG determinism, and replay trace coverage. Fitting once is not enough if gradients silently change.',
  };
}

function* cutPolicy() {
  yield {
    state: cutGraph('Selective checkpointing chooses op-level save rules'),
    highlight: { active: ['mat', 'gelu', 'attn', 'cut', 'e-cut-attn'], compare: ['drop'], found: ['rng'] },
    explanation: 'Read the graph as an operation-level policy, not one checkpoint box. Selective rematerialization can keep expensive matmuls and attention outputs while recomputing cheaper pointwise operations.',
  };

  yield {
    state: labelMatrix(
      'Op policy',
      [
        { id: 'mat', label: 'matmul' },
        { id: 'attn', label: 'attn' },
        { id: 'gelu', label: 'gelu' },
        { id: 'norm', label: 'norm' },
        { id: 'drop', label: 'drop' },
        { id: 'rng', label: 'rng' },
      ],
      [
        { id: 'choice', label: 'choice' },
        { id: 'why', label: 'why' },
      ],
      [
        ['save', 'costly'],
        ['save', 'costly'],
        ['recomp', 'cheap'],
        ['recomp', 'small'],
        ['save mask', 'same'],
        ['save', 'seed'],
      ],
    ),
    highlight: { active: ['mat:choice', 'attn:choice'], found: ['gelu:choice', 'norm:choice'], compare: ['drop:choice', 'rng:choice'] },
    explanation: 'The policy should be explicit. Compute-heavy ops are often saved. Cheap fusible ops are good replay candidates. Randomness needs a saved mask, saved RNG state, or a deterministic replay contract.',
  };

  yield {
    state: cutGraph('Compiler min-cut turns planning into graph partitioning'),
    highlight: { active: ['cut', 'mat', 'gelu', 'attn', 'norm'], found: ['loss'], compare: ['drop'] },
    explanation: 'Compiler-backed approaches trace a joint forward/backward graph and choose saved tensors as a cut. The cut minimizes saved activation memory subject to a cost model and recomputation constraints.',
  };

  yield {
    state: labelMatrix(
      'Replay trace',
      [
        { id: 'seg1', label: 'seg1' },
        { id: 'seg2', label: 'seg2' },
        { id: 'seg3', label: 'seg3' },
        { id: 'seg4', label: 'seg4' },
      ],
      [
        { id: 'save', label: 'save' },
        { id: 'recomp', label: 'recomp' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['input', 'gelu', 'ok'],
        ['attn out', 'norm', 'ok'],
        ['mask', 'drop', 'rng'],
        ['stage in', 'mlp', 'comm'],
      ],
    ),
    highlight: { active: ['seg1:recomp', 'seg2:recomp'], compare: ['seg3:risk', 'seg4:risk'], found: ['seg3:save'] },
    explanation: 'Trace every segment: what boundary was saved, what was recomputed, and what risk was handled. This makes checkpointing debuggable when memory, speed, or gradients regress.',
  };
}

function* distributed() {
  yield {
    state: plannerGraph('Distributed training adds partition and offload choices'),
    highlight: { active: ['budget', 'planner', 'save', 'replay', 'train'], found: ['trace'], compare: ['ops'] },
    explanation: 'Read the save and replay nodes as distributed placement choices now. Once training spans many GPUs, checkpoints may be local, partitioned across model-parallel ranks, moved to CPU, or aligned with pipeline-stage boundaries.',
  };

  yield {
    state: labelMatrix(
      'Memory lever map',
      [
        { id: 'ac', label: 'AC' },
        { id: 'zero', label: 'ZeRO' },
        { id: 'fsdp', label: 'FSDP' },
        { id: 'tp', label: 'TP' },
        { id: 'pipe', label: 'pipe' },
        { id: 'batch', label: 'batch' },
      ],
      [
        { id: 'saves', label: 'saves' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['acts', 'recomp'],
        ['optim', 'comm'],
        ['params', 'gather'],
        ['wide ops', 'collect'],
        ['depth', 'bubbles'],
        ['steps', 'noise'],
      ],
    ),
    highlight: { active: ['ac:saves', 'zero:saves', 'fsdp:saves'], found: ['tp:saves', 'pipe:saves'], compare: ['batch:cost'] },
    explanation: 'Activation checkpointing is one row in the memory plan. It is complementary to ZeRO, FSDP, tensor parallelism, pipeline parallelism, and batch-size tuning.',
  };

  yield {
    state: labelMatrix(
      'Dist AC modes',
      [
        { id: 'local', label: 'local' },
        { id: 'part', label: 'part' },
        { id: 'cpu', label: 'CPU' },
        { id: 'contig', label: 'contig' },
        { id: 'pipe', label: 'pipe' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['save on rank', 'peak'],
        ['split acts', 'gather'],
        ['offload', 'PCIe'],
        ['pack buf', 'frag'],
        ['stage cut', 'bubble'],
      ],
    ),
    highlight: { active: ['part:move', 'cpu:move', 'contig:move'], compare: ['pipe:watch'] },
    explanation: 'DeepSpeed-style activation checkpointing exposes distributed modes: partition activations, checkpoint to CPU, use contiguous buffers, and manage model-parallel random seeds. Each saves memory in a different place.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'seq len', min: 2, max: 32 }, y: { label: 'peak GB', min: 20, max: 120 } },
      series: [
        { id: 'base', label: 'base', points: [{ x: 4, y: 38 }, { x: 8, y: 58 }, { x: 16, y: 98 }, { x: 32, y: 120 }] },
        { id: 'ac', label: 'AC', points: [{ x: 4, y: 30 }, { x: 8, y: 39 }, { x: 16, y: 58 }, { x: 32, y: 96 }] },
        { id: 'part', label: 'part AC', points: [{ x: 4, y: 28 }, { x: 8, y: 34 }, { x: 16, y: 48 }, { x: 32, y: 75 }] },
      ],
      markers: [
        { id: 'cap', x: 16, y: 80, label: '80G' },
      ],
    }),
    highlight: { active: ['ac', 'part', 'cap'], compare: ['base'] },
    explanation: 'Long context makes activation memory grow quickly. Partitioned checkpointing can be the difference between reducing batch size and keeping the desired sequence length.',
  };

  yield {
    state: labelMatrix(
      'Failure ledger',
      [
        { id: 'oom', label: 'OOM' },
        { id: 'slow', label: 'slow' },
        { id: 'rng', label: 'rng' },
        { id: 'comm', label: 'comm' },
        { id: 'frag', label: 'frag' },
      ],
      [
        { id: 'cause', label: 'cause' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['cut', 'less'],
        ['recomp', 'costly'],
        ['mask', 'state'],
        ['gather', 'align'],
        ['buffers', 'contig'],
      ],
    ),
    highlight: { active: ['oom:fix', 'slow:fix', 'rng:fix'], compare: ['comm:cause'], found: ['frag:fix'] },
    explanation: 'Most checkpointing incidents are not mysterious: an unsafe cut, excessive recompute, RNG mismatch, cross-rank gather pressure, or memory fragmentation. The ledger should point to a concrete repair.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'memory plan') yield* memoryPlan();
  else if (view === 'cut policy') yield* cutPolicy();
  else if (view === 'distributed') yield* distributed();
  else throw new InputError('Pick an activation rematerialization view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The memory-plan view shows a training step as a budget problem. An activation is an intermediate tensor saved during the forward pass so the backward pass can compute gradients. Active nodes show which tensors are saved, which operations are replayed, and which budget gate decides whether the plan fits.',
        'The cut-policy view focuses on graph boundaries. A cut is a saved boundary tensor that lets the backward pass reconstruct the interior by rerunning part of the forward graph. The distributed view adds rank ownership, offload choices, and communication buffers that can erase savings if ignored.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/SRAM_Cell_%286_Transistors%29.svg/400px-SRAM_Cell_%286_Transistors%29.svg.png', alt:'SRAM cell schematic showing the six-transistor structure that underlies fast on-chip memory', caption:'An SRAM cell — the foundation of on-chip cache and register files. GPU HBM is built from DRAM, which is cheaper per bit but slower. Activation rematerialization trades recompute time for memory space because HBM capacity is the binding constraint in large training jobs. Source: Wikimedia Commons, Inductiveload, Public domain'},
        {type:'callout', text:'The core trade is memory for compute. Instead of saving every intermediate tensor during the forward pass, save a smaller set of boundary tensors and recompute the interior during backward. A budget planner makes this trade precise: it decides which tensors to keep, which to replay, and how much extra time the job can afford.'},
        'Large training jobs often run out of high-bandwidth GPU memory before they run out of arithmetic. Parameters, gradients, optimizer state, activations, temporary workspaces, and communication buffers all share the same device. Activations can dominate when sequence length, image size, or microbatch grows.',
        'Rematerialization exists to trade extra compute for lower peak memory. Instead of storing every intermediate tensor until backward, the system stores selected boundaries and recomputes the missing interior when needed. A budget planner makes that trade measurable rather than flipping checkpointing on everywhere.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious switch is checkpoint every fixed number of layers. That can make a model fit, and it is easy to explain: save fewer activations, then replay the skipped layers during backward. It is a reasonable first lever when a run fails with out-of-memory.',
        'Another obvious move is to copy a checkpoint pattern from a similar model. That works when model shape, sequence length, fusion behavior, parallelism, and microbatch are close. It breaks once any of those variables change enough to move the memory bottleneck.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'All operations are not equal. Replaying a GELU or layer norm may be cheap, while replaying attention or a large matrix multiply can erase throughput. A blanket policy can save memory by doubling the most expensive work.',
        'Memory buckets also interact. ZeRO, fully sharded data parallelism, tensor parallelism, pipeline stages, CUDA graph capture, kernel workspaces, and allocator fragmentation all affect peak memory. A plan that cuts activations from 36 GB to 14 GB can still fail if temporary buffers and reserved memory push the step over the cap.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Activation rematerialization is a graph planning problem. Nodes are operations, edges are tensors, and each tensor has size and lifetime. Each operation has replay cost, randomness constraints, fusion boundaries, and rank ownership.',
        'The planner chooses a cut set that satisfies a memory budget while keeping replay cost acceptable. The output is not a boolean flag; it is a policy table with saved tensors, recomputed regions, expected bytes saved, expected replay time, random-number handling, distributed placement, and launch gates.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The system first profiles a representative training step. It records parameter memory, optimizer memory, gradient memory, activation sizes, temporary workspaces, communication buffers, and peak reserved allocator memory. It also records operation timing and which operations are fused by the compiler.',
        'The planner then searches for cut boundaries. It prefers dropping large activations behind cheap replay, avoids replaying expensive attention or matmul regions when possible, and preserves random-state behavior for dropout or stochastic depth. In distributed runs, it checks whether a saved boundary is rank-local, partitioned, offloaded, or requires a gather.',
        'Execution follows the policy during forward and backward. Forward saves only boundary tensors. Backward reconstructs interior activations just in time, computes gradients, and releases replayed tensors quickly. The evidence gate compares memory, speed, loss, gradient samples, and random-number parity against a trusted baseline.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Backward does not need every forward intermediate stored for the whole step. It needs the correct value when a gradient formula consumes it. If the saved boundary tensors are sufficient to rerun the missing slice, the system can recreate the value at the right time.',
        'The correctness invariant is replay equivalence. Recomputed activations must match the values backward would have consumed from storage, including random masks, mixed-precision casts, and stateful modules. If that invariant holds, gradients match the no-rematerialization run within numeric tolerance while peak live memory falls.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The memory saving is the bytes not kept live across the forward-to-backward gap. The compute cost is the replayed forward work. If checkpointing saves 20 GB but adds 8 percent step time, it may be a good trade; if it saves 4 GB and adds 35 percent, it is usually the wrong lever.',
        'Cost behaves through tail steps, not only averages. Long sequences and large microbatches request more activation memory and often trigger larger replay regions. Offloading to CPU can reduce device peak but add transfer stalls; partitioned checkpointing can save per-rank memory but add synchronization.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern matters in transformer training, diffusion models with large feature maps, graph neural networks with large neighborhoods, and long-context fine-tuning. It lets teams keep a target sequence length, image resolution, or global batch size without moving to a larger accelerator class.',
        'It also composes with other memory levers. Sharding reduces parameter, optimizer, and gradient replication. Tensor and pipeline parallelism distribute work. Rematerialization reduces the stored forward live set. A good planner keeps these buckets separate so the team knows which lever paid for the run.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The most serious failure is silent gradient drift. Dropout masks, stochastic depth, random augmentation, stateful layers, and mixed-precision differences can make replay differ from the original forward pass. Loss parity and sampled gradient parity are required launch checks.',
        'It also fails when the planner saves the wrong memory bucket. Checkpointing cannot reduce optimizer state, parameter memory, or some temporary workspaces. If those dominate peak memory, rematerialization adds compute without solving the real problem.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A 24-layer transformer trains at sequence length 16,000 on 80 GB GPUs. The memory ledger shows 8 GB parameters, 24 GB optimizer state, 8 GB gradients, 36 GB activations, and 10 GB temporary buffers, for a peak near 86 GB. The run fails at the start of backward.',
        'A blanket checkpoint policy lowers peak to 52 GB but reduces throughput from 1,000 tokens per second to 610 because it replays attention and large matmuls. A selective plan saves attention and matmul outputs, replays pointwise and normalization regions, and preserves dropout RNG state. Peak becomes 60 GB and throughput becomes 910 tokens per second.',
        'The launch gate compares 100 steps against a no-checkpoint baseline on a smaller microbatch. Loss differs by less than 0.1 percent, sampled gradients stay within 1e-3 relative error, peak reserved memory stays below 66 GB, and p95 step time adds 9 percent. Those numbers justify the policy; the label checkpointing does not.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Training Deep Nets with Sublinear Memory Cost for the original rematerialization result. Study PyTorch activation checkpointing and min-cut recomputation discussions for graph-based planning. Study DeepSpeed activation checkpointing for partitioned activations, CPU checkpointing, contiguous buffers, and model-parallel random-state handling.',
        'Study next: Activation Checkpointing for the base mechanism, ZeRO Optimizer and Fully Sharded Data Parallel for non-activation memory, Tensor Parallelism and Pipeline Parallelism for placement, FlashAttention for attention memory, and Gradient Flow for the correctness signal rematerialization must preserve.',
      ],
    },
  ],
};
