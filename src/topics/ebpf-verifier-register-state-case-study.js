// eBPF verifier register-state case study: abstract execution over registers,
// stack slots, pointer types, scalar ranges, state caches, and bounded paths.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'ebpf-verifier-register-state-case-study',
  title: 'eBPF Verifier Register State Case Study',
  category: 'Security',
  summary: 'The eBPF verifier is a kernel safety analyzer: it symbolically executes bytecode, tracks register types and ranges, forks branch states, and rejects unsafe memory access.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['register state lattice', 'state pruning case study'], defaultValue: 'register state lattice' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function verifierGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'bytecode', label: 'BPF insns', x: 0.8, y: 4.0, note: notes.bytecode ?? 'program' },
      { id: 'state', label: 'reg state', x: 2.8, y: 4.0, note: notes.state ?? 'types/ranges' },
      { id: 'branch', label: 'fork', x: 4.8, y: 2.2, note: notes.branch ?? 'if' },
      { id: 'queue', label: 'state queue', x: 4.8, y: 5.8, note: notes.queue ?? 'pending paths' },
      { id: 'bounds', label: 'bounds', x: 6.8, y: 2.2, note: notes.bounds ?? 'refine' },
      { id: 'helper', label: 'helper call', x: 6.8, y: 5.8, note: notes.helper ?? 'checked args' },
      { id: 'cache', label: 'state cache', x: 8.8, y: 5.8, note: notes.cache ?? 'prune' },
      { id: 'decision', label: 'decision', x: 8.8, y: 2.2, note: notes.decision ?? 'accept/reject' },
    ],
    edges: [
      { id: 'e-bytecode-state', from: 'bytecode', to: 'state', weight: 'simulate' },
      { id: 'e-state-branch', from: 'state', to: 'branch', weight: 'cond' },
      { id: 'e-branch-bounds', from: 'branch', to: 'bounds', weight: 'true' },
      { id: 'e-branch-queue', from: 'branch', to: 'queue', weight: 'false later' },
      { id: 'e-state-helper', from: 'state', to: 'helper', weight: 'call' },
      { id: 'e-helper-cache', from: 'helper', to: 'cache', weight: 'checkpoint' },
      { id: 'e-bounds-decision', from: 'bounds', to: 'decision', weight: 'safe?' },
      { id: 'e-cache-decision', from: 'cache', to: 'decision', weight: 'seen?' },
    ],
  }, { title });
}

function* registerStateLattice() {
  yield {
    state: labelMatrix(
      'Verifier register facts',
      [
        { id: 'r1', label: 'r1' },
        { id: 'r2', label: 'r2' },
        { id: 'r3', label: 'r3' },
        { id: 'r10', label: 'r10' },
      ],
      [
        { id: 'type', label: 'type' },
        { id: 'range', label: 'range' },
        { id: 'nullable', label: 'null?' },
        { id: 'permission', label: 'access' },
      ],
      [
        ['ctx', 'fixed', 'no', 'ctx'],
        ['map', 'size', 'maybe', 'check'],
        ['scalar', '0..63', '-', 'offset'],
        ['stack', 'frame', 'no', 'neg'],
      ],
    ),
    highlight: { active: ['r2:type', 'r2:nullable', 'r3:range'], compare: ['r10:permission'] },
    explanation: 'The eBPF verifier does not just track integer values. It tracks register type, pointer provenance, signed and unsigned ranges, nullability, stack initialization, and helper-call contracts.',
  };

  yield {
    state: verifierGraph('The verifier symbolically executes bytecode before load'),
    highlight: { active: ['bytecode', 'state', 'e-bytecode-state'], found: ['decision'] },
    explanation: 'Before a program can run in the kernel, the verifier simulates possible execution paths and updates an abstract state for registers and stack slots at each instruction.',
    invariant: 'The kernel must reject a program when safety cannot be proven within verifier limits.',
  };

  yield {
    state: labelMatrix(
      'Null check refines a map lookup result',
      [
        { id: 'lookup', label: 'map_lookup' },
        { id: 'ifnull', label: 'if r2 == 0' },
        { id: 'nonnull', label: 'nonnull path' },
        { id: 'bad', label: 'missing check' },
      ],
      [
        { id: 'r2', label: 'r2 fact' },
        { id: 'access', label: 'memory access' },
      ],
      [
        ['ptr or null', 'not allowed yet'],
        ['fork paths', 'null exits'],
        ['map value ptr', 'allowed within size'],
        ['maybe null', 'reject dereference'],
      ],
    ),
    highlight: { active: ['lookup:r2', 'ifnull:r2', 'nonnull:access'], removed: ['bad:access'] },
    explanation: 'A map lookup can return null. The verifier accepts a dereference only on a path where a branch has refined the register from nullable pointer to non-null map-value pointer.',
  };

  yield {
    state: verifierGraph('Bounds checks refine scalar offsets before pointer arithmetic', { branch: 'r3 < 64', bounds: 'r3=[0,63]', decision: 'load ok' }),
    highlight: { active: ['branch', 'bounds', 'decision', 'e-branch-bounds', 'e-bounds-decision'], compare: ['queue'] },
    explanation: 'When a branch constrains a scalar index, the verifier forks states and narrows the range on each path. A later pointer access is accepted only if the refined offset stays within the allowed memory region.',
  };
}

