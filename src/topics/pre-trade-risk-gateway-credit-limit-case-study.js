// Pre-trade risk gateways reject dangerous orders before they reach the
// sequencer, using limits, throttles, fat-finger checks, and kill switches.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'pre-trade-risk-gateway-credit-limit-case-study',
  title: 'Pre-Trade Risk Gateway Credit Limit Case Study',
  category: 'Systems',
  summary: 'A trading gateway case study: FIX/OUCH ingress, session state, credit and position limits, fat-finger price bands, throttles, cancel-on-disconnect, kill switches, and reject ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['risk pipeline', 'kill switch'], defaultValue: 'risk pipeline' },
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

function riskGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 3.2, note: 'FIX/OUCH' },
      { id: 'session', label: 'session', x: 2.0, y: 1.5, note: notes.session || 'auth' },
      { id: 'throttle', label: 'throttle', x: 2.0, y: 4.9, note: notes.throttle || 'rate' },
      { id: 'limits', label: 'limits', x: 3.8, y: 2.1, note: notes.limits || 'credit' },
      { id: 'price', label: 'price band', x: 3.8, y: 4.4, note: notes.price || 'fat finger' },
      { id: 'gate', label: 'gate', x: 5.6, y: 3.2, note: notes.gate || 'accept/reject' },
      { id: 'seq', label: 'sequencer', x: 7.3, y: 2.0, note: 'match' },
      { id: 'reject', label: 'reject log', x: 7.3, y: 4.8, note: 'audit' },
      { id: 'kill', label: 'kill', x: 8.8, y: 3.2, note: notes.kill || 'off' },
    ],
    edges: [
      { id: 'e-client-session', from: 'client', to: 'session', weight: 'login' },
      { id: 'e-client-throttle', from: 'client', to: 'throttle', weight: 'rate' },
      { id: 'e-session-limits', from: 'session', to: 'limits', weight: 'account' },
      { id: 'e-throttle-price', from: 'throttle', to: 'price', weight: 'order' },
      { id: 'e-limits-gate', from: 'limits', to: 'gate', weight: 'pass/fail' },
      { id: 'e-price-gate', from: 'price', to: 'gate', weight: 'pass/fail' },
      { id: 'e-gate-seq', from: 'gate', to: 'seq', weight: 'accept' },
      { id: 'e-gate-reject', from: 'gate', to: 'reject', weight: 'reject' },
      { id: 'e-kill-gate', from: 'kill', to: 'gate', weight: 'block' },
    ],
  }, { title });
}

function* riskPipeline() {
  yield {
    state: riskGraph('Risk gates run before sequencing'),
    highlight: { active: ['client', 'session', 'throttle', 'limits', 'price'], found: ['gate'], compare: ['seq'] },
    explanation: 'A pre-trade risk gateway checks orders before they reach the matching sequencer. Accepted orders proceed; rejected orders get an auditable response without touching the book.',
    invariant: 'Rejecting before sequencing is different from canceling a live order after it reaches the book.',
  };

  yield {
    state: labelMatrix(
      'Risk check table',
      [
        { id: 'session', label: 'session' },
        { id: 'credit', label: 'credit' },
        { id: 'price', label: 'price' },
        { id: 'rate', label: 'rate' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'action', label: 'action' },
      ],
      [
        ['logged in', 'continue'],
        ['within limit', 'reserve'],
        ['near NBBO', 'pass'],
        ['under cap', 'pass'],
      ],
    ),
    highlight: { active: ['credit:state', 'credit:action'], compare: ['price:state'], found: ['rate:action'] },
    explanation: 'Many checks are stateful. Credit may reserve exposure, throttles consume tokens, and session state decides whether cancel-on-disconnect or kill-switch rules apply.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'orders/s', min: 0, max: 10000 }, y: { label: 'reject %', min: 0, max: 100 } },
      series: [
        { id: 'normal', label: 'normal', points: [{ x: 100, y: 1 }, { x: 1000, y: 2 }, { x: 3000, y: 4 }, { x: 6000, y: 8 }] },
        { id: 'burst', label: 'burst', points: [{ x: 100, y: 1 }, { x: 1000, y: 5 }, { x: 3000, y: 22 }, { x: 6000, y: 70 }] },
      ],
      markers: [
        { id: 'cap', label: 'cap', x: 3000, y: 22 },
        { id: 'trip', label: 'trip', x: 6000, y: 70 },
      ],
    }, { title: 'Throttle policy turns bursts into rejects' }),
    highlight: { active: ['burst'], compare: ['normal'], found: ['cap', 'trip'] },
    explanation: 'A throttle protects the exchange and the participant. The important data structure is a per-session, per-symbol, or per-account counter with precise reset semantics.',
  };

  yield {
    state: labelMatrix(
      'Gateway outputs',
      [
        { id: 'accept', label: 'accept' },
        { id: 'reject', label: 'reject' },
        { id: 'reserve', label: 'reserve' },
        { id: 'release', label: 'release' },
      ],
      [
        { id: 'record', label: 'record' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['seq id pending', 'book risk'],
        ['reason code', 'client risk'],
        ['exposure hold', 'leak'],
        ['fill/cancel', 'stale hold'],
      ],
    ),
    highlight: { active: ['accept:record', 'reject:record'], compare: ['reserve:risk'], found: ['release:record'] },
    explanation: 'Risk is a ledger, not a boolean. Exposure must be reserved, released on cancel/fill/reject, and reconciled against exchange execution reports.',
  };
}

