// The Fenwick tree (binary indexed tree): prefix sums in O(log n) with
// nothing but an array and one bit trick — each index quietly responsible
// for exactly as many elements as its lowest set bit says.

import { arrayState, parseNumberList, parseNumber, InputError } from '../core/state.js';

export const topic = {
  id: 'fenwick-tree',
  title: 'Fenwick Tree (Binary Indexed Tree)',
  category: 'Data Structures',
  summary: 'One array, one bit trick — lowbit(i) — and both prefix sums and updates run in O(log n), walked live on your numbers.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '3, 2, -1, 6, 5, 4, -3, 3' },
    { id: 'prefixUpTo', label: 'Prefix sum of first…', type: 'number', defaultValue: '6' },
    { id: 'addAmount', label: 'Then add', type: 'number', defaultValue: '2' },
    { id: 'addAt', label: '…at position', type: 'number', defaultValue: '3' },
  ],
  run,
};

const lowbit = (i) => i & -i;
const bin = (i) => i.toString(2);

function buildTree(values) {
  const n = values.length;
  const tree = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    tree[i] += values[i - 1];
    const parent = i + lowbit(i);
    if (parent <= n) tree[parent] += tree[i];
  }
  return tree;
}
const coverage = (i) => `${i - lowbit(i) + 1}…${i}`;

