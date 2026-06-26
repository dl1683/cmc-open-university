// Self-organizing AI design pattern: compose local rules, collective state,
// nudges, quality-diversity archives, and repair-oriented evaluation.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'self-organizing-ai-design-pattern-case-study',
  title: 'Self-Organizing AI Design Pattern',
  category: 'AI & ML',
  summary: 'A case study tying Cellular Automata, Neural Cellular Automata, MAP-Elites, Hebbian plasticity, and open-ended search into one design pattern.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['local repair loop', 'open-ended archive'], defaultValue: 'local repair loop' },
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

function organismGraph(title) {
  return graphState({
    nodes: [
      { id: 'cells', label: 'cells', x: 0.8, y: 3.7, note: 'many units' },
      { id: 'state', label: 'state', x: 2.4, y: 2.2, note: 'local mem' },
      { id: 'sense', label: 'sense', x: 2.4, y: 5.3, note: 'neighbors' },
      { id: 'rule', label: 'rule', x: 4.2, y: 3.7, note: 'shared' },
      { id: 'pattern', label: 'pattern', x: 6.1, y: 2.2, note: 'global' },
      { id: 'repair', label: 'repair', x: 6.1, y: 5.3, note: 'damage' },
      { id: 'eval', label: 'eval', x: 8.1, y: 3.7, note: 'score' },
      { id: 'nudge', label: 'nudge', x: 9.4, y: 3.7, note: 'steer' },
    ],
    edges: [
      { id: 'e-cells-state', from: 'cells', to: 'state' },
      { id: 'e-cells-sense', from: 'cells', to: 'sense' },
      { id: 'e-state-rule', from: 'state', to: 'rule' },
      { id: 'e-sense-rule', from: 'sense', to: 'rule' },
      { id: 'e-rule-pattern', from: 'rule', to: 'pattern' },
      { id: 'e-rule-repair', from: 'rule', to: 'repair' },
      { id: 'e-pattern-eval', from: 'pattern', to: 'eval' },
      { id: 'e-repair-eval', from: 'repair', to: 'eval' },
      { id: 'e-eval-nudge', from: 'eval', to: 'nudge' },
      { id: 'e-nudge-rule', from: 'nudge', to: 'rule' },
    ],
  }, { title });
}

function archiveGraph(title) {
  return graphState({
    nodes: [
      { id: 'seed', label: 'seed', x: 0.8, y: 3.8, note: 'start' },
      { id: 'grow', label: 'grow', x: 2.4, y: 3.8, note: 'simulate' },
      { id: 'score', label: 'score', x: 4.0, y: 2.2, note: 'fitness' },
      { id: 'desc', label: 'desc', x: 4.0, y: 5.3, note: 'behavior' },
      { id: 'archive', label: 'archive', x: 6.1, y: 3.8, note: 'niches' },
      { id: 'select', label: 'select', x: 7.9, y: 2.2, note: 'elite' },
      { id: 'mutate', label: 'mutate', x: 9.2, y: 3.8, note: 'try' },
    ],
    edges: [
      { id: 'e-seed-grow', from: 'seed', to: 'grow' },
      { id: 'e-grow-score', from: 'grow', to: 'score' },
      { id: 'e-grow-desc', from: 'grow', to: 'desc' },
      { id: 'e-score-archive', from: 'score', to: 'archive' },
      { id: 'e-desc-archive', from: 'desc', to: 'archive' },
      { id: 'e-archive-select', from: 'archive', to: 'select' },
      { id: 'e-select-mutate', from: 'select', to: 'mutate' },
      { id: 'e-mutate-grow', from: 'mutate', to: 'grow' },
    ],
  }, { title });
}

function archiveMatrix(title) {
  return labelMatrix(
    title,
    [
      { id: 'small', label: 'small' },
      { id: 'mid', label: 'mid' },
      { id: 'large', label: 'large' },
    ],
    [
      { id: 'fragile', label: 'fragile' },
      { id: 'repair', label: 'repairs' },
      { id: 'moves', label: 'moves' },
    ],
    [
      ['empty', 'A:0.62', 'empty'],
      ['B:0.54', 'C:0.81', 'D:0.70'],
      ['empty', 'E:0.75', 'F:0.66'],
    ],
  );
}

