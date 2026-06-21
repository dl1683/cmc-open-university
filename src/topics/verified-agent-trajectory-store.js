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
  const pipelineNodes = ['issue', 'env', 'prompt', 'agent', 'observe', 'action', 'patch', 'oracle', 'ledger', 'train'];
  const pipelineEdges = ['e-issue-env', 'e-issue-prompt', 'e-env-agent', 'e-prompt-agent', 'e-agent-observe', 'e-agent-action', 'e-action-patch', 'e-action-observe', 'e-patch-oracle', 'e-oracle-ledger', 'e-ledger-train'];
  const nodeCount = pipelineNodes.length;
  const edgeCount = pipelineEdges.length;
  const firstNode = pipelineNodes[0];
  const lastNode = pipelineNodes[pipelineNodes.length - 1];

  yield {
    state: trajectoryGraph('A coding-agent trajectory is a typed event log'),
    highlight: { active: ['issue', 'env', 'prompt', 'agent', 'e-issue-env', 'e-issue-prompt', 'e-env-agent', 'e-prompt-agent'], compare: ['train'] },
    explanation: `A trajectory store with ${nodeCount} pipeline stages starts before the first model token because the same message can mean different work in different repos, containers, tools, or permission sets. Task, environment, prompt state, tool contracts, and permissions are part of the example, so later actions can be replayed instead of guessed from a transcript. The pipeline flows from ${firstNode} to ${lastNode}.`,
  };

  const actionStages = ['observe', 'action', 'patch'];
  const actionEdgeCount = 4;

  yield {
    state: trajectoryGraph('Observations and actions alternate under one operation id'),
    highlight: { active: ['agent', 'observe', 'action', 'patch', 'e-agent-observe', 'e-agent-action', 'e-action-observe', 'e-action-patch'], found: ['ledger'] },
    explanation: `The useful data is not just the final patch. It is the full sequence across ${actionStages.length} action stages (${actionStages.join(', ')}), connected by ${actionEdgeCount} edges: read file, observe error, edit, run test, inspect failure, repair. Store it like Distributed Tracing: each step needs a stable id, parent id, timestamp, tool payload, result, and redaction state.`,
    invariant: `If a trajectory spanning ${nodeCount} stages and ${edgeCount} edges cannot be replayed, it should not be trusted as training data.`,
  };

  const schemaFields = ['task', 'environment', 'turn event', 'patch', 'oracle', 'proof record'];
  const schemaFieldCount = schemaFields.length;
  const schemaColumnCount = 2;

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
    explanation: `The schema maps ${schemaFieldCount} entity types (${schemaFields.join(', ')}) across ${schemaColumnCount} columns to separate task identity, environment identity, event identity, candidate identity, oracle identity, and proof identity. A single transcript id cannot answer which part changed; separate keys let a data team rerun only the stale container, bad oracle, or disputed patch.`,
  };

  const qualityLabels = ['verified pass', 'partial repair', 'flaky oracle', 'leaky sample', 'duplicate'];
  const qualityLabelCount = qualityLabels.length;
  const promotable = qualityLabels.slice(0, 2);
  const quarantinable = qualityLabels.slice(2);

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
    explanation: `A clean store does not throw every rollout into one pile. It distinguishes ${qualityLabelCount} quality labels: ${promotable.join(' and ')} can be promoted, while ${quarantinable.join(', ')} need quarantine or downsampling. The labels are as important as the text.`,
  };
}

