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
        'The row of cells is the bit array -- one bit per cell, numbered left to right. Every cell starts at 0. When a bit flips to 1, the cell fills in.',
        'During insertion, highlighted cells show the three hash outputs for that key: the bit positions it maps to. After the bits are set, they turn green to mark the footprint. During a query, the same three positions are highlighted and checked.',
        'Watch for overlap. When two keys share a bit position, the second insertion finds that bit already at 1. The filter cannot tell which key set it. When a query finds all three bits set by other keys\' combined footprints, you are watching a false positive happen.',
        'The safe inference: if any of the three queried bits is 0, the key was never inserted. Insertion would have set all three. One zero is proof of absence.',
        {type: 'callout', text: 'A Bloom filter saves memory by storing only hash footprints, making every zero bit a proof of absence and every all-one query only a maybe.'},
      
        {type: 'image', src: './assets/gifs/bloom-filter.gif', alt: 'Animated walkthrough of the bloom filter visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Burton Howard Bloom posed the question in 1970: how much memory can you save on set-membership queries if you accept a small chance of saying "yes" when the true answer is "no"? His answer -- published as "Space/Time Trade-offs in Hash Coding with Allowable Errors" -- was a structure that never stores the elements at all, only the side effects of hashing them.',
        'The savings are large. Storing 1 billion URLs in a hash set costs roughly 50 GB. A Bloom filter answering "is this URL in the set?" at a 1% false-positive rate uses about 1.2 GB -- 40x less. It never sees the URLs after hashing.',
        'The use case is a cheap negative gate. Many systems ask "is this key here?" millions of times per second, and the answer is usually no. When the filter says no, the system skips the expensive disk read or network call entirely. When it says maybe, the system pays the full lookup cost. One fast check eliminates most of the real work.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A hash set solves membership exactly. Hash each element, store it in a table, look it up in O(1). You get insertion, deletion, enumeration, and zero uncertainty -- every positive is true, every negative is true.',
        'For small to moderate sets that fit in memory, hash sets are the right tool. Nothing about them is wrong until the set gets large and the only question you need answered is yes or no.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Hash sets store the actual keys. A hundred million email addresses cost gigabytes -- every string lives in full, plus bucket pointers, object headers, and load-factor slack. Doubling the set doubles the memory. The system pays full storage cost to answer a question that is usually "not a member."',
        'A single-bit-per-key trick sounds appealing: hash each key to one position in a bit array. But with 100 million keys in a billion-bit array, roughly 10% of bits are set, and any query landing on a set bit is a false positive. One hash function cannot spread information thinly enough -- the false-positive rate equals the fill ratio.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Bloom filter is an m-bit array (all zeros initially) and k independent hash functions. To insert a key, hash it k times to get k bit positions in [0, m-1] and set all k bits to 1. To query, hash the key the same k ways and check the same k positions. If any position is 0, the key was definitely not inserted. If all k are 1, it is probably present. There are no deletions -- bits are never cleared.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Bloom_filter.svg/500px-Bloom_filter.svg.png', alt: 'Bloom filter bit array with hash arrows for inserted keys and a query key.', caption: 'Inserted keys set multiple bits, while a missing zero bit proves absence for a query. (Source: Wikimedia Commons)'},
        'The false-positive probability after inserting n elements is approximately (1 - e^(-kn/m))^k. The optimal number of hash functions is k = (m/n) * ln(2). At the optimum, the formula simplifies: for a target false-positive rate p, you need m = -n * ln(p) / (ln(2))^2 bits. At p = 1%, that works out to about 9.6 bits per element regardless of element size, with k = 7.',
        'Real implementations avoid computing k independent hashes. Kirsch and Mitzenmacher (2004) showed that h_i(x) = h1(x) + i * h2(x) mod m, using just two base hashes, preserves the theoretical guarantees. Insert and query both cost O(k), and since k is a small constant (typically 3 to 13), both are effectively O(1).',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The no-false-negatives guarantee rests on one invariant: bits are only set, never cleared. If key x was inserted, all k of its bit positions were set at insertion time. No later operation undoes this. Querying x always finds all k bits at 1.',
        'False positives come from bit collisions. As n items are inserted, each setting k bits, the fraction of 1-bits grows. A key y that was never inserted still hashes to k positions. Each position has some probability of being 1 due to other keys. When all k happen to be 1 by coincidence, the filter cannot distinguish y from a true member. The probability of this accident is (1 - e^(-kn/m))^k -- it rises as the array fills and falls as you add more bits or tune k.',
        'The guarantee breaks the moment a bit is cleared. If bit j belongs to keys A, B, and C, clearing it because A is deleted creates false negatives for B and C. This is why standard Bloom filters do not support deletion.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert: O(k). Query: O(k). Since k is a small constant, both are O(1) in practice. Each operation computes k hashes and touches k bit positions. No resizing, no chaining, no probing.',
        'Space: m bits total, independent of key size. Keys are discarded after hashing. At 1% false-positive rate: ~9.6 bits per element, k = 7. At 0.1%: ~14.4 bits per element, k = 10. Halving the false-positive rate costs about 1.44 extra bits per element. A filter for 1 billion items at 1% error is about 1.2 GB.',
        'No deletion, no enumeration, no counting. The filter is write-once per bit. Counting Bloom filters replace each bit with a 4-bit counter to support deletion, at 4x memory cost.',
        'The hidden cost is capacity planning. A Bloom filter must be sized for an expected population n. If the real population far exceeds n, the array saturates -- most bits go to 1 and the false-positive rate climbs toward 100%. An over-full filter is just an expensive array of ones.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Chrome Safe Browsing shipped a Bloom filter of malicious URLs to every browser. Each URL was checked locally before navigation. A negative meant safe with certainty; a positive triggered server-side verification. Most checks stayed local, and no malicious URL was missed.',
        'LSM-tree storage engines (LevelDB, RocksDB, Cassandra) attach a Bloom filter to each SSTable. A point lookup might otherwise probe dozens of sorted files across multiple levels. The filter turns most of those disk reads into a few hash computations -- if the filter says "definitely not here," the file is skipped.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Bloom_filter_speed.svg/500px-Bloom_filter_speed.svg.png', alt: 'Bloom filter used as a fast gate before slower storage lookup.', caption: 'A Bloom filter is useful when a cheap negative can avoid an expensive storage access. (Source: Wikimedia Commons)'},
        'Akamai and other CDNs use Bloom filters to avoid caching one-hit wonders. An object must appear to have been requested before (pass the filter) to earn a cache slot. This keeps the cache from filling with objects requested once and never again.',
        'Bitcoin SPV nodes send a Bloom filter of their addresses to full nodes. The full node streams back only transactions matching the filter, reducing bandwidth from the full blockchain to a small filtered subset.',
        'Spell checkers store dictionaries as Bloom filters. A word failing the filter is definitely misspelled. A word passing might still be wrong (false positive), but at low enough rates most passes are real words, and the dictionary fits in far less memory than the word list.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'No deletion. The standard filter is append-only. If elements expire or get revoked, the filter must be rebuilt from scratch. Counting Bloom filters fix this at 4x memory. Cuckoo filters support deletion with better space efficiency at false-positive rates below about 3%.',
        'No enumeration. You cannot list what was inserted -- the keys are gone. You cannot count elements exactly, only estimate from the fill ratio.',
        'False-positive rate grows with load. The formula (1 - e^(-kn/m))^k assumes uniform hashing. If the actual population exceeds the planned n, the rate climbs fast. A k = 7 filter at 50% fill has about 0.8% false positives; at 75% fill, roughly 12%.',
        'Poor cache locality at scale. When m is millions of bits, each of k hash probes may land in a different cache line. Blocked Bloom filters (cache-line-sized sub-filters) address this at a small accuracy cost. Cuckoo filters probe only two buckets, giving better locality.',
        'Adversarial inputs. If an attacker knows the hash functions, they can craft keys mapping to the same bits, inflating the false-positive rate for targeted queries. Seeded hash functions mitigate this.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Setup: m = 10 bits (all zeros), k = 3 hash functions. To hash a string, sum the character codes and apply three functions: h1(x) = (x * 7 + 3) mod 10, h2(x) = (x * 11 + 5) mod 10, h3(x) = (x * 13 + 1) mod 10. For "cat": c + a + t = 99 + 97 + 116 = 312. For "dog": d + o + g = 100 + 111 + 103 = 314.',
        'Insert "cat" (sum 312): h1 = (2184 + 3) mod 10 = 7, h2 = (3432 + 5) mod 10 = 7, h3 = (4056 + 1) mod 10 = 7. All three hashes land on bit 7. Set bit 7. Array: [0,0,0,0,0,0,0,1,0,0]. One bit on.',
        'Insert "dog" (sum 314): h1 = (2198 + 3) mod 10 = 1, h2 = (3454 + 5) mod 10 = 9, h3 = (4082 + 1) mod 10 = 3. Set bits 1, 3, 9. Array: [0,1,0,1,0,0,0,1,0,1]. Four bits on out of 10 (40% fill).',
        'Query "cat": same hash as insertion -- all three land on bit 7. Bit 7 is 1. Answer: probably present. Correct.',
        'Query "bird": b + i + r + d = 98 + 105 + 114 + 100 = 417. h1 = (2919 + 3) mod 10 = 2, h2 = (4587 + 5) mod 10 = 2, h3 = (5421 + 1) mod 10 = 2. Check bit 2 -- it is 0. Answer: definitely not present. One zero bit proves absence.',
        'Query "fish": f + i + s + h = 102 + 105 + 115 + 104 = 426. h1 = (2982 + 3) mod 10 = 5, h2 = (4686 + 5) mod 10 = 1, h3 = (5538 + 1) mod 10 = 9. Check bits 1, 5, 9. Bit 5 is 0. Answer: definitely not present. Even though bits 1 and 9 were set by "dog," bit 5 was never touched. One miss is enough.',
        'Now suppose we also inserted a key that set bit 5. If "fish" were queried again with bits 1, 5, and 9 all at 1, the filter would answer "probably present" -- a false positive. "fish" was never inserted, but its three bit positions were all covered by other keys\' footprints. This is the tradeoff: the filter saved storing any actual strings, at the cost of occasional phantom matches.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Bloom, "Space/Time Trade-offs in Hash Coding with Allowable Errors," Communications of the ACM, 1970. Kirsch and Mitzenmacher, "Less Hashing, Same Performance: Building a Better Bloom Filter," 2004. Fan et al., "Cuckoo Filter: Practically Better Than Bloom," CoNEXT, 2014.',
        'Prerequisite: Hash Table -- the exact-membership alternative that Bloom filters compress by discarding keys. Extensions: Counting Bloom Filter (deletion via small counters, 4x memory), Cuckoo Filter (deletion, better cache locality, lower space below 3% false-positive rate). Related sketches: HyperLogLog (approximate cardinality), Count-Min Sketch (approximate frequency counting). Production context: LSM Trees, RocksDB, and SSTable topics show Bloom filters at the storage-engine level.',
      ],
    },
  ],
};

