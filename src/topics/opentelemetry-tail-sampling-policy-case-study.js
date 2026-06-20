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
        {
          type: 'bullets',
          items: [
            'Active nodes are the stage being evaluated right now -- the span, buffer, or policy under inspection.',
            'Compare nodes are constraints not yet resolved: the timer has not fired, or the policy has not seen enough evidence.',
            'Found nodes are stages that passed: a trace matched a policy and will be exported whole.',
            'Removed nodes are traces dropped or evicted -- their spans are discarded from the buffer.',
          ],
        },
        {
          type: 'note',
          text: 'The "decision buffer" view walks a single trace from span arrival through the decision window to keep-or-drop. The "policy mix" view compares how different policy types interact, conflict, and compose. Both views share the same underlying data structure: a bounded in-memory map keyed by trace ID.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A production microservice architecture can produce millions of traces per minute. Storing all of them is expensive -- Jaeger, Tempo, and commercial backends charge by ingested span or indexed byte. But the traces engineers actually need during an incident are rare: the one checkout that timed out, the payment call that returned a 500, the canary deployment that behaved differently. Those facts are known near the end of the trace, not when the root span starts.',
        {
          type: 'quote',
          text: 'Tail sampling is where the sampling decision is made at the end of the workflow, allowing for a more informed sampling decision.',
          attribution: 'OpenTelemetry documentation, "Sampling" concept page',
        },
        'Head sampling decides at trace creation time by flipping a coin or checking a flag on the root span. It is cheap and stateless, but it is blind to downstream errors, final latency, retry storms, and attributes added by child services. A 1% head sample keeps 1% of everything -- including 1% of the errors you needed 100% of.',
        {
          type: 'table',
          headers: ['Sampling strategy', 'Decision point', 'Sees errors?', 'Sees latency?', 'State cost'],
          rows: [
            ['No sampling', 'N/A', 'Yes', 'Yes', 'Full storage cost'],
            ['Head (probabilistic)', 'Root span creation', 'Only if sampled', 'No', 'None'],
            ['Head (rule-based)', 'Root span creation', 'Only if sampled', 'No', 'None'],
            ['Tail (collector)', 'After decision_wait', 'Yes', 'Yes', 'Buffer memory'],
          ],
        },
        {
          type: 'note',
          text: 'Tail sampling is not the opposite of head sampling. Many production pipelines use both: head sampling at the SDK to reduce export volume, then tail sampling at the collector to apply value-based policies to whatever arrives. The two are layered, not exclusive.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is head sampling with TraceIDRatioBased at the SDK level. Set the ratio to 0.01, and each service independently decides to sample 1% of traces by hashing the trace ID. This is stateless, requires no collector-side buffering, and works out of the box with every OpenTelemetry SDK.',
        {
          type: 'code',
          language: 'yaml',
          text: [
            '# SDK-side head sampling: cheap, stateless, blind',
            'sampler:',
            '  type: TraceIDRatioBased',
            '  ratio: 0.01',
          ].join('\n'),
          label: 'Head sampling configuration -- decides before the trace starts',
        },
        'Head sampling works well for two things: reducing export volume when you truly do not care which traces survive, and generating unbiased traffic profiles for capacity planning. A 1% head sample is a fair random sample of all traffic.',
        'It stops working the moment you care about specific traces. A 1% sample keeps roughly 1% of errors, 1% of slow requests, and 1% of canary traffic. During an incident where 0.3% of requests fail, head sampling at 1% keeps about 0.003% of total traffic as error evidence -- a handful of traces per hour on a service doing 10,000 req/s. That is not enough to debug a cascading failure across five services.',
        {
          type: 'table',
          headers: ['What you want', 'Head sampling result', 'Problem'],
          rows: [
            ['All errors', '~1% of errors', 'Missing 99% of incident evidence'],
            ['All p99 traces', '~1% of slow traces', 'Cannot reconstruct tail latency paths'],
            ['Canary traffic', '~1% of canary', 'Canary deployment invisible in backend'],
            ['Specific tenant', '~1% of that tenant', 'High-value customer debugging impossible'],
            ['Unbiased baseline', '1% of everything', 'Works -- this is the one thing head sampling does well'],
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that trace value is not known at trace creation time. The facts that make a trace worth keeping -- error status codes, total duration exceeding a threshold, a specific downstream service returning a circuit-breaker response -- arrive as child spans minutes or seconds after the root span starts.',
        {
          type: 'diagram',
          text: [
            '  t=0ms    root span starts (looks normal)',
            '  t=50ms   auth span completes (OK)',
            '  t=120ms  cart span completes (OK)',
            '  t=400ms  payment span starts',
            '  t=1800ms payment span errors (503 from bank)',
            '  t=2100ms retry span starts',
            '  t=3500ms retry span errors (timeout)',
            '  t=3600ms root span ends (error, 3600ms)',
            '  ',
            '  Head sampling at t=0: sees nothing wrong.',
            '  Tail sampling at t=3600ms+wait: sees error, latency, retry.',
          ].join('\n'),
          label: 'The information that makes this trace valuable arrives last',
        },
        'Head sampling must decide at t=0. The root span carries no status code, no duration, and no child span attributes. A probabilistic sampler flips a coin; a rule-based sampler can check the route or service name but not the outcome. Both are blind to the payment failure that will happen 1.8 seconds later.',
        'Collecting everything avoids this problem but creates a different one. At 10,000 traces/second with 20 spans per trace, that is 200,000 spans/second. At 1 KB per span, that is 200 MB/s of raw span data, or roughly 17 TB/day. Backend storage, indexing, and query costs scale linearly.',
        {
          type: 'note',
          text: 'The wall is information-theoretic: the sampling decision requires evidence that does not exist yet. No amount of cleverness at the SDK can fix this. The decision must move to a place that can wait for the evidence -- the collector.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Buffer spans by trace ID in the collector, wait a bounded interval for enough of the trace to arrive, then apply policies to the accumulated evidence. Keep or drop the entire trace as a unit.',
        {
          type: 'diagram',
          text: [
            '  spans --> [ trace ID map ] --> timer fires --> [ policy engine ]',
            '                  |                                  |       |',
            '                  |                                KEEP    DROP',
            '                  |                                  |       |',
            '                  +-- memory pressure -->          export  discard',
            '                       (forced decision)             |',
            '                                                  backend',
          ].join('\n'),
          label: 'The tail sampling processor: buffer, wait, evaluate, decide',
        },
        'The data structure is a bounded hash map keyed by trace ID. Each entry accumulates spans, tracks arrival time, and carries a deadline. When the decision window closes, the policy engine evaluates the accumulated spans. A status_code policy checks for errors. A latency policy checks total duration. An attribute policy checks for specific key-value pairs. A probabilistic policy keeps a random baseline.',
        {
          type: 'code',
          language: 'yaml',
          text: [
            'processors:',
            '  tail_sampling:',
            '    decision_wait: 10s',
            '    num_traces: 100000',
            '    policies:',
            '      - name: errors',
            '        type: status_code',
            '        status_code: { status_codes: [ERROR] }',
            '      - name: slow-requests',
            '        type: latency',
            '        latency: { threshold_ms: 800 }',
            '      - name: canary-traffic',
            '        type: string_attribute',
            '        string_attribute:',
            '          key: deployment.ring',
            '          values: [canary]',
            '      - name: baseline',
            '        type: probabilistic',
            '        probabilistic: { sampling_percentage: 1 }',
          ].join('\n'),
          label: 'A production tail sampling config: keep errors, slow traces, canary, plus 1% baseline',
        },
        'The invariant is whole-trace retention. If any policy matches, the collector exports every span belonging to that trace ID. If no policy matches, every span is discarded. There is no state where half a trace reaches the backend. This is what makes tail-sampled traces debuggable -- you get the full causal chain or nothing.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The tail sampling processor in the OpenTelemetry Collector Contrib repository implements this pipeline in five stages.',
        {
          type: 'table',
          headers: ['Stage', 'What happens', 'Key parameter'],
          rows: [
            ['1. Ingest', 'Span arrives, trace ID extracted', 'N/A'],
            ['2. Buffer', 'Span appended to trace record in hash map', 'num_traces (map capacity)'],
            ['3. Wait', 'Timer tracks age of each trace record', 'decision_wait (seconds)'],
            ['4. Evaluate', 'All policies run against accumulated spans', 'Policy list (AND/OR composition)'],
            ['5. Decide', 'Export whole trace (keep) or discard (drop)', 'expected_new_traces_per_sec'],
          ],
        },
        'When a span arrives, the processor looks up its trace ID in the map. If the trace is new, a record is created with the current timestamp and the decision_wait countdown begins. If the trace already exists, the span is appended. The map is bounded by num_traces; if full, the oldest trace is forcibly evaluated and evicted.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Trace abc123:',
            '  spans: [root/checkout, child/auth, child/cart, child/payment]',
            '  arrived: 14:30:05.123',
            '  deadline: 14:30:15.123  (decision_wait = 10s)',
            '  status: PENDING',
            '',
            'At 14:30:15.123:',
            '  policy "errors":    payment.status = ERROR  --> MATCH',
            '  policy "slow":      duration = 3600ms > 800 --> MATCH',
            '  policy "canary":    deployment.ring != canary --> NO MATCH',
            '  policy "baseline":  hash(abc123) % 100 < 1  --> NO MATCH',
            '  ',
            '  Decision: KEEP (at least one policy matched)',
            '  Action:   export all 4 spans to backend',
          ].join('\n'),
          label: 'A trace buffered for 10 seconds, then evaluated against four policies',
        },
        'Policy composition defaults to OR: if any policy matches, the trace is kept. The and_sub_policy type allows conjunctive rules -- for example, keep traces that are both slow AND from the canary ring. The composite_sub_policy type combines multiple policies with explicit AND/OR logic.',
        'Late spans -- spans that arrive after the decision has been made -- are a fundamental edge case. The processor can be configured to keep a "decision cache" of recently decided trace IDs. If a late span arrives for a trace that was already kept, the span is exported. If the trace was dropped, the late span is also dropped. If the trace ID is not in the cache at all, the span is silently lost.',
        {
          type: 'note',
          text: 'The decision cache is bounded. If it overflows, late spans for old traces will be dropped even if the trace was kept. This is why decision_wait must be tuned to actual trace durations, not set to an arbitrary default.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on two properties: evidence availability and trace completeness.',
        {
          type: 'bullets',
          items: [
            'Evidence availability: by waiting decision_wait seconds, the collector has seen the child spans that carry error status, latency, retry counts, and downstream attributes. The policy evaluates facts, not predictions.',
            'Trace completeness: the unit of export is the full set of spans sharing a trace ID. The backend receives a connected span tree, not isolated fragments. Engineers can follow parent-child relationships, measure service-to-service latency, and identify the root cause.',
            'Bias by design: the kept trace set is intentionally biased toward interesting traces. This is a feature, not a bug. The purpose is debugging and incident investigation, not statistical traffic analysis. The probabilistic baseline provides the unbiased comparison set when needed.',
          ],
        },
        {
          type: 'quote',
          text: 'Tail-based sampling lets you make a decision on whether or not to sample a trace after all the spans in a request have been completed. This is critical when you want to make a sampling decision based on something that is not known at the beginning.',
          attribution: 'OpenTelemetry blog, "Tail Sampling with OpenTelemetry" (2022)',
        },
        'The approach is sound as long as decision_wait is calibrated to actual trace durations. If 95% of traces complete within 10 seconds, a 10-second window gives policies near-complete evidence for the vast majority of decisions. The 5% of longer traces may be evaluated with incomplete spans, but the latency policy itself will likely catch them on duration alone.',
        {
          type: 'table',
          headers: ['Property', 'Guarantee', 'Assumption'],
          rows: [
            ['Evidence completeness', 'Policies see most spans', 'decision_wait >= p95 trace duration'],
            ['Trace integrity', 'All spans exported or all dropped', 'Trace ID is consistent across services'],
            ['Error retention', '100% of error traces kept', 'Error status propagates to at least one span'],
            ['Bounded memory', 'Buffer never exceeds num_traces', 'Eviction may force premature decisions'],
          ],
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Tail sampling trades collector memory for better sampling decisions. The cost is concrete and predictable.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Buffer pressure formula:',
            '  active_traces = new_traces_per_sec * decision_wait_sec',
            '  buffer_bytes  = active_traces * avg_spans_per_trace * avg_span_bytes',
            '',
            'Example:',
            '  500 new traces/sec * 10s wait = 5,000 active traces',
            '  5,000 traces * 20 spans/trace * 1 KB/span = 100 MB',
            '',
            'Double the wait to 20s:',
            '  500 * 20 = 10,000 active traces',
            '  10,000 * 20 * 1 KB = 200 MB',
          ].join('\n'),
          label: 'Memory scales linearly with decision_wait and traffic rate',
        },
        {
          type: 'table',
          headers: ['Cost dimension', 'What grows', 'Scaling factor'],
          rows: [
            ['Collector memory', 'Buffered spans in the trace map', 'O(rate * wait * fan-out)'],
            ['CPU', 'Policy evaluation per trace at deadline', 'O(policies * spans) per decision'],
            ['Late-span loss', 'Spans arriving after decision', 'Grows with decision_wait being too short'],
            ['Eviction loss', 'Traces forcibly decided under memory pressure', 'Grows when num_traces is too small'],
            ['Backend storage', 'Only kept traces reach the backend', 'Shrinks -- that is the point'],
            ['Policy complexity', 'Debugging which rule kept which trace', 'Grows with number of policies'],
          ],
        },
        'Doubling decision_wait doubles memory but may not double decision quality. Context -- the percentage of spans seen before the deadline -- follows a curve that flattens. Going from 2s to 10s dramatically improves evidence. Going from 10s to 30s adds little evidence but triples memory. The animation plot shows this tradeoff.',
        {
          type: 'note',
          text: 'The tail sampling processor runs inside the collector process. If the collector OOMs, it takes down the entire pipeline -- not just sampling. Always pair tail sampling with the memory_limiter processor and set num_traces conservatively. The processor will forcibly evaluate and evict traces under pressure, which is better than crashing.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A checkout platform processes 500 new traces per second during normal load and 1,200 during flash sales. Average trace fan-out is 25 spans across 6 services: API gateway, auth, cart, pricing, payment, and inventory. The team stores traces in Grafana Tempo with a 30-day retention window. Full collection costs $18,000/month in storage and indexing.',
        {
          type: 'table',
          headers: ['Metric', 'Value'],
          rows: [
            ['Normal trace rate', '500/sec (43M/day)'],
            ['Peak trace rate', '1,200/sec (flash sale bursts)'],
            ['Avg spans per trace', '25'],
            ['Avg span size', '~1 KB'],
            ['p95 trace duration', '4.2 seconds'],
            ['p99 trace duration', '11.8 seconds'],
            ['Error rate (normal)', '0.15%'],
            ['Error rate (incident)', '2-5%'],
          ],
        },
        'Step 1: Size the buffer. With decision_wait at 12 seconds (just above p99 duration) and peak rate of 1,200 traces/sec, the buffer holds 14,400 active traces. At 25 spans and 1 KB each, that is 360 MB of heap. The team sets num_traces to 20,000 (40% headroom) and configures memory_limiter to 512 MB.',
        'Step 2: Define policies.',
        {
          type: 'code',
          language: 'yaml',
          text: [
            'processors:',
            '  tail_sampling:',
            '    decision_wait: 12s',
            '    num_traces: 20000',
            '    expected_new_traces_per_sec: 1200',
            '    policies:',
            '      - name: all-errors',
            '        type: status_code',
            '        status_code: { status_codes: [ERROR] }',
            '      - name: slow-checkouts',
            '        type: latency',
            '        latency: { threshold_ms: 800 }',
            '      - name: canary-ring',
            '        type: string_attribute',
            '        string_attribute:',
            '          key: deployment.ring',
            '          values: [canary]',
            '      - name: enterprise-tier',
            '        type: string_attribute',
            '        string_attribute:',
            '          key: customer.tier',
            '          values: [enterprise]',
            '      - name: baseline',
            '        type: probabilistic',
            '        probabilistic: { sampling_percentage: 0.5 }',
          ].join('\n'),
          label: 'Production config: errors + slow + canary + enterprise + 0.5% baseline',
        },
        'Step 3: Estimate kept volume. During normal traffic, 0.15% of traces error (0.75/sec), roughly 8% exceed 800ms latency (40/sec), canary is 5% of traffic (25/sec), enterprise tier is 2% (10/sec), and 0.5% probabilistic keeps 2.5/sec. With overlap, the kept rate is approximately 65 traces/sec -- 13% of total traffic. Storage drops from $18,000/month to roughly $2,300/month.',
        {
          type: 'table',
          headers: ['Policy', 'Traces/sec kept', '% of traffic', 'Debugging value'],
          rows: [
            ['all-errors', '~0.75', '0.15%', 'Every error trace available for root cause analysis'],
            ['slow-checkouts', '~40', '8%', 'Full paths for p95+ latency investigation'],
            ['canary-ring', '~25', '5%', 'Compare canary vs stable for every deployment'],
            ['enterprise-tier', '~10', '2%', 'High-value customer traces always available'],
            ['baseline', '~2.5', '0.5%', 'Unbiased sample for healthy-path comparison'],
            ['Total (with overlap)', '~65', '~13%', '87% reduction in storage with full incident coverage'],
          ],
        },
        {
          type: 'diagram',
          text: [
            '  Incoming: 500 traces/sec',
            '    |',
            '    v',
            '  [ Collector buffer: 12s window, 20K capacity ]',
            '    |',
            '    +---> KEEP (65/sec) ---> Tempo backend ($2.3K/mo)',
            '    |       errors: 0.75/sec',
            '    |       slow:   40/sec',
            '    |       canary: 25/sec',
            '    |       enterprise: 10/sec',
            '    |       baseline: 2.5/sec',
            '    |',
            '    +---> DROP (435/sec) ---> /dev/null',
          ].join('\n'),
          label: 'The sampler keeps 13% of traces but 100% of debugging evidence',
        },
        'Step 4: Validate during an incident. A payment provider outage causes 3% of checkouts to error. The error policy now keeps 15 traces/sec instead of 0.75. The slow-checkout policy captures the elevated latency. The team traces a failing request through all 6 services, finds the payment span returning 503, sees 3 retries with exponential backoff, and confirms the circuit breaker opened after the 3rd retry. This investigation requires zero changes to the sampling config -- the policies were already tuned for this scenario.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Tail sampling earns its memory cost when the traces worth keeping are identifiable by facts that appear late in the trace.',
        {
          type: 'table',
          headers: ['Use case', 'Policy type', 'Why tail sampling wins'],
          rows: [
            ['Incident debugging', 'status_code: ERROR', 'Keep every error trace whole; head sampling drops 99% of them'],
            ['Latency investigation', 'latency threshold', 'p99 traces only identifiable after all spans complete'],
            ['Canary deployment validation', 'string_attribute: ring=canary', 'Compare canary vs stable with complete traces from both'],
            ['High-value customer support', 'string_attribute: tier=enterprise', 'Debug customer-specific issues without searching a 1% haystack'],
            ['Compliance audit trail', 'string_attribute: route=/api/transfer', 'Keep 100% of traces for regulated endpoints'],
            ['Cost reduction', 'probabilistic + targeted', 'Drop 80-95% of normal traffic, keep all diagnostic evidence'],
          ],
        },
        'Tail sampling pairs naturally with metrics and SLOs. Metrics detect that p99 latency is rising or error rate is spiking. The SLO burn rate alert fires. The engineer opens the trace backend and finds complete traces for the exact errors and slow requests that caused the alert -- because the tail sampler kept them.',
        {
          type: 'note',
          text: 'Tail sampling does not replace head sampling. Many production setups use head sampling at the SDK (to reduce export volume from high-throughput services) and tail sampling at the collector (to apply value-based policies to whatever arrives). The two compose: head sampling controls the firehose, tail sampling curates the archive.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Tail sampling fails when its assumptions break. Each failure mode has a specific cause and a specific symptom.',
        {
          type: 'table',
          headers: ['Failure mode', 'Cause', 'Symptom', 'Mitigation'],
          rows: [
            ['Missed slow traces', 'decision_wait < actual trace duration', 'Latency policy does not match because the slow span has not arrived', 'Set decision_wait above p99 trace duration'],
            ['Collector OOM', 'num_traces too high or memory_limiter absent', 'Collector process crashes, all spans lost', 'Add memory_limiter; set num_traces conservatively'],
            ['Premature eviction', 'Traffic burst exceeds num_traces', 'Traces forcibly decided with incomplete evidence', 'Size num_traces for peak rate, not average'],
            ['Late span loss', 'Spans arrive after decision + cache expiry', 'Kept traces missing their final spans', 'Extend decision cache; monitor late span counters'],
            ['Inconsistent trace IDs', 'Broken context propagation across services', 'Child spans grouped as separate traces', 'Audit W3C traceparent propagation in all services'],
            ['Accidental collect-all', 'Overly broad attribute policy', 'Policy matches 90%+ of traces', 'Dashboard per-policy keep rates; alert on volume spikes'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Tail sampling does not detect incidents. It only curates which traces survive. Detection belongs to metrics, logs, and SLOs.',
            'Tail sampling does not fix bad instrumentation. If spans lack status codes, the status_code policy cannot match. If spans lack custom attributes, attribute policies are useless.',
            'Tail sampling creates a biased trace set. The backend overrepresents errors, slow requests, and policy-matched traffic. Naive analysis (e.g., "what percentage of traces errored?") will be wrong unless corrected for the sampling policy.',
            'Tail sampling adds a single point of failure. If the collector tier is undersized, overloaded, or misconfigured, the sampling decision degrades silently. The sampler needs its own telemetry.',
          ],
        },
        'The worst failure mode is silent degradation. The collector runs out of memory, starts evicting traces before their deadline, and drops the slow payment trace that would have explained the incident. Nothing crashes. No alert fires. The team opens the trace backend and finds nothing. The sampler was supposed to keep that trace, but pressure forced a premature drop.',
        {
          type: 'code',
          language: 'text',
          text: [
            'Counters every tail sampling deployment must export:',
            '  otelcol_processor_tail_sampling_count_traces_sampled',
            '  otelcol_processor_tail_sampling_count_traces_dropped',
            '  otelcol_processor_tail_sampling_count_traces_evicted',
            '  otelcol_processor_tail_sampling_count_late_spans',
            '  otelcol_processor_tail_sampling_policy_evaluation_errors',
            '  otelcol_processor_tail_sampling_new_trace_id_received',
            '',
            'Alert when:',
            '  evicted / (sampled + dropped + evicted) > 0.01',
            '  late_spans / total_spans > 0.05',
          ].join('\n'),
          label: 'Tail sampler self-telemetry: the sampler needs its own observability',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'Covers'],
          rows: [
            ['OpenTelemetry Sampling concepts (opentelemetry.io/docs/concepts/sampling)', 'Head vs. tail sampling, TraceIDRatio, ParentBased, context propagation'],
            ['Tail Sampling with OpenTelemetry blog (opentelemetry.io/blog/2022/tail-sampling)', 'Motivation, policy types, configuration walkthrough'],
            ['tailsamplingprocessor README (github.com/open-telemetry/opentelemetry-collector-contrib)', 'All policy types, composite policies, decision_wait, num_traces, expected_new_traces_per_sec'],
            ['OpenTelemetry Collector architecture (opentelemetry.io/docs/collector/architecture)', 'Pipeline model: receivers, processors, exporters, and how tail sampling fits'],
            ['Grafana Tempo tail sampling guide', 'Production deployment patterns, memory sizing, Tempo-specific integration'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Distributed Tracing -- understand trace trees, span relationships, and context propagation before reasoning about sampling.',
            'Prerequisite: Reservoir Sampling -- the probabilistic intuition behind maintaining a representative sample under streaming constraints.',
            'Extension: OpenTelemetry Collector Pipeline -- how receivers, processors, and exporters compose, and where tail sampling sits in the chain.',
            'Related: SLO Error Budget Burn Rate Alert -- metrics detect the incident; tail sampling preserves the traces that explain it.',
            'Related: Metric Exemplars Trace Correlation -- jumping from a histogram bucket directly to a tail-sampled trace that landed in that bucket.',
            'Contrast: Head Sampling -- stateless, cheap, unbiased, but blind to outcomes. Understand both to choose correctly.',
          ],
        },
      ],
    },
  ],
};
