// A limit order book is a two-sided price ladder: price levels are ordered,
// and each level owns a FIFO queue of resting orders.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'limit-order-book-price-time-priority-case-study',
  title: 'Limit Order Book Price-Time Priority Case Study',
  category: 'Systems',
  summary: 'A market microstructure case study: bid/ask price trees, FIFO queues per price level, order ids, partial fills, cancels, replaces, spread, depth, and price-time priority.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['price levels', 'matching step'], defaultValue: 'price levels' },
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

function bookGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'buyTree', label: 'bids', x: 1.1, y: 3.3, note: notes.buyTree || 'max price' },
      { id: 'bid100', label: '100.00', x: 2.8, y: 1.9, note: notes.bid100 || 'q:2' },
      { id: 'bid99', label: '99.95', x: 2.8, y: 4.8, note: 'q:1' },
      { id: 'sellTree', label: 'asks', x: 7.9, y: 3.3, note: notes.sellTree || 'min price' },
      { id: 'ask10005', label: '100.05', x: 6.2, y: 1.9, note: notes.ask10005 || 'q:2' },
      { id: 'ask10010', label: '100.10', x: 6.2, y: 4.8, note: 'q:3' },
      { id: 'bestBid', label: 'best bid', x: 4.2, y: 2.1, note: 'top' },
      { id: 'bestAsk', label: 'best ask', x: 4.9, y: 2.1, note: 'top' },
      { id: 'spread', label: 'spread', x: 4.6, y: 5.4, note: notes.spread || '5c' },
    ],
    edges: [
      { id: 'e-buy-100', from: 'buyTree', to: 'bid100', weight: 'top' },
      { id: 'e-buy-99', from: 'buyTree', to: 'bid99', weight: '' },
      { id: 'e-sell-10005', from: 'sellTree', to: 'ask10005', weight: 'top' },
      { id: 'e-sell-10010', from: 'sellTree', to: 'ask10010', weight: '' },
      { id: 'e-bid-best', from: 'bid100', to: 'bestBid', weight: '' },
      { id: 'e-ask-best', from: 'ask10005', to: 'bestAsk', weight: '' },
      { id: 'e-best-spread', from: 'bestBid', to: 'spread', weight: '' },
      { id: 'e-ask-spread', from: 'bestAsk', to: 'spread', weight: '' },
    ],
  }, { title });
}

function* priceLevels() {
  yield {
    state: bookGraph('Two ordered maps point to FIFO price queues'),
    highlight: { active: ['buyTree', 'sellTree'], compare: ['bid100', 'ask10005'], found: ['spread'] },
    explanation: 'A limit order book usually keeps bids in descending price order and asks in ascending price order. Each price level owns a queue of resting orders in time priority.',
    invariant: 'Price priority chooses the best price; time priority chooses the earliest live order inside that price level.',
  };

  yield {
    state: labelMatrix(
      'Price level queues',
      [
        { id: 'b100', label: 'B100.00' },
        { id: 'b9995', label: 'B99.95' },
        { id: 'a10005', label: 'A100.05' },
        { id: 'a10010', label: 'A100.10' },
      ],
      [
        { id: 'head', label: 'head' },
        { id: 'tail', label: 'tail' },
        { id: 'qty', label: 'qty' },
      ],
      [
        ['o17', 'o22', '600'],
        ['o12', 'o12', '200'],
        ['o31', 'o44', '500'],
        ['o40', 'o53', '900'],
      ],
    ),
    highlight: { active: ['b100:head', 'b100:tail'], compare: ['a10005:head'], found: ['b100:qty', 'a10005:qty'] },
    explanation: 'The ordered price map gives best-price lookup. The per-price FIFO queue gives fair execution order and lets cancels remove specific order ids.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'price', min: 99.9, max: 100.2 }, y: { label: 'shares', min: 0, max: 1200 } },
      series: [
        { id: 'bidDepth', label: 'bid', points: [{ x: 99.95, y: 200 }, { x: 100.00, y: 800 }] },
        { id: 'askDepth', label: 'ask', points: [{ x: 100.05, y: 500 }, { x: 100.10, y: 900 }, { x: 100.15, y: 1100 }] },
      ],
      markers: [
        { id: 'bb', label: 'BB', x: 100.00, y: 800 },
        { id: 'ba', label: 'BA', x: 100.05, y: 500 },
      ],
    }, { title: 'Depth is cumulative liquidity around the spread' }),
    highlight: { active: ['bidDepth'], compare: ['askDepth'], found: ['bb', 'ba'] },
    explanation: 'A book is not only the top quote. Depth by price level tells matching, routing, slippage, and risk systems how much displayed liquidity exists near the touch.',
  };

  yield {
    state: labelMatrix(
      'Book operations',
      [
        { id: 'add', label: 'add' },
        { id: 'cancel', label: 'cancel' },
        { id: 'replace', label: 'replace' },
        { id: 'execute', label: 'execute' },
      ],
      [
        { id: 'index', label: 'index' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['id map + level', 'append'],
        ['order id', 'remove qty'],
        ['old -> new id', 'priority?'],
        ['head order', 'fill'],
      ],
    ),
    highlight: { active: ['add:index', 'cancel:index'], compare: ['replace:effect'], found: ['execute:effect'] },
    explanation: 'The order-id map is as important as the price tree. Cancels, partial fills, and replaces must find one live order without scanning the whole book.',
  };
}

