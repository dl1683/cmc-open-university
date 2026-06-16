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
      heading: 'What it is',
      paragraphs: [
        'A register virtual machine executes bytecode whose instructions name virtual registers or frame slots. Instead of pushing every intermediate value onto a stack, the compiler chooses slots such as R0, R1, and R2 and emits operations that read and write those slots.',
        'Lua 5.0 is the classic small-language case study. Its implementation paper highlights the move to a register-based virtual machine as one of the major changes from Lua 4.0.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A function call creates a frame with register slots. Some slots hold locals, some hold temporaries, and some hold call arguments or return values. An instruction such as ADD R0, R1, R2 reads R1 and R2, then stores the result in R0.',
        'The instruction stream is less compact because operands must be encoded, but it may need fewer instructions. A stack VM might need separate pushes and pops around the same computation. A register VM can say directly which values participate.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'For a + b * c, a register compiler can load a into R1, compute b * c into R2, add R1 and R2 into R0, and return R0. The temporary product has a durable name, which makes the instruction sequence easier to inspect and can reduce dispatches.',
        'This does not mean VM registers are CPU registers. They are normally slots in an interpreter frame. If the code becomes hot, a JIT can later map some of those values onto real registers, but the bytecode remains a portable runtime format.',
        'A call frame can reserve a fixed range of slots for the active function. Arguments arrive in the first slots, locals occupy stable positions, and temporaries use additional slots chosen by the compiler. CALL and RETURN then need base indexes and counts rather than copying an arbitrary stack segment.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'The register design asks more of the compiler. It needs a slot plan and must avoid clobbering values too early. That plan is much simpler than full native register allocation, but the conceptual link to Linear Scan Register Allocation is real.',
        'The stack design asks less of the compiler and usually wins on bytecode density. Register bytecode often wins when dispatch overhead dominates and when locals and temporaries are reused across several instructions.',
        'A good register bytecode compiler therefore needs a tiny lifetime model. It should reuse dead temporary slots, preserve locals across calls, and keep the return-value convention simple enough for the interpreter dispatch loop to implement quickly.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: The Implementation of Lua 5.0 PDF at https://www.lua.org/doc/jucs05.pdf, Journal of Universal Computer Science page at https://lib.jucs.org/article/28438/, V8 Ignition docs at https://v8.dev/docs/ignition, and Crafting Interpreters VM chapter at https://craftinginterpreters.com/a-virtual-machine.html. Study Bytecode Stack Virtual Machine, Linear Scan Register Allocation, Interpreter Dispatch Table & Threaded Code, and V8 Ignition Bytecode Pipeline next.',
      ],
    },
  ],
};
