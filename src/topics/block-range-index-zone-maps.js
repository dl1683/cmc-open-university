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
  yield {
    state: pruningFlow('Summaries prune whole physical ranges'),
    highlight: { active: ['summary', 'decision'], found: ['skip'], compare: ['scan'] },
    explanation: 'A block-range index does not point to exact rows. It stores a compact summary for each physical range, then uses the summary to prove whether the range can be skipped.',
    invariant: 'A skipped range is guaranteed not to match; a kept range still needs an exact scan.',
  };

  yield {
    state: labelMatrix(
      'Min/max pruning',
      [
        { id: 'r0', label: 'range 0' },
        { id: 'r1', label: 'range 1' },
        { id: 'r2', label: 'range 2' },
        { id: 'r3', label: 'range 3' },
      ],
      [
        { id: 'minmax', label: 'min..max' },
        { id: 'action', label: 'x=250' },
      ],
      [
        ['10..99', 'skip'],
        ['100..199', 'skip'],
        ['200..299', 'read'],
        ['300..399', 'skip'],
      ],
    ),
    highlight: { found: ['r2:action'], removed: ['r0:action', 'r1:action', 'r3:action'] },
    explanation: 'For x = 250, only range 2 can contain a match. The index avoids reading three ranges, but range 2 is only a maybe. Rows inside it still need the normal predicate check.',
  };

  yield {
    state: labelMatrix(
      'Correlation matters',
      [
        { id: 'ordered', label: 'ordered time' },
        { id: 'random', label: 'random uuid' },
        { id: 'clustered', label: 'clustered id' },
        { id: 'mixed', label: 'mixed status' },
      ],
      [
        { id: 'range', label: 'range width' },
        { id: 'pruning', label: 'pruning' },
      ],
      [
        ['narrow', 'strong'],
        ['huge', 'weak'],
        ['narrow', 'strong'],
        ['wide', 'weak'],
      ],
    ),
    highlight: { found: ['ordered:pruning', 'clustered:pruning'], compare: ['random:pruning', 'mixed:pruning'] },
    explanation: 'BRIN and zone maps work when values are correlated with physical layout. Time-series tables, append-only ids, and sorted columnar parts are natural fits. Randomized keys defeat pruning.',
  };

  yield {
    state: labelMatrix(
      'Exact versus pruning indexes',
      [
        { id: 'btree', label: 'B-tree' },
        { id: 'brin', label: 'BRIN' },
        { id: 'zone', label: 'zone map' },
        { id: 'bloom', label: 'skip Bloom' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'answer', label: 'answer' },
      ],
      [
        ['keys -> rows', 'exact path'],
        ['range summary', 'maybe range'],
        ['chunk stats', 'maybe chunk'],
        ['membership bits', 'maybe range'],
      ],
    ),
    highlight: { active: ['brin:stores', 'zone:stores'], compare: ['btree:answer'], found: ['brin:answer', 'zone:answer'] },
    explanation: 'A B-tree finds row locations. A BRIN or zone map mostly removes work. That makes it tiny and cheap to maintain, but it cannot avoid the final scan inside surviving ranges.',
  };
}

