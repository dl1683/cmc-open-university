// Ribbon filter: a static approximate-membership filter built by solving a
// narrow banded linear system, then querying with local word-parallel reads.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'ribbon-filter',
  title: 'Ribbon Filter',
  category: 'Data Structures',
  summary: 'A very compact static membership filter: each key writes a narrow band equation, construction solves the system, and queries test a local fingerprint.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['banded system', 'filter tradeoffs'], defaultValue: 'banded system' },
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

function ribbonGraph(title) {
  return graphState({
    nodes: [
      { id: 'keys', label: 'static key set', x: 0.7, y: 3.6, note: 'build once' },
      { id: 'band', label: 'ribbon band', x: 2.7, y: 3.6, note: 'narrow window' },
      { id: 'system', label: 'linear system', x: 4.7, y: 3.6, note: 'xor equations' },
      { id: 'solver', label: 'band solver', x: 6.6, y: 3.6, note: 'incremental elimination' },
      { id: 'table', label: 'stored bits', x: 8.5, y: 2.3, note: 'near lower bound' },
      { id: 'query', label: 'query window', x: 8.5, y: 5.0, note: 'local dot product' },
    ],
    edges: [
      { id: 'e-keys-band', from: 'keys', to: 'band', weight: 'hash start' },
      { id: 'e-band-system', from: 'band', to: 'system', weight: 'row' },
      { id: 'e-system-solver', from: 'system', to: 'solver', weight: 'solve' },
      { id: 'e-solver-table', from: 'solver', to: 'table', weight: 'assign bits' },
      { id: 'e-table-query', from: 'table', to: 'query', weight: 'read band' },
      { id: 'e-band-query', from: 'band', to: 'query', weight: 'same hash' },
    ],
  }, { title });
}

function* bandedSystem() {
  yield {
    state: ribbonGraph('Each key becomes one narrow band equation'),
    highlight: { active: ['keys', 'band', 'system', 'e-keys-band', 'e-band-system'], compare: ['solver'] },
    explanation: 'A Ribbon filter is static. During construction, each key maps to a short contiguous band of table positions and contributes one xor-style equation over those positions.',
  };

  yield {
    state: labelMatrix(
      'Toy band matrix',
      [
        { id: 'k0', label: 'key A' },
        { id: 'k1', label: 'key B' },
        { id: 'k2', label: 'key C' },
        { id: 'k3', label: 'key D' },
      ],
      [
        { id: 'c0', label: '0' },
        { id: 'c1', label: '1' },
        { id: 'c2', label: '2' },
        { id: 'c3', label: '3' },
        { id: 'c4', label: '4' },
        { id: 'c5', label: '5' },
      ],
      [
        ['1', '1', '1', '.', '.', '.'],
        ['.', '1', '1', '1', '.', '.'],
        ['.', '.', '1', '1', '1', '.'],
        ['.', '.', '.', '1', '1', '1'],
      ],
    ),
    highlight: { active: ['k1:c1', 'k1:c2', 'k1:c3'], found: ['k2:c2', 'k2:c3', 'k2:c4'] },
    explanation: 'The matrix is banded because each row touches nearby columns. That locality is why practical Ribbon construction and queries can be cache-friendly.',
    invariant: 'Every stored key gets an equation whose answer matches its target fingerprint.',
  };

  yield {
    state: ribbonGraph('The solver fills a compact table of bits'),
    highlight: { active: ['system', 'solver', 'table', 'e-system-solver', 'e-solver-table'], found: ['band'] },
    explanation: 'Construction solves the banded Boolean system. Once solved, the filter keeps only the assigned bit table; it does not need the original keys or the full matrix.',
  };

  yield {
    state: ribbonGraph('A query replays the same band and tests the fingerprint'),
    highlight: { active: ['band', 'table', 'query', 'e-table-query', 'e-band-query'], compare: ['keys'] },
    explanation: 'Lookup hashes the candidate key to the same kind of band, reads the local table positions, combines them, and compares the result to the candidate fingerprint.',
  };
}

