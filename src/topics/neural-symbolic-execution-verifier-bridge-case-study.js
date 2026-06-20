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
    {
      heading: 'Why this exists',
      paragraphs: [
        'Coding agents are good at producing plausible patches, explanations, and tests. Plausible is not the same as correct. A generated diff may satisfy the visible example while breaking a boundary case, removing an invariant, masking an error, or passing a shallow test suite for the wrong reason.',
        'A neural-symbolic verifier bridge exists to separate proposal from acceptance. The neural side is useful because it can search a large space of repairs and hypotheses. The symbolic or executable side is useful because it can check specific claims against program semantics, path constraints, test commands, type systems, or runtime behavior.',
        'The bridge is not a promise of full formal verification for every change. It is a system pattern: let the model propose, force the proposal through typed checks, return concrete counterexamples when checks fail, and store a proof ledger when checks pass. The value is disciplined feedback, not blind faith in either the model or the verifier.',
        {type:'callout', text:'A verifier bridge keeps neural generation creative while moving acceptance to typed obligations, counterexamples, executable checks, and proof ledgers.'},
      ],
    },
    {
      heading: 'The naive agent loop',
      paragraphs: [
        'The naive loop is generate a patch, run available tests, and ship if the tests pass. That loop is attractive because it is easy to automate. It also mirrors how many human changes are reviewed in small projects: does the diff look reasonable, and does the test command turn green?',
        'The wall appears when tests are incomplete. Unit tests sample behavior; they rarely enumerate every path. A model can also overfit to the visible failure by special-casing an input, deleting a check, broadening an exception, or changing the contract silently. Even when the patch is correct, a green test run may not tell future readers which property was repaired.',
        'Model confidence is an even weaker signal. A language model can state an invariant fluently without grounding it in the program. A verifier bridge treats natural language as a source of candidate obligations, not as evidence. The question is always: what predicate, path, command, log, or solver result justifies this acceptance?',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to convert informal repair work into typed verification obligations. A patch is not only a string diff. It is a candidate program transformation. An invariant is not only explanatory prose. It is a predicate to check. A failing example is not only negative feedback. It is a concrete input, path condition, expected result, observed result, and replay command.',
        'Once artifacts are typed, different engines can cooperate. A parser can turn source into an AST. A symbolic executor can explore feasible paths. A solver can decide whether path constraints admit a counterexample within scope. A test runner can execute generated cases in the real runtime. A proof ledger can record exactly which checks justified acceptance.',
        'This is why the bridge is useful in agent search. A patch-search DAG without strong feedback can branch into many plausible but unverified edits. A verifier bridge turns failures into structured training signals and turns successes into auditable evidence. The model remains creative, but acceptance is delegated to mechanisms that can produce reproducible support.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'A typical run begins with a task specification and a repository state. The model proposes a patch and may also propose the invariant it believes the patch restores. The bridge applies the patch in an isolated workspace, parses the changed region, identifies relevant functions or paths, and builds obligations from the task, invariant, type rules, and known tests.',
        'The symbolic side then searches for satisfying assignments that violate the desired predicate. If it finds one, the bridge materializes a counterexample packet. That packet should include concrete input values, the path condition, expected predicate, observed output, source location, and a command that reproduces the failure when possible.',
        'The executable side closes the loop against reality. Generated tests, target tests, type checks, linters, or project-specific commands run in the actual environment. If symbolic search and executable checks agree, the ledger stores the patch, obligations, solver result, commands, logs, and acceptance boundary. If they disagree, the record should say which layer failed or which claim was out of scope.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The proposal-to-proof graph proves that there are multiple trust boundaries. The task can be informal, the model proposal can be plausible, the patch can apply cleanly, and the invariant can sound right, yet none of those facts is proof. Evidence appears only after the artifacts pass through symbolic constraints, executable tests, or both.',
        'The payload matrix proves that format discipline is part of verification. Text, diffs, predicates, path constraints, commands, logs, and proof records are different objects. If the system blurs them together, it cannot tell whether a failure came from the program, the parser, the solver model, the test runner, or the natural-language interpretation.',
        'The counterexample view proves that rejection can be productive. A generic failed check leaves the agent guessing. A counterexample packet gives it a concrete failing path and a violated predicate. That turns the verifier from a gate into a teacher: it says not merely no, but here is the case your invariant did not cover.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The pattern works because it preserves the invariant being tested across iterations. In the bounds example, the first candidate checks only `i < n`. Symbolic search can find `i = -1` as a violating input. The next patch adds the lower bound but may still mishandle `i = n`. The final invariant, `0 <= i && i < n`, is stronger because the counterexamples forced both boundaries into the contract.',
        'The correctness argument is scoped. If the extracted obligations accurately represent the desired property, if the symbolic encoding matches the program behavior in the checked region, and if executable tests cover the runtime assumptions outside the model, then passing checks reduce false acceptance risk. The proof ledger should state that scope plainly. It should not turn a bounded proof into a universal claim.',
        'The learning benefit comes from replayable supervision. The final training record can contain the original task, failed proposal, counterexample, revised invariant, final patch, solver result, and test log. That is richer than a binary reward. It teaches future agents which path was missed and which check established the repair.',
      ],
    },
    {
      heading: 'Data structures and cost',
      paragraphs: [
        'The bridge needs durable records for task specs, candidate patches, parsed AST regions, inferred invariants, symbolic path constraints, solver models, generated counterexamples, executable tests, run logs, proof ledger entries, and exported training examples. Each record needs identity: repository revision, file paths, tool versions, command lines, environment, and timeout policy.',
        'The cost is dominated by path search and execution. Symbolic execution can suffer path explosion as branches multiply. Solvers can struggle with strings, floating point, heap aliasing, concurrency, and complex library calls. Test execution can be slow or flaky. A practical bridge therefore uses triage: cheap static checks first, focused symbolic search over changed code next, generated edge cases after that, and heavier suites only when earlier evidence is promising.',
        'The system also needs a vocabulary for uncertainty. Accepted, rejected, timed out, flaky, out of scope, parser failed, solver unsupported, and human review needed are different states. Collapsing them into pass or fail destroys the diagnostic value of the bridge.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This pattern wins for code with crisp functional properties: parsers, validators, bounds checks, numeric guards, state-machine transitions, serialization logic, small algorithmic functions, and security-sensitive preconditions. It is also useful for benchmark suites where the same class of bug appears repeatedly and counterexamples can be replayed.',
        'It pairs naturally with an agent candidate patch search DAG. The search system can generate many repairs, while the verifier bridge ranks them by evidence rather than style. Bad branches are pruned with concrete reasons. Good branches leave behind proof records that future agents, reviewers, and dataset builders can inspect.',
        'The bridge is also a data flywheel. Every failed repair with a counterexample becomes a lesson. Every accepted repair with a scoped proof becomes a high-quality training sample. Over time, the agent can learn to propose invariants and tests that line up with the verifier instead of guessing what the benchmark might accept.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The largest failure is overclaiming. A generated unit test is not a proof. A solver result inside a bounded model is not a guarantee about the whole program. A natural-language invariant is not checked until it is parsed into a formal or executable obligation. The ledger must name exactly what passed.',
        'Translation errors are another risk. If the bridge mistranslates the task into the wrong predicate, it can prove the wrong thing. If the symbolic model omits library behavior, concurrency, floating-point effects, or external services, it may miss the real bug. If generated tests do not run through the same runtime path as production, they can create false confidence.',
        'Some changes are poor fits. UI behavior, distributed timing, performance regressions, product policy, ambiguous requirements, and human-facing semantics often need review, measurement, or simulation rather than symbolic proof. A rigorous bridge should mark those cases as out of scope instead of manufacturing evidence.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Symbolic Execution Path Constraints to understand path predicates and satisfiability. Then study Abstract Interpretation Interval Domain for approximate static reasoning, Constrained Decoding for making model outputs parseable, Process Reward Models and Verifier Search for search-time feedback, Agent Candidate Patch Search DAG Case Study for branching repair workflows, and Verified Agent Trajectory Store for replayable evidence.',
        'Primary sources and tools to know include KLEE for symbolic execution, Z3 for SMT solving, language AST libraries such as Python AST, and benchmark ecosystems such as SWE-agent and SWE-bench. The practical lesson is to connect neural generation to evidence-bearing systems without pretending that either side is sufficient alone.',
      ],
    },
  ],
};
