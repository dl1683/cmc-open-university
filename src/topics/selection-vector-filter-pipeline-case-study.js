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
      heading: 'What it is',
      paragraphs: [
        'A selection vector is an array of row positions that says which rows in a vectorized batch remain active after a filter or filter-like operation. Instead of copying every surviving value out of every column immediately, the engine can carry positions forward and let later operators read through them.',
        'DuckDB describes Vector as its in-memory execution container and DataChunk as a collection of vectors, with vectorized operators working on fixed-size vectors: https://duckdb.org/docs/current/internals/vector.html. Velox documents dictionary vectors as a way to represent filter results without copying data: https://facebookincubator.github.io/velox/develop/vectors.html. The MonetDB/X100 paper explains the broader vectorized execution lineage: https://www.cidrdb.org/cidr2005/papers/P19.pdf.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'The structure is small: a count plus an array of integer row ids. But it changes the execution contract. A predicate can produce [1, 2, 4] for a five-row batch; downstream expressions, projections, and join probes then read only positions 1, 2, and 4 from their input vectors.',
        'Engines often specialize the all-selected and none-selected cases. If every row passes, no selection vector is needed. If no rows pass, the operator can return an empty batch. The middle case is where selection vectors earn their keep.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A query scans a log table with timestamp, tenant_id, severity, message, headers, and JSON payload. The predicate uses only timestamp and tenant_id. A vectorized engine evaluates those narrow columns first, builds a selection vector, and touches message and payload only for surviving rows.',
        'That is late work avoidance in miniature. The engine is not merely scanning faster; it is refusing to materialize irrelevant values until the data flow proves they matter.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Selection vectors are not free. Indirection can hurt CPU prefetching, branch predictability, and SIMD density. For dense selections over cheap fixed-width values, compacting may be better. For sparse selections over wide or nested values, carrying indices usually wins.',
        'The trap is treating selection vectors as an implementation detail. They are the control plane for vectorized execution: they decide which rows remain live without rewriting every column at every operator boundary.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study DuckDB Vectorized Execution Case Study, Apache Arrow Columnar Memory Case Study, Velox Unified Execution Engine Case Study, Dictionary Vector Copy Avoidance, Late Materialization Columnar Scan, SQL Join Algorithms Primer, and Parquet Columnar Format Case Study next.',
      ],
    },
  ],
};
