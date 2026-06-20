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
      heading: 'Why this exists',
      paragraphs: [
        `JSON-RPC exists because many systems need a small, language-neutral way to say "call this named method with these parameters and tell me the result." Editors talk to language servers. Agent hosts talk to tools. Local applications talk to subprocesses. Services talk over HTTP or WebSocket. In all of those cases, the caller needs a compact envelope that can carry a request, a response, or an error without inventing a new protocol each time.`,
        `The data-structure lesson is not the JSON syntax. It is the correlation discipline. A request has a method, optional params, and maybe an id. A response carries the same id and either a result or an error. A notification omits the id, so the sender deliberately gives up the reply channel. That tiny shape creates a reliable join key between two asynchronous timelines.`,
        {type:`callout`, text:`JSON-RPC works because every asynchronous request and response carries enough envelope structure to rejoin the right timeline.`},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is to send a JSON object with a command string and wait for the next JSON object that comes back. That works for one request at a time on a perfect connection, but it collapses as soon as several calls are in flight. The first response may belong to the third request. A slow operation may return after a faster later one. A failed operation needs to report failure without looking like a successful result.`,
        `Another tempting shortcut is to rely on transport order. That is fragile. JSON-RPC can run over ordered streams, but the protocol still matches by id because servers may process work concurrently and batches may return responses in a different order. The id is the join key; array position and arrival order are not the contract.`,
      ],
    },
    {
      heading: 'Naive failure modes',
      paragraphs: [
        `Without a pending map, the client cannot safely connect a response to the promise or callback waiting for it. Without a timeout, a dropped response leaves the caller hanging forever. Without cleanup, completed calls leave stale entries and timers behind. Without duplicate-id protection, one response can wake the wrong caller.`,
        `Notifications are another common trap. A notification is valid when the sender truly does not need success or failure. It is wrong for commands that modify important state. If the server rejects a notification or never receives it, there is no response path to tell the caller what happened.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is that JSON-RPC separates message semantics from byte transport. The protocol says what a request, response, error, notification, and batch mean. A transport such as stdio, HTTP, WebSocket, or a custom framed stream decides how bytes are carried and where message boundaries are found.`,
        `That separation is why the envelope is so reusable. A method table on the server can dispatch by name. A pending map on the client can correlate by id. A structured error object can distinguish parse failure, invalid envelope, unknown method, invalid params, and internal failure. The transport can change without changing the core method vocabulary.`,
      ],
    },
    {
      heading: 'How the client works',
      paragraphs: [
        `A client starts by allocating an id that is unique among currently in-flight calls. It inserts a pending entry keyed by that id. The entry usually stores a resolver, rejecter, timeout handle, method name, cancellation state, and trace metadata. Only after the entry exists should the bytes be sent, because an immediate response can otherwise arrive before the caller is ready to match it.`,
        `When a response arrives, the client checks response.id, looks up the pending entry, and completes exactly that waiting call. A result resolves the promise. An error rejects it with the structured error object. Either path clears the timer and deletes the entry. A late response with no pending entry should be logged or ignored according to policy, not delivered to an arbitrary caller.`,
      ],
    },
    {
      heading: 'How the server works',
      paragraphs: [
        `The server receives a parsed envelope, validates that it has the required shape, and dispatches by method name. The method table is just a map from string to handler. Before the handler runs, params should be validated against the method's expected schema. After the handler runs, the server returns either a result or an error object with the same id.`,
        `The error object is a real interface, not decoration. Numeric codes let clients distinguish bad JSON, invalid request structure, missing methods, invalid params, and server-side failures. The optional data field can carry structured details for logs or user-facing diagnostics. Clients should not scrape error.message as a machine-readable API.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The envelope view proves that there are three different paths, not one generic message shape. A request with an id must eventually be matched by a result or error with that same id. A notification intentionally bypasses the pending map and never expects a response. Error and result are sibling outcomes of the same request, not separate protocols.`,
        `The pending-map view proves that the important client structure is an ordinary hash table with strict lifecycle rules. Create the entry, send the request, wait with a timeout, match by id, and clean up. Most production JSON-RPC bugs are not about parsing JSON; they are about violating one of those lifecycle steps under concurrency, cancellation, reconnects, or retries.`,
      ],
    },
    {
      heading: 'Batches and concurrency',
      paragraphs: [
        `A batch is an array of request and notification envelopes. It saves overhead when a client has several calls ready at once, but it does not remove the need for ids. The server may process batch entries in parallel, and the response array does not have to mirror request order. Notifications inside the batch produce no response objects.`,
        `This means batch clients must treat the response array as an unordered set keyed by id. Missing ids may mean notifications, server errors, transport failures, or broken implementations, depending on the envelope. A robust client records which ids were sent and resolves only those ids that actually return.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `JSON-RPC is small and easy to debug because messages are plain JSON. That simplicity is valuable for local tools, editor integrations, agent protocols, and services where human-readable traces matter. The cost is that JSON carries runtime parsing overhead, weak schema discipline unless the application adds validation, and no built-in streaming, authentication, authorization, retry, or exactly-once semantics.`,
        `The id field is also scoped to the connection or client context. It is not a global trace id and not an idempotency key. If a request times out and the client retries, the server may still execute the first request. Side-effecting methods need application-level idempotency keys, transactions, or compensating logic just like any other distributed command.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `JSON-RPC wins when the method vocabulary is moderate, the caller and server can agree on params/result schemas, and the transport is chosen for the environment. The Language Server Protocol uses JSON-RPC to let editors and language servers share hover, completion, diagnostics, rename, and formatting features. A single envelope shape carries many editor behaviors.`,
        `The Model Context Protocol also uses JSON-RPC-style envelopes for tool and resource interactions. The important lesson is that a modern agent or editor protocol does not need a custom wire format for every operation. It needs disciplined method names, structured params, capability negotiation, and the pending-map machinery that makes asynchronous calls safe.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The common failures are predictable: duplicate ids, leaked pending entries, missing timeouts, response-order assumptions, treating notifications as reliable commands, using prose errors as stable APIs, and retrying side effects without idempotency. Another frequent bug is conflating transport failure with application failure. A broken stream, a parse error, an unknown method, and a handler exception should not all become the same generic exception.`,
        `Security boundaries must be explicit. JSON-RPC does not authenticate the peer, authorize the method, rate-limit calls, validate schemas, or sandbox handlers. A local tool host that accepts JSON-RPC over stdio can still expose dangerous methods if the surrounding permission model is weak.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Hash Table for the pending map, Event Loop for promise scheduling, Message Queue for delivery and retry intuition, Distributed Tracing for correlation across service boundaries, and JSON Parser Stack Case Study for the parser underneath the envelope. Idempotency is the right next stop for safe retries of side-effecting methods.`,
        `Then study Model Context Protocol Case Study, Agent2Agent Protocol Task State Case Study, Schema Registry Case Study, Constrained Decoding, and AbortController Cancellation Signal Tree Case Study. Those topics show how a small envelope grows into a real tool protocol with schemas, capability negotiation, cancellation, observability, and permission checks.`,
      ],
    },
  ],
};
