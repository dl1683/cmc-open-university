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
      heading: 'Why this exists',
      paragraphs: [
        'Cellular automata ask how much global structure can emerge from local rules. Each cell stores a small state, sees a local neighborhood, and applies the same transition rule as every other cell. There is no central controller telling the whole grid what shape to make.',
        'That makes them a clean model for self-organization. A few lines of local logic can produce still lifes, oscillators, gliders, waves, chaotic fields, and growth-like behavior. The point is not that every real system is a cellular automaton. The point is that local interaction can be enough to create surprising global dynamics.',
        'They are also useful because they remove excuses. There is no hidden neural network, no scheduler, no global planner, and no complex data structure behind the curtain. If a pattern moves, repairs, repeats, or becomes chaotic, it happened through local state transitions. That makes cellular automata one of the cleanest teaching tools for emergence, distributed control, and simulation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'If you want a moving pattern on a grid, the obvious approach is to store an object and move its coordinates. Conway Life does not do that. It stores only live or dead cells. A glider appears to move because the pattern repeatedly destroys and recreates itself one offset away.',
        'That difference matters. Movement is not an explicit operation in the rule. It is an emergent consequence of the update rule. This is why cellular automata are useful for teaching emergence without mysticism: every step is local and deterministic, but the repeated composition of steps produces behavior that is easier to describe at a higher level.',
        'The same mistake appears in larger systems. People often look for a manager object, a master node, or a complete blueprint. Cellular automata show another design shape: make each unit respond to nearby information, make the update rule consistent, and let the global state be the accumulated result. That is not always the right design, but it is a real option.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is the synchronous snapshot. The next grid must be computed from the previous grid, not from partially updated cells. If you update in place from left to right, later cells see a different world than earlier cells, and you have built a different automaton.',
        'Four choices define the system: the state alphabet, the neighborhood, the boundary condition, and the transition rule. In Life, the state alphabet is live/dead, the neighborhood is the eight surrounding cells, and the rule is survival with two or three neighbors and birth with exactly three. Change any part and the world can behave differently.',
        'The boundary condition deserves special attention. A finite grid can treat edges as dead space, wrap around like a torus, or grow dynamically. Those choices change whether patterns die at the edge, re-enter from the other side, or keep expanding. Many bad demonstrations quietly hide the boundary rule, then overinterpret behavior that only exists because the edge was chosen a certain way.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each update, count a cell\'s live neighbors. A live cell survives if it has two or three live neighbors; otherwise it dies from isolation or overcrowding. A dead cell becomes live if it has exactly three live neighbors. Every cell applies that rule to the old grid, and the collection of new states becomes the next grid.',
        'The glider in the visual is a compact example. The live cells at one step create neighbor counts that produce a shifted pattern at later steps. No cell has identity across the motion. The pattern, not the individual cell, is the object that persists.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The Life-rule view shows the two-step mechanics: count neighbors, then apply the survival and birth rules. The update is intentionally simple so the reader can trace every live and dead cell without trusting a black box.',
        'The local-to-global view is the conceptual lesson. The same local update rule can create global motion, local damage effects, and different worlds under different rules. The system is distributed because every cell has the same authority: read local state, compute next local state, repeat.',
        'The glider is the important proof object. It shows that a pattern can have a higher-level identity even when no individual cell carries that identity through time. The live cells at step one are not the same live cells at step five, yet the pattern persists. That distinction is the bridge from simple grids to more serious ideas about information flow in distributed systems.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because local constraints propagate. A cell only changes because of its neighbors, but those neighbors were changed by their neighbors in the previous step. Over time, information moves through the grid even though no cell sees far away. That propagation is enough to create waves, moving patterns, and long-lived structures.',
        'It also works because repeated deterministic rules can have attractors. Some patterns settle, some oscillate, some move, and some explode into complex fields. The same initial local mechanics can generate behavior that looks higher-level because humans describe stable repeated structures as objects.',
        'The lesson is not that simple rules always create complexity. Most rules create boring death, repetitive noise, or uncontrolled growth. The interesting cases live in a narrow middle region where the rule preserves enough structure for patterns to survive but permits enough change for those patterns to interact. That balance is why the subject matters for artificial life and learned local control.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'For n cells and a constant-size neighborhood, one update costs O(n). A standard simulation stores the current grid and a next grid, so memory is O(n). Sparse implementations can be faster for mostly empty worlds by tracking active cells and nearby candidates instead of scanning every location.',
        'The tradeoff is steerability. Cellular automata are easy to run and hard to design. Small rule changes can destroy the desired behavior, and short demos can hide long-run instability. A visually interesting pattern is not automatically useful without a task, a robustness test, or a reason to prefer local control.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Cellular automata are useful for artificial life, procedural textures, terrain generation, traffic models, simple physical simulations, image effects, and teaching distributed local control. They are also a bridge into agent-based modeling, reaction-diffusion systems, and learned local update rules.',
        'They prepare readers for Neural Cellular Automata, where the hand-written rule becomes a small learned network. The conceptual jump is natural: keep the grid and local update, but learn the rule that grows or repairs the target.',
        'They also help in systems thinking. Cache invalidation, epidemic spread, traffic flow, load propagation, fire simulation, and local consensus all involve repeated local interactions. Real versions usually need richer state and stochastic rules, but the automaton gives the clean skeleton: local observation, local transition, global behavior.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Do not invoke emergence as an explanation by itself. You still need to specify the state representation, neighborhood, rule, boundary, initial condition, and evaluation metric. Without those details, emergence becomes a label for surprise rather than a mechanism.',
        'Do not assume the visible pattern is robust. Test different initial states, larger grids, boundary choices, update counts, and perturbations. Many cellular automata have beautiful short-run behavior and useless long-run behavior for the task you actually care about.',
        'Do not confuse simulation convenience with realism. A grid, synchronous update, and uniform rule are modeling assumptions. Some real systems update asynchronously, have long-range interactions, carry continuous values, or change their own rules. Cellular automata are powerful because they isolate one mechanism, not because they automatically describe every spatial system.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Martin Gardner on Conway Life at https://web.stanford.edu/class/sts145/Library/life.pdf, Cellular Automata in Scholarpedia at http://www.scholarpedia.org/article/Cellular_automata, and the Stanford Encyclopedia entry at https://plato.stanford.edu/entries/cellular-automata/. Study Neural Cellular Automata, Finite State Machines, Graph BFS, Dynamic Programming, Quality Diversity: MAP-Elites, and Evolutionary Search next.',
        'A good exercise is to implement Life twice: once with a full dense grid and once with a sparse active-cell set. The behavior should match, but the performance profile will not. That exercise connects the mathematical rule to data-structure choices and makes the cost model concrete.',
      ],
    },
  ],
};
