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
  const pipelineNodes = [
    { id: 'query', label: 'query', x: 0.8, y: 4.0, note: 'terms' },
    { id: 'postings', label: 'postings', x: 2.6, y: 4.0, note: 'doc ids' },
    { id: 'bounds', label: 'bounds', x: 4.5, y: 4.0, note: 'max score' },
    { id: 'heap', label: 'top-k heap', x: 6.5, y: 4.0, note: 'threshold' },
    { id: 'skip', label: 'skip', x: 8.3, y: 4.0, note: 'cannot win' },
  ];
  const pipelineEdges = [
    { id: 'e-query-postings', from: 'query', to: 'postings' },
    { id: 'e-postings-bounds', from: 'postings', to: 'bounds' },
    { id: 'e-bounds-heap', from: 'bounds', to: 'heap' },
    { id: 'e-heap-skip', from: 'heap', to: 'skip' },
  ];
  yield {
    state: graphState({
      nodes: pipelineNodes,
      edges: pipelineEdges,
    }, { title: 'Top-k search skips candidates whose upper bound cannot win' }),
    highlight: { active: ['bounds', 'heap'], found: ['skip'] },
    explanation: `WAND-style retrieval keeps an upper bound for how much each term could still contribute. The ${pipelineNodes.length}-stage pipeline runs from ${pipelineNodes.map(n => n.label).join(' → ')}: once the "${pipelineNodes[3].label}" has a strong ${pipelineNodes[3].note}, documents whose ${pipelineNodes[2].note} is too low are sent to "${pipelineNodes[4].label}" (${pipelineNodes[4].note}) without full scoring.`,
    invariant: `Safe pruning returns the same top-k as exhaustive scoring, just with fewer full evaluations — the ${pipelineNodes[4].label} node only fires when ${pipelineNodes[2].note} cannot beat the ${pipelineNodes[3].note}.`,
  };

  const termRows = [
    { id: 'neural', label: 'neural' },
    { id: 'search', label: 'search' },
    { id: 'index', label: 'index' },
  ];
  const termCols = [
    { id: 'currentDoc', label: 'current doc' },
    { id: 'maxScore', label: 'max score' },
    { id: 'pointer', label: 'pointer' },
  ];
  const termValues = [
    ['10', '2.9', 'at 10'],
    ['12', '1.8', 'at 12'],
    ['19', '1.2', 'at 19'],
  ];
  yield {
    state: labelMatrix('Term upper bounds', termRows, termCols, termValues),
    highlight: { active: ['neural:maxScore', 'search:maxScore', 'index:maxScore'], compare: ['neural:currentDoc', 'search:currentDoc'] },
    explanation: `Each query term (${termRows.map(r => r.label).join(', ')}) has a ${termCols[0].label} and a ${termCols[1].label} contribution (${termValues.map(v => v[1]).join(', ')} respectively). WAND orders pointers at docs ${termValues.map(v => v[0]).join(', ')}, sums possible contributions, and asks whether a pivot document can beat the current heap threshold.`,
  };

  const phaseRows = [
    { id: 'early', label: 'early query' },
    { id: 'mid', label: 'mid query' },
    { id: 'late', label: 'late query' },
  ];
  const phaseCols = [
    { id: 'heapMin', label: 'heap min' },
    { id: 'pruning', label: 'pruning power' },
  ];
  const phaseValues = [
    ['0.0', 'none'],
    ['3.1', 'some skips'],
    ['5.4', 'many skips'],
  ];
  yield {
    state: labelMatrix('Threshold rises as heap fills', phaseRows, phaseCols, phaseValues),
    highlight: { active: ['late:heapMin', 'late:pruning'], compare: ['early:pruning'] },
    explanation: `The first few matches fill the top-k heap (${phaseCols[0].label} starts at ${phaseValues[0][0]} with ${phaseValues[0][1]} pruning). By "${phaseRows[1].label}" the ${phaseCols[0].label} reaches ${phaseValues[1][0]} (${phaseValues[1][1]}), and by "${phaseRows[2].label}" it hits ${phaseValues[2][0]} with ${phaseValues[2][1]} — more documents are provably unable to enter the result set.`,
  };

  const candidateRows = [
    { id: 'doc12', label: 'doc 12' },
    { id: 'doc19', label: 'doc 19' },
    { id: 'doc31', label: 'doc 31' },
    { id: 'doc44', label: 'doc 44' },
  ];
  const candidateCols = [
    { id: 'upperBound', label: 'upper bound' },
    { id: 'heapMin', label: 'heap min' },
    { id: 'action', label: 'action' },
  ];
  const candidateValues = [
    ['6.2', '5.4', 'score fully'],
    ['4.7', '5.4', 'skip'],
    ['5.6', '5.4', 'score fully'],
    ['3.0', '5.4', 'skip'],
  ];
  const threshold = candidateValues[0][1];
  const scored = candidateRows.filter((_, i) => candidateValues[i][2] === 'score fully');
  const skipped = candidateRows.filter((_, i) => candidateValues[i][2] === 'skip');
  yield {
    state: labelMatrix('Candidate decision', candidateRows, candidateCols, candidateValues),
    highlight: { found: ['doc12:action', 'doc31:action'], removed: ['doc19:action', 'doc44:action'] },
    explanation: `With a ${candidateCols[1].label} of ${threshold}, ${scored.map(r => r.label).join(' and ')} (${candidateCols[0].label}s ${scored.map((_, i) => candidateValues[candidateRows.indexOf(scored[i])][0]).join(', ')}) are scored fully because they can beat ${threshold}. ${skipped.map(r => r.label).join(' and ')} (${skipped.map((_, i) => candidateValues[candidateRows.indexOf(skipped[i])][0]).join(', ')}) are skipped — even their best possible score cannot beat the threshold, which is what makes safe dynamic pruning exact.`,
  };
}

