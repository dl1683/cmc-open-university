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
    explanation: `AIOps starts as data engineering. ${['metrics', 'logs', 'traces'].join(', ')} must share service names, environments, versions, regions, and request identifiers before models can correlate them reliably.`,
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
    explanation: `The point is compression with context. A good AIOps system does not page ${['CPU high', 'p99 latency', '5xx errors', 'deploy event', 'incident'].length} times; it groups related symptoms, attaches change context, and routes one incident to the right owner.`,
    invariant: `Correlation reduces alert count only when it preserves user impact and actionability across all ${['latency:decision', 'errors:decision', 'incident:decision'].length} primary decision cells.`,
  };

  const separateJobs = ['detect', 'correlate'];
  yield {
    state: opsGraph('Detection and correlation are separate jobs'),
    highlight: { active: separateJobs, found: ['e-detect-incident', 'e-correlate-incident'], compare: ['human'] },
    explanation: `Anomaly ${separateJobs[0]}ion asks whether a signal is unusual or budget-burning. ${separateJobs[1][0].toUpperCase() + separateJobs[1].slice(1)} asks which unusual signals likely belong to the same incident. Confusing the ${separateJobs.length} creates noisy automated guesses.`,
  };

  const featureFamilies = [
    { id: 'time', label: 'time' },
    { id: 'topology', label: 'topology' },
    { id: 'deploy', label: 'change' },
    { id: 'trace', label: 'trace' },
  ];
  yield {
    state: labelMatrix(
      'Useful feature families',
      featureFamilies,
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
    explanation: `The most useful models are often not exotic. ${featureFamilies.map(f => f.label).join(', ')} give correlation algorithms the structure human responders already use.`,
  };
}

