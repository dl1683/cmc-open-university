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
