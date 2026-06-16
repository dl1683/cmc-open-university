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
      heading: 'What it is',
      paragraphs: [
        'Reed-Solomon erasure coding protects data by adding coding shards to data shards. A stripe with k data shards and m coding shards can reconstruct from any k surviving shards, so it tolerates up to m known missing shards.',
        'The data-structure view is a stripe manifest plus finite-field linear algebra. The manifest says which object range, coding profile, shard ids, placements, and checksums belong together. The algebra makes missing shards recoverable.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A systematic storage code keeps the original data shards and computes extra coding shards as finite-field linear combinations. If some shards disappear, the decoder chooses k survivors, inverts the corresponding coding matrix, reconstructs the original data shards, and regenerates the missing coding shards.',
        'This is closely related to Shamir Secret Sharing: both use finite-field interpolation and threshold reconstruction. The storage goal is durability and space efficiency rather than secrecy. The implementation usually works over byte-oriented finite fields and uses optimized matrix routines.',
      ],
    },
    {
      heading: 'Complete case study: 3+2 stripe repair',
      paragraphs: [
        'A store splits an object range into D0, D1, and D2, then computes P0 and P1. The five shards are placed on different failure domains. Later D1 and P0 are missing. D0, D2, and P1 remain, so the system has k=3 survivors. It decodes the original data, regenerates D1 and P0, and writes replacements elsewhere.',
        'The repair is not free. It consumes reads from survivors, CPU for decoding, network bandwidth, and writes for replacement shards. During the degraded window, one more shard loss would be fatal for this 3+2 example.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Compared with three full replicas, erasure coding can sharply reduce storage overhead. The trade is more expensive degraded reads, repair traffic, small-write amplification, coding CPU, and metadata complexity. Systems often reserve erasure coding for colder or larger objects where space efficiency matters more than tiny-write latency.',
        'Erasure coding corrects erasures when missing positions are known. It is not a substitute for checksums, scrubbing, authentication, or placement discipline. Corruption must be detected before the decoder knows which shard to distrust.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Reed and Solomon, "Polynomial Codes over Certain Finite Fields" at https://sites.math.rutgers.edu/~zeilberg/akherim/ReedS1960.pdf, NASA Reed-Solomon tutorial at https://ntrs.nasa.gov/search.jsp?R=19900019023, and CMU Reed-Solomon overview at https://www.cs.cmu.edu/~guyb/realworld/reedsolomon/reed_solomon_codes.html. Study Data Availability Sampling & Erasure Coding Case Study, Namespaced Merkle Tree Proof Case Study, Shamir Secret Sharing, Ceph Erasure-Coded Pools, Ceph CRUSH Placement Case Study, S3 Object Storage Case Study, and Merkle Tree next.',
      ],
    },
  ],
};
