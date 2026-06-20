// Dapper case study: propagate trace context through common RPC libraries,
// sample enough requests to keep overhead low, then reconstruct distributed
// latency from span trees.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'dapper-tracing-case-study',
  title: 'Dapper Tracing Case Study',
  category: 'Papers',
  summary: 'Google Dapper as the distributed tracing lesson: trace ids, span trees, sampling, and latency attribution.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['trace propagation', 'sampling and analysis'], defaultValue: 'trace propagation' },
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

function requestGraph(title) {
  return graphState({
    nodes: [
      { id: 'user', label: 'user', x: 0.6, y: 3.8, note: 'request' },
      { id: 'frontend', label: 'frontend', x: 2.2, y: 3.8, note: 'root span' },
      { id: 'auth', label: 'auth', x: 4.0, y: 2.0, note: 'child span' },
      { id: 'search', label: 'search', x: 4.1, y: 4.0, note: 'child span' },
      { id: 'ads', label: 'ads', x: 4.0, y: 6.0, note: 'child span' },
      { id: 'index', label: 'index shard', x: 6.3, y: 3.2, note: 'fanout' },
      { id: 'profile', label: 'profile store', x: 6.3, y: 5.0, note: 'lookup' },
      { id: 'collector', label: 'collector', x: 8.4, y: 3.8, note: 'sampled spans' },
    ],
    edges: [
      { id: 'e-user-front', from: 'user', to: 'frontend', weight: 'HTTP' },
      { id: 'e-front-auth', from: 'frontend', to: 'auth', weight: 'trace id' },
      { id: 'e-front-search', from: 'frontend', to: 'search', weight: 'trace id' },
      { id: 'e-front-ads', from: 'frontend', to: 'ads', weight: 'trace id' },
      { id: 'e-search-index', from: 'search', to: 'index', weight: 'RPC' },
      { id: 'e-ads-profile', from: 'ads', to: 'profile', weight: 'RPC' },
      { id: 'e-auth-collector', from: 'auth', to: 'collector', weight: 'span log' },
      { id: 'e-search-collector', from: 'search', to: 'collector', weight: 'span log' },
      { id: 'e-ads-collector', from: 'ads', to: 'collector', weight: 'span log' },
    ],
  }, { title });
}

function spanTable(title) {
  return labelMatrix(
    title,
    [
      { id: 's0', label: 'span 0' },
      { id: 's1', label: 'span 1' },
      { id: 's2', label: 'span 2' },
      { id: 's3', label: 'span 3' },
      { id: 's4', label: 'span 4' },
    ],
    [
      { id: 'service', label: 'service' },
      { id: 'parent', label: 'parent' },
      { id: 'time', label: 'duration' },
      { id: 'note', label: 'note' },
    ],
    [
      ['frontend', '-', '180 ms', 'root'],
      ['auth', 'frontend', '18 ms', 'fast'],
      ['search', 'frontend', '145 ms', 'slow child'],
      ['index shard', 'search', '130 ms', 'hot shard'],
      ['ads', 'frontend', '35 ms', 'parallel child'],
    ],
  );
}

function* tracePropagation() {
  yield {
    state: requestGraph('A request fans out across services'),
    highlight: { active: ['user', 'frontend', 'e-user-front'], compare: ['auth', 'search', 'ads'] },
    explanation: 'The graph starts with an ordinary request that fans out across services. Without trace context, each box can only explain its own log line. Dapper makes the whole path visible as one request-shaped object.',
  };

  yield {
    state: requestGraph('Trace context travels through common libraries'),
    highlight: { active: ['frontend', 'auth', 'search', 'ads', 'e-front-auth', 'e-front-search', 'e-front-ads'], found: ['index', 'profile'] },
    explanation: 'The highlighted edges show the deployment trick. Trace id and parent span id travel through common RPC and threading libraries, so tracing follows normal calls without every application team writing custom plumbing.',
    invariant: 'Every child span records the same trace id and a parent span id.',
  };

  yield {
    state: spanTable('The trace becomes a span tree'),
    highlight: { active: ['s0:service', 's1:parent', 's2:parent', 's3:parent'], found: ['s2:time', 's3:time'] },
    explanation: 'The span table turns scattered timing into a tree. The root took 180 ms, but the slow child points at search, and the nested span points more specifically at the index shard. That is the difference between a complaint and a lead.',
  };

  yield {
    state: requestGraph('Trace output identifies the bottleneck edge'),
    highlight: { found: ['search', 'index', 'e-search-index'], compare: ['auth', 'ads', 'profile'] },
    explanation: 'The bottleneck edge is the operational payoff. A vague p99 problem becomes a concrete service edge and shard family to inspect. Tracing does not fix latency by itself; it tells you where the next engineering hour should go.',
  };
}

