// Contour maps: the same loss terrain as The Loss Landscape, in 3D — seen
// from straight above, the way every paper, TensorBoard, and textbook
// actually draws it. Learn to read rings, passes, and ravines from altitude.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'contour-maps',
  title: 'Loss Landscapes from Above: Contour Maps',
  category: 'Concepts',
  summary: 'The 3D terrain flattened the way papers draw it: nested rings, the figure-eight pass, and optimizer paths crossing lines.',
  controls: [
    { id: 'view', label: 'Read', type: 'select', options: ['reading the map', 'optimizer paths on the map'], defaultValue: 'reading the map' },
  ],
  run,
};

// The exact surface from the 3D page: f(x,y) = (x²−4)²/22 + x/4 + 1 + 1.5y².
const g = (x) => ((x * x - 4) ** 2) / 22 + x / 4 + 1; // the y = 0 spine
// The pass is the MAXIMUM of g between the two minima (the x/4 tilt pushes
// the crest right of zero) — found numerically, not assumed.
let BARRIER = -Infinity;
for (let x = -1.9; x <= 1.9; x += 0.001) BARRIER = Math.max(BARRIER, g(x));

// Exact contours: for level L, y = ±√((L − g(x)) / 1.5) wherever g(x) ≤ L.
function contoursAt(L) {
  const loops = [];
  let segment = null;
  for (let x = -3.1; x <= 3.1001; x += 0.02) {
    if (g(x) <= L) {
      (segment ??= []).push(x);
    } else if (segment) {
      loops.push(segment);
      segment = null;
    }
  }
  if (segment) loops.push(segment);
  return loops.map((xs, i) => {
    const upper = xs.map((x) => ({ x, y: Math.sqrt(Math.max(0, (L - g(x)) / 1.5)) }));
    const lower = [...xs].reverse().map((x) => ({ x, y: -Math.sqrt(Math.max(0, (L - g(x)) / 1.5)) }));
    return { id: `L${L.toFixed(2).replace('.', '_')}_${i}`, label: i === 0 ? `loss = ${L.toFixed(2)}` : '', points: [...upper, ...lower, upper[0]] };
  });
}
const PASS_LEVEL = BARRIER + 0.01; // a hair above the ridge: the pinched waist renders as one curve
const LEVELS = [0.6, 0.9, 1.3, 1.6, PASS_LEVEL, 2.2, 3.0];
const ALL_RINGS = LEVELS.flatMap(contoursAt);
const AXES = { x: { label: 'w₁', min: -3.2, max: 3.2 }, y: { label: 'w₂', min: -1.7, max: 1.7 } };

// The optimizer paths, identical math to the 3D page.
const gradX = (x) => (4 * x * (x * x - 4)) / 22 + 0.25;
const gradY = (y) => 3 * y;
function descend(beta, lr, steps) {
  let x = 2.9;
  let y = 1.2;
  let vx = 0;
  let vy = 0;
  const path = [{ x, y }];
  for (let i = 0; i < steps; i++) {
    vx = beta * vx + gradX(x);
    vy = beta * vy + gradY(y);
    x -= lr * vx;
    y -= lr * vy;
    path.push({ x, y });
  }
  return path;
}
const GD = descend(0, 0.15, 30); // beta 0 = plain gradient descent
const MOM = descend(0.93, 0.04, 60);

