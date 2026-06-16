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
      heading: 'What it is',
      paragraphs: [
        'An xor filter is a static approximate-membership data structure. It answers set queries with the same high-level contract as a Bloom Filter: stored keys are never reported absent, while absent keys may occasionally be reported present. The attraction is speed and space. A query uses three table reads and an xor of small fingerprints, with no k independent bit probes and no variable-length bucket walk.',
        'The paper Xor Filters: Faster and Smaller Than Bloom and Cuckoo Filters reviews this construction and reports that xor filters can be faster than Bloom and cuckoo filters while using less memory: https://arxiv.org/abs/1912.08258. The trade is that construction is more involved and the set is immutable. If the represented set changes, the filter is normally rebuilt.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each key maps to three table positions and has a small fingerprint. Construction forms a hypergraph whose vertices are table slots and whose hyperedges are keys connected to their three slots. The builder repeatedly peels a key that is incident to a degree-one slot, pushes it onto a stack, and removes its three incidences. If peeling removes all keys, the graph is acyclic enough for assignment. If a cyclic core remains, the builder retries with a new seed or a larger table.',
        'Assignment runs in reverse peel order. For each key, two of its three slot values have already been assigned. The builder chooses the last slot value so that table[h1(key)] xor table[h2(key)] xor table[h3(key)] equals fingerprint(key). At query time, compute the same three positions, xor their stored values, and compare the result to the query fingerprint.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup is O(1) with a tiny constant: three reads, two xor operations, and one fingerprint comparison. Space depends on fingerprint size and load factor. Construction is expected linear but can fail for a seed when the hypergraph has an unpeelable core. Production implementations handle that by retrying. The practical cost is therefore paid at build time, not query time.',
        'This build/query split explains the use case. Xor filters are excellent for immutable files, sorted-string tables, object manifests, and snapshots where many reads follow one build. They are much less attractive for a live set that receives frequent inserts and deletes. Counting Bloom filters or Cuckoo Hashing-style structures may be better when updates matter.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Storage engines use approximate filters to avoid expensive lookups. If an SSTable or object shard definitely does not contain a key, the engine can skip disk, network, decompression, and index traversal. Xor filters fit this pattern because the file or shard becomes immutable after it is flushed. The filter is built once alongside the file and then queried for the life of that file version.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat maybe present as proof. Like a Bloom filter, an xor filter is a front door that avoids unnecessary work; positive answers usually need a real lookup in the source of truth. Do not expect cheap incremental updates. The equations were solved for one static set. Adding one key changes the hypergraph and can invalidate the construction.',
        'Another misconception is that xor means cryptographic security. The xor operation is just the algebra that reconstructs a small fingerprint. It is not an authenticated membership proof and should not be used as a security boundary.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Xor Filters: Faster and Smaller Than Bloom and Cuckoo Filters at https://arxiv.org/abs/1912.08258. Study Bloom Filter, Cuckoo Hashing, Quotient Filter, Count-Min Sketch, RocksDB LSM Case Study, and S3 Object Storage Case Study next.',
      ],
    },
  ],
};
