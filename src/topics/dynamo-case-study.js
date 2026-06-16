// Amazon Dynamo case study: an always-writable key-value store built from
// consistent hashing, tunable quorums, vector clocks, hinted handoff, gossip,
// and Merkle-tree repair.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'dynamo-case-study',
  title: 'Amazon Dynamo Case Study',
  category: 'Papers',
  summary: 'The Dynamo paper as a composition lesson: consistent hashing, sloppy quorums, vector clocks, hinted handoff, gossip, and Merkle repair.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['write with sloppy quorum', 'conflict and repair'], defaultValue: 'write with sloppy quorum' },
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

function ring(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.8, y: 4.0, note: 'put(k,v)' },
      { id: 'coord', label: 'coordinator', x: 2.6, y: 4.0, note: 'routes key' },
      { id: 'a', label: 'A', x: 5.0, y: 1.4, note: 'primary' },
      { id: 'b', label: 'B', x: 7.5, y: 2.8, note: 'replica' },
      { id: 'c', label: 'C', x: 7.5, y: 5.2, note: 'replica' },
      { id: 'd', label: 'D', x: 5.0, y: 6.6, note: 'fallback' },
      { id: 'e', label: 'E', x: 3.1, y: 5.2, note: 'ring node' },
      { id: 'f', label: 'F', x: 3.1, y: 2.8, note: 'ring node' },
    ],
    edges: [
      { id: 'e-client-coord', from: 'client', to: 'coord', weight: 'request' },
      { id: 'e-coord-a', from: 'coord', to: 'a', weight: 'replica 1' },
      { id: 'e-a-b', from: 'a', to: 'b', weight: 'clockwise' },
      { id: 'e-b-c', from: 'b', to: 'c', weight: 'clockwise' },
      { id: 'e-c-d', from: 'c', to: 'd', weight: 'fallback' },
      { id: 'e-d-e', from: 'd', to: 'e', weight: 'ring' },
      { id: 'e-e-f', from: 'e', to: 'f', weight: 'ring' },
      { id: 'e-f-a', from: 'f', to: 'a', weight: 'ring' },
      { id: 'e-coord-b', from: 'coord', to: 'b', weight: 'replica 2' },
      { id: 'e-coord-c', from: 'coord', to: 'c', weight: 'replica 3' },
      { id: 'e-coord-d', from: 'coord', to: 'd', weight: 'hinted handoff' },
    ],
  }, { title });
}

