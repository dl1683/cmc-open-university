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
      heading: 'What it is',
      paragraphs: [
        'The eBPF verifier is the kernel analysis that checks an eBPF program before it can run. It symbolically executes bytecode, tracks register and stack state, checks helper-call contracts, proves memory accesses safe, and rejects programs whose safety cannot be established.',
        'This is abstract interpretation in a production kernel. The abstract state includes register types, pointer provenance, scalar bounds, nullability, stack initialization, and path constraints.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At each instruction, the verifier updates an abstract state. Branches fork states and refine facts: if r3 < 64, one path can narrow r3 to the safe range and the other path gets the complementary range. Helper calls check argument types and return typed results such as nullable map-value pointers.',
        'The verifier also caches states at checkpoints. If a new state is covered by a previously explored state, the path can be pruned. Without this, branch-heavy programs could explode into too many paths to inspect.',
      ],
    },
    {
      heading: 'Case study: safe map-value access',
      paragraphs: [
        'A program calls bpf_map_lookup_elem and receives r2 as either a map-value pointer or null. If it dereferences r2 immediately, the verifier rejects the program. If it first checks r2 != 0, the non-null branch refines r2 to a map-value pointer, and bounded accesses within the map value size can be accepted.',
        'For packet or context access, scalar offsets need range proofs. A branch such as if r3 < 64 can refine r3 on the true path. The later load is safe only when pointer base, offset range, and region size prove the access is inside bounds.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'The verifier is intentionally conservative. It may reject a program that is safe but too hard to prove. That is a usability problem, but the opposite mistake is worse: an unsound range or pointer proof can permit out-of-bounds kernel memory access.',
        'Verifier limits are part of the model. Instruction count, branch complexity, stack bounds, helper signatures, map types, loops, and kernel version all affect whether a program is accepted.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux kernel eBPF verifier documentation at https://docs.kernel.org/bpf/verifier.html, eBPF verifier concept guide at https://docs.ebpf.io/linux/concepts/verifier/, Linux Foundation verifier security audit at https://www.linuxfoundation.org/hubfs/eBPF/eBPF%20Verifier%20Security%20Audit.pdf, and Agni eBPF range-analysis paper at https://people.cs.rutgers.edu/~sn349/papers/agni-cav2023.pdf. Study Abstract Interpretation & Interval Domain, Data-Flow Worklist Analysis, Symbolic Execution Path Constraints, eBPF LPM Trie CIDR Policy Case Study, eBPF Ring Buffer Telemetry Case Study, Cilium eBPF Datapath Case Study, and Prompt Injection Threat Model next.',
      ],
    },
  ],
};
