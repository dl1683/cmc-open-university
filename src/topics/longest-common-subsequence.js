// Longest Common Subsequence: find the longest subsequence common to two
// sequences using dynamic programming on a 2D table — O(mn) time and space.
// Backtrack through the table to recover the actual subsequence.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'longest-common-subsequence',
  title: 'Longest Common Subsequence',
  category: 'Algorithms',
  summary: 'Find the longest subsequence shared by two strings using a DP table — the engine behind diff tools, version control, and DNA alignment.',
  controls: [
    { id: 'pair', label: 'Sequences', type: 'select', options: ['ABCBDAB vs BDCAB', 'GXTXAYB vs AGGTAB', 'ABCD vs ABCD', 'ABC vs DEF'], defaultValue: 'ABCBDAB vs BDCAB' },
  ],
  run,
};

const PAIRS = {
  'ABCBDAB vs BDCAB': ['ABCBDAB', 'BDCAB'],
  'GXTXAYB vs AGGTAB': ['GXTXAYB', 'AGGTAB'],
  'ABCD vs ABCD': ['ABCD', 'ABCD'],
  'ABC vs DEF': ['ABC', 'DEF'],
};
const UNFILLED = -1;

export function* run(input) {
  const pair = PAIRS[String(input.pair)];
  if (!pair) throw new InputError('Pick a sequence pair.');
  const [X, Y] = pair;
  const m = X.length;
  const n = Y.length;

  const rows = ['∅', ...X].map((ch, i) => ({ id: `r${i}`, label: ch }));
  const cols = ['∅', ...Y].map((ch, j) => ({ id: `c${j}`, label: ch }));
  const T = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(UNFILLED));
  const snapshot = (title) => matrixState({
    title, rows, columns: cols,
    values: T.map((row) => [...row]),
    format: (v) => (v === UNFILLED ? '·' : String(v)),
  });
  const cell = (i, j) => `r${i}:c${j}`;

  yield {
    state: snapshot(`Longest common subsequence of "${X}" and "${Y}"`),
    highlight: {},
    explanation: `Two sequences: X = "${X}" (length ${m}) and Y = "${Y}" (length ${n}). A subsequence picks characters in order but not necessarily adjacent. We want the longest one that appears in both. Brute force checks all 2^${m} subsequences of X against Y — exponential. Instead, fill a table where cell (i, j) = LCS length of the first i characters of X and the first j characters of Y. The full answer lands in the bottom-right corner.`,
  };

  // Base cases: LCS of any string with the empty string is 0
  for (let i = 0; i <= m; i++) T[i][0] = 0;
  for (let j = 0; j <= n; j++) T[0][j] = 0;
  yield {
    state: snapshot('Base cases: empty prefix has LCS length 0'),
    highlight: { active: [...Array.from({ length: m + 1 }, (_, i) => cell(i, 0)), ...Array.from({ length: n + 1 }, (_, j) => cell(0, j))] },
    explanation: `Any sequence compared to the empty sequence shares nothing: LCS length is 0. The first row and first column are all zeros. Every later cell will build on these.`,
  };

  // Fill the table
  for (let i = 1; i <= m; i++) {
    let exampleCell = null;
    for (let j = 1; j <= n; j++) {
      if (X[i - 1] === Y[j - 1]) {
        T[i][j] = T[i - 1][j - 1] + 1;
        if (!exampleCell) exampleCell = { j, match: true };
      } else {
        T[i][j] = Math.max(T[i - 1][j], T[i][j - 1]);
        if (!exampleCell) exampleCell = { j, match: false };
      }
    }
    const ex = exampleCell;
    yield {
      state: snapshot(`Filling row ${i} ('${X[i - 1]}')`),
      highlight: {
        active: Array.from({ length: n }, (_, j) => cell(i, j + 1)),
        visited: [cell(i - 1, ex.j - 1), cell(i - 1, ex.j), cell(i, ex.j - 1)],
      },
      explanation: ex.match
        ? `Row ${i}: compare '${X[i - 1]}' against each character of Y. At column ${ex.j}, '${X[i - 1]}' = '${Y[ex.j - 1]}' — the characters match, so dp[${i}][${ex.j}] = dp[${i - 1}][${ex.j - 1}] + 1 = ${T[i][ex.j]}. A match extends the LCS of the shorter prefixes by one.`
        : `Row ${i}: compare '${X[i - 1]}' against each character of Y. At column ${ex.j}, '${X[i - 1]}' ≠ '${Y[ex.j - 1]}' — no match. dp[${i}][${ex.j}] = max(dp[${i - 1}][${ex.j}], dp[${i}][${ex.j - 1}]) = ${T[i][ex.j]}. Without a match, the best LCS comes from whichever prefix already had the longer one.`,
      invariant: 'dp[i][j] = LCS length of X[1..i] and Y[1..j].',
    };
  }

  yield {
    state: snapshot(`LCS length: ${T[m][n]}`),
    highlight: { found: [cell(m, n)] },
    explanation: `The bottom-right corner holds the answer: the longest common subsequence of "${X}" and "${Y}" has length ${T[m][n]}. Total work: ${(m + 1) * (n + 1)} cells, each filled in O(1). Now backtrack to recover the actual subsequence.`,
  };

  // Backtrack to find the LCS
  const path = [cell(m, n)];
  const lcsChars = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (X[i - 1] === Y[j - 1]) {
      lcsChars.unshift(X[i - 1]);
      i--;
      j--;
    } else if (T[i - 1][j] >= T[i][j - 1]) {
      i--;
    } else {
      j--;
    }
    path.unshift(cell(i, j));
  }
  // Walk remaining to origin
  while (i > 0) { i--; path.unshift(cell(i, j)); }
  while (j > 0) { j--; path.unshift(cell(i, j)); }

  const lcsStr = lcsChars.join('');
  yield {
    state: snapshot(`LCS: "${lcsStr}" (length ${lcsChars.length})`),
    highlight: { range: path, found: [cell(m, n)] },
    explanation: lcsChars.length > 0
      ? `Backtrack from the corner: at each cell, if the characters match, take the diagonal (that character is in the LCS). Otherwise, move toward the larger neighbor — up if dp[i-1][j] is larger or equal, left otherwise. The path spells out "${lcsStr}". Every diagonal step in the backtrack is one character of the LCS.`
      : `The two sequences share no characters in common, so the LCS is empty. Every backtrack step moves along an edge (up or left), never diagonally — no matches to collect.`,
  };
}

