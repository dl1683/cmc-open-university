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
    explanation: `An empty table with ${capacity} buckets. The magic trick: a key's bucket is computed directly from the key (key mod ${capacity}), so lookups jump straight there — no scanning, O(1) on average.`,
  };

  for (const key of keys) {
    let index = hashIndex(key, capacity);
    yield {
      state: hashTableState(buckets, meta()),
      highlight: { active: [`b${index}`] },
      explanation: `insert(${key}): hash it — ${key} mod ${capacity} = ${index}. Aim for bucket ${index}.`,
    };

    let alreadyPresent = false;
    while (buckets[index] !== null) {
      if (buckets[index].key === key) {
        alreadyPresent = true;
        yield {
          state: hashTableState(buckets, meta()),
          highlight: { found: [`b${index}`] },
          explanation: `Bucket ${index} already holds ${key} — the key is in the table, nothing to add.`,
        };
        break;
      }
      const next = (index + 1) % capacity;
      yield {
        state: hashTableState(buckets, meta()),
        highlight: { collision: [`b${index}`], active: [`b${next}`] },
        explanation: `Collision! Bucket ${index} is taken by ${buckets[index].key}. Linear probing says: just try the next bucket (${next}), wrapping around the end if needed.`,
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
      explanation: `${key} lands in bucket ${index}. Load factor: ${size}/${capacity} = ${(size / capacity).toFixed(2)}.`,
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
        explanation: `Load factor hit ${LOAD_LIMIT} — too crowded, probes were getting long. The table doubled from ${oldCapacity} to ${capacity} buckets, and EVERY key was re-hashed, because its index depends on the capacity (key mod ${capacity} now). This occasional O(n) rebuild is the price of keeping inserts O(1) on average.`,
      };
    }
  }

  // lookup
  let index = hashIndex(lookup, capacity);
  yield {
    state: hashTableState(buckets, meta()),
    highlight: { active: [`b${index}`] },
    explanation: `lookup(${lookup}): hash it — ${lookup} mod ${capacity} = ${index}. Jump straight to bucket ${index}; no other bucket needs to be considered first.`,
  };

  let probes = 1;
  while (buckets[index] !== null && buckets[index].key !== lookup) {
    const next = (index + 1) % capacity;
    yield {
      state: hashTableState(buckets, meta()),
      highlight: { collision: [`b${index}`], active: [`b${next}`] },
      explanation: `Bucket ${index} holds ${buckets[index].key}, not ${lookup}. It might have been displaced by a collision — probe forward to ${next}.`,
    };
    index = next;
    probes += 1;
  }

  if (buckets[index] !== null) {
    yield {
      state: hashTableState(buckets, meta()),
      highlight: { found: [`b${index}`] },
      explanation: `Found ${lookup} in bucket ${index} after ${probes} probe${probes === 1 ? '' : 's'}. Compare that with scanning a list of every key — hashing earns its O(1) average.`,
    };
  } else {
    yield {
      state: hashTableState(buckets, meta()),
      highlight: { visited: [`b${index}`] },
      explanation: `Bucket ${index} is empty — and that PROVES ${lookup} is absent: if it had been inserted, probing would have placed it before any empty bucket on this path.`,
    };
  }
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `A hash table maps keys to values by using a hash function to convert a key into an array index. Instead of storing every key in memory and searching linearly, a hash function instantly tells you which bucket to look in. If that bucket is empty, the key is not present. If it holds the key, you have found the value. The power of hashing is that this lookup is O(1) on average — no scanning required.`,
        `The core idea is a trade-off: convert storage (an array of buckets) into indexing power (a fast hash function). When two keys hash to the same bucket (a collision), the table uses linear probing: it walks forward to the next bucket, then the next, until it finds an empty slot or the target key. As the table fills up, the table grows and rehashes every key, because each key's index depends on the table size.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `To insert a key, compute its hash: hash_index = key mod capacity. Go to that bucket. If it is empty, place the key there. If it is occupied and holds a different key, probe forward (wrapping around the end) until you find an empty bucket. Insert the key there. If you insert a key that is already present, do nothing.`,
        `To look up a key, compute the same hash and jump to that bucket. If the bucket holds the key, return its value. If it holds a different key, probe forward until you find your key or hit an empty bucket (which proves the key is absent). To maintain O(1) average performance, the table rehashes when the load factor (size / capacity) exceeds a threshold, typically 0.7. Rehashing doubles the capacity and recomputes every key's hash under the new modulo, distributing them more sparsely.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Lookup, insertion, and deletion are O(1) on average with a good hash function and a load factor below 0.7. With high load factors or bad hash collisions, they degrade to O(n) worst case, but that is rare in practice. Rehashing is O(n) but happens infrequently — only when the table is full enough to need resizing. The space complexity is O(n) for n key-value pairs, but with a fixed load factor, the actual array size is proportional to n, not a huge constant multiple.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Hash tables are everywhere: JavaScript objects and Map, Python dictionaries, Java HashMap, Redis databases. Caching systems like memcached use hashing to distribute keys across servers. DNS lookup tables map domain names to IP addresses using hashing. Git uses hash tables internally to track file contents and commits. Compilers and interpreters use hash tables for symbol tables, storing variable names and their memory locations. Any time you need fast key-value lookup, a hash table is the canonical choice. LRU caches, session storage, and rate limiters all rely on hash tables.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The biggest trap is assuming hash lookups are always O(1) — they are O(1) average, not worst case. A bad hash function or adversarial keys can trigger many collisions, degrading to O(n). Never trust user input to determine your hash function; use a cryptographic hash or robust function instead. Failing to rehash when the table gets full slowly degrades performance. Another mistake is storing mutable objects as keys — if an object's hash code changes after insertion, you can never find it. In JavaScript, using non-string keys in objects can cause unexpected behavior because keys are coerced to strings. Finally, linear probing suffers from clustering: collisions tend to create chains that slow down future probes, though other collision resolution strategies (chaining, quadratic probing, double hashing) can mitigate this.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Explore Binary Search Tree if you need a sorted key structure with O(log n) lookup rather than O(1) average. Study Binary Heap (Priority Queue) to see how hashing combines with heaps for advanced cache eviction. Learn about LRU Cache designs, which layer hashing with linked lists for O(1) eviction. Understanding hash functions themselves requires studying cryptographic basics, but a practical starting point is exploring how different languages implement their built-in hash tables.`,
      ],
    },
  ],
};

