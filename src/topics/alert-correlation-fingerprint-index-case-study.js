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
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read the fingerprint-index view as a normalization pipeline. A fingerprint is a stable key computed from canonical labels, which are shared names that metrics, logs, traces, deploys, and topology agree to use.',
      'Active nodes show signals being normalized or grouped, found nodes show evidence retained for the incident, and compare nodes show signals that may support or split the case. Notification compression should reduce pages, not delete evidence.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      {type:'callout', text:'Alert correlation is a data-normalization problem before it is a prediction problem. Metrics say "service.name=checkout," logs say "app=checkout-api," traces identify a route, and Kubernetes events name a pod. If the index groups raw labels directly, it creates false splits, false joins, and pages the wrong team. Stable fingerprints start with stable canonical labels.'},
      'Production failures rarely produce one clean alert. A checkout regression can create latency burn, 5xx alerts, pod restarts, log templates, trace waits, deploy warnings, and support tickets.',
      'The index compresses that flood into incident candidates while keeping the raw facts. It deduplicates repeats, groups related symptoms, preserves evidence links, and routes to the owning team.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach groups alerts by the raw labels they arrive with. Same service, environment, and severity means the alerts belong together.',
      'That works only while every emitter uses the same vocabulary. It breaks when metrics, logs, traces, deploys, and orchestration events describe the same service with different fields.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is label mismatch plus cardinality. A pod name, request ID, host ID, or full URL can create a new fingerprint for every copy of the same incident.',
      'The opposite mistake is over-grouping. If every alert in the same five-minute window joins one case, an infrastructure issue can hide an application regression that needs a different owner.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Correlation starts with canonicalization. The index maps source-specific fields into stable service, route, environment, region, dependency, alert family, SLO class, owner, and version fields before hashing or grouping.',
      'The invariant is evidence-preserving compression. Deduplication may reduce notifications, but the incident must still show every suppressed fingerprint, raw event link, grouping rule, and owner decision.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Ingestion normalizes every event into the label contract. A metric alert, log template, trace span, deploy event, and Kubernetes event should all be able to name service, environment, route, owner, version, and symptom family.',
      'A hash map stores active fingerprints with first seen time, last seen time, count, severity, state, and evidence links. A TTL wheel expires quiet fingerprints, while grouping uses topology, time window, SLO impact, deploy evidence, and manual feedback.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is key stability. If the fingerprint includes only fields that define operational identity, repeated copies of the same symptom hit the same record instead of opening new work.',
      'Grouping remains separate from deduplication. Exact repeats update one fingerprint, while different symptoms join an incident only when evidence says they share impact, topology, timing, dependency, or ownership.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The cost is label governance. Teams must maintain service names, route normalization, ownership maps, deploy metadata, topology edges, TTLs, and feedback from responder corrections.',
      'Cost behaves like a compression tradeoff. High compression lowers page load but risks hiding distinct incidents, while low compression preserves separation but pushes sorting work onto humans during outages.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'The index fits microservice outages, regional regressions, deploy-induced errors, noisy Kubernetes restarts, repeated synthetic-check failures, and incidents where traces and logs carry the useful context.',
      'It also improves observability hygiene. False splits reveal missing labels, false joins reveal broad keys, and route corrections reveal stale service ownership.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails when volatile fields enter the fingerprint. Pod names, host IDs, request IDs, dynamic shard IDs, and full URLs should usually remain attached evidence instead of top-level keys.',
      'It also fails when responders cannot inspect the join. A black-box grouping decision destroys trust because the on-call engineer cannot tell whether a suppressed alert was duplicate, related, or incorrectly hidden.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Checkout p99 burn fires in us-east at 10:00, 5xx alerts start at 10:03, traces show database waits, logs repeat payment timeout, and deploy v42 landed at 09:57. Raw systems call the service checkout, checkout-api, and route /pay.',
      'Canonicalization maps those to service checkout and route payment. The SLO burn becomes the lead incident, 37 repeated 5xx alerts deduplicate to one fingerprint, logs and traces attach as evidence, and the deploy becomes a candidate cause instead of a separate page.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Study OpenTelemetry semantic conventions, Prometheus Alertmanager grouping and inhibition, PagerDuty event orchestration, service catalogs, and Google SRE alerting-on-SLO guidance. These sources define labels, routing, grouping, and incident evidence.',
      'Next study metric label cardinality control, log template parsing, trace exemplars, topology graphs, Alertmanager route trees, and AIOps incident response.',
    ] },
  ],
};
