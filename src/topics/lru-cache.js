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
      heading: 'How to read the animation',
      paragraphs: [
        "The animation draws a doubly linked list ordered by recency: head (left) is the most recently used item, tail (right) is the eviction candidate. Behind the list sits a hash map that you do not see drawn, but every hit proves it exists -- the cache jumps to the right node without walking.",
        {type: "callout", text: "LRU is two data structures acting as one: a map finds nodes, and a list makes eviction order explicit."},
        "Green nodes are cache hits: the hash map found them in O(1) and they are about to move to the head. Red nodes are eviction victims: they sit at the tail when the cache is full and a new entry needs space. Highlighted nodes are freshly inserted or just promoted.",
        "The key moment is the move-to-front after a hit. One access changes the entire eviction order. Watch which node ends up at the tail after each promotion -- that node is now closest to death, even if it was safe a moment ago.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        "Memory is fast. Disk, network, and recomputation are slow. A cache spends a small amount of fast memory to avoid repeating slow work. The problem is that fast memory is finite. A cache that never evicts eventually holds everything and becomes the slow store it was supposed to avoid. A cache that evicts the wrong entry wastes a slot and pays a miss on the next request for that entry.",
        "Belady showed in 1966 that the optimal eviction policy (MIN) replaces the entry whose next use is farthest in the future. MIN requires knowing the future, so it is useful as a benchmark but impossible to run in practice. LRU approximates MIN by betting on temporal locality: what was used recently will probably be used again soon. This bet pays off in CPU instruction streams, database page accesses, web requests, and DNS lookups -- anywhere the working set is smaller than the total key space and recent access predicts near-future access.",
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/8/88/Lruexample.png", alt: "Graphic example of LRU cache replacement over an access sequence", caption: "The access trace makes the policy visible: the item with the oldest recent-use rank becomes the victim. Source: Wikimedia Commons, LRU example."},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "A FIFO cache is the simplest eviction policy. Keep a queue. Insert new entries at the back. When the cache is full, evict from the front -- the oldest entry. FIFO needs no bookkeeping beyond insertion order.",
        "FIFO works when old entries are genuinely useless. A log buffer that processes entries once and never re-reads them is a natural FIFO. But most caches serve repeat requests. A configuration value loaded at startup is the oldest entry in the cache, yet it may be accessed on every single request. FIFO evicts it purely because it was inserted first, not because it stopped being useful.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "FIFO ignores usage. It treats a cold entry inserted five seconds ago the same as a hot entry inserted five seconds ago. What matters for eviction is not when an entry arrived but when it was last used. Recency of use, not recency of insertion, predicts future need.",
        "Tracking recency with timestamps is correct but expensive. Store a last-access time with each entry, update it on every get, and on eviction scan all entries to find the oldest timestamp. The scan is O(n). A cache with a million entries pays a million comparisons every time it needs to make room. The bookkeeping that was supposed to save time now dominates it.",
        "A linked list sorted by recency avoids the scan -- the tail is always the victim -- but finding a node by key requires walking the list: O(n). A hash map finds any key in O(1), but a hash map has no concept of order. Neither structure alone gives O(1) for both lookup and recency maintenance.",
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "Fuse the two structures. A hash map maps each key to a direct pointer to a node in a doubly linked list. The list maintains recency order: head is most recent, tail is least recent. The hash map handles the job the list cannot do (fast key lookup), and the list handles the job the hash map cannot do (ordered eviction and O(1) promotion).",
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg", alt: "Linked list nodes connected by arrows ending at null", caption: "The list supplies the physical recency order; LRU uses a doubly linked version so promotion and removal are local pointer edits. Source: Wikimedia Commons, Lasindi, public domain."},
        "get(k): look up k in the hash map. If present, follow the pointer to the node, read its value, and move the node to the head of the list (two pointer swaps -- O(1) because the list is doubly linked). If absent, it is a cache miss.",
        "put(k, v): if k exists, update the value and move the node to the head. If k is new and the cache is full, remove the tail node (O(1)), delete its key from the hash map, then insert the new node at the head and record it in the hash map. If k is new and the cache has room, just insert at the head.",
        "Every operation is O(1). The doubly linked list gives O(1) node detachment because each node knows both its predecessor and successor. The hash map gives O(1) access to any node without walking.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "The list is always sorted by last-access time, head to tail. Three invariants maintain correctness. First, every key in the hash map corresponds to exactly one node in the list. Second, every node in the list has a matching hash map entry. Third, list order reflects recency -- the head was accessed most recently, the tail least recently.",
        "Every mutation preserves these invariants. A hit promotes the accessed node to the head, which correctly records that this key is now the most recently used. An eviction removes the tail -- by definition the key with the longest idle time among all cached entries. An insertion places the new entry at the head, because an entry just fetched from the backing store is the most recently used.",
        "Most LRU bugs break one of the three invariants: updating a value without promoting the node makes recency order stale; removing the tail without deleting its hash map entry leaves a dangling pointer; inserting a duplicate node without removing the old one breaks capacity accounting.",
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        "get and put are both O(1) average time. Space is O(capacity), but each entry carries overhead: two list pointers (prev and next), a hash map bucket pointer, and the stored hash value. For small cached values -- an integer, a short string -- the node metadata can cost more memory than the data itself.",
        "Every hit rewires the list. In a single-threaded cache this is cheap. In a concurrent cache, constant promotion creates contention: every read modifies shared state. Production systems handle this with sharded LRUs, batched promotions, or approximations like the CLOCK algorithm that avoid pointer rewiring on every access.",
        "Doubling capacity doubles memory but does not change per-operation cost. Doubling the working set beyond capacity raises the miss rate but each miss still costs O(1) for the cache bookkeeping -- the expensive part is the backing-store fetch (disk read, network round trip, recomputation), which dwarfs the O(1) pointer work.",
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        "CPU caches (L1, L2, L3) approximate LRU in hardware. True LRU for a 16-way set-associative cache would require tracking 16! orderings per set -- impossible in silicon. CPUs use pseudo-LRU (a tree of bits) or CLOCK (a circular buffer with reference bits) to approximate recency in nanoseconds.",
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg", alt: "Cache hierarchy from CPU registers through storage", caption: "LRU-style replacement exists because every layer of a memory hierarchy is smaller and faster than the one below it. Source: Wikimedia Commons, CC BY-SA 4.0."},
        "Database buffer pools keep hot disk pages in RAM. PostgreSQL uses a CLOCK-sweep variant; MySQL's InnoDB uses a modified LRU with midpoint insertion (new pages enter at the 3/8 mark so a full table scan does not flush the hot end).",
        "Web browsers cache HTTP responses (HTML, CSS, JS, images) in memory and on disk. When the cache exceeds its size budget, the least recently used responses are evicted. HTTP Cache-Control headers govern freshness; LRU governs space.",
        "CDN edge caches (Cloudflare, Fastly, Akamai) use LRU-like eviction to decide which origin responses to keep at each edge node. Some layer frequency scoring on top to protect steadily popular URLs from bursts of unique traffic.",
        "OS page replacement uses the CLOCK algorithm, which approximates LRU with a reference bit per page frame. The OS clears reference bits periodically; a page whose bit is still clear on the next sweep is treated as least recently used and evicted.",
        "DNS caches, Redis (allkeys-lru and volatile-lru policies), and the KV-cache inside LLM inference engines all use LRU or LRU approximations. LeetCode problem 146 is the classic interview formulation.",
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "Scan resistance is LRU's main weakness. A one-time sequential scan of cold data evicts every hot resident, because LRU only sees recency: the scanned items are newer. When the scan ends and the normal workload returns, the cache is full of useless entries. LRU-K (evict based on the Kth-most-recent access, not just the most recent), ARC (balances recency and frequency using two ghost lists), and CLOCK-Pro (approximates ARC without per-entry metadata) were all designed to fix this.",
        "LRU ignores frequency. An entry accessed once per hour and an entry accessed once per millisecond look the same if their last-access timestamps happen to match. LFU (Least Frequently Used) tracks access counts instead, but LFU has its own problem: a formerly popular entry that has gone cold keeps its high count forever and monopolizes cache space. Modern hybrid policies like W-TinyLFU use an LRU admission window plus a frequency sketch to combine both signals.",
        "LRU also ignores entry size, fetch cost, freshness, and write-back cost. A 1 KB object and a 100 MB object get the same treatment. A cache that serves stale data quickly is still wrong. LRU is an eviction policy, not a complete caching system.",
        "Cold start is unavoidable: an empty LRU cache has a 100% miss rate until the working set loads. Capacity tuning is empirical -- too small and the hit rate suffers, too large and memory is wasted on entries that would never be evicted anyway.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "LRU cache, capacity 3. Six operations showing list state (head to tail) and hash map after each step.",
        "put(1, A): List [1]. Map {1: node1}. One entry, room for two more.",
        "put(2, B): List [2, 1]. Map {1: node1, 2: node2}. Key 2 is newest. Key 1 drifts toward the tail.",
        "put(3, C): List [3, 2, 1]. Map {1: node1, 2: node2, 3: node3}. Cache is full. Key 1 is at the tail -- next eviction victim unless something touches it.",
        "get(1): HIT. Hash map finds node1 in O(1). Detach node1 from the tail (its predecessor's next pointer becomes null) and splice it at the head. List becomes [1, 3, 2]. Key 2 is now the tail -- the least recently used. One access saved key 1 from eviction and condemned key 2 instead.",
        "put(4, D): Cache is full. Evict the tail: key 2 is removed from the list and deleted from the hash map. Insert key 4 at the head. List becomes [4, 1, 3]. Map {1: node1, 3: node3, 4: node4}. Key 2 is gone. If you expected key 3 to be evicted, trace back: get(1) made key 1 more recent than key 3, so key 2 was the coldest.",
        "get(2): MISS. Key 2 was evicted in the previous step. The cache cannot serve this request -- the caller must fetch from the backing store. This is the cost of limited capacity: the eviction was correct by the LRU rule, but the workload needed key 2 again.",
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        "Belady 1966 (A Study of Replacement Algorithms for a Virtual-Storage Computer) proved that evicting the entry whose next use is farthest in the future is optimal (the MIN/OPT algorithm), establishing the benchmark LRU tries to approximate. Denning 1968 (The Working Set Model for Program Behavior) formalized temporal locality. Sleator and Tarjan 1985 (Amortized Efficiency of List Update and Paging Rules) proved LRU is k-competitive: its cost is at most k times optimal for a cache of size k.",
        "Prerequisites: Hash Table (the O(1) lookup half -- without it, finding a cached item requires scanning) and Doubly Linked List (the O(1) recency half -- without prev pointers, promoting or evicting a node requires walking from the head).",
        "Extensions: CLOCK algorithm (hardware-friendly LRU approximation using a circular buffer and reference bits), ARC (Adaptive Replacement Cache -- self-tuning balance of recency and frequency), LFU Cache (frequency-based eviction with different failure modes), and Bloom Filter (often placed in front of a cache to avoid lookups for keys that were never stored).",
      ],
    },
  ],
};
