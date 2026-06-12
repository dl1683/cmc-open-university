// Linear search: check every element until the target appears.
// The simplest search, and the honest baseline every other search beats.

import { arrayState, parseNumberList, parseNumber } from '../core/state.js';

export const topic = {
  id: 'linear-search',
  title: 'Linear Search',
  category: 'Searching',
  summary: 'Walk the array one element at a time until you find the target.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '7, 3, 15, 9, 4, 11' },
    { id: 'target', label: 'Search for', type: 'number', defaultValue: '9' },
  ],
  run,
};

export function* run(input) {
  const values = parseNumberList(input.values);
  const target = parseNumber(input.target, { label: 'a target' });

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `We are looking for ${target}. The array is not sorted, so we can assume nothing — linear search simply checks every element, left to right.`,
  };

  for (let index = 0; index < values.length; index += 1) {
    const visited = values.slice(0, index).map((_, i) => `i${i}`);
    const isMatch = values[index] === target;
    yield {
      state: arrayState(values),
      highlight: { active: [`i${index}`], visited },
      explanation: `Check position ${index}: is ${values[index]} equal to ${target}? ${isMatch ? 'Yes — found it!' : 'No — move on.'}`,
      invariant: 'Everything to the left of the current position has been checked and ruled out.',
    };
    if (isMatch) {
      yield {
        state: arrayState(values),
        highlight: { found: [`i${index}`], visited },
        explanation: `Found ${target} at position ${index} after ${index + 1} comparison${index === 0 ? '' : 's'}. In the worst case linear search checks all n elements — that is what O(n) means.`,
      };
      return;
    }
  }

  yield {
    state: arrayState(values),
    highlight: { visited: values.map((_, i) => `i${i}`) },
    explanation: `All ${values.length} elements checked — ${target} is not here. ${values.length} comparisons: the O(n) worst case. To do better, the data needs structure… like being sorted (see Binary Search).`,
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `Linear search is the simplest searching algorithm: start at the beginning of the array, check each element in turn, and return the index when you find a match. If you reach the end without finding the target, it does not exist. No structure, no cleverness — just a straightforward left-to-right scan. Every array supports linear search immediately; it requires nothing (no sorting, no preprocessing).`,
        `It is the baseline: every faster search algorithm must beat it. Linear search is honest, working on any data regardless of order. It is also robust — there is no worst-case pathology, and the constants are small.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Maintain an index starting at 0. At each step, compare the element at the current index to the target. If they match, return the index immediately. If not, increment the index and continue. After checking all n elements without a match, return not-found. The algorithm maintains an invariant: all elements to the left of the current index have been examined and rejected.`,
        `The key characteristic is that early success can cut the search short. If the target is at position 0, you return in one step. If it is near the end, you check n−1 elements. If it is not there, you check all n elements. This variability is why linear search is O(n) worst case but can be much faster on average or best case (O(1) if the target is first).`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Best case is O(1) — the target is the first element. Average case is O(n/2) = O(n) — you expect to check half the array on average if the target exists and is equally likely to be anywhere. Worst case is O(n) — the target is at the end or not present at all. Space complexity is O(1); you only track the current index. No preprocessing, no data structure needed.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Linear search dominates when the array is small (under ~100 elements) because the O(1) space and tight inner loop beat the overhead of binary search or hash tables. It is also used when the data arrives as a stream and you must search as elements come in, or when you need to find multiple matches (and binary search requires multiple lookups). Search in memory-constrained systems often uses linear search by default because no index structure is needed. However, for larger datasets or repeated searches, hash tables (O(1) average lookup) and binary search (O(log n) guaranteed on sorted data) are much faster.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A common misconception is dismissing linear search as always slow. On small arrays, linear search is often faster than binary search because binary search has more overhead (logarithmic comparisons are still multiple probes, and each one is more complex than a simple equality check). The crossover point varies, but is typically around 50–100 elements.`,
        `Another pitfall is assuming linear search does not work on sorted data. It works fine; sorting is simply not required. If you sort the data, you enable faster algorithms like binary search, but linear search still functions correctly on sorted data (it just wastes the structure).`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Move to Binary Search to see how sorting enables O(log n) searching. Study Big-O Growth Rates to grasp the exponential advantage of logarithmic over linear time at scale. Explore hash tables and hash functions to understand O(1) average-case searching. Finally, study the analysis of algorithms and how best, average, and worst cases all matter in practice.`,
      ],
    },
  ],
};

