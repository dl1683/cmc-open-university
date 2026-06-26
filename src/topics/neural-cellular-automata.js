// Neural Cellular Automata: learn the local update rule so a grid of cells can
// grow, maintain, and repair target patterns.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'neural-cellular-automata',
  title: 'Neural Cellular Automata',
  category: 'AI & ML',
  summary: 'A learned local-rule system: each cell sees nearby channels, a tiny neural network predicts an update, and global growth emerges from repeated local steps.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['learned local rule', 'growth and repair'], defaultValue: 'learned local rule' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function gridState(title, values) {
  return matrixState({
    title,
    rows: values.map((_, r) => ({ id: `r${r}`, label: '' })),
    columns: values[0].map((_, c) => ({ id: `c${c}`, label: '' })),
    values,
    format: (value) => ['', 'seed', 'body', 'edge', 'hurt'][value],
  });
}

function liveIds(values) {
  const ids = [];
  for (let r = 0; r < values.length; r += 1) {
    for (let c = 0; c < values[r].length; c += 1) {
      if (values[r][c]) ids.push(`r${r}:c${c}`);
    }
  }
  return ids;
}

function ncaGraph(title) {
  return graphState({
    nodes: [
      { id: 'cell', label: 'cell', x: 0.8, y: 3.8, note: 'state channels' },
      { id: 'sense', label: 'sense', x: 2.7, y: 3.8, note: 'neighbors' },
      { id: 'net', label: 'tiny net', x: 4.8, y: 3.8, note: 'shared rule' },
      { id: 'delta', label: 'delta', x: 6.8, y: 3.8, note: 'state update' },
      { id: 'grid', label: 'grid', x: 8.8, y: 3.8, note: 'repeat' },
    ],
    edges: [
      { id: 'e-cell-sense', from: 'cell', to: 'sense', weight: '' },
      { id: 'e-sense-net', from: 'sense', to: 'net', weight: '' },
      { id: 'e-net-delta', from: 'net', to: 'delta', weight: '' },
      { id: 'e-delta-grid', from: 'delta', to: 'grid', weight: '' },
      { id: 'e-grid-cell', from: 'grid', to: 'cell', weight: '' },
    ],
  }, { title });
}

