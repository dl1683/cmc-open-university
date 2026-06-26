// Query caches as data structures: query keys, observer sets, stale clocks,
// background refetches, inactive entries, and garbage-collection timers.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'query-cache-stale-time-gc-case-study',
  title: 'Query Cache: Stale Time & GC',
  category: 'Systems',
  summary: 'How client query caches store keyed server state, share observers, mark stale data, refetch in the background, and garbage-collect inactive entries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['cache lifecycle', 'observer graph'], defaultValue: 'cache lifecycle' },
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

function queryGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'route', label: 'route', x: 0.8, y: 4.7, note: notes.route ?? 'screen' },
      { id: 'obsA', label: 'obs A', x: 2.7, y: 5.7, note: notes.obsA ?? 'component' },
      { id: 'obsB', label: 'obs B', x: 2.7, y: 3.5, note: notes.obsB ?? 'component' },
      { id: 'key', label: 'key', x: 4.6, y: 4.7, note: notes.key ?? "['todos']" },
      { id: 'entry', label: 'entry', x: 6.5, y: 4.7, note: notes.entry ?? 'data+meta' },
      { id: 'fetch', label: 'fetch', x: 8.3, y: 5.7, note: notes.fetch ?? 'queryFn' },
      { id: 'timer', label: 'timer', x: 8.3, y: 3.5, note: notes.timer ?? 'stale/gc' },
      { id: 'server', label: 'API', x: 9.7, y: 4.7, note: notes.server ?? 'source' },
    ],
    edges: [
      { id: 'e-route-a', from: 'route', to: 'obsA', weight: '' },
      { id: 'e-route-b', from: 'route', to: 'obsB', weight: '' },
      { id: 'e-a-key', from: 'obsA', to: 'key', weight: '' },
      { id: 'e-b-key', from: 'obsB', to: 'key', weight: '' },
      { id: 'e-key-entry', from: 'key', to: 'entry', weight: 'hash' },
      { id: 'e-entry-fetch', from: 'entry', to: 'fetch', weight: '' },
      { id: 'e-entry-timer', from: 'entry', to: 'timer', weight: '' },
      { id: 'e-fetch-server', from: 'fetch', to: 'server', weight: '' },
    ],
  }, { title });
}

