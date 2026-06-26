// Hierarchy-aligned embedding prefixes: train and operate vectors so early
// dimensions answer coarse questions and later dimensions refine them.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'hierarchy-aligned-embedding-prefix-case-study',
  title: 'Hierarchy-Aligned Embedding Prefix Case Study',
  category: 'Papers',
  summary: 'A vector-search case study: align embedding prefixes with coarse-to-fine semantics, then use short prefixes for cheap recall and longer prefixes for precision.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['prefix hierarchy', 'production cascade'], defaultValue: 'prefix hierarchy' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function cascadeGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.7, y: 3.6, note: 'full vec' },
      { id: 'p64', label: '64d', x: 2.3, y: 2.0, note: 'coarse' },
      { id: 'p256', label: '256d', x: 2.3, y: 3.6, note: 'mid' },
      { id: 'p768', label: '768d', x: 2.3, y: 5.2, note: 'fine' },
      { id: 'hnsw64', label: 'HNSW 64', x: 4.5, y: 2.0, note: 'many' },
      { id: 'hnsw256', label: 'HNSW 256', x: 4.5, y: 3.6, note: 'few' },
      { id: 'rerank', label: 'rerank', x: 6.7, y: 4.4, note: 'full' },
      { id: 'answer', label: 'top docs', x: 8.5, y: 3.6, note: 'ranked' },
    ],
    edges: [
      { id: 'e-query-p64', from: 'query', to: 'p64' },
      { id: 'e-query-p256', from: 'query', to: 'p256' },
      { id: 'e-query-p768', from: 'query', to: 'p768' },
      { id: 'e-p64-hnsw64', from: 'p64', to: 'hnsw64' },
      { id: 'e-p256-hnsw256', from: 'p256', to: 'hnsw256' },
      { id: 'e-hnsw64-hnsw256', from: 'hnsw64', to: 'hnsw256', weight: 'top k' },
      { id: 'e-hnsw256-rerank', from: 'hnsw256', to: 'rerank' },
      { id: 'e-p768-rerank', from: 'p768', to: 'rerank' },
      { id: 'e-rerank-answer', from: 'rerank', to: 'answer' },
    ],
  }, { title });
}

