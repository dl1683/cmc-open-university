// Deoptimization metadata: optimized code keeps maps from machine state back
// to interpreter/baseline state at safe points.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'deoptimization-stack-maps-safepoints',
  title: 'Deoptimization Stack Maps & Safepoints',
  category: 'Concepts',
  summary: 'Optimized code needs an exit ramp: safepoints, stack maps, live-value locations, materialized frames, and resume metadata.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['deopt metadata', 'safepoint resume'], defaultValue: 'deopt metadata' },
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

function deoptGraph(title) {
  return graphState({
    nodes: [
      { id: 'opt', label: 'opt', x: 0.8, y: 3.8, note: 'fast' },
      { id: 'guard', label: 'guard', x: 2.4, y: 3.8, note: 'check' },
      { id: 'safe', label: 'safe', x: 4.0, y: 2.3, note: 'point' },
      { id: 'map', label: 'map', x: 4.0, y: 5.3, note: 'live' },
      { id: 'materialize', label: 'frame', x: 6.0, y: 3.8, note: 'rebuild' },
      { id: 'baseline', label: 'base', x: 7.8, y: 2.3, note: 'lower tier' },
      { id: 'gc', label: 'GC', x: 7.8, y: 5.3, note: 'roots' },
      { id: 'resume', label: 'resume', x: 9.1, y: 3.8, note: 'continue' },
    ],
    edges: [
      { id: 'e-opt-guard', from: 'opt', to: 'guard' },
      { id: 'e-guard-safe', from: 'guard', to: 'safe' },
      { id: 'e-guard-map', from: 'guard', to: 'map' },
      { id: 'e-safe-materialize', from: 'safe', to: 'materialize' },
      { id: 'e-map-materialize', from: 'map', to: 'materialize' },
      { id: 'e-materialize-baseline', from: 'materialize', to: 'baseline' },
      { id: 'e-materialize-gc', from: 'materialize', to: 'gc' },
      { id: 'e-baseline-resume', from: 'baseline', to: 'resume' },
      { id: 'e-gc-resume', from: 'gc', to: 'resume' },
    ],
  }, { title });
}

function* deoptMetadata() {
  yield {
    state: deoptGraph('Optimized code needs enough metadata to go backwards'),
    highlight: { active: ['opt', 'guard', 'safe', 'map', 'e-opt-guard', 'e-guard-safe', 'e-guard-map'], compare: ['resume'] },
    explanation: 'Optimized code can assume a stable shape or type only if a failing guard can reconstruct a correct lower-tier state.',
  };
  yield {
    state: labelMatrix(
      'Stack map record',
      [
        { id: 'pc', label: 'machine PC' },
        { id: 'x', label: 'value x' },
        { id: 'obj', label: 'object ref' },
        { id: 'env', label: 'environment' },
      ],
      [
        { id: 'location', label: 'location' },
        { id: 'needed', label: 'needed for' },
      ],
      [
        ['safepoint id', 'resume site'],
        ['register R1', 'interpreter slot'],
        ['stack slot 3', 'GC root'],
        ['constant table', 'frame rebuild'],
      ],
    ),
    highlight: { active: ['x:location', 'obj:location', 'env:location'], found: ['pc:needed'] },
    explanation: 'A stack map records where the runtime-required live values are at a machine-code address. It does not need every compiler value, only the values needed to resume or scan.',
    invariant: 'If the map is wrong, deoptimization is wrong even when the optimized computation was correct.',
  };
  yield {
    state: deoptGraph('Materialization rebuilds a lower-tier frame'),
    highlight: { active: ['map', 'materialize', 'baseline', 'e-map-materialize', 'e-materialize-baseline'], compare: ['opt'] },
    explanation: 'The runtime reads live values from registers, stack slots, and constants, then materializes the interpreter or baseline frame expected at the resume point.',
  };
}

