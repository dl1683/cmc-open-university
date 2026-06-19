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
        "Read the animation as the execution trace for Trace Context & Baggage Propagation. How traceparent, tracestate, and baggage headers move trace identity and bounded business context through services and async hops..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A modern request rarely stays inside one process. A checkout call may pass through a gateway, an order service, a payment service, an inventory service, a queue, and a notification worker. If each process logs only its own local request id, the failure looks like disconnected noise.',
        'Trace context propagation exists so those pieces can be tied back into one causal story. The trace identity travels with the request, and each service adds its own span under the same trace instead of starting a separate universe.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The obvious approach is to generate a new request id in every service and search logs by timestamp when something breaks. That works for a single process. It falls apart when retries, queues, parallel calls, and async consumers spread one user action across many machines.',
        'The wall is causality. Time order is not enough to tell which payment call belonged to which checkout attempt, and service-local ids cannot describe parent-child relationships across network boundaries. A trace needs a portable identity and a standard way to carry it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat context as data that must cross boundaries deliberately. The trace is not stored only in the tracer, the logger, or the current stack frame. It is extracted from an inbound carrier, stored in request-local context, updated when a span is created, and injected into the next outbound carrier.',
        'The W3C shape keeps the core trace portable. traceparent carries the trace id, the parent span id, and flags. tracestate lets vendors preserve trace-system metadata. Baggage is separate: it carries small application-defined key-value pairs such as region, tenant tier, or experiment cohort.',
      ],
    },
    {
      heading: 'What the diagram emphasizes',
      paragraphs: [
        'In the header-flow view, follow the lifecycle: inbound request, extract context, create or continue a span, inject headers, then let the downstream service create a child span. The trace id should stay stable while the span id changes at each service boundary.',
        'In the baggage-guardrails view, look for the policy boundary. Baggage can enrich traces, logs, and selected metrics, but only after filtering. The edge service should drop unknown keys, secrets, personal data, and values that would explode metric cardinality.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because every service follows the same small protocol. Extract the incoming context from the carrier. Put it into the current execution context. Start a span whose parent is the extracted span. Inject the new context into outbound work.',
        'That protocol is enough to reconstruct the distributed call tree later. The trace id groups the work. Span ids describe edges. Timestamps and attributes explain where time was spent. Baggage can add business context, but the trace tree does not depend on baggage.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'HTTP uses headers. RPC systems usually use metadata. Queues use message attributes or envelope fields. In-process async hops use async context propagation rather than network headers. The carrier changes, but the job is the same: move context from the current unit of work into the next one.',
        'A broken carrier creates a broken trace. If a queue producer forgets to write trace metadata, the consumer starts a new root trace. If an HTTP client strips traceparent, the downstream service looks unrelated. If async context is lost before injection, the wrong parent can be sent.',
      ],
    },
    {
      heading: 'Baggage is not trace identity',
      paragraphs: [
        'Baggage is useful because it lets downstream telemetry know something small about the request without recomputing it everywhere. Examples include tenant_tier=enterprise, region=us-east, or experiment=checkout_v3. Those values can make traces and logs easier to filter.',
        'Baggage is dangerous when treated as trusted state. It is easy to spoof, easy to overgrow, and easy to leak. It should not carry access tokens, emails, card data, full user ids, or arbitrary payloads. It should not become an unbounded metric label source.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is plumbing. Every HTTP client, RPC client, message producer, message consumer, framework middleware, worker, and instrumentation layer must participate. One missing propagator can split a trace at the exact place where the incident is happening.',
        'There is also operational cost. Headers and metadata consume bytes. Baggage requires allowlists and limits. Trace sampling decisions need to be honored consistently. Interoperability improves when teams use standard propagators instead of custom header names.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Trace context wins when debugging latency, retries, fan-out, queue delay, partial failure, and cross-service ownership problems. It lets teams move from "the payment service was slow around 10:03" to "this checkout trace waited 820 ms on inventory, retried payment twice, and then timed out in notification enqueue."',
        'Baggage wins when a small piece of business context must be attached consistently to traces and selected logs: tenant tier, deployment ring, region, experiment cohort, or product surface. It removes repeated lookup work and keeps observability dimensions consistent.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when propagation is partial. Async workers, queues, custom clients, thread pools, native bridges, browser-to-server calls, and scheduled jobs all need explicit thought. A trace that is perfect for simple HTTP can still break at the first queue.',
        'It also fails when teams confuse correlation with trust. Trace context can show that two spans belong to the same request. It does not prove user identity, authorization, tenant membership, or billing rights.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A checkout request enters the gateway with no incoming trace headers. The gateway creates a traceparent, starts a root span, and adds only allowed baggage: tenant_tier=gold and region=us-east. It calls the order service with traceparent, tracestate, and baggage in HTTP headers.',
        'The order service extracts the context, starts a child span, logs tenant_tier, and calls inventory and payments in parallel. Inventory uses RPC metadata. Payments uses HTTP headers. Both inject the updated context before making their own downstream calls. Later, the order service publishes a notification message with trace context in message attributes, so the consumer can attach its work to the original checkout trace.',
        'During an incident, the trace shows that gold-tier checkout failures are not a frontend problem. They wait in the notification queue after payment succeeds. The baggage made the affected tier visible, but the traceparent chain made the causal path visible.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Install propagation at framework boundaries first: inbound middleware, outbound HTTP clients, RPC clients, queue producers, queue consumers, and background job wrappers. Application code should rarely hand-copy trace headers; the platform should make the common path automatic.',
        'Use a single propagator policy per service mesh or runtime stack when possible. Mixing custom headers, W3C headers, and vendor-only headers without a migration plan creates traces that work in one tool and break in another.',
        'Test propagation with a synthetic request that crosses every carrier you support. Assert that trace id stays stable, parent span relationships make sense, baggage keys are filtered, and unsafe baggage never reaches logs or metric labels. This catches broken async context and queue metadata before an outage.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: W3C Trace Context at https://www.w3.org/TR/trace-context/, OpenTelemetry Context Propagation at https://opentelemetry.io/docs/concepts/context-propagation/, OpenTelemetry Baggage concepts at https://opentelemetry.io/docs/concepts/signals/baggage/, and OpenTelemetry Baggage API at https://opentelemetry.io/docs/specs/otel/baggage/api/.',
        'Study Distributed Tracing for span trees, Async Context Propagation for in-process JavaScript context, OpenTelemetry Collector Case Study for pipeline handling, Message Queue for async carriers, Metric Label Cardinality Control for baggage-to-metric risk, and Metric Exemplars Trace Correlation for metric-to-trace jumps next.',
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
          'If your predicted final state matches the animation for trace-context-baggage-propagation-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
