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
      heading: 'Why this exists',
      paragraphs: [
        'Block-Max WAND exists because ranked search usually asks for the best k results, not the full score for every matching document. An inverted index can enumerate candidates quickly, but broad queries still create long postings lists and many documents that will never reach the result page.',
        'The retrieval engine needs a way to keep exact top-k semantics while refusing to spend scorer time on candidates that are mathematically unable to beat the current heap threshold.',
        'This sits at the boundary between data structures and ranking systems. The inverted index supplies postings, block metadata supplies score ceilings, and the top-k heap supplies the live threshold. The algorithm is useful because those parts exchange enough information to skip work without changing the answer.',
        {type: 'callout', text: 'Block-Max WAND is exact because every skipped document is excluded by a conservative score ceiling and the current top-k threshold.'},
      ],
    },
    {
      heading: 'Naive baseline and wall',
      paragraphs: [
        'The naive baseline is document-at-a-time scoring. Advance postings pointers, compute the full BM25 or impact score for each candidate document, and keep the best k scores in a heap. This is easy to reason about and returns exact results.',
        'The wall appears after the heap fills. The lowest score in the heap becomes a minimum competitive score, but a plain evaluator may still decode postings and score documents whose best possible score is already below that threshold. It lacks a proof that the work is useless.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'Store score upper bounds beside the postings. WAND uses term-level maxima to ask whether a candidate could beat the current top-k threshold. Block-Max WAND makes the bound tighter by storing a maximum impact for each postings block, so the possible score changes as pointers move through the index.',
        'The invariant is that every pruning bound must be a true upper bound for the scoring function over the candidate or block it covers. If the upper bound cannot beat the heap minimum, then no skipped document can enter the exact top k.',
        {type: 'image', src: 'https://images.logmi.jp/media/article/321219/images/editor/Q19KzcLQcvmWJxeFyw1vog.jpg', alt: 'Lucene dynamic pruning slide for top-k retrieval.', caption: 'Dynamic pruning is safe only when score bounds remain conservative above every skipped document. (Source: logmi.jp)'},
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the "WAND pruning" view, watch the heap threshold become the decision line. Term pointers and max-score cells describe the best score a candidate could still achieve. When that possible score is too low, the skip node is justified by arithmetic, not by a guess.',
        'In the "block max skipping" view, each block carries its own local maximum. Low-impact blocks can be jumped over because their local maxima are tighter than a term-wide bound. The final plot shows the intended shape: as the threshold rises, WAND scores fewer documents, and Block-Max WAND scores fewer still.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'For each query term, the scorer has a postings pointer and a maximum contribution. WAND orders current document ids, chooses a pivot, sums upper bounds for terms that could contribute before the pivot, and decides whether the pivot can be competitive. If not, pointers advance toward a more promising document.',
        {type: 'image', src: 'https://images.logmi.jp/media/article/321219/images/editor/Qtkb2WkPCK1XXXUpnjW3YB.jpg', alt: 'Lucene top-k retrieval slide with postings and pruning logic.', caption: 'Posting-list pointers and score ceilings determine which candidates deserve full scoring. (Source: logmi.jp)'},
        'Block-Max WAND adds per-block impact metadata. A postings block covers a range of document ids and stores the largest contribution that term can make inside the block. During query evaluation, the scorer can replace loose term-wide bounds with these local bounds and skip entire low-impact ranges.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'The correctness proof is an upper-bound argument. Suppose the heap already holds k documents and its minimum score is T. If a candidate document or block has maximum possible score U, and U is less than T under the engine tie policy, then the candidate cannot displace any current top-k result.',
        'Safe pruning depends on conservative metadata. Bounds may be loose and still safe, just less useful. Bounds that are too low are dangerous because they can hide a true winner. Production systems therefore tie the pruning code closely to the scoring formula, segment metadata, and tie-breaking rules.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'The animation uses a heap minimum of 5.4 in the candidate table. Doc 12 has an upper bound of 6.2, so it must be scored fully; it could still enter the top k. Doc 19 has an upper bound of 4.7, so it is skipped because even its best case cannot reach 5.4.',
        'In the block view, docs 1..128 have max impact 0.6 and docs 257..384 have max impact 0.4, so those blocks are poor candidates once the threshold is high. Docs 129..256 carry max impact 3.2, so the scorer may need to scan that block before it can safely decide.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The index pays extra storage for block metadata, and indexing must compute impact maxima that remain valid for the scorer. The query path pays control-flow overhead for pivots, block checks, threshold updates, and iterator jumps.',
        'The payoff is fewer full score computations, fewer decoded postings, and lower tail latency for the right workloads. Savings shrink when k is large, scores are flat, good results arrive late, queries are very selective already, or bounds are too loose to cut much work.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'A practical implementation starts with the scoring contract. The scorer must expose conservative per-term or per-block upper bounds, the collector must publish the current minimum competitive score, and the iterator layer must be able to advance across postings ranges without decoding every posting in the skipped block.',
        'The ranking team should measure docs visited, docs fully scored, blocks skipped, bound tightness, heap-threshold growth, and latency by query class. A broad query with strong early hits should show aggressive pruning. A narrow query or a query with weak bounds may show little benefit, and that is a signal to tune metadata rather than assume the algorithm failed.',
      ],
    },
    {
      heading: 'Why search teams care',
      paragraphs: [
        'Top-k pruning sits in the first-stage retrieval budget. Every document fully scored by the lexical engine is a candidate that consumes CPU before reranking, blending, personalization, or business rules even begin. Saving work here can lower p95 latency, reduce fleet size, or leave more budget for a stronger reranker.',
        'The exactness matters. A product team can adopt safe Block-Max WAND without changing the meaning of top-k BM25 results, because skipped documents are skipped only under valid upper bounds. That is different from approximate retrieval, where recall tradeoffs must be exposed as a product and evaluation choice.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins in top-k lexical retrieval over long postings lists, broad disjunctive queries, BM25-style decomposable scores, impact metadata, and Lucene-family engines where the collector can raise the minimum competitive score during evaluation.',
        'It is strongest when block-local maxima are much tighter than term-wide maxima. That means the metadata tells the scorer that specific document ranges are weak even though the overall term can be strong somewhere else.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Block-Max WAND is not itself a ranker. BM25, field boosts, recency, learned ranking, and rerankers define scores; WAND decides which candidates need exact first-stage evaluation under valid bounds.',
        'It is a poor fit when the scoring function cannot provide decomposable upper bounds, when approximate vector search is the main retrieval path, when post-retrieval business rules dominate, or when invalid metadata would make exact pruning unsafe. Approximate variants can be useful, but they are a separate product contract.',
        'It can also disappoint on small indexes or very selective queries. If there are few candidate documents, exhaustive scoring is already cheap. The algorithm is most valuable when postings lists are long enough that proving non-competitiveness saves real scorer work.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: IBM WAND paper page at https://research.ibm.com/publications/efficient-query-evaluation-using-a-two-level-retrieval-process, Google Research listing at https://research.google/pubs/efficient-query-evaluation-using-a-two-level-retrieval-process/, Ding and Suel Block-Max WAND paper PDF at https://research.engineering.nyu.edu/~suel/papers/bmw.pdf, Elastic Block-Max WAND article at https://www.elastic.co/blog/faster-retrieval-of-top-hits-in-elasticsearch-with-block-max-wand, and the Lucene implementation issue at https://issues.apache.org/jira/browse/LUCENE-8135. Study Inverted Index, Lucene Segments Case Study, Binary Heap, Elias-Fano Encoding, Roaring Bitmaps, and Multi-Index RAG next.',
      ],
    },
  ],
};
