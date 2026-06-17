// Tiny Recursive Model reasoning: a small recurrent core repeatedly updates a
// latent scratchpad and answer buffer until a halt rule accepts the result.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'tiny-recursive-model-reasoning-loop-case-study',
  title: 'Tiny Recursive Model Reasoning Loop Case Study',
  category: 'Papers',
  summary: 'A reasoning case study: a tiny recurrent network separates latent state from answer state, refines both through exact unrolled recursion, and halts when improvement stalls.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['latent recursion', 'halt and verify'], defaultValue: 'latent recursion' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function loopGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'puzzle', x: 0.6, y: 3.6, note: 'grid' },
      { id: 'embed', label: 'embed', x: 2.1, y: 3.6, note: 'tokens' },
      { id: 'latent', label: 'z state', x: 3.8, y: 2.1, note: 'scratch' },
      { id: 'answer', label: 'y state', x: 3.8, y: 5.1, note: 'output' },
      { id: 'core', label: 'tiny core', x: 5.8, y: 3.6, note: 'shared' },
      { id: 'loss', label: 'loss', x: 7.8, y: 2.2, note: 'train' },
      { id: 'halt', label: 'halt', x: 7.8, y: 5.0, note: 'gate' },
      { id: 'emit', label: 'emit', x: 9.2, y: 3.6, note: 'answer' },
    ],
    edges: [
      { id: 'e-input-embed', from: 'input', to: 'embed' },
      { id: 'e-embed-latent', from: 'embed', to: 'latent' },
      { id: 'e-embed-answer', from: 'embed', to: 'answer' },
      { id: 'e-latent-core', from: 'latent', to: 'core' },
      { id: 'e-answer-core', from: 'answer', to: 'core' },
      { id: 'e-core-latent', from: 'core', to: 'latent', weight: 'revise z' },
      { id: 'e-core-answer', from: 'core', to: 'answer', weight: 'revise y' },
      { id: 'e-answer-loss', from: 'answer', to: 'loss' },
      { id: 'e-core-halt', from: 'core', to: 'halt' },
      { id: 'e-halt-emit', from: 'halt', to: 'emit' },
    ],
  }, { title });
}

function* latentRecursion() {
  yield {
    state: loopGraph('Separate latent scratchpad from answer buffer'),
    highlight: { active: ['input', 'embed', 'latent', 'answer', 'e-input-embed', 'e-embed-latent', 'e-embed-answer'], found: ['core'] },
    explanation: 'The Tiny Recursive Model pattern keeps two mutable states. z is the latent scratchpad used for computation. y is the answer buffer that can be corrected over recursive passes. That split is the core data-structure idea.',
    invariant: 'The core parameters are reused at every recursion step.',
  };

  yield {
    state: labelMatrix(
      'Recursive state ledger',
      [
        { id: 'r0', label: 'r0' },
        { id: 'r1', label: 'r1' },
        { id: 'r2', label: 'r2' },
        { id: 'r3', label: 'r3' },
        { id: 'r4', label: 'r4' },
      ],
      [
        { id: 'z', label: 'z' },
        { id: 'y', label: 'y' },
        { id: 'resid', label: 'error' },
        { id: 'move', label: 'move' },
      ],
      [
        ['blank', 'guess', 'high', 'start'],
        ['constraints', 'patch', 'mid', 'revise'],
        ['conflicts', 'fix row', 'lower', 'revise'],
        ['pattern', 'fix color', 'low', 'revise'],
        ['stable', 'final', 'tiny', 'halt'],
      ],
    ),
    highlight: { active: ['r1:z', 'r2:z', 'r3:z', 'r1:move', 'r2:move', 'r3:move'], found: ['r4:move', 'r4:y'] },
    explanation: 'A useful way to inspect a recursive reasoner is as a ledger. Each row stores the scratchpad state, the visible answer state, a residual error estimate, and the action taken by the halting policy.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'recursion step', min: 0, max: 8 }, y: { label: 'normalized score', min: 0, max: 1 } },
      series: [
        { id: 'error', label: 'error', points: [{ x: 0, y: 0.92 }, { x: 1, y: 0.64 }, { x: 2, y: 0.42 }, { x: 3, y: 0.27 }, { x: 4, y: 0.15 }, { x: 5, y: 0.11 }, { x: 6, y: 0.10 }, { x: 7, y: 0.10 }, { x: 8, y: 0.10 }] },
        { id: 'confidence', label: 'confidence', points: [{ x: 0, y: 0.12 }, { x: 1, y: 0.34 }, { x: 2, y: 0.53 }, { x: 3, y: 0.68 }, { x: 4, y: 0.80 }, { x: 5, y: 0.86 }, { x: 6, y: 0.87 }, { x: 7, y: 0.87 }, { x: 8, y: 0.87 }] },
      ],
      markers: [
        { id: 'halted', x: 6, y: 0.87, label: 'halt' },
      ],
    }),
    highlight: { active: ['error', 'confidence', 'halted'] },
    explanation: 'Recursive inference is useful only if extra steps buy real improvement. The halt marker should fire when the state is stable enough or when a step budget is reached.',
  };

  yield {
    state: labelMatrix(
      'Data structures inside the loop',
      [
        { id: 'latent', label: 'z state' },
        { id: 'answer', label: 'y buffer' },
        { id: 'counter', label: 'counter' },
        { id: 'halt', label: 'halt score' },
        { id: 'ema', label: 'ema' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['features', 'compute'],
        ['candidate', 'correct'],
        ['depth', 'budget'],
        ['stability', 'stop'],
        ['target avg', 'train halt'],
      ],
    ),
    highlight: { active: ['latent:stores', 'answer:stores', 'halt:why'], found: ['ema:why'] },
    explanation: 'The implementation is not magic. It is a compact recurrent state machine with a latent vector, an answer tensor, a step counter, a halt signal, and training targets that reward improvement before stopping.',
  };
}

