// MapReduce case study: split input, run map tasks near data, shuffle by key,
// reduce grouped values, and re-execute failed work.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'mapreduce-case-study',
  title: 'MapReduce Case Study',
  category: 'Papers',
  summary: 'Google MapReduce as a systems pattern: map, shuffle, reduce, locality, straggler handling, and fault-tolerant batch jobs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['word count pipeline', 'failure and stragglers'], defaultValue: 'word count pipeline' },
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

function pipelineGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input files', x: 0.8, y: 4.0, note: 'GFS blocks' },
      { id: 'm1', label: 'map 1', x: 2.6, y: 2.2, note: 'local split' },
      { id: 'm2', label: 'map 2', x: 2.6, y: 4.0, note: 'local split' },
      { id: 'm3', label: 'map 3', x: 2.6, y: 5.8, note: 'local split' },
      { id: 'shuffle', label: 'shuffle', x: 4.7, y: 4.0, note: 'partition by key' },
      { id: 'r1', label: 'reduce A-M', x: 6.8, y: 3.0, note: 'group values' },
      { id: 'r2', label: 'reduce N-Z', x: 6.8, y: 5.0, note: 'group values' },
      { id: 'out', label: 'output', x: 8.7, y: 4.0, note: 'files' },
    ],
    edges: [
      { id: 'e-input-m1', from: 'input', to: 'm1', weight: 'split' },
      { id: 'e-input-m2', from: 'input', to: 'm2', weight: 'split' },
      { id: 'e-input-m3', from: 'input', to: 'm3', weight: 'split' },
      { id: 'e-m1-shuffle', from: 'm1', to: 'shuffle', weight: 'key/value' },
      { id: 'e-m2-shuffle', from: 'm2', to: 'shuffle', weight: 'key/value' },
      { id: 'e-m3-shuffle', from: 'm3', to: 'shuffle', weight: 'key/value' },
      { id: 'e-shuffle-r1', from: 'shuffle', to: 'r1', weight: 'A-M' },
      { id: 'e-shuffle-r2', from: 'shuffle', to: 'r2', weight: 'N-Z' },
      { id: 'e-r1-out', from: 'r1', to: 'out', weight: 'part-0000' },
      { id: 'e-r2-out', from: 'r2', to: 'out', weight: 'part-0001' },
    ],
  }, { title });
}

function* wordCountPipeline() {
  yield {
    state: pipelineGraph('MapReduce turns a batch job into stages'),
    highlight: { active: ['input', 'm1', 'm2', 'm3'] },
    explanation: 'The first graph shows the bargain: users write map and reduce logic, while the runtime owns splitting, scheduling, data movement, retries, and output. The map tasks can start independently because each one sees only its input split.',
  };

  yield {
    state: labelMatrix(
      'Map stage emits intermediate key/value pairs',
      [
        { id: 's1', label: 'split 1' },
        { id: 's2', label: 'split 2' },
        { id: 's3', label: 'split 3' },
      ],
      [
        { id: 'text', label: 'input text' },
        { id: 'emit1', label: 'emit' },
        { id: 'emit2', label: 'emit' },
      ],
      [
        ['cat sat', '(cat,1)', '(sat,1)'],
        ['cat ran', '(cat,1)', '(ran,1)'],
        ['dog sat', '(dog,1)', '(sat,1)'],
      ],
    ),
    highlight: { active: ['s1:emit1', 's1:emit2', 's2:emit1', 's3:emit2'] },
    explanation: 'The table shows the local part of the computation. Each mapper turns its split into key/value pairs without knowing the global counts. The job becomes distributed because the model delays global coordination until the shuffle.',
    invariant: 'Map tasks are independent until the shuffle groups by key.',
  };

  yield {
    state: pipelineGraph('Shuffle groups the same key together'),
    highlight: { active: ['shuffle', 'e-m1-shuffle', 'e-m2-shuffle', 'e-m3-shuffle'], found: ['e-shuffle-r1', 'e-shuffle-r2'] },
    explanation: 'The shuffle is the expensive middle. It partitions keys, groups values, spills and sorts data, and moves each group to the right reducer. MapReduce is valuable because every job does not have to reinvent this failure-prone data exchange.',
  };

  yield {
    state: labelMatrix(
      'Reduce stage merges values per key',
      [
        { id: 'cat', label: 'cat' },
        { id: 'dog', label: 'dog' },
        { id: 'ran', label: 'ran' },
        { id: 'sat', label: 'sat' },
      ],
      [
        { id: 'values', label: 'values' },
        { id: 'reduce', label: 'reduce result' },
        { id: 'output', label: 'output file' },
      ],
      [
        ['1,1', '2', 'part-0000'],
        ['1', '1', 'part-0000'],
        ['1', '1', 'part-0001'],
        ['1,1', '2', 'part-0001'],
      ],
    ),
    highlight: { found: ['cat:reduce', 'sat:reduce'], compare: ['cat:values', 'sat:values'] },
    explanation: 'The reducer row is where local facts become a global result per key. Word count sums integers, an indexer merges postings, and a log job aggregates counters. The user function is small; the runtime makes it fleet-sized.',
  };
}

