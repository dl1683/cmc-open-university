// Edit distance: the minimum number of single-character edits that turn one
// word into another, computed by filling a table where every cell answers a
// smaller version of the same question. Dynamic programming on a grid.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'edit-distance',
  title: 'Edit Distance (DP Table)',
  category: 'Concepts',
  summary: 'Fill a grid of subproblems and the spell-checker question answers itself in the corner.',
  controls: [
    { id: 'pair', label: 'Transform', type: 'select', options: ['kitten â†’ sitting', 'sunday â†’ saturday', 'cat â†’ cat'], defaultValue: 'kitten â†’ sitting' },
  ],
  run,
};


const PAIRS = {
  'kitten â†’ sitting': ['kitten', 'sitting'],
  'sunday â†’ saturday': ['sunday', 'saturday'],
  'cat â†’ cat': ['cat', 'cat'],
};
const UNFILLED = -1;

export function* run(input) {
  const pair = PAIRS[String(input.pair)];
  if (!pair) throw new InputError('Pick a word pair.');
  const [a, b] = pair;
  const m = a.length;
  const n = b.length;

  const rows = ['âˆ…', ...a].map((ch, i) => ({ id: `r${i}`, label: ch }));
  const cols = ['âˆ…', ...b].map((ch, j) => ({ id: `c${j}`, label: ch }));
  const T = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(UNFILLED));
  const snapshot = (title) => matrixState({
    title, rows, columns: cols,
    values: T.map((row) => [...row]),
    format: (v) => (v === UNFILLED ? 'Â·' : String(v)),
  });
  const cell = (i, j) => `r${i}:c${j}`;

  yield {
    state: snapshot(`How many single-character edits turn "${a}" into "${b}"?`),
    highlight: {},
    explanation: `Spell-checkers, git diffs, and DNA aligners all ask the same question: how FAR apart are two sequences? Distance = the minimum number of single-character edits (insert, delete, or substitute). Brute-forcing edit sequences explodes exponentially — instead we fill a table where cell (i, j) answers the smaller question: "cost of turning the first i letters of ${a} into the first j letters of ${b}". Solve every small question once, and the big answer is waiting in the corner (that is Memoization (Dynamic Programming), arranged on a grid).`,
  };

  for (let i = 0; i <= m; i += 1) T[i][0] = i;
  for (let j = 0; j <= n; j += 1) T[0][j] = j;
  yield {
    state: snapshot('Base cases: transforming to or from nothing'),
    highlight: { active: [...Array.from({ length: m + 1 }, (_, i) => cell(i, 0)), ...Array.from({ length: n + 1 }, (_, j) => cell(0, j))] },
    explanation: `The edges are free answers: turning the first i letters of "${a}" into an empty string takes exactly i deletions (first column), and building the first j letters of "${b}" from nothing takes j insertions (top row). Every later cell will lean on these.`,
  };

  for (let i = 1; i <= m; i += 1) {
    let example = null;
    for (let j = 1; j <= n; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        T[i][j] = T[i - 1][j - 1];
        if (!example) example = { j, match: true };
      } else {
        T[i][j] = 1 + Math.min(T[i - 1][j], T[i][j - 1], T[i - 1][j - 1]);
        if (!example) example = { j, match: false };
      }
    }
    const ex = example;
    yield {
      state: snapshot(`Filling row ${i} ('${a[i - 1]}')`),
      highlight: { active: Array.from({ length: n }, (_, j) => cell(i, j + 1)), visited: [cell(i - 1, ex.j - 1), cell(i - 1, ex.j), cell(i, ex.j - 1)] },
      explanation: `Row ${i}: each cell looks at THREE neighbors it already knows — diagonal (substitute), above (delete '${a[i - 1]}'), left (insert). Rule: if the letters match (${ex.match ? `like '${a[i - 1]}' and '${b[ex.j - 1]}' here — copy the diagonal, no edit needed` : `they don\'t at column ${ex.j} — take the cheapest neighbor and add 1 edit`}). Every cell is O(1); no cell is ever computed twice.`,
      invariant: 'Cell (i, j) = the true minimum edits between the first i and first j characters.',
    };
  }

  yield {
    state: snapshot(`The answer: ${T[m][n]} edit${T[m][n] === 1 ? '' : 's'}`),
    highlight: { found: [cell(m, n)] },
    explanation: `Bottom-right corner: turning "${a}" into "${b}" takes exactly ${T[m][n]} edit${T[m][n] === 1 ? '' : 's'} — and no sequence of edits can do better, because every cell held the provable minimum of its subproblem. Total work: ${(m + 1) * (n + 1)} cells Ã— O(1) = O(mÂ·n).`,
  };

  // traceback: recover the actual edits
  const path = [cell(m, n)];
  const ops = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && T[i][j] === T[i - 1][j - 1]) {
      i -= 1; j -= 1;
    } else if (i > 0 && j > 0 && T[i][j] === T[i - 1][j - 1] + 1) {
      ops.unshift(`substitute '${a[i - 1]}' â†’ '${b[j - 1]}'`);
      i -= 1; j -= 1;
    } else if (j > 0 && T[i][j] === T[i][j - 1] + 1) {
      ops.unshift(`insert '${b[j - 1]}'`);
      j -= 1;
    } else {
      ops.unshift(`delete '${a[i - 1]}'`);
      i -= 1;
    }
    path.unshift(cell(i, j));
  }

  yield {
    state: snapshot('Traceback: the table also remembers HOW'),
    highlight: { range: path, found: [cell(m, n)] },
    explanation: `Walk backward from the corner along the choices that built it, and the actual edit script falls out: ${ops.length ? ops.join(', ') : 'no edits at all — the words are identical, and the path rides the diagonal the whole way'}. This exact machinery powers spell-check suggestions ("did you mean…"), fuzzy search, plagiarism detection, and — with scoring tweaks — DNA sequence alignment (Needleman–Wunsch). One grid, filled once, answering both "how far?" and "how, exactly?".`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The grid has one row per character of the source string plus a row for the empty prefix, and one column per character of the target string plus a column for the empty prefix. Cell (i, j) holds the minimum number of edits needed to turn the first i source characters into the first j target characters.',
        {
          type: 'callout',
          text: 'The table is not bookkeeping; each cell is a proof that one prefix pair has already been solved optimally.',
        },
        'Active cells (highlighted) are the row currently being filled. Visited cells (dimmer) mark the three neighbors the active cell depends on: the cell above (a deletion), the cell to the left (an insertion), and the diagonal cell (a match or substitution). When a row finishes, every cell in it is final -- its value will never change.',
        'At the end, the found marker lands on the bottom-right corner: the answer for the full strings. The traceback path then lights up, walking backward from that corner to the origin. Each diagonal step with no cost increase is a character match. Each diagonal step with a cost increase is a substitution. A vertical step is a deletion; a horizontal step is an insertion. The path is the edit script.',
      
        {type: 'image', src: './assets/gifs/edit-distance.gif', alt: 'Animated walkthrough of the edit distance visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Vladimir Levenshtein defined this distance in 1965: given two strings, what is the minimum number of single-character insertions, deletions, and substitutions needed to transform one into the other? "cat" to "cut" costs 1 (substitute a for u). "kitten" to "sitting" costs 3. The number is a metric in the mathematical sense -- symmetric, zero only for identical strings, satisfying the triangle inequality -- so it gives a well-behaved notion of "how different."',
        'Any system that must tolerate inexact matches needs a distance like this. A spell checker must rank "receive" above "relieve" when the user types "recieve." A diff tool must align mostly-matching lines to produce a readable patch. A record-linkage pipeline must notice that "Jon Smith" and "John Smith" probably refer to the same person. DNA sequence alignment (Needleman-Wunsch, 1970) uses the same table structure with different scoring matrices. The problem is the same everywhere: measure the cheapest way to bridge two sequences.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The definition reads like a recursive algorithm. Compare the last characters of the two strings. If they match, the distance equals the distance of the two prefixes without those characters -- no edit needed. If they differ, try all three operations: delete the last source character and recurse (cost 1 + distance of the shorter source against the full target), insert the last target character and recurse (cost 1 + distance of the full source against the shorter target), or substitute and recurse (cost 1 + distance of both prefixes shortened by one). Return the cheapest.',
        'This is correct. For short strings it finishes fast. The code mirrors the math exactly, and every base case is obvious: transforming any string into the empty string costs its length in deletions, and vice versa for insertions.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The recursion branches three ways at every mismatch. For "kitten" to "sitting" (lengths 6 and 7), the call tree contains on the order of 3^7 paths. For two 20-character strings, roughly 3^20 -- 3.5 billion calls.',
        'The waste is redundancy, not difficulty. After deleting the first character then inserting one, or inserting first then deleting, the recursion often arrives at the same pair of remaining prefixes. The number of distinct prefix pairs is only (m+1)(n+1) -- 56 for "kitten"/"sitting" -- but the naive recursion visits many of them exponentially many times. These overlapping subproblems are exactly the structure dynamic programming exploits.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Label every prefix pair as its own subproblem. Let dp[i][j] be the minimum edit distance between the first i characters of the source and the first j characters of the target. The full answer is dp[m][n].',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Levenshtein_distance_animation.gif',
          alt: 'Animated Levenshtein distance matrix being filled across two words',
          caption: 'The same dynamic-programming grid fills one prefix pair at a time. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Levenshtein_distance_animation.gif',
        },
        'The recurrence relation follows from asking: what was the last operation?',
        {
          type: 'bullets',
          items: [
            'If source[i] = target[j], no edit is needed: dp[i][j] = dp[i-1][j-1].',
            'Otherwise, exactly one of three operations happened last:',
            'Delete source[i]: dp[i][j] = dp[i-1][j] + 1.',
            'Insert target[j]: dp[i][j] = dp[i][j-1] + 1.',
            'Substitute source[i] with target[j]: dp[i][j] = dp[i-1][j-1] + 1.',
          ],
        },
        'Take the minimum of these three. Each cell depends on at most three already-filled neighbors (above, left, diagonal), so the table fills in one left-to-right, top-to-bottom pass. This is the Wagner-Fischer algorithm (1974).',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build an (m+1) x (n+1) table. Initialize the borders: dp[i][0] = i for every i (deleting i characters to reach the empty string) and dp[0][j] = j for every j (inserting j characters from nothing). These base cases anchor the entire computation.',
        'Fill the remaining cells row by row, left to right. At cell (i, j), compare source[i-1] to target[j-1]. If they match, copy the diagonal: dp[i][j] = dp[i-1][j-1]. If they differ, set dp[i][j] = 1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]). Each cell is O(1) work. No cell is ever revisited.',
        'The bottom-right corner dp[m][n] is the edit distance. To recover the actual edit script, walk backward from dp[m][n] toward dp[0][0]. At each cell, check which neighbor produced its value: a diagonal step with no cost increase means the characters matched (keep both). A diagonal step with cost increase means a substitution. A step up means a deletion from the source. A step left means an insertion from the target. The path through the table is the alignment.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on optimal substructure (Bellman\'s principle). Consider any optimal edit script transforming the first i source characters into the first j target characters. Its final operation is one of: match, substitute, delete, or insert. If the final operation is a deletion of source[i], then everything before that deletion must itself be an optimal script for (i-1, j) -- otherwise substituting a cheaper prefix script would reduce the total cost, contradicting optimality. The same argument applies to insertion and substitution.',
        'The recurrence tries all three possible final operations and takes the minimum, so it cannot miss the optimum. The fill order guarantees that when cell (i, j) is computed, its three neighbors already hold their true minima. The invariant: after filling cell (i, j), it contains the exact minimum edit distance for its prefix pair. The bottom-right corner inherits this invariant for the full strings.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(mn). The table has (m+1)(n+1) cells, each filled in O(1). For "kitten" (6) and "sitting" (7), that is 56 cells. For two 1,000-character strings, one million cells. Doubling both lengths quadruples the work.',
        'Space: O(mn) for the full table. If only the distance is needed (not the edit script), space drops to O(min(m, n)). Each row depends only on the previous row and the current row\'s left neighbor, so two rolling rows suffice. Iterate the shorter string in the inner loop to minimize row width.',
        'If the edit script is also needed under tight memory, Hirschberg\'s algorithm (1975) recovers it in O(mn) time and O(min(m, n)) space by splitting the problem at a midpoint row using a forward and backward pass.',
        'When the expected edit distance d is small relative to string lengths, Ukkonen\'s optimization (1985) fills only a band of width 2d+1 around the main diagonal, reducing work to O(d * min(m, n)). Bit-parallel algorithms (Myers 1999) pack cell computations into machine words, achieving O(mn/w) where w is the word size (typically 64) -- fast enough for short-pattern fuzzy search in practice.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Spell checking: rank correction candidates by edit distance. "recieve" is distance 1 from "receive" and distance 2 from "relieve," so "receive" ranks first. Production spell checkers use BK-trees or Levenshtein automata to avoid computing the full table against every dictionary word.',
        'DNA sequence alignment: Needleman-Wunsch (1970) is the same recurrence with a substitution scoring matrix (like BLOSUM62 for amino acids) and affine gap penalties instead of unit costs. BLAST pre-filters with k-mer seeds before running full DP because genomes run billions of bases long.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Needleman-Wunsch_pairwise_sequence_alignment.png/250px-Needleman-Wunsch_pairwise_sequence_alignment.png',
          alt: 'Needleman Wunsch pairwise sequence alignment matrix',
          caption: 'Sequence alignment uses the same grid shape with biological scoring rules. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Needleman-Wunsch_pairwise_sequence_alignment.png',
        },
        'Diff tools: git diff and Unix diff use longest common subsequence on lines -- edit distance restricted to insert and delete, no substitution. The Myers diff algorithm (1986) runs in O(nd) time where d is the number of differences, which is fast when files are mostly identical.',
        'Fuzzy search and record linkage: Elasticsearch and Lucene match user queries against indexed terms within a configurable edit-distance threshold. Deduplication pipelines compare names, addresses, and identifiers across databases. OCR post-processing corrects recognition errors by finding the nearest dictionary word.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'O(mn) is slow for long sequences. Comparing a 10,000-character document against 100,000 candidates means 10 billion cell fills. Systems cope by pre-filtering with cheaper methods (q-gram overlap, locality-sensitive hashing) and reserving exact edit distance for final reranking.',
        'The metric does not handle transpositions. Swapping two adjacent characters ("ab" to "ba") costs 2 edits (delete + insert or two substitutions), but humans perceive it as a single typo. Damerau-Levenshtein adds transposition as a fourth operation at cost 1, which better models keyboard errors.',
        'Unit costs treat all edits as equally likely. Substituting a keyboard neighbor (e for r) is far more plausible than a random swap (e for z). Weighted edit distance with a domain-tuned cost matrix handles this, but requires calibration data.',
        'Edit distance measures surface form, not meaning. "car" and "automobile" are distance 8 but synonymous. "dog" and "dig" are distance 1 but unrelated. For semantic similarity, embedding-based methods are the right tool.',
        'Word-level or token-level edit distance is often more useful for NLP than character-level. Aligning sentences by words captures meaningful changes (inserted clauses, reworded phrases) that character alignment buries in noise. The same recurrence applies; only the unit changes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Transform "kitten" (m = 6) into "sitting" (n = 7). Build a 7 x 8 table. Label row headers: null, k, i, t, t, e, n. Label column headers: null, s, i, t, t, i, n, g.',
        'Base cases: row 0 = [0, 1, 2, 3, 4, 5, 6, 7]. Column 0 = [0, 1, 2, 3, 4, 5, 6].',
        'Row 1 (k): k vs s -- mismatch, 1 + min(dp[0][1], dp[1][0], dp[0][0]) = 1 + min(1, 1, 0) = 1. k vs i -- 1 + min(1, 1, 1) = 2. k vs t -- 1 + min(2, 2, 2) = 3. Continue: row 1 = [1, 1, 2, 3, 4, 5, 6, 7].',
        'Row 2 (i): i vs s = 1 + min(1, 2, 1) = 2. i vs i -- match, dp[1][1] = 1. i vs t = 1 + min(2, 1, 1) = 2. Continue: row 2 = [2, 2, 1, 2, 3, 4, 5, 6].',
        'Row 3 (t): t vs s = 1 + min(2, 3, 2) = 3. t vs i = 1 + min(1, 3, 2) = 2. t vs t -- match, dp[2][2] = 1. t vs t -- match, dp[2][3] = 2. Continue: row 3 = [3, 3, 2, 1, 2, 3, 4, 5].',
        'Rows 4-6 fill similarly. Row 4 (t) = [4, 4, 3, 2, 1, 2, 3, 4]. Row 5 (e) = [5, 5, 4, 3, 2, 2, 3, 4]. Row 6 (n) = [6, 6, 5, 4, 3, 3, 2, 3].',
        'The answer: dp[6][7] = 3. Backtracking from (6,7) reveals the three edits: substitute k with s (position 1), substitute e with i (position 5), insert g (at the end). The table computed 56 cells in O(1) each. Naive recursion would explore roughly 3^7 = 2,187 paths, most redundant.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Levenshtein 1965, "Binary codes capable of correcting deletions, insertions, and reversals" -- defined the distance metric. Wagner and Fischer 1974, "The String-to-String Correction Problem" -- the O(mn) DP algorithm and its correctness proof. Needleman and Wunsch 1970 -- global sequence alignment with the same recurrence under different scoring. Hirschberg 1975 -- linear-space alignment via divide and conquer. Myers 1986 -- the O(nd) diff algorithm behind git diff.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: Memoization and dynamic programming -- the technique underlying this algorithm; understand why caching subproblem results eliminates exponential redundancy.',
            'Related DP problem: Longest Common Subsequence -- edit distance restricted to insert and delete (no substitution). LCS length equals (m + n - edit_distance) / 2 under that restriction.',
            'Sequence alignment: Needleman-Wunsch (global) and Smith-Waterman (local) -- the same recurrence with substitution matrices and gap penalties, used throughout bioinformatics.',
            'Exact matching: String Matching (KMP, Rabin-Karp) -- finding exact occurrences rather than measuring similarity; a complementary problem.',
            'Indexing for fuzzy search: Suffix Array and BK-tree -- data structures that accelerate edit-distance queries over large dictionaries.',
            'Extensions: Damerau-Levenshtein (adds transposition as a fourth operation), weighted edit distance (non-unit costs), Ukkonen banded DP (fast when distance is small), bit-parallel Myers (packing cells into machine words for short patterns).',
          ],
        },
      ],
    },
  ],
};
