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
    { heading: 'What it is', paragraphs: ['Market-data book reconstruction is the process of building a local order book from sequenced exchange feed messages. An ITCH-style feed carries order-level messages such as add, execute, cancel, delete, and replace. CME-style feeds can include market-by-order and market-by-price views.', 'The data structures are feed parsers, sequence trackers, order-reference maps, price-level aggregates, snapshots, retransmission buffers, and per-symbol state machines.'] },
    { heading: 'How it works', paragraphs: ['The consumer parses each binary message, verifies sequence continuity, updates the order-reference map, adjusts price-level depth, and publishes a local view to strategies or analytics. A replace may remove one order reference and add a new one, which can affect priority.', 'If a sequence gap appears, the book is suspect. The system requests missing messages, replays a gap range, reloads a snapshot, or waits for a channel reset depending on feed rules and gap size.'] },
    { heading: 'Cost and complexity', paragraphs: ['The hot path must parse and apply messages quickly, but correctness depends on gap detection and recovery. A single missing cancel or replace can leave phantom liquidity in the local book.', 'Order-level state can be much larger than aggregate depth. Consumers often maintain several derived views: best bid/ask, depth ladder, trades, imbalance signals, and full order maps.'] },
    { heading: 'Complete case study', paragraphs: ['A book builder receives an add for order reference 9001, then an execution reducing it, then a replace that creates reference 9020 at a new price. The local order map updates the reference, the price ladder removes quantity from the old level and adds it to the new one, and the sequence ledger records the boundary.', 'Later, a sequence jump appears. The consumer marks the symbol stale, requests the missing range, replays it, checks the state digest, and only then exposes the book again.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not process messages after a gap as if the book is clean. Do not aggregate depth without retaining enough order-reference state for executions, cancels, and replaces. Do not ignore trading-state messages such as halts or resets.', 'A data feed is a protocol, not just a stream of prices. The sequence and recovery contract is part of the data structure.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Nasdaq TotalView-ITCH at https://www.nasdaqtrader.com/content/technicalsupport/specifications/dataproducts/NQTVITCHSpecification.pdf, CME MDP 3.0 market-data docs at https://cmegroupclientsite.atlassian.net/wiki/display/EPICSANDBOX/CME%2BMDP%2B3.0%2BMarket%2BData, and CME AutoCert MDP 3.0 manual at https://www.cmegroup.com/tools-information/webhelp/autocert-mdp3/Content/Autocert-MDP3-User-Manual.pdf. Study Limit Order Book Price-Time Priority Case Study, Matching Engine Sequencer Event Log Case Study, Ring Buffer, Write-Ahead Log, and Message Queue next.'] },
  ],
};
