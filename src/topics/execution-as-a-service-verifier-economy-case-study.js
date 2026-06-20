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
      heading: 'The problem',
      paragraphs: [
        'A transcript is weak training material for an agent. It can show what the model said, but it may not prove that the action ran, changed the right state, preserved constraints, or would work again tomorrow. For code, that proof may be tests and a patch. For robotics, it may be simulator success plus device telemetry. For finance, it may be a leak-free backtest. The scarce object is not the conversation; it is a reproducible execution with a trusted verdict.',
        'Execution-as-a-service is the infrastructure layer that turns tasks into runnable episodes. It owns environments, sandboxes, tools, time limits, secrets policy, verification oracles, proof records, and release gates. The verifier economy is the market that forms around that layer when models become easier to copy than clean execution data.',
        {type:'callout', text:'The scarce asset is not the agent transcript but the verified execution episode: state, action, result, and proof under a replayable oracle.'},
      ],
    },
    {
      heading: 'Why transcripts are not enough',
      paragraphs: [
        'The obvious approach is to gather human demonstrations, chat logs, terminal logs, or agent traces and train on them. That captures surface behavior, but it does not answer the hard questions: was the repository state real, were the tests meaningful, did the tool calls execute, did the fix generalize beyond the visible test, and can the trace be replayed under the same conditions?',
        'A plain benchmark label has the opposite problem. Pass/fail tells you whether an endpoint accepted the result, but it discards the path. For agents, the path matters: which files were inspected, which wrong turns were avoided, which commands produced evidence, and which intermediate states made the final action safe.',
      ],
    },
    {
      heading: 'The production wall',
      paragraphs: [
        'Verification is expensive before it is useful. The factory needs runners, containers, simulators, data snapshots, dependency caches, network controls, validators, human review paths, storage, and audit logs before the first clean example can ship. A cheap trace with no oracle is just telemetry. A verified trajectory is manufactured evidence.',
        'Governance is part of the wall, not paperwork after the fact. Execution traces can contain private code, credentials, customer data, proprietary workflows, licensed text, and sensitive failures. A verifier factory without redaction, authorization, retention rules, consent boundaries, and lineage records cannot become a durable data product.',
      ],
    },
    {
      heading: 'Core insight and mechanism',
      paragraphs: [
        'The factory can be described as a pipeline: collect tasks, snapshot the environment, run candidate agents, capture every state transition, score the outcome with an oracle, attach proof, deduplicate near-identical traces, apply governance, and publish only eligible trajectories. Each stage has a ledger because later users need to know why an example counts.',
        'The common record is state, action, result, proof. State names the environment and task context. Action records tool calls, edits, decisions, and timing. Result records what changed. Proof records why the result should be trusted. The domain changes the executor and oracle; the shape of the record stays stable.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine a coding platform that sees issues, pull requests, failing tests, accepted patches, review comments, and reruns. It can snapshot a repository, ask several agents to repair the failure, run the test suite, reject patches that only satisfy a brittle visible test, and store a proof packet containing the diff, commands, logs, timing, dependency lockfiles, and reviewer outcome.',
        'That platform can use the same factory three ways. It can train on successful trajectories, evaluate new agents against private tasks, or sell an enterprise customer a private verifier loop that never exports source code. A startup without platform access must recreate task collection, environment replay, verification, privacy review, dedupe, and data release from scratch.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the value-chain view, follow the flow from corpus to environment and task, then through rollout, oracle, proof ledger, dataset, and model. The important handoff is not from data to model; it is from untrusted execution to verified execution. The oracle and proof ledger are the narrow waist because they decide what can enter the training or evaluation supply.',
        'In the factory-economics view, compare the cost curves. Manual verification starts lower but stays expensive because every example needs attention. An automated factory starts with high fixed cost, then gets cheaper when runners, sandboxes, dedupe indexes, and governance checks are reused across many episodes. The operating ledger frames the real bottlenecks: task mix, run cost, pass-proof quality, novelty rate, and release risk.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because the factory separates generation from acceptance. Agents may produce many attempts, but only attempts with a reproducible environment and a credible oracle become training or evaluation data. That prevents fluent-but-wrong behavior from being treated as expertise.',
        'It also works economically. Once a domain has stable executors, common task templates, reusable validators, and governance rails, the marginal cost of another verified trajectory can fall. That is why git hosts, IDE vendors, cloud CI systems, benchmark operators, and domain labs have structural advantages: they already sit near task streams and execution evidence.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'The tradeoff is control versus openness. A tight factory can produce high-trust data, but it may be expensive, private, and hard for outsiders to audit. A public benchmark is easier to compare, but it can be saturated, leaked, overfit, or too narrow for production behavior.',
        'The second tradeoff is oracle strength. Unit tests, simulators, static analyzers, backtests, and human review all catch different errors. Stronger oracles cost more and may slow data volume. Weaker oracles scale faster but can turn systematic blind spots into training signal.',
      ],
    },
    {
      heading: 'Operating checklist',
      paragraphs: [
        'A serious verifier factory needs versioned environments, pinned dependencies, task provenance, runner isolation, secret boundaries, timeout policy, artifact storage, oracle versioning, and reviewer escalation. Each accepted episode should be explainable months later: what was the starting state, what actions ran, what changed, what checked it, and what rights allow reuse.',
        'The release gate should separate evidence classes. A trajectory that passed visible tests is not the same as one that passed hidden tests, human review, static analysis, and replay on a clean machine. Training data, evaluation data, and customer-visible proof packets may need different thresholds even when they come from the same execution run.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'The factory fails when passing the oracle is mistaken for solving the domain. A patch can pass visible tests while breaking hidden behavior. A finance strategy can pass a backtest by leaking future information. A robot policy can succeed in a simulator by exploiting simulator quirks. The proof ledger must record what was actually proven, not what the operator wishes had been proven.',
        'It also fails through data rights and freshness. A trajectory may be correct but not trainable because of license, privacy, consent, or customer-boundary constraints. A task may be valuable today and unreplayable next month because dependencies changed. A factory without environment pinning, retention policy, and source authority loses its own evidence.',
      ],
    },
    {
      heading: 'Practical use',
      paragraphs: [
        'Use this mental model when evaluating agent products, benchmarks, and data businesses. Ask what the task source is, how environments are replayed, what the oracle proves, how proof is stored, how duplicates are filtered, and which governance gate allows release. If any link is missing, the claimed dataset is weaker than it sounds.',
        'For builders, start with one domain where execution is real and verification is cheap enough to repeat. Build the task queue, environment registry, oracle result table, proof ledger, dedupe index, privacy and license registry, and release gate as first-class product systems. The verifier is not an internal script; it is the asset.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: CWM at https://arxiv.org/abs/2510.02387 and https://ai.meta.com/research/publications/cwm-an-open-weights-llm-for-research-on-code-generation-with-world-models/, SWE-bench at https://arxiv.org/abs/2310.06770, SWE-agent at https://arxiv.org/abs/2405.15793, SWE-bench Verified at https://www.swebench.com/verified.html, OpenAI SWE-bench Verified analysis at https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/, and AlphaEvolve at https://arxiv.org/abs/2506.13131.',
        'Study Verified Agent Trajectory Store, Abstract Agent Operation Graph, Agent Portability Audit, Process Reward Models & Verifier Search, AlphaEvolve Case Study, Software Supply Chain Provenance Graph, and Temporal Workflow Case Study next.',
      ],
    },
  ],
};
