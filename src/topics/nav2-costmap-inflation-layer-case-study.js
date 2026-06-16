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
    { heading: 'What it is', paragraphs: ['A costmap is a grid used by robot planners and controllers. The inflation layer expands obstacle costs around lethal cells so the robot keeps clearance from walls, people, and furniture.'] },
    { heading: 'How it works', paragraphs: ['Obstacle layers mark occupied cells. Inflation applies a decaying cost around those cells based on footprint radius, inflation radius, and cost scaling. Planners then optimize over the inflated cost field.'] },
    { heading: 'Case study', paragraphs: ['A robot can physically fit through a corridor but keeps scraping walls. Raising inflation cost or footprint radius pushes the planned path toward the center. If the corridor becomes blocked, the radius may be too large.'] },
    { heading: 'Pitfalls', paragraphs: ['Inflation is not evidence of obstacles. It is a safety margin. Bad timestamps, TF frames, stale obstacle cells, and wrong footprint geometry can make good planners behave badly.'] },
    { heading: 'Why it matters', paragraphs: ['Costmaps are the interface between perception and motion planning. They are layered grids with policy semantics, not just pictures of obstacles.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Nav2 Costmap 2D docs at https://docs.nav2.org/configuration/packages/configuring-costmaps.html and Nav2 inflation layer docs at https://docs.nav2.org/configuration/packages/costmap-plugins/inflation.html. Study Occupancy Grid Mapping, A* Search, Quadtree Spatial Index, and Finite State Machine next.'] },
  ],
};
