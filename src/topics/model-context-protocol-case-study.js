// Model Context Protocol: a versioned JSON-RPC capability protocol for
// connecting AI clients to tools, resources, prompts, roots, and sampling.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'model-context-protocol-case-study',
  title: 'Model Context Protocol (MCP) Case Study',
  category: 'Systems',
  summary: 'A protocol case study for agent tool integration: JSON-RPC messages, lifecycle negotiation, tools, resources, prompts, transports, roots, and auth.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['protocol shape', 'security model'], defaultValue: 'protocol shape' },
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

function architectureGraph(title) {
  return graphState({
    nodes: [
      { id: 'host', label: 'host', x: 0.8, y: 3.6, note: 'IDE/chat' },
      { id: 'client', label: 'client', x: 2.7, y: 3.6, note: 'MCP session' },
      { id: 'server', label: 'server', x: 4.9, y: 3.6, note: 'capabilities' },
      { id: 'tools', label: 'tools', x: 7.0, y: 1.6, note: 'actions' },
      { id: 'resources', label: 'resources', x: 7.0, y: 3.6, note: 'context' },
      { id: 'prompts', label: 'prompts', x: 7.0, y: 5.6, note: 'templates' },
      { id: 'roots', label: 'roots', x: 4.8, y: 6.2, note: 'client dirs' },
      { id: 'model', label: 'model', x: 9.0, y: 3.6, note: 'LLM' },
    ],
    edges: [
      { id: 'e-host-client', from: 'host', to: 'client' },
      { id: 'e-client-server', from: 'client', to: 'server' },
      { id: 'e-server-tools', from: 'server', to: 'tools' },
      { id: 'e-server-resources', from: 'server', to: 'resources' },
      { id: 'e-server-prompts', from: 'server', to: 'prompts' },
      { id: 'e-client-roots', from: 'client', to: 'roots' },
      { id: 'e-resources-model', from: 'resources', to: 'model' },
      { id: 'e-prompts-model', from: 'prompts', to: 'model' },
      { id: 'e-model-tools', from: 'model', to: 'tools' },
    ],
  }, { title });
}

function lifecycleGraph(title) {
  return graphState({
    nodes: [
      { id: 'connect', label: 'connect', x: 0.7, y: 3.6, note: 'transport' },
      { id: 'init', label: 'initialize', x: 2.1, y: 3.6, note: 'version' },
      { id: 'caps', label: 'capabilities', x: 3.8, y: 3.6, note: 'negotiate' },
      { id: 'list', label: 'list', x: 5.5, y: 2.0, note: 'discover' },
      { id: 'call', label: 'call/read', x: 5.5, y: 5.2, note: 'operate' },
      { id: 'notify', label: 'notify', x: 7.4, y: 3.6, note: 'changes' },
      { id: 'stop', label: 'shutdown', x: 9.1, y: 3.6, note: 'close' },
    ],
    edges: [
      { id: 'e-connect-init', from: 'connect', to: 'init' },
      { id: 'e-init-caps', from: 'init', to: 'caps' },
      { id: 'e-caps-list', from: 'caps', to: 'list' },
      { id: 'e-caps-call', from: 'caps', to: 'call' },
      { id: 'e-list-notify', from: 'list', to: 'notify' },
      { id: 'e-call-notify', from: 'call', to: 'notify' },
      { id: 'e-notify-stop', from: 'notify', to: 'stop' },
    ],
  }, { title });
}

