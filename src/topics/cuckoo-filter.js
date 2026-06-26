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
  const graphNodes = 7;
  const graphEdges = 7;
  const slotsPerBucket = 4;
  const numBuckets = 4;
  const filterFamilySize = 4;
  const candidateBuckets = 2;

  yield {
    state: cuckooGraph('A key becomes one fingerprint and two candidate buckets'),
    highlight: { active: ['key', 'fp', 'bucketA', 'bucketB'], found: ['e-key-fp', 'e-fp-a', 'e-fp-b'] },
    explanation: `A cuckoo filter stores a short fingerprint, not the whole key. The fingerprint can live in either of ${candidateBuckets} candidate buckets, so lookup normally checks only those ${candidateBuckets} places.`,
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
    explanation: `A positive lookup is a fingerprint match in either candidate bucket. Each bucket holds ${slotsPerBucket} slots, and an empty or nonmatching pair across ${candidateBuckets} buckets is a definite negative; a match is only maybe present.`,
    invariant: `No stored member may lose its fingerprint across the ${numBuckets} buckets; nonmembers may collide by fingerprint.`,
  };

  yield {
    state: cuckooGraph('Insertion kicks a victim only when both buckets are full'),
    highlight: { active: ['bucketA', 'bucketB', 'kick', 'e-a-kick', 'e-b-kick'], found: ['table'] },
    explanation: `Insertion first tries either of the ${candidateBuckets} candidate buckets. If both are full (all ${slotsPerBucket} slots occupied), it evicts one stored fingerprint and moves the victim to its alternate bucket, repeating for a bounded number of kicks.`,
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
    explanation: `Cuckoo filters are the mutable middle ground among ${filterFamilySize} filter families: usually fewer probes than Bloom filters, much cheaper deletion than counting Bloom filters, but inserts can fail near high load.`,
  };
}

