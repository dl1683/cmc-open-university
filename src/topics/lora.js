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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows four frames. The first is a frozen weight matrix W, colored to show it never changes. The second shows the two skinny trainable matrices A and B that form the LoRA adapter. The third multiplies A and B into a full-size correction. The fourth adds that correction to the frozen base, producing the adapted layer.',
        'Frozen means no gradients, no optimizer state, no modification. Trainable means these values receive gradient updates during fine-tuning. The rank control lets you compare rank 1 (one direction of change, every row a scaled copy of the same pattern) against rank 2 (two directions, richer corrections). Watch how few numbers move to reshape the entire layer.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large pretrained models already know a lot. GPT-3 learned syntax, facts, and reasoning from 300 billion tokens. A ResNet-50 trained on ImageNet learned edges, textures, shapes, and object parts from 1.2 million images. Training anything like that from scratch demands data, hardware, and time that most practitioners do not have.',
        'Transfer learning is the fix: take a model pretrained on a broad task and adapt it to your specific problem. Fine-tuning is the most common form. Replace the final layer, lower the learning rate, train on your data. BERT fine-tuned on 10,000 movie reviews reaches 94% sentiment accuracy in under an hour on one GPU. Training a comparable model from scratch on the same data would overfit badly because 10,000 examples cannot teach a model what language is.',
        'But full fine-tuning has its own cost problem. A 7B-parameter model needs gradients and Adam optimizer states for every weight: roughly 56 GB of GPU memory just for training state, on top of the 14 GB model itself. Each downstream task produces a separate 14 GB checkpoint. LoRA exists because the useful change a fine-tune makes to a weight matrix usually has far less structure than the matrix itself.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first thing to try is full fine-tuning. Unfreeze the pretrained model, attach a task-specific head, and train everything end-to-end with a small learning rate. This works well and is the gold standard when hardware and data allow it. BERT fine-tuned for question answering, GPT models fine-tuned for instruction following, ResNets fine-tuned for medical imaging: full fine-tuning set most benchmarks.',
        'A lighter variant is feature extraction: freeze the entire pretrained model and only train a new classifier head on top. This is cheap and fast but limited. The frozen model cannot learn new behaviors, only map its existing representations to new labels. For generation tasks or tasks far from the pretraining domain, the frozen features are not enough.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is memory. Adam stores two extra values (first and second moment estimates) per trainable parameter. For a 7B model, that is 28 billion extra floats: roughly 56 GB in FP16. A model that fits comfortably for inference at 14 GB needs 70+ GB for full fine-tuning. An A100 has 80 GB. A consumer GPU has 24 GB.',
        'The second wall is serving. If every customer, language, or task requires a separate 14 GB checkpoint, a fleet serving ten tasks stores ten copies of nearly identical weights. Rollback, A/B testing, and audit become painful because every variant is a full model.',
        'The third wall is data. Many adaptation datasets have 1,000 to 50,000 examples. Updating 7 billion parameters with 10,000 examples invites overfitting. The model has enough capacity to memorize the training set instead of learning the task. A constrained update space acts as implicit regularization.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Hu et al. (2022) observed that the weight change produced by fine-tuning is approximately low-rank. A 4096-by-4096 weight matrix has 16.7 million entries, but the fine-tuning delta can be well-approximated by the product of two skinny matrices: A (r-by-4096) and B (4096-by-r), where r is 4, 8, or 16. The delta has rank at most r.',
        'Freeze W. Train only A and B. The forward pass becomes y = Wx + (alpha/r) * B(Ax). The frozen W carries general knowledge. The skinny product BA carries task-specific steering. For rank 8, that is 65,536 trainable parameters per layer instead of 16.7 million: a 256x reduction.',
        'The bet is that useful adaptation lives in a low-dimensional subspace. The adapter does not relearn the language or the visual hierarchy. It redirects what the base model already knows toward a new objective.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Pick which weight matrices receive adapters. The original paper targeted query and value projections in attention blocks. Later work showed that including key, output, and MLP projections can help, with diminishing returns per additional target.',
        'Initialize A from a random normal distribution and B to zeros. At the start of training, the adapter contribution is exactly zero: the model behaves identically to the pretrained base. Training gradually moves A and B away from this starting point.',
        'Train with a standard optimizer (Adam, typically) at a learning rate of 1e-4 to 3e-4. Only A and B parameters receive gradients. The frozen base needs no gradient computation for its own weights, though activations still flow through it for the forward and backward pass.',
        'At inference, merge: W_adapted = W + (alpha/r) * BA. The result is a single matrix, same shape as W, with zero extra compute at serving time. Alternatively, keep the adapter separate and hot-swap it: one base model in GPU memory, a 30 MB adapter file per task loaded on demand.',
        'The alpha/r scaling factor ensures that changing the rank does not wildly change the magnitude of the update. Typical practice sets alpha = 2r.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Transfer learning works because early layers learn universal features. In vision, the first convolutional layers learn edge detectors, Gabor filters, and color blobs regardless of whether the model was trained on ImageNet, medical scans, or satellite imagery. In language models, early transformer layers encode syntax, positional relationships, and common word patterns that are useful for any text task. These features transfer because the structure of the world is shared across domains.',
        'LoRA adds a specific claim on top: not only do the base features transfer, but the residual change needed for a new task is low-rank. Aghajanyan et al. (2021) showed empirically that fine-tuning operates in a low intrinsic dimension, often 100 to 1000 even for models with millions of parameters. LoRA operationalizes that finding by constraining the update to rank r directly.',
        'The frozen base also acts as a strong prior. With a rank-8 adapter, the model can only change behavior along 8 directions per layer. A small dataset cannot corrupt the full weight matrix because it never touches it. This implicit regularization is why LoRA often matches full fine-tuning on tasks where the domain gap is moderate.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Full fine-tuning a LLaMA-7B model: 70+ GB GPU memory, 8 hours on 8 A100s, produces a 14 GB checkpoint per task. LoRA fine-tuning the same model at rank 16: 18 GB GPU memory, 3 hours on 1 A100, produces a 30 MB adapter file. That is a 10-100x reduction in compute, memory, and storage.',
        'QLoRA (Dettmers et al. 2023) goes further. Quantize the frozen base to 4-bit NormalFloat, train the LoRA adapter in FP16. A 65B model fits in 24 GB. A 7B model fits on a consumer RTX 4090. Quality lands within 1-2% of full fine-tuning on most benchmarks.',
        'Inference cost is unchanged after merging. The adapted model is the same size and speed as the original. Unmerged adapters add one extra small matrix multiply per adapted layer, negligible for typical ranks.',
        'The hidden cost is hyperparameter search. Rank, alpha, target modules, learning rate, and training duration all interact. A rank too low underfits the task. A rank too high overfits or wastes memory. Typical starting points: r=8 for simple tasks (sentiment, NER), r=16-64 for complex tasks (instruction following, code generation), r=256 when approaching full fine-tuning quality.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'ImageNet-pretrained CNNs fine-tuned for medical imaging. CheXpert (chest X-rays) and ISIC (skin lesion classification) both achieved state-of-the-art accuracy by fine-tuning ResNets and DenseNets pretrained on ImageNet, despite the domain gap between natural photos and medical scans. The shared edge and texture detectors transfer directly.',
        'BERT and GPT fine-tuning for NLP. Sentiment analysis, named entity recognition, question answering, summarization, translation: nearly every NLP task since 2018 starts from a pretrained language model. Fine-tuning BERT-base on SST-2 (sentiment) takes 20 minutes on one GPU and reaches 93% accuracy.',
        'LoRA specifically wins when many variants share one base. A company serving ten customers with different style requirements keeps one LLaMA-70B in GPU memory and loads a 50 MB adapter per request. Civitai hosts thousands of Stable Diffusion LoRA adapters that each modify image style, character, or concept without duplicating the 2 GB base model.',
        'It also wins for governance. Each adapter is small enough to hash, version, diff, audit, and roll back independently. A model registry can track base model version, adapter rank, target modules, training data fingerprint, and evaluation metrics as a lightweight record.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Negative transfer. When the source and target domains are too different, pretrained features hurt more than they help. A language model pretrained on English Wikipedia adapts poorly to protein sequences. An ImageNet model fine-tuned on radio spectrograms may learn slower than training from scratch because the low-level features (edges, textures) are irrelevant.',
        'Catastrophic forgetting. Fine-tuning (full or LoRA) can overwrite general capabilities. A chat model fine-tuned heavily on legal text may lose its ability to hold casual conversation. LoRA limits this by constraining the update, but a high-rank adapter trained for many epochs on narrow data can still cause forgetting.',
        'Rank limitation. Some tasks require broad changes that low-rank updates cannot express. Changing a model from English to Chinese, or from text to code, may need full fine-tuning because the required weight delta has high intrinsic rank. In these cases, LoRA underfits even at r=256.',
        'Adapter composition conflicts. Two LoRA adapters trained independently for different objectives may push the same layer in incompatible directions. Merging them (by adding the deltas) can degrade both tasks. Production systems need compatibility testing, not blind stacking.',
        'Data quality is orthogonal. LoRA makes training cheaper but does not fix bad labels, duplicated examples, data leakage, or unsafe training targets. A cheap bad adapter is still bad.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Fine-tune BERT-base for sentiment analysis using LoRA. BERT has 12 transformer layers, each with query, key, value, and output projections of size 768-by-768. Full fine-tuning updates 110M parameters.',
        'Apply rank-8 LoRA to query and value projections in all 12 layers. Each adapter pair: A is 8-by-768 (6,144 params) and B is 768-by-8 (6,144 params). Two projections per layer, 12 layers: 2 * 2 * 6,144 * 12 = 294,912 trainable parameters. That is 0.27% of the full model.',
        'Dataset: 10,000 movie reviews labeled positive or negative. Train for 3 epochs with learning rate 2e-4, batch size 32, alpha=16. Total training time: 8 minutes on one V100. Validation accuracy: 93.1%, compared to 93.5% for full fine-tuning.',
        'The adapter file is 1.2 MB. Store the frozen BERT-base once (440 MB). Each new sentiment task (product reviews, tweet sentiment, app-store ratings) adds another 1.2 MB adapter. Ten tasks cost 452 MB total instead of 4.4 GB for ten full checkpoints.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Hu et al. 2022, "LoRA: Low-Rank Adaptation of Large Language Models," introduced rank-constrained weight updates for efficient fine-tuning. Aghajanyan et al. 2021, "Intrinsic Dimensionality Explains the Effectiveness of Language Model Fine-Tuning," showed that fine-tuning operates in a low-dimensional subspace. Dettmers et al. 2023, "QLoRA: Efficient Finetuning of Quantized Language Models," combined 4-bit quantization with LoRA to fine-tune 65B models on a single GPU. Houlsby et al. 2019, "Parameter-Efficient Transfer Learning for NLP," introduced bottleneck adapter layers, the predecessor approach LoRA simplified.',
        'Study next: Quantization (QLoRA combines quantized bases with LoRA adapters), Knowledge Distillation (compress a large model into a smaller one instead of adapting a large one), Transformer Block (LoRA targets attention projection matrices inside transformers), SVD (the mathematical backbone of low-rank factorization), Domain Adaptation (when source and target distributions differ enough that simple fine-tuning fails).',
      ],
    },
  ],
};
