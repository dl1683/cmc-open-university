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
      heading: 'How to read the animation',
      paragraphs: [
        {type:'callout', text:'MessageChannel is for one scoped conversation; BroadcastChannel is for disposable same-origin signals. The browser moves messages, but your protocol owns durability, ordering, and backpressure.'},
        'Read the channel view as endpoint ownership. MessageChannel creates two MessagePort endpoints; transferring one endpoint gives another context a private pipe back to the caller. Read the broadcast view as same-origin fanout: every live listener on the named channel can hear the signal, but the signal is not stored.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Browser apps are split across pages, tabs, workers, service workers, and frames. These contexts do not share one call stack, yet they need to coordinate login state, local data, cache changes, compute work, and network retry. Messaging APIs exist to cross those isolation boundaries without pretending every context shares one heap.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one global onmessage handler with a type field. That works until several features share the same mailbox, replies arrive out of order, or a tab navigates away while work is in flight. Another tempting approach is treating BroadcastChannel like shared state, but it is only a notification path.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is lifecycle and pressure. Workers can terminate, service workers can stop, tabs can close, and listeners can appear after a broadcast already happened. A fast producer can also post messages faster than a slow consumer can clone and process them, so transport alone does not create backpressure.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate conversation from announcement. MessageChannel is for a scoped request/reply pipe where the caller can track request IDs, timeouts, cancellation, and close behavior. BroadcastChannel is for small same-origin hints such as logout, cache dirty, document changed, or sync wakeup.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A page creates a MessageChannel, keeps port1, and transfers port2 to a worker, iframe, or service worker through postMessage. Both sides then receive message events on their port. A BroadcastChannel is opened by name; same-origin contexts that opened the same name receive posted messages from other channel objects.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'MessageChannel works because ownership of a port scopes the conversation. A reply on that port belongs to the feature that owns it, and request IDs connect replies to callers when several requests are in flight. BroadcastChannel works when messages are idempotent hints and durable truth is read from IndexedDB, Cache API, OPFS, or the server after the hint arrives.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'MessageChannel costs protocol state: one pending map entry, timeout, and cleanup path per in-flight request. BroadcastChannel costs fanout and structured-clone work; sending a 500 KB document to four tabs can clone roughly 2 MB of payload work. When tab count doubles, broadcast handling roughly doubles, so small hints beat large state dumps.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MessageChannel fits worker RPC, iframe bridges, service-worker replies, and delegated compute where one caller expects one answer. BroadcastChannel fits logout across tabs, local cache invalidation, local-first document changed hints, presence pings, settings changes, and waking a sync worker. A local-first editor often uses both: IndexedDB stores truth, BroadcastChannel wakes peers, and MessageChannel handles private sync calls.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'BroadcastChannel fails as a queue, database, authorization layer, or global ordering primitive. MessageChannel fails when ports stay open forever, request maps leak, or late replies update state after cancellation. Same-origin messaging still needs product-level permission checks because same origin is not the same as same user intent.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Tab A writes document version 184 to IndexedDB, then broadcasts { type: "doc-changed", id: "doc9", version: 184 }. Tabs B and C receive about 50 bytes of hint and load missing changes from IndexedDB instead of receiving a 500 KB document body. If Tab C was closed, it misses the hint but can still read version 184 when opened later.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN MessageChannel at https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel, MDN BroadcastChannel at https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel, MDN ServiceWorker.postMessage at https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorker/postMessage, and the HTML standard messaging sections at https://html.spec.whatwg.org/.',
        'Study Structured Clone and Transferables, Web Workers, Service Workers and Offline-First, IndexedDB Object Store Case Study, Web Streams Backpressure Queues, AbortController Cancellation Graph, Web Locks API Lock Manager, and Local-First Sync Engine Case Study.',
      ],
    },
  ],
};
