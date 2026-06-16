// JSON-RPC 2.0: tiny message envelopes, request IDs, pending maps,
// notifications, batches, and error objects for tool and editor protocols.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'json-rpc-protocol-case-study',
  title: 'JSON-RPC Protocol Case Study',
  category: 'Systems',
  summary: 'A protocol data-structure primer: request envelopes, response IDs, pending promise maps, notifications, batches, and structured errors.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['message envelopes', 'pending map'], defaultValue: 'message envelopes' },
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

function rpcGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.8, y: 3.6, note: 'caller' },
      { id: 'pending', label: 'pending', x: 2.7, y: 1.7, note: 'id map' },
      { id: 'transport', label: 'transport', x: 2.9, y: 5.6, note: 'stdio/http/ws' },
      { id: 'server', label: 'server', x: 5.0, y: 3.6, note: 'dispatcher' },
      { id: 'methods', label: 'methods', x: 7.1, y: 1.8, note: 'table' },
      { id: 'error', label: 'error', x: 7.1, y: 5.4, note: 'code+msg' },
      { id: 'response', label: 'response', x: 9.1, y: 3.6, note: 'same id' },
    ],
    edges: [
      { id: 'e-client-pending', from: 'client', to: 'pending', weight: 'id -> resolver' },
      { id: 'e-client-transport', from: 'client', to: 'transport', weight: 'JSON' },
      { id: 'e-transport-server', from: 'transport', to: 'server', weight: 'frame' },
      { id: 'e-server-methods', from: 'server', to: 'methods', weight: 'method' },
      { id: 'e-server-error', from: 'server', to: 'error', weight: 'fail' },
      { id: 'e-methods-response', from: 'methods', to: 'response', weight: 'result' },
      { id: 'e-error-response', from: 'error', to: 'response', weight: 'error' },
      { id: 'e-response-pending', from: 'response', to: 'pending', weight: 'match id' },
    ],
  }, { title });
}

function shapeGraph(title) {
  return graphState({
    nodes: [
      { id: 'req', label: 'Req', x: 1.0, y: 2.4, note: 'method + id' },
      { id: 'note', label: 'Note', x: 1.0, y: 5.1, note: 'method only' },
      { id: 'server', label: 'server', x: 3.7, y: 3.7, note: 'dispatch' },
      { id: 'ok', label: 'OK', x: 6.4, y: 2.2, note: 'result + id' },
      { id: 'err', label: 'Err', x: 6.4, y: 5.2, note: 'error + id' },
      { id: 'pending', label: 'pending', x: 8.8, y: 3.7, note: 'match id' },
    ],
    edges: [
      { id: 'e-req-server', from: 'req', to: 'server', weight: 'call' },
      { id: 'e-note-server', from: 'note', to: 'server', weight: 'no id' },
      { id: 'e-server-ok', from: 'server', to: 'ok', weight: 'success' },
      { id: 'e-server-err', from: 'server', to: 'err', weight: 'failure' },
      { id: 'e-ok-pending', from: 'ok', to: 'pending', weight: 'same id' },
      { id: 'e-err-pending', from: 'err', to: 'pending', weight: 'same id' },
    ],
  }, { title });
}

