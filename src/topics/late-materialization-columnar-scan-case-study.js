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
      heading: 'Why this exists',
      paragraphs: [
        'Late materialization exists because many queries discard most rows before they need wide payload columns. Reading, decoding, and allocating those payloads early wastes I/O, CPU, and memory bandwidth.',
        'The practical problem is row-shaped thinking. A query result is row-shaped, but execution does not have to become row-shaped until the plan proves which rows survive.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is early materialization: read all needed columns, build rows, then filter and join those rows. That keeps operators simple.',
        'The wall is wasted payload work. If a timestamp predicate keeps 3% of rows, reading JSON blobs for the other 97% was unnecessary.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core state is a candidate set: selection vectors, row-id lists, dense ranges, bitmaps, or dictionary wrappers. That state tells later operators which rows remain worth fetching.',
        'Columnar storage makes the idea practical because predicate columns, join keys, and payload columns can be read at different times.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the column-pruning view, watch the plan separate cheap evidence from expensive payload. Date, tenant, status, and join keys are used to prove which row positions remain alive. Message bodies, JSON, structs, and blobs stay cold until the plan has fewer rows to fetch.',
        'In the row-id handoff view, focus on the row-id set as the real intermediate result. The engine is carrying positions through filters and joins. A row-shaped result appears only near the end, after the candidate set is small enough to justify fetching payload values.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The plan reads cheap predicate columns first, uses statistics or page indexes to skip regions, evaluates filters, carries row ids or selections forward, and fetches wide columns only for survivors.',
        'DuckDB documents vector/DataChunk execution: https://duckdb.org/docs/current/internals/vector.html. Parquet page indexes describe page-level statistics: https://parquet.apache.org/docs/file-format/pageindex/. MonetDB/X100 explains vectorized execution and late materialization tradeoffs: https://www.cidrdb.org/cidr2005/papers/P19.pdf.',
        'The handoff representation can change as the candidate set changes. Dense survivors may stay as a range or a selection vector. Sparse survivors may become row-id lists. Set-heavy operations may use bitmaps. Dictionary vectors can represent selected or repeated values without copying the underlying payload.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because filters and joins often reduce candidate rows before payload values are needed. If row identity is preserved, payload fetch can happen later without changing query semantics.',
        'Correctness depends on row-id stability. The engine must preserve the mapping from candidate positions to the original columns until materialization occurs.',
        'The important correctness question is not whether the row has been physically assembled. It is whether every operator can still map its candidate positions back to the same logical row. As long as that mapping is stable, delaying value fetch changes performance, not meaning.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Late materialization can create random access if row ids are sparse and payload columns are compressed in large pages. Sometimes early materialization of a hot narrow column is better.',
        'A robust engine chooses by selectivity, value width, compression block size, cache locality, and downstream operators. Delaying everything blindly can simply move cost later.',
        'Compression interacts with the decision. If a payload page must be decompressed as a whole, fetching one row from many pages may be worse than scanning a compact region once. That is why good engines use statistics, page indexes, clustering, and cost models instead of treating late materialization as a universal rule.',
      ],
    },
    {
      heading: 'Planner decision rule',
      paragraphs: [
        'A useful planner asks a concrete question: will the early operators shrink the candidate set enough to justify carrying row identity instead of carrying payload values? The answer depends on estimated selectivity, row-id density, page clustering, column width, compression block layout, and whether downstream joins or runtime filters can reduce the set again.',
        'The planner should also distinguish latency from total work. A dashboard query may prefer a path that returns the first rows quickly, while a batch export may prefer a sequential scan that burns less total CPU. Late materialization is one knob in that plan, not a moral rule about how engines should always execute.',
      ],
    },
    {
      heading: 'Operational questions',
      paragraphs: [
        'When a query is slow, ask where the engine crossed from column evidence to row payload. Did it decode JSON before filtering by tenant? Did it fetch wide strings before a semi join removed most row ids? Did a runtime filter arrive early enough to avoid payload work, or did it arrive after the expensive scan had already happened?',
        'Those questions make execution plans easier to read. Look for candidate counts after each filter, late-column fetch counts, page skips, materialized bytes, and whether survivor positions are dense or scattered. The goal is not to memorize an operator name; it is to see whether the plan spends expensive work before or after it has earned that expense.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins for columnar logs, analytics tables, Parquet scans, wide JSON payloads, nested columns, selective predicates, semi joins, and runtime-filtered fact scans.',
        'It is strongest when early predicates use narrow columns and late columns are expensive to decode or allocate.',
        'It also wins in teaching because it separates logical query meaning from physical execution shape. SQL describes rows, but the engine can move through column vectors, row ids, bitmaps, and dictionaries before it finally returns rows to the user.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when predicates are not selective, when row ids scatter across too many compressed pages, or when a join expands cardinality before payload fetch.',
        'It also does not fix a bad plan. If the query must read nearly every payload value, late materialization adds bookkeeping without saving work.',
        'It can also make debugging harder because the row a user imagines does not exist as one physical object until late. Engine instrumentation has to show candidate counts, skipped pages, row-id density, and late fetch volume, or the optimization becomes invisible and difficult to tune.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A security log table stores timestamp, tenant_id, status, request_path, message, headers, and JSON payload. The query filters one tenant and status=500, then extracts two JSON fields. A late-materializing engine reads timestamp, tenant_id, and status first, skips row groups using metadata, builds row ids for survivors, and decodes JSON only for the remaining rows.',
        'If only 3% of rows survive, the saved work is not subtle. The engine avoids scanning, decompressing, decoding, and allocating payload values for the 97% of rows the query discards.',
        'Now change the query: remove the tenant filter and request every JSON payload for the last day. Late materialization saves little because nearly every row survives. The same engine should choose a more direct scan path and avoid paying selection bookkeeping for a candidate set that stays dense.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'A practical implementation needs stable row identifiers, per-column access paths, statistics that can reject chunks early, a way to represent survivor sets at different densities, and a clear materialization boundary. Without those pieces, the term late materialization becomes a slogan rather than an execution strategy.',
        'The telemetry should make the decision visible: rows scanned, rows surviving each predicate, row groups skipped, late columns fetched, payload bytes decoded, row-id density, and materialization time. Those numbers tell you whether the optimization saved work or only added a more complex path.',
        'For learners, the key habit is to trace what exists after each operator. If the intermediate state is a row object, the engine has already materialized. If the intermediate state is a set of positions plus references to columns, the engine is still preserving the option to avoid work.',
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
