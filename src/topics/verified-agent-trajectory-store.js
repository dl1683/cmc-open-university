// Verified agent trajectory stores: how coding-agent data pipelines keep
// observations, actions, environments, oracle results, and provenance together.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'verified-agent-trajectory-store',
  title: 'Verified Agent Trajectory Store',
  category: 'AI & ML',
  summary: 'A data-engineering case study for coding agents: store task traces, runnable environments, oracle checks, dedupe keys, and provenance before training on them.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['trace schema', 'verifier factory'], defaultValue: 'trace schema' },
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

function trajectoryGraph(title) {
  return graphState({
    nodes: [
      { id: 'issue', label: 'issue', x: 0.7, y: 3.6, note: 'task' },
      { id: 'env', label: 'env', x: 2.2, y: 1.6, note: 'Docker' },
      { id: 'prompt', label: 'prompt', x: 2.2, y: 5.6, note: 'state' },
      { id: 'agent', label: 'agent', x: 3.9, y: 3.6, note: 'policy' },
      { id: 'observe', label: 'observe', x: 5.4, y: 1.4, note: 'stdout' },
      { id: 'action', label: 'action', x: 5.4, y: 3.6, note: 'edit/run' },
      { id: 'patch', label: 'patch', x: 5.4, y: 5.8, note: 'diff' },
      { id: 'oracle', label: 'oracle', x: 7.2, y: 2.3, note: 'tests' },
      { id: 'ledger', label: 'ledger', x: 7.2, y: 5.0, note: 'proof' },
      { id: 'train', label: 'train set', x: 9.0, y: 3.6, note: 'curated' },
    ],
    edges: [
      { id: 'e-issue-env', from: 'issue', to: 'env' },
      { id: 'e-issue-prompt', from: 'issue', to: 'prompt' },
      { id: 'e-env-agent', from: 'env', to: 'agent' },
      { id: 'e-prompt-agent', from: 'prompt', to: 'agent' },
      { id: 'e-agent-observe', from: 'agent', to: 'observe' },
      { id: 'e-agent-action', from: 'agent', to: 'action' },
      { id: 'e-action-patch', from: 'action', to: 'patch' },
      { id: 'e-action-observe', from: 'action', to: 'observe' },
      { id: 'e-patch-oracle', from: 'patch', to: 'oracle' },
      { id: 'e-oracle-ledger', from: 'oracle', to: 'ledger' },
      { id: 'e-ledger-train', from: 'ledger', to: 'train' },
    ],
  }, { title });
}

function factoryGraph(title) {
  return graphState({
    nodes: [
      { id: 'repos', label: 'repos', x: 0.6, y: 3.6, note: 'source' },
      { id: 'snap', label: 'snapshots', x: 2.0, y: 1.7, note: 'commits' },
      { id: 'build', label: 'build', x: 3.4, y: 1.7, note: 'images' },
      { id: 'tasks', label: 'tasks', x: 2.0, y: 5.5, note: 'issues' },
      { id: 'rollout', label: 'rollout', x: 4.8, y: 3.6, note: 'agents' },
      { id: 'oracle', label: 'oracle', x: 6.4, y: 2.1, note: 'fail/pass' },
      { id: 'dedupe', label: 'dedupe', x: 6.4, y: 5.1, note: 'hashes' },
      { id: 'refresh', label: 'refresh', x: 8.0, y: 1.4, note: 'drift' },
      { id: 'holdout', label: 'holdout', x: 8.0, y: 5.8, note: 'eval' },
      { id: 'release', label: 'release', x: 9.3, y: 3.6, note: 'dataset' },
    ],
    edges: [
      { id: 'e-repos-snap', from: 'repos', to: 'snap' },
      { id: 'e-snap-build', from: 'snap', to: 'build' },
      { id: 'e-repos-tasks', from: 'repos', to: 'tasks' },
      { id: 'e-build-rollout', from: 'build', to: 'rollout' },
      { id: 'e-tasks-rollout', from: 'tasks', to: 'rollout' },
      { id: 'e-rollout-oracle', from: 'rollout', to: 'oracle' },
      { id: 'e-rollout-dedupe', from: 'rollout', to: 'dedupe' },
      { id: 'e-oracle-refresh', from: 'oracle', to: 'refresh' },
      { id: 'e-dedupe-holdout', from: 'dedupe', to: 'holdout' },
      { id: 'e-refresh-release', from: 'refresh', to: 'release' },
      { id: 'e-holdout-release', from: 'holdout', to: 'release' },
    ],
  }, { title });
}

