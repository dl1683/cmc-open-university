// Xor filter: a static approximate-membership filter built by peeling a
// 3-uniform hypergraph and assigning fingerprints in reverse order.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'xor-filter',
  title: 'Xor Filter',
  category: 'Data Structures',
  summary: 'A compact static membership filter: three table positions xor to a fingerprint, giving fast no-false-negative queries after construction.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['peeling build', 'membership query'], defaultValue: 'peeling build' },
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

function hypergraph(title) {
  return graphState({
    nodes: [
      { id: 'kA', label: 'key A', x: 0.8, y: 1.6, note: 'degree 3' },
      { id: 'kB', label: 'key B', x: 0.8, y: 3.7, note: 'degree 3' },
      { id: 'kC', label: 'key C', x: 0.8, y: 5.8, note: 'degree 3' },
      { id: 's0', label: 'slot 0', x: 3.1, y: 1.0, note: 'fingerprint byte' },
      { id: 's1', label: 'slot 1', x: 3.1, y: 2.2, note: 'fingerprint byte' },
      { id: 's2', label: 'slot 2', x: 3.1, y: 3.4, note: 'fingerprint byte' },
      { id: 's3', label: 'slot 3', x: 3.1, y: 4.6, note: 'fingerprint byte' },
      { id: 's4', label: 'slot 4', x: 3.1, y: 5.8, note: 'fingerprint byte' },
      { id: 'stack', label: 'peel stack', x: 6.4, y: 3.5, note: 'reverse assignment' },
      { id: 'table', label: 'xor table', x: 8.7, y: 3.5, note: 'final filter' },
    ],
    edges: [
      { id: 'e-A-0', from: 'kA', to: 's0', weight: 'h1' },
      { id: 'e-A-2', from: 'kA', to: 's2', weight: 'h2' },
      { id: 'e-A-4', from: 'kA', to: 's4', weight: 'h3' },
      { id: 'e-B-1', from: 'kB', to: 's1', weight: 'h1' },
      { id: 'e-B-2', from: 'kB', to: 's2', weight: 'h2' },
      { id: 'e-B-3', from: 'kB', to: 's3', weight: 'h3' },
      { id: 'e-C-0', from: 'kC', to: 's0', weight: 'h1' },
      { id: 'e-C-3', from: 'kC', to: 's3', weight: 'h2' },
      { id: 'e-C-4', from: 'kC', to: 's4', weight: 'h3' },
      { id: 'e-stack-table', from: 'stack', to: 'table', weight: 'reverse fill' },
    ],
  }, { title });
}

