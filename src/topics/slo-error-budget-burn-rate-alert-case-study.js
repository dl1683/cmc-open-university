// SLO burn-rate alerting: convert user-visible failures into rolling-window
// budget spend so pages fire on risk, not on statistically interesting noise.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'slo-error-budget-burn-rate-alert-case-study',
  title: 'SLO Error Budget Burn Rate Alert',
  category: 'Systems',
  summary: 'How SLO alerting uses good/total counters, rolling windows, burn rates, and multi-window policies to page only when reliability budget is being spent too fast.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['burn-rate windows', 'multi-window policy'], defaultValue: 'burn-rate windows' },
  ],
  run,
};

function sloGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'events', label: 'events', x: 0.7, y: 3.6, note: notes.events || 'requests' },
      { id: 'sli', label: 'SLI', x: 2.4, y: 3.6, note: notes.sli || 'ratio' },
      { id: 'budget', label: 'budget', x: 4.1, y: 3.6, note: notes.budget || 'bad ok' },
      { id: 'short', label: 'short win', x: 5.9, y: 2.0, note: notes.short || 'fast' },
      { id: 'long', label: 'long win', x: 5.9, y: 5.2, note: notes.long || 'stable' },
      { id: 'rule', label: 'rule', x: 7.6, y: 3.6, note: notes.rule || 'AND/OR' },
      { id: 'page', label: 'page', x: 9.2, y: 2.2, note: notes.page || 'urgent' },
      { id: 'ticket', label: 'ticket', x: 9.2, y: 5.0, note: notes.ticket || 'slow burn' },
    ],
    edges: [
      { id: 'e-events-sli', from: 'events', to: 'sli' },
      { id: 'e-sli-budget', from: 'sli', to: 'budget' },
      { id: 'e-budget-short', from: 'budget', to: 'short' },
      { id: 'e-budget-long', from: 'budget', to: 'long' },
      { id: 'e-short-rule', from: 'short', to: 'rule' },
      { id: 'e-long-rule', from: 'long', to: 'rule' },
      { id: 'e-rule-page', from: 'rule', to: 'page' },
      { id: 'e-rule-ticket', from: 'rule', to: 'ticket' },
    ],
  }, { title });
}

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

