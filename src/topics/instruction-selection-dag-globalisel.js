// Instruction selection: lower target-independent IR into target-specific
// machine instructions through legalization, combines, and pattern matching.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'instruction-selection-dag-globalisel',
  title: 'Instruction Selection DAG & GlobalISel',
  category: 'Concepts',
  summary: 'Lower IR operations into target machine instructions: legalization, combines, pattern matching, Machine IR, and scheduling-ready code.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lowering pipeline', 'pattern match'], defaultValue: 'lowering pipeline' },
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

function iselGraph(title) {
  return graphState({
    nodes: [
      { id: 'ir', label: 'IR', x: 0.8, y: 3.8, note: 'add i32' },
      { id: 'legal', label: 'legal', x: 2.3, y: 2.4, note: 'types' },
      { id: 'combine', label: 'fold', x: 2.3, y: 5.2, note: 'DAG' },
      { id: 'pat', label: 'pat', x: 4.2, y: 3.8, note: 'rules' },
      { id: 'mir', label: 'MIR', x: 6.0, y: 3.8, note: 'target' },
      { id: 'reg', label: 'vreg', x: 7.5, y: 2.4, note: 'virt' },
      { id: 'sched', label: 'sched', x: 7.5, y: 5.2, note: 'order' },
      { id: 'asm', label: 'asm', x: 9.2, y: 3.8, note: 'emit' },
    ],
    edges: [
      { id: 'e-ir-legal', from: 'ir', to: 'legal' },
      { id: 'e-ir-combine', from: 'ir', to: 'combine' },
      { id: 'e-legal-pat', from: 'legal', to: 'pat' },
      { id: 'e-combine-pat', from: 'combine', to: 'pat' },
      { id: 'e-pat-mir', from: 'pat', to: 'mir' },
      { id: 'e-mir-reg', from: 'mir', to: 'reg' },
      { id: 'e-mir-sched', from: 'mir', to: 'sched' },
      { id: 'e-reg-asm', from: 'reg', to: 'asm' },
      { id: 'e-sched-asm', from: 'sched', to: 'asm' },
    ],
  }, { title });
}

function* loweringPipeline() {
  yield {
    state: iselGraph('Instruction selection maps IR to the target ISA'),
    highlight: { active: ['ir', 'legal', 'combine', 'e-ir-legal', 'e-ir-combine'], compare: ['asm'] },
    explanation: 'The compiler backend starts with target-independent IR operations and prepares them for a real instruction set by legalizing types and simplifying patterns.',
  };
  yield {
    state: labelMatrix(
      'Lowering stages',
      [
        { id: 'legal', label: 'legalize' },
        { id: 'combine', label: 'combine' },
        { id: 'select', label: 'select' },
        { id: 'post', label: 'post-isel' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'output', label: 'output' },
      ],
      [
        ['wide ops', 'target types'],
        ['mul by 2', 'shift left'],
        ['generic add', 'ADDrr'],
        ['MIR', 'sched/alloc'],
      ],
    ),
    highlight: { active: ['select:input', 'select:output'], found: ['combine:output'], compare: ['legal:output'] },
    explanation: 'Selection is not one table lookup. The backend may rewrite illegal operations, fold equivalent forms, then choose concrete opcodes.',
    invariant: 'Selected instructions must preserve IR semantics while satisfying target legality.',
  };
  yield {
    state: iselGraph('Machine IR becomes the input to allocation and scheduling'),
    highlight: { active: ['mir', 'reg', 'sched', 'asm', 'e-mir-reg', 'e-mir-sched'], found: ['pat'] },
    explanation: 'After selection, the code is target-shaped but still uses virtual registers and still needs register allocation, frame layout, and final emission.',
  };
}

