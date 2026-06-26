// Agent workflow DAG compiler: turn an open-ended agent plan into explicit
// steps, dependencies, approvals, budgets, output contracts, and trace hooks.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'agent-workflow-dag-compiler-case-study',
  title: 'Agent Workflow DAG Compiler Case Study',
  category: 'AI & ML',
  summary: 'A durable-agent workflow case study: compile goals into typed step DAGs, specialist boundaries, tool contracts, approvals, budgets, and traceable runtime plans.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['compile path', 'runtime plan'], defaultValue: 'compile path' },
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

function compilerGraph(title) {
  return graphState({
    nodes: [
      { id: 'goal', label: 'goal', x: 0.6, y: 3.5, note: 'user' },
      { id: 'triage', label: 'triage', x: 2.0, y: 3.5, note: 'agent or flow' },
      { id: 'steps', label: 'steps', x: 3.6, y: 2.0, note: 'nodes' },
      { id: 'deps', label: 'deps', x: 3.6, y: 5.0, note: 'edges' },
      { id: 'policy', label: 'policy', x: 5.2, y: 2.0, note: 'gates' },
      { id: 'budget', label: 'budget', x: 5.2, y: 5.0, note: 'limits' },
      { id: 'dag', label: 'DAG', x: 6.8, y: 3.5, note: 'plan' },
      { id: 'runtime', label: 'run', x: 8.2, y: 3.5, note: 'execute' },
      { id: 'trace', label: 'trace', x: 9.5, y: 3.5, note: 'audit' },
    ],
    edges: [
      { id: 'e-goal-triage', from: 'goal', to: 'triage' },
      { id: 'e-triage-steps', from: 'triage', to: 'steps' },
      { id: 'e-triage-deps', from: 'triage', to: 'deps' },
      { id: 'e-steps-policy', from: 'steps', to: 'policy' },
      { id: 'e-deps-budget', from: 'deps', to: 'budget' },
      { id: 'e-policy-dag', from: 'policy', to: 'dag' },
      { id: 'e-budget-dag', from: 'budget', to: 'dag' },
      { id: 'e-dag-runtime', from: 'dag', to: 'runtime' },
      { id: 'e-runtime-trace', from: 'runtime', to: 'trace' },
    ],
  }, { title });
}

function runtimeGraph(title) {
  return graphState({
    nodes: [
      { id: 'start', label: 'start', x: 0.8, y: 3.5, note: 'input' },
      { id: 'fetch', label: 'fetch', x: 2.4, y: 1.6, note: 'tool' },
      { id: 'classify', label: 'class', x: 2.4, y: 3.5, note: 'LLM' },
      { id: 'draft', label: 'draft', x: 2.4, y: 5.4, note: 'agent' },
      { id: 'approve', label: 'gate', x: 4.4, y: 3.5, note: 'human' },
      { id: 'act', label: 'act', x: 6.0, y: 3.5, note: 'side fx' },
      { id: 'verify', label: 'verify', x: 7.6, y: 2.0, note: 'check' },
      { id: 'repair', label: 'repair', x: 7.6, y: 5.0, note: 'loop' },
      { id: 'ship', label: 'ship', x: 9.4, y: 3.5, note: 'final' },
    ],
    edges: [
      { id: 'e-start-fetch', from: 'start', to: 'fetch' },
      { id: 'e-start-classify', from: 'start', to: 'classify' },
      { id: 'e-start-draft', from: 'start', to: 'draft' },
      { id: 'e-fetch-approve', from: 'fetch', to: 'approve' },
      { id: 'e-classify-approve', from: 'classify', to: 'approve' },
      { id: 'e-draft-approve', from: 'draft', to: 'approve' },
      { id: 'e-approve-act', from: 'approve', to: 'act' },
      { id: 'e-act-verify', from: 'act', to: 'verify' },
      { id: 'e-verify-repair', from: 'verify', to: 'repair' },
      { id: 'e-repair-act', from: 'repair', to: 'act' },
      { id: 'e-verify-ship', from: 'verify', to: 'ship' },
    ],
  }, { title });
}