function* deletionTradeoffs() {
  const deleteSteps = 4;
  const failureModes = 4;
  const candidateBuckets = 2;
  const productionScenarios = 4;

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
    explanation: `Deletion follows ${deleteSteps} steps and is possible because a cuckoo filter stores a movable fingerprint. You find the tag in one of ${candidateBuckets} candidate buckets and clear exactly one slot.`,
  };

  yield {
    state: cuckooGraph('The filter still accelerates a real source of truth'),
    highlight: { active: ['table', 'source', 'e-table-source'], found: ['bucketA', 'bucketB'] },
    explanation: `A maybe-present answer should lead to the real data structure when correctness matters. The filter checks ${candidateBuckets} buckets as an I/O guard, cache guard, or network guard, not an authority.`,
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
    explanation: `There are ${failureModes} failure modes to watch for, and the sharpest edge is deletion semantics. A system should delete only keys it believes were inserted; deleting arbitrary nonmembers can remove a colliding fingerprint.`,
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
    explanation: `Across ${productionScenarios} production scenarios, use cuckoo filters when the represented set changes and deletion matters. If the set is immutable, Xor, Binary Fuse, or Ribbon filters usually deserve a look.`,
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
        'The insert-and-query view follows one fingerprint through the placement pipeline. A key is hashed to a short tag, two candidate buckets are computed, the tag tries to land in an empty slot, and if both buckets are full a victim tag gets kicked to its alternate bucket. Active highlights mark the bucket currently being probed; found highlights mark a fingerprint that has settled into a legal home.',
        'The deletion-tradeoffs view exposes the dangerous edge of the structure. Removing a fingerprint from a bucket is cheap, but if you delete a key that was never inserted and its fingerprint happens to collide with a real member, you erase the real member\'s evidence. Watch which slot gets cleared and whether it belonged to the key being deleted or to someone else.',
        'At every frame, verify the fingerprint-home invariant: each stored fingerprint sits in one of its two candidate buckets. When a kick displaces a tag, the displaced tag must land in its own alternate bucket. Lookup correctness depends on this invariant surviving every insert, kick, and delete.',
        {type: 'image', src: './assets/gifs/cuckoo-filter.gif', alt: 'Animated walkthrough of the cuckoo filter visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many systems need a cheap gate before the real lookup. A storage engine wants to skip reading an SSTable that definitely does not contain a key. A cache wants to avoid probing a cold shard. A security service needs to check whether a token is on a deny list that changes every minute. In each case, the exact set lives somewhere else; the filter exists to reject definite misses before paying for the real I/O.',
        { type: 'callout', text: 'A cuckoo filter keeps deletion cheap by storing each key as one movable fingerprint with two legal homes.' },
        'A cuckoo filter is a mutable approximate-membership structure. It answers "definitely absent" when neither candidate bucket contains the key\'s fingerprint, and "maybe present" when one does. The advantage over a Bloom filter is deletion: instead of spreading each key across many shared bits, the cuckoo filter stores one small movable entry per key. Removing that entry is safe and O(1).',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The standard first answer is a Bloom filter. You hash the key with k independent hash functions, set k bits in a bit array, and on lookup check those same k bits. If any bit is zero the key is definitely absent. If all k bits are one the key is possibly present. Bloom filters are simple, fast, and excellent for append-only or immutable sets.',
        { type: 'image', src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Bloom_filter.svg', alt: 'Bloom filter bit array with hash positions for inserted keys', caption: 'Bloom filters spread each key across shared bits, which explains both compact negatives and hard deletion. Source: https://commons.wikimedia.org/wiki/File:Bloom_filter.svg.' },
        'Deletion is where Bloom filters break. Suppose keys A and B both set bit 7. Clearing bit 7 when you remove A destroys evidence for B, creating a false negative. Counting Bloom filters replace bits with counters, but now each insert and delete touches k counters, the structure uses 3-4x more space, and counter overflow becomes a real operational concern.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is mutable membership. Real systems admit and evict cache entries, expire bad credentials, compact storage files, and rotate metadata. A filter that cannot delete cheaply either becomes stale -- growing its false-positive rate as dead entries accumulate -- or must be rebuilt on a schedule, which costs CPU, memory, and coordination complexity.',
        'The harder wall is preserving the no-false-negative promise under mutation. An approximate filter is allowed to say "maybe present" for absent keys, but it must never say "absent" for a key that is genuinely stored. Any deletion scheme that can accidentally erase evidence for a different key violates this contract. The structure needs a way to tie each piece of evidence to a single removable entry.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store a short fingerprint (a hash fragment, typically 8-16 bits) instead of the full key. Give that fingerprint two candidate buckets using the cuckoo-hashing placement rule: primary bucket i1 = hash(key) mod m, alternate bucket i2 = i1 XOR hash(fingerprint) mod m. A lookup computes the same fingerprint and bucket pair, then scans those two small buckets for a matching tag.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Cuckoo_hashing_example.svg/250px-Cuckoo_hashing_example.svg.png', alt: 'Cuckoo hashing diagram showing alternate locations and eviction arrows', caption: 'Cuckoo placement gives each item two legal homes; cuckoo filters apply the same idea to short fingerprints. Source: https://en.wikipedia.org/wiki/Cuckoo_hashing.' },
        'The structure is deliberately weaker than an exact set. It cannot prove a key is present because multiple keys can share the same fingerprint. But it can prove absence: when neither candidate bucket contains the fingerprint, the key was never inserted. That definite negative is the answer most systems need most often.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The filter is an array of m buckets, each holding b slots (typically b = 4). Each slot stores one fingerprint. No slot stores the original key -- only the short tag.',
        'Insert key x: compute fingerprint f = tag(x). Compute i1 = hash(x) mod m. Compute i2 = i1 XOR hash(f) mod m. If bucket i1 has an empty slot, store f there and stop. Otherwise try bucket i2. If both are full, pick a random occupied slot in i1, swap f into that slot, and the evicted fingerprint g moves to its alternate bucket: i2_g = current_bucket XOR hash(g). This repeats until an empty slot is found or a kick limit (typically 500) is reached. If the limit is hit, insertion fails and the table needs a resize or rebuild.',
        'Lookup key x: compute f = tag(x), i1 = hash(x) mod m, i2 = i1 XOR hash(f). Scan bucket i1 and bucket i2 for any slot containing f. If found, report "maybe present." If no match in either bucket, report "definitely absent." Cost: scan 2 * b slots, which is O(1).',
        'Delete key x: compute f and the two candidate buckets exactly as in lookup. Find a slot containing f and clear it. If no matching slot exists, do nothing -- the key was not represented. Cost: O(1). This is possible because each key\'s evidence is a single removable entry, not shared bits.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on the fingerprint-home invariant. After every successful insertion, the key\'s fingerprint sits in one of the two buckets that lookup will check. Kicks preserve this: when fingerprint g is evicted from bucket j, it moves to j XOR hash(g), which is by construction its other legal home. So every fingerprint in the table is always in one of its two candidate buckets.',
        'False positives are unavoidable because the fingerprint is shorter than the key. With an f-bit fingerprint and b slots per bucket, the probability that a random non-member\'s fingerprint matches any slot in the two candidate buckets is approximately 2b / 2^f. For b = 4 and f = 8 bits, that is 8/256 = 3.1%. Doubling the fingerprint to 16 bits drops this to 8/65536 = 0.012%. The tradeoff is direct: longer fingerprints cost more bits per entry but exponentially reduce false positives.',
        'False negatives cannot happen under correct usage. If key x was inserted and not deleted, its fingerprint f is somewhere in the table inside one of x\'s two candidate buckets. Lookup checks both buckets and will find it. The only path to a false negative is deleting a non-member whose fingerprint collides with a member -- which removes the member\'s evidence. This is a usage error, not a structural flaw.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup: O(1). Two bucket scans of b slots each. With b = 4 this is 8 fingerprint comparisons -- a single cache line read on most hardware.',
        'Delete: O(1). Same two-bucket scan, then clear one slot.',
        'Insert: expected O(1), but with a heavy tail. Most insertions place the fingerprint directly or after one kick. At high load (above 95% with b = 4), kick chains grow longer and may hit the configured limit. Insertion failure is not a bug; it is a signal to resize. The amortized cost stays O(1) when the load factor is kept in the practical range (below ~95% for b = 4, below ~85% for b = 2).',
        'Space: each entry costs f bits. With 4-slot buckets and 8-bit fingerprints, the filter uses about 8.5 bits per key at 95% load -- comparable to a Bloom filter at the same 3% false-positive rate, and better than Bloom at lower target rates. Fan et al. (2014, Table 3) showed cuckoo filters beat Bloom on bits-per-key for false-positive rates below about 3%.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Cache admission and eviction: a storage cache inserts a key\'s fingerprint on admission and deletes it on eviction. Lookups that miss the filter skip the cache entirely, saving I/O. Because the filter tracks the current cache contents (not a stale superset), the false-positive rate stays low.',
        'Database file guards: LSM-tree engines like LevelDB and RocksDB use filters to avoid reading SSTables that do not contain a key. When SSTables are compacted and old ones are deleted, the filter needs to remove those keys. A cuckoo filter handles this without rebuilding from scratch.',
        'Dynamic deny lists: a security gateway maintains a set of blocked tokens. Tokens are added and removed frequently. The filter rejects definite non-blocked tokens in O(1), sending only "maybe blocked" tokens to the authoritative policy store for verification.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Static sets: if the set never changes, immutable filters (Xor, Binary Fuse, Ribbon) are typically smaller and faster to query. A cuckoo filter\'s mutability machinery is wasted overhead when you only build once and query forever.',
        'Append-only sets: if you only insert and never delete, a plain Bloom filter is simpler, well-understood, and has no insertion failure mode. The cuckoo filter\'s main selling point -- deletion -- provides no value here.',
        'Near saturation: at very high load factors, insertion kick chains grow long and may cycle. The filter must then resize or rebuild, which is O(n). If the application cannot tolerate this latency spike on a write path, the filter adds more operational risk than it removes.',
        'Trusting "maybe present": the filter is a precheck, not an authority. Every positive answer must flow to the real data store for verification. If application logic starts treating "maybe present" as "present," false positives become user-visible correctness bugs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Setup: 8 buckets (indices 0-7), 2 slots per bucket, 8-bit fingerprints. Alternate bucket: i2 = i1 XOR hash(fingerprint) mod 8. Suppose hash(0x3a) mod 8 = 5, hash(0x91) mod 8 = 2.',
        'Insert key K with fingerprint 0x3a. i1 = hash(K) mod 8 = 3. i2 = 3 XOR 5 = 6. Bucket 3 has room. Store 0x3a in bucket 3, slot 0. Table: bucket 3 = [0x3a, empty].',
        'Insert key L with fingerprint 0x91. i1 = hash(L) mod 8 = 3. i2 = 3 XOR 2 = 1. Bucket 3 has one slot left. Store 0x91 in bucket 3, slot 1. Table: bucket 3 = [0x3a, 0x91].',
        'Insert key M with fingerprint 0x3a. i1 = hash(M) mod 8 = 3. Bucket 3 is full. Try i2 = 3 XOR 5 = 6. Bucket 6 has room. Store 0x3a in bucket 6, slot 0. Now two copies of 0x3a exist (one for K, one for M) in different buckets. The filter does not distinguish them.',
        'Lookup key N (never inserted) with fingerprint 0x3a. i1 = hash(N) mod 8 = 6. i2 = 6 XOR 5 = 3. Check bucket 6: finds 0x3a. Report "maybe present." This is a false positive: N was never inserted, but its fingerprint collides with K and M.',
        'Delete key K. Compute i1 = 3, i2 = 6. Find 0x3a in bucket 3, slot 0. Clear that slot. Bucket 3 = [empty, 0x91]. Key M\'s copy in bucket 6 is unaffected. If we mistakenly deleted key N (never inserted), we would find 0x3a in bucket 6 and erase M\'s fingerprint -- creating a false negative for M. This is why the caller must only delete keys it knows were inserted.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational paper is Fan, Andersen, Kaminsky, and Mitzenmacher, "Cuckoo Filter: Practically Better Than Bloom" (CoNEXT 2014). Full text: https://www.cs.cmu.edu/~dga/papers/cuckoo-conext2014.pdf. ACM DOI: https://dl.acm.org/doi/10.1145/2674005.2674994. An earlier workshop version appeared at USENIX: https://www.usenix.org/system/files/nsdip13-paper6.pdf.',
        'Study Bloom Filter for the bit-array baseline and why deletion is hard there. Study Cuckoo Hashing for the two-home displacement invariant that underlies the filter. Study Quotient Filter for another deletable approximate-membership design with different tradeoffs. Study Xor Filter and Binary Fuse Filter for the best static (immutable) filters. Study LSM Trees for the storage-engine context where these filters most commonly appear.',
      ],
    },
  ],
};
