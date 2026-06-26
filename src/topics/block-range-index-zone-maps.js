// Block-range indexes and zone maps: tiny summaries over physical ranges that
// prove which blocks cannot match a predicate.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'block-range-index-zone-maps',
  title: 'Block Range Indexes & Zone Maps',
  category: 'Systems',
  summary: 'A sparse pruning index: store min/max or other summaries per block range, then skip ranges that cannot satisfy the query.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['range pruning', 'systems case studies'], defaultValue: 'range pruning' },
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

function pruningFlow(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.8, y: 3.2, note: 'WHERE x' },
      { id: 'summary', label: 'summary', x: 2.7, y: 3.2, note: 'min/max' },
      { id: 'decision', label: 'decide', x: 4.6, y: 3.2, note: 'overlap?' },
      { id: 'skip', label: 'skip/read', x: 6.5, y: 3.2, note: 'range' },
      { id: 'scan', label: 'exact scan', x: 8.4, y: 3.2, note: 'inside range' },
    ],
    edges: [
      { id: 'e-query-summary', from: 'query', to: 'summary' },
      { id: 'e-summary-decision', from: 'summary', to: 'decision' },
      { id: 'e-decision-skip', from: 'decision', to: 'skip' },
      { id: 'e-skip-scan', from: 'skip', to: 'scan' },
    ],
  }, { title });
}

function* rangePruning() {
  const flowTitle = 'Summaries prune whole physical ranges';
  const flowState = pruningFlow(flowTitle);
  const activeNodes = ['summary', 'decision'];
  const foundNodes = ['skip'];
  const compareNodes = ['scan'];
  yield {
    state: flowState,
    highlight: { active: activeNodes, found: foundNodes, compare: compareNodes },
    explanation: `A block-range index does not point to exact rows. It stores a compact ${activeNodes[0]} for each physical range, then uses the ${activeNodes[1]} step to prove whether the range can be ${foundNodes[0]}ped.`,
    invariant: `A ${foundNodes[0]}ped range is guaranteed not to match; a kept range still needs an exact ${compareNodes[0]}.`,
  };

  const ranges = [
    { id: 'r0', label: 'range 0' },
    { id: 'r1', label: 'range 1' },
    { id: 'r2', label: 'range 2' },
    { id: 'r3', label: 'range 3' },
  ];
  const queryCol = 'x=250';
  const rangeValues = [
    ['10..99', 'skip'],
    ['100..199', 'skip'],
    ['200..299', 'read'],
    ['300..399', 'skip'],
  ];
  const matchIdx = rangeValues.findIndex(r => r[1] === 'read');
  const skippedCount = rangeValues.filter(r => r[1] === 'skip').length;
  yield {
    state: labelMatrix(
      'Min/max pruning',
      ranges,
      [
        { id: 'minmax', label: 'min..max' },
        { id: 'action', label: queryCol },
      ],
      rangeValues,
    ),
    highlight: { found: [`${ranges[matchIdx].id}:action`], removed: ranges.filter((_, i) => i !== matchIdx).map(r => `${r.id}:action`) },
    explanation: `For ${queryCol}, only ${ranges[matchIdx].label} (${rangeValues[matchIdx][0]}) can contain a match. The index avoids reading ${skippedCount} ranges, but ${ranges[matchIdx].label} is only a maybe. Rows inside it still need the normal predicate check.`,
  };

  const corrRows = [
    { id: 'ordered', label: 'ordered time' },
    { id: 'random', label: 'random uuid' },
    { id: 'clustered', label: 'clustered id' },
    { id: 'mixed', label: 'mixed status' },
  ];
  const corrValues = [
    ['narrow', 'strong'],
    ['huge', 'weak'],
    ['narrow', 'strong'],
    ['wide', 'weak'],
  ];
  const strongRows = corrRows.filter((_, i) => corrValues[i][1] === 'strong');
  const weakRows = corrRows.filter((_, i) => corrValues[i][1] === 'weak');
  yield {
    state: labelMatrix(
      'Correlation matters',
      corrRows,
      [
        { id: 'range', label: 'range width' },
        { id: 'pruning', label: 'pruning' },
      ],
      corrValues,
    ),
    highlight: { found: strongRows.map(r => `${r.id}:pruning`), compare: weakRows.map(r => `${r.id}:pruning`) },
    explanation: `BRIN and zone maps work when values are correlated with physical layout. ${strongRows.map(r => r.label).join(' and ')} have ${corrValues[0][0]} ranges and ${corrValues[0][1]} pruning. ${weakRows[0].label} has a ${corrValues[1][0]} range, defeating pruning.`,
  };

  const indexRows = [
    { id: 'btree', label: 'B-tree' },
    { id: 'brin', label: 'BRIN' },
    { id: 'zone', label: 'zone map' },
    { id: 'bloom', label: 'skip Bloom' },
  ];
  const indexValues = [
    ['keys -> rows', 'exact path'],
    ['range summary', 'maybe range'],
    ['chunk stats', 'maybe chunk'],
    ['membership bits', 'maybe range'],
  ];
  yield {
    state: labelMatrix(
      'Exact versus pruning indexes',
      indexRows,
      [
        { id: 'stores', label: 'stores' },
        { id: 'answer', label: 'answer' },
      ],
      indexValues,
    ),
    highlight: { active: [`${indexRows[1].id}:stores`, `${indexRows[2].id}:stores`], compare: [`${indexRows[0].id}:answer`], found: [`${indexRows[1].id}:answer`, `${indexRows[2].id}:answer`] },
    explanation: `A ${indexRows[0].label} stores ${indexValues[0][0]} and gives an ${indexValues[0][1]}. A ${indexRows[1].label} or ${indexRows[2].label} stores ${indexValues[1][0]} or ${indexValues[2][0]}, mostly removing work. That makes it tiny and cheap to maintain, but it cannot avoid the final scan inside surviving ranges.`,
  };
}

