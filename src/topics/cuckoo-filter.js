// Cuckoo filter: approximate membership with compact fingerprints, two
// candidate buckets, eviction on insert, and deletion without counters.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'cuckoo-filter',
  title: 'Cuckoo Filter',
  category: 'Data Structures',
  summary: 'A deletable approximate-membership filter: store tiny fingerprints in two possible buckets, kick victims on insert, and query with two probes.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['insert and query', 'deletion tradeoffs'], defaultValue: 'insert and query' },
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

function cuckooGraph(title) {
  return graphState({
    nodes: [
      { id: 'key', label: 'query key', x: 0.8, y: 3.6, note: 'hash once' },
      { id: 'fp', label: 'fingerprint', x: 2.4, y: 3.6, note: 'short tag' },
      { id: 'bucketA', label: 'bucket i1', x: 4.4, y: 2.0, note: 'slots: 4 tags' },
      { id: 'bucketB', label: 'bucket i2', x: 4.4, y: 5.2, note: 'alt(i1, fp)' },
      { id: 'kick', label: 'kick path', x: 6.5, y: 3.6, note: 'bounded evictions' },
      { id: 'table', label: 'filter table', x: 8.5, y: 3.6, note: 'fingerprints only' },
      { id: 'source', label: 'source of truth', x: 9.5, y: 1.4, note: 'value store' },
    ],
    edges: [
      { id: 'e-key-fp', from: 'key', to: 'fp', weight: 'tag' },
      { id: 'e-fp-a', from: 'fp', to: 'bucketA', weight: 'i1' },
      { id: 'e-fp-b', from: 'fp', to: 'bucketB', weight: 'i2' },
      { id: 'e-a-kick', from: 'bucketA', to: 'kick', weight: 'if full' },
      { id: 'e-b-kick', from: 'bucketB', to: 'kick', weight: 'if full' },
      { id: 'e-kick-table', from: 'kick', to: 'table', weight: 'settle' },
      { id: 'e-table-source', from: 'table', to: 'source', weight: 'maybe read' },
    ],
  }, { title });
}

function* insertAndQuery() {
  yield {
    state: cuckooGraph('A key becomes one fingerprint and two candidate buckets'),
    highlight: { active: ['key', 'fp', 'bucketA', 'bucketB'], found: ['e-key-fp', 'e-fp-a', 'e-fp-b'] },
    explanation: 'A cuckoo filter stores a short fingerprint, not the whole key. The fingerprint can live in either of two candidate buckets, so lookup normally checks only those two places.',
  };

  yield {
    state: labelMatrix(
      'Bucket contents',
      [
        { id: 'b0', label: 'bucket 17' },
        { id: 'b1', label: 'bucket 94' },
        { id: 'b2', label: 'bucket 42' },
        { id: 'b3', label: 'bucket 81' },
      ],
      [
        { id: 's0', label: 'slot 0' },
        { id: 's1', label: 'slot 1' },
        { id: 's2', label: 'slot 2' },
        { id: 's3', label: 'slot 3' },
      ],
      [
        ['9a', '11', 'c4', 'empty'],
        ['31', '9a', '77', 'e2'],
        ['04', 'a6', 'empty', 'empty'],
        ['f0', '44', '18', '88'],
      ],
    ),
    highlight: { active: ['b0:s0', 'b1:s1'], compare: ['b0:s3', 'b2:s2'] },
    explanation: 'A positive lookup is a fingerprint match in either candidate bucket. An empty or nonmatching pair is a definite negative; a match is only maybe present.',
    invariant: 'No stored member may lose its fingerprint; nonmembers may collide by fingerprint.',
  };

  yield {
    state: cuckooGraph('Insertion kicks a victim only when both buckets are full'),
    highlight: { active: ['bucketA', 'bucketB', 'kick', 'e-a-kick', 'e-b-kick'], found: ['table'] },
    explanation: 'Insertion first tries either candidate bucket. If both are full, it evicts one stored fingerprint and moves the victim to its alternate bucket, repeating for a bounded number of kicks.',
  };

  yield {
    state: labelMatrix(
      'Approximate-membership family',
      [
        { id: 'bloom', label: 'Bloom' },
        { id: 'counting', label: 'Counting Bloom' },
        { id: 'cuckoo', label: 'Cuckoo filter' },
        { id: 'xor', label: 'Xor/Binary Fuse' },
      ],
      [
        { id: 'query', label: 'query' },
        { id: 'delete', label: 'delete' },
        { id: 'best', label: 'best fit' },
      ],
      [
        ['k bit probes', 'not basic', 'simple mutable set'],
        ['k counters', 'yes, with counters', 'high delete rate'],
        ['two buckets', 'yes, remove tag', 'deletable compact filter'],
        ['few xor reads', 'static rebuild', 'immutable snapshot'],
      ],
    ),
    highlight: { found: ['cuckoo:query', 'cuckoo:delete'], compare: ['xor:best', 'bloom:delete'] },
    explanation: 'Cuckoo filters are the mutable middle ground: usually fewer probes than Bloom filters, much cheaper deletion than counting Bloom filters, but inserts can fail near high load.',
  };
}

