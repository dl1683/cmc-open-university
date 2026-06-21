// Dancing Links (DLX): reversible sparse-matrix state for exact cover search.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'dancing-links-exact-cover',
  title: 'Dancing Links & Exact Cover',
  category: 'Data Structures',
  summary: 'Knuth\'s DLX technique for exact cover: represent sparse 1s as circular doubly linked lists, cover constraints, recurse, and uncover in exact reverse order.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['exact cover matrix', 'cover and uncover', 'sudoku case study'], defaultValue: 'exact cover matrix' },
  ],
  run,
};

function labelMatrix(title, rowLabels, columnLabels, labelsByRow) {
  const labels = [''];
  const byLabel = new Map();
  const code = (label) => {
    if (!byLabel.has(label)) {
      byLabel.set(label, labels.length);
      labels.push(label);
    }
    return byLabel.get(label);
  };
  return matrixState({
    title,
    rows: rowLabels.map(([id, label]) => ({ id, label })),
    columns: columnLabels.map(([id, label]) => ({ id, label })),
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const ROWS = [
  ['r1', 'r1: C E F', ['C', 'E', 'F']],
  ['r2', 'r2: A D G', ['A', 'D', 'G']],
  ['r3', 'r3: B C F', ['B', 'C', 'F']],
  ['r4', 'r4: A D', ['A', 'D']],
  ['r5', 'r5: B G', ['B', 'G']],
  ['r6', 'r6: D E G', ['D', 'E', 'G']],
];

function matrixValues(activeRows = new Set(ROWS.map(([id]) => id)), activeColumns = new Set(COLUMNS)) {
  return ROWS.map(([id, , ones]) => COLUMNS.map((column) => {
    if (!activeRows.has(id) || !activeColumns.has(column)) return '-';
    return ones.includes(column) ? '1' : '.';
  }));
}

function* exactCoverMatrix() {
  yield {
    state: labelMatrix(
      'Exact cover matrix',
      ROWS.map(([id, label]) => [id, label]),
      COLUMNS.map((column) => [column, column]),
      matrixValues(),
    ),
    highlight: { active: ['r4:A', 'r4:D', 'r1:C', 'r1:E', 'r1:F', 'r5:B', 'r5:G'] },
    explanation: 'Exact cover asks for a subset of rows so every column is covered exactly once. In this toy matrix, rows r4, r1, and r5 cover A through G without overlap: r4 covers A,D; r1 covers C,E,F; r5 covers B,G.',
    invariant: 'A solution chooses rows whose 1s partition the constraint columns.',
  };

  yield {
    state: labelMatrix(
      'Choose the most constrained column',
      ROWS.map(([id, label]) => [id, label]),
      COLUMNS.map((column) => [column, column]),
      matrixValues(),
    ),
    highlight: { active: ['r2:A', 'r4:A'], compare: ['r2:D', 'r2:G', 'r4:D'] },
    explanation: 'Algorithm X chooses a column, usually the one with the fewest candidate rows. Column A has two choices: r2 or r4. The search branches over those rows. The heuristic is simple: branch where there are fewest legal moves left.',
  };

  const activeRows = new Set(['r1', 'r3', 'r5']);
  const activeColumns = new Set(['B', 'C', 'E', 'F', 'G']);
  yield {
    state: labelMatrix(
      'After choosing r4',
      ROWS.map(([id, label]) => [id, label]),
      COLUMNS.map((column) => [column, column]),
      matrixValues(activeRows, activeColumns),
    ),
    highlight: { found: ['r4:A', 'r4:D'], removed: ['r2:A', 'r2:D', 'r2:G', 'r6:D'], active: ['r1:C', 'r1:E', 'r1:F', 'r5:B', 'r5:G'] },
    explanation: 'Selecting r4 satisfies A and D. DLX covers columns A and D, then removes every row that conflicts with those columns. r2 and r6 disappear from the active matrix because they also cover D or A.',
    invariant: 'Choosing a row covers its columns and deletes rows that would cover any of them again.',
  };

  yield {
    state: labelMatrix(
      'Remaining exact cover',
      [
        ['choice1', 'choose r1'],
        ['choice2', 'choose r5'],
        ['done', 'solution'],
      ],
      [
        ['covered', 'covered columns'],
        ['status', 'status'],
      ],
      [
        ['C,E,F', 'legal'],
        ['B,G', 'legal'],
        ['A,B,C,D,E,F,G', 'exact cover'],
      ],
    ),
    highlight: { found: ['done:status', 'done:covered'], active: ['choice1:status', 'choice2:status'] },
    explanation: 'The remaining active rows r1 and r5 are compatible and cover the remaining columns. Algorithm X reaches a matrix with no uncovered primary columns, so the selected rows form a solution.',
  };
}

function* coverAndUncover() {
  yield {
    state: graphState({
      nodes: [
        { id: 'root', label: 'root', x: 0.8, y: 4.0, note: 'header' },
        { id: 'A', label: 'A', x: 2.1, y: 4.0, note: 'col' },
        { id: 'B', label: 'B', x: 3.4, y: 4.0, note: 'col' },
        { id: 'C', label: 'C', x: 4.7, y: 4.0, note: 'col' },
        { id: 'D', label: 'D', x: 6.0, y: 4.0, note: 'col' },
        { id: 'node', label: 'x', x: 3.4, y: 5.7, note: '1 in row' },
      ],
      edges: [
        { id: 'e-root-A', from: 'root', to: 'A', weight: 'R' },
        { id: 'e-A-B', from: 'A', to: 'B', weight: 'R' },
        { id: 'e-B-C', from: 'B', to: 'C', weight: 'R' },
        { id: 'e-C-D', from: 'C', to: 'D', weight: 'R' },
        { id: 'e-D-root', from: 'D', to: 'root', weight: 'R' },
        { id: 'e-B-node', from: 'B', to: 'node', weight: 'D' },
        { id: 'e-node-B', from: 'node', to: 'B', weight: 'U' },
      ],
    }, { title: 'DLX stores only the 1s as linked nodes' }),
    highlight: { active: ['A', 'B', 'C', 'D'], found: ['node'] },
    explanation: 'Dancing Links represents a sparse exact-cover matrix as circular doubly linked lists. Column headers are linked left and right. Every 1-cell is linked left/right inside its row and up/down inside its column.',
    invariant: 'The zeros are not stored; the sparse 1s carry four pointers each.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'L', label: 'left', x: 1.1, y: 4.0, note: 'x.left' },
        { id: 'x', label: 'x', x: 3.2, y: 4.0, note: 'remove' },
        { id: 'R', label: 'right', x: 5.3, y: 4.0, note: 'x.right' },
        { id: 'saved', label: 'saved ptrs', x: 7.4, y: 4.0, note: 'unchanged' },
      ],
      edges: [
        { id: 'e-L-x', from: 'L', to: 'x', weight: 'old' },
        { id: 'e-x-R', from: 'x', to: 'R', weight: 'old' },
        { id: 'e-L-R', from: 'L', to: 'R', weight: 'new' },
        { id: 'e-x-saved', from: 'x', to: 'saved' },
      ],
    }, { title: 'Cover is local pointer surgery' }),
    highlight: { removed: ['x'], found: ['e-L-R'], compare: ['saved'] },
    explanation: 'To remove a node from a doubly linked list, relink its neighbors around it. Crucially, x still remembers its left and right neighbors. That makes undo cheap: put x back between the same neighbors later.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'col', label: 'column C', x: 0.8, y: 4.0, note: 'cover' },
        { id: 'r1', label: 'r1', x: 2.6, y: 2.4, note: 'has C' },
        { id: 'r3', label: 'r3', x: 2.6, y: 5.6, note: 'has C' },
        { id: 'cE', label: 'E', x: 4.6, y: 2.4, note: 'also removed' },
        { id: 'cF', label: 'F', x: 4.6, y: 4.0, note: 'also removed' },
        { id: 'cB', label: 'B', x: 4.6, y: 5.6, note: 'also removed' },
        { id: 'stack', label: 'stack', x: 7.0, y: 4.0, note: 'undo order' },
      ],
      edges: [
        { id: 'e-col-r1', from: 'col', to: 'r1' },
        { id: 'e-col-r3', from: 'col', to: 'r3' },
        { id: 'e-r1-E', from: 'r1', to: 'cE' },
        { id: 'e-r1-F', from: 'r1', to: 'cF' },
        { id: 'e-r3-B', from: 'r3', to: 'cB' },
        { id: 'e-r3-F', from: 'r3', to: 'cF' },
        { id: 'e-all-stack', from: 'cF', to: 'stack' },
      ],
    }, { title: 'Covering a column removes conflicting rows' }),
    highlight: { active: ['col', 'r1', 'r3'], removed: ['cE', 'cF', 'cB'], found: ['stack'] },
    explanation: 'Covering column C removes the column header, then visits every row containing C. For each such row, all other 1s in that row are removed from their columns. Those removals encode conflicts.',
    invariant: 'Uncover runs the exact inverse loops in reverse order.',
  };

  yield {
    state: labelMatrix(
      'Why DLX is fast in backtracking',
      [
        ['copy', 'copy matrix'],
        ['bitset', 'bitsets'],
        ['dlx', 'Dancing Links'],
      ],
      [
        ['change', 'state change'],
        ['undo', 'undo'],
        ['fit', 'best fit'],
      ],
      [
        ['large copy', 'discard copy', 'small puzzles'],
        ['word ops', 'restore masks', 'dense-ish search'],
        ['pointer edits', 'reverse edits', 'sparse exact cover'],
      ],
    ),
    highlight: { found: ['dlx:change', 'dlx:undo'], compare: ['copy:change'] },
    explanation: 'DLX shines when the search changes a sparse constraint matrix millions of times. It does not copy the matrix at each recursive branch. It mutates locally, records the reversible structure implicitly in the links, and restores exactly.',
  };
}

