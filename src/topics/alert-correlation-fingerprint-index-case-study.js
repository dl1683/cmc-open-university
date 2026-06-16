// Alert correlation fingerprint index: canonicalize alert labels, deduplicate
// repeated events, group related symptoms, and preserve the evidence trail.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'alert-correlation-fingerprint-index-case-study',
  title: 'Alert Correlation Fingerprint Index Case Study',
  category: 'Systems',
  summary: 'Turn noisy alert streams into stable incident candidates using canonical label keys, deduplication windows, grouping buckets, ownership maps, and evidence links.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['fingerprint index', 'noise compression'], defaultValue: 'fingerprint index' },
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

function correlationGraph(title) {
  return graphState({
    nodes: [
      { id: 'metrics', label: 'metrics', x: 0.7, y: 1.6, note: 'SLI' },
      { id: 'logs', label: 'logs', x: 0.7, y: 3.5, note: 'events' },
      { id: 'traces', label: 'traces', x: 0.7, y: 5.4, note: 'spans' },
      { id: 'deploy', label: 'deploy', x: 2.4, y: 1.7, note: 'change' },
      { id: 'topo', label: 'topo', x: 2.4, y: 5.3, note: 'deps' },
      { id: 'canon', label: 'canon', x: 4.1, y: 3.5, note: 'labels' },
      { id: 'index', label: 'fp index', x: 5.9, y: 2.1, note: 'hash' },
      { id: 'group', label: 'group', x: 5.9, y: 4.9, note: 'bucket' },
      { id: 'incident', label: 'incident', x: 7.8, y: 3.5, note: 'case' },
      { id: 'owner', label: 'owner', x: 9.3, y: 3.5, note: 'route' },
    ],
    edges: [
      { id: 'e-metrics-canon', from: 'metrics', to: 'canon' },
      { id: 'e-logs-canon', from: 'logs', to: 'canon' },
      { id: 'e-traces-canon', from: 'traces', to: 'canon' },
      { id: 'e-deploy-canon', from: 'deploy', to: 'canon' },
      { id: 'e-topo-canon', from: 'topo', to: 'canon' },
      { id: 'e-canon-index', from: 'canon', to: 'index' },
      { id: 'e-canon-group', from: 'canon', to: 'group' },
      { id: 'e-index-incident', from: 'index', to: 'incident' },
      { id: 'e-group-incident', from: 'group', to: 'incident' },
      { id: 'e-incident-owner', from: 'incident', to: 'owner' },
    ],
  }, { title });
}

function compressionPlot() {
  return plotState({
    axes: {
      x: { label: 'minutes', min: 0, max: 45 },
      y: { label: 'open items', min: 0, max: 90 },
    },
    series: [
      { id: 'raw', label: 'raw alerts', points: [{ x: 0, y: 4 }, { x: 5, y: 42 }, { x: 10, y: 74 }, { x: 15, y: 82 }, { x: 20, y: 63 }, { x: 30, y: 18 }] },
      { id: 'dedup', label: 'dedup keys', points: [{ x: 0, y: 3 }, { x: 5, y: 9 }, { x: 10, y: 13 }, { x: 15, y: 12 }, { x: 20, y: 8 }, { x: 30, y: 4 }] },
      { id: 'incidents', label: 'incidents', points: [{ x: 0, y: 1 }, { x: 5, y: 2 }, { x: 10, y: 3 }, { x: 15, y: 3 }, { x: 20, y: 2 }, { x: 30, y: 1 }] },
    ],
    markers: [
      { id: 'page', x: 10, y: 3, label: 'page' },
    ],
  });
}

