// Flagger progressive delivery: canary traffic is shifted gradually while
// metrics, webhooks, and service-mesh controls decide promote or rollback.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'flagger-progressive-delivery-canary-case-study',
  title: 'Flagger Progressive Delivery Canary Case Study',
  category: 'Systems',
  summary: 'A progressive-delivery primer: canary resources, traffic shifting, metric templates, analysis intervals, webhooks, promotion, rollback, and mesh control.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['canary loop', 'metric gate'], defaultValue: 'canary loop' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function canaryGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'deploy', label: 'deploy', x: 0.7, y: 3.8, note: notes.deploy ?? 'new rev' },
      { id: 'flagger', label: 'flag', x: 2.2, y: 3.8, note: notes.flagger ?? 'loop' },
      { id: 'mesh', label: 'mesh', x: 3.85, y: 2.1, note: notes.mesh ?? 'weights' },
      { id: 'prim', label: 'prim', x: 5.55, y: 1.8, note: notes.prim ?? 'stable' },
      { id: 'canary', label: 'can', x: 5.55, y: 5.8, note: notes.canary ?? 'new' },
      { id: 'metrics', label: 'metric', x: 7.35, y: 2.1, note: notes.metrics ?? 'SLO' },
      { id: 'gate', label: 'gate', x: 7.35, y: 5.8, note: notes.gate ?? 'pass?' },
      { id: 'result', label: 'result', x: 9.15, y: 3.8, note: notes.result ?? 'promote/back' },
    ],
    edges: [
      { id: 'e-deploy-flagger', from: 'deploy', to: 'flagger', weight: '' },
      { id: 'e-flagger-mesh', from: 'flagger', to: 'mesh', weight: '' },
      { id: 'e-mesh-prim', from: 'mesh', to: 'prim', weight: '' },
      { id: 'e-mesh-canary', from: 'mesh', to: 'canary', weight: '' },
      { id: 'e-prim-metrics', from: 'prim', to: 'metrics', weight: '' },
      { id: 'e-canary-metrics', from: 'canary', to: 'metrics', weight: '' },
      { id: 'e-metrics-gate', from: 'metrics', to: 'gate', weight: '' },
      { id: 'e-gate-result', from: 'gate', to: 'result', weight: '' },
      { id: 'e-result-flagger', from: 'result', to: 'flagger', weight: '' },
    ],
  }, { title });
}

