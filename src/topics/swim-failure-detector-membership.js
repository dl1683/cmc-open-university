// SWIM membership: randomized probes plus gossip-style dissemination.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'swim-failure-detector-membership',
  title: 'SWIM Failure Detector & Membership',
  category: 'Systems',
  summary: 'A scalable membership protocol: probe one peer, ask helpers for indirect pings, move through suspect states, and gossip membership changes.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['probe protocol', 'suspicion gossip'], defaultValue: 'probe protocol' },
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

function swimCluster(title) {
  return graphState({
    nodes: [
      { id: 'a', label: 'A', x: 0.9, y: 4.0, note: 'prober' },
      { id: 'b', label: 'B', x: 3.0, y: 1.6, note: 'helper' },
      { id: 'c', label: 'C', x: 3.0, y: 6.4, note: 'helper' },
      { id: 'd', label: 'D', x: 5.1, y: 4.0, note: 'target' },
      { id: 'e', label: 'E', x: 7.2, y: 2.0, note: 'member' },
      { id: 'f', label: 'F', x: 7.2, y: 6.0, note: 'member' },
      { id: 'view', label: 'views', x: 9.1, y: 4.0, note: 'membership' },
    ],
    edges: [
      { id: 'e-a-d', from: 'a', to: 'd', weight: '' },
      { id: 'e-a-b', from: 'a', to: 'b', weight: '' },
      { id: 'e-a-c', from: 'a', to: 'c', weight: '' },
      { id: 'e-b-d', from: 'b', to: 'd', weight: '' },
      { id: 'e-c-d', from: 'c', to: 'd', weight: '' },
      { id: 'e-d-a', from: 'd', to: 'a', weight: '' },
      { id: 'e-d-b', from: 'd', to: 'b', weight: '' },
      { id: 'e-d-c', from: 'd', to: 'c', weight: '' },
      { id: 'e-e-view', from: 'e', to: 'view', weight: '' },
      { id: 'e-f-view', from: 'f', to: 'view', weight: '' },
    ],
  }, { title });
}

function* probeProtocol() {
  yield {
    state: swimCluster('Each period probes one target'),
    highlight: { active: ['a', 'd', 'e-a-d'], compare: ['b', 'c'] },
    explanation: 'SWIM avoids all-to-all heartbeats. In each protocol period, a node probes one peer from its membership list. If the peer answers, the detector learned enough for this period.',
    invariant: 'Per-node message load stays roughly constant as the cluster grows.',
  };

  yield {
    state: swimCluster('No direct ACK: ask helpers to probe indirectly'),
    highlight: { active: ['a', 'b', 'c', 'd', 'e-a-b', 'e-a-c', 'e-b-d', 'e-c-d'], compare: ['e-a-d'] },
    explanation: 'A missed direct ping might be a bad network path from A to D, not a failed D. SWIM asks a few helpers to ping D. That outsourced heartbeat reduces false failure detection caused by one bad link.',
  };

  yield {
    state: swimCluster('Indirect ACK clears the suspicion'),
    highlight: { active: ['d', 'b', 'c', 'e-d-b', 'e-d-c'], found: ['a'], compare: ['view'] },
    explanation: 'If D answers one helper, A can treat D as alive. The key idea is not majority voting; it is probabilistic path diversity with tiny message cost.',
  };

  yield {
    state: labelMatrix(
      'Failure detector states',
      [
        { id: 'alive', label: 'alive' },
        { id: 'miss', label: 'missed ping' },
        { id: 'suspect', label: 'suspect' },
        { id: 'failed', label: 'failed' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'next', label: 'next action' },
      ],
      [
        ['recent ACK', 'continue probing'],
        ['no direct ACK', 'ask helpers'],
        ['no indirect ACK yet', 'gossip suspicion'],
        ['timeout elapsed', 'gossip failure'],
      ],
    ),
    highlight: { active: ['miss:next', 'suspect:next'], found: ['failed:meaning'] },
    explanation: 'Many implementations use a suspect state before final failure. That grace period lets a slow node refute suspicion with a newer alive message, reducing false positives.',
  };

  yield {
    state: swimCluster('Membership changes ride on probe traffic'),
    highlight: { active: ['e', 'f', 'view', 'e-e-view', 'e-f-view'], found: ['a', 'b', 'c'] },
    explanation: 'SWIM separates failure detection from dissemination, then composes them: probe messages can piggyback membership updates. The cluster converges without a coordinator or a full broadcast tree.',
  };
}

