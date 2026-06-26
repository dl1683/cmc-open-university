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
      heading: 'How to read the animation',
      paragraphs: [
        'The graph traces spans flowing through the OpenTelemetry tail sampling processor. Each node is a stage: arrival, buffering, timer, policy evaluation, keep/drop decision, backend export, or memory pressure. Each edge is a data-flow dependency.',
        {type:'callout', text:'Tail sampling turns trace retention into a bounded join over span evidence, so the collector can keep complete high-value traces instead of random fragments.'},
        'Active nodes are the span, buffer, or policy being evaluated now. Compare nodes are constraints still unresolved, such as a timer that has not fired. Found nodes are traces kept whole. Removed nodes are traces dropped or evicted from the buffer.',
        'The safe inference rule is whole-trace retention. A kept trace should reach the backend as a connected set of spans sharing one trace id. A dropped trace should not leave fragments that look like incomplete causal evidence.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A busy service can produce millions of traces per minute. Storing every span is expensive, but the traces engineers need are rare: errors, slow requests, canary failures, customer-specific incidents, and regulated paths.',
        'Head sampling decides at trace creation time. It is cheap because it needs no collector-side buffer, but it cannot see child spans, final latency, retry behavior, or downstream error status that arrive later.',
        'Tail sampling exists because trace value is often known only near the end. The Collector waits for evidence, evaluates policies, and keeps or drops the complete trace.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to collect everything. That preserves every trace, but storage and indexing cost scale linearly with traffic. At high volume, the backend becomes a cost center before it becomes a debugging tool.',
        'The next obvious approach is head sampling at the SDK. A 1 percent TraceIDRatioBased sampler keeps a fair random slice of all traffic. It is good for broad traffic profiles and capacity estimates.',
        'Head sampling fails for targeted debugging. A 1 percent sample keeps about 1 percent of errors, 1 percent of p99 traces, and 1 percent of canary requests. The rare evidence remains rare after sampling.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is evidence timing. A root span can look normal at 0 ms. A payment child span may fail at 1,800 ms, a retry may time out at 3,500 ms, and the root span may finish at 3,600 ms with an error.',
        'A head sampler must decide before those facts exist. No SDK rule can inspect a downstream error that has not happened yet. The decision must move to a place that can wait.',
        'Collecting everything solves timing but creates volume. At 10,000 traces per second, 20 spans per trace, and 1 KB per span, the raw stream is about 200 MB per second, or roughly 17 TB per day before indexing overhead.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Buffer spans by trace id in the Collector, wait a bounded interval, then evaluate policies over the accumulated spans. If any policy matches, export the whole trace. If no policy matches, discard it.',
        'The data structure is a bounded hash map keyed by trace id. Each entry stores spans, first-arrival time, a deadline, and decision state. The bound is necessary because memory grows with traffic rate and wait time.',
        'Policies encode value. A status-code policy keeps errors. A latency policy keeps slow traces. An attribute policy keeps canary or enterprise traffic. A probabilistic policy keeps an unbiased baseline for comparison.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When a span arrives, the processor extracts its trace id. If the trace is new, it creates a record and starts the decision wait timer. If the trace already exists, it appends the span to the record.',
        'When the deadline fires, the policy engine evaluates the collected spans. Policy composition is often OR: any matching policy keeps the trace. More specific configs can combine sub-policies for AND behavior, such as slow and canary.',
        'Late spans are the edge case. A decision cache remembers recent keep or drop decisions. If a late span belongs to a kept trace and the decision is still cached, it can be exported. If the cache expired, the span is lost.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Tail sampling works because it delays the decision until useful evidence is available. The Collector can see status codes, duration, retries, downstream service names, deployment ring, tenant, and other attributes that the root span did not know.',
        'It preserves debugging structure by exporting a trace as a unit. Engineers can follow parent-child relationships across services instead of seeing isolated sampled spans that do not reconstruct the request path.',
        'The kept set is intentionally biased toward interesting traces. That is correct for incident investigation. A small probabilistic baseline is needed when engineers also want an unbiased picture of healthy traffic.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Memory cost is rate times wait times span size. At 500 new traces per second, a 10 second wait creates about 5,000 active traces. With 20 spans per trace and 1 KB per span, the buffer holds about 100 MB of span data.',
        'Doubling the decision wait doubles active traces and roughly doubles memory. It may not double evidence quality because trace completion has a curve. Moving from 2 seconds to 10 seconds can help a lot; moving from 10 seconds to 30 seconds may add little but triple memory.',
        'CPU cost is policy evaluation. If 5,000 traces per second reach their deadline and each policy scans 20 spans, adding more policies and attributes increases processor work. The sampler needs its own metrics and alerts.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Tail sampling is valuable for incident debugging because it can keep every error trace while dropping most healthy traffic. It also fits latency investigation because p99 traces are known only after duration is observed.',
        'Canary deployments use it to keep all traces from the canary ring for comparison. Enterprise support can keep high-value customer traces. Compliance routes can retain 100 percent of regulated endpoint traces.',
        'It pairs naturally with SLO alerts. Metrics detect a rising error rate or latency burn. Tail sampling keeps the traces that explain the burn, so the trace backend contains the evidence engineers need after the alert fires.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when decision_wait is shorter than real trace duration. The sampler evaluates incomplete evidence and can miss the slow or failing child span. Setting the wait near p95 or p99 trace duration is a capacity decision.',
        'It fails under memory pressure if num_traces is too small or the memory limiter is absent. Forced eviction creates premature decisions. A crashing Collector loses the telemetry path completely.',
        'It fails when instrumentation is weak. If spans do not carry status codes, latency, trace ids, or attributes, the policies cannot match. Tail sampling curates evidence; it does not create missing evidence.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A checkout platform handles 500 new traces per second normally and 1,200 during flash sales. Average fan-out is 25 spans, average span size is 1 KB, p95 trace duration is 4.2 seconds, and p99 is 11.8 seconds.',
        'The team sets decision_wait to 12 seconds and sizes for the 1,200 traces per second peak. The active buffer is 1,200 times 12, or 14,400 traces. At 25 KB per trace, the span data is about 360 MB, so num_traces is set to 20,000 with a memory limiter above that budget.',
        'Policies keep all errors, all traces over 800 ms, all canary traffic, all enterprise traffic, and a 0.5 percent baseline. Normal traffic keeps about 65 traces per second out of 500, or 13 percent. If full tracing costs 18,000 dollars per month, storage falls to about 2,340 dollars while important traces remain complete.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the OpenTelemetry sampling concept docs, the OpenTelemetry tail sampling blog, the tail sampling processor README in collector-contrib, Collector architecture docs, and backend guides such as Grafana Tempo tail sampling guidance.',
        'Study Distributed Tracing before this topic, then OpenTelemetry Collector Pipeline, Metric Exemplars Trace Correlation, SLO Error Budget Burn Rate, Head Sampling, and Reservoir Sampling for the contrast between unbiased sampling and value-based retention.',
      ],
    },
  ],
};
