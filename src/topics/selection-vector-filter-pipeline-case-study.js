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
      heading: 'How to read the animation',
      paragraphs: [
        'Treat the selection vector as the live row list for a fixed batch. Active positions are rows still being considered, visited positions were tested, and removed positions are no longer read by downstream operators. The safe inference is that column values can stay in place only while every column shares the same row-number space.',
        {type:'callout', text:'Selection vectors turn row positions into the control plane so filters can kill work before wide values move.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Columnar query engines often reject rows before they need wide columns. A filter on timestamp and tenant_id may decide that only 14 rows matter in a 2,048-row batch. If message, headers, and JSON payload are wide, moving them early wastes memory bandwidth.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to compact after every filter. Allocate new vectors, copy surviving values, and pass a smaller dense batch forward. This is easy to reason about because later operators see row zero through row k as the only live rows.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is copy work before certainty. If the first filter keeps 600 rows and a later filter keeps 20, early compaction copied 580 rows of payload that never mattered. The cost grows with column width, not just row count.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Carry positions instead of values. A selection vector such as [1, 2, 4] says that those physical row positions are live in the original vectors. The payload columns remain stable until an operator truly needs a dense output.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A scan emits a fixed-size chunk. Each predicate loops over the current active positions and writes passing positions into a reusable buffer. Projections, expressions, and join probes read column[position]; sinks or exchanges can materialize later when dense layout is worth the copy.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on one invariant: position i names the same logical row in every column of the chunk. If timestamp[4], tenant[4], and payload[4] belong to the same row, then a single live-position list can guard all of them. Operators that reorder, duplicate, or collapse rows must create a new mapping.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A selection vector trades copying for indirection. With 2,048 rows and 16-bit positions, the live list is at most 4 KB, while copying a 1 KB JSON payload for 600 rows costs about 600 KB. When almost every row survives and values are small, dense compaction may beat scattered reads.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Selection vectors appear in vectorized SQL engines, columnar scans, late materialization, expression evaluators, and hash-join probes. They fit workloads where cheap predicates over narrow columns protect expensive decoding or copying of wide columns.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The pattern fails when the next operator needs tight streaming over cheap fixed-width values and most rows survive. It also fails if a mutable selection buffer is reused while another operator still holds a reference. Row-expanding operators such as joins and unnest need richer mappings.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A 2,048-row log chunk first keeps 612 rows by timestamp, then 117 by tenant, then 14 by severity. Immediate compaction after the first filter would copy six columns for 612 rows. A selection pipeline rewrites a small position list three times and touches message bodies only for the final 14 rows.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study DuckDB vectors and DataChunks, Apache Arrow columnar memory, MonetDB/X100 vectorized execution, Velox dictionary vectors, late materialization, bitmap indexes, and SQL join algorithms. Compare selection vectors with bitmaps: one preserves ordered positions, the other is better for set algebra.',
      ],
    },
  ],
};
