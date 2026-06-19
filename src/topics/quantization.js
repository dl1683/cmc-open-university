// Quantization: store neural network weights in tiny integers instead of
// 32-bit floats. The reason a 7B-parameter model runs on a laptop.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'quantization',
  title: 'Quantization',
  category: 'AI & ML',
  summary: 'Squeeze float weights into 8, 4, or 2 bits - watch what survives and what gets lobotomized.',
  controls: [
    { id: 'bits', label: 'Quantize to', type: 'select', options: ['8-bit', '4-bit', '2-bit (too far)'], defaultValue: '4-bit' },
  ],
  run,
};

// A fixed 4x4 slice of realistic learned weights: one visible outlier.
const WEIGHTS = [
  [0.42, -0.17, 0.08, -0.61],
  [-0.05, 0.33, -0.29, 0.12],
  [0.91, -0.44, 0.21, -0.08],
  [-0.13, 0.06, -0.37, 0.25],
];
const COLS = [0, 1, 2, 3].map((j) => ({ id: `c${j}`, label: `w${j}*` }));
const ROWS = [0, 1, 2, 3].map((i) => ({ id: `r${i}`, label: `w${i}*` }));

export function* run(input) {
  const bits = { '8-bit': 8, '4-bit': 4, '2-bit (too far)': 2 }[String(input.bits)];
  if (!bits) throw new InputError('Pick a bit width.');

  yield {
    state: matrixState({ title: 'Original weights (32-bit floats)', rows: ROWS, columns: COLS, values: WEIGHTS }),
    highlight: {},
    explanation: `A trained network is just matrices of numbers like these. Inference often needs only a tiny fraction of that precision. A 7B model is about 28 GB at float32 (7,000,000,000 * 4 bytes), and that is why quantization matters in practice.`,
  };

  const flat = WEIGHTS.flat();
  const maxAbs = Math.max(...flat.map(Math.abs));
  const levels = 2 ** (bits - 1) - 1;
  const scale = maxAbs / levels;
  const q = WEIGHTS.map((row) => row.map((w) => Math.round(w / scale)));

  yield {
    state: matrixState({ title: `Quantized integers (${bits}-bit, scale=${scale.toFixed(3)})`, rows: ROWS, columns: COLS, values: q, format: (v) => String(v) }),
    highlight: {},
    explanation: `Quantization chooses a scale and rounds every weight to a signed integer. For each cell: q = round(w / scale). Each stored integer uses only ${bits} bits. The outlier determines scale for everyone else, so it can increase relative error for smaller values.`,
    invariant: `At every cell after quantization, the integer is in the signed ${bits}-bit range: from ${-(2 ** (bits - 1))} to ${2 ** (bits - 1) - 1}.`,
  };

  const restored = q.map((row) => row.map((v) => v * scale));
  yield {
    state: matrixState({ title: 'Dequantized weights (what the model uses)', rows: ROWS, columns: COLS, values: restored }),
    highlight: {},
    explanation: `Inference multiplies the integer back to w' = q * scale. The model does not see the original float table anymore; it sees this reconstructed table and decides whether output behavior is still acceptable.`,
  };

  const error = WEIGHTS.map((row, i) => row.map((w, j) => Math.abs(w - restored[i][j])));
  const meanError = error.flat().reduce((a, b) => a + b, 0) / 16;
  yield {
    state: matrixState({ title: 'Quantization error |w - ŵ| (darker = worse)', rows: ROWS, columns: COLS, values: error, format: (v) => v.toFixed(3) }),
    highlight: {},
    explanation: `Mean per-entry error is ${meanError.toFixed(4)}. At ${bits} bits, this module turns a continuous surface into a coarse grid: smaller errors often still preserve task behavior, but beyond a threshold that threshold shifts and quality can collapse.`,
  };

  yield {
    state: matrixState({ title: `Tradeoff: ${(32 / bits).toFixed(0)}x compression vs. ${meanError.toFixed(4)} mean error`, rows: ROWS, columns: COLS, values: restored }),
    highlight: {},
    explanation: `This is why 7B models can run on smaller GPUs and even laptops: memory drops from about 28 GB at float32 to ${ (28 / (32 / bits)).toFixed(1)} GB at ${bits} bits. The question is operational: does the downstream stack preserve quality when this approximation is fed through attention, residuals, layer norms, and token decoding?`,
  };
}

