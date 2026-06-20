// Trace context and baggage propagation: extract and inject cross-process
// headers so traces, logs, and metrics share causal request context.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'trace-context-baggage-propagation-case-study',
  title: 'Trace Context & Baggage Propagation',
  category: 'Systems',
  summary: 'How traceparent, tracestate, and baggage headers move trace identity and bounded business context through services and async hops.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['header flow', 'baggage guardrails'], defaultValue: 'header flow' },
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

function contextGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 4.8, note: notes.client ?? 'request' },
      { id: 'edge', label: 'edge', x: 2.2, y: 4.8, note: notes.edge ?? 'extract' },
      { id: 'ctx', label: 'ctx', x: 3.8, y: 6.2, note: notes.ctx ?? 'trace id' },
      { id: 'bag', label: 'bag', x: 3.8, y: 3.2, note: notes.bag ?? 'tenant' },
      { id: 'svc', label: 'svc', x: 5.5, y: 4.8, note: notes.svc ?? 'span' },
      { id: 'inject', label: 'inject', x: 7.1, y: 4.8, note: notes.inject ?? 'headers' },
      { id: 'down', label: 'down', x: 8.7, y: 4.8, note: notes.down ?? 'child' },
    ],
    edges: [
      { id: 'e-client-edge', from: 'client', to: 'edge', weight: '' },
      { id: 'e-edge-ctx', from: 'edge', to: 'ctx', weight: '' },
      { id: 'e-edge-bag', from: 'edge', to: 'bag', weight: '' },
      { id: 'e-ctx-svc', from: 'ctx', to: 'svc', weight: '' },
      { id: 'e-bag-svc', from: 'bag', to: 'svc', weight: '' },
      { id: 'e-svc-inject', from: 'svc', to: 'inject', weight: '' },
      { id: 'e-inject-down', from: 'inject', to: 'down', weight: '' },
    ],
  }, { title });
}

function* headerFlow() {
  yield {
    state: contextGraph('A request arrives with or without trace context'),
    highlight: { active: ['client', 'edge', 'e-client-edge'], compare: ['ctx'] },
    explanation: 'A gateway either receives W3C Trace Context headers from an upstream caller or creates a new trace. The context becomes request-local state for the current process.',
    invariant: 'Propagation is extract, store in context, create span, inject on outbound work.',
  };

  yield {
    state: contextGraph('traceparent carries the core trace identity', { ctx: 'traceparent', svc: 'root span' }),
    highlight: { active: ['edge', 'ctx', 'svc', 'e-edge-ctx', 'e-ctx-svc'], found: ['client'] },
    explanation: 'traceparent contains the version, trace ID, parent span ID, and trace flags. It is the vendor-neutral header that lets spans from different services become one trace tree.',
  };

  yield {
    state: contextGraph('tracestate carries vendor-specific routing metadata', { ctx: 'tracestate', svc: 'vendor data', inject: 'forward' }),
    highlight: { active: ['ctx', 'svc', 'inject', 'e-ctx-svc', 'e-svc-inject'], compare: ['bag'] },
    explanation: 'tracestate is for vendor or platform-specific trace-system data. Services should preserve and update it according to the specification rather than inventing incompatible trace headers.',
  };

  yield {
    state: contextGraph('A downstream call receives injected context headers', { inject: 'trace hdrs', down: 'child span' }),
    highlight: { active: ['svc', 'inject', 'down', 'e-svc-inject', 'e-inject-down'], found: ['ctx'] },
    explanation: 'Before an HTTP, queue, or RPC call leaves the process, a propagator injects the current context into the outbound carrier. The next service extracts it and creates a child span.',
  };

  yield {
    state: labelMatrix(
      'Propagation carriers',
      [
        { id: 'http', label: 'HTTP' },
        { id: 'queue', label: 'queue' },
        { id: 'rpc', label: 'RPC' },
        { id: 'async', label: 'async hop' },
      ],
      [
        { id: 'carrier', label: 'carrier' },
        { id: 'bug', label: 'bug' },
      ],
      [
        ['headers', 'drop hdr'],
        ['metadata', 'new trace'],
        ['metadata', 'bad map'],
        ['context', 'lost ctx'],
      ],
    ),
    highlight: { found: ['http:carrier', 'queue:carrier', 'async:carrier'], removed: ['async:bug'] },
    explanation: 'The complete case is one checkout request crossing HTTP, message queues, and promises. Each hop needs the right carrier and async context support or the trace breaks into fragments.',
  };
}