function* systemsCaseStudies() {
  const brinTitle = 'PostgreSQL BRIN is a block-range summary';
  const brinFlow = pruningFlow(brinTitle);
  const brinActive = ['summary', 'decision'];
  const brinFound = ['skip', 'scan'];
  yield {
    state: brinFlow,
    highlight: { active: brinActive, found: brinFound },
    explanation: `PostgreSQL BRIN stores ${brinActive[0]} data over consecutive heap block ranges. For physically correlated columns, the planner uses the ${brinActive[1]} step to ${brinFound[0]} most of a huge table with a tiny index.`,
    invariant: `BRIN is lossy: it identifies page ranges to ${brinFound[1]}, not exact matching rows — the ${brinActive[0]} step proves absence, not presence.`,
  };

  const sysRows = [
    { id: 'postgres', label: 'Postgres BRIN' },
    { id: 'clickhouse', label: 'ClickHouse' },
    { id: 'parquet', label: 'Parquet' },
    { id: 'druid', label: 'Druid/OLAP' },
  ];
  const sysCols = [
    { id: 'unit', label: 'unit' },
    { id: 'summary', label: 'summary' },
  ];
  const sysValues = [
    ['block range', 'min/max'],
    ['granule/part', 'sparse marks'],
    ['row group/page', 'stats'],
    ['segment', 'column stats'],
  ];
  yield {
    state: labelMatrix('System patterns', sysRows, sysCols, sysValues),
    highlight: { found: sysRows.slice(0, 3).map(r => `${r.id}:${sysCols[1].id}`), active: [`${sysRows[0].id}:${sysCols[0].id}`] },
    explanation: `Different systems name the ${sysCols[0].label} differently: ${sysValues.map(v => v[0]).join(', ')}. The shape is the same: summarize a chunk with ${sysCols[1].label} data, then skip chunks that cannot match.`,
  };

  const tuneRows = [
    { id: 'small', label: 'small ranges' },
    { id: 'large', label: 'large ranges' },
    { id: 'sorted', label: 'sorted load' },
    { id: 'drift', label: 'layout drift' },
  ];
  const tuneCols = [
    { id: 'benefit', label: 'benefit' },
    { id: 'cost', label: 'cost' },
  ];
  const tuneValues = [
    ['precise', 'more metadata'],
    ['tiny index', 'more false keeps'],
    ['strong skip', 'load discipline'],
    ['weak skip', 'recluster/vacuum'],
  ];
  yield {
    state: labelMatrix('Tuning knobs', tuneRows, tuneCols, tuneValues),
    highlight: { active: [`${tuneRows[0].id}:${tuneCols[0].id}`, `${tuneRows[1].id}:${tuneCols[1].id}`], found: [`${tuneRows[2].id}:${tuneCols[0].id}`], compare: [`${tuneRows[3].id}:${tuneCols[0].id}`] },
    explanation: `The range size is a tradeoff. ${tuneRows[0].label} prune with ${tuneValues[0][0]} ${tuneCols[0].label} but pay ${tuneValues[0][1]}. ${tuneRows[1].label} yield a ${tuneValues[1][0]} but suffer ${tuneValues[1][1]}.`,
  };

  const winRows = [
    { id: 'appendTime', label: 'append time' },
    { id: 'geo', label: 'clustered geo' },
    { id: 'uuid', label: 'random uuid' },
    { id: 'oltp', label: 'OLTP point' },
  ];
  const winCols = [
    { id: 'fit', label: 'fit' },
    { id: 'why', label: 'why' },
  ];
  const winValues = [
    ['strong', 'physical order'],
    ['good', 'local ranges'],
    ['weak', 'wide summaries'],
    ['usually B-tree', 'exact row needed'],
  ];
  const strongFits = winRows.filter((_, i) => winValues[i][0] === 'strong' || winValues[i][0] === 'good');
  yield {
    state: labelMatrix('When it wins', winRows, winCols, winValues),
    highlight: { found: strongFits.map(r => `${r.id}:${winCols[0].id}`), compare: [`${winRows[2].id}:${winCols[1].id}`, `${winRows[3].id}:${winCols[0].id}`] },
    explanation: `${strongFits.map(r => r.label).join(' and ')} are ${strongFits.map((_, i) => winValues[i][0]).join('/')} fits because of ${strongFits.map((_, i) => winValues[i][1]).join(' and ')}. ${winRows[2].label} is ${winValues[2][0]} due to ${winValues[2][1]}, and ${winRows[3].label} usually needs a ${winValues[3][0].replace('usually ', '')}.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'range pruning') yield* rangePruning();
  else if (view === 'systems case studies') yield* systemsCaseStudies();
  else throw new InputError('Pick a block-range-index view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "range pruning" view walks through a single query against four physical chunks of data. Each chunk carries a min/max summary. Watch the query predicate test each summary, skip the chunks that cannot match, and hand surviving chunks to an exact scan. The key frame is the skip/read decision: that is the only thing a block-range index does.',
        'Switch to "systems case studies" to see how PostgreSQL BRIN, ClickHouse sparse indexes, and Parquet row-group stats all implement the same idea with different vocabulary. The correlation matrix in the first view is the most important frame: it shows that the same index structure is brilliant or useless depending on how well values cluster on disk.',
        {type: 'image', src: './assets/gifs/block-range-index-zone-maps.gif', alt: 'Animated walkthrough of the block range index zone maps visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Databases spend most of their time on I/O, not comparison. A query that needs rows from January in a table spanning five years will read 60 months of data and throw away 59 months\' worth. The CPU cost of the predicate check is trivial; the disk or network cost of fetching those pages is not. Block-range indexes exist to avoid fetching pages that provably contain no matching rows.',
        'A block-range index (also called a zone map, sparse index, or data-skipping index) stores a tiny summary for each physical chunk of data. The summary is typically the minimum and maximum value of a column within that chunk. Before reading the chunk, the engine compares the query predicate against the summary. If the predicate falls entirely outside the min/max range, the chunk is skipped without reading a single row.',
        'The idea is old and widespread. PostgreSQL calls it BRIN (Block Range INdex). ClickHouse calls it a sparse primary index. Parquet and ORC store per-row-group and per-page statistics. Apache Druid stores per-segment column metadata. The vocabulary differs; the mechanism is the same: summarize a physical region, test the summary, skip or scan.',
        {type: 'callout', text: 'A block-range index is a lossy proof system: no means impossible, yes means scan and recheck.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious way to speed up lookups is a B-tree index. A B-tree stores a pointer for every distinct key value (or every row, in a non-unique index) and can locate a specific row in O(log n) time. For OLTP workloads that fetch one row by primary key, this is the right answer. But a B-tree for a billion-row append-only table can itself be tens of gigabytes, and every insert must maintain the tree.',
        'The opposite extreme is a full table scan. Analytical databases lean into scans because columnar storage and vectorized execution make them fast. But "fast scan" still means reading every byte of the column from storage. If the table is 500 GB and the query matches 0.1% of it, a full scan reads 499.5 GB of irrelevant data.',
        'A third tempting shortcut is hash-based partitioning. Partition the table by date or region and only scan the relevant partitions. This works well for predicates that align with the partition key, but it is rigid: a query on a non-partition column still scans everything within each partition, and repartitioning a large table is expensive.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The fundamental tension is between index precision and index cost. A B-tree gives exact row-level answers but costs O(n) space and O(log n) per insert to maintain. A full scan costs nothing in index maintenance but reads everything. Neither extreme serves the common analytical pattern: queries that touch a moderate fraction of a massive table, filtered on a column whose values happen to correlate with physical storage order.',
        'Partitioning helps but is coarse. A table partitioned by month still has 30 days of data per partition. If the query wants one hour, the engine scans the entire month partition. Finer partitions (by hour, by minute) create a metadata explosion: millions of tiny files, each with overhead in the catalog, the filesystem, and the query planner.',
        'The wall is this: we need something cheaper than a B-tree, more selective than a full scan, and more flexible than static partitioning. We need it to scale to billions of rows with negligible space overhead, and we need it to degrade gracefully rather than break when the data is not perfectly ordered.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The insight is to exploit a property that already exists in most analytical data: physical clustering. When rows are appended in time order, consecutive pages on disk contain similar timestamps. When data is loaded sorted by customer_id, consecutive blocks contain nearby customer IDs. The physical layout of the data already carries information about value ranges; a block-range index simply records that information explicitly.',
        'For each contiguous chunk of N rows (a "block range" in PostgreSQL, a "granule" in ClickHouse, a "row group" in Parquet), the system stores the minimum and maximum value of the indexed column. A query predicate like WHERE timestamp > \'2025-06-01\' can then be tested against each chunk\'s [min, max] interval. If the query interval does not overlap the chunk interval, the chunk is skipped. If it does overlap, the chunk is read and rows are filtered normally.',
        'The correctness invariant is one-directional and absolute: a skipped chunk must be impossible to contain a matching row. A kept chunk merely might contain a matching row. False positives (keeping a chunk that turns out to have no matches after scanning) are allowed and expected. False negatives (skipping a chunk that does contain matches) are fatal correctness bugs. This one-sided contract is what makes the index lossy but safe.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At write time (or during compaction/merge), the system divides the column\'s data into fixed-size physical chunks. PostgreSQL BRIN uses a configurable number of heap pages per range (default 128 pages, roughly 1 MB). ClickHouse uses granules of 8,192 rows by default. Parquet uses row groups (typically 64-128 MB) subdivided into pages. For each chunk, the system records summary statistics: at minimum, the smallest and largest value in the chunk for the indexed column.',
        'At query time, the engine evaluates the query predicate against each chunk\'s summary before reading any row data. For an equality predicate like x = 250, the test is: is 250 >= min AND 250 <= max? For a range predicate like x BETWEEN 100 AND 200, the test is: does [100, 200] overlap [min, max]? If the test fails, the chunk is skipped entirely. If it passes, the chunk is read and each row is tested against the full predicate.',
        'The summary can be richer than just min/max. PostgreSQL BRIN supports "inclusion" operator classes that store bounding boxes for geometric types, and "bloom" summaries that store a Bloom filter of values per range. ClickHouse data-skipping indexes support minmax, set (storing up to N distinct values), ngrambf_v1 (n-gram Bloom filter for substring searches), and tokenbf_v1 (token Bloom filter). But min/max is the dominant pattern because it is trivially cheap to maintain and reason about.',
        'Multi-column pruning works by storing separate summaries per column per chunk. A predicate like WHERE timestamp > \'2025-06-01\' AND region = \'US\' tests both the timestamp summary and the region summary for each chunk. A chunk is skipped only if at least one column\'s summary proves the predicate cannot match. This is conjunction-friendly: each additional predicate column can only increase the number of skipped chunks.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because I/O dominates analytical query cost. Reading a 128-page chunk from an SSD takes roughly 0.5 ms (128 * 4 KB at 1 GB/s). Testing a min/max summary takes nanoseconds. If the summary eliminates even 50% of chunks, the query runs nearly twice as fast with an index that occupies a few kilobytes. On cloud object storage where each read has 10-50 ms of latency, skipping a chunk saves not just bandwidth but an entire round trip.',
        'It works because real analytical data is physically clustered far more often than random. Event logs arrive in time order. IoT sensor readings are appended monotonically. Data pipelines sort by date before writing Parquet files. Even tables with random inserts develop some clustering after compaction or CLUSTER operations. Perfect correlation is not required; any correlation narrows the min/max interval and improves pruning.',
        'It works because the space overhead is negligible. A BRIN index on a 100 GB table with 128-page ranges stores roughly one min/max pair per megabyte of data. If each min/max pair is 16 bytes, the index is about 1.6 MB: five orders of magnitude smaller than the data. A B-tree index on the same column might be 2-5 GB. This space efficiency means BRIN indexes can be maintained on many columns simultaneously without meaningful storage cost.',
        'The one-sided lossiness is what makes the correctness argument simple. The system never needs to prove that a chunk does contain a match; it only needs to prove that a chunk cannot. A min/max interval that contains the query value is not evidence of a match. It is only the absence of evidence for a skip. This means the worst case is reading chunks you did not need to (performance cost), never missing chunks you should have read (correctness cost).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Space cost is O(C/R) per indexed column, where C is the number of chunks and R is the chunk size. For a 1-billion-row table with 8,192-row granules, there are about 122,000 chunks. Storing a min/max pair (two 8-byte values) per chunk per column costs roughly 1.9 MB per column. This is negligible. A B-tree on the same column might cost 10-30 GB depending on key size and fill factor.',
        'Write cost is O(1) per row amortized. As rows are appended, the system updates the running min and max for the current chunk. When a chunk boundary is crossed, the summary is finalized and a new one starts. There is no tree balancing, no page splitting, no write amplification from index maintenance. This is why BRIN indexes are attractive for high-throughput append workloads.',
        'Read cost per query is O(C) to scan all chunk summaries, plus the actual I/O cost of reading surviving chunks. The summary scan itself is fast because the entire index fits in a few pages. The dominant cost is the false-positive rate: the fraction of chunks that pass the summary test but contain no matching rows. This false-positive rate depends entirely on how well the data is physically clustered with respect to the query predicate.',
        'Maintenance cost is the hidden expense. If updates or deletes change values within a chunk, the summary may become stale. PostgreSQL handles this by widening the min/max range (the min can only decrease, the max can only increase) so that summaries remain conservative. But widened summaries prune less effectively. Periodic VACUUM or REINDEX operations can tighten summaries. Physical reclustering (PostgreSQL CLUSTER, ClickHouse OPTIMIZE) can restore tight correlation at the cost of rewriting the table.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'PostgreSQL BRIN is designed for very large tables (hundreds of millions to billions of rows) where the indexed column correlates with heap tuple insertion order. The canonical example is a time-series table where created_at increases monotonically. A BRIN index on created_at with pages_per_range = 128 can prune 99% of a year-long table for a query that wants one day\'s data, using an index smaller than 1 MB.',
        'ClickHouse uses sparse primary indexes as its default primary index mechanism. The primary key defines the sort order of data within each part, and ClickHouse stores one index mark per granule (8,192 rows). Because the data is physically sorted by the primary key, the index marks form tight min/max boundaries. Additional columns can have data-skipping indexes (minmax, set, Bloom filter) that further prune granules.',
        {type: 'image', src: 'https://clickhouse.com/docs/assets/ideal-img/sparse-primary-indexes-09c.bea857c.48.png', alt: 'ClickHouse sparse primary index and projection layout.', caption: 'Sparse primary indexes summarize physical layout so queries can choose fewer candidate ranges. (Source: clickhouse.com)'},
        'Parquet and ORC store column statistics (min, max, null count, distinct count) at both the row-group level and the page level. Query engines like Apache Spark, Trino, DuckDB, and Datafusion use these statistics for predicate pushdown: before decompressing a page, the engine checks whether the predicate can match. Delta Lake and Apache Iceberg add file-level statistics in their metadata layers, enabling data skipping across an entire lakehouse without opening any Parquet file.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when physical layout does not correlate with query predicates. A UUID primary key distributes values uniformly across all chunks. Every chunk\'s min/max range spans nearly the entire UUID space. The summary test passes for every chunk, and the index provides zero pruning. The same problem occurs for any high-cardinality column inserted in random order: status codes that cycle, hash values, or unsorted categorical data.',
        'It fails after heavy updates in mutable systems. PostgreSQL does not move rows when you UPDATE them; the new tuple goes to a different heap page. If a column\'s values change significantly, the min/max ranges widen and pruning degrades. Consider a table where customer_id was originally inserted in sorted order but millions of updates have scattered new values across old block ranges. The BRIN index reports that every range contains every customer_id, reducing it to a full scan with extra overhead.',
        'It fails for predicates that the summary cannot evaluate. A min/max summary on a text column stores the lexicographically smallest and largest string. A LIKE \'%error%\' predicate cannot use this summary because substring containment is unrelated to lexicographic order. Similarly, function-wrapped predicates like WHERE LOWER(email) = \'alice@example.com\' defeat min/max pruning unless the system stores a summary on the transformed expression.',
        'It fails for point lookups in OLTP workloads. If every query fetches exactly one row by primary key, a B-tree finds it in O(log n) I/Os. A BRIN index identifies a candidate range of potentially thousands of rows, all of which must be scanned. The overhead of scanning the range exceeds the overhead of traversing a B-tree. BRIN and zone maps are bulk-skip tools, not row-locating tools.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a PostgreSQL table holds 100 million rows of sensor readings, each 100 bytes wide, for a total data size of about 10 GB. The table is append-only: rows arrive in timestamp order. We create a BRIN index on the timestamp column with pages_per_range = 128. Each heap page is 8 KB and holds about 80 rows, so each block range covers 128 * 80 = 10,240 rows. The table has 100,000,000 / 10,240 = approximately 9,766 block ranges.',
        'The BRIN index stores one min/max pair per block range. Each pair is two 8-byte timestamps = 16 bytes. The full index is 9,766 * 16 = 156 KB. Add some per-range overhead (null bitmap, page headers) and the index might reach 200-300 KB. Compare this to a B-tree index on the same column, which would store one entry per row (8-byte key + 6-byte TID = 14 bytes per entry) for roughly 1.4 GB. The BRIN index is about 5,000 times smaller.',
        'A query asks for WHERE timestamp BETWEEN \'2025-06-01\' AND \'2025-06-02\'. One day out of a year-long table is about 1/365 of the data, so roughly 274,000 rows spanning about 27 block ranges. The BRIN scan reads the 300 KB index, tests 9,766 summary entries, finds that 27 ranges overlap the query interval, and reads only those 27 ranges (27 * 128 * 8 KB = 27 MB). The false-positive overhead is minimal because the data is well-clustered: each range spans about 4 minutes of time, and the query window is 24 hours, so boundary ranges contribute at most 2 extra ranges.',
        'Without the BRIN index, the query scans the entire 10 GB table. With it, the query reads 27 MB of data plus 300 KB of index: a 370x reduction in I/O. On an SSD at 1 GB/s sequential read, this is the difference between 10 seconds and 27 milliseconds. On cloud object storage with 20 ms per GET request and 16 MB chunks, the full scan requires roughly 640 requests (10.2 seconds of latency alone), while the BRIN-pruned read requires 2 requests (40 ms).',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The PostgreSQL BRIN documentation at https://www.postgresql.org/docs/current/brin.html is the definitive reference for the implementation: operator classes, pages_per_range tuning, autosummarize, and maintenance. The PostgreSQL index types overview at https://www.postgresql.org/docs/current/indexes-types.html places BRIN in context alongside B-tree, GiST, GIN, and hash indexes.',
        'ClickHouse sparse primary index documentation at https://clickhouse.com/docs/primary-indexes explains how the primary key defines physical sort order and how index marks enable granule skipping. The data-skipping index documentation at https://clickhouse.com/docs/optimize/skipping-indexes covers minmax, set, and Bloom-filter-based skipping indexes layered on top of the primary index.',
        'The Parquet format specification at https://parquet.apache.org/docs/concepts/ describes row-group and page-level statistics. The format metadata details at https://github.com/apache/parquet-format/blob/master/README.md document the ColumnMetaData structure that stores min/max values, null counts, and encodings per column chunk.',
        'Study B-Tree next for the precise-index alternative that BRIN replaces in analytical workloads. Study Bloom Filter for the probabilistic membership test used as an alternative chunk summary. Study Parquet Columnar Format for how row-group statistics integrate with columnar encoding. Study LSM Compaction Strategies for how sorted runs in LSM trees create the physical clustering that makes zone maps effective.',
      ],
    },
  ],
};
