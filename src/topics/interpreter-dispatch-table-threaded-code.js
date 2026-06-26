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
  const loopSteps = 4;
  const nodeCount = 8;
  const dispatchMethods = 2;
  yield {
    state: dispatchGraph('The interpreter spends its life in the dispatch loop'),
    highlight: { active: ['ip', 'decode', 'handler', 'next', 'e-ip-decode', 'e-handler-next', 'e-next-ip'], compare: ['done'] },
    explanation: `Every bytecode interpreter has an inner loop of ${loopSteps} phases: read an opcode, choose the handler, mutate VM state, advance the instruction pointer, and repeat across all ${nodeCount} dispatch-graph nodes.`,
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
    explanation: `Tiny bytecodes can be dominated by dispatch overhead across all ${loopSteps} cost categories. This is why handler layout, bytecode design, and quickening matter in production interpreters.`,
    invariant: `A faster handler does not help much if dispatch cost dominates every instruction — ${dispatchMethods} dispatch methods (table and switch) each carry that overhead.`,
  };
  yield {
    state: dispatchGraph('Threaded code reduces some branch overhead'),
    highlight: { active: ['table', 'handler', 'next', 'e-table-handler', 'e-handler-next'], compare: ['switch'], found: ['state'] },
    explanation: `Threaded-code interpreters arrange bytecode or handler addresses so a handler can jump straight to the next handler, bypassing the central loop's ${loopSteps}-phase overhead. The idea is dispatch-table locality, not operating-system threads.`,
  };
}

function* handlerTable() {
  const opcodeCount = 4;
  const vmStates = ['stack/regs', 'control', 'frames'];
  yield {
    state: dispatchGraph('A handler table maps opcodes to executable behavior'),
    highlight: { active: ['decode', 'table', 'handler', 'e-decode-table', 'e-table-handler'], compare: ['switch'] },
    explanation: `A dispatch table is a data structure: opcode value to handler. With ${opcodeCount} opcodes defined, the table has ${opcodeCount} entries. In a switch interpreter, the compiler builds something similar behind the scenes for dense cases.`,
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
    explanation: `The handler table should make the stack effect or register effect explicit. Each of the ${opcodeCount} opcodes touches VM state (${vmStates.join(', ')}), and debuggers, validators, profilers, and bytecode printers all benefit from that metadata.`,
  };
  yield {
    state: dispatchGraph('Dispatch connects bytecode design to engine performance'),
    highlight: { active: ['ip', 'decode', 'table', 'handler', 'state'], found: ['done'] },
    explanation: `Bytecode Stack Virtual Machine and Register Virtual Machine: Lua Case Study choose different instruction formats. Dispatch is where those choices become runtime cost across ${vmStates.length} state domains: ${vmStates.join(', ')}.`,
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
    {heading: 'How to read the animation', paragraphs: [
      'The animation follows a bytecode interpreter: fetch the opcode at the instruction pointer, dispatch to a handler, mutate VM state, advance or branch, then repeat. Active edges show the current control path, and the done edge appears only when execution returns.',
      {type: 'callout', text: 'Dispatch performance is paid per bytecode, so tiny handlers make the branch itself part of the workload.'},
      {type: 'image', src: './assets/gifs/interpreter-dispatch-table-threaded-code.gif', alt: 'Animated walkthrough of the interpreter dispatch table threaded code visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ]},
    {heading: 'Why this exists', paragraphs: [
      'Bytecode is compact virtual instruction data, not host-machine code. An interpreter exists to map each opcode to code that implements it while preserving the virtual machine stack, registers, frames, and control flow.',
    ]},
    {heading: 'The obvious approach', paragraphs: [
      'The obvious approach is a loop with a switch statement. It is portable, readable, easy to instrument, and good enough until dispatch itself becomes a measurable cost.',
    ]},
    {heading: 'The wall', paragraphs: [
      'The wall appears when handlers are tiny and numerous. If each bytecode does five cycles of useful work but dispatch costs eight cycles, the branch is the workload.',
    ]},
    {heading: 'The core insight', paragraphs: [
      'Dispatch can be represented as a table from opcode to handler address, and threaded code lets each handler jump directly to the next handler. The interpreter is a state machine, where each opcode is a state transition over VM state.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt: 'State transition diagram with process states and arrows', caption: 'A state-machine diagram matches the interpreter loop: each opcode moves the VM from one precise state to the next. Source: Wikimedia Commons, CC BY-SA 3.0.'},
    ]},
    {heading: 'How it works', paragraphs: [
      'Switch dispatch returns to one central loop after each handler. Table dispatch indexes an array of handlers, while threaded dispatch has each handler fetch or address the next handler and jump there directly.',
    ]},
    {heading: 'Why it works', paragraphs: [
      'Correctness composes one bytecode at a time. If the opcode selects the right handler and the handler preserves its stack effect, register writes, IP movement, and exception behavior, then repeated steps execute the program semantics.',
    ]},
    {heading: 'Cost and complexity', paragraphs: [
      'Total time is executed bytecodes times dispatch cost plus handler work. Doubling bytecode count doubles dispatch work even when each bytecode is simple.',
      'Switch dispatch is portable and compact. Threaded dispatch can reduce loop overhead, but it may require compiler extensions, pointer-sized bytecode, and careful handling of indirect-branch security costs.',
    ]},
    {heading: 'Real-world uses', paragraphs: [
      'Python, Ruby, Lua, JavaScript baseline tiers, WebAssembly interpreters, database expression evaluators, and teaching VMs all use dispatch loops. Production VMs often combine clear handler tables with quickening, inline caches, superinstructions, or JIT compilation for hot code.',
    ]},
    {heading: 'Where it fails', paragraphs: [
      'Dispatch optimization fails when handlers allocate, call the runtime, perform hash lookups, miss caches, or block on I/O. It also fails when portability and tooling matter more than shaving a branch from the inner loop.',
    ]},
    {heading: 'Worked example', paragraphs: [
      'Suppose a program executes 10,000,000 bytecodes. If switch dispatch costs 8 cycles and the average handler costs 12 cycles, total cost is 200,000,000 cycles.',
      'If threaded dispatch lowers dispatch to 5 cycles, total cost becomes 170,000,000 cycles, a 1.18x speedup. If handlers cost 100 cycles, the same dispatch improvement gives only about 1.03x, so measurement decides whether the technique matters.',
    ]},
    {heading: 'Sources and study next', paragraphs: [
      'Read Crafting Interpreters for a switch VM, Anton Ertl on efficient interpreters, V8 Ignition documentation for production handler tables, and the WebAssembly execution spec for formal bytecode behavior. Then study Bytecode Stack Virtual Machine, Finite State Machine, Register Virtual Machine, Inline Caches, and JIT Compilation.',
    ]},
  ],
};
