// Terminal-Bench as an agent evaluation case study: terminal tasks need
// manifests, sandboxes, command ledgers, artifacts, and verifier tests.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'terminal-bench-long-horizon-agent-case-study',
  title: 'Terminal-Bench Long-Horizon Agent Case Study',
  category: 'Papers',
  summary: 'Terminal-Bench as a data-structure lesson: terminal-agent tasks require manifests, sandboxes, command traces, artifact ledgers, budgets, and verifier tests.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['terminal task graph', 'verifier harness'], defaultValue: 'terminal task graph' },
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

function terminalGraph(title) {
  return graphState({
    nodes: [
      { id: 'task', label: 'task', x: 0.6, y: 3.3, note: 'goal' },
      { id: 'manifest', label: 'manifest', x: 2.0, y: 2.0, note: 'spec' },
      { id: 'image', label: 'image', x: 2.0, y: 4.8, note: 'env' },
      { id: 'agent', label: 'agent', x: 3.8, y: 3.3, note: 'loop' },
      { id: 'cmd', label: 'cmd log', x: 5.4, y: 2.0, note: 'shell' },
      { id: 'artifact', label: 'artifact', x: 5.4, y: 4.8, note: 'files' },
      { id: 'tests', label: 'tests', x: 7.1, y: 3.3, note: 'oracle' },
      { id: 'score', label: 'score', x: 8.7, y: 2.0, note: 'pass' },
      { id: 'audit', label: 'audit', x: 8.7, y: 4.8, note: 'trace' },
    ],
    edges: [
      { id: 'e-task-manifest', from: 'task', to: 'manifest' },
      { id: 'e-task-image', from: 'task', to: 'image' },
      { id: 'e-manifest-agent', from: 'manifest', to: 'agent' },
      { id: 'e-image-agent', from: 'image', to: 'agent' },
      { id: 'e-agent-cmd', from: 'agent', to: 'cmd' },
      { id: 'e-agent-artifact', from: 'agent', to: 'artifact' },
      { id: 'e-cmd-tests', from: 'cmd', to: 'tests' },
      { id: 'e-artifact-tests', from: 'artifact', to: 'tests' },
      { id: 'e-tests-score', from: 'tests', to: 'score' },
      { id: 'e-tests-audit', from: 'tests', to: 'audit' },
    ],
  }, { title });
}

function* terminalTaskGraph() {
  yield {
    state: terminalGraph('Terminal-agent task graph'),
    highlight: { active: ['task', 'manifest', 'image', 'agent', 'e-task-manifest', 'e-task-image', 'e-manifest-agent', 'e-image-agent'], found: ['tests'], compare: ['score'] },
    explanation: 'A terminal-agent benchmark is not a prompt plus answer. It is a task manifest, isolated environment, agent command loop, produced artifacts, verifier tests, and audit trace.',
    invariant: 'The shell is the action space; the verifier is the label.',
  };

  yield {
    state: labelMatrix(
      'Task manifest fields',
      [
        { id: 'goal', label: 'goal' },
        { id: 'env', label: 'env' },
        { id: 'setup', label: 'setup' },
        { id: 'budget', label: 'budget' },
        { id: 'out', label: 'out' },
        { id: 'test', label: 'test' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['rubric', 'scope', 'ambig'],
        ['image', 'replay', 'drift'],
        ['script', 'state', 'hidden'],
        ['time/tok', 'cost', 'retry'],
        ['files', 'score', 'miss'],
        ['oracle', 'label', 'weak'],
      ],
    ),
    highlight: { active: ['goal:field', 'env:field', 'budget:field', 'test:field'], found: ['out:why'], compare: ['setup:risk'] },
    explanation: 'The manifest is the contract. It must say what counts as success, how the environment starts, how long the agent may work, what artifacts matter, and how the verifier checks them.',
  };

  yield {
    state: terminalGraph('Command trace plus artifact ledger'),
    highlight: { active: ['agent', 'cmd', 'artifact', 'tests', 'e-agent-cmd', 'e-agent-artifact', 'e-cmd-tests', 'e-artifact-tests'], found: ['audit'] },
    explanation: 'Terminal tasks often succeed by creating files, installing packages, training small models, compiling code, or configuring services. The audit trail needs command output and final artifacts, not just a final message.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'task horizon', min: 0, max: 8 }, y: { label: 'solve rate, illustrative percent', min: 0, max: 80 } },
      series: [
        { id: 'short', label: 'short tasks', points: [{ x: 1, y: 72 }, { x: 2, y: 68 }, { x: 3, y: 61 }, { x: 4, y: 55 }] },
        { id: 'long', label: 'long terminal tasks', points: [{ x: 1, y: 61 }, { x: 2, y: 49 }, { x: 3, y: 38 }, { x: 4, y: 31 }, { x: 6, y: 22 }, { x: 7, y: 18 }] },
      ],
      markers: [
        { id: 'cliff', x: 4, y: 31, label: 'horizon' },
      ],
    }),
    highlight: { active: ['long', 'cliff'], compare: ['short'] },
    explanation: 'The benchmark pressure is long-horizon execution. Every additional setup, diagnosis, compile, or artifact step adds chances for the agent to lose state, waste budget, or stop early.',
  };
}