function* samplingAndAnalysis() {
  yield {
    state: labelMatrix(
      'Sampling keeps tracing cheap enough to deploy broadly',
      [
        { id: 'all', label: 'all requests' },
        { id: 'head', label: 'head sample' },
        { id: 'tail', label: 'tail-biased sample' },
        { id: 'debug', label: 'debug trace' },
      ],
      [
        { id: 'kept', label: 'kept?' },
        { id: 'cost', label: 'cost' },
        { id: 'use', label: 'use' },
      ],
      [
        ['no', 'too high', 'not sustainable'],
        ['some', 'bounded', 'baseline visibility'],
        ['slow/errors', 'selective', 'incident analysis'],
        ['forced', 'developer chosen', 'single request'],
      ],
    ),
    highlight: { active: ['head:kept', 'head:cost'], found: ['tail:use', 'debug:use'], removed: ['all:kept'] },
    explanation: 'The sampling table explains why Dapper could be everywhere. Full capture is too expensive; bounded sampling gives baseline visibility, while tail-biased or debug traces help during incidents without making tracing the incident.',
  };

  yield {
    state: spanTable('Analysis starts with critical path attribution'),
    highlight: { active: ['s0:time', 's2:time', 's3:time'], compare: ['s1:time', 's4:time'] },
    explanation: 'A trace is a timing graph, not a bill of materials. Parallel children overlap, so summing every child misleads you. The critical path is the chain that actually controls end-to-end latency.',
  };

  yield {
    state: labelMatrix(
      'Dapper-derived tools',
      [
        { id: 'latency', label: 'latency profiles' },
        { id: 'deps', label: 'dependency graphs' },
        { id: 'operators', label: 'incident tools' },
        { id: 'developers', label: 'debug traces' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'answer', label: 'answer' },
      ],
      [
        ['span durations', 'which service is slow?'],
        ['parent-child edges', 'who calls whom?'],
        ['sampled traces', 'what changed?'],
        ['forced trace id', 'why did my request fail?'],
      ],
    ),
    highlight: { found: ['latency:answer', 'deps:answer', 'operators:answer'], active: ['developers:input'] },
    explanation: 'The derived-tools table shows why the span shape matters. Once spans have consistent IDs, parents, times, and service names, the same data powers latency profiles, dependency maps, incident tools, and developer debugging.',
  };

  yield {
    state: labelMatrix(
      'Where tracing fails if the contract is weak',
      [
        { id: 'prop', label: 'propagation gaps' },
        { id: 'async', label: 'async work' },
        { id: 'sampling', label: 'sampling bias' },
        { id: 'card', label: 'high cardinality' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'repair', label: 'repair' },
      ],
      [
        ['broken tree', 'instrument common clients'],
        ['missing child spans', 'context-aware queues'],
        ['rare failures absent', 'tail-aware policy'],
        ['storage blowup', 'bounded attributes'],
      ],
    ),
    highlight: { active: ['prop:repair', 'async:repair'], compare: ['sampling:symptom', 'card:symptom'] },
    explanation: 'The failure table is the warning label. Queues, retries, async jobs, and background workers can break the tree unless they carry context intentionally. Missing propagation makes the most interesting part of the request disappear.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'trace propagation') yield* tracePropagation();
  else if (view === 'sampling and analysis') yield* samplingAndAnalysis();
  else throw new InputError('Pick a Dapper view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Trace propagation" follows a single user request as it fans out across services, showing how trace context travels through RPC boundaries and how the resulting span records reassemble into a tree. "Sampling and analysis" shows how sampling policies keep tracing affordable and how span trees become actionable latency analysis.',
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current focus: the service handling the request, the edge carrying context, or the span field under analysis.',
            'Found (green) nodes are confirmed outcomes: the bottleneck edge in the trace view, or the useful analysis products in the sampling view.',
            'Compare (blue) nodes show contrast: services not on the critical path, or alternative sampling strategies being weighed.',
            'Removed (red) marks failures: requests dropped by sampling, or propagation gaps that break the tree.',
          ],
        },
        'In the matrix views, rows are spans or strategies and columns are properties. Watch the "duration" column in the span table to identify which child dominates the root latency, and the "use" column in the sampling table to see why each strategy exists.',
        {
          type: 'note',
          text: 'The animation uses a toy service graph with five services. Google runs Dapper across tens of thousands of services processing billions of requests per day. The data model is identical; the scale difference is what makes sampling and automatic instrumentation non-negotiable.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A single user request in a large service-oriented system is not a single event. It is a path through frontends, authentication services, search backends, ad servers, caches, storage shards, queues, and retries. Each service has its own logs and metrics. None of that automatically explains what happened to one request as it crossed the full graph.',
        {
          type: 'quote',
          text: 'We built Dapper to provide Google\'s developers with more information about the behavior of complex distributed systems.',
          attribution: 'Sigelman et al., "Dapper, a Large-Scale Distributed Systems Tracing Infrastructure" (2010)',
        },
        'The core debugging question is simple: where did the time go? In a monolith, a profiler answers that. In a distributed system, the answer is scattered across dozens of machines and teams. A frontend sees a slow request. A backend reports normal p99. A cache sees a miss. A storage shard sees a retry. The failure is in the path, not in any single dashboard.',
        {
          type: 'table',
          headers: ['Signal type', 'What it tells you', 'What it cannot tell you'],
          rows: [
            ['Metrics', 'Aggregate rates, latency percentiles, error ratios', 'Which specific request was slow and why'],
            ['Logs', 'Local event narrative for one service', 'How events on different machines relate causally'],
            ['Traces', 'The full causal path of one request across services', 'Fleet-wide rates or why CPU burned inside one function'],
          ],
        },
        'Dapper turned distributed tracing from a clever debugging trick into a fleet-wide infrastructure primitive. The hard part was not drawing a tree of spans. The hard part was making tracing cheap, automatic, and sampled so that enough of production was traceable to be useful without tracing itself becoming the performance problem.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is correlated logging: ask every team to include a request ID in their log lines. When something goes wrong, grep across all logs for that ID and reconstruct the path manually.',
        {
          type: 'diagram',
          text: 'Correlated logging:\n\n  frontend.log:  reqID=abc123  start  t=0ms\n  auth.log:      reqID=abc123  check  t=5ms\n  search.log:    reqID=abc123  query  t=12ms\n  index.log:     ???  (different ID format, dropped correlation)\n  ads.log:       reqID=abc123  fetch  t=8ms\n\n  Manual reconstruction:\n    frontend --> auth (5ms)\n    frontend --> search (12ms)\n    frontend --> ads (8ms)\n    search --> index (???)   <-- lost: index uses internal IDs',
          label: 'Correlated logging breaks at the first service that uses a different ID scheme or drops the header',
        },
        'This works for small systems with disciplined teams. It fails for three reasons. First, the request ID must survive every boundary: RPC calls, queue handoffs, thread pool dispatches, retries, and fanout. One missing propagation edge hides the slowest part of the request. Second, log schemas drift across teams -- different timestamp formats, different field names, different retention windows. Third, reconstructing a timeline from raw log lines requires manual work that does not scale to thousands of requests per second.',
        'The second instinct is to trace everything in full detail. Record every function call, every RPC, every attribute. That fails on cost. A high-traffic fleet cannot afford to store every span for every request forever. At Google scale, full tracing would generate petabytes of span data per day. A system too expensive to leave on gets disabled during normal operation, which means it is absent when the incident arrives.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The fundamental constraint is three-way. Tracing must be (1) automatic enough to cover the fleet without per-team opt-in, (2) cheap enough to run continuously in production, and (3) complete enough to reconstruct causal paths across asynchronous boundaries. No naive approach satisfies all three.',
        {
          type: 'table',
          headers: ['Approach', 'Automatic?', 'Cheap?', 'Causally complete?', 'Why it fails'],
          rows: [
            ['Correlated logging', 'No -- each team must adopt the ID', 'Yes', 'No -- broken at async boundaries', 'Adoption is voluntary; gaps are invisible'],
            ['Full-detail tracing', 'Possible', 'No -- petabytes/day at scale', 'Yes', 'Cost forces it off; absent during incidents'],
            ['Per-service profiling', 'Yes within one service', 'Yes', 'No -- no cross-service causality', 'Explains CPU, not request paths'],
            ['Ad-hoc debug traces', 'No -- developer must trigger', 'Yes', 'Sometimes', 'Misses the first failure; no baseline'],
          ],
        },
        {
          type: 'note',
          text: 'The wall is not technical complexity. It is deployment economics. Any team can build a tracer that works in a demo. The question Dapper answered is: how do you build a tracer that works across 10,000+ services, adds less than 0.01% overhead, and stays on all the time without anyone thinking about it?',
        },
        'The invariant that must hold: every child span in a trace must carry the same trace ID and a reference to its parent span ID. If any service on the path fails to propagate this context, the resulting trace tree has a missing subtree. The trace looks shorter and simpler than reality, and the engineer debugging the incident draws the wrong conclusion about where the time went.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Instrument the common libraries, not the applications. RPC frameworks, HTTP clients, thread pool executors, and queue consumers are the chokepoints where requests cross boundaries. If those shared layers automatically create spans and propagate trace context, tracing follows every request through every service without application teams writing a line of instrumentation code.',
        {
          type: 'diagram',
          text: 'Dapper instrumentation model:\n\n  Application code (unchanged)\n       |\n       v\n  [RPC client library]  <-- instrumented: creates child span,\n       |                     injects (traceId, parentSpanId) into headers\n       | network\n       v\n  [RPC server library]  <-- instrumented: extracts context,\n       |                     creates server span with parent reference\n       v\n  Application code (unchanged)\n       |\n       v\n  [Thread pool / async]  <-- instrumented: carries context across threads\n       |\n       v\n  [Storage client]       <-- instrumented: creates leaf span',
          label: 'Applications are unaware of tracing; shared libraries do all the work',
        },
        {
          type: 'quote',
          text: 'We were able to limit our instrumentation to a small set of common libraries, effectively achieving a monitoring platform that is nearly zero-cost to the average application developer.',
          attribution: 'Sigelman et al., Dapper (2010), Section 3.2',
        },
        'The second insight is that sampling makes the cost manageable. Not every request needs a trace. A uniform random sample of 1 in 1,024 requests gives enough data for latency profiles, dependency graphs, and baseline understanding. Rare failures get covered by tail-biased sampling (keep traces with errors or high latency) or forced debug traces (a developer manually marks one request for full capture). The combination of automatic instrumentation and adaptive sampling is what lets tracing exist as always-on infrastructure rather than an opt-in debugging tool.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Dapper defines three core data objects: traces, spans, and annotations.',
        {
          type: 'table',
          headers: ['Object', 'Fields', 'Purpose'],
          rows: [
            ['Trace', 'traceId (64-bit)', 'Groups all spans belonging to one request into a single tree'],
            ['Span', 'spanId, parentSpanId, traceId, serviceName, startTime, endTime', 'Records one timed operation; parent reference builds the tree'],
            ['Annotation', 'timestamp, message (e.g. "cache miss", "retry #2")', 'Attaches structured events to a span without changing the tree shape'],
          ],
        },
        'When a request arrives at the frontend, the RPC library checks for incoming trace context. If none exists, it generates a new traceId and creates the root span. When the frontend calls downstream services, the RPC client library injects the traceId and the current spanId (as parentSpanId) into the outgoing request headers. Each downstream service extracts this context and creates a child span linked to the same trace.',
        {
          type: 'code',
          language: 'text',
          text: 'Trace context propagation through HTTP headers:\n\nFrontend -> Auth service:\n  X-Trace-Id: 7f000001a2b3c4d5\n  X-Parent-Span-Id: 0000000000000001\n  X-Span-Id: 0000000000000002\n  X-Sampled: 1\n\nFrontend -> Search service:\n  X-Trace-Id: 7f000001a2b3c4d5      (same trace)\n  X-Parent-Span-Id: 0000000000000001  (same parent: frontend)\n  X-Span-Id: 0000000000000003         (new span)\n  X-Sampled: 1\n\nSearch -> Index shard:\n  X-Trace-Id: 7f000001a2b3c4d5      (same trace)\n  X-Parent-Span-Id: 0000000000000003  (parent: search)\n  X-Span-Id: 0000000000000004         (new span)\n  X-Sampled: 1',
        },
        'Each service writes its completed span to a local log daemon. The daemon buffers spans and ships them asynchronously to a centralized collector -- Dapper used Google\'s Bigtable. The collector groups spans by traceId and reconstructs the tree by following parentSpanId references. Crucially, span emission is asynchronous and out-of-band; it does not add latency to the request path.',
        {
          type: 'diagram',
          text: 'Span collection pipeline:\n\n  Service A        Service B        Service C\n    |                 |                 |\n  [span log]       [span log]       [span log]\n    |                 |                 |\n  local daemon     local daemon     local daemon\n    \\                |                /\n     \\               |               /\n      v              v              v\n        Centralized Collector (Bigtable)\n              |\n        [group by traceId]\n              |\n        Reconstructed trace tree\n              |\n        Dapper UI / analysis tools',
          label: 'Spans travel out-of-band to avoid adding latency to the request',
        },
        'Sampling decides at the root span whether to keep a trace. All downstream services honor the sampling decision from the root (the X-Sampled header). This ensures that a sampled trace is complete -- you never get half a tree because one service decided to sample and another did not.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Three properties make Dapper effective as fleet-wide infrastructure.',
        {
          type: 'bullets',
          items: [
            'Transparency: application developers do not write tracing code. The shared RPC and threading libraries handle context propagation and span creation. Dapper deployed across Google\'s fleet by updating common libraries, not by filing tickets with every team.',
            'Low overhead: span creation adds microseconds to each RPC. Span emission is asynchronous -- buffered locally, shipped in batches. Sampling reduces the volume to a fraction of requests. The Dapper paper measured runtime overhead at less than 0.01% for most services.',
            'Coherent sampling: the sampling decision propagates with the trace context. Every service in a sampled trace emits its spans. Every service in an unsampled trace emits nothing. This avoids partial trees that mislead analysis.',
          ],
        },
        'Traces answer the question that metrics and logs answer poorly: what is the causal shape of one request? Metrics aggregate across requests. Logs narrate one service\'s local events. Traces connect operations across service boundaries into a single directed graph with timing.',
        {
          type: 'note',
          text: 'Dapper\'s design choice to instrument common libraries rather than application code is an instance of a broader principle: infrastructure that requires voluntary adoption will always have gaps in coverage. Infrastructure that rides on mandatory shared libraries gets coverage by default. The same principle appears in garbage collectors, memory allocators, and kernel-level security hooks.',
        },
        'The most important engineering principle is that tracing must be cheap enough to leave on permanently. A tracing system that engineers enable only after an incident begins misses the baseline behavior and often misses the first failure. Dapper made always-on operation a first-class design requirement by keeping overhead below the threshold where anyone would complain about it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost dimension', 'What grows', 'What stays bounded', 'What controls it'],
          rows: [
            ['CPU per request', 'Context extraction + span creation: ~1 us per span', 'Fixed per service hop', 'Library-level fast path; no allocation on unsampled requests'],
            ['Network', 'Span log volume = sampled_requests x spans_per_trace x bytes_per_span', 'Proportional to sample rate', 'Sampling rate (e.g. 1/1024)'],
            ['Storage', 'Bigtable rows for span records', 'Bounded by retention window', 'Retention policy (hours to days)'],
            ['Collector capacity', 'Scales with ingested span volume', 'Proportional to sample rate x fleet RPS', 'Horizontal scaling of collector daemons'],
            ['Analysis latency', 'Trace reconstruction from scattered spans', 'O(spans per trace), typically < 100', 'Index on traceId; spans are small'],
          ],
        },
        'The key cost insight: doubling the fleet\'s request rate doubles the raw span volume, but the sample rate can stay constant. If you sample 1 in 1,024 requests, doubling traffic doubles sampled traces too -- but you can also double the sampling denominator to keep storage flat while still having enough traces for statistical analysis. The tradeoff is between coverage completeness and storage budget.',
        {
          type: 'note',
          text: 'Dapper reported that at a 1/1024 sampling rate, Google was able to capture enough traces for latency analysis and dependency mapping across most services. High-traffic services produced thousands of sampled traces per minute even at that rate. Low-traffic services (fewer than 1,024 requests per minute) needed higher sampling rates or would have gaps in coverage.',
        },
        'Per-span overhead matters at scale. A span with 5 bounded annotations at ~200 bytes total generates 200 bytes of log data. A trace with 20 spans generates 4 KB. At 1,000 sampled traces per second, that is 4 MB/s of collector ingest -- manageable for a Bigtable cluster. At full capture (no sampling) on a fleet doing 10 million RPS with 20 spans per trace, the raw rate would be 40 GB/s of span data. Sampling is not optional.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A user search request enters the frontend. We trace its path to find a latency bottleneck.',
        {
          type: 'diagram',
          text: 'Step 1: User sends HTTP GET /search?q=restaurants\n  Frontend creates root span:\n    traceId: 0x7f00a2b3  spanId: 0x01  parent: none\n    start: t=0ms\n\nStep 2: Frontend calls auth, search, ads in parallel\n  Auth span:   traceId: 0x7f00a2b3  spanId: 0x02  parent: 0x01  start: t=2ms\n  Search span: traceId: 0x7f00a2b3  spanId: 0x03  parent: 0x01  start: t=2ms\n  Ads span:    traceId: 0x7f00a2b3  spanId: 0x05  parent: 0x01  start: t=3ms\n\nStep 3: Search fans out to index shard\n  Index span:  traceId: 0x7f00a2b3  spanId: 0x04  parent: 0x03  start: t=15ms\n\nStep 4: Spans complete with end times\n  Auth:   end: t=20ms   duration: 18ms\n  Ads:    end: t=38ms   duration: 35ms\n  Index:  end: t=145ms  duration: 130ms\n  Search: end: t=147ms  duration: 145ms  (waited for index)\n  Root:   end: t=180ms  duration: 180ms',
          label: 'All five spans share traceId 0x7f00a2b3; parentSpanId builds the tree',
        },
        {
          type: 'code',
          language: 'javascript',
          text: '// Reconstructing the span tree from collected spans\nconst spans = [\n  { spanId: "01", parent: null,  service: "frontend",    duration: 180 },\n  { spanId: "02", parent: "01",  service: "auth",         duration: 18  },\n  { spanId: "03", parent: "01",  service: "search",       duration: 145 },\n  { spanId: "04", parent: "03",  service: "index shard",  duration: 130 },\n  { spanId: "05", parent: "01",  service: "ads",          duration: 35  },\n];\n\n// Build tree: group children under parents\nconst tree = {};\nfor (const span of spans) {\n  tree[span.spanId] = { ...span, children: [] };\n}\nfor (const span of spans) {\n  if (span.parent) tree[span.parent].children.push(tree[span.spanId]);\n}\n\n// Critical path: root -> search -> index shard\n// 180ms total, 145ms in search, 130ms of that in index shard\n// Auth (18ms) and ads (35ms) ran in parallel and finished before search',
        },
        'The critical path is root -> search -> index shard. Auth and ads ran in parallel and finished long before search returned. Summing all child durations (18 + 145 + 35 = 198 ms) exceeds the root duration (180 ms) because auth and ads overlapped with search. The span tree reveals that the index shard is the bottleneck -- 130 ms out of 180 ms total. Without tracing, the frontend team sees a 180 ms request and has no idea which downstream service to investigate.',
        {
          type: 'note',
          text: 'Critical path analysis is the primary use of a span tree. Summing child durations is wrong because parallel children overlap. The critical path is the longest sequential chain of spans from root to leaf. In this example: frontend (2 ms setup) + search (2 ms setup) + index shard (130 ms work) + search (2 ms teardown) + frontend (2 ms teardown) ~ 138 ms on the critical path, with 42 ms of frontend overhead and serialization.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Why it happens', 'Mitigation'],
          rows: [
            ['Broken propagation', 'Trace tree is truncated; slow work is invisible', 'A queue, thread pool, or async framework drops context headers', 'Instrument context-aware queues; wrap executors to carry trace context across threads'],
            ['Sampling hides rare failures', 'Incident involves a request pattern not in any sampled trace', 'Head sampling decides before the request becomes interesting', 'Add tail-biased sampling for errors and high-latency outliers'],
            ['Clock skew', 'Child span appears to start before parent or end after parent', 'Machines have different clock offsets', 'Use monotonic clocks within a service; tolerate skew in cross-service views'],
            ['High-cardinality attributes', 'Storage and index costs explode', 'Spans record unbounded user IDs, raw URLs, or payload strings', 'Enforce bounded, typed, low-cardinality attributes'],
            ['Missing async work', 'Background jobs, retries, and delayed tasks are absent from traces', 'Async work happens after the request RPC returns', 'Context-aware job schedulers; link async spans to originating trace'],
          ],
        },
        'The most dangerous failure is invisible: broken propagation makes the trace look clean while hiding the slowest part of the request. An engineer sees a short, well-behaved trace and concludes nothing is wrong. The actual bottleneck was an async job that the trace could not follow because the queue consumer did not carry the trace context.',
        {
          type: 'bullets',
          items: [
            'A trace is not a profiler. It tells you a service call took 300 ms; it does not tell you which function burned CPU inside that service. Use traces to find the slow service, then use a profiler inside that service.',
            'A trace is not a metric. It shows one request, not the fleet-wide error rate. Traces and metrics are complementary: metrics tell you something is wrong; traces tell you why.',
            'A trace is sampled evidence, not ground truth. Absence of a trace does not prove absence of a problem. Serious analysis asks how the trace was sampled before drawing conclusions from it.',
            'Retries in traces are ambiguous. A dependency that shows two sequential calls might be slow, or the first call might have failed and been retried. The trace shows timing; interpreting retries requires annotations that mark the retry reason.',
          ],
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['System', 'How it uses Dapper-style tracing', 'Key design choice'],
          rows: [
            ['Google Dapper (2004+)', 'Fleet-wide production tracing via instrumented RPC libraries', '1/1024 head sampling; Bigtable storage; Dapper UI for trace browsing'],
            ['Twitter Zipkin (2012)', 'Open-source Dapper clone; Finagle RPC library instrumentation', 'Thrift-based span transport; Cassandra or Elasticsearch backend'],
            ['Uber Jaeger (2017)', 'Distributed tracing for microservices; OpenTracing-compatible', 'Adaptive sampling; Kafka span transport for high throughput'],
            ['OpenTelemetry (2019+)', 'Vendor-neutral SDK merging OpenTracing and OpenCensus', 'W3C Trace Context standard (traceparent header); OTLP protocol'],
            ['AWS X-Ray', 'Managed tracing for Lambda, API Gateway, ECS, EKS', 'Segment-based model; reservoir sampling; service map generation'],
          ],
        },
        {
          type: 'code',
          language: 'text',
          text: 'W3C Trace Context header format (OpenTelemetry standard):\n\ntraceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01\n             |   |                                |                  |\n          version |                            parent-id          flags\n              trace-id (128-bit)                                (sampled)\n\ntracestate: vendor1=value1,vendor2=value2\n            (vendor-specific propagation data)',
        },
        'The Dapper vocabulary now appears everywhere: traces, spans, context propagation, baggage, sampling, collectors, exporters, service graphs, and exemplars. The W3C Trace Context standard ensures that traces can cross vendor boundaries -- a request starting in an AWS Lambda can propagate context through an on-premises service instrumented with OpenTelemetry and into a Google Cloud Run function.',
        'The model extends beyond HTTP and RPC. Queues, streaming systems, batch jobs, workflow engines, serverless functions, CI pipelines, and AI agent systems all need causality across asynchronous steps. The more asynchronous the system, the more careful the propagation model must be. A trace that stops at the queue boundary is only half a trace.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Instrument boundary layers first: RPC clients and servers, HTTP middleware, queue producers and consumers, database client wrappers, cache clients, thread pool executors, and retry logic. Complete propagation across the system matters more than detailed spans inside one service.',
            'Keep attributes bounded, typed, and low-cardinality. Good attributes: http.method, http.status_code, db.system, rpc.service. Bad attributes: raw URL with query parameters, user email, request body hash. High-cardinality attributes explode storage and indexing costs.',
            'Honor the sampling decision from the root. If the root says "sampled," every downstream service must emit spans. If the root says "not sampled," no service should emit spans. Mixed decisions produce partial trees that mislead analysis.',
            'Emit spans asynchronously. Span data should be written to a local buffer and shipped out-of-band. Never block the request path waiting for span delivery to a collector. Span loss is acceptable; request latency is not.',
            'Build forced-trace capability for debugging. A developer should be able to set a header that forces full span capture for one specific request, regardless of the sampling policy. This is the escape hatch for debugging rare issues.',
          ],
        },
        {
          type: 'code',
          language: 'javascript',
          text: '// Minimal span data structure\nconst span = {\n  traceId:    "4bf92f3577b34da6a3ce929d0e0e4736",  // 128-bit, shared across trace\n  spanId:     "00f067aa0ba902b7",                    // 64-bit, unique to this span\n  parentId:   "b7ad6b7169203331",                    // 64-bit, links to parent span\n  name:       "GET /api/search",                     // operation name\n  service:    "search-service",                      // originating service\n  startTime:  1718000000000,                         // epoch microseconds\n  endTime:    1718000000145000,                      // epoch microseconds\n  status:     "OK",                                  // OK, ERROR, UNSET\n  attributes: {                                      // bounded key-value pairs\n    "http.method": "GET",\n    "http.status_code": 200,\n    "search.result_count": 42,\n  },\n  events: [                                          // timestamped annotations\n    { time: 1718000000012000, name: "cache.miss" },\n    { time: 1718000000015000, name: "index.fanout", attributes: { shard_count: 3 } },\n  ],\n};',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Sigelman et al., "Dapper, a Large-Scale Distributed Systems Tracing Infrastructure" (2010)', 'The original paper describing Google\'s design, instrumentation model, sampling strategy, and production deployment. https://research.google.com/archive/papers/dapper-2010-1.pdf'],
            ['W3C Trace Context Specification', 'The standard format for propagating trace context across HTTP boundaries, adopted by OpenTelemetry. https://www.w3.org/TR/trace-context/'],
            ['OpenTelemetry Documentation', 'The vendor-neutral observability framework that descended from Dapper\'s concepts via OpenTracing and OpenCensus. https://opentelemetry.io/docs/'],
            ['Zipkin Architecture Overview', 'Twitter\'s open-source Dapper implementation, showing how the same ideas map to a concrete open-source system. https://zipkin.io/pages/architecture.html'],
            ['Jaeger Documentation', 'Uber\'s distributed tracing system with adaptive sampling and Kafka-based span transport. https://www.jaegertracing.io/docs/'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Distributed Systems Basics and Trees to understand the service graph and span tree data structures that Dapper builds on.',
            'Complement: study Tail Latency and p99 Thinking to understand why percentile analysis on sampled trace data requires care, and how tail-biased sampling targets the requests that matter most.',
            'Extension: study t-digest Quantile Sketch for the data structure that summarizes latency distributions from sampled span durations without storing every individual value.',
            'System context: study Borg Cluster Scheduler Case Study to see the infrastructure layer that runs the services Dapper traces, and Circuit Breakers and Deadlines for the fault-tolerance patterns that generate the retries and timeouts visible in trace data.',
            'Contrast: study eBPF Ring Buffer Telemetry for a kernel-level observability approach that captures events without library instrumentation, trading application-level semantic context for zero-touch deployment.',
          ],
        },
      ],
    },
  ],
};

