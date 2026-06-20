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
      heading: 'Why This Exists',
      paragraphs: [
        "The self-organizing AI design pattern is useful when a system should grow, adapt, repair, or search from local interactions instead of following one central script. The designer defines repeated units, local state, local communication, update rules, environmental feedback, and evaluation pressure. The global behavior is the long-run outcome of many small updates.",
        "This pattern connects cellular automata, neural cellular automata, Hebbian plasticity, quality-diversity search, intrinsic motivation, and open-ended evolution. Those topics can look separate at first. The unifying question is practical: how do we design a system whose parts can coordinate without a complete blueprint, and how do we prove that the resulting behavior is robust rather than merely interesting to watch?",
        {type:"callout", text:"Self-organization is an engineering pattern when local rules, perturbation tests, and archives replace one brittle central blueprint."},
        {type:"image", src:"https://upload.wikimedia.org/wikipedia/commons/2/2b/Sample_run_of_Rule_110_elementary_cellular_automaton%2C_starting_from_single_cell.png", alt:"Rule 110 cellular automaton space-time diagram starting from a single cell.", caption:"Rule 110 elementary cellular automaton sample run, by LucasVB, CC0, via Wikimedia Commons."},
      ],
    },
    {
      heading: 'Naive Approach',
      paragraphs: [
        "The naive approach is to build a central controller. For an image-like pattern, store a target image and train a model to paint it. For a robot, train a policy that maps the full sensor state to motor commands. For a generated level, optimize directly toward one score. This can work when the environment is stable and the desired outcome is fixed.",
        "The weakness appears when the system is damaged, resized, partially observed, or moved to a new environment. A central controller can memorize a trajectory instead of learning a repair process. A single objective can find one brittle optimum. A pretty rollout can collapse after a small perturbation. The system needs local rules and tests that reward recovery, variation, and transfer.",
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        "The wall is indirect control. In a self-organizing system, the designer does not write every global state transition. The designer chooses state variables, neighborhoods, update rules, nudges, objectives, archives, perturbations, and evaluation windows. Small changes to those choices can create stable repair, endless drift, frozen dead states, or explosive growth.",
        "The wall is also evidence. Emergent behavior is easy to overclaim. A single animation may show generation from one seed, but it does not prove persistence, repair, robustness, or transfer. A serious claim needs held-out damage tests, multiple starting conditions, long-run stability checks, and environments that differ from the ones used during search.",
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        "The core insight is to move part of the program into repeated local dynamics. Each unit stores local memory, senses nearby state or messages, applies a shared or repeated rule, and changes itself or its environment. The same rule runs many times. If the rule creates a useful attractor, the system can return toward useful behavior after perturbation.",
        "The second insight is to keep a repertoire, not just one winner. Open-ended and quality-diversity methods preserve multiple useful behaviors across niches. A repertoire gives later search stepping stones: small repairers, large movers, fragile but fast solutions, robust slow solutions, and environment-agent pairs that can transfer.",
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        "The first design choice is the unit. It might be a grid cell in a neural cellular automaton, a neuron or synapse in a plastic network, a robot module, an agent in a swarm, or a controller paired with an environment. The unit needs local state. It also needs a neighborhood or communication graph that defines what information can move where.",
        "The second choice is the rule. The rule may be hand-written, learned with gradient descent, evolved by a population method, or adapted during lifetime through local plasticity. A neural cellular automaton, for example, can use a small neural network as the shared rule applied to each cell. Hebbian-style plasticity can update connections from local activity instead of from a global optimizer at every step.",
        "The third choice is the evaluator. The evaluator should measure function, persistence, repair after damage, variation across seeds, and transfer to new conditions. If the evaluator only measures visual similarity or one narrow score, the system can exploit that score without becoming robust.",
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        "The pattern works when the local rule creates useful attractors. An attractor is a region of state space the dynamics tend to return toward. If damage pushes the system away from a target behavior but the rule and environment pull it back, repair is not a separate scripted procedure. It is the same dynamics that produced the behavior in the first place.",
        "Quality-diversity works for a related reason. Many hard goals require stepping stones that do not look immediately optimal. A single objective may discard a strange candidate that later enables transfer. An archive indexed by behavior descriptors preserves candidates that are best within their niches, so search keeps multiple directions alive.",
        "Intrinsic motivation and open-ended search extend the idea further. Instead of waiting for one external target, the system can generate goals, measure progress, mutate environments, and transfer agents across challenges. The goal is not random novelty. The goal is to create a stream of learnable problems that keep producing useful structure.",
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        "Imagine training a neural cellular automaton to grow a simple tool shape on a grid. Each cell stores hidden channels, reads nearby cells, and applies the same small neural update rule. Training samples a seed state, runs many update steps, compares the final pattern to the target, damages part of the pattern during some rollouts, and rewards recovery of useful shape and function.",
        "A central painter could draw the target once. The self-organizing rule has to do more. It must grow from a seed, maintain the pattern across time, and repair after a patch of cells is erased. If the damaged system returns toward useful function, the rule has learned a repair attractor rather than a fixed drawing.",
        "Now add an archive. Instead of preserving only the closest match to the target, store elites by size and behavior: small fragile patterns, medium repairers, large movers, and large repairers. A later search step can select a medium repairer, mutate its rule, and discover a large mover. Without the archive, that intermediate candidate might have been discarded because it was not the best single target score.",
      ],
    },
    {
      heading: 'What The Animation Teaches',
      paragraphs: [
        "The local-repair view shows the engineering loop. Cells hold state, sense nearby messages, apply a rule, produce a global pattern, face damage, receive evaluation, and may be nudged by training or selection. The key lesson is that repair is a stronger claim than generation. A system that can rebuild after perturbation has learned more than a one-shot output.",
        "The open-ended-archive view shows why a repertoire matters. Seeds grow into behaviors, behaviors receive scores and descriptors, archive cells store elites, and selected elites mutate into new candidates. The archive matrix is the data structure that prevents search from collapsing into one winner too early.",
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        "One local update can be cheap, often proportional to the number of units when neighborhood size is fixed. The expensive part is unfolding time. A candidate may need hundreds or thousands of steps before its behavior is visible. If training backpropagates through all those steps, memory use can be high. If search uses evolution or quality diversity, evaluator calls can dominate the budget.",
        "The right cost model is candidate count times rollout length times perturbation tests times environment variations. A single beautiful rollout is cheap. Evidence of repair and transfer is not. Systems that claim self-organization should pay for damage tests, seed variation, long-run persistence checks, and held-out environments.",
        "The benefit is compression and robustness. A repeated local rule can govern many units. Repair can come from the same dynamics as growth. An archive can preserve multiple ways to solve related problems. The cost is lower direct control: you shape conditions and pressures rather than writing every final behavior.",
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        "The pattern wins when locality is natural. It fits cellular automata, morphogenesis-inspired models, swarm robotics, modular robots, adaptive controllers, distributed agents, procedural content, plastic networks, and artificial-life environments. In these domains, central state is often unavailable, expensive, brittle, or unrealistic.",
        "It also wins when robustness matters more than one perfect nominal solution. A damaged robot, noisy sensor field, changing game environment, or growing pattern needs adaptation after deployment. Local dynamics and repertoire search can provide fallback behaviors that a single optimized policy would not preserve.",
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        "The pattern fails when the task truly needs precise global coordination and there is no useful local decomposition. It can also fail when the communication graph is wrong. If units need information that never reaches them, no clever local rule can infer it reliably.",
        "It fails when the evaluator rewards appearance instead of function. A pattern can look alive and still be useless. A level generator can produce visual novelty with poor playability. A robot controller can exploit simulator quirks and fail in the real world. Emergence is not the same as capability.",
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        "Common failure modes include dead dynamics, runaway expansion, frozen attractors, brittle single-target behavior, fake novelty, archive domination by one family, descriptors that do not match useful diversity, simulator exploitation, and repair that only works for the exact damage seen during training.",
        "The mitigations are concrete. Use multiple seeds, randomized damage, held-out perturbations, resource constraints, descriptor audits, transfer tests, and function-based metrics. Keep examples of failure in the archive too, because they reveal where the search pressure or local rule is mis-specified.",
      ],
    },
    {
      heading: 'Sources And Study Next',
      paragraphs: [
        "Sebastian Risi frames self-organizing AI around local interactions, growth, repair, and open-ended discovery. Growing Neural Cellular Automata shows how learned local update rules can grow and repair images. Lenia provides a continuous cellular-automata world for artificial life. MAP-Elites formalizes quality-diversity archives. IMGEP studies self-generated goals. POET pairs environment generation with agent optimization and transfer.",
        "Study Cellular Automata, Neural Cellular Automata, Quality Diversity: MAP-Elites, Hebbian Plasticity Meta-Learning, Evolutionary Search, Multi-Armed Bandits, Policy Gradients, Swarm Intelligence, Reinforcement Learning, and Agent-Based Modeling next. They supply the local-rule, search, archive, and evaluation tools behind this design pattern.",
      ],
    },
  ],
};
