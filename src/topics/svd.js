// SVD: every matrix is secretly a stack of rank-1 layers, sorted by
// importance. Keep the loud layers, drop the quiet ones — computed live
// here by power iteration — and you get compression, PCA, and LoRA.

import { matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'svd',
  title: 'SVD & Low-Rank Approximation',
  category: 'AI & ML',
  summary: 'Any matrix = a stack of rank-1 layers sorted by loudness — keep a few, and you have compression, PCA, and LoRA.',
  controls: [
    { id: 'view', label: 'Decompose', type: 'select', options: ['compressing a picture, rank by rank', 'one decomposition, everywhere'], defaultValue: 'compressing a picture, rank by rank' },
  ],
  run,
};

// An 8×8 "image": a smooth wave plus a faint ramp plus speckle noise —
// visually rich, secretly low-rank.
const N = 8;
const IMAGE = Array.from({ length: N }, (_, i) =>
  Array.from({ length: N }, (_, j) =>
    4 * Math.sin(i * 0.4) * Math.sin(j * 0.4) + 2 * (i / 7) * (j / 7) + 0.15 * Math.cos(3 * i + 5 * j)),
);

// Live top-k SVD: power iteration + deflation (deterministic start vectors).
const matvec = (M, v) => M.map((r) => r.reduce((a, x, j) => a + x * v[j], 0));
const tmatvec = (M, v) => {
  const out = Array(M[0].length).fill(0);
  M.forEach((r, i) => r.forEach((x, j) => { out[j] += x * v[i]; }));
  return out;
};
const norm = (v) => Math.sqrt(v.reduce((a, x) => a + x * x, 0));
const fro = (M) => Math.sqrt(M.flat().reduce((a, x) => a + x * x, 0));

function topSingularTriplets(M, k) {
  let R = M.map((r) => [...r]);
  const trips = [];
  for (let t = 0; t < k; t++) {
    let v = Array.from({ length: N }, (_, i) => Math.cos(i + t + 1));
    for (let it = 0; it < 300; it++) {
      let u = matvec(R, v);
      u = u.map((x) => x / norm(u));
      v = tmatvec(R, u);
      v = v.map((x) => x / norm(v));
    }
    let u = matvec(R, v);
    const s = norm(u);
    u = u.map((x) => x / s);
    trips.push({ s, u, v });
    R = R.map((r, i) => r.map((x, j) => x - s * u[i] * v[j]));
  }
  return trips;
}
const TRIPS = topSingularTriplets(IMAGE, 4);
const reconstruct = (k) =>
  IMAGE.map((r, i) => r.map((_, j) => TRIPS.slice(0, k).reduce((a, t) => a + t.s * t.u[i] * t.v[j], 0)));
const captured = (k) => {
  const Rk = IMAGE.map((r, i) => r.map((x, j) => x - reconstruct(k)[i][j]));
  return 100 * (1 - fro(Rk) / fro(IMAGE));
};
const heat = (M, title) =>
  matrixState({
    title,
    rows: M.map((_, i) => ({ id: `r${i}`, label: '' })),
    columns: M[0].map((_, j) => ({ id: `c${j}`, label: '' })),
    values: M,
    format: () => '',
  });

