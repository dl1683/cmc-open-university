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

const X_AXIS = { min: -3.1, max: 3.1, label: 'w₁' };
const Y_AXIS = { min: -1.5, max: 1.5, label: 'w₂' };
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
    explanation: 'This is the terrain Loss Landscapes & Optimization Geometry could only show you in slices — now a real surface, rendered in WebGL, slowly orbiting so your eyes can read it. Blue is low, red is high. Two valleys: a DEEP one on the left (loss 0.49) and a SHALLOW one on the right (1.48), separated by a ridge, with steep ravine walls rising in the w₂ direction. The white sphere marks where initialization dropped our model: high on the right wall. Every number here is computed live from f(w₁, w₂) = (w₁²−4)²/22 + w₁/4 + 1 + 1.5·w₂² — nothing is staged.',
  };

  yield {
    state: surface({
      paths: [{ id: 'gd', label: 'gradient descent', points: GD.slice(0, 9) }],
      markers: [START, DEEP, SHALLOW],
    }),
    highlight: { active: ['gd'] },
    explanation: 'Release plain Gradient Descent (computed live, lr = 0.15) and watch its first eight steps in three dimensions: it plunges DOWN the steep w₂ wall almost vertically — the gradient points where the slope is steepest, and the ravine wall dwarfs everything — then bends and begins creeping along the gentle valley floor. The zigzag-then-crawl behavior from Momentum, RMSProp & Adam\'s flat plots is suddenly physical: you can SEE why one learning rate cannot serve both the cliff and the floor.',
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
    explanation: 'The finish: two optimizers, two fates, one geometry. Gradient descent rests at 1.48; momentum rests at 0.49 — a 3× better model from the identical start, bought entirely by velocity. And one more thing the orbit lets you see: compare the VALLEYS themselves. The deep basin is also the WIDER one — a fat, forgiving bowl — while the shallow one is narrower; Loss Landscapes & Optimization Geometry\'s sharp-versus-flat story is sitting right there in the curvature. Real networks live in millions of dimensions where no one can look — but every intuition you just built by watching holds there, which is exactly why this surface earns its three dimensions.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A loss landscape is the multidimensional surface created by plotting every possible combination of a model's weights against its training loss. In most machine learning, you live in millions of dimensions and cannot see the terrain you are optimizing over; this page shows you a faithful 2-parameter slice: f(w₁, w₂) = (w₁²−4)²/22 + w₁/4 + 1 + 1.5w₂² rendered in true 3D with WebGL. The visualization is not a toy — the shape, the basins, the ridges, and the initialization trap are all real phenomena that happen at scale. Two valleys sit before you: a deep minimum at loss 0.49 and a shallow one at loss 1.48, separated by a ridge. Every training run is a path through this terrain, and the path you take depends on your optimizer, learning rate, and starting point.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The terrain is generated by f(w₁, w₂), with blue showing low loss and red showing high. Gradient descent starts at (2.9, 1.2) and computes the steepest downhill direction 30 times. The gradient is perpendicular to the contour lines; on the ravine wall it points almost vertically down, then gently toward the shallow minimum on the valley floor — where it settles, trapped. Momentum is different: it accumulates velocity (β = 0.93), rolling downhill like a marble with mass. That accumulated speed crashes through the shallow basin and vaults the ridge, reaching the deep basin in 60 steps. The orbiting view reveals curvature: the deep basin is wide and forgiving, the shallow one is narrow — showing why momentum escapes and why the deep basin is more stable.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Computing this surface is free: one formula per point in microseconds. In real training, you compute only the gradient at your current position (O(1) per parameter), never the full landscape. The cost is exploration: 30 steps for gradient descent, 60 for momentum. Higher-dimensional landscapes are richer: tame in 2D, they may sprout many valleys and ridges or collapse to simpler structures when you add parameters. Real networks are so high-dimensional that saddle points (basins in one direction, ridges in another) become common. The 2D intuition is vital but incomplete without the stabilizing effect of momentum or adaptive learning rates.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Real networks trained on CIFAR-10 or ImageNet show wider minima at lower loss ("flat minima"), while memorizing random labels creates sharp, narrow minima. Flat minima generalize better because they are less sensitive to weight perturbation. This motivated SAM (Sharpness Aware Minimization), which penalizes sharp curvature during training. Practitioners visualize the landscape to debug: stuck at a valley? Look at the curvature. Learning rate schedules are tuned by landscape geometry: steep curves need smaller steps, flat regions handle larger ones. Loss spikes occur when learning rate schedules drop — the optimizer gains agility and may escape shallow minima. Small batch sizes spend more time in sharp minima, hurting generalization; larger batches explore flatter regions, which is why batch size matters.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `A beautiful 2D visualization does not predict high dimensions. This surface has two parameters; real networks have millions. The "downhill only" trap here breaks in high dimensions with saddle points (Vanishing & Exploding Gradients). Do not conflate loss landscape with decision boundary — the landscape shows loss, not how boundaries generalize. A loss of 0.49 versus 1.48 is significant, but real landscapes have plateaus and cliffs the 2D slice misses. This visualization uses fixed learning rate and momentum; real training uses schedules and adaptive methods (Momentum, RMSProp & Adam) that reshape the effective landscape. Initialization looks simple here but is subtle in high dimensions: the curse of dimensionality means distant starting points lead to wildly different losses. The intuition is right — initialization is destiny — but the mechanism is richer than one trapped valley.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Gradient Descent is the core: the path here visualizes stepping opposite the gradient to descend. Loss Landscapes & Optimization Geometry covers the theory of basins and curvature. Momentum, RMSProp & Adam shows how velocity and adaptive rates reshape paths through the landscape. Learning-Rate Schedules & Warmup explores how scheduling adapts to terrain. Vanishing & Exploding Gradients explains why gradients vanish in deep networks, flattening the landscape and trapping optimization.`,
      ],
    },
  ],
};

