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
      heading: 'How to read the animation',
      paragraphs: [
        "The insert-and-query view shows one fingerprint moving through the placement pipeline: hash the key to a short tag, compute two candidate buckets, try to place the tag, and kick a victim if both buckets are full. Active highlights mark the bucket being probed; found highlights mark a fingerprint that has settled into a legal home.",
        "The deletion-tradeoffs view shows the sharp edge: removing a fingerprint from a bucket is cheap, but deleting a nonmember whose fingerprint collides with a real member can create a false negative. Watch which slots change and whether the cleared tag belonged to the key being deleted or to a collision.",
        "At each frame, track the fingerprint-home invariant: every stored fingerprint must sit in one of its two candidate buckets. If a kick displaces a tag, the victim lands in its own alternate bucket. Lookup correctness depends on this invariant surviving every insert, kick, and delete.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        "Many systems need a cheap front-door answer before they pay for the real lookup. A storage engine wants to know whether an SSTable might contain a key. A cache wants to avoid probing a cold shard. A security service may need to ask whether a token is on a changing deny list. The exact set still lives somewhere else; the filter exists to reject definite misses quickly.",
        { type: 'callout', text: 'A cuckoo filter keeps deletion cheap by storing each key as one movable fingerprint with two legal homes.' },
        "A cuckoo filter is for mutable approximate membership. It answers no with certainty for keys that are not represented, and maybe for keys that collide with stored fingerprints. Its advantage over a basic Bloom filter is deletion: the filter stores small movable entries instead of spreading each key across many shared bits.",
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "The standard first answer is a Bloom filter. Hash the key several times, set several bits, and check those bits on lookup. If any required bit is zero, the key is definitely absent. If all required bits are one, the key may be present. It is simple, fast, and very good for append-heavy or immutable sets.",
        { type: 'image', src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Bloom_filter.svg', alt: 'Bloom filter bit array with hash positions for inserted keys', caption: 'Bloom filters spread each key across shared bits, which explains both compact negatives and hard deletion. Source: https://commons.wikimedia.org/wiki/File:Bloom_filter.svg.' },
        "Deletion is the problem. Clearing a Bloom-filter bit can damage another key that happened to set the same bit. Counting Bloom filters replace bits with counters, but now each insert and delete touches multiple counters, the structure takes more space, and counter overflow or underflow becomes another operational concern.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "The wall is mutable membership. Real systems admit and evict cache entries, expire bad credentials, compact storage files, and replace metadata. A filter that cannot delete cheaply either becomes stale or has to be rebuilt on a schedule. Staleness means extra false positives; rebuilding means CPU, memory, and deployment complexity.",
        "The harder wall is preserving the no-false-negative promise. An approximate filter may return false positives, but it must not say absent for an inserted key. Cuckoo filters keep that promise by storing a fingerprint in one of two legal homes. Lookup checks both homes. As long as insertion and deletion maintain that invariant, every represented key remains findable.",
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "Store a short fingerprint, not the full key. Give that fingerprint two candidate buckets using the cuckoo-hashing placement idea. A lookup computes the same fingerprint and bucket pair, then scans those two small buckets for a matching fingerprint.",
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Cuckoo_hashing_example.svg/250px-Cuckoo_hashing_example.svg.png', alt: 'Cuckoo hashing diagram showing alternate locations and eviction arrows', caption: 'Cuckoo placement gives each item two legal homes; cuckoo filters apply the same idea to short fingerprints. Source: https://en.wikipedia.org/wiki/Cuckoo_hashing.' },
        "The structure is intentionally weaker than an exact set. It cannot prove that the original key is present because different keys can share the same fingerprint. But it can prove absence when neither candidate bucket contains that fingerprint, and that is the answer many systems need most often.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "In the insert view, follow one fingerprint. First it tries one legal bucket, then the alternate bucket, then it may kick another fingerprint and continue the displacement chain. The important idea is not the motion; it is that every moved fingerprint still lands in one of its two legal homes.",
        "In the deletion view, notice the difference between deleting a represented key and deleting a colliding nonmember. Removing a matching fingerprint is cheap, but the filter does not know the original key. That is the price of compact approximate membership.",
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        "For key x, compute a fingerprint f. One hash chooses the primary bucket. The alternate bucket is commonly derived from the primary bucket and a hash of f, often by an XOR-style transform. That derivation matters: after a fingerprint has been kicked out of one bucket, the filter can compute its other legal bucket without storing the original key.",
        "Lookup is two bucket probes. If neither bucket contains f, x is definitely absent. If either bucket contains f, x is maybe present. Insertion first tries to place f in an empty slot in either candidate bucket. If both are full, it selects a victim fingerprint, swaps f into that slot, and moves the victim to its alternate bucket. The process repeats until an empty slot is found or an insertion limit is reached.",
        "Deletion checks the same two buckets and clears one matching fingerprint. This is why cuckoo filters are useful for changing sets: the evidence for a key is a small entry that can be removed from a bucket, not a collection of shared bits whose ownership is unknown.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "Suppose a cache admits key K and its fingerprint is 0x3a. The primary bucket is 17 and the alternate bucket is 42. Bucket 17 is full, so the insertion kicks fingerprint 0x91 from bucket 17, stores 0x3a there, and moves 0x91 to its own alternate bucket. If that bucket has room, the insertion is done. Later, lookup for K checks buckets 17 and 42 and finds 0x3a.",
        "Now suppose a different key Q also maps to the same fingerprint and one of the same buckets. The filter will return maybe present for Q even if Q was never inserted. That is a false positive, but it only causes a real lookup. The source of truth still decides whether Q is actually present.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "The no-false-negative argument is the fingerprint-home invariant. Every successful insertion leaves the key fingerprint in one of the two buckets lookup will check. Kicks do not break the invariant because each victim is moved to its alternate legal home. Deletion of a genuinely represented key removes that key's evidence, which is exactly the requested state change.",
        "False positives are unavoidable because the fingerprint is shorter than the key. The filter trades exact identity for compact evidence. Longer fingerprints reduce accidental matches, larger buckets reduce insertion failure, and lower load factors reduce long kick chains. Those knobs tune the space, speed, and reliability envelope.",
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        "Lookup is O(1): compute the fingerprint and inspect two small buckets. Deletion is also O(1) for a matching fingerprint. Insertion is expected O(1), but the worst cases are real: at high load, displacement chains can grow, cycle, or hit the configured kick limit. Production implementations need a resize, rebuild, stash, or fallback path.",
        "The false-positive rate depends mainly on fingerprint length, bucket size, and occupancy. Larger fingerprints cost more bits per entry but reduce accidental matches. Bigger buckets make insertion easier but can increase scan work per lookup. Higher load saves memory but raises insertion failure risk. The useful design space is a compromise, not a single magic parameter.",
      ],
    },
    {
      heading: 'Deletion and correctness',
      paragraphs: [
        "Deletion is safe when the caller deletes only keys that were inserted and not already deleted. If the caller deletes a nonmember whose fingerprint collides with a real member, the filter can erase the real member's fingerprint and create a false negative. That is why a cuckoo filter should sit behind an API that knows membership semantics, or beside a source of truth that confirms deletes.",
        "Duplicate keys need care too. If the same key can be inserted multiple times, a plain cuckoo filter does not count multiplicity. Removing one matching fingerprint may represent one insert or all inserts depending on the surrounding system. Counting variants or external reference counts are needed when multiplicity matters.",
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        "Cuckoo filters fit mutable guards: cache admission and eviction, database file checks, object-store indexes, dynamic deny lists, duplicate-suppression windows, and services where a false positive only wastes a real lookup. The source of truth must still be cheap enough to consult on maybe-present answers.",
        "A storage cache is the clean example. A definite negative skips a cold cache probe. A maybe-present result checks the cache. Insert on admission and delete on eviction keep the filter aligned with the changing cache contents, so the false-positive rate reflects current state instead of old entries that should have disappeared.",
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "Use an immutable filter when the set is static. Xor, Binary Fuse, and Ribbon filters often win on space for build-once data. Use a Bloom filter when append-only behavior is enough and deletion is not needed. Use an exact hash table when false positives are unacceptable or when the system needs to return values rather than only gate lookups.",
        "Cuckoo filters also become uncomfortable near saturation. Insert failures are not bugs; they are part of the design. If the application cannot tolerate rebuilds or temporary fallback lookups during resize, the filter may add more operational risk than it removes.",
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        "Common failures are overloading the table, using fingerprints that are too short, deleting keys without checking the source of truth, forgetting duplicate semantics, and measuring only lookup speed while ignoring rebuild cost. A filter that is wonderful at 85 percent load in a benchmark may be fragile under bursty production inserts.",
        "Another failure is treating maybe-present as present. The filter is a precheck, not an authority. Every positive answer must flow to the real data structure, database, cache, or policy store that can verify the key. If product logic starts trusting positives, false positives become user-visible correctness bugs.",
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        "Primary sources: Cuckoo Filter: Practically Better Than Bloom at https://www.cs.cmu.edu/~dga/papers/cuckoo-conext2014.pdf, ACM DOI https://dl.acm.org/doi/10.1145/2674005.2674994, and the earlier USENIX workshop version at https://www.usenix.org/system/files/nsdip13-paper6.pdf.",
        "Study Bloom Filter for the bit-array baseline, Cuckoo Hashing for the displacement invariant, Quotient Filter for another deletable approximate-membership design, Xor Filter and Binary Fuse Filter for static filters, Ribbon Filter for compact immutable sets, and LSM Trees for the storage-engine setting where these filters often appear.",
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        'Buckets of size 4, 8-bit fingerprints. Primary bucket index i1 = hash(x) mod m, alternate i2 = i1 XOR hash(fingerprint).',
        'Insert key A with fingerprint 0x3a. i1 = 5, bucket 5 has room. Store 0x3a in bucket 5, slot 0.',
        'Insert key B with fingerprint 0x3a. i1 = 5, same bucket. Store 0x3a in bucket 5, slot 1. Two identical fingerprints can coexist -- the filter does not distinguish keys, only tags.',
        'Insert key C with fingerprint 0x7f. i1 = 5, bucket 5 is now full (4 slots taken). i2 = 5 XOR hash(0x7f) = 12, bucket 12 has room. Store 0x7f in bucket 12.',
        'Lookup key D with fingerprint 0x3a. Check buckets i1 and i2. Find 0x3a in bucket 5 -- maybe present. D was never inserted, but its fingerprint collides with A and B. This is the false-positive mechanism.',
        'Delete key A. Find 0x3a in bucket 5, clear one slot. Now only one 0x3a remains (for B). If we deleted key D instead (never inserted), we would erase B\'s fingerprint -- a false negative. Delete only known members.',
        {
          type: 'bullets',
          items: [
            'What is the fingerprint-home invariant? Every stored fingerprint sits in one of its two candidate buckets; lookup checks exactly those two buckets.',
            'Why can the alternate bucket be computed from the fingerprint alone? Because i2 = i1 XOR hash(fingerprint), so given either bucket index and the fingerprint, the other index is recoverable without the original key.',
            'When does insertion fail? When a displacement chain exceeds the configured kick limit, meaning both candidate buckets for every fingerprint in the chain are full. The table needs a resize or rebuild.',
            'Why are cuckoo filters often more space-efficient than Bloom filters at low false-positive rates? A Bloom filter needs roughly 1.44 * log2(1/epsilon) bits per element. A cuckoo filter stores one fingerprint per element with high bucket occupancy (~95%), so at target FP rates below ~3%, the cuckoo filter uses fewer bits per key (Fan et al. 2014, Table 3).',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Four buckets (0-3), each holding 2 fingerprints. Alternate bucket: i2 = i1 XOR hash(fp) mod 4. Suppose hash maps fp values as: hash(0xab) mod 4 = 2, hash(0xcd) mod 4 = 1, hash(0xef) mod 4 = 3.',
        'Insert fp 0xab at i1=1. Bucket 1 has room. Bucket 1: [0xab, empty].',
        'Insert fp 0xcd at i1=0. Bucket 0 has room. Bucket 0: [0xcd, empty].',
        'Insert fp 0xef at i1=1. Bucket 1 has one slot left. Bucket 1: [0xab, 0xef].',
        'Insert fp 0xab at i1=1. Bucket 1 is full. Try i2 = 1 XOR hash(0xab) mod 4 = 1 XOR 2 = 3. Bucket 3 has room. Bucket 3: [0xab, empty].',
        'Insert fp 0xcd at i1=0. Bucket 0 has one slot left. Bucket 0: [0xcd, 0xcd].',
        'Insert fp 0xef at i1=1. Bucket 1 is full. Try i2 = 1 XOR 3 = 2. Bucket 2 has room. Bucket 2: [0xef, empty]. Now delete key with fp 0xcd from bucket 0. One slot cleared: Bucket 0: [0xcd, empty]. The other 0xcd still represents its original key.',
        'Predict: lookup for a key with fp 0xab checks buckets 1 and 3. Both contain 0xab. The filter says maybe present regardless of which bucket the key was actually placed in. Now ask: if we delete both 0xab entries, how many keys lose their representation?',
      ],
    },
],
};
