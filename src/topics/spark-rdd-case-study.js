// Spark RDD case study: immutable partitioned datasets, lineage-based recovery,
// caching, and the shift from disk-heavy batch jobs to reusable in-memory data.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'spark-rdd-case-study',
  title: 'Spark RDD Case Study',
  category: 'Papers',
  summary: 'Spark RDDs as the cluster-computing lesson: immutable partitions, lineage, caching, and recomputation instead of replication.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lineage and partitions', 'cache and recovery'], defaultValue: 'lineage and partitions' },
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

function lineageGraph(title) {
  return graphState({
    nodes: [
      { id: 'hdfs', label: 'HDFS blocks', x: 0.8, y: 4.0, note: 'input' },
      { id: 'rdd1', label: 'lines RDD', x: 2.7, y: 4.0, note: 'partitions' },
      { id: 'rdd2', label: 'errors RDD', x: 4.6, y: 2.4, note: 'filter' },
      { id: 'rdd3', label: 'pairs RDD', x: 4.6, y: 5.6, note: 'map' },
      { id: 'shuffle', label: 'shuffle', x: 6.4, y: 4.0, note: 'wide dep' },
      { id: 'rdd4', label: 'counts RDD', x: 8.3, y: 4.0, note: 'reduceByKey' },
      { id: 'driver', label: 'driver', x: 6.4, y: 7.2, note: 'DAG scheduler' },
    ],
    edges: [
      { id: 'e-hdfs-rdd1', from: 'hdfs', to: 'rdd1', weight: 'load' },
      { id: 'e-rdd1-rdd2', from: 'rdd1', to: 'rdd2', weight: 'narrow' },
      { id: 'e-rdd1-rdd3', from: 'rdd1', to: 'rdd3', weight: 'narrow' },
      { id: 'e-rdd2-shuffle', from: 'rdd2', to: 'shuffle', weight: 'partition' },
      { id: 'e-rdd3-shuffle', from: 'rdd3', to: 'shuffle', weight: 'partition' },
      { id: 'e-shuffle-rdd4', from: 'shuffle', to: 'rdd4', weight: 'wide' },
      { id: 'e-driver-shuffle', from: 'driver', to: 'shuffle', weight: 'stages' },
    ],
  }, { title });
}

