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
    explanation: 'The cycle is the idea. AlphaEvolve is Evolutionary Search where the mutation operator is an LLM: keep a population of candidate programs, sample promising context, ask models for edits, run evaluators, and feed measured winners back into the population.',
  };

  yield {
    state: pipelineState(['prompt', 'llm']),
    highlight: { active: ['prompt', 'llm', 'e1'] },
    explanation: 'The prompt sampler is the search state entering the model. It assembles examples, prior winners, instructions, and the current objective. Fast models explore many broad variations; stronger models spend more compute on deeper edits.',
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
      heading: 'Why this exists',
      paragraphs: [
        `AlphaEvolve exists because many valuable algorithms are hard to invent but easy to score once a candidate exists. A scheduler can be simulated. A circuit rewrite can be checked for functional equivalence. A matrix multiplication identity can be tested and sometimes proved. A kernel can be benchmarked. In these domains, the bottleneck is not judging every possible answer by hand. The bottleneck is searching a huge space of programs without getting stuck in the first plausible idea.`,
        `DeepMind describes AlphaEvolve as an evolutionary coding agent for scientific and algorithmic discovery. The system uses large language models to propose code, automatic evaluators to score that code, and an evolutionary program database to decide what gets reused. The key lesson is not "LLMs write code." The key lesson is that unreliable proposal generation can become useful when it is wrapped in a strict propose, execute, score, select loop.`,
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        `The obvious way to use an LLM for discovery is to ask for a clever algorithm, read the answer, and try to judge whether it sounds right. That can help a human brainstorm. It does not create a reliable search process. The model may hallucinate a proof, repeat a known method, optimize the wrong case, or produce code that only works on the examples shown in the prompt.`,
        `A slightly better approach is to ask for many candidates and run tests. That still leaves a memory problem. Which candidates should seed the next round? How should the system preserve diversity? How does it avoid losing a small improvement that becomes useful after several later edits? A one-shot prompt has no ratchet. AlphaEvolve adds the ratchet.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to treat the LLM as a mutation operator, not as an oracle. Evolutionary search already has the shape: keep a population, generate variants, score them, and select parents for the next generation. AlphaEvolve swaps in modern code-generating models for richer mutations, then relies on evaluators to decide which mutations survive.`,
        `That boundary matters. The model is allowed to be creative, redundant, or wrong. The evaluator is not. If a candidate fails to compile, violates correctness, loses on the benchmark, or breaks a proof check, it does not become evidence of progress. This is how the system turns many cheap, noisy ideas into a smaller set of measured improvements.`,
      ],
    },
    {
      heading: 'How the mechanism works',
      paragraphs: [
        `A prompt sampler builds context from the problem, prior high-scoring programs, diversity samples, constraints, and current objective. An ensemble of models proposes code edits or whole candidate programs. The system compiles and runs those candidates in a controlled environment. Evaluators measure correctness, quality, runtime, proof validity, resource use, or any other objective the task can define.`,
        `Passing candidates enter the program database with their scores and metadata. Selection chooses which programs shape future prompts. Strong candidates get exploited. Diverse candidates keep the search from collapsing into one local neighborhood. The database is therefore not just storage; it is the search state. It decides what the models see, what gets forgotten, and which improvements can compound.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The agent-loop view proves that AlphaEvolve is a closed search system. The prompt sampler and program database are memory. The LLM ensemble is the mutation engine. Candidate code is the artifact under test. The evaluator supplies fitness. The arrows matter because a good candidate must reenter the population before its structure can influence the next generation.`,
        `The evaluator view proves the main engineering constraint. Unit tests, benchmarks, proof checks, and production canaries catch different kinds of failure. Narrow tests invite wrong answers. Noisy timing invites fake speedups. Leaked holdouts invite benchmark overfit. The visual is not saying that evaluation is a final cleanup step. It is saying that evaluation is the objective the search will learn.`,
      ],
    },
    {
      heading: 'Why the method works',
      paragraphs: [
        `The method works when the evaluator is cheaper and more reliable than human invention. A human may not know the best scheduler heuristic, but a simulator can compare candidates. A human may not immediately see whether a circuit rewrite is safe, but equivalence checking can reject invalid rewrites. Search becomes useful because correctness and quality are externalized into repeatable tests.`,
        `The evolutionary part gives the system memory and selection pressure. A single model response has no guarantee of improvement. A population can keep many partial ideas alive, sample from winners, and combine local gains over time. This does not make the search guaranteed to find the global best program. It makes progress measurable when the space is large, candidates are executable, and the score is honest. That is a narrower claim than general intelligence, and it is the claim that makes the architecture useful.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `The obvious cost is evaluator calls. A serious candidate may require compilation, sandboxing, correctness tests, repeated benchmarks, proof search, simulation, or canary deployment. If each score is expensive, the whole loop can become expensive fast. Production versions need caching, deduplication, parallel execution, staged filters, timeout policy, and careful measurement hygiene.`,
        `The deeper cost is objective design. The optimizer will optimize exactly what is scored, not what the team meant. If the benchmark is narrow, candidates may specialize to it. If timing is noisy, selection may amplify noise. If the visible tests are too complete, the system may overfit to them. Good deployments use cheap public tests, stronger private tests, adversarial cases, repeated measurements, locked holdouts, and human review for changes whose blast radius is high.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `AlphaEvolve-style search is strongest when proposals are cheap enough to generate at scale and evaluation is objective enough to trust. DeepMind reports applications in data-center scheduling, hardware design, AI training efficiency, matrix multiplication, and other mathematical or scientific problems. The shared property is measurability: the candidate either runs faster, preserves function, proves valid, or fails.`,
        `This pattern also fits smaller engineering work. A team can evolve SQL rewrite rules, compiler peepholes, kernel variants, routing heuristics, feature transformations, or solver tactics if it can build a reliable evaluator. The LLM does not need to understand the whole domain perfectly. It needs to create enough promising variants for the evaluator to find and preserve real gains.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The pattern fails when the evaluator is weaker than the generator. Subjective goals, policy choices, legal judgments, product taste, and open-ended strategy are hard to compress into a score without losing the thing that matters. In those domains, AlphaEvolve can still assist with variant generation or test construction, but it should not be treated as the primary truth machine.`,
        `It can also fail through unsafe execution. Candidate code may be malicious, resource-hungry, flaky, or dependent on environmental quirks. A serious system needs sandboxing, deterministic builds where possible, resource limits, provenance tracking, and reproducible score records. Without that infrastructure, the evolutionary loop can produce results that are impressive in the dashboard and useless in the real environment.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: the Google DeepMind AlphaEvolve announcement at https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/ and the AlphaEvolve technical report at https://arxiv.org/abs/2506.13131. In this curriculum, study Evolutionary Search first, then Hyperparameter Search, Cross-Validation and Honest Evaluation, Data Leakage and Contamination, Code World Models Case Study, and Git Internals. The common thread is feedback discipline: a search system is only as good as the artifact it preserves and the score it trusts.`,
      ],
    },
  ],
};
