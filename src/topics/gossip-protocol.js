// Gossip protocols: spread information the way rumors spread — every node
// that knows tells a couple of random peers, every round. No coordinator,
// no broadcast, exponential spread, and failures barely matter.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'gossip-protocol',
  title: 'Gossip Protocol',
  category: 'Systems',
  summary: 'Each round, every informed node tells two peers — the whole cluster knows in O(log n) rounds.',
  controls: [
    { id: 'health', label: 'Cluster', type: 'select', options: ['all 12 nodes healthy', '3 nodes offline'], defaultValue: 'all 12 nodes healthy' },
  ],
  run,
};

const N = 12;
const NODES = Array.from({ length: N }, (_, i) => {
  const angle = (i / N) * 2 * Math.PI - Math.PI / 2;
  return { id: `n${i}`, label: String(i), x: 5 + 4.1 * Math.cos(angle), y: 5 + 4.1 * Math.sin(angle) };
});
const OFFLINE = ['n3', 'n7', 'n10'];

export function* run(input) {
  const degraded = String(input.health) === '3 nodes offline';
  if (!['all 12 nodes healthy', '3 nodes offline'].includes(String(input.health))) {
    throw new InputError('Pick a cluster state.');
  }
  const offline = new Set(degraded ? OFFLINE : []);
  const alive = NODES.filter((n) => !offline.has(n.id));

  const informed = new Set(['n0']);
  let roundEdges = [];
  const snapshot = () => graphState({
    nodes: NODES.map((n) => ({
      ...n,
      note: offline.has(n.id) ? 'offline' : informed.has(n.id) ? 'knows' : '',
    })),
    edges: roundEdges,
  });

  yield {
    state: snapshot(),
    highlight: { found: ['n0'], ...(degraded ? { swap: OFFLINE } : {}) },
    explanation: `Node 0 just learned something the whole cluster needs — a new member joined, a node died, a config changed. The naive plans both fail at scale: a central broadcaster is a bottleneck and a single point of failure; full mesh (everyone tells everyone) is n² messages. GOSSIP copies epidemiology instead: each round, every node that knows tells TWO peers chosen at random. That's the entire protocol.${degraded ? ' (And three nodes are dead — watch how little that matters.)' : ''}`,
  };

  let round = 0;
  while (round < 8) {
    round += 1;
    const senders = alive.filter((n) => informed.has(n.id));
    const newlyInformed = [];
    let wasted = 0;
    roundEdges = [];
    for (const sender of senders) {
      const s = Number(sender.id.slice(1));
      for (const k of [0, 1]) {
        const target = `n${(s * 3 + round * (2 + k) + 5 * k) % N}`;
        if (target === sender.id || offline.has(target)) continue;
        roundEdges.push({ id: `g${sender.id}-${target}-${k}`, from: sender.id, to: target });
        if (informed.has(target)) {
          wasted += 1;
        } else {
          informed.add(target);
          newlyInformed.push(target);
        }
      }
    }
    // deterministic rescue: a real protocol's randomness makes stalls vanishingly
    // rare; we model the retry by reaching one uninformed peer directly.
    if (newlyInformed.length === 0) {
      const missing = alive.find((n) => !informed.has(n.id));
      if (missing) {
        roundEdges.push({ id: `g-rescue-${missing.id}`, from: 'n0', to: missing.id });
        informed.add(missing.id);
        newlyInformed.push(missing.id);
      }
    }

    yield {
      state: snapshot(),
      highlight: {
        active: newlyInformed,
        found: [...informed].filter((id) => !newlyInformed.includes(id)),
        ...(degraded ? { swap: OFFLINE } : {}),
      },
      explanation: `Round ${round}: ${senders.length} informed node${senders.length === 1 ? '' : 's'} each told 2 peers — ${newlyInformed.length} heard it for the FIRST time${wasted > 0 ? `, ${wasted} message${wasted === 1 ? '' : 's'} hit nodes that already knew (redundant, and that redundancy is the point: it is what makes the protocol shrug off lost messages and dead nodes)` : ''}. ${informed.size} of ${alive.length} reachable nodes now know.`,
      invariant: 'The informed population roughly doubles each round — exponential spread, O(log n) rounds to saturation.',
    };

    if ([...alive].every((n) => informed.has(n.id))) break;
  }

  yield {
    state: snapshot(),
    highlight: { found: [...informed], ...(degraded ? { swap: OFFLINE } : {}) },
    explanation: `Saturation in ${round} rounds${degraded ? ' — and the three dead nodes changed almost nothing: gossip routed around them without any failure-handling code, because no path was ever special' : ` — log₂(${N}) ≈ ${Math.ceil(Math.log2(N))}, as promised`}. Total messages: ~2 per node per round — gentle, constant load per node, no matter how big the cluster grows.`,
  };

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'This is how Cassandra nodes learn the cluster\'s membership and token ring (see Consistent Hashing) — every node gossips its view once per second; how Consul/Serf detect failures (no heartbeat to a master — peers gossip suspicions); how Bitcoin transactions reach the whole network; and how DynamoDB replicas exchange state. Gossip pairs beautifully with Merkle Tree digests: gossip says "something changed," Merkle comparison finds exactly what. Epidemic by design — the same math that makes diseases spread fast makes clusters converge fast.',
  };
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        `Large clusters need to spread membership, health, and state hints without one coordinator becoming the bottleneck. A central broadcaster is simple, but it creates a privileged failure point and a fanout hot spot.`,
        `A gossip protocol spreads information by repeated random peer exchange. Each informed node tells a few peers each round. Redundancy is intentional: it lets information keep moving despite lost messages, dead nodes, and partial views.`,
      ],
    },
    {
      heading: 'The Obvious Approach and the Wall',
      paragraphs: [
        `The obvious approach is full broadcast: every node sends every update to every other node. That converges quickly but costs O(n^2) messages and couples every node to the full membership list.`,
        `A tree broadcast reduces messages, but failures near the root or inside the tree can cut off whole subtrees. The wall is robustness under churn: the dissemination path cannot depend on one perfect structure.`,
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        `Use randomized repeated contact instead of one planned path. If each informed node contacts k random peers per round, the informed population grows roughly exponentially until most nodes know the fact.`,
        `The invariant is not exactly-once delivery. It is repeated probabilistic exposure. A missed message is not fatal because the same fact is likely to arrive through another path in a later round.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `Read each round as fanout, not as a fixed route. An informed node tells a few peers; those peers become senders next round. Messages that hit nodes already informed are not pure waste. That redundancy is what makes the protocol tolerate dropped packets and dead peers.`,
        `Use the offline-node view to see the difference between planned broadcast and probabilistic spread. No particular edge is special, so the update can route around failed nodes without recomputing a broadcast tree. The cost is that convergence is probabilistic and takes several rounds.`,
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        `A node learns a fact, such as a membership change. In each round it picks a few random peers and sends the fact. Those peers repeat the process. Some messages hit nodes that already know, but the duplication masks loss and churn.`,
        `Many implementations run continuously. Cassandra uses gossip for membership and token-ring state. Consul and Serf build membership and failure detection on gossip-style dissemination. Peer-to-peer networks use related flooding to spread transactions and blocks.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `Random fanout creates many independent paths. No single dropped packet, dead node, or unlucky edge blocks the update. As more nodes learn the fact, more nodes help spread it.`,
        `With constant fanout k, convergence takes O(log n) rounds with high probability under the usual epidemic assumptions. The local load per node stays small even as the cluster grows.`,
      ],
    },
    {
      heading: 'Cost and Behavior',
      paragraphs: [
        `Each node sends a small fixed number of messages per round, so local work is O(1) per round. Total dissemination uses many redundant messages, but far fewer than full mesh broadcast for large clusters.`,
        `Latency is measured in rounds. A one-second gossip interval may converge membership over several seconds, which is fine for cluster state but wrong for operations needing immediate linearizable agreement.`,
        `The tail matters more than the average. The first half of the cluster may learn quickly, while the last few nodes depend on random contact, anti-entropy, or targeted repair. Production systems often track convergence lag and stale-peer counts rather than only message throughput.`,
      ],
    },
    {
      heading: 'Operational design',
      paragraphs: [
        `A production gossip system has to choose fanout, interval, message size, peer selection, expiration rules, and anti-entropy repair. Higher fanout and shorter intervals converge faster but spend more bandwidth. Lower fanout is cheaper but increases tail convergence time and makes partitions harder to notice quickly.`,
        `Messages also need versioning. A membership fact is not just "node A is alive." It may carry incarnation numbers, timestamps, suspicion state, or vector-style metadata so nodes can decide which rumor is newer. Without that ordering rule, old gossip can resurrect stale state after the cluster already corrected it.`,
        `Backpressure matters. Gossip is often background control traffic, so it must not flood the data plane during incidents. Many systems cap payload size, piggyback only recent deltas, and run periodic full-state anti-entropy separately from fast rumor spreading.`,
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        `Gossip fits membership hints, failure suspicions, replica state summaries, anti-entropy triggers, peer discovery, and eventually consistent metadata. It pairs well with Merkle trees: gossip can announce that state changed, while a Merkle comparison finds the exact delta.`,
        `It is strongest when approximate, eventually convergent knowledge is enough and the system values decentralized robustness over immediate agreement.`,
        `A concrete membership case is a node joining a Cassandra-like ring. One node hears the join event, gossips it to random peers, and the information spreads until the reachable cluster has a common view. The same cluster may use a stronger protocol elsewhere for committed metadata changes.`,
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        `Gossip is not consensus. It does not give a single committed order, a majority proof, or linearizable reads. Use Raft when the system needs one leader and one ordered log.`,
        `It also does not guarantee delivery by itself. Redundancy and repeated rounds make delivery likely, not absolute. Security-sensitive gossip needs authentication and defenses against spam, equivocation, and malicious peers.`,
        `It can also converge to the wrong social reality if bad information spreads faster than correction. Failure detectors based on gossip must separate "I cannot reach this node" from "the node is definitely dead," because network delay and partition can look like failure from one peer's view.`,
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        `Keep gossip payloads small and explicit. Include fact type, origin, version or incarnation, expiry, and authentication where the threat model requires it. Drop stale rumors deterministically so old packets cannot undo newer state.`,
        `Separate fast dissemination from full repair. Rumor spreading is good at getting fresh facts around quickly; periodic anti-entropy is better at reconciling nodes that missed many rounds, restarted, or returned after a partition.`,
        `Treat failure gossip as suspicion first. A peer that fails a probe may be overloaded, partitioned, or slow. Mature systems use suspicion timers, indirect checks, and incarnation numbers before declaring a member dead.`,
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        `Suppose node 0 learns that node 12 joined a storage ring. It sends that fact to two random peers. Next round, all informed peers do the same. Some messages repeat the fact to peers that already know, but enough fresh contacts happen that the reachable cluster converges after a handful of rounds.`,
        `If three nodes are offline, no special reroute is needed. The update reaches the live nodes through other random contacts. When offline nodes return, anti-entropy or resumed gossip brings them up to date. That is the trade: slower probabilistic convergence in exchange for avoiding a brittle broadcast spine.`,
        `In a real incident, the useful question is not whether every node hears the rumor instantly. It is whether stale views shrink fast enough for the system's tolerance. A storage cluster may accept seconds of membership lag for background repair, while a leader election path must use a stronger protocol.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `For dynamic cluster membership, study SWIM Failure Detector & Membership: it explains how probes, indirect pings, suspicion, and gossip-style dissemination turn rumor spreading into a scalable membership subsystem. Then study Consistent Hashing: gossip tells nodes a peer arrived; Consistent Hashing ensures keys rebalance without touching most data. For verifying gossip state, study Merkle Tree to see how comparison finds deltas in O(log n) space. For formal failure recovery, study Raft Leader Election, which pairs with gossip in many systems (Consul): gossip detects failures, Raft elects a leader to coordinate recovery. For understanding when gossip fails, study CAP Theorem: gossip is partition-tolerant but cannot guarantee consistency or availability simultaneously under splits.`,
      ],
    },
  ],
};
