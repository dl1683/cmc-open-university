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
        'The "protocol shape" view traces the architecture from host through client to server, then fans out to tools, resources, and prompts. Active nodes are the layer currently under discussion. Found nodes are capabilities that have been negotiated and are available. Compare nodes are participants whose role is being contrasted with the active set.',
        'The "security model" view traces the threat surface from transport choice through authentication and tool gating to the actual side effect. Active nodes are the security boundary in focus. Compare nodes show the alternative transport or auth path being contrasted.',
        {
          type: 'note',
          text: 'One safe inference rule: if a server node is active and its edge to a capability node is highlighted, that capability has been declared during initialization. If the capability node is not yet active, the client has not discovered or invoked it, and no model can use it.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          attribution: 'MCP specification, 2025-11-25',
          text: 'MCP provides a standardized way for AI models to discover and interact with context from various data sources and tools.',
        },
        'AI agents need to reach outside the model: read files, query databases, search the web, call APIs, run code, manage browser sessions. Each integration has its own authentication, schema format, transport, error shape, and security review. Without a shared protocol, every host application reinvents the glue. A coding assistant, a research chatbot, and an enterprise workflow engine each build private adapters for the same database or the same file system.',
        'That duplication is not just engineering waste. It is a security problem. When every integration is ad hoc, there is no shared place to enforce authorization, scope tool access, audit what the model asked for, or gate destructive actions. The boundary between "what the model wants" and "what the application allows" is implicit, buried in bespoke adapter code.',
        'The Model Context Protocol exists to standardize that boundary. It defines a JSON-RPC 2.0 message layer for connecting AI host applications to integration servers. Each server declares typed capabilities -- tools, resources, prompts -- and each client discovers them through a structured lifecycle. The result is one protocol where there were dozens of proprietary plugin formats.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first thing every team builds is a direct function call from the agent loop into service code. The model produces a JSON blob with a tool name and arguments; the orchestrator matches it against a hardcoded registry and calls the function.',
        {
          type: 'code',
          language: 'javascript',
          body: [
            '// The ad hoc approach: one function registry per host.',
            'const tools = {',
            '  readFile: (args) => fs.readFileSync(args.path, "utf-8"),',
            '  queryDB: (args) => db.query(args.sql),',
            '  searchWeb: (args) => fetch(`https://api.search.com?q=${args.q}`),',
            '};',
            '',
            'function handleToolCall(name, args) {',
            '  if (!tools[name]) throw new Error("Unknown tool: " + name);',
            '  return tools[name](args);  // No schema validation. No auth. No audit.',
            '}',
          ].join('\n'),
          text: [
            '// The ad hoc approach: one function registry per host.',
            'const tools = {',
            '  readFile: (args) => fs.readFileSync(args.path, "utf-8"),',
            '  queryDB: (args) => db.query(args.sql),',
            '  searchWeb: (args) => fetch(`https://api.search.com?q=${args.q}`),',
            '};',
            '',
            'function handleToolCall(name, args) {',
            '  if (!tools[name]) throw new Error("Unknown tool: " + name);',
            '  return tools[name](args);  // No schema validation. No auth. No audit.',
            '}',
          ].join('\n'),
        },
        'This works for one host and three tools. Then: the IDE wants the same database integration the chatbot has. The tool list grows to 40 entries. Schemas drift between hosts. Authentication is inconsistent -- some tools inherit the user session, some have hardcoded API keys, some have none. Nobody can answer "which tools can the model call, with whose credentials, and who approved it?" because that information is scattered across adapter files.',
        'The next step teams try is a REST API with natural-language descriptions pasted into the system prompt. The model reads the descriptions and generates HTTP requests. This fails differently: the model hallucinates endpoints, confuses GET and POST semantics, resources and actions blur together, and the security boundary is a paragraph of prose the model may or may not follow.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not "how do I call a tool." The wall is "who owns what."',
        'In an ad hoc integration, tools, context, and prompt templates are all lumped under "things the model can call." That conflation breaks three ways:',
        {
          type: 'table',
          headers: ['Conflation', 'What breaks', 'Concrete failure'],
          rows: [
            ['Tool = Resource', 'A database query is treated like a side-effecting action', 'The model "calls" a read-only context source but the host gates it with a destructive-action confirmation dialog, or vice versa -- a destructive tool runs without confirmation because it was registered as a resource'],
            ['Tool = Prompt', 'A reusable template is treated like a function', 'The model invokes a prompt template as if it were a tool call, passing arguments that make no sense, or the host cannot distinguish user-selected templates from model-initiated actions'],
            ['No workspace scope', 'A file server has no declared boundary', 'The model asks to read /etc/shadow or ~/.ssh/id_rsa because nothing told the server which directories are in scope'],
          ],
        },
        'The invariant that must hold: every capability exposed to a model must declare its kind (action, context, or template), its owner (server or client), and its control surface (model-controlled, application-controlled, or user-controlled). Without that declaration, the host cannot enforce policy because it does not know what kind of thing it is authorizing.',
        {
          type: 'note',
          text: 'A schema-valid tool call can still be the wrong action. MCP does not solve semantic safety. It solves structural ambiguity -- the host knows it is looking at a tool, not a resource, and can apply the right policy.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Integrations are not a flat list of functions. They are a typed capability map with different control surfaces for different kinds of things.',
        {
          type: 'table',
          headers: ['Capability', 'Exposed by', 'Controlled by', 'Purpose'],
          rows: [
            ['Tools', 'Server', 'Model (proposes), Host (gates)', 'Side-effecting actions: run query, send email, create file'],
            ['Resources', 'Server', 'Application (selects context)', 'Read-only data: file contents, database rows, API responses'],
            ['Prompts', 'Server', 'User (selects template)', 'Reusable message templates with argument slots'],
            ['Roots', 'Client', 'Client (declares scope)', 'Filesystem or workspace boundaries the server may reason about'],
            ['Sampling', 'Client', 'Client (owns model access)', 'Server asks client to run model generation; client keeps credentials'],
          ],
        },
        'MCP gives each surface a typed slot in the protocol. A server that exposes a database query as a tool is saying "this has side effects; the model may request it; the host should gate it." A server that exposes the same query result as a resource is saying "this is context; the application selects when to include it." The distinction is not cosmetic -- it determines the authorization path.',
        {
          type: 'diagram',
          alt: 'MCP capability ownership model showing which entity controls each capability type',
          label: 'Capability ownership and control flow',
          body: [
            '  Host (user-facing app)',
            '    |',
            '    +---> Client (MCP session)',
            '    |       |',
            '    |       +---> roots (client declares workspace scope)',
            '    |       +---> sampling (client owns model credentials)',
            '    |       |',
            '    |       +---> Server (integration boundary)',
            '    |               |',
            '    |               +---> tools   [model proposes, host gates]',
            '    |               +---> resources [app selects context]',
            '    |               +---> prompts  [user selects template]',
            '    |',
            '    +---> Model (LLM)',
            '            |',
            '            +---> reads resources (via context window)',
            '            +---> proposes tool calls (host decides execution)',
          ].join('\n'),
          text: [
            '  Host (user-facing app)',
            '    |',
            '    +---> Client (MCP session)',
            '    |       |',
            '    |       +---> roots (client declares workspace scope)',
            '    |       +---> sampling (client owns model credentials)',
            '    |       |',
            '    |       +---> Server (integration boundary)',
            '    |               |',
            '    |               +---> tools   [model proposes, host gates]',
            '    |               +---> resources [app selects context]',
            '    |               +---> prompts  [user selects template]',
            '    |',
            '    +---> Model (LLM)',
            '            |',
            '            +---> reads resources (via context window)',
            '            +---> proposes tool calls (host decides execution)',
          ].join('\n'),
        },
        'This separation is the design. MCP is not "tool calling with extra steps." It is a typed capability protocol that forces integrations to declare what kind of thing they are, who owns it, and who controls it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Every MCP session begins with a three-message handshake over JSON-RPC 2.0. The client sends an initialize request carrying its protocol version, supported capabilities, and implementation metadata. The server responds with its own version, capabilities, and metadata. The client then sends an initialized notification confirming readiness. No tool calls, resource reads, or prompt fetches can happen before this handshake completes.',
        {
          type: 'code',
          language: 'javascript',
          body: [
            '// 1. Client sends initialize request',
            '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{',
            '  "protocolVersion":"2025-11-25",',
            '  "capabilities":{"roots":{"listChanged":true},"sampling":{}},',
            '  "clientInfo":{"name":"my-ide","version":"1.0.0"}',
            '}}',
            '',
            '// 2. Server responds with its capabilities',
            '{"jsonrpc":"2.0","id":1,"result":{',
            '  "protocolVersion":"2025-11-25",',
            '  "capabilities":{"tools":{"listChanged":true},"resources":{},"prompts":{}},',
            '  "serverInfo":{"name":"db-server","version":"2.1.0"}',
            '}}',
            '',
            '// 3. Client confirms with initialized notification (no id = no response expected)',
            '{"jsonrpc":"2.0","method":"notifications/initialized"}',
          ].join('\n'),
          text: [
            '// 1. Client sends initialize request',
            '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{',
            '  "protocolVersion":"2025-11-25",',
            '  "capabilities":{"roots":{"listChanged":true},"sampling":{}},',
            '  "clientInfo":{"name":"my-ide","version":"1.0.0"}',
            '}}',
            '',
            '// 2. Server responds with its capabilities',
            '{"jsonrpc":"2.0","id":1,"result":{',
            '  "protocolVersion":"2025-11-25",',
            '  "capabilities":{"tools":{"listChanged":true},"resources":{},"prompts":{}},',
            '  "serverInfo":{"name":"db-server","version":"2.1.0"}',
            '}}',
            '',
            '// 3. Client confirms with initialized notification (no id = no response expected)',
            '{"jsonrpc":"2.0","method":"notifications/initialized"}',
          ].join('\n'),
        },
        'After initialization, the client discovers capabilities through list requests. tools/list returns every tool the server exposes, each with a name, description, and JSON Schema for its input. resources/list returns available context sources. prompts/list returns templates. The client caches these lists and, if the server declared listChanged capability, subscribes to change notifications so the cache stays current.',
        'Invocation uses the same JSON-RPC grammar. A tools/call request carries the tool name and arguments. The server validates, executes, and returns structured content (text, images, or embedded resources). resources/read fetches context by URI. prompts/get renders a template into messages. Every request has a numeric or string ID; the response carries the same ID. Notifications (progress updates, log messages, list-changed signals) carry no ID and expect no reply.',
        {
          type: 'table',
          headers: ['Message type', 'Has ID', 'Direction', 'Purpose'],
          rows: [
            ['Request', 'Yes', 'Either direction', 'Start an operation; expect a response'],
            ['Response (result)', 'Same ID as request', 'Reply to sender', 'Return success data'],
            ['Response (error)', 'Same ID as request', 'Reply to sender', 'Return failure with code and message'],
            ['Notification', 'No', 'Either direction', 'One-way event: progress, log, list change, cancelled'],
          ],
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'MCP works because it separates three concerns that ad hoc integrations conflate: discovery, invocation, and policy.',
        {
          type: 'bullets',
          items: [
            'Discovery is structured. The client knows what the server offers because it asked (tools/list, resources/list, prompts/list), not because someone pasted a description into a prompt. Capabilities have typed schemas, not prose.',
            'Invocation is typed. A tool call carries a JSON Schema-validated input object, not a free-form string. The server can reject malformed calls before execution. The response is structured content, not an untyped blob.',
            'Policy is the host\'s job. The protocol does not decide whether a tool call should execute. It gives the host the information needed to decide: the tool name, its schema, its arguments, and the server that declared it. The host can show a confirmation dialog, check an allowlist, rate-limit, or log -- because it knows what kind of thing is being requested.',
          ],
        },
        'The version negotiation handshake provides a forward-compatibility guarantee. A client that speaks 2025-11-25 and a server that speaks a future version can agree on the highest mutually supported version during initialization. New capabilities added in future versions are invisible to older clients because they are not declared during the handshake. This is the same pattern as TLS version negotiation: the protocol can evolve without breaking existing deployments.',
        {
          type: 'note',
          text: 'The critical invariant: after initialization completes, both sides agree on exactly which capabilities are available. The client will not call tools/call if the server did not declare tools capability. The server will not send roots/list if the client did not declare roots capability. Every operation is capability-gated, not guessed.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A developer opens a coding assistant (the host). The host spawns an MCP client that connects to a PostgreSQL MCP server over stdio. Here is the full session lifecycle:',
        {
          type: 'table',
          headers: ['Step', 'State before', 'JSON-RPC message', 'State after'],
          rows: [
            ['1. Connect', 'No session', 'Client spawns server subprocess, stdio pipes open', 'Transport ready, no protocol state'],
            ['2. Initialize', 'Transport ready', 'Client sends initialize with version 2025-11-25, roots capability', 'Awaiting server response'],
            ['3. Negotiate', 'Awaiting response', 'Server replies: version 2025-11-25, tools + resources capabilities', 'Both sides know capabilities'],
            ['4. Confirm', 'Negotiated', 'Client sends notifications/initialized', 'Session active, operations allowed'],
            ['5. Discover tools', 'Session active', 'Client sends tools/list', 'Server returns: query_table, insert_row, list_tables'],
            ['6. Discover resources', 'Tools cached', 'Client sends resources/list', 'Server returns: db://schema (database schema as context)'],
            ['7. Read context', 'Resources cached', 'Client sends resources/read for db://schema', 'Host injects schema into model context window'],
            ['8. Model proposes call', 'Schema in context', 'Model outputs: tools/call query_table {sql: "SELECT ..."}', 'Host intercepts before execution'],
            ['9. Host gates', 'Call intercepted', 'Host shows confirmation: "Run SQL query?"', 'User approves'],
            ['10. Execute', 'Approved', 'Client sends tools/call to server; server runs query', 'Server returns result rows as text content'],
            ['11. Shutdown', 'Operations complete', 'Client sends shutdown request, server acknowledges, exit notification', 'Session closed, subprocess exits'],
          ],
        },
        'Steps 7-9 show the separation in practice. The resource read (step 7) is application-controlled -- the host decides to include the schema. The tool call (step 8) is model-proposed but host-gated -- the host can show a dialog, check an allowlist, or reject silently. These are different authorization paths for different capability types, enforced by the protocol structure.',
      ],
    },
    {
      heading: 'Security model',
      paragraphs: [
        'MCP does not eliminate prompt injection, confused deputy attacks, or overbroad access. It provides enforcement points where the host can address them. The security model has five layers:',
        {
          type: 'table',
          headers: ['Layer', 'Question', 'MCP mechanism', 'Failure if absent'],
          rows: [
            ['Transport', 'Who can connect?', 'stdio (local process) or Streamable HTTP (network endpoint)', 'DNS rebinding: a malicious web page reaches a local HTTP MCP server'],
            ['Authentication', 'Whose credentials?', 'HTTP transport uses OAuth 2.1 framework; stdio inherits process environment', 'Confused deputy: server acts with wrong user\'s authority'],
            ['Scope', 'What can be accessed?', 'Roots declare filesystem boundaries; server capabilities are explicit', 'Overbroad access: model reads /etc/shadow through an unscoped file server'],
            ['Approval', 'Who authorizes the action?', 'Host gates tool calls; can require user confirmation for destructive ops', 'Silent side effect: model deletes a production database without confirmation'],
            ['Audit', 'What happened?', 'Structured JSON-RPC messages are loggable; tool calls have typed arguments', 'No forensics: incident review cannot reconstruct what the model requested'],
          ],
        },
        {
          type: 'note',
          text: 'The MCP specification (2025-11-25) calls out DNS rebinding explicitly: a local HTTP MCP server must validate the Origin header and bind to localhost. Without this, any web page the user visits can send requests to the local MCP server and invoke tools with the user\'s ambient credentials.',
        },
        'For stdio transport, credentials flow through environment variables inherited by the subprocess. The server never sees an OAuth token -- it gets a database connection string or API key from its environment. This is simpler but requires the host to control which environment variables the subprocess inherits. Leaking an API key to a malicious MCP server is a credential exfiltration, not a protocol bug.',
        'For HTTP transport, the 2025-11-25 authorization section defines an optional OAuth 2.1-based flow. When supported, the client obtains a token and presents it with each request. The server validates the token and enforces scopes. When authorization is not supported, the server is either public or trusts the network boundary. The spec does not mandate auth -- it defines the shape when auth is present.',
        {
          type: 'code',
          language: 'javascript',
          body: [
            '// Host-side tool gate: the protocol gives you the data to decide.',
            'async function gateToolCall(serverName, toolName, args) {',
            '  // 1. Schema validation (reject malformed calls)',
            '  const tool = toolRegistry.get(serverName, toolName);',
            '  if (!tool) throw new Error("Unknown tool");',
            '  validate(tool.inputSchema, args);',
            '',
            '  // 2. Policy check (allowlist, deny dangerous tools)',
            '  if (policy.isDenied(serverName, toolName)) {',
            '    return { denied: true, reason: "Tool blocked by policy" };',
            '  }',
            '',
            '  // 3. Human approval for destructive operations',
            '  if (tool.annotations?.destructive) {',
            '    const approved = await ui.confirm(',
            '      `${toolName} wants to: ${tool.description}`,',
            '      { args }',
            '    );',
            '    if (!approved) return { denied: true, reason: "User rejected" };',
            '  }',
            '',
            '  // 4. Execute and audit',
            '  const result = await client.callTool(toolName, args);',
            '  auditLog.record({ serverName, toolName, args, result, timestamp: Date.now() });',
            '  return result;',
            '}',
          ].join('\n'),
          text: [
            '// Host-side tool gate: the protocol gives you the data to decide.',
            'async function gateToolCall(serverName, toolName, args) {',
            '  // 1. Schema validation (reject malformed calls)',
            '  const tool = toolRegistry.get(serverName, toolName);',
            '  if (!tool) throw new Error("Unknown tool");',
            '  validate(tool.inputSchema, args);',
            '',
            '  // 2. Policy check (allowlist, deny dangerous tools)',
            '  if (policy.isDenied(serverName, toolName)) {',
            '    return { denied: true, reason: "Tool blocked by policy" };',
            '  }',
            '',
            '  // 3. Human approval for destructive operations',
            '  if (tool.annotations?.destructive) {',
            '    const approved = await ui.confirm(',
            '      `${toolName} wants to: ${tool.description}`,',
            '      { args }',
            '    );',
            '    if (!approved) return { denied: true, reason: "User rejected" };',
            '  }',
            '',
            '  // 4. Execute and audit',
            '  const result = await client.callTool(toolName, args);',
            '  auditLog.record({ serverName, toolName, args, result, timestamp: Date.now() });',
            '  return result;',
            '}',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'MCP is not free. It adds protocol surface that a simple integration does not need.',
        {
          type: 'table',
          headers: ['Cost', 'What you pay', 'When it matters'],
          rows: [
            ['Process overhead', 'One subprocess per stdio server, or one HTTP connection per remote server', 'An IDE with 10 MCP servers runs 10 subprocesses; startup latency and memory add up'],
            ['Initialization latency', 'Three-message handshake before any operation', 'Interactive tools where the user expects instant response on first action'],
            ['Schema maintenance', 'Every tool needs a JSON Schema for its input; schemas must stay current', 'Fast-moving integrations where the tool surface changes weekly'],
            ['Discovery round-trips', 'tools/list, resources/list, prompts/list before first use', 'Cold start on a server with hundreds of tools'],
            ['Security review surface', 'Each server is an attack surface; auth, origin checks, scope, audit', 'Every new MCP server needs a security review, not just a code review'],
            ['Version compatibility', 'Client and server must agree on protocol version during handshake', 'Rolling deployments where clients and servers upgrade at different times'],
          ],
        },
        'The dominant cost in practice is not message overhead -- JSON-RPC messages are small. The dominant cost is organizational: each MCP server is a security boundary that needs review, each tool needs a schema that needs maintenance, and each capability needs a policy decision about who can invoke it and under what conditions.',
        'MCP earns its cost when multiple hosts need the same integration. A PostgreSQL MCP server built once works in a coding assistant, a data-analysis chatbot, and an enterprise workflow engine. Without MCP, each host builds its own database adapter with its own schema format, auth story, and error handling. The protocol cost is paid once; the ad hoc cost is paid per host.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MCP is strongest where the integration boundary is reusable, the capability types are mixed (tools and resources, not just tools), and multiple hosts need the same server.',
        {
          type: 'bullets',
          items: [
            'IDE coding assistants: file system servers expose project files as resources and code actions (refactor, format, test) as tools. The IDE host gates destructive file writes. Multiple AI providers can use the same server.',
            'Database exploration: a database MCP server exposes schema as a resource (context for the model), read queries as tools, and write queries as separate tools requiring user confirmation. The host shows the SQL before execution.',
            'Browser automation: a browser MCP server exposes page content as resources and navigation/click/type actions as tools. The host can restrict which domains the server is allowed to visit.',
            'Enterprise knowledge bases: an internal wiki or document store exposes search as a tool and document content as resources. The server enforces access control per user token; the host never sees documents the user cannot access.',
            'Agent platforms: an orchestration layer connects to many MCP servers, discovers their capabilities, and presents a unified tool surface to the model. The platform enforces cross-server policies: rate limits, cost budgets, approval workflows.',
            'Local developer tools: git, Docker, and package manager servers expose status as resources and commands as tools. The host restricts which commands are available based on the project context.',
          ],
        },
        'MCP also serves as an organizational contract. Security teams review the server boundary, not every caller. Product teams decide which capabilities surface in which host. Platform teams maintain shared transport and logging infrastructure. Integration authors build against one protocol instead of reverse-engineering each agent runtime.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The first failure mode is capability overexposure. A file-system MCP server that declares no roots restriction gives the model access to the entire disk. A database server that exposes DROP TABLE as a tool without a destructive annotation lets a prompt injection delete production data through a properly formatted JSON-RPC call.',
        {
          type: 'table',
          headers: ['Failure mode', 'Mechanism', 'Mitigation'],
          rows: [
            ['Overbroad scope', 'Server exposes all files or all API endpoints', 'Roots restrict filesystem; server should expose minimal capability set'],
            ['Missing approval gate', 'Host auto-approves all tool calls', 'Destructive tools require user confirmation; allowlists for auto-approval'],
            ['Prompt injection through resources', 'Malicious content in a resource enters the context window and manipulates the model', 'Resource content is data, not instructions; host should sanitize or sandbox'],
            ['Credential leakage', 'stdio server inherits environment with unrelated API keys', 'Host controls which env vars the subprocess sees; principle of least privilege'],
            ['Stale capability cache', 'Server adds a destructive tool; client still has old list', 'Subscribe to listChanged notifications; re-list on reconnect'],
            ['No audit trail', 'Tool calls are not logged', 'Host logs every tools/call request and response; structured messages make this straightforward'],
          ],
        },
        'The second failure mode is operational. Long-running tool calls need cancellation (the protocol supports notifications/cancelled). Large tool registries need pagination (the protocol supports cursored list responses). Dynamic servers that add or remove tools need change notifications (the protocol supports notifications/tools/list_changed). Servers that do not implement these mechanisms work in demos but break in production.',
        {
          type: 'note',
          text: 'The deepest MCP failure is semantic, not structural. A tool call can satisfy its JSON Schema, pass the host\'s policy check, and still do the wrong thing -- because the model misunderstood the tool description, or because the description was manipulated by injected content in the context window. MCP makes the wrong action auditable. It does not make it impossible.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: the MCP specification (2025-11-25) at https://modelcontextprotocol.io/specification/2025-11-25 -- covers the base protocol, lifecycle, transports (stdio and Streamable HTTP), server features (tools, resources, prompts), client features (roots, sampling), and authorization. Secondary source: the JSON-RPC 2.0 specification at https://www.jsonrpc.org/specification, which defines the message grammar MCP rides on.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: JSON-RPC 2.0 -- understand request/response correlation by ID, error objects, and one-way notifications before studying MCP message flow.',
            'Prerequisite: OAuth 2.1 -- the HTTP transport authorization section assumes familiarity with token-based auth flows.',
            'Extension: Agent Tool Permission Lattice -- how to model fine-grained tool permissions as a lattice of allow/deny/ask policies.',
            'Extension: Capability Security and Attenuation -- the theory behind unforgeable capability tokens and how they apply to MCP\'s typed capability model.',
            'Contrast: Agent2Agent Protocol (A2A) -- Google\'s protocol for agent-to-agent communication; MCP connects agents to tools, A2A connects agents to agents.',
            'Contrast: OpenAI function calling -- a model-level tool-calling convention without MCP\'s separation of tools, resources, prompts, roots, and sampling.',
            'Case study: Prompt Injection Threat Model -- the attack surface that MCP makes auditable but does not eliminate.',
          ],
        },
        'The engineering question for MCP is not whether your agent needs tools. Every agent needs tools. The question is whether the integration boundary is reusable enough, security-sensitive enough, and multi-host enough to justify the protocol overhead. If only one host will ever use the integration, a direct function call is simpler and correct. If two hosts need it, MCP pays for itself on the second one.',
      ],
    },
  ],
};

