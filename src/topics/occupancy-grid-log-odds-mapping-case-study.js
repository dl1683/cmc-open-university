// Occupancy grid mapping: discretize space into cells and update each cell's
// log-odds with sensor hits and freespace rays.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'occupancy-grid-log-odds-mapping-case-study',
  title: 'Occupancy Grid Log-Odds Mapping Case Study',
  category: 'Systems',
  summary: 'A robotics mapping case study: grid cells, inverse sensor models, log-odds updates, ray freespace, occupied hits, saturation, decay, and map evidence ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['grid update', 'sensor rays'], defaultValue: 'grid update' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function mapGraph(title) {
  return graphState({
    nodes: [
      { id: 'pose', label: 'pose', x: 1.0, y: 3.5, note: 'robot' },
      { id: 'scan', label: 'scan', x: 2.8, y: 3.5, note: 'lidar' },
      { id: 'free', label: 'free', x: 4.8, y: 2.0, note: 'miss' },
      { id: 'hit', label: 'hit', x: 4.8, y: 5.0, note: 'wall' },
      { id: 'grid', label: 'grid', x: 7.0, y: 3.5, note: 'log odds' },
      { id: 'cost', label: 'cost', x: 8.7, y: 3.5, note: 'planner' },
    ],
    edges: [
      { id: 'e-pose-scan', from: 'pose', to: 'scan' },
      { id: 'e-scan-free', from: 'scan', to: 'free' },
      { id: 'e-scan-hit', from: 'scan', to: 'hit' },
      { id: 'e-free-grid', from: 'free', to: 'grid' },
      { id: 'e-hit-grid', from: 'hit', to: 'grid' },
      { id: 'e-grid-cost', from: 'grid', to: 'cost' },
    ],
  }, { title });
}

function* gridUpdate() {
  yield {
    state: labelMatrix(
      'Log-odds cells',
      [
        { id: 'c1', label: 'c1' },
        { id: 'c2', label: 'c2' },
        { id: 'c3', label: 'c3' },
        { id: 'c4', label: 'c4' },
      ],
      [
        { id: 'prior', label: 'prior' },
        { id: 'obs', label: 'obs' },
        { id: 'after', label: 'after' },
      ],
      [
        ['0.0', 'free', '-0.7'],
        ['0.2', 'free', '-0.5'],
        ['0.1', 'hit', '+1.0'],
        ['2.4', 'hit', 'sat'],
      ],
    ),
    highlight: { active: ['c1:after', 'c2:after'], found: ['c3:after', 'c4:after'] },
    explanation: 'Occupancy grids store belief per cell. Log-odds updates make repeated evidence additive: freespace lowers occupancy, hits raise occupancy, and saturation prevents runaway certainty.',
  };
  yield {
    state: mapGraph('Sensor observations update cells'),
    highlight: { active: ['pose', 'scan', 'free', 'hit', 'grid', 'e-scan-free', 'e-scan-hit'], compare: ['cost'] },
    explanation: 'A scan is interpreted relative to a robot pose. Cells along the ray become more likely free; the endpoint becomes more likely occupied.',
    invariant: 'A map update is only as good as pose and sensor calibration.',
  };
  yield {
    state: plotState({
      axes: { x: { label: 'updates', min: 0, max: 10 }, y: { label: 'log odds', min: -4, max: 4 } },
      series: [
        { id: 'free', label: 'free', points: [{ x: 0, y: 0 }, { x: 2, y: -1.2 }, { x: 4, y: -2.3 }, { x: 6, y: -3.0 }, { x: 8, y: -3.0 }] },
        { id: 'occ', label: 'occ', points: [{ x: 0, y: 0 }, { x: 2, y: 1.4 }, { x: 4, y: 2.6 }, { x: 6, y: 3.0 }, { x: 8, y: 3.0 }] },
      ],
      markers: [
        { id: 'sat', x: 6, y: 3.0, label: 'sat' },
      ],
    }),
    highlight: { active: ['free', 'occ', 'sat'] },
    explanation: 'Log-odds saturation keeps old evidence from making the map impossible to update when the world changes.',
  };
  yield {
    state: labelMatrix(
      'Map evidence',
      [
        { id: 'pose', label: 'pose' },
        { id: 'sensor', label: 'sensor' },
        { id: 'time', label: 'time' },
        { id: 'cell', label: 'cell' },
      ],
      [
        { id: 'stored', label: 'stored' },
        { id: 'why', label: 'why' },
      ],
      [
        ['x,y,yaw', 'replay'],
        ['model id', 'calib'],
        ['stamp', 'order'],
        ['log odds', 'plan'],
      ],
    ),
    highlight: { found: ['pose:why', 'sensor:why', 'time:why', 'cell:why'] },
    explanation: 'For debugging robots, map cells need provenance: pose estimate, sensor model, timestamp, and update policy.',
  };
}

