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
      heading: 'Why this exists',
      paragraphs: [
        'Offline-capable apps cannot treat a failed POST as lost work. A user may write an order, comment, form, or note while the network is gone, close the tab, and expect the app to finish later. The browser needs a durable place to remember the mutation and a wakeup path to retry it.',
        'Background Sync is one wakeup mechanism: it lets a web app defer synchronization work to its service worker so it can run later, often after connectivity improves. The reliable design is not the sync event by itself. It is the durable outbox behind it.',
        'MDN describes the Background Synchronization API as deferring server synchronization work to a service worker at a later time: https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API. MDN also marks SyncManager as limited availability, so production designs need fallbacks: https://developer.mozilla.org/en-US/docs/Web/API/SyncManager.',
      ],
    },
    {
      heading: 'The obvious attempt',
      paragraphs: [
        'The simple approach is to call fetch from the UI and show an error if it fails. A slightly better version keeps the request in memory and retries when the online event fires.',
        'That breaks when the tab closes, the browser kills the page, the online event is wrong, the response is lost after the server committed, or the API returns a permanent validation error. A retry loop without durable state can lose work, duplicate work, or retry bad input forever.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        {type:'callout', text:'The sync tag is only a wakeup handle — the real durability comes from the IndexedDB queue. If the queue is empty, the sync event fires but does nothing. If the tab dies, the queue survives. This is the browser version of the Transactional Outbox pattern.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/5b/HTTP_logo.svg', alt:'HTTP protocol', caption:'Background Sync retries failed HTTP requests from a durable queue — the service worker acts as a persistent message consumer. Source: Wikimedia Commons, CC BY-SA 4.0'},
        'The core data structure is a persistent queue in IndexedDB. Each row needs an operation id, payload, idempotency key, status, attempt count, next retry time, and reconciliation metadata. The sync tag is only a wakeup handle.',
        'This is the browser version of Transactional Outbox and Message Queue. The producer is a page, the durable queue is IndexedDB, and the consumer is a service worker or foreground fallback. The invariant is that a mutation is either safely queued, acknowledged by the server, or visible to the user as failed.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'Inspect the outbox as the browser version of a transactional queue. A user action must create local visible state and a durable mutation record before the app promises that the work is saved. The sync tag is only a wake-up mechanism; the queue is the source of truth.',
        'The important fields are operation id, idempotency key, payload, dependency key, attempt count, next retry time, last error, local entity mapping, and user-visible status. If those fields are missing, the app cannot explain whether a write is pending, safe to retry, permanently failed, or already acknowledged by the server.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The UI first writes local state and appends an outbox row in the same logical action. It then registers a sync tag if the platform supports Background Sync. The app may also schedule foreground retries on launch, focus, explicit retry, or online hints.',
        'When a sync event fires, the service worker opens IndexedDB, selects due rows, sends them in a safe order, and keeps the event alive with waitUntil. A successful response records the ack, reconciles temporary ids or local pending state, and removes the row. A retryable failure updates backoff. A permanent failure becomes user-visible state.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Durability protects the user from browser and network timing. Once the outbox row is committed, the mutation survives tab close and can be retried by another wake path. Idempotency protects the server from duplicate commits when a retry follows a lost response.',
        'Ordering and failure classification make retries safe. Dependent operations drain in queue order unless the protocol supports temp-id remapping. Retryable errors wait with backoff. Fatal validation errors stop. Conflicts route to merge logic instead of being overwritten silently.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider an offline field-sales app. The user submits an order while the device is offline. The UI writes the order to an IndexedDB object store and appends an outbox row with idempotency key order-client-91. The app registers a sync tag. Later the browser fires a sync event. The service worker reads the outbox, sends POST /orders, receives invoice id INV-700, updates the local order, and removes the outbox row.',
        'If the API returns 503, the worker increments attempts and schedules a later retry. If it returns 400, the row becomes a failed user-visible order. If it returns 409, the app needs conflict resolution. Optimistic UI Mutation Log explains the user-facing pending states; IndexedDB Object Store Case Study explains the local durability; Local-First Sync Engine Case Study explains the larger sync pattern.',
        'The important implementation detail is that the user-visible order and the outbox row must not drift apart. If the app shows a saved order but fails to create the outbox row, the server never sees the order. If it creates the row but loses the local entity mapping, the server acknowledgment cannot be reconciled cleanly. Treat the local write and queue append as one logical transaction even though the browser API does not give you a distributed transaction.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The queue protects user work, but it introduces storage, schema, ordering, and battery costs. Payloads must be small enough for IndexedDB and safe to persist. The server must accept idempotency keys or another dedupe mechanism. The client must render pending, failed, and reconciled states honestly.',
        'Backoff is not optional. Immediate retry loops waste battery and can hammer APIs during outages. Foreground fallbacks are also not optional because Background Sync is not available everywhere and the browser controls when background work runs.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The outbox pattern wins for user-authored writes that can be retried safely: field-sales orders, comments, form submissions, task updates, inspections, and local-first edits. The access pattern is append, retry, acknowledge, and delete.',
        'It is the wrong fit for non-idempotent operations with no dedupe key, huge uploads that need chunk manifests, operations that require immediate confirmation, or conflict-heavy collaborative edits that need a full sync engine instead of a simple queue.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The common misconception is that Background Sync makes offline writes reliable by itself. It does not store the mutation for you, classify failures, dedupe server commits, or render failed states. Those are outbox responsibilities.',
        'Bad outboxes retry forever, send dependent writes out of order, lose temporary-id mappings, hide fatal errors, or delete rows before local state is reconciled. The queue is a correctness boundary, not a background convenience.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track queued row count, oldest pending age, retry histogram, fatal-error count, conflict count, duplicate server acknowledgments, foreground-drain count, background-sync availability, and rows blocked by dependencies. These metrics separate a healthy offline system from an app that silently stores work it will never deliver.',
        'A useful debug screen should show each row and why it is still present. Waiting for network, waiting for dependency, retrying after 503, blocked by validation, and acknowledged but not reconciled are different states. Collapsing them into one spinner wastes the user time and makes support almost impossible.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Background Sync is not the algorithm. The algorithm is durable outbox plus idempotent server protocol plus honest UI state. The browser may help wake the worker, but reliability comes from the data model and retry rules.',
        'For course design, teach this after IndexedDB and service workers, then connect it to server-side transactional outbox. Students should see the same pattern on both sides of the network: write intent durably, retry safely, acknowledge explicitly, and never pretend an uncertain write is complete.',
        'The deeper lesson is that offline support is a product promise backed by systems design. A user does not care that SyncManager is unavailable or that the browser delayed a background event. The app must still explain what is saved locally, what is waiting to send, what failed, and what needs user action.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Background Synchronization API at https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API, MDN SyncManager at https://developer.mozilla.org/en-US/docs/Web/API/SyncManager, MDN Service Worker API at https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API, and the WICG Background Sync draft at https://wicg.github.io/background-sync/spec/.',
        'Study next by role: IndexedDB Object Store Case Study for local durability, Service Workers & Offline-First for the execution environment, Optimistic UI Mutation Log for user-facing pending state, Query Cache: Stale Time & GC for read freshness, Message Queue and Transactional Outbox for the server-side pattern, Local-First Sync Engine Case Study for conflict-rich apps, AbortController Cancellation Graph for cancelable foreground retries, and Web Locks API Lock Manager for coordinating multiple tabs.',
      ],
    },
  ],
};
