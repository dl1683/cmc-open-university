// Escape analysis: prove an allocation does not escape, then replace the object
// with scalar fields that can live in registers, stack slots, or optimized IR.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'escape-analysis-scalar-replacement',
  title: 'Escape Analysis & Scalar Replacement',
  category: 'Concepts',
  summary: 'Remove temporary allocations by proving objects do not escape: connection graphs, field scalars, allocation sinking, guards, and deopt recovery.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['no escape object', 'deopt recovery'], defaultValue: 'no escape object' },
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

function escapeGraph(title) {
  return graphState({
    nodes: [
      { id: 'alloc', label: 'alloc', x: 0.9, y: 3.8, note: 'object' },
      { id: 'fields', label: 'fields', x: 2.6, y: 2.4, note: 'x,y' },
      { id: 'inline', label: 'inline', x: 2.6, y: 5.2, note: 'callee' },
      { id: 'graph', label: 'graph', x: 4.4, y: 3.8, note: 'uses' },
      { id: 'escape', label: 'escape', x: 6.2, y: 2.4, note: 'store?' },
      { id: 'scalar', label: 'scalar', x: 6.2, y: 5.2, note: 'locals' },
      { id: 'code', label: 'code', x: 8.0, y: 3.8, note: 'no alloc' },
      { id: 'deopt', label: 'deopt', x: 9.4, y: 3.8, note: 'remat' },
    ],
    edges: [
      { id: 'e-alloc-fields', from: 'alloc', to: 'fields' },
      { id: 'e-alloc-inline', from: 'alloc', to: 'inline' },
      { id: 'e-fields-graph', from: 'fields', to: 'graph' },
      { id: 'e-inline-graph', from: 'inline', to: 'graph' },
      { id: 'e-graph-escape', from: 'graph', to: 'escape' },
      { id: 'e-graph-scalar', from: 'graph', to: 'scalar' },
      { id: 'e-scalar-code', from: 'scalar', to: 'code' },
      { id: 'e-code-deopt', from: 'code', to: 'deopt' },
    ],
  }, { title });
}

function* noEscapeObject() {
  yield {
    state: escapeGraph('Escape analysis asks whether an object can outlive its use'),
    highlight: { active: ['alloc', 'fields', 'inline', 'e-alloc-fields', 'e-alloc-inline'], compare: ['escape'] },
    explanation: 'The optimizer builds a use graph for an allocation. If the object never leaks to unknown code, a global store, or a returned value, it may be removable.',
  };
  yield {
    state: labelMatrix(
      'Escape decisions',
      [
        { id: 'local', label: 'local fields' },
        { id: 'return', label: 'return obj' },
        { id: 'store', label: 'global store' },
        { id: 'call', label: 'unknown call' },
      ],
      [
        { id: 'decision', label: 'decision' },
        { id: 'action', label: 'action' },
      ],
      [
        ['no escape', 'scalar replace'],
        ['escapes', 'allocate'],
        ['escapes', 'allocate'],
        ['unknown', 'conservative'],
      ],
    ),
    highlight: { active: ['local:decision', 'local:action'], compare: ['return:action', 'store:action'], found: ['call:decision'] },
    explanation: 'Scalar replacement decomposes an object into field values. Instead of allocating {x,y}, the optimizer keeps x and y as separate SSA values or registers.',
    invariant: 'Allocation removal is legal only if every observable object identity effect is preserved.',
  };
  yield {
    state: escapeGraph('Scalar replacement removes allocation pressure'),
    highlight: { active: ['graph', 'scalar', 'code', 'e-graph-scalar', 'e-scalar-code'], compare: ['escape'] },
    explanation: 'When the proof succeeds, the optimized code can compute with scalars directly, reducing allocation rate and garbage-collection pressure.',
  };
}

