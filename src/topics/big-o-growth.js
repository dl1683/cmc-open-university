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
      heading: 'What it is',
      paragraphs: [
        `Big-O is a way to describe how much work an algorithm does as the input gets bigger. It ignores constants (is it 2n or 5n? who cares, it is O(n)). It ignores lower-order terms (n² + n is still O(n²)). What it captures is the shape of the growth curve — the thing that actually matters. A typical input size is small (n = 10), manageable (n = 1,000), large (n = 1,000,000), or enormous (n = 1,000,000,000 and beyond). The Big-O tells you which algorithms survive when n gets large, and which ones die.`,
        `The most common growth rates, from best to worst: O(1) — constant (a single lookup), O(log n) — logarithmic (binary search), O(n) — linear (one pass), O(n log n) — linearithmic (merge sort), O(n²) — quadratic (nested loops), O(n³) — cubic, and O(2^n) — exponential (brute-force recursion). This chart shows you why: at n=1,000,000, the n log n line is barely visible, but the n² line has already left the building.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `To compute the Big-O of an algorithm, count the loops and how many times each loop runs. A single loop over n items is O(n). Two nested loops (outer loop runs n times, inner loop runs n times for each outer iteration) is O(n²). If you halve the input at each step (like binary search), you have O(log n) — because log₂(1,000,000) is roughly 20, not 1,000,000. A for-loop that runs 10 times is O(1), regardless of n — it is a constant you can ignore.`,
        `The real power of Big-O is the dominance principle: only the highest-order term matters. If your algorithm runs 5n² + 3n + 10 operations, it is O(n²) — the n² term grows so much faster than the linear and constant terms that at large n they are noise. This simplification — ignoring constants and lower-order terms — is what makes Big-O such a useful abstraction across different hardware, programming languages, and implementations.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Big-O itself is free; it is just a notation. But the costs it describes are enormous. An O(n) algorithm on 1,000,000 items does about 1,000,000 operations. An O(n²) algorithm on 1,000,000 items does about 1 trillion operations. If your computer does 1 billion operations per second, the O(n) version finishes in 1 second; the O(n²) version takes 1 million seconds (roughly 12 days). That is why the chart matters so much. The space costs are similar: O(n) space means you store n values in memory; O(n²) space means you store a two-dimensional grid, which is feasible at n=1,000 but impossible at n=1,000,000.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Every production system cares about Big-O. Database indexes are O(log n) lookups, not O(n) linear scans. Web servers use hash tables (O(1) lookup) to route requests, not unsorted lists (O(n) search). Sorting pipelines use merge sort (O(n log n)), not bubble sort (O(n²)). Machine learning frameworks use matrix multiplication algorithms that are O(n^2.37) via Strassen's method, not the naive O(n³). When a company's response time jumps from 100ms to 10 seconds overnight, and nothing changed but the data grew from 10,000 items to 1,000,000, you are seeing the O(n²) curve in action — and the fix requires an algorithm redesign, not just faster hardware.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The biggest misconception is that Big-O is the only thing that matters. It is not; constants matter too. An O(n) algorithm with a coefficient of 1,000 can be slower than an O(n log n) algorithm with a coefficient of 1 at modest input sizes. What Big-O tells you is what happens in the limit — as n grows, the O(n log n) algorithm will eventually outpace the O(n) algorithm.`,
        `Another pitfall is conflating best-case, average-case, and worst-case Big-O. Linear search has O(1) best-case (the item is first), O(n) worst-case (it is last or missing), and O(n/2) average-case. When you see "O(n) search," you usually mean worst-case. The third pitfall is memorizing Big-O values without understanding where they come from; if you count the loops, you can derive Big-O yourself instead of guessing.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Read Recursion and Memoization to see Big-O come alive: exponential algorithms are exponential because of the shape of the recursion tree. Study Binary Search to see O(log n) in action — the simplest and most powerful logarithmic algorithm. Then learn Sorting (Bubble Sort, Merge Sort, Quick Sort) to see how algorithm design directly trades Big-O classes. Hash Table and Tree explain how data structures themselves determine Big-O for lookups and insertions. Finally, Divide and Conquer will teach you how to design algorithms that reach the better curves — O(n log n), O(n), sometimes even O(1).`,
      ],
    },
  ],
};

