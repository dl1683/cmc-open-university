// Accelerator kernel compatibility matrix: decide which backend/kernel is
// legal for an op, dtype, shape, and device before serving traffic.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'accelerator-kernel-compatibility-matrix-case-study',
  title: 'Accelerator Kernel Compatibility Matrix',
  category: 'Systems',
  summary: 'A production portability case study: track op coverage, dtype and shape constraints, dispatch priority, fallbacks, parity checks, and rollout gates across AI accelerators.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['support matrix', 'dispatch route', 'fallback audit'], defaultValue: 'support matrix' },
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

function routeGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.7, y: 3.6, note: 'model' },
      { id: 'trace', label: 'trace', x: 2.0, y: 2.0, note: 'ops' },
      { id: 'op', label: 'op', x: 2.0, y: 5.2, note: 'schema' },
      { id: 'key', label: 'key', x: 3.5, y: 3.6, note: 'dtype+shape' },
      { id: 'reg', label: 'reg', x: 5.0, y: 3.6, note: 'kernels' },
      { id: 'cuda', label: 'CUDA', x: 6.7, y: 1.3, note: 'fast' },
      { id: 'hip', label: 'HIP', x: 6.7, y: 2.8, note: 'ported' },
      { id: 'xla', label: 'XLA', x: 6.7, y: 4.3, note: 'compile' },
      { id: 'cpu', label: 'CPU', x: 6.7, y: 5.8, note: 'safe' },
      { id: 'pick', label: 'pick', x: 8.2, y: 3.6, note: 'policy' },
      { id: 'run', label: 'run', x: 9.4, y: 2.5, note: 'serve' },
      { id: 'audit', label: 'audit', x: 9.4, y: 4.9, note: 'parity' },
    ],
    edges: [
      { id: 'e-req-trace', from: 'req', to: 'trace' },
      { id: 'e-req-op', from: 'req', to: 'op' },
      { id: 'e-trace-key', from: 'trace', to: 'key', weight: 'op ids' },
      { id: 'e-op-key', from: 'op', to: 'key', weight: 'schema' },
      { id: 'e-key-reg', from: 'key', to: 'reg', weight: 'lookup' },
      { id: 'e-reg-cuda', from: 'reg', to: 'cuda' },
      { id: 'e-reg-hip', from: 'reg', to: 'hip' },
      { id: 'e-reg-xla', from: 'reg', to: 'xla' },
      { id: 'e-reg-cpu', from: 'reg', to: 'cpu' },
      { id: 'e-cuda-pick', from: 'cuda', to: 'pick' },
      { id: 'e-hip-pick', from: 'hip', to: 'pick' },
      { id: 'e-xla-pick', from: 'xla', to: 'pick' },
      { id: 'e-cpu-pick', from: 'cpu', to: 'pick' },
      { id: 'e-pick-run', from: 'pick', to: 'run', weight: 'route' },
      { id: 'e-pick-audit', from: 'pick', to: 'audit', weight: 'reason' },
    ],
  }, { title });
}

