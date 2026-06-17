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
        `Edit distance measures how much work it takes to turn one sequence into another. In the standard Levenshtein version, the allowed edits are insert one symbol, delete one symbol, or substitute one symbol for another. The distance between cat and cut is 1 because one substitution changes a to u. The distance between kitten and sitting is 3 under unit costs. This gives a concrete number for "near but not identical."`,
        `The idea applies to strings, DNA bases, tokens, OCR output, product names, file lines, or any ordered sequence once the edit operations are defined. It is useful because many systems do not need exact equality. A search box should recover from a typo. A diff tool should align mostly similar text. A record-linkage system should notice that two names may refer to the same person even when punctuation, spelling, or transcription differs.`,
        `The distance is a model, not a law of nature. Before using it, decide what the symbols are. Character distance is good for short typos. Token distance may be better for sentences. Line distance may be better for source files. DNA alignment may need bases plus gap penalties. The same table pattern works across these cases only after the unit of comparison and cost rules match the question being asked.`,
      ],
    },
    {
      heading: 'The obvious approach and wall',
      paragraphs: [
        `The direct approach is to try edit scripts. At each mismatch, delete from the source, insert from the target, or substitute one symbol for the other, then keep exploring until the source equals the target. This is not a silly plan. It mirrors the definition of the problem, and for tiny examples a human can reason exactly this way.`,
        `The wall is repeated branching over the same suffix pairs. After several different early edits, the algorithm often reaches the same question again: what is the distance between the remaining part of one string and the remaining part of the other? Brute force forgets that it already solved that question. The number of possible scripts grows explosively, while the number of distinct prefix-pair questions is only the size of a rectangular grid.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to make every prefix pair a subproblem. Cell i, j in the table means the minimum edit cost for turning the first i symbols of the source into the first j symbols of the target. Once that definition is fixed, the recurrence is forced by the last operation. The last operation was either a deletion, an insertion, a substitution, or no edit if the last symbols already match.`,
        `That gives each cell three dependencies. The cell above represents deleting the current source symbol. The cell to the left represents inserting the current target symbol. The diagonal cell represents matching or substituting the two current symbols. If the symbols match, copy the diagonal. If they differ, take one plus the cheapest of above, left, and diagonal. The final answer is in the bottom-right cell because that cell compares the full source with the full target.`,
      ],
    },
    {
      heading: 'Mechanism and table layout',
      paragraphs: [
        `The first row and first column are base cases, not decoration. Turning a nonempty prefix into an empty prefix takes one deletion per source symbol. Turning an empty prefix into a nonempty target prefix takes one insertion per target symbol. Those edge values anchor the rest of the grid. From there, fill cells in an order where above, left, and diagonal are already known, usually row by row or column by column.`,
        `The table is a dynamic-programming data structure. It stores the result of each subproblem so later cells can reuse it in constant time. If the source has length m and the target has length n, the table has (m + 1)(n + 1) cells. Each cell holds a cost. If the application also needs an edit script, the implementation can store a backpointer or recover one later by walking from the bottom-right cell toward the top-left along choices that explain the cost.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Correctness comes from optimal substructure. Take any optimal script for prefixes i and j. Look at its final step. If it ends by deleting source symbol i, then everything before that final deletion must be an optimal script for prefixes i - 1 and j; otherwise replacing it with a cheaper script would improve the whole answer. The same argument holds for insertion and substitution. A match is just a diagonal move with zero additional cost.`,
        `Because every possible final operation is represented by one of the three neighbors, the recurrence cannot miss the optimum. Because the table fills smaller prefixes before larger prefixes, each neighbor already contains its true minimum when the current cell is computed. The invariant after filling any cell is plain: that cell is the true minimum edit cost for its prefix pair. The bottom-right cell inherits the invariant for the complete strings.`,
      ],
    },
    {
      heading: 'Cost and practical variants',
      paragraphs: [
        `The classic algorithm costs O(mn) time and O(mn) space. That is excellent compared with enumerating scripts, but it is still expensive for long strings or large candidate sets. If a search engine compares a query with millions of names, even a small grid per candidate may be too much. If only the distance is needed, memory can drop to two rows, or even one row with careful updates, because each new row depends only on the previous row and the current row's left cell.`,
        `If the edit script is needed, full memory or backpointer storage is more convenient. Other variants change the model. Weighted edit distance charges different costs for likely keyboard mistakes, phonetic confusions, or domain-specific substitutions. Damerau-Levenshtein adds transposition for swapped adjacent characters. Banded dynamic programming assumes the answer is small and fills only cells near the diagonal. Bit-parallel algorithms pack many cells into machine words for short patterns. Each variant keeps the same habit: define the subproblem carefully, then reuse it.`,
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        `Edit distance is useful when surface form matters. Spell checkers rank candidate corrections. Fuzzy search tolerates missing letters and extra letters. OCR cleanup compares noisy text against known vocabularies. Record linkage compares names, addresses, and identifiers that may have typos. Bioinformatics alignment uses related dynamic-programming grids with gap penalties and substitution scores. Plagiarism and code-similarity tools use edit-like ideas after choosing the right unit, such as characters, tokens, or lines.`,
        `Operationally, the important signals are not just average distance. Systems track candidate-generation recall, false matches at a chosen threshold, latency per comparison, p95 query cost, and how often the distance model agrees with human judgment. A typo-tolerant product search has different goals from a legal document diff. In one setting, overmatching is annoying. In another, overmatching can attach the wrong record to a person. The edit model must fit the consequence of an error.`,
        `Thresholds need calibration. A distance of 2 is tiny for a 30-character product title and huge for a 3-character airport code. Many systems normalize by length, restrict comparisons to candidates from a trie or q-gram index, or use edit distance only as a reranker after cheaper filters. The algorithm gives the exact answer for a pair; the surrounding retrieval system decides which pairs deserve that exact computation.`,
      ],
    },
    {
      heading: 'Where it fails and what to study next',
      paragraphs: [
        `Edit distance is not semantic similarity. The strings dog and dig are close by character edits but refer to different words. The strings car and automobile are far by character edits but close in meaning. Unit-cost character edits also treat all mistakes as equally likely, which is rarely true. A one-letter keyboard neighbor may be more plausible than a random substitution. A missing middle initial in a name is different from a changed surname.`,
        `Study recursion and memoization first, then dynamic programming tables, longest common subsequence, Needleman-Wunsch alignment, tries, BK-trees, q-gram indexes, and tokenization. The original Levenshtein paper, "Binary codes capable of correcting deletions, insertions, and reversals," is the historical source. The deeper lesson is broader than strings: when an exponential search keeps asking the same smaller questions, name the subquestions, store their answers, and prove that the recurrence covers every valid final step.`,
      ],
    },
  ],
};
