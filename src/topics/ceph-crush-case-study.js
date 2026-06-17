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
    {
      heading: 'Why this exists',
      paragraphs: [
        'A distributed storage system has to decide where every object lives. The easy answer is a central metadata service: ask it for the placement of object X, then read or write the listed replicas. That works until the placement table becomes large, hot, or hard to keep available during failures.',
        'CRUSH, used by Ceph, makes placement a deterministic function. Given an object id, a cluster map, weights, and placement rules, clients and storage daemons can compute the replica set locally. The system avoids storing a per-object placement table while still respecting capacity and failure-domain constraints.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a lookup table from object to devices. It gives explicit control, but it creates a large metadata surface and a central point that every client must trust or query. Rebalancing means rewriting or interpreting many placement records.',
        'Another obvious approach is a simple hash ring. Hash the object, walk the ring, and choose replicas. That handles decentralization better, but it does not automatically understand racks, hosts, device weights, or rules such as keeping replicas out of the same failure domain.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is topology. Three replicas on three disks are not durable if all three disks sit in the same host or rack. A placement algorithm needs to know which failures are correlated, not just how many copies exist.',
        'Capacity changes are the second wall. Adding a disk should move some data to the new disk, but it should not reshuffle the whole cluster. Removing or down-weighting a device should move affected data without creating a recovery storm that overwhelms the surviving devices.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent the cluster as a weighted hierarchy: root, rows, racks, hosts, devices, or whatever topology matches the deployment. Then run deterministic pseudo-random choices through that hierarchy under placement rules. The same object id and map produce the same answer everywhere.',
        'The important move is making placement explainable without making it centralized. The CRUSH map is shared metadata, but individual object placements are computed. That is the difference between carrying a compact placement function and carrying a giant placement table.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'In the placement-hierarchy view, follow the object id through root, rack, host, and OSD. The highlighted path is not stored per-object metadata; it is the result of deterministic pseudo-random choice under the current map.',
        'In the rebalancing view, the map change is the event. New weights should attract some data, but not all data. The operational table is the warning: deterministic placement still depends on accurate weights, realistic topology, current maps, and recovery throttling.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The cluster map describes buckets and devices. Buckets can represent physical or logical failure domains such as rooms, racks, hosts, chassis, or device classes. Each item has a weight, usually tied to capacity. Placement rules describe what kind of bucket to choose from and how replicas should be separated.',
        'Given an object id, CRUSH uses deterministic pseudo-random selection to walk the map. It chooses a bucket, descends through child buckets, and selects OSDs while honoring rules such as distinct hosts or racks. If a choice violates a rule or lands on an unavailable device, the algorithm retries according to the rule set.',
        'Every participant with the same map can compute the same placement. That lets clients send operations directly to the right OSDs and lets the cluster reason about recovery when the map changes.',
        'In Ceph, placement groups sit between raw objects and OSDs. Many objects map into a placement group, and the placement group maps through CRUSH to an acting set. That extra layer gives the system a manageable unit for peering, recovery, backfill, and health reporting instead of tracking recovery independently for every individual object.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose object `photo-17` belongs to a replicated pool with size three and a rule that replicas must land on distinct hosts across two racks if possible. The object id and pool seed drive the selection. CRUSH chooses a rack, then a host, then an OSD, and repeats while avoiding forbidden collisions.',
        'Now a new OSD is added to one host. Its weight appears in the next map. Some object placements now select the new OSD, which triggers backfill or recovery for those objects. Objects whose computed placement did not change stay where they are. That limited movement is the practical value of deterministic placement with weights.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'CRUSH works because placement is stable under a stable map and changes predictably under a changed map. Hashing gives a pseudo-random spread. Weights bias choices toward available capacity. Hierarchical rules encode failure-domain separation. The same function produces the same placement for every client that has the same cluster map.',
        'It also works operationally because the map is much smaller than a per-object table. A system can distribute map updates and let clients compute placement locally. That shifts the bottleneck from per-object metadata lookup to map correctness and propagation.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'CRUSH removes central placement lookups, but it moves complexity into map design, weights, topology modeling, and recovery behavior. Bad weights skew load. Bad failure-domain rules reduce durability. Large topology changes can still create heavy recovery traffic.',
        'The algorithm is deterministic, not free. Clients need the current map, placement calculations consume CPU, and recovery must reconcile computed placement with actual data movement. During map churn, placement can be correct but the cluster can still be busy moving data to reach the new correct state.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'CRUSH wins in large replicated and erasure-coded object stores where clients should compute locations without consulting a central placement database. It fits Ceph because Ceph already exposes objects, pools, OSD maps, placement groups, and failure domains as first-class operational concepts.',
        'The broader design lesson applies beyond Ceph. Cache sharding, service placement, replicated logs, and storage systems often benefit when placement is a deterministic function of key plus topology rather than a hand-maintained table.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'CRUSH is not just consistent hashing and should not be treated like a hash ring with nicer names. If the topology is wrong, the algorithm will faithfully enforce the wrong topology. If a rack is modeled as independent when it shares power with another rack, the placement rule may overstate durability.',
        'It also does not remove recovery cost. When devices fail, weights change, or placement rules are edited, data still has to move. The map can say where data belongs faster than the cluster can copy the bytes there. Recovery throttles, backfill limits, and capacity headroom decide whether a correct placement plan becomes a stable operation.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Common failures are stale maps on clients, inaccurate weights, device classes that do not match performance reality, rules that allow correlated replicas, and large map changes that trigger too much movement at once. A healthy design reviews both placement output and recovery pressure.',
        'A second failure is using CRUSH output as an excuse to ignore observability. Operators still need to explain why an object maps to a set of OSDs, why a placement group is undersized or degraded, and why recovery is slow. Deterministic placement helps only if the map and events are inspectable.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: CRUSH paper PDF at https://ceph.com/assets/pdfs/weil-crush-sc06.pdf, ACM DOI at https://dl.acm.org/doi/10.1145/1188455.1188582, and Ceph CRUSH map documentation at https://docs.ceph.com/en/latest/rados/operations/crush-map/.',
        'Study Consistent Hashing for the simple placement baseline, Sharding and Partitioning for key-to-owner mapping, Google File System Case Study for a central master contrast, Amazon Dynamo Case Study for decentralized replication, Reed-Solomon Erasure Coding for erasure-coded pools, Ceph Erasure-Coded Pools, and Merkle Tree for repair and verification patterns.',
      ],
    },
  ],
};