function* traceSchema() {
  yield {
    state: trajectoryGraph('A coding-agent trajectory is a typed event log'),
    highlight: { active: ['issue', 'env', 'prompt', 'agent', 'e-issue-env', 'e-issue-prompt', 'e-env-agent', 'e-prompt-agent'], compare: ['train'] },
    explanation: 'A trajectory store starts before the first model token because the same message can mean different work in different repos, containers, tools, or permission sets. Task, environment, prompt state, tool contracts, and permissions are part of the example, so later actions can be replayed instead of guessed from a transcript.',
  };

  yield {
    state: trajectoryGraph('Observations and actions alternate under one operation id'),
    highlight: { active: ['agent', 'observe', 'action', 'patch', 'e-agent-observe', 'e-agent-action', 'e-action-observe', 'e-action-patch'], found: ['ledger'] },
    explanation: 'The useful data is not just the final patch. It is the full sequence: read file, observe error, edit, run test, inspect failure, repair. Store it like Distributed Tracing: each step needs a stable id, parent id, timestamp, tool payload, result, and redaction state.',
    invariant: 'If a trajectory cannot be replayed, it should not be trusted as training data.',
  };

  yield {
    state: labelMatrix(
      'Minimal trajectory schema',
      [
        { id: 'task', label: 'task' },
        { id: 'env', label: 'environment' },
        { id: 'turn', label: 'turn event' },
        { id: 'patch', label: 'patch' },
        { id: 'oracle', label: 'oracle' },
        { id: 'proof', label: 'proof record' },
      ],
      [
        { id: 'key', label: 'primary key' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['repo+issue+commit', 'dedupe and split'],
        ['image digest', 'reproducibility'],
        ['operation id', 'replay order'],
        ['diff hash', 'candidate identity'],
        ['test run id', 'objective check'],
        ['ledger id', 'auditable inclusion'],
      ],
    ),
    highlight: { active: ['env:key', 'turn:key', 'oracle:key', 'proof:key'], found: ['proof:why'] },
    explanation: 'The schema separates task identity, environment identity, event identity, candidate identity, oracle identity, and proof identity. A single transcript id cannot answer which part changed; separate keys let a data team rerun only the stale container, bad oracle, or disputed patch.',
  };

  yield {
    state: labelMatrix(
      'Quality labels before training',
      [
        { id: 'pass', label: 'verified pass' },
        { id: 'partial', label: 'partial repair' },
        { id: 'flaky', label: 'flaky oracle' },
        { id: 'leak', label: 'leaky sample' },
        { id: 'duplicate', label: 'duplicate' },
      ],
      [
        { id: 'signal', label: 'training signal' },
        { id: 'action', label: 'store action' },
      ],
      [
        ['strong', 'promote'],
        ['weak but useful', 'tag separately'],
        ['dangerous', 'quarantine'],
        ['invalid eval', 'exclude'],
        ['overweights pattern', 'downsample'],
      ],
    ),
    highlight: { active: ['pass:action', 'partial:action'], removed: ['flaky:action', 'leak:action'], compare: ['duplicate:action'] },
    explanation: 'A clean store does not throw every rollout into one pile. Passing fixes, partial fixes, flaky tests, leakage, and duplicates are different data products. The labels are as important as the text.',
  };
}

function* verifierFactory() {
  yield {
    state: factoryGraph('The expensive part is the verifier factory'),
    highlight: { active: ['repos', 'snap', 'build', 'tasks', 'rollout', 'e-repos-snap', 'e-snap-build', 'e-repos-tasks', 'e-build-rollout', 'e-tasks-rollout'], compare: ['release'] },
    explanation: 'Execution-grounded models depend on a factory: repos are snapshotted, environments are built, tasks are selected, and agents generate trajectories. The model checkpoint is the output people see; the data factory is the asset that compounds.',
  };

  yield {
    state: factoryGraph('Oracle checks decide whether the trace is real signal'),
    highlight: { active: ['rollout', 'oracle', 'refresh', 'e-rollout-oracle', 'e-oracle-refresh'], found: ['release'], compare: ['dedupe'] },
    explanation: 'The oracle should prove the bug existed before the patch and is resolved after the patch. For SWE-bench-style tasks, that often means isolated containers, failing-to-passing tests, hidden tests, and strict patch application; otherwise the store only knows that a patch looked plausible.',
    invariant: 'A fluent patch with no oracle proof is unlabeled text, not verified trajectory data.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'candidate rollouts', min: 0, max: 1000 }, y: { label: 'usable examples', min: 0, max: 260 } },
      series: [
        { id: 'raw', label: 'raw rollouts', points: [{ x: 50, y: 50 }, { x: 150, y: 150 }, { x: 300, y: 300 }, { x: 600, y: 600 }, { x: 1000, y: 1000 }] },
        { id: 'verified', label: 'verified', points: [{ x: 50, y: 15 }, { x: 150, y: 43 }, { x: 300, y: 82 }, { x: 600, y: 145 }, { x: 1000, y: 225 }] },
        { id: 'novel', label: 'novel after dedupe', points: [{ x: 50, y: 14 }, { x: 150, y: 38 }, { x: 300, y: 66 }, { x: 600, y: 104 }, { x: 1000, y: 136 }] },
      ],
      markers: [
        { id: 'choke', x: 620, y: 110, label: 'dedupe choke' },
      ],
    }),
    highlight: { active: ['verified', 'novel', 'choke'], compare: ['raw'] },
    explanation: 'The raw number of rollouts is misleading. Tests fail to reproduce, patches are partial, environments break, and many successes are near duplicates. The training set grows slower than the rollout budget.',
  };

  yield {
    state: labelMatrix(
      'Portability audit',
      [
        { id: 'tool', label: 'tool grammar' },
        { id: 'shell', label: 'shell' },
        { id: 'edit', label: 'edit format' },
        { id: 'lang', label: 'language' },
        { id: 'timeout', label: 'timeout' },
      ],
      [
        { id: 'overfit symptom', label: 'overfit symptom' },
        { id: 'audit move', label: 'audit move' },
      ],
      [
        ['magic API habit', 'randomize tools'],
        ['shell-specific scripts', 'swap runners'],
        ['diff/whole-file gap', 'dual encodings'],
        ['Python locality', 'language splits'],
        ['retry budget crutch', 'budget curves'],
      ],
    ),
    highlight: { active: ['tool:audit move', 'edit:audit move', 'lang:audit move', 'timeout:audit move'], compare: ['tool:overfit symptom'] },
    explanation: 'The store should make portability measurable. If a model only works with one edit tool, one shell, one language, one timeout, or one hidden-test style, that is a data distribution problem visible in the trajectory metadata.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'trace schema') yield* traceSchema();
  else if (view === 'verifier factory') yield* verifierFactory();
  else throw new InputError('Pick a trajectory-store view.');
}

