// Prometheus rules: recording rules materialize expressions, alerting rules
// evaluate vectors into pending/firing/resolved alert state.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'prometheus-rule-evaluation-alert-state-machine-case-study',
  title: 'Prometheus Rule Evaluation Alert State Machine Case Study',
  category: 'Systems',
  summary: 'A Prometheus rules primer: rule groups, evaluation intervals, PromQL vectors, recording rules, alerting rules, for clauses, pending/firing/resolved state, and Alertmanager handoff.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['rule tick', 'alert state'], defaultValue: 'rule tick' },
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

function ruleGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'scrape', label: 'scrape', x: 0.65, y: 3.8, note: notes.scrape ?? 'samples' },
      { id: 'tsdb', label: 'TSDB', x: 2.25, y: 3.8, note: notes.tsdb ?? 'series' },
      { id: 'group', label: 'group', x: 3.95, y: 2.0, note: notes.group ?? 'interval' },
      { id: 'expr', label: 'expr', x: 3.95, y: 5.6, note: notes.expr ?? 'PromQL' },
      { id: 'vec', label: 'vec', x: 5.65, y: 3.8, note: notes.vec ?? 'labels' },
      { id: 'rec', label: 'rec', x: 7.25, y: 2.0, note: notes.rec ?? 'new series' },
      { id: 'alert', label: 'alert', x: 7.25, y: 5.6, note: notes.alert ?? 'state' },
      { id: 'am', label: 'AM', x: 9.05, y: 3.8, note: notes.am ?? 'notify' },
    ],
    edges: [
      { id: 'e-scrape-tsdb', from: 'scrape', to: 'tsdb', weight: '' },
      { id: 'e-tsdb-group', from: 'tsdb', to: 'group', weight: '' },
      { id: 'e-group-expr', from: 'group', to: 'expr', weight: '' },
      { id: 'e-expr-vec', from: 'expr', to: 'vec', weight: '' },
      { id: 'e-vec-rec', from: 'vec', to: 'rec', weight: '' },
      { id: 'e-vec-alert', from: 'vec', to: 'alert', weight: '' },
      { id: 'e-alert-am', from: 'alert', to: 'am', weight: '' },
      { id: 'e-rec-tsdb', from: 'rec', to: 'tsdb', weight: '' },
    ],
  }, { title });
}

function* ruleTick() {
  yield {
    state: ruleGraph('Rule groups evaluate expressions on a fixed interval'),
    highlight: { active: ['tsdb', 'group', 'expr', 'vec', 'e-tsdb-group', 'e-group-expr', 'e-expr-vec'], compare: ['alert'] },
    explanation: 'Prometheus rule files define recording and alerting rules. Rule groups evaluate at configured intervals. Each tick runs PromQL against the TSDB and produces an instant vector of label sets and values.',
  };
  yield {
    state: labelMatrix('Rule', [
      { id: 'grp', label: 'grp' },
      { id: 'expr', label: 'expr' },
      { id: 'vec', label: 'vec' },
      { id: 'rec', label: 'rec' },
      { id: 'alert', label: 'alert' },
    ], [
      { id: 'state', label: 'state' },
      { id: 'risk', label: 'risk' },
    ], [
      ['tick', 'lag'],
      ['query', 'cost'],
      ['labels', 'card'],
      ['series', 'stale'],
      ['fire', 'noise'],
    ]),
    highlight: { active: ['grp:state', 'expr:state', 'vec:state'], compare: ['vec:risk'] },
    explanation: 'A rule tick is a small batch job. Query cost, label cardinality, stale samples, and interval length all affect how quickly and accurately the rule observes reality.',
  };
  yield {
    state: ruleGraph('Recording rules write derived series back to the TSDB', { rec: 'record', tsdb: 'derived', expr: 'rate/sum' }),
    highlight: { active: ['expr', 'vec', 'rec', 'tsdb', 'e-expr-vec', 'e-vec-rec', 'e-rec-tsdb'], found: ['group'] },
    explanation: 'Recording rules precompute expensive or reusable expressions into new time series. They trade storage and freshness for cheaper dashboard queries and simpler alert expressions.',
    invariant: 'A recording rule is a materialized time-series expression, not raw truth.',
  };
  yield {
    state: labelMatrix('Case', [
      { id: 'raw', label: 'raw' },
      { id: 'rate', label: 'rate' },
      { id: 'sum', label: 'sum' },
      { id: 'slo', label: 'SLO' },
    ], [
      { id: 'expr', label: 'expr' },
      { id: 'use', label: 'use' },
    ], [
      ['ctr', 'base'],
      ['5m', 'burn'],
      ['svc', 'dash'],
      ['ratio', 'page'],
    ]),
    highlight: { active: ['rate:use', 'sum:use', 'slo:use'], compare: ['raw:use'] },
    explanation: 'Complete case study: raw HTTP counters become per-service request rates, then error ratios, then burn-rate alert inputs. Each derived series names an intermediate data product rather than repeating one huge query everywhere.',
  };
}