function* blockMaxSkipping() {
  const blockNodes = [
    { id: 'term', label: 'term list', x: 0.8, y: 4.0, note: 'postings' },
    { id: 'block1', label: 'block 1', x: 2.6, y: 4.0, note: 'max 0.7' },
    { id: 'block2', label: 'block 2', x: 4.4, y: 4.0, note: 'max 3.1' },
    { id: 'block3', label: 'block 3', x: 6.2, y: 4.0, note: 'max 0.4' },
    { id: 'topk', label: 'top-k', x: 8.1, y: 4.0, note: 'beat 5.0' },
  ];
  const blocks = blockNodes.filter(n => n.id.startsWith('block'));
  yield {
    state: graphState({
      nodes: blockNodes,
      edges: [
        { id: 'e-term-block1', from: 'term', to: 'block1' },
        { id: 'e-block1-block2', from: 'block1', to: 'block2' },
        { id: 'e-block2-block3', from: 'block2', to: 'block3' },
        { id: 'e-block3-topk', from: 'block3', to: 'topk' },
      ],
    }, { title: 'Block-level max scores make bounds tighter' }),
    highlight: { active: ['block1', 'block2', 'block3'], found: ['topk'] },
    explanation: `Plain WAND uses a term-wide maximum score. Block-Max WAND stores a local maximum for each of ${blocks.length} postings blocks (${blocks.map(b => b.note).join(', ')}), so the upper bound changes as pointers move through the list toward the ${blockNodes[4].label} gate (${blockNodes[4].note}).`,
    invariant: `Tighter local bounds across ${blocks.length} blocks skip more work while preserving exact ${blockNodes[4].label} results.`,
  };

  const blockMetaRows = [
    { id: 'b0', label: 'docs 1-128' },
    { id: 'b1', label: 'docs 129-256' },
    { id: 'b2', label: 'docs 257-384' },
    { id: 'b3', label: 'docs 385-512' },
  ];
  const blockMetaCols = [
    { id: 'docRange', label: 'range' },
    { id: 'maxImpact', label: 'max impact' },
    { id: 'decision', label: 'decision' },
  ];
  const blockMetaValues = [
    ['1..128', '0.6', 'skip'],
    ['129..256', '3.2', 'scan'],
    ['257..384', '0.4', 'skip'],
    ['385..512', '2.9', 'maybe'],
  ];
  const skippedBlocks = blockMetaRows.filter((_, i) => blockMetaValues[i][2] === 'skip');
  const scannedBlock = blockMetaRows.find((_, i) => blockMetaValues[i][2] === 'scan');
  yield {
    state: labelMatrix('Block metadata', blockMetaRows, blockMetaCols, blockMetaValues),
    highlight: { removed: ['b0:decision', 'b2:decision'], found: ['b1:decision'], active: ['b3:decision'] },
    explanation: `Each of the ${blockMetaRows.length} postings blocks groups nearby document ids and records its ${blockMetaCols[1].label}. ${skippedBlocks.map(r => r.label).join(' and ')} carry low impacts (${skippedBlocks.map(r => blockMetaValues[blockMetaRows.indexOf(r)][1]).join(', ')}) and are skipped, while ${scannedBlock.label} (${blockMetaCols[1].label} ${blockMetaValues[blockMetaRows.indexOf(scannedBlock)][1]}) must be scanned.`,
  };

  const luceneRows = [
    { id: 'segment', label: 'segment' },
    { id: 'scorer', label: 'scorer' },
    { id: 'impacts', label: 'impacts' },
    { id: 'collector', label: 'collector' },
  ];
  const luceneCols = [
    { id: 'job', label: 'job' },
    { id: 'link', label: 'links to' },
  ];
  const luceneValues = [
    ['read postings', 'Lucene Segments'],
    ['score docs', 'BM25'],
    ['max by block', 'Block-Max WAND'],
    ['maintain top-k', 'Binary Heap'],
  ];
  yield {
    state: labelMatrix('Lucene-style query path', luceneRows, luceneCols, luceneValues),
    highlight: { found: ['impacts:job', 'collector:link'], active: ['segment:link', 'scorer:job'] },
    explanation: `In Lucene-family engines, the ${luceneRows.length}-stage query path runs ${luceneRows.map(r => r.label).join(' → ')}. The ${luceneRows[0].label} ${luceneValues[0][0]} via ${luceneValues[0][1]}, the ${luceneRows[1].label} ${luceneValues[1][0]} using ${luceneValues[1][1]}, the ${luceneRows[2].label} layer applies ${luceneValues[2][1]}, and the ${luceneRows[3].label} ${luceneValues[3][0]} in a ${luceneValues[3][1]}, raising the minimum competitive score as better hits arrive.`,
  };

  const plotAxes = { x: { label: 'heap threshold', min: 0, max: 10 }, y: { label: 'docs fully scored', min: 0, max: 100 } };
  const plotSeries = [
    { id: 'exhaustive', label: 'exhaustive DAAT', points: [{ x: 0, y: 95 }, { x: 5, y: 95 }, { x: 10, y: 95 }] },
    { id: 'wand', label: 'WAND', points: [{ x: 0, y: 95 }, { x: 5, y: 50 }, { x: 10, y: 24 }] },
    { id: 'bmw', label: 'Block-Max WAND', points: [{ x: 0, y: 95 }, { x: 5, y: 34 }, { x: 10, y: 12 }] },
  ];
  const bmwSeries = plotSeries[2];
  const wandSeries = plotSeries[1];
  const exhaustiveSeries = plotSeries[0];
  yield {
    state: plotState({ axes: plotAxes, series: plotSeries }),
    highlight: { found: ['bmw'], active: ['wand'], compare: ['exhaustive'] },
    explanation: `As the ${plotAxes.x.label} rises from ${plotAxes.x.min} to ${plotAxes.x.max}, ${exhaustiveSeries.label} stays flat at ${exhaustiveSeries.points[2].y} ${plotAxes.y.label}, while ${wandSeries.label} drops to ${wandSeries.points[2].y} and ${bmwSeries.label} drops to just ${bmwSeries.points[2].y}. Block-level maxima make the bounds sharper than term-wide maxima.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The "WAND pruning" view shows three query terms, each with a postings pointer, a current document id, and a maximum possible score contribution. The highlighted cells are the upper bounds; the "skip" node lights up when a candidate\'s summed upper bound falls below the heap threshold. Watch the threshold rise as good documents enter the heap, and notice how later candidates get skipped by arithmetic that was impossible at the start.',
        'The "block max skipping" view splits each term\'s postings list into fixed-size blocks, each carrying a local maximum impact score. Blocks highlighted in red are skipped because their local max is too low. The final plot compares exhaustive scoring, plain WAND, and Block-Max WAND as the threshold grows: the gap between the curves is the work saved by tighter bounds.',
        {type: 'image', src: './assets/gifs/block-max-wand-top-k-retrieval.gif', alt: 'Animated walkthrough of the block max wand top k retrieval visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A search engine receives a query like "neural search index," looks up three postings lists, and needs the top 10 results by BM25 score. The naive plan is to score every document that appears in any list, keep a heap of size 10, and return the winners. That plan is correct, but on a corpus of 100 million documents, term "search" alone might have a postings list 20 million entries long. Scoring every entry is pure waste if most of them have no chance of entering the top 10.',
        'Block-Max WAND exists to prove, at query time, that certain documents or entire blocks of documents cannot possibly beat the current 10th-best score. It skips them without computing their full score, and the result set is identical to exhaustive evaluation. The savings come from the structure of the metadata, not from accepting approximate answers.',
        'The technique sits between the inverted index (which stores postings) and the ranking model (which scores them). It is a pruning layer: it decides which postings deserve the cost of full scoring and which can be rejected using cheap metadata alone.',
        {type: 'callout', text: 'Block-Max WAND is exact because every skipped document is excluded by a conservative score ceiling and the current top-k threshold.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is document-at-a-time (DAAT) scoring. Open a postings list for each query term, advance all pointers together, and for every candidate document, sum the BM25 contributions from each term that contains it. Maintain a min-heap of size k. Whenever a new score beats the heap minimum, evict the weakest result and insert the new one. When all lists are exhausted, the heap holds the exact top k.',
        'This is simple to implement and easy to verify. Every document gets a fair evaluation, and the heap guarantees the top k are correct. For selective queries that match only a few thousand documents, DAAT is fast enough and the code is straightforward.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that broad queries touch long postings lists. A three-term OR query on a 100M document corpus might union lists totaling 40 million entries. DAAT scores all 40 million candidates even though the top 10 heap fills up quickly, and after a few thousand documents the 10th-best score is already strong. Most of the remaining 39+ million candidates cannot beat that threshold, but DAAT has no mechanism to prove it, so it computes full BM25 scores for documents that have zero chance of entering the result set.',
        'The cost is not the heap operations (those are O(log k) and cheap). The cost is decoding postings, fetching term frequencies, computing BM25 for every candidate, and touching memory for documents that the final answer will never include. On a busy search cluster, that wasted CPU is the difference between 5ms p95 latency and 50ms.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store a precomputed upper bound on the score that each term can contribute. For BM25, the maximum score a term can give any document depends on the term\'s IDF and the highest normalized term frequency in the collection. If you know the three query terms can contribute at most 2.9, 1.8, and 1.2 respectively, then any document matched by only the second and third terms can score at most 1.8 + 1.2 = 3.0. If the heap minimum is already 3.5, that document is provably dead and never needs full scoring.',
        'Plain WAND (Weak AND) uses this idea with one upper bound per term across the entire postings list. Block-Max WAND makes the bounds tighter by splitting each postings list into blocks of, say, 128 document ids, and storing a local maximum impact for each block. Inside a block where term "search" only appears in low-frequency documents, the local max might be 0.3 instead of the global max of 1.8. That tighter bound lets the pruning logic skip more blocks.',
        {type: 'image', src: 'https://images.logmi.jp/media/article/321219/images/editor/Q19KzcLQcvmWJxeFyw1vog.jpg', alt: 'Lucene dynamic pruning slide for top-k retrieval.', caption: 'Dynamic pruning is safe only when score bounds remain conservative above every skipped document. (Source: logmi.jp)'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At index time, each postings list is divided into fixed-size blocks (Lucene uses 128 documents per block). For each block, the indexer computes and stores the maximum BM25 impact that the term can contribute to any document in that block. This metadata is small: one float per block, so a term with 10 million postings and blocks of 128 needs roughly 78,000 floats of extra metadata.',
        'At query time, the algorithm maintains a postings pointer and a "current block" pointer for each query term. It also maintains a min-heap of size k. The process has three repeating steps. First, sort the query terms by their current document id to find the pivot, the first document id where enough terms\' upper bounds could sum above the heap threshold. Second, for each term whose pointer is before the pivot, check that term\'s current block max. If the block max is too low, jump the pointer to the next block boundary. Third, if the pivot document survives all block-max checks, compute its full BM25 score and offer it to the heap.',
        {type: 'image', src: 'https://images.logmi.jp/media/article/321219/images/editor/Qtkb2WkPCK1XXXUpnjW3YB.jpg', alt: 'Lucene top-k retrieval slide with postings and pruning logic.', caption: 'Posting-list pointers and score ceilings determine which candidates deserve full scoring. (Source: logmi.jp)'},
        'The heap minimum rises as better documents arrive. Early in the query, when the heap is empty or weak, almost every candidate gets scored. Once the heap holds k strong results, most candidates fail the upper-bound check and are skipped. This is why Block-Max WAND gets faster as it runs: the threshold is a ratchet that only moves up.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one property: every upper bound is a true ceiling. Suppose the heap holds k documents and the minimum score is T = 5.4. A candidate document D appears in terms with block-max contributions of at most 2.1, 1.8, and 0.9, summing to 4.8. Because 4.8 < 5.4, D\'s actual BM25 score (which can only be equal to or less than the sum of upper bounds) cannot reach 5.4. Skipping D cannot remove a true top-k result.',
        'The argument generalizes to any scoring function that decomposes into per-term contributions where each contribution has a computable upper bound. BM25 satisfies this because each term\'s score depends on the document\'s term frequency and the term\'s IDF, and both can be bounded. Learned sparse models like SPLADE also satisfy it because each dimension has a bounded impact.',
        'Loose bounds are safe but wasteful: they make the algorithm score more documents than necessary. Bounds that are too tight (below the true maximum) are catastrophic: they can skip a document that belongs in the result set, silently corrupting the answer. Production systems therefore derive bounds directly from the scoring formula and validate them during indexing.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Index-time cost: one extra float per block per term. With blocks of 128 documents, a term with N postings adds N/128 floats of metadata. For a 100M-document corpus with an average postings list of 1M entries, that is about 7,800 floats per term, roughly 31 KB. Across 500,000 unique terms, the total block-max metadata is about 15 GB, which is small relative to the postings themselves.',
        'Query-time cost: the algorithm does more bookkeeping per step than DAAT (sorting pointers, checking block boundaries, jumping iterators). Each of those operations is O(1) or O(q log q) where q is the number of query terms, typically 2 to 5. The savings come from skipping full BM25 evaluations, each of which involves decoding variable-length postings, fetching term frequencies, and computing the scoring formula. On broad queries over long lists, Block-Max WAND typically evaluates 5 to 20 percent of the candidates that DAAT would score, for the same exact top-k result.',
        'The worst case is a query where every document is competitive: all upper bounds exceed the heap threshold throughout the query, so nothing gets skipped and the bookkeeping is pure overhead. This happens when k is large relative to the corpus, when the scoring function produces flat scores, or when the query is so selective that the postings lists are short anyway.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Lucene (and therefore Elasticsearch, OpenSearch, and Solr) implemented Block-Max WAND starting with LUCENE-8135. It is the default top-k evaluation strategy for disjunctive BM25 queries. When you run a full-text search on any Elastic cluster, Block-Max WAND is the mechanism deciding which documents get scored and which get skipped.',
        'The technique applies to any system with decomposable scores and an inverted index: ad retrieval engines scoring bid-weighted term matches, recommendation systems scoring user-item term overlap, and sparse learned retrieval models like SPLADE that produce integer impact scores per token. Any pipeline where first-stage retrieval must be exact and fast over long postings lists is a candidate.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Block-Max WAND cannot help when the scoring function is not decomposable into per-term contributions with computable upper bounds. Dense vector search (ANN) does not decompose this way; each similarity computation involves the full embedding, so there is no per-dimension upper bound that would let you skip candidates. WAND is for sparse, term-based retrieval.',
        'It also fails when scores are nearly uniform. If every document scores between 4.9 and 5.1, the heap threshold never rises far enough to exclude candidates, and the algorithm degrades to DAAT plus overhead. Similarly, if k is large (say, k = 10,000), the threshold stays low for a long time and pruning kicks in late.',
        'Small indexes do not benefit. If a query matches only 500 documents, scoring all 500 takes microseconds. The bookkeeping of pivot selection, block-max lookups, and pointer jumps may cost more than it saves. The algorithm earns its keep on postings lists with millions of entries, not thousands.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Query: "neural search index" with k = 3. The three terms have global max scores of 2.9 (neural), 1.8 (search), and 1.2 (index). After processing the first few hundred documents, the top-3 heap holds scores [5.4, 5.8, 6.1], so the threshold T = 5.4.',
        'Candidate doc 19 appears in "search" and "index" but not "neural." Its upper bound is 1.8 + 1.2 = 3.0. Since 3.0 < 5.4, doc 19 is skipped without computing BM25. Candidate doc 12 appears in all three terms. Its upper bound is 2.9 + 1.8 + 1.2 = 5.9. Since 5.9 > 5.4, doc 12 must be fully scored. Suppose its actual BM25 score is 5.6: it enters the heap, evicting 5.4, and the new threshold rises to 5.6. Future candidates now face a higher bar.',
        'Now add block-level bounds. For term "search," block [1..128] has a local max of 0.3 instead of the global 1.8. Candidate doc 50 is in that block. Even if doc 50 appears in all three terms, its tighter upper bound is 2.9 + 0.3 + 1.2 = 4.4, which is below the threshold 5.6. Block-Max WAND skips doc 50 that plain WAND would have had to score (since plain WAND uses 2.9 + 1.8 + 1.2 = 5.9, which passes). The tighter local bound cuts more work without changing the result.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The original WAND algorithm is from Broder et al., "Efficient Query Evaluation using a Two-Level Retrieval Process" (2003), available at https://research.ibm.com/publications/efficient-query-evaluation-using-a-two-level-retrieval-process and https://research.google/pubs/efficient-query-evaluation-using-a-two-level-retrieval-process/. The Block-Max extension is from Ding and Suel, "Faster Top-k Document Retrieval Using Block-Max Indexes" (2011), PDF at https://research.engineering.nyu.edu/~suel/papers/bmw.pdf. Elastic\'s adoption is documented at https://www.elastic.co/blog/faster-retrieval-of-top-hits-in-elasticsearch-with-block-max-wand, and the Lucene implementation is tracked at https://issues.apache.org/jira/browse/LUCENE-8135.',
        'Prerequisites: study Inverted Index (the data structure WAND operates over), Binary Heap (the top-k collector), and BM25 scoring. Extensions: Elias-Fano Encoding (how postings are compressed so block skipping is efficient), Roaring Bitmaps (another way to represent document sets), and Lucene Segments Case Study (the production context). Related: Multi-Index RAG (combining lexical and vector retrieval in modern pipelines).',
      ],
    },
  ],
};
