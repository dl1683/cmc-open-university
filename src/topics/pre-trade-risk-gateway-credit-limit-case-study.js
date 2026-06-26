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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the risk-pipeline view from left to right. Active nodes are checks currently evaluating the inbound order, found nodes are accepted or audited state, and compare nodes show the market sequencer that must not see unsafe commands. A sequencer is the component that gives accepted orders their market order and makes book changes irreversible.',
        'The kill-switch view shows control state entering the same data path. The safe inference is boundary-based: a rejected order never reaches sequenced market state, while a cancel after acceptance is only a later market event. Pre-trade risk is valuable because it acts before that boundary.',
        {type:'callout', text:`A pre-trade gateway turns market risk into admission control by making every order pass bounded checks before it can alter sequenced market state.`},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Electronic markets can turn one bad command into real executions in microseconds. A fat-finger price, runaway algorithm, stale session, or credit breach can hit the book before a human sees a dashboard. A pre-trade gateway blocks unsafe commands before they alter market state.',
        'The gateway also creates evidence. Every accept, reject, reservation, release, cancel-on-disconnect action, and kill-switch decision needs a reason code and configuration version. Without that ledger, operators cannot explain why one order passed and the next failed.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious low-latency design is to let the matching engine accept orders and let risk systems inspect events afterward. That keeps the hot path small and gives surveillance systems complete market data. It works for detection but not prevention.',
        'Another obvious design is an operator dashboard with a kill button. That can help during incidents, but only if the button updates every ingress path that can send orders. A dashboard that does not participate in admission control is a display, not a gate.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is time. If an algorithm sends 5,000 bad orders in one second and each can match immediately, post-trade controls are already late. Exposure is created when the order becomes live, not when a later report is read.',
        'Distributed entry points make the wall harder. FIX, OUCH, web controls, regional gateways, and backup sessions can disagree unless they share the same risk state or conservative sub-limits. One unchecked path is enough to bypass the whole design.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Turn risk into bounded admission control. For each inbound command, the gateway answers whether this session, account, symbol, side, size, price, and order type may enter sequenced market state right now. The answer must be fast, deterministic, and tied to a versioned configuration.',
        'Risk is a ledger, not a boolean. Accepted orders may reserve credit or position capacity. Fills, cancels, replaces, expirations, and rejects must release or transform that reservation. Correctness depends on lifecycle accounting, not only on the first check.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The gateway decodes the protocol message and normalizes fields such as account, session, symbol, side, quantity, price, order type, time in force, and client order id. It checks authentication, sequence state, permission, throttle counters, price bands, quantity caps, notional limits, and active kill-switch scope. Any failed check returns a reject with an auditable reason.',
        'Stateful checks update small keyed structures. Token buckets enforce message rate. Limit tables store account and symbol caps. Exposure ledgers reserve notional or shares for accepted orders and reconcile later execution reports. Kill-switch state must be read in the same path as ordinary order checks.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is that no order reaches the sequencer unless all required checks passed and required exposure was reserved under one known configuration version. If the accept decision and reservation are atomic, the next order sees the reduced capacity. If either half is missing, the ledger can overstate or understate risk.',
        'Lifecycle transitions preserve the invariant after acceptance. A partial fill changes open exposure, a cancel releases only after confirmation, and a replace must account for the old live quantity plus the requested change. The gateway stays correct by modeling these as state transitions rather than independent messages.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost target is shaped by latency. A database lookup per order can cost more than the gateway budget, so production systems preload config, shard ledgers by ownership key, and keep hot counters in memory. Audit writes may be asynchronous, but the decision record cannot be allowed to vanish silently.',
        'Global accuracy costs coordination. A central risk service is easier to reason about but can bottleneck. Per-gateway counters are fast but need hard sub-limits or reconciliation to prevent aggregate drift. The safest failure mode is conservative rejection, not unbounded acceptance.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Pre-trade risk gateways are used by exchanges, broker-dealers, sponsored-access platforms, market makers, crypto venues, and internal trading desks. They enforce fat-finger bands, credit limits, position limits, message-rate caps, duplicate-id checks, and market-access controls.',
        'Cancel-on-disconnect and scoped kill switches are the operational side of the same pattern. A lost session can trigger cancel rules, while a firm, account, symbol, or session kill switch can block new flow and cancel live orders within its scope.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The pattern fails when checks are inconsistent or bypassable. If FIX flow is checked but OUCH flow is not, the gate has a hole. If one region receives kill-switch updates late, the firm may believe risk is frozen while orders still enter elsewhere.',
        'Reference data can also betray the system. A stale best bid and offer can reject good orders or accept absurd prices. A credit ledger that releases capacity before cancel confirmation understates live exposure, while one that never releases stale holds blocks legitimate flow.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An account has a USD 10,000,000 notional limit and USD 7,800,000 already reserved. A new buy order arrives for 20,000 shares at USD 125, so the requested notional is USD 2,500,000. The post-order exposure would be USD 10,300,000, so the gateway rejects it before the sequencer sees it.',
        'A second order asks for 10,000 shares at USD 125. That adds USD 1,250,000 and brings reserved exposure to USD 9,050,000, so the gateway reserves capacity and forwards the order. If 4,000 shares fill, the ledger converts USD 500,000 from open-order exposure into position exposure and leaves the remaining live order accounted for.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: FIXimate NewOrderSingle at https://fiximate.fixtrading.org/en/FIX.Latest/msg14.html, FIXimate OrderCancelReplaceRequest at https://fiximate.fixtrading.org/en/FIX.Latest/msg17.html, Nasdaq OUCH 5.0 at https://www.nasdaqtrader.com/content/technicalsupport/specifications/TradingProducts/OUCH5.0.pdf, and SEC market access rule material at https://www.sec.gov/rules-regulations/staff-guidance/trading-markets-frequently-asked-questions/divisionsmarketregfaq-0.',
        'Study token bucket rate limiting, limit order book sequencing, idempotency keys, event-sourced ledgers, double-entry accounting, and market-data reference feeds before designing a gateway that holds real exposure.',
      ],
    },
  ],
};
