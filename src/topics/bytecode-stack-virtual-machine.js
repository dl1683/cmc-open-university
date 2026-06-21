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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/bytecode-stack-virtual-machine.gif', alt: 'Animated walkthrough of the bytecode stack virtual machine visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A tree-walking interpreter is a good first implementation because it keeps language semantics close to the parser. The runtime recursively evaluates AST nodes: visit this binary expression, evaluate the left child, evaluate the right child, apply the operator, and return. That is clear, but it pays for source-tree shape on every execution.',
        {
          type: 'callout',
          text: 'A stack VM makes execution explicit by replacing recursive syntax walking with a compact instruction stream and a visible value stack.',
        },
        'A bytecode stack VM exists as a middle layer between tree walking and native code generation. The compiler lowers the AST into compact instructions. The runtime executes those instructions with an instruction pointer, value stack, constant pool, dispatch loop, and call frames. The language stops being a recursive walk over syntax and becomes a small machine with explicit state.',
        'This is why bytecode appears in teaching languages, scripting runtimes, portable sandboxes, database expression engines, and early tiers of larger VMs. It is much easier to build than a native compiler, but it gives the implementation more control than evaluating the AST directly.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious first interpreter walks the AST directly: evaluate the left child, evaluate the right child, combine them, recurse into statements, and use host-language calls to model language calls. That is perfect for learning parsing and semantics because every evaluator branch mirrors a grammar rule.',
        'The wall is runtime overhead and control. The AST stores syntax, not an execution schedule. It has many heap objects, many pointers, and many recursive function calls. It is harder to disassemble, harder to serialize, harder to validate compactly, and harder to run inside a VM loop with predictable state.',
        'Native code is the other obvious answer. It can be very fast, but it requires machine-code generation, register allocation, calling conventions, executable memory, debugging tools, and target-specific safety boundaries. Bytecode is the pragmatic middle: compile once to a portable instruction stream, then interpret or later JIT from that instruction stream.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A stack VM makes temporary values implicit. Each opcode has a stack effect: how many values it pops, what it computes, and how many values it pushes. CONST pushes a constant. ADD pops two values and pushes their sum. RETURN pops a result and returns it to the caller.',
        'Because the stack carries intermediate values, instructions can be tiny. The bytecode for 1 + 2 * 3 can be CONST 1, CONST 2, CONST 3, MUL, ADD. The compiler emits the expression in evaluation order, and the stack shape records the temporary results.',
        'The VM state is small but powerful: instruction pointer for control, bytecode chunk for instructions, constant pool for literals, value stack for operands and temporaries, and call frames for function calls. Once you can name those pieces, most interpreter behavior becomes inspectable.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:NY1BCsIwEEX3OcVcoFcQ2jQVwVUVN0MWIUZSGmZCMkG8vRDr6sH7D_4r8dtHVwSuqxpxvN0tDMMJJpw-Ejw_A_jYaLdq6l7jhaqU5mVjgswbSSj_cUbNVMWRQGZOVumuDc5bzU58hMScrVrw4VILUMX5_fdnlOlcDp5xDbUlAaYj-wI',
          alt: 'Stack virtual machine state: AST compiles to bytecode, instruction pointer enters dispatch loop, and the value stack carries results.',
          caption: 'The bytecode VM is a small state machine: bytecode and constants feed dispatch, while the value stack carries intermediate results. Source: https://mermaid.ink/svg/pako:NY1BCsIwEEX3OcVcoFcQ2jQVwVUVN0MWIUZSGmZCMkG8vRDr6sH7D_4r8dtHVwSuqxpxvN0tDMMJJpw-Ejw_A_jYaLdq6l7jhaqU5mVjgswbSSj_cUbNVMWRQGZOVumuDc5bzU58hMScrVrw4VILUMX5_fdnlOlcDp5xDbUlAaYj-wI',
        },
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The stack-bytecode view shows source syntax being turned into a bytecode chunk plus a constant table. The important transition is from tree shape to instruction sequence. The AST explains where the program came from; the bytecode explains what the VM will do next.',
        'The instruction-pointer view shows the interpreter loop. It reads the next opcode, advances the instruction pointer, runs the handler, mutates the stack, and repeats. Correctness depends on each opcode leaving the stack in the shape the next instruction expects.',
        'The frames-and-calls view shows why the value stack is not just an arithmetic scratchpad. Function calls need return addresses, base slots, local variables, arguments, and results. A call frame gives each invocation a window over the shared stack instead of copying a separate stack for every call.',
      ],
    },
    {
      heading: 'How the interpreter loop works',
      paragraphs: [
        'A bytecode chunk is usually an array of opcodes and operands. The VM keeps an instruction pointer, often an index into that array. The dispatch loop reads bytecode[ip], increments ip, and jumps to the handler for that opcode. The handler may read operands, push constants, perform arithmetic, branch by changing ip, or call another function.',
        'The constant pool keeps instructions compact. Instead of embedding a whole string or number inside the instruction stream, the bytecode can say CONST 7, meaning "push constants[7]." This keeps the code dense and lets literals be shared or inspected separately.',
        'A useful implementation tracks stack effects. If ADD needs two operands and only one is present, the program or compiler is wrong. If a conditional jump leaves an unexpected value behind, later instructions may break. Stack-depth validation, disassembly, and trace mode are not luxuries; they are how VM bugs become understandable.',
      ],
    },
    {
      heading: 'How calls and frames work',
      paragraphs: [
        'A function call needs more state than an arithmetic opcode. The VM must remember which function is running, where to resume the caller, where this call\'s locals begin on the value stack, and how many arguments and temporary slots belong to the callee.',
        'A call frame stores that state. When a function is called, the VM pushes a new frame with a return instruction pointer and a base slot. The callee reads locals relative to that base slot. When it returns, the VM removes the frame, restores the caller instruction pointer, and leaves the return value where the caller expects it.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:TY5NCsIwEEb3OcVcoFcQklp_Vkp1N2QxhKmCkwQyib2-NCK4fe_j8S2S1_CkUuHujMWRRLjAUiiyh2HYgcOZaysJzldvbEcjOlIGlVx_aI-2PFrkVNWb6Zvh_8wBL2sCyYFkW3R2xBtFhjdJY9BK4eWN6-aEM2uLDKH_8R8',
          alt: 'Caller and callee frames sharing one value stack with return instruction pointer, base slot, arguments, and locals.',
          caption: 'Call frames let each invocation keep return state and local slots while sharing one physical value stack. Source: https://mermaid.ink/svg/pako:TY5NCsIwEEb3OcVcoFcQklp_Vkp1N2QxhKmCkwQyib2-NCK4fe_j8S2S1_CkUuHujMWRRLjAUiiyh2HYgcOZaysJzldvbEcjOlIGlVx_aI-2PFrkVNWb6Zvh_8wBL2sCyYFkW3R2xBtFhjdJY9BK4eWN6-aEM2uLDKH_8R8',
        },
        'This makes recursion possible. Each recursive call has its own frame and local window, but all calls share one physical value stack. The stack grows and shrinks with call depth rather than copying all state at each call.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take the expression 1 + 2 * 3. The parser builds an AST where multiplication is nested under addition. The compiler emits code in postorder: push 1, push 2, push 3, multiply, add. After the first three instructions, the stack is [1, 2, 3]. MUL pops 3 and 2, pushes 6, and leaves [1, 6]. ADD pops 6 and 1, pushes 7, and leaves [7].',
        'Now add a function call such as square(4 + 1). The compiler emits instructions to push the callee, push arguments, compute 4 + 1, and call. The call instruction creates a frame for square. Inside square, local slot 0 may hold the argument. The return instruction places the result back into the caller\'s stack window.',
        'This example is small, but it contains the whole VM contract. The compiler must emit instructions whose stack effects line up. The interpreter must advance the instruction pointer correctly. The frame machinery must restore the caller exactly. A bug in any one of those pieces becomes a wrong stack shape.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Stack bytecode works because it separates language semantics from host-language recursion. The compiler commits to a compact instruction sequence. The VM owns execution state. That makes programs easier to serialize, disassemble, inspect, and run across platforms.',
        'It also works because the stack is a simple compiler target. The compiler does not need to allocate registers for every temporary. It emits instructions in an order that naturally consumes subexpression results. This is why many educational compilers and portable VMs start with stack bytecode.',
        'Finally, the model gives later optimization tiers a stable input. A production runtime may interpret bytecode first, collect profiles, compile hot paths into native code, or lower bytecode into a richer intermediate representation. The bytecode layer becomes the portable contract beneath those choices.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The main cost is dispatch overhead. Every opcode requires the interpreter to read, decode, and jump to a handler. Direct-threaded dispatch, computed goto, inline caches, superinstructions, and JIT compilation all try to reduce that cost.',
        'The second cost is stack traffic. A register VM can name temporary slots directly, often using fewer instructions for the same work. Stack bytecode is compact and easy to emit, but it may need more push, pop, dup, and shuffle operations.',
        'The behavior is still much better than a naive tree walk for many languages. Bytecode is dense, sequential, cache-friendly, and independent of source syntax objects. It gives the runtime one loop to optimize instead of thousands of recursive AST visits.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'A stack VM wins for teaching compilers, small languages, embedded scripting, portable runtimes, sandboxed formats, database expressions, rules engines, and first-tier execution in larger systems. It is a good fit when implementation simplicity and portability matter more than peak speed.',
        'It also wins when validation matters. Because every opcode has a stack effect, a verifier can check maximum stack depth, underflow, jump targets, and some type constraints before execution. WebAssembly uses a structured stack-machine model partly because validation and portability are central to the format.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A stack VM fails when dispatch overhead dominates or when explicit dataflow matters for optimization. Register VMs such as Lua-style designs use larger instructions but can reduce stack movement. Native compilers can use real registers, instruction scheduling, and CPU-specific optimizations.',
        'It also fails when tooling is weak. Without a disassembler, trace mode, frame inspector, stack-effect checker, and clear error reporting, compiler bugs become mysterious runtime crashes. A VM is not only an instruction loop; it is an observability surface for a language implementation.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Remember the machine state: bytecode chunk, constant pool, instruction pointer, value stack, call frames. Those five pieces explain most simple VM behavior.',
        'Remember the invariant: every instruction has a stack effect. If the compiler and interpreter agree on those effects, the program flows. If they disagree, the VM eventually reads the wrong value as the wrong thing.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Crafting Interpreters bytecode VM at https://craftinginterpreters.com/a-bytecode-virtual-machine.html, chunks of bytecode at https://craftinginterpreters.com/chunks-of-bytecode.html, VM execution loop at https://craftinginterpreters.com/a-virtual-machine.html, and W3C WebAssembly Core Specification at https://www.w3.org/TR/wasm-core-2/. Study Pratt Parser Expression AST, Stack, Register Virtual Machine: Lua Case Study, Interpreter Dispatch Table & Threaded Code, and WebAssembly Linear Memory Case Study next.',
      ],
    },
  ],
};
