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
      heading: 'What it is',
      paragraphs: [
        'Agent2Agent, or A2A, is an open protocol for communication between independent agentic applications. The important design choice is opacity: one agent should be able to discover another agent, delegate work, exchange context, and receive results without needing access to the other agent\'s private memory, tools, prompts, or implementation.',
        'The current A2A specification describes the protocol as a layered design: a canonical data model, abstract operations, and concrete protocol bindings. The data model includes Task, Message, AgentCard, Part, Artifact, and Extension. The operations include Send Message, streaming send, Get Task, List Tasks, Cancel Task, task subscription, push notification configuration, and extended Agent Card retrieval: https://a2a-protocol.org/latest/specification/.',
      ],
    },
    {
      heading: 'Agent Card discovery',
      paragraphs: [
        'The Agent Card is the discovery and capability manifest. A client fetches a card, commonly from /.well-known/agent-card.json, then reads the agent identity, supported interfaces, protocol versions, authentication schemes, capabilities, skills, and accepted input/output modes. This is the routing table for agent collaboration. It says whether this remote system is a plausible worker for a task and how the client should speak to it.',
        'The latest spec registers the well-known agent-card.json URI and recommends normal web controls around cards: HTTPS, caching headers, ETags, optional signatures, and authenticated extended cards for privileged details. That makes Agent Card handling a concrete data-structure problem: cache key, version, protocol binding, tenant, security scheme, skill id, input modes, output modes, and trust evidence all need to line up before delegation starts.',
      ],
    },
    {
      heading: 'Task state',
      paragraphs: [
        'A Task is the durable unit of action. It has an id, optional contextId, status, artifacts, history, and metadata. The task state can move through submitted, working, completed, failed, canceled, input required, rejected, or auth required. Those states are the public coordination contract between agents. They let a client poll, subscribe, cancel, resume, or explain work without asking the remote agent to expose private reasoning.',
        'Messages and Artifacts deliberately play different roles. Messages initiate work, clarify instructions, provide status, or continue a task. Artifacts deliver outputs. Parts inside messages or artifacts carry text, files, or structured data, which is how agents negotiate modalities such as text, JSON, generated files, and richer UI payloads. The spec explicitly separates communication from result delivery so a progress message does not masquerade as the final artifact.',
      ],
    },
    {
      heading: 'Complete case study: onboarding delegation',
      paragraphs: [
        'Imagine an enterprise assistant coordinating employee onboarding. The primary assistant discovers three A2A agents: HR, IT, and procurement. It reads their Agent Cards, verifies endpoints and auth requirements, and selects skills such as create onboarding checklist, provision laptop, and schedule orientation. It authenticates with scoped credentials and sends each agent a task-oriented message rather than pretending every remote agent is just a stateless tool.',
        'The HR agent may complete quickly and return an artifact checklist. The IT agent may enter TASK_STATE_AUTH_REQUIRED before creating accounts. The procurement agent may stream status updates while checking inventory and then push a webhook when the laptop order is approved. Internally, each agent may use MCP tools, databases, approval workflows, queues, and policy engines. A2A handles agent-to-agent delegation; MCP handles the agent-to-tool boundary inside each worker.',
      ],
    },
    {
      heading: 'Systems lessons',
      paragraphs: [
        'A2A reintroduces ordinary distributed-systems problems. Task lists need authorization scoping so one client cannot enumerate another client\'s work. Long task lists need cursor pagination. Streaming and push delivery need idempotent consumers, retries, reconnect behavior, and timeouts. Push webhooks need SSRF protection, authentication, rate limits, and duplicate-event handling. Artifacts need retention policy and privacy controls.',
        'The security boundary is not solved by the protocol name. The server must authenticate every request according to its declared schemes and then authorize specific skills, task actions, data access, and in-task approvals according to its own policies. This links directly to OAuth PKCE Token Lifecycle, Zanzibar Authorization Case Study, Agent Tool Permission Lattice, Prompt Injection Threat Model, Rate Limiter, Message Queue, Distributed Tracing, and Temporal Workflow Case Study.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat A2A as a magic agent marketplace. A compatible protocol does not prove skill quality, safety, economics, or legal authority. The client still needs trust policy, capability matching, evaluation, audit logs, budget limits, and human approval for high-impact work. Do not put secrets or internal implementation details in a public Agent Card. Do not rely on transient status messages for critical result delivery. Do not expose task listing without per-client authorization checks.',
        'The A2A versus MCP distinction is also easy to blur. MCP is primarily the boundary by which an agent or model uses tools, APIs, and resources. A2A is primarily the boundary by which independent agents partner on tasks. A mature system often uses both: A2A between peer agents, MCP inside an agent to reach tools, OAuth and Zanzibar-style checks for authority, and tracing plus queues for reliability.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: A2A latest specification at https://a2a-protocol.org/latest/specification/, A2A and MCP comparison at https://a2a-protocol.org/latest/topics/a2a-and-mcp/, A2A GitHub project at https://github.com/a2aproject/A2A, Google Agent2Agent launch announcement at https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/, Google Cloud donation to Linux Foundation at https://developers.googleblog.com/en/google-cloud-donates-a2a-to-linux-foundation/, and Linux Foundation launch announcement at https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents.',
        'Study JSON-RPC Protocol Case Study, Model Context Protocol Case Study, Agent Payments Protocol Mandate Ledger Case Study, Agentic AI Patterns, Multi-Agent Orchestration Topologies, Contract Net Agent Task Allocation, Blackboard Architecture Agent Coordination, Deep Research Agent Architecture Case Study, OAuth PKCE Token Lifecycle Case Study, Zanzibar Authorization Case Study, Agent Tool Permission Lattice, Message Queue, Distributed Tracing, Temporal Workflow Case Study, Rate Limiter, and Prompt Injection Threat Model next.',
      ],
    },
  ],
};
