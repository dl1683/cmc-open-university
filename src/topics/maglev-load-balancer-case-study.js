// Google Maglev case study: a production software network load balancer.
// Packets arrive through ECMP, any Maglev machine can handle them, and a
// precomputed lookup table maps each flow consistently to a backend.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'maglev-load-balancer-case-study',
  title: 'Maglev Load Balancer Case Study',
  category: 'Papers',
  summary: 'Google Maglev as a production systems lesson: stateless packet routing, ECMP fan-in, and consistent backend lookup tables.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['packet path', 'lookup table resilience'], defaultValue: 'packet path' },
  ],
  run,
};

function labelMatrix(title, rowLabels, columnLabels, labelsByRow) {
  const labels = [''];
  const byLabel = new Map();
  const code = (label) => {
    if (!byLabel.has(label)) {
      byLabel.set(label, labels.length);
      labels.push(label);
    }
    return byLabel.get(label);
  };
  return matrixState({
    title,
    rows: rowLabels.map(([id, label]) => ({ id, label })),
    columns: columnLabels.map(([id, label]) => ({ id, label })),
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function topology(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.8, y: 4.1, note: 'flow hash' },
      { id: 'vip', label: 'VIP', x: 2.2, y: 4.1, note: 'service IP' },
      { id: 'ecmp', label: 'ECMP', x: 3.7, y: 4.1, note: 'router fan-out' },
      { id: 'm1', label: 'M1', x: 5.3, y: 2.2, note: 'Maglev' },
      { id: 'm2', label: 'M2', x: 5.3, y: 4.1, note: 'Maglev' },
      { id: 'm3', label: 'M3', x: 5.3, y: 6.0, note: 'Maglev' },
      { id: 'b1', label: 'B1', x: 7.6, y: 2.2, note: 'backend' },
      { id: 'b2', label: 'B2', x: 7.6, y: 4.1, note: 'backend' },
      { id: 'b3', label: 'B3', x: 7.6, y: 6.0, note: 'backend' },
    ],
    edges: [
      { id: 'e-client-vip', from: 'client', to: 'vip', weight: 'packet' },
      { id: 'e-vip-ecmp', from: 'vip', to: 'ecmp', weight: 'any Maglev' },
      { id: 'e-ecmp-m1', from: 'ecmp', to: 'm1', weight: 'hash' },
      { id: 'e-ecmp-m2', from: 'ecmp', to: 'm2', weight: 'hash' },
      { id: 'e-ecmp-m3', from: 'ecmp', to: 'm3', weight: 'hash' },
      { id: 'e-m1-b1', from: 'm1', to: 'b1', weight: 'lookup' },
      { id: 'e-m2-b2', from: 'm2', to: 'b2', weight: 'lookup' },
      { id: 'e-m3-b3', from: 'm3', to: 'b3', weight: 'lookup' },
      { id: 'e-m2-b1', from: 'm2', to: 'b1', weight: 'same table' },
      { id: 'e-m2-b3', from: 'm2', to: 'b3', weight: 'same table' },
    ],
  }, { title });
}

function* packetPath() {
  yield {
    state: topology('Maglev packet path'),
    highlight: { active: ['client', 'vip'], compare: ['ecmp'] },
    explanation: 'This frame shows the packet-speed path. A packet targets a virtual IP, routers use ECMP to choose a Maglev machine, and that machine uses the shared lookup table to choose a backend. The system avoids per-packet central coordination.',
  };

  yield {
    state: topology('ECMP chooses one Maglev machine'),
    highlight: { active: ['e-client-vip', 'e-vip-ecmp', 'e-ecmp-m2', 'm2'], visited: ['m1', 'm3'] },
    explanation: 'The router does not need to know backend health or application state. It only spreads packets across Maglev machines. That makes the frontend horizontally scalable: add more Maglev servers and ECMP spreads the packet processing work. The Maglev machine then performs the service-specific backend choice.',
    invariant: 'Routers choose a Maglev machine; Maglev chooses a backend.',
  };

  yield {
    state: topology('Maglev picks a backend by table lookup'),
    highlight: { found: ['m2', 'b2', 'e-m2-b2'], compare: ['e-m2-b1', 'e-m2-b3'] },
    explanation: 'Maglev hashes the flow tuple into a precomputed lookup table and forwards to the selected backend. The goal is fast and deterministic: packets from the same connection keep going to the same backend while traffic spreads across healthy backends. Hash Table speed meets Consistent Hashing stability.',
  };
}