export function* run(input) {
  const values = parseNumberList(input.values, { max: 16 });
  const n = values.length;
  const k = parseNumber(input.prefixUpTo, { label: 'a prefix length' });
  const delta = parseNumber(input.addAmount, { label: 'an amount to add' });
  const at = parseNumber(input.addAt, { label: 'a position' });
  if (!Number.isInteger(k) || k < 1 || k > n) throw new InputError(`Prefix length must be a whole number between 1 and ${n}.`);
  if (!Number.isInteger(at) || at < 1 || at > n) throw new InputError(`The update position must be a whole number between 1 and ${n}.`);

  const tree = buildTree(values);
  const treeCells = () => tree.slice(1);

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `The problem: answer "what is the sum of the first k values?" AND "add δ to position i" — both fast, many times, interleaved. A plain array answers updates in O(1) but prefix sums in O(n); a precomputed prefix array inverts the trade (sums O(1), updates O(n)). The Fenwick tree (Peter Fenwick, 1994) refuses the trade: ONE array of the same length, both operations in O(log n) — for n = 1,000,000, that's ~20 steps instead of a million. The price is one idea: each slot stops storing one value and starts storing a carefully chosen RANGE sum.`,
  };

  yield {
    state: arrayState(treeCells()),
    highlight: { active: ['i3', 'i5', 'i6'] },
    explanation: `The same ${n} slots, reorganized (positions are 1-based here — the trick needs it). Slot i is responsible for exactly lowbit(i) values ending at i, where lowbit(i) = i & −i isolates the lowest set bit of i's binary form. Slot 4 (binary ${bin(4)}): lowbit = 4, so it stores values 1…4 = ${tree[4]}. Slot 6 (binary ${bin(6)}): lowbit = 2, so values 5…6 = ${tree[6]}. Slot 7 (binary ${bin(7)}): lowbit = 1, just value 7 = ${tree[7]}. Odd slots hold single values; powers of two hold everything up to themselves. The binary representation of each index IS the data structure — no pointers, no nodes, only arithmetic (the same bits-as-structure spirit as Binary Exponentiation).`,
    invariant: 'Slot i stores the sum of the lowbit(i) values ending at i: the index\'s binary form decides its responsibility.',
  };

  const visits = [];
  for (let i = k; i > 0; i -= lowbit(i)) visits.push(i);
  let running = 0;
  for (let v = 0; v < visits.length; v++) {
    const i = visits[v];
    running += tree[i];
    yield {
      state: arrayState(treeCells()),
      highlight: { active: [`i${i - 1}`], visited: visits.slice(0, v).map((x) => `i${x - 1}`) },
      explanation: `Prefix sum of the first ${k}: start at slot ${i === k ? `${k} (binary ${bin(k)})` : `${i}`} — it contributes its whole range ${coverage(i)}: +${tree[i]}, running total ${running}. ${i - lowbit(i) > 0 ? `Now strip the lowest set bit: ${i} (${bin(i)}) − ${lowbit(i)} → ${i - lowbit(i)} (${bin(i - lowbit(i))}), whose range ends exactly where this one began.` : `Stripping the lowest bit reaches 0: every value in 1…${k} has been counted exactly once. Answer: ${running}.`}`,
      invariant: 'Query walk: i → i − lowbit(i). The visited ranges tile 1…k perfectly — one slot per set bit of k.',
    };
  }
  const before = running;

  const touches = [];
  for (let i = at; i <= n; i += lowbit(i)) touches.push(i);
  for (let t = 0; t < touches.length; t++) {
    const i = touches[t];
    tree[i] += delta;
    yield {
      state: arrayState(treeCells()),
      highlight: { found: [`i${i - 1}`], visited: touches.slice(0, t).map((x) => `i${x - 1}`) },
      explanation: `Update: add ${delta} at position ${at}. ${t === 0 ? `Every slot whose range CONTAINS position ${at} must learn about this — and they're found by the mirror walk: i → i + lowbit(i).` : ''} Slot ${i} (range ${coverage(i)}) becomes ${tree[i]}. ${i + lowbit(i) <= n ? `Next: ${i} + lowbit(${i}) = ${i + lowbit(i)}.` : `${i + lowbit(i)} exceeds ${n} — done: ${touches.length} slots touched, not ${n}.`}`,
      invariant: 'Update walk: i → i + lowbit(i) visits exactly the slots whose ranges cover position i — O(log n) of them.',
    };
  }

  let after = 0;
  for (let i = k; i > 0; i -= lowbit(i)) after += tree[i];
  yield {
    state: arrayState(treeCells()),
    highlight: { found: visits.map((x) => `i${x - 1}`) },
    explanation: `Verify: re-run the same prefix query. The walk visits the same slots and now returns ${after}${at <= k ? ` — exactly ${before} + ${delta}, because position ${at} lies inside the first ${k}` : ` — unchanged from ${before}, because position ${at} lies OUTSIDE the first ${k}, and no slot on the query path covers it`}. Two walks, mirror images: queries strip the lowest bit, updates add it. This is why Fenwick trees power leaderboards (rank = prefix count), inversion counting, and arithmetic coders — anywhere running totals and edits interleave. When you need range MIN instead of sums, or range updates, step up to a segment tree: twice the memory, four times the code, strictly more power.`,
    invariant: 'prefix(k) after update(i, δ) = old prefix(k) + δ·[i ≤ k]: both walks are O(log n), and they never disagree.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A Fenwick tree (or binary indexed tree) is a single array that answers two interleaved questions in O(log n) time: "What is the sum of the first k elements?" and "Add δ to position i". It refuses the classic trade-off: a plain array gives you O(1) updates and O(n) prefix sums; a precomputed prefix array gives O(1) sums but O(n) updates. The Fenwick tree (invented by Peter Fenwick in 1994) does both in O(log n) steps — for n = 1,000,000, that's ~20 operations instead of a million. The trick is pure arithmetic: each slot stores the sum of a carefully chosen range, and the binary representation of the index IS the data structure.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The key insight is lowbit(i) = i & −i, which isolates the lowest set bit of i's binary representation. This single line of code unlocks the whole structure. Slot i holds the sum of exactly lowbit(i) elements ending at position i: slot 4 (binary 0100) has lowbit 4, so it stores elements 1…4; slot 6 (binary 0110) has lowbit 2, so it stores elements 5…6; slot 7 (binary 0111) has lowbit 1, so it stores only element 7. Odd slots carry single elements; powers of two carry large ranges. The magic lies in this pattern: one 1-based array, and your bit positions decide what you own.`,
        `Prefix queries walk from position k downward, stripping the lowest bit at each step: k → k − lowbit(k) → k − lowbit(k) − lowbit(k − lowbit(k)) → 0. Each step visits one slot whose range ends exactly where the last one began, so all ranges tile 1…k perfectly with no gaps and no overlap. For k = 6 (binary 0110), the walk is 6 → 4 → 0, visiting slots 6 and 4 — covering ranges 5…6 and 1…4, which exactly partition 1…6.`,
        `Updates walk the mirror image: from position i upward, adding lowbit at each step: i → i + lowbit(i) → i + lowbit(i) + lowbit(i + lowbit(i)) → overflow. Every slot whose range contains position i is found and updated in O(log n) steps — the two walks are inverses, and together they ensure one shared array stays consistent. If you add 2 at position 3, the walk touches slots 3, 4, and 8; each slot's range contains position 3, so they all get the same delta.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Both prefix sum and update run in O(log n) time: walk the bit representation, and you visit at most O(log n) slots. Space is O(n) — one array, same size as the input. Building the tree from an array takes O(n log n): insert each element with an update walk. For static data with no updates, a simple prefix-sum array is faster (O(1) queries, O(n) build). Fenwick trees shine when reads and writes interleave — leaderboards, real-time analytics, inversion counting. If you need range minimum or maximum instead of sum, or range updates instead of point updates, you need a segment tree: twice the memory, but much more power. Fenwick trees are the sweet spot for sum queries only.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Leaderboards and rank queries: store point deltas, query the cumulative score in O(log n). Inversion counting in competitive programming: count pairs (i, j) where i < j but a[i] > a[j] in one O(n log n) pass. Arithmetic coding: Fenwick invented this for compressing data — each symbol's frequency prefix is queried and updated with every encoded character. Analytics dashboards: track running totals of events with rapid updates. Any situation where you need fast, ordered running sums under concurrent edits — a Fenwick tree is the first choice before leaping to heavier structures.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The lowbit trick (i & −i) only works in two's complement arithmetic — do not build a Fenwick tree in languages without sign-extended right shifts or two's complement representation without this line. If your data never changes after build, use a plain prefix-sum array; Fenwick trees add logic overhead for zero updates. Do not confuse the tree with a real tree structure: it is one array, and the "tree" is only in the binary arithmetic — there are no pointers or children. The 1-based indexing is not optional; 0-based indexing breaks the bit logic because lowbit(0) = 0, collapsing the whole invariant.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `"Binary Exponentiation" builds the same bit-scan pattern for O(log n) exponents. "Binary Search" shares the divide-by-two logarithmic thought. "Binary Heap (Priority Queue)" is another O(log n) dynamic structure, but heap-ordered instead of sum-ordered. "B-Trees (How Databases Read)" tackles range queries on disk at a different scale. Start with exponentiation to see the bit pattern in action, then search for the binary-divide spirit everywhere.`,
      ],
    },
  ],
};