function* messageEnvelopes() {
  yield {
    state: shapeGraph('JSON-RPC has three core envelope paths'),
    highlight: { active: ['req', 'server', 'ok', 'err', 'pending', 'e-req-server', 'e-server-ok', 'e-server-err', 'e-ok-pending', 'e-err-pending'], compare: ['note', 'e-note-server'] },
    explanation: 'JSON-RPC is small because the envelope is small. Requests carry a method name, optional params, and an id. Responses carry the same id with either result or error. Notifications omit id, so they intentionally cannot be answered.',
  };

  yield {
    state: rpcGraph('A request id is the join key between two timelines'),
    highlight: { active: ['client', 'pending', 'transport', 'server', 'e-client-pending', 'e-client-transport', 'e-transport-server'], compare: ['response'] },
    explanation: 'The client generates an id, stores a resolver in a pending map, serializes a JSON object, and sends it over a transport. The transport can be stdio, HTTP, WebSocket, or another ordered framing layer.',
    invariant: 'JSON-RPC defines message semantics; a separate transport defines how bytes are framed and delivered.',
  };

  yield {
    state: rpcGraph('The server dispatches by method and returns result or error'),
    highlight: { active: ['server', 'methods', 'error', 'response', 'e-server-methods', 'e-methods-response', 'e-server-error', 'e-error-response'], found: ['transport'] },
    explanation: 'The server looks up the method name in a dispatch table. Success returns a result object. Failure returns an error object with a numeric code, message, and optional data. Either way, a normal request gets exactly one response.',
  };

  yield {
    state: labelMatrix(
      'Error object discipline',
      [
        { id: 'parse', label: 'Parse error' },
        { id: 'invalid', label: 'Invalid Request' },
        { id: 'method', label: 'Method not found' },
        { id: 'params', label: 'Invalid params' },
        { id: 'internal', label: 'Internal error' },
      ],
      [
        { id: 'when', label: 'when' },
        { id: 'data structure lesson', label: 'data structure lesson' },
      ],
      [
        ['bad JSON', 'cannot trust envelope'],
        ['wrong shape', 'schema gate failed'],
        ['unknown method', 'dispatch table miss'],
        ['bad params', 'method schema failed'],
        ['server failure', 'separate transport from app error'],
      ],
    ),
    highlight: { active: ['method:data structure lesson', 'params:data structure lesson'], removed: ['parse:when'] },
    explanation: 'The error codes are not decoration. They let clients separate framing problems, method lookup failures, parameter validation, and application crashes without scraping prose.',
  };
}

