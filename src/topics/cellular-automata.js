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
  const initialLive = liveIds(glider0);
  yield {
    state: gridState('Initial live cells', glider0),
    highlight: { active: initialLive },
    explanation: `A cellular automaton stores one state per grid cell. In Conway Life, every cell applies the same local rule by counting its eight neighbors. This glider starts with ${initialLive.length} live cells.`,
  };

  const neighborHighCells = ['r1:c1', 'r1:c2', 'r2:c1'];
  const neighborGrid = [
    [1, 1, 2, 1, 0],
    [3, 5, 3, 2, 0],
    [1, 3, 2, 2, 0],
    [2, 3, 2, 1, 0],
    [0, 0, 0, 0, 0],
  ];
  yield {
    state: gridState('Neighbor count decides each cell', neighborGrid),
    highlight: { active: neighborHighCells, compare: ['r0:c0', 'r3:c0'] },
    explanation: `The rule is local: live cells survive with two or three live neighbors; dead cells become live with exactly three. The center cell at ${neighborHighCells[0]} has ${neighborGrid[1][1]} neighbors. No cell sees the whole grid.`,
    invariant: `The next ${neighborGrid.length}x${neighborGrid[0].length} grid depends only on the previous grid, not on update order.`,
  };

  const gen1Live = liveIds(glider1);
  const diedCells = liveIds(glider0).filter((id) => !gen1Live.includes(id));
  yield {
    state: gridState('After one synchronous update', glider1),
    highlight: { found: gen1Live, removed: diedCells },
    explanation: `All ${glider1.length * glider1[0].length} cells update simultaneously from the previous snapshot. ${diedCells.length} cell(s) died this step. This avoids a left-to-right bias and makes the automaton a clean state-transition system.`,
  };

  const gen2Live = liveIds(glider2);
  yield {
    state: gridState('After two updates: motion emerges', glider2),
    highlight: { found: gen2Live, compare: liveIds(glider0) },
    explanation: `The global pattern appears to move with ${gen2Live.length} live cells after two updates, but no cell was told to move. Motion is an emergent property of repeated local rules.`,
  };
}

