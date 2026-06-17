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

const quantizationArticleSections = [
  {
    heading: `Why This Exists`,
    paragraphs: [
      `Neural networks are mostly arrays of numbers. A large language model can contain billions of weights, and every generated token may require moving many of those weights through memory and compute units. Full precision is expensive: float32 uses 32 bits per weight, float16 or bf16 uses 16, int8 uses 8, and int4 uses 4. A 7B-parameter model is about 28 GB in float32, about 14 GB in float16, and roughly 3.5 GB before metadata at 4 bits. Quantization exists because many deployment bottlenecks are byte bottlenecks. If the model keeps nearly the same behavior while using fewer bytes, it can fit on smaller devices, serve more requests per GPU, or spend less time waiting on memory bandwidth.`,
    ],
  },
  {
    heading: `The Obvious Approach`,
    paragraphs: [
      `The obvious approach is to keep the trained weights exactly as floats. That is the safest representation because it preserves the numbers produced by training and works with standard matrix-multiplication kernels. It is also wasteful when the learned function does not need that many distinct values per weight. A second obvious approach is to round every weight with one scale for the whole tensor. Find the largest absolute value, divide the range into integer levels, store q = round(w / scale), and reconstruct w' = q * scale. This simple scheme is the animation's baseline. It teaches the main contract: quantization replaces a continuous-looking set of floats with a smaller numeric grid, then asks whether the model can tolerate the rounding error.`,
    ],
  },
  {
    heading: `The Wall`,
    paragraphs: [
      `The wall is that one scale rarely serves every value equally well. A single outlier can force a coarse scale, leaving small weights with too few usable buckets. Values near zero may collapse to zero. Values outside the chosen range may clip. The damage is not measured only per weight; it is measured after matrix multiplication, layer normalization, residual paths, and attention mix the errors. Activations add another wall because they are input-dependent. A weight can look harmless until real prompts amplify its channel. Hardware adds a final wall. A smaller file is not automatically faster if the runtime must decode packed values awkwardly, dequantize on the wrong device, or fall back to fp16 kernels.`,
    ],
  },
  {
    heading: `Core Insight`,
    paragraphs: [
      `The core insight is that neural networks often have redundancy in their numeric representation. Training does not usually need each weight to preserve all 32 float bits at inference. If quantization error is small, distributed, and aligned with insensitive directions, the network's aggregate behavior can remain close. The algorithm therefore spends precision where error would hurt and saves bits where it would not. Basic symmetric quantization spends precision uniformly inside a group. Group-wise quantization limits how far an outlier can damage unrelated weights. More advanced methods choose scales from calibration data, protect activation-important channels, or train with fake quantization so the model learns to survive the grid. Quantization is not magic compression. It is controlled error allocation.`,
    ],
  },
  {
    heading: `How It Works`,
    paragraphs: [
      `For a symmetric signed scheme, choose a bit width b. The representable integer range is approximately -2^(b-1) to 2^(b-1)-1. For a group of weights, compute max_abs, set scale = max_abs / max_integer, and store q = round(w / scale). Inference reconstructs w' = q * scale or uses a fused kernel that multiplies integer payloads with scales inside the matrix operation. Asymmetric schemes also store a zero-point so the integer grid can shift. Practical systems quantize per tensor, per channel, or per group. Smaller groups usually reduce error because each scale covers a narrower distribution, but they add scale metadata and can complicate kernels. The animation shows this recipe on a fixed 4 by 4 weight slice so the error map is visible instead of hidden inside billions of numbers.`,
    ],
  },
  {
    heading: `What The Visual Proves`,
    paragraphs: [
      `The first frame shows why the problem is a storage problem: every weight is just a number, and models have many of them. The quantized frame shows the grid. At 8 bits the grid is dense; at 4 bits it is coarse but often usable; at 2 bits it has so few levels that structure disappears. The dequantized frame proves that the model does not use the original floats after compression. It uses approximations reconstructed from integer payloads and scales. The error frame proves that damage is uneven. The outlier controls the scale, so some smaller values take more relative error. The final trade frame connects the local matrix to deployment: smaller weights can reduce memory, but the quality question is whether the accumulated error changes the network's outputs.`,
    ],
  },
  {
    heading: `Why It Works`,
    paragraphs: [
      `Quantization works when the approximate network computes nearly the same function as the original network. A single rounded weight is wrong, but a layer output is a sum of many products. If errors are small and not systematically biased in a sensitive direction, later layers often absorb them. This is why 8-bit inference is frequently close to lossless for mature models and why 4-bit can work with careful scaling. The correctness argument is empirical, not absolute. There is no theorem that every model survives a chosen bit width. The invariant a serving team can enforce is narrower: same architecture, known quantization method, known calibration data when needed, measured task quality, compatible kernel, and a rollback path if the quantized variant crosses an error cliff.`,
    ],
  },
  {
    heading: `Cost And Tradeoffs`,
    paragraphs: [
      `Raw weight memory falls roughly in proportion to bit width, but metadata reduces the ideal factor. Int8 stores one quarter as many weight bits as float32; int4 stores one eighth. Group scales, zero-points, headers, and alignment add overhead. Speed depends on the bottleneck. If inference is memory-bandwidth-bound and the hardware has efficient low-bit kernels, quantization can improve latency and throughput. If the workload is compute-bound, if dequantization is expensive, or if the accelerator lacks the expected kernel, smaller weights may not help. Quantization can also shift the bottleneck to the KV cache for long-context decoding. Weight quantization helps the static model; KV-cache quantization helps the per-request state that grows with sequence length.`,
    ],
  },
  {
    heading: `Where It Wins`,
    paragraphs: [
      `Quantization wins in edge deployment, consumer GPUs, browser or desktop inference, mobile speech and vision models, and high-throughput serving where memory movement dominates. It is the reason many open models can run locally through formats such as GGUF or runtime-specific packed checkpoints. It also helps large server deployments because smaller weights improve residency, batching, and sometimes energy per token. The technique is not limited to LLM weights. Embedding indexes use vector quantization to shrink retrieval memory. Training stacks use reduced precision such as fp16 and bf16 even before integer quantization. QLoRA uses a quantized base model with trainable adapters so fine-tuning can fit on much smaller hardware than full-precision training.`,
    ],
  },
  {
    heading: `Where It Fails`,
    paragraphs: [
      `Quantization fails when the error budget is spent in the wrong places. Math, code, structured output, safety classifiers, and narrow domain tasks can regress before general chat quality looks bad. Two models with the same bit width can behave differently because group size, scale strategy, calibration data, outlier handling, and kernel format differ. Two-bit quantization often crosses a cliff because the grid is too small to preserve enough structure. Smaller also does not guarantee faster. A runtime can load an int4 checkpoint and still run slowly if it dequantizes constantly or uses unsupported layouts. Quantization should be treated as a new model variant with its own evaluation, not as a transparent file-size setting.`,
    ],
  },
  {
    heading: `Study Next`,
    paragraphs: [
      `Study Neural Network Forward Pass to see where quantized weights enter matrix multiplication. Then read Activation-Aware Quantization Calibration Ledger for AWQ, GPTQ, SmoothQuant, calibration samples, packed formats, and serving gates. Transformer Inference Roofline explains when byte savings change latency. KV Cache Quantization & Compression covers the long-context memory problem that remains after weights shrink. LoRA Fine-Tuning and QLoRA show how quantized bases can support adapter training. Structured Pruning and N:M Sparsity removes weights instead of rounding them, while SVD & Low-Rank Approximation compresses matrices by factorization. Knowledge Distillation is the complementary path: train a smaller model before quantizing it. Benchmark Variance Model Selection is the guardrail before trusting a single quantized score.`,
    ],
  },
];

export const article = {
  sections: quantizationArticleSections,
};
