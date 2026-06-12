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
    { id: 'pair', label: 'Transform', type: 'select', options: ['kitten → sitting', 'sunday → saturday', 'cat → cat'], defaultValue: 'kitten → sitting' },
  ],
  run,
};

const PAIRS = {
  'kitten → sitting': ['kitten', 'sitting'],
  'sunday → saturday': ['sunday', 'saturday'],
  'cat → cat': ['cat', 'cat'],
};
const UNFILLED = -1;

export function* run(input) {
  const pair = PAIRS[String(input.pair)];
  if (!pair) throw new InputError('Pick a word pair.');
  const [a, b] = pair;
  const m = a.length;
  const n = b.length;

  const rows = ['∅', ...a].map((ch, i) => ({ id: `r${i}`, label: ch }));
  const cols = ['∅', ...b].map((ch, j) => ({ id: `c${j}`, label: ch }));
  const T = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(UNFILLED));
  const snapshot = (title) => matrixState({
    title, rows, columns: cols,
    values: T.map((row) => [...row]),
    format: (v) => (v === UNFILLED ? '·' : String(v)),
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
      explanation: `Row ${i}: each cell looks at THREE neighbors it already knows — diagonal (substitute), above (delete '${a[i - 1]}'), left (insert). Rule: if the letters match (${ex.match ? `like '${a[i - 1]}' and '${b[ex.j - 1]}' here — copy the diagonal, no edit needed` : `they don't at column ${ex.j} — take the cheapest neighbor and add 1 edit`}). Every cell is O(1); no cell is ever computed twice.`,
      invariant: 'Cell (i, j) = the true minimum edits between the first i and first j characters.',
    };
  }

  yield {
    state: snapshot(`The answer: ${T[m][n]} edit${T[m][n] === 1 ? '' : 's'}`),
    highlight: { found: [cell(m, n)] },
    explanation: `Bottom-right corner: turning "${a}" into "${b}" takes exactly ${T[m][n]} edit${T[m][n] === 1 ? '' : 's'} — and no sequence of edits can do better, because every cell held the provable minimum of its subproblem. Total work: ${(m + 1) * (n + 1)} cells × O(1) = O(m·n).`,
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
      ops.unshift(`substitute '${a[i - 1]}' → '${b[j - 1]}'`);
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
      heading: 'What it is',
      paragraphs: [
        `Edit distance (also called Levenshtein distance, after Vladimir Levenshtein who formalized it in 1965) is the minimum number of single-character edits — insertion, deletion, or substitution — required to transform one string into another. Turn kitten into sitting: substitute k→s, substitute e→i, insert g, and you have three edits. This distance metric quantifies how different two sequences are, and it drives spell-checkers, search fuzzing, plagiarism detection, and genomic alignment.`,
        `The problem is solved not by enumerating all possible edit sequences (exponential explosion) but by filling a table where each cell (i, j) answers a smaller version of the same question: what is the minimum cost to transform the first i characters of the source string into the first j characters of the target? That is memoization on a 2D grid — dynamic programming. Cell (i, j) never computes twice; there are only O(m·n) cells, each fills in O(1) time.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Build an (m+1) × (n+1) table where m and n are the lengths of the two strings. The rows represent prefixes of the first string (starting with the empty string), and columns represent prefixes of the second. Base cases are the edges: row 0 represents building any prefix of the target from nothing (j insertions), and column 0 represents deleting all i characters from the source (i deletions).`,
        `For each interior cell (i, j), look at what character is being added in each string. If they match, copy the diagonal value — no edit is needed for this pair. If they don't match, take the minimum of three neighboring cells (diagonal for substitution, above for deletion, left for insertion), add 1 for the operation cost, and store that value. This greedy choice is optimal because subproblems are independent: the cost to fix the first k characters is never affected by what you do later.`,
        `After filling the table, the bottom-right cell (m, n) holds the answer. To recover the actual sequence of edits, traceback: start at (m, n) and walk backward, following the neighbor that was chosen at each step — match implies moving diagonally without an operation, and a mismatch implies moving along whichever neighbor was minimum (choosing the direction reveals the edit type).`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Time complexity is O(m·n): you fill a table of (m+1) × (n+1) cells, each in O(1). Space complexity is O(m·n) for the table itself, though space can be optimized to O(min(m, n)) if you only keep one or two rows at a time. The traceback phase is O(m+n) — you walk back through at most m+n cells. For practical strings (words, genes), O(m·n) is fast: comparing two 1000-character strings is a million operations, which modern hardware executes in microseconds.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Spell-checking: when you type "teh", a spell-checker computes edit distance to every word in the dictionary, suggests those within distance 1 or 2, and ranks by frequency. Git diff (version control) uses a variant that also considers whole-line insertions and deletions. DNA sequence alignment (Needleman–Wunsch for global alignment, Smith–Waterman for local alignment) uses the exact same DP table, but with biological-domain scoring: matches get +5, substitutions get -4, and gap penalties reflect mutation likelihood.`,
        `Plagiarism detection uses edit distance on tokenized documents. Fuzzy search in databases allows approximate matching. Machine translation systems use variants to measure similarity between reference and candidate translations. The core insight — tabling subproblems instead of recomputing them — is universally applicable; what changes is the scoring function and whether you traceback the path.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `First: assuming the three operations (insert, delete, substitute) have equal cost. In reality, they often don't. DNA alignment might penalize substitution differently than deletion. Spelling apps weight uncommon edits higher. If you change the cost function, the recurrence rule changes accordingly: substitute costs c_sub, delete costs c_del, insert costs c_ins, and you take 1 + min(T[i-1][j-1]+c_sub, T[i-1][j]+c_del, T[i][j-1]+c_ins).`,
        `Second: confusing edit distance with longest common subsequence (LCS). LCS counts the longest matching characters in order but ignores mismatches; edit distance counts the edits needed to align everything. They are related — edit distance = m + n - 2 × LCS length — but they answer different questions. If you care about insertions and deletions only (no substitutions), use LCS; if edits have a true cost, use edit distance.`,
        `Third: forgetting that the table is for a specific pair of strings. Edit distance is symmetric in math (distance from A to B equals B to A) but the DP table fills differently. Always be clear about which string is rows and which is columns. Also: the answer is in (m, n), not (n, m) — row m, column n.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Edit distance is a canonical example of Memoization (Dynamic Programming) — the art of tabling subproblems on a grid. Understand Two Pointers to see how some sequence problems solve in O(n) without tabling. Revisit Recursion to see edit distance as a recursive function (cost(i, j) = cost of s1[i:] → s2[j:]) before you optimize it. If you go deeper into string algorithms, Trie (Prefix Tree) enables fast dictionary lookups for spell-checking, and Tokenization (BPE) is how modern language models break text before computing distances.`,
      ],
    },
  ],
};

