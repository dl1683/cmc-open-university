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
        'The board is an n-by-n grid. Each cell shows a symbol: a crown marks a placed queen, an X marks a cell just tested and rejected because it conflicts with an existing queen, a question mark marks the cell currently being tried, and a dash marks every cell in a row where all options failed, meaning the algorithm must backtrack.',
        'Color highlights encode state. Active (bright) highlights show the cell under test right now. Found highlights mark queens safely placed so far. Removed highlights mark a queen being lifted off the board during a backtrack step.',
        'Follow the row-by-row rhythm. The algorithm starts at row 0 and tries columns left to right. Placing a queen and moving to the next row means the search tree is going deeper. Removing a queen and trying the next column in the same row means the algorithm is backtracking. The node counter in each step tells you how many placements have been attempted so far, which makes the pruning savings visible.',
        {type: 'callout', text: 'Backtracking is depth-first search over partial assignments where every failed constraint deletes an entire subtree.'},
        {type: 'image', src: './assets/gifs/backtracking-n-queens.gif', alt: 'Animated walkthrough of the backtracking n queens visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A large class of real problems share the same shape: assign values to a sequence of variables such that a set of constraints is satisfied, or prove no valid assignment exists. Scheduling shifts so no employee works two overlapping slots, coloring a map so no adjacent regions share a color, filling a Sudoku grid, routing wires on a circuit board without crossings — all of these are constraint satisfaction problems. The defining feature is that each decision you make restricts what future decisions are legal, and a bad early choice can make a later step impossible.',
        'Backtracking is the general-purpose search strategy for these problems. It builds a solution one decision at a time and checks constraints after each decision. The moment a partial solution violates a constraint, the algorithm abandons it — it does not waste time completing something already known to be invalid. N-Queens is the cleanest teaching example of this idea: place n non-attacking queens on an n-by-n chessboard. A queen attacks along its row, column, and both diagonals, so no two queens can share any of these lines.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Generate every possible way to put n queens on n-squared cells and check each arrangement. For 8-Queens, that means C(64, 8) = 4,426,165,080 candidate boards. A slightly smarter version restricts to one queen per row, giving n-to-the-n candidates: 8 to the 8 = 16,777,216 boards.',
        'For small n this works fine. 4-Queens with one queen per row produces 4 to the 4 = 256 candidates, which any machine checks in microseconds. The approach is dead simple — just n nested loops — and it never misses a solution because it tries everything. But it treats every placement as independent, ignoring the information that earlier placements provide.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Brute force ignores what it already knows. Suppose the queen in row 1 sits in column 3, and you try putting the queen in row 2 also in column 3. That is an immediate column conflict — no valid solution can start with two queens in the same column. But brute force does not notice. It fills in the remaining 6 rows, generating all 8-to-the-6 = 262,144 completions of a prefix that was already dead, and rejects each one individually.',
        'The numbers get worse fast. 8-Queens has exactly 92 valid solutions out of 16,777,216 brute-force candidates. That means 99.9995% of the work is wasted. The search space grows exponentially in n, but the constraint violations that kill most candidates are detectable as early as the second row. The brute-force approach pays the full exponential cost because it refuses to check constraints until the end.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1f/Eight-queens-animation.gif', alt: 'Animated solution of the eight queens problem showing queens being placed one row at a time with backtracking', caption: 'The eight-queens backtracking search in action: each queen is placed row by row, and dead-end branches are pruned immediately. (Source: Wikimedia Commons)'},
        'Check constraints after each decision, not after all of them. If placing a queen in row 2 column 3 conflicts with the queen already in row 1 column 3, then every possible way to fill rows 3 through n is guaranteed invalid. There are n-to-the-(n-2) such completions. Do not explore a single one of them. Skip this column and try the next.',
        'This converts brute-force enumeration into a tree search with pruning. Think of the search as a tree: each level corresponds to a row, each branch is a column choice, and each path from root to leaf is a complete assignment. A constraint violation at level k means the entire subtree below that node — all n-to-the-(n-k-1) leaves — is dead. Cutting one node near the root can eliminate millions of candidates in a single step. This is called pruning, and it is the mechanism that makes backtracking fast in practice.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The algorithm places one queen per row, starting at row 0. For the current row, it tries columns from left to right. For each candidate column c in the current row r, it checks three constraints. First, no previously placed queen occupies column c. Second, no previously placed queen sits on the same descending diagonal — two cells share a descending diagonal when (row minus column) is the same for both. Third, no previously placed queen sits on the same ascending diagonal — two cells share an ascending diagonal when (row plus column) is the same for both. If any constraint fails, the algorithm skips column c and tries c+1.',
        'When a valid column is found, the algorithm places the queen and calls itself recursively for the next row. If no valid column exists in the current row — every column from 0 to n-1 has been tried and rejected — the function returns failure. This return triggers the backtrack: the calling level removes its queen from the board and tries the next column in its own row.',
        'The recursion terminates when all n rows have a queen. At that point, the constraint checks performed at every level guarantee the configuration is valid. No final verification pass is needed — correctness is maintained as an invariant throughout the search.',
        'The data structure is minimal. An array of length n stores the column of the queen in each row: queens[i] = c means row i has a queen in column c. Three boolean arrays (or sets) track which columns, which descending diagonals (indexed by row - col + n - 1 to keep indices non-negative), and which ascending diagonals (indexed by row + col) are currently occupied. Each constraint check is a single array lookup — O(1) time — so the cost per node in the search tree is constant.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on two properties: completeness and soundness. Completeness means no valid solution is missed. The algorithm tries every column in every row before backtracking, so it explores every path through the decision tree that has not been pruned. A path is pruned only when a constraint violation is detected, and a constraint violation in a partial assignment cannot be fixed by adding more queens — a conflicting pair stays conflicting no matter what goes in later rows. So every pruned subtree is genuinely dead, and every valid solution lives in the unpruned portion of the tree.',
        'Soundness means every reported solution is actually valid. This holds because the constraint check runs before every placement. A queen is placed only if it does not conflict with any queen already on the board. Since the check is applied at every level, the invariant "all placed queens are mutually non-attacking" holds at every step of the recursion.',
        'To find all solutions rather than just one, the algorithm continues searching after recording a solution. It backtracks from the last row exactly as if it had hit a dead end, resumes trying columns, and eventually exhausts the entire tree. The traversal is systematic and complete — it visits every non-pruned node exactly once.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The worst-case time is O(n!). In the first row, the algorithm has n column choices. In the second row, the column constraint alone eliminates one column, leaving at most n-1 choices. The third row has at most n-2, and so on, giving an upper bound of n * (n-1) * (n-2) * ... * 1 = n! nodes. In practice, diagonal constraints prune further, so the actual node count is well below n!.',
        'Concrete numbers make the savings tangible. For 8-Queens, brute force with one queen per row checks 16,777,216 candidates. The n! permutation bound is 40,320. Backtracking with diagonal pruning explores roughly 114 nodes to find the first solution. That is a 99.9993% reduction from brute force and a 99.7% reduction from the permutation bound.',
        'Space is O(n). The recursion stack is n levels deep, and the three constraint arrays each have O(n) entries. The algorithm modifies a single shared state — placing and removing queens in place — so no board copies are made.',
        'The branching factor shrinks at deeper levels because more columns and diagonals are blocked. Each placed queen removes one column and two diagonals from the available set, cutting roughly 3 options for the next row. By the middle rows, the average branching factor can drop below 2. This rapid narrowing is why the empirical node counts (roughly 8 for 4-Queens, 114 for 8-Queens, 856 for 12-Queens) grow much slower than n!. The growth is still exponential — no polynomial algorithm is known for generating all N-Queens solutions — but the constant factors are small enough that n up to about 25 is tractable with simple backtracking.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Sudoku solvers are backtracking with richer constraint propagation. Place a digit, eliminate it from the row, column, and 3-by-3 box, then recurse to the next empty cell. If no digit is legal for some cell, backtrack. The structure is identical to N-Queens — sequential decisions, immediate constraint checking, undo on failure — with more constraints per step.',
        'SAT solvers (the DPLL and CDCL algorithms that power modern satisfiability engines) are backtracking over boolean variable assignments. DPLL assigns a variable true or false, propagates unit clauses, and backtracks on conflict. CDCL adds conflict-driven clause learning, which records the reason for each backtrack and prunes future branches that would hit the same conflict. This is backtracking with memory.',
        'Compiler register allocation is often modeled as graph coloring: nodes are variables, edges connect variables that are live at the same time, and colors are physical registers. The coloring algorithm tries assigning registers and backtracks when a neighbor has the same register. Regular expression engines with backreferences also use backtracking to try different match interpretations when a simple left-to-right scan is ambiguous.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'When constraints are sparse or only detectable late in the search, pruning cuts little and backtracking degenerates toward brute force. A problem where every partial assignment looks promising until the very last variable offers almost no pruning opportunities. The worst-case time remains exponential, and for such problems, the constant factor is close to the theoretical maximum.',
        'Backtracking finds valid solutions but cannot optimize. If the goal is "find the cheapest valid assignment" rather than "find any valid assignment," plain backtracking explores too many branches. Branch-and-bound extends backtracking by tracking a cost bound: if the partial assignment already costs more than the best known solution, prune it. Dynamic programming avoids the search tree entirely when the problem has overlapping subproblems and optimal substructure.',
        'Counting solutions is harder than finding one. Backtracking can enumerate all solutions by continuing the search after each hit, but the total count grows exponentially and there is no shortcut. Counting all N-Queens solutions for large n remains an open problem — no closed-form formula or polynomial-time algorithm is known. The record as of 2024 is n = 27, requiring specialized distributed computation.',
        'Backtracking operates on discrete choices. Problems with continuous variables — minimize a function over real-valued parameters, or satisfy soft constraints with penalties — need entirely different tools: gradient descent, linear programming, or convex optimization. Backtracking has no notion of "close to valid" and cannot interpolate between choices.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        '4-Queens, traced step by step. The board has rows 0 through 3 and columns 0 through 3. We maintain three constraint sets: usedCols, usedDiag1 (row - col + 3), and usedDiag2 (row + col). All start empty.',
        'Row 0, try col 0. No conflicts. Place queen at (0,0). usedCols = {0}, usedDiag1 = {3}, usedDiag2 = {0}. Recurse to row 1.',
        'Row 1, try col 0. Column 0 is in usedCols — skip. Try col 1. Diag1 index = 1 - 1 + 3 = 3, which is in usedDiag1 — skip (same descending diagonal as (0,0)). Try col 2. Column 2 is free, diag1 = 1 - 2 + 3 = 2 is free, diag2 = 1 + 2 = 3 is free. Place at (1,2). Recurse to row 2.',
        'Row 2, try col 0. Column 0 in usedCols — skip. Try col 1. Diag2 = 2 + 1 = 3, which is in usedDiag2 (same ascending diagonal as (1,2)) — skip. Try col 2. Column 2 in usedCols — skip. Try col 3. Diag1 = 2 - 3 + 3 = 2, which is in usedDiag1 (same descending diagonal as (1,2)) — skip. All columns exhausted. Return failure. Backtrack to row 1.',
        'Row 1, resume at col 3. Column 3 is free, diag1 = 1 - 3 + 3 = 1 is free, diag2 = 1 + 3 = 4 is free. Place at (1,3). Recurse to row 2.',
        'Row 2, try col 0. Column 0 in usedCols — skip. Try col 1. Column 1 free, diag1 = 2 - 1 + 3 = 4 free, diag2 = 2 + 1 = 3 free. Place at (2,1). Recurse to row 3.',
        'Row 3, try col 0. Column 0 in usedCols — skip. Try col 1. Column 1 in usedCols — skip. Try col 2. Diag1 = 3 - 2 + 3 = 4, which is in usedDiag1 (same descending diagonal as (2,1)) — skip. Try col 3. Column 3 in usedCols — skip. All exhausted. Backtrack to row 2.',
        'Row 2, resume at col 2. Diag1 = 2 - 2 + 3 = 3, in usedDiag1 (same descending diagonal as (0,0)) — skip. Try col 3. Column 3 in usedCols — skip. All exhausted. Backtrack to row 1.',
        'Row 1, no more columns. Backtrack to row 0.',
        'Row 0, resume at col 1. Place at (0,1). usedCols = {1}, usedDiag1 = {4}, usedDiag2 = {1}. Recurse to row 1.',
        'Row 1, try col 0. Diag2 = 1 + 0 = 1, in usedDiag2 — skip. Try col 3. All checks pass. Place at (1,3). Recurse to row 2. Try col 0. All checks pass. Place at (2,0). Recurse to row 3. Try col 2. All checks pass. Place at (3,2).',
        'All 4 queens placed: columns [1, 3, 0, 2]. Verify: no shared columns (1, 3, 0, 2 are distinct), no shared descending diagonals (4, 5, 2, 4 — wait, rows 0 and 3 both give diag1 index 4). That means (0,1) and (3,2) share a descending diagonal? Let us recheck: row 0 col 1, diag1 = 0 - 1 + 3 = 2. Row 3 col 2, diag1 = 3 - 2 + 3 = 4. No conflict — the indices are 2 and 4. All diag1 values are {2, 3, 0, 4} — distinct. All diag2 values are {1, 4, 2, 5} — distinct. Valid solution. The search explored roughly 8 placement attempts instead of 256 brute-force candidates.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Niklaus Wirth, "Algorithms + Data Structures = Programs" (1976), chapter 3 — the N-Queens example that introduced backtracking to a generation of programmers and established the recursive formulation used here. Donald Knuth, "The Art of Computer Programming, Volume 4A: Combinatorial Algorithms" (2011) — exhaustive treatment of backtracking, Algorithm X, and Dancing Links for exact cover problems. Bitner and Reingold, "Backtrack Programming Techniques," Communications of the ACM 18(11), 1975 — the foundational survey of pruning strategies, variable ordering, and forward checking.',
        'To go deeper: start with Recursion if the call-stack mechanics feel unfamiliar, then study Graph DFS (depth-first search) since backtracking is DFS on an implicit decision tree. For optimized backtracking, look at Dancing Links and Exact Cover, which is Knuth\'s technique for solving the exact cover problem that N-Queens reduces to. For the general framework that formalizes constraint checking and propagation, study Constraint Satisfaction Problems (CSPs). When backtracking is too slow because subproblems overlap, Dynamic Programming is the alternative. When the goal is optimization rather than feasibility, Branch and Bound adds cost-based pruning on top of the backtracking skeleton.',
      ],
    },
  ],
};
