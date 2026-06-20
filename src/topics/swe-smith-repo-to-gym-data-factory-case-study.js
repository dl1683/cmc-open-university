// SWE-smith as a repo-to-gym data factory: turn repositories into executable
// training environments with generated tasks, trajectories, and proof ledgers.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'swe-smith-repo-to-gym-data-factory-case-study',
  title: 'SWE-smith Repo-to-Gym Data Factory Case Study',
  category: 'Papers',
  summary: 'SWE-smith as a data factory: convert repositories into executable gyms, synthesize repair tasks, verify trajectories, and train coding agents at scale.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['repo to gym pipeline', 'task promotion ledger'], defaultValue: 'repo to gym pipeline' },
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

function factoryGraph(title) {
  return graphState({
    nodes: [
      { id: 'repo', label: 'repo', x: 0.6, y: 3.3, note: 'source' },
      { id: 'env', label: 'env', x: 2.1, y: 2.0, note: 'image' },
      { id: 'tests', label: 'tests', x: 2.1, y: 4.8, note: 'oracle' },
      { id: 'gym', label: 'gym', x: 3.8, y: 3.3, note: 'API' },
      { id: 'gen', label: 'gen tasks', x: 5.3, y: 2.0, note: 'mutate' },
      { id: 'agent', label: 'agent', x: 5.3, y: 4.8, note: 'rollout' },
      { id: 'verify', label: 'verify', x: 7.0, y: 3.3, note: 'proof' },
      { id: 'data', label: 'data', x: 8.6, y: 2.0, note: 'train' },
      { id: 'eval', label: 'eval', x: 8.6, y: 4.8, note: 'holdout' },
    ],
    edges: [
      { id: 'e-repo-env', from: 'repo', to: 'env' },
      { id: 'e-repo-tests', from: 'repo', to: 'tests' },
      { id: 'e-env-gym', from: 'env', to: 'gym' },
      { id: 'e-tests-gym', from: 'tests', to: 'gym' },
      { id: 'e-gym-gen', from: 'gym', to: 'gen' },
      { id: 'e-gym-agent', from: 'gym', to: 'agent' },
      { id: 'e-gen-verify', from: 'gen', to: 'verify' },
      { id: 'e-agent-verify', from: 'agent', to: 'verify' },
      { id: 'e-verify-data', from: 'verify', to: 'data' },
      { id: 'e-verify-eval', from: 'verify', to: 'eval' },
    ],
  }, { title });
}

function* repoToGymPipeline() {
  yield {
    state: factoryGraph('SWE-smith-style repo to gym pipeline'),
    highlight: { active: ['repo', 'env', 'tests', 'gym', 'e-repo-env', 'e-repo-tests', 'e-env-gym', 'e-tests-gym'], found: ['gen', 'agent'] },
    explanation: 'A repo-to-gym factory turns a raw GitHub repository into an executable environment with reset, run, test, mutate, and score operations. That gym can generate tasks and collect trajectories.',
    invariant: 'Training data starts with a runnable repository, not a prompt.',
  };

  yield {
    state: labelMatrix(
      'Repository readiness gates',
      [
        { id: 'build', label: 'build' },
        { id: 'test', label: 'test' },
        { id: 'cov', label: 'cov' },
        { id: 'size', label: 'size' },
        { id: 'lic', label: 'lic' },
        { id: 'sec', label: 'sec' },
      ],
      [
        { id: 'gate', label: 'gate' },
        { id: 'why', label: 'why' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['image', 'replay', 'drop'],
        ['pass', 'oracle', 'repair'],
        ['enough', 'visible', 'weak'],
        ['fit', 'cost', 'shard'],
        ['ok', 'rights', 'block'],
        ['clean', 'privacy', 'redact'],
      ],
    ),
    highlight: { active: ['build:gate', 'test:gate', 'cov:gate', 'lic:gate', 'sec:gate'], found: ['test:why'], compare: ['size:fail'] },
    explanation: 'Not every repository should become a gym. The factory needs buildability, passing baseline tests, enough oracle coverage, manageable cost, license clarity, and privacy filtering.',
  };

  yield {
    state: factoryGraph('Generate tasks, then roll out agents'),
    highlight: { active: ['gym', 'gen', 'agent', 'verify', 'e-gym-gen', 'e-gym-agent', 'e-gen-verify', 'e-agent-verify'], found: ['data'] },
    explanation: 'The same executable gym supports task generation and agent rollouts. Generated tasks are only useful if the verifier can prove the induced failure and the later repair.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'factory stage', min: 0, max: 6 }, y: { label: 'candidate count, normalized', min: 0, max: 100 } },
      series: [
        { id: 'tasks', label: 'tasks remaining', points: [{ x: 0, y: 100 }, { x: 1, y: 78 }, { x: 2, y: 61 }, { x: 3, y: 47 }, { x: 4, y: 35 }, { x: 5, y: 31 }] },
      ],
      markers: [
        { id: 'repo', x: 1, y: 78, label: 'repo gate' },
        { id: 'oracle', x: 3, y: 47, label: 'oracle' },
        { id: 'dedupe', x: 5, y: 31, label: 'dedupe' },
      ],
    }),
    highlight: { active: ['tasks', 'repo', 'oracle', 'dedupe'] },
    explanation: 'A healthy factory discards many candidates. Repository gates, oracle gates, flaky reruns, privacy filters, and dedupe all shrink the raw candidate pool before training.',
  };
}