function* burnRateWindows() {
  yield {
    state: sloGraph('An SLO alert starts from user-visible events'),
    highlight: { active: ['events', 'sli', 'e-events-sli'], compare: ['budget', 'short', 'long'] },
    explanation: 'The raw input is not CPU or heap. It is user-visible good and bad events: successful requests, fast-enough responses, valid checkout attempts, or whatever the service promised.',
  };

  yield {
    state: labelMatrix(
      'A 99.9% SLO has a 0.1% error budget',
      [
        { id: 'total', label: 'total' },
        { id: 'good', label: 'good' },
        { id: 'bad', label: 'bad' },
        { id: 'budget', label: 'budget' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['1,000,000', 'requests'],
        ['999,000', 'within SLO'],
        ['1,000', 'allowed bad'],
        ['0.1%', 'can spend'],
      ],
    ),
    highlight: { active: ['bad:value', 'budget:value'], found: ['good:value'] },
    explanation: 'If the SLO target is 99.9%, the service is allowed to fail 0.1% of events over the period. That allowed failure rate is the denominator for burn rate.',
    invariant: 'Burn rate = observed error rate divided by allowed error rate.',
  };

  yield {
    state: labelMatrix(
      'Burn rate turns error rate into time-to-exhaustion',
      [
        { id: 'normal', label: '0.1% err' },
        { id: 'ten', label: '1% err' },
        { id: 'fast', label: '5% err' },
        { id: 'outage', label: '20% err' },
      ],
      [
        { id: 'burn', label: 'burn' },
        { id: '30d', label: '30d budget' },
      ],
      [
        ['1x', 'lasts 30d'],
        ['10x', 'lasts 3d'],
        ['50x', 'lasts 14h'],
        ['200x', 'lasts 3.6h'],
      ],
    ),
    highlight: { found: ['normal:burn'], active: ['fast:burn', 'outage:30d'], compare: ['ten:30d'] },
    explanation: 'A burn rate of 1x spends budget exactly on pace. A 50x burn spends a 30-day budget in about 14 hours. This is why SLO alerts talk about budget risk instead of raw error percentages.',
  };

  yield {
    state: sloGraph('Rolling windows separate a spike from sustained damage', { short: '5m', long: '1h', rule: 'compare' }),
    highlight: { active: ['short', 'long', 'rule', 'e-short-rule', 'e-long-rule'], found: ['budget'], compare: ['page'] },
    explanation: 'A short window reacts quickly, but it can be noisy. A long window is stable, but it resolves slowly. Using both gives the alert memory without letting one noisy minute page the team.',
  };

  yield {
    state: labelMatrix(
      'Window choice shapes the alert',
      [
        { id: '1m', label: '1m' },
        { id: '5m', label: '5m' },
        { id: '1h', label: '1h' },
        { id: '6h', label: '6h' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'weakness', label: 'weakness' },
      ],
      [
        ['fast signal', 'noisy'],
        ['quick page', 'still jumpy'],
        ['stable signal', 'slower'],
        ['policy view', 'slow resolve'],
      ],
    ),
    highlight: { active: ['5m:strength', '1h:strength'], compare: ['1m:weakness', '6h:weakness'] },
    explanation: 'The alert is a data structure over time. A useful page usually combines a fast window and a stable window so the rule is both responsive and resistant to single-sample noise.',
  };
}

function* multiWindowPolicy() {
  yield {
    state: labelMatrix(
      'Multi-window multi-burn policy',
      [
        { id: 'fast', label: 'fast page' },
        { id: 'slow', label: 'slow page' },
        { id: 'ticket', label: 'ticket' },
      ],
      [
        { id: 'long', label: 'long win' },
        { id: 'short', label: 'short win' },
        { id: 'action', label: 'action' },
      ],
      [
        ['1h high', '5m high', 'page now'],
        ['6h high', '30m high', 'page'],
        ['3d high', '6h high', 'plan work'],
      ],
    ),
    highlight: { active: ['fast:action', 'slow:action'], found: ['ticket:action'] },
    explanation: 'Google SRE popularized multi-window multi-burn-rate alerting: require a long window and a short window to be bad at the same time. The long window proves the budget is truly threatened; the short window lets the alert resolve after the fix.',
  };

  yield {
    state: sloGraph('The rule gates pages on both impact and persistence', { short: 'bad?', long: 'bad?', rule: 'both high' }),
    highlight: { active: ['short', 'long', 'rule', 'page'], found: ['e-short-rule', 'e-long-rule', 'e-rule-page'], compare: ['ticket'] },
    explanation: 'This is a Boolean gate over rolling counters. A fast spike alone is evidence, not a page. Sustained burn plus current burn means users are still being harmed and the budget is disappearing.',
  };

  yield {
    state: labelMatrix(
      'Why the short window is also in the rule',
      [
        { id: 'ongoing', label: 'ongoing' },
        { id: 'fixed', label: 'fixed' },
        { id: 'noisy', label: 'noisy' },
      ],
      [
        { id: 'long', label: 'long' },
        { id: 'short', label: 'short' },
        { id: 'alert', label: 'alert' },
      ],
      [
        ['bad', 'bad', 'fire'],
        ['bad', 'good', 'resolve'],
        ['good', 'bad', 'hold'],
      ],
    ),
    highlight: { found: ['ongoing:alert'], active: ['fixed:alert'], compare: ['noisy:alert'] },
    explanation: 'If the outage is fixed, the long window may remain bad for a while. The short window going green lets the alert close. If only the short window is bad, the rule resists noise.',
  };

  yield {
    state: labelMatrix(
      'What not to page on',
      [
        { id: 'cpu', label: 'CPU high' },
        { id: 'queue', label: 'queue up' },
        { id: 'err', label: '5xx burn' },
        { id: 'latency', label: 'p99 burn' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'route', label: 'route' },
      ],
      [
        ['symptom', 'dashboard'],
        ['risk', 'watch'],
        ['user harm', 'SLO page'],
        ['user harm', 'SLO page'],
      ],
    ),
    highlight: { active: ['err:route', 'latency:route'], compare: ['cpu:route', 'queue:route'] },
    explanation: 'SLO paging is about user harm. CPU, queue depth, and cache misses explain incidents, but they should usually support diagnosis rather than directly interrupt a human.',
  };

  yield {
    state: sloGraph('AIOps consumes burn-rate evidence instead of raw alert floods', { page: 'incident', ticket: 'review' }),
    highlight: { active: ['budget', 'short', 'long', 'rule', 'page'], found: ['e-rule-page'], compare: ['events'] },
    explanation: 'AIOps Incident Response gets much better inputs when each page already encodes user impact, time window, budget burn, and route. The model or rule engine is correlating incidents, not guessing which graph spike matters.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'burn-rate windows') yield* burnRateWindows();
  else if (view === 'multi-window policy') yield* multiWindowPolicy();
  else throw new InputError('Pick an SLO burn-rate view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'SLO burn-rate alerting converts user-visible failures into error-budget spend. Instead of paging on CPU, queue depth, or a statistically unusual metric, the system asks whether the service is consuming its reliability budget fast enough that a human must respond.',
        'For a 99.9% SLO, the allowed error rate is 0.1%. If the observed error rate is 1%, the service is burning budget at 10x. That number is easier to route than a raw error percentage because it already includes the promise the service made to users.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline starts with an SLI: good events divided by total events. A request might be good if it returns a non-error response under a latency threshold. The error budget is 1 minus the SLO target. Burn rate is observed error rate divided by budget error rate. A burn rate of 1x means the service is exactly on pace to spend its budget over the SLO window.',
        'The alerting rule uses rolling windows. A short window catches active damage quickly. A long window confirms that the budget is truly threatened. Multi-window multi-burn-rate alerts combine those windows so pages fire for sustained user harm and resolve quickly after the system recovers.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The hard part is choosing the SLI and windows. If the SLI is not user-visible, the alert optimizes internal symptoms. If the window is too short, the alert is noisy. If it is too long, it fires late and resolves late. If the SLO target is unrealistic, the team either ignores pages or spends all engineering time defending an impossible promise.',
        'Burn-rate rules also need volume awareness. A 100% error rate over two requests is not the same incident as a 5% error rate over millions of checkouts. Production alerting should include minimum traffic, missing-data behavior, and clear severity routing.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A checkout service has a 99.9% monthly availability SLO. The SLI counts successful checkout attempts over all attempts. A deploy starts causing 5xx responses. The 5-minute burn rate jumps high, and the 1-hour burn rate also exceeds the page threshold. The page includes SLI, burn rate, error budget consumed, recent deploy, top failing route, and trace examples. AIOps can then group the page with logs, traces, and deploy metadata instead of guessing from raw CPU and error graphs.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not page directly on resource symptoms unless they are already tied to user harm. High CPU can be fine. Low CPU can be disastrous if the service is wedged. Do not alert on only a single long window unless you are comfortable with slow recovery. Do not let burn-rate alerts replace dashboards; they tell you when to respond, not why the incident happened.',
        'Another trap is treating all SLOs as equal. A consumer feed, payment authorization, internal batch job, and developer preview API can have different reliability targets and routing policies. The alert should encode the product promise, not a universal number.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google SRE Workbook Alerting on SLOs at https://sre.google/workbook/alerting-on-slos/, Google SRE Monitoring Distributed Systems at https://sre.google/sre-book/monitoring-distributed-systems/, and OpenTelemetry metrics data model at https://opentelemetry.io/docs/specs/otel/metrics/data-model/. Study Tail Latency & p99 Thinking, AIOps Incident Response, OpenTelemetry Collector Case Study, OpenTelemetry Tail Sampling Policy, Metric Exemplars Trace Correlation, Distributed Tracing, Sliding Window, and Prometheus TSDB Case Study next.',
      ],
    },
  ],
};
