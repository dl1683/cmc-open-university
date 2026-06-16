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
      heading: `What it is`,
      paragraphs: [
        `LoRA is parameter-efficient fine-tuning for large neural networks. Hu et al. introduced it in 2021 with a simple claim: fine-tuning does not need to rewrite a huge weight matrix. Freeze the pretrained matrix W, learn a small low-rank update, and add that update during the forward pass. The base model keeps its general knowledge; the adapter learns the task-specific change.`,
        `This matters because full fine-tuning copies and updates every parameter. A 7B-parameter model in 16-bit weights is about 14 GB before gradients and optimizer state; Adam-style training can require several times that. A LoRA adapter is often tens or hundreds of megabytes. One frozen base can serve many customers, domains, or tasks by swapping adapters instead of storing full model copies.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `For a dense matrix W with shape d by k, full fine-tuning learns d * k numbers. LoRA freezes W and learns two skinny matrices, A with shape r by k and B with shape d by r, where r is the rank. The effective layer becomes W + alpha/r * B A. With d = k = 4096 and r = 8, full tuning would update 16,777,216 weights; LoRA updates 65,536, a 256x reduction.`,
        `Backpropagation sends gradients only into A and B. The base weights stay frozen, so optimizer memory and checkpoint size collapse. At inference, the adapter can be merged into W for zero extra matrix multiplies, or left separate so one server can hot-swap adapters. The low-rank idea is the same family of constraint studied in SVD & Low-Rank Approximation and Matrix Completion & Recommenders: many useful changes live in a small subspace.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The savings scale with rank. If r is 8 or 16, trainable parameters are often under 1% of the base model. Compute overhead is small because the adapter multiplies through skinny matrices, but memory is the real win: no gradients or optimizer moments for frozen weights. QLoRA, introduced by Dettmers et al. in 2023, stacks LoRA Fine-Tuning on a 4-bit quantized base and showed 65B-class fine-tuning on a single 48 GB GPU. Quantization compresses the frozen model; LoRA keeps the trainable update expressive.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `LoRA is now the default path for many open-source LLM adaptations. Hugging Face PEFT, Axolotl, Unsloth, and serving stacks around Llama, Mistral, and Qwen all support adapters. Product teams use it for legal drafting, customer-support tone, SQL generation, code style, medical terminology, and private-domain tasks where full retraining would be too expensive or too risky. It is also common in diffusion image models, where small style adapters can specialize a base model without redistributing the whole checkpoint.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `LoRA is efficient, not magic. Rank too low underfits; rank too high wastes memory and can overfit small datasets. Adapter composition can conflict when two adapters push the same layer in incompatible directions. Merging adapters is convenient, but once merged you lose easy task switching unless you keep the original base and adapter files. Full fine-tuning can still win when the task demands broad behavioral change, the model is small, or you have enough data and compute.`,
        `Another trap is treating adapter training as immune to data quality. Bad instruction data, leakage, or unbalanced examples still teach the model bad behavior. Knowledge Distillation can supply better targets, but it cannot make a weak dataset trustworthy.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `LoRA Adapter Registry, Merge, and Serving Ledger is the production sequel: it turns a small adapter file into a manifest, compatibility gate, merge audit, hot-swap serving cache, and rollout policy.`,
        `Study Neural Network Forward Pass to see where W + B A is applied, then Backpropagation to follow gradients into the adapters. SVD & Low-Rank Approximation explains the low-rank bet, Quantization explains QLoRA, Attention Mechanism shows the transformer layers most often adapted, and Knowledge Distillation explains how teachers can generate better fine-tuning targets.`,
      ],
    },
  ],
};