function* cacheLifecycle() {
  yield {
    state: queryGraph('A query key indexes one cache entry', { entry: 'missing', fetch: 'start' }),
    highlight: { active: ['obsA', 'key', 'entry', 'fetch', 'server', 'e-a-key', 'e-key-entry', 'e-entry-fetch', 'e-fetch-server'], compare: ['obsB'] },
    explanation: 'A query cache is a keyed map for server state. The query key is the lookup address; the cache entry stores data, status, timestamps, observers, and an in-flight promise if a fetch is active.',
    invariant: 'Same query key means shared cache entry.',
  };

  yield {
    state: queryGraph('Resolved data is cached with freshness metadata', { entry: 'data v1', timer: 'staleTime', fetch: 'done' }),
    highlight: { found: ['entry', 'timer'], active: ['e-entry-timer'], removed: ['fetch'] },
    explanation: 'When the request resolves, the entry gets data and an updated timestamp. Stale time decides how long that data is considered fresh before the cache should refetch on triggers such as mount, focus, or invalidation.',
  };

  yield {
    state: queryGraph('A second observer gets cached data immediately', { obsB: 'mounts', entry: 'data v1', fetch: 'bg refetch', timer: 'stale' }),
    highlight: { found: ['obsB', 'entry'], active: ['e-b-key', 'e-key-entry'], compare: ['fetch', 'server'] },
    explanation: 'Another component with the same key does not need a separate local loading state. It subscribes to the existing entry, receives cached data, and may share the same background refetch.',
  };

  yield {
    state: queryGraph('Unmounted observers leave an inactive cache entry', { obsA: 'gone', obsB: 'gone', entry: 'inactive', timer: 'gcTime' }),
    highlight: { removed: ['obsA', 'obsB', 'e-a-key', 'e-b-key'], active: ['entry', 'timer', 'e-entry-timer'] },
    explanation: 'When the observer set becomes empty, the data can stay in memory for a while. Garbage-collection time controls how long inactive entries survive before the cache deletes them.',
  };

  yield {
    state: labelMatrix(
      'Cache knobs',
      [
        { id: 'key', label: 'key' },
        { id: 'stale', label: 'staleTime' },
        { id: 'gc', label: 'gcTime' },
        { id: 'refetch', label: 'refetch' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['identity', 'wrong merge'],
        ['freshness', 'stale UI'],
        ['retention', 'memory'],
        ['repair', 'herd'],
      ],
    ),
    highlight: { found: ['key:stores', 'stale:stores', 'gc:stores'], compare: ['refetch:risk'] },
    explanation: 'The cache is not just a fetch helper. It is an identity map, observer registry, freshness clock, retention policy, request deduper, and invalidation target.',
  };
}

function* observerGraph() {
  yield {
    state: labelMatrix(
      'Entry record',
      [
        { id: 'data', label: 'data' },
        { id: 'status', label: 'status' },
        { id: 'obs', label: 'observers' },
        { id: 'promise', label: 'promise' },
      ],
      [
        { id: 'holds', label: 'holds' },
        { id: 'used', label: 'used for' },
      ],
      [
        ['payload', 'render'],
        ['flags', 'UI modes'],
        ['set', 'notify'],
        ['inflight', 'dedupe'],
      ],
    ),
    highlight: { found: ['obs:holds', 'promise:used'], active: ['data:used'] },
    explanation: 'A query entry is a small state machine plus a subscriber set. Components observe the entry; the entry notifies them when data, status, error, or fetch state changes.',
    invariant: 'Observers subscribe to entries, not to fetch calls.',
  };

  yield {
    state: queryGraph('Shared observers prevent duplicate network work', { obsA: 'list', obsB: 'badge', entry: 'one entry', fetch: 'one promise' }),
    highlight: { found: ['obsA', 'obsB', 'entry', 'fetch'], active: ['e-a-key', 'e-b-key', 'e-key-entry', 'e-entry-fetch'] },
    explanation: 'Two places can need the same server state. A query cache centralizes the fetch so a list, badge, and sidebar subscribe to one result instead of racing three requests.',
  };

  yield {
    state: queryGraph('Invalidation marks matching keys stale', { route: 'mutation', key: "['todos']", entry: 'stale', fetch: 'queued' }),
    highlight: { active: ['route', 'key', 'entry', 'fetch', 'e-route-a', 'e-a-key', 'e-key-entry', 'e-entry-fetch'], found: ['timer'] },
    explanation: 'Invalidation is a targeted freshness change. It does not have to delete data. It can mark matching entries stale so active observers refetch while still rendering the last known value.',
  };

  yield {
    state: labelMatrix(
      'Trigger table',
      [
        { id: 'mount', label: 'mount' },
        { id: 'focus', label: 'focus' },
        { id: 'online', label: 'online' },
        { id: 'mutate', label: 'mutate' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'why', label: 'why' },
      ],
      [
        ['maybe refetch', 'stale?'],
        ['bg refetch', 'returning'],
        ['resume', 'network ok'],
        ['invalidate', 'writes'],
      ],
    ),
    highlight: { found: ['mount:action', 'mutate:action'], compare: ['focus:why', 'online:why'] },
    explanation: 'Freshness checks are event driven. Mounting, window focus, reconnect, and mutations can all ask the cache whether a stale entry should be refreshed.',
  };

  yield {
    state: labelMatrix(
      'Case study',
      [
        { id: 'feed', label: 'feed' },
        { id: 'detail', label: 'detail' },
        { id: 'badge', label: 'badge' },
        { id: 'chart', label: 'chart' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'policy', label: 'policy' },
      ],
      [
        ['posts:list', 'short stale'],
        ['post:id', 'reuse'],
        ['notif', 'poll/focus'],
        ['sales:q', 'long stale'],
      ],
    ),
    highlight: { found: ['feed:policy', 'detail:key', 'chart:policy'] },
    explanation: 'A real dashboard uses different cache policies per data class. The feed wants quick repair, detail pages want reuse, notification badges want focus or polling, and historical charts can stay fresh for longer.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'cache lifecycle') yield* cacheLifecycle();
  else if (view === 'observer graph') yield* observerGraph();
  else throw new InputError('Pick a query-cache view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the cache-lifecycle view as one query key moving through states. A query key is the structured identity of one server fact, such as user 42 with specific filters. Active nodes show fetch or repair work; found nodes show data that can be rendered.',
        'Read the observer graph as components subscribing to entries rather than owning fetches. An observer is a mounted consumer of one cache entry. Stale means the data is eligible for repair; inactive means no observer is watching; garbage collection means the entry is removed from memory.',
        {type:'callout', text:'A query cache is not a fetch helper but a shared identity map with observers, freshness clocks, repair triggers, and retention policy.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Client applications often show the same server data in many places: a header badge, a profile card, a list row, and a detail panel. If every component fetches alone, the app wastes network work and can render conflicting copies of the same fact.',
        'A query cache exists because server state is shared, remote, and time-sensitive. It needs identity, deduped requests, observer notification, freshness rules, invalidation after writes, and memory cleanup after screens unmount.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is component-local fetching. On mount, run a request, set loading state, store data or error, and clean up on unmount. That is fine for an isolated widget whose data nobody else reads.',
        'The second approach is a global object keyed by URL. That shares some data, but it usually lacks structured keys, observer sets, stale clocks, in-flight promise dedupe, targeted invalidation, and garbage collection.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Local state has no shared identity. Two components can request the same user at the same time, race two network calls, and render different timestamps. A mutation can update one copy while another copy stays stale.',
        'A plain global cache has no behavior model. It may keep old data forever, delete useful data too soon, or treat every resource with the same freshness rule. Server state changes without asking the current component, so the cache needs repair semantics.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A query cache is an identity map from query key to entry. The entry stores data, status, error, updated time, observers, stale policy, inactive timer, and sometimes the in-flight promise. Components subscribe to the entry, not to separate fetch calls.',
        'Stale time and garbage-collection time answer different questions. Stale time asks how long data can be considered fresh without repair. GC time asks how long inactive data should remain in memory after the last observer leaves.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When a component subscribes with a key, the cache looks up the entry. If none exists, it creates one and runs the query function. If a request is already in flight for that key, new observers share the same promise instead of starting another request.',
        'When the request resolves, the entry stores data and an updated timestamp, then notifies observers. When stale time expires, data is not deleted; it becomes eligible for background refetch on triggers such as mount, focus, reconnect, polling, or explicit invalidation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is one key, one entry. Because all observers for the same server fact attach to the same entry, one network result can update every UI surface consistently. In-flight dedupe follows from the same identity rule.',
        'Invalidation is safe because it marks freshness, not identity. After a mutation, matching keys can become stale while the UI keeps rendering last known data. The repair fetch then replaces the entry when the server returns the new truth.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup is usually expected constant time, but structured-key hashing and filter matching add real constants. Misses pay network cost. Notifications cost O(k) for k observers on the changed entry, so a heavily shared query should avoid unnecessary updates.',
        'Freshness settings are behavioral cost controls. A stale time of 0 can refetch on every mount or focus, raising traffic and flicker. A stale time of 5 minutes lowers traffic but may show old data. A GC time of 30 seconds saves memory; a GC time of 30 minutes improves back-navigation reuse.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Query caches fit dashboards, issue trackers, feeds, search pages, detail views, notification badges, and admin consoles. They work wherever multiple components read the same remote fact and stale data is better than blank UI.',
        'They also support mutation workflows. A write can optimistically patch an entry, update from the server response, invalidate related keys, or trigger a broader refetch. The right choice depends on whether the mutation response contains enough truth to update cached facts safely.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when keys are wrong. Missing tenant, filter, locale, page, permission, or feature-flag inputs can merge unrelated data. Adding unstable or irrelevant inputs fragments the cache and prevents sharing.',
        'It also fails when teams use it for local interaction state. Modal open state, draft form text, selected tabs, and hover state are not server facts with freshness and repair semantics. Keeping them in a query cache makes identity and invalidation harder for no gain.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A dashboard has three components that ask for ["user", 42]. The first mount creates the entry and starts one request. The next two observers attach to the same entry and share the in-flight promise. When the response arrives at t = 0 with name Ada, all three render the same data and timestamp.',
        'Set staleTime = 10000 ms and gcTime = 300000 ms. At t = 12 seconds, the entry is stale but still visible; a focus event starts a background refetch. At t = 30 seconds, all observers unmount and the entry becomes inactive. If the user returns at t = 2 minutes, cached data appears immediately; if the user returns after 6 minutes, GC has deleted the entry and a new fetch starts.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: TanStack Query caching guide, TanStack Query important defaults, TanStack Query query keys guide, and SWR revalidation documentation. Verify current library defaults before teaching exact option names because client-cache APIs evolve.',
        'Study HTTP cache revalidation, ETags, cache invalidation, optimistic UI mutation logs, React Suspense resource caches, CORS preflight caching, and UI state machines next. The central lesson is to model remote data as shared state with time and observers.',
      ],
    },
  ],
};
