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
      heading: 'Why this exists',
      paragraphs: [
        'A large system often needs to ask a cheap question before doing expensive work: could this key be in that file, shard, manifest, or snapshot? If the answer is definitely no, the system can skip disk, network, decompression, or an index walk.',
        'Bloom filters solve that broad problem, but many production sets are immutable after publication. An SSTable, object manifest, or versioned shard is built once and queried many times. Xor filters exploit that static setting: spend more effort during construction so each later query is only three table reads and a fingerprint comparison.',
      ],
    },
    {
      heading: 'The static-filter bargain',
      paragraphs: [
        'A Bloom filter is the familiar baseline: hash the key several times and check bits. It is simple and insert-friendly. That is exactly why it remains the right answer for many mutable or low-complexity systems.',
        'The unused feature in an immutable set is incremental insertion. Once the file is sealed, there will be no per-key updates. Xor filters trade that update flexibility for a denser table and a smaller constant at query time.',
      ],
    },
    {
      heading: 'The core equation',
      paragraphs: [
        'Each key gets three table positions and a small fingerprint. Construction chooses the table bytes so this equation is true for every stored key: table[h1(key)] xor table[h2(key)] xor table[h3(key)] = fingerprint(key).',
        'A query recomputes the same three positions and xors their stored values. If the result differs from the key fingerprint, the key is definitely absent. If the result matches, the key is maybe present and the caller must consult the source of truth if it needs an exact answer.',
      ],
    },
    {
      heading: 'How construction works',
      paragraphs: [
        'The builder treats the problem as a 3-uniform hypergraph. Table slots are vertices. Keys are hyperedges connected to the three slots chosen by their hashes. If a slot is touched by exactly one remaining key, that key can eventually be solved from that slot.',
        'Peeling repeatedly finds such degree-one slots, pushes their keys onto a stack, and removes their incidences from the graph. If all keys peel, assignment runs backward. For each key in reverse order, two slot values are already fixed, so the builder writes the remaining slot value that makes the xor equation true.',
        'If peeling gets stuck with a cyclic core, the current hash seed failed. Production builders retry with a new seed or a slightly larger table. That probabilistic construction is the price paid for the compact static query layout.',
      ],
    },
    {
      heading: 'Invariant and proof idea',
      paragraphs: [
        'The reverse assignment invariant is: when a key is processed, at least one of its three slots is still free and the other needed values are already known. The peeled stack guarantees that because the key was removed through a degree-one slot.',
        'Solving the remaining slot makes the equation true for that key without changing equations already fixed later in the reverse order. By induction over the reversed stack, every stored key satisfies its xor equation. That is why the filter has no false negatives for the exact set used to build it.',
      ],
    },
    {
      heading: 'Visual checkpoints',
      paragraphs: [
        'In the peeling-build view, read each key as an edge touching three slots. The build is not storing the key in all three slots. It is finding an order in which the xor equations can be solved one remaining slot at a time.',
        'The peel-stack frame is the important transition: construction first removes keys, then fills table values in the opposite order. In the reverse-assignment frame, the highlighted slots for key A are the three positions whose stored bytes must xor back to the fingerprint for A.',
        'In the membership-query view, follow the four rows as the complete query path: compute three positions, load three bytes, xor them, compare to fingerprint(key). The error-semantics table explains the contract: present keys return maybe present, absent keys usually return definitely absent, and absent keys can collide by fingerprint chance.',
      ],
    },
    {
      heading: 'Parameter choices',
      paragraphs: [
        'Fingerprint width sets the false-positive budget. An 8-bit fingerprint is cheap but gives more accidental matches than a 12-bit or 16-bit fingerprint. The right value comes from the cost of a false positive. If a false positive only checks a local block cache, small fingerprints may be fine. If it triggers a network request or disk seek, the filter needs a lower false-positive rate.',
        'The table needs slack. Peeling fails more often when the table is too tight because the random hypergraph is more likely to contain a core with no degree-one slot. Production implementations choose a load factor that makes retries rare rather than chasing the theoretical minimum table size.',
        'Hashing must be deterministic for the serialized filter. The table, fingerprint seed, position seed, and any sizing parameters are part of the data format. A reader that cannot reproduce the same three positions cannot query the filter safely.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Build the filter beside the immutable object it guards. For an LSM tree, that usually means constructing it when an SSTable is flushed or compacted. For a manifest, it means constructing it when the snapshot is published. The filter and the source of truth should have the same lifetime.',
        'Make retry behavior explicit. A failed peel should return a normal build failure code with enough context to retry a new seed or larger allocation. Treating build failure as corruption makes operators fear a property that is actually part of the algorithm.',
        'Do not use the filter as the only record of the set. It stores fingerprints, not keys or values. A maybe-present result must flow to the real index, file, map, or object store. A definitely-absent result is the only answer the filter can make final.',
        'Test with adversarial shapes, not only random keys. Duplicate keys, tiny sets, already-hashed keys, empty sets, serialization round trips, and seed changes are where many static-filter bugs appear. The mathematical idea is small; the production surface is in building and loading it correctly.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Lookup is O(1) with a small fixed constant: three position computations, three table reads, two xor operations in the byte case, and one fingerprint comparison. Space is driven by fingerprint size and load factor. A larger fingerprint lowers the false-positive rate at the cost of more memory.',
        'Construction is expected linear in the number of keys but not deterministic for a fixed seed. The builder needs enough slack in the table for peeling to succeed with high probability. Retry logic is not optional in a real implementation.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Xor filters fit immutable storage files, SSTables, object manifests, CDN publication sets, package indexes, and versioned shards. They are especially useful when negative lookups are common and a definite negative avoids a much more expensive operation.',
        'They are also a good conceptual bridge to Binary Fuse and Ribbon filters. All of these structures make the static-filter bargain explicit: solve more during build, spend less during query.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Xor filters are a poor fit for live sets with frequent inserts and deletes. Adding one key changes the hypergraph and can invalidate the solved equations. The normal update is rebuild or replace the whole filter for a new snapshot.',
        'They also do not prove membership. A maybe-present answer is a hint to perform the real lookup. Xor is not a security primitive here; it is just the algebra used to reconstruct a small fingerprint. Use authenticated data structures when membership answers cross a trust boundary.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Xor Filters: Faster and Smaller Than Bloom and Cuckoo Filters at https://arxiv.org/abs/1912.08258. Study Bloom Filter, Cuckoo Filter, Cuckoo Hashing, Quotient Filter, Binary Fuse Filter, Ribbon Filter, Count-Min Sketch, RocksDB LSM Case Study, and S3 Object Storage Case Study next.',
      ],
    },
  ],
};