function* prefixHierarchy() {
  yield {
    state: labelMatrix(
      'Coarse-to-fine prefix contract',
      [
        { id: 'd64', label: '64d' },
        { id: 'd128', label: '128d' },
        { id: 'd256', label: '256d' },
        { id: 'd512', label: '512d' },
        { id: 'd768', label: '768d' },
      ],
      [
        { id: 'semantic', label: 'semantic' },
        { id: 'loss', label: 'loss' },
        { id: 'use', label: 'use' },
      ],
      [
        ['domain', 'coarse', 'route'],
        ['intent', 'class', 'filter'],
        ['entity', 'metric', 'search'],
        ['nuance', 'rank', 'rerank'],
        ['full', 'task', 'final'],
      ],
    ),
    highlight: { active: ['d64:semantic', 'd128:semantic', 'd256:semantic'], found: ['d768:use'] },
    explanation: 'A hierarchy-aligned prefix is more specific than ordinary truncation. Early dimensions are trained and audited to answer coarse questions. Later dimensions refine intent, entity, and nuance.',
    invariant: 'A longer prefix must preserve the useful decisions made by shorter prefixes.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'item', label: 'item', x: 0.8, y: 3.5, note: 'text/image' },
        { id: 'encoder', label: 'encoder', x: 2.5, y: 3.5, note: 'shared' },
        { id: 'coarse', label: 'coarse loss', x: 4.6, y: 1.6, note: 'domain' },
        { id: 'intent', label: 'intent loss', x: 4.6, y: 3.0, note: 'class' },
        { id: 'entity', label: 'entity loss', x: 4.6, y: 4.4, note: 'id' },
        { id: 'rank', label: 'rank loss', x: 6.8, y: 3.0, note: 'retrieval' },
        { id: 'vector', label: 'one vector', x: 8.6, y: 3.0, note: 'prefixes' },
      ],
      edges: [
        { id: 'e-item-encoder', from: 'item', to: 'encoder' },
        { id: 'e-encoder-coarse', from: 'encoder', to: 'coarse' },
        { id: 'e-encoder-intent', from: 'encoder', to: 'intent' },
        { id: 'e-encoder-entity', from: 'encoder', to: 'entity' },
        { id: 'e-intent-rank', from: 'intent', to: 'rank' },
        { id: 'e-entity-rank', from: 'entity', to: 'rank' },
        { id: 'e-rank-vector', from: 'rank', to: 'vector' },
      ],
    }, { title: 'Prefix supervision turns dimension order into a product contract' }),
    highlight: { active: ['coarse', 'intent', 'entity', 'rank'], found: ['vector'] },
    explanation: 'The training objective can attach losses to several prefix lengths, as in Matryoshka Representation Learning. The case-study extension is to align each prefix with an explicit semantic level and then audit that level in production.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'prefix dimensions', min: 0, max: 768 }, y: { label: 'recall or task score', min: 0.55, max: 0.98 } },
      series: [
        { id: 'aligned', label: 'aligned', points: [{ x: 64, y: 0.78 }, { x: 128, y: 0.84 }, { x: 256, y: 0.90 }, { x: 512, y: 0.94 }, { x: 768, y: 0.95 }] },
        { id: 'flat', label: 'flat cut', points: [{ x: 64, y: 0.60 }, { x: 128, y: 0.68 }, { x: 256, y: 0.79 }, { x: 512, y: 0.91 }, { x: 768, y: 0.95 }] },
      ],
      markers: [
        { id: 'knee', x: 256, y: 0.90, label: 'knee' },
      ],
    }),
    highlight: { active: ['aligned', 'knee'], compare: ['flat'] },
    explanation: 'The expected shape is a smooth recall ramp. If the short prefix collapses quality, the hierarchy contract has failed and the retrieval cascade will drop relevant items before reranking can rescue them.',
  };

  yield {
    state: labelMatrix(
      'Prefix audit questions',
      [
        { id: 'mono', label: 'monotone' },
        { id: 'slice', label: 'slices' },
        { id: 'rare', label: 'rare ids' },
        { id: 'fresh', label: 'freshness' },
        { id: 'index', label: 'index' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['longer better?', 'rank flip'],
        ['which tasks?', 'avg hides'],
        ['entity recall?', 'dropped early'],
        ['new corpus?', 'stale prefix'],
        ['per prefix?', 'drift'],
      ],
    ),
    highlight: { active: ['mono:question', 'rare:question', 'index:question'], compare: ['slice:failure'] },
    explanation: 'The audit is not optional. A short prefix can look good on average while destroying rare entity recall, multilingual intent, or safety-critical distinctions.',
  };
}

