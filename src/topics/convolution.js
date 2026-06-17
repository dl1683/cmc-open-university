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
      heading: `Why this exists`,
      paragraphs: [
        `Images are not just long lists of numbers. They are grids. Neighboring pixels usually matter together, and the same visual pattern can appear in many places. A vertical edge in the upper-left corner is still a vertical edge if it moves to the center. A dense neural network ignores that structure at the first layer. It can learn from pixels, but it starts with no built-in idea that nearby pixels are related or that the same detector should work across positions.`,
        `Convolution exists to encode those two facts directly: locality and weight sharing. A small grid of weights, called a kernel or filter, looks at a local patch and produces one number. The same kernel slides across the whole image. Instead of learning a separate detector for every location, the model learns one detector that can fire anywhere. That single design choice is why convolutional networks were able to scale computer vision before transformers became practical for images.`,
      ],
    },
    {
      heading: `The naive approaches`,
      paragraphs: [
        `The first naive approach is a fully connected layer over raw pixels. A 224 by 224 RGB image has 150,528 input values. Connecting that to even 64 hidden units needs more than 9.6 million weights before the model has learned a single useful local feature. It also treats pixel 12 in the top row as unrelated to pixel 13 unless the data and optimizer discover that relationship from scratch. The parameter count is high, and the inductive bias is poor.`,
        `The second naive approach is hand-engineered feature extraction. Classic vision systems used Sobel filters, corners, blobs, histograms, and handcrafted pipelines. These can work, and the kernels in this demo are in that tradition. The wall is flexibility. A hand-picked edge detector does not automatically become a texture detector, a wheel detector, or a tumor-boundary detector for a new dataset. Convolutional neural networks keep the useful sliding operation but learn the filters from data.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `A convolutional layer asks the same local question everywhere. For a vertical edge detector, the question is "is the right side of this small window brighter than the left side?" For a blur kernel, the question is "what is the local average?" For a learned CNN filter, the question may not have a clean human name, but the structure is the same. The kernel is a small set of weights reused at every valid position.`,
        `That reuse makes the layer translation-equivariant. If the input shifts to the right, the feature map shifts to the right. The layer does not have to relearn the detector for every coordinate. Later operations such as pooling, striding, data augmentation, and classification heads can turn equivariant feature maps into partial translation invariance, where the final class can stay stable even when the object moves.`,
      ],
    },
    {
      heading: `How convolution works`,
      paragraphs: [
        `For a one-channel image, place the kernel over a local window, multiply matching entries, add the products, and write the result into the output feature map. Then slide the kernel one step and repeat. With valid padding, a 3 by 3 kernel over a 6 by 6 image produces a 4 by 4 output because the kernel must fit entirely inside the input. With same padding, border values are added so the output can keep the original height and width.`,
        `Real images usually have channels. An RGB input has red, green, and blue channels, so a 3 by 3 filter has 3 * 3 * 3 weights before the bias. A layer with 64 filters produces 64 feature maps. Each filter sees all input channels and writes one output channel. The next layer receives those feature maps as its input, so it can combine simple features into richer ones: edges into corners, corners into textures, textures into parts, and parts into task-specific evidence.`,
        `Training uses the same backpropagation machinery as other neural networks. The loss gradient tells each kernel weight whether increasing it would improve or worsen the final objective. Gradient descent updates the weights. Early filters often become edge, color, and contrast detectors because those are useful local primitives. Deeper filters become harder to name because they are distributed features shaped by the task.`,
      ],
    },
    {
      heading: `How the visual model teaches it`,
      paragraphs: [
        `The input grid proves that an image can be treated as structured numeric data. The kernel grid proves that a detector can be small. The sliding windows prove that one detector can be applied at many coordinates without changing its weights. Each highlighted 3 by 3 patch produces one output value by a dot product. The full feature map is simply the collection of those dot products.`,
        `The vertical-edge view is the clearest case. Flat regions produce small responses because the left and right sides of the kernel cancel. A patch that straddles the dim-bright boundary produces a large response because negative weights land on dim pixels and positive weights land on bright pixels. The lesson is not only edge detection. The lesson is shared local computation: one tiny template can scan the whole image and create a map of where its pattern appears.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Convolution works well because many signals have local regularity. In natural images, neighboring pixels are correlated, edges are local, textures repeat, and objects are built from parts. In audio spectrograms, nearby time-frequency bins carry local structure. In medical scans, local tissue boundaries and shapes matter. A convolutional network does not need to learn those facts from nothing. Its architecture already assumes local features are useful and reusable.`,
        `The hierarchy is just as important as the first layer. A single kernel has a small receptive field, but stacking layers lets information from a larger region influence deeper features. Stride and pooling can widen the effective view while reducing resolution. Residual connections, normalization, and careful initialization made very deep CNNs trainable. ResNet showed that depth could be used without collapsing optimization, and later efficient architectures refined the compute tradeoffs for mobile and cloud inference.`,
      ],
    },
    {
      heading: `Costs and tradeoffs`,
      paragraphs: [
        `For input height H, width W, input channels C, output channels F, and kernel size K, a stride-1 convolution costs about H * W * C * F * K * K multiply-adds. The parameter count is only C * F * K * K plus biases, independent of image size, but the compute can still be large because the same filter is applied at many positions. GPUs handle this well because output locations and channels can be computed in parallel.`,
        `The tradeoff is that convolution buys efficiency by assuming locality. That is a good assumption for many vision tasks, but it limits immediate global mixing. A 3 by 3 kernel cannot directly compare the top-left corner with the bottom-right corner. Deep stacks, pooling, dilation, larger kernels, or attention layers are needed for long-range relationships. Depthwise separable convolutions reduce compute by splitting spatial filtering from channel mixing, but they can reduce capacity if used carelessly.`,
      ],
    },
    {
      heading: `Real uses`,
      paragraphs: [
        `Convolutions are used in image classification, object detection, semantic segmentation, OCR, face detection, industrial inspection, robotics, satellite imagery, medical imaging, camera pipelines, and audio models over spectrograms. U-Net made encoder-decoder convolutional structure central to segmentation. ResNet made residual CNNs a default backbone. EfficientNet showed how to scale depth, width, and resolution together. Many production systems still use CNNs because they are fast, predictable, and strong when data has local spatial structure.`,
        `Convolution also remains useful outside deep learning. Blur, sharpen, emboss, edge detection, and Gaussian smoothing are ordinary image-processing kernels. A CNN can be seen as a learned stack of these local operations, with nonlinearities and channel mixing between them. Even vision transformers often begin by splitting an image into patches with a convolution-like projection before attention handles global relationships.`,
      ],
    },
    {
      heading: `Failure modes and limits`,
      paragraphs: [
        `Padding and stride are common sources of silent errors. Valid padding shrinks feature maps. Same padding introduces artificial border values. Stride can throw away detail. Dilation expands the receptive field but may create sparse sampling artifacts. A model can look correct on average while failing on small objects, thin boundaries, or features near the image edge because these choices damaged spatial information.`,
        `CNNs can also learn shortcuts. They may rely on background, texture, scanner artifacts, watermark patterns, or dataset-specific color statistics instead of the intended object. They are not automatically robust to rotation, scale, lighting, occlusion, adversarial perturbations, or distribution shift. First-layer filters are often interpretable, but deeper features are not guaranteed to map to human concepts. Convolution is a strong inductive bias, not a full theory of vision.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Neural Network Forward Pass, Activation Functions, Backpropagation, Gradient Descent, Regularization: L1 & L2, Batch Normalization, and Loss Landscape, in 3D to understand how convolutional networks train. Then compare Convolution with Attention Mechanism and Multi-Head Attention. The useful contrast is local shared filtering versus global content-based mixing. CNNs bring the structure of grids into the model; attention lets distant positions interact more directly, but usually pays more compute and needs more data or pretraining.`,
      ],
    },
  ],
};
