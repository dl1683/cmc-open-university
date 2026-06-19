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
        "Read the animation as the execution trace for Kubernetes Informer DeltaFIFO & Workqueue Case Study. A controller-internals case study: list/watch, resourceVersion, Reflector, DeltaFIFO, shared indexer cache, deduped keys, and rate-limited retries..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why Informers Exist',
      paragraphs: [
        "Kubernetes controllers are built around reconciliation: observe desired state, compare it with actual or external state, and take steps to move the world closer to the desired state. The controller pattern sounds simple until thousands of objects are changing, many controllers need the same objects, watches disconnect, and external APIs fail. Informers are the data-structure layer that makes controllers efficient enough to run inside a busy cluster.",
        "The naive controller polls the API server. Every few seconds it lists all Pods, Deployments, or custom resources, scans for work, and writes fixes. That approach is easy to understand and terrible at scale. It creates redundant reads, burns API-server capacity, reacts slowly between polls, and still has to solve retries. If ten controllers each poll the same resource, the cluster pays ten times for almost the same information.",
        "An informer turns the API server\'s list/watch model into a local read model. It lists once to seed state, watches for changes, buffers deltas, updates a shared cache, calls lightweight event handlers, and lets controllers enqueue reconcile keys. The main separation is events versus state. Events wake the controller. The cache holds the latest observed object state. The workqueue stores stable addresses for work."
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "The pipeline starts with a LIST request. The API server returns the current objects and a resourceVersion, which acts as a cursor into the stream of changes for that resource. The client then opens a WATCH from that cursor. Watch events report added, modified, deleted, bookmark, or error conditions. Bookmark events can advance the cursor even when no object changed, which helps clients know they are still making progress.",
        "This design avoids the polling wall, but it is not magic. Watch history is finite. If a controller falls too far behind and asks to resume from an old resourceVersion, the API server can return a gone error. The controller must relist, rebuild its local view, and resume watching from a fresh cursor. Correct informer code treats relist as a normal recovery path, not an exceptional disaster.",
        "The Reflector in client-go owns this list/watch loop. It talks to the API server, maintains the resourceVersion, and pushes observed changes into a DeltaFIFO. Above it, a SharedIndexInformer consumes those deltas, updates a local store, maintains indexes, and invokes registered handlers. This layering keeps watch mechanics, cache maintenance, and controller-specific work separate."
      ],
    },
    {
      heading: 'DeltaFIFO',
      paragraphs: [
        "DeltaFIFO is the buffer between the watch stream and the informer consumer. It stores object changes as typed deltas: Added, Updated, Deleted, Replaced, and Sync. The FIFO part preserves processing order by key. The delta part preserves what kind of change happened. A relist can produce replacement deltas. A periodic resync can produce sync deltas even if the object did not change.",
        "The value of DeltaFIFO is that it smooths a live event stream into a consumable sequence while giving the cache enough information to update itself correctly. Deletes are especially important. A delete may arrive with a tombstone when the final object is not available in the usual form. Consumers must handle that path because caches still need to remove the right key.",
        "The hard lesson is that deltas are not a substitute for idempotent reconcile logic. They help maintain the local cache and notify handlers, but a controller should not base irreversible action on an old event payload. By the time a worker acts, the object may have changed again or disappeared. The durable work address is the key, usually namespace/name. The worker should reread current state before acting."
      ],
    },
    {
      heading: 'Shared Indexer Cache',
      paragraphs: [
        "The SharedIndexInformer cache is a local map from keys to the latest observed objects, plus optional secondary indexes. The basic key is namespace/name for namespaced resources or name for cluster-scoped resources. Secondary indexes let controllers answer common questions without API calls: list all objects in a namespace, find children by owner UID, find Pods scheduled to a node, or find custom resources referencing a Secret.",
        "This cache is why many controllers can run without hammering the API server. A reconcile worker can read the watched object from memory, list related objects through indexes, and issue only the writes or uncached reads it truly needs. Multiple controllers in the same process can share one informer instead of opening duplicate watches and maintaining duplicate caches.",
        "The tradeoff is memory and staleness. The cache holds copies of watched objects and index entries. Broad watches over high-cardinality resources such as Pods, Secrets, ConfigMaps, or custom resources can be expensive. Indexes multiply memory. The cache is also eventually consistent with the API server. Controllers must tolerate that the latest write may not have arrived in the local cache yet, especially during startup, relist, or watch recovery."
      ],
    },
    {
      heading: 'Workqueue Semantics',
      paragraphs: [
        "Informer event handlers should be cheap. A good handler usually computes a key and adds it to a workqueue. It does not call slow external APIs, perform long writes, or block the informer. Blocking the handler path delays cache updates and can cause the watch consumer to fall behind.",
        "The client-go workqueue is not a plain array. It tracks dirty keys, queued keys, keys currently being processed, delayed retries, and rate limits. If the same key is added ten times while it is already queued, the queue can coalesce those adds. If a key is added while a worker is processing it, the dirty state ensures it can be processed again after the current run finishes. That prevents duplicate in-flight reconciles while still preserving the fact that another change arrived.",
        "A worker loop pops a key, reads fresh state, reconciles, and then calls Done. On success it calls Forget to clear rate-limit history. On transient failure it uses AddRateLimited so the key returns after backoff. On permanent absence, such as a deleted object, reconcile should perform cleanup if needed and then succeed. This makes retries explicit and keeps a broken dependency from creating a tight loop."
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "Consider a certificate operator. It watches Certificate custom resources and Secrets. The Certificate informer tells the controller when desired certificate state changes. The Secret informer tells it when issued key material appears, changes, or disappears. Both informers maintain local caches. Event handlers map Certificate events directly to certificate keys. Secret events may use an owner index or label index to find which Certificate keys are affected.",
        "A worker pops a certificate key and reads the latest Certificate and referenced Secret from the cache. If the Certificate was deleted, it cleans up external orders if finalizers require it. If the Secret is valid and not near expiry, it records healthy status. If renewal is needed, it calls the certificate authority. If the authority is unavailable, it records a condition and requeues with backoff. If the authority succeeds, it writes the Secret and updates status.",
        "This is not just event handling. Duplicate events, missed events, restarts, relists, and external failures should still converge because the worker decides from current state. The queue dedupes and retries. The cache supplies a local view. Status tells users why progress is stuck. The controller\'s correctness comes from idempotent reconciliation, not from receiving a perfect event sequence."
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "The predictable informer failures are falling behind watch history, blocking handlers, unbounded caches, retry storms, stale reads, and bad ownership mapping. A gone error from an old resourceVersion requires relist. A slow handler should be moved to workers. A broad cluster-wide watch may need namespaces, field selectors, label selectors, or narrower controllers. A retry storm needs rate limiting and a clear permanent-error path. A stale cache read needs idempotency and sometimes direct API reads for critical confirmation.",
        "Useful metrics include list duration, watch restarts, resourceVersion gone errors, queue depth, add rate, worker duration, retry count by key, rate-limiter delay, cache object count, index sizes, handler latency, reconcile result, and external dependency latency. Logs should include the key, observed generation, resourceVersion when relevant, decision, and requeue reason. Status conditions should expose progress to users instead of hiding failures in controller logs.",
        "There are design tradeoffs. A shared cache lowers API load but uses memory. Narrow watches save memory but can miss relationships if selectors are wrong. More indexes speed lookups but cost memory and update time. More workers increase throughput but can overload external services. Longer backoff protects dependencies but delays recovery. The right controller makes these choices intentionally and validates them under event bursts, restarts, and API-server disruption."
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        "Primary sources are Kubernetes API concepts for watches and resourceVersion, client-go cache package documentation, client-go workqueue documentation, and the client-go workqueue examples. Next study Kubernetes reconciliation, etcd Raft, queues, message queues, backpressure, rate limiters, cache invalidation, idempotency, owner references, finalizers, and distributed tracing. Those topics explain why informer-based controllers treat events as hints, keys as durable work addresses, and current state as the source for action."
      ],
    },
      {
      heading: 'Why this exists',
      paragraphs: [
        "State the real constraint this topic fixes before introducing the mechanism.",
        "A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.",
        "Without that, every optimization appears decorative.",
      ],
    },

    {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'How it works',
      paragraphs: [
        "Describe the mechanism as a sequence of state transitions, not as a story.",
        "Each step should say what changes, what stays true, and why the move is legal.",
        "The animation should look like this section made concrete.",
      ],
    },

    {
      heading: 'Why it works',
      paragraphs: [
        "Give the proof sketch as a preservation argument: invariant before, move, invariant after.",
        "If there is a nontrivial corner case, name it explicitly.",
        "When correctness is explicit, readers can transfer the method to new inputs.",
      ],
    },

    {
      heading: 'Cost and behavior',
      paragraphs: [
        "Cost is both asymptotic and practical.",
        "State what grows, what stays flat, and what setup cost dominates before the method becomes useful.",
        "If possible, convert cost into an intuition: doubling, halving, or crossing a fixed bound.",
      ],
    },

    {
      heading: 'Real-world uses',
      paragraphs: [
        "Show where this approach appears in products, libraries, or service designs.",
        "Tie each use case to a workload shape, not a brand name.",
        "The learner should know exactly when this pattern should be chosen next.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for kubernetes-informer-deltafifo-workqueue-case-study, continue to the next topic in the same track.'
  ],
      },
],
};

