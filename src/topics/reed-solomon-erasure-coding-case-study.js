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
      heading: 'Why it exists',
      paragraphs: [
        'Storage systems need durability without always paying for full replication. Three replicas are simple and fast to read, but they store three full copies. At large scale, that space overhead becomes the dominant cost.',
        'Reed-Solomon erasure coding protects data by splitting it into k data shards and adding m coding shards. A stripe with k data shards and m coding shards can reconstruct from any k surviving shards, so it tolerates up to m known missing shards with less space than full replication.',
        {type:'callout', text:'Reed-Solomon trades full copies for independent equations, so any threshold-sized survivor set can reconstruct the original stripe.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/0/03/DeepSpaceFEC.png', alt:'Block diagram of a deep-space forward error correction encoder and decoder chain.', caption:'Deep-space concatenated coding system using a Reed-Solomon encoder and decoder; Kirlf, CC BY-SA 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The obvious attempt',
      paragraphs: [
        'The obvious durability plan is replication: keep two or three complete copies on different machines. Replication is easy to operate because any healthy copy can serve the full object, and repair can copy from one survivor.',
        'The wall is storage efficiency. Three replicas use 3.0x space. A 10+4 erasure-coded stripe uses 1.4x space while tolerating four shard losses. The trade is that reads, writes, and repairs now need coding math and shard coordination.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Reed-Solomon coding stores enough independent equations to recover the original data. The data shards are the unknowns. The coding shards are finite-field linear combinations of those unknowns. If any k surviving shards provide k independent equations, the decoder can solve for the original k data shards.',
        'The data-structure view is a stripe manifest plus finite-field linear algebra. The manifest says which object range, coding profile, shard ids, placements, and checksums belong together. The algebra makes missing shards recoverable.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the encode-shards view, read each parity shard as an independent equation over the data shards. The animation is not making backup copies. It is creating extra linear combinations so the original data can be solved later from any large-enough survivor set.",
        "In the recover-erasures view, the missing positions are known. That is why erasure recovery is tractable: the decoder knows which equations survived and can choose a solvable k-by-k system. Unknown corruption is a different problem and needs checksums or other detection first.",
        "The highlighted survivor set is the proof object. If it contains k independent shards for a k-of-n code, reconstruction is possible. If fewer than k trustworthy shards remain, no animation step can invent the missing information.",
      ],
    },
    {
      heading: 'Finite-field intuition',
      paragraphs: [
        'The math sounds abstract, but the storage intuition is simple. Ordinary parity can recover one missing shard by XORing the survivors. Reed-Solomon generalizes that idea so several different parity shards carry different equations. Losing one shard removes one equation or one unknown value. As long as enough independent equations survive, the decoder can solve the system.',
        'Finite fields make the arithmetic bounded and byte-friendly. Addition, multiplication, and inversion happen inside a fixed field, so encoded bytes stay bytes and matrix operations are deterministic. Implementations spend a lot of engineering effort making that math fast enough for storage repair and degraded reads.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A systematic storage code keeps the original data shards visible and appends coding shards. The encoder multiplies the data shards by a generator matrix over a finite field. The identity rows produce the data shards; the parity rows produce coding shards.',
        'If shards disappear, the decoder chooses k survivors, selects the corresponding k rows of the coding matrix, inverts that submatrix, reconstructs the original data shards, and regenerates any missing data or coding shards. Storage implementations usually work over byte-oriented finite fields and optimized matrix routines.',
        'This is closely related to Shamir Secret Sharing: both use finite-field interpolation and threshold reconstruction. The storage goal is durability and space efficiency rather than secrecy.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness condition is independence. Reed-Solomon codes choose evaluation points or matrix rows so the needed k-by-k survivor matrix is invertible. Invertibility means there is exactly one original data vector consistent with the k surviving shards.',
        'The word erasure matters. The decoder knows which shard positions are missing. That is easier than arbitrary corruption, where a bad shard may be present but wrong. Real systems pair erasure coding with checksums, scrubbing, and placement rules so the decoder knows which shards to trust.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Compared with three full replicas, erasure coding can sharply reduce storage overhead. The trade is more expensive degraded reads, repair traffic, small-write amplification, coding CPU, and metadata complexity.',
        'When a shard is missing, repair reads k surviving shards, decodes, and writes replacement shards. During that degraded window, the system has less failure budget left. For a 3+2 stripe with two losses, one more shard loss means data loss.',
        'Small writes are especially awkward because updating part of a stripe may require read-modify-write work across data and coding shards. Systems often reserve erasure coding for colder or larger objects where space efficiency matters more than tiny-write latency.',
        'Durability is also placement-dependent. A 10+4 code is not a 10+4 failure-domain guarantee if many shards sit in the same rack, power zone, or maintenance group. The coding profile and the placement policy have to be designed together.',
      ],
    },
    {
      heading: 'Operational concerns',
      paragraphs: [
        'A production system needs a stripe manifest, shard checksums, coding profile version, placement metadata, repair priority, and scrubbing. The decoder cannot help if it does not know which shards belong together or if it trusts a corrupt survivor.',
        'Repair scheduling matters because degraded stripes have reduced safety margin. A system that saves space with erasure coding but repairs slowly may spend too long one failure away from data loss. The right design balances space overhead, repair bandwidth, rebuild time, and failure-domain diversity.',
        'Choosing k and m is therefore a product decision. Larger k improves storage efficiency but makes repair read more survivors and can increase degraded-read cost. Larger m increases failure tolerance but adds space and write overhead. The best profile depends on object size, repair bandwidth, failure domains, and how quickly the system can replace missing shards.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Reed-Solomon wins for large stored objects, cold data, archives, backup systems, object stores, and distributed storage pools where space efficiency dominates the extra CPU and repair coordination.',
        'It also wins when failure domains are well understood. Placing shards across disks, hosts, racks, or zones lets the m coding shards buy real durability instead of protecting against only independent disk failures on paper.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It is the wrong default for hot tiny writes, latency-sensitive metadata, or workloads that cannot tolerate degraded-read amplification. Replication may be cheaper in latency and operational simplicity even when it costs more space.',
        'It also fails if metadata is lost, placement is careless, or corruption is not detected. The decoder needs the coding profile, stripe membership, shard positions, and trustworthy survivor set before the math helps.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A store splits an object range into D0, D1, and D2, then computes P0 and P1. The five shards are placed on different failure domains. Later D1 and P0 are missing. D0, D2, and P1 remain, so the system has k=3 survivors.',
        'The decoder uses those survivors to solve for the original data, regenerates D1 and P0, and writes replacements elsewhere. The repair consumes reads from survivors, CPU for decoding, network bandwidth, and writes for replacement shards. Until repair finishes, the 3+2 stripe is one loss away from failure.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Reed and Solomon, "Polynomial Codes over Certain Finite Fields" at https://sites.math.rutgers.edu/~zeilberg/akherim/ReedS1960.pdf, NASA Reed-Solomon tutorial at https://ntrs.nasa.gov/search.jsp?R=19900019023, and CMU Reed-Solomon overview at https://www.cs.cmu.edu/~guyb/realworld/reedsolomon/reed_solomon_codes.html.',
        'Study Data Availability Sampling & Erasure Coding Case Study for blockchain availability, Namespaced Merkle Tree Proof Case Study for proof-oriented storage metadata, Shamir Secret Sharing for threshold reconstruction with secrecy, Ceph Erasure-Coded Pools for a production storage system, Ceph CRUSH Placement Case Study for failure-domain placement, S3 Object Storage Case Study for object durability, and Merkle Tree for integrity summaries.',
      ],
    },
  ],
};
