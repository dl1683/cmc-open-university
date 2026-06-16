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
      heading: 'What it is',
      paragraphs: [
        'Deoptimization is how optimized code safely gives up. A JIT compiler may assume a property load is monomorphic, a value is a small integer, or a call target is stable. If that assumption breaks, the engine must reconstruct a lower-tier execution state and continue correctly.',
        'The core data structures are safepoint tables, stack maps, live-value locations, deoptimization ids, materialization recipes, and resume targets. They are side tables for optimized machine code.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At selected machine-code addresses, the compiler emits metadata saying where runtime-needed values live: register, stack slot, constant, tagged pointer, or reconstructed object. A failing guard jumps to runtime support, which reads this map and rebuilds an interpreter or baseline frame.',
        'The same mechanism helps precise garbage collection. At a safepoint, the runtime can scan only the words that are actual object references instead of guessing from raw machine stack memory.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose optimized code inlines obj.x after seeing one hidden class. The guard checks the object Map. If the Map changes, optimized code cannot continue on the fast path. The stack map says the object is in R1, the accumulator is in stack slot 3, and the resume bytecode offset is 42. Runtime materializes the lower-tier frame and resumes there.',
        'Without this metadata, a fast JIT would be brittle. With it, the engine can speculate and still preserve JavaScript semantics when the world becomes more dynamic than expected.',
      ],
    },
    {
      heading: 'Engineering notes',
      paragraphs: [
        'Stack maps must match the exact generated code. Register allocation, instruction scheduling, inlining, and frame layout can all change live locations. That is why this topic connects directly to Linear Scan Register Allocation and V8 Generational Garbage Collection.',
        'A practical runtime also has to keep code versions straight. If a hidden-class dependency is invalidated, every code object that depends on it must either be patched, marked for deoptimization, or prevented from reentry. Metadata is therefore indexed both by machine-code address and by the assumptions it protects.',
        'Debugging support matters. Engines often need flags that force deoptimization at many safepoints, verify materialized frames, and compare optimized execution against lower-tier execution. Without those checks, wrong stack maps can masquerade as random crashes far from the bad metadata.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LLVM Stack Maps and Patch Points at https://llvm.org/docs/StackMaps.html, V8 Sparkplug blog at https://v8.dev/blog/sparkplug, V8 Maglev blog at https://v8.dev/blog/maglev, and V8 Ignition docs at https://v8.dev/docs/ignition. Study JIT Tiering & Hotness Counters, V8 Ignition Bytecode Pipeline Case Study, V8 Hidden Classes & Inline Caches, Linear Scan Register Allocation, V8 Generational Garbage Collection, and Escape Analysis & Scalar Replacement next.',
      ],
    },
  ],
};
