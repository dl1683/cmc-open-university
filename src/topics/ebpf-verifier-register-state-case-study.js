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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the register table as the verifier state, not as concrete CPU values. Active means the current instruction is updating facts, visited means a path has reached an instruction with known facts, and found means the verifier has enough proof to allow a memory access or helper call.',
        'The safe inference rule is conservative over-approximation. If the verifier says a register is a non-null map-value pointer with offset 0 through 63, then every concrete runtime path represented by that state must satisfy those facts.',
        {type:'callout', text:'The eBPF verifier makes kernel extension safe by replacing runtime trust with load-time proof over abstract register, stack, pointer, and range state.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'eBPF lets user-supplied programs run inside kernel hooks for networking, tracing, security, and observability. The kernel is not a normal sandbox. A bad pointer read can leak memory, corrupt state, or become a security bug.',
        'The verifier is the load-time analyzer that decides whether an eBPF program may run. It symbolically executes bytecode over abstract facts about registers, stack slots, helper calls, pointer provenance, and scalar ranges. If a safety proof is missing, the program is rejected before it attaches.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious safety plan is to scan instructions and ban dangerous operations. Reject arbitrary pointer arithmetic, reject unknown helper calls, and require simple control flow. That catches some bad programs.',
        'Another obvious plan is to add runtime checks before memory loads. That protects specific accesses, but eBPF often runs in hot packet and tracing paths. The system wants to pay proof cost at load time, then run accepted programs with predictable overhead.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is path-sensitive state. A helper may return a nullable pointer, and a later branch may prove it non-null on one path. A scalar may be a safe packet offset only after a bounds check narrows its range.',
        'A local instruction scan cannot see those facts. Exploring every branch with full precision can also explode verification work. The verifier needs enough precision to prove safety and enough pruning to finish.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent each program point with an abstract state. For each register, the verifier tracks kind, provenance, nullability, bounds, and sometimes bit-level knowledge. For the stack, it tracks initialization and stored value kinds.',
        'These facts form a lattice, which means states can become more precise or more general. A nullable map-value pointer becomes more precise after a null check. An unknown scalar becomes more precise after a range check. Unsafe arithmetic can make pointer facts too broad to trust.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each bytecode instruction has a transfer rule. A move copies facts, arithmetic updates scalar ranges, a helper call checks argument registers and writes a documented result into r0, and a load checks pointer type, offset, object size, and stack initialization.',
        'Branches fork abstract states. On the true branch of r2 != 0, a nullable pointer can become non-null. At a join point, the verifier compares states with cached states and prunes exploration only when the old state safely covers the new one.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from conservative abstraction. The abstract state must include every concrete runtime state that could reach the instruction. If an unsafe concrete state is possible, the verifier must keep it in the abstraction or reject the program.',
        'Pruning is sound only when future safety checks cannot distinguish the pruned state from an already explored broader state. Ignoring a dead register is safe when it is overwritten before use. Ignoring a missing stack-initialization fact is not safe because a later load may depend on it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Verifier cost follows instructions multiplied by surviving abstract states. A 200-instruction straight-line program can be cheap, while a 200-instruction program with many branches and loops can produce far more states. Kernel limits exist because verification cannot become an unbounded theorem prover.',
        'Precision has its own cost. More metadata can accept more useful programs and prune more safely, but the verifier becomes harder to implement and audit. A false rejection annoys developers; a false acceptance can become a kernel vulnerability.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This design fits packet filters, Cilium-style datapaths, tracing probes, security monitors, and observability agents. These programs need controlled access to packet buffers, kernel context, maps, and helper APIs without becoming full kernel modules.',
        'It also fits the eBPF programming model because the language surface is intentionally constrained. Helpers have signatures, maps have value sizes, stack access is bounded, loops are restricted, and pointer types are known. The verifier can prove useful properties because the world is smaller than general C.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails from the developer view when a safe program is too hard to prove. A bounds check written in an opaque shape, a value kept in the wrong register, or pointer arithmetic that hides provenance can cause rejection. The program may be logically safe, but the kernel cannot rely on invisible reasoning.',
        'It also varies by kernel version. Helper contracts, loop support, instruction limits, reference tracking, and pruning behavior have changed over time. Portable eBPF code must target the verifier behavior on deployed kernels.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A program calls bpf_map_lookup_elem, and the helper result lands in r0 as map-value pointer or null. If the next instruction reads *(u32 *)(r0 + 0), the verifier rejects it because r0 might be null. After if r0 == 0 goto out, the fallthrough path refines r0 to non-null.',
        'Assume the map value is 64 bytes and r3 is an index multiplied by 4. Without a check, r3 may be 0 through 4,294,967,295, so r0 + r3 is unsafe. A branch that proves r3 < 64 lets the safe path load a u32 inside bytes 0 through 63.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux kernel eBPF verifier documentation at https://docs.kernel.org/bpf/verifier.html, verifier concept guide at https://docs.ebpf.io/linux/concepts/verifier/, Linux Foundation verifier security audit at https://www.linuxfoundation.org/hubfs/eBPF/eBPF%20Verifier%20Security%20Audit.pdf, and Agni range-analysis paper at https://people.cs.rutgers.edu/~sn349/papers/agni-cav2023.pdf. Use the kernel docs for current rules and the paper for range-analysis framing.',
        'Study Abstract Interpretation, Interval Domains, Data-Flow Worklist Analysis, Symbolic Execution Path Constraints, Capability Security, eBPF Ring Buffer Telemetry, and Cilium eBPF Datapath to connect verifier facts to production programs. The theory topics explain the proof shape; the eBPF topics show why the proof matters.',
      ],
    },
  ],
};
