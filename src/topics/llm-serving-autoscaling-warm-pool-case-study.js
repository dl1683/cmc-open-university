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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation traces three views of the same problem: how an LLM serving platform converts a demand spike into ready GPU capacity, and what happens during the gap.',
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current bottleneck or decision point in the scale-out path.',
            'Compare nodes show the alternative state -- what would happen with a different pool strategy or metric choice.',
            'Found markers are outcomes now proven: capacity that is confirmed ready and routable, not merely requested.',
            'Removed edges indicate paths blocked during the scale-out gap, such as routing to replicas that exist but cannot yet serve.',
          ],
        },
        'In the lag-math view, follow the gap between the demand curve and the capacity curves. The vertical distance between demand and cold capacity at any point is the traffic that must be shed or queued. The warm capacity curve closes that gap earlier. In the warm-pool view, watch how the gate routes requests to hot, warm, or cold replicas, and how cache state affects useful throughput. In the scale-audit view, read each ledger row as evidence for or against the current autoscaling policy.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LLM serving capacity is slow to appear. A user spike can arrive in seconds. A new GPU replica may need node assignment, container image pull, model weight loading, CUDA kernel warmup, health checks, routing registration, and enough initial traffic to warm caches. The autoscaler can decide to scale in one control-loop tick, but users do not receive more tokens until the entire readiness path finishes.',
        {
          type: 'quote',
          text: 'The fundamental problem of autoscaling is that it is a feedback loop with transport delay. The controller observes, decides, and acts, but the plant does not respond until the actuation pipeline completes. For LLM serving, that pipeline is dominated by model weight transfer and GPU initialization -- the slowest actuators in modern infrastructure.',
          attribution: 'Adapted from control theory applied to cloud autoscaling (Lorido-Botran et al., ACM CSUR 2014)',
        },
        'That gap matters because LLM traffic is often deadline-bound. Chat users notice time to first token (TTFT). Agentic workflows can miss tool-call deadlines. Enterprise tenants send synchronized bursts at the start of a workday, a demo, or a batch of workflow steps. A policy that eventually reaches the right replica count still fails the live SLO if the demand spike is over before new capacity becomes useful.',
        {
          type: 'table',
          headers: ['Traffic pattern', 'Spike shape', 'Cold-start risk', 'Warm-pool value'],
          rows: [
            ['Chat product launch', 'Step function, minutes to plateau', 'High -- all capacity is new', 'Critical: pre-staged replicas absorb the ramp'],
            ['Enterprise morning ramp', 'Predictable daily slope', 'Medium -- can pre-schedule', 'High: prewarm on cron before 9 AM'],
            ['Agent swarm burst', 'Sharp pulse, 10-30s duration', 'Extreme -- burst is over before cold path finishes', 'Essential: only preloaded replicas help'],
            ['Batch inference job', 'Sustained plateau, hours', 'Low -- cold start is amortized', 'Low: cold replicas pay for themselves over the run'],
          ],
        },
        'A warm pool is the practical answer when scale-to-zero is too slow but fully hot capacity is too expensive. It keeps serving state close to ready: model weights loaded, runtime initialized, GPU memory reserved, even if not handling live traffic. The team pays idle cost so the next burst pays only a short activation path instead of the entire cold-start pipeline.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The naive approach is threshold scaling. Watch CPU utilization, GPU utilization, request count, or queue depth. When the metric crosses a threshold, ask Kubernetes (HPA), Ray Serve, KServe, or another control plane for more replicas. During quiet periods, scale down, maybe all the way to zero.',
        {
          type: 'code',
          language: 'yaml',
          text: '# Kubernetes HPA -- the naive approach for LLM serving\napiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nspec:\n  minReplicas: 0          # scale-to-zero: cheap at rest\n  maxReplicas: 16\n  metrics:\n    - type: Resource\n      resource:\n        name: cpu\n        target:\n          type: Utilization\n          averageUtilization: 70\n  behavior:\n    scaleUp:\n      stabilizationWindowSeconds: 30\n    scaleDown:\n      stabilizationWindowSeconds: 300',
        },
        'This works well for stateless web services with fast startup and small per-request state. If a container starts in two seconds and every request takes similar work, a target like requests-per-pod is often enough. The system may be a little late, but it catches up before users care.',
        'LLM serving breaks those assumptions. Startup is dominated by huge model weights (a 70B model at FP16 is ~140 GB to transfer and load into GPU HBM). Request cost varies by prompt length, output length, batching compatibility, and cache reuse. Decode saturation can occur while CPU looks calm. GPU utilization can read high for a healthy batch or high because overloaded requests are queueing behind long generations. The metric has to describe user-facing pressure, not just machine activity.',
        {
          type: 'note',
          text: 'CPU utilization is particularly misleading for LLM workloads. The tokenizer and sampler use CPU, but the dominant cost is GPU matrix multiplication during prefill and memory-bandwidth-bound decode. A pod can show 30% CPU while every GPU SM is saturated and TTFT has blown past the SLO.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Autoscaling is delayed feedback. First the burst must affect a metric. Then the metric has to be scraped (Prometheus default: 15s). Then the autoscaler evaluates policy (HPA default: 15s sync period). Then the scheduler finds a GPU node. Then the container runtime pulls the image. Then the serving process loads weights. Then kernels warm. Then health checks pass. Then the router registers the new endpoint.',
        {
          type: 'diagram',
          text: 'Cold-start critical path (typical large model):\n\n  t=0s     t=15s      t=30s       t=50s        t=80s      t=110s     t=120s\n  |---------|----------|-----------|------------|----------|----------|--->\n  burst     metric     policy      GPU node     image      weights    ready\n  arrives   scraped    fires       placed       pulled     loaded     to serve\n            +15s       +15s        +20s         +30s       +30s       +10s\n\n  Total cold path: ~120 seconds\n  User patience for chat TTFT: 2-5 seconds\n  User patience for API SLO: 10-30 seconds',
          label: 'Cold-start timeline for a 70B parameter model on A100 GPUs',
        },
        'If the total path is 120 seconds and callers abandon after 10, the scale-out action mostly helps the next burst, not the current one.',
        'The wall is not only cold start. New replicas are lower-quality capacity at first. They have empty KV caches, empty prefix caches, cold CUDA kernels (first invocations trigger JIT compilation of NCCL collectives and custom kernels), and no established locality with repeated prompts. Sending a long repeated system prompt to a brand-new replica wastes the full prefill cost that an existing hot replica could have skipped via prefix caching.',
        {
          type: 'table',
          headers: ['Stage', 'Duration (typical)', 'What blocks it', 'What warm pool eliminates'],
          rows: [
            ['Metric observation', '15-30s', 'Scrape interval, push delay', 'Nothing -- still needed'],
            ['Policy evaluation', '15s', 'HPA sync period, cooldown', 'Nothing -- still needed'],
            ['GPU scheduling', '10-60s', 'Quota, fragmentation, spot eviction', 'Node already assigned'],
            ['Image pull', '10-120s', 'Image size, registry bandwidth, layer caching', 'Image already present'],
            ['Weight loading', '20-90s', 'Model size, disk-to-HBM bandwidth', 'Weights already in GPU HBM'],
            ['Kernel warmup', '5-15s', 'CUDA JIT, cuBLAS autotuning', 'Kernels already compiled'],
            ['Health + routing', '5-10s', 'Readiness probe, routing mesh update', 'Reduced to activation check'],
          ],
        },
        'There is also a measurement wall. Generic resource metrics hide the real bottleneck. Queue age, TTFT, inter-token latency (ITL), deadline misses, KV memory pressure, and admission outcomes are closer to what users experience. A serving autoscaler that cannot see those signals is steering through fog.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core data structure is a replica-state machine backed by a scale-event ledger.',
        {
          type: 'diagram',
          text: 'Replica state machine:\n\n  +-------+    schedule    +-------+    load     +-------+   traffic   +-------+\n  | ZERO  | ------------> | COLD  | ----------> | WARM  | ----------> |  HOT  |\n  +-------+               +-------+             +-------+             +-------+\n      ^                       |                     |                     |\n      |     drain/evict       |    timeout/drain    |    idle timeout     |\n      +-----------------------+---------------------+---------------------+\n\n  ZERO: no process, no GPU, no cost\n  COLD: scheduling, pulling, loading -- not yet servable\n  WARM: weights loaded, runtime ready, GPU reserved -- idle or lightly loaded\n  HOT:  actively serving live traffic with warm caches\n\n  Time to serve from each state:\n    ZERO -> serve:  80-180s (full cold path)\n    COLD -> serve:  variable (depends on where in the pipeline)\n    WARM -> serve:  0-5s (activate + route)\n    HOT  -> serve:  0s (already serving)',
          label: 'The four replica states and their transitions',
        },
        'These states must be explicit because each one has a different remaining time to usefulness. The invariant is simple: desired capacity and ready capacity are different facts. The autoscaler may request four more replicas, but the router cannot spend those replicas until they pass readiness and can serve the right class of request.',
        {
          type: 'note',
          text: 'The invariant -- "desired != ready" -- is the single most important idea in this case study. Every autoscaling bug in LLM serving is a violation of this distinction. Dashboards that show "4 replicas" without distinguishing hot/warm/cold replicas are lying about capacity.',
        },
        'The scale ledger records both facts: what the policy wanted and what actually became usable. Warm pools work because they move capacity leftward on the readiness timeline. They do not eliminate demand, and they do not make GPUs cheap. They prepay the slowest parts of the path -- weight loading, kernel warmup, GPU placement -- so the control loop has a chance to satisfy a live deadline instead of writing a correct postmortem.',
      ],
    },
    {
      heading: 'The scale-event ledger',
      paragraphs: [
        'A useful scale event is more than "scaled from 3 to 7." It should record the full causal chain from signal to user impact.',
        {
          type: 'code',
          language: 'json',
          text: '{\n  "event_id": "scale-2026-06-19T09:01:12Z",\n  "trigger": {\n    "signal": "queue_age_p95",\n    "value_ms": 4200,\n    "threshold_ms": 2000,\n    "window_seconds": 30\n  },\n  "decision": {\n    "current_hot": 3,\n    "current_warm": 1,\n    "target_hot": 5,\n    "target_warm": 2,\n    "gpu_type": "A100-80GB",\n    "model": "llama-70b-chat"\n  },\n  "execution": {\n    "nodes_requested": 2,\n    "nodes_placed": 2,\n    "placement_ms": 18200,\n    "image_pull_ms": 4100,\n    "weight_load_ms": 32400,\n    "readiness_ms": 6800,\n    "warm_activated": 1,\n    "warm_activation_ms": 1200\n  },\n  "outcome": {\n    "ttft_p99_before_ms": 8400,\n    "ttft_p99_after_ms": 2100,\n    "goodput_before_rps": 42,\n    "goodput_after_rps": 78,\n    "requests_shed": 127,\n    "requests_deadline_missed": 31\n  }\n}',
        },
        'This ledger turns autoscaling from a black box into an auditable control loop. If a burst missed SLO, the team can distinguish "policy fired too late" from "quota blocked placement," "model load was slow," "readiness never passed," "router sent traffic to cold caches," or "admission let in work that could not finish." Each failure demands a different fix.',
        {
          type: 'table',
          headers: ['Ledger field', 'Failure it detects', 'Fix category'],
          rows: [
            ['trigger.value vs threshold', 'Policy fired too late or too aggressively', 'Tune metric thresholds and scrape intervals'],
            ['nodes_requested vs nodes_placed', 'Quota exhaustion or GPU fragmentation', 'Reserve capacity, defragment, or use spot with fallback'],
            ['weight_load_ms', 'Model too large for available disk/HBM bandwidth', 'Pre-cache weights on local NVMe, use tensor parallelism'],
            ['warm_activated vs warm_activation_ms', 'Warm pool too small or activation too slow', 'Increase warm floor or optimize activation path'],
            ['requests_shed', 'Admission control gap too wide', 'More warm replicas or predictive pre-scaling'],
            ['ttft_p99_after vs SLO', 'New capacity was cold (empty caches)', 'Route initial traffic to warm replicas first'],
          ],
        },
        'The ledger is also how teams tune the warm floor. If three warm replicas cover the steep part of a morning burst until cold replicas arrive, the pool is doing its job. If six warm replicas sit idle all day while deadline misses remain unchanged, the bottleneck is somewhere else -- perhaps the router, the metric, or the admission policy.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The system has four interacting components: demand sensing, state-aware policy, cache-aware routing, and admission control. Each must be designed for LLM-specific signals.',
        {
          type: 'table',
          headers: ['Signal', 'What it measures', 'Why it matters for LLM serving'],
          rows: [
            ['Ongoing requests per replica', 'Active decode slots consumed', 'Directly tracks GPU decode bandwidth saturation'],
            ['Queue age by priority class', 'How long requests wait before prefill starts', 'Deadline-aware: old queue entries will miss SLO regardless'],
            ['Time to first token (TTFT)', 'Prefill latency including queue wait', 'The user-facing metric chat products actually care about'],
            ['Inter-token latency (ITL)', 'Decode step duration under load', 'Detects batch over-packing before throughput drops'],
            ['KV cache utilization', 'Fraction of GPU HBM used by active KV entries', 'Predicts eviction pressure and prefill-cache misses'],
            ['Prefix-cache hit rate', 'Fraction of prompt tokens served from cache', 'Low hit rate on a new replica means wasted prefill compute'],
            ['GPU SM utilization', 'Fraction of streaming multiprocessors active', 'Detects compute saturation that CPU metrics miss entirely'],
          ],
        },
        'The policy translates demand into target states. It maintains separate targets for hot and warm capacity:',
        {
          type: 'code',
          language: 'python',
          text: '# Simplified warm-pool policy logic\ndef compute_targets(metrics, config):\n    # Hot target: enough replicas to keep queue age under SLO\n    demand_rps = metrics.incoming_rps\n    capacity_per_replica = metrics.goodput_per_hot_replica\n    hot_target = math.ceil(demand_rps / capacity_per_replica)\n\n    # Warm target: enough to cover the burst slope\n    # during the cold-start window\n    burst_slope = metrics.rps_derivative  # req/s per second\n    cold_path_seconds = config.avg_cold_start_seconds\n    burst_during_cold = burst_slope * cold_path_seconds\n    warm_target = math.ceil(burst_during_cold / capacity_per_replica)\n\n    # Clamp to configured bounds\n    warm_target = max(config.warm_floor, min(warm_target, config.warm_ceiling))\n    hot_target = max(config.min_replicas, min(hot_target, config.max_replicas))\n\n    return hot_target, warm_target',
        },
        'The router must know replica state. For short prompts under burst pressure, an activated warm replica with empty caches is fine -- prefill cost is low. For a repeated long system prompt, a busier hot replica with the right prefix cached may still win because it skips thousands of prefill tokens.',
        {
          type: 'diagram',
          text: 'Routing decision tree:\n\n  incoming request\n       |\n       v\n  [has prefix in hot replica cache?]\n       |              |\n      YES             NO\n       |              |\n       v              v\n  [hot replica     [any warm replica\n   queue < SLO?]    available?]\n    |       |        |        |\n   YES      NO      YES       NO\n    |       |        |        |\n    v       v        v        v\n  route   [warm    route    admit?\n  to hot   avail?] to warm   |\n            |  |           [queue age\n           YES NO           < deadline?]\n            |  |             |       |\n            v  v            YES      NO\n         route  queue       |        |\n         warm   + shed      v        v\n                          queue    shed',
          label: 'Cache-aware routing with admission control',
        },
        'During the scale-out gap, the front door must protect goodput. It admits requests that can finish within deadline, defers low-priority work, and sheds work that would miss its deadline regardless. Autoscaling without admission control often converts one overload into two failures: saturated current replicas and a backlog of requests that are already doomed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is deadline math.',
        {
          type: 'code',
          language: 'text',
          text: 'Cold path latency breakdown:\n  metric_delay     = 15s   (scrape interval)\n  policy_delay     = 15s   (evaluation + cooldown)\n  scheduling       = 20s   (GPU node placement)\n  image_pull       = 15s   (container + runtime)\n  weight_load      = 30s   (140 GB at ~4.7 GB/s disk-to-HBM)\n  kernel_warmup    = 10s   (CUDA JIT + cuBLAS autotune)\n  readiness        =  5s   (health check + routing)\n  ---------------------\n  Total cold path  = 110s\n\nWarm path latency breakdown:\n  metric_delay     = 15s   (same)\n  policy_delay     = 15s   (same)\n  activation       =  2s   (start accepting, route update)\n  ---------------------\n  Total warm path  = 32s   (or 2s if preemptive)\n\nProduct TTFT SLO: 5 seconds for chat, 30 seconds for API\n\nCold path can never meet chat SLO during a spike.\nWarm path meets API SLO. Preemptive warm activation meets chat SLO.',
        },
        'If the product deadline is 5 seconds for interactive chat, cold scale-out cannot save the current spike. A warm pool reduces the remaining path to 2 seconds when activated preemptively (on rate-of-change signal rather than threshold breach), putting the response inside the deadline.',
        'The approach works because it keeps the control loop honest. Each stage boundary is recorded:',
        {
          type: 'bullets',
          items: [
            'Observation is not decision: the metric must be scraped and evaluated before the autoscaler acts.',
            'Decision is not readiness: requesting four GPUs does not mean four GPUs are serving.',
            'Readiness is not goodput: a replica with empty caches produces correct output but at higher latency than a cache-warm replica.',
            'The ledger records each boundary, so a team can measure where lag enters the path instead of guessing from a replica-count graph.',
          ],
        },
        'The model is intentionally conservative. A warm replica is not treated as free capacity until its state supports the request class being routed to it. That prevents the most common autoscaling mistake in LLM serving: counting containers that exist but cannot yet protect user latency.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Warm capacity is deliberately wasteful in the narrow accounting sense. A parked A100-80GB costs roughly $1.50-2.00/hour on major clouds. The justification is that missed interactive demand is also expensive: abandoned sessions, failed agent runs, retry storms, damaged tenant trust, and emergency overprovisioning after the fact.',
        {
          type: 'table',
          headers: ['Warm replicas', 'Idle cost/hour', 'Missed-deadline cost/hour', 'Total cost/hour', 'Verdict'],
          rows: [
            ['0', '$0', '$115 (shed + retry + churn)', '$115', 'Cheapest idle, worst user experience'],
            ['1', '$2', '$76 (some coverage)', '$78', 'Helps small spikes only'],
            ['2', '$4', '$45 (covers morning ramp)', '$49', 'Better, still exposed to large bursts'],
            ['3', '$6', '$27 (covers most bursts)', '$33', 'Near the cost knee -- sweet spot for this workload'],
            ['4', '$8', '$20 (diminishing returns)', '$28', 'Marginal improvement over 3'],
            ['5', '$10', '$18 (plateau)', '$28', 'Same protection, more idle waste'],
            ['6', '$12', '$18 (no further improvement)', '$30', 'Waste -- bottleneck is elsewhere'],
          ],
        },
        {
          type: 'note',
          text: 'The cost knee -- the warm-pool size where total cost is minimized -- is workload-specific. It depends on burst frequency, burst magnitude, cold-start duration, and the dollar cost of missed deadlines (which includes downstream effects like retry amplification and tenant churn). Find it by load testing, not by intuition.',
        },
        'Upscale and downscale delays are coupled. Fast upscale helps bursts but can thrash if metrics are noisy. Slow downscale preserves cache warmth and avoids repeated cold starts, but it extends idle cost. Scale-to-zero is excellent for infrequent batch or admin paths and dangerous for latency-sensitive chat unless the product explicitly accepts cold starts.',
        'Tenant isolation is another tradeoff. A shared warm pool improves utilization, but one tenant can consume the warm buffer before another tenant spike arrives. Dedicated tenant pools protect contracts and predictable workloads but fragment expensive GPUs. Many platforms need both: shared base pools for utilization and reserved warm floors for high-value tenants.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Deployment pattern', 'Warm-pool role', 'Why it fits'],
          rows: [
            ['Multi-tenant chat API', 'Per-model warm floor (1-2 replicas)', 'Tenants share burst headroom; cold start is visible in TTFT'],
            ['Enterprise copilot (business hours)', 'Cron-driven prewarm at 8 AM, drain at 7 PM', 'Traffic shape is predictable; warm cost is bounded by schedule'],
            ['Agent orchestrator', 'Warm replicas pinned per tool-model pair', 'Tool-call deadlines are hard; agents retry on timeout, causing amplification'],
            ['Batch inference pipeline', 'Scale-to-zero with no warm pool', 'Jobs tolerate minutes of cold start; idle cost is pure waste'],
            ['Model rollout / canary', 'Warm pool holds old version during canary', 'If canary fails, traffic reverts to warm old replicas instantly'],
            ['Failure recovery', 'Warm spare absorbs traffic on hot replica crash', 'GPU failure is rare but correlated; one node loss can drop 25% capacity'],
          ],
        },
        'Warm-pool autoscaling is especially strong when combined with prefix caching, chunked prefill, and continuous batching. The autoscaler supplies near-ready capacity. The router sends requests where they will do the least redundant work. Admission control protects the gap. Tracing explains what happened when reality differs from the plan.',
        {
          type: 'quote',
          text: 'At peak, we observed that warm replicas reduced our p99 TTFT by 4x compared to cold-start scaling alone, because the weight-loading step -- which dominated our cold path at 45 seconds for a 70B model -- was entirely eliminated.',
          attribution: 'Composite from production serving reports at major LLM API providers (2024-2025)',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Warm pools fail in specific, predictable ways. Recognizing the failure mode matters more than knowing the success case.',
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Root cause', 'Fix'],
          rows: [
            ['Pool always wrong size', 'Idle waste during calm, SLO miss during spikes', 'Traffic is genuinely unpredictable (viral events, zero-day news)', 'Predictive pre-scaling using external signals (calendar, marketing schedule)'],
            ['Quota exhaustion', 'Policy requests GPUs that cannot be placed', 'Cloud region has no spare accelerators', 'Multi-region fallback, spot + on-demand mix, smaller model fallback'],
            ['Warm replicas are not actually warm', 'Activation takes 30s instead of 2s', 'Weight checkpoint corrupted, runtime needs re-init, health check flaky', 'Periodic warm-replica validation (synthetic health probe every 60s)'],
            ['Cost spiral', 'Warm floor keeps growing after each incident', 'Incident reviews always recommend "add more warm replicas"', 'Tie warm floor to load-test results, not incident count'],
            ['Cache-blind routing', 'New replicas get long-prompt traffic, blow TTFT', 'Router ignores prefix-cache state', 'Add cache-hit metadata to routing decisions'],
            ['False safety', 'Team assumes warm pool eliminates overload', 'No admission control, no load shedding', 'Warm pool is insurance, not infinite capacity -- pair with admission control'],
          ],
        },
        'The pattern also fails when the team treats warm capacity as a substitute for overload policy. A sufficiently large spike can consume any warm pool. Without admission control, deadline-aware routing, and load shedding, the service still accepts work it cannot finish. Warm pools reduce the probability and duration of overload; they do not repeal capacity limits.',
        'Finally, warm pools can hide quality regressions in operations. If cost pressure causes the team to shrink the floor without load tests, the product degrades gradually until the next incident. The antidote is a recurring scale audit that replays realistic bursts and compares demand, ready capacity, cost, and user impact.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace a morning burst for a multi-tenant chat API serving a 70B model on A100-80GB GPUs. The cluster starts with 3 hot replicas and 2 warm replicas. Each replica handles ~25 req/s of goodput.',
        {
          type: 'diagram',
          text: 'Timeline:\n\nt=0s    State: 3 hot (serving 60 req/s), 2 warm (idle), 0 cold\n        Demand: 60 req/s.  Headroom: 15 req/s.\n\nt=10s   Enterprise tenant starts workday. Demand jumps to 110 req/s.\n        Deficit: 110 - 75 = 35 req/s (3 hot at capacity).\n        Queue age starts climbing.\n\nt=15s   Metric scrape picks up queue_age_p95 = 3200ms (threshold: 2000ms).\n        Policy fires: activate 2 warm replicas, request 2 cold.\n\nt=17s   Warm replica W1 activated: route update, starts accepting.\n        State: 4 hot, 1 warm (activating), 2 cold (scheduling).\n        Capacity: 100 req/s. Deficit: 10 req/s. Admission sheds low-priority.\n\nt=18s   Warm replica W2 activated.\n        State: 5 hot, 0 warm, 2 cold (scheduling).\n        Capacity: 125 req/s. Demand: 110 req/s. Surplus restored.\n        Queue drains. TTFT p99 drops from 4200ms to 1800ms.\n\nt=35s   Cold replica C1 placed on GPU node. Image pull starts.\n\nt=50s   C1 image pulled. Weight loading begins (140 GB to HBM).\n\nt=80s   C1 weights loaded. Kernel warmup starts.\n\nt=90s   C1 passes readiness. Routed as hot.\n        State: 6 hot, 0 warm, 1 cold.\n\nt=120s  C2 ready. State: 7 hot, 0 warm.\n        But demand has leveled at 105 req/s.\n        Policy: convert C2 to warm (idle, weights loaded).\n        State: 6 hot, 1 warm.\n\nt=300s  Demand drops to 70 req/s. Downscale: 3 hot, 2 warm.\n        Warm replicas retain loaded weights for next burst.',
          label: 'Morning burst timeline: warm activation vs cold start',
        },
        {
          type: 'note',
          text: 'The critical window is t=10s to t=18s. Without warm replicas, the cluster would have zero surplus capacity until t=90s -- 80 seconds of degraded service. The warm pool compressed the recovery from 80 seconds to 8 seconds. During those 8 seconds, admission control shed approximately 35 low-priority requests rather than letting all requests degrade.',
        },
        'The scale-event ledger for this burst:',
        {
          type: 'code',
          language: 'text',
          text: 'Event: morning-burst-2026-06-19T09:00:10Z\n  Signal:           queue_age_p95 = 3200ms (threshold 2000ms)\n  Warm activated:   2 replicas in 8s (W1: 2s, W2: 3s)\n  Cold requested:   2 replicas\n  Cold ready:       2 replicas in 80s (C1) and 110s (C2)\n  Requests shed:    35 (low-priority, during 8s gap)\n  Deadline missed:  4 (in-flight at moment of spike)\n  TTFT p99 before:  4200ms\n  TTFT p99 after:   1800ms (within 5s SLO)\n  Cost of warm:     2 replicas * $2/hr * 14 idle hours = $56/day\n  Cost of 35 sheds: ~$0 (low-priority, retried successfully later)',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Lorido-Botran, Del Ser, Lozano, "A Review of Auto-scaling Techniques for Elastic Applications in Cloud Environments," Journal of Grid Computing, 2014. Foundational survey of autoscaling as a control-theory problem with transport delay.',
            'Kwon et al., "Efficient Memory Management for Large Language Model Serving with PagedAttention," SOSP 2023. Introduces vLLM and PagedAttention; KV cache management is directly relevant to why new replicas have lower goodput.',
            'Zhong et al., "DistServe: Disaggregating Prefill and Decoding for Goodput-optimized Large Language Model Serving," OSDI 2024. Shows that prefill and decode have different scaling characteristics, which affects how warm pools should be sized.',
            'Agrawal et al., "Taming Throughput-Latency Tradeoff in LLM Inference with Sarathi-Serve," OSDI 2024. Chunked prefill technique that interacts with warm-pool activation latency.',
            'Kubernetes HPA documentation and KEDA (Kubernetes Event-Driven Autoscaling) for custom metric scaling patterns used in production LLM deployments.',
            'Ray Serve autoscaling documentation for the replica-state model and deployment graph patterns used in frameworks like Anyscale.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Admission control and load shedding', 'Protects the gap before warm replicas activate and before cold replicas arrive'],
            ['Prerequisite', 'KV cache and prefix caching', 'Explains why new replicas produce lower goodput than cache-warm replicas'],
            ['Extension', 'Disaggregated prefill/decode serving', 'Prefill and decode scale independently, changing the warm-pool calculus'],
            ['Extension', 'Continuous batching and iteration-level scheduling', 'Determines how many concurrent requests a single warm replica can absorb'],
            ['Contrast', 'Serverless cold-start optimization (Lambda, Cloud Run)', 'Same transport-delay problem with different actuator costs (ms vs minutes)'],
          ],
        },
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Return to the animation after reading the article. In the lag-math view, verify that the vertical gap between demand and cold capacity at t=60s matches the number of requests that must be shed. In the warm-pool view, trace a request from the gate through a warm replica and observe that the KV cache starts cold. In the scale-audit view, confirm that every ledger row distinguishes requested capacity from ready capacity.',
        'Predict what happens if you remove the warm replicas entirely. The cold-capacity curve stays the same, but the gap widens by the warm-activation window. Every request in that expanded gap is either shed or served with blown SLO. That gap is the cost of not having a warm pool, denominated in user experience rather than dollars.',
      ],
    },
  ],
};