function* baggageGuardrails() {
  yield {
    state: contextGraph('Baggage carries bounded business context', { bag: 'tenant=pro', svc: 'annotate', inject: 'baggage' }),
    highlight: { active: ['bag', 'svc', 'inject', 'e-bag-svc', 'e-svc-inject'], compare: ['ctx'] },
    explanation: 'Baggage is separate from trace identity. It carries application-defined key-value pairs that downstream services can use to annotate telemetry or make cross-cutting decisions.',
    invariant: 'Baggage is propagated data. Treat it as untrusted input and keep it small.',
  };

  yield {
    state: labelMatrix(
      'Good baggage',
      [
        { id: 'tenant', label: 'tenant tier' },
        { id: 'region', label: 'region' },
        { id: 'flag', label: 'flag cohort' },
        { id: 'user', label: 'user id' },
      ],
      [
        { id: 'ok', label: 'ok?' },
        { id: 'why', label: 'why' },
      ],
      [
        ['maybe', 'bounded'],
        ['yes', 'small'],
        ['maybe', 'controlled'],
        ['usually no', 'PII/card'],
      ],
    ),
    highlight: { found: ['region:ok', 'flag:why'], compare: ['tenant:ok'], removed: ['user:ok'] },
    explanation: 'Good baggage has low cardinality, limited size, and clear purpose. User IDs, emails, tokens, and large payloads are usually bad baggage.',
  };

  yield {
    state: contextGraph('Baggage can link traces, metrics, and logs', { bag: 'tier=gold', svc: 'log+metric', down: 'same tier' }),
    highlight: { active: ['bag', 'svc', 'down', 'e-bag-svc', 'e-inject-down'], found: ['ctx'] },
    explanation: 'When a bounded tenant tier or cohort is in baggage, services can attach that context consistently to spans, selected metrics, and logs without rebuilding it at every hop.',
  };

  yield {
    state: labelMatrix(
      'Guardrails',
      [
        { id: 'size', label: 'size' },
        { id: 'allow', label: 'allowlist' },
        { id: 'trust', label: 'trust' },
        { id: 'card', label: 'cardinality' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['cap bytes', 'header bloat'],
        ['known keys', 'leak data'],
        ['validate', 'spoof tier'],
        ['bounded', 'metric bomb'],
      ],
    ),
    highlight: { active: ['size:rule', 'allow:rule', 'trust:rule'], removed: ['card:failure'] },
    explanation: 'Because baggage travels on outbound requests, it must have byte limits, key allowlists, validation, and rules for whether it may become metric labels.',
  };

  yield {
    state: contextGraph('The runbook drops or redacts unsafe baggage at the edge', { edge: 'filter', bag: 'allowlist', svc: 'safe ctx', inject: 'small' }),
    highlight: { found: ['edge', 'bag', 'svc', 'inject'], active: ['e-edge-bag', 'e-bag-svc', 'e-svc-inject'] },
    explanation: 'The production pattern is edge normalization: accept incoming context, validate trusted fields, remove unsafe baggage, and inject only bounded context downstream.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'header flow') yield* headerFlow();
  else if (view === 'baggage guardrails') yield* baggageGuardrails();
  else throw new InputError('Pick a trace-context view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The header-flow view traces a request from client to downstream service. Active nodes show the current propagation step. Found nodes mark headers that are now committed to the outbound carrier. Compare nodes highlight where a second header type (tracestate, baggage) runs alongside the primary one.',
        'The baggage-guardrails view shifts focus to what travels inside baggage and what must be stopped at the edge. Found cells mark safe choices. Removed cells mark values that would cause production failures if propagated.',
        'At each frame, ask: what context crossed a boundary, what carrier moved it, and what breaks if this step is skipped.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A single user action in a modern system can cross ten or more processes. A checkout touches a gateway, order service, payment provider, inventory, fraud scorer, notification worker, and analytics pipeline. Each process produces logs, metrics, and errors.',
        'Without shared identity, those signals are noise. An error in the notification worker looks unrelated to the checkout that caused it. A latency spike in inventory cannot be connected to the payment retry that preceded it. The signals exist, but the causal thread is missing.',
        {
          type: 'note',
          text: 'The problem is not logging. Every service already logs. The problem is that each service logs into its own universe. Trace context propagation gives those universes a shared coordinate system.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is a service-local request ID. Each process generates a UUID when it receives a request, logs it with every line, and returns it in error responses. Engineers grep for the ID when debugging.',
        'This works inside one process. It even works across two processes if the caller logs the downstream request ID alongside its own. Teams do this for years and it feels adequate.',
        {
          type: 'diagram',
          label: 'Service-local IDs break at fan-out',
          text: 'gateway (id: g-001)\n  |-> order-svc (id: o-042)\n  |     |-> payment (id: p-117)   -- which g-001 caused this?\n  |     |-> inventory (id: i-203) -- which o-042 caused this?\n  |     |-> queue.publish(msg)    -- no id at all\n  |           |-> notifier (id: n-009) -- orphan\n  |\n  (grep for "g-001" finds 1 of 5 services)',
        },
        'The approach works until fan-out, retries, or async hops appear. When the order service calls payment and inventory in parallel, and both fail, there is no way to tell from timestamps alone which payment call belonged to which order attempt. When a queue sits between producer and consumer, the consumer has no request ID at all unless someone explicitly put one in the message.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Service-local IDs cannot express parent-child relationships across network boundaries. Time ordering is ambiguous under concurrency: two payment calls at 10:03:22.004 and 10:03:22.007 could belong to the same checkout or to two different ones. Retries make it worse -- the same logical operation produces multiple request IDs that look unrelated.',
        'The wall is that causality is not a property of individual processes. It is a property of the request path. To reconstruct causality, the identity must travel with the request and survive every boundary: HTTP calls, RPC calls, message queues, thread pool handoffs, and promise chains.',
        {
          type: 'quote',
          text: 'End-to-end tracing infrastructure had to be pervasive and always-on because the problem requires tracing every request in production, not just a sample of interesting ones post-hoc.',
          attribution: 'Sigelman et al., "Dapper, a Large-Scale Distributed Systems Tracing Infrastructure" (Google, 2010)',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Context is data that must cross boundaries deliberately, not state that lives inside any single component. The trace identity is not owned by the tracer, the logger, or the HTTP framework. It is extracted from an inbound carrier, stored in request-local context, updated when a new span starts, and injected into the next outbound carrier.',
        'W3C Trace Context standardizes this into two headers. traceparent carries the version, trace ID, parent span ID, and trace flags. tracestate carries vendor-specific metadata that must be forwarded even by services that do not understand it.',
        {
          type: 'code',
          language: 'http',
          text: 'traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01\n             ^^                                  ^^                ^^              ^^\n           version            trace-id (16 bytes)    parent-id (8 bytes)    flags (sampled)\n\ntracestate: congo=t61rcWkgMzE,rojo=00f067aa0ba902b7\n            ^^^^^ vendor-specific entries, preserved across services\n\nbaggage: tenant_tier=gold,region=us-east-1\n         ^^^^ application-defined key-value pairs, separate from trace identity',
        },
        'Baggage is a third, separate header. It carries small application-defined key-value pairs -- tenant tier, region, experiment cohort -- that downstream services can attach to their own telemetry without recomputing the values.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Every service follows four steps in sequence: extract, store, create, inject.',
        {
          type: 'table',
          headers: ['Step', 'What happens', 'Carrier'],
          rows: [
            ['Extract', 'Read traceparent, tracestate, and baggage from the inbound carrier', 'HTTP headers, gRPC metadata, message attributes'],
            ['Store', 'Place the parsed context into the current execution context (request-scoped storage)', 'Thread-local, AsyncLocalStorage, Go context.Context'],
            ['Create', 'Start a new span with the extracted span as parent; generate a new span ID', 'Tracer SDK'],
            ['Inject', 'Write the updated traceparent (new span ID as parent) plus tracestate and baggage into the outbound carrier', 'HTTP client interceptor, gRPC interceptor, queue producer'],
          ],
        },
        'The trace ID stays stable across every hop. The span ID changes at every service boundary. This is what makes the trace a tree: same root identity, different edge identities.',
        'Each carrier type has its own mechanics. HTTP uses headers. gRPC uses metadata key-value pairs. Kafka uses record headers. SQS uses message attributes. In-process async hops in Node.js use AsyncLocalStorage; in Go, context.Context; in Java, ThreadLocal with careful executor wrapping.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Node.js: OpenTelemetry auto-instrumentation handles HTTP propagation.\n// Manual propagation for a queue producer:\nconst { context, propagation } = require("@opentelemetry/api");\n\nfunction publishMessage(queue, payload) {\n  const carrier = {};  // empty object to receive headers\n  propagation.inject(context.active(), carrier);\n  // carrier now has { traceparent: "00-...", tracestate: "...", baggage: "..." }\n  queue.send({\n    body: payload,\n    attributes: carrier,  // trace context travels with the message\n  });\n}',
        },
        'A broken carrier creates a broken trace. If a queue producer omits trace metadata, the consumer starts a new root trace and the two halves look unrelated. If an HTTP client library strips unknown headers, traceparent vanishes. If async context is lost across a thread pool boundary, the injected parent ID points to the wrong span.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The protocol is correct because it preserves two invariants across every boundary.',
        {
          type: 'bullets',
          items: [
            'Trace identity invariant: the trace ID is immutable once created. Every span in the trace shares the same 16-byte trace ID, so grouping by trace ID reconstructs the full request.',
            'Parent-child invariant: each new span records the span ID of its immediate parent. Because span IDs are unique and the parent link is set at creation time, the span collection forms a tree (or forest, if propagation breaks).',
          ],
        },
        'These two invariants are sufficient to reconstruct the distributed call tree after the fact. Timestamps on span start and end events explain where time was spent. Attributes explain what happened. But the tree structure comes entirely from trace ID grouping and parent ID edges.',
        'Baggage correctness is weaker by design. Baggage is advisory, not structural. A service can drop baggage, modify it, or add keys. The trace tree does not depend on baggage being present or accurate. This separation is deliberate: trace identity is infrastructure-grade; baggage is application-grade.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is coverage, not performance. traceparent is 55 bytes. tracestate is typically under 256 bytes. Baggage adds a few hundred bytes at most. The per-request overhead of propagation is negligible compared to the network call itself.',
        'The real cost is plumbing. Every outbound call path must participate: HTTP clients, RPC clients, message producers, message consumers, background job schedulers, cron wrappers, and browser fetch calls. One missing propagator splits the trace at exactly the boundary where the next incident will occur.',
        {
          type: 'table',
          headers: ['Cost dimension', 'Magnitude', 'What it means'],
          rows: [
            ['Header bytes', '~55-500 bytes/request', 'Negligible vs. payload; can matter on high-fan-out internal RPCs'],
            ['Instrumentation effort', 'Every client and server boundary', 'The long tail of queue producers, cron jobs, and thread pools is where traces break'],
            ['Baggage governance', 'Allowlists, byte caps, cardinality limits', 'Without limits, baggage becomes a vector for header bloat and metric explosions'],
            ['Sampling consistency', 'Must honor trace-level sampling decisions', 'If service A samples and service B does not, the trace has holes'],
            ['Migration cost', 'Transitioning from vendor headers to W3C', 'Running dual propagators during migration doubles header overhead temporarily'],
          ],
        },
      ],
    },
    {
      heading: 'Baggage: power and danger',
      paragraphs: [
        'Baggage solves a specific problem: when downstream services need a small piece of business context to annotate their telemetry, and recomputing that context at every hop is wasteful or impossible.',
        'A payment service cannot look up the tenant tier of the original request without calling back to the gateway or a shared database. If tenant_tier=gold is in baggage, the payment service can tag its spans and metrics with that value immediately.',
        {
          type: 'table',
          headers: ['Baggage key', 'Cardinality', 'Safe as metric label?', 'Risk'],
          rows: [
            ['tenant_tier (free/pro/enterprise)', '3', 'Yes', 'Low -- bounded enum'],
            ['region (us-east-1, eu-west-1, ...)', '~20', 'Yes', 'Low -- bounded by infrastructure'],
            ['experiment_cohort (control, variant_a)', '~5', 'Carefully', 'Medium -- grows with active experiments'],
            ['user_id', 'Millions', 'Never', 'High -- explodes metric cardinality, potential PII'],
            ['session_token', '1 per session', 'Never', 'Critical -- credential in plaintext across all downstream services'],
          ],
        },
        {
          type: 'note',
          text: 'Baggage travels on every outbound request to every downstream service. A value placed in baggage at the edge reaches the deepest leaf of the call tree. Treat it as broadcast to every service in the mesh, because that is what it is.',
        },
        'The production pattern is edge normalization. The edge gateway accepts incoming context, validates baggage against an allowlist of known keys, drops unknown or oversized values, and injects only safe baggage downstream. Interior services should not add arbitrary baggage without coordination.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Latency debugging: a trace shows that a checkout waited 820 ms on inventory, retried payment twice, and timed out in notification enqueue. Without the trace, each service reports "I was fine" and the incident has no owner.',
            'Cross-service ownership: the trace tree makes it visible that the root cause is in service X, even though the user-facing error appeared in service Y. Ownership follows the span, not the symptom.',
            'Tenant-aware SLOs: baggage with tenant_tier lets teams compute p99 latency per tier without enrichment joins. Gold-tier degradation is visible in real time.',
            'Experiment attribution: baggage with experiment_cohort=variant_a lets analytics pipelines attribute backend behavior to frontend experiments without log correlation.',
            'Queue delay measurement: trace context on queue messages makes the gap between enqueue and dequeue a measurable span, not a gap between disconnected traces.',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Propagation is all-or-nothing per boundary. A trace that is perfect for synchronous HTTP calls still breaks at the first boundary that does not propagate.',
        {
          type: 'table',
          headers: ['Boundary', 'Common failure', 'Consequence'],
          rows: [
            ['Message queue', 'Producer does not write trace headers to message attributes', 'Consumer starts a new root trace; queue delay becomes invisible'],
            ['Thread pool / executor', 'Context is not captured when task is submitted', 'Child spans parent to the wrong span or to no span'],
            ['Browser-to-server', 'CORS blocks traceparent header', 'Frontend and backend traces are disconnected'],
            ['Cron / scheduled job', 'No inbound request to extract from', 'Job runs as an orphan trace with no link to the schedule trigger'],
            ['Native bridge (JNI, FFI)', 'Context does not cross language runtime boundary', 'Native code produces spans in a separate trace'],
            ['Third-party API call', 'External service ignores or strips traceparent', 'The outbound call has context; the response trace is lost'],
          ],
        },
        'Trace context also fails as a trust mechanism. traceparent proves correlation -- these spans belong to the same request. It does not prove authorization, identity, or tenant membership. A malicious client can forge a traceparent to inject spans into another tenant\'s trace. Do not use trace context for access control.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A checkout request enters the API gateway with no trace headers.',
        {
          type: 'code',
          language: 'text',
          text: '1. Gateway: no traceparent found\n   -> creates traceparent: 00-abc123...-span01-01\n   -> creates baggage: tenant_tier=gold, region=us-east-1\n   -> starts root span "gateway.checkout"\n\n2. Gateway -> Order Service (HTTP)\n   -> injects traceparent: 00-abc123...-span01-01\n   -> injects baggage: tenant_tier=gold, region=us-east-1\n\n3. Order Service: extracts traceparent, starts child span "order.process"\n   -> span parent = span01\n   -> new span id = span02\n   -> reads baggage, tags span with tenant_tier=gold\n   -> calls Inventory (gRPC) and Payment (HTTP) in parallel\n\n4a. Inventory (gRPC): extracts from metadata\n    -> child span "inventory.reserve", parent = span02, id = span03\n\n4b. Payment (HTTP): extracts from headers\n    -> child span "payment.charge", parent = span02, id = span04\n    -> first attempt fails, retries\n    -> child span "payment.charge.retry", parent = span02, id = span05\n\n5. Order Service -> Notification Queue (Kafka)\n   -> injects traceparent into record headers: 00-abc123...-span02-01\n   -> injects baggage into record headers\n\n6. Notification Worker: extracts from Kafka record headers\n   -> child span "notify.send", parent = span02, id = span06\n   -> 3.2s queue delay is now a measurable gap in the trace',
        },
        'During an incident, an engineer queries traces where tenant_tier=gold AND total_duration > 5s. The trace reveals the checkout succeeded at the payment layer but the user saw a timeout because the notification worker was backlogged. The baggage made the tier filterable; the traceparent chain made the causal path from gateway to notification worker reconstructable.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Install propagation at framework boundaries first: inbound middleware, outbound HTTP client interceptors, gRPC interceptors, queue producers, queue consumers, and background job wrappers. Application code should never hand-copy trace headers.',
            'Use a single propagator format per service mesh. Mixing W3C traceparent, B3 (Zipkin), and Jaeger headers without a migration plan creates traces that work in one tool and break in another.',
            'Enforce baggage governance at the edge: allowlist known keys, set a total byte cap (the W3C Baggage spec recommends 8,192 bytes maximum), and never promote unbounded baggage values to metric labels.',
            'Test propagation with a synthetic request that crosses every carrier type. Assert that the trace ID is stable end-to-end, parent-child relationships are correct, and unsafe baggage does not appear in downstream logs or metric dimensions.',
            'Handle async context explicitly. In Node.js, use AsyncLocalStorage. In Java, wrap executors. In Go, pass context.Context. A trace that works for synchronous HTTP and breaks on the first goroutine or promise is not tested.',
          ],
        },
        {
          type: 'code',
          language: 'yaml',
          text: '# OpenTelemetry Collector pipeline config: receive, process, export\nreceivers:\n  otlp:\n    protocols:\n      grpc:\n        endpoint: 0.0.0.0:4317\nprocessors:\n  batch:\n    timeout: 5s\n  attributes:\n    actions:\n      - key: tenant_tier      # promote baggage to span attribute\n        from_context: baggage\n        action: upsert\nexporters:\n  otlp:\n    endpoint: tracing-backend:4317\nservice:\n  pipelines:\n    traces:\n      receivers: [otlp]\n      processors: [batch, attributes]\n      exporters: [otlp]',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'W3C Trace Context specification (https://www.w3.org/TR/trace-context/) -- the normative definition of traceparent and tracestate header formats, mutation rules, and interoperability requirements.',
            'W3C Baggage specification (https://www.w3.org/TR/baggage/) -- defines the baggage header format, size limits, and propagation semantics.',
            'OpenTelemetry Context Propagation (https://opentelemetry.io/docs/concepts/context-propagation/) -- how the OpenTelemetry SDK implements extract, inject, and context storage across languages.',
            'Sigelman et al., "Dapper, a Large-Scale Distributed Systems Tracing Infrastructure" (Google, 2010) -- the paper that established production-grade distributed tracing and influenced every subsequent tracing system.',
            'OpenTelemetry Baggage API (https://opentelemetry.io/docs/specs/otel/baggage/api/) -- the programmatic interface for reading and writing baggage entries.',
          ],
        },
        {
          type: 'note',
          text: 'The W3C specs define wire format and propagation rules. OpenTelemetry defines the SDK contract for extract/inject. Dapper defines why the whole system exists. Read them in that order.',
        },
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Distributed Tracing', 'Understand span trees and trace assembly before studying how context moves between services'],
            ['Prerequisite', 'Message Queue', 'Queues are the boundary where most trace propagation breaks; understand the carrier semantics'],
            ['Extension', 'Async Context Propagation', 'In-process context (AsyncLocalStorage, Go context) is the carrier for non-network boundaries'],
            ['Extension', 'Metric Label Cardinality Control', 'Baggage-to-metric promotion without cardinality control causes metric explosions'],
            ['Case study', 'OpenTelemetry Collector Case Study', 'How the collector pipeline processes, batches, and exports the spans that propagation creates'],
            ['Case study', 'Metric Exemplars Trace Correlation', 'How to jump from a metric anomaly to the trace that caused it, using the trace ID that propagation preserved'],
          ],
        },
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'State the two invariants that make trace reconstruction possible in one sentence each.',
            'A queue producer writes the message body but forgets to inject trace headers. Describe the exact downstream consequence.',
            'Explain why baggage with key user_id is dangerous even though it is useful for debugging.',
            'A service receives a traceparent header. What new value does it generate, and what value does it preserve unchanged?',
            'Transfer the extract-store-create-inject pattern to a different domain: how would you propagate a request budget (remaining quota) across service boundaries?',
          ],
        },
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Trace a single request through the header-flow animation. Before each frame, predict which node becomes active and what the injected traceparent will look like (which field changes, which stays the same). Then switch to the baggage-guardrails view and predict which baggage keys survive edge filtering.',
        'If your predictions match the animation for both views, move to the Distributed Tracing topic to study how the collected spans are assembled into a trace tree.',
      ],
    },
  ],
};
