// Reed-Solomon erasure coding: split data into k data shards plus m coding
// shards so any k of k+m shards can reconstruct the stripe.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'reed-solomon-erasure-coding-case-study',
  title: 'Reed-Solomon Erasure Coding',
  category: 'Systems',
  summary: 'A storage-coding primer: encode data shards into finite-field parity shards, tolerate missing shards, and reconstruct from any threshold-sized survivor set.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['encode shards', 'recover erasures'], defaultValue: 'encode shards' },
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

function rsGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'object', label: 'bytes', x: 0.45, y: 4.0, note: notes.object ?? 'object' },
      { id: 'split', label: 'split', x: 2.35, y: 4.0, note: notes.split ?? 'k data' },
      { id: 'matrix', label: 'GF', x: 4.25, y: 4.0, note: notes.matrix ?? 'matrix' },
      { id: 'd0', label: 'D0', x: 5.85, y: 1.4, note: notes.d0 ?? 'data' },
      { id: 'd1', label: 'D1', x: 5.85, y: 2.7, note: notes.d1 ?? 'data' },
      { id: 'd2', label: 'D2', x: 5.85, y: 4.0, note: notes.d2 ?? 'data' },
      { id: 'p0', label: 'P0', x: 5.85, y: 5.3, note: notes.p0 ?? 'coding' },
      { id: 'p1', label: 'P1', x: 5.85, y: 6.6, note: notes.p1 ?? 'coding' },
      { id: 'store', label: 'store', x: 8.3, y: 4.0, note: notes.store ?? '5 shards' },
      { id: 'manifest', label: 'manifest', x: 9.5, y: 2.0, note: notes.manifest ?? 'stripe id' },
    ],
    edges: [
      { id: 'e-object-split', from: 'object', to: 'split', weight: '' },
      { id: 'e-split-matrix', from: 'split', to: 'matrix', weight: '' },
      { id: 'e-matrix-d0', from: 'matrix', to: 'd0', weight: '' },
      { id: 'e-matrix-d1', from: 'matrix', to: 'd1', weight: '' },
      { id: 'e-matrix-d2', from: 'matrix', to: 'd2', weight: '' },
      { id: 'e-matrix-p0', from: 'matrix', to: 'p0', weight: '' },
      { id: 'e-matrix-p1', from: 'matrix', to: 'p1', weight: '' },
      { id: 'e-d0-store', from: 'd0', to: 'store', weight: '' },
      { id: 'e-d1-store', from: 'd1', to: 'store', weight: '' },
      { id: 'e-d2-store', from: 'd2', to: 'store', weight: '' },
      { id: 'e-p0-store', from: 'p0', to: 'store', weight: '' },
      { id: 'e-p1-store', from: 'p1', to: 'store', weight: '' },
      { id: 'e-store-manifest', from: 'store', to: 'manifest', weight: '' },
    ],
  }, { title });
}

function recoverGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'd0', label: 'D0', x: 0.9, y: 1.8, note: notes.d0 ?? 'ok' },
      { id: 'd1', label: 'D1', x: 0.9, y: 3.1, note: notes.d1 ?? 'lost' },
      { id: 'd2', label: 'D2', x: 0.9, y: 4.4, note: notes.d2 ?? 'ok' },
      { id: 'p0', label: 'P0', x: 0.9, y: 5.7, note: notes.p0 ?? 'lost' },
      { id: 'p1', label: 'P1', x: 0.9, y: 7.0, note: notes.p1 ?? 'ok' },
      { id: 'survive', label: '3 live', x: 3.15, y: 4.4, note: notes.survive ?? 'enough' },
      { id: 'solve', label: 'solve', x: 5.35, y: 4.4, note: notes.solve ?? 'invert' },
      { id: 'repair', label: 'repair', x: 7.3, y: 3.2, note: notes.repair ?? 'D1' },
      { id: 'parity', label: 'parity', x: 7.3, y: 5.6, note: notes.parity ?? 'P0' },
      { id: 'healthy', label: 'healthy', x: 9.1, y: 4.4, note: notes.healthy ?? '5 shards' },
    ],
    edges: [
      { id: 'e-d0-survive', from: 'd0', to: 'survive', weight: '' },
      { id: 'e-d2-survive', from: 'd2', to: 'survive', weight: '' },
      { id: 'e-p1-survive', from: 'p1', to: 'survive', weight: '' },
      { id: 'e-survive-solve', from: 'survive', to: 'solve', weight: '' },
      { id: 'e-solve-repair', from: 'solve', to: 'repair', weight: '' },
      { id: 'e-solve-parity', from: 'solve', to: 'parity', weight: '' },
      { id: 'e-repair-healthy', from: 'repair', to: 'healthy', weight: '' },
      { id: 'e-parity-healthy', from: 'parity', to: 'healthy', weight: '' },
    ],
  }, { title });
}