function* localRepairLoop() {
  yield {
    state: organismGraph('Self-organization moves the program into local rules'),
    highlight: { active: ['cells', 'state', 'sense', 'rule', 'e-state-rule', 'e-sense-rule'], found: ['pattern'], compare: ['nudge'] },
    explanation: 'A self-organizing system does not store one central blueprint. It stores many local states, a shared or repeated update rule, and an environment that lets global structure emerge through repeated interaction.',
  };

  yield {
    state: labelMatrix(
      'State ledger',
      [
        { id: 'cell', label: 'cell state' },
        { id: 'rule', label: 'local rule' },
        { id: 'msg', label: 'neighbor msg' },
        { id: 'env', label: 'env' },
        { id: 'nudge', label: 'nudge' },
        { id: 'eval', label: 'eval' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'changes', label: 'changes' },
      ],
      [
        ['hidden mem', 'each step'],
        ['shared law', 'trained'],
        ['nearby data', 'local only'],
        ['physics', 'drift'],
        ['goal bias', 'rarely'],
        ['score', 'per trial'],
      ],
    ),
    highlight: { active: ['cell:stores', 'rule:stores', 'msg:stores'], found: ['nudge:changes', 'eval:changes'] },
    explanation: 'The design is easier to reason about as a ledger. Which state is per-cell? Which rule is shared? Which signals are local? Which external nudges are allowed? Which evaluator decides whether repair worked?',
    invariant: 'Global behavior must be explainable through local state, local messages, and repeated updates.',
  };

  yield {
    state: organismGraph('Damage tests whether the rule is an attractor'),
    highlight: { active: ['pattern', 'repair', 'eval', 'e-rule-repair', 'e-repair-eval'], found: ['rule'], compare: ['nudge'] },
    explanation: 'Repair is stronger than generation. A target image can be reached once by brittle dynamics. Repair asks whether the same update process pulls the damaged system back toward a useful state.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'steps after damage', min: 0, max: 100 }, y: { label: 'function score', min: 0, max: 1 } },
      series: [
        { id: 'fixed', label: 'fixed', points: [{ x: 0, y: 0.85 }, { x: 10, y: 0.30 }, { x: 30, y: 0.28 }, { x: 60, y: 0.27 }, { x: 100, y: 0.25 }] },
        { id: 'selforg', label: 'self-org', points: [{ x: 0, y: 0.82 }, { x: 10, y: 0.35 }, { x: 30, y: 0.52 }, { x: 60, y: 0.68 }, { x: 100, y: 0.78 }] },
        { id: 'nudge', label: 'nudged', points: [{ x: 0, y: 0.82 }, { x: 10, y: 0.35 }, { x: 30, y: 0.59 }, { x: 60, y: 0.76 }, { x: 100, y: 0.83 }] },
      ],
      markers: [
        { id: 'hit', x: 10, y: 0.35, label: 'damage' },
      ],
    }),
    highlight: { active: ['selforg', 'nudge'], compare: ['fixed'], found: ['hit'] },
    explanation: 'The evaluation should plot function, not only visual similarity. A locomoting soft robot, game level generator, or modular controller needs to recover useful behavior after perturbation.',
  };

  yield {
    state: labelMatrix(
      'Control levers',
      [
        { id: 'blueprint', label: 'blueprint' },
        { id: 'nudge', label: 'nudge' },
        { id: 'reward', label: 'reward' },
        { id: 'archive', label: 'archive' },
        { id: 'damage', label: 'damage test' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['global plan', 'brittle'],
        ['bias rule', 'weak steer'],
        ['score result', 'Goodhart'],
        ['keep niches', 'bad bins'],
        ['perturb', 'too narrow'],
      ],
    ),
    highlight: { active: ['nudge:move', 'archive:move', 'damage:move'], compare: ['blueprint:risk'] },
    explanation: 'Self-organizing systems are controlled indirectly. You shape initial conditions, local rules, rewards, archives, and perturbation tests rather than scripting every global state transition.',
  };

  yield {
    state: labelMatrix(
      'Proof checklist',
      [
        { id: 'grow', label: 'growth' },
        { id: 'persist', label: 'persistence' },
        { id: 'repair', label: 'repair' },
        { id: 'vary', label: 'variation' },
        { id: 'transfer', label: 'transfer' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'fail', label: 'bad sign' },
      ],
      [
        ['from seed', 'needs reset'],
        ['long run', 'decays'],
        ['after harm', 'no rebound'],
        ['many starts', 'one trick'],
        ['new env', 'sim only'],
      ],
    ),
    highlight: { found: ['grow:test', 'repair:test', 'transfer:test'], compare: ['vary:fail'] },
    explanation: 'A serious claim needs growth, persistence, repair, variation, and transfer tests. A single pretty rollout is an animation, not evidence of robust self-organization.',
  };
}