function* peelingBuild() {
  yield {
    state: hypergraph('Each key touches three candidate slots'),
    highlight: { active: ['kA', 'e-A-0', 'e-A-2', 'e-A-4'], compare: ['kB', 'kC'] },
    explanation: 'An xor filter maps every key to three table positions plus a small fingerprint. Construction views this as a hypergraph: keys are edges connected to three slot vertices.',
  };

  yield {
    state: labelMatrix(
      'Peeling degree-one slots',
      [
        { id: 'round1', label: 'round 1' },
        { id: 'round2', label: 'round 2' },
        { id: 'round3', label: 'round 3' },
        { id: 'fail', label: 'cycle case' },
      ],
      [
        { id: 'find', label: 'find' },
        { id: 'push', label: 'push' },
        { id: 'remove', label: 'remove' },
      ],
      [
        ['slot with one remaining key', 'push that key', 'delete its three incidences'],
        ['new degree-one slots appear', 'push next key', 'keep peeling'],
        ['all keys peeled', 'build succeeds', 'assign in reverse'],
        ['no degree-one slot', 'graph core remains', 'retry with new hash seed'],
      ],
    ),
    highlight: { active: ['round1:find', 'round1:push', 'round2:find'], compare: ['fail:find'] },
    explanation: 'The build succeeds when the hypergraph can be peeled down to nothing. If a cyclic core remains, the implementation retries with a new hash seed or larger table.',
    invariant: 'Xor filters buy very compact queries by doing a one-time static construction.',
  };

  yield {
    state: hypergraph('Reverse assignment makes each key equation true'),
    highlight: { active: ['stack', 'table', 'e-stack-table'], found: ['s0', 's2', 's4'] },
    explanation: 'After peeling, process keys in reverse order. For each key, two of its slots are already fixed, so choose the remaining slot value that makes slot[h1] xor slot[h2] xor slot[h3] equal the key fingerprint.',
  };

  yield {
    state: labelMatrix(
      'Filter family comparison',
      [
        { id: 'bloom', label: 'Bloom filter' },
        { id: 'cuckoo', label: 'cuckoo filter' },
        { id: 'xor', label: 'xor filter' },
        { id: 'fuse', label: 'binary fuse' },
      ],
      [
        { id: 'updates', label: 'updates' },
        { id: 'query', label: 'query' },
        { id: 'space', label: 'space profile' },
      ],
      [
        ['append-friendly', 'k bit probes', 'simple and robust'],
        ['insert/delete possible', 'fingerprint lookup', 'compact but insertion can fail'],
        ['static/rebuild', '3 reads + xor', 'very compact'],
        ['static/rebuild', 'few reads', 'newer, often smaller'],
      ],
    ),
    highlight: { found: ['xor:query', 'xor:space'], compare: ['bloom:updates', 'cuckoo:updates'] },
    explanation: 'Xor filters are not a drop-in replacement for every Bloom filter. They are best when the set is built once, queried many times, and rebuilt rather than updated incrementally.',
  };
}

