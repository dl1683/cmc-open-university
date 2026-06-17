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
      heading: 'Why this exists',
      paragraphs: [
        "Coding agents fail differently from ordinary autocomplete. They are not choosing one next token and stopping. They inspect a repository, form a diagnosis, edit files, run tools, read failures, and try again. If each retry overwrites the last one, the agent loses the most expensive thing it bought: evidence.",
        "A candidate patch search DAG exists to make that evidence explicit. Nodes represent repository states, candidate diffs, verifier observations, merged lessons, and final proof records. Edges show ancestry. A branch can die, but the reason it died remains available. That turns repair from a chat transcript into a search data structure.",
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        "The naive approach is linear retry. The agent proposes one patch, runs a verifier, reads the failure, edits again, and repeats until something passes or the budget ends. This can work on small bugs, and it is easy to implement because the current workspace is the only state.",
        "The wall appears when several plausible diagnoses compete. One branch fixes lint but misses behavior. Another fixes the target test but risks a public API. A third rewrites too much and creates regressions. A linear transcript may remember these in prose, but the control plane cannot query them, dedupe them, score them, or train from them reliably.",
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "The core insight is to treat each patch attempt as a node with provenance, not as a disposable edit. A candidate has parents, touched files, a diff fingerprint, a cost, a verifier result, a score, and a next action. A verifier observation is also a node because a test failure changes what the system knows.",
        "The final answer is a pointer into this DAG. It is not simply the last patch. It is the selected branch under budget, supported by evidence and connected to the failed alternatives it avoided. That ancestry is useful for debugging the agent, replaying the search, and training future repair models.",
        "Branch identity must be stable enough to compare attempts. Two patches with different whitespace but the same semantic edit may deserve one verifier call, while two patches touching the same file may still represent different hypotheses. The DAG needs fingerprints, but it also needs reason codes.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "The search starts at a task root: the issue, failing test, repository snapshot, and allowed edit surface. The agent proposes several candidate patches from that root. Each candidate is applied in a reproducible workspace or patch application layer, then checked by cheap verifiers first: formatting, syntax, lint, type checks, targeted tests, or a small reproduction.",
        "Promising branches receive more budget. They may run broader tests, request deeper inspection, or spawn child patches. Failed branches are not erased. The DAG stores the error message, command, exit status, and a short failure signature. A dedupe index prevents the agent from spending another verifier call on an equivalent patch.",
        "Merging is a knowledge operation, not necessarily a Git merge. One branch can teach that a parser assumption was wrong. Another can show that tokenizer behavior is the real surface. The merge node records the distilled plan that survives across branches, and a final node stores the selected patch plus its proof.",
        "Replay is the boundary that keeps this honest. A candidate id should point to the base commit or snapshot, the exact diff, the commands that ran, and the observed outputs. If those pieces cannot be replayed, the graph is only a memory aid. If they can be replayed, the graph becomes an audit trail and a training object.",
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        "The first visual proves that patch search has branching structure. The root is shared repository state. Patch nodes are competing hypotheses. Verifier nodes are observations. The merge node keeps lessons that survive across branches. The final node is chosen because it carries proof, not because it happened to be generated last.",
        "The pruning visual proves the tax. Keeping every branch forever explodes. Keeping only the current branch forgets useful evidence. Logged pruning gives the middle ground: drop duplicate, broad, slow, failing, or risky branches while preserving the reason code so the agent does not repeat them.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "The method works because it preserves the invariant that every promoted patch has an explainable path from the task root to its current score. If two branches share an ancestor, the system can reuse that ancestry. If a branch fails, the system can block similar future attempts. If a branch passes, the proof is attached to the exact diff that passed.",
        "This is close to beam search in spirit, but the state is executable. A candidate patch can be applied, reverted, hashed, compared, tested, and replayed. That makes the search stronger than a list of natural-language thoughts. The verifier is not just an opinion; it produces artifacts that can be attached to the DAG.",
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        "The main cost is verifier budget. If the agent runs the full test suite on every candidate, the DAG becomes expensive fast. A practical system stages verification: parse and format first, then targeted tests, then relevant regression tests, and only then full suites for finalists.",
        "Memory and bookkeeping also matter. The DAG stores diff fingerprints, parent ids, touched files, logs, scores, cost, and pruning decisions. That is more complex than a retry loop. The payoff is control. You can ask which branch used the most budget, which failures repeated, which verifier caught regressions, and which edits were pruned because they touched forbidden files.",
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        "This structure wins when repair has several plausible routes and verifier calls are expensive enough to manage. Real examples include parser bugs, compatibility fixes, flaky test triage, dependency upgrades, performance regressions, migration work, and security patches where broad rewrites are risky.",
        "It is also valuable for training data. A final patch alone teaches what worked. A patch DAG teaches what was tried, what failed, what evidence changed the plan, and why the final diff was selected. That is closer to the real work of software engineering than a static before-and-after pair.",
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        "The DAG can overfit to a narrow oracle. If the only score is one target test, the search will find patches that satisfy that test while breaking unmeasured behavior. The fix is not to trust the DAG more. The fix is to improve staged verification and promote finalists through broader checks.",
        "Branch explosion is the other failure. A generous generator can produce many tiny variants, and a cautious pruning policy can keep too many alive. Silent pruning is also dangerous because later analysis cannot tell whether a branch was bad, too expensive, forbidden, or merely unlucky. Pruning must be explicit and logged.",
        "A patch DAG also depends on reproducibility. If tests are flaky, workspaces are dirty, or tool outputs are not tied to the exact patch, the ancestry becomes misleading. The structure is only as reliable as the replay boundary around each candidate.",
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        "Study Beam Search for the frontier-pruning baseline, Tree of Thoughts Search Case Study for semantic branch states, Process Reward Models & Verifier Search for scoring partial work, Verified Agent Trajectory Store for durable provenance, and Agent Interface Portability Audit for execution environments.",
        "For primary background, read SWE-agent at https://arxiv.org/abs/2405.15793, SWE-bench at https://arxiv.org/abs/2310.06770, Git apply at https://git-scm.com/docs/git-apply, and AlphaEvolve at https://arxiv.org/abs/2506.13131. Then compare this topic with Synthetic Bug Mutation Oracle Case Study and Web Agent Evaluation Trace Ledger Case Study.",
      ],
    },
  ],
};
