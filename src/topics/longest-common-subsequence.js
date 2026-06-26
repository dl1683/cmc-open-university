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
    {heading: 'How to read the animation', paragraphs: ['Read the grid as prefix facts. Row i is the first i characters of the first string, column j is the first j characters of the second string, and the cell stores the LCS length for those two prefixes.', {type: 'callout', text: 'LCS works because every cell is a promise about two prefixes, so the full sequence problem becomes a grid of reusable prefix facts.'}, 'A diagonal move is legal when the two new characters match. A move from above or left skips one new character and keeps the better already-proved prefix answer.', {type: 'image', src: './assets/gifs/longest-common-subsequence.gif', alt: 'Animated walkthrough of the longest common subsequence visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    {heading: 'Why this exists', paragraphs: ['A subsequence keeps order but may skip items, so "ABCBDAB" contains "BCAB" without requiring adjacency. Longest common subsequence, or LCS, finds the longest ordered material shared by two sequences.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Nubio_Diff_Screenshot3.png/500px-Nubio_Diff_Screenshot3.png', alt: 'Diff view showing changed and unchanged lines between two text versions', caption: 'A diff view is the practical face of LCS: shared ordered lines become the stable spine, and the rest becomes insertions or deletions. Source: Wikimedia Commons, Nubio Diff screenshot.'}, 'This matters when exact substring matching is too strict. Diff tools, merge tools, and biological alignment systems first need the shared spine, then explain everything outside it as inserted, deleted, or gapped.']},
    {heading: 'The obvious approach', paragraphs: ['Generate every subsequence of the first sequence and test whether it appears in the second. A length m sequence has two to the m subsequences, so m = 30 already means about 1.07 billion candidates.']},
    {heading: 'The wall', paragraphs: ['Brute force repeats the same prefix comparisons through many branches. There are only (m + 1)(n + 1) distinct prefix pairs, so a table can solve each one once instead of rediscovering it exponentially.']},
    {heading: 'The core insight', paragraphs: ['The last characters decide the subproblem. If X[i] equals Y[j], the diagonal prefix answer grows by one; if they differ, at least one last character is skipped, so the answer is the larger of the above and left cells.']},
    {heading: 'How it works', paragraphs: ['Create dp with m + 1 rows and n + 1 columns. The empty row and column are zero, matches use dp[i - 1][j - 1] + 1, mismatches use max(dp[i - 1][j], dp[i][j - 1]), and dp[m][n] is the final length.', 'To recover a sequence, walk backward from the bottom-right cell. Matching diagonals record characters, while horizontal or vertical moves skip characters that did not improve the optimum.']},
    {heading: 'Why it works', paragraphs: ['The invariant is that each filled cell stores the true LCS length for its two prefixes. The base cells are true for empty prefixes, and every later cell uses only smaller prefix facts.', 'The recurrence is exhaustive because a longest common subsequence either uses the two equal last characters or excludes at least one unequal last character. Induction on i + j proves the table cannot miss a valid optimum or create an impossible one.']},
    {heading: 'Cost and complexity', paragraphs: ['Time is O(mn) because the table has (m + 1)(n + 1) cells and each cell does constant work. Doubling both sequence lengths makes about four times as many cells.', 'Space is O(mn) for the full table used by backtracking. If only the length is needed, two rolling rows reduce memory to O(min(m, n)).']},
    {heading: 'Real-world uses', paragraphs: ['Diff tools treat each line as a symbol. Lines in the LCS become unchanged context, and lines outside the LCS become insertions or deletions.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Needleman-Wunsch_pairwise_sequence_alignment.png/250px-Needleman-Wunsch_pairwise_sequence_alignment.png', alt: 'Needleman Wunsch alignment table with arrows for traceback', caption: 'Sequence-alignment DP uses the same grid dependency pattern as LCS, with scoring added for gaps and mismatches. Source: Wikimedia Commons.'}, 'Sequence-alignment algorithms extend the same grid with mismatch and gap scores. Merge tools use the common ordered material to separate independent edits from conflicting edits.']},
    {heading: 'Where it fails', paragraphs: ['The O(mn) table is too large for very long sequences. Two 100,000-item inputs imply ten billion cells, so production diff tools use trimming, hashing, sparse matches, or output-sensitive algorithms.', 'LCS also treats substitution as deletion plus insertion. Edit distance is a better fit when the cost of transforming one string into another matters.']},
    {heading: 'Worked example', paragraphs: ['Let X = "ABCBDAB" and Y = "BDCAB". The table is 8 by 6, including empty prefixes, and the final answer is dp[7][5].', 'A matching A at dp[1][4] gives dp[0][3] + 1 = 1, and a later matching B at dp[2][5] gives dp[1][4] + 1 = 2. Filling the table gives dp[7][5] = 4, and backtracking can return "BCAB".']},
    {heading: 'Sources and study next', paragraphs: ['Study LCS in CLRS under dynamic programming, then read Myers 1986 for practical diff. Study edit distance next for substitutions, and study longest increasing subsequence for a one-sequence variant with faster ordered bookkeeping.']},
  ],
};
