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
      heading: 'What it is',
      paragraphs: [
        'Dancing Links, usually called DLX, is Donald Knuth\'s efficient representation for Algorithm X, a backtracking algorithm for exact cover. Exact cover starts with a 0-1 matrix and asks for a subset of rows such that every column contains exactly one selected 1. This form captures Sudoku, polyomino tiling, N-Queens variants, word-square searches, and many constraint puzzles.',
        'The data-structure idea is sharper than the puzzle examples. Exact-cover matrices are usually sparse, so DLX stores only the 1s. Each 1 is a node in a toroidal circular doubly linked structure: left and right across its row, up and down through its column. Covering a constraint removes a column and all conflicting rows through local pointer edits. Uncovering restores those edits in exact reverse order.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Algorithm X repeatedly chooses an uncovered column, usually the one with the fewest candidate rows. For every row that can cover that column, it tentatively selects the row, covers every column touched by that row, and recurses on the smaller matrix. If no columns remain, the selected rows are a solution. If a chosen column has no rows, the branch is impossible and the algorithm backtracks.',
        'DLX makes the backtracking cheap. Removing a node x from a doubly linked list is local: link x.left to x.right and x.right to x.left. Because x keeps its old neighbor pointers, restoration is also local. Cover and uncover are just structured versions of that move applied across column and row lists. The rule is strict: uncover must reverse cover in the opposite order so every pointer returns to its previous value.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Exact cover is NP-complete, so DLX is not a polynomial-time escape hatch. Its value is constant-factor and search-tree discipline. It avoids copying a matrix at every recursive branch, skips zeros entirely, keeps column sizes available for the fewest-candidates heuristic, and restores state with pointer edits instead of rebuilding data structures.',
        'The memory cost is one node per 1 plus headers for columns. For 9x9 Sudoku, the exact-cover matrix has 729 candidate rows and 324 constraint columns, but each candidate row has only four 1s. That sparsity is exactly what DLX exploits. The search cost still depends on puzzle difficulty and branching, but each cover/uncover step is proportional to the affected sparse nodes rather than the dense matrix area.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Sudoku becomes exact cover cleanly. A candidate such as row 2, column 3, digit 4 covers four constraints: the cell r2c3 is filled, row 2 contains digit 4, column 3 contains digit 4, and the containing box has digit 4. A full solution chooses 81 candidate rows, one per filled cell, and covers all 324 constraints exactly once.',
        'Given clues simply pre-cover rows and their conflicts before search begins. Then the fewest-candidates heuristic often picks a heavily constrained cell or digit rule, reducing branching. The same translation works for polyomino tiling: each possible placement is a row, each board square is a primary column, and each physical piece can be represented as a column saying the piece is used once.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'DLX is not a general-purpose linked-list trick to use everywhere. It is specialized for reversible sparse-state search. A normal array or bitset can beat it for dense problems or small cases because pointer-heavy structures have cache costs. The technique earns its keep when the search repeatedly removes and restores sparse constraints.',
        'Also separate Algorithm X from DLX. Algorithm X is the recursive exact-cover search. Dancing Links is the data structure that makes the matrix updates cheap. You can implement Algorithm X with sets, bitsets, or copied matrices; DLX is the pointer-based implementation Knuth made famous. Finally, exact cover is exact: every primary column must be covered once. Optional or secondary constraints, such as N-Queens diagonals, need explicit modeling.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Knuth, "Dancing Links", at https://arxiv.org/abs/cs/0011047 and PDF mirror at https://www.rose-hulman.edu/class/cs/csse313/assignments/csp/DancingLinks.pdf. For compact Algorithm X code, see https://www.cs.mcgill.ca/~aassaf9/python/algorithm_x.html. Study Linked List for the pointer model, Recursion for the search tree, Compressed Sparse Row Graph for sparse representation instincts, Graph BFS and Hopcroft-Karp Bipartite Matching for contrasting graph search, and Memoization (Dynamic Programming) for the opposite strategy: caching results rather than reversible mutation.',
      ],
    },
  ],
};
