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
    state: ignitionGraph('Ignition is V8s bytecode interpreter tier'),
    highlight: { active: ['source', 'ast', 'bytecode', 'e-source-ast', 'e-ast-bytecode'], compare: ['turbofan'] },
    explanation: 'V8 parses JavaScript and produces Ignition bytecode. Ignition executes non-hot code quickly without immediately spending optimizing-compiler time.',
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
    explanation: 'Ignition is not just a loop over opcodes. It sits in a pipeline with parser structures before it and runtime feedback structures after it.',
    invariant: 'Runtime feedback should describe observed behavior, not language-level guarantees.',
  };
  yield {
    state: ignitionGraph('Ignition bytecode connects to register-style frames'),
    highlight: { active: ['bytecode', 'frame', 'feedback', 'e-bytecode-frame', 'e-bytecode-feedback'], found: ['ic'] },
    explanation: 'Ignition is a register-based interpreter. Its bytecode operates over frame slots and records feedback for operations such as property loads and calls.',
  };
}

function* feedbackAndTiering() {
  yield {
    state: ignitionGraph('Feedback decides when generic code can specialize'),
    highlight: { active: ['feedback', 'ic', 'turbofan', 'e-feedback-ic', 'e-feedback-turbofan'], compare: ['code'] },
    explanation: 'Feedback vectors record observed shapes, types, and call targets. Inline caches use this feedback immediately, and optimizing tiers can compile hot paths with the same evidence.',
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
    explanation: 'A shape transition, unexpected type, or megamorphic call site can invalidate an optimized assumption. The engine must deoptimize or route through generic handlers while preserving JavaScript semantics.',
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
    {
      heading: 'What it is',
      paragraphs: [
        'Ignition is V8s bytecode interpreter. It lets V8 run JavaScript through a compact bytecode representation before or instead of producing optimized machine code. That matters because much code runs only once, and compiling everything aggressively would waste memory and time.',
        'This topic ties together the runtime data structures already in the repo: Pratt Parser Expression AST, Register Virtual Machine: Lua Case Study, Interpreter Dispatch Table & Threaded Code, V8 Hidden Classes & Inline Caches, and V8 Generational Garbage Collection.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline begins with JavaScript source and parser output. V8 emits Ignition bytecode and executes it in a register-style interpreter. The interpreter frame stores local values and temporaries. While executing, V8 records feedback about property shapes, operand types, calls, and element kinds.',
        'That feedback feeds inline caches and optimizing tiers. A property access that repeatedly sees one hidden class can become a monomorphic fast path. A hot function with stable feedback can be optimized by TurboFan. If the observed assumptions later fail, optimized code must deoptimize or fall back.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'For function f(o) { return o.x + 1; }, Ignition executes bytecode for loading o.x, loading 1, adding, and returning. The first few executions collect feedback: which Map o had, what kind of number flowed through the addition, and whether the property load stayed monomorphic.',
        'If the call site keeps passing objects with the same shape, inline caches can read x from a known offset. If many unrelated shapes appear, the site becomes polymorphic or megamorphic and the engine uses a more generic lookup path. That is a runtime data-structure decision, not a change to JavaScript semantics.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'Ignition explains why JavaScript performance is structural. Stable object shapes, predictable element kinds, and repeated call targets give the engine high-quality feedback. Highly dynamic code still works, but it may stay in more generic paths.',
        'It also explains why bytecode exists even in a JIT engine. Bytecode is compact, fast to produce, easy to interpret, useful for profiling, and a good substrate for tiering. The optimizing compiler is a later bet made only when feedback says the bet is likely to pay.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: V8 Ignition docs at https://v8.dev/docs/ignition, V8 Ignition interpreter blog at https://v8.dev/blog/ignition-interpreter, V8 TurboFan docs at https://v8.dev/docs/turbofan, V8 hidden classes docs at https://v8.dev/docs/hidden-classes, and V8 fast properties at https://v8.dev/blog/fast-properties. Study Register Virtual Machine: Lua Case Study, Interpreter Dispatch Table & Threaded Code, JIT Tiering & Hotness Counters, Deoptimization Stack Maps & Safepoints, V8 Hidden Classes & Inline Caches, V8 Generational Garbage Collection, and JavaScript Lexical Environments & Closures next.',
      ],
    },
  ],
};
