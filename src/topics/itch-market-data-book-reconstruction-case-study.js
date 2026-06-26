// Direct market data feeds let consumers reconstruct a book from sequenced
// add, execute, cancel, replace, and trading-state messages.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'itch-market-data-book-reconstruction-case-study',
  title: 'ITCH Market Data Book Reconstruction Case Study',
  category: 'Systems',
  summary: 'A market-data case study: ITCH-style sequenced messages, order reference maps, add/execute/cancel/replace events, gap detection, snapshots, channel reset, and local book reconstruction.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['feed replay', 'gap recovery'], defaultValue: 'feed replay' },
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

function feedGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'feed', label: 'ITCH feed', x: 0.8, y: 3.0, note: 'seq' },
      { id: 'parser', label: 'parser', x: 2.2, y: 3.0, note: notes.parser || 'binary' },
      { id: 'orders', label: 'order map', x: 3.9, y: 1.6, note: 'ref id' },
      { id: 'levels', label: 'levels', x: 3.9, y: 4.4, note: 'price qty' },
      { id: 'book', label: 'local book', x: 5.8, y: 3.0, note: notes.book || 'rebuilt' },
      { id: 'snapshot', label: 'snapshot', x: 7.4, y: 1.8, note: 'state' },
      { id: 'strategy', label: 'consumer', x: 7.4, y: 4.6, note: 'read' },
      { id: 'gap', label: 'gap', x: 5.8, y: 5.9, note: notes.gap || 'none' },
    ],
    edges: [
      { id: 'e-feed-parser', from: 'feed', to: 'parser', weight: 'bytes' },
      { id: 'e-parser-orders', from: 'parser', to: 'orders', weight: 'add/exec' },
      { id: 'e-parser-levels', from: 'parser', to: 'levels', weight: 'qty' },
      { id: 'e-orders-book', from: 'orders', to: 'book', weight: 'orders' },
      { id: 'e-levels-book', from: 'levels', to: 'book', weight: 'depth' },
      { id: 'e-book-snapshot', from: 'book', to: 'snapshot', weight: 'checkpoint' },
      { id: 'e-book-strategy', from: 'book', to: 'strategy', weight: 'view' },
      { id: 'e-parser-gap', from: 'parser', to: 'gap', weight: 'seq check' },
    ],
  }, { title });
}

function* feedReplay() {
  yield {
    state: feedGraph('A local book is replayed from sequenced messages'),
    highlight: { active: ['feed', 'parser'], found: ['orders', 'levels', 'book'], compare: ['strategy'] },
    explanation: 'A direct feed consumer reconstructs its own book by applying sequenced messages. Add, execute, cancel, delete, and replace messages mutate order and price-level state.',
    invariant: 'Message order is part of the data. Applying the same messages in a different order can create a different book.',
  };

  yield {
    state: labelMatrix(
      'Message-to-state map',
      [
        { id: 'add', label: 'Add' },
        { id: 'exec', label: 'Exec' },
        { id: 'cancel', label: 'Cancel' },
        { id: 'replace', label: 'Replace' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'book', label: 'book' },
        { id: 'audit', label: 'audit' },
      ],
      [
        ['order ref', 'insert', 'seq'],
        ['order ref', 'reduce', 'trade'],
        ['order ref', 'reduce', 'reason'],
        ['old/new ref', 'move', 'priority'],
      ],
    ),
    highlight: { active: ['add:key', 'exec:book'], compare: ['replace:key'], found: ['replace:audit'] },
    explanation: 'ITCH-style feeds use stable order reference numbers. A local book keeps an order-reference map so later executions and cancels can find the original price, side, and remaining shares.',
  };

  yield {
    state: feedGraph('Book reconstruction maintains two views', { book: 'best+depth' }),
    highlight: { active: ['orders', 'levels', 'book'], compare: ['snapshot'], found: ['e-orders-book', 'e-levels-book'] },
    explanation: 'Order-level state and aggregate depth are separate but synchronized. Strategies may read top-of-book, depth ladders, trades, or full order-by-order state.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'messages', min: 0, max: 1000000 }, y: { label: 'state MB', min: 0, max: 600 } },
      series: [
        { id: 'orders', label: 'ord', points: [{ x: 10000, y: 20 }, { x: 100000, y: 90 }, { x: 500000, y: 320 }, { x: 1000000, y: 520 }] },
        { id: 'levels', label: 'lvl', points: [{ x: 10000, y: 8 }, { x: 100000, y: 35 }, { x: 500000, y: 80 }, { x: 1000000, y: 120 }] },
      ],
      markers: [
        { id: 'hot', label: 'open', x: 500000, y: 320 },
        { id: 'compact', label: 'agg', x: 1000000, y: 120 },
      ],
    }, { title: 'Order-level books carry more state than aggregate depth' }),
    highlight: { active: ['orders'], compare: ['levels'], found: ['hot', 'compact'] },
    explanation: 'Full-depth order-by-order feeds are richer than aggregate top-of-book streams, but they require more memory, gap handling, and replay discipline.',
  };
}

