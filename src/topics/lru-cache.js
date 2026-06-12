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
