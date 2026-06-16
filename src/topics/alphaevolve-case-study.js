// Case study: AlphaEvolve. LLMs propose code, evaluators score it, and an
// evolutionary program database keeps the search moving toward better
// algorithms.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'alphaevolve-case-study',
  title: 'AlphaEvolve Case Study',
  category: 'Papers',
  summary: 'DeepMind AlphaEvolve as a reusable pattern: LLM proposals plus automatic evaluators plus evolutionary search.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['agent loop', 'why evaluators matter'], defaultValue: 'agent loop' },
  ],
  run,
};

function pipelineState(active = []) {
  const nodes = [
    { id: 'prompt', label: 'prompt sampler', x: 1.2, y: 3, note: 'context' },
    { id: 'llm', label: 'LLM ensemble', x: 3.2, y: 1.4, note: 'ideas' },
    { id: 'program', label: 'candidate code', x: 5.2, y: 3, note: 'algorithm' },
    { id: 'eval', label: 'evaluator', x: 7.3, y: 1.4, note: 'score' },
    { id: 'db', label: 'program DB', x: 8.8, y: 3.8, note: 'population' },
    { id: 'select', label: 'selection', x: 5.5, y: 5.2, note: 'parents' },
  ];
  const edges = [
    { id: 'e1', from: 'prompt', to: 'llm' },
    { id: 'e2', from: 'llm', to: 'program' },
    { id: 'e3', from: 'program', to: 'eval' },
    { id: 'e4', from: 'eval', to: 'db' },
    { id: 'e5', from: 'db', to: 'select' },
    { id: 'e6', from: 'select', to: 'prompt' },
  ];
  return graphState({ nodes, edges }, { active });
}

function* agentLoop() {
  yield {
    state: pipelineState(),
    highlight: {},
    explanation: 'AlphaEvolve is best understood as Evolutionary Search where the mutation operator is an LLM. The system keeps a population of candidate programs, samples promising context, asks models for edits, runs evaluators, and feeds the winners back into the population.',
  };

  yield {
    state: pipelineState(['prompt', 'llm']),
    highlight: { active: ['prompt', 'llm', 'e1'] },
    explanation: 'The prompt sampler assembles examples, prior winners, instructions, and the current objective. A fast model can explore many broad variations; a stronger model can spend more compute on deeper edits. This is a practical ensemble, not a single magic model.',
  };

  yield {
    state: pipelineState(['program', 'eval']),
    highlight: { active: ['program', 'eval', 'e2', 'e3'] },
    explanation: 'The candidate is executable code, not just prose. The evaluator compiles it, runs tests, measures quality, and rejects invalid programs. This is the crucial difference between brainstorming and search: ideas must survive contact with an oracle.',
    invariant: 'Every improvement claim must pass an automatic evaluator.',
  };

  yield {
    state: pipelineState(['db', 'select']),
    highlight: { found: ['db', 'select', 'e4', 'e5', 'e6'] },
    explanation: 'The program database stores candidates and scores. Selection picks useful parents for the next prompts, preserving diversity while exploiting winners. The loop creates a ratchet: weak proposals are cheap, but only measured improvements compound.',
  };

  yield {
    state: matrixState({
      title: 'Reported application areas',
      rows: [
        { id: 'dc', label: 'data centers' },
        { id: 'chip', label: 'chip design' },
        { id: 'train', label: 'LLM training' },
        { id: 'math', label: 'matrix multiply' },
      ],
      columns: [
        { id: 'object', label: 'optimized object' },
        { id: 'why', label: 'why measurable' },
        { id: 'lesson', label: 'lesson' },
      ],
      values: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
      ],
      format: (v) => [
        '',
        'scheduler', 'latency or throughput', 'systems can be evolved',
        'circuit simplification', 'functional equivalence', 'verifiers unlock search',
        'kernel or recipe', 'training speed', 'small gains scale',
        'algorithm', 'proof or exact tests', 'new math can be executable',
      ][v],
    }),
    highlight: { active: ['math:lesson', 'dc:lesson'] },
    explanation: 'DeepMind reports applications in practical infrastructure and mathematical discovery. The common property is measurability. If you can write a fast reliable evaluator, the system can search. If you cannot, it becomes vibes with code.',
  };
}

