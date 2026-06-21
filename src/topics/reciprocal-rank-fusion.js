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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/reciprocal-rank-fusion.gif', alt: 'Animated walkthrough of the reciprocal rank fusion visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Reciprocal Rank Fusion exists because modern search often has several useful retrievers whose scores cannot be compared directly. BM25 returns lexical scores shaped by term frequency and document length. Vector search returns distances or similarities from an embedding space. Graph retrieval may return relationship strength. Metadata or freshness rules may create yet another signal. Adding those raw numbers together is usually nonsense.',
        'The practical problem is candidate recall. A support assistant, RAG system, enterprise search box, or code search tool wants exact term matches, semantic paraphrases, graph-neighbor evidence, and recent documents to all have a chance to reach the reranker. RRF gives those systems a cheap, robust way to merge ranked lists before expensive reranking.',
        'The method is deliberately modest. It does not decide truth, authorization, freshness, or final relevance. It solves one narrow but important problem: take several ranked lists and create one candidate pool without brittle score normalization.',
        {type: 'callout', text: 'RRF treats rank as the shared currency between retrievers, so lexical, vector, graph, and freshness signals can vote without score calibration.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is score normalization: rescale BM25, cosine similarity, graph scores, and metadata boosts onto a shared range, then add them. That looks principled until the distributions shift by query type. Exact identifier queries, broad semantic questions, short queries, long queries, and rare terms all produce different score shapes. A normalization that works in one slice can fail in another.',
        'Another approach is to pick one retriever as the source of truth. That gives stable behavior but poor recall. Lexical search misses paraphrases. Vector search misses exact rare identifiers. Graph expansion can find related objects but drift away from the user query. Hybrid systems exist because each retriever has a different blind spot.',
        'RRF avoids those traps by throwing away raw score magnitudes. It asks only where a candidate appeared in each list. That is less expressive than calibrated scoring, but it is also much harder to break accidentally.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that rank position is a common currency. A document ranked first by a retriever is receiving a strong vote from that retriever, even if the raw score scale is incomparable to another retriever. RRF turns that position into a contribution of 1 / (k + rank), then sums contributions across lists.',
        {type: 'image', src: 'https://qdrant.tech/articles_data/hybrid-search/fusion.png', alt: 'Dense and sparse search result lines normalized and fused into one mixed ranking', caption: 'Hybrid search exposes the reason RRF exists: dense and sparse retrievers produce different score spaces, so fusion needs a rank-level bridge. Source: https://qdrant.tech/articles/hybrid-search/.'},
        'The constant k controls how sharply top ranks dominate. With the common k = 60 baseline, rank 1 contributes 1/61, rank 2 contributes 1/62, and so on. The difference between adjacent ranks is smooth rather than explosive. That lets broad agreement across retrievers beat a lonely first-place result when the lonely result is invisible elsewhere.',
        'This makes RRF a candidate-pool algorithm. It is not a final judge. Its job is to preserve diverse plausible evidence so a downstream reranker, filter, or answer generator has something worth evaluating.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each input list, assign ranks starting at 1. For each document in a list, add 1 / (k + rank) to that document’s fused score. If a document is missing from a list, it contributes zero for that list. After processing all lists, sort documents by fused score and keep the top candidates.',
        'Suppose BM25 ranks a refund policy first, vector search ranks it second, and graph expansion ranks it fourth. With k = 60, the policy receives 1/61 + 1/62 + 1/64. A document ranked first by only one retriever receives 1/61. The broadly supported policy can outrank the isolated winner because several weakly discounted votes add up.',
        'In production, RRF usually runs after filtering and before reranking. Access control, tenant filters, language filters, freshness filters, or document-type constraints should run before fusion when they are hard requirements. The reranker then spends more expensive compute on a fused candidate pool rather than on every document.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The first visual proves the join point in a hybrid retrieval system. BM25, vector search, and graph retrieval each return their own ranked list. RRF sits where those lists meet. It does not need to know why a retriever liked a document, only where that document ranked.',
        'The contribution table proves the math. A top result gets a little more credit than a second-place result, but not infinitely more. A missing document gets nothing. The fused-score table then shows the behavior that matters: a document that appears near the top of several lists can outrank a document that appears at the top of only one.',
        'The hybrid-search case proves the boundary between recall and precision. RRF widens recall by preserving several retrieval perspectives. A cross-encoder, late-interaction model, or other reranker later decides final precision. If the relevant document never appears in any input list, RRF cannot invent it.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because retrievers make different errors. Lexical search is good at exact identifiers and rare terms. Vector search is good at paraphrase and semantic neighborhood. Graph search is good at relationships. A relevant document that appears in several independent lists is often worth keeping, even if none of the raw scores can be compared.',
        'It also works because rank is robust. The difference between a BM25 score of 13 and 9 may not mean the same thing as the difference between cosine 0.82 and 0.78. But rank 1 versus rank 20 has a shared operational meaning: this retriever preferred one item strongly enough to place it high in its own ordering.',
        'The reciprocal formula gives a smooth discount. It rewards top positions without letting a single top rank dominate every other signal. That balance is why RRF is common as a default hybrid-search merger.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'RRF is cheap. It needs ranked lists, a map from document ID to accumulated score, and a final sort. The expensive work is upstream retrieval and downstream reranking. For short candidate lists, the cost is usually negligible compared with embedding search or cross-encoder scoring.',
        'The important knobs are k, per-list cutoff, duplicate handling, filters, and optional weights. Smaller k makes top positions matter more. Larger k makes agreement across lists matter more. Short cutoffs reduce cost but can hide late evidence. Weighted RRF can express trust differences between retrievers, but it reintroduces some tuning fragility.',
        'There is also a fairness tradeoff across retrievers. A noisy retriever can contribute candidates that consume reranker budget. A narrow retriever can starve the pool. The right evaluation should measure candidate recall before reranking, precision after reranking, and final answer quality or task success.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'RRF wins in hybrid search, enterprise search, legal retrieval, support assistants, code search, RAG systems, and recommendation candidate generation. It is especially useful when several first-stage retrievers are individually useful but their scores are not calibrated to one another.',
        'A support assistant is the complete example. A user asks about canceling an annual plan after a renewal invoice. BM25 finds exact policy language. Vector search finds paraphrased refund guidance. Graph expansion finds account-owner relationships. Metadata filters remove stale documents. RRF merges the survivors so a reranker can choose the final evidence.',
        'It is also valuable during system iteration. Teams can add or remove retrievers without redesigning a global score function every time. That does not eliminate evaluation, but it makes the candidate pipeline easier to evolve.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'RRF does not know whether a document is true, fresh, authorized, or sufficiently specific. It only knows where the document appeared in each ranked list. If every retriever misses the supporting passage, fusion cannot recover it. If a retriever returns unauthorized documents, RRF can accidentally promote them unless access control filters run before fusion.',
        'Another mistake is treating k = 60 as a law. It is a strong baseline, but the right setting depends on list depths, number of retrievers, and how much you want to reward agreement versus top-rank dominance. Evaluate candidate recall, rerank precision, and answer faithfulness separately.',
        'A subtler failure is duplicate fragmentation. The same passage may appear through several chunk IDs, document versions, or near-duplicates. If deduplication is weak, RRF may spend the top pool on redundant evidence rather than diverse support.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: RRF paper PDF at https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf, ACM DOI at https://dl.acm.org/doi/10.1145/1571941.1572114, Google Research page at https://research.google/pubs/reciprocal-rank-fusion-outperforms-condorcet-and-individual-rank-learning-methods/, Elasticsearch RRF docs at https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion, and Azure hybrid scoring docs at https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking.',
        'Study Inverted Index, SPLADE Learned Sparse Retrieval, HNSW Search, Query Expansion and HyDE, Multi-Index RAG, Cross-Encoder Reranker, ColBERT Late-Interaction Retrieval, RAG Dedup MinHash Chunk Canonicalization, and LLM Evaluation Golden Sets next.',
      ],
    },
  ],
};
