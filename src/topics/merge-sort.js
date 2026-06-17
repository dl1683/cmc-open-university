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
      heading: `Why this algorithm exists`,
      paragraphs: [
        `Merge sort exists because local repair is a poor way to move information across a long array. Bubble Sort and Insertion Sort fix nearby inversions. That is simple and often useful for tiny or nearly sorted ranges, but it can take quadratic time when many values must travel far from their starting positions.`,
        `Merge sort takes a different view: make sorted runs first, then combine runs. Splitting an array in half is cheap. A one-item array is already sorted. Merging two sorted arrays is linear because the next output item must be at the front of one of the two inputs. Put those facts together and you get a predictable O(n log n) sorting algorithm.`,
        `Its two most important traits are worst-case predictability and stability. Predictability means the running time stays O(n log n) even when the input is reverse sorted, already sorted, or deliberately hostile. Stability means equal keys keep their original relative order, which matters when sorting records through multiple passes.`,
      ],
    },
    {
      heading: `Why the obvious approach fails`,
      paragraphs: [
        `A natural first sorting strategy is "scan for things out of order and swap them." That is the spirit of Bubble Sort. A better local strategy is "insert the next item into the sorted prefix." That is Insertion Sort. Both strategies can be excellent teaching tools, and insertion sort is still used inside real hybrid sorts for small ranges.`,
        `The problem is that local movement can be expensive. Moving a value from the end of an array to the front through adjacent swaps takes many operations. Doing that for many values gives O(n^2) behavior. The algorithm spends its time repeatedly moving across the same ground.`,
        `Merge sort avoids that by postponing movement until there is structure. It first creates sorted runs, then performs large, orderly transfers from input runs to output. It may copy more memory than an in-place quicksort, but the copies are sequential, predictable, and bounded by the recursion tree.`,
      ],
    },
    {
      heading: `The core mechanism`,
      paragraphs: [
        `The recursive version is short because it mirrors the idea directly. To sort positions lo through hi, compute the midpoint, sort the left half, sort the right half, and merge the two sorted halves. The base case is a range of length zero or one, which is already sorted.`,
        `The merge step keeps two cursors: one at the front of the left sorted run and one at the front of the right sorted run. Compare the two front values. Copy the smaller one to the next output position and advance that cursor. If one run is exhausted, copy the rest of the other run.`,
        `The important invariant is that everything already written during the current merge is in sorted order and will not need to move again within that run. Each write position becomes final for the run because no hidden value behind a front cursor can be smaller than that cursor's current value.`,
      ],
    },
    {
      heading: `Why the merge is correct`,
      paragraphs: [
        `Assume the left and right runs are already sorted. The next output item must be either the left front or the right front. It cannot be a later item in the left run because later left items are at least as large as the left front. It cannot be a later item in the right run for the same reason.`,
        `Therefore the smaller of the two front values is safe to write next. After writing it, advancing that run's cursor preserves the same argument for the next position. This local argument repeats until one run is empty, and then the remaining run can be copied because it is already sorted.`,
        `The recursive proof is built from this merge proof. Single-item ranges are sorted. If the recursive calls return sorted left and right halves, the merge returns one sorted range. By induction, the full array is sorted.`,
      ],
    },
    {
      heading: `Stability and equal keys`,
      paragraphs: [
        `A sorting algorithm is stable when equal keys keep their original relative order. Merge sort can be stable with one simple rule: when the left front and right front compare equal, take the left item first. The left run contains items that appeared earlier in the original array than equal items in the right run at that merge level.`,
        `Stability is not a cosmetic property. Suppose records have department and hire date. If you first sort by hire date and then stably sort by department, records inside each department remain ordered by hire date. Without stability, the second sort may scramble the earlier ordering.`,
        `Taking from the right side on ties can still produce a numerically sorted array, but it breaks stable sorting. Forgetting to advance a cursor after writing an equal item is a different bug; that can cause an infinite loop or repeated output. Correct stable merge code both chooses the left item on ties and advances exactly one cursor per write.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `Take the input [8a, 3, 8b, 1, 9, 2, 5], where 8a and 8b have the same key but 8a appears earlier. The split phase divides the array until the leaves are single items: [8a], [3], [8b], [1], [9], [2], [5]. Each leaf is already sorted.`,
        `Now the merge phase builds sorted runs. [8a] and [3] merge into [3, 8a]. [8b] and [1] merge into [1, 8b]. Those two runs merge into [1, 3, 8a, 8b]. Notice the tie rule: when 8a and 8b become front values, the left 8a is written first, so stability is preserved.`,
        `On the right side, [9] and [2] merge into [2, 9], then [2, 9] merges with [5] into [2, 5, 9]. The final merge combines [1, 3, 8a, 8b] and [2, 5, 9] into [1, 2, 3, 5, 8a, 8b, 9]. Every merge touches each item in its two runs once.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The time cost is O(n log n) in best, average, and worst cases. The recursion tree has about log2(n) levels because each split halves the range. At each level, the merge work across all ranges touches n items total. Multiplying n work per level by log n levels gives O(n log n).`,
        `The usual array implementation uses O(n) auxiliary storage for merging, plus O(log n) call-stack space in the recursive version. Many production implementations allocate one auxiliary buffer and reuse it rather than allocating fresh left and right arrays at every recursive call.`,
        `There are in-place merge algorithms, but they are more complex and can be slower in practice because they trade simple sequential copying for intricate rotations or block movement. Merge sort is often chosen when predictable time and stable output matter more than O(1) extra space.`,
      ],
    },
    {
      heading: `Implementation patterns`,
      paragraphs: [
        `Top-down recursive merge sort is the clearest teaching version. It splits first, then merges while the call stack unwinds. Bottom-up merge sort removes recursion: start with runs of length 1, merge adjacent runs into length 2, then length 4, then length 8, until the whole array is one run.`,
        `Bottom-up merging is useful when you want predictable iteration and less call-stack overhead. It also maps well to external sorting, where runs live on disk rather than in memory. The same idea scales from small arrays to files that are too large to load at once.`,
        `Comparator handling matters. The merge step should use the same comparator everywhere, should treat equality consistently, and should not assume numeric subtraction is safe for every key type. For objects, store or compare keys carefully so stability remains meaningful.`,
      ],
    },
    {
      heading: `Where it matters`,
      paragraphs: [
        `Stable library sorts borrow from merge sort's central idea even when they are not textbook merge sort. Python's Timsort detects naturally occurring sorted runs, uses insertion sort on small ranges, and merges runs stably. Java uses TimSort for object arrays. JavaScript Array.prototype.sort is specified as stable in modern ECMAScript, and engines use practical stable strategies rather than the plain teaching algorithm alone.`,
        `External sorting is the classic systems use. If a log file is hundreds of gigabytes and memory is limited, the system sorts chunks that fit in RAM, writes sorted runs to disk, and then performs multiway merges. Sequential reads and writes are much friendlier to disks and object stores than random swapping across the entire file.`,
        `Storage engines use the same run-merging idea. LSM trees accept writes into memory, flush sorted runs to disk, and later compact runs by merging them. That is merge sort thinking applied to databases: create sorted runs cheaply, then merge them in the background.`,
      ],
    },
    {
      heading: `Failure modes`,
      paragraphs: [
        `The first practical failure is allocation churn. A naive implementation that slices arrays at every recursive call can allocate many temporary arrays and pressure the garbage collector. Reusing a single auxiliary buffer is usually better for serious code.`,
        `The second failure is losing stability. If equal keys take from the right run first, records with equal keys can flip. The output is sorted by key but not stable. That bug is hard to see with plain numbers and easier to catch with tagged duplicates such as 8a and 8b.`,
        `The third failure is off-by-one range logic. Merge sort has many boundary variables: lo, mid, hi, left length, right length, and write position. A wrong inclusive or exclusive bound can drop an item, duplicate an item, or recurse forever on a range that does not shrink.`,
        `The fourth failure is choosing merge sort when memory is the binding constraint. On very memory-constrained systems, Heap Sort or an in-place Quick Sort variant may be preferable. On tiny arrays, insertion sort can win because its overhead is lower and its cache locality is excellent.`,
      ],
    },
    {
      heading: `Operational guidance`,
      paragraphs: [
        `Use merge sort when you need a stable sort with predictable worst-case time, especially for records rather than primitive numbers. It is a strong default for linked lists because merging linked runs can be done by rewiring pointers without large contiguous auxiliary arrays.`,
        `Use a hybrid strategy for production arrays. Switch to insertion sort for small ranges, reuse an auxiliary buffer, and consider detecting existing sorted runs. That is the path from textbook merge sort toward Timsort-style engineering.`,
        `Test with adversarial and semantic cases: empty arrays, one item, already sorted input, reverse sorted input, duplicates, tagged equal keys for stability, odd lengths, powers of two, and comparator ties. The algorithm's proof is simple, but most bugs live in boundaries and equality handling.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Recursion to understand the call tree, Big-O Growth Rates for the n log n curve, and Insertion Sort for the small-range base case used by hybrids. Compare with Quick Sort for in-place average-case speed and Heap Sort for O(1) extra space.`,
        `Then follow the merge idea into systems topics. Study External Sorting for disk-sized data, LSM Trees (How Cassandra Writes) for sorted-run compaction, Binary Search for what sorted output enables, Stable Sorting for multi-key record ordering, and K-Way Merge for the generalization used when many sorted runs must be combined.`,
      ],
    },
  ],
};
