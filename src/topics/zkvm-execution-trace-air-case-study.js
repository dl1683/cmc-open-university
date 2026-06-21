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
    { heading: 'Why this exists', paragraphs: ['Hand-writing a circuit for every application is powerful but expensive. A zkVM offers a different bargain: write a guest program for a virtual machine, execute it, and prove that the execution was valid.', 'The proof is not magic around source code. The prover records a machine trace, constrains that trace with algebraic rules, commits to it, and produces a receipt that a verifier can check much faster than replaying the computation.', {type: 'callout', text: 'A zkVM receipt is only as trustworthy as the trace constraints, program identity, and public statement that it binds together.'}] },
    { heading: 'The obvious approach', paragraphs: ['The obvious way to verify a program is to run it again. That is fine when the verifier has the time, inputs, environment, and trust boundary needed to replay the computation.', 'A zkVM is useful when the verifier wants a compact proof that a specific program produced specific public outputs, while private inputs or expensive execution stay with the prover.'] },
    { heading: 'The wall', paragraphs: ['A program execution is messy: program counters, opcodes, registers, memory reads and writes, range limits, control flow, and host interactions. A proof system needs this mess turned into algebra.', 'The dangerous boundary is between guest and host. The proof covers what the guest program and VM constraints actually enforce. It does not automatically prove host-side code, unchecked assumptions, UI claims, or off-chain policy.'] },
    { heading: 'The core insight', paragraphs: ['A VM execution can be represented as a trace table. Each row is a step. Each column is a machine component: pc, opcode, registers, memory events, helper values, and component-specific state.', 'AIR, or algebraic intermediate representation, defines constraints over that table: transition rules, boundary conditions, memory consistency, range checks, and component interactions. Once the trace is constrained, STARK machinery and FRI can prove the table has the required structure.'] },
    { heading: 'Mechanism', paragraphs: ['The trace-table view is the central mental shift. A zkVM proof is not a log file. It is a constrained table where the next row must follow from the previous row according to the VM instruction semantics.', 'The receipt-pipeline view shows the trust path: guest code runs, trace and AIR become committed polynomial data, FRI proves low-degree consistency, and the receipt binds the proof to program identity and public outputs.', 'This is also why a zkVM feels different from a traditional VM. The VM is not only executing instructions; it is producing evidence that the instruction stream, memory behavior, and public outputs are mutually consistent.'] },
    { heading: 'Why it works', paragraphs: ['If every transition, memory relation, range condition, and boundary rule is enforced, then a valid trace corresponds to a valid execution of the VM. The proof system lets the verifier check a compressed version of those constraints.', 'Program identity matters because a proof of "some program ran" is not useful. The receipt must bind the image ID, public journal, and proof bytes so the verifier knows exactly what statement was proven.'] },
    { heading: 'Complete case study', paragraphs: ['A guest program verifies a signature over an artifact hash and writes the accepted artifact ID to the public journal. The trace records every VM step. AIR ensures instruction semantics and memory consistency. The receipt binds the image ID and journal.', 'The application verifier must still check that the image ID is the approved verifier program and that the journal contains the expected artifact ID. Without those checks, a valid receipt can be attached to the wrong application claim.'] },
    { heading: 'Cost and behavior', paragraphs: ['zkVMs trade developer ergonomics for proving overhead. They reduce the need to hand-design circuits, but the prover may pay heavily for VM execution, memory consistency, lookups, recursion, and proof aggregation.', 'A useful deployment ledger records guest image ID, public inputs, private-input policy, journal schema, proof system version, cycle count, proving time, verification time, receipt size, and what host-side assumptions remain outside the proof.'] },
    { heading: 'Where it wins', paragraphs: ['zkVMs fit verifiable computation, rollups, off-chain execution receipts, private input proofs, reproducible policy checks, and systems where many developers need proof-carrying programs without becoming circuit engineers.', 'They are especially educational because they connect familiar machine concepts to proof-system concepts: rows become trace steps, transition functions become constraints, and receipts become signed-style verification artifacts.'] },
    { heading: 'Where it fails', paragraphs: ['A zkVM does not make an application correct by itself. It proves the guest execution under the VM rules. If the guest checks the wrong statement, omits an input, trusts a host value, or exposes the wrong journal, the proof can still verify.', 'Common mistakes are skipping image-ID checks, treating the public journal as decoration, assuming host code is proven, ignoring private-input provenance, and benchmarking verifier time while hiding prover cost.'] },
    { heading: 'Worked example', paragraphs: ['Suppose a marketplace wants proof that a private scoring rule accepted a seller without revealing every input. The guest program receives private evidence, checks the scoring rule, and writes only the accepted seller ID and score band to the public journal. The prover runs the guest and returns a receipt.', 'The verifier should not merely ask whether the receipt verifies. It must check that the receipt uses the approved image ID, that the journal schema is the expected one, that the seller ID matches the transaction being approved, and that any public parameters are current. The math proves the guest execution; the application still has to bind that execution to the right business claim.'] },
    { heading: 'Operational checklist', paragraphs: ['Track guest image IDs as versioned public API. Changing guest code changes the statement being proven, so deployment needs migration rules for old receipts and clear rejection of unknown images. Treat journal fields the same way: they are the public interface between proof and application.', 'Measure prover time, verifier time, receipt size, recursion depth, memory pressure, and failure reasons separately. A zkVM integration that advertises fast verification while ignoring proving cost may still be unusable for real workloads. Also keep a ledger of host assumptions, because those are precisely the parts the proof does not cover.'] },
    { heading: 'What to watch in production', paragraphs: ['The hardest production bug is usually not invalid algebra. It is proving the wrong statement. A receipt may be mathematically valid while the application forgot to check the image ID, accepted an old guest version, trusted a host-provided timestamp, or interpreted the journal with the wrong schema.', 'Keep proof verification close to application authorization. The verifier should bind proof bytes, guest identity, public outputs, domain-specific parameters, and user action into one decision. Splitting those checks across services without a clear contract makes it easy for a valid proof to be reused in the wrong context.', 'Also plan for upgrades. Guest programs, proof systems, recursion schemes, and security assumptions change. A serious zkVM deployment needs versioned acceptance policy: which receipts are still valid, which images are deprecated, and how old public journals should be interpreted.'] },
    { heading: 'Rule of thumb', paragraphs: ['Ask three questions before trusting a zkVM claim: what exact program was proven, what exact public statement did it publish, and what important assumptions stayed outside the guest. If any of those answers is vague, the receipt may be impressive but the application is not yet secure.', 'A good zkVM integration makes those answers boring. The image ID is pinned, the journal schema is documented, the verifier rejects unexpected versions, and the product claim is phrased narrowly enough that the proof actually supports it.', 'The proof should narrow trust, not move it to an unlabeled corner of the system. If someone cannot point to the remaining trust assumptions, the integration is not finished.'] },
    { heading: 'Study next', paragraphs: ['Primary sources: RISC Zero STARK by Hand at https://dev.risczero.com/proof-system/stark-by-hand, RISC Zero security model at https://dev.risczero.com/api/security-model, and FRI docs at https://dev.risczero.com/reference-docs/about-fri.', 'Study FRI Low-Degree Folding for the low-degree engine, Merkle Tree for commitments, ZK-SNARK Arithmetization for the broader translation problem, and Finite State Machine for state-transition thinking.'] },
  ],
};
