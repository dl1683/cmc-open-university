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
        'Each rectangle is a node holding a value. Rightward arrows are next pointers; leftward arrows are prev pointers. The head label marks the first node; the tail label marks the last. Active (highlighted) nodes are being inspected or modified. Visited nodes have already been checked during a search pass.',
        {type: 'callout', text: 'The extra prev pointer buys O(1) removal at a known node by making both neighbors directly reachable.'},
        'Watch the build phase first. Each new node arrives at the tail. Two arrows appear: a forward arrow from the old tail to the new node, and a backward arrow from the new node to the old tail. Those two pointer writes are the entire cost of an append.',
        'During removal, the target node lights up along with its two neighbors. The neighbors\' arrows redirect to point at each other, bypassing the target. The target disappears. No other node moves. That two-pointer rewire is what makes deletion O(1) when you already hold a reference to the node.',
        'During reverse traversal, the animation follows prev pointers from tail to head. Every node is reachable from either end. A singly linked list could not do this without a full reversal or an auxiliary stack.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A singly linked list can only move forward. Removing a node requires its predecessor, and reaching that predecessor costs O(n) because no backward pointer exists. When you already hold a reference to the node you want to delete, that O(n) walk is pure waste.',
        'The doubly linked list adds a prev pointer to every node. Any node can now reach both neighbors in O(1). Deletion becomes two pointer writes instead of an O(n) search for the predecessor. Traversal works in both directions.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Doubly-linked-list.svg/960px-Doubly-linked-list.svg.png', alt: 'Doubly linked list nodes connected by previous and next arrows', caption: 'The diagram shows why deletion can be local: the removed node already names both neighbors. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Doubly-linked-list.svg.'},
        'This matters whenever a system needs fast removal at arbitrary positions. An LRU cache must move accessed entries to the front and evict entries from the back, all in O(1). A text editor must insert and delete at the cursor without shifting the rest of the document. Browser history must go forward and back. Each of these patterns breaks down if deletion requires a traversal.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A singly linked list is the natural starting point. Each node stores a value and a next pointer. Insertion at the head is O(1). Traversal from head to tail works by following next pointers. The structure is simple: one pointer per node, minimal memory overhead.',
        'For stacks and queues that only touch the ends, a singly linked list is enough. Push and pop at the head are both O(1). Append at the tail is O(1) if you keep a tail pointer. The simplicity is a real advantage, and for end-only access patterns there is no reason to add more machinery.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Singly linked list deletion requires the predecessor. To remove node X, you must set predecessor.next = X.next. But X does not know its predecessor. The only way to find it is to walk from the head, checking each node\'s next pointer until you find the one pointing to X. That walk costs O(n).',
        'You also cannot traverse backward. If you are at node X and need the previous node, you must restart from the head. There is no backward path.',
        'These two limitations compound in combination data structures. An LRU cache pairs a hash table (O(1) lookup) with a linked list (recency order). The hash table gives you a direct pointer to a node. If removing that node costs O(n) because you need the predecessor, the entire cache degrades from O(1) to O(n). The singly linked list becomes the bottleneck.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each node stores three fields: data, prev (pointer to predecessor), and next (pointer to successor). The list maintains a head pointer to the first node and a tail pointer to the last.',
        'Insertion between two nodes A and B requires four pointer updates. Save both neighbors first. Set new.prev = A. Set new.next = B. Set A.next = new. Set B.prev = new. Order matters: if you overwrite A.next before reading it to find B, you lose B. Always capture both neighbors before writing any pointer.',
        'Insertion at the tail is a special case: A is the current tail, B is null. Set new.prev = tail. Set new.next = null. Set tail.next = new. Update the tail pointer to new. Two pointer writes on existing nodes, plus the tail pointer update.',
        'Insertion at the head is symmetric: A is null, B is the current head. Set new.next = head. Set new.prev = null. Set head.prev = new. Update the head pointer to new.',
        'Deletion of node X (with predecessor P and successor N): set P.next = N and N.prev = P. Two pointer writes. The removed node is bypassed. If X is the head, there is no P, so just set head = N and N.prev = null. If X is the tail, set tail = P and P.next = null.',
        'Sentinel nodes eliminate edge cases. A dummy head before the first real node and a dummy tail after the last real node guarantee that every real node always has non-null prev and next. Insertion and deletion never need to special-case the ends. The general-case code handles every case.',
        'Search is still O(n). Following prev from the tail or next from the head both visit nodes one at a time. The extra pointer speeds up structural modification, not lookup.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on the bidirectional chain invariant: for every adjacent pair (A, B), A.next === B and B.prev === A. Every operation preserves this invariant.',
        'Insertion creates a new node and wires it to both neighbors. The four pointer writes replace the single link A-B with two links: A-new and new-B. Both new links satisfy the invariant by construction.',
        'Deletion reconnects the two neighbors of the removed node. P.next changes from X to N. N.prev changes from X to P. The resulting link P-N satisfies the invariant. The removed node\'s stale pointers are irrelevant because it is no longer reachable from head or tail.',
        'Two pointers per node give bidirectional traversal. Any node can reach its predecessor in O(1). That direct predecessor access is why deletion at a known position costs O(1) instead of O(n).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert or remove at head: O(1). Insert or remove at tail: O(1). Insert or remove at a known position, given a pointer to the node: O(1). Search by value: O(n). Access by index: O(n), starting from whichever end is closer.',
        'Space is O(n), with two pointers per node instead of one. On a 64-bit system, each node carries 16 bytes of pointer overhead (prev + next) compared to 8 bytes for a singly linked list. For nodes holding a single integer, the pointers use more memory than the data itself. For nodes holding large objects, the extra 8 bytes is negligible.',
        'Doubling the input doubles the traversal time for search and index access. Insert and delete at known positions stay O(1) regardless of list size. The structure scales well for modification-heavy workloads and poorly for lookup-heavy ones.',
        'Cache behavior is poor. Nodes are heap-allocated at scattered addresses. Sequential traversal triggers a cache miss at nearly every step. Arrays store elements contiguously and win decisively for sequential scans. The doubly linked list trades cache locality for O(1) structural modification at arbitrary positions.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'LRU cache. A hash table maps keys to list nodes for O(1) lookup. The doubly linked list maintains recency order. On access, detach the node from its current position (two pointer writes) and move it to the head (two more pointer writes). On eviction, remove the tail node. Without prev pointers, detaching a node from the middle would require an O(n) predecessor search.',
        'Browser forward/back history. Each visited page is a node. The current page has a prev pointer (back button) and a next pointer (forward button). Visiting a new page inserts after the current node and discards the forward chain. Bidirectional traversal maps directly to the navigation model.',
        'Undo/redo in text editors. Each edit operation is a node. Undo follows prev; redo follows next. The list supports arbitrary insertion and deletion of edit records as the user types, undoes, and branches.',
        'OS thread scheduling. The Linux kernel uses a circular doubly linked list (list.h) for ready queues, timer lists, and driver chains. The container_of macro embeds list nodes inside arbitrary structs with zero extra allocation. Threads are inserted, removed, and reordered constantly; O(1) modification at known positions is essential.',
        'Music playlists and document navigation. Any interface where the user moves forward and backward through an ordered collection benefits from bidirectional traversal without maintaining a separate index.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Double the pointer overhead of a singly linked list. Each node pays 16 bytes for two pointers instead of 8. For bulk storage of small values (integers, characters), the overhead dominates the actual data. Arrays or singly linked lists are more memory-efficient.',
        'Search is still O(n). The prev pointer does not help find a value faster. If the workload is dominated by lookups, a hash table or balanced tree is the right choice. The doubly linked list only speeds up modification, not search.',
        'Cache-unfriendly. Nodes are scattered across the heap. Every pointer follow is a potential cache miss. For sequential scans, arrays outperform linked lists by an order of magnitude on modern hardware because of prefetching and spatial locality.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/1D_array_diagram.svg/250px-1D_array_diagram.svg.png', alt: 'One-dimensional array diagram with adjacent indexed cells', caption: 'The array contrast matters: contiguous indexed cells are faster to scan even though interior deletion is expensive. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:1D_array_diagram.svg.'},
        'Arrays beat it for most use cases. If insertions and deletions happen mostly at the ends, a dynamic array or deque backed by a circular buffer is simpler and faster. The doubly linked list only wins when you need O(1) removal at arbitrary interior positions and you hold direct pointers to nodes.',
        'Concurrency is hard. A single removal touches three nodes: the target and its two neighbors. Lock-free doubly linked lists exist but are notoriously difficult to implement correctly. Most production code uses a mutex or avoids shared mutable lists.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Build list [A, B, C]. Start empty: head = null, tail = null. Insert A: head = A, tail = A, A.prev = null, A.next = null. Insert B: set B.prev = A, B.next = null, A.next = B, tail = B. Insert C: set C.prev = B, C.next = null, B.next = C, tail = C. The list is: null <- A <-> B <-> C -> null.',
        'Delete B. Read B.prev = A, B.next = C. Set A.next = C (was B). Set C.prev = A (was B). Two pointer writes. B is bypassed. The list is now: null <- A <-> C -> null. Traverse forward: A, C. Traverse backward: C, A. The chain invariant holds in both directions.',
        'Insert D after A. Save neighbors: predecessor = A, successor = C (which is A.next). Set D.prev = A. Set D.next = C. Set A.next = D (was C). Set C.prev = D (was A). Four pointer writes. The list is now: null <- A <-> D <-> C -> null. Traverse forward: A, D, C. Traverse backward: C, D, A.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Knuth, The Art of Computer Programming, Volume 1, Section 2.2.5 derives the pointer-surgery operations for doubly linked and circular lists. The Linux kernel\'s list.h is the most widely deployed implementation: a circular doubly linked list built with macros and the container_of trick, used for process scheduling, timer queues, and filesystem caches.',
        'Prerequisite: Singly Linked List. Understand forward-only traversal and the predecessor problem first. If the singly linked list\'s deletion limitation is not clear, the motivation for the doubly linked list will not land.',
        'Natural extension: LRU Cache. The classic design pairs a hash table for O(1) lookup with a doubly linked list for O(1) eviction and promotion. This is the killer application and the most common interview question involving doubly linked lists.',
        'Alternatives: Skip List recovers O(log n) search over a sorted linked structure by adding multiple forward pointer levels. Deque (double-ended queue) can be backed by a doubly linked list or a circular buffer; the comparison reveals when each wins. XOR linked list stores prev XOR next in a single pointer field, halving pointer memory at the cost of blocking garbage collection.',
      ],
    },
  ],
};
