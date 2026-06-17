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
      heading: 'Why this exists',
      paragraphs: [
        'A direct market-data feed does not deliver a ready-made current order book. It delivers a protocol: sequenced binary messages that say an order was added, executed, cancelled, deleted, replaced, or affected by a trading-state change. Each serious consumer builds its own local book by replaying those messages in order.',
        'That local book matters because downstream systems make decisions from it. Trading strategies read best bid and offer, depth, imbalance, queue position, and recent trades. Risk systems reconcile fills against visible liquidity. Simulators and backtests need a realistic event stream. Surveillance systems need to know what the market looked like before and after an event.',
        'The reconstruction problem exists because snapshots alone are too coarse for many uses. A snapshot can say there are 10,000 shares at a price. It cannot always say which order reference was reduced, which order lost priority after replacement, whether a cancel removed displayed liquidity before an execution, or whether a sequence gap made the local view stale.',
      ],
    },
    {
      heading: 'The reasonable first approach',
      paragraphs: [
        'The first mental model is to treat market data as a stream of prices: last trade, best bid, best ask, maybe aggregate depth at each price level. For many dashboards, that is enough. If the user only wants a delayed chart, a compact top-of-book feed or periodic snapshot can be the right tool.',
        'The second shortcut is to maintain only aggregate price levels. On an add, increase quantity at that price. On an execution or cancel, decrease quantity. This is smaller than tracking every order and can support simple depth analytics. It is also attractive because it resembles a map from price to quantity, which is easy to store and query.',
        'Those shortcuts fail for full-depth order-by-order feeds. ITCH-style protocols identify orders by reference numbers. Later messages often refer back to that reference rather than repeating all original fields. If the local consumer threw away the order map, it may not know which side, price, symbol, or remaining size a later execution or cancel should affect.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is identity. An order is not just quantity at a price. It has a reference id, side, symbol, price, displayed size, remaining size, and time priority. A replace may remove one reference and create another, often changing queue priority. An execution may reduce a specific order. A delete may remove the rest. Aggregate depth hides the identity needed to update state correctly.',
        'The second wall is order. Message sequence is part of the data. Applying add, execute, cancel, and replace messages in a different order can create a different book. One missing cancel can leave phantom liquidity. One missing add can make a later execution impossible to apply. A valid-looking message after a gap is not proof that the book is clean.',
        'The third wall is recovery. Real feeds can drop packets, restart channels, switch sessions, or require retransmission. A book builder must know when it is authoritative, when it is tainted, and which sequence boundary makes it safe to resume. Parsing bytes is only the first step; maintaining trust in local state is the harder system problem.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Book reconstruction is event sourcing under a strict sequence contract. The feed is the log. The local order map and price-level ladder are derived state. If the consumer starts from a known image and applies every message exactly once in sequence, the derived book should match the exchange-defined state for that channel and symbol partition.',
        'The core data structure is two synchronized views. The order-reference map answers identity questions: given order 9001, what symbol, side, price, and remaining quantity does it represent? The price-level structure answers market-view questions: what is the best bid, best ask, and visible depth at each price? Updates must keep both views consistent.',
        'The invariant is strict: contiguous sequence plus valid state transition equals authoritative local book. Break either condition and the consumer should mark the book suspect. A post-gap stream of valid messages may still be wrong because the missing message could have changed the state those later messages depend on.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'A feed handler reads bytes from a channel, decodes message type and fields, checks sequence continuity, routes by symbol or partition, and applies state transitions. An add inserts a new order reference and increases the corresponding price-level quantity. An execution reduces remaining shares on the referenced order and reduces displayed depth. A cancel reduces quantity without necessarily implying a trade. A delete removes the live reference. A replace removes or reduces the old reference and creates a new reference with its own priority rules.',
        'The builder also handles non-order messages. Trading-state changes may pause a symbol. System events may mark session boundaries. Cross trades, auctions, halts, and resets can require special handling. Some feeds publish checksums, heartbeats, or snapshots. Production systems keep ledgers for channel, session, symbol, sequence, applied message count, state digest, and recovery mode.',
        'Derived views are published after state updates, not before. A strategy may need top-of-book only. A simulator may need full order-by-order depth. A reconciliation process may need every execution and cancel. All of those views should come from the same sequenced state machine so they can be audited against the feed.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The replay graph proves that the feed is not the book. The feed is parsed into order-reference state and price-level state, and only then does a local book emerge. Consumers should be downstream of reconstruction, not loosely attached to raw bytes with ad hoc interpretations.',
        'The message-to-state matrix proves why order references are necessary. Add creates a reference. Execute and cancel look up that reference. Replace involves old and new references and can move displayed quantity across price and priority. A book builder that stores only aggregate depth has already thrown away information later messages may require.',
        'The recovery view proves that a gap is a state transition, not just a logging warning. Once a sequence jump appears, the book is tainted until retransmission, replay from a snapshot, or a channel reset restores a verified boundary. The gap-size plot shows why small gaps and large gaps often use different recovery paths.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The reconstruction algorithm works because each message is an incremental state transition over a known previous state. If the previous state is correct, the message is decoded correctly, and the transition rule matches the feed specification, then the next state is correct. By induction over a contiguous message sequence, the local book remains correct from the initial image to the current sequence number.',
        'That proof depends on exactly-once ordered application. Duplicates must be detected or made idempotent by sequence handling. Out-of-order messages must be buffered or rejected according to the feed contract. Gaps must stop authority. Session and channel boundaries must be respected because an order reference may be meaningful only within the correct stream context.',
        'It also depends on lossless enough state. If later messages refer to order references, the builder must keep those references until they are fully removed. If downstream consumers need queue priority, replacement rules and timestamps matter. If only aggregate depth is retained, the system may still serve a simple dashboard, but it no longer reconstructs the full order-by-order book.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Order-level reconstruction costs more memory than aggregate depth. A busy symbol can have many live orders, and each order needs identity, side, price, remaining quantity, and sometimes participant or attribution fields depending on the feed. Price levels are smaller, but they cannot answer every later update by themselves.',
        'Latency pressure shapes implementation. Handlers often avoid allocation on the hot path, use compact structs or typed arrays, partition by channel or symbol, and publish snapshots through lock-free queues or ring buffers. Recovery code may be less frequent, but it must be correct under stress because gaps often occur when networks or downstream systems are already overloaded.',
        'The tradeoff is richness versus operational complexity. A top-of-book feed is easier to consume and may be enough for a retail quote display. Full-depth reconstruction gives better analytics and simulation fidelity, but it requires protocol expertise, replay tooling, state checksums, careful session handling, and strong observability.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Book reconstruction wins in market-data handlers, execution algorithms, smart order routers, exchange simulators, market-impact research, surveillance, post-trade reconciliation, and backtesting systems. It lets each consumer maintain the view it needs while preserving the ability to audit that view back to sequenced feed events.',
        'A concrete example shows the value. Add order 9001 on the bid, execute part of it, then replace the remaining quantity with order 9020 at a new price. The order map knows 9001 is no longer live, 9020 has the new identity, the old price level lost quantity, the new level gained quantity, and the sequence ledger records the exact boundary where the move happened.',
        'It also wins for reproducibility. If a strategy behaved strangely at 10:01:03, a replayable feed plus snapshots can reconstruct the local book around that moment. Without the event log and sequence discipline, debugging becomes guesswork against a stale or aggregated view.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The system fails if it processes after a sequence gap as if the book were clean. It fails if it ignores trading-state messages, session resets, symbol partitions, duplicate messages, or feed-specific replacement rules. It fails if it silently drops unknown message types. In market data, quiet partial correctness is dangerous because downstream systems can trade on it.',
        'It also fails when the builder optimizes away fields before understanding future dependencies. A field that seems irrelevant for top-of-book display may be needed for audit, queue simulation, or a later message. Retention policies should be explicit: what is required for correctness, what is required for downstream products, and what can be discarded after a known terminal state?',
        'Study next: Limit Order Book Price-Time Priority Case Study for matching rules, Matching Engine Sequencer Event Log Case Study for exchange-side ordering, Ring Buffer for low-latency handoff, Write-Ahead Log for replay discipline, Message Queue for delivery contracts, and Stream Processing Watermarks for reasoning about event time and completeness. Primary sources include the Nasdaq TotalView-ITCH specification and CME MDP 3.0 market-data documentation listed in the references.',
      ],
    },
  ],
};
