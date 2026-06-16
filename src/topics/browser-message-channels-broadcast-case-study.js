// Browser messaging topology: MessageChannel, MessagePort transfer,
// ServiceWorker client messages, BroadcastChannel fanout, and tab coordination.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'browser-message-channels-broadcast-case-study',
  title: 'Message Channels & Broadcast',
  category: 'Systems',
  summary: 'A browser coordination case study: MessageChannel request/reply pipes, Service Worker client messages, BroadcastChannel fanout, ordering, lifetime, and backpressure.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['channel topology', 'broadcast coordination'], defaultValue: 'channel topology' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function channelGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'page', label: 'page', x: 0.7, y: 4.0, note: notes.page ?? 'caller' },
      { id: 'ch', label: 'channel', x: 2.5, y: 4.0, note: notes.ch ?? 'creates ports' },
      { id: 'p1', label: 'port1', x: 4.1, y: 2.5, note: notes.p1 ?? 'kept' },
      { id: 'p2', label: 'port2', x: 4.1, y: 5.5, note: notes.p2 ?? 'transferred' },
      { id: 'worker', label: 'worker', x: 6.1, y: 5.5, note: notes.worker ?? 'callee' },
      { id: 'sw', label: 'svc wrk', x: 6.1, y: 2.5, note: notes.sw ?? 'proxy' },
      { id: 'reply', label: 'reply', x: 8.2, y: 4.0, note: notes.reply ?? 'message event' },
    ],
    edges: [
      { id: 'e-page-ch', from: 'page', to: 'ch', weight: '' },
      { id: 'e-ch-p1', from: 'ch', to: 'p1', weight: '' },
      { id: 'e-ch-p2', from: 'ch', to: 'p2', weight: '' },
      { id: 'e-p2-worker', from: 'p2', to: 'worker', weight: '' },
      { id: 'e-p2-sw', from: 'p2', to: 'sw', weight: '' },
      { id: 'e-worker-reply', from: 'worker', to: 'reply', weight: '' },
      { id: 'e-sw-reply', from: 'sw', to: 'reply', weight: '' },
      { id: 'e-reply-p1', from: 'reply', to: 'p1', weight: '' },
    ],
  }, { title });
}

function broadcastGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'tabA', label: 'tab A', x: 0.8, y: 2.3, note: notes.tabA ?? 'editor' },
      { id: 'tabB', label: 'tab B', x: 0.8, y: 5.7, note: notes.tabB ?? 'viewer' },
      { id: 'idb', label: 'IDB', x: 3.0, y: 2.3, note: notes.idb ?? 'durable' },
      { id: 'bc', label: 'channel', x: 4.7, y: 4.0, note: notes.bc ?? 'same origin' },
      { id: 'worker', label: 'worker', x: 6.7, y: 2.3, note: notes.worker ?? 'sync' },
      { id: 'sw', label: 'svc wrk', x: 6.7, y: 5.7, note: notes.sw ?? 'network' },
      { id: 'reload', label: 'reload', x: 8.7, y: 4.0, note: notes.reload ?? 'refresh state' },
    ],
    edges: [
      { id: 'e-tabA-idb', from: 'tabA', to: 'idb', weight: '' },
      { id: 'e-tabA-bc', from: 'tabA', to: 'bc', weight: '' },
      { id: 'e-bc-tabB', from: 'bc', to: 'tabB', weight: '' },
      { id: 'e-bc-worker', from: 'bc', to: 'worker', weight: '' },
      { id: 'e-bc-sw', from: 'bc', to: 'sw', weight: '' },
      { id: 'e-tabB-reload', from: 'tabB', to: 'reload', weight: '' },
      { id: 'e-worker-reload', from: 'worker', to: 'reload', weight: '' },
      { id: 'e-sw-reload', from: 'sw', to: 'reload', weight: '' },
    ],
  }, { title });
}

