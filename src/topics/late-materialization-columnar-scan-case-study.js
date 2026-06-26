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
      heading: 'How to read the animation',
      paragraphs: [
        'The column-pruning view shows cheap evidence columns being read before wide payload columns. Evidence columns are fields used for filtering or joining, such as tenant_id, status, timestamp, and join keys. Payload columns are expensive fields such as JSON, long strings, blobs, or nested structs.',
        'The row-id handoff view shows the intermediate result as positions, not full rows. A row id is a stable reference to a logical row inside the scan. The safe inference is that if row ids are preserved, the engine can fetch payload values later without changing query meaning.',
        {type: 'callout', text: 'Late materialization keeps a candidate set alive until predicates prove which rows deserve expensive payload reads.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'SQL returns rows, but a query engine does not have to build rows early. Many analytic queries discard most rows before they need wide payload columns. Reading and decoding those payloads first wastes I/O, CPU, memory bandwidth, and allocation.',
        'Late materialization delays assembling full rows until filters and joins prove which rows survive. It exists because columnar storage can read different columns at different times. The query result is row-shaped; the execution path can remain column-shaped longer.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is early materialization. Read every column the query might need, build row objects or tuples, then filter, join, and project. This keeps operators simple because every step sees a complete row.',
        'That approach is reasonable for narrow rows or nonselective queries. If the query returns most rows and needs most columns, carrying full rows may be cheaper than maintaining row-id structures. The problem appears when a cheap predicate removes most rows before payload columns are needed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is wasted payload work. If a table has 100 million rows and a predicate keeps 3 percent, early materialization reads payloads for 97 million rows that disappear. The wider and harder-to-decode the payload, the more visible the waste.',
        'The second wall is compression layout. Columnar files often compress pages or row groups, and fetching one sparse row from many pages can be expensive. Late materialization needs a cost model, not a blanket rule to delay everything.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core state is a candidate set. It can be a selection vector, bitmap, row-id list, dense range, or dictionary wrapper. This state records which logical rows are still alive after each predicate or join.',
        'As long as the candidate set preserves row identity, payload fetch can move later. The engine spends cheap work on narrow columns first, then pays expensive decoding only for survivors. The boundary where payload is fetched becomes a planning decision.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The scan reads metadata and cheap columns first. Statistics, zone maps, and Parquet page indexes can skip whole chunks. Vectorized filters produce a survivor set, and joins or runtime filters may shrink it further.',
        'When the survivor set is small or the downstream operator finally needs payload values, the engine fetches late columns for those row ids. Dense survivor sets may stay as ranges or selection vectors. Sparse sets may become row-id lists or bitmaps.',
      ],
    },    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on stable mapping. Every candidate position must still point to the same logical row across all columns. If row id 42 survived the status filter, later fetching payload[42] must retrieve the payload for that same row.',
        'The optimization changes timing, not meaning. A filter on tenant_id and a later JSON extraction produce the same result whether JSON is decoded before or after the filter, provided the candidate set is exact. That is the invariant the animation makes visible.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Late materialization saves work when selectivity is low and payload columns are wide. If 100 million rows have a 2 KB JSON payload, early decoding touches about 200 GB of JSON. If predicates keep 3 million rows, late decoding touches about 6 GB, before compression effects.',
        'The cost is bookkeeping and possible random access. A sparse row-id list can force reads from many compressed pages, and each page may need full decompression. Cost as behavior means the engine should delay expensive columns only when saved payload work exceeds row-id and late-fetch overhead.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'It wins in columnar logs, security analytics, event tables, Parquet scans, wide JSON payloads, selective metadata filters, semi joins, and runtime-filtered fact scans. These workloads often reject most rows using narrow fields before needing large payloads.',
        'It also helps explain modern execution engines. Systems such as DuckDB, columnar lakehouse readers, and vectorized databases can carry vectors, dictionaries, and selection masks before returning rows. SQL describes the result, not the physical order of work.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when predicates are not selective. If 95 percent of rows survive and the query needs the payload for nearly all of them, late materialization adds selection bookkeeping without saving much. A direct scan can be faster.',
        'It also fails when survivors are scattered across many compressed pages. Fetching one row from each of 10,000 pages can be worse than scanning a compact column region once. Good engines use clustering, statistics, page indexes, and measured selectivity to choose.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A security log table has 100 million rows. Columns timestamp, tenant_id, status, and request_path average 40 bytes together, while JSON payload averages 2,000 bytes. The query asks for one tenant, status=500, and two JSON fields.',
        'Early materialization reads about 100 million times 2,040 bytes, or 204 GB before compression. Late materialization reads the 4 GB of cheap columns first. Suppose filters keep 3 percent, or 3 million rows; then JSON decoding reads about 6 GB of payload instead of 200 GB.',
        'If the tenant filter is removed and 90 million rows survive, late materialization reads 4 GB of cheap columns plus about 180 GB of payload and pays selection overhead. The correct planner follows the numbers, not the name of the optimization.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MonetDB/X100 on vectorized execution at https://www.cidrdb.org/cidr2005/papers/P19.pdf, DuckDB vector internals at https://duckdb.org/docs/stable/internals/vector.html, and Parquet page index documentation at https://parquet.apache.org/docs/file-format/pageindex/.',
        'Study selection vectors, dictionary vectors, runtime Bloom filters, zone maps, Parquet row groups and pages, Apache Arrow memory layout, vectorized execution, join algorithms, and cost-based query planning next.',
      ],
    },
  ],
};