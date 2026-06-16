// Maximal Marginal Relevance: greedily select results that are both relevant
// to the query and non-redundant with results already selected.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'maximal-marginal-relevance',
  title: 'Maximal Marginal Relevance (MMR)',
  category: 'Algorithms',
  summary: 'A diversity-aware reranking algorithm that balances query relevance against redundancy with already selected results.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['greedy selection', 'RAG context case'], defaultValue: 'greedy selection' },
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

function mmrGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.7, y: 3.5, note: 'intent' },
      { id: 'a', label: 'A1', x: 2.7, y: 2.5 },
      { id: 'b', label: 'B', x: 2.7, y: 3.5, note: 'refund v2' },
      { id: 'c', label: 'C', x: 2.7, y: 4.8, note: 'renewal' },
      { id: 'd', label: 'D', x: 2.7, y: 6.0, note: 'billing' },
      { id: 'mmr', label: 'MMR', x: 5.4, y: 3.5, note: 'diversify' },
      { id: 'context', label: 'context', x: 8.0, y: 3.5, note: 'A,C,D' },
    ],
    edges: [
      { id: 'e-query-a', from: 'query', to: 'a' },
      { id: 'e-query-b', from: 'query', to: 'b' },
      { id: 'e-query-c', from: 'query', to: 'c' },
      { id: 'e-query-d', from: 'query', to: 'd' },
      { id: 'e-a-mmr', from: 'a', to: 'mmr' },
      { id: 'e-b-mmr', from: 'b', to: 'mmr' },
      { id: 'e-c-mmr', from: 'c', to: 'mmr' },
      { id: 'e-d-mmr', from: 'd', to: 'mmr' },
      { id: 'e-mmr-context', from: 'mmr', to: 'context' },
    ],
  }, { title });
}

function* greedySelection() {
  yield {
    state: mmrGraph('MMR keeps relevance while reducing duplicates'),
    highlight: { active: ['a', 'b', 'e-a-mmr', 'e-b-mmr'], compare: ['b'], found: ['c', 'd', 'context', 'e-mmr-context'] },
    explanation: 'Pure similarity often returns near-duplicates. In RAG, that wastes context: four chunks can fit in the prompt, but two of them may say the same thing.',
  };

  yield {
    state: labelMatrix(
      'Step 1: pick the most relevant chunk',
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
      ],
      [
        { id: 'query_sim', label: 'sim to query' },
        { id: 'selected', label: 'selected?' },
      ],
      [
        ['0.92', 'yes'],
        ['0.90', 'no'],
        ['0.84', 'no'],
        ['0.80', 'no'],
      ],
    ),
    highlight: { found: ['a:selected'], active: ['a:query_sim'], compare: ['b:query_sim'] },
    explanation: 'MMR starts with the most relevant item. After that, each new item must justify itself against what is already selected.',
  };

  yield {
    state: labelMatrix(
      'Step 2: score relevance minus redundancy',
      [
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
      ],
      [
        { id: 'rel', label: 'relevance' },
        { id: 'redundancy', label: 'similar to A' },
        { id: 'mmr', label: 'MMR score' },
      ],
      [
        ['0.90', '0.94', '0.43'],
        ['0.84', '0.40', '0.62'],
        ['0.80', '0.35', '0.60'],
      ],
    ),
    highlight: { active: ['c:mmr'], compare: ['b:rel', 'b:redundancy'], found: ['c:rel'] },
    explanation: 'With lambda = 0.7, the MMR score is 0.7 * relevance - 0.3 * max similarity to selected items. Candidate B is highly relevant, but it looks too much like A, so C wins.',
    invariant: 'MMR greedily maximizes relevance to the query while penalizing redundancy against the selected set.',
  };

  yield {
    state: labelMatrix(
      'Selected context is more diverse',
      [
        { id: 'slot1', label: 'slot 1' },
        { id: 'slot2', label: 'slot 2' },
        { id: 'slot3', label: 'slot 3' },
        { id: 'skip', label: 'skip' },
      ],
      [
        { id: 'chunk', label: 'chunk' },
        { id: 'coverage', label: 'coverage' },
      ],
      [
        ['refund policy v1', 'refund window'],
        ['annual plan rule', 'renewal'],
        ['invoice exception', 'billing'],
        ['refund policy v2', 'duplicate'],
      ],
    ),
    highlight: { found: ['slot1:coverage', 'slot2:coverage', 'slot3:coverage'], removed: ['skip:coverage'] },
    explanation: 'The final set covers more distinct evidence. MMR does not make the chunks true; it simply prevents one cluster of duplicates from occupying the whole context budget.',
  };
}

