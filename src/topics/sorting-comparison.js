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
        'Each curve shows how a sorting method behaves as input size n grows. Sorting means rearranging items into order; a comparison sort learns order only by comparing pairs of items.',
        {type: 'callout', text: 'Sorting choice is not one leaderboard; it is a contract between input shape, stability, memory, and the comparison lower bound.'},
        'The active curve is the method just added. Watch the curve shape: n squared grows about four times when n doubles, while n log n grows a little more than two times.',
        {type: 'image', src: './assets/gifs/sorting-comparison.gif', alt: 'Animated walkthrough of the sorting comparison visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sorting sits under indexes, joins, reports, search results, render order, and deduplication. Different workloads need different contracts: stable order, low memory, predictable worst case, or support for special key types.',
        'The comparison lower bound explains why no general comparison sort beats O(n log n). To go faster, an algorithm must exploit extra structure such as bounded integer keys or fixed-width digits.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to fix local disorder. Bubble sort swaps adjacent inverted pairs, and insertion sort slides each new item into a sorted prefix.',
        'These algorithms are easy to prove. Bubble sort moves large items to the end; insertion sort keeps the prefix sorted after every insertion. They are also good on tiny or nearly sorted inputs.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is quadratic growth. Bubble sort makes about n(n - 1) / 2 comparisons, and insertion sort makes about n(n - 1) / 4 comparisons on random data.',
        'At n = 1,000,000, those formulas imply hundreds of billions of comparisons. Faster hardware changes constants, but it does not change the curve.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A comparison sort is an information process. There are n! possible orders, and each comparison has only two outcomes, so a decision tree needs height at least log2(n!).',
        'Merge sort, heap sort, and average-case quicksort work near that bound by removing many possible orders with each organized comparison. Counting sort avoids the bound by not comparing items at all.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Merge sort splits the array, sorts each half, then merges two sorted runs by repeatedly taking the smaller front item. Quicksort partitions around a pivot and recurses. Heap sort builds a heap and repeatedly extracts the maximum.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Merge_sort_algorithm_diagram.svg/500px-Merge_sort_algorithm_diagram.svg.png', alt: 'Merge sort diagram showing recursive splits and merges', caption: 'Merge sort spends predictable work at every level: split structure above, merge work below. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Merge_sort_algorithm_diagram.svg.'},
        'Counting sort counts how many times each bounded integer key appears, computes positions from prefix counts, and writes each item into its output region. It trades generality for direct addressing.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The lower bound comes from the decision-tree model. A correct comparison sort needs at least one leaf for each possible input order, so the worst-case path must have length at least log2(n!).',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt: 'Decision tree diagram with branches and leaves', caption: 'The lower bound treats comparison sorting as a decision tree: each comparison can only choose one branch. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Decision_tree_model.png.'},
        'Merge sort is correct by induction: sorted halves plus a merge that always takes the smaller front item produce a sorted whole. Counting sort is correct because prefix counts say exactly how many keys are smaller than each key.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Bubble and insertion sort are O(n squared) on random input. Merge sort and heap sort are O(n log n) worst case, while quicksort is O(n log n) on average with pivot protection and O(n squared) with persistently bad pivots.',
        'Merge sort pays O(n) extra memory for arrays and is stable. Heap sort uses O(1) extra memory but has weaker cache locality. Counting sort costs O(n + k), where k is the key range.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Insertion sort appears inside hybrid library sorts for small partitions. Merge sort fits stable sorting and external sorting from disk. Quicksort-style partitioning fits in-memory arrays because it scans sequentially.',
        'Heap sort fits strict worst-case and low-memory settings. Counting and radix sorts fit bounded integers, bytes, and fixed-width keys where the key structure is stronger than comparison access.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'No curve wins everywhere. Merge sort pays memory, quicksort needs pivot safeguards, heap sort often loses to cache behavior, insertion sort collapses on large random data, and counting sort fails when k dwarfs n.',
        'The common mistake is choosing from Big-O alone. Stability, memory budget, key type, input distribution, adversarial risk, and cache layout all matter.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For n = 10 random items, bubble sort uses about 10 x 9 / 2 = 45 comparisons. Insertion sort averages about 10 x 9 / 4 = 22.5 comparisons.',
        'Merge sort has about 10 x ceil(log2 10) = 40 comparison slots in a simple bound. Average quicksort is about 1.39 x 10 x log2 10, or about 46 comparisons. Heap sort can use around 2 x 10 x 4 = 80 comparisons in a rough upper estimate.',
        'Counting sort with keys 0 through 9 does about 10 counts, 10 prefix steps, and 10 placements. With keys up to 1,000,000, the count array cost dominates and comparison sorts become more sensible.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Knuth Volume 3, Sedgewick and Wayne, Hoare on quicksort, Floyd on heap construction, and decision-tree lower-bound arguments. Keep the lower bound separate from non-comparison tricks.',
        'Next study Bubble Sort, Insertion Sort, Merge Sort, Quicksort, Heap Sort, Counting Sort, Radix Sort, Timsort, Introsort, Big-O Growth, and Cache Locality.',
      ],
    },
  ],
};
