// Matryoshka Representation Learning: train embeddings so useful prefixes are
// nested inside larger vectors, enabling elastic retrieval and classification.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'matryoshka-representation-learning',
  title: 'Matryoshka Representation Learning',
  category: 'Papers',
  summary: 'Embeddings with useful prefixes: one vector can be truncated to several dimensions and still preserve coarse-to-fine semantic information.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['nested embeddings', 'retrieval cascade'], defaultValue: 'nested embeddings' },
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

function* nestedEmbeddings() {
  yield {
    state: labelMatrix(
      'One embedding, multiple useful prefixes',
      [
        { id: 'd64', label: '64 dims' },
        { id: 'd128', label: '128 dims' },
        { id: 'd256', label: '256 dims' },
        { id: 'd768', label: '768 dims' },
      ],
      [
        { id: 'semantic detail', label: 'detail' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['coarse', 'tiny'],
        ['topic', 'low'],
        ['neighbors', 'mid'],
        ['nuance', 'high'],
      ],
    ),
    highlight: { active: ['d64:semantic detail', 'd128:semantic detail'], found: ['d768:semantic detail'] },
    explanation: `${topic.title} trains embeddings so their prefixes are useful. The first dimensions carry coarse information; later dimensions add finer detail. You can truncate the vector without training a separate small model.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'embedding dimensions used', min: 0, max: 768 }, y: { label: 'retrieval quality', min: 0.65, max: 0.96 } },
      series: [
        { id: 'mrl', label: 'Matryoshka', points: [
          { x: 64, y: 0.82 }, { x: 128, y: 0.87 }, { x: 256, y: 0.91 }, { x: 512, y: 0.93 }, { x: 768, y: 0.94 },
        ] },
        { id: 'plain', label: 'plain truncation', points: [
          { x: 64, y: 0.68 }, { x: 128, y: 0.73 }, { x: 256, y: 0.80 }, { x: 512, y: 0.90 }, { x: 768, y: 0.94 },
        ] },
      ],
    }),
    highlight: { active: ['mrl'], compare: ['plain'] },
    explanation: `Plain embeddings often spread information across dimensions, so arbitrary truncation hurts. ${topic.title.split(' ').map(w => w[0]).join('')} trains several prefix losses at once, encouraging useful coarse-to-fine structure.`,
    invariant: `Every prefix must be good enough to stand on its own — that is ${topic.title}'s core contract.`,
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'input', label: 'image/text', x: 0.8, y: 3.8, note: 'sample' },
        { id: 'encoder', label: 'encoder', x: 2.7, y: 3.8, note: 'shared' },
        { id: 'prefix64', label: '64-d head', x: 5.0, y: 2.0, note: 'loss' },
        { id: 'prefix128', label: '128-d head', x: 5.0, y: 3.3, note: 'loss' },
        { id: 'prefix256', label: '256-d head', x: 5.0, y: 4.6, note: 'loss' },
        { id: 'full', label: 'full head', x: 7.4, y: 3.8, note: 'loss' },
      ],
      edges: [
        { id: 'e-input-encoder', from: 'input', to: 'encoder', weight: '' },
        { id: 'e-encoder-prefix64', from: 'encoder', to: 'prefix64', weight: '' },
        { id: 'e-encoder-prefix128', from: 'encoder', to: 'prefix128', weight: '' },
        { id: 'e-encoder-prefix256', from: 'encoder', to: 'prefix256', weight: '' },
        { id: 'e-prefix256-full', from: 'prefix256', to: 'full', weight: '' },
      ],
    }, { title: 'MRL adds losses at nested dimensions' }),
    highlight: { active: ['prefix64', 'prefix128', 'prefix256', 'full'], found: ['encoder'] },
    explanation: `The ${topic.title} training change is minimal: attach losses to several prefix lengths of the same representation. At inference, there is no second model and no extra forward pass.`,
  };

  yield {
    state: labelMatrix(
      'Why nested vectors matter',
      [
        { id: 'storage', label: 'storage' },
        { id: 'search', label: 'search' },
        { id: 'edge', label: 'edge device' },
        { id: 'tail', label: 'long tail' },
      ],
      [
        { id: 'pressure', label: 'pressure' },
        { id: 'MRL move', label: 'MRL move' },
      ],
      [
        ['billions of vectors', 'short prefixes'],
        ['latency budget', 'coarse-to-fine'],
        ['small memory', 'truncate safely'],
        ['few examples', 'shared rich vector'],
      ],
    ),
    highlight: { found: ['storage:MRL move', 'search:MRL move', 'edge:MRL move'] },
    explanation: `The ${topic.title} paper reports smaller embeddings and retrieval speedups at similar accuracy in several settings. The broader idea is elastic representation capacity: choose vector length to match the task and budget.`,
  };
}

