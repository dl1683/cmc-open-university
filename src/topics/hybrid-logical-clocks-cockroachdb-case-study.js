// Hybrid logical clocks: compact timestamps that preserve causality while
// staying close to wall-clock time, with CockroachDB-style transaction use.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'hybrid-logical-clocks-cockroachdb-case-study',
  title: 'Hybrid Logical Clocks & CockroachDB Case Study',
  category: 'Systems',
  summary: 'HLC timestamps combine wall-clock time with a logical counter, giving distributed databases causal order, readable MVCC versions, and bounded uncertainty without atomic clocks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['clock mechanics', 'database case study'], defaultValue: 'clock mechanics' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function hlcGraph(title) {
  return graphState({
    nodes: [
      { id: 'wall', label: 'wall', x: 0.8, y: 3.6, note: 'NTP time' },
      { id: 'tuple', label: '(p,l)', x: 2.5, y: 3.6, note: 'HLC' },
      { id: 'send', label: 'send', x: 4.3, y: 2.0, note: 'carry stamp' },
      { id: 'recv', label: 'recv', x: 4.3, y: 5.2, note: 'merge stamp' },
      { id: 'mvcc', label: 'MVCC', x: 6.6, y: 2.0, note: 'versions' },
      { id: 'uncertain', label: 'window', x: 6.6, y: 5.2, note: 'max offset' },
      { id: 'read', label: 'read', x: 8.7, y: 3.6, note: 'snapshot' },
    ],
    edges: [
      { id: 'e-wall-tuple', from: 'wall', to: 'tuple', weight: 'now' },
      { id: 'e-tuple-send', from: 'tuple', to: 'send', weight: 'tick' },
      { id: 'e-send-recv', from: 'send', to: 'recv', weight: 'message' },
      { id: 'e-recv-tuple', from: 'recv', to: 'tuple', weight: 'max' },
      { id: 'e-send-mvcc', from: 'send', to: 'mvcc', weight: 'write ts' },
      { id: 'e-recv-uncertain', from: 'recv', to: 'uncertain', weight: 'skew' },
      { id: 'e-mvcc-read', from: 'mvcc', to: 'read', weight: 'visible' },
      { id: 'e-uncertain-read', from: 'uncertain', to: 'read', weight: 'retry?' },
    ],
  }, { title });
}

function dbGraph(title) {
  return graphState({
    nodes: [
      { id: 'gateway', label: 'gateway', x: 0.8, y: 3.6, note: 'txn ts' },
      { id: 'rangeA', label: 'range A', x: 3.1, y: 2.1, note: 'leaseholder' },
      { id: 'rangeB', label: 'range B', x: 3.1, y: 5.1, note: 'leaseholder' },
      { id: 'raftA', label: 'Raft A', x: 5.4, y: 2.1, note: 'replicate' },
      { id: 'raftB', label: 'Raft B', x: 5.4, y: 5.1, note: 'replicate' },
      { id: 'mvcc', label: 'MVCC', x: 7.2, y: 3.6, note: 'HLC keys' },
      { id: 'closed', label: 'closed ts', x: 9.0, y: 2.1, note: 'follower ok' },
      { id: 'retry', label: 'retry', x: 9.0, y: 5.1, note: 'uncertain' },
    ],
    edges: [
      { id: 'e-gateway-a', from: 'gateway', to: 'rangeA', weight: 'request+HLC' },
      { id: 'e-gateway-b', from: 'gateway', to: 'rangeB', weight: 'request+HLC' },
      { id: 'e-a-raft', from: 'rangeA', to: 'raftA', weight: 'intent' },
      { id: 'e-b-raft', from: 'rangeB', to: 'raftB', weight: 'intent' },
      { id: 'e-raftA-mvcc', from: 'raftA', to: 'mvcc', weight: 'version' },
      { id: 'e-raftB-mvcc', from: 'raftB', to: 'mvcc', weight: 'version' },
      { id: 'e-mvcc-closed', from: 'mvcc', to: 'closed', weight: 'safe past' },
      { id: 'e-mvcc-retry', from: 'mvcc', to: 'retry', weight: 'future?' },
    ],
  }, { title });
}

