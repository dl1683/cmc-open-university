// Merge sort: split in half, sort each half, merge the sorted halves.
// Guaranteed O(n log n), and stable — equal values keep their order.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'merge-sort',
  title: 'Merge Sort',
  category: 'Sorting',
  summary: 'Divide and conquer: split, sort the halves, then merge them back together.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '8, 3, 8, 1, 9, 2, 5' },
  ],
  run,
};

const idsBetween = (lo, hi) =>
  Array.from({ length: hi - lo + 1 }, (_, k) => `i${lo + k}`);

export function* run(input) {
  const values = parseNumberList(input.values, { max: 10 });

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: 'Merge sort\'s insight: merging two ALREADY-SORTED lists is easy — just keep taking the smaller front item. So: split the array until every piece is size 1 (trivially sorted), then merge upward.',
  };

  yield* mergeSort(values, 0, values.length - 1);

  yield {
    state: arrayState(values),
    highlight: { sorted: values.map((_, i) => `i${i}`) },
    explanation: `Sorted! The array was split log n times, and each level of merging touched all n elements once: O(n log n), guaranteed, no matter how hostile the input. That predictability is merge sort's brand.`,
  };
}

function* mergeSort(values, lo, hi) {
  if (lo >= hi) return; // a single element is already sorted

  const mid = Math.floor((lo + hi) / 2);
  yield {
    state: arrayState(values),
    highlight: { range: idsBetween(lo, hi), active: [`i${mid}`] },
    explanation: `Split positions ${lo}–${hi} into two halves: ${lo}–${mid} and ${mid + 1}–${hi}. Each half gets sorted on its own before we merge.`,
  };

  yield* mergeSort(values, lo, mid);
  yield* mergeSort(values, mid + 1, hi);
  yield* merge(values, lo, mid, hi);
}

function* merge(values, lo, mid, hi) {
  const left = values.slice(lo, mid + 1);
  const right = values.slice(mid + 1, hi + 1);
  let l = 0;
  let r = 0;

  for (let write = lo; write <= hi; write += 1) {
    let takeLeft;
    let why;
    if (l >= left.length) {
      takeLeft = false;
      why = `The left half is used up — copy the rest of the right half over.`;
    } else if (r >= right.length) {
      takeLeft = true;
      why = `The right half is used up — copy the rest of the left half over.`;
    } else if (left[l] <= right[r]) {
      // `<=` matters twice: equal values take from the LEFT (keeping the sort
      // stable), and the tie always makes progress (a strict `<` on both
      // sides is the classic bug that loops forever on duplicates).
      takeLeft = true;
      why = left[l] === right[r]
        ? `Both fronts are ${left[l]} — a tie. Take from the LEFT half: ties must still make progress (the classic merge bug loops forever here), and taking left keeps equal values in their original order, which is what "stable" means.`
        : `Compare the fronts: ${left[l]} vs ${right[r]}. The left's ${left[l]} is smaller, so it goes next.`;
    } else {
      takeLeft = false;
      why = `Compare the fronts: ${left[l]} vs ${right[r]}. The right's ${right[r]} is smaller, so it goes next.`;
    }

    values[write] = takeLeft ? left[l++] : right[r++];
    yield {
      state: arrayState(values),
      highlight: { range: idsBetween(lo, hi), active: [`i${write}`] },
      explanation: `Merging ${lo}–${hi}. ${why} Write ${values[write]} at position ${write}.`,
      invariant: 'Everything already written in this merge is in its final relative order.',
    };
  }

  yield {
    state: arrayState(values),
    highlight: { sorted: idsBetween(lo, hi) },
    explanation: `Positions ${lo}–${hi} are now one sorted run, ready to be merged with a neighbor at the level above.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Merge sort is the classic divide-and-conquer sort: split the array in half, sort each half, then merge the two sorted halves into one sorted result. The split phase keeps cutting until each piece has one item, because a one-item array is already sorted. The merge phase does the real work by repeatedly taking the smaller front item from two already-sorted runs.`,
        `Its two headline traits are predictability and stability. Predictability means O(n log n) time even on hostile input; there is no reverse-sorted disaster case. Stability means equal keys keep their original relative order. That matters when sorting records: if you sort employees by hire date, then stably sort by department, employees inside each department remain ordered by hire date.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The recursive version mirrors Recursion exactly. sort(array) splits into left and right, calls sort(left), calls sort(right), then merges. Merging keeps two pointers, one into each sorted half. Compare the two front values, copy the smaller one to the output, and advance that pointer. When one half runs out, copy the remainder of the other half. Because each merge touches every item in its range once, each level of the recursion tree costs O(n).`,
        `The stability rule is simple: when the two front values compare equal, take the item from the left half first. If you take from the right on ties, the output can still be sorted, but equal items may flip relative order. That is a correctness bug for stable sorting, not automatically an infinite loop. Infinite loops come from forgetting to advance a pointer after copying an item.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Time is O(n log n) in best, average, and worst cases. The array splits for about log2(n) levels, and each level merges all n items. Space is usually O(n) for the temporary output arrays, plus O(log n) call-stack space in the recursive version. There are in-place merge algorithms, but they are complex and often slower in practice. Big-O Growth Rates explains the trade: this sort spends extra memory to escape the O(n^2) behavior of Bubble Sort and other quadratic methods.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Stable library sorts borrow heavily from this idea. Python's Timsort detects already-sorted runs, uses Insertion Sort on small ranges, then merges runs stably. Java uses TimSort for object arrays and a dual-pivot Quick Sort for primitive arrays. Since ES2019, JavaScript Array.prototype.sort is required to be stable, and major engines use stable hybrid strategies rather than the textbook algorithm alone.`,
        `External sorting is where merging shines. If a 500 GB log file does not fit in RAM, a system sorts chunks on disk, then repeatedly merges sorted runs with sequential reads and writes. LSM Trees (How Cassandra Writes) use the same sorted-run intuition: writes create sorted files, and compaction later merges them. Binary Search benefits afterward because sorted runs can be searched efficiently.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first misconception is that O(n log n) always wins at tiny sizes. For 16 or 32 items, Insertion Sort can be faster because it has low overhead and excellent cache locality. That is why real libraries use hybrids. The second pitfall is ignoring memory. O(n) extra space is often fine on a laptop and painful in embedded systems or memory-heavy services.`,
        `Another common bug is allocating new arrays at every recursive call without noticing the garbage created. Many implementations reuse one auxiliary buffer. Also remember that divide-and-conquer does not mean automatically in place: Quick Sort partitions in place on average, while this algorithm usually copies.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Recursion to understand the call tree, then Big-O Growth Rates for the n log n curve. Compare with Quick Sort for in-place average-case speed and Heap Sort for O(1) extra space. Insertion Sort explains why hybrids switch strategies on small ranges, and LSM Trees (How Cassandra Writes) shows merging as a storage-system idea, not just a sorting trick.`,
      ],
    },
  ],
};
