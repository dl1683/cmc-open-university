// CUDA ecosystem portability lock-in matrix: make accelerator migration a
// structured backlog instead of a vague belief that another chip is supported.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'cuda-ecosystem-portability-lockin-matrix-case-study',
  title: 'CUDA Ecosystem Portability Lock-In Matrix',
  category: 'Systems',
  summary: 'A portability case study: track CUDA libraries, kernels, collectives, compilers, debugging tools, tuning assumptions, migration backlog, and parity gates across accelerator stacks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lock-in matrix', 'migration backlog'], defaultValue: 'lock-in matrix' },
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

function ecosystemGraph(title) {
  return graphState({
    nodes: [
      { id: 'model', label: 'model', x: 0.7, y: 3.5, note: 'code' },
      { id: 'torch', label: 'PyTorch', x: 2.2, y: 2.0, note: 'ops' },
      { id: 'jax', label: 'JAX', x: 2.2, y: 5.0, note: 'ops' },
      { id: 'libs', label: 'libs', x: 4.0, y: 1.4, note: 'cuDNN' },
      { id: 'kernels', label: 'kernels', x: 4.0, y: 3.5, note: 'Triton' },
      { id: 'comm', label: 'comm', x: 4.0, y: 5.6, note: 'NCCL' },
      { id: 'cuda', label: 'CUDA', x: 5.9, y: 3.5, note: 'default' },
      { id: 'alt', label: 'alt', x: 7.6, y: 2.1, note: 'ROCm/XLA' },
      { id: 'parity', label: 'parity', x: 7.6, y: 4.9, note: 'gate' },
      { id: 'ship', label: 'ship', x: 9.2, y: 3.5, note: 'route' },
    ],
    edges: [
      { id: 'e-model-torch', from: 'model', to: 'torch' },
      { id: 'e-model-jax', from: 'model', to: 'jax' },
      { id: 'e-torch-libs', from: 'torch', to: 'libs' },
      { id: 'e-torch-kernels', from: 'torch', to: 'kernels' },
      { id: 'e-jax-kernels', from: 'jax', to: 'kernels' },
      { id: 'e-jax-comm', from: 'jax', to: 'comm' },
      { id: 'e-libs-cuda', from: 'libs', to: 'cuda' },
      { id: 'e-kernels-cuda', from: 'kernels', to: 'cuda' },
      { id: 'e-comm-cuda', from: 'comm', to: 'cuda' },
      { id: 'e-cuda-alt', from: 'cuda', to: 'alt' },
      { id: 'e-alt-parity', from: 'alt', to: 'parity' },
      { id: 'e-parity-ship', from: 'parity', to: 'ship' },
    ],
  }, { title });
}

function backlogGraph(title) {
  return graphState({
    nodes: [
      { id: 'trace', label: 'trace', x: 0.7, y: 3.5, note: 'ops' },
      { id: 'cover', label: 'cover', x: 2.2, y: 1.6, note: 'matrix' },
      { id: 'port', label: 'port', x: 2.2, y: 3.5, note: 'work' },
      { id: 'tune', label: 'tune', x: 2.2, y: 5.4, note: 'perf' },
      { id: 'numeric', label: 'numeric', x: 4.0, y: 2.2, note: 'tol' },
      { id: 'p99', label: 'p99', x: 4.0, y: 4.8, note: 'tail' },
      { id: 'gate', label: 'gate', x: 5.8, y: 3.5, note: 'promote' },
      { id: 'canary', label: 'canary', x: 7.4, y: 2.0, note: 'slice' },
      { id: 'fallback', label: 'fallback', x: 7.4, y: 5.0, note: 'safe' },
      { id: 'ledger', label: 'ledger', x: 9.1, y: 3.5, note: 'why' },
    ],
    edges: [
      { id: 'e-trace-cover', from: 'trace', to: 'cover' },
      { id: 'e-trace-port', from: 'trace', to: 'port' },
      { id: 'e-trace-tune', from: 'trace', to: 'tune' },
      { id: 'e-cover-numeric', from: 'cover', to: 'numeric' },
      { id: 'e-port-numeric', from: 'port', to: 'numeric' },
      { id: 'e-tune-p99', from: 'tune', to: 'p99' },
      { id: 'e-numeric-gate', from: 'numeric', to: 'gate' },
      { id: 'e-p99-gate', from: 'p99', to: 'gate' },
      { id: 'e-gate-canary', from: 'gate', to: 'canary' },
      { id: 'e-gate-fallback', from: 'gate', to: 'fallback' },
      { id: 'e-canary-ledger', from: 'canary', to: 'ledger' },
      { id: 'e-fallback-ledger', from: 'fallback', to: 'ledger' },
    ],
  }, { title });
}

