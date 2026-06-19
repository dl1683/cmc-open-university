// Fisher-Yates shuffle: walk from the end, swap each position with a random
// earlier one, and every permutation is equally likely. O(n) time, O(1) space.

import { arrayState, InputError } from '../core/state.js';

export const topic = {
  title: 'Fisher-Yates Shuffle',
  slug: 'fisher-yates-shuffle',
  category: 'Algorithms',
  summary:
    'Generate a uniformly random permutation in O(n) — swap each element with a random earlier position, and every ordering is equally likely',
  defaultInput: 'A B C D E F',
  controls: [
    { id: 'elements', label: 'Elements (space-separated)', type: 'text', defaultValue: 'A B C D E F' },
  ],
  run,
};

// Simple LCG seeded from input length for reproducible demos.
// Constants from Numerical Recipes (m = 2^32).
function makeLCG(seed) {
  let state = (seed | 0) >>> 0;
  return function next(max) {
    // advance: state = (a * state + c) mod 2^32
    state = (1664525 * state + 1013904223) >>> 0;
    return state % (max + 1);
  };
}

const prefixIds = (count) => Array.from({ length: count }, (_, i) => `i${i}`);
const suffixIds = (from, to) => Array.from({ length: to - from }, (_, i) => `i${from + i}`);

function parseElements(text) {
  const parts = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    throw new InputError('Enter at least 2 elements, separated by spaces.');
  }
  if (parts.length > 12) {
    throw new InputError('Enter at most 12 elements so every step stays readable.');
  }
  return parts;
}

export function* run(input) {
  const values = parseElements(input.elements);
  const n = values.length;
  const rand = makeLCG(n * 7 + 3); // seed from input length

  yield {
    state: arrayState(values),
    highlight: {},
    explanation:
      `Starting array: [${values.join(', ')}]. The Fisher-Yates shuffle will walk from the last position to the first, swapping each element with a randomly chosen element from the unshuffled portion. After each swap the element at that position is in its final random place.`,
  };

  for (let i = n - 1; i >= 1; i -= 1) {
    const j = rand(i); // random index in [0..i]

    yield {
      state: arrayState(values),
      highlight: {
        active: [`i${i}`, `i${j}`],
        sorted: i < n - 1 ? suffixIds(i + 1, n) : [],
      },
      explanation:
        `Pick random position j=${j} from 0..${i}. Swap elements at positions ${i} and ${j}: "${values[i]}" and "${values[j]}". Element at position ${i} is now in its final random position.`,
      invariant:
        `Positions ${i + 1}–${n - 1} are locked — each landed there with exactly 1/n probability.`,
    };

    // perform the swap
    [values[i], values[j]] = [values[j], values[i]];

    yield {
      state: arrayState(values),
      highlight: {
        swap: [`i${i}`, `i${j}`],
        sorted: suffixIds(i, n),
      },
      explanation:
        `After swap: [${values.join(', ')}]. Position ${i} is now locked with "${values[i]}".`,
    };
  }

  yield {
    state: arrayState(values),
    highlight: { sorted: prefixIds(n) },
    explanation:
      `Shuffle complete: [${values.join(', ')}]. Every permutation had equal probability 1/${n}! = 1/${factorial(n)}. The algorithm used ${n - 1} swaps, ${n - 1} random numbers, and O(1) extra space.`,
  };
}

