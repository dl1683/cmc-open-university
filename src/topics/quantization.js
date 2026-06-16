// Quantization: store neural network weights in tiny integers instead of
// 32-bit floats. The reason a 7B-parameter model runs on a laptop.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'quantization',
  title: 'Quantization',
  category: 'AI & ML',
  summary: 'Squeeze float weights into 8, 4, or 2 bits — watch what survives and what gets lobotomized.',
  controls: [
    { id: 'bits', label: 'Quantize to', type: 'select', options: ['8-bit', '4-bit', '2-bit (too far)'], defaultValue: '4-bit' },
  ],
  run,
};

// A fixed 4×4 slice of "trained" weights — realistic spread, one outlier.
const WEIGHTS = [
  [0.42, -0.17, 0.08, -0.61],
  [-0.05, 0.33, -0.29, 0.12],
  [0.91, -0.44, 0.21, -0.08],
  [-0.13, 0.06, -0.37, 0.25],
];
const COLS = [0, 1, 2, 3].map((j) => ({ id: `c${j}`, label: `w·${j}` }));
const ROWS = [0, 1, 2, 3].map((i) => ({ id: `r${i}`, label: `w${i}·` }));

export function* run(input) {
  const bits = { '8-bit': 8, '4-bit': 4, '2-bit (too far)': 2 }[String(input.bits)];
  if (!bits) throw new InputError('Pick a bit width.');

  yield {
    state: matrixState({ title: 'Original weights (32-bit floats)', rows: ROWS, columns: COLS, values: WEIGHTS }),
    highlight: {},
    explanation: `A trained network is just matrices of numbers like these — millions of them, each stored as a 32-bit float. A 7B-parameter model: 7,000,000,000 × 4 bytes = 28 GB, too big for almost any consumer GPU. Quantization asks: do we really need 4 BILLION distinct values per weight, or would ${2 ** bits} levels (${bits} bits) do?`,
  };

  const flat = WEIGHTS.flat();
  const maxAbs = Math.max(...flat.map(Math.abs));
  const levels = 2 ** (bits - 1) - 1;
  const scale = maxAbs / levels;
  const q = WEIGHTS.map((row) => row.map((w) => Math.round(w / scale)));

  yield {
    state: matrixState({ title: `Quantized integers (${bits}-bit, scale=${scale.toFixed(3)})`, rows: ROWS, columns: COLS, values: q, format: (v) => String(v) }),
    highlight: {},
    explanation: `The recipe: find the largest magnitude (${maxAbs}), divide the range into ${levels} integer steps (scale = ${maxAbs} / ${levels} = ${scale.toFixed(3)}), and round every weight to its nearest step: q = round(w / scale). Each weight now needs only ${bits} bits instead of 32 — a ${(32 / bits).toFixed(0)}× compression. Note the outlier 0.91: it forced a coarse scale on everyone else. Real schemes quantize in small groups to contain outliers exactly like this one.`,
    invariant: `Every quantized value fits in ${bits} bits: an integer between ${-levels - 1} and ${levels}.`,
  };

  const restored = q.map((row) => row.map((v) => v * scale));
  yield {
    state: matrixState({ title: 'Dequantized weights (what the model actually uses)', rows: ROWS, columns: COLS, values: restored }),
    highlight: {},
    explanation: `At inference time each integer is multiplied back: w' = q × scale. Compare with the original matrix — ${bits >= 8 ? 'nearly indistinguishable.' : bits >= 4 ? 'close, but no longer exact.' : 'visibly mangled.'} The question that decides everything: does the NETWORK notice?`,
  };

  const error = WEIGHTS.map((row, i) => row.map((w, j) => Math.abs(w - restored[i][j])));
  const meanError = error.flat().reduce((a, b) => a + b, 0) / 16;
  yield {
    state: matrixState({ title: 'Quantization error |w − w′| (darker = worse)', rows: ROWS, columns: COLS, values: error, format: (v) => v.toFixed(3) }),
    highlight: {},
    explanation: `The damage map: mean error ${meanError.toFixed(4)} per weight. ${bits === 8
      ? 'At 8 bits the error is noise-level — networks are trained amid noise and literally cannot tell the difference. 8-bit inference is a free lunch.'
      : bits === 4
        ? 'At 4 bits the error is real but small — and here is the empirical miracle: LLM quality barely drops. Billions of slightly-wrong weights average out, the same way a Random Forest averages out its trees\' mistakes.'
        : 'At 2 bits only 4 distinct values exist (-2,-1,0,1 × scale) — the structure of the weights is destroyed, and so is the model: this is where quantized LLMs become incoherent. Somewhere between 4 and 2 bits lives the cliff.'}`,
  };

  yield {
    state: matrixState({ title: `The trade: ${(32 / bits).toFixed(0)}× smaller, ${meanError.toFixed(4)} mean error`, rows: ROWS, columns: COLS, values: restored }),
    highlight: {},
    explanation: `That's quantization: a 28 GB model becomes ${(28 / (32 / bits)).toFixed(1)} GB at ${bits} bits. This is precisely how llama.cpp runs 7B models on laptops (Q4 formats), why GPTQ/AWQ exist, and why the KV Cache gets quantized for long contexts. Try the other bit widths — especially 2-bit, to see the cliff with your own eyes.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Quantization stores neural-network numbers with fewer bits. A float32 weight uses 32 bits; int8 uses 8 bits, and int4 uses 4 bits. That gives roughly 4x and 8x raw weight compression before metadata. A 7B-parameter model needs about 28 GB in float32, about 14 GB in float16, about 7 GB in int8, and about 3.5 GB in int4. The trade is precision: fewer representable values means each weight is rounded to a nearby bucket.`,
        `The surprise is that trained networks tolerate a lot of rounding. Millions or billions of weights share the work, so small independent errors often average out. Real systems exploit that tolerance with post-training quantization, quantization-aware training, and mixed precision. GPTQ, AWQ, bitsandbytes, TensorRT, ONNX Runtime, and llama.cpp's GGUF formats all live in this family.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The simplest symmetric scheme finds the largest absolute weight in a group, sets scale = max_abs / max_integer, rounds q = round(w / scale), then stores q as a small integer. To use the model, it dequantizes with w_approx = q * scale or uses kernels that multiply quantized values directly. Group-wise quantization is the practical version: use separate scales for blocks of 32, 64, or 128 weights so one outlier does not ruin precision for an entire matrix.`,
        `Different methods choose scales differently. GPTQ uses second-order information to minimize output error layer by layer. AWQ protects activation-important channels. SmoothQuant moves activation outlier difficulty into weights for W8A8 execution. Activation-Aware Quantization Calibration Ledger turns those choices into calibration records, group scales, packed formats, and serving gates. Quantization-aware training inserts fake quantization during training so Gradient Descent learns weights that survive rounding. QLoRA combines Quantization with LoRA Fine-Tuning: keep the base model in 4-bit form, but train small full-precision adapters.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Memory savings are the obvious win, but speed depends on hardware and kernels. Int8 matrix multiplication is fast on many CPUs, GPUs, and TPUs. Int4 can be faster still, but only when packing, dequantization, and memory access are optimized; otherwise a small model may run slower despite using less RAM. Scales and zero-points add overhead, usually small compared with weights. KV Cache quantization attacks a different bottleneck: long-context inference stores keys and values per layer per token, so reducing cache precision can decide whether 32k-token serving fits at all.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Quantization is how large models fit on ordinary machines. llama.cpp popularized CPU-friendly 4-bit and 5-bit Llama inference. Mobile inference stacks use int8 for speech, vision, and keyboard models. NVIDIA TensorRT and ONNX Runtime deploy quantized models for low-latency serving. Apple Neural Engine, Qualcomm Hexagon, and Google TPU paths all reward reduced precision. On-Device LLM Inference Cost Crossover depends on this: local models need enough quality per byte to fit RAM, battery, and accelerator limits. In retrieval systems, vector quantization compresses Embeddings & Similarity indexes; in training stacks, bf16 and fp16 mixed precision are standard even before integer quantization is considered.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Quantization is not automatically lossless. Int8 is often close to free for mature models, but 4-bit can hurt math, code, safety classifiers, and narrow domain tasks. Two methods with the same bit width can behave differently because calibration data, group size, outlier handling, and kernel layout matter. Another misconception is that smaller weights always mean lower end-to-end latency. If generation is bottlenecked by memory bandwidth, quantization helps; if it is bottlenecked by dequantization or unsupported kernels, it may not.`,
        `The hardest cases are outliers and activations. A few very large channels can dominate the scale, while small but important weights collapse to zero. That is why SVD & Low-Rank Approximation, Knowledge Distillation, Structured Pruning and N:M Sparsity, and quantization are often combined: different compression tools remove different kinds of redundancy.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Neural Network Forward Pass to see where quantized weights are used, KV Cache for long-context memory pressure, LoRA Fine-Tuning for QLoRA, LoRA Adapter Registry, Merge, and Serving Ledger for serving quantized bases with adapters, Activation-Aware Quantization Calibration Ledger for AWQ/GPTQ/SmoothQuant-style post-training compression, Structured Pruning and N:M Sparsity for mask-and-kernel compression, and SVD & Low-Rank Approximation for a different compression lens. Knowledge Distillation explains how to train a smaller model before quantizing it, On-Device LLM Inference Cost Crossover shows why local deployment changes the cost model, and Embeddings & Similarity shows where vector quantization appears outside model weights.`,
      ],
    },
  ],
};
