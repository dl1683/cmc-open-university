// Synthetic bug factories: mutate code, prove the mutant is observable, and
// store a repair task only when the oracle is strong enough.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'synthetic-bug-mutation-oracle-case-study',
  title: 'Synthetic Bug Mutation Oracle Case Study',
  category: 'AI & ML',
  summary: 'A trajectory-factory case study for creating coding-agent tasks with AST mutations, failing-test prechecks, repair patches, and oracle proof ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['mutation queue', 'oracle proof ledger'], defaultValue: 'mutation queue' },
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

function mutationGraph(title) {
  return graphState({
    nodes: [
      { id: 'src', label: 'src', x: 0.8, y: 3.3, note: 'clean' },
      { id: 'ast', label: 'AST', x: 2.1, y: 3.3, note: 'parse' },
      { id: 'mut', label: 'mut', x: 3.5, y: 2.0, note: 'edit' },
      { id: 'queue', label: 'queue', x: 3.5, y: 4.7, note: 'jobs' },
      { id: 'build', label: 'build', x: 5.1, y: 3.3, note: 'image' },
      { id: 'test', label: 'test', x: 6.6, y: 3.3, note: 'oracle' },
      { id: 'kill', label: 'kill', x: 8.1, y: 2.0, note: 'fail' },
      { id: 'live', label: 'live', x: 8.1, y: 4.7, note: 'weak' },
      { id: 'task', label: 'task', x: 9.4, y: 3.3, note: 'repair' },
    ],
    edges: [
      { id: 'e-src-ast', from: 'src', to: 'ast' },
      { id: 'e-ast-mut', from: 'ast', to: 'mut' },
      { id: 'e-mut-queue', from: 'mut', to: 'queue' },
      { id: 'e-queue-build', from: 'queue', to: 'build' },
      { id: 'e-build-test', from: 'build', to: 'test' },
      { id: 'e-test-kill', from: 'test', to: 'kill' },
      { id: 'e-test-live', from: 'test', to: 'live' },
      { id: 'e-kill-task', from: 'kill', to: 'task' },
    ],
  }, { title });
}

function* mutationQueue() {
  yield {
    state: mutationGraph('Synthetic bug mutation queue'),
    highlight: { active: ['src', 'ast', 'mut', 'queue', 'e-src-ast', 'e-ast-mut', 'e-mut-queue'], compare: ['build', 'test'], found: ['task'] },
    explanation: 'A synthetic bug task starts as a clean program plus an intentional mutation. The queue stores mutation jobs until they can be built, tested, and either promoted or rejected.',
    invariant: 'A mutation is not a task until an oracle can see it.',
  };

  yield {
    state: labelMatrix(
      'Mutation operators',
      [
        { id: 'cmp', label: 'cmp' },
        { id: 'math', label: 'math' },
        { id: 'null', label: 'null' },
        { id: 'case', label: 'case' },
        { id: 'loop', label: 'loop' },
      ],
      [
        { id: 'op', label: 'op' },
        { id: 'risk', label: 'risk' },
        { id: 'keep', label: 'keep' },
      ],
      [
        ['flip', 'logic', 'yes'],
        ['swap', 'num', 'yes'],
        ['drop', 'crash', 'some'],
        ['miss', 'edge', 'yes'],
        ['off1', 'hang', 'gate'],
      ],
    ),
    highlight: { active: ['cmp:op', 'math:op', 'case:op', 'loop:op'], compare: ['null:keep'], found: ['loop:keep'] },
    explanation: 'AST mutations should be controlled and typed. A comparison flip, operator swap, missing edge case, or off-by-one loop edit produces a better training task than arbitrary text damage.',
  };

  yield {
    state: mutationGraph('Kill weak mutants before they enter the dataset'),
    highlight: { active: ['build', 'test', 'kill', 'live', 'e-build-test', 'e-test-kill', 'e-test-live'], found: ['task'], removed: ['live'] },
    explanation: 'The live branch means the injected bug was invisible to the tests. That is not a good task; it is evidence that the oracle is weak. The factory discards or quarantines it instead of asking an agent to repair a bug with no observable failure.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'mutant sample', min: 0, max: 100 }, y: { label: 'promotion rate', min: 0, max: 100 } },
      series: [
        { id: 'raw', label: 'raw mutants', points: [{ x: 10, y: 100 }, { x: 30, y: 100 }, { x: 50, y: 100 }, { x: 70, y: 100 }, { x: 90, y: 100 }] },
        { id: 'seen', label: 'oracle-visible', points: [{ x: 10, y: 44 }, { x: 30, y: 49 }, { x: 50, y: 52 }, { x: 70, y: 56 }, { x: 90, y: 58 }] },
        { id: 'clean', label: 'clean repairs', points: [{ x: 10, y: 28 }, { x: 30, y: 33 }, { x: 50, y: 36 }, { x: 70, y: 39 }, { x: 90, y: 42 }] },
      ],
      markers: [
        { id: 'gate', x: 58, y: 52, label: 'precheck' },
      ],
    }),
    highlight: { active: ['seen', 'clean', 'gate'], compare: ['raw'] },
    explanation: 'The factory loses many synthetic candidates. That is healthy: invisible bugs, flaky tests, duplicate mutations, and unrealistic edits should be filtered before training or evaluation.',
  };
}

