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
      heading: 'Why this exists',
      paragraphs: [
        'Modern browser applications are no longer one script running in one page. A single app may have several tabs open, a dedicated worker doing CPU work, a shared worker coordinating state, a service worker handling network and cache behavior, and iframes or embedded contexts that need controlled communication. These contexts do not share a normal call stack, but they still need to coordinate.',
        'MessageChannel and BroadcastChannel exist because browser coordination needs two different shapes. Sometimes you need a private request/reply pipe between two contexts. Sometimes you need a same-origin announcement that every interested context can hear. Using one global message handler for both shapes becomes confusing quickly.',
        'The educational point is that transport is not protocol. The browser gives you structured-clone messages, transferable ports, and broadcast fanout. You still have to decide what a request means, how replies match requests, where durable state lives, how cancellation works, and what happens when a context closes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to attach one onmessage handler everywhere and switch on a type string. That works for a toy worker. It breaks when several subsystems share the same mailbox, when replies arrive out of order, when a request times out, when a page navigates away, or when two features accidentally reuse the same message shape.',
        'Another obvious approach is to use BroadcastChannel as if it were shared state. That is also wrong. BroadcastChannel is a same-origin signaling bus. It does not persist messages, replay history to late listeners, enforce authorization, or define a total order across all tabs.',
        'A third mistake is sending large objects everywhere. Structured clone is convenient, but cloning a big payload to every listener can create memory and latency problems. The better design often sends a small invalidation hint or durable ID, then lets each context read canonical state from IndexedDB, Cache API, OPFS, or the server.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to separate conversation from announcement. MessageChannel creates two entangled MessagePort endpoints. If one side keeps port1 and transfers port2 to another context, the two sides now have a scoped pipe. That is the right shape for request/reply, RPC-like worker calls, and service-worker reply paths.',
        'BroadcastChannel creates a named same-origin fanout channel. It is the right shape for logout, cache invalidation, document changed, presence hint, or sync wakeup signals. Every same-origin listener on the same channel may hear the event, but the event itself should usually be small and disposable.',
        'Once those shapes are separated, the rest of the architecture becomes clearer. MessagePort protocols need request IDs, cancellation, timeouts, backpressure, close handling, and versioning. Broadcast protocols need durable state elsewhere, idempotent handlers, and a way to recover if a message was missed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'MessageChannel starts by creating two ports. A page can keep one port and transfer the other to a worker, iframe, or service worker through postMessage with a transfer list. From then on, each side sends messages through its port, and the other side receives message events. The port is the conversation endpoint.',
        'BroadcastChannel starts by opening a channel with a name. Any same-origin context that opens that name can post messages and receive messages from other contexts. It is not a queue with retention. If a tab was closed or had not yet opened the channel, it cannot rely on receiving old events.',
        'Both APIs use structured clone for message payloads. That means plain data structures can move without manual JSON serialization, and transferables such as MessagePort, ArrayBuffer, and streams in related APIs can move ownership rather than copy bytes. But structured clone does not define application semantics. It only moves data.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The channel-topology view proves that a private pipe is made from ownership of two endpoints. The page creates a channel, keeps one port, and transfers the other. Once that transfer is complete, the worker or service worker can answer through the private path instead of competing on a global message handler.',
        'The protocol table proves that MessagePort is only the transport. If a page sends ten requests and the worker responds in a different order, request IDs must connect replies to callers. If the user navigates away, the port may close. If the worker is slow, the page needs timeouts and in-flight limits. Those behaviors are application protocol, not API magic.',
        'The broadcast view proves the durable-state pattern. Write the real state first, then broadcast a hint. Other contexts treat the hint as a reason to reload, compare versions, or wake a sync process. The hint is not the database.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because browser contexts already have isolation boundaries. Workers should not share normal heap objects with the page. Service workers may outlive a page and serve several clients. Tabs cannot safely mutate each other directly. Message passing gives those contexts a structured way to coordinate without pretending they share one process model.',
        'MessageChannel works well because it scopes a conversation. Instead of multiplexing every request through one mailbox, a feature can own a port, keep a request map, and close the port when the feature ends. That makes lifecycle easier to reason about.',
        'BroadcastChannel works well because many browser coordination events are not commands. They are announcements that something changed: authentication ended, a cache key is dirty, a document has new heads, a theme changed, or a sync worker should wake. Fanout is the natural shape for those events.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'MessageChannel adds protocol bookkeeping. You need request IDs, timeouts, cleanup, cancellation, error messages, and close behavior. Without those, a private pipe can still leak promises or memory. The benefit is that all of that bookkeeping is localized to the conversation instead of spread across global handlers.',
        'BroadcastChannel adds fanout cost. Every listener receives the message, and payloads are structured-cloned. A small event such as { type: "doc-changed", id } is cheap. Broadcasting a large document to every tab is wasteful and can block useful work. Durable state should live elsewhere.',
        'Both APIs also have lifetime tradeoffs. Workers can terminate. Tabs can close. Service workers can be stopped and restarted. A robust system must be able to reconstruct state from IndexedDB, Cache API, OPFS, a server log, or another durable source after any context disappears.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'MessageChannel wins for worker RPC, iframe bridges, service-worker replies, delegated compute, test harnesses, and any feature that benefits from a scoped two-way channel. It is especially useful when several independent features talk to the same worker and should not share one response mailbox.',
        'BroadcastChannel wins for same-origin coordination: logout across tabs, cache invalidation, local-first document changed hints, settings changes, presence hints, and waking background sync logic. It is simple and effective when the message can be treated as disposable notification.',
        'A local-first editor is the complete example. A tab writes a CRDT change to IndexedDB, broadcasts the document ID and version heads, and other tabs reload missing changes. A worker may use a MessagePort for a private sync conversation. The service worker may keep the shell offline and retry network work. Each layer has a different job.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'BroadcastChannel fails as a database, queue, permission model, or global ordering primitive. Same-origin transport does not replace product authorization, replay, conflict resolution, durable storage, or version checks. If missing one message corrupts the app, the design is wrong.',
        'MessageChannel fails when request maps grow without cleanup. Every request needs completion, cancellation, timeout, or close handling. Late replies must be ignored or routed safely. Ports should be closed when the conversation is over.',
        'Another failure is ignoring backpressure. A fast producer can post messages faster than a consumer can process them. The APIs do not make the application protocol flow-controlled by default. Production protocols need queue limits, dropping policies, batching, or pull-based reads.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: MDN MessageChannel at https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel, MDN Channel Messaging API at https://developer.mozilla.org/en-US/docs/Web/API/Channel_Messaging_API, MDN ServiceWorker.postMessage at https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorker/postMessage, MDN BroadcastChannel at https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel, and Chrome for Developers BroadcastChannel overview at https://developer.chrome.com/blog/broadcastchannel.',
        'Study Structured Clone & Transferables first because ports and payloads ride through that machinery. Then study Web Workers, Service Workers & Offline-First, Cache Storage Versioned Precache, Background Sync Outbox Queue, Web Push Subscription Delivery, Web Streams Backpressure Queues, AbortController Cancellation Graph, Web Locks API Lock Manager, IndexedDB Object Store Case Study, Local-First Sync Engine Case Study, Collaborative Awareness Presence CRDT, Message Queue, Backpressure, and Transactional Outbox.',
      ],
    },
  ],
};
