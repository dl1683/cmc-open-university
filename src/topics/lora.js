// LoRA: fine-tune a giant model by training two skinny matrices instead of
// the giant one. The frozen weights never move — a low-rank correction
// rides on top. The trick behind every cheap LLM fine-tune.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'lora',
  title: 'LoRA Fine-Tuning',
  category: 'AI & ML',
  summary: 'Freeze the giant weight matrix; train a skinny A·B correction on top — 1% of the parameters, most of the effect.',
  controls: [
    { id: 'rank', label: 'Adapter rank r', type: 'select', options: ['1', '2'], defaultValue: '1' },
  ],
  run,
};

const N = 6;
// One frozen pretrained weight matrix (a 6×6 stand-in for a 4096×4096 layer).
const W = [
  [0.31, -0.12, 0.08, 0.22, -0.05, 0.14],
  [-0.09, 0.27, -0.18, 0.04, 0.19, -0.07],
  [0.15, 0.02, 0.33, -0.21, 0.11, 0.06],
  [-0.24, 0.17, -0.03, 0.29, -0.13, 0.21],
  [0.07, -0.26, 0.12, -0.08, 0.25, -0.16],
  [0.18, 0.09, -0.22, 0.13, 0.03, 0.28],
];
// The trainable low-rank factors (deterministic stand-ins for learned values).
const A_COLS = [
  [0.8, 0.2, -0.5, 0.4, -0.1, 0.6],
  [-0.3, 0.7, 0.1, -0.6, 0.5, 0.2],
];
const B_ROWS = [
  [0.5, -0.3, 0.2, 0.7, -0.4, 0.1],
  [0.2, 0.6, -0.5, 0.1, 0.3, -0.7],
];

const r2 = (v) => Math.round(v * 100) / 100;
const idx = (prefix) => Array.from({ length: N }, (_, i) => ({ id: `${prefix}${i}`, label: `${prefix}${i}` }));

