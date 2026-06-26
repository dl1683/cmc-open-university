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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as timestamp merge logic under imperfect clocks. Active events are generating or receiving timestamps, visited events have already contributed causal evidence, and found events have HLC values that are safe to compare. A safe inference is that receiving a later timestamp forces the next dependent local event to be greater, even if the local wall clock is behind.',
        {type:'callout', text:'Hybrid logical clocks pair wall time with a counter so timestamps stay readable while still respecting known causal order.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/0/08/Lamport-Clock-en.svg', alt:'Lamport clock diagram showing three process timelines, message arrows, and logical timestamp values.', caption:'Lamport clock causality diagram by Duesentrieb, updated by Dr. Greywolf, Wikimedia Commons, CC BY-SA/GFDL.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
      'Distributed databases need timestamps for versions, reads, writes, logs, and garbage collection. Physical clocks are useful because operators understand wall time, but machines drift and messages arrive late. A timestamp that looks like time can still violate causality if one node is behind another.',
      'Hybrid logical clocks, or HLCs, combine physical time with a logical counter. The physical part stays close to the machine clock, while the logical part preserves known happens-before relationships. CockroachDB uses this style of timestamp as part of its MVCC and transaction machinery.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to stamp every event with the local wall clock. That is readable and cheap, and it works on one machine. It fails across machines because a read on node B can receive evidence from a write on node A while B clock still says an earlier time.',
      'The other obvious approach is a Lamport clock, a counter that increases when events happen and when messages are received. Lamport clocks preserve causality, but the numbers have no direct relationship to real time. Databases still need time-adjacent values for MVCC history, follower reads, and operational debugging.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is clock skew. If node A is 40 ms ahead and node B is 20 ms behind, a causally later event on B can receive a smaller physical timestamp than the earlier event on A. A database that trusts physical time alone can read stale data or order versions incorrectly.',
      'Pure logical time hits the opposite wall. It can tell that one event followed another, but it cannot say whether a version is old enough for garbage collection or whether a bounded-staleness read is acceptable. The system needs causality and approximate real time in one compact value.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'An HLC timestamp has two fields: physical time and logical counter. On each event, the node chooses the maximum physical component among local wall time, the last local HLC, and any received HLC. If physical time advances, the logical counter resets; if not, the counter increments.',
      'The key invariant is that a node never produces a timestamp lower than causal evidence it has observed. If a message carries timestamp 1000.3 and the receiver wall clock says 990, the receiver can keep physical component 1000 and increment the logical part. It does not need to move the machine clock forward.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Each node stores the largest HLC it has produced or received. When it sends a message, it attaches its current HLC. When it receives a message, it merges the incoming physical and logical parts with its own state so future dependent events receive larger timestamps.',
      'CockroachDB also tracks uncertainty. If a transaction reads at timestamp t, a version with a physical timestamp slightly above t might have been written before the transaction started on a skewed clock. The uncertainty interval forces the transaction layer to restart or check rather than ignoring a near-future value that could be causally relevant.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is a monotonic merge rule. Every local event and every received message updates the stored HLC to be at least as large as the evidence seen so far. Therefore, if event B causally depends on event A through a message path, B timestamp is greater than A timestamp.',
      'The clock stays useful because the physical component normally follows wall time. The logical counter grows only when events share a physical tick or when causality outruns the receiver clock. This keeps timestamps compact enough to store on every MVCC version while still honoring known causal order.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The metadata cost is small: a physical integer and a logical integer per timestamp. Comparing timestamps is constant time, and updating an HLC is constant time. If an operation count doubles, HLC update cost doubles with the operations, not with the number of nodes.',
      'The real cost is clock discipline. The database must monitor maximum offset, reject or isolate nodes that drift too far, and handle uncertainty windows in transaction logic. Wider clock bounds mean more restarts and less useful follower reads because more near-future versions must be treated carefully.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'HLCs fit distributed databases that need local timestamp generation without a central timestamp oracle on every operation. They help with MVCC version ordering, transaction timestamp pushes, follower reads, bounded staleness, and historical reads. The timestamp is small enough to live on hot paths and readable enough for operators.',
      'They also help logs and traces where physical ordering is helpful but unreliable. A pure wall-clock log can lie during skew, while a pure logical counter is hard to interpret. HLC-style values make causal movement visible without giving up time-adjacent debugging.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'HLCs fail if the system pretends they remove clock uncertainty. They preserve known causality, but they do not prove that unknown remote events did not happen. If physical clock offset exceeds the assumed bound, transaction safety can fail unless the database stops or isolates the bad node.',
      'They also fail when applications treat HLC order as true causality for unrelated events. Concurrent events can receive an arbitrary order because the timestamp is still a single comparable value. That order is useful for storage and conflict handling, but it is not proof that one user action caused another.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Node A wall clock is 1,000 ms and emits write W with HLC 1000.0. Node B wall clock is 970 ms because it is behind. B receives W, takes max physical 1000, and emits dependent event R as 1000.1 instead of 970.0, so R is ordered after W.',
      'Now suppose B local clock reaches 1,020 ms before its next event. The max physical value becomes 1,020, so the logical counter resets and the next timestamp is 1020.0. Physical time caught up, and the logical counter stopped carrying the earlier causal pressure.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Study Lamport clocks, vector clocks, CockroachDB transaction documentation, MVCC, timestamp cache read refresh, and follower reads. Compare HLC with TrueTime: both address uncertainty, but TrueTime exposes bounded intervals while HLC combines physical time with a logical counter. Then simulate two nodes by hand until the max-then-count rule feels mechanical.',
    ] },
  ],
};