function factorial(n) {
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation walks the array from right to left. At each step, the active highlights show the two positions being considered for a swap — position i (the current slot being assigned) and position j (the randomly chosen partner).',
        'After a swap, both positions flash as swap markers. The locked suffix (green/sorted highlights) grows leftward by one element each round. Once an element enters the locked suffix, it never moves again.',
        'Watch the locked zone grow: after k rounds, the rightmost k positions hold their final values. The shrinking unshuffled prefix is where all remaining randomness lives.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Randomization is fundamental to computing. Monte Carlo simulations need random samples. A/B tests need random assignment. Card games need fair deals. Cryptographic nonces need unpredictable sequences. Permutation tests in statistics need uniformly random orderings to build null distributions.',
        'All of these start from the same primitive: take n objects and arrange them in a uniformly random order, meaning every one of the n! possible orderings is equally likely. The Fisher-Yates shuffle is the canonical algorithm for doing this correctly in O(n) time and O(1) extra space.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first idea most people reach for: assign each element a random key, then sort by those keys. This works and produces a uniform permutation, but sorting costs O(n log n) — wasteful when the problem only needs O(n) work.',
        'A faster-looking idea: for each position i, swap a[i] with a[random(0..n-1)]. This "swap with any index" approach is O(n) and looks reasonable. It is also wrong.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The naive swap-with-any-index loop makes n independent choices, each from n options, producing n^n possible execution paths. For n=3, that is 27 paths. But there are only n! = 6 permutations. Since 27 is not divisible by 6, some permutations must appear more often than others. The shuffle is biased.',
        'This is the wall: n^n does not divide evenly into n! for any n > 2. No matter how you map n^n equally likely execution paths onto n! outcomes, some outcomes get more paths than others. The bias is not a rounding error — for n=3 some permutations are 50% more likely than others.',
        'The sort-by-random-keys approach avoids bias but pays O(n log n). The challenge is getting uniformity in O(n).',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Restrict the random range. Instead of picking from [0..n-1] at every step, pick from [0..i] at step i. Walking from position n-1 down to 1, each step assigns exactly one position its final element by swapping a[i] with a[random(0..i)].',
        'This produces exactly n * (n-1) * (n-2) * ... * 1 = n! equally likely execution paths — one per permutation. The bijection between paths and permutations is what guarantees uniformity.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start at the last index i = n-1. Generate a random integer j uniformly in [0..i]. Swap a[i] and a[j]. Position i is now final. Decrement i and repeat until i = 0.',
        'Each round shrinks the unshuffled prefix by one and grows the locked suffix by one. The element at position j moves to position i (locked), and the element that was at position i moves to position j (still in play for future rounds). When i reaches 0, the single remaining element is already in its only possible position.',
        'Trace with [A, B, C, D]: i=3, j=rand(0..3)=1 gives swap(D,B) producing [A, D, C, B]. i=2, j=rand(0..2)=0 gives swap(C,A) producing [C, D, A, B]. i=1, j=rand(0..1)=1 gives swap(D,D) — no change. Result: [C, D, A, B].',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Proof by induction on the array length. For n=1, the single element is already in its only position — trivially uniform.',
        'Inductive step: assume the algorithm produces a uniform permutation of k elements. For k+1 elements, the first random choice picks j uniformly from [0..k]. Element a[j] lands at position k with probability 1/(k+1). The remaining k elements occupy positions 0..k-1, and by the inductive hypothesis, the subsequent k-1 swaps shuffle them uniformly. Each element has probability 1/(k+1) of landing at any position.',
        'More directly: the probability that element e ends up at position p is the product of "not picked at earlier rounds" and "picked at round p." Computing this product gives exactly 1/n for every (element, position) pair. That is the definition of a uniform random permutation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: exactly n-1 swaps and n-1 random number generations. Each swap is O(1). Total: O(n). There is no best, worst, or average distinction — the algorithm always does the same amount of work regardless of input order.',
        'Space: O(1) beyond the input array. The shuffle is in-place. The only extra storage is a loop counter and the random index j.',
        'Doubling the input doubles the work. A million-element shuffle takes a million swaps — roughly the same time as a single pass through the array. Compare with sort-by-random-keys at O(n log n): for a million elements, that is ~20x more comparisons plus the overhead of sorting infrastructure.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Card game servers shuffle decks with Fisher-Yates. Music players randomize playlists. Machine learning pipelines shuffle training batches each epoch to break ordering correlations. A/B testing frameworks randomly assign users to treatment groups.',
        'Permutation tests in statistics generate thousands of random permutations to build null distributions. Random sampling without replacement — "pick k items from n" — is Fisher-Yates stopped after k steps. The partial shuffle gives k uniformly random selections in O(k) time.',
        'JavaScript\'s Array.prototype.sort with a random comparator is a common but broken alternative — it produces biased orderings because comparison-based sorts assume a consistent total order. Fisher-Yates is the correct replacement.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Fisher-Yates is only as good as its randomness source. A pseudo-random number generator with period P can produce at most P distinct permutations. For n=52 (a card deck), 52! is about 8 * 10^67 — far exceeding the period of most standard PRNGs (2^32 or even 2^64). A PRNG seeded with 32 bits can produce at most 4 billion of the 8 * 10^67 possible deck orderings.',
        'For security-critical shuffling (online poker, lottery draws), you need a cryptographically secure random source and must ensure the seed entropy exceeds log2(n!) bits. For a 52-card deck, that is 226 bits of entropy.',
        'The algorithm also requires mutating the array in place. If you need the original order preserved, you must copy first. And if elements are on different machines (distributed shuffle), Fisher-Yates does not parallelize — you need a different approach like sorting by random keys or a merge-based distributed shuffle.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace [A, B, C, D] step by step with specific random choices. i=3: pick j=1 from [0..3]. Swap a[3] and a[1]: D and B swap, giving [A, D, C, B]. Position 3 is locked with B.',
        'i=2: pick j=0 from [0..2]. Swap a[2] and a[0]: C and A swap, giving [C, D, A, B]. Position 2 is locked with A.',
        'i=1: pick j=1 from [0..1]. Swap a[1] with itself: no change, [C, D, A, B]. Position 1 is locked with D. Position 0 gets whatever remains: C.',
        'Final result: [C, D, A, B]. Three random choices from ranges of size 4, 3, 2. Total paths: 4 * 3 * 2 = 24 = 4!. Each of the 24 permutations corresponds to exactly one sequence of random choices.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Fisher and Yates published the original pencil-and-paper algorithm in 1938 (Statistical Tables for Biological, Agricultural and Medical Research). Knuth analyzed the modern in-place version in The Art of Computer Programming, Volume 2, Section 3.4.2. Durstenfeld published the computer implementation in 1964.',
        'Study reservoir sampling next — it generalizes the "pick k from n" idea to streams where n is unknown. Study sorting algorithms to understand why sort-by-random-keys costs O(n log n). Study probability and combinatorics for the proof that n! permutations require n! equally likely paths.',
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Prerequisites: arrays, swapping two elements, basic probability (uniform distribution over outcomes). If you understand why a fair coin has probability 1/2 for each side, you have enough probability for this topic.',
        'This unlocks: reservoir sampling (Fisher-Yates for streams), randomized algorithms (shuffling is the gateway), permutation tests in statistics, and understanding PRNG quality requirements. The partial-shuffle trick (stop early for random sampling) appears constantly in practice.',
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you shuffle [1, 2, 3, 4, 5] by hand using Fisher-Yates and verify the locked suffix grows by one each round?',
            'Can you explain why swapping with random(0..n-1) at every step produces a biased shuffle?',
            'Can you compute the number of possible execution paths (n!) and explain why it equals the number of permutations?',
            'Can you explain why a 32-bit PRNG seed is insufficient for shuffling a 52-card deck?',
          ],
        },
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Shuffle [X, Y, Z] by hand. i=2: pick j from {0,1,2}. Say j=0: swap a[2] and a[0], giving [Z, Y, X]. i=1: pick j from {0,1}. Say j=1: swap a[1] with itself, giving [Z, Y, X]. Result: [Z, Y, X].',
        'Now enumerate all 6 possible outcomes by trying every (j1, j2) pair where j1 is in {0,1,2} and j2 is in {0,1}. Verify each of the 6 permutations appears exactly once. That is the uniformity guarantee: 3 * 2 = 6 paths for 3! = 6 permutations.',
      ],
    },
  ],
};
