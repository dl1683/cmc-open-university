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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation treats the OpenTelemetry Collector as a typed dataflow graph. Receivers bring telemetry into the process. Processors change, limit, enrich, sample, batch, redact, or route it. Exporters send it to backends.',
        'Active nodes show the pipeline stage currently handling data. Found nodes show telemetry that survives policy and reaches an exporter. Removed nodes show data dropped by limits, sampling, filtering, or redaction. Compare nodes show fan-out or routing decisions.',
        'The safe inference rule is that a component does nothing until it is wired into a service pipeline. Defining a receiver or processor is inventory. The pipeline order is the actual behavior.',
        {type:'callout', text:'The Collector is a policy graph on the telemetry path, so reliability, cost, privacy, and routing decisions belong in processors and topology.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Modern systems emit traces, metrics, logs, profiles, events, runtime stats, host stats, Kubernetes metadata, and vendor-specific attributes. That data must cross process, network, compliance, and cost boundaries before it helps an engineer during an incident.',
        'The OpenTelemetry Collector exists as a vendor-neutral process that receives observability signals, applies policy, and exports them to one or more destinations. Application libraries create telemetry, but the Collector is where platform teams can operate the telemetry path.',
        'The reason is not convenience alone. Without a shared layer, every service must know backend addresses, retry behavior, redaction rules, sampling policy, label normalization, and migration plans. Infrastructure policy leaks into application code.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is direct export. Each service links an SDK, points it at tracing, metrics, and logging backends, and sends data immediately. That works for a demo because the path is short.',
        'Direct export fails when the backend changes, when privacy rules change, or when a retry storm competes with user traffic. A vendor migration becomes a code rollout across every application. A label rename can split dashboards while teams upgrade at different speeds.',
        'A second obvious approach is to install a Collector and treat it as a transparent pipe. That also fails because the Collector has queues, memory limits, processor order, retries, exporter timeouts, and drop behavior. It is a production dataflow system, not magic plumbing.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is backpressure and policy ownership. Telemetry volume rises during incidents, exactly when backends may be slow and engineers need the data most. If the Collector buffers without limits, it can exhaust memory. If it drops without visibility, observability disappears quietly.',
        'Privacy creates another wall. Sensitive attributes should be removed before they reach long-term storage, not after dashboards discover them. Redaction order matters because fan-out can copy raw data to multiple destinations.',
        'Cost is the third wall. A high-cardinality metric label or full trace fan-out can multiply backend ingest. The Collector cannot make telemetry free, but it gives one place to enforce the cost policy.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Model observability as signal-specific pipelines. A traces pipeline can receive OTLP spans, run memory limiting, redact attributes, tail sample, batch, and export to a trace backend. A metrics pipeline can scrape Prometheus, normalize labels, batch, and export elsewhere.',
        'Processors are policy points. The memory limiter protects the process. The batch processor reduces export overhead. Attribute processors rename, insert, hash, or delete fields. Sampling processors choose what survives. Routing processors send tenants, services, or regions to different exporters.',
        'The topology is part of the design. Agents near workloads collect local signals. Gateways centralize authentication, routing, redaction, and backend export. Many production deployments use both because local collection and central policy solve different problems.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Applications, agents, and scrapers send data to receivers such as OTLP, Prometheus, file log, host metrics, or Kubernetes receivers. The Collector decodes those inputs into OpenTelemetry data structures for traces, metrics, logs, or profiles.',
        'Processors then run in the order listed in the pipeline. A common order is memory limiter first, then resource or attribute normalization, filtering or sampling, batching, and finally export. Order matters because redaction after export is too late and batching before sampling can waste memory.',
        'Exporters handle outbound delivery to OTLP endpoints, Prometheus remote write, debug output, vendor backends, or storage systems. Connectors can turn one signal into another, such as producing span metrics from traces. Extensions support the process itself with health checks, auth, profiling, and diagnostics.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because emitters are decoupled from backends. Services can emit standard telemetry while platform teams change exporters, redaction rules, retry settings, routing, and sampling without editing every service.',
        'It also works because policy sees structured data. A processor can inspect resource attributes, span attributes, metric labels, log bodies, and signal type. That is the right level for decisions about high-cardinality labels, user identifiers, tenant routing, and trace retention.',
        'The correctness condition is pipeline intent. If every signal enters the intended receiver, passes through required processors in the intended order, and reaches only allowed exporters, then telemetry policy is enforced in one auditable path.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The Collector adds a process to operate. It consumes CPU, memory, network, and human attention. A gateway can become a bottleneck. Agents can multiply configuration drift across thousands of nodes.',
        'Each processor changes behavior. Batching saves outbound overhead but adds delay. Tail sampling keeps better traces but buffers spans in memory. Redaction protects data but can remove fields needed during incidents. Fan-out helps migrations but multiplies egress and ingest.',
        'A concrete cost rule is useful. If 200 services emit 500 spans per second each at 1 KB per span, the pipeline sees about 100 MB per second before sampling or batching. Keeping 10 percent after policy still leaves about 10 MB per second of trace data to export.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Kubernetes observability is a common use. Node-level Collectors gather kubelet metrics, host metrics, container logs, and OTLP signals, then add namespace, pod, container, service, and cluster metadata.',
        'Backend independence is another use. A company can fan out traces to old and new vendors during migration, compare results, then remove the old exporter. The same pattern supports regulated teams that need separate retention or regional routing.',
        'The Collector also supports control-plane enforcement. Platform teams can drop forbidden labels, hash user identifiers, route high-value services to longer retention, and expose self-metrics about refused data, queue length, send failures, and dropped spans.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the Collector is not observed as a production service. If queues fill, exporters fail, or memory limits drop data, dashboards may look quiet while the system is burning. The telemetry path needs its own alerts.',
        'It fails when governance is vague. High-cardinality labels can still destroy metrics. Sensitive fields can still leak through missed attributes or log bodies. Sampling can still remove rare traces if policies are wrong.',
        'It fails when one shared gateway becomes a single noisy-neighbor point. A burst from one tenant can consume memory and export capacity for everyone unless routing, quotas, or isolation are designed into the topology.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A cluster runs 120 services. Each emits 100 spans per second during normal traffic, with an average span size of 900 bytes. Raw trace volume is 120 times 100 times 900 bytes, about 10.8 MB per second before protocol overhead.',
        'The platform deploys node agents for local collection and a gateway tier for policy. The gateway keeps all error traces, all traces over 800 ms, all canary traffic, and a 2 percent baseline. Normal retention is 14 percent of traces, so export volume falls from 10.8 MB per second to about 1.5 MB per second.',
        'During a backend outage, exporter queue length rises and send failures increase. The memory limiter starts dropping low-value baseline traces first because sampling already happened before batching. Error traces still export when the backend recovers, and the Collector self-metrics show exactly when pressure began.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the OpenTelemetry Collector documentation, Collector architecture docs, component configuration docs, and collector-contrib processor READMEs. Use them for component roles, pipeline wiring, and processor-specific limits.',
        'Study OpenTelemetry Semantic Convention Schema for field meaning, Tail Sampling Policy for value-based trace retention, Metric Label Cardinality Control for metrics cost, Backpressure and Flow Control for queue pressure, and PII Redaction Token Span Pipeline for privacy policy.',
      ],
    },
  ],
};