function* deoptRecovery() {
  yield {
    state: escapeGraph('JITs may need to recreate removed objects at deopt'),
    highlight: { active: ['code', 'deopt', 'e-code-deopt'], found: ['scalar'], compare: ['alloc'] },
    explanation: 'If optimized code deoptimizes, the runtime may need to rematerialize an object that was scalar-replaced so lower-tier code sees a valid object state.',
  };
  yield {
    state: labelMatrix(
      'Rematerialization map',
      [
        { id: 'x', label: 'field x' },
        { id: 'y', label: 'field y' },
        { id: 'klass', label: 'shape' },
        { id: 'id', label: 'identity' },
      ],
      [
        { id: 'source', label: 'source' },
        { id: 'restore', label: 'restore' },
      ],
      [
        ['scalar x', 'object.x'],
        ['scalar y', 'object.y'],
        ['map guard', 'object map'],
        ['none if unused', 'materialize if needed'],
      ],
    ),
    highlight: { active: ['x:restore', 'y:restore'], found: ['klass:source'], compare: ['id:restore'] },
    explanation: 'The deopt metadata must know how to rebuild the logical object from the scalar values still live at the safepoint.',
  };
  yield {
    state: escapeGraph('Inlining often unlocks the proof'),
    highlight: { active: ['inline', 'graph', 'scalar', 'e-inline-graph', 'e-graph-scalar'], compare: ['escape'] },
    explanation: 'A call can look like an escape until inlining reveals that the callee only reads fields. That is why escape analysis, inlining, and deoptimization metadata are tightly coupled in JITs.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'no escape object') yield* noEscapeObject();
  else if (view === 'deopt recovery') yield* deoptRecovery();
  else throw new InputError('Pick an escape-analysis view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Escape analysis determines whether an allocated object can be observed outside a local region. If it cannot escape, the compiler may remove the allocation and replace object fields with scalar values. This is called scalar replacement.',
        'The optimization is valuable because many programs create short-lived temporary objects. If those objects never need identity, synchronization, or heap reachability, allocating them just creates garbage-collector work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The compiler tracks where the object flows: local field reads and writes, calls, returns, stores into globals, stores into other heap objects, and exceptional exits. Unknown calls and escaping stores usually force conservative allocation unless inlining or summaries prove them safe.',
        'After a no-escape proof, the fields become SSA values. Reads become uses of those values, writes become new scalar versions, and the allocation disappears. In a JIT, deoptimization metadata may still need to reconstruct the removed object if execution falls back to a lower tier.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a function that creates {x:a, y:a}, calls abs(v), and abs only reads v.x and v.y. Before inlining, the call may hide whether v escapes. After inlining, the compiler sees both fields directly and can compute sqrt(a*a + a*a) without allocating the object.',
        'The hard cases are identity and recovery. If code compares object identity, stores the object somewhere visible, or deoptimizes into code expecting the object, the optimizer must either keep the allocation or carry enough metadata to rematerialize it correctly.',
      ],
    },
    {
      heading: 'Engineering notes',
      paragraphs: [
        'Escape analysis usually depends on other optimizations. Inlining exposes callees. Constant propagation and type feedback can prove which branch executes. Deoptimization Stack Maps & Safepoints explain why a JIT must remember enough live scalar state to rebuild an object if optimized assumptions fail.',
        'The proof can be whole-method, partial, or path-sensitive. Whole-method escape analysis is simpler but misses objects that escape only on cold paths. Partial escape analysis can sink allocation into the rare path and keep the hot path allocation-free, but it requires more precise control-flow reasoning and recovery metadata.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'The trap is forgetting that objects have identity and observable behavior. Removing an allocation is safe only when no code can observe that identity, mutation ordering, synchronization behavior, weak references, finalization, or debugger-visible state in a way that changes semantics. This is why security-sensitive JIT optimizations are designed conservatively and tested heavily.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: V8 escape-analysis security note at https://v8.dev/blog/disabling-escape-analysis, V8 escape-analysis slides at https://www.jfokus.se/jfokus18/preso/Escape-Analysis-in-V8.pdf, OpenJDK HotSpot escape-analysis report at https://cr.openjdk.org/~cslucas/escape-analysis/EscapeAnalysis.html, and partial escape analysis paper at https://ssw.jku.at/Research/Papers/Stadler14/Stadler2014-CGO-PEA.pdf. Study Static Single Assignment & Phi Nodes, Deoptimization Stack Maps & Safepoints, V8 Generational Garbage Collection, and JIT Tiering & Hotness Counters next.',
      ],
    },
  ],
};