function* taskPromotionLedger() {
  yield {
    state: factoryGraph('Promotion ledger from gym to training data'),
    highlight: { active: ['gen', 'agent', 'verify', 'data', 'eval', 'e-gen-verify', 'e-agent-verify', 'e-verify-data', 'e-verify-eval'], compare: ['repo', 'gym'] },
    explanation: 'Promotion is the boundary between generated activity and trusted data. The ledger decides whether a task enters training, evaluation, quarantine, or rejection.',
  };

  yield {
    state: labelMatrix(
      'Promotion labels',
      [
        { id: 'pos', label: 'pos' },
        { id: 'neg', label: 'neg' },
        { id: 'part', label: 'part' },
        { id: 'bad', label: 'bad' },
        { id: 'hold', label: 'hold' },
      ],
      [
        { id: 'proof', label: 'proof' },
        { id: 'use', label: 'use' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['pass fix', 'SFT/RL', 'leak'],
        ['fail trace', 'critic', 'noise'],
        ['some tests', 'PRM', 'label'],
        ['flaky', 'drop', 'rot'],
        ['clean', 'eval', 'tune'],
      ],
    ),
    highlight: { active: ['pos:use', 'neg:use', 'part:use', 'hold:use'], found: ['bad:risk'], compare: ['pos:risk'] },
    explanation: 'The factory should not keep only successes. Verified failures and partial repairs can train critics and process reward models, while clean holdouts are reserved for evaluation.',
  };

  yield {
    state: labelMatrix(
      'Complete case: repo gym task',
      [
        { id: 'a', label: 'repo' },
        { id: 'b', label: 'gym' },
        { id: 'c', label: 'bug' },
        { id: 'd', label: 'roll' },
        { id: 'e', label: 'prom' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['passes', 'image'],
        ['reset', 'API'],
        ['fails', 'test'],
        ['patch', 'trace'],
        ['train', 'ledger'],
      ],
    ),
    highlight: { active: ['a:proof', 'b:proof', 'c:proof', 'd:proof', 'e:proof'], found: ['e:state'], removed: ['c:state'] },
    explanation: 'A repository passes its baseline tests. The gym creates a bug task that fails one test. An agent repairs it, the verifier passes, and the promotion ledger assigns the trajectory to training or holdout.',
  };

  yield {
    state: factoryGraph('Dedupe and split before claims'),
    highlight: { active: ['repo', 'gen', 'verify', 'data', 'eval', 'e-verify-data', 'e-verify-eval'], found: ['tests'], compare: ['agent'] },
    explanation: 'Before reporting gains, the factory must split by repository, mutation family, task family, and proof family. Otherwise a model can appear to improve by seeing near-duplicates of the eval tasks.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'repo to gym pipeline') yield* repoToGymPipeline();
  else if (view === 'task promotion ledger') yield* taskPromotionLedger();
  else throw new InputError('Pick a SWE-smith data-factory view.');
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        'Coding agents do not become useful from static prompt-answer pairs alone. Real software work happens inside repositories with dependencies, build scripts, failing tests, hidden assumptions, style conventions, and years of accumulated design choices. A repo-to-gym factory exists because the training unit has to move closer to that real working environment.',
        'SWE-smith is useful to study as a data factory, not just as a benchmark generator. It starts from repositories, wraps them as executable gyms, creates repair tasks, runs agents, verifies outcomes, and promotes only the artifacts that can be replayed and trusted. The output is not merely more examples. It is examples with environment state, proof, provenance, rejection reasons, and split discipline.',
        {type:'callout', text:'A repo-to-gym factory promotes coding-agent data only when each task carries replayable environment, proof, provenance, and split evidence.'},
      ],
    },
    {
      heading: 'The Baseline Wall',
      paragraphs: [
        'The obvious baseline is scrape many repositories, ask a model to invent issues, and keep the repairs that pass tests. That creates volume, but volume is not the same as usable training data. Many repositories do not build cleanly. Many test suites are flaky or shallow. Some projects have licenses that block use. Some generated bugs are artificial in a way that teaches the model to satisfy the generator rather than maintain software.',
        'The harder wall is trust. A synthetic task can be too local, too repetitive, too easy to reverse engineer from the failing test, or too far from realistic maintenance. A reported improvement can also be leakage if near-duplicate repositories, task families, mutation operators, or proof traces appear in both training and evaluation. The factory has to reject aggressively or the dataset becomes a mirror for its own shortcuts.',
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        'The core insight is to treat coding-agent data as manufactured output. A task is not trusted because it was generated. It becomes trusted when the factory can show the repository version, image digest, baseline command, failing command, task source, repair diff, verifier result, dedupe fingerprint, cost, and split assignment.',
        'The promotion ledger is the boundary between raw activity and usable data. It decides whether a task enters supervised training, reinforcement learning, critic training, process-reward modeling, evaluation, quarantine, or rejection. That ledger is the data structure that protects the rest of the pipeline from wishful thinking.',
      ],
    },
    {
      heading: 'How the Visual Model Teaches It',
      paragraphs: [
        'The pipeline view separates source material from training material. The repository is only an input. The environment image, baseline tests, gym API, task generator, agent rollout, verifier, and split ledger are separate stations because each one can accept, transform, or reject the candidate. Dataset quality comes from gates, not from scale alone.',
        'The promotion view puts the verifier in the center. A generated bug is raw material. A rollout is raw material. The factory earns trust only when it records why the task failed, what repair was attempted, what proof passed or failed, and where the resulting artifact may be used. The visual model is a manufacturing line with audit evidence at every handoff.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'A repository first goes through readiness gates. The factory checks whether it can build, whether baseline tests pass, whether the oracle is strong enough to identify a meaningful failure, whether the project size is practical, whether the license permits use, and whether privacy filters can remove secrets or sensitive material. Repositories that fail these gates should not silently enter training.',
        'Accepted repositories are wrapped as gyms with operations such as reset, inspect, edit, run, test, and score. The task generator then creates candidate repair problems through controlled mutations, issue transformations, or other task families. Agents run inside the same gym, producing trajectories that include tool calls, diffs, test output, error messages, and final verifier results.',
      ],
    },
    {
      heading: 'Verification',
      paragraphs: [
        'The verifier is not a decorative test runner. It proves that the baseline state was valid, the task introduced a target failure, the agent response changed the repository, and the final state satisfies the accepted oracle. It should rerun flaky-looking cases, record command output, and preserve enough information for another worker to replay the decision later.',
        'Correctness is replayability plus separation. Replayability means the task can be reconstructed from the recorded repository version, image digest, setup commands, task generator configuration, failing command, repair proof, and environment variables. Separation means training and evaluation are split by repository, task family, mutation family, and proof family so the model cannot win by seeing near copies.',
      ],
    },
    {
      heading: 'What Counts as Data',
      paragraphs: [
        'A mature factory keeps more than successful repairs. A clean success can train patch generation. A verified failure can train a critic or search policy. A partial repair can teach process reward models where progress happened before the final answer failed. A quarantined task can reveal a flaky oracle or generator bug. A rejected task can still improve future generator filters.',
        'This is why the promotion labels matter. Positive trajectories, negative traces, partial repairs, holdouts, flaky rejects, privacy rejects, license rejects, and duplicate rejects should be different states. Collapsing them into pass or fail throws away the structure that makes large-scale coding-agent training controllable.',
      ],
    },
    {
      heading: 'Costs and Metrics',
      paragraphs: [
        'The visible output is a model checkpoint or benchmark score, but the scarce asset is the repository gym fleet. Every promoted task consumes build time, image storage, runner time, network bandwidth, test time, verifier reruns, artifact storage, and human review for policy edge cases. Cost per promoted task is often a better metric than raw generated task count.',
        'A healthy factory discards many candidates. That is not waste by itself. Repository gates, oracle gates, flake checks, privacy filters, dedupe, and split rules should shrink the pool. Factory metrics should include rejection reasons, proof pass rate, duplicate rate, repository diversity, task-family diversity, rerun disagreement, and evaluation leakage checks.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The approach works because runnable repositories provide state and executable feedback. The agent is trained against real files, real dependencies, real command output, and real tests. That gives the training data a texture that static examples cannot provide: navigation, hypothesis formation, failed commands, repair attempts, and final proof.',
        'It also works because the factory can align several learning signals around the same environment. The same gym can produce supervised patches, reinforcement rollouts, verifier-labeled failures, process traces, and evaluation holdouts. The invariant tying them together is that every promoted item has a reproducible origin and a recorded reason for its label.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'A repo-to-gym factory wins when the goal is scalable, executable coding-agent data. It is useful for repair tasks, negative trajectories, partial solutions, benchmark refresh, curriculum construction, and controlled comparisons among agents. It is especially strong when the repository pool is diverse enough to teach navigation, dependency handling, test interpretation, and patch design across different project cultures.',
        'It also wins when the organization needs a reliable training loop. The same factory can generate new tasks, evaluate regressions, measure verifier drift, inspect cost per promoted item, and refresh holdouts. That makes it a system for continuous data production rather than a one-time benchmark scrape.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'It fails when generated tasks are automatically treated as realistic. A mutation can be easy to detect, unlike real bugs. A failing test can over-specify the repair. A repository can be too small to require meaningful navigation. A generator can create thousands of tasks that all teach the same trick. Synthetic scale is only useful when diversity and proof stay visible.',
        'It also fails when evaluation discipline is weak. If the model trains on near-duplicates of the holdout, the reported score is factory overfitting. Do not trust gains unless the report names how repositories, task families, mutation families, proof families, and generated traces were separated.',
      ],
    },
    {
      heading: 'Complete Case Study',
      paragraphs: [
        'A Python library enters the factory. The repository builds in a pinned image, baseline tests pass, the license gate permits use, and secret scanning finds nothing sensitive. The gym generator removes an edge-case guard from a parser. One existing test now fails, and a new generated check confirms the same behavior from a second angle.',
        'An agent inspects the failing command, reads the parser, patches the guard, and reruns the tests. The verifier repeats the relevant commands, stores the diff, records the image digest, assigns a mutation-family fingerprint, and checks for near-duplicates. The promotion ledger can now place the success in training while reserving related tasks for evaluation or rejection.',
      ],
    },
    {
      heading: 'Operational Guidance',
      paragraphs: [
        'Run the factory like an evidence system. Track build pass rate, baseline flake rate, oracle strength, task promotion rate, duplicate rate, privacy reject rate, cost per promoted task, rerun disagreement, repository diversity, task-family diversity, and evaluation leakage checks. A dashboard that shows only total tasks generated is hiding the most important information.',
        'Keep the split ledger conservative. Hold out whole repositories when possible. Hold out task families when repository holdout is not enough. Recompute dedupe fingerprints when the generator changes. Store failed verifier proofs, not only passing artifacts, because the failure distribution is often where generator debt first appears.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary sources: SWE-smith paper at https://arxiv.org/abs/2504.21798, SWE-smith site at https://swesmith.com/, SWE-smith GitHub at https://github.com/SWE-bench/SWE-smith, CWM at https://arxiv.org/abs/2510.02387, SWE-bench at https://github.com/swe-bench/SWE-bench, and SWE-agent at https://arxiv.org/abs/2405.15793.',
        'Study Synthetic Bug Mutation Oracle Case Study, Executable Repository Image Build Cache Case Study, Verified Agent Trajectory Store, Agent Trajectory Dedupe & Provenance Hash, Coding Agent Edit Grammar Adapter Case Study, Process Reward Models & Verifier Search, and Evaluation Leakage Dedupe for the next layer of this curriculum.',
      ],
    },
  ],
};
