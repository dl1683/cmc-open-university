// OpenTelemetry tail sampling: buffer spans by trace ID until enough of the
// trace is visible, then keep slow, error, or policy-matching traces whole.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'opentelemetry-tail-sampling-policy-case-study',
  title: 'OpenTelemetry Tail Sampling Policy',
  category: 'Systems',
  summary: 'How tail sampling buffers spans by trace ID, waits for a decision window, applies policies, and keeps whole traces instead of random fragments.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['decision buffer', 'policy mix'], defaultValue: 'decision buffer' },
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

function sampleGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'spans', label: 'spans', x: 0.8, y: 4.8, note: notes.spans ?? 'stream' },
      { id: 'buffer', label: 'buffer', x: 2.7, y: 4.8, note: notes.buffer ?? 'by trace' },
      { id: 'timer', label: 'timer', x: 4.5, y: 6.2, note: notes.timer ?? 'wait' },
      { id: 'policy', label: 'policy', x: 4.5, y: 3.2, note: notes.policy ?? 'rules' },
      { id: 'keep', label: 'keep', x: 6.4, y: 6.2, note: notes.keep ?? 'export' },
      { id: 'drop', label: 'drop', x: 6.4, y: 3.2, note: notes.drop ?? 'discard' },
      { id: 'backend', label: 'backend', x: 8.3, y: 6.2, note: notes.backend ?? 'trace db' },
      { id: 'mem', label: 'mem', x: 8.3, y: 3.2, note: notes.mem ?? 'limit' },
    ],
    edges: [
      { id: 'e-spans-buffer', from: 'spans', to: 'buffer', weight: '' },
      { id: 'e-buffer-timer', from: 'buffer', to: 'timer', weight: '' },
      { id: 'e-buffer-policy', from: 'buffer', to: 'policy', weight: '' },
      { id: 'e-policy-keep', from: 'policy', to: 'keep', weight: '' },
      { id: 'e-policy-drop', from: 'policy', to: 'drop', weight: '' },
      { id: 'e-keep-backend', from: 'keep', to: 'backend', weight: '' },
      { id: 'e-buffer-mem', from: 'buffer', to: 'mem', weight: '' },
    ],
  }, { title });
}

function memoryPlot() {
  return plotState({
    axes: { x: { label: 'decision wait', min: 0, max: 30 }, y: { label: 'trace memory', min: 0, max: 100 } },
    series: [
      { id: 'mem', label: 'memory', points: [{ x: 2, y: 12 }, { x: 5, y: 24 }, { x: 10, y: 46 }, { x: 20, y: 76 }, { x: 30, y: 96 }] },
      { id: 'value', label: 'context', points: [{ x: 2, y: 30 }, { x: 5, y: 54 }, { x: 10, y: 78 }, { x: 20, y: 88 }, { x: 30, y: 90 }] },
    ],
    markers: [
      { id: 'short', x: 2, y: 12, label: 'too soon' },
      { id: 'sweet', x: 10, y: 78, label: 'enough' },
    ],
  }, { title: 'Decision wait trades memory for better decisions' });
}

function* decisionBuffer() {
  yield {
    state: sampleGraph('Spans arrive before the complete trace is known'),
    highlight: { active: ['spans', 'buffer', 'e-spans-buffer'], compare: ['policy'] },
    explanation: 'Head sampling decides at the beginning. Tail sampling waits because the useful facts, such as final status, total latency, and downstream services, may appear near the end of the trace.',
    invariant: 'Tail sampling keeps or drops whole traces, not isolated spans.',
  };

  yield {
    state: sampleGraph('The collector groups spans by trace ID', { buffer: 'trace map', mem: 'num traces' }),
    highlight: { active: ['spans', 'buffer', 'mem', 'e-spans-buffer', 'e-buffer-mem'], found: ['timer'] },
    explanation: 'The processor keeps an in-memory map keyed by trace ID. Each incoming span is appended to its trace record until the decision window closes or memory pressure forces policy.',
  };

  yield {
    state: sampleGraph('decision_wait gives late spans time to arrive', { timer: '10s', policy: 'not yet', mem: 'bounded' }),
    highlight: { active: ['buffer', 'timer', 'mem', 'e-buffer-timer', 'e-buffer-mem'], compare: ['policy'] },
    explanation: 'A short wait makes decisions with incomplete traces. A long wait improves policy accuracy but increases memory. The collector needs explicit num_traces and memory-limiter sizing.',
  };

  yield {
    state: sampleGraph('Policies decide once the trace has enough evidence', { policy: 'error/slow', keep: 'whole', drop: 'normal' }),
    highlight: { active: ['policy', 'keep', 'drop', 'e-policy-keep', 'e-policy-drop'], found: ['buffer'] },
    explanation: 'Policies can keep error traces, slow traces, specific services, high-value tenants, or a probabilistic sample of normal traffic. The selected traces are exported whole.',
  };

  yield {
    state: memoryPlot(),
    highlight: { active: ['sweet'], found: ['value'], compare: ['mem', 'short'] },
    explanation: 'The complete case study is a checkout service: keep every error and p99 trace, sample ordinary fast traces, and size the buffer so the decision window sees enough spans without exhausting collector memory.',
  };
}

