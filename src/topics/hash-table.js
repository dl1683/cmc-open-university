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
      heading: `What it is`,
      paragraphs: [
        `A hash table stores key-value pairs by running each key through a hash function and using the result to choose an array bucket. Instead of checking keys one by one with a linear scan, the structure jumps straight to the likely location. With a good hash function and enough empty space, lookup, insert, and delete feel constant time, which is why JavaScript Map, Python dict, Ruby Hash, and many runtime object tables use this idea.`,
        `The catch is collisions. Two different keys can land in the same bucket because the array has finite size. The demo uses open addressing with linear probing: if the home bucket is full, walk forward until you find the key or an open slot. Other implementations use chaining, where each bucket points to a small list, or more advanced probing strategies. The table is fast because collisions are kept rare, not because collisions are impossible.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Insertion starts by hashing the key and reducing the hash to an index, often with modulo capacity. If the bucket is empty, store the entry. If the bucket holds the same key, update the value. If it holds another key, probe forward and wrap around the end until a usable slot appears. Lookup repeats the exact probe sequence; stopping at an empty slot proves the key was never inserted along that path.`,
        `Deletion is the detail beginners miss. In an open-addressed table, you usually cannot simply clear a removed bucket, because later lookups might stop too early and miss keys that were displaced beyond it. Many tables leave a tombstone marker: "deleted, but keep probing through me." Too many tombstones slow the table down, so resizing or rebuilding eventually cleans them out. Rehashing also happens when load factor gets high, commonly around 0.7 for linear probing, because crowded tables create long clusters.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Average lookup, insertion, and deletion are O(1). Worst case is O(n), either because many keys collide or because an attacker deliberately supplies keys that collide under a predictable hash. Space is O(n), but the backing array is intentionally larger than the number of live entries. Rehashing costs O(n) at the moment it happens, yet the amortized cost per insertion remains O(1) because resizing is rare. Big-O Growth Rates helps explain why that average-case O(1) lookup is so powerful compared with Binary Search at O(log n) when sorted order is not needed.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Compilers use hash tables for symbol tables: variable names map to scope and storage information. Web servers use them for headers and session maps. LRU Cache combines Hash Table lookup with linked-list ordering so reads, writes, and evictions stay O(1). Rate Limiter (Token Bucket) implementations often map user IDs or API keys to counters. Consistent Hashing extends the same hash idea across machines, spreading keys around a ring so adding one server moves only part of the data.`,
        `Hashing also appears where the stored value is the hash itself. Merkle Tree uses hashes to summarize chunks of data, while Git names objects by content hash. Bloom Filter uses several hash positions to answer "definitely not present" with tiny memory. Database indexing usually chooses tree structures for range scans, but hash indexes are still useful for exact-match workloads.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest misconception is that O(1) is a promise for every operation. It is an average under assumptions: good distribution, controlled load factor, and no adversarial collision pattern. Security-sensitive runtimes often use randomized or keyed hash functions for strings to prevent collision attacks; a cryptographic hash is not always necessary, but predictability is dangerous.`,
        `Another trap is using plain JavaScript objects as maps without understanding coercion and prototype keys. Object property keys are strings or symbols; Map is safer when keys can be objects. Mutable keys are risky in languages where hash codes depend on object state. Finally, hash tables do not keep sorted order. If you need ordered iteration or range queries, a balanced search tree, B-Trees (How Databases Read), or sorted arrays with Binary Search may be the better tool.`,
      ],
    },
    {
      heading: `Sources and runtime details`,
      paragraphs: [
        `MDN's Map reference documents the JavaScript API most directly connected to this topic: key-value pairs, insertion-order iteration, SameValueZero equality for primitive keys, and object-key identity: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map. The keyed collections guide gives the practical Map and Set overview for JavaScript users: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Keyed_collections.`,
        `Runtime implementations add real engineering constraints. V8's "Optimizing hash tables: hiding the hash code" explains how object hash codes are stored without bloating every object: https://v8.dev/blog/hash-code. CPython's dict implementation source documents dictionary objects as hash-table based and compact/ordered in modern Python: https://github.com/python/cpython/blob/main/Objects/dictobject.c. The internal CPython dict header shows the index table entries, empty markers, and dummy markers used by the table: https://github.com/python/cpython/blob/main/Include/internal/pycore_dict.h.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Binary Search and balanced search trees to compare exact lookup with ordered lookup. LRU Cache shows the classic systems-design pairing of hashing and linked ordering. Feature Hashing Signed Projection Primer shows how ML systems replace an explicit feature dictionary with hash buckets. Consistent Hashing, Bloom Filter, Merkle Tree, and Rate Limiter (Token Bucket) all reuse hash functions for different systems problems.`,
      ],
    },
  ],
};
