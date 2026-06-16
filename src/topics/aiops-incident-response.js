// AIOps incident response: correlate telemetry into incidents, rank urgency by
// user impact, and close the loop with human-validated remediation.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'aiops-incident-response',
  title: 'AIOps Incident Response',
  category: 'Systems',
  summary: 'Use telemetry, anomaly detection, event correlation, and SLO-aware routing to turn alert floods into actionable incidents.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['telemetry funnel', 'incident loop'], defaultValue: 'telemetry funnel' },
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

function opsGraph(title) {
  return graphState({
    nodes: [
      { id: 'metrics', label: 'metrics', x: 0.8, y: 1.4, note: 'rates and gauges' },
      { id: 'logs', label: 'logs', x: 0.8, y: 3.6, note: 'events and errors' },
      { id: 'traces', label: 'traces', x: 0.8, y: 5.8, note: 'request paths' },
      { id: 'normalize', label: 'normalize', x: 3.0, y: 3.6, note: 'common labels' },
      { id: 'detect', label: 'detect', x: 5.0, y: 2.2, note: 'anomaly + SLO' },
      { id: 'correlate', label: 'correlate', x: 5.0, y: 5.0, note: 'dedupe + group' },
      { id: 'incident', label: 'incident', x: 7.1, y: 3.6, note: 'one actionable page' },
      { id: 'human', label: 'responder', x: 9.0, y: 3.6, note: 'mitigate + learn' },
    ],
    edges: [
      { id: 'e-metrics-normalize', from: 'metrics', to: 'normalize', weight: 'signal' },
      { id: 'e-logs-normalize', from: 'logs', to: 'normalize', weight: 'signal' },
      { id: 'e-traces-normalize', from: 'traces', to: 'normalize', weight: 'signal' },
      { id: 'e-normalize-detect', from: 'normalize', to: 'detect', weight: 'features' },
      { id: 'e-normalize-correlate', from: 'normalize', to: 'correlate', weight: 'context' },
      { id: 'e-detect-incident', from: 'detect', to: 'incident', weight: 'urgency' },
      { id: 'e-correlate-incident', from: 'correlate', to: 'incident', weight: 'root cluster' },
      { id: 'e-incident-human', from: 'incident', to: 'human', weight: 'page/ticket' },
    ],
  }, { title });
}