function* verifierHarness() {
  yield {
    state: terminalGraph('Verifier harness closes the task'),
    highlight: { active: ['tests', 'score', 'audit', 'e-tests-score', 'e-tests-audit'], compare: ['cmd', 'artifact'] },
    explanation: 'A terminal benchmark should grade with tests or checkers, not style preference. The verifier reads command effects and artifacts, then emits a pass, fail, and evidence packet.',
  };

  yield {
    state: labelMatrix(
      'Verifier checks',
      [
        { id: 'file', label: 'file' },
        { id: 'svc', label: 'svc' },
        { id: 'model', label: 'model' },
        { id: 'perf', label: 'perf' },
        { id: 'sec', label: 'sec' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'proof', label: 'proof' },
        { id: 'trap', label: 'trap' },
      ],
      [
        ['exists', 'hash', 'fake'],
        ['ok', 'curl', 'port'],
        ['metric', 'json', 'seed'],
        ['limit', 'time', 'fluke'],
        ['policy', 'deny', 'bypass'],
      ],
    ),
    highlight: { active: ['file:proof', 'svc:proof', 'model:proof', 'sec:proof'], compare: ['perf:trap'], found: ['sec:check'] },
    explanation: 'Terminal verifiers can check files, services, model metrics, performance limits, and security policies. Each check needs a proof artifact and a known shortcut to defend against.',
  };

  yield {
    state: labelMatrix(
      'Failure taxonomy',
      [
        { id: 'nav', label: 'nav' },
        { id: 'dep', label: 'dep' },
        { id: 'state', label: 'state' },
        { id: 'cmd', label: 'cmd' },
        { id: 'stop', label: 'stop' },
      ],
      [
        { id: 'sign', label: 'sign' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['lost dirs', 'pwd trace'],
        ['install fail', 'lock img'],
        ['bad env', 'snapshot'],
        ['wrong flags', 'manuals'],
        ['early final', 'budget'],
      ],
    ),
    highlight: { active: ['dep:sign', 'state:sign', 'cmd:sign', 'stop:sign'], found: ['dep:fix', 'state:fix'], compare: ['nav:fix'] },
    explanation: 'Command traces make failure analysis concrete. The agent may be lost in the filesystem, blocked by dependencies, carrying stale state, using wrong flags, or stopping before the verifier is satisfied.',
  };

  yield {
    state: terminalGraph('Complete case: build a small service'),
    highlight: { active: ['manifest', 'image', 'agent', 'cmd', 'artifact', 'tests', 'e-manifest-agent', 'e-image-agent', 'e-agent-cmd', 'e-agent-artifact', 'e-cmd-tests', 'e-artifact-tests'], found: ['score', 'audit'] },
    explanation: 'A task asks the agent to repair and run a small API service. The agent installs dependencies, patches config, starts the service, writes output files, and the verifier checks HTTP responses plus artifact hashes.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'terminal task graph') yield* terminalTaskGraph();
  else if (view === 'verifier harness') yield* verifierHarness();
  else throw new InputError('Pick a Terminal-Bench view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Terminal-Bench is a benchmark family for agents operating in command-line environments. The educational value is broader than one leaderboard: terminal tasks expose whether an agent can plan through setup, inspect state, execute commands, create artifacts, and satisfy a verifier over a long horizon.',
        'This belongs next to Agent Harness Portability Audit because the command line is a different agent-computer interface from a repo-only patch harness. It also belongs next to Execution-as-a-Service Verifier Economy Case Study because terminal tasks are only meaningful when the environment and checker are reproducible.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'A serious terminal task uses a task manifest, sandbox image digest, initial filesystem snapshot, environment variable policy, command trace ledger, artifact ledger, budget record, verifier script, score record, and failure taxonomy. These are the durable objects behind the benchmark.',
        'The command trace should include cwd, command, exit status, stdout and stderr digests, elapsed time, environment deltas, created files, and policy events. The artifact ledger should hash files and store just enough metadata to reproduce the score without keeping unsafe or oversized byproducts.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The harness starts from a clean image and task manifest. The agent interacts through shell commands. Each command updates the trace ledger. When the agent stops or budget expires, verifier tests inspect the filesystem, services, outputs, or metrics and emit a score with proof.',
        'Long-horizon terminal tasks are hard because errors compound. A wrong directory, missing dependency, stale service, hidden test fixture, or early final answer can invalidate a later step. The trace is therefore part of the label: it explains why a task failed, not only that it failed.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A task asks the agent to fix and launch a small web service. The manifest pins the container, setup script, ports, time budget, expected response contract, and verifier. The agent reads logs, patches configuration, installs dependencies, starts the service, and writes a result file. The verifier curls endpoints, checks status codes, hashes artifacts, and records final proof.',
        'A weak benchmark would ask for a prose answer. A strong terminal benchmark measures whether the agent changed the world inside the sandbox in the intended way.',
      ],
    },
    {
      heading: 'Pitfalls and sources',
      paragraphs: [
        'Do not let benchmark data leak into training corpora. Do not let tasks depend on floating package indexes or live network state unless that is the explicit skill under test. Do not grade only the final answer if the real goal is a filesystem or service state. Do not hide timeout and retry budget; those are part of the benchmark.',
        'Primary sources: Terminal-Bench paper at https://arxiv.org/abs/2601.11868, Terminal-Bench site at https://www.tbench.ai/, Terminal-Bench GitHub at https://github.com/harbor-framework/terminal-bench, SWE-agent at https://arxiv.org/abs/2405.15793, and CWM at https://arxiv.org/abs/2510.02387. Study Agent Harness Portability Audit, Computer-Use Agent Harness Loop Case Study, Executable Repository Image Build Cache Case Study, Distributed Tracing, Process Reward Models & Verifier Search, and Agent Run Trace Span Tree next.',
      ],
    },
  ],
};
