// Matrix chain multiplication: find the parenthesization of a matrix product
// that minimizes total scalar multiplications. Fill a DP table diagonally,
// where each cell m[i][j] stores the cheapest way to multiply matrices i..j.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'matrix-chain-multiplication',
  title: 'Matrix Chain Multiplication',
  category: 'Algorithms',
  summary: 'Find the cheapest way to parenthesize a chain of matrix multiplications — O(n³) DP over split points.',
  controls: [
    {
      id: 'dims',
      label: 'Dimensions (e.g. 10 30 5 60)',
      type: 'text',
      defaultValue: '10 30 5 60 10',
    },
  ],
  run,
};

// ---------------------------------------------------------------- parsing

function parseDims(text) {
  const raw = String(text ?? '').trim().split(/[\s,]+/).filter(Boolean);
  if (raw.length < 3) throw new InputError('Enter at least 3 dimensions (2 matrices). Example: 10 30 5');
  if (raw.length > 8) throw new InputError('Enter at most 8 dimensions (7 matrices) so every step stays readable.');
  const dims = raw.map((tok, i) => {
    const v = Number(tok);
    if (!Number.isInteger(v) || v < 1) throw new InputError(`Dimension ${i + 1}: must be a positive integer.`);
    return v;
  });
  return dims;
}

// ---------------------------------------------------------------- run

