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
    explanation: `The ${oracleNode} should prove the bug existed before the patch and is resolved after the patch. The verification path (${verifyStages.join(' ? ')}) uses isolated containers, failing-to-passing tests, hidden tests, and strict patch application; otherwise the store only knows that a patch looked plausible.`,
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
        'The trace-schema view follows one agent run from task intake to training-set inclusion. Active stages are currently being checked, found stages have passed an oracle, and compared stages show the shrinking gap between raw rollouts and verified examples.',
        {
          type: 'callout',
          text: 'A verified trajectory store treats an agent run as evidence only when the task, environment, actions, patch, and oracle can be replayed together.',
        },
        'A trajectory is the ordered record of observations, tool calls, edits, test runs, and decisions made by an agent. The safe inference is that a run is evidence only if the environment and oracle can reproduce the claim the label makes.',
        'The verifier-factory view shows the production boundary. Raw logs enter wide, then schema checks, environment pinning, oracle results, dedupe keys, and split rules narrow them into examples that can safely train or evaluate a model.',
      
        {type: 'image', src: './assets/gifs/verified-agent-trajectory-store.gif', alt: 'Animated walkthrough of the verified agent trajectory store visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An agent run is not just a final answer. For coding agents, the evidence includes the repository snapshot, the commands run, the files read, the patch produced, and the tests that decided whether the patch worked.',
        'A verified store exists because training and evaluation claims collapse when those pieces are separated. A transcript that cannot be replayed may teach a model to imitate lucky behavior, leaked solutions, or test artifacts rather than genuine problem solving.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to save the prompt, chat transcript, final patch, and pass/fail flag. That is enough for a demo where a human can remember the setup and inspect the result.',
        'A slightly better approach is structured logging with timestamps and tool-call records. It improves search and debugging, but it still does not prove that the environment was pinned or that the oracle actually tested the claimed behavior.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when the data becomes a training corpus or benchmark. A reviewer can ask how many examples passed because of flaky tests, duplicated patches, stale dependencies, or train/eval leakage, and a simple log archive cannot answer.',
        'The concrete failure is an accidental pass. If a dependency update makes a test pass without the patch, then a stored pass flag no longer proves the agent fixed anything unless the store also kept a pre-patch failure proof and environment digest.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is provenance as a first-class data model. The store links task identity, repo snapshot, environment digest, event log, candidate artifact, oracle result, dedupe key, and split family into one proof record.',
        'That proof record is narrower than truth. It does not say the patch is perfect; it says exactly which environment and oracle accepted it, and what evidence would need to be rerun if a dependency, test, or split rule changes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Ingestion starts by pinning the world. The repository commit, container image digest, dependency lockfiles, test command, resource limits, and network policy are recorded before the agent runs.',
        'The agent event stream is append-only. Each observation, tool call, edit, command result, and model message receives an operation id and parent id so retries and branches can be reconstructed.',
        {type: 'image', src: 'https://langsmith.langchain.ac.cn/assets/images/swebench_evaluation-4086f0af70875bc21fa5e2b9ce7044e0.png', alt: 'SWE-bench evaluation flow from candidate patch to validation tests', caption: 'SWE-bench style evaluation makes the oracle boundary concrete: candidate patch, runnable environment, and validation tests decide whether a trace is evidence. Source: LangSmith docs, SWE-bench evaluation guide.'},
        'The oracle then checks the candidate. A strong coding oracle proves that the target fails before the patch and passes after it, then records any hidden tests, lint, type checks, or human review as separate named claims.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is replayability with scoped claims. If the environment digest rebuilds the world, the event ids reconstruct the action sequence, and the oracle id names the check, the stored label can be audited or invalidated later.',
        'The store also protects evaluation splits. Because tasks, repositories, patches, issue families, and dedupe fingerprints are separate keys, related examples can be kept out of held-out sets mechanically instead of by hope.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is large because raw trajectories are much bigger than final answers. A 20 KB patch may come from a 5 MB event log plus a multi-GB container layer and cached test artifacts.',
        'Compute cost also grows. Pre-patch checks, post-patch checks, hidden tests, dedupe, schema validation, redaction, and replay all add latency, but they buy evidence that a plain transcript cannot recover later.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The main use is coding-agent training. A model can learn from successful repair trajectories only when the store can distinguish real fixes from flaky passes and duplicated examples.',
        'The same structure supports benchmark audits, regression testing across model versions, enterprise incident review, and dataset release. It lets teams answer what the agent saw, what it changed, which checks passed, and which claim the run actually supports.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The pattern is overkill for disposable demos and private experiments that will not train a model or support a claim. If the organization cannot legally store enough detail for replay, it should state a narrower claim rather than fake verification.',
        'The store also fails when the oracle is weak. A perfect ledger around a bad test suite only proves that the bad suite passed, so oracle scope must be explicit in the proof record.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose 10,000 raw coding-agent rollouts are collected for a Python bug benchmark. Schema validation drops 800 malformed traces, environment rebuild drops 700, pre-patch failure checks drop 900, post-patch tests drop 3,500, and dedupe drops 1,100.',
        'The final verified set has 3,000 trajectories, or 30 percent of the raw rollouts. If storage averages 4 MB per raw trace and 1.5 GB per reusable environment family across 40 families, the event logs cost about 40 GB and environment artifacts cost about 60 GB before compression.',
        'The numbers explain the behavior. A cheap transcript store would keep all 10,000 and call them successes; the verified store spends compute and storage to avoid training on 7,000 examples whose evidence was incomplete, stale, duplicate, or false.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study SWE-bench for the benchmark pattern of candidate patch plus runnable environment plus validation tests, LangSmith and OpenTelemetry for trace schemas, W3C PROV for provenance vocabulary, and content-addressed storage systems for artifact identity. These sources cover the verification boundary, trace shape, and immutable artifact link.',
        'Next study dataset deduplication, benchmark leakage, reproducible builds, container image digests, append-only logs, Merkle DAGs, and model evaluation design. The key distinction is that a trajectory store is not a chat archive; it is evidence infrastructure.',
      ],
    },
  ],
};
