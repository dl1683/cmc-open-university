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
      heading: 'How to read the animation',
      paragraphs: [
        'The word-count view shows a batch job, which means a job that reads a finite input and writes a finite output. Active nodes are doing work now. Found edges show records that have reached the next phase. Watch how documents start grouped by file but finish grouped by word; that regrouping is the shuffle.',
        {type:'callout', text:'MapReduce scales batch work by making user code local and moving all global coordination into the shuffle boundary.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/b/b6/MapReduce.svg', alt:'Diagram of input key-value pairs flowing through map tasks, shuffle, reduce tasks, and output.', caption:'MapReduce execution diagram by Joseba Alberdi, Wikimedia Commons, CC BY-SA 3.0 / GFDL.'},
        'The failure view kills a worker after it has produced temporary output. The safe inference is that lost map output can be rebuilt from durable input. Found tasks are committed tasks; active tasks are currently running or being retried.'
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'MapReduce exists because many large batch jobs have the same shape: read a huge collection of records, extract local facts, group the facts by key, and combine each group. A key is the field used for grouping, such as a word in word count or a URL in web indexing. The hard part is not the word-count function; it is doing that work across thousands of machines while some fail.',
        'Before MapReduce, every team that wanted this pattern had to solve splitting, scheduling, data movement, retry, slow-worker handling, and output commit. The 2004 Google paper made those concerns the runtime contract. The programmer writes map and reduce functions; the system owns the cluster behavior.'
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a single script. It opens every file, stores counts in a hash table, and writes the result. This is reasonable for 100 MB and still understandable for 10 GB if the machine has enough disk and time.',
        'The next obvious approach is to run that script on many partitions and merge the partial files later. That works while partitions are balanced and machines stay alive. It stops being a system when every job has its own retry rules and its own broken merge step.'
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is global grouping. A mapper can count words inside one file, but the final count for cat needs every cat count from every file. That forces a network and disk phase where records move from file ownership to key ownership.',
        'Failure is the other wall. In a large commodity cluster, a worker can die after producing temporary data but before the job finishes. Unless the runtime knows exactly which input split created that data, recovery becomes guesswork or full restart.'
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate local extraction from global grouping. Map reads one input split and emits key-value pairs without coordinating with other map tasks. Reduce receives one key and all values for that key. The shuffle is the only required global handoff.',
        'That boundary gives the runtime freedom. It can run map tasks near the input blocks, retry failed tasks from durable input, sort intermediate records by key, and send each key group to one reducer. The user code stays simple because the hard distributed behavior is standardized.'
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Input files are divided into splits. The master schedules one map task per split, preferably on a worker that already stores the block. Each map task emits intermediate pairs such as cat,1 or url,anchor_text.',
        'The runtime partitions each intermediate pair by reducer, often using hash(key) mod R where R is the number of reducers. Reducers fetch their partitions from every mapper, sort by key, and call reduce once per key. Output is committed as one file per reducer in the distributed file system.',
        'Slow workers are handled with backup execution near the end of the job. If a task is much slower than its peers, the master may start a duplicate copy elsewhere and keep the first copy that finishes. This spends extra work to avoid letting one slow machine hold the whole job.'
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is grouping completeness. Every input record is assigned to exactly one map task. Every intermediate pair emitted by that map task is assigned to exactly one reducer partition. Therefore all values for a key reach the same reduce call.',
        'Recovery works because map output is derived, not authoritative. If a worker loses intermediate files, the master reruns the map task from the original input split. Deterministic map and reduce functions make the recomputed pairs equivalent to the lost ones.'
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Map work is linear in input bytes. If input doubles and the split size stays fixed, the number of map tasks roughly doubles. Reduce work is linear in the number of intermediate values assigned to each reducer.',
        'The expensive behavior is the shuffle. With M mappers and R reducers, each mapper creates R partitions, so the system manages up to M times R intermediate transfer relationships. If 2 TB of input produces 1.5 TB of intermediate pairs, the network and disk system must move and sort about 1.5 TB before reducers can finish.',
        'Memory is not the main storage contract. Intermediate data spills to local disk, and final output lands in the distributed file system. That makes the model robust but slow for multi-stage and iterative jobs because each stage materializes data before the next one starts.'
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MapReduce fits web indexing, log aggregation, inverted-index construction, large joins, distributed grep, feature extraction, and offline reports. The common access pattern is many independent records that can be parsed locally before a grouped aggregation.',
        'The idea remains inside newer systems. SQL group by, Spark reduceByKey, and many warehouse execution plans still perform local projection, shuffle by key, and grouped aggregation. Newer engines changed memory use, latency, and APIs; they did not remove the need for shuffle boundaries.'
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MapReduce is weak for iterative algorithms because every round writes and reads full intermediate state. PageRank, k-means, and graph algorithms may need many passes over related data. Spark and Flink became popular because they can keep state in memory or treat streaming state as a first-class object.',
        'It also fails under key skew. If one word, user, or URL receives 100 times more values than other keys, one reducer becomes the job bottleneck. Combiners can reduce traffic for associative operations such as sum, but they do not solve arbitrary joins or medians.'
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose three documents contain cat sat, cat ran, and dog sat. The map phase emits six pairs: cat,1; sat,1; cat,1; ran,1; dog,1; sat,1. No mapper needs to know what the other mappers saw.',
        'Use two reducers. Keys A through M go to reducer 0, and N through Z go to reducer 1. Reducer 0 receives cat values [1,1] and dog [1]. Reducer 1 receives ran [1] and sat [1,1].',
        'The reducers output cat=2, dog=1, ran=1, and sat=2. The job paid six intermediate records of shuffle traffic. If the second mapper dies before reducers fetch its files, the runtime reruns only the split containing cat ran and regenerates cat,1 and ran,1.'
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Jeffrey Dean and Sanjay Ghemawat, MapReduce: Simplified Data Processing on Large Clusters, OSDI 2004, https://research.google.com/archive/mapreduce-osdi04.pdf. Study hash tables for key grouping, merge sort for external shuffle sorting, distributed file systems for durable input, and Spark RDDs for the in-memory response to MapReduce stage materialization.'
      ],
    },
  ],
};
