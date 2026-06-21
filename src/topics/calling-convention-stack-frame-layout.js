// Calling conventions and stack frames: agree on argument registers, stack
// slots, return locations, saved registers, prologue, and epilogue.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'calling-convention-stack-frame-layout',
  title: 'Calling Convention & Stack Frame Layout',
  category: 'Concepts',
  summary: 'The ABI contract for function calls: argument registers, stack arguments, return values, caller/callee saves, prologue, epilogue, and frame slots.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['call boundary', 'frame lowering'], defaultValue: 'call boundary' },
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

function callGraph(title) {
  return graphState({
    nodes: [
      { id: 'caller', label: 'site', x: 0.9, y: 3.8, note: 'caller' },
      { id: 'args', label: 'args', x: 2.4, y: 2.5, note: 'regs' },
      { id: 'stack', label: 'stack', x: 2.4, y: 5.2, note: 'spill' },
      { id: 'call', label: 'call', x: 4.2, y: 3.8, note: 'ABI' },
      { id: 'frame', label: 'frame', x: 5.9, y: 5.2, note: 'slots' },
      { id: 'save', label: 'save', x: 5.9, y: 2.5, note: 'callee' },
      { id: 'ret', label: 'ret', x: 7.7, y: 3.8, note: 'rax' },
      { id: 'caller2', label: 'done', x: 9.3, y: 3.8, note: 'resume' },
    ],
    edges: [
      { id: 'e-caller-args', from: 'caller', to: 'args' },
      { id: 'e-caller-stack', from: 'caller', to: 'stack' },
      { id: 'e-args-call', from: 'args', to: 'call' },
      { id: 'e-stack-call', from: 'stack', to: 'call' },
      { id: 'e-call-save', from: 'call', to: 'save' },
      { id: 'e-call-frame', from: 'call', to: 'frame' },
      { id: 'e-save-ret', from: 'save', to: 'ret' },
      { id: 'e-frame-ret', from: 'frame', to: 'ret' },
      { id: 'e-ret-caller2', from: 'ret', to: 'caller2' },
    ],
  }, { title });
}

function* callBoundary() {
  const callHighlight = { active: ['caller', 'args', 'stack', 'call', 'e-caller-args', 'e-caller-stack'], compare: ['ret'] };
  yield {
    state: callGraph('A calling convention is a contract at every call edge'),
    highlight: callHighlight,
    explanation: `Before a call, the caller places arguments where the ABI expects them — ${callHighlight.active.length} components are active in this phase: usually some registers first, then stack slots for overflow or special cases.`,
  };
  const contractRows = [
    { id: 'arg', label: 'arguments' },
    { id: 'ret', label: 'return' },
    { id: 'caller', label: 'caller-save' },
    { id: 'callee', label: 'callee-save' },
  ];
  yield {
    state: labelMatrix(
      'Call contract',
      contractRows,
      [
        { id: 'owner', label: 'owner' },
        { id: 'example', label: 'example' },
      ],
      [
        ['caller', 'regs + stack'],
        ['callee', 'rax/xmm0'],
        ['caller saves', 'volatile regs'],
        ['callee restores', 'saved regs'],
      ],
    ),
    highlight: { active: ['arg:example', 'ret:example'], found: ['callee:owner'], compare: ['caller:owner'] },
    explanation: `The ABI defines ${contractRows.length} contract elements (${contractRows.map(r => r.label).join(', ')}) specifying which registers may be clobbered by a call and which must be restored by the callee before returning.`,
    invariant: `All ${contractRows.length} contract elements must be agreed exactly between caller and callee, even if they were compiled by different compilers.`,
  };
  const retHighlight = { active: ['ret', 'caller2', 'e-ret-caller2'], found: ['save'], compare: ['frame'] };
  yield {
    state: callGraph('Return values move through ABI-defined locations'),
    highlight: retHighlight,
    explanation: `Return values usually come back in defined registers or memory locations. The caller resumes through ${retHighlight.active.length} active stages (${retHighlight.active.join(' -> ')}) assuming the ABI contract was honored.`,
  };
}