function securityGraph(title) {
  return graphState({
    nodes: [
      { id: 'browser', label: 'web page', x: 0.8, y: 1.8, note: 'attacker?' },
      { id: 'client', label: 'client', x: 2.8, y: 3.8, note: 'user app' },
      { id: 'http', label: 'HTTP MCP', x: 4.8, y: 1.8, note: '/mcp' },
      { id: 'stdio', label: 'stdio MCP', x: 4.8, y: 5.7, note: 'local proc' },
      { id: 'auth', label: 'auth', x: 6.8, y: 1.8, note: 'OAuth' },
      { id: 'gate', label: 'tool gate', x: 6.8, y: 5.7, note: 'least priv' },
      { id: 'data', label: 'data/API', x: 8.8, y: 3.8, note: 'effect' },
      { id: 'log', label: 'audit log', x: 8.8, y: 6.3, note: 'trace' },
    ],
    edges: [
      { id: 'e-browser-http', from: 'browser', to: 'http' },
      { id: 'e-client-http', from: 'client', to: 'http' },
      { id: 'e-client-stdio', from: 'client', to: 'stdio' },
      { id: 'e-http-auth', from: 'http', to: 'auth' },
      { id: 'e-http-data', from: 'http', to: 'data' },
      { id: 'e-stdio-gate', from: 'stdio', to: 'gate' },
      { id: 'e-gate-data', from: 'gate', to: 'data' },
      { id: 'e-gate-log', from: 'gate', to: 'log' },
      { id: 'e-auth-log', from: 'auth', to: 'log' },
    ],
  }, { title });
}

function* protocolShape() {
  yield {
    state: architectureGraph('MCP standardizes the boundary between host and integrations'),
    highlight: { active: ['host', 'client', 'server', 'e-host-client', 'e-client-server'], found: ['tools', 'resources', 'prompts'] },
    explanation: 'MCP is a protocol boundary. The host application owns the user experience and model access. MCP clients open sessions to MCP servers, which expose capabilities such as tools, resources, and prompt templates.',
  };

  yield {
    state: lifecycleGraph('Every session starts with version and capability negotiation'),
    highlight: { active: ['connect', 'init', 'caps', 'e-connect-init', 'e-init-caps'], compare: ['list', 'call'] },
    explanation: 'The initialization phase establishes protocol version compatibility, exchanges client and server capabilities, and shares implementation metadata before normal operation begins.',
    invariant: 'Discovery is capability-gated, not guessed from ad hoc endpoints.',
  };

  yield {
    state: labelMatrix(
      'JSON-RPC message types',
      [
        { id: 'request', label: 'request' },
        { id: 'response', label: 'response' },
        { id: 'error', label: 'error' },
        { id: 'notify', label: 'notification' },
      ],
      [
        { id: 'id', label: 'ID rule' },
        { id: 'purpose', label: 'purpose' },
      ],
      [
        ['string/int id', 'start operation'],
        ['same id', 'return result'],
        ['same id if known', 'return failure'],
        ['no id', 'one-way event'],
      ],
    ),
    highlight: { active: ['request:id', 'response:id', 'notify:id'], compare: ['error:purpose'] },
    explanation: 'The base protocol rides on JSON-RPC 2.0. Requests and responses are correlated by IDs. Notifications are one-way and do not expect replies. That small message grammar is the data structure of the whole protocol.',
  };

  yield {
    state: architectureGraph('Server features have different control semantics'),
    highlight: { active: ['server', 'tools', 'resources', 'prompts', 'roots', 'model', 'e-server-tools', 'e-server-resources', 'e-server-prompts', 'e-client-roots'], compare: ['e-model-tools'] },
    explanation: 'Tools are model-controlled actions, resources are application-driven context, prompts are user-controlled templates, and roots are client-provided filesystem boundaries. Lumping them together loses the security model.',
  };

  yield {
    state: labelMatrix(
      'MCP feature ownership',
      [
        { id: 'tools', label: 'tools' },
        { id: 'resources', label: 'resources' },
        { id: 'prompts', label: 'prompts' },
        { id: 'roots', label: 'roots' },
        { id: 'sampling', label: 'sampling' },
      ],
      [
        { id: 'owner', label: 'exposed by' },
        { id: 'control', label: 'control idea' },
      ],
      [
        ['server', 'model may invoke'],
        ['server', 'app selects context'],
        ['server', 'user selects template'],
        ['client', 'workspace boundary'],
        ['client', 'client owns model'],
      ],
    ),
    highlight: { found: ['tools:control', 'resources:control', 'prompts:control', 'roots:control', 'sampling:control'] },
    explanation: 'The protocol is not just tool calling. It is a capability map over actions, context, templates, filesystem scope, and nested model sampling. Each feature has a different owner and control surface.',
  };
}

