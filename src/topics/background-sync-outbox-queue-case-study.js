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
      heading: 'What it is',
      paragraphs: [
        'Background Sync is a browser capability that lets a web app defer synchronization work to its service worker so it can run later, often after connectivity improves. The robust architecture is not the sync event by itself; it is the durable outbox behind it.',
        'MDN describes the Background Synchronization API as deferring server synchronization work to a service worker at a later time: https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API. MDN also marks SyncManager as limited availability, so production designs need fallbacks: https://developer.mozilla.org/en-US/docs/Web/API/SyncManager.',
      ],
    },
    {
      heading: 'Data structure model',
      paragraphs: [
        'The outbox is a persistent queue in IndexedDB. Each row needs an operation id, payload, idempotency key, status, attempt count, next retry time, and reconciliation metadata. The sync tag is only a wakeup handle. The service worker drains due rows, sends requests, records acks, updates local state, and leaves retryable rows in place with backoff.',
        'This is the browser version of Transactional Outbox and Message Queue. The difference is that the producer is a page, the durable queue is IndexedDB, and the worker may be woken by Background Sync, foreground app launch, an online event, or an explicit retry button.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider an offline field-sales app. The user submits an order while the device is offline. The UI writes the order to an IndexedDB object store and appends an outbox row with idempotency key order-client-91. The app registers a sync tag. Later the browser fires a sync event. The service worker reads the outbox, sends POST /orders, receives invoice id INV-700, updates the local order, and removes the outbox row.',
        'If the API returns 503, the worker increments attempts and schedules a later retry. If it returns 400, the row becomes a failed user-visible order. If it returns 409, the app needs conflict resolution. Optimistic UI Mutation Log explains the user-facing pending states; IndexedDB Object Store Case Study explains the local durability; Local-First Sync Engine Case Study explains the larger sync pattern.',
      ],
    },
    {
      heading: 'Costs and pitfalls',
      paragraphs: [
        'The queue protects user work, but it introduces duplication, ordering, and battery concerns. Idempotency keys prevent duplicate orders when a retry succeeds after a lost response. Ordered draining prevents dependent writes from racing. Backoff prevents retry storms. Foreground fallbacks prevent unsupported platforms from losing the sync path.',
        'The common misconception is that Background Sync makes offline writes reliable by itself. It does not store the mutation for you, classify failures, dedupe server commits, or render failed states. Those are outbox responsibilities.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Background Synchronization API at https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API, MDN SyncManager at https://developer.mozilla.org/en-US/docs/Web/API/SyncManager, MDN Service Worker API at https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API, and the WICG Background Sync draft at https://wicg.github.io/background-sync/spec/.',
        'Study next: IndexedDB Object Store Case Study, Service Workers & Offline-First, Cache Storage Versioned Precache, Optimistic UI Mutation Log, Query Cache: Stale Time & GC, Message Queue, Transactional Outbox, Local-First Sync Engine Case Study, AbortController Cancellation Graph, and Web Locks API Lock Manager.',
      ],
    },
  ],
};
