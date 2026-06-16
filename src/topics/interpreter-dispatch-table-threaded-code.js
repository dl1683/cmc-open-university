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
      heading: 'What it is',
      paragraphs: [
        'Interpreter dispatch is the mechanism that maps the next bytecode to the code that implements it. The VM has an instruction pointer, reads an opcode, finds the right handler, runs it, and moves to the next opcode.',
        'This sounds trivial until the bytecodes are small. If a program executes millions of tiny instructions, the overhead of choosing the next handler can compete with the useful work inside each handler.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The simplest dispatch loop is a switch over opcode values. A denser representation uses a table from opcode to handler. Threaded-code variants let handlers transfer control directly to the next handler, reducing some loop and branch costs. That phrase means interpreter control flow, not OS threads.',
        'Handlers mutate VM state: value stack, register frame, call stack, instruction pointer, exception state, feedback vectors, or inline caches. The handler table is therefore a runtime index over all state transitions the bytecode can perform.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'For CONST, ADD, JUMP, and CALL, the table records both handler identity and stack or frame effects. CONST reads the constant pool and writes a value slot. ADD reads two operand slots and writes one result. JUMP updates the instruction pointer. CALL creates or reuses a call frame.',
        'A profiler can count handler frequency and reveal whether the interpreter is spending time in arithmetic, property access, calls, or dispatch overhead itself. That feedback informs quickening, inline caches, and JIT tiering.',
      ],
    },
    {
      heading: 'Design notes',
      paragraphs: [
        'A good interpreter is data-structure heavy. It needs bytecode arrays, constant pools, frame arrays, handler tables, metadata tables, and trace/profiling counters. The dispatch loop ties those tables together under extreme repetition.',
        'The design also needs clear invalidation rules. If an optimized handler assumes a stable object shape or operand type, changing assumptions must deoptimize or fall back to a generic handler without corrupting state.',
        'Many interpreters use quickening: the first generic handler observes runtime facts, rewrites or annotates the bytecode site, and later executions jump to a more specific handler. That turns dispatch from a fixed table lookup into a feedback-driven state machine.',
        'The failure modes are concrete. A handler can advance IP incorrectly, leave the stack at the wrong height, forget to preserve an exception edge, or update profiling counters after state has already changed. Debug builds should assert stack effects and trace each handler boundary.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: V8 Ignition docs at https://v8.dev/docs/ignition, V8 Ignition blog at https://v8.dev/blog/ignition-interpreter, Crafting Interpreters VM loop at https://craftinginterpreters.com/a-virtual-machine.html, and WebAssembly execution model in the W3C Core Specification at https://www.w3.org/TR/wasm-core-2/. Study Bytecode Stack Virtual Machine, Register Virtual Machine: Lua Case Study, V8 Ignition Bytecode Pipeline, V8 Hidden Classes & Inline Caches, and Finite State Machines next.',
      ],
    },
  ],
};
