// mini-SWE-agent as an architecture lesson: a small loop can be strong when
// environment, tool grammar, transcript, and verifier contracts are clean.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'mini-swe-agent-control-loop-case-study',
  title: 'mini-SWE-agent Control Loop Case Study',
  category: 'AI & ML',
  summary: 'mini-SWE-agent as a minimal-scaffold lesson: model call, environment step, observation ledger, budget policy, and verifier gate can carry a surprising amount of agent behavior.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['minimal loop', 'scaffold ledger'], defaultValue: 'minimal loop' },
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

function loopGraph(title) {
  return graphState({
    nodes: [
      { id: 'issue', label: 'issue', x: 0.6, y: 3.3, note: 'task' },
      { id: 'prompt', label: 'prompt', x: 2.0, y: 3.3, note: 'state' },
      { id: 'model', label: 'model', x: 3.5, y: 2.0, note: 'next' },
      { id: 'action', label: 'action', x: 5.0, y: 2.0, note: 'tool' },
      { id: 'env', label: 'env', x: 6.5, y: 3.3, note: 'step' },
      { id: 'obs', label: 'obs', x: 5.0, y: 4.8, note: 'stdout' },
      { id: 'budget', label: 'budget', x: 3.5, y: 4.8, note: 'turns' },
      { id: 'final', label: 'final', x: 8.2, y: 2.0, note: 'patch' },
      { id: 'score', label: 'score', x: 8.2, y: 4.8, note: 'test' },
    ],
    edges: [
      { id: 'e-issue-prompt', from: 'issue', to: 'prompt' },
      { id: 'e-prompt-model', from: 'prompt', to: 'model' },
      { id: 'e-model-action', from: 'model', to: 'action' },
      { id: 'e-action-env', from: 'action', to: 'env' },
      { id: 'e-env-obs', from: 'env', to: 'obs' },
      { id: 'e-obs-budget', from: 'obs', to: 'budget' },
      { id: 'e-budget-prompt', from: 'budget', to: 'prompt', weight: 'loop' },
      { id: 'e-env-final', from: 'env', to: 'final' },
      { id: 'e-final-score', from: 'final', to: 'score' },
    ],
  }, { title });
}

function* minimalLoop() {
  yield {
    state: loopGraph('A minimal coding-agent control loop'),
    highlight: { active: ['issue', 'prompt', 'model', 'action', 'env', 'obs', 'budget', 'e-issue-prompt', 'e-prompt-model', 'e-model-action', 'e-action-env', 'e-env-obs', 'e-obs-budget', 'e-budget-prompt'], found: ['final', 'score'] },
    explanation: 'mini-SWE-agent is a useful architecture lesson because the control loop is small: build a prompt from state, ask the model for an action, execute in an environment, append observation, enforce budget, and repeat.',
    invariant: 'Small scaffold does not mean absent scaffold.',
  };

  yield {
    state: labelMatrix(
      'Loop state fields',
      [
        { id: 'msg', label: 'msg' },
        { id: 'tool', label: 'tool' },
        { id: 'cwd', label: 'cwd' },
        { id: 'diff', label: 'diff' },
        { id: 'cost', label: 'cost' },
        { id: 'stop', label: 'stop' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['history', 'context', 'bloat'],
        ['schema', 'parse', 'drift'],
        ['path', 'state', 'lost'],
        ['patch', 'score', 'bad'],
        ['cost', 'budget', 'loop'],
        ['done?', 'submit', 'early'],
      ],
    ),
    highlight: { active: ['msg:field', 'tool:field', 'diff:field', 'cost:field'], found: ['stop:risk'], compare: ['cwd:risk'] },
    explanation: 'Even a tiny agent has a state vector. If history, tool schema, working directory, current diff, cost, and stop condition are not explicit, debugging becomes guesswork.',
  };

  yield {
    state: loopGraph('Observation is the feedback channel'),
    highlight: { active: ['action', 'env', 'obs', 'budget', 'prompt', 'e-action-env', 'e-env-obs', 'e-obs-budget', 'e-budget-prompt'], compare: ['model'], found: ['score'] },
    explanation: 'The observation text is where the environment teaches the next step: command output, test failure, file contents, patch status, and policy errors. Compressing or dropping it changes the agent.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'scaffold complexity', min: 0, max: 10 }, y: { label: 'agent utility, conceptual', min: 0, max: 100 } },
      series: [
        { id: 'curve', label: 'useful scaffold', points: [{ x: 1, y: 20 }, { x: 2, y: 55 }, { x: 3, y: 68 }, { x: 5, y: 74 }, { x: 8, y: 73 }, { x: 10, y: 69 }] },
      ],
      markers: [
        { id: 'mini', x: 2.5, y: 66, label: 'mini' },
        { id: 'heavy', x: 8, y: 73, label: 'heavy' },
      ],
    }),
    highlight: { active: ['curve', 'mini'], compare: ['heavy'] },
    explanation: 'The lesson is not that every extra component is bad. It is that clear environment contracts, action parsing, and verifier loops can matter more than a large pile of planning machinery.',
  };
}

