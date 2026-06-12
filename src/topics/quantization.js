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
      heading: 'What it is',
      paragraphs: [
        `Quantization shrinks neural network weights by storing them in tiny integers instead of 32-bit floats. A trained 7-billion-parameter model weighs about 28 GB in full precision — too large for most laptops and consumer GPUs. The same model at 4-bit precision fits in 3.5 GB, and at 8-bit in 7 GB, because 4 bits can represent only 16 distinct values instead of billions. The core insight: networks are robust to noise and slightly-wrong weights because they average millions of small errors across billions of parameters, much like a Random Forest averages its trees' mistakes. Quantization exploits that robustness to trade tiny accuracy loss for massive memory and speed gains.`,
        `Three regimes exist: 8-bit quantization is nearly lossless (networks cannot detect the error amid their inherent noise), 4-bit introduces small but measurable quality drops that add up to tiny model degradation, and 2-bit destroys structure (only four distinct values exist, so the weight distribution collapses). Most deployed quantized models live in the 4-bit to 8-bit zone. Real-world schemes like GPTQ, AWQ, and llama.cpp's Q4 formats use group-wise quantization (quantizing small weight groups separately) to contain outliers and prevent a single large weight from coarsening the scale for everyone else, a problem you see clearly in the visualization when the 0.91 outlier dominates the quantization range.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The algorithm is simple: find the largest magnitude (maxAbs) in the weights, then divide the representable range into equal steps. For b bits, you get 2^(b-1) - 1 steps (one step is the scale): scale = maxAbs / (2^(b-1) - 1). Round every weight to its nearest integer step: q = round(w / scale). Each q now fits in b bits. To use the model, dequantize back: w' = q × scale. The error is the difference |w - w'|.`,
        `In the visualization: the original 32-bit weights become quantized integers, which then dequantize to their closest representable values. Notice how the error heatmap darkens in the corners — small weights (0.08, 0.06, -0.05) suffer larger relative error because the scale is set by the largest magnitude. This is the first practical problem: a single outlier (the 0.91 in position [2,0]) forces a coarse scale that wastes precision on smaller weights. The real-world fix is group-wise or channel-wise quantization: quantize different groups of weights with different scales, so small weights in their group maintain precision. This is exactly what GPTQ and AWQ do to make 4-bit inference practical for production LLMs like Llama.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Memory: 8-bit quantization is roughly 4× compression (32 bits → 8 bits). 4-bit is 8× (28 GB → 3.5 GB). 2-bit is 16× but unusable for most networks. Inference speed also improves because low-precision arithmetic is faster on GPUs and TPUs, and you fit more activations in cache. The computational cost of quantization itself is trivial — a few passes to find maxAbs, scale, and round. KV Cache quantization (storing attention key-value vectors at 8 bits or 4 bits instead of 32) unlocks long-context inference; a 4K-token context with quantized KV cache costs less memory than a 512-token context at full precision. The big remaining challenge is training quantized models end-to-end or fine-tuning them: QLoRA (Quantized LoRA) solves this by keeping the base model at 4-bit but adapting it with full-precision low-rank updates, so you train an 8B model on a consumer GPU by freezing the quantized backbone.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `llama.cpp (runs Llama on CPU and GPU) ships pre-quantized weights in Q4, Q5, and Q8 formats — these are the quantized model files you download. GPTQ and AWQ are research frameworks that optimize quantization for specific hardware and target bit widths; the quantized models are shipped on HuggingFace and run with specialized kernels for speed. QLoRA enabled fine-tuning of 13B and 70B parameter models on a single 24GB GPU, democratizing LLM adaptation. Inference engines like TensorRT and ONNXRuntime natively support quantized inference. Mobile deployment (phone LLMs, edge AI) relies entirely on quantization — 8-bit and 4-bit models run where full precision would never fit. Long-context systems quantize the KV Cache to avoid memory explosion; a system processing 32k-token documents uses 4-bit KV caches, cutting cache memory 8×. Even transformer architectures themselves are being redesigned with quantization in mind (mixed-precision schemes, learnable quantization ranges per layer), because quantization is no longer a deployment afterthought but a core design constraint.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Misconception: quantization is a magic free lunch at all bit widths. False. 8-bit is nearly free. 4-bit works surprisingly well empirically, but task-specific quality loss is real and cumulative (especially on math-heavy or highly specialized domains). Below 4 bits, output quality degrades sharply. Another trap: a single global scale wastes precision on small weights and constrains large ones. Solution: group-wise quantization (GPTQ, AWQ) quantizes layers, channels, or blocks separately. Pitfall: naive post-training quantization (just quantizing trained weights) underperforms compared to quantization-aware training (training with quantization in mind) because the model never learned to be quantization-robust. Many papers show 4-bit QAT beats 8-bit post-training quantization. Final pitfall: assuming 4-bit models are interchangeable regardless of how they were quantized — GPTQ and AWQ use different algorithms, produce different weight distributions, and have different accuracy-speed tradeoffs. Always validate quantization on your target task.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Quantization is about compressing trained weights; to understand what those weights learned, study Neural Network Forward Pass and Embeddings & Similarity to see how weights transform inputs. KV Cache describes the memory bottleneck that quantization alleviates in long-context models. Gradient Descent shows how weights are learned in the first place; quantization-aware training modifies that process. Random Forest illustrates the averaging principle behind quantization robustness — many small errors averaging to tiny loss.`,
      ],
    },
  ],
};

