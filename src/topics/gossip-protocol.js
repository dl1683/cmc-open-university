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
      heading: 'What it is',
      paragraphs: [
        `Gossip protocols are a decentralized pattern for spreading information across a cluster by mimicking how rumors propagate: each round, every informed node picks two random peers and tells them. No central coordinator needed, no broadcast tree, no special roles. The protocol tolerates arbitrary dead nodes, lost messages, and Byzantine peers with zero failure-handling code — routing inherently works around them because no path is privileged.`,
        `The name comes directly from epidemiology: nodes are hosts, information is a virus, spreading is exponential. Mathematicians proved that if each host infects k peers per round, saturation happens in O(log n) rounds regardless of cluster size. For the standard gossip protocol (k=2), a 1-million-node cluster converges in about log₂(1,000,000) ≈ 20 rounds.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start: Node n₀ learns a fact. Round 1: n₀ picks two random neighbors and sends the fact to each. Round 2: all three informed nodes each pick two random neighbors and send. The informed population roughly doubles each round. Most messages hit nodes that already know (redundant), but that redundancy is intentional — it masks lost packets and dead nodes.`,
        `Dead nodes are handled for free. If a node is offline when n₁ tries to reach it, n₁'s message is dropped (no retry logic needed). Meanwhile, n₂ and n₃ both reached online neighbors, so the information kept spreading. The randomness of peer selection ensures that no single path is critical; dozens of parallel paths exist. Cassandra uses this: each node runs the gossip state machine at 1 Hz (one round per second), so membership changes are known cluster-wide in 5–10 seconds with no heartbeat to a master.`,
        `The protocol's simplicity masks its power. Constant per-node load: each node sends 2 messages per round, regardless of cluster size. A 10,000-node cluster imposes the same local work as a 100-node cluster. No load balancing, no congestion control, no coordination — the randomness and exponential spread handle all the heavy lifting.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Message overhead: ~2 messages per node per round, exponential spread to O(log n) rounds = O(log n) messages per node total. Compare to full mesh (every node tells every other node), which is O(n²) messages. Latency to saturation: O(log n) rounds, or 5–20 seconds for typical clusters. Memory: O(1) per node; gossip doesn't track who has been told. CPU: trivial — picking two random peers and sending bytes is cheap.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Cassandra uses gossip for membership discovery and token-ring state: when a node joins or leaves, all nodes learn via gossip within seconds. Consul and Serf build failure detection on top: nodes gossip suspicions about peer health, allowing the cluster to agree on who is alive without a master. Bitcoin and Ethereum flood transactions via gossip: when you broadcast a transaction, it propagates to the whole network exponentially.`,
        `DynamoDB, Riak, and Voldemort use gossip for replica state exchange. Merkle Tree digests pair with gossip to form anti-entropy: gossip announces "my state changed," then a Merkle Tree comparison identifies exactly which items differ, and only those are synced. Without the tree, you would need to send every item; with it, you send only the delta. The combination scales to petabytes of state.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Myth: "Gossip is slow." Reality: O(log n) rounds scales beautifully; 20 rounds to 1M nodes is not slow for state convergence. Myth: "Gossip wastes bandwidth on redundant messages." Reality: redundancy is the fault tolerance. Removing it trades bandwidth for fragility. Myth: "Gossip cannot guarantee delivery." Reality: it doesn't guarantee—and that is intentional. Delivery guarantees require acknowledgments, which would kill the simplicity. Instead, gossip assumes repeated re-execution (run at 1 Hz forever), so "eventually" everything is delivered with overwhelming probability.`,
        `The hardest misconception: that gossip protocols are "fire and forget." They are not. The typical implementation runs continuously—Cassandra's gossip runs at 1 Hz—so the protocol re-informs nodes periodically. This means a node can learn the same fact multiple times, but that repetition is what makes the protocol robust.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `For dynamic cluster membership, study Consistent Hashing: gossip tells nodes a peer arrived; Consistent Hashing ensures keys rebalance without touching most data. For verifying gossip state, study Merkle Tree to see how comparison finds deltas in O(log n) space. For formal failure recovery, study Raft Leader Election, which pairs with gossip in many systems (Consul): gossip detects failures, Raft elects a leader to coordinate recovery. For understanding when gossip fails, study CAP Theorem: gossip is partition-tolerant but cannot guarantee consistency or availability simultaneously under splits.`,
      ],
    },
  ],
};

