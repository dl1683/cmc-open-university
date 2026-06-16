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
      heading: 'What it is',
      paragraphs: [
        'A hierarchy-aligned embedding prefix is a deployment contract for Matryoshka-style vectors. The first dimensions should capture coarse meaning, the next prefix should refine intent or class, and longer prefixes should add entity, nuance, and final ranking detail.',
        'The local fractal-embedding notes phrase the deeper principle as successive refinement: coarse bits first, refinement bits later. This case study turns that idea into a vector-search architecture with explicit prefix indexes, evaluation slices, and candidate-preservation gates.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Training attaches losses to several prefix lengths of one representation. The shortest prefix is not allowed to be arbitrary. It is supervised or audited against coarse tasks such as domain, language, topic, or intent. Longer prefixes handle more detailed labels or contrastive retrieval.',
        'At serving time, the system slices the same vector at runtime. A 64-dimensional prefix can route or search cheaply. A 128-dimensional prefix can filter. A 256-dimensional prefix can retrieve candidates. A full vector can rerank the final list.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Imagine a support-search system with one billion chunks. Stage one searches a 64-dimensional prefix to find broad product-area candidates. Stage two uses 128 dimensions to keep the right intent. Stage three uses 256 dimensions to preserve specific entities. The final reranker uses the full vector and a cross-encoder only for a tiny candidate set.',
        'The data structures are a full-vector store, prefix-specific ANN indexes, candidate heaps, per-stage recall logs, and a prefix-policy table. The policy table decides which query classes get cheap search and which must jump directly to a longer prefix because rare-entity recall is fragile.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Vector-search cost is dominated by memory bandwidth, candidate count, and dimensions compared. Prefix search can reduce all three, but only if the early prefix preserves recall. The operational complexity is building, refreshing, and validating several indexes from the same embedding stream.',
        'A prefix hierarchy is also useful for edge and mobile scenarios. The model can emit one rich vector, while downstream systems choose how many dimensions to store, transmit, or compare based on latency and memory budgets.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The dangerous misconception is that any embedding can be truncated. Ordinary dense vectors often distribute information across dimensions. A prefix contract must be trained or at least validated. Another pitfall is optimizing only final nDCG. A fast first stage can silently erase rare but correct documents.',
        'The fix is slice-level auditing: recall by language, product, rare entity, fresh content, and adversarial paraphrase. Longer prefixes should not reverse important coarse decisions unless the system has a deliberate repair path.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Matryoshka Representation Learning at https://arxiv.org/abs/2205.13147, the NeurIPS paper PDF at https://proceedings.neurips.cc/paper_files/paper/2022/file/c32319f4868da7613d78af9993100e42-Paper-Conference.pdf, and an applied multilingual semantic-search case study at https://arxiv.org/abs/2603.06586. Study Matryoshka Representation Learning, Embeddings & Similarity, HNSW Search, Product Quantization, ANN Recall-Latency Pareto Ledger, Multi-Index RAG, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