function* oracleProofLedger() {
  yield {
    state: mutationGraph('Oracle proof ledger'),
    highlight: { active: ['src', 'mut', 'build', 'test', 'kill', 'task', 'e-queue-build', 'e-build-test', 'e-test-kill', 'e-kill-task'], compare: ['live'] },
    explanation: 'The ledger records the clean baseline, mutated source, image digest, failing command, failing output, repair patch, passing command, and proof that the task was not already broken before mutation.',
  };

  yield {
    state: labelMatrix(
      'Oracle gates',
      [
        { id: 'base', label: 'base' },
        { id: 'mut', label: 'mut' },
        { id: 'fix', label: 'fix' },
        { id: 'flake', label: 'flake' },
        { id: 'dup', label: 'dup' },
      ],
      [
        { id: 'run', label: 'run' },
        { id: 'want', label: 'want' },
        { id: 'act', label: 'act' },
      ],
      [
        ['test', 'pass', 'keep'],
        ['test', 'fail', 'task'],
        ['test', 'pass', 'proof'],
        ['rerun', 'same', 'drop'],
        ['hash', 'uniq', 'gate'],
      ],
    ),
    highlight: { active: ['base:act', 'mut:act', 'fix:act'], found: ['dup:act'], removed: ['flake:act'] },
    explanation: 'The gate is a small proof chain: clean baseline passes, mutant fails, repaired version passes, reruns agree, and the mutation is not a duplicate family. If any row breaks, the label is not trustworthy enough for training or evaluation.',
    invariant: 'The oracle must prove both failure and repair.',
  };

  yield {
    state: labelMatrix(
      'Complete case: missing empty-input branch',
      [
        { id: 'a', label: 'clean' },
        { id: 'b', label: 'mut' },
        { id: 'c', label: 'agent' },
        { id: 'd', label: 'verify' },
      ],
      [
        { id: 'code', label: 'code' },
        { id: 'test', label: 'test' },
        { id: 'label', label: 'label' },
      ],
      [
        ['has if', 'pass', 'base'],
        ['drop', 'fail', 'bug'],
        ['add if', 'pass', 'fix'],
        ['rerun', 'pass', 'proof'],
      ],
    ),
    highlight: { active: ['b:test', 'c:test', 'd:test'], found: ['c:label', 'd:label'], removed: ['b:label'] },
    explanation: 'A mutation removes an empty-input branch. Tests fail only when the edge case is exercised. The agent adds the branch back, tests pass, and the task becomes a verified repair example.',
  };

  yield {
    state: mutationGraph('Promoted tasks link back to provenance'),
    highlight: { active: ['src', 'ast', 'mut', 'kill', 'task', 'e-src-ast', 'e-ast-mut', 'e-test-kill', 'e-kill-task'], found: ['build', 'test'] },
    explanation: 'A promoted synthetic task keeps links to the original source, mutation operator, AST location, image digest, oracle commands, and repair proof. That provenance makes later benchmark claims auditable.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'mutation queue') yield* mutationQueue();
  else if (view === 'oracle proof ledger') yield* oracleProofLedger();
  else throw new InputError('Pick a synthetic-bug mutation view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A synthetic bug mutation oracle exists because coding-agent evaluation needs many verified repair tasks, and real bugs are scarce, uneven, and expensive to label. A good benchmark task needs a clean repository, an observable failure, a plausible repair, and proof that the repair actually fixes the failure.',
        'Synthetic mutation can create more tasks, but only if the mutations are realistic and the labels are trustworthy. Randomly damaging text creates nonsense. Mutating code without a failing test creates invisible bugs. Accepting a repair without a passing proof creates noisy training data.',
        'The oracle is the data structure that keeps this honest. It mutates a clean program, proves that the mutation causes an observable failure, asks for or records a repair, and stores the full failing-to-passing proof chain.',
        {type:'callout', text:'A synthetic repair task is valid only when the oracle proves the clean baseline, injected failure, repaired pass, rerun stability, and split isolation.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is random text damage: delete a line, change a token, ask an agent to fix it, and call the result synthetic data. That produces unrealistic bugs, syntax errors, duplicate patterns, and tasks that teach agents to reverse the generator rather than debug software.',
        'A second shortcut is to mutate code and trust that the mutation matters. Many mutants survive because the tests do not observe them. Surviving mutants are not successful tasks; they are evidence that the oracle cannot see the injected bug.',
        'A third mistake is to store only the prompt and final patch. Without baseline pass, mutant fail, repair pass, rerun, environment digest, and dedupe proof, later users cannot tell whether the task was valid, flaky, leaked, or already broken before mutation.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that a synthetic repair task is a proof object, not a prompt. The task is valid only if the clean baseline passes, the mutant fails for the intended reason, the repair passes, reruns agree, and the task is not a duplicate of a leaked family.',
        'Mutation should happen at the program-structure level when possible. AST-level mutation can record operator, node type, source span, and expected semantic effect. That makes examples easier to bucket, dedupe, audit, and explain than raw string damage.',
        'The oracle should reject aggressively. A healthy factory loses many candidates to invisible bugs, flaky tests, duplicate mutation families, unrealistic edits, build failures, and repairs that do not prove the intended behavior.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The factory starts with a clean repository snapshot and proves the baseline passes. It parses source into an AST or another structured representation, chooses a typed mutation operator, writes the mutant, builds or restores the executable image, and runs the oracle command.',
        'If the mutant fails, the task becomes a repair candidate. An agent or known inverse patch attempts a fix. The factory reruns the oracle, requires the repaired version to pass, reruns to detect flakiness, hashes the mutation family, and checks whether similar tasks already exist in the same split or another split.',
        'The promoted record stores source snapshot, mutation operator, AST path, changed span, image digest, failing command, failing output, repair diff, passing command, passing output, runtime, flaky rerun status, dedupe family, split assignment, and promotion decision.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The mutation-queue view proves that raw candidate volume is not quality. Clean source, AST mutation, build, test, kill status, and promotion are separate gates. The line between raw mutants and clean repairs should shrink because most candidates are not trustworthy enough.',
        'The oracle-proof-ledger view proves the correctness argument. Baseline pass means the repository was not already broken. Mutant fail means the injected bug is visible. Repair pass means the candidate fixed the observed failure. Reruns and dedupe defend against flaky or repeated examples.',
        'The empty-input case proves the desired shape. A mutation removes a real edge-case branch. The tests fail only when that edge is exercised. The agent restores the branch. The repaired task passes and carries provenance back to the original source and mutation operator.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Mutation works when the operator creates a small semantic defect that the oracle can observe. Removing a boundary check, flipping a comparator, changing an error condition, dropping a null guard, or misrouting a branch can create realistic repair work if the tests cover the behavior.',
        'The proof ledger works because it separates several claims that are often blurred together: the project was clean, the mutation caused failure, the failure was deterministic, the repair fixed it, and the example is distinct from other examples.',
        'Dedupe works when it hashes the mutation family, not just the final text. Two tasks can differ in file path and still teach the same trick. A useful benchmark should avoid putting near-identical mutation families on both sides of a train/eval split.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The cost is yield. Many mutants will be discarded, and that is healthy. Invisible mutants, flaky tests, build-only failures, unrealistic edits, duplicate families, and over-simple repairs should not become promoted tasks merely because they are cheap to generate.',
        'There is also compute cost. Each candidate may need baseline verification, build, test, repair attempt, rerun, and dedupe comparison. Caching executable images and dependency installs matters because the factory can spend more time proving labels than generating mutations.',
        'The tradeoff is control versus realism. Synthetic tasks give coverage and provenance, but real bugs include messy requirements, ambiguous intent, and multi-file design changes. A strong corpus uses synthetic tasks as one source, not as a replacement for mined real issues.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Synthetic mutation wins for benchmark expansion, coding-agent curriculum generation, repair-model training, regression suites, and targeted evaluation of specific bug classes. It can deliberately create missing guard cases, comparator errors, resource leaks, parser edge cases, and API misuse examples.',
        'It is especially useful when combined with a verified trajectory store. Each agent attempt can be tied to a task proof, command output, patch diff, and final result. That makes later analysis of repair strategy, failure type, and model progress much more reliable.',
        'It also helps curriculum design. The factory can group tasks by mutation family, language, subsystem, oracle type, and difficulty, then stage learning from small local repairs to multi-file reasoning problems.',
        'For evaluation, it gives maintainers knobs they do not have with mined issues alone. They can hold out entire mutation families, build balanced slices, and ask whether a model improves on a class of defects rather than only on one public benchmark leaderboard.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Bad mutation factories produce unrealistic bugs, invisible mutants, duplicate tasks, flaky proof, and answer leakage. They can reward agents for memorizing mutation patterns rather than learning real debugging. Promotion gates need diversity metrics and held-out mutation families.',
        'Baseline-broken projects are fatal to label quality. If the clean repository does not pass before mutation, a later passing result may repair an unrelated failure. Baseline pass is not paperwork; it is the first proof obligation.',
        'Another failure is overtrusting tests. A passing repair can still be wrong if the test oracle is weak. Mutation factories should record oracle scope and, when possible, add hidden checks, property tests, static analysis, or human review for promoted examples.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Python AST documentation at https://docs.python.org/3/library/ast.html, pytest assertion documentation at https://docs.pytest.org/en/stable/how-to/assert.html, CWM at https://arxiv.org/abs/2510.02387, SWE-bench at https://arxiv.org/abs/2310.06770, SWE-agent at https://arxiv.org/abs/2405.15793, and Git apply at https://git-scm.com/docs/git-apply. Study Executable Repository Image Build Cache Case Study, Agent Candidate Patch Search DAG Case Study, Neural-Symbolic Execution Verifier Bridge Case Study, Mutation Testing, Symbolic Execution Path Constraints, Agent Trajectory Dedupe & Provenance Hash, Verified Agent Trajectory Store, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
