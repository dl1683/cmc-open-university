// Late materialization in columnar query engines: scan narrow predicates first,
// carry row ids or selection vectors, and fetch wide payload columns only late.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'late-materialization-columnar-scan-case-study',
  title: 'Late Materialization Columnar Scan',
  category: 'Systems',
  summary: 'How columnar engines delay fetching wide payload columns until predicates, row ids, and joins prove which rows are still needed.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['column pruning', 'row id handoff'], defaultValue: 'column pruning' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function materializeGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'plan', label: 'plan', x: 0.6, y: 4.0, note: notes.plan ?? 'needed cols' },
      { id: 'meta', label: 'meta', x: 2.0, y: 2.2, note: notes.meta ?? 'stats' },
      { id: 'scan', label: 'scan', x: 2.0, y: 5.8, note: notes.scan ?? 'narrow' },
      { id: 'pred', label: 'pred', x: 3.7, y: 4.0, note: notes.pred ?? 'filter' },
      { id: 'rid', label: 'rowid', x: 5.2, y: 4.0, note: notes.rid ?? 'positions' },
      { id: 'join', label: 'join', x: 6.6, y: 2.3, note: notes.join ?? 'optional' },
      { id: 'wide', label: 'wide', x: 6.6, y: 5.7, note: notes.wide ?? 'payload' },
      { id: 'mat', label: 'mat', x: 8.1, y: 4.0, note: notes.mat ?? 'fetch late' },
      { id: 'out', label: 'out', x: 9.3, y: 4.0, note: notes.out ?? 'rows' },
    ],
    edges: [
      { id: 'e-plan-meta', from: 'plan', to: 'meta' },
      { id: 'e-plan-scan', from: 'plan', to: 'scan' },
      { id: 'e-meta-pred', from: 'meta', to: 'pred' },
      { id: 'e-scan-pred', from: 'scan', to: 'pred' },
      { id: 'e-pred-rid', from: 'pred', to: 'rid' },
      { id: 'e-rid-join', from: 'rid', to: 'join' },
      { id: 'e-rid-wide', from: 'rid', to: 'wide' },
      { id: 'e-join-mat', from: 'join', to: 'mat' },
      { id: 'e-wide-mat', from: 'wide', to: 'mat' },
      { id: 'e-mat-out', from: 'mat', to: 'out' },
    ],
  }, { title });
}

