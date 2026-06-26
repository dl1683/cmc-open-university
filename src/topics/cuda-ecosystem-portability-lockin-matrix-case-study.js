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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the matrix from left to right as a dependency audit. Rows are workload layers such as framework code, custom kernels, math libraries, collective communication, profiling, deployment, and team knowledge. Active cells mark dependencies being inspected, found cells mark portable evidence, and blocked cells mark vendor-specific behavior that still owns the workload.',
        'The safe inference rule is workload based. A row is portable only when that workload can run correctly, meet its service target, be debugged, and be operated on the target accelerator. Source translation alone is not enough evidence.',
        {type:'callout', text:'Accelerator portability is a workload-evidence problem across libraries, kernels, collectives, tooling, and people, not a checkbox for translated source code.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'CUDA is NVIDIA\'s programming platform for general-purpose GPU computing. A GPU is a parallel processor built to run many simple operations at once, and CUDA gives programmers kernels, libraries, compilers, profilers, runtime APIs, and deployment conventions for using NVIDIA GPUs. The lock-in risk appears when those layers become part of the product, not just part of the build.',
        'A team may want AMD, Intel, custom ASIC, or cloud bargaining power, but its real system may depend on cuBLAS, cuDNN, NCCL, TensorRT, CUDA graphs, driver behavior, container images, and engineers trained on one profiler. A lock-in matrix exists to turn that vague risk into rows that can be tested. It separates useful dependence from accidental dependence.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to translate kernels. If a .cu file becomes HIP, SYCL, Triton, or another backend, the code looks less tied to one vendor. This is a reasonable first step because handwritten kernels are visible, grepable, and often painful to maintain.',
        'Another reasonable approach is to rely on PyTorch, TensorFlow, JAX, or another framework to hide the hardware. Frameworks do remove many direct calls. They do not remove every production dependency once a workload needs a fused kernel, a specific collective library, a graph-capture path, or a profiler-guided memory fix.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that accelerator software is a stack. A model can be portable at the Python layer and locked at the inference optimizer. A training job can use portable tensor operations and still depend on NCCL behavior for all-reduce, which is the collective operation that combines gradients across many devices.',
        'The second wall is operational. A kernel may compile on another backend while p99 latency misses the service-level objective, numerical drift changes model quality, monitoring loses device counters, or on-call engineers cannot diagnose memory fragmentation. A demo proves possibility; production proves ownership.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Portability is not a property of code in isolation. It is a property of a workload running under a target correctness, performance, cost, and operations contract. The matrix works because each row states which layer owns part of that contract.',
        'Each dependency should be scored by workload importance, replaceability, performance sensitivity, correctness risk, and operational maturity. The answer may be to port one layer, keep another CUDA path, and build a fallback for a third. The matrix is useful because it allows partial, evidence-backed decisions instead of slogans.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with an inventory tied to real workloads. Record framework operators, custom extensions, vendor libraries, communication paths, memory allocation assumptions, graph-capture use, compiler flags, container images, profiling tools, and monitoring. Attach each item to a service route, batch job, or training run instead of counting files.',
        'Then classify each item. Some dependencies can move through portable framework operators. Some can move through HIP, SYCL, Triton, OpenCL, WebGPU, or a vendor library on the target platform. Some should stay vendor-specific because the cost of replacing them is higher than the option value gained.',
        'Finally, run proof workloads. Correctness tests check output tolerance, performance tests check latency and throughput, memory tests check peak and fragmentation, and operations tests check logging, profiling, rollback, and incident response. A row stays locked until the target path survives those gates.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is evidence separation. If every layer used by a workload has a tested replacement or an intentional retained dependency, then the workload\'s portability claim can be traced to concrete facts. If one layer lacks evidence, the matrix prevents the team from pretending the whole workload moved.',
        'The approach also works because migration risk is uneven. A deterministic preprocessing kernel with golden outputs can be ported cheaply. A fused attention kernel on the p99 path, where tiny numerical differences can change ranking or model behavior, needs deeper testing and probably a rollback path.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Portability spends engineering time, test infrastructure, benchmark time, and sometimes performance. If a route serves 10,000 requests per second and a portable backend is 30 percent slower, the business must buy about 43 percent more capacity to keep the same headroom, because 1 / 0.70 = 1.43. That cost can be worth paying for supply flexibility, but it is not free.',
        'Lock-in also has cost behavior. Supplier pricing power, capacity shortages, hiring constraints, cloud-region limits, and incident dependence all grow as more critical routes rely on one ecosystem. The matrix lets a team compare the cost of staying with the cost of moving for each workload.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'AI platform teams use this analysis before supporting non-NVIDIA accelerators, moving inference to edge hardware, or negotiating cloud capacity. High-performance computing teams use the same pattern when deciding whether a simulation code can move between CUDA, HIP, SYCL, or CPU-vectorized paths. The matrix matters most when the workload has real service targets, not just compile targets.',
        'The pattern also helps procurement and architecture planning. A credible secondary path for batch inference, offline evaluation, or preprocessing can create option value even if the main training path remains CUDA. Partial portability is still useful when it shifts demand, reduces outage exposure, or gives the business a tested alternative.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The matrix fails when teams score intentions instead of workloads. A row marked portable because a library exists is not evidence that the service route works. Performance, numerics, observability, packaging, and support all need proof under the real input shape.',
        'It also fails when people treat lock-in as a moral category. A CUDA path can be the right primary path because it is faster, cheaper, and better supported for a given workload. The serious question is which dependencies are intentional, which are accidental, and which risks the business is paying to keep.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider an inference service that serves 2,000 requests per second. Its route uses PyTorch for model code, a custom CUDA attention kernel, TensorRT export, CUDA graphs, and NVIDIA-specific memory metrics. The Python model looks portable, but four rows in the matrix are still anchored to CUDA behavior.',
        'The team ports a low-tier batch route first. Baseline p95 latency is 80 ms and p99 is 130 ms on the CUDA path. The target accelerator path returns correct answers within tolerance, but p95 is 104 ms and p99 is 190 ms, so the matrix marks correctness green and service latency yellow.',
        'The decision is not all or nothing. The batch route can move because it has a 250 ms p99 target, while the interactive route stays CUDA because it has a 150 ms p99 target. That outcome is real portability for one workload and honest lock-in for another.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study NVIDIA CUDA documentation at https://docs.nvidia.com/cuda/, AMD ROCm documentation at https://rocm.docs.amd.com/, SYCL at https://www.khronos.org/sycl/, Triton at https://triton-lang.org/, and PyTorch backend notes at https://pytorch.org/docs/stable/. Then study GPU all-reduce, tensor parallelism, MLIR, kernel fusion, PagedAttention, WebGPU buffers, and heterogeneous workload routing.',
      ],
    },
  ],
};
