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
      heading: `What it is`,
      paragraphs: [
        `CAP theorem says a replicated data system cannot guarantee all three properties under a network partition: Consistency, Availability, and Partition tolerance. Eric Brewer stated the conjecture in 2000; Gilbert and Lynch proved a formal version in 2002. Here, consistency means linearizability: operations appear to happen in one global order, so a read after a completed write sees that write. Availability means every request to a non-failing node eventually receives a non-error response. Partition tolerance means the system keeps operating despite lost or delayed messages between groups of nodes.`,
        `The practical reading is narrower than the slogan. You do not choose C, A, or P on a whiteboard forever. During a partition, if one side cannot communicate with the other, it must either refuse some operations to preserve one-copy truth, or answer locally and risk stale or conflicting state.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Suppose two replicas both hold x = 5. A client writes x = 9 to replica A, but the link to replica B fails before B learns the write. A client now asks B for x. A CP design refuses the read or redirects it until a quorum can prove the latest value. etcd does this with Raft Leader Election and Raft Log Replication: a minority partition cannot elect or contact a leader, so it stops serving writes and many reads. An AP design lets B answer x = 5 and reconciles later. The answer arrived, but it was stale.`,
        `When the network heals, AP systems must merge. Last-write-wins is simple but can lose an update if clocks skew. Version vectors preserve causality but are harder to expose. CRDTs make certain merges mathematically safe, but only for data types whose operations commute. Cassandra-style systems use Consistent Hashing, replicas, hints, read repair, and tunable quorums to decide how much consistency each operation buys.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `CP systems pay with unavailable partitions and quorum latency. A five-node Raft group can tolerate two failures; if only two nodes are reachable, it must stop committing. AP systems pay with conflict semantics, background repair, and application logic. PACELC adds the everyday cost: if there is no partition, else latency versus consistency still matters. A cross-continent round trip can add 70-150 ms even on a healthy network, so global strong consistency is visible to users.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Kubernetes stores control-plane truth in etcd because two contradictory schedulers would be worse than a temporary outage. Financial ledgers, inventory decrements, and unique username claims usually prefer CP or at least a strongly coordinated path. Social feeds, metrics pipelines, DNS caches, shopping recommendations, and offline-first mobile apps often accept AP behavior. Cassandra stores writes in LSM Trees (How Cassandra Writes) and exposes per-operation consistency levels; Dynamo-style systems emphasized availability and repair. Many products mix both: a CP payment ledger beside AP notifications and feeds.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `CAP consistency is not the C in ACID, and availability is not uptime on a status page. It is a formal property about every non-failing node returning a response. Another trap is believing quorum settings alone make a database linearizable. R + W > N can prevent some stale reads, but clocks, read repair, leader leases, and failure detection still matter. Two-Phase Commit (2PC) gives atomic commit across participants, but it can block under coordinator failure; it is not a magic CAP escape hatch.`,
        `Sagas are not a CAP escape either. Saga Pattern designs choose visible intermediate states plus compensations because the business can tolerate them. Sharding & Partitioning and a Gossip Protocol change placement and membership; they do not remove the C-versus-A decision during a partition.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Raft Leader Election and Raft Log Replication for the CP path. Read Consistent Hashing, Sharding & Partitioning, and Gossip Protocol for AP-style placement and membership. Then compare Two-Phase Commit (2PC) and Saga Pattern to see how distributed transactions choose between blocking atomicity and compensating availability.`,
      ],
    },
  ],
};
