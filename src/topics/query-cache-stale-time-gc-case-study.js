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
      heading: 'What it is',
      paragraphs: [
        'A client query cache is a data structure for server state. It maps query keys to records that store payload, status, error, timestamps, an observer set, and sometimes an in-flight promise. The goal is to share one answer across many components while keeping the answer repairable when the server changes.',
        'The two important clocks are stale time and garbage-collection time. Stale time controls freshness. Garbage-collection time controls how long inactive cached data remains after the last observer unmounts.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A component subscribes with a query key. If the entry is missing, the cache creates it and starts the query function. If the entry exists, the component receives cached data immediately and joins the observer set. If the entry is stale, the cache can refetch in the background while old data stays visible.',
        'This turns loading from a component-local boolean into a cache-level state machine. One key can have many observers. One stale entry can have one deduped fetch. One mutation can invalidate a family of keys so only affected data repairs itself.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider an issue tracker. The issue list, unread badge, search sidebar, and issue detail drawer all read server state. Without a query cache, each component invents a fetch lifecycle and the app can show four inconsistent copies. With a keyed cache, the list uses posts:list filters, detail uses post:id, badge uses notifications, and each record owns status, observers, freshness, and retention.',
        'The design lesson is cache identity. A sloppy key merges unrelated data. A too-specific key prevents reuse. A stale time that is too short creates noisy background traffic. A garbage-collection time that is too long retains data users will not revisit.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A query cache is not the source of truth. The server is. Cached data can be stale, incomplete, filtered, or personalized. Invalidation marks suspicion; it does not prove that the new fetch will return the intended state.',
        'Do not use one global stale time as a doctrine. A stock quote, a user profile, a terms-of-service PDF, and a historical chart have different freshness economics. This page connects HTTP Cache ETag Revalidation to the client-side server-state cache: both are about named copies with repair paths.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: TanStack Query caching guide at https://tanstack.com/query/v5/docs/framework/react/guides/caching, TanStack Query important defaults at https://tanstack.com/query/v5/docs/framework/react/guides/important-defaults, TanStack Query query keys guide at https://tanstack.com/query/v5/docs/framework/react/guides/query-keys, and SWR cache and revalidation docs at https://swr.vercel.app/docs/revalidation. Study React Suspense Resource Cache, HTTP Cache ETag Revalidation, Cache Invalidation & Versioning, CORS Preflight Cache, Optimistic UI Mutation Log, and UI State Machine Workflow next.',
      ],
    },
  ],
};
