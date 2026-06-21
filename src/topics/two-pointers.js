// The two-pointers technique: replace a nested O(n^2) scan with two indexes
// walking toward each other by using sorted order as a proof of elimination.

import { arrayState, parseNumberList, parseNumber } from '../core/state.js';

export const topic = {
  id: 'two-pointers',
  title: 'Two Pointers',
  category: 'Concepts',
  summary: 'Find a pair summing to a target by squeezing inward from both ends of a sorted array.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '11, 3, 7, 1, 9, 5, 14' },
    { id: 'target', label: 'Pair sum target', type: 'number', defaultValue: '16' },
  ],
  run,
};

export function* run(input) {
  const values = [...parseNumberList(input.values, { max: 10 })].sort((a, b) => a - b);
  const target = parseNumber(input.target, { label: 'a target sum' });

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `Find two numbers that sum to ${target}. The obvious way checks every pair with nested loops, which is O(n^2). After sorting, one pointer starts at the smallest value and one at the largest. Every comparison proves that one pointer position can be eliminated, so the scan is one pass after sorting.`,
  };

  let lo = 0;
  let hi = values.length - 1;
  while (lo < hi) {
    const sum = values[lo] + values[hi];
    const verdict = sum === target ? 'equal' : sum < target ? 'small' : 'big';
    yield {
      state: arrayState(values),
      highlight: { compare: [`i${lo}`, `i${hi}`] },
      explanation: `${values[lo]} + ${values[hi]} = ${sum}: ${verdict === 'equal' ? `exactly ${target}. The live interval still contains both endpoints, so this pair is a valid answer.`
        : verdict === 'small'
          ? `Too small. The key insight: ${values[lo]} paired with its largest possible partner still falls short, so ${values[lo]} cannot be in any answer. Move the left pointer right.`
          : `Too big. ${values[hi]} paired with its smallest possible partner still overshoots, so ${values[hi]} is out. Move the right pointer left.`}`,
      invariant: 'Any valid pair must lie between the two pointers, inclusive.',
    };
    if (verdict === 'equal') {
      yield {
        state: arrayState(values),
        highlight: { found: [`i${lo}`, `i${hi}`] },
        explanation: `Found it: ${values[lo]} + ${values[hi]} = ${target}, in far fewer steps than checking all ${(values.length * (values.length - 1)) / 2} pairs. The pattern is to maintain an invariant, shrink the search by one provably safe step, and never revisit eliminated positions.`,
      };
      return;
    }
    if (verdict === 'small') lo += 1; else hi -= 1;
  }

  yield {
    state: arrayState(values),
    highlight: { visited: values.map((_, i) => `i${i}`) },
    explanation: `The pointers met, so no pair sums to ${target}. This is proven in a single scan: every position was eliminated by a logical argument, not by exhaustive pairing. The gap is O(n) after sorting versus O(n^2) brute force.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a sorted array with two highlighted positions: a left pointer starting at the smallest value and a right pointer starting at the largest. At each step, the two values are summed and compared to the target.',
        {type: 'callout', text: 'Two pointers works when one comparison proves an endpoint useless, so the search interval shrinks without losing any possible answer.'},
        'When a pointer moves, the value it leaves behind has been eliminated by proof, not by guessing. The highlight color changes to mark it as visited -- permanently excluded from consideration.',
        'If a pair matching the target is found, both positions light up as found. If the pointers meet without a match, every position shows as visited: the entire array has been scanned in one pass, and no valid pair exists.',
        'Watch for the asymmetry: only one pointer moves per step. That is the mechanism. Each comparison produces a logical argument that kills exactly one endpoint.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many problems ask whether a pair of elements satisfies some condition -- two values summing to a target, two characters matching in a palindrome, two sorted streams merging. The brute-force answer is to check every pair, which means nested loops and O(n^2) comparisons.',
        'Two pointers replaces that quadratic scan with a single linear pass by exploiting structure in the data -- usually sorted order. One comparison eliminates not just one pair but an entire row or column of the implicit pair table. The technique is everywhere in interview problems, competitive programming, and production code (sort-merge joins, deduplication, partition routines) because it turns O(n^2) into O(n) with O(1) extra memory.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Given an array and a target sum, the straightforward solution is a nested loop: for each element, scan every other element and check whether the two add up to the target. This works. It is correct on any input, sorted or not, and it is easy to write.',
        'For an array of 10 elements, that is 45 pairs. For 1,000 elements, it is nearly 500,000. For 1,000,000 elements, it is roughly 500 billion. The nested loop is doing honest work -- it just does far too much of it because it treats every pair as equally likely.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The nested loop wastes time because it ignores what the data already knows. When the array is sorted, the values increase from left to right. If the smallest value plus the largest value is too small, then the smallest value plus any smaller partner is also too small -- yet the nested loop checks those pairs anyway.',
        'The same waste runs in the other direction: if a sum is too large, pairing the largest value with anything bigger than the current left partner is guaranteed to overshoot. The nested loop cannot skip these provably impossible pairs because it has no mechanism for ruling out groups at once.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Place one pointer at the left end and one at the right end of the sorted array. The invariant is: if a valid pair exists, both of its elements lie between the two pointers (inclusive). Every step shrinks this interval by exactly one position, and the shrink is backed by a monotonic argument that proves the removed position cannot participate in any answer.',
        'This is not a heuristic. It is a proof machine. Each pointer movement converts one arithmetic comparison into a statement about every remaining pair that involves the eliminated endpoint.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Sort the array if it is not already sorted. Set left = 0 and right = n - 1. Compute the sum of the values at those positions.',
        'If the sum equals the target, the pair is found. If the sum is too small, the left value has just been paired with the largest available partner and still fell short -- no other partner can save it, so advance left by one. If the sum is too large, the right value has just been paired with the smallest available partner and still overshot -- no other partner can save it, so move right back by one.',
        'Repeat until the pointers meet. Each pointer moves at most n - 1 times total, and they never move backward, so the scan visits at most 2n positions.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/e6/Merge_sort_algorithm_diagram.svg', alt: 'Merge sort diagram showing sorted runs merged left to right', caption: 'The merge phase is a production-grade two-pointer scan: compare the two run heads, consume one, and never rewind either pointer. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Merge_sort_algorithm_diagram.svg.'},
        'Two variants cover most problems. Opposite-direction pointers (as above) converge from both ends: two-sum on sorted arrays, container with most water, palindrome checks, partitioning. Same-direction pointers walk the array together at different speeds: Floyd\'s cycle detection (fast/slow on a linked list), removing duplicates in place, the merge step of merge sort, and sliding-window problems where the window boundaries are the two pointers.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Sorted order makes the sum monotonic in each pointer independently. Moving the left pointer right can only increase the sum. Moving the right pointer left can only decrease it. This means every pointer movement changes the sum in a predictable direction.',
        'When the sum is too small, the left value has been tested against its best possible partner (the current right value, which is the largest remaining). Every other partner to its left is smaller, so they would produce an even smaller sum. The left value is provably useless and can be discarded.',
        'The symmetric argument applies when the sum is too large: the right value has been tested against the smallest available partner and still overshot, so it is provably useless.',
        'No valid pair is ever skipped. Suppose a valid pair (a, b) exists with a at position i and b at position j, where i < j. The left pointer reaches i only if every position before i was eliminated by the "too small" rule. The right pointer reaches j only if every position after j was eliminated by the "too large" rule. Both eliminations are independent of positions i and j, so the pair (a, b) survives until both pointers reach it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The two-pointer scan itself is O(n) time and O(1) extra space. Each element is visited at most twice (once by each pointer), and only two index variables are stored.',
        'If the input is not already sorted, sorting costs O(n log n), which dominates. Doubling the array size roughly doubles the scan time but more than doubles the sort time. For pre-sorted data -- common in database indexes, merge outputs, and streaming pipelines -- the technique is pure O(n).',
        'If original indices matter (the problem asks which positions, not which values), store value-index pairs before sorting. This adds O(n) space.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Two-sum on a sorted array is the textbook case: one pass, constant space, and the code is shorter than the hash-table version. Three-sum reduces to fixing one element and running two pointers on the remainder, turning O(n^3) brute force into O(n^2).',
        'Container with most water uses opposite-end pointers to shrink a width while tracking the tallest bars. Palindrome checking compares characters from both ends inward. Removing duplicates from a sorted array uses a slow pointer marking the write position and a fast pointer scanning ahead.',
        'Floyd\'s tortoise-and-hare algorithm detects cycles in linked lists with two same-direction pointers moving at different speeds -- O(n) time, O(1) space, no hash set needed. The merge step of merge sort walks two sorted halves with one pointer each, always consuming the smaller head.',
        'Sort-merge joins in databases are the production-scale version: two sorted streams are scanned together to find matching keys without restarting from the beginning for every row. When memory is tight -- embedded systems, browser layout engines, large offline files -- constant-space two pointers can beat a hash table that stores every key.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Without sorted, monotonic, or symmetric structure, pointer movements are unjustified. On an unsorted array, "too small" does not mean the left value is hopeless -- a larger partner might exist anywhere. Use a hash set for unsorted two-sum instead.',
        'Sorting can destroy the structure the problem actually needs. If the task asks for a contiguous subarray, sorting breaks contiguity. If it asks for the first pair in input order, sorting breaks chronology. If it asks for all duplicate-sensitive combinations, aggressive duplicate-skipping changes the count.',
        'Problems that need all pairs, not just existence of one pair, require careful handling of duplicates and continued scanning after each match. The simple "return on first found" template does not generalize without modification.',
        'Non-monotonic conditions break the pointer logic entirely. If the decision function does not guarantee that moving left increases the result and moving right decreases it, the elimination argument collapses and the algorithm can skip valid answers.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Sorted array: [1, 3, 5, 7, 9, 11]. Target sum: 12.',
        'Step 1: left = 0 (value 1), right = 5 (value 11). Sum = 12. Equal to target. Found the pair (1, 11). Done in one comparison.',
        'Now change the target to 14. Step 1: left = 0 (value 1), right = 5 (value 11). Sum = 12, too small. The value 1 paired with the largest available partner still falls short, so 1 is eliminated. Move left to index 1.',
        'Step 2: left = 1 (value 3), right = 5 (value 11). Sum = 14. Equal to target. Found the pair (3, 11). Done in two comparisons.',
        'Now change the target to 99 (impossible). The left pointer advances every step because every sum is too small: 1+11=12, 3+11=14, 5+11=16, 7+11=18, 9+11=20. After five comparisons the pointers meet. No pair sums to 99, proven in 5 steps instead of checking all 15 pairs.',
        'The key observation: the first comparison (1 + 11 = 12, too small) did not just eliminate the pair (1, 11). It eliminated every pair involving 1, because 11 was already the largest possible partner. One comparison killed five pairs.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Two pointers is algorithmic folklore with no single origin paper. It appears in Knuth\'s sorting and searching volumes, in every competitive programming reference, and implicitly in the merge step of merge sort (von Neumann, 1945).',
        'Study Binary Search next -- it uses the same idea of exploiting sorted order to eliminate half the search space per comparison. Sliding Window is the same-direction variant where both pointers move right and the window between them tracks a running aggregate. Merge Sort shows pointer scans inside its merge step. Linked List introduces the fast/slow pointer variant for cycle detection. Hash Table is the alternative for unsorted pair-sum: O(n) time, O(n) space, no sorting required.',
      ],
    },
  ],
};
