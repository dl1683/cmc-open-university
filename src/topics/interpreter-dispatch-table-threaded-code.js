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
      heading: 'How to read the animation',
      paragraphs: [
        'The dispatch-loop view shows the cycle that dominates every bytecode interpreter: fetch from IP, decode the opcode, execute the handler, update VM state, advance IP, repeat. Active (highlighted) edges are the path the interpreter takes on each tick. The edge from handler to done lights up only when the program terminates.',
        {type: 'callout', text: 'Dispatch performance is paid per bytecode, so tiny handlers make the branch itself part of the workload.'},
        'The dispatch-cost matrix separates four per-bytecode costs: fetch, dispatch, execute, advance. Each cell names the work and the risk. This is how VM engineers decide what to optimize. If the dispatch row dominates, the interpreter needs better branching. If the execute row dominates, the handler itself is slow and dispatch optimization is irrelevant.',
        'The handler-table view shows the dispatch table as a first-class data structure. Each row maps an opcode to its effect and the VM state it touches. That same metadata drives disassembly, validation, profiling, and documentation in production VMs.',
        {type: 'note', text: 'The word "threaded" in this topic means handlers are threaded together by jumps -- each handler jumps directly to the next. It has nothing to do with OS threads or concurrency.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A bytecode program is a compact sequence of instructions, but bytes do not execute themselves. Something must point at the next instruction, decode the opcode, jump to the code that implements it, mutate VM state, and repeat. That something is the dispatch loop.',
        {type: 'quote', text: 'The inner loop of an interpreter is the most important piece of code in the entire system. Everything else -- the compiler, the GC, the standard library -- exists to serve it.', attribution: 'Maxime Chevalier-Boisvert, YJIT developer'},
        'Dispatch matters because it runs on every single bytecode. A hot function that executes a million tiny instructions pays the dispatch cost a million times. When handlers do only a few machine instructions of real work, dispatch overhead can dominate total runtime. This is where language design becomes machine behavior: opcode density, handler layout, quickening, inline caches, and superinstructions all converge in the same inner loop.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious interpreter is a loop with a switch statement.',
        {type: 'code', text: 'while (true) {\n  uint8_t opcode = bytecode[ip++];\n  switch (opcode) {\n    case OP_CONST: push(constants[bytecode[ip++]]); break;\n    case OP_ADD:   { Value b = pop(); Value a = pop(); push(a + b); break; }\n    case OP_JUMP:  ip = bytecode[ip]; break;\n    case OP_RET:   return pop();\n  }\n}', language: 'c'},
        'This is not naive. It is clear, portable C, easy to debug, friendly to sanitizers, and good enough for many interpreters. A compiler can lower a dense switch into a jump table. The structure makes it obvious where to add tracing, disassembly, assertions, and error handling.',
        'A switch loop is also the right first implementation because it exposes the handler contract. Each case must know its stack effect. Each case must leave IP at the correct next instruction. Each case must preserve invariants around call frames, exceptions, and value representations. Until those contracts are correct, a clever dispatch strategy only makes bugs harder to find.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when bytecodes are small. Consider a tight loop executing CONST, CONST, ADD, STORE, LOAD, JUMP_IF_FALSE, CALL. Some handlers do only 3-5 machine instructions of semantic work, but every one returns to the central loop, branches through the switch, and jumps back out. Dispatch overhead competes with the work the bytecodes exist to perform.',
        {type: 'bullets', items: [
          'Branch misprediction: varied opcode streams defeat stable CPU prediction, and each miss can cost more cycles than a tiny handler body.',
          'Instruction-cache pressure: handler code spreads across memory, so hot handlers can evict each other from L1i on large opcode sets.',
          'Indirect-branch cost: switch dispatch often lowers to an indirect jump, and retpoline or IBT mitigations can add overhead.',
          'Redundant loop overhead: every handler returns to one central point, refetches the opcode, and reindexes the table.',
        ]},
        'The wall is not always dispatch. If handlers allocate, call runtime libraries, perform hash lookups, miss data caches, or block on I/O, dispatch optimization barely matters. The engineer must measure whether time goes to the loop itself, to a few hot handlers, or to runtime calls underneath.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Three dispatch strategies exist, each answering the same question differently: given an opcode, which block of host-machine code runs next?',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt: 'State transition diagram with process states and arrows', caption: 'A state-machine diagram matches the interpreter loop: each opcode moves the VM from one precise state to the next. Source: Wikimedia Commons, CC BY-SA 3.0.'},
        {type: 'diagram', text: 'Switch dispatch:\n  [bytecode] -> IP -> opcode -> switch { case 0: ...; case 1: ...; } -> loop top\n                                  ^                                        |\n                                  +----------------------------------------+\n\nTable dispatch:\n  [bytecode] -> IP -> opcode -> table[opcode]() -> loop top\n                                  ^                    |\n                                  +--------------------+\n\nThreaded code:\n  [bytecode] -> IP -> handler_A --jump--> handler_B --jump--> handler_C\n                      (no central loop; each handler dispatches the next)', label: 'Control-flow shape of three dispatch strategies'},
        'The instruction pointer identifies the next byte in the bytecode stream. The interpreter fetches the opcode, advances IP past it, reads any operands, and advances IP again. A branch handler overwrites IP instead of advancing sequentially.',
        'In a switch interpreter, the opcode selects a case. In a table interpreter, the opcode is an index into an array of handler pointers. In threaded code, the handler itself fetches the next opcode and jumps directly to the next handler, bypassing the central loop entirely.',
        {type: 'code', text: '// Direct threaded code (GCC extension: labels-as-values)\nstatic void *dispatch_table[] = { &&op_const, &&op_add, &&op_jump, &&op_ret };\n#define DISPATCH() goto *dispatch_table[bytecode[ip++]]\n\nDISPATCH();\nop_const: push(constants[bytecode[ip++]]); DISPATCH();\nop_add:   { Value b = pop(); Value a = pop(); push(a + b); } DISPATCH();\nop_jump:  ip = bytecode[ip]; DISPATCH();\nop_ret:   return pop();', language: 'c'},
        'Each handler performs a bytecode effect. CONST pushes a constant. ADD consumes two values and produces one. JUMP changes IP. CALL pushes a frame and transfers control. RETURN pops a frame. After the handler completes, dispatch continues unless the handler returns, throws, enters a slow path, or transfers to compiled code.',
        {type: 'note', text: 'Direct threaded code stores handler addresses in the bytecode stream (replacing compact opcodes). Indirect threaded code keeps compact opcodes but looks up the handler address through a table at the end of each handler. The direct variant is faster but uses more memory and complicates bytecode serialization.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on local composition. If IP starts at a valid instruction, the opcode maps to the correct handler, and the handler preserves its state contract, then one interpreter step produces the VM state that the bytecode semantics require. Repeating the step executes the program.',
        {type: 'bullets', items: [
          'Stack VM invariant: each handler consumes and produces the documented number of values. If it breaks, the next handler sees a value in the wrong role.',
          'Register VM invariant: decoded operands refer to valid registers or constants. If it breaks, a handler writes the wrong destination and corruption propagates.',
          'Control-flow invariant: most handlers leave IP at the next sequential instruction, while branches, calls, returns, and exceptions change it through explicit paths. If it breaks, a branch can land mid-instruction.',
        ]},
        'Quickened and inline-cache handlers preserve correctness by keeping the language contract stable. A generic property load may become a specialized load after observing an object shape. The specialized handler must produce the same result as the generic one or fall back when its assumption breaks.',
        {type: 'code', text: '// Quickening example: LOAD_ATTR -> LOAD_ATTR_SLOT\n// Generic path:\ncase OP_LOAD_ATTR:\n  obj = peek(0);\n  name = constants[READ_ARG()];\n  result = generic_getattr(obj, name);  // hash lookup\n  // Record shape feedback, maybe quicken:\n  if (can_quicken(obj, name)) rewrite_bytecode(ip, OP_LOAD_ATTR_SLOT, slot);\n  push(result); break;\n\n// Quickened path (runs next time):\ncase OP_LOAD_ATTR_SLOT:\n  obj = peek(0);\n  if (obj->shape == cached_shape)\n    push(obj->slots[READ_ARG()]);  // direct slot read, no hash\n  else\n    goto slow_load_attr;  // shape changed, fall back\n  break;', language: 'c'},
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Runtime cost is proportional to executed bytecodes times per-bytecode dispatch cost plus handler work. Dispatch adds a constant per bytecode: fetch opcode, find handler, branch or jump, read operands. Doubling executed bytecodes doubles dispatch work.',
        {type: 'bullets', items: [
          'Switch dispatch: one indirect branch plus a loop return; compact one-byte opcodes; standard C and C++ portability.',
          'Function-pointer table: one indexed load plus one indirect call; compact opcodes plus a pointer-sized table; standard C and C++ portability.',
          'Direct threaded dispatch: one indexed load plus one indirect jump with no loop return; pointer-sized entries replace byte opcodes; requires computed goto or assembly.',
          'Indirect threaded dispatch: one table load plus one indirect jump; compact opcodes plus a pointer-sized table; requires computed goto or assembly.',
        ]},
        'Bytecode granularity is the main design tradeoff. Tiny bytecodes are easy to generate and compose but multiply dispatch count. Rich bytecodes reduce dispatch but need more decoding, more specialized handlers, and more complex tooling. Production VMs use a mix: simple core bytecodes, quickened variants, and superinstructions for common pairs.',
        {type: 'bullets', items: [
          'Memory budget: bytecode array + constant pool + handler table + debug metadata + stack maps + inline-cache entries + feedback vectors + profiling counters.',
          'Direct threading trades opcode compactness for dispatch speed -- pointer-sized entries replace 1-byte opcodes, increasing I-cache and memory pressure.',
          'JIT compilation removes dispatch from hot code entirely. Interpreters still matter: they start fast, use less memory, execute cold code cheaply, collect type feedback, and provide a deoptimization fallback.',
        ]},
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {type: 'bullets', items: [
          'Switch loop: best for teaching VMs, small languages, and runtimes where interpreted code is not the bottleneck; maximizes clarity, portability, and debugging.',
          'Explicit handler table: best for VMs that need metadata per opcode; centralizes opcode name, operand width, stack effect, handler pointer, and flags.',
          'Threaded code: best for low-level interpreters with tiny hot handlers where measurement shows the central switch is a real cost; reduces loop-return overhead.',
        ]},
        'All dispatch strategies win when paired with good bytecode design. Reducing unnecessary instructions, using operands that match the VM state model, combining common sequences into superinstructions, and keeping hot handlers small often matter more than the dispatch mechanism.',
        {type: 'note', text: 'CPython 3.12+ uses a combination: a computed-goto threaded interpreter with adaptive specialization (quickening). V8 Ignition uses a handler table with generated handler stubs. Lua 5.4 uses a switch loop. All three are successful production VMs. The dispatch strategy is one variable among many.'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {type: 'bullets', items: [
          'Dispatch tables fail when the opcode space is sparse or unstable enough that dense indexing wastes memory or needs constant reshuffling.',
          'Threaded code fails when portability matters: computed goto is a GCC/Clang extension, not standard C. Hand-written assembly multiplies per-architecture work.',
          'Dispatch optimization of any kind fails when the real cost sits in runtime calls, allocation, property lookup, GC, or I/O. You cannot fix a slow hash lookup by shaving a branch from dispatch.',
          'Security mitigations (retpoline, IBT, CET) can make indirect branches so expensive that threaded code loses its advantage over a well-optimized switch.',
        ]},
        'The common correctness failures are specific and dangerous:',
        {type: 'bullets', items: [
          'Wrong operand width: a handler reads two bytes for a one-byte operand, so IP skips into the middle of the next instruction. Defense: verify operand sizes before execution.',
          'Stack height mismatch: a handler pops one value instead of two, so the next handler sees stale data in the wrong role. Defense: stack-map validation and debug-mode depth tracking.',
          'Stale quickened handler: object shape changed but the specialized handler still assumes the old layout. Defense: shape guards, generic fallback, and invalidation on shape transition.',
          'Branch into mid-instruction: a jump target lands on an operand byte and decodes it as another opcode. Defense: reject jumps to non-instruction-start offsets.',
          'Call handler forgets to save IP: return resumes at the wrong address. Defense: assert that saved IP points to a valid instruction boundary.',
        ]},
        'Good VMs defend with bytecode verification, debug assertions, disassembly, execution tracing, fuzzing, and slow reference paths. Dispatch is performance-sensitive, but it is also the interpreter control plane. Speed is only useful after handler contracts are boringly correct.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {type: 'bullets', items: [
          'Crafting Interpreters, chapter 15, A Virtual Machine, https://craftinginterpreters.com/a-virtual-machine.html: complete switch-dispatch interpreter in C with stack, constants, and control flow.',
          'V8 Ignition design, https://v8.dev/blog/ignition-interpreter: production handler-table interpreter with register allocation, feedback vectors, and JIT integration.',
          'V8 Ignition docs, https://v8.dev/docs/ignition: bytecode format, handler generation, and interaction with TurboFan.',
          'Anton Ertl, The Structure and Performance of Efficient Interpreters, JFP 2003: empirical comparison of switch, direct-threaded, and indirect-threaded dispatch on real hardware.',
          'WebAssembly Core Spec, Execution, https://www.w3.org/TR/wasm-core-2/: formal bytecode semantics and validation rules for a stack machine.',
        ]},
        {type: 'bullets', items: [
          'Prerequisite: Bytecode Stack Virtual Machine (stack effects and operand contracts).',
          'Prerequisite: Finite State Machine (general table-driven control pattern).',
          'Extension: Register Virtual Machine: Lua Case Study (operand encoding, register windows).',
          'Extension: V8 Ignition Bytecode Pipeline (production feedback-driven dispatch and compilation).',
          'Related: V8 Hidden Classes and Inline Caches (quickened property access driven by dispatch-level feedback).',
        ]},
      ],
    },
  ],
};
