// OpenTelemetry Collector case study: vendor-neutral telemetry pipelines made
// from receivers, processors, exporters, connectors, and extensions.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'opentelemetry-collector-case-study',
  title: 'OpenTelemetry Collector Case Study',
  category: 'Systems',
  summary: 'Telemetry pipelines as infrastructure: receive traces/metrics/logs, process them, batch or sample them, and export to backends.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pipeline anatomy', 'operational pressure'], defaultValue: 'pipeline anatomy' },
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

function collectorGraph(title) {
  return graphState({
    nodes: [
      { id: 'app', label: 'apps/agents', x: 0.8, y: 3.6, note: 'emit telemetry' },
      { id: 'receiver', label: 'receivers', x: 2.7, y: 3.6, note: 'OTLP, Prometheus, logs' },
      { id: 'processor', label: 'processors', x: 4.7, y: 3.6, note: 'batch, memory, attributes' },
      { id: 'connector', label: 'connectors', x: 4.7, y: 1.4, note: 'pipeline to pipeline' },
      { id: 'exporterA', label: 'exporter A', x: 7.0, y: 2.4, note: 'tracing backend' },
      { id: 'exporterB', label: 'exporter B', x: 7.0, y: 4.8, note: 'metrics/logs backend' },
      { id: 'extension', label: 'extensions', x: 9.0, y: 3.6, note: 'health, auth, zpages' },
    ],
    edges: [
      { id: 'e-app-receiver', from: 'app', to: 'receiver', weight: 'ingest' },
      { id: 'e-receiver-processor', from: 'receiver', to: 'processor', weight: 'pipeline' },
      { id: 'e-processor-a', from: 'processor', to: 'exporterA', weight: 'export' },
      { id: 'e-processor-b', from: 'processor', to: 'exporterB', weight: 'fan-out' },
      { id: 'e-processor-connector', from: 'processor', to: 'connector', weight: 'derive signal' },
      { id: 'e-connector-processor', from: 'connector', to: 'processor', weight: 'feed pipeline' },
      { id: 'e-extension-processor', from: 'extension', to: 'processor', weight: 'support' },
    ],
  }, { title });
}

function* pipelineAnatomy() {
  yield {
    state: collectorGraph('Collector pipelines receive, process, and export telemetry'),
    highlight: { active: ['app', 'receiver', 'processor', 'exporterA', 'exporterB'], found: ['e-app-receiver', 'e-receiver-processor'] },
    explanation: 'The Collector is a programmable telemetry middle layer. Applications emit signals; receivers ingest them; processors modify or batch them; exporters send them to one or more backends.',
  };

  yield {
    state: labelMatrix(
      'Component classes',
      [
        { id: 'receiver', label: 'receiver' },
        { id: 'processor', label: 'processor' },
        { id: 'exporter', label: 'exporter' },
        { id: 'connector', label: 'connector' },
        { id: 'extension', label: 'extension' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'example', label: 'example' },
      ],
      [
        ['gets telemetry in', 'OTLP, Prometheus, filelog'],
        ['changes telemetry', 'batch, memory limiter, attributes'],
        ['sends telemetry out', 'OTLP, Jaeger, debug'],
        ['links pipelines', 'traces to metrics'],
        ['supports collector', 'health, auth, zpages'],
      ],
    ),
    highlight: { active: ['receiver:job', 'processor:job', 'exporter:job'], compare: ['extension:job'] },
    explanation: 'Collector configuration separates data-path components from support extensions. A component does nothing until the service pipelines enable it.',
    invariant: 'Receivers, processors, and exporters define the telemetry data path.',
  };

  yield {
    state: labelMatrix(
      'Three signal pipelines',
      [
        { id: 'traces', label: 'traces' },
        { id: 'metrics', label: 'metrics' },
        { id: 'logs', label: 'logs' },
        { id: 'profiles', label: 'profiles' },
      ],
      [
        { id: 'receiver', label: 'receiver' },
        { id: 'processor', label: 'processor' },
        { id: 'exporter', label: 'exporter' },
      ],
      [
        ['OTLP', 'tail sampling + batch', 'trace backend'],
        ['Prometheus scrape', 'memory limiter + relabel', 'metrics store'],
        ['filelog', 'attributes + batch', 'log backend'],
        ['emerging', 'profile pipeline', 'profile backend'],
      ],
    ),
    highlight: { found: ['traces:processor', 'metrics:processor', 'logs:processor'], active: ['traces:exporter'] },
    explanation: 'A Collector process can run separate pipelines for each signal type. That lets teams route traces, metrics, and logs differently while sharing one deployment model.',
  };

  yield {
    state: collectorGraph('Fan-out makes backend migration less invasive'),
    highlight: { active: ['processor', 'exporterA', 'exporterB', 'e-processor-a', 'e-processor-b'], found: ['receiver'] },
    explanation: 'The Collector can export the same telemetry to multiple destinations. This is useful during backend migrations, audits, or split retention policies, but it also doubles outbound cost if abused.',
  };
}

