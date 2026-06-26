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
    explanation: 'Each row is a branch record: diff fingerprint, parent, changed files, verifier score, cost, failure message, and next action. Keeping that state lets the agent skip equivalent patches instead of spending verifier calls on the same idea twice.',
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
    explanation: 'The parser edit teaches one constraint, the tokenizer edit passes, and the broad rewrite is pruned because it is risky and still failing. The selected patch is small because the DAG kept evidence about every branch, not because the last attempt happened to be small.',
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
      heading: 'How to read the animation',
      paragraphs: [
        {type:'callout', text:'A candidate patch search DAG turns repair from a chat transcript into a search data structure. Nodes represent repository states, candidate diffs, verifier observations, and merged lessons. A branch can die, but the reason it died stays available. That is the difference between retrying and learning.'},
        'Read the graph as a search structure, not as a conversation. A DAG is a directed acyclic graph: edges point from earlier states to later states, and no edge can lead back to an ancestor. Here the nodes are task state, candidate patches, verifier results, merged lessons, and the final selected patch.',
        'Active nodes are live branches receiving budget. Removed nodes are pruned branches whose evidence is still stored. The safe inference is that a branch can stop consuming verifier calls while still teaching the system what not to try again.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A coding agent usually needs more than one attempt. It reads the repository, forms a diagnosis, edits code, runs a verifier, and revises when the verifier fails. If every retry overwrites the last one, the agent loses the evidence it paid to collect.',
        'A candidate patch search DAG exists to make repair state queryable. It records which patch came from which parent, which tests ran, what failed, what cost was spent, and why a branch was kept or dropped. That lets the system learn from failed branches instead of repeating them in new wording.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is linear retry. The agent proposes one patch, runs tests, reads the output, edits again, and repeats until the budget ends or a test passes. This is easy because the workspace itself is the only state.',
        'Linear retry is not foolish. For a one-line syntax bug, keeping one current patch may be enough. The problem appears when several diagnoses are plausible and each needs a different verifier path.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is evidence loss. One branch fixes lint but misses behavior, another fixes the target test but touches a risky public API, and a third rewrites too much. A transcript may mention those attempts, but the control plane cannot dedupe, score, replay, or train from prose reliably.',
        'The cost wall is verifier budget. A full test suite can take minutes, while a syntax check takes seconds. If the agent spends full-suite calls on near-identical patches, cost rises without new information.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat each patch attempt as a node with provenance. Provenance means the recorded origin of an artifact: parent state, diff fingerprint, touched files, command results, verifier score, and decision reason. A verifier observation is also a node because it changes what the search knows.',
        'The final answer is a pointer into the DAG, not the last message in a chat. It is the best branch under budget, backed by verifier evidence and linked to alternatives it avoided. That ancestry is useful for debugging, replay, and training future repair systems.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The search starts with a task root: issue text, base commit, failing test, allowed edit surface, and budget. The agent creates several child candidates. Each candidate is applied in an isolated workspace or patch layer and checked by cheap verifiers first.',
        'Promising branches receive more budget. They may run targeted tests, then broader regression tests, then full suites if they become finalists. Failed branches keep their error signature, exit status, touched files, cost, and pruning reason.',
        'Merge nodes store lessons rather than raw Git merges. One branch may prove that the tokenizer surface matters, while another proves that a parser rewrite is too wide. The merge node turns those observations into a smaller final plan.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that every promoted patch has an explainable path from task root to current score. If a branch passes a verifier, the pass is attached to the exact diff that passed. If a branch fails, the failure signature blocks equivalent future work.',
        'This is a correctness argument about search control, not about proving the code bug is fixed in all possible worlds. The selected patch is correct relative to the verifier set because the DAG records which checks accepted it and which competing branches were weaker, duplicate, forbidden, or more expensive.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Let b be the number of candidate branches and v be the average verifier cost. A naive search that runs every verifier on every branch costs about b * v. A staged DAG lowers behavior cost by running cheap filters first and spending expensive tests only on survivors.',
        'For example, suppose syntax costs 2 seconds, targeted tests cost 30 seconds, and the full suite costs 6 minutes. With 20 candidates, running the full suite on all of them costs 120 minutes. If syntax drops 8, targeted tests drop 9 of the remaining 12, and only 3 run the full suite, the verifier time is 40 seconds + 6 minutes + 18 minutes, or about 24.7 minutes.',
        'The tradeoff is bookkeeping. The DAG stores parent ids, diff hashes, logs, scores, costs, and pruning decisions. That overhead buys behavior: fewer duplicate verifier calls, clearer failure analysis, and a sampler that can learn from branches that did not ship.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This structure fits parser fixes, compatibility repairs, dependency upgrades, flaky-test triage, security patches, and performance regressions. It is most useful when several plausible edits exist and each verifier call has meaningful cost.',
        'It is also useful as training data. A final patch alone teaches what worked. A patch DAG teaches what was tried, what failed, what evidence changed the plan, and why the final diff was selected.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The DAG fails when the verifier is too narrow. If the only score is one target test, the search will find patches that satisfy that test while breaking unmeasured behavior. Better branch control cannot compensate for a weak oracle.',
        'It also fails when branch generation is uncontrolled. A model can create many tiny variants that differ syntactically but not semantically. Without dedupe and pruning thresholds, the DAG becomes an expensive archive of the same idea.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume a parser issue has a $3 verifier budget and 30 minutes of wall-clock budget. The agent creates five candidates. P1 edits whitespace and fails lint in 2 seconds, P2 adds a tokenizer guard and passes a 30-second target test, P3 rewrites the parser and fails after 6 minutes, P4 combines P2 with a smaller parser guard and passes, and P5 changes a public API and is held for risk.',
        'The DAG selects P4 because it inherits the tokenizer lesson from P2, avoids the broad rewrite in P3, and has a smaller risk surface than P5. The final proof says: syntax passed, target test passed, related parser tests passed, changed files are tokenizer.js and parser.js, and broad rewrite branch was pruned for failing plus touching 8 files.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study SWE-agent at https://arxiv.org/abs/2405.15793, SWE-bench at https://arxiv.org/abs/2310.06770, Git apply at https://git-scm.com/docs/git-apply, and AlphaEvolve at https://arxiv.org/abs/2506.13131. Then study Beam Search, Tree of Thoughts Search Case Study, Process Reward Models and Verifier Search, Verified Agent Trajectory Store, and Agent Trajectory Dedupe and Provenance Hash.',
      ],
    },
  ],
};
