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
      heading: 'What it is',
      paragraphs: [
        `An LRU (Least Recently Used) cache is a fixed-size data structure that remembers a small number of frequently-accessed items. When it gets full and you try to insert a new item, it evicts the one you used least recently. The classic example: you have a 4-item cache, you access keys [1, 2, 3, 1, 4, ...]. When you access 4 and the cache is full, key 3 gets evicted because 1 was used after 3, 2 was used after 3, and 4 is brand new — so 3 is the least recently used.`,
        `An LRU cache is not a single data structure; it is two structures working as one. A hash table (or hash map) gives you O(1) lookup — "is key 1 in the cache?" — without scanning. A doubly-linked list maintains the recency order — every access moves an item to the head; the tail is always the least recently used item and the prime candidate for eviction.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `When you access a key, the hash table finds it in O(1). If found (cache hit), you move that node to the head of the linked list (two pointer swaps in O(1)) to mark it as recently used. If not found (cache miss), you insert a new node at the head. If the cache is already at capacity, you delete the tail node (the least recently used) first. The tail deletion is O(1) because the list is doubly-linked — you have direct pointers to the tail, no scanning required.`,
        `The animation shows this in real time. The list grows left-to-right, with the head (left) being the most recently used and the tail (right) being the least recently used. Every hit moves a node to the head. Every miss and eviction removes the tail and adds the new key at the head. The hash map (not visually rendered, but logically present) ensures every operation is O(1) without needing to search the list.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Every operation — get, put, and eviction — is O(1). You do at most two pointer swaps and one hash table lookup, both constant time. Space is O(capacity) — you store at most capacity items in the list and hash table. This is significantly better than a naive approach (a list with O(capacity) scan to find the least recently used item, costing O(capacity) time per operation). The LRU cache is a textbook example of how two well-chosen data structures can eliminate bottlenecks that either structure alone would have.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `LRU caches are everywhere. CPU L1/L2/L3 caches use variants of LRU eviction policy to keep hot instruction and data blocks close to the CPU. Redis, Memcached, and other in-memory data stores use LRU (and LFU — least frequently used) eviction to stay within memory limits. Browsers implement LRU-like policies to manage the HTTP cache and keep frequently-visited pages fast. Machine learning inference engines (like the ones powering ChatGPT and other LLMs) use a KV-cache that is essentially an LRU structure — caching embeddings and attention scores to avoid recomputing them. Database query result caching, web server caches, and CDN edge caches all rely on LRU-like policies to maximize hit rates without unbounded memory growth.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The biggest pitfall is implementing LRU with a naive linked list and no hash table. A list alone forces you to scan for a key (O(capacity) time) and scan for the least recently used item (O(capacity) time), making every operation O(capacity) instead of O(1). The second pitfall is using a single-linked list instead of a doubly-linked list — you need to traverse backward to access the tail in O(1) time.`,
        `A misconception: LRU is the only cache eviction policy. Alternatives exist: LFU (least frequently used) tracks access frequency instead of recency; FIFO (first in, first out) evicts the oldest item; random eviction is sometimes used for simplicity. The choice depends on the workload: LRU is best for workloads with temporal locality (recently used items are likely to be used again soon). Another misconception is that cache capacity should be small. In modern systems (like LLM inference with KV-caches), capacities can be hundreds of millions of entries; the O(1) guarantee is what makes this feasible.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Read Hash Table to understand the O(1) lookup part. Study Linked List to see how doubly-linked structures enable O(1) insertion and deletion anywhere in the chain. Then explore Memoization (Dynamic Programming), which uses caching to avoid re-computation — LRU policies manage the cache when memory is limited. Finally, look at systems like Redis or Memcached (both open-source) to see LRU caching in production; many interview questions for senior roles focus on cache design and eviction policies.`,
      ],
    },
  ],
};

