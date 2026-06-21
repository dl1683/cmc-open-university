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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/neural-cellular-automata.gif', alt: 'Animated walkthrough of the neural cellular automata visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Neural cellular automata ask a sharper version of the cellular automata question: if local rules can create global patterns, can we learn the local rule instead of hand-writing it? The goal is not merely to generate an image. The goal is to learn a distributed process that grows, maintains, and sometimes repairs a target pattern through repeated local interaction.',
        'This matters because many real systems do not have a central artist drawing the final form. Biological development, tissue repair, swarm behavior, material growth, and distributed control all depend on many local units coordinating through nearby signals. NCA is a small, differentiable laboratory for studying that design shape.',
        'The topic is also a useful antidote to one-shot thinking in generative AI. A decoder can emit a final image directly, but it usually has no reason to keep the image stable after damage. NCA treats the image as a state of an ongoing dynamical system. The finished pattern is something the system keeps producing, not a file it wrote once.',
        {type: 'callout', text: 'Neural cellular automata learn one local update rule, then ask repeated local interaction to create and repair the global form.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to train a normal neural network from a seed or latent vector to a complete output. That can work for generation, but it misses the point. A one-shot generator has a global view, a fixed output time, and no built-in obligation to repair itself after part of the output is removed.',
        'Another shortcut is to hand-design a rule like Conway Life and tune it until the pattern looks interesting. That teaches cellular automata, but it does not solve the inverse problem: given a desired behavior, find the local rule that produces it. Neural cellular automata make the rule trainable, so the designer specifies the target and the optimization process searches the space of local update rules.',
        'The design constraint is severe. Each cell can only sense local channels, run the same small network as every other cell, and update its own state. No cell receives the full target image. No cell knows the global coordinates of the final object unless that information is encoded locally. The intelligence, if any, is in the repeated interaction.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to separate visible state from hidden state. Visible channels produce the image or material the outside world sees. Hidden channels carry local memory, orientation, boundary signals, and repair cues. A cell can therefore act differently at an edge, inside a body, near a wound, or near a growth front without needing a global controller.',
        'The learned update rule is shared. The same tiny neural network is applied to every cell at every step, usually after a local perception operation such as a small convolution or Sobel-like neighborhood filter. The network predicts a delta to the cell state. Repeating that local rule over the grid creates the global behavior.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'The shared update rule is a small neural network reused at every cell and every step; weight sharing is what makes the local rule portable. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
        'Training unrolls the automaton for many steps and backpropagates through the whole sequence. The loss is usually measured on visible channels after some number of updates, and the gradient teaches the local rule how earlier local decisions contributed to later global error. That is the hard part: the rule is local, but the training signal is global and delayed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A typical NCA starts with a grid of state vectors. One cell or a small seed region is alive. Each update step computes local perception features from nearby cells, passes each cell through the shared neural network, and adds the predicted update to its state. Some implementations update cells stochastically so the rule cannot depend on a perfectly synchronized clock.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/CA-Moore.svg/250px-CA-Moore.svg.png', alt: 'Moore neighborhood diagram with the center cell and its eight neighbors', caption: 'A Moore neighborhood shows the local sensing window: each cell sees nearby state, not the whole target image. Source: Wikimedia Commons, Life of Riley, public domain.'},
        'Cells often carry an alpha or alive channel. Dead cells stay inactive unless neighboring live cells create the conditions for growth. That simple device prevents the entire grid from becoming active at once and gives the automaton a moving boundary. Hidden channels then let the boundary remember enough about local shape to grow the right structure.',
        'Training often uses a pool of partially grown samples instead of always starting from the same seed. The pool exposes the rule to many intermediate states, including damaged states. Damage training deliberately removes part of the pattern and asks the automaton to recover. Without that curriculum, a model may learn to grow once but fail to maintain or repair.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The learned-local-rule view shows the mechanical loop: sense local neighborhood, run the shared network, emit a delta, repeat over the grid. That is the whole architecture. There is no separate module that draws the final shape. The same local rule must be good enough for early growth, late stabilization, and response to perturbation.',
        'The growth-and-repair view shows the evaluation standard. A strong NCA should grow from a seed, reach the target, avoid drifting after many extra steps, and recover after local damage. The repair step is the important evidence. It suggests the target has become an attractor of the dynamics rather than a fragile one-time endpoint.',
        'The loss curve in the visual should be read as a behavior test, not just an optimization plot. Growth loss falling means the system can construct the target. Error spiking after damage and then falling again means nearby cells retained enough local information to rebuild. If the error stays low only at one chosen step count, the rule may be overfit to timing.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works when the target can be decomposed into local coordination problems. Edges can decide how to expand, interior cells can preserve state, and damaged regions can be filled by neighboring context. Hidden channels give the system more expressive memory than visible pixels alone, while weight sharing forces the learned rule to be reusable.',
        'The attractor idea is central. A good rule does not merely march through a script from seed to image. It creates dynamics that pull nearby states back toward the target. That is why repair is such a meaningful test: it asks whether the target basin has thickness around it, or whether the system only knows one exact trajectory.',
        'This is also why NCAs are educationally important. They make the bridge between machine learning and dynamical systems concrete. Gradient descent trains the rule, but after training the behavior is an iterated local system. Understanding the result requires both neural-network thinking and systems thinking.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'One update costs O(cells) for a fixed neighborhood and fixed-size network. Running the automaton for T steps costs O(T * cells). Training is much more expensive than inference because the computation is unrolled through time and gradients must flow through the sequence. Longer horizons increase memory pressure and make optimization less stable.',
        'The main tradeoff is expressiveness versus reliability. More hidden channels and a larger network can learn richer behavior, but they also create more ways to overfit to the target, timing, seed, or damage pattern. Stochastic updates, randomized damage, variable step counts, and pool-based training are used to make the rule robust rather than merely pretty.',
        'Another tradeoff is interpretability. The local update rule is small enough to inspect in principle, but hidden channels often develop internal signals that are not obvious. You can visualize channels, perturb cells, and run ablations, yet the learned rule is still less transparent than a hand-written cellular automaton.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'NCA is a strong research model for morphogenesis, self-repair, texture synthesis, differentiable simulation, artificial life, and local-control systems. It is especially valuable when the desired behavior should persist over time rather than appear once.',
        'It is also a good teaching bridge. Cellular automata teach local rules. Convolutions teach local perception. Backpropagation through time teaches delayed credit assignment. NCA puts those ideas in one small system where students can see global behavior emerge from learned local mechanics.',
        'Practically, the idea is most useful when local communication is a feature rather than a handicap. Examples include distributed materials, swarm robotics, procedural assets, simulation surrogates, and robustness experiments where a system should degrade and recover locally instead of depending on a central repair routine.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A learned local rule is not automatically general intelligence. Many NCAs are trained for one target and fail outside the training distribution. A model that repairs one kind of cut may fail under a different wound, seed, grid size, update schedule, or noise pattern.',
        'The method also struggles when the target requires long-range coordination that cannot be propagated through local channels within the available step budget. If one side of the grid must instantly know a faraway decision, a purely local rule has to carry that information step by step. That can be elegant, but it can also be too slow or too brittle.',
        'Do not accept a final frame as proof. Test variable step counts, repeated damage, larger canvases, different seeds, asynchronous updates, and hidden-channel perturbations. The claim is not "it once looked right." The claim is "the learned dynamics reliably pull relevant states toward the desired behavior."',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Growing Neural Cellular Automata at https://distill.pub/2020/growing-ca/, arXiv version at https://arxiv.org/abs/2005.06700, Self-Organising Textures at https://distill.pub/selforg/2021/textures/, and Sebastian Risi on self-organizing AI at https://sebastianrisi.com/self_assembling_ai/.',
        'Study Cellular Automata first if the local-rule idea is still fuzzy. Then study Convolution for local perception, Gradient Flow for training dynamics, Backpropagation for delayed credit assignment, Quality Diversity: MAP-Elites for searching behavior spaces, Hebbian Plasticity for local learning, and Evolutionary Search for non-gradient alternatives.',
        'A useful exercise is to train or simulate a tiny NCA under three evaluation regimes: grow only, grow plus long stabilization, and grow plus random damage. The gap between those regimes teaches why repair is not a decorative feature. It is the test that distinguishes a learned growth script from a learned dynamical system.',
      ],
    },
  ],
};
