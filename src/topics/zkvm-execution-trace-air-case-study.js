// zkVM proving: execute a VM, record a trace table, constrain transitions with
// AIR, commit columns, and verify a receipt.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'zkvm-execution-trace-air-case-study',
  title: 'zkVM Execution Trace AIR Case Study',
  category: 'Security',
  summary: 'A zkVM/STARK case study: guest program execution, trace columns, memory/register rows, AIR transition constraints, Merkle commitments, FRI proof, and receipt verification.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['trace table', 'receipt pipeline'], defaultValue: 'trace table' },
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

function zkvmGraph(title) {
  return graphState({
    nodes: [
      { id: 'guest', label: 'guest', x: 0.8, y: 3.6, note: 'code' },
      { id: 'exec', label: 'exec', x: 2.5, y: 3.6, note: 'VM' },
      { id: 'trace', label: 'trace', x: 4.2, y: 2.0, note: 'rows' },
      { id: 'air', label: 'AIR', x: 4.2, y: 5.2, note: 'rules' },
      { id: 'commit', label: 'commit', x: 6.2, y: 3.6, note: 'roots' },
      { id: 'fri', label: 'FRI', x: 7.7, y: 3.6, note: 'low deg' },
      { id: 'receipt', label: 'receipt', x: 9.1, y: 3.6, note: 'verify' },
    ],
    edges: [
      { id: 'e-guest-exec', from: 'guest', to: 'exec' },
      { id: 'e-exec-trace', from: 'exec', to: 'trace' },
      { id: 'e-trace-air', from: 'trace', to: 'air' },
      { id: 'e-trace-commit', from: 'trace', to: 'commit' },
      { id: 'e-air-commit', from: 'air', to: 'commit' },
      { id: 'e-commit-fri', from: 'commit', to: 'fri' },
      { id: 'e-fri-receipt', from: 'fri', to: 'receipt' },
    ],
  }, { title });
}

function* traceTable() {
  yield {
    state: zkvmGraph('A zkVM records execution as a trace table'),
    highlight: { active: ['guest', 'exec', 'trace', 'e-guest-exec', 'e-exec-trace'], compare: ['receipt'] },
    explanation: 'A zkVM runs a guest program and records a structured execution trace. Each row is a machine step; each column is a register, memory, opcode, clock, or helper value.',
  };
  yield {
    state: labelMatrix(
      'Trace rows',
      [
        { id: 't0', label: 't0' },
        { id: 't1', label: 't1' },
        { id: 't2', label: 't2' },
        { id: 't3', label: 't3' },
      ],
      [
        { id: 'pc', label: 'pc' },
        { id: 'op', label: 'op' },
        { id: 'r1', label: 'r1' },
        { id: 'mem', label: 'mem' },
      ],
      [
        ['0', 'load', '4', 'A'],
        ['4', 'add', '7', 'A'],
        ['8', 'store', '7', 'B'],
        ['12', 'halt', '7', 'B'],
      ],
    ),
    highlight: { active: ['t0:op', 't1:op', 't2:op', 't3:op'], found: ['t1:r1', 't2:mem'] },
    explanation: 'The trace is a table, not a log string. Rows must be constrained so the next row follows from the previous row according to the VM instruction semantics.',
    invariant: 'The proof checks a valid execution trace, not a human-readable transcript.',
  };
  yield {
    state: labelMatrix(
      'AIR rules',
      [
        { id: 'pc', label: 'pc' },
        { id: 'op', label: 'op' },
        { id: 'reg', label: 'reg' },
        { id: 'mem', label: 'mem' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'scope', label: 'scope' },
      ],
      [
        ['pc += 4', 'step'],
        ['decode', 'row'],
        ['r next', 'trans'],
        ['perm', 'global'],
      ],
    ),
    highlight: { found: ['pc:rule', 'op:rule', 'reg:rule', 'mem:rule'] },
    explanation: 'AIR, or algebraic intermediate representation, describes constraints over the trace: transition rules, boundary rules, memory consistency, and range checks.',
  };
  yield {
    state: plotState({
      axes: { x: { label: 'step', min: 0, max: 12 }, y: { label: 'degree load', min: 0, max: 10 } },
      series: [
        { id: 'cpu', label: 'cpu', points: [{ x: 0, y: 2 }, { x: 3, y: 3 }, { x: 6, y: 4 }, { x: 9, y: 4 }, { x: 12, y: 5 }] },
        { id: 'mem', label: 'mem', points: [{ x: 0, y: 1 }, { x: 3, y: 2 }, { x: 6, y: 5 }, { x: 9, y: 7 }, { x: 12, y: 7 }] },
      ],
      markers: [
        { id: 'hot', x: 9, y: 7, label: 'mem hot' },
      ],
    }),
    highlight: { active: ['cpu', 'mem', 'hot'] },
    explanation: 'Different VM components contribute different constraint costs. Memory consistency and lookup-heavy instructions can dominate prover work even when the guest program looks simple.',
  };
}

