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
      heading: 'What it is',
      paragraphs: [
        `A bloom filter is a probabilistic data structure — a bit array that tells you, with absolute certainty, that something is NOT in a set, but only with high probability that it IS in the set. You never store the actual items; instead, you run each item through k hash functions (usually 3 to 5), and those hashes tell you which bits to flip on. Later, when you query for an item, you check if all k bits are set. If any bit is 0, the item is definitely not there. If all k bits are 1, the item is probably there — but there is a small chance it is a false positive (other items' bits happened to overlap).`,
        `The trade is extraordinary: a bloom filter uses about 10 bits per item instead of storing the entire item. A hash table storing 1 million strings might use 100 megabytes; a bloom filter remembering 1 million items uses about 1.25 megabytes. The cost: occasional false positives, and you cannot delete items (they would corrupt the bits for other items).`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `To insert an item, run it through all k hash functions. Each hash returns a bit index. Set all k bits to 1. That is it — the item is "remembered" as a pattern of bits, never stored itself.`,
        `To query, run the item through all k hash functions again and check if all k bits are set to 1. If even one bit is 0, the item was definitely never inserted (no insert operation would leave a bit at 0 without setting it). If all bits are 1, the item might be there — or you have a collision, where other items' hash functions happened to cover the same bits. The false-positive rate depends on the filter size, the number of items inserted, and k (the number of hash functions). A well-tuned filter with a million items in a 10-million-bit array has a false-positive rate around 1%.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Insert and query are both O(k) — you run k hash functions, each in O(1). In practice, k is small (usually 3–7), so this is O(1) with a tiny constant. Space is O(m) where m is the bit-array size; a well-chosen m (relative to the number of items n) gives a false-positive rate of roughly (0.5)^k. Deletion is not straightforward (marking bits as deleted corrupts the filter), so bloom filters are used only for immutable or append-only sets.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Bloom filters are ubiquitous in systems where speed and memory matter. Google Chrome uses bloom filters to check URLs against malware blocklists — fast, local, and you do not need to download the entire database. Cassandra (a distributed database) uses bloom filters to skip reads from disk for keys that are definitely not in a partition. RocksDB and LevelDB (embedded databases) use them the same way. Content delivery networks use bloom filters to decide what content is worth caching — if a URL is definitely not in the cache, do not even start the lookup. Bitcoin uses Bloom Filters for lightweight clients that cannot store the entire blockchain. They appear in spell-checkers (is this word definitely not in the dictionary?), spam filters (is this definitely not spam?), and deduplication systems.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The biggest pitfall is forgetting that a false positive is possible. A "yes" answer is never certain — you have to validate it with a proper lookup. The "no" answer is always correct, which is the whole point: use the bloom filter to eliminate 99% of false lookups without expensive work, then do the expensive lookup only for the remaining 1%.`,
        `Another pitfall: you cannot delete from a bloom filter. Setting a bit to 0 would corrupt the footprints of other items. If you need deletion, use a variant called a "counting bloom filter" (which stores counts instead of bits, allowing decrements), at the cost of more space. A third misconception: bloom filters need to be huge. A well-tuned filter is actually quite small — millions of bits fit in kilobytes. The key is matching the array size to the expected number of insertions; if you insert more items than you planned, the false-positive rate climbs, which is why production systems monitor that metric.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Read Hash Table to understand hash functions — bloom filters are hash tables with the keys removed. Learn Big-O Growth Rates to see why O(1) lookups matter even when the constant is small. Then explore Set (a related data structure that is similar but allows deletion and no false positives). Finally, study probabilistic data structures and sketches — Count-Min Sketch and HyperLogLog are cousins of bloom filters, trading accuracy for space in different ways, and appear in streaming algorithms and database approximation.`,
      ],
    },
  ],
};

