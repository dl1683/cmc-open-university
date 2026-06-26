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
  const graph = ribbonGraph('Each key becomes one narrow band equation');
  const nodeCount = graph.graph.nodes.length;
  const edgeCount = graph.graph.edges.length;

  yield {
    state: graph,
    highlight: { active: ['keys', 'band', 'system', 'e-keys-band', 'e-band-system'], compare: ['solver'] },
    explanation: `A Ribbon filter is static. During construction, each key maps to a short contiguous band of table positions and contributes one xor-style equation over those ${nodeCount} pipeline stages.`,
  };

  const keys = [
    { id: 'k0', label: 'key A' },
    { id: 'k1', label: 'key B' },
    { id: 'k2', label: 'key C' },
    { id: 'k3', label: 'key D' },
  ];
  const columns = [
    { id: 'c0', label: '0' },
    { id: 'c1', label: '1' },
    { id: 'c2', label: '2' },
    { id: 'c3', label: '3' },
    { id: 'c4', label: '4' },
    { id: 'c5', label: '5' },
  ];
  const bandWidth = 3;

  yield {
    state: labelMatrix(
      'Toy band matrix',
      keys,
      columns,
      [
        ['1', '1', '1', '.', '.', '.'],
        ['.', '1', '1', '1', '.', '.'],
        ['.', '.', '1', '1', '1', '.'],
        ['.', '.', '.', '1', '1', '1'],
      ],
    ),
    highlight: { active: ['k1:c1', 'k1:c2', 'k1:c3'], found: ['k2:c2', 'k2:c3', 'k2:c4'] },
    explanation: `The ${keys.length} x ${columns.length} matrix is banded because each row touches only ${bandWidth} nearby columns. That locality is why practical Ribbon construction and queries can be cache-friendly.`,
    invariant: `Every stored key gets an equation over ${bandWidth} contiguous columns whose answer matches its target fingerprint.`,
  };

  const solverGraph = ribbonGraph('The solver fills a compact table of bits');
  const solverEdges = solverGraph.graph.edges.length;

  yield {
    state: solverGraph,
    highlight: { active: ['system', 'solver', 'table', 'e-system-solver', 'e-solver-table'], found: ['band'] },
    explanation: `Construction solves the banded Boolean system across ${solverEdges} connections. Once solved, the filter keeps only the assigned bit table; it does not need the original ${keys.length} keys or the full matrix.`,
  };

  const queryGraph = ribbonGraph('A query replays the same band and tests the fingerprint');
  const queryNodes = queryGraph.graph.nodes.length;

  yield {
    state: queryGraph,
    highlight: { active: ['band', 'table', 'query', 'e-table-query', 'e-band-query'], compare: ['keys'] },
    explanation: `Lookup hashes the candidate key to the same kind of ${bandWidth}-wide band, reads the local table positions from the ${queryNodes}-stage pipeline, combines them, and compares the result to the candidate fingerprint.`,
  };
}

