// Cellular automata: a grid of local states updated by the same local rule,
// producing global patterns without a central controller.

import { matrixState, graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'cellular-automata',
  title: 'Cellular Automata',
  category: 'Concepts',
  summary: 'A grid of cells updates from local neighbor rules; simple local mechanics create gliders, waves, growth, and surprising global structure.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['life rule', 'local to global'], defaultValue: 'life rule' },
  ],
  run,
};

const rows = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, label: '' }));
const cols = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, label: '' }));

function gridState(title, grid) {
  return matrixState({
    title,
    rows,
    columns: cols,
    values: grid,
    format: (value) => (value ? '1' : ''),
  });
}

function liveIds(grid) {
  const ids = [];
  for (let r = 0; r < grid.length; r += 1) {
    for (let c = 0; c < grid[r].length; c += 1) {
      if (grid[r][c]) ids.push(`r${r}:c${c}`);
    }
  }
  return ids;
}

function neighbors(grid, r, c) {
  let count = 0;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < grid.length && cc >= 0 && cc < grid[rr].length) count += grid[rr][cc] ? 1 : 0;
    }
  }
  return count;
}

function nextLife(grid) {
  return grid.map((row, r) => row.map((alive, c) => {
    const n = neighbors(grid, r, c);
    return alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
  }));
}

