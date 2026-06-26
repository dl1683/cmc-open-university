// Island-model evolution: split a population into semi-independent subgroups
// and exchange candidates through a migration topology.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'island-model-evolution-migration-topology-case-study',
  title: 'Island Model Evolution Migration Topology',
  category: 'Systems',
  summary: 'A distributed evolutionary search case study: island populations, migration rings, diversity preservation, asynchronous evaluators, stale migrants, and topology tradeoffs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['migration topology', 'async evaluator'], defaultValue: 'migration topology' },
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

function islandGraph(title, topology = 'ring') {
  const edges = topology === 'star'
    ? [
        { id: 'e-h-a', from: 'hub', to: 'a' },
        { id: 'e-h-b', from: 'hub', to: 'b' },
        { id: 'e-h-c', from: 'hub', to: 'c' },
        { id: 'e-h-d', from: 'hub', to: 'd' },
      ]
    : [
        { id: 'e-a-b', from: 'a', to: 'b' },
        { id: 'e-b-c', from: 'b', to: 'c' },
        { id: 'e-c-d', from: 'c', to: 'd' },
        { id: 'e-d-a', from: 'd', to: 'a' },
      ];
  return graphState({
    nodes: [
      { id: 'a', label: 'I1', x: 2.0, y: 1.5, note: 'pop' },
      { id: 'b', label: 'I2', x: 7.0, y: 1.5, note: 'pop' },
      { id: 'c', label: 'I3', x: 7.0, y: 5.5, note: 'pop' },
      { id: 'd', label: 'I4', x: 2.0, y: 5.5, note: 'pop' },
      { id: 'hub', label: 'hub', x: 4.5, y: 3.5, note: topology },
      { id: 'archive', label: 'archive', x: 9.0, y: 3.5, note: 'best' },
    ],
    edges: [
      ...edges,
      { id: 'e-a-archive', from: 'a', to: 'archive' },
      { id: 'e-b-archive', from: 'b', to: 'archive' },
      { id: 'e-c-archive', from: 'c', to: 'archive' },
      { id: 'e-d-archive', from: 'd', to: 'archive' },
    ],
  }, { title });
}

function asyncGraph(title) {
  return graphState({
    nodes: [
      { id: 'island', label: 'island', x: 0.7, y: 3.5, note: 'queue' },
      { id: 'mutate', label: 'mutate', x: 2.2, y: 2.0, note: 'child' },
      { id: 'evalq', label: 'evalQ', x: 3.8, y: 3.5, note: 'tasks' },
      { id: 'w1', label: 'W1', x: 5.5, y: 1.6, note: 'fast' },
      { id: 'w2', label: 'W2', x: 5.5, y: 3.5, note: 'slow' },
      { id: 'w3', label: 'W3', x: 5.5, y: 5.4, note: 'fail' },
      { id: 'select', label: 'select', x: 7.2, y: 3.5, note: 'score' },
      { id: 'migrate', label: 'migrate', x: 8.9, y: 3.5, note: 'send' },
    ],
    edges: [
      { id: 'e-island-mutate', from: 'island', to: 'mutate' },
      { id: 'e-mutate-evalq', from: 'mutate', to: 'evalq' },
      { id: 'e-evalq-w1', from: 'evalq', to: 'w1' },
      { id: 'e-evalq-w2', from: 'evalq', to: 'w2' },
      { id: 'e-evalq-w3', from: 'evalq', to: 'w3' },
      { id: 'e-w1-select', from: 'w1', to: 'select' },
      { id: 'e-w2-select', from: 'w2', to: 'select' },
      { id: 'e-w3-select', from: 'w3', to: 'select' },
      { id: 'e-select-migrate', from: 'select', to: 'migrate' },
      { id: 'e-migrate-island', from: 'migrate', to: 'island' },
    ],
  }, { title });
}

