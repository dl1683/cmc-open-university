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
      heading: 'What it is',
      paragraphs: [
        'Trace context propagation is how distributed tracing survives process and network boundaries. A service extracts incoming context, stores it in request-local state, creates a span, and injects updated context into outbound calls.',
        'The W3C Trace Context specification defines traceparent and tracestate headers for distributed tracing: https://www.w3.org/TR/trace-context/. OpenTelemetry context propagation explains how traces, metrics, and logs can be correlated across process and network boundaries: https://opentelemetry.io/docs/concepts/context-propagation/.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'The data structure is a context object plus propagators. traceparent carries core identity: trace ID, parent span ID, and flags. tracestate carries vendor-specific trace-system metadata. Baggage carries application-defined key-value context that may be used to annotate telemetry.',
        'A propagator knows how to inject and extract that context from carriers such as HTTP headers, RPC metadata, queue message attributes, or in-process async context. If any hop drops the carrier, the trace tree splits.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A checkout request enters the gateway with no trace headers. The gateway creates traceparent, adds bounded baggage such as tenant_tier=gold, and calls orders. Orders extracts the context, creates a child span, logs tenant_tier, and injects the context into calls to inventory and payments. A queued notification message carries trace context as message metadata so the async consumer can link the work back to the original request.',
        'The edge gateway filters baggage with an allowlist and byte budget. It drops emails, user IDs, tokens, and unrecognized keys. Downstream services treat baggage as telemetry context, not as an authorization source.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Baggage is not secure authorization. It can be spoofed unless validated and should not carry secrets or large payloads. It also becomes expensive if copied into metric labels without cardinality control.',
        'Trace context is not automatic everywhere. Promise chains, thread pools, queues, and custom RPC clients all need propagation support. Async Context Propagation covers the in-process half; this page covers the cross-process carrier half.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: W3C Trace Context at https://www.w3.org/TR/trace-context/, OpenTelemetry Context Propagation at https://opentelemetry.io/docs/concepts/context-propagation/, OpenTelemetry Baggage concepts at https://opentelemetry.io/docs/concepts/signals/baggage/, and OpenTelemetry Baggage API at https://opentelemetry.io/docs/specs/otel/baggage/api/.',
        'Study next: Distributed Tracing for span trees, Async Context Propagation for in-process JavaScript context, GenAI Trace Token Cost Ledger for model/token/cache/eval context, OpenTelemetry Collector Case Study for pipeline handling, Metric Label Cardinality Control for baggage-to-metric risk, Message Queue for async carriers, and Metric Exemplars Trace Correlation for metric-to-trace jumps.',
      ],
    },
  ],
};
