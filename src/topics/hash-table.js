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
