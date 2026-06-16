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
      heading: 'What it is',
      paragraphs: [
        'The Greenwald-Khanna summary is a deterministic streaming quantile data structure. It answers approximate quantiles with a rank-error guarantee while using far less memory than storing and sorting the whole stream.',
        'This topic connects Reservoir Sampling, t-digest Quantile Sketch, KLL Quantile Sketch, DDSketch Relative-Error Quantiles, and Tail Latency & p99 Thinking. Reservoir sampling keeps representative raw examples. GK keeps rank-certifying summary tuples.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The summary stores sorted tuples (v, g, delta). The value v is retained from the stream. The gap g records how many unseen ranks can sit between this tuple and the previous tuple. Delta records additional slack in the tuple rank. A query walks cumulative gaps and chooses a value whose rank interval is close enough to the requested rank.',
        'Insertion places a new value in sorted order. Compression removes adjacent tuples only when the remaining tuple can still preserve the epsilon rank guarantee. The algorithm is therefore a disciplined memory reducer, not an arbitrary sample.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'GK trades update and compression work for deterministic rank guarantees. Lower epsilon means more tuples. Unlike t-digest and DDSketch, the core guarantee is about rank error, not direct relative error in the returned value. That distinction matters for skewed latency distributions, where a small rank error can correspond to a large value jump.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A compliance dashboard wants daily p50 and p95 transaction amounts from a stream that cannot be retained in full. The team chooses GK because the audit requirement is a deterministic rank-error bound. The summary is merged into daily artifacts, and exact reprocessing is reserved for disputed reports.',
        'The same team does not use GK alone for p99.9 service latency alerts. There, value error near the tail is more important than a global rank bound, so DDSketch or t-digest may be a better operational fit.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not confuse rank error with value error. Returning a value whose rank is close to the desired rank can still be far away in milliseconds or dollars when the distribution has cliffs. Also avoid simplified GK implementations that drop tuples without preserving the compression invariant; the guarantee lives in that invariant.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Greenwald and Khanna, Space-Efficient Online Computation of Quantile Summaries, at https://infolab.stanford.edu/~datar/courses/cs361a/papers/quantiles.pdf. Study KLL Quantile Sketch for the randomized compact-compactor successor, DDSketch Relative-Error Quantiles for production latency distributions, t-digest Quantile Sketch for tail-aware centroids, and Reservoir Sampling for unbiased raw examples.',
      ],
    },
  ],
};
