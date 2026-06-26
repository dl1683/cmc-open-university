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
      axes: { x: { label: 'layer (rank index)' }, y: { label: 'singular value σ — layer loudness' } },
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
    explanation: 'The layer-stack story has an equivalent geometric one: M = UΣVᵀ says every linear transformation — EVERY one, however scrambled it looks — is secretly three simple moves: rotate (Vᵀ), stretch along perpendicular axes (Σ, the singular values), rotate again (U). Nothing a matrix does is more exotic than that. The σ values are the stretch factors — which is why the largest one governs Vanishing & Exploding Gradients (the worst-case amplification of a layer IS its σ₁), and why a matrix with tiny σ values barely transmits signal at all.',
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
    explanation: 'The modern blockbuster application: LoRA Fine-Tuning. Adapting a pretrained LLM nominally means updating a 4096×4096 weight matrix — 16.8 million numbers per layer. The LoRA wager is pure SVD thinking: the CHANGE a fine-tune needs is low-rank (the model already knows language; the adaptation is a few new directions). So freeze W and learn ΔW = B·A where B is 4096×8 and A is 8×4096 — 65 thousand numbers, 0.4% of full — exactly a rank-8 layer stack. The wager keeps winning in practice, which tells you something deep: most of what changes when a model specializes fits in a handful of singular directions.',
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
    explanation: 'And the application that made matrix factorization famous: RECOMMENDERS. The users×movies ratings matrix is mostly EMPTY — you have rated almost nothing — yet low-rank structure fills it in: if ratings ≈ a few layers, each layer is interpretable as a TASTE (layer 1: sci-fi affinity; layer 2: romance), each user a mix of tastes, each movie a profile. Factor the known cells, multiply back, and the gaps get predictions — the heart of the Netflix Prize era and still the backbone idea behind collaborative filtering. The same factor-and-fill move powers Latent Semantic Analysis (documents×words) — the grandparent of Embeddings & Similarity.',
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
    explanation: 'The wardrobe, assembled. Four fields, four vocabularies — components, compression, adapters, latent factors — one theorem underneath: sort the energy in a matrix into orthogonal rank-1 layers and most real-world matrices turn out to be a few loud layers plus noise. That empirical fact (call it the low-rank hypothesis about the world) is why a 1936 theorem keeps headlining 2020s machine learning. When you meet your next matrix — of data, weights, ratings, pixels — the first question to ask it is the one this page asks: how many layers are you, really?',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each heatmap as a matrix reconstruction. A matrix is a rectangular table of numbers, and rank is the number of independent row-column directions needed to build it. The animation adds one rank-1 layer at a time, so each frame shows what the next independent pattern contributes.',
        { type: 'callout', text: 'SVD turns one matrix into ordered rank-1 energy, so compression is a controlled choice about which directions to keep.' },
        'The ledger shows storage and recovered energy, not just visual quality. Energy here means squared magnitude in the matrix, so larger singular values explain more of the matrix under the Frobenius norm. The safe inference is that keeping the first k singular layers gives the best rank-k approximation under standard SVD error measures.',
        {type: 'image', src: './assets/gifs/svd.gif', alt: 'Animated walkthrough of the svd visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large matrices appear in images, recommendations, search, scientific data, and model weights. Storing every entry is easy, but it does not say which variation is structural and which variation is small residual detail. Singular Value Decomposition, or SVD, separates a matrix into ordered independent directions.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Reduced_Singular_Value_Decompositions.svg',
          alt: 'Reduced singular value decomposition variants showing full, thin, compact, and truncated SVD.',
          caption: 'Reduced SVD variants show the exact rows and columns removed when the rank budget shrinks. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Reduced_Singular_Value_Decompositions.svg.',
        },
        'The reason this matters is compression with a visible error budget. If most energy sits in a few directions, a low-rank matrix can approximate the original with far fewer numbers. If energy is spread evenly, low-rank compression will visibly lose information.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep the whole matrix. For an image, that means every pixel; for a user-item table, every observed rating; for a model update, every weight delta. This preserves information but gives no ranking of which parts matter most.',
        'Another simple approach is to drop small-looking entries. That can fail because structure may live in coordinated row-column patterns rather than individual cells. A smooth image, for example, can have many nonzero pixels but only a few strong directions.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is correlation. Rows and columns are often not independent, so entry-level pruning misses the shared geometry. A matrix can look large because it has many entries while still behaving like a small number of reusable patterns.',
        'Without a decomposition, there is no principled way to choose a rank budget. Keeping 10 percent of entries is not the same as keeping 10 percent of the important directions. The method needs to rank directions by how much matrix energy they explain.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'SVD writes a matrix M as U Sigma V^T. V^T rotates input coordinates into right singular directions, Sigma stretches each direction by a nonnegative singular value, and U rotates the result into output coordinates. The same equation can be read as a sum of rank-1 layers: sigma_i times u_i v_i^T.',
        'The singular values are sorted from largest to smallest. Keeping the first k layers gives a rank-k approximation, meaning the reconstructed matrix uses only k independent directions. The dropped layers are the smallest directions under the chosen SVD ordering.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A rank-1 layer is an outer product of one left vector and one right vector, scaled by a singular value. It creates a full matrix from a reusable row-column pattern. Adding layers accumulates independent patterns until the reconstruction reaches the original matrix.',
        'Algorithms compute SVD through stable numerical linear algebra, often by reducing the matrix to a simpler form and then solving smaller orthogonal problems. For very large matrices, truncated or randomized methods compute only the top k singular directions. The animation uses the same idea conceptually: find a strong direction, subtract its layer from the residual, and repeat.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The singular vectors are orthogonal, so their contributions do not overlap under the standard inner product. That means the squared error after dropping layers is accounted for by the dropped singular values. The ordered singular spectrum therefore gives a clean error ledger.',
        'The Eckart-Young theorem is the correctness claim for compression. Among all rank-k matrices, the truncated SVD is the closest to the original under spectral norm and Frobenius norm. No other choice of k rank-1 layers gives a smaller error under those measures.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A full dense SVD of an m by n matrix costs O(m n min(m,n)), which is too expensive for many large matrices. A rank-k approximation stores about k(m + n + 1) numbers instead of mn. If m and n double while k stays fixed, storage for the low-rank form roughly doubles in each dimension sum rather than quadrupling like the full matrix.',
        'The behavior depends on the singular spectrum. Fast decay means the first few singular values carry most of the energy, so small k works well. A flat spectrum means many directions matter, so truncation saves less and error rises quickly.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/f5/GaussianScatterPCA.svg',
          alt: 'Scatter plot with principal component axes over a Gaussian cloud.',
          caption: 'PCA makes the SVD direction story visible: one axis captures the loudest variance, and the next captures the strongest remaining orthogonal direction. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:GaussianScatterPCA.svg.',
        },
        'Image compression uses low-rank reconstruction when visual structure is smoother than the raw pixel table. PCA uses SVD on centered data to find variance directions. Recommender systems and latent semantic analysis use related factorization ideas to place users, items, documents, and terms in a lower-dimensional geometry.',
        'Neural-network adaptation uses the same arithmetic in low-rank updates such as LoRA. A full 4096 by 4096 update has 16,777,216 numbers, while a rank-8 factorization uses 4096*8 + 8*4096 = 65,536 numbers. The access pattern is a large matrix whose useful change is believed to live in a few directions.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SVD fails when the low-rank assumption is false. If important signal is spread across many singular directions, truncation removes real information. Small singular directions can still contain rare events, sharp edges, or domain-specific features.',
        'It also fails when preprocessing is wrong. Centering, scaling, missing-value treatment, and weighting change the matrix before SVD ever sees it. In recommendation data, missing often means unknown rather than zero, so a plain dense SVD can solve the wrong problem.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For the 2 by 2 matrix [[3, 0], [0, 1]], the singular values are 3 and 1, with axes already aligned. Rank 1 keeps [[3, 0], [0, 0]] and drops [[0, 0], [0, 1]]. The Frobenius error is 1 because the only dropped entry has magnitude 1.',
        'For an 8 by 8 image patch, the full matrix stores 64 numbers. A rank-2 reconstruction stores two left vectors, two right vectors, and two singular values: 2*(8 + 8 + 1) = 34 numbers. The compression only helps if the two kept directions capture enough visual energy.',
        'At model scale, a 4096 by 4096 full update stores 16,777,216 numbers. A rank-8 update stores 65,536 factor numbers, about 256 times fewer. The cost is that the update can only move weights inside an 8-direction subspace.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Gilbert Strang for the geometric reading of SVD and Golub and Van Loan, "Matrix Computations," for numerical algorithms. For the approximation theorem, study Eckart and Young 1936 and the modern statement of the Eckart-Young-Mirsky theorem.',
        'Study eigenvectors, matrix multiplication, and orthogonality before this topic. Afterward, study PCA, matrix completion, randomized SVD, quantization, embeddings similarity, and LoRA to see how low-rank structure appears in systems.',
      ],
    },
  ],
};