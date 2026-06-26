// Support Vector Machine: find the widest street between two classes.
// The boundary is a hyperplane. The support vectors are the points
// closest to it — delete anything else and the boundary stays put.
// Watch margin maximization, soft margin slack, and the kernel trick
// lift 1D data into 2D where a line can cut what a point cannot.

import { plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'svm',
  title: 'Support Vector Machines',
  category: 'AI & ML',
  summary: 'Find the widest street between two classes — the support vectors pin it down and the kernel trick bends it without breaking it.',
  controls: [
    { id: 'view', label: 'Watch', type: 'select', options: ['hard margin', 'soft margin (C)', 'kernel trick'], defaultValue: 'hard margin' },
  ],
  run,
};

// ——— Hard-margin data: two linearly separable clusters ———
// Class +1 (upper right), class -1 (lower left).
// Points chosen so that support vectors are obvious.
const HARD_DATA = [
  // Class +1
  { x: 3, y: 4, label: 1, id: 'p0' },
  { x: 4, y: 5, label: 1, id: 'p1' },
  { x: 5, y: 4, label: 1, id: 'p2' },
  { x: 4, y: 6, label: 1, id: 'p3' },
  // Class -1
  { x: 1, y: 1, label: -1, id: 'n0' },
  { x: 0, y: 2, label: -1, id: 'n1' },
  { x: 1, y: 3, label: -1, id: 'n2' },
  { x: 2, y: 1, label: -1, id: 'n3' },
];

// The optimal separating hyperplane for this data: w·x + b = 0.
// Support vectors: p0 (3,4), n2 (1,3) — closest to boundary.
// Boundary: x + y - 5.5 = 0  => y = -x + 5.5
// Margin width: 2/||w|| = 2/sqrt(2) ≈ 1.414
const HARD_W = { w1: 1, w2: 1, b: -5.5 };
const HARD_SVS = ['p0', 'n2'];

function marginLines(w) {
  // Boundary: w1*x + w2*y + b = 0 => y = -(w1*x + b)/w2
  // Margin+: w1*x + w2*y + b = 1  => y = -(w1*x + b - 1)/w2
  // Margin-: w1*x + w2*y + b = -1 => y = -(w1*x + b + 1)/w2
  const xRange = [-0.5, 6.5];
  const boundary = xRange.map(x => ({ x, y: -(w.w1 * x + w.b) / w.w2 }));
  const marginPlus = xRange.map(x => ({ x, y: -(w.w1 * x + w.b - 1) / w.w2 }));
  const marginMinus = xRange.map(x => ({ x, y: -(w.w1 * x + w.b + 1) / w.w2 }));
  return [
    { id: 'boundary', label: 'w·x + b = 0', points: boundary },
    { id: 'margin-plus', label: 'margin +1', points: marginPlus },
    { id: 'margin-minus', label: 'margin −1', points: marginMinus },
  ];
}

function dataMarkers(data, scores) {
  return data.map((d) => ({
    id: d.id,
    x: d.x,
    y: d.y,
    label: scores ? scores[d.id] : (d.label === 1 ? '+' : '−'),
  }));
}

const AXES = { x: { label: 'feature x₁', min: -1, max: 7 }, y: { label: 'feature x₂', min: -1, max: 8 } };

