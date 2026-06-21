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
  const candidates = ['A', 'B', 'C', 'D'];
  const numCandidates = candidates.length;
  const slots = 3;
  const topSim = 0.92;
  const lambda = 0.5;

  yield {
    state: mmrGraph('MMR keeps relevance while reducing duplicates'),
    highlight: { active: ['a', 'b', 'e-a-mmr', 'e-b-mmr'], compare: ['b'], found: ['c', 'd', 'context', 'e-mmr-context'] },
    explanation: `The animation starts with the naive baseline: sort ${numCandidates} candidates by similarity and you often get repeated chunks. In a prompt budget of ${slots} slots, repeated evidence crowds out new facts.`,
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
    explanation: `The selected set is the memory of what you already bought with the context budget. The top candidate scores ${topSim} — every remaining candidate from the ${numCandidates} is judged against both the query and that selected evidence.`,
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
    explanation: `Read the formula as value minus repetition. With lambda ${lambda}, candidate B is close to the query but overlaps the chosen chunk; C wins with MMR ${0.62} because it adds a different piece of evidence.`,
    invariant: `MMR greedily maximizes relevance to the query while penalizing redundancy against the selected set — ${numCandidates - 1} remaining candidates compete for ${slots - 1} open slots.`,
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
    explanation: `The final set fills ${slots} slots with distinct evidence from ${numCandidates} candidates. MMR does not make the chunks true; it simply prevents one cluster of duplicates from occupying the whole context budget.`,
  };
}

