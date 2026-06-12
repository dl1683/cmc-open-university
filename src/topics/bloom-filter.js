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
