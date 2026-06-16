// CRUSH case study: deterministic object placement over a weighted failure
// hierarchy, avoiding central lookup tables while minimizing data movement.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'ceph-crush-case-study',
  title: 'Ceph CRUSH Placement Case Study',
  category: 'Papers',
  summary: 'CRUSH as the storage-placement lesson: compute replica locations from object id, weights, and failure-domain hierarchy.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['placement hierarchy', 'rebalancing on change'], defaultValue: 'placement hierarchy' },
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

function crushMap(title) {
  return graphState({
    nodes: [
      { id: 'object', label: 'object id', x: 0.7, y: 3.8, note: 'hash input' },
      { id: 'root', label: 'root', x: 2.5, y: 3.8, note: 'cluster' },
      { id: 'rackA', label: 'rack A', x: 4.4, y: 2.2, note: 'weight 6' },
      { id: 'rackB', label: 'rack B', x: 4.4, y: 5.4, note: 'weight 4' },
      { id: 'host1', label: 'host 1', x: 6.2, y: 1.4, note: 'weight 3' },
      { id: 'host2', label: 'host 2', x: 6.2, y: 3.0, note: 'weight 3' },
      { id: 'host3', label: 'host 3', x: 6.2, y: 5.0, note: 'weight 2' },
      { id: 'host4', label: 'host 4', x: 6.2, y: 6.6, note: 'weight 2' },
      { id: 'osd1', label: 'OSD 1', x: 8.4, y: 1.4, note: 'replica' },
      { id: 'osd3', label: 'OSD 3', x: 8.4, y: 3.0, note: 'replica' },
      { id: 'osd5', label: 'OSD 5', x: 8.4, y: 5.0, note: 'replica' },
    ],
    edges: [
      { id: 'e-object-root', from: 'object', to: 'root', weight: 'hash' },
      { id: 'e-root-a', from: 'root', to: 'rackA', weight: 'choose' },
      { id: 'e-root-b', from: 'root', to: 'rackB', weight: 'choose' },
      { id: 'e-a-h1', from: 'rackA', to: 'host1', weight: 'bucket' },
      { id: 'e-a-h2', from: 'rackA', to: 'host2', weight: 'bucket' },
      { id: 'e-b-h3', from: 'rackB', to: 'host3', weight: 'bucket' },
      { id: 'e-b-h4', from: 'rackB', to: 'host4', weight: 'bucket' },
      { id: 'e-h1-o1', from: 'host1', to: 'osd1', weight: 'device' },
      { id: 'e-h2-o3', from: 'host2', to: 'osd3', weight: 'device' },
      { id: 'e-h3-o5', from: 'host3', to: 'osd5', weight: 'device' },
    ],
  }, { title });
}

function* placementHierarchy() {
  yield {
    state: crushMap('CRUSH maps object ids through a failure hierarchy'),
    highlight: { active: ['object', 'root', 'rackA', 'rackB', 'e-object-root'], compare: ['host1', 'host4'] },
    explanation: 'CRUSH computes placement instead of looking it up in a central table. The input is an object id plus a cluster map of buckets, weights, devices, and failure domains.',
  };

  yield {
    state: crushMap('Replica choices avoid shared failure domains'),
    highlight: { found: ['osd1', 'osd3', 'osd5', 'e-h1-o1', 'e-h2-o3', 'e-h3-o5'], active: ['rackA', 'rackB'] },
    explanation: 'Placement rules can ask for replicas on distinct hosts or racks. The algorithm walks the hierarchy pseudo-randomly, weighted by capacity, while respecting those constraints.',
    invariant: 'Clients can independently compute the same replica set from the same CRUSH map.',
  };

  yield {
    state: labelMatrix(
      'Object placement output',
      [
        { id: 'objA', label: 'object A' },
        { id: 'objB', label: 'object B' },
        { id: 'objC', label: 'object C' },
      ],
      [
        { id: 'rep1', label: 'replica 1' },
        { id: 'rep2', label: 'replica 2' },
        { id: 'rep3', label: 'replica 3' },
        { id: 'domains', label: 'failure domains' },
      ],
      [
        ['osd1', 'osd3', 'osd5', 'rack/host separated'],
        ['osd2', 'osd4', 'osd6', 'rack/host separated'],
        ['osd3', 'osd1', 'osd6', 'rack/host separated'],
      ],
    ),
    highlight: { found: ['objA:rep1', 'objA:rep2', 'objA:rep3'], active: ['objA:domains'] },
    explanation: 'The result is a list of storage devices. No metadata server has to answer "where is object A?" for every read. That decentralization is the point.',
  };

  yield {
    state: labelMatrix(
      'CRUSH compared with adjacent placement tools',
      [
        { id: 'consistent', label: 'Consistent Hashing' },
        { id: 'crush', label: 'CRUSH' },
        { id: 'gfs', label: 'GFS master' },
        { id: 'dynamo', label: 'Dynamo ring' },
      ],
      [
        { id: 'placement', label: 'placement idea' },
        { id: 'metadata', label: 'metadata style' },
      ],
      [
        ['hash onto ring', 'small ring map'],
        ['hash through hierarchy', 'cluster map + rules'],
        ['master tracks chunks', 'central metadata'],
        ['ring + preference list', 'membership/gossip'],
      ],
    ),
    highlight: { found: ['crush:placement', 'crush:metadata'], compare: ['gfs:metadata', 'dynamo:placement'] },
    explanation: 'CRUSH is like Consistent Hashing with a storage topology brain. It knows about weights and failure domains, not just a flat hash ring.',
  };
}

