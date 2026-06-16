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
  yield {
    state: ncaGraph('A neural net replaces the hand-written CA rule'),
    highlight: { active: ['sense', 'net', 'delta'], found: ['grid'] },
    explanation: 'A Neural Cellular Automaton keeps the cellular automata structure but learns the local rule. Every cell runs the same tiny network on local neighborhood features and updates its own state channels.',
  };

  yield {
    state: labelMatrix(
      'Cell state has visible and hidden channels',
      [
        { id: 'rgb', label: 'RGB' },
        { id: 'alpha', label: 'alpha' },
        { id: 'hidden', label: 'hidden' },
        { id: 'alive', label: 'alive' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'why', label: 'why' },
      ],
      [
        ['visible color', 'target image'],
        ['occupancy', 'which cells exist'],
        ['memory', 'local coordination'],
        ['mask', 'growth boundary'],
      ],
    ),
    highlight: { active: ['hidden:role', 'alive:role'], found: ['rgb:why'] },
    explanation: 'The visible channels produce the image or structure. Hidden channels let cells carry local memory, coordinate growth, and repair damage without a central map.',
    invariant: 'Each cell sees only local channels, not the whole target.',
  };

  yield {
    state: labelMatrix(
      'Training unrolls many update steps',
      [
        { id: 'seed', label: 'seed' },
        { id: 'step', label: 'steps' },
        { id: 'loss', label: 'loss' },
        { id: 'grad', label: 'grad' },
      ],
      [
        { id: 'object', label: 'object' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['single live cell', 'cheap'],
        ['32-96 updates', 'memory grows'],
        ['target image', 'late signal'],
        ['through time', 'expensive'],
      ],
    ),
    highlight: { active: ['step:cost', 'grad:cost'], found: ['loss:object'] },
    explanation: 'Training backpropagates through many repeated update steps. That is powerful but memory-heavy, which is why the local corpus highlights training cost as a central issue.',
  };

  yield {
    state: gridState('A target grows from a seed', [
      [0, 0, 3, 0, 0],
      [0, 3, 2, 3, 0],
      [3, 2, 1, 2, 3],
      [0, 3, 2, 3, 0],
      [0, 0, 3, 0, 0],
    ]),
    highlight: { active: ['r2:c2'], found: liveIds([
      [0, 0, 3, 0, 0],
      [0, 3, 2, 3, 0],
      [3, 2, 1, 2, 3],
      [0, 3, 2, 3, 0],
      [0, 0, 3, 0, 0],
    ]) },
    explanation: 'The trained rule is reused at every cell and every step. A single seed can grow a target pattern because local updates propagate information outward.',
  };
}

