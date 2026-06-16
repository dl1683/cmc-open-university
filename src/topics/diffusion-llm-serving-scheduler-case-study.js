// Serving diffusion LLMs means scheduling denoising steps, confidence gates,
// approximate cache state, and mixed requests without assuming AR decode shape.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'diffusion-llm-serving-scheduler-case-study',
  title: 'Diffusion LLM Serving Scheduler Case Study',
  category: 'Systems',
  summary: 'A production serving case study for diffusion LLMs: step buckets, mask-count queues, approximate KV reuse, confidence-aware parallel decoding, fallbacks, and p99 gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['step batching', 'confidence gate'], defaultValue: 'step batching' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function schedulerGraph(title) {
  return graphState({
    nodes: [
      { id: 'api', label: 'API', x: 0.6, y: 3.6, note: 'requests' },
      { id: 'shape', label: 'shape', x: 2.0, y: 2.0, note: 'len/mask' },
      { id: 'bucket', label: 'bucket', x: 3.7, y: 2.0, note: 'step' },
      { id: 'cache', label: 'cache', x: 3.7, y: 5.1, note: 'block KV' },
      { id: 'gpu', label: 'GPU', x: 5.7, y: 3.6, note: 'batch' },
      { id: 'gate', label: 'gate', x: 7.4, y: 2.2, note: 'conf' },
      { id: 'fallback', label: 'fallback', x: 7.4, y: 5.2, note: 'AR/slow' },
      { id: 'stream', label: 'stream', x: 9.2, y: 3.6, note: 'tokens' },
    ],
    edges: [
      { id: 'e-api-shape', from: 'api', to: 'shape' },
      { id: 'e-shape-bucket', from: 'shape', to: 'bucket' },
      { id: 'e-shape-cache', from: 'shape', to: 'cache' },
      { id: 'e-bucket-gpu', from: 'bucket', to: 'gpu' },
      { id: 'e-cache-gpu', from: 'cache', to: 'gpu' },
      { id: 'e-gpu-gate', from: 'gpu', to: 'gate' },
      { id: 'e-gate-stream', from: 'gate', to: 'stream' },
      { id: 'e-gate-fallback', from: 'gate', to: 'fallback' },
      { id: 'e-fallback-stream', from: 'fallback', to: 'stream' },
    ],
  }, { title });
}

function* stepBatching() {
  yield {
    state: schedulerGraph('Diffusion LLM serving schedules denoise work, not only next-token work'),
    highlight: { active: ['api', 'shape', 'bucket', 'gpu', 'e-api-shape', 'e-shape-bucket', 'e-bucket-gpu'], found: ['gate', 'stream'], compare: ['cache'] },
    explanation: 'Autoregressive serving is organized around prefill and decode. Diffusion LLM serving needs queues keyed by denoise step, mask count, block size, confidence policy, and cache compatibility.',
    invariant: 'Requests should be batched by similar denoise shape, not merely by arrival time.',
  };

  yield {
    state: labelMatrix(
      'Ready queue',
      [
        { id: 'r1', label: 'req1' },
        { id: 'r2', label: 'req2' },
        { id: 'r3', label: 'req3' },
        { id: 'r4', label: 'req4' },
      ],
      [
        { id: 'step', label: 'step' },
        { id: 'mask', label: 'mask' },
        { id: 'block', label: 'blk' },
        { id: 'route', label: 'route' },
      ],
      [
        ['6', '18', '4', 'batch A'],
        ['6', '17', '4', 'batch A'],
        ['2', '41', '8', 'batch B'],
        ['6', '5', '4', 'finish'],
      ],
    ),
    highlight: { active: ['r1:route', 'r2:route'], compare: ['r3:route'], found: ['r4:route'] },
    explanation: 'The scheduler groups requests with compatible denoise state. Requests 1 and 2 have the same step and block size, so they batch cleanly. Request 3 is a different denoise phase. Request 4 is near completion and may get a small finishing lane.',
  };

  yield {
    state: labelMatrix(
      'Cache and paging ledger',
      [
        { id: 'ctx', label: 'context' },
        { id: 'state', label: 'state' },
        { id: 'kv', label: 'KV approx' },
        { id: 'page', label: 'pages' },
      ],
      [
        { id: 'stored', label: 'stored' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['prompt ids', 'stable'],
        ['block+mask', 'version'],
        ['hidden state', 'approx'],
        ['GPU mem', 'fragment'],
      ],
    ),
    highlight: { active: ['state:stored', 'kv:stored'], compare: ['kv:risk', 'page:risk'] },
    explanation: 'Diffusion LLM caching is harder than ordinary KV reuse because bidirectional denoising changes which tokens are visible. A practical server needs cache versioning keyed by block state and mask bits.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'request mix entropy', min: 0, max: 1.2 }, y: { label: 'relative throughput', min: 0, max: 120 } },
      series: [
        { id: 'ar', label: 'AR', points: [{ x: 0.0, y: 84 }, { x: 0.2, y: 82 }, { x: 0.4, y: 79 }, { x: 0.6, y: 73 }, { x: 0.8, y: 65 }, { x: 1.0, y: 58 }] },
        { id: 'naive', label: 'naive', points: [{ x: 0.0, y: 96 }, { x: 0.2, y: 78 }, { x: 0.4, y: 61 }, { x: 0.6, y: 45 }, { x: 0.8, y: 34 }, { x: 1.0, y: 28 }] },
        { id: 'bucketed', label: 'bkt', points: [{ x: 0.0, y: 110 }, { x: 0.2, y: 101 }, { x: 0.4, y: 91 }, { x: 0.6, y: 78 }, { x: 0.8, y: 64 }, { x: 1.0, y: 52 }] },
      ],
      markers: [
        { id: 'skew', x: 0.7, y: 70, label: 'skew' },
      ],
    }),
    highlight: { active: ['bucketed', 'skew'], compare: ['naive'], found: ['ar'] },
    explanation: 'Diffusion serving wins only if the scheduler preserves batch shape. A naive implementation can lose to autoregressive serving under heterogeneous traffic; step buckets and shape-aware queues recover much of the advantage.',
  };
}

