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
    explanation: 'Dapper starts with a normal user request. In a microservice graph, one request can cross many teams, languages, machines, and datacenters. Without trace context, the slow path is just scattered logs.',
  };

  yield {
    state: requestGraph('Trace context travels through common libraries'),
    highlight: { active: ['frontend', 'auth', 'search', 'ads', 'e-front-auth', 'e-front-search', 'e-front-ads'], found: ['index', 'profile'] },
    explanation: 'The key engineering move is instrumentation at common RPC and threading libraries. The trace id and parent span id ride along ordinary calls, so most application code does not need hand-written tracing logic.',
    invariant: 'Every child span records the same trace id and a parent span id.',
  };

  yield {
    state: spanTable('The trace becomes a span tree'),
    highlight: { active: ['s0:service', 's1:parent', 's2:parent', 's3:parent'], found: ['s2:time', 's3:time'] },
    explanation: 'Collectors reconstruct a tree from span ids and parent ids. The frontend took 180 ms, but the child timing shows most of the delay sits under search, especially the index shard call.',
  };

  yield {
    state: requestGraph('Trace output identifies the bottleneck edge'),
    highlight: { found: ['search', 'index', 'e-search-index'], compare: ['auth', 'ads', 'profile'] },
    explanation: 'This is the operational payoff: Distributed Tracing turns a vague p99 complaint into a service edge and a shard family. It connects directly to Tail Latency & p99 Thinking, Circuit Breakers & Deadlines, and Load Shedding & Graceful Degradation.',
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
    explanation: 'Dapper emphasized low overhead and ubiquitous deployment. Sampling is what makes that possible: collect enough traces to understand behavior, but not so many that tracing becomes the outage.',
  };

  yield {
    state: spanTable('Analysis starts with critical path attribution'),
    highlight: { active: ['s0:time', 's2:time', 's3:time'], compare: ['s1:time', 's4:time'] },
    explanation: 'A trace is not just a list of calls. It is a timing graph. Parallel children should not be summed blindly; the critical path tells you which chain controls end-to-end latency.',
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
    explanation: 'The paper reports that Dapper evolved from a tracing tool into a monitoring platform. That is a useful product lesson: a well-designed event structure can support tools the original authors did not anticipate.',
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
    explanation: 'Tracing is only as good as its propagation contract. Message Queues, Web Workers, retries, and background jobs must preserve context or the most interesting part of the request disappears.',
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
      heading: 'What it is',
      paragraphs: [
        'Dapper is Google\'s large-scale distributed tracing infrastructure. It records sampled traces as trees of spans, where every span has timing, parent-child relationships, and service metadata. The goal is to make a request visible even when it crosses many services and machines.',
        'The case study matters because it is a systems-design lesson, not just an observability product. Low overhead, application-level transparency, sampling, and instrumentation in common libraries are the design choices that made tracing deployable at production scale.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A root span is created near the request entry point. Trace context propagates through RPC and threading libraries. Each service emits spans to collectors. Offline or nearline analysis reconstructs the span tree and exposes latency, dependency, and failure patterns.',
        'Sampling bounds overhead and storage. The paper emphasizes that broad deployment matters: a perfect trace for one service is less valuable than a mostly automatic trace that follows requests across the whole fleet.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Tracing costs CPU, storage, network bandwidth, schema discipline, and operational attention. High-cardinality tags can explode storage. Broken propagation makes traces misleading. Sampling can miss rare failures. Asynchronous work and queues need explicit context handling, otherwise child spans detach from the real request.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Dapper influenced Zipkin, Jaeger, OpenTelemetry, cloud tracing products, service maps, tail-latency dashboards, and incident forensics. It is the natural production companion to Circuit Breakers & Deadlines, Retries, Backoff & Jitter, Load Shedding & Graceful Degradation, and Feature Store pipelines.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A trace is not a profiler dump and it is not a replacement for metrics or logs. It answers path questions: which services did this request touch, where did time go, and what context crossed the boundary? Another misconception is that every request must be traced. At scale, thoughtful sampling is usually the thing that makes tracing possible.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google Research Dapper page at https://research.google.com/pubs/pub36356.html and the paper PDF at https://research.google.com/archive/papers/dapper-2010-1.pdf. Study Distributed Tracing, Tail Latency & p99 Thinking, Message Queues, Circuit Breakers & Deadlines, t-digest Quantile Sketch, and Borg Cluster Scheduler Case Study next.',
      ],
    },
  ],
};