function taxPlot() {
  return plotState({
    axes: {
      x: { label: 'ported workload share', min: 0, max: 100 },
      y: { label: 'migration risk', min: 0, max: 10 },
    },
    series: [
      { id: 'naive', label: 'clm', points: [
        { x: 5, y: 8.5 }, { x: 25, y: 8.0 }, { x: 50, y: 7.0 }, { x: 75, y: 6.5 }, { x: 95, y: 6.2 },
      ] },
      { id: 'gated', label: 'gate', points: [
        { x: 5, y: 8.0 }, { x: 25, y: 5.7 }, { x: 50, y: 3.8 }, { x: 75, y: 2.3 }, { x: 95, y: 1.6 },
      ] },
    ],
    markers: [
      { id: 'canary', x: 50, y: 3.8, label: 'canary' },
      { id: 'hidden', x: 75, y: 6.5, label: 'hidden tax' },
    ],
  });
}

function perfPlot() {
  return plotState({
    axes: {
      x: { label: 'migration weeks', min: 0, max: 24 },
      y: { label: 'relative throughput', min: 0, max: 120 },
    },
    series: [
      { id: 'cuda', label: 'CUDA', points: [
        { x: 0, y: 100 }, { x: 6, y: 102 }, { x: 12, y: 104 }, { x: 18, y: 105 }, { x: 24, y: 106 },
      ] },
      { id: 'alt', label: 'alt', points: [
        { x: 0, y: 30 }, { x: 6, y: 55 }, { x: 12, y: 78 }, { x: 18, y: 92 }, { x: 24, y: 101 },
      ] },
    ],
    markers: [
      { id: 'parity', x: 22, y: 100, label: 'parity' },
      { id: 'gap', x: 6, y: 55, label: 'gap' },
    ],
  });
}