function compilePlot() {
  return plotState({
    axes: {
      x: { label: 'process explicitness', min: 0, max: 10 },
      y: { label: 'agent autonomy needed', min: 0, max: 10 },
    },
    series: [
      { id: 'flow', label: 'flow', points: [{ x: 1, y: 2 }, { x: 3, y: 3 }, { x: 6, y: 4 }, { x: 8.4, y: 5 }] },
      { id: 'agent', label: 'agent', points: [{ x: 1, y: 8 }, { x: 3, y: 8 }, { x: 6, y: 7 }, { x: 8.4, y: 5 }] },
    ],
    markers: [
      { id: 'function', x: 9, y: 2, label: 'code' },
      { id: 'open', x: 2, y: 8, label: 'agent' },
    ],
  });
}

function* compilePath() {
  yield {
    state: compilerGraph('Compile the goal before adding agents'),
    highlight: { active: ['goal', 'triage', 'steps', 'deps', 'e-goal-triage', 'e-triage-steps', 'e-triage-deps'], found: ['dag'] },
    explanation: 'A durable agent system starts by asking whether the work is a workflow, an agent loop, or a hybrid. If the steps are knowable, compile them into a DAG before giving the model extra freedom.',
    invariant: 'Use agents for uncertainty; use workflows for known control flow.',
  };

  yield {
    state: labelMatrix(
      'DAG',
      [
        { id: 'step', label: 'step' },
        { id: 'agent', label: 'agent' },
        { id: 'tool', label: 'tool' },
        { id: 'deps', label: 'dep' },
        { id: 'gate', label: 'gate' },
        { id: 'out', label: 'out' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['id/type', 'resume'],
        ['owner', 'scope'],
        ['schema', 'safe call'],
        ['parents', 'order'],
        ['policy', 'pause'],
        ['contract', 'merge'],
      ],
    ),
    highlight: { active: ['step:field', 'deps:field', 'gate:field', 'out:field'], compare: ['agent:why', 'tool:why'] },
    explanation: 'The compiler output is a typed table, not a prompt paragraph. Each step needs an id, owner, tool schema, dependency list, approval policy, output contract, budget, and retry envelope.',
  };

  yield {
    state: compilePlot(),
    highlight: { active: ['flow', 'function'], compare: ['agent', 'open'] },
    explanation: 'Microsoft Agent Framework states the blunt rule: use an agent for open-ended or conversational work, and use a workflow when the process has well-defined steps or needs explicit control over execution order.',
  };

  yield {
    state: compilerGraph('The compiled DAG feeds runtime state'),
    highlight: { active: ['policy', 'budget', 'dag', 'runtime', 'trace', 'e-policy-dag', 'e-budget-dag', 'e-dag-runtime', 'e-runtime-trace'], compare: ['triage'] },
    explanation: 'Once compiled, the DAG becomes the durable runtime plan. Checkpoints, human approvals, trace spans, and output validators all attach to the step ids rather than to free-form chat turns.',
  };
}

function* runtimePlan() {
  yield {
    state: runtimeGraph('A hybrid plan isolates uncertainty'),
    highlight: { active: ['start', 'fetch', 'classify', 'draft', 'e-start-fetch', 'e-start-classify', 'e-start-draft'], found: ['approve'] },
    explanation: 'A good runtime plan keeps deterministic work deterministic and lets agents handle only the uncertain parts. Fetching, classifying, drafting, approval, side effects, and verification become separate nodes.',
  };

  yield {
    state: labelMatrix(
      'Plan',
      [
        { id: 'fetch', label: 'get' },
        { id: 'class', label: 'cls' },
        { id: 'draft', label: 'drft' },
        { id: 'gate', label: 'gate' },
        { id: 'act', label: 'act' },
        { id: 'verify', label: 'ver' },
      ],
      [
        { id: 'mode', label: 'mode' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['tool', 'timeout'],
        ['LLM', 'bad label'],
        ['agent', 'drift'],
        ['human', 'stale'],
        ['side fx', 'dup'],
        ['check', 'miss'],
      ],
    ),
    highlight: { active: ['fetch:mode', 'class:mode', 'draft:mode', 'gate:mode', 'act:mode', 'verify:mode'], compare: ['act:fail'] },
    explanation: 'The plan should state which nodes are pure model calls, which invoke tools, which pause for people, which perform side effects, and which verify or repair.',
  };

  yield {
    state: runtimeGraph('Approval and verification are first-class nodes'),
    highlight: { active: ['approve', 'act', 'verify', 'repair', 'e-approve-act', 'e-act-verify', 'e-verify-repair', 'e-repair-act'], compare: ['draft'] },
    explanation: 'Side effects should be downstream of gates and upstream of verification. That structure is what lets a production workflow pause, resume, retry, or repair without losing the reason for the action.',
  };

  yield {
    state: labelMatrix(
      'Bad signs',
      [
        { id: 'chat', label: 'chat' },
        { id: 'state', label: 'state' },
        { id: 'side', label: 'side fx' },
        { id: 'merge', label: 'merge' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'smell', label: 'smell' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['all prose', 'typed DAG'],
        ['hidden', 'checkpoint'],
        ['unguarded', 'approval'],
        ['free text', 'schema'],
        ['missing', 'span tree'],
      ],
    ),
    highlight: { active: ['chat:fix', 'state:fix', 'side:fix', 'merge:fix', 'trace:fix'], compare: ['side:smell'] },
    explanation: 'The compiler is paying for clarity. If the state is hidden in a chat transcript, side effects are unguarded, and merges are free text, the system is not durable enough for real operations.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'compile path') yield* compilePath();
  else if (view === 'runtime plan') yield* runtimePlan();
  else throw new InputError('Pick an agent workflow compiler view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The compile-path view shows a goal becoming a directed acyclic graph, or DAG. A DAG is a graph whose edges point forward and never form a cycle, so it can express which steps must happen before others. Active nodes show classification, dependency extraction, contract creation, and gate insertion.',
        'The runtime-plan view shows execution of that graph. Agent autonomy is inside bounded nodes, while dependencies, budgets, approvals, retries, and validators sit outside the model. The safe inference is that the graph owns control flow even when individual nodes use a language model.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'The fundamental tension: agents need freedom to handle uncertainty, but production workflows need explicit control flow, typed contracts, approval gates, and audit trails. The DAG compiler resolves this by confining agent autonomy to bounded nodes inside an explicit graph — deterministic where possible, model-driven only where necessary.'},
        'A useful agent system often needs to fetch data, classify intent, call tools, ask for approval, perform side effects, retry failures, verify results, and leave an audit trail. If all of that lives inside a chat transcript, the system is hard to resume, inspect, budget, or trust. Production work needs control state outside the prompt.',
        'A DAG compiler exists to turn a goal into explicit workflow structure. It separates deterministic steps from model-driven steps, puts side effects behind gates, and gives every output a place in the trace. The agent still handles uncertainty, but it does so inside named boundaries.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to give a general agent the goal and let it decide what to do next. This works for demos and open exploration because the agent can adapt freely. It also keeps the prototype small.',
        'The opposite obvious approach is a hard-coded workflow. That works when the process is known and stable. It gives engineers clear steps, logs, retries, and permissions, but it handles ambiguity poorly.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Prompt-only agents hide state. A tool call may happen for a good reason, but the reason, input schema, retry boundary, budget, and approval status are buried in unstructured text. After a failure, the system may not know which step can be retried safely.',
        'Rigid workflows hide judgment. They force ambiguous requests through fixed branches and fail when a step requires source triage, drafting, repair, or exception handling. The wall is not choosing agents or workflows; it is locating uncertainty precisely enough to govern it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Compile the work into a graph before execution. Each node has an id, owner, mode, parent list, input contract, output contract, allowed tools, budget, timeout, retry rule, approval rule, and validator. Edges state what evidence must exist before a node can run.',
        'The uncertain work goes inside bounded nodes. Deterministic work stays deterministic, model work gets typed inputs and expected outputs, and external side effects sit between approval and verification. The graph makes autonomy inspectable without pretending it is deterministic.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The compiler first classifies the request as pure function, fixed workflow, agent loop, or hybrid. It extracts recurring units of work and emits a step table. It then connects dependencies and inserts gates for human approval, budget limits, external side effects, and validation.',
        'At runtime, the scheduler runs ready nodes in dependency order. It checkpoints outputs, records trace spans by step id, pauses at approvals, and retries failed nodes according to their local rule. A failed policy-retrieval node can retry without rerunning account fetch or final notification.',
        'The graph can be extended when discovery reveals new work. That extension should be explicit: add nodes, connect dependencies, and validate contracts. Replanning is safer than pretending the first graph knew the whole task.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A DAG makes causality explicit. Parents finish before children run, and a child consumes named outputs rather than transcript fragments. This gives the runtime a stable place to attach validation, retries, budgets, and provenance.',
        'The correctness argument is contract preservation. If every node runs only after its parents have valid outputs, and if every node output passes its validator before feeding children, then downstream steps see the evidence shape they were designed for. Approval gates add a second invariant: high-impact side effects cannot run until the gate records permission.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The compiler adds design work. Node schemas, validators, approval policies, retry envelopes, and trace fields must be specified. That overhead is justified for repeated, expensive, regulated, long-running, or side-effectful workflows.',
        'Cost behaves with graph size and validator depth. A 6-node support workflow may add only milliseconds of scheduler overhead and a few kilobytes of trace data, while a 200-node research workflow can create substantial storage and coordination work. The payoff is bounded retries and clear audit, not raw speed.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Use this pattern for support operations, coding agents, research assistants, incident response, compliance review, data enrichment, and workflows with tool calls or approvals. The repeated signal is that someone asks what happened, what it cost, why an action ran, and whether it can resume safely.',
        'The graph also gives security, finance, and product owners something concrete to inspect. Tool permissions, token budgets, human gates, external side effects, retry policies, and validation requirements are plan fields instead of prompt conventions.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A DAG compiler does not make vague policy precise. If contracts are shallow, validators only check shape, or approval is ceremonial, the graph gives false confidence. The plan must actually constrain execution.',
        'It also struggles with tasks whose shape is unknown until deep exploration. For those, use a small outer discovery loop that periodically compiles or extends the graph. Do not freeze a complete-looking DAG before the evidence exists.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A support agent receives a refund request for $420. The compiled DAG has eight nodes: fetch account, fetch policy, classify eligibility, draft decision, risk score, human approval if risk >= 0.7 or amount > $300, issue refund, verify transaction, and notify user. The approval condition fires because the amount is over $300.',
        'If policy retrieval times out, only that node retries. If the human rejects the refund, the issue-refund node never becomes ready. If the refund API returns transaction id tx_19 but verification fails, the repair node has the exact input, output, and side-effect id.',
        'A prompt-only run might contain the same decisions, but the trace would be hard to resume. The DAG run can report 9 nodes executed, 1 approval pause, 2 policy retries, $0 external side effects before approval, and transaction verification status. Those numbers are operational control.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Microsoft Agent Framework, OpenAI Agents SDK orchestration and handoffs, and Anthropic Building Effective Agents for current workflow and agent patterns. Study durable workflow systems such as Temporal to understand retry scope, idempotency, and history replay.',
        'Study next: Temporal Workflow Case Study for durable execution, Multi-Agent Orchestration Topologies for delegation shapes, Agent Checkpoint Replay Ledger for resumability, Human Approval Interrupt Queue for gates, Agent Run Trace Span Tree for observability, and Distributed Tracing for cross-service causality.',
      ],
    },
  ],
};
