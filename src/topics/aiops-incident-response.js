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
      heading: 'Why this exists',
      paragraphs: [
        'AIOps incident response exists because modern systems produce more operational evidence than humans can sort during an outage. A single customer-visible failure may create metric alerts, log errors, trace slowdowns, deployment events, infrastructure warnings, queue-depth changes, and downstream symptoms across many services.',
        'The goal is not to replace observability or on-call judgment. The goal is to turn a flood of weak signals into one useful incident: grouped symptoms, user-impact context, likely owners, recent changes, evidence links, and safe next actions. A good AIOps system reduces search time. It does not pretend uncertainty has disappeared.',
        {type: 'callout', text: 'AIOps is evidence compression: preserve user impact and actionability while reducing alert noise.'},
        'OpenTelemetry defines the core signal families as traces, metrics, logs, baggage, and emerging profiles/events: https://opentelemetry.io/docs/concepts/signals/. Google SRE frames monitoring as collecting, processing, aggregating, and displaying real-time data about a system, while alerting should interrupt humans only for issues that deserve human response: https://sre.google/sre-book/monitoring-distributed-systems/. AIOps sits on top of that foundation; without clean telemetry, it has no stable input.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to feed every alert into a model and ask for the root cause. That sounds attractive because incidents are stressful and responders want a single answer. It fails because the raw data is usually inconsistent, incomplete, and overloaded with correlations that are not causes.',
        'Another shortcut is to optimize for fewer pages. Fewer alerts are helpful only if they preserve actionability and user impact. Suppressing related alerts can be good. Suppressing the only alert that showed a real SLO burn is dangerous. Incident quality matters more than alert count.',
        'The real work starts earlier: label hygiene, ownership maps, service topology, deployment metadata, trace propagation, SLO definitions, and feedback from resolved incidents. AIOps cannot be more trustworthy than the operational data model underneath it.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that incident response is evidence compression under time pressure. The system must preserve the facts a responder needs while removing duplicate, stale, and low-impact noise. The useful output is not a magic diagnosis; it is a compact, auditable incident packet.',
        'Detection and correlation are separate jobs. Detection asks whether a signal is unusual or whether an error budget is burning. Correlation asks which unusual signals likely belong to the same incident. Root-cause analysis asks which change, dependency, or resource is most plausible given the evidence. Mixing these jobs creates false confidence.',
        'A strong system keeps uncertainty visible. It should say which signals changed, which services are affected, which user-facing objective is at risk, which deploys or config changes occurred, and why a proposed owner or action was selected. That is what lets a human verify quickly instead of debugging the AIOps tool itself.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline has five jobs. First, collect telemetry from services, infrastructure, deployments, and user-facing SLIs. Second, normalize labels so service names, regions, versions, endpoints, and trace identifiers mean the same thing everywhere. Third, detect anomalies or SLO burn. Fourth, correlate related events using time proximity, service topology, trace paths, dependency edges, and recent changes. Fifth, route a single incident with evidence and recommended actions to the right owner.',
        'Feature quality usually beats exotic modeling. Time co-occurrence says which signals changed together. Topology shows whether one service is upstream of another. Deployment metadata tells whether a new version or config landed before the symptom. Trace context links slow spans and failing requests. Ownership maps tell who can act.',
        {type: 'image', src: 'https://opentelemetry.io/docs/specs/otel/metrics/img/model-layers.png', alt: 'OpenTelemetry metrics model layers from event stream to timeseries.', caption: 'Telemetry needs a shared data model before correlation can be reliable. (Source: opentelemetry.io)'},
        'The feedback loop matters. After the incident, responders should confirm or reject the grouping, record the actual cause, mark useful and useless evidence, and note which action fixed or mitigated the issue. That turns the system from a one-shot classifier into an operational learning loop.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The telemetry-funnel view proves that AIOps begins as data engineering. Metrics, logs, and traces must share labels before they can be joined. If service names, regions, versions, and trace identifiers disagree, correlation becomes guesswork.',
        'The alert-flood table proves the main value: compression with context. CPU, latency, errors, and deploy events should not become separate pages if they are all evidence for one checkout regression. But the grouping must preserve the primary symptom and user impact.',
        'The incident-loop view proves why automation should climb gradually. Suggest likely causes first. Prepare runbook steps next. Execute only low-risk actions with explicit guardrails, blast-radius limits, canary checks, and rollback criteria.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'AIOps works when it uses structure humans already rely on. Responders ask what changed, what users feel, which dependency is upstream, where traces slow down, whether a rollout overlaps the failure, and who owns the component. Encoding those questions into the system can reduce minutes of search during high-pressure work.',
        'It also works because many alerts are not independent. One database bottleneck can raise p99 latency, trigger queue growth, increase retries, cause 5xx errors, and page downstream services. Correlation saves attention by recognizing shared context.',
        'SLO-aware routing works because not every anomaly deserves the same response. A weird internal metric with no user impact may become a ticket. A fast error-budget burn should page. Unknown impact may mean instrumentation must improve before automation should escalate.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The expensive part is usually data quality, not the model. Services emit inconsistent labels. Logs omit trace IDs. Dashboards measure internal symptoms instead of user-facing SLIs. Deploy metadata lives in a separate system. Ownership maps are stale. Incident outcomes are often written in prose that no training loop can use.',
        'There is a precision-recall tradeoff. Suppress too aggressively and you hide real incidents. Page too eagerly and responders ignore the tool. Google SRE alerting guidance emphasizes precision, recall, detection time, and reset time, and recommends burn-rate style alerting when defending an SLO: https://sre.google/workbook/alerting-on-slos/. AIOps should improve that operating loop, not bypass it.',
        {type: 'image', src: 'https://docs.honeycomb.io/assets/images/health-tab-time-remaining-chart-93c729292768488f9240eaf88b1671e6.png', alt: 'SLO time remaining chart showing error-budget burn pressure.', caption: 'Burn-rate views connect alert urgency to user-visible reliability pressure. (Source: docs.honeycomb.io)'},
        'Automation adds risk. Restarting a process, scaling a worker pool, or rolling back a canary may be safe under guardrails. Changing data, deleting resources, or mutating customer-visible state needs much stronger proof. A bad automated action can turn a partial outage into a larger one.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The strongest use cases are alert deduplication, change correlation, topology-aware grouping, noisy alert suppression, runbook recommendation, anomaly surfacing, SLO-aware routing, and post-incident learning.',
        'For example, a deploy to checkout version 42, rising p99 latency, elevated 5xx errors, and traces showing database timeouts should become one incident with the deploy linked as a candidate cause. The responder should see dashboards, traces, logs, recent changes, owner, SLO burn, and rollback or runbook options in one place.',
        {type: 'image', src: 'https://docs.honeycomb.io/assets/images/health-tab-budget-burndown-2c386a8fed99e40402d42af3715486e5.png', alt: 'SLO budget burndown chart.', caption: 'Budget burndown helps route incidents by impact rather than raw anomaly score. (Source: docs.honeycomb.io)'},
        'AIOps is especially useful in large organizations where no one responder holds the whole dependency graph in memory. The system can keep ownership, topology, recent changes, and incident history close to the evidence instead of forcing the on-call engineer to search five tools during the outage.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The biggest misconception is that AIOps means autonomous remediation. Mature systems usually start with correlation and recommendations, then gradually automate low-risk actions. The end state is not full autonomy everywhere; it is calibrated automation where confidence, blast radius, and rollback are explicit.',
        'Another trap is optimizing alert count instead of incident quality. Fewer alerts are not better if they hide user impact. More model sophistication is also not automatically better. A simple topology and deployment-aware correlation rule can beat a black-box model trained on messy, unlabeled incident history.',
        'The worst failure mode is false confidence. If telemetry is messy, feedback is missing, or automation lacks guardrails, AI turns the incident system into a faster noise generator. The release gate should measure whether incidents become faster to understand and safer to mitigate, not whether the demo produces impressive explanations.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: OpenTelemetry signals at https://opentelemetry.io/docs/concepts/signals/, OpenTelemetry observability primer at https://opentelemetry.io/docs/concepts/observability-primer/, Google SRE monitoring at https://sre.google/sre-book/monitoring-distributed-systems/, and SLO alerting guidance at https://sre.google/workbook/alerting-on-slos/. Study SLO Error Budget Burn Rate Alert, Log Template Drain Parser, Metric Label Cardinality Control, Distributed Tracing, Tail Latency & p99 Thinking, Circuit Breakers & Deadlines, Load Shedding & Graceful Degradation, Backpressure & Flow Control, and Feature Store next.',
      ],
    },
  ],
};
