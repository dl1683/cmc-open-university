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
      heading: 'What it is',
      paragraphs: [
        'SWE-smith is a case study in scaling software-engineering agent data. The reusable idea is repo-to-gym conversion: take a real codebase, construct an executable environment, synthesize tasks that break tests, roll out agents, verify repairs, and promote clean trajectories into training or evaluation datasets.',
        'This topic overlaps intentionally with Synthetic Bug Mutation Oracle Case Study, but it is not the same lesson. The mutation module explains one oracle mechanism. SWE-smith is the larger factory pattern: repository readiness, gym construction, task generation, trajectory collection, promotion, model training, and split hygiene.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The factory uses repository manifests, executable images, baseline test ledgers, task generator configs, mutation or issue families, gym APIs, rollout traces, verifier proofs, promotion labels, dedupe fingerprints, split ledgers, and model-training manifests.',
        'The split ledger is especially important. It should prevent near-duplicate task families, mutation operators, repositories, or proof traces from appearing on both training and evaluation sides. Otherwise benchmark gains may reflect leakage rather than general software-engineering skill.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A repository first passes readiness gates: build, baseline tests, oracle coverage, license, cost, and privacy. The factory wraps it as a gym with reset and test operations. Task generation creates candidate bugs or repair tasks. Verifiers reject invisible, flaky, duplicate, or unsafe tasks. Agents then produce trajectories that are labeled as success, failure, partial repair, rejected, or holdout.',
        'At scale, the factory is a data platform. It needs job queues, image caches, test runners, artifact storage, provenance records, cost accounting, and periodic refresh. The model checkpoint is the visible output, but the repository gym fleet is the scarce asset.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A Python library enters the factory. Its baseline tests pass in a pinned image. The gym generator removes an edge-case guard, producing a failing test. An agent repair trajectory restores the guard and passes the verifier twice. The promotion ledger stores the image digest, bug family, failing command, repair diff, passing proof, cost, dedupe hash, and split assignment.',
        'The same factory can collect positive repairs, negative failed attempts, partial repairs useful for process supervision, and clean holdouts for evaluation. That diversity matters because coding agents need both generation skill and verifier-aware search behavior.',
      ],
    },
    {
      heading: 'Pitfalls and sources',
      paragraphs: [
        'Do not treat generated tasks as automatically realistic. Synthetic tasks can become repetitive, too local, too test-shaped, or too easy to reverse engineer. Do not train on every passing repair without dedupe and split gates. Do not ignore repository licensing and private data. Do not report model gains without naming whether evaluation held out repositories, task families, and mutation families.',
        'Primary sources: SWE-smith paper at https://arxiv.org/abs/2504.21798, SWE-smith site at https://swesmith.com/, SWE-smith GitHub at https://github.com/SWE-bench/SWE-smith, CWM at https://arxiv.org/abs/2510.02387, SWE-bench at https://github.com/swe-bench/SWE-bench, and SWE-agent at https://arxiv.org/abs/2405.15793. Study Synthetic Bug Mutation Oracle Case Study, Executable Repository Image Build Cache Case Study, Verified Agent Trajectory Store, Agent Trajectory Dedupe & Provenance Hash, Coding Agent Edit Grammar Adapter Case Study, and Process Reward Models & Verifier Search next.',
      ],
    },
  ],
};