function* filterTradeoffs() {
  yield {
    state: labelMatrix(
      'Static filter comparison',
      [
        { id: 'bloom', label: 'Bloom' },
        { id: 'xor', label: 'Xor' },
        { id: 'fuse', label: 'Binary Fuse' },
        { id: 'ribbon', label: 'Ribbon' },
      ],
      [
        { id: 'construction', label: 'construction' },
        { id: 'space', label: 'space goal' },
        { id: 'updates', label: 'updates' },
      ],
      [
        ['set bits', 'simple but overhead', 'incremental add only'],
        ['peel graph', 'compact', 'rebuild'],
        ['segmented peel', 'very compact', 'rebuild'],
        ['solve band system', 'extremely compact', 'rebuild'],
      ],
    ),
    highlight: { active: ['ribbon:construction', 'ribbon:space'], compare: ['bloom:updates', 'fuse:space'] },
    explanation: 'Ribbon filters push hard on space efficiency. The cost is that build logic is more complex and the set is static.',
  };

  yield {
    state: labelMatrix(
      'Where Ribbon fits',
      [
        { id: 'sst', label: 'immutable SSTable' },
        { id: 'manifest', label: 'object manifest' },
        { id: 'artifact', label: 'build artifact set' },
        { id: 'session', label: 'live session set' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'why', label: 'why' },
      ],
      [
        ['excellent', 'rebuilt with file'],
        ['excellent', 'published snapshot'],
        ['good', 'versioned deploy'],
        ['poor', 'frequent insert/delete'],
      ],
    ),
    highlight: { found: ['sst:fit', 'manifest:why', 'artifact:why'], compare: ['session:fit'] },
    explanation: 'Ribbon is a snapshot structure. If the membership set changes per request, use Bloom, counting Bloom, or Cuckoo filters instead.',
  };

  yield {
    state: ribbonGraph('Lower false-positive targets need more fingerprint bits'),
    highlight: { active: ['keys', 'system', 'table'], found: ['query'] },
    explanation: 'Like other filters, Ribbon trades memory for false-positive probability. More target fingerprint bits reduce false positives but increase bits per key.',
  };

  yield {
    state: labelMatrix(
      'Engineering checklist',
      [
        { id: 'seed', label: 'seed retry' },
        { id: 'load', label: 'load factor' },
        { id: 'cache', label: 'cache locality' },
        { id: 'truth', label: 'truth source' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'risk', label: 'risk if ignored' },
      ],
      [
        ['what if solve fails?', 'fragile build pipeline'],
        ['how full is table?', 'slow or failed construction'],
        ['are bands local?', 'query loses advantage'],
        ['who verifies maybe?', 'false positive becomes bug'],
      ],
    ),
    highlight: { active: ['seed:question', 'truth:risk'], found: ['cache:question'] },
    explanation: 'A production filter is more than its lookup formula. Build retries, table sizing, locality, and source-of-truth verification decide whether the structure is safe.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'banded system') yield* bandedSystem();
  else if (view === 'filter tradeoffs') yield* filterTradeoffs();
  else throw new InputError('Pick a Ribbon filter view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A membership filter answers one narrow question: is this key definitely absent, or should the system do the real lookup? That small question sits on hot paths in storage engines, package registries, object stores, malware lists, CDNs, and build systems. A good negative answer can skip disk, network, decompression, or an expensive index probe.',
        'Ribbon filters exist for the static version of that problem. The set is known at build time, published as a snapshot, and queried many times. Negatives must be exact for that snapshot. Positives may be false positives, but the false-positive rate has to be controlled. Once the set gets large, the filter itself becomes a serious memory bill, so every overhead bit per key matters.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious solution is a Bloom filter. It is easy to build, supports cheap inserts, and gives fast negative checks. For a static set, though, update friendliness may be wasted space.',
        'The wall is the lower bound. For false-positive rate f, an ideal approximate-membership structure needs about log2(1/f) bits per key. Real structures spend extra bits for construction, speed, locality, update support, and failure handling. Ribbon filters accept a more complex build so the stored representation can move closer to that bound.',
        'That trade is rational only when the set is stable. If the workload inserts and deletes keys continuously, a structure that can update in place is worth the extra memory. If the set is rebuilt in batches and then served for hours or days, build complexity can be amortized across many lookups.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Represent every key as one equation over a short contiguous band of table positions. The builder solves the banded system so each stored key produces its assigned fingerprint. The query later replays the same band and checks whether the local combination matches.',
        'The word "ribbon" points to the matrix shape. Rows touch nearby columns, making a narrow diagonal band instead of a fully scattered matrix. That locality is what lets the filter be compact while keeping lookup cache-friendly.',
        'The important shift is to stop thinking of the filter as a set of independent bit positions and start thinking of it as a solved constraint system. Stored keys become constraints. The table is the compact solution. A non-key usually fails because it asks a constraint the builder never promised to satisfy.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'Build starts with a fixed key set. A hash chooses a band start for each key and a small pattern inside that band. The row says which table cells participate in that key equation. The right-hand side is the key fingerprint.',
        'The construction algorithm solves the equations over a finite field, commonly described as xor-style linear algebra for the bit-level intuition. Practical implementations exploit the narrow band instead of materializing a dense matrix. If a seed or load choice makes the system hard to solve, the builder can retry with a new seed or larger table.',
        'After construction, lookup does not need the original equations. It hashes the candidate key, reads the same local band from the stored table, combines those values, and compares the result with the candidate fingerprint.',
        'The build pipeline therefore has two products: the serialized table and the parameters needed to replay the same mapping later, such as seed, size, band width, and fingerprint width. If any of those parameters drift between writer and reader, the filter becomes nonsense even though the bytes still parse.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For every stored key, the builder made the equation true. The query evaluates that same equation, so inserted keys pass the fingerprint check. That is the no-false-negative property for the static snapshot.',
        'Absent keys were not constraints in the solved system. Most evaluate to a different fingerprint and are rejected. A small fraction collide with the candidate fingerprint and become false positives. More fingerprint bits lower that rate and increase bits per key.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'In the toy matrix, key A touches columns 0, 1, and 2; key B touches 1, 2, and 3; key C touches 2, 3, and 4; key D touches 3, 4, and 5. The rows overlap, but only inside a narrow diagonal strip.',
        'The solver assigns table values so each row combines to its key fingerprint. Later, a query for key C reuses the C band, reads columns 2, 3, and 4, combines them, and compares with C fingerprint. A different key may hash to a band that happens to match, but that is a controlled false positive, not a missed stored key.',
      ],
    },
    {
      heading: 'Cost and tradeoff',
      paragraphs: [
        'Lookup is O(1) for a fixed band width and uses a local memory window. That locality is the practical appeal: a negative check can be fast even when the full backing store is remote or disk-backed.',
        'Construction is the tradeoff. Bloom filters set bits incrementally. Ribbon filters solve a snapshot. The build can be expected linear in practical designs, but it needs careful sizing, seed retry, and validation. The payoff is fewer overhead bits per key for static sets queried many times.',
        'False positives are paid downstream. A filter that returns "maybe" too often does not corrupt correctness, but it loses the work-saving purpose of the structure. The right memory budget is therefore an economic choice: bits per key versus avoided storage probes, network calls, or shard scans.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Ribbon filters are not mutable sets. Frequent insertions and deletions normally require building a new snapshot. If the set changes per request, a Bloom, counting Bloom, or cuckoo filter can be a better engineering choice even with higher space overhead.',
        'A maybe-present answer is not proof. Correct systems still check the authoritative store when correctness matters. Build failures, bad load factors, seed retry loops, serialization bugs, and mismatched hash versions are the operational risks to test.',
        'Another failure is using a Ribbon filter as a security boundary. Approximate membership can reduce load, but an attacker may deliberately search for false positives if that creates privilege or billing effects. Treat the filter as an optimization in front of an authority, not as the authority itself.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Ribbon filters fit immutable SSTables, object-storage shard manifests, package indexes, static denylist snapshots, compiled asset manifests, and versioned deployment artifacts. They are strongest when one build feeds many lookups.',
        'A production implementation should version every build parameter, measure false-positive rate on held-out non-keys, test seed retry behavior, and keep a fallback path when construction fails. It should also decide where the authoritative check happens after a maybe-present answer. That answer is a routing hint, not a record.',
        'An object gateway is a concrete use case. Each shard manifest contains millions of object keys. A definite negative skips that shard. A maybe-present result performs the authoritative lookup. Because manifests are published as versions, the system pays build cost once and saves memory on every serving node.',
      ],
    },
    {
      heading: 'Animation notes',
      paragraphs: [
        'The banded-system view is about shape. Each key touches a short run of columns, so the constraint matrix forms a narrow strip. That shape is not decoration; it is the reason the builder can solve compactly and the reader can query with local memory access.',
        'The solver frame shows the most important lifecycle transition. The full set of keys and equations exists during construction, but the served artifact is just the compact table plus parameters. The query frame then replays the hash-derived band and checks a fingerprint. The comparison view places Ribbon beside Bloom, Xor, and Binary Fuse filters so the static-versus-mutable tradeoff is visible.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Ribbon filter: practically smaller than Bloom and Xor at https://arxiv.org/abs/2103.02515, Fast Succinct Retrieval and Approximate Membership using Ribbon at https://arxiv.org/abs/2109.01892, SEA/LIPIcs metadata at https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.SEA.2022.4, and Meta Engineering background at https://engineering.fb.com/2021/07/09/core-infra/ribbon-filter/.',
        'Study Bloom Filter, Counting Bloom Filter, Cuckoo Filter, Xor Filter, Binary Fuse Filter, Quotient Filter, Sparse Matrix, Gaussian Elimination, LSM Trees, and Object Storage indexes next.',
      ],
    },
  ],
};