function* compress() {
  yield {
    state: heat(IMAGE, 'The original: an 8×8 image, 64 numbers'),
    highlight: {},
    explanation: 'An 8×8 grayscale patch — a smooth wave, a brightening corner, a sprinkle of noise. Stored naively: 64 numbers. The question SVD answers better than anything else in linear algebra: how much of this picture is STRUCTURE, and how much is noise — and can we store just the structure? PCA: Principal Component Analysis asked this of a data cloud; SVD asks it of ANY matrix — an image, a user-ratings table, a weight matrix in a neural network. Same spirit, fully general.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'layer (rank index)' }, y: { label: 'singular value σ — the layer\'s loudness' } },
      series: [{ id: 'scree', label: 'σ spectrum', points: TRIPS.map((t, k) => ({ x: k + 1, y: t.s })) }],
      markers: [{ id: 'big', x: 1, y: TRIPS[0].s, label: `σ₁ = ${TRIPS[0].s.toFixed(1)}` }],
    }),
    highlight: { found: ['big'], active: ['scree'] },
    explanation: `The theorem: ANY matrix equals a stack of RANK-1 LAYERS — each layer an outer product σ·u·vᵀ (one column pattern times one row pattern, scaled by a loudness σ) — with the layers sorted loudest-first. This module just COMPUTED that decomposition live, by power iteration: repeatedly multiply a vector through the matrix and its transpose until it settles on the dominant direction, peel that layer off, repeat. The spectrum it found: σ = ${TRIPS.map((t) => t.s.toFixed(2)).join(', ')}. One thundering layer, three whispers — the picture's complexity was mostly an illusion.`,
    invariant: 'M = Σ σᵢ·uᵢ·vᵢᵀ with σ₁ ≥ σ₂ ≥ … — every matrix is rank-1 layers, sorted by importance.',
  };

  yield {
    state: heat(reconstruct(1), `Rank 1: just the loudest layer — ${captured(1).toFixed(1)}% of the image`),
    highlight: {},
    explanation: `Keep ONLY layer one: σ₁·u₁·v₁ᵀ — storage cost 8 + 8 + 1 = 17 numbers instead of 64, a 73% cut. And look at it: the wave and the bright corner are already there, because one column-pattern-times-row-pattern captures ${captured(1).toFixed(1)}% of the image's total energy (measured live, Frobenius norm). What is missing is exactly the speckle — the noise — because noise has no repeated structure for a rank-1 layer to exploit. Low-rank approximation is a NOISE FILTER wearing a compression costume.`,
  };

  yield {
    state: heat(reconstruct(2), `Rank 2: two layers — ${captured(2).toFixed(1)}%`),
    highlight: {},
    explanation: `Add the second layer: ${captured(2).toFixed(1)}% captured at 34 of 64 numbers. To the eye this is the original — and that subjective experience has a theorem under it (Eckart–Young, 1936): the rank-k SVD truncation is the BEST possible rank-k approximation of a matrix, period; no cleverer choice of k layers can beat it. This is JPEG's spiritual ancestor, the engine of classic image compression demos, and the reason "throw away small singular values" is a complete, optimal compression algorithm in one sentence.`,
    invariant: 'Eckart–Young: truncated SVD is the optimal rank-k approximation in both spectral and Frobenius norm.',
  };

  yield {
    state: matrixState({
      title: 'The compression ledger (computed live)',
      rows: [1, 2, 3, 4].map((k) => ({ id: `k${k}`, label: `rank ${k}` })),
      columns: [{ id: 'store', label: 'numbers stored' }, { id: 'cap', label: 'image captured' }],
      values: [1, 2, 3, 4].map((k) => [k * (N + N + 1), captured(k)]),
      format: (v) => (v >= 80 ? `${v.toFixed(1)}%` : String(v)),
    }),
    highlight: { found: ['k2:cap'], compare: ['k1:store', 'k4:store'] },
    explanation: 'The ledger, every number computed by this module. The pattern to internalize: captured-percentage CLIMBS STEEPLY then flattens — the knee of this curve is where you cut, exactly like the scree plot in PCA: Principal Component Analysis. In fact PCA IS this: run SVD on a mean-centered data matrix and the v-vectors are the principal components, the σ² the eigenvalue variances. One algorithm, two famous names — and a third name waits in the other view, wearing a fine-tuning costume.',
  };
}