function* migrationTopology() {
  yield {
    state: islandGraph('Split one population into islands'),
    highlight: { active: ['a', 'b', 'c', 'd'], found: ['archive'] },
    explanation: 'An island model runs several semi-independent evolutionary populations. Each island explores locally, while occasional migrants share useful candidates across the topology.',
    invariant: 'Isolation preserves diversity; migration spreads useful discoveries.',
  };

  yield {
    state: labelMatrix(
      'Topology choices',
      [
        { id: 'ring', label: 'ring' },
        { id: 'star', label: 'star' },
        { id: 'mesh', label: 'mesh' },
        { id: 'random', label: 'random' },
      ],
      [
        { id: 'spread', label: 'spread' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['slow', 'stable'],
        ['fast', 'hub bias'],
        ['fast', 'homogenize'],
        ['mixed', 'variable'],
      ],
    ),
    highlight: { active: ['ring:spread', 'ring:risk'], compare: ['mesh:risk', 'star:risk'] },
    explanation: 'Migration topology is a data-structure choice. Dense graphs spread winners quickly but can collapse diversity. Sparse rings preserve independent exploration longer.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'generation', min: 0, max: 40 }, y: { label: 'diversity', min: 0, max: 1 } },
      series: [
        { id: 'single', label: 'single', points: [{ x: 0, y: 0.9 }, { x: 10, y: 0.45 }, { x: 20, y: 0.25 }, { x: 30, y: 0.18 }, { x: 40, y: 0.12 }] },
        { id: 'ring', label: 'ring', points: [{ x: 0, y: 0.9 }, { x: 10, y: 0.72 }, { x: 20, y: 0.58 }, { x: 30, y: 0.48 }, { x: 40, y: 0.40 }] },
      ],
      markers: [
        { id: 'mig', x: 20, y: 0.58, label: 'migrate' },
      ],
    }),
    highlight: { active: ['ring', 'mig'], compare: ['single'] },
    explanation: 'Island models can slow premature convergence. That matters when the search space has many basins or when the evaluator is noisy enough to crown early false winners.',
  };

  yield {
    state: islandGraph('Migrate through a ring for controlled spread'),
    highlight: { active: ['e-a-b', 'e-b-c', 'e-c-d', 'e-d-a'], compare: ['archive'] },
    explanation: 'A ring is a simple migration policy: every island sends a few candidates to one neighbor on a schedule. The design is intentionally less aggressive than global winner-take-all sharing.',
  };
}

