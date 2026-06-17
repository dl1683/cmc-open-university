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
      heading: 'Why This Exists',
      paragraphs: [
        'An accelerator kernel compatibility matrix exists because "the model runs on this accelerator" is not a useful production claim. A model is a graph of operations, dtypes, layouts, shapes, memory assumptions, compiler choices, and runtime policies. One op may be fast in bf16, unsupported in fp8, legal only for contiguous inputs, and numerically risky for a dynamic shape. A second op may compile but miss the latency budget. A third may work only after a driver upgrade.',
        'The matrix sits between graph extraction and routing. It answers a narrow but critical question before the serving system spends traffic: for this operation key, on this backend, with this dtype and shape bucket, which kernels are legal, tested, fast enough, and allowed by rollout policy? Without that answer, portability becomes a demo property. The team may know that CUDA, HIP, XLA, CPU, or a vendor NPU path exists and still not know whether a real production trace can run there safely.',
      ],
    },
    {
      heading: 'The Tempting Shortcut And The Wall',
      paragraphs: [
        'The easy shortcut is to check whether the framework imports and whether the accelerator has an implementation for the op name. That is a reasonable first pass. If matmul, softmax, top-k, and all-reduce all have some backend implementation, a prototype can run and a benchmark slide can look convincing.',
        'The wall is that op name is too coarse. Matmul is not one thing: batch size, transposition, alignment, accumulator type, tile fit, sparsity pattern, quantization scale layout, and graph-capture assumptions all matter. Softmax may be fused for one attention shape and slow for another. A backend may support dynamic shapes through compilation but miss the p99 target after cache misses. The compatibility unit has to be closer to "op schema plus constraints" than "operator family."',
      ],
    },
    {
      heading: 'Core Data Structure',
      paragraphs: [
        'The core data structure is a compatibility record keyed by more than a name. A useful key includes op schema, dtype, layout, shape bucket, dynamic-shape guard, device class, backend, kernel variant, memory-pool or address assumption, and model or runtime version. Sparse paths add mask pattern, block layout, pruning artifact version, and density range. Quantized paths add scale format, zero-point convention, calibration version, and accumulator precision.',
        'The value is a decision packet. It stores support status, dispatch priority, guard predicate, numeric tolerance, benchmark status, fallback backend, rollout stage, owner, kernel version, evidence link, and recent telemetry. The invariant is legality before speed. A router may prefer CUDA over CPU, HIP over XLA, or a fused kernel over an unfused one, but it must choose from candidates that satisfy the guard and the rollout gate. Fast but illegal is a bug, not an optimization.',
      ],
    },
    {
      heading: 'How Dispatch Works',
      paragraphs: [
        'Dispatch starts by turning a model trace into operation keys. The system extracts the operator schema, dtype, shape bucket, layout, quantization or sparsity metadata, and any runtime guard needed to decide whether a kernel is legal. The kernel registry maps that key to candidate implementations. A policy layer ranks candidates by priority, rollout stage, cost, expected latency, tenant constraints, and risk. The chosen route is then logged with the matched key and reason.',
        'This resembles real framework mechanisms but adds production control. PyTorch dispatch keys organize operator implementations by backend and other concerns. ONNX Runtime execution providers use capability queries and provider priority to assign graph nodes or subgraphs to hardware-specific libraries. OpenXLA and StableHLO push some portability work into a compiler boundary. A production compatibility matrix borrows from all of those ideas and adds evidence, fallback, telemetry, and rollout ownership.',
      ],
    },
    {
      heading: 'What The Visual Proves',
      paragraphs: [
        'The support-matrix view proves that coverage is not a green-or-red checkbox. The interesting cells are "test," "miss," "reference," "gate," and "quarantine" because those states shape safe routing. A CPU reference cell may be slow but essential for parity. A HIP test cell may be promising but not allowed for production traffic. A sparse miss may explain a large fraction of fallback even when dense coverage looks strong.',
        'The dispatch-route view proves the order of responsibility. Trace extraction creates the key, the registry returns legal candidates, priority chooses a route, and the audit edge records the reason. The fallback-audit view proves why observability belongs in the data structure. A fallback is not noise; it is a labeled failure of compatibility, parity, memory, stability, or rollout policy. Those labels decide the next porting task.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The matrix works because it makes implicit dispatch assumptions explicit and testable. A framework dispatcher can choose a kernel only from what it knows. A serving router can choose a backend only from the candidates it has evidence for. By binding an operation key to a guard, evidence pointer, tolerance, and fallback, the matrix turns a runtime surprise into a preflight decision.',
        'Correctness comes from preserving operator semantics under constrained implementation choices. The CPU or reference path defines the baseline behavior. The accelerated path is promoted only when parity cases show acceptable numeric drift for the relevant dtype and shape range. Performance correctness is separate: a kernel can be numerically correct but fail the p99, memory, or stability gate. The data structure keeps those judgments distinct instead of hiding them behind one "supported" bit.',
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        'The main cost is maintenance. Every framework release, compiler optimization, kernel rewrite, model architecture change, driver update, quantization recipe, and accelerator SKU can invalidate a cell. A stale matrix is worse than no matrix because it creates false confidence. That is why each row needs an owner, evidence date, kernel version, and telemetry feedback from live or shadow traffic.',
        'The second cost is complexity at the boundary between engineering teams. Kernel authors care about legality and speed. Model owners care about parity and quality. Serving teams care about p99, fallback rate, and rollback. Platform teams care about cost and capacity. The matrix has to carry enough information for all of them without becoming an unreadable spreadsheet. The useful version is a typed registry plus dashboards and audit events, not a static document nobody updates.',
      ],
    },
    {
      heading: 'Where It Wins And Where It Fails',
      paragraphs: [
        'It wins during accelerator migration, multi-backend serving, custom kernel rollout, quantization adoption, and sparse or fused-kernel deployment. It is especially useful when the same model family serves many tenants with different latency budgets or hardware pools. The matrix gives a router a principled fallback path: choose the best legal candidate, record why it was chosen, and turn misses into a prioritized roadmap.',
        'It fails when the state space is allowed to explode without bucketing. If every exact shape becomes a separate manual row, the registry becomes impossible to maintain. It also fails when parity data is thin, when fallback reasons are collapsed into one counter, when rollout status is ignored, or when the CPU fallback is treated as free. The point is not to model every possible future input; it is to classify the shapes and dtypes that actually appear and gate the risky boundaries.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Official sources: PyTorch dispatcher tutorial at https://docs.pytorch.org/tutorials/advanced/dispatcher.html, PyTorch new-backend dispatcher extension guide at https://docs.pytorch.org/tutorials/advanced/extend_dispatcher.html, ONNX Runtime Execution Providers at https://onnxruntime.ai/docs/execution-providers/, StableHLO specification at https://openxla.org/stablehlo/spec, OpenXLA overview at https://openxla.org/, AMD HIP porting guide at https://rocm.docs.amd.com/projects/HIP/en/latest/how-to/hip_porting_guide.html, Khronos SYCL overview at https://www.khronos.org/sycl/, and Triton fused softmax tutorial at https://triton-lang.org/main/getting-started/tutorials/02-fused-softmax.html.',
        'Study Interpreter Dispatch Table for the local dispatch pattern, Feature Flag Control Plane for rollout gates, Inference Kernel Fusion and CUDA Graphs for fast paths, CUDA Graph Shape Cache for shape constraints, Structured Pruning and N:M Sparsity for sparse guard design, Heterogeneous AI Compute Workload Router for placement policy, Tensor Parallelism and GPU All-Reduce for distributed accelerator constraints, Transformer Inference Roofline for cost reasoning, and WebGPU Buffer and Bind Group for another compatibility contract.',
      ],
    },
  ],
};
