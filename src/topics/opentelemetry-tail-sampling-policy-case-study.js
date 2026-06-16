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
      heading: 'What it is',
      paragraphs: [
        'Tail sampling makes trace sampling decisions after seeing most or all of a trace. That lets the collector keep traces because they are slow, erroneous, tenant-specific, route-specific, or otherwise interesting, instead of deciding blindly at request start.',
        'OpenTelemetry explains that tail sampling evaluates traces after spans are complete enough to apply criteria that are unavailable to head sampling: https://opentelemetry.io/docs/concepts/sampling/. The OpenTelemetry tail sampling blog describes decision_wait and num_traces as core configuration levers: https://opentelemetry.io/blog/2022/tail-sampling/.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'The processor maintains a bounded trace buffer keyed by trace ID. Each trace record holds spans, arrival times, current policy evidence, and a deadline. When the deadline expires, policies decide whether to export the whole trace or drop it.',
        'This is a memory-vs-evidence trade-off. Longer decision windows catch late child spans and more accurate latency/status facts, but they keep more traces in memory. num_traces, expected new traces per second, and memory limits are capacity controls, not just configuration trivia.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A checkout platform keeps 100% of error traces, all traces above 800 ms, all traces for the canary tenant, and 1% of normal fast traffic. The collector waits 10 seconds, buffers by trace ID, exports selected full traces, and records policy counters so operators know whether errors, latency, or baseline sampling drove retention.',
        'During an incident, the SLO alert points to checkout p99. Tail sampling ensures the trace backend has complete slow checkout traces, not random span fragments. The team can move from metric alert to trace tree without drowning the backend in every normal request.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Tail sampling is not free. It can miss slow traces if decision_wait is too short, evict traces if num_traces is too low, or OOM the collector if memory is undersized. It also does not replace metrics; metrics still alert first.',
        'Use probabilistic head sampling when later trace information cannot affect the decision. Tail sampling is for policies that need the tail of the trace: final status, total latency, downstream service path, or attributes that appear after the root span starts.',
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