function* asyncEvaluator() {
  yield {
    state: asyncGraph('Expensive evaluations make islands distributed systems'),
    highlight: { active: ['island', 'mutate', 'evalq', 'w1', 'w2', 'w3', 'e-mutate-evalq'], found: ['select'] },
    explanation: 'In production, each candidate may require a simulator, benchmark, or training run. The island model becomes a task-queue system with retries, timeouts, stale results, and worker heterogeneity.',
  };

  yield {
    state: labelMatrix(
      'Evaluator ledger',
      [
        { id: 'cand', label: 'cand' },
        { id: 'seed', label: 'seed' },
        { id: 'worker', label: 'worker' },
        { id: 'score', label: 'score' },
        { id: 'age', label: 'age' },
      ],
      [
        { id: 'value', label: 'val' },
        { id: 'why', label: 'why' },
      ],
      [
        ['hash', 'dedupe'],
        ['42', 'var'],
        ['W2', 'repro'],
        ['.81', 'pick'],
        ['3g', 'stale'],
      ],
    ),
    highlight: { active: ['cand:value', 'seed:value', 'score:value', 'age:why'], compare: ['worker:why'] },
    explanation: 'The evaluator ledger prevents false progress. It records candidate identity, seed, worker, score, timestamp, retry state, and whether the result is too stale to compare fairly.',
  };

  yield {
    state: asyncGraph('Migrant freshness needs policy'),
    highlight: { active: ['select', 'migrate', 'e-select-migrate', 'e-migrate-island'], compare: ['w2', 'w3'] },
    explanation: 'A migrant that was elite three generations ago may be stale. Asynchronous island systems need policy for migrant age, duplicate candidates, failed evaluations, and score normalization across environments.',
  };

  yield {
    state: labelMatrix(
      'Migration policy',
      [
        { id: 'rate', label: 'rate' },
        { id: 'freq', label: 'freq' },
        { id: 'pick', label: 'pick' },
        { id: 'age', label: 'age' },
      ],
      [
        { id: 'knob', label: 'knob' },
        { id: 'failure', label: 'fail' },
      ],
      [
        ['count', 'takeover'],
        ['period', 'stale'],
        ['best/rnd', 'clone'],
        ['ttl', 'old'],
      ],
    ),
    highlight: { active: ['rate:knob', 'freq:knob', 'age:knob'], compare: ['pick:failure'] },
    explanation: 'The knobs are operational. Migration rate, frequency, selection policy, replacement policy, and TTL decide whether islands cooperate, collapse into clones, or never share enough.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'migration topology') yield* migrationTopology();
  else if (view === 'async evaluator') yield* asyncEvaluator();
  else throw new InputError('Pick an island-model view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows an evolutionary algorithm split into islands. An evolutionary algorithm keeps candidate solutions, scores them with a fitness function, mutates or recombines them, and selects survivors. An island is one subpopulation that evolves mostly on its own. Migration means sending selected candidates across topology edges to other islands.',
        'Active nodes are islands currently evaluating, selecting, sending, or receiving candidates. Found nodes are candidates that survive a local selection step or become migrants. Compare markers show competing topology choices such as ring, star, mesh, or random links. The diversity plot shows whether islands are still exploring different regions.',
        {type:'callout', text:'Island models make migration topology part of the search bias, balancing local diversity against controlled spread of discoveries.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/c/c2/Island_population_model_of_an_evolutionary_algorithm.png', alt:'Island model diagram with eight subpopulations connected by migration edges', caption:'Island population model diagram by Studi90, via Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Evolutionary search is useful when the object is hard to optimize with gradients or exact formulas, such as a robot controller, neural architecture, schedule, program, or simulation design. A single population can improve, but it can also collapse around an early good candidate before alternatives have been tested.',
        'The island model exists to preserve diversity while using parallel hardware. Each island explores locally, and migration shares discoveries on a schedule. The design problem is not just compute distribution. It is controlled information flow.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one large population. Evaluate all candidates, keep stronger ones, mutate them, and repeat. Good traits spread quickly because every candidate competes in the same arena.',
        'The opposite simple approach is independent restarts. Run many separate populations and never communicate. That protects exploration, but it wastes discoveries because every worker must rediscover useful building blocks alone.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is premature convergence. If one candidate is lucky early, selection can fill the population with close variants. Later mutation then explores only one basin of the search space, even if another basin contains better solutions.',
        'Parallelism adds another wall. Expensive evaluators finish at different times, machines fail, seeds differ, and scores can be noisy. Without a migration ledger, a stale or lucky candidate can look like progress and spread through the system.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Migration topology is part of the algorithm. A ring spreads discoveries slowly and preserves local variation. A star spreads through a hub and can converge quickly. A dense mesh shares information fast but risks making all islands similar.',
        'A migrant is not just a candidate value. It carries lineage, seed, score, evaluator version, worker, age, and mutation history. Those fields decide whether the receiving island should trust it, quarantine it, ignore it as a duplicate, or let it compete.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each island runs a local evolutionary loop. It evaluates candidates, selects survivors, creates children by mutation or recombination, and records an archive of useful candidates. Every M generations, it exports a small set such as elites, novel candidates, or a mixed sample.',
        'Migrants travel only along topology edges. The receiver applies an insertion policy: replace weak candidates, add to a queue, admit only if novel, or compare against a local validation benchmark. The evaluator ledger records enough evidence to reproduce why the migrant was accepted.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The model works because it separates local exploitation from global communication. Inside an island, selection can exploit good local discoveries. Across islands, sparse or delayed migration prevents one discovery from instantly dominating all populations.',
        'There is no general proof that an island model finds the global optimum in practical search spaces. The useful correctness argument is behavioral: if islands retain separate populations and migration is bounded, then the system maintains multiple hypotheses while still allowing good building blocks to travel.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Evaluation usually dominates cost. If one candidate simulation costs 2 minutes and there are 8 islands with 50 candidates each, one generation costs 800 candidate-minutes, but it can run in parallel across workers. Migration messages are small compared with evaluation.',
        'The control cost is real. The system must store lineage, seeds, scores, evaluator versions, migration time, replacement decisions, and duplicates. Higher migration rates reduce rediscovery time but increase takeover risk. Lower rates preserve diversity but can delay useful discoveries.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Island models fit distributed hyperparameter search, architecture search, robotics, genetic programming, simulation-heavy design, game agents, compiler heuristic tuning, and quality-diversity experiments. They are strongest when evaluation is expensive and parallel capacity is available.',
        'They also fit mixed evaluators. One island can use a fast approximate simulator while another uses a slower trusted benchmark. Migration can require confirmation before a candidate moves from cheap evidence to expensive evidence.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A migration policy can erase the benefit. Elite-only migration in a dense topology can make every island a copy of the current champion. Too little migration behaves like isolated restarts. Unnormalized scores can make candidates from one evaluator version dominate unfairly.',
        'Asynchronous execution can bias selection toward fast candidates rather than good candidates. Duplicate candidates can consume budget on many islands. A missing ledger makes it impossible to tell whether improvement came from search, seed luck, stale scores, or worker bias.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose 4 islands each hold 25 candidates. Each candidate evaluation costs 30 seconds. One generation is 100 evaluations, or 50 minutes of work on one worker, but with 20 workers it takes about 2.5 minutes plus scheduling overhead. Every 5 generations, each island exports 2 migrants to its two ring neighbors.',
        'After 20 generations, island A has found a candidate with score 0.91, while B, C, and D have best scores 0.84, 0.86, and 0.82. In a mesh with elite migration every generation, 0.91 may appear everywhere within one or two generations and diversity may collapse. In a ring with 2 migrants every 5 generations, the 0.91 building block travels more slowly, giving other islands time to keep testing different basins.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Island Models Meet Rumor Spreading at https://hpi.de/friedrich/docs/publications/2017/GECCO_c.pdf, sparse migration topology runtime analysis at https://pmc.ncbi.nlm.nih.gov/articles/PMC6438647/, and dynamic island model framework at https://univ-angers.hal.science/hal-03350615v1/document.',
        'Study evolutionary algorithms, selection pressure, mutation, recombination, gossip protocols, distributed queues, benchmark reproducibility, quality diversity, and MAP-Elites next. The practical exercise is to compare ring and mesh migration on the same random seed budget.',
      ],
    },
  ],
};