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
    explanation: 'Read MCP as a boundary, not as a bag of tool calls. The host owns the user experience and model access; MCP clients open sessions to servers that expose specific capabilities such as tools, resources, and prompt templates.',
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
    explanation: 'A schema-valid tool call can still be the wrong action. The application needs least privilege, user confirmation for high-impact operations, rate limits, approval states, and audit logs around the actual effect.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows Model Context Protocol, or MCP, as a typed boundary between a model host and external capabilities. A host is the application running the model, a server exposes tools or data, and a tool is an action the model can request but should not silently own.',
        'Active nodes show the capability currently being negotiated or invoked, compare marks the trust boundary, and found marks a response that passed the protocol shape. The safe inference rule is this: a tool result is usable only when the host knows which server provided it, which arguments were sent, and which user authority allowed it.',
        {type:'callout', text:'MCP is a typed capability boundary where tools, resources, prompts, roots, and sampling have different owners and control rules.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LLM applications need access to files, databases, tickets, browsers, calendars, code search, and internal services. Without a common protocol, every integration becomes a custom plugin with its own permissions, schemas, errors, and audit story.',
        'MCP exists to make context and actions explicit. It gives hosts and servers a shared way to describe tools, resources, prompts, roots, and sampling requests so a model can use outside capabilities without treating every integration as an untyped chat message.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to paste everything into the prompt and let the model reply with text that some wrapper interprets. That works for demos because a single developer controls the prompt, the tool code, and the test data.',
        'A slightly more mature version defines a few JSON functions directly in the host. That is still workable while the tool set is small and the same team owns every permission boundary.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is ownership. The model should not decide by itself which local files are visible, which server may run commands, which database rows can be read, or which user action authorizes a write.',
        'String prompts do not carry enough structure for this. When context, permissions, tool schemas, user approval, and tool results share the same untyped channel, the host cannot reliably audit what happened or block confused-deputy behavior.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'MCP separates capability description from model language. Servers advertise typed tools and resources, hosts decide which servers and roots are available, and the model can request actions through structured calls instead of free-form instructions.',
        'The important move is that authority stays outside the model. The model can propose using a tool, but the host remains the control point for consent, routing, display, sandboxing, and logging.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An MCP client connects to a server, negotiates protocol capabilities, lists available tools or resources, and sends structured requests. A tool call contains a tool name and JSON arguments that the server validates before returning a typed result or error.',
        'Resources expose read-oriented context such as files or records, prompts expose reusable prompt templates, and roots tell servers which filesystem or workspace boundaries are in scope. Sampling lets a server ask the host model for generation, which keeps model access mediated by the host.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from typed boundaries and explicit ownership. If the host records the server, method, arguments, roots, user consent, and result, then a later audit can reconstruct which authority produced each piece of context.',
        'The protocol does not make a malicious server safe by itself. It works only when the host enforces the invariant that untrusted tool output is data, not new authority, and that every side effect passes through host policy.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is another network and policy layer in the agent loop. If one task needs 20 tool calls and each server round trip costs 80 ms, the protocol adds 1.6 seconds before counting the actual work done by the tools.',
        'Schema discipline pays for that overhead by reducing glue code. Adding a tenth server should add new capability descriptions and policies, not ten new prompt parsers that each fail differently.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MCP fits coding agents, research assistants, internal operations bots, document workflows, customer-support tools, and data-analysis assistants. The access pattern is a model that needs many external systems but should not receive blanket authority over them.',
        'It is strongest when organizations need repeatable integration and audit trails. A tool catalog with typed arguments is easier to review than a pile of prompts that tell the model how to call hidden APIs.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MCP fails when teams confuse protocol shape with security. A typed tool can still delete the wrong file, leak private data, or execute a prompt-injected instruction if the host grants too much authority.',
        'It also fails when everything is exposed as one giant tool. Large unscoped tools push policy back into natural language, which removes the reason to use a capability protocol in the first place.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a coding host connects to three MCP servers: filesystem with 6 allowed roots, GitHub with 12 tools, and browser with 5 tools. A request to update an issue uses one resource read, one search call, one file read, and one issue-comment tool call.',
        'The ledger should record 4 structured operations, their arguments, and the user authority behind the write. If the model later claims it edited code, the audit can show that no filesystem write tool was called, so the claim is not supported by the actual capability trace.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the official Model Context Protocol specification and SDK documentation for current method names, transport rules, tool schemas, resources, prompts, roots, and sampling behavior. Use host implementation docs for security because policy lives above the wire format.',
        'Study next: JSON-RPC for request-response framing, capability security, sandbox design, prompt injection defenses, audit logs, least privilege, and agent trace span trees.',
      ],
    },
  ],
};
