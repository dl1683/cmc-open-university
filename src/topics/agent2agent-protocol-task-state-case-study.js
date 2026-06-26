// Agent2Agent protocol: discover peer agents with Agent Cards, then manage
// delegated work through tasks, messages, artifacts, streams, and policy gates.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'agent2agent-protocol-task-state-case-study',
  title: 'Agent2Agent Protocol Task State Case Study',
  category: 'Systems',
  summary: 'A protocol case study for agent-to-agent work: Agent Cards, capability discovery, task state, messages, artifacts, streaming updates, push notifications, and A2A plus MCP composition.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['agent card', 'task state'], defaultValue: 'agent card' },
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

function cardGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.8, y: 3.7, note: 'agent A' },
      { id: 'wellknown', label: 'well-known', x: 2.6, y: 2.0, note: 'card URL' },
      { id: 'card', label: 'card', x: 4.5, y: 3.7, note: 'manifest' },
      { id: 'sig', label: 'sig', x: 3.2, y: 5.5, note: 'optional' },
      { id: 'cache', label: 'cache', x: 5.9, y: 5.7, note: 'ETag' },
      { id: 'iface', label: 'iface', x: 6.5, y: 2.0, note: 'binding' },
      { id: 'auth', label: 'auth', x: 8.1, y: 2.1, note: 'token' },
      { id: 'skill', label: 'skill', x: 8.1, y: 3.7, note: 'fit' },
      { id: 'task', label: 'task', x: 9.4, y: 3.7, note: 'delegate' },
    ],
    edges: [
      { id: 'e-client-wellknown', from: 'client', to: 'wellknown', weight: 'GET' },
      { id: 'e-wellknown-card', from: 'wellknown', to: 'card', weight: 'AgentCard' },
      { id: 'e-card-sig', from: 'card', to: 'sig', weight: 'JWS' },
      { id: 'e-card-cache', from: 'card', to: 'cache', weight: 'ETag' },
      { id: 'e-card-iface', from: 'card', to: 'iface' },
      { id: 'e-iface-auth', from: 'iface', to: 'auth' },
      { id: 'e-card-skill', from: 'card', to: 'skill' },
      { id: 'e-auth-task', from: 'auth', to: 'task' },
      { id: 'e-skill-task', from: 'skill', to: 'task', weight: 'select' },
    ],
  }, { title });
}

function taskGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 3.7, note: 'agent A' },
      { id: 'send', label: 'Send', x: 2.3, y: 3.7, note: 'message' },
      { id: 'server', label: 'server', x: 4.0, y: 3.7, note: 'agent B' },
      { id: 'store', label: 'tasks', x: 5.7, y: 2.2, note: 'state DB' },
      { id: 'worker', label: 'worker', x: 5.7, y: 5.2, note: 'tools' },
      { id: 'stream', label: 'stream', x: 7.6, y: 2.2, note: 'SSE/gRPC' },
      { id: 'push', label: 'push', x: 7.6, y: 5.2, note: 'webhook' },
      { id: 'artifact', label: 'artifact', x: 9.1, y: 3.7, note: 'output' },
    ],
    edges: [
      { id: 'e-client-send', from: 'client', to: 'send' },
      { id: 'e-send-server', from: 'send', to: 'server' },
      { id: 'e-server-store', from: 'server', to: 'store' },
      { id: 'e-server-worker', from: 'server', to: 'worker' },
      { id: 'e-worker-store', from: 'worker', to: 'store' },
      { id: 'e-store-stream', from: 'store', to: 'stream' },
      { id: 'e-store-push', from: 'store', to: 'push' },
      { id: 'e-worker-artifact', from: 'worker', to: 'artifact' },
    ],
  }, { title });
}

