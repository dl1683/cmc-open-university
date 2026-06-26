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
    { heading: 'How to read the animation', paragraphs: [
        'The nested-embeddings view shows one vector being read at several prefix lengths. A prefix is the first d dimensions of the same embedding, not a separate smaller model. The retrieval-cascade view spends short prefixes on many candidates and longer prefixes on fewer candidates.',
        {type: 'image', src: './assets/gifs/matryoshka-representation-learning.gif', alt: 'Animated walkthrough of the matryoshka representation learning visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ], },
    { heading: 'Why this exists', paragraphs: [
        'Embedding systems often choose one vector length for every use. That wastes memory and latency because first-stage retrieval, reranking, mobile classification, and offline analysis need different amounts of detail. Matryoshka Representation Learning trains one vector whose prefixes are useful at several budgets.',
        {type: 'callout', text: 'MRL makes vector length a runtime policy knob by training every prefix to carry usable semantics.'},
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious deployment approach trains one model per vector size. That works, but it multiplies training, evaluation, indexing, and model-versioning work. Arbitrarily truncating an ordinary embedding is cheaper, but ordinary training has no reason to put the most useful dimensions first.',
      ], },
    { heading: 'The wall', paragraphs: [
        'Vector dimension is infrastructure cost. More dimensions mean larger indexes, more memory traffic, slower distance computations, and larger payloads. At billion-vector scale, reducing 768 dimensions to 128 changes whether data fits in memory.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Train losses on several prefixes of the same representation. Early dimensions must solve the task because they are evaluated alone, while later dimensions add detail for harder distinctions. Vector length becomes a runtime policy rather than a model-family decision.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Russian-Matroshka.jpg', alt: 'Russian matryoshka nesting dolls arranged from large to small', caption: 'The nesting-doll metaphor is literal: smaller useful objects sit inside larger ones, just as short embedding prefixes sit inside longer vectors. Source: Wikimedia Commons, Russian-Matroshka image.'},
      ], },
    { heading: 'How it works', paragraphs: [
        'The encoder produces one full embedding. During training, the loss is applied to prefixes such as 64, 128, 256, and 768 dimensions. At inference, truncation is just slicing the vector, so no second model or second forward pass is needed.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'The prefix losses create ordering pressure. High-value coarse information must appear early because short prefixes are graded on their own. Later dimensions can refine rare, close, or ambiguous cases without carrying the whole representation alone.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'Similarity cost is roughly candidates compared times dimensions used. Searching 10 million vectors at 128 dimensions touches about 1.28 billion coordinates, while 768 dimensions touches about 7.68 billion. The operational cost moves into index policy: which prefixes are stored, searched, and audited.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'MRL fits semantic search, image retrieval, RAG chunk retrieval, recommender candidate generation, and on-device classifiers. It is strongest in cascades where a cheap broad search feeds a more expensive reranker. The same embedding can serve both stages.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'Short prefixes can lose rare entities, legal distinctions, multilingual nuance, or safety-critical labels. MRL also does not fix chunking, stale indexes, metadata filters, or weak rerankers. It gives a cost-quality knob, not a complete retrieval system.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'A RAG system with 10 million chunks can search a 128-dimensional prefix first, rerank 10000 candidates with 256 dimensions, and use the full vector on the final 100. If the correct chunk is dropped in the first stage, later stages cannot recover it. That is why recall must be measured at every prefix.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Start with the Matryoshka Representation Learning paper and implementation notes. Study embeddings and similarity, PCA, HNSW, product quantization, multi-stage retrieval, and RAG evaluation next. The core deployment question is which prefix keeps enough recall for each stage.',
      ], },
  ],
};
