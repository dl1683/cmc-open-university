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
        'Each rectangle is a node, meaning a separately allocated record that stores a value and at least one pointer. A pointer is a reference to another node. The head pointer is the entry to the chain, and null marks the end.',
        'The animation is about arrows, not boxes. An active node is the one being inspected or rewired. A visited node has already been passed during traversal. A structural change happens only when a next pointer changes target.',
        {type: 'callout', text: 'A linked list makes order explicit in pointers, so insertion can be cheap only when the code already holds the right node reference.'},
        {type: 'image', src: './assets/gifs/linked-list.gif', alt: 'Animated walkthrough of the linked list visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A linked list exists for ordered data that changes shape through local insertions and removals. Arrays keep order by placing elements next to each other in memory, which makes indexing cheap. That same contiguous layout makes middle insertion expensive because later elements must move.',
        'A linked list separates logical order from physical memory location. Nodes can live anywhere on the heap, and pointers define the sequence. This helps when code already has the insertion or removal point and wants to avoid shifting a large suffix.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is an array. Arrays are compact, cache-friendly, and give O(1) access by index because element k is at base address plus k times element size. For most sequential data, that is the right default.',
        'Dynamic arrays also handle appends well. They reserve extra capacity, grow when needed, and copy into a larger block only occasionally. If most changes happen at the end, the amortized append cost is O(1).',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Middle insertion is the wall. Inserting at position 0 in a 10000-element array moves 10000 elements to the right. Removing position 0 moves 9999 elements left. The operation preserves contiguous order by moving bytes.',
        'The wall gets worse when other code holds references into the sequence. Reallocation can move the whole array to a new memory block. Systems that need stable node identity or frequent local splicing need another layout.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Order can be stored as links instead of placement. A node points to its successor, so adding a node after A means pointing the new node at the old successor and then pointing A at the new node. No existing value moves.',
        'The price is that position is no longer arithmetic. The fifth node is not at base plus 5 times element size. To reach it, code must start at head and follow four pointers.',
      ],
    },    {
      heading: 'How it works',
      paragraphs: [
        'A singly linked list stores value and next in every node. The last node has next = null. Insert at head by setting new.next to the old head and then moving head to the new node.',
        'Insert after a known node A by setting new.next = A.next, then A.next = new. Remove after A by setting A.next = A.next.next. Removing the head is the special case where head moves to head.next.',
        'A doubly linked list adds prev pointers. That extra pointer lets code remove a known node without first finding its predecessor. Sentinel head and tail nodes can remove many null edge cases.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg', alt: 'Linked list nodes connected by arrows ending at null.', caption: 'A singly linked list is a chain of nodes connected by next pointers; the arrows are the structure. Source: Wikimedia Commons, Lasindi, public domain.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that following next pointers from head visits exactly the live nodes in order and eventually reaches null. Insertion preserves the invariant because the new node first adopts the old successor, then the predecessor points to the new node. No suffix node becomes unreachable.',
        'Removal preserves the invariant because the predecessor skips the target and points directly to the target successor. Nodes before and after the target keep their relative order. The removed node may still exist in memory, but it is no longer reachable from head.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert or remove at head is O(1). Insert or remove after a known node is O(1). Search and access by index are O(n) because the list must traverse from head. Append is O(1) with a tail pointer and O(n) without one.',
        'When n doubles, traversal time doubles, but known-position rewiring stays constant. Space is O(n), with one pointer per node for singly linked lists and two for doubly linked lists. For small values, pointer metadata can exceed the payload.',
        'Cache behavior is the hidden cost. Array elements sit next to each other, so hardware prefetching helps scans. Linked nodes may be scattered across memory, so every next pointer can trigger a cache miss.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LRU caches combine a hash map with a doubly linked list. The hash map finds an item in O(1), and the list moves that item to the front in O(1). Eviction removes the tail in O(1).',
        'Memory allocators use free lists, where unused memory blocks contain pointers to the next free block. Operating systems and runtimes also use intrusive lists when objects already exist and the link fields can live inside those objects. The access pattern is local splice, not random indexing.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Linked lists fail for random access. Binary search, quicksort partitioning by index, and matrix-like traversal all need fast indexing or tight memory locality. A list gives neither.',
        'They also fail when memory overhead or pointer bugs dominate. Updating links in the wrong order can orphan the tail, create a cycle, or leave a dangling reference. In many real workloads, an array with O(n) shifting beats a linked list because cache locality wins.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/40/1D_array_diagram.svg', alt: 'One-dimensional array diagram with contiguous indexed cells.', caption: 'Arrays win random access because an index maps to a predictable offset; linked lists give up that arithmetic shortcut. Source: Wikimedia Commons, Tropwine, CC BY 4.0.'},
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with 7 -> 3 -> 12 and remove 3. Head points to 7. The node 7 points to 3, and 3 points to 12.',
        'Scan from head. Compare 7 and keep it as predecessor. Move to 3 and find the target. Set predecessor.next, which is 7.next, to target.next, which is 12. The chain is now 7 -> 12, and no values shifted.',
        'Insert 5 after 7. Set 5.next to 7.next, currently 12. Then set 7.next to 5. The chain becomes 7 -> 5 -> 12 with two pointer writes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Knuth, The Art of Computer Programming, Volume 1, Section 2.2 for linked allocation and list manipulation. Study Newell, Shaw, and Simon for the early history of linked structures in symbolic processing.',
        'Study next by contrast. Arrays explain contiguous layout. Stacks and queues show head-only and head-plus-tail use. Doubly linked lists explain known-node removal. LRU cache shows why a list often needs a hash table beside it.',
      ],
    },
  ],
};