function* lineageAndPartitions() {
  yield {
    state: lineageGraph('An RDD is data plus how to recompute it'),
    highlight: { active: ['rdd1', 'rdd2', 'rdd3'], found: ['e-rdd1-rdd2', 'e-rdd1-rdd3'] },
    explanation: 'An RDD is data plus a recipe. The collection is split into partitions, and transformations add lineage edges instead of eagerly copying every intermediate result around the cluster.',
  };

  yield {
    state: labelMatrix(
      'An RDD record contains more than values',
      [
        { id: 'parts', label: 'partitions' },
        { id: 'deps', label: 'dependencies' },
        { id: 'compute', label: 'compute function' },
        { id: 'placement', label: 'preferred locations' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['split work', 'parallel tasks'],
        ['parent RDDs', 'lineage recovery'],
        ['derive one partition', 'lazy execution'],
        ['data locality', 'avoid network reads'],
      ],
    ),
    highlight: { found: ['deps:why', 'compute:why'], active: ['placement:why'] },
    explanation: 'This table is the real RDD record. Partitions split work, dependencies form the recovery graph, compute functions rebuild partitions, and preferred locations keep tasks near data.',
    invariant: 'Immutability makes lineage safe: lost partitions can be rebuilt without coordinating updates in place.',
  };

  yield {
    state: lineageGraph('Narrow dependencies pipeline; wide dependencies shuffle'),
    highlight: { active: ['e-rdd1-rdd2', 'e-rdd1-rdd3'], compare: ['shuffle', 'e-shuffle-rdd4'] },
    explanation: 'Read the edges as dependencies. Map and filter are narrow, so tasks can pipeline locally. reduceByKey is wide, so many parents feed many children and Spark has to insert a shuffle boundary.',
  };

  yield {
    state: labelMatrix(
      'Why Spark beat repeated MapReduce for some workloads',
      [
        { id: 'iterative', label: 'iterative ML' },
        { id: 'interactive', label: 'ad-hoc queries' },
        { id: 'batch', label: 'one-pass ETL' },
        { id: 'graph', label: 'graph algorithms' },
      ],
      [
        { id: 'pain_before', label: 'MapReduce pain' },
        { id: 'rdd_answer', label: 'RDD answer' },
      ],
      [
        ['write every iteration', 'cache working set'],
        ['reload data each query', 'persist in memory'],
        ['often fine', 'pipeline tasks'],
        ['repeat over graph', 'reuse partitions'],
      ],
    ),
    highlight: { found: ['iterative:rdd_answer', 'interactive:rdd_answer', 'graph:rdd_answer'], compare: ['batch:rdd_answer'] },
    explanation: 'Spark did not make all batch work faster by magic. It targeted workloads where reuse mattered: iterative algorithms, interactive exploration, and repeated passes over the same data.',
  };
}

function* cacheAndRecovery() {
  yield {
    state: lineageGraph('cache() turns expensive lineage into reusable memory'),
    highlight: { active: ['rdd2', 'rdd3', 'rdd4'], compare: ['hdfs'] },
    explanation: 'An RDD can be persisted in memory after first computation. Later actions reuse cached partitions instead of replaying the full input pipeline.',
  };

  yield {
    state: labelMatrix(
      'Worker loses one partition of counts RDD',
      [
        { id: 'detect', label: 'detect loss' },
        { id: 'trace', label: 'trace lineage' },
        { id: 'recompute', label: 'recompute partition' },
        { id: 'resume', label: 'resume action' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['scheduler notices missing block', 'metadata'],
        ['parents and shuffle files', 'DAG walk'],
        ['only lost partition if possible', 'localized work'],
        ['continue job', 'no full restart'],
      ],
    ),
    highlight: { active: ['trace:action', 'recompute:action'], found: ['resume:action'] },
    explanation: 'Fault tolerance comes from replaying the recipe. If one partition is lost, Spark traces lineage to rebuild the missing piece instead of restarting the whole job, as long as the recipe is deterministic and affordable.',
  };

  yield {
    state: labelMatrix(
      'Where the abstraction bends',
      [
        { id: 'immutable', label: 'immutable data' },
        { id: 'deterministic', label: 'deterministic compute' },
        { id: 'longlineage', label: 'long lineage' },
        { id: 'skew', label: 'skewed shuffle' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'pressure', label: 'pressure' },
      ],
      [
        ['simple recovery', 'copy-on-write mindset'],
        ['recompute safely', 'side effects forbidden'],
        ['needs checkpoint', 'DAG grows'],
        ['stragglers', 'tail latency'],
      ],
    ),
    highlight: { found: ['immutable:helps', 'deterministic:helps'], compare: ['longlineage:pressure', 'skew:pressure'] },
    explanation: 'The RDD abstraction is strongest when data is immutable and deterministic. It struggles when stateful mutation, skew, or very long lineage dominate.',
  };

  yield {
    state: labelMatrix(
      'Lineage as a general systems pattern',
      [
        { id: 'spark', label: 'Spark RDD' },
        { id: 'git', label: 'Git' },
        { id: 'db', label: 'database recovery' },
        { id: 'ray', label: 'Ray tasks' },
      ],
      [
        { id: 'keeps', label: 'keeps' },
        { id: 'recovers_by', label: 'recovers by' },
      ],
      [
        ['transformation DAG', 'recompute partition'],
        ['commit graph', 'checkout object graph'],
        ['WAL', 'redo/undo'],
        ['task graph/object refs', 'reschedule work'],
      ],
    ),
    highlight: { active: ['spark:keeps', 'ray:keeps'], compare: ['db:recovers_by'] },
    explanation: 'The general systems pattern is recipe versus replica. Spark keeps transformation lineage; databases keep logs; Ray keeps task/object dependencies. The right choice depends on whether recomputation is cheaper than eager copying.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lineage and partitions') yield* lineageAndPartitions();
  else if (view === 'cache and recovery') yield* cacheAndRecovery();
  else throw new InputError('Pick a Spark RDD view.');
}

export const article = {
  sections: [
    {
      heading: 'The cluster-computing problem',
      paragraphs: [
        'Spark RDDs, or Resilient Distributed Datasets, are immutable, partitioned, distributed collections with lineage. They were introduced to make in-memory reuse practical for cluster workloads such as iterative machine learning and interactive data mining. The problem was not that MapReduce could not process large data. The problem was that many important jobs reused the same working set repeatedly, and writing every stage to durable storage made those jobs slow.',
        'The RDD idea changed the fault-tolerance bargain. Instead of replicating every intermediate result or writing every stage to disk, Spark records how each partition can be recomputed. Cache the data that is worth keeping. If a partition is lost, use lineage to rebuild the missing piece. That is cheaper than up-front replication when transformations are deterministic and recomputation is not too expensive.',
      ],
    },
    {
      heading: 'The naive approaches and their limits',
      paragraphs: [
        'The first naive approach is to materialize every intermediate stage to stable storage. That gives fault tolerance, but it is slow for iterative jobs. A machine-learning algorithm may scan the same data dozens of times. An analyst may run several queries over the same filtered dataset. Rewriting and rereading the working set wastes IO.',
        'The second naive approach is to keep data in memory without a recovery story. That is fast until a node fails or memory pressure evicts data. A distributed system that cannot recover cached state is not reliable enough for large clusters.',
        'The third naive approach is to replicate every cached partition. That improves recovery but spends memory and network bandwidth before you know whether a partition will be lost. RDDs choose recomputation as the default recovery tool and use checkpointing or persistence selectively when recomputation becomes too expensive.',
      ],
    },
    {
      heading: 'Core insight and mechanism',
      paragraphs: [
        'Each RDD records several pieces of metadata: its partitions, its dependencies on parent RDDs, a function for computing each partition, and preferred locations. Transformations such as map and filter are lazy. They build a lineage DAG rather than immediately running. Actions such as count, collect, save, or reduce trigger scheduling.',
        'Dependencies are the key planning signal. A narrow dependency means each child partition depends on a small number of parent partitions. Those stages can often be pipelined. A wide dependency means many child partitions depend on many parent partitions, usually creating a shuffle boundary. Shuffles are expensive because data must be repartitioned across the cluster.',
        'cache() or persist() tells Spark to keep selected partitions in memory or another storage level. If a cached partition is lost, Spark traces lineage back to available parent data and recomputes only what is needed. Checkpointing can cut off long lineage by writing an RDD to reliable storage when recomputation would be too costly.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'RDDs work because many cluster workloads are deterministic transformations over partitions. If the system knows the recipe for a partition, it does not need to store redundant copies of every intermediate value. It can rebuild lost partitions from parents. This is lineage-based fault tolerance.',
        'They also work because immutability simplifies recovery. A partition is not mutated in place by arbitrary tasks. A new RDD is derived from parent RDDs. That makes the lineage graph meaningful and makes recomputation safe. Mutable distributed state is harder because recovery must reconstruct the exact sequence of updates.',
        'The design is strongest when reuse is high. Iterative algorithms, graph processing, and interactive exploration often read the same derived data repeatedly. Caching that working set can turn repeated disk scans into memory reads, while lineage preserves a recovery plan.',
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        'The RDD abstraction shaped Apache Spark, iterative ML workflows, graph processing, ad-hoc analytics, and later cluster execution engines. It connects MapReduce, Pregel, Ray, Delta Lake, feature stores, and parameter-server thinking because it asks the same question: what state should be materialized, and what state can be reconstructed from a recipe?',
        'RDDs are most useful when data is immutable, transformations are deterministic, and reuse is high. They are less natural for fine-grained mutable state, transactional updates, streaming event-time semantics, or workloads dominated by one large shuffle with little reuse.',
        'Spark later added higher-level APIs such as DataFrames and Spark SQL because raw RDDs hide structure from the optimizer. The original RDD lesson still matters, but many production workloads benefit from schemas, logical plans, predicate pushdown, and query optimization on top of the lineage engine.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Long lineage can become a liability. If an RDD depends on many stages and a late partition is lost, recomputation may be expensive. Checkpointing trims lineage at the cost of writing reliable data. The right checkpoint point is a cost decision: write too often and you waste IO; write too rarely and failures become painful.',
        'Shuffles are another major failure and cost boundary. A skewed key can send too much data to one reducer. Shuffle files can be lost. Network traffic can dominate execution time. A job that looks like a clean lineage graph can still perform poorly if one wide dependency creates a hot partition.',
        'Caching is not free. Memory pressure can evict partitions, serialization formats matter, and cached data may compete with execution memory. A cache call is a bet that reuse will justify storage. If the data is used once, caching may only add overhead.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'When reading a Spark job, identify partition count, narrow versus wide dependencies, cache points, shuffle boundaries, and checkpoint needs. Then ask whether recomputation is actually cheaper than replication for the expensive parts.',
        'Use RDDs as the conceptual base for Spark, but do not ignore higher-level APIs. DataFrames and Spark SQL add optimizer knowledge that raw RDD transformations often hide. The best educational path is to understand RDD lineage first, then see how structured execution builds on it.',
      ],
    },
    {
      heading: 'A worked recovery example',
      paragraphs: [
        'Suppose an RDD starts from HDFS blocks, filters records, maps them into feature vectors, and caches the result for an iterative algorithm. One worker loses cached partition 12. Spark does not need to rerun the entire job. It uses the lineage graph to find the parent partition, reruns the filter and map for that partition, and restores only the missing piece.',
        'Now suppose partition 12 depended on a wide shuffle from many parents. Recovery becomes more expensive because the missing output may need shuffle files or recomputation from many upstream partitions. This is why narrow and wide dependencies are not just scheduler vocabulary. They predict the cost of failure.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'An RDD is not just an array spread across machines. It is a partitioned immutable dataset plus lineage: enough information to compute each partition and recover it after failure. That lineage is the data structure that made in-memory cluster reuse practical.',
        'The deep lesson is that fault tolerance can come from recomputation, not only replication. That works when computations are deterministic, lineage is not too expensive, and the system knows when to checkpoint.',
        'The useful comparison is MapReduce. MapReduce writes durable boundaries between jobs. RDDs keep lineage and selectively cache working sets. That is why Spark fit iterative and interactive workloads better while still needing discipline around shuffles and checkpoints.',
        'In a course sequence, teach RDDs before DataFrames and query optimizers. Students should first understand lineage, partitioning, and shuffle boundaries; then structured APIs make sense as a way to give the optimizer more information.',
        'The practical test is whether lost state can be recomputed cheaply from a deterministic recipe. If recomputation is cheap, lineage is elegant. If recomputation crosses huge shuffles or nondeterministic side effects, materialization and checkpointing become necessary.',
        'RDDs are the wrong tool when the program needs many small mutable updates with low latency. A distributed key-value store, stream processor, or database may fit that shape better. RDDs shine when the work is partitioned, deterministic, and batch-oriented enough that lineage is a recovery advantage.',
        'The best mental shortcut is "recipe plus cache." The recipe explains recovery. The cache explains speed. Spark RDDs became powerful because they kept both ideas visible to the scheduler.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: USENIX NSDI paper PDF at https://www.usenix.org/system/files/conference/nsdi12/nsdi12-final138.pdf, USENIX page at https://www.usenix.org/conference/nsdi12/technical-sessions/presentation/zaharia, and Berkeley AMPLab page at https://amplab.cs.berkeley.edu/publication/resilient-distributed-datasets-a-fault-tolerant-abstraction-for-in-memory-cluster-computing/. Study MapReduce Case Study, Pregel Graph Processing Case Study, Ray Distributed Execution Case Study, Kafka Log Case Study, and Backpressure & Flow Control next.',
      ],
    },
  ],
};