function* productionCascade() {
  yield {
    state: cascadeGraph('Materialize several prefix indexes from one vector'),
    highlight: { active: ['query', 'p64', 'hnsw64', 'e-query-p64', 'e-p64-hnsw64'], found: ['rerank'] },
    explanation: 'A production cascade can store one full embedding but build multiple ANN indexes over prefixes. The 64-dimensional index searches the whole corpus cheaply, while longer prefixes refine progressively smaller candidate sets.',
  };

  yield {
    state: labelMatrix(
      'Cascade budget ledger',
      [
        { id: 's1', label: 'stage 1' },
        { id: 's2', label: 'stage 2' },
        { id: 's3', label: 'stage 3' },
        { id: 's4', label: 'stage 4' },
      ],
      [
        { id: 'dims', label: 'dims' },
        { id: 'items', label: 'items' },
        { id: 'goal', label: 'goal' },
      ],
      [
        ['64', 'all', 'recall'],
        ['128', '50k', 'filter'],
        ['256', '5k', 'rank'],
        ['768', '100', 'precision'],
      ],
    ),
    highlight: { active: ['s1:dims', 's1:items', 's2:items'], found: ['s4:goal'] },
    explanation: 'The cost equation is simple: comparisons scale with items times dimensions. A prefix hierarchy lets the system spend cheap dimensions on many items and expensive dimensions only after the candidate set is small.',
    invariant: 'Every stage must preserve enough recall for the next stage.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'query', label: 'query', x: 0.6, y: 3.5, note: 'rare' },
        { id: 'short', label: '64d index', x: 2.5, y: 3.5, note: 'coarse' },
        { id: 'near', label: 'common docs', x: 4.5, y: 2.3, note: 'kept' },
        { id: 'rare', label: 'rare doc', x: 4.5, y: 4.8, note: 'missed' },
        { id: 'rerank', label: 'rerank', x: 6.7, y: 2.3, note: 'cannot see' },
        { id: 'alert', label: 'slice alert', x: 7.0, y: 4.8, note: 'audit' },
      ],
      edges: [
        { id: 'e-query-short', from: 'query', to: 'short' },
        { id: 'e-short-near', from: 'short', to: 'near' },
        { id: 'e-short-rare', from: 'short', to: 'rare' },
        { id: 'e-near-rerank', from: 'near', to: 'rerank' },
        { id: 'e-rare-alert', from: 'rare', to: 'alert' },
      ],
    }, { title: 'A bad short prefix creates unrecoverable false negatives' }),
    highlight: { active: ['short', 'rare', 'alert', 'e-short-rare'], removed: ['rare'], compare: ['rerank'] },
    explanation: 'The cascade failure mode is severe. If the short prefix fails to retrieve the rare but correct document, the full-vector reranker never sees it. That is why prefix recall must be measured before final precision.',
  };

  yield {
    state: labelMatrix(
      'Complete production case study',
      [
        { id: 'route', label: 'intent route' },
        { id: 'search', label: 'ANN search' },
        { id: 'rerank', label: 'rerank' },
        { id: 'observe', label: 'observe' },
      ],
      [
        { id: 'prefix', label: 'prefix' },
        { id: 'metric', label: 'metric' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['64d', 'intent recall', 'fallback'],
        ['128d', 'recall@k', 'wide k'],
        ['512d', 'nDCG', 'holdout'],
        ['all', 'slice drift', 'canary'],
      ],
    ),
    highlight: { active: ['route:guard', 'search:guard', 'observe:guard'], found: ['rerank:metric'] },
    explanation: 'A clean implementation treats prefix length as a serving decision, not a hidden optimization. It logs which prefix was used, how many candidates survived, and which evaluation slice paid the cost.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'prefix hierarchy') yield* prefixHierarchy();
  else if (view === 'production cascade') yield* productionCascade();
  else throw new InputError('Pick a hierarchy-aligned embedding view.');
}

export const article = {
  references: [
    { title: 'Matryoshka Representation Learning', url: 'https://arxiv.org/abs/2205.13147' },
    { title: 'NeurIPS MRL paper PDF', url: 'https://proceedings.neurips.cc/paper_files/paper/2022/file/c32319f4868da7613d78af9993100e42-Paper-Conference.pdf' },
    { title: 'Scaling Multilingual Semantic Search in Uber Eats Delivery', url: 'https://arxiv.org/abs/2603.06586' },
  ],
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the embedding vector as an ordered representation, not as a bag of interchangeable coordinates. A prefix means the first d dimensions, such as the first 64 out of 768, used without reading the later dimensions.',
        'Active prefix lengths are the current search budget. A safe inference is that a shorter prefix may return a wider candidate set, while a longer prefix should refine that set without contradicting the coarse neighborhood.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An embedding is a numeric vector that places related items near each other. Vector search becomes expensive when every lookup over millions of items must compare full-width vectors before the system even knows which candidates deserve careful ranking.',
        'Hierarchy-aligned prefixes exist so one embedding can serve several budgets. The short prefix handles coarse routing or recall, the middle prefix narrows candidates, and the full vector buys precision where the candidate set is already small.',
        {type:'callout', text:'Prefix embeddings are useful only when dimension order is an audited contract: short prefixes preserve recall and longer prefixes buy precision.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to store one full vector per item and compare full vectors for every stage. That is simple, and it is often the right baseline because it avoids assuming anything special about dimension order.',
        'A second approach is to train separate small, medium, and large embedding models. That gives each stage its own cost, but it multiplies model versions, embedding stores, refresh jobs, quality checks, and drift surfaces.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that full-vector cost is paid even when the decision is coarse. Routing a query to a document family should not spend the same vector width as final reranking among one hundred candidate passages.',
        'Plain truncation is not a solution. In an ordinary dense embedding, useful information may be spread across dimensions, so the first 128 coordinates can be arbitrary and can drop rare entities, minority languages, or safety-critical distinctions.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is successive refinement. Early dimensions should learn broad signals that remain useful across many tasks, and later dimensions should add detail without erasing the early decision.',
        'Matryoshka Representation Learning makes this trainable by attaching losses to nested prefixes. The system version treats each prefix as an interface with its own index, recall metric, latency budget, and fallback rule.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Training evaluates several prefix lengths, such as 64, 128, 256, and 768 dimensions. Each prefix is punished when it fails the retrieval or classification job assigned to that width.',
        'Serving stores the full vector once and materializes prefix-specific indexes. A 64-dimensional index can retrieve broad candidates, a 256-dimensional index can refine them, and a full-vector store or reranker can decide final order.',
        'A prefix policy chooses the route. Common queries may use 64 dimensions first, ambiguous or rare queries may jump to 256, and high-stakes queries may bypass the prefix cascade and use full-vector search immediately.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works when the data has stable coarse-to-fine structure. Language often comes before legal nuance, product area before product variant, and object class before instance identity.',
        'The correctness argument is recall preservation, not magic compression. If the short prefix keeps the true neighbors inside the candidate set, later dimensions can improve precision; if the true item is filtered out early, no later reranker can recover it.',
        'The invariant is monotone usefulness by stage. Longer prefixes may change ranking, but they should not routinely turn the right broad neighborhood into the wrong one.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Vector comparison cost grows with candidates times dimensions. Comparing 1,000,000 items at 64 dimensions touches 64,000,000 coordinate values, while 768 dimensions touches 768,000,000 values before indexing overhead.',
        'The behavior is a cascade. Spend cheap dimensions while the search space is wide, then spend expensive dimensions only after candidate count falls.',
        'The cost is evaluation burden. Every prefix length needs recall by slice, index freshness, latency, memory, fallback rates, and drift monitoring, because average recall can hide long-tail damage.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Prefix embeddings fit RAG systems, semantic search, recommendations, multilingual retrieval, mobile matching, edge caches, and tiered vector stores. These systems often need broad recall quickly before they pay for precise reranking.',
        'They are useful when storage and transmission budgets differ by environment. An edge device may keep a short prefix, while a central service keeps full vectors and uses longer prefixes only when uncertainty remains.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the model was not trained for nested usefulness. A normal vector can look acceptable under average truncation tests while losing rare entities or low-resource languages.',
        'It also fails when the semantic hierarchy is wrong. A legal query for a rare clause or an incident query with a specific error code may need fine detail immediately, not after a broad prefix filter.',
        'Distribution shift is another failure. New tenants, languages, products, or embedding model versions can change which signals belong early, so prefix quality must be re-audited after corpus changes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a corpus has 10,000,000 passages stored as 768-dimensional float vectors. At 4 bytes per coordinate, the raw full vectors occupy about 30.7 GB, while a 128-dimensional prefix index reads one-sixth as many coordinates for the same candidate count.',
        'A query first searches the 128-dimensional index and returns 5,000 candidates with 99 percent recall against a full-vector control set. The system then reranks those 5,000 with 768 dimensions, reading about 15.4 MB of full-vector coordinates instead of 30.7 GB.',
        'The correctness check is the missing 1 percent. If those misses are random, the trade may be acceptable; if they are medical terms, rare customers, or one language, the prefix policy is unsafe even though the average number looks strong.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the Matryoshka Representation Learning paper and later system case studies that evaluate nested embeddings in retrieval. Read them for the training objective, then test your own corpus because prefix order is a learned contract, not a universal property.',
        'Study Embeddings and Similarity, HNSW Search, Product Quantization, Cross-Encoder Rerankers, Multi-Index RAG, and Recall-Latency Pareto Ledgers next. Those topics explain the retrieval pipeline around the prefix decision.',
      ],
    },
  ],
};
