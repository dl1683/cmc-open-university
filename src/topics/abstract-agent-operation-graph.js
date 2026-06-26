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
  const graph = opGraph('A coding fix as abstract operations');
  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;
  const ops = ['inspect', 'localize', 'edit', 'run', 'observe', 'submit'];

  yield {
    state: graph,
    highlight: { active: ['goal', 'inspect', 'localize', 'edit', 'run', 'observe', 'decide', 'e-goal-inspect', 'e-inspect-localize', 'e-localize-edit', 'e-edit-run', 'e-run-observe', 'e-observe-decide'], found: ['submit'] },
    explanation: `A portable coding agent should learn ${ops.length} operations: ${ops.join(', ')}. The graph has ${nodeCount} nodes and ${edgeCount} edges. The exact shell command is a binding, not the concept, so the same plan can survive a new editor, runner, or typed tool.`,
    invariant: `Train the operation across all ${nodeCount} nodes; bind the tool late.`,
  };

  const retryEdge = graph.edges.find(e => e.id === 'e-decide-localize');
  const doneEdge = graph.edges.find(e => e.id === 'e-decide-submit');

  yield {
    state: opGraph('Retry is a typed edge, not a transcript habit'),
    highlight: { active: ['run', 'observe', 'decide', 'localize', 'e-run-observe', 'e-observe-decide', 'e-decide-localize'], compare: ['submit'] },
    explanation: `When tests fail, the graph loops through observe and localize again via the "${retryEdge.weight}" edge from ${retryEdge.from} to ${retryEdge.to}. The "${doneEdge.weight}" edge leads to ${doneEdge.to}. Encoding retry as a typed edge preserves the reason for the loop, while a transcript only preserves the particular command sequence used in one harness.`,
  };

  const vocabRows = [
    { id: 'read', label: 'read' },
    { id: 'edit', label: 'edit' },
    { id: 'run', label: 'run' },
    { id: 'test', label: 'test' },
    { id: 'submit', label: 'submit' },
  ];
  const vocabCols = [
    { id: 'state', label: 'state' },
    { id: 'output', label: 'output' },
    { id: 'risk', label: 'risk' },
  ];
  const vocabData = [
    ['path+span', 'contents', 'stale file'],
    ['patch intent', 'diff', 'bad apply'],
    ['cmd+cwd', 'stdout', 'side effect'],
    ['suite', 'pass/fail', 'flaky'],
    ['candidate', 'final diff', 'premature'],
  ];

  yield {
    state: labelMatrix('Operation vocabulary', vocabRows, vocabCols, vocabData),
    highlight: { active: ['read:state', 'edit:state', 'run:state', 'test:state'], found: ['submit:risk'] },
    explanation: `A small operation vocabulary of ${vocabRows.length} rows and ${vocabCols.length} columns makes traces comparable. Each operation (${vocabRows.map(r => r.label).join(', ')}) has typed inputs, normalized outputs, and known risks like "${vocabData[4][2]}" for the ${vocabRows[4].label} row.`,
  };
}