function stateGraph(title) {
  return graphState({
    nodes: [
      { id: 'submitted', label: 'submitted', x: 0.8, y: 3.7, note: 'ack' },
      { id: 'working', label: 'working', x: 2.8, y: 3.7, note: 'active' },
      { id: 'input', label: 'input req', x: 4.8, y: 2.0, note: 'clarify' },
      { id: 'auth', label: 'auth req', x: 4.8, y: 5.4, note: 'approve' },
      { id: 'completed', label: 'done', x: 7.1, y: 2.0, note: 'terminal' },
      { id: 'failed', label: 'failed', x: 7.1, y: 3.7, note: 'terminal' },
      { id: 'rejected', label: 'reject', x: 7.1, y: 5.4, note: 'terminal' },
      { id: 'canceled', label: 'cancel', x: 9.0, y: 3.7, note: 'terminal' },
    ],
    edges: [
      { id: 'e-submitted-working', from: 'submitted', to: 'working' },
      { id: 'e-working-input', from: 'working', to: 'input' },
      { id: 'e-input-working', from: 'input', to: 'working' },
      { id: 'e-working-auth', from: 'working', to: 'auth' },
      { id: 'e-auth-working', from: 'auth', to: 'working' },
      { id: 'e-working-completed', from: 'working', to: 'completed' },
      { id: 'e-working-failed', from: 'working', to: 'failed' },
      { id: 'e-working-rejected', from: 'working', to: 'rejected' },
      { id: 'e-working-canceled', from: 'working', to: 'canceled' },
      { id: 'e-input-canceled', from: 'input', to: 'canceled' },
      { id: 'e-auth-canceled', from: 'auth', to: 'canceled' },
    ],
  }, { title });
}

