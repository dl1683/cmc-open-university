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
    explanation: 'Read the graph as a function call: object id plus CRUSH map goes in, replica locations come out. There is no central lookup on the read path for every object.',
  };

  yield {
    state: crushMap('Replica choices avoid shared failure domains'),
    highlight: { found: ['osd1', 'osd3', 'osd5', 'e-h1-o1', 'e-h2-o3', 'e-h3-o5'], active: ['rackA', 'rackB'] },
    explanation: 'Placement rules make durability concrete. The algorithm walks the hierarchy pseudo-randomly, weighted by capacity, while avoiding shared failure domains such as one host or one rack.',
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
    explanation: 'When the cluster changes, CRUSH recomputes placements. The goal is controlled movement: move enough objects to use the new capacity, but avoid reshuffling the entire cluster.',
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
    { heading: 'How to read the animation', paragraphs: [
      {type:'callout', text:'CRUSH replaces per-object placement metadata with a deterministic, topology-aware function that every client can compute from the same cluster map.'},
      {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/3e/Ceph_components.svg', alt:'Ceph component diagram showing applications, kernel, monitors, metadata daemon, object storage daemon, and disks', caption:'Ceph distributes storage across monitors, metadata services, OSDs, and disks; CRUSH is the placement function that maps objects into that storage fabric without a per-object lookup table. Source: Wikimedia Commons, V4711, CC BY-SA 4.0.'},
      'Read the graph as a deterministic function call. The input is an object id plus the current CRUSH map, and the output is a set of OSDs. OSD means object storage daemon, the Ceph process that stores object data on a device.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'A distributed object store must decide where every object lives. A central object-to-device table is easy for a small system but grows with object count and becomes a hot metadata dependency. CRUSH makes placement computable from a compact map instead.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is a lookup table: object X maps to OSDs 1, 3, and 5. A flat hash ring is another obvious approach. Both miss the full storage problem because placement must understand weights and failure domains, not only random distribution.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is correlated failure and movement. Three replicas on three disks are unsafe if all disks share one host or rack. Adding a new OSD should move its fair share of data, not reshuffle the whole cluster.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Represent the cluster as a weighted hierarchy of roots, racks, hosts, device classes, and OSDs. CRUSH walks that hierarchy with deterministic pseudo-random choices under placement rules. The same object id and map produce the same answer everywhere.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The CRUSH map contains devices, buckets, weights, and rules. Ceph maps objects into placement groups, then maps each placement group through CRUSH to an acting set. Placement groups give recovery and health a manageable unit instead of tracking every object independently.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The function is stable under a stable map. Hashing spreads objects, weights bias choices toward capacity, and hierarchy rules separate failure domains. If all clients have the same map, they compute the same placement without asking a central service for every read.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'CRUSH removes per-object placement lookup but moves complexity into map design, weights, topology labels, and recovery behavior. When OSD count doubles, the map grows with devices and buckets, not object count. The dominant cost after change is copying data until actual placement matches computed placement.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'CRUSH is used by Ceph for replicated and erasure-coded pools across OSDs. The broader pattern fits cache sharding, service placement, stream partitioning, and replica assignment when placement can be a function of key plus topology.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'CRUSH fails when the map lies. If two racks share power but the map treats them as independent, the algorithm can overstate durability. It also does not remove recovery cost; the map can compute a new home faster than disks can copy bytes.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A pool has size 3 across 10 equal OSDs on five hosts. Object photo-17 maps to PG 42, and CRUSH chooses OSD 1, OSD 4, and OSD 8 on distinct hosts. Adding OSD 10 with weight 1.0 should eventually attract about 1/11 of balanced data, while PGs whose computed placement did not change stay put.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: CRUSH paper at https://ceph.com/assets/pdfs/weil-crush-sc06.pdf, ACM DOI at https://dl.acm.org/doi/10.1145/1188455.1188582, and Ceph CRUSH map documentation at https://docs.ceph.com/en/latest/rados/operations/crush-map/.',
      'Study Consistent Hashing, Sharding and Partitioning, Google File System Case Study, Amazon Dynamo Case Study, Reed-Solomon Erasure Coding, Ceph Erasure-Coded Pools, and Merkle Tree repair patterns.',
    ] },
  ],
};
