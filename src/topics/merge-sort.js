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
      heading: 'How to read the animation',
      paragraphs: [
        'The highlighted range is the part of the array currently being split or merged. A range is a contiguous slice of positions, and a run is a slice that is already sorted. During splitting, the active marker sits on the midpoint that divides one range into two smaller ranges.',
        'During merging, the active marker is the output position being written. The safe inference rule is this: if the left and right runs are sorted, the smaller front value must be the next output value because no later value in either run can be smaller than its own front. When equal values appear, the animation takes the left value first so equal records keep their original order.',
        {type: 'callout', text: 'Merge sort wins by delaying movement until two sorted runs can be merged in one linear pass.'},
        {type: 'image', src: './assets/gifs/merge-sort.gif', alt: 'Animated walkthrough of the merge sort visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sorting turns unordered records into a sequence that supports search, grouping, deduplication, joins, and human inspection. Merge sort exists because many systems need sorting with a predictable worst case, not just good average behavior. A sort is stable when equal keys keep their original relative order, which matters when records have hidden fields beyond the key being compared.',
        'The practical constraint is that input order may be hostile or unknown. A reverse-sorted file, a log already grouped by the wrong field, or a data stream with many duplicates should not push the algorithm into quadratic work. Merge sort pays a steady price by doing the same split-and-merge schedule regardless of input shape.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious first sort is insertion sort. Keep a sorted prefix on the left, take the next item, and slide it left until it belongs. It is easy to implement, stable, and fast when the array is tiny or nearly sorted.',
        'On input [1, 2, 3, 4, 5], insertion sort does almost no movement because each new value already belongs at the end of the prefix. That success is real, which is why production sorts often use insertion sort for small runs. The trouble starts when the input order works against local movement.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Insertion sort can move an item only by shifting it across earlier items. On [5, 4, 3, 2, 1], the 4 moves one slot, the 3 moves two, the 2 moves three, and the 1 moves four. The total number of shifts is 1 + 2 + 3 + 4 = 10 for five items, and n(n - 1)/2 for n items.',
        'The wall is not a bad constant; it is the local repair model. Every far-away inversion must be fixed by crossing intermediate positions. A million reverse-sorted records require roughly five hundred billion pairwise shifts, even though the final order is easy to describe.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Merge sort changes the unit of work from adjacent movement to sorted-run combination. A single item is already sorted, so the algorithm splits until that fact is true everywhere. Then it merges neighboring sorted runs, using one comparison to decide the next output slot.',
        'The invariant is that every completed run is sorted and contains exactly the same items it started with. The algorithm never guesses the final global order early. It waits until two local orders are known, then combines them without losing stability.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Merge_sort_algorithm_diagram.svg/600px-Merge_sort_algorithm_diagram.svg.png', alt: 'Merge sort diagram showing recursive splitting and merging of sorted runs', caption: 'The diagram shows the key shape: split to singletons, then merge sorted runs upward. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Merge_sort_algorithm_diagram.svg.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Split the array into left and right halves until each range has one item. Return from recursion by merging each pair of sorted ranges into a larger sorted range. The top call finishes when the whole array has become one sorted run.',
        'A merge uses two read pointers and one write pointer. Compare the current left value and current right value, write the smaller one, and advance the pointer that supplied it. If one run runs out, copy the rest of the other run because it is already sorted.',
        'A bottom-up version uses the same mechanism without recursion. It merges runs of length 1 into length 2, length 2 into length 4, and continues doubling the run size. This is the shape used when sorted chunks live on disk or across workers.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows by induction on range size. A one-item range is sorted, so the base case is true. If the left and right halves are sorted, the merge rule produces a sorted range because the next output must be one of the two front values.',
        'The merge rule is safe because sorted order gives a proof about every hidden item behind a pointer. If left[0] <= right[0], then left[0] is no larger than any later left item and no larger than the current right item. Writing it cannot place a larger value before a smaller unseen value.',
        'Stability comes from the tie rule. If two equal keys meet at the fronts of different runs, the left one appeared earlier in the original array. Taking the left value first preserves that order at this merge level, and induction preserves it through all higher merge levels.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each merge level reads and writes every element once, so one level costs O(n). The number of levels is about log2(n), because each split halves the range. The total time is O(n log n) for sorted, random, reverse-sorted, and duplicate-heavy inputs.',
        'When n doubles, the work roughly doubles and adds one more full merge level. Sorting 1,024 items has about 10 merge levels, while 1,048,576 items has about 20. The growth is predictable because the split tree shape does not depend on input order.',
        'Array merge sort needs O(n) auxiliary storage for the temporary output buffer, plus O(log n) stack frames in the recursive version. That buffer is the main tax. It buys stable, predictable comparisons but moves data through memory more than in-place quicksort often does.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/ComputerMemoryHierarchy.svg', alt: 'Computer memory hierarchy from registers through caches to storage', caption: 'Merge sort spends predictable comparison work, but the auxiliary buffer still moves data through the memory hierarchy. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:ComputerMemoryHierarchy.svg.'},
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'External sorting is the classic production use. A database or command-line sort can sort chunks that fit in memory, write those sorted runs to storage, and merge runs sequentially. Sequential access is friendlier to disks, SSDs, and distributed shuffle systems than random local swapping.',
        'Stable multi-key sorting is another fit. If records are sorted by timestamp and then stably sorted by account, equal-account records keep their timestamp order. This is why hybrid merge-based sorts appear in language runtimes and data processing systems.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/b6/MapReduce.svg', alt: 'MapReduce execution diagram with map tasks shuffle reduce tasks and output', caption: 'MapReduce shuffle uses the same sorted-run idea at cluster scale: partition, sort locally, then merge grouped streams. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:MapReduce.svg.'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The O(n) auxiliary array is expensive when memory is tight. Quicksort usually sorts arrays in place with only stack space, and its cache behavior is often better on random in-memory arrays. Merge sort trades that memory and copying cost for a guaranteed worst case and easy stability.',
        'It is also overbuilt for very small ranges. Function calls, buffer movement, and pointer bookkeeping can cost more than simple insertion sort when n is tiny. Practical hybrid sorts switch to insertion sort for short runs and use merge logic only after runs become large enough.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Sort [38, 27, 43, 3, 9, 82, 10]. Split into [38, 27, 43, 3] and [9, 82, 10], then into [38, 27], [43, 3], [9, 82], and [10]. The leaves are [38], [27], [43], [3], [9], [82], and [10].',
        'Merge pairs: [38] with [27] gives [27, 38], [43] with [3] gives [3, 43], and [9] with [82] gives [9, 82]. Merge [27, 38] with [3, 43]: take 3, 27, 38, then 43, giving [3, 27, 38, 43]. Merge [9, 82] with [10]: take 9, 10, then 82, giving [9, 10, 82].',
        'The final merge compares [3, 27, 38, 43] with [9, 10, 82]. It writes 3, then 9, then 10, then 27, 38, 43, and finally 82. The sorted result is [3, 9, 10, 27, 38, 43, 82], and every write was justified by the smaller-front rule.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study von Neumann and Knuth for sorting history and analysis, and language runtime docs for practical hybrid sorts such as Timsort. The stable facts are the recurrence T(n) = 2T(n/2) + O(n), the O(n log n) worst case, and the O(n) array buffer tax.',
        'Study Quick Sort next to see the in-place average-case alternative, Heap Sort for O(1) extra storage with O(n log n) worst case, and External Sorting for data larger than memory. Then study Divide and Conquer as the general pattern: split the problem, solve smaller parts, and combine with a proof-preserving operation.',
      ],
    },
  ],
};
