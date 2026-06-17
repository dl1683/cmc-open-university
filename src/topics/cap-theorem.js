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
      heading: 'What CAP Actually Says',
      paragraphs: [
        'CAP is a theorem about replicated state under a network partition. If two replicas cannot communicate, and a client can still reach one side, the system cannot guarantee both linearizable consistency and availability for every request.',
        'The useful reading is narrow and operational. Partitions are not a product setting. They are a failure the system must survive. Once the link breaks, a replica that cannot hear the rest of the system has only two honest choices: refuse work that might need fresher state, or answer from local state that may already be stale.',
      ],
    },
    {
      heading: 'The Real Problem',
      paragraphs: [
        'A replicated service wants nearby reads, nearby writes, and one global truth. In a healthy network this looks easy: write to one replica, copy the update to the others, then let any replica answer.',
        'The hard case starts when communication stops after one side accepts a write. Suppose N1 and N2 both store x = 7. A client writes x = 9 to N1, then the N1-to-N2 link fails. A different client asks N2 for x. N2 cannot tell whether N1 accepted a newer write, whether N1 is down, or whether no write happened at all.',
        'That uncertainty is the wall. Returning x = 7 keeps the service available but can expose stale state. Refusing the read protects a single-copy view of the data but makes an otherwise reachable node unavailable for that operation.',
      ],
    },
    {
      heading: 'The Three Letters',
      paragraphs: [
        'Consistency in CAP means every operation behaves as if it ran against one up-to-date copy, usually the linearizable model: once a write completes, later reads cannot return the old value.',
        'Availability means every request sent to a non-failing node eventually receives a non-error response. It is stricter than a good uptime graph. Returning "try later" from the only node a client can reach violates CAP availability for that request.',
        'Partition tolerance means the system continues to have a defined behavior even when messages between replicas are lost, delayed, or separated into islands. In real distributed systems, this is not optional. Links fail, packets vanish, routers misroute, regions isolate, and clients keep retrying.',
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        'Start with two replicas, N1 and N2, both holding x = 5. A client writes x = 7 while the network is healthy, so both replicas converge on x = 7. Nothing in CAP is interesting yet because communication lets the replicas preserve both freshness and responsiveness.',
        'Now split the network. A client on the N1 side writes x = 9. N1 can store the write locally, but N2 cannot receive it. When a client on the N2 side asks for x, the CP and AP designs diverge.',
        'The CP design refuses the read, redirects to a side with a quorum, or waits until it can prove freshness. The AP design returns x = 7 immediately and records enough metadata to repair the disagreement later. The same partition has produced two different user experiences and two different operational debts.',
      ],
    },
    {
      heading: 'How CP Systems Work',
      paragraphs: [
        'A CP system protects ordered truth by requiring an authority that can prove which operations committed. Many designs use a leader plus a majority quorum. A write commits only after enough replicas acknowledge it; a read either goes through the leader, verifies leadership, or contacts a quorum that overlaps with committed writes.',
        'Quorum overlap is the important data-structure fact. If every successful write quorum and every successful read quorum share at least one replica, the read path can see evidence of the latest committed state. When a partition leaves a side without a quorum, that side stops committing operations that require strong consistency.',
        'This is why etcd, ZooKeeper-style coordination, Raft groups, many metadata stores, lock services, and control planes accept refusal under partitions. Duplicate schedulers, double-issued leases, and contradictory membership decisions are worse than a temporary outage.',
      ],
    },
    {
      heading: 'How AP Systems Work',
      paragraphs: [
        'An AP system keeps serving from reachable replicas and treats divergence as a normal repair problem. The local answer may be old, or two sides may accept conflicting writes, so the system must carry causality, timestamps, tombstones, or merge-specific state.',
        'The simplest repair rule is last-write-wins. It is cheap, but it can drop a real update if clocks are skewed or if two users wrote different fields. Version vectors preserve causal history and can detect concurrent writes, but they push conflict handling into storage or application code. CRDTs make some operations merge safely by construction, but only when the data type and product semantics fit commutative updates.',
        'AP is not careless consistency. It is a deliberate shift from "never answer stale" to "answer now, then converge." Shopping carts, social feeds, metrics, DNS, presence indicators, and offline-first documents often prefer this shape because temporary staleness is less damaging than refusal.',
      ],
    },
    {
      heading: 'Why The Tradeoff Is Unavoidable',
      paragraphs: [
        'The proof intuition is indistinguishability. During the partition, N2 cannot distinguish "N1 accepted x = 9 and I have not heard it" from "no later write exists." The local observations at N2 are identical in both worlds.',
        'If N2 must always answer, there is a possible world where its answer is stale. If N2 must never answer stale, there is a possible world where it must wait or refuse. No header, retry loop, transaction coordinator, or clever cache can manufacture information that the partition prevents from arriving.',
        'This is also why CAP is a theorem about behavior, not branding. A database may offer CP reads, AP reads, tunable quorums, stale read options, leader-only writes, and local fallback paths. Each operation chooses a point on the tradeoff surface.',
      ],
    },
    {
      heading: 'Costs and Limits',
      paragraphs: [
        'CP systems pay in latency and refusal. A five-node quorum can tolerate two failed nodes, but a two-node island cannot keep committing majority-protected writes. Cross-region CP also pays healthy-network latency because coordination has to cross distance even when there is no partition.',
        'AP systems pay in correctness work after the response. They need anti-entropy, read repair, hinted handoff, conflict detection, merge policy, tombstone handling, and user-facing semantics for "both things happened." The cost does not disappear; it moves from the request path into reconciliation and product design.',
        'CAP also does not cover every consistency question. It does not choose isolation levels inside a database transaction. It does not measure durability. It does not tell you whether a cache invalidation strategy is good. It only nails the partition moment when freshness and universal response cannot both be guaranteed.',
      ],
    },
    {
      heading: 'Where The Choice Fits',
      paragraphs: [
        'Choose CP when stale or conflicting answers cause real harm: financial ledgers, inventory decrements, account uniqueness, lock ownership, cluster membership, authorization policy, and control-plane state. A refused request is visible, but a contradictory answer may corrupt the world the system is supposed to protect.',
        'Choose AP when the product can tolerate old data, merge data, or a temporary disagreement: feeds, recommendations, telemetry, caches, collaborative drafts, offline-first notes, shopping carts, and edge-readable configuration with bounded staleness.',
        'Many products mix both. A bank may run an AP marketing page, an eventually updated activity feed, and a CP ledger. A commerce site may keep browsing and carts available while routing payment capture and inventory finalization through stricter coordination.',
      ],
    },
    {
      heading: 'Common Failure Modes',
      paragraphs: [
        'The most common mistake is treating CAP as "pick any two." In a partitioned distributed system, P is already in the room. The live choice is C versus A for the affected operation.',
        'Another mistake is treating stale reads as harmless because they are rare. Rare stale reads can still double-spend, overwrite a newer profile, resurrect a deleted permission, or send a job to two owners. The business invariant decides the tradeoff, not the storage engine label.',
        'The opposite mistake is forcing CP semantics onto data that could have stayed useful locally. If a social counter, draft note, or cached product page refuses during every regional issue, the system has paid the cost of coordination without needing its strongest guarantee.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'PACELC extends the everyday lesson: if there is a partition, choose availability or consistency; else, even in a healthy network, choose latency or consistency. Strong cross-region coordination costs round trips whether or not anything is broken.',
        'Study Raft Leader Election and Raft Log Replication for the CP path. Study Consistent Hashing, Quorums, Read Repair, Gossip Protocol, Version Vectors, CRDTs, Two-Phase Commit, and Saga Pattern to see how real systems place data, coordinate commits, detect conflicts, and compensate when they choose a more available path.',
      ],
    },
  ],
};
