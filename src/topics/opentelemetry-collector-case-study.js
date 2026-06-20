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
      heading: 'Why the Collector exists',
      paragraphs: [
        'Modern systems do not emit one clean stream of diagnostic data. They emit traces, metrics, logs, profiles, events, runtime stats, host stats, Kubernetes metadata, and vendor-specific fields from many languages and frameworks. That data has to cross process boundaries, network boundaries, compliance boundaries, and cost boundaries before it becomes useful in a dashboard or incident review. Without a shared layer, every service has to know where telemetry goes, which fields are allowed, how to retry, which attributes must be renamed, and which data should be sampled.',
        'The OpenTelemetry Collector exists because telemetry became infrastructure. It is a vendor-neutral process that receives observability signals, applies policy, and exports them to one or more backends. The goal is not only convenience. The goal is to move operational decisions out of application business logic and into a pipeline that platform teams can configure, deploy, audit, and monitor. Instrumentation libraries still create spans and measurements, but the Collector becomes the place where production traffic policy is enforced.',
        {type:'callout', text:'The Collector is a policy graph on the telemetry path, so reliability, cost, privacy, and routing decisions belong in processors and topology.'},
      ],
    },
    {
      heading: 'The naive approach and the wall',
      paragraphs: [
        'The naive approach is direct export. Each service links an SDK or agent, points it at a tracing backend, a metrics backend, and a log backend, and ships everything immediately. That works for a demo because the path is short and ownership is obvious. It fails at scale because every application now carries infrastructure configuration. A backend migration becomes a code rollout. A privacy rule becomes a library upgrade. A retry storm becomes hundreds of application processes competing with user traffic. Even simple label changes can split dashboards when teams upgrade at different times.',
        'A second naive approach is to install a Collector and treat it as a transparent pipe. That also fails. A Collector has queues, memory limits, processors, retries, export timeouts, and drop behavior. It can shed data. It can amplify an outage by buffering too much. It can leak sensitive attributes if redaction happens too late. It can double spend by fanning out every span to every destination. The Collector is not magic plumbing; it is a dataflow system on the production path.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to model observability as a typed pipeline. Receivers bring telemetry into the process. Processors change, limit, enrich, sample, batch, redact, or route it. Exporters send it out. Connectors take output from one pipeline and feed another pipeline, such as turning traces into metrics. Extensions support the Collector process itself with health endpoints, authentication, profiling, debug pages, or other service features. The names are simple, but they force a useful separation between data path, control policy, and operational support.',
        'The most important configuration detail is that a component does nothing until it is wired into a service pipeline. Defining an OTLP receiver, a batch processor, and an exporter is only inventory. The pipeline says that traces enter through this receiver, pass through these processors in this order, and leave through these exporters. That makes the Collector a directed graph with signal-specific paths. Traces, metrics, logs, and profiles can share deployment machinery while still using different processors and destinations.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'A typical deployment starts with applications or node agents emitting OTLP, Prometheus scrape data, file logs, host metrics, or Kubernetes metadata. Receivers decode those inputs into OpenTelemetry data structures. Processors then apply policy. A memory limiter can stop the process from exhausting memory. A batch processor can reduce export overhead. Attribute processors can rename, insert, hash, or delete fields. Sampling processors can reduce trace volume. Routing processors can send different tenants or signals to different exporters.',
        'Exporters handle the outbound side: OTLP, Prometheus remote write, debug output, vendor backends, object storage pipelines, or other systems. Connectors are the special bridge when one pipeline produces data for another pipeline, as with span metrics or service graph generation. Extensions are deliberately separate because a health check endpoint or auth provider supports the process rather than transforming spans. In production, Collectors are usually deployed as node agents, central gateways, sidecars, or a hybrid of agents plus gateways.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The pipeline-anatomy visual is proving that the Collector is a graph, not a single queue. The app node is not connected directly to a backend. It sends telemetry to receivers, and the pipeline decides what happens next. The processor node sits in the middle because reliability and governance live there. The two exporters show fan-out: the same signal can be copied to multiple destinations during a migration, an audit, or a split-retention strategy. The connector node shows that one signal can derive another, which is why pipeline boundaries matter.',
        'The operational-pressure visual is proving that telemetry has backpressure problems just like ordinary application traffic. A burst creates queue growth. A backend outage creates retry pressure. A cardinality spike creates cost and memory pressure. A noisy tenant can consume shared capacity. The right lesson is not that every problem has one Collector setting. The lesson is that Collector topology and processor order are reliability design choices. If those choices are absent, the default behavior becomes the incident policy.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because it decouples emitters from backends. Application code can emit standard telemetry while the platform changes exporters, batches, redaction rules, retry policy, or routing without editing every service. That is especially valuable during vendor migrations. A team can fan out traces to the old and new backend for a limited period, compare behavior, then remove the old exporter. The same pattern helps with compliance reviews, regional routing, and gradual adoption of new signal types.',
        'It also works because policy is placed close to the shape of the data. A processor can see resource attributes, span attributes, metric labels, log bodies, and signal type. That is a better location for decisions such as dropping high-cardinality labels, redacting user identifiers, or sampling only successful low-value traces. The Collector does not make those choices automatically, but it gives teams one operational surface where the choices can be reviewed and tested.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The Collector adds another process to operate. It consumes CPU, memory, network, disk buffers if enabled, and human attention. A gateway can become a bottleneck. Agents can multiply configuration drift across thousands of nodes. Sidecars improve isolation but increase deployment count and resource overhead. A hybrid model is common because it matches the shape of the problem: local agents collect near workloads, then gateways centralize policy, authentication, and backend export.',
        'Every processor has a cost. Batching saves outbound overhead but adds delay. Tail sampling can improve trace quality but needs memory because it must observe a trace before deciding. Redaction protects data but can remove fields engineers need during incidents. Fan-out improves migration safety but multiplies egress and backend ingest. The Collector lets teams choose these tradeoffs explicitly; it does not remove the tradeoffs.',
      ],
    },
    {
      heading: 'Real production uses',
      paragraphs: [
        'A common use is Kubernetes observability. Node-level Collectors gather kubelet metrics, container logs, host metrics, and OTLP signals from workloads. They add resource metadata such as namespace, pod, container, service name, and cluster. A gateway layer then normalizes attributes, drops forbidden fields, batches output, and exports to tracing, metrics, and logging systems. This gives application teams one instrumentation path while platform teams keep control of cost and compliance.',
        'Another use is backend independence. A company may start with one observability vendor, add a cheaper long-term metrics store, and keep a second trace backend for a regulated team. The Collector can route signals by service, environment, region, or tenant. It can also generate derived metrics from traces, send debug output during rollout, or isolate a new pipeline before it handles all traffic. These are infrastructure workflows, not application features.',
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        'The largest failure mode is losing observability during the incident that needs it. If exporter retries fill queues and the memory limiter starts dropping data, dashboards may look quiet while the system is failing. If the Collector itself has no health checks, dropped-span metrics, queue-length metrics, and alerts, nobody knows whether the telemetry path is trustworthy. The Collector must be observed as a production service, including its own CPU, memory, refused data, send failures, and processor decisions.',
        'The second failure mode is vague governance. High-cardinality labels can still break metric backends. PII can still leak if redaction rules miss a field. Sampling can still remove the one trace that explains a rare failure. A single shared gateway can still create a noisy-neighbor problem. The Collector cannot fix bad semantic conventions, missing trace context, or unbounded logging by itself. It is the enforcement point, not a substitute for instrumentation design.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study the OpenTelemetry Collector documentation, the Collector architecture guide, and the Collector configuration model. Then connect this topic to OpenTelemetry Semantic Convention Schema Case Study, Trace Context and Baggage Propagation, OpenTelemetry Tail Sampling Policy, Metric Label Cardinality Control, Metric Exemplars Trace Correlation, Log Template Drain Parser, PII Redaction Token Span Pipeline, Backpressure and Flow Control, Circuit Breakers and Deadlines, Tail Latency and p99 Thinking, and SLO Error Budget Burn Rate Alert. The Collector is easiest to understand once you can see both sides: the telemetry schema that gives fields meaning and the reliability machinery that keeps the pipeline alive.',
      ],
    },
  ],
};