function* learnedLocalRule() {
  const pipelineNodes = ['cell', 'sense', 'tiny net', 'delta', 'grid'];
  const pipelineSteps = pipelineNodes.length;
  yield {
    state: ncaGraph('A neural net replaces the hand-written CA rule'),
    highlight: { active: ['sense', 'net', 'delta'], found: ['grid'] },
    explanation: `A Neural Cellular Automaton keeps the cellular automata structure but learns the local rule. Each cell cycles through ${pipelineSteps} pipeline stages — ${pipelineNodes.join(' → ')} — running the same tiny network on local neighborhood features to update its own state channels.`,
  };

  const channelRows = [
    { id: 'rgb', label: 'RGB' },
    { id: 'alpha', label: 'alpha' },
    { id: 'hidden', label: 'hidden' },
    { id: 'alive', label: 'alive' },
  ];
  const channelCols = [
    { id: 'role', label: 'role' },
    { id: 'why', label: 'why' },
  ];
  yield {
    state: labelMatrix(
      'Cell state has visible and hidden channels',
      channelRows,
      channelCols,
      [
        ['visible color', 'target image'],
        ['occupancy', 'which cells exist'],
        ['memory', 'local coordination'],
        ['mask', 'growth boundary'],
      ],
    ),
    highlight: { active: ['hidden:role', 'alive:role'], found: ['rgb:why'] },
    explanation: `The cell state is organized into ${channelRows.length} channel types across ${channelCols.length} descriptors (role and purpose). Visible channels produce the image; hidden channels let cells carry local memory, coordinate growth, and repair damage without a central map.`,
    invariant: `Each cell sees only its ${channelRows.length} local channels — not the whole target.`,
  };

  const trainingPhases = [
    { id: 'seed', label: 'seed' },
    { id: 'step', label: 'steps' },
    { id: 'loss', label: 'loss' },
    { id: 'grad', label: 'grad' },
  ];
  const stepRange = '32-96';
  yield {
    state: labelMatrix(
      'Training unrolls many update steps',
      trainingPhases,
      [
        { id: 'object', label: 'object' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['single live cell', 'cheap'],
        [`${stepRange} updates`, 'memory grows'],
        ['target image', 'late signal'],
        ['through time', 'expensive'],
      ],
    ),
    highlight: { active: ['step:cost', 'grad:cost'], found: ['loss:object'] },
    explanation: `Training unrolls ${stepRange} update steps across ${trainingPhases.length} phases and backpropagates through the full sequence. That is powerful but memory-heavy, which is why training cost is a central issue.`,
  };

  const growthGrid = [
    [0, 0, 3, 0, 0],
    [0, 3, 2, 3, 0],
    [3, 2, 1, 2, 3],
    [0, 3, 2, 3, 0],
    [0, 0, 3, 0, 0],
  ];
  const growthLive = liveIds(growthGrid);
  yield {
    state: gridState('A target grows from a seed', growthGrid),
    highlight: { active: ['r2:c2'], found: growthLive },
    explanation: `The trained rule is reused at every cell across the ${growthGrid.length}x${growthGrid[0].length} grid. A single seed grows the target pattern because ${growthLive.length} cells receive local updates that propagate information outward.`,
  };
}

function* growthAndRepair() {
  const healthyGrid = [
    [0, 0, 3, 0, 0],
    [0, 3, 2, 3, 0],
    [3, 2, 1, 2, 3],
    [0, 3, 2, 3, 0],
    [0, 0, 3, 0, 0],
  ];
  const gridSize = healthyGrid.length;
  const healthyLive = liveIds(healthyGrid);
  yield {
    state: gridState('Healthy grown pattern', healthyGrid),
    highlight: { found: ['r2:c2', 'r1:c2', 'r2:c1', 'r2:c3', 'r3:c2'] },
    explanation: `A trained NCA is not just a generator. On this ${gridSize}x${gridSize} grid with ${healthyLive.length} live cells, the same rule keeps running so the pattern becomes a dynamical system that maintains itself.`,
  };

  const damagedGrid = [
    [0, 0, 3, 0, 0],
    [0, 4, 0, 3, 0],
    [3, 0, 1, 2, 3],
    [0, 3, 2, 3, 0],
    [0, 0, 3, 0, 0],
  ];
  const damagedCells = damagedGrid.flat().filter(v => v === 4 || v === 0).length;
  const survivingCells = damagedGrid.flat().filter(v => v > 0 && v < 4).length;
  yield {
    state: gridState('Damage removes local cells', damagedGrid),
    highlight: { removed: ['r1:c1', 'r1:c2', 'r2:c1'], active: ['r2:c2', 'r2:c3', 'r3:c2'] },
    explanation: `After damage, ${survivingCells} cells survive while ${damagedCells} positions are dead or hurt. The surviving cells still hold state and can continue applying the learned local rule — this is the self-repair promise.`,
  };

  const repairedGrid = [
    [0, 0, 3, 0, 0],
    [0, 3, 2, 3, 0],
    [3, 2, 1, 2, 3],
    [0, 3, 2, 3, 0],
    [0, 0, 3, 0, 0],
  ];
  const repairedLive = liveIds(repairedGrid);
  yield {
    state: gridState('Local updates regrow the missing part', repairedGrid),
    highlight: { found: ['r1:c1', 'r1:c2', 'r2:c1'], active: ['r2:c2'] },
    explanation: `A robust NCA learns attractor-like behavior: all ${repairedLive.length} live cells in the ${repairedGrid.length}x${repairedGrid[0].length} grid are restored — the target pattern is not merely reached once but recovered after perturbation.`,
    invariant: `Repair is repeated local control across ${repairedGrid.length * repairedGrid[0].length} positions, not a separate global repair program.`,
  };

  const maxStep = 80;
  const damageMarker = { id: 'damage', x: 50, y: 0.46, label: 'damage' };
  const growthPoints = [
    { x: 0, y: 1.0 }, { x: 10, y: 0.72 }, { x: 20, y: 0.40 }, { x: 30, y: 0.18 }, { x: 40, y: 0.08 },
  ];
  const repairPoints = [
    { x: 40, y: 0.08 }, { x: 50, y: 0.46 }, { x: 60, y: 0.25 }, { x: 70, y: 0.12 }, { x: 80, y: 0.07 },
  ];
  yield {
    state: plotState({
      axes: { x: { label: 'update step', min: 0, max: maxStep }, y: { label: 'target error', min: 0, max: 1 } },
      series: [
        { id: 'grow', label: 'growth loss', points: growthPoints },
        { id: 'repair', label: 'after damage', points: repairPoints },
      ],
      markers: [damageMarker],
    }),
    highlight: { active: ['grow', 'repair'], found: ['damage'] },
    explanation: `Over ${maxStep} update steps, growth loss falls from ${growthPoints[0].y} to ${growthPoints[growthPoints.length - 1].y}, then damage at step ${damageMarker.x} spikes error to ${damageMarker.y} before repair brings it back down. A pretty final image is not enough — good NCA evaluation must test growth, persistence, and repair.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'learned local rule') yield* learnedLocalRule();
  else if (view === 'growth and repair') yield* growthAndRepair();
  else throw new InputError('Pick a neural cellular automata view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: ['The first view shows the local update loop. Each cell senses nearby state, passes local features through the same tiny neural network, receives a delta, and repeats that rule across the grid. The growth-and-repair view tests whether the learned dynamics are stable after damage, not merely whether one final frame looks right.', {type: 'image', src: './assets/gifs/neural-cellular-automata.gif', alt: 'Animated walkthrough of the neural cellular automata visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    { heading: 'Why this exists', paragraphs: ['A cellular automaton is a grid of cells updated by a local rule. Neural cellular automata learn that rule instead of hand-writing it. This matters because biological tissue, swarms, and distributed materials coordinate through local signals rather than a central controller.', {type: 'callout', text: 'Neural cellular automata learn one local update rule, then ask repeated local interaction to create and repair the global form.'}]},
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is a normal generator that maps a seed vector to a whole image. That can produce an output, but it does not explain how local parts maintain or repair the pattern after damage. Hand-coding a cellular automaton rule has the opposite problem: it gives local mechanics but does not learn the rule from a target behavior.']},
    { heading: 'The wall', paragraphs: ['The wall is delayed global credit from local action. A cell sees only nearby channels, yet the loss may be measured on the whole final image many steps later. No cell receives a map of the final object, so information must propagate through repeated neighbor interactions.']},
    { heading: 'The core insight', paragraphs: ['The core insight is to give each cell hidden state and reuse one learned rule everywhere. Visible channels produce the image, while hidden channels carry local memory, boundary cues, and repair information. Because weights are shared, the global form must emerge from iterating a local program.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'The shared update rule is a small neural network reused at every cell and every step; weight sharing is what makes the local rule portable. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'}]},
    { heading: 'How it works', paragraphs: ['A typical NCA starts from one live seed cell. At each step, each live or near-live cell reads a neighborhood, often a Moore neighborhood of eight neighbors plus itself, and computes perception features. The shared network predicts a state update, and training backpropagates through many unrolled steps.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/CA-Moore.svg/250px-CA-Moore.svg.png', alt: 'Moore neighborhood diagram with the center cell and its eight neighbors', caption: 'A Moore neighborhood shows the local sensing window: each cell sees nearby state, not the whole target image. Source: Wikimedia Commons, Life of Riley, public domain.'}]},
    { heading: 'Why it works', paragraphs: ['It works when the target can be represented as stable local dynamics. Edge cells learn how to expand, interior cells learn how to preserve state, and surviving cells near damage learn how to regrow missing neighbors. The behavioral correctness test is whether the target is an attractor: nearby or damaged states should return toward it instead of drifting away.']},
    { heading: 'Cost and complexity', paragraphs: ['One update step costs O(number of cells) for fixed neighborhood size and fixed network width. T update steps cost O(T * cells), and training costs more because activations across the unrolled steps are needed for gradients. Doubling grid width and height roughly quadruples the cell work.']},
    { heading: 'Real-world uses', paragraphs: ['NCA is useful for studying morphogenesis, self-repair, local control, artificial life, texture synthesis, and differentiable simulation. It is strongest when the process should keep running after the first output is produced. It also teaches cellular automata, convolution, recurrent computation, and dynamical systems in one small model.']},
    { heading: 'Where it fails', paragraphs: ['NCA fails when the task needs long-range coordination faster than local messages can travel. It also fails under distribution shift: a rule trained on one grid size, seed, damage type, or update schedule may fail on another. A final frame is not enough evidence; test variable step counts, repeated damage, larger canvases, and hidden-channel perturbations.']},
    { heading: 'Worked example', paragraphs: ['Use a 5 by 5 grid with one live seed at the center. If each cell has 16 channels and the rule runs for 40 steps, inference updates 25 * 40 = 1,000 cell states. If damage removes 3 cells and repair runs 30 more steps, that adds 25 * 30 = 750 local updates.']},
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Growing Neural Cellular Automata from Distill, Self-Organising Textures, and related work on differentiable self-organization. Study cellular automata, convolution, recurrent networks, backpropagation through time, attractors, and quality-diversity search next.']},
  ],
};