function* retrievalCascade() {
  yield {
    state: graphState({
      nodes: [
        { id: 'query', label: 'query vector', x: 0.8, y: 3.8, note: 'full' },
        { id: 'prefix', label: '64-d prefix', x: 2.7, y: 3.8, note: 'cheap' },
        { id: 'hnsw', label: 'HNSW search', x: 4.8, y: 3.8, note: 'many docs' },
        { id: 'candidates', label: 'candidates', x: 6.7, y: 3.8, note: 'top 1000' },
        { id: 'rerank', label: 'full rerank', x: 8.7, y: 3.8, note: '768-d' },
      ],
      edges: [
        { id: 'e-query-prefix', from: 'query', to: 'prefix', weight: '' },
        { id: 'e-prefix-hnsw', from: 'prefix', to: 'hnsw', weight: '' },
        { id: 'e-hnsw-candidates', from: 'hnsw', to: 'candidates', weight: '' },
        { id: 'e-candidates-rerank', from: 'candidates', to: 'rerank', weight: '' },
      ],
    }, { title: 'Use a short prefix to search, then a longer prefix to rerank' }),
    highlight: { active: ['prefix', 'hnsw'], found: ['rerank'] },
    explanation: `${topic.title.split(' ')[0]} embeddings are natural for retrieval cascades. Search a huge corpus with a short prefix, then rerank a smaller candidate set with more dimensions.`,
  };

  yield {
    state: labelMatrix(
      'Retrieval cascade budget',
      [
        { id: 'stage1', label: 'stage 1' },
        { id: 'stage2', label: 'stage 2' },
        { id: 'stage3', label: 'stage 3' },
      ],
      [
        { id: 'dims', label: 'dims' },
        { id: 'items', label: 'items' },
        { id: 'goal', label: 'goal' },
      ],
      [
        ['64', '10M', 'cheap recall'],
        ['256', '10K', 'better rank'],
        ['768', '100', 'final precision'],
      ],
    ),
    highlight: { active: ['stage1:dims', 'stage1:items'], found: ['stage3:goal'] },
    explanation: `The cascade works because cost scales with both vector dimension and candidate count. Spend tiny vectors on the whole corpus and full vectors only where the candidate set is already small — ${topic.title} makes this a runtime choice.`,
    invariant: `Cost is roughly items searched times dimensions compared.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'prefix dimensions stored', min: 0, max: 768 }, y: { label: 'memory and latency, lower is better', min: 0, max: 1.05 } },
      series: [
        { id: 'cost', label: 'relative cost', points: [
          { x: 64, y: 0.08 }, { x: 128, y: 0.17 }, { x: 256, y: 0.33 }, { x: 512, y: 0.67 }, { x: 768, y: 1.0 },
        ] },
        { id: 'qualityLoss', label: 'quality loss', points: [
          { x: 64, y: 0.14 }, { x: 128, y: 0.09 }, { x: 256, y: 0.04 }, { x: 512, y: 0.02 }, { x: 768, y: 0.0 },
        ] },
      ],
    }),
    highlight: { active: ['cost', 'qualityLoss'] },
    explanation: `Choosing a prefix is a trade between cost and quality. ${topic.title} makes that trade a runtime choice instead of a retraining project.`,
  };

  yield {
    state: labelMatrix(
      'Deployment audit',
      [
        { id: 'index', label: 'index' },
        { id: 'metric', label: 'metric' },
        { id: 'dims', label: 'dims' },
        { id: 'eval', label: 'eval' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['separate per prefix?', 'index drift'],
        ['cosine or dot?', 'rank mismatch'],
        ['who chooses length?', 'hidden policy'],
        ['recall@k per stage?', 'fake speed win'],
      ],
    ),
    highlight: { found: ['index:question', 'dims:question', 'eval:question'] },
    explanation: `${topic.title.split(' ')[0]} embeddings are only useful if the retrieval system exposes the prefix choice deliberately. Measure recall and latency at every stage, not only final accuracy.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'nested embeddings') yield* nestedEmbeddings();
  else if (view === 'retrieval cascade') yield* retrievalCascade();
  else throw new InputError('Pick a Matryoshka Representation Learning view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/matryoshka-representation-learning.gif', alt: 'Animated walkthrough of the matryoshka representation learning visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'What it is',
      paragraphs: [
        'Matryoshka Representation Learning (MRL) trains embeddings so useful representations are nested inside larger representations. A 768-dimensional vector is not treated as one indivisible object. Its first 64 dimensions should be useful, its first 128 dimensions should be better, and the full vector should be best. The name comes from nesting dolls: smaller representations live inside larger ones.',
        'The paper asks a deployment question: downstream tasks have different compute, storage, latency, and data constraints, but standard representation learning produces one rigid vector size. MRL makes capacity elastic. A retrieval system can use a short prefix for fast search and a longer prefix for reranking without retraining a separate embedding model.',
        {type: 'callout', text: 'MRL makes vector length a runtime policy knob by training every prefix to carry usable semantics.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious deployment answer is to train one embedding model per budget: a small vector for cheap search, a medium vector for most users, and a large vector for high-quality reranking. That works on paper, but it multiplies training, evaluation, storage, index management, and model-versioning work.',
        'Another obvious answer is to take an ordinary embedding and truncate it. That is not the same thing. Standard training has no reason to put the most useful information in the first dimensions. A truncated non-Matryoshka vector may discard exactly the information a downstream task needs.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that vector dimension is an infrastructure cost. More dimensions mean more storage, more memory bandwidth, larger ANN indexes, slower distance computations, and more network transfer. At billion-vector scale, the difference between 128 and 768 dimensions is not cosmetic.',
        'The second wall is task diversity. The best representation size for a mobile classifier, first-stage retrieval, second-stage reranking, and offline evaluation may differ. A rigid embedding forces every stage to pay for the largest representation even when most stages need only a coarse answer.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Train the representation so prefixes are intentionally useful. The first dimensions learn a coarse representation; later dimensions refine it. This turns vector length into a runtime policy choice instead of a model-family decision.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Russian-Matroshka.jpg', alt: 'Russian matryoshka nesting dolls arranged from large to small', caption: 'The nesting-doll metaphor is literal: smaller useful objects sit inside larger ones, just as short embedding prefixes sit inside longer vectors. Source: Wikimedia Commons, Russian-Matroshka image.'},
        'The result is one embedding that can serve several cost-quality points. A retrieval system can search the whole corpus with 64 or 128 dimensions, rerank candidates with 256 or 512, and use the full vector only where final precision is worth the cost.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The training change is simple. Use a normal encoder, but attach losses at several prefix lengths of the output embedding. Each prefix must solve the task well enough on its own, so the model learns coarse-to-fine ordering across dimensions. Early dimensions carry high-value information; later dimensions add detail. At inference, truncation is just slicing the vector.',
        'MRL connects to PCA but differs in how the structure is learned. PCA finds high-variance directions after training. MRL shapes the representation during training so prefix dimensions are semantically useful for the supervised or contrastive objective. It also connects to Product Quantization and HNSW because vector search cost is dominated by how many dimensions and candidates must be compared.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'Read Matryoshka embeddings as nested useful prefixes. The first dimensions are trained to carry a strong coarse representation, and later dimensions refine it rather than starting from scratch.',
        'The animation should make deployment flexibility visible. A system can store one embedding and choose shorter prefixes for cheap search or longer prefixes for reranking, but only if the model was trained so prefixes remain meaningful.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine a RAG system with ten million chunks. Searching all chunks with 768-dimensional vectors is expensive. With MRL, the first stage can search using a 128-dimensional prefix to get a broad candidate set. A second stage can rerank ten thousand candidates with 256 or 512 dimensions. The final stage can use the full vector, cross-encoder reranking, or source-specific rules on only the top candidates.',
        'The cascade is useful only if each stage preserves enough recall. If the 128-dimensional prefix drops the correct chunk before reranking, the full vector never gets a chance to recover it. That is why MRL evaluation should report recall and latency at every prefix and every stage, not just final accuracy after a hand-picked cascade.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The nested losses pressure the encoder to organize information by importance. Early dimensions must satisfy the task because they receive their own loss. Later dimensions can add discriminative detail because the full vector still receives the usual objective.',
        'This is different from compression after the fact. Quantization, PCA, or projection can reduce a vector, but MRL changes what the model learns during training. It asks the encoder to make truncation meaningful before the deployment system ever slices the vector.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'MRL can reduce storage and retrieval cost because short prefixes are enough for many stages. If a system stores billions of embeddings, cutting vectors from 768 dimensions to 128 dimensions can materially change memory, bandwidth, cache residency, and latency. The paper reports up to 14x smaller embedding size for ImageNet-1K classification at similar accuracy and up to 14x retrieval speedups in studied settings.',
        'The added training cost is usually modest compared with training separate small models. The operational complexity moves into indexing policy: which prefix dimensions are stored, which indexes are built, which stage uses which prefix, and how recall is audited. A bad cascade can look fast only because it dropped the right answer early.',
        'Index design is the practical tax. A system may need separate ANN indexes per prefix, a prefix-aware index, or a policy that stores full vectors but compares only prefixes during early stages. Each choice changes memory layout, cache behavior, update cost, and evaluation discipline.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MRL is useful for large-scale retrieval, visual search, semantic search, RAG chunk retrieval, on-device classifiers, recommender candidates, long-tail classification, and any product where vector dimension is a major cost driver. It works well as a bridge topic between Embeddings & Similarity, HNSW (Vector Search at Scale), Product Quantization for Vector Search, and Multi-Index RAG.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MRL is not a guarantee that every short prefix is good enough for every use case. Rare entities, near-duplicate documents, multilingual distinctions, safety-critical labels, or domain-specific terms may need later dimensions. A short prefix can preserve broad semantic class while losing the exact distinction the product cares about.',
        'It also does not remove the need for normal retrieval engineering. Metadata filters, freshness, chunking, reranking, deduplication, and benchmark variance still matter. MRL gives the system a better cost-quality knob; it does not make the rest of the search pipeline correct.',
      ],
    },
    {
      heading: 'Deployment review',
      paragraphs: [
        'A serious deployment review asks who chooses the prefix length, whether the choice is per product, per query, per tenant, or per retrieval stage, and whether users can see quality regressions when a cheaper prefix is selected. A hidden cost policy can become a hidden relevance policy.',
        'The index story also has to be explicit. If the first-stage index stores only 128 dimensions, the system cannot later recover full-vector recall for documents it never retrieved. If it stores full vectors but searches prefixes, engineers need to know how the ANN library handles prefix distance and whether rankings match offline evaluation.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not assume every prefix is good enough for every domain. A 64-dimensional prefix may preserve coarse class identity but lose rare entity distinctions or safety-critical nuance. Also, a Matryoshka vector does not remove the need for benchmark variance discipline. Prefix quality should be measured across tasks, corpus sizes, seeds, and retrieval stages. Finally, arbitrary truncation of a non-MRL embedding is not the same thing; the nested property must be trained.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Matryoshka Representation Learning at https://arxiv.org/abs/2205.13147, the NeurIPS paper PDF at https://proceedings.neurips.cc/paper_files/paper/2022/file/c32319f4868da7613d78af9993100e42-Paper-Conference.pdf, and the Hugging Face overview at https://huggingface.co/blog/matryoshka. Study Embeddings & Similarity, PCA: Principal Component Analysis, HNSW (Vector Search at Scale), Product Quantization for Vector Search, Multi-Index RAG, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
