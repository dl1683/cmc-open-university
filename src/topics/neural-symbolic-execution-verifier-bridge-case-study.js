// Neural-symbolic verifier bridge: let a model propose repairs and invariants,
// then require symbolic or executable checks to produce proof or counterexamples.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'neural-symbolic-execution-verifier-bridge-case-study',
  title: 'Neural-Symbolic Execution Verifier Bridge Case Study',
  category: 'AI & ML',
  summary: 'A coding-agent verifier case study: connect neural repair proposals to symbolic constraints, executable tests, counterexamples, and proof ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['proposal to proof', 'counterexample loop'], defaultValue: 'proposal to proof' },
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

function bridgeGraph(title) {
  return graphState({
    nodes: [
      { id: 'task', label: 'task', x: 0.6, y: 3.4, note: 'spec' },
      { id: 'nn', label: 'NN', x: 2.1, y: 2.0, note: 'plan' },
      { id: 'patch', label: 'patch', x: 3.6, y: 2.0, note: 'diff' },
      { id: 'inv', label: 'inv', x: 3.6, y: 4.8, note: 'claim' },
      { id: 'sym', label: 'sym', x: 5.2, y: 3.4, note: 'paths' },
      { id: 'test', label: 'test', x: 6.8, y: 2.0, note: 'run' },
      { id: 'cex', label: 'cex', x: 6.8, y: 4.8, note: 'input' },
      { id: 'proof', label: 'proof', x: 8.4, y: 3.4, note: 'ledger' },
      { id: 'data', label: 'data', x: 9.6, y: 3.4, note: 'train' },
    ],
    edges: [
      { id: 'e-task-nn', from: 'task', to: 'nn' },
      { id: 'e-nn-patch', from: 'nn', to: 'patch' },
      { id: 'e-nn-inv', from: 'nn', to: 'inv' },
      { id: 'e-patch-sym', from: 'patch', to: 'sym' },
      { id: 'e-inv-sym', from: 'inv', to: 'sym' },
      { id: 'e-sym-test', from: 'sym', to: 'test' },
      { id: 'e-sym-cex', from: 'sym', to: 'cex' },
      { id: 'e-test-proof', from: 'test', to: 'proof' },
      { id: 'e-cex-nn', from: 'cex', to: 'nn' },
      { id: 'e-proof-data', from: 'proof', to: 'data' },
    ],
  }, { title });
}

function* proposalToProof() {
  yield {
    state: bridgeGraph('Neural proposal to symbolic proof'),
    highlight: { active: ['task', 'nn', 'patch', 'inv', 'sym', 'e-task-nn', 'e-nn-patch', 'e-nn-inv', 'e-patch-sym', 'e-inv-sym'], compare: ['test'], found: ['proof'] },
    explanation: 'The model proposes a patch and often an informal invariant. The bridge turns that proposal into symbolic path constraints, executable tests, or both, then stores proof only if the checks pass.',
    invariant: 'Neural confidence is not proof; it is a proposal to verify.',
  };

  yield {
    state: labelMatrix(
      'Bridge payloads',
      [
        { id: 'spec', label: 'spec' },
        { id: 'patch', label: 'patch' },
        { id: 'inv', label: 'inv' },
        { id: 'path', label: 'path' },
        { id: 'run', label: 'run' },
      ],
      [
        { id: 'form', label: 'form' },
        { id: 'check', label: 'check' },
        { id: 'out', label: 'out' },
      ],
      [
        ['text', 'parse', 'goal'],
        ['diff', 'apply', 'tree'],
        ['pred', 'solve', 'claim'],
        ['expr', 'sat', 'case'],
        ['cmd', 'exec', 'log'],
      ],
    ),
    highlight: { active: ['patch:check', 'inv:check', 'path:check', 'run:check'], found: ['run:out'], compare: ['spec:form'] },
    explanation: 'The matrix is the bridge contract. Text, diffs, predicates, constraints, commands, logs, and proof records use different formats, so each payload needs a parser and a verifier boundary before the system trusts it.',
  };

  yield {
    state: bridgeGraph('Executable tests and symbolic paths agree'),
    highlight: { active: ['sym', 'test', 'proof', 'e-sym-test', 'e-test-proof'], found: ['data'], compare: ['patch', 'inv'] },
    explanation: 'A strong bridge asks for agreement between fast symbolic checks and executable tests. Symbolic search can find edge cases; executable tests prove the patch survives the real runtime.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'verification depth', min: 0, max: 5 }, y: { label: 'false accept risk', min: 0, max: 100 } },
      series: [
        { id: 'tests', label: 'tests only', points: [{ x: 0, y: 78 }, { x: 1, y: 60 }, { x: 2, y: 46 }, { x: 3, y: 38 }, { x: 4, y: 34 }, { x: 5, y: 31 }] },
        { id: 'bridge', label: 'bridge', points: [{ x: 0, y: 78 }, { x: 1, y: 44 }, { x: 2, y: 24 }, { x: 3, y: 13 }, { x: 4, y: 9 }, { x: 5, y: 7 }] },
      ],
      markers: [
        { id: 'proofband', x: 3.2, y: 13, label: 'proof band' },
      ],
    }),
    highlight: { active: ['bridge', 'proofband'], compare: ['tests'] },
    explanation: 'A bridge does not make verification free, but it can reduce false accepts by turning likely edge cases into concrete tests and storing the proof boundary.',
  };
}