function* supportMatrix() {
  yield {
    state: labelMatrix(
      'Start with op coverage by backend',
      [
        { id: 'matmul', label: 'matmul' },
        { id: 'softmax', label: 'softmax' },
        { id: 'topk', label: 'topk' },
        { id: 'sparse', label: 'sparse' },
        { id: 'custom', label: 'custom' },
        { id: 'allreduce', label: 'allreduce' },
      ],
      [
        { id: 'cuda', label: 'CUDA' },
        { id: 'hip', label: 'HIP' },
        { id: 'xla', label: 'XLA' },
        { id: 'cpu', label: 'CPU' },
      ],
      [
        ['fast', 'ok', 'fused', 'ok'],
        ['fused', 'ported', 'fused', 'ok'],
        ['fast', 'test', 'miss', 'ok'],
        ['mixed', 'miss', 'miss', 'ok'],
        ['triton', 'test', 'plugin', 'ref'],
        ['nccl', 'rccl', 'xla', 'slow'],
      ],
    ),
    highlight: { active: ['matmul:cuda', 'softmax:cuda', 'softmax:hip', 'custom:xla'], compare: ['sparse:xla', 'sparse:hip'], found: ['custom:cpu'] },
    explanation: 'The first table is plain coverage: which operation family has a usable implementation on each backend. The important cells are not only the fast ones. Miss, test, and reference cells tell the router where fallback and parity checks are mandatory.',
    invariant: 'Portability starts as a matrix: op family by backend, with explicit unknown and fallback states.',
  };

  yield {
    state: labelMatrix(
      'Add dtype gates before routing',
      [
        { id: 'fp32', label: 'fp32' },
        { id: 'fp16', label: 'fp16' },
        { id: 'bf16', label: 'bf16' },
        { id: 'int8', label: 'int8' },
        { id: 'fp8', label: 'fp8' },
      ],
      [
        { id: 'cuda', label: 'CUDA' },
        { id: 'hip', label: 'HIP' },
        { id: 'xla', label: 'XLA' },
        { id: 'cpu', label: 'CPU' },
      ],
      [
        ['base', 'base', 'base', 'base'],
        ['fast', 'fast', 'ok', 'emulate'],
        ['fast', 'fast', 'ok', 'slow'],
        ['quant', 'quant', 'compile', 'ok'],
        ['new', 'test', 'gate', 'no'],
      ],
    ),
    highlight: { active: ['fp16:cuda', 'bf16:hip', 'int8:xla'], compare: ['fp8:hip', 'fp8:cpu'], found: ['fp8:xla'] },
    explanation: 'Coverage by op is still not enough. The same op can be safe in fp32, fast in bf16, experimental in fp8, or absent for a quantized path. A compatibility key needs dtype, not just op name.',
  };

  yield {
    state: labelMatrix(
      'Shape constraints decide the legal fast path',
      [
        { id: 'tile', label: 'tile fit' },
        { id: 'static', label: 'static' },
        { id: 'batch', label: 'batch' },
        { id: 'stride', label: 'stride' },
        { id: 'addr', label: 'addr' },
      ],
      [
        { id: 'cuda', label: 'CUDA' },
        { id: 'hip', label: 'HIP' },
        { id: 'xla', label: 'XLA' },
        { id: 'cpu', label: 'CPU' },
      ],
      [
        ['needed', 'needed', 'lower', 'none'],
        ['graph ok', 'graph ok', 'compile', 'none'],
        ['bucket', 'bucket', 'compile', 'any'],
        ['contig', 'contig', 'layout', 'any'],
        ['stable', 'stable', 'opaque', 'any'],
      ],
    ),
    highlight: { active: ['tile:cuda', 'static:xla', 'addr:cuda', 'batch:hip'], compare: ['addr:cpu'], found: ['stride:xla'] },
    explanation: 'Kernel support usually has shape constraints. Triton-style kernels may require a tile that fits SRAM. CUDA graph replay may require static addresses. Compilers may specialize on symbolic or static shapes. CPU fallback tolerates more shapes but pays in latency.',
  };

  yield {
    state: labelMatrix(
      'Compatibility record fields',
      [
        { id: 'op', label: 'op' },
        { id: 'dtype', label: 'dtype' },
        { id: 'shape', label: 'shape' },
        { id: 'backend', label: 'backend' },
        { id: 'kernel', label: 'kernel' },
        { id: 'guard', label: 'guard' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['schema id', 'same math'],
        ['precision', 'numeric tol'],
        ['buckets', 'legal path'],
        ['CUDA/HIP', 'dispatch key'],
        ['version', 'repro'],
        ['fallback', 'safe miss'],
      ],
    ),
    highlight: { active: ['op:stores', 'dtype:stores', 'shape:stores', 'backend:stores', 'guard:stores'], found: ['kernel:why'] },
    explanation: 'The data structure is a record, not a spreadsheet screenshot. Each cell should bind schema id, dtype, shape bucket, backend, kernel version, guard predicate, numeric tolerance, fallback, rollout status, and evidence pointer.',
  };

  yield {
    state: labelMatrix(
      'Do not ship from support alone',
      [
        { id: 'cover', label: 'cover' },
        { id: 'parity', label: 'parity' },
        { id: 'perf', label: 'perf' },
        { id: 'p99', label: 'p99' },
        { id: 'ops', label: 'ops' },
      ],
      [
        { id: 'asks', label: 'asks' },
        { id: 'ship', label: 'ship' },
      ],
      [
        ['has?', 'no'],
        ['same?', 'need'],
        ['fast?', 'need'],
        ['tail?', 'need'],
        ['debug?', 'need'],
      ],
    ),
    highlight: { compare: ['cover:ship'], active: ['parity:ship', 'perf:ship', 'p99:ship', 'ops:ship'] },
    explanation: 'A backend can be technically supported and still unfit for production. Promotion needs parity, representative latency, tail behavior, memory pressure, observability, and a rollback route.',
  };
}

function* dispatchRoute() {
  yield {
    state: routeGraph('A request becomes an op and shape key'),
    highlight: { active: ['req', 'trace', 'op', 'key', 'e-req-trace', 'e-req-op', 'e-trace-key', 'e-op-key'], compare: ['reg'] },
    explanation: 'Runtime dispatch starts by extracting the operation schema, dtype, layout, and shape bucket from the model trace. That compound key is what the compatibility matrix can answer.',
  };

  yield {
    state: routeGraph('The registry returns legal backend candidates'),
    highlight: { active: ['key', 'reg', 'cuda', 'hip', 'xla', 'cpu', 'e-key-reg'], found: ['e-reg-cuda', 'e-reg-hip', 'e-reg-xla', 'e-reg-cpu'] },
    explanation: 'The kernel registry maps the key to candidates. CUDA may have a tuned kernel, HIP may have a port in test, XLA may compile the subgraph, and CPU is the reference fallback.',
    invariant: 'The registry answers legality before the router optimizes for speed.',
  };

  yield {
    state: routeGraph('Dispatch priority chooses one route'),
    highlight: { active: ['cuda', 'pick', 'run', 'e-cuda-pick', 'e-pick-run'], compare: ['hip', 'xla', 'cpu'], found: ['audit'] },
    explanation: 'Priority order is policy. ONNX Runtime execution providers use ordered providers and capability queries. PyTorch dispatch keys organize backend kernels. A product router adds rollout status, cost, and risk gates on top.',
  };

  yield {
    state: routeGraph('A miss falls back without losing evidence'),
    highlight: { active: ['hip', 'cpu', 'pick', 'audit', 'e-hip-pick', 'e-cpu-pick', 'e-pick-audit'], compare: ['run'] },
    explanation: 'If the preferred backend is unsupported, stale, or outside tolerance, the route should fall back and log why. The fallback event is training data for the portability roadmap, not noise to hide.',
  };

  yield {
    state: labelMatrix(
      'Dispatch decision packet',
      [
        { id: 'key', label: 'key' },
        { id: 'rank', label: 'rank' },
        { id: 'guard', label: 'guard' },
        { id: 'tol', label: 'tol' },
        { id: 'route', label: 'route' },
        { id: 'event', label: 'event' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'debugs', label: 'debugs' },
      ],
      [
        ['op+shape', 'cell'],
        ['priority', 'route'],
        ['predicate', 'fast'],
        ['numeric', 'drift'],
        ['backend', 'ran'],
        ['reason', 'fall'],
      ],
    ),
    highlight: { active: ['key:stores', 'rank:stores', 'guard:stores', 'route:stores', 'event:debugs'], found: ['tol:debugs'] },
    explanation: 'Every dispatch should be replayable. Store the matched key, candidate rank, guard predicate, tolerance, chosen backend, kernel version, fallback reason, and metric tags.',
  };
}

function* fallbackAudit() {
  yield {
    state: plotState({
      axes: { x: { label: 'op rank', min: 1, max: 8 }, y: { label: 'miss rate', min: 0, max: 0.4 } },
      series: [
        { id: 'cuda', label: 'CUDA', points: [{ x: 1, y: 0.02 }, { x: 2, y: 0.03 }, { x: 3, y: 0.05 }, { x: 4, y: 0.08 }, { x: 6, y: 0.12 }, { x: 8, y: 0.16 }] },
        { id: 'hip', label: 'HIP', points: [{ x: 1, y: 0.05 }, { x: 2, y: 0.08 }, { x: 3, y: 0.14 }, { x: 4, y: 0.19 }, { x: 6, y: 0.27 }, { x: 8, y: 0.33 }] },
        { id: 'xla', label: 'XLA', points: [{ x: 1, y: 0.04 }, { x: 2, y: 0.06 }, { x: 3, y: 0.09 }, { x: 4, y: 0.15 }, { x: 6, y: 0.22 }, { x: 8, y: 0.30 }] },
      ],
      markers: [
        { id: 'gate', x: 4, y: 0.1, label: 'gate' },
      ],
    }),
    highlight: { active: ['hip', 'xla', 'gate'], compare: ['cuda'] },
    explanation: 'Fallbacks usually concentrate in a tail of operations, shapes, or dtype combinations. Rank the misses by traffic impact. Fixing one high-rank unsupported op can matter more than adding ten cold kernels.',
  };

  yield {
    state: labelMatrix(
      'Fallback reason ledger',
      [
        { id: 'opmiss', label: 'op miss' },
        { id: 'dtype', label: 'dtype' },
        { id: 'shape', label: 'shape' },
        { id: 'tol', label: 'tol fail' },
        { id: 'oom', label: 'oom' },
        { id: 'crash', label: 'crash' },
      ],
      [
        { id: 'cause', label: 'cause' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['no kernel', 'port op'],
        ['no fp8', 'gate dtype'],
        ['bad bucket', 'pad/rekey'],
        ['drift', 'tune tol'],
        ['memory', 'tile/split'],
        ['driver', 'quarantine'],
      ],
    ),
    highlight: { active: ['opmiss:fix', 'dtype:fix', 'shape:fix', 'crash:fix'], found: ['tol:cause'] },
    explanation: 'Do not collapse fallback into one counter. The reason ledger separates missing operators, unsupported dtypes, invalid shapes, numeric drift, memory pressure, and backend instability.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'coverage', min: 0.4, max: 1.0 }, y: { label: 'speedup', min: 0.6, max: 2.2 } },
      series: [
        { id: 'cuda', label: 'CUDA', points: [{ x: 0.92, y: 1.8 }, { x: 0.95, y: 1.9 }, { x: 0.97, y: 2.0 }] },
        { id: 'hip', label: 'HIP', points: [{ x: 0.62, y: 1.1 }, { x: 0.72, y: 1.35 }, { x: 0.83, y: 1.55 }] },
        { id: 'xla', label: 'XLA', points: [{ x: 0.68, y: 1.25 }, { x: 0.78, y: 1.5 }, { x: 0.88, y: 1.65 }] },
      ],
      markers: [
        { id: 'ship', x: 0.85, y: 1.5, label: 'ship gate' },
      ],
    }),
    highlight: { active: ['hip', 'xla', 'ship'], compare: ['cuda'] },
    explanation: 'A backend should move toward a promotion gate: enough traffic coverage, enough speedup, and acceptable parity. The matrix gives the x-axis; benchmarks and traces give the y-axis.',
  };

  yield {
    state: labelMatrix(
      'Rollout gates',
      [
        { id: 'shadow', label: 'shadow' },
        { id: 'canary', label: 'canary' },
        { id: 'ramp', label: 'ramp' },
        { id: 'prod', label: 'prod' },
      ],
      [
        { id: 'traffic', label: 'traffic' },
        { id: 'exit', label: 'exit' },
      ],
      [
        ['mirror', 'parity ok'],
        ['1 pct', 'p99 ok'],
        ['25 pct', 'fallback low'],
        ['100 pct', 'owned'],
      ],
    ),
    highlight: { active: ['shadow:exit', 'canary:exit', 'ramp:exit'], found: ['prod:exit'] },
    explanation: 'Accelerator migration should use the same discipline as feature rollout. Shadow first, canary small cohorts, ramp only after fallback and p99 stay below thresholds, and keep an owned rollback path.',
  };

  yield {
    state: labelMatrix(
      'Case study: port one fused softmax',
      [
        { id: 'spec', label: 'spec' },
        { id: 'port', label: 'port' },
        { id: 'parity', label: 'parity' },
        { id: 'bench', label: 'bench' },
        { id: 'gate', label: 'gate' },
      ],
      [
        { id: 'artifact', label: 'artifact' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['op key', 'row'],
        ['HIP', 'arch'],
        ['gold', 'drift'],
        ['shapes', 'p99'],
        ['flag', 'ramp'],
      ],
    ),
    highlight: { active: ['spec:artifact', 'port:artifact', 'parity:artifact', 'bench:artifact', 'gate:artifact'], compare: ['gate:risk'] },
    explanation: 'A complete port is a chain of artifacts: compatibility row, backend implementation, reference parity cases, benchmark shape set, rollout flag, and fallback telemetry. Missing any link turns portability into hope.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'support matrix') yield* supportMatrix();
  else if (view === 'dispatch route') yield* dispatchRoute();
  else if (view === 'fallback audit') yield* fallbackAudit();
  else throw new InputError('Pick an accelerator compatibility view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The support-matrix view builds a compatibility table for accelerator kernels. A kernel is the low-level program that performs one operation on a device such as a GPU, NPU, or CPU vector unit. Active cells show the current backend, data type, shape bucket, or layout being checked; orange cells show gaps; green cells show a safe route.',
        'The dispatch-route view follows one model operation from graph trace to chosen backend. Watch for the moment where a fast candidate is rejected because its guard does not match the request. The fallback-audit view turns those misses into an engineering queue, so compatibility becomes a measured state instead of a slogan.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/d/d3/Nvidia_GV100_GPU.png', alt:'Nvidia GV100 GPU die shot showing thousands of processing cores on a single chip', caption:'An Nvidia GV100 die. Every one of those processing cores needs a tested kernel for every op, dtype, and shape the model actually produces. One missing kernel turns "runs on this GPU" into a lie. Source: Wikimedia Commons, Nvidia, Public domain'},
        {type:'callout', text:'Kernel compatibility is not a binary question. Each operation needs a legal kernel for the specific backend, dtype, shape range, and layout the model produces. The compatibility matrix is the preflight check that answers whether a model can actually run — not just load — on an accelerator under production constraints.'},
        'A model graph contains many operations, and each operation carries shape, data type, layout, memory, and compiler assumptions. Saying that a model runs on an accelerator means every operation has a legal implementation for the exact traffic the model will produce. Loading the checkpoint is only the first step.',
        'The compatibility matrix exists because production serving needs a preflight answer before traffic moves. It asks whether each operation key has a tested kernel, a numeric parity bound, a rollout status, and a fallback route. Without that table, hardware migration becomes a chain of surprises found by users.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious check is operator-name support. If matmul, softmax, layer normalization, gather, and all-reduce all appear in the backend, the migration looks plausible. A smoke test on one input may even pass.',
        'This is a reasonable start because missing operators are real blockers. Frameworks already expose dispatch tables and backend registrations, so a name-level scan is cheap. It also catches the simplest failure before teams spend time on benchmark tuning.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'An operator name is too coarse. Matmul with fp16, contiguous layout, batch 1, and aligned dimensions may hit a tuned kernel, while the same name with bf16, strided layout, dynamic batch 129, or int8 accumulation may fall back or fail. Shape and layout are part of correctness, not just performance.',
        'The second wall is numeric parity. A custom kernel can be fast and still drift from the reference result beyond the model slice tolerance. A small per-layer error can accumulate through many layers and change generation quality, ranking, or safety behavior.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The compatibility unit should be a compound operation signature, not an operator family name. A useful key includes operation schema, data type, layout, shape bucket, device class, backend, and sometimes sparsity or quantization metadata. The value is a decision packet containing status, guard predicate, parity evidence, latency evidence, fallback backend, owner, and rollout stage.',
        'The invariant is legality before speed. The router may choose the fastest candidate only after guards pass and parity evidence exists for the relevant key. A fast illegal kernel is not an optimization; it is a correctness bug with a lower latency.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The system traces the model and extracts operation keys. Shape values are usually bucketed, such as batch 1 to 8, batch 9 to 64, and batch 65 to 256, so the registry stays finite. Each key lookup returns candidate kernels with guards that check alignment, memory layout, driver version, graph-capture safety, and shape limits.',
        'The router filters candidates before ranking them. It rejects candidates whose guards fail, whose rollout stage is below the request class, or whose evidence is stale. If no accelerated path is legal, it records the reason and falls back to a slower reference path.',
        'The audit log is part of the mechanism. It stores the key, chosen backend, rejected alternatives, fallback reason, kernel version, and telemetry window. That makes porting work concrete: a team can see which missing rows create most fallback latency.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a selection proof. If every registry row is tested against a reference implementation for its key, and the router selects only rows whose guards pass, then the selected backend preserves the operation contract within the recorded tolerance. The fallback route preserves availability when no accelerated row is legal.',
        'Monotonic rollout protects users. A kernel moves from test to shadow, canary, ramp, and production only after each gate passes. If telemetry shows parity drift, high fallback rate, or p99 latency regression, the row is demoted instead of silently serving all traffic.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup cost is small: one hash-map probe per operation key is tiny compared with kernel execution. The real cost is maintaining evidence across framework releases, driver updates, new accelerator SKUs, new quantization formats, and tail shapes. A stale row is dangerous because it looks like safety while routing to an unverified path.',
        'State grows as the product of operations, data types, layout families, shape buckets, and backends. Bucketing and wildcard guards control this growth, but they also create boundary cases. A registry with 5,000 explicit rows and 100 guarded wildcard rows can be easier to operate than 500,000 exact-shape rows.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Hardware migration uses the matrix as a punch list. Moving from one GPU generation to another, or from CUDA to ROCm, means identifying which keys are already legal, which need retuning, and which require fallback. Quantization rollout uses the same structure to prove that int4, int8, bf16, or fp8 paths have kernels and quality evidence.',
        'Multi-backend serving also depends on this table. A router can place traffic on cloud GPU, on-prem accelerator, or CPU only if it knows which operation keys are legal on each pool. The matrix is the contract between model owners, kernel teams, and serving operators.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when teams treat the table as static documentation. A driver update can change behavior, a compiler pass can introduce a new fused shape, and a model revision can create a key that never appeared in testing. Evidence needs timestamps, artifact versions, and automatic expiry.',
        'It also fails when fallback is treated as free. CPU or unfused fallback may preserve correctness but can destroy p99 latency when a rare key becomes common. The audit must distinguish no kernel, failed guard, stale evidence, parity failure, and rollout block; otherwise every miss looks the same.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A team ports fused softmax for bf16 transformer inference to an AMD MI250X fleet. The key is fused_softmax, bf16, contiguous, sequence 2048 to 8192, batch 1 to 192, HIP backend. Initial lookup returns no production row, so traffic stays on the CUDA fleet or an unfused fallback.',
        'The kernel team adds a test row and runs 100 shape samples against a CPU reference with max absolute error tolerance 1e-3. Ninety-seven pass, and the 3 failures all have batch above 192 where local memory tiling misaligns. The guard is tightened to batch <= 192, and batch 193 to 256 routes to the unfused HIP path.',
        'A 1 percent canary shows p99 latency of 12 ms against an 11 ms CUDA baseline, fallback rate of 0.3 percent, and no quality slice regression. The row moves to ramp for MI250X only. The numbers matter because the word supported would hide the batch boundary that actually controls safety.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study PyTorch dispatcher internals for dispatch keys and backend fallback. Study ONNX Runtime execution providers for provider priority and graph partitioning. Study StableHLO for portable operation contracts across compiler backends, and the Triton fused softmax tutorial for shape and SRAM constraints that decide kernel legality.',
        'Study next: Interpreter Dispatch Table for local dispatch, Feature Flag Control Plane for staged rollout, CUDA Graph Shape Cache for shape bucketing, Transformer Inference Roofline for cost gates, and Heterogeneous AI Compute Workload Router for placement policy.',
      ],
    },
  ],
};
