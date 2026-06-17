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
      heading: 'Why this exists',
      paragraphs: [
        `A mobile robot cannot drive from raw sensor returns alone. A lidar scan is a momentary slice through the world, taken from one pose, with noise, missing returns, moving people, reflective surfaces, and blind spots. A planner needs a steadier object: a map that says which regions are probably free, which regions are probably blocked, and how confident the robot should be about each claim.`,
        `An occupancy grid is that object. It divides space into cells and stores a belief for each cell. The representation is deliberately blunt. It gives up exact wall geometry and object identity so updates can be local, cheap, inspectable, and easy to turn into a costmap. That trade is why occupancy grids remain useful in navigation stacks even when richer perception systems exist.`,
        `The case study matters because it teaches the boundary between perception and planning. Sensors produce observations. Mapping turns those observations into evidence. Planning consumes a derived cost surface. When those layers are separated, a robot can debug bad driving by asking whether the sensor saw the world, whether the map accumulated the evidence correctly, or whether the planner misused the map.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious first approach is to keep the latest point cloud or depth image and plan around the visible returns. If the sensor sees a wall, avoid the wall. If it sees no obstacle in front of the robot, drive forward. For a small demo in a static room, this can look convincing because the latest scan is usually close to the truth.`,
        `A second obvious approach is to store exact geometry: points, line segments, meshes, or object detections. That can be useful for mapping and visualization, but it is not the cheapest interface for a local collision planner. The planner often needs to ask simple questions many times per second: is this footprint safe, how close is the nearest obstacle, and is this corridor clear enough to enter? A dense belief grid answers those questions directly.`,
        `The old approach is not foolish. Raw observations preserve detail, and exact geometry can be more compact in simple spaces. The problem is that a robot's control loop needs a stable, updateable estimate under uncertainty. The latest scan is too volatile, and exact geometry can become brittle when every measurement is noisy and every pose estimate has error.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is missing negative evidence. A lidar endpoint says there may be an obstacle where the beam returned, but the beam also crossed space before reaching that endpoint. Those traversed cells are evidence of free space. If the map only stores hits, it fills with obstacles and never learns where the robot can safely travel.`,
        `The second wall is time. A scan can miss a thin obstacle, hit a moving person, or return from glass in a misleading way. If the system treats one observation as truth, the map flickers. If it never forgets, stale obstacles become permanent. The map needs to accumulate repeated evidence while still remaining revisable.`,
        `The third wall is pose. A map update is applied in a coordinate frame. If localization is wrong, the robot can confidently write evidence into the wrong cells. That failure is dangerous because the resulting map may look clean and certain while being offset from the real world. Occupancy grids are simple, but they are not independent of calibration, time stamps, and state estimation.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Treat each cell as a belief, not as a permanent fact. A range measurement updates many beliefs at once: cells along the ray become more likely free, and the endpoint becomes more likely occupied. Repeating this rule across scans turns noisy local measurements into a map that is stable enough for planning.`,
        `Log-odds make the update practical. Probability is bounded between 0 and 1, and repeated Bayesian updates can be awkward to implement directly. Odds compare occupied versus free. Log-odds turn multiplication of evidence into addition. A free-space observation subtracts a fixed amount. A hit adds a fixed amount. The implementation can clamp the value so a cell never becomes impossible to revise.`,
        `The invariant is that the grid stores accumulated evidence under a sensor model. Unknown cells stay near the prior. Traversed cells move toward free. Repeated endpoints move toward occupied. The planner should see the result as a belief-derived costmap, not as raw sensor truth.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `Start with a grid resolution and an origin in a map frame. Each cell stores a log-odds value, often initialized to zero for an unknown prior. A positive value means occupancy is more likely than free space. A negative value means free space is more likely. The exact conversion back to probability is available, but most update code can work directly in log-odds.`,
        `For each sensor ray, transform the ray from the sensor frame into the map frame using the robot pose and calibration. Traverse the cells crossed by the ray with a Bresenham-style grid walk, digital differential analyzer, or voxel traversal in 3D. Apply a free update to cells before the return. Apply an occupied update to the endpoint if the return is valid and within the sensor model's usable range.`,
        `After the update, clamp the cell value between minimum and maximum log-odds. Clamping is not cosmetic. Without it, hundreds of repeated hits can make a cell so certain that later clearing rays cannot move it back in reasonable time. Many systems also age old evidence, clear the robot's own footprint, filter by height, and convert the occupancy layer into an inflated costmap before planning.`,
        `The animation's grid-update view shows this ledger behavior: each cell has a prior, an observation role, and an updated belief. The sensor-rays view shows the causal split that matters most: the endpoint and the traversed cells get opposite evidence. A robot that records only the endpoint learns obstacles; a robot that records the whole ray learns navigable space.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness argument is a plain evidence argument. If the pose is good and the inverse sensor model is reasonable, a real wall will be hit from many viewpoints. Those endpoint updates push the wall cells upward. Open floor will be crossed by many rays before they hit something else. Those pass-through updates push corridor cells downward. Random misses and noisy returns are diluted by repeated observations.`,
        `Log-odds preserve the important Bayesian shape while keeping the data structure simple. Independent pieces of evidence add in log-odds space, so the map can update a cell with one addition per observation role. The grid does not need to store every previous scan to remember its belief. The current log-odds value is the sufficient summary for the simplified sensor model.`,
        `The guarantee is not absolute occupancy truth. It is a controlled accumulation of local evidence. The map is trustworthy only to the extent that sensor calibration, pose estimates, time alignment, and the update model are trustworthy. This is why production mapping code stores provenance such as pose, sensor model, timestamp, update policy, and sometimes the source layer for each costmap cell.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `Memory is proportional to mapped area divided by cell area. In a 2D grid, halving the cell width roughly quadruples the number of cells. A 100 by 100 meter local map at 10 centimeter resolution has one million cells before metadata, layers, or inflation. A 5 centimeter grid gives sharper obstacles but multiplies storage and update work.`,
        `Update cost depends on the number of rays and the number of cells crossed by each ray. Long-range lidar with many beams can touch a large fraction of a local map every cycle. Ray traversal, coordinate transforms, cache locality, and layer fusion become real performance concerns. Sparse or tiled grids reduce memory for large maps, but they add indexing complexity.`,
        `Resolution controls behavior, not just cost. Fine grids can represent narrow chair legs and tight doorways, but they can also make maps noisy and expensive. Coarse grids are stable and cheap, but they can close narrow passages or smear small obstacles into large blocks. Costmap inflation adds another tradeoff: it makes planning safer around robot footprint and uncertainty, but too much inflation erases usable space.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Occupancy grids work well for local navigation, indoor mobile robots, warehouse robots, simple outdoor ground vehicles, SLAM debugging, and planner costmaps. They shine when the downstream question is geometric and local: can the robot footprint occupy this region soon? The answer does not require object names or exact mesh boundaries.`,
        `They are also useful because humans can inspect them. A developer can look at a grid and see ghosts, missing freespace, bad inflation, sensor shadows, or localization smear. That visibility matters in robotics. A black-box perception output may be more expressive, but an occupancy grid makes many failures obvious enough to debug during a field test.`,
        `The representation also gives a clean systems boundary. Perception and sensor fusion write evidence. Mapping manages belief, decay, clearing, and layers. Planning reads a costmap. Control follows a trajectory. When the robot behaves badly, that separation lets the team isolate whether the problem is sensing, mapping, planning, or execution.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Occupancy grids struggle with semantic meaning. A cell can say occupied, but it cannot say whether the obstacle is a person, a pallet, a door, steam, glass, a reflection, or a hanging object above the robot's body. A navigation stack often needs additional layers for semantics, height, keepout zones, lanes, or social behavior around people.`,
        `They also struggle with dynamic worlds. A parked cart, a walking person, and a recently opened door all leave evidence. Without decay and clearing, the map accumulates ghosts. With too much decay, stable obstacles lose confidence. The right policy depends on the robot's speed, sensor rate, environment, and tolerance for stale obstacles versus risky clearing.`,
        `Pose drift is the expensive failure because it corrupts many cells coherently. Bad localization does not look like random noise; it writes plausible walls in the wrong place. The map can become confident and wrong. When that happens, the fix is rarely in the grid update alone. The team must inspect localization, time synchronization, transforms, calibration, and loop-closure behavior.`,
      ],
    },
    {
      heading: 'A worked case',
      paragraphs: [
        `A robot drives down a hallway with a planar lidar. One beam crosses five cells and returns from the right wall. The first five cells get free updates because the beam passed through them. The endpoint cell gets an occupied update. The same happens from hundreds of nearby poses. Over time, the hallway floor accumulates negative log-odds, and the wall cells accumulate positive log-odds.`,
        `Now a person walks through the beam. For a few scans, the endpoint is no longer the wall; it is the person. The map marks a temporary occupied region in the hallway. When the person leaves, later rays pass through that same region and hit the wall again. Those pass-through updates should clear the temporary obstacle. If clamping, decay, and clearing are tuned badly, the planner may continue to route around a person who is no longer there.`,
        `The example shows why a grid cell is not a fact. It is a compact memory of evidence. The cell's value should be strong enough to stabilize planning across noisy scans and weak enough to change when the world changes.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Treat coordinate frames as part of the data structure. Every update should be tied to a map frame, robot pose, sensor frame, and timestamp. Dropping timestamp discipline is how teams accidentally apply a scan from one pose to the robot state from another moment. That creates map errors that look like mysterious perception noise.`,
        `Keep the update constants explicit. The occupied increment, free decrement, minimum clamp, maximum clamp, decay rate, maximum ray length, minimum valid range, height filter, and self-filter are operational parameters. They should be versioned and visible in logs because changing them changes the meaning of stored evidence.`,
        `Separate occupancy from planner cost. A planner usually needs inflation around obstacles, unknown-space policy, lethal thresholds, robot footprint handling, and sometimes separate static and dynamic layers. If the planner reads raw hits directly, a single noisy return can become a hard collision constraint. If the costmap is derived from beliefs, the system can choose how uncertainty turns into caution.`,
        `Debug with slices that match the mechanism: raw scan, transformed rays, free cells touched, hit cells touched, log-odds before and after, costmap after inflation, and the planned path. When a robot makes a bad move, that sequence tells you where the bad assumption entered.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: Thrun's occupancy-grid mapping paper at https://robots.stanford.edu/papers/thrun.iros01-occmap.pdf and an occupancy-grid project overview at https://yangfan.github.io/projects/mapping/grid-map/. For implementation practice, study the costmap and mapping layers used by common robotics navigation stacks.`,
        `Study Kalman Filter Sensor Fusion for state estimation, Particle Filter Localization for pose uncertainty, Quadtree Spatial Index for adaptive spatial resolution, Nav2 Costmap Inflation Layer for planner costs, and RRT* Motion Planning Tree for path search over derived map evidence. The natural next question is how pose uncertainty, map uncertainty, and planner safety margins should be coupled instead of tuned in isolation.`,
      ],
    },
  ],
};
