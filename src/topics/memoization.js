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
      heading: 'Why this exists',
      paragraphs: [
        `Memoization exists because many recursive programs answer the same smaller question again and again. The code may be mathematically clean, but the work ledger is wasteful. In Fibonacci, fib(6) asks for fib(5) and fib(4). The fib(5) branch asks for fib(4) again. A larger input repeats fib(4), fib(3), fib(2), and many other calls through many branches. Nothing about the definition is wrong; the problem is that the call tree forgets every answer as soon as it returns.`,
        `This pattern appears far beyond toy Fibonacci. A parser may ask whether a substring can be parsed under the same grammar rule. An edit-distance routine may ask for the best way to align two prefixes. A game search may ask for the value of a board position reached by different move orders. A compiler analysis may revisit the same state from several control-flow paths. Memoization gives those programs a memory: once a subproblem is solved, later calls can reuse the result instead of rebuilding the same proof.`,
      ],
    },
    {
      heading: 'The reasonable first attempt',
      paragraphs: [
        `The first attempt is ordinary recursion. It is not foolish. For many problems, recursion states the structure of the answer more clearly than a loop. Fibonacci says the nth value is the sum of the previous two. A tree problem says solve the left subtree, solve the right subtree, and combine them. A dynamic programming recurrence says the best answer for a large state depends on best answers for smaller states. Direct recursion keeps that dependency visible.`,
        `The wall appears when the recursion tree is larger than the set of distinct questions. Fibonacci is the sharpest small example: plain fib(n) branches into fib(n - 1) and fib(n - 2), and most of those descendants overlap. The number of calls grows exponentially even though there are only n interesting Fibonacci inputs from 1 through n. The program is not doing hard new thinking on each branch. It is redoing old thinking because it has no durable record that fib(7), fib(6), or fib(5) was already solved.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to separate the number of calls from the number of distinct subproblems. If a function is deterministic for a given input state, the first call can compute the answer and store it under a key. Later calls with the same key can return the stored answer immediately. That changes the work model from "one call tree node means one computation" to "one distinct key means one computation." For Fibonacci, that collapses an exponential tree into a linear list of solved inputs.`,
        `This is the top-down face of dynamic programming. Bottom-up dynamic programming builds a table in an order chosen ahead of time. Memoization starts with the final question and fills the table only for states that are actually reached. The two styles share the same requirement: a subproblem answer must be reusable without remembering the path that produced it. When that requirement holds, the cache becomes a proof ledger. Each entry says, "this input state has a settled answer."`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `A memoized function has three steps. First, build a cache key from all inputs that affect the answer. Second, check whether that key already has a value. Third, if the key is missing, run the original computation, store the result, and return it. The recursive structure does not need to disappear. In a memoized Fibonacci routine, fib(8) still asks for fib(7) and fib(6). The difference is that when fib(6) has already been solved while computing fib(7), the second request becomes a cache hit instead of a new subtree.`,
        `The key is the contract. For simple Fibonacci, the key is just n. For edit distance, it may be a pair of prefix lengths. For parsing, it may include a grammar symbol and a span. For game search, it may include board position, player to move, castling rights, ko history, or any other rule state that can affect the value. A cache that omits part of the state can be faster and wrong. Memoization is only sound when equal keys really mean equal answers.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The visual proof is the shrinking call tree. A plain recursive tree keeps opening branches for the same labels. The memoized trace still descends the first time a label appears, but later frames stop early as cache hits. That is not a cosmetic optimization. It shows the exact moment where the algorithm converts future exponential branching into constant-time lookup for an already-solved state.`,
        `The cache panel is the invariant made visible. Every stored row is a completed subproblem. The algorithm never uses a row before it has been computed, and it never needs to recompute a row after it has been stored. If a later call asks for a key in the cache, the correct answer is already available because that key describes the same subproblem. The visual therefore proves the main claim: repeated structure, not recursion itself, is the source of the speedup.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness argument is simple induction over the dependency graph of subproblems. Base cases are returned directly and can be stored as known truths. For a non-base state, assume every smaller state requested by the recurrence returns the correct answer. The original recursive formula combines those correct answers exactly as before, so the computed result is correct. Storing that result does not change its value. Returning it later for the same key is equivalent to recomputing the same deterministic recurrence.`,
        `Memoization does not make an invalid recurrence valid. It preserves the meaning of the original pure computation while avoiding duplicated evaluation. If the recurrence has cycles with no base case, memoization may detect the cycle or loop forever depending on implementation, but it does not solve the mathematical problem. If the function reads hidden state, mutation, time, randomness, files, permissions, or network responses, the induction breaks unless those influences are represented in the key or excluded by design.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `For memoized Fibonacci, time is O(n), cache space is O(n), and recursive stack depth is O(n). Doubling n roughly doubles the number of distinct inputs, not the number of branches. For a general memoized recurrence, time is about the number of reachable states times the cost to compute each state after dependencies are available. Space is the number of retained states times the size of each answer and key. The dominant cost often moves from repeated computation to memory retention and lookup overhead.`,
        `That trade is not always worth it. If subproblems rarely repeat, the cache adds hash-table work and memory pressure without saving much computation. If the state space is enormous, memoization can run out of memory before it runs out of time. Long-running services need bounded caches, eviction policies, freshness rules, and metrics. A contest solution may keep every state until the function returns. A production service must decide which entries can expire and what happens when the answer changes.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Memoization wins when the same pure subproblem is reached through many paths. Classic examples include edit distance, sequence alignment, word break, matrix-chain multiplication, top-down knapsack, tree dynamic programming with repeated states, regular-expression and parser memoization, game search with transposition tables, and graph algorithms over state spaces. It is especially useful when the reachable part of the state space is much smaller than the full bottom-up table would be.`,
        `It also works as an engineering pattern. Expensive pure computations can be cached behind a stable key: normalized query plans in a database, compiled regular expressions, parsed templates, feature transformations, or deterministic model preprocessing. The same lesson applies: cache only when key equality means answer equality. Memoization is not "make it faster" magic. It is a precise reuse contract for work that has already been proven equivalent.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The most common failure is a bad key. Leaving out a parameter, locale, configuration flag, user permission, random seed, version, or timestamp can return an answer from the wrong world. Another failure is caching mutable objects and then modifying them through an alias. The cache may still point at the same object, but the stored answer no longer means what it meant when inserted. A third failure is unbounded growth: a cache that remembers every unique request can become a memory leak with better branding.`,
        `Memoization can also hide algorithmic limits. Fibonacci becomes linear, but some dynamic programs have millions or billions of distinct states. A memoized solver for an NP-hard search can still be exponential; it only avoids repeated states. In concurrent code, duplicate work can happen when several threads miss the same key at once unless the cache supports in-flight entries or locking. In distributed systems, memoization becomes cache invalidation, consistency, and ownership, not just a local map.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Recursion first so the call structure is clear, then Hash Table so cache lookup cost is not mysterious. Big-O Growth Rates explains why exponential branching is qualitatively different from linear state growth. Edit Distance shows bottom-up dynamic programming over a two-dimensional table. Rerooting DP shows how tree answers can be reused across roots. LRU Cache and W-TinyLFU explain bounded caches when memory cannot grow forever. Value Iteration shows the same "state plus reusable value" idea in reinforcement learning and planning.`,
      ],
    },
  ],
};
