// Block-Max WAND: safe dynamic pruning for top-k search over inverted indexes.
// Keep score upper bounds, raise the heap threshold, and skip blocks that cannot win.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'block-max-wand-top-k-retrieval',
  title: 'Block-Max WAND Top-k Retrieval',
  category: 'Data Structures',
  summary: 'The query-time pruning layer behind fast ranked search: use term and block upper bounds to avoid scoring documents that cannot enter the top-k heap.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['WAND pruning', 'block max skipping'], defaultValue: 'WAND pruning' },
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

function* wandPruning() {
  yield {
    state: graphState({
      nodes: [
        { id: 'query', label: 'query', x: 0.8, y: 4.0, note: 'terms' },
        { id: 'postings', label: 'postings', x: 2.6, y: 4.0, note: 'doc ids' },
        { id: 'bounds', label: 'bounds', x: 4.5, y: 4.0, note: 'max score' },
        { id: 'heap', label: 'top-k heap', x: 6.5, y: 4.0, note: 'threshold' },
        { id: 'skip', label: 'skip', x: 8.3, y: 4.0, note: 'cannot win' },
      ],
      edges: [
        { id: 'e-query-postings', from: 'query', to: 'postings' },
        { id: 'e-postings-bounds', from: 'postings', to: 'bounds' },
        { id: 'e-bounds-heap', from: 'bounds', to: 'heap' },
        { id: 'e-heap-skip', from: 'heap', to: 'skip' },
      ],
    }, { title: 'Top-k search skips candidates whose upper bound cannot win' }),
    highlight: { active: ['bounds', 'heap'], found: ['skip'] },
    explanation: 'WAND-style retrieval keeps an upper bound for how much each term could still contribute. Once the top-k heap has a strong threshold, documents whose maximum possible score is too low do not need full scoring.',
    invariant: 'Safe pruning returns the same top-k as exhaustive scoring, just with fewer full evaluations.',
  };

  yield {
    state: labelMatrix(
      'Term upper bounds',
      [
        { id: 'neural', label: 'neural' },
        { id: 'search', label: 'search' },
        { id: 'index', label: 'index' },
      ],
      [
        { id: 'currentDoc', label: 'current doc' },
        { id: 'maxScore', label: 'max score' },
        { id: 'pointer', label: 'pointer' },
      ],
      [
        ['10', '2.9', 'at 10'],
        ['12', '1.8', 'at 12'],
        ['19', '1.2', 'at 19'],
      ],
    ),
    highlight: { active: ['neural:maxScore', 'search:maxScore', 'index:maxScore'], compare: ['neural:currentDoc', 'search:currentDoc'] },
    explanation: 'Each query term has a postings pointer and a maximum score contribution. WAND orders pointers, sums possible contributions, and asks whether a pivot document can beat the current heap threshold.',
  };

  yield {
    state: labelMatrix(
      'Threshold rises as heap fills',
      [
        { id: 'early', label: 'early query' },
        { id: 'mid', label: 'mid query' },
        { id: 'late', label: 'late query' },
      ],
      [
        { id: 'heapMin', label: 'heap min' },
        { id: 'pruning', label: 'pruning power' },
      ],
      [
        ['0.0', 'none'],
        ['3.1', 'some skips'],
        ['5.4', 'many skips'],
      ],
    ),
    highlight: { active: ['late:heapMin', 'late:pruning'], compare: ['early:pruning'] },
    explanation: 'The first few matches fill the top-k heap. After that, the lowest score in the heap becomes the minimum competitive score. As the threshold rises, more documents are provably unable to enter the result set.',
  };

  yield {
    state: labelMatrix(
      'Candidate decision',
      [
        { id: 'doc12', label: 'doc 12' },
        { id: 'doc19', label: 'doc 19' },
        { id: 'doc31', label: 'doc 31' },
        { id: 'doc44', label: 'doc 44' },
      ],
      [
        { id: 'upperBound', label: 'upper bound' },
        { id: 'heapMin', label: 'heap min' },
        { id: 'action', label: 'action' },
      ],
      [
        ['6.2', '5.4', 'score fully'],
        ['4.7', '5.4', 'skip'],
        ['5.6', '5.4', 'score fully'],
        ['3.0', '5.4', 'skip'],
      ],
    ),
    highlight: { found: ['doc12:action', 'doc31:action'], removed: ['doc19:action', 'doc44:action'] },
    explanation: 'The algorithm never skips because a document looks boring; it skips because even the best possible score cannot beat the threshold. That distinction is what makes safe dynamic pruning exact.',
  };
}