function* evaluators() {
  yield {
    state: matrixState({
      title: 'Evaluator quality decides what the search learns',
      rows: [
        { id: 'unit', label: 'unit tests' },
        { id: 'bench', label: 'benchmarks' },
        { id: 'proof', label: 'proof checks' },
        { id: 'prod', label: 'production canary' },
      ],
      columns: [
        { id: 'catches', label: 'catches' },
        { id: 'misses', label: 'misses' },
        { id: 'use', label: 'best use' },
      ],
      values: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
      ],
      format: (v) => [
        '',
        'obvious wrongness', 'performance regressions', 'correctness gate',
        'speed and cost', 'rare bugs', 'optimization gate',
        'mathematical invalidity', 'implementation speed', 'discovery gate',
        'real traffic behavior', 'slow feedback', 'deployment gate',
      ][v],
    }),
    highlight: { active: ['unit:catches', 'bench:catches', 'proof:catches'] },
    explanation: 'AlphaEvolve makes the evaluator the center of the system. Unit tests say whether code is plausibly correct. Benchmarks say whether it is faster. Proof or equivalence checks say whether a mathematical claim is valid. Canary traffic says whether production still behaves.',
  };

  yield {
    state: matrixState({
      title: 'Goodhart traps in algorithm discovery',
      rows: [
        { id: 'narrow', label: 'narrow tests' },
        { id: 'noisy', label: 'noisy timing' },
        { id: 'leak', label: 'data leakage' },
        { id: 'overfit', label: 'benchmark overfit' },
      ],
      columns: [
        { id: 'search_finds', label: 'search finds' },
        { id: 'damage', label: 'damage' },
        { id: 'defense', label: 'defense' },
      ],
      values: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
      ],
      format: (v) => [
        '',
        'untested branch', 'silent wrong answer', 'adversarial tests',
        'measurement noise', 'fake speedup', 'repeat and isolate',
        'heldout answers', 'inflated result', 'locked holdout',
        'quirky metric', 'fragile improvement', 'multiple evaluators',
      ][v],
    }),
    highlight: { swap: ['narrow:damage', 'noisy:damage', 'overfit:damage'] },
    explanation: 'Search exploits the objective. That is power and danger. If the tests are narrow, the system discovers loopholes. If timing is noisy, it chases noise. If the benchmark leaks, the discovery is not real. Evaluation design is algorithm design.',
    invariant: 'The optimizer will optimize exactly what you score, not what you meant.',
  };

  yield {
    state: matrixState({
      title: 'When to use the AlphaEvolve pattern',
      rows: [
        { id: 'yes1', label: 'yes' },
        { id: 'yes2', label: 'yes' },
        { id: 'maybe', label: 'maybe' },
        { id: 'no', label: 'no' },
      ],
      columns: [
        { id: 'condition', label: 'condition' },
        { id: 'example', label: 'example' },
        { id: 'reason', label: 'reason' },
      ],
      values: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
      ],
      format: (v) => [
        '',
        'cheap verifier', 'kernel optimization', 'many tries are affordable',
        'clear metric', 'routing policy', 'selection pressure is honest',
        'expensive verifier', 'drug simulation', 'batch and triage',
        'subjective goal', 'brand voice', 'human review dominates',
      ][v],
    }),
    highlight: { found: ['yes1:condition', 'yes2:condition'] },
    explanation: 'Use this pattern when proposals are cheap enough, verification is objective enough, and improvements can be accumulated. Avoid pretending it solves underspecified judgment problems. A human can still guide the search, but the ratchet needs a measurable tooth.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'agent loop') yield* agentLoop();
  else if (view === 'why evaluators matter') yield* evaluators();
  else throw new InputError('Pick an AlphaEvolve view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'AlphaEvolve is a DeepMind system for algorithm discovery and optimization. It combines LLM-generated code proposals, automatic evaluators, and an evolutionary program database. The important educational point is not that an LLM writes code. It is that the system closes the loop: propose, execute, score, select, and propose again.',
        'This makes AlphaEvolve a modern production-grade instance of Evolutionary Search. The population is a database of candidate programs. Mutation is code generation and editing by language models. Fitness is measured by evaluators. Selection chooses which candidates shape the next generation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A prompt sampler builds context from the problem statement and previous candidates. LLMs propose code changes or new algorithms. The system executes those candidates and scores them with one or more evaluators: correctness tests, runtime benchmarks, proof checks, or domain-specific metrics. Good candidates enter the program database. The next prompt samples from that database, so successful structure recurs and weak variants disappear.',
        'The loop is powerful because it can convert unreliable proposal quality into reliable progress when evaluation is strong. An LLM can be creative, wrong, redundant, or strange. The evaluator does not care. It only asks whether the candidate passes and improves. That gives the system a selection pressure similar to compiler superoptimization, genetic programming, and black-box hyperparameter search.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is evaluator calls. If each candidate requires a full benchmark, proof search, or simulator run, the system becomes expensive quickly. The engineering work is therefore in evaluator design, caching, deduplication, parallel execution, sandboxing, and triage. Good systems use cheap filters first, expensive checks later, and locked holdouts to prevent overfitting.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'DeepMind reports using AlphaEvolve-style search for data-center scheduling, hardware-accelerator circuit simplification, LLM training optimizations, matrix-multiplication algorithms, and scientific or mathematical search problems. The common theme is objective feedback: the candidate either runs faster, proves valid, fits better, or fails.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first trap is weak evaluation. Evolutionary systems are ruthless Goodhart machines: they exploit any loophole in the metric. A candidate that wins a narrow benchmark may fail on real workloads. A candidate that passes visible tests may exploit missing tests. Use multiple evaluators, randomized tests, adversarial cases, and holdout suites.',
        'The second trap is treating AlphaEvolve as a general reasoning engine. It is strongest where ideas can be represented as executable artifacts and evaluated automatically. For ambiguous product, legal, or design decisions, the evaluator is harder than the proposal. In those domains, the pattern still helps, but human review or symbolic verification becomes part of the loop.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google DeepMind AlphaEvolve blog https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/ and AlphaEvolve: A coding agent for scientific and algorithmic discovery at https://arxiv.org/abs/2506.13131. Study Evolutionary Search first, then Code World Models Case Study, Hyperparameter Search, Data Leakage & Contamination, Cross-Validation & Honest Evaluation, and Git Internals. The shared theme is simple: measured feedback is the engine of learning.',
      ],
    },
  ],
};
