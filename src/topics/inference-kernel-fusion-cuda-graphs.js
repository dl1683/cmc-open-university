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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/inference-kernel-fusion-cuda-graphs.gif', alt: 'Animated walkthrough of the inference kernel fusion cuda graphs visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LLM serving can waste time without changing the model at all. Small kernels may repeatedly write intermediate tensors to HBM. The CPU may launch the same decode graph thousands of times. The GPU can be ready while the runtime is still feeding it work.',
        {type: 'callout', text: 'Serving speed often comes from deleting coordination and memory traffic, not from changing the model.'},
        'Kernel fusion and CUDA graphs exist to remove those costs. Fusion reduces memory traffic by combining adjacent operations. CUDA graphs reduce launch overhead by capturing a stable dependency graph and replaying it. Both are execution-path optimizations: they do not change the model objective, but they can change latency, throughput, and cost.',
      ],
    },
    {
      heading: 'The tempting wrong answer',
      paragraphs: [
        'The wrong answer is to assume faster hardware or a larger batch solves all inference latency. If the hot path is launch-bound or memory-traffic-bound, more raw FLOPs do not fix the bottleneck.',
        'Another wrong answer is to fuse everything or capture every shape. Fusion can reduce occupancy or make numerics brittle. CUDA graphs need stable topology, shapes, and memory assumptions. Rare dynamic paths still need fallbacks.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Fusion is about locality. If matmul, bias, activation, normalization, or softmax-adjacent work can keep intermediates in registers or SRAM, the runtime avoids extra high-bandwidth-memory reads and writes. FlashAttention is the canonical transformer example: exact attention, but tiled to avoid large HBM intermediates.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Nvidia_GV100_GPU.png', alt: 'Nvidia GV100 GPU die with many compute blocks and memory interfaces', caption: 'Kernel fusion is about keeping values near compute instead of paying repeated off-chip memory trips. Source: Wikimedia Commons, Nvidia, public domain.'},
        'CUDA graphs are about launch overhead and dependency reuse. Instead of asking the CPU to launch each kernel every decode step, the runtime captures a graph of GPU operations and replays it for hot shapes.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'Inspect the hot path as memory movement plus launch structure. A separate-kernel path reads input, writes an intermediate, launches another kernel, reads the intermediate, and writes another result. A fused path tries to keep the intermediate on chip and write only the final tensor.',
        'For CUDA graphs, inspect the shape and address assumptions. A captured graph is valuable only when the runtime can replay the same topology with stable allocations. Serving systems often keep a menu of captured hot shapes and fall back to eager kernels for rare or dynamic cases.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A fused kernel merges a sequence of operations into one launch. The implementation may keep values in registers, shared memory, or tensor-core-friendly tiles, then write a final result. This helps when the original operations were bandwidth-bound or launch-heavy rather than compute-bound.',
        'CUDA graphs work differently. During capture, the runtime records a sequence of GPU work and dependencies. During replay, the CPU submits the captured graph with lower overhead than launching each kernel independently. Decode loops are a natural target because they repeat many small operations for each generated token.',
        'The engineering constraint is shape policy. Prefill may be dominated by large matrix work. Decode may be launch-sensitive and shape-stable enough for graph replay. Continuous batching changes batch shape over time, so the runtime needs bucketing, padding, graph pools, or eager fallback.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Fusion works because memory movement is often more expensive than arithmetic. If two operations are individually cheap but each reads and writes HBM, combining them can save bandwidth and cache pollution. The model computes the same mathematical result while touching memory fewer times.',
        'CUDA graphs work because CPU launch overhead is not free. In a token-by-token decode loop, many small launches can create a feed-the-GPU bottleneck. Capturing the dependency graph lets the runtime replay a known schedule with less CPU involvement.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider an LLM server with a hot decode shape: batch 32, one new token per sequence, common attention and normalization shapes, and stable memory pools. Profiling shows that several tiny kernels and CPU launch overhead appear between larger matrix operations.',
        'The team fuses normalization and activation paths where numerical tests match the reference. It captures a CUDA graph for the common decode shape, keeps eager fallback for rare shapes, and records which path served each request. The result is not "CUDA graphs made inference fast" in the abstract. The result is that a specific workload spent less time launching kernels and moving intermediates.',
        'A second workload tells a different story. Long prefill requests have large matrix operations and highly variable sequence lengths. Graph replay covers little traffic, and fusion only helps a few peripheral operations. The right optimization there may be better batching, paged KV memory, or attention tiling rather than a graph-capture project.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'These optimizations win in decode loops, fused attention, fused normalization, fused activation kernels, quantized matmuls, compiler-generated kernels, and shape-stable serving paths. They sit beside Continuous Batching, PagedAttention, Prefix Caching, Quantization, and Transformer Inference Roofline.',
        'The implementation detail that matters for operators is shape policy. A server may use eager kernels for rare shapes, captured graphs for hot decode shapes, and fused kernels only where profiling proves a memory-traffic win.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Fusion is not automatically faster. It wins when it reduces memory traffic or launch overhead without killing occupancy. A fused kernel that breaks batching or makes rare shapes slow can hurt tail latency.',
        'CUDA graphs are not a magic dynamic-programming cache. Captured graphs are tied to shapes, memory addresses, and execution topology. If fallback happens too often on real traffic, the captured path may look good in microbenchmarks and do little in production.',
        'Numerics are another failure mode. A fused path can change operation order, precision, or accumulation behavior. Production systems need golden references, tolerance tests, and path-specific metrics so a faster path does not silently become a different model.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track graph replay hit rate, eager fallback rate, kernel-launch count per token, HBM bytes moved, occupancy, registers per thread, p50 and p99 decode latency, numerical-diff failures, graph recapture count, and shape distribution. These metrics show whether the optimization matches real traffic.',
        'A useful rollout separates prefill and decode. Prefill may benefit more from batching and memory planning. Decode may benefit more from graph replay and small-kernel fusion. Mixing those phases into one average hides the real bottleneck.',
      ],
    },
    {
      heading: 'How to choose the technique',
      paragraphs: [
        'Choose fusion when profiling shows repeated memory traffic between adjacent operations. The question is whether an intermediate tensor is being written to HBM only to be read immediately by the next kernel. If yes, fusion may turn two memory trips into one local computation.',
        'Choose CUDA graphs when profiling shows launch overhead or CPU scheduling overhead on a repeated shape. The question is whether the operation graph is stable enough to capture and replay. If shapes, branches, or memory addresses change constantly, graph capture may add complexity without covering much traffic.',
        'In real systems the answer can be both. A decode loop may use fused kernels inside a captured graph, while rare shapes fall back to normal eager execution. That mixed policy is healthier than forcing every request through the same supposedly optimized path.',
        'The discipline is to start with a roofline and trace, not with a favorite optimization. If arithmetic units are idle because memory is moving intermediates, fusion is plausible. If GPU kernels are tiny and launch gaps are visible, graph replay is plausible. If the queue is overloaded or KV cache is full, these kernel-level tricks may be the wrong layer.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Kernel fusion and CUDA graphs are not model improvements. They are execution improvements. Fusion saves memory traffic when adjacent work can stay local. CUDA graphs save launch overhead when a hot schedule can be captured and replayed safely.',
        'For course design, teach this after roofline analysis and before full serving control planes. Students should learn to ask what the bottleneck is, which shapes are hot, what fallback exists, and how the team proves the fast path is still correct.',
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
