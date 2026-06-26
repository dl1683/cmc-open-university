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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the ring as the keyspace and the replica nodes as storage owners. Active means the coordinator is choosing replicas or waiting for acknowledgments, visited means a replica has been contacted or repaired, and found means the request has enough responses to return under the chosen quorum rule.',
        'The safe inference rule is overlap under the current failure model. If R read responses plus W write acknowledgments exceed N replicas in a clean quorum, a read and write must share at least one replica. Dynamo then adds repair paths because real failures can move writes outside the ideal preference list.',
        {type:'callout', text:'Dynamo preserves availability by accepting work on reachable replicas first, then making divergence explicit with causality metadata and repair paths.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/7/71/Consistent_Hashing_Sample_Illustration.png', alt:'Consistent hashing ring showing servers placed around a 360-degree circle and a blob assigned to the next clockwise server.', caption:'Consistent hashing sample illustration by WikiLinuz, CC BY-SA 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Amazon Dynamo is a highly available key-value store described in the 2007 SOSP paper. A key-value store maps a key such as cart:123 to an opaque value such as a shopping-cart record. The system was built for services where refusing writes during failures could damage the product.',
        'Distributed storage has to choose behavior when machines fail, links partition, and replicas disagree. Dynamo chooses to keep accepting work on reachable replicas, then expose and repair divergence. The design teaches that availability is not free; it is paid for with conflict tracking and background convergence.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one primary replica per key. Every write goes to the primary, and followers copy the result. This gives a simple order because one node decides the latest value.',
        'Another obvious approach is to require all replicas to acknowledge every write. That gives strong agreement when all replicas are healthy. It also makes the slowest or unreachable replica part of every user request.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is failure as a normal event. If the primary is down, primary-based writes stop. If one replica is unreachable, all-replica agreement stops. A store spread across many machines will hit those cases during maintenance, overload, network loss, and hardware failure.',
        'The second wall is causality. If two clients update the same cart during a partition, neither update is simply newer from the whole system view. A timestamp can hide one user action, so the store needs metadata that can say these versions are concurrent.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Dynamo separates accepting a request from proving that every replica agrees. A coordinator writes to enough reachable nodes to meet the chosen W value and reads from enough nodes to meet R. Operators tune N, R, and W for each service target.',
        'The invariant is that divergence must remain explicit. Vector clocks record causal ancestry, hinted handoff records where a temporary write should eventually go, and repair mechanisms compare replicas after the request path returns. The system does not pretend that availability removed disagreement.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Consistent hashing places keys and storage nodes on a logical ring. For a key, Dynamo walks clockwise to find the preference list, which is the ordered set of replicas that should store the key. N is the replication factor, such as three replicas per key.',
        'For a write with N = 3 and W = 2, the coordinator can return success after two acknowledgments. If the third intended replica is down, a healthy fallback node can store the write with a hint naming the intended owner. Later, hinted handoff sends that data home.',
        'For reads, the coordinator asks R replicas and compares versions. If one version descends from another, the older value can be discarded. If two versions are concurrent, Dynamo can return siblings so application logic can merge them.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'In the clean quorum case, R + W > N means every successful read set overlaps every successful write set. With N = 3, R = 2, and W = 2, any two read replicas and any two write replicas share at least one node. That shared node can carry the latest version evidence.',
        'Sloppy quorum weakens the clean overlap story, so Dynamo adds repair obligations. Hints move writes back to intended replicas, read repair fixes stale values seen during reads, and Merkle-tree anti-entropy finds differences between replica ranges. Correctness is therefore eventual convergence plus explicit conflict exposure, not single-copy serial truth.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A write touches up to N replicas and returns after W acknowledgments. Raising W improves durability before return but increases latency and lowers write availability. Raising R improves the chance of fresh reads but makes reads slower and more failure-sensitive.',
        'When keys double, ring metadata and replica storage roughly double with data volume, while each single-key operation still contacts a bounded replica set. The hidden cost is repair traffic, vector-clock metadata, conflict resolution, and operator reasoning about stale reads. Availability moves cost from the foreground request into metadata and background work.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Dynamo-style designs fit carts, sessions, preferences, metadata, feature flags, and service state where temporary divergence can be merged or tolerated. The application often knows more than the store about how to combine versions.',
        'The paper influenced Riak, Cassandra-family designs, tunable consistency, consistent hashing, vector-clock conflict handling, and anti-entropy repair. Modern Amazon DynamoDB is not the same system, but the original paper remains useful because it shows the primitive tradeoffs clearly.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Dynamo is a poor fit when the product needs one serial truth before returning. Ledgers, hard inventory constraints, unique indexes, and cross-record invariants need stronger coordination. Returning concurrent versions is not enough when the world cannot accept both actions.',
        'It also fails when applications cannot merge conflicts well. If siblings are treated as an error path, the system has only delayed the hard part. Availability-oriented storage needs application code and operations that understand divergence.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose cart:9 has N = 3 replicas A, B, and C, with R = 2 and W = 2. A write of item book reaches A and B, while C is down, so the write succeeds after two acknowledgments. A later read from B and C sees the new value on B and an old value on C, so read repair can update C.',
        'During a partition, client 1 writes book to A and B while client 2 writes pen to C and a hinted fallback D. The vector clocks are concurrent because neither version descends from the other. A later read can return both siblings, and the cart application can merge them into book plus pen.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: DeCandia et al., Dynamo: Amazon\'s Highly Available Key-value Store, SOSP 2007, https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf. Study the paper for preference lists, sloppy quorum, vector clocks, hinted handoff, read repair, Merkle trees, and gossip membership.',
        'Study Consistent Hashing for placement, Quorum Replication for R and W behavior, Vector Clocks for causality, Merkle Trees for anti-entropy, and CRDTs for data types that can merge without application-specific conflict code. Use those topics to separate placement, freshness, causality, repair, and merge semantics.',
      ],
    },
  ],
};
