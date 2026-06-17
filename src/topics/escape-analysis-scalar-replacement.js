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
      heading: 'Why this exists',
      paragraphs: [
        `Modern languages make allocation feel cheap because objects are the natural way to bundle values. A point has x and y. An iterator has current state. A tuple carries two results out of a helper. In source code those objects make the program clearer. In a hot loop they can become noise: headers, zeroing, write barriers, remembered-set traffic, young-generation pressure, and later garbage-collector work for data that never needed an independent heap identity.`,
        `Escape analysis exists because a compiler can sometimes prove that an allocation is only a temporary carrier of fields. If no outside code can observe the object as an object, the runtime does not need to put it on the heap. Scalar replacement is the follow-up optimization: split the aggregate into its fields and keep those fields as SSA values, registers, stack slots, or optimized intermediate representation values.`,
        `The important word is prove. A compiler cannot remove an allocation because it looks small or short-lived. It must preserve every observable effect of the source program: reference equality, field mutation order, exceptions, synchronization, weak references, finalization, debugger state, and deoptimization. The optimization is valuable because many real allocations are temporary values, but it is safe only when the object boundary is invisible to the rest of the program.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious runtime approach is literal allocation: every object expression creates a heap object, and a generational garbage collector makes most short-lived objects cheap. That approach is simple, correct, and good enough for a large amount of application code. Bump-pointer allocation in a young generation can be close to pointer arithmetic, and batch collection makes many dead objects disappear together.`,
        `The wall is that "cheap" is not free. A loop that creates a pair object for every iteration still writes object headers, initializes fields, may execute barriers, increases allocation rate, and pushes more bytes through the memory hierarchy. If the loop runs millions of times per second, the collector and allocator become part of the algorithm's cost. The program did not need heap reachability; it needed two numbers to survive until the next expression.`,
        `The wall gets sharper in JIT-compiled languages because optimized code may inline several helpers and expose a whole chain of temporary allocations. A source program that looks object-oriented can lower to arithmetic on a few fields. If the compiler keeps the object boundaries after it has enough proof to remove them, it leaves performance on the table.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to analyze the allocation's observation boundary. An object can be removed when all of its uses are local enough that the rest of the program cannot tell whether the object was ever materialized. Field reads and writes are internal. Returning the object, storing it into a global, storing it into another heap object, passing it to unknown code, publishing it to another thread, or throwing it through an escaping path may expose identity.`,
        `Once the no-escape proof holds, the aggregate can be represented by its scalar fields. A read of obj.x becomes the current SSA value for x. A write to obj.x becomes a new SSA version of x. If obj.y is never read, y may disappear. If both fields feed arithmetic, later optimizations can fold constants, remove dead stores, or keep everything in registers. The allocation is no longer an event in the generated code.`,
        `This is why escape analysis is tied to inlining. A call boundary hides facts. Before inlining, passing an object to helper(obj) may look like an escape. After inlining, the compiler may see that helper only reads obj.x and obj.y. The same source program can move from "must allocate" to "can scalar replace" when the optimizer gets more context.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The graph view is an observation-boundary test. The allocation node is harmless by itself. Edges to local fields and inlined code are still inside the optimizer's known world. Edges to return values, global stores, unknown calls, heap stores, or exceptional exits point toward observers that may care about object identity. The visual distinction is the legal line between a field bundle and a real heap object.`,
        `The decision table shows why the optimizer is conservative. A local field-only object can be scalar replaced. A returned object must be allocated because the caller can observe it. A global store must be allocated because later code can load the reference. An unknown call is not automatically bad, but without a body, a trusted summary, or a guard, the compiler has to assume the call may keep or publish the reference.`,
        `The deoptimization view proves the second half of the contract. Optimized code can run without the object, but lower-tier code, a debugger, or an exception path may need the logical object state at a safepoint. The rematerialization map records how to rebuild the object from live scalars. Removing the allocation is safe only because the runtime can re-create the illusion when execution falls back.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness argument is observational equivalence. If every use of the object can be rewritten as use of its fields, and no allowed program operation can detect the missing identity, then the optimized program has the same behavior as the source program. Field reads see the same values. Field writes update the next scalar version. Dead fields remain unobserved. The object header, address, and allocation event were implementation details, not source-level facts.`,
        `SSA form makes the rewrite tractable. Each field version has a clear definition and a set of uses. At control-flow joins, phi nodes represent which scalar value reaches the join. If the analysis cannot represent a merge precisely enough, it must allocate. If a field is passed to arithmetic, arithmetic gets the scalar directly. The invariant is that every path that would have reached a field load now reaches the scalar value that the field would contain on that path.`,
        `Partial escape analysis extends the same idea to paths. An object may escape only on a rare branch. A path-sensitive optimizer can keep the common path scalarized and sink allocation into the branch that publishes the object. That is still the same proof: materialize the object at the first point where observation becomes possible, and keep it absent before that point.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `The analysis itself costs compiler time and memory. A simple method-local analysis is cheaper and easier to reason about, but it misses objects that only become provably local after inlining or path reasoning. Interprocedural summaries can help, but summaries must be invalidated when assumptions change. A JIT also has a budget: spending too long proving away one allocation can delay optimized code enough that the program loses overall.`,
        `The runtime payoff is concrete. Successful scalar replacement lowers allocation rate, reduces young-generation collection pressure, removes write barriers, exposes scalar values to register allocation, and can unlock constant folding or dead-store elimination. When input size doubles, the asymptotic algorithm may be unchanged, but the allocation multiplier inside the loop can decide whether the program is CPU-bound, memory-bound, or GC-bound.`,
        `The hidden tax is recovery metadata. A deoptimizing runtime must know which eliminated objects exist logically and how to rebuild them. Each safepoint needs enough mapping from optimized scalar state to interpreter-visible state. More aggressive scalarization can therefore increase metadata size and make compiler bugs more dangerous.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Escape analysis wins on temporary tuples, small numeric objects, iterator result objects, autoboxed values, geometry points, complex-number helpers, stream pipelines, and allocation-heavy hot loops. These are cases where source-level objects improve program structure but the machine only needs fields.`,
        `It also matters in language implementations. JavaScript engines, JVM JITs, and other optimizing runtimes use escape reasoning to close part of the gap between high-level allocation-heavy source and lower-level scalar code. The V8 note on disabling an older escape-analysis implementation describes the intended optimization: when an object does not escape, fields can be treated as local variables and stored in registers or on the stack. The OpenJDK HotSpot report frames scalar replacement the same way: decompose an object into fields and replace field access with local variables.`,
        `The best fit is stable hot code. Profiling should show allocation pressure near the top of the cost. The object should have simple fields, limited aliasing, and calls that inline or have trusted summaries. Without those conditions, the optimizer may spend effort only to conclude that the object escapes.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The optimization fails when identity matters. Reference equality, identity hash codes, synchronization monitors, weak references, finalizers, native interop, debugger inspection, and reflective access can all make the object more than a bag of fields. Mutation order can also matter when aliases exist. If two references may point to the same object, replacing fields independently can break aliasing semantics unless the compiler proves the aliases are impossible or equivalent.`,
        `Unknown calls are a common barrier. If a callee can store the reference, return it, compare it, synchronize on it, or pass it elsewhere, the caller has to allocate before the call. Inlining, type feedback, and method summaries reduce that uncertainty, but dynamic languages and virtual dispatch keep some calls opaque.`,
        `Wrong proofs are not harmless performance bugs. They are miscompiles. In a browser or VM running untrusted code, an escape-analysis bug can turn into a security problem because optimized code may expose impossible states after deoptimization or speculation failure. That is why production compilers keep the analysis conservative and why deopt metadata is part of the correctness story, not an implementation detail.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Static Single Assignment and phi nodes next, because scalar replacement is easiest to understand when each field update becomes a new SSA value. Then study alias analysis, inlining heuristics, deoptimization stack maps, safepoints, generational garbage collection, and JIT tiering. Those topics explain why the proof exists, why it is hard, and how the runtime can recover from optimized code.`,
        `Primary sources worth reading are V8's escape-analysis note at https://v8.dev/blog/disabling-escape-analysis, the OpenJDK HotSpot escape-analysis report at https://cr.openjdk.org/~cslucas/escape-analysis/EscapeAnalysis.html, the partial escape analysis paper at https://ssw.jku.at/Research/Papers/Stadler14/Stadler2014-CGO-PEA.pdf, and Kotzmann and Mossenbock on escape analysis with dynamic compilation and deoptimization.`,
      ],
    },
  ],
};
