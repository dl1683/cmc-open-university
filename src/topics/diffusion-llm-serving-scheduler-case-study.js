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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the scheduler graph as a request lifecycle. Shape classification assigns a route, step buckets group compatible denoising work, the GPU advances a batch, and the confidence gate decides what can stream. The safe inference is that two requests batch well only when their denoise state is compatible, not merely because they arrived close together.',
        {type: 'callout', text: 'A diffusion LLM scheduler batches by denoise-state compatibility, not by the autoregressive prefill/decode shape.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Autoregressive LLM serving has a familiar shape: prefill the prompt, then decode one token at a time. Diffusion LLMs use a different shape: they start with masked positions and iteratively denoise them, sometimes committing several tokens in one pass. Serving infrastructure must schedule denoising steps, mask counts, confidence gates, and fallback routes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to reuse an autoregressive serving stack. Continuous batching, paged KV cache, request queues, and prefill/decode metrics are already mature. This reuse works for ingress and load balancing, but it does not define the right batch key for diffusion decoding.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is heterogeneous denoise state. Two requests with the same output length may have different step numbers, mask counts, block sizes, and confidence thresholds. If the scheduler batches them anyway, fast requests pad behind slow ones and low-confidence tokens create retries or fallback storms.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The batch key is denoise-state compatibility. A shaped request records denoise step, remaining mask count, block size, route id, confidence threshold, cache version, deadline, and fallback budget. A batch is healthy when one GPU pass can advance all members without forcing bad commits or wasting most lanes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The scheduler first classifies the request and assigns a route policy. It then places the request into a ready queue keyed by step, block size, mask bucket, and cache compatibility. After each GPU pass, the confidence gate commits high-confidence tokens, holds uncertain tokens for another pass, or moves the request to a slower fallback route.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a gate invariant. The fast lane may propose several tokens, but only the confidence policy commits them to the user-visible stream. Cache correctness also needs versioning: a hidden state is reusable only when the block state, mask pattern, model version, and route policy still match.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Diffusion serving trades serial token steps for parallel denoising, but the win depends on accepted tokens per pass. If a route proposes 4 tokens and the gate accepts 3 on average, 120 output tokens take about 40 passes. If traffic skew drops acceptance to 1.5 tokens per pass, the same answer takes about 80 passes and may lose to autoregressive serving.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This fits code completion, fill-in-the-middle editing, schema-constrained JSON, boilerplate transforms, and other workloads where several positions can be predicted with high confidence. It is less natural for open-ended chat, where wrong early commits are expensive. A production service should route by task shape, not by model name alone.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when dashboards optimize raw generated tokens instead of accepted output. Step skew, cache-version drift, route starvation, memory fragmentation, and fallback loops can make p99 latency worse while average throughput looks better. A global confidence threshold is also wrong because code, JSON, chat, and safety-sensitive requests have different costs for a bad commit.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take two code-completion requests in the fast-4 route with threshold 0.80. Request A is at step 6 with 18 masks left, and request B is at step 6 with 17 masks left, so the scheduler places them in the same block-4 bucket. One GPU pass proposes 4 positions for each request.',
        'A gets confidences 0.91, 0.74, 0.96, and 0.82, so it commits 3 tokens and holds 1. B gets 0.88, 0.63, 0.93, and 0.71, so it commits 2 and holds 2. The cost metric is not 8 proposed tokens; it is 5 accepted tokens plus 3 held positions that return to the queue with updated mask state.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Fast-dLLM, Mercury, Block Diffusion, and the literature on masked diffusion language models. Then study continuous batching, KV cache, speculative decoding, confidence calibration, fallback routing, and p99 latency measurement. The next practical topic is cache versioning for bidirectional denoising state.',
      ],
    },
  ],
};
