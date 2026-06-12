// Linear search: check every element until the target appears.
// The simplest search, and the honest baseline every other search beats.

import { arrayState, parseNumberList, parseNumber } from '../core/state.js';

export const topic = {
  id: 'linear-search',
  title: 'Linear Search',
  category: 'Searching',
  summary: 'Walk the array one element at a time until you find the target.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '7, 3, 15, 9, 4, 11' },
    { id: 'target', label: 'Search for', type: 'number', defaultValue: '9' },
  ],
  run,
};

export function* run(input) {
  const values = parseNumberList(input.values);
  const target = parseNumber(input.target, { label: 'a target' });

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `We are looking for ${target}. The array is not sorted, so we can assume nothing — linear search simply checks every element, left to right.`,
  };

  for (let index = 0; index < values.length; index += 1) {
    const visited = values.slice(0, index).map((_, i) => `i${i}`);
    const isMatch = values[index] === target;
    yield {
      state: arrayState(values),
      highlight: { active: [`i${index}`], visited },
      explanation: `Check position ${index}: is ${values[index]} equal to ${target}? ${isMatch ? 'Yes — found it!' : 'No — move on.'}`,
      invariant: 'Everything to the left of the current position has been checked and ruled out.',
    };
    if (isMatch) {
      yield {
        state: arrayState(values),
        highlight: { found: [`i${index}`], visited },
        explanation: `Found ${target} at position ${index} after ${index + 1} comparison${index === 0 ? '' : 's'}. In the worst case linear search checks all n elements — that is what O(n) means.`,
      };
      return;
    }
  }

  yield {
    state: arrayState(values),
    highlight: { visited: values.map((_, i) => `i${i}`) },
    explanation: `All ${values.length} elements checked — ${target} is not here. ${values.length} comparisons: the O(n) worst case. To do better, the data needs structure… like being sorted (see Binary Search).`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Linear scanning is the baseline search: inspect one item, compare it with the target, and either stop or move to the next item. It requires no sorting, no index, no Hash Table, and no preprocessing. If the item appears, the scan returns the first matching position. If the scan reaches the end, absence has been proven by exhaustion.`,
        `That simplicity is its strength. It works on arrays, linked data, streams, logs, files, and any iterable sequence. It is also the honest lower bound for unstructured data: if the data gives you no ordering or index, every unchecked element could still be the answer.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Maintain a cursor starting at index 0. At each step, compare the current value to the target. A match returns immediately. A mismatch advances the cursor. The invariant is that everything before the cursor has already been checked and rejected. This is the same mental model used by Sliding Window and Two Pointers techniques, but here only one cursor is needed.`,
        `Early exit matters. A target at index 0 costs one comparison. A target at the last index costs n comparisons. A missing target also costs n comparisons. If multiple matches are required, the scan must continue after the first hit and collect all positions, which is why log scanners and grep-like tools are still fundamentally linear.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Best case is O(1). If the target exists and is equally likely to be anywhere, the expected number of comparisons is (n + 1) / 2. If the target is absent, the cost is n. Big-O drops the constants, so average and worst case are both O(n). Extra space is O(1).`,
        `For small n, the constants are excellent: one tight loop over contiguous memory can beat Binary Search because branch prediction and prefetching are friendly. For repeated queries over large data, the lack of preprocessing becomes the bottleneck. Sorting once enables O(log n) search; hashing once enables average O(1) lookup.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Compilers linearly scan tiny token lists and symbol buckets. JavaScript engines and databases scan short arrays before choosing heavier index machinery. Operating systems scan process tables and file descriptor arrays when the table is small. Unix tools such as grep stream bytes from disk because the file may be larger than memory and may never be queried again.`,
        `Membership filters also start from this baseline. A Bloom Filter can reject many absent queries before a scan or disk lookup. A Hash Table is better for repeated exact lookups, and Binary Search is better once sorted order is already available.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The common mistake is treating O(n) as automatically bad. If n is 8, a scan is often the simplest and fastest answer. If n is 8,000,000 and queries repeat, it is usually the wrong data structure. Another misconception is that sorted data prevents scanning. A scan still works on sorted data; it just ignores useful structure.`,
        `Be careful about equality. Searching objects by reference is different from searching by a field, a normalized string, or a comparator. Real systems often fail here through case sensitivity, Unicode normalization, or floating-point comparison surprises rather than through the loop itself.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Binary Search to see how sorted order changes the game. Hash Table shows average O(1) lookup after preprocessing. Bloom Filter explains fast negative answers with false positives. Big-O Growth Rates gives scale intuition, while Sliding Window and Two Pointers show how controlled scans become more powerful than a plain one-cursor pass.`,
      ],
    },
  ],
};
