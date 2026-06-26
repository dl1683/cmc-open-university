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
        'The animation shows a 6 by 6 grid of brightness values and a 3 by 3 kernel (a small grid of weights). At each step, the highlighted cells mark the current window -- the nine pixels the kernel is sitting on top of. The operation at each position is: multiply every pixel in the window by the kernel weight at the same position, sum all nine products, and write that single number into the output grid.',
        {type: 'callout', text: 'Convolution works because one small learned pattern is reused at every spatial location to build a feature map.'},
        'The output grid is called a feature map. It is smaller than the input (4 by 4 here, because a 3 by 3 kernel on a 6 by 6 input with no padding produces 6-3+1 = 4 positions per axis). Each cell in the feature map records how strongly the kernel\'s pattern matched at that location. When the edge-detector kernel overlaps the boundary between dim pixels and bright pixels, the output value spikes. When it sits entirely inside a uniform region, the output is near zero.',
        'Notice that every cell in the feature map was produced by the same nine weights. The kernel never changes -- it slides. That reuse is called weight sharing, and it is the reason convolution is so much cheaper than a fully connected layer.',
        {type: 'image', src: './assets/gifs/convolution.gif', alt: 'Animated walkthrough of the convolution visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A digital image is a grid of numbers. A 1080p color photo is 1920 by 1080 pixels across three color channels -- about 6.2 million numbers. Those numbers are not random: neighboring pixels form edges, textures, and shapes, and the same edge can appear anywhere in the frame. Any system that recognizes objects in images needs to detect local patterns and then reuse those detectors across every spatial position.',
        'Before convolutional networks, image recognition relied on hand-engineered feature extractors like SIFT or HOG. A human expert would design a formula to detect edges or corners, run it on every patch, then feed the results to a classifier. This worked for constrained problems (reading zip codes, detecting faces in controlled lighting) but broke down for general recognition because no human could anticipate every useful pattern.',
        'LeCun, Bottou, Bengio, and Haffner showed in 1998 with LeNet-5 that a network built from small, sliding, learnable filters could recognize handwritten digits without hand-designed features. Each filter scanned the whole image, so the network used far fewer parameters than a fully connected layer and automatically gained translation sensitivity: the same detector fired wherever its pattern appeared.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Typical_cnn.png/500px-Typical_cnn.png', alt: 'Typical convolutional neural network architecture showing input, feature maps, convolutions, subsampling, and fully connected output', caption: 'A CNN stacks local convolution and downsampling stages so early feature maps become inputs to deeper detectors. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Typical_cnn.png.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first thing a reasonable person tries is to flatten the image into a long vector and feed it to a fully connected neural network. A 224 by 224 RGB image has 224 * 224 * 3 = 150,528 input values. Connect those to a hidden layer of 1,000 units and you get 150,528 * 1,000 = 150.5 million weights -- just for the first layer. Each weight links one specific pixel to one hidden unit, with no notion that pixel (0, 0) is next to pixel (0, 1).',
        'This is not a silly idea. Fully connected layers are universal approximators. Given enough data, they can in principle learn any mapping from pixels to labels. The problem is not theoretical power; it is practical cost.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The fully connected approach hits three walls simultaneously. First, parameter explosion: 150 million weights for a single layer means the model has enough capacity to memorize small datasets instead of learning general patterns. It overfits because most of those weights connect pixels that have nothing to do with each other (pixel 0 in the top-left corner and pixel 150,000 in the bottom-right). Second, no translation invariance: if the network learns to recognize a cat in the top-left, the same cat in the bottom-right activates completely different weights, so it must learn the cat separately at every position. Third, no locality: the layer has no built-in preference for neighboring pixels over distant ones, so it must discover spatial structure entirely from data.',
        'Hand-designed filters like the Sobel edge detector avoid all three problems -- they are small, local, and slide across the image. But they cannot adapt. A Sobel kernel detects edges and nothing else. It will never become a texture detector or a tumor-boundary detector without a human redesigning it from scratch. The solution was to combine the sliding-window structure with weights that the network learns from data.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Instead of connecting every pixel to every hidden unit, use a small grid of weights (the kernel) and slide it across every position in the image. The kernel is tiny -- typically 3 by 3 or 5 by 5. At each position, it computes a single dot product between its weights and the patch of pixels underneath it. The same weights are reused at every position, so the kernel acts as a pattern detector that fires wherever its pattern appears.',
        'This is the core insight: local structure plus weight sharing. Locality means each output depends on only a small neighborhood, which matches how visual features actually work (an edge is a relationship between adjacent pixels, not between a pixel and one 200 rows away). Weight sharing means one set of learned weights covers the entire image, which eliminates the parameter explosion and gives translation equivariance for free -- if the input shifts, the output shifts by the same amount.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A convolutional layer takes an input grid and a kernel (filter). The kernel slides across every valid position in the input. At each position, lay the kernel on top of the input patch, multiply each kernel weight by the pixel underneath it, and sum all products. That sum is one cell of the output feature map. For a 6 by 6 input and a 3 by 3 kernel with no padding, there are 4 by 4 = 16 valid positions, producing a 4 by 4 feature map.',
        'Stride controls how far the kernel jumps between positions. Stride 1 moves one pixel at a time, covering every position. Stride 2 skips every other position, halving the output dimensions in each direction. Padding adds border values (usually zeros) around the input so the kernel can be centered on edge pixels. "Same" padding keeps the output the same spatial size as the input. "Valid" padding (no border added) shrinks the output by (kernel_size - 1) in each dimension.',
        'Channels extend the idea to color and depth. An RGB image has 3 input channels. A single 3 by 3 kernel on RGB input actually has 3 * 3 * 3 = 27 weights (plus one bias), because it must cover all three channels at each spatial position. A layer with 64 such kernels produces 64 output channels -- one feature map per kernel. The next layer treats those 64 maps as its input channels, combining simple features into richer ones.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Convolutional_neural_network%2C_maxpooling.png/330px-Convolutional_neural_network%2C_maxpooling.png', alt: 'Worked max pooling example with a single-channel image split into 2 by 2 pooling windows', caption: 'Max pooling keeps the strongest activation in each local window, shrinking the feature map while preserving high responses. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Convolutional_neural_network,_maxpooling.png.'},
        'Pooling follows convolution. Max-pooling slides a small window (commonly 2 by 2) across the feature map and keeps only the largest value in each window, halving height and width. Average-pooling keeps the mean instead. Pooling reduces the spatial dimensions (and therefore the compute for subsequent layers) and adds a small degree of local translation invariance: if a feature shifts by one pixel, the maximum in the 2 by 2 window often stays the same.',
        'A typical CNN stacks these operations in sequence: convolution, nonlinear activation (ReLU), convolution, ReLU, pooling, repeated several times to build progressively more abstract features. After the final convolutional block, the feature maps are flattened into a vector and passed through one or two fully connected layers to produce a class prediction.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Local connectivity captures spatial patterns efficiently. An edge is a relationship between neighboring pixels. A corner is a meeting point of two edges. These relationships are local -- a 3 by 3 window is the right tool because the relevant information lives in small neighborhoods. By restricting each output to depend on only 9 inputs instead of 150,000, the network focuses its capacity on patterns that actually exist in images.',
        'Weight sharing gives translation equivariance. If the entire input shifts right by one pixel, every feature map shifts right by one pixel, because the same kernel weights are applied at every position. The kernel does not need separate parameters to recognize "edge at position (10, 20)" and "edge at position (50, 80)." Pooling and deeper layers convert this equivariance into approximate translation invariance for the final classification -- a cat is a cat regardless of where it sits in the frame.',
        'Hierarchical features emerge from depth. Layer 1 filters learn edges and color gradients because those are the simplest useful local patterns. Layer 2 combines edges into corners and textures. Layer 3 combines textures into object parts (eyes, wheels, windows). Layer 4 combines parts into whole objects. Nobody designs these features. They emerge from backpropagation minimizing classification loss over thousands of training examples. This hierarchy is why a 20-layer ResNet with filters of at most 3 by 3 can distinguish 1,000 ImageNet categories.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The compute cost of one convolutional layer with kernel size K, C_in input channels, C_out output channels, and output spatial size H by W is K^2 * C_in * C_out * H * W multiply-accumulate operations. Concrete example: a 3 by 3 layer with 64 input channels and 128 output channels on a 56 by 56 feature map does 9 * 64 * 128 * 56 * 56 = roughly 231 million MACs. That sounds like a lot, but GPUs process it in under a millisecond because every output position is independent and can run in parallel.',
        'The parameter count is K^2 * C_in * C_out + C_out (the biases). For that same layer: 9 * 64 * 128 + 128 = 73,856 parameters. Compare this to a fully connected layer connecting the same 64 * 56 * 56 = 200,704 inputs to 128 outputs: 200,704 * 128 = 25.7 million parameters. Convolution is about 350 times more parameter-efficient in this case.',
        'Resolution scaling is worth understanding. Doubling the image resolution quadruples H * W, so compute quadruples -- but the parameter count stays the same because the kernel size does not change. Doubling the number of output filters doubles both parameters and compute. This separation between spatial cost and parametric cost is what makes CNNs practical at high resolutions.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'AlexNet (Krizhevsky, Sutskever, Hinton, 2012) cut ImageNet top-5 error from 26% to 16%, proving that learned convolutional features could replace decades of hand-engineered descriptors. VGG (Simonyan and Zisserman, 2014) showed that stacking many 3 by 3 filters outperforms fewer large filters. ResNet (He et al., 2015) introduced skip connections that enabled training networks with 152 layers without vanishing gradients.',
        'Object detection systems like YOLO and Faster R-CNN use CNN backbones to extract spatial features, then attach detection heads for bounding boxes and class labels. Medical imaging uses CNNs for tumor detection in CT scans, retinal disease screening, and pathology slide analysis -- domains where local texture and boundary patterns carry the diagnostic signal. Autonomous driving perception stacks use CNNs for lane detection, pedestrian recognition, and traffic sign classification.',
        'CNNs also work outside images whenever data has local structure. Audio classification runs 2D convolutions over spectrograms. Time-series forecasting uses 1D convolutions over sequential measurements. Text classification used 1D CNNs before transformers largely replaced them for language tasks.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Rotation invariance is not built in. A CNN trained on upright faces may fail on rotated ones unless the training data includes rotations (data augmentation) or the architecture adds explicit rotation handling (group-equivariant convolutions). Scale invariance has the same limitation: a kernel trained to detect large objects may miss small ones unless multi-scale processing or feature pyramids are used.',
        'Global context requires many stacked layers. A single 3 by 3 kernel sees only a 3-pixel neighborhood. Two stacked 3 by 3 layers see 5 pixels (the receptive field grows by 2 per layer). Relating the top-left corner to the bottom-right corner of a 224 by 224 image requires dozens of layers, dilated convolutions, or global pooling. Vision Transformers (Dosovitskiy et al., 2020) handle long-range dependencies more directly by letting every patch attend to every other patch, though at higher compute cost for small datasets.',
        'CNNs can learn shortcuts. A network trained on hospital A may rely on scanner-specific artifacts in the background rather than the tumor itself, then fail silently at hospital B. Adversarial perturbations -- tiny, imperceptible pixel changes -- can flip a CNN\'s prediction with high confidence. These failure modes stem from the fact that CNNs optimize for training-set accuracy, not for human-like visual reasoning.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input: a 5 by 5 image with a single bright pixel at center (2, 2). Every other pixel is 0.\n  0  0  0  0  0\n  0  0  0  0  0\n  0  0  1  0  0\n  0  0  0  0  0\n  0  0  0  0  0',
        'Kernel: the Sobel vertical-edge detector (3 by 3).\n  1  0 -1\n  2  0 -2\n  1  0 -1\nThis kernel asks: "is it brighter to my left than my right?" Positive left weights, negative right weights.',
        'With valid padding and stride 1, the output size is (5 - 3 + 1) by (5 - 3 + 1) = 3 by 3. We compute 9 output values.',
        'Position (0, 0): the 3 by 3 window covers rows 0-2, columns 0-2. The only nonzero pixel in this window is (2, 2) with value 1. That pixel aligns with kernel position (2, 2) which has weight -1. Dot product: 1 * (-1) = -1. All other terms are zero.',
        'Position (0, 1): window covers rows 0-2, columns 1-3. Pixel (2, 2) now aligns with kernel position (2, 1) which has weight 0. Dot product: 1 * 0 = 0.',
        'Position (0, 2): window covers rows 0-2, columns 2-4. Pixel (2, 2) aligns with kernel position (2, 0) which has weight 1. Dot product: 1 * 1 = 1.',
        'Position (1, 0): pixel (2, 2) aligns with kernel (1, 2), weight -2. Result: -2. Position (1, 1): aligns with kernel (1, 1), weight 0. Result: 0. Position (1, 2): aligns with kernel (1, 0), weight 2. Result: 2.',
        'Position (2, 0): pixel (2, 2) aligns with kernel (0, 2), weight -1. Result: -1. Position (2, 1): kernel (0, 1), weight 0. Result: 0. Position (2, 2): kernel (0, 0), weight 1. Result: 1.',
        'Full output feature map (3 by 3):\n  -1   0   1\n  -2   0   2\n  -1   0   1',
        'Read the result: negative values on the left mean "brightness increases to the right." Positive values on the right mean "brightness decreases to the right." Zeros in the center mean the pixel is symmetrically placed. The magnitudes are largest in the middle row because the kernel\'s center row has the largest weights (2 and -2). Now shift the bright pixel one column to the right and repeat -- the entire output pattern shifts one column right with the same kernel weights. That is translation equivariance in action.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Key papers: LeCun, Bottou, Bengio, Haffner 1998 -- "Gradient-Based Learning Applied to Document Recognition" (the LeNet-5 paper that started convolutional networks). Krizhevsky, Sutskever, Hinton 2012 -- "ImageNet Classification with Deep Convolutional Neural Networks" (AlexNet, the paper that reignited deep learning). He, Zhang, Ren, Sun 2015 -- "Deep Residual Learning for Image Recognition" (ResNet, skip connections for very deep networks). Dosovitskiy et al. 2020 -- "An Image Is Worth 16x16 Words" (Vision Transformer, the main alternative to CNNs for images).',
        'Foundations to study: Activation Functions (ReLU between conv layers is what makes depth useful -- without nonlinearity, stacking linear layers collapses to one linear layer). Backpropagation (how filter weights are learned by propagating the loss gradient back through the network). Batch Normalization (stabilizes training of deep CNNs by normalizing each layer\'s input distribution).',
        'Extensions to study: Residual Connections (skip connections that enable training networks with 100+ layers). Pooling (spatial downsampling and local invariance mechanisms). Attention Mechanism and Vision Transformer (global context via attention instead of local filtering).',
        'The key contrast to keep in mind: CNNs assume locality and share weights spatially -- cheap per layer, but need depth for global context. Transformers assume all positions may be relevant and learn which ones to attend to -- expensive per layer, but see everything at once. Modern architectures often combine both (ConvNeXt, hybrid ViTs).',
      ],
    },
  ],
};