function* ragContextCase() {
  yield {
    state: labelMatrix(
      'Where MMR sits in a retrieval pipeline',
      [
        { id: 'search', label: 'first-stage search' },
        { id: 'mmr', label: 'MMR diversify' },
        { id: 'rerank', label: 'precision rerank' },
        { id: 'prompt', label: 'prompt context' },
      ],
      [
        { id: 'goal', label: 'goal' },
        { id: 'risk', label: 'risk if skipped' },
      ],
      [
        ['high recall', 'duplicates'],
        ['coverage', 'near-identical chunks'],
        ['best evidence first', 'irrelevant diversity'],
        ['compact support', 'context stuffing'],
      ],
    ),
    highlight: { active: ['mmr:goal', 'rerank:goal'], compare: ['search:risk', 'prompt:risk'] },
    explanation: 'MMR is usually a candidate-shaping step. It can run before or after a reranker, depending on whether the system wants diversity in candidates, final context, or both.',
  };

  yield {
    state: labelMatrix(
      'Lambda controls relevance vs diversity',
      [
        { id: 'low', label: 'lambda 0.3' },
        { id: 'mid', label: 'lambda 0.7' },
        { id: 'high', label: 'lambda 0.95' },
      ],
      [
        { id: 'behavior', label: 'behavior' },
        { id: 'failure', label: 'failure mode' },
      ],
      [
        ['very diverse', 'may drift off query'],
        ['balanced', 'common starting point'],
        ['mostly relevance', 'duplicates remain'],
      ],
    ),
    highlight: { active: ['mid:behavior'], compare: ['low:failure', 'high:failure'] },
    explanation: 'The lambda parameter is a product decision. Exploratory search may want more diversity. Legal or support answers may need stricter relevance and a smaller diversity penalty.',
  };

  yield {
    state: labelMatrix(
      'Complete case study: incident archive',
      [
        { id: 'dup1', label: 'same postmortem' },
        { id: 'dup2', label: 'same postmortem copy' },
        { id: 'alert', label: 'alert timeline' },
        { id: 'deploy', label: 'deploy note' },
      ],
      [
        { id: 'similarity_only', label: 'similarity top-k' },
        { id: 'mmr_context', label: 'MMR context' },
      ],
      [
        ['selected', 'selected'],
        ['selected', 'skipped'],
        ['missed', 'selected'],
        ['missed', 'selected'],
      ],
    ),
    highlight: { removed: ['dup2:mmr_context'], found: ['alert:mmr_context', 'deploy:mmr_context'], compare: ['alert:similarity_only', 'deploy:similarity_only'] },
    explanation: 'For "why did payments fail repeatedly?", similarity-only retrieval may return copies of the same incident. MMR gives the answerer one postmortem, one alert timeline, and one deployment note.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'greedy selection') yield* greedySelection();
  else if (view === 'RAG context case') yield* ragContextCase();
  else throw new InputError('Pick a maximal-marginal-relevance view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Maximal Marginal Relevance, or MMR, is a greedy reranking algorithm that selects items that are both relevant to the query and different from items already selected. In retrieval, it is used to reduce redundancy. In summarization, it helps select passages that cover different facts rather than repeating the same point.',
        'The original Carbonell and Goldstein paper introduces MMR for diversity-based reranking in document retrieval and summarization: https://www.cs.cmu.edu/~jgc/publication/The_Use_MMR_Diversity_Based_LTMIR_1998.pdf. The ACM entry is at https://dl.acm.org/doi/10.1145/290941.291025, and an ACL-hosted related workshop paper on MMR for diversity is at https://aclanthology.org/X98-1025/.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with a candidate set from a retriever. Pick the most relevant item first. Then repeatedly select the candidate that maximizes a weighted tradeoff: lambda times similarity to the query minus one minus lambda times the maximum similarity to any already selected item. The redundancy term asks, "does this candidate add new evidence, or is it just another version of what we already have?"',
        'The algorithm is greedy, so it is simple to implement. Maintain a selected set. For each remaining candidate, compute its relevance to the query and its maximum similarity to the selected set. Pick the largest MMR score, add it to selected, and repeat until the context budget is full.',
      ],
    },
    {
      heading: 'Complete case study: RAG context packing',
      paragraphs: [
        'A RAG system asks, "What recurring causes appear in payment incidents?" Similarity search returns five chunks from the same postmortem because they all mention payment failures. That looks high quality by nearest-neighbor score, but it is bad context packing. The model sees one incident five times and misses the alerting timeline, deployment note, and service ownership record.',
        'MMR changes the selected set. It keeps the strongest postmortem chunk, then penalizes near-duplicates and admits chunks that cover different parts of the story. The answer generator now has broader evidence. RAG Context Packing Token Budget then decides how those selected chunks fit, compress, and order inside the prompt. This pairs naturally with Reciprocal Rank Fusion, Multi-Index RAG, Cross-Encoder Reranker, and GraphRAG Community Summary Case Study.',
      ],
    },
    {
      heading: 'Cost and tuning',
      paragraphs: [
        'MMR usually runs over a small candidate pool, not the whole corpus. If there are n candidates and k final slots, a simple implementation compares remaining candidates against the selected set at each step. The dominant cost is often computing or reading pairwise similarities. In vector search systems, candidate embeddings are already available, so the redundancy term can use cosine similarity cheaply.',
        'Lambda controls the tradeoff. A lower lambda values diversity more and can drift away from the exact query. A higher lambda behaves closer to pure relevance and may leave duplicates. Qdrant documents MMR as a diversity method for vector search results: https://qdrant.tech/documentation/search/search-relevance/. LangChain vector retrievers expose MMR-style search as a retrieval mode: https://docs.langchain.com/oss/python/langchain/knowledge-base.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'MMR is not a factuality guarantee. It chooses diverse candidates under the similarity metric you provide. If the embeddings confuse two concepts, the diversity penalty can make poor choices. If the candidate pool lacks the right evidence, MMR cannot recover it. If the task requires exhaustive legal support, diversity should not replace source-specific retrieval and citation checks.',
        'Another mistake is using MMR after aggressive truncation. If the first-stage retriever returns only five near-duplicates, MMR has little room to diversify. Fetch more candidates than you plan to show, then diversify down to the context budget.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Carbonell and Goldstein MMR PDF at https://www.cs.cmu.edu/~jgc/publication/The_Use_MMR_Diversity_Based_LTMIR_1998.pdf, ACM DOI at https://dl.acm.org/doi/10.1145/290941.291025, ACL workshop entry at https://aclanthology.org/X98-1025/, Qdrant search relevance docs at https://qdrant.tech/documentation/search/search-relevance/, and LangChain retrieval docs at https://docs.langchain.com/oss/python/langchain/knowledge-base.',
        'Study Embeddings & Similarity, Reciprocal Rank Fusion, Multi-Index RAG, RAG Context Packing Token Budget, Cross-Encoder Reranker, ColBERT Late-Interaction Retrieval, and LLM Evaluation Harness & Golden Sets next.',
      ],
    },
  ],
};
