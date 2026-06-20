// Selection vectors in vectorized query execution: filter once, carry row
// positions forward, and avoid copying cold columns until needed.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'selection-vector-filter-pipeline-case-study',
  title: 'Selection Vector Filter Pipeline',
  category: 'Systems',
  summary: 'How vectorized engines keep active row positions in a selection vector so filters, projections, and later operators can avoid copying whole batches.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['filter pipeline', 'selection economics'], defaultValue: 'filter pipeline' },
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

function selectGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'scan', label: 'scan', x: 0.7, y: 4.0, note: notes.scan ?? 'columns' },
      { id: 'chunk', label: 'chunk', x: 2.1, y: 4.0, note: notes.chunk ?? '2048 rows' },
      { id: 'pred', label: 'pred', x: 3.6, y: 2.3, note: notes.pred ?? 'date>=' },
      { id: 'sel', label: 'sel', x: 5.0, y: 4.0, note: notes.sel ?? 'row ids' },
      { id: 'expr', label: 'expr', x: 6.4, y: 2.3, note: notes.expr ?? 'uses sel' },
      { id: 'cols', label: 'cols', x: 6.4, y: 5.7, note: notes.cols ?? 'cold' },
      { id: 'proj', label: 'proj', x: 7.8, y: 4.0, note: notes.proj ?? 'project' },
      { id: 'out', label: 'out', x: 9.2, y: 4.0, note: notes.out ?? 'batch' },
    ],
    edges: [
      { id: 'e-scan-chunk', from: 'scan', to: 'chunk' },
      { id: 'e-chunk-pred', from: 'chunk', to: 'pred' },
      { id: 'e-pred-sel', from: 'pred', to: 'sel' },
      { id: 'e-sel-expr', from: 'sel', to: 'expr' },
      { id: 'e-sel-cols', from: 'sel', to: 'cols' },
      { id: 'e-expr-proj', from: 'expr', to: 'proj' },
      { id: 'e-cols-proj', from: 'cols', to: 'proj' },
      { id: 'e-proj-out', from: 'proj', to: 'out' },
    ],
  }, { title });
}

function* filterPipeline() {
  yield {
    state: selectGraph('A vectorized scan emits a fixed-size chunk'),
    highlight: { active: ['scan', 'chunk', 'e-scan-chunk'], compare: ['pred'] },
    explanation: 'A vectorized engine scans columns into a DataChunk or RecordBatch. Instead of calling an operator once per row, it gives downstream operators a batch of positions with typed column vectors.',
    invariant: 'The batch shape is stable even when later operators keep only a subset of rows.',
  };

  yield {
    state: labelMatrix(
      'Predicate over one vector',
      [
        { id: 'r0', label: 'r0' },
        { id: 'r1', label: 'r1' },
        { id: 'r2', label: 'r2' },
        { id: 'r3', label: 'r3' },
        { id: 'r4', label: 'r4' },
      ],
      [
        { id: 'date', label: 'date' },
        { id: 'ok', label: 'ok?' },
        { id: 'sel', label: 'sel' },
      ],
      [
        ['01', 'no', '-'],
        ['05', 'yes', '1'],
        ['07', 'yes', '2'],
        ['02', 'no', '-'],
        ['09', 'yes', '4'],
      ],
    ),
    highlight: { active: ['r1:sel', 'r2:sel', 'r4:sel'], removed: ['r0:sel', 'r3:sel'] },
    explanation: 'The filter evaluates a predicate vector and writes surviving row positions into a selection vector. The selected positions here are [1, 2, 4]. No payload columns need to be copied yet.',
  };

  yield {
    state: selectGraph('Downstream expressions read through the selection vector', { sel: '[1,2,4]', expr: 'active', cols: 'lazy' }),
    highlight: { active: ['sel', 'expr', 'cols', 'e-sel-expr', 'e-sel-cols'], found: ['pred'] },
    explanation: 'Projection, expression evaluation, and join probes can index through the selection vector. Cold columns are touched only for rows that survived the filter.',
  };

  yield {
    state: selectGraph('The output can compact rows only at the materialization boundary', { proj: 'compact', out: '3 rows' }),
    highlight: { found: ['sel', 'proj', 'out', 'e-proj-out'], active: ['expr', 'cols'] },
    explanation: 'The copy is delayed until the boundary that truly needs contiguous output. That is the data-structure win: row positions become a cheap control plane for the batch.',
  };
}

