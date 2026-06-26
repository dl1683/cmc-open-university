// Kubernetes informers: list/watch feeds a DeltaFIFO, shared indexer cache,
// event handlers, and a rate-limited workqueue of reconcile keys.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-informer-deltafifo-workqueue-case-study',
  title: 'Kubernetes Informer DeltaFIFO & Workqueue Case Study',
  category: 'Systems',
  summary: 'A controller-internals case study: list/watch, resourceVersion, Reflector, DeltaFIFO, shared indexer cache, deduped keys, and rate-limited retries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['list watch cache', 'workqueue retry'], defaultValue: 'list watch cache' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function informerGraph(title) {
  return graphState({
    nodes: [
      { id: 'api', label: 'API', x: 0.7, y: 4.0, note: 'list/watch' },
      { id: 'rv', label: 'RV', x: 2.0, y: 2.5, note: 'cursor' },
      { id: 'refl', label: 'reflect', x: 2.3, y: 4.0, note: 'client-go' },
      { id: 'fifo', label: 'DeltaFIFO', x: 4.2, y: 4.0, note: 'deltas' },
      { id: 'index', label: 'indexer', x: 6.0, y: 2.7, note: 'cache' },
      { id: 'handler', label: 'handler', x: 6.0, y: 5.3, note: 'event' },
      { id: 'wq', label: 'wq', x: 7.8, y: 5.3, note: 'keys' },
      { id: 'recon', label: 'recon', x: 9.4, y: 5.3, note: 'fresh' },
    ],
    edges: [
      { id: 'e-api-refl', from: 'api', to: 'refl' },
      { id: 'e-api-rv', from: 'api', to: 'rv' },
      { id: 'e-rv-refl', from: 'rv', to: 'refl' },
      { id: 'e-refl-fifo', from: 'refl', to: 'fifo' },
      { id: 'e-fifo-index', from: 'fifo', to: 'index' },
      { id: 'e-fifo-handler', from: 'fifo', to: 'handler' },
      { id: 'e-handler-wq', from: 'handler', to: 'wq' },
      { id: 'e-wq-recon', from: 'wq', to: 'recon' },
    ],
  }, { title });
}

