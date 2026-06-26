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
    explanation: 'Read the diagram as three envelope paths. A request with an id must eventually join to a result or error with the same id. A notification skips the pending map on purpose, so the sender has no success or failure channel.',
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
    explanation: 'The pending map is the whole client-side trick: id to resolver, timeout, method name, and trace metadata. When a response arrives, the id chooses which promise completes and which cleanup must happen.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each JSON-RPC message as an envelope. A request names a method, may include params, and carries an id if it expects a response. A response carries the same id and either result or error. A notification has no id, so it deliberately gives up the response path.',
        'Active nodes show the current message path. The pending-map view is the important client data structure: it joins an asynchronous response back to the promise or callback that is waiting for that id.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many systems need a small language-neutral way to say, "call this method with these parameters and tell me the result." Editors talk to language servers, agent hosts talk to tools, local applications talk to subprocesses, and services talk over HTTP, stdio, or WebSocket.',
        'JSON-RPC supplies the envelope and correlation rule. It does not prescribe one transport. The protocol says what requests, responses, errors, notifications, and batches mean, while the surrounding system decides how bytes move.',
        {type:'callout', text:'JSON-RPC works because every asynchronous request and response carries enough envelope structure to rejoin the right timeline.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to send a JSON object with a command string and wait for the next JSON object that comes back. That works for one call at a time on a perfect connection. It fails when several calls are in flight.',
        'A slow request may return after a faster later request. A failed request needs an error without pretending to be a successful result. A notification should not create a pending caller at all.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is correlation under concurrency. Arrival order is not the contract. Even on an ordered transport, the server may process work concurrently, and a batch response does not have to mirror request order.',
        'Without a pending map keyed by id, the client cannot safely wake the right caller. Without timeouts and cleanup, dropped responses leave stale entries. Without duplicate-id protection, one response can resolve the wrong operation.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The id is a join key between two asynchronous timelines. The client timeline creates a pending entry before sending the request. The server timeline later returns a result or error with the same id. The response handler joins them.',
        'Notifications prove the rule by omission. No id means no response is expected and no pending entry exists. That is correct for fire-and-forget signals and wrong for important state changes that need confirmation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client allocates an id unique among in-flight calls, inserts a pending entry with resolve, reject, timeout, method, and trace metadata, then sends the request bytes. Creating the entry before sending prevents an immediate response from arriving before the client can match it.',
        'When a response arrives, the client reads response.id, looks up the pending entry, and completes exactly that caller. A result resolves it, an error rejects it with structured code and data, and both paths clear the timer and delete the pending entry.',
        'A server parses an envelope, validates the shape, dispatches by method name, validates params, runs the handler, and returns either result or error with the same id. For notifications, it runs the handler or drops the message according to policy but returns no response.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on a lifecycle invariant. Every request with an id creates exactly one pending entry, and every response with that id completes at most that entry. After completion or timeout, the entry is removed.',
        'That invariant separates protocol errors from application errors. A broken stream, invalid JSON, an unknown method, invalid params, a handler exception, and a timeout are different states. Preserving the envelope and pending map lets the client report the right failure instead of guessing from arrival order.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup in the pending map is O(1) expected time per response. Memory is O(k), where k is the number of in-flight requests. If 5,000 calls are pending and each entry stores a resolver, timer, method, and trace id, the client carries 5,000 live records until they complete or timeout.',
        'The operational cost is outside the JSON syntax. JSON parsing takes CPU, schema validation takes code, and side-effecting retries need idempotency keys because the JSON-RPC id is not a global transaction id. A timed-out request may still execute on the server.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'JSON-RPC works well for editor protocols, subprocess tools, local agents, service control APIs, and systems with a moderate method vocabulary. The Language Server Protocol uses this shape to connect editors with completion, hover, diagnostics, rename, and formatting servers.',
        'Modern agent protocols use the same idea for tools and resources. The useful structure is method names, typed params, capability negotiation, cancellation, trace ids, and pending-map discipline on top of the small request-response envelope.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when notifications are used for commands that require confirmation. It also fails when clients assume response order, leak pending entries, reuse ids while old calls are alive, or retry side effects without idempotency.',
        'JSON-RPC also does not provide authentication, authorization, rate limits, sandboxing, streaming, retries, or exactly-once execution. Those are application and transport responsibilities, not properties of the envelope.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A client sends id 7 for textDocument/hover and id 8 for textDocument/completion. Completion is faster, so response id 8 arrives first with 20 items. The pending map resolves only the completion promise and leaves id 7 waiting.',
        'Then response id 7 arrives with hover text. The client resolves the hover promise and deletes entry 7. If id 9 times out after 5 seconds, the client rejects only id 9 and removes it; a late response for id 9 is logged or ignored by policy.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the JSON-RPC 2.0 specification and the Language Server Protocol specification. Study hash tables for pending maps, event loops for promise scheduling, message queues for delivery semantics, idempotency keys for retries, JSON parser stacks, and Model Context Protocol next.',
        'A useful exercise is to implement a tiny client that sends three requests and returns responses in reverse order. If the code uses arrival order, it fails. If it uses the id-keyed pending map, it resolves all three correctly.',
      ],
    },
  ],
};