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
        'A hierarchy-aligned embedding prefix is an embedding design where shorter prefixes of the vector are useful on purpose. The first 64 or 128 dimensions are expected to answer coarse questions such as language, domain, topic, or broad intent. Longer prefixes keep those decisions and add finer distinctions: entity identity, product variant, legal clause, visual detail, or answer-level relevance. The full vector is still available, but the system is not forced to pay full-vector cost for every decision.',
        'This is stronger than saying a vector can be truncated. In many ordinary embeddings, information is spread across dimensions in a way that makes the first slice arbitrary. A hierarchy-aligned prefix is a contract between training, indexing, and serving. The short prefix must be good enough for coarse retrieval or routing; the middle prefix must be good enough for candidate selection; the long prefix must be good enough for precision. If the contract holds, one embedding can support several latency and memory budgets.',
        {type:'callout', text:'Prefix embeddings are useful only when dimension order is an audited contract: short prefixes preserve recall and longer prefixes buy precision.'},
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The obvious approach to vector search is to store a full embedding for every item and compare full embeddings at query time. That is simple and often correct for small corpora. It also makes every stage pay the same dimensional cost. A routing decision over ten million items spends as much vector width as a final rerank over one hundred candidates. A mobile client, an edge cache, and a central retrieval service all inherit the same representation size even though they have different jobs.',
        'The wall appears when the corpus and traffic grow. Full-vector ANN indexes consume memory, refresh slowly, and place pressure on cache locality. Coarse decisions do not need every semantic detail, but ordinary truncation often destroys quality. A system can build separate small models for routing, medium models for search, and large models for reranking, but then it has more model versions, more embedding stores, more drift, and more failure modes. Prefix alignment tries to keep one representation while giving each serving stage the right amount of detail.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is successive refinement. Early dimensions should learn features that remain useful across many downstream tasks. Later dimensions should refine, not contradict, the coarse decision. Matryoshka Representation Learning made this idea concrete by training representations so nested prefixes perform well. The case-study extension is operational: treat each prefix as a product surface with explicit semantics, indexes, logs, and evaluation gates instead of a hidden compression trick.',
        'A good prefix hierarchy should feel monotone in the ways that matter. The 64-dimensional prefix may be less precise than the 768-dimensional vector, but it should not send tax documents to food recipes or confuse English and Japanese support pages. The 256-dimensional prefix should improve entity and intent resolution without erasing broad recall. The full vector can still change the final ordering, but it should receive a candidate set that already contains the right neighborhood.',
      ],
    },
    {
      heading: 'Mechanism and data structures',
      paragraphs: [
        'Training usually attaches objectives to several prefix lengths. A short prefix can receive coarse classification or contrastive losses. A medium prefix can receive intent, entity, or category supervision. The full vector can receive the hardest retrieval or ranking loss. Some implementations use the same target at several lengths; others align prefix lengths with a hand-built semantic hierarchy. Either way, the model is punished when useful information appears only in late dimensions and short prefixes fail obvious tasks.',
        'Serving turns that representation into data structures. The system stores the full vector once, then materializes prefix-specific indexes: a 64-dimensional HNSW index for broad recall, a 128- or 256-dimensional index for narrower candidate selection, and a full-vector store for exact reranking or downstream scoring. Each stage keeps a bounded heap of candidates, along with metadata about prefix length, candidate count, score distribution, and fallback decisions. A prefix-policy table maps query classes to serving plans: cheap route, normal cascade, rare-entity wide search, or full-vector bypass.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works when the training distribution contains stable coarse-to-fine structure. Product area usually precedes article title. Language usually precedes legal nuance. A medical corpus may separate body system before specific procedure. Image search may separate object class before instance detail. If the embedding learns that order, a short prefix can eliminate large regions of the corpus without losing many relevant items. Later dimensions then spend capacity on distinctions that matter only inside the surviving region.',
        'The cost equation is direct. Vector comparison work grows with candidates times dimensions, and memory traffic often dominates latency. A 64-dimensional scan over a large candidate space is much cheaper than a 768-dimensional scan over the same space. The cascade spends cheap dimensions when the set is wide and expensive dimensions only after it is narrow. That is the same economic pattern as coarse quantizers, inverted indexes, and multi-stage rerankers: preserve recall cheaply, then buy precision where it can matter.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'Hierarchy-aligned prefixes are useful in retrieval systems that serve multiple latency tiers from the same corpus. A RAG system can use a short prefix to route queries to product, region, or document family; a medium prefix to retrieve passages; and a full vector or cross-encoder to choose final context. A recommendation system can use shorter prefixes for candidate generation and longer prefixes for personalization. A multilingual search system can keep language and broad intent stable early, then refine local vocabulary and entity mentions later.',
        'They also help when storage and transmission budgets differ by environment. An edge device may store only a short prefix for offline matching. A central service may keep full vectors. A client may send a prefix first and request full reranking only when uncertainty is high. The same pattern is attractive for tiered vector stores, cold archives, mobile inference, and privacy-limited flows where the system wants to reveal or transmit the minimum useful representation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The common failure is pretending that any dense vector has a meaningful prefix. If the model was not trained or audited for nested usefulness, dimension order may be accidental. Truncating the first 128 coordinates can look acceptable on average while damaging rare entities, minority languages, long-tail product names, or safety-critical distinctions. The failure is severe because early retrieval false negatives are unrecoverable. A perfect full-vector reranker cannot rank a document that the short prefix never returned.',
        'It also fails when the semantic hierarchy is wrong for the workload. Some queries need fine details immediately. A legal search for a rare clause, a medical query about an uncommon drug interaction, or an incident response query with a specific error code may not tolerate a broad coarse filter. Distribution shift can break the hierarchy as new products, tenants, languages, or content types arrive. A prefix that was well aligned last quarter can become stale after an embedding-model change or corpus migration.',
      ],
    },
    {
      heading: 'Evaluation and operational signals',
      paragraphs: [
        'Evaluation starts with prefix recall. For each prefix length, measure recall@k against exact full-vector or human-labeled relevance sets. Do it by slice: language, tenant, document type, query intent, entity rarity, freshness, and source system. Track monotonicity: longer prefixes should usually improve quality, but short prefixes should not catastrophically reverse coarse decisions. Measure final metrics such as nDCG and answer faithfulness separately from early candidate recall so the wrong stage is not blamed.',
        'Operational logs should record prefix length, index version, candidate depth, fallback path, latency, memory footprint, and score margin. A narrow score margin at the short prefix can trigger a wider search or a jump to a longer prefix. Canary queries should compare prefix cascades with flat full-vector search. Alerts should fire on rare-entity recall drops, sudden slice drift, index skew, or an increase in cases where later stages cannot find good evidence. The healthy signal is not just lower latency; it is lower latency while candidate preservation remains stable.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Study Matryoshka Representation Learning first because it provides the training frame for nested representations. Then study Embeddings and Similarity to understand what vector distance is measuring, HNSW Search to understand approximate nearest-neighbor indexes, Product Quantization to understand compressed vector storage, and Cross-Encoder Rerankers to understand why early candidate preservation matters. Multi-Index RAG is the natural system-level companion because it shows how lexical, vector, metadata, and reranking stages combine.',
        'The practical takeaway is simple: a hierarchy-aligned prefix is useful only when it is treated as a measured interface. Name the semantic job of each prefix. Build the right index for that job. Preserve recall before optimizing final rank. Keep exact or full-vector checks as a control. When those disciplines are present, prefix embeddings give one model the flexibility of several retrieval budgets without multiplying every representation in the stack.',
      ],
    },
  ],
};
