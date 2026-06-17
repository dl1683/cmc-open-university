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
      heading: 'Why this exists',
      paragraphs: [
        'Two pointers exists for problems where a naive nested loop keeps rediscovering information that the order of the data already tells you. The technique uses two indices as a small proof state.',
        'In the pair-sum demo, sorting creates the structure. One pointer starts at the smallest value and one at the largest. Each comparison either finds the answer or proves that one endpoint cannot be part of any answer.',
        'The important word is proves. Two pointers is not "try both ends and hope." It is a way to turn an ordered search space into a series of one-step eliminations. Each pointer movement has to be justified by a monotonic fact about the remaining candidates.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach checks every pair. For n values, that is n(n - 1) / 2 comparisons. It is simple, correct, and wasteful when the array can be sorted or already has monotonic structure.',
        'A hash table is another strong baseline for unsorted two-sum: one pass, expected O(n), and O(n) extra space. Two pointers is not automatically better; it wins when sorted order is available or when constant extra space and ordered reasoning matter.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is deciding which pointer can move without missing a valid answer. On unsorted data, "too small" or "too large" tells you almost nothing. Moving a pointer would be a guess.',
        'Sorted order changes that. If the smallest remaining value plus the largest remaining value is too small, the smallest value cannot work with anything else. If the sum is too large, the largest value cannot work with anything else.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core invariant is that any valid pair must lie between the two pointers. The algorithm shrinks that interval by one endpoint at a time, and every shrink is backed by a monotonic argument.',
        'That is the general pattern: use two small pieces of state to represent the live search region, then move exactly the pointer whose old position has been logically eliminated.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'Read the highlighted endpoints as the only live promise the algorithm is making. Everything outside them has already been ruled out. When the sum is too small, the left endpoint disappears because even its best possible partner, the current right endpoint, was not enough. When the sum is too large, the right endpoint disappears because even its smallest possible partner was too much.',
        'The animation is teaching the proof, not just the motion. If a pointer moves and you cannot explain why no answer was skipped, the invariant has been broken. That is the check you should carry into every two-pointer variant.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For pair sum, sort first unless the data already arrives sorted. Start lo = 0 and hi = n - 1. Compare values[lo] + values[hi]. Equal means found. Too small means advance lo. Too large means decrement hi. Stop when the pointers meet.',
        'The visualization sorts 11, 3, 7, 1, 9, 5, 14 into increasing order before scanning for target 16. That matters: the displayed positions are sorted positions, not original input positions.',
        'Many interview problems hide this same mechanism under different names. In a palindrome check, the two pointers compare mirrored characters and move inward. In partitioning, one pointer searches for a value on the wrong side of a boundary while the other searches from the opposite side. In merge routines, the pointers walk two sorted sequences and always advance the side whose next item has just been consumed.',
        'The common rule is that the pointer state must summarize all the work still worth doing. A sloppy two-pointer solution often "works on the example" because the example is forgiving. A correct one can say exactly what each pointer excludes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because sorted order gives a dominance proof. The smallest remaining value has already been paired with the largest possible partner. If that pair is still too small, no smaller partner can save it.',
        'The symmetric argument eliminates the largest value when the sum is too big. The algorithm is therefore not a heuristic and not a lucky shortcut. It is a sequence of safe eliminations.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The scan is O(n) time and O(1) extra space. If sorting is required, total time becomes O(n log n). If original indices are required, store value-index pairs before sorting.',
        'The behavior changes when the task asks for all pairs rather than one pair. Duplicates must be counted or skipped carefully, and the algorithm may need to continue after finding one answer.',
        'This is why the technique is often paired with a design choice. If you are allowed to reorder values and only need the values themselves, sorting plus two pointers is clean. If you need the original order, original indices, or one-pass streaming behavior, a Hash Table or Sliding Window may fit better. The algorithmic idea is simple; the data contract decides whether it is legal.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Two pointers wins on sorted arrays, sorted streams, palindrome checks, partitioning, deduplication, merge routines, and geometry problems where order lets one pointer movement eliminate many candidates.',
        'Sort-merge joins in databases are the grown-up version: two sorted streams are scanned together to find matching keys without restarting from the beginning for every row.',
        'The technique is also useful when memory is tight. A hash-table solution for two-sum can be faster after one pass, but it stores extra keys. A sorted two-pointer scan can run with constant extra memory once the data is sorted. In embedded code, browser layout code, or large offline files, that difference can matter more than the asymptotic headline.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails without sorted, monotonic, or symmetric structure. On an arbitrary unsorted array, moving left or right after a comparison is unjustified.',
        'It also fails when the implementation moves both pointers after a failed comparison. Only one endpoint has been proven impossible. Moving both can skip a valid answer.',
        'A subtler failure is sorting when sorting changes the problem. If the task asks for a contiguous subarray, sorting destroys contiguity. If it asks for the first pair in input order, sorting destroys chronology. If it asks for all duplicate-sensitive combinations, skipping duplicates too aggressively changes the count. Two pointers is powerful because it uses structure; using it after erasing the structure the problem actually cares about is a bug.',
      ],
    },
    {
      heading: 'A worked case',
      paragraphs: [
        'Take the sorted values [1, 3, 5, 7, 9, 11, 14] and target 16. Start with 1 + 14 = 15. That is too small, and 14 is already the largest partner available to 1, so 1 can never be in a valid pair. Move left to 3. Now 3 + 14 = 17. That is too large, and 3 is the smallest partner available to 14, so 14 can never be in a valid pair. Move right to 11. Now 5 + 11 = 16, so the algorithm stops.',
        'Notice what did not happen. The algorithm never checked 1 + 3, 1 + 5, 1 + 7, 1 + 9, or 1 + 11. One comparison removed all of them. That is the educational point of the animation: sorted order converts a single arithmetic result into a statement about an entire row or column of the implicit pair table.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Binary Search for another sorted-data elimination pattern, then Hash Table for the unsorted pair-sum alternative. Merge Sort and Quick Sort show pointer scans inside sorting. Sliding Window generalizes the idea to contiguous ranges. Linked List gives the fast-slow variant, and Big-O Growth Rates explains why replacing nested loops with one scan matters.',
      ],
    },
  ],
};
