// Dictionary vectors for copy avoidance: base vectors, index buffers, shared
// selections, join fanout, and nested dictionary peeling.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'dictionary-vector-copy-avoidance-case-study',
  title: 'Dictionary Vector Copy Avoidance',
  category: 'Systems',
  summary: 'How columnar engines represent filtered, sorted, or joined output as indices into a shared base vector instead of copying repeated values.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['dictionary wrap', 'join fanout'], defaultValue: 'dictionary wrap' },
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

function dictGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'base', label: 'base', x: 0.8, y: 4.0, note: notes.base ?? 'values' },
      { id: 'idx', label: 'idx', x: 2.3, y: 4.0, note: notes.idx ?? '0,2,2,4' },
      { id: 'dict', label: 'dict', x: 3.8, y: 4.0, note: notes.dict ?? 'view' },
      { id: 'nulls', label: 'nulls', x: 3.8, y: 2.1, note: notes.nulls ?? 'bitmap' },
      { id: 'expr', label: 'expr', x: 5.3, y: 2.7, note: notes.expr ?? 'peel' },
      { id: 'join', label: 'join', x: 5.3, y: 5.3, note: notes.join ?? 'fanout' },
      { id: 'out', label: 'out', x: 7.1, y: 4.0, note: notes.out ?? 'logical rows' },
      { id: 'copy', label: 'copy?', x: 8.8, y: 4.0, note: notes.copy ?? 'late' },
    ],
    edges: [
      { id: 'e-base-idx', from: 'base', to: 'idx' },
      { id: 'e-idx-dict', from: 'idx', to: 'dict' },
      { id: 'e-base-dict', from: 'base', to: 'dict' },
      { id: 'e-nulls-dict', from: 'nulls', to: 'dict' },
      { id: 'e-dict-expr', from: 'dict', to: 'expr' },
      { id: 'e-dict-join', from: 'dict', to: 'join' },
      { id: 'e-expr-out', from: 'expr', to: 'out' },
      { id: 'e-join-out', from: 'join', to: 'out' },
      { id: 'e-out-copy', from: 'out', to: 'copy' },
    ],
  }, { title });
}

