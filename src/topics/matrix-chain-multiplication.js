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
        'The grid is a dynamic-programming table. Cell m[i][j] means the cheapest scalar-multiplication cost for matrices i through j. The main diagonal is zero because one matrix does not need to be multiplied.',
        'Each diagonal pass solves chains of one length. Active cells are being computed, visited cells are smaller solved subchains, and the found top-right cell is the full-chain answer.',
        {type: 'callout', text: 'Matrix-chain DP works because every full parenthesization is one split plus two smaller optimal chains.'},
        {type: 'image', src: './assets/gifs/matrix-chain-multiplication.gif', alt: 'Animated walkthrough of the matrix chain multiplication visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Matrix multiplication is associative, so different parenthesizations can produce the same final matrix. The cost changes because intermediate matrix dimensions change. The problem exists to choose the grouping that avoids unnecessary scalar multiplications.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach tries every parenthesization and scores each one. This is reasonable for three or four matrices because there are only a few trees. It becomes a counting problem over binary tree shapes.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Convex_Polygon_Triangulations_Annotated.svg', alt: 'Annotated convex polygon triangulations showing several ways to split a polygon', caption: 'Parenthesizing a matrix chain is structurally the same counting problem as triangulating a convex polygon: many shapes, one final object. Source: Wikimedia Commons, Jespa, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The number of parenthesizations is the Catalan number C(n-1). C(9) is 4862, and C(19) is 1767263190. Brute force explodes because it recomputes the same subchain costs inside many outer trees.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Every product from i through j has one final split k. The left side is i through k, the right side is k+1 through j, and those two results are multiplied once. If either half were not optimal, replacing it with a cheaper half would improve the full solution.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Let p be the dimension array, where A_i has size p[i-1] by p[i]. Define m[i][j] as the minimum cost for A_i through A_j. The recurrence is m[i][j] = min over k of m[i][k] + m[k+1][j] + p[i-1] * p[k] * p[j].',
        'Fill by increasing chain length so every dependency is already solved. Store the winning split k in a second table. After the cost table is full, recursively following those splits reconstructs the parenthesization.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows by induction on chain length. Length 1 is correct because one matrix costs zero multiplications. For length L, every final split uses shorter chains whose costs are already correct, and the recurrence tries every legal split.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'There are O(n^2) intervals and each interval tries O(n) split points, so time is O(n^3). If n doubles, planning work grows by about eight times. Space is O(n^2) for the cost and split tables.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SQL join ordering uses the same shape: choose a final join split, solve smaller joins, and combine estimated costs. Scientific computing and tensor systems use the idea when a fixed product or contraction shape will be executed many times. The planning cost is small when it prevents expensive intermediate results.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The recurrence assumes dense standard matrix multiplication where multiplying a-by-b by b-by-c costs a*b*c. Sparse matrices, GPU tiling, Strassen-like methods, batching, and memory layout can break that cost model. If the cost model is wrong, the dynamic program optimizes the wrong objective.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Let A1 be 10 by 30, A2 be 30 by 5, and A3 be 5 by 60. Grouping (A1*A2)*A3 costs 10*30*5 = 1500, then 10*5*60 = 3000, for total 4500. Grouping A1*(A2*A3) costs 30*5*60 = 9000, then 10*30*60 = 18000, for total 27000.',
        'The final result shape is the same, 10 by 60. The cheaper grouping first creates a skinny 10 by 5 intermediate. The expensive grouping creates a wide 30 by 60 intermediate, so the last multiply is much larger.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read CLRS, Introduction to Algorithms, Chapter 15, for the canonical dynamic-programming treatment. Historical sources include Godbole on efficient matrix-chain computation and Hu and Shing on faster algorithms through the polygon formulation. Study memoization, optimal binary search trees, SQL join ordering, and tensor contraction next.',
      ],
    },
  ],
};
