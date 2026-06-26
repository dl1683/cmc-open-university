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
        'The animation shows a sorted array with one pointer at the left end and one pointer at the right end. Active pointers mark the current pair, and visited cells mark values that have been eliminated by a proof.',
        {
          type: 'callout',
          text: 'Two pointers works when one comparison proves an endpoint useless, so the search interval shrinks without losing any possible answer.',
        },
        'When the sum is too small, the left value is discarded because even the largest remaining partner could not reach the target. When the sum is too large, the right value is discarded because even the smallest remaining partner overshot the target.',
        {
          type: 'image',
          src: './assets/gifs/two-pointers.gif',
          alt: 'Animated walkthrough of the two pointers visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many problems ask for a pair, a boundary, or a merged stream. Checking every pair in an array of n values costs quadratic time, so the work grows with the square of the input.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'For pair sum, the obvious approach is a nested loop. For each value, compare it with every later value and return when the two values add to the target.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is quadratic growth. On 1,000 values, the nested loop checks 499,500 pairs; on 1,000,000 values, it checks about 500 billion pairs.',
        'The nested loop ignores sorted order. If the smallest value plus the largest value is too small, every pair using that smallest value is also too small, but the brute-force loop has no way to skip that whole group.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Keep the possible answer inside a shrinking interval. The left pointer starts at the smallest value, the right pointer starts at the largest value, and each comparison proves one endpoint cannot be part of any valid answer.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with left = 0 and right = n - 1. Add array[left] and array[right], then compare the sum with the target.',
        'If the sum equals the target, the pair is found. If the sum is too small, increment left; if the sum is too large, decrement right.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/e/e6/Merge_sort_algorithm_diagram.svg',
          alt: 'Merge sort diagram showing sorted runs merged left to right',
          caption: 'The merge phase is a production-grade two-pointer scan: compare the two run heads, consume one, and never rewind either pointer. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Merge_sort_algorithm_diagram.svg.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Sorted order makes the comparison monotonic. Moving left rightward can only increase the chosen left value, and moving right leftward can only decrease the chosen right value.',
        'If the current sum is too small, the left value has already been paired with the largest available partner. No smaller partner can make it work, so discarding left cannot remove a valid pair.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The scan costs O(n) time and O(1) extra space. Each step moves one pointer, so there can be at most n - 1 moves before the pointers meet.',
        'If the input is not sorted, sorting costs O(n log n) and dominates the scan. Doubling already sorted data roughly doubles scan time; doubling unsorted data also increases the sorting cost.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Sorted two-sum is the teaching example, but the same pattern appears in three-sum after one value is fixed. Merge sort and database sort-merge joins use two pointers to consume sorted streams without rewinding.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the data has no order that justifies elimination. On an unsorted array, a sum that is too small does not prove anything about the left value, because a larger partner may be anywhere.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use sorted array [1, 3, 5, 7, 9, 11] and target 14. Start with left at 1 and right at 11, giving sum 12.',
        'Because 12 is too small, 1 is eliminated; even 1 + 11 cannot reach 14. Move left to 3, and the new sum is 3 + 11 = 14, so the pair is found in two comparisons.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Two pointers is algorithmic folklore, and the merge step goes back to early merge-sort descriptions. Study binary search, sliding window, hash tables for unsorted lookup, and merge sort for the production version of sorted streams moving together.',
      ],
    },
  ],
};
