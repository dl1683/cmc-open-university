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
    explanation: `Node 0 just learned something the whole cluster needs — a new member joined, a node died, a config changed. The naive plans both fail at scale: a central broadcaster is a bottleneck and a single point of failure; full mesh (everyone tells everyone) is n² messages. GOSSIP copies epidemiology instead: each round, every node that knows tells TWO peers chosen at random. That\'s the entire protocol.${degraded ? ' (And three nodes are dead — watch how little that matters.)' : ''}`,
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
    // deterministic rescue: a real protocol\'s randomness makes stalls vanishingly
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
      heading: 'How to read the animation',
      paragraphs: [
        'Green ("found") nodes already know the rumor. Orange ("active") nodes just learned it this round. Gray ("swap") nodes are offline. Edges show the messages sent in the current round.',
        'Each frame is one gossip round. Watch the informed set grow: round 1 has 1 sender reaching 2 peers; round 2 has 3 senders reaching up to 6 new peers. The doubling pattern is the protocol\'s core mechanism.',
        {type: 'callout', text: 'Gossip trades exact delivery paths for repeated random exposure, so no single sender, edge, or schedule becomes load bearing.'},
        'Redundant messages (hitting an already-informed node) are visible as edges into green nodes. They look wasteful, but they are the reason the protocol tolerates failures: every path is disposable because another path exists.',
        'Switch to the "3 nodes offline" view and watch gossip route around the dead nodes without any failure-handling code. No edge was ever essential.',
        {type: 'image', src: './assets/gifs/gossip-protocol.gif', alt: 'Animated walkthrough of the gossip protocol visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A cluster of 1,000 nodes needs every member to learn that node 847 just died. The information must spread in seconds, survive packet loss and concurrent failures, and not overload any single node. This is the dissemination problem: getting one fact to n nodes reliably under real network conditions.',
        'The problem recurs everywhere clusters exist: membership changes, schema updates, leader elections, token-ring rebalancing, configuration pushes, and failure suspicions all require cluster-wide propagation without a single coordinator bottleneck.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is a central broadcaster: one designated node sends the update to every other node. This converges in one round and is simple to implement. Small clusters run this way without issue.',
        'The second instinct is a broadcast tree: organize nodes into a spanning tree and fan the message out level by level. This reduces duplicate messages from O(n) per node to O(1) and converges in O(log n) levels.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The central broadcaster fails in two ways. First, one node sends n-1 messages per update -- at 1,000 nodes with frequent events, the broadcaster becomes a throughput bottleneck. Second, if the broadcaster dies, dissemination stops entirely. A single point of failure in the system whose job is to announce failures.',
        'The broadcast tree fixes fanout but introduces fragility. If an internal tree node dies, its entire subtree is cut off. Repairing the tree requires detecting the failure (the very problem gossip solves) and rebuilding the topology. Under churn -- nodes joining, leaving, crashing -- the tree is constantly broken.',
        'The wall is that any fixed dissemination structure couples correctness to topology. When topology changes are the thing being disseminated, the structure cannot depend on the information it is trying to spread.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Replace one planned path with many random, redundant, disposable paths. Each round, every informed node picks k peers at random and sends the rumor. Most of those messages are redundant. That redundancy is the point.',
        'The invariant is not exactly-once delivery. It is repeated probabilistic exposure. No single message matters. No single path matters. The protocol works because the expected number of fresh contacts per round exceeds 1 until saturation, so the informed population grows exponentially despite wasted messages, lost packets, and dead nodes.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows connecting nodes', caption: 'A directed graph makes the disposable-path idea visible: gossip correctness comes from many possible contacts rather than one fixed route. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A node learns a fact (a membership change, a failure suspicion, a config update). It marks the fact as "hot" -- eligible for gossip. Each round on a fixed timer (typically 1 second), the node selects k peers uniformly at random from its membership list and sends all hot facts. Recipients merge the incoming facts with their own state, mark new facts as hot, and begin spreading them in the next round.',
        'Facts expire. A node stops gossiping a fact after it has sent it enough times (a configurable "infection count") or after a TTL expires. Without expiration, old facts consume bandwidth indefinitely. With expiration, the protocol becomes self-limiting: each fact spreads, saturates, and then disappears from the gossip stream.',
        'Message versioning prevents stale facts from overwriting newer ones. Each fact carries a version (incarnation number, timestamp, or logical clock). When a node receives a fact older than its current state, it drops it. When it receives a newer fact, it adopts it and marks it hot. This ordering rule is what prevents a restarted node from resurrecting a dead membership entry the cluster already removed.',
        'Three variants exist. In push gossip, informed nodes send to random peers -- fast early when most targets are fresh, slow near saturation. In pull gossip, uninformed nodes periodically ask random peers what they know -- slow early but fast near saturation because most peers have the fact. Push-pull combines both: each round a node sends what it knows and asks what the peer knows, covering both phases. Most production systems use push-pull.',
        'Anti-entropy runs separately. Periodically, two nodes exchange full state digests (often Merkle tree hashes) and reconcile differences. This catches facts that rumor spreading missed -- nodes that were down during the rumor, network partitions that isolated a subset, or facts that expired before reaching everyone.',
        'The SWIM protocol (Das, Gupta, Muthukrishnan, 2002) extends this by combining failure detection with gossip dissemination. Each round, a node pings one random peer. If no response comes, the node asks k_indirect other random peers to ping the suspect (indirect ping). If all indirect pings also fail, the node marks the suspect as "suspect" and starts a suspicion timer. If the suspect responds before the timer expires, it increments its incarnation number to refute future stale suspicions. If the timer expires, the node declares the suspect dead. The key trick: every ping, ping-req, and ack message piggybacks a small buffer of recent membership changes, so failure detection traffic carries dissemination for free.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Gossip borrows directly from mathematical epidemiology. The SIR (Susceptible-Infected-Removed) model maps cleanly onto gossip: uninformed nodes are susceptible, informed nodes actively spreading are infected, and nodes that stop spreading after enough rounds are removed. Demers et al. (1987) formalized this analogy.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Diagram_of_SIR_epidemic_model_states_and_transition_rates.svg/250px-Diagram_of_SIR_epidemic_model_states_and_transition_rates.svg.png', alt: 'SIR epidemic state diagram with susceptible infected and removed states', caption: 'The SIR state machine is the epidemiology analogue behind rumor spreading: susceptible nodes become active spreaders, then leave the active set. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Diagram_of_SIR_epidemic_model_states_and_transition_rates.svg'},
        'Let I(t) be the fraction of informed nodes at round t. With fanout k, the growth follows approximately dI/dt = k * I * (1 - I). This is the logistic equation. Early on, I is small and growth is exponential: each round roughly multiplies informed nodes by k. Near saturation, most contacts hit already-informed nodes, so growth slows. The crossover happens around I = 0.5. The first half of the cluster learns fast; the last few nodes take disproportionately long.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/SIR_trajectory.png/500px-SIR_trajectory.png', alt: 'SIR trajectory curves showing susceptible infected and removed populations over time', caption: 'The SIR trajectory shows the same shape gossip systems exhibit: fast middle growth and a slow tail near saturation. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:SIR_trajectory.png'},
        'Concretely: with n = 1,024 nodes and fanout 2, log_2(1024) = 10 rounds suffice for near-complete coverage. With n = 1,000,000, about 20 rounds. Doubling the cluster adds one round. This is the O(log n) convergence guarantee.',
        'Fault tolerance is structural, not engineered. Suppose 10% of nodes are dead. Each gossip contact has a 10% chance of hitting a dead node, but the remaining 90% of contacts still succeed. The informed population still grows exponentially, just with effective fanout k * 0.9 instead of k. Convergence takes slightly more rounds but the protocol never notices the failures. No rerouting, no tree repair, no failure detection prerequisite.',
        'The probabilistic guarantee is not absolute. There is a nonzero probability that some node is never contacted. With fanout 2, the probability that a specific node is missed after c * log(n) rounds decreases as 1/n^c. Choosing c = 3 (three times the minimum rounds) makes the miss probability negligible for practical cluster sizes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Per-node cost per round: k messages sent, at most k messages received (in expectation). This is O(1) -- independent of cluster size. A node in a 100-node cluster and a node in a 100,000-node cluster do the same amount of work each round.',
        'Total messages to saturate: O(n * log n). Each of n nodes gossips for O(log n) rounds, sending k messages per round. With k = 2 and n = 1,000, that is roughly 20,000 messages total. Full broadcast would use 999,000 (n * (n-1)). The savings grow with cluster size.',
        'Latency: O(log n) rounds times the gossip interval. With a 1-second interval and 1,000 nodes, convergence takes about 10 seconds. This is acceptable for membership and configuration but far too slow for transaction ordering or leader election.',
        'Bandwidth: each message carries the hot fact payload. Piggybacking multiple facts into one gossip message amortizes overhead. Cassandra gossip messages carry the full endpoint state (~200 bytes per node) and cap at a few kilobytes. SWIM-style protocol messages (used by Serf) stay under 1 KB.',
        'The tail cost dominates. The last 1-5% of nodes may take 2-3x longer than the median node to learn a fact. Production systems track "convergence percentile" -- how many rounds until 99% or 99.9% of nodes know -- rather than average convergence. This tail behavior is why anti-entropy sweeps run alongside rumor spreading.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Apache Cassandra: every node gossips its endpoint state (token ownership, load, schema version, data-center membership) once per second. The gossip module maintains a heartbeat version per endpoint. When a node receives a gossip digest with a higher version than its local state, it requests the full endpoint state. This is how Cassandra nodes learn about new joiners, decommissions, and schema changes without any central coordinator. Gossip feeds the token ring, which uses consistent hashing to map keys to responsible nodes.',
        'HashiCorp Serf: implements the SWIM protocol with protocol-aware extensions (Lifeguard, suspicion subgroups). Serf is a standalone membership and event-broadcast library. Nodes join by contacting any existing member; SWIM probes and gossip handle the rest. Serf is the foundation of Consul\'s membership and service-discovery layer.',
        'HashiCorp Consul: uses Serf for the LAN gossip pool within a data center and a separate WAN gossip pool across data centers. LAN gossip detects server and client failures. WAN gossip connects Consul servers across regions. On top of gossip, Consul runs Raft for leader election and consistent key-value storage -- gossip handles "who is alive," Raft handles "what is agreed."',
        'Bitcoin and Ethereum: transaction and block propagation use a gossip-like flooding protocol. When a node receives a new transaction, it announces the transaction hash to its peers; peers that do not have it request the full transaction. This is pull-on-push: push the existence, pull the content. The protocol tolerates node churn, network partitions, and adversarial peers by relying on redundant paths.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Gossip is not consensus. It cannot produce a single agreed-upon ordering of events, a majority vote, or a linearizable read. If the system needs "all nodes agree on the current leader," gossip can detect that the old leader is dead, but Raft or Paxos must elect the new one.',
        'Convergence is eventual, not bounded. The O(log n) guarantee is probabilistic. In adversarial network conditions (targeted partitions, correlated failures), convergence can stall. A network split that isolates a group of nodes will leave that group uninformed indefinitely -- gossip has no mechanism to bridge a partition.',
        'Stale state is a real hazard. If a node restarts with old state and begins gossiping, it can reintroduce facts the cluster already superseded. Incarnation numbers mitigate this (SWIM increments incarnation on restart), but the window between restart and first gossip exchange is vulnerable.',
        'Message overhead grows with the number of concurrent facts. If 100 membership changes happen simultaneously, each gossip message must carry all 100 facts or prioritize which to include. Without backpressure, gossip traffic can spike during cluster-wide events (rolling restart, network recovery after partition).',
        'Security is underspecified in the original model. Gossip trusts every message from every peer. A malicious node can inject false membership claims, spam the cluster with fake facts, or selectively drop messages to partition the informed set. Production systems add message authentication (HMAC), encryption (TLS), and rate limiting, but these are bolted on, not inherent to the protocol.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with 8 nodes (A through H). Node A learns that node G crashed. Fanout k = 2.',
        'Round 1: A is the only informed node. A picks 2 random peers: C and F. A sends the rumor to both. Informed set: {A, C, F}. Messages sent: 2. All 2 hit fresh targets. Efficiency: 100%.',
        'Round 2: A, C, and F each pick 2 random peers. A picks D and B -- both fresh, both learn the fact. C picks E and A -- E is fresh and learns; A already knows, so 1 message is redundant. F picks H and C -- H is fresh and learns; C already knows, 1 redundant. Informed set: {A, B, C, D, E, F, H}. Messages sent: 6. Fresh contacts: 4. Redundant: 2. Efficiency: 67%.',
        'Round 3: Seven nodes each pick 2 random peers. Most targets are already informed. G is dead, so all 7 live nodes already know. Saturation reached in 2 rounds for 7 live nodes. Total messages: 8. A full broadcast from A would have sent 7 messages in one round but required A to know the full membership and made A the single bottleneck.',
        'The declining efficiency is the cost of the protocol\'s redundancy, and it is exactly what makes the protocol robust -- every "wasted" message was a backup path that happened not to be needed. In a SWIM-style system, the fact "G is dead" would also piggyback on every ping and ack message, so the 8 nodes would converge even without dedicated gossip rounds.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Demers et al., "Epidemic Algorithms for Replicated Database Maintenance" (1987) -- the foundational paper that formalized gossip as an epidemic dissemination model and analyzed push, pull, and push-pull variants.',
        'Das, Gupta, and Muthukrishnan, "SWIM: Scalable Weakly-consistent Infection-style Process Group Membership Protocol" (2002) -- introduced the combination of randomized failure detection with piggybacked gossip dissemination. The basis for Serf and Consul.',
        'Study SWIM Failure Detector & Membership next for the full probe-suspect-declare lifecycle. Study Consistent Hashing to see what gossip disseminates in storage clusters (token ownership). Study Merkle Tree for how anti-entropy finds the exact differences between two nodes\' state. Study Raft Leader Election for the consensus protocol that gossip systems pair with when they need strong agreement. Study CAP Theorem to understand why gossip chooses availability and partition tolerance at the cost of consistency.',
      ],
    },
  ],
};
