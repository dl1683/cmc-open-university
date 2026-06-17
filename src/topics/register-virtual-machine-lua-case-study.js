// Register virtual machine: encode operands as virtual register indexes instead
// of pushing and popping every intermediate value.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'register-virtual-machine-lua-case-study',
  title: 'Register Virtual Machine: Lua Case Study',
  category: 'Concepts',
  summary: 'A register bytecode VM stores temporaries in virtual registers, trading wider instructions for fewer stack shuffles and better local access.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['register bytecode', 'stack versus register'], defaultValue: 'register bytecode' },
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

function registerGraph(title) {
  return graphState({
    nodes: [
      { id: 'source', label: 'expr', x: 0.8, y: 3.8, note: 'a+b*c' },
      { id: 'alloc', label: 'regs', x: 2.5, y: 3.8, note: 'R0..Rn' },
      { id: 'inst', label: 'op', x: 4.2, y: 2.4, note: 'A,B,C' },
      { id: 'frame', label: 'frame', x: 4.2, y: 5.3, note: 'slots' },
      { id: 'dispatch', label: 'loop', x: 6.1, y: 3.8, note: 'decode' },
      { id: 'locals', label: 'local', x: 7.7, y: 2.4, note: 'same regs' },
      { id: 'call', label: 'call', x: 7.7, y: 5.3, note: 'base' },
      { id: 'result', label: 'R0', x: 9.1, y: 3.8, note: 'answer' },
    ],
    edges: [
      { id: 'e-source-alloc', from: 'source', to: 'alloc' },
      { id: 'e-alloc-inst', from: 'alloc', to: 'inst' },
      { id: 'e-alloc-frame', from: 'alloc', to: 'frame' },
      { id: 'e-inst-dispatch', from: 'inst', to: 'dispatch' },
      { id: 'e-frame-dispatch', from: 'frame', to: 'dispatch' },
      { id: 'e-dispatch-locals', from: 'dispatch', to: 'locals' },
      { id: 'e-dispatch-call', from: 'dispatch', to: 'call' },
      { id: 'e-locals-result', from: 'locals', to: 'result' },
      { id: 'e-call-result', from: 'call', to: 'result' },
    ],
  }, { title });
}

