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
      heading: 'Why this exists',
      paragraphs: [
        'An LLM serving stack can be overloaded even while the GPUs look busy and the request counter looks healthy. Long prompts consume prefill time, active sequences consume KV cache, decode steps stretch inter-token latency, and callers have deadlines. The system needs a front-door decision before an accepted request becomes expensive failed work.',
        'The goal is goodput: useful answers completed before their deadline. Accepted-request count is a weaker metric because an accepted request that times out after prefill has already burned GPU time, KV memory, retrieval work, and retry budget.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A reasonable first design accepts every authenticated request, lets the scheduler queue it, and relies on autoscaling when load rises. A slightly better version sets a global max queue length or max concurrent request count. That works when requests are similar, deadlines are loose, and new capacity arrives quickly.',
        'LLM traffic violates those assumptions. A short chat, a 128k-token agent request, an eval replay, and abusive scripted traffic can share the same endpoint while placing very different pressure on prefill, decode, KV cache, and user-facing latency.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Accept-all fails at the overload knee. Queue age grows, request deadlines expire, KV blocks fill, long prefill work delays decode, and clients retry. The server can spend its best GPU minutes on requests whose callers have already given up.',
        'Autoscaling does not remove the need for admission. Ray Serve exposes request timeouts and autoscaling controls, including ongoing requests per replica and load testing for latency-sensitive services, but new replicas still need placement, startup, model load, and readiness time: https://docs.ray.io/en/latest/serve/advanced-guides/performance.html and https://docs.ray.io/en/latest/serve/advanced-guides/advanced-autoscaling.html.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Admission control works when each request gets a small resource-and-deadline record before it enters the expensive queue. The record estimates prompt tokens, output cap, cached-prefix chance, KV bytes, request class, queue age, deadline slack, route options, brownout eligibility, retry policy, and shed reason.',
        'The invariant is simple: admit only work that still has a plausible path to a useful answer. Defer work that can wait. Degrade work that has an approved cheaper route. Reject work whose best path already misses the contract.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Inspect the gate as a resource estimate plus a policy decision. The estimate says how much prefill, decode, KV memory, queue time, and deadline slack the request needs. The policy says which classes may be admitted, degraded, deferred, or rejected under current load.',
        'The request ledger should record the decision and the reason: admitted to route A, shortened context, served from cache, sent to smaller model, deferred, rejected with Retry-After, or denied by quota. Without this record, overload behavior becomes invisible and impossible to improve.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'The gate reads live scheduler state and per-class policy. It checks max live sequences, max batched tokens, GPU memory utilization, queue depth, KV pressure, p99, TTFT, inter-token latency, and request deadline slack. vLLM optimization docs make the memory side concrete: changing max_num_seqs or max_num_batched_tokens changes concurrent request pressure and KV cache needs, while chunked prefill fits prefill work around decode token budget: https://docs.vllm.ai/en/stable/configuration/optimization/.',
        'A brownout ladder gives the gate more choices than yes or no. It can use a cached answer, shorten context, skip optional retrieval, route to a smaller model, defer batch work, or return a fast 503 with Retry-After. KServe puts LLM-specific metrics such as KV cache utilization and queue depth into the control plane, which is exactly the kind of signal an admission gate needs: https://kserve.github.io/website/docs/reference/crd-api.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is conservation. GPU time, KV memory, and deadline slack are finite. If a request cannot finish with the remaining resources, accepting it cannot create more capacity; it only competes with requests that can still succeed.',
        'Early rejection is useful because it preserves the scarce resource before it is spent. The gate is not trying to predict the future perfectly. It is keeping impossible or low-priority work from consuming the queue positions, KV blocks, and decode steps needed by viable requests.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Admission control adds estimation work, policy design, telemetry, and false-negative risk. A conservative gate can reject requests that might have succeeded. An aggressive gate can admit too much and collapse back into accept-all behavior.',
        'The expensive part is not the if statement. It is keeping estimates honest under changing model versions, prompt shapes, cache hit rates, priority classes, and retry behavior. The gate needs load tests, per-class dashboards, and an audit ledger so teams can see whether it protected goodput or only moved pain around.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Admission control wins during launch spikes, mixed interactive and batch traffic, tenant priority conflicts, long-context agent bursts, cache-local routing decisions, and brownout events. It is strongest when the service has clear SLOs and multiple legal actions: admit, defer, degrade, reroute, or reject.',
        'LLM Serving Autoscaling Warm Pool continues the same control problem. It separates desired replicas from ready replicas, models warm capacity, cold-start lag, KV-locality loss on new replicas, and the scale-event ledger that tells whether autoscaling protected goodput.',
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        'Admission control is the wrong main tool for offline batch jobs whose only goal is eventual throughput. It also fails when the product has no honest degradation path, no client retry contract, no deadline propagation, or no accurate live view of KV and queue state.',
        'Bad gates can create unfairness. If priority tiers, tenant quotas, and shed reasons are not explicit, the system may quietly protect easy traffic and starve important long requests. The remedy is not to remove the gate; it is to make the policy measurable and reviewable.',
      ],
    },
    {
      heading: 'How it works (3)',
      paragraphs: [
        'Track admitted, degraded, deferred, rejected, timed out, and completed requests separately. Also track saved GPU seconds, saved KV blocks, TTFT, inter-token latency, p99, retry rate, queue age, deadline slack at admission, deadline slack at first token, and completion before deadline.',
        'The best gate is tuned near the goodput knee: the point where accepting more work reduces useful completions. Load tests should include retry storms, long-context bursts, cache-miss traffic, tenant priority conflicts, and autoscaling lag. A gate that only works on average traffic is not an overload gate.',
        'Thresholds should be staged through canaries. Start in shadow mode, compare predicted misses with actual misses, then reject only a narrow class with clear Retry-After behavior. A gate that launches at full force without an audit ledger can cause the same customer pain it was meant to prevent.',
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        'LLM admission control is not about being unfriendly to users. It is about refusing to spend scarce GPU and KV capacity on work that cannot satisfy its contract. Early, explainable rejection is often better than late timeout after expensive prefill.',
        'For course design, teach this after backpressure and before autoscaling. Students should see the chain: estimate resource demand, compare it with live capacity and deadline, choose the cheapest acceptable action, and record the reason for audit.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Google SRE Handling Overload at https://sre.google/sre-book/handling-overload/, Google SRE cascading failures at https://sre.google/sre-book/addressing-cascading-failures/, vLLM optimization docs at https://docs.vllm.ai/en/stable/configuration/optimization/, Ray Serve performance docs at https://docs.ray.io/en/latest/serve/advanced-guides/performance.html, Ray Serve advanced autoscaling at https://docs.ray.io/en/latest/serve/advanced-guides/advanced-autoscaling.html, KServe CRD API at https://kserve.github.io/website/docs/reference/crd-api, and Google Cloud LLM inference autoscaling guidance at https://docs.cloud.google.com/kubernetes-engine/docs/best-practices/machine-learning/inference/autoscaling-tpu.',
        'Study Load Shedding & Graceful Degradation for the general overload pattern, Backpressure and Retries with Jitter for client behavior, SLO-Aware LLM Request Router for routing policy, LLM Serving Autoscaling Warm Pool for delayed capacity, Chunked Prefill Token Budget Scheduler for prefill/decode pressure, KV Cache Concurrency Capacity Model for memory limits, Tail Latency & p99 Thinking for SLO math, Feature Flag Control Plane for policy rollout, and LLM Unit Economics Ledger Case Study for cost accounting.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why LLM Serving Admission-Control Goodput Gate moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