// ——— Hard Margin visualization ———
function* hardMargin() {
  const r2 = (v) => Math.round(v * 100) / 100;
  const nPos = HARD_DATA.filter(d => d.label === 1).length;
  const nNeg = HARD_DATA.filter(d => d.label === -1).length;
  const svP0 = HARD_DATA.find(d => d.id === 'p0');
  const svN2 = HARD_DATA.find(d => d.id === 'n2');
  const wNorm = Math.sqrt(HARD_W.w1 ** 2 + HARD_W.w2 ** 2);

  // Step 1: Show the data
  yield {
    state: plotState({ axes: AXES, markers: dataMarkers(HARD_DATA) }),
    highlight: { active: ['p0', 'p1', 'p2', 'p3'], compare: ['n0', 'n1', 'n2', 'n3'] },
    explanation: `${HARD_DATA.length} points, two classes. The ${nPos} + class points cluster upper-right, the ${nNeg} − class points lower-left. Many lines could separate them. Which one should a classifier pick? A random line through the gap would work on this training set, but a barely-clearing line sits on a knife edge — one new point near the boundary could flip it. The SVM picks the line that maximizes the gap.`,
  };

  // Step 2: Show a bad separator
  const badW = { w1: 0.5, w2: 1, b: -3.5 };
  const badNorm = Math.sqrt(badW.w1 ** 2 + badW.w2 ** 2);
  yield {
    state: plotState({ axes: AXES, series: marginLines(badW), markers: dataMarkers(HARD_DATA) }),
    highlight: { active: ['boundary'], compare: ['n2', 'p0'] },
    explanation: `A valid separator (${badW.w1}x₁ + ${badW.w2}x₂ + (${badW.b}) = 0), but a poor one with margin width ${r2(2 / badNorm)}. It classifies every point correctly, yet the margin — the gap between the boundary and the closest points — is narrow. Point (${svN2.x},${svN2.y}) and point (${svP0.x},${svP0.y}) nearly touch the decision surface. A small shift in either would cause a misclassification. The SVM rejects this: it wants the widest possible street between the classes.`,
  };

  // Step 3: Show the optimal separator with margin
  yield {
    state: plotState({ axes: AXES, series: marginLines(HARD_W), markers: dataMarkers(HARD_DATA) }),
    highlight: { active: ['boundary'], found: ['p0', 'n2'], compare: ['margin-plus', 'margin-minus'] },
    explanation: `The maximum-margin hyperplane: ${HARD_W.w1}x₁ + ${HARD_W.w2}x₂ + (${HARD_W.b}) = 0. The dashed lines mark w·x + b = +1 and w·x + b = −1. The margin width is 2/‖w‖ = 2/${r2(wNorm)} ≈ ${r2(2 / wNorm)} units. No other line through this data produces a wider gap. The two highlighted points — (${svP0.x},${svP0.y}) and (${svN2.x},${svN2.y}) — sit exactly on the margin boundaries. These are the support vectors.`,
  };

  // Step 4: Explain support vectors
  const scores = {};
  for (const d of HARD_DATA) {
    const z = HARD_W.w1 * d.x + HARD_W.w2 * d.y + HARD_W.b;
    scores[d.id] = z.toFixed(1);
  }
  const p1Pt = HARD_DATA.find(d => d.id === 'p1');
  yield {
    state: plotState({ axes: AXES, series: marginLines(HARD_W), markers: dataMarkers(HARD_DATA, scores) }),
    highlight: { found: ['p0', 'n2'], active: ['boundary'] },
    explanation: `Each point now shows its functional margin: w·x + b. Support vectors ${HARD_SVS[0]} and ${HARD_SVS[1]} have |w·x + b| = 1 exactly. Points deeper inside their class have larger margins — (${p1Pt.x},${p1Pt.y}) scores ${scores['p1']}, far from the boundary. Delete any non-support-vector point and the boundary stays identical. Delete a support vector and the optimal boundary must change. The entire model depends on these few critical points.`,
    invariant: 'Support vectors satisfy |w·x + b| = 1. All other points satisfy |w·x + b| > 1.',
  };

  // Step 5: Margin computation walkthrough
  const p0Score = HARD_W.w1 * svP0.x + HARD_W.w2 * svP0.y + HARD_W.b;
  const n2Score = HARD_W.w1 * svN2.x + HARD_W.w2 * svN2.y + HARD_W.b;
  yield {
    state: plotState({ axes: AXES, series: marginLines(HARD_W), markers: dataMarkers(HARD_DATA, scores) }),
    highlight: { found: ['p0', 'n2'], active: ['margin-plus', 'margin-minus'] },
    explanation: `Margin computation for the worked example. w = (${HARD_W.w1}, ${HARD_W.w2}), b = ${HARD_W.b}, ‖w‖ = √(${HARD_W.w1}² + ${HARD_W.w2}²) = ${r2(wNorm)}. Point (${svP0.x},${svP0.y}): w·x + b = ${svP0.x} + ${svP0.y} + (${HARD_W.b}) = ${r2(p0Score)} — positive class, margin ${r2(p0Score)}/${r2(wNorm)} ≈ ${r2(p0Score / wNorm)}. Point (${svN2.x},${svN2.y}): w·x + b = ${svN2.x} + ${svN2.y} + (${HARD_W.b}) = ${r2(n2Score)} — negative class, |margin| ${r2(Math.abs(n2Score))}/${r2(wNorm)} ≈ ${r2(Math.abs(n2Score / wNorm))}. The geometric margin between the two margin planes is 2/‖w‖ = 2/${r2(wNorm)} ≈ ${r2(2 / wNorm)}. Maximizing this margin is the SVM optimization objective: minimize ‖w‖² subject to every point scoring at least 1 on its correct side.`,
  };
}

