// Bytecode stack virtual machine: compact opcodes, instruction pointer, value
// stack, constants, call frames, and an interpreter loop.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'bytecode-stack-virtual-machine',
  title: 'Bytecode Stack Virtual Machine',
  category: 'Concepts',
  summary: 'Turn AST evaluation into compact bytecode: constants, opcodes, instruction pointer, value stack, call frames, and a dispatch loop.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['stack bytecode', 'frames and calls'], defaultValue: 'stack bytecode' },
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

function vmGraph(title) {
  return graphState({
    nodes: [
      { id: 'ast', label: 'AST', x: 0.8, y: 3.8, note: 'expr' },
      { id: 'chunk', label: 'bc', x: 2.4, y: 3.8, note: 'bytes' },
      { id: 'consts', label: 'K', x: 2.4, y: 5.7, note: 'const pool' },
      { id: 'ip', label: 'IP', x: 4.2, y: 2.5, note: 'next op' },
      { id: 'stack', label: 'stack', x: 4.2, y: 5.0, note: 'values' },
      { id: 'dispatch', label: 'loop', x: 6.2, y: 3.8, note: 'switch' },
      { id: 'op', label: 'op', x: 7.8, y: 2.4, note: 'ADD' },
      { id: 'result', label: 'res', x: 8.9, y: 5.0, note: 'top' },
    ],
    edges: [
      { id: 'e-ast-chunk', from: 'ast', to: 'chunk' },
      { id: 'e-chunk-consts', from: 'chunk', to: 'consts' },
      { id: 'e-chunk-ip', from: 'chunk', to: 'ip' },
      { id: 'e-ip-dispatch', from: 'ip', to: 'dispatch' },
      { id: 'e-stack-dispatch', from: 'stack', to: 'dispatch' },
      { id: 'e-dispatch-op', from: 'dispatch', to: 'op' },
      { id: 'e-op-stack', from: 'op', to: 'stack' },
      { id: 'e-stack-result', from: 'stack', to: 'result' },
    ],
  }, { title });
}

function* stackBytecode() {
  const compileGraph = vmGraph('A stack VM compiles syntax into a bytecode chunk');
  const vmNodeCount = compileGraph.graph.nodes.length;
  yield {
    state: compileGraph,
    highlight: { active: ['ast', 'chunk', 'consts', 'e-ast-chunk', 'e-chunk-consts'], compare: ['dispatch'] },
    explanation: `The parser can produce an AST, but the runtime usually wants a compact instruction stream. A bytecode chunk stores opcodes plus a constant pool — the full VM pipeline has ${vmNodeCount} stages from source to result.`,
  };
  const instrRows = [
    { id: 'i0', label: '0' },
    { id: 'i1', label: '1' },
    { id: 'i2', label: '2' },
    { id: 'i3', label: '3' },
    { id: 'i4', label: '4' },
  ];
  const expression = '1 + 2 * 3';
  yield {
    state: labelMatrix(
      `Bytecode for ${expression}`,
      instrRows,
      [
        { id: 'op', label: 'opcode' },
        { id: 'stack', label: 'stack after' },
      ],
      [
        ['CONST 1', '[1]'],
        ['CONST 2', '[1,2]'],
        ['CONST 3', '[1,2,3]'],
        ['MUL', '[1,6]'],
        ['ADD', '[7]'],
      ],
    ),
    highlight: { active: ['i0:stack', 'i1:stack', 'i2:stack'], found: ['i3:stack', 'i4:stack'] },
    explanation: `Stack bytecode avoids naming temporary values. The expression ${expression} compiles to ${instrRows.length} instructions that push operands and consume the top stack slots. The order encodes the expression tree.`,
    invariant: 'Every opcode has a stack effect: how many values it pops and pushes.',
  };
  const dispatchHighlight = { active: ['ip', 'dispatch', 'op', 'stack', 'e-ip-dispatch', 'e-dispatch-op', 'e-op-stack'], found: ['result'] };
  yield {
    state: vmGraph('The dispatch loop advances the instruction pointer'),
    highlight: dispatchHighlight,
    explanation: `The interpreter reads the next opcode, advances the instruction pointer, executes the handler, and repeats. This loop lights up ${dispatchHighlight.active.length} active components — the value stack is the central data structure.`,
  };
}