function* membershipQuery() {
  yield {
    state: labelMatrix(
      'Query one key',
      [
        { id: 'hash', label: 'hash positions' },
        { id: 'load', label: 'load bytes' },
        { id: 'xor', label: 'xor bytes' },
        { id: 'compare', label: 'compare' },
      ],
      [
        { id: 'example', label: 'example' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['h1=0, h2=2, h3=4', 'three deterministic slots'],
        ['table[0], table[2], table[4]', 'small fingerprints'],
        ['v0 xor v2 xor v4', 'reconstruct candidate fingerprint'],
        ['equals f(key)?', 'maybe present or definitely absent'],
      ],
    ),
    highlight: { active: ['load:example', 'xor:example', 'compare:example'], found: ['compare:meaning'] },
    explanation: 'A query performs three table reads and one xor chain. If the reconstructed fingerprint matches the key fingerprint, answer maybe present; otherwise answer definitely absent.',
  };

  yield {
    state: hypergraph('Present key reconstructs its fingerprint'),
    highlight: { active: ['kA', 's0', 's2', 's4', 'e-A-0', 'e-A-2', 'e-A-4'], found: ['table'] },
    explanation: 'For a stored key, construction guaranteed the xor equation. That is why xor filters have no false negatives for the immutable set used to build the table.',
  };

  yield {
    state: labelMatrix(
      'Error semantics',
      [
        { id: 'present', label: 'stored key' },
        { id: 'absentmiss', label: 'absent, no match' },
        { id: 'absentfp', label: 'absent, fingerprint match' },
        { id: 'mutate', label: 'new key after build' },
      ],
      [
        { id: 'answer', label: 'answer' },
        { id: 'correctness', label: 'correctness' },
      ],
      [
        ['maybe present', 'true positive'],
        ['definitely absent', 'true negative'],
        ['maybe present', 'false positive'],
        ['not represented', 'rebuild needed'],
      ],
    ),
    highlight: { active: ['present:correctness', 'absentfp:correctness'], compare: ['mutate:correctness'] },
    explanation: 'The guarantee matches Bloom Filter semantics: false positives are possible; false negatives for the built set are not. Updates change the set, so the filter must be rebuilt or replaced.',
  };

  yield {
    state: labelMatrix(
      'Production placement',
      [
        { id: 'sstable', label: 'SSTable/block' },
        { id: 'object', label: 'object manifest' },
        { id: 'cdn', label: 'CDN cache' },
        { id: 'stream', label: 'streaming set' },
      ],
      [
        { id: 'fit', label: 'fit?' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['excellent', 'immutable after flush'],
        ['excellent', 'built per snapshot'],
        ['good', 'rebuild on publish'],
        ['poor', 'continuous updates'],
      ],
    ),
    highlight: { found: ['sstable:fit', 'object:fit'], compare: ['stream:fit'] },
    explanation: 'Xor filters are a natural companion to immutable storage files and manifests. They are a weaker fit for constantly changing membership sets.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'peeling build') yield* peelingBuild();
  else if (view === 'membership query') yield* membershipQuery();
  else throw new InputError('Pick an xor filter view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. The peeling-build view shows the construction algorithm: keys are hyperedges connecting three table slots, and the builder peels degree-one slots until every key lands on a stack. The reverse-assignment frame then fills the table so every key\'s XOR equation holds. Active highlights mark the key or slot being processed. Found highlights mark slots whose values are now fixed.',
        'The membership-query view shows the lookup path: three positions, three table reads, one XOR chain, one fingerprint comparison. The error-semantics table shows the contract -- true positives, true negatives, and the false-positive case where an absent key collides by fingerprint chance.',
        'In both views, the compare color marks elements that are being contrasted against the active path -- the cyclic-core failure case in the build view, the streaming-set mismatch in the placement view. Watch for the transition from peeling (removing keys) to assignment (filling values in reverse order). That reversal is the core of the algorithm.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Storage engines, CDN manifests, and package indexes share a pattern: build a file once, then answer millions of membership queries against it. Before touching disk, network, or decompression, the system asks a cheap question: could this key be in that file? If the answer is definitely no, it skips the expensive work entirely.',
        'Bloom filters handle this, but they carry features a static file never uses -- incremental insertion and the bit-array overhead that comes with it. An SSTable is sealed after flush. A versioned manifest is sealed after publish. The insert path is dead weight.',
        'Graf and Lemire (2020) proposed xor filters to exploit that immutability. The idea: spend more effort during a one-time construction so each later query costs only three table reads and a fingerprint comparison, using less memory per key than a Bloom filter at the same false-positive rate.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A Bloom filter is the standard tool. Hash the key k times, set k bits. To query, check all k bit positions; if any bit is zero, the key is absent. It works, it is simple, and it supports incremental insertion -- you can add keys one at a time without rebuilding.',
        'For mutable sets this flexibility is essential. A network firewall updating its blocklist, a spell checker loading user words, or a cache tracking live sessions all need to insert without a full rebuild. Bloom filters handle all of these well.',
        'The cost of that flexibility is space. A Bloom filter at 1% false-positive rate needs roughly 9.6 bits per key. At 0.1%, roughly 14.4 bits per key. These numbers include the overhead of supporting arbitrary future insertions into the bit array -- slack that a sealed file will never use.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Once a file is immutable, the Bloom filter\'s insert capability is a tax with no return. Every query still probes k independent bit positions scattered across the array, and the array must be sized for the worst-case insertion sequence rather than the exact final set.',
        'More precisely: the information-theoretic minimum for a filter with false-positive rate epsilon over n keys is n * log2(1/epsilon) bits. A Bloom filter uses about 1.44x that minimum. The gap comes from hash collisions in the bit array and the need to keep the array sparse enough that independent probes remain meaningful.',
        'For a system serving billions of queries against millions of sealed SSTables, that 44% overhead compounds into real memory pressure. Shaving even 2 bits per key across a billion keys saves 250 MB of RAM. The wall is not that Bloom filters are wrong -- it is that they pay for a feature (mutability) that sealed files never exercise.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An xor filter stores a table of small fingerprints (typically 8 or 16 bits each) and answers queries with a single invariant: for every key in the built set, table[h0(key)] XOR table[h1(key)] XOR table[h2(key)] equals fingerprint(key). Three hash functions map each key to three distinct table positions. The query XORs the three stored values and checks the result against the key\'s fingerprint.',
        {
          type: 'diagram',
          label: '3-way XOR fingerprint mapping',
          text: [
            '  key -----> h0(key) = slot 2    table[2] = 0xA3',
            '        +--> h1(key) = slot 5    table[5] = 0x17',
            '        +--> h2(key) = slot 9    table[9] = 0xF6',
            '',
            '  query:  0xA3 XOR 0x17 XOR 0xF6 = 0x42',
            '  fingerprint(key) = 0x42  -->  match  -->  "maybe present"',
          ].join('\n'),
        },
        'Construction models the problem as a 3-uniform hypergraph. Each table slot is a vertex. Each key is a hyperedge connecting three vertices (its three hash positions). The builder peels this hypergraph: repeatedly find a slot touched by exactly one remaining key, push that key onto a stack, and remove all three of its incidences. If every key peels, the graph was acyclic and construction succeeds.',
        'After peeling, the builder processes the stack in reverse. For each key, two of its three slots already have assigned values (set by keys processed later in the reverse order). The builder sets the remaining slot to fingerprint(key) XOR table[slotA] XOR table[slotB]. This makes the XOR equation true for that key without disturbing any equation already satisfied.',
        'If peeling gets stuck -- a cyclic core remains with no degree-one slot -- the hash seed failed. The builder retries with a new seed or a slightly larger table. Random 3-uniform hypergraphs on c*n vertices (where c is about 1.23) are acyclic with high probability, so retries are rare.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one invariant: when a key is processed during reverse assignment, at least one of its three slots is still unassigned and the other two are already fixed. The peeling order guarantees this. A key was pushed onto the stack because it was the only key touching some slot s. Every key pushed after it (processed before it in reverse) either does not touch s or was already removed. So slot s is free when the key\'s turn comes.',
        'Setting the free slot to fingerprint(key) XOR value(slotA) XOR value(slotB) makes the three-way XOR equal the fingerprint by construction. This assignment cannot break any earlier equation because earlier keys (later in reverse order) were assigned using a different free slot. By induction over the reversed stack, every key in the built set satisfies its XOR equation. That is why the filter produces no false negatives for the exact set used to build it.',
        'False positives occur when an absent key\'s three random table positions happen to XOR to that key\'s fingerprint. With an f-bit fingerprint, the probability is 1/2^f per query -- independent of the set size, independent of the table load factor. This is the same rate as a cuckoo filter and better than a Bloom filter at equivalent space.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Membership query: O(1) time, three reads, two XORs',
            'function query(key, table, hashSeed) {',
            '  const h0 = hash0(key, hashSeed);',
            '  const h1 = hash1(key, hashSeed);',
            '  const h2 = hash2(key, hashSeed);',
            '  const fingerprint = fingerprintOf(key, hashSeed);',
            '  return (table[h0] ^ table[h1] ^ table[h2]) === fingerprint;',
            '}',
          ].join('\n'),
        },
        'Lookup is O(1) with a tiny constant: three hash computations, three table reads (often in the same cache line or adjacent lines), two XOR operations, one comparison. No branching, no loops, no pointer chasing. This is faster than a Bloom filter\'s k independent bit probes, which scatter across the array and cause more cache misses.',
        'Space is approximately 1.23 * n * f bits, where n is the number of keys and f is the fingerprint width. For 8-bit fingerprints (1% false-positive rate), that is about 9.84 bits per key -- comparable to Bloom but with faster queries. For the Xor+ variant (described below), space drops to about 1.08 * n * f bits.',
        'Construction is O(n) expected time. Each peeling pass scans the degree array once. The number of retries on a failed seed is geometrically distributed with a small failure probability when the table has sufficient slack. In practice, construction completes in 1-2 attempts.',
        {
          type: 'table',
          headers: ['Filter', 'Bits/key (1% FPR)', 'Lookup', 'Build time', 'False positive rate'],
          rows: [
            ['Bloom filter', '~9.6', 'k bit probes (scattered)', 'O(n), incremental', '(1 - e^(-kn/m))^k'],
            ['Cuckoo filter', '~8.5', '2 reads + fingerprint cmp', 'O(n) amortized, can fail', '2b / 2^f'],
            ['Xor filter', '~9.8 (8-bit)', '3 reads + XOR chain', 'O(n) expected, static rebuild', '1 / 2^f'],
            ['Xor+ filter', '~8.6 (8-bit)', '3-4 reads + XOR chain', 'O(n) expected, static rebuild', '1 / 2^f'],
            ['Ribbon filter', '~7.7', 'row solve', 'O(n), static rebuild', 'configurable'],
          ],
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {
          type: 'quote',
          text: 'Xor filters are faster than Bloom and cuckoo filters while using less memory.',
          attribution: 'Graf & Lemire, "Xor Filters: Faster and Smaller Than Bloom and Cuckoo Filters" (2020)',
        },
        'Xor filters are a natural companion to immutable storage. In an LSM tree, each SSTable is sealed after flush or compaction -- the filter is built once alongside the file and queried for the lifetime of that level. RocksDB, LevelDB, and similar engines already attach per-file Bloom filters; xor filters are a drop-in replacement that saves memory and speeds up negative lookups.',
        'Object stores and CDN manifests follow the same pattern. A versioned manifest lists every object in a snapshot. Attaching an xor filter lets the serving layer reject absent-key queries without parsing the full manifest. The filter is rebuilt only when a new snapshot is published.',
        'Package managers benefit too. A package index is a sealed artifact published at release time. An xor filter over package names or content hashes lets the client check membership locally before making a network request to the registry.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Xor filters cannot handle incremental updates. Adding one key to the set changes the hypergraph and can invalidate the solved XOR equations for other keys. The only update path is a full rebuild. For sets that change frequently -- active session caches, firewall blocklists with real-time updates, or streaming deduplication windows -- a Bloom or cuckoo filter is the right tool.',
        'Construction can fail. If the random hypergraph has a cyclic core, peeling stalls and the builder must retry. With standard parameters (table size ~1.23n), failure probability is low but not zero. Systems that cannot tolerate any construction latency variance should account for retry cost or pre-size the table more generously.',
        'The filter does not prove membership. A "maybe present" answer means the fingerprint matched, not that the key is in the set. For security-critical membership checks (access control lists, certificate revocation), the filter is only a fast pre-check; the authoritative answer must come from a signed or authenticated data structure.',
        {
          type: 'note',
          text: 'The Xor+ variant reduces space from 1.23n to ~1.08n entries by splitting the table into three segments of unequal size and adding a fourth hash for some keys. Build complexity increases slightly but query cost remains O(1). Binary fuse filters (Fan et al.) push this further, achieving near-optimal space with simpler construction.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: Graf & Lemire, "Xor Filters: Faster and Smaller Than Bloom and Cuckoo Filters," Journal of Experimental Algorithmics 25, 2020. https://arxiv.org/abs/1912.08258',
            'Xor+ variant: same paper, Section 4. Reduces table size from 1.23n to ~1.08n with a segmented layout.',
            'Binary fuse filters: T. M. Graf & D. Lemire, "Binary Fuse Filters: Fast and Smaller Than Xor Filters," Journal of Experimental Algorithmics 27, 2022.',
            'Ribbon filters: P. Dillinger & S. Walzer, "Ribbon filter: practically smaller than Bloom and Xor," VLDB 2021.',
            'Hypergraph peeling theory: Molloy, "Cores in random hypergraphs and Boolean formulas," Random Structures & Algorithms, 2005.',
          ],
        },
        'Prerequisite: study Bloom Filter to understand the baseline approximate-membership contract, and Cuckoo Hashing to see how fingerprint-based filters handle collisions.',
        'Extensions: Binary Fuse Filter pushes the static-filter idea closer to the information-theoretic minimum. Ribbon Filter uses a different algebraic construction (Gaussian elimination over GF(2)) that trades build speed for even tighter space.',
        'Production context: study RocksDB LSM Case Study to see where per-file filters sit in a real storage engine, and Count-Min Sketch to see a different probabilistic data structure that trades exactness for space in a streaming setting.',
      ],
    },
  ],
};