export function* run(input) {
  const rank = parseInt(String(input.rank), 10);
  if (![1, 2].includes(rank)) throw new InputError('Pick rank 1 or 2.');

  const rows = idx('r');
  const cols = idx('c');

  yield {
    state: matrixState({ title: 'The pretrained weight matrix W — FROZEN', rows, columns: cols, values: W }),
    highlight: {},
    explanation: `Fine-tuning a 7B model the brute-force way means training EVERY weight: gradients and optimizer state for all of them (3–4× the model's own memory), and a full 28 GB copy per task you tune. This 6×6 matrix stands in for one 4096×4096 layer (16.7 MILLION parameters). LoRA's opening move: freeze it. No gradients, no optimizer state, never modified.`,
  };

  const A = A_COLS.slice(0, rank);
  const B = B_ROWS.slice(0, rank);
  yield {
    state: matrixState({
      title: `The trainable adapter: A (${N}×${rank}) and B (${rank}×${N})`,
      rows: [...A.map((_, k) => ({ id: `a${k}`, label: `A·${k}` })), ...B.map((_, k) => ({ id: `b${k}`, label: `B${k}·` }))],
      columns: cols,
      values: [...A.map((col) => col.map(r2)), ...B.map((row) => row.map(r2))],
    }),
    highlight: { active: A.map((_, k) => `a${k}`).concat(B.map((_, k) => `b${k}`)) },
    explanation: `The insight (Hu et al., 2021): the CHANGE a fine-tune makes to W is approximately LOW-RANK — it has far less structure than W itself. So don't train a 6×6 correction; train a skinny pair: A (${N}×${rank}) and B (${rank}×${N}) — ${2 * N * rank} numbers instead of ${N * N}. At real scale: rank 8 on a 4096×4096 layer is 65,536 trainable parameters instead of 16.7 million — 0.4%.`,
  };

  const delta = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => r2(A.reduce((sum, col, k) => sum + col[i] * B[k][j], 0))));
  yield {
    state: matrixState({ title: `ΔW = A·B — a rank-${rank} correction`, rows, columns: cols, values: delta }),
    highlight: {},
    explanation: `Multiply them and the skinny pair blooms into a full ${N}×${N} update: ΔW = A·B. ${rank === 1 ? 'Look closely at the structure: every ROW is a scaled copy of B\'s single row — that\'s what rank 1 means. It can express one "direction" of change,' : 'With rank 2, each row mixes TWO base patterns — richer corrections,'} which turns out to be plenty for adapting style, domain, or task; the heavy general knowledge stays in frozen W. Only A and B receive gradients (${2 * N * rank} trainable values here).`,
    invariant: 'W never changes — all adaptation lives in the low-rank product A·B.',
  };

  const merged = W.map((row, i) => row.map((w, j) => r2(w + delta[i][j])));
  yield {
    state: matrixState({ title: "W' = W + A·B — the adapted layer", rows, columns: cols, values: merged }),
    highlight: {},
    explanation: `At inference the correction can be MERGED: W' = W + A·B, one ordinary matrix again — zero extra latency, indistinguishable in cost from the original model. Or keep A·B separate and hot-swap it: one frozen base model on the GPU, a 30 MB adapter per task (support-bot, legal-drafter, code-styler), switched in milliseconds.`,
  };

  yield {
    state: matrixState({ title: 'The LoRA economy', rows: [{ id: 's', label: '' }], columns: [
      { id: 'full', label: 'full FT' }, { id: 'lora', label: 'LoRA' },
    ], values: [[N * N, 2 * N * rank]] }),
    highlight: { active: ['s:lora'] },
    explanation: `The whole trade in one row: ${N * N} trainable parameters versus ${2 * N * rank} — and at production scale, days-of-GPU versus hours-on-one-GPU. Pair it with a 4-bit frozen base (see Quantization) and you get QLoRA: fine-tuning a 7B model on a single consumer GPU. This is how the open-source ecosystem ships thousands of specialized models that all share one backbone — adaptation as an accessory, not a rebuild.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Full fine-tuning a large model is expensive because every weight becomes trainable. You need gradients, optimizer state, checkpoints, and often a separate full model copy for every task or customer. For a 7B-parameter model, that quickly turns into a memory, storage, and serving problem.',
        'LoRA exists because many useful fine-tuning changes appear to live in a much smaller subspace than the full weight matrix. Instead of updating a huge matrix W directly, freeze W and learn a small low-rank correction beside it. The base model keeps its broad pretrained behavior; the adapter learns a task or style adjustment.',
        'The result changed the economics of model adaptation. A team can keep one frozen base model and train, store, ship, audit, merge, or hot-swap small adapters. That is why LoRA sits at the center of modern open-source LLM fine-tuning and many diffusion-model style adapters.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is full fine-tuning: unfreeze the model and update all parameters on the new dataset. That gives maximum flexibility, but it is costly and risky. It can overfit small datasets, forget useful base behavior, and produce a full-size checkpoint for every variant.',
        'Another obvious approach is prompt engineering or retrieval. Those are often enough when the base model already knows the behavior and only needs context. They are weaker when the desired behavior is repeated, stylistic, domain-specific, or needs to become part of the model\'s default response pattern.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is optimizer memory. Adam-style training stores extra state for every trainable parameter. A model that fits for inference may not fit for full fine-tuning. Even if it fits, saving many full fine-tuned checkpoints is operationally wasteful.',
        'The second wall is serving. If every customer or task requires a separate full model, fleet utilization and rollout discipline become painful. A serving system wants one base model loaded once, plus small task-specific artifacts that can be selected, cached, merged, or rolled back.',
        'The third wall is data. Many adaptation datasets are not large enough to justify changing every parameter. A constrained update can act as a useful regularizer: it gives the model room to adapt without letting a small dataset rewrite everything.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Freeze the pretrained weight matrix W and learn a low-rank delta. For a layer with W, LoRA adds a correction such as B A scaled by alpha / r. A and B are skinny matrices, and r is the adapter rank. Only those matrices receive gradients.',
        'If W is 4096 by 4096, full fine-tuning touches 16,777,216 weights in that layer. A rank-8 LoRA update uses roughly 4096 * 8 + 8 * 4096 trainable numbers, or 65,536. That is a 256x reduction for the adapted part of the layer.',
        'The low-rank bet is that task adaptation often changes behavior along a limited number of directions. The adapter does not need to relearn the base model. It only needs to steer it.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The first frame shows the base matrix W frozen. That is the operational decision. No gradients, no optimizer moments, and no task-specific overwrite of the base weights.',
        'The adapter frame shows the trainable part: two skinny matrices. Multiplying them creates a full-size delta, but the number of learned parameters is small because the delta is constrained to low rank.',
        'The merge frame shows the serving choice. You can merge W plus the adapter delta into one effective matrix for inference, or keep the adapter separate so the same loaded base can serve many tasks by swapping adapters.',
      ],
    },
    {
      heading: 'How the mechanism works',
      paragraphs: [
        'For an input x and a linear layer y = W x, LoRA changes the layer to y = W x + scale * B A x, depending on notation and matrix orientation. W is frozen. A and B are trained. The scale often includes alpha / r so rank changes do not wildly change update magnitude.',
        'A is commonly initialized randomly and B to zeros, or by another convention that makes the initial adapter contribution near zero. That means training starts from the base model behavior and gradually learns the adapter delta.',
        'LoRA is usually applied to selected projection matrices in attention or MLP blocks, not necessarily every parameter. Common targets include query, key, value, output, and feed-forward projections. The target choice is part of the adaptation budget.',
        'At inference, merged adapters add no extra matrix multiplications because the delta is folded into W. Unmerged adapters add small extra multiplies but allow dynamic adapter switching. Serving systems choose between latency simplicity and operational flexibility.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'In the visualization, a 6 by 6 matrix stands in for a much larger layer. Full fine-tuning would update all 36 entries. Rank-1 LoRA learns two vectors: one column-like factor and one row-like factor. Their product creates a full 6 by 6 update, but every row is a scaled version of the same pattern.',
        'Rank 2 adds another pattern. The update can now mix two base directions, so it can express richer changes while still using far fewer parameters than a full matrix. At real model sizes, the difference is dramatic: rank 8 on a 4096 by 4096 layer trains 65,536 parameters instead of 16.7 million.',
        'That is why adapter rank is not a cosmetic setting. Low rank may underfit a broad behavior change. Higher rank gives more capacity but uses more memory and can overfit. The right rank depends on dataset size, task difficulty, target layers, and acceptable serving cost.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'LoRA works when the pretrained model already contains most of the knowledge and capabilities needed for the task. The adapter does not create the model from scratch. It nudges internal transformations so the existing model expresses different behavior.',
        'It also works because low-rank structure is common in useful updates. Many changes in high-dimensional systems can be approximated by a small number of directions. This is the same broad intuition behind SVD, low-rank approximation, and matrix factorization.',
        'The frozen base acts as a strong prior. A small dataset is less able to damage all model weights because it can only train through the adapter subspace. That can improve stability, though it is not a substitute for good data.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The savings scale with rank and target coverage. If rank is 8 or 16 and only selected matrices receive adapters, trainable parameters can be under one percent of the base model. Optimizer memory and checkpoint size shrink accordingly.',
        'QLoRA pushes the economy further by keeping the frozen base in low-bit quantized form while training LoRA adapters. Quantization compresses the base model; LoRA supplies the trainable path. Together they made serious fine-tuning possible on much smaller hardware.',
        'The behavior depends on adapter lifecycle. Separate adapters are easy to share and swap, but adapter composition can conflict. Merged adapters simplify inference, but the merge must be tracked so teams know exactly what base and adapter produced a model.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'LoRA wins for domain adaptation, style adaptation, instruction tuning, customer-specific behavior, tool-use formats, code style, legal or medical terminology, and diffusion-model style adapters. It is especially useful when many variants should share one base model.',
        'It also wins in governance. Small adapters are easier to store, scan, evaluate, roll back, and compare than full checkpoints. A registry can track base model hash, adapter rank, target modules, training data, evaluation score, and merge status.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'LoRA fails when the desired change is too broad for the chosen rank or target modules. Full fine-tuning can still win for major behavior changes, small models, abundant data, or settings where every parameter must adapt.',
        'It also fails when teams treat parameter efficiency as data quality. Bad instruction data, duplicated examples, leakage, weak labels, and unsafe targets still produce bad adapters. LoRA makes training cheaper; it does not make the training objective wiser.',
        'Adapter stacking can also create conflict. Two adapters trained for different goals may push the same layer in incompatible directions. Production systems need compatibility tests instead of assuming adapters compose cleanly.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'LoRA freezes the base and trains a low-rank delta. The base carries broad capability. The adapter carries task steering.',
        'The practical questions are rank, target modules, data quality, merge policy, adapter registry, and evaluation. Those choices decide whether LoRA is a clean adaptation layer or a pile of hard-to-audit variants.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Neural Network Forward Pass to see where W + B A is applied, Backpropagation to follow gradients into adapters, SVD & Low-Rank Approximation for the low-rank bet, Quantization for QLoRA, Attention Mechanism for common target matrices, Knowledge Distillation for teacher-generated adaptation data, and LoRA Adapter Registry, Merge, and Serving Ledger for production operations.',
      ],
    },
  ],
};
