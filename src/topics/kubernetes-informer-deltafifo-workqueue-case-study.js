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
      heading: 'What it is',
      paragraphs: [
        'A Kubernetes informer is the data-structure layer underneath many controllers. It turns API-server list/watch streams into a local cache, typed deltas, event callbacks, and workqueue keys. Kubernetes Reconciliation explains the controller pattern; this case study explains the machinery that makes that pattern efficient and retryable.',
        'The key separation is events versus state. A watch event says something changed. The shared indexer cache stores the latest observed objects. The workqueue stores object keys that need reconciliation. The worker reads current state before acting, so a burst of ten updates can collapse into one reconcile of the newest object.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The Reflector lists a resource, records the returned resourceVersion, then watches for changes from that version. Watch events become DeltaFIFO entries such as Added, Updated, Deleted, Replaced, and Sync. A SharedIndexInformer consumes those deltas, updates the local store and indexes, and calls event handlers.',
        'Handlers should stay cheap. They usually compute a namespace/name key and add it to a rate-limited workqueue. Worker goroutines pop keys, read the latest object from cache or API, run the reconcile function, and then either Forget the key on success or AddRateLimited on failure.',
        'Indexes make the cache useful. A controller can look up by namespace/name, list by namespace, find child objects by owner UID, or attach custom indexes such as pods by node. That reduces API-server load and keeps reconcile loops focused on local reads plus intentional writes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The local cache saves API calls, but it costs memory proportional to watched objects and indexes. Broad watches over Pods, Secrets, or ConfigMaps can be large. Slow handlers or blocked workers can make a watcher fall behind; if the resourceVersion is too old, the client must relist. Retry loops also need rate limiting, or one broken dependency can overload the API server.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A certificate operator watches Certificate custom resources and Secrets. Informers maintain local caches for both object types. An Add or Update handler enqueues the certificate key. The worker reads the latest certificate and referenced secret, creates or renews an external order if needed, records status, and requeues with backoff when the certificate authority is unavailable.',
        'This shape is why controllers are not just event callbacks. The informer gives a consistent local read model, the queue gives deduplication and retry, and reconcile logic decides from current state. A missed event, duplicate event, restart, or temporary failure should still converge.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not block inside informer event handlers. Do not assume the event object is the freshest state. Do not watch every object in the cluster if a narrower namespace, field selector, label selector, or custom index will do. Do not forget rate limiting and status: retries without backoff create storms, and users need to know why convergence is stuck.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Kubernetes API concepts on watches and resourceVersion at https://kubernetes.io/docs/reference/using-api/api-concepts/, client-go cache package docs at https://pkg.go.dev/k8s.io/client-go/tools/cache, client-go workqueue package docs at https://pkg.go.dev/k8s.io/client-go/util/workqueue, and the client-go workqueue example at https://github.com/kubernetes/client-go/blob/master/examples/workqueue/main.go.',
        'Study Kubernetes Reconciliation, Kubernetes Scheduler Priority Queue & Preemption Case Study, etcd Raft Case Study, Queue, Message Queue, Backpressure, Rate Limiter, Cache Invalidation, Idempotency Keys, and Distributed Tracing next.',
      ],
    },
  ],
};
