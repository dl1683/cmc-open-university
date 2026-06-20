// RAPTOR hierarchical retrieval: recursively embed, cluster, and summarize
// chunks into a tree so RAG can retrieve across levels of abstraction.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'raptor-hierarchical-retrieval-case-study',
  title: 'RAPTOR Hierarchical Retrieval Case Study',
  category: 'Papers',
  summary: 'Recursive abstractive processing for tree-organized retrieval: cluster chunks, summarize clusters, build a tree, and retrieve across abstraction levels.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['build summary tree', 'retrieve across levels'], defaultValue: 'build summary tree' },
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

function treeGraph(title) {
  return graphState({
    nodes: [
      { id: 'c1', label: 'A', x: 0.7, y: 5.15, note: 'chunk' },
      { id: 'c2', label: 'B', x: 2.25, y: 5.15, note: 'chunk' },
      { id: 'c3', label: 'C', x: 4.0, y: 5.15, note: 'chunk' },
      { id: 'c4', label: 'D', x: 5.55, y: 5.15, note: 'chunk' },
      { id: 's1', label: 'AB', x: 1.5, y: 3.65, note: 'summary' },
      { id: 's2', label: 'CD', x: 4.75, y: 3.65, note: 'summary' },
      { id: 'root', label: 'root', x: 3.1, y: 3.0, note: 'global' },
      { id: 'query', label: 'query', x: 7.2, y: 3.55, note: 'ask' },
      { id: 'context', label: 'context', x: 9.0, y: 3.55, note: 'mixed' },
    ],
    edges: [
      { id: 'e-c1-s1', from: 'c1', to: 's1' },
      { id: 'e-c2-s1', from: 'c2', to: 's1' },
      { id: 'e-c3-s2', from: 'c3', to: 's2' },
      { id: 'e-c4-s2', from: 'c4', to: 's2' },
      { id: 'e-s1-root', from: 's1', to: 'root' },
      { id: 'e-s2-root', from: 's2', to: 'root' },
      { id: 'e-query-context', from: 'query', to: 'context' },
      { id: 'e-root-context', from: 'root', to: 'context' },
      { id: 'e-s2-context', from: 's2', to: 'context' },
      { id: 'e-c4-context', from: 'c4', to: 'context' },
    ],
  }, { title });
}

