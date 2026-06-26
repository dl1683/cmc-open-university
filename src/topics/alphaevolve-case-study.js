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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation is a closed search loop. The prompt sampler chooses context, the LLM ensemble proposes candidate code, the evaluator scores the candidate, and the program database stores measured survivors. Active nodes show the current part of the loop; found nodes show candidates that earned their way back into the population.',
        'Read the evaluator view as the safety rail. Unit tests, benchmarks, proof checks, and canaries are not after-the-fact cleanup. They define what the search is allowed to learn.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'The key lesson is not "LLMs write code." It is that unreliable proposal generation becomes useful when wrapped in a strict propose-execute-score-select loop. The model is allowed to be creative, redundant, or wrong. The evaluator is not. That asymmetry is what turns many cheap, noisy ideas into a smaller set of measured improvements.'},
        'AlphaEvolve exists because some valuable programs are hard to invent but easy to test once proposed. A matrix multiplication identity can be checked on many inputs. A scheduling policy can be simulated. A compiler rewrite can be tested for equivalent output and measured for speed.',
        'The useful unit is not a single model answer. It is a loop that creates many candidates, executes them, rejects invalid ones, and preserves measured improvements. That turns language models into mutation engines inside a search system.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to ask an LLM for a better algorithm and read the response. That can help brainstorming, but it does not create reliable discovery. The model can sound confident while producing wrong code, repeated ideas, or a benchmark trick.',
        'A better first attempt is to generate many candidates and run tests. That still lacks memory and selection. Without a population, the system forgets partial gains and restarts from prompt luck each round.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is objective design. Search will exploit the score, including mistakes in the score. Narrow tests invite candidates that pass examples and fail real cases. Noisy benchmarks invite candidates that look faster because timing jitter selected them.',
        'The other wall is cost. If each candidate requires a 10-minute simulation and the system tries 10,000 candidates, one sweep costs about 100,000 minutes of evaluator time before parallelism. A serious system needs staged filters, caching, timeouts, and reproducible measurement.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make the model unreliable in the cheap part and strict in the expensive part. The LLM proposes mutations; the evaluator decides survival. Evolutionary search supplies the population, diversity, parent selection, and ratchet that a one-shot prompt lacks.',
        'This boundary makes progress measurable. A candidate that fails to compile, violates correctness, or loses the benchmark is not an improvement. A candidate that passes stronger gates can seed future prompts, so small real gains can compound.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The system samples prior programs, instructions, constraints, and scores into a prompt. One or more models propose edits or full replacements. The runtime compiles the candidate, runs correctness tests, measures performance, and writes a score record.',
        'The program database stores code, score, lineage, and metadata. Selection chooses parents for later prompts, balancing exploitation of winners with enough diversity to avoid one local neighborhood. The loop keeps running while evaluator budget and improvement rate justify the cost.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works when evaluation is cheaper than human invention and more reliable than model judgment. A human may not know the best schedule, but a simulator can compare two schedules. A human may not trust a proposed rewrite, but an equivalence checker can reject unsafe code.',
        'The correctness argument is conditional on the evaluator. If tests cover the contract and benchmarks measure the real target, selection pressure moves toward useful programs. If the evaluator is weak, the system becomes an efficient way to find evaluator loopholes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost behaves like candidates times evaluator cost. If a cheap syntax and unit-test stage takes 2 seconds and rejects 90 percent of 10,000 candidates, only 1,000 reach a 60-second benchmark stage. That staged design costs about 20,000 seconds plus 60,000 seconds, not 600,000 seconds.',
        'Complexity lives in reproducibility. Candidate execution needs sandboxes, fixed dependencies, deterministic seeds where possible, timeout rules, hardware labels, score provenance, and heldout tests. Without those records, the best program may be a measurement artifact.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The pattern fits compiler rewrites, kernels, scheduling heuristics, solver tactics, matrix algorithms, routing policies, and generated tests. The shared property is an objective evaluator that can run many times without human interpretation. If the evaluator is slow, batching and staged filters become part of the design.',
        'It is less about replacing engineers than about changing where engineers spend attention. Humans define the search space, write evaluators, inspect surprising winners, and decide deployment risk. The loop spends compute on variants humans would not enumerate manually.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails on subjective goals that cannot be scored faithfully. Brand voice, legal judgment, product strategy, and open-ended taste can use generated variants, but a scalar score will hide too much. Human review stays central there.',
        'It also fails when execution is unsafe or leaky. Candidate code may read files, depend on hidden answers, exploit benchmark quirks, or consume unbounded resources. Sandboxing and locked holdouts are not optional.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the target is a sorting-network generator for 16 inputs. The evaluator checks 1,000 random arrays, then all 2^16 binary inputs, and finally counts comparator depth. Candidate A uses 63 comparators at depth 10, and candidate B uses 61 at depth 10, so B survives if both pass the full correctness gate.',
        'Now suppose a model proposes candidate C with 58 comparators but it fails 3 of the 65,536 binary cases. C is discarded even though its score would look better on depth alone. That is the AlphaEvolve pattern in miniature: proposal can be noisy, but the survival rule must be exact for the claim being optimized.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the Google DeepMind AlphaEvolve announcement and the AlphaEvolve technical report. Study evolutionary search, genetic programming, property-based testing, benchmark variance, compiler optimization, and proof assistants next.',
        'The practical exercise is to evolve a small function with a locked evaluator. Keep public tests, hidden tests, repeated timing, and a log of every accepted candidate. The log will teach why search quality follows evaluator quality.',
      ],
    },
  ],
};