function* deletionTradeoffs() {
  yield {
    state: labelMatrix(
      'Delete operation',
      [
        { id: 'hash', label: 'hash key' },
        { id: 'probe', label: 'probe buckets' },
        { id: 'remove', label: 'remove tag' },
        { id: 'missing', label: 'tag missing' },
      ],
      [
        { id: 'work', label: 'work' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['fingerprint + i1/i2', 'same path as lookup'],
        ['scan bucket slots', 'find matching tag'],
        ['clear one slot', 'member can become absent'],
        ['do nothing', 'key was not represented'],
      ],
    ),
    highlight: { active: ['probe:work', 'remove:work'], found: ['remove:meaning'], compare: ['missing:meaning'] },
    explanation: 'Deletion is possible because a cuckoo filter stores a movable fingerprint. You find the tag in one candidate bucket and clear exactly one slot.',
  };

  yield {
    state: cuckooGraph('The filter still accelerates a real source of truth'),
    highlight: { active: ['table', 'source', 'e-table-source'], found: ['bucketA', 'bucketB'] },
    explanation: 'A maybe-present answer should lead to the real data structure when correctness matters. The filter is an I/O guard, cache guard, or network guard, not an authority.',
  };

  yield {
    state: labelMatrix(
      'Failure modes to design for',
      [
        { id: 'load', label: 'high load' },
        { id: 'duplicate', label: 'duplicate keys' },
        { id: 'smallfp', label: 'short tags' },
        { id: 'deletefp', label: 'delete nonmember' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'response', label: 'response' },
      ],
      [
        ['kick loop fails', 'resize, stash, or rebuild'],
        ['same tag appears twice', 'track counts outside if needed'],
        ['more false positives', 'choose longer fingerprint'],
        ['could erase collided tag', 'delete only known inserts'],
      ],
    ),
    highlight: { active: ['load:symptom', 'deletefp:response'], compare: ['smallfp:response'] },
    explanation: 'The sharp edge is deletion semantics. A system should delete only keys it believes were inserted; deleting arbitrary nonmembers can remove a colliding fingerprint.',
  };

  yield {
    state: labelMatrix(
      'Production fit',
      [
        { id: 'cache', label: 'cache admission' },
        { id: 'db', label: 'database file guard' },
        { id: 'gateway', label: 'gateway denylist' },
        { id: 'snapshot', label: 'immutable snapshot' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['good', 'insert/delete matters'],
        ['good', 'avoid cold reads'],
        ['careful', 'false positives affect cost'],
        ['ok, but not best', 'static filters may be smaller'],
      ],
    ),
    highlight: { found: ['cache:fit', 'db:reason'], compare: ['snapshot:reason'] },
    explanation: 'Use cuckoo filters when the represented set changes and deletion matters. If the set is immutable, Xor, Binary Fuse, or Ribbon filters usually deserve a look.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'insert and query') yield* insertAndQuery();
  else if (view === 'deletion tradeoffs') yield* deletionTradeoffs();
  else throw new InputError('Pick a cuckoo filter view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A cuckoo filter is a compact approximate-membership data structure. It answers the same kind of question as a Bloom Filter: is this key definitely absent, or maybe present? The difference is that a cuckoo filter stores short fingerprints in a cuckoo-hashing table. A member key must have its fingerprint in one of two candidate buckets. A nonmember can collide with a stored fingerprint, so false positives remain possible, but false negatives should not occur for successfully inserted keys.',
        'The original paper, Cuckoo Filter: Practically Better Than Bloom, describes a filter that supports adding and removing items dynamically while achieving high lookup performance: https://www.cs.cmu.edu/~dga/papers/cuckoo-conext2014.pdf. The ACM record is at https://dl.acm.org/doi/10.1145/2674005.2674994.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a key x, compute a short fingerprint f. One hash gives the first bucket. A second bucket is derived from the first bucket and the fingerprint, commonly by xoring the bucket index with a hash of f. Lookup checks both buckets for f. If neither bucket contains f, x is definitely absent. If either bucket contains f, x is maybe present.',
        'Insertion first tries to place f in either candidate bucket. If both are full, the filter evicts a stored fingerprint from one bucket, places f there, and moves the evicted fingerprint to its alternate bucket. This kick-out chain continues until an empty slot is found or a maximum number of kicks is reached. A failed insert normally triggers resizing, rebuilding, changing hash seed, or using a small stash.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup is O(1) with a tiny constant: compute the fingerprint and inspect two buckets. Insert is expected O(1), but near high load factors the kick path can become long or fail. Deletion is O(1) because the filter can remove the matching fingerprint from one candidate bucket. The false-positive rate depends on fingerprint length, bucket size, and load.',
        'Compared with a basic Bloom filter, the most important practical feature is deletion. Compared with a counting Bloom filter, deletion does not require replacing each bit with a counter. Compared with Xor Filter, Binary Fuse Filter, and Ribbon Filter, cuckoo filters are more update-friendly but usually not the most space-efficient choice for immutable sets.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a storage service with a hot key-value cache and a slower object store. The cache wants to avoid expensive misses. A cuckoo filter can represent keys currently in the cache. On a request, the service checks the filter first. A definite negative skips the cache probe and goes directly to the backing path. A maybe-present answer checks the cache. When an item is admitted, insert its fingerprint. When it is evicted, delete it. This is exactly the kind of changing set where basic Bloom filters become awkward.',
        'The filter must still be paired with discipline. Cache eviction should delete only keys that were actually admitted. A false positive merely wastes a cache probe; it must not be interpreted as proof that a value exists. If insert failures rise, the table is too full or the workload needs a rebuild policy.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first misconception is that deletion is risk-free for arbitrary keys. If you delete a key that was never inserted, the fingerprint may collide with a real member and erase it. The second is that a cuckoo filter stores keys. It stores fingerprints, so it cannot return values and cannot prove membership. The third is ignoring load factor. A filter that is too full can suffer insertion failures even though lookups still look simple.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Cuckoo Filter: Practically Better Than Bloom at https://www.cs.cmu.edu/~dga/papers/cuckoo-conext2014.pdf, ACM DOI https://dl.acm.org/doi/10.1145/2674005.2674994, and the earlier USENIX workshop version at https://www.usenix.org/system/files/nsdip13-paper6.pdf. Study Bloom Filter, Cuckoo Hashing, Quotient Filter, Xor Filter, Binary Fuse Filter, and LSM Trees next.',
      ],
    },
  ],
};
