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
      heading: 'What it is',
      paragraphs: [
        'mini-SWE-agent is useful as a case study because it strips a coding agent down to the central loop: maintain context, ask a model for an action, execute that action in an environment, append the observation, enforce budget, and decide when to submit. Its lesson is not that scaffolds do not matter. The lesson is that a small scaffold with clean contracts can be extremely revealing.',
        'This topic links Abstract Agent Operation Graph, Coding Agent Edit Grammar Adapter Case Study, and Agent Harness Portability Audit. A minimal loop still depends on operation vocabulary, edit binding, environment isolation, and verifier proof.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The essential structures are a message history, tool schema, environment handle, working-directory state, current diff, observation record, budget counter, stop predicate, final patch record, and verifier result. If those fit on a page, the agent is easier to reason about.',
        'A small control loop is also a good audit baseline. When a heavier system beats it, the team can ask which added component helped: planner, memory, search, verifier, edit adapter, retrieval, or budget policy. Without that baseline, complexity can hide regressions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The loop begins with an issue and environment. The prompt includes instructions and current state. The model emits a tool action. The environment executes it and returns an observation. The scaffold updates cost and state, then repeats until the model submits or the budget ends. A verifier scores the final patch or environment state.',
        'The important engineering detail is boundary discipline. The model can propose actions, but the scaffold parses, rejects malformed actions, executes inside the allowed environment, truncates or summarizes observations, and records evidence. That division is what turns a chat transcript into an agent system.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A minimal agent receives a GitHub issue. It searches the repository, reads two files, edits a failing branch, runs tests, observes one failure, patches a second file, reruns tests, and submits the final diff. The trace stores every action, output digest, cost, current diff, and final verifier result.',
        'That trace can be replayed under Agent Harness Portability Audit. If the same loop fails only when edit grammar or shell changes, the missing component is an adapter or environment-randomization curriculum, not necessarily a smarter planner.',
      ],
    },
    {
      heading: 'Pitfalls and sources',
      paragraphs: [
        'Do not confuse small code with small system surface. The environment, model endpoint, tool schema, budget, benchmark harness, and verifier are all part of the scaffold. Do not report a scaffold score without naming those contracts. Do not let a simple loop become an unlogged black box.',
        'Primary sources: mini-SWE-agent at https://github.com/SWE-agent/mini-swe-agent, SWE-agent docs at https://swe-agent.com/latest/, SWE-agent paper at https://arxiv.org/abs/2405.15793, SWE-bench official site at https://www.swebench.com/, and CWM at https://arxiv.org/abs/2510.02387. Study Agentic AI Patterns: Planning, Tools, Memory, Abstract Agent Operation Graph, Coding Agent Edit Grammar Adapter Case Study, Agent Harness Portability Audit, Terminal-Bench Long-Horizon Agent Case Study, and Process Reward Models & Verifier Search next.',
      ],
    },
  ],
};
