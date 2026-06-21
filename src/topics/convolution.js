// Convolution: slide a tiny grid of weights over an image and watch it
// light up wherever its pattern appears. Nine numbers that can find every
// edge in a photo — the atom of computer vision.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'convolution',
  title: 'Convolution',
  category: 'AI & ML',
  summary: 'Slide a 3Ã—3 kernel across an image — the same nine weights detect a pattern everywhere at once.',
  controls: [
    { id: 'kernel', label: 'Kernel', type: 'select', options: ['vertical edge detector', 'box blur', 'sharpen'], defaultValue: 'vertical edge detector' },
  ],
  run,
};

// A 6Ã—6 toy image: dim on the left, bright on the right — one vertical edge.
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
    explanation: 'To a computer, an image is a grid of numbers — here 6Ã—6 brightness values, dim (1–2) on the left and bright (8–9) on the right, with one vertical edge between them. Real photos are the same thing, just millions of numbers across three color channels.',
  };

  yield {
    state: matrixState({
      title: `The kernel: ${String(input.kernel)}`,
      rows: K.map((_, i) => ({ id: `kr${i}`, label: `k${i}` })),
      columns: K[0].map((_, j) => ({ id: `kc${j}`, label: '' })),
      values: K.map((row) => row.map(r1)),
    }),
    highlight: {},
    explanation: `The KERNEL is a 3Ã—3 grid of weights — ${choice.why} In a CNN these nine numbers are LEARNED by Gradient Descent; classic image editors hand-pick them. Either way, the operation is identical: slide it everywhere.`,
  };

  // convolve (valid padding): output is 4Ã—4
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
      explanation: `Position (${i},${j}): lay the kernel over this 3Ã—3 window, multiply each pixel by its weight, and add it all up — one dot product â†’ output value ${out[i][j]}. ${j === 0 ? 'That single number says how strongly THIS patch matches the kernel\'s pattern.' : j === 1 ? 'Slide one pixel right, repeat. Same nine weights, new window.' : `Now the window straddles the bright/dim boundary — ${Math.abs(out[i][j]) > Math.abs(out[i][1]) ? 'and the response JUMPS.' : 'watch the response change.'}`}`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation displays a 6 by 6 brightness grid and a 3 by 3 kernel (filter). Highlighted cells are the current window: the kernel is laid over those nine pixels. Each step multiplies each pixel by the kernel weight at the same position, sums the nine products, and writes one number into the output feature map.',
        {type: 'callout', text: 'Convolution works because one small learned pattern is reused at every spatial location to build a feature map.'},
        'The feature map is a smaller grid (4 by 4 with valid padding) where each cell records how strongly the kernel pattern matched at that position. When the edge-detector kernel straddles the dim-bright boundary, the output value jumps. When it sits inside a flat region, the output is near zero. The same nine weights produce every cell in the feature map. That reuse is weight sharing.',
        'Max-pooling, shown in deeper CNN diagrams, highlights a small window (typically 2 by 2) and keeps only the largest value, halving spatial dimensions while preserving the strongest activation.',
      
        {type: 'image', src: './assets/gifs/convolution.gif', alt: 'Animated walkthrough of the convolution visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Images have spatial structure. Neighboring pixels form edges, textures, and shapes. The same edge can appear anywhere in the frame. A recognition system needs to detect local patterns and reuse those detectors across the entire image.',
        'LeCun, Bottou, Bengio and Haffner showed in 1998 (LeNet-5) that a network built from small, sliding filters could learn to read handwritten digits without hand-designed feature extractors. Each filter scans the whole image, so the network uses far fewer parameters than a fully connected layer and automatically gains translation sensitivity: the same detector fires wherever its pattern appears.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Typical_cnn.png/500px-Typical_cnn.png', alt: 'Typical convolutional neural network architecture showing input, feature maps, convolutions, subsampling, and fully connected output', caption: 'A CNN stacks local convolution and downsampling stages so early feature maps become inputs to deeper detectors. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Typical_cnn.png.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Flatten the image into a vector and feed it to a fully connected network. A 224 by 224 RGB image has 150,528 input values. One hidden layer of 1,000 units creates 150,528 times 1,000 = 150 million weights. Each weight connects one pixel to one hidden unit with no notion of spatial proximity.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The fully connected layer hits three walls at once. First, parameter explosion: 150 million weights for a single layer, most connecting pixels that are spatially unrelated. The model overfits on small datasets because it has too many free parameters to constrain. Second, no translation invariance: a cat learned in the top-left corner is a different pattern from the same cat in the bottom-right, because every position maps to a different set of weights. Third, no locality: the layer has no built-in idea that adjacent pixels matter more than distant ones, so it must learn spatial structure from scratch.',
        'Hand-designed filters (Sobel, Gaussian) avoid the parameter problem by using small sliding windows, but they cannot adapt. A Sobel kernel detects edges and nothing else. It cannot become a texture detector or a tumor-boundary detector without a human redesigning it. The breakthrough was combining the efficiency of the sliding window with learned weights.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A convolutional layer slides a small filter (typically 3 by 3) across the input. At each position, it performs element-wise multiplication between the filter weights and the pixel values under it, then sums the nine products into one output value. That output is one cell of the feature map.',
        'Stride controls how far the filter jumps between positions. Stride 1 moves one pixel at a time. Stride 2 skips every other position, halving the output dimensions. Padding adds border values (usually zeros) so the output can keep the same spatial size as the input (same padding) or shrink naturally (valid padding, no border added).',
        'Pooling follows convolution. Max-pooling takes a small window (commonly 2 by 2), keeps the largest value, and discards the rest, halving height and width. Average-pooling keeps the mean instead. Pooling reduces computation for the next layer and provides a degree of local translation invariance: if a feature shifts by one pixel, the maximum in the window often stays the same.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Convolutional_neural_network%2C_maxpooling.png/330px-Convolutional_neural_network%2C_maxpooling.png', alt: 'Worked max pooling example with a single-channel image split into 2 by 2 pooling windows', caption: 'Max pooling keeps the strongest activation in each local window, shrinking the feature map while preserving high responses. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Convolutional_neural_network,_maxpooling.png.'},
        'Channels extend the idea to color and depth. An RGB image has 3 input channels. A 3 by 3 filter on RGB input actually has 3 times 3 times 3 = 27 weights (plus one bias). A layer with 64 such filters produces 64 output channels, one feature map per filter. The next layer treats those 64 maps as its input channels, combining simple features into richer ones.',
        'Parameter sharing is the key efficiency. One 3 by 3 filter has 9 weights (per input channel) regardless of whether the image is 32 by 32 or 1024 by 1024. A fully connected layer to the same output would need millions of weights that grow with image size.',
        'A typical CNN architecture stacks these operations: Conv, ReLU activation, Conv, ReLU, Pool, repeated several times to build a hierarchy of features, then flattens the final feature maps into a vector and passes it through one or two fully connected layers to a softmax classifier.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Local connectivity captures spatial patterns. An edge is a relationship between neighboring pixels, not between a pixel and one 200 rows away. A small filter is the right tool because the relevant information is local.',
        'Weight sharing gives translation equivariance. If the input shifts right by one pixel, the feature map shifts right by one pixel. The filter does not need to relearn the pattern at every coordinate. Pooling and later layers convert this equivariance into approximate translation invariance for the final classification.',
        'Hierarchical features emerge from depth. Layer 1 filters learn edges and color gradients because those are the simplest useful local patterns. Layer 2 combines edges into corners and textures. Layer 3 combines textures into parts (eyes, wheels, windows). Layer 4 combines parts into objects. No one designs these features; they emerge from backpropagation minimizing the classification loss. This hierarchy is why a 20-layer CNN can distinguish 1,000 ImageNet categories while each individual filter has fewer than 30 weights.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A single convolutional layer with kernel size K, input channels C_in, output channels C_out, and spatial output size H by W performs K squared times C_in times C_out times H times W multiply-accumulate operations. For a 3 by 3 conv layer with 64 input and 128 output channels on a 56 by 56 feature map: 9 times 64 times 128 times 56 times 56 = about 231 million MACs.',
        'The parameter count is much smaller: K squared times C_in times C_out plus C_out biases. For the same layer: 9 times 64 times 128 + 128 = 73,856 parameters. Compare that to a fully connected layer connecting the same 64 times 56 times 56 = 200,704 inputs to 128 outputs: 25.7 million parameters. Convolution is 350 times more parameter-efficient here.',
        'Doubling the image resolution quadruples the compute (H and W both double) but leaves the parameter count unchanged. Doubling the number of filters doubles both parameters and compute. GPUs handle convolutions well because every output position can be computed independently, making the operation highly parallel.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'AlexNet (Krizhevsky, Sutskever, Hinton 2012) cut the ImageNet top-5 error from 26 percent to 16 percent, proving learned convolutional features could replace decades of hand-engineered descriptors. VGG (Simonyan and Zisserman 2014) showed that stacking many 3 by 3 filters outperforms fewer large filters. ResNet (He et al. 2015) introduced skip connections that enabled 152-layer CNNs without vanishing gradients.',
        'Object detection systems like YOLO and Faster R-CNN use CNN backbones to extract features, then add detection heads for bounding boxes and class labels. Medical imaging uses CNNs for tumor detection in CT scans, retinal disease screening, and pathology slide analysis, where local texture and boundary patterns are the primary signal. Autonomous driving perception stacks use CNNs for lane detection, pedestrian recognition, and traffic sign classification.',
        'CNNs also power non-image tasks with local structure: audio classification over spectrograms, 1D convolutions for time-series analysis, and text classification (though transformers have largely replaced them for language).',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Rotation invariance is not built in. A CNN trained on upright faces may fail on rotated ones unless the training data includes rotations (data augmentation) or the architecture adds explicit rotation handling. Scale invariance has the same limitation: a filter trained on large objects may miss small ones unless multi-scale processing is used.',
        'Global context requires many stacked layers. A 3 by 3 filter sees 3 pixels. Two stacked 3 by 3 filters see 5 pixels (the receptive field grows slowly). Relating the top-left corner to the bottom-right corner of a 224 by 224 image requires dozens of layers or architectural tricks like dilated convolutions and global pooling. Attention mechanisms (Vision Transformer, Dosovitskiy et al. 2020) handle long-range dependencies more directly, though at higher compute cost and data hunger.',
        'CNNs can learn shortcuts: relying on background context, watermarks, or scanner artifacts instead of the actual object. They are not robust to adversarial perturbations (small, imperceptible pixel changes that flip the predicted class) or distribution shift (training on hospital A, deploying at hospital B).',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input (5 by 5):\n  0  0  0  0  0\n  0  0  0  0  0\n  0  0  1  0  0\n  0  0  0  0  0\n  0  0  0  0  0',
        'Filter (3 by 3):\n  1  0 -1\n  2  0 -2\n  1  0 -1',
        'This is the Sobel vertical-edge detector. Valid padding, stride 1, so the output is (5-3+1) by (5-3+1) = 3 by 3.',
        'Position (0,0) covers rows 0-2, columns 0-2. The patch is [[0,0,0],[0,0,0],[0,0,1]]. Dot product: 0*1 + 0*0 + 0*(-1) + 0*2 + 0*0 + 0*(-2) + 0*1 + 0*0 + 1*(-1) = -1.',
        'Position (0,1) covers rows 0-2, columns 1-3. Patch: [[0,0,0],[0,0,0],[0,1,0]]. Dot product: 0 + 0 + 0 + 0 + 0 + 0 + 0 + 1*0 + 0 = 0.',
        'Position (0,2) covers rows 0-2, columns 2-4. Patch: [[0,0,0],[0,0,0],[1,0,0]]. Dot product: 0 + 0 + 0 + 0 + 0 + 0 + 1*1 + 0 + 0 = 1.',
        'Position (1,0): patch [[0,0,0],[0,0,1],[0,0,0]]. Dot product: 0 + 0 + 0 + 0 + 0 + 1*(-2) + 0 + 0 + 0 = -2.',
        'Position (1,1): patch [[0,0,0],[0,1,0],[0,0,0]]. Dot product: 0 + 0 + 0 + 0 + 1*0 + 0 + 0 + 0 + 0 = 0.',
        'Position (1,2): patch [[0,0,0],[1,0,0],[0,0,0]]. Dot product: 0 + 0 + 0 + 1*2 + 0 + 0 + 0 + 0 + 0 = 2.',
        'Position (2,0): patch [[0,0,1],[0,0,0],[0,0,0]]. Dot product: 0 + 0 + 1*(-1) + 0 + 0 + 0 + 0 + 0 + 0 = -1.',
        'Position (2,1): patch [[0,1,0],[0,0,0],[0,0,0]]. Dot product: 0 + 1*0 + 0 + 0 + 0 + 0 + 0 + 0 + 0 = 0.',
        'Position (2,2): patch [[1,0,0],[0,0,0],[0,0,0]]. Dot product: 1*1 + 0 + 0 + 0 + 0 + 0 + 0 + 0 + 0 = 1.',
        'Full output feature map (3 by 3):\n  -1   0   1\n  -2   0   2\n  -1   0   1',
        'The filter found the single bright pixel. Negative values to the left mean brightness increases rightward. Positive values to the right mean brightness decreases rightward. Zero in the center means the pixel itself sits symmetrically. Shift the bright pixel one column right and the entire output pattern shifts one column right, with the same filter weights. That is translation equivariance.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'LeCun, Bottou, Bengio, Haffner 1998, Gradient-Based Learning Applied to Document Recognition. Krizhevsky, Sutskever, Hinton 2012, ImageNet Classification with Deep Convolutional Neural Networks. He, Zhang, Ren, Sun 2015, Deep Residual Learning for Image Recognition. Dosovitskiy et al. 2020, An Image Is Worth 16x16 Words: Transformers for Image Recognition at Scale.',
        'Foundations: study Activation Functions (ReLU between conv layers is what makes depth useful), Backpropagation (how filter weights are learned from the loss gradient), Batch Normalization (stabilizes training of deep CNNs by normalizing layer inputs).',
        'Extensions: study Residual Connections (skip connections that enable 100+ layer CNNs), Pooling (spatial downsampling and local invariance), Attention Mechanism and Vision Transformer (global context via attention instead of local filtering).',
        'The useful contrast: CNNs assume locality and share weights spatially. Transformers assume all positions may be relevant and learn which ones to attend to. CNNs are cheaper per layer but need depth for global context. Transformers are expensive but see everything at once.',
      ],
    },
  ],
};