function* scaffoldLedger() {
  yield {
    state: loopGraph('Minimal scaffold still needs a ledger'),
    highlight: { active: ['prompt', 'model', 'action', 'env', 'obs', 'final', 'score', 'e-model-action', 'e-action-env', 'e-env-obs', 'e-env-final', 'e-final-score'], found: ['budget'] },
    explanation: 'A compact implementation can still write a rich trace: messages, actions, environment outputs, costs, final patch, and verifier result. Simplicity should not mean no evidence.',
  };

  yield {
    state: labelMatrix(
      'Scaffold responsibilities',
      [
        { id: 'parse', label: 'parse' },
        { id: 'exec', label: 'exec' },
        { id: 'obs', label: 'obs' },
        { id: 'limit', label: 'limit' },
        { id: 'score', label: 'score' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'must', label: 'must' },
      ],
      [
        ['read action', 'reject bad'],
        ['run tool', 'sandbox'],
        ['return out', 'normalize'],
        ['cap spend', 'stop'],
        ['run tests', 'prove'],
      ],
    ),
    highlight: { active: ['parse:must', 'exec:must', 'obs:must', 'limit:must', 'score:must'] },
    explanation: 'The scaffold owns the boundary conditions: parse actions, execute tools safely, normalize observations, cap budgets, and prove final patches. The model should not be trusted to self-police those contracts.',
  };

  yield {
    state: labelMatrix(
      'Complete case: tiny loop on SWE task',
      [
        { id: 'a', label: 'read' },
        { id: 'b', label: 'edit' },
        { id: 'c', label: 'test' },
        { id: 'd', label: 'retry' },
        { id: 'e', label: 'final' },
      ],
      [
        { id: 'obs', label: 'obs' },
        { id: 'state', label: 'state' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['files', 'hyp', 'trace'],
        ['diff', 'patch', 'hash'],
        ['fail', 'bug', 'log'],
        ['fix', 'loop', 'cost'],
        ['pass', 'done', 'score'],
      ],
    ),
    highlight: { active: ['a:proof', 'b:proof', 'c:proof', 'd:proof', 'e:proof'], found: ['e:obs', 'e:state'] },
    explanation: 'A small scaffold reads files, applies a patch, runs tests, observes failure, retries once, and submits the passing diff. The control loop is short, but the evidence chain is complete.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'turn', min: 0, max: 8 }, y: { label: 'remaining budget, illustrative percent', min: 0, max: 100 } },
      series: [
        { id: 'budget', label: 'budget', points: [{ x: 0, y: 100 }, { x: 1, y: 89 }, { x: 2, y: 75 }, { x: 3, y: 58 }, { x: 4, y: 44 }, { x: 5, y: 25 }, { x: 6, y: 12 }] },
      ],
      markers: [
        { id: 'test', x: 4, y: 44, label: 'test' },
        { id: 'stop', x: 6, y: 12, label: 'stop' },
      ],
    }),
    highlight: { active: ['budget', 'test', 'stop'] },
    explanation: 'Budget is part of the agent state. A minimal loop should know when test evidence is strong enough and when another retry is too expensive.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'minimal loop') yield* minimalLoop();
  else if (view === 'scaffold ledger') yield* scaffoldLedger();
  else throw new InputError('Pick a mini-SWE-agent view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The minimal-loop view follows one coding-agent turn: context enters the model, the model emits an action, the scaffold executes it, and the observation returns to the transcript. A scaffold is the code around the model that parses actions, runs tools, records state, and enforces limits. Active nodes are running now, found nodes are durable evidence, and compare nodes check whether a contract was satisfied.',
        'The scaffold-ledger view shows the pieces that make the loop debuggable. The transcript is the central record: messages, tool calls, command results, file changes, budget, and verifier outcome. The safe inference is that an agent run is only auditable if every world-changing action and observation is recorded in order.',
        {type:'callout', text:'A small coding agent works when the transcript, tool grammar, environment boundary, budget, and verifier are explicit contracts.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Coding agents are easy to describe poorly as a model that writes patches. Real software repair is an interaction with a repository, tests, shell commands, errors, and changing hypotheses. The useful unit is the control loop that lets the model act, observe, and revise.',
        'mini-SWE-agent is valuable because it strips that system down. It asks which contracts are necessary before planners, memories, critics, and dashboards are added. A small loop can teach more than a large opaque system when its state is visible.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first obvious approach is one model call that reads an issue and writes a patch. It is cheap and simple, but it treats repair as static completion. The model cannot search the repository, run the failing test, or learn from compiler output.',
        'The opposite approach is to build a large agent platform immediately. It may include planning, retrieval, memory, reflection, routing, dashboards, and many tool adapters. That can help, but it also makes failure hard to attribute because every component can hide or distort evidence.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is boundary discipline. If the action grammar is loose, malformed tool calls slip through. If command output is summarized badly, the next model turn loses the one error line it needed. If the environment boundary is implicit, the agent may appear confused when the scaffold changed the world invisibly.',
        'Verification is another wall. A final answer is not evidence that the patch works. Without a declared verifier, such as a focused test command or benchmark check, the run can end with a plausible diff and no proof that the issue is fixed.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A minimal loop can be strong if the contracts are explicit. The model chooses the next action, but the scaffold owns parsing, execution, observation capture, budget accounting, stop rules, and verifier proof. The loop stays small while the boundary remains strict.',
        'The transcript is the main data structure. It records what the agent knew, what it tried, what the environment returned, and why it stopped. That record lets humans compare runs, debug failures, and decide whether a larger scaffold actually improved anything.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A run begins with a task, instructions, and an environment such as a checkout of a repository. The scaffold builds a prompt from the current transcript, asks the model for one action in a known grammar, parses it, and either rejects it or executes it. Execution can read files, run commands, or apply edits depending on the tool set.',
        'The observation is appended to the transcript with stdout, stderr, exit status, policy errors, and file-change evidence. The next turn uses that evidence to choose another action. The run stops when the model submits, the verifier passes or fails, the budget is exhausted, or the environment hits an unrecoverable condition.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is not that the model is always right. It is that each turn preserves an evidence loop: action, environment result, transcript update, and next decision. If the transcript is faithful, the agent can use repository facts instead of only prior guesses.',
        'The verifier closes the loop. A patch is accepted only when the declared check supports it, such as a passing regression test or benchmark scorer. A failure remains useful because the trace says whether the model misunderstood code, the scaffold lost evidence, the tool failed, or the budget ended too early.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost is behavior because budget controls search. A loop limited to 4 turns might read one file, patch once, and run one test. A loop with 20 turns can inspect callers, reproduce the bug, try a narrower patch, and run regression checks, but it spends more tokens and wall time.',
        'The complexity cost is in the contracts, not the model call. Tool grammars, timeouts, sandboxing, output truncation, patch application, stop rules, and verifier selection all change outcomes. A benchmark comparison that omits those details is not reproducible.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A minimal coding-agent loop is useful as a baseline for software-repair benchmarks, repository automation, and scaffold debugging. It fits tasks where the repository itself can provide evidence through search, tests, type checks, and diffs. The access pattern is iterative: inspect, act, observe, and repair.',
        'It is also useful when evaluating larger agents. If a planner, retriever, memory store, or critic improves performance, the clean baseline helps isolate why. Without that baseline, a large scaffold can win for accidental reasons such as privileged tests or benchmark-specific prompts.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The minimal loop fails on tasks that require long-horizon project memory, broad design negotiation, multiple independent hypotheses, human approval, or coordination across services. The transcript can become too large or noisy for the next turn to use well. At that point, extra structure may be justified.',
        'It also fails when the environment cannot provide a trustworthy verifier. Some product changes require visual checks, manual review, or production-like data. A small loop can still edit files, but it cannot prove correctness if the proof surface is absent.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A bug report says a parser crashes on empty input. Turn 1 searches for the parser and finds parseValue in parser.js. Turn 2 runs npm test -- parser and gets a stack trace showing input[0] is undefined. Turn 3 adds an empty-input guard and runs the focused test again.',
        'The numbers matter. The run used 3 model turns, 2 shell commands, 1 file edit, and 1 verifier command. If the test passes, the transcript proves what changed and why. If it fails, the same transcript shows whether the patch was wrong or the verifier revealed a deeper case.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are mini-SWE-agent at https://github.com/SWE-agent/mini-swe-agent, SWE-agent documentation at https://swe-agent.com/latest/, the SWE-agent paper at https://arxiv.org/abs/2405.15793, and SWE-bench at https://www.swebench.com/. Use these sources for mechanism claims before relying on secondary summaries.',
        'Study Agentic AI Patterns, Coding Agent Edit Grammar Adapter, Abstract Agent Operation Graph, Terminal-Bench Long-Horizon Agent Case Study, Process Reward Models and Verifier Search, and repository-specific test selection next. Start with the topic that explains the data shape, then move to the production system.',
      ],
    },
  ],
};