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

export const article = { sections: [
{ heading: 'How to read the animation', paragraphs: ['Read the route-tree view as matching over label sets. A label set is key-value data attached to an alert, such as service, cluster, severity, team, region, and environment.','Active nodes show routing or suppression, removed nodes show muted notifications, and found nodes show the receiver or group. Suppression is valid only when labels prove the same scoped incident is already represented.'] },
{ heading: 'Why this exists', paragraphs: ['Prometheus decides that a rule is firing, but Alertmanager decides what humans should hear. That second step exists because one outage can create many alert instances, repeated notifications, and downstream symptoms.',{ type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Server monitoring infrastructure', caption: 'Production infrastructure generates thousands of alerts ? routing and grouping prevent alert fatigue. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0' },{type:'callout', text:'Alertmanager turns alert floods into label scoped decisions: route by ownership, group by incident shape, silence by explicit time window, and inhibit downstream noise when a stronger source alert explains it.'},'The data structure is a policy tree around alert labels. Routes choose receivers, grouping keys batch equivalent alerts, silences mute known windows, and inhibition rules suppress explained symptoms.'] },
{ heading: 'The obvious approach', paragraphs: ['The obvious approach sends every firing alert directly to the receiver named in its rule. That is fine for a small service because one rule often means one actionable page.','It is tempting because the alert already has labels and annotations. A direct page feels cheaper than another routing layer.'] },
{ heading: 'The wall', paragraphs: ['The wall is incident noise. One database outage can fire storage, replica lag, API latency, checkout error, and node alerts across many instances.',{ type: 'callout', text: 'Alert fatigue kills incident response. When every alert fires individually, operators learn to ignore them all. Grouping, inhibition, and silencing are not convenience features ? they are safety mechanisms.' },'The system also needs maintenance mutes, repeat timing, ownership routing, and dependency suppression. A flat alert stream has no safe place to express those policies.'] },
{ heading: 'The core insight', paragraphs: ['Treat alert handling as operations over label sets. A route is a matcher, a group key defines equivalence, a silence is a time-bounded matcher, and an inhibition rule is a source-target relation guarded by equal labels.',{ type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt: 'Decision tree', caption: 'Alertmanager routes alerts through a tree of matchers, like a decision tree classifying each alert to its correct receiver. Source: Wikimedia Commons, CC BY-SA 4.0' },{ type: 'callout', text: 'Inhibition encodes causal knowledge: if the network is down, suppress all application alerts that depend on it. Without inhibition, a single root cause generates hundreds of misleading notifications.' },'The invariant is scoped determinism. Given one alert payload and current silences, a responder should derive receiver, group, suppression result, and notification timing.'] },
{ heading: 'How it works', paragraphs: ['Alertmanager receives an alert as labels, annotations, start time, and resolved state. It matches labels through a route tree, computes a group key, checks silences and inhibition, deduplicates repeats, and applies notification timers.',{ type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Network topology', caption: 'Alert routing trees mirror the organizational structure of the systems they monitor. Source: Wikimedia Commons, The Opte Project, CC BY 2.5' },'Group wait lets related alerts arrive before the first notification, group interval controls updates, and repeat interval controls reminders. Resolved notifications close the loop so responders know the group cleared.'] },{ heading: 'Why it works', paragraphs: ['The correctness argument is label-scoped equivalence. Alerts with the same grouping key are treated as one notification group until their labels or lifecycle diverge.',{ type: 'callout', text: 'The routing tree is evaluated top-down with continue semantics. An alert matches the first route whose matchers fit, unless continue:true sends it to additional routes. This gives operators both precision and coverage.' },'Inhibition is safe only when source and target share labels that prove scope, such as the same cluster or dependency. Bad labels make the tree look correct while it pages the wrong team or hides the wrong symptom.'] },
{ heading: 'Cost and complexity', paragraphs: ['Runtime cost grows with active alerts, route matchers, silence matchers, inhibition rules, and notification groups. The larger cost is operational because every label convention becomes part of incident response.','Cost behaves like policy debt. A broad silence can hide a real incident, a weak group key can merge unrelated failures, and a stale route can page the wrong team.'] },
{ heading: 'Real-world uses', paragraphs: ['Alertmanager fits service outages, database cluster incidents, regional failures, maintenance windows, multi-team routing, and child-alert suppression during known root causes. It is strongest when ownership and dependency scope are represented in labels.',{ type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Prometheus_software_logo.svg', alt: 'Prometheus logo', caption: 'Prometheus and Alertmanager form the standard open-source monitoring and alerting stack. Source: Wikimedia Commons, CNCF, Apache 2.0' },'It also supports reviewable monitoring changes. Example alert payloads can be checked against expected receiver, group key, silence result, inhibition result, and notification timing before config ships.'] },
{ heading: 'Where it fails', paragraphs: ['It fails when labels do not describe ownership or dependency scope. A powerful route tree cannot infer a cluster relationship that the alert payload never carries.','It also fails as root-cause detection. Inhibition encodes known source-target relationships; it does not prove causality for new incidents or replace post-incident review.'] },
{ heading: 'Worked example', paragraphs: ['DatabaseDown fires for cluster prod-us-east-1, then APILatencyHigh, CheckoutErrorsHigh, and ReplicaLagHigh fire with the same cluster label. A direct system sends four pages to several teams.','Alertmanager groups database alerts by cluster, routes the source alert to the DBA receiver, and inhibits downstream service alerts when equal cluster labels match. If downstream alerts lack the cluster label, inhibition should not fire because shared scope is unproven.'] },
{ heading: 'Sources and study next', paragraphs: ['Study the Prometheus Alertmanager overview and configuration reference, Prometheus rule evaluation, Google SRE alerting on SLOs, and receiver integrations used by your incident process. Read the examples as label-set behavior.','Next study SLO burn-rate alerts, metric label cardinality control, Prometheus TSDB, alert correlation fingerprint indexes, distributed tracing, and progressive delivery canaries.'] },
] };