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
      heading: 'Why this exists',
      paragraphs: [
        "Autoregressive LLM serving is built around a simple shape: prefill the prompt, then decode one next token at a time. Diffusion LLMs change that shape. They generate by denoising masked positions, often with a chance to commit multiple tokens in one pass.",
        "The reasonable first attempt is to reuse an autoregressive server: continuous batching, KV cache, request queues, and p99 SLO routing. Those pieces still help, but they are keyed to next-token decode. A diffusion server has to schedule denoise steps, mask counts, block sizes, confidence thresholds, cache versions, and fallback routes.",
        "The scheduler exists to turn a research decoding method into a production service. It decides which requests can share a GPU batch, which hidden state can be reused, which tokens are safe to commit, and when speed has to yield to quality.",
        "Without that scheduler, diffusion decoding is only a model-side promise. The service must make the promise survive mixed traffic, noisy confidence estimates, memory pressure, and user-facing latency targets.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "Naive batching fails because two requests with the same output length may be in different denoise phases. One may have forty masked positions left, another may have five, and a third may be waiting on a high-confidence commit. Batching them together wastes GPU work or forces the slower shape onto the faster request.",
        "Caching is also different. Ordinary KV reuse assumes a stable left-to-right prefix. Bidirectional denoising changes which positions are visible and which hidden states remain valid. A stale approximate cache can make the server fast while quietly damaging quality.",
        "The exact wall is p99 under heterogeneous traffic. A benchmark with uniform prompts can show high throughput. A production mix with code completion, JSON, chat, long prompts, remask loops, and fallbacks can lose the speedup unless the scheduler preserves compatible work shapes.",
        "There is also a product wall. Users do not buy raw denoise steps per second. They experience first useful token time, accepted answer latency, formatting errors, retry storms, and whether a completion is stable enough to stream.",
      ],
    },
    {
      heading: 'Core state model',
      paragraphs: [
        "Each request carries a prompt, token buffer, mask bitset, block id, denoise step, remaining mask count, route id, deadline, confidence policy, cache version, fallback budget, and quality guard. Those fields are the scheduling key.",
        "The server keeps ready queues keyed by denoise step, block size, mask count bucket, cache compatibility, and route policy. It also keeps a cache and paging ledger for prompt state, approximate hidden state, page ownership, eviction reason, and version validity.",
        "The monitoring ledger records committed tokens per pass, held tokens, remasks, cache hits, fallback reasons, p50, p95, p99, accepted-output latency, quality checks, and GPU occupancy. Without those fields, the system can optimize a demo metric while hurting user-visible results.",
        "The invariant is shape compatibility. A batch is healthy when requests share enough denoise state that one GPU pass advances them all without forcing bad commits or wasting most of the work on padding and holds.",
      ],
    },
    {
      heading: 'Animation Meaning',
      paragraphs: [
        "In the step batching view, the API node is not the scheduler. The scheduler starts after ingress, when the request has been shaped by length, mask state, block size, route, and cache version. The bucket node means requests are grouped by denoise compatibility rather than mere arrival time.",
        "The cache node shows why a diffusion server cannot blindly copy an autoregressive KV-cache policy. Hidden state can be reusable only under a matching block and mask version. The graph route through GPU and gate shows that compute is followed by a decision, not automatic streaming.",
        "In the confidence gate view, each position has its own commit decision. A high-confidence token can be streamed, a weak token can be held, and a risky request can fall back. The teaching point is that parallel generation is useful only when the gate preserves quality.",
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        "Ingress first shapes the request. The router classifies the task, chooses a route, sets a confidence threshold, and places the request into a compatible denoise bucket. A predictable code completion may go to a wider parallel lane. Open chat may use a narrower lane. Risky requests may start conservative or fall back early.",
        "The GPU runs a batch of compatible denoise work. After the pass, the confidence gate decides position by position: commit the token, hold it for another pass, remask it, or send the request to a safer route. Committed tokens update the request buffer and can change later cache validity.",
        "Fallback is part of the design, not an exception handler. The fallback route may be a lower-parallelism diffusion pass, a teacher sampler, an autoregressive model, a schema repair step, a tool, or rejection before the request burns more GPU time.",
        "Admission control should include a fallback budget. If a request repeatedly fails the gate, it should not sit forever in a fast lane that keeps consuming GPU without producing accepted output. The scheduler should move it, degrade gracefully, or reject it according to policy.",
      ],
    },
    {
      heading: 'Reliability argument',
      paragraphs: [
        "The scheduler is reliable only if speed decisions are gated by quality decisions. The invariant is that the fast lane may propose several tokens, but only the confidence policy can commit them to the output stream.",
        "Cache safety comes from versioning. A cached hidden state is usable only for the block state, mask pattern, model version, and route policy it was recorded under. If those fields drift, the cache must be treated as approximate or invalid.",
        "SLO safety comes from separating queue health from accepted-output health. A diffusion route that raises raw tokens per second but increases fallback rate, remask loops, or p99 accepted latency is not a production win.",
        "Backpressure must be measured after the gate. A queue can look empty because requests are cycling through denoise passes quickly, while users still wait because too few tokens are accepted. Accepted work, not attempted work, is the stable service metric.",
      ],
    },
    {
      heading: 'Costs',
      paragraphs: [
        "Diffusion LLMs trade serial next-token latency for parallel denoising. The win depends on how many tokens can be safely committed per pass, how often requests share a shape, how much cache state is reusable, and how often the system falls back.",
        "Shape-aware scheduling has overhead. More buckets improve compatibility but fragment traffic. Fewer buckets fill the GPU faster but mix incompatible work. Higher confidence thresholds protect quality but reduce throughput. Lower thresholds commit more tokens and can create repair work later.",
        "The practical comparison is not average tokens per second. Compare diffusion serving with autoregressive serving on accepted answer latency, p99, cost per accepted output, quality, fallback rate, memory pressure, cache hit rate, and operational complexity.",
        "The memory cost can also move in unfamiliar ways. A server may store prompt state, block state, approximate hidden state, and mask-version metadata rather than only a left-to-right prefix cache. Eviction policy has to account for correctness of reuse, not just least recently used pages.",
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        "Start with route-specific thresholds rather than one global threshold. JSON, code, search snippets, long-form chat, and safety-sensitive completions have different tolerance for a wrong early commit.",
        "Log every gate decision with enough context to reproduce it: route, threshold, top confidence, held positions, committed positions, fallback reason, model version, and latency. That ledger is what lets the team tune policy without arguing from anecdotes.",
        "Keep an autoregressive or conservative route available during rollout. Diffusion serving should be introduced as a measured lane with guardrails, because the fastest path may be wrong for a subset of traffic that matters to users.",
      ],
    },
    {
      heading: 'Production uses',
      paragraphs: [
        "Diffusion serving fits workloads where several positions can be predicted with high confidence. Coding completion, fill-in-the-middle, structured JSON, boilerplate transformations, and short constrained responses can benefit more than open-ended chat.",
        "A coding API can route predictable completions to a four-token parallel lane, schema-constrained JSON to a two-token lane with validation, open chat to a conservative lane, and risky requests to fallback. The route is chosen per request because the same model can behave differently across task shapes.",
        "A concrete step looks like this: two code-completion requests enter step 6 with block size 4 and similar mask counts. They batch together. The gate commits three high-confidence tokens in request A, holds one token in request B, and sends a malformed JSON branch to a stricter route. The ledger records those decisions so the threshold can be tuned later.",
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        "Average throughput can hide the failure. Step skew, remask loops, memory fragmentation, route starvation, and fallback storms can make p99 worse even while the dashboard shows more generated tokens.",
        "A global confidence threshold is usually wrong. Code, JSON, chat, retrieval answers, and safety-sensitive requests have different costs for a bad commit. The threshold belongs to the route and should be calibrated against accepted-output quality.",
        "Autoregressive infrastructure transfers as concepts, not as drop-in machinery. KV cache, continuous batching, and speculative decoding are useful references. Diffusion serving needs mask-aware queues, block-aware cache versions, and confidence-aware commit rules.",
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Fast-dLLM at https://arxiv.org/abs/2505.22618 and https://nvlabs.github.io/Fast-dLLM/, Mercury at https://arxiv.org/html/2506.17298v1, and Block Diffusion at https://arxiv.org/abs/2503.09573.',
        'Study Discrete Diffusion Language Model Primer for the generation model, Block Diffusion LLM Denoising for block structure, Consistency Distillation Few-Step Diffusion for fewer-step sampling, KV Cache for reuse basics, LLM Continuous Batching for serving queues, and Speculative Decoding Runtime Controller for confidence-gated acceleration.',
      ],
    },
  ],
};
