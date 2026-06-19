// Greenwald-Khanna quantile summary: deterministic rank intervals for streaming quantiles.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'greenwald-khanna-quantile-summary',
  title: 'Greenwald-Khanna Quantile Summary',
  category: 'Data Structures',
  summary: 'A deterministic streaming quantile summary: store sorted tuples with rank gaps, compress safely, and answer rank queries with epsilon guarantees.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['tuple bounds', 'compress summary'], defaultValue: 'tuple bounds' },
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

function summaryGraph(title) {
  return graphState({
    nodes: [
      { id: 'stream', label: 'in', x: 0.5, y: 3.5, note: 'stream' },
      { id: 'insert', label: 'insert', x: 2.8, y: 3.5, note: 'sorted' },
      { id: 'tuples', label: 'tuples', x: 5.0, y: 3.5, note: 'v,g,d' },
      { id: 'rank', label: 'rank', x: 7.2, y: 1.5, note: 'bounds' },
      { id: 'compress', label: 'compress', x: 7.2, y: 5.6, note: 'safe' },
      { id: 'query', label: 'query', x: 9.4, y: 3.5, note: 'p50/p95' },
    ],
    edges: [
      { id: 'e-stream-insert', from: 'stream', to: 'insert', weight: '' },
      { id: 'e-insert-tuples', from: 'insert', to: 'tuples', weight: '' },
      { id: 'e-tuples-rank', from: 'tuples', to: 'rank', weight: '' },
      { id: 'e-tuples-compress', from: 'tuples', to: 'compress', weight: '' },
      { id: 'e-rank-query', from: 'rank', to: 'query', weight: '' },
      { id: 'e-compress-query', from: 'compress', to: 'query', weight: '' },
    ],
  }, { title });
}

function tupleTable(title) {
  return labelMatrix(
    title,
    [
      { id: 't1', label: '12' },
      { id: 't2', label: '21' },
      { id: 't3', label: '37' },
      { id: 't4', label: '44' },
      { id: 't5', label: '90' },
    ],
    [
      { id: 'v', label: 'v' },
      { id: 'g', label: 'g' },
      { id: 'd', label: 'd' },
      { id: 'range', label: 'rank' },
    ],
    [
      ['12', '1', '0', '1..1'],
      ['21', '2', '1', '3..4'],
      ['37', '3', '2', '6..8'],
      ['44', '1', '2', '7..9'],
      ['90', '2', '0', '10..10'],
    ],
  );
}