function* dictionaryWrap() {
  yield {
    state: dictGraph('A dictionary vector is a base vector plus an index buffer'),
    highlight: { active: ['base', 'idx', 'dict', 'e-base-idx', 'e-idx-dict', 'e-base-dict'], compare: ['copy'] },
    explanation: 'A dictionary vector does not own a fresh copy of every logical value. It wraps a base vector and uses an index buffer to say which base position appears at each logical row.',
    invariant: 'Logical rows can be reordered or repeated without copying the underlying values.',
  };

  yield {
    state: labelMatrix(
      'Dictionary lookup',
      [
        { id: 'r0', label: 'r0' },
        { id: 'r1', label: 'r1' },
        { id: 'r2', label: 'r2' },
        { id: 'r3', label: 'r3' },
      ],
      [
        { id: 'idx', label: 'idx' },
        { id: 'base', label: 'base' },
        { id: 'val', label: 'val' },
      ],
      [
        ['0', 'red', 'red'],
        ['2', 'blue', 'blue'],
        ['2', 'blue', 'blue'],
        ['4', 'gold', 'gold'],
      ],
    ),
    highlight: { active: ['r1:idx', 'r2:idx', 'r1:val', 'r2:val'], found: ['r0:val'] },
    explanation: 'Rows 1 and 2 both point to base index 2. The logical vector has duplicate blue values, but the large string or nested payload can still live once in the base vector.',
  };

  yield {
    state: dictGraph('Filters and sorts can share the same index wrapper', { idx: 'sel/sort', dict: 'wrap', expr: 'read idx' }),
    highlight: { active: ['idx', 'dict', 'expr', 'e-idx-dict', 'e-dict-expr'], compare: ['copy'] },
    explanation: 'Filtering, sorting, unnesting, and projection can all express a new logical row order with indices. Copying can be delayed until an output boundary or avoided entirely if the consumer understands dictionaries.',
  };

  yield {
    state: labelMatrix(
      'Encoding tradeoffs',
      [
        { id: 'flat', label: 'flat' },
        { id: 'const', label: 'const' },
        { id: 'dict', label: 'dict' },
        { id: 'nested', label: 'nested' },
      ],
      [
        { id: 'best', label: 'best' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['scan', 'copy'],
        ['repeat', 'branch'],
        ['filter', 'indir'],
        ['wide', 'peel'],
      ],
    ),
    highlight: { found: ['dict:best', 'nested:best'], compare: ['dict:risk'] },
    explanation: 'Dictionary vectors trade memory traffic for indirection. Good engines peel shared dictionaries when possible so expressions can run over base values and reuse the index map only at the edges.',
  };
}

function* joinFanout() {
  yield {
    state: dictGraph('Join fanout repeats probe rows without copying them', { base: 'probe', idx: '0,0,2', join: 'matches', out: '3 rows' }),
    highlight: { active: ['base', 'idx', 'dict', 'join', 'e-dict-join', 'e-join-out'], compare: ['copy'] },
    explanation: 'A hash join can produce multiple matches for one probe row. Wrapping probe columns in a dictionary lets the output repeat that row by index instead of copying every probe column for every match.',
    invariant: 'Join output cardinality can grow while probe-side storage stays shared.',
  };

  yield {
    state: labelMatrix(
      'Probe fanout',
      [
        { id: 'p0', label: 'p0' },
        { id: 'p1', label: 'p1' },
        { id: 'p2', label: 'p2' },
        { id: 'p3', label: 'p3' },
      ],
      [
        { id: 'hits', label: 'hits' },
        { id: 'idx', label: 'idx out' },
      ],
      [
        ['2', '0,0'],
        ['0', '-'],
        ['1', '2'],
        ['3', '3,3,3'],
      ],
    ),
    highlight: { active: ['p0:idx', 'p3:idx'], compare: ['p1:idx'] },
    explanation: 'The output index buffer records fanout: probe row 0 appears twice, row 2 once, row 3 three times. The base vector stays unchanged.',
  };

  yield {
    state: dictGraph('Multiple output columns can share the same index buffer', { base: 'all cols', idx: 'shared', dict: 'many dicts', out: 'aligned' }),
    highlight: { active: ['idx', 'dict', 'out', 'e-idx-dict'], found: ['base'], compare: ['nulls'] },
    explanation: 'If many probe-side columns participate in the join output, each column can be wrapped with the same index buffer. That saves memory and keeps row alignment obvious.',
  };

  yield {
    state: labelMatrix(
      'Complete join case',
      [
        { id: 'build', label: 'build' },
        { id: 'probe', label: 'probe' },
        { id: 'fan', label: 'fanout' },
        { id: 'emit', label: 'emit' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'move', label: 'move' },
      ],
      [
        ['hash', 'buckets'],
        ['batch', 'probe'],
        ['idx', 'repeat'],
        ['dict', 'late copy'],
      ],
    ),
    highlight: { found: ['fan:state', 'emit:move'], compare: ['build:move'] },
    explanation: 'The production pattern is a star-schema join where a fact row can match several dimension rows after expansion. Dictionary output keeps fanout from becoming immediate payload duplication.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'dictionary wrap') yield* dictionaryWrap();
  else if (view === 'join fanout') yield* joinFanout();
  else throw new InputError('Pick a dictionary-vector view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The dictionary-wrap view traces a lookup. The base node holds physical payloads. The idx node holds an integer array of base positions. An active edge from idx to dict means the engine resolves logical row i by reading base[indices[i]] instead of copying the value into a new vector.',
        'Active cells in the matrix show which logical rows alias the same base slot. When rows 1 and 2 both carry index 2, the string "blue" exists once in memory; two logical rows point to it.',
        'The join-fanout view traces cardinality growth. Active index entries are the output rows created by build-side matches. The copy node stays in compare state because materialization is deferred.',
        {
          type: 'note',
          text: 'Safe inference rule: if every probe-side output column shares the same index buffer, logical row i refers to one aligned probe row across all columns. The base vector is immutable for the lifetime of every wrapper that references it.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Columnar engines reshape columns constantly. A filter keeps 1% of a batch. A sort reorders it. A hash join repeats one probe row for every build-side match. The logical shape changes every time, but the underlying strings, structs, arrays, and nested objects often do not.',
        'The constraint is memory bandwidth. Copying a 4-byte int32 column is trivial. Copying a batch of 200-byte customer names, JSON profile blobs, and nested tag arrays across a 10x join fanout costs more time than the join probe itself.',
        {
          type: 'quote',
          attribution: 'Velox: Meta\'s Unified Execution Engine (VLDB 2022)',
          text: 'Dictionary encoding in Velox is not a storage optimization -- it is a first-class execution representation that allows operators to share base data and compose index mappings without copying payloads.',
        },
        'A dictionary vector turns "make a new column" into "make an index buffer over an existing column." It is an execution-engine idea, not a file-format trick. Storage dictionaries compress repeated values on disk; execution dictionaries let live operators pass logical vectors backed by existing memory.',
        {type:'callout', text:'Dictionary vectors decouple logical row shape from physical value storage, so filters, sorts, and join fanout can move indices before the engine pays to copy payloads.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Materialize after every operator. A filter writes kept rows into a fresh vector. A sort writes values in sorted order. A hash join emits one full output row per match. Every logical row gets its own physical slot.',
        'This is not wrong. Downstream operators get contiguous memory, predictable iteration, no indirection. For narrow fixed-width columns and dense selections, the flat copy is often the fastest path.',
        {
          type: 'table',
          headers: ['Scenario', 'Rows', 'Payload width', 'Fanout', 'Copy cost'],
          rows: [
            ['Filter int32 key', '1M -> 100K', '4 bytes', '1x', '400 KB -- trivial'],
            ['Filter varchar(200)', '1M -> 100K', '~200 bytes', '1x', '20 MB -- noticeable'],
            ['Join 5x fanout, 3 wide cols', '100K -> 500K', '~600 bytes total', '5x', '300 MB -- dominates query'],
            ['Star join, 4 dims, 10x total', '1M -> 10M', '~1 KB total', '10x', '10 GB -- unacceptable'],
          ],
        },
        'The design starts to fail when operators change row order or cardinality more than they change values. A probe row that matches five build rows does not become five different strings. A sorted column does not need new payloads just because its order changed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is fanout times width times column count. These three multipliers compound.',
        'Concrete failure: a hash join probes 100K fact rows against a dimension table and finds 5 matches per probe row. Output: 500K rows. Each probe row carries three string columns averaging 200 bytes each. Materializing the output copies 500K x 600 = 300 MB of probe-side data, even though only 100K distinct payloads exist. Four out of five copies are pure waste.',
        'The missing invariant in the flat-output design is value identity. The engine needs a way to say "logical row 17 is the same physical value as base row 3" and carry that claim across several columns without breaking row alignment or null semantics.',
        {
          type: 'bullets',
          items: [
            'Fanout grows output rows faster than it grows distinct probe-side values.',
            'Wide variable-length values make each copied row expensive.',
            'Nested values add child buffers, offsets, and null state that must stay consistent across the copy.',
            'Repeated materialization hides quadratic cost inside otherwise cheap operators.',
          ],
        },
        {
          type: 'note',
          text: 'The invariant that breaks: "output size is proportional to useful new information." With eager materialization, output size is proportional to cardinality times width, regardless of how much data is actually new.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate logical row identity from physical value storage. A dictionary vector is a base vector plus an index buffer. Logical row i reads base[indices[i]]. The indices can repeat, reorder, or skip positions while the base values stay in place.',
        {
          type: 'diagram',
          alt: 'Dictionary vector structure: base vector, index buffer, and logical view',
          body: [
            'Base vector (owns the data, immutable):',
            '  [0: "red"]  [1: "green"]  [2: "blue"]  [3: "yellow"]  [4: "gold"]',
            '',
            'Index buffer (defines logical order):',
            '  [0, 2, 2, 4, 0, 4, 4]',
            '',
            'Logical view (what the operator sees):',
            '  row 0 -> base[0] = "red"',
            '  row 1 -> base[2] = "blue"',
            '  row 2 -> base[2] = "blue"     <- same physical string as row 1',
            '  row 3 -> base[4] = "gold"',
            '  row 4 -> base[0] = "red"      <- same physical string as row 0',
            '  row 5 -> base[4] = "gold"     <- same physical string as row 3',
            '  row 6 -> base[4] = "gold"     <- same physical string as rows 3, 5',
          ].join('\n'),
        },
        'A selection vector is related but weaker. It carries surviving positions -- useful for filters, but not composable as a column that flows through subsequent operators. A dictionary vector presents a full column interface: it has a length, supports positional reads, carries null state, and can be passed to expressions, joins, and serializers without special casing.',
        'One index buffer can wrap many columns simultaneously. After a join fans probe row 3 into output rows 10, 11, 12, every probe-side column reuses the identical index array. Row alignment is automatic.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A dictionary wrapper has four parts: a base vector (immutable, owns payloads), an index buffer (int32 array of base positions), a logical length (number of index entries), and an optional null bitmap (marks wrapper-level nulls independent of base nulls).',
        {
          type: 'code',
          language: 'js',
          body: `// Minimal dictionary vector contract
class DictionaryVector {
  constructor(base, indices, nullBitmap = null) {
    this.base = base;        // immutable, shared across wrappers
    this.indices = indices;  // Int32Array, one entry per logical row
    this.length = indices.length;
    this.nulls = nullBitmap; // wrapper-level nulls, separate from base nulls
  }

  valueAt(logicalRow) {
    if (this.nulls && this.nulls.isNull(logicalRow)) return null;
    const baseIdx = this.indices[logicalRow];
    return this.base.isNull(baseIdx) ? null : this.base.valueAt(baseIdx);
  }

  // Compose: collapse Dict(Dict(Flat)) into Dict(Flat)
  reindex(newIndices) {
    const composed = new Int32Array(newIndices.length);
    for (let i = 0; i < newIndices.length; i++) {
      composed[i] = this.indices[newIndices[i]];
    }
    return new DictionaryVector(this.base, composed);
  }
}`,
        },
        'Operators interact with dictionaries in four ways:',
        {
          type: 'table',
          headers: ['Strategy', 'Mechanism', 'Copy cost'],
          rows: [
            ['Consume transparently', 'Follow indices on every read', 'Zero -- reads through indirection'],
            ['Peel and re-wrap', 'Run expression once on base values, re-wrap result with same indices', 'O(unique base values) instead of O(logical rows)'],
            ['Compose', 'Collapse stacked index buffers into one: composed[i] = outer[inner[i]]', 'One pass over outer indices'],
            ['Flatten / materialize', 'Copy base values into a new dense vector', 'Full copy -- last resort at serialization boundaries'],
          ],
        },
        'A filter builds indices for kept rows. A sort builds indices in sorted order. A join builds indices with repeats for probe rows matching multiple build rows. An unnest builds indices repeating the outer row for each child element.',
        {
          type: 'code',
          language: 'js',
          body: `// Wrap all probe columns with shared fanout indices after a join
function wrapProbeColumns(probeBatch, fanoutIndices) {
  return Object.fromEntries(
    Object.entries(probeBatch).map(([name, baseVec]) => [
      name,
      new DictionaryVector(baseVec, fanoutIndices),
    ]),
  );
}

// Peel: run expression on base, re-wrap with same indices
function peelAndApply(dictVec, expr) {
  const baseResult = expr(dictVec.base);  // once per unique value
  return new DictionaryVector(baseResult, dictVec.indices, dictVec.nulls);
}`,
        },
        {
          type: 'note',
          text: 'Wrapper nulls and base nulls are independent. A wrapper row can be null even when the base value is valid (the row was logically deleted). A valid wrapper row can still point at a null base slot (the original value was null). Implementations must union both null sources on every read.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant: for every non-null logical row i, the value observed by any reader is exactly base[indices[i]], with the same type and null semantics as a direct base read. No operator may write through a dictionary index into the base. This immutability guarantee means two logical rows pointing to the same base slot always see the same value.',
        'A filter preserves the invariant because each output index came from a row that passed the predicate. A sort preserves it because the permutation changes order, not value identity. A join preserves it for probe-side columns because each output index records the probe row that produced that match.',
        'Shared indices preserve multi-column row alignment. If columns A, B, and C all wrap different base vectors with the same index buffer, logical row i across all three refers to the same original probe row. Without a shared buffer, each column could be individually correct while the row as a whole is misaligned.',
        'Nested dictionaries are correct when index composition is correct. If outer row i maps to middle row j and middle row j maps to base row k, the composed result must map i directly to k. Composition is an optimization, but transitive lookup must be preserved.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The trade is memory traffic saved against indirection paid. A dictionary read adds one index load before the value load. That extra load can hurt SIMD lane utilization, prefetching, cache locality, and branch-free loops.',
        {
          type: 'table',
          headers: ['Factor', 'Dictionary wins', 'Flat copy wins'],
          rows: [
            ['Payload width', 'Wide strings, nested structs, JSON, lists', 'Narrow fixed-width: int32, float64, date'],
            ['Fanout ratio', 'High: 5x, 10x, or more repeated rows', 'Low: 1:1 or nearly unique'],
            ['Downstream operators', 'Dictionary-aware or peelable', 'Require contiguous dense scans or SIMD'],
            ['Column count', 'Many columns share one index buffer', 'Single column -- index overhead is pure cost'],
            ['Access pattern', 'Sequential scan through index buffer', 'Random access into scattered base positions'],
          ],
        },
        'When input doubles, the index buffer doubles with logical output length, not with physical payload size. If fanout doubles but the same probe rows are repeated, dictionary storage grows by 4 bytes per new index entry; flat storage grows by 4 bytes plus the full payload copy per entry.',
        'Nested dictionaries are the complexity trap. Without composition, each operator stacks a wrapper: logical row -> wrapper index -> base index. Three operators deep, every value access chases three pointers. Good engines compose eagerly: composed[i] = outer.indices[inner.indices[i]], collapsing back to one level.',
        'Memory accounting must track base vector refcounts. A base stays alive as long as any dictionary references it. A query that drops all wrappers except one referencing a single row still pins the entire base vector in memory.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Dictionary vectors fit execution pipelines that move column batches between operators. The strongest cases are operators that change cardinality or order while leaving values physically reusable.',
        {
          type: 'bullets',
          items: [
            'Hash joins: probe-side columns repeat for every build-side match without copying the probe payload. Velox and DuckDB both use this pattern.',
            'Filters: selected rows are an index buffer over the original batch. The base batch stays intact for other operators sharing it.',
            'Sorts and top-k: row order is a permutation over base values. No payload moves.',
            'Unnest / explode: outer columns repeat while inner child values expand. The parent row is shared via index, not copied per child.',
            'Expression peeling: shared dictionaries let the engine run upper(), hash(), or cast() once per unique base value instead of once per logical row.',
            'Columnar interchange: Arrow dictionary-encoded arrays represent values as integer indices into a separate dictionary array, enabling zero-copy IPC between processes.',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Narrow fixed-width columns lose. A dictionary over an int32 column replaces a 4-byte value with a 4-byte index plus a pointer chase. The indirection costs more than the copy it avoids. Dense sequential scans over flat int32 arrays saturate memory bandwidth; dictionary wrappers break that streaming pattern.',
        'Operator boundaries kill the benefit. If the very next operator after a join flattens every dictionary, the system paid for indices and then paid for the full copy anyway. Copy avoidance must be an end-to-end pipeline property, not a local wrapper inserted by one operator and immediately undone by the next.',
        {
          type: 'note',
          text: 'Accidental flattening is a performance bug. Incorrect flattening -- where the wrong index is used or null state is dropped -- is a correctness bug. Every consumer must either preserve the mapping, compose it, or materialize it deliberately.',
        },
        'Null semantics are a common failure point. Reading an index from a wrapper-null row is undefined because that index slot may contain garbage. Implementations must check wrapper nulls before touching the index buffer.',
        'Storage dictionaries are a different idea. Parquet dictionary encoding reduces page size on disk and falls back to plain encoding when cardinality grows. Execution dictionaries reshape live vectors during query processing. They share the integer-to-value pattern but answer different engineering questions. Conflating them leads to designs that decode storage dictionaries into flat vectors only to re-encode them as execution dictionaries -- paying the copy the system was designed to avoid.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A TPC-H-style query joins lineitem (6M rows) against orders (1.5M rows) on order key, with a filter on order status that keeps 500K orders. The join produces roughly 2M output rows (average 4 lineitems per order). Three probe-side columns participate: customer_name (varchar, avg 25 bytes), comment (varchar, avg 50 bytes), order_date (date, 4 bytes).',
        {
          type: 'table',
          headers: ['Strategy', 'customer_name', 'comment', 'order_date', 'Total probe copy'],
          rows: [
            ['Eager materialization', '2M x 25 = 50 MB', '2M x 50 = 100 MB', '2M x 4 = 8 MB', '158 MB'],
            ['Dictionary wrap', '0 (shared base)', '0 (shared base)', '0 (shared base)', '8 MB index buffer'],
          ],
        },
        'The dictionary version allocates one 8 MB index buffer (2M x 4 bytes) shared by all three columns. The base vectors -- the original 500K filtered order rows -- stay in place. Savings: 150 MB of avoided copies.',
        'After the join, the query applies upper(customer_name). The engine peels the dictionary: it runs upper() once over 500K unique base values (12.5 MB of string work) instead of 2M logical rows (50 MB). It wraps the result with the same index buffer. Expression cost drops 4x.',
        'At the final serialization boundary -- Arrow IPC, wire-format rows, or client JSON -- the engine flattens the dictionaries. The copy happens once, at the end, after all filtering, joining, and expression work is complete. Every intermediate operator avoided it entirely.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Make encoding type visible in the vector API. Every operator should know whether its input is flat, constant, dictionary-wrapped, or lazy. Operators declare which encodings they consume natively. If an operator cannot handle dictionaries, the planner inserts an explicit flatten node rather than hiding the copy inside the operator.',
        {
          type: 'bullets',
          items: [
            'Compose eagerly: when a filter produces indices into an existing dictionary, build one composed index buffer instead of stacking wrappers. Two levels are an acceptable transient state; three or more indicate a missing composition pass.',
            'Track base vector refcounts: drop base vectors when no dictionary references them. Log base lifetimes to detect pinning in long-running queries.',
            'Benchmark indirection cost: measure both bytes saved and cycles spent on index chasing. A dictionary over a 4-byte column with unique values is strictly worse than a flat copy.',
            'Peel before expression evaluation: if an expression depends only on base values and not on logical row position, run it on the base and re-wrap. This turns O(logical_rows) work into O(unique_base_values).',
            'Flatten at boundaries: serialize to wire format, write to disk, or hand off to an operator that requires dense input. Flatten once, late, and explicitly.',
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Velox documents dictionary vectors as a first-class execution encoding alongside flat, constant, and lazy vectors. The vector representation page defines the base-plus-indices contract, peel/wrap for expressions, and shared indices for join output: https://facebookincubator.github.io/velox/develop/vectors.html.',
        'Apache Arrow defines dictionary-encoded layout in the columnar memory specification. The encoding carries an index type, a dictionary array, and an ordered flag: https://arrow.apache.org/docs/format/Columnar.html#dictionary-encoded-layout.',
        'Parquet is the contrast case. Its dictionary encoding is a storage-page compression scheme with dictionary pages and RLE/bit-packed index pages, not a live execution wrapper: https://parquet.apache.org/docs/file-format/data-pages/encodings/.',
        'DuckDB uses selection vectors and vector caching for deferred materialization at pipeline boundaries. The internals page describes how vectors flow through operators without eager copying: https://duckdb.org/docs/internals/vector.',
        'Study next by role: Selection Vector Filter Pipeline and Late Materialization Columnar Scan for prerequisite understanding of deferred copies; DuckDB Vectorized Execution Case Study and Velox Unified Execution Engine Case Study for production implementations; Apache Arrow Columnar Memory Case Study and Parquet Columnar Format Case Study for the storage-side encoding that pairs with execution dictionaries; SQL Join Algorithms Primer for the join operators that produce fanout.',
      ],
    },
  ],
};

