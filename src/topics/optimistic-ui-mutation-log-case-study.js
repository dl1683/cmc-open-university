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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each frame as a state machine for one write. Active nodes are the part of the client or server currently changing, found nodes are the committed or trusted state, compare nodes are possible races, and removed nodes are paths the current result no longer takes.',
        'A mutation is a user intent that has not necessarily reached the server yet. The safe inference rule is simple: if a visible optimistic change has a matching log record with rollback context, the client can explain, settle, retry, or undo that change.',
        {type:'callout', text:'Optimistic UI is safe only when immediate feedback is backed by an explicit mutation log that can project, settle, retry, or roll back intent.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A network write can take 80 ms on a good connection and 1,000 ms on a bad one. The user already knows what should happen after clicking like, adding a todo, or dragging a card, so waiting for the round trip makes the interface feel slower than the work itself.',
        'Optimistic UI shows the expected result before the server confirms it. The hard part is honesty: the app must keep enough data to admit that the write is pending, failed, retried, or replaced by server truth.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to disable the control, send the request, and update the screen only after success. That is correct for money movement and authorization, and it is easy to reason about because the screen never outruns the server.',
        'The next obvious approach is to update local state immediately and hope the request works. That feels fast in the demo, but it creates hidden state when the code does not record which operation caused the visible change.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not the happy path. It is the failed request, the refetch that returns old data, the second mutation that settles before the first, and the filtered list that would not contain the new item on the server.',
        'Without a mutation log, rollback becomes a guess. Restoring an old snapshot can erase later valid edits, while doing nothing can leave a row on screen that the server rejected.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat optimism as a projection over base data. Base data is the last confirmed server state; the mutation log is the ordered list of pending user intents; the visible UI is base data with those intents replayed on top.',
        'That split turns failure handling into data handling. A log entry can store variables, submitted time, temporary ids, status, rollback context, retry count, and the rule for replacing local data with server data.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On mutate, the client appends a log record, snapshots the old cache value or stores an inverse operation, and projects the new state into the UI. It may also cancel matching refetches so an old response does not overwrite the optimistic projection.',
        'On success, the client settles the record and reconciles temporary data with server data. On failure, it applies the inverse operation, restores a snapshot when safe, or keeps a failed record visible with a retry action.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is that every unconfirmed visible change has one pending mutation record. If the invariant holds, the UI can be recomputed from confirmed server data plus a deterministic replay of pending operations.',
        'Ordering makes concurrent writes predictable. If operation 17 and operation 18 touch the same list, the client renders them by client sequence or submitted time, then removes each record only when the server response has been reconciled.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The fast path costs one local cache write or overlay update, which is usually microseconds compared with a network round trip. The real cost is code: temp ids, inverse operations, refetch cancellation, status rendering, retry behavior, and tests for out-of-order settlement.',
        'Memory grows with the number of pending operations and the size of rollback context. A todo title snapshot may be 80 bytes; a board reorder snapshot can include two lists and hundreds of ids, so inverse operations often scale better than whole-view snapshots.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Optimistic UI fits reversible, low-harm writes. Likes, todo adds, local drafts, comment posting with a pending marker, and kanban reorders are good examples because the user intent is clear and the inverse action is cheap.',
        'It also fits offline-capable clients when paired with an outbox. The log can persist through reload, retry when connectivity returns, and keep the screen honest by showing which records are still local intent rather than server fact.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the app shows authority it does not have. Do not optimistically grant admin access, mark a bank transfer final, reveal protected data, or send irreversible messages as if the server had accepted them.',
        'It also fails when filters and derived views are patched by hand. A new task may belong in one list, change a count, miss a search result, and affect a detail panel, so a narrow cache patch can leave the interface internally inconsistent.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A task app has server list version 12 with 40 active tasks. The user adds task temp-7 at time 101 ms, so the client appends operation 7, renders 41 active tasks, and stores an inverse operation that removes temp-7 from the active list.',
        'The network returns success after 420 ms with id task-900 and list version 13. The client replaces temp-7 with task-900, removes operation 7 from the log, and keeps the 41-task view because server truth now supports it.',
        'If the server instead rejects the write after 420 ms, the inverse operation removes temp-7 and the list returns to 40 tasks. If operation 8 edited another task while operation 7 was pending, replaying the remaining log after rollback preserves operation 8 instead of restoring a stale whole-list snapshot.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study TanStack Query optimistic updates at https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates, SWR mutation at https://swr.vercel.app/docs/mutation, and React useOptimistic at https://react.dev/reference/react/useOptimistic. Read them for the same contract: record intent, show pending state, settle from server data, and roll back on failure.',
        'Next, study Cache Invalidation and Versioning, Background Sync Outbox Queue, AbortController Cancellation Graph, UI State Machine Workflow, IndexedDB Object Store Case Study, and Local-First Sync Engine. These topics explain the cache, transport, and persistence layers that make optimistic UI reliable outside a demo.',
      ],
    },
  ],
};