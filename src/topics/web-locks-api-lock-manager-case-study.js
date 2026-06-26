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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the request queue as a same-origin scheduling problem. Active tabs are asking the browser for permission to touch a named resource. Found states are callbacks that now hold the lock and may safely enter the critical section.',
        'The safe inference is compatibility. For one lock name, shared holders can run together, but an exclusive holder must be alone. If the next request is incompatible with current holders, it waits even if its tab is ready.',
        {type:'callout', text:'The browser lock manager turns cross-tab coordination into an origin-scoped scheduling problem with explicit resource names, modes, and release boundaries.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A web app can be open in several same-origin tabs, iframes, and workers at once. Each context may try to sync a document, migrate IndexedDB, refresh a cache, or become the background worker. From the app point of view, one browser profile has become a small distributed system.',
        'The Web Locks API gives those contexts a browser-managed queue for named resources. A lock is a claim on an application-defined name such as doc:42:sync. It exists so cooperative code can serialize dangerous work without inventing its own crash-prone protocol.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a flag. Put syncing = true in memory, localStorage, IndexedDB, or BroadcastChannel state, and ask each tab to check it before doing work. That feels natural because every tab belongs to the same app.',
        'A flag works in the smallest demo. One tab sets the flag, finishes work, clears the flag, and the next tab starts. It is easy to log and easy to understand while nothing crashes or races.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is ownership under failure. Tabs crash, reload, sleep, navigate away, and race between reading a flag and writing it. A stale flag can block work forever, and two tabs can both read not running before either writes running.',
        'Cleanup becomes another protocol. If a tab owns a flag and dies, another tab must decide whether the flag is stale. That decision needs clocks, heartbeats, leases, or recovery rules, which is exactly the coordination problem the flag was meant to avoid.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Move the grant decision into the user agent, which means the browser implementation. A request declares a resource name, a mode, a callback, and optional queue behavior. The browser decides when the callback can run and releases the lock when the callback settles.',
        'The invariant is grant compatibility. For the same origin and resource name, incompatible locks are not granted at the same time. Exclusive mode means one holder. Shared mode means several compatible readers can run while an exclusive writer waits.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Code calls navigator.locks.request(name, options, callback). If the request is compatible with current holders, the callback receives a Lock object and runs. If not, the request waits in the browser lock manager queue until it can be granted or aborted.',
        'The options change queue behavior. mode is exclusive by default or shared for reader-style access. ifAvailable calls the callback with null instead of waiting. signal aborts a pending request. steal can preempt existing holders and should be treated as recovery machinery, not normal scheduling.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from one arbiter for each origin-scoped lock namespace. If every tab asks the same manager for the same resource name, then the manager can enforce the compatibility rule before any critical section starts. The tabs do not need to trust each other to set and clear a flag correctly.',
        'Automatic release closes the common leak. The critical section is the callback lifetime. When the callback returns, throws, or its promise settles, the lock is released and the queue can make progress.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is waiting and design discipline. If tab A holds doc:42:sync for 8 seconds while it uploads unrelated analytics, tab B waits 8 seconds before it can sync the document. The lock did its job, but the critical section was too wide.',
        'Lock names decide behavior. A global sync lock makes 20 independent documents wait behind one document. Per-document names such as doc:42:sync and doc:99:sync allow unrelated work to proceed. Finer names improve concurrency but increase the chance that two teams choose inconsistent names for the same resource.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Web Locks fit local-first sync, IndexedDB migrations, cache-fill deduplication, leader election, and background jobs where duplicate same-origin work is wasteful. The access pattern is cooperative browser contexts that all agree to request the same named lock before touching the same resource.',
        'Shared mode fits read-heavy work where many readers are safe but a writer must be alone. Exclusive mode fits migrations, compaction, uploads, and read-modify-write sequences. The API is coordination, not authorization or server-side uniqueness.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Web Locks do not coordinate different origins, browser profiles, devices, users, service backends, or code that ignores the API. A server still needs database constraints or server locks for shared remote state. The browser lock only protects cooperating same-origin code.',
        'Deadlock is still possible when code takes multiple locks in inconsistent order. If one tab holds A and waits for B while another holds B and waits for A, neither can proceed. Use one lock when possible, or enforce a global acquisition order and timeouts.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Three tabs edit document 42. Each tab wants to push local changes and compact an IndexedDB log. Without a lock, all three can start, so the server receives three duplicate sync jobs and the local log compactor races itself.',
        'With Web Locks, each tab requests doc:42:sync in exclusive mode. Tab 1 holds the lock for 1.2 seconds and syncs 18 changes. Tabs 2 and 3 use ifAvailable and skip duplicate work. Total remote writes drop from 54 to 18, and the compactor has one owner for that interval.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Web Locks API at https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API and W3C Web Locks API at https://www.w3.org/TR/web-locks/. Use them for current option rules, secure-context requirements, worker availability, and scheduling semantics.',
        'Study next by role: AbortController Cancellation Signal Tree for abortable waiting, IndexedDB Object Store for local storage constraints, Browser Message Channels for loose coordination, PostgreSQL Lock Manager for heavier scheduling, and Sequence Locks for a contrasting reader-writer design.',
      ],
    },
  ],
};
