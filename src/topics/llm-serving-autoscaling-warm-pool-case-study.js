// LLM serving autoscaling: warm enough capacity before cold-start lag turns
// useful requests into missed deadlines.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-serving-autoscaling-warm-pool-case-study',
  title: 'LLM Serving Autoscaling Warm Pool',
  category: 'Systems',
  summary: 'An LLM serving case study for autoscaling lag: metrics, warm replicas, model load time, cold KV caches, scale-to-zero tradeoffs, and SLO-aware capacity audits.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lag math', 'warm pool', 'scale audit'], defaultValue: 'lag math' },
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

function scaleGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'load', label: 'load', x: 0.7, y: 3.5, note: notes.load ?? 'reqs' },
      { id: 'metrics', label: 'metrics', x: 2.3, y: 3.5, note: notes.metrics ?? 'q+KV' },
      { id: 'policy', label: 'policy', x: 3.9, y: 3.5, note: notes.policy ?? 'target' },
      { id: 'node', label: 'node', x: 5.5, y: 2.0, note: notes.node ?? 'GPU' },
      { id: 'pull', label: 'pull', x: 5.5, y: 3.5, note: notes.pull ?? 'image' },
      { id: 'model', label: 'model', x: 5.5, y: 5.0, note: notes.model ?? 'load' },
      { id: 'ready', label: 'ready', x: 7.1, y: 3.5, note: notes.ready ?? 'live' },
      { id: 'route', label: 'route', x: 8.7, y: 3.5, note: notes.route ?? 'send' },
    ],
    edges: [
      { id: 'e-load-metrics', from: 'load', to: 'metrics' },
      { id: 'e-metrics-policy', from: 'metrics', to: 'policy' },
      { id: 'e-policy-node', from: 'policy', to: 'node' },
      { id: 'e-policy-pull', from: 'policy', to: 'pull' },
      { id: 'e-policy-model', from: 'policy', to: 'model' },
      { id: 'e-node-ready', from: 'node', to: 'ready' },
      { id: 'e-pull-ready', from: 'pull', to: 'ready' },
      { id: 'e-model-ready', from: 'model', to: 'ready' },
      { id: 'e-ready-route', from: 'ready', to: 'route' },
    ],
  }, { title });
}

function warmGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'gate', label: 'gate', x: 0.7, y: 3.5, note: notes.gate ?? 'admit' },
      { id: 'hot', label: 'hot', x: 2.5, y: 1.5, note: notes.hot ?? 'live' },
      { id: 'warm', label: 'warm', x: 2.5, y: 3.5, note: notes.warm ?? 'idle' },
      { id: 'cold', label: 'cold', x: 2.5, y: 5.5, note: notes.cold ?? 'boot' },
      { id: 'router', label: 'router', x: 4.6, y: 3.5, note: notes.router ?? 'pick' },
      { id: 'kv', label: 'KV', x: 6.6, y: 2.3, note: notes.kv ?? 'cold' },
      { id: 'hit', label: 'hit', x: 6.6, y: 4.7, note: notes.hit ?? 'reuse' },
      { id: 'span', label: 'span', x: 8.5, y: 3.5, note: notes.span ?? 'audit' },
    ],
    edges: [
      { id: 'e-gate-hot', from: 'gate', to: 'hot' },
      { id: 'e-gate-warm', from: 'gate', to: 'warm' },
      { id: 'e-gate-cold', from: 'gate', to: 'cold' },
      { id: 'e-hot-router', from: 'hot', to: 'router' },
      { id: 'e-warm-router', from: 'warm', to: 'router' },
      { id: 'e-cold-router', from: 'cold', to: 'router' },
      { id: 'e-router-kv', from: 'router', to: 'kv' },
      { id: 'e-router-hit', from: 'router', to: 'hit' },
      { id: 'e-kv-span', from: 'kv', to: 'span' },
      { id: 'e-hit-span', from: 'hit', to: 'span' },
    ],
  }, { title });
}

function lagPlot(markers = []) {
  return plotState({
    axes: { x: { label: 'sec', min: 0, max: 180 }, y: { label: 'req/s', min: 0, max: 220 } },
    series: [
      { id: 'need', label: 'demand', points: [{ x: 0, y: 60 }, { x: 30, y: 90 }, { x: 60, y: 180 }, { x: 120, y: 190 }, { x: 180, y: 120 }] },
      { id: 'cold', label: 'cold cap', points: [{ x: 0, y: 80 }, { x: 60, y: 80 }, { x: 100, y: 120 }, { x: 140, y: 180 }, { x: 180, y: 200 }] },
      { id: 'warm', label: 'warm cap', points: [{ x: 0, y: 100 }, { x: 45, y: 135 }, { x: 70, y: 180 }, { x: 120, y: 200 }, { x: 180, y: 180 }] },
    ],
    markers,
  });
}

