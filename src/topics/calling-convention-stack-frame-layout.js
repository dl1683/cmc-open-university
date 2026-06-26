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
        'Use the dropdown at the top to switch between two views. "Call boundary" traces what happens when one function calls another: the caller places arguments, the call transfers control, the callee does its work, and the return hands control back. "Frame lowering" shows how the compiler arranges slots inside a single stack frame. In both views, highlighted nodes are the active participants at the current step, and edges show data or control flow.',
        'Step through one frame at a time with the arrow buttons, or press play to watch at reading pace. Each step names the ABI obligation being fulfilled and which side of the call boundary is responsible. Watch for the ownership handoff: the caller owns state before the call, the callee owns it after.',
        {type: 'image', src: './assets/gifs/calling-convention-stack-frame-layout.gif', alt: 'Animated walkthrough of the calling convention stack frame layout visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'When you write "result = add(3, 5)" in C, the compiler turns that into machine instructions. But a CPU has no built-in notion of "arguments" or "return values." It has registers (small, fast storage slots built into the processor -- typically 16 general-purpose registers on x86-64), a stack pointer (a register that tracks the current top of the call stack in memory), and branch instructions that jump to an address. If the caller puts the number 3 in register rdi and the callee expects it in rax, the program silently computes garbage.',
        {type: 'callout', text: 'A calling convention turns a function call into a machine contract about where state lives before, during, and after the branch.'},
        'A calling convention is a piece of the ABI (Application Binary Interface), the full specification of how compiled code interacts at the binary level. The calling convention specifically governs function calls: which registers carry the first few arguments, where overflow arguments go on the stack, which register holds the return value, which registers the callee must restore before returning (callee-saved), which registers the caller must assume are destroyed by any call (caller-saved), and how the stack must be aligned at the moment of the call.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Call_stack_layout.svg/500px-Call_stack_layout.svg.png', alt: 'Call stack layout showing parameters, return addresses, locals, stack pointer, and frame pointer', caption: 'A call stack frame stores the exact return, parameter, and local-state slots that the ABI makes meaningful. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Call_stack_layout.svg.'},
        'A stack frame is the region of stack memory that one function invocation owns. It holds the return address (the instruction to jump back to when the function finishes), saved register values, local variables, and temporary spill slots. The frame pointer (rbp on x86-64) optionally marks a fixed reference point within the frame so that locals can be addressed at constant offsets even as the stack pointer moves during the function body.',
        'This contract matters because real software is not monolithic. Your C code links against a system library compiled by a different compiler five years ago. A JavaScript engine calls C++ runtime stubs. A debugger reconstructs local variables from a binary whose source it has never seen. An exception handler unwinds through frames it did not create. None of this works unless every function follows identical rules about where machine state lives.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A simple compiler targeting a single language can invent whatever private rule it likes. The most natural choice: push every argument onto the stack in left-to-right order, jump to the function, let the callee pop arguments off the stack, and return the result in a fixed register. The compiler knows its own convention, and every function it produces follows that rule, so everything links.',
        'This is what many early compilers actually did, and it is what a student building a toy compiler would likely try first. It needs no coordination with external code, no register-assignment logic, and no metadata describing the frame layout. The caller pushes, the callee pops, done.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The private convention breaks the moment you call code you did not compile. Suppose your program calls malloc from the C standard library. That library was compiled under the System V AMD64 ABI, which expects the first integer argument in register rdi. Your compiler pushed it onto the stack instead. malloc reads rdi, finds leftover garbage, and your program segfaults or silently corrupts the heap.',
        'Even within one compiler, the all-stack approach is slow. A stack push is a memory store; a register-to-register move is effectively free on a modern out-of-order CPU. Passing six arguments through registers instead of memory eliminates 12 memory operations per call (6 stores by the caller, 6 loads by the callee). In a hot inner loop calling a small helper millions of times, that difference is tens of percent of total runtime.',
        'The deeper wall is everything beyond the call itself. Exceptions need to unwind the stack, restoring saved registers and locating catch handlers frame by frame. Debuggers need to reconstruct local variables at any breakpoint. Profilers need accurate stack traces for flame graphs. Garbage collectors need to find every live pointer on the stack. Security mechanisms insert stack canaries (known values placed just before the return address to detect buffer overflows) and shadow stacks (a hardware-protected second copy of return addresses). All of these require a predictable, documented frame layout -- not an ad-hoc one that only the original compiler understands.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A function call is a transfer of ownership over machine state. The insight is that this transfer has exactly two sides with complementary obligations, and both sides must agree on the boundary rules even if they were compiled by different tools, in different languages, years apart. If the boundary is specified precisely and universally obeyed, everything downstream -- debugging, profiling, exception handling, garbage collection -- can be built on top of it.',
        'The caller owns the pre-call state. It places arguments in the ABI-specified locations, saves any of its own values that currently sit in caller-saved registers (because the callee is allowed to destroy them), and adjusts the stack pointer. The callee owns the post-call state. It saves any callee-saved registers it intends to use (because it promised to restore them), allocates its frame, executes the function body, places the return value, tears down the frame, restores the callee-saved registers, and jumps back to the caller\'s return address.',
        'This two-sided ownership split is why the convention is not just about speed or convenience. It is a correctness contract. If the split is well-defined, any two functions compiled by any two compilers on any two dates can call each other safely. If the split is ad-hoc, every tool that touches the call stack must be reinvented per compiler, per language, per optimization level.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The compiler lowers a function call in three phases. First, during instruction selection, the abstract operation "call f with arguments a, b, c" becomes a sequence of concrete register moves and a call instruction. Each argument is assigned to a location according to the ABI. On System V AMD64: the first six integer or pointer arguments go into rdi, rsi, rdx, rcx, r8, r9 (in that order), the first eight floating-point arguments go into xmm0 through xmm7, and anything beyond that is pushed onto the stack from right to left so that the first overflow argument ends up at the lowest address.',
        'Second, register allocation decides where every live value in the function resides. Any value the caller needs after the call that currently sits in a caller-saved register (rax, rcx, rdx, rsi, rdi, r8, r9, r10, r11 on System V) must be moved to a callee-saved register or spilled to a stack slot before the call. The callee, if it uses any callee-saved registers (rbx, rbp, r12 through r15), must emit prologue code to save them and epilogue code to restore them.',
        'Third, frame lowering assigns concrete byte offsets within the stack frame. The compiler accounts for: the return address (8 bytes, pushed automatically by the call instruction), saved callee registers (8 bytes each), local variables, spill slots for values that could not stay in registers, outgoing argument space for calls this function makes, and alignment padding to keep the stack pointer 16-byte aligned (required by the ABI so that SSE instructions do not fault). The prologue is the code at function entry that builds this layout; the epilogue is the code before each return that tears it down.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/ComputerMemoryHierarchy.svg', alt: 'Computer memory hierarchy from CPU registers and caches down to storage', caption: 'Calling conventions sit at the boundary between registers and memory: fast registers carry common arguments, while stack memory holds overflow, spills, and frame metadata. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:ComputerMemoryHierarchy.svg.'},
        'A typical prologue on x86-64 looks like: push rbp (save old frame pointer, 8 bytes), mov rbp, rsp (set new frame pointer), sub rsp, N (allocate N bytes for locals and spills), then push each callee-saved register the function uses. The epilogue reverses: pop the saved registers, mov rsp, rbp (deallocate locals), pop rbp (restore the caller\'s frame pointer), ret (pop the return address into the instruction pointer and jump there). If the compiler omits the frame pointer (an optimization that frees rbp for general use), it adjusts rsp directly and relies on DWARF unwind metadata so that debuggers and exception handlers can still reconstruct the frame chain.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The convention works because it replaces implicit assumptions with an explicit, shared specification. Two compilers that have never seen each other\'s source code produce compatible object files because both implement the same ABI document. A shared library compiled in 2015 links against application code compiled in 2026 without recompilation, because the register assignments and frame layout rules have not changed.',
        'The stack discipline gives every function invocation its own private memory region without needing a heap allocator. Each call pushes a new frame; each return pops it. Older frames remain intact and reachable through the saved frame-pointer chain or through unwind metadata. Because function calls nest -- A calls B calls C, C returns to B, B returns to A -- the stack\'s last-in-first-out structure is a perfect match. Unwinding for exceptions or debugging is just walking that chain backward, restoring saved registers at each step.',
        'Correctness is compositional. If every individual function honors the ABI, then any composition of functions is correct at call boundaries. You never need to reason about whether function A is compatible with function B; if both follow the convention, they are compatible by construction. This compositionality is the foundation of separate compilation, shared libraries, dynamic linking, and foreign function interfaces.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Every function call pays a small fixed cost: moving arguments into the correct registers (or pushing overflow arguments to the stack), executing the call instruction (which pushes the 8-byte return address), and running the callee\'s prologue and epilogue. For a leaf function (one that calls no other functions) using few registers, the prologue might be a single "sub rsp, 8" for alignment and the epilogue a matching "add rsp, 8; ret" -- about 2 instructions of overhead. For a complex function using five callee-saved registers and 200 bytes of locals, the prologue pushes 5 registers (40 bytes) and subtracts 200 from rsp, adding roughly 7 instructions.',
        'The hidden cost is spilling. When register allocation cannot keep a value in a register across a call -- because the value sits in a caller-saved register, the call will clobber it, and no callee-saved register is free -- it stores the value to a stack slot before the call and reloads it afterward. Each spill is a store-load pair, roughly 4 to 8 cycles of latency on modern hardware depending on whether the store-to-load forwarding path hits. In tight loops with many calls, spill traffic can dominate runtime.',
        'Some ABIs provide a red zone: 128 bytes below the stack pointer that leaf functions may use without adjusting rsp at all. This eliminates the prologue and epilogue cost entirely for small leaf functions. System V AMD64 has a red zone; Windows x64 does not. Tail-call optimization eliminates the call/return overhead when a function\'s last action is another call: the compiler reuses the current frame instead of creating a new one, turning call + return into a single jump instruction. This only works when the outgoing argument layout and stack cleanup are compatible with the current frame.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every native binary on your system depends on a calling convention. System V AMD64 governs Linux and macOS. Windows x64 uses a different convention: rcx, rdx, r8, r9 for the first four integer arguments, plus a mandatory 32-byte "shadow space" the caller must allocate on the stack even if the callee does not use it. AArch64 (ARM 64-bit) uses registers x0 through x7. RISC-V uses a0 through a7. Each platform\'s shared libraries, system calls, and kernel entry points depend on these rules being followed exactly.',
        'Foreign function interfaces exist because calling conventions are standardized. Python\'s ctypes, Java\'s JNI, Rust\'s extern "C" blocks, and Node.js\'s native addons all generate or consume machine code that follows the platform ABI at call boundaries. JIT compilers in JavaScript engines (V8, SpiderMonkey) emit platform-convention code when calling C++ runtime helpers, and use faster internal conventions for JavaScript-to-JavaScript calls where both sides are under the JIT\'s control.',
        'Stack unwinding for C++ exceptions and Rust panics reads DWARF unwind tables (on Unix) or .pdata/.xdata tables (on Windows) that describe how to restore each frame\'s saved registers. Sampling profilers like perf and Instruments capture the instruction pointer and walk the stack to produce flame graphs. Garbage collectors in managed runtimes (JVM, CLR, Go) use stack maps recording which frame slots contain live object pointers so the collector can trace roots without scanning the entire stack. Every one of these tools is a downstream consumer of the calling convention and frame layout.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Calling convention mismatches are silent and catastrophic. If you declare an extern function with the wrong convention -- for example, calling a stdcall function as if it were cdecl on 32-bit Windows -- the stack pointer ends up wrong after the call. The caller assumes the callee cleaned the stack; the callee assumes the caller will. Neither does, and the stack drifts by the size of the arguments. The program may run for thousands more instructions before crashing, making the bug nearly impossible to trace without a convention-aware debugger.',
        'Metadata drift is a subtler failure. An optimization pass changes the frame layout -- say, reordering spill slots or eliminating a saved register -- but fails to update the DWARF unwind tables accordingly. Normal execution is unaffected because the unwind tables are never consulted. But when an exception is thrown, the unwinder reads stale metadata, restores wrong register values, and jumps to a garbage address. These bugs surface only under exception paths and only at specific optimization levels, making them difficult to reproduce.',
        'Variadic functions (like printf) are a persistent source of ABI bugs. On System V AMD64, the caller must set the al register to the number of vector (SSE) registers used for variadic arguments so that the callee knows how many xmm registers to spill. If the compiler gets this count wrong, printf reads its format arguments from the wrong locations. Struct returns are another trouble spot: large structs are returned via a hidden pointer argument, and the threshold for "large" differs between ABIs. System V returns structs up to 16 bytes (two 8-byte chunks) in registers; Windows x64 returns only 1, 2, 4, or 8-byte scalar types in a register and uses the hidden pointer for everything else.',
        'Frame pointer omission frees rbp for general use and can improve performance, but it breaks any tool that walks the frame-pointer chain. Modern profilers on Linux fall back to DWARF unwinding, but DWARF tables are large and slow to parse -- a single unwind step can touch hundreds of bytes of metadata. This creates a real tension between runtime performance and observability. Some organizations (notably Meta and Google) mandate frame pointers in all production builds specifically to keep stack-walking cheap enough for always-on profiling.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider this C function compiled under System V AMD64: long compute(long a, long b, long c) { long x = a + b; long y = x * c; return y; }',
        'A caller invokes it: long result = compute(10, 20, 30);',
        'The caller places 10 into rdi (first integer argument slot), 20 into rsi (second), 30 into rdx (third). All three fit in registers, so no stack arguments are needed. The caller then executes "call compute," which pushes the 8-byte return address onto the stack and jumps to compute\'s entry point.',
        'Suppose rsp was 0x7fff0040 before the call. After the call instruction pushes the return address, rsp is 0x7fff0038. The callee\'s prologue runs: push rbp (rsp becomes 0x7fff0030; the old rbp value is stored at that address), mov rbp, rsp (rbp now equals 0x7fff0030), sub rsp, 16 (rsp becomes 0x7fff0020, reserving 16 bytes for locals x and y).',
        'The resulting frame layout, from high addresses to low: [0x7fff0038] return address, [0x7fff0030] saved rbp, [0x7fff0028] local x, [0x7fff0020] local y. In practice the compiler would keep x and y in registers because this is a leaf function with low register pressure, but the frame structure is the same when pressure forces spills.',
        'The function body executes: add rdi, rsi produces 30 (stored or kept as x), imul by rdx produces 900 (y). The result 900 is placed in rax (the return value register). The epilogue runs: mov rsp, rbp (rsp returns to 0x7fff0030, deallocating locals), pop rbp (restores the caller\'s rbp, rsp returns to 0x7fff0038), ret (pops the return address into rip, rsp returns to 0x7fff0040). The caller reads 900 from rax. Every callee-saved register (rbx, r12 through r15) is unchanged.',
        'If compute had taken more than six integer arguments, the 7th and beyond would be pushed onto the stack by the caller before the call instruction, at addresses above the return address. The callee would access them at positive offsets from rbp: [rbp+16] for the 7th argument, [rbp+24] for the 8th, and so on, because [rbp+0] holds the saved rbp and [rbp+8] holds the return address.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The authoritative source for System V AMD64 is the "System V Application Binary Interface: AMD64 Architecture Processor Supplement," maintained by H.J. Lu, Michael Matz, and others (current revision at https://gitlab.com/x86-psABIs/x86-64-ABI). For Windows x64, see Microsoft\'s "x64 calling convention" documentation. For AArch64, see the "Procedure Call Standard for the Arm 64-bit Architecture" (ARM IHI 0055). Agner Fog\'s "Calling conventions for different C++ compilers and operating systems" is an invaluable cross-platform comparison covering System V, Windows, and 32-bit conventions in practical detail.',
        'For the metadata side, see the DWARF Debugging Information Format Standard at https://dwarfstd.org, which specifies the unwind tables that debuggers and exception handlers depend on. For Windows, the structured exception handling mechanism and .pdata/.xdata format are documented in the PE/COFF specification.',
        'Study register allocation next to understand why call-clobber rules force spills and create frame slots. Study instruction selection (SelectionDAG, GlobalISel) to see how abstract function calls become concrete calling sequences. Then look at stack maps and safepoints to see how managed runtimes (JVM, Go, CLR) layer garbage-collection metadata on top of the frame layout. Finally, read the ABI document for your target platform end to end -- calling conventions are specifications, not folklore, and the edge cases live in the fine print.',
      ],
    },
  ],
};
