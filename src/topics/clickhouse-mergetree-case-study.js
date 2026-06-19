// ClickHouse MergeTree: immutable parts, column files, granules, marks,
// sparse primary indexes, and background merges.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'clickhouse-mergetree-case-study',
  title: 'ClickHouse MergeTree Case Study',
  category: 'Systems',
  summary: 'MergeTree as the analytical storage lesson: inserts create sorted immutable parts, sparse marks skip granules, and background merges reshape data.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['parts and granules', 'sparse primary index'], defaultValue: 'parts and granules' },
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

function mergeTreeGraph(title) {
  return graphState({
    nodes: [
      { id: 'insert', label: 'insert batch', x: 0.8, y: 4.0, note: 'incoming rows' },
      { id: 'sort', label: 'sort by ORDER BY', x: 2.6, y: 4.0, note: 'primary order' },
      { id: 'partA', label: 'part A', x: 4.8, y: 2.4, note: 'immutable files' },
      { id: 'partB', label: 'part B', x: 4.8, y: 5.6, note: 'immutable files' },
      { id: 'marks', label: 'marks/index', x: 7.0, y: 2.4, note: 'granule boundaries' },
      { id: 'cols', label: 'column files', x: 7.0, y: 5.6, note: 'compressed streams' },
      { id: 'merge', label: 'background merge', x: 9.2, y: 4.0, note: 'new larger part' },
    ],
    edges: [
      { id: 'e-insert-sort', from: 'insert', to: 'sort', weight: 'sort' },
      { id: 'e-sort-a', from: 'sort', to: 'partA', weight: 'write part' },
      { id: 'e-sort-b', from: 'sort', to: 'partB', weight: 'later insert' },
      { id: 'e-part-marks', from: 'partA', to: 'marks', weight: 'primary index' },
      { id: 'e-part-cols', from: 'partA', to: 'cols', weight: 'columns' },
      { id: 'e-a-merge', from: 'partA', to: 'merge', weight: 'merge input' },
      { id: 'e-b-merge', from: 'partB', to: 'merge', weight: 'merge input' },
    ],
  }, { title });
}

