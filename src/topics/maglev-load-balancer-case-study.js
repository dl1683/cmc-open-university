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
    explanation: 'Maglev is a software network load balancer. A packet targets a virtual IP. Routers use ECMP to send that packet to one of many Maglev machines. Any Maglev machine can handle it because they all share the same backend lookup table. This is Load Balancer design at packet speed, not request-aware HTTP routing.',
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
    explanation: 'Maglev hashes the flow tuple into a precomputed lookup table and forwards to the selected backend. The goal is fast and deterministic: packets from the same connection must keep going to the same backend, while traffic spreads evenly across healthy backends. Hash Table speed meets Consistent Hashing stability.',
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
    explanation: 'A Maglev machine can fail and ECMP stops sending it packets. A backend can fail and the Maglev machines rebuild their lookup table without it. The reliability story depends on all Maglev machines converging on the same view quickly enough; otherwise the fleet can make inconsistent forwarding decisions.',
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
      heading: `What it is`,
      paragraphs: [
        `Maglev is Google's software network load balancer, described in an NSDI 2016 paper. It balances packets for virtual IPs using a fleet of commodity servers rather than a fixed hardware appliance. Routers use ECMP to spread packets across Maglev machines; each Maglev machine maps a flow to a backend using a precomputed lookup table.`,
        `The case study matters because it shows production systems design as composition. Load Balancer mechanics, Hash Table lookup, Consistent Hashing style stability, health checking, failover, and Tail Latency & p99 Thinking all appear in one architecture.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A client sends packets to a service VIP. Network routers use ECMP to choose one Maglev machine. That Maglev machine computes a hash over the packet's flow tuple and indexes a lookup table. The table entry names a backend. Because every Maglev machine for a service builds the same lookup table, any machine can process a packet and still choose the same backend for the same flow.`,
        `The lookup table is generated from backend-specific permutations. The construction tries to spread slots evenly while minimizing disruption when backends change. If a backend disappears, only affected slots should move as much as possible. That gives the table the fast lookup of an array and the churn behavior of consistent hashing.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The per-packet hot path must be tiny: parse enough header data, hash the flow, index the table, rewrite or encapsulate, and forward. The expensive work happens off the hot path: health checking, table generation, configuration distribution, and convergence after failures. Operationally, Maglev trades specialized hardware for a distributed software fleet, which means scale-out is easier but consistency and monitoring become central.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Maglev is tied to Google-scale traffic and Google Cloud load balancing history. The transferable pattern is broader: stateless frontend workers, deterministic flow-to-backend mapping, commodity-server scale-out, and fast health-driven table updates. CDNs, API gateways, service meshes, and edge platforms all use variants of this split between request distribution, health, and deterministic routing.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Maglev is not an application load balancer. It does not inspect HTTP routes or choose a backend based on request body semantics. It operates lower in the stack, where packet speed and connection affinity dominate. Another misconception is that a lookup table alone makes a load balancer reliable. The hard production work is health detection, config convergence, overload behavior, observability, and rollback when a bad table or bad backend set ships.`,
      ],
    },
    {
      heading: `Sources and study next`,
      paragraphs: [
        `Primary source: "Maglev: A Fast and Reliable Software Network Load Balancer" at https://research.google.com/pubs/archive/44824.pdf, with Google Cloud background at https://cloud.google.com/blog/products/gcp/google-shares-software-network-load-balancer-design-powering-gcp-networking. Study Load Balancer, Consistent Hashing, Jump Consistent Hash Case Study, Rendezvous Hashing (HRW), Hash Table, CDN Request Flow, Tail Latency & p99 Thinking, Circuit Breakers & Deadlines, and Backpressure & Flow Control. The useful contrast is concrete: Jump stores no table because numbered buckets are enough, HRW scores the candidate set, and Maglev pays table memory to make the packet hot path tiny.`,
      ],
    },
  ],
};
