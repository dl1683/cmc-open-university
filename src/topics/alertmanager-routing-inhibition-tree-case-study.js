// Alertmanager: alerts are grouped, deduplicated, routed, silenced, inhibited,
// and delivered through receiver integrations.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'alertmanager-routing-inhibition-tree-case-study',
  title: 'Alertmanager Routing & Inhibition Tree Case Study',
  category: 'Systems',
  summary: 'An alert-routing primer: grouping keys, route trees, receivers, deduplication, silences, inhibition rules, notification timing, and incident noise control.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['route tree', 'noise control'], defaultValue: 'route tree' },
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

function alertGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'prom', label: 'prom', x: 0.65, y: 3.8, note: notes.prom ?? 'rules' },
      { id: 'alert', label: 'alert', x: 2.15, y: 3.8, note: notes.alert ?? 'labels' },
      { id: 'group', label: 'group', x: 3.8, y: 2.0, note: notes.group ?? 'key' },
      { id: 'route', label: 'route', x: 3.8, y: 5.6, note: notes.route ?? 'tree' },
      { id: 'silence', label: 'mute', x: 5.6, y: 2.0, note: notes.silence ?? 'match' },
      { id: 'inhibit', label: 'inhib', x: 5.6, y: 5.6, note: notes.inhibit ?? 'parent' },
      { id: 'recv', label: 'recv', x: 7.45, y: 3.8, note: notes.recv ?? 'team' },
      { id: 'notify', label: 'page', x: 9.15, y: 3.8, note: notes.notify ?? 'msg' },
    ],
    edges: [
      { id: 'e-prom-alert', from: 'prom', to: 'alert', weight: '' },
      { id: 'e-alert-group', from: 'alert', to: 'group', weight: '' },
      { id: 'e-alert-route', from: 'alert', to: 'route', weight: '' },
      { id: 'e-group-recv', from: 'group', to: 'recv', weight: '' },
      { id: 'e-route-recv', from: 'route', to: 'recv', weight: '' },
      { id: 'e-silence-recv', from: 'silence', to: 'recv', weight: '' },
      { id: 'e-inhibit-recv', from: 'inhibit', to: 'recv', weight: '' },
      { id: 'e-recv-notify', from: 'recv', to: 'notify', weight: '' },
    ],
  }, { title });
}

function* routeTree() {
  yield {
    state: alertGraph('Alertmanager receives label sets from Prometheus'),
    highlight: { active: ['prom', 'alert', 'group', 'route', 'e-prom-alert', 'e-alert-group', 'e-alert-route'], compare: ['recv'] },
    explanation: 'Prometheus sends firing and resolved alerts to Alertmanager. Each alert is a label set plus annotations and timestamps. Alertmanager groups, deduplicates, routes, silences, inhibits, and notifies receivers.',
  };
  yield {
    state: labelMatrix('Route', [
      { id: 'root', label: 'root' },
      { id: 'sev', label: 'sev' },
      { id: 'svc', label: 'svc' },
      { id: 'team', label: 'team' },
      { id: 'recv', label: 'recv' },
    ], [
      { id: 'key', label: 'key' },
      { id: 'risk', label: 'risk' },
    ], [
      ['all', 'spam'],
      ['crit', 'miss'],
      ['api', 'wrong'],
      ['owner', 'stale'],
      ['pager', 'dup'],
    ]),
    highlight: { active: ['root:key', 'sev:key', 'team:key', 'recv:key'], compare: ['svc:risk'] },
    explanation: 'Routing is tree matching over labels. The root route provides a safe default, and child routes specialize by severity, service, team, region, or environment so one label set maps to the right receiver without per-alert code.',
    invariant: 'Alert labels are the routing keyspace; bad labels create bad pages.',
  };
  yield {
    state: alertGraph('Grouping keys collapse related alerts into one notification', { group: 'svc+alert', recv: 'team', notify: 'batch' }),
    highlight: { active: ['alert', 'group', 'recv', 'notify', 'e-alert-group', 'e-group-recv', 'e-recv-notify'], found: ['route'] },
    explanation: 'Grouping makes an equivalence class over alerts. A good group key keeps one incident together, such as one service outage, without merging unrelated failures that need different responders.',
  };
  yield {
    state: labelMatrix('Case', [
      { id: 'db', label: 'DB' },
      { id: 'api', label: 'api' },
      { id: 'node', label: 'node' },
      { id: 'maint', label: 'maint' },
    ], [
      { id: 'group', label: 'grp' },
      { id: 'recv', label: 'recv' },
    ], [
      ['clu', 'DBA'],
      ['svc', 'oncall'],
      ['zone', 'infra'],
      ['win', 'none'],
    ]),
    highlight: { active: ['db:recv', 'api:recv', 'node:recv'], compare: ['maint:recv'] },
    explanation: 'Complete case study: a database outage fires storage, query, and replica-lag alerts. Grouping by cluster and alertname sends one incident to the DBA receiver. Service alerts inhibited by the database-root-cause alert avoid paging every dependent service team.',
  };
}

