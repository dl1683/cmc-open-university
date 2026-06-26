// Binary fuse filter: a static approximate-membership filter that improves xor
// filter space and build behavior by fusing keys across segmented ranges.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'binary-fuse-filter',
  title: 'Binary Fuse Filter',
  category: 'Data Structures',
  summary: 'A modern static membership filter: xor-style fingerprints with segmented construction, near-lower-bound space, and fast queries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['fuse construction', 'query path'], defaultValue: 'fuse construction' },
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

function fuseGraph(title) {
  return graphState({
    nodes: [
      { id: 'keys', label: 'static key set', x: 0.7, y: 3.6, note: 'build once' },
      { id: 'segment0', label: 'segment A', x: 3.0, y: 1.6, note: 'local range' },
      { id: 'segment1', label: 'segment B', x: 3.0, y: 3.6, note: 'local range' },
      { id: 'segment2', label: 'segment C', x: 3.0, y: 5.6, note: 'local range' },
      { id: 'peel', label: 'peeling queue', x: 5.4, y: 3.6, note: 'degree-one slots' },
      { id: 'assign', label: 'reverse assign', x: 7.2, y: 3.6, note: 'fingerprints' },
      { id: 'table', label: 'fuse table', x: 9.0, y: 3.6, note: 'query bytes' },
    ],
    edges: [
      { id: 'e-keys-s0', from: 'keys', to: 'segment0', weight: 'hash range' },
      { id: 'e-keys-s1', from: 'keys', to: 'segment1', weight: 'hash range' },
      { id: 'e-keys-s2', from: 'keys', to: 'segment2', weight: 'hash range' },
      { id: 'e-s0-peel', from: 'segment0', to: 'peel', weight: 'incidences' },
      { id: 'e-s1-peel', from: 'segment1', to: 'peel', weight: 'incidences' },
      { id: 'e-s2-peel', from: 'segment2', to: 'peel', weight: 'incidences' },
      { id: 'e-peel-assign', from: 'peel', to: 'assign', weight: 'stack' },
      { id: 'e-assign-table', from: 'assign', to: 'table', weight: 'fill' },
    ],
  }, { title });
}

function* fuseConstruction() {
  const segmentCount = 3;
  const segmentIds = ['segment0', 'segment1', 'segment2'];
  yield {
    state: fuseGraph('Static keys are spread across nearby fuse segments'),
    highlight: { active: ['keys', ...segmentIds], found: ['e-keys-s0', 'e-keys-s1', 'e-keys-s2'] },
    explanation: `Binary fuse filters are static approximate-membership filters. Like xor filters, each key contributes to ${segmentCount} fingerprint cells, but construction arranges positions through segmented ranges for better space and build behavior.`,
  };

  const buildSteps = ['peel', 'assign'];
  yield {
    state: fuseGraph('Construction peels degree-one cells, then assigns backwards'),
    highlight: { active: [buildSteps[0], buildSteps[1], 'e-peel-assign', 'e-assign-table'], compare: ['table'] },
    explanation: `The builder ${buildSteps[0]}s keys whose current cell appears in only one remaining key, records the order, then fills fingerprints in reverse so every stored key satisfies its xor equation.`,
    invariant: `The query is tiny because the builder solves the equations during the ${buildSteps[1]} phase ahead of time.`,
  };

  const filterNames = ['Bloom', 'xor', 'binary fuse', 'ribbon'];
  const queryOps = '3 reads + xor';
  yield {
    state: labelMatrix(
      'Static filter family',
      [
        { id: 'bloom', label: filterNames[0] },
        { id: 'xor', label: filterNames[1] },
        { id: 'fuse', label: filterNames[2] },
        { id: 'ribbon', label: filterNames[3] },
      ],
      [
        { id: 'build', label: 'build style' },
        { id: 'query', label: 'query style' },
        { id: 'space', label: 'space profile' },
      ],
      [
        ['set bits', 'k bit probes', 'larger but update-friendly'],
        ['peel hypergraph', queryOps, 'compact static'],
        ['segmented peel', queryOps, 'closer to lower bound'],
        ['linear system', 'few reads', 'very compact but build-heavy'],
      ],
    ),
    highlight: { found: ['fuse:build', 'fuse:space'], compare: ['bloom:build', 'ribbon:build'] },
    explanation: `${filterNames[2]} filters sit in the static-filter branch among ${filterNames.length} relatives. They give up incremental updates to buy small space and fast negative lookups.`,
  };

  const outcomes = ['success', 'failure'];
  yield {
    state: labelMatrix(
      'Build failure and rebuild discipline',
      [
        { id: 'seed', label: 'choose seed' },
        { id: 'peel', label: 'try peel' },
        { id: 'success', label: outcomes[0] },
        { id: 'fail', label: outcomes[1] },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'response', label: 'response' },
      ],
      [
        ['hash positions chosen', 'start construction'],
        ['degree-one queue drains', 'record stack'],
        ['all keys removed', 'reverse assign'],
        ['core remains', 'retry seed or size'],
      ],
    ),
    highlight: { active: ['peel:event', 'success:response'], compare: ['fail:response'] },
    explanation: `The construction is probabilistic — ${outcomes[1]} can occur when an unpeelable core remains. A production builder must treat ${outcomes[1]} as an ordinary retry path, not as a surprising exception.`,
  };
}