function* selectionEconomics() {
  yield {
    state: labelMatrix(
      'Selection vector choices',
      [
        { id: 'dense', label: 'dense' },
        { id: 'sparse', label: 'sparse' },
        { id: 'all', label: 'all' },
        { id: 'zero', label: 'zero' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'move', label: 'move' },
      ],
      [
        ['many', 'skip?'],
        ['few', 'idx'],
        ['all', 'no sel'],
        ['none pass', 'empty'],
      ],
    ),
    highlight: { active: ['sparse:move', 'all:move', 'zero:move'], compare: ['dense:move'] },
    explanation: 'Selection is not always the same structure. If every row survives, the engine can avoid a selection vector. If no rows survive, it returns an empty chunk. The interesting middle case carries positions.',
    invariant: 'The cheapest representation depends on selectivity.',
  };

  yield {
    state: labelMatrix(
      'Copy versus index',
      [
        { id: 'cheap', label: 'int col' },
        { id: 'wide', label: 'wide str' },
        { id: 'nested', label: 'nested' },
        { id: 'join', label: 'join out' },
      ],
      [
        { id: 'copy', label: 'copy' },
        { id: 'idx', label: 'idx' },
      ],
      [
        ['ok', 'ok'],
        ['costly', 'best'],
        ['costly', 'best'],
        ['fanout', 'dict'],
      ],
    ),
    highlight: { found: ['wide:idx', 'nested:idx', 'join:idx'], compare: ['wide:copy'] },
    explanation: 'For fixed-width primitives, copying selected values may be fine. For strings, nested arrays, maps, or join fanout, carrying indices or dictionary wrappers can avoid a lot of memory traffic.',
  };

  yield {
    state: selectGraph('A shared selection vector keeps multiple columns aligned', { sel: 'shared', cols: 'many cols', proj: 'same rows' }),
    highlight: { active: ['sel', 'cols', 'proj', 'e-sel-cols', 'e-cols-proj'], compare: ['expr'] },
    explanation: 'The same selection vector can apply to every column in the batch. That preserves row alignment without copying each column into a newly compacted shape immediately.',
  };

  yield {
    state: labelMatrix(
      'Complete query case',
      [
        { id: 'scan', label: 'scan' },
        { id: 'filter', label: 'filter' },
        { id: 'proj', label: 'proj' },
        { id: 'sink', label: 'sink' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['chunk', 'wide'],
        ['sel idx', 'skew'],
        ['lazy', 'branch'],
        ['compact', 'copy'],
      ],
    ),
    highlight: { active: ['filter:state', 'proj:state'], compare: ['sink:risk'] },
    explanation: 'The complete case is a log table with many columns and one selective timestamp predicate. Selection vectors let the engine filter on a narrow column before touching wide message text or nested payloads.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'filter pipeline') yield* filterPipeline();
  else if (view === 'selection economics') yield* selectionEconomics();
  else throw new InputError('Pick a selection-vector view.');
}

export const article = {
  sections: [
    {
      heading: 'Why selection vectors exist',
      paragraphs: [
        'Selection vectors exist because query engines often learn that a row is dead before they need to touch most of its data. A log table may have a timestamp column, a tenant column, a message string, request headers, and a nested payload. A predicate might only need timestamp and tenant. If the engine can reject rows there, it should not copy or decode the wide columns yet.',
        'The data-structure problem is row identity. A vectorized engine works on a batch of rows at a time, usually a fixed-size chunk. Filtering changes the live set inside that chunk, but the original column vectors still hold the values in stable positions. A selection vector is the small structure that says which positions are still active.',
        {type:'callout', text:'Selection vectors turn row positions into the control plane so filters can kill work before wide values move.'},
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The obvious approach is to compact after every filter. Run the predicate, allocate a smaller output vector for each column, copy the surviving values into it, and pass that dense batch downstream. This is easy to reason about. Every later operator sees row 0, row 1, and row 2 as the only surviving rows.',
        'The wall is memory traffic. Copying cheap fixed-width integers may be fine. Copying strings, nested arrays, map values, compressed pages, or many columns after each predicate can dominate the query. Worse, later predicates or joins may discard those copied rows anyway. The engine pays for a tidy batch before it knows that tidiness has value.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'The core idea is simple: carry positions instead of moving values. A predicate over a five-row batch may produce the position list [1, 2, 4]. Downstream expressions, projections, and join probes loop over those positions and index the original vectors. The batch has logically shrunk, but the payload columns have not moved.',
        'The invariant is shared row numbering. Position 4 must mean the same logical row in every column in the chunk: timestamp, tenant, message, headers, and payload. As long as that alignment is preserved, one selection vector can describe the live rows for many columns at once.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The filter-pipeline view shows a narrow predicate producing a list of surviving row ids. The failed rows are not copied into a smaller batch. They are absent from the active-position list. Later nodes keep reading from the original vectors through that list, which is the main idea behind late materialization in a compact form.',
        'The selection-economics view shows why representation choice matters. If every row survives, a special all-rows state may be cheaper than an integer array. If no rows survive, an empty chunk can move forward. If a small middle set survives and the skipped payload is wide, the position list can save large amounts of copying.',
      ],
    },
    {
      heading: 'Mechanism in a vectorized pipeline',
      paragraphs: [
        'A scan operator emits a DataChunk, RecordBatch, or similar container. A predicate evaluates one or more vectors and writes passing row positions into a selection vector. The vector is usually a count plus a small integer buffer. The buffer may be reused across operators to avoid allocation churn.',
        'Later operators have two choices. They can read through the selection vector, or they can materialize a dense output at a boundary that needs one. Projection, expression evaluation, and hash-table probing often work through the position list. A sink, network exchange, or file writer may decide to compact.',
        'Systems often keep several forms: no selection because all rows are active, an empty selection because none are active, a flat position list for a subset, and richer dictionary or indirection vectors when row order or duplication changes. DuckDB Vector and DataChunk internals, Velox dictionary vectors, and the MonetDB/X100 lineage are useful references for this family of ideas.',
      ],
    },
    {
      heading: 'Why it is correct',
      paragraphs: [
        'Correctness comes from preserving the mapping between logical rows and physical positions. If the predicate says row position 2 passes, then every column value at position 2 belongs to the same input row. Reading timestamp[2], tenant[2], and payload[2] is valid because the chunk columns share a row index space.',
        'Composed filters are correct when each filter rewrites the active positions relative to the same base or to the current selected positions in a well-defined way. For example, starting with [1, 2, 4], a second predicate may keep the first and third selected entries, producing [1, 4]. It must not accidentally produce [0, 2] unless those are intended as indexes into the selection vector itself.',
        'Operators that change order or cardinality must end the old contract. A sort, unnest, join fanout, or aggregation may create output rows that are no longer one-to-one with the original positions. At that boundary, the engine should build a new batch, a dictionary mapping, or another explicit representation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a 2048-row log chunk has columns for timestamp, tenant_id, severity, message, headers, and JSON payload. The first predicate checks timestamp. It keeps 612 rows. The second predicate checks tenant_id. It keeps 117 rows. The third predicate checks severity. It keeps 14 rows.',
        'Immediate compaction after the first predicate would copy every selected value from every column, including message and JSON payload for hundreds of rows that later predicates discard. A selection-vector pipeline rewrites a small position list three times. Only when the query needs message or payload for the 14 final rows does it pay to load or copy those values.',
        'The win is not just fewer bytes copied. It is also fewer cache lines touched, fewer decompressions, fewer string buffer references, and less pressure on allocators. The engine keeps narrow predicate work narrow.',
      ],
    },
    {
      heading: 'Cost model',
      paragraphs: [
        'A selection vector trades copy cost for index cost. Copying creates dense vectors that are easy to scan and friendly to SIMD. Indexing avoids moving payload data but adds an extra read and may scatter memory access. The right choice depends on selectivity, value width, predicate order, and the next operator.',
        'Dense selections over cheap primitives may be better compacted. Sparse selections over wide or nested values usually favor positions. For mid-density cases, engines may branch on thresholds: keep a selection vector while the active set is small enough, compact when downstream work will repeatedly scan the same values, or switch to a bitmap when set algebra is the main operation.',
        'Allocation policy matters too. A selection vector is small, but it can be rewritten on every chunk and every predicate. Reusing buffers, keeping counts separate from capacity, and avoiding per-row object creation are part of making the idea fast in real systems.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Selection vectors win in filter pipelines, late materialization, columnar scans, vectorized expression evaluation, and join probes where early predicates are narrow and selective. They are a natural fit when one cheap column can prevent work on many expensive columns.',
        'They also help preserve column alignment. One shared position list can apply to every column in the batch. That means projections do not need to rebuild each column after every filter, and expression evaluators can agree on the live rows without each keeping a private copy of the same subset.',
        'They are especially useful in engines that process fixed-size chunks. The physical chunk can stay stable while the logical live count changes. That keeps operator interfaces regular even when the number of active rows in each chunk varies widely.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Selection vectors fail when almost every row survives and the extra indirection costs more than compaction. They can also lose when the selected positions are highly scattered and the next operator needs tight streaming over cheap fixed-width values. The saved copies may not repay the weaker locality.',
        'They are a poor fit for operators that expand, duplicate, or reorder rows unless paired with a richer mapping. Joins can produce fanout. Unnesting can turn one input row into many output rows. Sorting changes order. Aggregation may collapse many rows into one. In those cases, the old position list no longer describes the output relation.',
        'A subtle bug is stale selection. If an operator keeps a pointer to a mutable selection buffer and another operator rewrites that buffer, later reads can silently use the wrong live set. Clear ownership and lifetime rules matter as much as the integer array itself.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'A practical implementation should model at least four states: all rows active, no rows active, a position list, and a remapping form for duplicate or reordered rows. Treating all of these as one nullable array often leads to confusing branches and slow paths.',
        'Make the indexing contract explicit. A selection entry can mean a base-row position, or it can mean an index into a prior selection. Both designs can work, but mixing them is a correctness bug. Tests should include chained filters, all-pass filters, zero-pass filters, reordered outputs, and wide columns that must not be touched before materialization.',
        'Instrumentation should report active count, base count, representation type, and materialization points. Performance regressions often come from a helper that accidentally compacts a wide column early. A small trace showing selected positions beside candidate counts can catch that mistake quickly.',
      ],
    },
    {
      heading: 'Relationship to nearby structures',
      paragraphs: [
        'Selection vectors, bitmaps, and dictionary vectors all describe subsets or remappings, but they serve different access patterns. A selection vector is an ordered list of positions. A bitmap is compact for set operations and dense membership tests. A dictionary vector lets many logical positions refer to shared payload values and can represent duplication.',
        'Late materialization uses the same idea at a larger scale. Keep cheap identifiers or positions while delaying access to expensive columns. The selection vector is the per-batch control plane that makes that plan concrete inside a vectorized operator pipeline.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study DuckDB Vectorized Execution Case Study, Apache Arrow Columnar Memory Case Study, Velox Unified Execution Engine Case Study, Dictionary Vector Copy Avoidance, Late Materialization Columnar Scan, SQL Join Algorithms Primer, Bitmap Index Compression, and Parquet Columnar Format Case Study next.',
      ],
    },
  ],
};
