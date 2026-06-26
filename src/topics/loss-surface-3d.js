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
    {heading: 'How to read the animation', paragraphs: ['Read the surface as a two-parameter loss function. Height is loss, horizontal position is the parameter pair, and each path is computed by an optimizer rule.', {type: 'callout', text: 'The 3D surface is a controlled slice: it teaches why local slope, basin shape, and optimizer memory can decide different endings.'}, 'Plain gradient descent follows local slope into one basin. Momentum carries velocity from previous slopes and can cross a ridge that local descent alone will not cross.', {type: 'image', src: './assets/gifs/loss-surface-3d.gif', alt: 'Animated walkthrough of the loss surface 3d visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    {heading: 'Why this exists', paragraphs: ['A loss surface makes optimization visible. Real models have too many dimensions to draw, so this topic uses two parameters to show basins, ridges, and paths directly.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/32/Rosenbrock_function.svg', alt: 'Rosenbrock function surface with a curved optimization valley', caption: 'A classic optimization surface makes the same lesson visible: the route through curvature can dominate the simple height story. Source: Wikimedia Commons, Oleg Alexandrov, public domain.'}, 'The route matters because two optimizers can start at the same point and land in different basins. A falling loss curve alone does not explain why that happened.']},
    {heading: 'The obvious approach', paragraphs: ['The obvious story says gradient descent rolls downhill until it finds a minimum. Each step subtracts learning rate times gradient, so the move uses only local slope.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Gradient_descent.svg/250px-Gradient_descent.svg.png', alt: 'Gradient descent path moving across contour lines', caption: 'The contour view shows the local rule: move against the current gradient and hope that local descent reaches a useful basin. Source: Wikimedia Commons, Gradient descent illustration.'}, 'That rule is local, not global. It cannot see a lower valley across a ridge, so it may stop in the first basin that captures the path.']},
    {heading: 'The wall', paragraphs: ['The wall is path dependence. A lower basin can be nearby, but reaching it may require a short uphill move that plain gradient descent will not choose.', 'Ravines create another wall. A rate safe for a steep wall may crawl on the floor, while a rate that moves well on the floor may bounce on the wall.']},
    {heading: 'The core insight', paragraphs: ['Optimizer state changes reachability. Momentum stores velocity, a memory of recent gradients, and combines current slope with stored motion.', 'Momentum has no map of the better basin. It crosses the ridge here because earlier downhill movement built enough velocity to survive a short uphill region.']},
    {heading: 'How it works', paragraphs: ['The surface is sampled from an explicit function of x and y. It creates two wells along x, makes the left well lower, and adds steep curvature along y.', 'Gradient descent subtracts learning rate times gradient. Momentum updates velocity first, then moves by that velocity, so the path can keep moving when the newest gradient resists it.']},
    {heading: 'Why it works', paragraphs: ['The comparison is controlled because both paths use the same surface and starting point. The changed ingredient is the optimizer update rule.', 'Plain descent stops in the shallow basin because later local downhill directions point into it. Momentum reaches the deeper basin because velocity changes the step from current slope alone to current slope plus recent motion.']},
    {heading: 'Cost and complexity', paragraphs: ['Drawing this surface is cheap because the formula is tiny. For a real model, a 40 by 40 grid can mean 1,600 extra evaluations over data.', 'Momentum costs one velocity value per parameter and one coefficient to tune. Too much momentum or too high a rate can overshoot, oscillate, or destabilize training.']},
    {heading: 'Real-world uses', paragraphs: ['This picture maps to training diagnostics. Loss spikes suggest sharp curvature or large steps, long plateaus suggest flat regions or saddles, and seed variation suggests path-sensitive basins.', 'Teams test the same geometry indirectly by perturbing checkpoints, comparing restarts, tracking gradient norms, and changing schedules or momentum to see whether the failure moves.']},
    {heading: 'Where it fails', paragraphs: ['The picture is a slice, not a full neural-network landscape. In high dimensions, an apparent barrier in two dimensions may be avoidable through another coordinate.', 'Momentum is not always better. It can cross useful ridges, but it can also skip good basins or amplify instability when the learning rate is too high.']},
    {heading: 'Worked example', paragraphs: ['On the y = 0 slice, the demo function gives loss about 1.48 near x = 1.93 and about 0.49 near x = -2.04. The left basin is lower, but a start near x = 2.9 falls first toward the right basin.', 'Plain descent settles there because crossing toward x = 0 requires climbing a ridge. Momentum can keep moving left after earlier downhill steps build velocity, so the same start can reach the lower basin.']},
    {heading: 'Sources and study next', paragraphs: ['Study gradient descent for the local rule and momentum for velocity. Read Li et al. 2018 and Goodfellow et al. 2014, then study learning-rate schedules, Adam, Hessian curvature, and loss landscapes.']},
  ],
};
