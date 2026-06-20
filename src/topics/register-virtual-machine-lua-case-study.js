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
        'The register-bytecode view traces how a source expression compiles into numbered frame slots and three-address instructions. Active nodes show the current compilation or execution stage. Found nodes are values that have reached their final register. Compare nodes mark the alternative path (function calls versus local arithmetic).',
        {
          type: 'diagram',
          text: [
            'Register bytecode pipeline:',
            '',
            '  source expr --> register alloc --> instruction emit --> frame layout',
            '       |                                                      |',
            '       v                                                      v',
            '  a + b * c     R0=result, R1=a, R2=temp     MUL R2,b,c   [R0|R1|R2|R3|R4]',
            '                                              ADD R0,R1,R2',
            '                                              RETURN R0',
          ].join('\n'),
          label: 'Each instruction names its source and destination slots explicitly',
        },
        'The stack-versus-register view is a tradeoff matrix. Active cells highlight the key differentiator (dispatch count). Compare cells show where the stack design has an advantage (instruction size). At each frame, ask: where does this design spend its cost -- in bytes per instruction, or in instructions per expression?',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Every bytecode interpreter pays a fixed cost per instruction dispatched: fetch the opcode, decode it, branch to the handler, update the instruction pointer. That dispatch overhead is the same whether the instruction does real arithmetic or merely shuffles a value into position on the operand stack. When half your bytecodes are pushes, pops, duplicates, and swaps, the interpreter is spending cycles on bookkeeping, not computation.',
        {
          type: 'quote',
          text: 'The main advantage of a register-based machine is that it avoids many push and pop instructions that a stack-based machine needs. These push and pop instructions are expensive because they involve increments, decrements, and indirect addressing of stack pointers.',
          attribution: 'Ierusalimschy, de Figueiredo, Celes -- The Implementation of Lua 5.0 (JUCS, 2005)',
        },
        'Lua 1.0 through 4.0 used a stack-based VM. When the Lua team redesigned for version 5.0 (released April 2003), they moved to a register-based VM -- the first widely adopted scripting language to do so. The goal was not to invent a new theory. It was to reduce the number of interpreted instructions for typical Lua programs while keeping the implementation small and portable.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first VM design is a stack machine. To compile a + b * c, the compiler emits: push a, push b, push c, MUL, ADD. Every arithmetic instruction implicitly reads its operands from the top of the stack and pushes the result back. The compiler never names a temporary -- it relies on stack depth to track where values live.',
        'This is not a bad design. The JVM, CLR, CPython, WebAssembly, and Forth all use stack bytecode. The advantages are real:',
        {
          type: 'table',
          headers: ['Property', 'Stack VM advantage'],
          rows: [
            ['Instruction size', 'Most opcodes are 1 byte -- no operand fields needed'],
            ['Compiler complexity', 'Recursive descent emits code in a single pass with no register planning'],
            ['Verification', 'Stack depth is checkable by simple simulation'],
            ['Portability', 'No assumption about register count or hardware layout'],
          ],
        },
        'Stack bytecode is compact, easy to emit, and easy to reason about. The JVM and WebAssembly chose it deliberately, and both are successful. The question is not whether stack VMs work -- they do. The question is what they cost at the interpreter dispatch level.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is dispatch count. Shi, Casey, Ertl, and Gregg measured this directly in their 2005 paper "Virtual Machine Showdown: Stack vs Registers" (VEE 2005). They translated JVM stack bytecode into register format and found:',
        {
          type: 'table',
          headers: ['Metric', 'Stack bytecode', 'Register bytecode', 'Change'],
          rows: [
            ['Instructions executed', 'Baseline', '47% fewer', 'Nearly half eliminated'],
            ['Bytecode size', 'Baseline', '25% larger', 'Wider instructions'],
            ['Execution time (switch dispatch)', 'Baseline', '32.3% faster', 'Fewer dispatches wins'],
            ['Execution time (threaded dispatch)', 'Baseline', '26.5% faster', 'Smaller margin, still clear'],
          ],
        },
        {
          type: 'note',
          text: 'The 47% dispatch reduction outweighs the 25% code size increase because interpreter dispatch is the dominant cost. Each dispatch involves a branch (often mispredicted), a memory access for the next opcode, and pipeline stalls. Eliminating nearly half these dispatches saves more time than the wider instructions cost in cache pressure.',
        },
        'The second wall is hidden value identity. In stack bytecode, a temporary is "the value third from the top." That name is positional -- it depends on the exact instruction sequence before it. If you insert an instruction that pushes an extra value, every positional reference shifts. A register bytecode names the temporary R2, and R2 stays R2 regardless of surrounding code. This makes optimization, debugging, and disassembly substantially easier.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make the function frame a flat array of numbered slots. Let every instruction name the slots it reads and the slot it writes. One instruction, ADD R0, R1, R2, replaces three stack operations (push, push, add) because it carries its data dependencies in the operand fields.',
        {
          type: 'diagram',
          text: [
            'Stack VM for a + b * c:          Register VM for a + b * c:',
            '',
            '  PUSH a       -- 6 dispatches     LOADK  R1, a    -- 3 dispatches',
            '  PUSH b                            MUL    R2, b, c',
            '  PUSH c                            ADD    R0, R1, R2',
            '  MUL',
            '  ADD',
            '  RETURN                            RETURN R0       -- 4 total',
            '',
            'Stack: 6 instructions, narrow      Register: 4 instructions, wide',
          ].join('\n'),
          label: 'Fewer dispatches, wider instructions -- the fundamental tradeoff',
        },
        'The word "register" is misleading. These are not hardware CPU registers. They are indexes into an array stored in memory. R0 means frame[0], R1 means frame[1]. The interpreter accesses them with ordinary memory reads and writes. A later JIT compiler may promote hot virtual registers to physical registers, but the bytecode itself is fully portable.',
        {
          type: 'note',
          text: 'Lua allows up to 256 registers per function (the A field is 8 bits). This is far more than any real function needs, so register allocation is trivially simple -- the compiler assigns each local variable and temporary the next available slot. No graph coloring, no spilling, no live-range analysis. This is why Lua can use a register VM while keeping its compiler tiny.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Lua 5.0 packs every instruction into a single 32-bit word. The layout:',
        {
          type: 'code',
          language: 'text',
          text: [
            'Lua 5.0 instruction word (32 bits):',
            '',
            '  MSB                                                    LSB',
            '  +--------+---------+---------+--------+',
            '  |  A (8) |  B (9)  |  C (9)  | OP (6) |',
            '  +--------+---------+---------+--------+',
            '  bits 24-31  bits 15-23  bits 6-14   bits 0-5',
            '',
            'Three instruction formats:',
            '  iABC  -- opcode + A + B + C    (most instructions)',
            '  iABx  -- opcode + A + Bx(18)   (LOADK, CLOSURE, globals)',
            '  iAsBx -- opcode + A + sBx(18)  (JMP, FORLOOP)',
            '',
            'RK encoding: B and C have 9 bits each. If bit 8 is set,',
            'the field indexes the constant table. If clear, it indexes',
            'a register. This lets ADD R0, R1, 3.14 use one instruction.',
          ].join('\n'),
          label: 'From lopcodes.h in Lua 5.0.3 source',
        },
        'Lua 5.0 defines 35 opcodes. The 6-bit opcode field allows 64, leaving room for future expansion. The B and C fields get 9 bits each (vs. 8 for A) because they need the extra bit for the RK encoding that distinguishes "read from register" from "read from constant table." A always names a destination register, so 8 bits (256 slots) suffices.',
        {
          type: 'table',
          headers: ['Instruction', 'Format', 'Semantics'],
          rows: [
            ['LOADK A Bx', 'iABx', 'R(A) := Constants[Bx]'],
            ['ADD A B C', 'iABC', 'R(A) := RK(B) + RK(C)'],
            ['MUL A B C', 'iABC', 'R(A) := RK(B) * RK(C)'],
            ['MOVE A B', 'iABC', 'R(A) := R(B)'],
            ['CALL A B C', 'iABC', 'R(A)..R(A+C-2) := R(A)(R(A+1)..R(A+B-1))'],
            ['RETURN A B', 'iABC', 'return R(A)..R(A+B-2)'],
          ],
        },
        'The interpreter loop is a C switch over the 6-bit opcode. Each case extracts A, B, C from the 32-bit word with bit shifts, operates on the frame array, and advances the instruction pointer. For ADD, the handler is roughly:',
        {
          type: 'code',
          language: 'c',
          text: [
            'case OP_ADD: {',
            '  TValue *ra = R(A);       // &frame[A]',
            '  TValue *rb = RKB(inst);   // register or constant',
            '  TValue *rc = RKC(inst);   // register or constant',
            '  setnvalue(ra, nvalue(rb) + nvalue(rc));',
            '  break;',
            '}',
          ].join('\n'),
          label: 'Simplified from lvm.c in Lua 5.0 -- one dispatch does the full operation',
        },
      ],
    },
    {
      heading: 'The register window',
      paragraphs: [
        'Lua uses a single contiguous stack shared by all active function calls. Each function gets a window into this stack, identified by a base pointer. The called function\'s R(0) is the caller\'s R(A) -- the slot where the function object lived.',
        {
          type: 'diagram',
          text: [
            'Shared stack during a call:',
            '',
            '  Caller frame                    Callee frame',
            '  |                               |',
            '  v                               v',
            '  [R0|R1|R2|R3|func|arg1|arg2|...|R0|R1|R2|...]',
            '               ^                  ^',
            '               |                  |',
            '        CALL A B C          base = old R(A)',
            '        A=3, B=3, C=2       callee sees its own R(0)..R(n)',
            '',
            'No argument copying. The caller evaluates arguments into',
            'consecutive slots, and those same slots become the callee\'s',
            'parameter registers.',
          ].join('\n'),
          label: 'Register windows eliminate argument copying at call boundaries',
        },
        'CALL A B C places the function at R(A) and arguments at R(A+1) through R(A+B-1). The callee sees these as its own R(0), R(1), and so on. Return values are written back starting at the caller\'s R(A). The B and C fields encode counts, with 0 as a sentinel meaning "variable length" -- used when chaining multiple returns like f(g()).',
        {
          type: 'note',
          text: 'This design resembles SPARC hardware register windows, but in software. The compiler controls the window size per function (declared in the function prototype as maxstacksize). The VM allocates exactly that many slots when the function is called.',
        },
      ],
    },
    {
      heading: 'Flat closures and upvalues',
      paragraphs: [
        'Earlier Lua versions linked closures in deep chains -- accessing a variable from two scopes out required following two pointers. Lua 5.0 introduced flat closures, where every closure carries a flat array of upvalue references regardless of nesting depth.',
        'An upvalue is a pointer to a captured variable. It exists in two states:',
        {
          type: 'bullets',
          items: [
            'Open: the upvalue points directly to a register slot in the owning function\'s still-active frame. Reading the upvalue reads the live slot.',
            'Closed: when the owning function returns, the VM copies the value out of the stack slot into the upvalue object itself and redirects the pointer. The variable now lives on the heap.',
          ],
        },
        {
          type: 'code',
          language: 'text',
          text: [
            'Upvalue lifecycle:',
            '',
            '  function outer()',
            '    local x = 10            -- x lives in outer\'s R(0)',
            '    return function()       -- CLOSURE creates inner',
            '      return x + 1          -- GETUPVAL reads upval #0',
            '    end',
            '  end',
            '',
            '  While outer() runs:       upval.v --> &outer_frame[0]  (open)',
            '  After outer() returns:    upval.v --> &upval.value     (closed)',
            '                            upval.value = 10',
          ].join('\n'),
          label: 'The open/closed transition happens in luaF_close when the stack frame is destroyed',
        },
        'A linked list of open upvalues per thread (sorted by stack level) ensures that two closures capturing the same variable share one upvalue object. The CLOSURE instruction is followed by pseudo-instructions (MOVE or GETUPVAL) that tell the VM how to initialize each upvalue: MOVE creates a new upvalue pointing to a local in the current frame; GETUPVAL reuses an upvalue from the enclosing closure. This flat access pattern integrates cleanly with the register architecture -- upvalue access is just an indirection through the upvalue array rather than a chain walk.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant: each source operand field names a slot that contains the value the instruction requires, and each destination field names a slot that can safely receive the result. The compiler establishes this invariant by assigning slots according to value lifetimes. The interpreter trusts it unconditionally.',
        'This invariant enables dispatch reduction because one three-address instruction expresses a complete data-flow step. Where a stack VM emits PUSH, PUSH, MUL, PUSH, ADD (5 dispatches), a register VM emits MUL R2, R3, R4; ADD R0, R1, R2 (2 dispatches). Each dispatch involves a branch, a memory fetch, and often a branch misprediction. Cutting dispatches by 47% (per Shi et al.) translates directly to execution time savings.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Stack bytecode for a + b * c:       Register bytecode:',
            '',
            '  0: GETLOCAL 0   -- push a          0: MUL  R2, R1, R3',
            '  1: GETLOCAL 1   -- push b          1: ADD  R0, R0, R2',
            '  2: GETLOCAL 2   -- push c          2: RETURN R0',
            '  3: MUL          -- pop 2, push',
            '  4: ADD          -- pop 2, push',
            '  5: RETURN',
            '',
            'Stack: 6 dispatches, 6 bytes        Register: 3 dispatches, 12 bytes',
            'More instructions, less bytes.       Fewer instructions, more bytes.',
          ].join('\n'),
          label: 'The register version executes half the dispatches at the cost of wider instructions',
        },
        'The bytecode is also self-documenting. In the register version, you can see that R1 feeds the addition and R3 feeds the multiplication without simulating the stack. Debuggers, disassemblers, and simple optimizers benefit from this explicit data flow.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Compile and execute local result = a + b * c in Lua 5.0. Assume locals a, b, c are already in R0, R1, R2 and the function has allocated R3 as a temporary.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Source:  local result = a + b * c',
            '',
            'Bytecode (4 instructions):',
            '  [0] MUL    R3, R1, R2     -- R3 = b * c',
            '  [1] ADD    R3, R0, R3     -- R3 = a + R3  (reuse temp)',
            '  [2] MOVE   R4, R3         -- result = R3  (result lives in R4)',
            '  [3] RETURN R4, 2          -- return 1 value from R4',
            '',
            'Frame state after each instruction:',
            '  Start:  [a=10 | b=3 | c=5 | ?  | ?  ]',
            '  [0]:    [a=10 | b=3 | c=5 | 15 | ?  ]   R3 = 3*5',
            '  [1]:    [a=10 | b=3 | c=5 | 25 | ?  ]   R3 = 10+15',
            '  [2]:    [a=10 | b=3 | c=5 | 25 | 25 ]   R4 = R3',
            '  [3]:    return 25',
          ].join('\n'),
          label: 'Each instruction reads and writes named slots -- no stack pointer movement',
        },
        'Compare the same expression on a stack VM:',
        {
          type: 'code',
          language: 'text',
          text: [
            'Stack bytecode (7 instructions):',
            '  [0] GETLOCAL 0   stack: [a]',
            '  [1] GETLOCAL 1   stack: [a, b]',
            '  [2] GETLOCAL 2   stack: [a, b, c]',
            '  [3] MUL          stack: [a, b*c]',
            '  [4] ADD          stack: [a+b*c]',
            '  [5] SETLOCAL 3   stack: []           result = top',
            '  [6] GETLOCAL 3   stack: [result]',
            '  [7] RETURN       stack: []',
            '',
            '8 dispatches vs 4. The stack version spends 3 dispatches',
            'just copying locals onto the stack and 1 copying back.',
          ].join('\n'),
          label: 'Stack VM pays per-value dispatch tax for every operand',
        },
        'Now consider a function call: f(a, b). The caller evaluates f into R5, a into R6, b into R7, then emits CALL 5, 3, 2. The VM slides the base pointer so the callee sees R5 as its function slot and R6, R7 as its first two parameter registers. No values are copied. When the callee returns, return values land back in the caller\'s R5 onward.',
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        'The register-bytecode view traces the pipeline from source expression to frame layout. The graph shows the design: the compiler allocates register slots, emits three-address instructions, and the dispatch loop reads operand fields to manipulate frame slots directly. The matrix shows the bytecode for a + b * c -- MUL and ADD as the active computation, RETURN as the found result, LOAD as the setup.',
        'The Lua frame node highlights that registers are not only arithmetic temporaries. They are the layout mechanism for local variables (same registers), function call arguments (consecutive slots), and return values (placed at the call site). The call node and local node share the same frame array.',
        'The stack-versus-register view shows the fundamental tradeoff. Compare the dispatch row: stack VMs emit more tiny operations, register VMs emit fewer rich operations. Compare the encoding row: stack instructions are small, register instructions carry operand addresses. The compiler-work row shows the real cost to the language implementer: a register compiler must plan slot lifetimes, while a stack compiler can emit code as it parses.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost dimension', 'Register VM', 'Stack VM'],
          rows: [
            ['Instruction size', '4 bytes fixed (Lua)', '1-3 bytes typical'],
            ['Instructions per expression', 'Fewer (2-4 for a+b*c)', 'More (6-8 for a+b*c)'],
            ['Bytecode total size', '~25% larger (Shi et al.)', 'Baseline'],
            ['Dispatches executed', '~47% fewer (Shi et al.)', 'Baseline'],
            ['Execution time', '~30% faster interpreted', 'Baseline'],
            ['Compiler complexity', 'Slot lifetime tracking', 'Recursive emit, no planning'],
            ['Max registers per function', '256 (Lua, 8-bit A field)', 'Stack depth limited by memory'],
          ],
        },
        'Bytecode size increases because each instruction carries operand fields. In Lua, every instruction is 4 bytes regardless of complexity. A stack VM can use 1-byte opcodes for most operations. But total program size grows only 25%, not 300%, because far fewer instructions are emitted.',
        'The compiler must track which slots are alive. If a temporary in R2 is still needed when the compiler wants to emit another instruction that writes R2, it must pick a different slot. In Lua, this is simple because 256 slots is far more than any function needs -- the compiler just increments a counter. There is no graph coloring, no spilling, no NP-hard allocation problem. The cost is real but modest.',
        {
          type: 'note',
          text: 'Not all programs benefit equally. Short straight-line code with few temporaries may not save enough dispatches to notice. A JIT-compiled stack VM (like V8 before Ignition, or modern Wasm engines) compiles to native code anyway, making the bytecode format a profiling artifact rather than the execution format. The register-vs-stack choice matters most for pure interpreters.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Register bytecode wins when interpreter dispatch is the dominant cost and programs reuse local values across operations. The concrete cases:',
        {
          type: 'table',
          headers: ['System', 'Year', 'Why register bytecode'],
          rows: [
            ['Lua 5.0+', '2003', 'Embeddable scripting VM -- must be fast without a JIT, under 200 KB total'],
            ['Android Dalvik', '2008', 'Mobile interpreter before ART -- battery life demands fewer dispatches'],
            ['LuaJIT 2 IR', '2009', 'Trace compiler uses register-based IR to map hot paths to machine registers'],
            ['Parrot VM', '2007', 'Perl 6 VM with four typed register files (int, num, string, PMC)'],
          ],
        },
        'Lua is the canonical example because the implementation is tiny (~25,000 lines of C), fully portable, and designed to be embedded in C/C++ applications (game engines, network equipment, embedded systems). The register VM lets Lua run numerical code at competitive interpreted speed without the complexity of a JIT compiler. Hundreds of millions of devices run Lua bytecode in game engines (World of Warcraft, Roblox), network appliances (Cisco, Juniper), and embedded systems.',
        'Dalvik adopted register bytecode for similar reasons: on 2008-era mobile hardware, interpreter dispatch was expensive, battery life mattered, and the ART ahead-of-time compiler did not exist yet. When ART replaced Dalvik in Android 5.0, the bytecode format persisted -- .dex files still use register encoding.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A register VM is not automatically faster. The JVM uses stack bytecode and has been one of the fastest managed runtimes for decades -- because it JIT-compiles to native code, making the bytecode format nearly irrelevant to steady-state performance. WebAssembly uses stack bytecode deliberately because it compresses well for network transmission and validates quickly with a single-pass type checker.',
        {
          type: 'table',
          headers: ['Scenario', 'Why register bytecode loses'],
          rows: [
            ['JIT-heavy runtimes', 'Bytecode is a profiling format, not the execution format -- JIT erases the dispatch cost'],
            ['Network-transmitted code', 'Wider instructions compress worse; WebAssembly chose stack for this reason'],
            ['Educational interpreters', 'Stack VMs are simpler to implement and teach; register allocation adds complexity'],
            ['Verification-critical formats', 'Stack depth is simpler to verify than register lifetime correctness'],
            ['Languages with many 0-operand ops', 'Stack-native operations (dup, swap, rot) do not benefit from operand naming'],
          ],
        },
        'Common implementation bugs in register VMs:',
        {
          type: 'bullets',
          items: [
            'Slot lifetime errors: the compiler reuses a register before the old value is dead, producing silent wrong results.',
            'Call-frame layout mistakes: arguments placed in wrong slots, off-by-one in base pointer sliding.',
            'Multiple-return mishandling: the 0 sentinel (meaning "variable count") must propagate correctly through CALL and RETURN chains.',
            'Upvalue closing bugs: failing to close upvalues when a scope exits leaves dangling pointers to dead stack slots.',
            'Name confusion: treating virtual registers as hardware registers leads to false assumptions about performance.',
          ],
        },
        'The safe mental model: a virtual register is a frame slot. It lives in memory. It is accessed by index. It may or may not map to a hardware register later. If you think "register = fast," you will mispredict the performance of memory-bound bytecode interpreters.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it teaches'],
          rows: [
            ['Ierusalimschy, de Figueiredo, Celes -- "The Implementation of Lua 5.0" (JUCS 2005)', 'The design rationale, instruction format, flat closures, and benchmarks from the Lua team'],
            ['Shi, Casey, Ertl, Gregg -- "Virtual Machine Showdown" (VEE 2005 / ACM TACO 2008)', 'Rigorous measurement: 47% fewer dispatches, 25% larger bytecode, 32% faster execution'],
            ['Lua 5.0.3 source code (lopcodes.h, lvm.c)', 'The actual bit layout, opcode table, and interpreter loop in ~2,000 lines of C'],
            ['Nystrom -- Crafting Interpreters (2021), chapters 14-15', 'Clear implementation of a stack VM for direct comparison'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Bytecode Stack Virtual Machine -- understand the baseline before studying the alternative.',
            'Prerequisite: Interpreter Dispatch Table and Threaded Code -- understand why dispatch is expensive.',
            'Extension: Static Single Assignment and Phi Nodes -- the compiler-IR version of naming intermediate values.',
            'Extension: Linear Scan Register Allocation -- lifetime-based slot reuse for real hardware registers.',
            'Production case: V8 Ignition Bytecode Pipeline -- a modern register-style interpreter in a JIT-heavy runtime.',
            'Contrast: WebAssembly Stack Machine -- a stack design chosen deliberately for network transmission and fast validation.',
          ],
        },
        'The key question across all these topics is not "which VM is better" but where each design spends its budget: bytes per instruction, instructions per expression, compiler complexity, and runtime state. Compile the same expression both ways, count dispatches and bytes, and the tradeoff becomes concrete.',
      ],
    },
  ],
};
