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
      heading: 'Why this exists',
      paragraphs: [
        'A normal Kubernetes rollout can replace pods gradually, but readiness probes only prove that a container started and answered its health check. They do not prove that the new revision handles real traffic, preserves latency, keeps error rates low, or avoids breaking a downstream dependency.',
        'Progressive delivery adds a control loop around the rollout. Flagger watches a workload, sends a small slice of traffic to the candidate, measures behavior, then either increases exposure, promotes the candidate, or rolls traffic back to the stable version.',
      ],
    },
    {
      heading: 'The naive rollout hides the real risk',
      paragraphs: [
        'The simple approach is to deploy the new version and trust readiness, alerts, and humans. That can work for low-risk services, but it exposes too much traffic before the system has evidence. By the time dashboards show the problem, the new revision may already be serving most users.',
        'A manual canary is the next step: change traffic weights by hand, watch metrics, and roll back if something looks bad. That process is slow and inconsistent. Flagger turns it into a repeatable release state machine with explicit gates.',
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        'Flagger separates release intent from release evidence. The desired change is the new workload revision. The evidence is the analysis: traffic percentage, metric windows, webhook checks, threshold failures, and promotion or rollback decisions.',
        'The invariant is simple: traffic weight should advance only after the current analysis interval passes. If a gate fails enough times, the controller stops increasing exposure and routes traffic back to primary.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the canary loop view, follow the cycle rather than the nodes individually. Deploy creates a candidate. Flagger starts analysis. The mesh or ingress changes weights. Metrics and webhooks judge the current slice of traffic. The result either advances the loop or sends it to rollback.',
        'In the metric gate view, the important state change is the gate decision. A green metric does not promote the whole release by itself; it permits the next weight step. A failed gate removes traffic from the candidate and preserves the reason for later debugging.',
        'The primary and canary nodes represent separate serving targets. The mesh node is the blast-radius control. The metric node is the evidence source. The result node is the controller decision that closes the feedback loop.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A workload change starts analysis. Flagger can manage primary and canary resources, update routes through supported service meshes, ingress controllers, or Gateway API providers, and evaluate metric templates and webhooks on an interval.',
        'A typical canary has a step weight, maximum weight, analysis interval, threshold for failed checks, and one or more metrics. At each interval the controller asks whether the current candidate traffic is healthy enough to continue.',
        'Webhooks extend the metric checks. They can run smoke tests, load tests, conformance checks, manual approvals, or custom validation. In Flagger, webhook success is interpreted from the HTTP response, so the check must be reliable and specific.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A checkout API deploys a new revision. Flagger sends 5 percent of traffic to canary, checks success rate and p99 latency, and runs a webhook that performs a synthetic checkout. The first interval passes, so traffic moves to 10 percent.',
        'At 25 percent, p99 latency crosses the threshold and checkout errors rise. The gate fails. After the configured failure threshold, Flagger aborts analysis, routes traffic back to primary, and records the failed revision, traffic weight, metric window, and decision reason.',
        'The important result is not that the release was magically safe. The result is bounded blast radius plus evidence. A smaller slice of users saw the bad revision, and the team has a release record that points to the failing condition.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The control loop works because it makes exposure monotonic and conditional. The candidate cannot jump from zero to full traffic unless policy says the steps can be that large. Each step creates a chance to observe real behavior before the next increase.',
        'Rollback works because traffic routing is controlled outside the candidate application. If the canary misbehaves, the mesh or ingress can stop sending traffic to it without waiting for the bad pods to become healthy or for humans to redeploy the old version.',
        'The correctness is operational rather than mathematical. Flagger can enforce the rollout policy exactly, but the policy is only as good as its measurements, thresholds, routing representativeness, and failure handling.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Progressive delivery adds release latency. A rollout that could finish in seconds may take minutes because the controller waits for analysis windows. That delay is the cost of gathering evidence before increasing blast radius.',
        'It also adds control-plane dependencies. The mesh or ingress must support traffic shifting, the metrics backend must answer queries on time, and webhooks must be reachable. If those dependencies are flaky, the rollout can stall or fail for reasons unrelated to the candidate code.',
        'Metric choice dominates practical behavior. Success rate and average latency may miss tail latency, tenant-specific failures, cost spikes, or a broken path that receives little traffic during the canary interval.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'Flagger fits services with observable request traffic, clear rollback targets, and metrics that correlate with user harm. APIs, web frontends, model gateways, and service-mesh workloads are natural candidates because traffic can be split and measured while both versions run.',
        'It also fits GitOps environments. A desired workload change lands in the cluster, and the controller handles the measured rollout without turning every release into a manual dashboard-watching exercise.',
        'The best candidates are reversible service changes with enough traffic during the analysis window.',
      ],
    },
    {
      heading: 'Where it is not the right tool',
      paragraphs: [
        'It is weak for releases with no meaningful live traffic during analysis, batch jobs whose failures appear hours later, schema changes that are not backward compatible, and changes where one request can cause irreversible damage.',
        'It is also the wrong abstraction when exposure must be controlled by user cohort or product entitlement inside the application. Feature flags are better for user-level targeting. Flagger is better for traffic-layer rollout and rollback.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A canary can pass for the wrong reason. Low sample counts, traffic that misses the risky path, noisy p99 windows, masked errors, bad Prometheus queries, and flaky webhooks can all approve a candidate that should fail.',
        'A canary can also fail for the wrong reason. Shared dependency outages, unrelated primary failures, bad baselines, or metric backend problems can blame the candidate. Good release records keep raw metric windows and hook logs so the team can separate code failure from measurement failure.',
        'Rollback is not full recovery if the release performed irreversible work. Database migrations, message format changes, cache poisoning, and external side effects need compatibility plans before traffic shifting starts.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Feature Flag Control Plane for application-level exposure, Argo CD GitOps Application Reconcile for desired-state delivery, Helm Release Revision Ledger for release history, Envoy xDS Service Mesh Case Study for traffic control, Prometheus TSDB Case Study for metric storage, and Distributed Tracing for finding which candidate path failed.',
        'Primary sources: Flagger docs at https://docs.flagger.app/, deployment strategies at https://docs.flagger.app/usage/deployment-strategies, how-it-works notes at https://docs.flagger.app/usage/how-it-works, webhooks at https://docs.flagger.app/usage/webhooks, and the Flagger repository at https://github.com/fluxcd/flagger.',
      ],
    },
  ],
};
