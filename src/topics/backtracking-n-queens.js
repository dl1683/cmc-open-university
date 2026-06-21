// Backtracking & N-Queens: place n non-attacking queens on an n×n board by
// trying one queen per row, pruning columns and diagonals that conflict, and
// undoing placements when no column works. The search tree is exponential in
// the worst case, but pruning makes it practical.

import { matrixState, parseIntegerInRange } from '../core/state.js';

export const topic = {
  id: 'backtracking-n-queens',
  title: 'Backtracking & N-Queens',
  category: 'Algorithms',
  summary: 'Place queens one row at a time, prune conflicts, and undo choices that lead nowhere — the pattern behind constraint satisfaction, puzzle solvers, and combinatorial search.',
  controls: [
    { id: 'n', label: 'Board size', type: 'select', options: ['4', '5', '6'], defaultValue: '4' },
  ],
  run,
};

// Board cell codes
const EMPTY = 0;
const QUEEN = 1;
const CONFLICT = 2;
const TRYING = 3;
const PRUNED = 4;

function boardSnapshot(title, board, n) {
  const rows = Array.from({ length: n }, (_, i) => ({ id: `r${i}`, label: `${i + 1}` }));
  const cols = Array.from({ length: n }, (_, j) => ({ id: `c${j}`, label: `${j + 1}` }));
  return matrixState({
    title,
    rows,
    columns: cols,
    values: board.map((row) => [...row]),
    format: (v) => ['·', '♛', '✕', '?', '—'][v] ?? '·',
  });
}

function clearBoard(n) {
  return Array.from({ length: n }, () => new Array(n).fill(EMPTY));
}

function placeQueens(board, queens) {
  const b = board.map((row) => [...row]);
  for (const [r, c] of queens) b[r][c] = QUEEN;
  return b;
}

function conflicts(queens, row, col) {
  for (const [qr, qc] of queens) {
    if (qc === col) return true;
    if (Math.abs(qr - row) === Math.abs(qc - col)) return true;
  }
  return false;
}

function markConflicts(board, queens, row, n) {
  const b = board.map((r) => [...r]);
  for (let c = 0; c < n; c++) {
    if (conflicts(queens, row, c)) {
      b[row][c] = CONFLICT;
    }
  }
  return b;
}

