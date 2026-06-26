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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a front door for large language model (LLM) serving. Active nodes are the signals being checked now, compare nodes are choices the gate could take, and found nodes are decisions that preserve useful completions before a service-level objective (SLO) deadline.',
        'The safe inference rule is this: if queue wait plus prefill plus first-token time already exceeds the remaining deadline, admission must not spend GPU memory on that request. The gate can admit, defer, degrade, or reject, but each choice must leave an audit reason.',
        {type: 'callout', text: 'Admission protects goodput by rejecting doomed work before it consumes GPU time and KV memory.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/06/Queueing_node_service_digram.png', alt: 'Diagram of arrivals entering a queueing node with several service positions and one departure path.', caption: 'Simple queueing node diagram by Dt-rush-8, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Goodput means useful work completed before deadline. In LLM serving, a request can consume prefill compute, key-value (KV) cache memory, decode slots, retrieval calls, and client retry budget, then still fail because the user has already timed out.',
        'The system needs admission control because overload is nonlinear. Past the knee, accepting more requests can reduce completed answers by filling queues with work that cannot finish.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to accept every authenticated request and let the scheduler sort it out. That feels fair because every caller enters the same queue, and autoscaling can add replicas when demand rises.',
        'This works while prompts are short, output lengths are similar, cache pressure is low, and deadlines are loose. It fails when one long request can hold more KV memory than many short chats.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is deadline waste. Once queue age exceeds the caller budget, the server is spending GPU time on work whose result will be ignored.',
        'Retries make the wall steeper. A late answer causes the client to retry, which creates more arrivals, which increases queue age, which turns more accepted requests into wasted prefill.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Admission control treats every request as a small resource contract before it enters expensive scheduling. The contract estimates prompt tokens, output cap, KV bytes, cache hit chance, priority class, current queue age, and deadline slack.',
        'The invariant is that admitted work must still have a plausible path to a useful answer. The gate protects the scarce resource that would otherwise be spent first and understood later.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The gateway computes an admission score from live scheduler state and request metadata. It checks max live sequences, max batched tokens, KV utilization, time to first token, inter-token latency, queue age, and deadline slack.',
        'A policy layer maps that score to action. High-priority short work may run now, batch work may wait, long-context work may be routed to a cache-local replica, and doomed work may receive a fast 503 with Retry-After.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is conservation of deadline and memory. Accepting a request cannot create more KV blocks or more time before the caller gives up.',
        'If a request is certain to miss deadline under current state, rejecting it cannot reduce goodput. It preserves queue positions, KV blocks, and decode steps for requests whose completion is still possible.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The if statement is cheap; the estimates are not. The team pays for token estimation, per-class policy, load tests, deadline propagation, queue telemetry, and an audit ledger that records every admit, degrade, defer, reject, timeout, and completion.',
        'Cost behaves as a control loop. A strict gate can reject work that might have succeeded, while a loose gate collapses into accept-all and pays for late failures.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Admission control fits mixed LLM platforms with interactive chat, agents, eval jobs, batch summarization, abuse traffic, and enterprise priority tiers. The same GPU pool serves requests with different deadlines and different damage from failure.',
        'It also fits brownout systems. The product may allow cached answers, smaller models, shorter context, delayed batch execution, or explicit rejection for some classes but not for others.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Admission fails when the system has no trustworthy live state. If KV pressure, queue age, deadlines, cache hit rate, or retry behavior are invisible, the gate becomes a guess dressed as policy.',
        'It is also weak for offline batch work where eventual throughput matters more than deadline. In that case, queuing and cheaper scheduling may be better than early rejection.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a chat route has a 2 second first-token SLO. Current queue age is 900 ms, estimated prefill is 700 ms, route overhead is 150 ms, and safety margin is 200 ms, so the request needs 1950 ms before the first token.',
        'A request with 2000 ms remaining can be admitted with little slack, but a request with 1400 ms remaining should be rejected or degraded before prefill. If 100 such doomed requests would each spend 700 ms of GPU prefill, early rejection saves 70 GPU-seconds for work that can still complete.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Google SRE Handling Overload at https://sre.google/sre-book/handling-overload/, vLLM optimization docs at https://docs.vllm.ai/en/stable/configuration/optimization/, Ray Serve autoscaling docs at https://docs.ray.io/en/latest/serve/advanced-guides/advanced-autoscaling.html, and KServe LLM metrics in the CRD docs at https://kserve.github.io/website/docs/reference/crd-api.',
        'Next, study Backpressure and Retries with Jitter, Load Shedding and Graceful Degradation, SLO-Aware LLM Request Router, KV Cache Concurrency Capacity Model, LLM Serving Autoscaling Warm Pool, Tail Latency and p99 Thinking, and LLM Unit Economics Ledger.',
      ],
    },
  ],
};