function* bindingLayer() {
  const bGraph = bindingGraph('One operation can bind to many tool surfaces');
  const bNodeCount = bGraph.nodes.length;
  const bEdgeCount = bGraph.edges.length;
  const surfaces = bGraph.nodes.filter(n => ['bash', 'ide', 'mcp'].includes(n.id));

  yield {
    state: bGraph,
    highlight: { active: ['op', 'schema', 'bash', 'ide', 'mcp', 'e-op-schema', 'e-schema-bash', 'e-schema-ide', 'e-schema-mcp'], found: ['result', 'trace'] },
    explanation: `The binding layer maps abstract intent to ${surfaces.length} tool surfaces: ${surfaces.map(s => s.label).join(', ')}. With ${bNodeCount} nodes and ${bEdgeCount} edges, the graph shows that all surfaces return normalized observations, so the planner learns the operation and the runtime handles the wrapper.`,
  };

  const harnessRows = [
    { id: 'read', label: 'read' },
    { id: 'edit', label: 'edit' },
    { id: 'run', label: 'run' },
    { id: 'search', label: 'search' },
  ];
  const harnessCols = [
    { id: 'bash', label: 'bash' },
    { id: 'ide', label: 'IDE' },
    { id: 'typed', label: 'typed tool' },
  ];
  const harnessData = [
    ['cat/sed', 'open file', 'read_file'],
    ['patch', 'edit buffer', 'apply_patch'],
    ['npm test', 'task runner', 'run_tests'],
    ['rg', 'symbols', 'search_repo'],
  ];

  yield {
    state: labelMatrix('Same operation, different harness', harnessRows, harnessCols, harnessData),
    highlight: { active: ['edit:bash', 'edit:ide', 'edit:typed'], compare: ['run:bash', 'run:typed'] },
    explanation: `If the model memorizes one column out of ${harnessCols.length} harnesses, it breaks when the interface changes. If it learns the row (${harnessRows.map(r => r.label).join(', ')}), it can bind to the current tools. For example, "${harnessRows[1].label}" maps to "${harnessData[1][0]}" in bash but "${harnessData[1][2]}" as a typed tool.`,
  };

  const portRows = [
    { id: 'cap', label: 'capability' },
    { id: 'pre', label: 'precond' },
    { id: 'post', label: 'postcond' },
    { id: 'obs', label: 'obs schema' },
    { id: 'cost', label: 'cost' },
  ];
  const portCols = [
    { id: 'records', label: 'records' },
    { id: 'why', label: 'why' },
  ];
  const portData = [
    ['what tool can do', 'late bind'],
    ['required state', 'avoid invalid call'],
    ['state change', 'verify result'],
    ['normalized fields', 'compare traces'],
    ['time+tokens+risk', 'budget path'],
  ];

  yield {
    state: labelMatrix('Portability metadata', portRows, portCols, portData),
    highlight: { found: ['cap:why', 'post:why', 'obs:why', 'cost:why'] },
    explanation: `A portable trace records ${portRows.length} metadata fields (${portRows.map(r => r.label).join(', ')}). Each field has ${portCols.length} columns: ${portCols.map(c => c.label).join(' and ')}. That metadata lets an audit distinguish bad reasoning from a bad tool binding.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'operation graph') yield* operationGraph();
  else if (view === 'binding layer') yield* bindingLayer();
  else throw new InputError(`Pick an abstract-operation view, not "${view}".`);
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The operation-graph view shows a directed graph where each node is an abstract operation (inspect, locate, edit, run, observe, decide, submit) and each edge is a typed control-flow transition. Highlighted nodes are the operations active in the current step. The "retry" edge from decide back to locate is the key structure: it records that a postcondition failed, not just that the agent did more work. The "done" edge to submit records that evidence was sufficient.',
        'The binding-layer view shows the same abstract operation fanning out to three tool surfaces (bash, IDE API, typed tool). All three paths converge on a single normalized result node, which feeds a trace node. The lesson is that the operation is durable and the tool surface is interchangeable.',
        {type: 'image', src: './assets/gifs/abstract-agent-operation-graph.gif', alt: 'Animated walkthrough of the abstract agent operation graph visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Use the view selector to switch between the operation graph and the binding layer. Step through slowly the first time; the edge labels carry most of the meaning.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A coding agent performs a handful of durable operations: read a file, search a codebase, edit source, run a check, observe the result, decide whether to retry or submit. These operations exist regardless of which shell, editor, or tool protocol exposes them. But today, agent behavior is recorded as raw transcripts: sequences of tool calls tied to one specific environment.',
        'The problem is that transcripts couple intent to interface. An agent trained on terminal transcripts may learn that rg followed by sed followed by npm test is the shape of a bug fix. Move that agent to an IDE with workspace.applyEdit and testRunner.run, and the memorized sequence breaks even though the underlying work is identical.',
        'An abstract agent operation graph is a data structure that separates what the agent is trying to do from how one environment happens to expose tools. It represents inspect, locate, edit, run, observe, retry, and submit as typed nodes in a directed graph, with edges that record control flow and the reasons behind transitions. The concrete tool calls become a late-bound layer underneath.',
        {type: `callout`, text: `An operation graph makes agent behavior portable by storing intent, evidence, and control flow before any tool grammar is chosen.`},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious way to record agent behavior is the raw transcript. Capture every prompt, tool call, argument, stdout, stderr, patch, and final answer exactly as the runtime observed them. This is easy to collect, cheap to store, and valuable evidence. You should keep it.',
        'Transcripts work well when the environment is fixed. If every agent uses the same shell, the same test runner, and the same patch format, you can compare transcripts directly. Two agents that both ran rg "handleCheckout" followed by npm test are doing recognizably similar work.',
        'For a single-environment benchmark with 500 tasks, raw transcripts are sufficient. You can diff them, count tool calls, measure time to solution, and score pass rates without any abstraction layer.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Transcripts mix intent, syntax, environment state, and accident into one flat sequence. Three specific problems emerge as soon as you cross environment boundaries.',
        'First, the same operation looks unrelated across tool surfaces. Agent A runs rg "cartEmpty" src/ and agent B calls workspace.findSymbol("cartEmpty"). Both are searching the repo for a symbol. A transcript-level comparison treats them as completely different actions because the strings share nothing. Multiply this across read, edit, run, and submit operations, and two agents solving the same bug in different environments produce transcripts with zero overlap.',
        'Second, control flow is invisible. A transcript shows that the agent ran a test, then edited a file, then ran the test again. Was the second run a retry after a failed postcondition, a planned verification step, or a flaky-test rerun? The transcript cannot say, because it records the sequence of moves without recording why each transition happened. An evaluator who sees three consecutive test runs has to guess whether the agent was stuck, careful, or unlucky.',
        'Third, transcripts do not record what the agent meant versus what happened. If an edit was intended to fix a null check but accidentally broke an import, the transcript shows the patch content but not the gap between intent and outcome. The failure analysis has to reconstruct intent from surrounding context, which is fragile and sometimes impossible.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent agent work as a directed graph of typed operations. Each node carries a name, a schema (typed inputs and outputs), preconditions that must hold before the call is valid, postconditions that define what success looks like, a side-effect class (read-only, file-mutating, network-touching), a cost estimate, and named failure states. Edges carry control flow with explicit reasons: "postcondition failed" sends decide back to locate, "evidence sufficient" sends decide to submit.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg`, alt: `Directed graph with nodes connected by arrows`, caption: `A directed graph is the right base visual for typed operation nodes and retry or submit edges. Source: Wikimedia Commons, David W., public domain.`},
        'The binding layer is late and separate. When the graph says read_file, the runtime checks what tool surface is available (cat, editor buffer API, repository service, MCP read_file tool), performs the concrete call, and returns a normalized observation with stable fields: content, path, byte length, version hash, error if any. The planner never sees the concrete call. The trace preserves it for replay.',
        'The invariant is semantic preservation: if two bindings implement the same operation contract and return equivalent normalized observations, the graph treats them as interchangeable from the planner\'s perspective. This does not mean the concrete calls are identical. It means they satisfy the same contract, so the planner\'s reasoning about what happened remains valid regardless of which tool surface executed the work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The system has three layers: the operation vocabulary, the graph structure, and the binding registry.',
        'The operation vocabulary is a small, stable set of typed operations. A practical starting set has 7 operations: inspect_goal (extract requirements from the task description, output: structured constraints), search_repo (find files or symbols matching a query, output: ranked paths with match spans), read_file (return content at a path and version, output: text plus version hash), edit_file (apply a structured change, output: applied diff or named failure), run_check (execute a verification command, output: exit status, stdout, stderr, duration, side-effect notes), observe_result (classify what the output means, output: pass/fail/partial with evidence), and submit (package the final claim with supporting evidence, output: candidate diff plus evidence summary).',
        'Each operation has named failure states instead of free-text errors. edit_file can fail with stale_file (the target changed since the last read), bad_apply (the patch does not match the content), out_of_scope (the path is outside the allowed workspace), or protected_content (the edit would overwrite a guarded region). These names let the planner react specifically: stale_file triggers a re-read, bad_apply triggers a re-localize, out_of_scope aborts that path.',
        'The graph structure connects operations with typed edges. A forward edge from edit to run_check means "change was applied, now verify." A backward edge from decide to locate means "postcondition failed, re-localize the problem." A terminal edge from decide to submit means "evidence is sufficient." Each edge carries metadata: the postcondition that was checked, whether it passed, and the observation that triggered the transition.',
        'The binding registry maps each abstract operation to available tool surfaces. For search_repo, the registry might list: rg (bash binding, precondition: rg installed), workspace.findFiles (IDE binding, precondition: workspace open), search_repo MCP tool (typed binding, precondition: MCP server connected). At runtime, the dispatcher picks the first available binding, executes the concrete call, and normalizes the result into the operation\'s output schema.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The graph works because it separates three questions that raw transcripts blur into one sequence. What was the agent trying to do? (The operation node.) Which tool performed it? (The binding.) What observation came back? (The normalized result.) Keeping these layers distinct makes failure diagnosis precise rather than archaeological.',
        'Correctness of the representation rests on a contract argument, not a proof that the agent solved the task. The claim is: if every operation node faithfully records its preconditions, the binding faithfully executes the contract, and the normalized observation faithfully reflects the raw output, then the graph is a reliable record of what the agent did and why. An auditor can trace any final claim back through the evidence chain without guessing.',
        'The retry edge is the strongest correctness feature. In a transcript, three consecutive test runs are ambiguous. In the graph, each run_check node has a postcondition result, and the edge back to locate carries the specific failure that triggered the retry. This makes the difference between deliberate repair (postcondition "import exists" failed, agent re-localized) and flailing (same edit applied three times with no change in observation) structurally visible.',
        'The submit operation enforces honest reporting. Its preconditions require that the evidence gathered (which checks ran, which passed, which failed) matches the claim being made. If the graph shows only a targeted test passed, the submit node cannot claim the full suite passed without violating its contract. The structure prevents the agent from overstating what it knows.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The direct cost is schema discipline. Each operation needs a defined input schema, output schema, precondition set, postcondition set, failure states, and cost metadata. For a 7-operation vocabulary, that is roughly 7 schema definitions, each with 4-6 failure states. Writing and maintaining these schemas takes more work than dumping logs, but the set is small and changes slowly.',
        'Trace storage grows rather than shrinks. A complete record stores the abstract operation (roughly 200 bytes of structured metadata), the normalized observation (varies: a search result might be 2 KB, a test output might be 50 KB), the concrete call (the actual command string plus arguments, typically under 1 KB), and the raw output (unbounded, but usually 1-100 KB per step). For a 15-step bug fix, expect 50-500 KB of trace data versus 10-100 KB for a raw transcript. The graph is an index over evidence, not a replacement for it.',
        'Runtime overhead is negligible. The binding dispatch is a registry lookup (microseconds). Normalization parses the raw output into structured fields, which is comparable to the log-parsing that transcript-based systems already do. The graph construction itself is just appending nodes and edges to an in-memory structure.',
        'The real cost is getting the abstraction level right. If the vocabulary is too coarse (every action is do_task), the graph records nothing useful. If it is too fine (separate operations for grep, rg, ag, and find), the graph recreates tool syntax under new names. The useful middle layer has 5-10 operations that humans already recognize in task work: inspect, search, read, edit, run, observe, decide, submit. When the vocabulary doubles, something has gone wrong.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Agent benchmarks are the most immediate application. SWE-bench evaluates coding agents across hundreds of real GitHub issues. If two agents solve the same issue using different tool surfaces, operation graphs let the evaluator compare reasoning paths (did both agents localize correctly? did both verify their changes?) without requiring identical tool call sequences. The graph turns "did it pass?" into "how did it pass, and what evidence supports the result?"',
        'Training data curation benefits directly. An operation graph can label each trajectory with the operations performed, making it possible to filter for trajectories that include verification (run_check followed by observe with a passing postcondition) versus those that submit without checking. Training on verified trajectories produces agents that verify; training on transcripts that happen to contain test commands does not guarantee the agent understood why it ran them.',
        'Tool migration becomes tractable. When a coding assistant moves from shell-based tools to MCP-typed tools, the operation graph stays the same. The binding registry gets new entries. The planner, the evaluator, and the audit trail do not change. Without the graph, a tool migration means rewriting evaluation logic, retraining on new transcripts, and losing comparability with historical data.',
        'Runtime permission systems can use operation metadata to enforce policy before binding. If a run_check operation declares side-effect class "network-touching" and the sandbox policy forbids network access, the runtime rejects the operation before any concrete command executes. The planner receives a structured failure (permission_denied on run_check) instead of a cryptic shell error, and can choose an alternative path.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The graph is overhead without payoff for one-off scripts in a single, stable environment. If the agent always uses the same shell, always runs the same test command, and never needs to be compared to other agents or audited, a raw log is simpler and sufficient.',
        'Vague operation contracts destroy the value. If run_check does not define what "pass" means (exit code 0? all assertions green? no stderr output?), the postcondition is meaningless and the retry edge carries no real information. The graph looks structured while preserving nothing that a transcript did not already have. Every operation must define inputs, outputs, side effects, and named failure states, or the abstraction is theater.',
        'The graph is not a safety boundary. A malicious tool can return a normalized observation that says "pass" when the real output says "fail." A prompt injection can push the agent toward a dangerous operation. The graph records what the agent claimed to do, not whether the claims are trustworthy. Sandboxing, capability restriction, and human review remain separate concerns.',
        'Premature vocabulary design is a common failure mode. Teams design a grand operation taxonomy before studying real agent traces. The useful path is the reverse: collect 100+ raw traces, identify the 5-8 recurring operation shapes, define contracts for those, and revise when real failures expose missing distinctions. Start with inspect, search, read, edit, run, observe, submit. Add operations only when a real trace forces a split.',
        'Schema staleness is the long-term risk. If a tool binding changes behavior (a new test runner returns richer output) but the operation contract does not update, the normalization layer drops signal. Operation contracts need version numbers and compatibility tests, exactly like any other API.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Bug report: "Checkout button crashes when the cart is empty." The agent works in a terminal environment. Here is the raw transcript: (1) rg "handleCheckout" src/ returns 3 matches in src/checkout.js at lines 14, 45, 89. (2) cat src/checkout.js lines 40-55 shows that line 45 calls cart.items.length without a null check. (3) The agent writes a patch adding if (!cart.items) return; before line 45. (4) npm test -- checkout.test.js fails: "Cannot find module ./cart-utils." (5) The agent reads the error, realizes the patch accidentally deleted an import line. (6) The agent writes a second patch restoring the import and keeping the null check. (7) npm test -- checkout.test.js passes: 4/4 assertions green. (8) The agent submits.',
        'The operation graph for the same work has 9 nodes. Node 1: inspect_goal, input: issue text, output: constraint "cart.items may be null at checkout." Node 2: search_repo, input: query "handleCheckout", output: 3 file:line results. Node 3: read_file, input: src/checkout.js lines 40-55, output: content plus version hash abc123. Node 4: edit_file, input: add null guard at line 45, output: diff applied, new version hash def456. Node 5: run_check, input: npm test -- checkout.test.js, output: status failed, error "Cannot find module ./cart-utils", duration 2.3s. Node 6: observe_result, classification: postcondition "tests pass" failed, failure type: broken_dependency. Edge from node 6 back to node 4 is typed "retry:broken_dependency." Node 7: edit_file, input: restore import + keep null guard, output: diff applied, version hash ghi789. Node 8: run_check, input: same test command, output: status passed, 4/4 assertions, duration 1.8s. Node 9: submit, precondition check: targeted test passed (4/4), claim: "null guard added, targeted test passes." The submit node does not claim the full suite passed because only checkout.test.js ran.',
        'Now move the same agent to an IDE. Node 2 binds to workspace.findSymbol("handleCheckout") instead of rg. Node 3 binds to editor.openFile instead of cat. Nodes 4 and 7 bind to workspace.applyEdit instead of writing a patch. Nodes 5 and 8 bind to testRunner.run("checkout.test.js") instead of npm test. The 9 operation nodes, their preconditions, postconditions, and the retry edge are identical. The binding column changed; the reasoning path did not.',
        'The graph makes three facts visible that the transcript hides. First, the retry was caused by a specific failure type (broken_dependency), not random flailing. Second, the submit claim is scoped to the evidence that exists (targeted test, not full suite). Third, the two environments performed the same abstract work despite sharing zero concrete tool call strings.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The Model Context Protocol (MCP) specification defines concrete tool schemas with typed inputs, outputs, and structured error reporting, which is exactly the binding-layer contract this graph depends on. SWE-agent (Yang et al., 2024) introduced the agent-computer interface concept: a curated set of commands that shape how the agent interacts with a codebase. ReAct (Yao et al., 2023) formalized the reasoning-action loop that the operation graph\'s inspect-act-observe cycle generalizes. Toolformer (Schick et al., 2023) showed that language models can learn when and how to call tools, motivating the question of what representation makes that learning portable.',
        'Inside this curriculum, study Agentic AI Patterns: Planning, Tools, Memory for the control loop that operation graphs formalize. Study Verified Agent Trajectory Store for replayable evidence chains that depend on normalized observations. Study Dynamic Scratchpad Execution Trace Case Study for how intermediate reasoning state connects to the observe and decide nodes. Study Constrained Decoding for schema-level control over what the agent can emit, which is the enforcement mechanism for operation contracts. Study Model Context Protocol Case Study for a concrete tool protocol that implements the binding layer.',
      ],
    },
  ],
};
