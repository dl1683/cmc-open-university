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

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A binary heap is a complete tree stored in an array, with one local ordering rule. In a max-heap, every parent is greater than or equal to its children, so the maximum value is always at the root. In a min-heap, every parent is less than or equal to its children, so the minimum is at the root. That root access is what makes the structure the standard implementation of a priority queue.`,
        `The word "complete" matters. The tree is filled level by level from left to right, which lets it live in a dense array with no child pointers. For index i, the left child is 2i + 1, the right child is 2i + 2, and the parent is Math.floor((i - 1) / 2). Compared with Binary Search Tree, the shape is stricter but the ordering is weaker: the top item is known, while the rest is only partially ordered.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Insert appends the new value at the end of the array, preserving the complete-tree shape. If the value outranks its parent, swap it upward. Keep bubbling up until the parent is good enough or the value reaches the root. Extract removes the root, moves the last array item into the root slot, then sifts that item down by repeatedly swapping with the better child. Each repair follows one root-to-leaf or leaf-to-root path.`,
        `Heapify builds the structure from an existing array faster than repeated insertion. Start at the last internal node and sift down each node moving backward toward the root. It looks like O(n log n), but it is O(n) because most nodes are near the leaves and can move only a few levels. This is one of those results where Big-O Growth Rates and a picture of the tree together make the math click.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Peek is O(1) because the best item is at index 0. Insert and extract are O(log n) because the height of a complete binary tree is logarithmic. Heapify is O(n). Space is O(n) for the array, or O(1) extra if you are rearranging an existing array in place. Searching for an arbitrary value is O(n), because the heap property does not tell you whether a value is in the left or right subtree the way Binary Search would.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Dijkstra's Shortest Path uses a min-heap to repeatedly expand the unsettled node with the lowest known distance. Graph BFS uses a plain Queue because every edge has equal cost; Dijkstra upgrades the frontier to priority order when edge weights differ. Heap Sort builds a max-heap and repeatedly extracts the maximum to fill the array from the end. Huffman Coding uses a min-heap to repeatedly combine the two lowest-frequency symbols into a compression tree.`,
        `Schedulers, simulation engines, and message brokers use heap-like structures when tasks have deadlines, priorities, or retry times. A web crawler might prioritize fresh high-value pages; a timer system might wake whichever timeout expires next. The structure is attractive because new priorities arrive dynamically and the next best item is always cheap to retrieve.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest mistake is expecting sorted iteration. The root is best, but siblings and cousins are not globally sorted. To output sorted values, you must repeatedly extract, which mutates the structure. Another trap is mixing up min-heap and max-heap comparisons; one flipped inequality silently breaks every operation.`,
        `Do not implement this with pointer nodes unless you have a special reason. The array representation is simpler, smaller, and cache-friendly. Also be careful with priority updates. Many textbook algorithms need decrease-key; if your heap implementation does not support it directly, you may insert a duplicate with the new priority and ignore the stale entry when it comes out.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Queue first for ordinary FIFO scheduling, then Dijkstra's Shortest Path to see priority scheduling change a graph algorithm. Heap Sort shows how repeated extraction becomes sorting. Compare with Binary Search Tree for ordered lookup, and read Huffman Coding for a greedy algorithm built almost entirely around repeated min extraction.`,
      ],
    },
  ],
};