const quantizationArticleSections = [
  {
    heading: 'How to read the animation',
    paragraphs: [
      'The animation walks a weight tensor through four stages. Frame 1 shows the original FP32 weights -- the ground truth. Frame 2 shows the quantized integers at your chosen bit width, with the computed scale factor. Frame 3 shows the dequantized (reconstructed) weights -- what the model actually sees at inference. Frame 4 shows the absolute error at each cell, with darker shading for larger errors.',
      'The final frame states the compression ratio and mean error side by side. Use the bit-width selector to compare 8-bit, 4-bit, and 2-bit quantization on the same weights. Watch how the outlier value (0.91) forces the scale factor wider, which increases relative error for small values near zero.',
    ],
  },
  {
    heading: 'Why this exists',
    paragraphs: [
      'Large neural networks store every parameter as a 32-bit or 16-bit floating-point number. A 7-billion-parameter model at FP32 is 28 GB; at FP16 it is 14 GB. LLaMA 70B at FP16 is 140 GB. These numbers are larger than most consumer GPUs (typically 8--24 GB of VRAM), so the model simply does not fit.',
      'Inference speed is memory-bandwidth bound, not compute bound. A GPU can multiply numbers far faster than it can load them from VRAM. Moving 140 GB through a memory bus that delivers 1 TB/s takes 140 ms per token -- and that is before any computation. Cutting the bytes per parameter directly cuts that latency.',
      'Quantization replaces 32-bit or 16-bit floats with smaller integers -- 8-bit, 4-bit, even 2-bit. FP16 is 2x smaller than FP32. INT8 is 4x smaller. INT4 is 8x smaller. A 70B model at INT4 fits in 35 GB -- one high-end consumer GPU instead of two datacenter GPUs.',
    ],
  },
  {
    heading: 'The obvious approach',
    paragraphs: [
      'Keep full FP32 precision everywhere. Every weight, every activation, every gradient is a 32-bit float. The math is exact (within floating-point limits), no calibration is needed, and the model behaves identically to how it was trained.',
      'This works when you have enough memory. Training on clusters of A100s or H100s with hundreds of gigabytes of combined VRAM, FP32 is fine. Research labs doing this have no immediate reason to quantize.',
    ],
  },
  {
    heading: 'The wall',
    paragraphs: [
      'LLaMA 70B at FP16 requires 140 GB of VRAM just to load the weights. A consumer RTX 4090 has 24 GB. Even a datacenter A100 has 80 GB -- you need two of them, plus the engineering to split the model across GPUs.',
      'The bottleneck is not multiplication speed. Modern GPUs execute trillions of multiply-accumulate operations per second. The bottleneck is memory bandwidth: how fast bytes travel from VRAM to the compute cores. Every token generated requires reading the entire model once. Fewer bytes per parameter means faster reads, which means faster tokens.',
      'FP32 everywhere is a luxury that becomes a wall the moment you want to serve the model on real hardware at real speed to real users.',
    ],
  },
  {
    heading: 'How it works',
    paragraphs: [
      'Quantization maps a continuous range of float values to a finite set of integer levels. The two key numbers are the scale factor and the zero point. Scale determines the step size between adjacent integers. Zero point shifts the range so asymmetric distributions (all positive, or skewed) map cleanly.',
      'Symmetric quantization sets zero_point = 0 and computes scale = max(|w|) / (2^(bits-1) - 1). Every weight becomes q = round(w / scale), and dequantization reconstructs w_hat = q * scale. This is what the animation uses.',
      'Asymmetric quantization handles ranges that are not centered on zero. Scale = (w_max - w_min) / (2^bits - 1). Zero_point = round(-w_min / scale). This wastes fewer integer levels when weights are skewed.',
      'Granularity matters. Per-tensor quantization uses one scale for the entire weight matrix -- simple but the outlier problem is severe. Per-channel quantization computes a separate scale for each output channel, reducing outlier damage. Per-group quantization (e.g., groups of 128 weights) is finer still and is standard in modern 4-bit methods.',
      'Post-training quantization (PTQ) quantizes a trained model without retraining. Run a small calibration dataset through the model, observe the weight and activation ranges, compute scales, round, done. Fast -- a few GPU-hours -- but quality can drop at low bit widths.',
      'Quantization-aware training (QAT) inserts fake quantization nodes during training. The forward pass rounds weights to integers; the backward pass uses straight-through estimators to pass gradients through the non-differentiable rounding. The model learns weight distributions that survive quantization. Better quality than PTQ, but requires full retraining.',
      'GPTQ (Frantar et al. 2023) is a one-shot PTQ method. It quantizes weights one column at a time, using approximate second-order (Hessian) information to adjust remaining columns and compensate for the error just introduced. It quantizes a 175B model to 3-4 bits in about 4 GPU-hours.',
      'AWQ (Lin et al. 2024) observes that roughly 1% of weights carry disproportionate importance for model quality. It identifies these salient weights using activation magnitudes, then applies per-channel scaling to protect them before quantization.',
      'GGUF is the file format used by llama.cpp. It stores quantized weights in various formats: Q4_0 (4-bit, no offset), Q4_K_M (4-bit with k-quant grouping, medium quality), Q5_K_M, Q8_0, and others. The letter-number codes specify bits, grouping strategy, and quality tier.',
    ],
  },
  {
    heading: 'Why it works',
    paragraphs: [
      'Trained neural network weights follow approximately Gaussian distributions centered near zero. Most values are small; large values are rare. This means most weights land close to a quantization grid point even with few bits, because the grid is densest where the weights are densest.',
      'Outlier weights -- values far from the mean -- are few but critical. Dettmers et al. (2022) showed that in large transformers, about 0.1% of features produce values exceeding 6 standard deviations. LLM.int8() handles this by detecting outlier channels at runtime and computing those columns in FP16 while the rest stays in INT8. This mixed-precision decomposition preserves quality without increasing storage for the 99.9% of normal values.',
      'Neural networks are also redundant. Each output is a sum of thousands of terms. Small independent rounding errors across thousands of weights tend to cancel rather than accumulate in one direction, because the errors are approximately zero-mean and uncorrelated. The network acts as a low-pass filter on quantization noise.',
    ],
  },
  {
    heading: 'Cost and complexity',
    paragraphs: [
      'INT8 quantization typically costs less than 1% accuracy on standard benchmarks (perplexity, MMLU, HumanEval). For most applications, INT8 is a free lunch.',
      'INT4 quantization with GPTQ or AWQ costs 1--3% accuracy. The loss concentrates on tasks requiring precise numerical reasoning (math, coding) and on smaller models where each parameter carries more information.',
      'INT2 quantization degrades quality substantially. With only 4 levels (-1, 0, 0, 1 in symmetric mode), the grid is too coarse to preserve most weight structure. Research methods like QuIP# push this frontier but remain experimental.',
      'Calibration cost is one-time. GPTQ needs a few hundred samples and a few GPU-hours. AWQ is similar. Once quantized, the model is stored and served at the lower precision indefinitely. There is no recurring cost.',
      'Memory savings: LLaMA 70B at FP16 = 140 GB. At INT8 = 70 GB. At INT4 = 35 GB. At INT4 with GPTQ, a 7B model fits in about 3.5 GB -- small enough for a phone.',
    ],
  },
  {
    heading: 'Real-world uses',
    paragraphs: [
      'llama.cpp uses GGUF quantized models to run LLMs on CPUs and consumer GPUs. The Q4_K_M format (4-bit, grouped k-quants) is the most popular balance of size and quality. Users routinely run 70B models on dual RTX 4090s (48 GB combined) at interactive speeds.',
      'GPTQ models on HuggingFace are the standard for GPU inference via AutoGPTQ and ExLlama. TheBloke (Tom Jobbins) quantized hundreds of models to GPTQ, making 4-bit inference accessible to anyone with a 24 GB GPU.',
      'TensorRT-LLM (NVIDIA) uses INT8 and INT4 quantization with custom CUDA kernels optimized for each GPU architecture. It achieves the highest throughput for production LLM serving on NVIDIA hardware.',
      'Mobile deployment uses TensorFlow Lite (INT8 quantization) and Apple CoreML (mixed-precision) to run vision and language models on phones. INT8 is the standard precision for on-device inference because it maps to hardware integer units on ARM chips.',
    ],
  },
  {
    heading: 'Where it fails',
    paragraphs: [
      'Outlier channels break naive per-tensor quantization. A single weight value of 20.0 in a tensor where everything else is between -1 and 1 forces the scale to cover the full [-20, 20] range. The 255 integer levels (for INT8) now have a step size of 0.157 instead of 0.008, and every small weight loses resolution. Per-channel or per-group quantization mitigates this, but adds storage overhead for extra scale factors.',
      'Small models degrade faster than large ones. A 1B-parameter model at INT4 loses more quality than a 70B model at INT4, because each parameter in the smaller model carries more unique information. Redundancy enables quantization; less redundancy means less room for error.',
      'Fine-grained tasks suffer more. Math reasoning (GSM8K), code generation (HumanEval), and structured extraction lose disproportionate quality at INT4 compared to general chat or summarization. These tasks depend on precise numerical relationships that rounding disrupts.',
      'Activation quantization is harder than weight quantization. Weights are fixed after training, so you calibrate once. Activations change with every input, and their ranges can shift dramatically. Dynamic quantization handles this but adds runtime overhead.',
    ],
  },
  {
    heading: 'Worked example',
    paragraphs: [
      'Quantize the weight tensor [0.23, -1.45, 0.67, -0.89] to INT8 using symmetric quantization.',
      'Step 1 -- compute scale. The maximum absolute value is 1.45. INT8 signed range is -127 to 127 (reserving -128 for special use). Scale = 1.45 / 127 = 0.01142.',
      'Step 2 -- quantize. q = round(w / scale). For 0.23: round(0.23 / 0.01142) = round(20.14) = 20. For -1.45: round(-1.45 / 0.01142) = round(-126.97) = -127. For 0.67: round(0.67 / 0.01142) = round(58.67) = 59. For -0.89: round(-0.89 / 0.01142) = round(-77.93) = -78.',
      'Quantized values: [20, -127, 59, -78]. Each stored as one byte instead of four.',
      'Step 3 -- dequantize. w_hat = q * scale. For 20: 20 * 0.01142 = 0.2284. For -127: -127 * 0.01142 = -1.4503. For 59: 59 * 0.01142 = 0.6738. For -78: -78 * 0.01142 = -0.8908.',
      'Step 4 -- error. |0.23 - 0.2284| = 0.0016. |(-1.45) - (-1.4503)| = 0.0003. |0.67 - 0.6738| = 0.0038. |(-0.89) - (-0.8908)| = 0.0008. Mean error: 0.0016. At INT8 with 254 levels, the maximum possible error per value is scale/2 = 0.0057.',
      'Compression: 4 values at FP32 = 16 bytes. At INT8 = 4 bytes + scale overhead (4 bytes shared across the group). For a group of 128 weights, the scale overhead is negligible: 4x compression.',
    ],
  },
  {
    heading: 'Sources and study next',
    paragraphs: [
      'Jacob et al. 2018, "Quantization and Training of Neural Networks for Efficient Integer-Arithmetic-Only Inference" -- established the standard INT8 PTQ pipeline with scale and zero-point calibration.',
      'Dettmers et al. 2022, "LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale" -- mixed-precision decomposition isolating outlier features in FP16 while keeping 99.9% of values in INT8.',
      'Frantar et al. 2023, "GPTQ: Accurate Post-Training Quantization for Generative Pre-Trained Transformers" -- one-shot weight quantization to 3-4 bits using approximate Hessian information.',
      'Lin et al. 2024, "AWQ: Activation-aware Weight Quantization for LLM Compression and Acceleration" -- protects salient weights identified by activation magnitudes.',
      'Dettmers et al. 2023, "QLoRA: Efficient Finetuning of Quantized LLMs" -- combines NormalFloat4 quantization with LoRA adapters for finetuning on a single GPU.',
      'Study next by role. Complementary compression: knowledge distillation (train a smaller model to mimic a larger one), structured pruning (remove entire neurons or attention heads). Often combined: LoRA and QLoRA (parameter-efficient finetuning on quantized models). Inference optimization: flash attention (reduce memory for the attention computation itself). Hardware context: how GPU memory bandwidth determines token throughput.',
    ],
  },
];

export const article = {
  sections: quantizationArticleSections,
};
