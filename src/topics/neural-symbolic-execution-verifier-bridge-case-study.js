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
    explanation: 'The bridge schema has to translate between text, diffs, predicates, constraints, commands, logs, and proof records. Each payload has a parser and a verifier boundary.',
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
    explanation: 'When the solver or symbolic executor finds a counterexample, the loop should feed the concrete failing input back to the agent instead of only saying the patch was wrong.',
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
    {
      heading: 'What it is',
      paragraphs: [
        'A neural-symbolic execution verifier bridge connects model proposals to formal or executable checks. The neural side proposes a patch, invariant, explanation, or test. The symbolic and runtime side proves, rejects, or returns a counterexample.',
        'This belongs after Agent Candidate Patch Search DAG Case Study because the search graph needs strong feedback. It also links Symbolic Execution Path Constraints, Abstract Interpretation Interval Domain, and Verified Agent Trajectory Store into the coding-agent world-model stack.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The bridge stores task spec, candidate patch, inferred invariant, symbolic path constraints, solver result, generated counterexample, executable test, run log, proof ledger entry, and training-data export. The important boundary is typed: text is parsed into predicates and diffs before the verifier trusts it.',
        'A counterexample is a first-class object. It should contain concrete input, path condition, expected predicate, observed output, replay command, and source location. That lets the agent repair the actual failing path instead of guessing.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The model proposes a patch and optionally a candidate invariant. The bridge applies the patch, extracts relevant paths, checks constraints with a solver or symbolic executor, turns counterexamples into executable tests, reruns those tests in the repository image, and stores proof if the patched program passes.',
        'For many programs, full formal proof is not available. The practical bridge is layered: type checks and static analysis, symbolic search over small functions, generated edge-case tests, target unit tests, and finally the project test suite. The ledger records which layer actually justified acceptance.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A candidate patch for an array bounds bug checks only `i < n`. Symbolic execution finds `i = -1` as a counterexample. The agent adds `0 <= i` but then the bridge finds `i = n` because the comparison was inclusive in one path. The final patch encodes `0 <= i && i < n`, generated edge-case tests pass, and the proof ledger records both counterexamples.',
        'The final training sample contains the original issue, wrong patch, counterexamples, revised invariant, final patch, passing tests, and solver output. That teaches the model to close the loop with evidence rather than treating verifier failures as generic negative feedback.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The bridge can overpromise if it labels shallow checks as proof. It can also fail if the parser mistranslates natural language into constraints, if generated tests do not hit the real runtime path, or if a solver model is treated as a universal guarantee.',
        'Another failure mode is unverifiable patches. Some changes touch UI, distributed timing, performance, or policy. The bridge should mark those as review-needed instead of forcing a fake formal proof.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: KLEE symbolic execution at https://klee-se.org/docs/, Z3 documentation at https://microsoft.github.io/z3guide/, Python AST documentation at https://docs.python.org/3/library/ast.html, CWM at https://arxiv.org/abs/2510.02387, SWE-agent at https://arxiv.org/abs/2405.15793, and SWE-bench at https://arxiv.org/abs/2310.06770.',
        'Study next: Agent Candidate Patch Search DAG Case Study, Synthetic Bug Mutation Oracle Case Study, Symbolic Execution Path Constraints, Abstract Interpretation Interval Domain, Process Reward Models & Verifier Search, Constrained Decoding, and Execution Trace State Diff Case Study.',
      ],
    },
  ],
};
