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
        `Edit Distance (DP Table) measures how many single-character insertions, deletions, and substitutions are needed to turn one string into another. Vladimir Levenshtein formalized this unit-cost version in 1965. The visualization offers kitten to sitting, sunday to saturday, and cat to cat. For kitten to sitting, the answer is 3: substitute k with s, substitute e with i, and insert g.`,
        `This is a sequence comparison problem. Recursion gives the natural definition: the distance between two suffixes is the best of delete, insert, or substitute, plus the distance of the smaller suffixes. But raw recursion recomputes the same suffix pairs exponentially many times. Memoization (Dynamic Programming) stores every subproblem in a grid, so each cell answers one prefix-pair question once.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Build a table with m + 1 rows and n + 1 columns. Row i means the first i characters of the source; column j means the first j characters of the target. The first column is i deletions to reach the empty string. The first row is j insertions from the empty string. Then each interior cell looks at three already-computed neighbors: diagonal for substitution or match, above for deletion, and left for insertion.`,
        `If the two current characters match, copy the diagonal cost. If they differ, store 1 + min(diagonal, above, left). The demo fills the grid row by row and highlights exactly those three dependencies. The bottom-right cell is the distance. A traceback then walks backward to recover an edit script, not just the number. This is why the table is more informative than a greedy scan with Two Pointers or a simple Sliding Window.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `The standard dynamic program costs O(mn) time and O(mn) space. If you only need the distance, not the edit script, you can store two rows and reduce space to O(min(m, n)). Traceback takes O(m + n) after the full table is stored. For two 1,000-character strings, the table has about one million cells, which is practical; for millions of characters, production systems use banding, indexes, or problem-specific approximations.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Spell-checkers compare a typo against dictionary candidates, often after a Trie (Prefix Tree) narrows the search. Fuzzy search, record linkage, OCR cleanup, and DNA alignment all use variants. Git-style text diff is related, though many diff tools use Myers' shortest-edit-script algorithm rather than this exact table. Tokenization (BPE) matters in modern language systems because distance can be computed over characters, bytes, tokens, or words, and the choice changes the meaning of "one edit."`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Equal costs are a model, not a law. DNA alignment may reward matches and penalize gaps differently; keyboard typo correction may make nearby-key substitutions cheaper. The recurrence then becomes min(diagonal + substitutionCost, above + deletionCost, left + insertionCost), with match cost often zero. Another common mistake is quoting the longest-common-subsequence formula as Levenshtein distance. m + n - 2 * LCS length is the insert/delete distance when substitutions are not allowed as a one-step edit.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary source: Levenshtein, "Binary codes capable of correcting deletions, insertions, and reversals", IEEE page at https://ieeexplore.ieee.org/document/5392606. Study Memoization (Dynamic Programming) for the general grid pattern, then Recursion for the exponential version this table replaces. Compare with Two Pointers and Sliding Window to learn when sequence problems collapse to O(n) instead of needing O(mn). For applications, read BK-Tree Metric Spellcheck, Trie (Prefix Tree), Tokenization (BPE), and Big-O Growth Rates so you can reason about dictionary scale and text length before choosing an approach.`,
      ],
    },
  ],
};