function* safepointResume() {
  yield {
    state: deoptGraph('Safepoints also serve precise garbage collection'),
    highlight: { active: ['safe', 'map', 'gc', 'e-map-materialize', 'e-materialize-gc'], compare: ['baseline'] },
    explanation: 'A safepoint is a place where the runtime can understand machine state. GC needs to know which words are object references; deoptimization needs to know how to rebuild values.',
  };
  yield {
    state: labelMatrix(
      'Failure cases',
      [
        { id: 'map', label: 'stale map' },
        { id: 'value', label: 'missing value' },
        { id: 'pc', label: 'wrong PC' },
        { id: 'root', label: 'lost root' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'guardrail', label: 'guardrail' },
      ],
      [
        ['wrong resume', 'version check'],
        ['bad frame', 'liveness audit'],
        ['crash', 'safepoint table'],
        ['GC bug', 'root verifier'],
      ],
    ),
    highlight: { active: ['value:guardrail', 'pc:guardrail', 'root:guardrail'], compare: ['map:symptom'] },
    explanation: 'Deoptimization metadata is correctness-critical. Engines need verifiers, debug tracing, and carefully versioned assumptions.',
  };
  yield {
    state: deoptGraph('Tiering works because escape metadata exists'),
    highlight: { active: ['guard', 'safe', 'map', 'materialize', 'resume'], found: ['baseline'], compare: ['opt'] },
    explanation: 'JIT Tiering & Hotness Counters can promote aggressively only because deoptimization gives optimized code a precise exit path.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'deopt metadata') yield* deoptMetadata();
  else if (view === 'safepoint resume') yield* safepointResume();
  else throw new InputError('Pick a deoptimization view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Optimizing runtimes get speed by specializing code for what usually happens. A JavaScript JIT may assume a property load is monomorphic, a value is a small integer, a call target is stable, or an object allocation never escapes.',
        {type: 'callout', text: 'Speculative optimized code is only safe when every exit point carries enough metadata to rebuild the lower-tier state.'},
        'Those assumptions are allowed only if the runtime can recover when they stop being true. Deoptimization is the recovery path: optimized code leaves the fast tier, reconstructs a lower-tier execution state, and continues with correct language semantics.',
        'Stack maps and safepoints are the metadata that make that recovery precise. They tell the runtime where live values and object references are at selected machine-code addresses.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'One reasonable approach is to avoid speculation. Compile only code that is valid for every possible runtime value. That is simple and correct, but it leaves many dynamic-language optimizations unused.',
        'The opposite approach is to speculate aggressively and jump back to the interpreter when a guard fails. That sounds easy until the runtime asks a concrete question: what should the interpreter frame contain at this exact source position?',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Optimized machine code does not naturally preserve interpreter state. Register allocation moves values. Constant folding removes values. Inlining removes physical frames. Escape analysis can replace an object with a few scalar registers.',
        {type: 'image', src: 'https://v8.dev/_img/turbofan-jit/example-graph.png', alt: 'TurboFan intermediate representation graph with control value and effect edges', caption: 'Optimizing compilers can reshape code into graph IR; deoptimization metadata is the map back from that optimized shape to runtime state. Source: https://v8.dev/_img/turbofan-jit/example-graph.png'},
        'A raw machine stack is therefore not enough. When a guard fails, the runtime needs compiler-generated metadata that says which logical values are still needed, where those values live, and how to rebuild the frame shape expected by the lower tier.',
        'Precise garbage collection has the same problem in another form. The collector must know which machine words are object references. It cannot safely guess from arbitrary register and stack contents.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core idea is reversible speculation. The compiler may erase, move, inline, and specialize state only if it also emits a recipe that can reconstruct the lower-tier state at every possible exit point.',
        'That recipe lives in side tables: safepoint tables, stack maps, deoptimization ids, live-value locations, materialization descriptions, and resume targets. The optimized code is fast because the common path runs machine instructions. The metadata is what makes the uncommon path correct.',
        'A safepoint is a machine-code location where the runtime has an exact map of the state it cares about. For deoptimization, that means resume values. For GC, that means object references. The same idea supports both: the runtime can understand optimized machine state at known points.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During compilation, the optimizer inserts guards for assumptions. It also records deoptimization metadata at guard exits and other safepoints. The metadata maps the current machine program counter to logical values: registers, stack slots, constants, tagged pointers, or values that must be materialized.',
        {type: 'image', src: 'https://v8.dev/_img/maglev/graph.svg', alt: 'Maglev SSA graph printed on the command line', caption: 'SSA values need concrete recovery locations before optimized code can safely bail out. Source: https://v8.dev/_img/maglev/graph.svg'},
        'When a guard fails, optimized code transfers control to runtime support. The runtime looks up the deopt id or safepoint entry, reads the live values from their recorded locations, reconstructs any inlined frames and eliminated objects, invalidates or patches optimized code if needed, and resumes in the interpreter or a baseline tier.',
        'For GC, a safepoint lets the collector scan roots precisely. The stack map says which registers and stack slots hold object references. Non-reference words are ignored instead of being treated as possible pointers.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose optimized code for `return obj.x + 1` assumes that `obj` has the same hidden class seen during warmup and that `x` is stored at a known offset. The fast path is just a shape check, a load, and an integer add.',
        'If a later call passes an object with a different shape, the guard fails. The runtime cannot simply continue from the raw machine stack, because the optimized code may have inlined the caller, kept `obj` in a register, and represented the source frame differently.',
        'The deopt metadata says where `obj`, the current bytecode position, the inlined caller values, and any materialized temporaries live. The runtime rebuilds the lower-tier frame and resumes as if the optimized version had never been entered.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the deopt metadata view, follow the failing guard into the safepoint and stack map. The important state change is not the guard failure by itself. The important state change is that the runtime can name every value needed to resume lower-tier execution.',
        'The stack-map table shows why locations matter. A value in register R1, an object reference in stack slot 3, and a constant in a side table are all valid only because the metadata names them for this exact machine-code point.',
        'In the safepoint resume view, read the GC branch and baseline branch as two consumers of the same precision. GC needs exact roots. Deoptimization needs exact logical values. A stale map can break either path.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that every deopt point carries enough information to produce the lower-tier state that would have existed if execution had stayed in the lower tier.',
        'The compiler may optimize aggressively only while preserving that reconstruction recipe. If it removes an allocation, the recipe must materialize the object. If it inlines a function, the recipe must rebuild the logical frames needed for exceptions, debugging, and continuation.',
        'Correctness depends on exact agreement between code and metadata. Register allocation, instruction scheduling, inlining, and frame layout can all move live values. If the stack map is stale, deoptimization can be wrong even when the optimized arithmetic was right.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The steady-state cost is metadata size, guard checks, safepoint placement constraints, compiler bookkeeping, and occasional runtime transitions. The uncommon path cost is larger: reconstruct frames, materialize objects, patch or discard optimized code, and resume in a lower tier.',
        {type: 'image', src: 'https://v8.dev/_img/maglev/compile-time.svg', alt: 'Compile time comparison across V8 compilation tiers', caption: 'Tiered runtimes balance compile cost against optimized execution time, and deoptimization is the escape hatch that makes early promotion tolerable. Source: https://v8.dev/_img/maglev/compile-time.svg'},
        'When code behavior is stable, deoptimization metadata is insurance. It sits mostly unused while optimized code runs fast. When assumptions fail often, the program can thrash between tiers and spend real time rebuilding frames.',
        'The metadata grows with the number of safepoints and the number of live values that matter at each point. More precise maps improve GC and deopt correctness, but they increase code object size and make compiler pipelines more complex.',
        'Safepoint placement is a tradeoff. Too few safepoints can delay GC or make exits hard to express. Too many safepoints increase metadata and restrict optimization around calls, loops, and allocation points.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Deoptimization wins in dynamic runtimes because it makes speculation reversible. Engines can optimize for common object shapes, numeric representations, array layouts, and call targets without changing the result when uncommon behavior appears.',
        'It also supports tiered compilation. A runtime can start in an interpreter, move hot code into a baseline compiler, then promote stable code into a stronger optimizing compiler because optimized code has an exit path.',
        'The same metadata family supports precise GC, debugging, exception handling, on-stack replacement exits, and frame inspection. All of these systems need a trustworthy map from optimized machine state back to runtime state.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Deoptimization is the wrong tool for assumptions that fail constantly. If a call site is genuinely megamorphic or values change representation on every call, the engine should stay generic instead of repeatedly optimizing and bailing out.',
        'It is also expensive in code size. AOT systems, embedded runtimes, and simple interpreters may choose less speculation because they cannot afford large side tables and complex recovery machinery.',
        'The mechanism does not make speculative optimization safe by itself. The compiler must prove that every optimized transformation has a valid reconstruction story at each exit point.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A missing live value can produce a bad materialized frame. The source-level state looks plausible, but one variable contains the wrong value because the compiler failed to record where it moved.',
        'A wrong program counter or deopt id can resume at the wrong bytecode position. That can skip side effects, repeat side effects, or throw an exception from a frame shape that never existed.',
        'A stale object-reference map can become a GC bug. If the collector misses a live object reference, it may reclaim an object that optimized code still needs. If it treats a non-pointer as a pointer, it may retain garbage or corrupt metadata assumptions.',
        'Runtime teams fight these bugs with deopt stress modes, stack-map verifiers, frame materialization checks, root validators, and differential testing against lower-tier execution.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LLVM Stack Maps and Patch Points at https://llvm.org/docs/StackMaps.html, V8 Sparkplug at https://v8.dev/blog/sparkplug, V8 Maglev at https://v8.dev/blog/maglev, V8 Ignition at https://v8.dev/docs/ignition, and the V8 design docs index at https://v8.dev/docs.',
        'Study JIT Tiering & Hotness Counters for promotion policy, V8 Ignition Bytecode Pipeline Case Study for feedback collection, V8 Hidden Classes & Inline Caches for speculation sources, Escape Analysis & Scalar Replacement for materialization pressure, and V8 Generational Garbage Collection for precise root scanning.',
      ],
    },
  ],
};
