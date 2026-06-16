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
      heading: 'What it is',
      paragraphs: [
        'An island-model evolutionary algorithm splits the population into subpopulations that evolve mostly independently. Periodically, candidates migrate between islands according to a topology such as a ring, star, mesh, or random graph.',
        'The core data-structure idea is controlled information flow. Too little migration wastes discoveries. Too much migration turns every island into a clone of the current winner and destroys diversity.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each island runs a normal evolutionary loop: mutate, evaluate, select. On a migration schedule, it exports selected candidates to neighbors and imports migrants from them. The receiving island decides whether to insert, compete, quarantine, or discard each migrant.',
        'In expensive-search settings, islands also need an evaluator queue. Candidate identity, seed, worker, score, retry state, and result age become part of the algorithm because stale or flaky evaluations can distort selection.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Island models parallelize naturally because most evaluations happen independently. Communication cost depends on topology, migration rate, and migration frequency. Sparse topologies reduce communication and preserve diversity, while dense topologies spread discoveries quickly but can cause premature homogenization.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Island models are useful for distributed hyperparameter search, simulator-heavy robotics, program synthesis, architecture search, genetic programming, and quality-diversity systems. They also fit cloud execution because islands can map to worker pools, regions, or hardware classes.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not migrate only the single current best candidate forever; that can erase exploration. Do not compare scores from different evaluator versions without a version ledger. Do not ignore stale migrants in asynchronous systems. Do not report only best score; also report diversity, communication cost, and seed spread.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Island Models Meet Rumor Spreading at https://hpi.de/friedrich/docs/publications/2017/GECCO_c.pdf, sparse migration topology runtime analysis at https://pmc.ncbi.nlm.nih.gov/articles/PMC6438647/, and dynamic island model framework at https://univ-angers.hal.science/hal-03350615v1/document. Study Evolutionary Search, Differential Evolution, Quality Diversity MAP-Elites, Gossip Protocol, Message Queue, and Distributed Tracing next.',
      ],
    },
  ],
};