function* agentCardView() {
  yield {
    state: cardGraph('Agent discovery starts with a public Agent Card'),
    highlight: { active: ['client', 'wellknown', 'card', 'e-client-wellknown', 'e-wellknown-card'], compare: ['task'] },
    explanation: 'A2A discovery begins by fetching an Agent Card, commonly from a well-known URI. The card is the remote agent manifest: who the agent is, how to reach it, what protocols it supports, and which skills it advertises.',
  };

  yield {
    state: labelMatrix(
      'Agent Card fields',
      [
        { id: 'identity', label: 'identity' },
        { id: 'iface', label: 'interface' },
        { id: 'security', label: 'security' },
        { id: 'skills', label: 'skills' },
        { id: 'modes', label: 'modes' },
        { id: 'version', label: 'version' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'why', label: 'why' },
      ],
      [
        ['name, provider', 'trust display'],
        ['endpoint', 'choose bind'],
        ['schemes', 'get token'],
        ['task abilities', 'route work'],
        ['input/output', 'parts ok'],
        ['protocol/card', 'cache safely'],
      ],
    ),
    highlight: { active: ['iface:contains', 'security:contains', 'skills:contains', 'modes:contains'], found: ['version:why'] },
    explanation: 'The Agent Card is not marketing copy. It is a routing data structure. A client uses it to pick a protocol binding, authenticate correctly, choose a skill, negotiate content types, and decide whether cached metadata is still fresh.',
  };

  yield {
    state: cardGraph('A2A separates abstract operations from protocol bindings'),
    highlight: { active: ['card', 'iface', 'auth', 'e-card-iface', 'e-iface-auth'], compare: ['skill'], found: ['cache'] },
    explanation: 'The latest A2A specification defines a canonical data model and maps it to protocol bindings such as JSON-RPC over HTTP, gRPC, and HTTP plus JSON. The card tells the client which interface this agent actually exposes.',
    invariant: 'The Task, Message, Artifact, and Agent Card semantics should survive the binding choice.',
  };

  yield {
    state: cardGraph('Authenticated clients may receive an extended card'),
    highlight: { active: ['client', 'auth', 'card', 'skill', 'task', 'e-iface-auth', 'e-auth-task', 'e-card-skill', 'e-skill-task'], compare: ['wellknown'] },
    explanation: 'A public card should avoid sensitive internals. If the public card advertises extended-card support, an authenticated client can fetch a richer card with additional skills or limits appropriate to that identity.',
  };

  yield {
    state: labelMatrix(
      'Discovery review checklist',
      [
        { id: 'origin', label: 'origin' },
        { id: 'signature', label: 'signature' },
        { id: 'cache', label: 'cache' },
        { id: 'auth', label: 'auth' },
        { id: 'routing', label: 'routing' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['right host?', 'spoofed card'],
        ['JWS valid?', 'tampered skill'],
        ['ETag fresh?', 'stale route'],
        ['scope enough?', 'deputy bug'],
        ['tenant bound?', 'wrong account'],
      ],
    ),
    highlight: { active: ['origin:question', 'signature:question', 'auth:question', 'routing:question'], compare: ['cache:failure'] },
    explanation: 'Discovery is part of the control plane. A client should validate the host, verify signatures when present, respect cache/version rules, bind credentials to the selected agent, and avoid cross-tenant route confusion.',
  };

  yield {
    state: labelMatrix(
      'A2A and MCP composition',
      [
        { id: 'a2a', label: 'A2A' },
        { id: 'mcp', label: 'MCP' },
        { id: 'jsonrpc', label: 'JSON-RPC' },
        { id: 'authz', label: 'authz' },
      ],
      [
        { id: 'boundary', label: 'boundary' },
        { id: 'main object', label: 'main object' },
      ],
      [
        ['agent to agent', 'task/artifact'],
        ['agent to tools', 'tool/resource'],
        ['envelope', 'id/method'],
        ['policy', 'scope/tuple'],
      ],
    ),
    highlight: { active: ['a2a:boundary', 'mcp:boundary', 'a2a:main object', 'mcp:main object'], found: ['jsonrpc:main object', 'authz:main object'] },
    explanation: 'A2A is complementary to MCP. A client agent can delegate a task to a remote agent through A2A, while that remote agent internally uses MCP tools, authorization checks, tracing, queues, and workflows to complete the task.',
  };
}

function* taskStateView() {
  yield {
    state: taskGraph('SendMessage creates or continues a task'),
    highlight: { active: ['client', 'send', 'server', 'store', 'e-client-send', 'e-send-server', 'e-server-store'], compare: ['artifact'] },
    explanation: 'A2A is task-oriented. A client sends a Message to a remote agent. The server can return a Task immediately, ask for clarification, or continue an existing context. The task id becomes the durable handle for later status, history, and artifacts.',
  };

  yield {
    state: stateGraph('Task state exposes progress without exposing internals'),
    highlight: { active: ['submitted', 'working', 'input', 'auth', 'e-submitted-working', 'e-working-input', 'e-working-auth'], compare: ['completed', 'failed', 'rejected'] },
    explanation: 'The remote agent can be opaque internally, but the task state is explicit. Submitted and working show progress. Input required and auth required interrupt the flow without pretending the task has failed.',
  };

  yield {
    state: stateGraph('Terminal states close the task contract'),
    highlight: { active: ['working', 'completed', 'failed', 'rejected', 'canceled', 'e-working-completed', 'e-working-failed', 'e-working-rejected', 'e-working-canceled'], compare: ['input', 'auth'] },
    explanation: 'Completed, failed, canceled, and rejected are terminal states. Clients should stop resubscribing when a task reaches a terminal state and should treat cancellation as attempted, not guaranteed, until the server returns the updated task.',
    invariant: 'Task state is the coordination contract; private chain-of-thought is not part of the protocol contract.',
  };

  yield {
    state: labelMatrix(
      'Message versus Artifact',
      [
        { id: 'message', label: 'Message' },
        { id: 'artifact', label: 'Artifact' },
        { id: 'part', label: 'Part' },
        { id: 'history', label: 'History' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['interaction', 'clarify'],
        ['result data', 'deliver output'],
        ['text/file/data', 'mode match'],
        ['task memory', 'partial'],
      ],
    ),
    highlight: { active: ['message:role', 'artifact:role', 'part:role'], compare: ['history:lesson'] },
    explanation: 'Messages are for interaction: initiating tasks, asking for clarification, status notes, or extra instructions. Artifacts are for task outputs. Parts carry text, files, or structured data. History is useful, but the spec warns not to treat every status message as reliable critical delivery.',
  };

  yield {
    state: taskGraph('Updates can be streamed or pushed'),
    highlight: { active: ['store', 'stream', 'push', 'client', 'e-store-stream', 'e-store-push'], found: ['artifact'] },
    explanation: 'For live work, a client can subscribe to task updates through streaming. For long-running work, it can configure push notifications. Both paths need idempotent processing because reconnects, retries, and duplicate callbacks are normal systems problems.',
  };

  yield {
    state: labelMatrix(
      'Production task-store checks',
      [
        { id: 'scope', label: 'scope' },
        { id: 'page', label: 'pagination' },
        { id: 'retry', label: 'retry' },
        { id: 'audit', label: 'audit' },
        { id: 'delete', label: 'retention' },
      ],
      [
        { id: 'control', label: 'control' },
        { id: 'linked topic', label: 'linked topic' },
      ],
      [
        ['client scope', 'Zanzibar Auth'],
        ['cursor token', 'Pagination'],
        ['idempotency', 'Message Queue'],
        ['status trace', 'Tracing'],
        ['data policy', 'Agent Tools'],
      ],
    ),
    highlight: { active: ['scope:control', 'page:control', 'retry:control', 'audit:control'], compare: ['delete:control'] },
    explanation: 'A production A2A server is not just a chat endpoint. It needs authorization-scoped task lists, cursor pagination, duplicate-safe callbacks, audit trails, retention policy, and clear separation between progress messages and durable artifacts.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'agent card') yield* agentCardView();
  else if (view === 'task state') yield* taskStateView();
  else throw new InputError('Pick an Agent2Agent protocol view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The agent-card view shows discovery for Agent2Agent, or A2A, a protocol for agents delegating tasks to other agents across boundaries. An Agent Card is a capability manifest: it tells the client what the remote agent claims to support, which endpoints and auth schemes it uses, and which input and output modes are available. Active nodes show identity, capability, and interface checks.',
        'The task-state view shows delegated work as a state machine. A task is the durable unit of work, messages are interaction events, and artifacts are outputs. The safe inference is that the client should trust public task state and artifacts, not the remote agent internal prompts or private tool graph.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt:'Network of interconnected agents', caption:'Agent-to-agent communication mirrors internet routing: discovery, capability negotiation, and structured message exchange across trust boundaries. Source: Wikimedia Commons, The Opte Project, CC BY 2.5'},
        'Agent systems become distributed when one agent needs another to do real work. A travel agent may need payments, a coding agent may need deployment, and an enterprise assistant may need HR, IT, procurement, and legal agents. Those agents often live behind different owners, tools, policies, and credentials.',
        'A2A exists to make that boundary explicit. The client needs to discover capabilities, send a task, follow state, handle interruptions, receive artifacts, and apply its own trust policy. It should not need the remote agent private prompt, memory, reasoning, or tool graph.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious integration is a custom API per remote agent. Store an endpoint, invent a payload, call it, poll a status route, and parse whatever response shape the team chose. This works for one integration.',
        'Another obvious move is to model every remote agent as a synchronous tool call. That fits narrow functions but not long-running delegated work. A remote agent may need clarification, authorization, progress updates, files, cancellation, or later continuation.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Custom APIs do not compose. Each new agent has a different discovery shape, authentication rule, progress convention, error model, and result format. Clients end up with private adapters instead of a shared delegation protocol.',
        'Task coordination is the harder wall. Work can be submitted, working, input-required, authorization-required, completed, failed, rejected, or canceled. If those states appear only as prose, clients cannot build reliable polling, streaming, retry, cancellation, or user-interface behavior.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type:'callout', text:'A2A\\u2019s key design: opacity. A client agent should not need access to the remote agent\\u2019s internal prompts, tool graph, memory, or reasoning. It only sees the Agent Card (capabilities), Task (state machine), Messages (interaction), and Artifacts (results).'},
        'A2A separates discovery, task coordination, and result delivery. The Agent Card is routing data, the Task is durable work state, Messages carry interaction, and Artifacts carry deliverables. Parts hold concrete payloads such as text, files, or structured data.',
        'The insight is that agent collaboration should look like distributed workflow, not prompt concatenation. The remote agent owns its internal tools and policies. The client owns selection, authorization, monitoring, and trust around the public protocol surface.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client starts by discovering a candidate agent and fetching its card. It checks origin, identity, supported protocol binding, auth schemes, skills, input modes, output modes, version, and cache freshness. If an authenticated extended card exists, the public card should stay conservative.',
        'Work begins with a message that creates or continues a Task. The server returns a task id, status, metadata, optional history, and later artifacts. The client can poll, stream updates, cancel, or receive push notifications when configured.',
        'Messages and artifacts have different jobs. A progress message can ask for input or report state, while an artifact is a durable output such as a report, ticket, file, or structured record. Treating progress text as final output is a common protocol bug.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because coordination state is explicit while implementation stays private. The client can observe accepted, working, input-required, authorization-required, completed, failed, rejected, or canceled without inspecting chain of thought. That is enough to build retries, UI, and audit logs.',
        'The correctness argument is boundary preservation. If the client chooses an agent from verified card data, sends scoped task messages, and advances only according to public task states, then it can coordinate work without assuming remote internals. Artifacts provide durable outputs that survive reconnects and process restarts.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A2A adds protocol surface. Servers must host cards, authenticate clients, store tasks, implement state transitions, handle artifacts, support streaming or push, define cancellation, and report errors. Clients must handle stale cards, duplicate messages, reconnects, version drift, partial artifacts, and refusal.',
        'Cost behaves with task duration and artifact size. A one-second query may not justify the protocol overhead, while a two-hour onboarding workflow benefits from durable state. For small internal integrations, a direct API can be cheaper until long-running state or multi-agent composition appears.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A2A fits enterprise workflows, domain-specialist agents, customer-service escalation, operations flows, procurement, onboarding, research delegation, and multi-vendor agent systems. It is strongest when one coordinator needs several independent agents without absorbing their internals.',
        'It is especially useful when results are artifacts rather than chat turns. Reports, tickets, approvals, generated files, and structured records need durable handles. A task id gives the client something to monitor, resume, cancel, and audit.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A compatible card is not proof of quality or trust. It tells the client what the agent claims to support, not whether it will work safely, cheaply, legally, or accurately. Clients still need allow lists, evaluation, budgets, audit logs, consent, and human review for high-impact work.',
        'It also fails when state is vague. If servers emit status prose instead of clear states, clients cannot automate. If artifacts are not durable or task listing lacks authorization, outputs can be lost or exposed across tenants.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An onboarding assistant receives a request for one new employee. It discovers three remote agents: HR, IT, and procurement. It reads cards, verifies authentication, and sends scoped tasks: create checklist, provision accounts, and order laptop.',
        'The HR task completes in 14 seconds and returns a checklist artifact. The IT task enters authorization-required because account creation touches privileged systems. The procurement task streams inventory updates, then completes 2 hours later with a purchase-order artifact.',
        'The coordinator never receives the remote agents internal prompts or tool plans. It sees task ids, states, messages, and artifacts. If the procurement push notification repeats, idempotency on the task id prevents duplicate downstream actions.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the A2A specification, the A2A and MCP comparison, and the A2A project repository. Read task state, Agent Card, artifacts, authentication, push notification, and cancellation sections before designing a client.',
        'Study next: Model Context Protocol for local tool context, JSON-RPC Protocol for request-response mechanics, OAuth PKCE Token Lifecycle for delegated authorization, Zanzibar Authorization for cross-tenant access, Contract Net Agent Task Allocation for delegation theory, Distributed Tracing for observability, and Prompt Injection Threat Model for trust boundaries.',
      ],
    },
  ],
};
