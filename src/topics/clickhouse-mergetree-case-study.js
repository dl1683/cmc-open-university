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
        'Read the parts-and-granules view as the write path. An insert batch is sorted, written as an immutable data part, split into granules, and later merged with other parts. A granule is a contiguous block of rows, and ClickHouse uses 8,192 rows as a common default.',
        'Read the sparse-primary-index view as the read path. The active index entry is a boundary key, not a pointer to one row. The safe inference is that a granule can be skipped only when sorted key order proves no row in that granule can satisfy the predicate.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Analytical databases answer questions over many rows but few columns. A dashboard may ask for one tenant, one hour, and one metric out of a table with billions of rows and dozens of fields. The main cost is irrelevant data: rows outside the tenant and time range, and columns the query never reads.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Column_vs_row.svg/800px-Column_vs_row.svg.png',
          alt: 'Row-oriented vs column-oriented storage layout comparison',
          caption: 'Row stores pack entire rows together on each page. Column stores pack all values of one column together, so a query touching three columns out of thirty reads only those three compressed streams instead of loading every field from every row.',
        },
        'MergeTree exists to make that access pattern cheap. It stores each column separately, sorts rows by an ORDER BY key, indexes only granule boundaries, and merges immutable sorted parts in the background. The storage engine is built around skipping ranges and reading only needed column streams.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach from row-oriented databases is a B-tree index on every filterable column. A B-tree is a sorted tree that finds exact keys in O(log n) comparisons. That is excellent for fetching one customer, one order, or one row.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/B-tree.svg/800px-B-tree.svg.png',
          alt: 'B-tree index structure showing internal and leaf nodes',
          caption: 'A B-tree gives O(log n) point lookups by branching through sorted internal nodes to a leaf containing the target key. This precision is invaluable for OLTP -- fetching one customer, one order, one row. But analytical queries need thousands of rows for aggregation, and each leaf-to-row pointer chase is a separate random I/O.',
        },
        'For aggregation, that precision becomes the wrong cost shape. The query may need thousands or millions of matching rows, so following row pointers creates random I/O and loads full rows even when only two columns are used. A plain append log has the opposite problem: inserts are easy, but every query scans everything.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the tension between index precision and scan efficiency. A dense index with one entry per row gives exact row location, but at one billion rows and 16 bytes per key it costs 16 GB before payload data. Every insert and merge must maintain that precision even when the query only needs block-level skipping.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/OLAP_drill_up%26down.png/800px-OLAP_drill_up%26down.png',
          alt: 'OLAP cube drill-down showing hierarchical analytical aggregation',
          caption: 'OLAP workloads aggregate across dimensions -- drilling into tenant, time, geography. The access pattern is fundamentally different from OLTP point lookups: each query touches millions of rows but only a few columns, and the value of an index depends on how many row groups it can skip, not how precisely it can point.',
        },
        {
          type: 'callout',
          text: 'The fundamental tradeoff: a dense index costs 16 GB of RAM per billion rows and gives row-level precision the query does not need. A sparse granule index costs 2 MB per billion rows and gives block-level precision that is sufficient for analytical scans. That is an 8,000x reduction in index memory.',
        },
        'MergeTree chooses a sparse index. With 8,192 rows per granule, one billion rows produce about 122,071 index entries instead of one billion. The index can fit in memory, but it identifies candidate granules rather than exact rows, so the engine still filters inside the selected blocks.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to sort data by the predicates that usually narrow queries, then index the starts of row groups. This trades row-level precision for cheap memory, cache-friendly lookup, and columnar scans. The ORDER BY key is a physical layout choice, not a uniqueness promise.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Merge_sort_algorithm_diagram.svg/600px-Merge_sort_algorithm_diagram.svg.png',
          alt: 'Merge sort algorithm diagram showing divide and merge phases',
          caption: 'The merge in MergeTree is literally merge sort. Each INSERT creates a new sorted run (a "part"). Background compaction k-way merges multiple sorted parts into one larger sorted part -- the same operation shown here, but applied to on-disk columnar files instead of in-memory arrays.',
        },
        {
          type: 'callout',
          text: 'ClickHouse primary keys do not enforce uniqueness. Duplicate ORDER BY values are legal. The primary key defines sparse index order and physical clustering for reads, not entity identity. This is the single most common misunderstanding for engineers coming from OLTP databases.',
        },
        'The invariant is sorted immutable parts. If every part is sorted by the ORDER BY key and merges preserve sorted order, the boundary keys remain meaningful. A query can use those keys to prove that many granules cannot contain matches.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On insert, ClickHouse receives a block of rows, sorts it by the ORDER BY expression, splits it into granules, compresses each column separately, writes mark files with byte offsets, and writes a sparse primary index with one key tuple per granule. The result is an immutable part directory. No existing part is modified.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Log-structured_merge-tree_-_overview.svg/800px-Log-structured_merge-tree_-_overview.svg.png',
          alt: 'Log-structured merge tree overview showing memtable flush and level compaction',
          caption: 'MergeTree borrows its write path from LSM trees: new data arrives as small sorted runs, and background compaction merges them into larger sorted files. The key difference is that MergeTree parts are columnar -- each column is a separate compressed stream within the part, enabling column pruning at read time.',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Sorted_binary_tree_ALL_RGB.svg/600px-Sorted_binary_tree_ALL_RGB.svg.png',
          alt: 'Binary search tree showing sorted traversal order',
          caption: 'The binary search over primary.idx is conceptually the same operation as walking a balanced BST: each comparison eliminates half the remaining granules. With ~122K granule entries for a billion rows, the search depth is about 17 -- the entire index lookup finishes in microseconds.',
        },
        'On read, the engine prunes partitions, searches primary.idx inside candidate parts, applies skip indexes if present, uses marks to seek into needed column files, decompresses selected granules, and filters rows exactly. Background merges later combine small sorted parts into larger sorted parts, improving compression and reducing part-count overhead.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on sorted order, immutability, and aligned marks. Sorted order makes the sparse index meaningful. Immutability means readers never see partial rewrites. Aligned marks let different column files refer to the same granule boundaries.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/800px-Camponotus_flavomarginatus_ant.jpg',
          alt: 'Close-up photograph of an ant carrying material',
          caption: 'Background merges are like ant colony logistics: each merge worker independently picks up small parts and consolidates them into larger structures. No central coordinator is needed. Writers and readers operate concurrently because parts are immutable -- the switch from old parts to a new merged part is a single atomic metadata update.',
        },
        'The skip proof is monotonic. If keys are sorted by (tenant_id, event_time), a range for tenant 42 occupies contiguous granules within each part. Binary search can find that range, and granules outside it are impossible matches. Candidate granules are still filtered row by row, so sparse indexing never claims more precision than it has.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert cost is O(B log B) to sort a batch of B rows plus O(B) to write compressed column data. Primary-index lookup is O(log G), where G is granules per part; one billion rows at 8,192 rows per granule gives about 122k entries and about 17 comparisons. Scanning selected granules costs roughly selected granules times columns read times granule size.',
        {
          type: 'callout',
          text: 'Write amplification from merges is the main hidden cost. Each row may be rewritten 3-5 times across merge levels before reaching a large final part. This is the same tradeoff as LSM trees: fast ingestion in exchange for background compaction work. If the ingest rate exceeds the merge rate, part count grows until the "too many parts" error halts inserts.',
        },
        'The dominant behavior changes with table design. A good ORDER BY key can make a dashboard read under 1 percent of granules. A mismatched key can force scans over most granules even though the sparse index is loaded in memory. Tiny inserts add many small parts, so merge debt can dominate query latency and ingestion health.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MergeTree fits event analytics, observability metrics, product dashboards, ad logs, security telemetry, and time-series facts with wide schemas. These workloads usually filter by tenant, time, service, region, or event type, then aggregate a few columns. Column pruning and granule skipping match that access pattern.',
        'It is especially strong when rows arrive in large batches and queries share a predictable ORDER BY shape. A tenant-time dashboard, for example, can cluster related rows together and avoid loading payload columns. The engine is less suited to row-by-row transactional updates or exact uniqueness enforcement.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when ORDER BY does not match common predicates. If the table is ordered by tenant and time but most queries filter by country, the sparse index cannot skip country ranges. The engine still works, but it scans many more granules and spends CPU decompressing irrelevant blocks.',
        'It also fails with tiny inserts, over-partitioning, mutation-heavy workloads, and primary-key misunderstanding. Each insert creates a part, merges only combine parts within a partition, and UPDATE-style mutations rewrite parts. A ClickHouse primary key does not reject duplicates, so teams expecting OLTP semantics can build incorrect deduplication flows.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a table has 100 million rows ordered by (tenant_id, event_time), partitioned by month, with 8,192-row granules. A query asks for tenant 42 on one day and needs event_type and metric. There are about 12,207 granules in the month if all rows are in one partition.',
        'If tenant 42 occupies about 50,000 rows, the sparse index narrows the read to about 7 granules, or 57,344 candidate rows. If the exact day contains 2,000 rows, the engine still had to decompress the 7 candidate granules, but it skipped about 99.94 percent of row ranges and never opened unrelated columns such as payload. The cost saving comes from clustering, sparse index lookup, marks, and column pruning working together.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are ClickHouse documentation for the MergeTree engine family, primary keys and indexes in queries, sparse indexes, marks, granules, and engine settings. Also study the ClickHouse source under src/Storages/MergeTree/ for part layout, mark reads, merge selection, and background scheduling.',
        'Study database indexing first to understand the dense B-tree baseline. Then study LSM trees, Parquet row groups, RocksDB, Prometheus TSDB blocks, and Apache Pinot star-tree indexes. Each system chooses a different unit of indexing, compaction, and scan-time skipping.',
      ],
    },
  ],
};