function* columnPruning() {
  yield {
    state: materializeGraph('The plan separates predicate columns from payload columns'),
    highlight: { active: ['plan', 'scan', 'pred', 'e-plan-scan', 'e-scan-pred'], compare: ['wide'] },
    explanation: 'Late materialization starts in the physical plan. Predicate columns such as date, tenant, and status are scanned first. Wide payload columns such as message text, structs, and blobs stay cold.',
    invariant: 'Do cheap, selective work before fetching expensive values.',
  };

  yield {
    state: labelMatrix(
      'Column budget',
      [
        { id: 'date', label: 'date' },
        { id: 'tenant', label: 'tenant' },
        { id: 'msg', label: 'msg' },
        { id: 'json', label: 'json' },
      ],
      [
        { id: 'phase', label: 'phase' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['early', 'cheap'],
        ['early', 'cheap'],
        ['late', 'wide'],
        ['late', 'wide'],
      ],
    ),
    highlight: { active: ['date:phase', 'tenant:phase'], compare: ['msg:cost', 'json:cost'] },
    explanation: 'Columnar storage makes this possible because columns live separately. The engine can read narrow filter columns, produce row ids, and avoid decoding expensive payloads for rejected rows.',
  };

  yield {
    state: materializeGraph('Page and row-group metadata can skip whole regions', { meta: 'min/max', scan: 'survivors', rid: 'row set' }),
    highlight: { active: ['meta', 'pred', 'rid', 'e-meta-pred', 'e-pred-rid'], found: ['scan'], compare: ['wide'] },
    explanation: 'Zone maps, page indexes, bloom filters, and partition metadata can reject entire chunks before vector filtering even begins. Late materialization composes naturally with those skip structures.',
  };

  yield {
    state: materializeGraph('Only surviving rows fetch wide payload columns', { wide: 'msg/json', mat: 'late fetch', out: 'final' }),
    highlight: { found: ['rid', 'wide', 'mat', 'out', 'e-rid-wide', 'e-wide-mat', 'e-mat-out'], active: ['pred'] },
    explanation: 'At the materialization boundary, row ids or selection vectors fetch payload values for rows that survived. The final output looks row-shaped, but the engine postponed that shape as long as possible.',
  };
}

function* rowIdHandoff() {
  yield {
    state: labelMatrix(
      'Early versus late',
      [
        { id: 'early', label: 'early' },
        { id: 'late', label: 'late' },
        { id: 'hybrid', label: 'hybrid' },
        { id: 'bad', label: 'bad' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['make rows', 'copy'],
        ['row ids', 'rand IO'],
        ['hot cols', 'plan'],
        ['all cols', 'waste'],
      ],
    ),
    highlight: { found: ['late:move', 'hybrid:move'], compare: ['late:risk', 'early:risk'] },
    explanation: 'Late materialization is not always maximal delay. Engines often keep cheap hot columns materialized and delay only wide or rarely used columns. The right choice depends on selectivity and access locality.',
    invariant: 'A row id is a promise to fetch later, not the row itself.',
  };

  yield {
    state: materializeGraph('Row ids pass through a join before payload fetch', { join: 'semi join', wide: 'payload', mat: 'fetch after' }),
    highlight: { active: ['rid', 'join', 'mat', 'e-rid-join', 'e-join-mat'], compare: ['wide'] },
    explanation: 'A semi join or runtime filter can reduce row ids further before payload fetch. This is where late materialization becomes plan-level pruning, not just scan-level laziness.',
  };

  yield {
    state: labelMatrix(
      'Row id representation',
      [
        { id: 'pos', label: 'pos' },
        { id: 'range', label: 'range' },
        { id: 'bitmap', label: 'bitmap' },
        { id: 'dict', label: 'dict' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'best', label: 'best' },
      ],
      [
        ['ids', 'sparse'],
        ['start+len', 'dense'],
        ['bits', 'set ops'],
        ['indices', 'fanout'],
      ],
    ),
    highlight: { active: ['pos:best', 'bitmap:best', 'dict:best'], compare: ['range:best'] },
    explanation: 'The handoff can be positions, ranges, bitmaps, or dictionary wrappers. Each makes a different density assumption. Good engines switch representation instead of forcing one shape everywhere.',
  };

  yield {
    state: materializeGraph('The complete case delays expensive JSON decoding', { pred: 'status=500', rid: '3%', wide: 'json', out: 'alerts' }),
    highlight: { found: ['pred', 'rid', 'wide', 'mat', 'out'], active: ['meta'] },
    explanation: 'A log analytics query filters to status=500 and one tenant, then extracts JSON fields only for the 3% of rows left. Late materialization turns expensive parsing into a late, narrow operation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'column pruning') yield* columnPruning();
  else if (view === 'row id handoff') yield* rowIdHandoff();
  else throw new InputError('Pick a late-materialization view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Late materialization is a columnar execution strategy: delay constructing full rows and fetching expensive columns until filters, joins, and metadata pruning have reduced the candidate set. The engine carries row ids, positions, bitmaps, or dictionary vectors instead of immediately building row objects.',
        'DuckDB vectorized execution documents the vector/DataChunk execution format at https://duckdb.org/docs/current/internals/vector.html. Parquet page indexes describe page-level statistics that can skip data before values are read: https://parquet.apache.org/docs/file-format/pageindex/. The MonetDB/X100 paper is a primary source for vectorized execution and late materialization tradeoffs: https://www.cidrdb.org/cidr2005/papers/P19.pdf.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'The core state is a candidate set. It may be a selection vector for one batch, a row-id list for a scan split, a bitmap for a dense range, or a dictionary wrapper for a logical output vector. That state tells later operators which rows remain worth fetching.',
        'Late materialization depends on column independence. Predicate columns, join keys, and payload columns can be read at different times. That is why it belongs with Parquet, Arrow, DuckDB, Velox, and block-range indexes rather than row-store-only execution.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A security log table stores timestamp, tenant_id, status, request_path, message, headers, and JSON payload. The query filters one tenant and status=500, then extracts two JSON fields. A late-materializing engine reads timestamp, tenant_id, and status first, skips row groups using metadata, builds row ids for survivors, and decodes JSON only for the remaining rows.',
        'If only 3% of rows survive, the saved work is not subtle. The engine avoids scanning, decompressing, decoding, and allocating payload values for the 97% of rows the query will discard.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Late materialization can create random access if row ids are sparse and payload columns are stored in compressed pages. Sometimes early materialization of a hot narrow column is better. A robust engine chooses by selectivity, value width, compression block size, and downstream operators.',
        'It also does not fix bad plans. If a predicate is not selective, or a join expands cardinality before payload fetch, delaying materialization may only move the cost later.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Selection Vector Filter Pipeline, Dictionary Vector Copy Avoidance, Runtime Bloom Filter Join Pruning, Parquet Page Index & Column Offset, Block Range Index & Zone Maps, Apache Arrow Columnar Memory Case Study, DuckDB Vectorized Execution Case Study, and SQL Join Algorithms Primer next.',
      ],
    },
  ],
};
