// Sorting algorithm comparison: bubble, insertion, merge, quick, heap, and
// counting sort plotted on the same axes so the n log n barrier is visceral.

import { plotState, parseIntegerInRange } from '../core/state.js';

export const topic = {
  id: 'sorting-comparison',
  title: 'Sorting Algorithm Comparison',
  category: 'Algorithms',
  summary: 'See bubble sort, insertion sort, merge sort, quicksort, and heap sort grow apart — the chart that settles every "which sort is faster?" debate.',
  controls: [
    { id: 'maxN', label: 'Max input size', type: 'select', options: ['50', '200', '500'], defaultValue: '200' },
  ],
  run,
};

const log2 = (n) => (n <= 1 ? 0 : Math.log2(n));
const ceil = Math.ceil;

const curves = [
  {
    id: 'bubble',
    label: 'Bubble sort',
    fn: (n) => (n * n) / 2,
    color: '#e74c3c',
    blurb: 'O(n²) quadratic: double n, quadruple work. Bubble sort compares every adjacent pair and bubbles the largest to the end, averaging n²/2 comparisons. Simple to write, brutal to run.',
  },
  {
    id: 'insertion',
    label: 'Insertion sort',
    fn: (n) => (n * n) / 4,
    color: '#e67e22',
    blurb: 'Same O(n²) family, but half the constant on average. Each element slides left through the sorted prefix, stopping early when it finds its place. On nearly-sorted data it approaches O(n) — which is why real libraries use it for short runs inside merge sort.',
  },
  {
    id: 'merge',
    label: 'Merge sort',
    fn: (n) => n * ceil(log2(n || 1)),
    color: '#2ecc71',
    blurb: 'O(n log n): the guaranteed performer. Split, recurse, merge — exactly n⌈log₂ n⌉ comparisons regardless of input order. The price: O(n) auxiliary space for the merge buffer.',
  },
  {
    id: 'quick',
    label: 'Quicksort',
    fn: (n) => 1.39 * n * ceil(log2(n || 1)),
    color: '#3498db',
    blurb: 'Average O(n log n) with a small constant — king in practice. Partition around a pivot; the 1.39 factor comes from the information-theoretic average of random pivots. Worst case is O(n²) on already-sorted input, but median-of-three or random pivot makes that astronomically unlikely.',
  },
  {
    id: 'heap',
    label: 'Heap sort',
    fn: (n) => 2 * n * ceil(log2(n || 1)),
    color: '#9b59b6',
    blurb: 'O(n log n) worst-case with no extra space — but the constant is about 2n log n because each sift-down walks the full height. Cache-unfriendly pointer chasing makes it slower than quicksort in practice despite the better worst-case guarantee.',
  },
  {
    id: 'counting',
    label: 'Counting sort',
    fn: (n) => 2 * n,
    color: '#1abc9c',
    blurb: 'O(n + k): breaks the comparison lower bound by not comparing at all. Count occurrences, compute prefix sums, place each element directly. When k ≈ n (range equals count), it runs in Θ(n). The catch: it only works on bounded non-negative integers, and k >> n wastes space.',
  },
];

function buildSeries(visible, ns) {
  return curves.slice(0, visible).map((c) => ({
    id: c.id,
    label: c.label,
    points: ns.map((n) => ({ x: n, y: c.fn(n) })),
  }));
}

const axes = { x: { label: 'n (input size)' }, y: { label: 'comparisons (average)' } };