function* registerBytecode() {
  yield {
    state: registerGraph('Register VMs name temporary values explicitly'),
    highlight: { active: ['source', 'alloc', 'inst', 'e-source-alloc', 'e-alloc-inst'], compare: ['frame'] },
    explanation: 'A register VM stores operands and results in numbered virtual registers. Instructions name source and destination slots instead of always using the top of a stack.',
  };
  yield {
    state: labelMatrix(
      'Register bytecode for a + b * c',
      [
        { id: 'i0', label: '0' },
        { id: 'i1', label: '1' },
        { id: 'i2', label: '2' },
        { id: 'i3', label: '3' },
      ],
      [
        { id: 'instruction', label: 'instruction' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['LOAD R1,a', 'local a'],
        ['MUL R2,b,c', 'temp product'],
        ['ADD R0,R1,R2', 'return value'],
        ['RETURN R0', 'finish'],
      ],
    ),
    highlight: { active: ['i1:instruction', 'i2:instruction'], found: ['i3:instruction'], compare: ['i0:instruction'] },
    explanation: 'The product can stay in R2 and the final value in R0. The bytecode is wider than stack bytecode, but it can express the data dependencies directly.',
    invariant: 'A register instruction carries operand indexes; the frame supplies the actual slots.',
  };
  yield {
    state: registerGraph('Lua 5.0 made register bytecode a core design choice'),
    highlight: { active: ['alloc', 'frame', 'dispatch', 'locals'], found: ['result'], compare: ['call'] },
    explanation: 'Lua 5.0 moved to a register-based VM. Local variables and temporaries live in function-frame registers, so many computations avoid repeated push and pop traffic.',
  };
}

function* stackVersusRegister() {
  yield {
    state: labelMatrix(
      'Stack VM versus register VM',
      [
        { id: 'encoding', label: 'instruction size' },
        { id: 'temps', label: 'temporaries' },
        { id: 'dispatch', label: 'dispatch count' },
        { id: 'compiler', label: 'compiler work' },
      ],
      [
        { id: 'stack', label: 'stack VM' },
        { id: 'register', label: 'register VM' },
      ],
      [
        ['small opcodes', 'wider operands'],
        ['implicit top', 'named slots'],
        ['more tiny ops', 'fewer richer ops'],
        ['simple emit', 'slot planning'],
      ],
    ),
    highlight: { active: ['dispatch:stack', 'dispatch:register'], found: ['temps:register'], compare: ['encoding:stack'] },
    explanation: 'Neither design wins everywhere. Stack bytecode is compact and easy to emit. Register bytecode can reduce interpreter dispatch and make local value flow clearer.',
  };
  yield {
    state: registerGraph('Virtual registers are not necessarily hardware registers'),
    highlight: { active: ['alloc', 'frame', 'locals'], compare: ['result'], found: ['dispatch'] },
    explanation: 'VM registers are slots in an interpreter frame. A later JIT may map hot VM registers to CPU registers, but the bytecode design itself is still portable.',
  };
  yield {
    state: registerGraph('Register bytecode connects compiler IR to runtime frames'),
    highlight: { active: ['source', 'alloc', 'inst', 'frame', 'result'], compare: ['call'] },
    explanation: 'Static Single Assignment & Phi Nodes and Linear Scan Register Allocation explain the compile-time version of naming values. A register VM brings a similar idea to portable bytecode.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'register bytecode') yield* registerBytecode();
  else if (view === 'stack versus register') yield* stackVersusRegister();
  else throw new InputError('Pick a register-VM view.');
}

export const article = {
  sections: [
    {
      heading: 'Problem',
      paragraphs: [
        `A bytecode virtual machine needs a portable instruction format and an interpreter loop that can run it cheaply. Every expression creates intermediate values. The VM has to put those values somewhere between the time they are produced and the time the next instruction consumes them. The major design choice is whether those values live on an implicit operand stack or in explicitly named virtual registers inside the current function frame.`,
        `Lua 5.0 is a useful case study because it moved to a register-based bytecode VM while staying small and portable. The word "register" does not mean that every value lives in a hardware CPU register. In Lua bytecode, virtual registers are frame slots. Locals, temporaries, arguments, and return values are placed in those slots, and bytecode instructions name the slots they read and write.`,
      ],
    },
    {
      heading: 'Naive design',
      paragraphs: [
        `The obvious first VM is a stack machine. To compile a + b * c, the compiler emits code that pushes a, pushes b, pushes c, multiplies the top two stack values, then adds the remaining values. Most operands are implicit because every arithmetic instruction consumes and produces values at the top of the stack. That makes instructions small and bytecode emission straightforward.`,
        `This design is not foolish. Stack bytecode is compact, easy to verify, and easy for a simple compiler to generate. It is used in serious runtimes and teaching interpreters because it matches recursive expression compilation nicely. The compiler does not need to assign many temporary names. It can rely on stack order to preserve intermediate values.`,
        `The weakness appears in the interpreter loop. A stack program may need many small operations whose main job is moving values into the right stack positions. Each operation costs dispatch overhead: fetch the opcode, decode it, branch to the handler, update the instruction pointer, and maintain interpreter state. If many bytecodes are pushes, pops, duplicates, and shuffles, the VM is spending time on traffic rather than program work.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is dispatch pressure and hidden value identity. Interpreters pay a fixed overhead for every bytecode even when the operation is tiny. A stack VM can use compact instructions, but it may execute more of them. A register VM uses wider instructions, but one instruction can name several operands and avoid extra stack motion. The tradeoff is instruction width versus instruction count.`,
        `The stack also makes value identity positional. The value "third from the top" is meaningful only because of the exact instruction sequence before it. Humans and optimizing tools can reason about the data flow, but the bytecode itself does not name the temporary. A register bytecode gives that temporary a slot, so the flow is visible in the instruction operands.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is to make the function frame a small array of named slots and let instructions refer to those slots directly. A register instruction carries operand indexes. ADD R0, R1, R2 means read the values in R1 and R2, add them, and store the result in R0. A load instruction can place a local or constant into a slot. A call instruction can use a range of slots for arguments and results.`,
        `This is similar in spirit to compiler intermediate representations that name values, but it stays at bytecode level. The VM register names are not physical registers. They are indexes into an activation record managed by the interpreter. A later JIT compiler may map hot virtual registers to machine registers, but the bytecode itself remains portable and can run in a simple C interpreter.`,
        `The benefit is that local computation becomes direct. If a local value is already in R1, another instruction can read R1 without pushing it again. If a temporary is in R2, it stays there until overwritten. The compiler must plan slot lifetimes, but the interpreter can execute fewer high-level operations for many expression patterns.`,
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        `A register VM has four main pieces: a bytecode format, a frame layout, a compiler that assigns slots, and an interpreter dispatch loop. The bytecode format decides how many operand fields fit in an instruction. Lua-style instructions often carry fields for destination and source slots. The frame layout decides where locals, temporaries, arguments, varargs, and return values live. The compiler maps source-level values to those slots and emits operations that read and write them.`,
        `The interpreter loop fetches an instruction, decodes its opcode and operand fields, uses the current call frame as the register array, performs the operation, and advances. For ADD R0, R1, R2, the handler reads frame[R1] and frame[R2], computes the result using the language's arithmetic semantics, and writes frame[R0]. For a call, a base register and count can identify a contiguous region containing the function and arguments, then the result count determines where returned values land.`,
        `Slot assignment is the compiler-side cost. The compiler has to avoid overwriting a live value too early. It can reuse a temporary slot once the old value is dead. It must preserve locals that remain visible, reserve slots for calls, and handle multiple returns. This is much simpler than global machine-register allocation, but it is still more planning than a basic stack emitter needs.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The invariant is that each source operand names a slot containing the required current value, and each destination operand names a slot that may safely receive the result. The compiler establishes that invariant by assigning slots according to value lifetimes. The interpreter relies on it. It does not infer operands from stack height or recover temporaries from implicit positions. It applies each instruction's effect to the named slots.`,
        `This can reduce dispatch because one instruction expresses a complete data-flow step. A stack VM might need LOAD a, LOAD b, LOAD c, MUL, ADD, RETURN. A register VM can often express the same work as LOAD R1, a; MUL R2, b, c; ADD R0, R1, R2; RETURN R0. The exact counts depend on constants, locals, instruction set, and calling convention, but the direction is clear: explicit operands can combine work that stack bytecode splits apart.`,
        `The design also makes bytecode inspection easier. In a register program, the operands reveal which local or temporary feeds which operation. That helps debuggers, disassemblers, simple optimizers, and humans. The frame slots become the concrete data structure connecting source variables, bytecode operations, and runtime values.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Take the expression a + b * c inside a function. Assume a is already in R1, b is in R3, c is in R4, and the function convention returns the final value in R0. The compiler can emit MUL R2, R3, R4 to compute b * c into temporary slot R2. Then it emits ADD R0, R1, R2 to compute a plus the product. Finally it emits RETURN R0.`,
        `Notice what did not happen. The VM did not push a, push b, push c, pop two values for multiplication, push the product, pop two values for addition, and push the final sum. The temporary product had a stable location. The final result had a stable location. The bytecode was wider because it named R0, R1, R2, R3, and R4, but the number of interpreted operations was small.`,
        `Now consider a function call. A register VM can place the callee and arguments in consecutive slots, then issue a call instruction that names the base slot and counts. The callee receives a new frame or frame window according to the implementation. Return values land back in slots chosen by the caller. This design makes calls fit naturally with locals and temporaries because the same frame array is the shared abstraction.`,
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        `The register-bytecode view begins with a source expression, a register allocation step, an instruction format, and a frame. That chain is the design: compile expressions into operations over frame slots, then let the dispatch loop decode operand fields and manipulate those slots. The example table for a + b * c shows the value flow. The product goes into a temporary register, the final sum goes into the return register, and the return instruction names that slot.`,
        `The Lua frame highlights the historical choice. Lua 5.0 made register bytecode central so locals and temporaries could live in function-frame registers. The animation's call and local nodes show that registers are not only arithmetic temporaries. They are the layout mechanism for local variables, call arguments, and return values.`,
        `The stack-versus-register view is a tradeoff table. Stack bytecode has small instructions and simple emission. Register bytecode has wider operands, clearer value names, fewer tiny dispatches in many cases, and a compiler that must plan slots. The final frame connects this topic to Static Single Assignment and Linear Scan Register Allocation, which teach related ideas at compiler-IR and machine-code levels.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The main cost is bytecode size. Operand fields take bits. If an instruction must name a destination and two sources, the encoding is wider than a one-byte stack opcode. On instruction-cache-sensitive workloads or when bytecode must be transmitted compactly, that width matters. Some register VMs use limited operand ranges or special instruction variants to control size.`,
        `The second cost is compiler complexity. A stack compiler can recursively emit code with little planning. A register compiler needs a slot allocator. It must know when values die, reuse temporaries, avoid clobbering live locals, and keep call conventions efficient. Bugs in slot assignment create wrong-code errors because the interpreter trusts the bytecode operands.`,
        `The third cost is not all programs benefit equally. Simple linear code with few temporaries may not save enough dispatches to offset larger instructions. A sophisticated stack VM with superinstructions, threaded dispatch, or JIT compilation may erase much of the difference. The register-versus-stack decision is about the whole runtime, not one isolated expression.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Register bytecode wins when interpreter dispatch is expensive and programs reuse local values across operations. It is a good fit for small dynamic-language interpreters that want portable bytecode, readable disassembly, and efficient local computation without immediately building a JIT. Lua is the classic example because the implementation values compactness and speed while keeping the runtime embeddable.`,
        `It also wins as a bridge between source compilation and runtime execution. The compiler can express data dependencies directly, the interpreter can read and write frame slots directly, and later optimization stages can reason about named values more easily than about anonymous stack positions. Even when all virtual registers are stored in memory, the explicit names help the VM structure its work.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `A register VM is not automatically faster. Wider instructions can increase bytecode memory, reduce cache locality, and add decode work. If the interpreter has to decode several operand fields for every operation, the savings from fewer dispatches can shrink. If the language has many specialized stack-friendly operations, a stack design may be simpler and just as fast.`,
        `It is also the wrong abstraction when compiler simplicity or bytecode density is the top priority. Educational interpreters, tiny embedded languages, and formats designed for compact transport may prefer stack bytecode. JIT-heavy runtimes may use bytecode mainly as a baseline or profiling format, so the bytecode design interacts with later optimization pipelines rather than deciding performance alone.`,
        `Failure modes include slot lifetime bugs, call-frame layout mistakes, clobbered temporaries, incorrect handling of multiple returns, and confusion between virtual registers and hardware registers. The term "register" can mislead learners. The safe mental model is frame slot first, possible hardware register later.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources include The Implementation of Lua 5.0, Lua bytecode documentation and disassembly resources, V8 Ignition materials for a modern register-style interpreter, and Crafting Interpreters for a clear stack-VM contrast. The important reading question is not which VM is universally better, but where each design spends bytes, dispatches, compiler work, and runtime state.`,
        `Study Bytecode Stack Virtual Machine for the contrast, Interpreter Dispatch Table & Threaded Code for dispatch overhead, Static Single Assignment & Phi Nodes for named intermediate values, Linear Scan Register Allocation for lifetime-based slot reuse, V8 Ignition Bytecode Pipeline for a production interpreter, and WebAssembly Stack Machine for a different portable execution format. Then compile the same expression both ways and count instruction bytes, dispatches, and temporary moves.`,
      ],
    },
  ],
};