function* telemetryFunnel() {
  yield {
    state: opsGraph('Telemetry must be normalized before AI can help'),
    highlight: { active: ['metrics', 'logs', 'traces', 'normalize'], found: ['e-metrics-normalize', 'e-logs-normalize', 'e-traces-normalize'] },
    explanation: 'AIOps starts as data engineering. Metrics, logs, and traces must share service names, environments, versions, regions, and request identifiers before models can correlate them reliably.',
  };

  yield {
    state: labelMatrix(
      'From alert flood to incident',
      [
        { id: 'cpu', label: 'CPU high' },
        { id: 'latency', label: 'p99 latency' },
        { id: 'errors', label: '5xx errors' },
        { id: 'deploy', label: 'deploy event' },
        { id: 'incident', label: 'incident' },
      ],
      [
        { id: 'raw', label: 'raw alert' },
        { id: 'context', label: 'context' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['host-17 hot', 'same service and region', 'supporting signal'],
        ['checkout p99 up', 'user-visible SLI', 'primary symptom'],
        ['checkout 5xx up', 'same trace cluster', 'primary symptom'],
        ['version 42 rolled out', 'change window match', 'candidate cause'],
        ['checkout regression', 'one owner', 'page on-call'],
      ],
    ),
    highlight: { active: ['latency:decision', 'errors:decision', 'incident:decision'], found: ['deploy:context'] },
    explanation: 'The point is compression with context. A good AIOps system does not page five times; it groups related symptoms, attaches change context, and routes one incident to the right owner.',
    invariant: 'Correlation reduces alert count only when it preserves user impact and actionability.',
  };

  yield {
    state: opsGraph('Detection and correlation are separate jobs'),
    highlight: { active: ['detect', 'correlate'], found: ['e-detect-incident', 'e-correlate-incident'], compare: ['human'] },
    explanation: 'Anomaly detection asks whether a signal is unusual or budget-burning. Correlation asks which unusual signals likely belong to the same incident. Confusing the two creates noisy automated guesses.',
  };

  yield {
    state: labelMatrix(
      'Useful feature families',
      [
        { id: 'time', label: 'time' },
        { id: 'topology', label: 'topology' },
        { id: 'deploy', label: 'change' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'feature', label: 'feature' },
        { id: 'failure', label: 'failure caught' },
      ],
      [
        ['co-occurrence window', 'symptoms spike together'],
        ['service dependency graph', 'downstream blast radius'],
        ['new version/config', 'regression after rollout'],
        ['shared slow spans', 'one bottleneck across requests'],
      ],
    ),
    highlight: { found: ['topology:feature', 'trace:feature'], active: ['deploy:failure'] },
    explanation: 'The most useful models are often not exotic. Time windows, topology, deployment metadata, and trace context give correlation algorithms the structure human responders already use.',
  };
}

function* incidentLoop() {
  yield {
    state: labelMatrix(
      'SLO-aware routing',
      [
        { id: 'minor', label: 'minor anomaly' },
        { id: 'burnfast', label: 'fast burn' },
        { id: 'burnslow', label: 'slow burn' },
        { id: 'unknown', label: 'unknown impact' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'route', label: 'route' },
      ],
      [
        ['weird but no user impact', 'dashboard or ticket'],
        ['budget exhaustion in hours', 'page'],
        ['budget exhaustion in days', 'ticket'],
        ['missing SLI context', 'instrument first'],
      ],
    ),
    highlight: { active: ['burnfast:route', 'burnslow:route'], compare: ['minor:route', 'unknown:route'] },
    explanation: 'AIOps should not page because something looks statistically interesting. Page when user-visible reliability is burning fast enough that a human needs to respond now.',
  };

  yield {
    state: opsGraph('Human validation closes the loop'),
    highlight: { active: ['incident', 'human', 'e-incident-human'], found: ['normalize', 'correlate'] },
    explanation: 'The responder confirms or rejects the grouping, mitigates the incident, and records what actually happened. That feedback becomes labels for future correlation, routing, and suppression logic.',
  };

  yield {
    state: labelMatrix(
      'Automation maturity ladder',
      [
        { id: 'suggest', label: 'suggest' },
        { id: 'prepare', label: 'prepare' },
        { id: 'execute', label: 'execute' },
        { id: 'rollback', label: 'rollback' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'guardrail', label: 'guardrail' },
      ],
      [
        ['rank likely causes', 'show evidence links'],
        ['draft runbook steps', 'human approval'],
        ['restart or scale safe target', 'blast-radius limit'],
        ['revert bad deploy', 'SLO and canary checks'],
      ],
    ),
    highlight: { active: ['suggest:action', 'prepare:action'], compare: ['execute:guardrail', 'rollback:guardrail'] },
    explanation: 'Automation should climb slowly. Suggest causes first. Prepare commands next. Execute only low-risk actions with tight guardrails and measurable rollback criteria.',
  };

  yield {
    state: labelMatrix(
      'Failure modes to design against',
      [
        { id: 'labels', label: 'bad labels' },
        { id: 'feedback', label: 'missing feedback' },
        { id: 'overfit', label: 'overfit patterns' },
        { id: 'autonomy', label: 'unsafe autonomy' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['unrelated alerts grouped', 'standardize telemetry'],
        ['model never improves', 'capture incident outcome'],
        ['misses new failure class', 'keep human investigation path'],
        ['automation worsens outage', 'approval, canaries, rollback'],
      ],
    ),
    highlight: { active: ['labels:symptom', 'autonomy:symptom'], found: ['feedback:fix', 'overfit:fix'] },
    explanation: 'The AIOps failure mode is false confidence. If telemetry is messy, feedback is missing, or automation lacks guardrails, AI turns the incident system into a faster noise generator.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'telemetry funnel') yield* telemetryFunnel();
  else if (view === 'incident loop') yield* incidentLoop();
  else throw new InputError('Pick an AIOps incident-response view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'AIOps incident response applies machine learning and automation to operations telemetry. The goal is not to replace observability or on-call judgment. The goal is to turn metrics, logs, traces, deployments, topology, and runbook history into fewer, better incidents: grouped symptoms, ranked likely causes, clear owner, user-impact context, and safe next actions.',
        'OpenTelemetry defines the core signal families as traces, metrics, logs, baggage, and emerging profiles/events: https://opentelemetry.io/docs/concepts/signals/. Google SRE frames monitoring as collecting, processing, aggregating, and displaying real-time data about a system, while alerting should interrupt humans only for issues that deserve human response: https://sre.google/sre-book/monitoring-distributed-systems/. AIOps sits on top of that foundation; without clean telemetry, it has no stable input.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline has five jobs. First, collect telemetry from services, infrastructure, deployments, and user-facing SLIs. Second, normalize labels so service names, regions, versions, endpoints, and trace identifiers mean the same thing everywhere. Third, detect anomalies or SLO burn. Fourth, correlate related events using time proximity, service topology, trace paths, dependency edges, and recent changes. Fifth, route a single incident with evidence and recommended actions to the right owner.',
        'Detection and correlation are different. Detection says latency is unusual or the error budget is burning. Correlation says the latency spike, error spike, CPU spike, and deployment event likely belong to one checkout regression. A strong incident system keeps both questions visible so responders can audit the reasoning instead of receiving a mysterious AI verdict.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The expensive part is usually data quality, not the model. Services emit inconsistent labels. Logs omit trace IDs. Dashboards measure internal symptoms instead of user-facing SLIs. Deploy metadata lives in a separate system. Ownership maps are stale. The local corpus made the same point about AI engineering: production AI systems decay, drift, and break silently unless treated as systems with monitoring, versioning, feedback, and fallbacks.',
        'AIOps also has a precision-recall tradeoff. Suppress too aggressively and you hide real incidents. Page too eagerly and responders ignore the tool. Google SRE alerting guidance emphasizes precision, recall, detection time, and reset time, and recommends burn-rate style alerting when defending an SLO: https://sre.google/workbook/alerting-on-slos/. AIOps should improve that operating loop, not bypass it.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The strongest use cases are alert deduplication, change correlation, topology-aware grouping, noisy alert suppression, runbook recommendation, anomaly surfacing, and post-incident learning. For example, a deploy to checkout version 42, rising p99 latency, elevated 5xx errors, and traces showing database timeouts should become one incident with the deploy linked as candidate cause. The responder should see dashboards, traces, logs, recent changes, owner, SLO burn, and rollback/runbook options in one place.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The biggest misconception is that AIOps means autonomous remediation. Mature systems usually start with correlation and recommendations, then gradually automate low-risk actions. Restarting a process, scaling a worker pool, or rolling back a canary may be safe under guardrails; changing data, deleting resources, or mutating customer-visible state needs much stronger proof.',
        'Another trap is optimizing alert count instead of incident quality. Fewer alerts are not better if they hide user impact. More model sophistication is also not automatically better. A simple topology and deployment-aware correlation rule can beat a black-box model trained on messy, unlabeled incident history.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OpenTelemetry signals at https://opentelemetry.io/docs/concepts/signals/, OpenTelemetry observability primer at https://opentelemetry.io/docs/concepts/observability-primer/, Google SRE monitoring at https://sre.google/sre-book/monitoring-distributed-systems/, and SLO alerting guidance at https://sre.google/workbook/alerting-on-slos/. Study SLO Error Budget Burn Rate Alert, Log Template Drain Parser, Metric Label Cardinality Control, Distributed Tracing, Tail Latency & p99 Thinking, Circuit Breakers & Deadlines, Load Shedding & Graceful Degradation, Backpressure & Flow Control, and Feature Store next.',
      ],
    },
  ],
};
