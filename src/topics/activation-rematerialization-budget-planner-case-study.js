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
    explanation: 'The production problem is not just "turn on checkpointing." The planner needs activation sizes, operation costs, a memory cap, and correctness constraints before choosing what to save and what to recompute.',
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
    explanation: 'Plain checkpointing replays a whole region. Selective rematerialization can keep expensive matmuls and attention outputs while recomputing cheaper pointwise operations.',
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
    explanation: 'Once training spans many GPUs, the planner also decides whether activation checkpoints are local, partitioned across model-parallel ranks, moved to CPU, or aligned with pipeline-stage boundaries.',
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
      heading: 'What it is',
      paragraphs: [
        'An activation rematerialization budget planner is the production version of activation checkpointing. It profiles the training graph, estimates activation bytes and replay cost, chooses save-versus-recompute cuts, preserves replay semantics, and gates the job against peak memory, step time, and gradient correctness.',
        'The base Activation Checkpointing topic explains the concept. This case study treats checkpointing as a planning data structure: a ledger of saved tensors, recomputed regions, RNG state, distributed partitioning, and launch metrics.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The classical result is Training Deep Nets with Sublinear Memory Cost, which showed that deep networks can trade extra forward computation for much lower activation memory: https://arxiv.org/abs/1604.06174. In a production transformer stack, the same idea becomes a budget problem. The planner profiles activation sizes, marks expensive operators, keeps boundaries, and recomputes interiors only where the memory win justifies the cost.',
        'PyTorch now documents a spectrum of approaches: ordinary activation checkpointing, torch.compile min-cut partitioning, selective activation checkpointing, and a compile-only memory budget API: https://pytorch.org/blog/activation-checkpointing-techniques/. The key shift is from manual regions to policies and Pareto curves: enough rematerialization to fit the job, not so much that the step becomes too slow.',
      ],
    },
    {
      heading: 'Data structure',
      paragraphs: [
        'The planner stores an operation graph with activation sizes, compute cost, fusion groups, randomness requirements, stage ownership, and allowed policies. The output is a cut set: tensors to save, segments to replay, random masks or RNG states to preserve, and distributed movement required by each segment.',
        'A useful trace row contains step id, segment id, saved boundary, recomputed ops, estimated bytes saved, measured bytes saved, replay milliseconds, RNG mode, rank ownership, and failure action. This turns checkpointing from a boolean flag into a debuggable memory plan.',
      ],
    },
    {
      heading: 'Complete case study: long-context transformer fit',
      paragraphs: [
        'A 24-layer transformer trains with sequence length 16k on 80 GB GPUs. The base run OOMs at the start of backward because activation memory spikes. Full checkpointing fits but cuts tokens per second too much. The planner keeps matmul and attention outputs, recomputes pointwise and normalization ops, saves dropout masks, and aligns cut boundaries with transformer blocks.',
        'After the first pass, peak memory falls below the cap but p95 step time is still high. The planner changes the policy to save flash-attention outputs and uses partitioned activation checkpointing across tensor-parallel ranks. The final gate requires peak memory below cap, loss parity with a no-checkpoint micro-run, stable RNG replay, and trace coverage for every checkpointed segment.',
      ],
    },
    {
      heading: 'Compiler and distributed notes',
      paragraphs: [
        'Compiler min-cut changes the tradeoff because fusion can make recomputation cheaper than a simple per-op model predicts. A PyTorch developer note describes formulating recomputation as a max-flow/min-cut problem on the joint forward/backward graph: https://dev-discuss.pytorch.org/t/min-cut-optimal-recomputation-i-e-activation-checkpointing-with-aotautograd/467. The MLSys 2023 fusion-aware checkpointing paper argues that operator fusion can improve both peak memory and runtime in some cases: https://proceedings.mlsys.org/paper_files/paper/2023/file/8a27bb69950c0b46cdb36d10e5514cc8-Paper-mlsys2023.pdf.',
        'Distributed training adds another layer. DeepSpeed documents activation partitioning across GPUs, CPU checkpointing, contiguous memory optimization, and random seed handling: https://deepspeed.readthedocs.io/en/latest/activation-checkpointing.html. These are not interchangeable knobs; partitioning reduces per-rank activation memory, CPU offload trades GPU memory for transfer latency, and contiguous buffers reduce fragmentation.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not checkpoint random or stateful code without a replay contract. Do not recompute expensive attention and matmuls just because they sit inside a checkpointed block. Do not claim memory savings without measuring peak allocation and reserved memory. Do not ignore p95 step time; checkpointing can fit the model while making the job economically worse.',
        'Study Activation Checkpointing, ZeRO Optimizer, Fully Sharded Data Parallel, Tensor Parallelism, Pipeline Parallelism, FlashAttention, Batch Size Scaling, Transformer Block, GPU All-Reduce, and Gradient Flow next.',
      ],
    },
  ],
};
