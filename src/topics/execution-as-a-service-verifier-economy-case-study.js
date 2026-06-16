// Execution-as-a-service and the verifier economy: when model quality depends
// on runnable environments, clean oracles, and trajectory factories.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'execution-as-a-service-verifier-economy-case-study',
  title: 'Execution-as-a-Service Verifier Economy Case Study',
  category: 'Systems',
  summary: 'A production economics case study: why runnable environments, verifiers, proof ledgers, and clean trajectories become the scarce asset for agentic AI.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['value chain', 'factory economics'], defaultValue: 'value chain' },
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

function valueGraph(title) {
  return graphState({
    nodes: [
      { id: 'corpus', label: 'corpus', x: 0.7, y: 3.5, note: 'repos' },
      { id: 'env', label: 'envs', x: 2.2, y: 2.6, note: 'images' },
      { id: 'tasks', label: 'tasks', x: 2.2, y: 4.8, note: 'issues' },
      { id: 'rollout', label: 'rollouts', x: 4.2, y: 3.5, note: 'agents' },
      { id: 'oracle', label: 'oracles', x: 6.0, y: 2.6, note: 'tests' },
      { id: 'proof', label: 'ledger', x: 6.0, y: 4.8, note: 'why' },
      { id: 'dataset', label: 'data', x: 7.6, y: 3.5, note: 'traj API' },
      { id: 'model', label: 'model', x: 9.5, y: 3.5, note: 'learn' },
    ],
    edges: [
      { id: 'e-corpus-env', from: 'corpus', to: 'env' },
      { id: 'e-corpus-tasks', from: 'corpus', to: 'tasks' },
      { id: 'e-env-rollout', from: 'env', to: 'rollout' },
      { id: 'e-tasks-rollout', from: 'tasks', to: 'rollout' },
      { id: 'e-rollout-oracle', from: 'rollout', to: 'oracle' },
      { id: 'e-rollout-proof', from: 'rollout', to: 'proof' },
      { id: 'e-oracle-dataset', from: 'oracle', to: 'dataset' },
      { id: 'e-proof-dataset', from: 'proof', to: 'dataset' },
      { id: 'e-dataset-model', from: 'dataset', to: 'model' },
    ],
  }, { title });
}

