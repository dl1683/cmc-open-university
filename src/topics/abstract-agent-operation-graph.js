// Abstract agent operation graph: separate what an agent is trying to do
// from the particular tool grammar exposed by one harness.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'abstract-agent-operation-graph',
  title: 'Abstract Agent Operation Graph',
  category: 'AI & ML',
  summary: 'A portability data structure for coding agents: represent read, edit, run, test, and submit as abstract operations before binding them to shell, IDE, or API tools.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['operation graph', 'binding layer'], defaultValue: 'operation graph' },
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

function opGraph(title) {
  return graphState({
    nodes: [
      { id: 'goal', label: 'goal', x: 0.8, y: 3.5, note: 'issue' },
      { id: 'inspect', label: 'inspect', x: 2.4, y: 2.7, note: 'state' },
      { id: 'localize', label: 'locate', x: 4.0, y: 2.7, note: 'files' },
      { id: 'edit', label: 'edit', x: 5.6, y: 3.5, note: 'patch' },
      { id: 'run', label: 'run', x: 4.0, y: 5.2, note: 'check' },
      { id: 'observe', label: 'observe', x: 7.2, y: 5.2, note: 'result' },
      { id: 'decide', label: 'decide', x: 8.7, y: 3.5, note: 'stop?' },
      { id: 'submit', label: 'submit', x: 8.7, y: 2.7, note: 'final' },
    ],
    edges: [
      { id: 'e-goal-inspect', from: 'goal', to: 'inspect' },
      { id: 'e-inspect-localize', from: 'inspect', to: 'localize' },
      { id: 'e-localize-edit', from: 'localize', to: 'edit' },
      { id: 'e-edit-run', from: 'edit', to: 'run' },
      { id: 'e-run-observe', from: 'run', to: 'observe' },
      { id: 'e-observe-decide', from: 'observe', to: 'decide' },
      { id: 'e-decide-localize', from: 'decide', to: 'localize', weight: 'retry' },
      { id: 'e-decide-submit', from: 'decide', to: 'submit', weight: 'done' },
    ],
  }, { title });
}

function bindingGraph(title) {
  return graphState({
    nodes: [
      { id: 'op', label: 'abstract op', x: 1.0, y: 3.6, note: 'intent' },
      { id: 'schema', label: 'schema', x: 2.8, y: 3.6, note: 'args' },
      { id: 'bash', label: 'bash', x: 4.8, y: 1.4, note: 'sed/pytest' },
      { id: 'ide', label: 'IDE API', x: 4.8, y: 3.6, note: 'workspace' },
      { id: 'mcp', label: 'MCP tool', x: 4.8, y: 5.8, note: 'typed' },
      { id: 'result', label: 'normalized result', x: 7.1, y: 3.6, note: 'observation' },
      { id: 'trace', label: 'trace', x: 9.0, y: 3.6, note: 'replay' },
    ],
    edges: [
      { id: 'e-op-schema', from: 'op', to: 'schema' },
      { id: 'e-schema-bash', from: 'schema', to: 'bash' },
      { id: 'e-schema-ide', from: 'schema', to: 'ide' },
      { id: 'e-schema-mcp', from: 'schema', to: 'mcp' },
      { id: 'e-bash-result', from: 'bash', to: 'result' },
      { id: 'e-ide-result', from: 'ide', to: 'result' },
      { id: 'e-mcp-result', from: 'mcp', to: 'result' },
      { id: 'e-result-trace', from: 'result', to: 'trace' },
    ],
  }, { title });
}

