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
      heading: 'How to read the animation',
      paragraphs: [
        'The register-bytecode view traces a Lua expression through compilation and interpretation. Active means the compiler or VM is touching a source value, instruction, or frame slot; visited means a value already has a slot or instruction; found means the result is now in its destination register.',
        'The stack-versus-register view compares where each VM spends cost. The safe inference is that a register instruction names its operands directly, so it can replace several stack shuffling instructions at the price of wider bytecode.',
        {type:'callout', text:'A register VM pays wider bytecode to name frame slots directly, reducing the dispatch work spent on stack shuffling.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An interpreter pays a fixed dispatch cost for every bytecode instruction. Fetching an opcode, decoding it, branching to the handler, and advancing the instruction pointer costs time even when the instruction only moves a value.',
        'Lua moved to a register-based VM in version 5.0 to reduce the number of interpreted instructions. The goal was faster portable interpretation without requiring a just-in-time compiler.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious VM design is a stack machine. To compute a + b * c, the compiler emits operations that push operands, multiply the top two values, then add the next two values.',
        'This design is good for compact bytecode and simple compilers. The JVM, WebAssembly, and many teaching interpreters use stack bytecode because stack depth is easy to emit and verify.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is dispatch count. A stack VM may spend several bytecodes moving operands into position before one arithmetic operation happens.',
        'The second wall is hidden value identity. A temporary is named by its position on the stack, so understanding or optimizing the code requires simulating the stack state.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make a function frame a flat array of numbered slots. Each instruction names the slots it reads and the slot it writes, so data dependencies are explicit in the bytecode.',
        'These virtual registers are not hardware registers. R0 means a frame slot in memory, and a later implementation may or may not map that slot to a CPU register.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Lua 5.0 packs each instruction into a 32-bit word. A 6-bit opcode selects the operation, and operand fields name destination and source slots or constants.',
        'For arithmetic, an instruction such as ADD A B C stores RK(B) plus RK(C) into R(A). RK means the operand field can name either a register or a constant table entry.',
        'Function calls use consecutive frame slots. The caller places the function and arguments in a window of the stack, and the callee sees that window as its own register frame.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The compiler maintains the invariant that every operand field names a slot containing the required value. It also ensures the destination slot can be overwritten because the old value is dead or intentionally replaced.',
        'This invariant lets one instruction express a full data-flow step. Instead of pushing b, pushing c, multiplying, and then using a stack result, the register VM can write MUL R3, R1, R2.',
        'Correct call behavior follows from the frame-window invariant. Arguments occupy consecutive slots at the call site, and the callee base pointer reinterprets those slots as its local registers.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost trade is fewer dispatches and larger instructions. Shi, Casey, Ertl, and Gregg measured about 47 percent fewer executed instructions and about 25 percent larger bytecode when translating stack code to register form.',
        'In a pure interpreter, fewer dispatches can beat larger bytecode because dispatch branches and opcode fetches dominate small operations. In a JIT-heavy runtime, the bytecode format matters less because hot code becomes native code.',
        'The compiler cost is slot lifetime tracking. Lua keeps this simple with up to 256 registers per function, so most functions can allocate locals and temporaries without hard register-allocation machinery.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Lua is the canonical register-VM case because it is small, portable, and embedded in games, network equipment, tools, and applications. The register VM improves interpreted performance while keeping the implementation compact.',
        'Android Dalvik also used register bytecode for mobile interpretation before ART became the dominant execution path. Register-style intermediate forms also appear inside JIT compilers because explicit value names help optimization.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Register bytecode fails as a universal answer. Stack bytecode can be smaller, easier to verify, easier to teach, and better for network-transmitted formats such as WebAssembly.',
        'It also adds compiler bug surface. Reusing a slot too early, misplacing call arguments, mishandling variable returns, or closing upvalues incorrectly can produce silent wrong results.',
        'The word register can mislead performance intuition. Virtual registers live in memory frame slots unless a later compiler maps them to hardware registers.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume a=10 in R0, b=3 in R1, c=5 in R2, and R3 is a temporary. The expression a + b * c can compile to MUL R3, R1, R2 followed by ADD R3, R0, R3 and RETURN R3.',
        'After MUL, R3 holds 15. After ADD, R3 holds 25, so the return reads the result directly from the named slot.',
        'A stack VM might execute GETLOCAL a, GETLOCAL b, GETLOCAL c, MUL, ADD, and RETURN. That is six dispatches instead of three or four, even though the mathematical work is the same.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Roberto Ierusalimschy, Luiz Henrique de Figueiredo, and Waldemar Celes, The Implementation of Lua 5.0; Shi, Casey, Ertl, and Gregg, Virtual Machine Showdown; and Lua 5.0.3 source files lopcodes.h and lvm.c. These sources define the bytecode format, frame model, closure handling, and measured tradeoff.',
        'Study Bytecode Stack Virtual Machine, Interpreter Dispatch Table, Threaded Code, Static Single Assignment, Linear Scan Register Allocation, V8 Ignition Bytecode Pipeline, and WebAssembly Stack Machine. The transfer lesson is to count dispatches, bytes, compiler work, and runtime state separately.',
      ],
    },
  ],
};