function* confidenceGate() {
  yield {
    state: labelMatrix(
      'Confidence-aware parallel decode',
      [
        { id: 'p1', label: 'pos1' },
        { id: 'p2', label: 'pos2' },
        { id: 'p3', label: 'pos3' },
        { id: 'p4', label: 'pos4' },
        { id: 'p5', label: 'pos5' },
      ],
      [
        { id: 'token', label: 'top' },
        { id: 'conf', label: 'conf' },
        { id: 'act', label: 'act' },
      ],
      [
        ['return', '.91', 'commit'],
        ['user', '.74', 'hold'],
        ['.', '.96', 'commit'],
        ['profile', '.82', 'commit'],
        [';', '.55', 'hold'],
      ],
    ),
    highlight: { active: ['p1:act', 'p3:act', 'p4:act'], compare: ['p2:act', 'p5:act'] },
    explanation: 'A confidence-aware scheduler decodes multiple slots only when their confidence exceeds the route threshold. Holding uncertain tokens protects quality when parallel assumptions would otherwise break dependencies.',
    invariant: 'The fastest lane must still be allowed to say no.',
  };

  yield {
    state: schedulerGraph('The gate chooses commit, hold, or fallback'),
    highlight: { active: ['gpu', 'gate', 'stream', 'fallback', 'e-gpu-gate', 'e-gate-stream', 'e-gate-fallback'], compare: ['bucket', 'cache'] },
    explanation: 'After each denoise batch, the gate can commit tokens, hold them for another step, or fall back to a slower route. The route may be a lower parallelism diffusion pass, a teacher sampler, or an autoregressive model.',
  };

  yield {
    state: labelMatrix(
      'Complete case: coding API',
      [
        { id: 'fast', label: 'fast path' },
        { id: 'json', label: 'JSON' },
        { id: 'code', label: 'code' },
        { id: 'chat', label: 'chat' },
        { id: 'risk', label: 'risky' },
      ],
      [
        { id: 'policy', label: 'policy' },
        { id: 'metric', label: 'metric' },
      ],
      [
        ['parallel 4', 'p95 ok'],
        ['parallel 2', 'schema'],
        ['block 4', 'tests'],
        ['parallel 1', 'quality'],
        ['fallback', 'guard'],
      ],
    ),
    highlight: { active: ['fast:policy', 'json:policy', 'code:policy'], compare: ['chat:policy'], found: ['risk:policy'] },
    explanation: 'A coding API can route predictable completions to a four-token parallel lane, schema outputs to a stricter two-token lane, open chat to a conservative lane, and risky requests to fallback or rejection.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'confidence threshold', min: 0.5, max: 0.98 }, y: { label: 'relative value', min: 0, max: 100 } },
      series: [
        { id: 'throughput', label: 'throughput', points: [{ x: 0.55, y: 96 }, { x: 0.65, y: 87 }, { x: 0.75, y: 74 }, { x: 0.85, y: 54 }, { x: 0.95, y: 25 }] },
        { id: 'quality', label: 'quality', points: [{ x: 0.55, y: 68 }, { x: 0.65, y: 78 }, { x: 0.75, y: 88 }, { x: 0.85, y: 94 }, { x: 0.95, y: 98 }] },
        { id: 'p99', label: 'p99 health', points: [{ x: 0.55, y: 61 }, { x: 0.65, y: 74 }, { x: 0.75, y: 88 }, { x: 0.85, y: 92 }, { x: 0.95, y: 77 }] },
      ],
      markers: [
        { id: 'policy', x: 0.78, y: 88, label: 'policy' },
      ],
    }),
    highlight: { active: ['quality', 'p99', 'policy'], compare: ['throughput'] },
    explanation: 'Lower thresholds commit more tokens and increase throughput, but quality and p99 can degrade. The production threshold is a calibrated policy per route, not a global constant.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'step batching') yield* stepBatching();
  else if (view === 'confidence gate') yield* confidenceGate();
  else throw new InputError('Pick a diffusion LLM serving view.');
}

