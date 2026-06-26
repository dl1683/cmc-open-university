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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a feedback controller. HPA means HorizontalPodAutoscaler, a Kubernetes controller that reads metrics and writes replica count through a workload scale subresource. Active nodes show metric collection, recommendation, history, policy, and patching; compare nodes show raw recommendations that may be held, clamped, or ignored.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A fixed replica count is a guess about future demand. Too few Pods overload the service, while too many waste CPU, memory, and rollout capacity. HPA exists to turn observed pressure into replica recommendations, then filter those recommendations so noisy samples do not become noisy capacity changes.',
        {type:'callout', text:'HPA turns metrics into replica recommendations, then uses history and policy to keep noisy samples from becoming noisy capacity changes.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious autoscaler is a threshold rule: add Pods when CPU exceeds 80 percent and remove Pods when CPU falls below 40 percent. That rule is easy to explain and can work when traffic changes slowly. It fails when metrics are delayed, Pods start slowly, or one quiet sample arrives right after a burst.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is feedback delay. Metrics are sampled and aggregated, new Pods must schedule and become ready, and CPU can fall before warm capacity is safe to remove. A raw threshold can add replicas late, delete them early, and then recreate the same capacity during the next burst.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is proportional control with memory. The raw recommendation is approximately `ceil(currentReplicas * currentMetric / targetMetric)`, so a workload at twice the target wants about twice the replicas. Stabilization history, tolerance, min and max bounds, missing-metric rules, and scaling policies decide whether that raw number is safe to write.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On each sync, HPA finds the target workload, reads resource, custom, or external metrics, computes one desired replica count per metric, and usually chooses the largest usable recommendation. It skips tiny moves inside tolerance, handles not-yet-ready Pods and missing metrics conservatively, clamps to `minReplicas` and `maxReplicas`, applies scale velocity policies, consults stabilization history, and patches `/scale` only when the final value changes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a control invariant, not a proof of perfect capacity. If average per-Pod pressure is above target, adding replicas should reduce pressure per Pod; if pressure is below target, fewer replicas can carry the same work. The guardrails preserve useful behavior around that formula by preventing tiny oscillations, runaway scale, and immediate downscale after one low sample.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Controller cost grows with HPA count, metric count, sync frequency, and metrics adapter latency. The larger runtime cost is the capacity it creates: scaling from 20 to 60 Pods may triple CPU reservation, image pulls, endpoint churn, and cold-start load on dependencies. Doubling the number of HPAs doubles periodic metric reads even when no scale action happens.',
        'Scale-up behavior is bounded by metrics freshness, scheduler capacity, image pull speed, readiness, app warmup, and cluster spare nodes. Scale-down is often intentionally slower because deleting warm Pods too early can turn a recovered spike into another incident. The price of stability is holding capacity longer than the newest metric sample alone would suggest.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'HPA fits horizontally scalable workloads where more replicas really add throughput: CPU-bound APIs, queue workers with lag metrics, consumers with backlog, and services whose bottleneck is visible before users feel pain. It works best when Pods start quickly, readiness is honest, cluster autoscaling can add nodes in time, and the chosen metric tracks the limiting resource rather than a convenient average.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'HPA fails when capacity cannot arrive before damage occurs. Full clusters, slow images, cold caches, long readiness, and sudden traffic spikes can make replicas appear after the incident. It also fails when the metric hides the true bottleneck, such as average CPU masking one hot tenant, database saturation, lock contention, queue buildup, or a single overloaded Pod.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A checkout Deployment runs 6 replicas with a CPU target of 50 percent. A sample reports 72 percent average CPU, so the raw recommendation is `ceil(6 * 72 / 50) = ceil(8.64) = 9` replicas. If policy permits adding 3 replicas in this interval and `maxReplicas` is at least 9, HPA can patch the scale target to 9.',
        'Later, CPU falls to 45 percent, giving `ceil(9 * 45 / 50) = 9`, then to 30 percent, giving `ceil(9 * 30 / 50) = 6`. If a 300-second downscale stabilization window still contains a recent recommendation of 9, HPA holds 9 instead of shrinking immediately. When that high recommendation expires, the final patch can drop to 6 if policy allows it.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Use the official Kubernetes HorizontalPodAutoscaler concept page and autoscaling/v2 API reference as primary sources. They define the replica formula, metric types, tolerance, missing metrics, stabilization windows, scale policies, and `/scale` behavior.',
        'Study Kubernetes informers next to understand the controller state path, then scheduler placement for new Pods, Prometheus rule evaluation for metric production, and backpressure because autoscaling is slower than rejecting or queueing work at the service boundary.',
      ],
    },
  ],
};