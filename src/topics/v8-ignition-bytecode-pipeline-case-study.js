// V8 Ignition: JavaScript source becomes AST, bytecode, interpreter feedback,
// inline caches, and eventually optimized code for hot paths.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'v8-ignition-bytecode-pipeline-case-study',
  title: 'V8 Ignition Bytecode Pipeline Case Study',
  category: 'Data Structures',
  summary: 'How V8 executes JavaScript through Ignition bytecode, register-style frames, feedback vectors, inline caches, and optimizing tiers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['ignition pipeline', 'feedback and tiering'], defaultValue: 'ignition pipeline' },
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

function ignitionGraph(title) {
  return graphState({
    nodes: [
      { id: 'source', label: 'JS', x: 0.8, y: 3.8, note: 'source' },
      { id: 'ast', label: 'AST', x: 2.1, y: 3.8, note: 'parse' },
      { id: 'bytecode', label: 'bc', x: 3.9, y: 3.8, note: 'Ignition' },
      { id: 'frame', label: 'frame', x: 5.7, y: 2.4, note: 'regs' },
      { id: 'feedback', label: 'fb', x: 5.7, y: 5.3, note: 'types/maps' },
      { id: 'ic', label: 'IC', x: 7.4, y: 5.3, note: 'property' },
      { id: 'turbofan', label: 'opt', x: 7.4, y: 2.4, note: 'TurboFan' },
      { id: 'code', label: 'code', x: 9.0, y: 3.8, note: 'machine' },
    ],
    edges: [
      { id: 'e-source-ast', from: 'source', to: 'ast' },
      { id: 'e-ast-bytecode', from: 'ast', to: 'bytecode' },
      { id: 'e-bytecode-frame', from: 'bytecode', to: 'frame' },
      { id: 'e-bytecode-feedback', from: 'bytecode', to: 'feedback' },
      { id: 'e-feedback-ic', from: 'feedback', to: 'ic' },
      { id: 'e-feedback-turbofan', from: 'feedback', to: 'turbofan' },
      { id: 'e-frame-turbofan', from: 'frame', to: 'turbofan' },
      { id: 'e-ic-code', from: 'ic', to: 'code' },
      { id: 'e-turbofan-code', from: 'turbofan', to: 'code' },
    ],
  }, { title });
}

function* ignitionPipeline() {
  yield {
    state: ignitionGraph('Ignition is the V8 bytecode interpreter tier'),
    highlight: { active: ['source', 'ast', 'bytecode', 'e-source-ast', 'e-ast-bytecode'], compare: ['turbofan'] },
    explanation: 'V8 parses JavaScript and produces Ignition bytecode. Ignition gives cold code a compact correct path before the engine spends heavier compiler work on hot functions.',
  };
  yield {
    state: labelMatrix(
      'Pipeline artifacts',
      [
        { id: 'source', label: 'source' },
        { id: 'ast', label: 'AST' },
        { id: 'bytecode', label: 'bytecode' },
        { id: 'feedback', label: 'feedback' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'structure', label: 'data structure' },
      ],
      [
        ['developer text', 'string/stream'],
        ['syntax tree', 'nodes'],
        ['portable ops', 'byte array'],
        ['runtime facts', 'vector slots'],
      ],
    ),
    highlight: { active: ['bytecode:structure', 'feedback:structure'], found: ['ast:structure'], compare: ['source:job'] },
    explanation: 'Ignition is not only an opcode loop. It sits between parser structures and runtime feedback, so the same bytecode site can execute correctly and record what actually happened.',
    invariant: 'Runtime feedback should describe observed behavior, not language-level guarantees.',
  };
  yield {
    state: ignitionGraph('Ignition bytecode connects to register-style frames'),
    highlight: { active: ['bytecode', 'frame', 'feedback', 'e-bytecode-frame', 'e-bytecode-feedback'], found: ['ic'] },
    explanation: 'Ignition is a register-based interpreter. Its bytecode operates over frame slots, and selected operations leave feedback slots for property loads, calls, arithmetic, and element access.',
  };
}

