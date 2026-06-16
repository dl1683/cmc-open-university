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
  yield {
    state: rrfGraph('RRF merges ranked lists without score normalization'),
    highlight: { active: ['bm25', 'vector', 'graph', 'rrf', 'e-bm25-rrf', 'e-vector-rrf', 'e-graph-rrf'], found: ['pool'], compare: ['rerank'] },
    explanation: 'Hybrid retrieval gives you several ranked lists whose raw scores are not comparable. BM25, cosine similarity, and graph distance mean different things, so RRF throws away raw scores and keeps positions.',
  };

  yield {
    state: labelMatrix(
      'RRF contribution with k = 60',
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
        ['1 / 61', '0.0164'],
        ['1 / 62', '0.0161'],
        ['1 / 63', '0.0159'],
        ['1 / 64', '0.0156'],
        ['0', 'not found'],
      ],
    ),
    highlight: { active: ['rank1:value', 'rank2:value'], compare: ['missing:value'] },
    explanation: 'The constant k dampens the difference between nearby ranks. Rank 1 still beats rank 4, but broad agreement across retrievers can beat one isolated first-place result.',
    invariant: 'RRF score(document) = sum over lists of 1 / (k + rank_in_that_list).',
  };

  yield {
    state: labelMatrix(
      'Fused scores',
      [
        { id: 'policy', label: 'policy-17' },
        { id: 'refund', label: 'refund guide' },
        { id: 'plan', label: 'plan table' },
        { id: 'owner', label: 'owner node' },
      ],
      [
        { id: 'bm25', label: 'BM25 rank' },
        { id: 'vector', label: 'vector rank' },
        { id: 'graph', label: 'graph rank' },
        { id: 'rrf', label: 'fused' },
      ],
      [
        ['1', '2', '4', '0.0481'],
        ['2', '1', '3', '0.0484'],
        ['3', '4', 'missing', '0.0315'],
        ['missing', 'missing', '1', '0.0164'],
      ],
    ),
    highlight: { found: ['refund:rrf', 'policy:rrf'], compare: ['owner:rrf'], active: ['refund:bm25', 'refund:vector', 'refund:graph'] },
    explanation: 'The refund guide wins because it appears near the top of all three lists. A document that wins one retriever but is invisible elsewhere can still enter the pool, but it does not dominate by raw-score scale.',
  };

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
    explanation: 'RRF is a fusion primitive, not a relevance oracle. It makes candidate merging robust, but the candidate lists still need enough recall for the downstream reranker and generator.',
  };
}

function* hybridSearchCase() {
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
    explanation: 'In production RAG, RRF usually sits between first-stage retrieval and expensive reranking. It creates a stable candidate pool without pretending BM25 scores and vector scores are calibrated.',
  };

  yield {
    state: labelMatrix(
      'Choosing k and cutoffs',
      [
        { id: 'smallk', label: 'small k' },
        { id: 'defaultk', label: 'k around 60' },
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
    explanation: 'RRF has fewer knobs than weighted-score fusion, but it still has knobs. k controls rank discount; per-list cutoff controls which documents get any contribution.',
  };

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
    explanation: 'RRF lets a support assistant keep exact policy IDs, semantic paraphrases, and relationship evidence in one candidate set before the Cross-Encoder Reranker spends real compute.',
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
      heading: 'What it is',
      paragraphs: [
        'Reciprocal Rank Fusion, or RRF, is a rank-fusion algorithm for combining several ranked result lists into one list. Instead of trying to normalize raw scores from different retrieval systems, it uses only rank positions. A document receives a small contribution from each list where it appears: 1 / (k + rank). The final score is the sum of those contributions.',
        'The original SIGIR 2009 paper by Cormack, Clarke, and Buettcher describes RRF as a simple method for combining multiple information-retrieval systems and reports that it outperformed Condorcet and individual rank-learning methods in their experiments: https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf. The Google Research publication page is at https://research.google/pubs/reciprocal-rank-fusion-outperforms-condorcet-and-individual-rank-learning-methods/.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Suppose BM25 ranks a policy page first, vector search ranks it second, and graph expansion ranks it fourth. With k = 60, the page receives 1/61 + 1/62 + 1/64. Another page that appears first in one list but is missing from the others receives only 1/61. This is the central intuition: broad agreement across retrievers can beat an isolated win from one retriever.',
        'RRF is especially useful when scores are not comparable. BM25 scores depend on term statistics. Cosine similarity depends on embedding geometry. Graph distances or relation scores may have different ranges entirely. RRF avoids score calibration by turning every signal into the same unit: rank position.',
      ],
    },
    {
      heading: 'Complete case study: hybrid RAG',
      paragraphs: [
        'A support assistant receives a query about canceling an annual plan after a renewal invoice. BM25 finds exact policy terms. SPLADE Learned Sparse Retrieval contributes neural term expansion while still using postings. HNSW finds semantically related refund guidance. Metadata filters remove stale documents. A graph expansion finds the account-owner policy. RRF merges those ranked lists into a candidate pool, then the Cross-Encoder Reranker or ColBERT Late-Interaction Retrieval layer chooses the final evidence.',
        'This case is why RRF belongs inside Multi-Index RAG. The goal is not to crown the single best retriever. The goal is to preserve enough diverse evidence for a more expensive precision layer. If RRF admits a broad but noisy top 100, the reranker can still recover. If fusion is too narrow, the downstream model never sees the evidence.',
      ],
    },
    {
      heading: 'Cost and tuning',
      paragraphs: [
        'RRF is cheap. It needs ranked lists, a map from document id to accumulated score, and a final sort. The expensive work is upstream retrieval and downstream reranking. The important knobs are k, per-list cutoff, duplicate handling, and whether some lists should be weighted or filtered before fusion. Plain RRF is intentionally simple; adding weights makes it more expressive but also more fragile.',
        'Elasticsearch documents RRF as a way to combine multiple result sets with different relevance indicators: https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion. Azure AI Search uses RRF to merge full-text and vector results in hybrid search: https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'RRF does not know whether a document is true, fresh, authorized, or sufficiently specific. It only knows where the document appeared in each ranked list. If every retriever misses the supporting passage, fusion cannot recover it. If a retriever returns unauthorized documents, RRF can accidentally promote them unless access control filters run before fusion.',
        'Another mistake is treating k = 60 as a law. It is a strong baseline, but the right setting depends on list depths, number of retrievers, and how much you want to reward agreement versus top-rank dominance. Evaluate candidate recall, rerank precision, and answer faithfulness separately.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RRF paper PDF at https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf, ACM DOI at https://dl.acm.org/doi/10.1145/1571941.1572114, Google Research page at https://research.google/pubs/reciprocal-rank-fusion-outperforms-condorcet-and-individual-rank-learning-methods/, Elasticsearch RRF docs at https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion, and Azure hybrid scoring docs at https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking.',
        'Study Inverted Index, SPLADE Learned Sparse Retrieval, HNSW (Vector Search at Scale), Multi-Index RAG, Cross-Encoder Reranker, ColBERT Late-Interaction Retrieval, and LLM Evaluation Harness & Golden Sets next.',
      ],
    },
  ],
};
