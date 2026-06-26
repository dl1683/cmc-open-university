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
      heading: 'How to read the animation',
      paragraphs: [
        'The packet-path view follows one network flow from router to Maglev machine to backend. A flow is the stable packet identity, usually the source address, destination address, ports, and protocol. Active nodes are doing work now, found nodes already made a stable decision, and compare nodes are checking table agreement or backend health.',
        'The lookup-table view shows the contract that makes the hot path cheap. A virtual IP is the service address clients use, while a backend is one server that can handle the service. The safe inference is simple: if two Maglev machines have the same backend set and table version, the same flow hash lands on the same backend slot.',
        {type:'callout', text:'Maglev keeps the packet path fast by moving service policy into a shared deterministic table built off the hot path.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A large service cannot put all incoming packets through one hardware box. Traffic grows, machines fail, and new backends enter or leave while existing client connections are still active. The load balancer has to preserve flow affinity, which means packets from the same connection should keep reaching the same backend.',
        'Maglev is a software load balancer from Google that attacks this at layer 4, below HTTP routing. Routers spread packets across many Maglev machines using equal-cost multipath routing, and each Maglev machine chooses the final backend. The per-packet decision must be small enough to run millions of times per second.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable approach is a single load-balancing appliance. It can keep one table of flows and make consistent decisions, so it is easy to reason about. It becomes a capacity limit and a failure boundary once the service grows beyond the appliance.',
        'The next approach is direct hashing from a flow to a backend list on every frontend. That removes the appliance, but a backend change can reshuffle most flows if the list changes shape. A backend failure then becomes a connection churn event instead of a small routing repair.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the conflict between stateless scale-out and connection stability. If every load-balancer machine keeps private flow state, the fleet must replicate that state or route each flow back to the same machine. If machines make independent choices, the same client connection can jump backends and break.',
        'Backend churn makes the problem sharper. Removing 1 backend from 100 should not move 99 percent of active flows. A production system needs a lookup that is fast on every packet and stable enough that only a controlled fraction of flows move when membership changes.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Maglev turns the backend decision into a deterministic array lookup. Every Maglev machine for a virtual IP builds the same lookup table from the same backend set. A packet only needs a flow hash, a modulo operation into the table, and one array read.',
        'The table is built off the hot path from backend-specific permutations. Each backend proposes a repeatable order of slots, and the builder fills empty slots until the table is full. The result acts like consistent hashing with a fixed-size table: lookup is constant time, and backend changes mostly affect slots that need repair.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A router first picks a Maglev machine using equal-cost multipath routing. That machine parses enough packet header fields to compute the flow key. It hashes the key, computes an index in the lookup table, reads the backend stored at that index, and forwards the packet.',
        'Health checks and configuration updates run outside that forwarding loop. When the backend set changes, the control plane distributes the new set and each Maglev machine rebuilds the table. Packet processing stays small because the expensive policy work has already been compiled into the table.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on table agreement. If every machine serving the same virtual IP has the same table, any packet for a given flow maps to the same backend no matter which Maglev machine receives it. That gives connection affinity without replicating per-flow state across the load-balancer fleet.',
        'The failure-repair argument is local. When a backend disappears, slots pointing to it must be filled by surviving backends. Slots that already point to healthy backends can stay unchanged, so the system preserves most existing flow assignments while removing the failed target.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The packet-path cost is O(1): parse the flow key, hash it, index an array, and forward. Doubling the number of backends does not add a loop to each packet. The memory cost is O(M), where M is the lookup table size per virtual IP, because the table stores one backend reference per slot.',
        'The rebuild cost is paid when membership changes, not per packet. If the table has 65,537 slots and 100 backends, rebuilding touches table slots and backend permutations once, then packet forwarding returns to one lookup. The behavioral cost is convergence: during a rollout, machines with different table versions can split traffic for the same flow.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Maglev fits layer-4 load balancing for high-volume services where packets must be forwarded quickly and connection affinity matters. It is useful at the edge of a large fleet, in cloud networking, and anywhere a service virtual IP fronts many interchangeable backends. The access pattern is repeated packet lookup, not rich request inspection.',
        'The pattern also appears outside Maglev. Stateless frontends, deterministic mapping, health-driven membership, and off-path table construction are common in CDNs, service meshes, and gateway fleets. The same tradeoff appears whenever a hot path needs one cheap decision while a slower control plane handles policy.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A lookup table does not make health detection correct. A backend can pass a shallow health check while failing real traffic, or a bad detector can remove too many backends and overload the survivors. Deterministic routing will then send packets consistently to the wrong set.',
        'Maglev is also the wrong layer for application decisions. It does not inspect HTTP paths, identities, retries, or business rules. If routing depends on request content, a higher-level proxy belongs in the path even though it costs more per request.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a virtual IP has 4 Maglev machines, 10 backends, and a lookup table with 101 slots. A packet has flow key client 10.0.0.8:53000 to service 10.0.1.7:443 over TCP. The Maglev machine hashes that key to 43, reads table[43], and forwards the packet to backend B6.',
        'Now backend B6 fails and owned 11 of the 101 slots. A new table reassigns those 11 slots to surviving backends while many other slots remain unchanged. A flow mapped to slot 43 moves because its backend failed, but a flow mapped to slot 17 can keep its old backend if that slot already pointed to a healthy server.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the Google paper "Maglev: A Fast and Reliable Software Network Load Balancer" at https://research.google.com/pubs/archive/44824.pdf and the Google Cloud engineering post at https://cloud.google.com/blog/products/gcp/google-shares-software-network-load-balancer-design-powering-gcp-networking. Use these sources for mechanism claims before relying on secondary summaries.',
        'Study Hash Table for constant-time lookup, Consistent Hashing for low-churn membership changes, Rendezvous Hashing and Jump Consistent Hash for alternative mappings, Load Balancer for the broader system role, and Backpressure and Circuit Breakers for overload behavior after routing. Start with the topic that explains the data shape, then move to the production system.',
      ],
    },
  ],
};