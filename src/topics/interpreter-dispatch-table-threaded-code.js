// Interpreter dispatch: map bytecodes to handlers and repeatedly jump to the
// next handler, with switch dispatch, tables, and threaded-code variants.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'interpreter-dispatch-table-threaded-code',
  title: 'Interpreter Dispatch Table & Threaded Code',
  category: 'Concepts',
  summary: 'The inner loop of an interpreter: decode bytecodes, jump through handler tables, update state, and minimize dispatch overhead.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['dispatch loop', 'handler table'], defaultValue: 'dispatch loop' },
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

function dispatchGraph(title) {
  return graphState({
    nodes: [
      { id: 'ip', label: 'IP', x: 0.9, y: 3.8, note: 'byte index' },
      { id: 'decode', label: 'dec', x: 2.5, y: 3.8, note: 'opcode' },
      { id: 'table', label: 'table', x: 4.1, y: 2.3, note: 'handlers' },
      { id: 'switch', label: 'case', x: 4.1, y: 5.3, note: 'switch' },
      { id: 'handler', label: 'exec', x: 6.1, y: 3.8, note: 'handler' },
      { id: 'state', label: 'state', x: 7.8, y: 2.3, note: 'stack/regs' },
      { id: 'next', label: 'next', x: 7.8, y: 5.3, note: 'advance IP' },
      { id: 'done', label: 'done', x: 9.1, y: 3.8, note: 'return' },
    ],
    edges: [
      { id: 'e-ip-decode', from: 'ip', to: 'decode' },
      { id: 'e-decode-table', from: 'decode', to: 'table' },
      { id: 'e-decode-switch', from: 'decode', to: 'switch' },
      { id: 'e-table-handler', from: 'table', to: 'handler' },
      { id: 'e-switch-handler', from: 'switch', to: 'handler' },
      { id: 'e-handler-state', from: 'handler', to: 'state' },
      { id: 'e-handler-next', from: 'handler', to: 'next' },
      { id: 'e-next-ip', from: 'next', to: 'ip' },
      { id: 'e-handler-done', from: 'handler', to: 'done' },
    ],
  }, { title });
}

function* dispatchLoop() {
  yield {
    state: dispatchGraph('The interpreter spends its life in the dispatch loop'),
    highlight: { active: ['ip', 'decode', 'handler', 'next', 'e-ip-decode', 'e-handler-next', 'e-next-ip'], compare: ['done'] },
    explanation: 'Every bytecode interpreter has an inner loop: read an opcode, choose the handler, mutate VM state, advance the instruction pointer, and repeat.',
  };
  yield {
    state: labelMatrix(
      'Dispatch costs',
      [
        { id: 'fetch', label: 'fetch opcode' },
        { id: 'dispatch', label: 'choose handler' },
        { id: 'execute', label: 'execute handler' },
        { id: 'advance', label: 'advance IP' },
      ],
      [
        { id: 'work', label: 'work' },
        { id: 'risk', label: 'cost risk' },
      ],
      [
        ['load byte', 'cache misses'],
        ['switch/table', 'branch prediction'],
        ['update state', 'slow operation'],
        ['next op', 'loop overhead'],
      ],
    ),
    highlight: { active: ['dispatch:work', 'dispatch:risk'], found: ['execute:work'], compare: ['fetch:risk'] },
    explanation: 'Tiny bytecodes can be dominated by dispatch overhead. This is why handler layout, bytecode design, and quickening matter in production interpreters.',
    invariant: 'A faster handler does not help much if dispatch cost dominates every instruction.',
  };
  yield {
    state: dispatchGraph('Threaded code reduces some branch overhead'),
    highlight: { active: ['table', 'handler', 'next', 'e-table-handler', 'e-handler-next'], compare: ['switch'], found: ['state'] },
    explanation: 'Threaded-code interpreters arrange bytecode or handler addresses so a handler can jump straight to the next handler. The idea is dispatch-table locality, not operating-system threads.',
  };
}

