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
      heading: 'What it is',
      paragraphs: [
        'Async context propagation keeps request-local data available across asynchronous JavaScript boundaries. Instead of passing traceId, tenant, deadline, or logger through every function, a runtime-managed store follows the async execution chain.',
        'The data structure is a mapping from async execution resources to context records. APIs such as Node AsyncLocalStorage expose a store that stays coherent through asynchronous operations.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At request entry, code runs a handler inside a context store. Promise continuations, timers, callbacks, and async resources preserve or restore that store. Deep library code can call getStore to read the current context.',
        'Context propagation is not the same as task scheduling or error handling. It is a carrier for values across async hops. Some boundaries need snapshot, bind, explicit message fields, or a new context root.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'An API server receives GET /cart. It creates a context with trace id, tenant id, deadline, and request logger. The route awaits a database query, emits logs, calls a payment service, and schedules a retry. All spans and logs share the request trace. The retry job receives a sanitized new context instead of inheriting user authority after the response ends.',
        'This connects The Event Loop, Promise Microtask Queue, Distributed Tracing, OpenTelemetry Collector Case Study, and UI State Machine Workflow. Async context explains how correlation data survives the event loop without becoming one global mutable variable.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not put high-authority data into implicit context and forget explicit checks. Auth, tenant, and permission context should be validated at trust boundaries. Missing context causes poor observability; leaked context can cause a security incident.',
        'Do not assume context crosses workers, message queues, or process boundaries automatically. Those edges need explicit carriers such as trace headers, message metadata, or snapshot-aware wrappers.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Node.js async context tracking and AsyncLocalStorage at https://nodejs.org/api/async_context.html, TC39 Async Context proposal at https://github.com/tc39/proposal-async-context, TC39 AsyncContext draft at https://tc39.es/proposal-async-context/, and Node AsyncResource docs in the same Node async_context reference. Study The Event Loop, JavaScript Promise Microtask Queue, Distributed Tracing, OpenTelemetry Collector Case Study, Message Queue, and AbortController Cancellation Graph next.',
      ],
    },
  ],
};
