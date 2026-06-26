// Longest Increasing Subsequence: find the longest strictly increasing
// subsequence using patience sorting with binary search — O(n log n).

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'longest-increasing-subsequence',
  title: 'Longest Increasing Subsequence',
  category: 'Algorithms',
  summary: 'Find the longest strictly increasing subsequence in O(n log n) using patience sorting and binary search on a tails array.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '10, 9, 2, 5, 3, 7, 101, 18' },
  ],
  run,
};

// ---------------------------------------------------------------- helpers

function lowerBound(arr, target) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ---------------------------------------------------------------- run

export function* run(input) {
  const values = parseNumberList(input.values, { min: 2, max: 16, label: 'numbers' });
  const n = values.length;

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `We have ${n} numbers. The goal: find the longest strictly increasing subsequence (LIS). Elements do not need to be adjacent — they just need to appear in left-to-right order with each value larger than the last.`,
  };

  // tails[k] = smallest ending element of any increasing subsequence of length k+1
  const tails = [];
  // For reconstruction: parent[i] = index of previous element in LIS ending at i
  const parent = new Array(n).fill(-1);
  // tailIndices[k] = index in original array of the element stored in tails[k]
  const tailIndices = [];

  for (let i = 0; i < n; i++) {
    const val = values[i];
    const pos = lowerBound(tails, val);

    // Track the parent for reconstruction
    if (pos > 0) {
      parent[i] = tailIndices[pos - 1];
    }

    if (pos === tails.length) {
      // Extend: this element is larger than all tails
      tails.push(val);
      tailIndices.push(i);

      yield {
        state: arrayState(values),
        highlight: { active: [`i${i}`], range: tailIndices.slice(0, -1).map(j => `i${j}`) },
        explanation: `Element ${val} at index ${i} is larger than every value in tails [${tails.slice(0, -1).join(', ')}]. Append it. Tails becomes [${tails.join(', ')}]. The longest increasing subsequence seen so far has length ${tails.length}.`,
        invariant: `tails[k] is the smallest ending element of any increasing subsequence of length k+1.`,
      };
    } else {
      // Replace: val is smaller, so it can potentially start a better subsequence
      const replaced = tails[pos];
      tails[pos] = val;
      tailIndices[pos] = i;

      yield {
        state: arrayState(values),
        highlight: { active: [`i${i}`], visited: [`i${i}`] },
        explanation: `Element ${val} at index ${i} replaces tails[${pos}] = ${replaced} (binary search found the first tail >= ${val}). Tails becomes [${tails.join(', ')}]. The LIS length stays ${tails.length}, but now position ${pos} has a smaller ending value, which keeps the door open for longer subsequences later.`,
        invariant: `tails[k] is the smallest ending element of any increasing subsequence of length k+1.`,
      };
    }
  }

  // Reconstruct the actual LIS
  const lisLength = tails.length;
  const lisIndices = [];
  let curr = tailIndices[tailIndices.length - 1];
  // Walk parent pointers backwards
  // Need to rebuild from the last element added to the longest subsequence
  // Re-trace: find the actual LIS via parent pointers
  const lisReconstructed = [];
  let traceIdx = -1;

  // Find the index whose value is tails[lisLength - 1] by walking from the end
  // Actually, we can trace using parent pointers from the last tailIndices entry
  traceIdx = tailIndices[lisLength - 1];
  while (traceIdx !== -1) {
    lisReconstructed.unshift(traceIdx);
    traceIdx = parent[traceIdx];
  }

  yield {
    state: arrayState(values),
    highlight: { found: lisReconstructed.map(j => `i${j}`) },
    explanation: `Done. The longest increasing subsequence has length ${lisLength}: [${lisReconstructed.map(j => values[j]).join(', ')}] at positions [${lisReconstructed.join(', ')}]. We processed ${n} elements, each requiring a binary search over at most ${lisLength} tails — O(n log n) total.`,
  };
}

// ---------------------------------------------------------------- article