function* haltAndVerify() {
  yield {
    state: loopGraph('Recursive inference needs a stop policy'),
    highlight: { active: ['core', 'halt', 'emit', 'e-core-halt', 'e-halt-emit'], compare: ['loss'], found: ['answer'] },
    explanation: 'A recursive reasoner can keep spending compute forever. The halt policy converts iterative improvement into an inference algorithm: continue while correction is likely, emit when the answer has stabilized.',
  };

  yield {
    state: labelMatrix(
      'Reasoning-loop family',
      [
        { id: 'cot', label: 'CoT' },
        { id: 'hrm', label: 'HRM' },
        { id: 'trm', label: 'TRM' },
        { id: 'prm', label: 'PRM search' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'loop', label: 'loop' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['text trace', 'tokens', 'verbosity'],
        ['fast/slow', 'hierarchy', 'fragile'],
        ['z plus y', 'same core', 'early halt'],
        ['candidate tree', 'verify', 'verifier bias'],
      ],
    ),
    highlight: { active: ['trm:state', 'trm:loop'], compare: ['cot:loop'], found: ['prm:loop'] },
    explanation: 'Tiny recursive models differ from chain-of-thought prompting. The loop is inside the model state, not merely a long visible text trace. That makes it closer to adaptive computation and verifier-guided search than to ordinary prompting.',
  };

  yield {
    state: labelMatrix(
      'Complete case study: ARC-style grid repair',
      [
        { id: 'read', label: 'read' },
        { id: 'infer', label: 'infer' },
        { id: 'paint', label: 'paint' },
        { id: 'check', label: 'check' },
      ],
      [
        { id: 'structure', label: 'structure' },
        { id: 'operation', label: 'operation' },
        { id: 'signal', label: 'signal' },
      ],
      [
        ['color grid', 'embed cells', 'features'],
        ['z state', 'find rule', 'residual'],
        ['y buffer', 'update cells', 'candidate'],
        ['halt gate', 'compare', 'stable'],
      ],
    ),
    highlight: { active: ['infer:structure', 'paint:structure', 'check:structure'], found: ['check:signal'] },
    explanation: 'For an ARC-style grid task, z can hold the inferred transformation rule while y holds the current output grid. Each recursion step updates the rule and patches the grid until the residual no longer improves.',
  };

  yield {
    state: labelMatrix(
      'Failure and audit checklist',
      [
        { id: 'stuck', label: 'fixed point' },
        { id: 'halt', label: 'early halt' },
        { id: 'depth', label: 'depth' },
        { id: 'data', label: 'data leak' },
        { id: 'verify', label: 'verify' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['wrong stable', 'restart'],
        ['weak answer', 'margin'],
        ['too many steps', 'budget'],
        ['memorized task', 'heldout'],
        ['looks solved', 'oracle'],
      ],
    ),
    highlight: { active: ['stuck:guard', 'halt:guard', 'verify:guard'], compare: ['data:symptom'] },
    explanation: 'The audit is as important as the architecture. Recursive improvement can hide a bad fixed point, a leaky benchmark, or a halt policy that stops because it is overconfident rather than correct.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'latent recursion') yield* latentRecursion();
  else if (view === 'halt and verify') yield* haltAndVerify();
  else throw new InputError('Pick a Tiny Recursive Model view.');
}

export const article = {
  references: [
    { title: 'Less is More: Recursive Reasoning with Tiny Networks', url: 'https://arxiv.org/abs/2510.04871' },
    { title: 'Hierarchical Reasoning Model', url: 'https://arxiv.org/abs/2506.21734' },
    { title: 'A Mechanistic Analysis of the Hierarchical Reasoning Model', url: 'https://arxiv.org/abs/2601.10679' },
  ],
  sections: [
    {
      heading: 'Why this topic exists',
      paragraphs: [
        `Tiny Recursive Model reasoning exists because some hard reasoning tasks do not mainly fail from lack of facts. They fail because the solver has to hold a compact state, repair it several times, and stop only after the state is consistent. Sudoku, maze solving, and ARC-style grid transformations are examples. They are not asking for broad world knowledge. They are asking for a small computation that can notice constraints, revise a candidate answer, and avoid locking onto the first plausible pattern.`,
        `Large language models usually spend extra reasoning compute by writing more tokens. That works for many language tasks, but it is an awkward fit for small structured puzzles. A long visible chain of thought can be verbose, brittle, and hard to score step by step. The TRM idea asks a different question: can a small network use repeated internal updates as its reasoning budget? The educational value is that the model becomes a state machine with a latent scratchpad, an answer buffer, a step counter, and a halt rule.`,
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        `The naive neural approach is a single forward pass. Embed the puzzle, run a network, emit the answer. This is simple and fast, but it gives the model one chance to assemble all constraints at once. If the answer is almost right but violates one hidden rule, there is no built-in mechanism for repair. The model can only hope that training has compressed the whole algorithm into one feed-forward computation.`,
        `The naive prompting approach is to ask a large model to reason out loud. That shifts the loop into text. It may help when the task can be decomposed linguistically, but it wastes tokens on explanations the task does not need. It also creates a mismatch: the solver is scored on a grid or path, while the intermediate reasoning is free-form prose. A small recursive model keeps the loop close to the object being solved.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to separate hidden computation from visible answer. TRM-style reasoning keeps a latent state z and an answer state y. The latent state can store hypotheses, constraints, conflict signals, and partial discoveries. The answer state stores the candidate output that will eventually be judged. The same small recurrent core reads both states and writes revised versions of both states.`,
        `That split matters. If y is wrong but z has learned the right rule, the next step can repair y without throwing away the whole computation. If z is confused, y can still preserve a useful partial answer while later passes improve the hidden state. The model is not just deeper in the usual layer-stacking sense. It is reusing the same parameters as an iterative repair operator.`,
      ],
    },
    {
      heading: 'How the loop works',
      paragraphs: [
        `First the input is embedded into a representation the recurrent core can read. The initial z state may be blank or derived from the input. The initial y state may be an empty answer, a rough guess, or a learned initialization. At each recursion step the core consumes the input features, z, y, and often a step signal. It emits an updated z and y. Training unrolls the recurrence so the model is rewarded for improvements across the actual sequence of repairs.`,
        `During inference the system repeats the same core until a stopping rule fires or a fixed budget is exhausted. The halt signal can be based on a learned confidence score, stability of y, residual improvement, or an external verifier when one exists. A good trace shows y becoming more correct and z becoming more stable. A bad trace shows the loop oscillating, making irrelevant edits, or becoming confidently wrong too early.`,
        `For an ARC-style grid, z might represent a guessed transformation rule: copy a shape, recolor an object, extend a line, count components, or reflect a pattern. The y buffer is the current output grid. One pass finds coarse objects. Another notices that a color rule is inconsistent. Another fixes a row. The final pass sees little useful residual error and halts. The algorithmic object is the ledger of revisions, not just the final grid.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The reason recursion can work is parameter reuse. A two-layer core can behave like a deeper computation when it is applied repeatedly to a persistent state. Each pass is not learning a different layer of features; it is learning a correction rule. If that correction rule generalizes, the model can spend more steps on harder instances without adding more parameters.`,
        `It also works because many puzzle tasks have local error signals. A candidate answer can be partially right. A row can be fixed while another row remains wrong. A maze path can satisfy one constraint and violate another. A recurrent state can preserve the good part and focus later steps on the remaining conflict. This is closer to constraint propagation than to memorizing a large table of examples.`,
        `The approach is most credible when the task has a compact state, repeated correction, and a clear evaluator. It is least credible when success depends on open-ended knowledge, long external context, or facts that are not present in the input. The model can learn a computation; it cannot invent missing evidence.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The visual separates z, y, the shared core, and the halt gate because those are the important data structures. z is the hidden scratchpad. y is the candidate answer. The core is reused at every recursion step. The halt gate decides when more compute is unlikely to help. If those pieces blur together, the model is just a feed-forward predictor with extra labels.`,
        `The state ledger view proves that recursive reasoning should be audited as a sequence. A useful trace records the latent state, the answer state, the residual, the action, and the halt margin at each step. The plot view proves the serving contract: extra steps should reduce error or expose uncertainty. If confidence rises while error stays flat, the halt rule is learning overconfidence, not reasoning.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `TRM moves cost from parameter count to recurrent depth. That is attractive when a small model can solve a task in a few iterations, but it is not free. Each recursion step is another forward pass through the core and another state update to store during training. Training through many unrolled steps can increase memory use and make optimization more sensitive.`,
        `Serving also needs a budget. A simple puzzle should halt quickly. A harder puzzle may need more steps. A failed puzzle should not consume unbounded compute. The product decision is whether one recursive run is better than sampling several answers from a larger model, running a verifier-guided search, or using a hand-written solver. A fair comparison needs latency, memory, step count, solved-task slices, and failure traces.`,
        `There is a modeling tradeoff too. A small recurrent core has less capacity for broad knowledge and may specialize strongly to the training distribution. That specialization is useful when the distribution is the product. It is dangerous when benchmark performance is treated as proof of general intelligence.`,
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        `The cleanest uses are structured puzzle domains: Sudoku variants, maze tasks, programmatic grids, small planning problems, and synthetic reasoning benchmarks where the full input is visible and the output is easy to score. These domains let researchers study iterative repair without mixing in search-engine recall or world knowledge.`,
        `The systems lesson is broader. A tiny recursive model is one member of a family of adaptive-compute methods. Early-exit transformers spend fewer layers on easy examples. Speculative and verifier-guided inference spend extra work only when a candidate needs checking. Process reward models score intermediate states. TRM is the compact-state version of the same idea: spend compute as repeated repair, then stop.`,
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        `The main failure mode is a wrong fixed point. The loop becomes stable, the halt rule fires, and the answer is still wrong. This can happen when the model learns a misleading shortcut or when the residual signal is too weak to distinguish a valid solution from a plausible one. Restarts, external verifiers, margins before halt, and held-out puzzle families can expose this failure.`,
        `A second failure mode is oscillation. The model repairs one part of y and breaks another, then alternates between partial fixes. A third is early halt, where confidence rises before the answer is correct. A fourth is depth dependence, where some examples need more steps than the budget allows. A fifth is data leakage or family memorization. Puzzle benchmarks often have generated structure, so splits must prove that the model is learning a repair rule rather than memorizing a generator.`,
        `TRM is also not a drop-in substitute for language reasoning. It does not solve retrieval, citation, tool use, or long-context grounding by itself. It teaches a narrower and valuable idea: when the problem is compact and checkable, a small learned repair loop may beat a much larger one-shot predictor.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study the original TRM paper with the HRM paper beside it. HRM uses a hierarchy of recursive modules, while TRM asks how much of that machinery can be removed. Then study Adaptive Computation Time Halting, Early-Exit Transformer Layer Skipping, Process Reward Models and Verifier Search, Tree of Thoughts Search, Chain of Draft Reasoning Token Budget Case Study, and Verifier-Guided Inference Control Plane Case Study.`,
        `For implementation practice, build a small grid task where the answer buffer is explicit. Log z statistics, y edit distance, residual estimates, halt margin, and final correctness at every step. The goal is not only to get accuracy. The goal is to see whether the loop is actually repairing state or merely repeating a confident mistake.`,
      ],
    },
  ],
};
