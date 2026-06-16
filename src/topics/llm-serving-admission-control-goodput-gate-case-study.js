// LLM admission control: reject, defer, or degrade work before token queues
// and KV memory turn accepted requests into missed deadlines.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-serving-admission-control-goodput-gate-case-study',
  title: 'LLM Serving Admission-Control Goodput Gate',
  category: 'Systems',
  summary: 'An LLM overload case study: token-budget admission, KV pressure, queue age, deadlines, priority shedding, brownout routes, autoscaling signals, and goodput audits.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['admission gate', 'shed ladder', 'goodput audit'], defaultValue: 'admission gate' },
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

function gateGraph(title) {
  return graphState({
    nodes: [
      { id: 'ing', label: 'ing', x: 0.6, y: 3.5, note: 'req' },
      { id: 'class', label: 'class', x: 2.0, y: 3.5, note: 'SLO' },
      { id: 'tok', label: 'tokens', x: 3.6, y: 1.4, note: 'budget' },
      { id: 'kv', label: 'KV', x: 3.6, y: 3.0, note: 'HBM' },
      { id: 'age', label: 'age', x: 3.6, y: 4.6, note: 'queue' },
      { id: 'ddl', label: 'ddl', x: 3.6, y: 6.0, note: 'left' },
      { id: 'gate', label: 'gate', x: 5.4, y: 3.5, note: 'score' },
      { id: 'admit', label: 'admit', x: 7.1, y: 1.8, note: 'run' },
      { id: 'defer', label: 'defer', x: 7.1, y: 3.5, note: 'wait' },
      { id: 'shed', label: 'shed', x: 7.1, y: 5.2, note: '503' },
      { id: 'span', label: 'span', x: 8.8, y: 3.5, note: 'audit' },
    ],
    edges: [
      { id: 'e-ing-class', from: 'ing', to: 'class' },
      { id: 'e-class-tok', from: 'class', to: 'tok' },
      { id: 'e-class-kv', from: 'class', to: 'kv' },
      { id: 'e-class-age', from: 'class', to: 'age' },
      { id: 'e-class-ddl', from: 'class', to: 'ddl' },
      { id: 'e-tok-gate', from: 'tok', to: 'gate' },
      { id: 'e-kv-gate', from: 'kv', to: 'gate' },
      { id: 'e-age-gate', from: 'age', to: 'gate' },
      { id: 'e-ddl-gate', from: 'ddl', to: 'gate' },
      { id: 'e-gate-admit', from: 'gate', to: 'admit' },
      { id: 'e-gate-defer', from: 'gate', to: 'defer' },
      { id: 'e-gate-shed', from: 'gate', to: 'shed' },
      { id: 'e-admit-span', from: 'admit', to: 'span' },
      { id: 'e-defer-span', from: 'defer', to: 'span' },
      { id: 'e-shed-span', from: 'shed', to: 'span' },
    ],
  }, { title });
}

function brownoutGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'req', x: 0.7, y: 3.5, note: 'SLO' },
      { id: 'full', label: 'full', x: 2.5, y: 1.4, note: 'best' },
      { id: 'cache', label: 'cache', x: 2.5, y: 3.0, note: 'reuse' },
      { id: 'small', label: 'small', x: 2.5, y: 4.6, note: 'cheap' },
      { id: 'deny', label: 'deny', x: 2.5, y: 6.0, note: 'fast' },
      { id: 'policy', label: 'policy', x: 4.6, y: 3.5, note: 'tier' },
      { id: 'serve', label: 'serve', x: 6.6, y: 2.2, note: 'ok' },
      { id: 'retry', label: 'retry', x: 6.6, y: 4.8, note: 'after' },
      { id: 'span', label: 'span', x: 8.4, y: 3.5, note: 'why' },
    ],
    edges: [
      { id: 'e-req-full', from: 'req', to: 'full' },
      { id: 'e-req-cache', from: 'req', to: 'cache' },
      { id: 'e-req-small', from: 'req', to: 'small' },
      { id: 'e-req-deny', from: 'req', to: 'deny' },
      { id: 'e-full-policy', from: 'full', to: 'policy' },
      { id: 'e-cache-policy', from: 'cache', to: 'policy' },
      { id: 'e-small-policy', from: 'small', to: 'policy' },
      { id: 'e-deny-policy', from: 'deny', to: 'policy' },
      { id: 'e-policy-serve', from: 'policy', to: 'serve' },
      { id: 'e-policy-retry', from: 'policy', to: 'retry' },
      { id: 'e-serve-span', from: 'serve', to: 'span' },
      { id: 'e-retry-span', from: 'retry', to: 'span' },
    ],
  }, { title });
}

