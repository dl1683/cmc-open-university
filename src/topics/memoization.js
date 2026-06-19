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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation draws the recursive call tree for fib(n). Each node is one function call. An active node (highlighted) is currently computing. A returned node shows its result and has stored that result in the cache.',
        'The key event is the cache hit: a node lights up, finds its answer already stored, and returns instantly without spawning children. The entire subtree that plain recursion would have built is gone. Every cache hit is a pruned exponential branch.',
        'The cache panel below the tree shows every stored result. Each key appears exactly once, the first time that subproblem is solved. Compare the final tree shape to what plain recursion produces (see the Recursion topic). The memoized tree is a thin spine; the naive tree is a bushy explosion.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Richard Bellman coined "dynamic programming" in the 1950s for a class of optimization problems where the best solution can be built from best solutions to smaller pieces. The two requirements are overlapping subproblems (the same smaller question is asked through many paths) and optimal substructure (combining optimal sub-answers gives an optimal overall answer). Memoization is the top-down form of DP: keep the recursive formulation, but add a cache so each subproblem is solved only once.',
        'The need is general. Edit-distance routines ask for the best alignment of the same pair of prefixes from many directions. Parsers ask whether the same substring matches the same grammar rule from many parse paths. Game engines ask for the value of a board position reached by different move orders. Reinforcement-learning agents ask for the value of the same state from many trajectories. In every case, the recursive structure is correct but the execution is redundant. Memoization removes the redundancy without changing the logic.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Write the recurrence directly as code. Fibonacci: fib(n) = fib(n-1) + fib(n-2), with fib(1) = fib(2) = 1. The code mirrors the math. Each call spawns two smaller calls until it reaches a base case, then results propagate back up. For small n this works fine.',
        'The approach is not stupid. It is a faithful translation of the mathematical definition, and it produces correct answers. For any problem with recursive structure, writing the naive recurrence is a natural and honest first step.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Trace fib(6) by hand. fib(6) calls fib(5) and fib(4). fib(5) calls fib(4) and fib(3). Now fib(4) is being computed twice. Each copy of fib(4) calls fib(3) and fib(2). fib(3) is computed three times. fib(2) is computed five times. The total call count for fib(6) is 25. For fib(10) it is 177. For fib(50) it is roughly 25 billion.',
        'The call count grows as O(1.618^n) because the tree branches at every non-base node and the same subproblems appear on many branches. The problem is not recursion itself. The problem is that the call tree forgets every answer the moment it returns. fib(4) is solved from scratch each time it is needed, even though its answer never changes. This is the overlapping-subproblems wall: the number of recursive calls explodes exponentially, but the number of distinct questions is only n.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate the number of function calls from the number of distinct subproblems. If fib(k) always returns the same answer for the same k, then the first call can compute and store it, and every later call can return the stored value in O(1). The work shifts from "one tree node = one computation" to "one unique key = one computation." For Fibonacci, that collapses an exponential tree into a linear chain of n lookups.',
        'This is the idea behind both forms of DP. Top-down (memoization) keeps the recursive structure and adds a cache: before computing, check the cache; after computing, store the result. Bottom-up (tabulation) fills a table iteratively from the smallest subproblems upward, never using recursion at all. Both require the same thing: a subproblem answer depends only on its key, not on the path that asked the question.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A memoized function needs three pieces. First, a cache key built from every input that affects the answer. For Fibonacci the key is just n. For edit distance it is a pair (i, j) of prefix lengths. For knapsack it is (item index, remaining capacity). Second, a lookup: if the key is in the cache, return the stored value immediately. Third, the original computation: if the key is missing, compute the answer recursively, store it under the key, and return it.',
        'Bottom-up tabulation reverses the direction. Define an array (or table) indexed by the subproblem key. Fill base cases first. Then iterate through keys in an order that guarantees every dependency is already filled. For Fibonacci: dp[1] = dp[2] = 1, then for i from 3 to n set dp[i] = dp[i-1] + dp[i-2]. No recursion, no call stack, same O(n) time. Space can be reduced to O(1) by keeping only the two most recent values, since fib(n) depends only on fib(n-1) and fib(n-2).',
        'The state definition is the design decision. What changes between subproblems? What stays fixed? The transition relation says how to combine sub-answers. The base cases anchor the recurrence. Getting these three right is the entire challenge of formulating a DP solution. The caching mechanism is mechanical once the formulation exists.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows by induction over the subproblem dependency graph, which must be a DAG (directed acyclic graph). Base cases are correct by definition. For a non-base subproblem, assume every smaller subproblem it depends on returns the correct answer. The recurrence combines those correct answers exactly as the original mathematical definition specifies, so the result is correct. Storing a correct result does not change its value. Returning it later for the same key is identical to recomputing the same deterministic function.',
        'Optimal substructure ensures that composing optimal sub-solutions gives an optimal overall solution. This is what separates DP problems from problems where local optimality does not compose. Overlapping subproblems ensure that caching actually saves work. Without overlap, memoization adds overhead for no benefit, and divide-and-conquer (like merge sort) is the right framework instead.',
        'The DAG structure matters. If the subproblem dependency graph had cycles, there would be no valid fill order and induction would fail. Every DP problem has an acyclic dependency structure, and each unique subproblem is solved exactly once.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The general formula: time = (number of unique subproblems) * (time to solve each subproblem once its dependencies are available). For Fibonacci: n subproblems, O(1) per subproblem, so O(n) total. For edit distance on strings of length m and n: m*n subproblems, O(1) each, so O(mn). For knapsack with n items and capacity W: n*W subproblems, O(1) each, so O(nW).',
        'Space is the table size plus any recursion overhead. Memoized Fibonacci uses O(n) cache space and O(n) stack depth. Bottom-up Fibonacci uses O(n) table space but no stack. With a rolling array (keeping only the last two values), bottom-up Fibonacci uses O(1) space. This space optimization works whenever a subproblem depends only on a bounded window of earlier subproblems. Edit distance can drop from O(mn) to O(min(m,n)) by keeping only two rows.',
        'Top-down memoization has recursion overhead (stack frames, function-call cost) but only solves reachable subproblems. Bottom-up tabulation avoids recursion but fills every cell in the table, even unreachable ones. When the reachable state space is much smaller than the full table, memoization wins. When nearly all states are reachable and iteration is cache-friendly, tabulation wins.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Fibonacci and similar linear recurrences are the simplest case. Shortest paths: Floyd-Warshall computes all-pairs shortest paths by DP over intermediate vertices in O(n^3). Bellman-Ford computes single-source shortest paths by relaxing edges n-1 times. Edit distance (Levenshtein) measures string similarity in O(mn) and is used in spell-checkers, diff tools, and DNA sequence alignment (Needleman-Wunsch, Smith-Waterman).',
        'Knapsack: given items with weights and values, maximize value within a weight budget. The 0/1 knapsack DP runs in O(nW). Matrix chain multiplication finds the cheapest way to parenthesize a chain of matrix multiplies in O(n^3). CYK parsing checks whether a string belongs to a context-free grammar in O(n^3). Reinforcement learning uses value iteration (Bellman equations applied repeatedly) to find optimal policies over state spaces.',
        'The common thread: a combinatorial explosion of paths through a space, but a manageable number of distinct states. DP turns exponential brute-force into polynomial table-filling by exploiting that structure.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'When subproblems do not overlap, caching adds memory and lookup cost for no benefit. Merge sort splits the array into disjoint halves; each subproblem is unique, so divide-and-conquer is the right tool. Binary search likewise has no overlapping subproblems.',
        'When the state space is exponential, DP does not magically make the problem polynomial. The traveling salesman problem (TSP) can be solved by DP with bitmask states in O(n^2 * 2^n), which is better than O(n!) brute force but still exponential. High-dimensional DP suffers the curse of dimensionality: a 5D state space with 100 values per dimension has 10 billion states.',
        'Bad keys are a practical failure mode. Omitting a parameter from the cache key returns answers from the wrong subproblem. Caching mutable objects and later mutating them corrupts the cache silently. Unbounded caches in long-running services become memory leaks. In concurrent code, two threads can miss the same key simultaneously and duplicate the work unless the cache supports in-flight coordination.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Memoized fib(6), step by step. Call fib(6): not cached, needs fib(5) + fib(4). Call fib(5): not cached, needs fib(4) + fib(3). Call fib(4): not cached, needs fib(3) + fib(2). Call fib(3): not cached, needs fib(2) + fib(1). Call fib(2): base case, returns 1, cached. Call fib(1): base case, returns 1, cached. fib(3) = 1 + 1 = 2, cached. Back in fib(4): needs fib(2), cache hit, returns 1 instantly. fib(4) = 2 + 1 = 3, cached.',
        'Back in fib(5): needs fib(3), cache hit, returns 2 instantly. fib(5) = 3 + 2 = 5, cached. Back in fib(6): needs fib(4), cache hit, returns 3 instantly. fib(6) = 5 + 3 = 8. Total: 11 calls, 3 of which were instant cache hits. Without memoization, fib(6) makes 25 calls. The cache hits pruned 14 calls (and the subtrees they would have spawned).',
        'The savings grow exponentially with n. fib(20): 39 memoized calls versus 21,891 naive calls. fib(50): 99 memoized calls versus roughly 25 billion naive calls. The memoized version is linear; the naive version is exponential. Same recurrence, same answers, entirely different cost.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Bellman, R. (1957). Dynamic Programming. Princeton University Press. The foundational work that named the field and established the principle of optimality. Cormen, Leiserson, Rivest, Stein (2009). Introduction to Algorithms (CLRS), Chapter 15. The standard textbook treatment of DP methodology, including rod cutting, matrix chain, LCS, and optimal BST.',
        'Prerequisites: Recursion (the call tree must be familiar before adding a cache to it) and Hash Table (the cache is typically a hash map, so lookup cost should not be mysterious). Study next: Edit Distance (bottom-up DP over a 2D table, the classic string-alignment problem), Longest Increasing Subsequence (1D DP with binary-search optimization), Knapsack (DP with two state dimensions: item index and remaining capacity), Coin Change (unbounded knapsack variant), Big-O Growth Rates (why exponential-to-polynomial is a qualitative shift, not just a speedup).',
      ],
    },
  ],
};

