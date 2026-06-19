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
        "Read the animation as the execution trace for Dictionary Vector Copy Avoidance. How columnar engines represent filtered, sorted, or joined output as indices into a shared base vector instead of copying repeated values..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Dictionary vectors exist because query operators often reorder, filter, or repeat rows without changing the underlying values. Copying wide strings, nested objects, maps, arrays, or repeated join payloads into a new flat vector can dominate execution time even when the logical operation is simple.',
        'The practical problem is representing a new logical column shape while keeping expensive values shared. A filter might keep rows 0, 4, and 9. A sort might reorder the same values. A join might repeat one probe row twenty times. In all three cases, the logical output is new, but the value payload does not need to be copied immediately.',
        'This is an execution-engine idea, not just a storage-compression trick. A storage dictionary reduces file size by replacing repeated values with codes. An execution dictionary lets live operators pass around a logical vector backed by existing memory.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to materialize a new output vector after every filter, sort, unnest, or join. That gives each logical row its own physical slot.',
        'The wall is fanout and payload width. A join can repeat one probe row many times, and each repeat might include several wide columns. Copying the payload on every repeat wastes memory bandwidth.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A dictionary vector is a base vector plus an index buffer. Logical row i reads base[index[i]]. The index buffer can repeat, reorder, or filter rows while the base values remain unchanged.',
        'It is related to a selection vector but richer. A selection vector carries live positions; a dictionary vector presents those positions as a logical vector that can flow through more operators. The operator sees a column with length N, but the physical payload can still live in a smaller or older base vector.',
        'The same index buffer can be shared by many columns. That matters for joins: if row 3 fans out into rows 10, 11, and 12 of the result, every probe-side column can use the same index buffer to preserve row alignment without duplicating payloads.',
      ],
    },
    {
      heading: 'What the diagram emphasizes',
      paragraphs: [
        'In the dictionary-wrap view, read the base vector as the expensive payload and the index buffer as the new logical order. When two logical rows point to the same base index, the value is repeated in the result without being copied. The null bitmap and expression node show the extra bookkeeping a real engine must preserve.',
        'In the join-fanout view, focus on the output index buffer. A probe row with multiple build-side matches appears multiple times by index. That is the whole trick: fanout grows the logical result while the probe-side columns remain shared until a boundary forces materialization.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The structure has a base vector, index buffer, logical length, null handling, and sometimes nested wrappers. To read logical row i, load j = indices[i], then read base[j]. If the wrapper has its own nulls, the engine combines wrapper nulls with base nulls according to its vector contract.',
        'Operators can either understand the dictionary directly or peel it. If an expression is independent of row order, the engine can run the expression on base values once and wrap the result with the same indices. If an operator needs contiguous values or performs random writes, it may flatten the dictionary into a normal vector.',
        'Velox documents dictionary vectors as a base vector plus indices: https://facebookincubator.github.io/velox/develop/vectors.html. Apache Arrow defines dictionary-encoded layout: https://arrow.apache.org/docs/format/Columnar.html#dictionary-encoded-layout. Parquet defines dictionary encoding for storage pages: https://parquet.apache.org/docs/file-format/data-pages/encodings/.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because logical row identity does not require physical value duplication. The index buffer is enough to map each logical row to a stable base value.',
        'Correctness depends on preserving null semantics, row order, and index alignment across every wrapped column. If dictionaries stack too deeply, engines may peel or flatten them.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is indirection. Dictionary lookup can hurt SIMD density, prefetching, and branch behavior. If the base indices are scattered, each logical row can become a cache miss. Nested dictionary wrappers can multiply the problem if the engine does not compose or flatten index buffers.',
        'The payoff is largest for wide, nested, repeated, or high-fanout values where copying would be more expensive than one extra index lookup. It is weaker for fixed-width primitive columns where copying a tight contiguous vector may be faster than chasing indices.',
        'A good engine treats dictionary use as a physical plan choice. It keeps dictionaries when sharing saves memory traffic, peels them when expression reuse is possible, and flattens them when downstream operators need dense contiguous memory.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Dictionary vectors win in joins with fanout, filtered wide columns, sorted views, unnests, repeated constants, and engines that can pass encoded vectors between operators.',
        'They are especially useful when several output columns share the same index buffer.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'They fail when the values are cheap, the selection is dense, or downstream operators cannot understand dictionary wrappers and immediately flatten them.',
        'They also fail when identity gets confused. A dictionary wrapper must preserve row order, index alignment across columns, and null semantics. A shared index buffer is powerful only if every wrapped column agrees about what logical row i means.',
        'Storage dictionary encoding and execution dictionary vectors are related but not identical. Parquet dictionary pages reduce file size; execution dictionaries reshape live query data. Conflating the two leads to bad mental models and sometimes bad system designs.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A hash join probes a build table and finds multiple matches for some probe rows. Instead of copying every probe-side string, JSON object, and nested list for each emitted match, the engine builds an index buffer such as [0, 0, 2, 3, 3, 3] and wraps the probe columns. Output rows repeat logically while storage stays shared.',
        'Now add an expression after the join, such as upper(customer_name). If customer_name is a probe-side column and the dictionary repeats probe row 3 three times, the engine can compute upper(customer_name) once for base row 3 and preserve the dictionary wrapper. That avoids repeating the same string transformation across fanout.',
        'At the final output boundary, the system may need to serialize rows into a network buffer or file format. That is where late materialization can finally flatten the dictionary. The win came from delaying the copy until it was truly needed.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Track encoding state as part of the vector API. Operators should know whether a column is flat, constant, dictionary wrapped, lazy, or nested, and they should declare which encodings they can consume without flattening. Hidden flattening turns a copy-avoidance design into an accidental copy machine.',
        'Compose dictionaries when possible. If a filter creates indices into a dictionary that already points to a base vector, the engine can often build one composed index buffer instead of stacking wrappers forever. That reduces pointer chasing and keeps row identity easier to reason about.',
        'Measure both memory bytes saved and CPU time spent on indirection. A dictionary over a huge string column may be excellent; a dictionary over a dense int32 column may slow the query. The right choice depends on payload width, index locality, fanout, and downstream support.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Selection Vector Filter Pipeline, Late Materialization Columnar Scan, DuckDB Vectorized Execution Case Study, Velox Unified Execution Engine Case Study, Apache Arrow Columnar Memory Case Study, Parquet Columnar Format Case Study, and SQL Join Algorithms Primer next.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for dictionary-vector-copy-avoidance-case-study, continue to the next topic in the same track.'
  ],
      },
],
};