function* encodeShards() {
  yield {
    state: rsGraph('A stripe becomes data shards plus coding shards'),
    highlight: { active: ['object', 'split', 'matrix', 'e-object-split', 'e-split-matrix'], found: ['d0', 'd1', 'd2', 'p0', 'p1'] },
    explanation: 'Reed-Solomon erasure coding stores a stripe as k data shards plus m coding shards. The coding shards are finite-field linear combinations of the data shards, not ordinary copies.',
    invariant: 'With k data shards and m coding shards, any k surviving shards can reconstruct the stripe.',
  };

  yield {
    state: labelMatrix(
      'Generator matrix view',
      [
        { id: 'd0', label: 'D0' },
        { id: 'd1', label: 'D1' },
        { id: 'd2', label: 'D2' },
        { id: 'p0', label: 'P0' },
        { id: 'p1', label: 'P1' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'formula', label: 'formula' },
      ],
      [
        ['data', 'raw shard 0'],
        ['data', 'raw shard 1'],
        ['data', 'raw shard 2'],
        ['coding', 'aD0+bD1+cD2'],
        ['coding', 'uD0+vD1+wD2'],
      ],
    ),
    highlight: { active: ['p0:formula', 'p1:formula'], found: ['d0:formula', 'd1:formula', 'd2:formula'] },
    explanation: 'A systematic code keeps the original data shards visible and appends coding shards. The parity rows are chosen so the needed submatrices stay invertible when shards go missing.',
  };

  yield {
    state: rsGraph('Coding shards are spread with the data shards', { store: 'k+m', manifest: 'ids+locs' }),
    highlight: { active: ['d0', 'd1', 'd2', 'p0', 'p1', 'store'], found: ['manifest'] },
    explanation: 'The storage layer records which shards belong to the stripe and where they live. Placement should keep shards on separate failure domains so one disk, host, or rack loss does not erase too many pieces.',
  };

  yield {
    state: labelMatrix(
      'Durability trade',
      [
        { id: 'rep3', label: '3x copy' },
        { id: 'rs32', label: 'RS 3+2' },
        { id: 'rs104', label: 'RS 10+4' },
        { id: 'single', label: '1 copy' },
      ],
      [
        { id: 'loss', label: 'can lose' },
        { id: 'overhead', label: 'overhead' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['2 copies', '3.0x', 'simple'],
        ['2 shards', '1.67x', 'decode CPU'],
        ['4 shards', '1.4x', 'more shards'],
        ['0', '1.0x', 'unsafe'],
      ],
    ),
    highlight: { active: ['rs32:overhead', 'rs104:overhead'], compare: ['rep3:overhead', 'single:cost'] },
    explanation: 'Erasure coding saves space relative to full replication, but reads, writes, repairs, and small-object updates have more coordination and CPU cost.',
  };

  yield {
    state: labelMatrix(
      'What metadata must remember',
      [
        { id: 'profile', label: 'profile' },
        { id: 'stripe', label: 'stripe id' },
        { id: 'shards', label: 'shards' },
        { id: 'checks', label: 'checksums' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'why', label: 'why' },
      ],
      [
        ['k,m,field', 'decode rule'],
        ['object range', 'find pieces'],
        ['ids+places', 'repair target'],
        ['per shard', 'detect rot'],
      ],
    ),
    highlight: { active: ['profile:why', 'shards:why'], found: ['checks:why'] },
    explanation: 'The coding math is only useful if metadata survives. A repair job needs the coding profile, stripe membership, shard placement, and integrity checks before it can reconstruct anything.',
  };
}

function* recoverErasures() {
  yield {
    state: recoverGraph('Two missing shards can still be repaired'),
    highlight: { active: ['d0', 'd2', 'p1', 'survive', 'e-d0-survive', 'e-d2-survive', 'e-p1-survive'], removed: ['d1', 'p0'], found: ['solve'] },
    explanation: 'In this 3+2 stripe, D1 and P0 are unavailable. Three shards remain, which is the threshold k, so the system can solve for the original data and regenerate missing shards.',
    invariant: 'Known missing positions are erasures; the decoder knows which shard slots disappeared.',
  };

  yield {
    state: labelMatrix(
      'Failure budget',
      [
        { id: 'zero', label: '0 lost' },
        { id: 'one', label: '1 lost' },
        { id: 'two', label: '2 lost' },
        { id: 'three', label: '3 lost' },
      ],
      [
        { id: 'live', label: 'live shards' },
        { id: 'status', label: 'status' },
      ],
      [
        ['5', 'healthy'],
        ['4', 'degraded'],
        ['3', 'recoverable'],
        ['2', 'data lost'],
      ],
    ),
    highlight: { active: ['two:live', 'two:status'], compare: ['three:status'] },
    explanation: 'A 3+2 code can tolerate any two shard losses. The third loss crosses the threshold because fewer than k shards remain.',
  };

  yield {
    state: labelMatrix(
      'Toy polynomial recovery',
      [
        { id: 'x1', label: 'x=1' },
        { id: 'x3', label: 'x=3' },
        { id: 'x5', label: 'x=5' },
        { id: 'x2', label: 'x=2' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'role', label: 'role' },
      ],
      [
        ['14', 'known'],
        ['6', 'known'],
        ['14', 'known'],
        ['8', 'recovered'],
      ],
    ),
    highlight: { active: ['x1:value', 'x3:value', 'x5:value'], found: ['x2:value'] },
    explanation: 'The same interpolation idea from Shamir Secret Sharing appears here. Storage codes usually use byte-oriented finite fields and optimized matrices, but the core promise is still threshold reconstruction.',
  };

  yield {
    state: recoverGraph('Recovered shards are written back to new locations', { d1: 'gone', p0: 'gone', repair: 'new D1', parity: 'new P0', healthy: 'full set' }),
    highlight: { active: ['solve', 'repair', 'parity', 'e-solve-repair', 'e-solve-parity'], found: ['healthy'] },
    explanation: 'Repair reads surviving shards, reconstructs missing data, and writes replacement shards to healthy devices. That repair traffic can be the dominant operational cost during failures.',
  };

  yield {
    state: labelMatrix(
      'Operational guardrails',
      [
        { id: 'scrub', label: 'scrub' },
        { id: 'place', label: 'placement' },
        { id: 'repair', label: 'repair' },
        { id: 'small', label: 'small IO' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['check shards', 'silent rot'],
        ['spread domains', 'corr loss'],
        ['rebuild fast', 'long exposure'],
        ['buffer/pack', 'write amp'],
      ],
    ),
    highlight: { active: ['scrub:job', 'place:job', 'repair:job'], compare: ['small:risk'] },
    explanation: 'Erasure coding is a storage system, not just a formula. Scrubbing, placement, repair priority, and write buffering decide whether the math survives real disks and real load.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'encode shards') yield* encodeShards();
  else if (view === 'recover erasures') yield* recoverErasures();
  else throw new InputError('Pick a Reed-Solomon view.');
}


export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The encode view shows data shards becoming coding shards through finite-field equations. Active means a shard or equation is being used, visited means a shard has already contributed to the current calculation, and found means the system has enough independent survivor equations.',
        'The recovery view is an erasure case, which means the decoder knows which shard positions are missing. The safe inference is that any k independent survivors in a k-of-n Reed-Solomon code determine exactly one original data stripe.',
        {type:'callout', text:'Reed-Solomon trades full copies for independent equations, so any threshold-sized survivor set can reconstruct the original stripe.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/0/03/DeepSpaceFEC.png', alt:'Block diagram of a deep-space forward error correction encoder and decoder chain.', caption:'Deep-space concatenated coding system using a Reed-Solomon encoder and decoder; Kirlf, CC BY-SA 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Storage systems need durability without storing full copies of every object. Three replicas are easy to read and repair, but they use 3.0x space.',
        'Reed-Solomon erasure coding stores k data shards plus m coding shards. The system can reconstruct the original stripe from any k trustworthy survivors, so a 10+4 profile stores 1.4x data while tolerating four known shard losses.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious durability plan is replication. Keep complete copies on different disks, hosts, racks, or zones, and serve reads from any healthy copy.',
        'Replication is operationally simple. Repair copies a full object from one survivor, small writes are easy, and degraded reads do not need decoding math.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is storage overhead at scale. Storing 100 PB of logical data with three replicas consumes about 300 PB before metadata and reserve capacity.',
        'A second wall is repair bandwidth. Replication is simple, but rebuilding a failed 10 TB disk still reads and writes many terabytes, and the system remains exposed while repair runs.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store independent equations instead of full copies. The original data shards are unknowns, and coding shards are finite-field linear combinations of those unknowns.',
        'If k surviving shards produce k independent equations, matrix inversion recovers the original data vector. The manifest tells the decoder which stripe, coding profile, shard positions, placements, and checksums belong together.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A systematic Reed-Solomon encoder keeps the original k data shards visible and appends m coding shards. It multiplies the data vector by a generator matrix over a finite field, usually a byte-oriented field in storage systems.',
        'When shards are missing, the decoder selects k survivors, takes the corresponding k rows of the coding matrix, and inverts that submatrix. The result reconstructs the original data shards, which can then regenerate missing data or parity shards.',
        'Checksums and placement metadata are part of the system, not decoration. The decoder must know which shards are missing or corrupt before it chooses the survivor set to trust.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on independence. Reed-Solomon chooses evaluation points or matrix rows so any allowed k-row survivor matrix is invertible.',
        'Invertible means there is exactly one original data stripe consistent with the k surviving equations. If fewer than k trustworthy shards remain, multiple originals could fit the evidence, so reconstruction is impossible.',
        'The erasure assumption is crucial. Known missing shards are easier than silent corruption, so real systems combine coding with checksums, scrubbing, and failure-domain placement.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The storage cost of a k+m profile is (k+m)/k. A 10+4 code costs 1.4x, a 6+3 code costs 1.5x, and a 3+2 code costs about 1.67x.',
        'The behavior cost appears during writes, reads, and repairs. A degraded read may need k remote shards and decoding CPU, while repairing one missing shard reads k survivors and writes one replacement.',
        'Small writes are expensive because changing part of a stripe can require read-modify-write across data and coding shards. Many systems reserve erasure coding for cold, large, or immutable objects.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Reed-Solomon coding is used in object stores, archival storage, RAID-like disk arrays, distributed file systems, deep-space communication, QR codes, and optical media. The fit is strongest where space efficiency matters more than tiny-write latency.',
        'Cloud object storage is the standard software case. Large objects can be striped across failure domains, repaired in the background, and stored with much lower overhead than full replication.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails for hot tiny writes and latency-sensitive metadata. Replication is often cheaper when the workload needs fast updates and simple repair more than storage efficiency.',
        'It also fails when placement does not match failure domains. A 10+4 stripe is not four-rack tolerant if several shards sit in the same rack or maintenance group.',
        'Lost metadata can be fatal. Without the coding profile, shard positions, stripe membership, and checksums, the algebra does not know which equations to solve.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use a 3+2 stripe with data shards D0, D1, and D2 plus coding shards P0 and P1. The five shards are placed on five different hosts.',
        'If D1 and P0 are lost, survivors D0, D2, and P1 give k=3 equations. The decoder selects those three rows, inverts the 3 by 3 matrix, reconstructs D1, and then regenerates P0.',
        'Space overhead is 5/3, or about 1.67x. During repair, the system reads three survivor shards, spends CPU on finite-field decoding, transfers the replacement across the network, and remains one more shard loss away from data loss until repair finishes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Reed and Solomon, Polynomial Codes over Certain Finite Fields, at https://sites.math.rutgers.edu/~zeilberg/akherim/ReedS1960.pdf, NASA Reed-Solomon tutorial at https://ntrs.nasa.gov/search.jsp?R=19900019023, and CMU Reed-Solomon overview at https://www.cs.cmu.edu/~guyb/realworld/reedsolomon/reed_solomon_codes.html. These explain the original code, finite-field decoding, and practical intuition.',
        'Study Finite Fields, Matrix Inversion, Shamir Secret Sharing, Data Availability Sampling and Erasure Coding, Namespaced Merkle Trees, Ceph Erasure-Coded Pools, CRUSH Placement, S3 Object Storage, and Merkle Trees. The transfer idea is threshold reconstruction from independent evidence.',
      ],
    },
  ],
};