export const article = {
  sections: [
    {heading: 'How to read the animation', paragraphs: ['Read the sequence left to right because a subsequence must preserve input order. The active value is being placed into tails, where tails[k] is the smallest ending value seen for an increasing subsequence of length k + 1.', {type: 'callout', text: 'The tails array does not store the answer; it stores the cheapest possible ending for each answer length.'}, 'Appending grows the best length. Replacing keeps the length but lowers an ending value, which gives later numbers more room to extend.', {type: 'image', src: './assets/gifs/longest-increasing-subsequence.gif', alt: 'Animated walkthrough of the longest increasing subsequence visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    {heading: 'Why this exists', paragraphs: ['A longest increasing subsequence, or LIS, is the longest ordered selection whose values strictly rise. The values do not need to be adjacent, so LIS finds monotone structure hidden inside noisy order.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/LISDemo.gif/500px-LISDemo.gif', alt: 'Animated demo of a longest increasing subsequence in a numeric sequence', caption: 'The highlighted subsequence shows the rule visually: keep original order, skip anything needed, and preserve strict increase. Source: Wikimedia Commons, LIS demo.'}, 'The problem appears whenever compatibility means later and larger. Scheduling chains, envelope nesting, genome anchors, and some diff reductions all need the longest ordered chain.']},
    {heading: 'The obvious approach', paragraphs: ['Try every subsequence, keep the increasing ones, and return the longest. That is correct, but n values have two to the n subsequences, so n = 40 is already about one trillion candidates.', 'The first serious improvement is dynamic programming. Let dp[i] be the best increasing subsequence ending at i, then scan every earlier j and extend dp[j] when values[j] is less than values[i].']},
    {heading: 'The wall', paragraphs: ['The dynamic program costs O(n squared) because every value scans all earlier values. At one million values, that is roughly 500 billion predecessor checks.', 'Most of those checks ask for the same kind of fact. For each possible length, the algorithm only needs the cheapest ending value, not every index that ever achieved that length.']},
    {heading: 'The core insight', paragraphs: ['For a fixed length, a smaller ending value is always better than a larger one. A length-3 subsequence ending at 7 can be extended by 8, but a length-3 subsequence ending at 18 cannot.', 'The tails array stores this frontier of cheapest endings. Because those endings are sorted, binary search finds the first length that the active value can improve.']},
    {heading: 'How it works', paragraphs: ['For each value x, binary-search tails for the first value greater than or equal to x. If no such value exists, append x; otherwise replace that position with x.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Binary_Search_Depiction.svg/250px-Binary_Search_Depiction.svg.png', alt: 'Binary search narrowing a sorted array by testing the midpoint', caption: 'Binary search is the operation that turns each tails placement from a scan into logarithmic work. Source: Wikimedia Commons.'}, 'The length of tails is the LIS length. To reconstruct an actual subsequence, store parent pointers and the input index that currently owns each tails position.']},
    {heading: 'Why it works', paragraphs: ['The invariant is that tails[k] is the smallest possible ending value for a length k + 1 increasing subsequence seen so far. Replacement preserves existence because x is placed after a valid previous-length tail and before the first tail it improves.', 'Appending is the only way the known length grows, and it happens exactly when x is larger than every frontier ending. Replacements cannot destroy a valid length; they only make that length easier to extend later.']},
    {heading: 'Cost and complexity', paragraphs: ['The dynamic program is O(n squared) time and O(n) memory. Doubling input length roughly quadruples the predecessor checks.', 'The tails algorithm is O(n log n) time and O(n) memory. For n = 1,000,000, log2 n is about 20, so the work is about 20 million searches steps instead of hundreds of billions.']},
    {heading: 'Real-world uses', paragraphs: ['Patience sorting uses the same pile-top rule, and the number of piles equals the LIS length. The pile tops are exactly the tails frontier.', 'Two-dimensional chain problems sort one coordinate and run LIS on the other. Genome alignment and diff-style matching use similar monotone anchor chains to keep matches in a consistent order.']},
    {heading: 'Where it fails', paragraphs: ['Tails alone is not necessarily the subsequence. It may combine values from incompatible positions, so parent pointers are required when the actual elements matter.', 'Duplicate handling is a common failure. Strictly increasing uses lower bound, while non-decreasing uses upper bound; choosing the wrong boundary changes answers on equal values.']},
    {heading: 'Worked example', paragraphs: ['Use [10, 9, 2, 5, 3, 7, 101, 18]. Tails evolves as [10], [9], [2], [2, 5], [2, 3], [2, 3, 7], [2, 3, 7, 101], then [2, 3, 7, 18].', 'The final length is 4. Valid answers include [2, 3, 7, 18] and [2, 5, 7, 101], which shows why many different subsequences can share the same optimal length.']},
    {heading: 'Sources and study next', paragraphs: ['Study patience sorting through Aldous and Diaconis, and study Fredman for comparison bounds. Study binary search first, dynamic programming for the O(n squared) baseline, and Fenwick trees for weighted LIS variants.']},
  ],
};