function* filterTradeoffs() {
  const filters = [
    { id: 'bloom', label: 'Bloom' },
    { id: 'xor', label: 'Xor' },
    { id: 'fuse', label: 'Binary Fuse' },
    { id: 'ribbon', label: 'Ribbon' },
  ];
  const comparisonAxes = [
    { id: 'construction', label: 'construction' },
    { id: 'space', label: 'space goal' },
    { id: 'updates', label: 'updates' },
  ];

  yield {
    state: labelMatrix(
      'Static filter comparison',
      filters,
      comparisonAxes,
      [
        ['set bits', 'simple but overhead', 'incremental add only'],
        ['peel graph', 'compact', 'rebuild'],
        ['segmented peel', 'very compact', 'rebuild'],
        ['solve band system', 'extremely compact', 'rebuild'],
      ],
    ),
    highlight: { active: ['ribbon:construction', 'ribbon:space'], compare: ['bloom:updates', 'fuse:space'] },
    explanation: `Comparing ${filters.length} filter families across ${comparisonAxes.length} axes, Ribbon pushes hardest on space efficiency. The cost is that build logic is more complex and the set is static.`,
  };

  const useCases = [
    { id: 'sst', label: 'immutable SSTable' },
    { id: 'manifest', label: 'object manifest' },
    { id: 'artifact', label: 'build artifact set' },
    { id: 'session', label: 'live session set' },
  ];
  const fitColumns = [
    { id: 'fit', label: 'fit' },
    { id: 'why', label: 'why' },
  ];

  yield {
    state: labelMatrix(
      'Where Ribbon fits',
      useCases,
      fitColumns,
      [
        ['excellent', 'rebuilt with file'],
        ['excellent', 'published snapshot'],
        ['good', 'versioned deploy'],
        ['poor', 'frequent insert/delete'],
      ],
    ),
    highlight: { found: ['sst:fit', 'manifest:why', 'artifact:why'], compare: ['session:fit'] },
    explanation: `Ribbon is a snapshot structure. Across ${useCases.length} use cases, it fits only where the membership set is rebuilt in batches, not mutated per request.`,
  };

  const fpGraph = ribbonGraph('Lower false-positive targets need more fingerprint bits');
  const fpNodeCount = fpGraph.graph.nodes.length;

  yield {
    state: fpGraph,
    highlight: { active: ['keys', 'system', 'table'], found: ['query'] },
    explanation: `Like all ${filters.length} filter families above, Ribbon trades memory for false-positive probability across its ${fpNodeCount}-stage pipeline. More target fingerprint bits reduce false positives but increase bits per key.`,
  };

  const checklistItems = [
    { id: 'seed', label: 'seed retry' },
    { id: 'load', label: 'load factor' },
    { id: 'cache', label: 'cache locality' },
    { id: 'truth', label: 'truth source' },
  ];
  const checklistColumns = [
    { id: 'question', label: 'question' },
    { id: 'risk', label: 'risk if ignored' },
  ];

  yield {
    state: labelMatrix(
      'Engineering checklist',
      checklistItems,
      checklistColumns,
      [
        ['what if solve fails?', 'fragile build pipeline'],
        ['how full is table?', 'slow or failed construction'],
        ['are bands local?', 'query loses advantage'],
        ['who verifies maybe?', 'false positive becomes bug'],
      ],
    ),
    highlight: { active: ['seed:question', 'truth:risk'], found: ['cache:question'] },
    explanation: `A production filter is more than its lookup formula. These ${checklistItems.length} concerns -- ${checklistItems.map(c => c.label).join(', ')} -- decide whether the structure is safe.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a static key set being turned into a compact membership filter. A membership filter answers whether a key is definitely absent or maybe present, so every highlighted band represents one key constraint that must be satisfied by the final bit table.',
        {type: 'callout', text: 'Ribbon filters turn static membership into a narrow linear system, then serve only the solved bits and query parameters.'},
        'Active cells are the positions touched by the current key. Found cells show overlap with another key, which is where the linear system has to reconcile constraints instead of storing each key separately.',
        'Read the query frame as a proof replay. The candidate key hashes to the same kind of short band, the filter combines those table cells with XOR, and a fingerprint match means maybe present while a mismatch means definitely absent.',
        {type: 'image', src: './assets/gifs/ribbon-filter.gif', alt: 'Animated walkthrough of the ribbon filter visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large storage systems often need to avoid work before they touch the real index. If a database file cannot contain a key, a small filter can skip a disk read, decompression step, or remote lookup.',
        'Ribbon filters exist for static sets, meaning the keys are known before the filter is served. That lets construction spend extra time solving a compact representation, because the saved bits are paid back on every query across every copy of the filter.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The usual approximate-membership structure is a Bloom filter. It hashes each stored key to several bit positions, sets those bits, and answers absent when any queried bit is zero.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Bloom_filter.svg/500px-Bloom_filter.svg.png', alt: 'Bloom filter diagram with three keys setting bits and a query key missing one bit', caption: 'A Bloom filter is the baseline approximate-membership structure: several hash probes set and test bits. Source: https://commons.wikimedia.org/wiki/File:Bloom_filter.svg.'},
        'Bloom filters are good when keys arrive over time. Each insertion only sets a few bits, so the filter can grow with the workload without rebuilding from the full key list.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is wasted information. A filter with false-positive rate f needs at least log2(1/f) bits per key in theory, so a 1 percent filter has a lower bound of about 6.64 bits per key.',
        'A standard Bloom filter at the same 1 percent target uses about 9.6 bits per key. On one million keys that gap is about 2.96 million bits, or 370 KB, and on one thousand replicated filters it becomes hundreds of megabytes of memory that stores no extra truth.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A static filter can be built as equations instead of as independent bit settings. Each key becomes a row in a linear system over GF(2), where GF(2) means arithmetic with bits and XOR as addition.',
        'Ribbon makes those rows narrow and local. Because every row touches a short consecutive band of columns, solving the system is close to linear-time elimination instead of dense matrix work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each key, hashing chooses a start column, a small coefficient pattern, and a fingerprint. The coefficient pattern says which positions in the band are XORed together, and the fingerprint is the value that XOR must equal for that key.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Matrix_multiplication_diagram.svg/250px-Matrix_multiplication_diagram.svg.png', alt: 'Matrix multiplication diagram with rows and columns combining', caption: 'Ribbon construction is linear algebra over bits: rows constrain table positions and the solution becomes the served filter. Source: https://commons.wikimedia.org/wiki/File:Matrix_multiplication_diagram.svg.'},
        'The builder performs Gaussian elimination on the banded system. Gaussian elimination is the process of combining equations to isolate unknowns, and the band keeps each combination near its original row.',
        'After solving, the served filter stores the solved table, the hash seed, the table size, the band width, and the fingerprint width. It does not store the original keys or the full system of equations.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Every stored key was one row in the solved system. When a query repeats that row, the same table cells XOR to the stored fingerprint, so a key from the snapshot cannot be rejected.',
        'A key that was not in the snapshot creates a new row that was not constrained during solving. Its computed XOR matches its fingerprint only by chance, and r fingerprint bits make that chance about 1 in 2^r.',
        'The correctness argument is exact for negatives and probabilistic for positives. Exact solving gives no false negatives for the built set, while random fingerprints bound the false-positive rate for absent keys.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Query time is constant for a fixed band width. The query hashes once, reads a short contiguous window, XORs selected bits, and compares the result with the fingerprint.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Bloom_filter_fp_probability.svg/500px-Bloom_filter_fp_probability.svg.png', alt: 'False positive probability curves for Bloom filter parameters', caption: 'False-positive targets are memory targets: lower error rates require more stored information per key. Source: https://commons.wikimedia.org/wiki/File:Bloom_filter_fp_probability.svg.'},
        'Construction is roughly O(n * w), where n is the number of keys and w is the band width. If w is 128 and n is 1,000,000, the build performs on the order of 128 million bit-level operations, while doubling n roughly doubles build work.',
        'The behavior tradeoff is batch work for serving memory. Bloom spends less work at build time and more bits forever; Ribbon spends more work once and then serves a smaller filter on every read.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Ribbon fits immutable storage files such as SSTables in log-structured merge trees. The file is written once, the filter is built once, and later reads use the filter to skip files that cannot contain the key.',
        'The same shape appears in package indexes, object-shard manifests, build artifact catalogs, and static denylist snapshots. In each case the set changes by publishing a new version, not by mutating the served filter in place.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Ribbon is the wrong tool for a set that changes continuously. One insertion can invalidate the solved system, so updates require rebuilding from the new complete key set.',
        'It also raises implementation risk. Hash quality, seed retry, serialization, and version compatibility all matter because a reader using different parameters will compute confident nonsense.',
        'A maybe-present answer is never proof. If a false positive grants access or skips an authoritative check, the bug is in the system design, not in the filter.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a static set has 1,000,000 keys and wants a 1 percent false-positive rate. The lower bound is log2(100), about 6.64 bits per key, so an ideal filter would need about 6.64 million bits or 830 KB.',
        'A Bloom filter at this target uses about 9.6 bits per key, or 1.2 MB. A Ribbon filter near 6.7 bits per key uses about 837 KB, so the saving is roughly 363 KB for one file-level filter.',
        'During a query, key x hashes to start column 420, coefficient pattern 101101, and fingerprint 37. The reader XORs the solved cells selected inside that band; if the result is 12, x is definitely absent, and if it is 37, the system performs the real lookup because x is only maybe present.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Dillinger and Walzer, Ribbon filter: practically smaller than Bloom and Xor, 2021; Fast Succinct Retrieval and Approximate Membership using Ribbon, 2021; Meta Engineering, Ribbon filter in RocksDB, 2021.',
        'Study next by role. Read Bloom Filter for the mutable baseline, Xor Filter or Binary Fuse Filter for static alternatives, GF(2) Linear Algebra for the build step, and LSM Tree or SSTable topics for the storage workload where Ribbon pays off.',
      ],
    },
  ],
};
