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
      heading: 'The problem',
      paragraphs: [
        {type:'callout', text:'The fundamental tension: agents need freedom to handle uncertainty, but production workflows need explicit control flow, typed contracts, approval gates, and audit trails. The DAG compiler resolves this by confining agent autonomy to bounded nodes inside an explicit graph — deterministic where possible, model-driven only where necessary.'},
        'A useful agent system has to do more than answer once. It may fetch data, classify intent, call tools, ask for approval, perform side effects, retry failures, verify results, and leave an audit trail. If that control flow lives only inside a prompt transcript, the system is hard to resume, inspect, budget, or trust.',
        'The operational problem is turning an open-ended goal into a plan that is explicit enough for production and flexible enough for model work. The system needs to know which parts are deterministic workflow, which parts need agent judgment, where humans must approve, and what evidence proves each step ran correctly.',
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The obvious approach is to hand a general agent the goal and let it decide what to do next. That works for demos and genuinely exploratory work. It breaks down when a workflow needs durable state, approvals, cost limits, typed tool inputs, rollback boundaries, or a reliable account of why an action happened.',
        'The opposite obvious approach is to hard-code everything as a rigid workflow. That is safe when the process is known, but it cannot handle ambiguous inputs, open-ended drafting, source triage, or tasks where the best next step depends on model judgment. The wall is choosing between chaos and brittleness.',
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        'Compile the goal into a directed acyclic graph before execution. Each node is a step with an owner, input contract, output contract, tool permissions, budget, retry rule, approval rule, and trace identity. Edges state what must happen before what.',
        'The graph does not remove agents. It confines autonomy to the nodes that need it. Deterministic work stays deterministic. Agent work happens inside bounded nodes with typed inputs and expected outputs. Side effects sit behind gates and ahead of verification.',
        'The core insight is that an agent workflow is easier to govern when the uncertain work is inside explicit nodes instead of spread across the whole run. A model can still decide, draft, search, or repair, but the surrounding graph says what evidence it receives, what tools it may call, what output shape it owes, and what validator must accept the result.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'The compiler first classifies the requested work: pure function, fixed workflow, agent loop, or hybrid. It then emits a step table. At minimum, each row needs an id, mode, owner, parents, allowed tools, input schema, output schema, budget, timeout, retry policy, approval policy, and validator.',
        'The runtime executes the DAG in dependency order. It checkpoints node outputs, pauses at approval nodes, records trace spans under step ids, and retries or repairs failed nodes without losing the rest of the plan. The important move is that runtime state attaches to graph structure, not to a loose sequence of chat messages.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A support system receives this goal: review a refund request and act if policy allows. A prompt-only agent might read policy, inspect the account, decide, issue the refund, and write the reply in one opaque run. A compiled DAG splits the work into fetch account, retrieve policy, classify eligibility, draft decision, human approval if risk is high, issue refund, verify transaction, and notify user.',
        'That split changes failure handling. If policy retrieval times out, only that node retries. If a refund action is high value, the approval node pauses before the side effect. If verification fails, the repair loop has the transaction id and prior outputs. The final answer is not just text; it is the visible result of a controlled plan.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A DAG makes causality explicit. Parents must finish before children run. A node output can be validated before it feeds another node. A side-effect node can be made idempotent because the runtime knows whether it already ran and what input it used.',
        'The structure also creates clean ownership boundaries. A specialist can own a bounded node output. A manager can own the final merge. A human can own a gate. Observability tools can group spans, budgets, and failures by step id instead of trying to infer structure after the fact.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The compiler adds design work. Every node contract, approval rule, and validator must be specified. That cost is justified when the work is repeated, expensive, regulated, long-running, or side-effectful. It is overkill for a one-off exploratory conversation.',
        'The main tradeoff is freedom versus control. Too little structure hides risk inside prompts. Too much structure forces an agent through a brittle script. The useful middle is a deterministic shell around uncertain model nodes, with explicit gates around actions that change external state.',
        'There is also a migration cost. Teams often start with prompt-only agents because they are fast to prototype. Moving to a DAG means naming recurring steps, extracting validators, deciding which outputs deserve schemas, and accepting that some exploratory behavior should remain outside the compiled path until it becomes repeatable.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'A DAG compiler does not make a weak policy correct. If the step contracts are vague, the validators shallow, or the approval policy ceremonial, the graph only gives a false sense of control. The plan must actually constrain execution.',
        'It also struggles with tasks whose shape is unknown until deep exploration. For those, use an outer loop that periodically recompiles or extends the DAG as evidence arrives. Do not pretend an early graph is complete when the task is still discovery.',
      ],
    },
    {
      heading: 'Practical use',
      paragraphs: [
        'Use this pattern for support operations, coding agents, research assistants, incident response, compliance review, data enrichment, and any agent workflow where tool calls and approvals matter. The repeated sign is the same: people ask what happened, what it cost, why an action ran, and whether it can be resumed safely.',
        'The compiled graph also gives security, finance, and product owners something concrete to inspect. Token budgets, tool permissions, human approval points, external side effects, retry envelopes, and validation requirements are first-class plan fields instead of hidden prompt conventions.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the compile path view, follow the goal through triage into steps and dependencies before looking at runtime. The visual lesson is that agents are not added first. The plan is made explicit first, then policies and budgets turn it into an executable DAG.',
        'In the runtime plan view, watch where uncertainty is isolated. Fetch, classify, and draft can run separately; approval sits before the side effect; verification and repair sit after it. A healthy production plan has those boundaries visible before the run starts.',
        'For study, compare this with a prompt-only transcript. The transcript may contain the same decisions, but they are hard to resume or audit because the control state is implicit. The graph makes the control state visible: dependencies, retry scope, approval scope, and proof of completion all have a place before execution begins.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Microsoft Agent Framework at https://learn.microsoft.com/en-us/agent-framework/overview/, OpenAI Agents SDK overview at https://developers.openai.com/api/docs/guides/agents, OpenAI orchestration and handoffs at https://developers.openai.com/api/docs/guides/agents/orchestration, OpenAI Agents SDK handoffs at https://openai.github.io/openai-agents-python/handoffs/, and Anthropic Building Effective Agents at https://www.anthropic.com/research/building-effective-agents. Study Temporal Workflow Case Study, Multi-Agent Orchestration Topologies, Agent Model Router & Context Handoff Ledger, Agent Checkpoint Replay Ledger Case Study, Human Approval Interrupt Queue Case Study, Agent Run Trace Span Tree Case Study, and Distributed Tracing next.',
      ],
    },
  ],
};
