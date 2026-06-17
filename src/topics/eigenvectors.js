// Eigenvectors: most directions get rotated when a matrix hits them — a
// special few only get STRETCHED. Those directions are the matrix's
// skeleton, and half of applied math is the art of finding them.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'eigenvectors',
  title: 'Eigenvalues & Eigenvectors',
  category: 'Concepts',
  summary: 'The directions a matrix refuses to rotate — found live by power iteration, and the skeleton under PageRank, PCA, and SVD.',
  controls: [
    { id: 'view', label: 'Find', type: 'select', options: ['the directions a matrix keeps', 'one equation, five fields'], defaultValue: 'the directions a matrix keeps' },
  ],
  run,
};

// A = [[2,1],[1,2]] — symmetric, eigenvalues 3 and 1,
// eigenvectors along (1,1) and (1,−1).
const A = [[2, 1], [1, 2]];
const apply = ([x, y]) => [A[0][0] * x + A[0][1] * y, A[1][0] * x + A[1][1] * y];
const norm = ([x, y]) => Math.hypot(x, y);
const unit = (v) => v.map((c) => c / norm(v));
const AXES = { x: { label: '', min: -0.5, max: 3.4 }, y: { label: '', min: -1.6, max: 3.2 } };
const vec = (id, label, to, from = { x: 0, y: 0 }) => ({ id, label, from, to: { x: to[0], y: to[1] } });

