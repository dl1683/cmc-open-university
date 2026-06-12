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