function* readingMap() {
  yield {
    state: plotState({ axes: AXES, series: contoursAt(0.9).concat(contoursAt(2.2)) }),
    highlight: {},
    explanation: 'Take the two-basin terrain from The Loss Landscape, in 3D, rise straight above it, and slice it horizontally at fixed altitudes: every slice traces a closed curve on the floor — a CONTOUR. This plot shows two slices: a small ring at loss 0.90 (it fits only inside the deep left basin — the shallow basin\'s floor is 1.49, too high to be cut at 0.90) and one big ring at loss 2.20, high enough to enclose BOTH valleys at once. Hikers have read mountains this way for two centuries; ML simply borrowed the trick, because nobody can render a million-dimensional surface but anyone can plot its level sets.',
    invariant: 'A contour at level L is the set f(w) = L: everything inside a ring is lower than its label.',
  };

  yield {
    state: plotState({ axes: AXES, series: ALL_RINGS }),
    highlight: { active: [contoursAt(PASS_LEVEL)[0].id] },
    explanation: `The full map, seven levels (computed exactly — this surface's contours have a closed form). Read it like a topographer: TWO nested ring families = two basins, their innermost rings circling the two minima. Now find the highlighted curve — drawn a hair above the ridge height of ${BARRIER.toFixed(2)}: it pinches into a FIGURE-EIGHT waist, the two families all but kissing at one point (at exactly the ridge level they touch and split). That point is the mountain pass (the saddle from Loss Landscapes & Optimization Geometry), and its level tells you precisely what an optimizer must climb to escape the shallow basin: ${(BARRIER - 1.49).toFixed(2)} units of loss. One glance at where rings merge = the full escape topology.`,
    invariant: 'Ring families merge exactly at saddle level: the figure-eight marks the pass between basins.',
  };

  yield {
    state: plotState({ axes: AXES, series: ALL_RINGS }),
    highlight: { compare: [contoursAt(1.6)[0].id, contoursAt(2.2)[0].id] },
    explanation: 'Now read STEEPNESS, the skill that makes contour maps useful: ring SPACING is inverse slope. Tight-packed rings = cliff; widely spaced = plain. Look at any basin here: the rings crowd together along the vertical (w₂) direction and spread far apart horizontally (w₁) — this is the ravine signature, the 1.5·w₂² walls versus the gentle valley floor, exactly the terrain that tortures plain gradient descent in Momentum, RMSProp & Adam. Elongated rings ARE ill-conditioning: the more eccentric the ellipses, the worse one global learning rate fits all directions (the eccentricity is literally the spread of the Hessian\'s Eigenvalues & Eigenvectors).',
    invariant: 'Contour spacing encodes slope; contour eccentricity encodes conditioning.',
  };
}