function* sensorRays() {
  yield {
    state: mapGraph('Ray tracing separates freespace from obstacle hits'),
    highlight: { active: ['scan', 'free', 'hit', 'e-scan-free', 'e-scan-hit'], found: ['grid'] },
    explanation: 'A range sensor observation says more than obstacle here. It also says cells before the obstacle were traversed by the ray and are likely free.',
  };
  yield {
    state: labelMatrix(
      'Ray cells',
      [
        { id: 'r0', label: 'near' },
        { id: 'r1', label: 'mid' },
        { id: 'r2', label: 'far' },
        { id: 'r3', label: 'end' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'upd', label: 'upd' },
      ],
      [
        ['free', '-'],
        ['free', '-'],
        ['free', '-'],
        ['hit', '+'],
      ],
    ),
    highlight: { active: ['r0:upd', 'r1:upd', 'r2:upd'], found: ['r3:upd'] },
    explanation: 'Bresenham-style ray traversal or voxel ray casting identifies which cells get freespace updates and which cell gets the occupied hit.',
  };
  yield {
    state: labelMatrix(
      'Dynamic-world controls',
      [
        { id: 'decay', label: 'decay' },
        { id: 'mask', label: 'mask' },
        { id: 'height', label: 'height' },
        { id: 'speed', label: 'speed' },
      ],
      [
        { id: 'problem', label: 'problem' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['stale wall', 'age'],
        ['robot body', 'clear'],
        ['3D clutter', 'filter'],
        ['latency', 'stamp'],
      ],
    ),
    highlight: { found: ['decay:fix', 'mask:fix', 'height:fix', 'speed:fix'] },
    explanation: 'Real maps change. Decay, self-filtering, height filtering, and timestamp discipline keep occupancy evidence usable for planning.',
  };
  yield {
    state: mapGraph('The planner consumes a derived costmap'),
    highlight: { active: ['grid', 'cost', 'e-grid-cost'], compare: ['pose', 'scan'] },
    explanation: 'The occupancy grid is often converted into a costmap before planning. Planning should not read raw sensor hits as final collision truth.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'grid update') yield* gridUpdate();
  else if (view === 'sensor rays') yield* sensorRays();
  else throw new InputError('Pick an occupancy-grid view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The grid-update view shows four cells receiving one scan. Active cells (blue) received free-space evidence and moved negative. Found cells (green) received hit evidence and moved positive. The saturated cell shows clamping in action: its prior was already high, so the update is absorbed rather than pushing belief further.',
        {type:'callout', text:'Occupancy grids turn noisy range observations into additive cell evidence by lowering traversed cells and raising hit endpoints.'},
        'The sensor-rays view traces the causal chain from robot pose through lidar scan to grid. Active edges show which cells the ray traversed. The compare node (costmap) reminds you that planning never reads raw log-odds directly.',
        'At each frame, ask: which cells changed sign, which stayed the same, and what would happen if the pose estimate were wrong by one cell width.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A mobile robot cannot plan from raw sensor returns. A lidar scan is a single angular sweep taken from one pose, corrupted by noise, multipath reflections, moving objects, and blind spots behind obstacles. A planner needs something steadier: a spatial estimate that says which regions are probably free, which are probably blocked, and how much evidence supports each claim.',
        {
          type: 'quote',
          attribution: 'Sebastian Thrun, "Learning Occupancy Grid Maps with Forward Sensor Models," Autonomous Robots, 2003',
          text: 'Occupancy grid maps are one of the most popular map representations in mobile robotics. They decompose the environment into a regular grid of cells, each of which contains a binary estimate of occupancy.',
        },
        'An occupancy grid is that estimate. It tiles space into fixed-size cells and stores a scalar belief per cell. The representation trades away exact wall geometry and object identity so that updates can be local (one cell at a time), cheap (one addition per observation), inspectable (render the grid, see the map), and easy to convert into a costmap for any planner.',
        'The case study matters because it teaches the systems boundary between perception and planning. Sensors produce observations. Mapping turns observations into accumulated evidence. Planning consumes a derived cost surface. When those layers are separate, debugging a bad maneuver becomes tractable: did the sensor miss the obstacle, did the map fail to accumulate it, or did the planner misuse the evidence?',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first approach most engineers try is reactive: keep the latest point cloud and plan around visible returns. If a lidar beam hits a wall, avoid the wall. If no beam returns in the forward arc, drive forward. In a static demo room this works because the latest scan is usually close to truth.',
        'A second obvious approach stores exact geometry: line segments from scan matching, mesh patches from depth cameras, or bounding boxes from an object detector. This can be more compact in simple environments and preserves detail that a grid discards.',
        {
          type: 'table',
          headers: ['Approach', 'Strength', 'Failure mode'],
          rows: [
            ['Latest scan only', 'Zero latency, no accumulation bugs', 'Forgets obstacles outside current field of view'],
            ['Exact geometry store', 'Compact in simple rooms, preserves shape', 'Brittle under noisy poses; hard to answer "is this footprint safe?" cheaply'],
            ['Occupancy grid', 'Stable under repeated noisy observations; O(1) cell queries', 'Fixed resolution; no semantic labels; memory grows with area'],
          ],
        },
        'Neither obvious approach is foolish. Raw scans preserve detail, and geometry stores can be more compact in simple spaces. The problem is that a control loop running at 10-20 Hz needs a stable, updateable spatial estimate under uncertainty. The latest scan is too volatile -- one missed return and the obstacle vanishes. Exact geometry becomes brittle when every measurement carries centimeter-scale noise and every pose estimate has drift.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is missing negative evidence. A lidar endpoint says "obstacle here," but the beam also crossed every cell between the sensor and that endpoint without hitting anything. Those traversed cells are evidence of free space. If the map only records hits, it fills up with obstacles and never learns where the robot can drive.',
        'The second wall is temporal volatility. A scan can miss a thin obstacle, return from a moving person, or bounce off glass at a misleading angle. Treating one observation as ground truth makes the map flicker. Never forgetting makes stale obstacles permanent. The map needs to accumulate repeated evidence while remaining revisable when the world changes.',
        {
          type: 'note',
          text: 'The third wall is pose coupling. Every map update is applied in a coordinate frame. If localization is wrong by 10 cm, the robot writes plausible-looking evidence into the wrong cells. The resulting map can appear clean and confident while being offset from the real world. Occupancy grids are structurally simple, but they are not independent of time synchronization, sensor calibration, and state estimation quality.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat each cell as a belief, not a permanent fact. A single range measurement updates many beliefs at once: cells along the ray become more likely free, the endpoint cell becomes more likely occupied. Repeating this rule across hundreds of scans turns noisy local measurements into a map stable enough for planning.',
        'Log-odds make the update practical. Probability is bounded between 0 and 1, and chaining Bayesian updates in probability space requires multiplication and normalization at every step. Odds compare occupied versus free as a ratio. Log-odds turn that ratio into a signed real number where multiplication of evidence becomes addition.',
        {
          type: 'code',
          language: 'javascript',
          body: '// Log-odds update rule (one cell, one observation)\n// l = current log-odds for cell\n// l_free = log-odds decrement for free-space ray pass (negative, e.g. -0.7)\n// l_occ  = log-odds increment for occupied hit (positive, e.g. +0.9)\n// l_min, l_max = clamp bounds (e.g. -3.0, +3.0)\n\nfunction updateCell(l, observationType, l_free, l_occ, l_min, l_max) {\n  if (observationType === "free") {\n    l = l + l_free;           // ray passed through: evidence of emptiness\n  } else if (observationType === "hit") {\n    l = l + l_occ;            // ray endpoint: evidence of obstacle\n  }\n  return Math.max(l_min, Math.min(l_max, l));  // clamp to prevent runaway\n}\n\n// Convert back to probability when needed:\n// p(occupied) = 1 - 1 / (1 + exp(l))',
          text: '// Log-odds update rule (one cell, one observation)\n// l = current log-odds for cell\n// l_free = log-odds decrement for free-space ray pass (negative, e.g. -0.7)\n// l_occ  = log-odds increment for occupied hit (positive, e.g. +0.9)\n// l_min, l_max = clamp bounds (e.g. -3.0, +3.0)\n\nfunction updateCell(l, observationType, l_free, l_occ, l_min, l_max) {\n  if (observationType === "free") {\n    l = l + l_free;           // ray passed through: evidence of emptiness\n  } else if (observationType === "hit") {\n    l = l + l_occ;            // ray endpoint: evidence of obstacle\n  }\n  return Math.max(l_min, Math.min(l_max, l));  // clamp to prevent runaway\n}\n\n// Convert back to probability when needed:\n// p(occupied) = 1 - 1 / (1 + exp(l))',
        },
        'The invariant: the grid stores accumulated evidence under a fixed sensor model. Unknown cells stay near zero (the prior). Traversed cells drift negative. Repeatedly-hit endpoints drift positive. The planner reads the result as a belief-derived costmap, never as raw sensor truth.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose a grid resolution (cell width) and an origin in the map frame. Each cell stores one float: its log-odds value, initialized to zero for a uniform prior. Positive means occupancy is more likely than free space. Negative means free space is more likely. Most update code never converts back to probability.',
        {
          type: 'diagram',
          alt: 'One lidar ray updating a row of grid cells',
          label: 'Ray traversal: free updates along the beam, occupied update at the endpoint',
          body: 'Robot               Endpoint\n  *---[free]---[free]---[free]---[hit]---|\n  |     -0.7     -0.7     -0.7    +0.9  |\n  |                                     |\n  pose (x,y,yaw)              wall cell\n\n  Cells before endpoint: l += l_free (subtract evidence)\n  Endpoint cell:         l += l_occ  (add evidence)\n  All cells:             clamp to [l_min, l_max]',
          text: 'Robot               Endpoint\n  *---[free]---[free]---[free]---[hit]---|\n  |     -0.7     -0.7     -0.7    +0.9  |\n  |                                     |\n  pose (x,y,yaw)              wall cell\n\n  Cells before endpoint: l += l_free (subtract evidence)\n  Endpoint cell:         l += l_occ  (add evidence)\n  All cells:             clamp to [l_min, l_max]',
        },
        'For each sensor ray, transform it from the sensor frame into the map frame using the current pose estimate and extrinsic calibration. Walk the cells the ray crosses using Bresenham line traversal (2D) or a DDA/voxel traversal (3D). Apply the free-space decrement to every traversed cell. Apply the occupied increment to the endpoint cell if the return is valid and within the sensor model range.',
        'After every update, clamp the cell value between l_min and l_max. Clamping is not cosmetic. Without it, a wall seen from 500 scans accumulates log-odds so high that a clearing ray would need hundreds of free passes to bring the cell back to uncertain. The animation plot shows this saturation: both the free and occupied curves flatten at the clamp bounds.',
        'Production systems add several post-update steps: age old evidence by pulling all cells toward zero (temporal decay), zero out cells under the robot footprint (self-filter), discard returns outside a height band (height filter), and inflate obstacles by the robot radius before handing the grid to the planner.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an evidence-accumulation argument. A real wall is hit from many viewpoints across many scans. Each hit pushes the wall cell positive by l_occ. Open floor is crossed by many rays en route to distant walls. Each pass-through pushes corridor cells negative by l_free. Random noise -- missed returns, multipath, moving clutter -- is diluted because it does not repeat consistently from the same cells across many poses.',
        'Log-odds preserve the Bayesian shape while keeping the data structure trivial. Under the standard independence assumption (observations are conditionally independent given occupancy), the posterior log-odds equals the prior log-odds plus the sum of all observation log-likelihood ratios. Each update is one addition. The grid does not need to store scan history; the current log-odds value is the sufficient statistic.',
        {
          type: 'note',
          text: 'The guarantee is not absolute occupancy truth. It is controlled evidence accumulation under a simplified sensor model. The map is trustworthy only to the extent that pose estimates, sensor calibration, time alignment, and the inverse sensor model are trustworthy. When any of those inputs are wrong, the grid confidently stores wrong beliefs.',
        },
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        {
          type: 'table',
          headers: ['Quantity', 'Value', 'Scaling behavior'],
          rows: [
            ['Cell count (2D)', 'W * H / r^2', 'Halving resolution quadruples cells: 100x100 m at 10 cm = 1M cells; at 5 cm = 4M cells'],
            ['Memory per cell', '4 bytes (float32)', '1M cells = 4 MB before layers or metadata'],
            ['Update per ray', 'O(ray_length / r)', 'One addition per traversed cell; a 30 m ray at 5 cm = ~600 cells'],
            ['Update per scan', 'O(num_rays * ray_length / r)', 'A 720-beam lidar at 30 m range touches ~430K cells per scan cycle'],
            ['Costmap inflation', 'O(num_cells * inflation_radius)', 'Runs once after all rays; dominates if inflation radius is large'],
          ],
        },
        'Resolution controls behavior, not just cost. Fine grids (5 cm) can represent narrow chair legs and tight doorways but make maps noisy and expensive. Coarse grids (20 cm) are stable and cheap but smear small obstacles into large blocks and can close narrow passages entirely. A warehouse robot navigating wide aisles tolerates 10 cm cells. A home robot threading between furniture legs may need 2.5 cm.',
        'Costmap inflation adds a second resolution tradeoff: inflating obstacles by the robot radius makes planning safer but erases navigable space near walls. Over-inflation in a narrow hallway can make the planner believe there is no path even though the robot fits.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'ROS 2 Nav2 costmap_2d: the standard local and global costmap for mobile robot navigation. Each layer (static, obstacle, inflation, voxel) writes or reads occupancy evidence in a shared grid.',
            'Warehouse AMRs (Kiva/Amazon Robotics, Locus Robotics): occupancy grids handle aisle navigation where the downstream question is purely geometric -- can the robot footprint fit here in the next 2 seconds?',
            'Self-driving vehicle local planners: short-range occupancy grids (30-50 m radius, 10-20 cm cells) feed into trajectory optimization for parking, lane changes, and obstacle avoidance.',
            'SLAM loop-closure debugging: when a SLAM system closes a loop and corrects the pose graph, developers re-render the occupancy grid to see whether wall alignment improved. The grid is a visual regression test.',
            'Exploration planners (frontier-based exploration): unknown cells (log-odds near zero) define frontiers. The robot drives toward the boundary between known-free and unknown to maximize coverage.',
          ],
        },
        'Occupancy grids shine when the downstream question is geometric and local: can this footprint occupy this region? The answer does not require object names, material properties, or mesh boundaries. The representation is also valuable because humans can inspect it -- a developer looks at the grid and immediately sees ghosts, missing freespace, bad inflation, sensor shadows, or localization smear.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Occupancy grids carry no semantics. A cell says "occupied" but cannot distinguish a person, a pallet, a glass wall, steam, a hanging sign above the robot, or a lidar reflection off a shiny floor. Navigation stacks that need to treat people differently from walls, or ignore overhead obstacles, must layer additional representations on top.',
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Mitigation'],
          rows: [
            ['Ghost obstacles', 'Robot routes around empty space', 'Temporal decay pulls old evidence toward zero; clearing rays from new poses'],
            ['Stale map after environment change', 'Door was opened but map still shows wall', 'Shorter clamp bounds so fewer clearing rays are needed; local map resets'],
            ['Pose drift', 'Doubled or smeared walls', 'Fix localization; occupancy grid cannot self-correct pose'],
            ['Thin obstacle missed', 'Chair leg between two beams', 'Finer resolution or obstacle inflation; sensor with denser angular sampling'],
            ['Glass / specular surfaces', 'Beam passes through or reflects at wrong angle', 'Additional sensing modality (depth camera, ultrasonic); manual keepout zones'],
          ],
        },
        'Pose drift is the most expensive failure because it corrupts many cells coherently. Bad localization does not look like random noise -- it writes plausible walls in the wrong place. The map becomes confident and wrong. The fix is never in the grid update alone; it requires inspecting localization, time synchronization, TF tree correctness, and loop-closure behavior.',
        'Dynamic environments expose a fundamental tension: fast decay clears ghosts but erodes confidence in stable obstacles. Slow decay preserves walls but traps ghost evidence. The right balance depends on robot speed, sensor rate, environment dynamism, and how much the planner can tolerate stale evidence versus risky clearing.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A robot drives down a hallway with a planar lidar producing 720 beams at 10 Hz. One beam crosses five 10 cm cells and returns from the right wall at 3.2 m. Configuration: l_occ = +0.9, l_free = -0.7, l_min = -3.0, l_max = +3.0.',
        {
          type: 'table',
          headers: ['Cell', 'Role', 'Prior l', 'Update', 'New l', 'p(occ)'],
          rows: [
            ['(12,5)', 'free', '0.0', '-0.7', '-0.7', '0.33'],
            ['(13,5)', 'free', '-0.7', '-0.7', '-1.4', '0.20'],
            ['(14,5)', 'free', '0.0', '-0.7', '-0.7', '0.33'],
            ['(15,5)', 'free', '0.2', '-0.7', '-0.5', '0.38'],
            ['(16,5)', 'free', '0.0', '-0.7', '-0.7', '0.33'],
            ['(17,5)', 'hit', '0.0', '+0.9', '+0.9', '0.71'],
          ],
        },
        'After ten scans from nearby poses, cell (13,5) in the hallway sits at l = -3.0 (clamped). Cell (17,5) at the wall sits at l = +3.0 (clamped). Both are saturated. Now a person walks through the beam, causing the endpoint to shift to cell (14,5) for five consecutive scans.',
        'Cell (14,5) receives five hit updates: l goes from -0.7 to -0.7 + 5(0.9) = +3.8, clamped to +3.0. The planner sees a new obstacle. When the person leaves, later rays pass through cell (14,5) again as free space. Each free pass subtracts 0.7, so clearing from +3.0 takes ceil(3.0 / 0.7) = 5 free-pass scans. If the robot is stationary, this takes 0.5 seconds at 10 Hz -- fast enough. If clamping were set to +10.0, clearing would take ceil(10.0 / 0.7) = 15 scans, and the ghost lingers for 1.5 seconds. That is why clamp bounds are an operational parameter, not a cosmetic choice.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        {
          type: 'code',
          language: 'javascript',
          body: '// Bresenham-style 2D ray traversal for grid update\nfunction updateRay(grid, x0, y0, x1, y1, l_free, l_occ, l_min, l_max) {\n  // Walk cells from (x0,y0) toward (x1,y1) using Bresenham\n  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);\n  let sx = x0 < x1 ? 1 : -1,  sy = y0 < y1 ? 1 : -1;\n  let err = dx - dy;\n  let cx = x0, cy = y0;\n  while (cx !== x1 || cy !== y1) {\n    grid[cy][cx] = clamp(grid[cy][cx] + l_free, l_min, l_max);  // free\n    let e2 = 2 * err;\n    if (e2 > -dy) { err -= dy; cx += sx; }\n    if (e2 <  dx) { err += dx; cy += sy; }\n  }\n  grid[y1][x1] = clamp(grid[y1][x1] + l_occ, l_min, l_max);    // hit\n}\n\nfunction clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }',
          text: '// Bresenham-style 2D ray traversal for grid update\nfunction updateRay(grid, x0, y0, x1, y1, l_free, l_occ, l_min, l_max) {\n  // Walk cells from (x0,y0) toward (x1,y1) using Bresenham\n  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);\n  let sx = x0 < x1 ? 1 : -1,  sy = y0 < y1 ? 1 : -1;\n  let err = dx - dy;\n  let cx = x0, cy = y0;\n  while (cx !== x1 || cy !== y1) {\n    grid[cy][cx] = clamp(grid[cy][cx] + l_free, l_min, l_max);  // free\n    let e2 = 2 * err;\n    if (e2 > -dy) { err -= dy; cx += sx; }\n    if (e2 <  dx) { err += dx; cy += sy; }\n  }\n  grid[y1][x1] = clamp(grid[y1][x1] + l_occ, l_min, l_max);    // hit\n}\n\nfunction clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }',
        },
        'Treat coordinate frames as part of the data structure. Every update must be tied to a map frame, robot pose, sensor frame, and timestamp. Dropping timestamp discipline is how teams accidentally apply a scan from pose T=1.0 to the robot state from T=1.05. That 50 ms of motion at 1 m/s is a 5 cm map error -- half a cell at 10 cm resolution.',
        {
          type: 'bullets',
          items: [
            'Keep update constants explicit and versioned: l_occ, l_free, l_min, l_max, decay_rate, max_ray_range, min_valid_range, height_filter_band, self_filter_radius. Changing any of these changes the meaning of stored evidence.',
            'Separate occupancy from planner cost. The planner needs inflation, unknown-space policy, lethal thresholds, and robot footprint handling. If the planner reads raw log-odds, a single noisy return becomes a hard collision constraint.',
            'Debug with the full causal chain: raw scan, transformed rays, free cells touched, hit cells touched, log-odds before and after, costmap after inflation, planned path. When the robot makes a bad move, this sequence identifies where the bad assumption entered.',
            'For 3D environments, use a voxel grid or an OctoMap (octree-compressed 3D occupancy). The same log-odds update rule applies per voxel, but the octree compresses large uniform regions -- critical when a 50x50x5 m volume at 5 cm resolution would otherwise require 200M voxels.',
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: H. Moravec and A. Elfes, "High Resolution Maps from Wide Angle Sonar," IEEE International Conference on Robotics and Automation, 1985. The paper that introduced occupancy grids to robotics, using ultrasonic sensors on the CMU Rover.',
            'Theoretical treatment: S. Thrun, "Learning Occupancy Grid Maps with Forward Sensor Models," Autonomous Robots 15(2), 2003. Derives the log-odds update from Bayesian first principles and introduces forward sensor models.',
            'Production implementation: the ROS 2 Nav2 costmap_2d package. The obstacle_layer and voxel_layer plugins implement exactly the ray-trace-and-update loop described here, with configurable l_occ, l_free, and clamp bounds.',
            '3D extension: A. Hornung et al., "OctoMap: An Efficient Probabilistic 3D Mapping Framework Based on Octrees," Autonomous Robots 34(3), 2013. Applies the same log-odds update to octree-compressed 3D voxel grids.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Kalman Filter Sensor Fusion', 'The pose estimate feeding the grid comes from state estimation; bad poses corrupt the map'],
            ['Prerequisite', 'Bresenham Line Algorithm', 'Ray traversal uses integer grid walks derived from Bresenham'],
            ['Extension', 'Quadtree Spatial Index', 'Adaptive resolution grids use quadtree subdivision to spend cells where detail matters'],
            ['Extension', 'OctoMap 3D Occupancy', 'Octree-compressed 3D log-odds grids for environments with vertical structure'],
            ['Downstream', 'RRT* Motion Planning Tree', 'Path planners consume the costmap derived from occupancy evidence'],
            ['Contrast', 'Signed Distance Field', 'SDFs store distance-to-nearest-obstacle instead of occupancy belief; better for trajectory optimization, worse for incremental sensor updates'],
          ],
        },
      ],
    },
  ],
};