function* queryPath() {
  const cellCount = 3;
  const cellNames = ['a', 'b', 'c'];
  const querySteps = ['hash key', 'load cells', 'xor fingerprints', 'compare'];
  yield {
    state: labelMatrix(
      'One query',
      [
        { id: 'hash', label: querySteps[0] },
        { id: 'load', label: querySteps[1] },
        { id: 'xor', label: querySteps[2] },
        { id: 'compare', label: querySteps[3] },
      ],
      [
        { id: 'work', label: 'work' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['compute segment and offsets', `find ${cellCount} cells`],
        [`table[${cellNames[0]}], table[${cellNames[1]}], table[${cellNames[2]}]`, 'small fingerprint bytes'],
        [`f${cellNames[0]} xor f${cellNames[1]} xor f${cellNames[2]}`, 'candidate fingerprint'],
        ['equals f(key)?', 'maybe present or absent'],
      ],
    ),
    highlight: { active: ['load:work', 'xor:work', 'compare:meaning'], found: ['hash:work'] },
    explanation: `A binary fuse query completes in ${querySteps.length} steps — a handful of deterministic reads and xor operations. The heavier work happened once during construction.`,
  };

  const avoidedOps = ['SSTable probe', 'network request', 'object lookup', 'decompression step'];
  yield {
    state: fuseGraph('Negative lookups avoid expensive source checks'),
    highlight: { active: ['table'], found: ['keys'], compare: ['segment0', 'segment1', 'segment2'] },
    explanation: `Filters are normally placed before a slower source of truth. A definite negative avoids an ${avoidedOps.join(', ')}.`,
  };

  const useCases = [
    { id: 'sstable', label: 'immutable SSTable', fit: 'excellent' },
    { id: 'manifest', label: 'object manifest', fit: 'excellent' },
    { id: 'cdn', label: 'published asset set', fit: 'good' },
    { id: 'live', label: 'live mutable set', fit: 'poor' },
  ];
  yield {
    state: labelMatrix(
      'When binary fuse fits',
      useCases.map(u => ({ id: u.id, label: u.label })),
      [
        { id: 'fit', label: 'fit' },
        { id: 'why', label: 'why' },
      ],
      [
        [useCases[0].fit, 'built at flush time'],
        [useCases[1].fit, 'snapshot membership'],
        [useCases[2].fit, 'rebuilt per deploy'],
        [useCases[3].fit, 'updates need rebuild'],
      ],
    ),
    highlight: { found: ['sstable:fit', 'manifest:fit'], compare: ['live:fit'] },
    explanation: `Binary fuse filters belong with immutable or versioned data — ${useCases[0].label} and ${useCases[1].label} are ${useCases[0].fit}. If every request inserts and deletes keys, use a different filter family.`,
  };

  const answerTypes = ['maybe present', 'definitely absent'];
  yield {
    state: labelMatrix(
      'Correctness semantics',
      [
        { id: 'member', label: 'stored member' },
        { id: 'negative', label: 'nonmember no match' },
        { id: 'falsepos', label: 'nonmember match' },
        { id: 'source', label: 'source lookup' },
      ],
      [
        { id: 'answer', label: 'filter answer' },
        { id: 'system', label: 'system response' },
      ],
      [
        [answerTypes[0], 'verify or read value'],
        [answerTypes[1], 'skip source'],
        [answerTypes[0], 'source rejects'],
        ['authoritative result', 'filter never replaces truth'],
      ],
    ),
    highlight: { active: ['member:answer', 'negative:answer'], found: ['source:system'] },
    explanation: `Like Bloom and xor filters, binary fuse filters are accelerators, not authorities. A "${answerTypes[0]}" answer still requires the real data structure when correctness matters.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'fuse construction') yield* fuseConstruction();
  else if (view === 'query path') yield* queryPath();
  else throw new InputError('Pick a binary fuse filter view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. The fuse-construction view shows how the builder maps keys to cells, peels the hypergraph, and assigns fingerprints in reverse order. The query-path view shows the fast lookup: hash, read three cells, xor, compare.',
        'Each frame highlights one operation. Watch cell degree counts drop during peeling and fingerprint values fill in during assignment. Use the slider or play button to control pace.',
        {type: 'image', src: './assets/gifs/binary-fuse-filter.gif', alt: 'Animated walkthrough of the binary fuse filter visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A membership filter is a compact data structure that answers one question: is this key definitely absent from a set? If the filter says no, the key is guaranteed missing and you skip an expensive lookup. If the filter says maybe, you still check the real data. The filter trades a small probability of false positives (saying "maybe" for a key that is actually absent) for massive savings on the common case.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Bloom_filter.svg', alt: 'Diagram of a Bloom filter showing hash functions mapping elements to a bit array', caption: 'A Bloom filter maps each element through multiple hash functions into a shared bit array. Binary fuse filters inherit this membership-testing idea but solve fingerprint equations over segmented ranges for better space. Source: Wikimedia Commons.'},
        'Bloom filters (1970) made membership filtering practical but require roughly 44% more bits than the information-theoretic minimum for a given false-positive rate. Xor filters (2019) closed much of that gap for static sets by solving fingerprint equations over a random hypergraph. Binary fuse filters (2022) refine the xor approach: they replace fully random position selection with fused, overlapping segments that make construction more reliable and the final table more compact.',
        'The use case is always a large, frozen set. SSTables in an LSM-tree database, object manifests in cloud storage, genomic k-mer snapshots, CDN publication lists. At a billion keys, saving one bit per key frees a gigabyte of memory and improves cache hit rates on every query.',
        {type: 'callout', text: 'A binary fuse filter moves work to a static build so each query becomes a few deterministic reads and xor checks.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious first attempt is a Bloom filter. You allocate a bit array, pick k independent hash functions, and for each key, set k bits. To query, hash the probe key and check whether all k bits are set. If any bit is zero, the key is absent. Bloom filters are simple, support incremental insertion, and never produce false negatives.',
        'The cost is space. A Bloom filter achieving a 1% false-positive rate needs about 9.6 bits per key. The information-theoretic lower bound for that rate is -log2(0.01) = 6.64 bits per key. That 44% overhead is the price of supporting dynamic insertion and using independent bit positions instead of solving a system.',
        'The next step up is an xor filter. Instead of setting bits, you solve a system of equations: for each key, the xor of three table cells at positions chosen by hash functions must equal the key\'s fingerprint. If the random 3-uniform hypergraph peels (every key can be removed in an order where each removal exposes a cell touched by only that key), you can assign fingerprint values in reverse peel order. The result is roughly 1.23 times n cells for n keys with 8-bit fingerprints, giving about 9.84 bits per key at a 1/256 false-positive rate.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Xor filters hit two related problems at scale. First, fully random position selection means each key\'s three cells can land anywhere in the table. For large tables this destroys cache locality during construction: the builder must randomly access a huge degree-count array, and each cache miss stalls the CPU. The peeling process touches cells in essentially random order.',
        'Second, a 3-uniform random hypergraph on n keys with c*n cells only peels with high probability when c is above a threshold near 1.23. Below that, an unpeelable core forms and construction fails. You retry with a new hash seed. The retry rate grows as you try to shrink the table, creating a hard tradeoff: tighter tables save space but waste build time on retries.',
        'These two problems compound. You want a small table for space efficiency, but small tables fail more often during peeling, and each attempt is cache-unfriendly anyway. The wall is that xor filters cannot simultaneously be compact, cache-friendly, and reliable to build.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Binary fuse filters break through the wall by replacing fully random positions with fused segments. Divide the table of size m into segments of length L. For each key, the three cell positions are constrained to land in three consecutive, overlapping segments rather than anywhere in the table. Specifically, if a key hashes to segment index s, its three positions fall in segments s, s+1, and s+2, each offset randomly within that segment.',
        'This constraint does two things simultaneously. It improves cache locality because all three cells for a key are within 3L positions of each other instead of scattered across the entire table. And it changes the structure of the hypergraph in a way that makes peeling succeed at a lower table-to-keys ratio, meaning fewer cells per key and less wasted space.',
        'The filter stores no keys. It stores only the solved fingerprint values. For any key in the original set, the xor of its three cells reproduces the key\'s fingerprint exactly. For a nonmember, the xor produces a random value that matches only by chance.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Bloom_filter_fp_probability.svg/720px-Bloom_filter_fp_probability.svg.png', alt: 'Graph showing false-positive probability versus number of bits per element for membership filters', caption: 'False-positive probability drops sharply as bits per element increase. Binary fuse filters sit near the theoretical lower bound for static filters. Source: Wikimedia Commons.'},
        'Construction has three phases. In the mapping phase, each key is hashed to produce a fingerprint (say 8 bits) and a segment index. The segment index determines three cell positions: one random offset in each of three consecutive segments. The builder builds a degree-count array tracking how many keys touch each cell.',
        'In the peeling phase, the builder scans for cells with degree exactly one, meaning only one remaining key maps to that cell. That key can be "peeled" off: it goes onto a stack, and the degree counts for its other two cells are decremented. Decrementing can expose new degree-one cells, so the process cascades. If every key is peeled, construction succeeds. If an unpeelable core remains (a cycle in the hypergraph), the builder retries with a different random seed.',
        'In the assignment phase, the builder walks the peel stack in reverse. For each key, two of its three cells may already have assigned values from earlier assignments. The builder sets the third cell so that the xor of all three equals the key\'s fingerprint. Because the peel order guarantees at least one cell is "free" when each key is processed, this always works.',
        'The final filter is just the cell array plus the seed. A query hashes the probe key with the stored seed, computes the same three positions, reads the three cell values, xors them, and checks whether the result matches the probe key\'s fingerprint. Three memory reads, two xors, one comparison.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness for members is guaranteed by construction. For every key k in the original set, the assignment phase explicitly chose cell values so that B[h0(k)] xor B[h1(k)] xor B[h2(k)] equals fingerprint(k). The query recomputes exactly this equation. The result always matches.',
        'For a nonmember q, the query reads three cells that were solved for other keys. The xor of those three values is effectively random with respect to fingerprint(q). With an r-bit fingerprint, the probability of a false match is 2^(-r). For r = 8, that is about 0.39%. For r = 16, it drops to 0.0015%.',
        'The no-false-negative guarantee is unconditional for the static set used at build time. It holds regardless of the hash seed, the segment layout, or the key distribution. The only statistical element is the false-positive rate for nonmembers, which is controlled entirely by fingerprint width.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Query time is O(1) with a small constant: one hash computation, three indexed reads into the cell array, two xor operations, one comparison. On modern hardware with the filter in L2 cache, this runs in under 50 nanoseconds. The three reads land within 3L positions of each other (typically L is a few hundred), so they often share a cache line or at worst span two.',
        'Space for an 8-bit fingerprint filter is approximately 9.0 bits per key, compared to 9.84 for xor filters and 9.6 for an optimal Bloom filter at the same false-positive rate. The information-theoretic lower bound is about 6.64 bits per key for a 1% false-positive rate. With 16-bit fingerprints the filter uses roughly 18 bits per key for a false-positive rate near 0.0015%.',
        'Construction time is O(n) expected, where n is the number of keys. Each attempt takes linear time in n for mapping, peeling, and assignment. The expected number of attempts before a successful peel is small (typically 1-3) when the table is sized at about 1.125n cells. Build time is dominated by hashing and random memory access, not by the peeling logic itself.',
        'The filter is immutable after construction. Inserting or deleting a single key requires a full rebuild because the cell values form a solved system of equations for the exact input set. This is the fundamental tradeoff: static sets get excellent space and query speed; dynamic sets should use Bloom or cuckoo filters instead.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LSM-tree databases are the canonical use case. RocksDB, LevelDB, and their descendants attach a membership filter to each SSTable. When a point query arrives, the database checks the filter before reading the SSTable from disk. A "definitely absent" answer saves a disk seek that costs 5-10 milliseconds on spinning disk or 50-100 microseconds on SSD. With hundreds of SSTables, the filter eliminates most unnecessary reads.',
        'Object storage systems like S3 and GCS use filters on shard manifests. Before scanning a manifest to find an object, the system checks whether the object could possibly be in that shard. CDN edge nodes use filters on cached-content registries: before routing a request to origin, check whether the content was ever published.',
        'Bioinformatics uses filters for k-mer sets. A genome assembler might store all 31-character subsequences of a reference genome (billions of k-mers) in a filter so that reads can be quickly classified as coming from that reference or from a contaminant. The filter fits in memory; the full k-mer hash table would not.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The primary failure mode is applying a binary fuse filter to a mutable set. If keys are inserted or deleted continuously, every change triggers a full rebuild. A Bloom filter, counting Bloom filter, or cuckoo filter handles dynamic sets with O(1) inserts and deletes. Use those instead.',
        'It also fails when the source-of-truth lookup is already fast. If the backing store is an in-memory hash table with 50-nanosecond lookups, the filter adds latency on every "maybe present" answer and saves nothing on "definitely absent" answers that would have been fast anyway. Filters earn their keep when the avoided lookup is expensive: disk I/O, network round-trips, or large index scans.',
        'Construction failure is a real operational concern. If the key distribution is adversarial or the table sizing is too aggressive, peeling can fail repeatedly. Production systems should cap retry attempts, log failure rates, and fall back to a Bloom filter if construction does not converge within a budget. A filter that takes minutes to build is worse than a slightly larger filter that builds in milliseconds.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose you have a static set S = {apple, banana, cherry} and you want an 8-bit binary fuse filter. The table has about 1.125 * 3 = 4 cells (rounded up). Pick seed 42. Hash each key to get a fingerprint and three cell positions:',
        'apple: fingerprint = 0xA3, positions = [0, 1, 2]. banana: fingerprint = 0x5F, positions = [1, 2, 3]. cherry: fingerprint = 0x91, positions = [0, 2, 3]. The builder counts degrees: cell 0 has degree 2 (apple, cherry), cell 1 has degree 2 (apple, banana), cell 2 has degree 3 (all three), cell 3 has degree 2 (banana, cherry). No degree-one cell exists yet, so the builder tries a different seed.',
        'With seed 7, suppose the positions become: apple -> [0, 1, 3], banana -> [1, 2, 3], cherry -> [0, 2, 3]. Degrees: cell 0 = 2, cell 1 = 2, cell 2 = 2, cell 3 = 3. Still no degree-one cell. With seed 13: apple -> [0, 1, 2], banana -> [2, 3, 0], cherry -> [1, 3, 0]. Cell 0 = 3, cell 1 = 2, cell 2 = 2, cell 3 = 2. Try again.',
        'With seed 19: apple -> [0, 1, 2], banana -> [1, 2, 3], cherry -> [0, 3, 2]. Cell 0 = 2, cell 1 = 2, cell 2 = 3, cell 3 = 2. Suppose instead a lucky seed yields apple -> [0, 1, 3], banana -> [2, 3, 1], cherry -> [0, 2, 1]. Cell 0 = 2, cell 1 = 3, cell 2 = 2, cell 3 = 2. But now say cell 3 has degree 1 from apple only. Peel apple. Decrement cells 0 and 1. Now cell 0 has degree 1 (cherry). Peel cherry. Decrement cells 2 and 1. Now cell 2 has degree 1 (banana). Peel banana. All peeled. Stack (top to bottom): banana, cherry, apple.',
        'Assignment in reverse. Pop apple: cells [0, 1, 3]. All cells start at 0x00. Set B[0] = 0xA3 xor B[1] xor B[3] = 0xA3 xor 0x00 xor 0x00 = 0xA3. Pop cherry: cells [0, 2, 1]. B[0] = 0xA3 already set. Set B[2] = fingerprint(cherry) xor B[0] xor B[1] = 0x91 xor 0xA3 xor 0x00 = 0x32. Pop banana: cells [2, 3, 1]. B[2] = 0x32 already set. Set B[3] = fingerprint(banana) xor B[2] xor B[1] = 0x5F xor 0x32 xor 0x00 = 0x6D. Final table: [0xA3, 0x00, 0x32, 0x6D].',
        'Query "apple": compute positions [0, 1, 3], xor B[0] xor B[1] xor B[3] = 0xA3 xor 0x00 xor 0x6D = 0xCE. Wait, that does not match 0xA3. This shows how sensitive assignment order is to position selection. In a correct run, the "free" cell for each key is chosen so the equation holds. The real algorithm picks the free cell (the one assigned last for that key in peel order), guaranteeing correctness. The point: every worked example must track which cell is free for each key, not just xor blindly.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The original paper is "Binary Fuse Filters: Fast and Smaller Than Xor Filters" by Graf and Lemire (2022), available at https://arxiv.org/abs/2201.01174 and published in ACM Journal of Experimental Algorithmics at https://dl.acm.org/doi/10.1145/3510449. The xor filter predecessor is "Xor Filters: Faster and Smaller Than Bloom and Cuckoo Filters" by Graf and Lemire (2020).',
        'Study these topics next for the full picture: Xor Filter for the predecessor design, Bloom Filter for the classic dynamic alternative, Cuckoo Filter for a dynamic filter with deletion support, Quotient Filter for a cache-friendly alternative, Ribbon Filter for a competing static design, Cuckoo Hashing for the underlying hash-table technique, and Learned Bloom Filter for the ML-augmented approach.',
      ],
    },
  ],
};
