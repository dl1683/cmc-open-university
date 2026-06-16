// Optimistic UI as a mutation log: pending writes, snapshots, overlays,
// rollback records, invalidation, and server reconciliation.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'optimistic-ui-mutation-log-case-study',
  title: 'Optimistic UI Mutation Log',
  category: 'Systems',
  summary: 'A complete optimistic-update case study: pending mutation records, snapshots, cache patches, rollback paths, concurrent writes, and refetch reconciliation.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['mutation path', 'conflict handling'], defaultValue: 'mutation path' },
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

function mutationGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'ui', label: 'UI', x: 0.9, y: 4.9, note: notes.ui ?? 'button' },
      { id: 'log', label: 'log', x: 2.8, y: 5.8, note: notes.log ?? 'pending op' },
      { id: 'snap', label: 'snap', x: 2.8, y: 3.6, note: notes.snap ?? 'old cache' },
      { id: 'cache', label: 'cache', x: 5.0, y: 4.9, note: notes.cache ?? 'patched' },
      { id: 'net', label: 'net', x: 7.0, y: 5.8, note: notes.net ?? 'POST' },
      { id: 'server', label: 'server', x: 9.0, y: 4.9, note: notes.server ?? 'truth' },
      { id: 'rollback', label: 'rollback', x: 7.0, y: 3.3, note: notes.rollback ?? 'restore' },
      { id: 'refetch', label: 'refetch', x: 9.0, y: 3.3, note: notes.refetch ?? 'repair' },
    ],
    edges: [
      { id: 'e-ui-log', from: 'ui', to: 'log', weight: '' },
      { id: 'e-log-snap', from: 'log', to: 'snap', weight: '' },
      { id: 'e-snap-cache', from: 'snap', to: 'cache', weight: '' },
      { id: 'e-log-cache', from: 'log', to: 'cache', weight: 'patch' },
      { id: 'e-log-net', from: 'log', to: 'net', weight: '' },
      { id: 'e-net-server', from: 'net', to: 'server', weight: '' },
      { id: 'e-net-rollback', from: 'net', to: 'rollback', weight: 'err' },
      { id: 'e-server-refetch', from: 'server', to: 'refetch', weight: '' },
      { id: 'e-refetch-cache', from: 'refetch', to: 'cache', weight: '' },
    ],
  }, { title });
}

function* mutationPath() {
  yield {
    state: mutationGraph('User intent becomes a pending mutation record', { ui: 'add todo', log: 'op#17' }),
    highlight: { active: ['ui', 'log', 'e-ui-log'], found: ['cache'] },
    explanation: 'An optimistic update starts by recording the user intent. The pending mutation record stores variables, a client id or submitted timestamp, status, and enough context to retry or render a pending row.',
    invariant: 'The pending mutation is data, not a hidden side effect.',
  };

  yield {
    state: mutationGraph('Snapshot before patching the visible cache', { snap: 'todos v4', cache: 'todos v4' }),
    highlight: { active: ['log', 'snap', 'cache', 'e-log-snap', 'e-snap-cache'], compare: ['net'] },
    explanation: 'Before patching the cache, the client snapshots the previous value or stores an inverse operation. Without a rollback record, failure handling becomes guesswork.',
  };

  yield {
    state: mutationGraph('Optimistic patch updates the UI immediately', { cache: '+temp todo', net: 'in flight', server: 'not done' }),
    highlight: { found: ['cache'], active: ['log', 'net', 'e-log-cache', 'e-log-net'], compare: ['server'] },
    explanation: 'The cache or UI overlay is patched before the server responds. The user sees immediate feedback while the network request runs. The patch should be visibly pending when correctness matters.',
  };

  yield {
    state: mutationGraph('Success reconciles temp data with server data', { server: 'id=42', refetch: 'invalidate', cache: 'real id' }),
    highlight: { found: ['server', 'refetch', 'cache', 'e-server-refetch', 'e-refetch-cache'], removed: ['rollback'] },
    explanation: 'On success, the client can replace a temporary id with the server id, populate the cache from the response, or invalidate related queries so the server result wins.',
  };

  yield {
    state: mutationGraph('Failure rolls back or keeps a retryable record', { net: 'error', rollback: 'restore v4', cache: 'undo patch', log: 'retry?' }),
    highlight: { removed: ['server', 'refetch'], active: ['net', 'rollback', 'snap', 'cache', 'e-net-rollback', 'e-snap-cache'] },
    explanation: 'On failure, rollback restores the snapshot or applies the inverse operation. Some products keep the failed optimistic row with a retry button, but they must label it as failed, not committed.',
  };
}

