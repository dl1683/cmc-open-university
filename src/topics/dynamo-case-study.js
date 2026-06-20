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
    explanation: 'Read the ring as a placement function. The coordinator hashes the key to a preference list and sends the write to the first healthy replicas for that key. In the normal case, A, B, and C store the value.',
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
    explanation: 'If C is unavailable, Dynamo can still accept the write by storing a hinted replica on D. D remembers that the value belongs to C and hands it back later. This is the core bargain: availability now, repair work later.',
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
    explanation: 'Availability-first systems accumulate divergence. Dynamo repairs it with several local mechanisms: reads update stale replicas, hinted handoff returns fallback writes, and Merkle trees compare ranges without sending every key.',
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
      heading: 'The availability problem',
      paragraphs: [
        'Amazon Dynamo is a highly available key-value store described in the 2007 SOSP paper. It was built for Amazon services where rejecting a write during a failure could be worse than accepting temporary inconsistency. A shopping cart is the usual intuition: if the system is uncertain during a partition, preserving the user\'s intent and reconciling later can be better than refusing the update.',
        'The paper is useful because it does not treat failure as a rare exception. It designs the normal path and the failure path together. Machines fail, network partitions happen, membership views lag, and replicas diverge. Dynamo composes several mechanisms so the system can keep accepting reads and writes while continuously repairing disagreement.',
        {type:'callout', text:'Dynamo preserves availability by accepting work on reachable replicas first, then making divergence explicit with causality metadata and repair paths.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/7/71/Consistent_Hashing_Sample_Illustration.png', alt:'Consistent hashing ring showing servers placed around a 360-degree circle and a blob assigned to the next clockwise server.', caption:'Consistent hashing sample illustration by WikiLinuz, CC BY-SA 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The first naive design is a single primary replica that serializes every write. That gives a simple consistency story, but the primary becomes a bottleneck and a failure boundary. If the primary or its network path is unavailable, writes stop. For workloads where availability is the product promise, that is unacceptable.',
        'The second naive design is to replicate data everywhere and require all replicas to agree before returning. That improves durability but makes latency and availability terrible under failures. The slowest or unreachable replica controls progress. In a wide distributed system, waiting for everyone is often the same as waiting forever.',
        'Dynamo chooses a different bargain. It gives operators tunable quorums, accepts that replicas can diverge, stores causality metadata, and runs repair processes. The design does not remove the hard problem; it moves conflict handling into an explicit part of the application and storage contract.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A key is placed on a ring using consistent hashing. The first N suitable nodes on the ring form the preference list for that key. N is the replication factor. A write can succeed after W acknowledgments. A read can return after R responses. Operators choose N, R, and W to trade latency, availability, durability, and freshness.',
        'The quorum idea is only the beginning. In the clean case, if R plus W is greater than N, reads and writes should overlap on at least one replica. In the real system, failures complicate that story. Dynamo uses sloppy quorum: if an intended replica is unavailable, the coordinator may write to another healthy node. That fallback node stores a hint saying which replica should eventually receive the data. Hinted handoff later transfers the write back.',
        'Vector clocks track causality between versions. If one version descends from another, the older version can be discarded. If two versions are concurrent, Dynamo may return siblings to the application. Read repair and Merkle-tree anti-entropy help replicas converge. Gossip spreads membership and failure information. Each mechanism handles a different kind of drift.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Dynamo works because it separates accepting work from fully reconciling work. A write can be accepted by enough currently reachable nodes to preserve availability. Later, repair paths move data back to intended replicas and reconcile divergence. This is a production pattern: keep the user-facing path available, then pay background work to converge.',
        'It also works because the data model is simple. Key-value storage with application-visible conflicts is much easier to make highly available than arbitrary multi-row transactions. The application may know how to merge carts, preferences, sessions, or metadata. Dynamo exposes siblings instead of pretending it can always choose the right winner.',
        'The design makes tradeoffs explicit. Increasing W improves write durability but hurts write availability and latency. Increasing R improves read freshness but hurts read latency. Lower values improve responsiveness but increase the chance of stale reads or divergent versions. There is no magic setting that satisfies every workload.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Dynamo-style ideas fit workloads where availability is central and conflicts are mergeable or tolerable. Shopping carts, sessions, user preferences, feature flags, metadata, and some service state can often handle temporary divergence. The application may prefer two versions to no version.',
        'The paper shaped the NoSQL era and influenced Riak, Cassandra-style architectures, tunable-consistency stores, anti-entropy repair, and many discussions of eventual consistency. It should not be confused with modern DynamoDB as an identical architecture. DynamoDB is a managed cloud database with its own evolution. The 2007 paper remains valuable because it exposes the primitive design tradeoffs clearly.',
        'Dynamo is the wrong mental model for domains that require one serial truth at write time. Ledgers, inventory with hard constraints, strongly consistent indexes, and cross-record invariants need different machinery. Eventual convergence is not enough when the world cannot tolerate concurrent truths.',
      ],
    }
  ],
};

