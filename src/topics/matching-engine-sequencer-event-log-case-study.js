// Matching engines are deterministic state machines: a sequencer assigns one
// total order to accepted commands before book mutation and publication.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'matching-engine-sequencer-event-log-case-study',
  title: 'Matching Engine Sequencer Event Log Case Study',
  category: 'Systems',
  summary: 'A trading-systems case study: order gateway ingress, deterministic sequencers, event logs, matching state machines, execution reports, market-data publication, replay, and recovery.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['sequencer log', 'replay recovery'], defaultValue: 'sequencer log' },
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

function engineGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'gateway', label: 'gateway', x: 0.8, y: 3.2, note: 'OUCH/FIX' },
      { id: 'risk', label: 'risk', x: 2.2, y: 1.6, note: notes.risk || 'gate' },
      { id: 'seq', label: 'sequencer', x: 3.7, y: 3.2, note: notes.seq || 'seq' },
      { id: 'log', label: 'event log', x: 3.7, y: 5.4, note: 'append' },
      { id: 'match', label: 'match', x: 5.3, y: 3.2, note: notes.match || 'state' },
      { id: 'book', label: 'book', x: 6.9, y: 1.8, note: 'mutate' },
      { id: 'exec', label: 'exec rpt', x: 6.9, y: 4.8, note: 'client' },
      { id: 'md', label: 'market data', x: 8.6, y: 3.2, note: 'publish' },
    ],
    edges: [
      { id: 'e-gateway-risk', from: 'gateway', to: 'risk', weight: 'check' },
      { id: 'e-risk-seq', from: 'risk', to: 'seq', weight: 'accept' },
      { id: 'e-seq-log', from: 'seq', to: 'log', weight: 'append' },
      { id: 'e-seq-match', from: 'seq', to: 'match', weight: 'ordered' },
      { id: 'e-match-book', from: 'match', to: 'book', weight: 'apply' },
      { id: 'e-match-exec', from: 'match', to: 'exec', weight: 'fill/ack' },
      { id: 'e-book-md', from: 'book', to: 'md', weight: 'depth' },
      { id: 'e-exec-md', from: 'exec', to: 'md', weight: 'trade' },
    ],
  }, { title });
}

function* sequencerLog() {
  yield {
    state: engineGraph('Accepted commands enter one deterministic order'),
    highlight: { active: ['gateway', 'risk', 'seq'], found: ['log', 'match'], compare: ['md'] },
    explanation: 'A matching engine cannot let two gateways race the same book. Accepted commands pass through a sequencer that assigns one total order before the book is mutated.',
    invariant: 'Book state is a pure replay of sequenced accepted commands plus deterministic matching rules.',
  };

  yield {
    state: labelMatrix(
      'Sequenced event log',
      [
        { id: 's101', label: '101' },
        { id: 's102', label: '102' },
        { id: 's103', label: '103' },
        { id: 's104', label: '104' },
      ],
      [
        { id: 'cmd', label: 'cmd' },
        { id: 'order', label: 'order' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['add', 'o17', 'post bid'],
        ['add', 'o31', 'post ask'],
        ['buy', 'o44', 'fill o31'],
        ['cancel', 'o17', 'remove'],
      ],
    ),
    highlight: { active: ['s101:cmd', 's102:cmd', 's103:cmd'], found: ['s103:effect'], compare: ['s104:effect'] },
    explanation: 'The event log is the audit spine. It explains why a book state exists and lets downstream systems replay, reconcile, and recover.',
  };

  yield {
    state: engineGraph('One command can emit multiple ordered outputs', { match: 'fills', seq: '103' }),
    highlight: { active: ['match', 'book', 'exec', 'md'], compare: ['log'], found: ['e-match-exec', 'e-book-md'] },
    explanation: 'One incoming order can produce an acknowledgment, several fills, a trade print, and book-depth updates. Output streams still need sequence and correlation back to the triggering command.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'stage', min: 0, max: 5 }, y: { label: 'us', min: 0, max: 80 } },
      series: [
        { id: 'lat', label: 'lat', points: [{ x: 0, y: 4 }, { x: 1, y: 12 }, { x: 2, y: 21 }, { x: 3, y: 34 }, { x: 4, y: 46 }] },
        { id: 'budget', label: 'budget', points: [{ x: 0, y: 15 }, { x: 1, y: 25 }, { x: 2, y: 35 }, { x: 3, y: 50 }, { x: 4, y: 70 }] },
      ],
      markers: [
        { id: 'seqp', label: 'seq', x: 2, y: 21 },
        { id: 'pub', label: 'pub', x: 4, y: 46 },
      ],
    }, { title: 'Latency budget follows the event path' }),
    highlight: { active: ['lat'], compare: ['budget'], found: ['seqp', 'pub'] },
    explanation: 'Low latency does not remove the need for ordering. The design goal is predictable, deterministic sequencing with bounded work in each stage.',
  };
}

