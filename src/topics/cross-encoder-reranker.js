// Cross-encoder reranking: score query-document pairs jointly after a cheap
// first-stage retriever has narrowed the candidate set.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'cross-encoder-reranker',
  title: 'Cross-Encoder Reranker',
  category: 'AI & ML',
  summary: 'A retrieval cascade pattern: retrieve cheaply, then score query-document pairs jointly with a slower but more precise Transformer.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pair scoring', 'retrieval cascade'], defaultValue: 'pair scoring' },
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

function pairGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.7, y: 4.5, note: 'tokens' },
      { id: 'doc', label: 'chunk', x: 0.7, y: 2.2, note: 'tokens' },
      { id: 'pair', label: 'pair', x: 2.8, y: 3.4, note: 'q + chunk' },
      { id: 'transformer', label: 'cross-attn', x: 5.2, y: 3.4, note: 'joint tokens' },
      { id: 'head', label: 'score', x: 7.4, y: 3.4, note: 'relevance' },
      { id: 'rank', label: 'rank', x: 9.2, y: 3.4, note: 'top-k' },
    ],
    edges: [
      { id: 'e-query-pair', from: 'query', to: 'pair' },
      { id: 'e-doc-pair', from: 'doc', to: 'pair' },
      { id: 'e-pair-transformer', from: 'pair', to: 'transformer' },
      { id: 'e-transformer-head', from: 'transformer', to: 'head' },
      { id: 'e-head-rank', from: 'head', to: 'rank' },
    ],
  }, { title });
}

function cascadeGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.6, y: 3.5, note: 'user' },
      { id: 'bm25', label: 'BM25', x: 2.2, y: 1.8, note: 'cheap' },
      { id: 'ann', label: 'ANN', x: 2.2, y: 5.2, note: 'cheap' },
      { id: 'fusion', label: 'fusion', x: 4.1, y: 3.5, note: 'top 100' },
      { id: 'batch', label: 'batch pairs', x: 5.9, y: 3.5, note: 'GPU/CPU' },
      { id: 'ce', label: 'cross-encoder', x: 7.8, y: 3.5, note: 'precise' },
      { id: 'context', label: 'context', x: 9.4, y: 3.5, note: 'top 5' },
    ],
    edges: [
      { id: 'e-query-bm25', from: 'query', to: 'bm25' },
      { id: 'e-query-ann', from: 'query', to: 'ann' },
      { id: 'e-bm25-fusion', from: 'bm25', to: 'fusion' },
      { id: 'e-ann-fusion', from: 'ann', to: 'fusion' },
      { id: 'e-fusion-batch', from: 'fusion', to: 'batch' },
      { id: 'e-batch-ce', from: 'batch', to: 'ce' },
      { id: 'e-ce-context', from: 'ce', to: 'context' },
    ],
  }, { title });
}

