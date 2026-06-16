// Candidate patch search DAG: keep agent edits, verifier scores, costs, and
// pruning decisions as an explicit search structure.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'agent-candidate-patch-search-dag-case-study',
  title: 'Agent Candidate Patch Search DAG Case Study',
  category: 'AI & ML',
  summary: 'A coding-agent search case study: represent candidate patches as a DAG with verifier scores, shared ancestors, budget pruning, and final proof selection.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['patch search DAG', 'budget pruning'], defaultValue: 'patch search DAG' },
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

function searchGraph(title) {
  return graphState({
    nodes: [
      { id: 'task', label: 'task', x: 0.6, y: 3.4, note: 'issue' },
      { id: 'root', label: 'root', x: 2.0, y: 3.4, note: 'base' },
      { id: 'p1', label: 'p1', x: 3.6, y: 1.5, note: 'small' },
      { id: 'p2', label: 'p2', x: 3.6, y: 3.4, note: 'test' },
      { id: 'p3', label: 'p3', x: 3.6, y: 5.3, note: 'wide' },
      { id: 'v1', label: 'v1', x: 5.2, y: 1.5, note: 'lint' },
      { id: 'v2', label: 'v2', x: 5.2, y: 3.4, note: 'unit' },
      { id: 'v3', label: 'v3', x: 5.2, y: 5.3, note: 'fail' },
      { id: 'merge', label: 'merge', x: 6.8, y: 3.4, note: 'reuse' },
      { id: 'final', label: 'final', x: 8.4, y: 3.4, note: 'proof' },
    ],
    edges: [
      { id: 'e-task-root', from: 'task', to: 'root' },
      { id: 'e-root-p1', from: 'root', to: 'p1' },
      { id: 'e-root-p2', from: 'root', to: 'p2' },
      { id: 'e-root-p3', from: 'root', to: 'p3' },
      { id: 'e-p1-v1', from: 'p1', to: 'v1' },
      { id: 'e-p2-v2', from: 'p2', to: 'v2' },
      { id: 'e-p3-v3', from: 'p3', to: 'v3' },
      { id: 'e-v1-merge', from: 'v1', to: 'merge' },
      { id: 'e-v2-merge', from: 'v2', to: 'merge' },
      { id: 'e-v3-merge', from: 'v3', to: 'merge' },
      { id: 'e-merge-final', from: 'merge', to: 'final' },
    ],
  }, { title });
}

function* patchSearchDag() {
  yield {
    state: searchGraph('Candidate patch search DAG'),
    highlight: { active: ['task', 'root', 'p1', 'p2', 'p3', 'e-task-root', 'e-root-p1', 'e-root-p2', 'e-root-p3'], compare: ['v1', 'v2', 'v3'], found: ['final'] },
    explanation: 'A coding agent rarely needs a single linear attempt. Treat candidate patches as a DAG: shared base state, branched edits, verifier observations, merged lessons, and a final proof-carrying patch.',
    invariant: 'Search state should remember why a patch branch lived or died.',
  };

  yield {
    state: labelMatrix(
      'Candidate patch ledger',
      [
        { id: 'p1', label: 'p1' },
        { id: 'p2', label: 'p2' },
        { id: 'p3', label: 'p3' },
        { id: 'p4', label: 'p4' },
        { id: 'p5', label: 'p5' },
      ],
      [
        { id: 'diff', label: 'diff' },
        { id: 'score', label: 'score' },
        { id: 'act', label: 'act' },
      ],
      [
        ['1h', 'low', 'drop'],
        ['2h', 'med', 'keep'],
        ['8h', 'fail', 'drop'],
        ['3h', 'high', 'run'],
        ['4h', 'pass', 'ship'],
      ],
    ),
    highlight: { active: ['p2:act', 'p4:act', 'p5:act'], found: ['p5:score'], removed: ['p1:act', 'p3:act'] },
    explanation: 'Each candidate stores diff fingerprint, parent, changed files, verifier score, cost, failure message, and next action. The graph avoids rerunning equivalent work.',
  };

  yield {
    state: searchGraph('Verifier observations update the DAG'),
    highlight: { active: ['p1', 'p2', 'v1', 'v2', 'merge', 'e-p1-v1', 'e-p2-v2', 'e-v1-merge', 'e-v2-merge'], compare: ['p3', 'v3'], found: ['final'] },
    explanation: 'The agent can combine lessons from several branches: one patch fixes lint, another fixes the failing test, and a third explains what not to touch. The merge node records the distilled plan.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'verifier calls', min: 0, max: 40 }, y: { label: 'best score', min: 0, max: 100 } },
      series: [
        { id: 'greedy', label: 'linear retry', points: [{ x: 2, y: 25 }, { x: 8, y: 34 }, { x: 16, y: 41 }, { x: 28, y: 45 }, { x: 38, y: 48 }] },
        { id: 'dag', label: 'patch DAG', points: [{ x: 2, y: 22 }, { x: 8, y: 51 }, { x: 16, y: 74 }, { x: 28, y: 88 }, { x: 38, y: 91 }] },
      ],
      markers: [
        { id: 'win', x: 24, y: 84, label: 'proof found' },
      ],
    }),
    highlight: { active: ['dag', 'win'], compare: ['greedy'] },
    explanation: 'A DAG can spend the same verifier budget better by preserving multiple hypotheses, pruning failures, and reusing partial successes rather than overwriting them with the latest transcript.',
  };
}

