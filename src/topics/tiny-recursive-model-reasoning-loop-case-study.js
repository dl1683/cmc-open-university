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
    { heading: 'How to read the animation', paragraphs: [
        'Read z as the hidden scratchpad and y as the visible candidate answer. Active nodes show the shared core reading the input, revising z, revising y, or deciding whether the loop should halt.',
        'A recursive model reuses the same small network several times instead of stacking many different layers. The safe inference rule is that a later answer is trusted only if repeated updates reduce residual error or pass a verifier, not because the loop ran longer.',
        {type:'callout', text:`The model spends compute by revising persistent state, not by emitting a longer explanation.`},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
        'Tiny Recursive Model reasoning exists because some tasks are small but not one-step. Sudoku, maze solving, and ARC-style grids require a solver to keep compact state, notice conflicts, repair a candidate answer, and stop when the state is consistent.',
        'Large language models often spend more reasoning compute by writing more tokens. A tiny recursive model asks whether the compute can instead be spent inside a latent state loop, where the output is a grid, path, or structured answer rather than a long explanation.',
      ],
    },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious neural approach is a single forward pass. Embed the puzzle, run a model once, and emit the answer.',
        'The obvious language-model approach is to reason out loud. That can help when the task decomposes into words, but it wastes tokens when the thing being solved is a compact state such as a grid or maze.',
      ],
    },
    { heading: 'The wall', paragraphs: [
        'The wall is repair. A one-pass model gets one chance to satisfy all constraints, so an almost-correct answer with one broken row has no built-in path to fix only the broken part.',
        'Text reasoning has a different wall: the trace is free-form while the score is structural. A model can write plausible steps and still output a grid that violates the actual rule.',
      ],
    },
    { heading: 'The core insight', paragraphs: [
        'The core insight is to separate hidden computation from visible answer. The latent state z can store hypotheses, constraints, conflict signals, and partial discoveries, while y stores the candidate output that will be scored.',
        'The same small core is applied repeatedly as a learned repair operator. If y is partly wrong but z contains the right rule, the next pass can edit y without restarting the whole computation.',
      ],
    },
    { heading: 'How it works', paragraphs: [
        'The input is embedded into features the recurrent core can read. The model initializes z and y, then each recursion step consumes the input features plus current z and y and emits revised versions of both states.',
        'Training unrolls the loop so the model is rewarded for improvements across steps. During inference, the system repeats until a fixed budget is exhausted or a halt rule says more steps are unlikely to help.',
      ],
    },
    { heading: 'Why it works', paragraphs: [
        'The correctness argument is conditional, because this is a learned solver rather than a hand-written proof algorithm. If the learned update preserves valid partial structure and reduces real constraint violations, repeated application can move y toward a correct fixed point.',
        'Parameter reuse is the mechanism that makes a small model behave like a deeper computation. The same core can apply a correction rule several times, so harder instances can spend more steps without adding more parameters.',
      ],
    },
    { heading: 'Cost and complexity', paragraphs: [
        'Cost moves from parameter count to step count. If the core costs C operations per pass and the model runs T recursive steps, inference costs about T times C plus the memory needed to carry z and y.',
        'Training is more expensive because the unrolled steps must store activations for gradient computation. A 27-million-parameter recurrent reasoning model run for 8 steps behaves more like 8 sequential applications of the same network than one ordinary forward pass.',
      ],
    },
    { heading: 'Real-world uses', paragraphs: [
        'The cleanest uses are compact, checkable domains: Sudoku variants, maze tasks, programmatic grids, small planning puzzles, and synthetic reasoning benchmarks where the full input is visible. These tasks let researchers study iterative repair without mixing in external knowledge retrieval.',
        'The systems lesson is broader. Adaptive-compute methods such as early exit, verifier-guided inference, process reward models, and recursive loops all spend more work only when a candidate state needs more repair.',
      ],
    },
    { heading: 'Where it fails', paragraphs: [
        'The main failure is a wrong fixed point. The loop stabilizes, the halt rule fires, and y is still wrong because the model learned a shortcut or the residual signal cannot distinguish a valid answer from a plausible one.',
        'It also fails outside compact grounded tasks. A tiny recursive loop does not solve retrieval, citation, tool use, or missing world knowledge, because the needed evidence is not contained in the puzzle state.',
      ],
    },
    { heading: 'Worked example', paragraphs: [
        'Suppose a 4 by 4 Sudoku-like grid has 16 cells and uses digits 1 through 4. The answer buffer y starts with 10 filled cells and 6 blanks, while z stores row, column, and box constraint summaries.',
        'Step 1 fills 3 blanks whose rows have only one missing digit, reducing blanks from 6 to 3. Step 2 detects that one filled cell creates a column conflict, changes that cell, and reduces conflicts from 1 to 0.',
        'Step 3 fills the final 3 blanks and the halt margin rises because y no longer violates row or column constraints. The cost is 3 passes through the core, and the correctness evidence is the constraint check on the final grid, not the fact that the model used recursion.',
      ],
    },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources: Less is More: Recursive Reasoning with Tiny Networks at https://arxiv.org/abs/2510.04871, Hierarchical Reasoning Model at https://arxiv.org/abs/2506.21734, and A Mechanistic Analysis of the Hierarchical Reasoning Model at https://arxiv.org/abs/2601.10679.',
        'Study adaptive computation time, early-exit transformers, process reward models, verifier search, tree search, chain-of-draft reasoning, and verifier-guided inference next. The useful implementation exercise is to log z summaries, y edit distance, residual, halt margin, and final correctness at every step.',
      ],
    },
  ],
};