const glider0 = [
  [0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0],
  [1, 1, 1, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
];
const glider1 = nextLife(glider0);
const glider2 = nextLife(glider1);

function* lifeRule() {
  yield {
    state: gridState('Initial live cells', glider0),
    highlight: { active: liveIds(glider0) },
    explanation: 'A cellular automaton stores one state per grid cell. In Conway Life, every cell applies the same local rule by counting its eight neighbors.',
  };

  yield {
    state: gridState('Neighbor count decides each cell', [
      [1, 1, 2, 1, 0],
      [3, 5, 3, 2, 0],
      [1, 3, 2, 2, 0],
      [2, 3, 2, 1, 0],
      [0, 0, 0, 0, 0],
    ]),
    highlight: { active: ['r1:c1', 'r1:c2', 'r2:c1'], compare: ['r0:c0', 'r3:c0'] },
    explanation: 'The rule is local: live cells survive with two or three live neighbors; dead cells become live with exactly three. No cell sees the whole grid.',
    invariant: 'The next grid depends only on the previous grid, not on update order.',
  };

  yield {
    state: gridState('After one synchronous update', glider1),
    highlight: { found: liveIds(glider1), removed: liveIds(glider0).filter((id) => !liveIds(glider1).includes(id)) },
    explanation: 'All cells update simultaneously from the previous snapshot. This avoids a left-to-right bias and makes the automaton a clean state-transition system.',
  };

  yield {
    state: gridState('After two updates: motion emerges', glider2),
    highlight: { found: liveIds(glider2), compare: liveIds(glider0) },
    explanation: 'The global pattern appears to move, but no cell was told to move. Motion is an emergent property of repeated local rules.',
  };
}

function* localToGlobal() {
  yield {
    state: graphState({
      nodes: [
        { id: 'cell', label: 'cell', x: 1.0, y: 3.8, note: 'state' },
        { id: 'nbrs', label: 'neighbors', x: 3.0, y: 3.8, note: 'local view' },
        { id: 'rule', label: 'rule', x: 5.0, y: 3.8, note: 'same for all' },
        { id: 'next', label: 'next cell', x: 7.0, y: 3.8, note: 'new state' },
        { id: 'world', label: 'world', x: 9.0, y: 3.8, note: 'pattern' },
      ],
      edges: [
        { id: 'e-cell-nbrs', from: 'cell', to: 'nbrs', weight: '' },
        { id: 'e-nbrs-rule', from: 'nbrs', to: 'rule', weight: '' },
        { id: 'e-rule-next', from: 'rule', to: 'next', weight: '' },
        { id: 'e-next-world', from: 'next', to: 'world', weight: '' },
      ],
    }, { title: 'No central controller is required' }),
    highlight: { active: ['cell', 'nbrs', 'rule'], found: ['world'] },
    explanation: 'Cellular automata are a minimal model of self-organization: a shared local rule, many simple units, and global structure from repeated interaction.',
  };

  yield {
    state: gridState('Different rules create different worlds', [
      [1, 0, 1, 0, 1],
      [0, 1, 1, 1, 0],
      [1, 1, 0, 1, 1],
      [0, 1, 1, 1, 0],
      [1, 0, 1, 0, 1],
    ]),
    highlight: { active: ['r1:c1', 'r1:c2', 'r1:c3', 'r2:c0', 'r2:c4'] },
    explanation: 'Change the rule and the same grid can make still lifes, oscillators, gliders, waves, or chaotic noise. The data structure is simple; the dynamics are the hard part.',
  };

  yield {
    state: gridState('Damage can be local too', [
      [0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [1, 1, 1, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]),
    highlight: { removed: ['r1:c2'], active: ['r2:c0', 'r2:c1', 'r2:c2'] },
    explanation: 'Because state is distributed, a local fault does not necessarily destroy the whole system. This is the intuition behind self-repairing and developmental models.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'ca', label: 'CA', x: 1.0, y: 3.8, note: 'fixed rule' },
        { id: 'nca', label: 'NCA', x: 3.6, y: 2.4, note: 'learned rule' },
        { id: 'qd', label: 'QD', x: 3.6, y: 5.2, note: 'many outcomes' },
        { id: 'bio', label: 'bio', x: 6.2, y: 3.8, note: 'growth/repair' },
        { id: 'systems', label: 'systems', x: 8.6, y: 3.8, note: 'robust local control' },
      ],
      edges: [
        { id: 'e-ca-nca', from: 'ca', to: 'nca', weight: '' },
        { id: 'e-ca-qd', from: 'ca', to: 'qd', weight: '' },
        { id: 'e-nca-bio', from: 'nca', to: 'bio', weight: '' },
        { id: 'e-qd-bio', from: 'qd', to: 'bio', weight: '' },
        { id: 'e-bio-systems', from: 'bio', to: 'systems', weight: '' },
      ],
    }, { title: 'Why this matters beyond Life' }),
    highlight: { found: ['nca', 'qd', 'systems'] },
    explanation: 'Cellular automata are the gateway to Neural Cellular Automata, quality-diversity search, developmental systems, and robust local-control designs.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'life rule') yield* lifeRule();
  else if (view === 'local to global') yield* localToGlobal();
  else throw new InputError('Pick a cellular automata view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A cellular automaton is a grid of cells where each cell stores a state and updates according to a local rule. The rule reads a fixed neighborhood, such as the eight surrounding cells in Conway Life, and writes the next state. Every cell uses the same rule. The entire grid advances in synchronous time steps, so the next world is a deterministic function of the previous world.',
        'The idea is a small data structure with large consequences. A two-dimensional array plus a local transition rule can produce still lifes, oscillators, gliders, chaotic patterns, waves, and self-organizing behavior. There is no global planner telling a glider to move. Motion emerges from repeated local updates.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Conway Life is the canonical example. A live cell survives when it has two or three live neighbors. A dead cell becomes live when it has exactly three live neighbors. Otherwise the cell is dead in the next step. The important implementation detail is double buffering: compute the next grid from the old grid, then swap. Updating in place would make later cells see already-updated neighbors and change the rule.',
        'The same architecture generalizes. Cells can have more states than alive/dead. Neighborhoods can be one-dimensional, two-dimensional, hexagonal, continuous, stochastic, or learned. Neural Cellular Automata replace the hand-written rule with a small neural network that reads local channels and writes state updates.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For a grid with n cells and a constant-size neighborhood, one update costs O(n). Memory is O(n) for the current grid plus O(n) for a next buffer, unless the rule and update schedule allow a more specialized implementation. The expensive part is usually not one step; it is simulating many steps, searching rule spaces, or training learned update rules through long unrolled sequences.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Cellular automata appear in artificial life, graphics, simulations, image processing, traffic models, terrain generation, physical modeling, procedural content, and research on self-organization. They are also a conceptual bridge to distributed systems: local agents follow local rules, but the global system has behavior that no individual component explicitly stores.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Emergence is not magic. It is the long-run consequence of a state representation, a neighborhood, an update rule, boundary conditions, and initial conditions. Small rule changes can produce radically different dynamics. Another common mistake is forgetting synchronization: in-place updates define a different automaton than synchronous updates. Finally, attractive patterns are not automatically useful; a system needs a task, metric, or robustness goal.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources and references: Martin Gardner on Conway Life at https://web.stanford.edu/class/sts145/Library/life.pdf, Cellular Automata in Scholarpedia at http://www.scholarpedia.org/article/Cellular_automata, and the Stanford Encyclopedia entry on cellular automata at https://plato.stanford.edu/entries/cellular-automata/. Study Neural Cellular Automata, Quality Diversity: MAP-Elites, Self-Organizing AI Design Pattern, Finite State Machines, Dynamic Programming, Graph BFS, and Evolutionary Search next.',
      ],
    },
  ],
};
