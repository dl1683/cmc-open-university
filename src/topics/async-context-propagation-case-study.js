// Async context propagation: request-local stores, async resources, promise
// continuations, timers, logs, traces, snapshots, and leak boundaries.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'async-context-propagation-case-study',
  title: 'Async Context Propagation',
  category: 'Systems',
  summary: 'How request-local context survives async hops through AsyncLocalStorage, async resources, promises, timers, snapshots, trace IDs, and cleanup boundaries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['request context', 'propagation map'], defaultValue: 'request context' },
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

function asyncGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'req', label: 'request', x: 0.8, y: 4.7, note: notes.req ?? 'HTTP' },
      { id: 'store', label: 'store', x: 2.7, y: 4.7, note: notes.store ?? 'trace id' },
      { id: 'promise', label: 'promise', x: 4.8, y: 5.8, note: notes.promise ?? 'await' },
      { id: 'timer', label: 'timer', x: 4.8, y: 3.5, note: notes.timer ?? 'callback' },
      { id: 'db', label: 'DB', x: 6.8, y: 5.8, note: notes.db ?? 'query' },
      { id: 'log', label: 'log', x: 6.8, y: 3.5, note: notes.log ?? 'with id' },
      { id: 'trace', label: 'span', x: 8.35, y: 4.7, note: notes.trace ?? 'trace' },
      { id: 'res', label: 'resp', x: 9.85, y: 4.7, note: notes.res ?? 'done' },
    ],
    edges: [
      { id: 'e-req-store', from: 'req', to: 'store', weight: 'run' },
      { id: 'e-store-promise', from: 'store', to: 'promise', weight: '' },
      { id: 'e-store-timer', from: 'store', to: 'timer', weight: '' },
      { id: 'e-promise-db', from: 'promise', to: 'db', weight: '' },
      { id: 'e-timer-log', from: 'timer', to: 'log', weight: '' },
      { id: 'e-db-trace', from: 'db', to: 'trace', weight: '' },
      { id: 'e-log-trace', from: 'log', to: 'trace', weight: '' },
      { id: 'e-trace-res', from: 'trace', to: 'res', weight: '' },
    ],
  }, { title });
}

