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
      heading: 'What it is',
      paragraphs: [
        'A block-range index stores summaries over physical chunks of data instead of one entry per row. The simplest summary is min and max for a column. If a query asks for x = 250 and a range summary says x is 10..99, the system can skip that entire range. If the summary overlaps the query, the range is only a maybe and must be scanned exactly.',
        'PostgreSQL calls this family BRIN, for Block Range INdex. Columnar systems often call the same idea zone maps, sparse primary indexes, data skipping indexes, row-group statistics, or segment metadata. The common shape is lossy pruning: prove absence cheaply, then recheck surviving chunks.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During build or load, divide the table or file into ranges: heap pages, granules, row groups, data pages, or segments. For each range, compute summaries such as min, max, null count, bloom bits, or set membership sketches. At query time, compare the predicate with the summary. Non-overlapping ranges are skipped. Overlapping ranges are read and filtered normally.',
        'The layout relationship is the whole trick. If rows are physically ordered by event_time, then each range has a narrow event_time min/max and time filters prune strongly. If rows are randomly ordered UUIDs, every range may have a huge min/max span and almost nothing can be skipped.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A range-summary index is tiny compared with a B-tree because it stores one summary per range, not one key per row. Build cost is often close to a scan of the table. Query cost depends on selectivity and correlation: first scan the summaries, then read only ranges that might match. False positives are expected at the range level, but false skips must not happen.',
        'Range size is the main tuning knob. Smaller ranges store more metadata but prune more precisely. Larger ranges are cheaper to store and maintain but keep more data for recheck. Production systems choose defaults that trade cache residency, IO size, and predicate selectivity.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'PostgreSQL BRIN is designed for very large tables where indexed values correlate with physical table location. Time-series tables are the classic example: new rows append at the end, so timestamp ranges stay narrow. PostgreSQL can use BRIN to identify page ranges, then recheck rows in those ranges.',
        'ClickHouse MergeTree stores sparse primary-index marks for granules and uses data-skipping indexes to avoid reading chunks. Parquet stores statistics at row group, column chunk, and page levels, allowing readers to skip data during predicate pushdown. These are not identical implementations, but they share the same data-structure idea: compact per-range metadata avoids unnecessary IO.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The biggest misconception is expecting BRIN or zone maps to behave like B-trees. They do not return exact row locations. They return candidate ranges. If surviving ranges are large or poorly correlated, the database still scans many rows. Another trap is building a range index on a shuffled column. Random layout turns min/max summaries into nearly whole-domain summaries.',
        'Range summaries also age with layout. Updates, deletes, compaction, clustering, and partitioning affect whether summaries remain useful. Good systems expose maintenance tools or choose immutable parts so summaries are rebuilt with each part.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL BRIN docs at https://www.postgresql.org/docs/current/brin.html, PostgreSQL index type overview at https://www.postgresql.org/docs/current/indexes-types.html, ClickHouse sparse primary index docs at https://clickhouse.com/docs/primary-indexes, ClickHouse skipping index docs at https://clickhouse.com/docs/optimize/skipping-indexes, Parquet concepts at https://parquet.apache.org/docs/concepts/, and Parquet format metadata notes at https://github.com/apache/parquet-format/blob/master/README.md. Study Database Indexing, B-Tree, B+ Tree Leaf Sibling Scan Case Study, Parquet Columnar Format, ClickHouse MergeTree, Bloom Filter, and LSM Compaction Strategies next.',
      ],
    },
  ],
};
