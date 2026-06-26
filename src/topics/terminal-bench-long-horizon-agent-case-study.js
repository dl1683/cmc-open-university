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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the terminal as a state machine, not as a chat transcript. Active nodes are the manifest, sandbox, command, artifact, or verifier component being used at that moment, and completed nodes are evidence already produced by the run.',
        'A manifest is the task contract: it says what must be true at the end. A verifier is code that checks the final environment, so the safe inference rule is simple: a claim counts only when the verifier can inspect a changed file, service, log, or artifact that proves it.',
        {type:'callout', text:`Terminal-Bench treats agent skill as state-changing execution, where manifests, traces, artifacts, and verifiers replace final-answer trust.`},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Terminal-Bench exists because many agent tasks are not answered by a sentence. The useful output is often a repaired repository, a compiled program, a started service, a generated file, or a test suite that now passes.',
        'A zero-background reader should treat the shell as the operating interface where state changes happen. Terminal-Bench 2.0 describes 89 hard command-line tasks, each with its own environment, human-written solution, and verification tests, so the benchmark measures whether the agent can make a machine state true.',
      ],
    },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious benchmark is to ask the agent to solve a task and then grade its final answer. That is cheap because the evaluator only stores the prompt, the model response, and maybe a hidden expected answer.',
        'For terminal work, this approach is weak because the final answer can be fluent while the filesystem is unchanged. A second obvious approach runs a hidden checker but throws away the command history, which gives a score without explaining why the run passed or failed.',
      ],
    },
    { heading: 'The wall', paragraphs: [
        'The wall is missing causal evidence. If a run fails, the score alone cannot tell whether the agent never found the project, installed the wrong package, edited the wrong file, timed out during build, or stopped before validating its work.',
        'Long-horizon tasks also accumulate state over many shell steps. One wrong directory, stale process, missing environment variable, or overwritten artifact can invalidate later work, and answer-only grading has no data structure that connects the mistake to the final failure.',
      ],
    },
    { heading: 'The core insight', paragraphs: [
        'The core insight is to grade environment state and store the path that produced it. The benchmark needs a manifest, a sandbox, a command ledger, an artifact ledger, and a verifier result, because together they connect intent, action, state change, and evidence.',
        'A command ledger is an ordered record of command text, working directory, exit code, time, and useful output. An artifact ledger records durable products such as files, logs, metrics, checkpoints, or server responses, so the verifier can inspect effects instead of trusting prose.',
      ],
    },
    { heading: 'How it works', paragraphs: [
        'A task starts from a pinned sandbox image, which means a reproducible filesystem, packages, permissions, and process model. The runner gives the agent a shell, records each command, enforces budgets, and captures enough output to explain the run without storing unbounded logs.',
        'The agent reads files, runs commands, edits state, starts processes, and decides when to stop. The verifier then runs outside the model response and checks concrete evidence such as tests, file hashes, HTTP responses, program output, or required artifacts.',
      ],
    },
    { heading: 'Why it works', paragraphs: [
        'The correctness argument is an invariant over evidence. At every step, the trace records what state-changing action occurred and what observable result followed, so the final score can be tied back to the exact environment the agent produced.',
        'This does not prove the agent reasoned well, but it proves the benchmark did not accept a bare claim. If the verifier is deterministic and aligned with the manifest, then a passing run means the final sandbox satisfies the task contract that the verifier checks.',
      ],
    },
    { heading: 'Cost and complexity', paragraphs: [
        'The cost grows with horizon length, which is the number of meaningful steps before completion. A 5-command task may need 5 ledger entries and one test run, while a 100-command repair needs enough storage, timeout budget, and log retention to preserve the useful part of all 100 transitions.',
        'Runtime cost is not only model tokens. The dominant cost can be package installation, compilation, service startup, repeated test runs, artifact upload, or verifier execution, so doubling the command count can more than double wall time if the later commands trigger expensive rebuilds.',
      ],
    },
    { heading: 'Real-world uses', paragraphs: [
        'This pattern fits software maintenance, infrastructure repair, security exercises, data pipeline debugging, scientific computing, and codebase onboarding. In each case, success is a working environment and an evidence packet, not a persuasive explanation.',
        'It also fits product evaluation for autonomous coding agents. Teams can compare whether an agent navigates repositories, handles dependencies, validates output, respects budgets, and leaves enough trace for a human to debug the run.',
      ],
    },
    { heading: 'Where it fails', paragraphs: [
        'The benchmark fails when the environment is unstable. Floating package indexes, live web dependencies, unpinned images, hidden state, and flaky tests can make the same agent receive different scores for reasons outside its behavior.',
        'It also fails when the verifier is too narrow. If the checker only tests one public example, the agent can hardcode that example, start the wrong service, or create a file with the right name but wrong semantics.',
      ],
    },
    { heading: 'Worked example', paragraphs: [
        'Suppose a task asks an agent to fix an API service and expose GET /health on port 8080. The manifest gives a 20-minute budget, repository path /app/service, expected status code 200, response body ok, and required artifact /app/result.json.',
        'The agent runs 18 commands: 3 directory inspections, 4 dependency checks, 2 failing test commands, 2 file edits, 3 service-start attempts, 2 curls, 1 JSON write, and 1 final test. If npm install takes 90 seconds and the final verifier takes 10 seconds, the cost is dominated by setup and restart behavior, not by the short curl checks.',
        'A correct verifier curls localhost:8080/health, parses the body, checks that result.json exists, and records command evidence. If the agent only writes result.json but never starts the server, the file evidence passes one condition while the service evidence fails the task.',
      ],
    },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources: Terminal-Bench paper at https://arxiv.org/abs/2601.11868, Terminal-Bench site at https://www.tbench.ai/, Terminal-Bench GitHub at https://github.com/harbor-framework/terminal-bench, SWE-agent at https://arxiv.org/abs/2405.15793, and CWM at https://arxiv.org/abs/2510.02387.',
        'Study agent run trace span trees for nested execution evidence, executable repository image build caches for reproducible setup, distributed tracing for cross-process spans, process reward models for intermediate feedback, and verifier-guided inference for search under external checks.',
      ],
    },
  ],
};
