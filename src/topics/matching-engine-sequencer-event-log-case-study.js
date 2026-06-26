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
      heading: 'How to read the animation',
      paragraphs: [
        'The sequencer-log view shows order messages entering a matching engine. A sequencer is the component that assigns one official sequence number to accepted commands. Active nodes are processing the current command; found nodes are durable records or derived outputs that can be traced back to that command.',
        {type:'callout', text:'The sequencer turns concurrent order flow into one replayable history, so book state becomes a deterministic derivation rather than a race.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/8/86/NYSE_%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%81%E0%B8%A3%E0%B8%B1%E0%B8%90%E0%B8%A1%E0%B8%99%E0%B8%95%E0%B8%A3%E0%B8%B5_%E0%B9%80%E0%B8%82%E0%B9%89%E0%B8%B2%E0%B8%A3%E0%B9%88%E0%B8%A7%E0%B8%A1%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%8A%E0%B8%B8%E0%B8%A1%E0%B8%AA%E0%B8%A1%E0%B8%B1%E0%B8%8A%E0%B8%8A%E0%B8%B2%E0%B8%AA%E0%B8%AB%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%8A%E0%B8%B2%E0%B8%95%E0%B8%B4_-_Flickr_-_Abhisit_Vejjajiva_%2815%29.jpg', alt:'View of the New York Stock Exchange trading floor with desks, screens, and NYSE banners.', caption:'NYSE trading floor, 2009. Photo by Peerapat Wimolrungkarat for Government of Thailand, CC BY 2.0, via Wikimedia Commons.'},
        'The replay view starts from a snapshot and replays later log entries. A snapshot is a saved copy of book state at a known sequence number. The safe inference is that two replicas with the same snapshot, same log suffix, and same rules must rebuild the same book.'
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A matching engine maintains a limit order book, which is a set of buy and sell orders ranked by price and then by time. If two clients send crossing orders at nearly the same instant, the venue needs one official answer about which command arrived first. Money changes hands based on that answer.',
        'The event log exists because the answer must be replayable. Regulators, participants, market-data consumers, and recovery systems need to reconstruct why a fill happened. A fast in-memory book is not enough if nobody can prove the command order that produced it.'
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious implementation is to let each gateway thread validate an order and mutate the shared book immediately. Locks can protect memory corruption, and the system may pass ordinary load tests. The deeper problem is that lock timing and thread scheduling are not a business rule.',
        'Another obvious shortcut is to log only the outputs, such as fills and market-data updates. Outputs tell what the system announced, not why the matcher was allowed to announce it. Recovery needs the accepted command stream and the exact sequence boundaries.'
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is deterministic priority. A book cannot have two equally official histories for the same instrument. If command A beats command B in one replica and B beats A in another, price-time priority has been broken even if both replicas end with plausible quantities.',
        'Failure makes the wall harder. A standby machine may need to take over after the primary dies. It cannot ask threads what they almost did; it can only load a snapshot and replay durable commands from a known sequence number.'
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat the matcher as a deterministic state machine over a sequenced command log. A state machine is a program where the next state is fully determined by the current state and the next input. The sequencer creates the input order; the matcher applies commands in that order; the log preserves the inputs.',
        'Book state becomes a derived view. Snapshots speed recovery, but the log is the source of truth for recent changes. Every execution report and market-data event should be traceable to the command sequence that caused it.'
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Gateways accept protocol messages, check shape and permissions, and forward valid commands to risk checks. Accepted commands receive monotonically increasing sequence numbers. The event log persists the command, participant id, instrument, order id, rule version, and other replay inputs.',
        'The matcher consumes commands in sequence order. A buy limit order may rest on the bid side or cross sell orders at the best ask. A cancel removes remaining quantity if the referenced order is still live. Each transition emits participant reports and public market-data deltas.',
        'Engines usually shard by instrument so different books can run in parallel. Within one book or shard, command order remains total. Parallelism is allowed around the sequenced state machine, not inside its priority rule.'
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from the replay invariant: same starting snapshot, same ordered command suffix, same deterministic rules, same final book. The sequence number is the tie breaker for accepted input order. The matcher does not use wall-clock time or thread timing to decide priority.',
        'Audit follows from correlation. Command 103 can be linked to its fills, remaining quantity, market-data updates, and checksum after application. If any derived stream disagrees with replay, the log gives a concrete place to investigate.'
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The sequencer is a deliberate serialization point. For one hot instrument, every accepted command must pass through one official order, so adding more gateway threads does not remove the core sequence bottleneck. Capacity is gained by sharding instruments, batching log writes, and keeping the matcher path small.',
        'Durability adds latency. If the system waits for a log fsync before applying each command, p99 latency can grow with storage stalls. If it applies before durable commit, recovery can lose acknowledged commands. The engineering problem is choosing a commit discipline that matches the venue contract.',
        'Memory cost is dominated by live orders and price levels. A book with 200,000 resting orders must keep order id lookup, price-level queues, and sequence metadata hot. Snapshot size and replay time also matter because failover must finish before the venue misses its recovery target.'
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern appears in exchanges, dark pools, internal crossing systems, auction platforms, allocation engines, and inventory reservation systems. The shared need is concurrent commands whose outcomes must be fair, ordered, and explainable after failure.',
        'The same design idea appears outside finance as event sourcing and write-ahead logging. A durable ordered input stream is often easier to trust than a mutable object graph. The object can be rebuilt; the official sequence cannot be invented later.'
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The pattern fails if the matcher reads unsequenced inputs. Random tie breaks, current wall-clock reads, external service calls, and unversioned rule changes make replay diverge. Those inputs must either be removed or captured in the command record.',
        'It also fails when sequence ownership is split too casually. Two sequencers for one instrument can create conflicting histories unless they use a stronger consensus or partitioning rule. Speed gained by reintroducing races is not real speed in a market system.'
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with an empty book. Command 102 is buy 100 shares at 10.00. The matcher rests it at bid 10.00 with time priority 102. Command 103 is sell 40 shares at 9.99. Because 9.99 crosses the best bid, it trades 40 against command 102 and leaves 60 shares resting.',
        'A snapshot taken at sequence 101 plus log entries 102 and 103 is enough to rebuild that state. Replay applies 102, then 103, and ends with 60 shares on the bid. If replay applies 103 first, no trade happens and the final state differs, which proves why the sequence is part of correctness.',
        'After a crash, a standby loads snapshot 101 and replays 102 and 103. It verifies a checksum for the remaining book and resumes at 104. The recovery question is not which packet arrived at a network card first; it is which command the sequencer committed first.'
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Nasdaq OUCH 5.0, https://www.nasdaqtrader.com/content/technicalsupport/specifications/TradingProducts/OUCH5.0.pdf; Nasdaq TotalView-ITCH 5.0, https://www.nasdaqtrader.com/content/technicalsupport/specifications/dataproducts/NQTVITCHSpecification.pdf; FIX ExecutionReport, https://fiximate.fixtrading.org/legacy/en/FIX.5.0SP2/body_5756.html. Study write-ahead logs, event sourcing, Raft log replication, idempotency, limit order books, and market-data reconstruction next.'
      ],
    },
  ],
};
