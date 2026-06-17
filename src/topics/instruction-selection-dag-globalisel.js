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
      heading: 'Why this exists',
      paragraphs: [
        `A compiler middle end wants a stable language for optimization. It should be able to reason about add, load, branch, call, vector operation, and memory ordering without knowing every addressing mode and immediate encoding of every processor. That is why IR is target-independent: it preserves program meaning while hiding machine details.`,
        `Machine code has the opposite requirement. It must use the exact operations that the target instruction set provides. One CPU may fold address arithmetic into a load. Another may need separate shift, add, and load instructions. One target may have condition flags. Another may use compare results in registers. One vector width may be legal in hardware while another must be split.`,
        `Instruction selection exists at this boundary. It lowers portable IR into target-shaped Machine IR: opcodes, operands, register classes, addressing modes, memory forms, condition codes, call sequences, and pseudo-instructions that later backend passes can allocate, schedule, and emit.`,
      ],
    },
    {
      heading: 'The naive approach and why it fails',
      paragraphs: [
        `The naive approach is one-to-one lowering. IR add becomes machine add. IR load becomes machine load. IR branch becomes machine branch. This is fine for a teaching VM whose instruction set was designed to match the IR. It breaks on real hardware because real instruction sets are not clean mirrors of compiler IR.`,
        `The first failure is legality. The IR may contain an integer width, floating-point type, vector shape, atomic operation, or address form that the target cannot encode directly. A 128-bit add may need two 64-bit adds plus carry. A wide vector may need to be split. A legal load may require a base register plus a small displacement, not an arbitrary expression.`,
        `The second failure is quality. One-to-one lowering misses machine idioms. Multiplication by a power of two may be better as a shift. Address arithmetic may be free inside a load. A compare followed by a branch may use flags instead of a materialized boolean. A multiply-add instruction may replace two IR operations. Good selection must preserve meaning while exploiting target forms.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Instruction selection is not a single lookup table. It is a staged conversion from target-independent meaning to target-legal machine operations. First, the backend legalizes operations and types that the target cannot represent. Then it combines equivalent shapes into forms the target can use well. Then it matches those legal shapes to concrete instructions.`,
        `For example, the expression y = a + b * 4 has several legal implementations. An x86-like target may fold b * 4 into a scaled index addressing mode or select an lea instruction. A simpler RISC target may emit shift-left by two followed by add. A target with a special multiply-add may use that when profitable. The source meaning is the same; the target affordances differ.`,
        `The insight is that the backend should keep the middle-end IR clean while letting each target describe its own legality and patterns. Target independence and target exploitation are not opposites. Instruction selection is the layer that lets them coexist.`,
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        `LLVM has historically used SelectionDAG for much of this job. The backend builds a directed acyclic graph of operations for a region, legalizes types and operations, performs DAG combines, and then uses target patterns to select machine instructions. The DAG makes data dependencies explicit and gives the selector a place to see multi-operation shapes such as load-address forms, arithmetic folds, and compare-branch patterns.`,
        `GlobalISel is LLVM's newer selection framework. It translates LLVM IR into generic Machine IR, legalizes generic machine operations, combines them, and selects target opcodes within the Machine IR pipeline. The goal is to share more infrastructure with the rest of the backend, support more global reasoning, and make the path from IR to Machine IR more uniform. The same conceptual stages remain: translate, legalize, combine, select.`,
        `After instruction selection, the program is not final assembly. It may still contain virtual registers, frame indices, pseudo-instructions, unresolved copies, and scheduling choices. Register allocation must map virtual registers to physical registers or spills. Frame lowering must assign stack slots. The assembler or emitter must encode final instructions. Selection makes the code target-shaped, not finished.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The lowering-pipeline view proves that selection is a sequence of contracts. IR states what the program means. Legalization states what the target can express. Combining states which equivalent shapes are worth exposing. Pattern selection states which machine instruction implements a legal shape. Each stage narrows freedom while preserving semantics.`,
        `The pattern view proves why instruction selection needs structure, not just opcodes. The selector may choose an addressing mode, a flag-setting instruction, a shift, a fused operation, or a target pseudo-instruction by seeing the shape around an operation. The GlobalISel view proves that the representation can change while the boundary remains: portable meaning becomes target-specific Machine IR.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `It works because each rewrite is semantics-preserving under target constraints. Legalization replaces unsupported operations with equivalent supported operations. Combines replace a shape with another shape that computes the same value or has the same observable behavior under the IR rules. Pattern selection chooses an instruction whose target semantics match the legal operation and operands.`,
        `The target description is the proof boundary. It defines legal types, legal operations, register classes, addressing modes, immediate ranges, memory constraints, and instruction semantics. If those descriptions are accurate, the selector can reject impossible forms and choose valid ones. If they are wrong, later stages inherit invalid machine code no matter how clean the original IR was.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The cost is mostly compiler engineering complexity. Each target needs legalization rules, selection patterns, custom lowering for awkward operations, and tests for edge cases. A missed pattern may produce slow code. A wrong pattern may miscompile. A pattern that is locally profitable may hurt scheduling, register pressure, or code size.`,
        `SelectionDAG gives a mature graph-based place for local combines and pattern matching, but it introduces a separate representation that backend engineers must understand. GlobalISel keeps more of the flow in Machine IR and can be easier to integrate with later backend passes, but target coverage and maturity depend on the architecture and compiler version. Many real backends use both paths during long transitions.`,
        `Compile time also matters. A selector can spend effort exploring alternatives, but a JIT or shader compiler may need a quick answer. Ahead-of-time compilers can afford more target-specific work. The right selector is not only the one that emits the fastest code; it is the one that fits the compiler tier and reliability needs.`,
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        `C, C++, Rust, Swift, and other native compilers rely on instruction selection to retarget the same high-level optimizations to many CPUs. A vectorized loop can lower differently on AVX2, AVX-512, NEON, SVE, or WebAssembly SIMD. Atomic operations lower differently depending on memory model support. Calls lower through each platform ABI.`,
        `JIT compilers use selection under tighter latency budgets. A JavaScript engine or JVM may have a baseline selector for quick code and a stronger optimizing selector for hot functions. Database query compilers, GPU shader compilers, eBPF compilers, and WebAssembly engines all face the same boundary: a portable internal plan must become legal instructions for a specific execution target.`,
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        `Legalization bugs are common failure roots. If an operation is marked legal when the target cannot encode it, selection fails or emits invalid code. If it is expanded incorrectly, the program computes the wrong result. Combines can be wrong when they ignore poison, undef, signed overflow flags, floating-point NaN behavior, memory ordering, or target-specific side effects.`,
        `Selection can also create performance traps. Choosing a clever addressing mode may increase register pressure. Folding a load into an instruction may block reuse of the loaded value. A pseudo-instruction may expand later into more code than expected. A pattern that wins on one microarchitecture may lose on another. Instruction selection is therefore tied to cost models, scheduling, and register allocation even though it runs before final code emission.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Static Single Assignment & Phi Nodes to understand the value form many selectors start from. Study SSA Destruction Phi Elimination & Parallel Copy for the move problems that appear before allocation. Study Linear Scan Register Allocation and Interference Graph Register Allocation to see how selected virtual registers become physical locations. Study Calling Convention & Stack Frame Layout for call lowering. Then read target backend documentation and inspect compiler dumps after legalization, combine, selection, allocation, and emission.`,
      ],
    },
  ],
};
