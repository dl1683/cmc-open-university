// The loss landscape in TRUE 3D: a real two-basin surface rendered with
// WebGL, with gradient descent and momentum computed live and draped over
// the terrain. Watch one optimizer get trapped and the other vault the ridge.

import { surface3dState, InputError } from '../core/state.js';

export const topic = {
  id: 'loss-surface-3d',
  title: 'The Loss Landscape, in 3D',
  category: 'AI & ML',
  summary: 'A real two-basin surface in WebGL: gradient descent gets trapped, momentum vaults the ridge — computed live, draped in 3D.',
  controls: [
    { id: 'view', label: 'Descend', type: 'select', options: ['watch the optimizers race'], defaultValue: 'watch the optimizers race' },
  ],
  run,
};

// The terrain: a double well along x (left basin deeper) with parabolic
// walls in y — a ravine feeding two valleys of unequal depth.
const D = 22;
const f = (x, y) => ((x * x - 4) ** 2) / D + x / 4 + 1 + 1.5 * y * y;
const gradX = (x) => (4 * x * (x * x - 4)) / D + 0.25;
const gradY = (y) => 3 * y;

const X_AXIS = { min: -3.1, max: 3.1, label: 'wâ‚' };
const Y_AXIS = { min: -1.5, max: 1.5, label: 'wâ‚‚' };
const RES = 36;
const HEIGHTS = Array.from({ length: RES }, (_, r) => {
  const y = Y_AXIS.min + (r / (RES - 1)) * (Y_AXIS.max - Y_AXIS.min);
  return Array.from({ length: RES }, (_, c) => {
    const x = X_AXIS.min + (c / (RES - 1)) * (X_AXIS.max - X_AXIS.min);
    return f(x, y);
  });
});

function descendGD(lr, steps) {
  let x = 2.9;
  let y = 1.2;
  const path = [{ x, y, z: f(x, y) }];
  for (let i = 0; i < steps; i++) {
    x -= lr * gradX(x);
    y -= lr * gradY(y);
    path.push({ x, y, z: f(x, y) });
  }
  return path;
}
function descendMomentum(lr, beta, steps) {
  let x = 2.9;
  let y = 1.2;
  let vx = 0;
  let vy = 0;
  const path = [{ x, y, z: f(x, y) }];
  for (let i = 0; i < steps; i++) {
    vx = beta * vx + gradX(x);
    vy = beta * vy + gradY(y);
    x -= lr * vx;
    y -= lr * vy;
    path.push({ x, y, z: f(x, y) });
  }
  return path;
}
const GD = descendGD(0.15, 30);
const MOM = descendMomentum(0.04, 0.93, 60);

const surface = ({ paths = [], markers = [] }) =>
  surface3dState({ axes: { x: X_AXIS, y: Y_AXIS, z: { label: 'loss' } }, heights: HEIGHTS, paths, markers });

const START = { id: 'start', x: 2.9, y: 1.2, z: f(2.9, 1.2), label: 'start' };
const DEEP = { id: 'deep', x: -2.04, y: 0, z: f(-2.04, 0), label: 'deep minimum' };
const SHALLOW = { id: 'shallow', x: 1.93, y: 0, z: f(1.93, 0), label: 'shallow minimum' };

