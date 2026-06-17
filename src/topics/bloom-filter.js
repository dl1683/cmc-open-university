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
      heading: `Why this exists`,
      paragraphs: [
        `A Bloom filter exists for the cases where exact membership is too expensive and a one-sided answer is good enough. Many systems repeatedly ask the same question: "Can this key possibly be here?" If the answer is no, the system can skip a disk read, network call, database probe, cache lookup, duplicate crawl, or security-list check. If the answer is maybe, the system can pay the real cost and verify against the source of truth.`,
        `The data structure is a probabilistic set with asymmetric correctness. It can say "definitely not present" with certainty, assuming the filter was built correctly and no unsupported deletion occurred. It can only say "probably present" on positives because unrelated keys may have set the same bits. That is exactly what many systems need: a cheap negative gate before an expensive exact lookup.`,
        `The reason it matters is memory. A hash table stores keys or references, plus table overhead, load-factor slack, object headers, and allocation metadata. A Bloom filter stores only a bit array and a small fixed set of hash functions. For a planned item count and false-positive target, it can use around ten bits per item for roughly a one percent false-positive rate. It gives up exact positives to save space.`,
      ],
    },
    {
      heading: `The naive approach`,
      paragraphs: [
        `The naive answer is to keep an exact set. Put every key in a hash table, and membership becomes straightforward: hash the key, find the bucket, compare exact keys, and answer true or false. That is the right design when the set is small, when positive answers must be authoritative, or when deletions and iteration are required. It is the wrong first gate when the set is huge and most queries are misses.`,
        `Imagine an LSM database with dozens of immutable files on disk. A read for an absent key could probe many files before proving the key is nowhere. An exact in-memory set for every file would duplicate all keys and may cost more RAM than the database can spare. A sorted index can narrow the search, but the system still wants a very cheap "not in this file" test. The Bloom filter answers that test without storing the keys themselves.`,
        `Another naive answer is to hash each key to one bit. Insert sets that bit; query checks it. This saves space, but false positives explode because one bit carries too little information. Many unrelated keys collide on the same position. A Bloom filter improves that one-bit sketch by giving each key several independent bit positions. The footprint is still compact, but a query must match all positions, which makes accidental matches much less common.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `The core insight is to store evidence of insertion, not the inserted items. Start with an array of m zero bits. Choose k hash functions. To insert an item, hash it k ways and set the corresponding k bit positions to one. To query an item, hash it the same k ways and inspect those same positions. If any position is still zero, the item was definitely not inserted, because insertion would have set every one of its positions.`,
        `The positive case is different. If all k positions are one, the item might have been inserted, but the filter cannot prove that this particular item caused those bits. Other inserted items may have covered the same positions by coincidence. That is the entire contract: zeros are proof of absence; ones are only evidence of possible presence.`,
        `This is why a Bloom filter is usually not the final data store. It is a front door. It prevents expensive work on definite misses, then delegates possible hits to a real table, file, database, remote service, or verification step. When people misuse Bloom filters, they usually forget this division and treat a positive answer as fact.`,
      ],
    },
    {
      heading: `How the algorithm works`,
      paragraphs: [
        `Construction begins by choosing the expected item count n and a desired false-positive probability p. Those two choices determine the bit-array size m and the number of hashes k. The common approximation for false positives after n inserts is (1 - e^(-kn/m))^k. For fixed m and n, the best k is about (m / n) * ln 2. Too few hashes make weak fingerprints. Too many hashes set too many bits and fill the array faster than necessary.`,
        `Insertion is simple. Compute k indexes in the range 0 to m - 1. Set each bit to one. If two hashes point to the same bit, the item simply sets fewer distinct bits; real implementations usually size the filter and choose hash derivation to make that uncommon. Query repeats the same k index calculation and checks the bit array. The operations are O(k), and k is a configured small constant, so systems often treat insert and query as constant time.`,
        `Real implementations often derive k positions from two strong base hashes instead of computing k unrelated hashes. A standard Bloom filter still cannot safely delete: clearing a bit would remove evidence for every item that also uses that bit. Counting Bloom filters store small counters instead of bits so they can decrement, at a higher memory cost. Other variants such as scalable Bloom filters, blocked Bloom filters, Cuckoo filters, and XOR filters adjust the same trade space.`,
      ],
    },
    {
      heading: `What the visual is proving`,
      paragraphs: [
        `The visual is proving the one-sided guarantee. During insertion, each key turns on a small footprint of bits. During query, the same footprint is checked. A zero bit is decisive because no earlier insertion of that queried key could have left the bit at zero. This is the proof of the "definitely not present" answer.`,
        `The visual is also proving why positive answers are weaker. As more keys are inserted, footprints overlap. Eventually a key that was never inserted may find all of its positions already set by other keys. Nothing in the bit array records ownership, so the filter cannot distinguish a true hit from a collision-shaped false hit. The word "probably" is not a hedge; it is the data structure contract.`,
        `The final lesson is saturation. Early in the filter lifetime, many bits are zero and most absent keys are rejected quickly. As the array fills, fewer queries encounter a zero bit, and the false-positive rate rises. A Bloom filter is sized for an expected population. If the system keeps inserting far beyond that population, the filter turns into a mostly-one bit array that says maybe too often to be useful.`,
      ],
    },
    {
      heading: `Costs and tradeoffs`,
      paragraphs: [
        `The main benefit is compactness. Space is O(m), independent of key size, because keys are discarded after their bits are set. This matters when keys are long strings, URLs, document IDs, row keys, or binary fingerprints. The filter can fit in CPU cache or memory where an exact set would not. That makes it useful even when it only removes a fraction of expensive probes.`,
        `The main cost is uncertainty on positives. Every false positive triggers the expensive lookup the filter was meant to avoid. The system remains correct if it verifies positives, but performance can degrade when the false-positive rate is too high. Correct sizing is therefore part of the design, not an optimization detail. You choose the bit budget from the expected population and acceptable wasted work.`,
        `The second cost is operational. A Bloom filter needs a rebuild plan when the set changes heavily, item count outgrows the estimate, or a new false-positive target is required. If the filter is persisted, version the hash functions and parameters. Insert and query must use the same encoding and layout, or the guarantee disappears.`,
      ],
    },
    {
      heading: `Real uses`,
      paragraphs: [
        `Databases use Bloom filters to avoid wasted reads. In LSM systems such as RocksDB, LevelDB, and Cassandra-style designs, immutable sorted files can each carry a filter for their keys. If the filter says a key is absent from a file, the read path skips that file. This is valuable because a few hash checks are much cheaper than touching storage. SSTable block indexes and filters use the same negative-test idea at smaller units.`,
        `Distributed systems use filters to reduce communication. A service can summarize a set before exchanging exact differences. A cache can avoid asking a lower tier for objects that are definitely absent. Crawlers and deduplication pipelines can reject URLs or fingerprints they definitely have not seen in a given shard. Security systems have used related compact membership structures to ship or query large reputation lists without moving every exact string to every client.`,
      ],
    },
    {
      heading: `Failure modes and limits`,
      paragraphs: [
        `The first failure mode is treating maybe as yes. A Bloom filter can guard an exact lookup, but it should not authorize access, prove uniqueness, confirm a malware match, or decide that a record exists unless false positives are acceptable for that decision. If a false positive would be a correctness bug, the filter must be followed by exact verification.`,
        `The second failure mode is overfilling. The false-positive formula assumes a planned n. If the real population is much larger, the bit array fills and the filter stops filtering. Monitoring should include inserted count, estimated fill ratio, observed false-positive rate, and rebuild triggers. A filter with no population discipline is just hidden technical debt.`,
        `The third failure mode is bad hashing. Correlated positions, biased hashes, inconsistent encodings, or different hash versions across producers and consumers can create false positives far above the design target. Worse, if insert and query disagree about canonicalization, the same logical item may hash differently and produce a false negative. The filter can only keep its guarantee when the input bytes and hash parameters are stable.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Hash Table first because Bloom filters borrow hashing while discarding exact key storage. Then study Counting Bloom Filter, Learned Bloom Filter, XOR Filter, SSTable Block Index & Filter Case Study, LSM Trees (How Cassandra Writes), RocksDB LSM Case Study, LSM Compaction Strategies Primer, Runtime Bloom Filter Join Pruning, Cache Invalidation & Versioning, Big-O Growth Rates, Merkle Tree, and Consistent Hashing. Those topics show when approximate membership, exact membership, authenticated membership, and distributed placement are different tools rather than interchangeable uses of hashes.`,
      ],
    },
  ],
};
