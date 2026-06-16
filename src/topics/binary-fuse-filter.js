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
  yield {
    state: fuseGraph('Static keys are spread across nearby fuse segments'),
    highlight: { active: ['keys', 'segment0', 'segment1', 'segment2'], found: ['e-keys-s0', 'e-keys-s1', 'e-keys-s2'] },
    explanation: 'Binary fuse filters are static approximate-membership filters. Like xor filters, each key contributes to a few fingerprint cells, but construction arranges positions through segmented ranges for better space and build behavior.',
  };

  yield {
    state: fuseGraph('Construction peels degree-one cells, then assigns backwards'),
    highlight: { active: ['peel', 'assign', 'e-peel-assign', 'e-assign-table'], compare: ['table'] },
    explanation: 'The builder peels keys whose current cell appears in only one remaining key, records the order, then fills fingerprints in reverse so every stored key satisfies its xor equation.',
    invariant: 'The query is tiny because the builder solves the equations ahead of time.',
  };

  yield {
    state: labelMatrix(
      'Static filter family',
      [
        { id: 'bloom', label: 'Bloom' },
        { id: 'xor', label: 'xor' },
        { id: 'fuse', label: 'binary fuse' },
        { id: 'ribbon', label: 'ribbon' },
      ],
      [
        { id: 'build', label: 'build style' },
        { id: 'query', label: 'query style' },
        { id: 'space', label: 'space profile' },
      ],
      [
        ['set bits', 'k bit probes', 'larger but update-friendly'],
        ['peel hypergraph', '3 reads + xor', 'compact static'],
        ['segmented peel', '3 reads + xor', 'closer to lower bound'],
        ['linear system', 'few reads', 'very compact but build-heavy'],
      ],
    ),
    highlight: { found: ['fuse:build', 'fuse:space'], compare: ['bloom:build', 'ribbon:build'] },
    explanation: 'Binary fuse filters sit in the static-filter branch. They give up incremental updates to buy small space and fast negative lookups.',
  };

  yield {
    state: labelMatrix(
      'Build failure and rebuild discipline',
      [
        { id: 'seed', label: 'choose seed' },
        { id: 'peel', label: 'try peel' },
        { id: 'success', label: 'success' },
        { id: 'fail', label: 'failure' },
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
    explanation: 'The construction is probabilistic. A production builder must treat failure as an ordinary retry path, not as a surprising exception.',
  };
}

function* queryPath() {
  yield {
    state: labelMatrix(
      'One query',
      [
        { id: 'hash', label: 'hash key' },
        { id: 'load', label: 'load cells' },
        { id: 'xor', label: 'xor fingerprints' },
        { id: 'compare', label: 'compare' },
      ],
      [
        { id: 'work', label: 'work' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['compute segment and offsets', 'find three cells'],
        ['table[a], table[b], table[c]', 'small fingerprint bytes'],
        ['fa xor fb xor fc', 'candidate fingerprint'],
        ['equals f(key)?', 'maybe present or absent'],
      ],
    ),
    highlight: { active: ['load:work', 'xor:work', 'compare:meaning'], found: ['hash:work'] },
    explanation: 'A binary fuse query keeps the xor-filter payoff: a handful of deterministic reads and xor operations. The heavier work happened once during construction.',
  };

  yield {
    state: fuseGraph('Negative lookups avoid expensive source checks'),
    highlight: { active: ['table'], found: ['keys'], compare: ['segment0', 'segment1', 'segment2'] },
    explanation: 'Filters are normally placed before a slower source of truth. A definite negative avoids an SSTable probe, network request, object lookup, or decompression step.',
  };

  yield {
    state: labelMatrix(
      'When binary fuse fits',
      [
        { id: 'sstable', label: 'immutable SSTable' },
        { id: 'manifest', label: 'object manifest' },
        { id: 'cdn', label: 'published asset set' },
        { id: 'live', label: 'live mutable set' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'why', label: 'why' },
      ],
      [
        ['excellent', 'built at flush time'],
        ['excellent', 'snapshot membership'],
        ['good', 'rebuilt per deploy'],
        ['poor', 'updates need rebuild'],
      ],
    ),
    highlight: { found: ['sstable:fit', 'manifest:fit'], compare: ['live:fit'] },
    explanation: 'Binary fuse filters belong with immutable or versioned data. If every request inserts and deletes keys, use a different filter family.',
  };

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
        ['maybe present', 'verify or read value'],
        ['definitely absent', 'skip source'],
        ['maybe present', 'source rejects'],
        ['authoritative result', 'filter never replaces truth'],
      ],
    ),
    highlight: { active: ['member:answer', 'negative:answer'], found: ['source:system'] },
    explanation: 'Like Bloom and xor filters, binary fuse filters are accelerators, not authorities. Maybe present still requires the real data structure when correctness matters.',
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
      heading: 'What it is',
      paragraphs: [
        'A binary fuse filter is a static approximate-membership filter. It answers whether a key is definitely absent or maybe present, with no false negatives for the set used to build it. It belongs to the same family as Xor Filter: construction solves xor equations over small fingerprints so lookup can be just a few table reads and xor operations.',
        'The paper Binary Fuse Filters: Fast and Smaller Than Xor Filters reports filters closer to the storage lower bound than xor filters while preserving fast queries and improving construction speed in experiments: https://arxiv.org/abs/2201.01174. The ACM version is at https://dl.acm.org/doi/10.1145/3510449.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Conceptually, each key chooses a few fingerprint cells. The builder peels the dependency graph by repeatedly finding cells that are currently used by one remaining key. It records a stack of peeled keys. Then it processes the stack backwards, filling one cell at a time so that the xor of a key chosen cells equals that key fingerprint. Binary fuse filters refine the placement and segmentation strategy compared with basic xor filters, improving space and construction behavior.',
        'At query time, hash the key, derive the cell positions, load the small fingerprint values, xor them, and compare against the key fingerprint. If the fingerprints differ, the key is definitely absent. If they match, the key is maybe present and the source of truth should be consulted when an actual value is needed.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The query cost is O(1) with a small constant. Space is near the information-theoretic lower bound for a target false-positive probability. Construction is expected linear but probabilistic: some hash seeds leave an unpeelable core, so builders retry. That is acceptable for immutable snapshots because build cost is paid once and amortized over many queries.',
        'The static nature is the main constraint. You cannot cheaply insert or delete arbitrary keys after construction because the solved equations depend on the whole set. If updates are frequent, Bloom Filter, Cuckoo Hashing, or another mutable structure may be a better engineering choice.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Binary fuse filters are a fit for immutable storage files, object manifests, build artifacts, CDN publication sets, genomic k-mer snapshots, and any read-heavy membership guard in front of a slower lookup. In an LSM tree, for example, a filter can avoid opening an SSTable that definitely lacks a key. In object storage, it can avoid probing a shard or manifest segment that cannot contain the requested object.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first trap is using it for a mutable set. Binary fuse filters are built for static sets. The second is treating maybe present as proof. False positives remain possible. The third is ignoring build failure paths. A good implementation expects occasional construction retries and makes them boring.',
        'Do not compare filters on lookup speed alone. The right comparison includes false-positive rate, bits per key, build time, cache behavior, update requirements, and source-of-truth cost.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Binary Fuse Filters at https://arxiv.org/abs/2201.01174 and ACM JEA DOI https://dl.acm.org/doi/10.1145/3510449. Study Xor Filter, Bloom Filter, Quotient Filter, Cuckoo Hashing, RocksDB LSM Case Study, and Learned Bloom Filter next.',
      ],
    },
  ],
};
