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
  const opCount = 3;
  const fusedOps = ['matmul', 'bias', 'activation'];
  const edgeCount = 5;
  const hbmRoundTrips = opCount - 1;
  const fusionApproaches = 4;
  const failureModes = 4;

  yield {
    state: kernelGraph('Separate kernels repeatedly visit HBM', false),
    highlight: { active: ['e-mm-bias', 'e-bias-act'], compare: ['hbm', 'write'] },
    explanation: `A transformer layer is a chain of ${opCount} operations (${fusedOps.join(', ')}). If every small operation launches as its own kernel and writes an intermediate tensor to HBM, the GPU spends precious time on ${hbmRoundTrips} round trips moving data instead of using it.`,
  };

  yield {
    state: kernelGraph('A fused kernel keeps intermediates on chip', true),
    highlight: { found: ['matmul', 'bias', 'act', 'e-mm-bias', 'e-bias-act'], active: ['e-hbm-load', 'e-act-write'] },
    explanation: `Kernel fusion combines ${opCount} compatible operations (${fusedOps.join(', ')}) so intermediate values stay in registers or SRAM. Read once, compute ${opCount} operations, write once. This eliminates ${hbmRoundTrips} HBM round trips and applies the same memory-awareness lesson as FlashAttention.`,
    invariant: `Fusion merges ${opCount} ops into one kernel, changing the execution schedule but not the mathematical function.`,
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
    explanation: `The benefit appears when memory movement dominates arithmetic across ${fusionApproaches} approaches shown. Fusing ${opCount} tiny or bandwidth-bound operators can improve latency; fusing the wrong thing can reduce occupancy, complicate numerics, or make shapes brittle.`,
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
    explanation: `Production fusion is not just clever code. All ${failureModes} failure modes (shape specialization, low occupancy, numerics, maintenance) need profiling, shape policies, fallbacks, and observability so a faster path through ${opCount} fused ops does not silently become a wrong path.`,
  };
}

