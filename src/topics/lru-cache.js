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
    {heading: 'How to read the animation', paragraphs: ['Read the list from head to tail as recency order. The head is most recently used, the tail is the eviction candidate, and the hidden hash map jumps from a key to its list node.', {type: "callout", text: "LRU is two data structures acting as one: a map finds nodes, and a list makes eviction order explicit."}, 'A hit moves its node to the head. An insertion at full capacity removes the tail, so one access can change which key is closest to eviction.', {type: 'image', src: './assets/gifs/lru-cache.gif', alt: 'Animated walkthrough of the lru cache visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    {heading: 'Why this exists', paragraphs: ['A cache uses small fast storage to avoid repeated slow work. The problem is capacity: when the cache is full, it must choose what to evict.', {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/8/88/Lruexample.png", alt: "Graphic example of LRU cache replacement over an access sequence", caption: "The access trace makes the policy visible: the item with the oldest recent-use rank becomes the victim. Source: Wikimedia Commons, LRU example."}, 'Least Recently Used, or LRU, bets on temporal locality. If a key was used recently, it is more likely to be used again soon than a key that has been idle longest.']},
    {heading: 'The obvious approach', paragraphs: ['The simplest policy is FIFO: evict the oldest inserted item. It is easy because insertion order is just a queue.', 'FIFO ignores use after insertion. A configuration entry loaded first may be used on every request, but FIFO will still evict it before newer cold entries.']},
    {heading: 'The wall', paragraphs: ['Eviction needs recency, but recency is expensive if stored only as timestamps. Finding the oldest timestamp by scanning a million entries costs a million comparisons per eviction.', 'A linked list gives the oldest item at the tail, but lookup by key would require walking the list. A hash map gives lookup but no eviction order.']},
    {heading: 'The core insight', paragraphs: ['Combine the structures. The hash map maps key to node, and the doubly linked list stores nodes in recency order.', {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg", alt: "Linked list nodes connected by arrows ending at null", caption: "The list supplies the physical recency order; LRU uses a doubly linked version so promotion and removal are local pointer edits. Source: Wikimedia Commons, Lasindi, public domain."}, 'The map solves fast access, and the list solves fast promotion and eviction. Neither structure alone has both properties.']},
    {heading: 'How it works', paragraphs: ['get(k) checks the map. On a hit, it reads the node value, detaches the node from its current position, and splices it at the head.', 'put(k, v) updates and promotes an existing node, or inserts a new head node. If the cache is full, it removes the tail node and deletes that key from the map first.']},
    {heading: 'Why it works', paragraphs: ['The invariant is that every map entry points to exactly one list node, every list node has a map entry, and list order matches last access time from newest to oldest. The head is therefore the most recently used item and the tail is the least recently used item.', 'A hit preserves the invariant by moving the accessed node to the head. An insertion is most recent by definition, and an eviction removes the tail, which is exactly the node with the longest idle time.']},
    {heading: 'Cost and complexity', paragraphs: ['get and put are O(1) average time because hash lookup, node detach, head insert, and tail removal are constant-time operations. Space is O(capacity).', 'The behavior cost is metadata and mutation. Each entry stores map overhead plus prev and next pointers, and every hit rewires shared state, which can create contention in concurrent caches.']},
    {heading: 'Real-world uses', paragraphs: ['Database buffer pools use LRU-like policies to keep hot pages in memory. Browsers, CDN edges, DNS caches, Redis policies, and OS page replacement all use LRU or approximations.', {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg", alt: "Cache hierarchy from CPU registers through storage", caption: "LRU-style replacement exists because every layer of a memory hierarchy is smaller and faster than the one below it. Source: Wikimedia Commons, CC BY-SA 4.0."}, 'Hardware and operating systems often approximate LRU. Exact pointer updates are too expensive at nanosecond scale or under heavy concurrency.']},
    {heading: 'Where it fails', paragraphs: ['LRU is weak against scans. A one-time pass over cold keys can evict the hot working set because the scanned keys are newer.', 'LRU also ignores frequency, size, fetch cost, and freshness. Systems use CLOCK, ARC, LRU-K, or TinyLFU-style admission when those costs dominate.']},
    {heading: 'Worked example', paragraphs: ['Use capacity 3. put(1, A), put(2, B), put(3, C) gives list [3, 2, 1], so key 1 is the tail.', 'get(1) is a hit and moves 1 to the head, making [1, 3, 2]. put(4, D) evicts key 2, inserts 4, and leaves [4, 1, 3].']},
    {heading: 'Sources and study next', paragraphs: ['Read Belady 1966 for the optimal future-looking policy and Denning 1968 for working sets. Study hash tables and doubly linked lists first, then CLOCK, ARC, LFU, and Bloom filters.']},
  ],
};
