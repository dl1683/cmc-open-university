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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the pipeline as a factory for verified episodes. An episode is one task attempt with starting state, actions, final state, and proof. The active node is accepted only after the oracle records why the result should be trusted.',
        'The value chain separates raw transcript from reusable data. A transcript says what an agent appeared to do, while a verified episode says what ran and what passed. The safe inference rule is that only episodes with replayable state and an oracle verdict can become high-trust training or evaluation data.',
        {type:'callout', text:'The scarce asset is not the agent transcript but the verified execution episode: state, action, result, and proof under a replayable oracle.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Agent transcripts are easy to collect and hard to trust. They can show fluent reasoning, tool calls, and final answers without proving that the tool calls ran or that the result survived a real verifier. For code, the verifier may be tests and review; for robotics, it may be simulator success plus telemetry.',
        'Execution-as-a-service is the infrastructure that turns tasks into runnable episodes. It owns environments, sandboxes, tools, limits, secrets policy, oracles, proof records, and release gates. The verifier economy forms because clean execution data can become scarcer than model weights.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to train on chat logs, terminal logs, human demonstrations, or agent traces. That captures behavior but not trust. The reader still has to ask whether the repository state was real, whether the tests were meaningful, and whether the trace can be replayed.',
        'A plain pass/fail benchmark label loses the opposite information. It says whether an endpoint accepted the result, but it discards the path that made the result safe. Agent learning often needs both the final verdict and the inspected states that led there.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Verification is expensive before it becomes useful. A serious factory needs runners, containers, simulators, data snapshots, dependency caches, validators, human escalation, storage, audit logs, and privacy controls. A cheap trace without an oracle is just telemetry.',
        'Governance is part of the wall. Execution traces can contain private code, credentials, customer data, proprietary workflows, licensed text, or sensitive failures. A verifier factory that cannot redact, authorize, retain, and prove data rights cannot safely publish its own product.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The stable record is state, action, result, and proof. State names the task, environment, inputs, and permissions. Action records tool calls, edits, decisions, and timing. Result records what changed, and proof records why the change is accepted.',
        'The executor and oracle change by domain, but the record shape stays useful. A coding oracle may run tests, a finance oracle may run a leak-free backtest, and a lab oracle may run a simulator. In each case, acceptance is separated from generation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The factory collects tasks, snapshots environments, runs candidate agents, captures state transitions, scores outcomes with an oracle, attaches proof, deduplicates similar episodes, applies governance, and publishes eligible records. Each stage has a ledger because later users need to know why the example counts. The ledger is not optional metadata; it is the chain of custody.',
        'A release gate turns internal execution into reusable data. It can require hidden tests, clean replay, static analysis, human review, license checks, privacy redaction, and split-deduplication. Different products can use different gates while sharing the same raw execution substrate.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because generation and acceptance are different jobs. Agents can produce many attempts, but only attempts with a reproducible environment and credible oracle enter the training or evaluation set. That prevents fluent wrong behavior from being treated as expertise.',
        'It also works economically after the fixed cost is paid. Once a domain has reusable runners, validators, data snapshots, and governance rails, the marginal cost of another verified episode can fall. Platforms near real task streams have an advantage because they already see failures, fixes, and execution evidence.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost behaves like a factory. If building the first domain costs 12 engineer-weeks and each verified episode costs 20 minutes of compute and review, the early examples are expensive. At 50,000 episodes, the fixed cost is diluted, and the main cost becomes runner utilization, oracle strength, and release risk.',
        'Oracle strength is the central tradeoff. Visible unit tests scale cheaply but miss hidden behavior. Human review catches more context but is slow and inconsistent. Strong gates cost more, but weak gates can train models to exploit blind spots.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Coding-agent platforms can snapshot repositories, run repairs, store diffs, collect logs, and keep accepted proofs. Robotics labs can use simulators and hardware telemetry to decide which trajectories are real. Finance systems can preserve data snapshots and backtest rules so a strategy result is not just a chart.',
        'Enterprise products can use private verifier loops without exporting source code or customer records. The customer gets a local execution service and proof ledger, while the vendor gets aggregate product metrics or no data at all. That boundary matters when the verifier is valuable but the raw execution is sensitive.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when passing the oracle is mistaken for solving the domain. A patch can pass visible tests while breaking hidden behavior, a robot can exploit simulator quirks, and a backtest can leak future information. The proof ledger must record what was actually proven.',
        'It also fails through rights and freshness. A trajectory may be correct but not trainable because of license, consent, privacy, or customer-boundary constraints. A task may be replayable today and unreplayable next month if dependencies or data access disappear.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a coding platform starts with 100,000 issue attempts. The verifier reruns each attempt in a pinned environment, rejects 55,000 for failing tests, rejects 10,000 for missing proof, and rejects 5,000 for privacy or license risk. The remaining 30,000 episodes have state, action, result, and proof records.',
        'If each accepted episode costs 25 minutes of runner time and review, the accepted set costs 12,500 hours before infrastructure reuse. A better cache, stronger dedupe, and batch validation reduce cost per accepted episode. The economic asset is not the transcript count; it is the accepted proof count per dollar.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study SWE-bench, SWE-agent, SWE-bench Verified, Code World Models, process reward models, AlphaEvolve, sandboxed execution, and software supply-chain provenance. Then study Verified Agent Trajectory Store, Abstract Agent Operation Graph, Agent Portability Audit, Process Reward Models and Verifier Search, Software Supply Chain Provenance Graph, and Temporal Workflow Case Study.',
        'The next exercise is to define an oracle for one domain. Name the starting state, allowed actions, acceptance proof, replay method, privacy rule, and release gate. If any field is missing, the episode is not yet a durable data product.',
      ],
    },
  ],
};