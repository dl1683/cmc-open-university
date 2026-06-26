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
  const nearAngle = 10;
  const farAngle = 170;
  yield {
    state: plotState({
      axes: { x: { label: 'angle between vectors (deg)', min: 0, max: 180 }, y: { label: 'cosine value', min: -1.05, max: 1.05 } },
      series: [
        { id: 'cos', label: 'cos(angle)', points: cosinePoints() },
      ],
      markers: [
        { id: 'near', x: nearAngle, y: 0.98, label: 'near duplicate' },
        { id: 'far', x: farAngle, y: -0.98, label: 'obvious negative' },
      ],
    }),
    highlight: { active: ['cos'], compare: ['near', 'far'] },
    explanation: `Cosine similarity is the standard metric for sentence embeddings, but the curve flattens near ${nearAngle} deg and ${farAngle} deg. The pairs that are already very similar or very different can produce weak learning signal even when their ordering still matters.`,
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
    explanation: `The derivative is strongest around ${90} deg where |sin| = ${Math.sin(90 * Math.PI / 180).toFixed(1)} and tiny near the saturation zones. AnglE targets that weakness: optimize angular information more directly instead of asking cosine to carry the entire training objective.`,
    invariant: `If the metric saturates, gradient descent gets quiet exactly where ranking can still be useful — |sin(${5}°)| is only ${Math.sin(5 * Math.PI / 180).toFixed(2)}.`,
  };

  const pairTypes = [
    { id: 'dup', label: 'duplicate issue' },
    { id: 'same', label: 'same intent' },
    { id: 'near', label: 'near topic' },
    { id: 'neg', label: 'unrelated' },
  ];
  yield {
    state: labelMatrix(
      'Semantic pair pressure',
      pairTypes,
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
    explanation: `Semantic textual similarity is not just binary match/no-match. Good embeddings must order ${pairTypes.length} levels — ${pairTypes.map(p => p.label).join(', ')}. The saturation problem hides exactly in those fine distinctions.`,
  };

  const pipelineStages = ['split', 'angle'];
  yield {
    state: embeddingPipeline('AnglE keeps the familiar embedding pipeline but changes the geometry of the loss'),
    highlight: { active: pipelineStages, found: ['rank'] },
    explanation: `AnglE keeps the production-friendly recipe — encode text, produce vectors, compare pairs — but introduces ${pipelineStages[1]} optimization via complex ${pipelineStages[0]}. The result is still an embedding model you can use for retrieval, clustering, and reranking.`,
  };
}