function* clockMechanics() {
  yield {
    state: hlcGraph('An HLC timestamp is wall time plus a logical counter'),
    highlight: { active: ['wall', 'tuple', 'e-wall-tuple'], compare: ['uncertain'] },
    explanation: 'A hybrid logical clock keeps a tuple: physical time p and logical counter l. The physical part keeps timestamps close to human time. The logical part preserves monotonic causality when wall clocks tie or move backward.',
    invariant: 'HLC time never goes backward, even when the local wall clock does.',
  };

  yield {
    state: labelMatrix(
      'Local event update rule',
      [
        { id: 'advance', label: 'wall advances' },
        { id: 'same', label: 'same tick' },
        { id: 'back', label: 'wall behind' },
        { id: 'stamp', label: 'timestamp order' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'output' },
      ],
      [
        ['wall 101 > p 100', '(101,0)'],
        ['wall 101 = p 101', '(101,1)'],
        ['wall 99 < p 101', '(101,2)'],
        ['compare p then l', 'total order'],
      ],
    ),
    highlight: { found: ['advance:output', 'back:output'], compare: ['same:output'] },
    explanation: 'On a local event, take the larger of local wall time and the previous physical component. If wall time moves forward, reset the logical counter. If it does not, increment the logical counter.',
  };

  yield {
    state: labelMatrix(
      'Receive update rule',
      [
        { id: 'remoteFuture', label: 'remote future' },
        { id: 'localFuture', label: 'local ahead' },
        { id: 'tie', label: 'same physical' },
        { id: 'guarantee', label: 'guarantee' },
      ],
      [
        { id: 'case', label: 'case' },
        { id: 'newHlc', label: 'new HLC' },
      ],
      [
        ['recv (120,4), local (100,2)', '(120,5)'],
        ['recv (100,7), local (130,0)', '(130,1)'],
        ['recv (140,3), local (140,6)', '(140,7)'],
        ['send before receive', 'stamp increases'],
      ],
    ),
    highlight: { active: ['remoteFuture:newHlc', 'tie:newHlc'], found: ['guarantee:newHlc'] },
    explanation: 'On receive, the node merges the remote HLC into its local clock using max physical time, then bumps the logical part enough to be greater than both inputs. The message edge is now reflected in timestamp order.',
    invariant: 'If event A causally precedes event B, HLC(A) is less than HLC(B).',
  };

  yield {
    state: hlcGraph('HLCs are compact but do not prove concurrency'),
    highlight: { active: ['tuple', 'send', 'recv'], found: ['mvcc'], compare: ['uncertain'] },
    explanation: 'An HLC is one compact timestamp, not a vector. It preserves causal order, stays close to real time, and is easy to store in MVCC keys. It cannot tell that two ordered timestamps were actually concurrent.',
  };
}