function* sudokuCaseStudy() {
  yield {
    state: labelMatrix(
      '4x4 Sudoku as exact cover',
      [
        ['candidate', 'candidate r2c3=4'],
        ['cell', 'cell constraint'],
        ['row', 'row-digit constraint'],
        ['col', 'col-digit constraint'],
        ['box', 'box-digit constraint'],
      ],
      [
        ['meaning', 'meaning'],
        ['covered', 'covered by candidate'],
      ],
      [
        ['place digit 4 in row 2, col 3', 'one row'],
        ['cell r2c3 is filled', 'yes'],
        ['row 2 contains 4', 'yes'],
        ['col 3 contains 4', 'yes'],
        ['box top-right contains 4', 'yes'],
      ],
    ),
    highlight: { found: ['cell:covered', 'row:covered', 'col:covered', 'box:covered'], active: ['candidate:covered'] },
    explanation: 'A Sudoku candidate row has four 1s: one for the cell being filled, one for the row-digit rule, one for the column-digit rule, and one for the box-digit rule. Exact cover means every rule is satisfied exactly once.',
    invariant: 'Sudoku becomes: choose candidate rows so every constraint column is covered exactly once.',
  };

  yield {
    state: labelMatrix(
      'Matrix size',
      [
        ['four', '4x4 teaching puzzle'],
        ['nine', '9x9 Sudoku'],
        ['givens', 'given clues'],
      ],
      [
        ['rows', 'candidate rows'],
        ['cols', 'constraint columns'],
        ['ones', 'ones per row'],
      ],
      [
        ['64', '64', '4'],
        ['729', '324', '4'],
        ['remove conflicts', 'cover fixed rows', 'shrink search'],
      ],
    ),
    highlight: { active: ['nine:rows', 'nine:cols'], found: ['givens:rows'] },
    explanation: 'For ordinary 9x9 Sudoku, there are 9*9*9 = 729 candidate placements and 324 constraints: 81 cells, 81 row-digit rules, 81 column-digit rules, and 81 box-digit rules. The matrix is sparse: each candidate row contains only four 1s.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'choose', label: 'choose column', x: 0.8, y: 4.0, note: 'fewest rows' },
        { id: 'branch', label: 'try row', x: 2.8, y: 4.0, note: 'candidate' },
        { id: 'cover', label: 'cover', x: 4.7, y: 2.7, note: 'constraints' },
        { id: 'recurse', label: 'recurse', x: 6.6, y: 4.0, note: 'smaller matrix' },
        { id: 'uncover', label: 'uncover', x: 4.7, y: 5.3, note: 'backtrack' },
        { id: 'solution', label: 'solution', x: 8.4, y: 4.0, note: 'no columns' },
      ],
      edges: [
        { id: 'e-choose-branch', from: 'choose', to: 'branch' },
        { id: 'e-branch-cover', from: 'branch', to: 'cover' },
        { id: 'e-cover-recurse', from: 'cover', to: 'recurse' },
        { id: 'e-recurse-uncover', from: 'recurse', to: 'uncover', weight: 'if fail' },
        { id: 'e-uncover-branch', from: 'uncover', to: 'branch', weight: 'next' },
        { id: 'e-recurse-solution', from: 'recurse', to: 'solution' },
      ],
    }, { title: 'Algorithm X control flow' }),
    highlight: { active: ['choose', 'branch', 'cover'], compare: ['uncover'], found: ['solution'] },
    explanation: 'Algorithm X is ordinary recursive search, but DLX makes the state changes cheap and reversible. Choose the tightest constraint, try each candidate row, cover conflicts, recurse, and uncover if the branch fails.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'exact cover matrix') yield* exactCoverMatrix();
  else if (view === 'cover and uncover') yield* coverAndUncover();
  else if (view === 'sudoku case study') yield* sudokuCaseStudy();
  else throw new InputError('Pick a Dancing Links view.');
}