function* noiseControl() {
  yield {
    state: alertGraph('Silences mute matching alerts for known windows', { silence: 'window', recv: 'skip', notify: 'none' }),
    highlight: { active: ['alert', 'silence', 'recv', 'e-silence-recv'], removed: ['notify'], compare: ['route'] },
    explanation: 'A silence is a time-bounded matcher. It is appropriate for maintenance windows and known noisy alerts, but it should be narrow enough that unrelated incidents still page.',
  };
  yield {
    state: labelMatrix('Mute', [
      { id: 'sil', label: 'sil' },
      { id: 'inh', label: 'inh' },
      { id: 'dedup', label: 'dedup' },
      { id: 'group', label: 'group' },
    ], [
      { id: 'job', label: 'job' },
      { id: 'bad', label: 'bad' },
    ], [
      ['match', 'wide'],
      ['root', 'wrong'],
      ['same', 'lost'],
      ['batch', 'delay'],
    ]),
    highlight: { active: ['sil:job', 'inh:job', 'dedup:job', 'group:job'], compare: ['sil:bad'] },
    explanation: 'Silence, inhibition, deduplication, and grouping solve different noise problems. Mixing them up is how teams accidentally hide urgent alerts or flood responders.',
  };
  yield {
    state: alertGraph('Inhibition suppresses downstream symptoms while root cause is active', { inhibit: 'root', recv: 'less noise', notify: 'root page' }),
    highlight: { active: ['alert', 'inhibit', 'recv', 'notify', 'e-inhibit-recv', 'e-recv-notify'], found: ['group'] },
    explanation: 'Inhibition rules mute target alerts only while a source alert is firing and the required equal labels match. The equal-label check is the guard that stops a root-cause rule from muting unrelated incidents.',
  };
  yield {
    state: labelMatrix('Timer', [
      { id: 'wait', label: 'wait' },
      { id: 'int', label: 'int' },
      { id: 'rep', label: 'rep' },
      { id: 'res', label: 'res' },
    ], [
      { id: 'role', label: 'role' },
      { id: 'risk', label: 'risk' },
    ], [
      ['first', 'slow'],
      ['new', 'spam'],
      ['repeat', 'nag'],
      ['clear', 'miss'],
    ]),
    highlight: { active: ['wait:role', 'int:role', 'rep:role'], compare: ['res:risk'] },
    explanation: 'Notification timing is part of the data structure. Group wait lets related alerts arrive before the first notification. Group interval controls updates. Repeat interval controls reminders. Resolved notifications close the loop.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'route tree') yield* routeTree();
  else if (view === 'noise control') yield* noiseControl();
  else throw new InputError('Pick an Alertmanager view.');
}

export const article = {
  sections: [
    { heading: 'Why this exists', paragraphs: [
      'Prometheus decides that an alert expression is active. Alertmanager decides what humans should hear about it. That second step exists because a real outage can create hundreds of related alert instances, repeated notifications, and symptoms from systems that are only downstream of the first failure.',
      { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Server monitoring infrastructure', caption: 'Production infrastructure generates thousands of alerts — routing and grouping prevent alert fatigue. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0' },
      'The data-structure lesson is label routing. Alert labels are keys, the route tree is a matcher hierarchy, grouping keys batch equivalent alerts, silences are time-bounded predicates, and inhibition rules encode dependency edges between source and target alerts.',
      'Primary sources: Alertmanager overview at https://prometheus.io/docs/alerting/latest/alertmanager/ and configuration reference at https://prometheus.io/docs/alerting/latest/configuration/.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The simple design is to send every firing Prometheus alert directly to the team named in the rule. That works for a small service: one rule fires, one receiver gets one page, and the person on call knows where to look.',
      'The approach is reasonable because alert rules already contain labels and annotations. It is tempting to treat each alert as a complete notification instead of routing it through another data structure.',
    ] },
    { heading: 'Where that fails', paragraphs: [
      'A large outage breaks the direct-page model. One database failure can trigger storage, replica lag, API latency, checkout errors, and host alerts. Sending each instance as its own page turns evidence into noise and slows the responder down.',
      'The failure is not only volume. The system also needs maintenance mutes, repeated-notification control, receiver ownership, and dependency suppression. A flat list of alerts has no place to express those policies safely.',
      { type: 'callout', text: 'Alert fatigue kills incident response. When every alert fires individually, operators learn to ignore them all. Grouping, inhibition, and silencing are not convenience features — they are safety mechanisms.' },
    ] },
    { heading: 'Core insight', paragraphs: [
      'Treat alert handling as operations over label sets. A route tree maps labels to receivers. A grouping key defines which alert instances belong in the same notification. A silence is a matcher plus a time window. An inhibition rule says that one active source alert can suppress target alerts when selected labels are equal.',
      { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt: 'Decision tree', caption: 'Alertmanager routes alerts through a tree of matchers, like a decision tree classifying each alert to its correct receiver. Source: Wikimedia Commons, CC BY-SA 4.0' },
      'That turns alert noise control into a small rule engine. The correctness of the outcome depends less on clever code than on whether labels describe ownership, service boundaries, severity, and dependency scope accurately.',
      { type: 'callout', text: 'Inhibition encodes causal knowledge: if the network is down, suppress all application alerts that depend on it. Without inhibition, a single root cause generates hundreds of misleading notifications.' },
    ] },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the route-tree view, read each matcher as a branch predicate over the alert\'s label set. The important question is not which box lights up first; it is which receiver becomes responsible after the alert has passed through defaults, child routes, grouping keys, and continue rules.',
        'In the noise-control view, follow the alert through three different filters. A silence removes alerts by an explicit human-created matcher. Deduplication recognizes an alert fingerprint that has already notified. Inhibition suppresses a target only when an active source alert proves the same scoped incident is already being handled.',
        'The marks in the animation are policy decisions. A routed alert has an owner. A grouped alert has been batched with related evidence. A silenced alert is intentionally hidden for a bounded time. An inhibited alert is not gone; it is withheld because a higher-level alert explains it.',
      ],
    },
    { heading: 'How it works', paragraphs: [
      'An incoming alert is first identified by its label set. Alertmanager matches it through the route tree to find a receiver, computes a grouping key such as cluster plus alertname, checks active silences, checks inhibition rules, deduplicates repeated notifications, and applies group timing before sending or suppressing a message.',
      { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Network topology', caption: 'Alert routing trees mirror the organizational structure of the systems they monitor. Source: Wikimedia Commons, The Opte Project, CC BY 2.5' },
      'The timing knobs are part of the mechanism. Group wait gives related alerts time to arrive before the first notification. Group interval controls updates for an existing group. Repeat interval controls reminders when the incident stays active. Resolved notifications tell receivers when the group has cleared.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Suppose `DatabaseDown` fires for cluster `prod-us-east-1`, and a minute later `APILatencyHigh`, `CheckoutErrorsHigh`, and `ReplicaLagHigh` fire with the same cluster label. A direct paging system would send four separate messages to three or four teams. Alertmanager can route the database alert to the database receiver, group related database alerts by cluster, and inhibit downstream service alerts when the source and target share the same cluster.',
      'That outcome is useful only if the labels are precise. If the downstream alerts do not carry the same cluster label, inhibition cannot prove they belong to the same incident. If an inhibition rule matches only on `severity`, it may hide unrelated symptoms. The worked example shows the real invariant: suppression is a claim about shared scope, not a claim that a string matched.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The useful invariant is that two alerts with the same grouping key are treated as one notification group until their labels or lifecycle diverge. Deduplication keeps the same alert fingerprint from becoming repeated new work. Inhibition is safe only when the source and target share the labels that prove they refer to the same scope, such as the same cluster.',
      { type: 'callout', text: 'The routing tree is evaluated top-down with continue semantics. An alert matches the first route whose matchers fit, unless continue:true sends it to additional routes. This gives operators both precision and coverage.' },
      'This is why label discipline matters. Good labels make routing deterministic and inhibition narrow. Bad labels make the tree look correct while it pages the wrong team or hides the wrong symptom.',
    ] },
    { heading: 'Costs and tradeoffs', paragraphs: [
      'The work grows with active alerts, route matchers, silence matchers, inhibition rules, and notification groups. The bigger cost is operational: every new label convention, route branch, and inhibition rule becomes part of the incident-response contract.',
      'Grouping can delay the first page. Silences can hide a real incident. Inhibition can suppress useful symptoms. A route tree can become hard to audit when teams encode ownership in slightly different label names.',
    ] },
    { heading: 'Design guidance', paragraphs: [
      'Build routes around labels that are stable under incident pressure: service, team, environment, cluster, region, severity, and customer tier when that tier really changes response. Avoid routing on labels that are generated, high-cardinality, or ambiguous. A route tree should explain ownership, not mirror every metric dimension.',
      'Treat silences as temporary operational exceptions and inhibition rules as source-target contracts. A silence should have a clear reason and expiration. An inhibition rule should be narrow enough that an engineer can explain which source alert makes which target alert redundant. If the explanation depends on tribal knowledge, the rule is probably too broad.',
      'The best configurations are boring to debug. Given one alert payload, an on-call engineer should be able to predict the route, group key, silence result, inhibition result, and notification timing without reading the whole monitoring stack.',
    ] },
    { heading: 'Where it wins', paragraphs: [
      'Alertmanager wins when many alert instances describe one incident, when ownership can be derived from labels, and when dependency relationships are stable enough to encode. Cluster outages, service-level pages, maintenance windows, and multi-team receiver policies are the natural fit.',
      { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Prometheus_software_logo.svg', alt: 'Prometheus logo', caption: 'Prometheus and Alertmanager form the standard open-source monitoring and alerting stack. Source: Wikimedia Commons, CNCF, Apache 2.0' },
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It is the wrong tool for deciding whether a metric expression should fire; that belongs in Prometheus rules. It also cannot infer root cause from weak labels. If dependency labels are missing, stale, or too broad, inhibition becomes guesswork and should stay out of the paging path.',
      'It also fails as a substitute for incident review. If a responder says, "I never saw the alert," the answer is not to add another route immediately. First trace the alert through the route tree, group key, silence table, inhibition rules, deduplication state, and notification timing. The right fix may be a label convention, a receiver ownership rule, or a runbook link rather than more paging volume.',
      'A useful production practice is to keep examples of real alert payloads next to routing changes. For each example, record the expected receiver, group key, and suppression result. That makes route changes reviewable as data-structure behavior instead of as folklore inside a YAML file.',
    ] },
    { heading: 'Study next', paragraphs: [
      'Study Prometheus Rule Evaluation Alert State Machine, SLO Error Budget Burn Rate Alert, Metric Label Cardinality Control, Prometheus TSDB Case Study, AIOps Incident Response, Distributed Tracing, and Flagger Progressive Delivery Canary next.',
    ] },
  ],
};
