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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the counters as a reliability budget ledger. Active windows are being evaluated now, visited windows already contributed evidence, and found alerts mean current harm plus budget risk. The safe inference is that burn rate is about spending the allowed error budget, not about a graph looking high.',
        {type:"callout", text:"Burn-rate alerting turns raw failures into a budget-spending signal so pages fire on current user harm and urgency."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A service-level objective, or SLO, states a user-facing reliability target such as 99.9 percent good requests over 30 days. The remaining 0.1 percent is the error budget. Burn-rate alerting exists so pages fire when that budget is being spent too fast.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious alert is a fixed threshold: CPU over 90 percent, p99 over two seconds, or 5xx over 1 percent. Those signals can help diagnosis, but they do not directly say whether users are losing the promised experience. A single long window is stable but reacts and resolves late.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is separating noise from current user harm. A one-minute spike over 10 requests may be noise, while a 1 percent error rate over millions of checkouts can be urgent. A page should represent impact, speed of budget loss, and whether the problem is still happening.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Normalize current error rate by allowed error rate. If the SLO is 99.9 percent, the allowed error rate is 0.1 percent. An observed 1 percent error rate is a 10x burn because the service is spending budget ten times faster than planned.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The system counts eligible events and bad events, computes error rate, then computes burn rate over rolling windows. Multi-window alerting requires a short window and a long window to both exceed threshold. The long window filters brief noise, and the short window proves the harm is still active.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from matching the alert to the SLO math. A burn-rate page means the observed bad-event stream can consume the allowed budget at the stated speed. The two-window rule is a small state machine: short bad plus long bad pages, long bad plus short good resolves, and short bad alone can route to lower urgency.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is SLI design and data quality. An SLI, or service-level indicator, must count the events users care about, handle retries and cancellations, and avoid label explosions. Doubling the number of routes or tenants can double alert cardinality unless the policy defines which slices page.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Burn-rate alerts fit API availability, checkout success, search freshness, streaming playback, model-serving latency, and data pipeline deadlines. A good page carries SLI name, objective, burn rate, short and long windows, affected slice, volume, recent deploys, and trace links.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the SLI is not user-visible or when low volume makes ratios meaningless. It also does not explain root cause. After the page fires, engineers still need deploy metadata, traces, logs, dependency health, queues, and saturation metrics.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A checkout service has a 99.9 percent 30-day SLO, so it may spend 0.1 percent errors. In a 1,000,000-request hour, 12,000 requests fail, giving 1.2 percent observed errors. Burn rate is 1.2 divided by 0.1, or 12x; if both the 5-minute and 1-hour windows stay above threshold, the page is justified.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Google SRE error budgets, multi-window multi-burn-rate alerts, Prometheus counter rates, OpenTelemetry metrics, exemplars, tail latency, incident response, and post-incident review. Then practice designing an SLI before writing any alert rule.',
      ],
    },
  ],
};
