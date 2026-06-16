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
      heading: 'What it is',
      paragraphs: [
        'HorizontalPodAutoscaler is a Kubernetes control loop that adjusts replica count for scalable workloads. It reads metrics, computes desired replicas, applies bounds and behavior rules, then patches the workload scale subresource.',
        'The official HPA concept page describes the control loop, metric ratio formula, tolerance, missing metric handling, and stabilization behavior: https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/. The API reference defines the autoscaling/v2 object fields, including metrics, minReplicas, maxReplicas, scaleTargetRef, and behavior: https://kubernetes.io/docs/reference/kubernetes-api/autoscaling/horizontal-pod-autoscaler-v2/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The data structure is a controller ledger. Each sync tick needs target reference, current replicas, per-metric observed value, target value, raw desired replicas, readiness and missing-metric adjustments, tolerance result, min/max bounds, behavior policy, recommendation history, and final scale patch.',
        'The downscale stabilization window is easiest to understand as a bounded time-indexed recommendation buffer. Recent high recommendations can delay shrinking so a workload does not flap during temporary metric dips.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A checkout Deployment runs 6 replicas with a CPU target of 50 percent. During a promotion, average CPU reaches 90 percent. HPA recommends ceil(6 * 90 / 50) = 11 replicas, then caps or rounds according to policy and patches /scale. Two minutes later CPU falls below target. The downscale window preserves a higher recent recommendation, so the workload holds capacity until the spike is clearly over.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'HPA is not magic capacity. New Pods still need scheduler placement, image pulls, readiness probes, and warm caches. Metrics that arrive late or disappear can make the controller conservative. Scaling on noisy custom metrics without a stabilization policy can create oscillation.',
        'Study next: Kubernetes Scheduler Priority Queue & Preemption for where new Pods go, Kubernetes Reconciliation for the controller pattern, Prometheus Rule Evaluation for metric production, SLO Error Budget Burn Rate Alert for user-impact scaling signals, and Backpressure for load control before scaling catches up.',
      ],
    },
  ],
};