function* lockInMatrix() {
  yield {
    state: ecosystemGraph('CUDA lock-in is an ecosystem graph'),
    highlight: { active: ['model', 'torch', 'libs', 'kernels', 'comm', 'cuda', 'e-torch-libs', 'e-torch-kernels', 'e-comm-cuda'], found: ['parity'] },
    explanation: 'The lock-in is not just one API. It is a graph of frameworks, libraries, custom kernels, collectives, profilers, debugging workflows, tutorials, and tuning assumptions that all default to one stack.',
    invariant: 'Portability is proven by workload evidence, not by saying another accelerator supports the framework.',
  };

  yield {
    state: labelMatrix(
      'Portability matrix',
      [
        { id: 'blas', label: 'GEMM' },
        { id: 'dnn', label: 'DNN' },
        { id: 'attn', label: 'attn' },
        { id: 'custom', label: 'custom' },
        { id: 'comm', label: 'comm' },
        { id: 'debug', label: 'debug' },
      ],
      [
        { id: 'cuda', label: 'CUDA' },
        { id: 'rocm', label: 'ROCm' },
        { id: 'xla', label: 'XLA' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['cuBLAS', 'hipBLAS', 'XLA', 'tune'],
        ['cuDNN', 'MIOpen', 'XLA', 'parity'],
        ['fused', 'ported', 'compile', 'tail'],
        ['Triton', 'rewrite', 'plugin', 'time'],
        ['NCCL', 'RCCL', 'XLA', 'scale'],
        ['Nsight', 'rocprof', 'trace', 'skills'],
      ],
    ),
    highlight: { active: ['blas:cuda', 'dnn:cuda', 'comm:cuda'], compare: ['custom:rocm', 'debug:risk'], found: ['attn:risk'] },
    explanation: 'A useful migration matrix names the exact dependency: BLAS, DNN primitives, fused attention, custom kernels, collectives, and debugging tools. The risk column is where the backlog starts.',
  };

  yield {
    state: taxPlot(),
    highlight: { active: ['gated', 'canary'], compare: ['naive', 'hidden'] },
    explanation: 'The porting tax falls only when real workload share passes coverage, numeric parity, performance, tail latency, and observability gates. Marketing-level support leaves hidden risk in the workload tail.',
  };

  yield {
    state: ecosystemGraph('Promotion requires parity evidence'),
    highlight: { active: ['alt', 'parity', 'ship', 'e-alt-parity', 'e-parity-ship'], compare: ['cuda'], found: ['kernels', 'comm'] },
    explanation: 'The alternative stack should earn traffic by passing parity gates. That means exact workload traces, allowed tolerances, throughput, memory pressure, p99, and fallback behavior.',
  };
}

function* migrationBacklog() {
  yield {
    state: backlogGraph('Migration starts from traces, not wish lists'),
    highlight: { active: ['trace', 'cover', 'port', 'tune', 'e-trace-cover', 'e-trace-port', 'e-trace-tune'], found: ['gate'] },
    explanation: 'The migration backlog should be generated from real traces: which operators ran, which shapes appeared, which kernels dominated, which collectives scaled, and which debugging tools were needed.',
  };

  yield {
    state: labelMatrix(
      'Backlog rows',
      [
        { id: 'op', label: 'op' },
        { id: 'shape', label: 'shape' },
        { id: 'kernel', label: 'kernel' },
        { id: 'collect', label: 'collect' },
        { id: 'tune', label: 'tune' },
        { id: 'obs', label: 'obs' },
      ],
      [
        { id: 'evidence', label: 'evidence' },
        { id: 'done', label: 'done' },
      ],
      [
        ['trace freq', 'coverage'],
        ['buckets', 'legal'],
        ['profile', 'fast'],
        ['topology', 'scale'],
        ['sweep', 'stable'],
        ['logs', 'debuggable'],
      ],
    ),
    highlight: { active: ['op:evidence', 'shape:evidence', 'kernel:done', 'obs:done'], compare: ['collect:done'] },
    explanation: 'Each backlog row needs an evidence source and a done condition. Coverage alone is not done; the row closes when it is legal, fast enough, numerically acceptable, observable, and reversible.',
  };

  yield {
    state: perfPlot(),
    highlight: { active: ['alt', 'parity'], compare: ['cuda', 'gap'] },
    explanation: 'A migration can start far below baseline and still be rational if the path to parity is explicit. The danger is treating early toy benchmarks as proof that the production workload is ready.',
  };

  yield {
    state: backlogGraph('Fallback keeps the migration honest'),
    highlight: { active: ['gate', 'canary', 'fallback', 'ledger', 'e-gate-canary', 'e-gate-fallback', 'e-canary-ledger', 'e-fallback-ledger'], compare: ['p99', 'numeric'] },
    explanation: 'Canaries and fallbacks are not signs of weakness. They are what let a team learn where the alternative stack fails without turning every miss into an outage.',
    invariant: 'A credible portability plan has a rollback route and a backlog generated from failed fallbacks.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lock-in matrix') yield* lockInMatrix();
  else if (view === 'migration backlog') yield* migrationBacklog();
  else throw new InputError('Pick a CUDA portability view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'CUDA portability lock-in exists because GPU software is not just kernels. It is compilers, libraries, profilers, collective communication, memory allocators, graph capture, vendor extensions, build systems, container images, and operational habits.',
        'A team may say it wants accelerator portability, but the real question is where its code, performance assumptions, and debugging workflows depend on one vendor ecosystem. A lock-in matrix makes those dependencies visible.',
      ],
    },
    {
      heading: 'The obvious shortcut',
      paragraphs: [
        'The obvious shortcut is to translate CUDA kernels to another language or backend and declare the system portable. That misses the ecosystem. Many workloads rely more on cuBLAS, cuDNN, NCCL, TensorRT, custom extensions, and profiler-guided tuning than on handwritten kernels alone.',
        'Another shortcut is to wait for a framework to abstract everything. Frameworks help, but abstraction leaks when a model hits memory limits, kernel gaps, collective bottlenecks, numerics differences, or missing production tooling.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Portability is a stack property. Each layer has a different migration cost: source code, compiler, math libraries, communication libraries, runtime APIs, profiling, deployment, monitoring, and team expertise.',
        'A useful matrix scores each dependency by importance, replaceability, performance sensitivity, correctness risk, and operational maturity. The goal is not ideology. It is to know which parts of the system can move and which parts are anchored.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with an inventory. List kernels, framework operators, custom CUDA extensions, vendor libraries, communication paths, memory-management assumptions, build flags, container dependencies, and profiling tools. Tie each item to workloads and business-critical paths.',
        'Then classify migration options. Some code can use portable framework ops. Some kernels can move through HIP, SYCL, Triton, WebGPU, or vendor-specific alternatives. Some dependencies need rewrites. Some should remain CUDA because the cost of moving is higher than the benefit.',
        'Finally, run proof workloads. Portability is not a spreadsheet claim until latency, throughput, memory use, numerical behavior, failure handling, and debugging paths work on the target hardware.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The matrix view proves that lock-in is uneven. A training job may be portable at the PyTorch layer but locked at NCCL collectives or custom fused kernels. An inference path may be portable until TensorRT-specific optimizations define the latency target.',
        'The migration-gate view proves that portability is staged. Inventory, replacement, correctness, performance, operations, and rollback all need gates. Skipping directly to performance tuning can hide correctness or support gaps.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The matrix works because it turns a vague platform debate into specific dependencies. A team can decide to keep one CUDA-only path, remove another, and create an abstraction around a third. Each decision has evidence.',
        'It also works because migration risk is not uniform. A small utility kernel with tests may be easy to port. A numerically delicate fused attention kernel on the p99 path may require deep benchmarking and fallback support.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Portability costs engineering time, test infrastructure, benchmarking, and sometimes performance. A portable path that is 30 percent slower may be unacceptable for one workload and perfectly fine for another.',
        'Lock-in also has a cost: supply risk, supplier pricing power, capacity shortages, deployment constraints, and hiring bottlenecks. The matrix helps compare the cost of staying with the cost of moving.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This analysis wins for AI platforms, HPC systems, inference fleets, edge deployments, procurement planning, and any organization deciding whether to support AMD, NVIDIA, Intel, custom ASICs, or browser GPUs.',
        'It is especially useful before a migration. Teams can prioritize low-risk portability work, identify hard blockers, and avoid discovering during a crisis that the only profiler, collective, or kernel path is vendor-specific.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure is portability theater: code compiles on another backend, but performance, numerics, observability, or incident response is not production-ready. A demo is not a migration.',
        'The second failure is ignoring people. Engineers know one profiler, one failure mode, one memory model, and one set of tuning habits. Training and debugging playbooks are part of the dependency graph.',
        'The third failure is all-or-nothing thinking. Partial portability can still be valuable. Moving preprocessing, small models, batch jobs, or noncritical inference first may create real option value before the hardest kernels move.',
      ],
    },
    {
      heading: 'Migration checklist',
      paragraphs: [
        'Inventory every vendor-specific dependency and attach it to a workload. Measure current performance and correctness before porting. Build golden tests and numerical tolerances. Decide which regressions are acceptable for each workload.',
        'Create fallbacks. A portable route should have rollback, canary, and observability before it carries critical traffic. The migration plan should state who owns kernel gaps, library gaps, profiler gaps, and incident response.',
        'Report progress by working workload, not by lines translated. The only portability that matters is a workload that can run, meet its SLO, be debugged, and be operated by the team.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider an inference service using PyTorch, custom CUDA attention kernels, NCCL collectives, TensorRT export, CUDA graphs, and NVIDIA-specific monitoring. The model code may look portable, but the production path is anchored at several layers.',
        'A first migration gate might move a small batch route to a portable framework operator set. A second gate might replace the custom kernel with Triton or a vendor alternative. A third gate might prove collective communication, profiling, and rollback on the target hardware.',
        'The matrix prevents false confidence. If TensorRT is the reason p99 latency is acceptable, replacing only the source kernels does not make the route portable. The performance contract moved with the optimizer.',
      ],
    },
    {
      heading: 'How to prioritize',
      paragraphs: [
        'Start with workloads that are valuable but not existential. Batch jobs, offline evaluation, preprocessing, or low-tier inference can create portability muscle without risking the highest-value path.',
        'Prioritize dependencies with clear tests and low numerical risk. A deterministic preprocessing kernel is easier to move than a fused training kernel whose tiny numerical differences change convergence.',
        'Keep the business reason visible. Portability can mean lower cost, supply flexibility, edge deployment, negotiating power, or resilience. The right migration order depends on which of those goals matters most.',
      ],
    },
    {
      heading: 'What to watch in production',
      paragraphs: [
        'The hardest lock-in is usually operational, not syntactic. A kernel may port in a week while debugging, profiling, on-call training, capacity planning, and incident rollback take months. The matrix should track those human and operational dependencies with the same seriousness as code dependencies.',
        'Watch benchmark selection. A portable backend that wins on a small tensor or offline batch can still fail the real service because the real service depends on graph capture, quantized kernels, collective overlap, or memory fragmentation behavior. Portability evidence must match the workload shape.',
        'The end state may not be total neutrality. Many teams keep one optimized primary path and one credible secondary path. That is still useful if the secondary path can carry defined workloads, survive an incident, and give the business negotiating power. The goal is usable optionality, not a slogan.',
      ],
    },
    {
      heading: 'Common misconception',
      paragraphs: [
        'The misconception is that CUDA lock-in is a moral failure or a simple vendor preference. Often it is the result of years of optimized libraries, battle-tested debugging tools, trained engineers, stable deployment images, and known failure modes. Those are real assets.',
        'The serious question is not whether lock-in is bad in the abstract. It is whether the benefits still outweigh the risk for a particular workload. A good matrix makes that question concrete enough to argue about: which layer creates the dependency, what it buys, what it would cost to replace, and what business risk remains if nothing changes.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Accelerator Kernel Compatibility Matrix, GPU AllReduce, Tensor Parallelism, WebGPU Buffer and Bind Group, MLIR, Triton Kernels, PagedAttention, and Heterogeneous AI Compute Workload Router. A useful exercise is to make a lock-in matrix for one model serving path from tokenizer to response.',
      ],
    },
  ],
};
