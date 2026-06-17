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
      heading: 'The problem',
      paragraphs: [
        'LLM serving capacity is slow to appear. A user spike can arrive in a few seconds. A new GPU replica may need a node assignment, container image pull, model weight load, CUDA kernel warmup, health checks, routing registration, and enough initial traffic to make caches useful. The autoscaler can decide to scale in one control-loop tick, but users do not receive more tokens until the whole readiness path finishes.',
        'That gap matters because LLM traffic is often deadline-bound. Chat users notice time to first token. Agents can miss tool deadlines. Enterprise tenants may send synchronized bursts at the start of a workday, demo, or batch of workflow steps. A policy that eventually reaches the right replica count can still fail the live SLO if the demand spike is over before new capacity becomes useful.',
        'A warm pool is the practical answer when scale-to-zero is too slow but fully hot capacity is too expensive. It keeps some serving state close to ready. The pool may already have model weights loaded, runtime initialized, and GPU memory reserved, even if it is not handling much traffic. The team pays idle cost so the next burst pays only a short activation path instead of the entire cold-start path.',
      ],
    },
    {
      heading: 'The naive autoscaler',
      paragraphs: [
        'The naive approach is threshold scaling. Watch CPU utilization, GPU utilization, request count, or queue depth. When the metric crosses a threshold, ask Kubernetes, Ray Serve, KServe, or another control plane for more replicas. During quiet periods, scale down, maybe all the way to zero. This is attractive because it is simple, cheap at rest, and easy to explain.',
        'It works well for stateless web services with fast startup and small per-request state. If a container starts in two seconds and every request takes similar work, a target like requests per pod is often enough. The system may be a little late, but it catches up before users care.',
        'LLM serving breaks those assumptions. Startup can be dominated by huge model weights and GPU placement. Request cost varies by prompt length, output length, batching compatibility, and cache reuse. Decode saturation can occur while CPU looks calm. GPU utilization can be high for a healthy batch or high because overloaded requests are queueing behind long generations. The metric has to describe user-facing pressure, not just machine activity.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Autoscaling is delayed feedback. First the burst must affect a metric. Then the metric has to be scraped or pushed. Then the autoscaler evaluates policy. Then the scheduler finds a GPU. Then the serving process becomes ready. If the total path is 70 seconds and callers abandon after 20 seconds, the scale-out action mostly helps the next burst.',
        'The wall is not only cold start. New replicas can be lower quality capacity at first. They have empty KV caches, empty prefix caches, cold kernels, and no established locality with repeated prompts. Sending a long repeated prompt to a newly created replica may waste prefill work that an existing hot replica could have avoided. Raw compute increased, but useful goodput did not increase by the same amount.',
        'There is also a measurement wall. Generic resource metrics can hide the real bottleneck. Queue age, time to first token, inter-token latency, deadline misses, KV memory pressure, and admission outcomes are closer to what users experience. A serving autoscaler that cannot see those signals is steering through a fog.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core data structure is a replica-state machine backed by a scale-event ledger. A hot replica is serving live traffic. A warm replica has expensive prerequisites paid, such as weights loaded and runtime initialized, but may be idle or lightly loaded. A cold replica is still being scheduled, pulled, loaded, or warmed. Zero means no serving process exists. These states must be explicit because each one has a different remaining time to usefulness.',
        'The invariant is simple: desired capacity and ready capacity are different facts. The autoscaler may request four more replicas, but the router cannot spend those replicas until they pass readiness and can serve the right class of request. The scale ledger records both facts: what the policy wanted and what actually became usable.',
        'Warm pools work because they move capacity leftward on the readiness timeline. They do not eliminate demand, and they do not make GPUs cheap. They prepay the slowest parts of the path so the control loop has a chance to satisfy a live deadline instead of writing a correct postmortem.',
      ],
    },
    {
      heading: 'The scale-event ledger',
      paragraphs: [
        'A useful scale event is more than "scaled from 3 to 7." It should record the signal that fired, the metric window, the target replica count, the actual ready replica count, the requested GPU type, placement result, image pull time, model load time, readiness time, cache state, admission decisions, and the effect on TTFT, p99, goodput, and dropped work.',
        'This ledger turns autoscaling from a black box into an auditable control loop. If a burst missed SLO, the team can distinguish "policy fired too late" from "quota blocked placement", "model load was slow", "readiness never passed", "router sent traffic to cold caches", or "admission let in work that could not finish." Each failure asks for a different fix.',
        'The ledger is also how teams tune the warm floor. If three warm replicas cover the steep part of a morning burst until cold replicas arrive, the pool is doing its job. If six warm replicas sit idle all day while deadline misses remain unchanged, the bottleneck is somewhere else.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with the demand signal. For LLM serving, useful signals include ongoing requests per replica, queue age by priority class, time to first token, inter-token latency, KV cache utilization, GPU memory headroom, prefix-cache hit rate, and deadline misses. CPU can still be useful for host-side bottlenecks, but it should not be the only scale signal for a GPU decode path.',
        'Next, translate demand into target states. The policy may say: keep two hot replicas per tenant, keep one warm spare per model shard, prewarm extra capacity before scheduled launches, and create cold replicas when queue age exceeds a bound. Warm capacity is controlled separately from maximum capacity. The warm pool protects the near future; the cold pool handles sustained growth.',
        'Then route with state awareness. The router should know whether a replica is hot, warm, or cold, and whether it has useful locality for a request. For short prompts under burst pressure, an activated warm replica may be ideal. For a repeated long prompt, a busier hot replica with the right prefix cached may still win. Routing that ignores cache state can turn scale-out into extra prefill waste.',
        'Finally, pair scaling with admission control. During the scale-out gap, the front door should admit work that can finish, defer lower-priority work, and reject or shed work that would miss its deadline anyway. Autoscaling without admission control often converts one overload into two failures: saturated current replicas and a backlog of requests that are already doomed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is deadline math. Suppose a cold path takes 90 seconds: 10 seconds for metric delay, 20 for scheduling, 20 for image and runtime, 30 for model load, and 10 for readiness and routing. If the product deadline is 15 seconds, cold scale-out cannot save the current spike. A warm pool might reduce the remaining path to 5 or 10 seconds, which puts the response back inside the deadline.',
        'The approach also works because it keeps the control loop honest. Observation is not decision. Decision is not readiness. Readiness is not goodput. The ledger records each boundary, so a team can measure where lag enters the path instead of guessing from a replica-count graph.',
        'The model is intentionally conservative. A warm replica is not treated as free capacity until its state supports the request class being routed to it. That prevents a common mistake: counting containers that exist but cannot yet protect user latency.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Warm capacity is deliberately wasteful in the narrow accounting sense. A parked GPU is expensive. The justification is that missed interactive demand is also expensive: abandoned sessions, failed agent runs, retry storms, damaged tenant trust, and emergency overprovisioning after the fact. The right pool size is the point where idle cost is cheaper than the expected cost of missed deadlines.',
        'Upscale and downscale delays are coupled. Fast upscale helps bursts but can thrash if metrics are noisy. Slow downscale preserves cache warmth and avoids repeated cold starts, but it extends idle cost. Scale-to-zero is excellent for infrequent batch or admin paths and dangerous for latency-sensitive chat unless the product explicitly accepts cold starts.',
        'Tenant isolation is another tradeoff. A shared warm pool improves utilization, but one tenant can consume the warm buffer before another tenant spike arrives. Dedicated tenant pools protect contracts and predictable workloads, but they fragment expensive GPUs. Many platforms need both: shared base pools for efficiency and reserved warm floors for important tenants or models.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Warm-pool autoscaling wins for workloads with predictable burst shape: business-hour ramps, classroom starts, sales demos, enterprise tenant jobs, product launches, scheduled agent swarms, and recurring report generation. It also helps with failure recovery because a warm spare can absorb traffic when a hot replica crashes or is drained for rollout.',
        'It is especially strong when combined with smart routing, prefix caching, chunked prefill, and observability. The autoscaler supplies near-ready capacity. The router sends requests where they will do the least redundant work. Admission control protects the gap. Tracing explains what happened when reality differs from the plan.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Warm pools fail when traffic is so unpredictable that the pool is always the wrong size. They also fail when the platform lacks quota or placement headroom; a policy cannot create GPUs that the cluster cannot schedule. If model images are too large, weight loading is unstable, or readiness checks are inaccurate, the warm state may be more imagined than real.',
        'The pattern also fails when the team treats warm capacity as a substitute for overload policy. A sufficiently large spike can consume any warm pool. Without admission control, deadline-aware routing, and load shedding, the service still accepts work it cannot finish. Warm pools reduce the probability and duration of overload; they do not repeal capacity limits.',
        'Finally, warm pools can hide quality regressions in operations. If cost pressure causes the team to shrink the floor without load tests, the product may degrade gradually. The antidote is a recurring scale audit that replays realistic bursts and compares demand, ready capacity, cost, and user impact.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study admission control next, because it protects the period before new capacity arrives. Then study SLO-aware request routing, prefix caching, chunked prefill, continuous batching, KV cache transfer, and disaggregated prefill/decode. Those topics explain why LLM capacity is not a single number.',
        'For systems grounding, study backpressure, load shedding, tail latency, Kubernetes scheduling, distributed tracing, and write-ahead logs. The mental model is the same across these subjects: make state transitions explicit, record the evidence, and tune the control loop against user-facing outcomes rather than comforting internal counters.',
      ],
    },
  ],
};
