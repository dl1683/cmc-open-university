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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/angle-optimized-text-embeddings.gif', alt: 'Animated walkthrough of the angle optimized text embeddings visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this topic exists',
      paragraphs: [
        `AnglE-optimized text embeddings exist because vector search depends on geometry. A sentence embedding model turns text into a vector, and downstream systems compare vectors to retrieve documents, cluster issues, detect duplicates, route support tickets, or feed a RAG pipeline. If the training loss shapes that geometry poorly, the retrieval system can look good in a demo and fail on the distinctions users actually care about.`,
        `The specific problem is cosine saturation. Cosine similarity is the standard comparison for normalized embeddings. It is simple, fast, and compatible with many vector indexes. But the cosine curve is flat near very small angles and very large angles. That means the gradient can become weak when two vectors are already close or already far. Those zones still matter. A duplicate should outrank a loose paraphrase. A hard negative should be separated from an obvious negative. AnglE asks whether the loss can optimize angular relationships more directly.`,
        {type: 'callout', text: 'AnglE shows that embedding quality depends on loss geometry, not just encoder size or vector dimension.'},
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        `The naive embedding recipe is familiar. Choose a transformer encoder, pool its token states into one vector, train on sentence-pair labels, and use cosine similarity at inference time. Positives are pulled together. Negatives are pushed apart. Then the model is evaluated on semantic textual similarity or retrieval benchmarks. This baseline works well enough that many teams stop there.`,
        `The failure is not that cosine is useless. The failure is treating cosine as if it supplies equally strong training signal everywhere. The derivative of cosine with respect to angle is largest near 90 degrees and small near 0 and 180 degrees. When training examples live near those ends, the loss can become quiet exactly when the model still needs ordering precision. More data or a larger encoder can help, but they do not remove the geometric issue.`,
        {type: 'image', src: 'https://arxiv.org/html/2309.12871/x1.png', alt: 'AnglE paper figure showing cosine saturation zones.', caption: 'Cosine saturation weakens learning signal near the close and far ends of angular space. (Source: arxiv.org)'},
        `A second naive move is to judge embeddings only by an average benchmark score. That hides domain failure. A model that ranks short paraphrases well may retrieve the wrong long issue thread. A model that works for FAQ search may fail on legal chunks, code search, or customer-specific vocabulary. The geometry must be evaluated where it will be used.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to optimize angle as a first-class training object. AnglE introduces angle optimization in a complex space so the loss can work with phase-like differences rather than relying only on the raw cosine curve. The model still produces ordinary text embeddings that can be searched, clustered, or reranked. The change is in how training pressures the representation.`,
        `Complex space is a practical representation trick, not mysticism. Coordinates can be arranged into real and imaginary parts. That lets the loss compute angular relationships with phase information. If two pieces of text should be semantically close, their angular relationship should move in one direction. If they should be far, it should move in another. The goal is to keep the learning signal useful in regions where cosine alone can saturate.`,
        {type: 'image', src: 'https://arxiv.org/html/2309.12871/x2.png', alt: 'AnglE paper figure illustrating angle optimization in complex space.', caption: 'AnglE uses complex-space angle information to shape embedding geometry during training. (Source: arxiv.org)'},
        `This also reframes embedding work as metric design. An embedding is not good because it is a vector. It is good when the training data, loss geometry, negative sampling, pooling method, index metric, and evaluation task all line up. AnglE teaches that a small change in geometric objective can change how the whole retrieval stack behaves.`,
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        `Training starts with text pairs and similarity supervision. The pairs may come from semantic textual similarity datasets, duplicate questions, issue links, search clicks, mined positives, hard negatives, or labels generated by a stronger model. The encoder maps each text into a dense vector. The loss compares paired vectors and updates the encoder so the geometry better matches the labels.`,
        `In an AnglE-style setup, the vector representation is split or interpreted so angular differences in complex space can be computed. The loss can then penalize poor angular ordering. The exact model family can vary: BERT-like encoders, LLM-based embedding models, supervised fine-tuning, or limited-data domain adaptation. The important system boundary is that the trained artifact is still an embedding model. It emits vectors.`,
        `At inference time the pipeline is familiar. Encode documents or chunks, store vectors in an index, encode the query, retrieve nearest neighbors with cosine or dot product, and optionally rerank. If the index uses HNSW, product quantization, or a vector database, the AnglE model is usually the producer of vectors rather than a replacement for the index. The serving stack can remain stable while the training geometry improves.`,
        `A serious deployment also logs retrieval outcomes. Which queries failed? Were the negatives genuinely unrelated or merely unlabeled positives? Did the model confuse lexical overlap with semantic match? Did long texts get pooled badly? Embedding quality is measured by downstream retrieval behavior, not by the elegance of the loss function alone.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `It works when the old bottleneck was the loss geometry. If cosine-based optimization gives weak gradients in saturation zones, an angular objective can keep pushing examples that still need ordering. That is useful in semantic similarity because the extremes contain many important cases: near duplicates, exact paraphrases, unrelated negatives, and hard negatives that should not collapse together.`,
        `It also works because retrieval is rank-sensitive. The user rarely cares about the absolute similarity value. The user cares whether the right document appears above the wrong document. A training objective that preserves fine angular distinctions can improve rank ordering even when the inference metric is still a standard vector comparison.`,
        `The method does not remove the need for good data. It amplifies the signal the data provides. If labels are noisy, negatives are weak, or the train/test split leaks near duplicates, angle optimization can optimize the wrong ordering with confidence. The geometry helps when supervision is aligned with the retrieval task.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The cosine plot proves the saturation problem. Near 0 degrees, cosine is close to 1 and changes slowly. Near 180 degrees, cosine is close to -1 and also changes slowly. The gradient plot shows why that matters for learning: the objective is loud in the middle and quiet at the ends. AnglE targets the quiet zones.`,
        `The complex-angle visual proves that the model is still doing ordinary representation learning. Text goes into an encoder. Vectors come out. The complex split simply makes phase and angular order available to the loss. The retrieval visual proves the production contract: after training, vectors still feed semantic search, RAG retrieval, approximate nearest-neighbor indexes, clustering, and rerankers.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The inference cost is usually similar to other embedding models of the same encoder size. The expensive step is still encoding text. Storage cost is still vector dimension times corpus size. Query cost is still dominated by encoding the query and searching the index. That makes AnglE attractive when a team can improve quality without changing the serving architecture.`,
        `The extra cost lives in training and evaluation. You need representative pairs, negatives that teach the right boundaries, and slice-level metrics. Short text, long text, code, legal documents, support tickets, and issue threads can all reward different geometry. A single STS score is not enough for a production RAG system.`,
        `There is also a complexity cost in explaining results. If a retrieval result changes after swapping embedding models, the reason may be the angle loss, the encoder, the data, the pooling, the tokenizer, the normalization, or the index approximation. Teams need ablations and failure review. Without them, "better embeddings" becomes a vague label for a stack of changes.`,
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        `Angle-optimized embeddings fit semantic search, duplicate detection, question matching, issue linking, support-ticket routing, RAG chunk retrieval, clustering, recommendation features, and passage reranking. The AnglE paper is especially relevant to semantic textual similarity, long-text similarity, domain-specific settings with limited labels, and cases where LLM-generated labels are used to expand supervision.`,
        `In RAG, the model can help retrieve the chunk that actually answers the question instead of a chunk that merely shares words. In developer tools, it can find related bug reports or GitHub issues. In enterprise search, it can improve recall for paraphrased internal questions. In each case, the embedding is a candidate generator. It should be paired with authorization filters, freshness checks, and often a reranker or answer verifier.`,
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        `The first failure mode is overclaiming. AnglE does not prove that cosine similarity is bad. Cosine remains a useful inference metric and a common ANN primitive. The critique is about relying on cosine-shaped optimization where the gradient saturates. A model can use angle-aware training and still be served with familiar vector comparisons.`,
        `The second failure mode is domain shift. A model trained on short paraphrase datasets may not solve long legal retrieval. A model tuned on GitHub issues may not solve medical search. The third is label noise. If positives are only weakly related or negatives are mislabeled, a sharper objective can sharpen the wrong boundary. The fourth is leakage: near duplicates across train and test can make embeddings look stronger than they are.`,
        `The fifth limit is that embeddings are not truth. A high-similarity neighbor is a retrieval candidate, not an answer. The downstream system still needs source ranking, deduplication, permissions, prompt-injection defenses, citation checks, and user-visible uncertainty where appropriate.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Embeddings and Similarity first, then Contrastive Learning, Complex-Valued Neural Networks, HNSW, Product Quantization for Vector Search, RAG Pipeline, Calibration and Reliability Diagrams, Data Leakage and Contamination, and Hard Negative Mining. The goal is to connect loss geometry to the retrieval system that consumes the vectors.`,
        `For practice, train or evaluate two embedding models on the same corpus. Keep the index, chunking, and reranker fixed. Compare duplicate queries, loose paraphrases, hard negatives, and long-text matches separately. The lesson is not that one metric always wins. The lesson is that the embedding objective creates the geometry your product has to live with.`,
      ],
    },
  ],
};
