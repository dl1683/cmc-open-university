// LRU cache: a hash table and a linked list working as one machine.
// The list remembers WHO is least recent; the hash map finds anyone in O(1).

import { sequenceState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'lru-cache',
  title: 'LRU Cache',
  category: 'Systems',
  summary: 'Keep the hottest items, evict the least-recently-used — hash table + linked list, fused.',
  controls: [
    { id: 'capacity', label: 'Capacity', type: 'select', options: ['3', '4'], defaultValue: '4' },
    { id: 'accesses', label: 'Access keys (in order)', type: 'number-list', defaultValue: '1, 2, 3, 1, 4, 2, 5, 1' },
  ],
  run,
};

export function* run(input) {
  const capacity = Number(input.capacity);
  const accesses = parseNumberList(input.accesses, { min: 4, max: 12, label: 'keys' });

  const list = []; // most recent first; the renderer draws it head-first
  const node = (key) => ({ id: `k${key}`, value: key });
  const indexOf = (key) => list.findIndex((n) => n.value === key);
  let hits = 0;
  let misses = 0;

  yield {
    state: sequenceState('linked-list', list),
    highlight: {},
    explanation: `A cache of capacity ${capacity}: it keeps the few items worth keeping and evicts the rest. Policy: evict the LEAST RECENTLY USED. The machine is two structures fused — a linked list ordered by recency (head = hottest), and a hash map pointing at every node so lookups never walk the list.`,
  };

  for (const key of accesses) {
    const at = indexOf(key);
    if (at !== -1) {
      hits += 1;
      yield {
        state: sequenceState('linked-list', list),
        highlight: { found: [`k${key}`] },
        explanation: `get(${key}) — HIT. The hash map jumped straight to the node (no walking, O(1)). But a hit also means "${key}" was just used, so it must move to the head of the recency list…`,
        invariant: 'List order = recency order: head was used most recently, tail least.',
      };
      const [n] = list.splice(at, 1);
      list.unshift(n);
      yield {
        state: sequenceState('linked-list', list),
        highlight: { active: [`k${key}`] },
        explanation: `…and that move is two pointer swaps (see Linked List) — O(1) again. An array would shift everything; this is exactly why the recency order lives in a LIST.`,
      };
      continue;
    }

    misses += 1;
    if (list.length >= capacity) {
      const victim = list[list.length - 1];
      yield {
        state: sequenceState('linked-list', list),
        highlight: { removed: [victim.id] },
        explanation: `get(${key}) — MISS, and the cache is full. The tail (${victim.value}) is by definition the least recently used, so it is evicted — no scanning, no timestamps to compare: the list IS the bookkeeping.`,
      };
      list.pop();
    }
    list.unshift(node(key));
    yield {
      state: sequenceState('linked-list', list),
      highlight: { active: [`k${key}`] },
      explanation: `${list.length === 1 ? `get(${key}) — MISS on an empty cache. ` : ''}Fetch ${key} from the slow source (database, disk, network…), insert it at the head, and record it in the hash map.`,
    };
  }

  yield {
    state: sequenceState('linked-list', list),
    highlight: {},
    explanation: `Done: ${hits} hits, ${misses} misses (${Math.round((hits / accesses.length) * 100)}% hit rate). Every operation was O(1) — and notice neither ingredient could do this alone: a hash map has no order, a list has no fast lookup. Composed, they power CPU caches, Redis eviction, your browser's cache, and the KV-cache inside LLM inference.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A least-recently-used cache stores a bounded set of items and evicts the item whose last access is oldest when capacity is full. It is a bet on temporal locality: if data was used recently, it is more likely to be used again soon. That bet is strong enough to appear in databases, web servers, browsers, operating systems, and distributed caches.`,
        `The classic implementation is a Hash Table plus a doubly Linked List. The hash table maps keys to list nodes for O(1) lookup. The list orders nodes by recency: head means most recent, tail means least recent. A hit moves its node to the head. A miss inserts a new head node and, if needed, evicts the tail.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `On get(key), look up the key in the hash table. If absent, return a miss. If present, detach the node from its current list position and splice it at the head, then return the value. On put(key, value), update and move an existing node if present. Otherwise create a new head node, add it to the hash table, and evict the tail if capacity is exceeded.`,
        `The list must support O(1) removal from the middle. A singly linked list is not enough unless the hash table also stores previous-node pointers and those pointers are maintained carefully. The standard design uses a doubly linked list with head and tail sentinels so insertions, removals, and edge cases are uniform.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Average get, put, move-to-front, and eviction are O(1). Space is O(capacity) for one hash entry and one list node per cached item. The guarantee depends on the Hash Table behaving well; adversarial keys or a bad hash function can degrade lookup unless the table implementation defends itself.`,
        `The naive alternative is a list plus timestamps: scan to find a key, update a timestamp, then scan again to find the oldest item. That costs O(capacity) per operation. Big-O Growth Rates makes the difference brutal at scale: a 1,000,000-entry cache cannot scan on every request and still serve low-latency traffic.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Redis offers approximated LRU eviction because sampling a few candidates is cheaper than maintaining perfect global recency for every key. Memcached uses segmented and slab-aware policies. Browsers use recency-like policies for HTTP cache entries, subject to freshness rules from Cache Invalidation & Versioning. Databases cache pages in buffer pools, often with CLOCK or LRU-k variants rather than textbook LRU. Write-Through vs Write-Back explains a separate cache question: when writes reach durable storage.`,
        `In machine learning serving, KV Cache is related as a memory-saving cache of transformer keys and values for active sequences, but it is not automatically an LRU policy. Systems may page, evict, or recompute those tensors depending on context length and batching pressure.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `LRU is not universally best. Sequential scans can poison it: reading a one-time 10 GB file through a 1 GB cache can evict truly hot items. Databases therefore use scan-resistant policies such as 2Q, ARC, CLOCK-Pro, or admission filters. Least-frequently-used can beat recency when popularity is stable, while FIFO can be acceptable when simplicity matters.`,
        `Another mistake is counting only lookup time and ignoring concurrency. Production caches need locks, sharding, atomic eviction, memory accounting, and expiration. Memoization (Dynamic Programming) is a simpler form of caching; adding a capacity limit and eviction policy turns it into a systems problem.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Hash Table for lookup, Linked List for O(1) splicing, and Memoization (Dynamic Programming) for the algorithmic reason caching helps. Cache Invalidation & Versioning covers freshness, Write-Through vs Write-Back covers durability timing, KV Cache shows a modern AI-serving cache, and Big-O Growth Rates explains why constant-time operations are the point.`,
      ],
    },
  ],
};