function* listWatchCache() {
  yield {
    state: informerGraph('Informer turns watch events into cached state'),
    highlight: { active: ['api', 'rv', 'refl', 'fifo'], found: ['index', 'wq'] },
    explanation: 'A Kubernetes informer is a data pipeline. It lists objects, watches changes from a resourceVersion cursor, accumulates deltas, updates a local indexer cache, and lets handlers enqueue reconcile keys.',
    invariant: 'Events wake controllers; cached state is the local read model.',
  };

  yield {
    state: labelMatrix(
      'List then watch',
      [
        { id: 'list', label: 'LIST' },
        { id: 'rv', label: 'RV' },
        { id: 'watch', label: 'WATCH' },
        { id: 'book', label: 'BOOK' },
      ],
      [
        { id: 'gets', label: 'gets' },
        { id: 'role', label: 'role' },
      ],
      [
        ['items', 'seed'],
        ['cursor', 'resume'],
        ['events', 'delta'],
        ['rv', 'book'],
      ],
    ),
    highlight: { active: ['list:gets', 'rv:role', 'watch:gets'], found: ['book:role'] },
    explanation: 'The initial LIST seeds the cache and returns a resourceVersion. WATCH continues from that cursor. Bookmark events can advance the cursor even when no object changed.',
  };

  yield {
    state: labelMatrix(
      'DeltaFIFO',
      [
        { id: 'add', label: 'Add' },
        { id: 'upd', label: 'Upd' },
        { id: 'del', label: 'Del' },
        { id: 'rep', label: 'Rep' },
        { id: 'sync', label: 'Sync' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'why', label: 'why' },
      ],
      [
        ['obj', 'new'],
        ['obj', 'change'],
        ['key', 'gone'],
        ['list', 'relist'],
        ['obj', 'resync'],
      ],
    ),
    highlight: { active: ['add:data', 'upd:data', 'del:data'], compare: ['rep:why', 'sync:why'] },
    explanation: 'DeltaFIFO buffers object changes as typed deltas. The consumer sees enough history to update the cache and notify handlers, while relists and periodic resyncs have explicit delta kinds.',
  };

  yield {
    state: labelMatrix(
      'Indexer cache',
      [
        { id: 'key', label: 'key' },
        { id: 'ns', label: 'ns' },
        { id: 'node', label: 'node' },
        { id: 'owner', label: 'owner' },
      ],
      [
        { id: 'idx', label: 'index' },
        { id: 'use', label: 'use' },
      ],
      [
        ['key', 'get'],
        ['ns', 'list'],
        ['node', 'pods'],
        ['uid', 'kids'],
      ],
    ),
    highlight: { found: ['key:use', 'ns:use', 'owner:use'], active: ['node:idx'] },
    explanation: 'SharedIndexInformer is valuable because controllers can read a local cache and secondary indexes instead of hammering the API server for every reconcile.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'pod', label: 'pod', x: 0.8, y: 4.0, note: 'update' },
        { id: 'handler', label: 'handler', x: 2.5, y: 4.0, note: 'event' },
        { id: 'key', label: 'key', x: 4.2, y: 4.0, note: 'ns/pod' },
        { id: 'wq', label: 'wq', x: 5.8, y: 4.0, note: 'dedupe' },
        { id: 'worker', label: 'worker', x: 7.4, y: 4.0, note: 'pop' },
        { id: 'get', label: 'get', x: 9.0, y: 4.0, note: 'cache/API' },
      ],
      edges: [
        { id: 'e-pod-handler', from: 'pod', to: 'handler' },
        { id: 'e-handler-key', from: 'handler', to: 'key' },
        { id: 'e-key-wq', from: 'key', to: 'wq' },
        { id: 'e-wq-worker', from: 'wq', to: 'worker' },
        { id: 'e-worker-get', from: 'worker', to: 'get' },
      ],
    }, { title: 'Handlers enqueue keys, not full work' }),
    highlight: { active: ['handler', 'key', 'wq'], found: ['get'], compare: ['pod'] },
    explanation: 'Good handlers stay cheap. They turn events into stable object keys and return. The worker later pops a key and reads fresh state before deciding what to do.',
    invariant: 'The event payload is a hint; the key is the durable work address.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'watchers', min: 0, max: 100 }, y: { label: 'API load', min: 0, max: 100 } },
      series: [
        { id: 'raw', label: 'raw poll', points: [{ x: 1, y: 5 }, { x: 25, y: 45 }, { x: 50, y: 75 }, { x: 100, y: 100 }] },
        { id: 'inf', label: 'shared', points: [{ x: 1, y: 5 }, { x: 25, y: 12 }, { x: 50, y: 18 }, { x: 100, y: 26 }] },
      ],
      markers: [{ id: 'storm', x: 80, y: 90, label: 'storm' }],
    }),
    highlight: { active: ['inf'], compare: ['raw', 'storm'] },
    explanation: 'Shared informers reduce duplicate list/watch load. A process can have several controllers consuming one local cache instead of each controller opening its own expensive watch loop.',
  };
}