function* lookupTableResilience() {
  yield {
    state: labelMatrix(
      'A toy Maglev lookup table',
      [
        ['slot0', 'slot 0'],
        ['slot1', 'slot 1'],
        ['slot2', 'slot 2'],
        ['slot3', 'slot 3'],
        ['slot4', 'slot 4'],
        ['slot5', 'slot 5'],
        ['slot6', 'slot 6'],
      ],
      [
        ['before', 'before B2 fails'],
        ['after', 'after B2 fails'],
        ['moved', 'moved?'],
      ],
      [
        ['B1', 'B1', 'no'],
        ['B2', 'B3', 'yes'],
        ['B3', 'B3', 'no'],
        ['B1', 'B1', 'no'],
        ['B2', 'B1', 'yes'],
        ['B3', 'B3', 'no'],
        ['B2', 'B1', 'yes'],
      ],
    ),
    highlight: { removed: ['slot1:before', 'slot4:before', 'slot6:before'], found: ['slot0:moved', 'slot2:moved', 'slot3:moved', 'slot5:moved'] },
    explanation: 'The lookup table is built so backend removals move only the affected slots as much as practical. When B2 fails, B1 and B3 keep many of their previous slots. That preserves connection affinity and avoids a full traffic reshuffle. This is the same stability instinct as Consistent Hashing, engineered for fast packet lookup.',
    invariant: 'Backend churn should not reshuffle healthy flows unnecessarily.',
  };

  yield {
    state: labelMatrix(
      'Why Maglev is a systems composition',
      [
        ['speed', 'packet speed'],
        ['scale', 'scale-out'],
        ['affinity', 'connection affinity'],
        ['failure', 'failure handling'],
        ['ops', 'operations'],
      ],
      [
        ['mechanism', 'mechanism'],
        ['site_link', 'site link'],
      ],
      [
        ['precomputed table lookup', 'Hash Table'],
        ['ECMP to many Maglev machines', 'Load Balancer'],
        ['flow hash stays stable', 'Consistent Hashing'],
        ['health checks plus table rebuild', 'Circuit Breakers & Deadlines'],
        ['watch p99 and packet drops', 'Tail Latency & p99 Thinking'],
      ],
    ),
    highlight: { active: ['speed:mechanism', 'scale:mechanism'], compare: ['failure:mechanism'] },
    explanation: 'The Maglev paper is valuable because it is not one algorithm. It is a production architecture: router hashing, commodity servers, kernel bypass concerns, health checks, deterministic lookup, graceful failure, and operations. The best systems pages on this site should feel like this: several simple ideas composed under hard constraints.',
  };

  yield {
    state: topology('Failure: one Maglev or backend can disappear'),
    highlight: { removed: ['m3', 'b2', 'e-ecmp-m3'], found: ['m1', 'm2', 'b1', 'b3'] },
    explanation: 'Two failure loops are separate. If a Maglev machine fails, ECMP stops sending it packets. If a backend fails, all Maglev machines need to rebuild the same table quickly enough that they keep making consistent forwarding choices.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'packet path') yield* packetPath();
  else if (view === 'lookup table resilience') yield* lookupTableResilience();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'The load-balancing problem',
      paragraphs: [
        'Maglev is Google\'s software network load balancer, described in an NSDI 2016 paper. It balances packets for virtual IPs using a fleet of commodity servers rather than a fixed hardware appliance. The problem is harsh: the hot path must process packets at very high speed, preserve connection affinity, react to backend failures, and scale as traffic grows.',
        'The case study matters because it combines simple data structures with serious production constraints. Routers use ECMP to spread packets across Maglev machines. Each Maglev machine maps a flow to a backend using a precomputed lookup table. Health checking and table updates happen off the hot path. The result is a low-level load balancer that is fast because the per-packet decision is almost trivial.',
      ],
    },
    {
      heading: 'The naive designs and their walls',
      paragraphs: [
        'The first naive design is a single hardware appliance in front of the service. It can be fast, but it is expensive, capacity-limited, and a painful failure boundary. Scaling traffic means buying and operating specialized boxes. The second naive design is to let every frontend choose a backend independently. That spreads responsibility but creates inconsistent routing, weak health handling, and poor connection affinity.',
        'Another tempting design is to hash directly from a flow to a backend list. That is simple until backends change. If adding or removing one backend reshuffles most flows, connection affinity is destroyed and healthy backends see sudden churn. A production load balancer needs both fast lookup and minimal disruption when the backend set changes.',
        'Maglev solves this with a shared deterministic table. Every Maglev machine serving the same VIP builds the same table from the same backend set. A packet can arrive at any Maglev machine, and the same flow tuple maps to the same backend as long as the table is consistent.',
      ],
    },
    {
      heading: 'Core Insight and Mechanism',
      paragraphs: [
        'A client sends packets to a service virtual IP. Network routers use ECMP to choose one Maglev machine. That Maglev machine hashes the packet\'s flow tuple and indexes a lookup table. The table entry names a backend. The packet is forwarded there. The hot path is deliberately small: parse enough header data, hash, array lookup, rewrite or encapsulate, and forward.',
        'The core insight is to make every Maglev machine interchangeable for a VIP without replicating per-flow state. Shared deterministic table construction replaces a centralized flow owner. Any machine can receive the packet, recompute the same slot, and forward to the same backend as long as its table version matches the rest of the fleet.',
        'The lookup table is generated from backend-specific permutations. The construction tries to spread table slots evenly across backends while minimizing disruption when the set changes. If a backend disappears, slots that belonged to it are reassigned, but many other slots stay stable. This gives Maglev the fast lookup of an array and some of the churn-reduction behavior associated with consistent hashing.',
        'The split between ECMP and Maglev is important. ECMP chooses a load-balancer machine, not the final service backend. Maglev chooses the backend. That lets the network remain simple while the load-balancer fleet owns service-specific health and routing policy.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Maglev works because it moves expensive decisions off the packet path. Health checking, backend-set updates, table construction, and configuration distribution can run outside the forwarding loop. The forwarding loop uses a precomputed table. That is a classic systems move: spend more work ahead of time so the hot path is predictable and cheap.',
        'It also works because the table is deterministic. If every Maglev machine has the same backend set and algorithm, any machine can handle any packet for a VIP and still choose the same backend for the same flow. That avoids per-flow state replication across the load-balancer fleet.',
        'The correctness invariant is table agreement. Connection affinity holds only while machines responsible for a VIP share the same table version or converge through a controlled transition. The forwarding step is simple, but the control plane has to keep version skew, stale health data, and partial rollouts from turning deterministic lookup into deterministic misrouting.',
        'The architecture scales horizontally because the load balancers are commodity servers. Adding Maglev machines increases frontend packet capacity. Adding backends increases service capacity. The price is operational: the fleet must agree on config, converge after failures, and expose enough observability to detect bad health signals or table churn.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'Maglev fits low-level network load balancing where packet speed, flow affinity, and fleet scale matter. It is not an HTTP router that chooses a backend based on path, headers, or request body. It sits lower in the stack, where the key decision is which backend should receive packets for this flow.',
        'The transferable pattern is broader: stateless frontend workers, deterministic flow-to-backend mapping, commodity-server scale-out, and health-driven routing updates. CDNs, API gateways, service meshes, edge platforms, and L4 load balancers all use variations of this split between distribution, health, and deterministic mapping.',
        'Maglev is also a useful contrast with Jump Consistent Hash and Rendezvous Hashing. Jump stores almost no table but assumes numbered buckets. Rendezvous scores candidates. Maglev pays table memory to make packet lookup extremely cheap. Different data structures win in different hot paths.',
      ],
    },
    {
      heading: 'Limits and Failure Modes',
      paragraphs: [
        'A lookup table alone does not make a reliable load balancer. The hard production work is health detection, configuration convergence, overload behavior, observability, and rollback when a bad backend set ships. If different Maglev machines disagree about backend health, deterministic lookup can make each machine consistently wrong in a different way.',
        'Health checks can lie. A backend may pass a shallow check while failing real traffic. A failure detector may remove too many backends and overload the survivors. A table update can create churn or imbalance. A load balancer must be judged under failure, not only by its clean hash lookup.',
        'Another misconception is that Maglev is an application load balancer. It does not understand business routing or HTTP semantics. That is a feature for its layer: the less it does per packet, the faster and more predictable it can be.',
      ],
    },
    {
      heading: 'A worked packet path',
      paragraphs: [
        'A packet for a VIP reaches a router. ECMP picks one Maglev machine from the load-balancer fleet. The Maglev machine extracts the flow tuple, hashes it, and indexes the service table. Suppose slot 17 maps to backend B. Every packet in that flow that lands on any Maglev machine with the same table should map to B. If B fails, health updates rebuild the table and only the affected slots move as much as necessary.',
        'This example shows the division of labor. Routers spread load across load balancers. Maglev machines make deterministic backend choices. Health and configuration systems maintain the table. Backends serve the actual application. The user-visible reliability depends on all four layers, not only on the lookup array.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'A Maglev-style deployment should measure table version agreement across the fleet, backend health-state churn, packets per second per load balancer, flow distribution skew, backend imbalance, dropped packets, failover time, and the fraction of flows remapped after a backend-set change. These signals show whether the deterministic mapping is stable in practice.',
        'The hardest bugs are often control-plane bugs, not hash bugs. A bad health check can remove healthy backends. A delayed config rollout can split the fleet across table versions. A backend overload policy can shift traffic to machines that are already near failure. The table lookup is simple because the surrounding system absorbs that complexity.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Maglev is a lesson in hot-path design. Precompute a stable mapping, keep the packet path tiny, make every frontend stateless with respect to flows, and handle health and configuration outside the forwarding loop. The data structure is not the whole system, but it makes the system possible.',
        'The useful comparison is an L7 proxy. An application proxy can inspect routes, headers, identity, and retries, but it pays more per request. Maglev stays lower in the stack, so its power comes from doing less work with stronger packet-path discipline.',
        'In a course sequence, teach Maglev after hash tables and consistent hashing, then compare it with circuit breakers and backpressure. The routing function is simple; the production value comes from connecting it to failure detection and overload control.',
        'The practical test is whether the forwarding decision must be made per packet with minimal state. If yes, precomputed deterministic tables are attractive. If the decision needs request semantics, a higher-level proxy belongs in the path.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: "Maglev: A Fast and Reliable Software Network Load Balancer" at https://research.google.com/pubs/archive/44824.pdf, with Google Cloud background at https://cloud.google.com/blog/products/gcp/google-shares-software-network-load-balancer-design-powering-gcp-networking. Study Load Balancer, Consistent Hashing, Jump Consistent Hash Case Study, Rendezvous Hashing (HRW), Hash Table, CDN Request Flow, Tail Latency & p99 Thinking, Circuit Breakers & Deadlines, and Backpressure & Flow Control next.',
      ],
    },
  ],
};
