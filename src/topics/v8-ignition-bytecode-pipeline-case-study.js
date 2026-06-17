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
    {
      heading: 'Why this exists',
      paragraphs: [
        'JavaScript engines need fast startup, low memory use, correct dynamic semantics, and high peak speed. Those goals pull against each other. A large web app contains startup glue, event handlers, library code, hot loops, and functions that run once.',
        'Ignition exists because V8 needs a cheap correct execution tier before it knows which code deserves heavier compiler work. It runs bytecode for cold and warming code, then records runtime feedback that later tiers can use when optimization is worth the cost.',
      ],
    },
    {
      heading: 'Obvious approach and wall',
      paragraphs: [
        'One obvious design is to compile every function directly to optimized machine code. Hot code gets a strong path, but the engine wastes time and memory on functions that may never run again. Startup suffers because the browser or runtime compiles too much before users see work complete.',
        'The opposite baseline is a simple interpreter with no feedback and no tiering. That starts quickly, but repeated property loads, calls, arithmetic, and array accesses stay generic forever. The wall is JavaScript dynamism: the engine needs evidence about actual shapes and values before specialization is safe enough to try.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'The core insight is to make bytecode both an execution format and a measurement surface. Ignition can run correct generic bytecode now, while feedback vectors remember what happened at each interesting bytecode site. Later code can specialize from local evidence instead of global guesses.',
        'The invariant is that feedback is observation, not language truth. A feedback slot may say that one property load has only seen one object Map so far. It may not say that all future calls must have that Map. Any optimized path that trusts the observation needs a guard and a safe fallback.',
      ],
    },
    {
      heading: 'Core pipeline',
      paragraphs: [
        'The pipeline is source text, parser structures, Ignition bytecode, register-style interpreter frames, feedback vectors, inline caches, and later optimizing tiers such as TurboFan. Each layer leaves behind a data structure the next layer can use.',
        'Ignition bytecode operates over frame slots rather than a pure operand stack. While bytecode executes, feedback vectors record facts such as object Maps seen at property loads, call targets at call sites, arithmetic operand kinds, and array element kinds.',
        'Inline caches can use that feedback quickly. If `obj.x` repeatedly sees one hidden class, the load can use a monomorphic fast path. If the function becomes hot and the feedback stays stable, optimized code can specialize the whole region more aggressively.',
      ],
    },
    {
      heading: 'Mechanism: feedback and tiering',
      paragraphs: [
        'Feedback vectors are indexed by bytecode sites. That local shape matters. The engine does not need a vague claim that a program usually uses objects well; it needs to know that this load site saw this shape, this call site saw this target, and this arithmetic site saw these operand kinds.',
        'Tiering is resource allocation. Cold code stays in a compact baseline path. Warm code can get inline-cache help. Hot code with stable feedback can justify compiler time. If later execution violates an assumption, guards route execution to a generic handler or deoptimize into a lower tier.',
        'The important state change in the visual is not just source becoming bytecode. It is source becoming bytecode plus feedback slots. The bytecode gives a correct path; the feedback tells V8 where a faster path might be safe.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider `area(rect) { return rect.width * rect.height; }`. The first calls run through Ignition bytecode. The property-load feedback slots may observe that `rect` usually has the same hidden class, and the arithmetic slots may observe numeric values. That evidence can make the property loads monomorphic and the multiplication path predictable.',
        'If later calls pass many unrelated shapes, the same feedback site becomes polymorphic or megamorphic. The function still returns the correct answer, but the engine loses the clean assumption that made the fast path attractive. If optimized code already exists, failed guards can deoptimize back to a lower tier.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a separation between meaning and speed. Ignition bytecode handlers implement JavaScript semantics without requiring specialization. Feedback is an observation about past executions, not a promise about future executions.',
        'Specialized paths are guarded. Optimized code may assume a shape, value kind, or call target only if it checks that the assumption still holds. When a check fails, execution falls back to a generic handler or deoptimizes into a lower tier that can represent the full JavaScript state.',
        'That is why optimization can be speculative without changing program meaning. The generic path owns correctness. Feedback and optimized code are allowed to be fast only while their guards remain true.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Ignition pays parse and bytecode-generation cost, then interpreter dispatch for executed bytecodes. That is cheaper than full optimization for cold code but slower than stable optimized machine code for hot loops.',
        'Feedback vectors cost memory and maintenance. They pay for themselves when inline caches or later compilation use the recorded facts. Code that runs once may never recover the feedback cost, but it also avoids the larger cost of optimizing everything up front.',
        'Deoptimization has a cost too. The engine must reconstruct a valid lower-tier state and continue with correct semantics. Frequent deopts are a performance smell: the runtime keeps paying for assumptions that real executions do not respect.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Ignition wins for startup-heavy workloads, large applications with much cold code, and dynamic programs where the engine needs real observations before optimizing. It keeps the first execution path compact while still collecting the facts needed for later speed.',
        'It also explains practical JavaScript performance advice. Stable object shapes, dense arrays, predictable element kinds, and repeated call targets produce useful feedback. Highly polymorphic sites still run, but they tend to stay on generic paths or produce weaker optimized code.',
        'As a teaching example, Ignition connects interpreters, bytecode arrays, frames, inline caches, profiling, optimized code, and deoptimization into one loop: run correctly now, measure local behavior, specialize when evidence is stable, and retreat when reality changes.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Ignition cannot make unstable behavior stable. Megamorphic property access, shape churn, mixed numeric representations, sparse arrays, proxies, `eval`, and cold one-off functions limit what feedback can buy. The engine remains correct, but specialization becomes less attractive.',
        'A bytecode tier is not free. It adds interpreter dispatch, bytecode storage, feedback metadata, tiering policy, and deoptimization machinery. A tiny embedded engine or a language with simpler static guarantees might choose a smaller pipeline.',
        'The failure mode for learners is overfitting code style to imagined internals. Use the model to understand profiles and hot paths. Do not write unreadable JavaScript to satisfy a guessed compiler pattern.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'For everyday JavaScript, the useful advice is plain: keep hot object shapes stable, build arrays densely, avoid mixing unrelated value kinds in the same hot collection, and keep call sites predictable on paths that profiles prove are hot. These choices usually make the code clearer for humans too.',
        'For debugging performance, look for instability rather than memorizing bytecodes. A function that receives many unrelated object shapes will produce noisy feedback. A loop that alternates numbers, strings, objects, and holes will make specialization fragile. A hot function that repeatedly deoptimizes is telling you that runtime behavior does not match the optimized assumption.',
        'Measure before changing code. Engine internals change, but the high-level rule is stable: predictable hot data paths are easier to specialize than chaotic ones.',
      ],
    },
    {
      heading: 'What the visual shows',
      paragraphs: [
        'The ignition-pipeline view follows a function from source text to parser structures, bytecode, frame slots, feedback vectors, inline caches, and later machine code. The important transition is from source to a compact instruction stream that can run before full optimization is justified.',
        'The feedback-and-tiering view shows local evidence moving into fast paths. Property loads, calls, arithmetic, and element access leave observations behind. Promotion is a guarded bet. Fallback means later execution proved the bet too narrow, so the engine returns to a more general path.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: V8 Ignition docs at https://v8.dev/docs/ignition, V8 Ignition interpreter blog at https://v8.dev/blog/ignition-interpreter, V8 TurboFan docs at https://v8.dev/docs/turbofan, V8 hidden classes docs at https://v8.dev/docs/hidden-classes, and V8 fast properties at https://v8.dev/blog/fast-properties.',
        'Study Register Virtual Machine: Lua Case Study for frame slots, Interpreter Dispatch Table & Threaded Code for bytecode dispatch, JIT Tiering & Hotness Counters for promotion policy, Deoptimization Stack Maps & Safepoints for fallback, and V8 Hidden Classes & Inline Caches for shape feedback.',
      ],
    },
  ],
};
