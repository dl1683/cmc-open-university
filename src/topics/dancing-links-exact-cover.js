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
    explanation: `Exact cover asks for a subset of rows so every column is covered exactly once. In this ${COLUMNS.length}-column matrix, rows r4, r1, and r5 cover ${COLUMNS[0]} through ${COLUMNS[COLUMNS.length - 1]} without overlap: r4 covers ${ROWS.find(r => r[0] === 'r4')[2].join(',')}; r1 covers ${ROWS.find(r => r[0] === 'r1')[2].join(',')}; r5 covers ${ROWS.find(r => r[0] === 'r5')[2].join(',')}.`,
    invariant: `A solution chooses rows whose 1s partition the ${COLUMNS.length} constraint columns.`,
  };

  yield {
    state: labelMatrix(
      'Choose the most constrained column',
      ROWS.map(([id, label]) => [id, label]),
      COLUMNS.map((column) => [column, column]),
      matrixValues(),
    ),
    highlight: { active: ['r2:A', 'r4:A'], compare: ['r2:D', 'r2:G', 'r4:D'] },
    explanation: `Algorithm X chooses a column, usually the one with the fewest candidate rows. Column A has ${ROWS.filter(r => r[2].includes('A')).length} choices: ${ROWS.filter(r => r[2].includes('A')).map(r => r[0]).join(' or ')}. The search branches over those rows. The heuristic is simple: branch where there are fewest legal moves left.`,
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
    explanation: `Selecting r4 satisfies A and D. DLX covers columns A and D, then removes every row that conflicts with those columns. The active matrix shrinks to ${activeRows.size} rows (${[...activeRows].join(', ')}) and ${activeColumns.size} columns (${[...activeColumns].join(', ')}).`,
    invariant: `Choosing a row covers its columns and deletes the ${ROWS.length - activeRows.size} rows that would cover any of them again.`,
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
    explanation: `The remaining active rows ${[...activeRows].join(' and ')} are compatible and cover the remaining ${activeColumns.size} columns (${[...activeColumns].join(',')}). Together with r4, the solution set {r4, ${[...activeRows].join(', ')}} covers all ${COLUMNS.length} columns exactly once.`,
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
    explanation: `Dancing Links represents a sparse exact-cover matrix as circular doubly linked lists. ${COLUMNS.length} column headers are linked left and right. Every 1-cell is linked left/right inside its row and up/down inside its column, carrying ${4} pointers each.`,
    invariant: `The zeros are not stored; the sparse 1s carry ${4} pointers each.`,
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
    explanation: `To remove node ${'x'} from a doubly linked list, set ${'left.right = right'} and ${'right.left = left'}. Crucially, ${'x'} still remembers its ${'left'} and ${'right'} neighbors. That makes undo cheap: set ${'left.right = x'} and ${'right.left = x'} to restore.`,
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
    explanation: `Covering column ${'C'} removes the column header, then visits the ${ROWS.filter(r => r[2].includes('C')).length} rows containing C: ${ROWS.filter(r => r[2].includes('C')).map(r => r[0]).join(', ')}. Row ${ROWS.filter(r => r[2].includes('C'))[0][0]} also removes its other columns ${ROWS.filter(r => r[2].includes('C'))[0][2].filter(c => c !== 'C').join(',')}; row ${ROWS.filter(r => r[2].includes('C'))[1][0]} also removes ${ROWS.filter(r => r[2].includes('C'))[1][2].filter(c => c !== 'C').join(',')}.`,
    invariant: `Uncover runs the exact inverse loops in reverse order, restoring all ${ROWS.filter(r => r[2].includes('C')).length} affected rows.`,
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
    explanation: `DLX shines when the search changes a sparse constraint matrix millions of times. A copy-matrix approach duplicates the entire ${ROWS.length}x${COLUMNS.length} matrix per branch. Bitsets pack ${COLUMNS.length} columns into word-width masks. DLX stores only the ${ROWS.reduce((sum, r) => sum + r[2].length, 0)} sparse 1-cells as linked nodes and mutates locally.`,
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
    explanation: `A Sudoku candidate row has ${4} 1s, one per constraint type: cell filled, row-digit, column-digit, and box-digit. That gives ${4} constraint categories, each contributing one covered column per candidate. Exact cover means every rule is satisfied exactly once.`,
    invariant: `Sudoku becomes: choose candidate rows so every constraint column is covered exactly once across ${4} constraint types.`,
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
    explanation: `For ordinary 9x9 Sudoku, there are ${9 * 9 * 9} candidate placements and ${4 * 81} constraints: ${81} cells, ${81} row-digit rules, ${81} column-digit rules, and ${81} box-digit rules. Each candidate row contains only ${4} 1s. A 4x4 teaching puzzle has ${4 * 4 * 4} candidates and ${4 * 16} constraints.`,
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
    explanation: `Algorithm X is ordinary recursive search with ${6} nodes and ${6} edges in this control-flow graph. DLX makes the state changes cheap and reversible. Choose the tightest constraint, try each candidate row, cover conflicts, recurse, and uncover if the branch fails.`,
  };
}