function* channelTopology() {
  yield {
    state: channelGraph('MessageChannel creates two entangled ports'),
    highlight: { active: ['page', 'ch', 'p1', 'p2', 'e-page-ch', 'e-ch-p1', 'e-ch-p2'] },
    explanation: 'MessageChannel gives the page two MessagePort endpoints. Keeping one port and transferring the other creates a private two-way pipe between execution contexts.',
    invariant: 'Transfer one endpoint, then talk over the port.',
  };

  yield {
    state: channelGraph('Transfer one port to a worker for request/reply', { p1: 'request map', p2: 'worker end', worker: 'handles', reply: 'response' }),
    highlight: { active: ['p2', 'worker', 'reply', 'p1', 'e-p2-worker', 'e-worker-reply', 'e-reply-p1'], found: ['reply'] },
    explanation: 'A page can send port2 to a worker using the structured-clone transfer list, then keep port1. Each request carries an id; replies come back on the same private channel without sharing a global onmessage handler.',
  };

  yield {
    state: labelMatrix(
      'Port protocol pieces',
      [
        { id: 'id', label: 'req id' },
        { id: 'abort', label: 'abort' },
        { id: 'queue', label: 'queue' },
        { id: 'close', label: 'close' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['match reply', 'leak map'],
        ['cancel work', 'late reply'],
        ['limit in', 'OOM'],
        ['end pipe', 'lost msg'],
      ],
    ),
    highlight: { found: ['id:job', 'queue:job'], compare: ['abort:risk', 'close:risk'] },
    explanation: 'MessagePort gives transport, not an application protocol. Production code still needs request ids, cancellation, in-flight limits, close handling, and timeout behavior.',
  };

  yield {
    state: channelGraph('Service workers can receive messages and answer clients', { sw: 'fetch proxy', p2: 'reply port', reply: 'client msg' }),
    highlight: { active: ['page', 'p2', 'sw', 'reply', 'p1', 'e-p2-sw', 'e-sw-reply', 'e-reply-p1'], compare: ['worker'] },
    explanation: 'ServiceWorker.postMessage uses structured clone too. A page can include a MessagePort for a direct reply path, while the service worker answers through the associated client or transferred port.',
  };

  yield {
    state: labelMatrix(
      'Messaging choice',
      [
        { id: 'worker', label: 'worker RPC' },
        { id: 'sw', label: 'SW reply' },
        { id: 'tabs', label: 'all tabs' },
        { id: 'big', label: 'big bytes' },
      ],
      [
        { id: 'tool', label: 'tool' },
        { id: 'why', label: 'why' },
      ],
      [
        ['MsgPort', 'private pipe'],
        ['MsgPort', 'reply path'],
        ['Broadcast', 'fanout'],
        ['transfer', 'no copy'],
      ],
    ),
    highlight: { found: ['worker:tool', 'sw:tool'], compare: ['tabs:tool', 'big:tool'] },
    explanation: 'Use MessageChannel when you need a scoped two-way conversation. Use BroadcastChannel when every same-origin context should hear the signal. Use transferables for heavy binary payloads.',
  };
}

function* broadcastCoordination() {
  yield {
    state: broadcastGraph('BroadcastChannel fans out to same-origin contexts'),
    highlight: { active: ['tabA', 'bc', 'tabB', 'worker', 'sw', 'e-tabA-bc', 'e-bc-tabB', 'e-bc-worker', 'e-bc-sw'] },
    explanation: 'BroadcastChannel is same-origin pub/sub for browsing contexts. Tabs, iframes, workers, and service workers can listen to a named channel and receive structured-cloned messages.',
    invariant: 'Broadcast is notification, not durable storage.',
  };

  yield {
    state: broadcastGraph('A tab writes durable state, then broadcasts a hint', { tabA: 'write doc', idb: 'commit', bc: 'doc changed', tabB: 'stale', reload: 'read IDB' }),
    highlight: { active: ['tabA', 'idb', 'bc', 'tabB', 'reload', 'e-tabA-idb', 'e-tabA-bc', 'e-bc-tabB', 'e-tabB-reload'], found: ['idb'] },
    explanation: 'A reliable pattern is write the durable state first, then broadcast a small invalidation or change hint. Other tabs treat the broadcast as a wakeup and reload the canonical local state.',
  };

  yield {
    state: labelMatrix(
      'Broadcast use cases',
      [
        { id: 'logout', label: 'logout' },
        { id: 'cache', label: 'cache inv' },
        { id: 'presence', label: 'presence' },
        { id: 'sync', label: 'sync wake' },
      ],
      [
        { id: 'message', label: 'message' },
        { id: 'source', label: 'source' },
      ],
      [
        ['session end', 'auth state'],
        ['key dirty', 'IDB/cache'],
        ['user here', 'soft state'],
        ['pull now', 'sync log'],
      ],
    ),
    highlight: { found: ['logout:message', 'cache:message', 'sync:message'], compare: ['presence:source'] },
    explanation: 'BroadcastChannel is excellent for small coordination signals: logout, cache invalidation, local-first document changed, presence hints, and waking a sync worker. Store important data elsewhere.',
  };

  yield {
    state: labelMatrix(
      'What it does not give',
      [
        { id: 'durable', label: 'durable' },
        { id: 'ordered', label: 'global ord' },
        { id: 'secure', label: 'authz' },
        { id: 'backp', label: 'backpress' },
      ],
      [
        { id: 'answer', label: 'answer' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['no', 'IDB/log'],
        ['no', 'version vec'],
        ['no', 'auth layer'],
        ['no', 'rate limit'],
      ],
    ),
    highlight: { removed: ['durable:answer', 'ordered:answer', 'secure:answer'], active: ['backp:fix'] },
    explanation: 'BroadcastChannel does not persist messages, define a total order across tabs, enforce authorization, or provide backpressure. It is a same-origin signaling bus, not a database or queue.',
  };

  yield {
    state: broadcastGraph('Local-first apps combine broadcast, IDB, and sync', { tabA: 'edit', idb: 'change log', bc: 'wake', worker: 'send diff', sw: 'offline', reload: 'converge' }),
    highlight: { active: ['tabA', 'idb', 'bc', 'worker', 'reload', 'e-tabA-idb', 'e-tabA-bc', 'e-bc-worker', 'e-worker-reload'], compare: ['sw'] },
    explanation: 'The complete browser pattern is layered: IndexedDB stores the truth, BroadcastChannel wakes local peers, MessageChannel handles scoped request/reply, Service Workers keep shell and retry paths alive, Background Sync drains outbound work, Web Push wakes inbound work, and the sync engine decides what changes move.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'channel topology') yield* channelTopology();
  else if (view === 'broadcast coordination') yield* broadcastCoordination();
  else throw new InputError('Pick a browser messaging view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Browser message coordination is more than worker.postMessage. MessageChannel creates two MessagePort endpoints for scoped two-way conversations. BroadcastChannel creates a named same-origin bus for one-to-many notification across tabs, iframes, workers, and service workers.',
        'These APIs sit on top of the same structured-clone and transferable-object machinery as Web Workers. A MessagePort is itself transferable: the page can create a channel, keep one port, and transfer the other to a worker, iframe, or service worker to establish a private reply path.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'MessageChannel returns port1 and port2. After port2 is transferred, the receiving context owns that endpoint. Messages sent through one port arrive as message events on the other. This is the browser equivalent of opening a private pipe instead of using one shared global mailbox.',
        'BroadcastChannel is a small pub/sub abstraction. Scripts join a named channel and post structured-cloneable messages. Every other listener on that same origin and channel receives the message. The sender does not receive its own broadcast in the usual page-local case, so local state updates should not rely on echo.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The data cost is still structured clone unless messages contain transferables. That means large payloads should move as ArrayBuffers, MessagePorts, ImageBitmaps, or small references to IndexedDB records. The protocol cost is yours: request ids, timeouts, in-flight limits, version checks, and close handling.',
        'BroadcastChannel is intentionally light. It is not durable, does not implement backpressure, and does not give a global total order for application state. Use it to wake other contexts, then read or sync from a durable source such as IndexedDB, Cache API, or a server log.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a local-first notes app with two tabs open. Tab A writes a CRDT change to IndexedDB and posts { type: "doc-changed", docId, heads } on a BroadcastChannel. Tab B hears the signal, compares heads, and reloads missing changes from IndexedDB. A dedicated worker receives a MessagePort for sync requests, batches missing updates, and transfers binary payloads to avoid copies.',
        'A service worker adds network resilience. It can receive messages from controlled clients, keep retry metadata, help wake Background Sync when connectivity returns, and react to Web Push when remote work arrives. The key discipline is layering: BroadcastChannel announces, IndexedDB persists, MessageChannel scopes request/reply, and the sync engine defines correctness.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not use BroadcastChannel as a database. Tabs can close, listeners can miss messages, and messages are not replayed. Do not put secrets or authorization decisions in a broadcast just because it is same-origin. Same-origin is a transport boundary, not your product permission model.',
        'Do not let unbounded request maps accumulate on MessagePorts. Every request id needs completion, cancellation, timeout, or cleanup. If the payload is large, send a reference or transfer a buffer rather than broadcasting cloned megabytes to every listener.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN MessageChannel at https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel, MDN Channel Messaging API at https://developer.mozilla.org/en-US/docs/Web/API/Channel_Messaging_API, MDN ServiceWorker.postMessage at https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorker/postMessage, MDN BroadcastChannel at https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel, and Chrome for Developers BroadcastChannel overview at https://developer.chrome.com/blog/broadcastchannel.',
        'Study Structured Clone & Transferables first because ports and payloads ride through that machinery. Then study Web Workers: A Second Thread, Service Workers & Offline-First, Cache Storage Versioned Precache, Background Sync Outbox Queue, Web Push Subscription Delivery, Web Streams Backpressure Queues, AbortController Cancellation Graph, Web Locks API Lock Manager, IndexedDB Object Store Case Study, Local-First Sync Engine Case Study, Collaborative Awareness Presence CRDT, Message Queue, Backpressure, and Transactional Outbox.',
      ],
    },
  ],
};
