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
    explanation: 'A Resilient Distributed Dataset is an immutable collection split into partitions. Transformations build a lineage graph instead of immediately copying data everywhere.',
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
    explanation: 'The paper frames RDDs as distributed data structures, not just a library API. Each partition knows enough to be recomputed from parents if a worker loses it.',
    invariant: 'Immutability makes lineage safe: lost partitions can be rebuilt without coordinating updates in place.',
  };

  yield {
    state: lineageGraph('Narrow dependencies pipeline; wide dependencies shuffle'),
    highlight: { active: ['e-rdd1-rdd2', 'e-rdd1-rdd3'], compare: ['shuffle', 'e-shuffle-rdd4'] },
    explanation: 'Map and filter are narrow: one child partition depends on a small number of parent partitions. reduceByKey is wide: many parents feed many children, so the scheduler inserts a shuffle boundary.',
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
    explanation: 'RDD fault tolerance replaces eager replication with lineage recomputation. That is cheap when lineage is short and deterministic; checkpointing exists for long or expensive lineages.',
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
    explanation: 'Spark belongs in a larger family: systems survive failure by keeping the recipe, not only the result. The right recipe depends on whether recomputation is cheaper than replication.',
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
      heading: 'What it is',
      paragraphs: [
        'Spark RDDs are immutable, partitioned, distributed collections with lineage. They were introduced to make in-memory reuse practical for cluster workloads like iterative machine learning and interactive data mining.',
        'The case study matters because RDDs changed the fault-tolerance bargain. Instead of replicating every intermediate result, Spark records how to recompute lost partitions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each RDD tracks partitions, dependencies on parent RDDs, a function for computing partitions, and preferred locations. Transformations are lazy and build a DAG. Actions trigger scheduling. Narrow dependencies can be pipelined; wide dependencies create shuffle boundaries.',
        'cache() or persist() keeps selected partitions in memory. If a partition is lost, the scheduler uses lineage and available parent data to recompute it. Checkpointing trims long or expensive lineage.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'RDDs reduce repeated disk IO when data reuse is high. They can struggle with skewed shuffles, memory pressure, long lineage, nondeterministic side effects, and workloads that need fine-grained mutable state. Later systems added richer structured APIs, streaming, and optimized execution engines on top of the core lesson.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The RDD abstraction shaped Apache Spark, iterative ML workflows, graph processing, ad-hoc analytics, and many later cluster execution engines. It connects MapReduce, Pregel, Ray, Delta Lake, feature stores, and parameter-server thinking.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'RDDs are not just arrays on many machines. The important part is lineage plus partitioned execution. Also, caching is not free: memory pressure can evict partitions, and recomputation can become expensive if lineage is long or shuffle data is unavailable.',
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
