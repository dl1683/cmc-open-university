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
      heading: 'What it is',
      paragraphs: [
        'A CUDA ecosystem portability lock-in matrix is a way to turn accelerator dependence into an inspectable backlog. It tracks framework calls, library dependencies, fused kernels, collectives, profilers, debugging workflows, numeric tolerances, tuning assumptions, and promotion gates across CUDA, ROCm, XLA, and other accelerator stacks.',
        'The local AI infrastructure corpus argues that CUDA lock-in is not only chip performance. It is framework optimization, library maturity, engineering familiarity, hyperparameter tuning, debugging culture, and organizational inertia. This module turns that claim into a data structure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start from production traces. Extract operator families, dtypes, shape buckets, custom kernels, collectives, memory pressure, topology assumptions, and debugging needs. Then build a matrix that says which backend is legal, which one is fast, which one is numerically acceptable, and which one has an operational fallback.',
        'This extends Accelerator Kernel Compatibility Matrix. That module asks whether an op, dtype, and shape can run. This module asks whether the entire ecosystem around the workload can move without silently losing performance, debuggability, or reliability.',
      ],
    },
    {
      heading: 'Primary ecosystem facts',
      paragraphs: [
        'NVIDIA CUDA documentation frames CUDA as the programming platform for GPU-accelerated applications and includes the programming guide plus library ecosystem: https://docs.nvidia.com/cuda/. NVIDIA NCCL documents multi-GPU and multi-node collectives used by deep learning frameworks: https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/.',
        'PyTorch documents CUDA semantics and also notes that ROCm uses torch.cuda interfaces for compatibility in many places: https://docs.pytorch.org/docs/stable/notes/cuda.html and https://docs.pytorch.org/docs/2.12/notes/hip.html. AMD documents ROCm support for PyTorch separately: https://rocm.docs.amd.com/projects/install-on-linux/en/latest/install/3rd-party/pytorch-install.html.',
      ],
    },
    {
      heading: 'Migration design',
      paragraphs: [
        'A good migration plan is trace-first. It ranks backlog rows by real time spent, not by architectural neatness. Port the hot operators, collectives, and fused kernels first. Keep CPU or CUDA fallback where parity is not proven. Promote only after numeric tolerance, throughput, memory pressure, p99, and observability gates pass.',
        'ONNX Runtime execution providers are one practical example of ordered backend selection and fallback at runtime: https://onnxruntime.ai/docs/execution-providers/. The same mental model applies to a larger platform router: choose a backend only after it claims the subgraph and passes product policy.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not equate framework import success with production portability. Do not trust average throughput without p99 and failure debugging. Do not move only the easy models and claim the fleet migrated. Do not ignore collectives; training and MoE inference often fail at the communication layer before the scalar operator layer.',
        'Also avoid measuring one accelerator against another without retuning. Kernel tile sizes, memory hierarchy, collective algorithms, precision choices, graph capture, and batching policies can all change the fair comparison.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NVIDIA CUDA documentation at https://docs.nvidia.com/cuda/, NVIDIA NCCL user guide at https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/, PyTorch CUDA notes at https://docs.pytorch.org/docs/stable/notes/cuda.html, PyTorch HIP notes at https://docs.pytorch.org/docs/2.12/notes/hip.html, AMD ROCm PyTorch guide at https://rocm.docs.amd.com/projects/install-on-linux/en/latest/install/3rd-party/pytorch-install.html, and ONNX Runtime execution providers at https://onnxruntime.ai/docs/execution-providers/. Study Accelerator Kernel Compatibility Matrix, Heterogeneous AI Compute Workload Router, Inference Kernel Fusion and CUDA Graphs, CUDA Graph Shape Cache, GPU All-Reduce, and NVLink/NVSwitch GPU Fabric next.',
      ],
    },
  ],
};