export function* run(input) {
  const p = parseDims(input.dims);
  const n = p.length - 1; // number of matrices

  // Matrix labels: A1, A2, ...
  const matLabel = (i) => `A${i + 1}`;
  const matDim = (i) => `${p[i]}×${p[i + 1]}`;

  // DP tables: m[i][j] = min cost, s[i][j] = split point
  const UNFILLED = -1;
  const m = Array.from({ length: n }, () => new Array(n).fill(UNFILLED));
  const s = Array.from({ length: n }, () => new Array(n).fill(-1));

  // Row/column headers: matrix indices 1..n
  const headers = Array.from({ length: n }, (_, i) => ({
    id: `h${i}`,
    label: `${matLabel(i)} (${matDim(i)})`,
  }));
  const rowHeaders = headers.map((h, i) => ({ id: `r${i}`, label: h.label }));
  const colHeaders = headers.map((h, i) => ({ id: `c${i}`, label: h.label }));

  const cell = (i, j) => `r${i}:c${j}`;
  const snapshot = (title) => matrixState({
    title,
    rows: rowHeaders,
    columns: colHeaders,
    values: m.map((row) => [...row]),
    format: (v) => (v === UNFILLED ? '·' : String(v)),
  });

  // Introduction
  const chainDesc = Array.from({ length: n }, (_, i) => `${matLabel(i)}(${matDim(i)})`).join(' × ');
  yield {
    state: snapshot(`Matrix chain: ${chainDesc}`),
    highlight: {},
    explanation: `We have ${n} matrices to multiply: ${chainDesc}. Matrix multiplication is associative — the result is the same regardless of parenthesization — but the number of scalar multiplications depends heavily on the order. Multiplying an a×b matrix by a b×c matrix costs a·b·c scalar multiplications. We need to find the parenthesization that minimizes total cost. The DP table m[i][j] will store the minimum cost to multiply matrices i through j.`,
  };

  // Base case: diagonal (single matrices cost 0)
  for (let i = 0; i < n; i++) m[i][i] = 0;
  yield {
    state: snapshot('Base case: single matrices cost 0'),
    highlight: { active: Array.from({ length: n }, (_, i) => cell(i, i)) },
    explanation: `The diagonal cells m[i][i] are all 0 — multiplying a single matrix requires no work. These are the base cases that every larger subproblem will build on.`,
  };

  // Fill diagonals of increasing chain length
  for (let len = 2; len <= n; len++) {
    const filledCells = [];
    for (let i = 0; i <= n - len; i++) {
      const j = i + len - 1;
      m[i][j] = Infinity;

      let bestK = i;
      for (let k = i; k < j; k++) {
        const cost = m[i][k] + m[k + 1][j] + p[i] * p[k + 1] * p[j + 1];
        if (cost < m[i][j]) {
          m[i][j] = cost;
          bestK = k;
        }
      }
      s[i][j] = bestK;
      filledCells.push(cell(i, j));
    }

    // Show the filled diagonal
    const depCells = [];
    // Highlight dependencies for first cell in this diagonal
    const fi = 0;
    const fj = fi + len - 1;
    if (fj < n) {
      for (let k = fi; k < fj; k++) {
        depCells.push(cell(fi, k));
        depCells.push(cell(k + 1, fj));
      }
    }

    const exI = 0;
    const exJ = exI + len - 1;
    if (exJ < n) {
      const splitDetails = [];
      for (let k = exI; k < exJ; k++) {
        const cost = m[exI][k] + m[k + 1][exJ] + p[exI] * p[k + 1] * p[exJ + 1];
        const mark = k === s[exI][exJ] ? ' ← best' : '';
        splitDetails.push(`k=${k + 1}: m[${exI + 1},${k + 1}] + m[${k + 2},${exJ + 1}] + ${p[exI]}·${p[k + 1]}·${p[exJ + 1]} = ${m[exI][k]} + ${m[k + 1][exJ]} + ${p[exI] * p[k + 1] * p[exJ + 1]} = ${cost}${mark}`);
      }
      yield {
        state: snapshot(`Chains of length ${len}`),
        highlight: { active: filledCells, visited: [...new Set(depCells)] },
        explanation: `Fill all chains of length ${len}. For m[${exI + 1},${exJ + 1}] (${Array.from({ length: len }, (_, x) => matLabel(exI + x)).join('·')}), try every split point: ${splitDetails.join('; ')}. Best: ${m[exI][exJ]} with split at k=${s[exI][exJ] + 1}.`,
        invariant: `m[i][j] = min over k of (m[i][k] + m[k+1][j] + p[i-1]·p[k]·p[j]).`,
      };
    }
  }

  // Build optimal parenthesization string
  function buildParens(i, j) {
    if (i === j) return matLabel(i);
    const k = s[i][j];
    return `(${buildParens(i, k)} × ${buildParens(k + 1, j)})`;
  }

  const optParens = buildParens(0, n - 1);

  yield {
    state: snapshot(`Minimum cost: ${m[0][n - 1]}`),
    highlight: { found: [cell(0, n - 1)] },
    explanation: `The answer is in the top-right corner: m[1,${n}] = ${m[0][n - 1]} scalar multiplications. The split table s[i][j] recovers the optimal parenthesization: ${optParens}. Every cell used the recurrence m[i][j] = min over k of (m[i][k] + m[k+1][j] + p_{i-1}·p_k·p_j), filled diagonally so that every dependency was already computed.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The grid is an n-by-n DP table. Cell m[i][j] holds the minimum scalar multiplications needed to compute the product of matrices i through j. The main diagonal is zero because multiplying a single matrix costs nothing.',
        'Each diagonal pass fills cells for chains of a given length. Active cells are being computed now. Visited cells are the subproblems the current cell depends on -- for m[i][j], those are every pair m[i][k] and m[k+1][j] for each candidate split k. When a diagonal finishes, every chain of that length has its optimal cost locked in.',
        'The found marker on the top-right cell is the final answer: the cheapest way to multiply the entire chain. The split table s[i][j] (shown in the step explanations) records which k achieved that minimum, so you can reconstruct the optimal parenthesization by recursing on s.',
        {type: 'callout', text: 'Matrix-chain DP works because every full parenthesization is one split plus two smaller optimal chains.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Multiplying an a-by-b matrix by a b-by-c matrix costs a*b*c scalar multiplications and produces an a-by-c result. Matrix multiplication is associative -- the final answer is the same regardless of how you group the operations -- but the total work is not. Parenthesizing a chain of n matrices differently changes which intermediate dimensions appear, and that changes the operation count by orders of magnitude.',
        'This is the textbook entry point to dynamic programming (CLRS Chapter 15). The problem is small enough to state in one sentence -- find the cheapest grouping -- yet it exposes optimal substructure, overlapping subproblems, and traceback reconstruction in their purest form.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Try all possible parenthesizations and pick the cheapest. Every parenthesization corresponds to a full binary tree whose leaves are the matrices. For n matrices, the number of such trees is the Catalan number C(n-1).',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Convex_Polygon_Triangulations_Annotated.svg', alt: 'Annotated convex polygon triangulations showing several ways to split a polygon', caption: 'Parenthesizing a matrix chain is structurally the same counting problem as triangulating a convex polygon: many shapes, one final object. Source: Wikimedia Commons, Jespa, CC BY-SA 4.0.'},
        'C(2) = 2, C(3) = 5, C(4) = 14. Manageable for small chains. For three matrices you just compare two groupings and you are done.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Catalan numbers grow as roughly 4^n / (n^(3/2) * sqrt(pi)). C(9) = 4,862. C(19) = 1,767,263,190. By 20 matrices the brute-force search is hopeless.',
        'The explosion hides a redundancy: the cost of multiplying matrices i through j appears inside many different outer groupings. A naive recursion recomputes the same subchain cost every time a different outer split references it. The total number of distinct subchains is only n*(n-1)/2, but the recursion visits them exponentially many times.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Any parenthesization of matrices i through j must split the chain at some position k: multiply i..k optimally, multiply (k+1)..j optimally, then combine the two results. If either half were not optimal, substituting a cheaper grouping would reduce the total -- so the global optimum contains optimal solutions to both subchains. That is optimal substructure.',
        'Because the subchains overlap across different outer problems, computing each m[i][j] once and caching it collapses the exponential recursion into a polynomial table fill. The entire trick is: store, do not recompute.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Let the n matrices have dimensions described by an array p[0..n], where matrix i is p[i-1] by p[i]. Define m[i][j] = minimum scalar multiplications to compute the product of matrices i through j.',
        'Base case: m[i][i] = 0. A single matrix needs no work.',
        'Recurrence: for i < j, m[i][j] = min over k from i to j-1 of (m[i][k] + m[k+1][j] + p[i-1] * p[k] * p[j]). The first term is the optimal cost for the left subchain. The second is the optimal cost for the right subchain. The third is the cost of multiplying the two resulting matrices -- the left result has dimensions p[i-1]-by-p[k], the right result has dimensions p[k]-by-p[j].',
        'Fill the table by chain length. Length 1 is the base diagonal. Length 2 fills one diagonal above. Length 3 the next, and so on up to length n. At each step, every dependency is already solved. A second table s[i][j] records the k that achieved the minimum, so the optimal parenthesization can be reconstructed by recursing on s.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on two properties. First, optimal substructure: any optimal split at k requires both halves to be optimal (exchange argument -- if a half were suboptimal, swap it for a cheaper one, contradiction). Second, the recurrence tries every valid k and keeps the minimum, so it cannot miss the best split.',
        'The diagonal fill order guarantees correctness by induction on chain length. Length 1 is trivially correct. For length L, every subproblem of length less than L is already computed and correct by hypothesis, so the minimum over all k for chains of length L is correct.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(n^3). There are O(n^2) subproblems in the upper triangle. Each tries O(n) split points. For 10 matrices, about 1,000 cell evaluations. For 100, about 1,000,000. The DP itself finishes in microseconds; the savings come from avoiding catastrophically expensive multiplication orders that would waste millions of scalar operations.',
        'Space: O(n^2) for the m and s tables. Since n counts matrices (not matrix dimensions), the tables are tiny in practice.',
        'Compare to brute force: Catalan(n-1) grows as 4^n. For 15 matrices, brute force evaluates over 2 million trees. The DP evaluates 455 cells with at most 14 splits each -- roughly 6,000 operations. That is a 300x reduction, and the gap widens exponentially.',
        'Hu and Shing (1982) gave an O(n log n) algorithm for specific cases. For practical chain lengths the cubic algorithm is simple, correct, and fast enough that micro-optimizing it is rarely worth the complexity.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SQL query optimization. Joining tables A, B, C, D can be done in many orders. Each order produces intermediate results of different sizes. The Selinger optimizer (System R, 1979) uses DP over relation subsets -- structurally the same interval DP -- to find the cheapest join plan. The "dimensions" are estimated cardinalities.',
        'Scientific computing. When a simulation composes many operator matrices per timestep, choosing the multiplication order once at setup can cut runtime for every subsequent step. The cost difference compounds over thousands of iterations.',
        'Compiler optimization. Expression trees involving matrix operations can be reshaped by the compiler to minimize intermediate storage and flop count. Tensor compilers like XLA and TVM solve generalized versions of this problem when fusing operations.',
        'Chain of linear transformations. In deep learning, composing weight matrices (e.g., for low-rank adapters or distillation) benefits from the same analysis when the matrices have mismatched shapes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The cost model assumes dense, standard matrix multiplication where the cost of multiplying a-by-b times b-by-c is exactly a*b*c. Sparse matrices, Strassen-style algorithms, and GPU GEMM kernels that pad to tile boundaries all violate this assumption. When the cost model is wrong, the DP solves the wrong problem optimally.',
        'The problem only applies to associative operations. If the chain includes operations that are not associative (element-wise operations interleaved with matmuls), the parenthesization is constrained and the DP does not apply directly.',
        'For chains longer than roughly 100 matrices, even O(n^3) becomes noticeable. Greedy heuristics -- pick the cheapest adjacent multiplication at each step -- often land within a few percent of optimal for long chains with similarly-scaled dimensions, at O(n^2) or O(n log n) cost.',
        'In query optimization, the "dimensions" are cardinality estimates that can be off by orders of magnitude. The DP finds the plan that is optimal for the estimated sizes, which may be far from optimal for the actual data.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Three matrices: A1 is 10-by-30, A2 is 30-by-5, A3 is 5-by-60. Dimensions array p = [10, 30, 5, 60].',
        'Base case: m[1,1] = m[2,2] = m[3,3] = 0.',
        'Length 2. m[1,2]: only one split, k=1. Cost = 0 + 0 + 10*30*5 = 1,500. m[2,3]: k=2. Cost = 0 + 0 + 30*5*60 = 9,000.',
        'Length 3. m[1,3]: try k=1 -- m[1,1] + m[2,3] + 10*30*60 = 0 + 9,000 + 18,000 = 27,000. Try k=2 -- m[1,2] + m[3,3] + 10*5*60 = 1,500 + 0 + 3,000 = 4,500. Best: 4,500 at k=2.',
        'The split table says s[1,3] = 2, meaning split after A2: (A1 * A2) * A3. Compute A1*A2 first (10*30*5 = 1,500 ops, result is 10-by-5), then multiply by A3 (10*5*60 = 3,000 ops). Total: 4,500.',
        'Compare the other grouping: A1 * (A2 * A3). A2*A3 costs 30*5*60 = 9,000, producing a 30-by-60 matrix. Then A1 times that costs 10*30*60 = 18,000. Total: 27,000. Same three matrices, same result, but 6x more work. The DP found the cheap order in O(n^3) instead of trying both by hand.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Godbole (1973), "On Efficient Computation of Matrix Chain Products" -- early formalization of the interval DP. Hu and Shing (1982), "Computation of Matrix Chain Products" -- O(n log n) algorithm for the convex-polygon formulation. Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter 15 -- the standard textbook treatment and the canonical introduction to dynamic programming.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: Memoization / Dynamic Programming -- understand top-down caching and bottom-up table filling before studying this topic.',
            'Sibling: 0/1 Knapsack -- another table-filling DP with traceback; same structure, different recurrence.',
            'Extension: Optimal Binary Search Tree -- another interval DP where m[i][j] is the best tree for keys i..j, filled by trying every root.',
            'Application: Join ordering in SQL optimizers -- the same interval DP with cardinality estimates replacing matrix dimensions.',
            'Generalization: Tensor network contraction -- matrix chain in higher dimensions; finding optimal contraction order is NP-hard in the general case.',
          ],
        },
      ],
    },
  ],
};
