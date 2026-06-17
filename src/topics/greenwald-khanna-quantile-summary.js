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
      heading: 'Why this exists',
      paragraphs: [
        `A quantile is a statement about rank. The median is the value near the halfway rank. p95 is the value near the rank where 95% of observations are less than or equal to it. Latency dashboards, telemetry systems, data quality reports, and streaming analytics all depend on these questions because averages hide tails.`,
        `The hard part is that many systems see values as a stream. Events arrive one at a time, possibly forever. Storing every value and sorting later may be impossible, too expensive, or too slow for an online service. The system still wants to ask rank questions such as "what is p50?" or "did p99 move?" without retaining the full history.`,
        `The Greenwald-Khanna summary is the classic deterministic answer. It keeps a sorted list of carefully chosen tuples. Each tuple certifies a small interval of possible ranks in the full stream. Queries return a retained value whose rank is guaranteed to be close enough to the requested rank under a configured epsilon.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is exact sorting. Keep every observed value, sort the array, and return the value at rank floor(q * n). This is correct, easy to test, and still the right choice for small offline batches where memory is not a problem.`,
        `A streaming exact variant keeps an ordered tree with counts. Insert each value into the tree and answer select-by-rank queries by walking subtree sizes. That avoids sorting from scratch for every query, but it still keeps exact rank information. Memory grows with the number of distinct values, or with the number of observations if duplicates are stored individually.`,
        `A fixed histogram is another tempting shortcut. Put values into buckets and answer quantiles from bucket counts. Histograms are small and merge well, but their accuracy depends on bucket boundaries. If many values pile up near a boundary, the value estimate can be poor. A histogram controls value buckets; GK controls rank error.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is certification after deletion. A streaming summary must drop most values. Once it drops values, it no longer knows exact ranks. If it cannot explain how wrong a returned quantile might be, the answer is only a guess with a nice API.`,
        `Random samples can be useful, but a reservoir sample does not give the deterministic rank certificate GK is designed to provide. Fixed histograms can be excellent when their bucket design matches the data, but they can hide rank error inside wide or unlucky buckets. The Greenwald-Khanna idea is to attach a rank interval to each retained value so the summary knows what uncertainty it has created.`,
        `The wall gets sharper in monitoring. A team may make deployment decisions based on p95 or p99. It is not enough to say "this is approximately the percentile." The system should say what kind of approximation it is making. GK promises rank error: the returned value's true rank is close to the requested rank. It does not promise small value error.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Store values as rank certificates, not as raw samples. Each retained tuple has the form (v, g, delta). The value v is an observed stream value. The gap g says how far the minimum possible rank has advanced since the previous retained tuple. The delta field records extra uncertainty in the tuple's maximum possible rank.`,
        `Walking the tuples in sorted order gives a lower rank bound for each retained value. Adding delta gives an upper rank bound. The summary therefore does not need every value. It needs enough retained values that every query rank can be covered by a nearby certified interval.`,
        `The invariant is the whole data structure: every retained tuple has a bounded rank interval, and compression is allowed only when the bound remains within the epsilon budget. GK saves memory by spending rank slack, never by silently breaking the rank promise.`,
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        `Insertion first finds the sorted position for the new value. At the ends of the summary, a new minimum or maximum can be inserted with no extra uncertainty because its rank boundary is known. In the interior, the new tuple receives a delta that leaves enough room for uncertainty while respecting the current error budget.`,
        `The running count n matters because epsilon is a fraction of stream length. A rank error of epsilon n grows as the stream grows. That growth is what makes compression possible. Tuples that were necessary early may become mergeable later because the allowed absolute rank slack has increased.`,
        `Compression scans neighboring tuples. A tuple can be removed when the next retained tuple can absorb its gap without making the combined rank interval too wide. The usual condition is a form of g_i + g_{i+1} + delta_{i+1} staying within the rank-error budget. The exact indexing is less important for first understanding than the rule: delete only when the next certificate can cover the lost certificate.`,
        `A query for quantile q targets rank qn. The summary walks cumulative gaps and looks for a retained value whose rank interval is close enough to that target. The result is an actual observed value from the stream, but it is not necessarily the exact value at rank qn. Its certificate says the rank error is within the configured tolerance.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The proof rests on preserving the interval invariant. Insertions add a tuple with a legal possible-rank range. They do not pretend to know the exact rank of every deleted value around it. Compression removes a tuple only when the neighboring certificate can still cover the combined uncertainty. Querying then reads from a summary whose uncertainty has been bounded at every update.`,
        `This is an induction argument. The empty summary is valid. After one insertion, the summary is valid. If the summary is valid before an insertion, the insertion rule keeps it valid. If it is valid before compression, the compression rule removes only tuples whose rank responsibility can be absorbed safely. Therefore, after any stream prefix, the retained values still cover the sorted stream with bounded rank slack.`,
        `The guarantee is deterministic because it does not depend on sampling luck. Given the same stream and epsilon, a correct implementation preserves the same style of rank certificate. That makes GK useful when the system needs an auditable bound rather than an empirical confidence story.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `Memory grows mostly with the error target rather than directly with stream length. The classic bound is on the order of (1 / epsilon) times a logarithmic factor in epsilon n retained tuples. Lower epsilon means a tighter rank promise and more tuples. Higher epsilon means a smaller summary and wider rank intervals.`,
        `Insertion cost depends on how the sorted tuple list is represented. An array is cache-friendly and simple, but finding the position and inserting can require binary search plus shifting. A tree can reduce shifting but adds pointer overhead. Compression adds scans, often done periodically rather than after every value.`,
        `When the stream doubles, the exact method doubles memory if it stores all values. GK does not double memory in the same way; the allowed absolute rank slack grows, and compression can merge old tuples. The cost of lower error is still real. Cutting epsilon in half roughly demands a much larger summary and more update work.`,
        `Merge behavior is a major tradeoff. Histograms merge by adding buckets. Many modern sketches were designed with distributed merge in mind. Classic GK is strongest as a single-stream deterministic rank summary. It can be adapted, but if the main workload is thousands of shards rolling up constantly, KLL, DDSketch, or t-digest may fit the operational shape better.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `GK wins when the product wants a clear deterministic rank-error contract. Audit summaries, teaching systems, one-pass analytics jobs, embedded telemetry processors, and controlled reporting pipelines can benefit from being able to say exactly what the summary promises.`,
        `It is also a useful baseline for understanding later sketches. KLL keeps rank-error thinking but uses randomized compaction to become smaller and more merge-friendly. t-digest reshapes memory toward tails, which is useful for latency percentiles. DDSketch changes the contract to relative value error, which can be better when values span many orders of magnitude.`,
        `GK is especially helpful when the distinction between rank error and value error must be taught explicitly. A p95 value can move a lot when the distribution has a cliff. GK can certify rank closeness even when the value returned looks surprising. That is not a bug in the theorem; it is a reminder that quantile sketches make specific promises, not every promise a dashboard reader might want.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The most common misconception is value accuracy. GK's guarantee is rank error, not value error. If a latency distribution has a cliff at a timeout boundary, two adjacent ranks may have very different values. A returned p99 can be rank-correct and still differ sharply from the exact p99 value.`,
        `Implementation shortcuts can break the theorem. Dropping every kth tuple, compressing by value distance, compressing without the safe rank condition, or using floating-point comparisons carelessly around the error budget can produce a small summary with no valid certificate. The tuple fields are not decorative metadata; they are the proof state.`,
        `Changing stream semantics can also break interpretation. If the stream mixes tenants, endpoints, regions, or time windows, a quantile answer may be mathematically valid and operationally meaningless. GK answers rank questions over the stream it was fed. It does not fix bad aggregation boundaries.`,
        `Finally, GK may be the wrong tool for extreme-tail service monitoring if the organization cares more about tail value precision than deterministic rank error. It may also be the wrong tool for high-fanout distributed telemetry where merge simplicity matters more than the original single-stream guarantee.`,
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        `Suppose a service records 10,000,000 request latencies and epsilon is 0.01. A p95 query targets rank 9,500,000. A GK summary may return a retained value whose true rank is within about 100,000 ranks of that target, depending on the exact convention used by the implementation. That is a deterministic statement about rank.`,
        `If the returned value is 240 ms, GK is not saying the exact p95 is within 1% of 240 ms. It is saying the value 240 ms sits close enough to the p95 rank in the sorted stream. If ranks near 9,500,000 jump from 240 ms to 900 ms because many requests hit a timeout cliff, the rank guarantee can still hold while the value surprise is large.`,
        `This example is why dashboards should label sketch semantics. "Approximate p95" is too vague for engineering decisions. "Deterministic rank error epsilon = 0.01" tells the reader which kind of approximation is being used and what questions still need exact or tail-specialized analysis.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Keep n, epsilon, tuple order, and compression schedule explicit. Query behavior depends on stream length, and compression safety depends on the rank budget. Tests should check not only returned values but also tuple invariants after long streams, sorted inputs, reverse-sorted inputs, duplicates, and adversarial distributions with cliffs.`,
        `Use the right numeric model for values and ranks. Values may be floats, timestamps, or integers; ranks and gaps should be treated as counts. Avoid letting floating-point rounding decide whether a tuple can be deleted when integer rank arithmetic is available.`,
        `Expose the sketch contract in the API. A caller should know whether the sketch promises deterministic rank error, randomized rank error, relative value error, or bucketed approximation. Mixing these under a generic "percentile" interface leads to wrong comparisons across systems.`,
        `For distributed systems, decide early whether summaries must merge frequently. If yes, test GK against merge-friendly alternatives on the real rollout pattern. The best sketch is not the one with the most elegant theorem in isolation; it is the one whose guarantee matches the data path that will actually produce the dashboard.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study KLL next to see how randomized compaction improves space and merge behavior while keeping rank-error quantiles. Study DDSketch when relative value error is the contract. Study t-digest for tail-aware percentile summaries. Study Reservoir Sampling to separate representative samples from quantile certificates.`,
        `Then study order-statistic trees, histograms, streaming heavy hitters, and monitoring SLO design. Those topics help separate three questions that dashboards often blur: which ranks changed, which values changed, and which user-facing objectives were harmed. Primary source: Greenwald and Khanna, Space-Efficient Online Computation of Quantile Summaries.`,
      ],
    },
  ],
};
