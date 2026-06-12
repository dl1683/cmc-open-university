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