function* directions() {
  yield {
    state: plotState({
      axes: AXES,
      vectors: [
        vec('e1', 'v = (1,0)', [1, 0]),
        vec('Ae1', 'Av = (2,1) — rotated!', apply([1, 0])),
        vec('e2', 'v = (0,1)', [0, 1]),
        vec('Ae2', 'Av = (1,2) — rotated!', apply([0, 1])),
      ],
    }),
    highlight: { visited: ['e1', 'e2'], compare: ['Ae1', 'Ae2'] },
    explanation: 'Take the matrix A = [[2,1],[1,2]] and feed it vectors. The x-axis vector (1,0) comes out as (2,1) — longer AND swung upward. The y-axis vector (0,1) comes out as (1,2) — swung the other way. This is what matrices DO: every direction gets some mix of stretching and turning, and SVD & Low-Rank Approximation showed the anatomy (rotate · stretch · rotate). The question this page asks is sharper: is there any direction the matrix refuses to turn — a vector that comes back pointing exactly where it pointed?',
  };

  const e1 = unit([1, 1]);
  const e2 = unit([1, -1]);
  yield {
    state: plotState({
      axes: AXES,
      vectors: [
        vec('eig1', 'v along (1,1)', e1),
        vec('Aeig1', 'Av = 3v — same direction!', apply(e1)),
        vec('eig2', 'v along (1,−1)', e2),
        vec('Aeig2', 'Av = 1v — untouched', apply(e2)),
      ],
    }),
    highlight: { found: ['eig1', 'Aeig1'], compare: ['eig2', 'Aeig2'] },
    explanation: 'Yes — two of them. The diagonal direction (1,1) comes back as exactly 3× itself: no turn, pure stretch. The anti-diagonal (1,−1) comes back as 1× itself — utterly ignored. These are the EIGENVECTORS (German "eigen": own, characteristic — the matrix\'s OWN directions), and the stretch factors 3 and 1 are the EIGENVALUES: Av = λv. Along these axes the matrix is just multiplication by a number — all its complexity is which directions it owns and how hard it stretches each. That pair of facts is the matrix\'s skeleton.',
    invariant: 'Av = λv: along an eigenvector, a matrix acts as a single number.',
  };

  const path = [];
  let v = [1, 0];
  for (let k = 0; k < 6; k++) {
    path.push({ v: [...v], angle: (Math.atan2(v[1], v[0]) * 180) / Math.PI });
    v = unit(apply(v));
  }
  yield {
    state: plotState({
      axes: AXES,
      vectors: path.map((p, k) => vec(`it${k}`, k === 0 ? 'start (1,0)' : `after ×A ${k}: ${p.angle.toFixed(1)}°`, [p.v[0] * (1 + k * 0.12), p.v[1] * (1 + k * 0.12)])),
    }),
    highlight: { visited: ['it0', 'it1', 'it2'], found: ['it5'] },
    explanation: `How do you FIND the skeleton? The dumbest possible idea works: pick any vector and just keep applying A (re-normalizing so it doesn't blow up). Watch the fan — computed live: starting flat at 0°, one application swings to ${path[1].angle.toFixed(1)}°, then ${path[2].angle.toFixed(1)}°, ${path[3].angle.toFixed(1)}°, ${path[4].angle.toFixed(1)}°… homing in on the 45° eigenvector like a compass needle. This is POWER ITERATION — the same loop SVD & Low-Rank Approximation used to peel singular layers, and (spoiler for the next view) the same loop that ranks the web.`,
  };

  yield {
    state: matrixState({
      title: 'Why repetition finds the dominant direction',
      rows: [
        { id: 'decomp', label: 'any v = a·e₁ + b·e₂' },
        { id: 'once', label: 'apply A once' },
        { id: 'ntimes', label: 'apply A n times' },
        { id: 'limit', label: 'n = 10' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v2) => ['', 'every vector is a recipe of eigen-directions', 'A·v = 3a·e₁ + 1b·e₂ — each ingredient scales by ITS λ', 'Aⁿv = 3ⁿa·e₁ + 1ⁿb·e₂', '3¹⁰ = 59,049 vs 1¹⁰ = 1 — e₁ drowns out everything'][v2],
    }),
    highlight: { found: ['limit:what'] },
    explanation: 'The why, in one decomposition: write the starting vector as a mix of the eigen-directions, and each application of A multiplies every ingredient by its own eigenvalue. After n rounds the components stand in ratio λ₁ⁿ : λ₂ⁿ — here 3ⁿ to 1ⁿ — so the dominant eigenvector\'s share grows EXPONENTIALLY and everything else becomes rounding error. Convergence speed is set by the ratio λ₂/λ₁ (the spectral gap): a big gap snaps in a few iterations, a narrow one crawls. You have already lived this theorem twice: it is why Vanishing & Exploding Gradients compounds (a network layer applied repeatedly amplifies along its top direction), and it is the engine inside the next view\'s most famous algorithm.',
    invariant: 'Aⁿv → the dominant eigenvector: components scale as λⁿ, and the largest λ wins exponentially.',
  };
}

function* fiveFields() {
  yield {
    state: matrixState({
      title: 'PageRank IS power iteration',
      rows: [
        { id: 'matrix', label: 'the matrix' },
        { id: 'vector', label: 'the vector' },
        { id: 'iterate', label: 'the loop' },
        { id: 'answer', label: 'the eigenvector' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'the web\'s link structure (who links to whom)', 'every page\'s current importance score', 'importance flows along links, again and again', 'the steady scores — the ranking itself'][v],
    }),
    highlight: { found: ['answer:what'] },
    explanation: 'Field 1 — SEARCH: PageRank (Google\'s Algorithm) is, mathematically, nothing but the power iteration you just watched, run on a matrix with billions of rows: importance flows along links, the flow is repeated until it stops changing, and the resting distribution — the dominant eigenvector of the link matrix — is the ranking. The same fixed-point logic gives Markov chains their steady states: the long-run behavior of any "flow + repeat" system is an eigenvector wearing a probability costume.',
  };

  yield {
    state: matrixState({
      title: 'Statistics & geometry: the axes data actually uses',
      rows: [
        { id: 'pcaRow', label: 'PCA' },
        { id: 'svdRow', label: 'SVD' },
        { id: 'stab', label: 'stability / gradients' },
      ],
      columns: [{ id: 'eig', label: 'the eigen-story' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'covariance matrix\'s eigenvectors = the principal axes; eigenvalues = variance along each', 'singular values = √eigenvalues of AᵀA — the same skeleton for non-square matrices', 'a layer\'s top eigenvalue is its amplification factor: >1 compounds, <1 starves'][v],
    }),
    highlight: { compare: ['pcaRow:eig', 'svdRow:eig'] },
    explanation: 'Fields 2 and 3 — STATISTICS and DEEP LEARNING: PCA: Principal Component Analysis solved a 2×2 eigenproblem on a covariance matrix to find the data\'s natural axes (the eigenvalues WERE the explained variances), and SVD & Low-Rank Approximation generalized the same skeleton to any rectangular matrix. Meanwhile every stability argument on this site is secretly spectral: Vanishing & Exploding Gradients\' narrow corridor is the statement "keep every layer\'s top eigenvalue near 1," and Loss Landscapes & Optimization Geometry\'s sharp-vs-flat minima are described by the Hessian\'s eigenvalues — big λ means a steep, fragile direction.',
  };

  yield {
    state: matrixState({
      title: 'One equation, five fields',
      rows: [
        { id: 'web', label: 'web search' },
        { id: 'stats', label: 'statistics' },
        { id: 'dl', label: 'deep learning' },
        { id: 'graphs', label: 'graph clustering' },
        { id: 'physics', label: 'physics & engineering' },
      ],
      columns: [{ id: 'guise', label: 'Av = λv, in disguise' }],
      values: [[1], [2], [3], [4], [5]],
      format: (v) => ['', 'PageRank: the web\'s steady importance flow', 'principal components: directions of variance', 'layer amplification, Hessian curvature, attention spectra', 'graph Laplacian eigenvectors cut communities apart', 'vibration modes, resonance, quantum energy levels'][v],
    }),
    highlight: { active: ['physics:guise'] },
    explanation: 'The census. Spectral graph clustering cuts social networks along the Laplacian\'s small eigenvectors; bridges and buildings are certified safe by computing their vibration modes — eigenvectors of a stiffness matrix — and keeping resonant eigenvalues away from earthquake frequencies; quantum mechanics\' energy levels ARE eigenvalues, by postulate. One equation, five fields, a century of mileage. The unifying intuition to carry out the door: whenever a system FLOWS, REPEATS, or OSCILLATES, its long-run behavior is governed not by everything it could do, but by a handful of directions it cannot help returning to — find the eigenvectors, and you have found the system\'s habits.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the directions a matrix keeps') yield* directions();
  else if (view === 'one equation, five fields') yield* fiveFields();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `Why this exists`,
      paragraphs: [
        `A matrix is a rule for moving vectors. In two dimensions it may stretch, shrink, shear, reflect, or rotate directions. If you only inspect the entries of the matrix, it is hard to see which directions the transformation really cares about.`,
        `Eigenvectors answer that question. An eigenvector is a nonzero direction that the matrix does not turn. The matrix may stretch it, shrink it, or flip it, but the output stays on the same line. The scale factor is the eigenvalue, written as Av = lambda v.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The first thing most people try is to test the coordinate axes. Feed in (1, 0), feed in (0, 1), and see what comes out. That works for diagonal matrices because each coordinate axis already behaves independently.`,
        `The wall appears as soon as the matrix mixes coordinates. For A = [[2,1],[1,2]], the x-axis vector becomes (2,1) and the y-axis vector becomes (1,2). Both have turned. The standard axes were convenient for writing the matrix, but they were not the directions the matrix preserves.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `Change basis to the directions the matrix does not turn. Along those directions the matrix stops being a complicated coordinate mixer and becomes ordinary multiplication by a number. For the demo matrix, the diagonal direction (1,1) is stretched by 3, and the anti-diagonal direction (1,-1) is stretched by 1.`,
        `That is why eigenvectors feel like a matrix's skeleton. They show the axes along which the transformation acts independently. Eigenvalues say how strongly each axis is stretched, damped, or flipped.`,
        `The practical payoff is compression of explanation. A messy repeated transformation becomes a small list of preferred directions and multipliers. That is why the same equation keeps showing up in ranking, stability, vibration, optimization, and dimensionality reduction.`,
        `Once you learn to ask for the directions a system preserves, many unrelated problems become easier to compare. A ranking system asks where repeated link flow settles. A mechanical system asks which vibration modes it naturally supports. An optimizer asks which curvature directions are steep enough to destabilize a step.`,
      ],
    },
    {
      heading: `How the visual model teaches it`,
      paragraphs: [
        `In the opening frame, compare each input arrow to its output arrow. If the output arrow points somewhere else, that direction is not an eigenvector. If the output arrow lies on the same line, the matrix has preserved the direction and only changed the length.`,
        `In the power-iteration frame, do not treat the moving arrows as a search over every possible angle. The loop is simpler: multiply by A, normalize so the arrow stays readable, and repeat. The arrow turns toward 45 degrees because the component in the lambda = 3 direction grows faster than the component in the lambda = 1 direction.`,
        `In the field-summary frames, read each row as the same equation in a different costume. PageRank wants a steady importance vector. PCA wants directions of variance. A Hessian wants directions of curvature. The matrix changes, but the question stays the same: which directions keep coming back?`,
      ],
    },
    {
      heading: `How power iteration works`,
      paragraphs: [
        `Power iteration finds one dominant eigenvector without solving the full eigenproblem. Start with almost any nonzero vector v. Repeatedly compute A v, then normalize the result. If the matrix has one eigenvalue with largest magnitude and the starting vector has some component in that direction, the normalized vector converges toward that dominant direction.`,
        `The method works because any starting vector can be written as a mixture of eigen-directions when the matrix has a usable eigenbasis. Each multiplication by A scales each ingredient by its own eigenvalue. After n multiplications, the component with the largest absolute eigenvalue has been multiplied by its eigenvalue n times, so it dominates the mixture.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `For A = [[2,1],[1,2]], the two eigen-directions are e1 = (1,1) and e2 = (1,-1). A e1 = (3,3), so e1 is scaled by 3. A e2 = (1,-1), so e2 is scaled by 1.`,
        `The starting vector (1,0) can be written as 0.5(1,1) + 0.5(1,-1). After one multiplication, it becomes 0.5*3(1,1) + 0.5*1(1,-1). After ten multiplications, the ratio between those parts is 3^10 to 1^10. The diagonal component is now 59,049 times larger than the anti-diagonal component before normalization. The visible vector points almost exactly along (1,1).`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The correctness argument is a dominance argument. If |lambda1| is larger than every other eigenvalue magnitude, then the lambda1 component grows faster under repeated multiplication. Normalization changes the length, not the direction, so it does not remove the dominance.`,
        `The spectral gap controls the speed. If |lambda2/lambda1| is small, the second component fades quickly. If the ratio is near 1, convergence is slow. If two eigenvalues tie in magnitude, plain power iteration may not pick a stable unique direction.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Finding all eigenvalues and eigenvectors of a dense n by n matrix with standard direct methods is roughly O(n^3). Power iteration is cheaper when you only need the dominant direction: each step costs one matrix-vector multiply, which is O(n^2) for a dense matrix and O(nnz) for a sparse matrix with nnz stored nonzero entries.`,
        `The hidden cost is iteration count. A matrix with a large spectral gap may converge in a few steps. A matrix with close top eigenvalues may need many steps. Numerical stability also matters because repeated multiplication can overflow, underflow, or amplify roundoff unless the vector is normalized and the implementation is careful.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `PageRank uses a steady eigenvector of a link-flow matrix: importance flows through links until repeated updates stop changing the score vector. Markov chains use the same fixed-point idea for long-run probabilities when the chain has the right mixing properties.`,
        `PCA finds eigenvectors of a covariance matrix. The eigenvectors are directions in feature space, and the eigenvalues measure variance along those directions. Hessian analysis uses eigenvalues as curvature strengths: large positive values mean steep directions, small values mean flat directions, and negative values expose directions that curve downward.`,
      ],
    },
    {
      heading: `Where it is not enough`,
      paragraphs: [
        `Not every useful matrix has a full set of real eigenvectors. A 90-degree rotation has no real direction that stays on the same line. Non-symmetric matrices can have complex eigenvalues, defective structure, or unstable numerical behavior. In those cases, SVD is often the safer tool because it works for every real matrix and describes input-output stretching even when eigenvectors are awkward.`,
        `Power iteration is also the wrong tool when you need interior eigenvalues, many eigenvectors, or a guaranteed answer for clustered eigenvalues. Krylov methods, QR iteration, Lanczos, Arnoldi, or SVD-based methods are better fits depending on the matrix and the question.`,
      ],
    },
    {
      heading: `Failure modes`,
      paragraphs: [
        `Eigenvectors are directions, not single arrows. Multiplying an eigenvector by 2 gives the same eigen-direction, so normalization is a convention, not a mathematical change. Eigenvalues are scale factors, not probabilities or importance scores by themselves.`,
        `The dominant eigenvalue means largest absolute value. A negative dominant eigenvalue flips the vector each step while still dominating the magnitude. A complex dominant pair can make simple real iteration rotate instead of settling. These are not edge trivia; they determine whether the algorithm visible in the demo is valid for a new matrix.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Matrix Multiplication and Linear Transformations if the geometry still feels slippery. Study SVD and Low-Rank Approximation for the more general stretch-axis story. Study PCA for covariance eigenvectors, PageRank for power iteration at graph scale, and Markov Chains and Steady States for fixed points.`,
        `Then study Loss Landscapes and Optimization Geometry, The Hessian: Curvature and Newton's Step, Vanishing and Exploding Gradients, and Natural Gradient and Fisher Information to see eigenvalues become the language of optimization stability.`,
      ],
    },
  ],
};