function* framesAndCalls() {
  const frameHighlight = { active: ['stack', 'dispatch', 'ip'], compare: ['consts'], found: ['result'] };
  yield {
    state: vmGraph('Function calls add call frames around the value stack'),
    highlight: frameHighlight,
    explanation: `A function call needs more than operands. With ${frameHighlight.active.length} active components (${frameHighlight.active.join(', ')}), a call frame records the current function, return address, base stack slot, and local slots.`,
  };
  const frameRows = [
    { id: 'fn', label: 'function' },
    { id: 'ret', label: 'return ip' },
    { id: 'base', label: 'base slot' },
    { id: 'locals', label: 'locals' },
  ];
  yield {
    state: labelMatrix(
      'Call frame layout',
      frameRows,
      [
        { id: 'stored', label: 'stored value' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['callee chunk', 'which bytecode'],
        ['caller IP', 'resume caller'],
        ['stack index', 'find locals'],
        ['slots', 'fast access'],
      ],
    ),
    highlight: { active: ['ret:stored', 'base:stored', 'locals:stored'], found: ['fn:stored'] },
    explanation: `The frame stores ${frameRows.length} fields (${frameRows.map(r => r.label).join(', ')}) and makes recursive calls possible without copying the whole stack. Each call sees its own window over the same value-stack array.`,
  };
  const altHighlight = { active: ['chunk', 'stack', 'dispatch'], compare: ['ast'], found: ['result'] };
  yield {
    state: vmGraph('Stack VMs are compact but not the only design'),
    highlight: altHighlight,
    explanation: `Stack bytecode is dense and simple to emit — the core loop touches ${altHighlight.active.length} components (${altHighlight.active.join(', ')}). Register Virtual Machine: Lua Case Study shows the opposite tradeoff: larger instructions but fewer push and pop operations.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'stack bytecode') yield* stackBytecode();
  else if (view === 'frames and calls') yield* framesAndCalls();
  else throw new InputError('Pick a stack-VM view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. The "stack bytecode" view shows how an expression like 1 + 2 * 3 compiles into a sequence of opcodes and how the value stack changes after each instruction. The "frames and calls" view shows how the VM manages function calls by pushing call frames that partition the value stack into per-call windows.',
        'Each step highlights the active components in the VM pipeline: AST, bytecode chunk, constant pool, instruction pointer, dispatch loop, current opcode, value stack, and result. Watch the stack column in the bytecode table -- it shows the exact stack contents after every instruction executes. The number of items on the stack at each point is how you verify that the compiler emitted correct code.',
        {type: 'image', src: './assets/gifs/bytecode-stack-virtual-machine.gif', alt: 'Animated walkthrough of the bytecode stack virtual machine visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'When you write a programming language, you need something that executes the parsed program. The simplest option is a tree-walking interpreter: parse source code into an abstract syntax tree (AST -- a tree where each node is a language construct like "add" or "if"), then recursively visit each node, evaluate it, and return the result. This works, but every execution retraces the shape of the source code. You pay for pointer chasing through heap-allocated tree nodes on every single run.',
        {
          type: 'callout',
          text: 'A stack VM makes execution explicit by replacing recursive syntax walking with a compact instruction stream and a visible value stack.',
        },
        'A bytecode stack virtual machine sits between tree walking and native machine code. A compiler pass walks the AST once and emits a flat array of bytecode instructions -- small numeric opcodes like CONST, ADD, CALL, RETURN. The runtime then executes those instructions using five pieces of state: an instruction pointer (which opcode to run next), a bytecode chunk (the instruction array), a constant pool (literals like numbers and strings referenced by index), a value stack (where operands and intermediate results live), and call frames (bookkeeping for function calls). The language stops being a recursive walk over syntax and becomes a small, inspectable machine.',
        'This is the architecture behind CPython, Ruby\'s YARV, Lua 4, early Java, the JVM\'s interpreter tier, WebAssembly\'s execution model, and most teaching compilers. It is far simpler to build than a native code generator, yet it gives the implementation explicit control over execution state that a tree walker hides inside host-language recursion.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The most direct interpreter walks the AST. To evaluate the expression 1 + 2 * 3, the evaluator visits the "+" node, recurses into the left child (the literal 1), recurses into the right child (the "*" node), which recurses into 2 and 3, multiplies them, returns 6, and then adds 1. Every grammar rule maps to one evaluator function. This is clean, correct, and a perfect teaching tool for language semantics.',
        'The cost is structural. Each AST node is a heap object with pointers to children. Evaluating a program of N nodes means N recursive calls, N pointer dereferences, and N dynamic-dispatch decisions (which node type am I?). You cannot easily serialize the execution, inspect it mid-flight, or validate it ahead of time. The program\'s control flow is entangled with the host language\'s call stack.',
        'The opposite extreme is native code generation: emit x86 or ARM instructions, get hardware speed. But that requires register allocation, calling conventions, executable memory management, platform-specific backends, and careful security boundaries. Bytecode is the pragmatic middle ground. You compile once to a portable instruction stream, then either interpret it or use it as input for a JIT compiler later.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Tree-walking hits a wall on three fronts simultaneously. First, performance: the interpreter spends more time navigating the tree than doing useful computation. A loop that runs 10,000 iterations re-traverses the loop body\'s AST 10,000 times, chasing pointers and dispatching on node types each time. Second, observability: there is no compact representation of "what the program is doing right now" -- the state is spread across hundreds of host-language stack frames. You cannot pause a tree-walk mid-expression, serialize it, send it to another machine, and resume.',
        'Third, validation: you cannot cheaply prove properties of a tree-walk program before running it. With bytecode, you can scan the instruction array and verify that every jump target is valid, every opcode\'s stack effect is balanced, and the maximum stack depth is bounded -- all before executing a single instruction. This is exactly how WebAssembly validators work, and it is impossible with a tree walker because there is no instruction stream to scan.',
        'These three walls -- performance, observability, and pre-execution validation -- are what push every serious language implementation past tree walking and toward bytecode. The question is not whether to compile; it is how much to compile.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that a stack eliminates the need to name temporary values. In a register machine, the compiler must decide which register holds each intermediate result: "put 2 * 3 in register R1, then add R1 to the literal 1." In a stack machine, the compiler just emits instructions in the order that produces and consumes values: CONST 2, CONST 3, MUL (pops two, pushes one), CONST 1, ADD (pops two, pushes one). The stack itself is the naming system. Whatever is on top is the next operand.',
        'This means every opcode has a stack effect: a declaration of how many values it pops and how many it pushes. CONST pops 0, pushes 1 (net +1). ADD pops 2, pushes 1 (net -1). RETURN pops 1, pushes 0 (net -1). If the compiler emits instructions whose stack effects are consistent -- if every consumer finds the values it needs already on the stack -- the program executes correctly. If a single effect is wrong, the stack will be the wrong height at some later point, and the VM will read a number where it expected a function pointer, or vice versa.',
        'The entire VM state fits in five pieces. The bytecode chunk is a flat array of opcode bytes and inline operand bytes. The constant pool is an array of values (numbers, strings, function objects) indexed by the operand of CONST instructions. The instruction pointer is an integer index into the bytecode chunk. The value stack is an array that grows and shrinks as instructions execute. Call frames are a small stack of records that track which function is running, where to return, and where each function\'s local variables start on the value stack.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:NY1BCsIwEEX3OcVcoFcQ2jQVwVUVN0MWIUZSGmZCMkG8vRDr6sH7D_4r8dtHVwSuqxpxvN0tDMMJJpw-Ejw_A_jYaLdq6l7jhaqU5mVjgswbSSj_cUbNVMWRQGZOVumuDc5bzU58hMScrVrw4VILUMX5_fdnlOlcDp5xDbUlAaYj-wI',
          alt: 'Stack virtual machine state: AST compiles to bytecode, instruction pointer enters dispatch loop, and the value stack carries results.',
          caption: 'The bytecode VM is a small state machine: bytecode and constants feed dispatch, while the value stack carries intermediate results. Source: https://mermaid.ink/svg/pako:NY1BCsIwEEX3OcVcoFcQ2jQVwVUVN0MWIUZSGmZCMkG8vRDr6sH7D_4r8dtHVwSuqxpxvN0tDMMJJpw-Ejw_A_jYaLdq6l7jhaqU5mVjgswbSSj_cUbNVMWRQGZOVumuDc5bzU58hMScrVrw4VILUMX5_fdnlOlcDp5xDbUlAaYj-wI',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Compilation walks the AST in postorder (children before parent) and emits bytecode. For a binary expression like a + b, the compiler first emits code for a, then code for b, then emits an ADD opcode. This guarantees that when the VM reaches ADD, the stack already holds the two operands. Literal values become CONST instructions with an index into the constant pool: emit CONST 0 to push constants[0]. Variable references become LOAD instructions that copy a value from a local slot to the top of the stack.',
        'The dispatch loop is the VM\'s heartbeat. It reads the byte at bytecode[ip], increments ip, and jumps to the handler for that opcode. A switch statement is the simplest dispatch: switch(op) { case CONST: push(constants[readByte()]); break; case ADD: { let b = pop(); let a = pop(); push(a + b); } break; ... }. Each handler manipulates the stack, possibly reads inline operands from the bytecode stream, and falls back to the top of the loop. The loop terminates when it hits a HALT or RETURN with no remaining call frame.',
        'The constant pool deserves attention. Without it, every number literal would need to be encoded inline in the bytecode stream, and strings would need length-prefixed byte sequences embedded among opcodes. The constant pool externalizes these values. The bytecode says "push constant number 3" (one opcode byte plus one index byte = 2 bytes), and the pool holds the actual value at index 3. This keeps the instruction stream dense and regular, which matters for cache locality and for disassembly.',
        'Function calls add a call frame. When the VM executes a CALL opcode, it creates a new frame that records: (1) the callee\'s bytecode chunk, (2) the return instruction pointer (where to resume the caller), (3) the base slot (the index on the value stack where this call\'s arguments and locals begin), and (4) the number of local variable slots. The callee accesses its arguments and locals as stack[base + offset] rather than by absolute stack index. When the callee executes RETURN, the VM pops the frame, restores the caller\'s instruction pointer, and places the return value at the caller\'s expected stack position.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Stack bytecode works because the stack effect invariant composes. If opcode A has effect (pop 0, push 1) and opcode B has effect (pop 2, push 1), then the sequence A, A, B has a net effect of +1: two pushes followed by one instruction that pops 2 and pushes 1. The compiler can verify at compile time that the stack depth is non-negative after every instruction and that it equals exactly 1 at the end of an expression. If those checks pass, the bytecode is guaranteed not to underflow or leave garbage on the stack at runtime.',
        'It works for portability because the instruction set is defined by the language implementation, not by hardware. The same bytecode runs on x86, ARM, or RISC-V -- the dispatch loop is just a C or JavaScript function. This is why Java\'s "write once, run anywhere" promise was built on a stack-based bytecode VM (the JVM), and why WebAssembly chose a structured stack machine for its binary format.',
        'It works for optimization because bytecode is a stable intermediate form. A production VM can interpret bytecode for cold code, collect execution profiles (which branches are taken, which types appear), and then JIT-compile hot paths into native code using the bytecode as input. The V8 engine\'s Ignition interpreter and SparkPlug baseline compiler both consume bytecode. The bytecode layer decouples language semantics from machine-specific optimization, so each can evolve independently.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:TY5NCsIwEEb3OcVcoFcQklp_Vkp1N2QxhKmCkwQyib2-NCK4fe_j8S2S1_CkUuHujMWRRLjAUiiyh2HYgcOZaysJzldvbEcjOlIGlVx_aI-2PFrkVNWb6Zvh_8wBL2sCyYFkW3R2xBtFhjdJY9BK4eWN6-aEM2uLDKH_8R8',
          alt: 'Caller and callee frames sharing one value stack with return instruction pointer, base slot, arguments, and locals.',
          caption: 'Call frames let each invocation keep return state and local slots while sharing one physical value stack. Source: https://mermaid.ink/svg/pako:TY5NCsIwEEb3OcVcoFcQklp_Vkp1N2QxhKmCkwQyib2-NCK4fe_j8S2S1_CkUuHujMWRRLjAUiiyh2HYgcOZaysJzldvbEcjOlIGlVx_aI-2PFrkVNWb6Zvh_8wBL2sCyYFkW3R2xBtFhjdJY9BK4eWN6-aEM2uLDKH_8R8',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The dominant cost is dispatch overhead. Every opcode requires the interpreter to read a byte, branch to the right handler, execute it, and loop back. On modern CPUs, this branch is unpredictable -- the hardware branch predictor cannot guess which opcode comes next -- so the pipeline stalls on every dispatch. Measurements on CPython show that roughly 15-25% of execution time is pure dispatch overhead, depending on workload. Techniques to reduce this include direct threading (each handler jumps to the next handler\'s address instead of returning to the loop), computed goto (a GCC extension that eliminates the switch), superinstructions (fusing common opcode sequences into single opcodes), and JIT compilation (eliminating dispatch entirely for hot code).',
        'The second cost is stack traffic. Consider the expression a + b + c. A stack VM emits: LOAD a, LOAD b, ADD, LOAD c, ADD -- 5 instructions, 5 stack operations. A register VM can emit: ADD R1 a b; ADD R2 R1 c -- 2 instructions, 0 stack operations. Shi et al. (2008) measured that Lua\'s register-based VM executes 25-47% fewer instructions than an equivalent stack VM for the same programs. The tradeoff is that register instructions are larger (they encode register operands), so the bytecode is less compact.',
        'Memory cost is modest. The bytecode chunk is typically smaller than the AST it replaces because opcodes are 1-2 bytes versus 20-40 bytes per AST node (object header + type tag + child pointers). The value stack is a single pre-allocated array, usually 256 to 8,192 slots. Call frames are small fixed-size records. The constant pool grows with the number of unique literals in the program. For a program with 1,000 AST nodes, the bytecode might be 2-4 KB, the constant pool 1-2 KB, and the stack 2-8 KB.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'CPython compiles Python source to stack bytecode (.pyc files) and interprets it in a C dispatch loop. Every Python function object holds a reference to its bytecode. The dis module lets you disassemble any function: import dis; dis.dis(lambda x: x + 1) shows LOAD_FAST 0, LOAD_CONST 1, BINARY_ADD, RETURN_VALUE. This is a direct window into the stack VM.',
        'The Java Virtual Machine (JVM) uses a stack-based bytecode as its portable instruction set. javac compiles .java files to .class files containing stack bytecode. The JVM interprets this bytecode on startup and JIT-compiles hot methods via C1 and C2 compilers. The stack bytecode is the stable contract between the compiler and the runtime -- it has not changed fundamentally since 1995.',
        'WebAssembly (Wasm) defines a structured stack machine as its binary format. Each Wasm function declares its parameter and result types, and a validator statically checks that every instruction sequence has balanced stack effects before execution. This pre-execution validation is the reason Wasm can run untrusted code safely in browsers -- the stack effect invariant guarantees that valid bytecode cannot underflow the stack or access memory outside its linear memory sandbox.',
        'Database query engines use stack VMs for expression evaluation. SQLite compiles SQL queries into bytecode programs for its VDBE (Virtual Database Engine). Each row-processing step is an opcode. This makes query execution inspectable: EXPLAIN in SQLite prints the bytecode program, and you can trace exactly which opcodes execute for each row.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A stack VM fails when dispatch overhead dominates total execution time. For tight numeric loops -- matrix multiplication, physics simulation, signal processing -- the useful work per opcode is tiny (one addition, one multiplication), but the dispatch cost is fixed. The ratio of dispatch overhead to useful work can exceed 50%. This is why numeric code is almost always JIT-compiled or run through native libraries (NumPy calls into C/Fortran, not into CPython bytecode).',
        'It fails when the optimizer needs explicit dataflow. In a register-based intermediate representation, the compiler can see that R3 = R1 + R2 and that R3 is only used once, so it can fold the addition into the consumer. In stack bytecode, the same information is implicit in the push/pop sequence and must be reconstructed by an analysis pass. This reconstruction is possible but adds complexity. Production JIT compilers (V8\'s TurboFan, HotSpot\'s C2) typically convert stack bytecode into an SSA-based IR before optimizing.',
        'It fails when tooling is absent. A bytecode VM without a disassembler, stack-depth checker, and trace mode is a black box. When the compiler emits wrong stack effects, the symptom is a crash or wrong result many instructions later, because the stack is silently misaligned. Building a VM without building its debugging tools is building a machine you cannot diagnose.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Compile and execute the expression (3 + 5) * 2. The parser produces an AST: a MUL node whose left child is an ADD node (children 3 and 5) and whose right child is the literal 2. The compiler walks this tree in postorder. It visits 3 first: emit CONST 0 (constants[0] = 3). Visit 5: emit CONST 1 (constants[1] = 5). Visit the ADD node: emit ADD. Visit 2: emit CONST 2 (constants[2] = 2). Visit the MUL node: emit MUL. Final bytecode: [CONST 0, CONST 1, ADD, CONST 2, MUL]. Constant pool: [3, 5, 2]. Total: 5 opcode bytes + 3 operand bytes = 8 bytes of bytecode plus 3 constant pool entries.',
        'Execute step by step. ip=0: CONST 0 pushes constants[0]=3. Stack: [3]. ip=2: CONST 1 pushes constants[1]=5. Stack: [3, 5]. ip=4: ADD pops 5 and 3, pushes 8. Stack: [8]. ip=5: CONST 2 pushes constants[2]=2. Stack: [8, 2]. ip=7: MUL pops 2 and 8, pushes 16. Stack: [16]. The result is 16, sitting alone on top of the stack. At every step, the stack depth matched what the next instruction expected: ADD found 2 values, MUL found 2 values, and the final depth is 1.',
        'Now wrap this in a function: fn double(x) { return x * 2; }; double(3 + 5). The compiler emits bytecode for double\'s body: LOAD_LOCAL 0 (push argument x), CONST 0 (push 2), MUL, RETURN. For the call site: CONST 0 (push 3), CONST 1 (push 5), ADD (stack: [8]), CALL double with 1 argument. The CALL opcode creates a frame: return_ip=next instruction in caller, base_slot=current stack top minus 1 argument = index where 8 sits. Inside double, LOAD_LOCAL 0 reads stack[base_slot + 0] = 8. CONST 0 pushes 2. MUL pops 2 and 8, pushes 16. RETURN pops the frame, restores the caller\'s ip, and places 16 where the caller expects the result. The caller\'s stack now holds [16]. Total call overhead: 1 frame push, 1 frame pop, 2 ip saves/restores -- no heap allocation, no tree copying.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Robert Nystrom, Crafting Interpreters, chapters 14-24 (bytecode VM from scratch in C): https://craftinginterpreters.com/a-bytecode-virtual-machine.html. Chunks of bytecode: https://craftinginterpreters.com/chunks-of-bytecode.html. The VM execution loop: https://craftinginterpreters.com/a-virtual-machine.html. W3C WebAssembly Core Specification (structured stack machine validation): https://www.w3.org/TR/wasm-core-2/. Shi et al., "Virtual Machine Showdown: Stack Versus Registers" (2008) for quantitative stack-vs-register comparison.',
        'Study next: Stack (the data structure underlying the value stack), Register Virtual Machine: Lua Case Study (the opposite architectural choice), Interpreter Dispatch Table & Threaded Code (how to speed up the dispatch loop), Pratt Parser Expression AST (how the AST that feeds the compiler is built), and WebAssembly Linear Memory Case Study (how Wasm extends the stack VM with linear memory for heap data).',
      ],
    },
  ],
};