export function* run(input) {
  const n = parseIntegerInRange(input.n, { min: 4, max: 6, label: 'n' });

  // Collect the full trace via iterative backtracking so we can yield steps
  const trace = [];
  const queens = [];
  let nodesExplored = 0;

  function solve() {
    const row = queens.length;
    if (row === n) {
      trace.push({ type: 'solution', queens: [...queens] });
      return true;
    }
    for (let col = 0; col < n; col++) {
      nodesExplored++;
      if (conflicts(queens, row, col)) {
        trace.push({ type: 'conflict', row, col, queens: [...queens], nodesExplored });
      } else {
        queens.push([row, col]);
        trace.push({ type: 'place', row, col, queens: [...queens], nodesExplored });
        if (solve()) return true;
        queens.pop();
        trace.push({ type: 'backtrack', row, col, queens: [...queens], nodesExplored });
      }
    }
    return false;
  }

  // Initial empty board
  yield {
    state: boardSnapshot(`${n}-Queens: place ${n} non-attacking queens`, clearBoard(n), n),
    highlight: {},
    explanation: `The goal: place ${n} queens on a ${n}×${n} board so no two share a row, column, or diagonal. Brute force would try all ${n ** n} ways to put one piece in each row — ${n ** n} candidates. Backtracking prunes entire subtrees of choices the moment a conflict appears.`,
  };

  solve();

  let stepQueens = [];
  for (const event of trace) {
    if (event.type === 'conflict') {
      const board = placeQueens(clearBoard(n), event.queens);
      board[event.row][event.col] = CONFLICT;
      const conflictWith = event.queens.find(([, qc]) => qc === event.col)
        || event.queens.find(([qr, qc]) => Math.abs(qr - event.row) === Math.abs(qc - event.col));
      const reason = conflictWith
        ? (conflictWith[1] === event.col
          ? `column ${event.col + 1} is taken by the queen in row ${conflictWith[0] + 1}`
          : `diagonal conflict with queen at (${conflictWith[0] + 1},${conflictWith[1] + 1})`)
        : 'conflict detected';
      yield {
        state: boardSnapshot(`Row ${event.row + 1}, column ${event.col + 1}: conflict`, board, n),
        highlight: {
          active: [`r${event.row}:c${event.col}`],
          removed: event.queens.map(([r, c]) => `r${r}:c${c}`),
        },
        explanation: `Try column ${event.col + 1} in row ${event.row + 1} — ${reason}. Skip this column. (${event.nodesExplored} nodes explored so far.)`,
      };
    } else if (event.type === 'place') {
      stepQueens = [...event.queens];
      const board = placeQueens(clearBoard(n), event.queens);
      const conflictBoard = markConflicts(board, event.queens, event.row + 1 < n ? event.row + 1 : event.row, n);
      yield {
        state: boardSnapshot(`Place queen at row ${event.row + 1}, column ${event.col + 1}`, event.row + 1 < n ? conflictBoard : board, n),
        highlight: {
          active: [`r${event.row}:c${event.col}`],
          found: event.queens.slice(0, -1).map(([r, c]) => `r${r}:c${c}`),
        },
        explanation: `Column ${event.col + 1} in row ${event.row + 1} has no conflicts with placed queens. Place a queen here and move to the next row. ${event.queens.length === n ? `All ${n} queens placed — solution found!` : `(${event.nodesExplored} nodes explored.)`}`,
      };
    } else if (event.type === 'backtrack') {
      const board = placeQueens(clearBoard(n), event.queens);
      // Mark the row we're backtracking from as pruned
      for (let c = 0; c < n; c++) {
        if (board[event.row][c] === EMPTY) board[event.row][c] = PRUNED;
      }
      yield {
        state: boardSnapshot(`Backtrack: undo queen at row ${event.row + 1}, column ${event.col + 1}`, board, n),
        highlight: {
          active: event.queens.map(([r, c]) => `r${r}:c${c}`),
          removed: [`r${event.row}:c${event.col}`],
        },
        explanation: `No valid column remains in row ${event.row + 2 <= n ? event.row + 2 : event.row + 1}. Remove the queen from (${event.row + 1},${event.col + 1}) and try the next column in row ${event.row + 1}. This is the backtrack step — undoing a choice that led to a dead end. (${event.nodesExplored} nodes explored.)`,
      };
    } else if (event.type === 'solution') {
      const board = placeQueens(clearBoard(n), event.queens);
      const positions = event.queens.map(([r, c]) => c + 1).join(', ');
      yield {
        state: boardSnapshot(`Solution found: columns [${positions}]`, board, n),
        highlight: {
          found: event.queens.map(([r, c]) => `r${r}:c${c}`),
        },
        explanation: `Solution: queens in columns [${positions}] (one per row). No two share a column or diagonal. The algorithm explored ${nodesExplored} nodes instead of ${n ** n} brute-force candidates — pruning eliminated ${(100 * (1 - nodesExplored / n ** n)).toFixed(1)}% of the search space.`,
      };
    }
  }
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The board is an n×n matrix. ♛ marks a placed queen. ✕ marks a cell the algorithm just tested and rejected because of a column or diagonal conflict. ? marks a cell being tried. — marks cells in a row where every option has been exhausted, triggering a backtrack.',
        'Active highlights show the cell currently being tested. Found highlights mark queens that are safely placed so far. Removed highlights mark queens being taken off the board during a backtrack.',
        'Watch the algorithm work row by row, left to right within each row. When it places a queen and moves down, the search tree is going deeper. When it removes a queen and tries the next column, it is backtracking. The node count in each step shows how much work pruning saved compared to brute force.',
        {type: 'callout', text: 'Backtracking is depth-first search over partial assignments where every failed constraint deletes an entire subtree.'},
      
        {type: 'image', src: './assets/gifs/backtracking-n-queens.gif', alt: 'Animated walkthrough of the backtracking n queens visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many real problems ask: find an assignment of choices that satisfies a set of constraints, or prove no such assignment exists. Sudoku, crossword construction, register allocation, circuit board routing, scheduling, and graph coloring all fit this shape. The common structure is a sequence of decisions where each decision constrains future options, and a wrong early choice can make a later step impossible.',
        'Backtracking is the general-purpose engine for these problems. It builds a solution incrementally — one decision at a time — and abandons a partial solution the moment it violates a constraint, instead of finishing it and checking afterward. N-Queens is the simplest clean example: place n queens on an n×n chessboard so no two attack each other.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Generate every possible placement and check each one. With n queens and n² cells, the brute-force count is C(n², n) — for 8-Queens, that is 4,426,165,080 candidate boards. Even the smarter brute force of one queen per row still produces n^n candidates: 8^8 = 16,777,216 boards to check.',
        'This works for tiny n. For n = 4 the one-per-row brute force checks 256 candidates, which a modern machine handles in microseconds. The approach is correct — it never misses a solution — and simple to implement: nested loops, one per row.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Brute force does not use what it already knows. Suppose the first queen is in column 1 and the second queen is also in column 1. Every board that starts this way is guaranteed invalid, but brute force still fills in the remaining 6 rows before discovering the column conflict. It checks all n^(n-2) completions of a prefix that was already dead.',
        'The cost is exponential in n, and most of that work is wasted on provably impossible configurations. 8-Queens has only 92 solutions out of 16,777,216 brute-force candidates. The search space is vast, but the solution space is tiny, and the constraint violations that eliminate candidates are detectable early.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1f/Eight-queens-animation.gif', alt: 'Animated solution of the eight queens problem showing queens being placed one row at a time with backtracking', caption: 'The eight-queens backtracking search in action: each queen is placed row by row, and dead-end branches are pruned immediately. (Source: Wikimedia Commons)'},
        'Check constraints after each decision, not after all decisions. If placing a queen in row 2, column 1 conflicts with the queen already in row 1, column 1, then every possible completion of that prefix is invalid. Do not explore any of them. Prune the subtree and try the next column.',
        'This turns brute-force enumeration into a tree search with pruning. Each node in the tree is a partial assignment (queens placed in rows 0 through k). Each branch is a column choice for the next row. Pruning cuts entire branches — not just leaves — so one early conflict can eliminate n^(n-k-1) candidates at once.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Place one queen per row, starting from row 0. For each row, try columns left to right. For each candidate column, check three constraints: (1) no queen already occupies this column, (2) no queen sits on the same left diagonal (row - col is the same), (3) no queen sits on the same right diagonal (row + col is the same). If any constraint fails, skip this column.',
        'If a valid column is found, place the queen and recurse to the next row. If no valid column exists in the current row, return failure to the caller — this triggers the backtrack. The caller removes its last queen and tries the next column in its own row.',
        'The recursion bottoms out when all n queens are placed. At that point, the constraint checks at every level guarantee the configuration is valid. No final verification is needed.',
        'Implementation requires only an array of length n, where queens[i] stores the column of the queen in row i. Constraint checking uses three sets or boolean arrays: one for occupied columns, one for occupied left diagonals (indexed by row - col + n - 1), one for occupied right diagonals (indexed by row + col). Each set lookup and update is O(1), so the per-node cost is constant.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from exhaustive enumeration of the pruned tree. Every valid solution corresponds to a path from the root (empty board) to a leaf (n queens placed) in the decision tree. Pruning removes only nodes whose subtrees provably contain no valid solution — a queen conflict in a partial assignment cannot be resolved by adding more queens. So no valid solution is missed.',
        'Backtracking also finds all solutions if allowed to continue past the first. After recording a solution, it backtracks from the last row and resumes trying columns, exactly as if it had hit a dead end. The tree traversal is complete.',
        'The one-queen-per-row structure eliminates row conflicts by construction. The column and diagonal checks handle the remaining constraints. Together, they enforce the full non-attacking condition at every step.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Worst-case time is O(n!) — the first row has n choices, the second has at most n-1 (column constraint alone), the third at most n-2, and so on. In practice, diagonal constraints prune further. For 8-Queens, backtracking explores about 114 nodes to find the first solution, compared to 40,320 permutations (8!) or 16,777,216 brute-force candidates (8^8).',
        'Space is O(n) for the recursion stack and the three constraint sets. No board copy is needed — the algorithm modifies and restores a single state.',
        'The branching factor shrinks rapidly at deeper levels because more columns and diagonals are blocked. Early rows prune the most: a single queen eliminates one column and two diagonals, which cuts roughly 3 out of n options for the next row. This is why the actual node count is far below n!.',
        'For reference: 4-Queens explores about 8 placement attempts. 8-Queens explores about 114. 12-Queens explores about 856. The growth is far gentler than the factorial bound suggests, but it is still exponential — there is no polynomial-time algorithm known for generating all N-Queens solutions.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Sudoku solvers use backtracking with constraint propagation: place a digit, eliminate it from the row, column, and box, and recurse. Graph coloring assigns colors to vertices and backtracks when a neighbor shares a color. Subset sum and knapsack variants explore include/exclude choices with pruning on running totals.',
        'Compiler register allocation can be modeled as graph coloring, which uses backtracking. SAT solvers (DPLL, CDCL) are backtracking over boolean variable assignments with learned clause pruning. Regular expression engines with backreferences use backtracking to try different match interpretations.',
        'Crossword construction, Sudoku generation, puzzle design, and constraint satisfaction problems in AI planning all use backtracking as their search backbone. The pattern is always the same: make a choice, check constraints, recurse or undo.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Worst-case time is still exponential. Backtracking with no effective pruning degenerates to brute force. Problems where constraints are sparse or only detectable late in the search — so most branches survive until deep levels — get little benefit from early pruning.',
        'For optimization problems (find the best solution, not just any valid one), backtracking alone explores too many branches. Branch-and-bound adds a cost bound to prune suboptimal branches. Dynamic programming avoids revisiting subproblems entirely when the problem has optimal substructure and overlapping subproblems.',
        'Backtracking finds one solution at a time. If you need to count solutions or sample uniformly, the approach needs modification. Counting all N-Queens solutions for large n is an open research problem — no efficient formula is known.',
        'For problems with continuous domains or soft constraints, backtracking over discrete choices does not apply directly. Linear programming, gradient descent, and other continuous optimization methods handle those.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        '4-Queens, step by step. The board has rows 1–4 and columns 1–4. We place one queen per row and track column, left-diagonal, and right-diagonal constraints.',
        'Row 1: try column 1. No conflicts — place queen at (1,1). Queens: [1].',
        'Row 2: try column 1 — column conflict with (1,1). Try column 2 — diagonal conflict with (1,1) (both on left diagonal 0). Try column 3 — no conflict. Place at (2,3). Queens: [1,3].',
        'Row 3: try column 1 — column conflict with (1,1). Try column 2 — diagonal conflict with (2,3). Try column 3 — column conflict with (2,3). Try column 4 — diagonal conflict with (2,3). No valid column. Backtrack to row 2.',
        'Row 2 (resumed): remove queen from (2,3). Try column 4 — no conflict. Place at (2,4). Queens: [1,4].',
        'Row 3: try column 1 — column conflict with (1,1). Try column 2 — no conflict. Place at (3,2). Queens: [1,4,2].',
        'Row 4: try column 1 — column conflict with (1,1). Try column 2 — column conflict with (3,2). Try column 3 — diagonal conflict with (3,2). Try column 4 — column conflict with (2,4). No valid column. Backtrack to row 3.',
        'Row 3 (resumed): remove queen from (3,2). Try column 3 — left-diagonal conflict with (1,1) (both sit on the same descending diagonal). Try column 4 — column conflict with (2,4). No valid column. Backtrack to row 2.',
        'Row 2 (resumed): no more columns. Backtrack to row 1.',
        'Row 1 (resumed): remove queen from (1,1). Try column 2. No conflicts — place at (1,2). Queens: [2].',
        'Row 2: try column 1 — diagonal conflict with (1,2)... skipping ahead: try column 4 — no conflict. Place at (2,4). Queens: [2,4].',
        'Row 3: try column 1 — no conflict. Place at (3,1). Queens: [2,4,1].',
        'Row 4: try column 1 — column conflict. Try column 2 — column conflict. Try column 3 — no conflict. Place at (4,3). Queens: [2,4,1,3].',
        'Solution found: queens at columns [2,4,1,3]. No two queens share a column or diagonal. The search explored far fewer than 4^4 = 256 candidates because constraint checks pruned dead branches early.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Niklaus Wirth, "Algorithms + Data Structures = Programs" (1976) — the N-Queens example that introduced backtracking to a generation of programmers. Knuth, "The Art of Computer Programming, Volume 4A" — thorough treatment of backtracking, Algorithm X, and Dancing Links. Bitner and Reingold, "Backtrack Programming Techniques," Communications of the ACM (1975) — the foundational survey of backtracking strategies and pruning.',
        'Prerequisites: Recursion for the call-stack mechanics, Graph DFS for depth-first tree traversal. Extensions: Dancing Links and Exact Cover for Knuth\'s optimized backtracking structure, Constraint Satisfaction for the general AI framework. Alternatives: Dynamic Programming when subproblems overlap, Branch and Bound when optimizing with cost bounds. Contrast: Minimax for adversarial search trees using the same recursive structure.',
      ],
    },
  ],
};