function* counterexampleLoop() {
  yield {
    state: bridgeGraph('Counterexample-guided repair loop'),
    highlight: { active: ['nn', 'patch', 'sym', 'cex', 'e-nn-patch', 'e-patch-sym', 'e-sym-cex', 'e-cex-nn'], compare: ['proof'], removed: ['data'] },
    explanation: 'The counterexample edge turns rejection into usable information. When the solver or symbolic executor finds a failing input, the loop feeds that concrete case back to the agent instead of only saying the patch was wrong.',
  };

  yield {
    state: labelMatrix(
      'Counterexample packet',
      [
        { id: 'input', label: 'input' },
        { id: 'path', label: 'path' },
        { id: 'want', label: 'want' },
        { id: 'got', label: 'got' },
        { id: 'fix', label: 'fix' },
      ],
      [
        { id: 'kind', label: 'kind' },
        { id: 'use', label: 'use' },
      ],
      [
        ['case', 'repro'],
        ['expr', 'trace'],
        ['pred', 'goal'],
        ['val', 'fail'],
        ['hint', 'edit'],
      ],
    ),
    highlight: { active: ['input:use', 'path:use', 'want:use', 'got:use'], found: ['fix:use'] },
    explanation: 'A good counterexample packet is actionable: concrete input, path condition, expected predicate, observed output, and a small hint about the failing invariant.',
  };

  yield {
    state: labelMatrix(
      'Complete case: bounds repair',
      [
        { id: 'a', label: 'try1' },
        { id: 'b', label: 'cex1' },
        { id: 'c', label: 'try2' },
        { id: 'd', label: 'cex2' },
        { id: 'e', label: 'proof' },
      ],
      [
        { id: 'claim', label: 'claim' },
        { id: 'check', label: 'check' },
        { id: 'act', label: 'act' },
      ],
      [
        ['i<n', 'sat', 'fail'],
        ['i=-1', 'run', 'feed'],
        ['0<=i', 'sat', 'fail'],
        ['i=n', 'run', 'feed'],
        ['0<=i<n', 'pass', 'ship'],
      ],
    ),
    highlight: { active: ['b:act', 'd:act', 'e:act'], found: ['e:check'], removed: ['a:act', 'c:act'] },
    explanation: 'A bounds check repair fails first on negative input, then on the upper boundary. The final invariant includes both sides, and the proof ledger records the counterexamples that shaped the repair.',
  };

  yield {
    state: bridgeGraph('Proof records become training examples'),
    highlight: { active: ['proof', 'data', 'e-proof-data'], found: ['test', 'sym'], compare: ['cex'], removed: ['patch'] },
    explanation: 'The final dataset can include proposal, counterexample, revised invariant, executable proof, and symbolic proof. That trains agents to use verification feedback rather than just produce plausible diffs.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'proposal to proof') yield* proposalToProof();
  else if (view === 'counterexample loop') yield* counterexampleLoop();
  else throw new InputError('Pick a neural-symbolic verifier view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: ['Read the graph as a trust pipeline. The neural part proposes a patch or invariant, and the symbolic or executable part decides which claims have evidence.', 'A verifier is a checker that can reject a program property with a concrete counterexample or accept it within a stated scope. The ledger at the end records exactly which checks passed.', {type:'callout', text:'A verifier bridge keeps neural generation creative while moving acceptance to typed obligations, counterexamples, executable checks, and proof ledgers.'}] },
    { heading: 'Why this exists', paragraphs: ['Coding agents can produce plausible patches quickly. Plausible code can still delete an invariant, pass shallow tests, or special-case the visible example.', 'A verifier bridge separates proposal from acceptance. The model searches the repair space, while typed checks, symbolic execution, tests, or solvers decide whether the candidate satisfies the stated obligation.'] },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is generate a patch, run the existing tests, and ship if they pass. That mirrors common small-project workflow and is easy to automate.', 'The failure is coverage. Existing tests sample behavior, while an agent can overfit the sampled case or weaken the contract in a way no current test exercises.'] },
    { heading: 'The wall', paragraphs: ['The wall is that natural language confidence is not evidence. A model can say the bounds check is fixed while missing the negative-index path.', 'A second wall is translation. If the system turns the task into the wrong predicate, it can verify the wrong property with perfect mechanical confidence.'] },
    { heading: 'The core insight', paragraphs: ['The core move is to turn informal repair claims into typed obligations. An obligation is a checkable statement such as index must satisfy 0 <= i and i < n before array access.', 'Once the claim is typed, several engines can cooperate. A parser locates changed code, symbolic execution explores paths, a solver finds counterexamples, and executable tests confirm behavior in the real runtime.'] },
    { heading: 'How it works', paragraphs: ['The bridge receives a task, a repository revision, and a candidate patch. It applies the patch in isolation, parses the changed region, extracts relevant functions, and builds obligations from the task and code contract.', 'If symbolic search finds a violating input, the bridge returns a counterexample packet. That packet should include input values, path condition, expected predicate, observed output, source location, and replay command.', 'If checks pass, the bridge writes a proof ledger. The ledger stores the patch, obligations, solver result, test commands, logs, tool versions, and the scope of the claim.'] },
    { heading: 'Why it works', paragraphs: ['The correctness argument is scoped by the obligation. If the obligation matches the intended property, the symbolic model matches the checked code, and executable tests cover runtime assumptions outside the model, then passing checks reduces false acceptance.', 'The bridge should not claim more than that. A bounded proof over one function is not a proof of the whole application, and a generated test is not a universal guarantee.'] },
    { heading: 'Cost and complexity', paragraphs: ['Cost grows with paths, branch conditions, and solver difficulty. Ten independent branches can create up to 1,024 path combinations before pruning.', 'Execution cost also matters. A cheap static check can run on every candidate, while full test suites, fuzzing, or solver-backed search may need triage and timeouts.'] },
    { heading: 'Real-world uses', paragraphs: ['The pattern fits parsers, validators, bounds checks, state-machine transitions, serialization code, and security-sensitive preconditions. These areas have crisp properties that can be turned into executable or symbolic obligations.', 'It also fits agent repair benchmarks. Failed patches become counterexample-rich training records, and accepted patches become evidence-bearing examples rather than bare diffs.'] },
    { heading: 'Where it fails', paragraphs: ['It fails when the property is vague or social. UI taste, product policy, distributed timing, and human-facing semantics often need review, simulation, or measurement rather than symbolic proof.', 'It also fails when the bridge hides uncertainty. Parser failed, solver unsupported, timed out, flaky, out of scope, and rejected are different states that should not collapse into one red status.'] },
    { heading: 'Worked example', paragraphs: ['A function returns arr[i] after checking only i < arr.length. With arr length 5, symbolic execution finds i = -1 as a path where -1 < 5 is true but the access violates the intended bound.', 'The agent adds i >= 0, producing the obligation 0 <= i and i < 5 for this concrete array. The solver can no longer find an integer i that passes the guard and violates the bound, and a generated test asserts that -1 is rejected.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources to study are KLEE for symbolic execution, Z3 for satisfiability modulo theories, language AST documentation, and SWE-bench style repair benchmarks. Read tool limits as carefully as success cases.', 'Study symbolic execution path constraints, SMT solving, abstract interpretation, property-based testing, constrained decoding, process reward models, and verified agent trajectory stores next. The practical goal is evidence-bearing repair, not proof theater.'] },
  ],
};