function* failureAndStragglers() {
  yield {
    state: labelMatrix(
      'Task state is tracked by the master',
      [
        { id: 'm1', label: 'map 1' },
        { id: 'm2', label: 'map 2' },
        { id: 'm3', label: 'map 3' },
        { id: 'r1', label: 'reduce 1' },
      ],
      [
        { id: 'worker', label: 'worker' },
        { id: 'state', label: 'state' },
        { id: 'action', label: 'runtime action' },
      ],
      [
        ['W7', 'done', 'commit output'],
        ['W9', 'lost', 'rerun elsewhere'],
        ['W2', 'slow', 'launch backup'],
        ['W4', 'waiting', 'read map outputs'],
      ],
    ),
    highlight: { active: ['m2:state', 'm3:state'], found: ['m2:action', 'm3:action'] },
    explanation: 'The failure table is the systems lesson. Lost tasks are rerun, slow tasks can get backup copies, and the master tracks enough state to know what is done, lost, or waiting. User code stays small because the platform treats worker failure as routine.',
  };

  yield {
    state: pipelineGraph('Failed map output is regenerated, not trusted'),
    highlight: { removed: ['m2', 'e-m2-shuffle'], active: ['m1', 'm3'], found: ['shuffle', 'r1', 'r2'] },
    explanation: 'The removed map worker shows why intermediate output is different from final output. If local map output disappears before reducers fetch it, the runtime reruns the map from durable input instead of pretending the lost intermediate data was committed.',
    invariant: 'Re-execution is correct when map and reduce functions are deterministic over their inputs.',
  };

  yield {
    state: labelMatrix(
      'Why MapReduce became a system design template',
      [
        { id: 'locality', label: 'data locality' },
        { id: 'shuffle', label: 'shuffle' },
        { id: 'retry', label: 'retry' },
        { id: 'straggler', label: 'straggler' },
        { id: 'simple', label: 'simple API' },
      ],
      [
        { id: 'mechanism', label: 'mechanism' },
        { id: 'study', label: 'study link' },
      ],
      [
        ['schedule near input blocks', 'Load Balancer'],
        ['partition and group by key', 'Sharding & Partitioning'],
        ['rerun failed work', 'Idempotency & Exactly-Once Delivery'],
        ['backup execution', 'Tail Latency & p99 Thinking'],
        ['map and reduce only', 'Functional decomposition'],
      ],
    ),
    highlight: { active: ['shuffle:mechanism', 'retry:mechanism', 'straggler:mechanism'] },
    explanation: 'The final table is the reusable template: locality, shuffle, retry, straggler handling, and a narrow API. Spark, Flink, Beam, data warehouses, and ML pipelines changed the surface area, but kept the split between user logic and platform scheduling.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'word count pipeline') yield* wordCountPipeline();
  else if (view === 'failure and stragglers') yield* failureAndStragglers();
  else throw new InputError('Pick a MapReduce view.');
}

export const article = {
  sections: [
    {
      heading: 'The problem',
      paragraphs: [
        'Many batch jobs are easy to describe and hard to run at cluster scale. Count words, build an inverted index, aggregate logs, join records, or prepare features: the user logic may be only a few lines, but the system has to split input, place work near data, move intermediate records, survive worker failures, handle slow machines, and commit output without corruption.',
        'MapReduce matters because it turned that repeated systems work into a reusable runtime. The programmer writes a map function and a reduce function. The platform owns splitting, scheduling, shuffle, sorting, retries, straggler mitigation, and final output placement.',
      ],
    },
    {
      heading: 'Context',
      paragraphs: [
        'The original Google paper landed in an environment with huge files, commodity machines, frequent failures, and a distributed file system that already split data into blocks. That context explains the design. The model is not trying to express every distributed computation. It is trying to make a large class of batch jobs boring enough to run by the thousands.',
        'The constraint is also the power. By forcing work into map, shuffle, and reduce phases, the runtime can make strong assumptions. Map tasks are independent over input splits. Shuffle is the global grouping boundary. Reduce tasks own disjoint key ranges. If user functions are deterministic, lost work can be recomputed from durable input.',
      ],
    },
    {
      heading: 'Core insight and mechanism',
      paragraphs: [
        'A job starts by slicing input files into splits. Each map task reads one split and emits intermediate key/value pairs. The runtime partitions those pairs by key, writes them to local intermediate files, and tells reducers where to fetch their partitions. The shuffle then groups all values for the same key at the reducer that owns that key range.',
        'A reducer receives a key and an iterator over values. It writes final output files, usually one per reducer. The master tracks task state, worker leases, intermediate locations, progress, failures, and output commit status. The user sees a simple API because the master and workers carry the operational complexity.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For word count, each mapper reads text and emits pairs such as (cat, 1), (sat, 1), and (dog, 1). Those local facts are not the answer. The answer appears only after shuffle sends every cat value to the same reducer, every dog value to the same reducer, and so on.',
        'The reducer for cat receives [1, 1] and writes cat -> 2. The reducer for sat receives [1, 1] and writes sat -> 2. The important lesson is that the map stage avoids global coordination, then shuffle pays the coordination cost once in a structured way.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'In the word-count view, watch the job become less local at each stage. The first frame has independent map tasks. The table shows local emissions. The shuffle frame is the critical turn: records stop being organized by input split and start being organized by key. The reduce table then shows why grouping by key was necessary.',
        'In the failure and stragglers view, focus on durability. Input files and final output are durable. Intermediate map output is useful but disposable. If a worker holding map output dies before reducers fetch it, the runtime reruns the map. If a task is slow near the end of the job, backup execution can run a duplicate copy because finishing one copy is better than waiting for the slowest machine.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'MapReduce works because it puts a hard boundary between local extraction and global grouping. Before shuffle, work can be scheduled close to data and retried independently. During shuffle, the runtime pays the network and sorting cost once. After shuffle, each reducer owns a clean partition of the key space.',
        'It also works because re-execution is a recovery strategy. The system does not need to make every intermediate write globally durable. It needs durable input, deterministic user code, enough task metadata, and a way to regenerate lost intermediate partitions.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'The tradeoff is expressiveness for operational control. MapReduce is excellent for batch jobs that can be written as local transformation plus grouped aggregation. It is awkward for iterative machine learning, graph algorithms with many rounds, streaming pipelines, low-latency serving, and interactive queries where materializing repeated shuffle boundaries is too expensive.',
        'The other tradeoff is that the simple API can hide expensive data movement. A mapper that emits too much data or a key distribution with one hot key can make the shuffle dominate the job. The user code may look small while the cluster is spending most of its time sorting, spilling, fetching, and retrying intermediate records.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Production MapReduce jobs fail in ways that the toy examples do not show. Bad records crash deterministic code over and over. Skew sends most values to one reducer. Speculative execution duplicates side effects when user code writes outside the runtime output protocol. Retry storms can overload shared storage. A slow final reducer can hold the entire job hostage.',
        'Correctness depends on determinism and careful output commit behavior. If map or reduce functions read time, random values, mutable external state, or perform non-idempotent writes, re-execution can change the result. MapReduce gives a fault-tolerant skeleton, not permission to ignore side effects.',
      ],
    },
    {
      heading: 'Practical use',
      paragraphs: [
        'Use the MapReduce mental model when a job can be expressed as extract local facts, group by key, and combine values. Make map and reduce functions deterministic. Keep output commits inside the runtime protocol. Measure shuffle bytes, spill counts, reducer skew, and straggler time before optimizing the visible user function.',
        'Modern systems such as Hadoop, Spark, Flink, Beam, data warehouses, and feature pipelines changed the interface, but the same architecture keeps reappearing: data-parallel tasks, a shuffle boundary, retryable work units, locality-aware scheduling, and platform-managed fault tolerance.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'Measure input bytes, map output bytes, shuffle bytes, spill count, skew by key, reducer p99 time, failed task retries, speculative execution rate, and final output commit time. MapReduce jobs often look CPU-bound in user code until the shuffle and stragglers are measured.',
        'Make map and reduce functions deterministic and side-effect free. If a task can be retried, any external write inside that task can happen twice unless it goes through an idempotent protocol. The runtime can retry work; it cannot make arbitrary user side effects safe.',
        'Plan for hot keys. Combiners, salting, custom partitioners, or two-stage aggregation may be needed when one key receives most values. The programming model is simple, but key distribution decides whether the cluster is balanced.',
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        'Use the MapReduce mental model when the problem is batch, input is large, and the computation can be expressed as independent extraction followed by grouped aggregation.',
        'Avoid it for low-latency serving, repeated iterative algorithms, or workloads where every round depends tightly on the previous round. Modern systems may hide the API, but the shuffle boundary remains the cost to watch.',
        'The best first sketch is often one sentence: map emits local facts, shuffle groups facts by key, reduce combines each group. If the job cannot be honestly described that way, another dataflow shape may fit better.',
        'When performance surprises you, inspect the shuffle before rewriting the mapper. Skew, spill, and stragglers usually explain more pain than the pure user function.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Dean and Ghemawat, "MapReduce: Simplified Data Processing on Large Clusters" at https://research.google.com/archive/mapreduce-osdi04.pdf. Study Message Queues, Sharding & Partitioning, Distributed Tracing, Write-Ahead Log (WAL), Tail Latency & p99 Thinking, Spark RDD Case Study, Google Dataflow Case Study, and Feature Store: Offline/Online Consistency to see the same batch ideas in modern data platforms.',
      ],
    },
  ],
};