function* replayRecovery() {
  yield {
    state: engineGraph('Recovery starts from snapshot plus log suffix', { seq: 'resume', match: 'replay' }),
    highlight: { active: ['log', 'match', 'book'], compare: ['gateway'], found: ['md'] },
    explanation: 'A warm standby or restart can load a book snapshot, replay every sequenced command after the snapshot, and reach the same state if the engine is deterministic.',
    invariant: 'Snapshots are only valid when they record the exact last sequence number included.',
  };

  yield {
    state: labelMatrix(
      'Recovery ledger',
      [
        { id: 'snap', label: 'snapshot' },
        { id: 'suffix', label: 'suffix' },
        { id: 'checksum', label: 'hash' },
        { id: 'publish', label: 'publish' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['book @100', 'stale'],
        ['101..now', 'gap'],
        ['state digest', 'drift'],
        ['resume seq', 'duplicate'],
      ],
    ),
    highlight: { active: ['snap:stores', 'suffix:stores'], found: ['checksum:risk', 'publish:risk'] },
    explanation: 'Replay needs more than bytes. It needs sequence boundaries, gap detection, state checksums, and output de-duplication rules.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'events replayed', min: 0, max: 1000000 }, y: { label: 'seconds', min: 0, max: 20 } },
      series: [
        { id: 'withSnap', label: 'snap', points: [{ x: 10000, y: 0.2 }, { x: 100000, y: 1.1 }, { x: 500000, y: 5.2 }, { x: 1000000, y: 10.5 }] },
        { id: 'fromZero', label: 'zero', points: [{ x: 10000, y: 1.0 }, { x: 100000, y: 5.8 }, { x: 500000, y: 15.5 }, { x: 1000000, y: 20 }] },
      ],
      markers: [
        { id: 'cut', label: 'snap', x: 100000, y: 1.1 },
        { id: 'slow', label: 'slow', x: 500000, y: 15.5 },
      ],
    }, { title: 'Snapshots bound replay time' }),
    highlight: { active: ['withSnap'], compare: ['fromZero'], found: ['cut', 'slow'] },
    explanation: 'The log is the source of truth, but replaying from genesis is too slow. Periodic snapshots turn recovery into snapshot load plus suffix replay.',
  };

  yield {
    state: labelMatrix(
      'Determinism checklist',
      [
        { id: 'time', label: 'time' },
        { id: 'random', label: 'random' },
        { id: 'io', label: 'IO' },
        { id: 'rules', label: 'rules' },
      ],
      [
        { id: 'control', label: 'control' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['sequence clock', 'wall clock'],
        ['seeded/none', 'nondet'],
        ['after commit', 'side effect'],
        ['versioned', 'drift'],
      ],
    ),
    highlight: { active: ['time:control', 'rules:control'], compare: ['io:failure'], found: ['random:control'] },
    explanation: 'Replay only works when matching is deterministic. Wall-clock reads, random tie breaks, unsequenced IO, and unversioned rules break recovery.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'sequencer log') yield* sequencerLog();
  else if (view === 'replay recovery') yield* replayRecovery();
  else throw new InputError('Pick a matching-engine view.');
}

export const article = {
  references: [
    { title: 'Nasdaq OUCH 5.0 Order Entry Specification', url: 'https://www.nasdaqtrader.com/content/technicalsupport/specifications/TradingProducts/OUCH5.0.pdf' },
    { title: 'FIXimate ExecutionReport', url: 'https://fiximate.fixtrading.org/legacy/en/FIX.5.0SP2/body_5756.html' },
    { title: 'Nasdaq TotalView-ITCH 5.0 Specification', url: 'https://www.nasdaqtrader.com/content/technicalsupport/specifications/dataproducts/NQTVITCHSpecification.pdf' },
  ],
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A matching engine cannot allow two gateways to race the same book. If two crossing commands arrive at nearly the same time, the venue needs one official order of application, one official book mutation sequence, and one replayable audit trail.',
        'The sequencer exists to assign that total order. The event log exists so the book can be explained, reconstructed, reconciled, and recovered. This is not only a trading concern; it is the general systems problem of turning concurrent inputs into deterministic state.',
        {type:'callout', text:'The sequencer turns concurrent order flow into one replayable history, so book state becomes a deterministic derivation rather than a race.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/8/86/NYSE_%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%81%E0%B8%A3%E0%B8%B1%E0%B8%90%E0%B8%A1%E0%B8%99%E0%B8%95%E0%B8%A3%E0%B8%B5_%E0%B9%80%E0%B8%82%E0%B9%89%E0%B8%B2%E0%B8%A3%E0%B9%88%E0%B8%A7%E0%B8%A1%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%8A%E0%B8%B8%E0%B8%A1%E0%B8%AA%E0%B8%A1%E0%B8%B1%E0%B8%8A%E0%B8%8A%E0%B8%B2%E0%B8%AA%E0%B8%AB%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%8A%E0%B8%B2%E0%B8%95%E0%B8%B4_-_Flickr_-_Abhisit_Vejjajiva_%2815%29.jpg', alt:'View of the New York Stock Exchange trading floor with desks, screens, and NYSE banners.', caption:'NYSE trading floor, 2009. Photo by Peerapat Wimolrungkarat for Government of Thailand, CC BY 2.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The tempting wrong answer',
      paragraphs: [
        'The tempting implementation is to let each gateway thread mutate shared book state as soon as it validates an order. That creates ambiguous priority, non-repeatable races, and recovery states nobody can prove. The book might look correct most of the time while still being impossible to audit after a hard case.',
        'Another shortcut is to log only outputs such as fills and market-data updates. Outputs are not enough. Recovery needs the accepted commands and their sequence boundaries so the matcher can replay the same state transitions and prove why those outputs happened.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A matching engine is a deterministic state machine over sequenced accepted commands. Order entry messages pass through gateways and risk checks. Accepted commands receive sequence numbers. The matcher applies each command to the book in order, emits execution reports, and publishes market-data updates with correlation back to the triggering command.',
        'Book state should be a pure replay of the command log plus deterministic matching rules. Snapshots make recovery fast, but a snapshot is valid only if it records the exact last sequence number included. The log is the authority; the in-memory book is a derived view.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'Inspect the system as a chain: gateway input, validation result, risk decision, sequencer number, durable command record, matcher transition, execution report, market-data update, and replay checksum. Each output should trace back to one or more sequenced commands.',
        'The key question is whether two independent replicas can reconstruct the same book from the same prefix of the log. If they cannot, the matcher is reading unsequenced time, randomness, external IO, mutable configuration, or a rule version that was not captured with the command stream.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Gateways accept protocol messages such as OUCH order entry, validate basic shape, and pass accepted commands toward risk and sequencing. The sequencer assigns a monotonically increasing number. The event log persists the accepted command with enough metadata to replay it later.',
        'The matcher consumes commands in sequence order. A limit order may add quantity to a price level or cross against resting orders according to price-time priority. A cancel may remove remaining quantity. Each transition emits execution reports to participants and market-data updates for downstream consumers.',
        'A production engine usually partitions by instrument or shard so separate books can advance independently. Within one book, however, the command order must be total. Parallel gateways can feed the sequencer, and downstream publication can fan out, but the state transition for a given book needs one official sequence.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The sequencer record should contain sequence number, receive timestamp, gateway id, participant id, instrument, command type, risk decision, rule version, idempotency or client order id, and payload reference. The matcher then appends derived outputs: fills, remaining quantity, book deltas, execution report ids, and market-data sequence ids.',
        'The book itself is usually organized around price levels and FIFO order queues. That structure decides matching priority, while the sequencer decides mutation order. Confusing those two forms of order is a common design mistake: price-time priority ranks resting orders inside the book; sequence numbers rank incoming commands entering the state machine.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Two clients submit crossing orders. Gateway A accepts a buy order. Gateway B accepts a sell order. The sequencer assigns 102 to the buy and 103 to the sell. The matcher applies exactly that order, updates depth, emits fills if the sell crosses the resting buy, and publishes market data with references back to the sequence range.',
        'After a failure, a standby loads the latest snapshot, sees that it includes commands through sequence 100, replays 101 through 103, verifies the book checksum, and resumes at 104. The standby does not ask what happened in wall-clock order. It asks what the sequencer committed.',
        'If participant reports and public market data disagree, the event log is the reconciliation spine. Investigators can walk from command 103 to its fills, then to the corresponding market-data deltas, then to the checksum after application. That path is why outputs must retain correlation to the sequenced input rather than becoming disconnected notifications.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The system works because all state mutations pass through one ordered command stream. Once the command order is fixed and the matching rules are deterministic, recovery becomes replay. Auditing becomes comparison between command log, execution reports, market-data feed, and snapshots.',
        'This is the same reason write-ahead logs and event-sourced systems work. The durable ordered input is easier to trust than a large mutable object. The book can be rebuilt. The sequence cannot be guessed after the fact.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This pattern appears in exchanges, internal matching simulators, clearing reconciliation, market-data publication, and any system where concurrent commands need deterministic financial state. It is also useful in non-financial systems where fairness and replay matter: allocation engines, inventory reservations, and auction platforms.',
        'It wins when the state is small enough to replay or snapshot, the rules can be versioned, and outputs must be explainable. A sequencer is a deliberate bottleneck, but it buys a clean history.',
        'The same lesson applies to curriculum design. Teach it after queues, logs, and maps, then show how a real venue combines them: a queue of accepted commands, a log for durability, maps from price to resting orders, and append-only outputs for reports and data feeds.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Replay only works if the matcher is deterministic. Wall-clock reads, random tie breaks, unsequenced IO, and unversioned rule changes break recovery. Use sequence numbers for ties and version the rulebook. If a risk rule changes, the event stream should know which version approved the command.',
        'Do not publish events that cannot be traced back to replayable book state. Do not take snapshots without sequence boundaries. Do not separate order-entry acknowledgments, execution reports, and market data so far that they cannot be reconciled as views of one mutation stream.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track sequencer lag, log fsync latency, matcher apply latency, gateway-to-sequence latency, replay time from snapshot, checksum mismatches, dropped publication events, gap detection, and participant acknowledgment reconciliation. These are the health metrics of determinism.',
        'The most useful incident packet contains the sequence range, snapshot id, rule version, input commands, execution reports, market-data events, and checksum comparison. Without that packet, an outage becomes storytelling instead of reconstruction.',
        'Capacity planning has to respect the sequencer as a deliberate serialization point. Scale can happen around it through partitioning by instrument, gateway fan-in, batching, and standby replay, but the ordered stream for a book must stay unambiguous. Horizontal scale that reintroduces races defeats the purpose.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'A matching engine is not just a fast data structure. It is an ordered state machine whose outputs must be explainable after the fact. The sequencer decides the official input order, the log preserves it, the matcher derives book state, and replay proves the result.',
        'The deep lesson is that determinism is an engineered property. If time, randomness, rule changes, or side effects enter outside the sequenced record, recovery becomes guesswork. For teaching, this page belongs beside write-ahead logs, queues, and ordered maps because it shows why those basic structures become legal and financial infrastructure.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Nasdaq OUCH 5.0 at https://www.nasdaqtrader.com/content/technicalsupport/specifications/TradingProducts/OUCH5.0.pdf, FIXimate ExecutionReport at https://fiximate.fixtrading.org/legacy/en/FIX.5.0SP2/body_5756.html, and Nasdaq TotalView-ITCH at https://www.nasdaqtrader.com/content/technicalsupport/specifications/dataproducts/NQTVITCHSpecification.pdf.',
        'Study Limit Order Book Price-Time Priority Case Study, ITCH Market Data Book Reconstruction Case Study, Write-Ahead Log, Raft Log Replication, Idempotency, Snapshot Isolation, and Event Sourcing next.',
      ],
    },
  ],
};