function* alertState() {
  yield {
    state: ruleGraph('Alerting rules turn vector elements into alert instances', { vec: 'labels', alert: 'pending', am: 'send' }),
    highlight: { active: ['expr', 'vec', 'alert', 'e-expr-vec', 'e-vec-alert'], compare: ['am'] },
    explanation: 'When an alerting expression returns vector elements, each element label set becomes an alert instance. The for clause keeps it pending until the condition has remained true long enough.',
  };
  yield {
    state: labelMatrix('State', [
      { id: 'inactive', label: 'off' },
      { id: 'pend', label: 'pend' },
      { id: 'fire', label: 'fire' },
      { id: 'resolve', label: 'res' },
    ], [
      { id: 'why', label: 'why' },
      { id: 'next', label: 'next' },
    ], [
      ['no vec', 'pend'],
      ['for wait', 'fire'],
      ['send', 'res'],
      ['clear', 'off'],
    ]),
    highlight: { active: ['pend:why', 'fire:why', 'resolve:next'], compare: ['inactive:next'] },
    explanation: 'Alert state is a finite-state machine per label set. The same expression can produce many alert instances, each with its own pending timer and resolved lifecycle.',
  };
  yield {
    state: ruleGraph('Firing alerts are handed to Alertmanager for routing', { alert: 'firing', am: 'route', vec: 'labels' }),
    highlight: { active: ['alert', 'am', 'e-alert-am'], found: ['vec'], compare: ['rec'] },
    explanation: 'Prometheus decides that an alert is firing. Alertmanager decides how to group, silence, inhibit, deduplicate, route, and notify. Keeping that boundary clear avoids confused alert design.',
  };
  yield {
    state: labelMatrix('Bad', [
      { id: 'short', label: 'short' },
      { id: 'wide', label: 'wide' },
      { id: 'label', label: 'label' },
      { id: 'test', label: 'test' },
    ], [
      { id: 'bug', label: 'bug' },
      { id: 'fix', label: 'fix' },
    ], [
      ['flap', 'for'],
      ['slow', 'win'],
      ['card', 'drop'],
      ['blind', 'tool'],
    ]),
    highlight: { active: ['short:fix', 'label:fix', 'test:fix'], compare: ['wide:bug'] },
    explanation: 'Alert rule case study: a CPU alert without a for clause flaps, a per-pod label pages hundreds of times, and an untested query silently returns no series. The repair is a for window, aggregation labels, and promtool rule tests.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'rule tick') yield* ruleTick();
  else if (view === 'alert state') yield* alertState();
  else throw new InputError('Pick a Prometheus rule view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: [
      'Prometheus supports recording rules and alerting rules. Rule groups evaluate PromQL expressions at regular intervals. Recording rules write derived time series. Alerting rules turn returned vector elements into pending, firing, or resolved alert instances and send firing alerts to Alertmanager.',
      'Primary sources: recording rules docs at https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/ and alerting rules docs at https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/.',
    ] },
    { heading: 'Rule tick', paragraphs: [
      'A rule tick is a scheduled query over the TSDB. The expression returns an instant vector: one sample per matching label set. Recording rules store that vector as new series. Alerting rules use those vector elements as alert instances.',
      'Evaluation interval is part of the data structure. It controls freshness, query cost, and alert reaction time. Expensive expressions often become recording rules so dashboards and alerts can read precomputed aggregates.',
    ] },
    { heading: 'Alert state machine', paragraphs: [
      'An alert instance begins inactive. If the expression returns its label set, it becomes pending. If it stays active for the for duration, it becomes firing. If the expression stops returning it, it resolves. Alertmanager receives the firing and resolved lifecycle for routing and notification.',
      'This is a finite-state machine per label set. The same expression can produce many alert instances, each with its own pending timer and resolved lifecycle.',
    ] },
    { heading: 'Complete case study: SLO burn rule', paragraphs: [
      'A service exports request and error counters. Recording rules compute 5-minute and 1-hour request rates and error ratios by service. Alerting rules compare those ratios to SLO burn thresholds with for windows. Firing alerts go to Alertmanager, where route and inhibition rules decide who gets paged.',
    ] },
    { heading: 'Pitfalls and misconceptions', paragraphs: [
      'Prometheus rules are not unit tests for reality. Stale samples, missing series, bad label joins, high-cardinality vectors, and query cost can all make a rule misleading. A rule that fires too quickly flaps; a rule that waits too long misses urgent incidents. Recording rules can also hide freshness lag if dashboards treat them as raw samples.',
    ] },
    { heading: 'Study next', paragraphs: [
      'Study Prometheus TSDB Case Study, SLO Error Budget Burn Rate Alert, Sliding Window, Metric Label Cardinality Control, Alertmanager Routing & Inhibition Tree, Grafana Dashboard Query Transform Graph, and AIOps Incident Response next.',
    ] },
  ],
};
