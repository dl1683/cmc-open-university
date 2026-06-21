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
        'The banded-system view shows the shape that makes Ribbon filters possible. Each key maps to a short contiguous run of columns in the constraint matrix, so the matrix forms a narrow diagonal strip instead of a scattered cloud of ones. Active cells (highlighted) show which table positions participate in one key\'s equation. Found cells show an overlapping neighbor. The strip shape is the reason construction can solve compactly and queries can read a local memory window.',
        {type: 'callout', text: 'Ribbon filters turn static membership into a narrow linear system, then serve only the solved bits and query parameters.'},
        'The solver frame shows the lifecycle transition that matters most. During construction, keys and equations exist together. The served artifact is just the compact bit table plus a small set of parameters. The query frame replays the same hash-derived band, reads local table cells, and checks whether the combined result matches the candidate fingerprint.',
        'The filter-tradeoffs view places Ribbon beside Bloom, Xor, and Binary Fuse filters. Compare the "space goal" column: Ribbon pushes hardest toward the information-theoretic lower bound, at the cost of a more complex build step. The "updates" column is the critical tradeoff -- Bloom supports incremental adds; every other filter in the table requires a full rebuild.',
      
        {type: 'image', src: './assets/gifs/ribbon-filter.gif', alt: 'Animated walkthrough of the ribbon filter visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A membership filter answers one question: is this key definitely absent, or should the system do the real lookup? That question sits on hot paths in storage engines, package registries, object stores, CDNs, and build systems. A definite negative skips disk I/O, network calls, decompression, or an expensive index probe.',
        'Ribbon filters target the static version of the problem. The key set is known at build time, published as a snapshot, and queried many times before the next rebuild. Negatives must be exact for that snapshot. Positives may be false, but the false-positive rate must be controlled. When the set grows to millions of keys, even one wasted bit per key costs real memory across every serving node, so overhead per key is the metric that matters.',
        {
          type: 'quote',
          text: 'Ribbon filter: practically smaller than Bloom and Xor',
          attribution: 'Peter C. Dillinger and Stefan Walzer, 2021',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The standard answer is a Bloom filter. Hash each key to k bit positions in a bit array, set those bits during construction, and test them during lookup. If any bit is zero the key is absent. Bloom filters are easy to implement, support incremental inserts, and give fast negative checks. They have been the default approximate-membership structure for decades.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Bloom_filter.svg/500px-Bloom_filter.svg.png', alt: 'Bloom filter diagram with three keys setting bits and a query key missing one bit', caption: 'A Bloom filter is the baseline approximate-membership structure: several hash probes set and test bits. Source: https://commons.wikimedia.org/wiki/File:Bloom_filter.svg.'},
        'For a mutable, growing set, Bloom is hard to beat. It handles inserts without rebuilding, needs no sorting or batching, and the implementation fits in a few dozen lines. Engineers reach for it because it works immediately and fails gracefully.',
        'Cuckoo filters improve on Bloom by supporting deletion and offering better space efficiency at low false-positive rates. Xor filters push space further for static sets by encoding keys into a random hypergraph and peeling the solution. Each generation trades something -- update support, build complexity, or construction reliability -- for fewer bits per key.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The information-theoretic lower bound is the wall. For a false-positive rate f, an ideal filter needs at least log2(1/f) bits per key. A standard Bloom filter at 1% false-positive rate uses about 9.6 bits per key; the lower bound is 6.64 bits. That 44% overhead is wasted memory on every node that hosts the filter.',
        'Xor filters close the gap substantially (about 1.23 * log2(1/f) bits per key), but their random-hypergraph construction can fail and require retry, and they still carry some structural overhead. The question Dillinger and Walzer asked in 2021 was whether a different algebraic structure -- a banded linear system over GF(2) -- could push even closer to the bound while keeping construction reliable and queries fast.',
        'The wall is not "Bloom is bad." The wall is that every bit of overhead per key, multiplied by millions of keys, multiplied by hundreds of serving nodes, adds up to gigabytes of RAM that buys nothing. Ribbon filters exist because that multiplication matters at scale.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Construction takes a static key set. For each key, a hash function produces two things: a start position in the table (the band offset) and a short bit pattern (the coefficient row). The row says which table cells participate in that key\'s equation. A separate hash produces the key\'s fingerprint, which becomes the right-hand side of the equation. The result is a system of linear equations over GF(2) -- exclusive-or arithmetic where addition and subtraction are the same operation.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Matrix_multiplication_diagram.svg/250px-Matrix_multiplication_diagram.svg.png', alt: 'Matrix multiplication diagram with rows and columns combining', caption: 'Ribbon construction is linear algebra over bits: rows constrain table positions and the solution becomes the served filter. Source: https://commons.wikimedia.org/wiki/File:Matrix_multiplication_diagram.svg.'},
        {
          type: 'diagram',
          label: 'Banded matrix and Gaussian elimination',
          text: [
            'Key set: {A, B, C, D}    Band width w = 3    Table slots: 6',
            '',
            'Banding step -- each key hashes to a start position:',
            '              col:  0  1  2  3  4  5     fingerprint',
            '  key A (start=0):  1  1  1  .  .  .  |  f_A',
            '  key B (start=1):  .  1  0  1  .  .  |  f_B',
            '  key C (start=2):  .  .  1  1  1  .  |  f_C',
            '  key D (start=3):  .  .  .  1  0  1  |  f_D',
            '',
            'Gaussian elimination (top to bottom, band-local):',
            '  Row A: pivot on col 0 -> solve for slot 0',
            '  Row B: pivot on col 1 -> solve for slot 1',
            '  Row C: pivot on col 2 -> solve for slot 2',
            '  Row D: pivot on col 3 -> solve for slot 3',
            '',
            'Back-substitution assigns values to slots 0-5',
            'so each row XORs to its target fingerprint.',
          ].join('\n'),
        },
        'The key property is the banded structure. Because each row starts at a different position and touches only w consecutive columns, the matrix is almost lower-triangular. Gaussian elimination processes rows top to bottom, and each pivot only interacts with the few rows whose bands overlap. This makes construction O(n * w) in practice -- linear in the number of keys for a fixed band width.',
        'If the system is unsolvable for a given seed (a rare event when the table is slightly oversized), the builder retries with a new hash seed. The RocksDB implementation typically uses a table about 1-2% larger than the number of keys, which makes construction failure negligible.',
        'After construction, the filter stores only the solved table values and the build parameters (seed, table size, band width, fingerprint width). The original keys and the full matrix are discarded.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For every stored key, the builder solved the system so that the XOR of the key\'s band positions equals its fingerprint. The query replays the same hash, reads the same band from the table, XORs the values, and checks the result. Stored keys always pass -- that is the no-false-negative guarantee for the static snapshot.',
        'An absent key was never a constraint in the solved system. Its band positions hold values that were determined by other keys\' equations. The XOR of those values matches the absent key\'s fingerprint only by coincidence. With r fingerprint bits, that probability is 2^(-r), giving a false-positive rate of 1/2^r. More fingerprint bits mean lower false positives but more bits per key.',
        'The correctness argument is algebraic: the system Ax = b was solved exactly, so every row of A dot x equals the corresponding entry of b. Non-member keys produce random rows that are almost certainly not in the row space of A restricted to their fingerprint, so they fail the check with high probability.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Bloom at 1 percent false positives: about 9.6 bits per key, simple incremental adds, and scattered k-probe lookups.',
            'Cuckoo filter: roughly 7.2 bits per key in common settings, supports add and delete, and pays for kick chains during construction.',
            'Xor filter: about 1.23 times the lower bound, static build by peeling a random hypergraph, and full rebuilds for updates.',
            'Ribbon filter: about 6.7 bits per key at 1 percent false positives, static build by solving a banded system, and one local band read at query time.',
          ],
        },
        'Query cost is O(1) with a fixed band width w (typically 64 or 128 bits to match a machine word). The lookup reads w contiguous bits from the table, masks them with the coefficient pattern, XORs the result, and compares against the fingerprint. That is one cache line or two, making it competitive with or faster than Bloom\'s scattered probes.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Bloom_filter_fp_probability.svg/500px-Bloom_filter_fp_probability.svg.png', alt: 'False positive probability curves for Bloom filter parameters', caption: 'False-positive targets are memory targets: lower error rates require more stored information per key. Source: https://commons.wikimedia.org/wiki/File:Bloom_filter_fp_probability.svg.'},
        'Construction is O(n * w) for n keys. For w = 128 and a million keys, that is roughly 128 million XOR operations -- fast on modern hardware. The tradeoff versus Bloom is clear: Bloom builds incrementally in O(k) per key; Ribbon requires the full key set upfront and a batch solve. The payoff is that Ribbon stores nearly the information-theoretic minimum: about 6.7 bits per key at 1% false-positive rate, versus Bloom\'s 9.6.',
        'Memory during construction is the hidden cost. The builder needs to hold the banded matrix in memory (n * w bits) plus the key hashes. For very large sets, this can be significant. The served filter, however, is smaller than any Bloom filter for the same false-positive rate.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Ribbon filters were adopted by RocksDB (Meta/Facebook) starting in 2021 as the default filter for new SST files. Each SST file is immutable once written, so the static-set requirement is naturally satisfied. The filter is built once during compaction and queried millions of times during reads. At 1% false-positive rate, switching from Bloom to Ribbon saved roughly 30% of filter memory across the fleet.',
        'The pattern generalizes to any system where membership sets are published as versioned snapshots: object-storage shard manifests (each manifest lists millions of object keys; a definite negative skips the shard), package registry indexes (the set of published package names changes only at publish time), compiled asset manifests in build systems, and static denylist snapshots for content moderation.',
        {
          type: 'bullets',
          items: [
            'Immutable SST files in LSM-tree storage engines (RocksDB, LevelDB descendants)',
            'Object-storage shard manifests where a negative skips an entire shard lookup',
            'Package and artifact registries rebuilt on each publish cycle',
            'Static denylist snapshots for URL filtering, malware hashes, or content moderation',
            'CDN edge caches where a filter avoids origin round-trips for absent objects',
          ],
        },
        'The common thread is: build once, query many times, rebuild on version change. If your workload fits that shape and you are memory-constrained, Ribbon is the current best choice for bits per key.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Ribbon filters cannot be updated in place. Every insertion or deletion requires rebuilding the entire filter from the new key set. If the membership set changes per request or per second, a Bloom filter (add-only) or cuckoo filter (add and delete) is the right tool despite higher space overhead.',
        'Build complexity is real. The implementation is harder to get right than a Bloom filter. Hash function quality matters more -- a bad hash can create unsolvable systems. Seed retry logic must be tested. Serialization must version every parameter (seed, table size, band width, fingerprint width); if any parameter drifts between writer and reader, the filter silently returns garbage.',
        'A maybe-present answer is not proof. Systems that treat it as proof have a correctness bug proportional to the false-positive rate. This is true of all approximate-membership filters, but Ribbon\'s near-optimal space can tempt engineers to lower the fingerprint width too far, raising false-positive rates past the point where the authoritative fallback can absorb the load.',
        {
          type: 'note',
          text: 'Never use an approximate-membership filter as a security boundary. An attacker can search for false positives deliberately. If a false positive grants access, triggers billing, or bypasses rate limiting, the filter is a vulnerability, not an optimization.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Dillinger and Walzer, "Ribbon filter: practically smaller than Bloom and Xor" (2021) -- https://arxiv.org/abs/2103.02515',
            'Dillinger and Walzer, "Fast Succinct Retrieval and Approximate Membership using Ribbon" (2021) -- https://arxiv.org/abs/2109.01892',
            'SEA/LIPIcs conference version -- https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.SEA.2022.4',
            'Meta Engineering blog post on Ribbon adoption in RocksDB -- https://engineering.fb.com/2021/07/09/core-infra/ribbon-filter/',
            'RocksDB wiki on configuring Ribbon filters -- https://github.com/facebook/rocksdb/wiki/RocksDB-Bloom-Filter',
          ],
        },
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Ribbon filter query (simplified pseudocode)',
            'function ribbonQuery(key, table, seed, bandWidth, fpBits) {',
            '  const h = hash(key, seed);',
            '  const start = h.position % (table.length - bandWidth);',
            '  const coeffs = h.coefficients;  // bandWidth-bit pattern',
            '  let result = 0;',
            '  for (let i = 0; i < bandWidth; i++) {',
            '    if ((coeffs >> i) & 1) {',
            '      result ^= table[start + i];',
            '    }',
            '  }',
            '  const fingerprint = h.fingerprint & ((1 << fpBits) - 1);',
            '  return result === fingerprint;  // true = maybe present',
            '}',
          ].join('\n'),
        },
        'Prerequisites: study Bloom Filter for the baseline approximate-membership model, Gaussian Elimination for the linear-algebra machinery, and XOR Filter for the static-set predecessor. Extensions: Binary Fuse Filter (segmented variant of Xor), Cuckoo Filter (mutable alternative), Quotient Filter (cache-friendly mutable alternative). Production context: LSM Trees (where SST-level filters live), Sparse Matrix representations, and Object Storage architecture.',
      ],
    },
  ],
};
