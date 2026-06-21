// Big-O growth rates, drawn honestly: why O(log n) hugs the floor and
// O(n²) leaves the building. The single most useful chart in CS.

import { plotState, parseIntegerInRange } from '../core/state.js';

export const topic = {
  id: 'big-o-growth',
  title: 'Big-O Growth Rates',
  category: 'Concepts',
  summary: 'Watch log n, n, n log n, and n² grow apart — the chart that explains why algorithms matter.',
  controls: [
    { id: 'maxN', label: 'Grow n up to', type: 'select', options: ['12', '24', '48'], defaultValue: '12' },
  ],
  run,
};

const log2 = (n) => Math.log2(n);

export function* run(input) {
  const maxN = parseIntegerInRange(input.maxN, { min: 12, max: 48, label: 'n' });
  const ns = Array.from({ length: maxN }, (_, i) => i + 1);

  const curves = [
    { id: 'logn', label: 'log n', fn: (n) => log2(n), blurb: 'O(log n) — binary search, balanced-tree lookups. Doubling n adds ONE step. At n = a billion: ~30 steps.' },
    { id: 'n', label: 'n', fn: (n) => n, blurb: 'O(n) — linear search, one pass over the data. Honest, proportional work: double the data, double the time.' },
    { id: 'nlogn', label: 'n log n', fn: (n) => n * log2(n), blurb: 'O(n log n) — merge sort, heap sort. Barely worse than linear in practice, and provably the best any comparison sort can do.' },
    { id: 'n2', label: 'n²', fn: (n) => n * n, blurb: 'O(n²) — bubble/insertion/selection sort, nested loops. Fine at n=10. At n=1,000,000 it is ~10^6 times slower than n log n. This curve is why naive code suddenly hangs in production.' },
  ];

  const series = (visible) => curves.slice(0, visible).map((c) => ({
    id: c.id,
    label: c.label,
    points: ns.map((n) => ({ x: n, y: c.fn(n) })),
  }));
  const axes = { x: { label: 'n (input size)' }, y: { label: 'operations' } };

  yield {
    state: plotState({ axes, series: series(1) }),
    highlight: { active: ['logn'] },
    explanation: `Big-O describes how work GROWS as input grows — constants and hardware aside, it's the shape of the curve that decides whether your code survives real data. We grow n from 1 to ${maxN}, one complexity class at a time. First: ${curves[0].blurb}`,
  };

  for (let i = 1; i < curves.length; i += 1) {
    yield {
      state: plotState({ axes, series: series(i + 1) }),
      highlight: { active: [curves[i].id], visited: curves.slice(0, i).map((c) => c.id) },
      explanation: curves[i].blurb,
      invariant: `At n = ${maxN}: log n â‰ˆ ${log2(maxN).toFixed(1)}, n = ${maxN}, n log n ≈ ${Math.round(maxN * log2(maxN))}, n² = ${maxN * maxN}.`,
    };
  }

  yield {
    state: plotState({ axes, series: series(curves.length) }),
    highlight: {},
    explanation: `All four together. Notice log n is nearly FLAT — that flatness is what every index, tree, and binary search is buying. The gaps you see here at n=${maxN} become astronomical at real sizes: this one chart is why Binary Search beats Linear Search, why Merge Sort beats Bubble Sort, and why hash tables exist at all. Every topic on this site is fighting for a lower curve.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation plots four growth curves on the same axes: log n, n, n log n, and n². The horizontal axis is input size n. The vertical axis is operations. Each frame adds one curve so you can watch the gaps open.',
        'The active curve (highlighted) is the one just added. Previously drawn curves are dimmed. The invariant line below each frame shows the exact values at the current max n, so you can compare numbers instead of guessing from the chart.',
        'Watch the gaps, not the absolute heights. At n = 12 the curves look similar. At n = 48 they are already separating. At real production sizes the separation is the difference between instant, slow, and impossible. The chart is small on purpose: even modest n exposes the shape.',
        {type: 'callout', text: 'Big-O is the shape of work growth, so the right curve matters more than a small benchmark number.'},
      
        {type: 'image', src: './assets/gifs/big-o-growth.gif', alt: 'Animated walkthrough of the big o growth visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'In 1894 Paul Bachmann introduced O notation in his number-theory treatise Die Analytische Zahlentheorie. Donald Knuth popularized it for algorithm analysis in his 1976 paper "Big Omicron and Big Omega and Big Theta," arguing that computer science needed a machine-independent language to describe how algorithms scale.',
        'The problem is simple: you have two algorithms that solve the same task. Which one survives when the input grows from a hundred items to a million? Benchmarking on your laptop gives you a number for one machine, one compiler, one input, one moment. Growth-rate classification gives you an answer that holds across all of them.',
        'Big-O is that classification. It strips away constants and hardware details to expose the shape of the curve: does work stay flat, grow proportionally, or explode? Every algorithm on this site lives on one of these curves, and the curve determines whether the algorithm is viable at scale.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Benchmark it. Run the algorithm on your machine, measure wall-clock time, and compare. This works surprisingly well for quick decisions. Profile a function, see it takes 200ms, ship it.',
        'For a fairer comparison, count exact operations. Bubble sort on [3,1,4,1,5]: 10 comparisons, 4 swaps. On a reversed array of 100 items: 4,950 comparisons, 4,950 swaps. The counts are precise and reproducible for a given input.',
        'Both approaches feel rigorous. They produce real numbers. Engineers trust numbers.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Benchmarks depend on hardware, language, operating system, cache state, background load, and test data. The same algorithm can be 3x faster on a new laptop or 10x slower under memory pressure. Doubling your RAM does not change whether an algorithm is quadratic.',
        'Exact operation counts are better but still brittle. Algorithm A does 3n + 7 steps; algorithm B does 2n + 15. Which is faster? Depends on n. And both counts change if you switch from comparisons to memory accesses as your unit.',
        'The deeper problem: constant factors and lower-order terms dominate at small n but become noise at large n. An algorithm running 0.5n² + 2n steps looks fine at n = 10 (70 steps). At n = 10,000 it does 50,020,000 steps while an O(n log n) algorithm does about 133,000. No constant factor rescues quadratic growth. You need a measure that survives changes in hardware, language, and scale.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Formal definition: f(n) = O(g(n)) means there exist constants c > 0 and n₀ ≥ 0 such that f(n) ≤ c·g(n) for all n ≥ n₀. In plain language: past some starting point, f grows no faster than g up to a constant multiplier. The constants c and n₀ absorb hardware differences and small-input quirks. What remains is the growth shape.',
        'To classify a function, keep the fastest-growing term and drop everything else. 5n becomes O(n). 3n² + 5n + 100 becomes O(n²). The dropped terms eventually become rounding errors as n grows.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Comparison_computational_complexity.svg', alt: 'Chart comparing common Big-O complexity classes from O(1) to O(n!)', caption: 'Growth rates of common complexity classes. The vertical axis is operations; the horizontal axis is input size. Source: Wikimedia Commons.'},
        'The common complexity classes, from slowest growth to fastest: O(1) constant — array index lookup, hash table access on average. O(log n) logarithmic — binary search, balanced-tree lookup; doubling n adds one step. O(n) linear — scanning every element once. O(n log n) linearithmic — merge sort, heap sort; the best any comparison sort can achieve. O(n²) quadratic — nested loops comparing every pair; bubble sort, insertion sort in the worst case. O(2ⁿ) exponential — brute-force subset enumeration; doubles with each added element. O(n!) factorial — brute-force permutation; grows faster than exponential.',
        'Big-O is an upper bound. Its sibling notations complete the picture: Big-Ω (Omega) is a lower bound — f(n) = Ω(g(n)) means f grows at least as fast as g. Big-Θ (Theta) is a tight bound — f(n) = Θ(g(n)) means f grows at exactly the same rate as g, up to constants. Merge sort is Θ(n log n): it always does n log n work regardless of input order, so the upper and lower bounds match.',
        'Amortized analysis handles operations whose cost varies. Three standard methods: aggregate analysis (total cost over n operations divided by n), the accounting method (assign each cheap operation a surcharge that prepays for occasional expensive ones), and the potential method (define a potential function on the data structure state; expensive operations discharge stored potential). A dynamic array that doubles on overflow costs O(1) amortized per insertion because the rare O(n) copy is prepaid by the many O(1) appends.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Abstraction is the mechanism. By discarding constants, Big-O separates algorithmic efficiency from implementation efficiency. A quadratic algorithm implemented in hand-tuned C is still quadratic. A linearithmic algorithm in Python is still linearithmic. At large enough n, the Python version wins because its curve is lower.',
        'Mathematically, the dominant term determines behavior because lower-order terms become a vanishing fraction of the total. In 3n² + 5n + 100, the 5n term is 0.17% of the total at n = 10,000. The constant 100 is 0.00003%. The n² term owns the bill.',
        'This is why the notation is useful even though it is coarse. It answers the first question — which algorithm has the right shape — before you invest time measuring constants, cache behavior, and memory layout. Constants vary by machine. Growth rate does not.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Logarithm_plots.png', alt: 'Logarithmic function plots showing how log growth flattens compared to linear growth', caption: 'Logarithmic curves flatten as n grows, explaining why O(log n) algorithms stay fast at enormous scale. Source: Wikimedia Commons.'},
        'Concrete numbers at n = 1,000, assuming one operation per unit: O(1) = 1. O(log n) = 10. O(n) = 1,000. O(n log n) = 10,000. O(n²) = 1,000,000. O(2ⁿ) = a number with 301 digits, more than atoms in the observable universe. O(n!) is unimaginably larger still.',
        'At one billion operations per second: O(n²) at n = 1,000 takes 1 millisecond. O(n²) at n = 1,000,000 takes 11.6 days. O(n log n) at n = 1,000,000 takes 20 milliseconds. The jump from n = 1,000 to n = 1,000,000 moves quadratic runtime from imperceptible to career-ending.',
        'What happens when n doubles: O(1) stays the same. O(log n) adds one step. O(n) doubles. O(n log n) slightly more than doubles. O(n²) quadruples. O(2ⁿ) squares. The doubling test is the fastest way to feel the growth rate in your gut.',
        'Complexity analysis requires naming the input dimensions. A graph algorithm may be O(V + E), not O(n). A string-matching algorithm may depend on text length m and pattern length p. A matrix multiply is O(n³) where n is the side length, not the element count.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Algorithm selection is the primary use. Choosing between an O(n²) sort and an O(n log n) sort is not a style preference; it is the difference between a feature that works and one that causes outages. Big-O settles this question before any code is written.',
        'System design and capacity planning rely on growth rates. If your API endpoint does O(n) work per request and traffic doubles monthly, you need 2x capacity each month. If it does O(n²) work, you need 4x. The growth rate determines the scaling budget.',
        'Database query plan analysis uses the same thinking. A full table scan is O(n). An indexed lookup is O(log n). A nested-loop join on two unindexed tables is O(n·m). The query planner picks the plan with the best growth shape for the estimated cardinalities.',
        'Technical interviews test Big-O fluency because it is the fastest signal of whether an engineer thinks about scale. Knowing that "nested loop over the same array" means O(n²) prevents an entire class of production bugs.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Constants matter in practice. Quicksort and merge sort are both O(n log n), but quicksort is typically 2–3x faster because it has better cache locality and lower constant overhead. Big-O cannot see this difference.',
        'Cache behavior is invisible. An algorithm that walks memory sequentially can be 10–50x faster than one that chases pointers randomly, even at the same Big-O class. A linked list is O(1) to insert at the head but its traversal destroys the CPU cache. An array is O(n) to insert in the middle but scans are cache-friendly.',
        'Amortized cost is not worst-case cost. A dynamic array is O(1) amortized for appends, but one append in a thousand triggers an O(n) resize. For real-time systems (audio processing, game loops, trading engines), that one spike matters more than the average.',
        'Small n makes Big-O irrelevant. If your list never exceeds 20 items, an O(n²) sort is faster than an O(n log n) sort because the constant overhead of the fancier algorithm dominates. Big-O is a large-n tool. Using it to optimize a 10-element loop is performance theater.',
        'Analyzing the wrong path is a common failure. The average request may be fine while one admin export, batch job, or p99 query hits the quadratic code path. Complexity analysis must target the paths that actually scale.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Array lookup by index: one pointer addition and one memory access regardless of array size. O(1).',
        'Binary search: compare the middle element, discard half. Recurrence: T(n) = T(n/2) + O(1). Each call halves the problem and does constant work. Depth: log₂(n). Total: O(log n). Searching 1,000,000 sorted items takes at most 20 comparisons.',
        'Linear scan: check each element once. T(n) = n comparisons in the worst case. O(n). Simple, but scanning 1,000,000 items when binary search takes 20 comparisons is 50,000x more work.',
        'Nested loop: for i in 0..n, for j in 0..n, do constant work. Total: n × n = n² operations. O(n²). Variant with triangular iteration (j from i to n): n + (n−1) + ... + 1 = n(n+1)/2. Still O(n²) — the 1/2 is a constant that Big-O drops.',
        'Why 2n + 5 is O(n): pick c = 3 and n₀ = 5. For all n ≥ 5, 2n + 5 ≤ 3n. The constant 5 and the coefficient 2 are absorbed by the choice of c. What remains is linear growth.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Bachmann, P. (1894). Die Analytische Zahlentheorie — first use of O notation. Knuth, D. (1976). "Big Omicron and Big Omega and Big Theta" — standardized asymptotic notation for computer science. Cormen, Leiserson, Rivest, and Stein (2009). Introduction to Algorithms, 3rd edition — the standard reference for complexity analysis and amortized methods.',
        'Logarithmic growth in action: Binary Search. The baseline comparison: Linear Search. Constant-time access: Hash Table. The O(n log n) vs O(n²) gap: compare Merge Sort with Bubble Sort. Taming exponential blowup: Recursion and Dynamic Programming. Growth rates guiding data-structure choice: Binary Heap, Graph BFS, Topological Sort, Union-Find.',
      ],
    },
  ],
};

