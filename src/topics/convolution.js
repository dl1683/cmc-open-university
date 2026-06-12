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
      heading: 'What it is',
      paragraphs: [
        `Convolution is the core operation in convolutional neural networks: a small grid of weights (the kernel) slides across an image, computing one dot product at each position. In this visualization, a 3×3 kernel slides over a 6×6 image with valid padding, producing a 4×4 output because the kernel fits exactly 16 different ways without spilling off the edge. Each of those 16 output pixels is one dot product — the kernel multiplied element-wise against its window, then summed. The same nine weights detect the same pattern everywhere they slide, which is weight sharing: a single learned detector that works translation-invariant across the entire image.`,
        `Classical image filters like edge detection, blur, and sharpening are hand-picked kernels that answer simple questions. A vertical edge detector has negative weights on the left, zero in the middle, positive on the right — it asks "is it brighter to my right than my left?" A box blur kernel is nine copies of 1/9 — each output pixel becomes its neighborhood's average. A sharpen kernel has a big positive center minus its neighbors, amplifying transitions. In CNNs, Gradient Descent learns these kernels instead of a human choosing them, optimizing thousands of parameters per layer.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start with an image (a 2D grid of brightness values, or three grids for RGB color) and a kernel (a small learned or hand-picked 2D grid, usually 3×3, 5×5, or sometimes 7×7 for early layers). Position the kernel at a location in the image, multiply each pixel value by its corresponding weight, and sum those nine products — that single number is one output pixel. Slide the kernel one pixel to the right, repeat. When you hit the right edge, jump back to the left and slide down one row. Each output pixel receives one dot product, so an image with valid padding (no padding) shrinks: a 6×6 image with a 3×3 kernel becomes 4×4. With stride=1 (sliding one pixel at a time), the output size is always (input_size - kernel_size + 1) in each dimension.`,
        `In a CNN layer, this operation runs many times in parallel: a typical layer in ResNet or AlexNet applies 64 or 128 different kernels, each producing its own feature map. The first layer's kernels learn to detect edges and lines. The second layer's kernels consume those edge maps and combine them — a vertical edge plus a horizontal edge makes a corner. Deeper layers see corners and textures, then parts (wheels, eyes, noses), then objects. This pyramid of increasingly abstract detectors is trained end-to-end with Backpropagation: the loss signal flows backward through the network, and Gradient Descent adjusts every kernel's weights to minimize error. AlexNet achieved this in 2012 on ImageNet with five convolutional layers, shocking the computer vision world because it beat hand-crafted feature engineering by 15 percentage points.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `A convolutional layer is orders of magnitude cheaper than a fully connected (dense) layer. Compare: a dense layer on a 6×6 image (36 neurons) feeding into 64 output neurons requires 36 × 64 = 2304 weights. A convolutional layer with 64 different 3×3 kernels requires only 64 × 9 = 576 weights — a 4× reduction just for one layer. For realistic images (224×224 RGB in AlexNet), a dense layer would need 224² × 3 × output_neurons = over 150 million parameters for even a modest output. Convolutional layers stay in the millions total across many layers because they reuse the same kernel. Weight sharing is the magic: nine numbers detect a pattern everywhere it appears, for free. GPUs excel at convolution because it is embarrassingly parallel — every output pixel's dot product is independent, so thousands of them compute simultaneously. This is why CNNs became practical when GPU compute became available in the 2010s.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Medical imaging: U-Net, an architecture built on convolution, segments tumors and organs by learning kernels that detect tissue textures specific to each structure. The encoder-decoder design uses convolution to find features, then deconvolution (transpose convolution) to reconstruct a full segmentation mask at the original image size. Self-driving cars: the perception pipeline runs convolutional layers over camera feeds to detect pedestrians, lane markings, and vehicles — billions of dot products per second, all on GPUs. Vision Transformers (ViTs), a newer alternative to pure convolution, split images into patches (like a 16×16 grid of tiny images) and treat each patch as a token, using Attention Mechanisms instead of sliding kernels. Yet ViTs often use a convolutional stem (a few early convolutional layers) to extract initial features before switching to attention. Convolution remains the foundational building block because it is fast, interpretable (you can visualize what each kernel detects), and provably suited to images.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Misconception: "Convolution must use stride 1." False — stride controls the step size. Stride 2 means slide the kernel two pixels at a time, so a 6×6 image with a 3×3 kernel at stride 2 yields a 2×2 output (positions (0,0), (0,2), (2,0), (2,2)). Stride trades resolution for speed and fewer parameters. Pitfall: forgetting that padding matters. Valid padding (none) shrinks the output; "same" padding (zero-padding around the border) keeps dimensions equal; "full" padding keeps all partial overlaps, enlarging the output. Beginners often assume a kernel will "work" on the edges without understanding that valid convolution requires the kernel to fit entirely within the image. Another pitfall: assuming all learned kernels are interpretable. Early layer kernels (edge detectors) are usually readable, but kernels in deep layers (layer 10+) are often gibberish to human eyes — the network has learned abstract statistical patterns that humans cannot visualize. Finally, it is tempting to hand-pick kernels for specific tasks, but learned kernels almost always outperform hand-crafted ones because Gradient Descent optimizes millions of examples at once.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `To understand how kernels are optimized, study Backpropagation and Gradient Descent — they compute how much each weight should change to reduce the loss. Neural Network Forward Pass explains how layers chain together and outputs propagate. Activation Functions shape each layer's output (ReLU is the most common in modern CNNs, zeroing negative values). For understanding why convolution works so well, Attention Mechanism offers a complementary view: instead of a fixed sliding kernel, attention learns which parts of the image matter for each decision. These four topics form the spine of modern vision: forward passes compute features, Activation Functions inject nonlinearity, Backpropagation optimizes everything, and Gradient Descent choreographs the updates. Once you have that foundation, read about ResNets (skip connections to train deeper networks), U-Net (encoder-decoder for segmentation), and Vision Transformers (patches plus attention instead of sliding kernels).`,
      ],
    },
  ],
};

