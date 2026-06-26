// Distributed tracing: one user clicks "buy", six services fire, and the
// page takes 120ms. WHICH service ate the time? Follow one trace ID through
// the whole tree of calls and watch the culprit light up.

import { callTreeState, InputError } from '../core/state.js';

export const topic = {
  id: 'distributed-tracing',
  title: 'Distributed Tracing',
  category: 'Systems',
  summary: 'One trace ID, one tree of spans across six services — and the slow hop has nowhere to hide.',
  controls: [
    { id: 'view', label: 'Follow', type: 'select', options: ['one checkout request'], defaultValue: 'one checkout request' },
  ],
  run,
};

export function* run(input) {
  if (String(input.view) !== 'one checkout request') throw new InputError('Pick the walkthrough.');

  const serviceCount = 6;
  const traceId = 'abc123';
  const frames = new Map();
  const open = (id, parentId, name) => frames.set(id, { id, parentId, name, args: '…', status: 'active', result: null });
  const wait = (id) => { frames.get(id).status = 'waiting'; };
  const close = (id, ms) => {
    const f = frames.get(id);
    f.status = 'returned';
    f.args = `${ms}ms`;
    f.result = `${ms}ms`;
  };
  const snapshot = () => callTreeState([...frames.values()]);

  yield {
    state: callTreeState([]),
    highlight: {},
    explanation: `A user reports: "checkout is slow." ${serviceCount} microservices touch every checkout, each with its OWN logs on its OWN machines — ${serviceCount} islands of evidence with no shared story. Distributed tracing stitches them: the gateway mints one TRACE ID, every service passes it along in a request header (the W3C traceparent), and each unit of work records a SPAN. The spans assemble into a tree. Watch one request build it.`,
  };

  open('g', null, 'gateway');
  yield {
    state: snapshot(),
    highlight: { active: ['g'] },
    explanation: `POST /checkout hits the gateway — span opens, trace ID ${traceId} is born. Everything that happens downstream across ${serviceCount} services on any machine will carry this ID.`,
  };

  wait('g');
  open('a', 'g', 'auth');
  yield {
    state: snapshot(),
    highlight: { active: ['a'] },
    explanation: `The gateway calls auth to validate the session token. A child span opens under the gateway — parentId is how the tree structure survives being scattered across ${serviceCount} machines.`,
  };

  const authMs = 15;
  close('a', authMs);
  open('o', 'g', 'orders');
  yield {
    state: snapshot(),
    highlight: { returning: ['a'], active: ['o'] },
    explanation: `Auth returns in ${authMs}ms — its span closes and ships off to the tracing backend. The gateway proceeds to the orders service, which owns the checkout logic and fans out further.`,
  };

  wait('o');
  const inventoryMs = 20;
  open('i', 'o', 'inventory');
  close('i', inventoryMs);
  open('p', 'o', 'payments');
  yield {
    state: snapshot(),
    highlight: { returning: ['i'], active: ['p'] },
    explanation: `Orders checks inventory (${inventoryMs}ms, fine) and then calls payments. So far every hop looks innocent — which is exactly why per-service dashboards never caught this: each service IS fast, except…`,
  };

  wait('p');
  open('f', 'p', 'fraud-check');
  yield {
    state: snapshot(),
    highlight: { active: ['f'] },
    explanation: `…payments quietly calls a fraud-check service that nobody remembered was in the path. Its span opens — and stays open. The tree across ${frames.size} spans doesn\'t lie: everything else is done; this one box is still burning.`,
  };

  const fraudMs = 55;
  const paymentsMs = 70;
  const ordersMs = 95;
  const notifyMs = 2;
  const totalMs = 120;
  close('f', fraudMs);
  close('p', paymentsMs);
  close('o', ordersMs);
  open('n', 'g', 'notify');
  close('n', notifyMs);
  close('g', totalMs);
  const fraudPct = Math.round((fraudMs / totalMs) * 100);
  yield {
    state: snapshot(),
    highlight: { returning: ['g'] },
    explanation: `The request completes: fraud-check ${fraudMs}ms, payments ${paymentsMs}ms total, orders ${ordersMs}ms, gateway ${totalMs}ms (notify fires an event onto a Message Queue in ${notifyMs}ms and doesn\'t wait — async work drops off the critical path). Every span carries trace ID ${traceId}, so the backend reassembles this exact tree from ${serviceCount} services.`,
    invariant: `A span\'s duration includes all of its children — the ${frames.size}-span tree IS the timing breakdown.`,
  };

  const criticalPath = ['g', 'o', 'p', 'f'];
  yield {
    state: snapshot(),
    highlight: { found: criticalPath },
    explanation: `The verdict, readable at a glance: the CRITICAL PATH is ${criticalPath.length} spans deep (gateway, orders, payments, fraud-check), and fraud-check alone is ${fraudMs} of the ${totalMs}ms — ${fraudPct}% of the user\'s wait, hiding two layers deep where no single service\'s logs would ever show it. The tree turns "checkout is slow" into "fraud-check needs a cache."`,
  };

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `In production: OpenTelemetry is the instrumentation standard; Jaeger and Zipkin the open-source backends; Datadog and Honeycomb the hosted ones. Tracing every request would drown you — so systems SAMPLE. Traces complete the observability trio: METRICS say something is slow, LOGS say what one service saw, TRACES across ${serviceCount} services say where the ${totalMs}ms went.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation builds one checkout trace across six microservices. Each node is a span: a timed unit of work inside one service. Active spans are currently executing. Waiting spans are blocked on a child call. Returned spans have closed and recorded their duration.',
        {type: "callout", text: "Distributed tracing turns one request into a timed call tree, so latency attribution follows parent-child evidence instead of service-by-service guessing."},
        'Watch the tree grow left to right as the gateway fans out to auth, orders, inventory, payments, and fraud-check. When a span closes, its duration becomes fixed evidence. The found highlight at the end marks the critical path: the chain of spans that determined the user\'s total wait.',
        'Toggle nothing here — the animation walks one specific checkout request so you can follow every hop and see exactly where 120ms went.',
        {type: 'image', src: './assets/gifs/distributed-tracing.gif', alt: 'Animated walkthrough of the distributed tracing visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A user clicks "buy" and the page takes 120ms. Six microservices touched that request: gateway, auth, orders, inventory, payments, and a fraud-check service buried inside payments. Each service logs to its own machine. Auth sees 15ms. Inventory sees 20ms. Payments sees 70ms. Every service looks fine in isolation, but the checkout is slow.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Microservices-based_architecture.png/800px-Microservices-based_architecture.png`, alt: `Microservices architecture diagram with independent services connected through requests`, caption: `A microservice graph explains why one user action can scatter evidence across many processes before tracing joins it back together. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Microservices-based_architecture.png.`},
        'The problem is that no single service owns the full picture. The slow hop hides two layers deep, inside a dependency nobody remembered was on the path. Distributed tracing exists to reconstruct the exact call tree from scattered evidence so latency has a precise address, not a vague neighborhood.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first move is to check each service\'s logs and dashboards. Auth took 15ms, inventory took 20ms, payments took 70ms. You compare numbers, guess which one looks worst, and investigate there. For a system with two or three services, this works well enough.',
        'A slightly better version is centralized logging: ship all logs to one search cluster, filter by request timestamp, and correlate events manually. This works until request volume makes manual correlation impossible or until the slow service is not the one you suspected.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Per-service inspection fails when latency comes from nested calls. Payments took 70ms total, but 55ms of that was fraud-check. Without parent-child relationships, you cannot tell whether payments was slow because of its own code or because it was waiting on a child. You also cannot tell which calls were serial and which overlapped.',
        'Centralized logging hits a different wall: logs record events, not structure. You can see that fraud-check started and finished, but you cannot see that it was called by payments, which was called by orders, which was called by gateway. The causal chain is missing. Without it, you are left guessing which service caused the total latency instead of reading it from a tree.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The insight is context propagation. The gateway mints a trace ID and passes it downstream in an HTTP header (the W3C traceparent standard). Every service that receives the header creates a span: a record with the trace ID, a unique span ID, the parent span ID, a start time, and an end time. Because every span carries its parent\'s ID, independently emitted records from six different machines can be reassembled into one tree after the fact.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg`, alt: `Directed graph with parent-child arrows between nodes`, caption: `A trace is a directed parent-child graph with timestamps, span IDs, and process boundaries attached. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.`},
        'Timing alone is a stopwatch. Parentage turns many stopwatches into a dependency tree. The tree separates self time (work a service did itself) from child time (time spent waiting on downstream calls), parallel work from serial work, and synchronous calls from fire-and-forget async handoffs.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When POST /checkout hits the gateway, a trace ID is generated and stored in the request context. The gateway opens a root span and passes the trace ID and its own span ID to the auth service via a request header. Auth creates a child span whose parentId points to the gateway span. Auth finishes in 15ms, closes its span, and ships it to a tracing backend (Jaeger, Zipkin, Datadog, or similar).',
        'The gateway then calls orders, which opens its own child span. Orders calls inventory (20ms) and then payments. Payments calls fraud-check, which opens a span two levels below the gateway. Fraud-check takes 55ms. When it returns, payments closes at 70ms, orders at 95ms. The gateway fires a notify event onto a message queue (2ms, async, off the critical path) and closes at 120ms.',
        'The tracing backend collects all six spans from six machines, groups them by trace ID, and sorts them by parentId into a tree. The result is a single view showing the exact call path, the duration of every hop, and which spans were serial versus parallel. A span\'s duration always includes its children, so the tree itself is the timing breakdown.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Spans can arrive at the backend out of order from different machines, different networks, different time zones. The tree still assembles correctly because each span carries three identifiers: trace ID (which request), span ID (which unit of work), and parent span ID (who called me). Those three fields are sufficient to rebuild the full tree after all work has finished.',
        'Latency attribution is correct because span intervals nest in time. A child span\'s duration is a subset of its parent\'s duration. Two sibling spans that overlap in time represent parallel work and should not be summed as if they were serial. The tree structure prevents that arithmetic mistake, which is the most common error in per-service latency debugging.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Instrumenting services requires a client library (OpenTelemetry is the standard) and a backend to collect and store spans. A single span is small: six integers (trace ID, span ID, parent ID, start time, end time, status) and a service name string. The per-request overhead is negligible.',
        'The real cost is volume. At 10,000 requests per second with an average of 6 spans per trace, the backend ingests 60,000 spans per second. Tracing every request is too expensive for most systems. Production deployments sample: keep 100% of slow traces (anything over a threshold like 1 second) and 100% of error traces, then sample 1-5% of normal traffic. Head-based sampling decides at the gateway but cannot know yet if the request will be slow. Tail-based sampling buffers spans and decides after the trace completes, which is more accurate but requires more backend capacity.',
        'Storage, high-cardinality span attributes, privacy review of request payloads, and operational dependency on the collector pipeline are the ongoing costs. The tradeoff is straightforward: sampling reduces cost but means some interesting traces are lost.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Latency debugging is the primary use. "Checkout got slower last week — which service changed?" The trace tree answers in seconds by showing which span grew. Capacity planning follows: if fraud-check is 45% of the critical path, optimizing inventory (which is only 17%) saves nothing. The tree directs engineering effort to the hop that matters.',
        'Dependency discovery is the third use. A new engineer asks "what does the orders service call?" A trace shows every downstream call, in order, with latency for each. No architecture diagram needed — the trace is the live architecture. Fourth: SLA enforcement. If a service promises a 50ms response but consistently takes 100ms when called by a specific upstream caller, tracing identifies the pattern across thousands of requests.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Tracing tells you where latency lives, not why. It shows that fraud-check took 55ms, but whether the cause is a slow database query, a cold cache, or a CPU-bound model evaluation requires profilers, logs, and investigation. Traces locate; they do not diagnose.',
        'Broken propagation is the most common failure. If one service in the chain does not forward the traceparent header, the trace splits into disconnected fragments. The tree becomes a forest. This happens silently — you only notice when you search for a trace and find half of it missing.',
        'Over-sampling drowns the backend. If you keep every span for every request, the tracing system becomes a bottleneck itself. Confusing traces with metrics is another trap: metrics (response time percentiles) drive alerts; traces explain what the alert means. They are complementary, not interchangeable.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A checkout trace completes in 120ms across 6 services. The gateway opens, calls auth (15ms), then calls orders. Orders calls inventory (20ms), then calls payments. Payments calls fraud-check (55ms). Payments closes at 70ms (55ms waiting on fraud-check plus 15ms of its own work). Orders closes at 95ms. Gateway fires notify (2ms async) and closes at 120ms.',
        'The critical path is gateway -> orders -> payments -> fraud-check, four spans deep. Fraud-check alone accounts for 55 of 120ms, or 46% of the user\'s wait. Auth (15ms) and inventory (20ms) are on the path but small. Notify is off the critical path entirely because it is async.',
        'The actionable conclusion: fraud-check needs a cache, a faster model, or an async redesign. Optimizing auth (already 15ms) or inventory (already 20ms) would save at most 35ms even if reduced to zero, while caching fraud-check results could save up to 55ms per request.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'OpenTelemetry\'s traces documentation defines spans, context propagation, and the collector architecture: https://opentelemetry.io/docs/concepts/signals/traces/. The W3C Trace Context specification standardizes traceparent and tracestate headers for cross-vendor propagation: https://www.w3.org/TR/trace-context/. Jaeger\'s architecture page covers the production deployment: collectors, query services, storage backends, and sampling strategies: https://www.jaegertracing.io/docs/1.76/architecture/.',
        'Prerequisites: Recursion (the call tree is the same shape as a recursive call stack, but scattered across machines). Extensions: Trace Context & Baggage Propagation (how headers survive proxies and queues), OpenTelemetry Tail Sampling Policy (keeping slow traces without keeping everything), Async Context Propagation (how trace IDs survive promises and callbacks inside one service). Related systems: Message Queues (async fire-and-forget that drops work off the critical path), Load Balancer (how systems distribute work across backends), Saga Pattern (compensation and rollback across traced service chains).',
      ],
    },
  ],
};