function* receiptPipeline() {
  yield {
    state: zkvmGraph('Trace and AIR become committed polynomials'),
    highlight: { active: ['trace', 'air', 'commit', 'e-trace-commit', 'e-air-commit'], compare: ['guest'] },
    explanation: 'The prover commits to trace-derived columns and constraint evaluations. The commitment binds the prover before verifier challenges choose sampled rows.',
  };
  yield {
    state: zkvmGraph('FRI proves low-degree trace relations'),
    highlight: { active: ['commit', 'fri', 'receipt', 'e-commit-fri', 'e-fri-receipt'], found: ['air'], compare: ['exec'] },
    explanation: 'A STARK-style zkVM uses low-degree testing to convince the verifier that the committed trace satisfies the AIR constraints. FRI is the low-degree proof engine in many such systems.',
  };
  yield {
    state: labelMatrix(
      'Receipt fields',
      [
        { id: 'image', label: 'image' },
        { id: 'journal', label: 'journal' },
        { id: 'proof', label: 'proof' },
        { id: 'seal', label: 'seal' },
      ],
      [
        { id: 'holds', label: 'holds' },
        { id: 'check', label: 'check' },
      ],
      [
        ['program id', 'bind code'],
        ['public out', 'app data'],
        ['STARK', 'math'],
        ['bytes', 'verify'],
      ],
    ),
    highlight: { found: ['image:check', 'journal:check', 'proof:check', 'seal:check'] },
    explanation: 'A receipt binds the proof to a program identity and public outputs. Verification should check both the cryptographic proof and the application statement being claimed.',
  };
  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'code', label: 'code id' },
        { id: 'input', label: 'input' },
        { id: 'trace', label: 'trace' },
        { id: 'host', label: 'host' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['wrong ELF', 'image id'],
        ['bad public', 'journal'],
        ['bad step', 'AIR fail'],
        ['trust leak', 'verify all'],
      ],
    ),
    highlight: { active: ['code:guard', 'input:guard', 'trace:guard'], compare: ['host:risk'] },
    explanation: 'The proof only covers the guest computation and public statement. Host-side assumptions, unchecked inputs, or wrong program IDs can still make an application insecure.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'trace table') yield* traceTable();
  else if (view === 'receipt pipeline') yield* receiptPipeline();
  else throw new InputError('Pick a zkVM trace view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the trace-table view as one program execution flattened into rows. Active cells are the machine state being checked now, compare cells are the next-row values that must follow from it, and found cells are constraints already satisfied. A safe inference is this: a valid row transition proves one VM step only if the AIR actually encodes that instruction rule.',
        'A zkVM is a zero-knowledge virtual machine: it runs a guest program and produces a cryptographic receipt that the execution followed the VM rules. AIR means algebraic intermediate representation, a set of algebraic constraints over an execution trace. The receipt pipeline shows how trace, constraints, and public journal become a verifiable claim.',
        {type: 'callout', text: 'A zkVM receipt is only as trustworthy as the trace constraints, program identity, and public statement that it binds together.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Writing a custom circuit for every application is slow and error-prone. A zkVM offers another route: write ordinary guest code for a supported instruction set, run it, and prove that the run was valid. The developer pays proving overhead to avoid hand-building every circuit.',
        'The verifier wants a narrow claim. It may want to know that a private input passed a rule, that a compiled artifact came from a source, or that an off-chain computation produced a public output. The verifier should not rerun the whole program or see every private input.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is deterministic replay. Give the verifier the program, the inputs, and the environment, then let it run the computation again. That is simple when the computation is small and public.',
        'Replay fails when inputs are private, execution is expensive, or many verifiers need to check the same result. It also fails when the verifier cannot trust the environment that produced the answer. A receipt lets the verifier check a compact proof instead of executing the whole trace.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that a program execution is messy. The VM has a program counter, opcodes, registers, memory reads, memory writes, range limits, system calls, and public output. The proof system needs all of that turned into algebra without leaving gaps.',
        'The guest-host boundary is the dangerous edge. The proof covers what the guest program and VM constraints enforce. It does not automatically prove the host code, the UI text, the source repository, the wall-clock time, or any business rule that stayed outside the guest.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to represent execution as a table. Each row is a VM step, and each column records a component such as program counter, opcode, register value, memory address, or helper variable. Valid execution means adjacent rows obey the instruction semantics.',
        'AIR writes those semantics as polynomial constraints over the table. Boundary constraints set the initial and final conditions. Memory and range constraints make sure the table does not cheat by reading impossible values or using out-of-range fields.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The prover runs the guest program and records the trace table. It then commits to polynomial encodings of trace columns and answers verifier challenges using the proof protocol. In STARK-style systems, FRI is often used to prove that certain polynomials have low enough degree.',
        'The receipt must bind more than math. It needs the guest image id, the public journal, and the proof bytes. The image id tells the verifier which program was proven, and the journal is the public output that the application is allowed to read.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is simulation by constraints. If every opcode transition, memory relation, range rule, and boundary rule is enforced, then an accepting trace corresponds to a valid execution of the VM. The proof lets the verifier check that structure without reading the whole table.',
        'Program identity closes the application gap. A proof that some guest ran is not useful. The verifier must check that the image id is the approved program and that the journal fields are bound to the action being authorized.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The prover cost grows with trace length and constraint complexity. If a guest program takes 2,000,000 VM cycles and a change makes it take 4,000,000 cycles, the trace roughly doubles before proof-system constants. Memory checks, recursion, and lookup tables can dominate real proving time.',
        'The verifier cost is much smaller, but that can mislead product teams. A receipt that verifies in milliseconds may have required seconds or minutes of proving. A serious integration tracks cycle count, proving time, verifier time, receipt size, guest version, and assumptions left on the host side.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'zkVMs fit verifiable computation where developers want proof-carrying programs instead of custom circuits. Uses include rollup execution, private policy checks, software provenance, reproducible build claims, off-chain computation receipts, and audit workflows. The fit is strongest when the proof statement can be kept narrow.',
        'They are also useful as an education bridge. Registers, memory, program counters, and opcodes are familiar machine concepts. zkVMs show how those concepts become algebraic constraints and then a receipt that another system can verify.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the application proves the wrong statement. A receipt can be mathematically valid while the product forgot to check the image id or accepted a journal field with the wrong schema. The proof narrows trust only if the verifier binds it to the right action.',
        'It can also fail on cost. A program with heavy memory traffic, large hashes, or many unsupported host interactions can create an enormous trace. If proving time is longer than the business process can tolerate, a smaller custom circuit or ordinary audit trail may be better.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a guest program verifies a signature over artifact hash H and writes accepted = 1 and artifact = H to the journal. The trace has 500,000 VM cycles. The AIR checks instruction steps, memory consistency, and the final journal write.',
        'The application verifier must still check the receipt uses image id I, where I is the approved verifier program. It must also check the journal artifact equals the artifact being released. If it skips either check, an attacker may present a valid receipt for a different guest or a different artifact.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with RISC Zero STARK by Hand at https://dev.risczero.com/proof-system/stark-by-hand and the RISC Zero security model at https://dev.risczero.com/api/security-model. Use those sources to separate trace proving from the application checks that bind image id and journal.',
        'Study ZK-SNARK Arithmetization for the general translation problem, FRI Low-Degree Folding Proof Case Study for low-degree checking, Merkle Tree for commitments, and Finite State Machine for transition-rule thinking.',
      ],
    },
  ],
};