function* ragContextCase() {
  const pipelineStages = ['first-stage search', 'MMR diversify', 'precision rerank', 'prompt context'];
  const numStages = pipelineStages.length;
  const lambdaValues = [0.3, 0.7, 0.95];
  const balancedLambda = lambdaValues[1];

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
    explanation: `MMR is usually a candidate-shaping step within a ${numStages}-stage retrieval pipeline. It can run before or after a reranker, depending on whether the system wants diversity in candidates, final context, or both.`,
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
    explanation: `The lambda parameter is a product decision across ${lambdaValues.length} common regimes. Exploratory search may want lambda ${lambdaValues[0]} for more diversity. Legal or support answers may need lambda ${lambdaValues[2]} for stricter relevance and a smaller diversity penalty.`,
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
    explanation: `For "why did payments fail repeatedly?", similarity-only retrieval may return copies of the same incident. At lambda ${balancedLambda}, MMR gives the answerer one postmortem, one alert timeline, and one deployment note — ${numStages} pipeline stages turning duplicates into coverage.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/maximal-marginal-relevance.gif', alt: 'Animated walkthrough of the maximal marginal relevance visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Search systems often return near-duplicates. A vector search for a refund-policy question may return five chunks from the same policy page. A news search may return ten syndicated copies of the same article. A RAG system may spend its whole prompt budget on one repeated fact and miss the adjacent fact that answers the user.',
        'Maximal Marginal Relevance exists to make selection diversity-aware. It chooses items that are relevant to the query and not redundant with items already selected. In retrieval, it reduces duplicate evidence. In summarization, it helps cover distinct points. In RAG, it protects scarce context budget.',
        'The algorithm is simple enough to be practical: start with a candidate pool, choose greedily, and penalize candidates that look too similar to the selected set. The power is not in complex math. It is in making the selected set part of the scoring process.',
        {type: 'callout', text: 'MMR prices each candidate by marginal value: relevant evidence loses value when it repeats what the selected set already contains.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is top-k similarity: sort candidates by relevance score and take the first k. That is efficient and usually sensible for a first-stage retriever. It fails when the top of the ranking is crowded by copies, chunk overlaps, mirrored documents, or many passages that all explain the same subtopic.',
        'Another obvious approach is random diversification. That can reduce duplicates, but it may throw away the best evidence. MMR keeps relevance in the formula while adding a redundancy penalty. It is not diversity for its own sake; it is diversity under a query.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is budget. A search page has limited visible slots. A prompt has limited tokens. A summary has limited sentences. Once you select a duplicate, you spend a slot that could have carried a distinct fact.',
        'The second wall is that similarity scores are local. Candidate B may be almost as relevant as candidate A, but if B says the same thing as A, selecting both gives little marginal value. The value of an item depends on what has already been selected.',
        'The third wall is metric quality. MMR can only penalize redundancy that the similarity function can see. If embeddings confuse topics or fail to detect duplicates, the algorithm inherits that weakness.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Score each remaining candidate by relevance minus redundancy. Relevance measures similarity to the query. Redundancy measures the maximum similarity to any item already selected. The selected set becomes the memory of what the context budget has already bought.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A retrieval candidate pool is a graph of relationships: query edges measure relevance, and candidate-candidate edges expose redundancy. Source: Wikimedia Commons, David W., public domain.'},
        'A common formula is lambda * Sim(candidate, query) - (1 - lambda) * max Sim(candidate, selected_item). Lambda controls the relevance-diversity tradeoff. High lambda behaves close to pure relevance. Low lambda pushes harder for novelty.',
        'The algorithm is greedy. Pick the best remaining candidate under this score, add it to the selected set, and repeat until the budget is full. Greedy selection is not globally perfect, but it is simple, fast, and usually good enough over a moderate candidate pool.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The greedy-selection view starts with the naive failure: top similarity can return repeated chunks. The first selected item is mostly about relevance. After that, every remaining candidate is judged against both the query and the selected set.',
        'The score table shows why a slightly less relevant chunk can win. Candidate B may be close to the query, but if it is almost identical to A, its marginal value is low. Candidate C may be a little less relevant but add a new policy, timeline, or exception.',
        'The RAG context case shows the product consequence. A context window packed with duplicates makes the final answer brittle. A diversified context gives the model broader evidence without increasing token budget.',
      ],
    },
    {
      heading: 'How the algorithm works',
      paragraphs: [
        'Start with candidates from a first-stage retriever. This pool should be larger than the final number of items. If you want five chunks in the prompt, you might retrieve 30 or 100 candidates first. MMR needs choices to diversify among.',
        'Select the highest-relevance item first, or initialize the selected set another way if your system has a stronger rule. Then for each unselected candidate, compute query similarity and redundancy against the selected set. The redundancy term is usually the maximum similarity to any selected item, because one near-duplicate is enough to make the candidate less useful.',
        'Pick the candidate with the highest MMR score, add it to selected, and repeat. Stop when slots or token budget are exhausted. In a RAG system, a later stage may still reorder, compress, cite, or rerank the selected items before final prompt construction.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the query asks, "What recurring causes appear in payment incidents?" Pure similarity returns five chunks from the same postmortem because each chunk mentions payment failure, retry storms, and customer impact. The scores look good, but the set is narrow.',
        'MMR keeps the best postmortem chunk, then penalizes near-duplicates from the same incident. It can admit an alert timeline, a deployment note, and a billing-service ownership record. The final set covers cause, timing, deployment, and ownership instead of repeating the same postmortem.',
        'This does not make any chunk true. It only improves coverage under a budget. The answer generator still needs citation discipline, contradiction handling, and enough retrieval recall to include the right evidence in the candidate pool.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'MMR works because the marginal value of information decreases when it repeats what you already have. The first refund-policy chunk may be valuable. The fifth near-identical refund-policy chunk is usually not. The redundancy penalty encodes that diminishing return.',
        'It also works because many retrieval failures are cluster failures. Embedding search often returns a tight neighborhood around one phrasing or document. MMR forces the selection process to look beyond that first cluster while still requiring query relevance.',
        'The method is intentionally local and greedy. That makes it easy to add to existing search stacks without retraining the retriever. It can sit between first-stage retrieval and final prompt packing, or between retrieval and a cross-encoder reranker.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'For n candidates and k selected items, a simple implementation scores remaining candidates at each selection step. The expensive part is candidate-to-selected similarity. With embeddings already loaded, cosine similarity is cheap. With cross-encoder similarity, the cost can become too high unless cached or approximated.',
        'The algorithm should run over a candidate pool, not the whole corpus. First-stage search gets recall. MMR shapes the candidate set into a diverse final subset. Fetching too few candidates before MMR is a common mistake because duplicates leave the algorithm no room to maneuver.',
        'Lambda is a product setting. Exploratory research may benefit from lower lambda and more diversity. Customer support or legal QA may need higher lambda because irrelevant diversity is dangerous. The right value depends on the cost of missing a distinct source versus the cost of including a weak one.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'MMR wins in RAG context packing, search result diversification, summarization passage selection, document clustering previews, recommendation shelves, and exploratory research tools. It is useful whenever the selected set has a fixed budget and redundancy is costly.',
        'It is especially useful with chunked corpora. Adjacent chunks from the same document often overlap semantically. MMR can keep the strongest chunk and make room for evidence from other documents or sections.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MMR fails when the candidate pool lacks the right evidence. It cannot diversify into facts that were never retrieved. Improve recall before expecting MMR to fix context quality.',
        'It also fails when the similarity metric is wrong. If embeddings think two contradictory chunks are duplicates, or fail to recognize true duplicates, the redundancy term misfires. Domain-specific embeddings, metadata constraints, or rerankers may be needed.',
        'Finally, too much diversity can hurt. A low lambda can select tangential chunks that broaden the set but weaken the answer. Diversity is useful only when it serves the query.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'MMR is value minus repetition. The selected set is part of the score.',
        'Use it after retrieving enough candidates and before spending final slots or prompt tokens. Tune lambda according to the product risk, not as a universal constant.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Carbonell and Goldstein MMR PDF at https://www.cs.cmu.edu/~jgc/publication/The_Use_MMR_Diversity_Based_LTMIR_1998.pdf, ACM DOI at https://dl.acm.org/doi/10.1145/290941.291025, ACL workshop entry at https://aclanthology.org/X98-1025/, Qdrant search relevance docs at https://qdrant.tech/documentation/search/search-relevance/, and LangChain retrieval docs at https://docs.langchain.com/oss/python/langchain/knowledge-base.',
        'Study Embeddings & Similarity, Reciprocal Rank Fusion, Multi-Index RAG, RAG Context Packing Token Budget, Cross-Encoder Reranker, ColBERT Late-Interaction Retrieval, GraphRAG Community Summary Case Study, and LLM Evaluation Golden Sets next.',
      ],
    },
  ],
};
