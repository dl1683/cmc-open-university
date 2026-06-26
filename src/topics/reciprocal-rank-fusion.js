// Reciprocal Rank Fusion: merge several ranked lists by summing reciprocal
// rank contributions, avoiding fragile score normalization across retrievers.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'reciprocal-rank-fusion',
  title: 'Reciprocal Rank Fusion',
  category: 'Algorithms',
  summary: 'Merge BM25, vector, graph, and other ranked lists by rank position instead of comparing incompatible raw scores.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['score documents', 'hybrid search case'], defaultValue: 'score documents' },
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

function rrfGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.7, y: 3.5, note: 'user' },
      { id: 'bm25', label: 'BM25', x: 2.4, y: 2.6 },
      { id: 'vector', label: 'vector', x: 2.4, y: 3.5, note: 'meaning' },
      { id: 'graph', label: 'graph', x: 2.4, y: 5.4, note: 'links' },
      { id: 'rrf', label: 'RRF', x: 5.2, y: 3.5, note: 'rank fusion' },
      { id: 'pool', label: 'pool', x: 7.4, y: 3.5, note: 'candidates' },
      { id: 'rerank', label: 'rerank', x: 9.0, y: 3.5, note: 'precision' },
    ],
    edges: [
      { id: 'e-query-bm25', from: 'query', to: 'bm25' },
      { id: 'e-query-vector', from: 'query', to: 'vector' },
      { id: 'e-query-graph', from: 'query', to: 'graph' },
      { id: 'e-bm25-rrf', from: 'bm25', to: 'rrf' },
      { id: 'e-vector-rrf', from: 'vector', to: 'rrf' },
      { id: 'e-graph-rrf', from: 'graph', to: 'rrf' },
      { id: 'e-rrf-pool', from: 'rrf', to: 'pool' },
      { id: 'e-pool-rerank', from: 'pool', to: 'rerank' },
    ],
  }, { title });
}

