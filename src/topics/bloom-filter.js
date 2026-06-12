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
      heading: `What it is`,
      paragraphs: [
        `A bloom filter is a tiny probabilistic set. It can say "definitely not present" with certainty, or "maybe present" with a tunable false-positive rate. It never stores the original items. Instead, it stores a bit pattern created by several hash functions. That trade is powerful when a full Hash Table would be too large or too expensive to check first.`,
        `The asymmetry is the point. False negatives are impossible: if the filter says no, the item was not inserted. False positives are possible: if it says yes, different inserted items may have set the same bits by coincidence. A well-sized filter can remember one million items with about ten million bits, roughly 1.25 MB, and a false-positive rate around 0.8% when using about seven hash positions per item.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with an array of m bits, all 0. To insert an item, compute k hash values and map each one to a bit index. Set those k bits to 1. To query the same item later, compute the same k indexes. If any checked bit is 0, the item cannot have been inserted, because insertion would have set every one of its bits. If all checked bits are 1, the item may have been inserted.`,
        `The false-positive probability is approximately (1 - e^(-kn/m))^k, where n is inserted items, m is bits, and k is hash functions. For a fixed m and n, too few hash functions leave weak fingerprints; too many hash functions fill the array too quickly. The optimal k is about (m / n) * ln 2. Systems often derive k positions from two fast hashes rather than computing many unrelated hashes from scratch.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Insert and query are O(k), which is treated as O(1) when k is a small configured constant. Space is O(m), chosen from the expected item count and target error rate. Big-O Growth Rates does not tell the whole story here because constants are the selling point: ten bits per item can be dramatically smaller than storing full strings, object headers, and pointers. A standard filter cannot delete safely, because clearing one bit might erase evidence for many other items. Counting variants store small counters instead of bits so they can decrement, at a higher memory cost.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `LSM Trees (How Cassandra Writes) use bloom filters to avoid wasted disk reads. If a key is definitely absent from an immutable sorted file, the database skips that file entirely. RocksDB, LevelDB, and Cassandra all rely on this idea because random disk or SSD reads are far more expensive than a few hash checks. Cache Invalidation & Versioning systems can use filters to avoid asking a remote cache about objects that are definitely absent.`,
        `Security and networking systems use the same negative-test pattern. Browser safe-browsing systems have historically used compact hashed-prefix structures and related probabilistic techniques to avoid shipping complete blocklists to every client. Older Bitcoin lightweight clients used BIP37 bloom filters to ask peers for relevant transactions without downloading the full chain, though privacy weaknesses made that approach controversial. Deduplication systems, crawlers, spell-check prefilters, and Rate Limiter (Token Bucket) support structures all use approximate membership when memory matters.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The dangerous mistake is treating "maybe present" as proof. A positive answer must usually be followed by a real lookup in a database, set, or Hash Table. The filter saves work by eliminating definite misses; it does not replace the source of truth. Another mistake is overfilling it. Once more items are inserted than planned, too many bits become 1 and the false-positive rate can rise sharply.`,
        `Deletion is another trap. A normal bit array is append-only for practical purposes. If your workload needs removals, use a counting filter or rebuild periodically. Also remember that hash quality matters: correlated hash positions create more collisions than the formula assumes. Merkle Tree and Consistent Hashing use hashes for different guarantees, so do not treat every hash-based structure as interchangeable.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Hash Table first, because this structure borrows hashing but discards exact storage. Then read LSM Trees (How Cassandra Writes) for the database use case, Cache Invalidation & Versioning for systems freshness problems, and Big-O Growth Rates to separate asymptotic cost from constant-factor memory wins. Merkle Tree and Consistent Hashing show other ways hashes organize large systems.`,
      ],
    },
  ],
};
