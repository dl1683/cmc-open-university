// Kubernetes HPA: metric samples become replica recommendations, then a
// stabilization window and scaling policy decide whether to patch /scale.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-hpa-recommendation-ring-case-study',
  title: 'Kubernetes HPA Recommendation Ring Case Study',
  category: 'Systems',
  summary: 'How HorizontalPodAutoscaler reads metrics, computes desired replicas, stores recommendation history, applies tolerance and policies, and patches the scale subresource.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['replica formula', 'stabilization window'], defaultValue: 'replica formula' },
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

function hpaGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'pods', label: 'pods', x: 0.7, y: 4.2, note: notes.pods ?? 'load' },
      { id: 'metrics', label: 'metrics', x: 2.3, y: 2.8, note: notes.metrics ?? 'CPU/custom' },
      { id: 'hpa', label: 'HPA', x: 4.0, y: 4.2, note: notes.hpa ?? 'loop' },
      { id: 'calc', label: 'calc', x: 5.7, y: 2.8, note: notes.calc ?? 'desired' },
      { id: 'hist', label: 'history', x: 5.7, y: 5.6, note: notes.hist ?? 'window' },
      { id: 'policy', label: 'policy', x: 7.3, y: 4.2, note: notes.policy ?? 'clamp' },
      { id: 'scale', label: '/scale', x: 8.8, y: 4.2, note: notes.scale ?? 'patch' },
      { id: 'deploy', label: 'workload', x: 9.8, y: 4.2, note: notes.deploy ?? 'replicas' },
    ],
    edges: [
      { id: 'e-pods-metrics', from: 'pods', to: 'metrics' },
      { id: 'e-metrics-hpa', from: 'metrics', to: 'hpa' },
      { id: 'e-hpa-calc', from: 'hpa', to: 'calc' },
      { id: 'e-calc-hist', from: 'calc', to: 'hist' },
      { id: 'e-hist-policy', from: 'hist', to: 'policy' },
      { id: 'e-calc-policy', from: 'calc', to: 'policy' },
      { id: 'e-policy-scale', from: 'policy', to: 'scale' },
      { id: 'e-scale-deploy', from: 'scale', to: 'deploy' },
    ],
  }, { title });
}

function recommendationPlot(title = 'Recommendations enter a rolling history') {
  return plotState({
    axes: { x: { label: 'sync tick', min: 0, max: 6 }, y: { label: 'replicas', min: 2, max: 14 } },
    series: [
      { id: 'raw', label: 'raw rec', points: [{ x: 0, y: 6 }, { x: 1, y: 10 }, { x: 2, y: 8 }, { x: 3, y: 5 }, { x: 4, y: 4 }, { x: 5, y: 6 }] },
      { id: 'chosen', label: 'chosen', points: [{ x: 0, y: 6 }, { x: 1, y: 10 }, { x: 2, y: 10 }, { x: 3, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 6 }] },
    ],
    markers: [
      { id: 'peak', x: 1, y: 10, label: 'recent max' },
      { id: 'patch', x: 5, y: 6, label: 'patch' },
    ],
  }, { title });
}

