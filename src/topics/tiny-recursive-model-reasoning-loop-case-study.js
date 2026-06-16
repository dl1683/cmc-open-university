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
      heading: 'What it is',
      paragraphs: [
        'The Tiny Recursive Model idea is that reasoning can be learned as repeated state repair by a small recurrent core. Instead of asking a huge model to emit a long visible explanation, the model maintains a latent scratchpad z and an answer state y, updates both through the same tiny network, and stops when the state has stabilized.',
        'The local TRM notes frame the distinction sharply: large language models compress knowledge, while a tiny recursive model learns a computation. This case study turns that into data structures: a latent state, an answer buffer, a loop counter, halt scores, residual estimates, and a training ledger across recursive steps.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An input puzzle is embedded into features. The recurrent core reads the current z state and y buffer, then writes a revised z and y. During training, the recurrence can be unrolled so gradients flow through the actual correction sequence. During inference, the same core is reused until a halt rule or step budget stops the loop.',
        'The important design move is separating computation from answer. z can hold hidden hypotheses, constraints, and conflict information. y holds the external answer that will be scored. If y is wrong but z has discovered the right rule, later steps can repair y without starting over.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider an ARC-style grid transformation. The initial y buffer is a rough output grid. The z state stores candidate rules such as copy, rotate, color remap, symmetry, or object count. Step one finds coarse structure. Step two discovers a conflicting cell group. Step three patches the output. Step four sees little residual improvement and halts.',
        'That workflow is an algorithmic object. You can log the z norm, y edit distance, residual score, halt margin, and per-step loss. Those logs make the model inspectable as a state machine rather than only as a final accuracy number.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A recursive core can be parameter-efficient because the same weights are reused at every step. The cost shifts from parameter count to recurrence depth. A simple task should halt quickly; a difficult task can spend more steps. This connects directly to Adaptive Computation Time Halting, early-exit transformers, and verifier-guided inference control planes.',
        'The practical serving question is whether recursive steps outperform simply sampling more candidates from a larger model. A fair comparison needs step count, wall-clock latency, memory footprint, solved-task slices, and failure cases, not just the most impressive benchmark row.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat a tiny recursive model as a universal replacement for LLM reasoning. It is promising when the task has compact state, repeated correction, and a clear evaluation signal. It may struggle when the task requires broad world knowledge, long textual context, or externally grounded evidence.',
        'The largest failure mode is a wrong fixed point: the loop becomes stable before the answer is correct. The second is benchmark leakage or over-specialization. Recursive architectures can look unusually strong on puzzle families if evaluation splits are not carefully designed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Less is More: Recursive Reasoning with Tiny Networks at https://arxiv.org/abs/2510.04871, Hierarchical Reasoning Model at https://arxiv.org/abs/2506.21734, and A Mechanistic Analysis of the Hierarchical Reasoning Model at https://arxiv.org/abs/2601.10679. Study Adaptive Computation Time Halting, Early-Exit Transformer Layer Skipping, Process Reward Models & Verifier Search, Chain of Draft Reasoning Token Budget Case Study, Tree of Thoughts Search Case Study, and Verifier-Guided Inference Control Plane Case Study next.',
      ],
    },
  ],
};
