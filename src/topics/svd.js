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
      heading: `What it is`,
      paragraphs: [
        `SVD decomposes any matrix into rank-1 layers sorted by loudness. The visualization builds an 8 by 8 image from a smooth wave, a ramp, and tiny speckle noise, then computes four singular triplets by power iteration and deflation. The singular values fall sharply: one large layer and a few small ones. Keeping the loud layers compresses the image and filters noise at the same time.`,
        `SVD & Low-Rank Approximation is the general matrix companion to PCA: Principal Component Analysis. PCA asks for variance directions in centered data; SVD asks how many structured layers any matrix really has.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The factorization is M = U Sigma V^T. V^T rotates inputs onto hidden axes, Sigma stretches by singular values, and U rotates outputs. Equivalently, M is a sum of sigma_i u_i v_i^T rank-1 layers. The code finds the top layer, subtracts it from the residual matrix, then repeats. This mirrors Eigenvalues & Eigenvectors because singular vectors are eigenvectors of M^T M and MM^T, but SVD works for rectangular matrices too.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Full dense SVD costs O(m n min(m,n)). Top-k iterative methods cost roughly O(k times iterations times the matrix-vector cost), which is far cheaper for sparse or structured matrices. In the page, rank 1 stores 17 numbers instead of 64 and captures about 92% by the displayed Frobenius-norm score; rank 2 stores 34 and captures about 96%. Eckart-Young says no other rank-k matrix beats truncated SVD under the standard norms.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Image compression keeps large singular values and drops tiny ones. Matrix Completion & Recommenders factors user-item tables into taste directions. LoRA Fine-Tuning assumes the update to a huge weight matrix is low-rank: a 4096 by 4096 update can become two thin rank-8 factors. Embeddings & Similarity has roots in the same latent-factor idea, and Quantization often stacks with low-rank compression.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `A singular value is not an eigenvalue, although squared singular values are eigenvalues of M^T M. Truncation is lossy even when it looks excellent: rank 1 keeps about 92%, not discards 92%. Singular values scale if you scale the matrix, so compare spectra only under consistent preprocessing. A flat spectrum means there is no clean low-rank cutoff. Vanishing & Exploding Gradients depends on the top singular value because it measures worst-case amplification through a layer.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study PCA: Principal Component Analysis for centered data, Eigenvalues & Eigenvectors for the square-matrix skeleton, and Matrix Completion & Recommenders for sparse low-rank prediction. Then connect the same spectral decay to LoRA Fine-Tuning, Quantization, Embeddings & Similarity, and The Hessian: Curvature & Newton's Step.`,
      ],
    },
  ],
};
