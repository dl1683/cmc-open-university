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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The array displays your input sequence. Each element is processed left to right. The active highlight marks the element currently being placed. Range highlights mark the indices whose values sit in the tails array -- the compact bookkeeping structure that tracks the best subsequence endings found so far.',
        'Two things can happen at each step. If the current element is larger than every tail, it extends the tails array and the LIS length grows by one. If not, a binary search finds the first tail that is greater than or equal to the current element and replaces it. The length stays the same, but the tails array now has a smaller value at that position -- a better springboard for future growth.',
        'At the end, found highlights trace the actual longest increasing subsequence recovered through parent pointers. The tails array itself is not the LIS. It is the working structure that makes O(n log n) possible.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Given a sequence, find the longest subsequence whose elements are strictly increasing. The elements do not need to be adjacent -- they just need to appear in left-to-right order with each value larger than the last.',
        'LIS measures how "sorted" a sequence already is. A fully sorted sequence has LIS length n. A fully reversed sequence has LIS length 1. Everything else falls somewhere between, and the LIS length tells you the largest monotone thread you can pull from the data without rearranging anything.',
        'The problem appears everywhere. Patience sorting is literally the LIS algorithm dealing cards into piles. Version control systems reduce longest common subsequence (LCS) to LIS when comparing file versions. Bioinformatics uses LIS to anchor genome alignments. Scheduling problems -- box stacking, Russian doll envelopes -- reduce to LIS on pairs. Ulam studied the expected LIS length in random permutations in the 1960s; the Erdos-Szekeres theorem guarantees that any sequence of more than n*m elements contains either an increasing subsequence of length n+1 or a decreasing one of length m+1.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Enumerate every subsequence, check if it is increasing, keep the longest. A sequence of n elements has 2^n subsequences. For n = 20 that is a million candidates. For n = 40 it is a trillion. Correct, but unusable.',
        'A better first attempt uses dynamic programming. Define dp[i] as the length of the longest increasing subsequence ending at index i. Initialize every dp[i] to 1 (the element by itself). For each i, scan every earlier index j < i: if values[j] < values[i], set dp[i] = max(dp[i], dp[j] + 1). The answer is max(dp[0], dp[1], ..., dp[n-1]). This runs in O(n^2) time and O(n) space.',
        'For n under 10,000 the quadratic DP is fine. For n = 100,000 or 1,000,000, it is too slow.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The brute-force enumeration is exponential -- every added element doubles the work. The O(n^2) DP kills the exponential blowup but still does quadratic work: every element scans all previous elements looking for the best predecessor to extend.',
        'Most of that inner scan is wasted. When processing element i, we do not need to inspect every j < i. We just need to know: for each possible subsequence length, what is the smallest value a subsequence of that length can end with? If we maintain that information in a sorted structure, finding where the current element fits takes one binary search instead of a linear scan.',
        'Replacing the O(n) inner loop with an O(log n) binary search is the move that drops the total cost from O(n^2) to O(n log n).',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The O(n^2) DP builds a table. dp[i] = 1 + max(dp[j] for all j < i where values[j] < values[i]), or 1 if no such j exists. After filling the table, the answer is the largest dp[i]. To recover the actual subsequence, store which j gave the maximum at each i and trace back from the position with the overall maximum.',
        'The O(n log n) patience/tails algorithm replaces that table with a single sorted array called tails. tails[k] holds the smallest ending element of any increasing subsequence of length k+1 found so far. Because tails is always sorted (proven below), binary search works.',
        'For each input element: if it is larger than tails[last], append it -- the LIS length grows. Otherwise, binary-search for the leftmost tail >= the element and replace it. The replacement does not change the LIS length, but it installs a smaller ending value at that position, keeping the door open for longer subsequences later.',
        'To reconstruct the actual subsequence, maintain parent pointers. When element at index i is placed at position pos in tails, record that its predecessor is the element currently at position pos - 1 in tails. After processing all elements, walk parent pointers backward from the end of the longest subsequence.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The tails array maintains the invariant: tails[k] is the smallest value that can end an increasing subsequence of length k+1. Two properties guarantee this.',
        'Tails is always sorted. Suppose tails[a] >= tails[b] for some a < b. The subsequence of length b+1 ending at tails[b] contains a subsequence of length a+1 ending at some value <= tails[b] <= tails[a]. That contradicts tails[a] being the minimum such ending value. So tails is strictly increasing.',
        'Replacements preserve correctness. When we replace tails[pos] with a smaller value v, we claim there exists an increasing subsequence of length pos+1 ending at v. This is true: binary search placed v at position pos, meaning v >= tails[pos-1] (otherwise it would have gone earlier) and v < the old tails[pos]. The subsequence that ended at tails[pos-1] extended by v is valid and ends smaller.',
        'The DP correctness rests on optimal substructure. The LIS ending at position i must extend some LIS ending at an earlier position j where values[j] < values[i]. Taking the longest such extension and adding 1 gives dp[i]. The global optimum is the maximum over all ending positions.',
        'The tails array never shrinks. Appends grow the LIS length by one. Replacements keep the length the same but improve future extensibility. The final length of tails equals the LIS length.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The naive DP costs O(n^2) time and O(n) space. Each element scans all predecessors. For n = 10,000, that is 50 million comparisons -- fast enough. For n = 1,000,000 it is 500 billion -- not feasible.',
        'The patience/tails algorithm costs O(n log n) time and O(n) space. Each of the n elements requires one binary search over tails, which has length at most n. Each search costs O(log n). For n = 1,000,000, about 20 million comparisons -- seconds, not hours.',
        'When n doubles, the O(n log n) version does roughly double the work (the log factor grows slowly). The O(n^2) version does four times the work.',
        'Space is O(n) in both cases: the DP table in one, the tails array plus parent pointers in the other. The tails approach has better cache behavior because tails is a compact sorted array accessed via binary search -- the same pattern that makes binary search fast in practice.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Patience sorting. The LIS algorithm is the first phase of patience sort: deal cards into piles where each pile\'s top is decreasing; the number of piles equals the LIS length. This is not an analogy -- it is the same algorithm. The tails array holds the pile tops.',
        'Longest chain of pairs. Given pairs (a_i, b_i), find the longest chain where both coordinates increase. Sort by the first coordinate, run LIS on the second. Russian doll envelopes and box stacking are instances of this pattern.',
        'Version control. The Hunt-Szymanski algorithm computes longest common subsequence by reducing LCS to LIS. When comparing two file versions with few matching lines, this is faster than the standard O(nm) DP.',
        'Bioinformatics. Genome alignment tools find long increasing runs of matching positions between two sequences, then refine alignment around those anchors. LIS provides the initial skeleton.',
        'Scheduling. Any problem where you need the longest chain of compatible, ordered items -- jobs with deadlines, nested intervals, monotone paths in a grid -- can often be cast as LIS or a close variant.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Counting or enumerating all optimal subsequences. There may be exponentially many LIS of the same length. The tails algorithm finds one. If you need the count, you need the full O(n^2) DP with counting, or a Fenwick tree approach.',
        'Weighted LIS. If each element carries a weight and you want the heaviest increasing subsequence, the tails trick does not apply directly. You need a segment tree or binary indexed tree over DP values -- still O(n log n) but with higher constants and more code.',
        'Non-strict increase. The standard algorithm uses strict inequality. Allowing equal consecutive elements requires changing the binary search from lower bound to upper bound. Getting this wrong is a common bug.',
        'Higher dimensions. Finding the longest chain of points where every coordinate increases (2D, 3D) does not reduce cleanly to 1D LIS. The 2D case (longest chain of pairs) works with sorting plus LIS, but 3D and beyond need different techniques like Dilworth\'s theorem or specialized data structures.',
        'The tails array is not the LIS. After replacements, tails may mix elements from different subsequences. Reconstructing the actual LIS requires parent pointers -- a detail easy to forget.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input: [10, 9, 2, 5, 3, 7, 101, 18]. We trace both algorithms.',
        'O(n^2) DP. Initialize dp = [1, 1, 1, 1, 1, 1, 1, 1]. Index 0 (value 10): no earlier elements, dp[0] = 1. Index 1 (value 9): 9 < 10, no valid predecessor, dp[1] = 1. Index 2 (value 2): 2 < 10, 2 < 9, dp[2] = 1. Index 3 (value 5): 5 > 2, so dp[3] = dp[2] + 1 = 2. Index 4 (value 3): 3 > 2, so dp[4] = dp[2] + 1 = 2. Index 5 (value 7): 7 > 2 (dp 1), 7 > 5 (dp 2), 7 > 3 (dp 2), so dp[5] = 2 + 1 = 3. Index 6 (value 101): 101 > everything, best predecessor is index 5 with dp 3, so dp[6] = 4. Index 7 (value 18): 18 > 7 (dp 3), so dp[7] = 4. Final dp = [1, 1, 1, 2, 2, 3, 4, 4]. Maximum is 4. Traceback from index 6: 101 <- 7 <- 5 <- 2, giving [2, 5, 7, 101].',
        'O(n log n) patience/tails. Element 10: tails empty, append. Tails = [10], length 1. Element 9: 9 < 10, binary search finds position 0, replace. Tails = [9], length 1. Element 2: 2 < 9, replace at position 0. Tails = [2], length 1. Element 5: 5 > 2, append. Tails = [2, 5], length 2. Element 3: 3 < 5, binary search finds position 1, replace. Tails = [2, 3], length 2. Element 7: 7 > 3, append. Tails = [2, 3, 7], length 3. Element 101: 101 > 7, append. Tails = [2, 3, 7, 101], length 4. Element 18: 18 < 101, binary search finds position 3, replace. Tails = [2, 3, 7, 18], length 4.',
        'Both algorithms find LIS length 4. Valid subsequences include [2, 5, 7, 101], [2, 3, 7, 101], and [2, 3, 7, 18]. The final tails array [2, 3, 7, 18] happens to be a valid LIS here, but that is coincidence -- in general, the tails array after replacements is not a subsequence of the input.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Fredman (1975) proved the O(n log n) lower bound for comparison-based LIS. Aldous and Diaconis (1999) formalized the patience sorting connection and its link to random matrix theory. Knuth covers the DP formulation in The Art of Computer Programming, Vol. 3.',
        'Prerequisites: binary search (the engine inside the tails algorithm), dynamic programming (the O(n^2) formulation), memoization (understanding overlapping subproblems).',
        'Extensions: longest common subsequence (two-sequence generalization, O(nm) DP, reducible to LIS in special cases), edit distance (DP on two sequences with insertions, deletions, and substitutions), patience sorting (the full sorting algorithm built on LIS machinery).',
        'Alternatives: 0/1 knapsack (another table-filling DP with traceback and capacity constraints), segment trees and Fenwick trees (the data structures behind weighted LIS and faster DP transitions).',
      ],
    },
  ],
};