function* blockMaxSkipping() {
  yield {
    state: graphState({
      nodes: [
        { id: 'term', label: 'term list', x: 0.8, y: 4.0, note: 'postings' },
        { id: 'block1', label: 'block 1', x: 2.6, y: 4.0, note: 'max 0.7' },
        { id: 'block2', label: 'block 2', x: 4.4, y: 4.0, note: 'max 3.1' },
        { id: 'block3', label: 'block 3', x: 6.2, y: 4.0, note: 'max 0.4' },
        { id: 'topk', label: 'top-k', x: 8.1, y: 4.0, note: 'beat 5.0' },
      ],
      edges: [
        { id: 'e-term-block1', from: 'term', to: 'block1' },
        { id: 'e-block1-block2', from: 'block1', to: 'block2' },
        { id: 'e-block2-block3', from: 'block2', to: 'block3' },
        { id: 'e-block3-topk', from: 'block3', to: 'topk' },
      ],
    }, { title: 'Block-level max scores make bounds tighter' }),
    highlight: { active: ['block1', 'block2', 'block3'], found: ['topk'] },
    explanation: 'Plain WAND uses a term-wide maximum score. Block-Max WAND stores a local maximum for each postings block, so the upper bound changes as pointers move through the list.',
    invariant: 'Tighter local bounds skip more work while preserving exact top-k results.',
  };

  yield {
    state: labelMatrix(
      'Block metadata',
      [
        { id: 'b0', label: 'docs 1-128' },
        { id: 'b1', label: 'docs 129-256' },
        { id: 'b2', label: 'docs 257-384' },
        { id: 'b3', label: 'docs 385-512' },
      ],
      [
        { id: 'docRange', label: 'range' },
        { id: 'maxImpact', label: 'max impact' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['1..128', '0.6', 'skip'],
        ['129..256', '3.2', 'scan'],
        ['257..384', '0.4', 'skip'],
        ['385..512', '2.9', 'maybe'],
      ],
    ),
    highlight: { removed: ['b0:decision', 'b2:decision'], found: ['b1:decision'], active: ['b3:decision'] },
    explanation: 'A postings block groups nearby document ids and records the largest score contribution any document in that block could make. Low-impact blocks can be jumped over without decoding every posting.',
  };

  yield {
    state: labelMatrix(
      'Lucene-style query path',
      [
        { id: 'segment', label: 'segment' },
        { id: 'scorer', label: 'scorer' },
        { id: 'impacts', label: 'impacts' },
        { id: 'collector', label: 'collector' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'link', label: 'links to' },
      ],
      [
        ['read postings', 'Lucene Segments'],
        ['score docs', 'BM25'],
        ['max by block', 'Block-Max WAND'],
        ['maintain top-k', 'Binary Heap'],
      ],
    ),
    highlight: { found: ['impacts:job', 'collector:link'], active: ['segment:link', 'scorer:job'] },
    explanation: 'In Lucene-family engines, pruning lives in the scorer/collector path. Segments provide postings and impact metadata; the collector raises the minimum competitive score as better hits arrive.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'heap threshold', min: 0, max: 10 }, y: { label: 'docs fully scored', min: 0, max: 100 } },
      series: [
        { id: 'exhaustive', label: 'exhaustive DAAT', points: [{ x: 0, y: 95 }, { x: 5, y: 95 }, { x: 10, y: 95 }] },
        { id: 'wand', label: 'WAND', points: [{ x: 0, y: 95 }, { x: 5, y: 50 }, { x: 10, y: 24 }] },
        { id: 'bmw', label: 'Block-Max WAND', points: [{ x: 0, y: 95 }, { x: 5, y: 34 }, { x: 10, y: 12 }] },
      ],
    }),
    highlight: { found: ['bmw'], active: ['wand'], compare: ['exhaustive'] },
    explanation: 'The shape is the lesson: as the competitive threshold rises, tighter bounds reduce full scoring. Block-level maxima make the bounds sharper than term-wide maxima.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'WAND pruning') yield* wandPruning();
  else if (view === 'block max skipping') yield* blockMaxSkipping();
  else throw new InputError('Pick a Block-Max WAND view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Block-Max WAND is a dynamic-pruning algorithm for ranked retrieval over inverted indexes. A normal inverted index can find documents that match query terms, but a search engine usually needs the top k highest-scoring documents. Exhaustively scoring every candidate is often wasteful. WAND-style algorithms use score upper bounds to skip documents that cannot enter the top-k result heap.',
        'The data-structure idea is simple and powerful: store extra maximum-score metadata beside postings. WAND uses term-level maxima. Block-Max WAND makes the bound local by storing a maximum impact per postings block. A local bound is tighter, so the engine can skip more blocks without changing the exact top-k answer.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The query evaluator keeps a postings pointer for each term and a heap of the current top-k hits. Once the heap is full, its smallest score becomes the minimum competitive score. For a candidate document or block, the evaluator sums the maximum remaining contributions from relevant terms. If that upper bound is below the threshold, full scoring cannot change the top k, so the evaluator advances pointers instead of decoding and scoring every posting.',
        'Block-Max WAND divides a postings list into blocks such as fixed ranges of document ids. Each block stores the maximum possible score contribution for that term inside the block. This matters because a term-wide max may be dominated by one outlier document. Local maxima let the scorer prove that many ordinary blocks cannot win.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The index pays extra storage for block metadata and the query path pays control-flow overhead to maintain bounds, pivots, and heap thresholds. The payoff is fewer full score computations, fewer postings decoded, and lower latency for top-k queries. It is especially useful when queries are disjunctive, postings are long, and top results become competitive early.',
        'The savings are workload-dependent. If k is huge, scores are flat, terms are rare, or the heap threshold stays low, there may be less to skip. The algorithm is exact only when the bounds are valid upper bounds for the scoring function being used.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'The original WAND work by Broder, Carmel, Herscovici, Soffer, and Zien framed efficient query evaluation as a two-level retrieval process: identify promising candidates with partial information, then fully score them. Ding and Suel introduced block-max indexes and Block-Max WAND-style algorithms for faster top-k retrieval. Lucene 8 incorporated block-max indexes and Block-Max WAND query evaluation, and Elastic documented how it improved top-hit retrieval in Elasticsearch.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Block-Max WAND is not approximate by default. Safe dynamic pruning should return the same top-k as exhaustive document-at-a-time scoring. If an implementation uses approximate shortcuts or invalid bounds, that is a product choice, not the core guarantee.',
        'It is also not a ranking model. BM25, learned ranking, field boosts, recency boosts, and rerankers decide scores. WAND and Block-Max WAND decide which candidates need full evaluation under those scoring upper bounds. The clean separation is: postings find possible matches, ranking defines score, pruning avoids hopeless work.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: IBM WAND paper page at https://research.ibm.com/publications/efficient-query-evaluation-using-a-two-level-retrieval-process, Google Research listing at https://research.google/pubs/efficient-query-evaluation-using-a-two-level-retrieval-process/, Ding and Suel Block-Max WAND paper PDF at https://research.engineering.nyu.edu/~suel/papers/bmw.pdf, Elastic Block-Max WAND article at https://www.elastic.co/blog/faster-retrieval-of-top-hits-in-elasticsearch-with-block-max-wand, and the Lucene implementation issue at https://issues.apache.org/jira/browse/LUCENE-8135. Study Inverted Index, Lucene Segments Case Study, Binary Heap, Elias-Fano Encoding, Roaring Bitmaps, and Multi-Index RAG next.',
      ],
    },
  ],
};