function* budgetPruning() {
  yield {
    state: searchGraph('Budget-aware pruning'),
    highlight: { active: ['root', 'p1', 'p2', 'v1', 'v2', 'merge', 'e-root-p1', 'e-root-p2', 'e-p1-v1', 'e-p2-v2'], removed: ['p3', 'v3', 'e-root-p3', 'e-p3-v3'], found: ['final'] },
    explanation: 'Budget pruning removes branches that are expensive, low-scoring, duplicate, or outside the allowed edit surface. The DAG keeps the removed branch as evidence so the agent does not repeat it.',
  };

  yield {
    state: labelMatrix(
      'Pruning reasons',
      [
        { id: 'dup', label: 'dup' },
        { id: 'big', label: 'big' },
        { id: 'bad', label: 'bad' },
        { id: 'slow', label: 'slow' },
        { id: 'risk', label: 'risk' },
      ],
      [
        { id: 'sig', label: 'sig' },
        { id: 'cost', label: 'cost' },
        { id: 'act', label: 'act' },
      ],
      [
        ['same', '0', 'drop'],
        ['wide', 'high', 'drop'],
        ['fail', 'med', 'drop'],
        ['time', 'high', 'stop'],
        ['API', 'med', 'hold'],
      ],
    ),
    highlight: { removed: ['dup:act', 'big:act', 'bad:act', 'slow:act'], compare: ['risk:act'], active: ['risk:sig'] },
    explanation: 'Pruning is a data decision. Store the reason code: duplicate patch, too many files, worse verifier result, timeout, risky public API change, or missing proof.',
  };

  yield {
    state: labelMatrix(
      'Complete case: failing parser issue',
      [
        { id: 'r0', label: 'base' },
        { id: 'r1', label: 'try1' },
        { id: 'r2', label: 'try2' },
        { id: 'r3', label: 'try3' },
        { id: 'r4', label: 'pick' },
      ],
      [
        { id: 'edit', label: 'edit' },
        { id: 'test', label: 'test' },
        { id: 'act', label: 'act' },
      ],
      [
        ['none', 'fail', 'root'],
        ['parse', 'fail', 'learn'],
        ['token', 'pass', 'keep'],
        ['wide', 'fail', 'drop'],
        ['small', 'pass', 'ship'],
      ],
    ),
    highlight: { active: ['r1:act', 'r2:act', 'r4:act'], found: ['r2:test', 'r4:test'], removed: ['r3:act'] },
    explanation: 'The agent tries a parser edit, then a tokenizer edit, then a broad rewrite. The broad rewrite is pruned; the small tokenizer patch passes and is selected with the proof ledger attached.',
  };

  yield {
    state: searchGraph('Final patch is selected with proof, not vibes'),
    highlight: { active: ['merge', 'final', 'e-merge-final'], found: ['v2', 'p2'], compare: ['v1'], removed: ['p3', 'v3'] },
    explanation: 'The final candidate is not simply the last answer. It is the best branch under budget, verified by the oracle, deduped against prior attempts, and stored with enough ancestry to explain the choice.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'patch search DAG') yield* patchSearchDag();
  else if (view === 'budget pruning') yield* budgetPruning();
  else throw new InputError('Pick an agent patch-search view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A candidate patch search DAG is the explicit search memory for a coding agent. Nodes are repository states, patches, verifier observations, merged hypotheses, and final proofs. Edges show ancestry and reuse.',
        'This module connects Abstract Agent Operation Graph, Agent Harness Portability Audit, Verified Agent Trajectory Store, and Process Reward Models & Verifier Search. It turns search into a data structure instead of letting each retry overwrite the last one.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The DAG stores candidate id, parent ids, diff fingerprint, touched files, edit size, tool operations, verifier command, exit status, failure summary, score, cost, and next action. A separate dedupe index prevents rerunning equivalent patches.',
        'The final proof is a pointer into the DAG, not an isolated patch. That ancestry matters when training a model: the failed branches teach what evidence ruled out an approach, and the successful branch teaches which constraints mattered.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The agent starts at the task root, proposes several candidate patches, applies each patch to a reproducible image, runs cheap verifiers first, promotes promising branches to expensive tests, merges lessons, and chooses the best proof-carrying patch under budget.',
        'This is different from plain beam search because the branch state is executable. A candidate has a diff that can be applied, tests that can be rerun, logs that can be inspected, and a provenance chain that can be audited.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A parser bug appears in a real issue. One branch changes parser control flow but still fails. A second branch fixes token handling and passes the target test. A third branch rewrites broad public API behavior and fails compatibility tests. The DAG records all three branches, prunes the risky rewrite, merges the useful parser observation into the tokenizer patch, and selects the small passing diff.',
        'The resulting training example can show the model more than the final patch: it can show search, evidence, pruning, and final selection. That is the bridge between static code data and world-model training data.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A patch DAG can still overfit if all scoring comes from one narrow oracle. It can also become too expensive if every branch runs the full suite. Production systems use staged verification: lint, type check, target tests, relevant regression tests, then full tests only for finalists.',
        'Another trap is branch explosion. The pruning policy should be explicit and logged. Silent pruning makes later analysis impossible, while no pruning burns budget before the agent reaches a viable repair.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: SWE-agent at https://arxiv.org/abs/2405.15793, SWE-bench at https://arxiv.org/abs/2310.06770, CWM at https://arxiv.org/abs/2510.02387, Git apply at https://git-scm.com/docs/git-apply, AlphaEvolve at https://arxiv.org/abs/2506.13131, and DeepMind AlphaEvolve at https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/.',
        'Study next: Synthetic Bug Mutation Oracle Case Study, Neural-Symbolic Execution Verifier Bridge Case Study, Beam Search, Tree of Thoughts Search Case Study, Monte Carlo Tree Search UCT Primer, Process Reward Models & Verifier Search, and Execution-as-a-Service Verifier Economy Case Study.',
      ],
    },
  ],
};
