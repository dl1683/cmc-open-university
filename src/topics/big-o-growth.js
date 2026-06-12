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
    { id: 'n2', label: 'n²', fn: (n) => n * n, blurb: 'O(n²) — bubble/insertion/selection sort, nested loops. Fine at n=10. At n=1,000,000 it is ~10⁶ times slower than n log n. This curve is why naive code suddenly hangs in production.' },
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
      invariant: `At n = ${maxN}: log n ≈ ${log2(maxN).toFixed(1)}, n = ${maxN}, n log n ≈ ${Math.round(maxN * log2(maxN))}, n² = ${maxN * maxN}.`,
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
      heading: `What it is`,
      paragraphs: [
        `Big-O describes how an algorithm's work grows as the input size n grows. It does not try to predict exact milliseconds. Instead, it keeps the dominant shape: constant, logarithmic, linear, n log n, quadratic, cubic, exponential. That shape tells you whether an approach survives when n moves from 100 to 1,000,000.`,
        `The usual ladder is O(1), O(log n), O(n), O(n log n), O(n^2), O(n^3), and O(2^n). Hash Table lookup is O(1) on average. Binary Search is O(log n). Linear Search is O(n). Merge Sort is O(n log n). Bubble Sort is O(n^2). Naive branching Recursion can become O(2^n). The notation is a map of danger zones: some curves stay tame, some explode.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start by counting how many times work repeats as n changes. One loop over all items is O(n). A loop inside a loop over the same data is usually O(n^2). Cutting the remaining search space in half each step is O(log n), because log2(1,000,000) is about 20. Splitting into halves and doing linear merging at each level is O(n log n), the shape behind Merge Sort.`,
        `Then simplify. Drop constants: 5n becomes O(n). Drop lower-order terms: n^2 + n + 100 becomes O(n^2). This is not because constants are fake; it is because the highest-growth term eventually dominates. The simplification lets you compare algorithms across machines, languages, and implementations without pretending you know the exact hardware timing.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The numbers get brutal quickly. At n = 1,000,000, an O(n) pass does about one million units of work. O(n log n) with base-2 logs is about 20 million. O(n^2) is one trillion. At one billion operations per second, that is milliseconds versus seconds versus roughly 17 minutes, before real-world memory costs. Space complexity uses the same idea: O(n) space stores one thing per item, while O(n^2) space stores a grid that becomes impossible at large n.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Performance incidents often reduce to growth curves. A page that scans every user for every request works in a demo and collapses at production size. Replacing a repeated scan with Hash Table lookup can change a hot path from O(n) to average O(1). Database Indexing uses tree-shaped structures so lookups are logarithmic instead of full-table scans. Binary Heap (Priority Queue) lets schedulers pull the next urgent item in O(log n) instead of sorting everything after every insert.`,
        `Algorithm choice shows up in product latency. Bubble Sort is fine for a classroom animation and wrong for a million records. Merge Sort and Quick Sort exist because comparison sorting needs about n log n work in the general case. Memoization (Dynamic Programming) can turn repeated recursive subproblems from exponential time into linear or polynomial time by storing answers the first time they are computed.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first misconception is that Big-O is the only thing that matters. Constants, memory layout, branch prediction, and I/O can dominate at small and medium sizes. An O(n) algorithm with a huge constant can lose to an O(n log n) algorithm for realistic n. But asymptotically, O(n) grows slower than O(n log n); the linear algorithm eventually wins if the model keeps applying.`,
        `The second pitfall is mixing best, average, and worst cases. Binary Search has O(1) best case if the target is the first midpoint, but O(log n) worst case. Hash Table has O(1) average lookup but O(n) worst-case collisions. The third pitfall is memorizing labels without deriving them. Count loops, count branching, count how the input shrinks, and the label usually falls out.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Binary Search for logarithmic shrinking, Linear Search for the baseline, and Hash Table for average constant-time lookup. Compare Bubble Sort with Merge Sort to feel the quadratic versus n log n gap. Recursion and Memoization (Dynamic Programming) show why repeated subproblems can be catastrophic or cheap depending on whether you cache them.`,
      ],
    },
  ],
};
