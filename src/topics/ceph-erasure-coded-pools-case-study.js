// Ceph erasure-coded pools: k data chunks, m coding chunks, CRUSH placement,
// degraded reads, and recovery traffic.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'ceph-erasure-coded-pools-case-study',
  title: 'Ceph Erasure-Coded Pools',
  category: 'Systems',
  summary: 'Ceph erasure-coded pools split objects into data and coding chunks, place them through CRUSH, and rebuild missing chunks from surviving shards.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['stripe and place', 'degraded read'], defaultValue: 'stripe and place' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function cephGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'client', label: 'cli', x: 0.4, y: 4.0, note: notes.client ?? 'RADOS' },
      { id: 'object', label: 'obj', x: 2.1, y: 4.0, note: notes.object ?? 'object' },
      { id: 'pg', label: 'PG', x: 3.75, y: 4.0, note: notes.pg ?? 'maps' },
      { id: 'profile', label: 'profile', x: 5.1, y: 2.3, note: notes.profile ?? '4+2' },
      { id: 'crush', label: 'CRUSH', x: 5.1, y: 5.8, note: notes.crush ?? 'rule' },
      { id: 'd0', label: 'D0', x: 6.55, y: 1.35, note: notes.d0 ?? 'osd1' },
      { id: 'd1', label: 'D1', x: 7.55, y: 2.45, note: notes.d1 ?? 'osd2' },
      { id: 'd2', label: 'D2', x: 6.55, y: 3.55, note: notes.d2 ?? 'osd3' },
      { id: 'd3', label: 'D3', x: 7.55, y: 4.65, note: notes.d3 ?? 'osd4' },
      { id: 'c0', label: 'C0', x: 6.55, y: 5.75, note: notes.c0 ?? 'osd5' },
      { id: 'c1', label: 'C1', x: 7.55, y: 6.85, note: notes.c1 ?? 'osd6' },
      { id: 'osds', label: 'OSDs', x: 9.15, y: 4.1, note: notes.osds ?? 'domains' },
    ],
    edges: [
      { id: 'e-client-object', from: 'client', to: 'object', weight: '' },
      { id: 'e-object-pg', from: 'object', to: 'pg', weight: '' },
      { id: 'e-pg-profile', from: 'pg', to: 'profile', weight: '' },
      { id: 'e-pg-crush', from: 'pg', to: 'crush', weight: '' },
      { id: 'e-profile-d0', from: 'profile', to: 'd0', weight: '' },
      { id: 'e-profile-d1', from: 'profile', to: 'd1', weight: '' },
      { id: 'e-profile-d2', from: 'profile', to: 'd2', weight: '' },
      { id: 'e-profile-d3', from: 'profile', to: 'd3', weight: '' },
      { id: 'e-profile-c0', from: 'profile', to: 'c0', weight: '' },
      { id: 'e-profile-c1', from: 'profile', to: 'c1', weight: '' },
      { id: 'e-crush-osds', from: 'crush', to: 'osds', weight: '' },
      { id: 'e-d0-osds', from: 'd0', to: 'osds', weight: '' },
      { id: 'e-d1-osds', from: 'd1', to: 'osds', weight: '' },
      { id: 'e-d2-osds', from: 'd2', to: 'osds', weight: '' },
      { id: 'e-d3-osds', from: 'd3', to: 'osds', weight: '' },
      { id: 'e-c0-osds', from: 'c0', to: 'osds', weight: '' },
      { id: 'e-c1-osds', from: 'c1', to: 'osds', weight: '' },
    ],
  }, { title });
}

function recoveryGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'read', label: 'read', x: 0.7, y: 4.0, note: notes.read ?? 'degraded' },
      { id: 'd0', label: 'D0', x: 2.3, y: 1.8, note: notes.d0 ?? 'ok' },
      { id: 'd1', label: 'D1', x: 2.3, y: 3.1, note: notes.d1 ?? 'lost' },
      { id: 'd2', label: 'D2', x: 2.3, y: 4.4, note: notes.d2 ?? 'ok' },
      { id: 'd3', label: 'D3', x: 2.3, y: 5.7, note: notes.d3 ?? 'ok' },
      { id: 'c0', label: 'C0', x: 2.3, y: 7.0, note: notes.c0 ?? 'ok' },
      { id: 'decode', label: 'decode', x: 5.0, y: 4.4, note: notes.decode ?? 'k chunks' },
      { id: 'reply', label: 'reply', x: 7.0, y: 3.1, note: notes.reply ?? 'object bytes' },
      { id: 'backfill', label: 'backfill', x: 7.0, y: 5.7, note: notes.backfill ?? 'new D1' },
      { id: 'healthy', label: 'healthy', x: 9.0, y: 4.4, note: notes.healthy ?? 'clean' },
    ],
    edges: [
      { id: 'e-read-d0', from: 'read', to: 'd0', weight: '' },
      { id: 'e-read-d2', from: 'read', to: 'd2', weight: '' },
      { id: 'e-read-d3', from: 'read', to: 'd3', weight: '' },
      { id: 'e-read-c0', from: 'read', to: 'c0', weight: '' },
      { id: 'e-d0-decode', from: 'd0', to: 'decode', weight: '' },
      { id: 'e-d2-decode', from: 'd2', to: 'decode', weight: '' },
      { id: 'e-d3-decode', from: 'd3', to: 'decode', weight: '' },
      { id: 'e-c0-decode', from: 'c0', to: 'decode', weight: '' },
      { id: 'e-decode-reply', from: 'decode', to: 'reply', weight: '' },
      { id: 'e-decode-backfill', from: 'decode', to: 'backfill', weight: '' },
      { id: 'e-reply-healthy', from: 'reply', to: 'healthy', weight: '' },
      { id: 'e-backfill-healthy', from: 'backfill', to: 'healthy', weight: '' },
    ],
  }, { title });
}

