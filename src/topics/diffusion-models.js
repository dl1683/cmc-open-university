// Diffusion models: destroy data with a known noising process, then train a
// neural net to reverse the corruption one denoising step at a time.

import { matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'diffusion-models',
  title: 'Diffusion Models',
  category: 'AI & ML',
  summary: 'Generative modeling as iterative denoising: forward noising schedules, learned reverse steps, and guidance tradeoffs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['forward noising', 'reverse denoising'], defaultValue: 'forward noising' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

const BASE = [
  [0.0, 0.1, 0.8, 0.1, 0.0],
  [0.1, 0.8, 1.0, 0.8, 0.1],
  [0.8, 1.0, 1.0, 1.0, 0.8],
  [0.1, 0.8, 1.0, 0.8, 0.1],
  [0.0, 0.1, 0.8, 0.1, 0.0],
];

const NOISE = [
  [0.9, 0.2, 0.7, 0.1, 0.6],
  [0.3, 0.8, 0.1, 0.9, 0.4],
  [0.6, 0.0, 0.5, 0.2, 1.0],
  [0.7, 0.4, 0.8, 0.3, 0.2],
  [0.1, 0.9, 0.4, 0.6, 0.5],
];

function imageMatrix(title, noiseAmount) {
  const rows = BASE.map((_, i) => ({ id: `r${i}`, label: String(i + 1) }));
  const columns = BASE[0].map((_, i) => ({ id: `c${i}`, label: String(i + 1) }));
  const values = BASE.map((row, r) => row.map((v, c) => (1 - noiseAmount) * v + noiseAmount * NOISE[r][c]));
  return matrixState({
    title,
    rows,
    columns,
    values,
    format: (value) => value.toFixed(2),
  });
}

function* forwardNoising() {
  yield {
    state: imageMatrix('x0: a clean training example', 0.0),
    highlight: { active: ['r2:c2'], found: ['r1:c1', 'r1:c3', 'r3:c1', 'r3:c3'] },
    explanation: 'A diffusion model starts with real data. This toy matrix stands in for an image. Training does not ask the model to generate it in one jump; training creates many corrupted versions at different noise levels.',
  };

  yield {
    state: imageMatrix('xt at moderate noise', 0.35),
    highlight: { compare: ['r2:c2', 'r0:c0'], active: ['r1:c3', 'r3:c0'] },
    explanation: 'The forward process is fixed and known: add a little Gaussian noise at each timestep. At moderate noise, the original pattern is still visible, but every cell has been perturbed.',
    invariant: 'The forward process is not learned; the reverse process is learned.',
  };

  yield {
    state: imageMatrix('xT: almost pure noise', 0.9),
    highlight: { removed: ['r2:c2'], compare: ['r0:c0', 'r4:c1', 'r2:c4'] },
    explanation: 'After enough steps, the sample is almost indistinguishable from noise. Generation will start from this kind of noise and run the learned reverse process back toward structured data.',
  };

  yield {
    state: labelMatrix(
      'What the model learns at each timestep',
      [
        { id: 'input', label: 'noisy xt' },
        { id: 'time', label: 'timestep t' },
        { id: 'net', label: 'denoiser' },
        { id: 'loss', label: 'training loss' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['corrupted example', 'condition on noise level'],
        ['noise schedule position', 'same image can appear many ways'],
        ['predict noise or clean sample', 'learn reverse step'],
        ['match known noise', 'supervision is synthetic'],
      ],
    ),
    highlight: { found: ['net:role', 'loss:why'], active: ['input:role', 'time:role'] },
    explanation: 'The training target is available because we created the corruption. The network sees noisy xt and t, then predicts the noise that was added or the clean sample direction.',
  };
}

function* reverseDenoising() {
  yield {
    state: imageMatrix('Start generation from noise', 1.0),
    highlight: { active: ['r0:c0', 'r2:c4', 'r4:c1'], compare: ['r2:c2'] },
    explanation: 'Sampling starts from random noise, not from a database lookup. The model then performs many reverse steps. Each step is small because the learned task is local: remove a little noise at this timestep.',
  };

  yield {
    state: imageMatrix('Reverse step: predict and subtract noise', 0.65),
    highlight: { active: ['r2:c2'], found: ['r1:c1', 'r1:c3', 'r3:c1', 'r3:c3'] },
    explanation: 'The denoiser predicts the noise component consistent with both the current sample and timestep. Subtracting that prediction nudges the sample toward the data manifold.',
    invariant: 'Sampling is iterative refinement, not one forward pass.',
  };

  yield {
    state: imageMatrix('Later reverse step: structure reappears', 0.25),
    highlight: { found: ['r2:c2', 'r1:c1', 'r1:c3', 'r3:c1', 'r3:c3'], compare: ['r0:c0'] },
    explanation: 'As noise decreases, global structure becomes visible. High-quality diffusion systems spend many steps here, although faster samplers reduce the number of steps by changing the numerical integration path.',
  };

  yield {
    state: labelMatrix(
      'Guidance and sampler choices',
      [
        { id: 'cfg', label: 'classifier-free guidance' },
        { id: 'steps', label: 'fewer steps' },
        { id: 'latent', label: 'latent diffusion' },
        { id: 'eval', label: 'evaluation' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['stronger prompt following', 'can reduce diversity'],
        ['lower latency', 'can lose detail'],
        ['cheaper pixels', 'needs autoencoder'],
        ['FID and human preference', 'metrics disagree'],
      ],
    ),
    highlight: { active: ['cfg:benefit', 'steps:benefit', 'latent:benefit'], compare: ['eval:tradeoff'] },
    explanation: 'Modern diffusion systems add guidance, latent spaces, distillation, and faster samplers. The core idea remains the same: learn how to reverse a controlled corruption process.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'forward noising') yield* forwardNoising();
  else if (view === 'reverse denoising') yield* reverseDenoising();
  else throw new InputError('Pick a diffusion-model view.');
}

export const article = {
  sections: [
    {
      heading: 'The problem',
      paragraphs: [
        `A generative model has to learn a distribution, not a lookup table. For images, that means learning what natural pixels look like together: edges, texture, object parts, lighting, perspective, style, and the strange long-range constraints that make a face or room feel coherent. The output space is enormous. A 512 by 512 RGB image already has hundreds of thousands of values, and almost every possible assignment of those values is meaningless noise.`,
        `The hard part is that the model must create a sample that is both diverse and plausible. If it only memorizes training images, it fails as a generative model. If it spreads probability too broadly, it produces blur or nonsense. Diffusion models solve this by turning generation into a sequence of small repair problems. Instead of asking one network to jump from nothing to a finished image, training asks it to remove a known amount of noise from a partially corrupted example.`,
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        `A first attempt might train a neural net to emit an entire image directly from a random vector. That can work in some settings, but the learning signal is awkward. A bad image can be wrong in countless ways, and a single global loss often rewards average-looking outputs. The model has to invent fine detail, global arrangement, and sample diversity all at once.`,
        `Another approach is autoregression: generate pixels or patches one at a time. That gives a clean probability factorization, but long sequences are expensive and the order is arbitrary for images. The model spends computation deciding tiny local values while still needing global consistency. The wall is not only compute. The wall is credit assignment: how should a training objective tell the model which local correction would have made the sample more realistic?`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `Diffusion creates its own supervised task. Start with a real training example x0. Choose a timestep t. Add noise according to a fixed schedule to produce xt. Because the training procedure created the noisy example, it knows the exact noise that was added. The denoiser can be trained to predict that noise, or an equivalent target such as the clean sample direction or velocity parameterization.`,
        `This turns generation into learned reverse thermodynamics. The forward process is a known corruption path from data toward simple noise. The reverse process is a learned path from simple noise back toward data. The model does not need labels from humans for every pixel-level repair. The corruption process supplies synthetic supervision, and the neural network learns the statistical direction that moves a noisy point closer to the data manifold.`,
      ],
    },
    {
      heading: 'Forward process',
      paragraphs: [
        `The forward process is deliberately boring. At timestep zero the sample is clean. At later timesteps, Gaussian noise is mixed in according to a variance schedule. Early steps preserve much of the original structure. Middle steps leave a ghost of the object but disturb local values. Late steps are almost pure noise. The schedule is chosen so the final distribution is easy to sample, usually close to a standard normal distribution.`,
        `The timestep matters because the denoising problem changes. At low noise, the model is doing fine cleanup: sharpen an edge, remove speckle, restore texture. At high noise, the model must infer broad structure from almost nothing. Training therefore gives the network both xt and t. In conditional models, the network also receives text embeddings, class labels, masks, depth maps, audio features, or other conditioning signals that say what kind of sample should emerge.`,
      ],
    },
    {
      heading: 'Reverse sampling',
      paragraphs: [
        `Sampling begins from random noise. The denoiser predicts a small move at the current timestep, and the sampler uses that prediction to produce a slightly less noisy sample. Repeat the process many times and structure appears. The repeated loop is the price of the method and also the source of its controllability: intermediate states can be guided, masked, edited, restarted, or blended.`,
        `Different samplers interpret the learned denoising field in different ways. The original DDPM sampler is stochastic and step-by-step. DDIM and later ODE or SDE solvers can take larger, more deterministic steps. Distillation methods train smaller or specialized models to approximate many denoising steps with fewer calls. The conceptual invariant is the same: generation follows a learned vector field from noise toward the training distribution.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `In the toy matrix in this topic, the clean sample is a bright diamond-like pattern. The forward view mixes each cell with a fixed noise matrix. At 35 percent noise, the center is still recognizable but the values no longer perfectly match the original. At 90 percent noise, the pattern is barely visible. Training examples are created at many such noise levels, so the model learns a family of repairs rather than one cleanup operation.`,
        `During generation, the process runs in the opposite direction. The first frame is random-looking. A reverse step predicts the noise component and subtracts it. Later steps recover the center and symmetric arms. This toy example hides the neural architecture, but it preserves the essential bookkeeping: x0 is clean data, xt is a noisy intermediate, t tells the denoiser how much corruption to expect, and the loss compares the prediction with a target known from the forward process.`,
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        `The important visual lesson is that the model is not trained by starting from noise and hoping for the best. Training starts from real data, corrupts it with a known random process, and asks the model to predict a local correction. Sampling then reuses that local correction rule repeatedly from the high-noise end of the schedule.`,
        `The guidance table shows why production systems are more than the base denoiser. Classifier-free guidance compares a conditional prediction with an unconditional prediction and pushes the sample toward the condition. Latent diffusion performs denoising in a compressed representation rather than raw pixels. Fast samplers change the numerical path. Evaluation has to consider visual quality, prompt following, diversity, safety, and whether the model memorizes rare training examples.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The main cost is iterative inference. If a model needs 30, 50, or 100 denoiser calls per sample, latency and GPU memory become central product constraints. Fewer steps save compute but can lose detail, color consistency, or global structure. Larger denoisers improve quality but increase training and serving cost. Latent diffusion reduces pixel-space work, but the autoencoder can introduce compression artifacts and limits what details can be represented.`,
        `Guidance is also a tradeoff. Stronger classifier-free guidance often improves prompt adherence, yet it can reduce diversity and push images into oversaturated, brittle, or distorted regions. Conditioning can conflict with the learned data prior: a prompt may request an impossible pose, a mask may remove necessary context, or a control signal may be noisy. Diffusion systems are powerful because they expose these controls, but every control changes the distribution being sampled.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Diffusion works especially well when the output is continuous, high dimensional, and tolerant of iterative refinement. Text-to-image generation, inpainting, image-to-image editing, super-resolution, video, audio, 3D asset generation, and molecular conformation search all fit this shape. The method is good at combining global plausibility with local detail because late denoising steps can spend compute on texture while earlier steps settle coarse structure.`,
        `It is also useful when conditioning is rich. A model can condition on text, class labels, bounding boxes, segmentation maps, depth, edges, pose, low-resolution images, or previous frames. The same denoising backbone can become a generator, editor, restorer, or controlled simulator depending on the conditioning and sampler.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Diffusion is not automatically factual, aligned, or controllable. A text prompt is a weak specification, and the model may satisfy surface cues while violating counts, identities, spatial relations, or safety constraints. Repeated denoising can also amplify artifacts. Hands, text rendering, object permanence in video, and exact geometry remain difficult because the model is optimizing learned visual plausibility rather than a symbolic scene graph.`,
        `The training data can leak into outputs. Diffusion models do not normally retrieve a stored image by design, but rare images, duplicated images, copyrighted works, private medical images, and personally identifying content can be memorized if the dataset and training process allow it. Evaluation is therefore not one number. Likelihood, FID, CLIP score, human preference, safety filters, diversity, and memorization tests each catch different failures.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Denoising Diffusion Probabilistic Models at https://proceedings.neurips.cc/paper_files/paper/2020/hash/4c5bcfec8584af0d967f1ab10179ca4b-Abstract.html and https://arxiv.org/abs/2006.11239, Deep Unsupervised Learning using Nonequilibrium Thermodynamics at https://arxiv.org/abs/1503.03585, Score-Based Generative Modeling through Stochastic Differential Equations at https://arxiv.org/abs/2011.13456, and Classifier-Free Diffusion Guidance at https://arxiv.org/abs/2207.12598.`,
        `Good next topics are Gradient Descent for the optimization loop, Backpropagation for how the denoiser learns, Convolution for image architectures, Softmax & Temperature for sampling intuition, Variational Autoencoders for latent representations, Consistency Distillation for few-step generation, and Discrete Diffusion Language Models for what changes when the state space is tokens instead of pixels.`,
      ],
    },
  ],
};
