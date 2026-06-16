// Inference kernel fusion and CUDA graphs: reduce memory traffic and launch
// overhead in repeated transformer serving loops.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'inference-kernel-fusion-cuda-graphs',
  title: 'Inference Kernel Fusion & CUDA Graphs',
  category: 'Systems',
  summary: 'How fused kernels and captured CUDA graphs remove memory traffic and CPU launch overhead in hot LLM inference paths.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['kernel fusion', 'cuda graphs'], defaultValue: 'kernel fusion' },
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

function kernelGraph(title, fused) {
  return graphState({
    nodes: [
      { id: 'hbm', label: 'HBM', x: 0.8, y: 3.7, note: 'global memory' },
      { id: 'load', label: 'load tile', x: 2.5, y: 3.7, note: 'read once' },
      { id: 'matmul', label: 'matmul', x: 4.0, y: fused ? 2.4 : 1.4, note: 'kernel A' },
      { id: 'bias', label: 'bias', x: 5.3, y: fused ? 3.7 : 3.1, note: fused ? 'same kernel' : 'kernel B' },
      { id: 'act', label: 'activation', x: 6.6, y: fused ? 5.0 : 4.8, note: fused ? 'same kernel' : 'kernel C' },
      { id: 'write', label: 'write output', x: 8.3, y: 3.7, note: fused ? 'write once' : 'write each op' },
    ],
    edges: [
      { id: 'e-hbm-load', from: 'hbm', to: 'load', weight: 'read' },
      { id: 'e-load-mm', from: 'load', to: 'matmul', weight: fused ? 'tile in SRAM' : 'tensor' },
      { id: 'e-mm-bias', from: 'matmul', to: 'bias', weight: fused ? 'registers' : 'HBM round trip' },
      { id: 'e-bias-act', from: 'bias', to: 'act', weight: fused ? 'registers' : 'HBM round trip' },
      { id: 'e-act-write', from: 'act', to: 'write', weight: 'final tensor' },
    ],
  }, { title });
}

function launchGraph(title, captured) {
  return graphState({
    nodes: [
      { id: 'cpu', label: 'CPU runtime', x: 0.8, y: 3.6, note: captured ? 'replay graph' : 'launch loop' },
      { id: 'k1', label: 'kernel 1', x: 3.0, y: 1.5, note: 'attention' },
      { id: 'k2', label: 'kernel 2', x: 4.5, y: 2.9, note: 'MLP' },
      { id: 'k3', label: 'kernel 3', x: 6.0, y: 4.3, note: 'norm' },
      { id: 'k4', label: 'kernel 4', x: 7.5, y: 5.7, note: 'sampling' },
      { id: 'gpu', label: 'GPU stream', x: 9.0, y: 3.6, note: captured ? 'one graph launch' : 'many launches' },
    ],
    edges: [
      { id: 'e-cpu-k1', from: 'cpu', to: 'k1', weight: captured ? 'captured node' : 'launch' },
      { id: 'e-k1-k2', from: 'k1', to: 'k2', weight: 'dependency' },
      { id: 'e-k2-k3', from: 'k2', to: 'k3', weight: 'dependency' },
      { id: 'e-k3-k4', from: 'k3', to: 'k4', weight: 'dependency' },
      { id: 'e-k4-gpu', from: 'k4', to: 'gpu', weight: captured ? 'replay' : 'complete' },
    ],
  }, { title });
}