export const article = {
  sections: [
    {
      heading: 'The problem',
      paragraphs: [
        'A coding-agent training example is not just a prompt and a final patch. It is an interaction between a task, a repository snapshot, an execution environment, a tool interface, a model policy, a sequence of observations and actions, and an oracle that decides whether the result worked. If those pieces are not stored together, the example cannot be trusted later.',
        'The same final diff can mean different things in different worlds. It may fix the bug at one commit and fail at another. It may pass because a dependency version changed. It may rely on a hidden setup step, a cached file, a permissive network policy, or a test command that is no longer available. A transcript that looks clear to a human reader can become ambiguous when used for training, evaluation, or audit.',
        'A verified agent trajectory store exists to keep the work replayable. It stores the task, environment, prompt state, tool calls, observations, patch, oracle checks, dedupe keys, provenance, and proof records as one evidence object. The goal is not to make storage neat. The goal is to know why a trajectory is allowed into a dataset and what claim that inclusion supports.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to save successful transcripts. Keep the user request, the model messages, the tool calls if convenient, the final patch, and the test output. For a demo, this is enough. A person can skim the run and decide that the agent appeared to make progress.',
        'This breaks when the transcript becomes a data product. A successful-looking patch may be unverifiable because the environment disappeared. A test pass may be meaningless because the bug never failed before the patch. A model may have copied a leaked benchmark answer. A tool call may have been redacted so heavily that the step cannot be replayed. A final diff hides failed attempts, diagnostic reads, command errors, and repair loops that may be the most useful learning signal.',
        'The naive store also collapses different questions into one id. Is this the same task? The same environment? The same candidate patch? The same oracle result? The same proof decision? A single transcript id cannot answer those questions. A verified store separates them so stale or disputed parts can be repaired without pretending the whole trajectory is one opaque blob.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat the trajectory as a typed evidence ledger. The ledger has separate keys for task identity, environment identity, event identity, candidate identity, oracle identity, and proof identity. Those keys are not bookkeeping decoration. They are the data structure that makes replay, dedupe, train/eval splitting, refresh, and audit possible.',
        'This is write-ahead-log discipline applied to agent data. Append the raw events first: observations, actions, payloads, outputs, timestamps, exit codes, diffs, and redaction markers. Derived artifacts come later: summaries, embeddings, reward labels, preference labels, trace compression, and training slices. If a derived label says "verified pass", the raw evidence should still show what failed before, what changed, what passed after, and what was not checked.',
        'The store should also preserve negative and partial evidence. Failed commands, mistaken edits, timeouts, rejected patches, and partial repairs are not garbage by default. They can teach search, debugging, tool use, and recovery. The label layer decides how to use them; the storage layer should not erase them prematurely.',
      ],
    },
    {
      heading: 'The schema',
      paragraphs: [
        'A minimal task record stores repository, issue text or task prompt, base commit, task source, split family, authoring process, and any known leakage flags. The environment record stores image digest, package lockfiles, system dependencies, test commands, resource limits, network policy, secrets policy, and tool availability. Without this layer, replay depends on luck.',
        'A turn record stores operation id, parent id, model message, normalized tool call, raw payload, observation, stdout, stderr, exit code, elapsed time, files read, files written, and redaction state. The parent id matters because agent work is a tree or graph of attempts, not just a flat transcript. The same high-level action may branch into retries, diagnostics, or alternative patches.',
        'A candidate record stores the patch, diff hash, files touched, generated artifacts, and relationship to previous candidates. An oracle record stores pre-patch failure evidence, post-patch pass evidence, hidden-test status if available, flake handling, timeout policy, and failure classification. A proof record links task, environment, turns, candidate, and oracle into an inclusion decision.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The factory starts by snapshotting sources. Repositories are pinned to commits. Tasks are selected from issues, synthetic mutations, benchmark items, or internal bug reports. Environments are built into images with stable digests. Tool contracts are recorded: shell, editor, browser, test runner, patch format, timeout, and permission model.',
        'Agents then run against those pinned worlds. Every observation and action is appended before later processing. If the agent reads a file, the store records what was requested and what came back. If it runs a command, the store records the command, exit code, time, stdout, stderr, and whether the result was truncated. If it edits a file, the store records the exact patch and the resulting content hash.',
        'The oracle checks the candidate. For bug-fixing tasks, a strong oracle proves that the relevant test failed before the patch and passed after the patch. It may include hidden tests, lint checks, type checks, or human review, but each check must be named. The store should not say "verified" when it only knows that one visible test passed.',
        'After verification, the pipeline labels the trajectory. Verified pass, partial repair, flaky oracle, environment failure, policy violation, duplicate, leakage risk, and unusable redaction are different outcomes. Mixing them into one training bucket turns the dataset into noise. Keeping them separate lets training sample the right signal for the right objective.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is replayability. If the environment id reconstructs the runnable world, the event ids reconstruct the action sequence, the candidate id names the patch, and the oracle id names the checks, then the proof record can be inspected or rerun. If any key is missing, the claim becomes weaker because one dependency has moved from evidence into memory.',
        'Replayability does not require that every future run produce bit-identical output. Real systems have nondeterminism, flaky tests, and dependency drift. The point is that the store can identify what changed. If a dependency update breaks a former pass, the team can mark the environment stale, rebuild it, rerun the oracle, and write a new proof record rather than silently corrupting the old label.',
        'The store also protects evaluation. Held-out performance is only meaningful if related examples cannot leak across the split. Splits may need to be assigned by repository, issue family, synthetic mutation source, patch fingerprint, oracle fingerprint, or tool grammar. A verified store has enough keys to enforce those boundaries instead of hoping exact prompt text is enough.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The cost is substantial. Raw event logs are larger than final patches. Containers, test artifacts, and dependency caches are expensive to store. Ingestion is slower because every event needs a schema and every proof needs a link. Redaction, access control, and retention policy are mandatory because trajectories may contain source code, credentials, proprietary data, or user content.',
        'The schema can also become too rigid. If the store only understands one shell, one editor, or one patch format, models trained from it may overfit to that interface. A good store records concrete tool use while also extracting abstract operations such as read file, search text, edit hunk, run focused test, inspect failure, and rerun suite. The concrete trace supports replay; the abstract trace supports portability analysis.',
        'The tradeoff is worthwhile when examples are expensive or public claims depend on them. A weak store is faster until something goes wrong: a benchmark result is questioned, a model learns a leaked pattern, an environment cannot be rebuilt, or a large training run overweights duplicates. Then missing evidence becomes the most expensive part of the system.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'A verified trajectory store wins for coding-agent training, SWE-style evaluation, tool-use research, verifier-guided reinforcement learning, and enterprise audit trails. It lets a team answer concrete questions: did the bug fail before the patch, did it pass after, was the environment pinned, was the sample duplicated, and which split owns this family?',
        'It also improves research quality. Instead of reporting only aggregate success, researchers can separate gains from execution grounding, retry budget, oracle strength, repository familiarity, language distribution, or tool-interface overfitting. The store turns those into measurable columns rather than speculation.',
        'For production agents, the same structure supports incident review. If an agent made a harmful edit, the team can inspect what it observed, which tool permissions were active, which tests it trusted, and why the run was accepted. That is operationally different from reading a chat transcript after the fact.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The pattern is overkill for disposable demos, simple chat transcripts, or exploratory tasks where no training, evaluation, or audit claim will be made. It is also impossible when the organization cannot legally store enough detail to replay the work. In that case the right answer is not to fake verification; it is to store a narrower claim with explicit limitations.',
        'It also fails when the oracle is weak. A perfect ledger around a bad verifier still produces bad labels. If the tests do not cover the bug, the proof record should say that only the named checks passed. If the oracle is flaky, quarantine or repeated-run policy belongs in the record. Verification is a claim about evidence, not a feeling about plausibility.',
        'Finally, the store fails if derived labels overwrite raw events. Summaries are useful for browsing and training, but they are not a substitute for the original observations, actions, and oracle outputs. Once the raw evidence is gone, later audits can only debate summaries.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a Python bug-fixing task. The task record stores the repository, issue text, base commit, failing test hint, source of the task, and split family. The environment record stores image digest, package hashes, test command, CPU and memory limits, filesystem mount policy, and whether network access is blocked. The first oracle run proves the test fails before the patch.',
        'The agent reads the failing test, searches for the function, edits one file, runs a focused test, sees a new failure, repairs the edge case, and reruns the suite. Each turn is stored with a stable id, tool payload, output, elapsed time, exit code, and content hashes for files read or written. The final candidate stores the diff and patch fingerprint.',
        'The oracle then runs the agreed checks. If the pre-patch failure and post-patch pass both hold, the proof record marks the trajectory as a verified pass. If the focused test passes but the suite fails, the trajectory becomes a partial repair. If the environment build fails, the task is not a model failure. These distinctions are what make the dataset useful.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study agent trajectory dedupe and provenance hashing next, because verification alone does not prevent duplicate families from leaking across train and eval. Then study state-diff traces, abstract agent operation graphs, interface portability audits, process reward models, verifier search, and benchmark variance.',
        'For systems grounding, study distributed tracing, write-ahead logs, content-addressed storage, Git internals, data leakage, temporal workflow engines, and software supply-chain provenance. A verified trajectory store is built from those older systems ideas: stable identity, append-only evidence, replayable execution, and explicit proof boundaries.',
      ],
    },
  ],
};
