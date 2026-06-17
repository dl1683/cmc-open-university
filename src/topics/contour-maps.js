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
      heading: `Why contour maps exist`,
      paragraphs: [
        `A loss landscape is easy to imagine and hard to inspect. In two parameters you can draw a surface, point to a valley, and say that an optimizer rolls downhill. In real models there may be millions or billions of parameters, so the surface is too large to see directly. Even in a two-parameter teaching example, a 3D view hides some facts behind camera angle and perspective. A contour map solves the inspection problem by looking straight down at the surface and drawing the sets of equal loss.`,
        `The result is the same idea used in topographic maps. A contour labeled 1.3 is the set of parameter values whose loss is exactly 1.3. Cross the line and the loss changes. Stay on the line and the loss stays constant. The map loses height as a literal vertical dimension, but it gains precision: basin count, saddle height, slope, valley shape, and optimizer motion can all be read from a flat page.`,
      ],
    },
    {
      heading: `The naive view and its limit`,
      paragraphs: [
        `The naive way to understand optimization geometry is to draw the surface in 3D and watch the height. That works for first intuition. You can see that one point is lower than another, that a valley is narrow, and that a ridge separates two basins. The problem is that the camera changes the story. A steep wall can look gentle from the wrong angle. A saddle can be hidden behind a ridge. A path that appears smooth may actually be zigzagging through tightly packed level sets.`,
        `A second naive approach is to print losses along an optimizer trajectory. That tells you whether loss went down, but it removes the surrounding geometry. You no longer know whether the optimizer followed the valley floor, bounced across a ravine, or stopped in a shallow basin while a deeper one sat nearby. Contour maps keep the optimizer path and the landscape in the same coordinate system, so each step can be interpreted against the terrain it crossed.`,
      ],
    },
    {
      heading: `Core insight: level sets and rings`,
      paragraphs: [
        `Formally, a contour at level L is the set of all points w where f(w) = L. In this module the surface is two-dimensional, so those sets are curves. For the displayed function, f(x, y) = (x^2 - 4)^2 / 22 + x / 4 + 1 + 1.5y^2, the y direction is quadratic and the x direction has two wells. At a low level, a contour exists only around the deeper basin. At a higher level, each basin has its own ring family. Raise the level far enough and the families merge into one outer curve.`,
        `Nested rings mean a basin because moving inward crosses contours of decreasing loss. The center of a ring family is a local minimum. Separate ring families mean separate attraction basins in the displayed slice. A contour that pinches into a figure eight marks the level where two basins connect. In terrain language that pinch is a pass. In optimization language it is a saddle: downhill in one direction, uphill in another, and decisive for whether an optimizer can escape one basin and enter the other.`,
      ],
    },
    {
      heading: `Steepness and conditioning`,
      paragraphs: [
        `Contour spacing is slope information. If two contours with nearby loss values are close together on the page, the surface must change height quickly over a short horizontal distance. That is a steep region. If the same loss gap requires a long walk across the page, the surface is flat in that direction. Tight rings do not mean the map is more detailed there; they mean the loss rises or falls quickly there.`,
        `Shape matters as much as spacing. Round contours near a minimum mean the curvature is similar in all directions, so one learning rate can make reasonable progress in every direction. Long, thin contours mean the valley is ill-conditioned. The optimizer sees a steep wall in one direction and a shallow floor in another. A learning rate large enough to move along the floor may overshoot across the wall; a learning rate safe for the wall may crawl along the floor. This is the geometric reason ravines are painful for plain gradient descent.`,
      ],
    },
    {
      heading: `Optimizer paths on contours`,
      paragraphs: [
        `A path drawn on a contour map is more informative than a loss curve alone. Plain gradient descent moves in the negative gradient direction. The gradient is perpendicular to a level set, so gradient descent crosses contours at right angles in the ideal continuous picture. If the path repeatedly cuts back and forth across a narrow valley, the map shows why progress is slow: the method is spending steps correcting motion across steep walls instead of advancing along the flat direction.`,
        `Momentum changes the geometry of the path. The update is no longer only the current gradient; it includes stored velocity from previous gradients. On a contour map that memory appears as a path that cuts contours at an angle instead of crossing them exactly at right angles. That is not a drawing artifact. The angle records history. In the displayed two-basin landscape, momentum can carry the iterate through the pinched pass that plain gradient descent fails to cross, then overshoot and spiral before settling.`,
      ],
    },
    {
      heading: `The exact example`,
      paragraphs: [
        `This topic uses a surface simple enough to compute exactly and rich enough to show real optimization behavior. Write g(x) = (x^2 - 4)^2 / 22 + x / 4 + 1. Then f(x, y) = g(x) + 1.5y^2. For a fixed contour level L, the possible y values satisfy y = plus or minus sqrt((L - g(x)) / 1.5), wherever g(x) <= L. That closed form lets the module draw exact contours instead of sampling a grid and guessing where the lines should be.`,
        `The two wells are not equal. The x / 4 term tilts the surface, so one basin is deeper than the other. The ridge between them has a specific height, found numerically from the x-axis spine. Just above that height, the contour pinches into the figure-eight shape. That level is not merely pretty; it estimates the escape cost from the shallow basin in this slice. If an optimizer cannot acquire enough energy or update direction to cross that pass, it remains trapped in the local basin even though a lower one exists nearby.`,
      ],
    },
    {
      heading: `How papers use contour maps`,
      paragraphs: [
        `Loss-landscape papers use contour plots because a flat figure can compare many models or optimizers without camera tricks. A common method is to choose two directions in parameter space, evaluate the loss on a grid around a trained model, and draw contours through the resulting values. The directions might be random, chosen from principal directions, or normalized to account for filter scale. The plot is a slice, not the whole landscape, but it can still reveal whether one architecture produces sharper basins, flatter valleys, or more connected low-loss regions than another.`,
        `Practitioners use the same reading skills when comparing optimizers. If two methods reach similar final loss but one path crosses many tight contours while the other follows the valley more directly, the map explains the difference in stability. If a schedule lowers the learning rate and the path suddenly stops bouncing across rings, the contour plot makes the reason visible. The value is not prediction down to the exact step. The value is diagnosis: what kind of geometry is the optimizer fighting?`,
      ],
    },
    {
      heading: `Where the map can mislead`,
      paragraphs: [
        `The largest trap is forgetting that a two-dimensional plot is a slice through a higher-dimensional object. A saddle visible in the slice may not be the easiest escape route in the full space. A basin that looks isolated in two directions may connect to another basin through a direction not shown. A flat-looking region may be flat only along the chosen plane and sharp along many omitted directions. Contour maps are instruments, not proofs of global geometry.`,
        `Projection choices also matter. If the plotted directions are poorly chosen, important curvature can disappear. If axes are scaled badly, an ordinary valley can look extreme or an extreme valley can look harmless. If loss is evaluated without matching the training setup, stochastic layers, batch normalization, or data preprocessing can create artifacts. A good contour figure states how the plane was chosen, how the loss was evaluated, and whether the same scale is used across comparisons.`,
      ],
    },
    {
      heading: `Cost and scale`,
      paragraphs: [
        `For this analytic surface, drawing contours is cheap. Each contour level can be computed directly, and rendering hundreds of points per curve is trivial. Real neural networks are different. To draw a contour plot around a model, a researcher usually evaluates the model on a grid of parameter perturbations. A 51 by 51 grid already requires 2,601 forward evaluations of the validation or training loss. If the model or dataset is large, that is a real compute bill.`,
        `The computational cost is why contour maps are mostly diagnostic rather than routine production tooling. They are valuable when studying an optimizer, explaining a failure, or supporting a research claim. They are less useful for everyday model selection, where scalar validation metrics, calibration checks, and ablation studies usually matter more. The map earns its cost when geometry is the question.`,
      ],
    },
    {
      heading: `What to study next`,
      paragraphs: [
        `Study Gradient Descent for the reason gradients are perpendicular to level sets. Study Momentum, RMSProp & Adam for the update rules that bend paths away from pure perpendicular crossings. Study Eigenvalues & Eigenvectors and the Hessian to connect elongated rings with curvature and conditioning. Study Loss Landscapes & Optimization Geometry for saddles, barriers, and basin connectivity. Return to the 3D loss landscape when you need physical intuition, then use contour maps when you need measurements that survive the camera angle.`,
      ],
    },
  ],
};