function* gapRecovery() {
  yield {
    state: feedGraph('A missing sequence makes the book suspect', { parser: 'seq gap', gap: 'missing', book: 'tainted' }),
    highlight: { active: ['parser', 'gap'], compare: ['book'], found: ['snapshot'] },
    explanation: 'A book builder must detect sequence gaps. If one message is missing, the local state may be wrong even if the next message parses cleanly.',
    invariant: 'Consumers should never treat a post-gap local book as authoritative until recovery completes.',
  };

  yield {
    state: labelMatrix(
      'Gap recovery modes',
      [
        { id: 'detect', label: 'detect' },
        { id: 'request', label: 'request' },
        { id: 'replay', label: 'replay' },
        { id: 'reset', label: 'reset' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['seq jump', 'stale'],
        ['retransmit', 'timeout'],
        ['gap range', 'dup'],
        ['fresh image', 'halt'],
      ],
    ),
    highlight: { active: ['detect:state', 'request:state'], found: ['replay:state', 'reset:state'] },
    explanation: 'Recovery may use retransmission, replay from a snapshot, or a channel reset. The local state machine must handle duplicates and resume at the correct sequence.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'gap size', min: 0, max: 10000 }, y: { label: 'ms', min: 0, max: 250 } },
      series: [
        { id: 'replay', label: 'rp', points: [{ x: 10, y: 3 }, { x: 100, y: 12 }, { x: 1000, y: 60 }, { x: 10000, y: 220 }] },
        { id: 'snapshot', label: 'image', points: [{ x: 10, y: 180 }, { x: 100, y: 180 }, { x: 1000, y: 180 }, { x: 10000, y: 180 }] },
      ],
      markers: [
        { id: 'small', label: 'small', x: 100, y: 12 },
        { id: 'large', label: 'image', x: 10000, y: 180 },
      ],
    }, { title: 'Small gaps replay; large gaps may need an image' }),
    highlight: { active: ['replay'], compare: ['snapshot'], found: ['small', 'large'] },
    explanation: 'Retransmission is cheap for small gaps. For large gaps or resets, an image plus sequence boundary can be faster and safer.',
  };

  yield {
    state: labelMatrix(
      'Book-builder audit',
      [
        { id: 'seq', label: 'seq' },
        { id: 'checksum', label: 'hash' },
        { id: 'symbol', label: 'symbol' },
        { id: 'halt', label: 'halt' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'action', label: 'action' },
      ],
      [
        ['contiguous', 'apply'],
        ['state digest', 'compare'],
        ['partition', 'route'],
        ['trading state', 'pause'],
      ],
    ),
    highlight: { active: ['seq:check', 'checksum:check'], compare: ['halt:action'], found: ['symbol:action'] },
    explanation: 'Production book builders need channel, symbol, sequence, checksum, and trading-state ledgers. Parsing bytes is only the first step.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'feed replay') yield* feedReplay();
  else if (view === 'gap recovery') yield* gapRecovery();
  else throw new InputError('Pick an ITCH reconstruction view.');
}

