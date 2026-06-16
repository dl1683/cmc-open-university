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
    explanation: 'Routing is tree matching over labels. A root route catches everything, child routes match labels such as severity, service, team, region, or environment, and receivers define where notifications go.',
    invariant: 'Alert labels are the routing keyspace; bad labels create bad pages.',
  };
  yield {
    state: alertGraph('Grouping keys collapse related alerts into one notification', { group: 'svc+alert', recv: 'team', notify: 'batch' }),
    highlight: { active: ['alert', 'group', 'recv', 'notify', 'e-alert-group', 'e-group-recv', 'e-recv-notify'], found: ['route'] },
    explanation: 'Grouping prevents a failing service from sending a separate page for every instance, pod, or shard. The group key should keep one incident together without hiding distinct incidents.',
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
    explanation: 'Inhibition rules mute target alerts when a source alert is firing and equal labels match. This is useful when one root-cause alert explains many symptom alerts.',
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
    { heading: 'What it is', paragraphs: [
      'Alertmanager handles alerts sent by Prometheus and other clients. It deduplicates, groups, routes, silences, inhibits, and sends notifications to receivers such as PagerDuty, email, Slack, or webhooks. The data-structure lesson is label routing: alert labels are keys, route trees decide receivers, grouping keys batch alerts, and inhibition rules suppress symptoms.',
      'Primary sources: Alertmanager overview at https://prometheus.io/docs/alerting/latest/alertmanager/ and configuration reference at https://prometheus.io/docs/alerting/latest/configuration/.',
    ] },
    { heading: 'Route tree', paragraphs: [
      'An alert is mostly a label set. Alertmanager routes by matching labels against a route tree. The root route catches everything; children can match severity, service, team, region, environment, or ownership. Receivers define where notifications go.',
      'This connects directly to Metric Label Cardinality Control. Labels have two jobs: they identify time series and they route operational work. High-cardinality labels can break storage; low-quality labels can page the wrong team.',
    ] },
    { heading: 'Grouping, silence, inhibition', paragraphs: [
      'Grouping batches related alerts. Silences mute matching alerts for a time window. Inhibition suppresses target alerts when a source alert is firing and equal-label constraints match. Deduplication prevents repeated notifications for the same alert fingerprint.',
      'These controls reduce alert floods, but each can hide incidents if configured too broadly. Silences should be narrow and time bounded. Inhibition should encode true dependency relationships, not guesses.',
    ] },
    { heading: 'Complete case study: database root cause', paragraphs: [
      'A database cluster outage triggers storage, replica lag, API latency, and checkout error alerts. Alertmanager groups database alerts by cluster, routes them to DBA on-call, and inhibits downstream service symptom alerts while the database-root-cause alert is firing. Service teams see context without every dependent page becoming its own incident.',
    ] },
    { heading: 'Pitfalls and misconceptions', paragraphs: [
      'Alertmanager does not decide whether an expression is true; Prometheus alerting rules do that. Alertmanager decides how firing alerts become notifications. The common mistakes are bad labels, overbroad silences, inhibition without true root-cause equality labels, and group intervals that either delay urgent pages or spam responders.',
    ] },
    { heading: 'Study next', paragraphs: [
      'Study Prometheus Rule Evaluation Alert State Machine, SLO Error Budget Burn Rate Alert, Metric Label Cardinality Control, Prometheus TSDB Case Study, AIOps Incident Response, Distributed Tracing, and Flagger Progressive Delivery Canary next.',
    ] },
  ],
};
