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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each rule tick as one scheduled evaluation of a PromQL expression. PromQL is Prometheus Query Language, and an instant vector is the set of time series returned at one evaluation time. Active nodes show the expression being evaluated; found nodes show label sets that became recorded samples or alert instances.',
        'In the alert-state view, one label set is one alert identity. Pending means the condition is true but has not stayed true for the required for-window. Firing means the same identity survived enough ticks to notify Alertmanager.',
        {type:'callout', text:'Prometheus alerting works by giving each returned label set its own state machine over scheduled rule ticks.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A metric is a measured number over time, such as request count or CPU seconds. Operators need rules because a raw graph does not remember whether a condition stayed true long enough to wake a person. Prometheus rules turn repeated PromQL expressions into scheduled work with durable names and alert state.',
        'Recording rules store derived time series. Alerting rules create alert instances from expression results. The reason both exist is operational consistency: the same calculation should feed dashboards, pages, and runbooks instead of being pasted differently in every place.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to put the full PromQL query directly in a dashboard or alert. That works for one service and one engineer because the query is visible and easy to change. It also feels cheap because no extra stored series is created.',
        'For alerting, the obvious approach is to page whenever a threshold is crossed. If error rate is above 2 percent now, send the alert now. That catches simple failures, but it treats every single evaluation as equally trustworthy.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Copied queries drift. One dashboard may use a five-minute rate while the alert uses one minute, so the graph and page disagree during the same incident. Expensive expressions also run again in every consumer instead of once on a rule schedule.',
        'Instant threshold paging flaps on noise. A missing metric can return no series and look healthy. A label such as pod or path can split one service outage into hundreds of alert identities, so the wall is not syntax; it is identity and continuity over time.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A rule group is a small batch job that wakes up on a fixed interval. It evaluates a query at one timestamp and receives a vector of labeled results. For a recording rule, each result becomes a new sample under a chosen metric name.',
        'For an alerting rule, the label set is the key of a state machine. The same expression can track service="checkout" and service="api" independently because each returned label set owns its own pending timer, firing state, and resolution path.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Prometheus scrapes raw samples into its time-series database. A rule group then runs its rules in order at the configured evaluation interval. A recording rule writes the vector result back as derived series, so later queries can read the recorded metric instead of recomputing the full expression.',
        'An alerting rule compares the current vector with prior alert instances. If a label set appears for the first time and the rule has a for-window, that instance becomes pending. If it remains present until the window is satisfied, it becomes firing and Prometheus sends it to Alertmanager for routing and notification.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that alert state belongs to label-set identity, not to a graph pixel or a human memory of a query. If the same label set appears on every relevant tick during the for-window, the rule has evidence that the condition persisted under the schedule. If it disappears, the state clears because continuity was broken.',
        'Recording rules are correct when consumers agree to treat the recorded series as the named result of the expression at rule-evaluation time. They trade freshness for shared work. Alertmanager stays separate because Prometheus decides whether a condition is firing, while Alertmanager decides who hears about it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Rule cost is driven by how many series the PromQL expression touches and how many vector elements it returns. Cutting an evaluation interval from 60 seconds to 15 seconds can multiply rule-query load by four. A wide query over 500000 series can hurt even if it returns only ten alerts.',
        'The human cost is label design. A short for-window catches fast failures but pages on noise. A long for-window lowers noise but delays detection. Adding pod as an alert label can turn one checkout outage into 300 alert instances if 300 pods cross the same threshold.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Recording rules are used for service-level indicators, burn-rate inputs, expensive dashboard aggregates, and precomputed rates that many teams read. They work when the derived metric has a stable meaning and the evaluation lag is acceptable.',
        'Alerting rules are used for symptoms that need state: high error ratio, exhausted disk, missing scrape targets, slow rule evaluation, and budget burn. They fit incidents where a label set maps to a real operational owner, such as service, cluster, or region.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Rules fail when they hide absence. If a target stops exporting a metric, a threshold expression may return no vector element, so no alert fires. Absence needs explicit absent-style checks when missing telemetry is itself a failure.',
        'They also fail as an event-processing system. Prometheus samples at scrape and evaluation times; it does not preserve every request or exact event order. For exact per-event workflows, use logs, traces, queues, or a stream processor instead of trying to force that job into alert rules.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose checkout has 100000 requests in five minutes and 3500 of them are 5xx errors. A recording rule computes error_ratio = 3500 / 100000 = 0.035, or 3.5 percent, for label set service="checkout". The alert threshold is 2 percent for 10 minutes with a 30-second evaluation interval.',
        'At tick 0 the label set appears and becomes pending. After 20 ticks, 10 minutes have passed, so the same label set becomes firing if it never dropped below threshold. If the rule also kept pod in the alert labels across 80 pods, the same incident could create up to 80 pending timers instead of one service-level alert.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Prometheus recording rules documentation, Prometheus alerting rules documentation, Prometheus alerting overview, and Alertmanager documentation. Study the Prometheus TSDB case study next because rule queries read that storage engine.',
        'For related concepts, study metric label cardinality control, sliding-window rates, SLO burn-rate alerting, and notification routing. The practical next skill is to write rule tests with promtool so query meaning is checked before production.',
      ],
    },
  ],
};
