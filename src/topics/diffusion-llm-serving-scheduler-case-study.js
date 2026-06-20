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
        'The animation has two views, selected by the control above the canvas.',
        {
          type: 'bullets',
          items: [
            'Step batching view: a directed graph from API ingress through shape classification, step bucketing, cache lookup, GPU batch, confidence gate, optional fallback, and token streaming. Active (highlighted) nodes are the current scheduling stage. Compare nodes show cache or alternative paths. Found nodes are confirmed outputs.',
            'Confidence gate view: a matrix where each row is a token position and columns show the top prediction, its confidence score, and the commit/hold/fallback action. Active cells are committed tokens. Compare cells are held positions waiting for another denoise pass.',
          ],
        },
        'In both views, the ready-queue matrix groups requests by denoise step, mask count, block size, and route assignment. Rows sharing a route color can batch together on the GPU.',
        {
          type: 'note',
          text: 'The animation uses small integer step counts and short token sequences for readability. Production diffusion servers handle hundreds of concurrent requests with 8-64 denoise steps, variable block sizes, and per-route confidence policies. The scheduling structure is the same -- the fields and thresholds scale.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Autoregressive LLM serving has one shape: prefill the prompt, then decode one token at a time. Every piece of infrastructure -- continuous batching, KV cache, speculative decoding, SLO routing -- is organized around that sequential decode loop.',
        'Diffusion LLMs break the shape. Instead of predicting the next token, a diffusion model starts with a masked buffer and iteratively denoises it, potentially committing multiple tokens per pass. That changes what a "batch" means, what can be cached, and when output is safe to stream.',
        {
          type: 'quote',
          text: 'Fast-dLLM proposes a training-free approach to accelerate diffusion language models by identifying tokens with high confidence scores for skipping unnecessary denoising steps.',
          attribution: 'Wu et al., "Fast-dLLM: Training-free Acceleration of Diffusion LLM" (2025)',
        },
        'The scheduler is the missing piece between a research decoder and a production service. It decides which requests can share a GPU batch, which hidden state is safe to reuse, which tokens are confident enough to commit, and when the system should fall back to a slower but safer route.',
        'Without a shape-aware scheduler, diffusion decoding is a model-side promise. The service must make that promise survive mixed traffic, noisy confidence estimates, memory pressure, and user-facing latency targets.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is to reuse an autoregressive serving stack: vLLM-style continuous batching, paged KV cache, arrival-order queues, and a prefill/decode split. Teams reach for this because the infrastructure is mature, well-tested, and already deployed.',
        {
          type: 'diagram',
          text: 'Autoregressive server:\n  Queue -> Prefill -> Decode (1 token/step) -> Stream\n  Cache key: left-to-right prefix\n  Batch key: arrival order + sequence length\n\nDiffusion server (naive reuse):\n  Queue -> Denoise pass -> ??? -> Stream\n  Cache key: ??? (prefix is not stable)\n  Batch key: ??? (step count varies per request)',
          label: 'AR infrastructure assumes a shape diffusion serving does not have',
        },
        'This reuse works for ingress, load balancing, and health checks. It breaks at the scheduling layer because the batch key, cache key, and streaming trigger are all wrong for bidirectional denoising.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Naive batching fails because two requests with the same output length can be in completely different denoise phases. One has forty masked positions left, another has five, and a third is waiting on a high-confidence commit. Batching them wastes GPU cycles: the fast request pads while the slow one blocks.',
        {
          type: 'table',
          headers: ['Problem', 'AR assumption', 'Diffusion reality'],
          rows: [
            ['Batch grouping', 'Group by sequence length', 'Must group by denoise step, mask count, and block size'],
            ['Cache validity', 'Left-to-right prefix is stable', 'Bidirectional denoising changes which positions are visible; cache versions drift'],
            ['Streaming trigger', 'Each decoded token streams immediately', 'Tokens must pass a confidence gate before commit'],
            ['Fallback', 'Retry or timeout', 'Multiple fallback routes: fewer parallel tokens, teacher sampler, AR model, rejection'],
            ['SLO metric', 'Time to last token', 'Accepted-answer latency (tokens that pass the gate, not tokens generated)'],
          ],
        },
        'The exact wall is p99 under heterogeneous traffic. A benchmark with uniform prompts shows high throughput. A production mix -- code completion, JSON, chat, long prompts, remask loops, and fallbacks -- loses the speedup unless the scheduler preserves compatible work shapes.',
        'There is also a product wall. Users do not experience denoise steps per second. They experience first-useful-token time, accepted-answer latency, formatting errors, retry storms, and whether a completion is stable enough to stream progressively.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The scheduling key is not arrival time or sequence length. It is a composite of denoise state fields that determine GPU batch compatibility.',
        {
          type: 'code',
          language: 'text',
          text: 'request = {\n  prompt, token_buffer, mask_bitset, block_id,\n  denoise_step, remaining_mask_count,\n  route_id, deadline, confidence_threshold,\n  cache_version, fallback_budget, quality_guard\n}',
        },
        'Two requests batch cleanly when they share enough of these fields that one GPU pass advances both without forcing bad commits or wasting work on padding. The invariant is shape compatibility: a batch is healthy when its members share denoise state.',
        {
          type: 'diagram',
          text: 'Ready queues (keyed by shape):\n  [step=6, blk=4, mask~18] -> req1, req2       -> Batch A\n  [step=2, blk=8, mask~41] -> req3              -> Batch B\n  [step=6, blk=4, mask~5 ] -> req4              -> Finish lane\n\nCache ledger (keyed by version):\n  ctx:prompt_ids   state:block+mask   kv:hidden_state   pages:gpu_mem\n  Each entry valid only under its recorded block state + mask pattern',
          label: 'Shape-keyed queues and version-keyed cache replace arrival-order batching',
        },
        'The monitoring ledger must track accepted output, not just generated tokens: committed tokens per pass, held tokens, remasks, cache hits, fallback triggers, p50/p95/p99 accepted latency, quality checks, and GPU occupancy. Without these fields, the system can optimize a demo metric while hurting user-visible results.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The scheduler has four stages: shape, batch, execute, and gate.',
        {
          type: 'table',
          headers: ['Stage', 'Input', 'Decision', 'Output'],
          rows: [
            ['Shape', 'Raw request', 'Classify task, assign route, set confidence threshold', 'Shaped request with route policy'],
            ['Batch', 'Shaped requests in ready queues', 'Group by denoise step, block size, mask bucket, cache compatibility', 'GPU batch of compatible work'],
            ['Execute', 'GPU batch', 'Run one denoise pass on all requests in the batch', 'Updated token buffers + per-position confidence scores'],
            ['Gate', 'Per-position scores', 'Commit, hold, remask, or fallback per position per request', 'Committed tokens to stream; held tokens back to queue; fallbacks to safer route'],
          ],
        },
        'Shaping happens once at ingress. The router classifies the task -- code completion gets a wide parallel lane (4 tokens/pass), schema-constrained JSON gets a stricter 2-token lane, open chat gets a conservative lane, and risky requests start in fallback or conservative mode.',
        'After the GPU pass, the confidence gate decides position by position. A token above the route threshold commits and streams. A token below threshold holds for another denoise pass. A request that repeatedly fails the gate burns its fallback budget and moves to a safer route.',
        {
          type: 'note',
          text: 'Fallback is part of the design, not an exception handler. The fallback route can be a lower-parallelism diffusion pass, a teacher sampler, an autoregressive model, a schema repair step, or rejection. The scheduler should never let a request sit in a fast lane consuming GPU without producing accepted output.',
        },
        'Cache management adds a fifth concern. A cached hidden state is valid only under the block state, mask pattern, model version, and route policy it was recorded under. If any of those fields drift, the cache entry is approximate at best and must be invalidated or marked for re-verification.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on three properties.',
        {
          type: 'bullets',
          items: [
            'Gate invariant: the fast lane proposes tokens, but only the confidence policy commits them. Speed never bypasses quality.',
            'Cache versioning: a cached hidden state is usable only when the block state, mask pattern, model version, and route policy match. Drift invalidates the entry.',
            'Accepted-output backpressure: SLO health is measured after the gate, not at the queue. A queue can look empty while users wait because too few tokens are accepted.',
          ],
        },
        'The gate invariant is the load-bearing property. Without it, the system commits low-confidence tokens, which causes downstream errors, retry storms, and worse p99 than the autoregressive baseline it was supposed to beat.',
        'SLO safety comes from separating queue health from accepted-output health. A diffusion route that raises raw tokens per second but increases fallback rate, remask loops, or p99 accepted latency is not a production win. The monitoring ledger must distinguish attempted work from accepted work.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Diffusion serving trades serial next-token latency for parallel denoising. The win depends on four factors: tokens safely committed per pass, request shape overlap in the queue, cache reuse rate, and fallback frequency.',
        {
          type: 'table',
          headers: ['Knob', 'Turn up', 'Turn down'],
          rows: [
            ['Step buckets', 'Better batch compatibility, less padding waste', 'More queue fragmentation, slower batch fill'],
            ['Confidence threshold', 'Higher quality, fewer retries', 'Lower throughput, more holds and remasks'],
            ['Block size', 'More tokens per pass, higher GPU utilization', 'More memory per request, harder cache reuse'],
            ['Fallback budget', 'More chances to recover on the fast path', 'More GPU spent on requests that eventually fall back anyway'],
          ],
        },
        'Memory moves in unfamiliar ways. A diffusion server stores prompt state, block state, approximate hidden state, and mask-version metadata -- not just a left-to-right prefix cache. Eviction policy must account for correctness of reuse, not just recency.',
        {
          type: 'note',
          text: 'The practical comparison is not average tokens per second. Compare diffusion vs. AR serving on accepted-answer latency, p99, cost per accepted output, quality score, fallback rate, memory pressure, cache hit rate, and operational complexity.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace two code-completion requests through the scheduler.',
        {
          type: 'code',
          language: 'text',
          text: 'Step 1 -- Ingress and shaping\n  req A: code completion, 128 tokens, route=fast-4, threshold=0.80\n  req B: code completion, 96 tokens,  route=fast-4, threshold=0.80\n  Both classified as predictable code; assigned to 4-token parallel lane.\n\nStep 2 -- Bucketing\n  req A: step=6, blk=4, mask_count=18\n  req B: step=6, blk=4, mask_count=17\n  Same step, same block size, similar mask count -> Batch A.\n\nStep 3 -- GPU denoise pass\n  Batch A runs one denoise pass on both requests.\n  req A positions [3,7,11,14]: confidences [0.91, 0.74, 0.96, 0.82]\n  req B positions [2,5,9,12]:  confidences [0.88, 0.63, 0.93, 0.71]\n\nStep 4 -- Confidence gate (threshold = 0.80)\n  req A: commit pos 3 (0.91), hold pos 7 (0.74), commit pos 11 (0.96), commit pos 14 (0.82)\n         -> 3 committed, 1 held, mask_count drops 18->15\n  req B: commit pos 2 (0.88), hold pos 5 (0.63), commit pos 9 (0.93), hold pos 12 (0.71)\n         -> 2 committed, 2 held, mask_count drops 17->15\n\nStep 5 -- Re-queue\n  Both requests return to the step=6, blk=4 bucket with updated masks.\n  Cache entries versioned to current block+mask state.\n  Committed tokens stream to clients.',
        },
        'After four more passes, req A finishes (mask_count reaches 0) and exits. Req B hits a low-confidence region, fails the gate three times, burns its fallback budget, and the scheduler moves it to the conservative 1-token lane. The ledger records: 3 fast commits, 2 holds, 1 fallback with reason "repeated gate failure at positions 5,12."',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Diffusion serving fits workloads where multiple positions can be predicted with high confidence.',
        {
          type: 'table',
          headers: ['Workload', 'Parallel lane', 'Gate policy', 'Why it fits'],
          rows: [
            ['Code completion', '4 tokens/pass', 'threshold 0.80', 'Syntax and variable names are highly predictable from context'],
            ['Fill-in-the-middle', '4 tokens/pass', 'threshold 0.78', 'Surrounding code constrains the fill; high confidence on boilerplate'],
            ['Schema-constrained JSON', '2 tokens/pass', 'threshold 0.85 + schema validation', 'Structure is fixed; wrong braces/commas are caught immediately'],
            ['Boilerplate transforms', '4 tokens/pass', 'threshold 0.75', 'Pattern repetition makes most tokens near-certain'],
            ['Open-ended chat', '1 token/pass', 'threshold 0.90', 'Low predictability; conservative lane avoids quality loss'],
          ],
        },
        'The route is chosen per request, not per model. The same diffusion model behaves differently across task shapes. A coding API uses the parallel lane for predictable completions and the conservative lane for ambiguous prompts, adjusting at ingress based on task classification.',
        {
          type: 'quote',
          text: 'Mercury achieves 10x generation throughput compared to an autoregressive counterpart of similar quality, demonstrating diffusion models as a viable alternative for powering LLM applications.',
          attribution: 'Inception Labs, "Mercury: Ultra-Fast Language Models Based on Diffusion" (2025)',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Average throughput hides the failure. Step skew, remask loops, memory fragmentation, route starvation, and fallback storms can degrade p99 while the dashboard shows more generated tokens.',
            'A global confidence threshold is usually wrong. Code, JSON, chat, retrieval answers, and safety-sensitive requests have different costs for a bad commit. The threshold belongs to the route, calibrated against accepted-output quality.',
            'AR infrastructure transfers as concepts, not drop-in machinery. KV cache, continuous batching, and speculative decoding are useful references, but diffusion serving needs mask-aware queues, block-versioned caches, and confidence-gated commit rules.',
            'Cache staleness is silent. A stale approximate hidden state makes the server fast while quietly damaging quality. Without version-keyed cache invalidation, quality regressions appear only in downstream metrics.',
            'Operational complexity is higher. The scheduler introduces more knobs (step buckets, block sizes, per-route thresholds, fallback budgets), more failure modes (gate storms, cache version drift, route starvation), and more monitoring requirements than an AR stack.',
          ],
        },
        {
          type: 'note',
          text: 'The most dangerous failure mode is "fast but wrong." A diffusion server that commits low-confidence tokens to hit throughput targets creates downstream repair work, user-visible errors, and retry storms that cost more than the speedup saved.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Fast-dLLM (arxiv.org/abs/2505.22618)', 'Training-free acceleration via confidence-based step skipping; the technique that makes per-token gating practical'],
            ['Mercury (arxiv.org/html/2506.17298v1)', 'Production diffusion LLM achieving 10x throughput over AR baselines; validates the serving model at scale'],
            ['Block Diffusion (arxiv.org/abs/2503.09573)', 'Block-level denoising that defines the block structure this scheduler batches around'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Discrete Diffusion Language Model Primer for the generation model and KV Cache for reuse fundamentals.',
            'Extension: study Block Diffusion LLM Denoising for block structure and Consistency Distillation Few-Step Diffusion for reducing step count.',
            'Related systems: study LLM Continuous Batching for AR serving queues and Speculative Decoding Runtime Controller for confidence-gated acceleration in AR systems.',
          ],
        },
      ],
    },
  ],
};

