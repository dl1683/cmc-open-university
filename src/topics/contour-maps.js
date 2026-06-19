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

// The exact surface from the 3D page: f(x,y) = (x²âˆ’4)²/22 + x/4 + 1 + 1.5y².
const g = (x) => ((x * x - 4) ** 2) / 22 + x / 4 + 1; // the y = 0 spine
// The pass is the MAXIMUM of g between the two minima (the x/4 tilt pushes
// the crest right of zero) — found numerically, not assumed.
let BARRIER = -Infinity;
for (let x = -1.9; x <= 1.9; x += 0.001) BARRIER = Math.max(BARRIER, g(x));

// Exact contours: for level L, y = ±âˆš((L âˆ’ g(x)) / 1.5) wherever g(x) â‰¤ L.
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
const AXES = { x: { label: 'wâ‚', min: -3.2, max: 3.2 }, y: { label: 'wâ‚‚', min: -1.7, max: 1.7 } };

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
    explanation: `The full map, seven levels (computed exactly — this surface\'s contours have a closed form). Read it like a topographer: TWO nested ring families = two basins, their innermost rings circling the two minima. Now find the highlighted curve — drawn a hair above the ridge height of ${BARRIER.toFixed(2)}: it pinches into a FIGURE-EIGHT waist, the two families all but kissing at one point (at exactly the ridge level they touch and split). That point is the mountain pass (the saddle from Loss Landscapes & Optimization Geometry), and its level tells you precisely what an optimizer must climb to escape the shallow basin: ${(BARRIER - 1.49).toFixed(2)} units of loss. One glance at where rings merge = the full escape topology.`,
    invariant: 'Ring families merge exactly at saddle level: the figure-eight marks the pass between basins.',
  };

  yield {
    state: plotState({ axes: AXES, series: ALL_RINGS }),
    highlight: { compare: [contoursAt(1.6)[0].id, contoursAt(2.2)[0].id] },
    explanation: 'Now read STEEPNESS, the skill that makes contour maps useful: ring SPACING is inverse slope. Tight-packed rings = cliff; widely spaced = plain. Look at any basin here: the rings crowd together along the vertical (wâ‚‚) direction and spread far apart horizontally (wâ‚) — this is the ravine signature, the 1.5Â·wâ‚‚² walls versus the gentle valley floor, exactly the terrain that tortures plain gradient descent in Momentum, RMSProp & Adam. Elongated rings ARE ill-conditioning: the more eccentric the ellipses, the worse one global learning rate fits all directions (the eccentricity is literally the spread of the Hessian\'s Eigenvalues & Eigenvectors).',
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
      format: (v) => ['', 'count of basins in view', 'saddle points and their heights', 'cliffs vs plains — where lr must shrink', 'conditioning — round = easy, eccentric = ravine', 'plain GD âŠ¥; momentum cuts at angles'][v],
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation draws iso-lines -- curves of equal value -- on a two-basin loss surface viewed from directly above. In the "reading the map" view, contour rings appear at seven fixed loss levels, from 0.60 near the basin floor to 3.00 on the outer slopes. Active highlighting marks the curve under discussion. In the "optimizer paths" view, gradient descent and momentum traces overlay the same rings so you can watch each optimizer cross, follow, or get trapped by the contour structure.',
        'Nested ring families correspond to basins; their centers are local minima. The highlighted figure-eight curve marks the saddle level where two ring families almost merge. Tight ring spacing means steep terrain; wide spacing means a gentle slope. When an optimizer path appears, its angle relative to the rings encodes whether it follows pure gradient (perpendicular crossing) or carries momentum (angled crossing).',
        {
          type: 'note',
          text: 'Everything inside a contour ring has loss lower than the ring label. Moving inward through nested rings means descending toward a minimum.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A 3D surface plot of a loss landscape gives good first intuition -- you see valleys, ridges, and saddle points. But as soon as you need to measure anything, the 3D view fails. Camera angle hides saddles behind ridges. Perspective distorts slope: a cliff can look gentle, a gentle plain can look steep. Rotating the camera changes which features are visible and which are hidden. You cannot reliably compare two surfaces rendered from different angles, and you cannot overlay an optimizer path and read off exactly where it crossed a ridge or entered a basin.',
        'Contour maps exist because cartographers solved this problem two centuries ago. In 1791, J.L. Dupain-Triel published a contour map of France, flattening elevation into nested curves of equal height. The same projection works for any scalar field: temperature, pressure, probability density, or loss. Slice the surface at fixed heights, project each slice onto the floor, and draw the resulting curves. The 3D intuition survives as ring families and spacing patterns, but now every geometric fact -- basin count, saddle height, slope magnitude, conditioning ratio -- is measurable from a flat page.',
        {
          type: 'quote',
          text: 'The contour map is the instrument panel of optimization. The 3D surface is the view out the window.',
          attribution: 'Analogy adapted from Li et al., "Visualizing the Loss Landscape of Neural Nets" (2018)',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first thing anyone tries is a 3D surface rendering: plot loss as height over a grid of parameter values. This works for building intuition. You can see that a valley exists, that one basin is deeper than another, that a ridge separates two regions. For the teaching surface on this page, f(x,y) = (x^2 - 4)^2/22 + x/4 + 1 + 1.5*y^2, the 3D view clearly shows two wells of different depth connected by a saddle.',
        'The second common attempt is a scalar loss curve: plot loss versus training step. This tells you whether the optimizer is making progress, but it strips away all spatial information. You cannot tell whether the optimizer followed the valley floor or zigzagged across it, whether it stopped near a saddle or deep in a basin, or whether a better basin existed nearby. The loss curve answers "did it go down?" but not "why did it go down that way?"',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The 3D view breaks when you need to compare. Render the same surface from two camera angles and a saddle can appear or vanish. Render two different surfaces from the same angle and perspective distortion makes slope comparisons meaningless. Overlay an optimizer path on a 3D surface and the path occludes itself whenever it wraps behind a ridge. These are not edge cases -- they are the normal experience of anyone who has tried to extract quantitative conclusions from a 3D loss plot.',
        'The scalar loss curve breaks in the opposite direction: it has no geometry at all. Two optimizers can reach the same final loss by completely different routes -- one following the valley floor smoothly, the other bouncing between ravine walls for 50 steps before falling in. The loss curve cannot distinguish them. You need a representation that preserves the spatial structure of the landscape while eliminating the camera-angle problem. That representation is the contour map: a projection that keeps x-y positions exact and encodes height as labeled curves.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A contour at level L is the set {w : f(w) = L} -- every parameter configuration whose loss equals exactly L. For a 2D parameter space, each contour is a curve. The algorithm to extract contours from a scalar field depends on how the field is represented.',
        'When the field has a closed form (as on this page), contours can be computed analytically. For the teaching surface, fixing loss level L and solving for y gives y = +/- sqrt((L - g(x)) / 1.5) wherever g(x) <= L. Sweep x, compute y, and the contour traces itself exactly. No grid, no interpolation, no ambiguity.',
        'When the field is sampled on a grid (as in real neural network landscapes), the standard algorithm is marching squares (2D) or marching cubes (3D). The grid divides the domain into cells. For each cell, classify each corner as above or below the threshold L. The pattern of above/below corners determines which edges the contour crosses. Interpolate along those edges to find the crossing points, then connect them.',
        {
          type: 'diagram',
          label: 'Marching squares: the 16 cell cases',
          text: [
            'Corner states: O = below threshold, X = above threshold',
            '',
            'Case 0:    Case 1:    Case 2:    Case 3:    Case 4:',
            'O---O      X---O      O---X      X---X      O---O',
            '|   |      | / |      | \\ |      |---|      |   |',
            'O---O      O---O      O---O      O---O      O---X',
            '(empty)    (edge)     (edge)     (horiz)    (edge)',
            '',
            'Case 5:    Case 6:    Case 7:    Case 8:    Case 9:',
            'X---O      O---X      X---X      O---O      X---O',
            '|X/|       |/X\\|      |\\  |      |  /|      |/X\\|',
            'O---X      O---X      O---X      X---O      X---O',
            '(saddle)   (saddle)   (edge)     (edge)     (saddle)',
            '',
            'Cases 10-15 are reflections of cases 1-6.',
            'Saddle cases (5, 6, 9, 10) are ambiguous: two valid',
            'contour routings exist. Disambiguation requires checking',
            'the cell center value or choosing a consistent rule.',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The contour map preserves every geometric fact about the loss surface except literal height -- and it encodes height as curve labels. Basin count equals the number of nested ring families. Saddle height equals the label of the contour where two families merge (the figure-eight pinch). Slope magnitude is inverse contour spacing: tight rings mean steep terrain, wide rings mean gentle terrain. Conditioning (the ratio of largest to smallest curvature) is the eccentricity of the contour ellipses near a minimum: round rings mean well-conditioned, elongated rings mean ill-conditioned.',
        'The gradient of a scalar field is perpendicular to its level sets. This is not an empirical observation -- it follows from the definition of the gradient as the direction of steepest ascent. A contour is a curve of constant value, so movement along it produces zero change in f. The gradient must therefore point away from it, exactly perpendicular. This is why gradient descent crosses contours at right angles: the update direction is the negative gradient, which is always normal to the local contour.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Linear interpolation along a cell edge in marching squares.',
            '// p1, p2 are corner positions; v1, v2 are field values at those corners.',
            '// threshold is the contour level L.',
            'function lerpEdge(p1, p2, v1, v2, threshold) {',
            '  // t in [0,1]: fraction of the way from p1 to p2 where f = threshold',
            '  const t = (threshold - v1) / (v2 - v1);',
            '  return {',
            '    x: p1.x + t * (p2.x - p1.x),',
            '    y: p1.y + t * (p2.y - p1.y),',
            '  };',
            '}',
            '',
            '// Example: corners at (0,0) and (1,0) with values 2.3 and 4.1.',
            '// Contour level 3.0 crosses at t = (3.0 - 2.3) / (4.1 - 2.3) = 0.389.',
            '// Crossing point: (0.389, 0).',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For an analytic surface, contour computation is O(k * n) where k is the number of contour levels and n is the number of sample points per curve. This page draws 7 levels at roughly 300 points each -- trivial. For grid-based extraction via marching squares, the cost is O(k * R * C) where R and C are the grid dimensions. A 100x100 grid with 10 levels processes 100,000 cells. Each cell requires only corner classification and at most two interpolations, so the constant is small.',
        {
          type: 'table',
          headers: ['Method', 'Domain', 'Grid cost', 'Handles topology', 'Sharp features'],
          rows: [
            ['Marching squares', '2D scalar field', 'O(R * C) per level', 'Ambiguous at saddle cases', 'No -- smooths corners'],
            ['Marching cubes', '3D scalar field (isosurfaces)', 'O(R * C * D) per level', '15 base cases, same ambiguity', 'No -- smooths edges'],
            ['Dual contouring', '2D or 3D', 'O(R * C [* D]) per level', 'Uses Hermite data to resolve', 'Yes -- preserves sharp edges'],
          ],
        },
        'The expensive case is neural network loss landscapes. To draw contours around a trained model, you choose two directions in parameter space, build a grid of perturbed parameters, and evaluate the full loss at each grid point. A 51x51 grid means 2,601 forward passes over the validation set. For a model that takes 10 seconds per evaluation, that is 7 hours of compute for a single contour plot. This is why loss-landscape visualization is a diagnostic tool, not a routine monitoring step.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Topographic maps: the original use case. Military planning, hiking, civil engineering, and flood modeling all depend on reading slope, basin boundaries, ridgelines, and saddle passes from contour lines. The US Geological Survey has published contour maps since 1884.',
            'ML optimization diagnosis: Li et al. (2018) used contour plots to show that skip connections in ResNets produce smoother, more convex loss landscapes than plain deep networks. The contour view made the comparison instant -- no camera angle ambiguity.',
            'Level set methods: Osher and Sethian (1988) reformulated moving-boundary problems by embedding the boundary as the zero contour of a higher-dimensional function. Fluid interfaces, crystal growth, image segmentation, and computational geometry all use this idea. The boundary moves by evolving the embedding function; topology changes (merging, splitting) happen automatically.',
            'Weather maps: isobars (pressure contours) and isotherms (temperature contours) are the standard visualization for synoptic meteorology. Tight isobars mean high wind; the spacing-to-slope correspondence is the same as in loss landscapes.',
            'Medical imaging: CT and MRI scans produce 3D scalar fields (tissue density). Marching cubes extracts isosurfaces for organ boundaries, tumor volumes, and surgical planning.',
          ],
        },
        'The common thread is a scalar field where spatial relationships matter. Whenever you need to see where values are equal, how fast they change, and where distinct regions connect or separate, contour maps are the right tool.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The deepest failure is dimensionality. A contour plot of a neural network loss landscape shows a 2D slice through a space that may have millions of dimensions. A saddle in the slice may not be the relevant saddle in the full space. A basin that looks isolated may connect to other basins through directions not shown. Dauphin et al. (2014) showed that in high dimensions, most critical points are saddle points with many escape directions -- but a 2D slice typically shows only one or two. The contour map is a cross-section, not a summary.',
        'Ambiguity in grid-based extraction is a practical failure. Marching squares has four saddle cases (cases 5, 6, 9, 10 in the 16-case table) where two valid contour routings exist. Choosing wrong creates contour lines that cross or connect regions that should be separate. Marching cubes in 3D has analogous ambiguities among its 256 cases, and naive implementations can produce surfaces with holes. Dual contouring resolves this by using gradient (Hermite) data at edge crossings, but it requires that gradient information be available.',
        'Projection-choice bias is the silent failure. If the two directions used to slice the loss landscape happen to align with flat directions, the plot shows a featureless plain even if the surface is highly curved in other directions. Li et al. (2018) introduced filter-normalized directions to mitigate this, but no 2D projection can guarantee that it captures the most informative cross-section of an arbitrary high-dimensional surface. A flat contour plot is not evidence of a flat landscape -- it may be evidence of a bad slice.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Lorensen & Cline, "Marching Cubes: A High Resolution 3D Surface Construction Algorithm" (SIGGRAPH 1987) -- the foundational grid-based isosurface extraction paper. Marching squares is the 2D specialization.',
            'Ju et al., "Dual Contouring of Hermite Data" (SIGGRAPH 2002) -- resolves the ambiguity and sharp-feature problems of marching cubes by placing vertices inside cells using Hermite (value + gradient) data.',
            'Li et al., "Visualizing the Loss Landscape of Neural Nets" (NeurIPS 2018) -- introduced filter-normalized random directions for fair cross-architecture comparison of loss-landscape contour plots.',
            'Osher & Sethian, "Fronts Propagating with Curvature-Dependent Speed" (J. Comp. Phys. 1988) -- the level set method, which uses the zero contour of an evolving scalar field to track moving boundaries.',
          ],
        },
        'Study Gradient Descent to understand why the gradient is perpendicular to level sets. Study Momentum, RMSProp & Adam to see how stored velocity bends paths away from perpendicular contour crossings. Study Eigenvalues & Eigenvectors and the Hessian to connect contour eccentricity with curvature and conditioning numbers. Study Loss Landscapes & Optimization Geometry for the saddle-point escape theory that contour maps visualize. Return to the 3D loss landscape page when you need spatial intuition; use contour maps when you need measurements that do not depend on camera angle.',
      ],
    },
  ],
};

