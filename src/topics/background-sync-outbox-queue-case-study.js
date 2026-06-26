// Background Sync as a durable browser outbox: IndexedDB records, sync tags,
// service worker retry, backoff, acknowledgments, and foreground fallbacks.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'background-sync-outbox-queue-case-study',
  title: 'Background Sync Outbox Queue',
  category: 'Systems',
  summary: 'How offline browser writes use IndexedDB outboxes, SyncManager tags, service worker sync events, retry backoff, acknowledgments, and foreground fallbacks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['registration path', 'retry drain'], defaultValue: 'registration path' },
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

function syncGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'ui', label: 'UI', x: 0.7, y: 4.3, note: notes.ui ?? 'write' },
      { id: 'idb', label: 'IDB', x: 2.4, y: 4.3, note: notes.idb ?? 'outbox' },
      { id: 'tag', label: 'tag', x: 4.0, y: 2.6, note: notes.tag ?? 'sync:outbox' },
      { id: 'sw', label: 'SW', x: 4.0, y: 5.7, note: notes.sw ?? 'sync event' },
      { id: 'drain', label: 'drain', x: 5.9, y: 4.3, note: notes.drain ?? 'batch' },
      { id: 'net', label: 'network', x: 7.6, y: 4.3, note: notes.net ?? 'stable?' },
      { id: 'api', label: 'API', x: 9.2, y: 3.1, note: notes.api ?? 'commit' },
      { id: 'ack', label: 'ack', x: 9.2, y: 5.6, note: notes.ack ?? 'delete op' },
    ],
    edges: [
      { id: 'e-ui-idb', from: 'ui', to: 'idb', weight: '' },
      { id: 'e-idb-tag', from: 'idb', to: 'tag', weight: '' },
      { id: 'e-tag-sw', from: 'tag', to: 'sw', weight: '' },
      { id: 'e-idb-drain', from: 'idb', to: 'drain', weight: '' },
      { id: 'e-sw-drain', from: 'sw', to: 'drain', weight: '' },
      { id: 'e-drain-net', from: 'drain', to: 'net', weight: '' },
      { id: 'e-net-api', from: 'net', to: 'api', weight: '' },
      { id: 'e-api-ack', from: 'api', to: 'ack', weight: '' },
      { id: 'e-ack-idb', from: 'ack', to: 'idb', weight: '' },
    ],
  }, { title });
}