function* fingerprintIndex() {
  yield {
    state: correlationGraph('Correlation starts by canonicalizing evidence'),
    highlight: { active: ['metrics', 'logs', 'traces', 'deploy', 'topo', 'canon'], found: ['e-metrics-canon', 'e-logs-canon', 'e-traces-canon', 'e-deploy-canon', 'e-topo-canon'] },
    explanation: 'Alert correlation is a data-normalization problem before it is a model problem. Metrics, logs, traces, deployments, and topology have to agree on service, environment, region, version, route, and owner labels.',
    invariant: 'A fingerprint is only stable when the labels feeding it are stable.',
  };

  yield {
    state: labelMatrix(
      'Canonical fingerprint table',
      [
        { id: 'lat', label: 'latency' },
        { id: 'err', label: '5xx' },
        { id: 'cpu', label: 'cpu' },
        { id: 'pod', label: 'pod' },
      ],
      [
        { id: 'raw', label: 'raw' },
        { id: 'canon', label: 'canon' },
        { id: 'fp', label: 'fp' },
        { id: 'act', label: 'act' },
      ],
      [
        ['checkout-p99', 'svc=checkout', 'c7a1', 'group'],
        ['http-500', 'svc=checkout', 'c7a1', 'dedup'],
        ['host hot', 'node=n17', 'aa42', 'support'],
        ['pod crash', 'svc=checkout', 'c7a1', 'dedup'],
      ],
    ),
    highlight: { active: ['lat:fp', 'err:fp', 'pod:fp'], found: ['lat:act', 'err:act', 'pod:act'], compare: ['cpu:act'] },
    explanation: 'The index uses a canonical key such as service, route, environment, region, alert family, and SLO class. Instance ids and pod names usually belong in evidence, not in the top-level grouping key.',
  };

  yield {
    state: compressionPlot(),
    highlight: { active: ['raw', 'dedup', 'incidents', 'page'] },
    explanation: 'A healthy correlation layer compresses raw alert volume without pretending there is only one symptom. Raw alerts keep arriving, dedup keys stay manageable, and responders receive a small number of incident candidates.',
  };

  yield {
    state: labelMatrix(
      'Index data structures',
      [
        { id: 'hash', label: 'hash map' },
        { id: 'ttl', label: 'ttl wheel' },
        { id: 'uf', label: 'union set' },
        { id: 'own', label: 'owner map' },
        { id: 'ev', label: 'evidence' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['fp -> group', 'key churn'],
        ['expiry', 'stale page'],
        ['merge links', 'bad join'],
        ['team route', 'wrong team'],
        ['trace/log ids', 'lost why'],
      ],
    ),
    highlight: { active: ['hash:stores', 'ttl:stores', 'uf:stores'], found: ['ev:stores'], compare: ['own:risk'] },
    explanation: 'The practical implementation is a small family of data structures: a hash map for fingerprints, a TTL wheel for freshness, a union-find or grouping table for related symptoms, an owner map for routing, and an evidence ledger for audit.',
  };
}

function* noiseCompression() {
  yield {
    state: correlationGraph('Fingerprint keys feed incident buckets'),
    highlight: { active: ['canon', 'index', 'group', 'incident', 'owner', 'e-canon-index', 'e-canon-group', 'e-index-incident', 'e-group-incident', 'e-incident-owner'] },
    explanation: 'Deduplication and grouping are separate. Deduplication says this event is another copy of the same alert. Grouping says several different alerts probably belong to one incident.',
  };

  yield {
    state: labelMatrix(
      'Compression decisions',
      [
        { id: 'dedup', label: 'dedup' },
        { id: 'group', label: 'group' },
        { id: 'split', label: 'split' },
        { id: 'esc', label: 'escalate' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'keep', label: 'keep' },
        { id: 'bad', label: 'if wrong' },
      ],
      [
        ['same fp', 'count', 'spam'],
        ['same svc', 'evidence', 'mystery'],
        ['diff owner', 'boundary', 'hidden'],
        ['SLO burn', 'page', 'slow'],
      ],
    ),
    highlight: { active: ['dedup:rule', 'group:rule', 'esc:rule'], found: ['group:keep'], compare: ['split:bad'] },
    explanation: 'A correlation engine should make its compression decisions explainable. The incident record should say which alerts were deduplicated, which were grouped, which were split, and which signal made the incident urgent.',
    invariant: 'Reduce notifications, not evidence.',
  };

  yield {
    state: labelMatrix(
      'Complete case: checkout regression',
      [
        { id: 'sli', label: 'sli' },
        { id: 'trace', label: 'trace' },
        { id: 'log', label: 'log' },
        { id: 'dep', label: 'deploy' },
        { id: 'page', label: 'page' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'link', label: 'link' },
        { id: 'out', label: 'outcome' },
      ],
      [
        ['p99 burn', 'checkout', 'primary'],
        ['db waits', 'trace ids', 'evidence'],
        ['timeout', 'log tpl', 'evidence'],
        ['v42', 'change', 'cause cand'],
        ['owner', 'team map', 'one page'],
      ],
    ),
    highlight: { active: ['sli:out', 'page:out'], found: ['trace:link', 'log:link', 'dep:out'] },
    explanation: 'In the incident page, the p99 burn alert is the primary symptom. Trace waits, log templates, and a same-window deploy become attached evidence. The route comes from ownership metadata, not from whichever alert arrived first.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'card', label: 'cardinality' },
        { id: 'mask', label: 'masking' },
        { id: 'split', label: 'split brain' },
        { id: 'learn', label: 'no labels' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['new fp per pod', 'drop pod key'],
        ['root hidden', 'keep SLO lead'],
        ['one issue, two pages', 'merge audit'],
        ['no feedback', 'close reason'],
      ],
    ),
    highlight: { active: ['card:symptom', 'mask:symptom'], found: ['card:fix', 'learn:fix'] },
    explanation: 'The index improves only if responders close the loop. Post-incident labels, false group reports, split decisions, and route corrections are training data for the next incident.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'fingerprint index') yield* fingerprintIndex();
  else if (view === 'noise compression') yield* noiseCompression();
  else throw new InputError('Pick an alert-correlation view.');
}

export const article = {
  references: [
    { title: 'OpenTelemetry Semantic Conventions', url: 'https://opentelemetry.io/docs/concepts/semantic-conventions/' },
    { title: 'Prometheus Alertmanager', url: 'https://prometheus.io/docs/alerting/latest/alertmanager/' },
    { title: 'PagerDuty Event Management', url: 'https://support.pagerduty.com/main/docs/event-management' },
    { title: 'Google SRE Alerting on SLOs', url: 'https://sre.google/workbook/alerting-on-slos/' },
  ],
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An alert correlation fingerprint index is the data structure that sits between a stream of firing alerts and the incident record shown to responders. It canonicalizes labels, computes stable fingerprints, deduplicates repeats, groups related symptoms, attaches evidence, and routes one actionable incident to an owner.',
        'The point is not to hide alerts. The point is to preserve evidence while reducing notification load. A responder should see fewer pages but more context: user impact, correlated logs, traces, deployment events, topology edges, ownership, and a clear reason for every grouping decision.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The core structures are a canonical label dictionary, a fingerprint hash map, a TTL wheel for expiring inactive groups, a grouping table or union-find for related symptoms, an ownership map for routing, and an append-only evidence ledger. Each alert becomes a row keyed by canonical service, environment, region, route, alert family, severity, and SLO class.',
        'OpenTelemetry semantic conventions exist because telemetry needs common names across codebases and platforms: https://opentelemetry.io/docs/concepts/semantic-conventions/. The same lesson applies to alert correlation. If one service uses `service.name`, another uses `app`, and a third encodes the service in a log message, the fingerprint index has to normalize them before grouping can be trusted.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The ingestion path normalizes every incoming alert, computes a fingerprint, checks the active hash map, updates counters and last-seen time, attaches evidence links, and then decides whether the alert is a duplicate, a related symptom, a separate incident, or an urgency signal. The grouping decision should be visible inside the incident.',
        'Prometheus Alertmanager already teaches the operational primitives: grouping, deduplication, silences, inhibition, receiver routing, and notification timing: https://prometheus.io/docs/alerting/latest/alertmanager/. A fingerprint index generalizes those primitives across metrics, logs, traces, deploy metadata, paging systems, and AIOps correlation logic.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Checkout p99 latency breaches an SLO. Five minutes later, 5xx alerts fire. Logs show the same timeout template. Traces show slow database spans. A deploy event shows version 42 rolled out to the same region. The index should keep the SLO burn as the lead symptom, deduplicate repeated alerts, group log and trace evidence, attach the deployment as a candidate cause, and route the incident to checkout on-call.',
        'PagerDuty documents the same operational idea through deduplication keys: events with the same dedup key can be merged into a single alert or incident record: https://support.pagerduty.com/main/docs/event-management. A local fingerprint index gives teams control over what that dedup key means and which evidence is retained.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'High compression reduces noise but risks hiding distinct incidents. Low compression preserves every symptom but pushes cognitive load onto responders. The best middle ground uses user-visible SLOs as the lead signal, topology as grouping context, and evidence links as audit material.',
        'The index should measure raw alerts, unique fingerprints, incidents opened, alerts per incident, suppressed alerts, false groups, false splits, route corrections, time to acknowledge, and time to mitigate. Those metrics reveal whether correlation is improving incident quality or only reducing page count.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'The common failure is putting volatile labels in the fingerprint. Pod names, host ids, request ids, and dynamic shard ids can create a new fingerprint for every copy of the same problem. Keep volatile fields as evidence unless they truly define ownership or impact.',
        'A second failure is making grouping a black box. If responders cannot see why alerts were joined, they will distrust the tool or accept bad joins. The incident should show the fingerprint, grouping features, evidence links, suppressed alerts, and any manual corrections.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study AIOps Incident Response, Alertmanager Routing & Inhibition Tree, SLO Error Budget Burn Rate Alert, Metric Label Cardinality Control, Log Template Drain Parser, Metric Exemplars Trace Correlation, Distributed Tracing, and Incident Causal Candidate Graph next.',
      ],
    },
  ],
};
