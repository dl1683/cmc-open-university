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
      heading: 'Why this exists',
      paragraphs: [
        'Many writes are slow only because the network is slow. A like, todo add, reorder, or draft edit often has an obvious expected result, and forcing the user to wait for confirmation makes the interface feel broken.',
        'Optimistic UI exists to show the expected result immediately while still keeping enough data to admit failure, retry, rollback, or reconcile with the server result.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to disable the button, wait for the request, then update the UI. That is honest, but it adds visible latency to simple operations.',
        'The next attempt is to directly change local state before sending the request. That feels fast, but without a mutation record the UI has no durable explanation for the pending value and no precise way to undo or reconcile it.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The happy path hides the hard cases. A refetch can overwrite the optimistic patch with older server data. Two writes can return out of order. A filtered list can show a pending item the server would exclude. A coarse rollback can erase a later successful mutation.',
        'The missing structure is a log. The client needs to know which pending operation created which visible change, what order it belongs to, and how to undo or settle it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Optimistic UI is a mutation log plus a projection. The log stores variables, client id or submitted time, status, ordering, rollback context, and a reconciliation plan. The projection renders base server data as if the pending log entries had already committed.',
        'That projection can be a direct cache patch, a separate UI overlay, or both. The important rule is that optimism is explicit data, not a hidden side effect.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the mutation-path view, follow the operation record, not just the visible card or row. The UI changes immediately because the client has added a pending entry, saved rollback context, and projected that entry over the last confirmed server data.",
        "In the conflict-handling view, pay attention to ordering. A later mutation can be visible while an earlier one is still unresolved, and a refetch can bring back server data that is older than the optimistic projection. The log is what lets the client reapply pending intent after new base data arrives.",
        "Every highlighted state answers one question: can the client still explain why the screen looks this way? If the answer is yes, rollback, retry, commit, and reconciliation are structured operations. If the answer is no, optimism has become a hidden side effect.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On mutate, the client records the operation, snapshots the old cache value or stores an inverse operation, cancels or pauses conflicting refetches, applies the optimistic projection, and sends the request.',
        'On success, the client replaces temporary ids, writes the server response into cache, removes or marks the pending record, and may invalidate related queries. On failure, it rolls back the snapshot, applies the inverse operation, or keeps a failed retryable record visible.',
        'For a task board, adding a card creates `op#17` with a temporary id. Success swaps `temp:17` for the server id. Failure removes the pending card or marks it failed. Moving a card may need an overlay because it affects two columns, counts, filters, and detail views.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a todo app filtered to "active" items. The user adds "pay invoice." The client creates `op#42`, assigns `temp:42`, stores the submitted text, and renders the item as pending. If the server returns id `todo_900`, the client rewrites references from the temporary id to the real id and marks the operation settled.',
        'Now consider a failed toggle. The user marks an item done, which would remove it from the active filter. If the request fails and the client only saved the visible list, rollback may be wrong because other refetches or local edits may have changed the list in the meantime. A better design stores the inverse operation, such as "set completed back to false for item X," and then reapplies remaining pending operations over the current base data.',
        'The important distinction is snapshot rollback versus operation rollback. A snapshot is simple and works for isolated writes. An inverse operation is more robust when many views and concurrent mutations can touch the same data.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that every visible unconfirmed change has a matching pending mutation record. That record is the source of rollback, retry, ordering, and pending UI.',
        'Ordering makes concurrent optimism deterministic. If operations have submitted timestamps or client sequence numbers, the UI can render them in a stable order even when server responses arrive out of order.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The fast path is a local cache or overlay update, usually much cheaper than a network round trip. The real cost is bookkeeping: snapshots, inverse operations, temp ids, mutation records, invalidation, and reconciliation code.',
        'Memory grows with pending operations and rollback context. Complexity grows with the number of cached views touched by a mutation. Direct cache patches are convenient for shared data, but overlays are safer when filters, sorting, pagination, or multiple lists make a precise patch hard.',
      ],
    },
    {
      heading: 'Conflict patterns',
      paragraphs: [
        'Out-of-order responses are the common case. If mutation A and mutation B touch the same entity, and B returns first, the client cannot blindly overwrite the cache when A returns later. It needs a version, timestamp, server authority rule, or replay model that says which result wins and how pending operations are reapplied.',
        'Refetch races are another common case. Many libraries cancel outgoing refetches before applying an optimistic patch because an old response can otherwise erase the patch. If a refetch is allowed to complete, the client should treat its result as new base data and replay still-pending mutations on top.',
        'Temporary ids create their own edge cases. A pending comment may be referenced by a pending reaction, edit, or reorder before the server assigns the real id. The mutation log needs an id-mapping step so settled server data can connect back to local intent.',
      ],
    },
    {
      heading: 'Design rules',
      paragraphs: [
        'Show pending state when the user may care. Fast does not mean invisible. A subtle pending marker, disabled duplicate action, or retry affordance tells the user the interface is making a promise that has not settled yet.',
        'Keep optimism narrow for high-harm operations. You can optimistically move a card in a kanban board because the inverse is clear. You should not optimistically show a bank transfer as final, grant admin access, or reveal data controlled by server authorization.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Optimism wins for reversible, low-harm writes: likes, todos, local edits, draft saves, card reordering, and comments that can be marked pending.',
        'It is strongest when the user already expects the write to succeed and the app can clearly label pending, failed, and retried states.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Optimistic UI is not free latency. It borrows trust from the future. If the app hides pending and failed states, it can feel fast while lying to the user.',
        'Do not optimistically grant authority, spend money, send irreversible messages, or show protected data before a write commits. Use optimism where the inverse operation is clear and user harm is low.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: TanStack Query optimistic updates at https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates, TanStack Query mutations at https://tanstack.com/query/v5/docs/framework/react/guides/mutations, SWR mutation and revalidation at https://swr.vercel.app/docs/mutation, and React useOptimistic at https://react.dev/reference/react/useOptimistic. Study Query Cache: Stale Time & GC, Cache Invalidation & Versioning, UI State Machine Workflow, AbortController Cancellation Graph, Background Sync Outbox Queue, IndexedDB Object Store Case Study, and Local-First Sync Engine next.',
      ],
    },
  ],
};