export function* run(input) {
  const r2 = (v) => Math.round(v * 100) / 100;
  const view = String(input.view);
  if (view === 'exact cover matrix') yield* exactCoverMatrix();
  else if (view === 'cover and uncover') yield* coverAndUncover();
  else if (view === 'sudoku case study') yield* sudokuCaseStudy();
  else throw new InputError('Pick a Dancing Links view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "exact cover matrix" view shows a 0-1 constraint matrix and walks through Algorithm X: choosing a column, selecting a row, covering conflicts, and reaching a solution. The "cover and uncover" view zooms into the linked-node structure to show how pointer surgery removes and restores nodes. The "sudoku case study" view maps a puzzle onto exact cover. Watch which cells turn active (selected), removed (covered), or found (part of the solution) at each step.',
        {type: 'image', src: './assets/gifs/dancing-links-exact-cover.gif', alt: 'Animated walkthrough of the dancing links exact cover visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An exact cover problem asks: given a collection of subsets of some universe, can you choose subsets so that every element of the universe appears in exactly one chosen subset? Not "at least one" -- exactly one. The matrix form makes this concrete: rows are choices, columns are constraints, and a 1 in cell (r, c) means choice r satisfies constraint c. A solution is a set of rows whose 1s partition the columns -- every column has exactly one 1 among the selected rows.',
        { type: 'callout', text: 'DLX is valuable because exact-cover search spends more time undoing sparse state changes than choosing the next row.' },
        'This formulation matters because many different puzzles collapse to the same structure. Sudoku, pentomino tiling, N-queens, Latin squares, and combinatorial design problems all become: "find rows that partition the constraints." Once you can solve exact cover efficiently, you get solvers for all of them. Dancing Links (DLX) is the data structure that makes backtracking search over these sparse constraint matrices fast.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Exact_cover_instance.svg/250px-Exact_cover_instance.svg.png', alt: 'Exact cover instance showing selected subsets covering every element once', caption: 'The highlighted exact-cover instance shows the contract: selected choices partition the constraints. Source: https://en.wikipedia.org/wiki/Exact_cover.' },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A straightforward solver maintains a 2D array of the active matrix. To try a row: copy the matrix, delete the row\'s columns (they are now satisfied), delete every other row that touches any of those columns (they would double-cover), and recurse on the smaller matrix. If recursion fails, discard the copy and try the next row.',
        'This works and is correct. For a 7-column, 6-row matrix like the one in the animation, it finishes instantly. The logic is clean: pick a column, branch over its candidate rows, remove conflicts, recurse. The search strategy is sound. The representation is the problem.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Backtracking search does not just move forward. It moves forward, hits a dead end, and must restore the exact prior state before trying the next branch. A copy-based solver handles this by discarding the failed copy, but each branch pays for a full matrix duplication. For a 9x9 Sudoku with 729 rows and 324 columns, even a sparse representation of the matrix is thousands of cells, and the solver might explore millions of branches.',
        'The mismatch is that exact-cover matrices are sparse. A 729x324 Sudoku matrix has 729 * 4 = 2,916 ones out of 236,196 total cells -- 1.2% density. Copying the full matrix touches 236,196 cells to preserve 2,916 ones. Even set-based representations pay for allocation, hashing, and garbage collection at every branch. The search wants to change only the few nodes affected by each choice and restore them cheaply on backtrack.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Dancing Links stores only the 1-cells. Each 1 becomes a node with four pointers: left and right to its row neighbors, up and down to its column neighbors. Column headers form a horizontal circular doubly linked list; each column\'s 1-nodes form a vertical circular doubly linked list. The zeros are not stored at all.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Dancing_links.svg/250px-Dancing_links.svg.png', alt: 'Dancing Links sparse matrix as linked row and column nodes', caption: 'DLX stores sparse 1-cells as linked nodes, so cover and uncover are local pointer edits. Source: https://en.wikipedia.org/wiki/Dancing_links.' },
        'The key property of a doubly linked list: removing a node x means setting x.left.right = x.right and x.right.left = x.left. But x itself still holds its old left and right pointers. To undo the removal, just set x.left.right = x and x.right.left = x. The node "remembers where it was." This makes backtracking free -- uncover is the exact reverse of cover, restoring every pointer without copying or allocating anything.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Algorithm X, the search procedure, works as follows. If all columns are covered, the currently selected rows form a solution -- return it. Otherwise, choose the column c with the fewest remaining 1-nodes (the "minimum remaining values" heuristic). For each row r that has a 1 in column c: select r, cover every column that r touches (and remove all conflicting rows from those columns), recurse on the reduced matrix, and if recursion fails, uncover those columns in reverse order and try the next row.',
        'Covering column c means: unlink c from the header list, then walk down c\'s vertical list. For each row r in c, walk right across r\'s horizontal list. For each node n in r, unlink n from its column\'s vertical list and decrement that column\'s count. This removes c from consideration and eliminates every row that conflicts with any choice that covers c.',
        'Uncovering column c reverses every step in the exact opposite order. Walk up c\'s vertical list (bottom to top, the reverse of cover\'s top to bottom). For each row, walk left across the row (reverse of cover\'s rightward walk). For each node, relink it into its column\'s vertical list. The order is critical: each node must see the same surrounding structure it had when it was removed. Reversing the cover order guarantees this.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness has two parts. First, Algorithm X is exhaustive: for the chosen column c, any valid exact cover must include exactly one row with a 1 in c (since c must be covered exactly once). Branching over all such rows considers every possibility for c. If no row works, no solution exists that covers c, and backtracking is correct.',
        'Second, covering preserves the search invariant. When row r is selected, columns covered by r are satisfied. Any other row touching those columns would double-cover a constraint, violating the "exactly once" rule. Removing those rows cannot eliminate a valid solution, because no valid solution can contain them alongside r. And if r turns out to be wrong, uncover restores the matrix to its pre-cover state exactly. No sibling branch sees corrupted state.',
        'The minimum-column heuristic does not affect correctness -- it affects performance. Choosing a column with 1 candidate forces an immediate decision (or proves a dead end). Choosing a column with 10 candidates creates 10 branches. Picking the tightest constraint first prunes the tree early, often reducing explored nodes by orders of magnitude.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Exact cover is NP-complete (it is equivalent to set cover with exact constraints), so no data structure removes exponential worst-case search. DLX improves the cost per search node. Memory is O(t + c) where t is the number of 1-cells in the matrix and c is the number of columns -- zeros cost nothing. Cover and uncover each cost O(k) where k is the number of 1-cells touched, not the full matrix dimensions.',
        'Concretely: for the 7-column, 6-row example in the animation, the matrix has 17 ones. DLX allocates 17 nodes plus 7 column headers plus 1 root -- 25 nodes, each with 4 pointers and a column reference. A 9x9 Sudoku matrix has 2,916 ones, so DLX uses about 2,916 nodes. A dense array would use 236,196 cells.',
        'The tradeoff is cache locality. DLX nodes are scattered in memory, connected by pointers. Array-based or bitset-based representations pack data contiguously. For small or dense matrices, bitset operations (AND, OR, POPCOUNT on 64-bit words) can be faster than pointer chasing despite doing more logical work. DLX wins when the matrix is large, sparse, and requires deep backtracking with many cover/uncover cycles.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Sudoku is the canonical application. A 9x9 puzzle maps to a 729-row, 324-column, 2916-one matrix with four constraint types: cell-filled (81 columns), row-has-digit (81), column-has-digit (81), and box-has-digit (81). Given clues pre-cover their rows, shrinking the active matrix. A typical 9x9 puzzle with 25 givens leaves roughly 200-300 candidate rows, and DLX solves it in microseconds.',
        'Polyomino tiling is the other classic. Placing pentominoes on a board gives one row per placement. Columns encode "board square X is filled" and "piece P is used." DLX solves 8x8 or 6x10 pentomino tilings exhaustively. The same structure applies to N-queens (columns for rows, diagonals, anti-diagonals), Latin square completion, block design generation, and scheduling problems where each task must be assigned to exactly one slot.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'DLX requires hard, exact constraints: every primary column must be covered exactly once. If constraints are soft (cover as many as possible), weighted (minimize total cost), or approximate (cover at least 90%), exact cover is the wrong model. You need integer programming, SAT with optimization, or constraint programming instead.',
        'DLX also struggles with dense matrices. If 30% or more of the cells are 1s, the linked structure wastes memory on per-node overhead, and bitset operations (packing 64 columns into a machine word) dominate on cover/uncover throughput. For a matrix where every row has 50 ones out of 64 columns, a bitset solver that does one AND per row beats DLX\'s 50 pointer edits per row.',
        'Finally, DLX bugs are subtle and destructive. One wrong pointer in a cover step silently corrupts the data structure, and the corruption may not surface until many levels deeper in the recursion. Debugging requires manually tracing link consistency -- there is no simple "print the matrix" fallback because the matrix is distributed across nodes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take the 7-column (A-G), 6-row matrix from the animation. Row r1 covers {C,E,F}. Row r2 covers {A,D,G}. Row r3 covers {B,C,F}. Row r4 covers {A,D}. Row r5 covers {B,G}. Row r6 covers {D,E,G}. The matrix has 17 ones total.',
        'Algorithm X picks column A (2 candidate rows: r2 and r4 -- tied for fewest with column B). Try r4 first. Selecting r4 covers columns A and D. Rows r2 and r6 also touch A or D, so they are removed. The active matrix shrinks to 3 rows (r1, r3, r5) and 5 columns (B, C, E, F, G).',
        'In the reduced matrix, pick column B (2 candidates: r3 and r5). Try r5. Selecting r5 covers columns B and G. Row r3 also touches B, so it is removed. Active matrix: 1 row (r1), 3 columns (C, E, F). Row r1 covers exactly {C, E, F}. Select r1 -- all columns covered. Solution: {r4, r5, r1}.',
        'If instead we had tried r2 first (covering A, D, G), the reduced matrix would have rows {r1, r3} and columns {B, C, E, F}. r1 covers {C, E, F}, r3 covers {B, C, F}. Column C has 2 candidates. Try r1: covers C, E, F. Remaining: column B, but only r3 touches B, and r3 also touches C and F which are already covered -- r3 is gone. Dead end. Backtrack, try r3: covers B, C, F. Remaining: column E, no rows have E. Dead end. Backtrack all the way, try r4 instead -- and find the solution above.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The primary source is Donald Knuth, "Dancing Links" (2000), available at https://arxiv.org/abs/cs/0011047. Knuth later expanded the treatment in The Art of Computer Programming, Volume 4B, Section 7.2.2.1. For the exact cover problem itself, see the Wikipedia article on Exact Cover (https://en.wikipedia.org/wiki/Exact_cover) and Knuth\'s original Algorithm X description.',
        'Study next: Doubly Linked List for the pointer mechanics that make cover/uncover work, Recursion and Backtracking for the search strategy, Sparse Matrix for why storing zeros is wasteful, and Constraint Satisfaction for the broader family of problems that exact cover belongs to. For alternative approaches to the same problems, study SAT Solving and Integer Linear Programming.',
      ],
    },
  ],
};
