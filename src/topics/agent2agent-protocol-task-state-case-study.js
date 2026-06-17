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
      heading: 'The problem',
      paragraphs: [
        'Agent systems stop being simple when one agent needs another agent to do real work. A travel assistant may need a payments agent. A coding assistant may need a deployment agent. An enterprise assistant may need HR, IT, procurement, and legal agents. These systems are often built by different teams, run behind different boundaries, and use different internal tools. They still need a way to discover each other, delegate work, exchange status, and deliver results.',
        'Agent2Agent, or A2A, addresses that boundary. The central design choice is opacity. A client agent should not need access to the remote agent internal prompts, tool graph, memory, or private reasoning. It should be able to inspect a capability manifest, send a task-oriented message, follow public task state, receive artifacts, and apply its own trust and authorization rules around the interaction.',
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'The naive approach is to treat every remote agent as a custom API. The client stores a hard-coded endpoint, invents a payload shape, polls some status route, and learns by convention whether the final response is a result, an error, a progress note, or a request for more input. This can work for one integration, but each new agent adds another private contract.',
        'Another naive approach is to collapse remote agents into tools. A tool call is usually synchronous and narrow: call this function with these arguments. Delegated agent work is often long-running, interactive, multi-modal, and policy-sensitive. A remote agent may need to ask for clarification, request authorization, stream progress, produce files, or continue a task later. That needs a task protocol, not just a function call.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is interoperability plus control. A client needs to know who the remote agent claims to be, what skills it exposes, what authentication it requires, what inputs and outputs it supports, which protocol binding to use, and whether cached metadata is still valid. If discovery is loose, the client can route work to the wrong service, use the wrong credential, or trust stale capabilities.',
        'Task coordination creates another wall. Long-running work has state transitions. A task can be submitted, working, waiting for input, waiting for authorization, completed, failed, rejected, or canceled. If these states are hidden in prose, the client cannot build reliable polling, streaming, retry, cancellation, approval, or user-interface behavior. Protocol shape matters because it becomes the public state machine between independent systems.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A2A separates discovery, task coordination, and result delivery. The Agent Card is a manifest and routing data structure. The Task is the durable unit of delegated work. Messages are interaction events. Artifacts are outputs. Parts carry concrete payloads such as text, files, or structured data. This gives both sides a shared vocabulary without exposing implementation internals.',
        'The deeper insight is that agent collaboration should look like distributed workflow, not prompt concatenation. A client can ask a remote agent to do a job, then observe public state and artifacts. The remote agent remains responsible for its own tools, memory, policies, and execution. This keeps the boundary narrow enough to secure and stable enough to compose.',
      ],
    },
    {
      heading: 'What the visualization shows',
      paragraphs: [
        'The Agent Card view shows discovery as a sequence of checks. The client fetches a well-known card, validates identity and interface details, considers signatures or cache validators when present, reads authentication requirements, and matches skills to the work. The card is not marketing text; it is the routing table for a remote agent.',
        'The task-state view shows why delegated work needs an explicit lifecycle. SendMessage creates or continues a task. The server may store state, start workers, stream updates, configure push notifications, and produce artifacts. The state diagram highlights nonterminal interruptions such as input required and authorization required, then separates terminal states such as completed, failed, rejected, and canceled.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A client begins by discovering a candidate agent. It fetches the Agent Card from a known location or registry, checks that the origin and declared identity match expectations, chooses a supported interface, and obtains the required credential. It then matches the advertised skills and input/output modes against the task. If an extended card exists for authenticated clients, the public card should remain conservative and avoid leaking privileged internal details.',
        'Work begins with a message. The server returns or updates a Task object with an id, status, metadata, optional history, and eventually artifacts. The client can poll, subscribe to streaming updates, request cancellation, or receive push notifications if configured. Messages are for interaction and status. Artifacts are for durable outputs. That distinction matters because a progress message should not be mistaken for the final deliverable.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider an enterprise onboarding assistant. A manager asks it to prepare onboarding for a new employee. The primary assistant discovers three remote agents: HR, IT, and procurement. It reads their Agent Cards, verifies endpoints and authentication schemes, and selects skills such as create onboarding checklist, provision laptop, create account requests, and schedule orientation. It sends scoped, task-oriented messages instead of exposing one broad internal credential to every worker.',
        'The HR agent may complete quickly and return an artifact checklist. The IT agent may enter an authorization-required state before creating accounts. The procurement agent may stream inventory status, then push a notification when the laptop order is approved. Internally, each remote agent may use MCP tools, databases, queues, policy engines, and human approval systems. A2A coordinates agent-to-agent work; it does not replace the internal tool boundary.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because it makes the coordination state explicit while preserving implementation privacy. The client does not need to inspect the remote agent chain of thought or internal tool plan. It only needs a contract: what task was accepted, what state it is in, what input or authorization is required, what artifacts were produced, and whether the task is terminal.',
        'It also works because discovery becomes data-driven. A client can compare agent identity, protocol binding, skill ids, authentication schemes, input modes, output modes, and version information before sending work. That does not prove the remote agent is competent or safe, but it prevents many integration failures that come from guessing.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'A2A adds protocol surface area. Servers must implement card hosting, authentication, task storage, state transitions, artifact handling, streaming or push delivery, cancellation semantics, and error reporting. Clients must handle stale cards, version drift, reconnects, duplicate notifications, partial artifacts, and remote refusal. For a small internal integration, a direct API may be simpler.',
        'The protocol also leaves important policy choices to the application. Who may list tasks? Who may cancel a task? How long are artifacts retained? Are push URLs authenticated and protected from SSRF? What happens if a task is canceled while a worker is already performing an external side effect? These are not solved by naming the protocol; they must be designed.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'A2A wins when independent agents need durable, observable delegation. It is useful for enterprise workflows, multi-vendor agent systems, domain-specialist agents, long-running research tasks, customer-service escalations, and operations flows where one agent coordinates several others without absorbing their internals.',
        'It is especially strong when results are artifacts rather than chat turns. Reports, tickets, files, structured records, approvals, and generated plans need durable handles and lifecycle state. A task id gives the client something to monitor and resume after network loss, process restart, or user handoff.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A2A fails if teams treat a compatible card as proof of quality or trust. The card can say what the agent claims to do; it cannot prove the agent will do it well, safely, cheaply, or legally. Clients still need allow lists, evaluation, budgets, audit logs, user consent, and human review for high-impact operations.',
        'It also fails when task state is treated as decoration. If servers emit vague status text instead of clear states, clients cannot automate. If artifacts are not durable, final outputs can be lost. If task listing lacks per-client authorization, one client may discover another client work. If push notifications are not idempotent, retries can trigger duplicate downstream actions.',
      ],
    },
    {
      heading: 'Failure modes to test',
      paragraphs: [
        'Test spoofed Agent Cards, stale cache entries, downgraded protocol bindings, missing authentication scopes, cross-tenant task ids, duplicate SendMessage retries, cancellation races, webhook replay, webhook SSRF, partial artifact delivery, and status streams that reconnect after an interruption. Each test should specify the expected state transition and the durable record left behind.',
        'Also test A2A and MCP composition. A remote agent may receive an A2A task, then use MCP tools internally. The outer protocol should not grant blanket tool authority. The worker still needs local authorization, least privilege, tracing, rate limits, and policy checks for every tool or resource it touches.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources for this topic include the A2A specification at https://a2a-protocol.org/latest/specification/, the A2A and MCP comparison at https://a2a-protocol.org/latest/topics/a2a-and-mcp/, and the A2A project repository at https://github.com/a2aproject/A2A.',
        'Good next topics are Model Context Protocol Case Study, JSON-RPC Protocol Case Study, Agent Tool Permission Lattice, OAuth PKCE Token Lifecycle Case Study, Zanzibar Authorization Case Study, Contract Net Agent Task Allocation, Blackboard Architecture Agent Coordination, Message Queue, Distributed Tracing, Temporal Workflow Case Study, Rate Limiter, Prompt Injection Threat Model, and AI Audit Evidence Packet Case Study.',
      ],
    },
  ],
};
