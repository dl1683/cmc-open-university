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