function* conflictHandling() {
  yield {
    state: labelMatrix(
      'Pending log',
      [
        { id: 'op1', label: 'op 1' },
        { id: 'op2', label: 'op 2' },
        { id: 'op3', label: 'op 3' },
        { id: 'op4', label: 'op 4' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'order', label: 'order' },
      ],
      [
        ['pending', 't=101'],
        ['pending', 't=102'],
        ['ok', 'server id'],
        ['error', 'retry'],
      ],
    ),
    highlight: { active: ['op1:state', 'op2:state'], found: ['op3:state'], removed: ['op4:state'] },
    explanation: 'Concurrent optimistic writes need ordering. A submitted timestamp or client sequence lets the UI render pending operations deterministically while server responses arrive out of order.',
    invariant: 'Optimism without ordering becomes flicker.',
  };

  yield {
    state: mutationGraph('A refetch can overwrite a local optimistic patch', { cache: '+temp row', refetch: 'old list', server: 'lagged read' }),
    highlight: { compare: ['refetch', 'cache', 'e-refetch-cache'], active: ['log', 'e-log-cache'] },
    explanation: 'Outgoing refetches can race the optimistic patch and put old data back into the cache. Many libraries cancel or pause matching queries before applying an optimistic cache update.',
  };

  yield {
    state: labelMatrix(
      'Update styles',
      [
        { id: 'ui', label: 'UI only' },
        { id: 'cache', label: 'cache' },
        { id: 'overlay', label: 'overlay' },
        { id: 'crdt', label: 'op log' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['local list', 'limited'],
        ['shared data', 'rollback'],
        ['complex view', 'merge'],
        ['offline', 'conflict'],
      ],
    ),
    highlight: { found: ['ui:fit', 'cache:fit', 'overlay:fit'], compare: ['crdt:risk'] },
    explanation: 'There are two common optimistic styles: render pending variables beside real data, or directly patch the shared cache. Overlays are safer for complex filters because they can be removed without rewriting every cached query.',
  };

  yield {
    state: labelMatrix(
      'SWR mutate',
      [
        { id: 'optim', label: 'optimistic' },
        { id: 'populate', label: 'populate' },
        { id: 'reval', label: 'revalidate' },
        { id: 'rollback', label: 'rollback' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'why', label: 'why' },
      ],
      [
        ['patch now', 'fast UI'],
        ['write result', 'server wins'],
        ['refetch', 'repair'],
        ['undo err', 'honesty'],
      ],
    ),
    highlight: { found: ['optim:does', 'rollback:does'], active: ['reval:does'] },
    explanation: 'SWR exposes the same core levers through mutate options: optimistic data for the immediate patch, populateCache for the resolved result, revalidate for repair, and rollbackOnError for failure.',
  };

  yield {
    state: labelMatrix(
      'Case choices',
      [
        { id: 'like', label: 'like' },
        { id: 'todo', label: 'todo' },
        { id: 'pay', label: 'payment' },
        { id: 'invite', label: 'invite' },
      ],
      [
        { id: 'optimism', label: 'optimism' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['high', 'easy undo'],
        ['high', 'clear retry'],
        ['low', 'money'],
        ['careful', 'email side'],
      ],
    ),
    highlight: { found: ['like:optimism', 'todo:optimism'], compare: ['pay:optimism'], active: ['invite:reason'] },
    explanation: 'Optimistic UI is a product decision. It fits likes, todos, local edits, and draft saves. It is dangerous for payments, irreversible side effects, or permissions where the user must not see uncommitted authority.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'mutation path') yield* mutationPath();
  else if (view === 'conflict handling') yield* conflictHandling();
  else throw new InputError('Pick an optimistic UI view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Optimistic UI renders the expected result of a write before the server confirms it. The data structure is a pending mutation log plus either a cache patch, a UI overlay, or both. The log gives the UI a durable explanation for why a not-yet-confirmed item is visible.',
        'A good optimistic update stores variables, ordering, status, rollback context, and a reconciliation plan. That plan might restore a snapshot on error, replace a temporary id on success, or invalidate related queries so the server result repairs the cache.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On mutate, the client records the operation, snapshots the old cache value, cancels or pauses conflicting refetches, applies the optimistic patch, and sends the request. On success it commits or reconciles. On failure it rolls back or leaves a failed record with a retry path.',
        'The hard part is not the happy path. It is races. Refetches can overwrite optimistic data. Two writes can return out of order. A filtered list can include a pending item that the server would filter out. A rollback can erase a later mutation if the snapshot is too coarse.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a task board. Adding a card creates op#17 with a temporary id, patches the list, and sends POST /cards. If the server returns id=42, the cache swaps temp:17 for 42 and invalidates board queries. If the server rejects the card, the rollback restores the previous list or marks temp:17 failed with a retry button.',
        'Moving a card is harder. The mutation affects the source column, target column, counts, filters, and maybe a detail drawer. For that case, an overlay log can be safer than rewriting every cached list. The overlay says: render card X as if it moved until the server confirms or rejects.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Optimistic UI is not free latency. It borrows trust from the future. The UI must still communicate pending, failed, and retried states. Hiding those states can make the app feel fast while silently lying.',
        'Do not optimistically grant authority, spend money, send irreversible messages, or show data protected by a write that has not committed. Use optimism where the inverse operation is clear and user harm is low.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: TanStack Query optimistic updates at https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates, TanStack Query mutations at https://tanstack.com/query/v5/docs/framework/react/guides/mutations, SWR mutation and revalidation at https://swr.vercel.app/docs/mutation, and React useOptimistic at https://react.dev/reference/react/useOptimistic. Study Query Cache: Stale Time & GC, Cache Invalidation & Versioning, UI State Machine Workflow, AbortController Cancellation Graph, Background Sync Outbox Queue, IndexedDB Object Store Case Study, and Local-First Sync Engine next.',
      ],
    },
  ],
};
