// DuckDB vectorized execution: DataChunks, tight operators, and embedded OLAP.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'duckdb-vectorized-execution-case-study',
  title: 'DuckDB Vectorized Execution Case Study',
  category: 'Systems',
  summary: 'A modern analytical execution engine: move DataChunks through vectorized operators, keep pipelines cache-friendly, and run OLAP inside the process.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['data chunks', 'pipeline breaker'], defaultValue: 'data chunks' },
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

function duckGraph(title) {
  return graphState({
    nodes: [
      { id: 'scan', label: 'column scan', x: 0.8, y: 3.5, note: 'Parquet/table' },
      { id: 'chunk', label: 'DataChunk', x: 2.5, y: 3.5, note: 'vector batch' },
      { id: 'filter', label: 'filter', x: 4.1, y: 2.2, note: 'selection vector' },
      { id: 'project', label: 'project', x: 4.1, y: 4.8, note: 'expressions' },
      { id: 'hash', label: 'hash aggregate', x: 6.2, y: 3.5, note: 'pipeline breaker' },
      { id: 'sink', label: 'result chunk', x: 8.4, y: 3.5, note: 'client fetch' },
      { id: 'planner', label: 'optimizer', x: 2.5, y: 1.0, note: 'plan shape' },
    ],
    edges: [
      { id: 'e-scan-chunk', from: 'scan', to: 'chunk', weight: 'vectors' },
      { id: 'e-chunk-filter', from: 'chunk', to: 'filter', weight: 'predicate' },
      { id: 'e-filter-project', from: 'filter', to: 'project', weight: 'selected rows' },
      { id: 'e-project-hash', from: 'project', to: 'hash', weight: 'group keys' },
      { id: 'e-hash-sink', from: 'hash', to: 'sink', weight: 'finalize' },
      { id: 'e-planner-scan', from: 'planner', to: 'scan', weight: 'operators' },
      { id: 'e-planner-hash', from: 'planner', to: 'hash', weight: 'pipeline' },
    ],
  }, { title });
}

