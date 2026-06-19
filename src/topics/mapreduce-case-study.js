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
        'The word-count view traces a three-document job through all three MapReduce phases. Active nodes are the stage currently executing. Found edges mark data that has reached its destination. Watch how records start organized by input split and end organized by key -- that reorganization is the shuffle, and it is where the real cost lives.',
        'The failure view removes a map worker mid-job. The removed node shows intermediate output that disappeared. The runtime response -- rerun the map from durable input -- is the core fault-tolerance mechanism. Active nodes are healthy tasks; found nodes are tasks whose output is committed.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'By 2003, Google needed to build a web index, count term frequencies, compute PageRank contributions, and run dozens of other batch jobs over petabytes stored across thousands of commodity machines. Each job was conceptually simple -- read records, extract facts, group by key, aggregate -- but every team was independently solving the same hard problems: splitting input, scheduling tasks near data, retrying failures, handling slow machines, and committing output atomically.',
        'Jeff Dean and Sanjay Ghemawat published "MapReduce: Simplified Data Processing on Large Clusters" (OSDI 2004) to factor out that repeated infrastructure. The programmer writes two functions: map (extract local facts from one input split) and reduce (combine all values for one key). The runtime owns everything else -- splitting, scheduling, data movement, retries, straggler mitigation, and output placement. Within a year, Google was running thousands of MapReduce jobs per day across clusters of commodity Linux machines.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is a single-machine script: read all the files, build a hash table of counts, write the result. For word count on 100 MB this takes seconds. For inverted-index construction on 100 GB it takes hours. For a web-scale crawl measured in petabytes, a single machine cannot even hold the intermediate data in memory, and a disk failure after 20 hours of work means starting over.',
        'The next attempt is ad-hoc distribution: partition input by hand, run scripts on multiple machines, collect partial results, merge them. This works until a machine fails, a network partition drops results, one partition is ten times larger than the others, or a slow machine holds up the final merge. Every team writes its own failure handling, its own data routing, its own output commit logic -- and every implementation has different bugs.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Ad-hoc distribution breaks at two points. First, fault tolerance: commodity clusters with thousands of machines see multiple disk and machine failures per day. If one worker dies and its partial output is lost, you need enough metadata to know which slice of input to recompute -- and the recomputed output must be identical if the rest of the pipeline already consumed some of it. Without deterministic re-execution over well-defined input splits, failure recovery is either impossible or requires expensive global checkpointing.',
        'Second, data movement: the interesting computation usually requires grouping records by key across all machines. An inverted index needs all occurrences of a term together. A log aggregation job needs all events for one user together. This global regrouping -- the shuffle -- involves sorting, partitioning, network transfer, and spill-to-disk. Getting it right once in a reusable runtime saves every team from reimplementing the hardest 80% of distributed batch processing.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Split the computation into two user functions with a structured data-movement boundary between them. Map operates on one input split and emits key/value pairs with no coordination. Reduce operates on one key and all its values with no knowledge of other keys. The shuffle between them is the only point of global coordination, and the runtime owns it entirely.',
        'This split gives the runtime three powers: it can schedule map tasks near data (data locality), it can retry any failed task by re-reading durable input (fault tolerance via re-execution), and it can launch backup copies of slow tasks (straggler mitigation). The user writes two simple functions; the runtime turns them into a reliable cluster job.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Phase 1 -- Map: the master splits input files (stored on GFS/HDFS) into M splits of 16-64 MB. It assigns each split to a worker, preferring machines that already hold a local replica of that block. Each map task reads its split, applies the user map function, and emits intermediate key/value pairs. The pairs are partitioned into R buckets (one per reducer) using hash(key) mod R and written to local disk.',
        'Phase 2 -- Shuffle and sort: when map tasks complete, the master notifies reducers of intermediate file locations. Each reducer fetches its partition from every mapper over the network, then sorts the fetched data by key. This sort groups all values for the same key together. The shuffle is the most network-intensive phase and often the bottleneck.',
        'Phase 3 -- Reduce: each reducer iterates over sorted key groups and calls the user reduce function once per key. For word count, reduce("cat", [1, 1]) writes "cat 2". Output goes to a final file on the distributed file system. With R reducers, the job produces R output files, each covering a disjoint key range.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Three documents: "cat sat" (split 1), "cat ran" (split 2), "dog sat" (split 3). Map phase: mapper 1 emits (cat,1) and (sat,1). Mapper 2 emits (cat,1) and (ran,1). Mapper 3 emits (dog,1) and (sat,1). Six pairs total, all produced independently with zero coordination.',
        'Shuffle with R=2 reducers and partition boundary at M: keys A-M go to reducer 0, keys N-Z go to reducer 1. Reducer 0 receives cat:[1,1] and dog:[1]. Reducer 1 receives ran:[1] and sat:[1,1]. Each reducer sorts its keys and iterates.',
        'Reduce: reducer 0 writes cat=2, dog=1 to part-0000. Reducer 1 writes ran=1, sat=2 to part-0001. Total network transfer: 6 key/value pairs shuffled. The map phase did the extraction locally; the shuffle paid the coordination cost once; the reduce phase produced the final answer without any reducer needing to know about another reducer\'s keys.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on two properties. First, map tasks are independent: each reads one input split and emits pairs with no side effects on other tasks. Any map task can be retried by re-reading its split from the durable file system, and the output is identical if the map function is deterministic. Second, the shuffle guarantees that all values for a given key arrive at exactly one reducer. Once that grouping is complete, each reduce call sees the full set of values for its key and can produce the correct final answer.',
        'Fault tolerance follows from re-execution rather than replication. Input data is already replicated on GFS/HDFS. Intermediate map output lives on local disk -- if the machine dies, the master marks those map tasks as incomplete and reschedules them. Reduce output is written atomically to the distributed file system. The system tolerates arbitrary worker failures without losing completed work, as long as user functions are deterministic.',
      ],
    },
    {
      heading: 'MapReduce versus SQL',
      paragraphs: [
        'SQL expresses the same word-count job as SELECT word, COUNT(*) FROM docs GROUP BY word. A query optimizer can choose join order, index usage, and parallelism strategy automatically. MapReduce is more general -- the map and reduce functions are arbitrary code, not declarative queries -- but harder to optimize because the runtime cannot inspect user functions to reorder or fuse stages.',
        'This tradeoff explains why Google later built Dremel (interactive SQL over columnar storage) and why Hive put a SQL layer on top of Hadoop MapReduce. For structured data with known schemas, SQL wins on expressiveness and optimization. For unstructured parsing, custom feature extraction, or multi-stage pipelines with arbitrary logic, MapReduce\'s generality earns its keep.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Map cost scales linearly with input size: M map tasks each process one split. Shuffle cost depends on the volume of intermediate data and the number of reducers: every mapper writes R local partitions, and every reducer fetches one partition from every mapper, so shuffle involves M x R file transfers. If mappers emit as much data as they read, the shuffle moves the entire dataset across the network.',
        'The dominant cost in practice is usually the shuffle. Disk I/O compounds the network cost: MapReduce writes all intermediate data to local disk before the shuffle reads it back. For a multi-stage pipeline (e.g., two MapReduce jobs chained), every stage boundary pays this disk-write-then-read tax. A 10-stage iterative algorithm writes and reads intermediate data 10 times. This disk I/O overhead is the single largest motivation for Spark\'s in-memory RDDs.',
        'Straggler handling adds a constant-factor cost: near job completion, the master launches backup copies of slow tasks. The Dean & Ghemawat paper reported that disabling backup execution increased job completion time by 44%. The cost is running duplicate work on a few tasks; the benefit is that job latency tracks the median machine, not the slowest.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Disk I/O between stages is the fatal tax. Every MapReduce stage materializes its full output to disk before the next stage can read it. For iterative algorithms like PageRank or k-means that need 10-100 passes over the same data, each iteration pays a full read-write cycle. This is why Spark replaced MapReduce at most organizations: RDDs keep intermediate data in memory across iterations, cutting per-iteration cost by 10-100x for iterative workloads.',
        'Key skew is the second failure mode. If one key (say a popular search term) has 100x more values than others, one reducer does 100x more work while the rest sit idle. The job completion time equals the slowest reducer. Combiners help (pre-aggregate on the map side), but they only work for associative, commutative reduce functions like sum and max -- not for joins or median.',
        'The programming model also cannot express streaming or low-latency workloads. MapReduce is batch: it reads all input, processes it, and writes all output. For event-at-a-time processing, exactly-once semantics over unbounded streams, or sub-second latency, you need Flink, Kafka Streams, or a similar streaming engine.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Google used MapReduce internally for web indexing (map: parse HTML and emit term/URL pairs; reduce: build inverted index per term), distributed grep (map: emit matching lines; reduce: identity), URL access frequency counting, reverse web-link graph construction, and machine learning feature extraction. The paper reports production clusters running thousands of jobs per day on thousands of machines.',
        'The evolution: Yahoo open-sourced Hadoop (2006), a Java reimplementation of MapReduce + GFS. Hadoop became the default big-data platform for a decade. Spark (2012, UC Berkeley) replaced Hadoop MapReduce for most workloads by keeping data in memory between stages -- the RDD abstraction eliminated the disk I/O tax for iterative and multi-stage jobs. Flink (2014) extended the model to streaming with event-time semantics and exactly-once guarantees. Google Dataflow (2015) unified batch and streaming under the Beam programming model.',
        'The MapReduce pattern persists even in systems that do not use the name. Spark\'s reduceByKey is map + shuffle + reduce. SQL GROUP BY is map (project columns) + shuffle (hash partition by group key) + reduce (aggregate). Every data warehouse query plan has a shuffle boundary somewhere.',
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        'Use the MapReduce mental model when the problem is batch, input is large, and the computation can be expressed as independent extraction followed by grouped aggregation. The one-sentence test: "map emits local facts, shuffle groups by key, reduce combines each group." If the job cannot be honestly described that way, another dataflow shape fits better.',
        'When performance surprises you, inspect the shuffle before rewriting the mapper. Measure shuffle bytes, spill counts, reducer skew, and straggler time. The user function is usually not the bottleneck -- data movement is.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Dean and Ghemawat, "MapReduce: Simplified Data Processing on Large Clusters," OSDI 2004 (https://research.google.com/archive/mapreduce-osdi04.pdf). This paper defined the model and reported production results from Google\'s clusters.',
        'Study Hash Table next -- the shuffle phase partitions keys by hash(key) mod R, and the reduce phase groups values by key, both operations that depend on understanding hash-based grouping. Study Merge Sort to understand the external sort that happens during the shuffle when intermediate data exceeds memory. Study Consistent Hashing to see how distributed systems partition data across nodes without a fixed partition count.',
        'For the evolution beyond MapReduce: study Spark RDDs (in-memory fault-tolerant datasets that eliminate the disk I/O tax), Apache Flink (streaming-first with event-time semantics), and Google Dataflow / Apache Beam (unified batch and streaming programming model).',
      ],
    },
  ],
};