export const article = {
  references: [
    { title: 'Fast-dLLM: Training-free Acceleration of Diffusion LLM', url: 'https://arxiv.org/abs/2505.22618' },
    { title: 'Fast-dLLM Project Page', url: 'https://nvlabs.github.io/Fast-dLLM/' },
    { title: 'Mercury: Ultra-Fast Language Models Based on Diffusion', url: 'https://arxiv.org/html/2506.17298v1' },
    { title: 'Block Diffusion', url: 'https://arxiv.org/abs/2503.09573' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['A diffusion LLM serving scheduler is the control plane that turns masked denoising into a production service. It decides how requests are bucketed, how many tokens may be decoded in parallel, which cache state is reusable, and when to fall back.', 'This case study links Discrete Diffusion Language Model Primer, Block Diffusion LLM Denoising, KV Cache, LLM Continuous Batching, and LLM Inference Scaling Playbook into one serving design.'] },
    { heading: 'Data structures', paragraphs: ['The scheduler keeps ready queues keyed by denoise step, block size, remaining mask count, confidence policy, and cache compatibility. Each request carries a token buffer, mask bitset, block id, route id, cache version, and step budget.', 'The monitoring ledger records committed tokens per pass, held tokens, remasks, cache hits, fallback reasons, p95, p99, quality checks, and GPU occupancy. Without that ledger, a diffusion LLM can look fast in demos and slow in production.'] },
    { heading: 'How it works', paragraphs: ['Incoming requests are shaped into compatible buckets. The GPU runs a batch of similar denoising work. The confidence gate commits high-margin tokens, holds uncertain positions, and routes failures to a safer path.', 'Unlike autoregressive serving, the hot path is not simply prefill followed by one-token decode. Diffusion serving needs mask-aware batching and cache invalidation rules because the visible context can change across positions.'] },
    { heading: 'Complete case study', paragraphs: ['A coding API receives predictable code completions, schema-constrained JSON, open chat, and risky requests. Predictable code uses a parallel lane. JSON uses a stricter confidence threshold and schema validation. Open chat uses a conservative lane. Risky requests fall back or are rejected before expensive denoising.', 'The scheduler logs the route decision and all step outcomes. If p99 rises under heterogeneous traffic, it narrows buckets. If quality drops for code, it raises the confidence threshold or reduces block size.'] },
    { heading: 'Costs and tradeoffs', paragraphs: ['Diffusion LLMs can trade serial token latency for parallel denoising, but the win depends on batch shape, confidence thresholds, cache reuse, and request mix. Approximate cache reuse can help throughput while creating correctness risk if cache versions are stale.', 'A production decision should compare diffusion serving against autoregressive serving on end-to-end tasks: accepted answer latency, p99, cost per accepted output, quality, fallback rate, and operational complexity.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not use average tokens per second as the only metric. Step skew, remask loops, memory fragmentation, and fallback storms can make p99 worse even when average throughput improves.', 'Do not assume autoregressive infrastructure transfers directly. KV cache, continuous batching, and speculative decoding ideas are useful, but diffusion LLMs need mask-aware and block-aware variants.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Fast-dLLM at https://arxiv.org/abs/2505.22618 and https://nvlabs.github.io/Fast-dLLM/, Mercury at https://arxiv.org/html/2506.17298v1, and Block Diffusion at https://arxiv.org/abs/2503.09573. Study Discrete Diffusion Language Model Primer, Block Diffusion LLM Denoising, Consistency Distillation Few-Step Diffusion, KV Cache, LLM Continuous Batching, and Speculative Decoding Runtime Controller next.'] },
  ],
};
