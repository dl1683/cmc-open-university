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
    explanation: `Fine-tuning a 7B model the brute-force way means training EVERY weight: gradients and optimizer state for all of them (3–4× the model\'s own memory), and a full 28 GB copy per task you tune. This 6×6 matrix stands in for one 4096×4096 layer (16.7 MILLION parameters). LoRA\'s opening move: freeze it. No gradients, no optimizer state, never modified.`,
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
    explanation: `The insight (Hu et al., 2021): the CHANGE a fine-tune makes to W is approximately LOW-RANK — it has far less structure than W itself. So don\'t train a 6×6 correction; train a skinny pair: A (${N}×${rank}) and B (${rank}×${N}) — ${2 * N * rank} numbers instead of ${N * N}. At real scale: rank 8 on a 4096×4096 layer is 65,536 trainable parameters instead of 16.7 million — 0.4%.`,
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
    {heading: 'How to read the animation', paragraphs: ['Read W as the frozen pretrained weight matrix. The small matrices A and B are trainable, and their product becomes a full-size correction added beside W.', {type: 'callout', text: 'LoRA treats adaptation as a low-rank delta, so task behavior moves while the pretrained matrix stays fixed.'}, 'Rank is the number of independent directions the correction can use. Rank 1 gives one direction of change, while rank 2 combines two directions and can express a richer update.', {type: 'image', src: './assets/gifs/lora.gif', alt: 'Animated walkthrough of the lora visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    {heading: 'Why this exists', paragraphs: ['A pretrained model stores broad behavior in large weight matrices. Full fine-tuning can adapt that behavior, but it creates gradients, optimizer state, and checkpoint copies for every trainable parameter.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'A pretrained network stores broad behavior in many weight matrices; LoRA adapts selected matrices without retraining the whole stack. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'}, 'Low-Rank Adaptation, or LoRA, exists because many task changes are smaller than the full model. It stores the task-specific part as a compact adapter while keeping the base model unchanged.']},
    {heading: 'The obvious approach', paragraphs: ['The obvious approach is full fine-tuning. Unfreeze the model, update every weight with backpropagation, and save a complete checkpoint for the new task.', 'This is a good baseline because it gives the optimizer maximum freedom. It becomes expensive when many tasks need mostly identical copies of the same huge model.']},
    {heading: 'The wall', paragraphs: ['The wall is training state. Adam keeps two moment values per trainable parameter, so a 7-billion-parameter model needs billions of extra values before activations are counted.', 'Serving adds another wall. Ten task variants of a 14 GB model take about 140 GB of checkpoint storage even when almost every weight is shared.']},
    {heading: 'The core insight', paragraphs: ['LoRA assumes the useful fine-tuning delta is low rank. Instead of learning a full matrix change, it learns B times A, where A and B are skinny matrices whose product has the same shape as W.', {type: 'image', src: 'https://arxiv.org/html/2106.09685/x1.png', alt: 'LoRA paper diagram showing frozen pretrained weights plus trainable low-rank matrices', caption: 'The LoRA paper diagram shows frozen pretrained weights with trainable low-rank matrices injected beside them. Source: Hu et al. 2022, arXiv.'}, 'A 4096 by 4096 matrix has 16,777,216 entries. A rank-8 LoRA update has 8 by 4096 plus 4096 by 8 entries, or 65,536 trainable values.']},
    {heading: 'How it works', paragraphs: ['Choose target matrices, often attention query and value projections. Freeze W, initialize one adapter matrix randomly and the other to zero, so the first forward pass matches the base model exactly.', 'Training computes y = Wx + (alpha / r) * B(Ax). Only A and B receive optimizer updates, while the frozen base still participates in the forward and backward computation.', 'At inference, the adapter can be merged into W once. A serving system can also keep adapters separate and hot-swap small task files beside one shared base.']},
    {heading: 'Why it works', paragraphs: ['The correctness claim is shape-preserving. BA is a real matrix delta with the same shape as W, so W + BA is a normal adapted weight matrix.', 'The restriction is expressive power. LoRA can only express deltas inside the chosen low-rank subspace, but many moderate task shifts need far fewer directions than the full matrix provides.', 'Freezing the base also regularizes small datasets. The adapter can steer behavior without letting a narrow dataset rewrite all general model knowledge.']},
    {heading: 'Cost and complexity', paragraphs: ['Training memory drops because gradients and optimizer state exist only for adapter weights. A small adapter can replace a full model checkpoint when the base is shared.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Nvidia_GV100_GPU.png', alt: 'Nvidia GV100 GPU die showing many compute regions', caption: 'Parameter-efficient fine-tuning matters because training memory and optimizer state must fit on real accelerator hardware. Source: Wikimedia Commons, Nvidia, public domain.'}, 'The behavioral cost is tuning rank, alpha, target modules, learning rate, and data quality. Rank too low underfits, while rank too high wastes memory or overfits narrow data.']},
    {heading: 'Real-world uses', paragraphs: ['LoRA is used for instruction tuning, customer-specific style, domain adaptation, and image-generation style adapters. One base model can support many variants without duplicating the checkpoint.', 'It is also useful for governance. A registry can track base version, adapter hash, rank, target modules, training data fingerprint, and evaluation results as a small artifact.']},
    {heading: 'Where it fails', paragraphs: ['LoRA fails when the needed change is not low rank at the chosen adapter size. Large language, modality, or capability shifts may require full fine-tuning or larger adaptation methods.', 'Adapters can conflict when merged blindly. Two deltas trained for different goals may push the same layers in incompatible directions, so composition needs evaluation.']},
    {heading: 'Worked example', paragraphs: ['Apply rank-8 LoRA to BERT-base query and value projections. Each 768 by 768 projection gets A with 8 by 768 values and B with 768 by 8 values, or 12,288 trainable parameters.', 'There are two adapted projections per layer and 12 layers, so the adapter trains 2 * 12 * 12,288 = 294,912 parameters. Compared with about 110 million BERT-base parameters, that is roughly 0.27 percent of the model.']},
    {heading: 'Sources and study next', paragraphs: ['Read Hu et al. 2022 for LoRA, Aghajanyan et al. 2021 for intrinsic dimension, and Dettmers et al. 2023 for QLoRA. Study singular value decomposition for low rank, transformer blocks for target modules, and quantization for adapter training on smaller hardware.']},
  ],
};