function* localToGlobal() {
  const pipelineNodes = [
    { id: 'cell', label: 'cell', x: 1.0, y: 3.8, note: 'state' },
    { id: 'nbrs', label: 'neighbors', x: 3.0, y: 3.8, note: 'local view' },
    { id: 'rule', label: 'rule', x: 5.0, y: 3.8, note: 'same for all' },
    { id: 'next', label: 'next cell', x: 7.0, y: 3.8, note: 'new state' },
    { id: 'world', label: 'world', x: 9.0, y: 3.8, note: 'pattern' },
  ];
  yield {
    state: graphState({
      nodes: pipelineNodes,
      edges: [
        { id: 'e-cell-nbrs', from: 'cell', to: 'nbrs', weight: '' },
        { id: 'e-nbrs-rule', from: 'nbrs', to: 'rule', weight: '' },
        { id: 'e-rule-next', from: 'rule', to: 'next', weight: '' },
        { id: 'e-next-world', from: 'next', to: 'world', weight: '' },
      ],
    }, { title: 'No central controller is required' }),
    highlight: { active: ['cell', 'nbrs', 'rule'], found: ['world'] },
    explanation: `Cellular automata are a minimal model of self-organization: a ${pipelineNodes.length}-stage pipeline from ${pipelineNodes[0].label} to ${pipelineNodes[pipelineNodes.length - 1].label}, using a shared local rule, many simple units, and global structure from repeated interaction.`,
  };

  const altGrid = [
    [1, 0, 1, 0, 1],
    [0, 1, 1, 1, 0],
    [1, 1, 0, 1, 1],
    [0, 1, 1, 1, 0],
    [1, 0, 1, 0, 1],
  ];
  const altActive = ['r1:c1', 'r1:c2', 'r1:c3', 'r2:c0', 'r2:c4'];
  yield {
    state: gridState('Different rules create different worlds', altGrid),
    highlight: { active: altActive },
    explanation: `Change the rule and the same ${altGrid.length}x${altGrid[0].length} grid can make still lifes, oscillators, gliders, waves, or chaotic noise. ${altActive.length} cells are highlighted. The data structure is simple; the dynamics are the hard part.`,
  };

  const removedCell = ['r1:c2'];
  const survivingActive = ['r2:c0', 'r2:c1', 'r2:c2'];
  yield {
    state: gridState('Damage can be local too', [
      [0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [1, 1, 1, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]),
    highlight: { removed: removedCell, active: survivingActive },
    explanation: `Because state is distributed, a local fault at ${removedCell[0]} does not necessarily destroy the whole system. ${survivingActive.length} cells remain active. This is the intuition behind self-repairing and developmental models.`,
  };

  const nextTopics = ['nca', 'qd', 'systems'];
  const nextNodes = [
    { id: 'ca', label: 'CA', x: 1.0, y: 3.8, note: 'fixed rule' },
    { id: 'nca', label: 'NCA', x: 3.6, y: 2.4, note: 'learned rule' },
    { id: 'qd', label: 'QD', x: 3.6, y: 5.2, note: 'many outcomes' },
    { id: 'bio', label: 'bio', x: 6.2, y: 3.8, note: 'growth/repair' },
    { id: 'systems', label: 'systems', x: 8.6, y: 3.8, note: 'robust local control' },
  ];
  yield {
    state: graphState({
      nodes: nextNodes,
      edges: [
        { id: 'e-ca-nca', from: 'ca', to: 'nca', weight: '' },
        { id: 'e-ca-qd', from: 'ca', to: 'qd', weight: '' },
        { id: 'e-nca-bio', from: 'nca', to: 'bio', weight: '' },
        { id: 'e-qd-bio', from: 'qd', to: 'bio', weight: '' },
        { id: 'e-bio-systems', from: 'bio', to: 'systems', weight: '' },
      ],
    }, { title: 'Why this matters beyond Life' }),
    highlight: { found: nextTopics },
    explanation: `Cellular automata are the gateway to ${nextTopics.length} directions: ${nextNodes.find(n => n.id === 'nca').label} (${nextNodes.find(n => n.id === 'nca').note}), quality-diversity search, developmental systems, and robust local-control designs.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization runs through two views. The Life-rule view shows the mechanical step: for each cell, count live neighbors, then apply the survival and birth rules to produce the next grid. The local-to-global view zooms out to show how repeated application of that same local rule produces moving patterns, oscillators, and chaotic fields.',
        'Each frame corresponds to one generation. Watch the neighbor counts appear, then see which cells flip. The glider is the key object to track: it appears to move diagonally, but no cell actually travels. The pattern destroys and recreates itself one position over.',
        {type: 'image', src: './assets/gifs/cellular-automata.gif', alt: 'Animated walkthrough of the cellular automata visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A cellular automaton is a grid of cells where each cell holds a small state (like "live" or "dead"), looks at a fixed set of neighbors, and applies the same update rule as every other cell. There is no central controller, no master node, no global blueprint. The entire system is defined by four choices: the state alphabet, the neighborhood shape, the boundary condition, and the transition rule.',
        {type: 'callout', text: 'A cellular automaton shows how global behavior can be an emergent trace of identical local state transitions.'},
        'This matters because it isolates one of the most important ideas in computing: local interaction can produce global structure. A few lines of local logic can create still lifes, oscillators, gliders, waves, and chaotic fields. If a pattern moves, repairs itself, or becomes chaotic, it happened through purely local state transitions with no hidden coordinator.',
        'Cellular automata remove excuses. There is no neural network, no scheduler, and no complex data structure behind the curtain. That makes them one of the cleanest teaching tools for emergence, distributed control, and simulation. Understanding them prepares you for agent-based models, reaction-diffusion systems, and Neural Cellular Automata where the hand-written rule becomes a learned network.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'If you want a moving pattern on a grid, the obvious approach is to create an object with coordinates and update those coordinates each frame. Store a "glider" struct at position (2,1), then move it to (3,2) next step. This is how most game engines work: objects have identity and explicit position.',
        'Conway\'s Game of Life does not do that. It stores only whether each cell is live or dead. A glider appears to move because the pattern repeatedly destroys itself and recreates itself one cell offset. No cell carries identity across time. The "object" exists only as a stable pattern in the sequence of grids.',
        'That difference matters. Movement is not programmed into the rules. It is an emergent consequence of applying the same local birth-and-death rule to every cell simultaneously. This is the core lesson: you can get object-like behavior without object-like code.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is steerability. You cannot program a cellular automaton to produce a specific global behavior by writing explicit instructions. Your only levers are the local rule and the initial condition. There is no place in the system to say "make a glider go here" or "keep this region stable." You set the starting grid, pick the rule, press play, and watch what happens.',
        'Small changes to either lever can produce wildly different outcomes. Flip one cell in the initial state and a glider might never form. Change the survival threshold from 2-3 to 2-4 and the grid might explode into unbounded growth. There is no smooth dial between "ordered" and "chaotic" behavior; the relationship between rule and outcome is often discontinuous.',
        'Worse, there is no general method to predict the long-run behavior of an arbitrary cellular automaton from its rule alone. For sufficiently powerful automata, this question is formally undecidable. Rule 110, an elementary one-dimensional automaton, is Turing-complete: it can simulate any computation, which means no shortcut can predict its fate faster than running it. You cannot engineer around this wall. You can only explore rule spaces empirically and classify what you find.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is the synchronous snapshot. Every cell computes its next state from the previous grid, not from a partially updated grid. If you update cells in place from left to right, later cells see changes made by earlier cells in the same step, and you have built a fundamentally different automaton with different behavior.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Sample_run_of_Rule_110_elementary_cellular_automaton%2C_starting_from_single_cell.png', alt: 'Rule 110 cellular automaton space-time diagram starting from a single cell', caption: 'Rule 110 shows how one local rule can create rich space-time structure from a tiny initial state. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Sample_run_of_Rule_110_elementary_cellular_automaton,_starting_from_single_cell.png.'},
        'In practice this means you need two copies of the grid: the current state (read-only during an update) and the next state (write-only during an update). After computing every cell\'s next value from the current grid, you swap the two. This double-buffering is the implementation of synchronous update.',
        'The boundary condition is the second critical choice. A finite grid can treat edges as permanently dead, wrap around like a torus, or grow dynamically as patterns approach the edge. These choices change whether patterns die at the border, re-enter from the opposite side, or expand freely. Many demonstrations quietly hide the boundary rule, then overinterpret behavior that only exists because the edge was chosen a certain way.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Conway\'s Game of Life uses a two-dimensional grid where each cell is either live or dead. The neighborhood is the eight surrounding cells (the Moore neighborhood). The transition rule has two parts: a live cell survives if it has exactly 2 or 3 live neighbors, and a dead cell becomes live if it has exactly 3 live neighbors. Every other case produces a dead cell.',
        'To compute one generation: read the current grid, count live neighbors for every cell, apply the rule to produce each cell\'s next state, then replace the current grid with the next grid. All cells update simultaneously from the same snapshot. That is one generation.',
        'The glider is a five-cell pattern that repeats its shape every four generations, shifted one cell diagonally. No individual cell travels. The pattern\'s apparent motion comes from cells dying on one side and being born on the other, step after step, in a cycle that happens to translate the shape.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Animated_glider_emblem.gif', alt: 'Animated Conway Game of Life glider moving through successive grid states', caption: 'The glider is the smallest moving Life pattern: motion appears even though every cell only applies the local update rule. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Animated_glider_emblem.gif.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Local constraints propagate. A cell changes because of its neighbors, but those neighbors were changed by their neighbors in the previous generation. Over many generations, information ripples outward through the grid even though no cell ever sees beyond its immediate neighborhood. That propagation is enough to create waves, moving patterns, and long-lived structures.',
        'Repeated deterministic rules can produce attractors. Some configurations settle into still lifes (fixed points), some oscillate between a small set of states (limit cycles), some translate across the grid (spaceships like the glider), and some expand without bound. The same rule produces all of these behaviors depending on the initial condition.',
        'The interesting cases live in a narrow region between order and chaos. If the rule is too restrictive, everything dies. If it is too permissive, the grid fills with noise. Life\'s rule sits in a balance where patterns can survive long enough to interact with each other, producing the complex dynamics that make the system worth studying.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For a grid of n cells with a constant-size neighborhood, one generation costs O(n) time: visit every cell, count its neighbors (at most 8 lookups), apply the rule. Memory is O(n) for the current grid plus O(n) for the next grid, so 2n total. This is the dense approach.',
        'Sparse implementations track only live cells and their neighbors in a hash set. For a grid that is mostly empty, this can be much faster because you skip dead regions entirely. The tradeoff is overhead per cell: hash lookups versus array indexing. For dense, active grids, the flat array wins. For sparse patterns on a large or unbounded grid, the hash set wins.',
        'The deeper cost is intellectual, not computational. Cellular automata are easy to run and hard to design. You can simulate millions of generations per second, but you have no general way to find a rule that produces a desired behavior. The search space of possible rules is enormous (2^512 possible rules for the standard 2-state Moore neighborhood), and the relationship between rule and behavior is not smooth.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Cellular automata are used for procedural texture generation (Perlin noise variants, cave generation in games), traffic flow modeling (the Nagel-Schreckenberg model), forest fire simulation, crystal growth modeling, and simple fluid dynamics. In each case the real system has local interactions that map naturally onto a grid update rule.',
        'They prepare readers for Neural Cellular Automata, where the hand-written transition rule is replaced by a small neural network that is trained by gradient descent. The conceptual jump is natural: keep the grid and local update, but learn the rule that grows, repairs, or classifies the target pattern.',
        'They also build intuition for distributed systems. Cache invalidation, epidemic spread, load propagation, and local consensus all involve repeated local interactions producing global outcomes. Real versions need richer state and stochastic rules, but the automaton gives the clean skeleton: local observation, local transition, emergent global behavior.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not invoke "emergence" as an explanation by itself. You still need to specify the state representation, neighborhood, rule, boundary condition, initial state, and evaluation metric. Without those details, emergence is a label for surprise, not a mechanism.',
        'Do not assume visible patterns are robust. Test different initial states, larger grids, boundary choices, longer run times, and perturbations. Many automata have beautiful short-run behavior and useless long-run behavior for the task you actually care about. A five-generation demo proves nothing about stability.',
        'Do not confuse simulation convenience with realism. A grid, synchronous update, and uniform rule are modeling assumptions. Many real systems update asynchronously, have long-range interactions, carry continuous values, or change their own rules over time. Cellular automata are powerful because they isolate one mechanism cleanly, not because they describe every spatial system.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Place a glider on a 5x5 grid (rows 0-4, columns 0-4, all other cells dead). Generation 0 live cells: (0,1), (1,2), (2,0), (2,1), (2,2). We will compute generation 1 by hand.',
        'Start with cell (0,0). Its neighbors are (0,1) and (1,0) and (1,1) from the eight possible Moore neighbors (others are off-grid or at other positions). Count: (0,1) is live, (1,0) is dead, (1,1) is dead. That gives 1 live neighbor. Cell (0,0) is dead with fewer than 3 live neighbors, so it stays dead.',
        'Now cell (1,1). Its eight neighbors are (0,0), (0,1), (0,2), (1,0), (1,2), (2,0), (2,1), (2,2). Of these, (0,1), (1,2), (2,0), (2,1), and (2,2) are live. That is 5 live neighbors. Cell (1,1) is dead, and 5 is not 3, so it stays dead. Cell (1,0): neighbors include (0,0), (0,1), (1,1), (2,0), (2,1). Live count: (0,1), (2,0), (2,1) = 3. Dead cell with exactly 3 live neighbors: it becomes live.',
        'Apply this process to every cell. Generation 1 live cells: (1,0), (1,2), (2,1), (2,2), (3,1). Compare to generation 0: the shape has rotated and shifted down by one row. Repeat for generation 2: you will find live cells at (2,0), (2,2), (3,1), (3,2), (1,1) forming the glider shifted again. After four generations the glider returns to its original shape, displaced one cell down and one cell right.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Martin Gardner\'s original 1970 column on Conway\'s Game of Life at https://web.stanford.edu/class/sts145/Library/life.pdf introduced the subject to a wide audience. The Scholarpedia entry at http://www.scholarpedia.org/article/Cellular_automata gives a rigorous mathematical treatment. The Stanford Encyclopedia of Philosophy entry at https://plato.stanford.edu/entries/cellular-automata/ covers the philosophical and computational-theoretic dimensions, including undecidability and Turing completeness.',
        'On this site, study Neural Cellular Automata next to see what happens when the hand-written rule becomes a learned network. Finite State Machines formalize the per-cell state machine that each cell implements. Graph BFS shows how information propagates through connected structures, which is what happens implicitly across the grid. Dynamic Programming, Quality Diversity: MAP-Elites, and Evolutionary Search are all related frameworks for exploring large combinatorial spaces.',
      ],
    },
  ],
};
