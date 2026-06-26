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
    { heading: 'How to read the animation', paragraphs: [
        'Read the canary loop as a controller. Active nodes show the candidate revision receiving a measured slice of traffic. Found nodes show gates that passed, and compare edges show the controller comparing live metrics against policy thresholds.',
        'The metric gate view defines the release rule. A green interval does not prove the whole release is safe; it permits the next traffic step. A failed interval stops promotion and routes traffic back to the stable primary.',
        {type:'callout', text:'Progressive delivery turns rollout into a measured control loop where traffic advances only after evidence passes.'},
      ] },
    { heading: 'Why this exists', paragraphs: [
        'A Kubernetes readiness probe proves that a container answered a health check. It does not prove the new revision handles real traffic, preserves p99 latency, keeps error rates low, or avoids breaking dependencies. Progressive delivery exists to measure those facts before full exposure.',
      ] },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is a normal rolling deployment. Replace pods gradually, rely on readiness, and watch dashboards. A manual canary improves this by changing weights by hand, but it depends on operator attention and inconsistent judgment.',
      ] },
    { heading: 'The wall', paragraphs: [
        'The wall is delayed evidence. By the time dashboards show a failure, the candidate may already serve most users. A rollout needs explicit state: current weight, metric window, threshold, failed-check count, rollback target, and decision reason.',
      ] },
    { heading: 'The core insight', paragraphs: [
        'Separate release intent from release evidence. The desired change is the new workload revision, while the evidence is the analysis over traffic percentage, metric windows, webhooks, and thresholds. Traffic advances only after the current interval passes.',
      ] },
    { heading: 'How it works', paragraphs: [
        'Flagger watches a workload, creates primary and canary targets, and shifts traffic through a service mesh, ingress controller, or Gateway API provider. Each interval queries metrics and runs webhooks. A canary might move 5 percent, 10 percent, then 25 percent only if success rate and latency stay inside bounds.',
      ] },
    { heading: 'Why it works', paragraphs: [
        'Correctness is operational. Flagger can enforce the configured rollout state machine exactly, though it cannot prove the code is correct. Rollback works because traffic routing is controlled outside the candidate application, so the mesh can stop sending requests to the bad revision.',
      ] },
    { heading: 'Cost and complexity', paragraphs: [
        'Progressive delivery spends time to buy evidence. A rollout that could finish in 30 seconds may take 10 minutes across ten 1-minute intervals. It also depends on the metrics backend, traffic layer, and webhook reliability. Bad metrics can either pass a broken release or abort a healthy one.',
      ] },
    { heading: 'Real-world uses', paragraphs: [
        'Flagger fits APIs, web frontends, model gateways, and service-mesh workloads where both versions can run at once and traffic can be split. It also fits GitOps environments where a desired change lands in the cluster and a controller owns measured rollout.',
      ] },
    { heading: 'Where it fails', paragraphs: [
        'It is weak for batch jobs, low-traffic services, incompatible schema changes, and failures that appear hours later. It also cannot undo irreversible side effects such as bad database writes or external messages. Feature flags are better when exposure must follow user cohorts rather than traffic weights.',
      ] },
    { heading: 'Worked example', paragraphs: [
        'A checkout API deploys version 2. Flagger sends 5 percent of traffic for 1 minute and requires success above 99 percent, p99 latency below 400 ms, and a synthetic checkout webhook. The first interval sees 20,000 requests, 99.4 percent success, and 310 ms p99, so traffic moves to 10 percent. At 25 percent, success falls to 97.8 percent and p99 reaches 650 ms. After the configured failed-check threshold, Flagger aborts and routes traffic back to primary.',
      ] },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources: Flagger docs at https://docs.flagger.app/, deployment strategies at https://docs.flagger.app/usage/deployment-strategies, how-it-works notes at https://docs.flagger.app/usage/how-it-works, webhooks at https://docs.flagger.app/usage/webhooks, and the Flagger repository at https://github.com/fluxcd/flagger.',
        'Study Feature Flag Control Plane, Argo CD GitOps Application Reconcile, Envoy xDS Service Mesh Case Study, Prometheus TSDB Case Study, and Distributed Tracing next.',
      ] },
  ],
};
