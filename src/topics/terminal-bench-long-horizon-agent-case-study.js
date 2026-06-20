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
      heading: 'Why this exists',
      paragraphs: [
        `Many agent benchmarks ask whether a model can answer a question, choose an option, or patch a file. Terminal work asks a harder operational question: can an agent use a real shell over time, inspect an unfamiliar environment, run commands, repair setup, create artifacts, keep budget, and satisfy an external verifier?`,
        `Terminal-Bench exists because the command line is a different interface from chat. A final answer can sound correct while the filesystem is unchanged, a service is not running, or a generated artifact is missing. Terminal tasks force the agent's claims to meet executable state.`,
        `The Terminal-Bench 2.0 paper frames this as long-horizon, realistic work in terminal environments, with tasks that include a unique environment, human-written solution, and tests for verification. The important lesson for data-structure students is that the benchmark is not one prompt. It is a composed system with manifests, sandboxes, command ledgers, artifacts, budgets, verifiers, scores, and audit traces.`,
        {type:'callout', text:`Terminal-Bench treats agent skill as state-changing execution, where manifests, traces, artifacts, and verifiers replace final-answer trust.`},
      ],
    },
    {
      heading: 'Why final-answer grading fails',
      paragraphs: [
        `The naive benchmark design is a prompt that says "use the terminal and solve the task," followed by a final response. That records what the agent claims, not what it did. For terminal work, the answer is usually not a sentence. The answer is a changed repository, a running service, a generated file, a trained model checkpoint, a fixed configuration, or a passing test suite.`,
        `A second naive design is to run a hidden checker but discard the trace. That gives a score, yet it hides the path. If the agent fails, the evaluator cannot tell whether it never found the project, installed the wrong dependency, used the wrong command flag, timed out during compilation, or stopped early after a partial fix.`,
        `Long-horizon tasks need process evidence. The trace is not decoration. It is the data structure that connects the task, environment state, agent actions, produced artifacts, verifier result, and final score. Without it, a benchmark cannot teach developers what failed or help researchers compare agent strategies.`,
      ],
    },
    {
      heading: 'The benchmark object',
      paragraphs: [
        `A terminal-agent benchmark is a structured object. The task manifest states the goal, the success criteria, the starting files, the allowed tools, the budget, and the expected outputs. The environment image provides the initial operating system, packages, user permissions, and repository state. The evaluation runner mediates the agent's shell interaction and records what happened.`,
        `The command ledger stores each command, working directory, exit status, time cost, output summary, and sometimes policy events such as network access or file limits. The artifact ledger records files, logs, model outputs, server state, or other durable products the task cares about. The verifier inspects the final environment and emits a result with evidence.`,
        `This object has to be reproducible. Floating package indexes, live network services, unpinned images, hidden state, and vague output rules can turn the benchmark into a lottery. A hard task is valuable; an unstable task is noise.`,
      ],
    },
    {
      heading: 'The core mechanism',
      paragraphs: [
        `The shell is the action space, and the verifier is the label. The agent observes text, runs commands, reads and writes files, starts processes, and decides when to stop. The runner turns those actions into a trace. The verifier then checks the environment without trusting the agent's final prose.`,
        `This changes the evaluation problem. In a multiple-choice benchmark, the model's answer is the output. In a terminal benchmark, the output is an environment state. A good runner must therefore preserve state transitions, not just messages. It must know what command ran, where it ran, what it changed, and whether the final state satisfies the task contract.`,
        `The benchmark becomes a small operating system around the agent. It needs isolation for safety, budgets for cost control, logging for auditability, and deterministic verification for scoring. Those are systems concerns, not just prompt concerns.`,
      ],
    },
    {
      heading: 'What the views show',
      paragraphs: [
        `The terminal-task-graph view treats the benchmark as a state machine. The manifest defines success, the image defines the starting state, the agent changes the sandbox through commands, and artifacts record the resulting filesystem or service state. The verifier is the external judge.`,
        `The verifier-runner view focuses on evidence. A good checker does not merely say pass or fail; it can point to files, hashes, HTTP responses, metrics, logs, or policy decisions. That evidence makes failures actionable instead of merely disappointing.`,
        `The plot emphasizes horizon length. Each extra setup step, diagnosis step, compile step, retry, and cleanup step gives the agent another chance to lose context or spend budget. Long-horizon evaluation measures planning under state, not just local command selection.`,
      ],
    },
    {
      heading: 'Manifest design',
      paragraphs: [
        `The manifest is the benchmark contract. It should name the goal in plain language, define what success means, specify setup, name the relevant output artifacts, set budgets, and point to the verifier. If the manifest is ambiguous, the benchmark may test guesswork instead of capability.`,
        `A good manifest separates user-facing instructions from hidden evaluation logic. The agent should know enough to solve the task honestly, but the verifier can still check edge cases and shortcuts. The manifest should also state constraints: no network, limited runtime, fixed ports, required filenames, allowed dependencies, or security boundaries.`,
        `Budgets are part of the task. A model that solves a task after unlimited retries is not equivalent to a model that solves it within a practical time and token budget. Terminal-Bench-style tasks expose whether the agent can allocate effort, not just eventually discover a solution.`,
      ],
    },
    {
      heading: 'Sandbox and environment',
      paragraphs: [
        `The sandbox makes the task executable and repeatable. It pins the starting filesystem, packages, permissions, and process model. It also protects the host system from untrusted commands. A terminal benchmark that cannot be replayed is hard to trust because a changed dependency or missing package can change the score.`,
        `Isolation also clarifies responsibility. If the task image is complete and deterministic, failure belongs more clearly to the agent or the task specification. If the image drifts, the agent may be punished for external state it cannot control.`,
        `Network policy matters. Some tasks should allow internet access because the real workflow requires it. Others should forbid it to preserve determinism and prevent data leakage. The important point is that network behavior is an explicit part of the benchmark, not an accident.`,
      ],
    },
    {
      heading: 'Command and artifact ledgers',
      paragraphs: [
        `The command ledger is a chronological record of action. At minimum it should preserve command text, working directory, exit status, and enough output to understand what happened. Stronger harnesses also capture elapsed time, output digests, truncated logs, file changes, and policy events.`,
        `The artifact ledger records durable results. A task may care about a patched source file, a generated report, a trained model file, a service log, a compiled binary, or a JSON result. Artifacts let the verifier check state directly and let humans audit what the agent produced.`,
        `These ledgers separate capability from luck. Two agents may both fail, but one may fail after diagnosing the right service and hitting a dependency lock issue, while another never leaves the wrong directory. That distinction matters for benchmark design, model training, and product debugging.`,
      ],
    },
    {
      heading: 'Verifier design',
      paragraphs: [
        `The verifier should grade effects, not confidence. It can run tests, inspect files, hash outputs, query a service, check metrics, parse logs, enforce security policy, or compare a generated artifact to a rubric encoded in code. The key property is that the verifier observes the environment outside the model's final answer.`,
        `A verifier also needs shortcut defense. If the task is to implement a function, the verifier should not only check that one public example passes. If the task is to start a service, it should check the intended behavior, not just that some process is listening on a port. If the task is to produce a file, it should check content, not only existence.`,
        `Verifier evidence should be stored with the score. A binary pass/fail result is useful for a leaderboard, but evidence is useful for engineering. The best failure reports say what was missing, what command output mattered, which assertion failed, and which artifact was inspected.`,
      ],
    },
    {
      heading: 'Worked service example',
      paragraphs: [
        `Consider a task that asks the agent to repair and run a small API service. The manifest pins the image, repository path, setup command, expected port, time budget, response contract, and output file. The initial service fails because configuration and dependency state are inconsistent.`,
        `A capable agent inspects the tree, reads logs, runs the failing command, identifies the configuration issue, patches the right file, installs or uses pinned dependencies, starts the service, and writes the required result artifact. The important output is not the agent saying "fixed." The output is a running service and files that satisfy the verifier.`,
        `The verifier can curl endpoints, check status codes, parse response bodies, inspect logs for forbidden errors, hash the output file, and record the proof packet. If the agent starts the wrong service, hardcodes a response, writes the artifact in the wrong path, or stops before the server is actually reachable, the verifier should catch it.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `This evaluation style works because it closes the loop between action and state. The agent may reason in language, but its score comes from observable effects. That makes terminal benchmarks closer to real operations work than answer-only exams.`,
        `It also creates analyzable traces. Developers can see whether failure came from navigation, dependency resolution, command syntax, stale assumptions, test misunderstanding, budget exhaustion, or premature stopping. Those categories point to different fixes in model behavior and runner design.`,
        `Finally, it rewards persistence with verification. A strong terminal agent does not merely edit and hope. It checks its own work, runs local tests when appropriate, reads errors, and keeps moving until the external verifier is likely to pass or the budget is exhausted.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Navigation failure is basic but common. The agent runs commands in the wrong directory, edits the wrong copy of a file, or loses track of generated outputs. A trace with working directories makes this visible.`,
        `Dependency failure appears when the environment image is incomplete, package versions float, installs take too long, or the agent chooses an incompatible toolchain. Pinned images and lockfiles reduce benchmark noise, while logs show whether the agent handled the failure well.`,
        `State failure appears when processes are stale, services are already running, environment variables differ from assumptions, or files created by one command are not used later. Long-horizon agents need explicit state checking because the shell does not preserve a clean mental model for them.`,
        `Verifier failure appears when the checker is weak, overfit, flaky, or misaligned with the manifest. A benchmark with weak tests can be gamed or accidentally passed. A benchmark with flaky tests punishes correct work. Both cases corrupt the score.`,
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        `When designing a terminal task, make the desired final state concrete. Name required files, service behavior, metrics, ports, or command outputs. Pin the environment. Keep setup deterministic. Decide whether network access is part of the skill or a source of drift.`,
        `When running agents, preserve enough trace to debug failures without storing unnecessary secrets. Capture command text, cwd, exit status, output snippets, timing, artifact paths, and verifier evidence. Store budgets and stop reasons so early termination can be distinguished from incorrect work.`,
        `When interpreting scores, separate model capability from benchmark-environment quality. Low solve rate may mean tasks are hard, agents are weak, verifiers are strict, images are brittle, or budgets are unrealistic. The trace is what lets you tell those explanations apart.`,
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        `Terminal evaluation matters for software maintenance, scientific computing, data pipelines, security exercises, infrastructure repair, and codebase onboarding. These are domains where success is a working environment, not a persuasive paragraph.`,
        `It also matters for product work on autonomous agents. A user does not only need an agent that can suggest commands. They need an agent that can carry state, notice failures, repair its plan, validate output, and stop with evidence.`,
        `For curriculum purposes, Terminal-Bench is a systems case study. The interesting data structures are not arrays and heaps; they are manifests, traces, ledgers, sandboxes, budget records, and verifier result objects. Those structures turn messy terminal activity into an evaluable experiment.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Terminal-Bench paper at https://arxiv.org/abs/2601.11868, Terminal-Bench site at https://www.tbench.ai/, Terminal-Bench GitHub at https://github.com/harbor-framework/terminal-bench, SWE-agent at https://arxiv.org/abs/2405.15793, and CWM at https://arxiv.org/abs/2510.02387.`,
        `Study the agent-portability audit module for environment contracts, Computer-Use Agent Runtime Loop Case Study for action-observation loops, Executable Repository Image Build Cache Case Study for reproducible setup, Distributed Tracing for span structure, Process Reward Models & Verifier Search for feedback beyond final labels, and Agent Run Trace Span Tree for trace analysis.`,
      ],
    },
  ],
};
