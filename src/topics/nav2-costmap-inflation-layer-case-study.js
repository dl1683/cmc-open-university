// Nav2-style costmap inflation: convert occupied cells into lethal and decaying
// costs around obstacles so planners keep robot footprint clearance.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'nav2-costmap-inflation-layer-case-study',
  title: 'Nav2 Costmap Inflation Layer Case Study',
  category: 'Systems',
  summary: 'A robot navigation case study: layered costmaps, obstacle cells, footprint radius, inflation radius, exponential decay, rolling windows, planner costs, and stale-layer debugging.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['inflation field', 'layer stack'], defaultValue: 'inflation field' },
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

function stackGraph(title) {
  return graphState({
    nodes: [
      { id: 'static', label: 'static', x: 1.0, y: 2.0, note: 'map' },
      { id: 'obs', label: 'obs', x: 1.0, y: 5.0, note: 'sensor' },
      { id: 'master', label: 'master', x: 3.6, y: 3.5, note: 'grid' },
      { id: 'infl', label: 'infl', x: 5.8, y: 3.5, note: 'decay' },
      { id: 'planner', label: 'planner', x: 8.2, y: 2.0, note: 'global' },
      { id: 'ctrl', label: 'ctrl', x: 8.2, y: 5.0, note: 'local' },
    ],
    edges: [
      { id: 'e-static-master', from: 'static', to: 'master' },
      { id: 'e-obs-master', from: 'obs', to: 'master' },
      { id: 'e-master-infl', from: 'master', to: 'infl' },
      { id: 'e-infl-planner', from: 'infl', to: 'planner' },
      { id: 'e-infl-ctrl', from: 'infl', to: 'ctrl' },
    ],
  }, { title });
}

