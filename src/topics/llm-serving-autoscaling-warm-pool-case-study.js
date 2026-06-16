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
    {
      heading: 'What it is',
      paragraphs: [
        'LLM serving autoscaling is the control loop that turns demand signals into more or fewer model-serving replicas. A warm pool keeps some capacity close enough to ready that spikes do not wait for the full cold-start path.',
        'The data-structure lesson is a delayed queue-control problem. The system keeps metric windows, scale-event ledgers, replica-state machines, warm-pool floors, readiness gates, and cost records. The key question is not simply how many replicas you want; it is when useful capacity will actually arrive.',
      ],
    },
    {
      heading: 'Core data structures',
      paragraphs: [
        'The autoscaler watches a metric window: ongoing requests, queue age, request class, time to first token, KV utilization, GPU memory, and deadline misses. It writes a scale-event record with desired replicas, ready replicas, placement result, image pull time, weight load time, readiness time, and impact on goodput.',
        'Replica state is a small state machine: hot means serving traffic, warm means weights and runtime are ready but little traffic is assigned, cold means starting or loading, zero means no pod exists. A routing index has to know those states because a new cold replica can increase compute capacity while reducing cache locality.',
      ],
    },
    {
      heading: 'Production anchors',
      paragraphs: [
        'Ray Serve autoscaling uses ongoing requests per replica as the main target; its docs emphasize tuning `target_ongoing_requests`, `max_ongoing_requests`, `min_replicas`, `max_replicas`, upscale delay, downscale delay, and load testing against latency objectives: https://docs.ray.io/en/latest/serve/autoscaling-guide.html and https://docs.ray.io/en/latest/serve/advanced-guides/advanced-autoscaling.html.',
        'vLLM Production Stack documents KEDA autoscaling with Prometheus-based metrics as part of the Helm chart path: https://docs.vllm.ai/projects/production-stack/en/latest/use_cases/autoscaling-keda.html. KServe supports KEDA external metrics, including Prometheus queries over LLM metrics such as `vllm:num_requests_running`: https://kserve.github.io/website/docs/model-serving/predictive-inference/autoscaling/keda-autoscaler.',
        'NVIDIA Dynamo frames autoscaling as part of a system-level distributed inference layer that also includes disaggregated serving, smart routing, KV cache management, Kubernetes-native deployment, and observability: https://docs.nvidia.com/dynamo/getting-started/introduction.',
      ],
    },
    {
      heading: 'Complete case study: launch spike',
      paragraphs: [
        'A team launches an enterprise copilot. At 9:00, short chat traffic triples, long repository-agent prompts appear, and batch summarization is still running. A CPU-based autoscaler sees little at first because GPU decode is the bottleneck. A request-count autoscaler fires, but the new pods wait for GPU placement, image pull, model load, and kernel warmup. During those minutes, the admission gate protects goodput: short chats fit through, batch work defers, very long prompts route to cache-local hot replicas, and requests with no viable deadline get fast 503s.',
        'The fixed design uses a warm floor for business hours, a launch calendar prewarm, KEDA or Serve metrics based on running requests and queue age, a router aware of cold KV locality, and a scale-event ledger. The result is not perfect utilization. It is fewer missed deadlines, lower p99, fewer retries, and a clear bill for idle warm capacity versus wasted failed work.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not scale only on CPU for model serving. Do not set min replicas to zero for latency-sensitive traffic unless cold-start p99 is acceptable. Do not let new replicas take cache-local long prompts just because they are empty. Do not judge autoscaling by desired replicas; judge ready replicas, readiness lag, TTFT, p99, goodput, and cost per completed task.',
        'Study LLM Serving Admission-Control Goodput Gate, SLO-Aware LLM Request Router, Chunked Prefill Token Budget Scheduler, KV Cache Tiered Offload Store Case Study, KV Cache Transfer Fabric Case Study, LLM Continuous Batching, Load Shedding & Graceful Degradation, Backpressure, Tail Latency & p99 Thinking, Ray Distributed Execution Case Study, Kubernetes Scheduler PriorityQueue & Preemption, Feature Flag Control Plane, Distributed Tracing, and LLM Unit Economics Ledger Case Study next.',
      ],
    },
  ],
};
