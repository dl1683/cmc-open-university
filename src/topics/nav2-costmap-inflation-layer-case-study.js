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
    { heading: 'How to read the animation', paragraphs: ['Read the grid as a cost field. A costmap is a 2D grid where each cell stores how undesirable it is for the robot to occupy or cross that area.', 'The active obstacle cell is evidence from a map or sensor. The expanding rings are not new obstacles; they are policy costs that make nearby free cells less attractive to the planner.', {type:'callout', text:'Inflation turns obstacle evidence into a clearance cost field, so path search can prefer safer space before final collision checks.'}] },
    { heading: 'Why this exists', paragraphs: ['A robot is not a point. It has width, localization error, controller lag, wheel slip, and stopping distance.', 'A binary grid that says free or occupied can still produce paths that scrape walls. The inflation layer adds a graded clearance preference before the final collision check.'] },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is binary occupancy. A planner rejects occupied cells and searches through free cells, which is enough for toy grids and wide open spaces.', 'A second approach is footprint checking only at candidate poses. That catches direct collision, but it does not distinguish a path with 2 cm clearance from a path with 40 cm clearance.'] },
    { heading: 'The wall', paragraphs: ['The wall is that safety margin is continuous while the grid is discrete. Two legal paths can both avoid occupied cells while one leaves no usable tolerance for tracking error.', 'Tuning also changes behavior in nonlinear ways. A small radius change can make a doorway expensive enough to avoid, and a small decay change can make a robot hug shelves.'] },
    { heading: 'The core insight', paragraphs: ['Inflation separates obstacle evidence from navigation preference. Obstacle layers decide which cells are lethal, and the inflation layer transforms those cells into a distance-based cost field.', 'That field lets graph search trade path length against clearance. The planner does not need a separate warning that a wall is nearby because the cost is already in the grid it optimizes.'] },
    { heading: 'How it works', paragraphs: ['The layer scans lethal cells and assigns costs to neighboring cells within the inflation radius. Cells inside the inscribed radius are treated as too close for the robot body, and farther cells receive lower costs by an exponential decay.', 'Implementations usually cache distance-to-cost values for cell offsets. That makes updates cheaper because many obstacles reuse the same radius geometry at the current map resolution.'] },
    { heading: 'Why it works', paragraphs: ['The correctness argument is an invariant about monotone clearance cost. If obstacle evidence is current, the footprint is accurate, and the planner respects costs, then cells closer to obstacles are never cheaper than comparable cells farther away.', 'This does not prove future motion is safe. It proves that the route selection stage has a consistent reason to prefer clearance before a controller and collision checker execute the path.'] },
    { heading: 'Cost and complexity', paragraphs: ['Inflation cost grows with updated cells and with radius measured in grid cells. A 1 m radius covers about 100 cells across on a 2 cm grid, but only 20 cells across on a 10 cm grid.', 'Resolution is the hidden multiplier. Doubling map resolution in both dimensions roughly quadruples grid cells and can make the same physical inflation radius much more expensive to update.'] },
    { heading: 'Real-world uses', paragraphs: ['Inflation is used in office, warehouse, hospital, lab, and home robots that navigate with 2D costmaps. It gives A*, Smac planners, and local trajectory critics a shared language for obstacle proximity.', 'It is also a debugging tool. When a robot rejects a doorway or centers itself in a corridor, the inflated field often explains the choice before planner code does.'] },
    { heading: 'Where it fails', paragraphs: ['Inflation fails when obstacle evidence is stale, misframed, or semantically wrong. A smooth cost field around a sensor ghost is still a wrong cost field.', 'It also fails as the only safety mechanism. Moving obstacles, stopping distance, actuator limits, and human behavior need controller constraints, perception updates, and recovery policy.'] },
    { heading: 'Worked example', paragraphs: ['A robot is 0.45 m wide and drives through a 0.90 m corridor on a 5 cm grid. The centerline leaves 22.5 cm to each wall before error, so a 0.30 m inflation radius from both walls overlaps through the corridor.', 'If the cost scaling factor decays slowly, the center cells can remain expensive even though the corridor is physically passable. Reducing the radius to 0.20 m may open the route, but it also removes margin that localization error might need.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources are the Nav2 costmap configuration docs, the Nav2 inflation layer docs, the obstacle layer docs, and the Nav2 tuning guide. Read the footprint and resolution settings with the inflation parameters.', 'Study occupancy grid log-odds, A* search, Dijkstra cost propagation, local trajectory critics, pure pursuit, and model predictive control next. The practical lesson is that a cost field is a policy, not a decoration.'] },
  ],
};