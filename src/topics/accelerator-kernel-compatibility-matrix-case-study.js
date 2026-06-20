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
        'The animation has three views. The support-matrix view builds the compatibility table one dimension at a time: first op coverage by backend, then dtype constraints, then shape constraints. Active cells are the current dimension under inspection. Compare cells (orange) mark gaps or experimental states that block production routing. Found cells (green) mark entries whose status resolves a fallback question.',
        'The dispatch-route view traces a single inference request from model graph through op-key extraction, kernel registry lookup, candidate ranking, and final route selection. Active nodes are the current stage of the pipeline. The audit edge captures the fallback reason when the preferred backend is rejected.',
        'The fallback-audit view plots miss rates and coverage-vs-speedup curves, then walks through rollout gates and a concrete porting chain. The gate marker on each plot is the promotion threshold a backend must cross before it can carry production traffic.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'quote', text: 'It works on my GPU is the new it works on my machine.', attribution: 'Common saying in ML infrastructure teams'},
        'A model is not one operation. It is a graph of hundreds of ops, each with a dtype, a layout, a shape range, memory assumptions, and compiler constraints. Claiming a model "runs on" an accelerator means every op in the graph has a legal, tested, fast-enough kernel on that backend for the dtypes and shapes the model actually produces. One missing kernel, one unsupported dtype, or one shape that blows the tile budget turns the claim into a lie.',
        'The compatibility matrix sits between model export and serving router. It answers a preflight question: for this operation key, on this backend, with this dtype and shape bucket, which kernels are legal, parity-tested, within latency budget, and allowed by rollout policy? Without that preflight, portability is a demo property that collapses under production traffic.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first step is to check whether each operator name has a backend implementation. If matmul, softmax, top-k, scatter, and all-reduce all import successfully on the target device, the framework will not throw an error. A prototype runs, a benchmark slide appears, and the migration gets a green light.',
        'This works for demos and single-model benchmarks. It breaks when the same operator name hides different constraint surfaces across backends.',
        {type: 'table', headers: ['Check', 'What it catches', 'What it misses'], rows: [
          ['Import succeeds', 'Missing operator entirely', 'Dtype, shape, layout, tile, memory, parity'],
          ['Smoke test passes', 'Crashes on trivial input', 'Tail shapes, dynamic batches, quantized paths'],
          ['Benchmark looks fast', 'Gross throughput regression', 'p99 latency, memory pressure, numerical drift'],
        ]},
        'Each row adds coverage but none reaches the granularity that production routing requires. The gap between "operator exists" and "operator is safe for this traffic" is the entire problem.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Op name is too coarse a compatibility unit. Matmul is not one thing. The CUDA kernel for a batch-1, fp16, contiguous, aligned matmul is a different code path from a batch-128, bf16, strided, transposed matmul with int8 accumulation. Softmax may be fused into a FlashAttention kernel for sequence lengths up to 8192 and fall back to an unfused path above that. A Triton custom kernel may require tile dimensions that divide SRAM evenly and silently produce wrong results when they do not.',
        {type: 'note', text: 'The compatibility unit must be closer to (op_schema, dtype, layout, shape_bucket, device_class) than to the operator family name. Every field that affects kernel selection belongs in the key.'},
        'Three specific failure patterns appear repeatedly:',
        {type: 'bullets', items: [
          'Dtype gap: a kernel exists for fp32 and fp16 but not bf16 or fp8. The model quantization recipe targets fp8. The fallback to fp32 doubles memory and halves throughput.',
          'Shape cliff: the kernel is fast for static shapes compiled into a CUDA graph but recompiles on every new dynamic batch size, turning a 2ms op into a 200ms compilation stall.',
          'Parity drift: the kernel produces numerically different results from the reference CPU path. The drift is within tolerance for dense attention but accumulates through 80 transformer layers into a visible quality regression.',
        ]},
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The data structure is a registry of compatibility records, each keyed by a compound operation signature and valued with a decision packet.',
        {type: 'diagram', text: 'Key:   (op_schema, dtype, layout, shape_bucket, device_class, backend)\n       |                                                              |\n       v                                                              v\nValue: { status, priority, guard_predicate, numeric_tolerance,        |\n         benchmark_status, fallback_backend, rollout_stage,           |\n         kernel_version, owner, evidence_link, telemetry_window }     |\n                                                                      |\nInvariant: legality before speed ─────────────────────────────────────+', label: 'Compatibility record structure'},
        'The key includes everything that changes which kernel is selected. The value carries everything needed to decide whether that kernel is allowed for production traffic. The invariant is legality before speed: the router ranks candidates by priority, but it only considers candidates whose guard predicate passes and whose rollout stage permits the current traffic class.',
        {type: 'note', text: 'Fast but illegal is a bug, not an optimization. A kernel that produces wrong results quickly is worse than a slow fallback that produces correct results.'},
        'Sparse and quantized paths extend the key with additional fields:',
        {type: 'table', headers: ['Path type', 'Extra key fields', 'Extra value fields'], rows: [
          ['Dense', '(none beyond base key)', '(none beyond base value)'],
          ['Sparse', 'mask_pattern, block_layout, density_range', 'pruning_artifact_version, sparsity_format'],
          ['Quantized', 'scale_format, zero_point_convention, accumulator_precision', 'calibration_version, dequant_error_bound'],
        ]},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The dispatch pipeline has four stages: key extraction, registry lookup, candidate ranking, and audit logging.',
        {type: 'code', text: '// Pseudocode: dispatch pipeline\nfunction dispatch(model_trace, request) {\n  for (const op of model_trace.ops) {\n    const key = extract_key(op.schema, op.dtype, op.layout,\n                            bucket(op.shape), device_class);\n    const candidates = registry.lookup(key);  // returns [] if no match\n    const legal = candidates.filter(c =>\n      c.guard(op) && c.rollout_stage >= request.traffic_class);\n    if (legal.length === 0) {\n      audit.log({key, reason: \'no_legal_candidate\', fallback: \'cpu\'});\n      return fallback_to_cpu(op);\n    }\n    const chosen = legal.sort_by(c => c.priority)[0];\n    audit.log({key, chosen: chosen.backend, kernel: chosen.version});\n    return chosen.execute(op);\n  }\n}', language: 'javascript'},
        'Key extraction turns a model trace into compound keys. The system reads operator schema, dtype, layout, and shape, then buckets the shape into a small set of ranges (e.g., batch <= 8, batch 9-64, batch 65-512) to keep the registry finite.',
        'Registry lookup returns all candidate implementations for that key. Each candidate carries a guard predicate -- a runtime check that must pass before the kernel is considered legal. Guards encode tile alignment, memory contiguity, address stability for graph capture, and driver version requirements.',
        'Candidate ranking applies policy: priority order, rollout stage gates, cost estimates, and tenant-specific constraints. The chosen candidate is logged with its key, backend, kernel version, and the reason alternatives were rejected.',
        {type: 'note', text: 'PyTorch dispatch keys, ONNX Runtime execution providers, and XLA/StableHLO compilation boundaries all solve subsets of this problem. The compatibility matrix unifies them by adding evidence, fallback, rollout, and telemetry to the dispatch decision.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The matrix converts implicit runtime assumptions into explicit, testable records. Three properties make the system trustworthy:',
        {type: 'bullets', items: [
          'Completeness: every op in the model graph must have at least one legal candidate (even if it is the CPU reference path). A missing row is a deployment blocker, not a silent fallback.',
          'Parity preservation: the CPU or reference path defines baseline numerical behavior. An accelerated path is promoted only after parity tests show acceptable drift for the relevant dtype and shape range. Numeric correctness and performance correctness are tracked separately.',
          'Monotonic promotion: a kernel moves through rollout stages (shadow, canary, ramp, production) and never skips a stage. Each stage has exit criteria. Regression on any criterion demotes the kernel back to the previous stage.',
        ]},
        'The correctness argument is: if every candidate in the registry satisfies its guard predicate and parity bound, and if the router only selects from legal candidates, then the dispatch decision preserves operator semantics regardless of which backend is chosen. The fallback path guarantees that no request is silently dropped or served with an untested kernel.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Scenario: port fused softmax from CUDA to HIP for a transformer serving pipeline that runs bf16 inference with dynamic batch sizes from 1 to 256.',
        {type: 'table', headers: ['Step', 'Action', 'State change'], rows: [
          ['1. Identify key', 'Extract (fused_softmax, bf16, contiguous, batch_1-256, MI250X, HIP)', 'Registry lookup returns: no entry'],
          ['2. Create record', 'Add compatibility row with status=test, guard=tile_fits_LDS, fallback=CUDA', 'Registry now has one HIP candidate for this key'],
          ['3. Reference parity', 'Run CPU golden outputs for 50 shape samples, measure max abs error', 'parity_bound = 1e-3 (bf16 tolerance), all 50 pass'],
          ['4. Benchmark', 'Measure latency at batch 1, 32, 128, 256 on MI250X', 'speedup vs CPU: 4.2x. Latency vs CUDA: 1.1x slower (acceptable)'],
          ['5. Shadow', 'Mirror 100% production traffic, compare outputs to CUDA path', 'Drift within 1e-3 for 99.97% of requests. 3 shape outliers flagged'],
          ['6. Fix outliers', 'Shape bucket batch_200-256 hits LDS tile misalignment. Add guard: batch <= 192 for fused path', 'Guard updated. Batch > 192 falls back to unfused HIP kernel'],
          ['7. Canary', 'Route 1% live traffic to HIP. Monitor p99 latency and fallback rate', 'p99 = 12ms (CUDA baseline 11ms). Fallback rate 0.3%. Exit criteria met'],
          ['8. Ramp to 25%', 'Increase traffic share. Hold for 48 hours', 'No regression. Fallback rate stable at 0.3%'],
          ['9. Promote', 'Set rollout_stage=production, priority=1 for MI250X fleet', 'HIP fused softmax is now the default for this key on MI250X'],
        ]},
        {type: 'note', text: 'The guard predicate change in step 6 is the kind of detail that a name-level compatibility check would never surface. The kernel is "supported" for fused_softmax on HIP, but only for batch <= 192. The matrix encodes that constraint; a boolean support flag cannot.'},
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The matrix itself is a registry, not a runtime data structure, so its lookup cost is a hash-map probe per op per request -- negligible compared to kernel execution. The real costs are human:',
        {type: 'table', headers: ['Cost', 'What drives it', 'Mitigation'], rows: [
          ['Maintenance', 'Every framework release, driver update, kernel rewrite, or new accelerator SKU can invalidate cells', 'Automate parity tests in CI. Attach evidence dates and kernel versions to every row. Expire stale rows'],
          ['Cross-team coordination', 'Kernel authors care about speed, model owners about quality, serving teams about p99, platform teams about cost', 'Typed registry with per-audience views. Kernel authors see guards and benchmarks. Serving teams see rollout stage and fallback rates'],
          ['State explosion', 'Combinatorial growth of (op, dtype, shape, backend) tuples', 'Shape bucketing, wildcard guards, inheritance from base dtype records. A registry with 10,000 explicit rows and 50 wildcard rules beats 500,000 exhaustive rows'],
          ['Stale confidence', 'A matrix that is not updated after a driver regression gives false safety', 'Telemetry feedback loop: live fallback events automatically flag and demote stale rows'],
        ]},
        'A stale matrix is worse than no matrix. The registry must be a living system with CI validation, telemetry feedback, and automatic demotion -- not a spreadsheet someone updates quarterly.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {type: 'bullets', items: [
          'Accelerator migration: moving a serving fleet from NVIDIA A100 to H100, or from CUDA to AMD MI300X, requires knowing exactly which ops need new kernels, which need retuning, and which work unchanged. The matrix is the migration checklist.',
          'Multi-backend serving: a single model family serving tenants on different hardware pools (cloud GPU, on-prem NPU, edge CPU) needs per-backend dispatch with principled fallback. The matrix tells the router which backends are legal for each op.',
          'Quantization rollout: adopting fp8 or int4 inference means adding new dtype columns to the matrix. Each cell must be filled with parity evidence before the quantized path can serve traffic.',
          'Custom kernel deployment: a Triton or CUTLASS kernel that replaces a framework default must prove parity, benchmark at representative shapes, and pass rollout gates. The matrix is the promotion pipeline.',
          'Fused-kernel adoption: FlashAttention, fused MLP, and other compound kernels change the op granularity. The matrix must track both the fused and unfused paths because fallback from fused to unfused is a common dispatch decision.',
        ]},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {type: 'table', headers: ['Failure mode', 'Trigger', 'Consequence'], rows: [
          ['State explosion without bucketing', 'Every exact tensor shape gets its own row', 'Registry becomes unmaintainable; lookup misses increase because exact shapes do not match'],
          ['Thin parity data', 'Parity tests use only a few canonical shapes', 'Kernels pass parity for tested shapes but drift on production tail shapes'],
          ['Collapsed fallback reasons', 'All fallbacks logged as "unsupported"', 'Porting roadmap has no signal; every miss looks identical'],
          ['Ignored rollout stages', 'Test kernels deployed directly to production', 'Regressions hit 100% of traffic instead of 1% canary'],
          ['CPU fallback treated as free', 'Fallback rate not monitored', 'Latency degrades silently as more ops miss the accelerated path; p99 blows up from CPU tail'],
          ['Stale evidence', 'Matrix not updated after driver or framework upgrade', 'Router trusts a kernel that no longer works; silent correctness regression'],
        ]},
        'The silent failure is stale evidence. A kernel that passed parity six months ago may produce different results after a cuDNN or ROCm update. Without telemetry feedback and automatic staleness detection, the matrix degrades into a false-confidence artifact.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {type: 'note', text: 'Primary sources for the dispatch mechanisms this case study builds on:'},
        {type: 'bullets', items: [
          'PyTorch dispatcher internals: https://docs.pytorch.org/tutorials/advanced/dispatcher.html -- explains dispatch keys, backend fallback, and how operator implementations are registered per device type.',
          'PyTorch backend extension guide: https://docs.pytorch.org/tutorials/advanced/extend_dispatcher.html -- the official pattern for adding a new backend to the PyTorch dispatch table.',
          'ONNX Runtime execution providers: https://onnxruntime.ai/docs/execution-providers/ -- capability-based provider selection, priority ordering, and graph partitioning across backends.',
          'StableHLO specification: https://openxla.org/stablehlo/spec -- the portable op set that XLA uses to abstract across accelerators at the compiler level.',
          'AMD HIP porting guide: https://rocm.docs.amd.com/projects/HIP/en/latest/how-to/hip_porting_guide.html -- practical constraints when porting CUDA kernels to HIP, including API gaps and behavioral differences.',
          'Triton fused softmax tutorial: https://triton-lang.org/main/getting-started/tutorials/02-fused-softmax.html -- tile-based kernel programming where shape and SRAM constraints directly determine legality.',
        ]},
        'Related topics on this site: Interpreter Dispatch Table for the local dispatch pattern. Feature Flag Control Plane for rollout gate mechanics. Inference Kernel Fusion and CUDA Graphs for understanding which fast paths the matrix gates. CUDA Graph Shape Cache for shape-bucketing constraints. Heterogeneous AI Compute Workload Router for the placement policy that consumes the matrix. Transformer Inference Roofline for the cost model that sets latency gates.',
      ],
    },
  ],
};

