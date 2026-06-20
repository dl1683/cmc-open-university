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
    {
      heading: 'Why this exists',
      paragraphs: [
        'A market needs a deterministic way to decide who trades first when many participants want to buy and sell the same instrument. The limit order book is that state machine: it stores resting interest, exposes the best bid and ask, and applies venue rules to incoming orders.',
        'Price-time priority is the common fairness rule. The best price wins first. Among orders at the same price, the oldest live order usually wins first. The data structure exists to make that rule fast, auditable, and replayable.',
        {type: 'callout', text: 'Price-time priority is implemented by ordered price maps plus FIFO queues, with an order-id index making cancels and fills local.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/14/Order_book_depth_chart.gif', alt: 'Animated order book depth chart with bids on the left and asks on the right.', caption: 'Order book depth chart by Kjerish, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'The tempting wrong answer',
      paragraphs: [
        'The obvious implementation is one sorted list of all orders. That fails because cancels, partial fills, and best-price lookup would require too much scanning. Another bad shortcut is to store only aggregate depth by price. That loses the FIFO queue needed to decide which specific order fills next.',
        'The book needs both views at once: ordered price levels for market structure and order-level identity for fairness, cancels, replaces, and audit. Storing only one view either makes matching slow or makes the result impossible to explain.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Use two ordered maps: bids sorted high to low and asks sorted low to high. Each price level owns a FIFO queue of live orders. A separate order-id index points to each order record so cancels and partial fills do not scan the book.',
        'A passive limit order appends to its price queue. A marketable order crosses the spread, consumes the opposite best price, walks the FIFO queue inside that level, and continues to the next level only if quantity remains. Empty price levels are removed and best bid or ask advances.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'Inspect the book as three connected structures. The bid map and ask map answer best-price and depth questions. The per-price queues enforce time priority. The order-id map lets cancels, replaces, and partial fills find one live order without scanning.',
        'The matching step is a deterministic mutation sequence: select the best opposite price, fill the oldest order at that price, update quantity, remove empty orders and levels, advance the best pointer, and handle the incoming remainder according to order instructions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A new buy limit order that does not cross the best ask becomes resting interest on the bid side. It is inserted into the bid price map if the price level is new, then appended to the FIFO queue for that price. The order-id index records where to find it later.',
        'A marketable buy order crosses the best ask. The engine walks the lowest ask price first, then the oldest orders inside that level. Each fill reduces resting quantity and incoming quantity. If a resting order reaches zero, it leaves the queue. If a price level becomes empty, it leaves the ask map.',
        'This is why price-time priority is both a policy and a data-structure requirement. The ordered map gives price priority. The queue gives time priority. The id map gives operational control over cancels and replaces.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The price maps are usually balanced trees, skip lists, arrays over ticks, or specialized structures depending on price range and latency goals. Each price level stores aggregate visible quantity plus a linked queue or intrusive list of orders in arrival order.',
        'The order-id index maps client or venue order id to the live order record. That record points back to its price level and queue position so cancels and partial fills are local operations. Without this reverse pointer, every cancel becomes a search problem.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose the best ask is 100.05 with two resting sell orders: 300 shares from order o31 and 200 shares from order o44. A buy order for 700 shares at 100.10 arrives. It crosses the spread, fills o31 first, then o44, and still has 200 shares remaining.',
        'The remainder depends on order type and venue rules. It may post at the incoming limit price, cancel immediately, route elsewhere, or be rejected. The book must emit fills, update displayed depth, preserve sequence numbers, and leave enough audit data for market-data reconstruction.',
        'Now add a cancel. If o44 is canceled before the buy arrives, the id index finds o44 directly, removes it from the queue, updates price-level quantity, and leaves o31 as the head. If the cancel arrives after the buy has already filled o44, the engine rejects or reports that there is no live quantity. The sequence number decides which story is true.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The structure works because it separates two kinds of order. Price order is global across levels. Time order is local within one price level. Keeping those orders in separate structures avoids scanning and makes the fairness rule explicit.',
        'It also makes replay possible. If the matching engine receives the same ordered command stream and applies the same deterministic rules, it should reconstruct the same book state and the same fills. That is why this topic connects directly to Matching Engine Sequencer Event Log Case Study.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This structure is useful anywhere price-time priority or a similar rule must be enforced under low latency: exchanges, crypto venues, dark-pool simulations, matching-engine tests, market-data replay, and trading education.',
        'A complete execution ledger includes accepted commands, order ids, price levels, queue position, fills, cancels, replaces, and sequence numbers so market data, drop copy, risk, clearing, and replay systems reconstruct the same result.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The simple model is only the beginning. Replace priority, hidden liquidity, auctions, pegged orders, self-trade prevention, throttles, halts, and risk checks can all change the behavior. Encode venue rules explicitly rather than assuming every market is pure FIFO.',
        'Do not scan all orders to cancel one order. Keep an order-id index. Do not update displayed depth without updating the live queue. A book snapshot without the event sequence is not enough for audit or recovery.',
        'The hardest failures are rulebook failures. A replace that should lose time priority but does not, a hidden order that displays incorrectly, or a self-trade prevention rule that fires after the fill instead of before it can create real market harm. The data structure must serve the rulebook, not the other way around.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track add, cancel, replace, and execute latency; queue length by price level; best bid/ask update rate; depth consistency; order-id lookup failures; sequence gaps; replay checksum mismatches; and market-data publication lag.',
        'The best debug artifact is a sequence-bounded packet: incoming command, book state before, fills, book state after, market-data deltas, and checksum. That packet turns an execution dispute into a reconstruction problem instead of a debate.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'A limit order book is a fairness rule made executable. Price priority needs an ordered map. Time priority needs a queue. Cancels and replaces need an id index. Audit needs a sequenced event stream.',
        'For course design, teach it after queues, ordered maps, and logs. It shows students how several simple structures combine into a system where correctness is legal, financial, and operational, not just algorithmic.',
        'The simplest useful mental model is four indexes over one truth: best price, queue position, order id, and sequence number. If any one of those views drifts from the others, the market may still display numbers, but it no longer has a trustworthy book.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Nasdaq OUCH 5.0 at https://www.nasdaqtrader.com/content/technicalsupport/specifications/TradingProducts/OUCH5.0.pdf, Nasdaq TotalView-ITCH at https://www.nasdaqtrader.com/content/technicalsupport/specifications/dataproducts/NQTVITCHSpecification.pdf, and CME Market by Order at https://www.cmegroup.com/articles/faqs/market-by-order-mbo.html.',
        'Study Queue, Red-Black Tree, Skip List, Matching Engine Sequencer Event Log Case Study, ITCH Market Data Book Reconstruction Case Study, Write-Ahead Log, and Event Sourcing next.',
      ],
    },
  ],
};