// ---------------------------------------------------------------- article

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The grid has one row per character of X (plus a row for the empty prefix) and one column per character of Y (plus a column for the empty prefix). Cell (i, j) holds the length of the longest common subsequence of the first i characters of X and the first j characters of Y.',
        {type: 'callout', text: 'LCS works because every cell is a promise about two prefixes, so the full sequence problem becomes a grid of reusable prefix facts.'},
        'Active cells (highlighted) are the row currently being filled. Visited cells mark the neighbors that determined the active cell\'s value: the diagonal cell (used when characters match) and the cells above and to the left (used when they do not). When a character match occurs, the value increases by one from the diagonal. When there is no match, the value copies the larger of the two neighbors.',
        'After the table is complete, the found marker lands on the bottom-right corner — the LCS length for the full sequences. The backtrack path then lights up, tracing from that corner back toward the origin. Each diagonal step corresponds to a matched character in the LCS. Horizontal and vertical steps skip characters that are not part of the LCS.',
      
        {type: 'image', src: './assets/gifs/longest-common-subsequence.gif', alt: 'Animated walkthrough of the longest common subsequence visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Two sequences can share characters without those characters being adjacent. "ABCBDAB" and "BDCAB" both contain "BCAB" in order, but not as a contiguous block. The longest common subsequence (LCS) measures how much structure two sequences share, ignoring gaps.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Nubio_Diff_Screenshot3.png/500px-Nubio_Diff_Screenshot3.png', alt: 'Diff view showing changed and unchanged lines between two text versions', caption: 'A diff view is the practical face of LCS: shared ordered lines become the stable spine, and the rest becomes insertions or deletions. Source: Wikimedia Commons, Nubio Diff screenshot.'},
        'This matters wherever you need to compare sequences without requiring exact contiguous matches. Unix diff compares files line by line: the lines that both versions share, in order, form the LCS, and everything else is an insertion or deletion. Git diff works the same way. DNA sequence alignment finds shared genetic segments across species. Plagiarism detectors find the longest ordered overlap between documents. Merge-conflict resolution tools identify the common base between divergent edits.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Enumerate every subsequence of X and check whether it also appears as a subsequence of Y. A sequence of length m has 2^m subsequences. For each candidate, scanning Y to verify membership costs O(n). Total: O(n · 2^m). For m = 20 that is over a million candidates; for m = 40, over a trillion.',
        'This is correct but hopelessly slow. The problem is not difficulty — it is redundancy. The same prefix comparisons get recomputed in every branch of the enumeration.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Exponential subsequences make brute force impossible at scale. But notice: the LCS of X[1..i] and Y[1..j] depends only on the LCS of shorter prefixes. Whether X[i] = Y[j] or not, the answer reduces to at most two smaller subproblems that overlap heavily. The prefix pair (i, j) is encountered over and over through different enumeration paths.',
        'There are only (m+1)(n+1) distinct prefix pairs. Solving each one once, using previously solved smaller pairs, collapses the exponential tree into a flat table.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build an (m+1) × (n+1) table. dp[i][j] = length of the LCS of X[1..i] and Y[1..j].',
        'Base cases: dp[i][0] = 0 and dp[0][j] = 0 for all i, j. Any sequence compared to the empty sequence has an LCS of length zero.',
        'Recurrence: for each cell (i, j), compare X[i] and Y[j]. If they are equal, both characters can extend the LCS of the shorter prefixes: dp[i][j] = dp[i-1][j-1] + 1. If they differ, at least one character is not in the LCS, so take the better of the two options: dp[i][j] = max(dp[i-1][j], dp[i][j-1]).',
        'Fill the table row by row, left to right. Each cell is O(1) — one comparison and at most one max operation. The answer is dp[m][n].',
        'Backtracking recovers the actual subsequence. Start at dp[m][n]. If X[i] = Y[j], that character is in the LCS — record it and move diagonally to (i-1, j-1). Otherwise, move toward the larger neighbor: up to (i-1, j) or left to (i, j-1). When you reach an edge, stop. The recorded characters, reversed, spell the LCS.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Optimal substructure: consider the last characters of X[1..i] and Y[1..j]. If X[i] = Y[j], this matching pair must belong to an optimal LCS (if it did not, appending it would create a longer common subsequence, contradicting optimality). So dp[i][j] = dp[i-1][j-1] + 1.',
        'If X[i] ≠ Y[j], at least one of them is absent from the LCS. The LCS either does not use X[i] (so it equals the LCS of X[1..i-1] and Y[1..j]) or does not use Y[j] (so it equals the LCS of X[1..i] and Y[1..j-1]). Taking the max covers both cases.',
        'Induction on i + j: the base cases (i = 0 or j = 0) are trivially correct. If every cell with smaller i + j is correct, the recurrence produces the correct value for (i, j). The table fills in order of increasing i + j, so every dependency is already solved.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(mn). The table has (m+1)(n+1) cells, each filled in O(1). Backtracking walks at most m + n steps. For two 1,000-character strings, one million cells — a few milliseconds. Doubling both lengths quadruples the work.',
        'Space: O(mn) for the full table. If only the length is needed, two rolling rows suffice — O(min(m, n)) space — but backtracking requires the full table (or Hirschberg\'s divide-and-conquer trick to recover the LCS in O(min(m, n)) space at the cost of a constant-factor slowdown).',
        'For sequences with few matching character pairs, the Hunt-Szymanski algorithm runs in O(r log n) time, where r is the number of (i, j) pairs where X[i] = Y[j]. When the alphabet is large and matches are sparse, r is much smaller than mn.',
        'The Myers diff algorithm, used by git diff, finds the shortest edit script (equivalent to LCS) in O(nd) time where d is the number of differences. When two files are mostly identical, d is small and this is much faster than O(mn).',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Diff and patch: Unix diff computes the LCS of two files (treating each line as a character). Lines in the LCS are unchanged; lines not in the LCS are insertions or deletions. The output is a minimal edit script. Git diff, diff3, and merge tools all build on this.',
        'DNA and protein alignment: matching nucleotides or amino acids across two biological sequences is LCS with a scoring matrix. The Needleman-Wunsch algorithm is LCS generalized to allow weighted matches and gap penalties.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Needleman-Wunsch_pairwise_sequence_alignment.png/250px-Needleman-Wunsch_pairwise_sequence_alignment.png', alt: 'Needleman Wunsch alignment table with arrows for traceback', caption: 'Sequence-alignment DP uses the same grid dependency pattern as LCS, with scoring added for gaps and mismatches. Source: Wikimedia Commons.'},
        'Plagiarism detection: the LCS of two documents (at the word or sentence level) reveals ordered overlap that simple substring matching would miss. A long LCS relative to document length suggests copying.',
        'Version control merge: three-way merge identifies a common ancestor, computes the LCS of each branch against the ancestor, and combines the non-overlapping changes. Conflicts arise only where both branches modify the same region outside the LCS.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'O(mn) is slow for very long sequences. Comparing two 100,000-line files fills 10 billion cells. Practical diff tools cope by pre-filtering (hashing lines, removing common prefixes and suffixes) and using output-sensitive algorithms like Myers that scale with the number of differences rather than sequence length.',
        'LCS does not handle substitutions. If one character is replaced by another, LCS sees a deletion and an insertion — two operations — while edit distance counts it as one substitution. For measuring how close two strings are, edit distance is usually more appropriate.',
        'LCS length alone does not capture alignment quality. Two sequences can have the same LCS length but very different alignment structures. For tasks like DNA alignment where gap placement matters, gap penalties and scoring matrices (as in Needleman-Wunsch and Smith-Waterman) give more biologically meaningful results.',
        'The LCS is not unique. Multiple subsequences of the same maximum length may exist. The backtracking procedure returns one; finding all optimal subsequences requires exploring all tied branches, which can be exponential.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'X = "ABCBDAB" (m = 7), Y = "BDCAB" (n = 5). Build an 8 × 6 table.',
        'Base cases: row 0 and column 0 are all zeros.',
        'Row 1 (A): A vs B = 0, A vs D = 0, A vs C = 0, A vs A = dp[0][3] + 1 = 1, A vs B = max(1, 0) = 1. Row 1 = [0, 0, 0, 0, 1, 1].',
        'Row 2 (B): B vs B = dp[1][0] + 1 = 1, B vs D = max(dp[1][2], dp[2][1]) = max(0, 1) = 1, B vs C = max(1, 1) = 1, B vs A = max(1, 1) = 1, B vs B = dp[1][4] + 1 = 2. Row 2 = [0, 1, 1, 1, 1, 2].',
        'Row 3 (C): C vs B = max(1, 0) = 1, C vs D = max(1, 1) = 1, C vs C = dp[2][2] + 1 = 2, C vs A = max(2, 1) = 2, C vs B = max(2, 2) = 2. Row 3 = [0, 1, 1, 2, 2, 2].',
        'Row 4 (B): B vs B = dp[3][0] + 1 = 1, B vs D = max(dp[3][2], dp[4][1]) = max(1, 1) = 1, B vs C = max(dp[3][3], dp[4][2]) = max(2, 1) = 2, B vs A = max(2, 2) = 2, B vs B = dp[3][4] + 1 = 3. Row 4 = [0, 1, 1, 2, 2, 3].',
        'Row 5 (D): D vs B = max(dp[4][1], dp[5][0]) = max(1, 0) = 1, D vs D = dp[4][1] + 1 = 2, D vs C = max(dp[4][3], dp[5][2]) = max(2, 2) = 2, D vs A = max(2, 2) = 2, D vs B = max(3, 2) = 3. Row 5 = [0, 1, 2, 2, 2, 3].',
        'Row 6 (A): A vs B = max(dp[5][1], dp[6][0]) = max(1, 0) = 1, A vs D = max(dp[5][2], dp[6][1]) = max(2, 1) = 2, A vs C = max(2, 2) = 2, A vs A = dp[5][3] + 1 = 3, A vs B = max(3, 3) = 3. Row 6 = [0, 1, 2, 2, 3, 3].',
        'Row 7 (B): B vs B = dp[6][0] + 1 = 1, B vs D = max(dp[6][2], dp[7][1]) = max(2, 1) = 2, B vs C = max(2, 2) = 2, B vs A = max(3, 2) = 3, B vs B = dp[6][4] + 1 = 4. Row 7 = [0, 1, 2, 2, 3, 4].',
        'Answer: dp[7][5] = 4. Backtrack from (7,5): B = B → diagonal to (6,4), collect B. (6,4) A = A → diagonal to (5,3), collect A. (5,3) mismatch, dp[4][3] = 2 >= dp[5][2] = 2, go up to (4,3). (4,3) mismatch, dp[3][3] = 2 >= dp[4][2] = 1, go up to (3,3). (3,3) C = C → diagonal to (2,2), collect C. (2,2) mismatch, dp[1][2] = 0 < dp[2][1] = 1, go left to (2,1). (2,1) B = B → diagonal to (1,0), collect B. Reached edge. Diagonal steps collected in reverse order: B, A, C, B — reading forward: "BCAB". The LCS is "BCAB", length 4.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The LCS problem appears in Cormen, Leiserson, Rivest, and Stein (CLRS), Chapter 15. The connection to diff was formalized by Hunt and McIlroy (1976). Myers (1986), "An O(ND) Difference Algorithm and Its Variations," is the basis for modern diff tools including git diff.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: Memoization (Dynamic Programming) -- the technique that makes this tractable; understand why caching subproblem results eliminates exponential redundancy.',
            'Closely related: Edit Distance -- the same DP table structure with a different recurrence; measures transformation cost instead of shared structure.',
            'One-sequence variant: Longest Increasing Subsequence -- LCS of a sequence with its sorted version; solvable in O(n log n).',
            'String indexing: Suffix Array and Suffix Tree -- data structures that accelerate substring and common-substring queries on large texts.',
            'Production diff: the Myers diff algorithm (O(nd) time) and patience diff are the algorithms actually used by git diff and Unix diff, optimized for the common case where differences are small.',
          ],
        },
      ],
    },
  ],
};
