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
  yield {
    state: vmGraph('A stack VM compiles syntax into a bytecode chunk'),
    highlight: { active: ['ast', 'chunk', 'consts', 'e-ast-chunk', 'e-chunk-consts'], compare: ['dispatch'] },
    explanation: 'The parser can produce an AST, but the runtime usually wants a compact instruction stream. A bytecode chunk stores opcodes plus a constant pool.',
  };
  yield {
    state: labelMatrix(
      'Bytecode for 1 + 2 * 3',
      [
        { id: 'i0', label: '0' },
        { id: 'i1', label: '1' },
        { id: 'i2', label: '2' },
        { id: 'i3', label: '3' },
        { id: 'i4', label: '4' },
      ],
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
    explanation: 'Stack bytecode avoids naming temporary values. Instructions push operands and consume the top stack slots. The order encodes the expression tree.',
    invariant: 'Every opcode has a stack effect: how many values it pops and pushes.',
  };
  yield {
    state: vmGraph('The dispatch loop advances the instruction pointer'),
    highlight: { active: ['ip', 'dispatch', 'op', 'stack', 'e-ip-dispatch', 'e-dispatch-op', 'e-op-stack'], found: ['result'] },
    explanation: 'The interpreter reads the next opcode, advances the instruction pointer, executes the handler, and repeats. The value stack is the central data structure.',
  };
}

function* framesAndCalls() {
  yield {
    state: vmGraph('Function calls add call frames around the value stack'),
    highlight: { active: ['stack', 'dispatch', 'ip'], compare: ['consts'], found: ['result'] },
    explanation: 'A function call needs more than operands. A call frame records the current function, return address, base stack slot, and local slots.',
  };
  yield {
    state: labelMatrix(
      'Call frame layout',
      [
        { id: 'fn', label: 'function' },
        { id: 'ret', label: 'return ip' },
        { id: 'base', label: 'base slot' },
        { id: 'locals', label: 'locals' },
      ],
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
    explanation: 'The frame makes recursive calls possible without copying the whole stack. Each call sees its own window over the same value-stack array.',
  };
  yield {
    state: vmGraph('Stack VMs are compact but not the only design'),
    highlight: { active: ['chunk', 'stack', 'dispatch'], compare: ['ast'], found: ['result'] },
    explanation: 'Stack bytecode is dense and simple to emit. Register Virtual Machine: Lua Case Study shows the opposite tradeoff: larger instructions but fewer push and pop operations.',
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
      heading: 'What it is',
      paragraphs: [
        'A bytecode stack virtual machine is a small runtime that executes compact instructions over a value stack. The compiler turns an AST or parser output into a chunk of bytes. The VM keeps an instruction pointer, reads one opcode at a time, and uses the stack for intermediate values.',
        'This is a useful middle layer between a tree-walking interpreter and native machine code. It is much cheaper to execute a flat instruction stream than to recursively walk a large AST, and it is easier to make portable than emitting CPU instructions directly.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The compiler emits opcodes such as CONST, ADD, CALL, RETURN, JUMP_IF_FALSE, and POP. Each opcode has a stack effect. CONST pushes a value. ADD pops two values and pushes one result. Conditional jumps inspect the stack and update the instruction pointer.',
        'Constants usually live in a side table, because values such as strings or numbers are larger than an opcode byte. Function calls add call frames. A frame stores the callee, return address, and base slot so locals can be addressed relative to that frame.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'For 1 + 2 * 3, the compiler emits CONST 1, CONST 2, CONST 3, MUL, ADD. After CONST instructions the stack holds [1,2,3]. MUL consumes 2 and 3 and pushes 6. ADD consumes 1 and 6 and pushes 7. No temporary variable names are required.',
        'For a function call, arguments are placed on the stack, the VM pushes a frame, jumps to the callee bytecode, and later uses RETURN to restore the caller instruction pointer. The same physical stack array can hold operands, locals, and call results.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'Stack bytecode is easy to generate from Pratt Parser Expression AST and naturally matches expression evaluation. It is also compact, which helps caches and load time. The downside is that common subexpressions and local values may require extra stack shuffling compared with register bytecode.',
        'WebAssembly is also specified around stack-machine execution, though production engines validate and compile it through richer internal representations. The durable idea is that stack effects make bytecode small and statically checkable.',
      ],
    },
    {
      heading: 'Debugging notes',
      paragraphs: [
        'A practical VM should include a bytecode disassembler, stack-effect checker, maximum-stack-depth computation, and trace mode that prints IP, opcode, and stack contents after each instruction. These tools make wrong compiler output visible before it turns into mysterious runtime behavior.',
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