function* complexAngleLoss() {
  const vectors = [
    { id: 'q', from: { x: 0, y: 0 }, to: { x: 0.92, y: 0.39 }, label: 'query' },
    { id: 'p', from: { x: 0, y: 0 }, to: { x: 0.76, y: 0.65 }, label: 'positive' },
    { id: 'n', from: { x: 0, y: 0 }, to: { x: -0.5, y: 0.87 }, label: 'negative' },
  ];
  yield {
    state: plotState({
      axes: { x: { label: 'real axis', min: -1.2, max: 1.2 }, y: { label: 'imag axis', min: -1.2, max: 1.2 } },
      series: [
        { id: 'unit', label: 'unit circle', points: [
          { x: 1.0, y: 0.0 }, { x: 0.71, y: 0.71 }, { x: 0.0, y: 1.0 }, { x: -0.71, y: 0.71 },
          { x: -1.0, y: 0.0 }, { x: -0.71, y: -0.71 }, { x: 0.0, y: -1.0 }, { x: 0.71, y: -0.71 }, { x: 1.0, y: 0.0 },
        ] },
      ],
      vectors,
    }),
    highlight: { active: ['q', 'p'], compare: ['n'] },
    explanation: `A complex representation makes angle a first-class object. The ${vectors[1].label} text should occupy a nearby phase direction to the ${vectors[0].label}; the ${vectors[2].label} should land farther around the circle.`,
  };

  const complexParts = [
    { id: 'dims', label: 'embedding dims' },
    { id: 'real', label: 'real part' },
    { id: 'imag', label: 'imag part' },
    { id: 'phase', label: 'phase' },
  ];
  yield {
    state: labelMatrix(
      'Complex split of a sentence vector',
      complexParts,
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
    explanation: `The ${complexParts[1].label} and ${complexParts[2].label} halves form complex coordinates. That does not make the encoder mystical; it gives the loss a cleaner way to talk about angular relations between sentence representations.`,
    invariant: `Complex coordinates expose ${complexParts[3].label}; ${complexParts[3].label} exposes angular order.`,
  };

  const auditRows = [
    { id: 'source', label: 'pair label' },
    { id: 'metric', label: 'metric' },
    { id: 'loss', label: 'loss' },
    { id: 'eval', label: 'eval' },
  ];
  yield {
    state: labelMatrix(
      'Training objective audit',
      auditRows,
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
    explanation: `The important lesson is not only the specific paper. Embedding quality is created by the alignment between ${auditRows.map(r => r.label).join(', ')}. A better ${auditRows[1].label} can fail if the data or ${auditRows[3].label} target is wrong.`,
  };

  const downstreamNodes = ['hnsw', 'rank', 'answer'];
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
    highlight: { active: ['embed'], found: downstreamNodes },
    explanation: `Angle-optimized embeddings are still ordinary production artifacts: vectors in an ${downstreamNodes[0].toUpperCase()} index, vectors in a retrieval pipeline, vectors in a ${downstreamNodes[1]}er. The difference is the training geometry that shaped them.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. "Cosine saturation" plots the cosine curve and its gradient, marking the flat zones where training signal dies. "Complex angle loss" shows how AnglE splits embeddings into real and imaginary halves and uses phase angles to keep the loss informative. Step through each frame and read the explanation text below it before advancing.',
        {type: 'image', src: './assets/gifs/angle-optimized-text-embeddings.gif', alt: 'Animated walkthrough of the angle optimized text embeddings visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Orange highlights mark the active operation. Green marks a result or target. When two markers appear on a curve, compare their vertical positions to see how much gradient the loss actually gets at those angles.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sentence embedding models turn text into vectors, and everything downstream --- retrieval, clustering, duplicate detection, RAG --- compares those vectors with cosine similarity. The quality of the embedding depends on how well the training loss shaped the geometry. If the loss gives weak signal in exactly the regions where fine ranking distinctions matter, the model stops learning before it should.',
        'AnglE (Li and Li, 2023) identifies a specific geometric failure: cosine similarity saturates. The cosine curve is nearly flat near 0 degrees and near 180 degrees. That means gradient-based training gets almost no signal for pairs that are already very similar or very dissimilar, even when their relative ordering still matters for production retrieval.',
        {type: 'callout', text: 'AnglE shows that embedding quality depends on loss geometry, not just encoder size or vector dimension.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The standard recipe is straightforward. Take a pretrained transformer (BERT, RoBERTa, or an LLM backbone), pool its token representations into one vector per sentence, and train on labeled pairs using cosine-similarity-based loss. Positives get pulled together, negatives get pushed apart. Evaluate on STS benchmarks, ship the model, move on.',
        'This works well enough that most teams never question the loss geometry. Cosine is fast, normalized, compatible with every vector index, and produces a bounded score between -1 and 1. The failure is subtle: cosine does not supply equally strong training signal everywhere on the angular spectrum.',
        {type: 'image', src: 'https://arxiv.org/html/2309.12871/x1.png', alt: 'AnglE paper figure showing cosine saturation zones.', caption: 'Cosine saturation weakens learning signal near the close and far ends of angular space. (Source: arxiv.org)'},
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The derivative of cos(theta) is -sin(theta). At 5 degrees, |sin(5)| = 0.087. At 175 degrees, |sin(175)| = 0.087. At 90 degrees, |sin(90)| = 1.0. The gradient is 11.5x weaker at the extremes than in the middle. Training pairs that sit in those flat zones get almost no push from the loss, so the model cannot learn the fine ordering that separates a near-duplicate from a loose paraphrase, or a hard negative from an obvious one.',
        'You can throw more data at this, or use a bigger encoder, but neither removes the geometric constraint. The cosine function is still flat at the ends. Contrastive losses, triplet losses, and InfoNCE all inherit this saturation because they all pass through cosine at some point. The wall is in the metric, not in the model or the data.',
        'A second wall is evaluation. Average STS scores hide domain-specific failure. A model that ranks short paraphrases well may completely fail on long legal documents or code search. The saturation problem compounds with domain shift because the model never learned fine distinctions in the saturated zones during training.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat angle as a first-class optimization target instead of routing everything through cosine. AnglE does this by interpreting the embedding vector as a complex number: split the d-dimensional vector in half, call the first half the real part and the second half the imaginary part. Now you can compute phase angles using atan2, and the loss can directly penalize angular differences between sentence pairs.',
        {type: 'image', src: 'https://arxiv.org/html/2309.12871/x2.png', alt: 'AnglE paper figure illustrating angle optimization in complex space.', caption: 'AnglE uses complex-space angle information to shape embedding geometry during training. (Source: arxiv.org)'},
        'The complex-space framing is not mystical. It is a coordinate trick that gives the loss access to angular information with better-behaved gradients. The atan2 function does not saturate the way cosine does, so the training signal stays informative even when pairs are nearly aligned or nearly opposite. The model still outputs ordinary real-valued vectors at inference time --- nothing changes about the serving stack.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Training takes labeled sentence pairs (from STS datasets, duplicate corpora, mined positives, or teacher-model annotations). Each sentence passes through the encoder to produce a d-dimensional vector. The vector is split into two d/2 halves: the real part r and the imaginary part i. For each pair, the loss computes per-dimension phase differences using atan2(i, r) and aggregates them into an angular divergence score.',
        'The total loss combines this angle-aware term with standard objectives (cosine or contrastive) so the model still gets the benefits of the familiar recipe in the well-behaved middle range, plus direct angular supervision in the saturation zones. The weighting between terms is a hyperparameter. The encoder architecture is unchanged --- BERT, LLaMA, or any pooled transformer works.',
        'At inference time, nothing changes. Encode the query, encode the documents, store vectors in HNSW or any ANN index, retrieve by cosine or dot product. The complex split only exists during training. The deployed model is a standard embedding model that produces real-valued vectors.',
        'Evaluation should go beyond average STS. Slice metrics by pair difficulty: near-duplicates, loose paraphrases, hard negatives, domain-shifted queries. The whole point of angle optimization is to improve the tails, so average scores can hide the gain.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because the bottleneck was the loss geometry, not the model capacity. In the saturation zones, cosine-based losses produce gradients too small to move the parameters meaningfully. Angle optimization bypasses that bottleneck by computing phase differences directly. The atan2 function has well-distributed gradients across the full angular range, so training signal persists where cosine goes quiet.',
        'Retrieval is rank-sensitive, not value-sensitive. Users do not care whether the similarity score is 0.93 or 0.95; they care whether the right document appears above the wrong one. Fine angular distinctions in the near-duplicate and hard-negative zones are exactly what separates a good retrieval system from a mediocre one. Angle optimization targets those distinctions.',
        'The method amplifies supervision but does not replace it. If your labels are noisy, your negatives are random, or your train/test split leaks near-duplicates, angle optimization will confidently learn the wrong ordering. The geometry helps when the data is honest.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Inference cost is identical to any other embedding model of the same encoder size. The complex split only applies during training, so the forward pass at serving time is unchanged. Storage is still d floats per document. Query latency is still dominated by encoding plus ANN search.',
        'Training cost increases modestly. The angle loss adds a per-dimension atan2 computation and a second loss term, but these are cheap relative to the transformer forward/backward pass. The real extra cost is in evaluation: you need slice-level metrics across pair difficulties and domains to see whether angle optimization actually helped where it should.',
        'Debugging cost goes up. When retrieval quality changes after swapping models, the cause could be the angle loss, the encoder, the data, the pooling strategy, the tokenizer, the normalization, or the index approximation. Without controlled ablations, "better embeddings" is an untestable claim.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Semantic search where near-duplicate ranking matters: support ticket routing, issue deduplication, FAQ matching, code search. The saturation fix helps most when the retrieval task requires distinguishing between items that are all fairly similar (e.g., many related bug reports) rather than separating obviously different categories.',
        'RAG pipelines benefit when the embedding model retrieves the chunk that actually answers the question instead of a chunk that merely shares keywords. AnglE-style training also fits domain adaptation with limited labels, since the angle loss extracts more signal per training pair. The paper shows strong results on STS benchmarks and MTEB, especially in limited-data and long-text settings.',
        'In every case, the embedding is a candidate generator. It should be paired with a reranker, authorization filters, freshness logic, and answer verification. Better embedding geometry does not remove the need for the rest of the retrieval stack.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Angle optimization does not fix bad data. If your positives are only weakly related or your negatives are mislabeled, a sharper loss sharpens the wrong boundary. The model will confidently separate things that should not be separated.',
        'Domain shift remains unsolved. A model trained on short English paraphrase pairs will not magically handle long legal documents, multilingual queries, or code. The angular geometry only helps within the distribution the model was trained on. Cross-domain transfer still requires domain-specific pairs or a teacher model that covers the target domain.',
        'Cosine similarity is not broken at inference time. AnglE does not argue against using cosine for retrieval --- it argues against relying on cosine-shaped gradients during training. The distinction matters: teams sometimes over-rotate and replace their entire similarity pipeline when the fix is only in the training loss.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider three sentence pairs during training. Pair A (near-duplicate): angle = 5 degrees, cos(5) = 0.9962. Pair B (medium similarity): angle = 60 degrees, cos(60) = 0.5000. Pair C (hard negative): angle = 170 degrees, cos(170) = -0.9848. The cosine values look spread out, but the gradients tell a different story.',
        'The gradient magnitude |sin(theta)| for each pair: Pair A gets |sin(5)| = 0.0872. Pair B gets |sin(60)| = 0.8660. Pair C gets |sin(170)| = 0.1736. Pair B receives 9.9x more gradient than Pair A and 5.0x more than Pair C. The loss is nearly silent on the near-duplicate and the hard negative --- exactly the pairs where ranking precision matters most.',
        'Now suppose the model needs to distinguish Pair A (true duplicate, should be rank 1) from another pair at 8 degrees (close paraphrase, should be rank 2). The cosine difference is cos(5) - cos(8) = 0.9962 - 0.9903 = 0.0059. The gradient for both is below 0.14. The model can barely see the distinction and has almost no force to fix it. With angle optimization, the loss works with the angular difference directly (3 degrees of phase gap), bypassing the flat cosine curve entirely.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The primary source is "AnglE-optimized Text Embeddings" by Xianming Li and Jing Li (2023), arXiv:2309.12871. For background, study Embeddings and Similarity to understand the vector space, then Contrastive Learning for the standard loss landscape. HNSW and Product Quantization cover the index side of the retrieval stack.',
        'For related ideas, look at Hard Negative Mining (how training pairs affect geometry), RAG Pipeline (where embeddings plug into generation), and Calibration and Reliability Diagrams (how to evaluate whether similarity scores mean what you think they mean). The deeper lesson is that embedding quality is not just about the encoder --- it is about the alignment between data, loss geometry, and the retrieval task the vectors will serve.',
      ],
    },
  ],
};
