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
    { heading: 'What it is', paragraphs: ['A pre-trade risk gateway checks orders before they reach the matching sequencer. It validates session state, order syntax, credit and position limits, price bands, quantity limits, throttles, kill switches, and cancel-on-disconnect behavior.', 'The data structures are per-session state machines, account limit tables, exposure ledgers, token buckets, symbol rule tables, reject ledgers, and kill-switch scopes.'] },
    { heading: 'How it works', paragraphs: ['Incoming FIX or OUCH messages enter a gateway. Stateless checks reject malformed messages. Stateful checks reserve credit, consume throttle tokens, compare price/quantity against bands, and decide whether the order can proceed to sequencing.', 'Accepted orders later release or transform risk when executions, cancels, replacements, or rejects arrive. This makes pre-trade risk a lifecycle ledger, not a one-time gate.'] },
    { heading: 'Cost and complexity', paragraphs: ['The gateway sits on the low-latency path, so every check must be bounded and predictable. At the same time, mistakes can create real financial exposure or block legitimate trading. The implementation therefore needs compact hot-path state plus durable audit trails.', 'Kill switches are especially sensitive. They must be hard to bypass, scoped correctly, and visible in every ingress path.'] },
    { heading: 'Complete case study', paragraphs: ['A client submits a large buy order far outside the current price band. The gateway authenticates the session, checks throttle capacity, computes notional exposure, detects the price-band violation, rejects the order with a reason code, and does not send the command to the sequencer.', 'Later, the account breaches a credit limit. An operator activates an account-scoped kill switch. New orders are blocked, live orders are canceled according to configuration, and the audit ledger records actor, time, reason, and affected orders.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not reserve exposure without releasing it on every terminal path. Do not apply kill-switch state to one gateway but not another. Do not rely on a dashboard-only control. Do not hide reject reasons if clients and operators need reconciliation.', 'Risk state must be strongly keyed: account, session, symbol, side, product, order id, and configuration version can all matter.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: FIXimate NewOrderSingle at https://fiximate.fixtrading.org/en/FIX.Latest/msg14.html, FIXimate OrderCancelReplaceRequest at https://fiximate.fixtrading.org/en/FIX.Latest/msg17.html, and Nasdaq OUCH 5.0 at https://www.nasdaqtrader.com/content/technicalsupport/specifications/TradingProducts/OUCH5.0.pdf. Study Rate Limiter, Limit Order Book Price-Time Priority Case Study, Matching Engine Sequencer Event Log Case Study, Idempotency, and Double-Entry Payment Ledger Execution Trace next.'] },
  ],
};
