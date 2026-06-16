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
    { heading: 'What it is', paragraphs: ['An occupancy grid discretizes space into cells and stores the probability that each cell is occupied. Robotics stacks use it for mapping, localization, planning, and obstacle avoidance.'] },
    { heading: 'How it works', paragraphs: ['Each sensor observation updates cells with an inverse sensor model. Freespace rays lower occupancy; obstacle hits raise occupancy. Log-odds make those updates additive and easy to saturate.'] },
    { heading: 'Case study', paragraphs: ['A lidar ray travels through three cells before hitting a wall. The first three cells receive freespace updates and the endpoint receives an occupied update. Repeated scans increase confidence.'] },
    { heading: 'Pitfalls', paragraphs: ['Bad pose estimates smear the map. Dynamic objects create stale occupied cells. Missing timestamp and calibration metadata makes replay hard. Overconfident saturation can prevent recovery when the world changes.'] },
    { heading: 'Why it matters', paragraphs: ['Occupancy grids are arrays with probabilistic semantics. They connect sensor models, ray traversal, map evidence, and costmap planning.'] },
    { heading: 'Sources and study next', paragraphs: ['Study sources: Thrun occupancy-grid paper at https://robots.stanford.edu/papers/thrun.iros01-occmap.pdf and occupancy-grid project overview at https://yangfan.github.io/projects/mapping/grid-map/. Study Kalman Filter Sensor Fusion, Particle Filter Localization, Quadtree Spatial Index, and Nav2 Costmap Inflation next.'] },
  ],
};
