// AnglE-style text embeddings: optimize angles directly so cosine saturation
// does not flatten the learning signal near "already close" or "already far".

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'angle-optimized-text-embeddings',
  title: 'AnglE-Optimized Text Embeddings',
  category: 'Papers',
  summary: 'A geometry lesson for sentence embeddings: cosine similarity can saturate, so AnglE optimizes angular differences in complex space.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['cosine saturation', 'complex angle loss'], defaultValue: 'cosine saturation' },
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

function embeddingPipeline(title) {
  return graphState({
    nodes: [
      { id: 'pairs', label: 'text pairs', x: 0.7, y: 3.8, note: 'STS labels' },
      { id: 'encoder', label: 'encoder', x: 2.5, y: 3.8, note: 'BERT/LLM' },
      { id: 'emb', label: 'vectors', x: 4.2, y: 3.8, note: 'sentence reps' },
      { id: 'split', label: 'complex split', x: 5.9, y: 3.8, note: 'real + imag' },
      { id: 'angle', label: 'angle loss', x: 7.6, y: 3.8, note: 'phase gap' },
      { id: 'rank', label: 'ranked pairs', x: 9.2, y: 3.8, note: 'STS score' },
    ],
    edges: [
      { id: 'e-pairs-encoder', from: 'pairs', to: 'encoder', weight: '' },
      { id: 'e-encoder-emb', from: 'encoder', to: 'emb', weight: '' },
      { id: 'e-emb-split', from: 'emb', to: 'split', weight: '' },
      { id: 'e-split-angle', from: 'split', to: 'angle', weight: '' },
      { id: 'e-angle-rank', from: 'angle', to: 'rank', weight: '' },
    ],
  }, { title });
}

function cosinePoints() {
  const pts = [];
  for (let deg = 0; deg <= 180; deg += 15) {
    const rad = (deg * Math.PI) / 180;
    pts.push({ x: deg, y: Math.cos(rad) });
  }
  return pts;
}

function gradientPoints() {
  const pts = [];
  for (let deg = 0; deg <= 180; deg += 15) {
    const rad = (deg * Math.PI) / 180;
    pts.push({ x: deg, y: Math.sin(rad) });
  }
  return pts;
}

function* cosineSaturation() {
  yield {
    state: plotState({
      axes: { x: { label: 'angle between vectors (deg)', min: 0, max: 180 }, y: { label: 'cosine value', min: -1.05, max: 1.05 } },
      series: [
        { id: 'cos', label: 'cos(angle)', points: cosinePoints() },
      ],
      markers: [
        { id: 'near', x: 10, y: 0.98, label: 'near duplicate' },
        { id: 'far', x: 170, y: -0.98, label: 'obvious negative' },
      ],
    }),
    highlight: { active: ['cos'], compare: ['near', 'far'] },
    explanation: 'Cosine similarity is the standard metric for sentence embeddings, but the curve flattens near 0 deg and 180 deg. The pairs that are already very similar or very different can produce weak learning signal even when their ordering still matters.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'angle between vectors (deg)', min: 0, max: 180 }, y: { label: 'gradient magnitude', min: 0, max: 1.05 } },
      series: [
        { id: 'grad', label: '|d cos / d angle|', points: gradientPoints() },
      ],
      markers: [
        { id: 'flatA', x: 5, y: 0.09, label: 'flat' },
        { id: 'steep', x: 90, y: 1.0, label: 'steep' },
        { id: 'flatB', x: 175, y: 0.09, label: 'flat' },
      ],
    }),
    highlight: { active: ['flatA', 'flatB'], found: ['steep'] },
    explanation: 'The derivative is strongest around 90 deg and tiny near the saturation zones. AnglE targets that weakness: optimize angular information more directly instead of asking cosine to carry the entire training objective.',
    invariant: 'If the metric saturates, gradient descent gets quiet exactly where ranking can still be useful.',
  };

  yield {
    state: labelMatrix(
      'Semantic pair pressure',
      [
        { id: 'dup', label: 'duplicate issue' },
        { id: 'same', label: 'same intent' },
        { id: 'near', label: 'near topic' },
        { id: 'neg', label: 'unrelated' },
      ],
      [
        { id: 'target', label: 'target' },
        { id: 'cosine risk', label: 'cos risk' },
        { id: 'angle fix', label: 'angle fix' },
      ],
      [
        ['pull very close', 'flat high end', 'keep ordering'],
        ['pull close', 'weak margin', 'phase gap'],
        ['middle rank', 'ambiguous zone', 'calibrate'],
        ['push apart', 'flat low end', 'stable repel'],
      ],
    ),
    highlight: { active: ['dup:cosine risk', 'neg:cosine risk'], found: ['dup:angle fix', 'neg:angle fix'] },
    explanation: 'Semantic textual similarity is not just binary match/no-match. Good embeddings must order duplicates, paraphrases, related passages, and unrelated passages. The saturation problem hides exactly in those fine distinctions.',
  };

  yield {
    state: embeddingPipeline('AnglE keeps the familiar embedding pipeline but changes the geometry of the loss'),
    highlight: { active: ['split', 'angle'], found: ['rank'] },
    explanation: 'AnglE keeps the production-friendly recipe - encode text, produce vectors, compare pairs - but introduces angle optimization in complex space. The result is still an embedding model you can use for retrieval, clustering, and reranking.',
  };
}

