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
    { heading: 'How to read the animation', paragraphs: [
      'Read the graph as a request crossing process boundaries. Active nodes show the hop being handled now, found nodes show context preserved, compare nodes show related metadata, and removed cells show unsafe baggage.',
      'A trace is one request across services, and a span is one timed operation inside it. If the trace ID is unchanged and the parent span ID points to the caller, the downstream span can be attached to the same causal tree.',
      {type:'callout', text:'Trace propagation works only when context is treated as boundary-crossing data with explicit extraction, storage, update, and injection at every hop.'},
    ]},
    { heading: 'Why this exists', paragraphs: ['A checkout can pass through a gateway, order service, payment service, inventory service, queue, and notification worker. Without shared context, each service logs a local event and the causal request path disappears.']},
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is a local request ID. Each service creates a UUID and logs it, which works inside one process but breaks at fan-out, retries, queues, and async handoffs.']},
    { heading: 'The wall', paragraphs: ['A local ID cannot express parent-child relationships across boundaries. The missing invariant is carried identity: every receiver must extract the caller context before creating its own child work.']},
    { heading: 'The core insight', paragraphs: ['Trace context is boundary-crossing data, not hidden process state. A service extracts inbound headers, stores context, starts a child span, and injects updated headers into outbound carriers.']},
    { heading: 'How it works', paragraphs: ['The trace ID stays stable for the whole request while span IDs change at each operation. HTTP uses headers, gRPC uses metadata, queues use message attributes, and in-process async work uses runtime context storage.']},
    { heading: 'Why it works', paragraphs: ['Two invariants reconstruct the trace. Every span keeps the same trace ID, and each child records the parent span ID that caused it. Baggage is advisory context and is not part of this proof.']},
    { heading: 'Cost and complexity', paragraphs: ['The byte cost is small: traceparent is about 55 bytes and bounded baggage may add 50 to 300 bytes. The real cost is coverage; one missing propagator splits the trace where an incident may occur.']},
    { heading: 'Real-world uses', paragraphs: ['Distributed tracing uses propagation to explain latency and ownership. Baggage can make tenant tier, region, or cohort visible in telemetry when those values are bounded and safe to broadcast.']},
    { heading: 'Where it fails', paragraphs: ['Propagation fails at unsupported carriers such as a queue producer that omits headers. It also fails as a trust mechanism because clients can forge traceparent and baggage.']},
    { heading: 'Worked example', paragraphs: ['A checkout enters the gateway with no headers, so the gateway creates trace abc123 and span s1. Order extracts s1 and starts s2, inventory starts s3 for 180 ms, payment starts s4, fails after 900 ms, retries as s5 for 1,100 ms, and the notification worker starts s6 after a 3,200 ms queue wait.']},
    { heading: 'Sources and study next', paragraphs: ['Read the W3C Trace Context specification, W3C Baggage specification, and OpenTelemetry context propagation documentation. Study Distributed Tracing, Message Queue, Async Context Propagation, Metric Label Cardinality Control, and OpenTelemetry Collector next.']},
  ],
};