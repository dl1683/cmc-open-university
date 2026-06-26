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
        'The animation shows two database replicas, N1 and N2, each in a separate datacenter, connected by a replication link. Clients C1 and C2 each talk to their nearest node. Active edges show data flowing along that path; found nodes hold confirmed, up-to-date state. When the replication edge disappears, the network has partitioned and the two nodes can no longer communicate.',
        {type: 'callout', text: 'During a partition, the isolated replica cannot know whether silence means no write or a missing message, so it must either refuse or risk stale data.'},
        'Use the toggle to switch between CP (consistency-preserving) and AP (availability-preserving) behavior during the partition. Under CP, a read from the isolated side is refused -- the compare highlight appears and no data is returned. Under AP, the isolated node answers immediately with its local value, shown by the found highlight, even though that value may be stale. Run both modes and watch what happens to the value at N2 after N1 accepts a write while the link is down.',
        {type: 'image', src: './assets/gifs/cap-theorem.gif', alt: 'Animated walkthrough of the cap theorem visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'In 2000, Eric Brewer conjectured that any distributed data store can guarantee at most two of three properties: Consistency (every read returns the most recent write), Availability (every request to a non-failing node gets a response), and Partition tolerance (the system keeps working when network messages between nodes are lost or delayed). In 2002, Seth Gilbert and Nancy Lynch proved this formally. The result looks like a menu -- "pick two" -- but it is actually an impossibility theorem about replicated state under network failure.',
        'The problem it addresses is fundamental. Any system that copies data across machines wants fast local reads, fast local writes, and one global truth. When the network between replicas is healthy, all three look free. The theorem pins down what happens when that communication stops -- and every real network eventually does stop, at least briefly.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/36/Internet_Connectivity_Distribution_%26_Core.svg', alt: 'Diagram of tiered internet connectivity between core and access networks', caption: 'Distributed services run on independently operated networks; CAP becomes visible when one connectivity path stops carrying replica messages. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Internet_Connectivity_Distribution_%26_Core.svg.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first design: write to one node, replicate the update to the others, let any node serve reads. With a healthy network this works perfectly -- every read sees the latest write, every node answers, and the replicas stay in sync. Teams build this, ship it, and observe no tradeoff.',
        'It works because the replication link delivers every update before any read can hit a stale replica. Whether you use single-leader or multi-leader replication, the system looks like one database with better uptime. The latency of replication is shorter than the gap between writes, so staleness never surfaces.',
        'But the entire design hangs on one assumption: messages always arrive. Nobody writes that assumption down, and nobody tests what happens when it breaks. The tradeoff is hiding behind a healthy network.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The replication link breaks. A backhoe cuts a fiber. A router misconfiguration black-holes packets between two regions. A cloud provider isolates a zone. N1 accepts a write (say, x changes from 5 to 9), but N2 never receives the replication message. From N2\'s perspective, x is still 5.',
        'This is not a bug you can fix with better retries or smarter caching. It is an information-theoretic limit. N2 cannot distinguish "no new writes happened" from "a write happened and I missed it." Those two situations produce identical local observations. No protocol running on N2 alone can tell them apart, because the information that would distinguish them is on the other side of the partition.',
        'Every incoming request to N2 now forces a binary decision: answer with local state that might be stale, or refuse to answer until the partition heals and N2 can verify freshness. There is no third option -- no clever algorithm, no timeout trick, no probabilistic middle ground that avoids both risks.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Animated packet switching network diagram', caption: 'Packet switching visualizes the messages that a partition delays or drops before replicas can compare state. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Packet_Switching.gif.'},
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The "pick two out of three" framing is a trap. It implies you can drop P (partition tolerance) and keep both C and A. You cannot. Partitions are not a feature you opt into -- they are a physical reality of networks. Cables get cut, routers crash, packets get lost between datacenters. If your system runs on more than one machine connected by a network, partitions will happen whether you planned for them or not.',
        'Once you accept that P is not optional, the theorem collapses from a three-way choice to a two-way choice: during a partition, do you sacrifice Consistency or Availability? That is the entire theorem in one sentence. When the network is healthy, you get all three for free. The hard decision only activates when the link goes down.',
        'This reframing matters for engineering. A "CA system" in the CAP sense would be one that simply assumes partitions never happen. That is not a distributed system -- it is a single node, or a cluster that pretends the network is perfect. The moment you replicate data across a real network, you are in CP-or-AP territory. The only question is which penalty you accept: refused requests (CP) or stale responses (AP).',
        'Brewer himself clarified this in 2012: the "two out of three" shorthand oversells the theorem. The real engineering content is that every feature in a distributed system should have a declared partition strategy -- and that strategy can differ per feature, per query, even per row.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Consistency in CAP means linearizability, a specific and strong guarantee: once a write completes and the client gets an acknowledgment, every subsequent read -- from any node -- must return that value or a newer one. The system behaves as if there is exactly one copy of every piece of data, even though physically there are multiple copies on multiple machines.',
        'Availability in CAP means every request sent to a non-failing node eventually gets a non-error response. This is stricter than "good uptime." If the only node a client can reach returns "try later" or times out, that violates CAP-availability for that request, even if the cluster as a whole is mostly up.',
        'Partition tolerance means the system continues to operate (with defined behavior) even when an arbitrary number of messages between nodes are lost or delayed indefinitely. In real networks, this is not hypothetical -- links fail, packets vanish, routers misroute, and entire regions isolate from each other.',
        'A CP system protects freshness by requiring a quorum. A write commits only after a majority of replicas acknowledge it. A read must contact enough replicas to overlap with any possible committed write. If a partition leaves one side with fewer than a majority, that side stops serving -- it returns errors rather than risk returning stale data. Systems like etcd, ZooKeeper, and HBase work this way. The Raft consensus protocol is the canonical mechanism: no majority, no leader, no commits.',
        'An AP system protects responsiveness by serving from local state and treating divergence as a later repair problem. During a partition, both sides may accept writes independently. After the partition heals, the system reconciles conflicts using strategies like last-write-wins timestamps, version vectors, or CRDTs (conflict-free replicated data types). Cassandra, DynamoDB in its default mode, and CouchDB work this way.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Internet topology map with many connected nodes and links', caption: 'Real deployments sit on a graph of paths, regions, and failure domains; the CAP choice happens when that graph separates. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Internet_map_1024.jpg.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof by Gilbert and Lynch constructs an indistinguishability argument. Imagine two executions of the same distributed system. In execution A, a client writes a new value on one side of a partition. In execution B, no write happens at all. A replica on the isolated side receives exactly the same messages in both executions -- namely, none from the writing side -- so it has no information to behave differently.',
        'If the system guarantees availability, the isolated replica must respond in both executions. But its response is identical in A and B, because its local state is identical. In execution A, that response is stale (the write happened but the replica does not know), which violates consistency. If instead the system guarantees consistency, the replica must refuse to answer whenever it cannot prove freshness -- but then it refuses in execution B too, where the data actually was fresh, violating availability.',
        'The argument is tight because it requires only two nodes and one partition. A single-node system trivially satisfies the theorem since there is nothing to partition. CAP becomes a real constraint only when state is replicated across nodes that can lose contact with each other. The more nodes and the more geographic spread, the more frequently partitions occur in practice.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'CP systems pay two costs. First, during a partition, the minority side refuses all requests -- for a five-node Raft cluster, losing three nodes means the remaining two cannot form a majority and stop serving entirely. Second, even when the network is healthy, a confirmed write must wait for a majority of replicas to acknowledge, so cross-region CP systems pay a latency tax on every write. A round trip from US-East to EU-West takes at least 80-100ms at the speed of light, and that delay hits every single committed write.',
        'AP systems pay a different cost: correctness work after the response. When the partition heals, conflicting writes from both sides need detection and resolution. This requires anti-entropy protocols, read repair, hinted handoff, conflict detection, merge policies, and tombstone handling for deletes. The engineering effort does not vanish -- it moves from the request path into background reconciliation and product-level decisions about what "merge" means for each data type.',
        'CAP itself is narrow: it says nothing about latency, durability, transaction isolation, or cache invalidation. It only pins down one moment -- when the network splits, freshness and universal response cannot both hold. PACELC, proposed by Abadi in 2012, extends the picture: if there is a Partition, choose Availability or Consistency; Else (no partition), choose Latency or Consistency. Cassandra is PA/EL (available during partitions, low-latency normally). ZooKeeper is PC/EC (consistent during partitions, consistent normally, paying the latency cost). DynamoDB defaults to PA/EL but offers strongly consistent reads at higher latency per-request.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'CP fits when a stale or conflicting answer causes real harm. Financial ledgers need CP because a stale balance read can enable a double-spend. Inventory counts need CP because selling the last item twice creates a fulfillment failure. Lock ownership, cluster membership, authorization policy, and Kubernetes control-plane state (stored in etcd, a Raft-backed CP store) all need CP because a contradictory answer can corrupt the invariant the system exists to protect. A refused request is visible and retryable; a wrong answer can cascade silently.',
        'AP fits when the product can tolerate old data or merge concurrent changes without harm. Social feeds, recommendation lists, telemetry pipelines, CDN caches, collaborative editing drafts, offline-first mobile apps, and shopping carts all work well under AP semantics. DNS is the oldest AP system in production -- every resolver may hold a slightly stale record, and the internet works anyway because a slightly old IP address is almost always still correct.',
        'Most real products mix both strategies. A bank runs an AP marketing page and an eventually-updated activity feed over a CP ledger. A commerce site keeps browsing and cart interactions available (AP) while routing the actual payment-capture step through strict coordination (CP). The right unit of analysis is the feature, not the company or even the database.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The most common misreading is "pick any two." This framing implies you could drop partition tolerance and keep both C and A. You cannot, because partitions are not optional in any system that runs on a real network. P is already in the room; the live choice is C versus A for the affected operations during the partition.',
        '"Consistent" in CAP means linearizability, a specific property about read-write ordering across nodes. It is not ACID consistency, which means preserving application-level invariants (like "account balance >= 0"). A database can be ACID-consistent without being CAP-consistent, and vice versa. Conflating the two terms leads to confused design reviews and incorrect vendor comparisons.',
        'CAP says nothing about latency. Two systems can both be CP, yet one answers in 2ms (single-datacenter Raft) and the other in 200ms (cross-continent Raft). If your concern is "reads are slow," CAP is the wrong framework -- PACELC captures this dimension.',
        'Treating stale reads as harmless because partitions are rare is a dangerous bet. A single stale read can double-spend money, overwrite a newer profile update, resurrect a deleted permission, or dispatch a job to two workers. The business invariant determines the tradeoff, not the storage engine\'s marketing label. The symmetric mistake is equally costly: forcing CP semantics onto a social like-counter means every regional hiccup triggers request refusal for data that would have been perfectly fine slightly stale.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Setup: two replicas, N1 in Virginia and N2 in Frankfurt, both hold balance = 100 for account #42. A transatlantic fiber cut partitions the two datacenters. Replication messages queue on both sides but cannot be delivered.',
        'Alice, routed to N1, withdraws 30. N1 checks its local balance (100), confirms 100 >= 30, and sets balance = 70. The replication message destined for N2 sits in a send buffer, undeliverable. N2 still believes balance = 100.',
        'Bob, routed to N2, requests the balance. CP path: N2 participates in a two-node Raft group and detects it cannot reach a majority (it is alone on its side of the partition). N2 returns an error: "service unavailable." Bob retries after the partition heals, the replication message arrives, N2 updates to 70, and Bob reads the correct value. Total withdrawn: 30 from 100, balance 70. Invariant preserved.',
        'AP path: N2 answers immediately with its local value: balance = 100. Bob sees a stale number. If Bob also withdraws 30, N2 sets balance = 70 locally (100 - 30). When the partition heals, both replicas say 70. But total withdrawals were 30 (Alice) + 30 (Bob) = 60, from a starting balance of 100. The true balance should be 40, but both nodes show 70. The system is $30 short unless reconciliation logic (comparing write logs with vector clocks) detects the concurrent withdrawals and applies both.',
        'CP refused a read to protect a financial invariant. AP served a stale read that enabled a real-money error. Neither is universally correct -- the right choice depends on whether the downstream action is safe to perform on possibly-stale data. For a bank balance, CP is worth the downtime. For a social media like count, AP is worth the temporary inconsistency.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Brewer, "Towards robust distributed systems" (PODC 2000 keynote) -- the original conjecture. Gilbert and Lynch, "Brewer\'s conjecture and the feasibility of consistent, available, partition-tolerant web services" (ACM SIGACT News, 2002) -- the formal proof. Brewer, "CAP twelve years later: How the rules have changed" (IEEE Computer, 2012) -- Brewer\'s own correction of the "pick two" oversimplification. Abadi, "Consistency tradeoffs in modern distributed database system design" (IEEE Computer, 2012) -- introduces PACELC. Kleppmann, "A Critique of the CAP Theorem" (2015) -- argues the formal model is too narrow and proposes replacing it with explicit delay and connectivity assumptions.',
        'For the CP path, study Raft Leader Election, Raft Log Replication, and Paxos to see how quorum overlap guarantees linearizability. For the AP path, study Consistent Hashing for ring-based data placement, CRDTs for conflict-free merge after partition healing, Gossip Protocol for epidemic-style anti-entropy, and Version Vectors for causal ordering of concurrent writes. For transaction coordination that crosses the CP/AP boundary, study Two-Phase Commit and Saga Pattern.',
      ],
    },
  ],
};
