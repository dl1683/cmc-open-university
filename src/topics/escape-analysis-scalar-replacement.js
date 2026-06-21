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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "No escape object" traces how the compiler builds a use graph for an allocation, checks each edge for escape, and replaces the object with scalar fields when no edge leaks identity. "Deopt recovery" shows the second half: how the runtime rebuilds eliminated objects when optimized code falls back to the interpreter.',
        {
          type: 'callout',
          text: 'Scalar replacement is legal only when the object identity is unobservable and every field use can be represented by scalars.',
        },
        'Active nodes are the current analysis step. Compared nodes (dimmed) mark paths that would force allocation if reached. Found nodes mark facts the compiler has established. The decision matrix maps each use category to its ruling: no-escape uses become scalar replacements; escaping uses force heap allocation.',
        {
          type: 'note',
          text: 'Watch the edge between "graph" and "escape" carefully. That single edge is the legal boundary between a field bundle the compiler can dissolve and a real heap object it must preserve.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Objects are the natural way to bundle values. A point has x and y. An iterator has current state. A tuple carries two results out of a helper. In source code those objects make the program clearer. In a hot loop they become noise: headers, zeroing, write barriers, remembered-set traffic, young-generation pressure, and garbage-collector work for data that never needed an independent heap identity.',
        'Escape analysis exists because a compiler can sometimes prove that an allocation is only a temporary carrier of fields. If no outside code can observe the object as an object, the runtime does not need to put it on the heap. Scalar replacement is the follow-up: split the aggregate into its fields and keep those fields as SSA values, registers, or stack slots.',
        {
          type: 'quote',
          text: 'An object that does not escape is not an object. It is a naming convention over scalars.',
          attribution: 'Compiler folklore, paraphrasing Choi et al. 1999',
        },
        'The important word is prove. A compiler cannot remove an allocation because it looks small or short-lived. It must preserve every observable effect: reference equality, field mutation order, exceptions, synchronization, weak references, finalization, debugger state, and deoptimization recovery. The optimization is valuable because many real allocations are temporary, but it is safe only when the object boundary is invisible to the rest of the program.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious runtime approach is literal allocation: every object expression creates a heap object, and a generational garbage collector makes most short-lived objects cheap. Bump-pointer allocation in a young generation is close to pointer arithmetic, and batch collection makes many dead objects disappear together. This approach is simple, correct, and good enough for a large amount of application code.',
        'Teams reach for generational GC because it exploits the generational hypothesis -- most objects die young. For code that allocates moderately, the cost per object is low enough that nobody notices. The collector is a well-tested, general-purpose mechanism that handles every allocation pattern without per-site reasoning.',
        {
          type: 'note',
          text: 'This is not a bad approach. It is the right default. Escape analysis is for the small fraction of allocations where "cheap" is still too expensive because they sit inside a hot loop.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        '"Cheap" is not free. A loop that creates a pair object every iteration still writes an object header, initializes fields, may execute a write barrier, increases allocation rate, and pushes more bytes through the memory hierarchy. If the loop runs millions of times per second, the collector and allocator become part of the algorithm\'s cost. The program did not need heap reachability; it needed two numbers to survive until the next expression.',
        {
          type: 'table',
          headers: ['Operation', 'Stack/register', 'Heap (young gen)'],
          rows: [
            ['Allocate', 'Free (stack frame exists)', '~8-16 ns bump pointer + header write'],
            ['Access field', 'Register read or stack load', 'Pointer chase + possible cache miss'],
            ['Write barrier', 'None', 'Card mark or remembered-set update'],
            ['Deallocation', 'Free (frame pop)', 'GC pause (amortized but real)'],
            ['Memory overhead', '0 bytes header', '12-16 bytes header per object'],
            ['Cache pressure', 'Hot in L1', 'Scattered, competes with app data'],
          ],
        },
        'The wall gets sharper in JIT-compiled languages. Optimized code may inline several helpers and expose a chain of temporary allocations. A source program that looks object-oriented can lower to arithmetic on a few fields. If the compiler keeps the object boundaries after it has enough proof to remove them, it leaves performance on the table.',
        'The generational GC wall is also a throughput wall, not just a latency wall. Higher allocation rates mean more frequent young-gen collections, and each collection must scan roots, copy survivors, and update references. The collector scales with allocation rate, not with live-set size.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The compiler builds a connection graph (Choi et al. 1999) that tracks how object references flow through the program. Each allocation site is a node. Edges represent assignments, field stores, returns, and calls. The analysis classifies each reference into one of three escape states: NoEscape (local to the method and its inlined callees), ArgEscape (passed as an argument but not stored globally), and GlobalEscape (reachable from a global, returned, or passed to unknown code). Only NoEscape objects are candidates for scalar replacement.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Control_flow_graph.svg',
          alt: 'Control flow graph showing branches and merges between basic blocks',
          caption: 'Escape proofs are attached to compiler IR, where control-flow edges determine which uses can observe an allocation. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Control_flow_graph.svg',
        },
        {
          type: 'diagram',
          label: 'Connection graph and escape determination',
          text: [
            '  Point p = new Point(x, y);    // allocation site',
            '  double d = p.x * p.x + p.y * p.y;  // field reads',
            '  return d;                      // scalar return, p not returned',
            '',
            '  Connection graph:',
            '    [alloc: Point] --field--> [p.x]  (NoEscape)',
            '                  --field--> [p.y]  (NoEscape)',
            '    [p.x] --read--> [d computation]  (scalar use)',
            '    [p.y] --read--> [d computation]  (scalar use)',
            '    [return] --value--> [d]          (scalar, not p)',
            '',
            '  Verdict: p is NoEscape. All uses are field reads',
            '  feeding scalar arithmetic. Replace p with locals.',
          ].join('\n'),
        },
        'Once the graph proves NoEscape, scalar replacement decomposes the object. Each field becomes an independent SSA value. A read of obj.x becomes the current SSA value for x. A write to obj.x becomes a new SSA definition. If a field is never read, it is dead and disappears. If both fields feed arithmetic, downstream optimizations can fold constants, eliminate dead stores, or keep everything in registers.',
        {
          type: 'code',
          language: 'java',
          text: [
            '// BEFORE escape analysis (source code)',
            'double distance(double x1, double y1, double x2, double y2) {',
            '    Point p = new Point(x2 - x1, y2 - y1);  // heap alloc',
            '    return Math.sqrt(p.x * p.x + p.y * p.y);',
            '}',
            '',
            '// AFTER escape analysis + scalar replacement (compiler IR)',
            'double distance(double x1, double y1, double x2, double y2) {',
            '    double p_x = x2 - x1;   // scalar in register',
            '    double p_y = y2 - y1;   // scalar in register',
            '    return Math.sqrt(p_x * p_x + p_y * p_y);',
            '    // no allocation, no GC pressure, no object header',
            '}',
          ].join('\n'),
        },
        'Inlining is the key enabler. Before inlining, passing an object to helper(obj) looks like an escape. After inlining, the compiler sees that helper only reads obj.x and obj.y. The same source program moves from "must allocate" to "can scalar replace" when the optimizer gets more context. This is why escape analysis runs after inlining in every major JIT.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is observational equivalence. If every use of the object can be rewritten as a use of its fields, and no program operation can detect the missing identity, the optimized program has the same behavior as the source. Field reads see the same values. Field writes update the next scalar version. Dead fields remain unobserved. The object header, address, and allocation event were implementation details, not source-level facts.',
        'SSA form makes the rewrite tractable. Each field version has a clear definition and a set of uses. At control-flow joins, phi nodes represent which scalar value reaches the merge. If a field feeds arithmetic, arithmetic gets the scalar directly. The invariant: every path that would have reached a field load now reaches the scalar value that the field would contain on that path.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/9/94/Static_single_assignment_form.svg',
          alt: 'Static single assignment form graph with phi nodes at a merge',
          caption: 'SSA makes scalar replacement practical because each field version has explicit definitions and uses. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Static_single_assignment_form.svg',
        },
        'Partial escape analysis (Stadler et al., GraalVM) extends this to paths. An object may escape only on a rare branch -- say, an exception handler. A path-sensitive optimizer keeps the common path scalarized and sinks the allocation into the branch that actually publishes the object. The allocation happens only when observation becomes possible, and is absent everywhere else.',
        {
          type: 'note',
          text: 'In Go, escape analysis works at compile time rather than JIT time. The compiler decides per-allocation whether to place the object on the stack or the heap. The go build -gcflags="-m" flag prints escape decisions. Go does not do scalar replacement -- it does stack allocation of non-escaping objects, which avoids GC pressure without decomposing the struct.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The analysis itself costs compiler time and memory. A simple method-local analysis is cheap but misses objects that only become provably local after inlining. Interprocedural summaries (connection graph summaries per method) can extend reach, but summaries must be invalidated when callee code changes. A JIT has a budget: spending too long proving away one allocation can delay compilation enough that the program loses overall.',
        {
          type: 'table',
          headers: ['Analysis scope', 'Cost', 'What it catches', 'What it misses'],
          rows: [
            ['Method-local', 'O(n) in IR nodes', 'Purely local temps', 'Objects passed to helpers'],
            ['After inlining', 'O(n) but n is larger', 'Most temporary objects', 'Objects crossing uninlined boundaries'],
            ['Interprocedural summaries', 'O(n * m) methods', 'Cross-method temps', 'Dynamic dispatch, reflection'],
            ['Partial (Graal PEA)', 'O(n * paths) worst case', 'Path-conditional escapes', 'Complex merge points, deep aliasing'],
          ],
        },
        'The runtime payoff is concrete. Successful scalar replacement lowers allocation rate, reduces young-gen collection pressure, removes write barriers, exposes scalars to register allocation, and unlocks constant folding. The asymptotic algorithm is unchanged, but the constant factor inside a hot loop can decide whether the program is CPU-bound, memory-bound, or GC-bound.',
        'The hidden tax is recovery metadata. A deoptimizing JIT must know which eliminated objects exist logically and how to rebuild them from live scalars at each safepoint. More aggressive scalarization increases metadata size. In HotSpot, each safepoint records a "scope object" description mapping fields to register/stack locations so the interpreter can reconstruct the object on deopt.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Escape analysis wins on temporary tuples, small numeric objects (Point, Complex, Vec3), iterator result objects, autoboxed primitives, stream pipeline stages, and allocation-heavy hot loops. These are cases where source-level objects improve program structure but the machine only needs fields.',
        {
          type: 'bullets',
          items: [
            'JVM: HotSpot C2 compiler performs escape analysis after inlining. Objects proven NoEscape are scalar-replaced; ArgEscape objects may be stack-allocated. The -XX:+PrintEscapeAnalysis flag shows decisions.',
            'GraalVM: partial escape analysis (Stadler, Wurthinger, Mossenbock 2014) sinks allocation to the latest possible point, scalarizing the common path even when a rare branch escapes.',
            'Go: the compiler performs escape analysis at build time. Non-escaping values are stack-allocated. Use go build -gcflags="-m" to see decisions. No scalar replacement, but stack allocation avoids GC entirely.',
            'V8 (JavaScript): TurboFan had escape analysis but it was disabled in 2017 due to correctness issues. Maglev and Turboshaft are reconsidering the optimization with simpler, more robust implementations.',
          ],
        },
        'The best fit is stable hot code where profiling shows allocation pressure near the top of the cost. The object should have simple fields, limited aliasing, and calls that inline cleanly. Without those conditions, the optimizer may spend effort only to conclude that the object escapes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The optimization fails when identity matters. Reference equality, identity hash codes, synchronization monitors, weak references, finalizers, native interop (JNI), debugger inspection, and reflective access all make the object more than a bag of fields. If two references may alias the same object, replacing fields independently can break aliasing semantics unless the compiler proves the aliases are impossible.',
        'Unknown calls are the most common barrier. If a callee can store the reference, return it, compare it by identity, synchronize on it, or pass it elsewhere, the caller must allocate before the call. Inlining, type feedback, and method summaries reduce that uncertainty, but dynamic languages, virtual dispatch, and interface calls keep some boundaries opaque.',
        'Wrong proofs are not harmless performance bugs -- they are miscompiles. In a browser or VM running untrusted code, an escape-analysis bug can turn into a security vulnerability because optimized code may expose impossible states after deoptimization. This is why V8 disabled its escape analysis in 2017 rather than ship a subtle correctness risk, and why production compilers keep the analysis conservative.',
        {
          type: 'bullets',
          items: [
            'Objects stored into collections (List.add, Map.put) escape immediately.',
            'Objects passed to logging, serialization, or toString() may escape via reflection.',
            'Objects with finalizers must always be heap-allocated because the finalizer thread needs a real reference.',
            'Synchronized objects need a monitor, which requires a heap identity.',
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Choi et al., "Escape Analysis for Java" (OOPSLA 1999)', 'The foundational connection-graph algorithm for JVM escape analysis'],
            ['Stadler, Wurthinger, Mossenbock, "Partial Escape Analysis and Scalar Replacement for Java" (CGO 2014)', 'Path-sensitive escape analysis in Graal -- sinks allocation to the branch that escapes'],
            ['Kotzmann & Mossenbock, "Escape Analysis in the Context of Dynamic Compilation and Deoptimization" (VEE 2005)', 'How escape analysis interacts with JIT tiering and deopt recovery'],
            ['OpenJDK HotSpot escape analysis report: cr.openjdk.org/~cslucas/escape-analysis/EscapeAnalysis.html', 'Implementation-level walkthrough of C2 escape analysis'],
            ['V8 blog: "Disabling escape analysis" (2017)', 'Why V8 disabled escape analysis and the correctness risks involved'],
            ['Go specification and compiler docs: go build -gcflags="-m"', 'Stack vs heap decisions in a non-JIT, ahead-of-time compiled language'],
          ],
        },
        'Study SSA form and phi nodes next, because scalar replacement is easiest to understand when each field update becomes a new SSA definition. Then study alias analysis (proving two references do not point to the same object), inlining heuristics (what the compiler needs to see before it can prove no-escape), and deoptimization stack maps (how the runtime reconstructs eliminated objects at safepoints).',
        'For the broader picture, study generational garbage collection (the system escape analysis is optimizing against), JIT tiering (why the proof is done at one tier and recovery is needed at another), and speculative optimization (escape analysis is one instance of the general pattern: assume a property holds, optimize aggressively, deoptimize if the assumption breaks).',
      ],
    },
  ],
};