function* everywhere() {
  yield {
    state: matrixState({
      title: 'The geometry: every matrix is rotate · stretch · rotate',
      rows: [{ id: 'u', label: 'U' }, { id: 's', label: 'Σ' }, { id: 'vt', label: 'Vᵀ' }],
      columns: [{ id: 'what', label: 'what it does' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'rotates the output axes into place', 'pure stretch: σ₁, σ₂, … along hidden axes', 'rotates input onto the hidden axes'][v],
    }),
    highlight: { active: ['s:what'] },
    explanation: 'The layer-stack story has an equivalent geometric one: M = UΣVᵀ says every linear transformation — EVERY one, however scrambled it looks — is secretly three simple moves: rotate (Vᵀ), stretch along perpendicular axes (Σ, the singular values), rotate again (U). Nothing a matrix does is more exotic than that. The σ values are the stretch factors — which is why the largest one governs Vanishing & Exploding Gradients (a layer\'s worst-case amplification IS its σ₁), and why a matrix with tiny σ values barely transmits signal at all.',
    invariant: 'M = UΣVᵀ: rotation, axis-aligned stretch, rotation — the anatomy of every linear map.',
  };

  yield {
    state: matrixState({
      title: 'LoRA: fine-tuning bets the UPDATE is low-rank',
      rows: [
        { id: 'full', label: 'full fine-tune ΔW (4096×4096)' },
        { id: 'lora', label: 'LoRA: ΔW = B·A, rank 8' },
      ],
      columns: [{ id: 'params', label: 'trainable numbers' }, { id: 'share', label: 'relative size' }],
      values: [[16777216, 100], [65536, 0.39]],
      format: (v) => (v > 1000 ? v.toLocaleString('en-US') : `${v}%`),
    }),
    highlight: { removed: ['full:params'], found: ['lora:params'] },
    explanation: 'The modern blockbuster application: LoRA Fine-Tuning. Adapting a pretrained LLM nominally means updating a 4096×4096 weight matrix — 16.8 million numbers per layer. LoRA\'s wager is pure SVD thinking: the CHANGE a fine-tune needs is low-rank (the model already knows language; the adaptation is a few new directions). So freeze W and learn ΔW = B·A where B is 4096×8 and A is 8×4096 — 65 thousand numbers, 0.4% of full — exactly a rank-8 layer stack. The wager keeps winning in practice, which tells you something deep: most of what changes when a model specializes fits in a handful of singular directions.',
  };

  yield {
    state: matrixState({
      title: 'The Netflix matrix: rank-1 layers as "tastes"',
      rows: [
        { id: 'alice', label: 'Alice' },
        { id: 'bob', label: 'Bob' },
        { id: 'eve', label: 'Eve' },
      ],
      columns: [{ id: 'm1', label: 'Alien' }, { id: 'm2', label: 'Titanic' }, { id: 'm3', label: 'Up' }, { id: 'm4', label: '?' }],
      values: [[5, 1, 2, 4.6], [1, 5, 4, 1.4], [4, 2, 2, 3.8]],
      format: (v) => (Number.isInteger(v) ? String(v) : `${v} ←predicted`),
    }),
    highlight: { found: ['alice:m4', 'bob:m4', 'eve:m4'] },
    explanation: 'And the application that made matrix factorization famous: RECOMMENDERS. The users×movies ratings matrix is mostly EMPTY — you have rated almost nothing — yet low-rank structure fills it in: if ratings ≈ a few layers, each layer is interpretable as a TASTE (layer 1: sci-fi affinity; layer 2: romance), each user a mix of tastes, each movie a profile. Factor the known cells, multiply back, and the gaps get predictions — the heart of the Netflix Prize era and still the backbone idea behind collaborative filtering. The same factor-and-fill move powers Latent Semantic Analysis (documents×words) — Embeddings & Similarity\'s grandparent.',
  };

  yield {
    state: matrixState({
      title: 'One decomposition, four costumes',
      rows: [
        { id: 'pcaRow', label: 'PCA' },
        { id: 'compressRow', label: 'image compression' },
        { id: 'loraRow', label: 'LoRA' },
        { id: 'recRow', label: 'recommenders' },
      ],
      columns: [{ id: 'matrix', label: 'the matrix' }, { id: 'layers', label: 'the layers mean' }],
      values: [[1, 2], [3, 4], [5, 6], [7, 8]],
      format: (v) => ['', 'centered data (samples×features)', 'directions of variance', 'pixel grid', 'visual structure vs noise', 'the fine-tune update ΔW', 'new skills as few directions', 'users × items', 'tastes'][v],
    }),
    highlight: { compare: ['pcaRow:layers', 'loraRow:layers'] },
    explanation: 'The wardrobe, assembled. Four fields, four vocabularies — components, compression, adapters, latent factors — one theorem underneath: sort the matrix\'s energy into orthogonal rank-1 layers and most real-world matrices turn out to be a few loud layers plus noise. That empirical fact (call it the low-rank hypothesis about the world) is why a 1936 theorem keeps headlining 2020s machine learning. When you meet your next matrix — of data, weights, ratings, pixels — the first question to ask it is the one this page asks: how many layers are you, really?',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'compressing a picture, rank by rank') yield* compress();
  else if (view === 'one decomposition, everywhere') yield* everywhere();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Matrices get large before they get mysterious. An image patch has pixel intensities. A recommender has users by items. A neural network has weight matrices. Storing every entry is easy, but it does not tell you which variation is structure and which variation is noise.',
        'SVD answers the compression question and the geometry question at the same time: how many independent directions does this matrix really use, and how much error do we pay if we keep only the largest ones?',
        'That makes SVD a bridge topic. It is linear algebra, but it explains PCA, recommender systems, latent semantic analysis, image compression, low-rank adaptation, denoising, conditioning, and the geometry of neural-network layers.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The obvious approach is to store the whole matrix, or to throw away small-looking entries. For images, that means keeping pixels. For user ratings, it means keeping observed cells. For a model update, it means training every weight.',
        'The wall is correlation. A smooth image does not need every pixel independently. User tastes are not independent item by item. A fine-tune update may move weights along a few shared directions. Entry-level pruning misses structure that lives in rows and columns together.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'SVD writes a matrix as M = U Sigma V^T. One reading is geometric: rotate the input axes, stretch along perpendicular hidden axes, then rotate into output space. Another reading is additive: M is a sum of rank-1 layers sigma_i u_i v_i^T.',
        'The singular values sigma_i are sorted from largest to smallest. Large values are loud directions. Small values are quiet directions. Low-rank approximation keeps the first k layers and drops the rest.',
        'The decomposition works for any real matrix, not only square matrices. That is why it appears wherever data has rows and columns but no clean eigenvalue story. It finds orthogonal input directions, orthogonal output directions, and a nonnegative stretch for each paired direction.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each layer, SVD finds a right pattern v, a left pattern u, and a strength sigma. The outer product u v^T creates a full matrix with one reusable row-column pattern. Scaling by sigma says how much that pattern contributes.',
        'The visualization computes the top layers by power iteration and deflation. It repeatedly multiplies by the matrix and its transpose until the dominant direction stabilizes, subtracts that rank-1 layer from the residual, and repeats on what remains.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The singular vectors are orthogonal directions of action. Because each layer points in a direction independent of the others, the energy of the approximation is accounted for cleanly by the singular values.',
        'Eckart-Young is the key theorem: keeping the first k singular layers gives the best possible rank-k approximation under the standard spectral and Frobenius norms. If you are only allowed k layers, no different choice of k rank-1 layers can beat the truncated SVD.',
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        'In the compression view, read each heatmap as a reconstruction, not a new image. Rank 1 keeps the strongest row-pattern times column-pattern layer. Rank 2 adds the next independent pattern. The ledger shows the storage cost and the recovered matrix energy.',
        'In the applications view, watch the same decomposition change vocabulary. PCA calls the layers components. Image compression calls them visual structure. LoRA calls them adapter directions. Recommenders call them latent tastes. The data changes; the low-rank bet is the same.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'The page starts with an 8 by 8 patch, so the raw matrix stores 64 numbers. A rank-1 reconstruction stores one left vector, one right vector, and one singular value: 8 + 8 + 1 = 17 numbers. Rank 2 stores 34 numbers and usually looks much closer because it adds another independent pattern.',
        'The LoRA example uses the same arithmetic at model scale. A full 4096 by 4096 update has 16,777,216 trainable numbers. A rank-8 update written as B A has 4096 * 8 + 8 * 4096 = 65,536 trainable numbers. That is the low-rank assumption turned into a training budget.',
        'The recommender example has the same shape with different names. A user vector says how strongly a person expresses latent tastes. An item vector says how strongly a movie expresses those tastes. Their dot product fills in an unknown rating. SVD-style factorization turns a sparse table into a geometry problem.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'A full dense SVD costs O(m n min(m,n)), which is too much for many large matrices. Top-k iterative or randomized methods can be far cheaper because they only need the largest directions and can exploit sparse or structured matrix-vector multiplies.',
        'A rank-k approximation stores about k(m + n + 1) numbers instead of m n. That is a win only when k is small relative to both dimensions and the singular spectrum decays. If the spectrum is flat, every direction matters and truncation becomes lossy fast.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SVD wins when the matrix has repeated structure: images with smooth regions, centered data with dominant variance directions, user-item ratings with latent tastes, document-term matrices with topics, and neural-network updates that can be expressed in a few directions.',
        'It is not the right tool when interpretability requires nonnegative parts, when missing data is not handled by the chosen objective, when the matrix is too dynamic to refactor, or when the useful signal is spread evenly across many singular directions.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not read singular vectors as unique semantic labels. Their signs can flip, nearby equal singular values can rotate within a subspace, and preprocessing can change the spectrum. Centering, scaling, weighting, and missing-value treatment are not cosmetic choices.',
        'Do not confuse optimal rank-k approximation with truth. Truncated SVD gives the best low-rank matrix under a norm, not a guarantee that the dropped directions are noise. Small singular directions can still contain rare but important signal.',
        'Do not apply dense SVD blindly to sparse recommendation data with missing entries. Missing means unknown, not zero. Matrix completion and weighted objectives exist because treating blanks as real zeros changes the problem.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'For small dense matrices, use a library routine and inspect the singular spectrum. For large sparse matrices, use truncated, iterative, or randomized methods that only compute the top k directions. For streaming or frequently changing matrices, consider incremental or sketching methods rather than recomputing from scratch.',
        'Choose k from the task, not only from a pretty scree plot. Compression may tolerate visible error. Search ranking may care about rare directions. A neural-network adapter may need validation loss. The singular spectrum is evidence, not the whole decision.',
        'Always record preprocessing. Centered versus uncentered data, normalized rows, missing-value handling, and weighting can change the singular vectors enough to change conclusions. Two SVD results are only comparable if the matrix construction was the same.',
      ],
    },
    {
      heading: 'Worked example (2)',
      paragraphs: [
        'In latent semantic analysis, rows can be documents and columns can be terms. Raw word counts are noisy and sparse. A low-rank SVD keeps broad co-occurrence directions, so documents can be compared by latent topics rather than exact word overlap.',
        'That helps search find related language, but it also loses detail. Rare terms, negation, and domain-specific phrases may sit in smaller directions. The right rank depends on retrieval quality, not just compression ratio.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study next by role: PCA for centered data and variance directions, Eigenvectors for the square-matrix skeleton, Matrix Completion for sparse low-rank prediction, LoRA for low-rank neural-network updates, Quantization for another compression axis, and Embeddings Similarity for latent vector geometry.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why SVD & Low-Rank Approximation moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};