function* cudaGraphs() {
  const kernelCount = 4;
  const hotShapes = 2;
  const shapeCategories = 4;
  const serverPhases = 4;
  const dependencies = kernelCount - 1;

  yield {
    state: launchGraph('Without capture, the CPU launches many tiny kernels', false),
    highlight: { active: ['cpu', 'e-cpu-k1'], compare: ['k1', 'k2', 'k3', 'k4'] },
    explanation: `CUDA kernel launches have CPU overhead. In repeated decode loops with ${kernelCount} small or shape-stable kernels, launch overhead can become visible across ${dependencies} dependency edges. The GPU can be ready, while the CPU runtime is still feeding it launches.`,
  };

  yield {
    state: launchGraph('CUDA graph capture records the hot dependency graph', true),
    highlight: { found: ['k1', 'k2', 'k3', 'k4', 'gpu'], active: ['cpu'] },
    explanation: `CUDA graphs capture a fixed sequence of ${kernelCount} GPU kernels and replay them with much lower launch overhead. Define the graph once, then replay the ${kernelCount}-node dependency chain repeatedly for hot shapes.`,
    invariant: `Capture helps when the topology of ${kernelCount} kernels and their memory addresses are stable enough to replay.`,
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
    explanation: `The catch is shape rigidity. Across ${shapeCategories} shape categories, only ${hotShapes} are hot enough to replay. A captured graph of ${kernelCount} kernels is tied to a topology and memory pattern. Serving systems often capture a menu of hot shapes and use fallbacks for rare or dynamic cases.`,
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
    explanation: `CUDA graphs are a control-plane optimization for ${serverPhases} server phases. They complement KV cache management, prefix caching, quantization, and batching across all ${kernelCount} captured kernels; they do not replace any of them.`,
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
    { heading: 'How to read the animation', paragraphs: [
        'The animation compares two execution paths for the same model math. A kernel is a GPU program launch; fusion means combining adjacent operations into fewer kernels; a CUDA graph is a captured GPU work graph that can be replayed. Active blocks show work being launched or executed, and gaps show coordination time.',
        {type: 'image', src: './assets/gifs/inference-kernel-fusion-cuda-graphs.gif', alt: 'Animated walkthrough of the inference kernel fusion cuda graphs visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is that deleting launches or memory round trips can improve serving latency only when those costs are on the hot path. If the workload is compute-bound, these techniques may not move the bottleneck.',
      ], },
    { heading: 'Why this exists', paragraphs: [
        'LLM inference can waste time without changing the model. Small kernels may write intermediate tensors to high-bandwidth memory and then read them back immediately. The CPU may also launch the same decode schedule one token at a time while the GPU waits for work.',
        {type: 'callout', text: 'Serving speed often comes from deleting coordination and memory traffic, not from changing the model.'},
        'Kernel fusion and CUDA graphs exist to remove those execution costs. Fusion reduces memory traffic and launch count. CUDA graphs reduce CPU launch overhead by capturing a stable operation graph and replaying it.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is to run every model operation as its own library call or eager kernel. This is simple, debuggable, and flexible for dynamic shapes. It is often the right starting point.',
        'Another obvious approach is to buy a faster GPU or increase batch size. That helps when arithmetic is the bottleneck. It does not fix launch gaps, repeated memory writes, or shape-specific overhead that prevents the GPU from staying busy.',
      ], },
    { heading: 'The wall', paragraphs: [
        'The wall is overhead that does not scale with useful math. A decode step may launch many small kernels for one new token. If each launch costs microseconds and the kernels are small, CPU scheduling can become visible in p50 and p99 latency.',
        'Memory traffic is the second wall. If operation A writes an intermediate tensor to HBM and operation B immediately reads it, the system pays an off-chip trip for data that could have stayed in registers, shared memory, or cache-friendly tiles.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Treat inference speed as a data-movement and scheduling problem, not only as a FLOP problem. Fusion keeps intermediate values closer to compute. CUDA graphs reuse a known launch dependency structure instead of rebuilding it every decode step.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Nvidia_GV100_GPU.png', alt: 'Nvidia GV100 GPU die with many compute blocks and memory interfaces', caption: 'Kernel fusion is about keeping values near compute instead of paying repeated off-chip memory trips. Source: Wikimedia Commons, Nvidia, public domain.'},
        'The insight is conditional. Fusion helps when adjacent operations are bandwidth-bound or launch-heavy. Graph replay helps when shapes, memory addresses, and dependencies are stable enough to capture and replay.',
      ], },
    { heading: 'How it works', paragraphs: [
        'A fused kernel combines operations such as bias, activation, normalization, masking, or softmax-adjacent work into one launch. The implementation tries to keep intermediate values on chip and write only the final result. FlashAttention is the canonical transformer example of changing execution layout while preserving exact attention math.',
        'CUDA graphs capture a sequence of GPU operations and dependencies. During replay, the CPU submits the captured graph with less overhead than launching every kernel separately. Serving systems often keep a pool of captured hot shapes and fall back to eager execution for rare or dynamic shapes.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'Fusion preserves correctness when the fused operation computes the same mathematical function within accepted numerical tolerance. It works because intermediate tensors are not part of the model output; they are execution artifacts. Removing their HBM round trip does not change the intended computation.',
        'CUDA graph replay preserves correctness when the captured topology, memory addresses, shapes, and dependencies match the replay request. The graph is a cached schedule, not a cached answer. The model still computes new token values from current inputs.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'A separate path with four tiny kernels may pay four launches and several HBM reads and writes. A fused path may pay one launch and one final write. If launch overhead is 5 microseconds, deleting three launches saves about 15 microseconds before memory savings are counted.',
        'The cost is engineering complexity. Fused kernels can increase register pressure, lower occupancy, or change numerical order. CUDA graphs need shape bucketing, stable allocation, graph pools, warmup capture, fallback paths, and metrics for replay hit rate.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Decode loops in LLM serving are a natural fit because the server repeatedly runs similar work for one new token per sequence. Captured graphs can reduce CPU launch overhead on hot shapes, while fused normalization or activation kernels reduce small-kernel overhead.',
        'Attention and softmax kernels use fusion to reduce memory traffic. Quantized inference kernels may fuse dequantization with matrix work or epilogues. Compiler stacks such as Triton, XLA, and TensorRT-style systems search for these opportunities in different ways.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'Fusion is not automatically faster. A fused kernel that uses too many registers can lower occupancy and slow the workload. It can also make debugging harder and create separate paths that drift numerically from the reference.',
        'CUDA graphs fail when real traffic rarely matches captured shapes. Continuous batching, variable sequence lengths, changing memory addresses, and dynamic branches can push requests to eager fallback. A graph path that looks excellent in a microbenchmark may cover little production traffic.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Assume one decode step launches layernorm, bias, activation, and residual kernels separately. If each launch costs 5 microseconds, launch overhead alone is 20 microseconds. If fusion combines three of them into one kernel, launch overhead drops to 10 microseconds, saving 10 microseconds per token before memory traffic is counted.',
        'For a server generating 100 tokens per response, that saves about 1 millisecond per response on that path. If only 40% of traffic matches the captured or fused hot shape, average savings is about 0.4 milliseconds. This is why replay hit rate and shape distribution matter as much as kernel speed.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Primary implementation sources are NVIDIA CUDA Graphs documentation, NVIDIA CUDA Graph best practices for PyTorch, PyTorch CUDA graphs guidance, and Triton fused-softmax tutorials. Study FlashAttention for the clearest transformer example of reducing memory traffic without changing exact attention.',
        'Study roofline analysis before choosing these techniques. Then study KV cache, continuous batching, PagedAttention, quantization, CUDA graph shape caches, kernel compatibility matrices, and heterogeneous workload routing to understand where kernel-level wins fit inside a serving stack.',
      ], },
  ],
};