function* scoreDocuments() {
  const k = 60;
  const retrieverNames = ['BM25', 'vector', 'graph'];
  const numRetrievers = retrieverNames.length;

  yield {
    state: rrfGraph('RRF merges ranked lists without score normalization'),
    highlight: { active: ['bm25', 'vector', 'graph', 'rrf', 'e-bm25-rrf', 'e-vector-rrf', 'e-graph-rrf'], found: ['pool'], compare: ['rerank'] },
    explanation: `Read the arrows as ${numRetrievers} separate first-stage retrievers (${retrieverNames.join(', ')}) voting on the same query. RRF sits at the join point: it ignores incompatible score scales and asks only where each candidate appeared in each ranked list.`,
  };

  const rank1Contribution = (1 / (k + 1)).toFixed(4);
  const rank2Contribution = (1 / (k + 2)).toFixed(4);
  const rank3Contribution = (1 / (k + 3)).toFixed(4);
  const rank4Contribution = (1 / (k + 4)).toFixed(4);

  yield {
    state: labelMatrix(
      `RRF contribution with k = ${k}`,
      [
        { id: 'rank1', label: 'rank 1' },
        { id: 'rank2', label: 'rank 2' },
        { id: 'rank3', label: 'rank 3' },
        { id: 'rank4', label: 'rank 4' },
        { id: 'missing', label: 'missing' },
      ],
      [
        { id: 'formula', label: '1 / (k + rank)' },
        { id: 'value', label: 'contribution' },
      ],
      [
        [`1 / ${k + 1}`, rank1Contribution],
        [`1 / ${k + 2}`, rank2Contribution],
        [`1 / ${k + 3}`, rank3Contribution],
        [`1 / ${k + 4}`, rank4Contribution],
        ['0', 'not found'],
      ],
    ),
    highlight: { active: ['rank1:value', 'rank2:value'], compare: ['missing:value'] },
    explanation: `The table shows the whole trick. Rank 1 contributes ${rank1Contribution}, rank 2 contributes ${rank2Contribution} — a smooth drop, not a cliff. Missing candidates contribute zero, and k = ${k} keeps the top rank from overwhelming everything below it.`,
    invariant: `RRF score(document) = sum over ${numRetrievers} lists of 1 / (${k} + rank_in_that_list).`,
  };

  const docNames = ['policy-17', 'refund guide', 'plan table', 'owner node'];
  // Ranks per retriever: [BM25, vector, graph] — null means missing
  const docRanks = [[1, 2, 4], [2, 1, 3], [3, 4, null], [null, null, 1]];
  const fusedScores = docRanks.map(
    (ranks) => ranks.reduce((sum, r) => sum + (r == null ? 0 : 1 / (k + r)), 0).toFixed(4),
  );
  const winnerIdx = fusedScores.indexOf(fusedScores.slice().sort().reverse()[0]);
  const winnerName = docNames[winnerIdx];

  yield {
    state: labelMatrix(
      'Fused scores',
      docNames.map((name, i) => ({ id: ['policy', 'refund', 'plan', 'owner'][i], label: name })),
      [
        { id: 'bm25', label: 'BM25 rank' },
        { id: 'vector', label: 'vector rank' },
        { id: 'graph', label: 'graph rank' },
        { id: 'rrf', label: 'fused' },
      ],
      docRanks.map((ranks, i) => [
        ...ranks.map((r) => r == null ? 'missing' : String(r)),
        fusedScores[i],
      ]),
    ),
    highlight: { found: ['refund:rrf', 'policy:rrf'], compare: ['owner:rrf'], active: ['refund:bm25', 'refund:vector', 'refund:graph'] },
    explanation: `The ${winnerName} wins with fused score ${fusedScores[winnerIdx]} because it appears near the top of all ${numRetrievers} lists. A document that wins one retriever but is invisible elsewhere can still enter the pool, but it does not dominate by raw-score scale.`,
  };

  const protections = ['score scale', 'outlier score', 'broad agreement', 'missing evidence'];
  const numProtections = protections.length;

  yield {
    state: labelMatrix(
      'What RRF protects against',
      [
        { id: 'score_scale', label: 'score scale' },
        { id: 'outlier', label: 'outlier score' },
        { id: 'agreement', label: 'broad agreement' },
        { id: 'recall', label: 'missing evidence' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['no normalization needed', 'uses ranks only'],
        ['less sensitive', 'still depends on cutoff'],
        ['rewarded naturally', 'not proof of truth'],
        ['cannot recover missing docs', 'needs good retrievers'],
      ],
    ),
    highlight: { active: ['score_scale:effect', 'outlier:effect', 'agreement:effect'], removed: ['recall:limit'] },
    explanation: `RRF addresses ${numProtections} concerns (${protections.join(', ')}), but it is a fusion primitive, not a relevance oracle. It makes candidate merging across ${numRetrievers} retrievers robust, but the candidate lists still need enough recall for the downstream reranker and generator.`,
  };
}

function* hybridSearchCase() {
  const stageNames = ['query', 'lexical list', 'vector list', 'RRF list', 'reranker'];
  const numStages = stageNames.length;
  const defaultK = 60;

  yield {
    state: labelMatrix(
      'Hybrid RAG candidate stages',
      [
        { id: 'q', label: 'query' },
        { id: 'lex', label: 'lexical list' },
        { id: 'vec', label: 'vector list' },
        { id: 'rrf', label: 'RRF list' },
        { id: 'rerank', label: 'reranker' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'output', label: 'output' },
      ],
      [
        ['parse intent', 'terms + embedding'],
        ['exact identifiers', 'ranked docs'],
        ['semantic neighbors', 'ranked docs'],
        ['merge by rank', 'candidate pool'],
        ['joint relevance', 'final context'],
      ],
    ),
    highlight: { active: ['lex:output', 'vec:output', 'rrf:job'], found: ['rerank:output'] },
    explanation: `Follow the ${numStages} rows left to right: fast retrievers create lists, RRF (stage ${stageNames.indexOf('RRF list') + 1} of ${numStages}) makes one candidate pool, and the expensive reranker spends compute only after fusion has widened recall.`,
  };

  const kChoices = ['small k', `k around ${defaultK}`, 'large k', 'rank window'];
  const numKnobs = kChoices.length;

  yield {
    state: labelMatrix(
      'Choosing k and cutoffs',
      [
        { id: 'smallk', label: 'small k' },
        { id: 'defaultk', label: `k around ${defaultK}` },
        { id: 'largek', label: 'large k' },
        { id: 'cutoff', label: 'rank window' },
      ],
      [
        { id: 'behavior', label: 'behavior' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['top ranks matter more', 'one list can dominate'],
        ['smooth rank discount', 'common baseline'],
        ['agreement matters more', 'weakens top-rank signal'],
        ['limits candidates', 'can hide late evidence'],
      ],
    ),
    highlight: { active: ['defaultk:behavior'], compare: ['smallk:risk', 'largek:risk'], removed: ['cutoff:risk'] },
    explanation: `RRF has ${numKnobs} tuning dimensions (${kChoices.join(', ')}), fewer than weighted-score fusion, but not zero. The standard baseline k = ${defaultK} gives smooth rank discount; per-list cutoff controls which documents get any contribution.`,
  };

  const signalSources = ['BM25', 'vector ANN', 'graph edge', 'metadata filter'];
  const numSignals = signalSources.length;

  yield {
    state: labelMatrix(
      'Complete case study: support search',
      [
        { id: 'policy', label: 'policy id' },
        { id: 'paraphrase', label: 'paraphrase' },
        { id: 'team', label: 'team relation' },
        { id: 'fresh', label: 'freshness' },
      ],
      [
        { id: 'best signal', label: 'best signal' },
        { id: 'fusion value', label: 'fusion value' },
      ],
      [
        ['BM25', 'exact policy survives'],
        ['vector ANN', 'semantic match survives'],
        ['graph edge', 'owner context survives'],
        ['metadata filter', 'stale docs excluded'],
      ],
    ),
    highlight: { found: ['policy:fusion value', 'paraphrase:fusion value', 'team:fusion value'], active: ['fresh:best signal'] },
    explanation: `RRF merges ${numSignals} signal sources (${signalSources.join(', ')}) so a support assistant keeps exact policy IDs, semantic paraphrases, and relationship evidence in one candidate set before the reranker spends real compute.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'score documents') yield* scoreDocuments();
  else if (view === 'hybrid search case') yield* hybridSearchCase();
  else throw new InputError('Pick a reciprocal-rank-fusion view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each input list as one retriever voting with order, not with raw score. Rank 1 means the retriever liked that document most for this query; rank 4 means it liked three documents more. A missing document gives no vote from that retriever.',
        'The fused-score table shows the safe inference rule: add 1 / (k + rank) for every list where the document appears, then sort by the sum. A document supported by several retrievers can beat a document that won one list and disappeared from the others.',
        {type: 'image', src: './assets/gifs/reciprocal-rank-fusion.gif', alt: 'Animated walkthrough of the reciprocal rank fusion visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Search systems often use more than one retriever. A lexical retriever finds exact words, while a vector retriever finds nearby meaning in an embedding space. Their scores are not measured in the same units, so adding BM25 score 12.7 to cosine score 0.81 has no stable meaning.',
        'Reciprocal Rank Fusion, or RRF, solves the candidate-merging problem before final reranking. It turns each rank into a small vote and sums those votes across retrievers. The output is not final truth; it is a better pool for a later filter or reranker.',
        {type: 'callout', text: 'RRF treats rank as the shared currency between retrievers, so lexical, vector, graph, and freshness signals can vote without score calibration.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is score normalization. Put every retriever score on a zero-to-one scale, add the results, and sort. That can work in a controlled benchmark where score distributions stay stable.',
        'Real queries do not stay stable. Exact identifier queries, broad semantic queries, misspellings, rare terms, and long policy questions produce different score shapes. A normalization rule that helps one slice can bury useful documents in another.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is score calibration. BM25, vector similarity, graph proximity, and freshness boosts are produced by different mechanisms. Their raw values do not carry a shared probability or utility interpretation.',
        'Choosing one retriever avoids calibration but loses recall. Lexical search misses paraphrases, while vector search can miss exact part numbers or legal citations. Hybrid search exists because each retriever fails in a different direction.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Rank position is a weaker signal than score, but it is much more portable. If a retriever places a document near the top, that fact can be compared with another retriever placing another document near the top. RRF uses rank as the common unit.',
        {type: 'image', src: 'https://qdrant.tech/articles_data/hybrid-search/fusion.png', alt: 'Dense and sparse search result lines normalized and fused into one mixed ranking', caption: 'Hybrid search exposes the reason RRF exists: dense and sparse retrievers produce different score spaces, so fusion needs a rank-level bridge. Source: https://qdrant.tech/articles/hybrid-search/.'},
        'The reciprocal formula gives diminishing credit as rank gets worse. With k = 60, rank 1 contributes 1/61, rank 2 contributes 1/62, and rank 10 contributes 1/70. Top ranks matter, but agreement across lists can still win.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with several ranked lists for the same query. Number each list from rank 1 downward. For each document, add 1 / (k + rank) to its fused score for every list where it appears.',
        'Missing documents add zero for that list. After all lists are processed, sort by fused score and keep the top candidates. Production systems usually run hard filters such as tenant access before fusion, then send the fused pool to a stronger reranker.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'RRF works because independent retrieval methods make partly independent errors. A document that appears near the top of both lexical and semantic retrieval has survived two different tests. That agreement is useful even when the raw scores cannot be compared.',
        'The correctness claim is narrow: given ranked input lists and the RRF formula, the algorithm returns the documents in descending fused-score order. Each contribution is nonnegative, so adding another appearance can only help a document. Sorting the accumulated map therefore implements exactly the stated voting rule.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'If there are m lists with L candidates each, accumulation is O(mL) time. The map stores at most mL distinct document IDs, so memory is O(u), where u is the number of unique candidates. Sorting the unique candidates costs O(u log u).',
        'The behavior is usually cheap because L is small compared with the full corpus. Doubling the number of retrievers roughly doubles accumulation work. Doubling the per-list cutoff increases both recall and reranker cost, so cutoff is a product decision as much as an algorithm knob.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RRF is common in hybrid search for retrieval-augmented generation, enterprise search, support search, code search, and legal discovery. The fit is strongest when first-stage retrievers are valuable but not score-calibrated.',
        'A support assistant is a typical case. BM25 finds the exact refund policy, vector search finds paraphrased guidance, and metadata retrieval finds recent account-specific documents. RRF keeps evidence from each path alive before a reranker spends expensive compute.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'RRF cannot recover a document that no input retriever returned. It also cannot decide authorization, freshness, or factual correctness. Those constraints need filters, deduplication, and downstream evaluation.',
        'A noisy retriever can waste the candidate budget, especially when its list is long. A small k makes first-place results dominate; a large k rewards broad agreement more heavily. The setting should be chosen by measuring candidate recall before reranking and task quality after reranking.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use k = 60 and three documents. BM25 ranks A first, B second, C third. Vector search ranks B first, C second, A fifth. Graph retrieval ranks C first and A second, with B missing.',
        'A gets 1/61 + 1/65 + 1/62 = 0.01639 + 0.01538 + 0.01613 = 0.04790. B gets 1/62 + 1/61 = 0.01613 + 0.01639 = 0.03252. C gets 1/63 + 1/62 + 1/61 = 0.01587 + 0.01613 + 0.01639 = 0.04839.',
        'The final order is C, A, B. C never won the lexical list, but it appeared near the top everywhere. B won vector search, but missing from graph retrieval left it behind.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Cormack, Clarke, and Buettcher, Reciprocal Rank Fusion Outperforms Condorcet and Individual Rank Learning Methods, SIGIR 2009, https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf. Implementation references: Elasticsearch RRF documentation and Azure AI Search hybrid ranking documentation.',
        'Study next: inverted indexes for lexical retrieval, HNSW for vector search, cross-encoder rerankers for precision, and deduplication for chunked retrieval. Those topics explain the pieces that RRF joins.',
      ],
    },
  ],
};