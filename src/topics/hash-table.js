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
      heading: `Why this exists`,
      paragraphs: [
        `Hash tables exist because repeated exact lookup is too expensive with a plain scan. If a server needs user 43192, a compiler needs the symbol named total, or a cache needs the entry for a URL, checking every stored key wastes work that a lookup table can avoid.`,
        `The structure stores key-value pairs in an array of buckets. A hash function turns the key into a number, and the table reduces that number to a bucket index. With a good hash function and enough empty space, lookup, insert, and delete are average O(1), which is why JavaScript Map, Python dict, Ruby Hash, and many runtime object tables use this idea.`,
      ],
    },
    {
      heading: `The obvious approach and the wall`,
      paragraphs: [
        `The obvious approach is an array of pairs: store [key, value], scan until the key matches, then return the value. That is easy and works for small maps. The wall is repeated lookup. If there are n entries, every miss costs n comparisons, and every hit can still take a long walk.`,
        `A sorted array improves lookup with Binary Search, but insertion can shift many entries and range order may not matter. A hash table chooses a different trade: give up sorted order so exact lookup can jump straight to the likely bucket.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `The core insight is that a key can choose its own search path. The hash function maps the key to a home bucket. If that bucket is occupied by another key, the collision rule defines the next bucket to try. Lookup repeats the same path, so it can find a displaced key later.`,
        `The demo uses open addressing with linear probing: on collision, walk forward one bucket at a time and wrap around at the end. Other implementations use chaining, where each bucket points to a small list. The table is fast because collisions are kept rare, not because collisions are impossible.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `Read the active bucket as the current position on the key's probe path. The first active bucket is the home bucket from hashIndex(key, capacity). If it is occupied by a different key, the collision highlight means the table has not failed; it is following the deterministic path that lookup will later repeat.`,
        `When the table grows, every key moves because bucket index depends on capacity. A key that mapped to 7 in an eight-bucket table may map somewhere else after capacity doubles. That is why resizing is called rehashing rather than copying: the table must recompute each key's placement under the new bucket count.`,
        `During lookup, the first empty bucket is proof of absence. The proof only works because insertion would have stopped at that same empty bucket. This is the invariant behind open addressing, and it is why deletion needs tombstones or a rebuild.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Insertion hashes the key and reduces the hash to an index, often with modulo capacity. If the bucket is empty, store the entry. If the bucket holds the same key, update the value. If it holds another key, probe forward until a usable slot appears.`,
        `Lookup uses the exact same probe sequence. If it sees the key, it returns the value. If it sees an empty bucket, it can stop: the key would have been placed before that empty bucket during insertion. Rehashing happens when load factor gets high, commonly around 0.7 for linear probing, because crowded tables create long clusters.`,
        `Deletion is the detail beginners miss. In an open-addressed table, you usually cannot simply clear a removed bucket, because later lookups might stop too early and miss keys displaced beyond it. Many tables leave a tombstone marker that means "deleted, but keep probing through me." Too many tombstones slow the table down, so resizing or rebuilding eventually cleans them out.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Correctness comes from using the same deterministic path for insert and lookup. If a key is inserted, it lands at the first available slot on its path. Later lookup starts at the same home bucket and follows the same collision rule, so it must reach that slot unless it finds the key earlier.`,
        `The empty-bucket stopping rule is safe only because insertion would never skip an empty slot on that path. Tombstones preserve that rule after deletion: they do not hold a live key, but they also do not let lookup stop too early.`,
      ],
    },
    {
      heading: `Cost and tradeoffs`,
      paragraphs: [
        `Average lookup, insertion, and deletion are O(1). Worst case is O(n), either because many keys collide or because an attacker deliberately supplies keys that collide under a predictable hash. Space is O(n), but the backing array is intentionally larger than the number of live entries.`,
        `Rehashing costs O(n) at the moment it happens, yet amortized insertion stays O(1) because resizing is rare. The tradeoff is memory and ordering. A hash table spends extra buckets to keep probes short and does not support sorted iteration or range queries well. Big-O Growth Rates helps compare that average O(1) lookup with Binary Search at O(log n) when sorted order is not needed.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Compilers use hash tables for symbol tables: variable names map to scope and storage information. Web servers use them for headers and session maps. LRU Cache combines Hash Table lookup with linked-list ordering so reads, writes, and evictions stay O(1). Rate Limiter (Token Bucket) implementations often map user IDs or API keys to counters. Consistent Hashing extends the same hash idea across machines, spreading keys around a ring so adding one server moves only part of the data.`,
        `Hashing also appears where the stored value is the hash itself. Merkle Tree uses hashes to summarize chunks of data, while Git names objects by content hash. Bloom Filter uses several hash positions to answer "definitely not present" with tiny memory. Database indexing usually chooses tree structures for range scans, but hash indexes are still useful for exact-match workloads.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The biggest misconception is that O(1) is a promise for every operation. It is an average under assumptions: good distribution, controlled load factor, and no adversarial collision pattern. Security-sensitive runtimes often use randomized or keyed hash functions for strings to prevent collision attacks; a cryptographic hash is not always necessary, but predictability is dangerous.`,
        `Another trap is using plain JavaScript objects as maps without understanding coercion and prototype keys. Object property keys are strings or symbols; Map is safer when keys can be objects. Mutable keys are risky in languages where hash codes depend on object state. Finally, hash tables do not keep sorted order. If you need ordered iteration or range queries, a balanced search tree, B-Trees (How Databases Read), or sorted arrays with Binary Search may be the better tool.`,
      ],
    },
    {
      heading: `Complete case study`,
      paragraphs: [
        `Imagine a web service storing active sessions by session ID. A request arrives with cookie abc123. Linear Search would compare abc123 with every active session. A hash table hashes abc123, jumps to the probe path for that key, and usually finds the session in a few memory touches.`,
        `The same design needs the real tradeoffs. If the service must list sessions by creation time, the hash table alone is the wrong shape because it has no sorted order. If an attacker can force many colliding session IDs, lookup can degrade. Production systems respond with better hash functions, controlled load factor, resizing, and sometimes a second structure for ordering.`,
        `A JavaScript example is a Map keyed by request object. A plain object would coerce many keys to strings and collide semantically; Map preserves object identity. That difference is not cosmetic. The hash table idea is the same, but the language-level equality and key model decide what "same key" means.`,
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
