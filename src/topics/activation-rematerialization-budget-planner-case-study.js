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
      heading: 'Why it exists',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/SRAM_Cell_%286_Transistors%29.svg/400px-SRAM_Cell_%286_Transistors%29.svg.png', alt:'SRAM cell schematic showing the six-transistor structure that underlies fast on-chip memory', caption:'An SRAM cell — the foundation of on-chip cache and register files. GPU HBM is built from DRAM, which is cheaper per bit but slower. Activation rematerialization trades recompute time for memory space because HBM capacity is the binding constraint in large training jobs. Source: Wikimedia Commons, Inductiveload, Public domain'},
        {type:'callout', text:'The core trade is memory for compute. Instead of saving every intermediate tensor during the forward pass, save a smaller set of boundary tensors and recompute the interior during backward. A budget planner makes this trade precise: it decides which tensors to keep, which to replay, and how much extra time the job can afford.'},
        'Activation rematerialization exists because modern training jobs can run out of memory on activations before they run out of memory on parameters. During the forward pass, the framework normally saves intermediate tensors so the backward pass can compute gradients. Those saved tensors are often large: sequence length, hidden width, attention heads, microbatch size, and temporary kernel workspaces all multiply into a live set that can exceed GPU memory.',
        'The basic trade is simple. Instead of saving every intermediate tensor, save a smaller set of boundary tensors and recompute some interior operations during backward. Memory falls because fewer activations stay live. Compute rises because part of the forward work is performed again. A budget planner is the production form of that trade: it decides which tensors to keep, which operations to replay, how much extra time the job can afford, and what evidence must pass before the run is trusted.',
      ],
    },
    {
      heading: 'Why the obvious switch fails',
      paragraphs: [
        'The obvious approach is to turn on checkpointing everywhere or checkpoint every fixed number of layers. That can make a job fit, but it treats all operations as if they had the same cost and the same correctness constraints. Replaying a cheap GELU or layer norm is usually fine. Replaying a large attention block, a dense matmul, or an unfused kernel group can make throughput collapse. A policy that saves memory by doubling the most expensive work is not a good policy.',
        'A second obvious approach is to copy a checkpoint pattern from a different model. That is unreliable because the right cut depends on the actual model graph, sequence length, compiler behavior, tensor parallel degree, pipeline stage boundaries, random operations, and memory budget. The policy that works for a 4k-context model may be poor for a 32k-context model. The policy that works before a kernel or compiler change may be wrong after fusion changes the operation graph.',
        'The third mistake is to treat activation memory in isolation. ZeRO, FSDP, tensor parallelism, optimizer state sharding, gradient accumulation, temporary buffers, CUDA graphs, and kernel workspaces all share the same device memory. A planner that claims success because saved activations fell from 36 GB to 14 GB can still fail if reserved memory, communication buffers, or temporary workspaces push the step over the real cap.',
      ],
    },
    {
      heading: 'Core mechanism',
      paragraphs: [
        'The classical result behind this topic is Training Deep Nets with Sublinear Memory Cost, which showed that deep networks can trade extra forward computation for much lower activation memory: https://arxiv.org/abs/1604.06174. In a production transformer training stack, that result becomes a constrained planning problem over a graph. The nodes are operations. The edges are tensors. Each tensor has a byte size and lifetime. Each operation has an estimated replay cost and may belong to a compiler fusion group.',
        'The planner first builds or consumes a profile of the training step. It records activation sizes, operation costs, kernel choices, randomness requirements, distributed ownership, and memory that checkpointing cannot reduce. Then it chooses a cut set. A cut set is the boundary of saved tensors that lets backward reconstruct the needed values by replaying the forward graph inside each segment. The output is not merely a boolean flag; it is a table of saved boundaries, recomputed regions, RNG handling, expected bytes saved, expected replay time, rank ownership, and launch gates.',
        'Compiler-backed approaches can express the same idea as graph partitioning. PyTorch material on activation checkpointing describes ordinary checkpointing, selective activation checkpointing, torch.compile min-cut planning, and memory budget APIs. A min-cut view assigns costs to saving tensors and recomputing operations, then finds a boundary that meets the memory goal while avoiding excessive replay. The graph formulation matters because it can see operation-level choices that a layer-level manual rule misses.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Rematerialization works because backward does not require every forward intermediate to be stored at the same time. It only requires the correct values when each gradient computation needs them. If the saved boundary tensors are sufficient to rerun the forward slice, then the system can reconstruct the missing interior activations just in time. This changes the peak live set: many tensors that would have lived across the whole forward pass are discarded and recreated later.',
        'The trade is favorable when the dropped tensors are large and the replayed computation is cheap relative to the training step. Pointwise operations, small normalization operations, and short fused interiors are common candidates. Large matmuls and attention operations are often expensive enough that saving their outputs is better. Random operations such as dropout need special handling because replay must generate the same mask or preserve the exact mask. Without that contract, the gradients can silently change.',
        'The memory-plan view in this module shows the pipeline: model graph, activation profile, operation-cost profile, memory cap, planner, save set, replay set, training step, and evidence gate. The cut-policy view zooms into operation-level choices. The distributed view adds placement: checkpointed activations may be rank-local, partitioned across tensor-parallel ranks, offloaded to CPU, packed into contiguous buffers, or aligned to pipeline boundaries.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a 24-layer transformer trains at sequence length 16k on 80 GB GPUs. The base run fails near the start of backward. The memory ledger shows 8 GB of parameters, 24 GB of optimizer state, 8 GB of gradients, 36 GB of activations, and about 10 GB of temporary buffers. Replication and optimizer state are already handled by sharding, so the remaining pressure is mostly activation memory plus temporaries.',
        'A global checkpoint switch makes the run fit at 52 GB peak, but tokens per second drop too far because the policy replays expensive attention and matmul work. A selective planner tries a better policy. It saves the outputs of large attention and matmul regions, recomputes cheap pointwise and normalization work, saves or regenerates dropout masks deterministically, and places cuts at transformer block boundaries so the plan is easy to inspect. Peak memory lands near the 60 GB cap while throughput stays close to the eager baseline.',
        'The first policy still has a p95 step-time spike on long sequences. The planner then uses partitioned activation checkpointing across tensor-parallel ranks. Each rank stores only its owned activation slice where the framework can safely reconstruct the full value during backward. A final gate compares a short no-checkpoint baseline with the checkpointed run: peak allocation, reserved memory, step time, loss parity, gradient parity on sampled tensors, RNG parity, and segment coverage must all pass.',
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        'This pattern matters most in large transformer training, long-context models, diffusion models with large feature maps, graph neural networks with large sampled neighborhoods, and any model where activation memory grows faster than parameter memory. It is especially important when the business goal is not merely to fit the model but to keep a target global batch size, sequence length, or image resolution without buying a larger accelerator class.',
        'It also matters in distributed training because checkpointing composes with other memory levers. ZeRO and FSDP reduce replicated optimizer, gradient, and parameter state. Tensor parallelism spreads wide operations. Pipeline parallelism spreads depth. Activation checkpointing reduces the stored forward live set. Batch-size tuning reduces many buckets at once but changes optimization behavior. A good memory plan keeps these levers separate so the team knows which one paid for the successful run.',
        'DeepSpeed-style activation checkpointing exposes distributed choices such as partitioned activations, CPU checkpointing, contiguous buffers, and model-parallel random-state management: https://deepspeed.readthedocs.io/en/latest/activation-checkpointing.html. These choices save memory in different places. Partitioning reduces per-rank storage. CPU offload trades GPU memory for PCIe or NVLink transfer. Contiguous buffers reduce fragmentation. Random-state tracking protects replay correctness.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The most serious failure is silent correctness drift. Dropout masks, stochastic depth, random augmentations inside the graph, mixed precision casts, and stateful modules can all make replay produce different values unless the framework preserves the right state. Loss parity and gradient checks on a short run are not optional when a new policy is introduced.',
        'The next failure is a bad compute trade. If the planner saves little memory but replays large attention or matmul regions, the run may fit while becoming uneconomic. Another failure is distributed movement. A cut that looks cheap on one GPU can require cross-rank gathers during backward. Offload can save device memory but introduce transfer stalls. Contiguous checkpoint buffers can help fragmentation, but mis-sized buffers waste memory or force fallback allocation.',
        'Measurement can also mislead. Peak allocated memory, peak reserved memory, temporary workspace size, CUDA graph capture behavior, and allocator fragmentation are not the same metric. A launch that passes on one sequence length, one microbatch, or one kernel version can fail after an apparently unrelated change. Treat the policy as part of the model runtime contract, not as a one-time tuning trick.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Start with a memory ledger. Separate parameters, optimizer state, gradients, activations, temporary buffers, communication buffers, and reserved allocator memory. Then profile the operation graph. Record tensor sizes, operation costs, fusion groups, random operations, and rank ownership. Only after that choose a policy. This prevents the common error of using checkpointing to solve a memory bucket that checkpointing cannot reduce.',
        'Emit the policy as auditable data: segment id, saved boundary tensors, recomputed operations, estimated bytes saved, measured bytes saved, replay milliseconds, RNG mode, distributed placement, and fallback action. Store the policy with the training configuration. Revalidate it when sequence length, model architecture, compiler mode, kernel library, parallelism degree, or microbatch size changes.',
        'Gate the launch with both performance and correctness checks. The minimal gate should include peak allocated memory, peak reserved memory, p50 and p95 step time, tokens per second, loss parity against a small no-checkpoint run, gradient parity on sampled tensors, RNG replay parity, and segment coverage. If any item fails, the policy should explain whether to save more tensors, replay less, move a cut boundary, change distributed placement, or use a different memory lever.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources for this topic are Training Deep Nets with Sublinear Memory Cost at https://arxiv.org/abs/1604.06174, PyTorch activation checkpointing techniques at https://pytorch.org/blog/activation-checkpointing-techniques/, the PyTorch min-cut recomputation discussion at https://dev-discuss.pytorch.org/t/min-cut-optimal-recomputation-i-e-activation-checkpointing-with-aotautograd/467, and DeepSpeed activation checkpointing at https://deepspeed.readthedocs.io/en/latest/activation-checkpointing.html.',
        'Study next: Activation Checkpointing for the basic mechanism, ZeRO Optimizer and Fully Sharded Data Parallel for non-activation memory, Tensor Parallelism and Pipeline Parallelism for distributed placement, FlashAttention for attention memory behavior, Batch Size Scaling for optimization effects, Transformer Block for the local graph shape, GPU All-Reduce for communication costs, and Gradient Flow for the correctness signal that checkpointing must preserve.',
      ],
    },
  ],
};