function* dataChunks() {
  yield {
    state: duckGraph('DuckDB pushes DataChunks through operators'),
    highlight: { active: ['scan', 'chunk', 'filter', 'project', 'e-scan-chunk', 'e-chunk-filter'], compare: ['hash'] },
    explanation: 'DuckDB runs analytical queries inside the host process, but the executor still thinks in batches. A DataChunk is the work unit: many column values move through one operator call instead of one tuple at a time.',
  };

  yield {
    state: labelMatrix(
      'Inside a vectorized batch',
      [
        { id: 'values', label: 'value vector' },
        { id: 'validity', label: 'validity mask' },
        { id: 'selection', label: 'selection vector' },
        { id: 'constants', label: 'constant vector' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'benefit', label: 'benefit' },
      ],
      [
        ['column values', 'tight loops'],
        ['NULL tracking', 'branch control'],
        ['active row ids', 'cheap filtering'],
        ['one value repeated', 'avoid materializing'],
      ],
    ),
    highlight: { active: ['selection:benefit', 'values:benefit'], found: ['constants:benefit'] },
    explanation: 'Selection vectors are the key detail here. A filter can carry active row positions forward, so later operators see the same column buffers plus a smaller set of row ids rather than freshly copied columns.',
    invariant: 'Operators exchange fixed-shape chunks, not arbitrary per-row callbacks.',
  };

  yield {
    state: duckGraph('Columnar scan feeds only the columns the query needs'),
    highlight: { active: ['scan', 'chunk', 'e-scan-chunk'], found: ['planner'], compare: ['project'] },
    explanation: 'Analytical queries usually touch a subset of columns. A columnar scan can produce vectors only for referenced columns, which pairs naturally with Parquet and in-process analytics over local files.',
  };

  yield {
    state: labelMatrix(
      'Row-at-a-time versus vectorized',
      [
        { id: 'iterator', label: 'Volcano iterator' },
        { id: 'vector', label: 'vectorized' },
        { id: 'compiled', label: 'compiled' },
        { id: 'duck', label: 'DuckDB style' },
      ],
      [
        { id: 'unit', label: 'work unit' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['one tuple', 'simple but overhead per row'],
        ['one batch', 'cache-friendly tight loops'],
        ['generated code', 'fast but compile complexity'],
        ['DataChunk pipeline', 'portable embedded OLAP'],
      ],
    ),
    highlight: { found: ['vector:tradeoff', 'duck:tradeoff'], compare: ['iterator:tradeoff'] },
    explanation: 'The case-study point is execution granularity. DuckDB chooses batches large enough for CPU efficiency but still general enough for many operators and platforms.',
  };
}

function* pipelineBreaker() {
  yield {
    state: duckGraph('Hash aggregation breaks a streaming pipeline'),
    highlight: { active: ['project', 'hash', 'e-project-hash'], compare: ['sink'], found: ['planner'] },
    explanation: 'The animation highlights the operator that cannot simply pass chunks along. Hash aggregation has to collect group state first, so it breaks the smooth scan-filter-project pipeline.',
  };

  yield {
    state: labelMatrix(
      'Pipeline roles',
      [
        { id: 'source', label: 'source' },
        { id: 'operator', label: 'operator' },
        { id: 'sink', label: 'sink' },
        { id: 'breaker', label: 'breaker' },
      ],
      [
        { id: 'example', label: 'example' },
        { id: 'job', label: 'job' },
      ],
      [
        ['scan', 'produce chunks'],
        ['filter/project', 'transform chunks'],
        ['aggregate build', 'consume chunks'],
        ['hash join/order by', 'materialize state'],
      ],
    ),
    highlight: { active: ['source:job', 'operator:job', 'sink:job'], compare: ['breaker:job'] },
    explanation: 'The scheduler can split a plan into pipelines. Pipeline breakers define where materialized state, parallel partitioning, and finalization have to be coordinated.',
  };

  yield {
    state: duckGraph('Embedded analytics keeps data movement small'),
    highlight: { active: ['scan', 'planner', 'chunk'], found: ['sink'], compare: ['e-hash-sink'] },
    explanation: 'DuckDB runs inside the host process, so notebooks, scripts, and applications can query local files without shipping data to a separate server first.',
  };

  yield {
    state: labelMatrix(
      'Complete local analytics case study',
      [
        { id: 'read', label: 'read Parquet' },
        { id: 'filter', label: 'filter date' },
        { id: 'group', label: 'group by user' },
        { id: 'export', label: 'export result' },
      ],
      [
        { id: 'engineMove', label: 'engine move' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['scan needed columns', 'schema drift'],
        ['selection vectors', 'predicate selectivity'],
        ['hash aggregate', 'memory pressure'],
        ['result chunks', 'client materialization'],
      ],
    ),
    highlight: { found: ['read:engineMove', 'filter:engineMove', 'group:engineMove'], compare: ['group:risk'] },
    explanation: 'Read this as the end-to-end local analytics path: scan only needed columns, filter by selection vector, aggregate into hash state, then return compact result chunks. The risks are schema drift, selectivity surprises, and memory pressure.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'data chunks') yield* dataChunks();
  else if (view === 'pipeline breaker') yield* pipelineBreaker();
  else throw new InputError('Pick a DuckDB vectorized-execution view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for DuckDB Vectorized Execution Case Study. A modern analytical execution engine: move DataChunks through vectorized operators, keep pipelines cache-friendly, and run OLAP inside the process..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
        {type: "callout", text: "Vectorized execution changes the executor contract from one tuple at a time to fixed-shape column batches, putting CPU time into tight loops instead of per-row dispatch."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `DuckDB exists for a common modern situation: the data is already on your machine or inside your process, and you want serious analytical SQL without shipping everything to a separate database service. A notebook has Parquet files. A Python script has dataframes. An application wants to query local event logs. The user wants OLAP behavior, but the deployment shape is embedded and local.`,
        `That deployment only works if the execution engine is efficient on ordinary CPU hardware. Analytical queries often scan many rows, touch a subset of columns, filter most of them away, and aggregate the survivors. If the engine turns every value into a separate object and calls a virtual function for every row, the CPU spends too much time on overhead rather than useful comparisons, arithmetic, hashing, and memory movement.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The classic naive baseline is row-at-a-time query execution. A scan operator produces one tuple. A filter asks whether that tuple passes. A projection computes expressions for that tuple. A join or aggregate consumes it. The iterator interface is elegant because every operator has the same shape, and complex plans can be composed by wiring operators together.`,
        `That elegance has a price. Analytical queries do the same operation over thousands or millions of values. If each row crosses an operator boundary separately, the engine pays function-call overhead, branch overhead, poor instruction locality, and object materialization costs over and over. The CPU cannot easily use tight loops or cache-friendly column access because the unit of work is too small.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Row-at-a-time execution is not wrong for every workload. It is simple, flexible, and good for teaching query plans. The wall appears when the hot path becomes "call next" millions of times. A filter such as event_date >= X and event_date < Y should be a loop over a vector of dates, not a repeated trip through a tiny interpreter.`,
        `A second naive approach is to load all data into a dataframe or application array and perform analytics there. That can work for small data, but it loses database-engine advantages: projection pushdown, predicate pushdown, SQL optimization, streaming through bounded batches, spill behavior, and structured handling of NULLs, types, joins, and aggregates. DuckDB's design keeps database semantics while making the hot loops batch-shaped.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to make a batch of column vectors the standard unit that moves through the executor. In DuckDB, operators exchange DataChunks. A DataChunk contains vectors for several columns over a bounded set of rows. Instead of "give me the next tuple," the engine asks an operator to process a chunk.`,
        `That change is small at the interface and large in the machine. A filter can loop over a vector of values and produce a selection vector: a compact list of active row positions. A projection can compute an expression over all active positions. A scan can read only the columns the query needs. A constant vector can represent one repeated value without materializing it for every row. NULL handling travels as validity information rather than ad hoc per-row checks scattered through the plan.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A query plan starts with logical operations such as scan, filter, project, join, aggregate, and order. The optimizer chooses a physical plan. The executor then runs that plan as pipelines. A source produces chunks, regular operators transform chunks, and sinks consume chunks. Some sinks later produce output after they have accumulated enough state.`,
        `Consider a local Parquet query: select user_id, count(*) from events where event_date is in one week group by user_id. The scan reads the needed columns, not the entire file. It emits a DataChunk containing vectors for event_date and user_id. The filter evaluates the date predicate over the date vector and creates a selection vector. The group-by aggregate reads only selected user_id positions and updates hash-table state. The final result is returned as another chunk.`,
        `The selection vector is the detail that makes the page worth studying. A filter does not have to copy every surviving value into a new dense column immediately. It can carry row positions forward. Later operators can use the same underlying vector buffers plus the selection vector. That saves memory movement, which is often the real cost in analytical execution.`,
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        `Not every operator can pass each chunk forward immediately. A filter can stream: input chunk in, selected chunk out. A projection can stream. A simple expression can stream. A hash aggregate cannot always stream final answers because it must first build group state across many chunks. A sort must collect enough data to order it. A hash join build side must materialize a hash table before the probe side can use it.`,
        `Those operators are pipeline breakers. They are where memory pressure, spilling, partitioning, and parallel coordination become visible. If a group-by has many distinct keys, the hash table can dominate the query. If an order by is larger than memory, the engine needs an external strategy. The batch interface helps the CPU, but pipeline breakers still need serious database engineering.`,
      ],
    },
    {
      heading: 'How it works (3)',
      paragraphs: [
        `The DataChunk view proves that execution granularity is the central design choice. The scan produces vectors. The filter uses a predicate over vectors. The selection vector carries active row ids. Projection computes expressions over the remaining positions. The visual contrasts that with a Volcano-style iterator so the difference is not just "DuckDB is fast," but "DuckDB changed the unit of work."`,
        `The pipeline-breaker view proves that not all query work is equally streamable. Scan, filter, and projection can pass chunks through a pipeline. Hash aggregation consumes chunks into state before producing final results. That one node explains why memory, spill policy, and parallel partitioning are still necessary even in a vectorized engine.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Vectorized execution works because it matches analytical work to CPU behavior. CPUs are good at loops over contiguous memory, predictable control flow, and repeated operations over arrays. They are less happy when every row becomes a separate object crossing many small interfaces. DataChunks amortize operator overhead across many rows while keeping memory bounded.`,
        `The design also preserves SQL semantics because the vector is not just a raw array. It carries type information, validity bits for NULLs, selection state, and representations for constants or other compact cases. Operators can remain general without reverting to per-row object handling. The engine gets a practical middle ground between simple row iterators and fully compiled query-specific machine code.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `Vectorized execution has its own tuning problems. Chunk size affects cache behavior, function-call amortization, latency to first row, and memory footprint. Too small and the engine pays overhead too often. Too large and it may lose cache locality, increase temporary memory, or delay downstream work.`,
        `Selection vectors reduce copying, but they can also make later access less sequential when many rows are filtered out. Pipeline breakers can dominate runtime regardless of vectorization. A bad join order, huge group cardinality, low-selectivity filter, or large sort can still make a query expensive. Vectorized execution improves the executor's inner loops; it does not magically fix poor plans.`,
        `Embedded execution adds another tradeoff. DuckDB runs inside someone else's process. That makes deployment simple, but it also means memory use, thread use, file access, and result materialization have to behave politely in notebooks, applications, and scripts. A separate warehouse can isolate and schedule many users. An embedded engine trades that service boundary for locality and simplicity.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `DuckDB is strong when analytical data is local or already attached to an application: Parquet files on disk, CSV exploration, Arrow data, dataframes, local logs, tests, demos, embedded product analytics, and command-line investigations. The access pattern is usually scan a few columns, filter, aggregate, join a modest reference table, and return a result that is much smaller than the input.`,
        `A product analyst can query a directory of Parquet files without loading every column into memory. A data tool can embed SQL over user-provided files without running a server. A test suite can run realistic analytical queries in-process. In each case, vectorized execution is not a marketing feature. It is what makes local OLAP feel interactive on ordinary hardware.`,
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        `DuckDB is not the same tool as a distributed warehouse. If the workload needs many concurrent tenants, strict workload isolation, cluster-wide governance, petabyte-scale distributed storage, or long-running shared service operations, a single embedded engine is the wrong abstraction. It may still be useful at the edge of that system, but it is not the whole system.`,
        `Another failure mode is result materialization. A query may scan efficiently and then return an enormous dataframe to the client, moving the bottleneck out of the executor. Schema drift, nested data, large strings, and user-defined functions can also reduce the clean vectorized path. The right question is always where the data is scanned, where it is filtered, where it is materialized, and which operator dominates.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Volcano iterator query execution to understand the row-at-a-time baseline. Study Apache Arrow and Parquet to understand the columnar memory and storage formats that pair naturally with vectorized execution. Study SQL join algorithms, hash aggregation, external sort, and exchange operators to understand pipeline breakers and parallel boundaries. Useful starting sources include DuckDB internals at https://duckdb.org/docs/current/internals/overview, DuckDB vector documentation at https://duckdb.org/docs/current/internals/vector, the DuckDB SIGMOD paper at https://duckdb.org/pdf/SIGMOD2022-demo-duckdb.pdf, and the MonetDB/X100 vectorized execution paper at https://www.cidrdb.org/cidr2005/papers/P19.pdf.`,
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
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why DuckDB Vectorized Execution Case Study moves from input to output in the animation and where it fails, you are ready for the next topic.',
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
],
};