function* policyMix() {
  yield {
    state: labelMatrix(
      'Policy types',
      [
        { id: 'status', label: 'status' },
        { id: 'latency', label: 'latency' },
        { id: 'attr', label: 'attr' },
        { id: 'prob', label: 'prob' },
      ],
      [
        { id: 'keeps', label: 'keeps' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['errors', 'late span'],
        ['slow', 'wait too low'],
        ['tenant/svc', 'card rules'],
        ['baseline', 'random gaps'],
      ],
    ),
    highlight: { found: ['status:keeps', 'latency:keeps', 'prob:keeps'], compare: ['latency:risk'] },
    explanation: 'Tail sampling is strongest when policies reflect debugging value: errors, slow traces, important routes, canary traffic, and a small unbiased baseline.',
    invariant: 'A policy mix should preserve rare important traces and enough normal traces for comparison.',
  };

  yield {
    state: sampleGraph('Slow traces can be missed if the decision window is too short', { timer: 'too short', policy: 'not slow yet', drop: 'bad drop' }),
    highlight: { active: ['timer', 'policy', 'drop', 'e-buffer-timer', 'e-policy-drop'], removed: ['keep'] },
    explanation: 'A latency policy only works if the slow child spans have arrived before decision time. Decision windows should be based on real trace duration distributions, not defaults.',
  };

  yield {
    state: sampleGraph('Policy order and composition shape what reaches the backend', { policy: 'compose', keep: 'valuable', backend: 'smaller' }),
    highlight: { active: ['policy', 'keep', 'backend', 'e-policy-keep', 'e-keep-backend'], compare: ['drop'] },
    explanation: 'The exported trace set is a product choice. It should contain enough evidence for incidents and regressions while staying inside storage and query budgets.',
  };

  yield {
    state: labelMatrix(
      'Sizing questions',
      [
        { id: 'rate', label: 'trace rate' },
        { id: 'fanout', label: 'span fanout' },
        { id: 'wait', label: 'wait' },
        { id: 'mem', label: 'memory' },
      ],
      [
        { id: 'asks', label: 'asks' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['new/sec?', 'evict early'],
        ['spans/trace?', 'heap spike'],
        ['long enough?', 'bad sample'],
        ['limit?', 'collector OOM'],
      ],
    ),
    highlight: { active: ['rate:asks', 'wait:asks', 'mem:failure'], compare: ['fanout:failure'] },
    explanation: 'The data-structure budget is concrete: traffic rate times wait duration times spans per trace determines the buffer pressure. Sampling policy is memory policy.',
  };

  yield {
    state: sampleGraph('The runbook watches kept, dropped, late, and evicted traces', { mem: 'evictions', backend: 'kept set', drop: 'drop stats' }),
    highlight: { found: ['backend', 'drop', 'mem'], active: ['policy', 'e-policy-keep', 'e-policy-drop'] },
    explanation: 'A production tail sampler needs its own telemetry: decision counts by policy, trace buffer occupancy, evictions, late spans, and backend export failures.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'decision buffer') yield* decisionBuffer();
  else if (view === 'policy mix') yield* policyMix();
  else throw new InputError('Pick a tail-sampling view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed tracing is most valuable when something unusual happens: a checkout request is slow, a downstream payment span errors, a canary route behaves differently, or one tenant has a bad experience. Those facts are often known near the end of the trace, not when the root span starts.',
        'Tail sampling exists because storing every trace is expensive, but deciding too early throws away the traces engineers most need. OpenTelemetry describes tail sampling as evaluating traces after enough spans have arrived to apply criteria that head sampling cannot know at request start.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approaches are collect everything or sample at the head. Collecting everything gives the best evidence but can overwhelm storage, indexing, and query budgets. Head sampling is cheap because it decides at the start, but it is blind to final latency, downstream failures, and attributes added later.',
        'The wall is that trace value is not uniformly distributed. A random early decision can keep many normal traces while dropping the one failed request that explains the incident. The sampling decision needs later evidence, but later evidence requires buffering.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Group spans by trace ID in the collector, wait for a bounded decision window, then apply policies to the whole trace. The policy can keep every error trace, every slow trace, selected tenants or routes, and a smaller probabilistic sample of normal traffic.',
        'The data structure is a bounded trace map. Each trace record accumulates spans, arrival time, a deadline, and policy evidence. When the decision wait expires, the collector exports the entire trace or drops the entire trace. The goal is not random span retention. The goal is to preserve complete causal stories that are worth debugging.',
      ],
    },
    {
      heading: 'What the views show',
      paragraphs: [
        'In the decision buffer view, follow spans as they enter a trace-ID map, wait behind decision_wait, and then move through policy to keep or drop. The memory node is part of the algorithm: every extra second of waiting holds more traces in the collector.',
        'In the policy mix view, read each policy as a claim about diagnostic value. Status keeps errors, latency keeps slow traces, attributes keep important tenants or services, and probabilistic sampling keeps a baseline. A healthy mix preserves rare important traces while still leaving normal traffic for comparison.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The tail sampling processor receives spans from applications or upstream collectors. It indexes them by trace ID and keeps each trace in memory until the decision window closes or pressure forces a decision. Configuration such as decision_wait and num_traces is capacity planning, not decoration.',
        'When the timer fires, policies evaluate the spans that have arrived. A status-code policy can keep errors. A latency policy can keep traces over a threshold. Attribute policies can keep canary, customer tier, route, or service-specific traces. A probabilistic policy can keep a small baseline of otherwise normal traces.',
        'If a trace is selected, the collector exports the trace as a unit to the backend. If it is dropped, its buffered spans are discarded. Late spans that arrive after the decision are a known failure mode and need measurement.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because the collector waits until the evidence that makes a trace valuable has had time to appear. A root span may look routine at the start, while a payment child span errors three services later or the total duration crosses the p99 threshold near the end.',
        'It also works because the unit of retention is the trace. Engineers debug relationships: parent and child spans, service boundaries, retries, queue waits, and downstream calls. A few isolated spans are much less useful than one complete trace tree selected for a clear reason.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A checkout platform receives 20,000 traces per minute. The team cannot store all of them, but it wants complete evidence for incidents. The collector waits 10 seconds, keeps 100 percent of traces with error status, keeps all traces over 800 ms, keeps all traces for the canary tenant, and keeps 1 percent of normal fast traffic.',
        'During an incident, an SLO burn alert shows checkout p99 rising. Because the tail sampler kept complete slow checkout traces, the team can inspect full request paths through cart, pricing, payment, fraud, and inventory. The backend does not need every normal request to make that debugging path available.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Tail sampling spends memory to buy better decisions. Traffic rate times decision_wait times spans per trace determines buffer pressure. A larger window can see more late child spans, but it increases heap use and makes the collector more sensitive to bursts.',
        'It also adds policy complexity. The selected trace set is biased toward what the rules keep, which is useful for debugging but can distort naive analysis. Operators need counters for kept, dropped, late, and evicted traces, broken down by policy, plus normal collector health metrics.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins when later trace information changes the decision: errors, slow requests, canary traffic, high-value tenants, important routes, unusual service paths, and enough baseline traffic for comparison. It is especially strong when trace storage is expensive but incident debugging still needs complete traces.',
        'It pairs well with metrics. Metrics and SLOs alert quickly; tail sampling decides which traces survive long enough to explain the alert.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when collectors are undersized, decision_wait is too short, late spans are common, or memory pressure evicts traces before policy can evaluate them. In those cases the sampler may drop exactly the trace it was meant to preserve.',
        'It also fails as a replacement for observability design. Sampling does not detect incidents, fix bad instrumentation, choose good span names, control label cardinality, or remove sensitive data. It only chooses which trace evidence reaches the backend.',
      ],
    },
    {
      heading: 'Practical sizing questions',
      paragraphs: [
        'Before setting a policy, estimate new traces per second, average spans per trace, p95 and p99 trace duration, burst size, and collector memory. decision_wait should be long enough for the evidence the policy needs, not copied from a default.',
        'Then decide what normal traffic baseline you still need. Keeping only errors and slow traces is useful during incidents, but it can make it harder to compare broken and healthy paths. A small probabilistic baseline gives context.',
        'Roll out policies in stages. First measure what each rule would have kept, then export selected traces, then tune memory limits and backend costs. Dashboards should separate traces kept by error, latency, attribute, and probabilistic rules so an accidental broad match does not silently turn into collect-everything.',
        'Size the collector tier as part of the tracing system, not as a sidecar afterthought. If applications send bursts through a small collector, the sampler may evict traces before it has enough spans to decide. Run load tests with realistic span counts, long traces, exporter failures, and backend throttling so the policy is proven under pressure.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OpenTelemetry Sampling at https://opentelemetry.io/docs/concepts/sampling/, OpenTelemetry tail sampling blog at https://opentelemetry.io/blog/2022/tail-sampling/, and the tail sampling processor README at https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/processor/tailsamplingprocessor/README.md.',
        'Study next: Distributed Tracing for trace trees, OpenTelemetry Collector Case Study for pipelines, Tail Latency & p99 Thinking for why slow traces matter, Reservoir Sampling for sampling intuition, SLO Error Budget Burn Rate Alert for alerting, and Metric Exemplars Trace Correlation for jumping from histograms to selected traces.',
      ],
    },
  ],
};