function* writeWithSloppyQuorum() {
  yield {
    state: ring('Dynamo places keys with a consistent-hash ring'),
    highlight: { active: ['coord', 'a', 'b', 'c'], compare: ['d'] },
    explanation: 'Dynamo maps keys to a preference list using Consistent Hashing. A write for key k is coordinated by a node and sent to the first N healthy replicas for that key. In the normal case, A, B, and C store the value.',
    invariant: 'Placement is deterministic from ring membership and the key hash.',
  };

  yield {
    state: labelMatrix(
      'Tunable quorum: N=3, W=2, R=2',
      [
        { id: 'n', label: 'replication N' },
        { id: 'w', label: 'write W' },
        { id: 'r', label: 'read R' },
        { id: 'rw', label: 'R + W' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['3', 'store on three replicas'],
        ['2', 'write succeeds after two acks'],
        ['2', 'read asks two replicas'],
        ['4 > 3', 'usually intersects'],
      ],
    ),
    highlight: { active: ['w:value', 'r:value'], found: ['rw:value'] },
    explanation: 'Dynamo exposes a tunable consistency pattern. If N=3, W=2, and R=2, a successful read and write usually overlap on at least one replica. The word "usually" matters because Dynamo also uses sloppy quorum during failures, which may store a write on fallback nodes outside the ideal replica set.',
  };

  yield {
    state: ring('Node C is down: use D as a temporary holder'),
    highlight: { removed: ['c'], active: ['a', 'b', 'd', 'e-coord-a', 'e-coord-b', 'e-coord-d'], compare: ['e-coord-c'] },
    explanation: 'If C is unavailable, Dynamo can still accept the write by storing a hinted replica on D. D remembers that the value belongs to C and hands it back when C recovers. This is hinted handoff: availability first, repair later.',
    invariant: 'Failure handling is normal-case behavior, not an exceptional path.',
  };

  yield {
    state: labelMatrix(
      'What each mechanism buys',
      [
        { id: 'ring', label: 'ring' },
        { id: 'quorum', label: 'quorum' },
        { id: 'hint', label: 'hinted handoff' },
        { id: 'gossip', label: 'gossip' },
      ],
      [
        { id: 'mechanism', label: 'mechanism' },
        { id: 'site', label: 'study link' },
      ],
      [
        ['stable ownership under churn', 'Consistent Hashing'],
        ['R/W trade consistency for latency', 'Read/Write Quorums & Tunable Consistency'],
        ['write while replica is down', 'Idempotency & Exactly-Once Delivery'],
        ['spread membership and failures', 'Gossip Protocol'],
      ],
    ),
    highlight: { found: ['ring:site', 'quorum:site', 'gossip:site'] },
    explanation: 'Dynamo is valuable as a composition paper. No one primitive is the system. The system is the agreement between placement, membership, write policy, read repair, conflict metadata, and operational assumptions.',
  };
}

function* conflictAndRepair() {
  yield {
    state: labelMatrix(
      'Concurrent writes create siblings',
      [
        { id: 'v1', label: 'cart version A' },
        { id: 'v2', label: 'cart version B' },
        { id: 'merge', label: 'application merge' },
      ],
      [
        { id: 'vector', label: 'vector clock' },
        { id: 'value', label: 'value' },
        { id: 'status', label: 'status' },
      ],
      [
        ['A:2,B:1', 'add book', 'sibling'],
        ['A:1,C:2', 'add charger', 'sibling'],
        ['A:2,B:1,C:2', 'book + charger', 'resolved'],
      ],
    ),
    highlight: { active: ['v1:vector', 'v2:vector'], found: ['merge:value'] },
    explanation: 'Dynamo uses vector clocks to detect causality. If one version descends from another, the older version can be discarded. If two versions are concurrent, the system returns siblings and lets the application reconcile them. A shopping cart can merge additions; a bank ledger would need a stricter model.',
    invariant: 'Vector clocks detect concurrency; they do not decide business semantics.',
  };

  yield {
    state: labelMatrix(
      'Read repair and Merkle-tree anti-entropy',
      [
        { id: 'read', label: 'read repair' },
        { id: 'merkle', label: 'Merkle tree' },
        { id: 'handoff', label: 'hinted handoff' },
        { id: 'gossip', label: 'gossip' },
      ],
      [
        { id: 'when', label: 'when it runs' },
        { id: 'fixes', label: 'fixes' },
        { id: 'link', label: 'study link' },
      ],
      [
        ['during reads', 'stale replica returned', 'Quorums'],
        ['background', 'range divergence', 'Merkle Tree'],
        ['node recovers', 'temporary fallback writes', 'Write-Ahead Log (WAL)'],
        ['always', 'membership drift', 'Gossip Protocol'],
      ],
    ),
    highlight: { active: ['merkle:fixes', 'handoff:fixes'], found: ['merkle:link'] },
    explanation: 'Availability-first systems accumulate divergence. Dynamo repairs it with multiple mechanisms: reads can update stale replicas, hinted handoff returns writes to recovered nodes, and Merkle trees compare replica ranges without sending every key.',
  };

  yield {
    state: ring('A, B, and C converge after repair'),
    highlight: { found: ['a', 'b', 'c'], compare: ['d'], active: ['e-a-b', 'e-b-c'] },
    explanation: 'The final state is not achieved by a single global lock. It is achieved by repeated local mechanisms: quorum reads and writes, handoff, anti-entropy, and application-level reconciliation. That is the core Dynamo lesson: high availability is an ongoing maintenance process.',
  };

  yield {
    state: labelMatrix(
      'When Dynamo-style design is right or wrong',
      [
        { id: 'cart', label: 'shopping cart' },
        { id: 'session', label: 'session state' },
        { id: 'ledger', label: 'bank ledger' },
        { id: 'inventory', label: 'scarce inventory' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'why', label: 'why' },
      ],
      [
        ['strong fit', 'mergeable updates'],
        ['good fit', 'availability matters'],
        ['bad fit', 'needs strict serial truth'],
        ['dangerous', 'oversell risk'],
      ],
    ),
    highlight: { found: ['cart:fit', 'session:fit'], removed: ['ledger:fit', 'inventory:fit'] },
    explanation: 'The architecture is not universally correct. It is excellent when availability and low latency dominate and conflicts are rare or mergeable. It is the wrong default when invariants require one serial truth, as in ledgers, scarce inventory, or permissions.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'write with sloppy quorum') yield* writeWithSloppyQuorum();
  else if (view === 'conflict and repair') yield* conflictAndRepair();
  else throw new InputError('Pick a Dynamo view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Amazon Dynamo is a highly available key-value store described in the 2007 SOSP paper. It was designed for services where rejecting writes during failures was worse than temporarily accepting divergent versions. Instead of a single leader enforcing one serial order, Dynamo composes consistent hashing, replication, tunable quorums, vector clocks, hinted handoff, gossip membership, and Merkle-tree repair.',
        'The paper is one of the cleanest examples of production distributed-systems design because every mechanism serves the availability goal. It does not pretend partitions are rare. It treats failure handling as normal-case behavior.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A key is placed on a preference list using Consistent Hashing. With replication factor N, the value is stored on multiple successors in the ring. A write can succeed after W acknowledgments; a read can return after R responses. Operators choose R and W to trade latency, availability, and consistency.',
        'During failures, Dynamo uses sloppy quorum: it may write to healthy fallback nodes outside the ideal replica set. Those fallback nodes store hints so they can hand the data back to the intended replica later. Membership and failure information spreads through gossip or SWIM-like membership systems in related designs. Replica divergence is repaired through read repair and Merkle-tree anti-entropy.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost of high availability is conflict management. Concurrent writes can create siblings. Vector clocks detect whether versions are causally ordered or concurrent, but the application often has to decide how to merge them. Reads and writes are usually low latency, but the background system must continuously repair, reconcile, and monitor divergence.',
        'Dynamo also makes operational tradeoffs explicit. Increasing W improves write durability but hurts write availability and latency. Increasing R improves read freshness but hurts read latency. Setting R + W greater than N helps, but sloppy quorum and partitions mean the exact consistency story depends on failure modes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The Dynamo paper shaped the NoSQL era and influenced systems including Riak, Cassandra-style architectures, and many tunable-consistency stores. It is especially relevant for carts, session data, user preferences, metadata, and other workloads where availability is central and conflicts can be reconciled.',
        'It should not be confused with modern DynamoDB as an identical architecture. DynamoDB is a managed cloud database that evolved through different operational and architectural choices. The 2007 Dynamo paper remains valuable because it exposes the primitive design tradeoffs clearly.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Dynamo-style design is not "eventual consistency makes everything okay." Eventual convergence requires repair mechanisms, stable membership, bounded operational chaos, and application semantics that can tolerate or merge conflicts. Another misconception is that quorum math alone proves safety. Quorums interact with sloppy placement, stale membership, timeouts, retries, and background repair.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: "Dynamo: Amazon\'s Highly Available Key-value Store" at https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf, with historical context from https://www.allthingsdistributed.com/2017/10/a-decade-of-dynamo.html. Study Hinted Handoff Replica Queue, Read Repair Digest Quorum, Consistent Hashing, Read/Write Quorums & Tunable Consistency, Clocks & Ordering: Lamport to TrueTime, Merkle Tree, Gossip Protocol, SWIM Failure Detector & Membership, and CRDTs: Conflict-Free Replicated Data Types next.',
      ],
    },
  ],
};
