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
      heading: 'What it is',
      paragraphs: [
        'A zkVM proves that a program executed correctly by recording a machine execution trace and proving that the trace satisfies algebraic constraints. The developer writes a guest program; the prover turns its execution into a table; the verifier checks a receipt.',
        'In STARK-style systems, the trace is constrained with AIR and then low-degree tested, often with FRI. This lets a verifier check a large computation without replaying every step.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The executor runs the guest program and records rows: program counter, opcode, registers, memory events, and helper columns. AIR constraints enforce instruction semantics, boundary conditions, range checks, and memory consistency.',
        'The prover commits to trace columns and constraint columns, receives random challenges, opens sampled positions, and produces a receipt. The verifier checks the receipt, program identity, and public output journal.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'A guest program computes a hash or verifies a signature. The zkVM trace records every VM step. The AIR ensures every step follows the ISA rules and memory accesses are consistent. The final receipt says that this program, identified by its image ID, produced this public output.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'zkVMs trade hand-written circuits for general-purpose execution. The cost is a larger proving system and a careful boundary between guest code, host code, public outputs, and cryptographic verification.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not verify a proof without checking the program image ID and public journal. Do not assume host-side code is proven. Do not confuse a valid VM execution with a correct application-level statement unless the guest program actually checks that statement.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RISC Zero STARK by Hand at https://dev.risczero.com/proof-system/stark-by-hand, RISC Zero security model at https://dev.risczero.com/api/security-model, and FRI docs at https://dev.risczero.com/reference-docs/about-fri. Study FRI Low-Degree Folding, Merkle Tree, ZK-SNARK Arithmetization, and Finite State Machine next.',
      ],
    },
  ],
};
