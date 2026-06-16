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
      heading: 'What it is',
      paragraphs: [
        'A hybrid logical clock is a timestamp made from two parts: a physical wall-clock component and a logical counter. It behaves like a Lamport clock for causality while staying close enough to wall time to be useful for MVCC versions, debugging, historical reads, and operational reasoning.',
        'This topic extends Clocks & Ordering, NTP & PTP, Spanner Case Study, MVCC & Vacuum, and Transaction Isolation Levels. Spanner buys bounded uncertainty with TrueTime hardware. CockroachDB-style systems use ordinary clock sync plus HLC timestamps and a configured maximum clock-offset bound.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An HLC timestamp is a tuple (p, l). The p component is physical time, usually from the local system clock. The l component is a logical counter. On a local event, if the wall clock has moved beyond p, set p to wall time and reset l to zero. If wall time is equal to or behind p, keep p and increment l. This makes the clock monotonic even through same-millisecond bursts and small backward clock adjustments.',
        'On receiving a message, the node merges the remote timestamp into its local clock. It chooses the maximum physical component among wall time, local p, and remote p, then bumps the logical component so the receive timestamp is greater than both prior timestamps when necessary. That preserves the key logical-clock property: if A causally precedes B, HLC(A) is less than HLC(B).',
        'Unlike vector clocks, HLCs do not detect concurrency. Two concurrent events will still receive an ordered pair of timestamps. The benefit is compactness and operational usefulness: one timestamp can be stored in every MVCC key, compared cheaply, and read as roughly wall-clock time.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'HLCs need moderate clock synchronization. If clocks drift too far, timestamp ordering can stop matching the real-time assumptions the database relies on. CockroachDB documentation says nodes exchange clock information and can shut down when skew exceeds a configured fraction of the maximum allowed offset. The clock is therefore not trusted blindly; it is continuously policed.',
        'The other cost is uncertainty handling. A transaction reading a value whose timestamp falls inside its uncertainty interval may need to restart, because the value might have been written before the transaction began even though its timestamp is above the transaction timestamp. Reducing the maximum offset improves this path but requires better clock discipline.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider an order transaction that reads inventory in one range and writes an order row in another. The gateway chooses an HLC timestamp and sends requests to range leaseholders. Each request carries the HLC so receivers advance their local clocks. Writes become MVCC versions at HLC timestamps and are replicated through Raft. A later read snapshot can use those timestamps to decide which versions are visible.',
        'Now add skew. The transaction starts at timestamp 1000 with a maximum offset of 500 ms. A remote range returns a value at timestamp 1200. That value is inside the uncertainty interval [1000, 1500], so the transaction cannot safely assume it was written after the transaction began. The database restarts or pushes the read so the final execution has a coherent timestamp story.',
        'For historical reads, closed timestamps add another layer. A leaseholder promises not to accept writes at or below a closed timestamp. Followers that have applied the corresponding Raft log prefix can serve reads at or below that timestamp without contacting the leaseholder, trading freshness for latency.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'HLCs do not remove the need for consensus. They order timestamps, but Raft or Paxos still replicates state and transaction protocols still resolve conflicts. HLCs also do not provide TrueTime-style external consistency by themselves; they rely on bounded clock offset plus uncertainty handling. If operators ignore clock discipline, the correctness assumptions weaken.',
        'Another misconception is that HLCs are just wall-clock timestamps with a suffix. The logical counter is what makes causality survive local clock ties and backward motion. Without that counter, the system falls back into the last-write-wins clock-skew bug from the logical-clocks primer.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the HLC paper at https://cse.buffalo.edu/tech-reports/2014-04.pdf, CockroachDB transaction-layer docs at https://www.cockroachlabs.com/docs/stable/architecture/transaction-layer, CockroachDB atomic-clock comparison at https://www.cockroachlabs.com/blog/living-without-atomic-clocks/, and CockroachDB clock-management discussion at https://www.cockroachlabs.com/blog/clock-management-cockroachdb/. Study Spanner Case Study, TiKV Percolator Transaction Case Study, MVCC & Vacuum, Raft Log Replication, and NTP & PTP next.',
      ],
    },
  ],
};
