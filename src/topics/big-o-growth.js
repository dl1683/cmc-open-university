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
      heading: 'Why this exists',
      paragraphs: [
        'Big-O exists because timing one run is a weak way to understand an algorithm. Hardware, language runtime, caches, network calls, constants, and test data all move the stopwatch. Growth shape is more portable: what happens to the amount of work when n doubles, grows by 100x, or reaches production scale?',
        'The notation is a warning system. Hash table lookup is O(1) on average. Binary search is O(log n). Linear search is O(n). Merge sort is O(n log n). Bubble sort is O(n^2). Naive branching recursion can become O(2^n). The label is not the whole performance story, but it tells you which approaches are living on borrowed time.',
        'This matters because many programs fail only after success. The demo input has 50 items and the feature is fine. The production table has 50 million rows and the same nested loop is now an incident.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to benchmark both programs on today\'s input and ship the faster one. That is often the right final check, but it is a bad first theory. A nested-loop solution may beat a tree or hash table on 20 items and then fall apart at 20 million.',
        'Another tempting shortcut is to memorize labels. That also fails. Derive the label by counting repeated work: one full pass is O(n), a pass inside a pass is usually O(n^2), repeatedly halving the remaining search is O(log n), and splitting into levels that each touch all n items is O(n log n).',
        'A third mistake is treating Big-O as a moral ranking. O(n) is not always better than O(n log n) in the product range, and O(1) can hide huge constants or memory cost. Big-O rules out bad growth shapes; it does not replace measurement.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is asymptotic dominance. Big-O keeps the term that dominates as n grows. Drop constants: 5n becomes O(n). Drop lower-order terms: n^2 + n + 100 becomes O(n^2). This does not mean constants are fake; it means the highest-growth term eventually owns the bill.',
        'That simplification lets you compare algorithms before you know exact hardware timing. It also explains why better data structures matter: an index, tree, heap, cache, or hash table is usually a way to replace one growth curve with a lower one on the operation that happens most often.',
        'Big-O is usually an upper-bound language. When people say an algorithm is O(n log n), they usually mean its work grows no faster than a constant times n log n after some point. For everyday engineering, the important habit is recognizing the dominant repeated work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To estimate complexity, choose the input size n, identify the operation being counted, and count how many times that operation repeats as n changes. A single loop over n items is linear. A nested comparison of every pair is quadratic. Repeatedly cutting the search space in half is logarithmic.',
        'Recursive algorithms need special care. Merge sort splits the input into levels and touches all n elements at each level, giving O(n log n). A naive Fibonacci recursion recomputes subproblems repeatedly and can grow exponentially. Memoization changes the shape by storing answers.',
        'Data structures change the repeated operation. A hash table turns repeated membership scans into average O(1) lookups. A balanced tree gives O(log n) ordered lookup. A heap gives O(log n) insert and pop-min without sorting the whole queue each time.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'Read the plot by watching the gaps, not the exact y-values. O(log n) hugs the floor because doubling the input adds about one more step. O(n) rises steadily. O(n log n) is a little worse than linear but still controlled. O(n^2) curves away fast enough that small demos lie.',
        'The max-n control is intentionally modest. Even by n = 48 the curves are separating. At real sizes the separation is not cosmetic; it is the difference between instant, slow, and impossible.',
        'The animation also shows why scale changes judgment. On tiny inputs, constant overhead can dominate. As n grows, curve shape takes over. That is why an algorithm that feels fine during development can become the slowest line in production.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Big-O works because many performance disasters are not about one slow instruction. They are about repeated structure. If one request scans one thousand items, that may be fine. If one request scans one thousand items for each of one thousand other items, the structure is now a million comparisons.',
        'It also works as design communication. Saying a lookup path is O(n) tells another engineer where the system will bend. Saying an index changes the path to O(log n) explains why the index exists even before any benchmark numbers arrive.',
        'The notation is intentionally coarse. It throws away details to expose the shape. After that, lower-level performance work can return to constants, memory layout, caches, vectorization, allocation, and I/O.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Lower Big-O is not always cheaper. A hash table may use more memory than a list. A balanced tree may have pointer overhead and worse cache locality. A complex algorithm may be harder to implement correctly than a simple scan over small data.',
        'The right question is the operating range. If n never exceeds 20, a simple O(n^2) routine may be clearer and faster than a sophisticated alternative. If n can reach millions, the same routine becomes a liability.',
        'Complexity analysis also needs a chosen variable. A graph algorithm may be O(V + E), not just O(n). A text algorithm may depend on document length, alphabet size, and pattern length. Naming the input dimensions is part of the analysis.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Big-O is most useful when input size is variable, a path is hot, or a design choice changes the shape of work. Replacing repeated scans with a hash table, using a database index instead of a full-table scan, or using a binary heap so scheduling does not sort the whole queue are all growth-curve decisions.',
        'It is also the shared language behind the rest of this repo. Binary search buys logarithmic shrinking. Merge sort buys n log n sorting. Memoization can turn repeated branching into polynomial work by storing subproblem answers.',
        'It is less useful for fixed-size work, one-off scripts, mostly I/O-bound code, or tiny loops where constants dominate. Even then, it helps rule out designs that would fail if requirements grow.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Big-O is dangerous when it becomes performance theater. Constants, memory layout, branch prediction, allocation, I/O, and cache behavior can dominate at small and medium sizes. An O(n) algorithm with a huge constant can lose to an O(n log n) algorithm on the actual product range.',
        'Also keep the case straight. Binary search has O(1) best case if the target is the first midpoint, but O(log n) worst case. Hash table lookup is O(1) average, not magic; pathological collisions can degrade it. Use Big-O to rule out bad shapes, then benchmark the serious candidates.',
        'A final failure is analyzing the wrong path. The average request may be fine while one admin export, migration job, batch task, or p99 query hits the quadratic path. Complexity should be checked where the product actually scales.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Binary Search for logarithmic shrinking, Linear Search for the baseline, and Hash Table for average constant-time lookup. Compare Bubble Sort with Merge Sort to feel the quadratic versus n log n gap. Recursion and Memoization show why repeated subproblems can be catastrophic or cheap depending on whether you cache them. Then study Binary Heap, Graph BFS, Topological Sort, and Union-Find to see how complexity guides data-structure choice.',
      ],
    },
  ],
};
