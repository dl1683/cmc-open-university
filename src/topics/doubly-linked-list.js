// Doubly linked list: each node stores prev and next pointers, so removal
// at a known position is O(1) without traversing from the head.

import { sequenceState, parseNumberList, parseNumber } from '../core/state.js';

export const topic = {
  id: 'doubly-linked-list',
  title: 'Doubly Linked List',
  category: 'Data Structures',
  summary: 'Each node stores both a next and a prev pointer, enabling O(1) removal at any known position and bidirectional traversal.',
  controls: [
    { id: 'values', label: 'Build with', type: 'number-list', defaultValue: '4, 8, 15, 16, 23' },
    { id: 'target', label: 'Then remove', type: 'number', defaultValue: '15' },
  ],
  run,
};

export function* run(input) {
  const values = parseNumberList(input.values, { max: 8 });
  const target = parseNumber(input.target, { label: 'a value to remove' });
  const list = [];

  // Build phase: append each value, showing prev/next wiring
  for (let i = 0; i < values.length; i += 1) {
    list.push({ id: `n${i}`, value: values[i] });
    const prevNode = i > 0 ? list[i - 1] : null;
    yield {
      state: sequenceState('linked-list', list),
      highlight: { active: [`n${i}`] },
      explanation: i === 0
        ? `Insert ${values[i]}: the list is empty, so this node becomes both head and tail. Its prev and next are both null. In a singly linked list, head is the only entry point; here we also keep a tail pointer for O(1) access to the end.`
        : `Append ${values[i]}: set the new node's prev to the current tail (${prevNode.value}), set the old tail's next to the new node, and advance tail. Two pointer updates, O(1). A singly linked list without a tail pointer would need an O(n) walk to find the end.`,
      invariant: 'Every node satisfies: if node.next exists, then node.next.prev === node.',
    };
  }

  // Search phase: find the target by traversing from head
  let foundIndex = -1;
  for (let i = 0; i < list.length; i += 1) {
    const isMatch = list[i].value === target;
    yield {
      state: sequenceState('linked-list', list),
      highlight: { active: [list[i].id], visited: list.slice(0, i).map((n) => n.id) },
      explanation: `Searching for ${target}. ${i === 0 ? 'Start at head' : `Follow next to node ${i}`}: ${list[i].value} ${isMatch ? 'matches.' : 'is not the target. The prev pointer does not help here; search is still O(n) because we have no index.'} A doubly linked list speeds up removal, not lookup.`,
    };
    if (isMatch) { foundIndex = i; break; }
  }

  if (foundIndex === -1) {
    yield {
      state: sequenceState('linked-list', list),
      highlight: { visited: list.map((n) => n.id) },
      explanation: `Reached the end without finding ${target}. Search is O(n) regardless of direction. The prev pointer does not give us a shortcut to find a value.`,
    };
    return;
  }

  // Removal phase: show the O(1) pointer surgery
  const removed = list[foundIndex];
  const prev = list[foundIndex - 1] ?? null;
  const next = list[foundIndex + 1] ?? null;

  yield {
    state: sequenceState('linked-list', list),
    highlight: { removed: [removed.id], active: [prev?.id, next?.id].filter(Boolean) },
    explanation: prev && next
      ? `Found ${removed.value}. In a singly linked list, removal needs the predecessor, which costs O(n) to find. Here, ${removed.value}.prev is ${prev.value} and ${removed.value}.next is ${next.value}. Both neighbors are known in O(1).`
      : prev
        ? `Found ${removed.value} at the tail. Its prev is ${prev.value}. Set ${prev.value}.next = null and update the tail pointer. O(1).`
        : next
          ? `Found ${removed.value} at the head. Its next is ${next.value}. Set ${next.value}.prev = null and update the head pointer. O(1).`
          : `Found ${removed.value}. It is the only node. Set head = null and tail = null.`,
  };

  yield {
    state: sequenceState('linked-list', list),
    highlight: { removed: [removed.id], active: [prev?.id, next?.id].filter(Boolean) },
    explanation: prev && next
      ? `Rewire: set ${prev.value}.next = ${next.value}, and ${next.value}.prev = ${prev.value}. Two pointer updates. The removed node is bypassed. This is the operation that justifies the extra prev pointer: given a reference to any node, removal is O(1).`
      : `Update the head or tail pointer. One pointer update. Edge cases at the ends are simpler, not harder.`,
    invariant: 'After rewiring, the chain invariant holds: following next from head visits every live node, and following prev from tail visits them in reverse.',
  };

  list.splice(foundIndex, 1);
  yield {
    state: sequenceState('linked-list', list),
    highlight: prev ? { active: [prev.id] } : next ? { active: [next.id] } : {},
    explanation: `${removed.value} is removed. The list is intact in both directions. The total cost: O(n) to find the node, O(1) to remove it. If the caller already holds a reference to the node (as in an LRU cache), the entire operation is O(1).`,
  };

  // Reverse traversal to show bidirectional access
  if (list.length >= 2) {
    yield {
      state: sequenceState('linked-list', list),
      highlight: { active: [list[list.length - 1].id] },
      explanation: `Bonus: traverse backward from the tail. A singly linked list cannot do this without reversing the entire list or using a stack. With prev pointers, we just follow them.`,
    };

    for (let i = list.length - 1; i >= 0; i -= 1) {
      yield {
        state: sequenceState('linked-list', list),
        highlight: {
          active: [list[i].id],
          visited: list.slice(i + 1).map((n) => n.id),
        },
        explanation: i === list.length - 1
          ? `Start at tail: ${list[i].value}.`
          : i === 0
            ? `Reached head: ${list[i].value}. The entire list is reachable from either end. Bidirectional traversal is the second benefit of the extra pointer.`
            : `Follow prev to ${list[i].value}.`,
      };
    }
  }
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each rectangle is a node holding a value. Rightward arrows are next pointers; leftward arrows are prev pointers. The head label marks the first node; the tail label marks the last. Active (highlighted) nodes are being inspected or modified right now. Visited nodes have already been checked during a search pass and will not be revisited.',
        {type: 'callout', text: 'The extra prev pointer buys O(1) removal at a known node by making both neighbors directly reachable.'},
        'Watch the build phase first. Each new node arrives at the tail. Two arrows appear simultaneously: a forward arrow from the old tail to the new node (old_tail.next = new) and a backward arrow from the new node to the old tail (new.prev = old_tail). Those two pointer writes -- plus updating the tail reference itself -- are the entire cost of an append. No existing node besides the old tail is touched.',
        'During removal, the target node lights up along with its two neighbors. The neighbors\' arrows redirect to skip the target: predecessor.next changes from the target to the successor, and successor.prev changes from the target to the predecessor. The target disappears. No other node moves, shifts, or is inspected. That two-pointer rewire is the mechanism that makes deletion O(1) when you already hold a reference to the node.',
        'During reverse traversal, the animation follows prev pointers from tail to head, visiting every node in backward order. This is only possible because each node stores its predecessor. A singly linked list would need a full forward pass or an auxiliary stack to produce the same backward sequence.',
        {type: 'image', src: './assets/gifs/doubly-linked-list.gif', alt: 'Animated walkthrough of the doubly linked list visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A singly linked list can only move forward. Each node stores a next pointer but nothing about what came before it. Removing a node requires its predecessor -- specifically, you must set predecessor.next = target.next to bypass the target. But the target does not know its predecessor, so you must walk from the head, checking each node\'s next pointer until you find the one pointing to the target. That walk costs O(n).',
        'When you already hold a direct reference to the node you want to delete -- because a hash table gave it to you, or the user\'s cursor is sitting on it -- that O(n) walk is pure waste. The predecessor is one hop away in the physical structure, but the singly linked list has no way to reach it without restarting from the head.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Doubly-linked-list.svg/960px-Doubly-linked-list.svg.png', alt: 'Doubly linked list nodes connected by previous and next arrows', caption: 'The diagram shows why deletion can be local: the removed node already names both neighbors. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Doubly-linked-list.svg.'},
        'The doubly linked list solves this by storing a prev pointer in every node. Any node can now name both its predecessor and its successor in O(1). Deletion becomes two pointer writes -- no traversal. This matters in every system that needs fast removal at arbitrary positions: LRU caches that evict and promote in O(1), text editors that insert and delete at the cursor without shifting the rest of the document, browser histories that navigate forward and back.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A singly linked list is the natural starting point. Each node stores a value and a single next pointer. Insertion at the head is O(1): create a node, point its next to the current head, update the head reference. Traversal from head to tail follows next pointers. The structure is minimal -- one pointer per node, low memory overhead, easy to implement correctly.',
        'For workloads that only touch the ends, a singly linked list is enough. Push and pop at the head are both O(1). Append at the tail is O(1) if you keep a tail pointer. Stacks, queues, and FIFO buffers all work well with singly linked nodes. The simplicity is a genuine advantage, not a limitation, when interior access is never needed.',
        'An array is the other obvious approach. It stores elements contiguously and gives O(1) indexed access. But interior deletion costs O(n) because every element after the gap must shift left to close it. For 10,000 elements, deleting element 50 shifts 9,950 values. The array is fast to scan but expensive to restructure.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Singly linked list deletion requires the predecessor. To remove node X, you must execute predecessor.next = X.next. But X does not carry a prev pointer. The only way to find the predecessor is to walk from the head, checking each node until you find one whose next is X. That search costs O(n) in the worst case.',
        'Backward traversal is equally impossible. If you are at node X and need the previous node, you must restart from the head. There is no backward path. Algorithms that need reverse iteration must either reverse the list first (O(n) and destructive) or maintain a separate stack of visited nodes (O(n) space).',
        'These two limitations compound when the linked list is part of a larger data structure. An LRU cache pairs a hash table (O(1) key lookup) with a linked list (recency order). The hash table returns a direct pointer to a node. If removing that node from the list costs O(n) because you need the predecessor, the entire cache degrades from O(1) to O(n). The singly linked list, chosen for its simplicity, becomes the bottleneck that defeats the purpose of the cache.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store the predecessor explicitly. Add a prev pointer to every node so it records who comes before it, just as next records who comes after. Now any node can name both its neighbors in O(1) time. Deletion no longer requires searching for the predecessor -- the node being deleted already knows it.',
        'The cost is one additional pointer per node: 8 bytes on a 64-bit system, doubling the pointer overhead from 8 to 16 bytes per node. The payoff is that every structural modification at a known position -- insertion before, insertion after, and deletion -- drops from O(n) to O(1). The trade is worth it exactly when the workload involves frequent interior removals or repositions and the caller holds direct references to the nodes involved.',
        'This is a classic time-space trade: spend 8 bytes per node to save O(n) work per operation. For a list of 10,000 nodes, that is 80 KB of extra memory to avoid up to 10,000 node inspections per deletion. The break-even point is very low -- even a handful of interior deletions over the list\'s lifetime justifies the extra pointer.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each node stores three fields: data (the payload), prev (pointer to the predecessor node or null), and next (pointer to the successor node or null). The list itself maintains two references: head points to the first node, tail points to the last. An empty list has head = null and tail = null.',
        'Insertion between two adjacent nodes A and B requires four pointer writes, and the order matters. First capture both neighbors: let A be the predecessor and B be A.next (the successor). Then wire the new node: new.prev = A, new.next = B. Then update the neighbors: A.next = new, B.prev = new. If you overwrite A.next before reading it, you lose B. Always capture both neighbors before writing any pointer. Tail insertion is a special case where B is null, and head insertion is the symmetric case where A is null.',
        'Deletion of node X requires only two pointer writes. Let P = X.prev and N = X.next. Set P.next = N and N.prev = P. The removed node is bypassed -- no other node inspected, no element shifted. Edge cases arise when X is the head (P is null, so set head = N) or the tail (N is null, so set tail = P). Each edge case replaces one pointer write with one list-reference update.',
        'Sentinel nodes eliminate all edge cases. Place a dummy head node before the first real node and a dummy tail node after the last. Every real node now has non-null prev and next at all times. The general two-pointer deletion code handles every case, including removing the first or last real element, without any conditional branches. The Linux kernel\'s list.h uses this approach; so do most production LRU caches.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one invariant: for every adjacent pair of nodes (A, B), A.next === B and B.prev === A. This is the bidirectional chain invariant. Every operation must preserve it, and no legal state violates it.',
        'Insertion replaces one link A-B with two links A-new and new-B. The four pointer writes (new.prev = A, new.next = B, A.next = new, B.prev = new) establish the invariant for both new links by construction. The old direct link between A and B no longer exists, but both connections through the new node satisfy the bidirectional requirement.',
        'Deletion removes node X from the chain by redirecting its neighbors to point at each other. P.next changes from X to N; N.prev changes from X to P. The resulting link P-N satisfies the invariant. X\'s stale prev and next pointers are irrelevant because X is no longer reachable from head or tail -- no traversal will visit it again.',
        'The O(1) deletion guarantee follows directly from the invariant. Because X.prev names the predecessor and X.next names the successor, the two pointer writes that bypass X require no search. The bidirectional invariant is both the correctness contract and the source of the performance guarantee.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert at head or tail: O(1). Remove at head or tail: O(1). Insert or remove at a known interior position (given a pointer to the adjacent node): O(1). Search by value: O(n) -- you must walk the chain. Access by index: O(n), though you can start from whichever end is closer, halving the average walk length.',
        'Space is O(n) with two pointers per node. On a 64-bit system each node carries 16 bytes of pointer overhead (prev + next) versus 8 bytes for a singly linked list. For nodes holding a single 4-byte integer, the pointers consume four times as much memory as the data. For nodes holding large objects -- a 200-byte struct, say -- the extra 8 bytes is negligible (4% overhead).',
        'Doubling the input doubles the time for search and indexed access. Insert and delete at known positions stay O(1) regardless of list size. The structure scales well for modification-heavy workloads (many inserts and deletes per lookup) and poorly for lookup-heavy ones (many searches per modification).',
        'Cache performance is poor. Nodes are heap-allocated at scattered virtual addresses. Each pointer follow is a likely cache miss -- the next node is almost never in the same cache line as the current one. Sequential traversal of a 10,000-node linked list may trigger 10,000 L1 cache misses. The same 10,000 elements stored in a contiguous array fit in roughly 40 KB and benefit from hardware prefetching, making sequential scans an order of magnitude faster in practice.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LRU cache. A hash table maps keys to list nodes for O(1) lookup. The doubly linked list maintains recency order: the most recently accessed node is at the head, the least recently accessed is at the tail. On access, detach the node from its current position (two pointer writes) and reattach it at the head (two more pointer writes). On eviction, remove the tail node and delete its hash entry. Total cost per access: O(1). Without prev pointers, detaching a node from the middle would require an O(n) predecessor search, defeating the cache.',
        'Browser forward/back history. Each visited page is a node with prev (back) and next (forward). Visiting a new page inserts after the current node and discards the entire forward chain (set current.next = new, new.prev = current, new.next = null). Pressing back follows prev; pressing forward follows next. The bidirectional structure maps one-to-one to the navigation model.',
        'OS kernel scheduling. The Linux kernel\'s list.h implements a circular doubly linked list using macros and the container_of trick. List nodes are embedded directly inside task_struct, timer_list, and other kernel objects with zero extra allocation. The scheduler inserts, removes, and reorders threads constantly across ready queues, wait queues, and timer lists. O(1) modification at known positions is non-negotiable at kernel scale.',
        'Text editor buffers. Each line or edit operation is a node. Inserting a new line at the cursor splices a node into the chain with four pointer writes. Deleting a line removes it with two pointer writes. The cursor can move forward (next) or backward (prev) without rebuilding any index. Emacs uses a gap buffer instead, but many simpler editors use linked lists for their structural clarity.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Double the pointer overhead of a singly linked list. Each node pays 16 bytes for two pointers instead of 8. For bulk storage of small values -- a list of 1,000,000 single-byte characters would spend 16 MB on pointers and 1 MB on data. Arrays or singly linked lists are far more space-efficient for small payloads.',
        'Search is still O(n). The prev pointer does not help find a value any faster. Both forward and backward traversal visit one node at a time. If the workload is dominated by lookups (finding an element by value or by key), a hash table gives O(1) expected lookup and a balanced BST gives O(log n). The doubly linked list speeds up modification, not search.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/1D_array_diagram.svg/250px-1D_array_diagram.svg.png', alt: 'One-dimensional array diagram with adjacent indexed cells', caption: 'The array contrast matters: contiguous indexed cells are faster to scan even though interior deletion is expensive. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:1D_array_diagram.svg.'},
        'Cache-hostile traversal. Nodes are scattered across the heap. Every pointer follow is a potential L1 cache miss. Benchmarks on modern hardware consistently show arrays outperforming linked lists for sequential scans by 10-50x, entirely due to spatial locality and hardware prefetching. The doubly linked list trades cache performance for O(1) structural modification -- a trade that only pays off when modifications vastly outnumber scans.',
        'Concurrency is hard. A single deletion touches three nodes (the target and both neighbors), and all three must be updated atomically for the invariant to hold. Lock-free doubly linked lists exist (Sundell and Tsigas, 2008) but are notoriously difficult to implement correctly. Most production code either guards the list with a mutex or redesigns around the concurrency requirement.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Build a list holding [A, B, C]. Start empty: head = null, tail = null. Insert A: create node A with prev = null, next = null. Set head = A, tail = A. One node, zero pointer writes on existing nodes.',
        'Insert B at the tail: create node B with prev = A, next = null. Set A.next = B (1 pointer write on an existing node). Set tail = B. The list is now: null <-- A <--> B --> null. Insert C at the tail: create node C with prev = B, next = null. Set B.next = C. Set tail = C. The list is: null <-- A <--> B <--> C --> null. Three nodes, each pair satisfies the bidirectional invariant: A.next === B and B.prev === A; B.next === C and C.prev === B.',
        'Delete B. Read B.prev = A and B.next = C. Set A.next = C (was B). Set C.prev = A (was B). Two pointer writes. B is bypassed. The list is now: null <-- A <--> C --> null. Traverse forward: A, C. Traverse backward: C, A. The chain invariant holds: A.next === C and C.prev === A. Node B\'s stale pointers (prev = A, next = C) are irrelevant -- B is unreachable from head or tail.',
        'Insert D after A. Capture neighbors: predecessor = A, successor = A.next = C. Create node D with prev = A, next = C. Set A.next = D (was C). Set C.prev = D (was A). Four pointer writes total. The list is now: null <-- A <--> D <--> C --> null. Forward traversal: A, D, C. Backward traversal: C, D, A. Every adjacent pair satisfies the invariant. Total cost of all operations: O(1) each, 10 pointer writes across 3 inserts and 1 delete, zero traversals.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Knuth, The Art of Computer Programming, Volume 1, Section 2.2.5 derives the pointer-surgery operations for doubly linked and circular lists with full correctness arguments. The Linux kernel\'s include/linux/list.h is the most widely deployed implementation: a circular doubly linked list using macros and container_of, powering process scheduling, timer queues, filesystem caches, and device driver chains.',
        'Prerequisite: Singly Linked List. Understand forward-only traversal and the predecessor problem before studying the doubly linked variant. If the singly linked list\'s O(n) deletion cost at a known position is not clear, the motivation for adding prev pointers will not land.',
        'Primary extension: LRU Cache. The classic design pairs a hash table for O(1) lookup with a doubly linked list for O(1) eviction and promotion. This is the highest-value application and the most common interview question involving doubly linked lists. Implementing it from scratch is the best way to internalize why prev pointers matter.',
        'Alternatives worth comparing: Skip List adds multiple levels of forward pointers to recover O(log n) search over a sorted sequence. Deque (double-ended queue) can be backed by a doubly linked list or a circular buffer -- the comparison reveals the cache-locality vs. flexibility trade. XOR linked list stores prev XOR next in a single pointer field, halving pointer memory at the cost of requiring manual memory management (it blocks garbage collectors that need to trace individual pointers).',
      ],
    },
  ],
};