export function* run(input) {
  if (String(input.view) !== 'watch the optimizers race') throw new InputError('Pick a view.');

  yield {
    state: surface({ markers: [START, DEEP, SHALLOW] }),
    highlight: { active: ['start'] },
    explanation: 'This is the terrain Loss Landscapes & Optimization Geometry could only show you in slices — now a real surface, rendered in WebGL, slowly orbiting so your eyes can read it. Blue is low, red is high. Two valleys: a DEEP one on the left (loss 0.49) and a SHALLOW one on the right (1.48), separated by a ridge, with steep ravine walls rising in the wâ‚‚ direction. The white sphere marks where initialization dropped our model: high on the right wall. Every number here is computed live from f(wâ‚, wâ‚‚) = (wâ‚²âˆ’4)²/22 + wâ‚/4 + 1 + 1.5Â·wâ‚‚² — nothing is staged.',
  };

  yield {
    state: surface({
      paths: [{ id: 'gd', label: 'gradient descent', points: GD.slice(0, 9) }],
      markers: [START, DEEP, SHALLOW],
    }),
    highlight: { active: ['gd'] },
    explanation: 'Release plain Gradient Descent (computed live, lr = 0.15) and watch its first eight steps in three dimensions: it plunges DOWN the steep wâ‚‚ wall almost vertically — the gradient points where the slope is steepest, and the ravine wall dwarfs everything — then bends and begins creeping along the gentle valley floor. The zigzag-then-crawl behavior from Momentum, RMSProp & Adam\'s flat plots is suddenly physical: you can SEE why one learning rate cannot serve both the cliff and the floor.',
    invariant: 'The gradient is perpendicular to the contour lines: steep walls dominate the step direction.',
  };

  yield {
    state: surface({
      paths: [{ id: 'gd', label: 'gradient descent', points: GD }],
      markers: [START, DEEP, SHALLOW],
    }),
    highlight: { compare: ['gd'], found: ['shallow'] },
    explanation: `Thirty steps and gradient descent has settled — in the WRONG valley. It rests at the shallow minimum (loss ${f(1.93, 0).toFixed(2)}) while the deep one (loss ${f(-2.04, 0).toFixed(2)}) sits across the ridge, visibly better and utterly unreachable: pure gradient descent never climbs, and from this start every downhill path leads here. In 3D the unfairness is vivid — the better valley is RIGHT THERE. Initialization is destiny, exactly as Loss Landscapes & Optimization Geometry warned, except now you can stand on the ridge and look down both sides.`,
  };

  yield {
    state: surface({
      paths: [
        { id: 'gd', label: 'gradient descent', points: GD },
        { id: 'mom', label: 'momentum (β = 0.93)', points: MOM },
      ],
      markers: [START, DEEP, SHALLOW],
    }),
    highlight: { active: ['mom'], visited: ['gd'] },
    explanation: 'Same start, same surface — now with MOMENTUM (β = 0.93, computed live). Watch its path: it dives down the wall, gathers speed along the valley floor like a marble with mass, reaches the ridge that stopped gradient descent cold… and ROLLS OVER IT, coasting into the deep basin on accumulated velocity. This is the heavy-ball physics from Momentum, RMSProp & Adam given its true body: momentum is not just zigzag-damping — stored kinetic energy lets an optimizer climb short hills that pure gradients never could, escaping mediocre valleys for better ones.',
    invariant: 'Momentum integrates velocity: enough accumulated speed converts a downhill history into uphill range.',
  };

  yield {
    state: surface({
      paths: [
        { id: 'gd', label: 'gradient descent', points: GD },
        { id: 'mom', label: 'momentum', points: MOM },
      ],
      markers: [START, DEEP, SHALLOW],
    }),
    highlight: { found: ['deep'], compare: ['shallow'] },
    explanation: 'The finish: two optimizers, two fates, one geometry. Gradient descent rests at 1.48; momentum rests at 0.49 — a 3Ã— better model from the identical start, bought entirely by velocity. And one more thing the orbit lets you see: compare the VALLEYS themselves. The deep basin is also the WIDER one — a fat, forgiving bowl — while the shallow one is narrower; Loss Landscapes & Optimization Geometry\'s sharp-versus-flat story is sitting right there in the curvature. Real networks live in millions of dimensions where no one can look — but every intuition you just built by watching holds there, which is exactly why this surface earns its three dimensions.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for The Loss Landscape, in 3D. A real two-basin surface in WebGL: gradient descent gets trapped, momentum vaults the ridge — computed live, draped in 3D..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: `Why a 3D loss surface matters`,
      paragraphs: [
        `A loss surface turns optimization into terrain. The horizontal axes are parameters, and the vertical axis is loss. In real machine learning there may be millions or billions of parameters, so the full surface cannot be drawn. This page chooses two parameters and renders a real surface in 3D so the geometry becomes visible: two valleys, a ridge between them, steep walls in one direction, and a starting point that sends different optimizers to different endings.`,
        `The topic exists because loss curves hide too much. A training chart tells you whether loss went down, but not why the optimizer moved the way it did. A 3D surface shows the missing cause. It makes the phrase "stuck in a basin" literal. It shows why one learning rate can be too large for a steep wall and too small for a flat floor. It also shows why momentum can do something plain gradient descent cannot do: carry motion through a short uphill region after a long downhill run.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The naive story says gradient descent should follow the steepest downhill direction until it finds a good minimum. That is true only locally. The gradient at one point knows the slope immediately around that point. It does not know that a better valley exists across a ridge. If every legal step is chosen by the current local downhill direction, the optimizer can settle in the first basin that captures it, even when a lower basin is visible to us from outside the problem.`,
        `On this surface, plain gradient descent starts high on the right wall. Its first steps are dominated by the steep y direction, so it drops quickly into the ravine. Once it reaches the floor, the slope becomes gentler, and the path bends toward the shallow right basin. From there, moving toward the deeper left basin would require climbing. Plain gradient descent has no stored motion and no reason to go uphill, so it stops in the shallow minimum. The algorithm has not made a mistake by its own rules. The rules are local.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is that optimization is path-dependent. The final model is not determined only by the lowest point on the surface. It is determined by the starting point, the geometry around the path, the step rule, and the optimizer\'s memory. Two optimizers can see the same gradients at the same locations and still behave differently if one carries velocity from previous gradients.`,
        `Momentum adds memory. It keeps a running velocity, usually an exponentially decayed sum of recent gradients. When the path has been descending for several steps, velocity accumulates in that direction. If the surface briefly tilts uphill, the velocity can carry the optimizer across, much like a ball rolling over a small rise. Momentum does not know where the deep basin is. It simply changes the dynamics from "move only by current slope" to "move by current slope plus recent motion." On this surface, that difference is enough to cross the ridge.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The surface is computed from one explicit two-parameter function. The x axis is one weight, the y axis is another, and the height is the loss value. The function creates a double well along x, makes the left basin lower than the right basin, and adds steep parabolic walls along y. The renderer samples that formula over a grid and draws the resulting terrain with low-loss regions colored differently from high-loss regions.`,
        `The optimizer paths are computed from the same formula, not staged by hand. Gradient descent repeatedly subtracts the learning rate times the gradient. Momentum updates a velocity term and subtracts the learning rate times that velocity. The two paths start from the same point. Plain gradient descent uses a larger direct step and settles in the shallow basin after thirty steps. Momentum uses a smaller learning rate, a high momentum coefficient, and more steps, but the stored velocity sends it over the ridge into the deeper basin. The comparison isolates optimizer dynamics because the surface and initialization are identical.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The visual proves three separate points. First, local descent is not global search. The better valley is visible to us because we see the whole surface, but the optimizer only receives local gradients. Second, ravines create conflicting step-size needs. A step size that is safe on a steep wall may be painfully slow on the valley floor, while a step size that moves quickly on the floor may bounce or diverge on the wall. Third, optimizer state changes reachable solutions. Momentum reaches a basin that plain descent does not reach from the same start.`,
        `The 3D orbit also proves why curvature matters. The shallow basin and deep basin are not just different heights. They have different shapes. Wide basins tolerate small weight perturbations; narrow basins punish them. In real training, this is connected to the flat-minimum generalization story, although the demo should not be overread as a full neural-network landscape. It is a controlled slice that makes the geometry physical enough to reason about.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Drawing a surface requires evaluating many grid points, which is cheap here because the formula is tiny. For a real model, every grid point may require a full forward pass over a dataset or validation batch. That makes landscape visualization a research and debugging tool, not something used inside every training step. Real optimizers compute the gradient only at the current parameter vector. They do not map the full terrain before moving.`,
        `Momentum has its own costs. It stores extra state for every parameter and adds another hyperparameter, the momentum coefficient. Too little momentum behaves like plain descent. Too much can overshoot useful basins, oscillate, or amplify instability when the learning rate is high. Adaptive methods such as RMSProp and Adam add more state and scale updates by recent gradient magnitudes. They can move better through ravines but may choose different minima and require careful learning-rate schedules. The right optimizer is a tradeoff among speed, stability, memory, and generalization.`,
      ],
    },
    {
      heading: `Real uses and limits`,
      paragraphs: [
        `Practitioners use loss-surface thinking to debug training runs. A long flat loss curve may indicate a plateau or saddle rather than a finished model. A run that diverges after a few steps may be hitting steep curvature with an excessive learning rate. A model that trains well but generalizes poorly may have landed in a sharp region that is sensitive to small data or weight changes. These diagnoses affect concrete choices: learning-rate warmup, momentum, batch size, weight decay, gradient clipping, and sharpness-aware methods.`,
        `The same thinking helps when two runs have the same final validation score. The run with smoother loss, lower sensitivity to small weight perturbations, and less seed-to-seed variance is often the more reliable deployment candidate. A team may not render a surface every time, but it can still test the geometry indirectly by perturbing weights, checking gradient norms, comparing restarts, and watching whether a small learning-rate change breaks training. Those checks are practical shadows of the surface shown here.`,
        `The limit is dimensionality. A two-parameter surface is a slice, not the full object. In high dimensions, a barrier in one slice may be avoidable by moving along another direction. Many critical points are saddles rather than true local minima. Overparameterized networks often have connected low-loss regions that no 2D drawing can show. The right lesson is not that every model has exactly two valleys. The lesson is that optimizer behavior depends on geometry, and geometry is richer than a scalar loss curve.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study gradient descent to understand the local step rule. Study momentum, RMSProp, and Adam to see how optimizer state changes the path. Study loss landscapes and optimization geometry for basins, saddles, ravines, and flat minima. Study learning-rate schedules to understand why a good step size changes during training. Study vanishing and exploding gradients to connect the visible terrain here with the backward signal that deep networks must preserve before an optimizer can use the slope at all.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Measure prediction error with a single number: the loss. MSE (Mean Squared Error): L = (1/n)Σ(yᵢ - ŷᵢ)². Penalizes large errors quadratically — a prediction off by 10 costs 100×, not 10×. Good for regression where outlier errors matter.',
        'Cross-entropy: L = -(1/n)Σ[yᵢ·log(ŷᵢ) + (1-yᵢ)·log(1-ŷᵢ)]. The standard classification loss. When the true label is 1 and model predicts 0.01: loss = -log(0.01) = 4.6 (harsh). Predicts 0.99: loss = -log(0.99) = 0.01 (gentle). Cross-entropy pushes confident wrong predictions hard, leaves confident correct ones alone.',
        'The loss surface: plot loss as a function of all parameters. For 2 parameters: a 3D landscape with valleys, ridges, saddle points. For GPT-4 (~1.8T parameters): a surface in 1.8-trillion-dimensional space. Gradient descent walks downhill on this surface. Local minima, saddle points, and flat regions are obstacles. Li et al. 2018 showed: ResNets have smoother loss surfaces than plain networks — skip connections literally flatten the landscape.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Li et al. 2018 (Visualizing the Loss Landscape of Neural Nets — the famous landscape plots). Goodfellow et al. 2015 (Qualitatively Characterizing Neural Network Optimization Problems — early landscape analysis).',
        'Study next: Gradient Descent (navigating the loss surface), Adam Optimizer (adaptive navigation), Learning Rate Schedules (controlling step size on the surface), Cross-Entropy (the classification loss function), Regularization (reshaping the loss surface).',
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        'Linear regression: y = wx + b. Data: (1,2), (2,4), (3,6). True w=2, b=0. Loss surface: L(w,b) = (1/3)[(2-w-b)² + (4-2w-b)² + (6-3w-b)²]. At w=2, b=0: L=0 (global minimum). At w=1, b=1: L = (1/3)[(2-2)² + (4-3)² + (6-4)²] = (0+1+4)/3 = 1.67. At w=3, b=-1: L = (1/3)[(2-2)² + (4-5)² + (6-8)²] = (0+1+4)/3 = 1.67. The surface is a paraboloid (bowl) — convex, single minimum.',
        'Gradient at (w=1, b=1): ∂L/∂w = (1/3)[2(-1)(1) + 2(-1)(2) + 2(-2)(3)] = -12.67. Points toward w=2: downhill. Neural networks: non-convex loss surfaces with many local minima. But empirically, most local minima have similar loss values (Choromanska et al. 2015) — finding ANY local minimum usually works.',
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Saddle points: in high dimensions, saddle points are exponentially more common than local minima. A saddle point: loss is a minimum along some directions and a maximum along others. Like sitting on a horse saddle — you are at the bottom front-to-back but at the top left-to-right. L(x,y) = x² - y². Point (0,0): ∂L/∂x = 0, ∂L/∂y = 0. It is a critical point. But it is not a minimum — descend along y. SGD escapes saddle points naturally (the noise from mini-batches provides random perturbation). Adam/momentum help too — they accumulate velocity and roll through saddles.',
        'Loss surface visualization trick (Li et al. 2018): pick two random directions in parameter space. Project the loss onto this 2D plane. Plot as a heatmap or 3D surface. ResNet-56: smooth bowl. Plain-56 (no skip connections): chaotic, with sharp barriers.',
      ],
    },
],
};