function* pairScoring() {
  yield {
    state: pairGraph('A cross-encoder reads query and chunk together'),
    highlight: { active: ['query', 'doc', 'pair', 'e-query-pair', 'e-doc-pair'], compare: ['rank'] },
    explanation: 'A bi-encoder compares two precomputed vectors. A cross-encoder instead concatenates the query and candidate chunk into one Transformer input, so query tokens and document tokens can attend to each other directly.',
  };

  yield {
    state: labelMatrix(
      'One query, four candidate chunks',
      [
        { id: 'a', label: 'refund policy' },
        { id: 'b', label: 'billing FAQ' },
        { id: 'c', label: 'cancel annual plan' },
        { id: 'd', label: 'login help' },
      ],
      [
        { id: 'first_stage', label: 'retriever rank' },
        { id: 'ce_score', label: 'cross score' },
        { id: 'reranked', label: 'new rank' },
      ],
      [
        ['1', '0.68', '2'],
        ['2', '0.42', '3'],
        ['3', '0.91', '1'],
        ['4', '0.08', 'drop'],
      ],
    ),
    highlight: { active: ['c:ce_score', 'c:reranked'], compare: ['a:first_stage', 'a:reranked'], removed: ['d:reranked'] },
    explanation: 'The reranker is allowed to disagree with first-stage retrieval. It can lift a lower-ranked candidate when the query and chunk match precisely under joint attention.',
    invariant: 'A reranker can only reorder candidates it receives; it cannot recover evidence missing from the candidate pool.',
  };

  yield {
    state: pairGraph('The score head turns joint attention into relevance'),
    highlight: { active: ['transformer', 'head', 'rank', 'e-transformer-head', 'e-head-rank'], found: ['pair'] },
    explanation: 'The Transformer produces contextual representations over the combined query-document sequence. A small classification or ranking head converts that representation into a relevance score.',
  };

  yield {
    state: labelMatrix(
      'Architecture tradeoff',
      [
        { id: 'bi', label: 'bi-encoder' },
        { id: 'colbert', label: 'ColBERT' },
        { id: 'cross', label: 'cross-encoder' },
        { id: 'llm', label: 'LLM reranker' },
      ],
      [
        { id: 'interaction', label: 'interaction' },
        { id: 'cost', label: 'cost' },
        { id: 'role', label: 'best role' },
      ],
      [
        ['vector dot product', 'low', 'first-stage recall'],
        ['late token MaxSim', 'medium', 'precision layer'],
        ['full joint attention', 'high', 'top-k rerank'],
        ['prompted list judgment', 'very high', 'ambiguous final set'],
      ],
    ),
    highlight: { active: ['cross:interaction', 'cross:role'], compare: ['bi:cost', 'llm:cost'], found: ['colbert:role'] },
    explanation: 'Cross-encoders sit at the expensive end of the retrieval cascade. They are usually too slow for millions of documents, but strong on tens or hundreds of candidates.',
  };
}

