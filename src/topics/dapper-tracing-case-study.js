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
      heading: 'The observability problem',
      paragraphs: [
        'Dapper exists because a single user request in a large service system is not really a single event. It is a path through frontends, RPC clients, caches, storage systems, authentication services, ad systems, search backends, queues, and retries. Each service may have logs. Each service may publish metrics. None of that automatically tells you what happened to one request as it crossed the whole graph.',
        'The basic debugging question is simple: where did the time go? In a monolith, a profiler or log stream may answer that question. In a distributed system, the answer may be split across dozens of machines and teams. A frontend sees a slow request. A backend sees normal p99. A cache sees a miss. A storage service sees a retry. The failure is in the path, not in any one dashboard.',
        'Dapper is important because it turned distributed tracing from a clever debugging trick into a fleet-wide infrastructure primitive. The hard part was not drawing a tree of spans. The hard part was making tracing cheap, automatic, sampled, and deployed through common libraries so enough requests were traceable to be useful.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The naive approach is to ask every team to log enough information to reconstruct request paths later. That fails because logs are local, schemas drift, identifiers are inconsistent, and asynchronous work breaks the chain. Even if every service logs a request ID, that ID has to survive RPC boundaries, queue handoffs, retries, thread pools, fanout, and background work. One missing propagation edge can make the trace look clean while hiding the slowest part of the request.',
        'Another naive approach is to trace everything in full detail. That fails on cost. A high-traffic fleet cannot afford to store every span, every attribute, and every event for every request forever. Tracing consumes CPU, memory, network bandwidth, collector capacity, storage, index budget, and human attention. A system that is too expensive gets sampled away, disabled, or ignored during normal operation, which means it is absent when the incident arrives.',
        'Dapper solves these problems by treating propagation and sampling as design requirements, not optional features. Broad, low-overhead coverage is more valuable than perfect manual traces in a few services. A trace that follows ordinary production requests through most of the stack is educational because it shows the real shape of the system.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A trace is the record of one request path. A span is one timed operation inside that path. A root span begins near the entry point. Child spans represent internal calls, storage requests, queue operations, or other units of work. Each span carries a trace ID, a span ID, a parent reference, timing information, and a bounded set of annotations or attributes.',
        'Trace context is the key mechanism. When a frontend calls a backend, the trace ID and parent span context travel with the RPC. When the backend calls storage, it creates another child span and propagates the same trace. Collectors later reconstruct the tree or directed acyclic graph from emitted span records. The resulting view lets engineers see critical path latency, fanout, retries, dependency edges, and error locations.',
        'The span tree is not just a pretty diagram. It is a data structure for causal debugging. Parent-child links say which operation produced which downstream operation. Start and end times show overlap. Metadata marks endpoints, status codes, request sizes, cache decisions, shard names, or retry attempts. A good trace lets you distinguish one slow child from many modest children, a backend delay from a queue delay, and a local error from a downstream dependency failure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Sampling is not an afterthought. It is the reason tracing can exist in production. Head sampling decides near the start of a request whether to keep the trace. That is cheap, but it may miss rare failures because the decision happens before the request becomes interesting. Tail sampling waits until more information is known, such as latency or error status, then keeps traces that match useful criteria. That is more informative but requires buffering and more collector logic.',
        'Dapper emphasized low overhead and broad deployment, so sampling had to fit the fleet. The useful lesson is restraint. The goal is not to capture every possible event. The goal is to capture enough representative behavior to understand the system and enough exceptional behavior to debug incidents. Production tracing is a budgeted measurement system.',
        'Sampling also changes how traces should be interpreted. If only a fraction of requests are kept, absence of a trace does not prove absence of a problem. Rare bugs may need forced sampling, debug flags, tail policies, or targeted instrumentation. Trace data is evidence, but it has a collection process. Serious analysis asks how the trace was sampled before drawing conclusions from it.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Dapper works because it instruments common paths instead of depending only on application authors. RPC libraries, thread pools, clients, and frameworks are the places where context crosses boundaries. If those layers carry trace IDs automatically, the system can trace requests through many services without every developer hand-writing propagation logic.',
        'It also works because traces answer a question that metrics and logs answer poorly. Metrics aggregate. Logs narrate local events. Traces connect operations across service boundaries. In an incident, you often need all three. Metrics tell you latency rose. Logs show error messages. Traces show that slow requests fan out to one dependency, wait behind one queue, or retry against one shard.',
        'The most important design principle is that tracing must be cheap enough to leave on. A tracing system that engineers enable only after an incident begins misses the baseline and often misses the first failure. Dapper made deployability a central technical property: low overhead, sampling, transparency, and centralized collection are what made the data useful.',
      ],
    },
    {
      heading: 'Where the idea travels',
      paragraphs: [
        'Dapper influenced Zipkin, Jaeger, OpenCensus, OpenTracing, OpenTelemetry, cloud tracing products, service maps, latency dashboards, and incident workflows. The vocabulary now appears everywhere: traces, spans, context propagation, baggage, sampling, collectors, exporters, service graphs, and exemplars.',
        'The idea is most useful when requests cross ownership boundaries. If one team owns the entire code path, local profiling may be enough. If a request crosses ten teams, tracing becomes a shared evidence layer. It reduces the argument from "my service looks fine" to "this request spent 430 ms waiting on this downstream call after this retry." That does not solve the incident by itself, but it makes the next question concrete.',
        'The model also applies beyond HTTP and RPC. Queues, streaming systems, batch jobs, workflow engines, serverless functions, CI pipelines, and agent systems all need causality across asynchronous steps. The more asynchronous the system, the more careful the propagation model must be. A trace that stops at the queue boundary is only half a trace.',
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        'Broken propagation is the classic failure. The trace appears to show a short request because the slow asynchronous work is missing. High-cardinality attributes are another common mistake. If every span records unbounded user IDs, raw URLs, or unique payload strings, storage and index costs explode. The system becomes expensive before it becomes useful.',
        'Sampling can hide rare failures. Clock skew can distort timing. Retries can make a dependency look slow when the real issue is an upstream timeout policy. Excessive span detail can bury the critical path. Too little detail can make every trace a generic service map. A trace is an observation, not ground truth. It must be interpreted with knowledge of instrumentation gaps and sampling rules.',
        'A trace is also not a profiler. It tells you that a call to a service took 300 ms; it usually does not tell you which line of code burned CPU inside that service. It is not a replacement for metrics because it does not summarize fleet-wide rates by itself. It is not a replacement for logs because it does not preserve every local event. The educational value is knowing which question each tool answers.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Instrument the boundary layers first: RPC, HTTP, queues, database clients, caches, async tasks, thread pools, retries, and workflow steps. Keep attributes bounded, typed, and boring. Prefer complete propagation through the system over exquisite detail in one service. A trace with missing edges teaches the wrong lesson.',
        'During an incident, start with the critical path and fanout shape. A slow root span with many parallel children means something different from a single child that dominates latency. Compare successful and failed traces. Look for retries, queue waits, regional hops, cache misses, and one shard or dependency that appears only in the slow examples.',
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Dapper is not important because it invented a tree diagram. It is important because it made distributed causality observable at fleet scale. The system worked by combining context propagation, automatic instrumentation, bounded sampling, and centralized analysis.',
        'The deep lesson is that observability has algorithms and data structures inside it. Trace IDs propagate. Spans form a causal graph. Samplers choose which evidence survives. Collectors reconstruct partial truth under cost limits. A good engineer reads a trace as sampled, instrumented evidence, not as a perfect recording of reality.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Google Research Dapper page at https://research.google.com/pubs/pub36356.html and the paper PDF at https://research.google.com/archive/papers/dapper-2010-1.pdf. Study Distributed Tracing, Tail Latency & p99 Thinking, Message Queues, Circuit Breakers & Deadlines, t-digest Quantile Sketch, OpenTelemetry concepts, and Borg Cluster Scheduler Case Study next.',
      ],
    },
      {
      heading: 'Why this exists',
      paragraphs: [
        "State the real constraint this topic fixes before introducing the mechanism.",
        "A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.",
        "Without that, every optimization appears decorative.",
      ],
    },

    {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Cost and behavior',
      paragraphs: [
        "Cost is both asymptotic and practical.",
        "State what grows, what stays flat, and what setup cost dominates before the method becomes useful.",
        "If possible, convert cost into an intuition: doubling, halving, or crossing a fixed bound.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Dapper Tracing Case Study moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

