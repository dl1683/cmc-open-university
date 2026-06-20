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
      heading: 'Why this exists',
      paragraphs: [
        'Client apps often need the same server data in several places: a list, a badge, a detail drawer, and a chart. If every component owns its own fetch, the app wastes network work and can show inconsistent copies of the same server fact.',
        'A query cache exists because server state is shared, remote, and time-sensitive. It needs identity, observers, freshness rules, deduped fetches, invalidation, and memory cleanup.',
        {type:'callout', text:'A query cache is not a fetch helper but a shared identity map with observers, freshness clocks, repair triggers, and retention policy.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is `useEffect` plus local component state: fetch on mount, set loading, set data, set error, and clean up on unmount. That is enough for an isolated widget.',
        'The second attempt is a plain global object keyed by URL. That shares data, but it usually lacks observers, stale clocks, in-flight promise dedupe, targeted invalidation, and garbage collection.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Local fetch state has no shared identity. Two components asking for the same resource can race two requests and render two answers. A mutation can update one copy while another copy stays stale.',
        'A plain object cache has the opposite failure: it can keep data forever or treat old data as fresh forever. Server state needs repair paths because the server can change without the current component knowing.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A query cache is an identity map from query key to entry. The entry is a small state machine plus metadata: data, status, error, updated time, observer set, stale policy, inactive timer, and maybe an in-flight promise.',
        'Stale time answers whether cached data can be trusted without refetching on normal triggers. Garbage-collection time answers how long inactive data should remain after the last observer leaves.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the cache-lifecycle view, follow one query key through states: missing, loading, fresh, stale, fetching, inactive, and collected. The same data can be visible while it is stale; stale means eligible for repair, not unusable.",
        "In the observer-graph view, watch components attach to the cache entry rather than creating their own fetches. The observer set is what lets one request feed several UI surfaces and what tells the cache when data has become inactive.",
        "The key distinction is stale time versus garbage-collection time. Stale time controls trust. GC time controls memory retention after nobody is watching.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "A dashboard shows a user name in the header, a profile card, and an audit panel. All three subscribe to `['user', userId]`. The first component starts the request. The other two join the same cache entry and share the in-flight promise. When the result arrives, all observers receive the same data and timestamp.",
        'After ten seconds, the entry may become stale. The UI can still render the old name while a focus event triggers background refetch. When every component unmounts, the entry becomes inactive. If the user returns before GC time expires, the cache can show data immediately and repair it if stale. If GC time expires, the entry is deleted and the next mount starts over.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A component subscribes with a query key. If no entry exists, the cache creates one and runs the query function. If an entry exists, the component joins the observer set and receives cached data immediately. If a fetch is already in flight for that key, the observer shares it.',
        'When the request resolves, the entry stores data and an updated timestamp. When stale time elapses, the data is not deleted; it becomes eligible for background refetch on triggers such as mount, focus, reconnect, polling, or invalidation.',
        'When the observer set becomes empty, the entry becomes inactive. A garbage-collection timer decides whether to keep it for quick return navigation or delete it to reclaim memory.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that one query key owns one cache entry. Observers do not subscribe to fetch calls; they subscribe to entries. That is why many components can share one result and one in-flight request.',
        'Invalidation is safe because it changes freshness, not identity. Marking matching keys stale says the cached answer is suspect while still allowing the UI to render the last known value until repair finishes.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'A key lookup is expected constant time, but hashing structured keys and comparing filters add real constants. Fetch cost dominates misses. Notification cost grows with the number of observers on the changed entry.',
        'Space grows with cached entries, payload size, metadata, in-flight promises, and observer records. Short stale time increases background traffic. Long stale time increases the chance of old UI. Short garbage-collection time saves memory but loses reuse on back navigation. Long garbage-collection time keeps useful data and useless data alike.',
        'Mutation handling adds another cost. After a write, the cache needs either an optimistic patch, a targeted invalidation, a direct update from the server response, or a broader refetch. The right choice depends on whether the mutation response contains enough truth to update related query keys safely.',
      ],
    },
    {
      heading: 'Key design',
      paragraphs: [
        'A query key should include every input that changes the server answer: resource id, filters, pagination, tenant, locale, permissions boundary, and feature flag if it affects the response. Leaving out an input merges unrelated data. Adding irrelevant inputs prevents sharing and creates cache fragmentation.',
        'Keys should also be stable. Creating a new object shape or function identity on every render can defeat reuse in libraries that depend on structured key equality. Good cache design is partly API design: name the server fact clearly enough that every component can ask for the same fact the same way.',
      ],
    },
    {
      heading: 'Choosing stale time',
      paragraphs: [
        'Freshness should follow the domain. A feature flag, stock quote, incident status, and legal PDF should not share one stale-time default. Ask how expensive a wrong answer is, how often the server changes, whether users can tolerate background repair, and whether the data is pushed elsewhere by subscriptions or invalidation.',
        'A short stale time is not automatically safer. It can create refetch storms, flicker, and load on the same server the UI depends on. A long stale time is not automatically wrong if the data is genuinely stable or if mutations invalidate the relevant keys precisely.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Query caches win for shared server state: dashboards, issue trackers, detail pages, feeds, notification badges, search filters, and any screen where several components read the same remote fact.',
        'They also win when stale data is better than blank UI. A user can keep reading the old result while a background refetch repairs the entry.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A query cache is not the source of truth. The server is. Cached data can be stale, filtered, personalized, partially hydrated, or based on permissions that have changed.',
        'Bad keys are a correctness bug. A sloppy key merges unrelated data. A too-specific key prevents reuse. One global stale time is also wrong: a stock quote, a user profile, a terms-of-service PDF, and a historical chart have different freshness economics.',
        'It also fails when teams use it for local UI state. Modal open state, form draft state, and selected tabs do not become better because they live in a server-state cache. Keep local interaction state local, and use the query cache for remote facts with freshness and repair semantics.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: TanStack Query caching guide at https://tanstack.com/query/v5/docs/framework/react/guides/caching, TanStack Query important defaults at https://tanstack.com/query/v5/docs/framework/react/guides/important-defaults, TanStack Query query keys guide at https://tanstack.com/query/v5/docs/framework/react/guides/query-keys, and SWR cache and revalidation docs at https://swr.vercel.app/docs/revalidation. Study React Suspense Resource Cache, HTTP Cache ETag Revalidation, Cache Invalidation & Versioning, CORS Preflight Cache, Optimistic UI Mutation Log, and UI State Machine Workflow next.',
      ],
    },
  ],
};