function* databaseCaseStudy() {
  yield {
    state: dbGraph('CockroachDB uses HLC timestamps for transactions and MVCC'),
    highlight: { active: ['gateway', 'rangeA', 'rangeB', 'mvcc', 'e-gateway-a', 'e-gateway-b'], compare: ['closed'] },
    explanation: 'A gateway node picks an HLC timestamp for a transaction. Requests carry HLCs between nodes, each node updates its local HLC on receipt, and MVCC versions use those timestamps for visibility.',
  };

  yield {
    state: labelMatrix(
      'Uncertainty interval case study',
      [
        { id: 'start', label: 'txn starts' },
        { id: 'old', label: 'read old value' },
        { id: 'near', label: 'read near value' },
        { id: 'future', label: 'read future value' },
      ],
      [
        { id: 'timestamp', label: 'timestamp' },
        { id: 'decision' },
      ],
      [
        ['ts 1000, max offset 500', 'uncertainty to 1500'],
        ['value at 900', 'safe to read'],
        ['value at 1200', 'uncertainty restart'],
        ['value at 1700', 'not in snapshot'],
      ],
    ),
    highlight: { active: ['near:decision'], found: ['old:decision'], compare: ['future:decision'] },
    explanation: 'Without atomic clocks, a transaction cannot always know whether a value written slightly above its timestamp really happened before it began. CockroachDB handles that uncertainty with bounded clock offset and restart logic.',
    invariant: 'The max-offset window is the price of living without TrueTime intervals.',
  };

  yield {
    state: dbGraph('Closed timestamps let followers serve safe historical reads'),
    highlight: { found: ['closed', 'e-mvcc-closed'], active: ['mvcc'], compare: ['retry'] },
    explanation: 'A closed timestamp is a promise that a range will not accept new writes at or below that time. Once followers have applied the relevant Raft log entries, they can serve reads at or below the closed timestamp locally.',
  };

  yield {
    state: labelMatrix(
      'Timestamp design menu',
      [
        { id: 'spanner', label: 'Spanner' },
        { id: 'cockroach', label: 'CockroachDB' },
        { id: 'tikv', label: 'TiKV' },
        { id: 'dynamo', label: 'Dynamo' },
      ],
      [
        { id: 'timeSource', label: 'time source' },
        { id: 'tradeoff' },
      ],
      [
        ['TrueTime interval', 'hardware + commit wait'],
        ['HLC + max offset', 'uncertainty restarts'],
        ['timestamp oracle', 'central service path'],
        ['version vectors', 'siblings + merge'],
      ],
    ),
    highlight: { found: ['cockroach:timeSource'], compare: ['spanner:tradeoff', 'tikv:tradeoff'] },
    explanation: 'The point is not that HLC replaces consensus. CockroachDB still uses Raft and transaction protocols. HLC makes MVCC timestamps globally useful without requiring atomic clocks or a single timestamp oracle for every operation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'clock mechanics') yield* clockMechanics();
  else if (view === 'database case study') yield* databaseCaseStudy();
  else throw new InputError('Pick a hybrid-logical-clock view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed databases need timestamps that are useful for ordering, but physical clocks are imperfect. Machines drift, NTP corrects them gradually, and messages move through the network with delay. Pure physical time is attractive because users understand it, but it cannot safely express causality by itself.',
        'Hybrid logical clocks exist to combine physical time with a logical counter. They keep timestamps close to wall-clock time while preserving a causal rule: if one event is known to happen before another, the later event receives a greater HLC timestamp. CockroachDB uses this idea as part of its transaction and MVCC machinery.',
        'This is the practical middle ground between two unsatisfying extremes. A pure wall clock is readable but unsafe under skew. A pure logical clock is safe for causality but detached from time-based operations. HLC keeps both signals in one timestamp.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to use the local machine clock for every transaction timestamp. That fails when two machines disagree. A write on one node can appear to happen before a read that caused it on another node, simply because clocks are skewed.',
        'The other obvious approach is a Lamport clock. That preserves causality, but the numbers lose connection to real time. Databases still need physical-time-adjacent values for MVCC garbage collection, follower reads, bounded staleness, and operational reasoning. HLCs are the bridge.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'An HLC timestamp has two parts: physical time and a logical counter. The physical part tracks the local wall clock. The logical part increments when events need ordering within the same physical tick or when a received timestamp is ahead of the local clock.',
        'On local events, the clock takes the maximum of local physical time and the last physical component it has seen. If physical time moves forward, the counter resets. If not, the counter increments. On receive, the node merges the incoming timestamp with its own state so the next event is greater than both.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each node maintains the largest HLC timestamp it has produced or observed. When sending a message, it attaches its current HLC. When receiving a message, it updates local HLC state using the incoming physical and logical parts. Future timestamps must be greater than the received timestamp if they causally depend on it.',
        'CockroachDB also cares about clock uncertainty. A transaction reading at timestamp t may encounter a value with a physical timestamp slightly above t from another node. If that value could have been written before the transaction started under clock skew, the transaction cannot ignore it. The uncertainty interval protects correctness.',
        'HLC timestamps therefore support MVCC ordering, transaction pushes, follower reads, and historical reads, but they do not remove the need for concurrency control. They provide timestamps with causal discipline; the transaction layer still decides which histories are legal.',
        'A simple mental model is max-then-count. On every event, take the maximum physical component among local wall time, last HLC, and any received HLC. If the maximum came from a strictly newer physical time, reset the logical counter. If not, increment the counter to keep the timestamp moving.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The merge view proves why HLC is not just a wall clock. A node can receive a timestamp from the future relative to its local clock and still move forward logically without forcing the machine clock to jump. The logical counter absorbs causal ordering pressure.',
        'The uncertainty view proves why close-to-physical time is not perfect physical truth. If clocks may be off by a bounded amount, a read must treat near-future versions carefully. The database is not being paranoid; it is preserving serializable behavior under clock skew.',
        'If the visual shows a timestamp moving ahead of local wall time, read that as causal memory. The node has learned about an event that must be before its next dependent event, so its HLC state must reflect that even while the physical clock catches up.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'HLC preserves causality because every message carries timestamp evidence. If event B receives a message from event A, B merges A timestamp before producing its own. The resulting timestamp is greater than A, even if B local physical clock was behind.',
        'It stays close to physical time because the physical component normally follows the machine clock. Logical counters grow only when causality or same-tick events require them. This gives systems a timestamp that is operationally meaningful without surrendering happened-before ordering.',
        'The compactness is the practical win over vector clocks. A database can store one HLC timestamp on every MVCC version and compare it cheaply. It loses concurrency detection, but gains a timestamp small enough to sit on the hot path.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The metadata cost is small: a physical component plus a logical counter. The real cost is the discipline around clock bounds. Systems must monitor clock offset, reject or isolate nodes whose clocks drift too far, and design uncertainty handling into reads and transactions.',
        'HLCs do not eliminate coordination. They reduce some need for centralized timestamp allocation, but conflicting transactions, range lease movement, replication, and serializable isolation still need protocols. Treat HLC as a timestamp substrate, not a complete database design.',
        'There is also an observability tradeoff. Operators may see timestamps that look like wall time but include logical movement caused by messages. Debugging needs tools that expose both parts, not only a formatted physical timestamp.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'HLCs win in distributed databases that need causally sensible timestamps near wall-clock time. They help with MVCC versions, follower reads, bounded staleness, transaction timestamp pushes, and reasoning about historical data.',
        'They are also useful for logs and traces where physical ordering is helpful but not reliable enough. A pure log timestamp can mislead during skew. An HLC-style timestamp makes causal movement explicit while remaining readable to operators.',
        'They are especially useful when centralized timestamp allocation would be a bottleneck. Nodes can generate useful timestamps locally while still merging causal evidence from messages. That reduces coordination on the common path without pretending clocks are perfect.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The main failure is pretending HLC removes clock problems. It does not. If clock offset exceeds the assumed bound, uncertainty windows and transaction logic can become unsafe. Production systems need clock monitoring and clear behavior when offsets are too large.',
        'Another failure is using HLC timestamps as a total order for unrelated events. HLC can order causally related events and provide a useful tie-breakable timestamp, but concurrent events may still receive an arbitrary order. Application semantics should not confuse that arbitrary order with causality.',
        'A third failure is ignoring long uncertainty windows. If clock bounds are loose, transactions may restart more often or reads may need extra checks. Better clocks do not just make timestamps prettier; they reduce the amount of uncertainty the transaction layer must defend against.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Lamport Clocks, Vector Clocks, MVCC Internals and Vacuum, Timestamp Cache and Read Refresh, Transaction Isolation Levels, CockroachDB Transaction Layer, Follower Reads, and TrueTime. Compare HLC with TrueTime carefully: both address time uncertainty, but they expose and use uncertainty in different ways.',
        'A useful exercise is to simulate two nodes where one clock is behind. Send a message from the ahead node to the behind node and update the HLC by hand. The logical counter will show exactly how causality survives clock skew.',
        'Then add a read timestamp and an uncertainty window. Ask whether a near-future write can be ignored. That exercise connects the clock abstraction to the transaction behavior users actually experience.',
      ],
    },
  ],
};
