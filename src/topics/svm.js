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
        { type: "callout", text: "An SVM is a boundary chosen by the closest points, not by the average point." },
        "The 'hard margin' view shows eight 2D points from two classes. A decision boundary appears as a solid line; two dashed lines mark the margin — the widest gap the SVM can place between the classes. Support vectors are highlighted: these are the points sitting exactly on the margin boundaries.",
        "The 'soft margin (C)' view adds two noisy points that break separability. Watch how the boundary shifts with different C values: high C (strict) bends the boundary to chase outliers; low C (relaxed) keeps a wide margin and accepts some misclassifications. Each violating point pays a penalty proportional to how far it crosses the margin.",
        "The 'kernel trick' view starts with 1D data that no single threshold can split. The feature map lifts each point x to (x, x²), and a line in the lifted space becomes a curve in the original. The final frame shows how the RBF kernel produces circular boundaries without computing explicit coordinates in infinite-dimensional space.",
      
        {type: 'image', src: './assets/gifs/svm.gif', alt: 'Animated walkthrough of the svm visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
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
        'Classification needs a decision boundary. Many boundaries correctly separate training data, but most of them barely clear some points and will fail on new data. A boundary that passes close to training examples is fragile — one shifted measurement flips the prediction.',
        'The SVM asks: among all boundaries that correctly classify the training set, which one has the most room to spare? Maximizing that room — the margin — produces a classifier that tolerates small perturbations in the data. Vapnik and Chervonenkis formalized this idea in 1963 as statistical learning theory. Cortes and Vapnik published the modern soft-margin SVM in 1995, adding the C parameter and kernel trick that made SVMs practical for real problems.',
        'The result is a classifier defined entirely by a few critical training points (the support vectors), equipped with formal generalization guarantees, and extensible to nonlinear boundaries through the kernel trick. For a decade before deep learning took over, SVMs were the dominant method for text classification, image recognition, and bioinformatics.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious classifier is logistic regression: compute a weighted sum of features, squeeze through a sigmoid, get a probability. It works, it is fast, and the coefficients are interpretable. But logistic regression minimizes prediction error across all points equally — a correctly classified point far from the boundary gets the same structural influence as one near the boundary.',
        'Another obvious approach is the nearest-neighbor rule: classify by the label of the closest training example. This adapts to any shape, but it stores the entire training set and is sensitive to noise in individual points.',
        'Both approaches ignore a geometric question: how wide is the gap between the classes? Logistic regression may find a boundary that separates the data but hugs one class too tightly. The SVM asks that question directly.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Logistic regression is driven by the likelihood of all points. Points far from the boundary still contribute gradient, pulling the boundary toward arrangements that are globally likely but not necessarily robust. When a few outliers or noisy points sit near the gap, the boundary can shift to accommodate them, sacrificing margin.',
        'Nearest neighbors fail differently: they memorize noise. A single mislabeled point near the boundary contaminates a region of the feature space. There is no concept of margin at all — the boundary is just the Voronoi diagram of the training set.',
        'The wall is that most classifiers optimize the wrong objective for robustness. Minimizing training loss or maximizing likelihood does not directly maximize the gap between classes. The SVM formulation changes the objective: maximize margin width, subject to correct classification.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The maximum-margin hyperplane. Among all hyperplanes that separate the training data, pick the one where the closest point from either class is as far away as possible. This closest point is a support vector.',
        'Formally: find w and b that minimize ½‖w‖² subject to yᵢ(w·xᵢ + b) ≥ 1 for all i. The margin width is 2/‖w‖, so minimizing ‖w‖² maximizes the margin. The constraint says every point must be at least distance 1/‖w‖ from the boundary on its correct side.',
        'Only the support vectors matter. If you remove any training point that is not a support vector, the optimal hyperplane does not change. The solution is sparse: in a dataset of thousands, perhaps dozens of points define the boundary. This sparsity is not a design choice — it falls out of the optimization.',
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
        'Hard margin: set up a quadratic program — minimize ½‖w‖² subject to yᵢ(w·xᵢ + b) ≥ 1. The Lagrangian dual turns this into: maximize Σαᵢ − ½Σαᵢαⱼ yᵢyⱼxᵢ·xⱼ, subject to αᵢ ≥ 0 and Σαᵢyᵢ = 0. Points with αᵢ > 0 are the support vectors. The decision function is f(x) = sign(Σαᵢyᵢxᵢ·x + b).',
        'Soft margin: add slack variables ξᵢ ≥ 0 and change the objective to minimize ½‖w‖² + CΣξᵢ, subject to yᵢ(w·xᵢ + b) ≥ 1 − ξᵢ. A point with ξᵢ = 0 is correctly classified outside the margin. A point with 0 < ξᵢ < 1 is inside the margin but on the correct side. A point with ξᵢ ≥ 1 is misclassified. The C parameter trades margin width against total violation: large C demands accuracy, small C demands margin.',
        'Kernel trick: notice the dual form only uses dot products xᵢ·xⱼ. Replace every dot product with a kernel function K(xᵢ, xⱼ) = φ(xᵢ)·φ(xⱼ) that computes the inner product in a higher-dimensional space without ever computing φ. The polynomial kernel K(x, z) = (x·z + 1)^d maps to all monomials up to degree d. The RBF kernel K(x, z) = exp(−γ‖x−z‖²) maps to infinite dimensions. The SVM in lifted space draws a hyperplane; projected back, that hyperplane becomes a curve.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Vapnik-Chervonenkis theory provides the guarantee: a classifier with larger margin has lower VC dimension, which bounds the gap between training and test error. Maximizing the margin is directly minimizing a capacity measure. Unlike logistic regression, where generalization relies on regularization added after the fact, margin maximization is the built-in generalization mechanism.',
        'The convex optimization ensures the solution is unique (for hard margin) or globally optimal (for soft margin). There are no local minima — the quadratic program has a single valley. The KKT conditions force most αᵢ to zero, which is why only support vectors survive.',
        'Kernels work because Mercer’s theorem guarantees that any positive semi-definite kernel corresponds to a dot product in some feature space. The SVM does not need to know what that space looks like. It only needs to evaluate K(xᵢ, xⱼ) between pairs of training points, which costs O(n²) kernel evaluations instead of operating in a potentially infinite-dimensional space.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Four points: A = (1,1) class −1, B = (2,1) class −1, C = (4,4) class +1, D = (5,3) class +1. Find the maximum-margin hyperplane.',
        'By symmetry and inspection, the boundary passes midway between the closest opposing points B = (2,1) and C = (4,4). Midpoint: (3, 2.5). The direction perpendicular to BC is (2,3), so w = (2,3). Normalizing: ‖w‖ = √13. The boundary equation: 2x + 3y + b = 0. Plugging in the midpoint: 2(3) + 3(2.5) + b = 0, so b = −13.5.',
        'Check support vectors. B: 2(2) + 3(1) − 13.5 = −6.5. C: 2(4) + 3(4) − 13.5 = 6.5. Both have |w·x + b| = 6.5. Rescale so support vectors score ±1: divide w and b by 6.5 to get w = (0.308, 0.462), b = −2.077. Margin = 2/‖w‖ = 2/√(0.308² + 0.462²) = 2/0.555 ≈ 3.6 units.',
        'Verify non-support vectors. A: 0.308(1) + 0.462(1) − 2.077 = −1.307. Since |−1.307| > 1, point A is farther from the boundary than the support vectors — it does not constrain the margin. D: 0.308(5) + 0.462(3) − 2.077 = 1.849 > 1. Same. Only B and C are support vectors.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Training solves a quadratic program. The standard SMO (Sequential Minimal Optimization) algorithm runs in O(n²) to O(n³) time depending on the data, where n is the number of training points. Each iteration selects two variables to optimize jointly, evaluating kernel values. Memory for the kernel matrix is O(n²), which becomes the bottleneck for large datasets.',
        'Prediction is O(s × d) where s is the number of support vectors and d is the feature dimension (or one kernel evaluation per support vector). Fast SVMs are sparse: if only 5% of training points are support vectors, prediction costs 5% of a brute-force scan.',
        'Doubling the training set roughly quadruples training time. This is why SVMs struggle with datasets beyond ~100k points without approximations. LIBSVM and LIBLINEAR are the standard solvers. For linear kernels, LIBLINEAR solves in O(n × d), competitive with logistic regression. For nonlinear kernels, approximate methods like random Fourier features or Nystroem approximation can reduce cost.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Text classification: bag-of-words features are high-dimensional and sparse, the exact regime where linear SVMs excel. Spam filters, sentiment classifiers, and document categorizers used SVMs throughout the 2000s. The sparsity of support vectors keeps the model small even with million-dimensional feature spaces.',
        'Bioinformatics: gene expression data has thousands of features (genes) and few samples (patients). SVMs with RBF or string kernels can find complex patterns without overfitting because the margin controls capacity. Protein fold recognition, cancer subtype classification, and drug-target interaction prediction all used SVMs before deep learning alternatives matured.',
        'Handwriting recognition: the MNIST digit task was an SVM benchmark for years. With polynomial or RBF kernels, SVMs reached ~1% error before convolutional networks pushed below 0.5%. SVMs remain competitive on small-data image tasks where training a deep network is impractical.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Scale. The O(n²) to O(n³) training cost and O(n²) kernel matrix memory make SVMs impractical for millions of training points without approximation. Modern datasets in vision, language, and recommendation systems are orders of magnitude beyond this threshold.',
        'Probability output. SVMs produce a signed distance, not a probability. Platt scaling can fit a sigmoid to the margins post-hoc, but this is a patch, not a native capability. When calibrated probabilities are essential — for ranking, thresholding, or combining with other models — logistic regression or neural networks give probabilities directly.',
        'Feature engineering. SVMs with RBF kernels can capture nonlinearity, but they do not learn hierarchical features. A deep network discovers edges, then textures, then objects; an SVM needs the features handed to it. On raw pixels, audio waveforms, or text tokens, neural networks have displaced SVMs almost entirely.',
        'Kernel selection. The kernel and its hyperparameters (γ for RBF, degree for polynomial, C for margin) must be chosen by grid search or cross-validation. The wrong kernel can completely fail. Neural networks also have hyperparameters, but architectures transfer across problems more readily than kernel choices.',
      ],
    },
    {
      heading: 'SVM vs. logistic regression vs. neural networks',
      paragraphs: [
        'Logistic regression and linear SVM both draw a hyperplane. The difference is the loss: logistic regression uses log-loss, which penalizes every point by its confidence; the SVM hinge loss ignores points beyond the margin. On separable data the SVM finds the maximum-margin boundary while logistic regression finds the maximum-likelihood boundary, which is not the same thing.',
        'Neural networks generalize the idea: stack many linear classifiers with nonlinear activations to learn hierarchical features and arbitrary decision boundaries. An SVM with an RBF kernel can also draw arbitrary boundaries, but it cannot learn intermediate representations. When data is plentiful and raw, neural networks dominate. When data is scarce, features are pre-engineered, or interpretability of the boundary matters, SVMs remain relevant.',
        'Rule of thumb: fewer than 10,000 points with good features → try SVM. More than 100,000 points with raw features → try neural networks. Need probability calibration and coefficient interpretation → logistic regression. These are starting points, not rules.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Vapnik and Chervonenkis 1963 introduced the foundations of statistical learning theory and the concept of VC dimension. Boser, Guyon, and Vapnik 1992 presented the kernel SVM at COLT. Cortes and Vapnik 1995 published the soft-margin formulation in Machine Learning. Platt 1998 introduced SMO, the efficient SVM solver. Scholkopf and Smola 2002, Learning with Kernels, is the comprehensive reference.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: Logistic Regression — the linear classifier SVM improves on by maximizing margin instead of likelihood.',
            'Extension: Kernel Methods — the broader family of algorithms that use the kernel trick (kernel PCA, kernel ridge regression, Gaussian processes).',
            'Alternative: Random Forest — an ensemble method that handles nonlinearity without kernels, scales to large datasets, and is less sensitive to hyperparameters.',
            'Contrast: K-Means — unsupervised clustering that also places boundaries in feature space, but without labels.',
            'Destination: Neural Networks — when you need learned features, hierarchical representations, or very large-scale classification.',
          ],
        },
      ],
    },
  ],
};