export function* run(input) {
  const maxN = parseIntegerInRange(input.maxN, { min: 50, max: 500, label: 'n' });
  const step = maxN <= 50 ? 1 : maxN <= 200 ? 2 : 5;
  const ns = Array.from({ length: Math.floor(maxN / step) }, (_, i) => (i + 1) * step);

  // Frame 1: Bubble sort alone
  yield {
    state: plotState({ axes, series: buildSeries(1, ns) }),
    highlight: { active: ['bubble'] },
    explanation: `We plot average comparisons against input size n, growing from ${step} to ${maxN}. First up: bubble sort. It makes about n²/2 comparisons on average. ${curves[0].blurb}`,
  };

  // Frames 2-6: add one curve at a time
  for (let i = 1; i < curves.length; i += 1) {
    yield {
      state: plotState({ axes, series: buildSeries(i + 1, ns) }),
      highlight: { active: [curves[i].id], visited: curves.slice(0, i).map((c) => c.id) },
      explanation: curves[i].blurb,
      invariant: i <= 4
        ? `At n = ${maxN}: bubble ≈ ${Math.round(curves[0].fn(maxN)).toLocaleString()}, ${curves[i].label.toLowerCase()} ≈ ${Math.round(curves[i].fn(maxN)).toLocaleString()}.`
        : `At n = ${maxN}: bubble ≈ ${Math.round(curves[0].fn(maxN)).toLocaleString()}, counting ≈ ${Math.round(curves[5].fn(maxN)).toLocaleString()} — a ${Math.round(curves[0].fn(maxN) / curves[5].fn(maxN))}× gap.`,
    };
  }

  // Frame 7: All together — the n log n barrier
  yield {
    state: plotState({ axes, series: buildSeries(curves.length, ns) }),
    highlight: {},
    explanation: `All six together. The n² sorts (bubble, insertion) shoot off the chart while the n log n sorts (merge, quick, heap) cluster together near the floor. The comparison-sort lower bound — log₂(n!) ≈ n log₂ n − n — means no comparison sort can beat that cluster. Counting sort ducks under it by not comparing at all, but only when the value range is manageable.`,
    invariant: `At n = ${maxN}: n²/2 = ${Math.round(curves[0].fn(maxN)).toLocaleString()}, n⌈log₂ n⌉ = ${Math.round(curves[2].fn(maxN)).toLocaleString()}, 2n = ${Math.round(curves[5].fn(maxN)).toLocaleString()}.`,
  };

  // Frame 8: Zoomed-in view at small n (n <= 20) — insertion sort wins
  const smallNs = Array.from({ length: 20 }, (_, i) => i + 1);
  yield {
    state: plotState({ axes, series: buildSeries(curves.length, smallNs) }),
    highlight: { active: ['insertion'] },
    explanation: `Zoom in: n ≤ 20. The curves nearly overlap. Insertion sort’s low constant factor and cache-friendly sequential access make it the fastest sort for tiny arrays. This is why Timsort (Python, Java) and introsort (C++) switch to insertion sort below a threshold of 16–64 elements. Big-O decides the war; constants decide the battle.`,
    invariant: `At n = 20: bubble = ${Math.round(curves[0].fn(20))}, insertion = ${Math.round(curves[1].fn(20))}, merge = ${Math.round(curves[2].fn(20))}, quick = ${Math.round(curves[3].fn(20))}, heap = ${Math.round(curves[4].fn(20))}, counting = ${Math.round(curves[5].fn(20))}.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation plots six sorting algorithms on the same axes. The horizontal axis is input size n. The vertical axis is average comparisons (or operations for counting sort). Each frame adds one algorithm so you can watch the gaps open before they all appear together.',
        {type: 'callout', text: 'Sorting choice is not one leaderboard; it is a contract between input shape, stability, memory, and the comparison lower bound.'},
        'The active curve (highlighted) is the one just added. Previously drawn curves dim. The invariant line shows concrete numbers at the current max n so you can compare ratios, not just shapes.',
        'Two frames deserve special attention: the all-together view where n² and n log n visually separate, and the zoomed small-n view where insertion sort wins despite its worse asymptotic class.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'In 1956, Ford and Johnson proved an information-theoretic lower bound on comparison sorting. Any algorithm that sorts by pairwise comparisons must make at least log₂(n!) comparisons in the worst case, because there are n! possible permutations and each comparison eliminates at most half of them. Stirling’s approximation gives log₂(n!) ≈ n log₂ n − n + O(log n). No clever trick, no better pivot strategy, no smarter merge can beat this.',
        'This lower bound means the O(n log n) cluster (merge sort, quicksort, heap sort) is not merely good — it is optimal among comparison sorts. The only way under the barrier is to exploit structure in the data: counting sort uses bounded integer values, radix sort decomposes keys into digits, bucket sort assumes uniform distribution. Each trades generality for speed.',
        'The chart makes the barrier visceral. You can see the n² sorts leave the building while the n log n sorts hug each other near the floor. The gap is not a percentage — at n = 1000 it is 500×.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest sort: bubble sort. Compare adjacent elements, swap if out of order, repeat until no swaps happen. It is correct, easy to prove correct, and easy to implement in ten lines.',
        'For small lists, it works. Sort five exam scores? Bubble sort finishes before you notice. The code fits on a napkin and the correctness argument is one sentence: after k passes, the k largest elements are in their final positions.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Bubble sort on a million items: n²/2 = 500 billion comparisons. At one billion comparisons per second, that is eight minutes of pure comparison work, ignoring memory overhead. Merge sort on the same million items: about 20 million comparisons — twenty milliseconds. The gap is 25,000×.',
        'This is not a theoretical curiosity. Database indexes, file system sorts, network packet ordering, and search engine ranking all operate on millions to billions of items. An O(n²) sort in any of these contexts is a system outage.',
        'The wall is not hardware. Faster CPUs make both algorithms faster by the same constant factor. The n² sort is still 25,000× slower. You cannot buy your way out of a quadratic algorithm.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Bubble sort: scan left to right, swap adjacent inversions, repeat until clean. Average comparisons: n(n−1)/2 ≈ n²/2. Each pass guarantees the next-largest element reaches its final position.',
        'Insertion sort: maintain a sorted prefix. For each new element, slide it left through the prefix until it finds its place. Average comparisons: n(n−1)/4 ≈ n²/4. The factor-of-two improvement over bubble sort comes from early termination: each insertion stops as soon as it finds a smaller element.',
        'Merge sort: divide the array in half, recurse, merge the sorted halves. The merge step does at most n comparisons; the recursion has depth ⌈log₂ n⌉. Total: n⌈log₂ n⌉ comparisons, always.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Merge_sort_algorithm_diagram.svg/500px-Merge_sort_algorithm_diagram.svg.png', alt: 'Merge sort diagram showing recursive splits and merges', caption: 'Merge sort spends predictable work at every level: split structure above, merge work below. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Merge_sort_algorithm_diagram.svg.'},
        'Quicksort: pick a pivot, partition into elements less than and greater than the pivot, recurse on both sides. Average-case analysis by Hoare (1962): the expected number of comparisons is 2n ln n ≈ 1.39n log₂ n. The 1.39 factor is the price of random pivot selection; the payoff is excellent cache locality and no auxiliary space.',
        'Heap sort: build a max-heap in O(n), then repeatedly extract the maximum and sift down. Each extraction does at most 2⌈log₂ n⌉ comparisons (two per level: find the larger child, compare with the sifted element). Total: about 2n log₂ n.',
        'Counting sort: allocate an array of size k (the range of values), count occurrences, compute prefix sums, and place each element in its final position. Work: n to count, k to prefix-sum, n to place. Total: Θ(n + k). When k = O(n), this is linear.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The comparison-sort lower bound rests on a decision-tree argument. Model any comparison sort as a binary tree where each internal node is a comparison and each leaf is a permutation. The tree must have at least n! leaves (one per possible input ordering). A binary tree with L leaves has height at least log₂ L. Therefore worst-case comparisons ≥ log₂(n!) ≈ n log₂ n − n.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt: 'Decision tree diagram with branches and leaves', caption: 'The lower bound treats comparison sorting as a decision tree: each comparison can only choose one branch. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Decision_tree_model.png.'},
        'Merge sort matches this bound to within a small additive term. Its comparison count is deterministic: the merge of two sorted runs of total length m uses at most m − 1 comparisons. Summing over all levels of the recursion gives n⌈log₂ n⌉ − 2^{⌈log₂ n⌉} + 1, which is n log₂ n − n + O(1) for powers of two.',
        'Counting sort bypasses the bound because it never compares elements. It reads each element once to count it, then reads each count once to place it. The decision tree has only one path: no branches, no information gain needed from comparisons. The price is that it requires integer keys in a known range.',
      ],
    },
    {
      heading: 'Cost',
      paragraphs: [
        'Best / average / worst comparisons and space for each algorithm:',
        'Bubble sort: best O(n) with early-exit flag on sorted input, average O(n²), worst O(n²). Space O(1). Stable.',
        'Insertion sort: best O(n) on sorted input, average O(n²), worst O(n²). Space O(1). Stable. Adaptive: nearly-sorted data runs in near-linear time.',
        'Merge sort: best O(n log n), average O(n log n), worst O(n log n). Space O(n) for the merge buffer. Stable. Not adaptive (always does the same work regardless of input order).',
        'Quicksort: best O(n log n), average O(n log n) with 1.39 constant, worst O(n²) on adversarial input. Space O(log n) for the recursion stack (tail-call the larger partition). Not stable. Median-of-three or random pivot makes worst case vanishingly rare.',
        'Heap sort: best O(n log n), average O(n log n), worst O(n log n). Space O(1). Not stable. Guaranteed worst-case with no extra memory — the unique strength.',
        'Counting sort: best Θ(n + k), average Θ(n + k), worst Θ(n + k). Space Θ(k). Stable (if implemented with the backward placement pass). Only applicable to non-negative integers with bounded range.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Insertion sort wins on small arrays (n < 20–64) because its inner loop is a single comparison and a shift — no function-call overhead, no random memory access, pure sequential cache hits. Timsort, introsort, and pdqsort all delegate to insertion sort below a threshold.',
        'Merge sort wins when stability matters (equal elements must preserve their original order) and when data arrives as a stream or linked list. External merge sort handles files that do not fit in RAM by merging sorted runs from disk.',
        'Quicksort wins for general-purpose in-memory sorting. Its average 1.39n log₂ n comparisons come with excellent cache locality because partitioning scans sequentially from both ends. Most standard-library sorts (C qsort, C++ std::sort via introsort) are quicksort variants.',
        'Heap sort wins when you need an O(n log n) worst-case guarantee with O(1) extra space. Embedded systems and real-time contexts where allocation is forbidden use heap sort.',
        'Counting sort wins when keys are bounded integers with a small range: histogram binning, radix sort subroutine, byte-level sorting, suffix array construction. When k = O(n), nothing comparison-based can touch it.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'No single algorithm wins everywhere. Quicksort’s O(n²) worst case can be triggered by adversarial input (the “killer sequence” attack against deterministic pivot selection). Merge sort’s O(n) extra space is unacceptable in memory-constrained environments. Heap sort’s cache-unfriendly access pattern makes it 2–4× slower than quicksort on modern hardware despite the same asymptotic class.',
        'Counting sort fails when the range k is much larger than n (sorting 100 integers in [0, 10⁹] wastes a billion-entry array). It also fails for non-integer keys: you cannot counting-sort strings or floats directly.',
        'Insertion sort fails catastrophically on large random data: a million random elements means 250 billion comparisons. Its O(n²) nature is invisible at n = 20 and career-ending at n = 10⁶.',
        'The meta-lesson: algorithm selection is context-dependent. Input size, input distribution, stability requirement, memory budget, and cache architecture all influence which curve you want to ride.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'n = 10, random permutation. Exact average comparisons for each algorithm:',
        'Bubble sort: n(n−1)/2 = 45 comparisons. Every pair is checked.',
        'Insertion sort: n(n−1)/4 ≈ 22.5 comparisons on average. Each element slides about halfway into the sorted prefix.',
        'Merge sort: n⌈log₂ n⌉ = 10 × 4 = 40 comparisons (the constant is competitive with insertion sort at this size because log₂ 10 ≈ 3.32, rounded up to 4 levels of merging).',
        'Quicksort: 1.39 × 10 × 4 ≈ 55.6 average comparisons. The 1.39 constant actually makes quicksort do more comparisons than merge sort — it wins on wall-clock time because each comparison is cheaper (sequential access, no merge buffer).',
        'Heap sort: 2 × 10 × 4 = 80 comparisons. The factor-of-two overhead is stark at small n, which is why heap sort is never used for small arrays.',
        'Counting sort (k = 10): 10 + 10 + 10 = 30 operations (count, prefix-sum, place). Fewer operations than any comparison sort, but only because we know the range.',
        'At n = 10, insertion sort is the practical winner: fewest comparisons among comparison sorts, O(1) space, simple inner loop, cache-friendly. The crossover where merge sort and quicksort start winning is typically around n = 20–64.',
      ],
    },
    {
      heading: 'Sources and further reading',
      paragraphs: [
        'Knuth, D. E. (1998). The Art of Computer Programming, Volume 3: Sorting and Searching, 2nd edition. The definitive reference for comparison counts, lower bounds, and the decision-tree model. Ford, L. R. and Johnson, S. M. (1959). "A Tournament Problem." The American Mathematical Monthly, 66(5), 387–389 — the merge-insertion algorithm and the information-theoretic lower bound. Sedgewick, R. and Wayne, K. (2011). Algorithms, 4th edition — clear implementations and empirical comparisons.',
        'Related topics on this site: Bubble Sort, Insertion Sort, Merge Sort, Quicksort, Heap Sort, Counting Sort, Big-O Growth Rates. For the lower bound in action: Decision Tree. For hybrid sorts that combine these curves: Timsort, Introsort.',
      ],
    },
  ],
};
