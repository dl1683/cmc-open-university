// Web Locks API: origin-scoped lock manager, named resources, request queues,
// shared/exclusive modes, abortable waiting, and cross-tab coordination.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'web-locks-api-lock-manager-case-study',
  title: 'Web Locks API Lock Manager',
  category: 'Systems',
  summary: 'How the Web Locks API coordinates same-origin tabs and workers with named lock queues, shared/exclusive modes, abortable waits, and automatic release.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['request queue', 'reader writer'], defaultValue: 'request queue' },
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

function lockGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'tabA', label: 'tab A', x: 0.8, y: 2.5, note: notes.tabA ?? 'sync job' },
      { id: 'tabB', label: 'tab B', x: 0.8, y: 5.5, note: notes.tabB ?? 'sync job' },
      { id: 'mgr', label: 'manager', x: 2.8, y: 4.0, note: notes.mgr ?? 'origin' },
      { id: 'held', label: 'held', x: 4.8, y: 2.4, note: notes.held ?? 'resource' },
      { id: 'queue', label: 'queue', x: 4.8, y: 5.6, note: notes.queue ?? 'requests' },
      { id: 'cb', label: 'callback', x: 6.8, y: 4.0, note: notes.cb ?? 'work' },
      { id: 'release', label: 'release', x: 8.6, y: 4.0, note: notes.release ?? 'auto' },
    ],
    edges: [
      { id: 'e-tabA-mgr', from: 'tabA', to: 'mgr', weight: '' },
      { id: 'e-tabB-mgr', from: 'tabB', to: 'mgr', weight: '' },
      { id: 'e-mgr-held', from: 'mgr', to: 'held', weight: '' },
      { id: 'e-mgr-queue', from: 'mgr', to: 'queue', weight: '' },
      { id: 'e-held-cb', from: 'held', to: 'cb', weight: '' },
      { id: 'e-cb-release', from: 'cb', to: 'release', weight: '' },
      { id: 'e-release-queue', from: 'release', to: 'queue', weight: '' },
    ],
  }, { title });
}