function* complexAngleLoss() {
  yield {
    state: plotState({
      axes: { x: { label: 'real axis', min: -1.2, max: 1.2 }, y: { label: 'imag axis', min: -1.2, max: 1.2 } },
      series: [
        { id: 'unit', label: 'unit circle', points: [
          { x: 1.0, y: 0.0 }, { x: 0.71, y: 0.71 }, { x: 0.0, y: 1.0 }, { x: -0.71, y: 0.71 },
          { x: -1.0, y: 0.0 }, { x: -0.71, y: -0.71 }, { x: 0.0, y: -1.0 }, { x: 0.71, y: -0.71 }, { x: 1.0, y: 0.0 },
        ] },
      ],
      vectors: [
        { id: 'q', from: { x: 0, y: 0 }, to: { x: 0.92, y: 0.39 }, label: 'query' },
        { id: 'p', from: { x: 0, y: 0 }, to: { x: 0.76, y: 0.65 }, label: 'positive' },
        { id: 'n', from: { x: 0, y: 0 }, to: { x: -0.5, y: 0.87 }, label: 'negative' },
      ],
    }),
    highlight: { active: ['q', 'p'], compare: ['n'] },
    explanation: 'A complex representation makes angle a first-class object. Similar text should occupy nearby phase directions; mismatches should land farther around the circle.',
  };

  yield {
    state: labelMatrix(
      'Complex split of a sentence vector',
      [
        { id: 'dims', label: 'embedding dims' },
        { id: 'real', label: 'real part' },
        { id: 'imag', label: 'imag part' },
        { id: 'phase', label: 'phase' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'intuition', label: 'intuition' },
      ],
      [
        ['vector halves', 'paired coords'],
        ['first half', 'x axis'],
        ['second half', 'y axis'],
        ['atan2(imag, real)', 'angle signal'],
      ],
    ),
    highlight: { active: ['real:intuition', 'imag:intuition', 'phase:intuition'] },
    explanation: 'The real and imaginary halves form complex coordinates. That does not make the encoder mystical; it gives the loss a cleaner way to talk about angular relations between sentence representations.',
    invariant: 'Complex coordinates expose phase; phase exposes angular order.',
  };

  yield {
    state: labelMatrix(
      'Training objective audit',
      [
        { id: 'source', label: 'pair label' },
        { id: 'metric', label: 'metric' },
        { id: 'loss', label: 'loss' },
        { id: 'eval', label: 'eval' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure mode', label: 'failure' },
      ],
      [
        ['how similar?', 'noisy labels'],
        ['cos or angle?', 'saturation'],
        ['rank pairs?', 'weak margins'],
        ['STS/MTEB?', 'domain shift'],
      ],
    ),
    highlight: { found: ['metric:failure mode', 'loss:failure mode', 'eval:failure mode'] },
    explanation: 'The important lesson is not only the specific paper. Embedding quality is created by the alignment between labels, geometry, loss, and evaluation. A better metric can fail if the data or evaluation target is wrong.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'semantic', label: 'semantic search', x: 0.9, y: 2.5, note: 'queries' },
        { id: 'rag', label: 'RAG', x: 0.9, y: 5.0, note: 'chunks' },
        { id: 'embed', label: 'AnglE vectors', x: 3.4, y: 3.8, note: 'geometry' },
        { id: 'hnsw', label: 'HNSW', x: 5.9, y: 2.5, note: 'ANN index' },
        { id: 'rank', label: 'reranker', x: 5.9, y: 5.0, note: 'precision' },
        { id: 'answer', label: 'answer', x: 8.4, y: 3.8, note: 'grounded' },
      ],
      edges: [
        { id: 'e-semantic-embed', from: 'semantic', to: 'embed', weight: '' },
        { id: 'e-rag-embed', from: 'rag', to: 'embed', weight: '' },
        { id: 'e-embed-hnsw', from: 'embed', to: 'hnsw', weight: '' },
        { id: 'e-embed-rank', from: 'embed', to: 'rank', weight: '' },
        { id: 'e-hnsw-answer', from: 'hnsw', to: 'answer', weight: '' },
        { id: 'e-rank-answer', from: 'rank', to: 'answer', weight: '' },
      ],
    }, { title: 'Where angle-optimized embeddings plug in' }),
    highlight: { active: ['embed'], found: ['hnsw', 'rank', 'answer'] },
    explanation: 'Angle-optimized embeddings are still ordinary production artifacts: vectors in an index, vectors in a retrieval pipeline, vectors in a reranker. The difference is the training geometry that shaped them.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'cosine saturation') yield* cosineSaturation();
  else if (view === 'complex angle loss') yield* complexAngleLoss();
  else throw new InputError('Pick an AnglE embedding view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'AnglE-optimized text embeddings come from the paper "AnglE-optimized Text Embeddings." The paper targets a quiet problem in semantic textual similarity: many embedding losses rely on cosine similarity, but cosine has saturation zones near very small and very large angles. When a pair is already close or already far, the cosine curve becomes flat, so gradient descent receives a weak signal even if the model still needs finer ordering.',
        'The proposed move is to optimize angular information in complex space. The model still produces sentence embeddings for semantic search, retrieval-augmented generation, clustering, duplicate detection, and reranking. What changes is the training geometry: instead of treating cosine as the whole story, the loss can use phase-like angular differences to reduce the vanishing-gradient problem.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Cosine similarity compares the angle between normalized vectors. That is useful and widely deployed, but the derivative of cosine is small near 0 degrees and 180 degrees. These are exactly the regions where many sentence-pair datasets have important examples: near duplicates that must be ranked above loose paraphrases, and obvious negatives that still need stable separation from hard negatives. AnglE reframes the objective around angle optimization so those pairwise distinctions remain trainable.',
        'The complex-space trick is a representation design. Split or arrange embedding coordinates into real and imaginary components, then compute angular relationships with functions such as atan2. This connects directly to Complex-Valued Neural Networks: complex numbers are not magic, but they make rotation and phase explicit. It also connects to Contrastive Learning: SimCLR because both systems shape representation geometry by pulling positives and pushing negatives.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'At inference time, the cost can remain similar to other sentence embedding models: encode text, store vectors, and search with cosine, dot product, or an approximate nearest-neighbor index. The extra complexity lives mostly in training and evaluation. You need pair labels, ranking objectives, negative sampling, and careful domain validation. If a retrieval system already uses HNSW or Product Quantization, an AnglE-style model can often be swapped in as the vector producer rather than changing the whole serving stack.',
        'The evaluation cost is not optional. Embedding improvements are easy to overclaim because different datasets reward different notions of similarity. Short sentence STS, long issue-matching, customer-support retrieval, legal chunk retrieval, and code search can all disagree. Data Leakage & Contamination also matters: near-duplicate questions across train and test can make any embedding model look stronger than it is.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Angle-optimized embeddings are relevant to semantic search, RAG chunk retrieval, duplicate issue detection, FAQ matching, passage reranking, clustering, recommendation features, and long-text similarity. The paper also emphasizes long-text STS and domain-specific settings with limited labeled data, which is exactly where plain cosine-trained models can feel plausible in demos but brittle in production.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not read this as "cosine similarity is bad." Cosine is still a useful inference metric and a common search primitive. The critique is about optimization: a saturated training objective can stop giving strong gradients in important regions. Another trap is treating a leaderboard embedding as universally better. Embeddings are local products of data, loss, pooling, tokenization, negative mining, and evaluation. Always inspect failures in the domain where the vectors will be used.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: AnglE-optimized Text Embeddings at https://arxiv.org/abs/2309.12871, the OpenReview page at https://openreview.net/forum?id=6tK0ayRF8H, and the project documentation at https://angle.readthedocs.io/. Study Embeddings & Similarity, Complex-Valued Neural Networks, Contrastive Learning: SimCLR, HNSW (Vector Search at Scale), Product Quantization for Vector Search, RAG Pipeline, and Calibration & Reliability Diagrams next.',
      ],
    },
  ],
};