function* patternMatch() {
  yield {
    state: iselGraph('Pattern matching chooses instructions by shape'),
    highlight: { active: ['combine', 'pat', 'mir', 'e-combine-pat', 'e-pat-mir'], compare: ['legal'] },
    explanation: 'A target rule might turn add(x, 1) into INC when the ISA has that form, or turn multiply-by-power-of-two into a shift if the target prefers it.',
  };
  yield {
    state: labelMatrix(
      'Example patterns',
      [
        { id: 'add', label: 'add a,b' },
        { id: 'lea', label: 'a+b*4' },
        { id: 'mul2', label: 'x*2' },
        { id: 'load', label: 'load p+8' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'opcode', label: 'opcode' },
      ],
      [
        ['binary op', 'ADD'],
        ['addr mode', 'LEA'],
        ['power two', 'SHL'],
        ['base+imm', 'LOAD'],
      ],
    ),
    highlight: { active: ['lea:shape', 'lea:opcode', 'load:opcode'], found: ['mul2:opcode'] },
    explanation: 'Instruction selection sees addressing modes and ISA tricks that earlier IR should not have to encode directly.',
  };
  yield {
    state: iselGraph('GlobalISel keeps selection on Machine IR'),
    highlight: { active: ['ir', 'mir', 'pat', 'e-pat-mir'], compare: ['combine'], found: ['asm'] },
    explanation: 'LLVM GlobalISel is a newer framework that translates LLVM IR to generic Machine IR, legalizes it, and then selects target instructions without a separate SelectionDAG IR.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lowering pipeline') yield* loweringPipeline();
  else if (view === 'pattern match') yield* patternMatch();
  else throw new InputError('Pick an instruction-selection view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Instruction selection is the compiler backend phase that turns target-independent IR into target-specific machine instructions. It is where abstract operations such as add, load, compare, and branch become concrete opcodes and addressing modes.',
        'The data structures are lowering graphs, rule tables, target descriptions, generic Machine IR, virtual registers, and legality records. The same source IR may lower differently on x86, ARM, WebAssembly, or a small teaching VM.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The backend first legalizes operations the target cannot directly represent. A 128-bit add may become smaller pieces on one target. A vector operation may become scalar code on another. Combines then simplify or canonicalize shapes before selection.',
        'Pattern selection matches legal IR shapes to target instructions. After selection, the code is usually not finished: it still needs scheduling, register allocation, SSA destruction, stack-frame layout, and emission.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'For y = a + b * 4, an early IR may describe multiply and add separately. A backend for x86-like addressing can recognize the shape base + index * scale and select a single address computation or memory operand. A simpler target may emit shift-left and add instructions instead.',
        'That is why instruction selection is not just syntax translation. It is target-aware structure matching. The selected form should be fast for the target while preserving the semantics proven by Static Single Assignment & Phi Nodes and earlier optimizations.',
      ],
    },
    {
      heading: 'Engineering notes',
      paragraphs: [
        'Instruction selection must also respect flags, condition codes, addressing-mode legality, immediate-size limits, vector widths, atomics, calling-convention requirements, and target-specific undefined behavior rules. A pattern that looks profitable in isolation can be illegal once operand classes or memory forms are considered.',
        'The debugging trick is to print the program after each backend stage. If legalization is wrong, selection may fail with no matching pattern. If combines are too aggressive, the selected instruction may be legal but slower or semantically wrong. If selected Machine IR carries bad register classes, register allocation inherits the problem.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not teach instruction selection as the last compiler step. It is a bridge. After it, virtual registers, frame indices, calls, spills, and pseudo-instructions still need lowering. Do not teach it as pure peephole optimization either; selection is constrained by full target semantics and by the surrounding Machine IR pipeline.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LLVM target-independent code generator at https://llvm.org/docs/CodeGenerator.html, LLVM GlobalISel overview at https://llvm.org/docs/GlobalISel/index.html, and GlobalISel InstructionSelect at https://llvm.org/docs/GlobalISel/InstructionSelect.html. Study Static Single Assignment & Phi Nodes, Linear Scan Register Allocation, SSA Destruction Phi Elimination & Parallel Copy, and Calling Convention & Stack Frame Layout next.',
      ],
    },
  ],
};