// ——— Soft Margin visualization ———
const SOFT_DATA = [
  ...HARD_DATA,
  // Add a noisy point: a −1 point inside the +1 region
  { x: 3, y: 3, label: -1, id: 'noise0' },
  // And a +1 point pushed toward −1 region
  { x: 2, y: 2, label: 1, id: 'noise1' },
];

function* softMargin() {
  const r2 = (v) => Math.round(v * 100) / 100;
  const noise0 = SOFT_DATA.find(d => d.id === 'noise0');
  const noise1 = SOFT_DATA.find(d => d.id === 'noise1');

  // Step 1: overlapping data
  yield {
    state: plotState({ axes: AXES, markers: dataMarkers(SOFT_DATA) }),
    highlight: { active: ['noise0', 'noise1'], compare: ['p0', 'n2'] },
    explanation: `Real data is rarely separable. ${SOFT_DATA.length} points now — two new points break the clean gap: a − point at (${noise0.x},${noise0.y}) sits among the + cluster, and a + point at (${noise1.x},${noise1.y}) drifts toward the − side. No line can classify every point correctly. Hard-margin SVM would declare "no solution." We need a way to allow some misclassifications while still preferring a wide margin.`,
  };

  // Step 2: High C (strict, narrow margin)
  const highCW = { w1: 1, w2: 1, b: -4.5 };
  const highCNorm = Math.sqrt(highCW.w1 ** 2 + highCW.w2 ** 2);
  const highCScores = {};
  for (const d of SOFT_DATA) {
    const z = highCW.w1 * d.x + highCW.w2 * d.y + highCW.b;
    highCScores[d.id] = z.toFixed(1);
  }
  yield {
    state: plotState({ axes: AXES, series: marginLines(highCW), markers: dataMarkers(SOFT_DATA, highCScores) }),
    highlight: { active: ['boundary'], compare: ['noise0', 'noise1'] },
    explanation: `C = 1000 (high penalty for violations). Boundary: ${highCW.w1}x₁ + ${highCW.w2}x₂ + (${highCW.b}) = 0, margin width ${r2(2 / highCNorm)}. The optimizer tolerates only minimal slack. Noise point (${noise0.x},${noise0.y}) scores ${highCScores['noise0']}, and (${noise1.x},${noise1.y}) scores ${highCScores['noise1']} — they sit inside the margin or on the wrong side, and each pays a penalty proportional to its violation. With extreme C, the SVM chases every point like a hard margin, overfitting noise.`,
  };

  // Step 3: Low C (relaxed, wide margin)
  const lowCW = { w1: 1, w2: 1, b: -5.5 };
  const lowCNorm = Math.sqrt(lowCW.w1 ** 2 + lowCW.w2 ** 2);
  const lowCScores = {};
  for (const d of SOFT_DATA) {
    const z = lowCW.w1 * d.x + lowCW.w2 * d.y + lowCW.b;
    lowCScores[d.id] = z.toFixed(1);
  }
  yield {
    state: plotState({ axes: AXES, series: marginLines(lowCW), markers: dataMarkers(SOFT_DATA, lowCScores) }),
    highlight: { active: ['boundary', 'margin-plus', 'margin-minus'], compare: ['noise0', 'noise1'] },
    explanation: `C = 0.1 (low penalty). Boundary: ${lowCW.w1}x₁ + ${lowCW.w2}x₂ + (${lowCW.b}) = 0, margin width ${r2(2 / lowCNorm)}. The optimizer prefers a wide margin and lets noisy points slide. Noise point (${noise0.x},${noise0.y}) scores ${lowCScores['noise0']}, and (${noise1.x},${noise1.y}) scores ${lowCScores['noise1']}. The boundary stays close to the original hard-margin solution, accepting misclassification of the two noisy points as the cost of a more robust model. Each noisy point gets a slack variable ξ > 0 — the penalty is C × Σξ, so small C means violations are cheap.`,
    invariant: 'The soft-margin objective: minimize ½‖w‖² + C·Σξᵢ. Large C demands accuracy; small C demands margin width.',
  };

  // Step 4: The C tradeoff
  const cValues = [-2, -1, 0, 1, 2, 3, 4];
  yield {
    state: plotState({
      axes: { x: { label: 'C (penalty parameter)', min: -3, max: 5 }, y: { label: 'effect', min: 0, max: 1 } },
      series: [
        { id: 'margin-width', label: 'margin width', points: cValues.map(logC => ({ x: logC, y: 1 / (1 + Math.exp(logC - 1)) })) },
        { id: 'train-error', label: 'training error', points: cValues.map(logC => ({ x: logC, y: 1 / (1 + Math.exp(-(logC - 1))) * 0.05 })) },
      ],
    }),
    highlight: { active: ['margin-width'], compare: ['train-error'] },
    explanation: `The C parameter is the SVM bias-variance knob. ${cValues.length} log₁₀(C) values from ${cValues[0]} to ${cValues[cValues.length - 1]} are plotted. Small C (left, e.g. C = ${r2(10 ** cValues[0])}): wide margin, more training errors, better generalization on noisy data. Large C (right, e.g. C = ${r2(10 ** cValues[cValues.length - 1])}): narrow margin, fewer training errors, risk of overfitting. Cross-validation picks the C that minimizes held-out error. In practice, search over powers of 10: C = 0.01, 0.1, 1, 10, 100.`,
  };
}