function* tupleBounds() {
  yield {
    state: summaryGraph('GK stores rank intervals, not all samples'),
    highlight: { active: ['stream', 'insert', 'tuples', 'e-stream-insert', 'e-insert-tuples'], compare: ['compress'] },
    explanation: 'Greenwald-Khanna keeps a sorted summary of tuples. Each tuple stores a value, a gap from the previous retained value, and slack in its possible rank. The summary answers quantiles without retaining every sample.',
    invariant: 'Every retained value represents a bounded rank interval in the full stream.',
  };

  yield {
    state: tupleTable('Tuple fields'),
    highlight: { active: ['t3:v', 't3:g', 't3:d', 't3:range'], compare: ['t2:range', 't4:range'] },
    explanation: 'The tuple (v, g, d) says: value v has a minimum rank after adding the gaps, and a maximum rank that also includes d. Quantile queries search these rank intervals.',
  };

  yield {
    state: labelMatrix(
      'Query p50 with N=10',
      [
        { id: 'target', label: 'target' },
        { id: 'scan', label: 'scan' },
        { id: 'choose', label: 'choose' },
        { id: 'error', label: 'error' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['rank 5', 'median goal'],
        ['12,21,37', 'walk gaps'],
        ['37', 'covers rank'],
        ['epsilon n', 'bounded'],
      ],
    ),
    highlight: { active: ['target:value', 'scan:meaning'], found: ['choose:value'], compare: ['error:meaning'] },
    explanation: 'The answer is not necessarily an observed exact median. It is a retained value whose rank interval is close enough to the requested rank under the configured epsilon.',
  };

  yield {
    state: labelMatrix(
      'Monitoring case',
      [
        { id: 'need', label: 'need' },
        { id: 'fit', label: 'fit' },
        { id: 'cost', label: 'cost' },
        { id: 'use', label: 'use' },
      ],
      [
        { id: 'detail', label: 'detail' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['p95', 'rank bound'],
        ['one pass', 'streamable'],
        ['more tuples', 'lower eps'],
        ['audit', 'deterministic'],
      ],
    ),
    highlight: { active: ['fit:lesson', 'use:lesson'], compare: ['cost:lesson'] },
    explanation: 'GK is attractive when the product needs a deterministic rank-error contract. It is less tailored to p99 value error than t-digest or DDSketch, but its bound is crisp.',
  };
}

function* compressSummary() {
  yield {
    state: summaryGraph('Compression deletes tuples only when the rank bound survives'),
    highlight: { active: ['tuples', 'compress', 'e-tuples-compress'], compare: ['query'] },
    explanation: 'The summary periodically checks adjacent tuples. If merging two neighbors keeps every possible rank interval within the allowed error, the older tuple can be removed.',
  };

  yield {
    state: labelMatrix(
      'Merge rule sketch',
      [
        { id: 'pair', label: 'pair' },
        { id: 'test', label: 'test' },
        { id: 'merge', label: 'merge' },
        { id: 'keep', label: 'keep' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'result', label: 'result' },
      ],
      [
        ['i,i+1', 'adjacent'],
        ['g+d', '<= budget'],
        ['drop i', 'safe'],
        ['else', 'needed'],
      ],
    ),
    highlight: { active: ['test:result', 'merge:result'], compare: ['keep:result'] },
    explanation: 'The exact GK condition is more formal, but the data-structure idea is simple: a tuple can disappear only if the next tuple can still certify the rank range it used to protect.',
  };

  yield {
    state: tupleTable('Fewer tuples, same rank promise'),
    highlight: { removed: ['t2:v', 't2:g', 't2:d'], found: ['t3:range'], active: ['t4:range'] },
    explanation: 'Compression spends approximation budget to save memory. The summary does not claim every retained value is exact. It claims the rank error is bounded.',
    invariant: 'The summary shrinks by spending rank slack, never by breaking the epsilon contract.',
  };

  yield {
    state: labelMatrix(
      'GK versus neighbors',
      [
        { id: 'gk', label: 'GK' },
        { id: 'kll', label: 'KLL' },
        { id: 'td', label: 't-digest' },
        { id: 'dds', label: 'DDS' },
      ],
      [
        { id: 'style', label: 'style' },
        { id: 'best', label: 'best' },
      ],
      [
        ['det rank', 'audits'],
        ['rand rank', 'compact'],
        ['tail cent', 'latency'],
        ['rel value', 'wide scale'],
      ],
    ),
    highlight: { active: ['gk:style', 'gk:best'], found: ['kll:style', 'dds:best'] },
    explanation: 'GK is the deterministic baseline. KLL improves compactness with randomness. t-digest changes shape for tail resolution. DDSketch changes the error contract to relative value error.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'tuple bounds') yield* tupleBounds();
  else if (view === 'compress summary') yield* compressSummary();
  else throw new InputError('Pick a GK quantile view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Tuple bounds" walks a small GK summary and shows how each tuple certifies a rank interval in the unseen stream. "Compress summary" shows the merge rule that deletes tuples without breaking the rank guarantee.',
        'Active highlights mark the tuple or operation under inspection. Found highlights mark a query result whose rank interval covers the target. Removed highlights show tuples deleted by compression. Compare highlights show neighboring tuples whose rank intervals constrain the decision.',
        'Watch the rank column. Every tuple carries a range like 6..8 meaning the tuple\'s true rank in the full sorted stream falls somewhere in that window. Compression widens a neighbor\'s window; it never lets a window exceed the epsilon budget.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A quantile is a question about rank. The median asks: which value sits at the halfway rank? p95 asks: which value sits at rank 0.95n? Latency dashboards, data quality reports, and streaming analytics need these answers because averages hide tails. A service whose average latency is 50 ms may have a p99 of 3 seconds, and the average will never reveal that.',
        'The hard part is that many systems see data as a stream. Events arrive one at a time, possibly forever. Storing every value and sorting later may be impossible -- the stream is too large, the memory too small, or the query too urgent. The system still needs to answer "what is p50?" and "did p99 move?" without retaining every observation.',
        {
          type: 'quote',
          text: 'The goal is to compute epsilon-approximate quantile summaries of large data sets using as little space as possible, ideally in one pass.',
          attribution: 'Greenwald and Khanna, SIGMOD 2001',
        },
        'The Greenwald-Khanna summary (2001) is the foundational deterministic answer. It keeps a sorted list of tuples, each certifying a small interval of possible ranks. Queries return a retained value whose rank is guaranteed within epsilon * n of the requested rank. No randomness, no luck -- a hard contract.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Keep every value, sort the array, return the element at rank floor(q * n). This is correct, easy to test, and the right choice for small offline batches. Memory is O(n), query time is O(n log n) for sorting or O(log n) with an order-statistic tree. For a million values on a single machine, this works fine.',
        'A fixed histogram is the next temptation. Divide the value range into buckets, count observations per bucket, and interpolate quantiles from cumulative counts. Histograms are small and merge well, but accuracy depends on bucket placement. If many values cluster near a bucket boundary, the value estimate can be wildly wrong. A histogram controls where value buckets sit; it does not control rank error.',
        'Random sampling (reservoir sampling) keeps a fixed-size sample and returns order statistics from the sample. The answer is unbiased in expectation but has no deterministic worst-case guarantee. For audit-grade percentile reporting, "probably close" is not the same contract as "provably within epsilon * n ranks."',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is certification after deletion. A streaming summary must drop most values to stay small. Once values are dropped, exact ranks are lost. The question becomes: can the summary explain how wrong a returned quantile might be? If it cannot, the answer is a guess with a nice API.',
        'Reservoir samples do not carry rank certificates. Fixed histograms hide rank error inside wide or unlucky buckets. Naive subsampling (keep every kth element) has unbounded rank error on adversarial inputs. The Greenwald-Khanna insight is to attach a rank interval to every retained value, so the summary knows exactly how much uncertainty each deletion introduced.',
        'The wall gets sharper in production monitoring. A team makes deployment decisions on p95 or p99. "This is approximately the 95th percentile" is not enough. The system should say what kind of approximation it provides. GK promises rank error: the returned value\'s true rank is within epsilon * n of the requested rank. It does not promise the returned value is close in magnitude to the exact percentile value.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The summary is a sorted list of tuples, each with three fields: value v, gap g, and delta. Together, g and delta define a rank interval for the tuple.',
        {
          type: 'diagram',
          label: 'GK tuple structure',
          text: 'Tuple i: (v_i, g_i, delta_i)\n\n  v_i    = an observed value from the stream\n  g_i    = r_min(i) - r_min(i-1)\n         = gap in minimum rank since previous tuple\n  delta_i = r_max(i) - r_min(i)\n          = uncertainty in this tuple\'s rank\n\n  r_min(i) = sum of g_1 .. g_i      (minimum possible rank)\n  r_max(i) = r_min(i) + delta_i     (maximum possible rank)\n\n  Invariant: for every interior tuple, g_i + delta_i <= floor(2 * epsilon * n)',
        },
        'INSERT finds the sorted position for the new value. A new minimum or maximum enters with delta = 0 because its rank boundary is known exactly. An interior insertion gets delta = floor(2 * epsilon * n) - 1, consuming nearly the full error budget -- compression will tighten things later.',
        {
          type: 'code',
          language: 'javascript',
          text: '// INSERT operation (simplified)\nfunction insert(summary, v, epsilon, n) {\n  // Find position: largest i where summary[i].v <= v\n  let i = findPosition(summary, v);\n\n  // New min or max: rank is known exactly\n  if (i === 0 || i === summary.length) {\n    summary.splice(i, 0, { v, g: 1, delta: 0 });\n  } else {\n    // Interior: delta absorbs current error budget\n    let delta = Math.floor(2 * epsilon * n) - 1;\n    summary.splice(i, 0, { v, g: 1, delta });\n  }\n  n++; // stream count advances\n}',
        },
        'COMPRESS scans adjacent tuples and merges when safe. Tuple i can be deleted if the next tuple i+1 can absorb its gap without exceeding the budget. The merge condition is: g_i + g_{i+1} + delta_{i+1} <= floor(2 * epsilon * n). When tuple i is deleted, g_{i+1} increases by g_i -- the next tuple takes responsibility for the rank range the deleted tuple used to cover.',
        'QUERY for quantile q targets rank r = ceil(q * n). Walk cumulative gaps and find the last tuple whose rank interval overlaps r within the error tolerance. The returned value is an actual observation from the stream, but not necessarily the exact value at rank r. The certificate says: the true rank of this value is within epsilon * n of the requested rank.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof is an invariant argument. Define the invariant: for every interior tuple i, g_i + delta_i <= floor(2 * epsilon * n). The empty summary satisfies it trivially. Insertion preserves it because new tuples are assigned delta values that respect the budget. Compression preserves it because tuples are deleted only when the merge condition holds -- the absorbing tuple\'s combined rank interval stays within budget.',
        'The rank-error guarantee follows directly. For any query rank r, the summary contains a tuple whose minimum rank r_min and maximum rank r_max bracket a range of width at most 2 * epsilon * n. The returned value\'s true rank is therefore within epsilon * n of r (the factor of 2 in the invariant accounts for both sides of the bracket). This holds for every stream prefix, every query, every input distribution. No randomness involved.',
        'The space bound falls out of the invariant. Since each tuple consumes at least 1 unit of the rank range and the total rank range is n, the number of tuples is bounded by O((1/epsilon) * log(epsilon * n)). The log factor comes from a band-based compression schedule that Greenwald and Khanna use to maintain the invariant efficiently across different "ages" of tuples.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Time', 'Notes'],
          rows: [
            ['Insert', 'O(log(1/epsilon) + 1/epsilon)', 'Binary search + shift in sorted array'],
            ['Compress', 'O(1/epsilon * log(epsilon*n))', 'Scan all tuples, periodic'],
            ['Query', 'O(1/epsilon * log(epsilon*n))', 'Walk cumulative gaps'],
            ['Space', 'O(1/epsilon * log(epsilon*n)) tuples', 'Independent of stream length n beyond log factor'],
          ],
        },
        'The space bound is the headline result. For epsilon = 0.01 and n = 10 billion, the summary holds roughly a few thousand tuples -- not 10 billion. Cutting epsilon in half roughly doubles the summary size. The log factor means space grows very slowly with stream length.',
        'Insertion cost depends on representation. An array gives cache-friendly access and binary search for position, but shifting elements costs O(k) where k is the summary size. A balanced tree eliminates shifting but adds pointer overhead. In practice, summaries are small enough that array shifting is fast.',
        'Compression is typically batched: run it every 1/(2*epsilon) insertions rather than after every value. This amortizes the scan cost and keeps the per-insert overhead low.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'GK wins when the product needs a deterministic, auditable rank-error contract. Compliance reporting, SLO verification, one-pass analytics jobs, and embedded telemetry processors benefit from being able to state exactly what the summary promises and prove it holds.',
        'It is the conceptual baseline for all later quantile sketches. Understanding GK makes KLL, t-digest, and DDSketch legible -- each one modifies the error contract, the compression strategy, or the merge behavior, but the core idea of retaining values with rank certificates traces back here.',
        {
          type: 'table',
          headers: ['Sketch', 'Error type', 'Space', 'Merge', 'Best for'],
          rows: [
            ['GK (2001)', 'Deterministic rank', 'O(1/eps * log(eps*n))', 'Hard', 'Auditable single-stream quantiles'],
            ['t-digest (2019)', 'Rank, tail-biased', 'O(1/eps) centroids', 'Easy', 'Latency percentiles (p95, p99)'],
            ['DDSketch (2019)', 'Relative value', 'O(log(max/min)/alpha) bins', 'Easy', 'Values spanning orders of magnitude'],
            ['KLL (2016)', 'Randomized rank', 'O(1/eps * sqrt(log(1/delta)))', 'Easy', 'Space-optimal streaming quantiles'],
            ['Exact sort', 'None', 'O(n)', 'N/A', 'Small offline batches'],
          ],
        },
        'GK is also the right pedagogical tool when the distinction between rank error and value error must be made explicit. A p95 value can jump dramatically at a distribution cliff. GK certifies rank closeness even when the returned value looks surprising. That is not a bug -- it is the contract working as designed.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The most common misunderstanding is value accuracy. GK guarantees rank error, not value error. If a latency distribution has a cliff at a timeout boundary (say 200 ms to 3000 ms), two adjacent ranks may have vastly different values. A returned p99 can be rank-correct and still differ by 2800 ms from the exact p99 value. DDSketch addresses this with relative value error; t-digest addresses it by concentrating precision at the tails.',
        'Merging is the operational weakness. Classic GK is designed for a single stream. Merging two GK summaries requires care -- the rank intervals must be reconciled, and the merged result may need recompression. In high-fanout distributed telemetry (thousands of shards rolling up every minute), KLL, DDSketch, or t-digest fit the operational shape better because they were designed with merge as a first-class operation.',
        {
          type: 'note',
          text: 'Implementation shortcuts break the guarantee. Dropping every kth tuple, compressing by value distance instead of rank condition, or using floating-point comparison around the error budget can produce a small summary with no valid certificate. The tuple fields (v, g, delta) are not decorative metadata -- they are the proof state.',
        },
        'Stream semantics matter too. If the stream mixes tenants, endpoints, or time windows, a quantile answer may be mathematically valid and operationally meaningless. GK answers rank questions over exactly the stream it was fed. It does not fix bad aggregation boundaries.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Greenwald and Khanna, "Space-Efficient Online Computation of Quantile Summaries" (SIGMOD 2001) -- the primary source. Defines the tuple structure, the invariant, the compression rule, and the space bound.',
            'Karnin, Lang, and Liberty, "Optimal Quantile Approximation in Streams" (FOCS 2016) -- the KLL sketch, which achieves optimal space with randomized compaction.',
            'Dunning and Ertl, "Computing Extremely Accurate Quantiles Using t-Digests" (2019) -- tail-biased quantile estimation for latency monitoring.',
            'Masson, Rim, and Lee, "DDSketch: A Fast and Fully-Mergeable Quantile Sketch" (PVLDB 2019) -- relative value error with simple bucket merging.',
          ],
        },
        'Study KLL next to see how randomized compaction improves space and merge behavior while keeping rank-error semantics. Study DDSketch when the contract should be relative value error. Study t-digest for tail-aware percentile summaries where p99 value precision matters more than worst-case rank error.',
        'Then study order-statistic trees (the exact-rank baseline), reservoir sampling (random samples vs. rank certificates), and histogram design (value buckets vs. rank intervals). These topics together clarify three questions that dashboards often blur: which ranks changed, which values changed, and which user-facing objectives were harmed.',
      ],
    },
  ],
};