export const article = {
  references: [
    { title: 'Nasdaq TotalView-ITCH 5.0 Specification', url: 'https://www.nasdaqtrader.com/content/technicalsupport/specifications/dataproducts/NQTVITCHSpecification.pdf' },
    { title: 'CME MDP 3.0 Market Data', url: 'https://cmegroupclientsite.atlassian.net/wiki/display/EPICSANDBOX/CME%2BMDP%2B3.0%2BMarket%2BData' },
    { title: 'CME AutoCert MDP 3.0 User Manual', url: 'https://www.cmegroup.com/tools-information/webhelp/autocert-mdp3/Content/Autocert-MDP3-User-Manual.pdf' },
  ],
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows order-book reconstruction from a sequenced market-data feed. An order book is the live set of buy and sell orders at each price. A feed message is an event such as add, execute, cancel, delete, replace, or trading-state change. Reconstruction means replaying those events into local state.',
        'Active nodes show the current feed message, order-reference map, price level, or recovery step. Found nodes show state that is now authoritative for the current sequence. Compare nodes show a gap, duplicate, or alternative recovery path. The key rule is that a local book is trusted only after contiguous messages have been applied from a known boundary.',
        {type:'callout', text:'Order-book reconstruction is a replay problem: sequence numbers, order-reference maps, and gap recovery turn raw feed messages into a defensible local market view.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/2/29/NASDAQ_Market_Site_201506.jpg', alt:'NASDAQ MarketSite studio with market data screens and cameras.', caption:'NASDAQ MarketSite studio, Luca Marfe, CC BY 2.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A direct market-data feed does not hand consumers a finished order book. It sends binary messages with sequence numbers and fields. Trading systems, simulators, surveillance tools, and risk systems must build the local book themselves.',
        'Snapshots alone are too coarse for many uses. A snapshot can say there are 10,000 shares at a price, but it may not explain which order was executed, which order lost priority after replacement, or whether a missing cancel made the view stale.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to track price levels only. On an add, increase quantity at that price. On an execution or cancel, decrease quantity. For a simple quote display, this can be enough.',
        'The shortcut is tempting because a price-level map is small and easy to query. Best bid, best ask, and depth charts come directly from it. The problem is that order-by-order feeds often refer to an order id later, and a price-level map has thrown that identity away.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is identity. An order reference maps to symbol, side, price, displayed size, remaining size, and priority. Later execute, cancel, delete, and replace messages may mention only that reference. Without the reference map, the builder may not know which side or price to update.',
        'The second wall is sequence. Applying messages out of order can create a different book. One missing add can make a later execution impossible. One missing cancel can leave phantom liquidity. After a gap, later valid-looking messages do not prove the current state is clean.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Book reconstruction is event sourcing with a strict sequence contract. The feed is the log. The order-reference map and price ladder are derived state. If the consumer starts from a trusted image and applies every message exactly once in order, the local book matches the feed-defined state.',
        'The invariant is contiguous sequence plus valid state transition. If either fails, the book is suspect. Recovery is not a side feature; it is part of correctness.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A handler decodes each message, checks the next expected sequence number, routes the event to the right symbol or partition, and applies the transition. Add creates a reference and increases a price level. Execute reduces a referenced order and visible depth. Cancel reduces quantity. Delete removes the reference. Replace removes or reduces one reference and creates another according to feed rules.',
        'The builder publishes derived views only after state updates. A strategy may read top of book, a simulator may read order-by-order depth, and an audit tool may read the event ledger. All of them should come from the same sequenced state machine.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof is induction over sequence number. If the local book is correct at sequence 100 and message 101 is decoded correctly and applied according to the specification, then the resulting book is correct at sequence 101. Repeating that step preserves correctness over a contiguous stream.',
        'The proof stops at a gap. If sequence 102 is missing and 103 arrives, the previous-state assumption is false. The consumer must buffer, request replay, rebuild from a snapshot, or mark the book non-authoritative until a trusted boundary is restored.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Order-level reconstruction costs memory proportional to live orders plus price levels. If a busy symbol has 250,000 live orders and each compact order record takes 40 bytes, the order map alone is about 10 MB before hash-table overhead. Price levels are smaller, but they cannot answer reference-based updates alone.',
        'Latency cost shapes implementation. Hot paths avoid allocation, partition by channel or symbol, use compact structs or typed arrays, and publish through ring buffers. Recovery is less frequent but more complex because it must restore authority during stress.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Book reconstruction is used in exchange feed handlers, execution algorithms, smart order routers, market making, surveillance, backtesting, simulators, market-impact research, and post-trade reconciliation. The fit is strongest when downstream logic needs exact event history or queue-sensitive depth.',
        'It also supports reproducibility. If a strategy made a bad decision at 10:01:03, a sequenced feed plus snapshots can rebuild the book around that moment. Without replayable state, debugging becomes guesswork against aggregated data.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the system processes after a gap as if state were clean. It fails when replacement rules, trading-state messages, session resets, duplicates, channel boundaries, or unknown message types are ignored. Quiet partial correctness is dangerous because downstream systems can trade on it.',
        'It can also fail by optimizing away fields too early. A field that is irrelevant to top-of-book display may be required for audit, queue simulation, or a later message. Retention policy must distinguish correctness fields from optional product fields.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'At sequence 100, add order 9001: buy 500 shares of XYZ at $10.00. The order map stores 9001 -> buy, XYZ, $10.00, 500. The bid level $10.00 increases by 500.',
        'At sequence 101, execute 200 shares of order 9001. The map now stores remaining size 300, and the $10.00 bid level drops to 300. At sequence 102, replace 9001 with order 9020 at $10.01 for 300 shares. The builder removes 9001, decreases $10.00 by 300 to zero, creates 9020, and increases $10.01 by 300. If sequence 101 were missing, applying 102 could create a book that looks valid but has the wrong traded volume and audit trail.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Nasdaq TotalView-ITCH 5.0 specification at https://www.nasdaqtrader.com/content/technicalsupport/specifications/dataproducts/NQTVITCHSpecification.pdf and CME MDP 3.0 market data documentation at https://cmegroupclientsite.atlassian.net/wiki/display/EPICSANDBOX/CME%2BMDP%2B3.0%2BMarket%2BData.',
        'Study limit order books, price-time priority, event sourcing, write-ahead logs, ring buffers, sequence numbers, gap recovery, market-data normalization, and stream processing watermarks next. The useful exercise is to replay add, execute, cancel, and replace messages into both an order map and a price ladder by hand.',
      ],
    },
  ],
};