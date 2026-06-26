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
        'Read the animation as one request becoming a tree of timed operations. A trace is the whole request path, and a span is one timed operation inside that trace. Active nodes show the service or edge currently receiving trace context, found nodes show completed spans, and removed nodes show sampled-out requests or broken propagation.',
        'The safe inference rule is parent linkage. If every child span carries the same trace ID and the parent span ID that created it, the collector can rebuild the causal tree. If one queue, thread pool, or RPC boundary drops that context, the trace is no longer a complete explanation of the request.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Dapper exists because one user request in a large service system is not one event. It can pass through frontends, authentication, search, storage, caches, ad services, queues, retries, and shard fanout. Metrics show aggregate behavior, and logs show local events, but neither automatically explains where one request spent its time.',
        'The debugging question is concrete: where did the 180 ms go. In a monolith, a profiler can answer by walking one process. In a distributed system, the answer is scattered across machines owned by different teams, so the request needs a portable identity that follows it.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is correlated logging. Add a request ID to log lines, grep every service, sort by timestamp, and reconstruct the path by hand. This works in small systems when every team uses the same ID field and every boundary preserves it.',
        'The next obvious approach is to trace everything in detail. Record every request, every service hop, every annotation, and every payload field. That gives rich data until the fleet is large enough that tracing becomes the performance and storage problem.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is deployment economics plus causality. Tracing must be automatic enough to cover thousands of services, cheap enough to stay on, and complete enough to cross RPC, async, and queue boundaries. Correlated logs miss boundaries, while full capture creates too much data.',
        {
          type: 'callout',
          text: 'The wall is not technical complexity. It is deployment economics. Any team can build a tracer that works in a demo. The question Dapper answered is: how do you build a tracer that works across tens of thousands of services, stays on permanently, and costs so little that no one notices it?',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Google-IO-2008.jpg/800px-Google-IO-2008.jpg',
          alt: 'Google data center server racks',
          caption: 'At Google scale, a single user request touches dozens of services across thousands of machines. Full-detail tracing at this scale would generate petabytes per day. Dapper solved this with sampling and library-level instrumentation. Source: Wikimedia Commons.',
        },
        'A missing propagation edge makes the trace tree shorter than reality. The engineer may optimize the visible path while the real delay sits behind an untraced async boundary. That is worse than no trace because the partial tree looks authoritative.',
      ],
    },    {
      heading: 'The core insight',
      paragraphs: [
        'Instrument common libraries instead of asking every application team to write tracing code. RPC clients, RPC servers, HTTP middleware, queue clients, storage clients, thread pools, and retry wrappers are the boundaries where causality moves. If those layers create spans and propagate context, tracing becomes a platform property.',
        'The second insight is coherent sampling. The root decides whether the request is sampled, and that decision travels with the trace context. A sampled request should produce the whole tree, while an unsampled request should avoid span emission work on every service.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When a request enters the frontend, the tracing library creates a trace ID and a root span. When the frontend calls auth, search, or ads, the client library injects the trace ID and parent span ID into request metadata. Each downstream server extracts the metadata and creates a child span.',
        'A completed span records span ID, parent span ID, service name, operation name, start time, end time, status, and annotations such as cache miss or retry. Services write spans to local buffers, and background daemons ship them to collectors. The request path does not wait for the collector, because tracing must not add user-visible latency.',
        'The collector groups spans by trace ID and rebuilds the tree by following parent IDs. Analysis tools then compute critical paths, service dependencies, fanout patterns, and latency distributions. Dapper stored trace data in Bigtable and exposed it to interactive tools and programmatic analysis.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that every span in one request shares the trace ID, and every non-root span names one parent. That is enough to rebuild the tree even if spans arrive out of order. Missing parents become visible as broken traces instead of hidden local log fragments.',
        'Library instrumentation works because shared infrastructure has higher coverage than voluntary application code. Updating an RPC library can add tracing to many services at once. Sampling works because common behavior can be learned from a small fraction of requests when the sample is coherent across the whole tree.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Tracing cost is dominated by spans. If a fleet handles 1,000,000 requests per second, a trace averages 20 spans, and each span averages 426 bytes, full capture emits about 8.5 GB per second, or about 734 TB per day. A 1 in 1,024 sample lowers that to about 8.3 MB per second, or about 717 GB per day.',
        {
          type: 'callout',
          text: 'The fundamental cost equation: ingest_bytes_per_sec = fleet_RPS x sample_rate x avg_spans_per_trace x bytes_per_span. Every variable except bytes_per_span grows with the system. Sampling is the only lever that keeps cost sublinear in traffic.',
        },
        'Cost changes behavior. A system that is too expensive to leave on will be disabled or sampled so aggressively that rare failures vanish. Dapper made low overhead a product requirement because tracing that starts after an incident misses the baseline and often misses the first failure.',
      ],
    },    {
      heading: 'Real-world uses',
      paragraphs: [
        'Dapper-style tracing is useful for microservices, RPC systems, serverless paths, queue workflows, streaming jobs, batch pipelines, CI systems, and agent workflows. The access pattern is a causal path that crosses ownership boundaries. Traces tell a team which dependency is on the critical path before the team opens a profiler inside that dependency.',
        'The same model appears in Zipkin, Jaeger, AWS X-Ray, and OpenTelemetry. W3C Trace Context standardized headers such as traceparent so trace context can cross vendor and service boundaries. Dapper supplied the vocabulary that later systems generalized: traces, spans, propagation, sampling, collectors, and service graphs.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Microservices-based_architecture.png/800px-Microservices-based_architecture.png',
          alt: 'Microservice architecture with interconnected services',
          caption: 'Modern microservice architectures create the exact debugging problem Dapper solved: a single request traverses dozens of services, and no single service has enough context to explain end-to-end behavior. Source: Wikimedia Commons.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Tracing fails when propagation breaks. A queue consumer, thread pool, retry library, or sidecar can drop context and hide the slow work. The resulting trace is worse than missing data because it can look complete.',
        'Head sampling misses rare failures because the sample decision is made before the request becomes interesting. Tail sampling can keep error and high-latency traces, but it needs buffering and later decision logic. High-cardinality attributes such as raw user IDs or full URLs can also explode storage and indexing costs.',
        'A trace is not a profiler or a metric. It can show that search took 145 ms and index shard work took 130 ms, but it cannot identify the CPU function inside the index service. Use traces to find the slow dependency, then use service-local tools to explain that dependency.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A search request enters the frontend at t = 0 ms. The frontend creates root span 01, then starts auth span 02 at t = 2 ms, search span 03 at t = 2 ms, and ads span 05 at t = 3 ms. Search calls an index shard as span 04 at t = 15 ms.',
        'The spans end at different times: auth at 20 ms, ads at 38 ms, index at 145 ms, search at 147 ms, and the root at 180 ms. Auth took 18 ms, ads took 35 ms, search took 145 ms, and the index shard consumed 130 ms inside search. The critical path is frontend -> search -> index shard, not the sum of every child duration.',
        {
          type: 'callout',
          text: 'The critical path is root -> search -> index shard. The index shard consumed 130 ms of the 180 ms total. Without tracing, the frontend team sees a slow request and has no idea which downstream service to investigate.',
        },
        'The child durations add to 18 + 145 + 35 = 198 ms, which is larger than the 180 ms root duration because the children ran in parallel. That is why summing spans is the wrong analysis. The trace tree shows the longest dependency chain, which is the only chain that can reduce end-to-end latency if optimized.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Sigelman et al., Dapper, a Large-Scale Distributed Systems Tracing Infrastructure, at https://research.google.com/archive/papers/dapper-2010-1.pdf, W3C Trace Context at https://www.w3.org/TR/trace-context/, OpenTelemetry docs at https://opentelemetry.io/docs/, Zipkin architecture at https://zipkin.io/pages/architecture.html, and Jaeger docs at https://www.jaegertracing.io/docs/. Then study tail latency, t-digest quantile sketches, eBPF telemetry, circuit breakers, deadlines, service meshes, and distributed logging.',
      ],
    },
  ],
};
