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
    explanation: 'MapReduce lets the user write two functions, map and reduce, while the runtime handles parallelization, data movement, retries, and scheduling. The input is split into chunks, and many map tasks process those chunks independently.',
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
    explanation: 'For word count, the map function reads text and emits one pair per token. The mapper does not need global knowledge. This is the same decomposition instinct as Message Queues and embarrassingly parallel data processing: isolate local work first.',
    invariant: 'Map tasks are independent until the shuffle groups by key.',
  };

  yield {
    state: pipelineGraph('Shuffle groups the same key together'),
    highlight: { active: ['shuffle', 'e-m1-shuffle', 'e-m2-shuffle', 'e-m3-shuffle'], found: ['e-shuffle-r1', 'e-shuffle-r2'] },
    explanation: 'The shuffle is the heart of the system. It partitions intermediate keys, sorts or groups them, and moves each key group to the right reducer. This is where network and disk pressure appear. MapReduce makes that pain a platform concern instead of every programmer hand-writing it.',
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
    explanation: 'The reducer sees one key and all its values. For word count it sums them. For web indexing, it might merge postings lists. For logs, it might aggregate counters. The pattern is simple, but the runtime scales it across huge fleets.',
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
    explanation: 'The paper matters because it turns failure into the normal case. If a worker dies, its map task is rerun. If a task is a straggler, the runtime can launch a backup copy and accept whichever finishes first. The user code stays small while the platform absorbs machine unreliability.',
  };

  yield {
    state: pipelineGraph('Failed map output is regenerated, not trusted'),
    highlight: { removed: ['m2', 'e-m2-shuffle'], active: ['m1', 'm3'], found: ['shuffle', 'r1', 'r2'] },
    explanation: 'Map outputs are intermediate. If a worker that produced map output disappears before reducers read it, the system reruns that map task. This is a batch cousin of Write-Ahead Log thinking: durable final outputs matter; transient intermediate state can be recomputed from source data.',
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
    explanation: 'The lesson is not that every job should be MapReduce. The lesson is that a narrow programming model can hide a massive distributed runtime. Spark, Flink, Beam, data warehouses, and ML feature pipelines inherit this split between user logic and platform scheduling.',
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
      heading: 'What it is',
      paragraphs: [
        'MapReduce is a programming model and runtime for large-scale batch data processing. Users write a map function that emits intermediate key/value pairs and a reduce function that merges all values for the same key. The system takes responsibility for splitting input, scheduling tasks, moving intermediate data, retrying failures, and writing final output.',
        'The paper is a classic because it made distributed computation approachable. Instead of asking every engineer to manage thousands of workers, network transfers, disk spills, retries, and stragglers, it forced jobs into a simple shape that the runtime could optimize and recover.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Input files are split into chunks. Map workers read chunks and emit key/value pairs. The runtime partitions intermediate keys, usually by hashing, so all values for a key land at the same reducer. Reducers process one grouped key at a time and write final output files.',
        'The hidden machinery is where the system design lives. The master tracks task state. It schedules map tasks near input data when possible. It records where intermediate map outputs live so reducers can fetch them. If a worker fails, completed map tasks on that worker may need to be rerun because their intermediate outputs were local to the failed machine.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Map and reduce code can be small, but the shuffle is expensive. It moves data across the network, writes to disk, sorts or groups keys, and can bottleneck on skewed keys. The runtime also has to manage stragglers, worker failures, duplicate execution, task metadata, and final output commit semantics.',
        'The computational complexity depends on the user function, but the systems complexity concentrates around I/O. This is why the MapReduce paper belongs beside Message Queues, Sharding & Partitioning, Load Balancer, Tail Latency & p99 Thinking, and Idempotency & Exactly-Once Delivery.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Google used MapReduce for indexing, log processing, machine learning data preparation, and large internal batch jobs. Hadoop popularized the model outside Google. Modern systems often move beyond the original two-stage API, but the bones remain: data-parallel tasks, shuffle boundaries, retryable work units, locality-aware scheduling, and runtime-managed fault tolerance.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'MapReduce is not a universal distributed programming model. Iterative algorithms, streaming workloads, low-latency queries, and highly interactive jobs can suffer under repeated batch shuffles. Another misconception is that the map and reduce functions are the hard part. In production, the hard part is often skew, retries, bad records, stragglers, output commit behavior, and debugging a job that ran across thousands of machines.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Dean and Ghemawat, "MapReduce: Simplified Data Processing on Large Clusters" at https://research.google.com/archive/mapreduce-osdi04.pdf. Study Message Queues, Sharding & Partitioning, Distributed Tracing, Write-Ahead Log (WAL), Tail Latency & p99 Thinking, and Feature Store: Offline/Online Consistency to see the same batch ideas in modern data platforms.',
      ],
    },
  ],
};