function* suspicionGossip() {
  yield {
    state: labelMatrix(
      'Membership records need incarnation numbers',
      [
        { id: 'old', label: 'D alive@7' },
        { id: 'sus', label: 'D suspect@7' },
        { id: 'refute', label: 'D alive@8' },
        { id: 'fail', label: 'D failed@7' },
      ],
      [
        { id: 'wins', label: 'wins over' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['older records', 'same node, same status'],
        ['alive@7', 'stronger suspicion'],
        ['suspect@7', 'newer incarnation'],
        ['suspect@7 after timeout', 'no refutation'],
      ],
    ),
    highlight: { active: ['sus:wins', 'refute:wins'], found: ['refute:reason'] },
    explanation: 'A node can refute a suspicion by advertising a newer incarnation of itself. This turns membership state into an ordered record instead of a shouting match between stale gossip messages.',
  };

  yield {
    state: swimCluster('A suspects D and gossips the suspicion'),
    highlight: { active: ['a', 'd', 'view', 'e-e-view', 'e-f-view'], compare: ['b', 'c'] },
    explanation: 'Suspicion is intentionally weaker than failure. It spreads the warning so other nodes can help observe D, but it gives D time to prove it is alive.',
  };

  yield {
    state: swimCluster('D refutes by publishing alive with a newer incarnation'),
    highlight: { active: ['d', 'view', 'e-d-a', 'e-d-b', 'e-d-c'], found: ['a', 'b', 'c'] },
    explanation: 'If D is merely slow, it can send an alive update with a higher incarnation. Receivers keep the newer record and drop the stale suspicion.',
  };

  yield {
    state: labelMatrix(
      'Why SWIM scales better than naive heartbeats',
      [
        { id: 'central', label: 'central monitor' },
        { id: 'all', label: 'all-to-all' },
        { id: 'swim', label: 'SWIM' },
      ],
      [
        { id: 'load', label: 'per-node load' },
        { id: 'weakness', label: 'weakness' },
      ],
      [
        ['monitor hot spot', 'single authority fails'],
        ['grows with cluster', 'message storm'],
        ['constant-ish probes', 'probabilistic delay'],
      ],
    ),
    highlight: { active: ['swim:load'], compare: ['central:weakness', 'all:load'] },
    explanation: 'SWIM trades immediate global certainty for stable local work. That is the correct trade when membership is large, changing, and already probabilistic under packet loss.',
  };

  yield {
    state: swimCluster('Complete case: probe, suspect, refute or fail, disseminate'),
    highlight: { active: ['a', 'd', 'view'], found: ['b', 'c', 'e', 'f'] },
    explanation: 'The complete loop is small: randomly probe, use indirect probes on timeout, mark suspect rather than instantly failed, use incarnation numbers to refute stale suspicion, and gossip the final membership view.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'probe protocol') yield* probeProtocol();
  else if (view === 'suspicion gossip') yield* suspicionGossip();
  else throw new InputError('Pick a SWIM view.');
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        'Distributed systems need to know which peers are probably alive. Storage replicas need to route around failed nodes. Service discovery needs to remove dead instances. Actor runtimes and cluster managers need a shared enough view of who is in the group.',
        'That sounds simple until the cluster grows. Machines pause for garbage collection, links drop packets, queues fill, and partitions make healthy nodes unreachable from only part of the network. There is no perfect failure detector in an asynchronous distributed system, so membership protocols have to trade certainty, speed, cost, and false positives.',
        'SWIM exists for large, changing clusters where every node should do roughly constant work instead of sending heartbeats to every other node.',
      ],
    },
    {
      heading: 'The Obvious Approach and Its Wall',
      paragraphs: [
        'The obvious design is all-to-all heartbeats: every node periodically pings every other node. That gives direct evidence, but message load grows with cluster size. A hundred nodes is manageable. Thousands of nodes turn heartbeat traffic into background noise that competes with the real workload.',
        'A central monitor reduces the message count, but it creates a hot spot and a single authority for failure decisions. If the monitor is slow, isolated, or wrong, the cluster inherits that mistake.',
        'SWIM takes a different bargain. Each node probes only a small number of peers per period, uses indirect probes to reduce false positives, and spreads membership updates through gossip. The result is not instant global truth. It is scalable, probabilistic convergence.',
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        'Separate failure detection from dissemination. Failure detection asks a small local question: can I or a few helpers reach this target during this protocol period? Dissemination asks a different question: how do membership records spread until most live nodes learn them?',
        'That split lets SWIM keep probe traffic small while still spreading updates cluster-wide. Direct probes discover local evidence. Indirect probes add path diversity. Suspicion and incarnation numbers prevent stale gossip from turning temporary slowness into permanent failure.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the probe protocol view, read A as the current prober and D as the target for this period. A first tries a direct ping. If that fails, A asks helpers B and C to ping D. A helper response does not prove D is healthy forever; it only shows that D was reachable through at least one alternate path.',
        'In the suspicion gossip view, focus on the membership record, not just the messages. D suspect@7 and D alive@8 are ordered facts about the same member. The newer incarnation lets D refute stale suspicion. Without that ordering, old gossip could overwrite newer evidence.',
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        'Each node keeps a membership list with records such as alive, suspect, failed, joined, or left. In each protocol period, the node selects one target from the list and sends a ping. If the target replies before the timeout, the detector records it as alive for this period.',
        'If the direct ping times out, the node sends ping-request messages to a small set of helpers. Each helper pings the target and reports back if it receives an acknowledgement. This reduces false positives caused by one bad route, one congested queue, or one unlucky packet loss between the prober and the target.',
        'If direct and indirect probes fail, many implementations mark the target suspect before declaring it failed. Suspicion is gossiped so the rest of the cluster can observe and react, but the suspected node can refute the claim by advertising an alive record with a higher incarnation number.',
        'Membership updates ride on ordinary protocol traffic. Probe messages carry a small batch of recent updates, and repeated random contact spreads those updates in infection-style gossip.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The probe cost is bounded by configuration rather than cluster size: one direct target and a small helper set per period. As the cluster grows, each node still performs a small amount of work, and random target selection spreads observation across the group over time.',
        'Indirect probes work because network failure is often partial. A failed A-to-D ping could mean D is dead, but it could also mean A is congested, the path from A to D dropped packets, or D was slow for one interval. Asking helpers samples other paths before turning one timeout into a failure record.',
        'Suspicion works because membership records are ordered. A live node can increment its incarnation and publish a newer alive record. Receivers can reject older suspect records instead of letting stale gossip win.',
        'Gossip works because repeated random exchanges make records fan out without a coordinator. The tradeoff is eventual convergence rather than one atomic cluster-wide decision.',
      ],
    },
    {
      heading: 'Worked Case Study',
      paragraphs: [
        'A storage cluster has nodes A through F. A probes D and receives no ACK. Rather than immediately declaring D failed, A asks B and C to probe D. B times out, but C receives an ACK. A treats D as alive for now and avoids moving replicas because one direct path was bad.',
        'Later, D actually crashes. A future prober gets no direct ACK and no helper sees D either. D becomes suspect@7 and that record is gossiped. If D was merely slow, it could return with alive@8 and receivers would prefer the newer incarnation. Because D is gone, no refutation arrives. After the suspicion timeout, failed@7 spreads through the cluster and higher-level systems can rebalance.',
        'The case shows the point of SWIM: do not spend all-to-all traffic to get perfect certainty that the network cannot provide anyway. Spend small, repeated probes to get useful evidence and spread that evidence efficiently.',
      ],
    },
    {
      heading: 'Costs and Tradeoffs',
      paragraphs: [
        'SWIM trades immediate certainty for low steady-state cost. Detection delay depends on probe period, target selection, timeout settings, helper count, packet loss, and suspicion window. Dissemination delay depends on how many updates are piggybacked and how quickly random contact spreads them.',
        'Tuning is the hard part. Timeouts that are too aggressive create false failures during garbage collection pauses, overloaded event loops, or short network stalls. Timeouts that are too slow delay failover and leave dead nodes in routing tables.',
        'Security is also outside the basic protocol. A hostile member can lie about membership records unless messages are authenticated and authorization rules decide who may join, leave, or claim failure.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'SWIM wins for service discovery, distributed caches, storage clusters, actor systems, peer groups, and runtime schedulers where membership is large, changing, and already uncertain under packet loss.',
        'It is a good fit when the system can tolerate brief disagreement and when higher-level components can treat membership as a hint that becomes stronger as gossip converges.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'SWIM fails as a consensus substitute. It does not give a linearizable membership view, a globally ordered log, or a single authoritative decision about who owns a resource. If a decision needs fencing, leader election, or exactly-once ownership transfer, use a stronger protocol above membership.',
        'It also struggles under long partitions and correlated pauses. Two sides of a partition may each mark the other failed. A group of nodes paused by the same runtime or overloaded host can look dead even though they later resume. Suspicion helps, but it does not repeal the limits of distributed failure detection.',
      ],
    },
    {
      heading: 'Sources and Study Next',
      paragraphs: [
        'Primary source: Das, Gupta, and Motivala, "SWIM: Scalable Weakly-consistent Infection-style Process Group Membership Protocol": https://www.cs.cornell.edu/projects/Quicksilver/public_pdfs/SWIM.pdf. ACM entry: https://dl.acm.org/doi/10.5555/647883.738420. Study Gossip Protocol, Consistent Hashing, Dynamo Case Study, Cassandra Repair Case Study, Raft Leader Election, and Read/Write Quorums next.',
      ],
    },
  ],
};