function* workqueueRetry() {
  yield {
    state: graphState({
      nodes: [
        { id: 'add', label: 'Add', x: 0.8, y: 3.0, note: 'key A' },
        { id: 'dirty', label: 'dirty', x: 2.4, y: 3.0, note: 'set' },
        { id: 'queue', label: 'queue', x: 4.0, y: 3.0, note: 'FIFO' },
        { id: 'proc', label: 'proc', x: 5.6, y: 3.0, note: 'in flight' },
        { id: 'done', label: 'Done', x: 7.2, y: 2.0, note: 'ok' },
        { id: 'retry', label: 'retry', x: 7.2, y: 4.2, note: 'err' },
        { id: 'delay', label: 'delay', x: 8.8, y: 4.2, note: 'backoff' },
      ],
      edges: [
        { id: 'e-add-dirty', from: 'add', to: 'dirty' },
        { id: 'e-dirty-queue', from: 'dirty', to: 'queue' },
        { id: 'e-queue-proc', from: 'queue', to: 'proc' },
        { id: 'e-proc-done', from: 'proc', to: 'done' },
        { id: 'e-proc-retry', from: 'proc', to: 'retry' },
        { id: 'e-retry-delay', from: 'retry', to: 'delay' },
        { id: 'e-delay-queue', from: 'delay', to: 'queue' },
      ],
    }, { title: 'Workqueue dedupes keys and backs off failures' }),
    highlight: { active: ['dirty', 'queue', 'proc'], found: ['done'], compare: ['retry', 'delay'] },
    explanation: 'client-go workqueues are not plain arrays. They track dirty keys, processing keys, delayed retries, and rate limits so repeated events coalesce and failures do not spin hot.',
    invariant: 'One key can be dirty many times but should reconcile as one current state.',
  };

  yield {
    state: labelMatrix(
      'Queue state',
      [
        { id: 'dirty', label: 'dirty' },
        { id: 'queue', label: 'q' },
        { id: 'proc', label: 'run' },
        { id: 'delay', label: 'wait' },
      ],
      [
        { id: 'holds', label: 'holds' },
        { id: 'point', label: 'point' },
      ],
      [
        ['keys', 'dedupe'],
        ['order', 'work'],
        ['act', 'nodup'],
        ['retry', 'backoff'],
      ],
    ),
    highlight: { active: ['dirty:point', 'proc:point'], found: ['delay:point'] },
    explanation: 'The queue separates "this key needs work" from "a worker is currently handling this key." That avoids duplicate in-flight reconciles for the same object.',
  };

  yield {
    state: labelMatrix(
      'Worker loop',
      [
        { id: 'get', label: 'Get' },
        { id: 'read', label: 'Read' },
        { id: 'act', label: 'Act' },
        { id: 'ok', label: 'OK' },
        { id: 'err', label: 'Err' },
      ],
      [
        { id: 'step', label: 'step' },
        { id: 'result', label: 'result' },
      ],
      [
        ['pop', 'excl'],
        ['cache', 'fresh'],
        ['run', 'sidefx'],
        ['forget', 'clear'],
        ['limit', 'retry'],
      ],
    ),
    highlight: { found: ['read:result', 'ok:result'], active: ['err:result'] },
    explanation: 'A worker pops one key, reads the latest object state, reconciles, and then either forgets the key on success or requeues it with rate limiting on error.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'failures', min: 0, max: 8 }, y: { label: 'delay', min: 0, max: 100 } },
      series: [
        { id: 'fast', label: 'fast', points: [{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 8 }] },
        { id: 'slow', label: 'cap', points: [{ x: 3, y: 8 }, { x: 4, y: 16 }, { x: 5, y: 32 }, { x: 6, y: 60 }, { x: 8, y: 80 }] },
      ],
      markers: [{ id: 'cap', x: 6, y: 60, label: 'cap' }],
    }),
    highlight: { active: ['fast', 'slow'], found: ['cap'] },
    explanation: 'Rate-limited retries protect the API server and external dependencies. A broken cloud API should create slower retries, not thousands of immediate reconcile loops.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'slow', label: 'slow' },
        { id: 'gone', label: '410' },
        { id: 'block', label: 'block' },
        { id: 'storm', label: 'storm' },
        { id: 'mem', label: 'mem' },
      ],
      [
        { id: 'sym', label: 'sym' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['lagRV', 'LIST'],
        ['oldRV', 'LIST'],
        ['handler', 'key'],
        ['retry', 'backoff'],
        ['cache', 'less'],
      ],
    ),
    highlight: { active: ['gone:fix', 'storm:fix', 'block:fix'], compare: ['mem:sym'] },
    explanation: 'The main pitfalls are predictable: falling behind the watch history, blocking informer handlers, retry storms, and huge caches from watching broad resources with too many indexes.',
  };

  yield {
    state: labelMatrix(
      'Use the layer',
      [
        { id: 'small', label: 'small' },
        { id: 'many', label: 'many' },
        { id: 'ext', label: 'ext API' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'tool', label: 'tool' },
      ],
      [
        ['one', 'queue'],
        ['share', 'inform'],
        ['retry', 'rate'],
        ['why', 'status'],
      ],
    ),
    highlight: { found: ['many:tool', 'ext:tool'], active: ['audit:tool'] },
    explanation: 'The complete case study is an operator. Informers keep the local model fresh, event handlers enqueue keys, workers reconcile from current state, and status explains progress when external dependencies fail.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'list watch cache') yield* listWatchCache();
  else if (view === 'workqueue retry') yield* workqueueRetry();
  else throw new InputError('Pick a Kubernetes informer view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a controller data pipeline. An informer is client-go machinery that lists Kubernetes objects, watches later changes, stores a local cache, and wakes controller workers through a queue. Active nodes show the component currently transforming data, compare nodes show retry or stale paths, and found nodes show cached state or a key ready for reconciliation.',
        {type:"callout", text:"Informers separate events from state: watch deltas wake the controller, cache reads supply truth, and queue keys schedule retryable work."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Kubernetes controllers need current cluster state without hammering kube-apiserver. Polling every object every few seconds makes read cost grow with total object count, even when only one object changed. Informers restructure that path so a controller process can do one LIST, one WATCH, maintain a shared cache, and let many handlers consume the same local state.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious controller loop is polling: list all Pods, diff them against memory, reconcile changes, sleep, and repeat. It is easy to reason about because each cycle starts from a full snapshot. It works for small clusters where a full list is cheap and 15 seconds of reaction delay is acceptable.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that polling cost grows with total objects, not change rate. If a cluster has 100,000 Pods and one Pod changes, every poll still downloads and decodes all 100,000. Reducing the poll interval lowers latency but multiplies API load, so there is no polling interval that gives both fast reaction and low cost at large scale.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to separate notification, state, and work. Watch events say something changed, the indexer cache stores the latest observed object state, and the workqueue stores stable keys such as `namespace/name`. Workers reconcile from current cache state rather than trusting the old event payload that woke them up.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Reflector performs an initial LIST and records the returned `resourceVersion`, which is a cursor into Kubernetes object history. It starts a WATCH from that cursor, converts ADDED, MODIFIED, DELETED, REPLACED, and SYNC events into DeltaFIFO entries, and advances the cursor with watch events or bookmarks. The SharedIndexInformer pops deltas, updates the thread-safe indexer cache, calls event handlers, and those handlers enqueue keys into a rate-limited workqueue.',
        'The workqueue is not a plain array. It tracks queued keys, dirty keys that need work, keys currently processing, delayed retries, and per-key backoff. If key K changes while a worker is already processing K, the queue marks K dirty and requeues it after `Done`, preventing duplicate in-flight work without losing the later update.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is eventual reconciliation from current state. LIST seeds the cache, WATCH delivers changes after the seed version, and a 410 Gone or broken watch forces relist from the durable API server state. DeltaFIFO batches per-key deltas, the indexer updates before handlers enqueue work, and the workqueue guarantees dirty keys are processed without two workers reconciling the same key at once.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Steady-state network cost follows change rate because WATCH streams deltas, while relist cost follows total object count because LIST returns a full snapshot. Memory follows total watched objects plus indexes: 150,000 Pod objects at 4 KB each is about 600 MB before maps, indexes, and Go overhead. Adding a high-cardinality secondary index can add noticeable map overhead even though it does not copy every object.',
        'The behavioral cost is eventual consistency and retry discipline. The cache can be stale for milliseconds or much longer under API-server load, so writes still need resourceVersion conflict handling. A permanent external error must not be retried forever as if it were transient, or the workqueue becomes a controlled retry storm.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Informers are the base layer for kube-controller-manager, controller-runtime, Kubebuilder operators, GitOps controllers, autoscalers, and custom resource controllers. They fit systems where the API server is the source of truth, many consumers need the same objects, reads outnumber writes, and reconciliation can be idempotent. The pattern also generalizes to any evented API where a local read model and retryable work queue are cheaper than repeated full scans.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Informers fail when handlers do slow work, because cache updates and event delivery can stall behind that handler. They fail under memory pressure when controllers watch broad resources cluster-wide with many indexes. They also fail logically when controller code treats event payloads as truth instead of using the key to read the latest cache or API state before acting.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A Pod `default/web-abc` is modified at t=0. The API server sends a MODIFIED event, the Reflector puts an Updated delta into DeltaFIFO, the informer updates the cache at key `default/web-abc`, and the ReplicaSet handler enqueues the owning ReplicaSet key `default/web`. A worker pops `default/web`, reads the latest Deployment, ReplicaSet, and Pod state from indexes, then decides whether any replica count change is needed.',
        'If three Pod updates for the same owner arrive while the worker is processing `default/web`, the queue does not run three concurrent reconciles for that key. It marks the key dirty and runs one more pass after the current pass finishes. If the update fails because the API server is temporarily unavailable, `AddRateLimited` can retry after 5 ms, 10 ms, 20 ms, and so on up to a cap rather than spinning hot.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Use client-go `tools/cache` and `util/workqueue` source as primary sources, along with Kubernetes API watch semantics for `resourceVersion`, bookmark events, and 410 Gone behavior. Those sources define Reflector, DeltaFIFO, SharedIndexInformer, Store, Indexer, rate-limited queues, and retry backoff.',
        'Study queues and hash maps next because DeltaFIFO, indexers, and workqueues are specialized versions of those data structures. Then study etcd watch, controller-runtime reconciler design, rate limiters, and optimistic concurrency, because informer correctness depends on both event delivery and conflict-aware writes.',
      ],
    },
  ],
};