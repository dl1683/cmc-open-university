// Memoization: recursion plus a cache. The first step of dynamic
// programming — same call tree as plain fibonacci, dramatically pruned.

import { callTreeState, parseIntegerInRange } from '../core/state.js';

export const topic = {
  id: 'memoization',
  title: 'Memoization (Dynamic Programming)',
  category: 'Concepts',
  summary: 'Cache every answer the first time you compute it — watch the exponential call tree collapse.',
  controls: [
    { id: 'n', label: 'fib(n) for n =', type: 'number', defaultValue: '7' },
  ],
  run,
};

export function* run(input) {
  const n = parseIntegerInRange(input.n, { min: 3, max: 9, label: 'n' });

  const frames = new Map();
  const cache = new Map();
  let counter = 0;
  let calls = 0;
  let hits = 0;
  const snapshot = () => callTreeState([...frames.values()], { calls });
  const cacheText = () => `{ ${[...cache.entries()].map(([k, v]) => `${k}:${v}`).join(', ')} }`;

  yield {
    state: callTreeState([]),
    highlight: {},
    explanation: `Plain recursive fib(${n}) recomputes the same subproblems over and over (see the Recursion topic — the tree explodes). One fix: a CACHE. Before computing anything, check the cache; after computing anything, store it. That's memoization — recursion that never repeats itself.`,
  };

  function* trace(k, parentId) {
    const id = `f${counter++}`;
    calls += 1;

    if (cache.has(k)) {
      hits += 1;
      frames.set(id, { id, parentId, name: 'fib', args: k, status: 'returned', result: cache.get(k) });
      yield {
        state: snapshot(),
        highlight: { returning: [id] },
        explanation: `fib(${k})? CACHE HIT — we already know it's ${cache.get(k)}. Return instantly: no subtree grows here. In the plain version this call would have spawned ${2 * fibValue(k) - 1} calls of its own.`,
        invariant: `Cache so far: ${cacheText()}.`,
      };
      return cache.get(k);
    }

    frames.set(id, { id, parentId, name: 'fib', args: k, status: 'active', result: null });
    if (k <= 2) {
      cache.set(k, 1);
      const frame = frames.get(id);
      frame.status = 'returned';
      frame.result = 1;
      yield {
        state: snapshot(),
        highlight: { returning: [id] },
        explanation: `fib(${k}) is a base case: 1. Store it in the cache on the way out — every answer gets cached the FIRST time it exists.`,
        invariant: `Cache so far: ${cacheText()}.`,
      };
      return 1;
    }

    yield {
      state: snapshot(),
      highlight: { active: [id] },
      explanation: `fib(${k}): not cached yet, so it must be computed the honest way — fib(${k - 1}) + fib(${k - 2}).`,
    };
    frames.get(id).status = 'waiting';
    const a = yield* trace(k - 1, id);
    const b = yield* trace(k - 2, id);
    const result = a + b;
    cache.set(k, result);
    const frame = frames.get(id);
    frame.status = 'returned';
    frame.result = result;
    yield {
      state: snapshot(),
      highlight: { returning: [id] },
      explanation: `fib(${k}) = ${a} + ${b} = ${result} — computed once, cached forever.`,
      invariant: `Cache so far: ${cacheText()}.`,
    };
    return result;
  }

  const result = yield* trace(n, null);
  const naive = 2 * fibValue(n) - 1;

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `fib(${n}) = ${result} in ${calls} calls (${hits} were instant cache hits). Plain recursion needs ${naive} calls — and the gap grows EXPONENTIALLY: fib(50) is ~2.5 trillion calls naive, 99 calls memoized. This idea — solve each subproblem once, reuse it — is dynamic programming, and it powers everything from spell-checkers (edit distance) to route planning.`,
  };
}

// Closed-form helper for the comparison numbers (not part of the lesson).
function fibValue(k) {
  let a = 1;
  let b = 1;
  for (let i = 3; i <= k; i += 1) [a, b] = [b, a + b];
  return k <= 2 ? 1 : b;
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `Memoization is the first and simplest technique in dynamic programming: when you compute an answer, write it down. Before computing anything, check if you have already solved that exact problem — if so, reuse the answer instead of recomputing it. A recursive function plus a cache, where the cache is a lookup table (usually a hash table) that maps input values to their results.`,
        `The name is a play on "memo" — you are writing a memo to your future self, saying "I already solved this problem, and the answer was 42." The result is that instead of exploring an exponential tree of sub-problems, you compute each unique sub-problem exactly once, and every repeat call hits the cache in O(1) time.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `When you call fib(7) with memoization, it opens a frame and immediately checks: have I already computed fib(7)? If yes, return that answer instantly. If no, compute it the normal way — call fib(6) and fib(5). But now when computing fib(6), it calls fib(5) again. However, fib(5) was already computed (as the second sub-call of fib(6)), so the cache hits and that entire subtree disappears. No frame opens, no child calls are made — you just return the stored value.`,
        `The animation shows the call tree shrinking in real-time. Plain recursive fib(7) would make 41 calls; memoized fib(7) makes 13 calls — each unique input from 1 to 7 is computed exactly once. The cache is built up gradually as the recursion unwinds, so later calls (and recursive branches that hit those cached values) skip all the work.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Memoized fib(n) is O(n) time and O(n) space. You compute fib(1), fib(2), ..., fib(n) once each — n operations, each doing one addition and one cache lookup (both O(1)). The space is O(n) because you store n values in the cache, plus O(n) call depth on the stack. Plain recursion is O(2^n) time and O(n) space — so memoization trades a small constant space for an exponential time collapse. For large n the gain is enormous: fib(50) plain is 2.5 trillion calls; memoized is 50 calls.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Memoization powers dynamic programming solutions in spell-checkers (edit distance — the minimum edits to change one word into another), route planning (shortest path — explore all states once, cache the best cost to reach each state), machine learning (dynamic time warping for sequence alignment), compiler optimization, and game-playing engines (chess evaluators memoize position evaluations to prune redundant branches). Any problem that naturally breaks into overlapping sub-problems is a memoization candidate. The key is recognizing when the same sub-problem recurs — if every sub-problem is unique, memoization adds overhead for no gain.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The first pitfall is assuming memoization is a free win. It helps only if you reuse sub-problem results; if every input is unique, memoization just adds cache overhead and memory cost. The second pitfall is weak cache invalidation: if your function has side effects or if its inputs change meaning without changing shape, the cache can return stale answers. The third is the false equivalence between memoization and dynamic programming — memoization is the simplest DP technique, but DP includes many others (bottom-up iteration, matrix chain multiplication, travelling salesman heuristics).`,
        `A common misconception is that memoization is only for pure functions (functions with no side effects). It is safest with pure functions, but you can memoize stateful functions if you are careful about when the cache is valid. Another misconception: memoization requires a global cache. Many implementations use a local cache per function call, or store it in a closure — the strategy depends on the problem structure.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Learn Recursion first to see why re-computation is a problem. Then explore Big-O Growth Rates to feel why O(n) beats O(2^n). Hash Table shows you the O(1) lookup that makes the cache fast. For deeper dynamic programming, study how problems can be solved bottom-up (computing small answers first, building toward the final answer) instead of top-down (memoized recursion), which trades memory for clearer structure. Lastly, LRU Cache shows how to cap the size of your memoization cache when memory runs tight — a critical detail in real systems.`,
      ],
    },
  ],
};

