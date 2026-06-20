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
        "Read the animation as the execution trace for SLO Error Budget Burn Rate Alert. How SLO alerting uses good/total counters, rolling windows, burn rates, and multi-window policies to page only when reliability budget is being spent too fast..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
        {type:"callout", text:"Burn-rate alerting turns raw failures into a budget-spending signal so pages fire on current user harm and urgency."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'SLO burn-rate alerting exists because alerting should be tied to user harm, not to every interesting graph movement. A production service can have high CPU, a full queue, a noisy dependency, or a strange latency shape without requiring a human to wake up immediately. The page should fire when the service is spending its reliability budget fast enough that the product promise is at risk.',
        'The key word is budget. A service-level objective says how reliable the service is supposed to be over a period. A 99.9 percent availability target allows 0.1 percent of events to be bad during that period. That allowance is the error budget. Burn-rate alerting asks how quickly the current stream of bad events is spending that allowance. It gives teams a way to page on impact and urgency instead of raw surprise.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The naive alert pages when a metric crosses a fixed threshold: CPU above 90 percent, p99 latency above two seconds, 5xx rate above one percent, queue depth above a chosen number. This feels concrete, and it is often useful for dashboards. It is weak as a paging policy because it does not ask whether users are losing the promised experience. High CPU during a planned batch job may be healthy. A small latency bump on an internal endpoint may not matter. A short 100 percent error spike over two requests may not justify an incident.',
        'Another naive design uses one long rolling window over the SLI. The long window is stable, but it reacts late and resolves late. After a fix is deployed, the long window can remain bad because it still contains the outage. Humans stay paged even though current users are no longer being harmed. The opposite mistake is one tiny window, which reacts quickly but pages on noise. Burn-rate alerting is the compromise that keeps the user promise at the center.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to normalize observed failures by the amount of failure the service is allowed to have. First define the service-level indicator, usually good events divided by total eligible events. Then define the objective, such as 99.9 percent good events over 30 days. The allowed error rate is one minus the objective, so 99.9 percent means 0.1 percent bad events are allowed. Burn rate is observed error rate divided by allowed error rate.',
        'That ratio makes very different services comparable. If the allowed error rate is 0.1 percent and the current observed error rate is 1 percent, the service is burning at 10x. It is spending budget ten times faster than planned. A 1x burn uses the budget exactly on pace. A 50x burn can consume a 30-day budget in roughly 14 hours. The alert is no longer saying "the graph is high." It is saying "the reliability budget is disappearing at this speed."',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The system starts by classifying events. For an API, each request may be good if it returns a valid response under the latency target. For a checkout system, an eligible attempt may be good if it completes successfully. For a streaming product, seconds of playback may be the event. The counters are usually total events and bad events, sometimes sliced by route, tenant, region, or dependency. From those counters the platform computes error rate, burn rate, and budget consumed over rolling windows.',
        'The alerting rule then combines windows. A common pattern is multi-window multi-burn-rate alerting: require both a long window and a short window to be above threshold. The long window proves the error budget is under real threat, not just a one-minute blip. The short window proves the problem is still happening and lets the alert resolve quickly after the fix. A severe page might use a one-hour window and a five-minute window. A slower page or ticket might use six hours and thirty minutes, or three days and six hours, depending on the policy.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'The burn-rate-window view proves the transformation from raw traffic to reliability risk. Events become an SLI. The SLI defines bad events. Bad events spend a fixed error budget. The burn-rate table translates error percentages into time-to-exhaustion. This is the conceptual move that makes the alert actionable: a responder can reason about how much time remains before the service violates its promise.',
        'The multi-window view proves why the rule uses two pieces of memory. A short bad window alone is evidence, but it may be noise. A long bad window alone may describe an outage that has already stopped. Short bad plus long bad means current harm and sustained budget risk. Long bad plus short good means the service is recovering and the alert should be allowed to close. The visual is not just showing alert thresholds; it is showing how the rule distinguishes urgency from historical damage.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Burn-rate alerting works because it aligns three things that are often separated: the user promise, the amount of unreliability the business is willing to tolerate, and the urgency of the current failure. Raw latency and error graphs do not know the monthly objective. Error budgets do. A 5 percent error rate has very different meaning for a 99 percent SLO and a 99.99 percent SLO, and burn rate captures that difference directly.',
        'The multi-window policy works because it uses one window for persistence and one for freshness. The long window reduces false positives from brief spikes. The short window reduces false positives after recovery and improves time to resolution. It is a small state machine over rolling counters: if both windows burn too fast, page; if only the long window is bad, treat it as residual history; if only the short window is bad, watch or route to a lower-urgency signal.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The first cost is SLI design. The metric must reflect user-visible success, and that is harder than choosing CPU or a generic 5xx rate. The team must decide which events count, which users or routes are in scope, how to treat retries, how to handle client cancellations, how to include latency, and whether low-volume slices should page. Bad SLI design produces clean math over the wrong promise.',
        'The second cost is operational tuning. Window pairs and burn thresholds control fatigue, speed, and severity. Aggressive thresholds catch incidents early but can page on transient problems. Conservative thresholds reduce noise but may wait too long. The policy also needs volume guards, missing-data behavior, maintenance handling, and labels that point responders to the affected user population. Burn-rate alerting reduces noise only when the data pipeline is trustworthy.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern is useful for API availability, checkout success, search freshness, streaming playback, data pipeline deadlines, model-serving latency, and any product promise that can be expressed as good events over total events. A payments team may alert on successful authorizations. A collaboration product may alert on document sync operations that complete within a target. An inference platform may alert on requests that meet time-to-first-token and inter-token latency objectives.',
        'A good page carries the evidence directly: SLI name, objective, burn rate, long window, short window, budget consumed, affected route or tenant, current volume, recent deploys, and representative traces or logs. Incident automation and AIOps systems become more useful when this packet exists. They can correlate incidents by user impact rather than trying to infer which of hundreds of graph spikes deserves attention.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Burn-rate alerts fail when the SLI is not user-visible. If the SLI measures an internal proxy that users do not care about, the team will optimize the wrong thing with great discipline. They also fail without volume awareness. A 100 percent error rate over two requests is not the same operational event as a 5 percent error rate over millions of checkouts. Low traffic may need longer windows, synthetic probes, or ticket-level alerts instead of pages.',
        'They also do not explain root cause by themselves. A burn-rate page tells the team when user harm is urgent. It does not say whether the cause is a bad deploy, a dependency, a database lock, a cache stampede, a network partition, or overload. CPU, queue depth, traces, exemplars, logs, deploy metadata, and dependency health still matter after the page fires. The point is to separate paging evidence from diagnostic evidence, not to discard the latter.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study sliding windows and streaming counters first, because burn-rate alerting is a data structure over time. Then study service-level indicators, error budgets, tail latency, percentile pitfalls, and Prometheus-style time series evaluation. The math is simple, but the operational behavior depends on counter reset handling, label cardinality, scrape gaps, and window alignment.',
        'After that, study OpenTelemetry metrics and exemplars, distributed tracing, incident response, alert routing, and post-incident review. The mature version of this topic is not a formula on a dashboard. It is an incident contract: the page proves current user harm, the payload names the affected promise, and the supporting telemetry lets the responder move from budget burn to cause without guessing.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why SLO Error Budget Burn Rate Alert moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

