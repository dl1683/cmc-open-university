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

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation walks a weight tensor through four stages. Frame 1 shows the original FP32 weights -- the ground truth. Frame 2 shows the quantized integers at your chosen bit width, with the computed scale factor. Frame 3 shows the dequantized (reconstructed) weights -- what the model actually sees at inference. Frame 4 shows the absolute error at each cell, with darker shading for larger errors.',
        {type: 'callout', text: 'Quantization is useful when the saved memory bandwidth is worth the controlled numeric error.'},
        'The final frame states the compression ratio and mean error side by side. Use the bit-width selector to compare 8-bit, 4-bit, and 2-bit quantization on the same weights. Watch how the outlier value (0.91) forces the scale factor wider, which increases relative error for small values near zero.',
    
        {type: 'image', src: './assets/gifs/quantization.gif', alt: 'Animated walkthrough of the quantization visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Neural networks store weights, which are learned numbers used in matrix multiplications. A 7-billion-parameter model uses about 28 GB at float32 because each parameter takes 4 bytes.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Quantization starts from ordinary layer weights; the compression question is how many bits each stored value really needs. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
        'Quantization exists because inference often waits on memory movement. If the weights use fewer bytes, more of the model fits in fast memory and each token can read less data.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep the trained weights in float32 or float16. That preserves the training representation and avoids calibration work.',
        'This is the right baseline when memory is abundant or when a reference run must match training behavior closely. It becomes expensive when the model must fit on one GPU, phone, or CPU server.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is bytes per parameter. A 70-billion-parameter model at float16 uses about 140 GB for weights alone, before key-value cache, activations, and runtime overhead.',
        'The compute cores may be fast enough to multiply, but they cannot use weights until memory delivers them. Fewer bytes per weight changes the serving behavior directly.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to replace a continuous range of floats with a small integer grid. A scale factor maps between the stored integer and the reconstructed value used by the model.',
        'With symmetric quantization, q = round(w / scale) and reconstructed weight w_hat = q * scale. Smaller bit widths save memory but make the grid coarser.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose a bit width and a range. For signed 8-bit quantization, the useful integer range is usually -127 to 127, while 4-bit gives only -7 to 7.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Matrix_multiplication_diagram.svg/250px-Matrix_multiplication_diagram.svg.png', alt: 'Matrix multiplication diagram showing rows and columns combining', caption: 'Quantized inference still serves matrix operations; the storage format changes the bytes read before the multiply-add work. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Matrix_multiplication_diagram.svg.'},
        'Post-training quantization calibrates a trained model and rounds weights without retraining. Quantization-aware training simulates rounding during training so the model learns weights that survive the lower precision.',
        'Modern LLM methods usually use groups or channels, not one scale for an entire model. Per-group scales reduce outlier damage because each small group gets its own numeric range.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because neural networks have redundancy and many weights are near zero. Small rounding errors often cancel across large sums instead of pushing every output in the same direction.',
        'The correctness claim is behavioral, not exact. The quantized model is acceptable only if downstream metrics remain within tolerance after reconstructed weights replace original weights.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The memory cost falls in proportion to bit width. Float32 uses 32 bits, int8 uses 8 bits, and int4 uses 4 bits, so the raw weight compression is 4x and 8x.',
        'The hidden cost is error. Outliers widen the scale and make small weights lose resolution; activations are harder than fixed weights because their ranges change by input.',
        'Serving cost can fall when kernels use the compact format directly. If a system must dequantize everything into float before compute, it may save storage but lose much of the speed benefit.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Quantization is used in llama.cpp GGUF models, TensorRT-LLM serving, mobile inference, CPU inference, and edge vision models. It is the difference between a model that fits on available hardware and one that needs a larger accelerator.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Nvidia_GV100_GPU.png', alt: 'Nvidia GV100 GPU die with repeated compute and memory structures', caption: 'The hardware payoff is memory residency and bandwidth: fewer model bytes can keep more of the workload near accelerator compute. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Nvidia_GV100_GPU.png.'},
        'It also supports fine-tuning workflows such as QLoRA, where a quantized base model is kept frozen and small trainable adapters carry the update.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Quantization fails when rounding changes behavior on the task that matters. Math, code, long-context retrieval, rare-language text, and structured extraction can be more sensitive than casual chat.',
        'It also fails when one benchmark average hides bad slices. A 4-bit model may look fine overall while failing on small models, outlier-heavy layers, or prompts that need precise numerical relationships.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Quantize [0.23, -1.45, 0.67, -0.89] to signed int8. The maximum absolute value is 1.45, so scale = 1.45 / 127 = 0.01142.',
        'The integer values are round(w / scale): 20, -127, 59, and -78. Dequantizing gives 0.2284, -1.4503, 0.6738, and -0.8908.',
        'The absolute errors are 0.0016, 0.0003, 0.0038, and 0.0008, with mean error 0.0016. The four weights use 4 bytes at int8 instead of 16 bytes at float32, plus the shared scale.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Jacob et al. on integer-only quantization, Dettmers et al. on LLM.int8 and QLoRA, Frantar et al. on GPTQ, and Lin et al. on AWQ. Then study matrix multiplication, GPU memory bandwidth, LoRA, pruning, distillation, flash attention, and calibration methods for model evaluation.',
      ],
    },
  ],
};