function* incidentLoop() {
  const routingCategories = [
    { id: 'minor', label: 'minor anomaly' },
    { id: 'burnfast', label: 'fast burn' },
    { id: 'burnslow', label: 'slow burn' },
    { id: 'unknown', label: 'unknown impact' },
  ];
  yield {
    state: labelMatrix(
      'SLO-aware routing',
      routingCategories,
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
    explanation: `AIOps should not page because something looks statistically interesting. With ${routingCategories.length} routing categories, page only when user-visible reliability is burning fast enough that a human needs to respond now.`,
  };

  const feedbackTargets = ['normalize', 'correlate'];
  yield {
    state: opsGraph('Human validation closes the loop'),
    highlight: { active: ['incident', 'human', 'e-incident-human'], found: feedbackTargets },
    explanation: `The responder confirms or rejects the grouping, mitigates the incident, and records what actually happened. That feedback becomes labels for future ${feedbackTargets.join(', ')}, routing, and suppression logic.`,
  };

  const maturityLevels = [
    { id: 'suggest', label: 'suggest' },
    { id: 'prepare', label: 'prepare' },
    { id: 'execute', label: 'execute' },
    { id: 'rollback', label: 'rollback' },
  ];
  yield {
    state: labelMatrix(
      'Automation maturity ladder',
      maturityLevels,
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
    explanation: `Automation should climb the ${maturityLevels.length} levels slowly. ${maturityLevels[0].label[0].toUpperCase() + maturityLevels[0].label.slice(1)} causes first. ${maturityLevels[1].label[0].toUpperCase() + maturityLevels[1].label.slice(1)} commands next. ${maturityLevels[2].label[0].toUpperCase() + maturityLevels[2].label.slice(1)} only low-risk actions with tight guardrails and measurable ${maturityLevels[3].label} criteria.`,
  };

  const failureModes = [
    { id: 'labels', label: 'bad labels' },
    { id: 'feedback', label: 'missing feedback' },
    { id: 'overfit', label: 'overfit patterns' },
    { id: 'autonomy', label: 'unsafe autonomy' },
  ];
  yield {
    state: labelMatrix(
      'Failure modes to design against',
      failureModes,
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
    explanation: `The AIOps failure mode is false confidence. With ${failureModes.length} failure modes to guard against — ${failureModes.map(f => f.label).join(', ')} — AI turns the incident system into a faster noise generator if any defense is missing.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views you can switch between. The telemetry funnel view shows how raw signals (metrics, logs, traces) flow through normalization, detection, correlation, and finally into a single actionable incident routed to a responder. The incident loop view shows SLO-aware routing categories, the human feedback cycle, an automation maturity ladder, and the failure modes you need to design against.',
        'Watch the highlights carefully. Active nodes (blue) show what the current step focuses on. Found edges (green) show the data path being discussed. Compare nodes (orange) mark alternatives or risks. Step through slowly the first time to see how each stage transforms raw signals into structured evidence.',
        {type: 'image', src: './assets/gifs/aiops-incident-response.gif', alt: 'Animated walkthrough of the aiops incident response visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A single checkout-service failure can produce CPU alerts, p99 latency spikes, 5xx error upticks, deployment events, queue-depth warnings, and downstream timeout alerts across a dozen services. During an outage, the on-call engineer is simultaneously reading Slack, scanning dashboards, querying logs, and trying to figure out which of these fifty signals actually matter. That search time is the bottleneck, not the fix itself.',
        'AIOps incident response exists to compress that evidence flood into one useful packet: grouped symptoms, user-impact context, likely owner, recent changes, relevant traces, and safe next actions. It does not replace observability tooling or human judgment. It reduces the time a responder spends searching so they can spend more time thinking.',
        {type: 'callout', text: 'AIOps is evidence compression: preserve user impact and actionability while reducing alert noise.'},
        'This only works if the underlying telemetry is clean. OpenTelemetry defines the core signal families (traces, metrics, logs, baggage) and gives them a shared data model. Google SRE frames monitoring as collecting, processing, aggregating, and displaying real-time data, with alerting reserved for issues that deserve human response. AIOps sits on top of both foundations. Without consistent labels, propagated trace IDs, and defined SLOs, AIOps has no stable input to work with.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is to feed every alert into a model and ask it for the root cause. This sounds great in a demo. It fails in production because the raw data is inconsistent (service names spelled differently across teams), incomplete (logs missing trace IDs), and overloaded with correlations that are not causes. The model confidently explains noise.',
        'The second instinct is to optimize for fewer pages. Fewer alerts sound nice, but they are only better if they preserve actionability and user impact. Suppressing related alerts is fine. Suppressing the one alert that showed a real SLO burn is dangerous. Counting alerts is the wrong metric; incident quality is the right one.',
        'The actual prerequisite work is unglamorous: standardize labels, build ownership maps, define service topology, attach deployment metadata to telemetry, propagate trace context, define SLOs with real user-facing SLIs, and capture structured feedback from resolved incidents. AIOps cannot be more trustworthy than its data layer.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'You hit the wall when you realize that correlation is not causation, and the system needs to be honest about that distinction. A CPU spike and a latency spike co-occurring does not mean one caused the other. They might share a cause (a bad deploy), or the CPU spike might be unrelated maintenance. If the system confidently picks one as the root cause, responders either trust it blindly (dangerous) or spend time debugging the AI instead of the outage (worse).',
        'The deeper wall is data gravity. Every team has its own logging format, its own metric names, its own deployment tooling. Normalization is a political problem as much as a technical one. You can build the most sophisticated anomaly detector in the world and it will produce garbage if "checkout-svc" in metrics is "checkout_service" in logs and "svc-checkout" in the deploy system.',
        'The third wall is feedback. Without structured incident outcomes (what was the real cause, which evidence was useful, which grouping was wrong), the system cannot learn. Most organizations write incident postmortems in prose that no training loop can consume. The model stays static while the system it monitors evolves.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Incident response is evidence compression under time pressure. The system must preserve what a responder needs (which signals changed, which users are affected, which SLO is burning, what changed recently) while discarding duplicate, stale, and low-impact noise. The output is not a magic diagnosis. It is a compact, auditable incident packet with uncertainty visible.',
        'Detection, correlation, and root-cause analysis are three separate jobs. Detection asks: is this signal unusual, or is an error budget burning? Correlation asks: which unusual signals likely belong to the same incident? Root-cause analysis asks: given the evidence cluster, which change or dependency is most plausible? Mixing these jobs in one model creates false confidence because you cannot tell which question the model answered.',
        'A strong system shows its work. It should say: these five signals changed within the same two-minute window, they span services A and B which share a dependency edge, a deploy to service A landed sixty seconds before the first anomaly, and the error budget for checkout is burning at 3x. That lets the responder verify in seconds instead of investigating from scratch.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline has five stages. First, collect telemetry: metrics from Prometheus or CloudWatch, logs from structured logging pipelines, traces from OpenTelemetry or Jaeger, deployment events from CI/CD, and user-facing SLIs from synthetic monitors or real-user measurement. Second, normalize: map service names, regions, versions, endpoints, and trace identifiers to a shared schema so that a metric alert and a log error from the same service can be joined.',
        'Third, detect: run anomaly detection (statistical, ML, or simple threshold) on metrics and SLI streams, and separately track SLO error-budget burn rates. Fourth, correlate: group related anomalies using time proximity (signals that spiked together), service topology (upstream/downstream edges), trace context (shared slow spans), and change windows (a deploy that landed just before the spike). Fifth, route: emit one incident with ranked evidence, candidate causes, affected SLOs, owner, and suggested actions.',
        {type: 'image', src: 'https://opentelemetry.io/docs/specs/otel/metrics/img/model-layers.png', alt: 'OpenTelemetry metrics model layers from event stream to timeseries.', caption: 'Telemetry needs a shared data model before correlation can be reliable. (Source: opentelemetry.io)'},
        'The feedback loop is the stage most teams skip and later regret. After the incident, the responder confirms or rejects the grouping, records the actual root cause, marks which evidence was useful, and notes what action fixed it. Without this, the system is a static heuristic. With it, you get an operational learning loop that improves grouping accuracy and action recommendations over time.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'AIOps works when it encodes the same questions humans already ask during an outage: what changed recently, what do users see, which service is upstream, where do traces slow down, does the failure window overlap a deploy, and who owns the broken component. Automating the search for those answers can shave ten to twenty minutes off an incident that would otherwise start with the on-call engineer opening five tabs and running ad-hoc queries.',
        'It also works because most alerts during an outage are not independent events. One database bottleneck can raise p99 latency, trigger queue growth, increase retry storms, cause 5xx errors in the API layer, and page the teams that own three downstream consumers. Grouping those into one incident saves attention. The key constraint is that the grouping must preserve the primary symptom and user impact, not hide them.',
        'SLO-aware routing works because it ties urgency to user-visible reliability instead of raw anomaly scores. A weird internal metric with no user impact becomes a ticket. A fast error-budget burn pages immediately. Unknown impact flags an instrumentation gap, not an escalation. This replaces "is this signal unusual?" with "are users hurting?", which is the question that actually determines response priority.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The expensive part is almost never the model. It is data quality. Services emit inconsistent labels. Logs omit trace IDs. Dashboards measure internal CPU instead of user-facing checkout success rate. Deploy metadata lives in a CI system that has no API integration with the observability stack. Ownership maps are six months stale. Fixing these is tedious, cross-team, political work, and there is no shortcut.',
        'There is a precision-recall tradeoff on suppression. Suppress too aggressively and you hide real incidents, creating gaps where the on-call engineer never learns about a problem until customers complain on Twitter. Page too eagerly and responders learn to ignore the tool, which is worse than no tool at all. Google SRE alerting guidance frames this around precision, recall, detection time, and reset time, and recommends burn-rate alerting for SLO defense.',
        {type: 'image', src: 'https://docs.honeycomb.io/assets/images/health-tab-time-remaining-chart-93c729292768488f9240eaf88b1671e6.png', alt: 'SLO time remaining chart showing error-budget burn pressure.', caption: 'Burn-rate views connect alert urgency to user-visible reliability pressure. (Source: docs.honeycomb.io)'},
        'Automation adds a second axis of risk. Restarting a process or scaling a worker pool might be safe behind blast-radius limits. Rolling back a canary deploy is probably safe with SLO checks. But mutating data, deleting resources, or changing customer-visible state requires much stronger proof than "the model thinks this is the cause." A bad automated action during a partial outage can turn it into a full one.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The strongest use cases are alert deduplication (50 alerts become 1 incident), change correlation (linking a deploy to the symptom window), topology-aware grouping (knowing that service B is downstream of service A), SLO-aware routing (paging for budget burns, ticketing for anomalies), runbook recommendation (suggesting the rollback playbook when a deploy correlates), and post-incident learning (feeding resolution data back into the correlation model).',
        'Concrete example: checkout version 42 deploys at 14:03. At 14:05, p99 latency rises on checkout. At 14:06, 5xx errors spike. At 14:07, traces show database timeout spans in checkout. At 14:08, CPU alerts fire on the database host. Without AIOps, five separate pages go to three different teams. With it, one incident goes to the checkout owner, the deploy is flagged as a candidate cause, the SLO budget burndown is attached, and a rollback runbook is suggested.',
        {type: 'image', src: 'https://docs.honeycomb.io/assets/images/health-tab-budget-burndown-2c386a8fed99e40402d42af3715486e5.png', alt: 'SLO budget burndown chart.', caption: 'Budget burndown helps route incidents by impact rather than raw anomaly score. (Source: docs.honeycomb.io)'},
        'AIOps is especially valuable in large organizations where no single responder holds the full dependency graph in memory. The system maintains ownership, topology, recent changes, and incident history so the on-call engineer does not have to reconstruct them from five different tools while the outage clock ticks.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The most common failure is treating AIOps as autonomous remediation. Teams buy a tool expecting it to fix incidents automatically, then discover that the automation either does nothing useful (because the data is too messy) or does something harmful (because the guardrails are missing). Mature systems start with correlation and recommendations, then gradually automate low-risk actions with explicit blast-radius limits and rollback criteria.',
        'Optimizing for alert count instead of incident quality is a trap. If your AIOps dashboard proudly shows "90% fewer alerts" but responders cannot find the primary symptom in the grouped incident, you have made the system worse. Similarly, a sophisticated ML model trained on messy, unlabeled incident history often underperforms a simple rule that says "group signals from the same service that spiked within the same two-minute window and check for a recent deploy."',
        'The worst failure mode is false confidence without feedback. If telemetry labels are inconsistent, incident outcomes are never recorded, and automation lacks guardrails, AIOps becomes a faster noise generator. The release gate for any AIOps system should measure whether incidents become faster to understand and safer to mitigate, not whether the demo produces confident-sounding explanations.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose you operate a checkout service backed by a payments service and a shared PostgreSQL database. Your SLO is 99.9% checkout success over a 30-day window. At 14:03, a new version of the payments service deploys. At 14:05, you start seeing elevated p99 latency on checkout. By 14:07, 5xx errors cross the alert threshold, and traces show that 40% of checkout requests contain a slow span in payments where a database query takes 8 seconds instead of the usual 50ms.',
        'Without AIOps, PagerDuty fires four pages: one for checkout p99, one for checkout 5xx, one for payments latency, and one for database CPU. Three different on-call engineers wake up and start investigating independently. The checkout engineer opens Grafana, the payments engineer opens Kibana, and the database engineer opens CloudWatch. Fifteen minutes pass before anyone connects the dots.',
        'With AIOps, the normalization layer links all four signals because they share a service topology edge and a time window. The correlation step groups them into one incident. The detection step flags that the checkout SLO error budget is burning at 5x the sustainable rate. The routing step pages the payments on-call (owner of the candidate-cause deploy) with a single incident containing: the budget burndown chart, the trace showing the slow database span, the deploy diff for the payments release, and a suggested action to rollback payments to the previous version.',
        'The responder reviews the evidence, confirms the deploy introduced a missing index on a new query path, rolls back, and marks the incident as resolved. That feedback — "deploy was the cause, rollback was the fix, grouping was correct" — feeds back into the correlation model for future accuracy.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references: OpenTelemetry signals overview (https://opentelemetry.io/docs/concepts/signals/), OpenTelemetry observability primer (https://opentelemetry.io/docs/concepts/observability-primer/), Google SRE monitoring chapter (https://sre.google/sre-book/monitoring-distributed-systems/), Google SRE alerting on SLOs (https://sre.google/workbook/alerting-on-slos/). For the telemetry data model, read the OpenTelemetry specification for metrics, traces, and logs.',
        'Study next: SLO Error Budget Burn Rate Alert (how burn-rate windows drive paging decisions), Distributed Tracing (how trace context propagates across service boundaries), Log Template Drain Parser (how to extract structure from unstructured logs), Metric Label Cardinality Control (why high-cardinality labels break aggregation), Tail Latency and p99 Thinking (why averages hide user-visible pain), Circuit Breakers and Deadlines (how services protect themselves during cascading failures), and Load Shedding and Graceful Degradation (how to stay partially available when capacity runs out).',
      ],
    },
  ],
};