function* killSwitch() {
  yield {
    state: riskGraph('A kill switch blocks new order flow and cancels live risk', { kill: 'on', gate: 'block', limits: 'frozen' }),
    highlight: { active: ['kill', 'gate', 'reject'], compare: ['seq'], found: ['e-kill-gate'] },
    explanation: 'A kill switch is a control-plane state that blocks new orders and may trigger cancel messages for live orders. It must be fast, scoped, auditable, and hard to bypass.',
    invariant: 'A kill switch that only updates a dashboard but not the gateway path is not a kill switch.',
  };

  yield {
    state: labelMatrix(
      'Kill switch scopes',
      [
        { id: 'firm', label: 'firm' },
        { id: 'acct', label: 'acct' },
        { id: 'sym', label: 'symbol' },
        { id: 'sess', label: 'session' },
      ],
      [
        { id: 'scope', label: 'scope' },
        { id: 'action', label: 'action' },
      ],
      [
        ['all flow', 'block'],
        ['one desk', 'cancel'],
        ['one name', 'halt'],
        ['one conn', 'drop'],
      ],
    ),
    highlight: { active: ['acct:scope', 'acct:action'], compare: ['firm:action'], found: ['sess:action'] },
    explanation: 'Kill state is usually scoped. A market-wide incident, one bad account, one symbol, and one broken session need different blast radii.',
  };

  yield {
    state: riskGraph('Cancel-on-disconnect clears exposure after session loss', { session: 'lost', throttle: 'stop', kill: 'COD', gate: 'reject' }),
    highlight: { active: ['session', 'kill', 'gate'], compare: ['seq'], found: ['reject'] },
    explanation: 'Cancel-on-disconnect is a session-level safety rule: when the connection dies, live orders associated with that session can be canceled according to venue and participant configuration.',
  };

  yield {
    state: labelMatrix(
      'Risk audit proof',
      [
        { id: 'who', label: 'who' },
        { id: 'when', label: 'when' },
        { id: 'why', label: 'why' },
        { id: 'what', label: 'what' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['operator/app', 'identity'],
        ['seq/time', 'ordering'],
        ['limit breach', 'reason'],
        ['orders affected', 'scope'],
      ],
    ),
    highlight: { active: ['who:proof', 'when:proof'], compare: ['why:field'], found: ['what:proof'] },
    explanation: 'Risk controls need replayable evidence. A reject or kill action should explain who triggered it, when, why, and exactly which sessions, accounts, symbols, or orders were affected.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'risk pipeline') yield* riskPipeline();
  else if (view === 'kill switch') yield* killSwitch();
  else throw new InputError('Pick a pre-trade risk view.');
}

export const article = {
  references: [
    { title: 'FIXimate NewOrderSingle', url: 'https://fiximate.fixtrading.org/en/FIX.Latest/msg14.html' },
    { title: 'FIXimate OrderCancelReplaceRequest', url: 'https://fiximate.fixtrading.org/en/FIX.Latest/msg17.html' },
    { title: 'Nasdaq OUCH 5.0 Order Entry Specification', url: 'https://www.nasdaqtrader.com/content/technicalsupport/specifications/TradingProducts/OUCH5.0.pdf' },
  ],
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `A pre-trade risk gateway is the part of an electronic trading stack that decides whether an incoming order is allowed to reach the matching sequencer. It sits in front of the book. It receives order-entry messages such as FIX NewOrderSingle or OUCH Enter Order, checks the session and risk state, and either forwards the order or rejects it with an auditable reason.`,
        `The key boundary is before sequencing. Once an order reaches a matching engine, it may rest on the book, match immediately, affect priority, or generate executions that cannot be undone by pretending the order never existed. A pre-trade gate stops bad intent while it is still just an inbound command. That is different from post-trade surveillance, cancel logic, or reconciliation after the market has already changed.`,
        {type:'callout', text:`A pre-trade gateway turns market risk into admission control by making every order pass bounded checks before it can alter sequenced market state.`},
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious approach is to let the matching engine accept orders quickly and let downstream risk systems clean up problems. A surveillance service can watch fills, a credit system can compute exposure after the fact, and an operator can cancel bad orders from a dashboard. This is attractive because it keeps the hottest path small.`,
        `The wall is time. A fat-finger order can execute before a downstream service reacts. A runaway algorithm can send thousands of orders before an operator sees the chart. A credit breach can become real exposure as soon as the order is live. The other obvious approach, a dashboard-only kill switch, has the same problem. If the switch does not participate in every order-ingress path, it is reporting state rather than enforcing state.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to turn risk into a bounded admission-control problem. The gateway should be able to answer one question for every inbound command: may this command enter the sequenced market state right now? The answer must include static validity, session authorization, credit or capital limits, position constraints, price bands, quantity limits, throttles, order-type rules, and any active kill-switch scope.`,
        `Risk is also a ledger, not a boolean. When an order is accepted, exposure may need to be reserved. When it fills, cancels, replaces, expires, or rejects, exposure must be released or transformed. A system that only checks a limit at order entry but never reconciles later events will leak risk state. The gateway therefore needs both a fast decision path and a durable audit path.`,
      ],
    },
    {
      heading: 'Mechanism and data structures',
      paragraphs: [
        `The hot path starts with message decoding. FIX is tag-oriented and extensible; OUCH is a compact binary order-entry protocol. Either way, the gateway normalizes the inbound command into internal fields: account, session, symbol, side, quantity, price, order type, time in force, client order id, and protocol sequence data. Malformed messages, disabled sessions, stale sequence numbers, and unauthorized accounts fail before risk limits are touched.`,
        `Stateful checks then read and update small keyed structures. A session state machine tracks login, sequence, heartbeat, cancel-on-disconnect settings, and whether order entry is disabled. An account limit table stores credit, notional, gross exposure, per-symbol caps, and product-specific constraints. An exposure ledger records open orders, partial fills, cancels, replaces, and pending acknowledgements. Token buckets or sliding windows enforce rates per session, account, port, or symbol. Price-band tables compare orders against reference prices such as NBBO, auction collars, or venue-specific reasonability limits.`,
        `A kill switch is control-plane state that must be visible in the data-plane path. Its scope may be firm, account, trader, session, symbol, side, venue, product, or order group. A scoped switch may reject new orders, cancel live orders, disable a port, or require manual release. The reject ledger records what was blocked, which rule blocked it, the configuration version used, and enough identifiers to reconcile with clients and regulators.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness invariant is simple: no order reaches the sequencer unless all required checks passed using a known configuration version and any required exposure reservation was made. The gateway does not merely observe risk; it makes risk state part of admission. That is why it can prevent a credit breach instead of documenting one after it happens.`,
        `Atomicity matters. If the gateway accepts an order but fails to reserve exposure, the next order may see too much remaining capacity. If it reserves exposure but loses the accepted-order event, the account may be blocked by a stale hold. If a replace request increases liability, the gateway must account for previous executions and the new intended size rather than treating the replacement as an unrelated new order. Nasdaq OUCH's replace and cancel semantics show why order lifecycle events have to be modeled as state transitions, not isolated messages.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The cost target is harsh because the gateway sits on the low-latency path. Checks must be bounded, cache-friendly, and predictable. A database lookup in the middle of every order is usually too slow. Production designs pre-load configuration, shard risk ledgers by account or session, keep hot counters in memory, and write audit records asynchronously without letting audit loss create an invisible accept.`,
        `The tradeoff is between local speed and global accuracy. Per-gateway counters are fast but can let aggregate exposure drift if the same account trades through several ports. A central risk service is easier to reason about but can become a bottleneck. Many systems use partitioned ownership, hard sub-limits, replicated read-only config, and reconciliation streams. The design should make the worst failure conservative: reject or kill flow rather than let unbounded orders through.`,
        `Latency budgets also shape error handling. A gateway cannot pause every order while it asks a human whether a limit should be raised. Soft blocks, overrides, and intraday limit changes need their own authorization path and audit record. The hot path should see only the resulting signed or versioned configuration, not an ambiguous operator conversation.`,
      ],
    },
    {
      heading: 'Where it is useful and where it fails',
      paragraphs: [
        `Pre-trade risk gateways are useful for exchanges, broker-dealers, clearing firms, market makers, sponsored-access providers, crypto venues, and internal trading platforms. They protect against fat-finger prices, over-sized orders, credit breaches, quote storms, stale sessions, duplicate client order ids, runaway algos, and controls required by market-access rules. SEC Rule 15c3-5 is one regulatory example for broker-dealers with market access: controls must systematically limit financial exposure and prevent orders that violate applicable pre-order requirements.`,
        `The pattern fails when the checks are incomplete, inconsistent, or bypassable. A gateway that checks FIX but not OUCH leaves a hole. A kill switch that reaches one region but not another creates false confidence. A price band based on stale reference data can reject good flow or accept bad flow. A credit ledger that ignores pending cancels may block clients unnecessarily, while one that releases exposure before cancel confirmation may understate live risk.`,
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        `Watch reject rate by reason code, throttle consumption, account exposure versus limit, stale holds, cancel and replace reconciliation lag, session disconnects, kill-switch propagation time, config-version skew, gateway-to-sequencer accept latency, audit write lag, and unmatched execution reports. Each metric maps to a failure mode. A rising stale-hold count points to lifecycle bugs. Rejects clustered at one symbol may point to a bad collar. High config skew means different gateways may answer the same order differently.`,
        `Incidents should be replayable. Given an order id, operators should recover the inbound message, normalized command, risk inputs, configuration version, decision, reservation change, sequencer handoff or reject response, and later lifecycle events. Without that chain, a gateway cannot prove why it blocked one order and accepted the next.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: FIXimate NewOrderSingle at https://fiximate.fixtrading.org/en/FIX.Latest/msg14.html, FIXimate OrderCancelReplaceRequest at https://fiximate.fixtrading.org/en/FIX.Latest/msg17.html, Nasdaq OUCH 5.0 at https://www.nasdaqtrader.com/content/technicalsupport/specifications/TradingProducts/OUCH5.0.pdf, and SEC Rule 15c3-5 FAQ material at https://www.sec.gov/rules-regulations/staff-guidance/trading-markets-frequently-asked-questions/divisionsmarketregfaq-0. Study Rate Limiter for throttles, Token Bucket for admission counters, Limit Order Book Price-Time Priority for sequencer behavior, Matching Engine Sequencer Event Log for ordered market state, Idempotency for client order ids, and Double-Entry Payment Ledger Execution Trace for reservation and release discipline next.`,
      ],
    },
  ],
};
