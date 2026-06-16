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
    explanation: 'If tests do not fail on the mutant, the oracle is too weak. The factory should discard or quarantine surviving mutants instead of asking agents to repair invisible bugs.',
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
    explanation: 'The minimal gate is baseline passes, mutant fails, repaired version passes, reruns agree, and the mutation is not a duplicate of an existing family.',
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
      heading: 'What it is',
      paragraphs: [
        'A synthetic bug mutation oracle is a data structure and workflow for creating verified coding-agent tasks. It mutates a clean program, proves that the mutation causes an observable failure, asks for a repair, and stores the full failing-to-passing proof.',
        'This enriches Code World Models Case Study and Verified Agent Trajectory Store by adding a controlled source of new tasks. It also connects to Agent Trajectory Dedupe & Provenance Hash, because synthetic tasks can leak if the same mutation family appears on both sides of a split.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The factory maintains a source snapshot, parsed AST, mutation operator registry, mutation queue, executable image digest, test oracle table, repair candidate table, proof ledger, duplicate-family index, and promotion gate. Each promoted task is a small graph, not a loose prompt.',
        'AST-level mutation is more stable than raw string damage because the factory can name the operator, node type, source span, and expected semantic effect. That makes examples easier to bucket, dedupe, and explain.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The workflow is baseline pass, mutate, build, run tests, require failure, optionally ask an agent for repair, rerun tests, require pass, rerun to detect flakiness, dedupe against existing tasks, and then promote. Surviving mutants are not successes; they show that the test oracle did not observe the injected bug.',
        'The oracle should be more than one Boolean. A useful proof ledger stores failing test names, assertion output, runtime, environment digest, patch fingerprint, flaky rerun status, and the reason a mutant was dropped or promoted.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A project has a parser that correctly returns an empty result for an empty input. The factory mutates the AST by removing the empty-input branch. Baseline tests pass, the mutant fails on the empty-input test, and an agent restores the branch. The repair passes twice and the task is promoted.',
        'A weaker factory would only store the prompt and final patch. The stronger factory stores the mutation operator, AST path, failing command, failing output, repair diff, passing output, image digest, dedupe family, and split decision. That is the difference between synthetic data and verifiable synthetic data.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Bad mutation factories produce unrealistic bugs, invisible mutants, duplicate tasks, flaky proof, and answer leakage. They can also reward agents for memorizing mutation patterns rather than learning real debugging. The promotion gate needs diversity metrics and held-out families.',
        'Another trap is accepting baseline-broken projects. If the clean repository does not pass before mutation, a later passing result may repair an unrelated failure. Baseline pass is a hard prerequisite for clean labels.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Python AST documentation at https://docs.python.org/3/library/ast.html, pytest assertion documentation at https://docs.pytest.org/en/stable/how-to/assert.html, CWM at https://arxiv.org/abs/2510.02387, SWE-bench at https://arxiv.org/abs/2310.06770, SWE-agent at https://arxiv.org/abs/2405.15793, and Git apply at https://git-scm.com/docs/git-apply.',
        'Study next: Executable Repository Image Build Cache Case Study, Agent Candidate Patch Search DAG Case Study, Neural-Symbolic Execution Verifier Bridge Case Study, Mutation Testing, Symbolic Execution Path Constraints, and Benchmark Variance & Model Selection.',
      ],
    },
  ],
};
