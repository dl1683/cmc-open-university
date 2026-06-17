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
      heading: 'Why this exists',
      paragraphs: [
        'Production systems rarely fail with one clean signal. A checkout regression can trigger p99 latency burn, 5xx errors, pod restarts, database wait traces, repeated log templates, deploy warnings, and customer-support reports. If every symptom becomes its own page, responders spend the first minutes sorting noise instead of repairing user impact.',
        'An alert correlation fingerprint index exists to turn that flood into a smaller set of incident candidates without throwing away evidence. It canonicalizes labels, computes stable fingerprints, deduplicates repeats, groups related symptoms, attaches logs and traces, and routes the incident to the team most likely to own the failing service.',
        'The word index matters. This is not just a notification filter. It is a live data structure that remembers active fingerprints, freshness windows, grouping decisions, ownership, and evidence links. It should reduce pages while preserving the facts needed for diagnosis, audit, and post-incident learning.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is to group alerts by the labels they already carry. Same service, same environment, same severity, same page. That works while the system is small and every emitter uses the same vocabulary.',
        'The wall is label reality. Metrics might use `service.name=checkout`, logs might say `app=checkout-api`, traces might identify a route, Kubernetes events might name a pod, and a deploy event might know only a version. If the index groups raw labels directly, it creates false splits, false joins, and pages the wrong team.',
        'A second wall appears when teams treat every repeated alert as a separate incident or every nearby alert as the same incident. Exact repeats need deduplication. Related but different symptoms need grouping. Independent incidents need separation. A useful correlation system has to make all three decisions and explain them later.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Alert correlation is a data-normalization problem before it is a prediction problem. The index must map telemetry from metrics, logs, traces, deploys, and topology into a shared vocabulary before it can decide what belongs together. Stable correlation starts with stable labels.',
        'The fingerprint key should contain fields that define the operational identity of a symptom: service, environment, region, route or dependency, alert family, SLO class, and sometimes version or shard. Volatile fields such as pod name, host id, request id, span id, and full URL usually belong in evidence rather than in the top-level key.',
        'The second insight is that deduplication and grouping are different operations. Deduplication says this event is another copy of the same alert. Grouping says different symptoms probably belong to one incident. Mixing those ideas is how correlation tools become both noisy and opaque.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The fingerprint-index view puts canonicalization in the center on purpose. Metrics, logs, traces, deploys, and topology all flow through label normalization before the fingerprint index or grouping bucket can make a decision. The visual model teaches that bad labels cannot be fixed by a clever hash.',
        'The canonical fingerprint table shows which fields become grouping keys and which fields stay as attached evidence. Checkout latency, HTTP 500s, and pod crashes can share a service-level fingerprint, while a hot node may remain supporting evidence or a separate infrastructure incident depending on ownership and impact.',
        'The noise-compression view separates raw alerts, dedup keys, and incident records. A healthy system compresses repeated notifications without hiding the symptoms that explain the incident. The goal is one useful page with a timeline and evidence, not a small graph that discards context.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The ingestion path normalizes each event into canonical fields. A metric alert, log template, trace span, deployment event, and topology update should all be able to answer the same core questions: which service, which environment, which region, which route or dependency, which owner, which version, and what kind of symptom?',
        'The fingerprint hash map stores active dedup records by stable keys. Each record tracks first seen time, last seen time, count, severity changes, current state, and links to raw events. A TTL wheel or expiration queue closes records that have gone quiet. A rate counter can detect a sudden surge without opening a new incident for every copy.',
        'Grouping uses a separate structure. A grouping table or union-find can connect related fingerprints when topology, time window, SLO impact, dependency edges, deploy evidence, or manual responder action says they belong to the same incident. The owner map routes the incident, and an append-only evidence ledger preserves the raw links for audit.',
        'A good incident record exposes its compression decisions. It should say which alerts were deduplicated, which symptoms were grouped, which signals were split into another incident, which signal made the incident page-worthy, and which owner rule selected the route.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because most alert floods contain repeated structure. The same service, route, error family, and time window appear again and again under different emitters. A stable fingerprint catches exact repeats, while evidence-aware grouping attaches related symptoms without pretending they are identical.',
        'It also works because ownership is separated from arrival order. The first alert to fire may come from a node, database, synthetic monitor, or generic platform check. The incident should route through service and topology metadata, not through whichever symptom happened to page first.',
        'The main invariant is evidence preservation. Compression may reduce notifications, but it must not delete the raw facts that explain the compression. If a responder cannot see why an alert was suppressed or why two fingerprints were joined, the system has removed information at the point where trust is most needed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Checkout p99 latency breaches an SLO in `us-east`. Three minutes later, 5xx alerts fire for the same route. Logs show a repeated payment-timeout template. Traces show slow database waits. A deploy event says version 42 rolled out to checkout in the same region. Kubernetes also reports pod restarts.',
        'The index normalizes the sources into one vocabulary. `service.name=checkout`, `app=checkout-api`, and a route-level trace tag all become the same canonical service and route. Pod names, span ids, and individual request ids stay in evidence links. The SLO burn becomes the lead symptom because it represents user impact.',
        'Repeated 5xx events deduplicate under one fingerprint. The log template and trace waits join the incident as evidence. The deploy becomes a candidate cause because it shares service, region, and time window. Pod restarts are attached as supporting symptoms unless topology says the node problem is owned by a different team. The result is one page with an explanation, not six unrelated pages.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Start by writing the label contract. Define canonical service, environment, region, route, dependency, alert family, severity, owner, version, and SLO fields. Add adapters from each telemetry source into that contract. Treat missing fields and conflicting fields as first-class quality signals rather than silent defaults.',
        'Keep volatile values out of the main fingerprint unless they define impact or ownership. Pod, host, request, span, and full path values can explode cardinality. Store them as evidence with counts and examples. Use normalization rules for routes, error names, and log templates so one issue does not become hundreds of keys.',
        'Make every automated join reversible or at least reviewable. Store the rule, features, timestamps, source events, and confidence or reason. Let responders split an incident, merge incidents, correct ownership, and close with a reason. Feed those actions back into rule tuning and label cleanup.',
        'Build guardrails for paging. Lead with user-visible SLO burn or clear customer impact. Use inhibition carefully so a broad service incident can suppress child symptoms without deleting them. Escalate when a grouped incident crosses severity, duration, or blast-radius thresholds.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'High compression reduces page load but can hide distinct incidents. Low compression preserves separation but pushes sorting work onto humans during the worst minutes of an outage. The practical middle ground is to lead with user-visible SLO impact, use topology and time as grouping context, and keep evidence visible.',
        'The index creates operational debt. Label dictionaries drift, ownership maps go stale, TTL windows need tuning, deploy metadata has gaps, and grouping rules need feedback. A correlation layer without maintenance becomes another source of noise.',
        'Measure the shape of the stream. Track raw alerts, unique fingerprints, incidents opened, alerts per incident, suppressed alerts, false groups, false splits, route corrections, manual merges, time to acknowledge, time to mitigate, and incidents where responders ignored the suggested grouping.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This pattern wins when services emit many symptoms for one user-facing failure: microservice dependency chains, regional regressions, deploy-induced errors, noisy Kubernetes restarts, repeated synthetic-check failures, and incidents where logs and traces carry the useful context.',
        'It is especially valuable when responders need one incident page with a timeline: SLO burn first, then correlated traces, log templates, topology edges, deploy events, suppressed child alerts, and ownership. That is a different product from a list of alerts.',
        'It also helps platform teams improve telemetry quality. False splits reveal missing or inconsistent labels. False joins reveal overly broad keys. Route corrections reveal stale ownership. The index becomes a feedback loop for the observability data model.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'It fails when volatile labels enter the fingerprint. Pod names, host ids, request ids, dynamic shard ids, and full URLs can create a new group for every copy of the same problem. Keep those fields as evidence unless they truly define impact or ownership.',
        'It fails when grouping becomes a black box. If responders cannot see why two alerts were joined, they either distrust the system or accept bad joins. The incident record should expose fingerprints, grouping features, evidence links, suppressed alerts, manual corrections, and close reasons.',
        'It also fails when correlation is treated as root-cause detection. A grouped incident can suggest candidate causes, but it does not prove causality by itself. A deploy in the same window, a trace bottleneck, or a topology edge is evidence to investigate, not a verdict.',
        'Finally, it fails under poor ownership data. A perfect fingerprint still pages the wrong people if the service catalog is stale. Correlation depends on the operational graph around the alert stream.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study OpenTelemetry semantic conventions, Prometheus Alertmanager grouping and inhibition, PagerDuty event orchestration, and Google SRE guidance on SLO alerting. Then study metric label cardinality control, log template parsing, trace exemplars, service catalogs, ownership maps, and topology graphs.',
        'The next practical exercise is to design a fingerprint key for one service. Write five raw events from metrics, logs, traces, deploys, and Kubernetes. Normalize them into canonical fields. Decide which values enter the fingerprint, which stay as evidence, which symptoms deduplicate, and which symptoms group into one incident.',
      ],
    },
  ],
};
