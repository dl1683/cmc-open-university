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
  const graphNodes = ['opt', 'guard', 'safe', 'map', 'materialize', 'baseline', 'gc', 'resume'];
  const activeGuardPath = ['opt', 'guard', 'safe', 'map', 'e-opt-guard', 'e-guard-safe', 'e-guard-map'];
  yield {
    state: deoptGraph('Optimized code needs enough metadata to go backwards'),
    highlight: { active: activeGuardPath, compare: ['resume'] },
    explanation: `Optimized code across ${graphNodes.length} stages can assume a stable shape or type only if a failing guard at node "${graphNodes[1]}" can reconstruct a correct lower-tier state at "${graphNodes[graphNodes.length - 1]}".`,
  };
  const mapRows = [
    { id: 'pc', label: 'machine PC' },
    { id: 'x', label: 'value x' },
    { id: 'obj', label: 'object ref' },
    { id: 'env', label: 'environment' },
  ];
  const mapCols = [
    { id: 'location', label: 'location' },
    { id: 'needed', label: 'needed for' },
  ];
  yield {
    state: labelMatrix(
      'Stack map record',
      mapRows,
      mapCols,
      [
        ['safepoint id', 'resume site'],
        ['register R1', 'interpreter slot'],
        ['stack slot 3', 'GC root'],
        ['constant table', 'frame rebuild'],
      ],
    ),
    highlight: { active: ['x:location', 'obj:location', 'env:location'], found: ['pc:needed'] },
    explanation: `A stack map with ${mapRows.length} entries across ${mapCols.length} columns records where the runtime-required live values are at a machine-code address. It does not need every compiler value, only the values needed to resume or scan.`,
    invariant: `If any of the ${mapRows.length} map entries (${mapRows.map(r => r.label).join(', ')}) are wrong, deoptimization is wrong even when the optimized computation was correct.`,
  };
  const materializePath = ['map', 'materialize', 'baseline', 'e-map-materialize', 'e-materialize-baseline'];
  yield {
    state: deoptGraph('Materialization rebuilds a lower-tier frame'),
    highlight: { active: materializePath, compare: ['opt'] },
    explanation: `The runtime reads live values from registers, stack slots, and constants, then materializes the interpreter or baseline frame expected at the resume point — following ${materializePath.length} edges from "${materializePath[0]}" to "${materializePath[2]}".`,
  };
}

