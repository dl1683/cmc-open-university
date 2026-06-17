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
      heading: 'Why this exists',
      paragraphs: [
        `Evolutionary search is attractive when the object being optimized is hard to differentiate or hard to describe analytically: a neural architecture, a robot controller, a program, a schedule, a game-playing policy, or a simulation-heavy design. The algorithm keeps a population of candidates, mutates and recombines them, evaluates their fitness, and lets stronger candidates influence the next generation. That gives the search a way to move without gradients, but it also creates a classic failure: a population can become too similar too early.`,
        `The island model exists to fight that collapse while using parallel hardware well. Instead of one global population, it runs several semi-independent subpopulations called islands. Each island explores its own region of the search space, and only occasional migrants cross between islands. The data-structure problem is controlled information flow: discoveries should travel, but not so quickly that every island becomes a copy of the current winner.`,
      ],
    },
    {
      heading: 'The naive approach and its wall',
      paragraphs: [
        `The naive design is one large population. It is simple: evaluate every candidate, select the best, mutate them, and repeat. It spreads useful genetic material quickly, which can be good on smooth search spaces. The wall appears on rugged landscapes with many basins. A lucky early candidate can dominate selection before the population has sampled enough alternatives. Once diversity falls, later mutation is mostly local repair around the same basin.`,
        `The opposite naive design is many independent runs with no communication. That protects diversity, but it wastes discoveries. If one worker finds a useful building block, every other worker must rediscover it from scratch. The island model sits between those extremes. It keeps local search separate most of the time, then uses migration as a scheduled, topologized, auditable way to share candidates.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Migration topology is not implementation decoration. It is part of the search bias. A ring lets discoveries move slowly around the population, which protects local exploration. A star makes a hub powerful: useful discoveries spread fast, but hub choices can dominate. A dense mesh makes every island highly connected, which raises the chance that the same elite candidate floods the whole system. A random or time-varying topology can mix these behaviors.`,
        `The other insight is that migrants are not just values. A candidate has an identity, a lineage, a score, a seed, a worker, an evaluator version, a timestamp, and sometimes a retry history. In cheap textbook examples those fields are hidden. In real evolutionary search, they decide whether a migrant is comparable, stale, duplicated, contaminated by a flaky evaluator, or worth admitting into another island.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `Inside each island, the loop is ordinary evolutionary search. Generate children by mutation or recombination, evaluate fitness, select survivors, update the local population, and keep an archive of strong candidates. On a migration interval, each island chooses a small export set: perhaps its elites, a random sample, novelty-maximizing candidates, or a mixture. Those exports travel only along topology edges. The receiver applies its own insertion policy rather than blindly replacing local candidates.`,
        `A production island model also needs scheduling machinery. Evaluation may mean a simulator run, benchmark suite, training job, or physical experiment, so results return asynchronously. The evaluator ledger records candidate hash, seed, score, worker, age, retry count, and environment. A freshness policy prevents a three-generation-old result from beating a current candidate unfairly. A replacement policy decides whether a migrant competes immediately, waits in quarantine, or is discarded as a duplicate.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The topology view proves that migration edges are search constraints. A ring, star, mesh, and random graph do not differ only in drawing style; they differ in how fast information spreads and how quickly diversity is at risk. The diversity plot compares a single population with a ring. The single population drops faster because every candidate competes in one shared arena. The ring keeps subpopulations distinct longer, so more basins remain alive.`,
        `The asynchronous evaluator view proves that distributed evolution is also a distributed-systems problem. The queue, worker nodes, selection step, and migration step are part of the algorithm because they decide which evidence is trusted. If a slow worker returns a stale elite, if a failed benchmark is retried under a different environment, or if one seed is unusually favorable, the search can promote noise. The ledger is not bookkeeping after the fact; it protects selection itself.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The model works because it separates exploitation from communication. Within an island, selection can exploit local discoveries aggressively. Across islands, migration throttles how much of that exploitation becomes global. Sparse topology and low migration rates preserve independent hypotheses. Periodic exchange still lets strong building blocks move outward, so the whole system is not merely a set of isolated restarts.`,
        `Correctness here is not a proof that the global optimum will be found. Evolutionary algorithms rarely give that kind of guarantee in practical spaces. The useful invariant is behavioral: maintain multiple partially independent populations while allowing bounded sharing. When diversity metrics, migration ledgers, and evaluator versions are recorded, the team can tell whether improvement came from real search progress or from takeover, stale scores, seed luck, or worker bias.`,
      ],
    },
    {
      heading: 'Tradeoffs and cost',
      paragraphs: [
        `The main benefit is parallelism. Most candidate evaluations are independent, so islands map well to worker pools, clusters, regions, or hardware classes. Communication can be small compared with evaluation cost. The main price is control-plane complexity: migration schedules, topology choices, replacement policies, score normalization, stale-result handling, and reproducibility records all become part of the system.`,
        `The knobs interact. High migration rate spreads discoveries but can homogenize the search. Low migration rate protects exploration but may delay useful building blocks. Elite-only migration can cause clone takeover. Random migration can preserve diversity but waste bandwidth on weak candidates. Dense topologies reduce time to spread, while sparse topologies lower communication and preserve local variation. There is no universal setting; the right policy depends on evaluator noise, landscape ruggedness, and budget.`,
      ],
    },
    {
      heading: 'Uses and failure modes',
      paragraphs: [
        `Island models are useful for distributed hyperparameter search, simulator-heavy robotics, genetic programming, program synthesis, architecture search, game agents, hardware design exploration, and quality-diversity systems. They are especially natural when evaluation is expensive and parallel capacity is available. They also fit organizational boundaries: one island can run on a fast approximate evaluator, another on a slower trusted benchmark, and migration can be allowed only when evidence is comparable.`,
        `They fail when migration policy is treated casually. A single champion sent everywhere can erase exploration. Scores from different evaluator versions can make old candidates look better than they are. Asynchronous queues can prefer fast-to-evaluate candidates over genuinely good ones. Duplicate candidates can consume budget across islands. A topology that is too sparse can behave like isolated restarts, while one that is too dense becomes a global population with extra overhead.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: Island Models Meet Rumor Spreading at https://hpi.de/friedrich/docs/publications/2017/GECCO_c.pdf, sparse migration topology runtime analysis at https://pmc.ncbi.nlm.nih.gov/articles/PMC6438647/, and dynamic island model framework at https://univ-angers.hal.science/hal-03350615v1/document. Study Evolutionary Search for the base loop, Differential Evolution for population updates, Quality Diversity MAP-Elites for diversity as an objective, Gossip Protocol for spreading behavior, Message Queue for asynchronous evaluation, and Distributed Tracing for replaying candidate evidence across workers.`,
      ],
    },
  ],
};