function* kernelFusion() {
  yield {
    state: kernelGraph('Separate kernels repeatedly visit HBM', false),
    highlight: { active: ['e-mm-bias', 'e-bias-act'], compare: ['hbm', 'write'] },
    explanation: 'A transformer layer is a chain of operations. If every small operation launches as its own kernel and writes an intermediate tensor to HBM, the GPU spends precious time moving data instead of using it.',
  };

  yield {
    state: kernelGraph('A fused kernel keeps intermediates on chip', true),
    highlight: { found: ['matmul', 'bias', 'act', 'e-mm-bias', 'e-bias-act'], active: ['e-hbm-load', 'e-act-write'] },
    explanation: 'Kernel fusion combines compatible operations so intermediate values stay in registers or SRAM. Read once, compute several operations, write once. This is the same memory-awareness lesson as FlashAttention, applied to other hot paths.',
    invariant: 'Fusion changes the execution schedule, not the mathematical function.',
  };

  yield {
    state: labelMatrix(
      'Memory traffic is the real target',
      [
        { id: 'separate', label: 'separate ops' },
        { id: 'fused', label: 'fused op' },
        { id: 'flash', label: 'FlashAttention' },
        { id: 'triton', label: 'Triton style' },
      ],
      [
        { id: 'reads', label: 'global reads/writes' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['many', 'simple but bandwidth-heavy'],
        ['few', 'more code, less traffic'],
        ['avoid n by n writes', 'exact attention, IO-aware'],
        ['custom kernels', 'productivity plus tuning'],
      ],
    ),
    highlight: { found: ['fused:reads', 'flash:lesson'], compare: ['separate:reads'] },
    explanation: 'The benefit appears when memory movement dominates arithmetic. Fusing tiny or bandwidth-bound operators can improve latency; fusing the wrong thing can reduce occupancy, complicate numerics, or make shapes brittle.',
  };

  yield {
    state: labelMatrix(
      'Fusion failure modes',
      [
        { id: 'shape', label: 'shape specialization' },
        { id: 'occupancy', label: 'low occupancy' },
        { id: 'numerics', label: 'numerics' },
        { id: 'maint', label: 'maintenance' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'response', label: 'response' },
      ],
      [
        ['fast only for hot sizes', 'fallback kernels'],
        ['kernel too large', 'profile registers and blocks'],
        ['small differences', 'tolerance tests'],
        ['hard to debug', 'golden references'],
      ],
    ),
    highlight: { active: ['shape:response', 'occupancy:response', 'numerics:response', 'maint:response'] },
    explanation: 'Production fusion is not just clever code. It needs profiling, shape policies, fallbacks, numerical tests, and observability so a faster path does not silently become a wrong path.',
  };
}

function* cudaGraphs() {
  yield {
    state: launchGraph('Without capture, the CPU launches many tiny kernels', false),
    highlight: { active: ['cpu', 'e-cpu-k1'], compare: ['k1', 'k2', 'k3', 'k4'] },
    explanation: 'CUDA kernel launches have CPU overhead. In repeated decode loops with small or shape-stable work, launch overhead can become visible. The GPU can be ready, while the CPU runtime is still feeding it launches.',
  };

  yield {
    state: launchGraph('CUDA graph capture records the hot dependency graph', true),
    highlight: { found: ['k1', 'k2', 'k3', 'k4', 'gpu'], active: ['cpu'] },
    explanation: 'CUDA graphs capture a fixed sequence of GPU work and replay it with much lower launch overhead. Define the graph once, then launch the graph repeatedly for hot shapes.',
    invariant: 'Capture helps when topology and memory addresses are stable enough to replay.',
  };

  yield {
    state: labelMatrix(
      'Shape stability decides the fast path',
      [
        { id: 'hot1', label: 'batch 16, len 1' },
        { id: 'hot2', label: 'batch 32, len 1' },
        { id: 'cold', label: 'rare shape' },
        { id: 'dynamic', label: 'dynamic branch' },
      ],
      [
        { id: 'path', label: 'path' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['replay captured graph', 'common decode size'],
        ['replay captured graph', 'common decode size'],
        ['fallback eager kernels', 'not worth capture'],
        ['fallback or recapture', 'topology changed'],
      ],
    ),
    highlight: { found: ['hot1:path', 'hot2:path'], compare: ['cold:path', 'dynamic:path'] },
    explanation: 'The catch is shape rigidity. A captured graph is tied to a topology and memory pattern. Serving systems often capture a menu of hot shapes and use fallbacks for rare or dynamic cases.',
  };

  yield {
    state: labelMatrix(
      'Where CUDA graphs fit in an LLM server',
      [
        { id: 'prefill', label: 'prefill' },
        { id: 'decode', label: 'decode loop' },
        { id: 'batch', label: 'continuous batching' },
        { id: 'obs', label: 'monitoring' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['large matmuls dominate', 'less launch-sensitive'],
        ['many repeated small steps', 'best target'],
        ['keeps shapes moving', 'capture menu needed'],
        ['separate fast and fallback', 'silent regressions'],
      ],
    ),
    highlight: { active: ['decode:benefit'], compare: ['batch:risk', 'obs:risk'] },
    explanation: 'CUDA graphs are a control-plane optimization for the GPU execution path. They complement KV cache management, prefix caching, quantization, and batching; they do not replace any of them.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'kernel fusion') yield* kernelFusion();
  else if (view === 'cuda graphs') yield* cudaGraphs();
  else throw new InputError('Pick an inference-kernel view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Inference kernel fusion and CUDA graphs are execution-level optimizations for high-throughput model serving. Fusion reduces memory traffic by combining operations that would otherwise write intermediate tensors to global memory. CUDA graphs reduce CPU launch overhead by capturing a repeated GPU work graph and replaying it.',
        'The provided inference-scaling notes correctly put these in the compiler and graph-execution tier. They are not model architectures. They are how a serving stack turns the same model math into fewer memory trips and fewer launch stalls.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Kernel fusion is about locality. If a matmul, bias add, activation, normalization, or softmax step can keep intermediate data in registers or SRAM, the runtime avoids extra high-bandwidth-memory reads and writes. FlashAttention is the canonical transformer example: exact attention, but tiled so large intermediates do not spill to HBM.',
        'CUDA graphs are about launch overhead and dependency reuse. Instead of asking the CPU to launch each kernel every iteration, the runtime captures a graph of GPU operations and replays it. This works best for stable shapes and repeated decode paths.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is brittleness. Fused kernels can be shape-specialized, harder to debug, numerically delicate, or slower when occupancy falls. CUDA graphs can require stable memory addresses, fixed topology, and a set of captured hot shapes. Dynamic workloads still need eager fallback paths.',
        'The production metric is end-to-end latency and throughput, not whether a single kernel looks elegant. A fused kernel that breaks batching or makes rare shapes slow can hurt tail latency. A captured graph that silently falls back too often may not help real traffic.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LLM servers use fused attention, fused normalization, fused activation kernels, quantized matmuls, CUDA graph replay for decode loops, and compiler-generated kernels. These optimizations sit beside Continuous Batching, PagedAttention, Prefix Caching, Quantization, and Transformer Inference Roofline in the serving stack.',
        'The implementation detail that matters for operators is shape policy. A server may run eager kernels for rare shapes, captured graphs for hot decode shapes, and fused kernels only where profiling proves a memory-traffic win. CUDA Graph Shape Cache turns that policy into an explicit runtime cache; Accelerator Kernel Compatibility Matrix turns backend legality, dtype gates, and fallback evidence into explicit dispatch data.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Fusion is not automatically faster. It wins when it reduces memory traffic or launch overhead without killing occupancy. CUDA graphs are not a magic dynamic-programming cache; captured graphs are tied to shapes and execution topology. Both need profiling on representative traffic and fallbacks for out-of-distribution requests.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NVIDIA CUDA Graphs documentation at https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/cuda-graphs.html, NVIDIA CUDA Graph Best Practice for PyTorch at https://docs.nvidia.com/dl-cuda-graph/, PyTorch CUDA graphs at https://pytorch.org/blog/accelerating-pytorch-with-cuda-graphs/, and Triton fused softmax at https://triton-lang.org/main/getting-started/tutorials/02-fused-softmax.html. Study CUDA Graph Shape Cache, Accelerator Kernel Compatibility Matrix, FlashAttention Case Study, Transformer Inference Roofline, KV Cache, LLM Continuous Batching, Quantization, and Heterogeneous AI Compute Workload Router next.',
      ],
    },
  ],
};
