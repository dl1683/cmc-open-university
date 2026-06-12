// Binary max-heap (a priority queue): insert bubbles up, extract-max sifts
// down. Drawn as the tree it conceptually is — but it lives in a flat array.

import { treeState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'binary-heap',
  title: 'Binary Heap (Priority Queue)',
  category: 'Data Structures',
  summary: 'A tree where every parent beats its children — so the maximum is always one peek away.',
  controls: [
    { id: 'values', label: 'Insert (in order)', type: 'number-list', defaultValue: '5, 9, 3, 14, 7, 11' },
  ],
  run,
};

// The heap is an array; the "tree" is just how we read the indexes:
// children of index i are 2i+1 and 2i+2, parent is floor((i-1)/2).
function heapTree(heap) {
  const nodes = heap.map((value, i) => ({
    id: `h${i}`,
    value,
    left: 2 * i + 1 < heap.length ? `h${2 * i + 1}` : null,
    right: 2 * i + 2 < heap.length ? `h${2 * i + 2}` : null,
  }));
  return treeState(nodes, heap.length > 0 ? 'h0' : null);
}

export function* run(input) {
  const values = parseNumberList(input.values, { max: 10 });
  const heap = [];

  yield {
    state: heapTree(heap),
    highlight: {},
    explanation: 'A max-heap keeps one promise: EVERY parent ≥ its children. That single rule means the maximum is always at the root — a priority queue where the most urgent thing is always on top. (The whole tree secretly lives in a flat array: children of index i are at 2i+1 and 2i+2.)',
  };

  for (const value of values) {
    heap.push(value);
    let i = heap.length - 1;
    yield {
      state: heapTree(heap),
      highlight: { active: [`h${i}`] },
      explanation: `insert(${value}): the new value starts at the first free slot — the bottom of the tree. That keeps the shape compact, but the parent rule might now be broken upward.`,
    };
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      const violates = heap[i] > heap[parent];
      yield {
        state: heapTree(heap),
        highlight: { compare: [`h${i}`, `h${parent}`] },
        explanation: `Compare ${heap[i]} with its parent ${heap[parent]}: ${violates ? 'child is bigger — that breaks the heap promise, so they swap. The new value BUBBLES UP.' : 'parent is bigger (or equal) — promise intact, the value has found its level.'}`,
        invariant: 'Everywhere except along the bubbling path, every parent ≥ its children.',
      };
      if (!violates) break;
      [heap[i], heap[parent]] = [heap[parent], heap[i]];
      i = parent;
    }
  }

  yield {
    state: heapTree(heap),
    highlight: { found: ['h0'] },
    explanation: `All ${values.length} values inserted — each took at most log n bubble-up swaps. The maximum (${heap[0]}) sits at the root, readable in O(1). Now watch extract-max, the other half of the priority queue.`,
  };

  for (let round = 0; round < 2 && heap.length > 1; round += 1) {
    const max = heap[0];
    heap[0] = heap[heap.length - 1];
    heap.pop();
    yield {
      state: heapTree(heap),
      highlight: { active: ['h0'] },
      explanation: `extractMax() removes ${max}. The LAST value (${heap[0]}) jumps into the root to keep the shape compact — it is almost certainly too small to be there, so it must SIFT DOWN.`,
    };

    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left >= heap.length) break;
      const bigger = right < heap.length && heap[right] > heap[left] ? right : left;
      const violates = heap[bigger] > heap[i];
      yield {
        state: heapTree(heap),
        highlight: { compare: [`h${i}`, `h${bigger}`] },
        explanation: `${heap[i]} vs its bigger child ${heap[bigger]}: ${violates ? 'child wins — swap, and keep sinking.' : 'parent wins — the heap promise holds again.'}`,
      };
      if (!violates) break;
      [heap[i], heap[bigger]] = [heap[bigger], heap[i]];
      i = bigger;
    }
  }

  yield {
    state: heapTree(heap),
    highlight: heap.length ? { found: ['h0'] } : {},
    explanation: 'That is the entire priority queue: insert = bubble up, extract = sift down, both O(log n), max always at the root. Operating systems schedule tasks with this, Dijkstra finds shortest paths with it — and run extract-max n times and you have invented Heap Sort.',
  };
}