function* retrievalCascade() {
  yield {
    state: cascadeGraph('Retrieve broadly, rerank narrowly'),
    highlight: { active: ['query', 'bm25', 'ann', 'fusion', 'e-query-bm25', 'e-query-ann'], compare: ['ce'] },
    explanation: 'The first stage is optimized for recall and speed. BM25, HNSW, metadata filters, and rank fusion create a candidate pool that is small enough for the expensive reranker.',
  };

  yield {
    state: cascadeGraph('Batch the pairs before scoring'),
    highlight: { active: ['fusion', 'batch', 'ce', 'e-fusion-batch', 'e-batch-ce'], found: ['context'] },
    explanation: 'Serving cost depends on candidate count, sequence length, model size, and batching. A query with 100 candidates means 100 Transformer forward passes unless the system batches pairs efficiently.',
  };

  yield {
    state: labelMatrix(
      'Rerank budget ledger',
      [
        { id: 'top20', label: 'top 20' },
        { id: 'top100', label: 'top 100' },
        { id: 'top500', label: 'top 500' },
        { id: 'listwise', label: 'listwise LLM' },
      ],
      [
        { id: 'quality', label: 'quality chance' },
        { id: 'latency', label: 'latency' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['medium', 'low', 'missed evidence if recall shallow'],
        ['strong', 'medium', 'batch pressure'],
        ['stronger', 'high', 'serving cost explodes'],
        ['depends', 'very high', 'prompt order bias'],
      ],
    ),
    highlight: { active: ['top100:quality', 'top100:latency'], compare: ['top500:latency', 'top20:risk'], removed: ['listwise:risk'] },
    explanation: 'The right rerank depth is empirical. Too shallow and the answer passage never reaches the model. Too deep and the reranker becomes the bottleneck.',
  };

  yield {
    state: labelMatrix(
      'Evaluation layers',
      [
        { id: 'candidate', label: 'candidate recall' },
        { id: 'rerank', label: 'rerank nDCG/MRR' },
        { id: 'answer', label: 'answer faithfulness' },
        { id: 'cost', label: 'cost and p95' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure if ignored', label: 'failure if ignored' },
      ],
      [
        ['did retrieval find support?', 'reranker blamed unfairly'],
        ['did reranker order support high?', 'context packed poorly'],
        ['did generator use support?', 'pleasant hallucination'],
        ['can it serve traffic?', 'offline metric wins only'],
      ],
    ),
    highlight: { found: ['candidate:question', 'rerank:question', 'answer:question', 'cost:question'] },
    explanation: 'Reranking is not a final-answer metric by itself. Measure candidate recall, ranking quality, generated answer faithfulness, and serving latency separately.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pair scoring') yield* pairScoring();
  else if (view === 'retrieval cascade') yield* retrievalCascade();
  else throw new InputError('Pick a cross-encoder reranker view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A cross-encoder reranker is a second-stage retrieval model. A cheap first-stage retriever finds candidates from a large corpus. The cross-encoder then scores each query-document pair jointly by feeding the query and candidate text into the same Transformer input. Because query tokens and document tokens attend to each other inside the model, the relevance judgment is richer than a vector dot product.',
        'The classic BERT reranking paper by Nogueira and Cho fine-tuned BERT for query-based passage reranking and reported strong MS MARCO and TREC-CAR results: https://arxiv.org/abs/1901.04085. The later multi-stage ranking work arranged monoBERT and duoBERT in a cascade where candidate depth controls the quality-latency tradeoff: https://arxiv.org/abs/1910.14424.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The input usually looks like `[CLS] query [SEP] passage [SEP]`. The Transformer runs full self-attention over the combined sequence. A score head reads a pooled representation or special token and emits a relevance score. At serving time, the system repeats this for every candidate, then sorts candidates by score and sends only the best few chunks to the generator or final ranking stage.',
        'This differs from Embeddings & Similarity. A bi-encoder computes one query vector and many reusable document vectors, which is cheap enough for HNSW or Product Quantization. A cross-encoder cannot precompute a universal document score because the document representation depends on the query. That is the price of richer interaction.',
      ],
    },
    {
      heading: 'Retrieval cascade design',
      paragraphs: [
        'Production systems use cross-encoders after Multi-Index RAG has already narrowed the pool. BM25 catches exact terms, ANN search catches semantic paraphrases, metadata filters enforce scope, and rank fusion builds a candidate set. The cross-encoder then spends expensive Transformer passes only on the top 20, 50, 100, or 200 candidates.',
        'Batching matters. Reranking 100 candidates is 100 query-document inputs. Long chunks increase quadratic attention cost. Larger models improve judgment but raise p95 latency. A practical system treats rerank depth, max sequence length, model size, batch size, and fallback behavior as explicit product knobs rather than invisible defaults.',
      ],
    },
    {
      heading: 'Complete case study: support policy search',
      paragraphs: [
        'A user asks, "Can I cancel an annual plan after the renewal invoice?" BM25 may rank a generic refund page first because it contains exact words. A vector retriever may rank broad billing pages because they are semantically near the question. The cross-encoder sees each candidate with the query at the same time, so it can reward the passage that specifically connects annual plan, renewal invoice, cancellation window, and refund exception.',
        'The deployed cascade should still preserve evidence discipline. Candidate recall must be high enough that the real policy reaches the reranker. Authorization filters must run before the pair is scored or inserted into a prompt. Duplicates should be collapsed so one long document does not occupy all context slots. Final answers should be evaluated with LLM Evaluation Harness & Golden Sets, not only reranker scores.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A cross-encoder is not a corpus search engine. It is too expensive to run against every document in a large corpus. It also cannot fix missing first-stage recall: if retrieval never found the supporting passage, reranking cannot invent it. Another mistake is treating a higher reranker score as citation support. The model predicts relevance; the answer still needs grounded generation and source checking.',
        'There are several variants. monoBERT and monoT5 score one query-document pair at a time. duoBERT and duoT5 compare pairs of documents. RankT5 studies T5-based ranking models with pairwise and listwise ranking losses: https://arxiv.org/abs/2210.10634. Sentence Transformers documents the common retrieve-and-rerank deployment pattern: https://www.sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Passage Re-ranking with BERT at https://arxiv.org/abs/1901.04085, Multi-Stage Document Ranking with BERT at https://arxiv.org/abs/1910.14424, monoT5 at https://arxiv.org/abs/2003.06713, RankT5 at https://arxiv.org/abs/2210.10634, Sentence Transformers cross-encoder usage at https://sbert.net/docs/cross_encoder/usage/usage.html, and MS MARCO passage ranking resources at https://microsoft.github.io/MSMARCO-Passage-Ranking-Submissions/leaderboard/.',
        'Study Multi-Index RAG, ColBERT Late-Interaction Retrieval, Attention Mechanism, The Transformer Block, HNSW, Product Quantization for Vector Search, and LLM Evaluation Harness & Golden Sets next.',
      ],
    },
  ],
};