function* partsAndGranules() {
  yield {
    state: mergeTreeGraph('MergeTree inserts become sorted immutable data parts'),
    highlight: { active: ['insert', 'sort', 'partA', 'e-insert-sort', 'e-sort-a'], compare: ['partB'] },
    explanation: 'A MergeTree table stores data as immutable parts. An inserted block is sorted by ORDER BY, written as a new part with column files, marks, metadata, and checksums.',
  };

  yield {
    state: labelMatrix(
      'Inside a data part',
      [
        { id: 'columns', label: 'column files' },
        { id: 'marks', label: 'marks' },
        { id: 'primary', label: 'primary index' },
        { id: 'metadata', label: 'metadata/checksums' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['compressed column streams', 'read only needed columns'],
        ['offsets into streams', 'jump to granules'],
        ['first key per granule', 'sparse skipping'],
        ['part integrity', 'self-contained part'],
      ],
    ),
    highlight: { found: ['marks:why', 'primary:why'], active: ['columns:contains'] },
    explanation: 'Each part is self-contained. It has the data, metadata, and index structures needed to decide what to read. The engine does not need one central B-tree for every row.',
    invariant: 'MergeTree optimizes scans by sorted immutable parts, not by point-updating rows in place.',
  };

  yield {
    state: mergeTreeGraph('Background merges replace many small parts with larger parts'),
    highlight: { active: ['partA', 'partB', 'merge', 'e-a-merge', 'e-b-merge'], found: ['sort'] },
    explanation: 'Background merges combine sorted parts into larger sorted parts. This improves read efficiency and controls part count, but it consumes CPU, disk IO, and write amplification.',
  };

  yield {
    state: labelMatrix(
      'MergeTree versus neighboring storage designs',
      [
        { id: 'lsm', label: 'LSM Tree' },
        { id: 'parquet', label: 'Parquet' },
        { id: 'sqlite', label: 'SQLite B-tree' },
        { id: 'merge', label: 'MergeTree' },
      ],
      [
        { id: 'shared', label: 'shared idea' },
        { id: 'difference', label: 'difference' },
      ],
      [
        ['immutable sorted runs', 'ClickHouse is columnar analytical'],
        ['column chunks', 'MergeTree manages active table parts'],
        ['page B-trees', 'SQLite updates local pages'],
        ['sorted parts + marks', 'query skipping over granules'],
      ],
    ),
    highlight: { active: ['merge:shared', 'lsm:shared'], compare: ['sqlite:difference'] },
    explanation: 'MergeTree combines ideas from LSM-style immutable parts and columnar analytics, but its sparse index and granule model are tailored for large analytical scans.',
  };
}

function* sparsePrimaryIndex() {
  yield {
    state: labelMatrix(
      'Sparse primary index over granules',
      [
        { id: 'g0', label: 'granule 0' },
        { id: 'g1', label: 'granule 1' },
        { id: 'g2', label: 'granule 2' },
        { id: 'query', label: 'WHERE user_id=42' },
      ],
      [
        { id: 'firstKey', label: 'first ORDER BY key' },
        { id: 'decision', label: 'read?' },
      ],
      [
        ['user 1, time 00:00', 'skip'],
        ['user 42, time 10:00', 'read maybe'],
        ['user 99, time 00:00', 'skip'],
        ['binary search marks', 'touch g1'],
      ],
    ),
    highlight: { found: ['g1:decision', 'query:decision'], removed: ['g0:decision', 'g2:decision'] },
    explanation: 'The primary index is sparse: it stores keys for granule boundaries, not every row. It narrows the scan to granules that may match, then column scans verify rows inside them.',
  };

  yield {
    state: mergeTreeGraph('Marks point into every column stream'),
    highlight: { active: ['marks', 'cols', 'e-part-marks', 'e-part-cols'], compare: ['partA'] },
    explanation: 'Marks let ClickHouse jump to matching granules inside compressed column streams. This is why the same granule boundary is stored for columns even if the query reads only a few columns.',
  };

  yield {
    state: labelMatrix(
      'ORDER BY key design',
      [
        { id: 'good', label: 'tenant_id, date' },
        { id: 'ok', label: 'date, event_type' },
        { id: 'bad', label: 'uuid only' },
        { id: 'wide', label: 'too many columns' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['common filters cluster', 'good skipping'],
        ['time range scans work', 'tenant queries scatter'],
        ['random order', 'little skipping'],
        ['large keys', 'index memory grows'],
      ],
    ),
    highlight: { active: ['good:effect'], compare: ['bad:risk', 'wide:risk'] },
    explanation: 'MergeTree performance is designed into ORDER BY. The sparse primary index helps only when query predicates align with sorted order and granule boundaries.',
  };

  yield {
    state: labelMatrix(
      'Operational case study',
      [
        { id: 'ingest', label: 'event ingest' },
        { id: 'query', label: 'dashboard query' },
        { id: 'merge', label: 'merge backlog' },
        { id: 'ttl', label: 'TTL/retention' },
      ],
      [
        { id: 'mechanism', label: 'mechanism' },
        { id: 'failureMode', label: 'failure mode' },
      ],
      [
        ['small inserts create parts', 'too many parts'],
        ['marks skip granules', 'bad ORDER BY scans too much'],
        ['background compaction', 'IO pressure'],
        ['drop old parts', 'retention mistakes'],
      ],
    ),
    highlight: { found: ['query:mechanism', 'merge:mechanism'], compare: ['ingest:failureMode'] },
    explanation: 'The production story is a feedback loop: batching, ordering, part count, merge capacity, and query predicates all determine whether ClickHouse stays fast.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'parts and granules') yield* partsAndGranules();
  else if (view === 'sparse primary index') yield* sparsePrimaryIndex();
  else throw new InputError('Pick a ClickHouse MergeTree view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for ClickHouse MergeTree Case Study. MergeTree as the analytical storage lesson: inserts create sorted immutable parts, sparse marks skip granules, and background merges reshape data..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Analytical databases are asked to ingest huge append streams and then filter, group, and aggregate billions of rows. The common query is not "find one row by id." It is "scan a time range, read a few columns, skip most tenants, and aggregate fast."`,
        `A row-store B-tree is good at point lookups and small updates, but it wastes I/O when a dashboard needs three columns out of a hundred. Plain append files ingest easily, but they lose physical order and create too much work for queries.`,
        `MergeTree is ClickHouse storage for this shape of workload. It writes sorted immutable columnar parts, breaks those parts into granules, stores sparse primary-index marks, and uses background merges to turn many small parts into fewer larger parts.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The obvious approach is to put every row behind a dense index. That feels precise because every key can point to an exact row. It is also the wrong default for many analytic scans. The index can become large, row-oriented, and expensive to maintain while the query still needs to read compressed column ranges.`,
        `The opposite obvious approach is to append files and scan them later. That keeps ingest simple but moves pain to read time. If the data is not clustered by common predicates, the query has to touch too many files, too many row groups, or too many unrelated values.`,
        `The wall is that analytics needs a different unit of precision. It does not need one pointer per row for every query. It needs enough order and metadata to skip large ranges safely, then scan candidate ranges very fast.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `MergeTree trades row-level precision for scan-level advantage. Sort rows by the ORDER BY key, store them in immutable columnar parts, and index only granule boundaries. The sparse index does not identify every row. It narrows the set of granules that may contain matching rows.`,
        `The invariant is conservative skipping. A granule can be skipped only when the engine can prove from the sorted order and metadata that it cannot contain a match. A granule that might contain a match must be read and filtered exactly inside the column data.`,
        `This is why ClickHouse primary keys are not OLTP primary keys. They define sparse index order. They do not imply uniqueness by default. The main contract is physical clustering for reads, not entity identity.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `An insert block is sorted by the table ORDER BY expression and written as a new data part. A part is self-contained: column data, marks, primary-index entries, metadata, and checksums live together. Old rows are not rewritten in place for a normal insert.`,
        `A part is divided into granules. For each granule, the primary index stores key values around the granule boundary, and marks store offsets into compressed column streams. During a SELECT, ClickHouse uses predicates on primary-key and partition expressions to find mark ranges that may match.`,
        `The query then reads only the required columns for those candidate granules and applies the actual filters. Background merges combine sorted parts inside a partition into larger sorted parts. The merge process reduces part count and improves locality, but it consumes CPU, memory, and disk I/O.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Sorted order creates long runs of related rows. If a table is ordered by tenant_id and event_time, rows for the same tenant and nearby time tend to sit near each other. A predicate on those fields can skip granules that fall outside the requested range.`,
        `The sparse index works because it is small enough to stay hot. It gives up row-perfect addressing but keeps enough boundary information to avoid reading large sections of data. Near a boundary, the engine may read extra rows, but columnar compression and vectorized execution make scanning those candidate rows cheap.`,
        `Immutable parts also simplify concurrency and recovery. A merge can read old parts and write a new part while readers continue using the old version. Once the new part is ready and checked, metadata can switch to it.`,
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        `The parts-and-granules view shows the first big idea: an insert becomes a sorted immutable part, not an in-place row update. The part contains column files, marks, index entries, metadata, and checksums. That self-contained unit is the thing ClickHouse later reads, merges, moves, or drops.`,
        `The sparse-index view shows the second idea: the WHERE predicate narrows the scan to candidate granules. A skipped granule is a range-level proof from sorted order. A read granule is still only a maybe. The row filter inside the selected columns decides the final result.`,
        `The merge view shows why ingest is not free. Many small sorted parts are easy to create, but too many of them hurt reads. Background merges are the storage engine paying down that part-count debt.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Imagine an events table with tenant_id, event_time, event_type, url, country, payload, and metric columns. A common dashboard asks for one tenant over one day and groups by event_type. If ORDER BY starts with tenant_id and event_time, the sparse index can jump near the right granules and skip unrelated tenants and dates.`,
        `The query reads the tenant, time, type, and metric columns. It does not need to read the payload column. It still scans candidate granules, but those granules are concentrated around the tenant and day that matter.`,
        `If the same table is ordered by random UUID, the tenant's rows are scattered across the part. The sparse primary index has little to skip. ClickHouse may still be fast because columnar scans are efficient, but the ORDER BY key failed to help the workload.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `Read cost depends on how well ORDER BY matches the predicate, how many parts must be checked, how many columns are read, compression ratio, granule size, and predicate selectivity. A perfect key can skip most data. A bad key turns the same query into a wider scan.`,
        `Write cost includes sorting insert blocks, creating part files, writing marks and metadata, and later paying for merges. Tiny inserts are dangerous because they create many small parts. Merges reduce part count and improve locality, but they add write amplification and can compete with queries for disk bandwidth.`,
        `Key width is a tradeoff. A longer ORDER BY expression can improve clustering and compression, but it increases primary-index memory and insert work. A coarse partition can make merges huge. A too-fine partition can leave too many parts that never merge together.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `MergeTree wins on append-heavy analytics: observability events, clickstreams, product metrics, security logs, ad analytics, time-series-like facts, and dashboards that filter on dimensions aligned with ORDER BY. It is built for scanning compressed columns quickly and skipping chunks of sorted data.`,
        `It fails when the workload is really OLTP: high-concurrency point updates, row-by-row transactions, uniqueness enforcement by primary key, and many small random writes. It also fails when most queries filter on columns unrelated to physical order.`,
        `Secondary indexes, projections, materialized views, and data-skipping indexes can help, but they do not erase the main contract. The first-order design decision is still how rows are ordered, partitioned, batched, and merged.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The first trap is thinking ClickHouse primary keys enforce uniqueness. They define sparse index order. Duplicate primary-key values can exist unless a specific engine or workflow gives different semantics.`,
        `The second trap is tiny continuous inserts. Each small insert creates part metadata and later merge pressure. Once part count gets high, queries must consider more pieces and background work grows. Batching is not a micro-optimization; it is part of the storage design.`,
        `Other common failures are bad partitioning, merge backlog, wide scans from a poor ORDER BY key, overuse of mutations, retention settings that drop or rewrite more than expected, and assuming compression will save a layout that gives the query no skipping power.`,
      ],
    },
    {
      heading: 'How it works (3)',
      paragraphs: [
        `Design ORDER BY from real queries, not from entity modeling habits. Put the most common high-selectivity range and equality filters early when that matches the workload. Keep the key narrow enough to stay cheap. Remember that the table can have duplicate key values.`,
        `Batch inserts so the engine creates fewer, healthier parts. Watch part counts, merge backlog, disk bandwidth, mutation queues, selected marks, read rows versus result rows, and memory used by primary indexes. Those metrics tell you whether the storage layout is helping or whether queries are brute-forcing through compressed data.`,
        `Partition for lifecycle and merge boundaries. Partitions are useful for dropping old data and limiting work, but too many partitions can trap small parts and reduce merge effectiveness. TTL, mutations, and deletes should be treated as storage rewrites with real cost.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Useful ClickHouse docs include the MergeTree engine page, primary indexes, sparse primary index guide, data parts, partitions, projections, and data-skipping indexes. Read them with the table layout in mind: part, granule, mark, column stream, sparse index, merge.`,
        `Study next by role: LSM Tree for immutable sorted runs and compaction, RocksDB LSM Case Study for write amplification, Parquet Columnar Format for column chunks and statistics, Database Indexing for dense index contrast, Prometheus TSDB for another time-series storage design, and Apache Pinot Star-Tree Index for a different analytic acceleration pattern.`,
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
        'Use this topic as a checkpoint: if you can explain why ClickHouse MergeTree Case Study moves from input to output in the animation and where it fails, you are ready for the next topic.',
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