function* registrationPath() {
  yield {
    state: syncGraph('The UI commits the write locally first'),
    highlight: { active: ['ui', 'idb', 'e-ui-idb'], compare: ['net'] },
    explanation: 'An offline-capable write starts with durable local state. The UI updates the local document or cache and appends an outbox record in IndexedDB before asking the network to cooperate.',
    invariant: 'If the browser can close before the retry, the mutation must already be durable.',
  };

  yield {
    state: labelMatrix(
      'Outbox row',
      [
        { id: 'id', label: 'op id' },
        { id: 'body', label: 'body' },
        { id: 'idem', label: 'idem key' },
        { id: 'tries', label: 'tries' },
        { id: 'next', label: 'next try' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['order key', 'dup id'],
        ['request', 'too large'],
        ['dedupe', 'missing'],
        ['backoff', 'spin loop'],
        ['schedule', 'stale'],
      ],
    ),
    highlight: { active: ['id:role', 'idem:role', 'next:role'], compare: ['body:risk'] },
    explanation: 'The outbox is not just a list of URLs. It needs stable operation ids, request payloads, idempotency keys, attempt counters, next-at timestamps, and enough metadata to render pending or failed UI states.',
  };

  yield {
    state: syncGraph('The page registers a sync tag after queueing work', { tag: 'outbox-v1', sw: 'registered', net: 'offline' }),
    highlight: { active: ['idb', 'tag', 'sw', 'e-idb-tag', 'e-tag-sw'], removed: ['net'] },
    explanation: 'If the platform supports Background Synchronization, the page registers a tag on the service worker registration. The browser can later fire a sync event when connectivity is better.',
  };

  yield {
    state: labelMatrix(
      'Wake paths',
      [
        { id: 'sync', label: 'sync' },
        { id: 'online', label: 'online' },
        { id: 'focus', label: 'focus' },
        { id: 'timer', label: 'timer' },
      ],
      [
        { id: 'source', label: 'source' },
        { id: 'trust', label: 'trust' },
      ],
      [
        ['browser', 'best'],
        ['window', 'hint'],
        ['user', 'good'],
        ['app', 'backup'],
      ],
    ),
    highlight: { found: ['sync:source'], compare: ['online:trust', 'timer:trust'] },
    explanation: 'Background Sync is not available everywhere. A serious app also drains on foreground open, visibility change, explicit retry, and ordinary online hints. The outbox design stays the same.',
  };

  yield {
    state: syncGraph('A sync event wakes the service worker to drain queued work', { tag: 'outbox-v1', sw: 'event', drain: 'read IDB', net: 'try send' }),
    highlight: { active: ['tag', 'sw', 'drain', 'net', 'e-tag-sw', 'e-sw-drain', 'e-drain-net'], found: ['idb'] },
    explanation: 'The service worker receives the sync event, opens IndexedDB, selects due outbox rows, sends them, and keeps the event alive with waitUntil so the browser knows when the attempt has finished.',
  };
}

function* retryDrain() {
  yield {
    state: syncGraph('Drain in id order so dependent writes stay ordered', { idb: 'op 17..21', drain: 'oldest due', net: 'online' }),
    highlight: { active: ['idb', 'drain', 'net', 'e-idb-drain', 'e-drain-net'], compare: ['tag'] },
    explanation: 'Queue order matters when operations depend on previous state. A card create must usually be acknowledged before a later move references the real server id, unless the protocol supports temp-id remapping.',
    invariant: 'A retry queue needs ordering and idempotency together.',
  };

  yield {
    state: syncGraph('A successful POST commits remotely and deletes the row', { api: '201 ok', ack: 'remove op', idb: 'shorter' }),
    highlight: { found: ['api', 'ack', 'idb', 'e-net-api', 'e-api-ack', 'e-ack-idb'], active: ['drain'] },
    explanation: 'On success, the server should return enough information to reconcile local state. The worker records the ack, replaces temporary ids if needed, and deletes or marks the outbox row complete.',
  };

  yield {
    state: syncGraph('A retryable failure updates backoff instead of spinning', { net: '503', api: 'retry', ack: 'next+tries', idb: 'keep row' }),
    highlight: { active: ['net', 'ack', 'idb', 'e-api-ack', 'e-ack-idb'], compare: ['api'] },
    explanation: 'Retryable errors should update next-at and attempts. Immediate loops waste battery and can hammer the API. Permanent errors should surface to the UI with a clear failed state.',
  };

  yield {
    state: labelMatrix(
      'Failure map',
      [
        { id: 'offline', label: 'offline' },
        { id: '503', label: '503' },
        { id: '400', label: '400' },
        { id: '409', label: '409' },
        { id: 'auth', label: 'auth' },
      ],
      [
        { id: 'class', label: 'class' },
        { id: 'action', label: 'action' },
      ],
      [
        ['retry', 'wait net'],
        ['retry', 'backoff'],
        ['fatal', 'show user'],
        ['conflict', 'merge'],
        ['blocked', 'reauth'],
      ],
    ),
    highlight: { active: ['offline:action', '503:action'], compare: ['400:action'], found: ['409:action'] },
    explanation: 'Retries are policy, not hope. The queue should classify failures so it does not retry bad input forever, overwrite conflicts blindly, or keep sending with expired credentials.',
  };

  yield {
    state: syncGraph('The complete case study is a field-sales order app', { ui: 'order', idb: 'orders+outbox', tag: 'sync orders', sw: 'background', api: 'ERP', ack: 'invoice id' }),
    highlight: { active: ['ui', 'idb', 'tag', 'sw', 'drain', 'net', 'api', 'ack'], found: ['e-ui-idb', 'e-sw-drain', 'e-net-api', 'e-api-ack'] },
    explanation: 'A salesperson writes an order in a warehouse with poor connectivity. The order appears locally, the outbox stores the POST with an idempotency key, sync drains later, the ERP returns an invoice id, and the local record is reconciled.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'registration path') yield* registrationPath();
  else if (view === 'retry drain') yield* retryDrain();
  else throw new InputError('Pick a Background Sync view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the outbox as a durable queue owned by the browser app. Durable means the record survives a tab close, a page reload, or a temporary network outage. The active item is the mutation being retried; queued items are user work that exists locally but has not yet been acknowledged by the server.',
        'The safe inference rule is that the sync event is only a wakeup. If the outbox row is present, the app has work to retry. If the row is missing, no amount of Background Sync logic can reconstruct the lost mutation.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Offline-capable apps cannot treat a failed POST as lost work. A user may submit an order, inspection, comment, or note while the network is gone and expect the app to finish later. The browser needs a place to remember the write and a later execution path to retry it.',
        'Background Sync is a browser API that can wake a service worker later to perform synchronization. A service worker is a background script associated with a web app, and IndexedDB is the browser database usually used for durable local state. Reliability comes from the IndexedDB outbox, not from the wakeup event alone.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to call fetch from the page and show an error if the request fails. A slightly better version stores the request in memory and retries when the online event fires. This can work during a short Wi-Fi hiccup while the tab stays open.',
        'It breaks as soon as the page process dies or the user closes the browser. Memory is not a durable queue. The app has promised the user that work was saved, but the only copy of the mutation disappeared.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is uncertainty. The client may send a request, the server may commit it, and the response may be lost before the browser sees it. A blind retry can duplicate the operation unless the protocol has an idempotency key, which is a stable request identity the server uses to deduplicate repeats.',
        'There are also permanent failures. A validation error should not be retried forever, and a conflict should not be overwritten silently. A queue that cannot classify pending, retryable, failed, and acknowledged states becomes a hidden data-loss machine.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
              {type:'callout', text:'The sync tag is only a wakeup handle — the real durability comes from the IndexedDB queue. If the queue is empty, the sync event fires but does nothing. If the tab dies, the queue survives. This is the browser version of the Transactional Outbox pattern.'},,
              {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/5b/HTTP_logo.svg', alt:'HTTP protocol', caption:'Background Sync retries failed HTTP requests from a durable queue — the service worker acts as a persistent message consumer. Source: Wikimedia Commons, CC BY-SA 4.0'},,
        'The core insight is to store intent before trying delivery. Each outbox row should contain an operation id, payload, idempotency key, attempt count, next retry time, status, and reconciliation data. The UI can then tell the truth: this item is saved locally, waiting to send, failed, or confirmed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The page first writes local visible state and appends an outbox row in one logical action. It then registers a sync tag if the platform supports it. The app should also drain the queue on launch or focus because Background Sync is not available or prompt everywhere.',
        'When the service worker wakes, it opens IndexedDB and selects due rows. For each row, it sends the HTTP request with the idempotency key, waits for a response, and updates the row. Success removes or marks the row acknowledged; retryable failure schedules backoff; fatal failure becomes user-visible state.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument has two invariants. First, once the outbox row is committed, the client has a durable description of the unsent mutation. Second, every retry carries the same idempotency key, so the server can treat repeats as the same operation rather than new operations.',
        'Ordering handles dependent mutations. If creating an order must happen before adding line items, the queue should not send line items until the order has a server id or a temp-id mapping. The queue is correct when every mutation is either pending, delivered once logically, failed visibly, or blocked for a stated reason.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The queue adds storage, schema, battery, and protocol cost. Each pending row must be persisted, indexed by retry time, and cleaned up after acknowledgment. If the number of queued rows doubles, drain time and local storage roughly double unless requests can be batched safely.',
        'The dominant cost is not CPU. It is network retry behavior and user-state complexity. Immediate retry loops waste battery and can overload the API during outages, while excessive backoff leaves user work pending for too long.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The pattern fits field-sales orders, inspection forms, comments, task updates, offline notes, and local-first mobile web flows. The access pattern is append a mutation, retry later, reconcile server acknowledgment, then remove the queue row. It works best when operations are small and idempotent.',
        'It also appears on servers as the Transactional Outbox pattern. A database transaction writes both business state and an outgoing message, then a worker publishes that message later. The browser version uses IndexedDB and a service worker instead of a server database and broker.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails for operations that cannot be safely retried. Charging a card, booking a scarce seat, or sending an irreversible command needs a server protocol that can deduplicate and explain the final state. Without that protocol, the browser queue only repeats uncertainty.',
        'It also fails when the UI hides pending state. A user needs to know whether work is local only, sent, failed, or blocked by conflict. Offline support is a product promise backed by queue semantics, not a spinner with better timing.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A field app lets a user submit order O-91 while offline. The page writes the local order and an outbox row with idempotency key order-client-91, attempt 0, and status pending. The visible order is marked Waiting to sync, not Complete.',
        'At 10:05 the service worker wakes and sends POST /orders with that key. The server creates invoice INV-700, but the response is lost, so the queue records attempt 1 and retries after 30 seconds. On retry, the server recognizes the idempotency key and returns the same invoice instead of creating a duplicate.',
        'The client updates the local order with INV-700 and removes the outbox row. If the server had returned 400, the row would stay as a failed order that needs user correction. If it returned 409, the app would route to conflict handling rather than deleting the row.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Background Synchronization API, MDN SyncManager, MDN Service Worker API, MDN IndexedDB, and the WICG Background Sync draft. Use them to separate browser wakeup behavior from the app-level durability contract.',
        'Study next by role. For local durability, study IndexedDB Object Store. For user state, study Optimistic UI Mutation Log. For server analogs, study Message Queue and Transactional Outbox. For multi-tab coordination, study Web Locks API Lock Manager.',
      ],
    },
  ],
};
