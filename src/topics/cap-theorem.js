// The CAP theorem, experienced rather than recited: cut the cable between
// two replicas mid-write, then YOU choose — refuse to answer (consistent)
// or answer stale (available). There is no third button.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'cap-theorem',
  title: 'CAP Theorem',
  category: 'Systems',
  summary: 'When the network splits, a replicated system must choose: refuse to answer, or answer possibly-stale.',
  controls: [
    { id: 'choice', label: 'During the partition, choose', type: 'select', options: ['consistency (CP)', 'availability (AP)'], defaultValue: 'consistency (CP)' },
  ],
  run,
};

const NODES = [
  { id: 'N1', label: 'N1', x: 3.2, y: 2.6 },
  { id: 'N2', label: 'N2', x: 6.8, y: 2.6 },
  { id: 'C1', label: 'C1', x: 1.2, y: 7.2 },
  { id: 'C2', label: 'C2', x: 8.8, y: 7.2 },
];

export function* run(input) {
  const cp = String(input.choice) === 'consistency (CP)';
  if (!['consistency (CP)', 'availability (AP)'].includes(String(input.choice))) {
    throw new InputError('Pick CP or AP.');
  }

  const x = { N1: 5, N2: 5 };
  let partitioned = false;

  const snapshot = () => graphState({
    nodes: NODES.map((n) => ({
      ...n,
      note: n.id.startsWith('N') ? `x = ${x[n.id]}` : 'client',
    })),
    edges: [
      { id: 'c1', from: 'C1', to: 'N1' },
      { id: 'c2', from: 'C2', to: 'N2' },
      ...(partitioned ? [] : [{ id: 'repl', from: 'N1', to: 'N2' }]),
    ],
  });

  yield {
    state: snapshot(),
    highlight: { active: ['repl'] },
    explanation: 'A replicated database: two nodes (N1 in one datacenter, N2 in another) both holding x = 5, kept in sync over the replication link. Client C1 talks to its nearest node, C2 to its own. Three nice properties seem possible: Consistency (every read sees the latest write), Availability (every request gets an answer), Partition tolerance (the system survives the link breaking).',
  };

  x.N1 = 7;
  x.N2 = 7;
  yield {
    state: snapshot(),
    highlight: { active: ['c1', 'repl'], found: ['N1', 'N2'] },
    explanation: 'Happy path: C1 writes x = 7 to N1, the replication link carries it to N2, and a read at C2 returns 7. Consistent AND available — because the network is healthy. CAP is not about this moment.',
  };

  partitioned = true;
  yield {
    state: snapshot(),
    highlight: { swap: ['N1', 'N2'] },
    explanation: '⚡ PARTITION: the link between datacenters dies — a backhoe, a misconfigured router, a fiber cut. Crucially, P is not one of your "two out of three choices": partitions HAPPEN whether you like them or not. The theorem\'s real content is what comes next.',
    invariant: 'Partition tolerance is weather, not a menu option. The choice is only between C and A — during the storm.',
  };

  x.N1 = 9;
  yield {
    state: snapshot(),
    highlight: { active: ['c1'], found: ['N1'] },
    explanation: 'C1 writes x = 9. N1 accepts it locally — but the replication link is down, so N2 still believes x = 7. The two replicas now disagree, and neither can know it. C2 sends a read to N2…',
  };

  if (cp) {
    yield {
      state: snapshot(),
      highlight: { compare: ['c2'], active: ['N2'] },
      explanation: 'CP choice — protect CONSISTENCY: N2 cannot prove its value is current, so it REFUSES: error, timeout, "try again later." No client ever sees stale data; some clients see no data at all. This is the bank-balance and inventory-count choice — and it is exactly what Raft-backed systems (etcd, the Kubernetes brain) do: the minority side of a partition simply stops serving (see Raft Leader Election — no majority, no answers).',
    };
  } else {
    yield {
      state: snapshot(),
      highlight: { active: ['c2'], found: ['N2'] },
      explanation: 'AP choice — protect AVAILABILITY: N2 answers immediately with what it has: x = 7. STALE — the truth is 9 — but the answer arrived. This is the shopping-cart and social-feed choice: a slightly old cart beats an error page. Cassandra and DynamoDB default this way (see Consistent Hashing), and DNS has worked like this for forty years.',
    };
  }

  partitioned = false;
  x.N2 = 9;
  yield {
    state: snapshot(),
    highlight: { active: ['repl'], found: ['N1', 'N2'] },
    explanation: `The partition HEALS and the replicas reconcile: N2 catches up to x = 9. ${cp ? 'For CP systems, recovery is simple — the refused requests just retry and succeed.' : 'For AP systems, recovery is where the real engineering lives: detecting conflicting writes and merging them (last-write-wins timestamps, version vectors, CRDTs) — "eventual consistency" means the disagreement window closes, not that it never opened.'}`,
  };

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `One theorem, one honest sentence: when the network splits, you cannot be both consistent and available — pick per FEATURE, not per company. Real systems are dials, not labels: Cassandra lets every query choose its quorum size, and banks run AP storefronts over CP ledgers. The refinement worth knowing is PACELC: even without partitions, you still trade consistency against LATENCY — a cross-continent confirmed write costs ~100ms of speed-of-light, partition or not. Re-run this with the other choice and feel the difference from C2's chair.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `CAP theorem says: in a network of replicated databases, you cannot simultaneously guarantee Consistency (every read returns the latest write), Availability (every request gets an answer), and Partition tolerance (the system survives when the network splits). Partition tolerance is not optional—it will happen to you: a backhoe cuts a fiber, a misconfigured router flakes, a datacenter goes dark for three minutes. The real theorem is that during a partition, you choose between C and A. Consistency means refusing stale reads; availability means answering with what you have, even if it is outdated.`,
        `Why does this matter? Because a replicated system held 100% consistent requires that before it answers, it must confirm the write propagated to all replicas—but if those replicas are unreachable, it cannot confirm anything. The only way to stay available is to answer with whatever state you have locally, knowing it might be out of step.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Consider two datacenters, N1 and N2, both holding the true value x = 5. A client near N1 writes x = 9; the replication link carries it to N2. But mid-write, the link dies. Now N1 has x = 9 and N2 has x = 7. A client near N2 asks: "What is x?" Here is where you choose: if you choose Consistency (CP), N2 says "I cannot answer—the partition has broken my ability to prove I am up-to-date," and the client waits or gets an error. This is the path banks and distributed ledgers like etcd take: Raft leader election (see Raft Leader Election) will not form a majority on a partitioned minority, so those nodes simply refuse to serve. If you choose Availability (AP), N2 says "x = 7" immediately. It is stale, but the answer arrives—the cart shows an old price, the DNS gives an old IP address, the recommendation feed runs on yesterday's data. Real-world systems—Cassandra, DynamoDB, DNS, and most social networks—choose AP by default.`,
        `When the partition heals, N1 and N2 must reconcile. For CP systems, refused writes just retry and succeed—no problem. For AP systems, the real work begins: detecting conflicting writes (N1 saw x = 9, N2 saw an unrelated write x = 8) and merging them using strategies like last-write-wins timestamps, version vectors, or CRDTs. This window during which the two replicas disagreed is exactly what "eventual consistency" means: the disagreement closes, not that it never existed.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `CP systems are simpler to reason about: the data is always true, but availability drops when partitions occur. They are safe for invariants—your bank balance cannot go negative, inventory cannot oversell—but they do not work well when reliability-above-all is not the goal. AP systems are harder to build: you must design conflict resolution logic that is sound (last-write-wins works only if clock skew is tight; CRDTs require careful algebra). The hidden cost is that every AP query now carries a choice: how many replicas must agree before I trust the answer? This is the quorum: Cassandra lets you set this per query (read_consistency = ONE, QUORUM, or ALL), trading latency for confidence. The PACELC refinement adds another dimension: even without partitions, you trade consistency against latency. A write that must cross a continent to be confirmed costs ~100ms of pure speed-of-light, partition or not. That latency penalty applies to every write in a CP system, which is why most AP systems with local writes are deployed geographically.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Banks and inventory systems choose CP: every ledger entry must be durable and consistent, and a partition is rare enough that the cost of stopping service is worth it. Kubernetes (via etcd) chooses CP—the control plane must not admit two contradictory truths. Shopping carts, social feeds, and recommendation systems choose AP: a stale cart is acceptable, even preferred to a broken checkout. DNS has been AP forever: an old IP address is better than a timeout. DynamoDB and Cassandra both default to AP but expose quorum controls; a Cassandra cluster can be tuned to behave like CP (QUORUM for both reads and writes) if your application demands it. Most real systems are hybrids: banks run AP storefronts (fast checkouts, eventual settlement) over CP ledgers (accurate money). Cloud storage systems use CRDT-inspired merging (see Write-Ahead Log (WAL) and LSM Trees (How Cassandra Writes)) to reconcile conflicts without manual intervention.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Myth: Partitions are rare, so CAP does not matter. Reality: Partitions happen; plan for them. Even if your network is reliable, you will upgrade a switch, and during that upgrade, the partition is live. Myth: You choose CP or AP for your entire company. Reality: Choose per feature. One table might be CP (authoritative inventory), another AP (recommendations). Myth: Consistency means "ACID transactions." It does not—it means every replica agrees on the current value. Myth: "Eventual consistency" means eventually consistent enough, so let us not worry about staleness. Reality: During the disagreement window, your system can fork (two contradictory truths exist), and merging them is hard. Last-write-wins loses data (if two writes collide, one is silently dropped). Version vectors add complexity. CRDTs prevent data loss but constrain your data model. Myth: Tuning the quorum to ALL replicas makes you safe. Reality: All-quorum is AP with a CP flavor—you gain confidence but lose availability if even one replica is slow.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Dive into how CP systems prevent partitions from breaking consensus with Raft Leader Election. See how AP systems scale reads across many replicas with Consistent Hashing. Understand how Cassandra and DynamoDB commit writes durably with Write-Ahead Log (WAL) and LSM Trees (How Cassandra Writes). For distributed systems facing the availability-latency tradeoff, see Load Balancer.`,
      ],
    },
  ],
};