function* feedbackAndTiering() {
  yield {
    state: ignitionGraph('Feedback decides when generic code can specialize'),
    highlight: { active: ['feedback', 'ic', 'turbofan', 'e-feedback-ic', 'e-feedback-turbofan'], compare: ['code'] },
    explanation: 'Feedback vectors record observed shapes, value kinds, and call targets. Inline caches can use the evidence immediately, and optimizing tiers can compile hot paths only after the site looks stable enough.',
  };
  yield {
    state: labelMatrix(
      'Feedback examples',
      [
        { id: 'load', label: 'obj.x' },
        { id: 'call', label: 'fn()' },
        { id: 'add', label: 'a + b' },
        { id: 'array', label: 'arr[i]' },
      ],
      [
        { id: 'feedback', label: 'observed fact' },
        { id: 'optimization', label: 'possible fast path' },
      ],
      [
        ['one Map', 'monomorphic load'],
        ['one target', 'inline call'],
        ['small ints', 'fast add'],
        ['packed elems', 'fast element load'],
      ],
    ),
    highlight: { active: ['load:feedback', 'load:optimization'], found: ['array:optimization'], compare: ['add:feedback'] },
    explanation: 'The feedback vector is the bridge from dynamic JavaScript behavior to specialized machine code. Stable object shapes make property loads cheaper.',
  };
  yield {
    state: ignitionGraph('If assumptions break, optimized code must fall back'),
    highlight: { active: ['ic', 'turbofan', 'code'], compare: ['feedback'], removed: ['frame'] },
    explanation: 'A shape transition, unexpected type, or megamorphic call site can break an optimized assumption. The engine must deoptimize or route through generic handlers while preserving JavaScript semantics.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ignition pipeline') yield* ignitionPipeline();
  else if (view === 'feedback and tiering') yield* feedbackAndTiering();
  else throw new InputError('Pick a V8 Ignition view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read the pipeline from source to bytecode to feedback. Active nodes show the current artifact, found nodes show reusable runtime evidence, and compare nodes show optimization that should wait until the function is hot.',
      'Ignition is the V8 bytecode interpreter. Bytecode is a compact instruction stream, a frame is its local slot storage, and feedback is recorded evidence about shapes, calls, values, and indexed access.',
      {type:'callout', text:'Ignition makes bytecode both the first execution tier and the measurement surface that tells V8 when specialization is worth the risk.'},
    ] },
    { heading: 'Why this exists', paragraphs: ['A JavaScript engine needs quick startup and high peak speed. Ignition runs cold code correctly while collecting the facts later tiers need for hot code.'] },
    { heading: 'The obvious approach', paragraphs: ['Compiling every function to optimized machine code up front wastes startup time and memory. A simple interpreter starts quickly but leaves repeated property loads, calls, and arithmetic generic forever.'] },
    { heading: 'The wall', paragraphs: ['The wall is dynamic behavior. JavaScript does not promise one object shape, one call target, or one numeric representation at a site.'] },
    { heading: 'The core insight', paragraphs: ['The core insight is to make bytecode a measurement surface. Each important bytecode site can record what happened there, and later optimized code can guard those observations.'] },
    { heading: 'How it works', paragraphs: ['V8 parses source and generates Ignition bytecode. Ignition runs the bytecode over frame slots and updates feedback vectors for property loads, calls, arithmetic, and element access.'] },
    { heading: 'Why it works', paragraphs: ['Correctness belongs to the generic tier. Optimized code may assume a map, target, or value kind only after checking a guard, and failed guards return execution to a lower tier.'] },
    { heading: 'Cost and complexity', paragraphs: ['Ignition trades interpreter dispatch for lower startup cost. Feedback vectors cost memory, while deoptimization costs time when real execution violates a speculative assumption.'] },
    { heading: 'Real-world uses', paragraphs: ['This pipeline is normal in V8-based browsers and runtimes. It matters in large apps with much cold code and a smaller set of hot functions that become stable after warmup.'] },
    { heading: 'Where it fails', paragraphs: ['Ignition cannot make unstable code stable. Proxies, shape churn, sparse arrays, eval-heavy paths, and megamorphic call sites can keep execution on generic paths.'] },
    { heading: 'Worked example', paragraphs: ['For area(rect), the first calls run through Ignition and record that width and height came from one object map. After 1,000 similar calls, optimized code can use guarded field loads; if a later call passes a different shape, deoptimization preserves correctness.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: V8 Ignition at https://v8.dev/docs/ignition, V8 Ignition interpreter at https://v8.dev/blog/ignition-interpreter, V8 TurboFan at https://v8.dev/docs/turbofan, and V8 Hidden Classes at https://v8.dev/docs/hidden-classes. Study register virtual machines, inline caches, hotness counters, and deoptimization stack maps next.'] },
  ],
};
