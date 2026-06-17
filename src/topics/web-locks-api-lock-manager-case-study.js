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
      heading: 'Why this exists',
      paragraphs: [
        'A web app can run in several same-origin tabs, windows, iframes, and workers at once. Each context may try to sync the same document, compact the same IndexedDB store, refresh the same cache, or elect itself as the background worker.',
        'Without coordination, one browser origin becomes a small distributed system. Duplicate jobs waste battery and network. Concurrent migrations corrupt local state. The Web Locks API gives same-origin scripts a browser-managed queue for named resources.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is a flag. Put `syncing = true` in memory, localStorage, IndexedDB, or BroadcastChannel state, and ask every tab to check it before starting work. That feels natural because the contention is inside one browser profile.',
        'The wall is ownership. Tabs crash, reload, sleep, navigate away, and race between read and write. A stale flag can block work forever. Two tabs can read "not running" before either writes "running." Cleanup becomes another failure-prone protocol.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Move ownership into the user agent. A lock request declares a resource name, a mode, a callback, and optional queue behavior. The browser lock manager decides when the callback may run and releases the lock when the callback settles.',
        'The resource name is just an application-chosen string, such as `doc:42:sync` or `idb:migration:v3`. Exclusive mode means one holder for that name. Shared mode means multiple compatible readers can run while an exclusive writer waits.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the request-queue view, watch the manager node. The tabs do not coordinate by trusting each other; they submit requests to one origin-scoped arbiter. The move from queue to held is the safety decision: the callback is allowed to touch the named resource.',
        'In the reader-writer view, the compatibility table is the invariant. Shared plus shared can be granted together. Any exclusive request for the same name must be alone. The state change that matters is not visual motion; it is whether the next request is compatible with current holders.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        '`navigator.locks.request(name, options, callback)` asks for a lock. If the request is compatible with current holders, the callback receives a Lock object and runs. If not, the request waits. The returned promise resolves or rejects with the callback result after release.',
        'The useful options change queue behavior. `mode` is `exclusive` by default or `shared` for reader-style access. `ifAvailable` invokes the callback with `null` instead of waiting when the lock cannot be granted. `signal` drops a pending request if the AbortSignal fires. `steal` preempts existing holders and should be reserved for recovery from broken state.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The safety invariant is grant compatibility. For one origin and one resource name, the manager does not grant incompatible locks at the same time. Exclusive holders exclude every other holder for that name. Shared holders exclude exclusive holders but can coexist with other shared holders.',
        'Automatic release prevents the common manual-unlock leak. The critical section is the callback lifetime. When the callback returns, throws, or its promise settles, the lock is released and the queue can be processed again.',
        'That callback boundary is the main reason the API is easier to use than a homemade flag. The browser owns the queue and the release point, so a thrown exception or rejected promise does not leave a stale "I am syncing" marker behind. The application still owns what the critical section does.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A local-first editor is open in three tabs on document 42. All tabs can read IndexedDB, but only one tab should push pending changes and compact the sync log. Each tab requests `doc:42:sync` in exclusive mode before running the sync job.',
        'One tab receives the lock and runs. The other tabs wait, use `ifAvailable` to skip duplicate work, or attach an AbortSignal so navigation cancels a stale request. The server avoids three duplicate sync jobs, and the local database avoids concurrent maintenance on the same document.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is waiting. A long callback blocks incompatible work behind it, so the callback should contain the critical section, not unrelated network waits or UI work. The queue also needs cancellation because a tab may navigate away before the request still matters.',
        'Multiple lock names introduce deadlock risk. If one code path takes A then B while another takes B then A, both can wait forever. Use one lock per resource when possible, or enforce a global acquisition order and time out pending requests.',
      ],
    },
    {
      heading: 'Design checklist',
      paragraphs: [
        'Name resources by the thing that actually conflicts. `doc:42:sync` is better than `sync` if different documents can sync independently. `idb:migration:v3` is better than `database` if normal reads do not conflict with one specific migration. Lock names are part of the data model; vague names create unnecessary waiting, and inconsistent names create unsafe overlap.',
        'Keep the callback narrow. Do the guarded read-modify-write or local maintenance while holding the lock, then release it before unrelated UI work, analytics calls, or long server waits. If queued work may become irrelevant, attach an AbortSignal so route changes and tab shutdowns can drop the pending request.',
      ],
    },
    {
      heading: 'Observability and tests',
      paragraphs: [
        'For important paths, log the lock name, mode, wait time, hold time, abort reason, and whether the callback completed or failed. Those fields turn a slow sync job into a queueing question instead of a vague browser problem.',
        'Test with two real browser contexts. One tab should hold the lock while another waits, aborts, or uses `ifAvailable`. Shared-reader tests should prove that compatible readers run together and an exclusive writer waits. This is concurrency code, so examples with one tab are not enough.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Web Locks fit local-first sync, cache-fill deduplication, IndexedDB migrations, same-origin leader election, and background jobs where duplicate local work is wasteful. The common shape is one named resource and several contexts that agree to coordinate.',
        'Shared mode fits read-heavy tasks where many readers are safe but a writer must be alone. Exclusive mode fits migrations, compaction, uploads, and read-modify-write sequences.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Web Locks do not coordinate different origins, browsers, user profiles, devices, users, service backends, or code that ignores the API. They are not database locks and not authorization. Server-side uniqueness still needs server-side coordination.',
        'They also do not make a bad critical section safe. If code holds a lock while awaiting unrelated slow work, it creates head-of-line blocking. If two teams choose different names for the same resource, the manager cannot infer that those requests conflict.',
        'They can also hide product decisions if used too broadly. A global same-origin lock may stop corruption, but it can make every tab wait behind unrelated work. Good lock design protects the resource that needs protection and leaves independent work independent.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        '`steal` is the sharpest option. It releases held locks from the manager\'s point of view, but previously running code may continue without the guarantee that it is alone. Using `steal` as normal scheduling can create exactly the overlap the lock was meant to prevent.',
        '`query()` is diagnostic, not a scheduler. It returns a snapshot of held and pending locks, which can help logging and debugging, but the state may change immediately after the snapshot. Do not build correctness on polling snapshots.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Current sources: W3C Web Locks Working Draft at https://www.w3.org/TR/web-locks/ and MDN LockManager.request at https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request. Use those for exact option rules, secure-context notes, worker availability, and browser compatibility.',
        'Study AbortController Cancellation Graph for abortable waiting, IndexedDB Object Store Case Study for local storage constraints, Browser Message Channels & Broadcast Coordination for loose same-origin communication, PostgreSQL Lock Manager & Deadlock Detector for heavier lock scheduling, and Sequence Locks for a contrasting reader-writer design.',
      ],
    },
  ],
};
