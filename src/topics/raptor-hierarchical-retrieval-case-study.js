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
      heading: 'How to read the animation',
      paragraphs: [
        'Read leaves as original text chunks and parent nodes as generated summaries over clusters of children. A parent is searchable evidence metadata, not a replacement for the source text below it.',
        'During retrieval, broad questions may touch parent summaries first, while exact claims still need leaf chunks for proof. The useful path is often parent for map and leaves for citation.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'RAPTOR stands for Recursive Abstractive Processing for Tree-Organized Retrieval. It exists because flat RAG often retrieves short chunks without the document-level context needed for broad questions.',
        'A question about a theme, comparison, or policy pattern may depend on evidence spread across sections. RAPTOR precomputes summaries above related chunks so retrieval can operate at several abstraction levels.',
        {type:'callout', text:'RAPTOR makes summaries searchable evidence objects, so retrieval can choose between broad parent context and leaf level proof instead of flattening every question into top-k chunks.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg', alt:'Binary tree diagram with parent and child nodes.', caption:'Binary tree diagram. RAPTOR uses a tree of summaries and leaf chunks so retrieval can move between abstraction levels. Source: Wikimedia Commons, Derrick Coetzee, Public domain.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is flat chunk retrieval. Split documents into chunks, embed every chunk, retrieve top-k chunks, and paste them into the prompt.',
        'That works for exact lookup when the answer lives in one nearby passage. It struggles when the answer requires the shape of a whole document or a comparison across distant sections.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is abstraction mismatch. Small chunks preserve local details but lose global structure, while large chunks preserve more context but waste tokens and weaken nearest-neighbor precision.',
        'Increasing k is not a clean fix. More chunks can add scattered evidence without the relationship that tells the model how the pieces fit together.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Index summaries as first-class retrieval objects. A parent summary has text, an embedding, child links, and provenance, so it can be retrieved when the query is broader than one leaf.',
        'The tree changes retrieval from one flat nearest-neighbor search into a level-selection problem. Narrow facts want leaves, broad themes want parents, and careful answers often need both.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The build phase embeds leaf chunks, clusters nearby chunks, asks a language model to summarize each cluster, embeds those summaries, and repeats the process until the tree reaches a root or target depth. Each parent stores links to its children.',
        'The query phase searches across levels or traverses from retrieved parents down to children. The prompt can then include a parent summary for orientation and leaf passages for exact support.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'RAPTOR works when summaries preserve concepts that flat chunk embeddings scatter. Documents often already have hierarchy: sections, exceptions, examples, tables, and arguments.',
        'The correctness condition is traceability. A parent can guide retrieval, but any factual answer should still be backed by child nodes and source chunks that justify the claim.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'RAPTOR moves cost to ingestion. For 10,000 leaf chunks clustered ten at a time, the first summary layer has about 1000 generated summaries, the next about 100, and the next about 10 before a root.',
        'Updates are harder than flat indexing. Changing one leaf may invalidate its parent summary, that parent embedding, and higher summaries above it, so lineage and partial rebuilds matter.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RAPTOR fits long manuals, research corpora, policy libraries, legal binders, support documentation, and books where broad questions need section-level or document-level context. It is strongest when the corpus is large but reasonably stable.',
        'It can combine with multi-index RAG. BM25 can catch exact codes, vector search can find semantic matches, and RAPTOR parents can supply map-level context.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when summaries drift. A parent that omits an exception, overgeneralizes a rule, or merges unrelated children becomes a misleading index entry.',
        'It also fails on fast-changing corpora without rebuild discipline. If leaves update but parents stay stale, retrieval can surface a polished summary of old evidence.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A 400-page benefits manual becomes 2400 leaf chunks of about 300 tokens each. Clustering 12 leaves at a time creates about 200 parent summaries, then about 17 higher summaries, plus one root.',
        'For the question how dental and vision exceptions differ, flat retrieval might return 8 isolated chunks. RAPTOR can retrieve a parent about coverage exceptions, then include 3 dental leaves and 3 vision leaves so the model sees both the map and the proof.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the RAPTOR paper, the RAPTOR implementation, and Self-RAG for related retrieval-control ideas. Compare with LightRAG and GraphRAG to see how trees differ from entity graphs.',
        'Study embeddings, clustering, tree traversals, HNSW, multi-index RAG, GraphRAG community summaries, LightRAG dual-level retrieval, and RAG evaluation next. A summary tree is useful only if it improves broad recall without weakening citation faithfulness.',
      ],
    },
  ],
};