function* statePruningCaseStudy() {
  yield {
    state: labelMatrix(
      'Two paths reach the same checkpoint',
      [
        { id: 'pathA', label: 'path A' },
        { id: 'pathB', label: 'path B' },
        { id: 'checkpoint', label: 'instruction 4' },
      ],
      [
        { id: 'r0', label: 'r0' },
        { id: 'r1', label: 'r1' },
        { id: 'next', label: 'next instruction' },
      ],
      [
        ['1', '0', 'r0 = r1'],
        ['0', '0', 'r0 = r1'],
        ['differs now', 'same useful fact', 'states equivalent enough'],
      ],
    ),
    highlight: { active: ['pathA:r1', 'pathB:r1', 'checkpoint:next'], compare: ['pathA:r0', 'pathB:r0'] },
    explanation: 'Kernel verifier documentation describes a checkpoint where two paths differ in r0 but share r1=0, and the next instruction overwrites r0 from r1. The older r0 difference is irrelevant.',
  };

  yield {
    state: verifierGraph('State cache prevents exponential path explosion', { queue: 'queued states', cache: 'subsumed?', decision: 'prune or run' }),
    highlight: { active: ['queue', 'cache', 'decision', 'e-helper-cache', 'e-cache-decision'], compare: ['branch'] },
    explanation: 'The verifier stores checkpoint states. If a newly reached state is already covered by an older state for future execution, the verifier can prune that path instead of exploring duplicate work.',
  };

  yield {
    state: labelMatrix(
      'Why state equivalence is subtle',
      [
        { id: 'unused', label: 'dead register fact' },
        { id: 'range', label: 'wider scalar range' },
        { id: 'ptr', label: 'different pointer type' },
        { id: 'stack', label: 'stack init bit' },
      ],
      [
        { id: 'canPrune', label: 'can prune?' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['often yes', 'future overwrites it'],
        ['only if covered', 'must stay sound'],
        ['usually no', 'access rules differ'],
        ['usually no', 'uninit read risk'],
      ],
    ),
    highlight: { active: ['unused:canPrune', 'range:reason'], compare: ['ptr:canPrune', 'stack:reason'] },
    explanation: 'Pruning is a data-structure problem and a soundness problem. The cache needs enough precision to reject unsafe programs while avoiding a combinatorial explosion of equivalent states.',
  };

  yield {
    state: verifierGraph('Verifier rejection is a proof failure, not a runtime crash', { state: 'unknown safety', bounds: 'not proven', decision: 'reject' }),
    highlight: { active: ['state', 'bounds', 'decision'], removed: ['helper'], compare: ['cache'] },
    explanation: 'If a path leaves a pointer maybe null, an offset out of bounds, a stack slot uninitialized, or a helper argument with the wrong type, the safe decision is rejection before the program reaches a kernel hook.',
    invariant: 'Verifier false negatives hurt usability; verifier false positives can become kernel vulnerabilities.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'register state lattice') yield* registerStateLattice();
  else if (view === 'state pruning case study') yield* statePruningCaseStudy();
  else throw new InputError('Pick an eBPF verifier view.');
}

export const article = {
  sections: [
    {
      heading: 'Why eBPF Needs a Verifier',
      paragraphs: [
        "eBPF exists because the operating system needs a safe way to let small user-supplied programs run inside kernel hooks. Networking, tracing, security monitoring, load balancing, and observability all benefit from code that can run near packets, sockets, processes, and kernel events. The problem is that kernel execution is not a normal sandbox. A bad pointer read is not just a process crash. It can leak kernel memory, corrupt state, or become an attack primitive.",
        "The verifier is the gate between useful extension and arbitrary kernel code. Before an eBPF program is loaded, the verifier symbolically executes the bytecode and proves enough safety facts for every possible path it can see. It checks memory access, pointer provenance, stack initialization, helper-call contracts, bounded loops, scalar ranges, and reference lifetimes. If the proof is missing, the program is rejected before it ever attaches to a hook.",
        "This makes the eBPF verifier a practical case study in abstract interpretation. It does not run the program on real packets or real kernel objects. It runs the program over abstract states: summaries of what each register and stack slot could contain. The quality of those summaries determines whether useful programs load, unsafe programs are blocked, and verification finishes in time.",
      ],
    },
    {
      heading: 'The Naive Safety Plan',
      paragraphs: [
        "The obvious plan is to scan the bytecode and ban dangerous instructions. Forbid arbitrary pointer arithmetic. Allow only known helper calls. Reject backward jumps. Insert runtime checks before loads. That plan feels attractive because it turns safety into a local rule: look at one instruction, decide if it is allowed, move on.",
        "That is not enough for real eBPF. Safety often depends on facts created earlier in the program. A helper call can return either a map-value pointer or null. A conditional branch can prove the pointer is non-null on one path. A scalar register can be safe as a packet offset only after a bounds check narrows its range. A stack read is safe only if some earlier path initialized the slot. These are not visible from the opcode alone.",
        "Runtime checks are also not the whole answer. eBPF programs run in hot kernel paths, so adding broad dynamic checks to every load would weaken the point of eBPF. The design goal is to pay a verification cost once at load time, then let accepted programs run with predictable overhead.",
      ],
    },
    {
      heading: 'The Wall: Path-Sensitive State',
      paragraphs: [
        "The hard case is path-sensitive state. The verifier must know not just that register r2 once held a nullable pointer, but that on the branch after `if r2 != 0`, r2 is a non-null map-value pointer. It must know that r3 is not just a scalar, but a scalar whose unsigned range is now 0 through 63. It must know that r10 is the frame pointer and that only negative stack offsets in initialized slots are readable.",
        "Naively, the verifier could fork a complete copy of the state at every branch and explore everything. That is sound, but branch-heavy code can revisit the same instruction many times with slightly different register facts. Without pruning, verification time can grow explosively. With careless pruning, the verifier can miss an unsafe path. The central engineering problem is to be precise enough to prove safety and coarse enough to finish.",
      ],
    },
    {
      heading: 'Core insight: Abstract Register State',
      paragraphs: [
        "Each eBPF instruction is interpreted over a verifier state. The state is not a concrete machine snapshot. It is a table of facts about registers and stack slots. For a register, the verifier may track whether it is a scalar, context pointer, map pointer, map-value pointer, packet pointer, stack pointer, socket pointer, reference, or nullable variant. For scalar values, it tracks signed and unsigned bounds and bit-level knowledge. For stack slots, it tracks whether bytes have been written and what kind of value may be stored there.",
        "This table is a lattice: facts can become more precise or less precise as execution continues. A scalar with unknown value is broad. A scalar known to be between 0 and 63 is narrower. A nullable map-value pointer becomes narrower after a null check. Pointer arithmetic can also destroy useful facts if the verifier can no longer prove the resulting address stays inside the allowed object.",
        "Every bytecode instruction has a transfer rule. A move copies facts. An arithmetic operation updates scalar bounds or invalidates pointer precision. A helper call checks the argument register types against the helper signature, then writes the documented result type into r0. A memory load checks the pointer type, offset range, object size, and initialization rules before allowing the instruction to proceed.",
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "The register-state view shows the verifier as a fact table. The important lesson is that a register is not just a number. It has a kind, a provenance, a range, a nullability state, and permissions that decide what later instructions may do. When the highlighted cells move from a nullable pointer or wide scalar toward a non-null pointer or bounded offset, the verifier is gaining proof power.",
        "The pruning view shows why verification is also a search problem. Two paths can arrive at the same instruction with different old facts. Some differences matter for future safety, and some are dead because a later instruction overwrites the register. A good verifier cache notices when a new state is already covered by an explored state, then avoids repeating work without weakening the proof.",
      ],
    },
    {
      heading: 'Worked Example: Map Lookup and Bounds',
      paragraphs: [
        "Suppose a program calls a map lookup helper. The helper result lands in r0, and the verifier records the type as map-value pointer or null. If the next instruction dereferences r0 immediately, the verifier rejects it. A null pointer is still possible. The program must branch first, usually by checking whether r0 is zero.",
        "On the non-null path, the verifier refines r0 from nullable map-value pointer to map-value pointer. Now a load through r0 can be legal, but only within the value size of the map and only with an offset the verifier can bound. If the program computes `r3 = user_index * 4`, the verifier needs a range for r3. A check like `if r3 >= 64 goto out` lets the safe path carry r3 in the range 0 through 63, so `*(u32 *)(r0 + r3)` can be accepted for a 64-byte value.",
        "The rejected version is almost identical at the source-code level: skip the null check, use an index whose maximum is unknown, or add arithmetic that erases pointer provenance. That is the point of the verifier. It is not judging style. It is checking whether the safety facts needed at the load site are present on every reaching path.",
      ],
    },
    {
      heading: 'Why the Proof Is Sound',
      paragraphs: [
        "The soundness argument is conservative over-approximation. At each instruction, the abstract state must include every concrete runtime state that could reach that point. If the verifier says r3 is in 0 through 63, then every concrete r3 on that path must be inside that range. If the verifier cannot prove such a bound, it must keep a wider range or reject the access.",
        "This is why rejection is not a runtime failure. It is a proof failure. The program may be safe for reasons the verifier cannot express, but the kernel cannot rely on invisible facts. Unknown pointer provenance, maybe-null values, uninitialized stack bytes, invalid helper arguments, and too-wide offsets all fall to the same rule: no proof, no load.",
        "State pruning is sound under a related rule. A cached state may cover a new state only if exploring from the cached state is at least as general for all future instructions. A dead register difference can be ignored when the next instruction overwrites it. A missing stack initialization bit, different pointer type, or wider unsafe scalar range cannot be ignored because a later instruction may depend on it.",
      ],
    },
    {
      heading: 'Costs and Tradeoffs',
      paragraphs: [
        "Verifier cost is roughly proportional to the number of instructions times the number of abstract states that survive pruning. Straight-line code is cheap. Branches, loops, helper effects, reference lifetimes, and scalar range splits increase the number of states. The verifier has limits because it runs while loading a program into the kernel; it cannot become an unbounded theorem prover.",
        "Precision costs memory and implementation complexity. Every live register and relevant stack slot carries metadata. More precise range analysis and pointer tracking can accept more useful programs and prune more safely, but the verifier itself becomes harder to audit. A verifier bug is serious because the verifier is part of the kernel security boundary.",
        "The user-facing tradeoff is false rejection versus safety. A conservative verifier rejects some programs that would not actually misbehave. That is frustrating for eBPF developers, but it is the expected bias. A false acceptance can become a kernel vulnerability.",
      ],
    },
    {
      heading: 'Where This Design Wins',
      paragraphs: [
        "The design fits eBPF because eBPF programs are constrained, loaded ahead of execution, and often run in hot paths. Packet filters, Cilium-style datapaths, tracing probes, observability agents, and security monitors need controlled access to kernel context, maps, packet buffers, and helper APIs. The verifier lets those programs run close to the kernel without giving them the full authority of kernel modules.",
        "It also works well when the allowed API surface is explicit. Helpers have known signatures. Maps have known value sizes. Packet pointers have known bounds. Stack rules are local. The verifier can build a useful proof because the execution model is deliberately narrower than a general-purpose language with arbitrary heap mutation and recursion.",
      ],
    },
    {
      heading: 'Where It Fails or Frustrates',
      paragraphs: [
        "The verifier is intentionally conservative. It can reject a program that is actually safe but too hard to prove within current rules. Developers often experience this as a strange compiler error: add a bounds check in the wrong shape, keep a value in the wrong register, or use pointer arithmetic that is obvious to a human but opaque to the verifier, and the program fails to load.",
        "It is also kernel-version sensitive. Helper contracts, supported pointer types, loop support, instruction limits, reference tracking, and pruning precision have changed over time. Portable eBPF code must target the verifier behavior on the kernels where it will actually run, not just the newest documentation.",
        "This is the wrong design for large general programs with rich heap structures, arbitrary recursion, or safety arguments that require deep semantic reasoning. eBPF gets its safety and performance by keeping the program model small enough for a load-time analyzer.",
      ],
    },
    {
      heading: 'Common Misconceptions',
      paragraphs: [
        "First, the verifier is not just a type checker. It tracks types, but it also tracks ranges, pointer offsets, stack initialization, branch refinements, helper effects, and state equivalence. Calling it a type checker hides the data-flow part of the problem.",
        "Second, accepted eBPF is not automatically correct. The verifier proves a kernel-safety property, not business logic. A packet program can be safe and still route packets incorrectly. A tracing program can be safe and still report the wrong metric. Safety is necessary, not sufficient.",
        "Third, verifier rejection does not mean the kernel found a concrete exploit. It means the abstract proof was insufficient. The right fix is usually to write code in a shape that exposes the needed facts: explicit null checks, simple bounds checks, bounded loops, initialized stack slots, and helper calls with the expected register setup.",
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        "Primary sources: Linux kernel eBPF verifier documentation at https://docs.kernel.org/bpf/verifier.html, eBPF verifier concept guide at https://docs.ebpf.io/linux/concepts/verifier/, Linux Foundation verifier security audit at https://www.linuxfoundation.org/hubfs/eBPF/eBPF%20Verifier%20Security%20Audit.pdf, and Agni eBPF range-analysis paper at https://people.cs.rutgers.edu/~sn349/papers/agni-cav2023.pdf.",
        "Study Abstract Interpretation and Interval Domains for the proof model, Data-Flow Worklist Analysis for state propagation, Symbolic Execution Path Constraints for branch splitting, Capability Security for controlled authority, and the Cilium eBPF Datapath Case Study for a production system that depends on these verifier guarantees.",
      ],
    },
  ],
};
