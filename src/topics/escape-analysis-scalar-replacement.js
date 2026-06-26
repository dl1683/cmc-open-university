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
    explanation: `The optimizer builds a use graph with ${8} nodes and ${8} edges for an allocation. If the object never leaks to unknown code, a global store, or a returned value, it may be removable.`,
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
    explanation: `Scalar replacement decomposes an object into field values. The ${4}-row decision matrix shows when each use pattern permits this — instead of allocating {x,y}, the optimizer keeps x and y as separate SSA values or registers.`,
    invariant: `Allocation removal is legal only if every observable object identity effect is preserved across all ${4} use categories.`,
  };
  yield {
    state: escapeGraph('Scalar replacement removes allocation pressure'),
    highlight: { active: ['graph', 'scalar', 'code', 'e-graph-scalar', 'e-scalar-code'], compare: ['escape'] },
    explanation: `When the proof succeeds across ${8} graph nodes, the optimized code can compute with scalars directly, reducing allocation rate and garbage-collection pressure.`,
  };
}

function* deoptRecovery() {
  yield {
    state: escapeGraph('JITs may need to recreate removed objects at deopt'),
    highlight: { active: ['code', 'deopt', 'e-code-deopt'], found: ['scalar'], compare: ['alloc'] },
    explanation: `If optimized code deoptimizes, the runtime may need to rematerialize an object that was scalar-replaced. The path from code to deopt through ${8} pipeline nodes shows how lower-tier code must see a valid object state.`,
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
    explanation: `The deopt metadata maps ${4} fields back to their scalar sources, knowing how to rebuild the logical object from the scalar values still live at the safepoint.`,
  };
  yield {
    state: escapeGraph('Inlining often unlocks the proof'),
    highlight: { active: ['inline', 'graph', 'scalar', 'e-inline-graph', 'e-graph-scalar'], compare: ['escape'] },
    explanation: `A call can look like an escape until inlining reveals that the callee only reads fields. With ${8} edges in the connection graph, escape analysis, inlining, and deoptimization metadata are tightly coupled in JITs.`,
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
        'The visualization has two views. "No escape object" walks through the compiler\'s decision process: build a use graph for an allocation, test each edge for escape, and replace the whole object with scalar fields when nothing leaks identity. "Deopt recovery" shows the second half of the story: when optimized code falls back to the interpreter, the runtime must rebuild the eliminated object from live scalar values.',
        {
          type: 'callout',
          text: 'Scalar replacement is legal only when the object identity is unobservable and every field use can be represented by scalars.',
        },
        'Active (highlighted) nodes mark the current analysis step. Compared nodes (dimmed) show paths that would force a heap allocation if the compiler reached them. Found nodes mark facts the analysis has established so far. The decision matrix maps four use categories -- local fields, return, global store, unknown call -- to their escape ruling and the action the compiler takes.',
        {
          type: 'note',
          text: 'Watch the edge between "graph" and "escape" carefully. That single edge is the legal boundary between a field bundle the compiler can dissolve and a real heap object it must preserve.',
        },
        {type: 'image', src: './assets/gifs/escape-analysis-scalar-replacement.gif', alt: 'Animated walkthrough of the escape analysis scalar replacement visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Objects are how programmers bundle related values. A point carries x and y. An iterator holds cursor state. A helper returns two results as a pair. These abstractions make source code clearer, but in a hot loop each one costs a heap header, field initialization, possible write barriers, and garbage-collection pressure for data that never needed an independent heap identity.',
        'Escape analysis exists because a compiler can sometimes prove that an allocation is only a temporary carrier of fields -- no code outside the local scope can observe the object as an object. Scalar replacement is the follow-up transformation: decompose the aggregate into its individual fields and keep those fields as SSA values, registers, or stack slots instead of heap memory.',
        {
          type: 'quote',
          text: 'An object that does not escape is not an object. It is a naming convention over scalars.',
          attribution: 'Compiler folklore, paraphrasing Choi et al. 1999',
        },
        'The key word is prove. The compiler cannot remove an allocation because it looks small or short-lived. It must preserve every observable effect: reference equality, field mutation order, exceptions, synchronization, weak references, finalization, debugger state, and deoptimization recovery. The optimization pays off because many real allocations are temporary, but it is safe only when the object boundary is invisible to the rest of the program.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious runtime strategy is literal allocation: every object expression creates a heap object, and a generational garbage collector makes most short-lived objects cheap. Bump-pointer allocation in a young generation is close to pointer arithmetic -- advance a pointer by the object size, write a header, zero the fields. Batch collection reclaims many dead objects together. This is simple, correct, and good enough for most application code.',
        'Generational GC exploits the generational hypothesis: most objects die young. A young-generation collection touches only the small nursery, not the full heap. For programs that allocate moderately, the per-object cost is low enough that nobody notices. The collector is a well-tested, general-purpose mechanism that works for every allocation pattern without per-site reasoning from the compiler.',
        {
          type: 'note',
          text: 'This is not a bad approach. It is the right default. Escape analysis is for the small fraction of allocations where "cheap" is still too expensive because they sit inside a hot loop.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        '"Cheap" is not free. A loop that creates a point object every iteration still writes an object header (12-16 bytes on the JVM), initializes two fields, may execute a write barrier, and pushes more bytes through the memory hierarchy. If the loop runs ten million times per second, the collector and allocator become part of the algorithm\'s cost. The program did not need heap reachability; it needed two doubles to survive until the next expression.',
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
        'The wall gets sharper in JIT-compiled languages. Optimized code may inline several helpers and expose a chain of temporary allocations that exist only to pass fields between inlined methods. A source program that looks object-oriented can lower to arithmetic on a handful of scalars -- if the compiler recognizes that the object boundaries are already gone.',
        'This is also a throughput wall, not just a latency wall. Higher allocation rates mean more frequent young-gen collections. Each collection must scan roots, copy survivors, and update references. The collector scales with allocation rate, not with live-set size, so a tight inner loop that allocates can dominate total GC cost even if every object dies immediately.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'An object is two things: a bag of fields and an identity. Most temporary objects are used only as bags of fields -- the program reads their data but never tests their identity, synchronizes on them, or publishes them to other threads. If the compiler can prove that no operation observes the object\'s identity, the object is indistinguishable from a set of independent local variables that happen to have related names.',
        'The insight is that proving non-escape lets the compiler erase the object boundary entirely. Instead of allocating a Point(3, 4) on the heap and reading p.x and p.y through pointer dereferences, the compiler keeps 3 and 4 in registers and feeds them directly to arithmetic. The allocation, the header, the indirection, the write barrier, and the GC interaction all disappear -- not by making them faster, but by proving they were unnecessary.',
        'This is a phase transition, not a speedup. Below the proof threshold the compiler must allocate conservatively. Above it, the object ceases to exist in the generated code. There is no middle ground: either identity is unobservable and the object can be dissolved, or some path might observe it and the allocation must remain.',
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
        'Once the graph proves NoEscape, scalar replacement decomposes the object. Each field becomes an independent SSA value. A read of obj.x becomes the current SSA definition for x. A write to obj.x creates a new SSA definition. If a field is never read after a write, that write is dead and disappears. If both fields feed arithmetic, downstream passes can fold constants, eliminate redundant stores, or keep everything in registers.',
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
        'Inlining is the key enabler. Before inlining, passing an object to helper(obj) looks like an escape -- the compiler cannot see what helper does with the reference. After inlining, the compiler sees that helper only reads obj.x and obj.y. The same source program moves from "must allocate" to "can scalar replace" when the optimizer gets more context. This is why escape analysis runs after inlining in every major JIT.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on observational equivalence. If every use of the object can be rewritten as a use of its fields, and no program operation can detect the missing identity, the optimized program has the same behavior as the source. Field reads see the same values. Field writes update the next scalar version. Dead fields remain unobserved. The object header, address, and allocation event were implementation details, not source-level facts.',
        'SSA form makes the rewrite tractable. Each field version has exactly one definition point and a known set of uses. At control-flow joins, phi nodes select which scalar value reaches the merge based on which branch executed. If a field feeds arithmetic, the arithmetic receives the scalar directly without indirection. The invariant is precise: every path that would have reached a field load in the original code now reaches the scalar value that the field would have contained on that path.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/9/94/Static_single_assignment_form.svg',
          alt: 'Static single assignment form graph with phi nodes at a merge',
          caption: 'SSA makes scalar replacement practical because each field version has explicit definitions and uses. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Static_single_assignment_form.svg',
        },
        'Partial escape analysis (Stadler et al., GraalVM) extends this to individual paths. An object may escape only on a rare branch -- say, an exception handler that logs the object. A path-sensitive optimizer keeps the common path scalarized and sinks the allocation into the branch that actually publishes the object. The allocation happens only when observation becomes possible, and is absent on every other path.',
        {
          type: 'note',
          text: 'In Go, escape analysis works at compile time rather than JIT time. The compiler decides per-allocation whether to place the object on the stack or the heap. The go build -gcflags="-m" flag prints escape decisions. Go does not do scalar replacement -- it does stack allocation of non-escaping objects, which avoids GC pressure without decomposing the struct.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The analysis itself costs compiler time and memory. A simple method-local analysis is cheap -- linear in the number of IR nodes -- but misses objects that only become provably local after inlining. Interprocedural summaries (a connection-graph summary per method) can extend reach across call boundaries, but those summaries must be invalidated when callee code changes. A JIT has a compilation budget: spending too long proving away one allocation can delay code emission enough that the program loses overall throughput.',
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
        'The runtime payoff is concrete. Successful scalar replacement lowers allocation rate, reduces young-gen collection frequency, removes write barriers on the eliminated object, exposes field values to register allocation, and unlocks constant folding. The asymptotic algorithm is unchanged, but the constant factor inside a hot loop can decide whether the program is CPU-bound, memory-bound, or GC-bound.',
        'The hidden tax is recovery metadata. A deoptimizing JIT must know which eliminated objects exist logically at each safepoint and how to rebuild them from live scalars. More aggressive scalarization increases metadata size. In HotSpot, each safepoint records a "scope object" description that maps each field to a register or stack slot, so the interpreter can reconstruct the object when deopt occurs.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Escape analysis earns its keep on temporary tuples, small numeric objects (Point, Complex, Vec3), iterator result objects, autoboxed primitives, stream pipeline stages, and allocation-heavy inner loops. These are cases where source-level objects improve program structure but the machine only needs the field values.',
        {
          type: 'bullets',
          items: [
            'JVM: HotSpot C2 compiler performs escape analysis after inlining. Objects proven NoEscape are scalar-replaced; ArgEscape objects may be stack-allocated. The -XX:+PrintEscapeAnalysis flag shows decisions.',
            'GraalVM: partial escape analysis (Stadler, Wurthinger, Mossenbock 2014) sinks allocation to the latest possible point, scalarizing the common path even when a rare branch escapes.',
            'Go: the compiler performs escape analysis at build time. Non-escaping values are stack-allocated. Use go build -gcflags="-m" to see decisions. No scalar replacement, but stack allocation avoids GC entirely.',
            'V8 (JavaScript): TurboFan had escape analysis but it was disabled in 2017 due to correctness issues. Maglev and Turboshaft are reconsidering the optimization with simpler, more robust implementations.',
          ],
        },
        'The best fit is stable hot code where profiling shows allocation pressure near the top of the cost profile. The object should have simple fields, limited aliasing, and calls that inline cleanly. Without those conditions, the optimizer may spend compilation effort only to conclude that the object escapes and must be allocated anyway.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The optimization fails when identity matters. Reference equality (a == b), identity hash codes, synchronization monitors, weak references, finalizers, native interop (JNI), debugger inspection, and reflective access all make the object more than a bag of fields. If two references may alias the same object, replacing fields independently can break aliasing semantics unless the compiler also proves the aliases are impossible.',
        'Unknown calls are the most common barrier. If a callee can store the reference, return it, compare it by identity, synchronize on it, or pass it elsewhere, the caller must allocate before the call. Inlining, type feedback, and method summaries reduce that uncertainty, but dynamic languages, virtual dispatch, and interface calls keep some call boundaries permanently opaque.',
        'Wrong proofs are not harmless performance bugs -- they are miscompiles. In a browser or VM running untrusted code, an escape-analysis bug can expose impossible states after deoptimization, turning a performance optimization into a security vulnerability. V8 disabled its escape analysis in 2017 rather than ship a subtle correctness risk. Production compilers keep the analysis conservative for exactly this reason.',
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
      heading: 'Worked example',
      paragraphs: [
        'Consider a hot method that computes the Manhattan distance between two 2D points, called millions of times in a tight loop. The source allocates a temporary Point to hold the delta.',
        'Step 1: the JIT inlines the call to Point(dx, dy), exposing the constructor body. The IR now shows an allocation node feeding two field-store nodes (p.x = dx, p.y = dy), two field-load nodes (read p.x, read p.y), and arithmetic that adds the absolute values. No other node touches p.',
        'Step 2: the escape analyzer builds the connection graph. The allocation node has edges to two field-store nodes and two field-load nodes. No edge reaches a return, a global store, or an uninlined call. Every edge stays within the method. Verdict: NoEscape.',
        'Step 3: scalar replacement fires. The optimizer removes the allocation node and the field-store/load pairs. It introduces two scalar SSA values: p_x = dx and p_y = dy. The downstream arithmetic now reads p_x and p_y directly from registers.',
        'Step 4: standard optimizations clean up. Dead-code elimination removes the allocation, the header write, and the write barrier. Register allocation keeps p_x and p_y in machine registers. The generated machine code is: subtract, absolute value, subtract, absolute value, add, return. No memory traffic, no GC interaction.',
        'Step 5: deopt metadata. The JIT records that at each safepoint inside this method, if deopt occurs, the runtime must reconstruct a Point object with x = register R1 and y = register R2. This metadata costs a few bytes per safepoint but is never used unless the code deoptimizes.',
        'Net result: the loop runs with zero allocation rate instead of ten million Point objects per second. Young-gen GC pauses drop proportionally. The improvement is not algorithmic -- the program does the same arithmetic -- but the constant factor shrinks because the object abstraction has been compiled away.',
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
        'Study SSA form and phi nodes next -- scalar replacement is easiest to understand when each field update becomes a new SSA definition. Then study alias analysis (proving two references do not point to the same object), inlining heuristics (what the compiler needs to see before it can prove no-escape), and deoptimization stack maps (how the runtime reconstructs eliminated objects at safepoints).',
        'For the broader picture, study generational garbage collection (the system escape analysis optimizes against), JIT tiering (why the proof is done at one tier and recovery is needed at another), and speculative optimization (escape analysis is one instance of a general pattern: assume a property holds, optimize aggressively, deoptimize if the assumption breaks).',
      ],
    },
  ],
};