export const article = {
  sections: [
    {
      heading: 'Why Exact Cover Exists',
      paragraphs: [
        `Exact cover is the problem of choosing rows from a 0-1 matrix so every required column has exactly one selected 1. The matrix is a way to write constraints. A row is a possible choice. A column is a rule that must be satisfied once, not zero times and not twice.`,
        { type: 'callout', text: `DLX is valuable because exact-cover search spends more time undoing sparse state changes than choosing the next row.` },
        `This form is useful because many puzzles and search problems have the same hidden shape. A Sudoku candidate, a polyomino placement, and a queen placement can all be written as rows that satisfy several constraints at once. Exact cover gives one common search language for all of them.`,
        { type: 'image', src: `https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Exact_cover_instance.svg/250px-Exact_cover_instance.svg.png`, alt: `Exact cover instance showing selected subsets covering every element once`, caption: `The highlighted exact-cover instance shows the contract: selected choices partition the constraints. Source: https://en.wikipedia.org/wiki/Exact_cover.` },
      ],
    },
    {
      heading: 'The Obvious Matrix Search',
      paragraphs: [
        `A direct solver can keep a matrix of active rows and active columns. Pick an uncovered column, try each row that has a 1 in that column, delete columns covered by that row, delete conflicting rows, then recurse. If the active matrix has no required columns left, the chosen rows are a solution.`,
        `That approach is easy to understand and can work for small examples. It is also a good first implementation because it separates the search rule from the representation. The problem is not the logic of the search. The problem is how much state the solver must copy, rebuild, and scan while it explores a deep tree.`,
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        `Backtracking does not just move forward. It moves forward, discovers a contradiction, and then must restore the previous state exactly. A copied-matrix solver can do that by throwing away the failed copy, but every branch pays for a new matrix or a set of fresh row and column sets.`,
        `The cost becomes painful because exact-cover matrices are usually sparse. Most cells are zero, yet a dense copy touches them anyway. Even a set-based solver spends time allocating, hashing, and restoring sets. The search wants to change only the small number of 1s affected by a choice.`,
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        `Dancing Links, or DLX, stores only the 1s and makes deletion reversible. Each 1-cell is a node with four links: left and right within its row, up and down within its column. Column headers are linked too, so the live matrix is a set of circular doubly linked lists.`,
        { type: 'image', src: `https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Dancing_links.svg/250px-Dancing_links.svg.png`, alt: `Dancing Links sparse matrix as linked row and column nodes`, caption: `DLX stores sparse 1-cells as linked nodes, so cover and uncover are local pointer edits. Source: https://en.wikipedia.org/wiki/Dancing_links.` },
        `Removing a node from a doubly linked list is local pointer surgery. Its neighbors point around it, but the removed node still remembers the neighbors it used to have. If the solver later backtracks, it can splice the same node back into the same place. DLX turns search-state restoration into reversing pointer edits.`,
      ],
    },
    {
      heading: 'Algorithm X',
      paragraphs: [
        `Algorithm X is the recursive search procedure. If no primary columns remain, the chosen rows form an exact cover. Otherwise choose a column, usually the one with the fewest candidate rows. For each row in that column, select the row, cover every column touched by that row, recurse, and uncover if the branch fails.`,
        `The fewest-candidates heuristic does not change correctness. It changes the shape of the search tree. A column with one legal row forces the branch. A column with two rows splits the tree in two. A column with many rows is expensive, so Algorithm X tries to postpone those broad choices until tighter constraints have removed options.`,
      ],
    },
    {
      heading: 'Dancing Links State',
      paragraphs: [
        `Covering a column removes the column header from the header list. Then the solver walks down that column. For each row that contains a 1 in the covered column, it walks across the other 1s in the row and removes those nodes from their own columns. Those removals erase rows that would conflict with the selected row.`,
        `Uncovering runs the same structure backward. It walks rows and columns in reverse order and restores each node by reconnecting its saved up, down, left, and right neighbors. The order matters. If cover is a stack of local edits, uncover must pop that stack backward so every pointer sees the surrounding structure it had before.`,
      ],
    },
    {
      heading: 'What The Visual Proves',
      paragraphs: [
        `The matrix view proves the exact-cover contract. The chosen rows do not merely cover many columns; they partition the required columns. One overlap breaks the solution because some constraint is satisfied twice. One missing column breaks the solution because a constraint is not satisfied at all.`,
        `The linked-node view proves why DLX is a state-management technique. Highlighted nodes disappear from active lists, but they are not destroyed. They keep their old neighbor pointers, which is why the same branch can be undone without rebuilding the matrix from scratch.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `The correctness argument has two parts. First, Algorithm X is exhaustive over legal choices: for the chosen column, any exact cover must include exactly one row containing a 1 in that column. Branching over those rows therefore considers every possible solution for that column.`,
        `Second, covering preserves the exact-cover meaning. Once a row is selected, all columns touched by that row are already satisfied. Any other row touching one of those columns would create a duplicate cover, so removing it cannot remove a legal continuation. If a branch fails, reverse uncover restores the prior search state exactly, so no sibling branch is contaminated.`,
      ],
    },
    {
      heading: 'Cost And Tradeoffs',
      paragraphs: [
        `Exact cover is NP-complete, so DLX does not remove exponential search. It improves the cost of each search step. The memory cost is one node per 1 plus column headers. A cover or uncover operation costs time proportional to the sparse nodes it touches, not to the full row count times column count.`,
        `The tradeoff is pointer-heavy code. DLX has poor locality compared with arrays or bitsets, and bugs are easy because one wrong pointer corrupts future branches. For dense matrices or tiny puzzles, bitsets can be faster and simpler. DLX earns its keep when the matrix is sparse and the solver will mutate and restore it many times.`,
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        `Sudoku is the classic case study. A 9x9 puzzle has 729 candidate rows and 324 constraint columns: cell filled, row has digit, column has digit, and box has digit. Each candidate row contains only four 1s. Given clues pre-cover rows, and the remaining search often becomes a tight sparse exact-cover problem.`,
        `Polyomino tiling has the same shape. Each possible placement is a row. Board squares and piece-usage requirements are columns. DLX also fits exact placement, word, and combinatorial design problems where choices satisfy several all-or-nothing constraints and most possible row-column pairs are zero.`,
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        `DLX is the wrong tool when constraints are weighted, soft, or best-effort. Exact cover wants every primary column covered exactly once. If a problem asks for the cheapest cover, the maximum satisfied constraints, or a probabilistic score, it needs a different model or extra machinery around the exact-cover core.`,
        `It is also easy to confuse Algorithm X with DLX. Algorithm X is the search rule. Dancing Links is one representation of the active matrix. A clear set-based Algorithm X solver is often better for teaching, testing, or small inputs. DLX is a performance representation for serious sparse backtracking.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Study linked lists for the pointer operations, recursion for the search tree, and sparse matrix formats for the reason zeros should not dominate storage. Then compare DLX with bitset backtracking, constraint propagation, and SAT solving. Those alternatives attack the same pressure from different directions.`,
        `The primary source is Donald Knuth's "Dancing Links": https://arxiv.org/abs/cs/0011047. For contrast, study memoization and dynamic programming, where repeated subproblems are cached instead of undone. DLX is the opposite instinct: keep one mutable state, change it locally, and restore it exactly.`,
      ],
    },
  ],
};
