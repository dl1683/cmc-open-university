// Query expansion for RAG: rewrite the query, generate hypothetical documents,
// retrieve from several views, then fuse ranks before reranking.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'query-expansion-hyde-rag-fusion',
  title: 'Query Expansion: HyDE and RAG-Fusion',
  category: 'AI & ML',
  summary: 'How HyDE, multi-query rewriting, and RAG-Fusion widen retrieval recall before rank fusion and reranking narrow the evidence again.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['HyDE pivot', 'fusion tradeoffs'], defaultValue: 'HyDE pivot' },
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

function expansionGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.7, y: 3.5, note: 'user intent' },
      { id: 'rewrite', label: 'rewrite', x: 2.4, y: 5.1, note: 'variants' },
      { id: 'hyde', label: 'HyDE doc', x: 2.4, y: 1.9, note: 'pseudo text' },
      { id: 'bm25', label: 'BM25', x: 4.1, y: 5.1, note: 'terms' },
      { id: 'vector', label: 'vector', x: 4.1, y: 1.9, note: 'meaning' },
      { id: 'rrf', label: 'RRF', x: 5.8, y: 3.5, note: 'fuse ranks' },
      { id: 'rerank', label: 'rerank', x: 7.4, y: 3.5, note: 'precision' },
      { id: 'context', label: 'context', x: 9.0, y: 3.5, note: 'evidence' },
    ],
    edges: [
      { id: 'e-query-rewrite', from: 'query', to: 'rewrite' },
      { id: 'e-query-hyde', from: 'query', to: 'hyde' },
      { id: 'e-rewrite-bm25', from: 'rewrite', to: 'bm25' },
      { id: 'e-rewrite-vector', from: 'rewrite', to: 'vector' },
      { id: 'e-hyde-vector', from: 'hyde', to: 'vector' },
      { id: 'e-bm25-rrf', from: 'bm25', to: 'rrf' },
      { id: 'e-vector-rrf', from: 'vector', to: 'rrf' },
      { id: 'e-rrf-rerank', from: 'rrf', to: 'rerank' },
      { id: 'e-rerank-context', from: 'rerank', to: 'context' },
    ],
  }, { title });
}