function* safepointResume() {
  const gcPath = ['safe', 'map', 'gc', 'e-map-materialize', 'e-materialize-gc'];
  yield {
    state: deoptGraph('Safepoints also serve precise garbage collection'),
    highlight: { active: gcPath, compare: ['baseline'] },
    explanation: `A safepoint is a place where the runtime can understand machine state. GC traverses ${gcPath.length} nodes from "${gcPath[0]}" to "${gcPath[2]}" to know which words are object references; deoptimization needs to know how to rebuild values.`,
  };
  const failureRows = [
    { id: 'map', label: 'stale map' },
    { id: 'value', label: 'missing value' },
    { id: 'pc', label: 'wrong PC' },
    { id: 'root', label: 'lost root' },
  ];
  const failureCols = [
    { id: 'symptom', label: 'symptom' },
    { id: 'guardrail', label: 'guardrail' },
  ];
  yield {
    state: labelMatrix(
      'Failure cases',
      failureRows,
      failureCols,
      [
        ['wrong resume', 'version check'],
        ['bad frame', 'liveness audit'],
        ['crash', 'safepoint table'],
        ['GC bug', 'root verifier'],
      ],
    ),
    highlight: { active: ['value:guardrail', 'pc:guardrail', 'root:guardrail'], compare: ['map:symptom'] },
    explanation: `Deoptimization metadata is correctness-critical across all ${failureRows.length} failure modes (${failureRows.map(r => r.label).join(', ')}). Engines need ${failureCols.length} dimensions of defense: ${failureCols.map(c => c.label).join(' and ')}.`,
  };
  const tieringNodes = ['guard', 'safe', 'map', 'materialize', 'resume'];
  yield {
    state: deoptGraph('Tiering works because escape metadata exists'),
    highlight: { active: tieringNodes, found: ['baseline'], compare: ['opt'] },
    explanation: `JIT Tiering & Hotness Counters can promote aggressively only because deoptimization gives optimized code a precise exit path through ${tieringNodes.length} stages from "${tieringNodes[0]}" to "${tieringNodes[tieringNodes.length - 1]}".`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views that show the same eight-node graph from different angles. In the deopt metadata view, follow the path from optimized code (opt) through a guard check, into the safepoint and stack-map nodes, through frame materialization, and out to the baseline tier and resume node. Active nodes (highlighted) show the current phase; found nodes show completed phases. The stack-map matrix shows four entries (machine PC, value x, object ref, environment) and their physical locations, which is the core data structure the runtime consults during bailout.',
        {type: 'image', src: './assets/gifs/deoptimization-stack-maps-safepoints.gif', alt: 'Animated walkthrough of the deoptimization stack maps safepoints visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'In the safepoint resume view, the same graph shows GC and deoptimization as two consumers of safepoint precision. The failure-cases matrix lists four things that can go wrong (stale map, missing value, wrong PC, lost root) and the guardrails that catch them. Watch how both the GC path and the baseline-resume path converge on the same materialization node, because both need the same map from machine state to logical state.',
        'The compare highlight (dimmed nodes) marks the optimized-code node after a bailout, showing that the fast path has been abandoned. The found highlight marks the destination tier where execution will resume.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A JavaScript function that adds two numbers could run as interpreter bytecode, baseline machine code, or aggressively optimized machine code. The optimized version might be 50 times faster because it skips type checks, inlines callees, and keeps values in registers instead of heap objects. But the optimizer made assumptions to get that speed: both arguments are 31-bit integers (Smis in V8), the callee is always the same function, the object has the same hidden class it had during warmup.',
        {type: 'callout', text: 'Speculative optimized code is only safe when every exit point carries enough metadata to rebuild the lower-tier state.'},
        'If any assumption breaks at runtime, the optimized code must stop and hand control back to a slower tier that makes no assumptions. That handoff is deoptimization. The problem is that optimized code has destroyed the state the slower tier expects. Register allocation moved local variables into CPU registers. Inlining erased call frames. Escape analysis replaced a heap object with three scalar values in registers. The interpreter expects a frame with named locals on a virtual stack, objects on the heap, and a bytecode program counter. The optimized code has none of those things.',
        'Deoptimization metadata, stack maps, and safepoints exist to bridge that gap. They are side tables emitted by the optimizing compiler that record, at specific machine-code addresses, where every value the lower tier needs is physically stored. Without this metadata, speculative optimization would be a one-way trip: fast when assumptions hold, broken when they do not.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest way to avoid deoptimization is to never speculate. Compile code that handles every possible type, every possible call target, and every possible object shape. This is what a baseline JIT like V8\'s Sparkplug does: it translates bytecode to machine code one-to-one, using generic operations that check types at runtime. The result is correct for all inputs but 5 to 50 times slower than specialized code because every operation carries runtime type checks, heap allocations, and indirect calls.',
        'The opposite extreme is to speculate freely and simply crash or restart when an assumption fails. Early JIT compilers in some Smalltalk and Self implementations did something close to this: they invalidated and recompiled entire methods. That works but wastes compilation time, loses performance on code that is mostly stable with rare exceptions, and cannot handle the case where speculation fails mid-execution with live values on the stack that need to survive.',
        'A third approach is to keep all interpreter state in memory at all times, even inside optimized code, so bailout is trivial. This is correct but defeats the purpose of optimization. If every local variable stays on the heap and every frame boundary is preserved, the optimizer cannot inline, cannot scalar-replace, and cannot register-allocate effectively. The code runs nearly as slowly as the interpreter.',
        'Each approach sacrifices something fundamental: speed (no speculation), reliability (crash on failure), or optimization power (preserve everything). The real solution must speculate aggressively while retaining the ability to reconstruct the conservative state precisely when needed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that optimized machine code and interpreter state are structurally different, and the difference grows with every optimization the compiler applies. Consider a concrete example. The interpreter for the function f(a, b) { return a.x + b.y } maintains a stack frame with slots for a and b as heap objects, a bytecode PC pointing at the current instruction, and intermediate values pushed to a virtual stack.',
        {type: 'image', src: 'https://v8.dev/_img/turbofan-jit/example-graph.png', alt: 'TurboFan intermediate representation graph with control value and effect edges', caption: 'Optimizing compilers can reshape code into graph IR; deoptimization metadata is the map back from that optimized shape to runtime state. Source: https://v8.dev/_img/turbofan-jit/example-graph.png'},
        'The optimizing compiler transforms this into: check a\'s hidden class, load a.x from a known offset (now in register R3), check b\'s hidden class, load b.y from a known offset (now in register R7), add R3 and R7 into R0, return R0. If the caller was inlined, there is no physical call frame at all. If escape analysis proved that a was allocated locally and never leaked, the object might not exist on the heap; its fields are in registers.',
        'When the hidden-class check for b fails, the runtime must produce an interpreter frame where a is a heap object in slot 0, b is a heap object in slot 1, the bytecode PC points to the instruction that loads b.y, and the virtual stack contains the intermediate result a.x. None of these things exist in the machine state. The register file contains raw integers that were fields of possibly-eliminated objects, and the call stack has no frame for the inlined caller.',
        'Garbage collection hits the same wall independently. If the GC runs while optimized code is executing, it must know which registers and stack slots contain object references so it can update them if objects move. A conservative GC can scan everything and treat anything that looks like a pointer as a root, but that retains garbage, prevents object movement, and cannot handle compressed or tagged pointer schemes where some bit patterns are integers, not pointers.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The compiler is allowed to destroy interpreter state as long as it records a recipe for reconstructing it. That recipe is the stack map: a side table, indexed by machine-code address, that lists every value the lower tier needs and where that value physically lives (register, stack slot, constant pool, or "must be materialized from these components").',
        'A safepoint is a machine-code address where the compiler guarantees the recipe is valid. At a safepoint, the runtime can pause execution, read the stack map, and reconstruct the full interpreter state or scan all object references. Between safepoints, the state may be temporarily inconsistent: a register might hold a half-computed value or an object reference might be in a register the GC does not know about. That is fine because the runtime only inspects state at safepoints.',
        'The insight is a contract between three parties. The optimizer promises to emit a valid stack map at every safepoint. The deoptimizer promises to reconstruct the correct lower-tier state from the map. The GC promises to scan only at safepoints and to trust the map\'s classification of references vs. non-references. As long as all three honor the contract, the optimizer can apply any transformation it wants between safepoints.',
        'This contract is what makes tiered compilation practical. The interpreter tier collects type feedback. The baseline tier compiles without speculation. The optimizing tier speculates based on feedback and emits guards. Every guard is a potential deoptimization point, and every deoptimization point is a safepoint with a stack map. The entire tower of tiers works because the metadata at each exit point is a lossless bridge back to the tier below.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During optimizing compilation, the compiler tracks liveness: which source-level values are needed at each point in the program. At each safepoint (guard checks, call sites, loop back-edges, allocation sites), the compiler emits a stack-map entry. Each entry contains: the machine-code PC, a deoptimization ID that names the corresponding interpreter bytecode position and frame shape, and for each live value, its physical location (register name, stack offset, constant-pool index, or a materialization descriptor for eliminated allocations).',
        {type: 'image', src: 'https://v8.dev/_img/maglev/graph.svg', alt: 'Maglev SSA graph printed on the command line', caption: 'SSA values need concrete recovery locations before optimized code can safely bail out. Source: https://v8.dev/_img/maglev/graph.svg'},
        'When a guard fails, the runtime executes a deoptimization stub. The stub reads the current machine PC from the return address, looks up the stack-map entry for that PC, and iterates through the live-value list. For each value, it reads the data from the recorded location and writes it into the interpreter frame being constructed. If an inlined callee was removed, the deoptimizer reconstructs multiple interpreter frames from one machine frame. If an object was scalar-replaced, the deoptimizer allocates a new heap object and fills its fields from the recorded register or stack locations.',
        'After reconstruction, the runtime invalidates or patches the optimized code (so it is not re-entered with the same failing assumption), sets the interpreter PC to the resume bytecode, and transfers control to the interpreter. From the language\'s perspective, nothing happened: the program continues with correct semantics as if optimization had never occurred.',
        'For garbage collection, the same safepoint mechanism serves a different consumer. The GC suspends all threads at their nearest safepoint (this is the "stop the world" pause or a cooperative yield point). At each thread\'s safepoint, the GC reads the stack map to identify which registers and stack slots contain object references. It traces from those roots, moves objects if compacting, and updates the references in-place. Non-reference values (raw integers, floating-point numbers, unboxed booleans) are left untouched.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on a single invariant: at every safepoint, the stack map is a faithful description of the machine state. "Faithful" means two properties hold simultaneously. First, every value the lower tier needs is accounted for in the map, and the map says where it is. Second, the classification of each word (object reference, integer, float, materialization input) is correct.',
        'The invariant is preserved by construction. The compiler\'s register allocator, which decides where values live, also updates the stack-map entries. When the allocator spills a value from register R3 to stack slot 7, it updates all stack maps that include that value. When escape analysis eliminates an allocation, it replaces the "value is at heap address X" entry with a materialization descriptor: "value is an object of class C with field a in R5 and field b at stack slot 12." The map never goes stale because the same compiler pass that transforms the code also transforms the map.',
        'The invariant can break if the compiler has a bug. If register allocation moves a value but fails to update the map, the deoptimizer reads the wrong location and reconstructs a corrupt frame. If inlining merges two frames but the map still describes one, the deoptimizer builds the wrong number of interpreter frames. These bugs are among the hardest to diagnose in a JIT compiler because the optimized code runs correctly (it computed the right answer), but the bailout path produces the wrong state.',
        'The GC correctness argument is analogous. If the map says stack slot 3 is an integer but it actually holds a pointer, the GC will not trace through it, and the pointed-to object may be collected while still in use. If the map says register R7 is a pointer but it holds a raw integer, the GC may try to dereference a non-pointer and crash. Both failures are silent until the program touches the affected object or memory.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The fast-path cost is low: a guard check is typically a single compare-and-branch instruction (e.g., "compare the hidden-class tag in the object header against the expected value; if not equal, jump to the deopt stub"). On a modern out-of-order CPU, a correctly predicted branch costs effectively zero cycles. Guards that almost always pass are almost free.',
        {type: 'image', src: 'https://v8.dev/_img/maglev/compile-time.svg', alt: 'Compile time comparison across V8 compilation tiers', caption: 'Tiered runtimes balance compile cost against optimized execution time, and deoptimization is the escape hatch that makes early promotion tolerable. Source: https://v8.dev/_img/maglev/compile-time.svg'},
        'The metadata cost is proportional to the number of safepoints times the average number of live values per safepoint. In V8\'s TurboFan, a typical optimized function might have 20 to 100 safepoints, each with 5 to 20 live-value entries. At roughly 4 bytes per entry (location encoding), that is 400 to 8,000 bytes of metadata per function. For a large application with thousands of optimized functions, metadata can reach several megabytes. V8 compresses stack maps with run-length and delta encoding to reduce this.',
        'The bailout cost is expensive. A single deoptimization involves: looking up the stack map, reading 5 to 20 values from various locations, allocating interpreter frame(s), possibly allocating materialized objects on the heap, patching or invalidating the optimized code, and jumping to the interpreter. This costs microseconds, not nanoseconds. If it happens once per million calls, it is invisible. If it happens on every call (a megamorphic call site that was speculatively optimized), the program spends more time bailing out and recompiling than it would have spent in the interpreter.',
        'Safepoint density is a design tradeoff. V8 places safepoints at call sites (mandatory, because the callee may trigger GC), loop back-edges (so long loops can be interrupted for GC), and guard-failure branches. Each safepoint constrains the optimizer: it cannot move a value past a safepoint unless it updates the map. More safepoints mean more metadata and more constraints. Fewer safepoints mean longer GC pauses (the mutator cannot be stopped until it reaches a safepoint) and fewer places where deoptimization can occur.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'V8 (Chrome, Node.js) has three compilation tiers: Ignition (interpreter), Sparkplug (baseline JIT), Maglev (mid-tier optimizing JIT), and TurboFan (top-tier optimizing JIT). Maglev and TurboFan both emit stack maps and deoptimization metadata. V8\'s deoptimizer can reconstruct Ignition frames from TurboFan code that has inlined multiple functions, scalar-replaced allocations, and hoisted bounds checks. The deoptimizer is also used for "lazy deoptimization," where feedback invalidation marks optimized code for bailout at its next safepoint rather than immediately.',
        'HotSpot (the JVM) uses the same architecture. The C2 optimizing compiler emits "oop maps" (object pointer maps) at safepoints for GC, and "scope descriptors" for deoptimization. When an uncommon trap fires, HotSpot reconstructs interpreter frames and resumes in the template interpreter. HotSpot also supports on-stack replacement (OSR), which is deoptimization\'s inverse: replacing an executing interpreter frame with optimized code mid-loop.',
        'LLVM provides a generic stack-map mechanism through its stackmap and patchpoint intrinsics, documented at llvm.org/docs/StackMaps.html. Language runtimes built on LLVM (some Ruby JITs, Julia, Rust\'s Cranelift-based compilers) use these intrinsics to emit safepoint metadata. The LLVM mechanism is lower-level than V8\'s or HotSpot\'s: it records register/stack locations but leaves frame reconstruction to the language runtime.',
        'GraalVM\'s Graal compiler emits deoptimization metadata for Java, JavaScript, Ruby, Python, and other languages running on the Truffle framework. Graal supports "partial escape analysis," which delays object allocation until a branch where the object actually escapes, and the deoptimization metadata must handle the case where the object was never allocated because the non-escaping branch was taken.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Deoptimization fails when the assumption that breaks is the common case, not the exception. A JavaScript function called with 50 different object shapes will deoptimize on nearly every call if the JIT optimizes for one shape. The engine enters a deoptimization loop: optimize, bail out, recompile with updated feedback, bail out again. V8 mitigates this by tracking deoptimization counts per function and eventually refusing to re-optimize, falling back to the interpreter or baseline tier permanently.',
        'Code-size cost can be prohibitive for embedded or AOT-compiled systems. A stack map for every safepoint in every function adds metadata proportional to the total code size. In V8, stack-map data is roughly 10-30% of the optimized code size. For a system with tight memory constraints (IoT devices, WebAssembly modules with strict size budgets), the metadata overhead may outweigh the performance benefit of aggressive optimization.',
        'Debugging is harder in the presence of deoptimization. A developer stepping through code in a debugger may trigger deoptimization because the debugger needs to inspect a value that the optimizer eliminated. V8 handles this with "soft deopts" that reconstruct state for inspection without permanently abandoning optimized code, but this adds complexity. Profiling is also affected: a function that deoptimizes frequently may appear slow in profiles not because its logic is slow but because it spends time in the deoptimizer.',
        'Correctness bugs in deoptimization metadata are among the hardest to find and fix in a JIT compiler. The optimized code runs correctly (it produces the right result on the fast path), so the bug only manifests when a guard fails and the deoptimizer reads a stale or incorrect map. These bugs are intermittent, depend on specific type-feedback histories, and produce symptoms (wrong values, crashes, GC corruption) far from the root cause. V8, HotSpot, and Graal all maintain dedicated stress-testing modes that force deoptimization at every safepoint to flush out metadata bugs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a JavaScript function: function add(a, b) { return a.x + b.x; }. During warmup, add is called 1,000 times with objects of shape {x: <int>}. The interpreter collects type feedback: a and b always have hidden class H1, and x is always a 31-bit Smi. TurboFan compiles an optimized version: guard a\'s map == H1, load a.x from offset 16 into R3, guard b\'s map == H1, load b.x from offset 16 into R5, add R3 + R5 into R0, return R0. Total: 6 instructions, no heap allocation, no generic type dispatch.',
        'At the first guard (check a\'s map), TurboFan emits a stack-map entry: PC = 0x7f0040, deopt_id = 4 (maps to bytecode offset 0, before the a.x load), live values: { a -> R1, b -> stack slot 2, feedback_vector -> R9 }. At the second guard (check b\'s map), another entry: PC = 0x7f0050, deopt_id = 7 (bytecode offset 3, after a.x is loaded but before b.x), live values: { a -> R1, b -> stack slot 2, a.x -> R3, feedback_vector -> R9 }. Notice that the second map has one more live value (a.x in R3) because the interpreter frame at bytecode offset 3 has a.x on its virtual stack.',
        'Now call add({x: 1}, {y: 2}). The first guard passes (a has map H1). The second guard fails (b does not have map H1). The deopt stub fires at PC 0x7f0050. The deoptimizer looks up deopt_id 7, reads a from R1, b from stack slot 2, and a.x from R3, allocates an interpreter frame with bytecode offset 3, pushes a.x onto the virtual stack, sets the interpreter PC to the instruction that would load b.x, and transfers control to the interpreter. The interpreter then handles the generic property load of b.x using the full dynamic lookup path, which is slower but correct for any object shape.',
        'The total cost of this deoptimization: roughly 2 microseconds (map lookup, value reads, frame allocation, interpreter setup). If add is called 10 million times and deoptimizes once, the amortized cost is 0.2 nanoseconds per call, which is negligible. If add deoptimizes on 10% of calls, the cost is 200 nanoseconds per call from deoptimization alone, plus recompilation overhead. That is why V8 tracks deoptimization frequency and stops re-optimizing functions that bail out too often.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LLVM Stack Maps and Patch Points documentation at https://llvm.org/docs/StackMaps.html, the V8 blog post on Sparkplug (baseline compiler) at https://v8.dev/blog/sparkplug, the V8 blog post on Maglev (mid-tier JIT) at https://v8.dev/blog/maglev, V8 Ignition interpreter documentation at https://v8.dev/docs/ignition, and the V8 design docs index at https://v8.dev/docs. For HotSpot\'s approach, see the OpenJDK HotSpot glossary and the "Deoptimization in HotSpot" section of the Oracle JVM specification.',
        'For the type-feedback system that drives speculation, study V8 Hidden Classes & Inline Caches. For the compilation tiers that produce and consume deoptimization metadata, study JIT Tiering & Hotness Counters and V8 Ignition Bytecode Pipeline Case Study. For the optimization that creates the most complex materialization descriptors, study Escape Analysis & Scalar Replacement. For the GC side of safepoints, study V8 Generational Garbage Collection and precise root scanning.',
        'The academic foundation is Holzle, Chambers, and Ungar\'s 1992 paper "Debugging Optimized Code with Dynamic Deoptimization" (PLDI 1992), which introduced deoptimization in the Self language. The idea that safepoints serve both GC and deoptimization was formalized in the HotSpot C2 compiler and has since become standard in all major JIT runtimes.',
      ],
    },
  ],
};