function* pendingMap() {
  yield {
    state: rpcGraph('Pending map turns async responses into promises'),
    highlight: { active: ['client', 'pending', 'response', 'e-client-pending', 'e-response-pending'], compare: ['server'] },
    explanation: 'The client-side core is a hash map from request id to resolver, timeout, method name, and trace metadata. When a response with the same id arrives, the client resolves or rejects the stored promise and deletes the entry.',
  };

  yield {
    state: labelMatrix(
      'Pending entry lifecycle',
      [
        { id: 'create', label: 'create id' },
        { id: 'send', label: 'send request' },
        { id: 'wait', label: 'wait' },
        { id: 'match', label: 'match response' },
        { id: 'cleanup', label: 'cleanup' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'failure if skipped', label: 'failure if skipped' },
      ],
      [
        ['pending[id] = resolver', 'cannot correlate response'],
        ['bytes on transport', 'resolver leaks on send failure'],
        ['timeout ticking', 'hung promise forever'],
        ['id lookup', 'wrong caller gets result'],
        ['delete entry', 'memory leak and stale timeout'],
      ],
    ),
    highlight: { active: ['create:state', 'match:state', 'cleanup:state'], compare: ['wait:failure if skipped'] },
    explanation: 'The data structure is simple but production-critical. Timeouts, cancellation, duplicate responses, late responses, and connection resets all become pending-map maintenance problems.',
  };

  yield {
    state: labelMatrix(
      'Protocol examples',
      [
        { id: 'mcp', label: 'MCP' },
        { id: 'lsp', label: 'LSP' },
        { id: 'localtools', label: 'local tool host' },
        { id: 'batch', label: 'batch mode' },
      ],
      [
        { id: 'message use', label: 'message use' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['initialize, tools/list, tools/call', 'capabilities ride inside params/result'],
        ['textDocument/* methods', 'editor features share one envelope'],
        ['stdio messages', 'transport can be local process IO'],
        ['array of requests', 'responses may arrive unordered'],
      ],
    ),
    highlight: { active: ['mcp:message use', 'lsp:message use'], found: ['localtools:lesson'], compare: ['batch:lesson'] },
    explanation: 'JSON-RPC survives because many protocols need the same core shape: method dispatch, typed-ish params, response correlation, notifications, and transport independence.',
  };

  yield {
    state: rpcGraph('Notifications deliberately skip the pending map'),
    highlight: { active: ['client', 'transport', 'server', 'e-client-transport', 'e-transport-server'], removed: ['pending', 'response', 'e-client-pending', 'e-response-pending'] },
    explanation: 'A notification is fire-and-forget. It is appropriate for events where the sender does not need confirmation. It is dangerous for commands that need reliability, because there is no response channel for success or failure.',
    invariant: 'No id means no pending entry, no response, and no caller-visible error.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'message envelopes') yield* messageEnvelopes();
  else if (view === 'pending map') yield* pendingMap();
  else throw new InputError('Pick a JSON-RPC view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'JSON-RPC 2.0 is a small remote procedure call protocol built from JSON objects. Its value for data-structure study is the envelope. A request has a method name, optional params, and an id. A response has the same id and either a result or an error. A notification is a request without an id, so the server does not reply.',
        'The official JSON-RPC 2.0 specification defines request, response, notification, error, and batch message shapes: https://www.jsonrpc.org/specification. That tiny shape is enough to power editor protocols, tool protocols, local subprocess tools, and network services because it separates method semantics from the transport that carries bytes.',
      ],
    },
    {
      heading: 'Data structures inside the client',
      paragraphs: [
        'The central client data structure is the pending map: id to resolver, timeout, method name, cancellation handle, and trace context. When the client sends a request, it inserts a pending entry. When a response arrives, it uses response.id to find the entry, resolves or rejects the promise, clears the timeout, and deletes the map entry.',
        'That map is where many bugs live. Reusing ids can deliver a result to the wrong caller. Forgetting cleanup leaks memory and timers. Missing timeouts creates hung promises. Late responses after reconnect must be recognized as stale. This is why JSON-RPC is a good systems primer: the wire format is simple, but correctness depends on disciplined correlation and lifecycle management.',
      ],
    },
    {
      heading: 'Server dispatch and errors',
      paragraphs: [
        'The server side is a method table. The dispatcher receives a method string, validates params, runs the handler, and returns either result or error. The standard error object has a numeric code, message, and optional data. That structure lets clients distinguish parse errors, invalid request envelopes, unknown methods, invalid params, and internal errors without relying on text matching.',
        'Batches add another layer. A batch is an array of request and notification objects. The response is an array of responses for the requests that require replies. Notifications inside the batch do not get response objects. Implementations therefore need to match by id, not by array position, especially when work is parallelized.',
      ],
    },
    {
      heading: 'Complete case study: MCP and LSP',
      paragraphs: [
        'The Model Context Protocol uses JSON-RPC as its base message layer. MCP then adds lifecycle negotiation, capabilities, tools, resources, prompts, roots, sampling, transports, and authorization on top. The MCP overview explicitly lists the base protocol as core JSON-RPC message types: https://modelcontextprotocol.io/specification/2025-11-25/basic. Study Model Context Protocol Case Study next to see these envelopes become tool calls and resource reads.',
        'The Language Server Protocol is another complete example. The LSP specification defines JSON-RPC request, response, and notification messages exchanged between editors and language servers: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/. Go-to-definition, hover, diagnostics, completion, and formatting all share the same envelope and differ mostly by method name and params/result schemas.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'JSON-RPC is not an authorization model, schema system, retry policy, or transport by itself. It says what the message object means; it does not say whether bytes are framed by HTTP, WebSocket, stdio, or another transport. It also does not guarantee exactly-once execution. If a request times out and the client retries, the server may still have executed the first request. Idempotency is an application contract, just as in Message Queues.',
        'Do not use notifications for operations where the caller needs success or failure. Do not assume response order equals request order. Do not treat error.message as a stable machine interface; use error.code and structured error.data. And do not forget observability: request id is not a distributed trace id, but it is a useful local correlation key that should connect to Distributed Tracing spans.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: JSON-RPC 2.0 specification at https://www.jsonrpc.org/specification, MCP current overview at https://modelcontextprotocol.io/specification/2025-11-25/basic, MCP lifecycle at https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle, and Language Server Protocol 3.17 at https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/.',
        'Study JSON Parser Stack Case Study for the parser underneath the message envelope, Hash Table for the pending map, Message Queue for delivery and retry intuition, Distributed Tracing for correlation across services, Constrained Decoding for schema-shaped outputs, Model Context Protocol Case Study for a modern AI-agent tool protocol built on these envelopes, and Agent2Agent Protocol Task State Case Study for the agent-to-agent task protocol that also maps its operations onto concrete bindings.',
      ],
    },
  ],
};
