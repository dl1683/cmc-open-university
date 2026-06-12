// Convolution: slide a tiny grid of weights over an image and watch it
// light up wherever its pattern appears. Nine numbers that can find every
// edge in a photo — the atom of computer vision.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'convolution',
  title: 'Convolution',
  category: 'AI & ML',
  summary: 'Slide a 3×3 kernel across an image — the same nine weights detect a pattern everywhere at once.',
  controls: [
    { id: 'kernel', label: 'Kernel', type: 'select', options: ['vertical edge detector', 'box blur', 'sharpen'], defaultValue: 'vertical edge detector' },
  ],
  run,
};

// A 6×6 toy image: dim on the left, bright on the right — one vertical edge.
const IMAGE = [
  [1, 1, 2, 8, 8, 9],
  [1, 2, 1, 8, 9, 8],
  [2, 1, 1, 9, 8, 8],
  [1, 1, 2, 8, 8, 9],
  [1, 2, 1, 8, 9, 8],
  [2, 1, 1, 9, 8, 8],
];

const KERNELS = {
  'vertical edge detector': {
    k: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]],
    why: 'negative weights on the left, positive on the right — it answers "is it brighter to my right than my left?" Strong answer = vertical edge.',
  },
  'box blur': {
    k: [[1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9]],
    why: 'every weight is 1/9 — each output pixel becomes the AVERAGE of its neighborhood. Detail melts away; noise melts faster.',
  },
  sharpen: {
    k: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
    why: 'a big positive center minus its neighbors — it amplifies wherever a pixel DIFFERS from its surroundings.',
  },
};

const r1 = (v) => Math.round(v * 10) / 10;

