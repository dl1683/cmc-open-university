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
        ? `Insert ${values[i]}: the list was empty, so the new node becomes the head. The head pointer is the only way in — lose it and you lose the whole list.`
        : `Append ${values[i]}: walk from the head past ${i} node${i === 1 ? '' : 's'} to the tail, create the new node, and aim the old tail's next pointer at it. (Keeping a tail pointer would make this O(1).)`,
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
      explanation: `Looking for ${target} to remove it. ${i === 0 ? 'Start at the head' : `Follow the next pointer to node ${i}`}: is ${list[i].value} the one? ${isMatch ? 'Yes.' : 'No — keep following pointers.'} Unlike an array, there is no jumping to position k: pointers only go forward.`,
    };
    if (isMatch) { foundIndex = i; break; }
  }

  if (foundIndex === -1) {
    yield {
      state: sequenceState('linked-list', list),
      highlight: { visited: list.map((n) => n.id) },
      explanation: `Reached the end (∅) without finding ${target} — nothing to remove. A full traversal like this is the O(n) cost of searching a linked list.`,
    };
    return;
  }

  const removed = list[foundIndex];
  const prev = list[foundIndex - 1] ?? null;
  yield {
    state: sequenceState('linked-list', list),
    highlight: { removed: [removed.id], active: prev ? [prev.id] : [] },
    explanation: prev
      ? `To remove ${removed.value}, no data moves at all: node ${prev.value} simply re-aims its next pointer PAST the removed node. One pointer change — that is the entire operation.`
      : `Removing the head (${removed.value}) is even simpler: the head pointer moves to the second node. One pointer change.`,
  };

  list.splice(foundIndex, 1);
  yield {
    state: sequenceState('linked-list', list),
    highlight: prev ? { active: [prev.id] } : {},
    explanation: `${removed.value} is gone and the chain is whole again. Compare with an array, where removing from the middle means shifting everything after it. Pointer surgery is the linked list's whole advantage.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A linked list stores values in nodes, and each node points to the next node in the chain. Unlike an array, the nodes do not need to sit next to each other in memory. The first node is reached through a head reference; from there, every step follows a next pointer. Lose the head, and the rest of the structure becomes unreachable even though the nodes may still exist in memory.`,
        `The design trades random access for cheap rewiring. An array can jump to index 500 in O(1) because the address is computed from the base address plus an offset. A linked list must walk 500 pointers to get there. But if you already know where a change belongs, insertion can be as small as one new node and one pointer update. That is why this structure shows up whenever order matters but shifting a large array would be wasteful.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Insertion at the head is the simplest operation: create a node, point it at the old head, and move the head reference to the new node. Appending at the tail is O(n) if you only store head, because you must walk until next is null. If you also store a tail reference, append becomes O(1). Queue implementations often keep both head and tail for exactly this reason.`,
        `Removal depends on what reference you already have. In a singly linked list, removing a middle node in O(1) requires the previous node, because the previous node's next pointer must skip over the removed node. If you only have a value, you must search from head first, so the whole operation is O(n). A doubly linked list stores both next and previous pointers, spending more memory so removal from a known node is easier.`,
        `Searching is always a traversal. At each node, compare the value and either stop or follow next. There is no Binary Search shortcut because there is no direct jump to the middle. Even if the values are sorted, reaching the middle still costs pointer walks.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Head insertion and head removal are O(1). Tail append is O(1) only with a tail pointer; otherwise it is O(n). Search, index lookup, and remove-by-value are O(n). Space is O(n), but each node stores at least one extra pointer, so the constant factor is larger than an array. Big-O Growth Rates explains the asymptotic trade, but real machines add another cost: arrays usually win cache locality because nearby values sit in nearby memory, while nodes may be scattered across the heap.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Stack can be implemented with the head as the top, giving O(1) push and pop. Queue can be implemented with head as the front and tail as the back. LRU Cache famously combines Hash Table with a doubly linked list: the table finds an item in O(1), and the list moves it to the most-recent end or evicts the least-recent end in O(1).`,
        `Graphs often store adjacency lists: each vertex points to the neighbors it can reach. Tree Traversals and Graph BFS both rely on the idea of following references from one object to the next, although their shapes branch instead of forming one chain. Skip List extends the same base idea with extra forward pointers, creating fast "express lanes" over a sorted chain.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest misconception is that linked structures are automatically faster because insertion sounds O(1). That is only true after you already have the right position. If you must search first, the search dominates. Another common bug is pointer order during insertion or deletion: if you overwrite the only reference to the next node before saving it, you orphan the rest of the chain.`,
        `Be careful with memory, too. Each node carries pointer overhead, allocation overhead, and worse cache behavior than an array. In high-performance code, that can make a theoretically worse array operation faster in practice. Use this structure when stable references, frequent end operations, or O(1) known-node removal matter more than random access.`,
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
