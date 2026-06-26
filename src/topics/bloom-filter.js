// Bloom filter: a bit array + k hash functions. Answers "have I seen this?"
// in O(1) and almost no memory — with one weird rule: "no" is certain,
// "yes" is only probable.

import { arrayState, parseNumberList, parseNumber } from '../core/state.js';

export const topic = {
  id: 'bloom-filter',
  title: 'Bloom Filter',
  category: 'Systems',
  summary: 'A probabilistic set in a handful of bits: "definitely not seen" or "probably seen" — never wrong about no.',
  controls: [
    { id: 'keys', label: 'Insert keys', type: 'number-list', defaultValue: '21, 47, 89' },
    { id: 'query', label: 'Then query', type: 'number', defaultValue: '47' },
  ],
  run,
};

const BITS = 16;
// Three independent-ish hash functions. Real filters use better ones;
// the mechanics are identical.
const HASHES = [
  (key) => ((key * 7 + 3) % BITS + BITS) % BITS,
  (key) => ((key * 11 + 5) % BITS + BITS) % BITS,
  (key) => ((key * 13 + 1) % BITS + BITS) % BITS,
];

export function* run(input) {
  const keys = parseNumberList(input.keys, { min: 2, max: 5, label: 'keys' });
  const query = parseNumber(input.query, { label: 'a key to query' });

  const bits = new Array(BITS).fill(0);

  yield {
    state: arrayState(bits),
    highlight: {},
    explanation: `${BITS} bits, all zero, and 3 hash functions. That's the entire data structure. A bloom filter never stores the keys themselves — it only stores FOOTPRINTS: each key flips 3 bits on. The trade: massive space savings for a small chance of false alarms.`,
  };

  for (const key of keys) {
    const positions = HASHES.map((h) => h(key));
    yield {
      state: arrayState(bits),
      highlight: { active: positions.map((p) => `i${p}`) },
      explanation: `insert(${key}): the three hashes point at bits ${[...new Set(positions)].join(', ')}. Set them all to 1 — that's the whole insert, O(1), and the key itself is thrown away.`,
    };
    for (const p of positions) bits[p] = 1;
    yield {
      state: arrayState(bits),
      highlight: { found: positions.map((p) => `i${p}`) },
      explanation: `${key} is now "remembered" as a 3-bit footprint. ${bits.filter(Boolean).length} of ${BITS} bits are on. Notice footprints can OVERLAP other keys' bits — that overlap is where false positives will come from.`,
      invariant: 'Every inserted key has all 3 of its bits set. (The reverse is not guaranteed!)',
    };
  }

  const queryPositions = HASHES.map((h) => h(query));
  const allSet = queryPositions.every((p) => bits[p] === 1);
  const wasInserted = keys.includes(query);
  yield {
    state: arrayState(bits),
    highlight: { compare: queryPositions.map((p) => `i${p}`) },
    explanation: `query(${query}): check the same three positions — bits ${[...new Set(queryPositions)].join(', ')}. ${allSet ? 'All are 1.' : 'At least one is 0.'}`,
  };

  if (!allSet) {
    yield {
      state: arrayState(bits),
      highlight: { visited: queryPositions.map((p) => `i${p}`) },
      explanation: `Answer: DEFINITELY NOT present — and that's a mathematical certainty, because inserting ${query} would have set all three of those bits. This guaranteed "no" is the bloom filter's superpower: skip the expensive lookup entirely.`,
    };
  } else {
    yield {
      state: arrayState(bits),
      highlight: { found: queryPositions.map((p) => `i${p}`) },
      explanation: wasInserted
        ? `Answer: PROBABLY present — and indeed, ${query} was inserted. But note the wording: the filter can't tell whether these bits were set by ${query} or by other keys' overlapping footprints.`
        : `Answer: PROBABLY present — but ${query} was NEVER inserted! This is a FALSE POSITIVE: other keys happened to cover all three of its bits. Bloom filters trade a small, tunable false-positive rate (size the array right and it's ~1%) for using ~10 bits per key instead of storing keys at all.`,
    };
  }

  yield {
    state: arrayState(bits),
    highlight: {},
    explanation: `Where this runs in production: Chrome used one to check URLs against malware lists, Cassandra and RocksDB use them to skip disk reads for absent keys, CDNs use them to decide what's worth caching. The pattern: put a cheap "definitely not" filter in front of an expensive lookup. Built from nothing but the Hash Table idea — minus the table.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The row of cells is a bit array. Each cell holds one bit, numbered left to right starting at zero. Every cell begins at 0 (empty). When a bit flips to 1, the cell fills in and stays filled -- bits in a Bloom filter are never cleared.',
        'During insertion, highlighted cells mark the three bit positions that the key\'s hash functions produce. After the bits are set, they turn green to confirm the footprint is stored. During a query, the same three positions are checked: if all three are 1, the answer is "probably present"; if any one is 0, the answer is "definitely not present."',
        'Pay attention to overlap between keys. When two keys hash to a shared bit position, the second insertion finds that bit already at 1. The filter has no way to know which key set it. When a query finds all three of its bits set by the combined footprints of other keys, you are watching a false positive happen in real time.',
        {type: 'callout', text: 'A Bloom filter saves memory by storing only hash footprints, making every zero bit a proof of absence and every all-one query only a maybe.'},
        {type: 'image', src: './assets/gifs/bloom-filter.gif', alt: 'Animated walkthrough of the bloom filter visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'In 1970 Burton Howard Bloom asked a precise question: how much memory can you save on set-membership queries if you tolerate a small probability of saying "yes" when the true answer is "no"? His answer -- published as "Space/Time Trade-offs in Hash Coding with Allowable Errors" -- was a structure that never stores the elements themselves, only the side effects of hashing them into a bit array.',
        'The savings are dramatic. Storing 1 billion URLs in a hash set costs roughly 50 GB because every URL string, pointer, and object header lives in memory. A Bloom filter answering the same "is this URL in the set?" question at a 1% false-positive rate needs about 1.2 GB -- roughly 40x less. After hashing, the filter never touches the URL again.',
        'The pattern it enables is a cheap negative gate. Many production systems ask "is this key here?" millions of times per second, and the answer is usually no. When the filter answers no, the system skips the expensive disk read or network call entirely. When it answers maybe, the system falls through to the full lookup. One fast bit-level check eliminates the vast majority of real work.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A hash set solves membership exactly. Hash each element, store it in a bucket, look it up in O(1). You get insertion, deletion, enumeration, and zero uncertainty -- every positive is a true positive, every negative is a true negative. There is no probabilistic wiggle room.',
        'For small to moderate sets that fit comfortably in memory, a hash set is the right answer. Nothing about it is wrong until the set grows large and the only question you ever ask is a binary "member or not."',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Hash sets store the actual keys. A hundred million email addresses cost gigabytes -- every string lives in full, plus bucket pointers, object headers, and load-factor slack. Doubling the set doubles the memory. The system pays full storage cost to answer a question whose answer is usually "not a member."',
        'You might try a simpler trick: hash each key to one position in a bit array, setting that single bit to 1. With 100 million keys in a billion-bit array, roughly 10% of bits end up set. Any query landing on a set bit is a false positive, and there is no way to distinguish it from a true member. The false-positive rate equals the fill ratio of the array. One hash function cannot spread information thinly enough to bring that rate down to a useful level.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use k hash functions instead of one. Each inserted key sets k independent bit positions. A query checks the same k positions and requires all of them to be 1 before answering "probably present." The probability that a non-member passes this check is the k-th power of the single-bit collision probability -- it shrinks exponentially with k.',
        'Concretely: if the array is 10% full and k = 1, the false-positive rate is 10%. With k = 3 it drops to 0.1%. With k = 7 it falls to about 0.001%. Each additional hash function multiplies the hurdle a non-member must clear, because it needs all k independent bits to coincidentally be 1. The trade is that each insertion also sets k bits, filling the array faster, so there is an optimal k that balances these two forces.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Bloom filter consists of an m-bit array (all zeros initially) and k independent hash functions, each mapping a key uniformly to a position in [0, m-1]. To insert a key, compute all k hashes and set the k resulting bits to 1. To query a key, compute the same k hashes and check the k positions. If any position holds a 0, the key was definitely never inserted. If all k positions hold 1, the key is probably present. There is no delete operation -- bits are never cleared.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Bloom_filter.svg/500px-Bloom_filter.svg.png', alt: 'Bloom filter bit array with hash arrows for inserted keys and a query key.', caption: 'Inserted keys set multiple bits, while a missing zero bit proves absence for a query. (Source: Wikimedia Commons)'},
        'After inserting n elements, the probability that a specific bit is still 0 is (1 - 1/m)^(kn), which approximates e^(-kn/m). The false-positive probability -- the chance that all k bits for a non-member are 1 -- is therefore approximately (1 - e^(-kn/m))^k. The optimal number of hash functions that minimizes this expression is k = (m/n) * ln(2), roughly 0.693 times the bits-per-element ratio.',
        'For a target false-positive rate p, the required number of bits is m = -n * ln(p) / (ln(2))^2. At p = 1%, this works out to about 9.6 bits per element regardless of element size, with k = 7. At p = 0.1%, it is about 14.4 bits per element with k = 10. Halving p costs roughly 1.44 additional bits per element -- a logarithmic trade.',
        'Real implementations avoid computing k truly independent hashes. Kirsch and Mitzenmacher proved in 2004 that h_i(x) = h1(x) + i * h2(x) mod m, using just two base hashes, preserves the theoretical false-positive guarantees. This means a single pair of good hash functions (such as the two halves of a 128-bit MurmurHash) suffices for any k.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The no-false-negatives guarantee rests on a single invariant: bits are only ever set, never cleared. If key x was inserted, all k of its bit positions were set to 1 at insertion time. No subsequent operation can undo this. Querying x will always find all k bits at 1, so a negative answer is always truthful. This is a monotonicity argument -- the set of 1-bits only grows.',
        'False positives arise from bit collisions. As n keys are inserted, each setting k bits, the fraction of 1-bits in the array grows. A key y that was never inserted still hashes to k positions. Each of those positions has some probability of already being 1 due to other keys\' footprints. When all k happen to be 1 by coincidence, the filter cannot distinguish y from a true member. The probability of this accident is (1 - e^(-kn/m))^k -- it rises as the array fills and falls as you add more bits or increase k toward the optimum.',
        'The guarantee breaks immediately if any bit is cleared. Suppose bit j was set by keys A, B, and C. Clearing it because A is deleted introduces false negatives for B and C -- their queries will find bit j at 0 and incorrectly conclude they were never inserted. This is why the standard Bloom filter has no delete operation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert costs O(k) -- compute k hashes, set k bits. Query costs O(k) -- compute k hashes, check k bits. Since k is a small constant (typically 3 to 13), both operations are O(1) in practice. There is no resizing, no chaining, no probing, and no pointer chasing.',
        'Space is m bits total, completely independent of key size. The keys are discarded after hashing. Concrete numbers: at 1% false-positive rate, the filter uses 9.6 bits per element with k = 7. At 0.1%, 14.4 bits per element with k = 10. A filter for 1 billion items at 1% error occupies about 1.2 GB. Compare that to the 50+ GB a hash set of the same billion items would require.',
        'The filter supports no deletion, no enumeration, and no exact counting. Each bit is write-once. Counting Bloom filters replace each bit with a small counter (typically 4 bits) to allow deletion, at 4x memory cost. Cuckoo filters offer deletion with better space efficiency when the target false-positive rate is below about 3%.',
        'The hidden cost is capacity planning. A Bloom filter must be sized at construction time for an expected maximum population n. If the actual population significantly exceeds n, the array saturates -- most bits go to 1 and the false-positive rate climbs toward 100%. An overfull Bloom filter is an expensive array of ones that says "maybe" to everything.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Chrome\'s Safe Browsing feature shipped a Bloom filter of known-malicious URLs to every browser installation. Before navigating to any URL, Chrome checked the filter locally. A negative meant the URL was safe with certainty. A positive triggered a server-side verification request. The result: most checks stayed entirely local, bandwidth was minimal, and no malicious URL was ever missed by the filter.',
        'LSM-tree storage engines like LevelDB, RocksDB, and Cassandra attach a Bloom filter to each on-disk SSTable file. A point lookup for a key might otherwise need to probe dozens of sorted files across multiple compaction levels. The Bloom filter turns most of those disk reads into a handful of hash computations -- if the filter says "definitely not in this file," the entire file is skipped.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Bloom_filter_speed.svg/500px-Bloom_filter_speed.svg.png', alt: 'Bloom filter used as a fast gate before slower storage lookup.', caption: 'A Bloom filter is useful when a cheap negative can avoid an expensive storage access. (Source: Wikimedia Commons)'},
        'CDN providers like Akamai use Bloom filters to avoid caching one-hit wonders. A web object must appear to have been requested before (pass the filter) to earn a slot in the cache. This prevents the cache from filling with objects fetched once and never requested again.',
        'Bitcoin SPV (simplified payment verification) nodes send a Bloom filter of their wallet addresses to full nodes. The full node streams back only transactions whose addresses match the filter, reducing bandwidth from the entire blockchain to a small filtered subset.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'No deletion. The standard filter is append-only. If elements expire, get revoked, or need removal, the entire filter must be rebuilt from the remaining set. Counting Bloom filters fix this at 4x memory cost. Cuckoo filters support deletion with better space efficiency at false-positive rates below about 3%.',
        'No enumeration and no exact counting. You cannot list what was inserted because the keys are gone. You can estimate the number of inserted elements from the fraction of set bits, but the estimate is approximate.',
        'The false-positive rate degrades with overfilling. The formula (1 - e^(-kn/m))^k assumes the population stays at or below the planned n. If the real population far exceeds n, the rate climbs steeply. A k = 7 filter designed for 1% error at planned capacity jumps to roughly 12% false positives at 75% bit saturation, and approaches 100% as the array fills completely.',
        'Cache locality suffers at scale. When m is tens of millions of bits, each of the k hash probes may land in a different cache line, causing k cache misses per query. Blocked Bloom filters address this by partitioning the array into cache-line-sized sub-filters, trading a small accuracy penalty for much better memory access patterns.',
        'Adversarial inputs can exploit known hash functions. An attacker who knows which hash functions the filter uses can craft keys that all map to the same bit positions, selectively inflating the false-positive rate for targeted queries. Keyed (seeded) hash functions mitigate this by making the mapping unpredictable to outsiders.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Setup: m = 10 bits (all zeros), k = 3 hash functions. Define: h1(x) = (x * 7 + 3) mod 10, h2(x) = (x * 11 + 5) mod 10, h3(x) = (x * 13 + 1) mod 10. To hash a string, sum its ASCII character codes and feed the sum into each function. "cat": c=99 + a=97 + t=116 = 312. "dog": d=100 + o=111 + g=103 = 314.',
        'Insert "cat" (sum = 312). h1 = (312*7 + 3) mod 10 = 2187 mod 10 = 7. h2 = (312*11 + 5) mod 10 = 3437 mod 10 = 7. h3 = (312*13 + 1) mod 10 = 4057 mod 10 = 7. All three hashes collide on bit 7. Set bit 7. Array: [0,0,0,0,0,0,0,1,0,0]. One bit is on.',
        'Insert "dog" (sum = 314). h1 = (314*7 + 3) mod 10 = 2201 mod 10 = 1. h2 = (314*11 + 5) mod 10 = 3459 mod 10 = 9. h3 = (314*13 + 1) mod 10 = 4083 mod 10 = 3. Set bits 1, 3, and 9. Array: [0,1,0,1,0,0,0,1,0,1]. Four bits on out of 10 (40% fill ratio).',
        'Query "cat": recompute the same hashes -- all three point to bit 7. Bit 7 is 1. Answer: probably present. This is correct; "cat" was inserted.',
        'Query "bird": b=98 + i=105 + r=114 + d=100 = 417. h1 = (417*7 + 3) mod 10 = 2922 mod 10 = 2. h2 = (417*11 + 5) mod 10 = 4592 mod 10 = 2. h3 = (417*13 + 1) mod 10 = 5422 mod 10 = 2. All three land on bit 2. Bit 2 is 0. Answer: definitely not present. One zero bit is mathematical proof -- inserting "bird" would have set bit 2, and it was never set.',
        'Query "fish": f=102 + i=105 + s=115 + h=104 = 426. h1 = (426*7 + 3) mod 10 = 2985 mod 10 = 5. h2 = (426*11 + 5) mod 10 = 4691 mod 10 = 1. h3 = (426*13 + 1) mod 10 = 5539 mod 10 = 9. Check bits 5, 1, and 9. Bit 5 is 0 (never touched by any insertion). Answer: definitely not present, even though bits 1 and 9 were set by "dog." One zero suffices.',
        'Now imagine a third key had been inserted that happened to set bit 5. If "fish" were queried with bits 1, 5, and 9 all at 1, the filter would answer "probably present" -- a false positive. "fish" was never inserted, but its three bit positions were coincidentally covered by other keys\' footprints. This is the fundamental tradeoff: the filter stored no actual strings, at the cost of occasional phantom matches whose rate is controlled by sizing m and k correctly.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Bloom, "Space/Time Trade-offs in Hash Coding with Allowable Errors," Communications of the ACM, 1970 -- the original paper. Kirsch and Mitzenmacher, "Less Hashing, Same Performance: Building a Better Bloom Filter," 2004 -- proves two hashes suffice for k. Fan, Andersen, Kaminsky, and Mitzenmacher, "Cuckoo Filter: Practically Better Than Bloom," CoNEXT, 2014 -- the modern alternative with deletion support.',
        'Prerequisite: Hash Table, the exact-membership structure that Bloom filters compress by discarding keys. Extensions to study: Counting Bloom Filter (deletion via small counters at 4x memory), Cuckoo Filter (deletion plus better cache locality at low false-positive rates). Related probabilistic sketches: HyperLogLog (approximate distinct counting), Count-Min Sketch (approximate frequency estimation). For production context, see the LSM Trees, RocksDB, and SSTable topics where Bloom filters appear at the storage-engine level.',
      ],
    },
  ],
};

