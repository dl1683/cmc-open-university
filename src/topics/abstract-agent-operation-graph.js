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
    explanation: 'A portable coding agent should learn operations such as inspect, localize, edit, run, observe, and submit. The exact shell command is a binding, not the concept, so the same plan can survive a new editor, runner, or typed tool.',
    invariant: 'Train the operation; bind the tool late.',
  };

  yield {
    state: opGraph('Retry is a typed edge, not a transcript habit'),
    highlight: { active: ['run', 'observe', 'decide', 'localize', 'e-run-observe', 'e-observe-decide', 'e-decide-localize'], compare: ['submit'] },
    explanation: 'When tests fail, the graph loops through observe and localize again. Encoding retry as a typed edge preserves the reason for the loop, while a transcript only preserves the particular command sequence used in one harness.',
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
    explanation: 'The binding layer maps abstract intent to the available tool surface. Bash, IDE APIs, and typed tools should return normalized observations, so the planner learns the operation and the runtime handles the wrapper.',
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
      heading: 'Why this exists',
      paragraphs: [
        `Tool-using agents can overfit to an interface. A coding model may learn that a certain search command, patch format, test wrapper, or final-answer ritual gets rewarded. Move the same model to a new editor, a typed tool API, or a different runner, and the apparent skill can weaken. The model knew a script of surface moves, not the durable operation behind them.`,
        `An abstract agent operation graph separates intent from tool grammar. It represents inspect, search, read, edit, run, observe, retry, and submit as typed operations before those operations bind to bash, an IDE API, MCP tools, browser automation, or a repository service. The graph is a data structure for the work the agent is trying to perform, not just a transcript of how one environment happened to expose tools.`,
        `This matters for training, benchmarking, audit, replay, and tool migration. If two agents both fix a bug, a raw command log may make them look unrelated. One used rg and apply_patch. Another used symbol search and a workspace edit call. The operation graph can show that both inspected the goal, localized the same file, edited the same logical region, ran a check, observed a failure, repaired the edit, and submitted after evidence improved.`,
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        `The obvious representation is the raw transcript. Store the prompt, commands, tool calls, patches, stdout, stderr, failures, and final answer. This is easy to collect because it is exactly what the runtime observed. It is also useful evidence. You should not throw it away.`,
        `The wall is that transcripts mix intent, syntax, state, and accident. Was the agent localizing a bug, or only using a memorized search string? Did it make a safe edit, or only satisfy one patch parser? Did a rerun mean uncertainty, flaky tests, or a planned verification loop? A command log records the move, but it often does not record why the move was valid.`,
        `Raw transcripts are also brittle across environments. A terminal command, an IDE method, and a typed repository tool may all implement file reading. If the training record treats them as unrelated strings, the agent has to relearn the same operation for every interface. If the record treats them as bindings of one abstract read operation, the durable skill becomes easier to compare and transfer.`,
        `The goal is not to hide concrete detail. The goal is to keep both layers: the abstract operation that says what the agent meant to do, and the concrete binding that says exactly what happened in this run.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Represent agent work as a graph of abstract operations. Each node names an intent, typed inputs, expected observations, preconditions, postconditions, side-effect class, cost, and failure modes. Edges explain control flow: inspect leads to localize, localize leads to read, read leads to edit, edit leads to run, failed run leads back to localize or edit, verified change leads to submit.`,
        `The binding layer is late. It maps read_file to a shell command, an editor buffer API, a repository service, or an MCP tool after checking what is available. The planner should learn the operation. The runtime should know the local wrapper and return a normalized observation.`,
        `The invariant is semantic preservation across bindings. If two bindings implement the same operation contract and return equivalent normalized observations, the higher-level graph can compare them even when the concrete calls differ. That does not mean the calls are identical. It means they satisfy the same contract from the planner's point of view.`,
        `A good operation graph is also explicit about control edges. Retry is not just doing more work. It is a typed loop caused by an observation that failed a postcondition. Submit is not just the final message. It is an operation with preconditions: enough evidence has been gathered, known failures have been addressed or disclosed, and the claimed outcome matches the checks that ran.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The operation-graph view teaches the control loop. Goal inspection produces a state to investigate. Localization chooses files or symbols. Editing changes the workspace. Running a check produces an observation. Decision nodes route the agent either back into the loop or toward submission. The important feature is the edge reason, not the number of commands.`,
        `The retry edge is the main lesson. It records that an observation failed a postcondition and sent the agent back to localization or editing. Without that typed edge, a transcript can make deliberate repair, flailing, and flaky reruns look the same.`,
        `The binding-layer view teaches portability. Compare rows instead of columns. The row is the durable operation: read, edit, run, or search. The columns are concrete tool surfaces. A shell, an IDE, and a typed tool can all expose the same row if their inputs, outputs, and side effects are mapped into the same schema.`,
        `The normalized result and trace nodes remind you not to erase evidence. The graph should record the abstract operation, the actual call, the raw output, and the normalized observation. The abstraction is useful only if an auditor can still recover what really happened.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start with a small vocabulary. inspect_goal extracts requirements and constraints. search_repo returns candidate files, symbols, and evidence spans. read_file returns content plus version metadata. edit_file returns an applied diff or a structured failure. run_check returns exit status, stdout, stderr, timing, and side-effect notes. observe_result classifies what the output means. submit packages the final claim and evidence.`,
        `Each operation has a schema and a contract. Inputs define what the operation needs. Preconditions say when the call is valid. Postconditions say what changed or what evidence was produced. Failure states are named rather than left as free text. For example, edit_file can fail because the file changed, the patch did not apply, the target path is outside scope, or the diff would overwrite protected content.`,
        `Normalized observations make different tool surfaces comparable. A failing pytest run and a failing IDE test panel can both become a run_check observation with status failed, failing test names, locations when available, stdout, stderr, duration, and side-effect notes. The raw output remains attached, but the planner and evaluator can reason over stable fields.`,
        `The graph also records budgets and risk. A search operation may be cheap. A full integration test may take minutes. A command may touch the network, write generated files, or require secrets. If those facts are part of the operation metadata, the planner can choose a lower-risk path and the audit can explain why a costly step was or was not run.`,
      ],
    },
    {
      heading: 'Binding and portability',
      paragraphs: [
        `Binding is the step that turns an abstract operation into an available call. In one environment, search_repo may bind to rg. In another, it may bind to an indexed code-search API. In a third, it may bind to a language-server symbol query. The operation contract says what counts as a valid search result: paths, spans, match text, ranking if available, and errors if the search failed.`,
        `Late binding lets the same plan survive tool changes. The agent can ask to read a file span without needing to know whether the environment will use a shell command, a file API, or a remote repository call. The runtime checks capability, performs the call, and returns a normalized observation.`,
        `Portability depends on honest metadata. If one binding searches ignored files and another does not, they are not equivalent unless that difference is recorded. If one edit binding is textual and another is AST-aware, they have different safety properties. The graph should not pretend two tools are the same merely because they share a friendly operation name.`,
        `The concrete call still matters for replay. A later audit may need the exact command, working directory, file version, patch content, tool version, and raw output. The abstract graph makes runs comparable; the concrete binding makes them reproducible.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The graph works because it separates three questions that raw transcripts often blur. What was the agent trying to do? Which tool binding performed it? What observation came back? Keeping those layers separate makes it possible to diagnose failures without guessing from command order alone.`,
        `If a task fails, the graph can point to the failure class. The plan may have chosen the wrong file. The binding may have been unavailable. The tool may have returned an error. The observation may have been misread. The postcondition may have been too weak. The final answer may have claimed more than the evidence supported. These are different problems, and each needs a different fix.`,
        `The structure also supports learning. Training examples can emphasize operation choice and control flow instead of memorized command strings. Benchmarks can score whether the agent performed necessary operations, respected scope, verified changes, and handled failures, even when different environments expose different tool names.`,
        `Correctness here is not mathematical proof that the agent solved the user request. It is a contract for representing and auditing the agent's work. The graph makes the evidence inspectable and the failure path easier to locate.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Consider a bug report: the checkout button crashes when the cart is empty. A raw transcript might show a search command, two file reads, a patch, a failed test, another patch, and a passing targeted test. The operation graph represents the same work as inspect_goal, search_repo, read_file, edit_file, run_check, observe_failure, edit_file, run_check, and submit.`,
        `In a terminal, search_repo may bind to a text search command. read_file may bind to a file print command. edit_file may bind to a patch tool. run_check may bind to npm test with a file filter. In an IDE, those same nodes may bind to symbol search, editor buffers, workspace edits, and a test panel. The graph says the durable work was the same: localize, inspect, edit, verify, repair, verify again.`,
        `The failure observation matters. Suppose the first test run fails because an import path changed. The edge back to edit_file should record that the prior edit broke a dependency, not that the agent randomly tried another patch. The second run then satisfies the postcondition for the targeted check. The final submit operation can claim the targeted check passed, but it should not claim that the entire suite passed if only one test was run.`,
        `That last sentence is why operation graphs are useful for honest reporting. They connect final claims to the evidence that actually exists.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The cost is schema discipline. Tool designers must define capabilities, arguments, observable results, side effects, budgets, and failure states. That takes more work than dumping logs. It also requires versioning because operation contracts will change as tools become richer.`,
        `Trace storage gets larger, not smaller. A serious record keeps the abstract operation, normalized observation, concrete call, raw output, timestamps, file versions, and sometimes screenshots or artifacts. The graph is an index over evidence, not a replacement for evidence.`,
        `The abstraction can hide facts if it is too friendly. A name such as run_check may mutate files, hit the network, consume a paid budget, or depend on flaky state. If side effects and uncertainty are missing, the graph becomes a cleaner transcript that lies by omission.`,
        `There is also a modeling risk. If the vocabulary is too broad, every action becomes do_task and nothing is learned. If it is too narrow, the graph recreates tool syntax under new names. The useful middle layer names operations that humans already recognize in task work: inspect, localize, edit, verify, decide, and report.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `This graph wins in benchmark environments, agent training data, tool migration, replay systems, audit logs, and multi-environment coding assistants. It lets a team test whether a model learned task operations or only the quirks of one terminal.`,
        `It is useful when comparing agents across different tools. One agent may solve a task through shell commands. Another may solve it through typed APIs. A third may use a browser and an editor. Operation graphs let evaluators compare the reasoning path and evidence without pretending the surfaces are identical.`,
        `It also improves failure analysis. A bad localization decision, invalid edit, unavailable capability, parser mismatch, flaky test, and premature submit are different bugs. They need different training examples and different runtime guards.`,
        `For product systems, the graph can support permission checks. A runtime can deny an operation before binding if the preconditions fail, the path is outside scope, the command is too risky, or the budget is exhausted. The planner sees a structured failure instead of an ambiguous tool error.`,
      ],
    },
    {
      heading: 'Limits and failure cases',
      paragraphs: [
        `It is too much structure for a one-off script where the concrete command is the whole task. If the work is small, stable, and never reused for training, replay, or audit, a log may be enough.`,
        `It also fails when the operation vocabulary is vague. run, fix, and verify are not contracts unless they define inputs, outputs, side effects, and success conditions. A graph with vague nodes gives the appearance of rigor while preserving little useful information.`,
        `It is not a safety boundary. A malicious tool result can still lie. A prompt can still push the agent toward a bad action. A normalized observation can still omit the one detail needed for debugging. Capability discovery, trust policy, sandboxing, and human review remain runtime concerns.`,
        `The graph can also become stale. If a binding changes behavior but keeps the same operation label, old assumptions break. If a new tool returns richer output and the schema drops it, the system loses signal. Operation contracts need tests and versioning like any other API.`,
        `Another failure case is premature abstraction. Teams may design a grand vocabulary before studying real agent work. Better practice is to collect traces, identify repeated operation shapes, define a small stable vocabulary, and revise it when real failures expose missing distinctions.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Start with a small operation set and make each operation boringly explicit. For each one, write down inputs, preconditions, outputs, postconditions, side effects, failure states, and cost fields. Avoid names that describe intentions too broadly. edit_file is useful only if it says what kind of edit, what target version, and what result proves the edit landed.`,
        `Keep raw and normalized data together. If stderr, changed files, timing, warnings, or generated artifacts disappear during normalization, the abstract record may look successful while the concrete run was fragile. The normalized fields should help search and compare; they should not be the only evidence.`,
        `Test bindings with contract fixtures. A read binding should return the same content and version metadata through every supported surface. An edit binding should report clean apply, conflict, out-of-scope path, and stale-file cases. A run_check binding should preserve exit status, failure names, output, duration, and side-effect notes.`,
        `Make final reporting depend on graph evidence. If the graph contains only a targeted check, the final claim should say targeted check. If no check ran, the final claim should say that. The graph is most valuable when it prevents the agent from overstating what it knows.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Model Context Protocol tool definitions for concrete schema design, especially tool names, input schemas, output schemas, structured content, and tool-result error reporting. Study SWE-agent for agent-computer interfaces, ReAct for reasoning and acting loops, and Toolformer for learning to call tools.`,
        `Inside this curriculum, study Agentic AI Patterns: Planning, Tools, Memory for the control loop, Verified Agent Trajectory Store for replayable evidence, Dynamic Scratchpad Execution Trace Case Study for intermediate reasoning state, Constrained Decoding for schema control, and Model Context Protocol Case Study for a concrete tool protocol.`,
      ],
    },
  ],
};