function* stripeAndPlace() {
  yield {
    state: cephGraph('The erasure-code profile defines the chunk layout'),
    highlight: { active: ['client', 'object', 'pg', 'profile', 'e-client-object', 'e-object-pg', 'e-pg-profile'], found: ['d0', 'd1', 'd2', 'd3', 'c0', 'c1'] },
    explanation: 'A Ceph erasure-coded pool uses a profile such as k=4, m=2. The object is encoded into four data chunks and two coding chunks. Any four chunks can recover the object.',
    invariant: 'Ceph calls data shards data chunks and parity shards coding chunks.',
  };

  yield {
    state: labelMatrix(
      'Example EC profile',
      [
        { id: 'k', label: 'k' },
        { id: 'm', label: 'm' },
        { id: 'plugin', label: 'plugin' },
        { id: 'rule', label: 'rule' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['4', 'data chunks'],
        ['2', 'coding chunks'],
        ['isa/jerasure', 'codec'],
        ['rack spread', 'fail domains'],
      ],
    ),
    highlight: { active: ['k:meaning', 'm:meaning', 'rule:meaning'], compare: ['plugin:value'] },
    explanation: 'The profile is the durable contract for the pool. It tells the OSDs how many chunks to produce, which coding plugin to use, and which placement rule should separate failure domains.',
  };

  yield {
    state: cephGraph('CRUSH places chunks across OSDs and failure domains', { crush: 'place', osds: 'spread' }),
    highlight: { active: ['crush', 'osds', 'e-pg-crush', 'e-crush-osds'], found: ['d0', 'd1', 'd2', 'd3', 'c0', 'c1'] },
    explanation: 'CRUSH placement remains central. A k+m layout is only durable if the chunks land on distinct enough devices, hosts, or racks. Otherwise one correlated failure can erase too many chunks.',
  };

  yield {
    state: labelMatrix(
      'Replication vs erasure coding',
      [
        { id: 'rep', label: '3x repl' },
        { id: 'ec42', label: 'EC 4+2' },
        { id: 'hot', label: 'hot small' },
        { id: 'cold', label: 'cold large' },
      ],
      [
        { id: 'space', label: 'space' },
        { id: 'read', label: 'read cost' },
        { id: 'write', label: 'write cost' },
      ],
      [
        ['3.0x', 'simple', 'simple'],
        ['1.5x', 'decode if bad', 'encode chunks'],
        ['costly EC', 'latency risk', 'write amp'],
        ['good fit', 'batched IO', 'space win'],
      ],
    ),
    highlight: { active: ['ec42:space', 'cold:space'], compare: ['rep:space', 'hot:write'] },
    explanation: 'Erasure coding usually fits large, colder data better than tiny hot writes. Space efficiency improves, but write path, repair path, and degraded reads get heavier.',
  };

  yield {
    state: cephGraph('Object APIs hide chunks behind one logical object', { object: 'logical', pg: 'stripe', osds: 'chunks' }),
    highlight: { active: ['object', 'pg', 'profile', 'crush'], found: ['osds'] },
    explanation: 'Clients ask for objects. The storage cluster handles striping, coding, placement, and repair beneath that API. The abstraction is simple because the hidden metadata is not.',
  };
}

function* degradedRead() {
  yield {
    state: recoveryGraph('A degraded read gathers enough surviving chunks'),
    highlight: { active: ['read', 'd0', 'd2', 'd3', 'c0', 'decode'], removed: ['d1'], found: ['reply'] },
    explanation: 'If one data chunk is unavailable, the OSDs can read enough surviving chunks and decode the requested data. The client still receives object bytes, but the cluster pays extra work.',
    invariant: 'Degraded mode consumes the failure budget until repair finishes.',
  };

  yield {
    state: labelMatrix(
      'Degraded read plan',
      [
        { id: 'd0', label: 'D0' },
        { id: 'd1', label: 'D1' },
        { id: 'd2', label: 'D2' },
        { id: 'd3', label: 'D3' },
        { id: 'c0', label: 'C0' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'action', label: 'action' },
      ],
      [
        ['present', 'read'],
        ['missing', 'rebuild'],
        ['present', 'read'],
        ['present', 'read'],
        ['present', 'read'],
      ],
    ),
    highlight: { active: ['d1:state', 'd1:action'], found: ['d0:action', 'd2:action', 'd3:action', 'c0:action'] },
    explanation: 'The decoder reads k available chunks. It can serve the request and also produce the missing chunk for backfill if the cluster decides to repair immediately.',
  };

  yield {
    state: recoveryGraph('Backfill writes a replacement chunk'),
    highlight: { active: ['decode', 'backfill', 'e-decode-backfill'], found: ['healthy'], compare: ['reply'] },
    explanation: 'Recovery writes a replacement chunk to a healthy OSD chosen by the current CRUSH map. The system returns to a full k+m chunk set only after backfill completes.',
  };

  yield {
    state: labelMatrix(
      'Failure-domain checks',
      [
        { id: 'osd', label: 'OSD down' },
        { id: 'host', label: 'host down' },
        { id: 'rack', label: 'rack down' },
        { id: 'map', label: 'map drift' },
      ],
      [
        { id: 'safe', label: 'safe if' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['<= m chunks', 'repair load'],
        ['chunks spread', 'bad rule'],
        ['rack spread', 'corr loss'],
        ['clients update', 'stale route'],
      ],
    ),
    highlight: { active: ['host:safe', 'rack:safe'], compare: ['map:risk'] },
    explanation: 'The m value is only meaningful relative to placement. Losing two disks is different from losing one rack if several chunks were placed under the same rack failure domain.',
  };

  yield {
    state: labelMatrix(
      'Operational costs',
      [
        { id: 'cpu', label: 'CPU' },
        { id: 'net', label: 'network' },
        { id: 'scrub', label: 'scrub' },
        { id: 'small', label: 'small IO' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['encode/decode', 'profile choice'],
        ['repair reads', 'throttle'],
        ['find bad shard', 'checksums'],
        ['read-mod-write', 'cache or repl'],
      ],
    ),
    highlight: { active: ['cpu:why', 'net:guard', 'scrub:guard'], compare: ['small:why'] },
    explanation: 'Ceph erasure coding is strongest when profile, placement, scrubbing, and recovery throttles match the workload. The wrong pool layout can save space while damaging latency.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'stripe and place') yield* stripeAndPlace();
  else if (view === 'degraded read') yield* degradedRead();
  else throw new InputError('Pick a Ceph erasure-code view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      {type:'callout', text:'Erasure-coded pools save capacity only when the coding profile and CRUSH placement preserve a real failure budget.'},
      {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/b/b4/Code_d%27effacement_optimal_1.gif', alt:'Animated erasure-code diagram showing data reconstructed from redundant encoded symbols', caption:'Optimal erasure-code animation showing redundant recoverable symbols. Source: Wikimedia Commons, Code d\'effacement optimal 1.gif.'},
      'Read the stripe-and-place view as two contracts. The erasure-code profile defines k data chunks and m coding chunks, and CRUSH places those chunks on OSDs under a failure-domain rule. Active chunks are available to decode; removed chunks are unavailable.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Ceph replication is simple but expensive. Three-way replication stores three full copies, so 1 PB logical needs about 3 PB raw before reserve. Erasure-coded pools spend CPU and network to reduce that raw-capacity multiplier for colder data.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious way to save space is lowering replication from three copies to two. That saves capacity but narrows the safety margin sharply. Compression and deduplication reduce bytes when data helps, but they do not define how many independent failures the object can survive.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is independent failure. A 4+2 code can tolerate two missing chunks, but not if one rack outage removes three chunks for the same object. The coding profile and CRUSH rule must be designed together.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Split durability into coding and placement. Coding decides how many chunks are needed for reconstruction. Placement decides whether ordinary failures are likely to remove more chunks than the code can tolerate.',
    ] },
    { heading: 'How it works', paragraphs: [
      'On write, a logical object maps to a placement group. The acting OSD set cuts the object into k data chunks, computes m coding chunks, and writes chunks to OSDs selected by CRUSH. On degraded read, Ceph reads enough surviving chunks, decodes missing data, and returns object bytes.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'Reed-Solomon-style coding stores independent equations over the data chunks. If enough independent chunks survive, the decoder solves for the missing chunks instead of guessing disk contents. CRUSH makes the math operational by spreading chunks across failure domains.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'A 4+2 profile uses 6 / 4 = 1.5x raw space before reserve, compared with 3.0x for triple replication. The cost is encoding on write, more network fanout, read-modify-write for some partial updates, degraded-read decode, and heavier recovery. When object size doubles, encode and transfer bytes roughly double.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Erasure-coded pools fit large colder objects such as logs, backups, media archives, data lake objects, and analytical blobs. These workloads usually write in larger units, read less often, and care more about disk cost than the simplest write path.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails for tiny hot overwrites unless measurement proves otherwise. Replication can update full copies simply, while erasure coding may touch several chunks for one logical change. It also fails when topology labels are wrong or the cluster lacks reserve space for backfill.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A company stores 1 PB of compressed request logs. Triple replication needs about 3 PB raw, while a 4+2 erasure-coded pool needs about 1.5 PB before reserve. If D1 is unavailable, Ceph can read D0, D2, D3, and C0, decode D1, serve the read, and backfill a replacement chunk.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Ceph erasure-code documentation at https://docs.ceph.com/en/latest/rados/operations/erasure-code/, Ceph erasure-code profile documentation at https://docs.ceph.com/en/latest/rados/operations/erasure-code-profile/, and the CRUSH paper at https://ceph.com/assets/pdfs/weil-crush-sc06.pdf.',
      'Study Reed-Solomon Erasure Coding, Ceph CRUSH Placement Case Study, S3 Object Storage Case Study, Backpressure and Flow Control, and Tail Latency next.',
    ] },
  ],
};
