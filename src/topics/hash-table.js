// Hash table with linear probing: hash the key to a bucket index,
// walk forward on collisions, and rehash into a bigger table as it fills.

import { hashTableState, parseNumberList, parseNumber } from '../core/state.js';

export const topic = {
  id: 'hash-table',
  title: 'Hash Table',
  category: 'Data Structures',
  summary: 'Keys hash to bucket indexes; collisions probe forward; growth rehashes everything.',
  controls: [
    { id: 'keys', label: 'Insert keys', type: 'number-list', defaultValue: '23, 7, 15, 31, 39, 12' },
    { id: 'lookup', label: 'Then look up', type: 'number', defaultValue: '31' },
  ],
  run,
};

// Modulo that is always 0 <= index < capacity, even for negative keys.
// (The 2017 version of this site returned (key % max) + 1 — an off-by-one
// that wrote past the bucket range. Tests now pin this function down.)
export function hashIndex(key, capacity) {
  return ((key % capacity) + capacity) % capacity;
}

const LOAD_LIMIT = 0.7;

export function* run(input) {
  const keys = parseNumberList(input.keys, { min: 1, max: 8, label: 'keys' });
  const lookup = parseNumber(input.lookup, { label: 'a key to look up' });

  let capacity = 8;
  let buckets = new Array(capacity).fill(null);
  let size = 0;
  const meta = () => ({ size, capacity });

  yield {
    state: hashTableState(buckets, meta()),
    highlight: {},
    explanation: `An empty table with ${capacity} buckets. A hash function turns a key into a home bucket, so lookup starts near the answer instead of scanning every entry.`,
  };

  for (const key of keys) {
    let index = hashIndex(key, capacity);
    yield {
      state: hashTableState(buckets, meta()),
      highlight: { active: [`b${index}`] },
      explanation: `insert(${key}): hash the key, then reduce it to a bucket index. ${key} mod ${capacity} = ${index}, so bucket ${index} is the first place to try.`,
    };

    let alreadyPresent = false;
    while (buckets[index] !== null) {
      if (buckets[index].key === key) {
        alreadyPresent = true;
        yield {
          state: hashTableState(buckets, meta()),
          highlight: { found: [`b${index}`] },
          explanation: `Bucket ${index} already holds ${key}. The probe sequence found the existing key, so insertion becomes an update/no-op instead of a duplicate.`,
        };
        break;
      }
      const next = (index + 1) % capacity;
      yield {
        state: hashTableState(buckets, meta()),
        highlight: { collision: [`b${index}`], active: [`b${next}`] },
        explanation: `Collision: bucket ${index} holds ${buckets[index].key}. Linear probing preserves findability by trying the next bucket (${next}) on the same path lookup will later follow.`,
        invariant: 'A key is always findable by walking forward from its hash index until it appears or an empty bucket proves it absent.',
      };
      index = next;
    }
    if (alreadyPresent) continue;

    buckets[index] = { key };
    size += 1;
    yield {
      state: hashTableState(buckets, meta()),
      highlight: { found: [`b${index}`] },
      explanation: `${key} lands in bucket ${index}. The load factor is now ${size}/${capacity} = ${(size / capacity).toFixed(2)}; as it rises, collisions become more likely.`,
    };

    if (size / capacity >= LOAD_LIMIT) {
      const oldCapacity = capacity;
      capacity *= 2;
      const old = buckets;
      buckets = new Array(capacity).fill(null);
      for (const entry of old) {
        if (entry === null) continue;
        let slot = hashIndex(entry.key, capacity);
        while (buckets[slot] !== null) slot = (slot + 1) % capacity;
        buckets[slot] = entry;
      }
      yield {
        state: hashTableState(buckets, meta()),
        highlight: {},
        explanation: `Load factor hit ${LOAD_LIMIT}, so probes were getting long. The table doubled from ${oldCapacity} to ${capacity} buckets and rehashed every key because bucket indexes depend on capacity.`,
      };
    }
  }

  // lookup
  let index = hashIndex(lookup, capacity);
  yield {
    state: hashTableState(buckets, meta()),
    highlight: { active: [`b${index}`] },
    explanation: `lookup(${lookup}): hash it to bucket ${index}. If the key was inserted, it must be at this bucket or later on the same probe path.`,
  };

  let probes = 1;
  while (buckets[index] !== null && buckets[index].key !== lookup) {
    const next = (index + 1) % capacity;
    yield {
      state: hashTableState(buckets, meta()),
      highlight: { collision: [`b${index}`], active: [`b${next}`] },
      explanation: `Bucket ${index} holds ${buckets[index].key}, not ${lookup}. A collision may have displaced the target, so lookup follows the same forward probe path to ${next}.`,
    };
    index = next;
    probes += 1;
  }

  if (buckets[index] !== null) {
    yield {
      state: hashTableState(buckets, meta()),
      highlight: { found: [`b${index}`] },
      explanation: `Found ${lookup} in bucket ${index} after ${probes} probe${probes === 1 ? '' : 's'}. The table avoided a full scan because the hash chose where the search should begin.`,
    };
  } else {
    yield {
      state: hashTableState(buckets, meta()),
      highlight: { visited: [`b${index}`] },
      explanation: `Bucket ${index} is empty, which proves ${lookup} is absent. If the key had been inserted, the same probe path would have found it before the first empty bucket.`,
    };
  }
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The flat row of boxes is the bucket array. Each slot holds at most one key. When a key is inserted, the hash function picks a home slot (highlighted as active). If that slot is occupied, the probe walks right one slot at a time -- the collision marker shows which occupied slot forced the step, and the active marker shows where the probe moved next.',
        {type: 'callout', text: 'Open addressing is correct because insertion and lookup walk the same deterministic probe path until a key or an empty proof slot appears.'},
        'Watch for clusters: contiguous runs of filled slots. Every new key that hashes into a cluster must walk to the far end before finding an empty slot. The longer the cluster, the longer the probe. That feedback loop -- occupied slots attracting more collisions -- is primary clustering, and it is the central cost story of linear probing.',
        'A found marker means the key was placed or located. An empty slot during lookup proves the key absent: if it had been inserted, it would occupy that slot or an earlier one on the same probe path. When a resize frame fires, every key disappears and reappears because bucket indexes are key mod capacity, and doubling the capacity changes those indexes.',
        'After each insertion the load factor (entries / capacity) is displayed. Watch it climb toward 0.7. As the ratio rises, clusters merge, probes lengthen, and the table eventually doubles to break the clusters apart.',
      
        {type: 'image', src: './assets/gifs/hash-table.gif', alt: 'Animated walkthrough of the hash table visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Hash tables solve exact lookup: given a key, find its record without scanning every entry. A hash function converts any key to a bucket index, giving O(1) average insert, lookup, and delete. The question is what to do when two keys hash to the same bucket. That is the collision problem, and the two classic answers are chaining (linked lists per bucket) and open addressing (find another slot in the same array).',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Hash_table_5_0_1_1_1_1_1_LL.svg', alt: 'Hash table with chaining showing keys mapped to buckets', caption: 'The classic table diagram shows the contract: hash a key into a bucket, then handle whatever collision pattern the bucket receives. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Hash_table_5_0_1_1_1_1_1_LL.svg.'},
        'Linear probing is the simplest open-addressing scheme. On collision, try the next slot, then the next, wrapping around. Knuth analyzed it exhaustively in 1963, making it one of the first algorithms with a rigorous average-case analysis. Despite its simplicity, linear probing is the fastest hash table strategy at moderate load on modern hardware because it turns collisions into sequential memory scans -- exactly what CPU caches are built to accelerate.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Separate chaining: each bucket points to a linked list. Colliding keys append to the list. Lookup hashes the key, then walks the chain. Expected chain length equals the load factor alpha = n/m, so at alpha = 1 the average lookup touches about two nodes. The scheme is simple, tolerates load factors above 1, and deletion is just unlinking a node.',
        'Chaining works. Most textbooks teach it first, Java HashMap uses it (with a tree fallback), and it handles high load gracefully. For many workloads, chaining is good enough.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Chaining has poor cache locality. Each chain node is a separate heap allocation, potentially on a different cache line. Walking a 5-node chain can trigger 5 L1 cache misses, each costing 4-10 ns on a modern CPU -- or 100+ ns if the data falls out of L2. At alpha = 1, the average successful lookup touches two nodes on two cache lines. The theoretical O(1) hides a large constant dominated by pointer chasing.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg', alt: 'Linked list nodes connected by pointers', caption: 'Separate chaining resolves collisions with linked nodes, but every pointer hop risks a cache miss compared with a flat probe through adjacent slots. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Linked_list.svg.'},
        'The pointer overhead also wastes memory. Each node carries a next pointer (8 bytes on 64-bit systems) plus allocator metadata. For small keys, the overhead can exceed the data. A table with a million 4-byte integer keys spends more memory on pointers and allocator headers than on the keys themselves.',
        'Open addressing eliminates both costs. All entries live in one contiguous array. Probing walks adjacent memory, which the hardware prefetcher loads into cache automatically. No pointers, no per-node allocations, no cache-line lottery.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The collision problem becomes a probe path problem: if insert and lookup follow the same deterministic path, then a key is findable exactly when it occupies the first empty slot on its path. The physical insight is that an empty slot is a proof -- it proves the key was never placed past that point.',
        'The cost of this scheme is not measured in comparisons but in memory hops. A cache line holds 64 bytes, enough for roughly 8 key-pointer pairs on a 64-bit system. Linear probing loads one cache line and checks 8 consecutive slots in sequence. Chaining loads one key-pointer pair per node. At alpha = 0.7, a linear probe that hits after 3 steps has loaded 1 cache line. A chain that walks 3 nodes may have loaded 3 different cache lines. The difference is the memory hierarchy, not the algorithm.',
        'Backward-shift deletion (Rust hashbrown, SwissTable) avoids tombstones by sliding displaced keys back toward their home slots after a deletion, keeping every slot either occupied or empty -- never deleted-but-probe-through. This maintains short probes even after heavy deletion churn.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Hash key k to home slot h(k) = hash(k) mod m. If slot h(k) is empty, store the entry there. If occupied, try h(k)+1, h(k)+2, and so on, wrapping around modulo m. Insert at the first empty slot found.',
        'Lookup follows the same path: start at h(k) and walk forward. If the key is found, return it. If an empty slot is reached, the key is absent -- it would have been placed at or before that empty slot during insertion.',
        'Deletion is the tricky operation. Clearing a slot leaves a gap that breaks probe chains: a later lookup might stop at the gap and miss a key that was displaced past it. Two solutions exist. Tombstone deletion marks the slot as "deleted but keep probing through me." Lookup skips tombstones; insert can reclaim them. The downside is that tombstones accumulate and lengthen probe chains even when the live load is low. Backward-shift deletion (used by Robin Hood variants and Rust hashbrown) slides displaced keys back toward their home slots after a delete, keeping the table gap-free at the cost of a small O(1/(1-alpha)) expected shift per delete.',
        'The load factor alpha = n/m governs performance. Most implementations resize when alpha crosses 0.5 to 0.75. Resizing doubles the bucket count and rehashes every key, costing O(n) at the moment it fires but only O(1) amortized per insertion -- the same doubling argument as dynamic arrays.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one invariant: insert and lookup follow the same deterministic probe path. A key is placed at the first empty slot on its path. A later lookup walks the same sequence and must either find the key or reach an empty slot that proves the key was never inserted past that point. No key can hide behind an empty slot because insertion never skips one.',
        'Knuth analyzed the expected probe count under the assumption that each key hashes independently and uniformly. For a table with load factor alpha, the expected number of probes for a successful search is approximately 1/2 * (1 + 1/(1 - alpha)). For an unsuccessful search (or insert into a non-full table), the expected probes are approximately 1/2 * (1 + 1/(1 - alpha)^2). At alpha = 0.5 those formulas give about 1.5 and 2.5 probes. At alpha = 0.75, about 2.5 and 8.5. The nonlinearity above alpha = 0.7 is why implementations resize before the table gets too full.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Expected time per operation is O(1/(1 - alpha)). At alpha = 0.5 a lookup averages 1.5 probes; at alpha = 0.75, 2.5 probes for a hit and 8.5 for a miss; at alpha = 0.9, a miss averages about 50 probes. The cost is constant for any fixed maximum load factor, but the constant degrades sharply above alpha = 0.7.',
        'Worst case is O(n): if every key hashes to the same slot, the entire table becomes one cluster and every operation scans every entry. A good hash function (or a randomized one like SipHash) makes this astronomically unlikely.',
        'Space is O(n) with a constant overhead for empty slots. At a 0.5 load factor ceiling, half the slots are always empty. At 0.75, a quarter are empty. The tradeoff is direct: more empty slots mean shorter probes but more wasted memory.',
        'Resizing is O(n) per event but O(1) amortized. Between two consecutive resizes, at least n/2 insertions occur, so the per-insert amortized rehash cost is at most 2. Doubling the input roughly doubles the table, so amortized per-operation cost stays constant.',
        'Primary clustering is the defining cost of linear probing. A cluster of length L has probability proportional to L of attracting the next insertion (any key hashing into the cluster or just before it extends the cluster). Clusters grow superlinearly, which is why the probe count formula has a squared term in the denominator for unsuccessful searches. Keeping alpha below 0.7 bounds the expected cluster length.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'CPU caches love sequential memory access. Linear probing turns collision resolution into a short forward scan through adjacent slots, which the hardware prefetcher serves from L1 cache. At moderate load (alpha <= 0.6), a probe sequence of 2-3 slots fits in a single cache line. This makes linear probing the fastest hash table strategy on modern hardware for workloads that control load.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Intel i7 processor die photograph', caption: 'Linear probing wins in practice because nearby buckets ride the memory hierarchy better than scattered heap nodes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:KL_Intel_i7_die.jpg.'},
        'Google SwissTable (absl::flat_hash_map) and Rust hashbrown both use a linear-probing variant with SIMD metadata: a parallel byte comparison filters 16 candidate slots in one instruction before checking full keys. These are the default hash maps in production C++ and Rust codebases.',
        'CPython dict uses open addressing with a perturbation-based probe sequence derived from linear probing. The perturbation mixes higher hash bits into the step, reducing clustering while keeping most of the cache-locality benefit.',
        'Embedded systems and game engines favor open addressing because it avoids per-node heap allocations. A fixed-size linear-probing table needs no allocator at all -- just a flat array sized at compile time.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Primary clustering is the fundamental weakness. A long cluster of occupied slots acts as a collision magnet: any key that hashes anywhere into the cluster (or to the slot just before it) extends it. Clusters merge, and probe chains blow up. At alpha = 0.9, expected miss cost is about 50 probes. Above alpha = 0.95, the table is nearly unusable.',
        'Tombstones from deletion accumulate and degrade performance even when the live load is low. A table that sees heavy insert-delete churn (connection pools, ephemeral sessions) fills with tombstones that lengthen probes without contributing to load. Periodic full rebuilds or backward-shift deletion mitigate this, but both add implementation complexity.',
        'Quadratic probing reduces primary clustering by spacing probes quadratically (offsets 0, 1, 3, 6, 10, ...), so two keys with the same home slot follow different tails after the first step. Double hashing uses a second hash function for the step size, eliminating primary clustering entirely at the cost of losing sequential cache access.',
        'Robin Hood hashing is a linear-probing variant that reduces probe-length variance. On insert, if the new key has traveled farther from its home slot than the key occupying the current slot, the two swap. This steals from the rich (short-probe keys) and gives to the poor (long-probe keys), bounding the maximum probe length to O(log n) with high probability.',
        'Cuckoo hashing guarantees worst-case O(1) lookup by maintaining two tables with independent hash functions. A displaced key bounces to its alternate table, potentially displacing another key in a chain. If the chain cycles, the table rehashes with new hash functions. The tradeoff is higher insert cost and lower maximum load (typically alpha <= 0.5 per table).',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Table of 8 slots (m = 8), hash function h(k) = k mod 8. Insert five keys: 5, 13, 21, 3, 11.',
        'h(5) = 5. Slot 5 is empty. Place 5 there. Table: [_, _, _, _, _, 5, _, _].',
        'h(13) = 5. Slot 5 holds 5, not 13. Probe to slot 6 -- empty. Place 13 there. Table: [_, _, _, _, _, 5, 13, _]. A cluster of length 2 forms at slots 5-6.',
        'h(21) = 5. Slot 5 occupied (5), slot 6 occupied (13), slot 7 empty. Place 21 at slot 7. Table: [_, _, _, _, _, 5, 13, 21]. The cluster grows to length 3, spanning slots 5-7. Three keys with home slot 5 now require 1, 2, and 3 probes respectively.',
        'h(3) = 3. Slot 3 is empty. Place 3 there. Table: [_, _, _, 3, _, 5, 13, 21]. No collision -- 3 lands at its home slot. Two separate clusters exist: {3} at slot 3 and {5, 13, 21} at slots 5-7.',
        'h(11) = 3. Slot 3 holds 3, not 11. Probe to slot 4 -- empty. Place 11 at slot 4. Table: [_, _, _, 3, 11, 5, 13, 21]. The clusters merge into one run spanning slots 3-7. Any future key hashing to slots 3 through 7 must walk to the end of this 5-slot cluster. Load factor is 5/8 = 0.625.',
        'Lookup for key 21: hash to slot 5 (occupied by 5, not 21), probe 6 (13, not 21), probe 7 (21, found). Three probes. Lookup for missing key 29: h(29) = 5, probe 5 (5), 6 (13), 7 (21), 0 (empty) -- four probes to confirm absence. The empty slot at 0 is the proof that 29 was never inserted.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Knuth, "Notes on Open Addressing" (1963) and The Art of Computer Programming, Vol. 3, Section 6.4: the foundational average-case analysis of linear probing, including the probe-count formulas and clustering behavior. Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Ch. 11: universal hashing, double hashing, and amortized dynamic tables.',
        'Prerequisite: Hash Table -- understand hashing and the collision problem before studying probing strategies. Contrasting alternative: separate chaining trades cache locality for simpler deletion and tolerance of load factors above 1. Clustering reduction: quadratic probing and double hashing break primary clustering at different costs. Variance reduction: Robin Hood Hashing bounds maximum displacement by swapping during insertion. Worst-case guarantee: Cuckoo Hashing gives O(1) lookup via two tables and displacement chains. Production design: SwissTable Hash Map adds SIMD metadata filtering to linear probing, cutting equality checks while keeping cache locality.',
      ],
    },
  ],
};
