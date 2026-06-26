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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the request-context view as a causality chain. Active nodes show the request-local store moving through promises, timers, database calls, logs, and traces.',
        'Read the propagation-map view as a boundary audit. Each row asks whether context is inherited, bound, serialized, reset, or intentionally dropped.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A JavaScript server handles many overlapping requests in one process. After an await, timer, callback, or worker message, the original synchronous call stack is gone even though the logical request continues.',
        'Deep code still needs request-local facts such as trace id, tenant id, deadline, logger, or transaction id. Async context propagation exists so infrastructure code can read those facts without passing them through every function parameter.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The safest obvious approach is manual parameter passing. Every function receives traceId, logger, tenantId, deadline, and any other request-scoped value it may need.',
        'The tempting shortcut is a module-level currentRequest variable. It looks convenient until two requests overlap and one request resumes after another has overwritten the global value.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that a logical request is not the same thing as the current stack frame. Promise continuations, timers, event emitters, callback registries, native addons, queues, and workers all introduce places where context can be lost or mixed.',
        'A missing trace id is annoying, but leaked context can be dangerous. If tenant or authorization state crosses into the wrong request, the bug becomes an isolation failure rather than a logging failure.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type:'callout', text:'Context should follow causality, not wall-clock time. If request A schedules a promise continuation, that continuation must see request A\u2019s trace ID even if request B ran between scheduling and execution.'},
        'The core insight is to attach a small store to async lineage. If request A schedules later work, that later work should run with request A values unless a boundary explicitly chooses a new context.',
        'The invariant is isolation by lineage. Two requests may use the same functions and same logger, but reads from the context store must return different values when the logical work is different.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt:'Process state transitions', caption:'Async context tracks state across process boundaries — promise continuations, timers, and worker messages each propagate context differently. Source: Wikimedia Commons, CC BY-SA 3.0'},
        'At request entry, middleware creates a store such as trace id, request id, tenant id, deadline, and logger. Code inside the request runs under that store, and libraries can ask the runtime for the current store.',
        'Promises usually propagate through runtime hooks, while callback APIs may need binding or snapshots. Queues and workers need selected fields serialized into a message, then a new store created on the receiving side.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Async work still has parent-child relationships even after the call stack disappears. A promise continuation was scheduled by some execution, and a timer callback was registered by some execution.',
        'If the runtime records those relationships, it can restore the right store before the continuation runs. Correctness fails only at boundaries the runtime or library does not track, or where the application should have reset context but did not.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Async context trades visible parameters for ambient state. The code is cleaner at logging and tracing call sites, but functions may now depend on hidden request data that tests and background jobs must create deliberately.',
        'Runtime cost grows with async resource tracking and store lookups. The bigger cost is behavioral: high-authority values such as tenant, user, role, and permission need stricter boundary rules than low-risk values such as trace id.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Async context fits request-scoped logging, distributed tracing, database spans, HTTP client spans, deadline propagation, cancellation metadata, and correlation identifiers. These values are needed across many libraries but are not the business input to most functions.',
        'It is especially useful in frameworks and instrumentation. A database wrapper can create a child span, a logger can attach a request id, and an error reporter can link a thrown error to the same trace without changing every application function.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails at boundaries that do not preserve context: custom event emitters, native addons, queue clients, worker threads, callback registries, and detached jobs. Each boundary needs an explicit rule rather than an assumption.',
        'It also fails when used as hidden authorization. Tenant and user identity should be visible at trust boundaries, because a stale or leaked context value can grant the wrong access even if logs look correlated.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An API receives GET /cart and creates a store with traceId req-42, tenant acme, deadline 200 ms, and a request logger. The route awaits a database query, calls a pricing service, writes two logs, and emits three spans, all of which read req-42 from context.',
        'A timer scheduled inside the request must keep req-42 when it logs a slow operation. A retry job scheduled after the response should not keep user permissions; it should receive a new job context with safe fields such as tenant id, job id, and a linked trace parent.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Use the Node.js AsyncLocalStorage and AsyncResource documentation, OpenTelemetry context propagation docs, W3C Trace Context, and W3C Baggage as primary sources. They define the runtime and wire contracts for carrying context.',
        'Study the JavaScript event loop, promise microtasks, worker threads, message queues, distributed tracing, and AbortController next. Then write a two-request test that interleaves awaits and proves request ids never mix.',
      ],
    },
  ],
};