function* replicaFormula() {
  yield {
    state: hpaGraph('HPA is a controller over the scale subresource'),
    highlight: { active: ['pods', 'metrics', 'hpa', 'e-pods-metrics', 'e-metrics-hpa'], compare: ['scale'] },
    explanation: 'HorizontalPodAutoscaler watches load through resource, custom, or external metrics, then writes desired replica count through a workload scale subresource. It is a feedback controller, not a request router.',
    invariant: 'HPA changes replica count; the scheduler still places each new Pod.',
  };

  yield {
    state: labelMatrix(
      'Replica formula snapshot',
      [
        { id: 'current', label: 'current' },
        { id: 'metric', label: 'metric' },
        { id: 'target', label: 'target' },
        { id: 'ratio', label: 'ratio' },
        { id: 'desired', label: 'desired' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'role', label: 'role' },
      ],
      [
        ['6 pods', 'now'],
        ['72% CPU', 'observed'],
        ['50% CPU', 'goal'],
        ['1.44x', 'pressure'],
        ['ceil 8.64 = 9', 'recommend'],
      ],
    ),
    highlight: { active: ['metric:value', 'target:value', 'ratio:value', 'desired:value'], found: ['current:value'] },
    explanation: 'The core calculation is proportional: current replicas times current metric divided by target metric, rounded up for scale-up. The simple formula is wrapped by readiness handling, missing metrics rules, tolerance, and policy limits.',
  };

  yield {
    state: hpaGraph('The raw recommendation is filtered before it patches scale', { calc: '9 pods', hist: 'record', policy: 'bounds', scale: 'write' }),
    highlight: { active: ['calc', 'hist', 'policy', 'scale', 'e-calc-hist', 'e-hist-policy', 'e-policy-scale'], compare: ['deploy'] },
    explanation: 'A raw recommendation enters a history buffer. The behavior policy can limit how fast the workload changes. This is where HPA turns noisy metrics into controlled replica updates.',
  };

  yield {
    state: labelMatrix(
      'Decision guards',
      [
        { id: 'tol', label: 'tol' },
        { id: 'min', label: 'min' },
        { id: 'max', label: 'max' },
        { id: 'miss', label: 'miss' },
      ],
      [
        { id: 'question', label: 'asks' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['near target?', 'skip tiny moves'],
        ['below min?', 'floor'],
        ['above max?', 'cap'],
        ['metric absent?', 'conservative'],
      ],
    ),
    highlight: { active: ['tol:effect', 'miss:effect'], found: ['min:effect', 'max:effect'] },
    explanation: 'The useful data structure is a decision record: observed metric, target, raw recommendation, tolerance result, min/max bounds, missing-metric adjustment, scaling policy, and final patch value.',
  };
}

function* stabilizationWindow() {
  yield {
    state: recommendationPlot('Downscale stabilization chooses from recent recommendations'),
    highlight: { active: ['raw', 'chosen', 'peak'], found: ['patch'] },
    explanation: 'The downscale stabilization window keeps recent recommendations and can choose a higher recent value instead of immediately following a low sample. That prevents replica count from flapping when metrics bounce around.',
    invariant: 'Stabilization is history-dependent control, not a new metric.',
  };

  yield {
    state: hpaGraph('Recommendation history acts like a small time-indexed ring', { hist: 'max over window', policy: 'hold/drop' }),
    highlight: { active: ['calc', 'hist', 'policy', 'e-calc-hist', 'e-hist-policy'], compare: ['scale'] },
    explanation: 'Implementation details can vary, but the conceptual shape is a bounded recommendation history keyed by time. On downscale, HPA consults that history before choosing the final desired replica count.',
  };

  yield {
    state: labelMatrix(
      'Scale behavior case',
      [
        { id: 'up', label: 'up' },
        { id: 'down', label: 'down' },
        { id: 'stale', label: 'stale' },
        { id: 'busy', label: 'busy' },
      ],
      [
        { id: 'policy', label: 'policy' },
        { id: 'result', label: 'result' },
      ],
      [
        ['fast allowed', 'add pods'],
        ['300s window', 'hold'],
        ['old rec expires', 'drop'],
        ['metric rises', 'scale up'],
      ],
    ),
    highlight: { active: ['down:policy', 'down:result', 'stale:result'], found: ['up:result'] },
    explanation: 'Scale-up usually reacts faster than scale-down. That asymmetry is deliberate: adding capacity is often safer than removing it while load samples are still volatile.',
  };

  yield {
    state: labelMatrix(
      'Complete case: checkout CPU spike',
      [
        { id: 't0', label: 't0' },
        { id: 't1', label: 't1' },
        { id: 't2', label: 't2' },
        { id: 't3', label: 't3' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'rec', label: 'rec' },
        { id: 'patch', label: 'patch' },
      ],
      [
        ['70%', '9', '9'],
        ['90%', '12', '12'],
        ['48%', '6', '12'],
        ['45%', '6', '6 later'],
      ],
    ),
    highlight: { active: ['t1:patch', 't2:patch'], found: ['t3:patch'] },
    explanation: 'Checkout scales from 6 to 12 during a spike. When CPU falls, the HPA records lower recommendations but waits for the downscale window before shrinking. The service avoids adding cold-start churn to a just-recovered incident.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'replica formula') yield* replicaFormula();
  else if (view === 'stabilization window') yield* stabilizationWindow();
  else throw new InputError('Pick a Kubernetes HPA view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A fixed replica count is a guess about future demand. If traffic doubles, too few Pods overload the service. If traffic falls, too many Pods waste CPU, memory, and rollout capacity. Humans can adjust replicas during planned events, but they cannot safely chase every load spike.',
        'HorizontalPodAutoscaler is Kubernetes control-loop machinery for this problem. It reads metrics, computes a desired replica count, filters that recommendation through guardrails, and writes the result through the target workload scale subresource.',
        {type:'callout', text:'HPA turns metrics into replica recommendations, then uses history and policy to keep noisy samples from becoming noisy capacity changes.'},
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The obvious approach is a threshold rule: if CPU is above 80 percent, add Pods; if CPU is below 40 percent, remove Pods. That rule is understandable, and it works when load changes slowly and startup time is short.',
        'The wall is feedback noise. Metrics are sampled, averaged, and delayed. New Pods need scheduling, image pulls, readiness, and warmup. CPU can drop right after a burst even though the next burst is seconds away. A raw threshold can add capacity late, remove it early, and then recreate the same Pods.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'HPA is a proportional controller wrapped in safety rails. The raw shape is desiredReplicas = ceil(currentReplicas * currentMetricValue / desiredMetricValue). If the metric is twice the target, the workload needs about twice as many replicas. If it is half the target, it can probably run with fewer.',
        'The recommendation ring solves the dangerous half of the loop. Scale-up usually wants to react quickly. Scale-down should remember recent high recommendations, because warm capacity that was needed a minute ago may still be needed after one quiet sample.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On each sync, the controller finds the scale target, selects the Pods owned by that target, reads resource, custom, or external metrics, and computes a utilization ratio. The default kube-controller-manager sync period is 15 seconds, but freshness still depends on the metrics pipeline.',
        'The raw recommendation is not the final patch. HPA applies tolerance to skip tiny moves, handles missing metrics and not-yet-ready Pods conservatively, clamps the result to minReplicas and maxReplicas, applies scale behavior policies, consults stabilization history, and only then writes /scale.',
        'If several metrics are configured, each metric can produce its own desired replica count. HPA uses the largest usable recommendation, because under-scaling one real pressure signal is usually worse than over-scaling against another.',
      ],
    },
    {
      heading: 'The recommendation history',
      paragraphs: [
        'The stabilization window is a small time-indexed memory of past desired states. For downscale, Kubernetes looks back over the configured interval and uses the highest recent desired value. The default downscale stabilization window is 300 seconds unless configured otherwise; scale-up has no stabilization window by default.',
        'That history acts like a rolling maximum, not a new metric. It says: if the controller recently proved the service needed more Pods, do not let one low sample delete that capacity immediately.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proportional formula preserves a simple control invariant: if average per-Pod pressure is above target, adding replicas should lower pressure per Pod; if pressure is below target, fewer replicas should carry the same work. The ratio measures how far the current state is from the target.',
        'The guardrails turn that simple idea into cluster-safe behavior. Tolerance avoids churn around the target. Bounds prevent runaway scale. Policies limit velocity. History makes downscale depend on recent evidence, not only the newest sample.',
      ],
    },
    {
      heading: 'What the diagram emphasizes',
      paragraphs: [
        'In the replica-formula view, follow the path from Pods to metrics to HPA to /scale. The important transition is where a metric ratio becomes a replica recommendation, then stops being a pure formula because tolerance, bounds, missing metrics, and behavior policy can change the final patch.',
        'In the stabilization-window view, compare the raw recommendation line with the chosen line. When raw recommendations fall, the chosen line can stay high because the recent maximum is still inside the window. When the old high value expires, the controller is allowed to shrink.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The controller work is periodic: fetch metrics, compute recommendations, update history, and patch /scale when the decision changes. Doubling the number of HPAs or metrics increases control-plane and metrics-system load, but the largest runtime cost is usually the Pods created by a scale-up.',
        'Scale-up speed is bounded by metrics freshness, sync period, scheduling, image pulls, readiness probes, application warmup, and cluster spare capacity. Scale-down can be intentionally slow, because removing capacity too early can turn a recovered spike into another incident.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'HPA fits stateless or horizontally scalable services with a metric that tracks real pressure: CPU-bound APIs, worker pools with a queue-depth metric, consumers with lag, and services where extra replicas actually add throughput.',
        'It works best when the cluster has spare nodes or fast node autoscaling, Pods start quickly, readiness probes are honest, and the target metric rises before users feel pain.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'HPA is not instant capacity. If the cluster is full, images are large, readiness is slow, or traffic spikes faster than the loop can observe, new replicas arrive after the damage.',
        'It also fails when the metric is a proxy for the wrong bottleneck. Average CPU can hide queue buildup, lock contention, database saturation, a hot shard, or one overloaded Pod. Noisy custom metrics without stabilization can make replicas flap.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A checkout Deployment runs 6 replicas with a CPU target of 50 percent. A sample reports 72 percent average CPU, so the proportional recommendation is ceil(6 * 72 / 50) = 9 replicas. HPA records that recommendation and may patch /scale after behavior policy allows it.',
        'Later the raw recommendation drops. The downscale window keeps the higher recent recommendation alive, so the workload holds warm capacity. After the high recommendation ages out, the final patch can fall to the lower value.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Watch for CPU targets without CPU requests, metrics adapters that lag or fail, readiness probes that mark cold Pods ready too early, scale policies that are too aggressive for startup time, and minReplicas values that are below safe baseline capacity.',
        'The most subtle failure is average-based blindness. One overloaded Pod, one hot tenant, or one saturated dependency can disappear inside a healthy mean. HPA can only control the signal it sees.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Choose the metric from the bottleneck, not from habit. CPU is reasonable for CPU-bound services with valid requests and stable per-request work. Queue depth, consumer lag, request concurrency, or custom throughput signals are better when work waits outside the Pod before CPU rises.',
        'Set minReplicas from resilience needs, not from average cost. A service may need enough warm Pods to survive one zone issue, one slow rollout batch, or a normal morning spike before autoscaling reacts. HPA is a controller after baseline capacity, not a substitute for baseline capacity.',
        'Audit HPA decisions during incidents. Capture the raw metric, chosen metric, missing metric behavior, readiness handling, tolerance result, stabilization history, scale policy, and final /scale patch. Without that record, teams often blame the workload when the real problem was a stale adapter, too-low maxReplicas, or a cold-start delay.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Current official sources: Kubernetes HPA concept docs at https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/ and the autoscaling/v2 API reference at https://kubernetes.io/docs/reference/kubernetes-api/autoscaling/horizontal-pod-autoscaler-v2/.',
        'Study next by role: Kubernetes Reconciliation for the controller pattern, Kubernetes Informer DeltaFIFO Workqueue for watch-driven controller state, Kubernetes Scheduler PriorityQueue Preemption for where new Pods go, Prometheus Rule Evaluation for metric production, SLO Error Budget Burn Rate Alert for user-impact signals, and Backpressure for protecting a service before scale-out catches up.',
      ],
    },
  ],
};