function* pathsOnMap() {
  yield {
    state: plotState({
      axes: AXES,
      series: [...ALL_RINGS, { id: 'gd', label: 'gradient descent', points: GD }],
    }),
    highlight: { active: ['gd'] },
    explanation: 'Drop gradient descent onto the map (same run as the 3D page, lr = 0.15) and watch it interact with the rings: the path crosses every contour PERPENDICULARLY — the gradient is, by definition, the direction straight across the level lines — plunging through the tightly-packed vertical rings in a few strides, then crawling across the widely-spaced horizontal ones. Where the rings get sparse, the path\'s steps shrink with them. It comes to rest at the CENTER of the right-hand ring family: the shallow minimum, fenced in by the figure-eight it cannot cross.',
    invariant: 'Gradient descent crosses contours at right angles: the path is everywhere orthogonal to the rings.',
  };

  yield {
    state: plotState({
      axes: AXES,
      series: [...ALL_RINGS,
        { id: 'gd', label: 'gradient descent', points: GD },
        { id: 'mom', label: 'momentum (β = 0.93)', points: MOM }],
    }),
    highlight: { found: ['mom'], visited: ['gd'] },
    explanation: 'Add momentum\'s run and the map shows what the 3D flyover showed — but now MEASURABLY: the path bends THROUGH the pinch point of the figure-eight (you can read off exactly where it crossed and at what level), then spirals into the left family\'s center, overshooting and circling once before settling — the orbit of a heavy ball, drawn as a curl in the path. Notice momentum\'s path is NOT perpendicular to the rings: velocity carries history, so it cuts contours at an angle. The angle IS the memory, visible.',
    invariant: 'Momentum\'s path cuts contours at an angle: the deviation from perpendicular is stored velocity.',
  };

  yield {
    state: matrixState({
      title: 'Reading published loss-landscape figures: the checklist',
      rows: [
        { id: 'rings', label: 'nested ring families' },
        { id: 'pinch', label: 'rings that pinch/merge' },
        { id: 'spacing', label: 'tight vs sparse spacing' },
        { id: 'shape', label: 'circular vs elongated' },
        { id: 'path', label: 'path angle vs rings' },
      ],
      columns: [{ id: 'means', label: 'what it tells you' }],
      values: [[1], [2], [3], [4], [5]],
      format: (v) => ['', 'count of basins in view', 'saddle points and their heights', 'cliffs vs plains — where lr must shrink', 'conditioning — round = easy, eccentric = ravine', 'plain GD ⊥; momentum cuts at angles'][v],
    }),
    highlight: { active: ['shape:means'] },
    explanation: 'The decoder card, because you WILL meet these figures: every "visualizing the loss landscape" paper (Li et al. 2018\'s famous skip-connection plots), every TensorBoard projection, every optimizer-comparison blog draws exactly what this page taught you to read. The pairing to remember: The Loss Landscape, in 3D gives the intuition — you can SEE the valley — while the contour map gives the MEASUREMENT: exact saddle heights, conditioning ratios, crossing points. Researchers live on the flat version for the same reason pilots use instruments and not just the window. Now you fly with both.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'reading the map') yield* readingMap();
  else if (view === 'optimizer paths on the map') yield* pathsOnMap();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A contour map is the same two-basin loss terrain from "The Loss Landscape, in 3D" flattened from above and sliced horizontally into level sets. Every contour is a closed curve of constant loss. Nested ring families show basins; rings crowding together show steep slopes; rings pinching into a figure-eight mark the saddle point between basins. This is the view every published paper, TensorBoard, and textbook uses — contour maps are how you measure the loss landscape directly from the page.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A contour at level L is the set of all points where loss = L. On this surface, f(x, y) = (x² − 4)² / 22 + x / 4 + 1 + 1.5y², the two basins appear as nested ring families. At loss 0.90, only the left basin is enclosed; at loss 2.20, both families are circled by one ring. The seven exact levels (0.6, 0.9, 1.3, 1.6, barrier ≈ 1.727, 2.2, 3.0) are computed exactly: for level L, the contour is y = ±√((L − g(x)) / 1.5) wherever g(x) ≤ L.`,
        `Reading the map extracts three things: TOPOLOGY — nested ring families and where they merge (the figure-eight marks the saddle; its level is the exact escape cost 0.24). STEEPNESS — tight rings are cliffs; wide spacing is plains; here, rings crowd vertically (1.5y²) and spread horizontally (the ravine torturing "Gradient Descent"). CONDITIONING — round rings mean one learning rate works everywhere; eccentric rings mean the Hessian's "Eigenvalues & Eigenvectors" are spread out.`,
        `Optimizer paths interact measurably: gradient descent crosses contours perpendicularly (the gradient IS the steepest direction). Momentum, β = 0.93, cuts at an angle — the angle IS stored velocity — threading through the pinch point while gradient descent bounces off.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Computing exact contours is fast: for any level L and x, the y values come immediately from y = ±√((L − g(x)) / 1.5). Rendering is O(resolution), typically hundreds of points per contour, instant on screen. In real deep learning (millions of parameters), computing exact contours is impossible. Papers use heuristics: project onto a 2D plane (via random directions or Hessian eigenvectors), compute loss on a grid, draw contours numerically. Trade-off: lose exactness, gain scalability. This page uses the exact form as ground truth.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Li et al. (2018) used contours to show why skip connections flatten the landscape (rings become less eccentric). TensorBoard includes a live loss-landscape plugin. Researchers ask: Where are saddles? How eccentric are the contours (ill-conditioned)? Practitioners use contour shape to decide on optimizers: circular rings accept "Gradient Descent" with fixed learning rate; eccentric rings need "Momentum, RMSProp & Adam" to adapt per direction.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Tight rings do NOT mean the surface is bumpy — they mean the slope is steep; you are reading a projection from above. Another trap: a 2D contour map on a page is only a slice of the full high-dimensional landscape. Other basins and saddles may exist off-plane. The figure-eight at 1.727 marks the saddle on THIS slice only.`,
        `Do not use contour geometry alone to predict convergence: learning rate, momentum, and batching effects all matter. Use contours for intuition, not exact prediction.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Return to "The Loss Landscape, in 3D" for 3D intuition. Study "Loss Landscapes & Optimization Geometry" for saddle points and the Hessian. Read "Momentum, RMSProp & Adam" to understand why paths bend at angles. Explore "Eigenvalues & Eigenvectors" to see why eccentric rings signal conditioning problems. Master "Gradient Descent" for why the gradient is orthogonal to level sets. Together, these let you decode any published loss-landscape figure like a topographer.`,
      ],
    },
  ],
};