function* openEndedArchive() {
  yield {
    state: archiveGraph('Open-ended search keeps a repertoire, not one winner'),
    highlight: { active: ['grow', 'score', 'desc', 'archive', 'e-score-archive', 'e-desc-archive'], found: ['select', 'mutate'] },
    explanation: 'A single target can trap a self-organizing system in one brittle attractor. Quality-diversity and open-ended search store many useful outcomes so later search has stepping stones.',
  };

  yield {
    state: archiveMatrix('Archive indexed by size and behavior'),
    highlight: { active: ['mid:repair', 'large:repair', 'mid:moves'], found: ['large:moves'], compare: ['small:fragile'] },
    explanation: 'The archive is the data structure. Rows and columns are behavior descriptors; each filled cell stores the best known local rule, controller, or pattern for that niche.',
  };

  yield {
    state: labelMatrix(
      'Search modes',
      [
        { id: 'grad', label: 'gradient' },
        { id: 'evolve', label: 'evolve' },
        { id: 'qd', label: 'QD' },
        { id: 'imgep', label: 'IMGEP' },
        { id: 'poet', label: 'POET' },
      ],
      [
        { id: 'target', label: 'target' },
        { id: 'keeps', label: 'keeps' },
      ],
      [
        ['given goal', 'one model'],
        ['fitness', 'population'],
        ['many bins', 'elites'],
        ['self goals', 'skills'],
        ['env+agent', 'pairs'],
      ],
    ),
    highlight: { active: ['qd:keeps', 'imgep:keeps', 'poet:keeps'], compare: ['grad:keeps'] },
    explanation: 'These methods differ in what they preserve. Gradient descent preserves one set of parameters. QD preserves niche elites. IMGEP preserves skill progress. POET preserves paired environments and agents that can transfer.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'envA', label: 'env A', x: 0.8, y: 2.1, note: 'challenge' },
        { id: 'agentA', label: 'agent A', x: 2.8, y: 2.1, note: 'solver' },
        { id: 'envB', label: 'env B', x: 0.8, y: 5.2, note: 'mutated' },
        { id: 'agentB', label: 'agent B', x: 2.8, y: 5.2, note: 'solver' },
        { id: 'transfer', label: 'transfer', x: 5.2, y: 3.7, note: 'try elite' },
        { id: 'pool', label: 'pool', x: 7.3, y: 3.7, note: 'pairs' },
        { id: 'next', label: 'next', x: 9.0, y: 3.7, note: 'step stone' },
      ],
      edges: [
        { id: 'e-envA-agentA', from: 'envA', to: 'agentA' },
        { id: 'e-envB-agentB', from: 'envB', to: 'agentB' },
        { id: 'e-agentA-transfer', from: 'agentA', to: 'transfer' },
        { id: 'e-agentB-transfer', from: 'agentB', to: 'transfer' },
        { id: 'e-transfer-pool', from: 'transfer', to: 'pool' },
        { id: 'e-pool-next', from: 'pool', to: 'next' },
      ],
    }, { title: 'POET-style transfer creates stepping stones' }),
    highlight: { active: ['envA', 'agentA', 'envB', 'agentB', 'transfer'], found: ['next'] },
    explanation: 'POET pairs challenge generation with solver optimization. The crucial trick is transfer: a solution evolved for one environment can unlock progress in another.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'archive coverage', min: 0, max: 1 }, y: { label: 'best function', min: 0, max: 1 } },
      series: [
        { id: 'target', label: 'one target', points: [{ x: 0.05, y: 0.35 }, { x: 0.08, y: 0.62 }, { x: 0.10, y: 0.78 }, { x: 0.11, y: 0.82 }] },
        { id: 'archive', label: 'archive', points: [{ x: 0.08, y: 0.32 }, { x: 0.25, y: 0.55 }, { x: 0.55, y: 0.74 }, { x: 0.82, y: 0.84 }] },
      ],
      markers: [
        { id: 'broad', x: 0.82, y: 0.84, label: 'broad set' },
      ],
    }),
    highlight: { active: ['archive', 'broad'], compare: ['target'] },
    explanation: 'Open-ended search usually looks inefficient if you only watch the first objective. Its payoff is coverage: more viable stepping stones, more transfer options, and fewer bets on one fragile optimum.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'pretty', label: 'pretty demo' },
        { id: 'one', label: 'one target' },
        { id: 'desc', label: 'bad desc' },
        { id: 'dominate', label: 'domination' },
        { id: 'sim', label: 'sim gap' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['no function', 'task score'],
        ['brittle', 'archive'],
        ['fake novelty', 'audit bins'],
        ['one species', 'constraints'],
        ['real fail', 'transfer test'],
      ],
    ),
    highlight: { active: ['pretty:fix', 'desc:fix', 'sim:fix'], compare: ['dominate:symptom'] },
    explanation: 'Open-endedness needs pressure shaping. Without meaningful descriptors, constraints, and transfer tests, the search can fill an archive with attractive but useless artifacts or converge to one dominant trick.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'local repair loop') yield* localRepairLoop();
  else if (view === 'open-ended archive') yield* openEndedArchive();
  else throw new InputError('Pick a self-organizing AI view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the local-repair view as repeated small rules producing a global pattern. Active cells update from neighbors, visited cells have already applied the rule this step, and damage frames test whether the rule returns toward function. The safe inference is repair, not appearance: generation alone does not prove self-organization.',
        {type:"callout", text:"Self-organization is an engineering pattern when local rules, perturbation tests, and archives replace one brittle central blueprint."},
        {type:"image", src:"https://upload.wikimedia.org/wikipedia/commons/2/2b/Sample_run_of_Rule_110_elementary_cellular_automaton%2C_starting_from_single_cell.png", alt:"Rule 110 cellular automaton space-time diagram starting from a single cell.", caption:"Rule 110 elementary cellular automaton sample run, by LucasVB, CC0, via Wikimedia Commons."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some systems must grow, adapt, or repair from local information because no central controller has the full state. A cell, robot module, synapse, or agent sees only nearby messages and its own memory. Self-organization uses repeated local rules so global behavior emerges from many small updates.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a central blueprint. For a pattern, store the target image; for a robot, train one controller over the full sensor state; for a game level, optimize one score. This works while the world stays fixed and undamaged.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is perturbation. A central painter can draw a target once and still fail when 20 percent of cells are erased. A single objective can find a brittle optimum that looks good in one rollout and collapses under a different seed or environment.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Move part of the program into local dynamics and test the dynamics under damage. An attractor is a region of state space that the system tends to return toward. If the local rule creates a useful attractor, repair is the same mechanism as growth.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose the unit, the neighborhood, the local state, the update rule, and the evaluator. The rule may be hand-written, learned by gradient descent, or evolved by search. Quality-diversity archives then keep multiple useful behaviors instead of one winner, giving later search stepping stones.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is not a formal guarantee for every emergent system; it is an evidence contract. The rule must preserve the intended local state boundaries, and the evaluation must show function after held-out damage, multiple seeds, and longer rollouts. An archive works when its descriptors preserve behaviors that later mutations can reuse.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'One local update can be O(n) for n units when each unit reads a fixed-size neighborhood. The expensive part is time unfolding: 10,000 candidates times 256 steps times 5 damage tests means 12.8 million update steps. Cost grows with candidate count, rollout length, perturbation count, and environment variation.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The pattern fits neural cellular automata, swarm robotics, modular robots, procedural content generation, plastic neural networks, artificial-life environments, and adaptive multi-agent systems. It is useful when locality is real and repair matters more than a perfect nominal rollout.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the task needs precise global coordination and the needed information never reaches local units. It also fails when the evaluator rewards appearance instead of function. Emergence is not capability unless held-out tests show that the behavior survives changes that matter.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Train a neural cellular automaton on a 64 by 64 grid to grow a tool shape from one seed. Each cell has 16 hidden channels and reads its 3 by 3 neighborhood for 128 steps. During training, erase a 16 by 16 patch in half the rollouts; a good rule regrows function, while a central image painter only redraws the clean target.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Growing Neural Cellular Automata, Rule 110, Lenia, MAP-Elites, quality-diversity search, Hebbian plasticity, POET, intrinsic motivation, and swarm intelligence. Keep asking which claim is being made: growth, repair, transfer, diversity, or open-ended discovery.',
      ],
    },
  ],
};