function* requestContext() {
  yield {
    state: asyncGraph('A request enters with a context store'),
    highlight: { active: ['req', 'store', 'e-req-store'], found: ['promise', 'timer'] },
    explanation: 'Async context gives each request a local store, such as request id, tenant, auth subject, trace id, or deadline, without passing it through every function parameter.',
    invariant: 'The store belongs to an async execution, not to a global variable.',
  };

  yield {
    state: asyncGraph('Promise continuations keep the same request context', { promise: 'then/await', db: 'uses id' }),
    highlight: { active: ['store', 'promise', 'db', 'e-store-promise', 'e-promise-db'], compare: ['timer'] },
    explanation: 'When async context is propagated correctly, code after await can still read the store for the request that started the chain.',
  };

  yield {
    state: asyncGraph('Timers and callbacks need explicit async-resource linkage', { timer: 'setTimeout', log: 'id ok' }),
    highlight: { found: ['timer', 'log'], active: ['store', 'e-store-timer', 'e-timer-log'] },
    explanation: 'The hard part is not one promise. It is every boundary: timers, callbacks, queues, native addons, workers, and instrumentation layers must preserve or restore the right context.',
  };

  yield {
    state: asyncGraph('Logs and traces read context without argument plumbing', { log: 'req=42', trace: 'span parent', res: 'correlated' }),
    highlight: { found: ['log', 'trace', 'res'], active: ['e-log-trace', 'e-trace-res'] },
    explanation: 'The common use case is observability. Logs, database spans, metrics, and error reports can attach the same request id even when they happen deep in library code.',
  };

  yield {
    state: labelMatrix(
      'Context values',
      [
        { id: 'trace', label: 'trace id' },
        { id: 'tenant', label: 'tenant' },
        { id: 'auth', label: 'auth' },
        { id: 'deadline', label: 'deadline' },
      ],
      [
        { id: 'use', label: 'use' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['logs', 'mixup'],
        ['routing', 'leak'],
        ['policy', 'stale'],
        ['timeout', 'ignored'],
      ],
    ),
    highlight: { found: ['trace:use', 'deadline:use'], compare: ['auth:risk', 'tenant:risk'] },
    explanation: 'Trace ids are low risk. Auth and tenant context are high risk because a propagation bug can become an isolation or authorization bug.',
  };
}

function* propagationMap() {
  yield {
    state: labelMatrix(
      'Propagation map',
      [
        { id: 'promise', label: 'promise' },
        { id: 'timer', label: 'timer' },
        { id: 'queue', label: 'queue' },
        { id: 'worker', label: 'worker' },
      ],
      [
        { id: 'needs', label: 'needs' },
        { id: 'bug', label: 'bug' },
      ],
      [
        ['snapshot', 'lost id'],
        ['bind cb', 'wrong req'],
        ['carrier', 'leak'],
        ['message', 'no magic'],
      ],
    ),
    highlight: { found: ['promise:needs', 'timer:needs', 'queue:needs'], compare: ['worker:bug'] },
    explanation: 'A runtime needs a propagation map for every async boundary. Promises, timers, queues, and worker messages do not all share the same mechanics.',
    invariant: 'Context does not cross every boundary automatically.',
  };

  yield {
    state: asyncGraph('A snapshot captures current context for later work', { store: 'snapshot', timer: 'later cb', log: 'same id' }),
    highlight: { active: ['store', 'timer', 'log', 'e-store-timer', 'e-timer-log'], compare: ['req'] },
    explanation: 'Snapshot or bind APIs capture the current mapping and run later code under that mapping. This is how callback-style APIs can preserve request-local data.',
  };

  yield {
    state: asyncGraph('Detached background jobs should choose a new context', { req: 'done', store: 'old?', timer: 'job', trace: 'new root' }),
    highlight: { compare: ['store', 'timer'], found: ['trace'], removed: ['req'] },
    explanation: 'Not all propagation is correct. A background job queued after a response may need a new trace root and sanitized tenant/auth data instead of inheriting stale request authority.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'global', label: 'global' },
        { id: 'lost', label: 'lost ctx' },
        { id: 'leak', label: 'leak ctx' },
        { id: 'auth', label: 'auth ctx' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['mixed ids', 'ALS'],
        ['blank logs', 'bind'],
        ['wrong user', 'reset'],
        ['priv bug', 'explicit'],
      ],
    ),
    highlight: { removed: ['global:symptom', 'leak:symptom'], found: ['lost:fix', 'auth:fix'] },
    explanation: 'The worst bug is not missing logs. It is context leakage, where one request observes another request context. High-authority values deserve explicit validation at boundaries.',
  };

  yield {
    state: asyncGraph('The case study is request tracing in an API server', { req: 'GET /cart', store: 'trace+tenant', db: 'SQL span', log: 'cart log', res: '200' }),
    highlight: { found: ['req', 'store', 'db', 'log', 'trace', 'res'], active: ['e-req-store', 'e-db-trace', 'e-log-trace'] },
    explanation: 'A production API stores trace id and tenant at request entry. DB calls, logs, and downstream HTTP spans read that context. Background jobs receive a new context with only the fields they are allowed to keep.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'request context') yield* requestContext();
  else if (view === 'propagation map') yield* propagationMap();
  else throw new InputError('Pick an async-context view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A JavaScript server handles many overlapping requests inside one process. A route can await a database query, schedule a timer, call a queue client, emit logs, create spans, and call library code that the route author did not write. The synchronous stack that started the request disappears between those steps, but the request is still logically the same piece of work.',
        'Deep code often needs request-local facts: trace id, request id, tenant, deadline, logger, transaction id, locale, feature flags, or cancellation state. Passing every value through every function is explicit, but it pollutes signatures that are not about observability or infrastructure. A process-wide global variable is quieter, but it is wrong as soon as two requests overlap.',
        'Async context propagation exists to attach a small store to a logical async execution and make that store available across the boundaries that belong to that execution. It gives framework and instrumentation code a way to carry request identity without confusing one request with another.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious safe approach is manual parameter passing. Every helper receives `traceId`, `logger`, `tenantId`, `deadline`, and any other request-scoped value it might need. This is easy to reason about in small programs. It becomes painful when the values are needed by logging, tracing, database, and HTTP clients several layers below the application code.',
        'The tempting shortcut is a module-level `currentRequest` variable. Request A sets it, awaits a database call, and yields. Request B starts and overwrites it. Request A resumes and writes logs under request B. The program did not use threads, but it still interleaved logical work.',
        'The wall is that the JavaScript call stack is not the same thing as a logical request. After an `await`, timer callback, event listener, stream callback, native callback, or worker boundary, the old synchronous stack is gone. The runtime needs a separate mapping from async work to the context that caused it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Context should follow causality, not wall-clock time and not a mutable global. If request A schedules a promise continuation, that continuation should see request A values even if request B ran in the middle. If a background worker starts a new job, it should receive only the context the system chose to send with that job.',
        'Node models this with async resources and APIs such as `AsyncLocalStorage`. A store is associated with an async execution chain. When the runtime creates related async work, the association can be preserved. Later, deep code can ask for the current store and receive the values for the logical operation that is running.',
        'The invariant is isolation by async lineage. Two overlapping requests may use the same functions, same database client, and same logger, but their stores should remain separate. If that invariant breaks, observability becomes misleading and authority-bearing context can become dangerous.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The request-context view shows one request entering the server, creating a store, and then moving through promise work, timer work, database calls, logs, spans, and the response. The visual point is that the store is attached to the logical path, not to a visible stack frame.',
        'The propagation-map view changes the lesson from one request to boundary types. Promise continuations, timer callbacks, queue messages, worker messages, and native callbacks do not all behave the same way. Some boundaries can inherit automatically. Some need a snapshot or bound callback. Some need explicit message fields. Some should start a fresh context.',
        'The failure-mode table is just as important as the success path. Blank logs mean context was lost. Mixed request ids mean the wrong context was restored. Stale tenant or auth data means the system carried authority past its lifecycle. The visual model treats those as different bugs because their fixes are different.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At request entry, middleware creates a store such as `{ traceId, requestId, tenantId, deadline, logger }` and runs the handler inside that store. Libraries below the handler can call a getter to read the current store. The code that reads the store does not need every route and helper to pass the values by hand.',
        'Promise continuations usually preserve context through runtime hooks. Callback-style APIs may need binding so the callback runs under the store that was current when it was registered. Timers may need the store to be captured when the timer is scheduled. Streams and event emitters need care because one emitter can deliver events for many logical operations.',
        'Queues and worker threads require a different rule. A message crossing a process or thread boundary does not magically carry process-local context. The sender must serialize selected fields, and the receiver must create a new store for the new execution. That store may continue the trace, but it should not blindly copy every request value.',
        'Snapshot-style APIs capture the current context for later use. They are useful for instrumentation wrappers and callback APIs. They can also outlive the request, so the code that creates a snapshot should know whether it is preserving observability identity, business authority, or both.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because async work still has parent-child relationships after the synchronous call stack has disappeared. A promise continuation was scheduled by some execution. A timer callback was registered by some execution. A database wrapper created a callback that will later run with a result. If the runtime records those relationships, it can restore the right store before the continuation runs.',
        'This gives observability libraries a clean integration point. A logger, tracer, database wrapper, metrics helper, or error reporter can read the current request id and trace id without changing every business function signature. The application stays readable while the infrastructure layer still gets correlation data.',
        'The correctness boundary is that the runtime can restore only the context it knows about. If a library stores a callback and calls it later outside the tracked async resource, or if work crosses a message boundary without serialized context, the propagation chain is broken. Correctness is therefore a contract between runtime, framework, libraries, and application code.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The benefit is cleaner infrastructure code. The cost is hidden input. A function that reads context may depend on request state even though its parameters do not show it. That can make tests, command-line scripts, and background jobs fail in surprising ways unless they create context deliberately.',
        'There is runtime overhead. The runtime tracks async resources and stores. Most request tracing and logging workloads tolerate that cost, but hot paths should avoid large mutable stores, repeated expensive lookups, and context values that change many times inside one request.',
        'The biggest tradeoff is authority. Trace ids and request ids are low risk. Tenant, user, role, and permission values are high risk. Missing context can produce poor logs. Leaked or stale authority can produce an isolation bug. Treat those classes of values differently.',
        'There is also a debugging tradeoff. Async context can make code look simpler while moving important state into ambient access. Teams need clear conventions: what may live in context, who may write it, whether values are immutable, and what boundaries must reset it.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Async context wins for request-scoped logging, distributed tracing, database spans, HTTP client spans, transaction correlation, deadlines, cancellation metadata, and low-authority labels that many libraries need to read.',
        'It is especially useful at framework and instrumentation boundaries. Application code can stay focused on the domain, while logging and tracing code still attaches the right request identity. A database wrapper can create a child span. A logger can include the request id. An error reporter can link a thrown error to the same trace.',
        'It also helps migrations. A team can add trace ids and structured logging across a large codebase without editing every function signature first. Manual parameters still have a place, but context gives the infrastructure layer a practical path into existing code.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when a boundary does not propagate context: custom callback APIs, native addons, worker threads, message queues, event emitters shared across requests, and detached jobs are common places to lose or mix context.',
        'It also fails when used as hidden authorization. Tenant and user identity should be checked explicitly at trust boundaries. A handler may read tenant context for logging and routing, but a database authorization decision should still be visible and testable.',
        'Long-lived work is another failure point. A retry scheduled after a response, a cache refresh, or a batch job may need to continue the trace lineage, but it should not retain the original user permissions forever. The right behavior is often a new context with selected safe fields.',
      ],
    },
    {
      heading: 'Worked case study',
      paragraphs: [
        'An API server receives `GET /cart`. Middleware creates a store with `traceId=req-42`, `tenant=acme`, `deadline=200 ms`, and a request logger. The route awaits a database query, calls a pricing service, writes logs, and creates spans. The database wrapper and logger read the current store, so every event is tied to `req-42` without passing `traceId` through every function.',
        'Inside the request, a timer records a slow-operation warning. The timer callback must run under the store captured when the timer was scheduled. If it runs with no store, the warning is useless. If it runs with another request store, the warning is actively misleading.',
        'The route also schedules a retry job after the response. That job should not inherit the whole request context. The queue message carries a new trace root or a linked parent, plus safe fields such as tenant id and job id. It does not carry user permissions from the completed request. The practical rule is to propagate context for causality, then choose carefully at lifecycle boundaries.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Keep the store small and mostly immutable. Store ids, deadlines, logger handles, and trace state. Avoid large request objects, mutable user records, database clients with transaction state unless that is the intended contract, and data that must be cleared at response end.',
        'Name the boundary rules in code. Middleware should create context. Queue publishers should serialize selected context. Queue consumers should create a new store. Background jobs should start a new trace unless there is a clear parent. Tests should include concurrent requests that interleave awaits and verify that ids do not mix.',
        'Instrument risky libraries explicitly. Custom event emitters, native addons, callback registries, workers, and queue clients should have small integration tests that prove context is preserved, reset, or intentionally dropped. Do not assume propagation across a boundary until it has been checked.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study the JavaScript event loop and promise microtask queue first. Then study Node.js `AsyncLocalStorage`, `AsyncResource`, OpenTelemetry context propagation, W3C Trace Context, W3C Baggage, distributed tracing, and cancellation with `AbortController`.',
        'The next practical exercise is to build a tiny HTTP server that logs two concurrent requests through nested promises and timers. First break it with a global variable. Then fix it with async context. Then add a queue boundary and decide which fields should cross that boundary.',
      ],
    },
  ],
};