function* systemsCaseStudies() {
  yield {
    state: pruningFlow('PostgreSQL BRIN is a block-range summary'),
    highlight: { active: ['summary', 'decision'], found: ['skip', 'scan'] },
    explanation: 'PostgreSQL BRIN stores summaries over consecutive heap block ranges. For physically correlated columns, the planner can skip most of a huge table with a tiny index.',
    invariant: 'BRIN is lossy: it identifies page ranges to recheck, not exact matching rows.',
  };

  yield {
    state: labelMatrix(
      'System patterns',
      [
        { id: 'postgres', label: 'Postgres BRIN' },
        { id: 'clickhouse', label: 'ClickHouse' },
        { id: 'parquet', label: 'Parquet' },
        { id: 'druid', label: 'Druid/OLAP' },
      ],
      [
        { id: 'unit', label: 'unit' },
        { id: 'summary', label: 'summary' },
      ],
      [
        ['block range', 'min/max'],
        ['granule/part', 'sparse marks'],
        ['row group/page', 'stats'],
        ['segment', 'column stats'],
      ],
    ),
    highlight: { found: ['postgres:summary', 'clickhouse:summary', 'parquet:summary'], active: ['postgres:unit'] },
    explanation: 'Different systems name the unit differently: block ranges, granules, row groups, pages, or segments. The shape is the same: summarize a chunk, then skip chunks that cannot match.',
  };

  yield {
    state: labelMatrix(
      'Tuning knobs',
      [
        { id: 'small', label: 'small ranges' },
        { id: 'large', label: 'large ranges' },
        { id: 'sorted', label: 'sorted load' },
        { id: 'drift', label: 'layout drift' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['precise', 'more metadata'],
        ['tiny index', 'more false keeps'],
        ['strong skip', 'load discipline'],
        ['weak skip', 'recluster/vacuum'],
      ],
    ),
    highlight: { active: ['small:benefit', 'large:cost'], found: ['sorted:benefit'], compare: ['drift:benefit'] },
    explanation: 'The range size is a tradeoff. Smaller ranges prune more precisely but store more summaries. Larger ranges are cheaper but keep more blocks for recheck.',
  };

  yield {
    state: labelMatrix(
      'When it wins',
      [
        { id: 'appendTime', label: 'append time' },
        { id: 'geo', label: 'clustered geo' },
        { id: 'uuid', label: 'random uuid' },
        { id: 'oltp', label: 'OLTP point' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'why', label: 'why' },
      ],
      [
        ['strong', 'physical order'],
        ['good', 'local ranges'],
        ['weak', 'wide summaries'],
        ['usually B-tree', 'exact row needed'],
      ],
    ),
    highlight: { found: ['appendTime:fit', 'geo:fit'], compare: ['uuid:why', 'oltp:fit'] },
    explanation: 'Use range summaries when physical layout predicts values. Use B-trees or hash indexes when every point lookup needs an exact row address.',
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
      heading: 'Why this exists',
      paragraphs: [
        'A large table often spends more time moving bytes than comparing predicates. If a query only needs recent events, a narrow time range, or one clustered region, reading every page just to reject it is wasted work. Block-range indexes and zone maps exist to make that rejection cheap.',
        'The structure stores a small summary for each physical chunk of data instead of storing one entry per row. The summary might be min and max, null counts, bloom bits, or another compact fact. If a predicate cannot overlap the summary, the whole chunk can be skipped before the storage engine reads it.',
        'This is the data-warehouse version of asking a cheap question before an expensive one. Instead of opening every row group, page, segment, or block range, the engine asks: could this chunk possibly contain a matching row?',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious answer is to build a precise B-tree for every searchable column. That works for many OLTP point lookups, but it can be expensive on massive append-heavy tables and it may be unnecessary when the query naturally touches large ranges. Another bad answer is to accept full scans because analytical systems scan anyway. Scanning is still expensive when most row groups cannot possibly match.',
        'A range summary is the middle path. It does not replace exact filtering. It asks a smaller question first: can this chunk be ruled out without opening it?',
        'A third mistake is to expect the summary to answer the query. Zone maps and BRIN-style indexes are usually lossy. They can say no safely; yes means only maybe.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The invariant is simple and strict: a skipped range must be impossible to match. A kept range only means maybe. That is why these indexes are called lossy. They are allowed to produce false positives that get rechecked later; they must never produce false negatives.',
        'The data structure is powerful only when physical layout carries meaning. If event_time rises as rows are appended, each page range has a narrow time interval and a time filter can remove most ranges. If UUIDs are randomly distributed, every range may span nearly the whole domain, so the summary proves almost nothing.',
        'The core tradeoff is metadata size versus pruning precision. Small ranges give tighter summaries and better skipping, but store more metadata. Large ranges keep the index tiny but produce more false keeps.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During write or compaction, the system groups rows into physical chunks: heap block ranges, row groups, pages, parts, granules, or segments. For each chunk it records summary facts such as min, max, null count, row count, bloom membership, or lightweight value distribution.',
        'During read, the predicate is tested against summaries first. If a query asks for x = 250 and a chunk has min = 0 and max = 99, the chunk cannot match and can be skipped. If a chunk has min = 200 and max = 299, the chunk is kept and exact row-level filtering happens later.',
        'The structure works best when load order and query predicates align. Time-series tables, clustered dimensions, sorted files, and partitioned lakehouse data create narrow summaries. Random UUIDs, shuffled loads, and high-cardinality unclustered columns create wide summaries that keep too much.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The first view shows the query flowing through summaries before it reaches the exact scan. That order matters. The summary is not answering the query; it is deciding which physical ranges deserve a real scan.',
        'The min/max frame shows x = 250 keeping only the 200..299 range. Notice the asymmetry: skipped ranges are done, but the kept range still needs row-level predicate checks.',
        'The correlation frame explains why the same structure can look brilliant on ordered time data and useless on shuffled values. Physical layout is part of the index.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because IO is often the expensive part. A tiny summary lookup can avoid reading a large chunk from disk, object storage, or remote cache. Even if the summary is simple, skipping a row group or segment can save substantial time.',
        'It also works because analytical queries often filter on physically correlated columns: event time, ingest id, date partition, customer region, sorted metric ranges, or clustered keys. When values are physically clustered, min/max summaries become strong pruning evidence.',
        'Lossiness is a feature, not a bug, as long as it is one-sided. False positives cost extra scans. False negatives corrupt query results. That is why skipped chunks must be impossible to match under the predicate semantics.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Smaller ranges give better pruning and more metadata. Larger ranges make the index tiny but keep more chunks for recheck. The right range size depends on storage layout, predicate selectivity, update pattern, and how expensive it is to read a false-positive chunk.',
        'Maintenance is the other cost. Bulk loads, updates, deletes, clustering, compaction, and vacuuming can change physical order. The summary must either stay correct or be rebuilt. A stale summary that skips matching rows is not an optimization bug; it is a correctness bug.',
        'There is also a planner tradeoff. If the optimizer overestimates pruning, it may choose a scan path that performs poorly. Good systems expose stats and explain output so users can see how many chunks were skipped and why.',
        'Compression interacts with the tradeoff. Columnar files often compress best in large groups, while pruning wants smaller groups. File layout has to balance compression ratio, metadata size, seek cost, and skip precision.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'PostgreSQL calls this family BRIN, for Block Range INdex. It is aimed at very large tables where indexed values correlate with heap location. Time-series tables, append-only ids, and clustered dimensions are natural fits because each block range summarizes a narrow slice.',
        'Columnar systems use the same idea under names such as zone maps, sparse primary indexes, data skipping indexes, row-group statistics, and segment metadata. ClickHouse can avoid granules; Parquet readers can skip row groups or pages during predicate pushdown.',
        'It wins in large analytical stores, logs, telemetry, time-series tables, lakehouse files, and append-heavy data where exact per-row indexes would be too large or too expensive to maintain.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Do not expect a block-range summary to behave like a B-tree. It does not locate exact rows. It locates candidate ranges. If surviving ranges are large, badly clustered, or too wide, the database still reads and filters a lot of data.',
        'The other failure is stale or misleading layout. Updates, deletes, compaction, clustering, partitioning, and bulk loads change how values sit on disk. A range summary is a claim about the current physical organization of data, not a timeless property of the column.',
        'A third failure is bad predicate semantics. Min/max pruning must understand types, collation, nulls, time zones, encoding, and expression rewrites. A summary that is correct for raw values may not be safe for every transformed predicate.',
        'A fourth failure is using it for OLTP point lookup. If every query needs one exact row by primary key, a B-tree or hash index is usually the right tool. Range summaries are for skipping big chunks, not finding one row address.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: PostgreSQL BRIN docs at https://www.postgresql.org/docs/current/brin.html, PostgreSQL index type overview at https://www.postgresql.org/docs/current/indexes-types.html, ClickHouse sparse primary index docs at https://clickhouse.com/docs/primary-indexes, ClickHouse skipping index docs at https://clickhouse.com/docs/optimize/skipping-indexes, Parquet concepts at https://parquet.apache.org/docs/concepts/, and Parquet format metadata notes at https://github.com/apache/parquet-format/blob/master/README.md. Study Database Indexing, B-Tree, B+ Tree Leaf Sibling Scan Case Study, Parquet Columnar Format, ClickHouse MergeTree, Bloom Filter, and LSM Compaction Strategies next.',
      ],
    },
  ],
};