function* buildSummaryTree() {
  yield {
    state: treeGraph('RAPTOR builds a tree above ordinary chunks'),
    highlight: { active: ['c1', 'c2', 'c3', 'c4'], compare: ['s1', 's2', 'root'] },
    explanation: 'Read the tree as an answer to flat chunk blindness. Leaves keep exact text; parents store generated summaries that can be retrieved when the question needs broader document context.',
  };

  yield {
    state: labelMatrix(
      'Recursive build recipe',
      [
        { id: 'embed', label: 'embed chunks' },
        { id: 'cluster', label: 'cluster' },
        { id: 'summarize', label: 'summarize' },
        { id: 'repeat', label: 'repeat' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'data structure', label: 'data structure' },
      ],
      [
        ['vectorize leaves', 'embedding matrix'],
        ['group nearby leaves', 'cluster forest'],
        ['write parent nodes', 'summary tree'],
        ['until root', 'hierarchy'],
      ],
    ),
    highlight: { active: ['embed:data structure', 'cluster:data structure', 'summarize:data structure', 'repeat:data structure'] },
    explanation: 'The algorithm is simple but powerful: embed chunks, cluster similar chunks, summarize each cluster, then treat summaries as new nodes and repeat. The result is a tree of detail-to-summary levels.',
    invariant: 'Generated summaries become index entries, so summary quality is part of retrieval quality.',
  };

  yield {
    state: treeGraph('Cluster summaries become parent retrieval nodes'),
    highlight: { active: ['s1', 's2', 'root', 'e-c1-s1', 'e-c2-s1', 'e-c3-s2', 'e-c4-s2', 'e-s1-root', 'e-s2-root'], compare: ['c1', 'c4'] },
    explanation: 'The parent node is a real index entry, not just a folder. It has summary text, an embedding, and child links, so it can be retrieved directly for broad questions.',
  };

  yield {
    state: labelMatrix(
      'Build-time tradeoffs',
      [
        { id: 'cluster size', label: 'cluster size' },
        { id: 'summary prompt', label: 'summary prompt' },
        { id: 'depth', label: 'tree depth' },
        { id: 'updates', label: 'updates' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['coherent parents', 'mixed topics'],
        ['abstraction quality', 'lost facts'],
        ['global context', 'summary drift'],
        ['fresh corpus', 'rebuild cost'],
      ],
    ),
    highlight: { active: ['cluster size:helps', 'summary prompt:helps', 'depth:helps'], removed: ['summary prompt:risk', 'updates:risk'] },
    explanation: 'RAPTOR moves work to ingestion. That helps query time, but it creates new failure modes: summary drift, stale parents, bad clusters, and expensive rebuilds after corpus updates.',
  };
}

function* retrieveAcrossLevels() {
  yield {
    state: treeGraph('Queries can retrieve leaves and summaries together'),
    highlight: { active: ['query', 'root', 's2', 'c4', 'context', 'e-query-context', 'e-root-context', 'e-s2-context', 'e-c4-context'], compare: ['c1', 'c2'] },
    explanation: 'At query time, RAPTOR can retrieve from multiple tree levels. A final context may include a global summary, a cluster summary, and a specific leaf chunk instead of only adjacent raw chunks.',
  };

  yield {
    state: labelMatrix(
      'Question shape to retrieval level',
      [
        { id: 'fact', label: 'specific fact' },
        { id: 'theme', label: 'document theme' },
        { id: 'compare', label: 'compare sections' },
        { id: 'multi', label: 'multi-hop reason' },
      ],
      [
        { id: 'best level', label: 'best level' },
        { id: 'failure if flat' },
      ],
      [
        ['leaf chunk', 'ok'],
        ['root or parent', 'misses whole picture'],
        ['parents plus leaves', 'fragmented answer'],
        ['path through tree', 'scattered evidence'],
      ],
    ),
    highlight: { active: ['theme:best level', 'compare:best level', 'multi:best level'], compare: ['fact:best level'] },
    explanation: 'Flat chunk retrieval is good for narrow facts. Hierarchical retrieval helps when the question asks about themes, comparisons, or reasoning that spans several chunks.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'abstraction level', min: 0, max: 3 }, y: { label: 'usefulness', min: 0, max: 1.0 } },
      series: [
        { id: 'fact', label: 'fact query', points: [{ x: 0, y: 0.92 }, { x: 1, y: 0.72 }, { x: 2, y: 0.42 }, { x: 3, y: 0.25 }] },
        { id: 'theme', label: 'theme query', points: [{ x: 0, y: 0.31 }, { x: 1, y: 0.64 }, { x: 2, y: 0.85 }, { x: 3, y: 0.78 }] },
      ],
    }),
    highlight: { active: ['theme'], compare: ['fact'] },
    explanation: 'The level table is the routing decision. Broad synthesis wants summaries, exact audit wants leaves, and many useful answers need both in the same final context.',
  };

  yield {
    state: labelMatrix(
      'RAPTOR versus related RAG architectures',
      [
        { id: 'flat', label: 'flat RAG' },
        { id: 'raptor', label: 'RAPTOR' },
        { id: 'graphrag', label: 'GraphRAG' },
        { id: 'selfrag', label: 'Self-RAG' },
      ],
      [
        { id: 'structure', label: 'structure' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['chunks only', 'limited context'],
        ['summary tree', 'summary drift'],
        ['entity graph', 'extraction errors'],
        ['retrieve and critique tokens', 'training complexity'],
      ],
    ),
    highlight: { active: ['raptor:structure', 'graphrag:structure', 'selfrag:structure'], compare: ['flat:watch'] },
    explanation: 'RAPTOR is not the only way to escape flat chunks. GraphRAG builds entity/community structure. Self-RAG learns when to retrieve and critique. LightRAG adds graph/vector dual-level retrieval. The shared lesson is that structure matters.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'build summary tree') yield* buildSummaryTree();
  else if (view === 'retrieve across levels') yield* retrieveAcrossLevels();
  else throw new InputError('Pick a RAPTOR retrieval view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'RAPTOR, short for Recursive Abstractive Processing for Tree-Organized Retrieval, is a RAG architecture that builds a tree of summaries above ordinary text chunks. Instead of retrieving only short contiguous chunks, it recursively embeds, clusters, and summarizes chunks so the index contains both detailed leaves and higher-level abstractions.',
        'The core paper states the motivation directly: flat RAG often misses holistic document context because it retrieves short chunks. RAPTOR builds a tree with different levels of summarization and retrieves from that tree at inference time: https://arxiv.org/abs/2401.18059. The official implementation is at https://github.com/parthsarthi03/raptor.',
        {type:'callout', text:'RAPTOR makes summaries searchable evidence objects, so retrieval can choose between broad parent context and leaf level proof instead of flattening every question into top-k chunks.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg', alt:'Binary tree diagram with parent and child nodes.', caption:'Binary tree diagram. RAPTOR uses a tree of summaries and leaf chunks so retrieval can move between abstraction levels. Source: Wikimedia Commons, Derrick Coetzee, Public domain.'},
      ],
    },
    {
      heading: 'The obvious attempt',
      paragraphs: [
        'The obvious RAG design is flat chunk retrieval. Split the corpus into fixed-size chunks, embed every chunk, retrieve the top k chunks for a query, and place them in the prompt. This works well for direct lookup questions where the answer lives in one or two nearby passages.',
        'It breaks on questions that ask for a document-level pattern, a comparison across sections, or an answer that depends on dispersed evidence. Increasing top k often adds noise before it adds structure. Making chunks larger can preserve more context but hurts precision and wastes prompt budget. RAPTOR adds an explicit abstraction layer instead of asking the generator to infer the whole document shape from scattered leaf chunks.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to index summaries as first-class retrieval objects. A parent summary is not just a folder label. It has text, an embedding, child links, and source provenance. It can be retrieved when the query wants a broader concept, then followed downward to the leaves that justify the answer.',
        'This changes the retrieval problem from one flat nearest-neighbor search into a level-selection problem. Exact facts still want leaf text. Themes and comparisons often want parent summaries. Careful answers often need both: a summary for orientation and leaves for citation-grade proof.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The build phase starts with a corpus split into chunks. Each chunk is embedded. Nearby chunks are clustered, often with a clustering method such as Gaussian mixture modeling or a simpler K-Means-style mental model. Each cluster is summarized by an LLM. Those summaries become parent nodes, are embedded again, clustered again, and summarized again until the tree reaches a root or target depth.',
        'The query phase searches across the tree. A narrow question may retrieve leaf chunks. A broad question may retrieve parent summaries. A multi-step question may need both: a high-level parent for orientation and specific leaves for evidence. This turns retrieval into a tree-level selection problem rather than a flat top-k list.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The build view moves upward from chunks to summaries. Each parent is generated from a cluster of children, then embedded so it can be searched. That means summary quality, cluster quality, and source links are part of the retrieval index, not post-processing details. A bad summary becomes a bad index entry.',
        'The retrieval view moves across levels. A broad question can start at a parent summary, then pull leaves for proof. A narrow question should not stop at a summary when exact source text is needed. The useful mental model is multi-level evidence, not "summaries replace chunks." The tree creates additional handles for retrieval; it does not remove the need for source-grounded leaves.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'RAPTOR works when generated summaries preserve the concepts that flat embeddings scatter across chunks. Many documents have hierarchy already: sections, subsections, arguments, examples, exceptions, and tables. A summary tree gives the retriever objects closer to those natural levels.',
        'The approach also spends compute before the user asks a question. Instead of using the final answer model to read ten disconnected chunks and guess the theme, ingestion has already clustered related material and written an abstraction. That can improve broad queries, but only if the summaries remain faithful and traceable to children.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'RAPTOR moves meaningful cost to ingestion. Embedding, clustering, summarization, parent embedding, and repeated tree construction can be expensive. Updates are also harder than flat indexing because changing a leaf can invalidate parent summaries. The benefit is that query-time retrieval can access precomputed abstractions instead of asking the generator to synthesize a whole-document view from scattered fragments.',
        'The risk is summary drift. A parent summary can omit a detail, overgeneralize, or mix unrelated cluster members. Those errors become searchable index entries. RAG Evaluation: RAGAS, ARES, and the RAG Triad is therefore not optional: evaluate leaf recall, parent usefulness, final faithfulness, and answer relevance separately.',
        'Incremental maintenance is the practical cost most demos skip. If a policy document changes, the leaf chunk changes first, then its embedding, then any cluster membership, then parent summaries, then parent embeddings. A production index should record lineage from every parent to its children so rebuilds can be targeted and stale summaries can be detected. Otherwise the hierarchy becomes an attractive but untrustworthy snapshot.',
      ],
    },
    {
      heading: 'Complete case study: policy manual QA',
      paragraphs: [
        'Imagine a 400-page benefits policy manual. Flat RAG can answer "What is the copay for Plan B?" if the exact table chunk is retrieved. It struggles with "How did the plan handle exceptions across dental and vision coverage?" because the answer spans many sections. RAPTOR can retrieve a parent summary about coverage exceptions, a child summary about dental exclusions, and a leaf table for the exact copay.',
        'A production design would combine RAPTOR with Multi-Index RAG. BM25 catches exact policy IDs. HNSW finds semantically related chunks and summaries. Maximal Marginal Relevance prevents the prompt from filling with near-duplicate parents. Cross-Encoder Reranker can rerank the final candidates. Cache Invalidation & Versioning tracks whether parent summaries were built from the current policy version.',
        'The final answer should still cite leaves. Parent summaries can guide retrieval and explain context, but a user who needs to act on the answer needs source text. The strongest pattern is parent for map, leaf for proof: retrieve the summary that frames the issue, then include exact passages that support the claim.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat the generated summary tree as ground truth. It is an index built by a model. Every parent node should be traceable to children and source documents. Do not use only high-level summaries for audit questions where exact source text matters. Do not assume the tree is easy to update; if a corpus changes frequently, incremental rebuild strategy matters.',
        'Do not confuse RAPTOR with GraphRAG or LightRAG. RAPTOR organizes chunks and summaries into a tree. GraphRAG extracts entities and relationships into a graph and summarizes graph communities. LightRAG Dual-Level Retrieval Case Study combines graph records with vector retrieval for local entity questions, global relationship questions, and incremental updates: https://arxiv.org/abs/2410.05779.',
        'The evaluation trap is measuring only final answer quality on broad questions. Also test exact fact lookup, citation faithfulness, stale-source behavior, and adversarial cases where a parent summary sounds right but a child contradicts it. A hierarchy earns its place only if it improves broad recall without weakening auditability.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RAPTOR paper at https://arxiv.org/abs/2401.18059, RAPTOR HTML at https://arxiv.org/html/2401.18059v1, official RAPTOR implementation at https://github.com/parthsarthi03/raptor, Hugging Face paper card at https://huggingface.co/papers/2401.18059, LightRAG at https://arxiv.org/abs/2410.05779 and https://github.com/HKUDS/LightRAG, and Self-RAG at https://arxiv.org/abs/2310.11511. Study RAG Pipeline, Multi-Index RAG, Embeddings & Similarity, K-Means Clustering, Tree Traversals, HNSW, GraphRAG Community Summary Case Study, LightRAG Dual-Level Retrieval Case Study, and RAG Evaluation next.',
        'When implementing it, start with a small corpus and inspect the tree manually. If the parent summaries do not help a human navigate the corpus, they will not reliably help the retriever either.',
      ],
    },
  ],
};
