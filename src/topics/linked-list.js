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
        ? `Insert ${values[i]}: the list was empty, so this node becomes the head. The head pointer is the only entry point; lose it and the chain is unreachable.`
        : `Append ${values[i]}: without a tail pointer, the list must walk from head to the last node before it can attach the new one. Keeping a tail pointer would make append O(1).`,
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
      explanation: `Looking for ${target} to remove it. ${i === 0 ? 'Start at the head' : `Follow the next pointer to node ${i}`}: ${list[i].value} ${isMatch ? 'matches.' : 'does not match, so keep following pointers.'} Unlike an array, there is no jump to position k.`,
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
      ? `To remove ${removed.value}, no data moves. Node ${prev.value} re-aims its next pointer past the removed node, so one pointer change repairs the chain.`
      : `Removing the head (${removed.value}) is even simpler: the head pointer moves to the second node. One pointer change.`,
  };

  list.splice(foundIndex, 1);
  yield {
    state: sequenceState('linked-list', list),
    highlight: prev ? { active: [prev.id] } : {},
    explanation: `${removed.value} is gone and the chain is whole again. Arrays pay for middle removal by shifting later items; linked lists pay earlier by finding the right pointer.`,
  };
}

export const article = {
  sections: [
    {
      heading: `Why this exists`,
      paragraphs: [
        `Linked lists exist for ordered data that changes by relinking rather than shifting. An array stores items next to each other, so inserting or removing in the middle can move many later items. A linked list stores separate nodes and connects them with pointers, so a known position can be changed by rewiring references.`,
        `The first node is reached through a head reference. From there, every step follows next. Lose the head and the rest of the chain becomes unreachable even if the nodes still exist in memory. That pointer ownership is the structure's main idea and its main danger.`,
      ],
    },
    {
      heading: `The obvious approach and the wall`,
      paragraphs: [
        `The obvious approach is an array. Arrays are excellent when you need index lookup, compact storage, and cache-friendly scans. The wall appears when many insertions or removals happen near the front or middle, because the array must preserve contiguous order by shifting items.`,
        `A linked list removes the shift by giving every item its own node. The tax is traversal. There is no formula for "the address of index 500" because node 500 could be anywhere in memory. To reach it, you must follow 500 pointers.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `The core insight is that order can live in pointers instead of physical adjacency. A node does not need to know the whole list. It only needs a value and a pointer to the next node. Changing the list means changing which node a pointer names.`,
        `That is why linked-list performance always depends on the reference you already have. Inserting after a known node is O(1). Removing a known node from a doubly linked list is O(1). Removing by value from a singly linked list is O(n) because you must first find the previous node.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `Read each frame as a pointer story, not as boxes moving around a screen. During append, the active node is the one just created, but the hidden cost is the walk to the tail when no tail pointer is stored. During search, every visited node is evidence that a linked list cannot skip ahead by index. During removal, the important moment is the predecessor changing its next pointer.`,
        `The animation is deliberately small because the rules do not change at large size. If the target is 12 in 7 -> 3 -> 12 -> 9 -> 5, the list must inspect 7, then 3, then 12. Once it finds 12, the node holding 3 points directly to the node holding 9. The value 12 is not shifted out of a contiguous block; it is simply no longer reachable from head.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Head insertion is the simplest operation: create a node, point it at the old head, and move head to the new node. Appending at the tail is O(n) if you store only head, because you must walk until next is null. If you also store tail, append becomes O(1). Queue implementations keep both head and tail for exactly this reason.`,
        `Removal in a singly linked list needs the previous node. To remove current, set previous.next to current.next. Removing the head is a special case because there is no previous node; head moves to the second node. A doubly linked list stores both next and previous pointers, spending more memory so known-node removal is easier.`,
        `Searching is always a traversal. At each node, compare the value and either stop or follow next. There is no binary-search shortcut because there is no direct jump to the middle. Even sorted values do not help much if reaching the middle still costs pointer walks.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Correctness comes from preserving the chain invariant: starting at head and following next pointers should visit exactly the live nodes in order and eventually stop. Insertion is correct when the new node points to the old successor and the previous pointer points to the new node. No reachable node is lost.`,
        `Removal is correct when the predecessor skips the removed node and points to the removed node's successor. The removed node is no longer reachable from head, and every node before and after it remains in the same order.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `Take the list 7 -> 3 -> 12 -> 9 -> 5 and remove 12. The search phase starts at head because the value 12 could be anywhere. It compares 7, follows next to 3, compares 3, then follows next to 12. At that point the operation has enough information: current is the node to remove and previous is the node that must be rewired.`,
        `The actual deletion is one assignment: previous.next = current.next. After that assignment, head still reaches 7, then 3, then 9, then 5. The removed node might still exist until garbage collection or manual deallocation, but it is outside the logical list. This distinction between physical memory and reachability is central to every pointer-based structure in the course.`,
      ],
    },
    {
      heading: `Cost and tradeoffs`,
      paragraphs: [
        `Head insertion and head removal are O(1). Tail append is O(1) only with a tail pointer; otherwise it is O(n). Search, index lookup, and remove-by-value are O(n). Space is O(n), but each node stores at least one extra pointer, so the constant factor is larger than an array.`,
        `Real machines add another cost: arrays usually win cache locality because nearby values sit in nearby memory, while linked nodes may be scattered across the heap. Big-O Growth Rates explains the asymptotic trade, but cache behavior often decides the winner for small and medium data.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Stack can be implemented with the head as the top, giving O(1) push and pop. Queue can be implemented with head as the front and tail as the back. LRU Cache famously combines Hash Table with a doubly linked list: the table finds an item in O(1), and the list moves it to the most-recent end or evicts the least-recent end in O(1).`,
        `Graphs often store adjacency lists: each vertex points to the neighbors it can reach. Tree Traversals and Graph BFS both rely on the idea of following references from one object to the next, although their shapes branch instead of forming one chain. Skip List extends the same base idea with extra forward pointers, creating fast "express lanes" over a sorted chain.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The biggest misconception is that linked structures are automatically faster because insertion sounds O(1). That is only true after you already have the right position. If you must search first, the search dominates. Another common bug is pointer order during insertion or deletion: if you overwrite the only reference to the next node before saving it, you orphan the rest of the chain.`,
        `Be careful with memory, too. Each node carries pointer overhead, allocation overhead, and worse cache behavior than an array. In high-performance code, that can make a theoretically worse array operation faster in practice. Use this structure when stable references, frequent end operations, or O(1) known-node removal matter more than random access.`,
      ],
    },
    {
      heading: `Complete case study`,
      paragraphs: [
        `An LRU Cache shows the linked-list trade clearly. The system needs to find a cached item by key, move it to the most-recent end, and evict the least-recent item when capacity is full. A Hash Table finds the node by key in O(1). A doubly linked list moves that known node or removes the tail in O(1).`,
        `A plain array is weaker for this case. Finding the key by scan is O(n), and moving a middle item to the end shifts other entries. A linked list alone is also not enough because lookup by key would still be O(n). The complete design works because the hash table supplies location and the list supplies cheap reordering.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Stack and Queue to see the two cleanest uses of head and tail pointers. Then read LRU Cache for the classic interview design that fuses Hash Table lookup with linked-list eviction. Skip List shows how extra pointers can recover logarithmic search, while Tree Traversals and Graph BFS generalize pointer walking to branching structures.`,
      ],
    },
  ],
};