export function* run(input) {
  const choice = KERNELS[String(input.kernel)];
  if (!choice) throw new InputError('Pick a kernel.');
  const K = choice.k;

  const imgRows = IMAGE.map((_, i) => ({ id: `r${i}`, label: `y${i}` }));
  const imgCols = IMAGE[0].map((_, j) => ({ id: `c${j}`, label: `x${j}` }));
  const imageState = (title) => matrixState({ title, rows: imgRows, columns: imgCols, values: IMAGE });

  yield {
    state: imageState('The input "image" (brightness values)'),
    highlight: {},
    explanation: 'To a computer, an image is a grid of numbers — here 6×6 brightness values, dim (1–2) on the left and bright (8–9) on the right, with one vertical edge between them. Real photos are the same thing, just millions of numbers across three color channels.',
  };

  yield {
    state: matrixState({
      title: `The kernel: ${String(input.kernel)}`,
      rows: K.map((_, i) => ({ id: `kr${i}`, label: `k${i}` })),
      columns: K[0].map((_, j) => ({ id: `kc${j}`, label: '' })),
      values: K.map((row) => row.map(r1)),
    }),
    highlight: {},
    explanation: `The KERNEL is a 3×3 grid of weights — ${choice.why} In a CNN these nine numbers are LEARNED by Gradient Descent; classic image editors hand-pick them. Either way, the operation is identical: slide it everywhere.`,
  };

  // convolve (valid padding): output is 4×4
  const out = [];
  for (let i = 0; i <= 3; i += 1) {
    out.push([]);
    for (let j = 0; j <= 3; j += 1) {
      let sum = 0;
      for (let di = 0; di < 3; di += 1) {
        for (let dj = 0; dj < 3; dj += 1) sum += IMAGE[i + di][j + dj] * K[di][dj];
      }
      out[i].push(r1(sum));
    }
  }

  // walk the first few positions explicitly
  for (const [i, j] of [[0, 0], [0, 1], [0, 2]]) {
    const windowIds = [];
    for (let di = 0; di < 3; di += 1) {
      for (let dj = 0; dj < 3; dj += 1) windowIds.push(`r${i + di}:c${j + dj}`);
    }
    yield {
      state: imageState('Sliding the kernel across the image'),
      highlight: { active: windowIds },
      explanation: `Position (${i},${j}): lay the kernel over this 3×3 window, multiply each pixel by its weight, and add it all up — one dot product → output value ${out[i][j]}. ${j === 0 ? 'That single number says how strongly THIS patch matches the kernel\'s pattern.' : j === 1 ? 'Slide one pixel right, repeat. Same nine weights, new window.' : `Now the window straddles the bright/dim boundary — ${Math.abs(out[i][j]) > Math.abs(out[i][1]) ? 'and the response JUMPS.' : 'watch the response change.'}`}`,
      invariant: 'One output pixel = one dot product between the kernel and the window under it.',
    };
  }

  const outRows = out.map((_, i) => ({ id: `o${i}`, label: `y${i}` }));
  const outCols = out[0].map((_, j) => ({ id: `p${j}`, label: `x${j}` }));
  yield {
    state: matrixState({ title: 'The full feature map (all 16 positions)', rows: outRows, columns: outCols, values: out }),
    highlight: {},
    explanation: `Sliding over all 16 valid positions gives the FEATURE MAP. ${String(input.kernel) === 'vertical edge detector'
      ? 'Read it: near-zero in the flat regions, huge values down the middle columns — the kernel has located the edge at every height, using the same 9 weights everywhere. That reuse is called WEIGHT SHARING, and the find-it-anywhere property is translation invariance.'
      : String(input.kernel) === 'box blur'
        ? 'Every value is its neighborhood\'s average — the image has gone soft. Note the edge survives as a gradual ramp instead of a cliff.'
        : 'Values spike wherever a pixel disagreed with its neighbors — flat areas pass through, transitions get exaggerated.'}`,
  };

  yield {
    state: matrixState({ title: 'The full feature map (all 16 positions)', rows: outRows, columns: outCols, values: out }),
    highlight: {},
    explanation: 'Now stack the idea: a CNN layer runs DOZENS of kernels (each producing its own feature map), then feeds those maps into the next layer\'s kernels. Layer 1 learns edges, layer 2 combines edges into textures and corners, deeper layers into eyes and wheels — that hierarchy, trained end-to-end by Backpropagation, was AlexNet\'s 2012 revolution and still powers ResNets, medical imaging, and self-driving perception. Nine numbers, slid everywhere: cheaper than a dense layer by orders of magnitude (see Neural Network Forward Pass), and perfectly suited to the GPU.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Convolution is a sliding dot product. A small matrix of weights, called a kernel or filter, moves across an image and writes one output value at each position. In the demo, a 3 by 3 kernel over a 6 by 6 image with valid padding produces a 4 by 4 feature map: 16 positions, 9 multiplications each. The same 9 weights are reused everywhere, so the layer learns one detector that can fire at many image locations.`,
        `That reuse is the core inductive bias of convolutional neural networks. A cat ear, tumor boundary, lane marking, or digit stroke should be recognized wherever it appears. Strictly, a convolution layer is translation-equivariant: shift the input, and the feature map shifts with it. Pooling, striding, data augmentation, and later layers help build partial translation invariance for classification.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `For one-channel input, each output pixel is sum(input_window[i] * kernel[i]) plus a bias. RGB images have three channels, so a 3 by 3 filter actually has 3 * 3 * 3 = 27 weights. A layer with 64 such filters produces 64 feature maps. The Neural Network Forward Pass stacks these maps, applies Activation Functions such as ReLU or GELU, and passes them to the next layer.`,
        `Training is ordinary Backpropagation. The loss gradient tells each kernel weight whether increasing it would help or hurt the final prediction, and Gradient Descent updates the filters. Early filters often learn edges and color contrasts; deeper filters respond to textures, parts, or task-specific patterns. LeNet-5 used this hierarchy for digit recognition in 1998. AlexNet used five convolutional layers on ImageNet in 2012 and cut top-5 error to 15.3%, far ahead of the 26.2% runner-up.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `For input height H, width W, input channels C, output channels F, and kernel size K, a stride-1 convolution costs about H * W * C * F * K * K multiply-adds. Parameters cost only C * F * K * K, independent of image size. On a 224 by 224 RGB image, 64 filters of size 7 by 7 have 9,408 weights, while a dense connection from all pixels to 64 outputs would need more than 9.6 million weights. The compute is still large, but GPUs handle it well because every output location can be computed in parallel.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Convolutions power medical segmentation systems such as U-Net, industrial defect detection, OCR, satellite imagery, face detection, camera pipelines, and many audio models that convolve over spectrograms. ResNet showed in 2015 that residual CNNs could train 152 layers and win ImageNet. EfficientNet later balanced depth, width, and resolution for mobile and cloud inference. Even vision transformers often begin with a convolutional stem or patch projection before Attention Mechanism layers take over global mixing.`,
        `Convolution is also useful outside learned models. Blur, sharpen, Sobel edges, and Gaussian filters are hand-designed kernels. CNNs simply let the data choose better kernels for the task.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Padding and stride are not cosmetic. Valid padding shrinks feature maps; same padding preserves size by adding border values, usually zeros; stride greater than 1 downsamples and may lose detail. Dilation spaces kernel taps apart, expanding receptive field without adding weights. Another misconception is that CNNs automatically understand objects. They learn local statistical features; without enough data, augmentation, and Regularization: L1 & L2, they can latch onto texture shortcuts or background artifacts.`,
        `Finally, learned kernels are not all human-readable. First-layer edge filters are often interpretable. Layer 40 is usually a distributed feature no person would name cleanly. Multi-Head Attention offers a different trade: more global mixing, less built-in locality, and a larger appetite for data.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Neural Network Forward Pass, Activation Functions, Backpropagation, and Gradient Descent for the training loop. Then compare local filters with Attention Mechanism and Multi-Head Attention, where every patch can condition on every other patch. The Loss Landscape, in 3D gives the optimizer view of why deep vision models need careful initialization, normalization, and schedules.`,
      ],
    },
  ],
};