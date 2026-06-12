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
      heading: 'What it is',
      paragraphs: [
        `A linked list is a chain of nodes where each node holds a value and a pointer to the next node. Unlike an array where elements sit in contiguous memory and you can jump to any position in constant time, a linked list chains its elements together logically. You can only reach a node by starting at the head and following pointers one step at a time.`,
        `The shape is simple: each node knows the value it holds and which node comes next. The entire list is defined by a single head pointer — lose that and you lose access to everything. There is no hidden length array underneath, no block of memory you can index into. Everything depends on those pointer links.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `To add a node to the end, you start at the head and follow next pointers until you reach a node whose next pointer is null. Then you create the new node and update that tail node's next pointer to aim at it. Insertion at the head is faster — just create the new node and make it point to the old head, then update the head pointer itself.`,
        `To remove a node from the middle, you first find it by walking from the head, checking each value until you match the target. Once you find it, you take the previous node's next pointer and make it point past the removed node, directly to the node after it. No data moves, no shifts — just one pointer reassignment. If you're removing the head, the head pointer itself moves to the second node.`,
        `Searching is always a walk from the head, one step at a time. If the list has n nodes and your target is at position k, you must make k+1 checks. If it is not in the list at all, you walk the entire length. This is why linked lists have no random access — the only way to know what is at position k is to traverse k pointers.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Insertion at the head is O(1) if you have the head pointer already. Insertion at the tail is O(n) because you must walk to the tail first — unless you also maintain a tail pointer, in which case it drops to O(1). Searching is O(n) in the worst case: you might have to walk every node. Removal is O(1) if you already have a pointer to the node you want to remove, but O(n) if you have to search for it first. The core advantage of a linked list is that middle insertion and removal are O(1) once you have found the location; an array forces you to shift all subsequent elements, making it O(n).`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Linked lists appear in operating system schedulers (queuing ready processes), browser history stacks, and graph adjacency lists where each node's neighbors are stored as a linked list. They are also fundamental building blocks for more complex structures: stacks and queues are often implemented as linked lists because insertion and removal at specific ends happen in constant time. Game engines use linked lists for animation timelines. Any time you need fast removal from the middle without knowing the total size in advance, a linked list (or hash table) is the right tool.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The biggest trap is confusing a linked list with an array and expecting O(1) access by index. If you write code that says "get me the element at position 5," a linked list must walk 5 steps — there is no shortcut. If your algorithm needs lots of random access, an array is far better. Another common mistake is losing the head pointer or not maintaining pointers correctly during insertion or removal, which breaks the chain and orphans parts of the list. The pointer-by-pointer nature also means linked lists have higher memory overhead per node: you need space for both the value and the next pointer, whereas an array only stores values. Modern caches also favor arrays because data is contiguous, making linked lists slower in practice even for operations that seem equivalent.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Explore Stack and Queue, which are often built on top of linked lists for their O(1) insertion and removal guarantees. Hash Table offers a different approach to the trade-off between search speed and insertion flexibility. For a deeper dive into pointer manipulation, study Tree Traversals and Graph BFS, which use similar walk-from-a-starting-point logic but with more complex connectivity.`,
      ],
    },
  ],
};