function costPlot(markers = []) {
  return plotState({
    axes: { x: { label: 'warm', min: 0, max: 6 }, y: { label: 'cost', min: 0, max: 120 } },
    series: [
      { id: 'idle', label: 'idle', points: [{ x: 0, y: 0 }, { x: 1, y: 10 }, { x: 2, y: 22 }, { x: 3, y: 35 }, { x: 4, y: 50 }, { x: 5, y: 66 }, { x: 6, y: 84 }] },
      { id: 'miss', label: 'missed', points: [{ x: 0, y: 115 }, { x: 1, y: 76 }, { x: 2, y: 45 }, { x: 3, y: 27 }, { x: 4, y: 20 }, { x: 5, y: 18 }, { x: 6, y: 18 }] },
      { id: 'total', label: 'total', points: [{ x: 0, y: 115 }, { x: 1, y: 86 }, { x: 2, y: 67 }, { x: 3, y: 62 }, { x: 4, y: 70 }, { x: 5, y: 84 }, { x: 6, y: 102 }] },
    ],
    markers,
  });
}

function* lagMath() {
  yield {
    state: scaleGraph('Autoscaling is a delayed control loop'),
    highlight: { active: ['load', 'metrics', 'policy', 'e-load-metrics', 'e-metrics-policy'], compare: ['ready', 'route'] },
    explanation: 'Autoscaling starts with a signal: queue depth, ongoing requests, KV pressure, or custom serving metrics. That signal is necessary, but it is not capacity yet.',
  };

  yield {
    state: labelMatrix(
      'Scale delay ledger',
      [
        { id: 'metric', label: 'metric' },
        { id: 'poll', label: 'poll' },
        { id: 'place', label: 'place' },
        { id: 'boot', label: 'boot' },
        { id: 'warm', label: 'warm' },
      ],
      [
        { id: 'cost', label: 'delay' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['q age', 'late'],
        ['15s', 'lag'],
        ['GPU', 'no node'],
        ['image', 'slow'],
        ['model', 'cold KV'],
      ],
    ),
    highlight: { active: ['metric:cost', 'poll:cost', 'place:cost', 'boot:cost', 'warm:cost'], compare: ['warm:risk'] },
    explanation: 'A scale-out path is a ledger, not a magic switch. Metrics must be observed, policy must fire, a GPU must be found, containers start, weights load, kernels warm, and caches begin cold.',
    invariant: 'Capacity arrives after the longest critical path, not when the autoscaler notices demand.',
  };

  yield {
    state: lagPlot([
      { id: 'gap', x: 85, y: 150, label: 'gap' },
      { id: 'late', x: 120, y: 110, label: 'late' },
    ]),
    highlight: { active: ['need', 'cold', 'gap', 'late'], found: ['warm'] },
    explanation: 'Cold autoscaling can be right on average and still miss the spike. During the gap, admission control has to shed or defer because the new replica is not ready yet.',
  };

  yield {
    state: labelMatrix(
      'Metric choices',
      [
        { id: 'cpu', label: 'CPU' },
        { id: 'gpu', label: 'GPU' },
        { id: 'run', label: 'running' },
        { id: 'queue', label: 'queue' },
        { id: 'kv', label: 'KV' },
      ],
      [
        { id: 'reads', label: 'reads' },
        { id: 'miss', label: 'misses' },
      ],
      [
        ['host', 'HBM'],
        ['SM', 'TTFT'],
        ['load', 'ddl'],
        ['age', 'class'],
        ['full', 'evict'],
      ],
    ),
    highlight: { active: ['run:reads', 'queue:reads', 'kv:reads'], compare: ['cpu:miss', 'gpu:miss'] },
    explanation: 'LLM autoscaling should not rely on generic CPU alone. Running requests, queue age, deadline misses, KV utilization, and time to first token are closer to the user-facing bottleneck.',
  };

  yield {
    state: scaleGraph('Admission bridges the scale-out gap', { load: 'spike', metrics: 'lag', policy: 'scale', ready: 'later', route: 'when ok' }),
    highlight: { active: ['load', 'metrics', 'policy', 'ready', 'route'], found: ['e-policy-node', 'e-policy-pull', 'e-policy-model'], removed: ['e-ready-route'] },
    explanation: 'While new capacity is starting, the front door must protect goodput. It admits requests that can finish now, defers low-priority work, and sheds work that would miss deadline before the new pod is useful.',
  };
}

function* warmPool() {
  yield {
    state: warmGraph('Warm pools trade idle cost for SLO insurance'),
    highlight: { active: ['hot', 'warm', 'router', 'e-gate-hot', 'e-gate-warm'], compare: ['cold'] },
    explanation: 'A warm pool keeps some model-serving capacity near-ready. It may be idle, but it avoids the full cold path when traffic jumps or a hot replica fails.',
  };

  yield {
    state: labelMatrix(
      'Replica states',
      [
        { id: 'hot', label: 'hot' },
        { id: 'warm', label: 'warm' },
        { id: 'cold', label: 'cold' },
        { id: 'zero', label: 'zero' },
      ],
      [
        { id: 'has', label: 'has' },
        { id: 'pays', label: 'pays' },
        { id: 'use', label: 'use' },
      ],
      [
        ['traffic', 'GPU', 'now'],
        ['weights', 'idle', 'burst'],
        ['image', 'time', 'later'],
        ['none', 'cheap', 'batch'],
      ],
    ),
    highlight: { active: ['warm:has', 'warm:pays', 'warm:use'], compare: ['zero:use', 'cold:use'] },
    explanation: 'Scale-to-zero is economical when extra tail latency is acceptable. Interactive LLM traffic usually needs a nonzero floor or warm pool because model load and cache warmup are visible to users.',
  };

  yield {
    state: costPlot([
      { id: 'knee', x: 3, y: 62, label: 'knee' },
    ]),
    highlight: { active: ['total', 'knee'], compare: ['idle'], removed: ['miss'] },
    explanation: 'The warm-pool size has a cost knee. Too little warm capacity burns SLOs; too much parks GPUs. The right answer is workload-specific and should be found by load tests.',
  };

  yield {
    state: warmGraph('New replicas start with cold locality', { warm: 'ready', cold: 'new', kv: 'empty', hit: 'hot hit', span: 'proof' }),
    highlight: { active: ['cold', 'router', 'kv', 'span', 'e-cold-router', 'e-router-kv'], compare: ['hot', 'hit'] },
    explanation: 'A new replica may increase raw compute capacity but lower cache locality. The router should know when sending a long repeated prompt to a hot cache beats sending it to a brand-new empty replica.',
  };

  yield {
    state: labelMatrix(
      'Warm rules',
      [
        { id: 'floor', label: 'floor' },
        { id: 'burst', label: 'burst' },
        { id: 'ttl', label: 'ttl' },
        { id: 'tenant', label: 'tenant' },
        { id: 'roll', label: 'rollout' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'why', label: 'why' },
      ],
      [
        ['min > 0', 'p99'],
        ['prewarm', 'spike'],
        ['hold', 'reuse'],
        ['split', 'policy'],
        ['canary', 'safe'],
      ],
    ),
    highlight: { active: ['floor:rule', 'burst:rule', 'ttl:rule'], found: ['tenant:why', 'roll:rule'] },
    explanation: 'Warm capacity should be governed, not guessed: min replicas for p99, prewarm for launches, hold warm state while cache reuse is high, isolate tenant pools, and canary new scaling policy.',
  };
}

function* scaleAudit() {
  yield {
    state: labelMatrix(
      'Autoscale record',
      [
        { id: 'signal', label: 'signal' },
        { id: 'want', label: 'want' },
        { id: 'got', label: 'got' },
        { id: 'lag', label: 'lag' },
        { id: 'impact', label: 'impact' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'metric', label: 'metric' },
      ],
      [
        ['q+KV', 'age'],
        ['replicas', 'target'],
        ['ready', 'count'],
        ['seconds', 'cold'],
        ['TTFT', 'goodput'],
      ],
    ),
    highlight: { active: ['signal:field', 'want:field', 'got:field', 'lag:metric'], found: ['impact:metric'] },
    explanation: 'Every scale event should leave an audit row: what signal fired, how many replicas were requested, how many became ready, how long readiness took, and what happened to TTFT and goodput.',
  };

  yield {
    state: scaleGraph('Scale decisions need resource proof', { metrics: 'q age', policy: 'want 4', node: 'quota', pull: 'image', model: 'weights', ready: '2 ok' }),
    highlight: { active: ['policy', 'node', 'pull', 'model', 'ready'], compare: ['route'] },
    explanation: 'A policy that asks for four GPUs has not actually scaled if quota, placement, image pull, model load, or readiness fails. Audit requested capacity and ready capacity separately.',
  };

  yield {
    state: labelMatrix(
      'Control levers',
      [
        { id: 'min', label: 'min' },
        { id: 'max', label: 'max' },
        { id: 'target', label: 'target' },
        { id: 'up', label: 'up lag' },
        { id: 'down', label: 'down lag' },
      ],
      [
        { id: 'tune', label: 'tune' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['warm', 'idle'],
        ['peak', 'quota'],
        ['q/rep', 'p99'],
        ['fast', 'thrash'],
        ['slow', 'waste'],
      ],
    ),
    highlight: { active: ['min:tune', 'target:tune', 'up:tune'], compare: ['down:tune'], found: ['max:watch'] },
    explanation: 'The knobs are coupled. Lower target queue per replica helps latency but may over-scale. Faster upscale helps bursts but can thrash. Slow downscale saves cache warmth but parks expensive GPUs.',
  };

  yield {
    state: lagPlot([
      { id: 'ready', x: 70, y: 180, label: 'ready' },
      { id: 'cap', x: 140, y: 180, label: 'cap ok' },
    ]),
    highlight: { active: ['warm', 'ready', 'cap'], compare: ['cold'], found: ['need'] },
    explanation: 'A good autoscaling policy is judged against the demand curve. Warm capacity should cover the steep part of the spike until slower cold capacity catches up.',
  };

  yield {
    state: labelMatrix(
      'Ship checklist',
      [
        { id: 'load', label: 'load' },
        { id: 'metric', label: 'metric' },
        { id: 'warm', label: 'warm' },
        { id: 'quota', label: 'quota' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'prove', label: 'prove' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['burst', 'p99'],
        ['q+KV', 'TTFT'],
        ['min', 'idle'],
        ['GPU', 'fail'],
        ['event', 'cost'],
      ],
    ),
    highlight: { active: ['load:prove', 'metric:prove', 'warm:guard', 'trace:prove'], compare: ['quota:guard'] },
    explanation: 'Before shipping, run burst load tests, prove the chosen metric tracks TTFT and goodput, size the warm floor, test quota failure, and trace every scale event to cost and user impact.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lag math') yield* lagMath();
  else if (view === 'warm pool') yield* warmPool();
  else if (view === 'scale audit') yield* scaleAudit();
  else throw new InputError('Pick an LLM autoscaling view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read this as a delayed control loop for large language model (LLM) serving. Active nodes show observed demand, requested capacity, and ready capacity; requested replicas are not usable until weights, runtime, health checks, and routes are live.',
      {type: 'callout', text: 'Warm capacity matters because requested replicas do not help users until weights, runtimes, and routes are ready.'},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Autoscaling reacts slower than a traffic spike. A GPU replica may wait for scheduling, image startup, model weight loading, kernel warmup, readiness checks, and routing before it serves one token.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is threshold scaling on CPU, GPU use, request count, or queue depth. That works for fast stateless services, but LLM request cost varies with prompt length, output length, KV cache state, and prefix-cache locality.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is transport delay. If cold readiness takes 90 seconds and the user waits 5 seconds, the new replica helps the next burst more than the current one.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Separate desired capacity from ready capacity. The useful data structure is a replica-state ledger with zero, cold, warm, and hot states, each carrying remaining time to usefulness and routing eligibility.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The policy reads queue age, time to first token, inter-token latency, KV utilization, active sequences, deadline misses, and prefix-cache hit rate. It chooses hot targets for current demand and warm targets for burst coverage, while the router avoids sending cache-sensitive prompts to empty replicas.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is deadline math. If cold scale-out takes longer than the SLO, only capacity that was already warm can protect the current request class.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Warm capacity is idle spend bought as SLO insurance. Cost behaves like a U-shaped curve: too few warm replicas create misses, too many park expensive GPUs, and the best floor is where one more warm replica saves less failure cost than it adds idle cost.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Warm pools fit chat APIs, enterprise copilots, agent orchestrators, model rollback, failure recovery, and tenant contracts with hard latency budgets. They work best when bursts are predicted by calendar, launch, tenant schedule, or traffic slope.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Warm pools fail for rare jobs that tolerate cold start, such as offline batch inference or admin paths. They also fail as an overload policy because a large enough burst can consume any warm pool.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A service has 3 hot replicas, 2 warm replicas, and 25 requests per second of goodput per replica. Demand jumps from 60 to 110 requests per second, so hot capacity is short by 35 requests per second until the warm replicas activate.',
      'If both warm replicas activate in 3 seconds, capacity becomes 125 requests per second and the queue drains. Without them, a 90 second cold path creates 3150 delayed requests before new capacity appears.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Study Lorido-Botran autoscaling at https://link.springer.com/article/10.1007/s10723-014-9314-7, vLLM PagedAttention at https://arxiv.org/abs/2309.06180, Ray Serve autoscaling at https://docs.ray.io/en/latest/serve/advanced-guides/advanced-autoscaling.html, and Kubernetes HPA at https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/.',
      'Next, study LLM Serving Admission-Control Goodput Gate, KV Cache, Prefix Caching, Continuous Batching, Chunked Prefill, Prefill/Decode Disaggregation, Tail Latency and p99 Thinking, and Feature Flag Control Plane.',
    ] },
  ],
};