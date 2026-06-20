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
        'The animation has two views. "Parts and granules" shows the write path: an insert batch is sorted, written as an immutable data part with column files, marks, and metadata, then later merged with other parts by background compaction. "Sparse primary index" shows the read path: granule-boundary keys narrow a SELECT to candidate granules, marks jump into compressed column streams, and only matching columns are scanned.',
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current operation: an insert being sorted, a part being written, or a merge combining parts.',
            'Compare marks show alternative paths or later inserts that will create separate parts needing future merges.',
            'Found marks are durable outcomes: written parts, committed column files, and index entries that survive until the next merge replaces them.',
          ],
        },
        {
          type: 'note',
          text: 'Safe inference rule: a granule can be skipped only when the sparse primary index proves, from sorted key order, that no row in that granule can satisfy the WHERE predicate. A granule that might match must be read and filtered inside the column data.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'ClickHouse stores data in columns: the values of each column are stored separately. During reads, only the columns used in the query are read. Any read is automatically parallelized across all available CPU cores.',
          attribution: 'ClickHouse Documentation, "Why ClickHouse is So Fast"',
        },
        'Analytical workloads scan billions of rows but read few columns. A product dashboard asks: "for tenant X, between 2pm and 3pm yesterday, sum metric by event type." That query touches three columns out of thirty and needs rows from one tenant and one hour out of weeks of data. The work is dominated by how much irrelevant data the engine can avoid reading.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Column_vs_row.svg/800px-Column_vs_row.svg.png',
          alt: 'Row-oriented vs column-oriented storage layout comparison',
          caption: 'Row stores pack entire rows together on each page. Column stores pack all values of one column together, so a query touching three columns out of thirty reads only those three compressed streams instead of loading every field from every row.',
        },
        'Row stores like PostgreSQL or MySQL pack entire rows together on disk pages. Reading three columns forces the engine to load all thirty columns from every touched page, then discard twenty-seven. A dense B-tree index can locate individual rows, but once the query needs thousands of rows for aggregation, the per-row pointer chasing becomes the bottleneck.',
        'ClickHouse MergeTree solves this by storing each column in a separate compressed file, sorting all rows by a user-chosen ORDER BY key, and indexing only granule boundaries rather than individual rows. The result is a storage engine shaped for the analytical access pattern: skip irrelevant row ranges by sorted order, read only the columns the query needs, and decompress compact columnar blocks with vectorized execution.',
        {
          type: 'table',
          headers: ['Scale marker', 'Typical value'],
          rows: [
            ['Rows per table', 'Billions to trillions in production deployments'],
            ['Columns per table', '50-500 (wide event schemas)'],
            ['Columns per query', '3-10 (dashboards read few columns)'],
            ['Granule size (default)', '8,192 rows'],
            ['Primary index entry size', 'One key tuple per granule (~122K entries per billion rows)'],
            ['Insert throughput', '1-2 million rows/second per core on sorted columnar writes'],
            ['Compression ratio', '5x-20x depending on column cardinality and codec'],
          ],
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach from OLTP experience is a B-tree index on every filterable column. Each index entry points to an exact row. The query plan walks one or more indexes, intersects the row sets, and fetches matching rows.',
        'This works well when queries touch a handful of rows. It breaks when queries aggregate thousands or millions of rows, because each row fetch is a random I/O into a row-oriented page. The index that is precise at pointing becomes expensive to traverse at volume.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/B-tree.svg/800px-B-tree.svg.png',
          alt: 'B-tree index structure showing internal and leaf nodes',
          caption: 'A B-tree gives O(log n) point lookups by branching through sorted internal nodes to a leaf containing the target key. This precision is invaluable for OLTP -- fetching one customer, one order, one row. But analytical queries need thousands of rows for aggregation, and each leaf-to-row pointer chase is a separate random I/O.',
        },
        {
          type: 'diagram',
          text: 'Row store with B-tree index (OLTP pattern):\n\n  B-tree index on tenant_id\n    |-> row 17  (all 30 columns packed together)\n    |-> row 4,201\n    |-> row 8,992\n    |-> ... (thousands of random row fetches)\n\n  Each fetch loads the full row: 30 columns read, 3 used.\n  Random I/O dominates once result set exceeds a few hundred rows.',
          label: 'B-tree point lookup pattern on an analytical query',
        },
        'A second obvious approach is plain append-only logging: write rows as they arrive, scan everything later. Ingest is fast because there is no sorting or indexing overhead. But the query must read every byte of every file to find matching rows, and rows for the same tenant are scattered across the entire timeline.',
        {
          type: 'table',
          headers: ['Approach', 'Ingest cost', 'Analytical query cost', 'Failure point'],
          rows: [
            ['B-tree row store', 'Moderate (maintain index on each insert)', 'Random I/O per matching row', 'Aggregation over thousands of rows'],
            ['Append-only log', 'Minimal (sequential write)', 'Full scan of all data', 'No physical order, no skip capability'],
            ['Column store + dense index', 'High (build per-row index per column)', 'Low per query but index memory explodes', 'Index size exceeds RAM at billions of rows'],
            ['MergeTree', 'Sort + columnar write per batch', 'Skip granules by sparse index, read only needed columns', 'ORDER BY must match query predicates'],
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the tension between index precision and scan efficiency at analytical scale. A dense index gives row-level precision but costs O(n) memory and maintenance for n rows. At a billion rows with a 16-byte key, the index alone is 16 GB before any row data. Every insert must update the index. Every merge must rebuild it.',
        'An append log avoids that cost but gives zero skip capability. Between these extremes, the question is: what is the right unit of indexing for analytical queries?',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/OLAP_drill_up%26down.png/800px-OLAP_drill_up%26down.png',
          alt: 'OLAP cube drill-down showing hierarchical analytical aggregation',
          caption: 'OLAP workloads aggregate across dimensions -- drilling into tenant, time, geography. The access pattern is fundamentally different from OLTP point lookups: each query touches millions of rows but only a few columns, and the value of an index depends on how many row groups it can skip, not how precisely it can point.',
        },
        {
          type: 'diagram',
          text: 'Dense index at 1 billion rows:\n  1B entries * 16 bytes/key = 16 GB index memory\n  Every insert updates the index\n  Every merge rebuilds it\n  The query reads 3 columns but the index points at full rows\n\nSparse index at 1 billion rows (8,192 rows/granule):\n  ~122K entries * 16 bytes/key = ~2 MB index memory\n  One entry per granule boundary, not per row\n  Fits entirely in L3 cache on modern hardware\n  Binary search over 122K entries: ~17 comparisons',
          label: 'Memory cost: dense vs. sparse indexing at scale',
        },
        {
          type: 'callout',
          text: 'The fundamental tradeoff: a dense index costs 16 GB of RAM per billion rows and gives row-level precision the query does not need. A sparse granule index costs 2 MB per billion rows and gives block-level precision that is sufficient for analytical scans. That is an 8,000x reduction in index memory.',
        },
        'The answer MergeTree gives: index granule boundaries, not rows. A granule is a contiguous block of 8,192 rows (default) sorted by the ORDER BY key. The sparse primary index stores only the first key value of each granule. At a billion rows, this is ~122,000 index entries instead of a billion. The index fits in CPU cache. The tradeoff is that the engine cannot pinpoint a single row from the index alone -- it can only identify which granules might contain matching rows, then scan those granules column by column.',
        {
          type: 'note',
          text: 'The granule is the atomic unit of read I/O in MergeTree. Everything -- primary index, marks, skip indexes, PREWHERE -- operates at granule granularity. Understanding the granule is the prerequisite for understanding every performance behavior.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Sort rows by the columns that queries filter on most. Store each column separately. Index only the boundaries between fixed-size row groups (granules). Accept that the index cannot identify individual rows -- it identifies candidate granules that might contain matches. Then scan those candidate granules using only the columns the query needs.',
        'This is a bet on two properties of analytical workloads: queries read few columns out of many, and queries filter on dimensions that benefit from sorted physical order. When both hold, MergeTree reads a small fraction of the stored data.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Merge_sort_algorithm_diagram.svg/600px-Merge_sort_algorithm_diagram.svg.png',
          alt: 'Merge sort algorithm diagram showing divide and merge phases',
          caption: 'The merge in MergeTree is literally merge sort. Each INSERT creates a new sorted run (a "part"). Background compaction k-way merges multiple sorted parts into one larger sorted part -- the same operation shown here, but applied to on-disk columnar files instead of in-memory arrays.',
        },
        {
          type: 'diagram',
          text: 'Data part on disk (one part, three columns shown):\n\n  primary.idx:    [tenant=1,t=00:00] [tenant=1,t=04:12] [tenant=3,t=01:00] ...\n                   granule 0           granule 1           granule 2\n\n  tenant_id.bin:  |#### g0 ####|#### g1 ####|#### g2 ####| ...  (compressed)\n  event_time.bin: |#### g0 ####|#### g1 ####|#### g2 ####| ...  (compressed)\n  metric.bin:     |#### g0 ####|#### g1 ####|#### g2 ####| ...  (compressed)\n  payload.bin:    |#### g0 ####|#### g1 ####|#### g2 ####| ...  (not read)\n\n  marks file:     [offset_g0] [offset_g1] [offset_g2] ...  (per column)\n\n  Query: WHERE tenant_id = 3 AND event_time > 01:00\n  -> primary.idx binary search -> granule 2 is candidate\n  -> marks[2] gives byte offset in tenant_id.bin, event_time.bin, metric.bin\n  -> decompress only granule 2 of those three columns\n  -> payload.bin is never touched',
          label: 'Sparse index narrows to granules; marks jump into column files',
        },
        {
          type: 'code',
          language: 'sql',
          text: '-- The ORDER BY key is NOT a uniqueness constraint.\n-- It defines physical sort order and sparse index structure.\nCREATE TABLE events (\n    tenant_id   UInt32,\n    event_time  DateTime,\n    event_type  LowCardinality(String),\n    url         String,\n    country     LowCardinality(String),\n    payload     String,\n    metric      Float64\n) ENGINE = MergeTree()\nPARTITION BY toYYYYMM(event_time)\nORDER BY (tenant_id, event_time)\nSETTINGS index_granularity = 8192;',
        },
        {
          type: 'callout',
          text: 'ClickHouse primary keys do not enforce uniqueness. Duplicate ORDER BY values are legal. The primary key defines sparse index order and physical clustering for reads, not entity identity. This is the single most common misunderstanding for engineers coming from OLTP databases.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The system has two paths: the write path that creates parts, and the read path that skips granules.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Log-structured_merge-tree_-_overview.svg/800px-Log-structured_merge-tree_-_overview.svg.png',
          alt: 'Log-structured merge tree overview showing memtable flush and level compaction',
          caption: 'MergeTree borrows its write path from LSM trees: new data arrives as small sorted runs, and background compaction merges them into larger sorted files. The key difference is that MergeTree parts are columnar -- each column is a separate compressed stream within the part, enabling column pruning at read time.',
        },
        {
          type: 'code',
          language: 'text',
          text: 'Write path (per INSERT batch):\n\n1. Receive a block of rows (ideally 10K-1M rows per batch).\n2. Sort the block by the ORDER BY expression.\n3. Split sorted rows into granules of index_granularity rows (default 8,192).\n4. For each column:\n   a. Compress granule data using the column codec (LZ4, ZSTD, DoubleDelta, etc.).\n   b. Write compressed bytes to <column>.bin.\n   c. Write a mark entry (compressed-block offset, uncompressed offset) to <column>.mrk2.\n5. Write primary.idx: the ORDER BY key tuple at the start of each granule.\n6. Write checksums.txt, columns.txt, count.txt, and partition metadata.\n7. The result is a new immutable data part directory on disk.\n   No existing part is modified. No global index is updated.',
        },
        'Each INSERT creates one new part. The part is a directory containing column files (.bin), mark files (.mrk2), the primary index (primary.idx), and metadata. Once written, a part is immutable -- no in-place updates. This is why ClickHouse inserts are fast: they are sequential writes of sorted columnar data with no lock contention on existing parts.',
        {
          type: 'code',
          language: 'text',
          text: 'Read path (per SELECT query):\n\n1. Identify candidate partitions from PARTITION BY expression and WHERE clause.\n2. For each part in candidate partitions:\n   a. Binary search primary.idx to find granule range where matches could exist.\n   b. Apply data-skipping indexes (minmax, set, bloom_filter) to narrow further.\n   c. For each candidate granule:\n      - Use marks to seek directly to the granule offset in each needed column file.\n      - Decompress the granule block.\n      - Apply PREWHERE filter (if specified) to discard rows before reading remaining columns.\n      - Apply WHERE filter to remaining rows.\n3. Aggregate results across parts.\n4. Return result set.',
        },
        'The critical performance lever is the binary search on primary.idx. With 122K entries (one billion rows at default granularity), the search takes ~17 comparisons to identify candidate granules. The marks file then gives exact byte offsets into each column file, so the engine seeks directly to the right compressed block without scanning the file.',
        {
          type: 'table',
          headers: ['Part component', 'File', 'Contents', 'Purpose'],
          rows: [
            ['Primary index', 'primary.idx', 'First ORDER BY key tuple per granule', 'Binary search to find candidate granules'],
            ['Column data', '<col>.bin', 'Compressed column values, blocked by granule', 'Actual data; only needed columns are read'],
            ['Marks', '<col>.mrk2', 'Byte offset of each granule in the .bin file', 'Seek directly to the right compressed block'],
            ['Checksums', 'checksums.txt', 'Hash of every file in the part', 'Detect corruption; validate after merge'],
            ['Count', 'count.txt', 'Total row count in the part', 'Query planning and part selection'],
            ['Partition info', 'partition.dat', 'Partition key value for this part', 'Partition pruning at query time'],
          ],
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Sorted_binary_tree_ALL_RGB.svg/600px-Sorted_binary_tree_ALL_RGB.svg.png',
          alt: 'Binary search tree showing sorted traversal order',
          caption: 'The binary search over primary.idx is conceptually the same operation as walking a balanced BST: each comparison eliminates half the remaining granules. With ~122K granule entries for a billion rows, the search depth is about 17 -- the entire index lookup finishes in microseconds.',
        },
        'Background merges run continuously. The merge selector picks parts within the same partition, reads their sorted rows, performs a k-way merge sort, and writes a new larger part. The old parts are marked inactive and later removed. Merges reduce part count, improve compression (longer runs of similar values), and compact the sparse index.',
        {
          type: 'note',
          text: 'Merges are the deferred cost of fast inserts. Every INSERT is cheap because it writes a small sorted part. The merge process pays the compaction debt later, consuming CPU, memory, and disk I/O. If inserts outpace merges, part count grows and queries slow down -- this is the "too many parts" error.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on three invariants that hold through every insert and merge.',
        {
          type: 'bullets',
          items: [
            'Sort invariant: rows within every part are sorted by the ORDER BY key. Merging two sorted parts produces a new sorted part (merge sort). The sparse primary index is valid because granule boundaries respect sorted order.',
            'Immutability invariant: a written part is never modified in place. Merges create new parts; old parts are atomically replaced in metadata. Readers never see partial writes or torn pages. Crash recovery drops incomplete parts.',
            'Column independence invariant: each column is stored, compressed, and indexed separately. A query reads only the columns it references. Marks ensure the same granule boundaries align across all column files in a part.',
          ],
        },
        'The sparse index works because sorted order creates a monotonic relationship between key values and granule positions. If granule 5 starts at tenant_id=42 and granule 6 starts at tenant_id=99, then every row with tenant_id between 42 and 98 must be in granule 5 (or in the gap between granules in a merged part). The binary search exploits this monotonicity.',
        {
          type: 'quote',
          text: 'The primary index is loaded entirely into memory. It contains one entry per granule rather than one entry per row. For 100 million rows, the primary index fits easily in memory even on small machines.',
          attribution: 'ClickHouse Documentation, "Primary Keys and Indexes in Queries"',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/800px-Camponotus_flavomarginatus_ant.jpg',
          alt: 'Close-up photograph of an ant carrying material',
          caption: 'Background merges are like ant colony logistics: each merge worker independently picks up small parts and consolidates them into larger structures. No central coordinator is needed. Writers and readers operate concurrently because parts are immutable -- the switch from old parts to a new merged part is a single atomic metadata update.',
        },
        'Immutable parts simplify concurrency. Writers create new parts without locking readers. Merges write new parts while queries continue reading old ones. The switch from old parts to the new merged part is an atomic metadata update. If the server crashes mid-merge, the incomplete new part is discarded on restart and the old parts remain valid.',
        {
          type: 'note',
          text: 'The granule is a minimum read unit, not a minimum write unit. A part can contain one granule or thousands. A merge can combine parts of different sizes. The 8,192-row default is tuned for modern CPU cache lines and SIMD batch widths -- small enough for efficient vectorized processing, large enough to amortize decompression overhead.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Cost', 'What drives it'],
          rows: [
            ['INSERT (per batch)', 'O(B log B) sort + O(B) columnar write', 'B = batch size; larger batches amortize part overhead'],
            ['Primary index lookup', 'O(log G) binary search', 'G = granules per part; ~122K for 1B rows at default granularity'],
            ['Column scan per granule', 'O(index_granularity * columns_read)', '8,192 rows * number of columns referenced in query'],
            ['Background merge', 'O(N) k-way merge of N rows across input parts', 'Write amplification: each row is rewritten on every merge level'],
            ['Primary index memory', '~16 bytes * G per part', '2 MB per billion rows at default granularity; fits in L3 cache'],
            ['Part count per partition', 'Must stay below merge capacity', 'Default "too many parts" threshold: 300 active parts per partition'],
            ['Compression ratio', '5x-20x per column', 'Sorted order improves compression; LowCardinality and codecs help'],
          ],
        },
        'Read cost is the product of three factors: how many granules the primary index cannot skip (depends on ORDER BY alignment with predicates), how many columns the query reads (depends on schema width and query selectivity), and how many parts exist (depends on insert frequency and merge throughput). A well-designed table reads fewer than 1% of stored granules for a typical dashboard query.',
        {
          type: 'callout',
          text: 'Write amplification from merges is the main hidden cost. Each row may be rewritten 3-5 times across merge levels before reaching a large final part. This is the same tradeoff as LSM trees: fast ingestion in exchange for background compaction work. If the ingest rate exceeds the merge rate, part count grows until the "too many parts" error halts inserts.',
        },
        {
          type: 'note',
          text: 'Practical benchmark: a single ClickHouse node can ingest 1-2 million rows/second and serve analytical queries over billions of rows with sub-second latency -- when ORDER BY matches the query predicates. With a mismatched key, the same hardware scans 10-100x more data per query.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace a dashboard query through the full read path. The table has 100 million rows ordered by (tenant_id, event_time), partitioned by month, with default granularity of 8,192 rows.',
        {
          type: 'code',
          language: 'sql',
          text: "SELECT event_type, sum(metric)\nFROM events\nWHERE tenant_id = 42\n  AND event_time >= '2024-06-01'\n  AND event_time <  '2024-06-02'\nGROUP BY event_type;",
        },
        {
          type: 'table',
          headers: ['Step', 'Action', 'Data touched', 'Data skipped'],
          rows: [
            ['1. Partition pruning', 'WHERE references event_time; only partition 202406 is candidate', '1 partition', '11 other monthly partitions'],
            ['2. Part enumeration', 'List active parts in partition 202406; suppose 5 merged parts', '5 parts', '0 (all parts in partition are candidates)'],
            ['3. Primary index search', 'Binary search primary.idx for tenant_id=42 in each part', '~17 comparisons per part', 'All granules outside tenant 42 range'],
            ['4. Granule narrowing', 'Tenant 42 has ~50K rows; at 8,192 rows/granule, ~6 granules match', '6 granules', '~12,200 granules in partition (99.95% skipped)'],
            ['5. Column selection', 'Query needs event_type, metric; marks give byte offsets', '2 column files * 6 granules', 'tenant_id, event_time, url, country, payload columns'],
            ['6. Decompression', 'Decompress 6 granule blocks from event_type.bin and metric.bin', '~49K rows decompressed', '~100M rows never touched'],
            ['7. Filter + aggregate', 'Apply exact WHERE on decompressed rows, then GROUP BY', '~2K rows match the day filter', '~47K rows in granules that did not match the time range'],
          ],
        },
        {
          type: 'diagram',
          text: 'Part 3 in partition 202406 (example):\n\nprimary.idx:  [t=1,00:00] [t=1,04:00] ... [t=42,14:00] [t=42,22:12] [t=43,00:00] ...\n              granule 0    granule 1       granule 847   granule 848   granule 849\n                                            ^^^^^^^^^^^   ^^^^^^^^^^^\n                                            candidate     candidate\n\nevent_type.bin: ... |skip| ... |skip| ... |#### g847 ####|#### g848 ####| |skip| ...\nmetric.bin:     ... |skip| ... |skip| ... |#### g847 ####|#### g848 ####| |skip| ...\npayload.bin:    NEVER OPENED -- query does not reference this column',
          label: 'Granule selection in a single part for tenant_id = 42',
        },
        'The key numbers: 100 million rows stored, ~49,000 decompressed, ~2,000 matched. The query touched 0.05% of the data. This selectivity comes entirely from three design choices: ORDER BY matching the predicate, columnar storage skipping unneeded columns, and sparse granule indexing skipping unneeded row ranges.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Mismatched ORDER BY: if queries filter on country but the table is ordered by (tenant_id, event_time), the sparse index cannot skip granules for country predicates. The engine falls back to scanning all granules and filtering row by row inside column data.',
            'Tiny inserts: each INSERT creates a new part on disk. Inserting one row at a time creates thousands of tiny parts per minute. Merge backlog grows, metadata overhead accumulates, and eventually ClickHouse rejects inserts with "too many parts" (default threshold: 300 active parts per partition).',
            'OLTP update patterns: MergeTree has no in-place row update. Mutations (ALTER TABLE UPDATE) rewrite entire parts. CollapsingMergeTree and ReplacingMergeTree provide last-write-wins semantics but require merge completion to collapse duplicates -- queries between merges may see stale or duplicate rows.',
            'Over-partitioning: partitioning by hour on a low-volume table creates 24 partitions per day, each with small parts that never merge together. Part count explodes. Merge efficiency drops because merges only combine parts within the same partition.',
            'Primary key uniqueness assumption: engineers from PostgreSQL or MySQL expect PRIMARY KEY to enforce uniqueness. In MergeTree, duplicate ORDER BY values are legal. ReplacingMergeTree deduplicates during merges, but between merges, duplicates coexist.',
            'Wide scans on high-cardinality ORDER BY: ordering by a UUID distributes rows randomly across granules. The sparse index has no contiguous range to skip. Every granule is a candidate for every query.',
          ],
        },
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Mitigation'],
          rows: [
            ['Mismatched ORDER BY', 'High selected_marks / total_marks ratio in query log', 'Redesign ORDER BY to match common predicates; add data-skipping indexes (minmax, bloom)'],
            ['Too many parts', '"Too many parts" error; insert rejection', 'Batch inserts (10K-1M rows per batch); tune merge settings; reduce partition granularity'],
            ['Merge backlog', 'Background merge queue grows; disk I/O saturated', 'Reduce insert frequency; increase merge threads; monitor system.merges'],
            ['Mutation overload', 'Mutations rewrite whole parts; disk and CPU spike', 'Avoid frequent ALTER TABLE UPDATE; use CollapsingMergeTree for logical deletes'],
            ['Over-partitioning', 'Thousands of small parts; merges cannot consolidate', 'Partition by month or week instead of day or hour for low-volume tables'],
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['ClickHouse Docs: MergeTree Engine Family', 'Canonical reference for part structure, ORDER BY, PARTITION BY, settings, and engine variants'],
            ['ClickHouse Docs: Primary Keys and Indexes in Queries', 'Deep guide to sparse indexing, granules, marks, and how the primary index interacts with query predicates'],
            ['Alexey Milovidov, "ClickHouse: Lightning Fast Analytics for Everyone" (2019)', 'Architecture talk covering column storage, vectorized execution, and merge mechanics'],
            ['Robert Hodges, "A Day in the Life of a ClickHouse Query" (Altinity blog)', 'End-to-end query execution walkthrough showing partition pruning, primary index search, and PREWHERE'],
            ['ClickHouse source: src/Storages/MergeTree/', 'Implementation of part structure, merge selection, mark-based reads, and background scheduling'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Database Indexing -- understand dense B-tree indexes to appreciate what MergeTree trades away and what it gains by going sparse.',
            'Prerequisite: LSM Tree -- MergeTree borrows the immutable-sorted-run-plus-compaction pattern from log-structured merge trees. Understanding LSM write amplification and level structure clarifies MergeTree merge behavior.',
            'Extension: Parquet Columnar Format -- Parquet column chunks and row groups are the file-format analog of MergeTree parts and granules. Compare how each handles predicate pushdown and column pruning.',
            'Adjacent case study: RocksDB LSM Case Study -- a key-value LSM engine with similar compaction tradeoffs but row-oriented storage and different query patterns.',
            'Contrasting alternative: Prometheus TSDB Case Study -- another append-optimized time-series store, but block-based rather than columnar, with different compression and indexing strategies.',
            'Extension: Apache Pinot Star-Tree Index Case Study -- a different approach to analytical acceleration that precomputes partial aggregations instead of relying on scan-time skipping.',
          ],
        },
      ],
    },
  ],
};