function* inflationField() {
  yield {
    state: labelMatrix(
      'Inflated costs',
      [
        { id: 'hit', label: 'hit' },
        { id: 'near', label: 'near' },
        { id: 'mid', label: 'mid' },
        { id: 'far', label: 'far' },
      ],
      [
        { id: 'dist', label: 'dist' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['0.0m', 'lethal'],
        ['0.2m', 'high'],
        ['0.5m', 'med'],
        ['1.0m', 'low'],
      ],
    ),
    highlight: { active: ['hit:cost', 'near:cost'], compare: ['far:cost'] },
    explanation: 'Inflation turns one occupied cell into a cost field around the obstacle. The robot should not route its footprint too close to lethal cells.',
  };
  yield {
    state: plotState({
      axes: { x: { label: 'distance', min: 0, max: 2 }, y: { label: 'cost', min: 0, max: 255 } },
      series: [
        { id: 'curve', label: 'decay', points: [{ x: 0, y: 255 }, { x: 0.25, y: 220 }, { x: 0.5, y: 150 }, { x: 1.0, y: 60 }, { x: 1.5, y: 10 }] },
      ],
      markers: [
        { id: 'foot', x: 0.35, y: 200, label: 'foot' },
      ],
    }),
    highlight: { active: ['curve', 'foot'] },
    explanation: 'The cost curve depends on footprint, inscribed radius, inflation radius, and cost scaling. Small parameter changes can make paths hug walls or avoid narrow corridors.',
    invariant: 'Inflation encodes clearance policy, not new obstacle evidence.',
  };
  yield {
    state: stackGraph('Inflation is one layer in the costmap stack'),
    highlight: { active: ['master', 'infl', 'e-master-infl'], found: ['planner', 'ctrl'] },
    explanation: 'The inflation layer reads lethal obstacle cells from the master grid and writes a decayed cost field that planners and controllers use.',
  };
  yield {
    state: labelMatrix(
      'Tuning symptoms',
      [
        { id: 'hug', label: 'hug wall' },
        { id: 'block', label: 'blocked' },
        { id: 'jitter', label: 'jitter' },
        { id: 'stale', label: 'stale' },
      ],
      [
        { id: 'cause', label: 'cause' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['low cost', 'raise scale'],
        ['wide radius', 'lower radius'],
        ['local noise', 'smooth'],
        ['old obs', 'clear'],
      ],
    ),
    highlight: { found: ['hug:fix', 'block:fix', 'stale:fix'], compare: ['jitter:fix'] },
    explanation: 'Costmap tuning failures show up as navigation behavior. The fix lives in layer parameters, sensor clearing, footprint modeling, and planner cost weights.',
  };
}

function* layerStack() {
  yield {
    state: stackGraph('Layered costmaps merge static and live obstacles'),
    highlight: { active: ['static', 'obs', 'master', 'e-static-master', 'e-obs-master'], compare: ['infl'] },
    explanation: 'A navigation stack combines static map data, obstacle observations, semantic layers, keepout zones, and inflation into one master costmap.',
  };
  yield {
    state: labelMatrix(
      'Layer roles',
      [
        { id: 'static', label: 'static' },
        { id: 'obs', label: 'obs' },
        { id: 'infl', label: 'infl' },
        { id: 'keep', label: 'keepout' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'output', label: 'output' },
      ],
      [
        ['map', 'walls'],
        ['scan', 'hits/clear'],
        ['grid', 'cost field'],
        ['policy', 'no-go'],
      ],
    ),
    highlight: { active: ['static:output', 'obs:output', 'infl:output'], compare: ['keep:output'] },
    explanation: 'Layer ordering matters. Clearing, marking, inflation, and policy overlays produce different final costs depending on merge semantics.',
  };
  yield {
    state: stackGraph('Global planner and local controller consume different windows'),
    highlight: { active: ['planner', 'ctrl', 'e-infl-planner', 'e-infl-ctrl'], found: ['infl'] },
    explanation: 'Global costmaps may be static and large; local costmaps often roll with the robot and update quickly. Both need consistent footprint and inflation semantics.',
  };
  yield {
    state: labelMatrix(
      'Debug packet',
      [
        { id: 'topic', label: 'topic' },
        { id: 'frame', label: 'frame' },
        { id: 'stamp', label: 'stamp' },
        { id: 'params', label: 'params' },
      ],
      [
        { id: 'stored', label: 'stored' },
        { id: 'why', label: 'why' },
      ],
      [
        ['costmap', 'visual'],
        ['map/base', 'TF'],
        ['time', 'latency'],
        ['radius', 'replay'],
      ],
    ),
    highlight: { found: ['topic:why', 'frame:why', 'stamp:why', 'params:why'] },
    explanation: 'Costmap bugs are replay bugs. Store topics, frames, timestamps, footprint, inflation parameters, and layer versions so path choices can be explained.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'inflation field') yield* inflationField();
  else if (view === 'layer stack') yield* layerStack();
  else throw new InputError('Pick a costmap view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A mobile robot does not navigate with point geometry. It has a footprint, localization error, controller lag, wheel slip, sensor delay, and physical inertia. A grid cell that is technically free may still be a bad place to drive if the robot body would scrape a wall, clip a table leg, or leave no margin for tracking error.',
        'A planner that treats the world as only blocked or free can produce paths that pass one cell away from lethal obstacles. Those paths look legal in the occupancy grid and unsafe in the hallway. The costmap inflation layer exists to turn obstacle evidence into a clearance field so path search can prefer routes with usable space.',
        {type:'callout', text:'Inflation turns obstacle evidence into a clearance cost field, so path search can prefer safer space before final collision checks.'},
        'Nav2 costmaps are layered 2D grids used by planner and controller servers. Static maps, obstacle observations, voxel or range data, keepout filters, and inflation all contribute to the master costmap. Inflation is the layer that says how costly it should be to drive near cells already considered dangerous.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first design is binary occupancy. A cell is free, unknown, or occupied. The planner avoids occupied cells and searches through free cells. This is enough to teach grid search, and it can work in open spaces where obstacles are far apart and the robot footprint is small relative to cell size.',
        'The next reasonable improvement is to check the footprint only at candidate poses. If the pose is collision-free, keep it. If the footprint overlaps an obstacle, reject it. That catches direct collision and still lets the planner use an ordinary grid or lattice.',
        'The wall is that collision checking alone does not encode preference. Two paths can both be collision-free while one leaves 2 centimeters of clearance and the other leaves 40 centimeters. The first path may fail under localization noise, controller overshoot, or a person moving slightly into the route. The planner needs a graded cost before the final collision check.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Inflation is not new obstacle evidence. It is policy around known obstacles. The obstacle layer says which cells are lethal. The inflation layer spreads a decaying cost outward from those cells so the planner pays more to travel close to danger and less to travel farther away.',
        'That separation is the important data-structure boundary. Perception layers mark and clear evidence. Inflation transforms that evidence into a cost field. Planners and controllers then optimize over the master grid, where clearance is represented as cost instead of as a separate afterthought.',
        'Nav2 documents the inflation layer as an exponential decay around obstacles, with lethal cost around obstacles within the robot fully inscribed radius. In practical terms, the footprint defines what is physically unsafe, the inflation radius defines how far clearance preference extends, and the cost scaling factor defines how quickly that preference fades.',
      ],
    },
    {
      heading: 'How the layer works',
      paragraphs: [
        'Obstacle sources mark lethal cells in the costmap. The inflation layer scans those lethal cells and assigns costs to neighboring cells within the configured inflation radius. Cells very near an obstacle receive high costs. Cells farther away receive lower costs until the cost decays back toward ordinary free space.',
        'Implementations usually precompute distance-to-cost values for cell offsets inside the inflation radius. That avoids recomputing the same distance curve for every obstacle on every update. The layer can then propagate cached costs around lethal cells and merge them into the master grid according to the configured layer rules.',
        'Global and local costmaps use the same idea with different operating constraints. A global costmap may cover the full map and update more slowly. A local costmap often rolls with the robot, incorporates live sensor clearing and marking, and must stay fresh enough for the controller. Both need the same footprint semantics or the global plan and local behavior will disagree.',
        'Layer ordering matters. Static map walls, live obstacles, clearing rays, keepout zones, semantic filters, and inflation do different jobs. A later layer may overwrite, max-merge, or reinterpret earlier values depending on configuration. The final cell color is only the visible result; the debugging question is which layer produced it and when.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The inflation-field view shows distance becoming policy. The occupied cell is the obstacle evidence. The high-cost ring says the robot body or inscribed radius is too close for comfort. The lower-cost outer ring says the route is possible but still less attractive than a path with more clearance.',
        'The decay curve shows why tuning is sensitive. A large inflation radius with a slow decay can make narrow corridors look expensive or blocked. A small radius with a fast decay can let paths hug walls. The parameters do not merely change a display; they change the objective that search algorithms optimize.',
        'The layer-stack view shows provenance. A bad path may come from stale obstacle marks, a wrong frame transform, a static map error, a keepout filter, a footprint mismatch, or the inflation curve. Looking only at the final grid hides the cause. A replayable debug packet needs topics, timestamps, frames, layer settings, and the footprint used at the time.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Inflation works because graph search and trajectory scoring can trade distance against cost. A planner that minimizes path length plus cost will avoid inflated cells when a reasonable alternative exists. Clearance becomes part of route selection before the controller is asked to track the path.',
        'The correctness argument is an engineering invariant, not a proof that every future motion is safe. If the costmap geometry is current, the robot footprint is accurate, and the planner respects costs, then cells near obstacles are consistently less attractive than cells farther away. The search process therefore has a local reason to prefer clearance.',
        'The invariant depends on consistent frames and time. The obstacle observation, map frame, robot base frame, footprint, and costmap timestamp must describe the same world. If a lidar point is transformed with stale TF data or an old obstacle is not cleared, inflation will build a polished cost field around wrong evidence.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Inflation cost grows with the number of cells that must be updated and with the radius measured in cells. A 1 meter inflation radius is more expensive on a 2 centimeter grid than on a 10 centimeter grid because it covers many more offsets. Resolution is a hidden multiplier for both update work and planning work.',
        'Obstacle density also matters. A map with many lethal cells creates many overlapping inflation neighborhoods. Caching distance and cost values helps, but the layer still has to update the affected region. Local rolling windows keep the active area smaller, but they update frequently and have tighter latency budgets.',
        'Behavior changes are often nonlinear. Increasing inflation radius slightly may close a narrow doorway in the cost field. Lowering cost scaling may cause a planner to center itself in corridors. Raising it may make the robot more willing to squeeze through expensive cells. The correct setting depends on footprint, localization quality, controller tracking error, map resolution, and the planner cost model.',
      ],
    },
    {
      heading: 'Tuning and operations',
      paragraphs: [
        'Tune inflation with a concrete behavior target. If the robot hugs walls, check whether the inflation radius is too small, the cost decays too quickly, the planner underweights cost, or the footprint is smaller than the real robot. If the robot refuses a physically passable corridor, check whether the inflated fields overlap too strongly or whether map resolution has made the corridor narrower than reality.',
        'Debug from evidence, not screenshots. Store the costmap topic, raw obstacle topics, TF frames, timestamps, footprint parameters, inflation parameters, planner settings, and local/global costmap windows. A screenshot of a final costmap can show the symptom, but it cannot tell whether the robot routed around a live person, a stale ghost, or an old static-map wall.',
        'Treat clearing as part of inflation quality. A smooth gradient around an obstacle is only useful if the obstacle still exists. Sensor clearing rays, observation persistence, transform latency, and rolling-window bounds decide whether the inflation field represents the current world or a memory of a past scan.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Inflation is strong for classical navigation in offices, warehouses, hospitals, homes, labs, and other spaces where obstacles can be represented as grid costs and where clearance is a useful proxy for safety. It gives A*, Smac planners, DWB-style controllers, and other cost-aware components a shared language for obstacle proximity.',
        'It also wins as a teaching and debugging surface. When a robot chooses the center of a corridor, hugs a shelf, rejects a doorway, jitters near a table, or routes around a sensor ghost, the inflated field often explains the behavior faster than planner code does.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Inflation fails when the underlying obstacle evidence is stale, misframed, or semantically incomplete. A doorway, a person, a chair, a glass wall, a temporary pallet, and a keepout zone may all appear as costs unless other layers add meaning. A social-navigation system may need different behavior around humans than around walls even when the geometry looks similar.',
        'It also fails as the only safety mechanism. Inflation biases path search; it does not model dynamics, stopping distance, actuator limits, moving obstacles, or future human motion. Collision checking, velocity limits, controller constraints, recovery behavior, and fresh perception remain necessary.',
        'Overtuning is a common failure. Teams sometimes lower inflation until the robot squeezes through a demo corridor, then discover that it clips corners in production. The right fix may be a footprint correction, a map correction, a controller limit, or a different planner weight rather than a smaller safety field.',
      ],
    },
    {
      heading: 'Worked case',
      paragraphs: [
        'A robot with a 0.45 meter footprint tries to pass through a 0.9 meter corridor. With a large inflation radius and gentle decay, the inflated fields from both walls overlap. The middle is physically passable but expensive enough that the global planner may avoid the corridor or report no attractive route.',
        'Lowering the radius too far creates the opposite problem. The planner may route close to one wall because the cost field no longer expresses the margin needed for localization and tracking error. The robot looks decisive in simulation and fragile in the real corridor.',
        'The operational fix is a structured check: confirm the real footprint, confirm map resolution, replay obstacle clearing, inspect local and global costmaps separately, check planner cost weights, and compare commanded path with controller tracking error. Inflation is where those assumptions meet in one grid.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Nav2 Costmap 2D docs at https://docs.nav2.org/configuration/packages/configuring-costmaps.html, Nav2 inflation layer docs at https://docs.nav2.org/configuration/packages/costmap-plugins/inflation.html, Nav2 obstacle layer docs at https://docs.nav2.org/configuration/packages/costmap-plugins/obstacle.html, and the Nav2 tuning guide at https://docs.nav2.org/tuning/index.html.',
        'Study Occupancy Grid Log-Odds Mapping for obstacle evidence, A* Search for graph search over grids, Dijkstra and Potential Fields for cost propagation intuition, Quadtree Spatial Index for sparse maps, RRT* Motion Planning Tree for sampling-based planning, Pure Pursuit and Model Predictive Control for path tracking, and Finite State Machines for recovery behavior.',
      ],
    },
  ],
};