function* operationGraph() {
  yield {
    state: opGraph('A coding fix as abstract operations'),
    highlight: { active: ['goal', 'inspect', 'localize', 'edit', 'run', 'observe', 'decide', 'e-goal-inspect', 'e-inspect-localize', 'e-localize-edit', 'e-edit-run', 'e-run-observe', 'e-observe-decide'], found: ['submit'] },
    explanation: 'A portable coding agent should learn operations such as inspect, localize, edit, run, observe, and submit. The exact shell command is a binding, not the concept.',
    invariant: 'Train the operation; bind the tool late.',
  };

  yield {
    state: opGraph('Retry is a typed edge, not a transcript habit'),
    highlight: { active: ['run', 'observe', 'decide', 'localize', 'e-run-observe', 'e-observe-decide', 'e-decide-localize'], compare: ['submit'] },
    explanation: 'When tests fail, the graph loops through observe and localize again. That retry edge should survive a new harness, a new shell, or a new editor API.',
  };

  yield {
    state: labelMatrix(
      'Operation vocabulary',
      [
        { id: 'read', label: 'read' },
        { id: 'edit', label: 'edit' },
        { id: 'run', label: 'run' },
        { id: 'test', label: 'test' },
        { id: 'submit', label: 'submit' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'output', label: 'output' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['path+span', 'contents', 'stale file'],
        ['patch intent', 'diff', 'bad apply'],
        ['cmd+cwd', 'stdout', 'side effect'],
        ['suite', 'pass/fail', 'flaky'],
        ['candidate', 'final diff', 'premature'],
      ],
    ),
    highlight: { active: ['read:state', 'edit:state', 'run:state', 'test:state'], found: ['submit:risk'] },
    explanation: 'A small operation vocabulary makes traces comparable. Each operation has typed inputs, normalized outputs, and known risks.',
  };
}

function* bindingLayer() {
  yield {
    state: bindingGraph('One operation can bind to many tool surfaces'),
    highlight: { active: ['op', 'schema', 'bash', 'ide', 'mcp', 'e-op-schema', 'e-schema-bash', 'e-schema-ide', 'e-schema-mcp'], found: ['result', 'trace'] },
    explanation: 'The binding layer maps abstract intent to the available tool surface. Bash, IDE APIs, and typed tools should return normalized observations so the planner learns the operation, not the wrapper.',
  };

  yield {
    state: labelMatrix(
      'Same operation, different harness',
      [
        { id: 'read', label: 'read' },
        { id: 'edit', label: 'edit' },
        { id: 'run', label: 'run' },
        { id: 'search', label: 'search' },
      ],
      [
        { id: 'bash', label: 'bash' },
        { id: 'ide', label: 'IDE' },
        { id: 'typed', label: 'typed tool' },
      ],
      [
        ['cat/sed', 'open file', 'read_file'],
        ['patch', 'edit buffer', 'apply_patch'],
        ['npm test', 'task runner', 'run_tests'],
        ['rg', 'symbols', 'search_repo'],
      ],
    ),
    highlight: { active: ['edit:bash', 'edit:ide', 'edit:typed'], compare: ['run:bash', 'run:typed'] },
    explanation: 'If the model memorizes one column, it breaks when the interface changes. If it learns the row, it can bind to the current tools.',
  };

  yield {
    state: labelMatrix(
      'Portability metadata',
      [
        { id: 'cap', label: 'capability' },
        { id: 'pre', label: 'precond' },
        { id: 'post', label: 'postcond' },
        { id: 'obs', label: 'obs schema' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'records', label: 'records' },
        { id: 'why', label: 'why' },
      ],
      [
        ['what tool can do', 'late bind'],
        ['required state', 'avoid invalid call'],
        ['state change', 'verify result'],
        ['normalized fields', 'compare traces'],
        ['time+tokens+risk', 'budget path'],
      ],
    ),
    highlight: { found: ['cap:why', 'post:why', 'obs:why', 'cost:why'] },
    explanation: 'A portable trace records capabilities, preconditions, postconditions, observation schemas, and cost. That metadata lets an audit distinguish bad reasoning from a bad tool binding.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'operation graph') yield* operationGraph();
  else if (view === 'binding layer') yield* bindingLayer();
  else throw new InputError('Pick an abstract-operation view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An abstract agent operation graph is a portability layer for tool-using models. It represents actions such as read, search, edit, run, test, observe, retry, and submit as typed operations before binding them to a particular shell command, IDE API, or tool-call schema.',
        'This directly addresses a failure mode in Code World Models Case Study and Verified Agent Trajectory Store. A model can look strong because it learned one harness ritual. The operation graph asks whether it learned the underlying action: inspect state, change state, verify state, and decide what to do next.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The graph has operation nodes, typed edges, preconditions, postconditions, and normalized observations. A read operation takes a path and optional span, then returns content plus version metadata. An edit operation takes a patch intent and returns an applied diff or failure. A run operation takes a command, environment, and budget, then returns exit status, stdout, stderr, timing, and side-effect notes.',
        'The binding layer maps those operations to the actual environment. In one harness, edit may be a unified diff. In another, it may be an IDE workspace edit. In a third, it may be a typed Model Context Protocol tool. The planner should reason over the operation graph while the runtime performs the local binding.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is schema discipline. Tool designers must define capabilities, arguments, observable results, side effects, and failure states. Traces must store both the abstract operation and the concrete binding. That extra structure pays off when evaluating portability: the same plan can be replayed through several tool surfaces and compared by normalized outcomes.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A bug-fixing agent first performs inspect_issue, then search_repo, read_file, edit_file, run_tests, observe_failure, edit_file again, and submit_patch. In bash, those may bind to rg, sed, git diff, and pytest. In an IDE, they bind to symbol search, buffer edits, diagnostic panels, and a test runner. The abstract trace is the same even though the concrete tools differ.',
        'This is the representation the local CWM notes argue for: learn abstract operations that survive environment shifts rather than reward-hacked tool syntax. Agent Harness Portability Audit turns this into a test matrix.',
      ],
    },
    {
      heading: 'Pitfalls and sources',
      paragraphs: [
        'Do not hide important side effects behind a friendly operation name. A run command can mutate files, open network connections, or consume budgets. Do not normalize away details needed for debugging. Do not assume every operation is available in every harness; capability discovery is part of the state.',
        'Primary sources: SWE-agent on agent-computer interfaces at https://arxiv.org/abs/2405.15793, CWM at https://arxiv.org/abs/2510.02387, ReAct at https://arxiv.org/abs/2210.03629, and Toolformer at https://arxiv.org/abs/2302.04761. Study Agentic AI Patterns: Planning, Tools, Memory, Code World Models Case Study, Verified Agent Trajectory Store, Dynamic Scratchpad Execution Trace Case Study, Constrained Decoding, and Model Context Protocol Case Study next.',
      ],
    },
  ],
};
