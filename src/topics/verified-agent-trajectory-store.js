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
    explanation: 'A trajectory store starts before the first model token. The task, environment snapshot, prompt state, tool contracts, and permissions are part of the example. Without them, the later action trace cannot be replayed or judged.',
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
    explanation: 'The schema separates task identity, environment identity, event identity, candidate identity, oracle identity, and proof identity. That separation lets a data team rerun only the broken part when dependencies drift.',
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
    explanation: 'The oracle should prove the bug existed before the patch and is resolved after the patch. For SWE-bench-style tasks, that often means isolated containers, failing-to-passing tests, hidden tests, and strict patch application.',
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
      heading: 'What it is',
      paragraphs: [
        'A verified agent trajectory store is the data structure behind execution-grounded coding agents. It stores tasks, environment snapshots, prompts, tool calls, observations, patches, oracle results, dedupe keys, and proof records as one replayable object. The goal is not to keep a pretty transcript. The goal is to know exactly which behavior was observed, under which environment, why it was considered correct, and whether it should be used for training, evaluation, debugging, or analysis.',
        'This extends Code World Models Case Study. Meta CWM reports mid-training on observation-action trajectories from Python interpreter and agentic Docker environments, then reasoning RL in verifiable coding, math, and software-engineering environments: https://arxiv.org/abs/2510.02387 and https://ai.meta.com/research/publications/cwm-an-open-weights-llm-for-research-on-code-generation-with-world-models/. The reusable systems lesson is that the trajectory factory matters as much as the model architecture.',
      ],
    },
    {
      heading: 'Core schema',
      paragraphs: [
        'The store should separate six identities: task id, environment id, turn id, candidate id, oracle id, and proof id. Task id ties the example to a repository, issue, commit, and split. Environment id pins a Docker image digest, dependency lockfile, operating system, test command, and resource limits. Turn id orders observations and actions. Candidate id identifies a patch or solution attempt. Oracle id identifies the tests, hidden checks, or verifier used. Proof id records why the trajectory was promoted or rejected.',
        'This is Write-Ahead Log and Distributed Tracing discipline applied to AI data. Append raw events first. Derive summaries, embeddings, rewards, and labels later. If a summary claims the agent fixed a bug, the store should still hold the original failing test, the patch, the passing test, stdout, stderr, timeout state, and any redactions. If those records are missing, the example is not verified; it is just plausible prose.',
      ],
    },
    {
      heading: 'Verifier factory',
      paragraphs: [
        'A serious verifier factory snapshots repos, builds runnable environments, selects tasks, generates candidate trajectories, checks them with objective oracles, deduplicates near-identical examples, and refreshes stale environments. SWE-bench frames the benchmark problem as resolving real GitHub issues by producing patches for codebases: https://www.swebench.com/ and https://github.com/swe-bench/SWE-bench. OpenAI introduced SWE-bench Verified as a human-validated subset intended to make that evaluation more reliable: https://openai.com/index/introducing-swe-bench-verified/.',
        'The factory is expensive because every accepted example must survive several failure modes. Dependencies rot. Tests can be flaky. A patch can pass visible tests while missing the real issue. A trajectory can leak benchmark answers. A model can learn one tool grammar instead of the abstract operation. Abstract Agent Operation Graph makes that failure inspectable, while Agent Harness Portability Audit tests whether it matters under interface shifts. Dedupe is also more subtle than string equality: two traces may look different but encode the same fix ritual, and a training set with too many near-duplicates can make benchmark behavior brittle.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a Python bug-fixing agent. The task record stores repository, issue text, base commit, target files, and split assignment. The environment record stores image digest, package hashes, test command, CPU and memory limits, and network policy. Each turn records the model message, tool call, normalized payload, observation, exit code, elapsed time, and redaction markers. The candidate record stores the patch diff and derived features such as files touched. The oracle record stores pre-patch failure, post-patch pass, hidden-test result if available, and failure reason. The proof ledger links all of this into one inclusion decision.',
        'The same store supports training and audit. Training can sample verified successes, partial repairs, and negative examples separately. Evaluation can hold out repos, issues, or tool grammars. Debugging can replay a failed trajectory from the exact environment. Research can ask whether model gains came from execution grounding, retry budget, test leakage, or tool overfitting. That is why a trajectory store is a control-plane object, not a logging afterthought.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not train on unlabeled agent transcripts as if they were verified trajectories. Do not mix partial and full successes without labels. Do not let the same issue family leak across train and eval. Do not assume a pass in one harness means portability to another. Do not store private code or secrets without redaction and authorization. The better mental model is an evidence ledger: every promoted example must say what happened, why it is correct, and what assumptions make it reusable.',
        'Study Code World Models Case Study, Execution Trace State Diff Case Study, Dynamic Scratchpad Execution Trace Case Study, Agent Trajectory Dedupe & Provenance Hash, Rust Borrow Checker Ownership Trace, Abstract Agent Operation Graph, Agent Harness Portability Audit, Execution-as-a-Service Verifier Economy Case Study, AlphaEvolve Case Study, Process Reward Models & Verifier Search, LLM Evaluation Harnesses, Temporal Workflow Case Study, Distributed Tracing, Write-Ahead Log, Git Internals, Data Leakage, and Benchmark Variance next. Local source: Code World Models Breakdown.txt in the provided document corpus.',
      ],
    },
  ],
};
