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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the lineage graph as data plus a recipe. HDFS blocks become partitioned RDDs, narrow edges pipeline local transformations, and the shuffle node marks a wide dependency where many parents feed many children. Active nodes are the current derived datasets, compare nodes are expensive boundaries, and found nodes are reusable or recoverable state.',
        'RDD means Resilient Distributed Dataset. Resilient means recoverable after failure, distributed means split across workers, and dataset means a logical collection. The animation is teaching that an RDD stores enough lineage to recompute a lost partition.',
        {type:'callout', text:'RDDs make cached cluster data recoverable by storing a deterministic recipe for rebuilding lost partitions instead of eagerly replicating every intermediate.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'MapReduce made large batch jobs reliable by writing durable output between jobs. That was acceptable for one-pass ETL, but it was expensive for iterative machine learning and interactive exploration. Those workloads reuse the same working set many times.',
        'Spark RDDs exist to make in-memory reuse reliable. The system caches partitions that are worth reusing and records how to rebuild them. Fault tolerance comes from deterministic recomputation instead of writing every intermediate result to disk.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious reliable approach is to materialize every stage to durable storage. If a worker fails, the next job can reread the last output. This is simple, but repeated disk writes dominate iterative jobs.',
        'The obvious fast approach is to keep data in memory. That improves the happy path, but it fails when a worker dies or memory evicts a partition. A cluster cache without recovery is not enough for production data processing.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is recovering cached distributed data without paying full replication cost. Replicating every intermediate partition consumes memory and network before any failure happens. Writing every boundary to disk removes the benefit of memory reuse.',
        'The system needs an invariant: if a partition is lost, Spark must know which parent partitions and transformation functions can rebuild it. That only works when transformations are deterministic and data is immutable. Mutation in place would make the recipe ambiguous.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'An RDD is not just values spread across machines. It is partitions, dependencies, a compute function, and preferred locations. Transformations build a lineage DAG, which is a directed acyclic graph of how each dataset depends on earlier datasets.',
        'Lineage turns recovery into graph replay. If partition 12 of a cached RDD disappears, Spark traces the parents needed for partition 12 and recomputes that piece. It does not restart unrelated partitions unless the dependency forces it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Transformations such as map and filter are lazy. They create new RDD nodes and dependency edges but do not run until an action such as count, collect, save, or reduce needs a result. The scheduler reads the DAG and groups pipelined work into stages.',
        'A narrow dependency lets one child partition depend on one or a small number of parent partitions. A wide dependency, such as reduceByKey, needs data from many parents and creates a shuffle. cache or persist stores selected partitions after computation, while checkpoint writes an RDD to reliable storage to cut long lineage.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from immutability and deterministic transformations. If parent partition P and function f are the same, recomputing f(P) produces the same child partition. Spark can rebuild lost pieces because no task secretly changed a parent in place.',
        'The scheduler also preserves dependency order. A child partition is computed only after required parent partitions or shuffle files exist. Narrow dependencies allow local replay, while wide dependencies reveal when recovery must cross a shuffle boundary.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'RDD cost behaves by dependency shape. A map over 100 partitions creates 100 independent tasks and can pipeline with a filter. A reduceByKey over the same data creates shuffle files, network traffic, disk spill risk, and new reduce tasks.',
        'Caching is a bet on reuse. If a cached 80 GB RDD is used 20 times and memory holds it, Spark avoids 19 upstream recomputations. If it is used once, the cache call adds storage pressure. If a lost partition requires a 600 GB shuffle to rebuild, checkpointing may be cheaper than replay.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RDDs fit iterative machine learning, graph processing, log analysis, and exploratory pipelines where the same derived data is reused. They also remain useful as the conceptual base for Spark scheduling, partitions, lineage, cache levels, and shuffle boundaries.',
        'Modern Spark often uses DataFrames and SQL above RDDs. Those APIs expose schema and expressions to an optimizer. The RDD lesson still matters because the optimizer eventually lowers work onto partitions, stages, shuffles, and cached blocks.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'RDDs are awkward for fine-grained mutable state, low-latency transactions, and streaming event-time logic. A database, key-value store, or stream processor may match those workloads better. RDD lineage is a batch recovery tool, not a general shared-memory model.',
        'Long lineage and skew are common failures. A late lost partition may trigger expensive replay through many stages. A wide dependency with a hot key can leave one reducer running while others idle. Checkpointing and better partitioning are cost controls, not optional polish.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose 400 HDFS blocks create an RDD with 400 partitions. A filter keeps error lines, a map extracts user IDs, and reduceByKey counts errors per user. The filter and map are narrow, so each partition can run locally; reduceByKey creates a shuffle across the cluster.',
        'Now cached partition 17 of the mapped RDD is lost. Spark recomputes only HDFS block 17 through filter and map, then restores that partition. If partition 17 of the reduced RDD is lost after the shuffle, Spark may need shuffle outputs from many map partitions, so the recovery cost is much larger and checkpointing becomes attractive.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Zaharia et al., Resilient Distributed Datasets, NSDI 2012, and the Apache Spark programming guide. Read for the metadata fields of an RDD and for the difference between narrow and wide dependencies.',
        'Study MapReduce, Pregel, Spark SQL, shuffle internals, checkpointing, lineage recovery, and tail latency next. The important transfer is knowing when recomputation is cheaper than materialization.',
      ],
    },
  ],
};
