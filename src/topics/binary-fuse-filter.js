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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/binary-fuse-filter.gif', alt: 'Animated walkthrough of the binary fuse filter visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A membership filter answers a narrow question: can this key be absent without checking the expensive source of truth? Bloom filters made that idea practical. Xor filters made static filters smaller and faster. Binary fuse filters push the static-filter branch further.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Bloom_filter.svg', alt: 'Diagram of a Bloom filter showing hash functions mapping elements to a bit array', caption: 'A Bloom filter maps each element through multiple hash functions into a shared bit array. Binary fuse filters inherit this membership-testing idea but solve fingerprint equations over segmented ranges for better space. Source: Wikimedia Commons.'},
        'The setting is usually huge and immutable: SSTables, object manifests, published asset sets, genomic k-mer snapshots, or read-only indexes. At that scale, one extra bit per key can mean gigabytes of memory and worse cache behavior.',
        'Binary fuse filters exist to keep the xor-filter query shape, a few table reads and xor operations, while improving space and construction behavior for static sets.',
        {type: 'callout', text: 'A binary fuse filter moves work to a static build so each query becomes a few deterministic reads and xor checks.'},
      ],
    },
    {
      heading: 'The obvious approach and the pressure on it',
      paragraphs: [
        'The obvious answer is a Bloom filter. It is simple, supports incremental insertion, and has no false negatives when used correctly. But it usually needs more bits per key than the best static filters for the same false-positive rate.',
        'The next obvious answer is an xor filter. It maps each key to a small number of cells, peels the resulting hypergraph, assigns fingerprints in reverse, and queries with a few reads. That is already excellent for immutable sets.',
        'The remaining pressure is scale. Static filters are judged by false-positive rate, bits per key, build time, query locality, and failure handling. A constant-factor improvement is meaningful when the filter is always resident and guards billions of lookups.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Keep the xor equation, but choose positions through fused segmented ranges. The builder arranges key-cell incidences so the graph can be peeled and the final table can be compact.',
        'For every stored key, the xor of the filter cells selected by that key equals the key fingerprint. The query recomputes the same positions, xors the stored values, and compares the result to the query fingerprint.',
        'The filter does not store the keys. It stores a solved system of short fingerprints. That is why it can be small, and why it is static.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the fuse-construction view, watch how the static key set is assigned into nearby segments rather than into arbitrary independent positions. The point of segmentation is to make construction compact and peelable while preserving fast queries.',
        'The peeling queue is the proof that construction is succeeding. A degree-one cell means one remaining key can be solved later. The builder records that order and assigns fingerprints in reverse so each stored key will satisfy its xor equation.',
        'In the query-path view, notice how little work remains at lookup time. The expensive graph-solving work is done once during build. A query only hashes the key, reads a few small table entries, xors them, and compares a fingerprint.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Bloom_filter_fp_probability.svg/720px-Bloom_filter_fp_probability.svg.png', alt: 'Graph showing false-positive probability versus number of bits per element for membership filters', caption: 'False-positive probability drops sharply as bits per element increase. Binary fuse filters sit near the theoretical lower bound for static filters. Source: Wikimedia Commons.'},
        'During construction, each key hashes to a fingerprint and to a small set of positions. The positions are chosen with the binary fuse layout so keys spread through overlapping local ranges.',
        'The builder counts how many keys touch each cell. Cells touched by exactly one remaining key go into a peeling queue. Removing that key can create new degree-one cells. If all keys are peeled, the builder has an order in which the equations can be solved.',
        'Assignment runs backward through the peel stack. For a given key, most of its cells may already have values. The builder chooses the remaining cell value so the xor equals the key fingerprint. Construction can fail for a seed if an unpeelable core remains, so builders retry with a different seed or size.',
      ],
    },
    {
      heading: 'Parameter choices',
      paragraphs: [
        'The key knobs are fingerprint width, segment length, table slack, and seed choice. Fingerprint width controls false positives. Segment and sizing parameters control how often construction peels successfully and how compact the final table is.',
        'These knobs are connected. A table that is too tight may look good in bits per key on paper and then waste time on retries. A table with too much slack builds easily but gives up the reason to use a binary fuse filter. A production implementation should report both final bits per key and build retry counts.',
        'The serialized filter must include the seed and layout parameters. Query code is deterministic only if it recomputes exactly the same segment and offsets the builder used. This is a data-format rule, not an optimization detail.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For every stored key, construction solved the exact equation that query will recompute. That gives no false negatives for the static set used to build the filter.',
        'For a nonmember, the query still reads cells and xors them, but those cells were not solved for that key. The result matches the nonmember fingerprint only by chance. Those chance matches are false positives.',
        'The false-positive rate is controlled by fingerprint width and construction parameters. More bits reduce false positives at the cost of space.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine an immutable SSTable containing one million keys. Before probing the table on disk, the database asks the filter whether the key might be present. If the filter says absent, the database skips the SSTable entirely. If the filter says maybe, the database does the real lookup.',
        'A binary fuse filter is built when the SSTable is flushed or compacted. Because the file is immutable, the filter can be solved once and stored beside the table. Query speed then matters far more than update speed.',
        'A false positive costs an unnecessary SSTable probe. A false negative would be correctness failure, so the construction invariant is designed to avoid false negatives for the built set.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Build binary fuse filters at snapshot boundaries. For an LSM engine, that means flush and compaction. For a CDN or package registry, it means publish time. The filter should describe exactly one immutable set, and readers should load it with the version of the data it protects.',
        'Expose build failures as ordinary retries. A clean builder returns the seed, size, retry count, and final table. Operators should be able to see whether failures are rare random events or a sign that sizing assumptions no longer match the key distribution.',
        'Keep the source of truth in the control flow. A negative answer can skip the slower lookup. A maybe-present answer only grants permission to check the real data. Removing that second check turns a false-positive accelerator into a correctness bug.',
        'Benchmark with cache behavior included. Three table reads are cheap when the filter fits in cache and much less cheap when the table is large enough to miss. Compare filters under the same false-positive target, key distribution, serialization path, and source-lookup cost.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Lookup is O(1) with a small constant: hash, compute positions, load a few fingerprint values, xor, and compare. Space is designed to sit close to the lower bound for the chosen false-positive probability.',
        'Construction is expected linear but probabilistic. Failed builds are not exceptional; they are part of the algorithmic contract. Production code should retry with a new seed or slightly different sizing.',
        'Arbitrary insertions and deletions are not cheap because the table values are a solved system for one exact set. Changing the set can require rebuilding the filter.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Binary fuse filters fit immutable storage files, object manifests, build artifacts, CDN publication sets, genomic k-mer snapshots, and read-heavy guards in front of slower lookups.',
        'In an LSM tree, a filter can avoid opening an SSTable that definitely lacks a key. In object storage, it can avoid probing a shard or manifest segment that cannot contain the object.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The main failure is using it for a mutable set. If keys change continuously, a Bloom filter, counting Bloom filter, cuckoo filter, or ordinary hash table is usually easier to operate.',
        'It also fails when the source-of-truth lookup is already cheap. A sophisticated static filter is not worth much if false positives are harmless and memory is abundant.',
        'Do not compare filters only on lookup speed. The right comparison includes false-positive rate, bits per key, build time, cache behavior, update requirements, build-failure handling, serialization format, and source-of-truth cost.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Binary Fuse Filters at https://arxiv.org/abs/2201.01174 and ACM JEA DOI https://dl.acm.org/doi/10.1145/3510449. Study Xor Filter, Ribbon Filter, Bloom Filter, Quotient Filter, Cuckoo Filter, Cuckoo Hashing, RocksDB LSM Case Study, and Learned Bloom Filter next.',
      ],
    },
  ],
};