function* frameLowering() {
  const lowerHighlight = { active: ['frame', 'save', 'call', 'e-call-frame', 'e-call-save'], compare: ['args'] };
  yield {
    state: callGraph('Frame lowering lays out local storage'),
    highlight: lowerHighlight,
    explanation: `A stack frame stores spills, saved registers, outgoing arguments, local allocas, alignment padding, and metadata needed by unwinding or debugging — ${lowerHighlight.active.length} components (${lowerHighlight.active.filter(a => !a.startsWith('e-')).join(', ')}) are active during lowering.`,
  };
  const slotRows = [
    { id: 'retaddr', label: 'return addr' },
    { id: 'saved', label: 'saved regs' },
    { id: 'spill', label: 'spills' },
    { id: 'local', label: 'locals' },
  ];
  yield {
    state: labelMatrix(
      'Frame slots',
      slotRows,
      [
        { id: 'why', label: 'why' },
        { id: 'owner', label: 'owner' },
      ],
      [
        ['resume caller', 'call insn'],
        ['preserve ABI', 'callee'],
        ['register pressure', 'allocator'],
        ['addressable data', 'function'],
      ],
    ),
    highlight: { active: ['saved:why', 'spill:why', 'local:owner'], found: ['retaddr:why'] },
    explanation: `Frame layout maps ${slotRows.length} slot types (${slotRows.map(r => r.label).join(', ')}) — this is where register allocation, calling convention, alignment, and debug/unwind information meet.`,
  };
  const epilogueHighlight = { active: ['save', 'frame', 'ret'], compare: ['caller'], found: ['caller2'] };
  yield {
    state: callGraph('Prologue builds the frame; epilogue tears it down'),
    highlight: epilogueHighlight,
    explanation: `The prologue adjusts the stack and saves required registers across ${epilogueHighlight.active.length} active nodes (${epilogueHighlight.active.join(', ')}). The epilogue restores them, places the return value, and transfers control back to the caller.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'call boundary') yield* callBoundary();
  else if (view === 'frame lowering') yield* frameLowering();
  else throw new InputError('Pick a calling-convention view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/calling-convention-stack-frame-layout.gif', alt: 'Animated walkthrough of the calling convention stack frame layout visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `A function call looks simple in source code, but a processor does not know what an argument, return value, local variable, or exception handler is. It sees registers, memory, branches, and a stack pointer. Separately compiled code can only cooperate if every participant agrees on where call data lives and who is responsible for preserving it.`,
        {type: `callout`, text: `A calling convention turns a function call into a machine contract about where state lives before, during, and after the branch.`},
        `A calling convention is that agreement. It says where arguments go, where return values come back, which registers a callee must restore, which registers a caller must assume are clobbered, how the stack is aligned, how large values are returned, and what shape metadata must have for unwinding and debugging. A stack frame is the concrete per-call layout that follows from that agreement plus the function's own needs.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Call_stack_layout.svg/500px-Call_stack_layout.svg.png`, alt: `Call stack layout showing parameters, return addresses, locals, stack pointer, and frame pointer`, caption: `A call stack frame stores the exact return, parameter, and local-state slots that the ABI makes meaningful. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Call_stack_layout.svg.`},
        `This exists because real programs are mixtures. C calls Rust. JavaScript engines call C++ runtime stubs. Operating systems deliver signals. Profilers sample stacks. Exception handlers walk frames. Debuggers reconstruct local variables. None of those tools can ask the compiler what it meant at runtime. They rely on the ABI and the frame records being correct.`,
      ],
    },
    {
      heading: 'The naive approach and why it fails',
      paragraphs: [
        `A toy compiler can use a private rule: push every argument, jump to the function, let the callee pop values, and return the result in some chosen register. That works for a closed world where one compiler produces all code, no debugger is involved, and every function has the same simple shape.`,
        `The approach fails at the first boundary. A system library may expect the first integer argument in one register and the first floating-point argument in another. A variadic function needs a defined way to find unnamed arguments. A struct return may need a hidden pointer argument. A callee may overwrite a register that the caller expected to keep. A stack pointer with the wrong alignment can make vector loads fault or silently slow down.`,
        `It also fails after the call has started. Exceptions, stack traces, garbage collectors, and profilers need to recover call chains. Security features such as stack probes, shadow stacks, stack canaries, and pointer authentication impose additional layout and prologue obligations. The stack frame is not scratch space owned by one function. It is a data structure shared with the platform.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The call boundary has ownership rules. Before the call, the caller puts each argument in the ABI-defined location: registers first on many modern ABIs, stack slots for overflow or special cases. The caller also protects any caller-saved values it needs after the call. After the branch, the callee may use volatile registers freely, but if it changes a callee-saved register it must restore that register before returning.`,
        `The callee builds a frame only as large and structured as it needs. Leaf functions may need no frame at all. Larger functions may save registers, reserve spill slots, allocate local arrays, set up a frame pointer, create outgoing argument space, and emit unwind directives. On return, the callee places the result in the ABI-defined register or memory location, tears down the frame, restores preserved registers, and transfers control back.`,
        `The core insight is that a function call is not just control flow. It is a contract about live state across a boundary. Register allocation, instruction selection, frame lowering, debug info, exception handling, and platform security all meet at that contract.`,
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        `A compiler backend usually lowers calls in several steps. Instruction selection turns an abstract call into target calling-sequence operations. The call-lowering code assigns each argument to a register, stack slot, or hidden location according to the ABI. Values that do not fit or must be addressable are copied to stack memory. Return values are assigned to result registers or memory return slots.`,
        `Register allocation then decides where live values reside around the call. Caller-saved registers are treated as clobbered by the call instruction unless the value is saved elsewhere. Callee-saved registers are available, but using them creates prologue and epilogue work. Spills become frame slots. Fixed registers, stack pointer rules, and frame pointer rules become constraints that the allocator and frame lowering must respect.`,
        `Frame lowering assigns offsets to all frame objects. It accounts for alignment, saved registers, return address handling, local variables, spills, outgoing call areas, stack canaries, stack probes, and call frame information. The prologue materializes that layout by adjusting the stack pointer and saving state. The epilogue reverses the process. Unwind metadata describes enough of this movement for external tools to reconstruct older frames.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/0/0c/ComputerMemoryHierarchy.svg`, alt: `Computer memory hierarchy from CPU registers and caches down to storage`, caption: `Calling conventions sit at the boundary between registers and memory: fast registers carry common arguments, while stack memory holds overflow, spills, and frame metadata. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:ComputerMemoryHierarchy.svg.`},
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The call-boundary view proves that both sides of a call see different obligations. The caller is responsible for placing inputs and protecting values that the ABI says may be destroyed. The callee is responsible for preserving callee-saved state and returning results in the agreed locations. If either side uses a private convention, the failure may look like a random register corruption bug.`,
        `The frame-lowering view proves that local storage is not arbitrary. Saved registers, spill slots, locals, outgoing arguments, return address state, and unwind descriptions are one coordinated layout. The prologue and epilogue are not boilerplate. They are the code that makes the layout true during execution and makes it disappear before control returns to the caller.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The runtime cost is usually small per call but paid everywhere. Arguments may need moves. Stack arguments need stores. The stack pointer may be adjusted. Callee-saved registers may be pushed and popped. Large frames may need stack probes so guard pages are touched safely. Spills add memory traffic. Alignment padding consumes stack space without holding program data.`,
        `Good backends reduce that cost when rules allow. A leaf function can often avoid saving a return address in a separate frame record. A red zone can let a function use small stack space without adjusting the stack pointer on some ABIs. Tail-call optimization can replace a call plus return with a jump when argument layout, stack cleanup, and calling convention rules line up. Register allocation can prefer caller-saved or callee-saved registers based on expected save cost.`,
        `The correctness cost is stricter than the runtime cost. A function may appear to compute correctly in a normal run while still having broken unwind tables, wrong stack maps, or invalid save and restore behavior. Those bugs surface under exceptions, profiling, garbage collection, signal handling, sanitizers, or debugger inspection.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `It works because the ABI makes invisible assumptions explicit. Every call site and every callee are compiled against the same map of locations and preservation rules. A caller can use a library compiled years earlier because both sides agree on the machine-level protocol. The debugger can walk through compiler output because the compiler emits metadata in a format the debugger understands.`,
        `The stack discipline also gives each active call a bounded region for its own temporary state. New calls grow the stack, returns shrink it, and older frames remain reachable through agreed recovery rules. Optimizations may omit a frame pointer or reuse stack slots, but only when they preserve the ABI-visible facts needed by other components.`,
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        `Native ABIs such as System V AMD64, Windows x64, AArch64, and RISC-V define how operating systems and libraries interoperate. Foreign function interfaces use those rules to let high-level languages call native code. JIT compilers generate adapter stubs that translate from a runtime internal convention to the platform ABI. WebAssembly engines bridge Wasm calls to host calls by lowering through explicit calling sequences.`,
        `Stack maps and safepoints use frame layout knowledge so garbage collectors and deoptimizers can find live references. Exception handling uses unwind metadata to restore caller state and find handlers. Profilers and observability tools use frame information to produce stack traces. Security mechanisms use prologue and epilogue patterns to insert canaries, probes, shadow-stack updates, or pointer authentication checks.`,
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        `Many failures are platform-specific. Windows x64 has shadow space rules. System V AMD64 has a red zone and different register ownership. AArch64 has its own argument classification and link-register behavior. Embedded ABIs may reserve registers for the runtime or interrupt handlers. A backend that treats one ABI as universal will pass simple tests and then fail at foreign calls, variadic functions, struct returns, vector arguments, or interrupt boundaries.`,
        `Other failures come from metadata drift. If the frame layout changes but unwind information does not, exception handling and stack walking break. If register allocation uses a callee-saved register but the prologue forgets to save it, callers are corrupted. If stack alignment is wrong, a called function may fault or read slow unaligned data. If tail-call optimization ignores ABI constraints, it can destroy the caller frame before it is legal to do so.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Linear Scan Register Allocation to see why spills and call-clobber rules create frame slots. Study Instruction Selection DAG & GlobalISel to see where abstract calls become machine call sequences. Study SSA Destruction Phi Elimination & Parallel Copy for the move scheduling that happens before machine code. Study Deoptimization Stack Maps & Safepoints for managed runtimes. Then read a real ABI document for your target, because calling conventions are specifications, not compiler folklore.`,
      ],
    },
  ],
};