function* valueChain() {
  yield {
    state: valueGraph('Verifier economy value chain'),
    highlight: { active: ['corpus', 'env', 'tasks', 'rollout', 'oracle', 'proof', 'dataset', 'e-corpus-env', 'e-env-rollout', 'e-rollout-oracle', 'e-oracle-dataset', 'e-proof-dataset'], compare: ['model'] },
    explanation: 'When models can be copied, the scarce asset moves upstream: runnable environments, task streams, oracles, proof ledgers, and clean trajectories.',
    invariant: 'Verified execution data is infrastructure, not exhaust.',
  };

  yield {
    state: valueGraph('The oracle and proof ledger are the choke points'),
    highlight: { active: ['oracle', 'proof', 'dataset', 'e-rollout-oracle', 'e-rollout-proof', 'e-oracle-dataset', 'e-proof-dataset'], found: ['model'] },
    explanation: 'A rollout becomes valuable only when the system can prove what happened and why it should count. The verifier is the gate; the proof ledger makes the gate auditable.',
  };

  yield {
    state: labelMatrix(
      'Who owns which asset',
      [
        { id: 'git', label: 'git host' },
        { id: 'ide', label: 'IDE' },
        { id: 'cloud', label: 'cloud CI' },
        { id: 'startup', label: 'startup' },
        { id: 'domain', label: 'domain lab' },
      ],
      [
        { id: 'asset', label: 'asset' },
        { id: 'advantage', label: 'edge' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['PR+CI', 'natural traces', 'privacy'],
        ['edits+errors', 'developer loop', 'local only'],
        ['runners', 'scale', 'lock-in'],
        ['niche oracle', 'vertical depth', 'capex'],
        ['simulator', 'truth source', 'narrow market'],
      ],
    ),
    highlight: { found: ['git:advantage', 'cloud:advantage', 'domain:advantage'], compare: ['startup:risk'] },
    explanation: 'Different players own different parts of the factory. The winner is often the team that can verify cheaply, not the team with the prettiest chat UI.',
  };
}

function* factoryEconomics() {
  yield {
    state: plotState({
      axes: { x: { label: 'verified trajectory volume', min: 0, max: 100 }, y: { label: 'cost per clean example, relative', min: 0, max: 110 } },
      series: [
        { id: 'manual', label: 'manual verification', points: [{ x: 5, y: 90 }, { x: 20, y: 86 }, { x: 50, y: 82 }, { x: 100, y: 80 }] },
        { id: 'factory', label: 'automated factory', points: [{ x: 5, y: 105 }, { x: 20, y: 70 }, { x: 50, y: 38 }, { x: 100, y: 22 }] },
      ],
      markers: [
        { id: 'capex', x: 8, y: 100, label: 'fixed cost' },
        { id: 'scale', x: 75, y: 30, label: 'amortized' },
      ],
    }),
    highlight: { active: ['factory', 'capex', 'scale'], compare: ['manual'] },
    explanation: 'A verifier factory has high fixed cost and lower marginal cost at scale. That is why execution data can consolidate around platforms with existing environments and telemetry.',
  };

  yield {
    state: labelMatrix(
      'Factory operating ledger',
      [
        { id: 'input', label: 'input' },
        { id: 'run', label: 'run' },
        { id: 'verify', label: 'verify' },
        { id: 'dedupe', label: 'dedupe' },
        { id: 'ship', label: 'ship' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['task mix', 'biased corpus'],
        ['container min', 'infra burn'],
        ['pass proof', 'false label'],
        ['novel rate', 'duplicates'],
        ['license+PII', 'data risk'],
      ],
    ),
    highlight: { active: ['run:metric', 'verify:metric', 'dedupe:metric', 'ship:metric'], compare: ['verify:failure'] },
    explanation: 'The factory is operated with ledgers: task mix, run cost, verification quality, duplicate rate, licenses, privacy, and release eligibility.',
  };

  yield {
    state: labelMatrix(
      'Vertical verifier examples',
      [
        { id: 'code', label: 'code' },
        { id: 'finance', label: 'finance' },
        { id: 'bio', label: 'bio' },
        { id: 'legal', label: 'legal' },
        { id: 'robot', label: 'robotics' },
      ],
      [
        { id: 'executor', label: 'executor' },
        { id: 'oracle', label: 'oracle' },
      ],
      [
        ['repo+tests', 'patch pass'],
        ['backtest', 'leak-free pnl'],
        ['sim+assay', 'valid protocol'],
        ['rules+docs', 'review gate'],
        ['sim+device', 'task success'],
      ],
    ),
    highlight: { found: ['code:oracle', 'finance:oracle', 'bio:oracle', 'legal:oracle', 'robot:oracle'] },
    explanation: 'Execution-as-a-service fragments by domain because each domain needs a different executor and oracle. The common data structure is state, action, result, proof.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'value chain') yield* valueChain();
  else if (view === 'factory economics') yield* factoryEconomics();
  else throw new InputError('Pick an execution-as-a-service view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Execution-as-a-service is the infrastructure layer that runs tasks, verifies outcomes, and sells or uses clean trajectories. In the verifier economy, value concentrates in environments, oracles, proof ledgers, and trusted data pipelines rather than only in model weights.',
        'This is the economic implication of Code World Models Case Study and Verified Agent Trajectory Store. If better agents require verified execution data, the factory that produces that data becomes a strategic asset.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The factory starts with a corpus: repositories, issues, tests, simulator scenarios, contracts, market histories, or device tasks. It snapshots environments, generates candidate rollouts, runs oracles, stores proof records, filters duplicates, redacts sensitive data, and releases trajectories through a dataset, API, or internal training loop.',
        'The core data structures are familiar: a task queue, environment registry, execution log, oracle result table, proof ledger, dedupe index, license and privacy registry, and release gate. The new part is that these structures become part of the AI product, not just internal operations.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The fixed cost is high. Runners, containers, simulators, validators, human review, storage, and security all have to exist before the first clean example appears. The marginal cost can fall if the same infrastructure verifies many trajectories. That creates platform economics: git hosts, IDEs, clouds, and domain labs already own pieces of the execution loop.',
        'The governance cost is just as important. Verified trajectories may contain private code, personal data, secrets, licenses, or proprietary workflows. A production factory needs redaction, authorization, retention policy, customer isolation, opt-out rules, and auditability.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A coding platform adds execution-as-a-service to its CI product. It sees issues, pull requests, failing tests, accepted patches, review comments, and reruns. It snapshots environments, asks agents to produce candidate repairs, verifies failing-to-passing behavior, deduplicates near-identical fixes, and stores a proof ledger. The platform can then train models, evaluate agents, or sell clean task rollouts to customers who want private fine-tuning.',
        'A startup without that platform access must buy or build the same factory: collect tasks, run containers, verify patches, maintain environments, handle privacy, and refresh stale examples. That is why the CWM notes frame verification as the bottleneck and why Agent Harness Portability Audit matters: a factory that only works in one harness has limited resale value.',
      ],
    },
    {
      heading: 'Pitfalls and sources',
      paragraphs: [
        'Do not confuse execution telemetry with rights to train. Do not treat passing tests as universal truth. Do not sell trajectories without provenance and privacy controls. Do not ignore benchmark staleness: once a benchmark becomes a training target, it can stop measuring frontier capability cleanly.',
        'Primary sources: CWM at https://arxiv.org/abs/2510.02387 and https://ai.meta.com/research/publications/cwm-an-open-weights-llm-for-research-on-code-generation-with-world-models/, SWE-bench at https://arxiv.org/abs/2310.06770, SWE-agent at https://arxiv.org/abs/2405.15793, SWE-bench Verified at https://www.swebench.com/verified.html, OpenAI SWE-bench Verified analysis at https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/, and AlphaEvolve at https://arxiv.org/abs/2506.13131. Study Verified Agent Trajectory Store, Abstract Agent Operation Graph, Agent Harness Portability Audit, Process Reward Models & Verifier Search, AlphaEvolve Case Study, Software Supply Chain Provenance Graph, and Temporal Workflow Case Study next.',
      ],
    },
  ],
};
