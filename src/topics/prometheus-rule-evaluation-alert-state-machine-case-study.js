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
    explanation: 'Prometheus rule files define scheduled work. Each rule-group tick runs PromQL at one evaluation time and produces an instant vector, so every returned label set is a separate record to materialize or track as alert state.',
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
    explanation: 'When an alerting expression returns vector elements, each element label set becomes its own alert instance. The for clause is a debounce timer: the same label set must stay active long enough before it can page.',
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
    explanation: 'Alert state is a finite-state machine per label set. The label set is the identity key, so one expression can create many independent pending timers and resolved lifecycles.',
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
    {
      heading: 'Why this exists',
      paragraphs: [
        'Metrics are raw observations. Operators need repeatable derived series and alerts that evaluate the same way at 3 a.m. as they do when someone is staring at a graph. Prometheus rules turn PromQL expressions into scheduled work.',
        'Recording rules materialize derived time series. Alerting rules turn expression results into alert instances with state: inactive, pending, firing, and resolved. Alertmanager then handles grouping, silencing, inhibition, routing, and notification.',
        'The key problem is continuity. A graph can show that a service is unhealthy now. An alerting system must know whether the same service was unhealthy on the last tick, how long the condition has remained true, and whether it has already notified someone.',
        {type:'callout', text:'Prometheus alerting works by giving each returned label set its own state machine over scheduled rule ticks.'},
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The first approach is to put the PromQL expression directly in every dashboard and alert. If a dashboard needs a request rate, paste the query. If a graph spikes, page someone. At small scale this is fast and easy to inspect.',
        'That breaks when expressions become shared infrastructure. Copied queries drift. Expensive joins and rates run again and again. A one-sample spike can page a human. A missing series can make an alert look healthy. A high-cardinality label can turn one service incident into hundreds of alert instances.',
        'The missing structure is identity over time. Prometheus must know which label set is the same alert as last tick, how long it has stayed active, and whether an expensive expression should be stored once instead of recomputed everywhere.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A rule group is a scheduled batch job over the TSDB. On each tick, Prometheus evaluates a PromQL expression at an evaluation timestamp and receives an instant vector. Each vector element has a value and a label set.',
        'Recording rules turn those vector elements into new samples under a chosen metric name. They are materialized PromQL expressions with a freshness bound set by the evaluation interval.',
        'Alerting rules use the label set as the identity key for a state machine. The same expression can track `service="api"`, `service="checkout"`, and `service="billing"` independently because each returned label set owns its own pending timer and firing lifecycle.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Scrapes append raw samples to the TSDB. A rule group wakes up on its interval and runs each rule expression against those stored samples. The output is not a scalar unless the query says so. It is usually a vector of label sets.',
        'For a recording rule, Prometheus writes the vector back as derived time series. Dashboards and alerts can then query the recorded series instead of repeating a long expression. This trades storage and freshness lag for cheaper, more consistent reads.',
        'For an alerting rule, Prometheus compares the current vector to the previous alert instances. If a label set appears and there is no `for` duration, it can fire immediately. If a `for` duration exists, the instance enters pending and must remain active across evaluation ticks until the duration is satisfied.',
        'When an active alert disappears from the vector, it resolves or clears according to its lifecycle. Prometheus decides alert state. Alertmanager decides notification behavior: grouping, deduplication, silencing, inhibition, routing, and delivery.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the rule-tick view, follow samples into the TSDB, then watch the rule group wake up and run PromQL. The decisive object is the vector. Its label sets define how many recorded series or alert instances the rule will create.',
        'The recording-rule frame shows a materialized expression. Raw counters become rates, rates become service aggregates, and aggregates become alert inputs. Each step saves repeated query work but adds one more derived series that can lag behind raw samples.',
        'In the alert-state view, read each label set as its own small state machine. Pending is not a weak firing state. It is a timer that says the expression is currently true but has not yet stayed true long enough to page.',
        'The bad-rule matrix shows the common repairs. Add a `for` window for flapping, aggregate away labels that are not part of the incident identity, and use rule tests so a query that returns no series is caught before production.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that alert state is attached to label-set identity, not to a graph pixel or a human memory of yesterday\'s query. If the same label set appears on every relevant tick for the full `for` window, the condition was continuously true under the rule schedule.',
        'Recording rules work for the same reason materialized views work. If many readers need the same expensive expression, one scheduled evaluation can produce a named time series that becomes the shared contract for dashboards, alerts, and runbooks.',
        'The boundary with Alertmanager works because state and notification are different jobs. Prometheus knows whether a rule is firing. Alertmanager knows who should be notified, which alerts should be grouped, and which ones are silenced or inhibited.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with raw `http_requests_total` counters by service, status, instance, and route. A recording rule computes a five-minute rate. Another rule sums by service and status class. A third expression divides errors by total requests to produce a service-level error ratio.',
        'An alerting rule checks whether the checkout service error ratio is greater than 2 percent for 10 minutes. On the first tick where `service="checkout"` appears in the vector, the alert becomes pending. If the same label set stays active for the full window, it becomes firing and is sent to Alertmanager.',
        'If the expression includes `pod` as an alert label, one bad deployment can create hundreds of alert instances. If the expression aggregates to `service`, the alert identity matches the incident: checkout is unhealthy. The label set is not formatting. It is the key of the state machine.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Rule cost is dominated by the series touched by the PromQL expression and by the number of vector elements returned. Short intervals improve freshness but increase query load. Long intervals reduce load but slow detection.',
        'Recording rules add storage and can hide freshness lag if readers forget they are derived data. Chained recording rules can make that lag harder to see because each step depends on the previous scheduled result.',
        'Alert rules carry a human cost. A short `for` window catches problems quickly but flaps on noise. A long window reduces noise but can miss fast-burning incidents. Extra labels help routing only when they do not explode alert cardinality.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Prometheus rules win for repeated aggregates, SLO burn-rate inputs, expensive dashboard expressions, and alerts that need stable per-label state.',
        'They are strongest when a derived metric should become a shared contract. A recorded service error ratio can feed dashboards, alerts, and incident runbooks without every consumer rewriting the same PromQL.',
        'They also make alert behavior reviewable. A rule file can be code-reviewed, unit-tested with promtool, and tied to a runbook instead of living as an invisible query in one dashboard panel.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'Rules are not a replacement for exploratory queries. During debugging, direct PromQL in a graph is faster and less permanent than creating a recorded series.',
        'Rules are not an event-processing engine. They observe scraped samples at evaluation times. If the system needs exact event ordering, durable workflows, or per-request traces, use logs, tracing, queues, or a stream processor.',
        'Prometheus also does not own notification policy. Do not pack grouping, silencing, escalation, and inhibition into alert expressions. Alertmanager exists so the rule can state the condition and the notification layer can decide delivery.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'High-cardinality alert labels are the most visible failure. Putting `pod`, `path`, `user_id`, or `request_id` into alert identity can turn one incident into a notification storm.',
        'Missing series are quieter and often worse. If a target stops exporting a metric, an expression can return no vector element, which may look like no alert. Use absent-style checks when absence itself is failure.',
        'PromQL vector matching and aggregation mistakes can silently change meaning. A bad join can duplicate series. Aggregating away the wrong label can hide the failing shard. Keeping the wrong label can split one incident into many. Rule tests exist because these bugs are hard to see by inspection.',
      ],
    },
    {
      heading: 'Primary references',
      paragraphs: [
        'Prometheus recording rules documentation: https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/.',
        'Prometheus alerting rules documentation: https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/.',
        'Prometheus alerting overview and Alertmanager boundary: https://prometheus.io/docs/alerting/latest/overview/.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Prometheus TSDB Case Study next to understand what rule queries read. Study Sliding Window and SLO Error Budget Burn Rate Alert to understand why alert windows and rates behave the way they do.',
        'Study Metric Label Cardinality Control before writing production alerts. Study Alertmanager Routing and Inhibition Tree for the notification layer. Study Grafana Dashboard Query Transform Graph for the dashboard side of the same query pipeline.',
      ],
    },
  ],
};
