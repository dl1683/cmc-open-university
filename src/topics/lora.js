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
      heading: 'What it is',
      paragraphs: [
        `LoRA—Low-Rank Adaptation—is a surgical fine-tuning technique that lets you teach a massive pretrained model new tasks without retraining or storing modified copies of the entire model. Instead of updating millions or billions of parameters, you train two tiny matrices (A and B) whose product creates a low-rank correction ΔW that stacks on top of the frozen original weights W. The result: keeping 99.6% of parameters locked while 0.4% of fresh ones do the learning, all on consumer hardware.`,
        `Hu et al. published LoRA in 2021 as the foundation for parameter-efficient fine-tuning (PEFT). Today it powers the entire open-source LLM ecosystem—Hugging Face PEFT, the thousands of task-specific adapters on community platforms, and production systems where you cannot afford to train a separate copy of GPT-scale models for every customer use case or domain.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The math is deceptively simple. A full weight matrix W (say 4096×4096) is frozen. You introduce two trainable matrices: A (4096×r) and B (r×4096), where r is the rank—typically 8, 16, or 32. During training, gradients flow only into A and B. After every forward pass through any layer, you compute ΔW = A·B (full matrix, but constructed on the fly from skinny factors) and add it to W' = W + ΔW. The low-rank assumption is empirically true: fine-tuning makes *small, structured* changes, not wholesale rewrites; rank 8 or 16 captures those directions.`,
        `At inference you have a choice: merge W' offline and serve one ordinary model (zero extra latency, indistinguishable cost), or keep A and B separate and apply the correction in each forward pass (minimal overhead, ~2% slower). The true power emerges at scale—a 7B model's full fine-tune is 28 GB of storage and optimizer state; the LoRA adapter is 30 MB. Store one frozen base on the GPU and hot-swap task-specific adapters in milliseconds: one model for legal docs, another for code, another for customer support, all sharing the same backbone.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Rank 8 on a 4096×4096 layer drops parameters from 16.7 million to 65,536—a 250× reduction. Full fine-tuning a 7B-parameter model requires hours on a high-end GPU; LoRA runs on a single consumer GPU in minutes. Pair LoRA with 4-bit quantization (the frozen base is ultra-compressed; only the adapter trains normally) and you get QLoRA: a production-grade LLM fine-tune on a laptop. The computational overhead of A·B multiplication during forward/backward passes is negligible. Memory dominates: you save gradient buffers, optimizer moments, and the backward-compatible warmth of retraining entire weight matrices.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Hugging Face PEFT is the reference library; thousands of community models on HuggingFace Hub are LoRA adapters on top of Llama-2, Mistral, or Phi. Domain specialists fine-tune on medical documents, legal contracts, code repositories, or proprietary datasets without owning billion-dollar GPUs. Researchers stack adapters for composable multi-task learning. Production systems (chatbots, auto-completion) ship one expensive base model and cheap, swappable task adapters, cutting storage and deployment cost per use case from gigabytes to kilobytes. QLoRA lowered the barrier so far that researchers without access to enterprise clusters can now fine-tune world-class models on shared hardware.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The biggest trap: rank-selection requires empirical validation. Too low and you lose task-specific expressiveness; too high and you waste memory and reintroduce full-tuning cost. Adapter composition (stacking multiple LoRA modules) adds complexity—they interfere if poorly designed. Another misconception: LoRA is always better than full fine-tuning. It is not. On tiny models, on non-pretrained models, or when you own the compute and want maximum flexibility, brute-force training is simpler and sometimes better. LoRA shines because it is *efficient*, not because it is universally superior. Merging vs. hot-swapping is a deployment trade-off: merged adapters are zero-overhead but monolithic; kept-separate adapters are flexible but require the frozen base to live in inference time, trading latency for flexibility.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Dive into the Backpropagation that computes gradients for A and B. Explore Quantization to see why 4-bit frozen bases pair so well with LoRA training. Study the Attention Mechanism because it is the layer you are fine-tuning in transformers. Read about Knowledge Distillation to understand how smaller adapters can borrow knowledge from large models. Finally, work through Neural Network Forward Pass to see exactly where W' is applied during inference and why the low-rank correction remains transparent to the rest of the architecture.`,
      ],
    },
  ],
};