function* hydePivot() {
  const expansionTypes = 4;    // rows in the expansion-type matrix
  const pipelineStages = 8;    // nodes in the expansion graph
  const edgeCount = 9;         // edges connecting the pipeline stages

  yield {
    state: expansionGraph('Query expansion rewrites the problem before search'),
    highlight: { active: ['query', 'rewrite', 'hyde', 'e-query-rewrite', 'e-query-hyde'], compare: ['bm25', 'vector'] },
    explanation: `Read the split as several guesses about the same intent across ${pipelineStages} pipeline stages. The raw query is preserved, rewrites expose alternate wording, and HyDE creates answer-shaped text only to steer dense retrieval through ${edgeCount} directed edges.`,
  };

  yield {
    state: labelMatrix(
      'Expansion types',
      [
        { id: 'raw', label: 'raw query' },
        { id: 'multi', label: 'multi-query' },
        { id: 'hyde', label: 'HyDE' },
        { id: 'fusion', label: 'RAG-Fusion' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['search as written', 'vocabulary mismatch'],
        ['paraphrase intent', 'query drift'],
        ['generate pseudo-doc', 'false details'],
        ['fuse result lists', 'latency and noise'],
      ],
    ),
    highlight: { active: ['multi:move', 'hyde:move', 'fusion:move'], compare: ['hyde:risk', 'fusion:risk'] },
    explanation: `The HyDE row is a routing artifact, not a source. Across all ${expansionTypes} expansion types, its job is to land the embedding near real corpus documents that the short user query might not reach by itself.`,
    invariant: `Expanded queries are retrieval hints, not facts — all ${expansionTypes} types serve recall, not truth.`,
  };

  yield {
    state: expansionGraph('HyDE pivots through a hypothetical document embedding'),
    highlight: { active: ['hyde', 'vector', 'e-hyde-vector'], found: ['context'], compare: ['query'] },
    explanation: `The dense encoder acts as a bottleneck filtering false details across ${pipelineStages} stages. The generated pseudo-document should land near real corpus documents, but this only works when the corpus actually contains matching evidence and the encoder is robust.`,
  };

  yield {
    state: labelMatrix(
      'Case: enterprise policy query',
      [
        { id: 'ask', label: 'user asks' },
        { id: 'rewrite', label: 'rewrite' },
        { id: 'hyde', label: 'HyDE doc' },
        { id: 'evidence', label: 'retrieved evidence' },
      ],
      [
        { id: 'content', label: 'content' },
        { id: 'role', label: 'role' },
      ],
      [
        ['can I cancel after renewal?', 'ambiguous intent'],
        ['annual renewal refund window', 'terms and synonyms'],
        ['policy paragraph about renewal cancellation', 'semantic bridge'],
        ['current policy section', 'only actual source'],
      ],
    ),
    highlight: { active: ['rewrite:role', 'hyde:role'], found: ['evidence:content'], removed: ['hyde:content'] },
    explanation: `The assistant should never cite the HyDE document. Among the ${expansionTypes} expansion rows, only the retrieved evidence row is a citable source — the HyDE document merely steered the vector search into the right neighborhood.`,
  };
}

function* fusionTradeoffs() {
  const queryViews = 4;   // number of candidate list rows
  const ranksPerView = 3; // columns in the candidate matrix
  const maxViews = 8;     // max x-axis value in the tradeoff plot
  const rrfK = 60;        // standard RRF constant
  const evalSlices = 4;   // evaluation categories

  yield {
    state: labelMatrix(
      'RAG-Fusion candidate lists',
      [
        { id: 'q1', label: 'rewrite 1' },
        { id: 'q2', label: 'rewrite 2' },
        { id: 'q3', label: 'HyDE' },
        { id: 'q4', label: 'raw query' },
      ],
      [
        { id: 'rank1', label: 'rank 1' },
        { id: 'rank2', label: 'rank 2' },
        { id: 'rank3', label: 'rank 3' },
      ],
      [
        ['policy A', 'refund FAQ', 'billing guide'],
        ['refund FAQ', 'policy A', 'plan terms'],
        ['policy A', 'annual terms', 'billing guide'],
        ['billing guide', 'support article', 'policy A'],
      ],
    ),
    highlight: { found: ['q1:rank1', 'q2:rank2', 'q3:rank1', 'q4:rank3'], compare: ['q4:rank2'] },
    explanation: `RAG-Fusion runs ${queryViews} query views, retrieves the top ${ranksPerView} per view, then applies Reciprocal Rank Fusion (k=${rrfK}) to aggregate ranks. Documents that repeatedly appear near the top become strong candidates for reranking.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'number of query views', min: 1, max: 8 }, y: { label: 'relative value', min: 0, max: 1 } },
      series: [
        { id: 'recall', label: 'candidate recall', points: [{ x: 1, y: 0.45 }, { x: 2, y: 0.62 }, { x: 3, y: 0.73 }, { x: 5, y: 0.80 }, { x: 8, y: 0.84 }] },
        { id: 'noise', label: 'noise and latency', points: [{ x: 1, y: 0.15 }, { x: 2, y: 0.24 }, { x: 3, y: 0.36 }, { x: 5, y: 0.58 }, { x: 8, y: 0.86 }] },
      ],
    }),
    highlight: { active: ['recall'], compare: ['noise'] },
    explanation: `The curve is the tradeoff to watch in production: early query views often add recall, but beyond ${maxViews} views the noise and latency curve overtakes the recall curve — later views add mostly cost, duplicate candidates, and reranker pressure.`,
  };

  yield {
    state: expansionGraph('Fusion must still hand a small set to the expensive layer'),
    highlight: { active: ['rrf', 'rerank', 'context', 'e-rrf-rerank', 'e-rerank-context'], compare: ['rewrite', 'hyde'] },
    explanation: `The precision layer still matters. RRF (k=${rrfK}) can put good candidates into the pool from ${queryViews} views, but the cross-encoder, ColBERT reranker, or LLM reranker decides what fits the final context budget.`,
  };

  yield {
    state: labelMatrix(
      'Evaluation slices',
      [
        { id: 'exact', label: 'exact terms' },
        { id: 'paraphrase', label: 'paraphrase' },
        { id: 'underspecified', label: 'underspecified' },
        { id: 'fresh', label: 'fresh policy' },
      ],
      [
        { id: 'watch', label: 'watch' },
        { id: 'failure', label: 'failure mode' },
      ],
      [
        ['BM25 preserved?', 'rewrites drop IDs'],
        ['semantic recall?', 'single query misses'],
        ['clarifying need?', 'HyDE invents intent'],
        ['current chunk?', 'old source wins'],
      ],
    ),
    highlight: { active: ['exact:watch', 'paraphrase:watch', 'fresh:watch'], removed: ['underspecified:failure'] },
    explanation: `Evaluate query expansion across ${evalSlices} slices. It should help paraphrases without damaging exact identifiers, current-policy retrieval, authorization filters, or user questions that should ask for clarification instead of searching.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'HyDE pivot') yield* hydePivot();
  else if (view === 'fusion tradeoffs') yield* fusionTradeoffs();
  else throw new InputError('Pick a query-expansion view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The HyDE pivot view shows the full expansion pipeline as a directed graph. Active nodes mark the current processing stage. The split from the query node into rewrite and HyDE doc branches shows two independent strategies running in parallel: lexical rewriting for BM25 and hypothetical document generation for dense retrieval. Found markers on the context node mean evidence has reached the generator.',
        {type: 'callout', text: 'Query expansion is a recall move: widen candidate evidence first, then make precision earn its place through fusion and reranking.'},
        'The fusion tradeoffs view shows ranked candidate lists from multiple query views, then a plot of recall versus noise as the number of views increases. The crossing point of those two curves is the practical limit: beyond it, adding more views costs more than it helps.',
        'In the matrix steps, active cells mark the strategic move each expansion type makes. Compare cells mark the corresponding risk. The pairing is deliberate: every recall gain has a failure mode. Read horizontally to evaluate one method, vertically to compare methods on the same axis.',
      
        {type: 'image', src: './assets/gifs/query-expansion-hyde-rag-fusion.gif', alt: 'Animated walkthrough of the query expansion hyde rag fusion visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Retrieval-augmented generation, or RAG, answers with evidence retrieved from a corpus. If retrieval misses the right document, the generator can still produce a fluent answer from the wrong evidence.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/The-Transformer-model-architecture.png/250px-The-Transformer-model-architecture.png', alt: 'Transformer architecture diagram with attention and feed-forward blocks', caption: 'RAG answers are generated by sequence models, but retrieval quality decides which evidence those models can use. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:The-Transformer-model-architecture.png.'},
        'Query expansion exists because users and corpora use different words. A user may ask "can I cancel after renewal" while the policy says "automatic renewal refund window."',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is single-shot retrieval. Embed the user query, search the vector index, maybe mix in BM25, and pass the top chunks to the generator.',
        'This works when the query contains exact identifiers or the user knows the corpus language. It is also fast because it needs one embedding call and one retrieval pass.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is invisible recall failure. The right document exists, the retriever returns something, and the generator answers, but the correct evidence never entered the candidate pool.',
        'Reranking cannot rescue a missing document. The only way to recover is to search from better query views before the precision layer runs.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to turn one short query into several retrieval probes. Each probe uses different words or a different shape of text, so the union covers more of the corpus neighborhood.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes and arrows', caption: 'The expansion pipeline is a directed retrieval graph: query views branch out, rank lists merge, and reranking narrows the evidence. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'HyDE generates a hypothetical answer document and embeds it only as a search pivot. RAG-Fusion retrieves from several query views and combines their ranked lists before reranking.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Multi-query rewriting asks a model for paraphrases that preserve the original intent. Each rewrite runs retrieval independently, often across BM25 and dense vector search.',
        'HyDE asks the model to draft an answer-shaped passage. The generated passage is not cited; its embedding is used to land near real documents that look like answers.',
        'Reciprocal Rank Fusion, or RRF, gives a document 1 / (k + rank) points for each ranked list where it appears. With k = 60, repeated high placement beats a single lucky top result.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Expansion works by improving candidate coverage. A fragmentary query creates a thin vector, while paraphrases and answer-shaped text create alternate probes into the same intent.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/54/Euclidean_Voronoi_diagram.svg', alt: 'Colored Voronoi cells around nearest seed points', caption: 'Dense retrieval is neighborhood search in vector space; expansion tries to move the probe into the right neighborhood before ranking. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Euclidean_Voronoi_diagram.svg.'},
        'The correctness argument is pipeline-local. Expansion is allowed to be noisy only because real corpus documents, fusion, and reranking stand between the generated hints and the final answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is extra query views. If one raw query retrieves 20 chunks, five views can create up to 100 candidates before deduplication.',
        'LLM expansion adds latency, usually before retrieval can start. Parallel retrieval helps, but reranking still scales with the fused candidate pool.',
        'The behavior has diminishing returns. Moving from one to three views often improves recall, while moving from five to eight often adds duplicate chunks, noise, and reranker pressure.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Expansion helps enterprise policy search, legal and biomedical literature, educational retrieval, incident runbooks, and support knowledge bases. These corpora often use specialist terms that users do not know.',
        'It is strongest when exact identifiers are protected and a reranker checks the wider pool. The expansion layer widens recall; the reranker earns precision.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Query drift is the main failure. A rewrite can shift "refund after renewal" into generic cancellation, and HyDE can invent details that steer retrieval toward the wrong neighborhood.',
        'Expansion also harms exact-match searches. Error codes, ticket ids, function names, and statute numbers should usually be preserved or searched raw.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A user asks, "can I cancel after renewal?" The raw vector search returns a billing guide at rank 1 and a support article at rank 2, but misses the policy section.',
        'A rewrite searches "annual renewal refund window" and returns the policy section at rank 1. A HyDE passage about cancellation after automatic renewal returns the same policy at rank 2.',
        'With RRF and k = 60, the policy gets 1/61 + 1/62 = 0.0325 from those two lists. A document that appears only once at rank 1 gets 1/61 = 0.0164, so repeated evidence wins.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Gao et al. on HyDE, Rackauckas on RAG-Fusion, Rocchio on pseudo-relevance feedback, and Cormack et al. on Reciprocal Rank Fusion. Then study embeddings and similarity, BM25, cross-encoder reranking, SPLADE, Self-RAG, prompt-injection threat models, and RAG evaluation slices.',
      ],
    },
  ],
};
