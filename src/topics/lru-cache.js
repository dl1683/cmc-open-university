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
      heading: "Why this exists",
      paragraphs: [
        "A cache is a promise to spend fast memory on values that avoid slower work later. The hard part is that capacity is finite. If the cache keeps everything forever, it becomes the slow store it was meant to protect. If it evicts carelessly, it saves memory but misses the next useful request.",
        "Least Recently Used is the simplest serious rule for this tradeoff. It assumes temporal locality: an item used recently is more likely to be used again than an item that has gone untouched for a long time. That assumption is not always true, but it is common enough to make LRU a useful baseline in operating systems, databases, HTTP caches, application caches, and teaching examples.",
      ],
    },
    {
      heading: "The naive baseline",
      paragraphs: [
        "The first naive cache is just a hash table with a maximum size. On a miss, insert the fetched value. When the table is full, delete some arbitrary entry. Lookup is fast, but eviction is blind. A popular item can disappear because it happened to be stored next to a cold item or because the implementation picked the first key it saw.",
        "The second naive design stores a timestamp on each entry and scans the whole cache on every eviction to find the oldest timestamp. This is correct LRU, but it is too expensive when the cache is large or when misses are frequent. Scanning a million entries to free one slot turns a cache miss into a cache-wide maintenance operation.",
      ],
    },
    {
      heading: "The data-structure insight",
      paragraphs: [
        "LRU becomes practical when the cache separates two questions. A hash table answers whether a key is present and gives a pointer to its entry in expected O(1) time. A doubly linked list records recency order, with the most recent item at the head and the least recent item at the tail.",
        "Those two structures are useful only together. The hash table alone has no cheap way to name the oldest entry. The linked list alone has no cheap way to find the node for key k. The combination gives fast lookup, fast promotion, and fast victim selection without scanning.",
      ],
    },
    {
      heading: "How the algorithm works",
      paragraphs: [
        "On get(k), the cache checks the hash table. If k is absent, the operation is a miss and the caller must fetch the value from the backing store. If k is present, the cache reads the value and moves that node to the front of the list, because this access has made it the most recently used item.",
        "On put(k, v), the cache either updates an existing node and moves it to the front, or creates a new node at the front. If the new insertion exceeds capacity, the cache removes the tail node and deletes the matching hash-table entry. That tail removal is O(1) because the list always keeps a direct pointer to the least recent item.",
      ],
    },
    {
      heading: "What the visual is proving",
      paragraphs: [
        "The visual is proving the invariant, not just showing list motion. After every operation, the left side of the list is hotter than the right side, the tail is the legal eviction victim, and every key in the hash table points to the current node that carries that key.",
        "A hit is important because it changes both meaning and structure. The value was already cached, but the evidence about future reuse changed. Moving the node to the head records that evidence. A full-cache miss shows the opposite side of the invariant: the cache does not search for a victim because the tail already names one.",
      ],
    },
    {
      heading: "Correctness invariants",
      paragraphs: [
        "A correct LRU cache maintains three invariants. First, every key in the hash table appears exactly once in the list. Second, every list node has a matching hash-table entry. Third, list order matches the last access time of resident keys, from newest at the head to oldest at the tail.",
        "Most LRU bugs break one of those invariants. Updating a value without moving it makes the order stale. Removing the tail without deleting the hash entry leaves a pointer to dead state. Creating a second node for an existing key makes capacity accounting lie. Good implementations treat map and list updates as one logical operation.",
      ],
    },
    {
      heading: "Why it works",
      paragraphs: [
        "LRU works when recent use is a good predictor of near-future use. User sessions, active database pages, recently loaded modules, browser resources, and repeated API lookups often have this shape. The exact object may not be requested forever, but recent work tends to cluster.",
        "The policy also works because it is explainable. If a value was evicted, it was the value with the longest quiet period among resident items. That makes LRU easy to debug, easy to simulate from a trace, and easy to compare against more complicated policies that claim better hit rates.",
      ],
    },
    {
      heading: "Costs and tradeoffs",
      paragraphs: [
        "The advertised cost is O(1) average time for lookup, update, promotion, and eviction, plus O(capacity) space. The hidden cost is metadata. Each entry needs hash-table overhead and list pointers. In languages with object allocation overhead, the node structure can cost more memory than small cached values.",
        "The other hidden cost is mutation on every hit. A read is not only a read; it rewires the list. In a single-threaded toy this is fine. In a highly concurrent cache, constant promotion can create lock contention, cache-line bouncing, or batching complexity. Many production systems shard LRU, approximate it, or move recency maintenance off the hottest path.",
      ],
    },
    {
      heading: "Implementation details",
      paragraphs: [
        "A textbook linked-list implementation needs direct node removal. That is why a doubly linked list is used instead of a singly linked list. Given a node pointer from the hash table, the cache can detach the node by updating its previous and next neighbors, then splice it at the head.",
        "Capacity also needs a precise definition. A teaching cache usually counts entries. A production cache often counts bytes, weighted cost, or reserved memory. Once capacity is weighted, evicting one tail node may not be enough. The policy may need to keep removing victims until the cache is back under budget.",
      ],
    },
    {
      heading: "Real uses",
      paragraphs: [
        "LRU and LRU-like policies appear wherever memory is cheaper than recomputation but still limited. Database buffer pools use recency ideas to keep hot pages near memory. Web caches use them to keep recently requested responses. Language runtimes and services use them for parsed templates, compiled regular expressions, authorization decisions, and request-derived objects.",
        "JavaScript also has a practical shortcut for small LRU caches: a Map preserves insertion order, so code can delete and reinsert a key on hit, then evict the first key when capacity is exceeded. That is a useful implementation trick, but the underlying idea is the same hash-and-order composition.",
      ],
    },
    {
      heading: "Failure modes and limits",
      paragraphs: [
        "LRU fails badly on scans. Suppose a cache holds the hot working set, then a one-time batch job reads a long sequence of cold items. Pure LRU admits every scanned item and evicts hot residents simply because the scan is recent. When the normal workload returns, the cache pays misses for values it should have protected.",
        "LRU also ignores frequency, value size, fetch cost, freshness, and write behavior. A small object used every minute and a huge object used once have the same recency treatment if their last access times match. A cache that serves stale data quickly is still wrong. LRU is an eviction rule, not a complete caching system.",
      ],
    },
    {
      heading: "Study next",
      paragraphs: [
        "Study Hash Table and Linked List first, because LRU is one of the cleanest examples of composing them into a stronger abstraction. Then study Memoization to see the simplest form of reuse, and Cache Invalidation to learn why keeping an answer can be more dangerous than recomputing it.",
        "After that, move to W-TinyLFU Cache Admission for scan resistance, Modern Cache Eviction for SIEVE and S3-FIFO, Write-Through vs Write-Back for durability timing, Count-Min Sketch for approximate frequency, and Tail Latency for the production cost of cache misses and cache bookkeeping.",
      ],
    },
  ],
};