function* canaryLoop() {
  yield {
    state: canaryGraph('A new deployment starts a canary analysis loop'),
    highlight: { active: ['deploy', 'flagger', 'mesh', 'canary', 'e-deploy-flagger', 'e-flagger-mesh', 'e-mesh-canary'], compare: ['prim'] },
    explanation: 'Flagger watches workload changes and starts a canary analysis. It creates or manages primary and canary targets, then uses a router or service mesh to shift a small amount of traffic to the new version.',
  };

  yield {
    state: labelMatrix(
      'Step',
      [
        { id: 'init', label: 'init' },
        { id: 'shift', label: 'shift' },
        { id: 'check', label: 'check' },
        { id: 'prom', label: 'prom' },
        { id: 'abort', label: 'abort' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['clone', 'bad spec'],
        ['+10%', 'p99'],
        ['query', 'noise'],
        ['copy', 'late bug'],
        ['0%', 'flap'],
      ],
    ),
    highlight: { active: ['init:move', 'shift:move', 'check:move', 'prom:move'], compare: ['abort:risk'] },
    explanation: 'The canary loop is a state machine: initialize, shift traffic, query metrics, advance if gates pass, promote at the end, or abort and route traffic back to primary if gates fail.',
    invariant: 'Traffic weight should move only when analysis evidence passes.',
  };

  yield {
    state: canaryGraph('Traffic weights advance one gate at a time', { mesh: '10/90', metrics: 'prom', gate: 'pass', result: 'next' }),
    highlight: { active: ['mesh', 'prim', 'canary', 'metrics', 'gate', 'result', 'e-mesh-prim', 'e-mesh-canary', 'e-metrics-gate', 'e-gate-result'], found: ['flagger'] },
    explanation: 'A mesh or ingress controller owns the traffic split. Flagger owns the analysis loop. Metrics and webhooks tell the loop whether the current weight is safe enough to continue.',
  };

  yield {
    state: labelMatrix(
      'Case',
      [
        { id: 'api', label: 'api' },
        { id: 'web', label: 'web' },
        { id: 'llm', label: 'LLM' },
        { id: 'batch', label: 'batch' },
      ],
      [
        { id: 'route', label: 'route' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['mesh', '5xx'],
        ['ing', 'lat'],
        ['gw', 'cost'],
        ['job', 'test'],
      ],
    ),
    highlight: { active: ['api:gate', 'web:gate', 'llm:gate', 'batch:gate'], compare: ['batch:route'] },
    explanation: 'Complete case study: an API deployment shifts 10 percent of traffic to canary every minute. The gate checks success rate, p99 latency, and a smoke-test webhook. A single failed interval pauses or rolls back depending on policy.',
  };
}

function* metricGate() {
  yield {
    state: canaryGraph('Metric templates turn telemetry into pass or fail signals', { metrics: 'query', gate: 'threshold', result: 'decision' }),
    highlight: { active: ['metrics', 'gate', 'result', 'e-metrics-gate', 'e-gate-result'], compare: ['mesh'] },
    explanation: 'A progressive rollout is only as good as its measurements. Flagger can query metrics providers and run webhooks. The analysis gates convert telemetry into promote, pause, or rollback decisions.',
  };

  yield {
    state: labelMatrix(
      'Gate',
      [
        { id: 'sr', label: 'succ' },
        { id: 'lat', label: 'p99' },
        { id: 'err', label: 'err' },
        { id: 'hook', label: 'hook' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'bad', label: 'bad' },
      ],
      [
        ['>=99', 'low n'],
        ['<500', 'tail'],
        ['<1%', 'mask'],
        ['pass', 'flaky'],
        ['cap', 'blind'],
      ],
    ),
    highlight: { active: ['sr:check', 'lat:check', 'hook:check'], compare: ['cost:bad'] },
    explanation: 'Metric gates need enough traffic to be meaningful. Low sample counts, noisy p99, masked errors, flaky webhooks, and unmeasured cost can all make a canary look safer than it is.',
  };

  yield {
    state: canaryGraph('Rollback routes traffic away from the candidate', { mesh: '0/100', canary: 'bad', metrics: 'fail', gate: 'abort', result: 'rollback' }),
    highlight: { active: ['canary', 'metrics', 'gate', 'result', 'mesh', 'e-canary-metrics', 'e-metrics-gate', 'e-gate-result', 'e-result-flagger'], removed: ['e-mesh-canary'], found: ['prim'] },
    explanation: 'When analysis fails, the control loop should remove traffic from the candidate, mark the canary failed, and leave enough evidence for the team to know whether the failure was code, config, dependency, or measurement.',
  };

  yield {
    state: labelMatrix(
      'Audit',
      [
        { id: 'rev', label: 'rev' },
        { id: 'wgt', label: 'wgt' },
        { id: 'met', label: 'met' },
        { id: 'hook', label: 'hook' },
        { id: 'why', label: 'why' },
      ],
      [
        { id: 'keep', label: 'keep' },
        { id: 'use', label: 'use' },
      ],
      [
        ['sha', 'repro'],
        ['pct', 'blast'],
        ['raw', 'debug'],
        ['log', 'proof'],
        ['code', 'learn'],
      ],
    ),
    highlight: { active: ['rev:keep', 'wgt:keep', 'met:keep', 'why:use'], compare: ['hook:use'] },
    explanation: 'The canary record should keep revision, weight schedule, metric windows, webhook results, decision reason, and rollback action. That turns progressive delivery from vibes into an auditable release ledger.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'canary loop') yield* canaryLoop();
  else if (view === 'metric gate') yield* metricGate();
  else throw new InputError('Pick a Flagger canary view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Flagger is a progressive delivery controller for Kubernetes. It automates canary analysis, traffic shifting, promotion, and rollback by integrating with service meshes, ingress controllers, metrics providers, and webhooks. The data structure is a release state machine with measured gates.',
        'Primary sources: Flagger homepage at https://flagger.app/, Flagger docs at https://docs.flagger.app/, and Flagger GitHub repository at https://github.com/fluxcd/flagger. The repository summary describes Flagger as automating releases by gradually shifting traffic while measuring metrics and running conformance tests.',
      ],
    },
    {
      heading: 'Canary loop',
      paragraphs: [
        'A workload change starts analysis. Flagger manages primary and canary targets, updates traffic weights through a mesh or ingress controller, checks metric templates and webhooks, and either advances, promotes, or aborts. The loop is a controller: observe, decide, mutate traffic, wait, and observe again.',
        'This extends Feature Flag Control Plane. Feature flags decide exposure inside application code. Flagger decides exposure at the traffic layer. Both need stable cohorts, observability, and rollback evidence.',
      ],
    },
    {
      heading: 'Metric gates',
      paragraphs: [
        'Metric gates should reflect the actual risk. Success rate, request duration, error budget, saturation, cost, and business events may all matter. Webhooks can run smoke tests, load tests, conformance checks, or manual approval bridges. A gate without enough traffic is not evidence; it is a weak sample.',
        'Prometheus TSDB Case Study explains the metric store behind many rollout gates. Envoy xDS Service Mesh Case Study explains the data-plane control that can shift traffic. Distributed Tracing can connect failures back to the candidate revision.',
      ],
    },
    {
      heading: 'Complete case study: checkout API canary',
      paragraphs: [
        'A checkout API deploys a new revision. Flagger routes 5 percent of traffic to canary, queries success rate and p99 latency, runs a webhook that performs synthetic checkout, then advances to 10, 25, and 50 percent. At 25 percent, p99 exceeds the threshold and checkout errors rise. Flagger aborts, shifts traffic back to primary, and records the failed analysis.',
        'The result is a bounded blast radius. Only a slice of traffic saw the candidate, and the release ledger keeps the revision, traffic weights, metric windows, webhook results, and rollback decision for debugging.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Progressive delivery is not a guarantee of safety. Bad metrics, low samples, hidden tenant slices, missing cost telemetry, and flaky hooks can all approve a bad release. Canary traffic also needs representative routing; a small percent that misses the risky path proves little.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Feature Flag Control Plane, Argo CD GitOps Application Reconcile, Helm Release Revision Ledger, Envoy xDS Service Mesh Case Study, Prometheus TSDB Case Study, Metric Exemplars Trace Correlation, Distributed Tracing, and LLM Model Rollout Shadow Canary Ledger next.',
      ],
    },
  ],
};