function* growthAndRepair() {
  yield {
    state: gridState('Healthy grown pattern', [
      [0, 0, 3, 0, 0],
      [0, 3, 2, 3, 0],
      [3, 2, 1, 2, 3],
      [0, 3, 2, 3, 0],
      [0, 0, 3, 0, 0],
    ]),
    highlight: { found: ['r2:c2', 'r1:c2', 'r2:c1', 'r2:c3', 'r3:c2'] },
    explanation: 'A trained NCA is not just a generator. Because the same rule keeps running, the pattern can become a dynamical system that maintains itself.',
  };

  yield {
    state: gridState('Damage removes local cells', [
      [0, 0, 3, 0, 0],
      [0, 4, 0, 3, 0],
      [3, 0, 1, 2, 3],
      [0, 3, 2, 3, 0],
      [0, 0, 3, 0, 0],
    ]),
    highlight: { removed: ['r1:c1', 'r1:c2', 'r2:c1'], active: ['r2:c2', 'r2:c3', 'r3:c2'] },
    explanation: 'If part of the pattern is damaged, nearby cells still hold state and can continue applying the learned local rule. This is the self-repair promise.',
  };

  yield {
    state: gridState('Local updates regrow the missing part', [
      [0, 0, 3, 0, 0],
      [0, 3, 2, 3, 0],
      [3, 2, 1, 2, 3],
      [0, 3, 2, 3, 0],
      [0, 0, 3, 0, 0],
    ]),
    highlight: { found: ['r1:c1', 'r1:c2', 'r2:c1'], active: ['r2:c2'] },
    explanation: 'A robust NCA learns attractor-like behavior: the target pattern is not merely reached once; it can be recovered after perturbation.',
    invariant: 'Repair is repeated local control, not a separate global repair program.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'update step', min: 0, max: 80 }, y: { label: 'target error', min: 0, max: 1 } },
      series: [
        { id: 'grow', label: 'growth loss', points: [
          { x: 0, y: 1.0 }, { x: 10, y: 0.72 }, { x: 20, y: 0.40 }, { x: 30, y: 0.18 }, { x: 40, y: 0.08 },
        ] },
        { id: 'repair', label: 'after damage', points: [
          { x: 40, y: 0.08 }, { x: 50, y: 0.46 }, { x: 60, y: 0.25 }, { x: 70, y: 0.12 }, { x: 80, y: 0.07 },
        ] },
      ],
      markers: [
        { id: 'damage', x: 50, y: 0.46, label: 'damage' },
      ],
    }),
    highlight: { active: ['grow', 'repair'], found: ['damage'] },
    explanation: 'Good NCA evaluation should test growth, persistence, repair after damage, and sensitivity to step count. A pretty final image is not enough.',
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
    {
      heading: 'What it is',
      paragraphs: [
        'Neural Cellular Automata replace a hand-written cellular-automaton rule with a learned local neural update. Each cell stores visible and hidden channels. At every step, the cell observes nearby channels, passes them through a small shared neural network, and adds the predicted update to its own state. Repeating that local rule across a grid can grow a target image or structure.',
        'The key design choice is locality. The model is not handed a global blueprint at every step. It must coordinate through neighbor communication and hidden state. This makes NCA a natural bridge between Cellular Automata, neural networks, developmental systems, and self-repairing computation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A standard NCA pipeline starts from a seed cell. The learned update rule is applied for many steps. A loss compares the visible channels to a target image or desired structure. Backpropagation flows through the unrolled update sequence, training the local rule so the population of cells collectively reaches the target. Stochastic cell updates can make the rule robust to asynchronous execution.',
        'Hidden channels matter because local cells need memory. A cell may need to know whether it is near an edge, whether growth should continue, or whether a damaged region needs repair. That information is not stored centrally. It emerges from local state propagation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'One NCA update is O(number of cells) for a fixed neighborhood and fixed-size update network. Training is more expensive because the system is unrolled over many update steps and gradients must flow through that unrolled computation. Longer developmental horizons increase memory use and can make optimization unstable. This is why the local corpus points toward alternatives such as quality-diversity search and intrinsically motivated exploration for discovering many self-organized outcomes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'NCA research is used for image generation, texture synthesis, morphogenesis, self-repair, differentiable simulations, soft-robot growth analogies, and artificial-life experiments. It is also a useful mental model for distributed systems: local agents with limited information can still maintain global behavior if the local rules are well designed or learned.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not confuse a successful target image with general intelligence. Many NCAs are trained for one target and may not discover new structures by themselves. Repair can also be narrow: a model may recover from damage seen during training but fail under different perturbations. A robust NCA claim should report growth from seed, long-run stability, damage recovery, multiple seeds, and sensitivity to update steps.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Growing Neural Cellular Automata at https://distill.pub/2020/growing-ca/, the arXiv version at https://arxiv.org/abs/2005.06700, Self-Organising Textures at https://distill.pub/selforg/2021/textures/, and Sebastian Risi on self-organizing AI at https://sebastianrisi.com/self_assembling_ai/. Study Cellular Automata, Quality Diversity: MAP-Elites, Hebbian Plasticity, Self-Organizing AI Design Pattern, Gradient Flow, Convolution, and Evolutionary Search next.',
      ],
    },
  ],
};
