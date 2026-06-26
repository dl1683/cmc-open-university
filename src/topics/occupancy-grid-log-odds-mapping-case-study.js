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
        'Read each cell as a belief about whether that square contains an obstacle. Active marks the cells touched by the current sensor ray. Visited marks cells whose log-odds value has already been updated by previous observations. Found marks the hit endpoint where the sensor reported an obstacle.',
        {type:'callout', text:'Occupancy grids turn noisy range observations into additive cell evidence by lowering traversed cells and raising hit endpoints.'},
        'Log odds is a score form of probability: positive means occupied is more likely than empty, negative means empty is more likely than occupied, and zero means unknown. A safe inference rule is this: cells crossed before a hit get evidence for empty space, while the endpoint gets evidence for occupancy.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A robot needs a map even though its sensors are noisy. A laser, sonar, or depth camera does not say the world directly; it says that along this ray nothing reflected until a measured distance. An occupancy grid turns those observations into a cell-by-cell map.',
        'The grid is useful because planning needs local questions. Is this cell probably blocked, probably free, or still unknown. A robot can then choose paths, avoid obstacles, and decide where more sensing is needed without storing every raw scan forever.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to mark a cell occupied whenever a sensor sees an obstacle there and empty whenever a ray passes through it. That is easy to implement and often looks correct in a clean demo. A single scan seems like enough when the obstacle is clear.',
        'Real sensors disagree. Glass, angle, range, dust, moving objects, and pose error can create false hits or misses. If the map overwrites old state with the latest reading, one bad scan can erase many good scans.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is uncertainty over time. A cell may be crossed by ten rays, hit by one noisy ray, then crossed again later from another angle. A hard occupied or empty label cannot express how much evidence has accumulated.',
        'The second wall is scale. A map with 100,000 cells cannot maintain a full joint probability over all possible maps. If each cell were binary, there would be 2 to the 100,000 possible occupancy patterns. The system needs a local approximation that updates quickly.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to store independent cell belief in log-odds form and add evidence from each measurement. Log odds turns Bayesian multiplication into addition. A hit adds positive evidence, a pass-through adds negative evidence, and the prior can be subtracted once so repeated updates do not double-count it.',
        'This is not a perfect world model because neighboring cells are correlated. It is a useful engineering approximation. The robot gets a map that can be updated online, queried locally, and saturated to avoid one cell becoming infinitely certain.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The robot pose gives the sensor origin. Each range measurement defines a ray from that origin through the grid. A ray-tracing method such as Bresenham visits the cells between the robot and the measured endpoint.',
        'Cells before the endpoint receive an empty update such as -0.4 log odds. The endpoint receives an occupied update such as +0.85 log odds. Values are often clamped between limits, for example -3.5 and +3.5, so a bad object or stale wall can eventually be corrected.',
        'To read the map, convert log odds L back to probability with p = 1 / (1 + exp(-L)). A cell with L = 0 has probability 0.5. A cell with L = 2 has probability about 0.88, and a cell with L = -2 has probability about 0.12.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a Bayesian-filter invariant under an independence approximation. Each cell stores all evidence seen for that cell as a log-odds sum. When a new measurement arrives, the update adds only the evidence implied by that measurement model.',
        'If the sensor model is calibrated and the robot pose is correct enough, repeated independent evidence pushes the belief in the right direction. Conflicting evidence does not corrupt the structure; it subtracts from the previous score. The map is therefore a running posterior estimate, not a one-scan label.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Updating one scan costs O(r) where r is the number of grid cells crossed by its rays. A 360-beam lidar with rays crossing 80 cells on average touches about 28,800 cells per scan. Doubling the grid resolution roughly doubles cells per meter in each dimension, so memory grows about four times for a fixed 2D area.',
        'Memory is O(n) for n cells because each cell stores one score, often a small integer or float. The dominant cost in practice is ray traversal and cache behavior, not the probability formula. Sparse maps reduce memory when the explored area is small relative to the possible world.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Occupancy grids are used in mobile robots, warehouse robots, self-driving research stacks, drones, vacuum cleaners, and simulation. They fit navigation because planners need fast local collision checks. The grid also gives a simple interface between perception and planning.',
        'The same idea appears in costmaps. A costmap inflates occupied cells around obstacles so the planner respects robot size and safety margin. The probabilistic grid answers what is likely present; the costmap answers where the robot should avoid driving.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The method fails when pose estimates are wrong. If the robot thinks it is 20 cm left of its real position, every ray update paints the world in the wrong cells. Mapping and localization must therefore be solved together in SLAM systems.',
        'It also struggles with glass, mirrors, dynamic people, overhangs, and 3D structure projected into a 2D slice. The cell-independence assumption can make walls look thicker or leak evidence through thin objects. A high-resolution grid can reduce some errors but raises memory and update cost.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with one cell at L = 0, so p = 0.5. A ray passes through it three times, and each pass-through update is -0.4. The cell becomes L = -1.2, which converts to p = 1 / (1 + exp(1.2)) = 0.23 occupied.',
        'Now a later scan reports a hit in that same cell with update +0.85. The score becomes L = -0.35, or p = 0.41 occupied. The map did not flip blindly to occupied; it combined the new hit with previous empty evidence.',
        'If two more hits arrive, L becomes 1.35 and p becomes about 0.79. A planner may treat the cell as blocked once p exceeds 0.65, while an exploration module may still mark nearby unknown cells for more sensing. The threshold is a policy choice on top of the belief.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Moravec and Elfes on occupancy grids, then read Probabilistic Robotics by Thrun, Burgard, and Fox. A useful public reference is the CMU robotics lecture material on occupancy grid mapping at https://www.cs.cmu.edu/~16831-f14/notes/F14/16831_lecture06_agiri_dmcconac_kumarsha_nbhakta.pdf.',
        'Next, study Bayes filters, Bresenham line traversal, SLAM pose graphs, particle filters, costmaps, dynamic occupancy grids, OctoMap, and signed distance fields. The reusable lesson is that noisy evidence should be accumulated in a form where uncertainty can move both directions.',
      ],
    },
  ],
};
