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
  const nodeCount = 8;
  const edgeCount = 9;
  const stageCount = 4;
  const firstStage = 'legalize';
  const lastStage = 'post-isel';
  yield {
    state: iselGraph('Instruction selection maps IR to the target ISA'),
    highlight: { active: ['ir', 'legal', 'combine', 'e-ir-legal', 'e-ir-combine'], compare: ['asm'] },
    explanation: `The compiler backend starts with target-independent IR operations and prepares them for a real instruction set by legalizing types and simplifying patterns across ${nodeCount} pipeline nodes.`,
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
    explanation: `Selection is not one table lookup. The backend walks ${stageCount} stages from ${firstStage} to ${lastStage}, rewriting illegal operations, folding equivalent forms, then choosing concrete opcodes.`,
    invariant: `Selected instructions must preserve IR semantics while satisfying target legality across all ${stageCount} lowering stages.`,
  };
  yield {
    state: iselGraph('Machine IR becomes the input to allocation and scheduling'),
    highlight: { active: ['mir', 'reg', 'sched', 'asm', 'e-mir-reg', 'e-mir-sched'], found: ['pat'] },
    explanation: `After selection, the code is target-shaped but still uses virtual registers across ${edgeCount} data-flow edges and still needs register allocation, frame layout, and final emission.`,
  };
}

function* patternMatch() {
  const patternCount = 4;
  const pipelineNodes = 8;
  const exampleOpcodes = ['ADD', 'LEA', 'SHL', 'LOAD'];
  yield {
    state: iselGraph('Pattern matching chooses instructions by shape'),
    highlight: { active: ['combine', 'pat', 'mir', 'e-combine-pat', 'e-pat-mir'], compare: ['legal'] },
    explanation: `A target rule might turn add(x, 1) into INC when the ISA has that form, or turn multiply-by-power-of-two into a shift -- the selector evaluates ${patternCount} pattern categories to find the best match.`,
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
    explanation: `Instruction selection sees addressing modes and ISA tricks -- opcodes like ${exampleOpcodes.join(', ')} -- that earlier IR should not have to encode directly.`,
  };
  yield {
    state: iselGraph('GlobalISel keeps selection on Machine IR'),
    highlight: { active: ['ir', 'mir', 'pat', 'e-pat-mir'], compare: ['combine'], found: ['asm'] },
    explanation: `LLVM GlobalISel is a newer framework that translates LLVM IR to generic Machine IR across ${pipelineNodes} pipeline nodes, legalizes it, and then selects target instructions without a separate SelectionDAG IR.`,
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
    {heading: 'How to read the animation', paragraphs: [
      'The animation follows a compiler backend as it turns portable intermediate representation into machine operations. Active nodes are the operations being lowered, and each edge shows a dependency that must already have a legal target form.',
      {type: 'image', src: './assets/gifs/instruction-selection-dag-globalisel.gif', alt: 'Animated walkthrough of the instruction selection dag globalisel visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ]},
    {heading: 'Why this exists', paragraphs: [
      'A compiler middle end wants one clean representation for optimization, while a CPU wants exact opcodes, register classes, addressing modes, immediate ranges, and calling conventions. Instruction selection is the boundary that turns portable meaning into target-specific operations.',
      {type: 'callout', text: 'Instruction selection is the contract that preserves IR meaning while spending target-specific machine affordances.'},
    ]},
    {heading: 'The obvious approach', paragraphs: [
      'The obvious approach is one-to-one lowering: IR add becomes machine add, IR load becomes machine load, and IR branch becomes machine branch. That works for a teaching VM whose instruction set mirrors the IR, but real processors do not have that shape.',
    ]},
    {heading: 'The wall', paragraphs: [
      'The first wall is legality: a target may not support the IR type, vector width, atomic form, or address expression. The second wall is quality: literal lowering misses flags, fused operations, scaled addressing, and other target idioms.',
    ]},
    {heading: 'The core insight', paragraphs: [
      'Instruction selection is a staged rewrite from meaning to legal machine shape. The backend legalizes unsupported operations, combines equivalent shapes, then matches legal patterns to target instructions.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed acyclic graph with nodes connected by arrows', caption: 'A DAG visual is a useful base model for instruction selection because legal combines depend on data edges, not text order. Source: Wikimedia Commons, David W., public domain.'},
    ]},
    {heading: 'How it works', paragraphs: [
      'SelectionDAG builds a dependency graph, legalizes types and operations, performs graph combines, and selects target opcodes from patterns. GlobalISel follows the same idea through generic Machine IR: translate, legalize, combine, and select.',
    ]},
    {heading: 'Why it works', paragraphs: [
      'Correctness comes from semantic preservation at every stage. Legalization replaces unsupported operations with equivalent supported operations, combines preserve the computed value or side effect, and selected instructions match the target semantics for the legal operation.',
    ]},
    {heading: 'Cost and complexity', paragraphs: [
      'The cost is mostly compiler engineering and compile time. Each target needs legality rules, patterns, custom lowering hooks, and tests for overflow, poison values, NaNs, memory ordering, flags, and side effects.',
      'A JIT may choose a cheaper selector to reduce startup latency, while an ahead-of-time compiler can spend more time for better code. The selected instruction can also change later costs such as register pressure and scheduling.',
    ]},
    {heading: 'Real-world uses', paragraphs: [
      'Native compilers for C, C++, Rust, Swift, and Zig use instruction selection to retarget shared optimizations to x86-64, Arm, RISC-V, WebAssembly, and GPUs. JITs, shader compilers, database query compilers, and eBPF compilers solve the same boundary problem under tighter latency constraints.',
    ]},
    {heading: 'Where it fails', paragraphs: [
      'It fails when a rewrite ignores a semantic detail such as signed overflow, floating-point NaNs, atomics, exceptions, or memory ordering. It also fails when a locally clever instruction increases register pressure, blocks scheduling, or expands badly as a pseudo-instruction.',
    ]},
    {heading: 'Worked example', paragraphs: [
      'For y = base[b * 4 + 8] + c, an x86-like target can fold b * 4 + 8 into a scaled-index load, then add c. A simple RISC target may need shift-left b by 2, add base, add 8, load, then add c.',
      'If base is 1000, b is 3, and c is 7, both targets must load from address 1000 + 3 * 4 + 8 = 1020 and then add 7. Different instructions are correct only because the computed value and memory access are the same.',
    ]},
    {heading: 'Sources and study next', paragraphs: [
      'Read LLVM documentation on SelectionDAG, GlobalISel, legalization, and target descriptions. Then study Static Single Assignment, Calling Convention and Stack Frame Layout, Register Allocation, and SSA Destruction to see what instruction selection must feed.',
    ]},
  ],
};
