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
      heading: `What it is`,
      paragraphs: [
        `Memoization is Recursion plus memory. When a function solves a subproblem, it stores the answer in a cache. The next time the exact same subproblem appears, the function returns the cached value instead of growing another subtree. In the visualization, plain Fibonacci repeats the same work again and again; memoized Fibonacci turns those repeated calls into instant cache hits. The cache display grows alongside the call tree so you can see exactly when reuse becomes possible.`,
        `The cache is usually a Hash Table from input to output, which is why lookup is expected O(1). This is the top-down form of dynamic programming: start from the big question, recurse into smaller questions, and remember each answer the first time it is discovered.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `For the default fib(7), the first path computes fib(6), fib(5), and so on down to the base cases. As the recursion unwinds, fib(1), fib(2), fib(3), and later values are stored. When a later branch asks for fib(5), the cache already has it, so the whole subtree disappears. The call frame returns immediately with the stored number.`,
        `The demo's counters make the collapse visible. With this Fibonacci definition, naive fib(7) needs 25 calls. The memoized run makes 11 calls, including 4 cache hits, because each unique input from 1 through 7 is computed once and repeated requests are answered from memory. Big-O Growth Rates is the reason that small-looking gap becomes decisive as n grows.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Memoized fib(n) is O(n) time and O(n) cache space, plus O(n) call-stack depth in this recursive version. Plain recursive Fibonacci is exponential because the same subtrees are rebuilt. Memoization trades memory for time: store n answers and remove the recomputation. More generally, the runtime becomes "number of distinct subproblems" times the cost of solving each one after its children are known. A bottom-up table can keep the same O(n) time while reducing stack usage; for Fibonacci specifically, two rolling variables reduce extra space to O(1).`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Memoization powers Edit Distance (DP Table), sequence alignment, parsing, compiler optimization, and game search. Chess engines store evaluated positions in transposition tables so the same board reached by a different move order is not analyzed twice. Value Iteration (Reinforcement Learning) uses the same "reuse solved subproblems" instinct when values are updated across states. Dijkstra's Shortest Path is not memoized recursion, but it shares the discipline of recording the best known answer for a state instead of rediscovering it.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Memoization helps only when subproblems overlap. If every input is unique, the cache adds lookup overhead and memory pressure without saving work. It is safest for pure functions; if hidden state, time, randomness, permissions, or external files affect the answer, the cache key must include those facts or the result can go stale.`,
        `The cache also needs a size story. Long-running programs cannot memoize forever. LRU Cache shows the usual production answer: keep the most useful entries and evict old ones. Memoization (Dynamic Programming) is a technique, not a guarantee that memory is free.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Recursion first, then Hash Table and Big-O Growth Rates to understand why the cache changes the curve. Edit Distance (DP Table) shows the bottom-up table version of the same idea. LRU Cache explains bounded caches, and Value Iteration (Reinforcement Learning) shows dynamic programming after the subproblems become states in a decision process.`,
      ],
    },
  ],
};