function* operationalPressure() {
  yield {
    state: labelMatrix(
      'Hot-path pressure points',
      [
        { id: 'burst', label: 'traffic burst' },
        { id: 'cardinality', label: 'cardinality spike' },
        { id: 'backend', label: 'backend outage' },
        { id: 'tenant', label: 'tenant isolation' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'response', label: 'collector response' },
      ],
      [
        ['queue growth', 'batch and memory limiter'],
        ['cost explosion', 'attribute filtering'],
        ['export retries pile up', 'bounded queues and drop policy'],
        ['noisy neighbor', 'separate pipelines or collectors'],
      ],
    ),
    highlight: { active: ['burst:response', 'backend:response'], compare: ['cardinality:symptom'] },
    explanation: 'Telemetry is production traffic. A Collector needs backpressure, memory limits, batching, and failure policy or it can become the outage amplifier.',
  };

  yield {
    state: collectorGraph('Processors are where reliability policy enters'),
    highlight: { active: ['processor', 'extension', 'e-extension-processor'], found: ['receiver', 'exporterA'] },
    explanation: 'Memory limiters, batching, attribute filtering, redaction, sampling, and routing are not cosmetics. They decide whether observability remains affordable and stable under stress.',
  };

  yield {
    state: labelMatrix(
      'Deployment shapes',
      [
        { id: 'agent', label: 'agent' },
        { id: 'gateway', label: 'gateway' },
        { id: 'sidecar', label: 'sidecar' },
        { id: 'hybrid', label: 'hybrid' },
      ],
      [
        { id: 'where', label: 'where it runs' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['per node', 'local collection, many instances'],
        ['central service', 'policy control, bottleneck risk'],
        ['per workload', 'isolation, operational overhead'],
        ['agent plus gateway', 'common at scale'],
      ],
    ),
    highlight: { found: ['agent:where', 'gateway:where', 'hybrid:tradeoff'], compare: ['sidecar:tradeoff'] },
    explanation: 'Collector topology is an architecture decision. Agents collect near workloads; gateways centralize policy. Large systems often use both.',
  };

  yield {
    state: labelMatrix(
      'What to audit before trusting it',
      [
        { id: 'loss', label: 'loss policy' },
        { id: 'pii', label: 'PII redaction' },
        { id: 'cost', label: 'cost controls' },
        { id: 'health', label: 'collector health' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure', label: 'failure if ignored' },
      ],
      [
        ['when do we drop?', 'silent telemetry gaps'],
        ['where is data scrubbed?', 'privacy incident'],
        ['who caps cardinality?', 'runaway bill'],
        ['who watches the watcher?', 'blind outage'],
      ],
    ),
    highlight: { active: ['loss:question', 'health:question'], found: ['pii:failure', 'cost:failure'] },
    explanation: 'The Collector is observability infrastructure, so it needs its own SLOs, dashboards, audit trails, and failure-mode design.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pipeline anatomy') yield* pipelineAnatomy();
  else if (view === 'operational pressure') yield* operationalPressure();
  else throw new InputError('Pick an OpenTelemetry Collector view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'The OpenTelemetry Collector is a vendor-neutral telemetry pipeline. It receives traces, metrics, logs, and related signals from applications or agents, processes them, and exports them to observability backends. It removes the need to run one custom agent per vendor and gives teams one place to apply batching, sampling, redaction, routing, and export policy.',
        'The official Collector page describes it as a vendor-agnostic implementation for receiving, processing, and exporting telemetry data: https://opentelemetry.io/docs/collector/. The architecture page states that data receiving, processing, and exporting are done using configurable pipelines: https://opentelemetry.io/docs/collector/architecture/.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Collector configuration is organized around receivers, processors, exporters, connectors, and extensions. Receivers ingest data, processors transform or manage it, exporters send it out, connectors link pipelines, and extensions provide support features such as health checks or auth. The configuration docs define these pipeline component classes and note that components must be enabled under the service pipelines section: https://opentelemetry.io/docs/collector/configuration/.',
        'A typical deployment might receive traces over OTLP, run memory limiter, tail sampling, and batch processors, then export to one tracing backend and one long-retention store. Metrics might arrive from Prometheus scraping and go to a different backend. Logs might enter through filelog receivers and receive redaction before export. The key idea is that telemetry is a dataflow system, not just a library import.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The Collector sits on a hot path during incidents, so it must be engineered like production infrastructure. Bursts can fill queues. High-cardinality labels can explode storage cost. Backend outages can create retry storms. Redaction mistakes can leak sensitive data. A memory limiter or batch processor is not a nice-to-have; it is part of the reliability boundary.',
        'Deployment topology matters. Agents near workloads reduce local collection friction. Gateways centralize policy and vendor fan-out. Sidecars isolate tenants but add operational overhead. Hybrid topologies are common: local agents collect and normalize, then gateways enforce sampling, redaction, routing, and backend export policy.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The Collector is used for vendor migration, multi-backend export, centralized telemetry policy, Kubernetes observability, multi-tenant platform telemetry, tail sampling, PII redaction, and cost control. It connects directly to Distributed Tracing, AIOps Incident Response, Tail Latency & p99 Thinking, and Feature Flag Control Planes because release and incident systems need clean telemetry to know what changed and what broke.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat the Collector as a lossless pipe unless you have designed it that way. Queues have limits, processors can drop, exporters can fail, and sampling may remove data you later wish you had. Do not fan out every signal to every backend by default; observability cost can become its own incident. Finally, do not forget to observe the Collector itself. The system that watches everything else still needs health, metrics, logs, and alerts.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Official sources: OpenTelemetry Collector overview at https://opentelemetry.io/docs/collector/, architecture at https://opentelemetry.io/docs/collector/architecture/, configuration at https://opentelemetry.io/docs/collector/configuration/, and sensitive-data handling at https://opentelemetry.io/docs/security/handling-sensitive-data/. Study Distributed Tracing, Trace Context & Baggage Propagation, GenAI Trace Token Cost Ledger, OpenTelemetry Tail Sampling Policy, Metric Exemplars Trace Correlation, Async Context Propagation, SLO Error Budget Burn Rate Alert, Log Template Drain Parser, Metric Label Cardinality Control, eBPF Ring Buffer Telemetry Case Study, PII Redaction Token Span Pipeline, AIOps Incident Response, Tail Latency & p99 Thinking, Backpressure & Flow Control, Circuit Breakers & Deadlines, and Feature Flag Control Plane next.',
      ],
    },
  ],
};