function* matchingStep() {
  yield {
    state: bookGraph('An incoming buy crosses the best ask', { ask10005: 'match', spread: 'cross' }),
    highlight: { active: ['ask10005', 'bestAsk'], compare: ['bid100'], found: ['e-ask-best'] },
    explanation: 'A marketable buy order matches against the lowest ask first. If the incoming quantity exceeds the first resting order, matching continues through the price level queue and then to the next ask level.',
    invariant: 'The matching engine must make one deterministic sequence of book mutations and execution events.',
  };

  yield {
    state: labelMatrix(
      'Fill walk',
      [
        { id: 'inc', label: 'incoming' },
        { id: 'o31', label: 'o31' },
        { id: 'o44', label: 'o44' },
        { id: 'rest', label: 'rest' },
      ],
      [
        { id: 'qty', label: 'qty' },
        { id: 'state', label: 'state' },
      ],
      [
        ['700 buy', 'crosses'],
        ['300 sell', 'filled'],
        ['200 sell', 'filled'],
        ['200 buy', 'posts?'],
      ],
    ),
    highlight: { active: ['inc:qty', 'o31:qty', 'o44:qty'], compare: ['rest:state'], found: ['o31:state', 'o44:state'] },
    explanation: 'Price-time priority consumes resting liquidity in queue order. Any unfilled remainder follows the order type: post, cancel, reject, or route depending on venue and instructions.',
  };

  yield {
    state: bookGraph('After fills, best ask advances to the next level', { ask10005: 'empty', ask10010: 'new top', spread: '10c' }),
    highlight: { active: ['ask10010', 'bestAsk', 'spread'], compare: ['ask10005'], found: ['e-sell-10010'] },
    explanation: 'When a price queue empties, the price level is removed from the ordered map and the best ask pointer advances. This update must be atomic with the fill events.',
  };

  yield {
    state: labelMatrix(
      'Priority traps',
      [
        { id: 'reduce', label: 'reduce' },
        { id: 'price', label: 'price' },
        { id: 'hidden', label: 'hidden' },
        { id: 'tie', label: 'tie' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['keep place?', 'venue rule'],
        ['new price', 'lose time'],
        ['display rules', 'complex'],
        ['seq number', 'determinism'],
      ],
    ),
    highlight: { active: ['price:rule', 'tie:rule'], compare: ['hidden:risk'], found: ['reduce:rule'] },
    explanation: 'The hard part is not the tree lookup; it is the rulebook. Replace semantics, hidden orders, self-trade prevention, auctions, and ties must be encoded explicitly.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'price levels') yield* priceLevels();
  else if (view === 'matching step') yield* matchingStep();
  else throw new InputError('Pick an order-book view.');
}

export const article = {
  references: [
    { title: 'Nasdaq OUCH 5.0 Order Entry Specification', url: 'https://www.nasdaqtrader.com/content/technicalsupport/specifications/TradingProducts/OUCH5.0.pdf' },
    { title: 'Nasdaq TotalView-ITCH 5.0 Specification', url: 'https://www.nasdaqtrader.com/content/technicalsupport/specifications/dataproducts/NQTVITCHSpecification.pdf' },
    { title: 'CME Market by Order FAQ', url: 'https://www.cmegroup.com/articles/faqs/market-by-order-mbo.html' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['A limit order book stores resting buy and sell orders by price and time. Bids are ranked from highest to lowest price; asks are ranked from lowest to highest price. Inside one price level, orders are normally processed in FIFO time priority.', 'The concrete data structures are ordered maps by price, FIFO queues per price level, an order-id index, quantity totals, best bid/ask pointers, and an event log of accepted, canceled, replaced, and executed orders.'] },
    { heading: 'How it works', paragraphs: ['A new passive limit order appends to its price-level queue. A marketable order crosses the spread and matches against the opposite side, consuming the best price first and then the oldest orders inside that price level.', 'Cancels and partial executions update both the order record and the aggregate price-level quantity. If a level becomes empty, it is removed from the ordered map and the best-price pointer moves.'] },
    { heading: 'Cost and complexity', paragraphs: ['Best-price lookup should be fast, but the system also needs deterministic ordering, order-id lookup, sequence numbers, protocol acknowledgments, and replay. Latency-sensitive engines often avoid allocation and keep hot structures compact.', 'The complexity comes from venue rules: replace priority, hidden liquidity, auctions, order types, self-trade prevention, throttles, halts, and risk checks can all change the simple FIFO story.'] },
    { heading: 'Complete case study', paragraphs: ['An incoming buy for 700 shares crosses an ask level containing two resting orders: 300 and 200 shares. The engine fills both in queue order, emits execution reports, removes the empty price level, advances best ask to the next level, and handles the 200-share remainder according to the order instructions.', 'Every mutation is sequenced so market data, drop copy, risk, clearing, and replay systems reconstruct the same result.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not scan all orders to cancel one order. Keep an order-id index. Do not update displayed depth without updating the live queue. Do not let a replace accidentally preserve time priority if venue rules say it should lose priority.', 'A book snapshot without the event sequence is not enough for audit or recovery. Matching is a deterministic state machine over ordered events.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Nasdaq OUCH 5.0 at https://www.nasdaqtrader.com/content/technicalsupport/specifications/TradingProducts/OUCH5.0.pdf, Nasdaq TotalView-ITCH at https://www.nasdaqtrader.com/content/technicalsupport/specifications/dataproducts/NQTVITCHSpecification.pdf, and CME Market by Order at https://www.cmegroup.com/articles/faqs/market-by-order-mbo.html. Study Queue, Red-Black Tree, Skip List, Matching Engine Sequencer Event Log Case Study, ITCH Market Data Book Reconstruction Case Study, and Write-Ahead Log next.'] },
  ],
};
