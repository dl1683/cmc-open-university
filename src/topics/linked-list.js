// Linked list: nodes connected by pointers. Nothing is contiguous;
// every structure change is just re-aiming a pointer.

import { sequenceState, parseNumberList, parseNumber } from '../core/state.js';

export const topic = {
  id: 'linked-list',
  title: 'Linked List',
  category: 'Data Structures',
  summary: 'Build a list by appending, then search it and remove a node by re-linking.',
  controls: [
    { id: 'values', label: 'Build with', type: 'number-list', defaultValue: '7, 3, 12, 9, 5' },
    { id: 'target', label: 'Then remove', type: 'number', defaultValue: '12' },
  ],
  run,
};

export function* run(input) {
  const values = parseNumberList(input.values, { max: 8 });
  const target = parseNumber(input.target, { label: 'a value to remove' });
  const list = []; // index 0 = head; the renderer draws the pointer arrows

  for (let i = 0; i < values.length; i += 1) {
    list.push({ id: `n${i}`, value: values[i] });
    yield {
      state: sequenceState('linked-list', list),
      highlight: { active: [`n${i}`] },
      explanation: i === 0
        ? `Insert ${values[i]}: the list was empty, so this node becomes the head. The head pointer is the only entry point into the chain; lose it and the chain is unreachable. The tail is null until another node is appended.`
        : `Append ${values[i]} at tail: without a tail pointer, the code must walk from head through every node to reach the last one before attaching. This is the O(n) cost of append without tail pointer optimization.`,
      invariant: 'Each node knows only one thing about the rest of the list: where the next node is.',
    };
  }

  // search for the value to remove, showing the traversal
  let foundIndex = -1;
  for (let i = 0; i < list.length; i += 1) {
    const isMatch = list[i].value === target;
    yield {
      state: sequenceState('linked-list', list),
      highlight: { active: [list[i].id], visited: list.slice(0, i).map((n) => n.id) },
      explanation: `Search step ${i + 1}/${list.length}: checking node with value ${list[i].value}. ${i === 0 ? 'The head pointer gives the starting node.' : 'Follow the next pointer from the previous node.'} ${isMatch ? 'Match found -- will remove this node.' : 'No match, so follow next pointer to continue search. There is no arithmetic shortcut to any position; every step is a pointer follow.'} This is O(n) worst case: every node may need inspection before finding the target or confirming absence.`,
    };
    if (isMatch) { foundIndex = i; break; }
  }

  if (foundIndex === -1) {
    yield {
      state: sequenceState('linked-list', list),
      highlight: { visited: list.map((n) => n.id) },
      explanation: `Reached the end without finding ${target}. Nothing can be removed because every node was checked, which is the O(n) search cost of a linked list.`,
    };
    return;
  }

  const removed = list[foundIndex];
  const prev = list[foundIndex - 1] ?? null;
  yield {
    state: sequenceState('linked-list', list),
    highlight: { removed: [removed.id], active: prev ? [prev.id] : [] },
    explanation: prev
      ? `Removing node at index ${foundIndex} (value ${removed.value}): no array elements shift. The predecessor at index ${foundIndex - 1} re-aims its next pointer to skip the target and point directly to the target's successor. One pointer update repairs the chain. The insertion coordinate was ${foundIndex}; removal at that coordinate is O(1) once the predecessor is known.`
      : `Removing the head (value ${removed.value}): the head pointer moves to head.next (the second node). This is the special case for deletion at coordinate 0. One pointer change, no traversal needed.`,
  };

  list.splice(foundIndex, 1);
  yield {
    state: sequenceState('linked-list', list),
    highlight: prev ? { active: [prev.id] } : {},
    explanation: `${removed.value} is unlinked and the chain is intact. Arrays pay O(n) to shift bytes when removing from the middle; linked lists pay O(n) to find the right pointer during search, then O(1) to re-link. The tradeoff is explicit: search is expensive because pointers give no arithmetic shortcut.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each rectangle is a node. The number inside is the stored value. Arrows between nodes are next pointers -- the only thing connecting one node to the next. The leftmost node is the head; the chain ends where the last arrow would point to null.',
        'An active (highlighted) node is the one the algorithm is currently inspecting or creating. Visited nodes have already been checked and passed over. A removed node is the one being unlinked from the chain. Watch the arrows, not the boxes: every structural change in a linked list is an arrow being redirected.',
        {type: 'callout', text: 'A linked list makes order explicit in pointers, so insertion can be cheap only when the code already holds the right node reference.'},
      
        {type: 'image', src: './assets/gifs/linked-list.gif', alt: 'Animated walkthrough of the linked list visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Allen Newell, Cliff Shaw, and Herbert Simon invented linked allocation in 1955-56 while building IPL (Information Processing Language) for the Logic Theorist, the first AI program to prove mathematical theorems. They needed a way to represent symbolic expressions whose size could not be predicted at compile time. Their solution: give each piece of data its own block of memory and connect the blocks with address pointers. The idea outlived IPL and became one of the two fundamental ways to organize sequential data, alongside the array.',
        'A linked list solves a specific problem: ordered data that changes shape frequently. When a program needs to insert or delete elements at known positions without touching the rest of the collection, pointer re-aiming costs O(1). No elements shift. No reallocation. The structure grows and shrinks one node at a time, using exactly as much memory as it currently needs.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Store elements in an array. Arrays place values in contiguous memory, one after another. This layout gives O(1) random access: the address of element k is base + k * element_size, a single arithmetic operation. Scanning is fast because modern CPUs load cache lines of 64 bytes at a time, so reading element k pre-loads several neighbors for free.',
        'Arrays are the right default for most sequential data. They are compact (no per-element overhead beyond the value itself), cache-friendly, and supported by every language and hardware platform.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Inserting into the middle of an array forces every later element to shift one position right to preserve contiguous order. Deleting from the middle forces every later element to shift left. Both operations are O(n). For a 10,000-element array, inserting at position 0 moves all 10,000 values.',
        'Resizing hits the same wall from a different angle. When a dynamic array runs out of capacity, it allocates a larger block and copies everything over. The amortized cost is O(1) per append, but the single worst-case copy can be expensive in latency-sensitive code, and the new block temporarily doubles memory usage.',
        'These costs are acceptable when insertions and deletions cluster at the end. They become painful when the workload demands frequent changes at the front or middle, or when the data must never relocate in memory because other parts of the system hold pointers into it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Order lives in the pointers, not in the memory layout. An array places values next to each other in a predetermined sequence; changing that sequence requires moving bytes. A linked list decouples the logical order from the physical layout by storing only one piece of information per node: where the next node lives. The head pointer gives entry to the chain; every subsequent node is reached by following pointers.',
        'This means insertion at a known position is one pointer update: set the new node\'s next to point to the old successor, then have the predecessor point to the new node. No elements shift. No bytes move. The cost is O(1) provided the code already holds the right node reference.',
        'The tradeoff is access. Array element k lives at address base + k * element_size, computable without looking at any other elements. Linked list node k requires k pointer follows, one after another, because there is no arithmetic shortcut to a node\'s address. Every lookup is a traversal.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "A singly linked list stores each element in a separate node. Every node holds two things: a value and a next pointer to the following node. The last node's next pointer is null. A head pointer provides the only entry point into the chain.",
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg', alt: 'Linked list nodes connected by arrows ending at null.', caption: 'A singly linked list is a chain of nodes connected by next pointers; the arrows are the structure. Source: Wikimedia Commons, Lasindi, public domain.'},
        'Insert at head: create a new node, set its next to the current head, move head to the new node. Two pointer operations, O(1). Insert at a known position: given a reference to node A, create a new node N, set N.next = A.next, set A.next = N. Again O(1) -- no traversal needed because the position is already known.',
        'Delete a node: given the predecessor, set predecessor.next = target.next. The target is now unreachable from head and can be freed. Deleting the head is a special case: move head to head.next.',
        "Search: start at head, compare each node's value, follow next until a match or null. O(n) in the worst case. There is no shortcut -- even if the list is sorted, reaching the middle requires n/2 pointer follows.",
        'A doubly linked list adds a prev pointer to every node. This costs an extra pointer per node but lets you delete a node in O(1) given only a reference to that node, without needing its predecessor. Sentinel (dummy) nodes at the head and tail of a doubly linked list eliminate edge cases: insert and delete never need to check whether the predecessor or successor is null, because the sentinels are always there.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on the chain invariant: starting at head and following next pointers visits exactly the live nodes in order and terminates at null. Every operation must preserve this invariant.',
        'Insertion preserves the chain because the new node adopts the old successor (N.next = A.next) before the predecessor adopts the new node (A.next = N). The order matters: if A.next were overwritten first, the reference to the old successor would be lost and the tail of the list would be orphaned.',
        "Deletion preserves the chain because the predecessor skips directly to the removed node's successor. Every node before and after the removed node keeps its position and reachability. The removed node may still exist in memory until garbage collection or manual deallocation, but it is outside the logical chain.",
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert or delete at head: O(1). Insert or delete at a known position (pointer in hand): O(1). Append at tail: O(1) with a tail pointer, O(n) without one. Search or access by index: O(n). Space: O(n), but with per-node overhead -- each singly linked node stores one pointer (8 bytes on 64-bit systems), each doubly linked node stores two (16 bytes). For small values like integers, the pointers can exceed the data itself.',
        'When n doubles, search time doubles. Insert and delete at known positions stay constant. This is the opposite profile from an array, where doubling n keeps random access constant but doubles the worst-case insert cost.',
        "The hidden constant: cache behavior. An array's elements sit in consecutive memory addresses, so traversing them hits the L1 cache almost every time. Linked list nodes are allocated individually on the heap and can land anywhere in memory. Following a next pointer to an arbitrary address typically costs a cache miss -- roughly 5-10ns to L2, 30-50ns to L3, and 100+ ns to main memory. For sequential scans, an array can be 10-50x faster than a linked list of the same length because of this effect alone. Big-O says both scans are O(n), but the constant factor on the linked list is dramatically larger.",
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Operating system process schedulers use doubly linked lists to manage the run queue. Inserting a new process or moving one between priority levels is O(1) with a direct pointer, which matters when the scheduler runs thousands of times per second.',
        'Memory allocators maintain free lists: chains of available memory blocks linked together by pointers embedded in the free blocks themselves. Allocation removes a block from the free list; deallocation inserts it back. No separate tracking structure is needed because the unused memory stores its own links.',
        'LRU caches combine a hash map with a doubly linked list. The hash map provides O(1) key lookup. The doubly linked list provides O(1) move-to-front (on access) and O(1) eviction from the tail (when capacity is full). Neither structure alone is sufficient: a list without the map has O(n) lookup; a map without the list has no efficient way to track recency order.',
        'Undo history in editors is a linked list of states. Each state points to the previous one. Undo follows the backward pointer; redo follows the forward pointer. Branching undo (where the user undoes, then makes a new edit) naturally forks the chain.',
        'Polynomial arithmetic represents each term as a node with a coefficient and exponent. Adding two polynomials merges their sorted linked lists in O(n + m) without preallocating space for every possible exponent.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Random access is O(n). There is no formula for the address of the kth node because nodes are scattered across memory. Any algorithm that needs element[k] repeatedly -- binary search, quicksort partition, matrix operations -- is a poor fit.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/40/1D_array_diagram.svg', alt: 'One-dimensional array diagram with contiguous indexed cells.', caption: 'Arrays win random access because an index maps to a predictable offset; linked lists give up that arithmetic shortcut. Source: Wikimedia Commons, Tropwine, CC BY 4.0.'},
        'Cache hostility is the practical killer. On modern hardware, a sequential scan of 10,000 array elements takes microseconds. The same scan over a linked list can take 10-50x longer because each pointer follow risks a cache miss. Bjarne Stroustrup (creator of C++) demonstrated in 2012 that for sequences under a few thousand elements, arrays with O(n) insertion consistently outperform linked lists with O(1) insertion because the cache advantage of contiguous memory overwhelms the shifting cost.',
        'Pointer overhead is nontrivial. A singly linked node carrying a 4-byte integer spends 8 bytes on the next pointer -- the metadata is twice the payload. A doubly linked node spends 16 bytes on pointers. For large collections of small values, the memory footprint can be 3-5x an equivalent array.',
        'Pointer bugs are a common source of errors. Updating pointers in the wrong order during insert or delete can orphan the tail of the list, create cycles, or leave dangling references. Sentinel nodes and careful ordering (always set the new link before breaking the old one) prevent most of these bugs, but the surface area for mistakes is larger than with arrays.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Build the list 7 -> 3 -> 12, then delete 3. Step by step:',
        'Insert 7. The list is empty, so create a node with value 7 and set head to point to it. Chain: head -> [7] -> null.',
        'Insert 3. Create a node with value 3. Walk from head to the last node (7), set [7].next = [3]. Chain: head -> [7] -> [3] -> null.',
        'Insert 12. Create a node with value 12. Walk from head to the last node (3), set [3].next = [12]. Chain: head -> [7] -> [3] -> [12] -> null.',
        'Delete 3. Start at head. Compare 7 -- no match, but save it as the predecessor candidate. Follow next to 3 -- match found. The predecessor is [7], the target is [3], the successor is [12]. Set [7].next = [12]. Chain: head -> [7] -> [12] -> null. Node [3] is now unreachable from head. One pointer update, zero shifts.',
        'If we had deleted head (7) instead: move head to [3]. Chain: head -> [3] -> [12] -> null. Still one pointer update.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Newell, Shaw, and Simon, "The Logic Theory Machine" (1956) -- introduced linked allocation in IPL for symbolic AI. Knuth, The Art of Computer Programming, Volume 1, Section 2.2 (1997) -- the definitive treatment of linked lists, pointer manipulation, and memory allocation strategies. Stroustrup, "Why you should avoid linked lists" (Going Native 2012) -- empirical demonstration that cache effects dominate asymptotic complexity for moderate-sized collections.',
        'Prerequisites: arrays (contiguous memory and O(1) indexing) and pointer/reference basics (a variable holding the address of another object). If either concept is unclear, the linked-list tradeoff will not make sense.',
        'Study next: Stack and Queue for the two cleanest linked-list applications (head-only and head+tail). Doubly Linked List for the prev-pointer extension enabling O(1) known-node deletion. LRU Cache for the classic design pairing a hash map with a doubly linked list. Skip List for recovering O(log n) search over a sorted linked chain. Hash Table for understanding chaining, where each bucket is a short linked list.',
      ],
    },
  ],
};
