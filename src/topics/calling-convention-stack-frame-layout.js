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
  yield {
    state: callGraph('A calling convention is a contract at every call edge'),
    highlight: { active: ['caller', 'args', 'stack', 'call', 'e-caller-args', 'e-caller-stack'], compare: ['ret'] },
    explanation: 'Before a call, the caller places arguments where the ABI expects them: usually some registers first, then stack slots for overflow or special cases.',
  };
  yield {
    state: labelMatrix(
      'Call contract',
      [
        { id: 'arg', label: 'arguments' },
        { id: 'ret', label: 'return' },
        { id: 'caller', label: 'caller-save' },
        { id: 'callee', label: 'callee-save' },
      ],
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
    explanation: 'The ABI also says which registers may be clobbered by a call and which must be restored by the callee before returning.',
    invariant: 'Caller and callee must agree exactly, even if they were compiled by different compilers.',
  };
  yield {
    state: callGraph('Return values move through ABI-defined locations'),
    highlight: { active: ['ret', 'caller2', 'e-ret-caller2'], found: ['save'], compare: ['frame'] },
    explanation: 'Return values usually come back in defined registers or memory locations. The caller resumes assuming the ABI contract was honored.',
  };
}

function* frameLowering() {
  yield {
    state: callGraph('Frame lowering lays out local storage'),
    highlight: { active: ['frame', 'save', 'call', 'e-call-frame', 'e-call-save'], compare: ['args'] },
    explanation: 'A stack frame stores spills, saved registers, outgoing arguments, local allocas, alignment padding, and metadata needed by unwinding or debugging.',
  };
  yield {
    state: labelMatrix(
      'Frame slots',
      [
        { id: 'retaddr', label: 'return addr' },
        { id: 'saved', label: 'saved regs' },
        { id: 'spill', label: 'spills' },
        { id: 'local', label: 'locals' },
      ],
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
    explanation: 'Frame layout is where register allocation, calling convention, alignment, and debug/unwind information meet.',
  };
  yield {
    state: callGraph('Prologue builds the frame; epilogue tears it down'),
    highlight: { active: ['save', 'frame', 'ret'], compare: ['caller'], found: ['caller2'] },
    explanation: 'The prologue adjusts the stack and saves required registers. The epilogue restores them, places the return value, and transfers control back to the caller.',
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
      heading: 'What it is',
      paragraphs: [
        'A calling convention is an ABI contract for function calls. It defines where arguments go, where return values come back, which registers a call may clobber, which registers must be preserved, how the stack is aligned, and how frames are entered and left.',
        'A stack frame is the per-call storage layout produced by that contract plus the needs of the function: spills, saved registers, locals, outgoing call areas, return address handling, and sometimes unwind metadata.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The caller prepares arguments according to the ABI. On a common 64-bit Unix ABI, several integer or pointer arguments are passed in registers before overflow arguments use the stack. The callee creates any needed frame, saves callee-saved registers it will modify, runs the body, restores state, and returns the result in the ABI-defined location.',
        'Compilers model this through call lowering and frame lowering. Register allocation decides what must spill. Frame lowering assigns slots and emits prologue and epilogue code. Debuggers and exception unwinders depend on the metadata being correct.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose function f(a,b,c,d,e,f,g) calls h and has heavy register pressure. The first arguments may be assigned to ABI registers, while later arguments or temporary spills use stack slots. If f uses a callee-saved register, it must save it in the prologue and restore it before return.',
        'This is why backend phases cannot be isolated too naively. Linear Scan Register Allocation may create spills. Instruction Selection DAG & GlobalISel may select call instructions. Calling Convention & Stack Frame Layout must make those decisions obey the ABI so separately compiled code can interoperate.',
      ],
    },
    {
      heading: 'Interop and unwinding',
      paragraphs: [
        'The calling convention is what lets code compiled by different compilers call each other. A Rust function, C library, JIT stub, profiler, debugger, and exception unwinder all rely on the same low-level facts: where arguments live, which registers survive calls, where frames can be walked, and how return addresses are represented.',
        'Frame layout also carries non-obvious metadata. Stack maps, exception tables, debug locations, shadow call stacks, stack probes, red zones, and platform security features can all constrain prologue and epilogue generation. A backend that emits working arithmetic but wrong frame metadata can still crash under exceptions, profiling, garbage collection, or debugging.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not hard-code one platform as if it were universal. Windows x64, System V AMD64, AArch64, WebAssembly, and embedded ABIs make different choices. Variadic functions, struct returns, vector arguments, tail calls, and stack alignment rules are where toy backends usually discover that the ABI is a specification, not a suggestion.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LLVM code generator stack-frame and target-lowering docs at https://llvm.org/docs/CodeGenerator.html, LLVM LangRef calling conventions at https://llvm.org/docs/LangRef.html, and System V AMD64 ABI draft at https://refspecs.linuxbase.org/elf/x86_64-abi-0.99.pdf. Study Linear Scan Register Allocation, Instruction Selection DAG & GlobalISel, Deoptimization Stack Maps & Safepoints, and Bytecode Stack Virtual Machine next.',
      ],
    },
  ],
};