function* securityModel() {
  yield {
    state: labelMatrix(
      'Transport choice',
      [
        { id: 'stdio', label: 'stdio' },
        { id: 'http', label: 'Streamable HTTP' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'security', label: 'security focus' },
      ],
      [
        ['local subprocess', 'env credentials'],
        ['POST/GET endpoint', 'auth and origin'],
      ],
    ),
    highlight: { active: ['stdio:shape', 'http:shape'], compare: ['stdio:security', 'http:security'] },
    explanation: 'MCP currently defines stdio and Streamable HTTP as standard transports. Stdio is local process communication. Streamable HTTP is a networked endpoint that may stream with SSE and needs normal web security discipline.',
  };

  yield {
    state: securityGraph('Remote MCP adds a browser-to-local-server risk'),
    highlight: { active: ['browser', 'http', 'auth', 'e-browser-http', 'e-http-auth'], removed: ['data'], compare: ['stdio'] },
    explanation: 'The Streamable HTTP spec calls out DNS rebinding risk: a malicious web page may try to reach a local MCP server. HTTP servers must validate Origin, bind local servers to localhost when local, and use proper authentication.',
    invariant: 'A local MCP server is still an attack surface if a browser can reach it.',
  };

  yield {
    state: securityGraph('Tool gates protect the effect, not only the message'),
    highlight: { active: ['client', 'stdio', 'gate', 'data', 'log', 'e-client-stdio', 'e-stdio-gate', 'e-gate-data', 'e-gate-log'], compare: ['auth'] },
    explanation: 'A schema-valid tool call can still be unsafe. The application needs least privilege, user confirmation for high-impact operations, rate limits, approval states, and audit logs around the actual effect.',
  };

  yield {
    state: labelMatrix(
      'Security review map',
      [
        { id: 'origin', label: 'origin' },
        { id: 'auth', label: 'auth' },
        { id: 'scope', label: 'scope' },
        { id: 'human', label: 'human' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['who can connect?', 'DNS rebinding'],
        ['whose token?', 'confused deputy'],
        ['what resources?', 'overbroad access'],
        ['who approves?', 'silent side effect'],
        ['what happened?', 'no forensics'],
      ],
    ),
    highlight: { found: ['origin:question', 'auth:question', 'scope:question', 'human:question', 'trace:question'] },
    explanation: 'The protocol gives structure, but the application still decides policy. A review should map origins, tokens, resource scope, human approvals, and traces for every server.',
  };

  yield {
    state: labelMatrix(
      'Implementation checklist',
      [
        { id: 'schema', label: 'schemas' },
        { id: 'cursor', label: 'pagination' },
        { id: 'change', label: 'list changes' },
        { id: 'cancel', label: 'cancel' },
        { id: 'errors', label: 'errors' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'linked topic', label: 'linked topic' },
      ],
      [
        ['parseable calls', 'Constrained Decoding'],
        ['large registries', 'Cursor Pagination'],
        ['dynamic tools', 'Cache Invalidation'],
        ['long streams', 'Tail Latency'],
        ['debuggable RPC', 'Distributed Tracing'],
      ],
    ),
    highlight: { active: ['schema:why', 'cursor:why', 'change:why', 'cancel:why', 'errors:why'] },
    explanation: 'MCP looks simple until the integration grows. Then ordinary systems concerns return: schemas, pagination, change notifications, cancellation, error objects, tracing, and compatibility.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'protocol shape') yield* protocolShape();
  else if (view === 'security model') yield* securityModel();
  else throw new InputError('Pick an MCP view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'The Model Context Protocol, or MCP, is a versioned protocol for connecting AI host applications to external integrations. It is best understood as a capability protocol, not just a tool-calling wrapper. A host application runs one or more MCP clients. Those clients connect to MCP servers. Servers expose capabilities such as tools, resources, and prompts; clients may expose roots and sampling capabilities.',
        'The latest official specification used here is version 2025-11-25. Its base protocol is built on JSON-RPC 2.0 messages, lifecycle negotiation, and clear capability declarations: https://modelcontextprotocol.io/specification/2025-11-25/basic. That makes MCP a strong case study in API design: the protocol turns an open-ended agent integration problem into typed messages, version negotiation, schemas, and explicit feature ownership.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An MCP session starts with initialization. The client sends its supported protocol version, capabilities, and implementation metadata. The server responds with its version, server capabilities, and metadata. After that, the client can discover features with requests such as tools/list, resources/list, or prompts/list, and then call or read the selected feature. The lifecycle page documents initialization, operation, and shutdown: https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle.',
        'The important distinction is ownership. Tools are server-exposed actions that a model may invoke, with names and input schemas: https://modelcontextprotocol.io/specification/2025-11-25/server/tools. Resources are server-exposed context objects identified by URIs: https://modelcontextprotocol.io/specification/2025-11-25/server/resources. Prompts are server-exposed templates intended for user selection: https://modelcontextprotocol.io/specification/2025-11-25/server/prompts. Roots are client-exposed filesystem boundaries: https://modelcontextprotocol.io/specification/2025-11-25/client/roots. Sampling lets servers request model generation through the client while the client keeps control over model access: https://modelcontextprotocol.io/specification/2025-11-25/client/sampling.',
      ],
    },
    {
      heading: 'Data structures and transport',
      paragraphs: [
        'The base message data structures are small but consequential. A request has jsonrpc, id, method, and optional params. A response returns the same id plus result or error. A notification has no id and expects no response. JSON Schema validates tool inputs and other structured fields, so this topic links directly to Constrained Decoding and schema-first tool calling.',
        'MCP defines two standard transports: stdio and Streamable HTTP. Stdio launches a local subprocess and frames JSON-RPC messages over standard input and output. Streamable HTTP uses a single HTTP endpoint with POST and GET; servers may use Server-Sent Events for streamed server messages. The transport page also records the security requirements around Origin validation, localhost binding, and authentication: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports.',
      ],
    },
    {
      heading: 'Security and case-study lessons',
      paragraphs: [
        'MCP does not remove the Prompt Injection Threat Model; it gives the application better places to enforce it. The model may propose a tool call, but the host should still show the tool, validate the schema, check authorization, ask for approval when needed, and log the effect. For HTTP transports, authorization is optional, but when implemented it follows a selected OAuth-based framework; stdio servers should retrieve credentials from the environment instead: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization.',
        'The main security lesson is separation of control surfaces. Tools are effects. Resources are context. Prompts are templates. Roots are scope. Sampling is model access. Each needs different policy. A secure MCP deployment maps origins, tokens, resource boundaries, side effects, human approvals, cancellation behavior, and audit traces before calling the integration done.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat MCP as magic interoperability. It standardizes the protocol boundary, but it does not decide which tools are safe, which data should enter context, or which user should approve an operation. Do not expose a broad filesystem root because a server asks for context. Do not expose remote HTTP MCP without Origin validation and authentication. Do not assume a schema-valid call is semantically safe.',
        'A second misconception is that every integration should be an MCP server. If the feature is internal, stable, and used only by one app, ordinary service code may be simpler. MCP shines when independent clients need to discover and use independent integrations through a shared, inspectable protocol.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MCP Overview at https://modelcontextprotocol.io/specification/2025-11-25/basic, Lifecycle at https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle, Transports at https://modelcontextprotocol.io/specification/2025-11-25/basic/transports, Tools at https://modelcontextprotocol.io/specification/2025-11-25/server/tools, Resources at https://modelcontextprotocol.io/specification/2025-11-25/server/resources, Prompts at https://modelcontextprotocol.io/specification/2025-11-25/server/prompts, Roots at https://modelcontextprotocol.io/specification/2025-11-25/client/roots, Sampling at https://modelcontextprotocol.io/specification/2025-11-25/client/sampling, Authorization at https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization, and JSON-RPC 2.0 at https://www.jsonrpc.org/specification. Study Agentic AI Patterns, Agent Model Router & Context Handoff Ledger, Agent2Agent Protocol Task State Case Study, Deep Research Agent Architecture Case Study, Prompt Injection Threat Model, Constrained Decoding, Agent Tool Permission Lattice, Seccomp BPF Sandbox Policy, Zanzibar Authorization Case Study, Capability Security & Attenuation, UCAN Delegation Proof Chain, OPA Rego Policy Decision Graph, Distributed Tracing, Message Queue, Service Workers, and Tail Latency next.',
      ],
    },
  ],
};