function goodputPlot(markers = []) {
  return plotState({
    axes: { x: { label: 'demand %', min: 0, max: 180 }, y: { label: 'goodput %', min: 0, max: 110 } },
    series: [
      { id: 'accept', label: 'accept all', points: [{ x: 40, y: 40 }, { x: 80, y: 80 }, { x: 100, y: 95 }, { x: 120, y: 65 }, { x: 160, y: 15 }, { x: 180, y: 0 }] },
      { id: 'gate', label: 'gate', points: [{ x: 40, y: 40 }, { x: 80, y: 80 }, { x: 100, y: 98 }, { x: 120, y: 98 }, { x: 160, y: 96 }, { x: 180, y: 94 }] },
      { id: 'brown', label: 'brownout', points: [{ x: 40, y: 40 }, { x: 80, y: 82 }, { x: 100, y: 100 }, { x: 120, y: 105 }, { x: 160, y: 108 }, { x: 180, y: 104 }] },
    ],
    markers,
  });
}

function* admissionGate() {
  yield {
    state: gateGraph('Admission asks whether yes can still succeed'),
    highlight: { active: ['ing', 'class', 'tok', 'kv', 'age', 'ddl', 'gate', 'e-ing-class'], compare: ['admit', 'defer', 'shed'] },
    explanation: 'An LLM front door should decide whether a request can still meet its latency and memory contract before it enters expensive prefill or decode queues.',
  };

  yield {
    state: labelMatrix(
      'Admission record',
      [
        { id: 'chat', label: 'chat' },
        { id: 'agent', label: 'agent' },
        { id: 'batch', label: 'batch' },
        { id: 'huge', label: 'huge' },
        { id: 'late', label: 'late' },
      ],
      [
        { id: 'tokens', label: 'tokens' },
        { id: 'kv', label: 'KV' },
        { id: 'ddl', label: 'ddl' },
        { id: 'act', label: 'act' },
      ],
      [
        ['small', 'ok', '200ms', 'admit'],
        ['long', 'hit', '2s', 'route'],
        ['many', 'ok', 'loose', 'defer'],
        ['128k', 'tight', 'risk', 'split'],
        ['any', 'any', 'gone', 'shed'],
      ],
    ),
    highlight: { active: ['chat:act', 'agent:act', 'late:act'], compare: ['huge:kv'], found: ['batch:act'] },
    explanation: 'The gate should bind request class, estimated tokens, KV pressure, and remaining deadline. A request that cannot finish before the caller times out is funeral work and should be rejected or degraded quickly.',
    invariant: 'Optimize goodput: completed useful answers before deadline, not accepted requests.',
  };

  yield {
    state: goodputPlot([
      { id: 'knee', x: 105, y: 96, label: 'knee' },
      { id: 'fall', x: 160, y: 15, label: 'collapse' },
    ]),
    highlight: { active: ['gate', 'brown', 'knee'], removed: ['accept', 'fall'] },
    explanation: 'Accept-all looks kind until overload. Once queues exceed deadlines, the server spends GPU time on requests whose callers have already left. Admission preserves goodput by saying no early.',
  };

  yield {
    state: labelMatrix(
      'Serving knobs',
      [
        { id: 'seqs', label: 'seqs' },
        { id: 'tokens', label: 'tokens' },
        { id: 'hbm', label: 'HBM' },
        { id: 'chunk', label: 'chunk' },
        { id: 'timeout', label: 'timeout' },
      ],
      [
        { id: 'knob', label: 'knob' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['max seqs', 'KV OOM'],
        ['max toks', 'stall'],
        ['util cap', 'no room'],
        ['prefill', 'ITL gap'],
        ['req ddl', 'waste'],
      ],
    ),
    highlight: { active: ['seqs:knob', 'tokens:knob', 'timeout:knob'], found: ['chunk:knob'], compare: ['hbm:risk'] },
    explanation: 'vLLM-style scheduler knobs, request timeouts, and GPU memory caps are admission signals. Bigger batches can raise throughput but also consume KV memory and deadline budget.',
  };

  yield {
    state: gateGraph('Autoscaling is slower than admission'),
    highlight: { active: ['age', 'kv', 'gate', 'defer', 'span', 'e-age-gate', 'e-kv-gate', 'e-defer-span'], compare: ['shed'], found: ['admit'] },
    explanation: 'Autoscaling should read queue depth, KV utilization, and latency signals, but new capacity arrives later. Admission and shedding cover the minutes before the autoscaler catches up.',
  };
}

function* shedLadder() {
  yield {
    state: labelMatrix(
      'Shed order',
      [
        { id: 'abuse', label: 'abuse' },
        { id: 'batch', label: 'batch' },
        { id: 'eval', label: 'eval' },
        { id: 'chat', label: 'chat' },
        { id: 'vip', label: 'vip' },
      ],
      [
        { id: 'drop', label: 'drop at' },
        { id: 'why', label: 'why' },
      ],
      [
        ['early', 'bad'],
        ['high q', 'loose SLO'],
        ['burn', 'can wait'],
        ['last', 'user'],
        ['never', 'contract'],
      ],
    ),
    highlight: { active: ['abuse:drop', 'batch:drop', 'eval:drop'], found: ['chat:drop'], compare: ['vip:drop'] },
    explanation: 'LLM shedding should be priority-aware. Batch and eval traffic can wait or retry. Interactive and contractual traffic should be protected until cheaper classes are exhausted.',
  };

  yield {
    state: brownoutGraph('Brownout makes each request cheaper'),
    highlight: { active: ['req', 'cache', 'small', 'deny', 'policy', 'e-req-cache', 'e-req-small', 'e-req-deny'], compare: ['full'], found: ['serve', 'retry'] },
    explanation: 'Brownout is not just rejection. A request can use a cached answer, shorter context, smaller model, reduced retrieval, or fast 503 with Retry-After depending on class and load.',
  };

  yield {
    state: labelMatrix(
      'Degrade ladder',
      [
        { id: 'full', label: 'full' },
        { id: 'ctx', label: 'short ctx' },
        { id: 'cache', label: 'cache' },
        { id: 'small', label: 'small' },
        { id: 'deny', label: 'deny' },
      ],
      [
        { id: 'saves', label: 'saves' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['none', 'normal'],
        ['prefill', 'quality'],
        ['tokens', 'fresh'],
        ['GPU', 'eval'],
        ['all', 'retry'],
      ],
    ),
    highlight: { active: ['ctx:saves', 'cache:saves', 'small:saves', 'deny:saves'], compare: ['full:guard'] },
    explanation: 'The ladder should be explicit. Shorter context saves prefill and KV, response cache saves model work, smaller models save GPU, and denial saves everything when no route can satisfy the deadline.',
  };

  yield {
    state: goodputPlot([
      { id: 'brownpt', x: 145, y: 108, label: 'brown' },
      { id: 'no', x: 145, y: 30, label: 'no gate' },
    ]),
    highlight: { active: ['brown', 'brownpt'], compare: ['gate'], removed: ['accept', 'no'] },
    explanation: 'Degradation can preserve more useful work than binary shedding, but only if the degraded answer is allowed for that request class and clearly recorded in the route ledger.',
  };

  yield {
    state: labelMatrix(
      'Client contract',
      [
        { id: 'retry', label: 'retry' },
        { id: 'idemp', label: 'idemp' },
        { id: 'quota', label: 'quota' },
        { id: 'jitter', label: 'jitter' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['after', 'pace'],
        ['key', 'safe redo'],
        ['limit', 'fair'],
        ['spread', 'no herd'],
      ],
    ),
    highlight: { active: ['retry:field', 'idemp:field', 'jitter:why'], found: ['quota:field'] },
    explanation: 'A shed response is part of a protocol. Retry-After, idempotency keys, quota state, and jitter guidance keep clients from turning overload into a retry storm.',
  };
}

function* goodputAudit() {
  yield {
    state: labelMatrix(
      'Audit rows',
      [
        { id: 'admit', label: 'admit' },
        { id: 'defer', label: 'defer' },
        { id: 'shed', label: 'shed' },
        { id: 'timeout', label: 'timeout' },
        { id: 'done', label: 'done' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'metric', label: 'metric' },
      ],
      [
        ['route id', 'TTFT'],
        ['queue', 'age'],
        ['reason', 'saved'],
        ['deadline', 'waste'],
        ['answer', 'goodput'],
      ],
    ),
    highlight: { active: ['shed:field', 'timeout:metric', 'done:metric'], found: ['admit:metric'] },
    explanation: 'Goodput requires a ledger. Count admitted, deferred, shed, timed out, and completed requests separately. A timeout after expensive prefill is worse than an early 503.',
  };

  yield {
    state: gateGraph('Deadlines should travel with the request'),
    highlight: { active: ['ddl', 'gate', 'shed', 'span', 'e-ddl-gate', 'e-gate-shed', 'e-shed-span'], compare: ['admit', 'defer'] },
    explanation: 'A request deadline should follow the request through routing and scheduling. If the remaining time cannot cover queue wait, prefill, and first-token latency, admission should reject before spending GPU time.',
  };

  yield {
    state: labelMatrix(
      'Protected metrics',
      [
        { id: 'ttft', label: 'TTFT' },
        { id: 'itl', label: 'ITL' },
        { id: 'p99', label: 'p99' },
        { id: 'oom', label: 'OOM' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'watch', label: 'watch' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['first tok', 'SLO'],
        ['stream', 'safe'],
        ['tail', 'burn'],
        ['KV full', 'deny'],
        ['$/task', 'down'],
      ],
    ),
    highlight: { active: ['ttft:gate', 'itl:gate', 'p99:gate', 'oom:gate'], compare: ['cost:gate'] },
    explanation: 'The gate should protect first-token latency, inter-token latency, p99, KV capacity, and cost per accepted task together. Improving one metric while burning another is not a win.',
  };

  yield {
    state: goodputPlot([
      { id: 'target', x: 125, y: 98, label: 'target' },
    ]),
    highlight: { active: ['gate', 'target'], compare: ['brown'], removed: ['accept'] },
    explanation: 'The admission threshold should sit near the goodput knee. Past that point, accepted-request rate can rise while useful completions fall because too much work misses deadline.',
  };

  yield {
    state: labelMatrix(
      'Ship checklist',
      [
        { id: 'cap', label: 'caps' },
        { id: 'class', label: 'class' },
        { id: 'retry', label: 'retry' },
        { id: 'auto', label: 'scale' },
        { id: 'canary', label: 'canary' },
      ],
      [
        { id: 'gate', label: 'gate' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['tok/KV', 'load'],
        ['tiers', 'p99'],
        ['jit', 'storm'],
        ['q+KV', 'lag ok'],
        ['small %', 'roll'],
      ],
    ),
    highlight: { active: ['cap:gate', 'class:gate', 'retry:gate', 'canary:proof'], found: ['auto:proof'] },
    explanation: 'Before shipping, load test token and KV caps, slice metrics by request class, simulate retry storms, verify autoscaling lag, canary thresholds, and keep rollback simple.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'admission gate') yield* admissionGate();
  else if (view === 'shed ladder') yield* shedLadder();
  else if (view === 'goodput audit') yield* goodputAudit();
  else throw new InputError('Pick an LLM admission-control view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An LLM serving admission-control goodput gate decides whether to admit, defer, degrade, or reject a request before the serving stack spends expensive GPU time. The goal is goodput: useful answers completed before deadline, not a high count of accepted requests.',
        'Generic Load Shedding & Graceful Degradation already explains why unbounded queues collapse. This case study adds LLM-specific state: input and output token estimates, KV cache pressure, prefill/decode interference, queue age, cache locality, request deadline, and model-route fallback.',
      ],
    },
    {
      heading: 'Core data structures',
      paragraphs: [
        'The gate stores an admission record for each request: request class, deadline, estimated prompt tokens, requested max output tokens, cached-prefix estimate, KV bytes, queue age, selected route, brownout eligibility, idempotency key, retry policy, and shed reason. The fleet stores caps for max live sequences, max batched tokens, GPU memory utilization, queue depth, and per-class in-flight limits.',
        'vLLM optimization docs make the memory side explicit: decreasing max_num_seqs or max_num_batched_tokens reduces concurrent requests in a batch and requires less KV cache space, while chunked prefill schedules pending decode first and then fits prefill into the remaining token budget: https://docs.vllm.ai/en/stable/configuration/optimization/.',
      ],
    },
    {
      heading: 'Admission and autoscaling',
      paragraphs: [
        'Ray Serve exposes request timeout and autoscaling controls around ongoing requests per replica. Its performance guide documents request_timeout_s for end-to-end HTTP timeout behavior: https://docs.ray.io/en/latest/serve/advanced-guides/performance.html. Its advanced autoscaling guide emphasizes target ongoing requests per replica and load testing latency-sensitive workloads: https://docs.ray.io/en/latest/serve/advanced-guides/advanced-autoscaling.html.',
        'LLM Serving Autoscaling Warm Pool continues this section: it separates desired replicas from ready replicas, models warm capacity, cold-start lag, KV-locality loss on new replicas, and the scale-event ledger that tells whether autoscaling protected goodput.',
        'KServe LLMInferenceService and its control-plane API put LLM-specific metrics into the serving control plane. The Workload Variant Autoscaler can scale based on inference metrics such as KV cache utilization and queue depth rather than ordinary CPU or memory metrics: https://kserve.github.io/website/docs/reference/crd-api. Autoscaling helps, but admission still has to survive the delay before new capacity is ready.',
      ],
    },
    {
      heading: 'Complete case study: product traffic spike',
      paragraphs: [
        'A product launch sends a burst of short chat, long agent, batch summarization, eval replay, and abusive scripted traffic to the same model. The gate admits interactive chats while their first-token budget is still viable, routes long agents toward cache hits or prefill/decode pools, defers batch work, sheds eval replay, and denies abusive requests early. If pressure keeps rising, brownout shortens context, tries semantic or prompt cache paths, routes low-risk requests to a smaller model, and finally returns a fast 503 with Retry-After.',
        'The goodput ledger shows the difference. Accept-all looked generous but produced many timeouts after prefill. The gate completed fewer raw requests but more useful answers before deadline, with lower p99 and lower GPU waste. The audit rows explain every admit, defer, shed, timeout, and completed answer by request class.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not shed after expensive work. Rejection after tokenization, retrieval, auth, or prefill has already spent the capacity you meant to protect. Do not shed by CPU alone; queue depth, p99, KV utilization, and deadline slack move earlier. Do not optimize acceptance rate. A request accepted into a queue it cannot escape before timeout is not success.',
        'Primary sources: Google SRE Handling Overload at https://sre.google/sre-book/handling-overload/, Google SRE cascading failures at https://sre.google/sre-book/addressing-cascading-failures/, vLLM optimization docs at https://docs.vllm.ai/en/stable/configuration/optimization/, Ray Serve performance docs at https://docs.ray.io/en/latest/serve/advanced-guides/performance.html, Ray Serve advanced autoscaling at https://docs.ray.io/en/latest/serve/advanced-guides/advanced-autoscaling.html, KServe CRD API at https://kserve.github.io/website/docs/reference/crd-api, and Google Cloud LLM inference autoscaling guidance at https://docs.cloud.google.com/kubernetes-engine/docs/best-practices/machine-learning/inference/autoscaling-tpu. Study Load Shedding & Graceful Degradation, Backpressure, Retries with Jitter, SLO-Aware LLM Request Router, LLM Serving Autoscaling Warm Pool, Chunked Prefill Token Budget Scheduler, KV Cache Concurrency Capacity Model, Tail Latency & p99 Thinking, Feature Flag Control Plane, and LLM Unit Economics Ledger Case Study next.',
      ],
    },
  ],
};
