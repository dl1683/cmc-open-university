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
        'The animation plots four growth curves on the same axes: log n, n, n log n, and n². The horizontal axis is input size n (how many items your algorithm processes). The vertical axis is operations (how much work the algorithm does). Each frame adds one curve so you can watch the gaps open.',
        'The active curve (highlighted) is the one just added. Previously drawn curves dim so your eye stays on the new shape. The invariant line below each frame shows exact values at the current max n, giving you hard numbers instead of visual guesses.',
        'Focus on the gaps between curves, not the absolute heights. At n = 12 the four curves look close together. At n = 48 they are already separating. At production sizes (thousands to millions), these gaps become the difference between a response in milliseconds and a job that never finishes.',
        {type: 'callout', text: 'Big-O is the shape of work growth, so the right curve matters more than a small benchmark number.'},
        {type: 'image', src: './assets/gifs/big-o-growth.gif', alt: 'Animated walkthrough of the big o growth visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'You have two algorithms that solve the same problem. Which one survives when the input grows from a hundred items to a million? A wall-clock benchmark on your laptop gives you a number for one machine, one compiler, one input, one moment. You need a measure that holds across all of them.',
        'In 1894 Paul Bachmann introduced O notation in his number-theory treatise Die Analytische Zahlentheorie. Donald Knuth popularized it for algorithm analysis in 1976, arguing that computer science needed a machine-independent language for describing how algorithms scale. Big-O is that language.',
        'Big-O strips away constants and hardware details to expose the growth shape of an algorithm\'s cost function. Does work stay flat as input grows? Grow proportionally? Explode? Every algorithm on this site lives on one of these curves, and the curve determines whether the algorithm is viable at scale or destined to hang.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Benchmark it. Run the algorithm on your machine, measure wall-clock time, compare. This works well for quick decisions: profile a function, see it takes 200ms on your test data, ship it.',
        'For a more reproducible comparison, count exact operations. Bubble sort on [3,1,4,1,5] does 10 comparisons and 4 swaps. On a reversed 100-element array: 4,950 comparisons and 4,950 swaps. The counts are precise and deterministic for a given input.',
        'Both approaches feel rigorous. They produce concrete numbers. Engineers trust numbers.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Benchmarks depend on hardware, language, operating system, cache state, background load, and test data. The same algorithm can be 3x faster on a new laptop or 10x slower under memory pressure. Doubling your RAM does not change whether an algorithm is quadratic (meaning its work grows with the square of the input size).',
        'Exact operation counts are better but still brittle. Algorithm A does 3n + 7 steps; algorithm B does 2n + 15. Which is faster? At n = 8 they tie at 31 steps. Below that A loses; above it A wins. And both counts change if you switch from counting comparisons to counting memory accesses.',
        'The deeper problem: constant factors (fixed multipliers like the 3 in 3n) and lower-order terms (smaller pieces like the +7) dominate at small n but become noise at large n. An algorithm doing 0.5n² + 2n steps runs 70 steps at n = 10. At n = 10,000 it does 50,020,000 steps. An O(n log n) algorithm at the same n does about 133,000. No constant factor rescues quadratic growth. You need a measure that survives changes in hardware, language, and scale.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Growth shape is more stable than growth speed. Two algorithms can have wildly different constant factors (one is 5x faster than the other on every input) and still share the same growth shape. If both are linear, doubling n doubles the work for both. The faster one stays faster at every scale, but neither one explodes.',
        'The moment two algorithms have different growth shapes, a crossover point exists. Below it, the algorithm with the worse shape might win because its constants are smaller. Above it, the better shape wins and the gap widens without limit. Big-O focuses on which side of the crossover matters for your problem.',
        'This is the core insight: at large n, the shape of the curve is the only thing that matters. An O(n log n) algorithm written in Python will eventually outrun an O(n²) algorithm written in hand-tuned C. The crossover point might be at n = 50 or n = 5,000, but it always comes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Formal definition: f(n) = O(g(n)) means there exist constants c > 0 and n₀ ≥ 0 such that f(n) ≤ c·g(n) for all n ≥ n₀. In plain language: past some starting point n₀, the function f grows no faster than g, up to a constant multiplier c. The constants c and n₀ absorb hardware differences, language overhead, and small-input quirks. What remains is the growth shape.',
        'To classify a function, keep the fastest-growing term and drop everything else. 5n becomes O(n). 3n² + 5n + 100 becomes O(n²). The dropped terms eventually become rounding errors: at n = 10,000, the 5n term in 3n² + 5n + 100 is 0.017% of the total.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Comparison_computational_complexity.svg', alt: 'Chart comparing common Big-O complexity classes from O(1) to O(n!)', caption: 'Growth rates of common complexity classes. The vertical axis is operations; the horizontal axis is input size. Source: Wikimedia Commons.'},
        'The common complexity classes, slowest growth to fastest: O(1) constant — array index lookup, hash table get. O(log n) logarithmic — binary search, balanced-tree lookup; doubling n adds one step. O(n) linear — scanning every element once. O(n log n) linearithmic — merge sort, heap sort; the theoretical floor for comparison-based sorting. O(n²) quadratic — nested loops comparing every pair; bubble sort worst case. O(2ⁿ) exponential — brute-force subset enumeration; doubles with each added element. O(n!) factorial — brute-force permutation enumeration; grows faster than exponential.',
        'Big-O is an upper bound. Its sibling notations complete the picture. Big-Ω (Omega) is a lower bound: f(n) = Ω(g(n)) means f grows at least as fast as g. Big-Θ (Theta) is a tight bound: f(n) = Θ(g(n)) means f grows at exactly the rate of g, up to constants. Merge sort is Θ(n log n) because it always does n log n work regardless of input order, so its upper and lower bounds match.',
        'Amortized analysis handles operations whose cost varies per call. A dynamic array that doubles its backing storage on overflow costs O(1) amortized per append: the rare O(n) copy is prepaid by the n−1 cheap O(1) appends that preceded it. The accounting method assigns each cheap append a small surcharge; when the expensive resize happens, the accumulated credit covers the cost.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Abstraction is the mechanism. By discarding constants, Big-O separates algorithmic efficiency (the growth shape) from implementation efficiency (the constant factor). A quadratic algorithm in hand-tuned C is still quadratic. A linearithmic algorithm in Python is still linearithmic. At large enough n, the Python version wins because its curve is lower.',
        'Mathematically, the dominant term determines behavior because lower-order terms become a vanishing fraction. In 3n² + 5n + 100 at n = 10,000: 3n² = 300,000,000; 5n = 50,000; 100 = 100. The 5n piece is 0.017% of the total. The n² term owns the bill.',
        'This is why Big-O is useful despite being coarse. It answers the first and most important question — which algorithm has the right growth shape — before you invest time measuring constants, cache effects, and memory layout. Constants vary by machine; growth rate does not.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Logarithm_plots.png', alt: 'Logarithmic function plots showing how log growth flattens compared to linear growth', caption: 'Logarithmic curves flatten as n grows, explaining why O(log n) algorithms stay fast at enormous scale. Source: Wikimedia Commons.'},
        'Concrete numbers at n = 1,000 (assuming one operation = one time unit): O(1) = 1. O(log n) ≈ 10. O(n) = 1,000. O(n log n) ≈ 10,000. O(n²) = 1,000,000. O(2ⁿ) = a number with 301 digits, more than atoms in the observable universe.',
        'At one billion operations per second: O(n²) at n = 1,000 takes 1 millisecond. O(n²) at n = 1,000,000 takes 11.6 days. O(n log n) at n = 1,000,000 takes 20 milliseconds. The jump from n = 1,000 to n = 1,000,000 moves quadratic runtime from imperceptible to career-ending.',
        'The doubling test reveals growth rate viscerally. When n doubles: O(1) stays the same. O(log n) adds one step. O(n) doubles. O(n log n) slightly more than doubles. O(n²) quadruples. O(2ⁿ) squares. If doubling your input quadruples your runtime, you have a quadratic algorithm.',
        'Real algorithms often have multiple input dimensions. A graph algorithm may be O(V + E) where V is vertices and E is edges, not just O(n). A matrix multiply is O(n³) where n is the side length, not the element count n². Naming the right input variable is the first step of any complexity analysis.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Algorithm selection is the primary use. Choosing between an O(n²) sort and an O(n log n) sort is not a style preference; it is the difference between a feature that works and a feature that causes outages. Big-O settles this question before any code is written.',
        'System design and capacity planning rely on growth rates. If your API endpoint does O(n) work per request and traffic doubles monthly, you need 2x capacity each month. If it does O(n²) work, you need 4x. The growth rate determines whether your scaling budget is linear or exponential.',
        'Database query planning uses identical reasoning. A full table scan is O(n). An indexed lookup is O(log n). A nested-loop join on two unindexed tables is O(n·m). The query planner picks the plan with the best growth shape for the estimated row counts.',
        'Interview questions test Big-O fluency because it is the fastest signal of whether an engineer thinks about scale. Recognizing that "nested loop over the same array" means O(n²) prevents an entire class of production bugs before they reach code review.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Constants matter in practice. Quicksort and merge sort are both O(n log n), but quicksort is typically 2–3x faster because it has better cache locality and lower per-operation overhead. Big-O cannot distinguish them.',
        'Cache behavior is invisible to Big-O. An algorithm that walks memory sequentially can be 10–50x faster than one that chases pointers randomly, even at the same complexity class. A linked list is O(1) to insert at the head, but traversing it thrashes the CPU cache. An array is O(n) to insert in the middle, but sequential scans are cache-friendly and fast in practice.',
        'Amortized cost hides worst-case spikes. A dynamic array is O(1) amortized for appends, but one append in a thousand triggers an O(n) resize. For real-time systems — audio processing, game loops, trading engines — that single spike matters more than the average.',
        'Small n makes Big-O irrelevant. If your list never exceeds 20 items, an O(n²) insertion sort beats an O(n log n) merge sort because merge sort\'s constant overhead (allocating temporary arrays, managing recursion) dominates at that scale. Big-O is a large-n tool; using it to optimize a 10-element loop is performance theater.',
        'Analyzing the wrong code path is a common mistake. The average request may be fast while one admin export, one batch job, or one p99 query hits the quadratic path. Complexity analysis must target the paths that actually scale with real traffic.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Array lookup by index: the runtime computes base_address + index * element_size, a single arithmetic operation plus one memory access. The array could hold 10 items or 10 billion; the lookup does the same work. O(1).',
        'Binary search on a sorted array of 1,000,000 elements: compare the middle element, discard half. Recurrence: T(n) = T(n/2) + O(1). Each recursive call halves the remaining elements and does constant work. After log₂(1,000,000) ≈ 20 steps, one element remains. Total: O(log n). Twenty comparisons to search a million items.',
        'Linear scan of the same array: check each element until you find the target or exhaust the array. Worst case: n comparisons. At n = 1,000,000 that is 1,000,000 comparisons versus binary search\'s 20. The linear scan does 50,000x more work, and the gap only widens.',
        'Nested loop (all-pairs): for i in 0..n, for j in 0..n, do constant work. Total: n × n = n². At n = 1,000 that is 1,000,000 operations. Triangular variant (j from i+1 to n): n(n−1)/2 = 499,500 at n = 1,000. Still O(n²) — the 1/2 is a constant that Big-O drops.',
        'Proving 2n + 5 = O(n) from the definition: pick c = 3 and n₀ = 5. For all n ≥ 5: 2n + 5 ≤ 2n + n = 3n. The additive constant 5 and the coefficient 2 are absorbed by the choice of c. What the definition preserves is the linear growth shape.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Bachmann, P. (1894). Die Analytische Zahlentheorie — first published use of O notation. Knuth, D. (1976). "Big Omicron and Big Omega and Big Theta" — standardized asymptotic notation for computer science. Cormen, Leiserson, Rivest, and Stein (2009). Introduction to Algorithms, 3rd ed. — the standard reference for complexity analysis, recurrences, and amortized methods.',
        'See logarithmic growth in action: Binary Search. Compare it against the baseline: Linear Search. Constant-time access: Hash Table. The O(n log n) vs O(n²) gap made concrete: compare Merge Sort with Bubble Sort. Taming exponential blowup: Recursion and Dynamic Programming. Growth rates guiding data-structure choice: Binary Heap, Graph BFS, Topological Sort, Union-Find.',
      ],
    },
  ],
};