function* verifierFactory() {
  const factoryNodes = ['repos', 'snap', 'build', 'tasks', 'rollout', 'oracle', 'dedupe', 'refresh', 'holdout', 'release'];
  const factoryEdges = ['e-repos-snap', 'e-snap-build', 'e-repos-tasks', 'e-build-rollout', 'e-tasks-rollout', 'e-rollout-oracle', 'e-rollout-dedupe', 'e-oracle-refresh', 'e-dedupe-holdout', 'e-refresh-release', 'e-holdout-release'];
  const factoryNodeCount = factoryNodes.length;
  const factoryEdgeCount = factoryEdges.length;
  const ingestStages = factoryNodes.slice(0, 5);

  yield {
    state: factoryGraph('The expensive part is the verifier factory'),
    highlight: { active: ['repos', 'snap', 'build', 'tasks', 'rollout', 'e-repos-snap', 'e-snap-build', 'e-repos-tasks', 'e-build-rollout', 'e-tasks-rollout'], compare: ['release'] },
    explanation: `Execution-grounded models depend on a ${factoryNodeCount}-stage factory connected by ${factoryEdgeCount} edges: ${ingestStages.join(', ')} feed the ingestion half. The model checkpoint is the output people see; the data factory is the asset that compounds.`,
  };

  const oracleNode = factoryNodes[5];
  const verifyStages = [factoryNodes[4], factoryNodes[5], factoryNodes[7]];

  yield {
    state: factoryGraph('Oracle checks decide whether the trace is real signal'),
    highlight: { active: ['rollout', 'oracle', 'refresh', 'e-rollout-oracle', 'e-oracle-refresh'], found: ['release'], compare: ['dedupe'] },
    explanation: `The ${oracleNode} should prove the bug existed before the patch and is resolved after the patch. The verification path (${verifyStages.join(' → ')}) uses isolated containers, failing-to-passing tests, hidden tests, and strict patch application; otherwise the store only knows that a patch looked plausible.`,
    invariant: `A fluent patch with no ${oracleNode} proof is unlabeled text, not verified trajectory data.`,
  };

  const maxRollouts = 1000;
  const maxUsable = 260;
  const seriesCount = 3;
  const pointsPerSeries = 5;
  const chokeX = 620;
  const chokeY = 110;
  const finalVerified = 225;
  const finalNovel = 136;

  yield {
    state: plotState({
      axes: { x: { label: 'candidate rollouts', min: 0, max: maxRollouts }, y: { label: 'usable examples', min: 0, max: maxUsable } },
      series: [
        { id: 'raw', label: 'raw rollouts', points: [{ x: 50, y: 50 }, { x: 150, y: 150 }, { x: 300, y: 300 }, { x: 600, y: 600 }, { x: 1000, y: 1000 }] },
        { id: 'verified', label: 'verified', points: [{ x: 50, y: 15 }, { x: 150, y: 43 }, { x: 300, y: 82 }, { x: 600, y: 145 }, { x: 1000, y: finalVerified }] },
        { id: 'novel', label: 'novel after dedupe', points: [{ x: 50, y: 14 }, { x: 150, y: 38 }, { x: 300, y: 66 }, { x: 600, y: 104 }, { x: 1000, y: finalNovel }] },
      ],
      markers: [
        { id: 'choke', x: chokeX, y: chokeY, label: 'dedupe choke' },
      ],
    }),
    highlight: { active: ['verified', 'novel', 'choke'], compare: ['raw'] },
    explanation: `Across ${seriesCount} series of ${pointsPerSeries} points each, the raw number of rollouts is misleading. Of ${maxRollouts} candidates, only ${finalVerified} survive verification and just ${finalNovel} remain after dedupe. The dedupe choke point near rollout ${chokeX} shows where duplicate saturation begins to dominate.`,
  };

  const auditDimensions = ['tool grammar', 'shell', 'edit format', 'language', 'timeout'];
  const auditDimCount = auditDimensions.length;
  const firstAuditDim = auditDimensions[0];
  const lastAuditDim = auditDimensions[auditDimensions.length - 1];

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
    explanation: `The store should make portability measurable across ${auditDimCount} dimensions from ${firstAuditDim} to ${lastAuditDim}. If a model only works with one edit tool, one shell, one language, or one ${lastAuditDim}, that is a data distribution problem visible in the trajectory metadata.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The trace schema view shows the lifecycle of a single agent trajectory from task intake to curated training set. Active highlights mark the current pipeline stage. Found highlights mark data that has been verified by the oracle. Compare highlights mark the final training set, which is always smaller than the raw rollout count.',
        {
          type: 'callout',
          text: 'A verified trajectory store treats an agent run as evidence only when the task, environment, actions, patch, and oracle can be replayed together.',
        },
        'The verifier factory view zooms out to the production pipeline: snapshotting repos, building environments, running agents, checking oracles, deduplicating results, and releasing datasets. Watch how the pipeline narrows at each stage. The plot shows the gap between raw rollouts and usable, novel examples after verification and dedupe.',
        'In both views, pay attention to what gets dropped and why. The interesting story is not that good trajectories enter the store. It is that bad, flaky, duplicate, and leaked trajectories are caught before they corrupt a training run or an evaluation claim.',
      
        {type: 'image', src: './assets/gifs/verified-agent-trajectory-store.gif', alt: 'Animated walkthrough of the verified agent trajectory store visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An AI agent does not produce a single answer. It produces a sequence of observations, decisions, tool calls, and corrections that unfold over minutes or hours inside a live environment. When that sequence ends with a working patch, the temptation is to save the patch and throw the rest away. But the patch alone cannot answer whether the fix was real, whether the environment was reproducible, whether the agent copied a leaked solution, or whether the same fix already exists five times in the training set.',
        'The problem sharpens when trajectories become training data. A model trained on unverified transcripts learns to imitate plausible-looking sequences, including ones that only worked because of a stale cache, a permissive test harness, or a dependency that has since changed. Evaluation suffers too: if related tasks leak across the train/eval split because the store has no way to group them, benchmark numbers measure memorization rather than capability.',
        {
          type: 'quote',
          text: 'If a trajectory cannot be replayed, it should not be trusted as training data.',
          attribution: 'Core invariant of verified trajectory stores',
        },
        'A verified agent trajectory store exists to keep agent work replayable, auditable, and splittable. It records the task, environment, every observation and action, the candidate patch, the oracle checks, dedupe keys, and a proof record that links them into an inclusion decision. The goal is not tidy storage. The goal is knowing exactly what claim each trajectory supports and being able to defend that claim later.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to save successful transcripts. Keep the prompt, the model messages, maybe the tool calls, the final patch, and a pass/fail flag from the test suite. For a demo or a one-off experiment, this works. A person can skim the run, see that the agent made progress, and move on.',
        {
          type: 'bullets',
          items: [
            'Log files store raw stdout and stderr. They help debug one run, but they do not preserve enough structure for replay, dedupe, or audit.',
            'Structured traces store typed events with IDs and timestamps. They support analytics and search, but replay is partial if the environment and oracle are missing.',
            'A verified store keeps events, environment, oracle, proof, and provenance together. It scales to training, evaluation, and audit because every inclusion decision has evidence.',
          ],
        },
        'Log files are the cheapest option and the first thing teams build. Structured traces add schema and searchability. But neither answers the questions that matter for data quality: Was the bug real? Did the environment match? Is this a duplicate? Can the result be reproduced? A verified store is the layer that makes those answers first-class records rather than after-the-fact guesses.',
        'The naive approach also collapses distinct identities into one transcript ID. Was it the same task? The same container? The same candidate patch? The same oracle? A single ID cannot answer those questions, so when one part goes stale -- the container image drifts, a test becomes flaky, a dependency updates -- the entire trajectory becomes suspect with no way to repair just the broken piece.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall hits when a training run or benchmark claim depends on data quality that the store cannot prove. A team trains a coding agent on 10,000 successful trajectories. Three months later, a reviewer asks: how many of those passed because the test was flaky? How many duplicated the same fix pattern? How many relied on an environment that no longer builds? The team cannot answer because the store only kept pass/fail flags and final patches.',
        'Here is the concrete failure sequence. An agent fixes a bug at commit abc123. The test passes. The trajectory enters the training set. Two weeks later, a dependency update means the same test now passes without any patch at all. The trajectory is no longer evidence of a real fix -- it is evidence that the test was fragile. But the store has no environment digest, no pre-patch failure proof, and no way to detect the problem. The label says "verified pass" when the ground truth is "accidental pass."',
        'The invariant that must hold: every trajectory in the store must link to a pinned environment, a pre-patch failure proof, a post-patch pass proof, and a provenance chain that can be rerun or invalidated. Without that link, the store is a transcript archive with a "verified" label bolted on top, and the label is a lie the moment any dependency moves.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {
          type: 'diagram',
          label: 'Trajectory capture, verification, and replay pipeline',
          text: [
            '  task + repo snapshot',
            '        |',
            '        v',
            '  +--------------+     +--------------+',
            '  | Build pinned | --> | Run agent in |',
            '  | environment  |     | pinned world |',
            '  | (image hash) |     | (append log) |',
            '  +--------------+     +--------------+',
            '                             |',
            '                    every observation,',
            '                    action, tool call',
            '                             |',
            '                             v',
            '                    +-----------------+',
            '                    | Candidate patch |',
            '                    | (diff + hash)   |',
            '                    +-----------------+',
            '                             |',
            '                             v',
            '                    +-----------------+     +------------------+',
            '                    | Oracle: pre-fail| --> | Proof record:    |',
            '                    | + post-pass +   |     | task + env +     |',
            '                    | hidden tests    |     | turns + oracle   |',
            '                    +-----------------+     | + dedupe key     |',
            '                                            +------------------+',
            '                                                     |',
            '                                            label, split, store',
            '                                                     |',
            '                                                     v',
            '                                              [replay anytime]',
          ].join('\n'),
        },
        {type: 'image', src: 'https://langsmith.langchain.ac.cn/assets/images/swebench_evaluation-4086f0af70875bc21fa5e2b9ce7044e0.png', alt: 'SWE-bench evaluation flow from candidate patch to validation tests', caption: 'SWE-bench style evaluation makes the oracle boundary concrete: candidate patch, runnable environment, and validation tests decide whether a trace is evidence. Source: LangSmith docs, SWE-bench evaluation guide.'},
        'The pipeline starts by pinning the world. A repository is snapshotted at a specific commit. An environment is built into a container image with a stable digest that records every dependency version, test command, resource limit, and network policy. The task -- an issue, a synthetic mutation, a benchmark item -- is recorded with its source and split family. Before the agent runs, the oracle proves the target test fails in the unpatched environment. This pre-patch failure is the baseline that makes later success meaningful.',
        'The agent then runs against the pinned world, and every step is appended to a structured event log. Each turn records an operation ID, parent ID, tool call, raw payload, observation, stdout, stderr, exit code, elapsed time, files read, files written, and redaction state. The parent ID matters because agent work is not a flat transcript -- the agent may branch into retries, fallback strategies, or diagnostic detours. The event log captures the full tree.',
        'When the agent produces a candidate patch, the oracle checks it. A strong oracle proves that the target test failed before the patch and passes after. It may also run hidden tests, lint, type checks, or human review, but each check is named separately. The store does not say "verified" when it only knows one visible test passed. The proof record then links task, environment, event log, candidate, and oracle result into a single inclusion decision with a provenance chain that can be rerun, invalidated, or audited.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is replayability. If the environment digest reconstructs the runnable world, the event IDs reconstruct the action sequence, the diff hash names the candidate, and the oracle ID names the checks, then the proof record can be inspected or rerun at any point in the future. Each key is independently addressable: a stale environment can be rebuilt and re-verified without discarding the event log, and a flaky oracle can be rerun without re-executing the agent.',
        'Replayability does not require bit-identical reproduction. Real systems have nondeterminism, flaky tests, and dependency drift. The point is that the store can identify what changed. If a dependency update breaks a former pass, the team marks the environment stale, rebuilds it, reruns the oracle, and writes a new proof record. The old proof record stays in the ledger as history, not as a silent corruption.',
        'The store also protects evaluation integrity. Held-out performance is meaningful only when related examples cannot leak across the split boundary. Splits may need to be assigned by repository, issue family, synthetic mutation source, patch fingerprint, or tool grammar. A verified store has enough separate keys to enforce those boundaries mechanically, rather than hoping that prompt text alone is sufficient to prevent contamination.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Storage cost comes from raw event logs, which can be 10-100x larger than final patches. Mitigation: tier hot proofs, warm events, and cold artifacts.',
            'Compute cost comes from building pinned environments and running oracles before and after patches. Mitigation: cache container layers and batch oracle runs.',
            'Ingestion latency comes from schema checks and proof links on every event. Mitigation: append quickly and compute derived labels later.',
            'Schema rigidity appears when the store assumes one shell, editor, or patch format. Mitigation: record concrete tool use plus an abstract operation layer.',
            'Compliance cost comes from source code, credentials, and proprietary data inside traces. Mitigation: redact, control access, and set retention policy.',
          ],
        },
        'The overhead is substantial. Containers and test artifacts are expensive to store. Ingestion is slower because every event needs a typed schema and every proof needs a verifiable link. Redaction, access control, and retention policy are mandatory because trajectories may capture credentials, proprietary code, or user content that cannot legally be retained.',
        'The schema can also become a trap. If the store only understands one shell, one editor, or one patch format, models trained on it overfit to that interface. A good store records concrete tool calls for replay fidelity while also extracting abstract operations -- read file, search text, edit hunk, run test, inspect failure -- for portability analysis. The concrete trace answers "what happened." The abstract trace answers "would this work with a different tool?"',
        'The tradeoff is worthwhile when examples are expensive or claims depend on them. A cheap store is faster until a benchmark result is questioned, a model learns a leaked pattern, an environment cannot be rebuilt, or a training run overweights duplicates. Then the missing evidence becomes the most expensive part of the system.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Coding-agent training is the primary use case. A team training on verified trajectories can answer concrete questions at any point: Did the bug fail before the patch? Did it pass after? Was the environment pinned? Is this sample duplicated? Which split family owns this task? Those answers let the team curate training data rather than hope it is clean.',
        'Regression testing for agents is a second major win. When a model checkpoint changes, the team can replay stored trajectories against the new model and compare behavior step by step. Trajectory-based debugging surfaces exactly where the new model diverges from the old one -- which observation it interpreted differently, which tool call it chose instead, which repair loop it skipped. This is more informative than aggregate pass rates.',
        'Research reproducibility improves because the store separates gains from execution grounding, retry budget, oracle strength, repository familiarity, language distribution, and tool-interface overfitting. Those become measurable columns in the dataset rather than speculation in a paper. Enterprise audit trails benefit from the same structure: if an agent made a harmful edit, the team can inspect what it observed, which permissions were active, which tests it trusted, and why the run was accepted.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The pattern is overkill for disposable demos, simple chat transcripts, or exploratory tasks where no training, evaluation, or audit claim will be made. It is also impossible when the organization cannot legally store enough detail to replay the work. Faking verification in that case is worse than storing a narrower claim with explicit limitations.',
        'The store fails when the oracle is weak. A perfect ledger around a bad verifier still produces bad labels. If the tests do not cover the bug, the proof record should say that only the named checks passed, not that the fix is verified. If the oracle is flaky, quarantine or repeated-run policy belongs in the record. Verification is a claim about evidence, not a feeling about plausibility.',
        {
          type: 'note',
          text: 'The most dangerous failure mode is overwriting raw events with derived labels. Summaries and reward scores are useful for browsing and training, but they are not a substitute for the original observations, actions, tool outputs, and oracle results. Once the raw evidence is gone, later audits can only debate summaries. An append-only storage discipline -- where derived artifacts reference raw events but never replace them -- prevents this.',
        },
        'Finally, deterministic replay has limits. Some agent actions depend on network responses, wall-clock time, or random seeds that were not captured. The store should record enough to detect when replay diverges, but promising bit-identical reproduction is a stronger claim than most systems can support. Honest replay means identifying what changed, not pretending nothing can.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The SWE-bench paper (Jimenez et al., 2024) defines the task format and oracle discipline that motivated verified trajectory stores: real GitHub issues, pinned repositories, execution-grounded evaluation with fail-to-pass test evidence. The OpenAI and Anthropic agent evaluation papers extend this to multi-step tool use with structured traces.',
        'For systems foundations, study distributed tracing (OpenTelemetry), write-ahead logs (database recovery), content-addressed storage (Git internals), and software supply-chain provenance (SLSA, in-toto). A verified trajectory store borrows from all of them: stable identity from content hashing, append-only evidence from WAL discipline, replayable execution from container pinning, and explicit proof boundaries from supply-chain attestation.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: agent trajectory dedupe and provenance hashing -- verification alone does not prevent duplicate families from leaking across splits.',
            'Extension: process reward models and verifier-guided search -- the trajectory store provides the labeled data these methods consume.',
            'Case study: abstract agent operation graphs -- extracting portable action sequences from concrete tool-specific traces.',
          ],
        },
      ],
    },
  ],
};