// ——— Kernel Trick visualization ———
// 1D data that is NOT linearly separable: −1 points on the outside,
// +1 points in the middle. Lifting x → (x, x²) makes it separable.
const KERNEL_1D = [
  { x: -3, label: -1, id: 'k0' },
  { x: -2, label: -1, id: 'k1' },
  { x: -1, label: 1, id: 'k2' },
  { x: 0, label: 1, id: 'k3' },
  { x: 1, label: 1, id: 'k4' },
  { x: 2, label: -1, id: 'k5' },
  { x: 3, label: -1, id: 'k6' },
];

function* kernelTrick() {
  const r2 = (v) => Math.round(v * 100) / 100;
  const kPos = KERNEL_1D.filter(d => d.label === 1);
  const kNeg = KERNEL_1D.filter(d => d.label === -1);
  const maxNegX2 = Math.max(...kNeg.map(d => d.x ** 2));

  // Step 1: 1D non-separable data
  yield {
    state: plotState({
      axes: { x: { label: 'x', min: -4, max: 4 }, y: { label: '', min: -0.5, max: 0.5 } },
      markers: KERNEL_1D.map(d => ({ id: d.id, x: d.x, y: 0, label: d.label === 1 ? '+' : '−' })),
    }),
    highlight: { active: ['k2', 'k3', 'k4'], compare: ['k0', 'k1', 'k5', 'k6'] },
    explanation: `One dimension, ${KERNEL_1D.length} points. ${kPos.length} + class points sit in the middle (|x| ≤ ${Math.max(...kPos.map(d => Math.abs(d.x)))}), ${kNeg.length} − class points on the outside (|x| ≥ ${Math.min(...kNeg.map(d => Math.abs(d.x)))}). No single threshold can separate them — any vertical cut leaves some + mixed with − on at least one side. A linear SVM in 1D is just a point on a number line, and it cannot draw a circle. The data needs a curve, but the SVM only draws lines.`,
  };

  // Step 2: Lift to 2D — the feature map φ(x) = (x, x²)
  const liftedMarkers = KERNEL_1D.map(d => ({
    id: d.id,
    x: d.x,
    y: d.x * d.x,
    label: d.label === 1 ? '+' : '−',
  }));
  const k2 = KERNEL_1D[2];
  const k0 = KERNEL_1D[0];
  const k4 = KERNEL_1D[4];
  yield {
    state: plotState({
      axes: { x: { label: 'x', min: -4, max: 4 }, y: { label: 'x²', min: -1, max: 10 } },
      markers: liftedMarkers,
    }),
    highlight: { active: ['k2', 'k3', 'k4'], compare: ['k0', 'k1', 'k5', 'k6'] },
    explanation: `Map every point x to φ(x) = (x, x²). For example, k2: x = ${k2.x} maps to (${k2.x}, ${k2.x ** 2}), k0: x = ${k0.x} maps to (${k0.x}, ${k0.x ** 2}), k4: x = ${k4.x} maps to (${k4.x}, ${k4.x ** 2}). The + points (|x| ≤ ${Math.max(...kPos.map(d => Math.abs(d.x)))}) land low: x² ≤ ${Math.max(...kPos.map(d => d.x ** 2))}. The − points (|x| ≥ ${Math.min(...kNeg.map(d => Math.abs(d.x)))}) land high: x² ≥ ${Math.min(...kNeg.map(d => d.x ** 2))}. In this lifted 2D space, a straight line easily separates the classes. The feature map φ made it separable by adding a dimension that encodes distance from the origin.`,
  };

  // Step 3: Show the separating hyperplane in lifted space
  const kernelW = { w1: 0, w2: -1, b: 2.5 };
  const k1Lifted = { x: KERNEL_1D[1].x, y: KERNEL_1D[1].x ** 2 };
  const k2Lifted = { x: k2.x, y: k2.x ** 2 };
  const k4Lifted = { x: k4.x, y: k4.x ** 2 };
  const k5Lifted = { x: KERNEL_1D[5].x, y: KERNEL_1D[5].x ** 2 };
  const boundaryThreshold = Math.abs(kernelW.b);
  const projectedRadius = r2(Math.sqrt(boundaryThreshold));
  yield {
    state: plotState({
      axes: { x: { label: 'x', min: -4, max: 4 }, y: { label: 'x²', min: -1, max: 10 } },
      series: [
        { id: 'boundary', label: 'x² = 2.5', points: [{ x: -4, y: 2.5 }, { x: 4, y: 2.5 }] },
      ],
      markers: liftedMarkers,
    }),
    highlight: { active: ['boundary'], found: ['k1', 'k2', 'k4', 'k5'] },
    explanation: `Boundary in lifted space: ${kernelW.w1}x + (${kernelW.w2})x² + ${kernelW.b} = 0, i.e. a horizontal line at x² = ${boundaryThreshold}. Below: + points. Above: − points. Support vectors: (${k2Lifted.x},${k2Lifted.y}), (${k4Lifted.x},${k4Lifted.y}) on the + side, (${k1Lifted.x},${k1Lifted.y}) and (${k5Lifted.x},${k5Lifted.y}) on the − side — the four points closest to the boundary. Projecting this line back to 1D gives the decision rule |x| < √${boundaryThreshold} ≈ ${projectedRadius} → class +. A line in lifted space is a curve in the original space.`,
  };

  // Step 4: The kernel trick avoids explicit lifting
  yield {
    state: plotState({
      axes: { x: { label: 'x', min: -4, max: 4 }, y: { label: 'x²', min: -1, max: 10 } },
      series: [
        { id: 'boundary', label: 'decision boundary', points: [{ x: -4, y: 2.5 }, { x: 4, y: 2.5 }] },
      ],
      markers: liftedMarkers,
    }),
    highlight: { active: ['boundary'], found: ['k1', 'k2', 'k4', 'k5'] },
    explanation: `The kernel trick: the SVM optimization only needs dot products φ(xᵢ)·φ(xⱼ). A kernel function K(xᵢ, xⱼ) computes this dot product WITHOUT explicitly transforming the data. For the polynomial kernel of degree 2: K(x, z) = (x·z + 1)² expands to include x², xz, and constant terms — the same features φ would produce, but computed as one cheap evaluation. The boundary x² = ${boundaryThreshold} came from solving ${kernelW.w2}x² + ${kernelW.b} = 0 in lifted space. The RBF kernel K(x, z) = exp(−γ‖x−z‖²) implicitly maps to infinite dimensions. The SVM never stores or iterates over those dimensions. It only evaluates K between pairs of training points.`,
    invariant: 'K(xᵢ, xⱼ) = φ(xᵢ)·φ(xⱼ) — the kernel computes the lifted dot product without the lift.',
  };

  // Step 5: RBF kernel decision boundary shape
  const rbfRadius = r2(Math.sqrt(boundaryThreshold));
  const rbfBoundaryPoints = [];
  for (let theta = 0; theta <= 2 * Math.PI; theta += 0.1) {
    rbfBoundaryPoints.push({ x: rbfRadius * Math.cos(theta), y: rbfRadius * Math.sin(theta) });
  }
  const outerDist = 3;
  yield {
    state: plotState({
      axes: { x: { label: 'x₁', min: -4, max: 4 }, y: { label: 'x₂', min: -4, max: 4 } },
      series: [
        { id: 'rbf-boundary', label: 'RBF decision boundary', points: rbfBoundaryPoints },
      ],
      markers: [
        { id: 'center', x: 0, y: 0, label: '+' },
        { id: 'outer1', x: outerDist, y: 0, label: '−' },
        { id: 'outer2', x: -outerDist, y: 0, label: '−' },
        { id: 'outer3', x: 0, y: outerDist, label: '−' },
        { id: 'outer4', x: 0, y: -outerDist, label: '−' },
      ],
    }),
    highlight: { active: ['rbf-boundary'], found: ['center'], compare: ['outer1', 'outer2', 'outer3', 'outer4'] },
    explanation: `With an RBF kernel in 2D, the SVM draws curves — here, a circle of radius ${rbfRadius}. The + class center sits at (0,0), and − class markers are placed at distance ${outerDist} on each axis. The kernel maps each point to infinite dimensions where this circle becomes a hyperplane. The γ parameter in exp(−γ‖x−z‖²) controls the radius of influence: large γ makes tight boundaries (each support vector creates a small bubble), small γ makes smooth boundaries (support vectors blend). The SVM computes only kernel evaluations between training points, never coordinates in the infinite-dimensional space.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'hard margin') yield* hardMargin();
  else if (view === 'soft margin (C)') yield* softMargin();
  else if (view === 'kernel trick') yield* kernelTrick();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        {
          type: 'callout',
          text: 'An SVM is a boundary chosen by the closest points, not by the average point.',
        },
        'Read the SVM animation as a search for a decision boundary, which is a rule that assigns a point to one class or the other. The hard-margin view highlights support vectors, the training points that sit closest to the boundary and therefore pin it in place.',
        'The soft-margin view adds slack, which means some points may violate the margin or even cross the boundary for a penalty. The kernel view shows a feature map, a transformation that makes curved separation look linear in a higher-dimensional space.',
        {
          type: 'image',
          src: './assets/gifs/svm.gif',
          alt: 'Animated walkthrough of the svm visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Svm_separating_hyperplanes_%28SVG%29.svg',
          alt: 'Three separating hyperplanes, where only one maximizes the margin between two classes.',
          caption: 'The maximum-margin picture shows why the SVM prefers the separator with the widest street, not merely any separator that fits the training set. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Svm_separating_hyperplanes_(SVG).svg.',
        },
        'Classification often has many boundaries that fit the training data. A support vector machine exists because the boundary that barely clears the data is fragile, while the boundary with the widest empty gap has room for future points to move without changing class.',
        'The empty gap is the margin. Maximizing the margin turns a vague preference for robustness into a concrete optimization problem over the boundary weights.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A reasonable first classifier is logistic regression, which learns a weighted sum of features and converts the score into a probability. It is fast and useful, but every point keeps exerting pressure on the fitted boundary even when it is already far from the decision edge.',
        'Another reasonable approach is nearest neighbor, which stores examples and labels a new point by the closest stored point. It can represent curved regions, but it memorizes noise and has no idea of a margin.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that fitting the observed labels is not the same as choosing a stable boundary. If two lines both classify the training set correctly, ordinary accuracy cannot tell which one leaves more safety space around the closest examples.',
        'Nonlinear data adds a second wall. A straight boundary cannot separate points arranged as an inner cluster and an outer ring, even when the pattern is obvious to a human.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Choose the separating hyperplane with the largest margin. A hyperplane is the line, plane, or higher-dimensional flat surface defined by w dot x plus b equals zero.',
        'Only the closest training points can constrain that widest margin. Those points are support vectors; removing a non-support vector leaves the same solution, while moving a support vector can move the boundary.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/cc/Kernel_trick_idea.svg',
          alt: 'Kernel trick example mapping circularly arranged points into a higher-dimensional space with a separating plane.',
          caption: 'The kernel trick keeps the linear separator in feature space while the original input space sees a curved boundary. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Kernel_trick_idea.svg.',
        },
        'For hard-margin SVM, the optimizer minimizes one half times ||w|| squared while requiring every labeled point to score at least 1 on its correct side. Because the margin width is 2 divided by ||w||, minimizing ||w|| maximizes the gap.',
        'Soft-margin SVM adds slack variables for violations and a penalty C. Large C makes violations expensive and narrows the model around outliers; small C makes violations cheaper and preserves a wider margin.',
        'The dual form uses only dot products between training points. A kernel replaces that dot product with K(x,z), which acts like a dot product after a feature map without explicitly building the mapped coordinates.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness claim for the fitted classifier is geometric. If every training point satisfies y times score at least 1, then all points are on the correct side of the boundary and outside the margin strip.',
        'The optimization is convex, so solving it does not depend on lucky initialization. The Karush-Kuhn-Tucker conditions force non-support-vector coefficients to zero, which is why prediction depends only on the support vectors.',
        'A valid kernel works because it corresponds to an inner product in some feature space. The SVM is still finding a linear separator there; the curved boundary appears only when that separator is viewed back in the original input space.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Training with a nonlinear kernel usually needs many pairwise kernel evaluations, so time is commonly between O(n^2) and O(n^3) for n training points. The kernel matrix can take O(n^2) memory, which becomes the practical limit before the math becomes confusing.',
        'Prediction costs one kernel evaluation per support vector. If 2,000 of 40,000 training points become support vectors, each prediction must compare the new point with those 2,000 retained examples.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Linear SVMs work well for sparse text features because a document may have millions of possible words but only a few active ones. The margin objective gives strong baselines for spam filtering, document tagging, and small labeled corpora.',
        'Kernel SVMs are useful when the dataset is modest and the boundary is nonlinear. They have been used in bioinformatics, handwriting recognition, and other settings where engineered features are available but labels are limited.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SVMs fail at large training scale when a kernel matrix is too expensive to build or store. Millions of examples push teams toward linear solvers, approximate kernels, gradient-boosted trees, or neural networks.',
        'They also fail when calibrated probabilities are the primary output. The raw SVM score is a signed distance, so probability estimates require an extra calibration step such as Platt scaling.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use the animation hard-margin line w = (1, 1) and b = -5.5. The point p0 = (3, 4) has score 1*3 + 1*4 - 5.5 = 1.5, and n2 = (1, 3) has score 1*1 + 1*3 - 5.5 = -1.5 before rescaling.',
        'Divide w and b by 1.5 so those closest points score +1 and -1. The new ||w|| is sqrt(2) / 1.5, so the margin width is 2 / (sqrt(2) / 1.5), about 2.12 units. A point such as (4, 6) scores far above +1, so it does not decide the boundary.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Cortes and Vapnik 1995 for soft-margin SVMs, Boser, Guyon, and Vapnik 1992 for kernel training, and LIBSVM or LIBLINEAR for practical solvers. Next study logistic regression for the linear baseline, kernel methods for the dot-product trick, and neural networks for learned representations.',
      ],
    },
  ],
};
