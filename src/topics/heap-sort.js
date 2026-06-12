// Heap sort: treat the array as a binary tree, make it a max-heap,
// then repeatedly swap the root (the max) to the end of the unsorted zone.
// The array IS the tree: children of index i live at 2i+1 and 2i+2.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'heap-sort',
  title: 'Heap Sort',
  category: 'Sorting',
  summary: 'Build a max-heap inside the array, then extract the maximum n times.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '4, 10, 3, 5, 1, 8, 7' },
  ],
  run,
};

const sortedIds = (values, sortedFrom) =>
  values.map((_, i) => `i${i}`).slice(sortedFrom);

export function* run(input) {
  const values = parseNumberList(input.values, { max: 10 });
  const n = values.length;

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: 'Heap sort hides a binary tree inside the array: the children of index i sit at 2i+1 and 2i+2 — no pointers needed. Phase 1 rearranges the array into a MAX-HEAP, where every parent ≥ its children.',
  };

  // Phase 1: build the max-heap, sifting down from the last parent to the root.
  for (let parent = Math.floor(n / 2) - 1; parent >= 0; parent -= 1) {
    yield {
      state: arrayState(values),
      highlight: { active: [`i${parent}`] },
      explanation: `Heapify the subtree rooted at index ${parent} (value ${values[parent]}). We go from the last parent up to the root, so every subtree below is already a valid heap.`,
    };
    yield* siftDown(values, parent, n, 0);
  }

  yield {
    state: arrayState(values),
    highlight: { found: ['i0'] },
    explanation: `The array is now a max-heap: every parent ≥ its children, so the LARGEST value (${values[0]}) sits at index 0. We never fully sorted anything — yet the max is free for the taking.`,
    invariant: 'Max-heap property: values[i] ≥ values[2i+1] and values[2i+2], wherever children exist.',
  };

  // Phase 2: repeatedly move the max to the end and shrink the heap.
  for (let end = n - 1; end > 0; end -= 1) {
    [values[0], values[end]] = [values[end], values[0]];
    yield {
      state: arrayState(values),
      highlight: { swap: ['i0', `i${end}`], sorted: sortedIds(values, end) },
      explanation: `Swap the root (the current maximum, ${values[end]}) into position ${end} — its FINAL home. The sorted zone grows from the right; the heap shrinks to ${end} element${end === 1 ? '' : 's'}.`,
    };
    yield* siftDown(values, 0, end, n - end);
  }

  yield {
    state: arrayState(values),
    highlight: { sorted: values.map((_, i) => `i${i}`) },
    explanation: 'Sorted! Building the heap is O(n); each of the n extractions sifts down at most log n levels → O(n log n) total, in place, with no recursion. The same heap structure powers priority queues.',
  };
}

function* siftDown(values, start, heapSize, sortedCount) {
  const sorted = sortedCount > 0 ? sortedIds(values, heapSize) : [];
  let parent = start;

  while (true) {
    const left = 2 * parent + 1;
    const right = 2 * parent + 2;
    if (left >= heapSize) break;

    const children = right < heapSize ? [left, right] : [left];
    const larger = right < heapSize && values[right] > values[left] ? right : left;
    const violates = values[larger] > values[parent];

    yield {
      state: arrayState(values),
      highlight: { active: [`i${parent}`], compare: children.map((c) => `i${c}`), sorted },
      explanation: `Index ${parent} (${values[parent]}) vs its child${children.length === 2 ? 'ren' : ''} at ${children.join(' and ')} (${children.map((c) => values[c]).join(', ')}): ${violates ? `child ${values[larger]} is bigger — the parent must sink.` : 'the parent is already the biggest — this subtree is a valid heap.'}`,
    };

    if (!violates) break;

    [values[parent], values[larger]] = [values[larger], values[parent]];
    yield {
      state: arrayState(values),
      highlight: { swap: [`i${parent}`, `i${larger}`], sorted },
      explanation: `Swap ${values[parent]} up and ${values[larger]} down. Keep sinking ${values[larger]} until every parent below is bigger than its children again.`,
    };
    parent = larger;
  }
}