function* rebalancingOnChange() {
  yield {
    state: labelMatrix(
      'Add a new device without moving everything',
      [
        { id: 'before', label: 'before' },
        { id: 'change', label: 'change' },
        { id: 'after', label: 'after' },
      ],
      [
        { id: 'map', label: 'CRUSH map' },
        { id: 'movement', label: 'data movement' },
        { id: 'why', label: 'why' },
      ],
      [
        ['10 OSDs', 'none', 'stable map'],
        ['add osd11 weight 2', 'some objects', 'new weighted choices'],
        ['11 OSDs', 'bounded remap', 'only affected placements move'],
      ],
    ),
    highlight: { active: ['change:map', 'change:movement'], found: ['after:movement'] },
    explanation: 'When the cluster changes, CRUSH recomputes placements. The goal is controlled movement: enough data moves to use the new capacity, but unrelated objects should stay put.',
  };

  yield {
    state: crushMap('Failure-domain rules keep replicas apart'),
    highlight: { active: ['rackA', 'rackB', 'host1', 'host2', 'host3'], found: ['osd1', 'osd3', 'osd5'] },
    explanation: 'Rebalancing is constrained by placement rules. A new disk in rack A should not make all replicas land in rack A. Durability is a topology property, not just a replica count.',
  };

  yield {
    state: labelMatrix(
      'Operational tradeoffs',
      [
        { id: 'weights', label: 'weights' },
        { id: 'rules', label: 'rules' },
        { id: 'maps', label: 'map changes' },
        { id: 'clients', label: 'clients' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['capacity aware', 'bad weights skew load'],
        ['failure-domain control', 'bad rules reduce durability'],
        ['decentralized remap', 'large change causes recovery storm'],
        ['compute placement locally', 'must share current map'],
      ],
    ),
    highlight: { active: ['weights:benefit', 'rules:benefit'], compare: ['maps:risk', 'clients:risk'] },
    explanation: 'The algorithm is deterministic, but operations still matter. Bad weights, bad topology, or a huge map change can create imbalance or recovery pressure.',
  };

  yield {
    state: crushMap('The broader lesson: make placement a function'),
    highlight: { found: ['object', 'root', 'rackA', 'rackB'], active: ['osd1', 'osd3', 'osd5'] },
    explanation: 'CRUSH turns storage placement into a deterministic function of object id and cluster map. That reduces metadata bottlenecks and makes placement explainable.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'placement hierarchy') yield* placementHierarchy();
  else if (view === 'rebalancing on change') yield* rebalancingOnChange();
  else throw new InputError('Pick a CRUSH view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'CRUSH, used by Ceph, is a deterministic placement algorithm for replicated storage. It maps an object id through a weighted hierarchy of buckets and devices, producing replica locations without a central lookup table.',
        'The case study matters because distributed storage placement is usually a hidden bottleneck. CRUSH shows how hashing, topology, weights, and failure-domain rules can become one computable placement function.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The cluster map describes racks, hosts, devices, weights, and placement rules. Given an object id, CRUSH pseudo-randomly chooses buckets and devices according to rules such as "place replicas on distinct hosts" or "spread across racks." Clients and storage nodes can compute the same result from the same map.',
        'When capacity changes, a new map changes some placements. The design aims to move only the data affected by the change while preserving balance and failure-domain constraints.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'CRUSH removes central placement lookups, but it moves complexity into map design, weights, topology modeling, and recovery behavior. Bad weights can skew load. Bad failure-domain rules can reduce durability. Large topology changes can still cause heavy recovery traffic.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'CRUSH is a core idea in Ceph object storage and a useful design pattern for decentralized placement. Its lessons apply to replicated object stores, erasure-coded pools, data placement systems, cache sharding, and any architecture where clients should compute locations without asking a central metadata service.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'CRUSH is not just a hash ring. It is topology-aware placement. It also does not remove operational judgment: weights, maps, and placement rules need to represent the real failure and capacity structure of the cluster.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: CRUSH paper PDF at https://ceph.com/assets/pdfs/weil-crush-sc06.pdf and ACM DOI at https://dl.acm.org/doi/10.1145/1188455.1188582. Study Consistent Hashing, Sharding & Partitioning, Google File System Case Study, Amazon Dynamo Case Study, Reed-Solomon Erasure Coding, Ceph Erasure-Coded Pools, and Merkle Tree next.',
      ],
    },
  ],
};