function* requestQueue() {
  yield {
    state: lockGraph('Same-origin tabs coordinate through a lock manager'),
    highlight: { active: ['tabA', 'tabB', 'mgr', 'e-tabA-mgr', 'e-tabB-mgr'], found: ['held', 'queue'] },
    explanation: 'The Web Locks API lets same-origin windows and workers request a named lock. The browser lock manager grants the lock to one callback or queues incompatible requests.',
    invariant: 'The lock is cooperative coordination, not a security boundary.',
  };

  yield {
    state: lockGraph('A granted request runs a callback while holding the lock', { held: 'my-sync', cb: 'async work', release: 'when done' }),
    highlight: { active: ['held', 'cb', 'release', 'e-held-cb', 'e-cb-release'], compare: ['queue'] },
    explanation: 'navigator.locks.request returns a promise. The lock is held while the callback runs and is automatically released when the callback settles.',
  };

  yield {
    state: labelMatrix(
      'Request options',
      [
        { id: 'mode', label: 'mode' },
        { id: 'ifAvail', label: 'ifAvail' },
        { id: 'signal', label: 'signal' },
        { id: 'steal', label: 'steal' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['excl/shared', 'wrong mode'],
        ['no wait', 'null lock'],
        ['abort wait', 'drop req'],
        ['preempt', 'clash'],
      ],
    ),
    highlight: { found: ['mode:meaning', 'signal:meaning'], compare: ['steal:risk'] },
    explanation: 'Options shape the queue behavior. signal aborts a pending request. ifAvailable tries without waiting. steal is an emergency escape hatch and can clash with existing work.',
  };

  yield {
    state: lockGraph('Queued requests should be abortable', { queue: 'pending', release: 'later', tabB: 'route leave' }),
    highlight: { active: ['tabB', 'queue', 'e-tabB-mgr', 'e-mgr-queue'], removed: ['held'] },
    explanation: 'A tab that no longer needs a queued lock should abort its request. Otherwise abandoned work can sit in the queue and run later after it is no longer relevant.',
  };

  yield {
    state: labelMatrix(
      'Use cases',
      [
        { id: 'sync', label: 'sync job' },
        { id: 'idb', label: 'IDB maint' },
        { id: 'cache', label: 'cache fill' },
        { id: 'server', label: 'server lock' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'why', label: 'why' },
      ],
      [
        ['yes', 'one tab'],
        ['yes', 'serialize'],
        ['yes', 'avoid herd'],
        ['no', 'origin only'],
      ],
    ),
    highlight: { found: ['sync:fit', 'cache:fit'], removed: ['server:fit'] },
    explanation: 'Web Locks coordinate scripts in the same origin. They do not coordinate different users, devices, browsers, origins, or server processes.',
  };
}

function* readerWriter() {
  yield {
    state: lockGraph('Shared mode models multiple readers', { held: 'shared', tabA: 'reader', tabB: 'reader', cb: 'read cache' }),
    highlight: { active: ['tabA', 'tabB', 'mgr', 'held', 'cb'], found: ['held'] },
    explanation: 'A shared lock can be held by multiple compatible shared requests for the same name. This is the readers side of a reader-writer lock.',
    invariant: 'Shared readers can coexist; an exclusive writer must be alone.',
  };

  yield {
    state: labelMatrix(
      'Compatibility table',
      [
        { id: 'heldSh', label: 'held shared' },
        { id: 'heldEx', label: 'held excl' },
        { id: 'none', label: 'none held' },
      ],
      [
        { id: 'wantSh', label: 'want shared' },
        { id: 'wantEx', label: 'want excl' },
      ],
      [
        ['grant', 'wait'],
        ['wait', 'wait'],
        ['grant', 'grant'],
      ],
    ),
    highlight: { found: ['heldSh:wantSh', 'none:wantEx'], compare: ['heldSh:wantEx', 'heldEx:wantSh'] },
    explanation: 'The lock manager grants compatible requests and queues incompatible ones. Exclusive locks are the default and require solitary access.',
  };

  yield {
    state: lockGraph('A writer waits behind current readers', { held: 'shared readers', queue: 'exclusive', cb: 'readers finish' }),
    highlight: { active: ['held', 'queue', 'release', 'e-release-queue'], compare: ['tabB'] },
    explanation: 'An exclusive writer waits until current shared holders release. This protects read-modify-write work such as cache migration or IndexedDB maintenance.',
  };

  yield {
    state: labelMatrix(
      'Deadlock controls',
      [
        { id: 'order', label: 'order locks' },
        { id: 'timeout', label: 'timeout' },
        { id: 'steal', label: 'steal' },
        { id: 'query', label: 'query' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'danger', label: 'danger' },
      ],
      [
        ['avoid cycle', 'discipline'],
        ['drop wait', 'lost work'],
        ['escape', 'clash'],
        ['diagnose', 'stale view'],
      ],
    ),
    highlight: { found: ['order:purpose', 'timeout:purpose'], compare: ['steal:danger'] },
    explanation: 'Locks introduce deadlock risk. Prefer one lock name per resource, consistent acquisition order, abortable waits, and diagnostics before reaching for steal.',
  };

  yield {
    state: labelMatrix(
      'Cross-tab recipe',
      [
        { id: 'name', label: 'name' },
        { id: 'lock', label: 'request' },
        { id: 'work', label: 'work' },
        { id: 'signal', label: 'signal' },
      ],
      [
        { id: 'example', label: 'example' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['doc:42', 'resource'],
        ['exclusive', 'one writer'],
        ['sync diff', 'critical'],
        ['abort', 'route leave'],
      ],
    ),
    highlight: { active: ['name:example', 'lock:example', 'signal:example'], found: ['work:reason'] },
    explanation: 'A local-first app can use a lock name such as doc:42:sync so only one same-origin tab performs the expensive sync job while other tabs keep reading local state.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'request queue') yield* requestQueue();
  else if (view === 'reader writer') yield* readerWriter();
  else throw new InputError('Pick a Web Locks view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'The Web Locks API is an origin-scoped coordination primitive for scripts running in tabs and workers. A script requests a named lock, runs work while the lock is held, and releases it automatically when the callback finishes.',
        'The data structure is a lock manager with per-resource request queues. Requests have names, modes, callbacks, and optional abort signals.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Exclusive locks allow one holder for a name. Shared locks allow multiple compatible readers but block exclusive writers. Requests that cannot be granted wait in a queue until compatible locks are released.',
        'The request method returns a promise that resolves or rejects with the callback result after release. An AbortSignal can drop a pending request before it is granted.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a local-first app open in three tabs. All tabs can read IndexedDB, but only one tab should compact the sync log or refresh a cache entry. Each tab calls navigator.locks.request("doc:42:sync", { signal }, async () => runSync()). The first tab runs the job. The others wait or abort when the user navigates away. The server does not see three duplicate sync jobs.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Web Locks are cooperative, same-origin coordination. They are not security locks, database locks, or cross-device locks. Do not use steal casually; preempted code keeps running and can conflict with the new holder. Avoid multi-lock deadlocks with clear naming and acquisition order.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'For the database-backed cousin, study PostgreSQL Advisory Lock Keyspace. For real database wait queues and deadlock cycle detection, study PostgreSQL Lock Manager & Deadlock Detector.',
        'Primary sources: MDN Web Locks API at https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API, MDN LockManager.request at https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request, and W3C Web Locks Working Draft at https://www.w3.org/TR/web-locks/. Study AbortController Cancellation Graph, IndexedDB Object Store Case Study, Local-First Sync Engine Case Study, Browser Message Channels & Broadcast Coordination, Web Streams Backpressure Queues, Reader-Writer Lock patterns via Sequence Locks, and Backpressure & Flow Control next.',
      ],
    },
  ],
};
