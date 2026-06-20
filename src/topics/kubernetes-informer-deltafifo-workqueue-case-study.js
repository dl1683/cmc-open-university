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
        "The animation traces data flow through a Kubernetes controller's informer pipeline. In the \"list watch cache\" view, active nodes show the component currently processing an event -- API server emitting, Reflector relaying, DeltaFIFO buffering, or indexer caching. Found nodes are components whose state is now settled for this cycle. In the \"workqueue retry\" view, active nodes trace a key's journey from Add through dirty/queue/processing, with compare markers on the retry-with-backoff path.",
        "Watch for three things at each frame: which component owns the data right now, what transformed between the previous component and this one (raw HTTP event becomes typed Delta becomes cache entry becomes reconcile key), and where the pipeline can stall or lose progress.",
        {
          type: 'note',
          content: 'The plot frames show API-server load scaling. The gap between the \"raw poll\" and \"shared\" curves is the entire reason informers exist -- that gap widens with every additional controller sharing the cache.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        "A Kubernetes cluster runs dozens of controllers. The Deployment controller watches Deployments and ReplicaSets. The endpoint-slice controller watches Services, Pods, and Nodes. The garbage collector watches every resource type. Each controller needs a local view of cluster state to decide what to reconcile.",
        "Without informers, each controller would poll the API server independently. Ten controllers watching Pods means ten LIST requests every few seconds, each returning the full set of Pod objects. In a 5,000-node cluster with 150,000 Pods, a single LIST of all Pods can return 200+ MB of JSON. Multiply by ten controllers polling every 5 seconds and the API server spends most of its time serializing redundant responses.",
        {
          type: 'quote',
          content: 'The API server is the bottleneck in every large Kubernetes cluster. Informers exist because the alternative -- every controller polling independently -- would make that bottleneck lethal.',
          source: 'Kubernetes scalability design principle',
        },
        "The constraint is concrete: etcd backs the API server and can sustain roughly 10,000 read requests per second before latency degrades. A polling architecture exhausts that budget on redundant reads, leaving no headroom for writes, leader election, or user kubectl calls. Informers restructure the read path so each resource type is listed once and watched once per process, regardless of how many controllers consume the data.",
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "The reasonable first attempt is poll-based reconciliation. Every 30 seconds, list all objects of interest, diff them against the last known state, and reconcile anything that changed. This works in small clusters. It is easy to reason about because each poll cycle is a clean snapshot. There are no partial updates, no event ordering concerns, and no watch connection management.",
        {
          type: 'code',
          language: 'go',
          content: '// Naive polling controller\nfor {\n    pods, err := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{})\n    if err != nil { log.Error(err); time.Sleep(30*time.Second); continue }\n    for _, pod := range pods.Items {\n        reconcile(pod)\n    }\n    time.Sleep(30 * time.Second)\n}',
        },
        "This approach has three properties that feel like advantages early on. First, it is stateless between cycles -- a crash just means the next poll picks up. Second, it naturally deduplicates because each cycle sees current state, not accumulated events. Third, it requires no connection management. Early Kubernetes controllers (pre-1.0) used variants of this pattern before the informer framework matured.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "Polling hits two walls simultaneously: load and latency.",
        {
          type: 'table',
          headers: ['Metric', '100 Pods', '10,000 Pods', '150,000 Pods'],
          rows: [
            ['LIST response size', '~50 KB', '~5 MB', '~200 MB'],
            ['Serialization time', '<10 ms', '~200 ms', '~3 s'],
            ['10 controllers x 30s poll', '~3 LIST/s', '~3 LIST/s', '~3 LIST/s'],
            ['API server bandwidth', '~150 KB/s', '~15 MB/s', '~600 MB/s'],
            ['Reaction latency (avg)', '15 s', '15 s', '15 s'],
          ],
        },
        "The load wall: each LIST returns every object, not just the ones that changed. If one Pod out of 150,000 changes, the controller still downloads all 150,000 to find it. Bandwidth and API-server CPU grow with total object count, not with change rate.",
        "The latency wall: polling at 30-second intervals means changes are detected 15 seconds late on average. Reducing the interval to 1 second fixes latency but multiplies load by 30x. There is no polling interval that gives both fast reaction and low load when the object count is large.",
        "The invariant that polling violates: read cost must scale with the rate of change, not the total number of objects. A system where one changed Pod costs as much to detect as 150,000 unchanged Pods cannot scale. The watch protocol fixes this by streaming only the deltas.",
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "Separate event delivery from state storage. Events wake a controller and tell it something changed. The local cache holds the latest observed state. The workqueue holds stable keys identifying what needs work. These three concerns -- notification, caching, and work scheduling -- compose into a pipeline where each stage has a single, clear contract.",
        {
          type: 'diagram',
          content: 'API Server --LIST+WATCH--> Reflector --Deltas--> DeltaFIFO --Pop--> HandleDeltas\n                                                                         |\n                                                               +---------+---------+\n                                                               |                   |\n                                                         Indexer Cache      Event Handlers\n                                                         (local store)     (enqueue keys)\n                                                                                   |\n                                                                              Workqueue\n                                                                                   |\n                                                                           Worker goroutines\n                                                                         (read cache, reconcile)',
        },
        "The key separation: event handlers never act on the event payload directly. They extract a stable key (namespace/name) and add it to the workqueue. The worker later pops that key and reads the current object from the local cache. By the time the worker runs, the object may have changed again -- and that is fine, because the worker always acts on current state, not on the event that triggered it.",
        {
          type: 'note',
          content: 'This is level-triggered, not edge-triggered. The event is a hint that something needs attention. The cache is the source of truth for what to do. If ten events arrive for the same Pod while a worker is busy, the workqueue deduplicates them into one re-reconciliation from current state.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "The pipeline has five stages, each implemented as a distinct type in the k8s.io/client-go/tools/cache package.",
        {
          type: 'heading',
          level: 3,
          content: 'Stage 1: Reflector -- LIST then WATCH',
        },
        "The Reflector issues an initial LIST to seed all current objects, recording the returned resourceVersion as a cursor. It then opens a WATCH from that cursor. Each watch event (ADDED, MODIFIED, DELETED, BOOKMARK, ERROR) is pushed into the DeltaFIFO. If the watch disconnects or the API server returns HTTP 410 Gone (meaning the requested resourceVersion is too old for the server's watch history), the Reflector re-lists to rebuild state.",
        {
          type: 'code',
          language: 'go',
          content: '// Reflector.ListAndWatch (simplified)\nlist, err := listerWatcher.List(options)\nresourceVersion := list.ResourceVersion\nfor _, item := range list.Items {\n    store.Add(item)  // store is the DeltaFIFO\n}\nfor {\n    watcher, err := listerWatcher.Watch(options{ResourceVersion: resourceVersion})\n    for event := range watcher.ResultChan() {\n        switch event.Type {\n        case watch.Added:    store.Add(event.Object)\n        case watch.Modified: store.Update(event.Object)\n        case watch.Deleted:  store.Delete(event.Object)\n        case watch.Bookmark: resourceVersion = event.Object.ResourceVersion\n        }\n    }\n    // Watch ended -- loop back and reconnect\n}',
        },
        "Bookmark events advance the resourceVersion cursor without delivering an object change. This matters because the API server's watch cache has finite history (default: 3 minutes of events in etcd). Without bookmarks, an idle watch could fall behind the history window and force an expensive relist even though nothing changed.",
        {
          type: 'heading',
          level: 3,
          content: 'Stage 2: DeltaFIFO -- buffered, typed deltas',
        },
        "DeltaFIFO is a queue keyed by object identity. For each key, it stores a list of Deltas -- (DeltaType, Object) pairs. The five DeltaType values are Added, Updated, Deleted, Replaced, and Sync. Replaced deltas appear during a relist. Sync deltas appear during periodic resync (a configurable interval, often 30 seconds to 10 minutes, where the informer re-enqueues all cached objects to trigger reconciliation even without watch events).",
        {
          type: 'table',
          headers: ['DeltaType', 'Trigger', 'Object payload', 'Purpose'],
          rows: [
            ['Added', 'Watch ADDED event', 'Full object', 'New object appeared'],
            ['Updated', 'Watch MODIFIED event', 'Full object', 'Object fields changed'],
            ['Deleted', 'Watch DELETED event', 'Full object or DeletedFinalStateUnknown', 'Object removed from API server'],
            ['Replaced', 'Relist after 410 Gone', 'Full object', 'Cache rebuild -- treat as authoritative snapshot'],
            ['Sync', 'Periodic resync timer', 'Object from local cache', 'Trigger re-reconciliation without a real change'],
          ],
        },
        "The FIFO ordering guarantee: keys are processed in the order they were first enqueued. Within a single key, all accumulated deltas are delivered together in one Pop call. This means a consumer sees the full delta history for an object in one batch, which lets HandleDeltas update the cache and fire event handlers atomically per key.",
        {
          type: 'heading',
          level: 3,
          content: 'Stage 3: HandleDeltas -- cache update + event dispatch',
        },
        "The controller's processLoop calls DeltaFIFO.Pop in a tight loop. Pop blocks until a key has deltas, removes it from the queue, and passes the delta list to HandleDeltas. For each delta, HandleDeltas does two things: updates the thread-safe indexer store (Add, Update, or Delete the object) and calls every registered event handler (OnAdd, OnUpdate, OnDelete).",
        {
          type: 'heading',
          level: 3,
          content: 'Stage 4: Indexer -- the shared local cache',
        },
        "The indexer is a thread-safe map from key (namespace/name) to the latest known object. It also maintains secondary indexes -- functions that extract index keys from objects. The built-in NamespaceIndex lets controllers list all objects in a given namespace in O(1). Custom indexes can map by owner UID, node name, label value, or any computed property.",
        {
          type: 'code',
          language: 'go',
          content: '// Common indexer patterns\ncache.NewIndexer(cache.MetaNamespaceKeyFunc, cache.Indexers{\n    cache.NamespaceIndex: cache.MetaNamespaceIndexFunc,\n    "byNode": func(obj interface{}) ([]string, error) {\n        pod := obj.(*v1.Pod)\n        return []string{pod.Spec.NodeName}, nil\n    },\n    "byOwnerUID": func(obj interface{}) ([]string, error) {\n        meta := obj.(metav1.Object)\n        var keys []string\n        for _, ref := range meta.GetOwnerReferences() {\n            keys = append(keys, string(ref.UID))\n        }\n        return keys, nil\n    },\n})',
        },
        {
          type: 'heading',
          level: 3,
          content: 'Stage 5: Workqueue -- deduplication and rate-limited retries',
        },
        "Event handlers enqueue reconcile keys into a workqueue. The client-go workqueue tracks three sets internally:",
        {
          type: 'table',
          headers: ['Set', 'Type', 'Purpose'],
          rows: [
            ['queue', 'ordered slice', 'Keys waiting to be processed, in FIFO order'],
            ['dirty', 'set', 'Keys that need processing (deduplication gate)'],
            ['processing', 'set', 'Keys currently being handled by a worker'],
          ],
        },
        "When Add(key) is called: if the key is already in dirty, nothing happens (deduplication). If the key is in processing but not dirty, it is added to dirty so it will be re-processed after the current worker finishes. Otherwise, it is added to both dirty and queue. When Get() is called: a key is removed from queue and dirty, and added to processing. When Done(key) is called: the key is removed from processing. If the key was re-added to dirty while processing, it is moved back to queue for another pass.",
        "This three-set design guarantees: no duplicate keys in queue, no duplicate in-flight processing of the same key, and no lost updates (a change arriving during processing is not silently dropped).",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "The informer pipeline preserves a core invariant: every change to a watched resource eventually triggers at least one reconciliation from current state. The proof has three parts.",
        "First, the watch stream is reliable because the Reflector treats disconnections and 410 Gone responses as normal. A disconnect triggers reconnection from the last known resourceVersion. A 410 triggers a full relist, which resets the cache and resourceVersion. No permanent data loss occurs because the API server (backed by etcd) is the durable source of truth, and relist always recovers the full current state.",
        "Second, DeltaFIFO preserves ordering per key and batches deltas so the consumer processes them atomically. The cache update and event handler dispatch happen in the same Pop callback. If the callback fails, the delta is not removed from the queue -- it will be retried. This means the cache and the handlers stay consistent: you cannot have a handler fire for a change that the cache does not reflect.",
        "Third, the workqueue preserves the invariant that every dirty key eventually gets processed. The dirty set ensures that a change arriving during processing is not lost. The processing set ensures that two workers never reconcile the same key simultaneously. Rate limiting ensures that transient failures do not spin into tight loops. The combination means: every change triggers eventual reconciliation, no key is processed concurrently, and failures back off.",
        {
          type: 'note',
          content: 'The critical corner case is DeletedFinalStateUnknown. When a relist finds that an object in the cache no longer exists on the API server, DeltaFIFO emits a Deleted delta with a DeletedFinalStateUnknown wrapper containing the last cached version. Controllers must handle this type in their OnDelete handler -- if they only type-assert to their expected object type, they will silently drop deletes that arrive via relist.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Resource', 'Cost', 'What drives it'],
          rows: [
            ['Network (steady-state)', 'O(change rate)', 'Watch delivers only deltas, not full snapshots'],
            ['Network (relist)', 'O(total objects)', 'Full LIST; proportional to object count x object size'],
            ['Memory (cache)', 'O(total objects)', 'One copy of each watched object in the indexer'],
            ['Memory (indexes)', 'O(total objects x index count)', 'Each index stores a reverse map entry per object'],
            ['CPU (event dispatch)', 'O(handlers x change rate)', 'Each registered handler is called for every delta'],
            ['CPU (workqueue)', 'O(change rate)', 'Deduplication is set-lookup; Add/Get/Done are O(1) amortized'],
            ['API server load', 'O(1) per resource type per process', 'One LIST + one WATCH stream, shared across all controllers'],
          ],
        },
        "The practical cost that dominates at scale is memory. In a 5,000-node cluster, watching all Pods means caching ~150,000 Pod objects. A typical Pod object is 3-5 KB as a Go struct after deserialization. That is 450 MB to 750 MB of heap for Pods alone. Add Nodes, Services, Endpoints, ConfigMaps, Secrets, and custom resources, and kube-controller-manager can easily consume 2-4 GB of RAM.",
        "Doubling the cluster size roughly doubles informer memory. Adding a secondary index adds another reverse map per object -- not a full copy of the object, but an index entry (typically a string key to a set of object keys). For high-cardinality indexes like \"by owner UID\" on Pods, that can add 10-20% overhead on top of the base cache.",
        "Relist cost is bursty. A single relist of 150,000 Pods transfers ~200 MB and takes 2-5 seconds of API-server CPU for serialization. During relist, the old cache is replaced atomically, so memory briefly doubles. The DefaultControllerRateLimiter uses exponential backoff with a base delay of 5 ms and a max delay of 1,000 seconds (16.7 minutes), so relist storms are naturally damped.",
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'kube-controller-manager: runs ~30 controllers in one process, all sharing informers via SharedInformerFactory. The Deployment controller, ReplicaSet controller, Job controller, and garbage collector all watch overlapping resource types through a single shared cache.',
            'Operator pattern: every Kubernetes operator (cert-manager, Prometheus Operator, ArgoCD, Crossplane) uses informers to watch custom resources and owned objects. The operator SDK and controller-runtime library wrap informers behind a higher-level Manager/Controller API, but the underlying pipeline is identical.',
            'Custom autoscalers: the Horizontal Pod Autoscaler watches metrics resources and scales targets. Custom autoscalers use the same informer pattern to watch application-specific CRDs and adjust capacity based on domain logic.',
            'GitOps controllers: ArgoCD and Flux watch Application or GitRepository CRDs and reconcile cluster state against a git repository. Their informers track both the desired-state CRDs and the actual cluster resources being managed.',
            'Multi-cluster controllers: federation-style controllers watch resources across multiple clusters by running informers against multiple API servers, merging state into a unified view for cross-cluster scheduling or policy enforcement.',
          ],
        },
        "The pattern fits any workload where: (a) the source of truth is an event-streaming API, (b) many consumers need the same data, (c) reads vastly outnumber writes, and (d) reconciliation must be idempotent because events can be duplicated, reordered, or lost during reconnection.",
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Root cause', 'Fix'],
          rows: [
            ['410 Gone storm', 'Repeated full relists, API server under load', 'Watch cache too small or resync interval too short', 'Increase --watch-cache-size, use bookmarks, lengthen resync interval'],
            ['Blocked handler', 'Cache updates stall, queue depth grows unbounded', 'Event handler does slow I/O or computation', 'Move work to the workqueue; handler should only compute a key and return'],
            ['Memory explosion', 'OOMKill of controller process', 'Watching high-cardinality resources cluster-wide with many indexes', 'Use field/label selectors, namespace-scoped watches, or drop unnecessary indexes'],
            ['Retry storm', 'Thousands of AddRateLimited calls per second', 'Permanent error treated as transient, or missing max-retry limit', 'Distinguish permanent vs transient errors; use Forget + log for permanent failures'],
            ['Stale read', 'Reconcile acts on outdated object, creates conflict', 'Cache is eventually consistent; object changed after cache read', 'Use resourceVersion-aware updates, or re-read from API server for critical writes'],
            ['Thundering herd on restart', 'All cached objects reconciled simultaneously', 'Relist re-enqueues everything; resync does the same', 'Stagger worker starts, use jittered resync periods'],
          ],
        },
        "The deepest design limitation is memory proportionality. Informer caches hold full copies of every watched object. There is no built-in way to watch only specific fields. The API server's watch protocol sends full objects on every MODIFIED event, even if only metadata.labels changed. WatchList (alpha in Kubernetes 1.27) and field-level send/receive filtering are ongoing efforts to reduce this cost.",
        "The second limitation is consistency. The local cache is eventually consistent. Between a write landing in etcd and the watch event arriving in the informer, there is a window (typically 10-100 ms, but unbounded under API-server load) where the cache is stale. Controllers that read from the cache and write back to the API server must use optimistic concurrency (resourceVersion on updates) or risk overwriting concurrent changes.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "Trace a single Pod update through the full pipeline of a Deployment controller.",
        {
          type: 'code',
          language: 'text',
          content: 'Timeline:\n  t=0   API server: Pod default/web-abc-xyz modified (container image changed)\n  t=1ms Reflector: receives MODIFIED watch event, calls DeltaFIFO.Update(pod)\n  t=2ms DeltaFIFO: key="default/web-abc-xyz" gets Delta{Updated, pod} appended\n  t=3ms processLoop: Pop("default/web-abc-xyz") -> HandleDeltas\n  t=3ms HandleDeltas: indexer.Update(pod), then calls OnUpdate handlers\n  t=4ms ReplicaSet handler: extracts owner -> finds ReplicaSet "default/web-abc"\n        enqueues key "default/web-abc" into workqueue\n  t=4ms Deployment handler: extracts owner of RS -> finds Deployment "default/web"\n        enqueues key "default/web" into workqueue\n  t=5ms Worker goroutine: Get() returns "default/web-abc" (ReplicaSet key)\n        reads RS from cache, reads owned Pods from byOwnerUID index\n        all Pods healthy -> Done("default/web-abc"), Forget("default/web-abc")\n  t=6ms Worker goroutine: Get() returns "default/web" (Deployment key)\n        reads Deployment from cache, reads owned RSes from index\n        current RS matches desired -> Done("default/web"), Forget("default/web")',
        },
        "If the Pod update had arrived while the worker was already processing \"default/web-abc\", the workqueue would add it to the dirty set. When the worker calls Done, it would find the key dirty and re-enqueue it. The second reconciliation would read the latest Pod state from the cache -- not the event payload from the first notification.",
        "If the reconciliation fails (for example, the Deployment controller cannot update the ReplicaSet because the API server is temporarily unavailable), the worker calls AddRateLimited(\"default/web\"). The rate limiter computes a backoff delay: 5 ms for the first failure, 10 ms, 20 ms, doubling up to a cap of 1,000 seconds. The key sits in the delayed queue until the backoff expires, then re-enters the active queue for another attempt. On success, Forget resets the failure counter to zero.",
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'heading',
          level: 3,
          content: 'Primary sources',
        },
        {
          type: 'bullets',
          items: [
            'client-go source: k8s.io/client-go/tools/cache -- DeltaFIFO, Reflector, SharedIndexInformer, Store, Indexer interfaces and implementations.',
            'client-go workqueue: k8s.io/client-go/util/workqueue -- Interface, RateLimitingInterface, DefaultControllerRateLimiter (BucketRateLimiter + ItemExponentialFailureRateLimiter).',
            'Kubernetes API conventions: the Watch section of the API reference documents resourceVersion semantics, 410 Gone behavior, bookmark events, and watch cache configuration.',
            'controller-runtime: sigs.k8s.io/controller-runtime -- the higher-level framework wrapping informers, used by Kubebuilder and Operator SDK.',
          ],
        },
        {
          type: 'heading',
          level: 3,
          content: 'Study next',
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: queues (FIFO ordering, bounded buffers, backpressure) and hash maps (the indexer is fundamentally a concurrent hash map with secondary indexes).',
            'Extension: etcd watch protocol -- how etcd implements the watch stream that the API server proxies to informers, including compaction and the 410 boundary.',
            'Contrast: event sourcing -- informers look like event sourcing but differ in a critical way. Event-sourced systems derive state by replaying the event log. Informers derive state from the latest snapshot and use events only as invalidation signals.',
            'Production depth: rate limiters and backoff strategies -- the workqueue rate limiter composes a token bucket (overall throughput cap) with per-item exponential backoff (individual failure isolation).',
            'Related case study: controller-runtime reconciler pattern -- how the higher-level framework maps informer events to a single Reconcile(Request) call, hiding DeltaFIFO and workqueue internals.',
          ],
        },
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        {
          type: 'note',
          content: 'Revisit after watching both views. In the list-watch-cache view, the left-to-right flow mirrors the stages above: API -> Reflector -> DeltaFIFO -> Indexer + Handler -> Workqueue -> Reconciler. In the workqueue-retry view, the cycle Add -> dirty -> queue -> processing -> Done/Retry shows the three-set deduplication mechanism. The backoff plot shows delay growing exponentially then hitting the cap.',
        },
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'State the invariant the workqueue preserves about dirty keys in one sentence.',
            'A watch event arrives for key K while K is in the processing set. Trace the key through Add, Done, and Get. What prevents duplicate in-flight processing?',
            'The API server returns 410 Gone. What does the Reflector do, what does DeltaFIFO emit, and what DeltaType do the resulting deltas carry?',
            'A controller watches 100,000 Pods cluster-wide. Estimate the informer cache memory cost. What is the first optimization to reduce it?',
            'An event handler calls an external HTTP API before enqueuing a key. What breaks? Name two symptoms.',
          ],
        },
      ],
    },
  ],
};

