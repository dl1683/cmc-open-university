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
        "Read the animation as the execution trace for Model Context Protocol (MCP) Case Study. A protocol case study for agent tool integration: JSON-RPC messages, lifecycle negotiation, tools, resources, prompts, transports, roots, and auth..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `AI applications need to connect to local files, databases, APIs, search indexes, prompts, and private tools. Without a shared protocol, each integration becomes a custom plugin with its own authentication story, schema style, transport, error shape, and security review. The result is duplicated adapter code and unclear boundaries between model behavior and application authority.`,
        `The Model Context Protocol, or MCP, exists to standardize that boundary. A host application runs MCP clients. Each client connects to an MCP server. Servers expose capabilities such as tools, resources, and prompts. Clients can expose boundaries such as roots and, in the 2025-11-25 spec, sampling. The protocol is not merely "tool calling"; it is a capability map for agent integrations.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The naive integration is a direct function call from the agent loop into some service code. It works for one app and one tool. Then the tool list grows, another client wants the same integration, tool schemas drift, auth becomes inconsistent, and nobody can tell whether the model, user, host, or server owns the action.`,
        `The next naive version is a REST API with natural-language descriptions pasted into a prompt. That also breaks down. A model can hallucinate endpoints, a client may not know which version the server expects, resources and prompts get confused with actions, and security checks are hidden behind prose. MCP replaces that with explicit JSON-RPC messages, lifecycle negotiation, discoverable capabilities, and typed schemas.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is that integrations need different control surfaces. Tools are actions. Resources are context. Prompts are templates. Roots are client-declared boundaries. Sampling lets a server ask the client for model work while the client keeps control of model access. Lumping those together as "tools" loses the security model.`,
        `MCP gives each surface a place in the protocol. The server declares what it can provide. The client decides what to list, read, call, approve, or send to the model. The host owns the user experience and policy. This separation is what makes MCP an API-design case study rather than just another agent library.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `In the 2025-11-25 specification, a session starts with initialization. The client sends a protocol version, client capabilities, and implementation metadata. The server replies with its version, server capabilities, and metadata. After that, the client can discover features through list requests, then call tools, read resources, or fetch prompts through normal JSON-RPC operations.`,
        `Requests and responses are correlated by IDs. Errors return through the same message grammar. Notifications have no ID and do not expect a reply. That small JSON-RPC structure matters because it gives cancellation, progress, logging, pagination, and error handling a stable foundation instead of burying everything in prompt text.`,
      ],
    },
    {
      heading: `Feature ownership`,
      paragraphs: [
        `Tools are server-exposed operations with names, descriptions, input schemas, and effect semantics. A model may request them, but the host can still gate execution. Resources are server-exposed context objects, often identified by URIs, and are usually selected by the application rather than freely invoked as effects. Prompts are reusable templates, often user-controlled.`,
        `Roots come from the client and describe workspace boundaries, such as directories the server may reason about. Sampling is the inverse direction: a server asks the client to run model generation, while the client keeps model credentials and policy. These ownership lines are the main thing to learn. MCP reduces confusion by forcing a server to say what kind of thing it is exposing.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The protocol-shape graph shows host to client to server before it shows tools, resources, and prompts. That order matters. The host is the user-facing application. The client is the session endpoint inside that host. The server is an integration boundary. The model is not the owner of the whole system.`,
        `The security graph compares stdio and Streamable HTTP. Stdio is local process communication, but it still needs least privilege because the local process may hold credentials. HTTP adds origin checks, authentication, browser reachability, and network exposure. The tool gate and audit log sit near the effect because a schema-valid JSON-RPC message can still be the wrong thing to do.`,
      ],
    },
    {
      heading: `Why the protocol works`,
      paragraphs: [
        `MCP works when it keeps discovery, invocation, and policy separate. Discovery tells the client what the server offers. Invocation carries typed parameters and structured responses. Policy decides whether an operation is allowed, whether a human must approve it, what data enters context, and how the effect is logged.`,
        `This is also why schema-first design matters. Tool input schemas make calls parseable and inspectable. Pagination handles large registries. Change notifications prevent stale lists. Cancellation prevents long operations from becoming stuck user experiences. Error objects and tracing make failures debuggable. Ordinary distributed-systems concerns return as soon as the integration becomes real.`,
      ],
    },
    {
      heading: `Security model`,
      paragraphs: [
        `MCP does not remove prompt injection risk. It gives the application better enforcement points. The model may propose a tool call, but the host should validate the schema, check authorization, show the requested effect when needed, ask for approval for high-impact operations, rate-limit risky actions, and log what happened.`,
        `For HTTP transports, the 2025-11-25 authorization page defines optional authorization behavior and points implementations toward an OAuth-based framework when authorization is supported. Stdio servers should not follow that HTTP authorization flow; they normally receive credentials through their environment. Remote and local HTTP servers must also consider Origin validation, localhost binding, DNS rebinding risk, and normal web security practice.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `The cost of MCP is protocol surface. A small internal feature may not need version negotiation, a server process, schemas, list operations, transport handling, and security review. Direct service code can be simpler when one host owns the whole feature and no other client needs to discover it.`,
        `MCP earns its keep when independent clients need a shared way to inspect and use independent integrations. It helps when tool schemas need to be explicit, when resources should be listed rather than hallucinated, when prompts should be reusable, when filesystem scope must be declared, and when auditability matters. The tradeoff is more structure up front for less integration chaos later.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `MCP is strong for IDEs, research assistants, enterprise chat apps, local developer tools, data-analysis workspaces, and agent platforms that need a repeatable integration boundary. A database server, file-search server, issue-tracker server, browser automation server, or internal knowledge server can expose capabilities once and be used by multiple hosts.`,
        `It is also useful as an organizational contract. Security teams can review the server boundary. Product teams can decide which capabilities appear in which host. Platform teams can maintain common transports and logging. Integration authors can build against one protocol instead of reverse-engineering every agent runtime.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The first failure mode is overbroad capability. A server that exposes a filesystem root, broad API token, or destructive tool without clear approval rules turns a protocol boundary into an escalation path. The second is semantic unsafety: a tool call can satisfy its schema and still delete the wrong thing, send private data, or act on injected instructions.`,
        `Other failures are operational. Long-running calls need cancellation and progress. Large lists need pagination. Dynamic capabilities need change notifications. Multiple server versions need compatibility handling. Errors need enough structure for the host to recover. A deployment without logs may pass demos and still fail incident review because nobody can reconstruct what the model asked for and what the host allowed.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Agentic AI Patterns, Agent Model Router & Context Handoff Ledger, Agent2Agent Protocol Task State Case Study, Deep Research Agent Architecture Case Study, Prompt Injection Threat Model, Constrained Decoding, Agent Tool Permission Lattice, Seccomp BPF Sandbox Policy, Zanzibar Authorization Case Study, Capability Security & Attenuation, UCAN Delegation Proof Chain, OPA Rego Policy Decision Graph, Distributed Tracing, Message Queue, Service Workers, and Tail Latency.`,
        `Primary sources are the MCP 2025-11-25 specification at https://modelcontextprotocol.io/specification/2025-11-25, base protocol at https://modelcontextprotocol.io/specification/2025-11-25/basic, lifecycle at https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle, transports at https://modelcontextprotocol.io/specification/2025-11-25/basic/transports, tools at https://modelcontextprotocol.io/specification/2025-11-25/server/tools, resources at https://modelcontextprotocol.io/specification/2025-11-25/server/resources, prompts at https://modelcontextprotocol.io/specification/2025-11-25/server/prompts, roots at https://modelcontextprotocol.io/specification/2025-11-25/client/roots, sampling at https://modelcontextprotocol.io/specification/2025-11-25/client/sampling, authorization at https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization, and JSON-RPC 2.0 at https://www.jsonrpc.org/specification.`,
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Why it works',
      paragraphs: [
        "Give the proof sketch as a preservation argument: invariant before, move, invariant after.",
        "If there is a nontrivial corner case, name it explicitly.",
        "When correctness is explicit, readers can transfer the method to new inputs.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for model-context-protocol-case-study, continue to the next topic in the same track.'
  ],
      },
],
};