function* handlerTable() {
  yield {
    state: dispatchGraph('A handler table maps opcodes to executable behavior'),
    highlight: { active: ['decode', 'table', 'handler', 'e-decode-table', 'e-table-handler'], compare: ['switch'] },
    explanation: 'A dispatch table is a data structure: opcode value to handler. In a switch interpreter, the compiler builds something similar behind the scenes for dense cases.',
  };
  yield {
    state: labelMatrix(
      'Handler table',
      [
        { id: 'const', label: 'CONST' },
        { id: 'add', label: 'ADD' },
        { id: 'jump', label: 'JUMP' },
        { id: 'call', label: 'CALL' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'state', label: 'state touched' },
      ],
      [
        ['push constant', 'stack/regs'],
        ['combine operands', 'stack/regs'],
        ['set IP', 'control'],
        ['push frame', 'frames'],
      ],
    ),
    highlight: { active: ['add:effect', 'jump:state', 'call:state'], found: ['const:effect'] },
    explanation: 'The handler table should make the stack effect or register effect explicit. Debuggers, validators, profilers, and bytecode printers all benefit from that metadata.',
  };
  yield {
    state: dispatchGraph('Dispatch connects bytecode design to engine performance'),
    highlight: { active: ['ip', 'decode', 'table', 'handler', 'state'], found: ['done'] },
    explanation: 'Bytecode Stack Virtual Machine and Register Virtual Machine: Lua Case Study choose different instruction formats. Dispatch is where those choices become runtime cost.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'dispatch loop') yield* dispatchLoop();
  else if (view === 'handler table') yield* handlerTable();
  else throw new InputError('Pick an interpreter-dispatch view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A bytecode program is a compact sequence of instructions, but bytes do not execute themselves. A virtual machine needs a loop that points at the next instruction, decodes the opcode, jumps to the code that implements that opcode, updates VM state, and continues. That loop is interpreter dispatch.',
        'Dispatch exists in every bytecode interpreter, from small teaching VMs to production language runtimes. It is easy to ignore because the semantic work feels more interesting: addition, property lookup, function call, branch, allocation, exception handling. In hot interpreted code, though, the VM may execute millions or billions of small bytecodes. The cost of choosing the next handler can become a large fraction of runtime.',
        'The topic matters because dispatch is where language design becomes machine behavior. A stack VM, a register VM, a dense opcode set, quickened opcodes, inline caches, bytecode operands, handler layout, profiling counters, and exception edges all meet in the same inner loop. If the loop is wrong, the interpreter is wrong. If the loop is slow, every interpreted instruction pays.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious interpreter is a loop with a switch statement. Store the bytecode in an array. Keep an instruction pointer, often called IP or program counter. Read one byte. Switch on its opcode. Run the matching case. Read any operands. Update the operand stack or register frame. Break back to the top of the loop.',
        'This design is not naive in the insulting sense. It is clear, portable C or C++, easy to debug, friendly to sanitizers, and good enough for many interpreters. A compiler can turn a dense switch into a jump table. The structure makes it obvious where to add tracing, disassembly, assertions, and error handling.',
        'A switch loop is also the right first implementation because it exposes the contract. Each case must know its stack effect or register effect. Each case must leave the instruction pointer in the right place. Each case must preserve VM invariants around call frames, exceptions, and runtime values. Until those contracts are correct, a clever dispatch strategy only makes bugs harder to see.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when bytecodes are small. Suppose a program executes CONST, CONST, ADD, STORE, LOAD, JUMP_IF_FALSE, and CALL in tight loops. Some handlers do only a few machine instructions of real semantic work. If every bytecode returns to a central loop, branches through a switch, and then jumps out again, dispatch overhead competes with the work the bytecode exists to perform.',
        'The asymptotic runtime is linear in executed bytecodes plus handler work, but the constant matters. Doubling the number of executed bytecodes doubles opcode fetches, dispatch branches, instruction-pointer updates, and handler entries. A bytecode format that splits one rich operation into five tiny operations may make handlers simple while multiplying dispatch cost.',
        'Modern CPUs make the constant visible. Branch predictors may learn common paths, but real programs often produce varied opcode streams. Indirect branches can be harder to predict than direct branches. Handler code may be spread across memory, causing instruction-cache pressure. Security mitigations and platform rules can also change the cost of indirect jumps.',
        'The wall is not always dispatch. If handlers allocate, call into runtime libraries, perform hash-table lookups, miss caches, or block on I/O, dispatch optimization will barely matter. The interpreter engineer has to measure whether time is going to the loop itself, to a few hot handlers, or to runtime calls underneath the handlers.',
      ],
    },
    {
      heading: 'Core mechanism',
      paragraphs: [
        'The core data structure is an opcode-to-handler mapping. In a switch interpreter, the source code names the mapping as cases, and the compiler may lower it to comparisons or a jump table. In an explicit dispatch-table interpreter, the VM stores handler entries indexed by opcode. The handler entry may be a function pointer, a label address in systems that support computed goto, or a generated code stub.',
        'The interpreter state is the other half of the structure. A handler is not a pure function of an opcode. It reads and writes an instruction pointer, operand stack or register array, constant pool, call-frame stack, exception state, global environment, inline-cache state, and profiling counters. The table maps an opcode to a state transition.',
        'Threaded code changes the control-flow shape. Instead of returning to one central switch after every handler, a handler dispatches directly to the next handler. Direct threaded code may store handler addresses in the instruction stream. Indirect threaded code may store compact opcodes and look up the next handler address through a table. The word "threaded" here means handlers are threaded together as jumps; it has nothing to do with operating-system threads.',
        'The point is to reduce repeated central-loop overhead and sometimes improve handler locality. A handler can perform its work, fetch or already know the next dispatch target, and jump onward. The tradeoff is portability and debuggability: computed labels, hand-written assembly, or generated dispatch code may be faster on one platform and awkward on another.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with the instruction pointer. It identifies the next bytecode or the next byte within the bytecode stream. The interpreter fetches the opcode and advances IP past the opcode. If the instruction has operands, the handler reads those operands and advances IP again. A branch handler may overwrite IP instead of advancing normally.',
        'The opcode selects the handler. In a switch loop, selection happens through the switch. In a table interpreter, selection is an indexed lookup. In threaded code, selection may be embedded in the bytecode stream or performed at the end of the previous handler. Every variant answers the same question: which block of host-machine code implements this bytecode?',
        'The handler performs the bytecode effect. CONST pushes or loads a constant. ADD consumes two values and produces one result. JUMP changes the instruction pointer. CALL pushes a frame and transfers control to another function body. RETURN pops a frame and resumes the caller. Each handler has a small contract over VM state.',
        'After the handler, dispatch continues unless the handler returns from the interpreter, throws an exception, enters a slow runtime path, or transfers to compiled code. A production VM may also update counters, collect type feedback, quicken the bytecode, or trigger compilation. These additions are useful, but they make the handler boundary more important because metadata must stay consistent with the language result.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is local composition. If the instruction pointer starts at a valid instruction, and the opcode maps to the handler for that instruction, and the handler preserves its documented state contract, then one interpreter step produces the same next VM state that the bytecode semantics require. Repeating that step executes the program.',
        'For a stack VM, the main invariant is stack shape. ADD must find two operands of valid representation and leave one result. DUP must increase stack height by one. RETURN must leave the caller frame in a valid state. If a handler consumes the wrong number of values, the next handler may see a plausible machine value in the wrong role, which is worse than an immediate crash.',
        'For a register VM, the invariant is operand addressing. The decoded operands must refer to valid registers or constants. The handler must write exactly the destination registers promised by the instruction format. A register VM avoids some stack shuffling, but it makes operand decoding and bytecode validation more central.',
        'For control flow, the invariant is the instruction pointer. Most handlers leave IP at the next sequential instruction. Branches, calls, returns, exceptions, and deoptimization edges are allowed to break that rule only through explicit transfer paths. Debug tracing and bytecode validators are valuable because they check the same boundaries a dispatch bug would violate.',
        'Quickened handlers and inline-cache handlers preserve correctness by keeping the language contract stable. A generic property load may become a specialized load after observing an object shape. The specialized handler is allowed to be faster, but it must either produce the same result as the generic handler or fall back when its assumptions fail.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider bytecode for a tiny expression: CONST 3, CONST 4, ADD, STORE local0. In a stack VM, CONST reads a constant-pool index and pushes a value. The second CONST does the same. ADD pops the two top values, checks or assumes numeric representation, computes the result, and pushes it. STORE pops or reads the result and writes it to a local slot.',
        'In a switch interpreter, each of those four bytecodes returns to the central loop. The loop fetches the next opcode, dispatches to the case, and repeats. The semantic work is tiny. Four bytecodes means four dispatches even though the useful computation is one addition and one store.',
        'A table interpreter makes the opcode-to-handler mapping explicit. Opcode 0 might point to CONST, opcode 1 to ADD, opcode 2 to STORE, and opcode 3 to JUMP. The table can also be paired with metadata: operand width, stack effect, name for debugging, and flags for control-flow behavior.',
        'A threaded interpreter tries to avoid bouncing through one central switch. The CONST handler can fetch the next target and jump to it. The ADD handler can do the same. The program still executes four bytecodes, and the handlers still preserve the same stack contract, but the branch pattern changes. That may reduce overhead on some compilers and CPUs, and may make little difference or even hurt on others.',
      ],
    },
    {
      heading: 'Animation focus',
      paragraphs: [
        'The dispatch-loop view shows the cycle that dominates an interpreter: IP, decode, handler, state update, next IP. The useful detail is that handler execution and dispatch are separate costs. A program with tiny handlers can be bottlenecked by the arrows that choose handlers rather than by the handler bodies.',
        'The dispatch-cost matrix separates fetch, dispatch, execute, and advance. That separation is how VM engineers reason about optimizations. Superinstructions reduce dispatch count by combining common bytecode pairs. Quickening replaces generic handlers with specialized handlers. Threaded code changes the path from one handler to the next.',
        'The handler-table view shows the table as a real data structure, not just an implementation detail. Each row maps an opcode name to an effect and the state it touches. That same metadata can support disassembly, validation, debugging, profiling, and documentation.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Runtime cost is proportional to executed bytecodes plus the work inside handlers. Dispatch adds a per-bytecode constant: fetch opcode, find handler, branch or jump, read operands, and continue. When input doubles in the sense of executed bytecodes, dispatch work doubles unless the VM uses richer instructions, superinstructions, compilation, or another technique that reduces interpreter steps.',
        'Bytecode granularity is the main design tradeoff. Tiny bytecodes are easy to generate and compose, but they increase dispatch count. Rich bytecodes reduce dispatch count, but they need more decoding, more specialized handlers, and more complex tooling. Production VMs often use a mix: simple core bytecodes, quickened variants, and specialized runtime paths for hot patterns.',
        'Memory cost includes the bytecode array, constant pool, handler table or generated handler code, debug metadata, stack maps, inline-cache entries, feedback vectors, and profiling counters. Threaded code may increase bytecode size if it stores handler addresses instead of compact opcodes. That can trade dispatch speed for instruction-cache and memory pressure.',
        'Compilation changes the equation. A JIT compiler can remove interpreter dispatch from hot code by turning bytecode into machine code. Interpreters still matter because they start quickly, use less memory than compiling everything, execute cold code cheaply, collect feedback, and provide a fallback when optimized assumptions fail.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'A switch loop wins for clarity, portability, and initial correctness. It is the best default for a teaching VM, a small language, or a runtime where interpreted execution is not the main bottleneck. It keeps the dispatch contract visible.',
        'An explicit handler table wins when the VM wants one central place to attach metadata and generated variants. It is useful for bytecode printers, validators, profiling, tracing, testing, and quickening. The table also makes dense opcode design and handler organization easier to inspect.',
        'Threaded code can win in low-level interpreters that spend a large share of time in dispatch and run on platforms where computed gotos, label addresses, or generated dispatch code behave well. It is most attractive when handlers are small, bytecode execution is hot, and measurements show the central switch is a real cost.',
        'All dispatch designs win when paired with good bytecode design. Reducing pointless bytecodes, using operands that match the VM state model, combining common instruction sequences, and keeping hot handlers small can matter more than the dispatch mechanism alone.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Dispatch tables fail when the opcode space is sparse or unstable enough that indexing becomes awkward. They also fail as an optimization if the real cost sits in runtime calls, allocation, property lookup, garbage collection, or I/O. You cannot fix a slow hash lookup by shaving a branch from dispatch.',
        'Threaded code fails when portability, tooling, or security constraints matter more than a possible speedup. Computed goto is not standard C. Hand-written assembly multiplies architecture work. Some compilers optimize switch dispatch very well. Some CPUs and mitigations make indirect branches expensive.',
        'The common correctness failures are concrete. A handler reads the wrong operand width. A branch target lands in the middle of an instruction. A stack handler leaves the wrong height. A call handler forgets to save IP. An exception path skips cleanup. A quickened handler keeps using stale feedback after an object shape changes.',
        'Good VMs defend against these failures with bytecode verification, debug assertions, disassembly, execution tracing, fuzzing, and slow reference paths. Dispatch is performance-sensitive, but it is also the interpreter control plane. Speed is only useful after the handler contracts are boringly correct.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Bytecode Stack Virtual Machine for stack effects, Register Virtual Machine: Lua Case Study for operand encoding, V8 Ignition Bytecode Pipeline for production bytecode and feedback, V8 Hidden Classes and Inline Caches for quickened property access, and Finite State Machine for the general table-driven control pattern.',
        'Primary sources and useful references include the V8 Ignition overview at https://v8.dev/blog/ignition-interpreter, the V8 Ignition docs at https://v8.dev/docs/ignition, the Crafting Interpreters VM chapter at https://craftinginterpreters.com/a-virtual-machine.html, and the WebAssembly Core Specification execution model at https://www.w3.org/TR/wasm-core-2/.',
      ],
    },
  ],
};
