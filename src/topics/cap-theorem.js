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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows two database replicas, N1 and N2, each in a separate datacenter, connected by a replication link. Clients C1 and C2 each talk to their nearest node. Active edges show data flowing along that path. Found nodes hold confirmed state. When the replication edge disappears, the network has partitioned.',
        {type: 'callout', text: 'During a partition, the isolated replica cannot know whether silence means no write or a missing message, so it must either refuse or risk stale data.'},
        'The toggle at the top switches between CP and AP behavior during the partition. Under CP, a read from the isolated side is refused (compare highlight, no data returned). Under AP, the isolated node answers immediately with its local value (found highlight, possibly stale). Watch what happens to the value at N2 after N1 accepts a write during the partition, and compare the two runs.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Eric Brewer conjectured in 2000 that a distributed system can provide at most two of three properties: Consistency, Availability, and Partition tolerance. Gilbert and Lynch proved it formally in 2002. The result sounds like a menu, but it is really an impossibility theorem about replicated state under network failure.',
        'The problem it addresses is fundamental to any system that copies data across machines. A replicated service wants fast local reads, fast local writes, and one global truth. When communication between replicas works, all three look free. The theorem says what happens when communication stops.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/36/Internet_Connectivity_Distribution_%26_Core.svg', alt: 'Diagram of tiered internet connectivity between core and access networks', caption: 'Distributed services run on independently operated networks; CAP becomes visible when one connectivity path stops carrying replica messages. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Internet_Connectivity_Distribution_%26_Core.svg.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural design for replication: write to one node, copy the update to the others, read from anyone. With a healthy network, every read sees the latest write, every node answers, and the replicas stay in sync. Teams build this, ship it, and see no tradeoff.',
        'It works because the replication link delivers every update before any read can hit a stale replica. A single-leader or multi-leader design looks equivalent to one database with better uptime, as long as messages keep arriving.',
        'The phrase "as long as messages arrive" is doing all the work. The design assumes continuous connectivity without anyone choosing it explicitly.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The replication link breaks. A backhoe, a misconfigured router, a fiber cut, a cloud-region isolation. N1 accepts a write, but N2 never hears about it. N2 cannot distinguish "no new writes exist" from "a write happened and I missed it." Those two worlds produce identical local observations.',
        'This is not a bug in the replication protocol. It is an information-theoretic limit. No caching, retry logic, or transaction coordinator can manufacture the missing message. The partition physically prevents the information from crossing.',
        'Every request to N2 now forces a binary choice: answer with local state that may be stale, or refuse until the partition heals and freshness can be verified. There is no third option.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Animated packet switching network diagram', caption: 'Packet switching visualizes the messages that a partition delays or drops before replicas can compare state. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Packet_Switching.gif.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Consistency in CAP means linearizability: once a write completes, every subsequent read returns that value or a newer one. The system behaves as if there is one copy of every datum.',
        'Availability means every request to a non-failing node receives a non-error response. This is stricter than "good uptime." Returning "try later" from the only reachable node violates CAP availability for that request.',
        'Partition tolerance means the system has defined behavior even when messages between replicas are lost or delayed indefinitely. In real networks, partitions happen. Links fail, packets vanish, routers misroute, regions isolate.',
        'During a partition, a CP system refuses operations it cannot guarantee are fresh. In practice, this means requiring a quorum: a write commits only after a majority of replicas acknowledge it, and a read contacts enough replicas to overlap with any committed write. If the partition leaves a side without a quorum, that side stops serving. etcd, ZooKeeper, and HBase work this way.',
        'During a partition, an AP system serves from local state and treats divergence as a repair problem. It may accept conflicting writes on both sides and reconcile later using last-write-wins timestamps, version vectors, or CRDTs. Cassandra, DynamoDB (default mode), and CouchDB work this way.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Internet topology map with many connected nodes and links', caption: 'Real deployments sit on a graph of paths, regions, and failure domains; the CAP choice happens when that graph separates. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Internet_map_1024.jpg.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof by Gilbert and Lynch uses an indistinguishability argument. Construct two executions: in execution A, a write happens on one side of a partition; in execution B, no write happens. A replica on the isolated side receives the same messages in both executions, so it cannot behave differently.',
        'If the replica must always respond (availability), its response in execution A is the same as in execution B. But in execution A the response is stale, violating consistency. If the replica must never return stale data (consistency), it must refuse in execution B too, violating availability. No algorithm can distinguish the two executions with only local information.',
        'The proof requires the system to handle arbitrary partitions. A single-node system satisfies the theorem trivially because there is nothing to partition. CAP becomes real only when state is replicated across nodes that can lose contact.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'CP systems pay in latency and refusal. A five-node Raft group tolerates two failures, but a two-node island cannot commit majority-protected writes. Cross-region CP also pays healthy-network latency: a confirmed write must cross the distance to a quorum even when nothing is broken.',
        'AP systems pay in correctness work after the response. They need anti-entropy, read repair, hinted handoff, conflict detection, merge policy, and tombstone handling. The cost does not vanish; it moves from the request path into reconciliation and product design.',
        'CAP itself is narrow. It does not address latency, durability, isolation levels, or cache invalidation. It only pins down the partition moment when freshness and universal response cannot both hold. PACELC, proposed by Abadi in 2012, fills the gap: if there is a Partition, choose Availability or Consistency; Else (no partition), choose Latency or Consistency. A cross-continent confirmed write costs at least one speed-of-light round trip (~100ms US-East to EU-West) whether or not anything is broken. Cassandra is PA/EL (available during partitions, low latency normally). ZooKeeper is PC/EC (consistent during partitions, consistent normally, paying the latency cost). DynamoDB defaults PA/EL but offers strongly consistent reads at higher latency. Most real systems let each operation choose its own point on this grid.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'CP fits when stale or conflicting answers cause real harm: financial ledgers, inventory decrements, account uniqueness, lock ownership, cluster membership, authorization policy, and control-plane state. A refused request is visible and retryable; a contradictory answer can corrupt the invariant the system exists to protect.',
        'AP fits when the product tolerates old data, merges data, or absorbs a temporary disagreement: social feeds, recommendations, telemetry, caches, collaborative drafts, offline-first notes, shopping carts, DNS (the oldest AP system in production: every resolver may hold a slightly stale record, and the internet works anyway).',
        'Most products mix both. A bank runs an AP marketing page and an eventually-updated activity feed over a CP ledger. A commerce site keeps browsing and carts available while routing payment capture through stricter coordination. The choice is per-feature, not per-company.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The most common misreading is "pick any two." In a distributed system, partitions happen whether you choose them or not. P is already in the room. The live choice is C versus A for the affected operation during the partition.',
        '"Consistent" in CAP means linearizability, not ACID consistency. A database can be ACID-consistent (preserving application invariants) without being CAP-consistent (linearizable reads under partition). Conflating the two leads to confused design reviews.',
        'CAP says nothing about latency. Two systems can both be CP, yet one answers in 2ms and the other in 200ms. PACELC captures this dimension; raw CAP does not.',
        'Treating stale reads as harmless because they are rare is dangerous. A single stale read can double-spend money, overwrite a newer profile, resurrect a deleted permission, or send a job to two owners. The business invariant decides the tradeoff, not the storage engine label. The opposite mistake is equally costly: forcing CP semantics onto a social counter or cached product page means every regional hiccup triggers refusal for data that would have been fine slightly stale.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Two replicas, N1 in Virginia and N2 in Frankfurt, both hold balance = 100. A fiber cut isolates the transatlantic link.',
        'Alice, routed to N1, withdraws 30. N1 sets balance = 70 locally. The replication message to N2 queues but cannot be delivered.',
        'Bob, routed to N2, reads balance. CP path: N2 detects it has lost quorum. It returns an error. Bob retries after the partition heals and sees 70. No money was double-counted.',
        'AP path: N2 returns balance = 100. Bob sees a stale value. If Bob also withdraws 30, N2 sets balance = 70 locally. When the partition heals, both replicas say 70, but the total withdrawn was 60 from a starting balance of 100. The system is 30 short unless reconciliation logic detects the conflict.',
        'CP refused a read to protect a financial invariant. AP served a stale read that enabled a real-money error. Neither is universally correct. The right choice depends on whether the downstream action is safe to perform on possibly-stale data.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Brewer, "Towards robust distributed systems" (PODC 2000 keynote). Gilbert and Lynch, "Brewer\'s conjecture and the feasibility of consistent, available, partition-tolerant web services" (ACM SIGACT News, 2002). Brewer, "CAP twelve years later: How the rules have changed" (IEEE Computer, 2012). Abadi, "Consistency tradeoffs in modern distributed database system design" (IEEE Computer, 2012). Kleppmann, "A Critique of the CAP Theorem" (2015) argues the formal model is too narrow and proposes replacing it with explicit delay and connectivity assumptions.',
        'For the CP path, study Raft Leader Election, Raft Log Replication, and Paxos to see how quorum overlap guarantees linearizability. For the AP path, study Consistent Hashing for ring-based data placement, CRDTs for conflict-free merge after partition healing, Gossip Protocol for epidemic-style anti-entropy, and Version Vectors for causal ordering. For transaction coordination across the boundary, study Two-Phase Commit and Saga Pattern. For consistency models beyond CAP, study Eventual Consistency, isolation levels, and PACELC.',
      ],
    },
  ],
};
