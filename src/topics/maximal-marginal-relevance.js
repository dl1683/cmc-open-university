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
    { heading: 'How to read the animation', paragraphs: [
        'The greedy view starts with a query and candidate passages. Found candidates are already selected, so later candidates are scored against both the query and that selected set. Relevance is similarity to the query, and redundancy is similarity to something already chosen.',
        {type: 'image', src: './assets/gifs/maximal-marginal-relevance.gif', alt: 'Animated walkthrough of the maximal marginal relevance visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ], },
    { heading: 'Why this exists', paragraphs: [
        'Retrieval systems often return near-duplicates. A RAG prompt can spend most of its token budget on repeated chunks from one policy page while missing the exception that answers the user. MMR exists to select relevant evidence that adds new value to the set.',
        {type: 'callout', text: 'MMR prices each candidate by marginal value: relevant evidence loses value when it repeats what the selected set already contains.'},
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is top-k similarity: sort candidates by relevance and take the first k. That is fast and often good for first-stage retrieval. It fails when the top rank is crowded by copied documents, adjacent chunks, or repeated wording.',
      ], },
    { heading: 'The wall', paragraphs: [
        'The wall is budget. Search pages have limited rows, and prompts have limited tokens. A duplicate consumes a slot that could have carried a distinct fact, so candidate value depends on what has already been selected.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Score each remaining candidate as relevance minus redundancy. A common formula is lambda * Sim(candidate, query) - (1 - lambda) * max Sim(candidate, selected_item). The selected set becomes memory for what the result list has already bought.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A retrieval candidate pool is a graph of relationships: query edges measure relevance, and candidate-candidate edges expose redundancy. Source: Wikimedia Commons, David W., public domain.'},
      ], },
    { heading: 'How it works', paragraphs: [
        'Retrieve more candidates than the final budget, then choose the strongest first item. For each remaining candidate, compute query similarity and the maximum similarity to any selected item. Add the highest MMR score and repeat until slots or tokens are exhausted.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'Information has diminishing returns when it repeats. The first refund-policy passage may be valuable, while the fifth near-identical passage is usually not. MMR encodes that marginal value directly while still requiring query relevance.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'For n candidates, k selected items, and embedding dimension d, a simple implementation is O(n*k*d) after first-stage retrieval. Lambda changes behavior: high lambda keeps relevance and may leave duplicates, while low lambda diversifies and may drift. The method should run on a candidate pool, not the whole corpus.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'MMR is used for search diversification, RAG context packing, summarization sentence selection, recommendation shelves, and exploratory research tools. It is strongest when chunk overlap or mirrored sources make pure similarity over-sample one cluster.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'MMR cannot select evidence that first-stage retrieval never found. It also inherits the similarity metric: bad embeddings miss duplicates or remove useful distinct evidence. Too much diversity can include tangential chunks that weaken the answer.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Let lambda be 0.5 and A already selected. B has relevance 0.90 and similarity 0.94 to A, so its score is 0.5*0.90 - 0.5*0.94 = -0.02. C has relevance 0.84 and similarity 0.40 to A, so its score is 0.22 and it wins because it adds different evidence.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Start with Carbonell and Goldstein, The Use of MMR, Diversity-Based Reranking for Reordering Documents and Producing Summaries, 1998. Study embeddings, reciprocal rank fusion, cross-encoder rerankers, ColBERT, RAG context packing, and retrieval evaluation next.',
      ], },
  ],
};
