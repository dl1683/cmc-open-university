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
      heading: 'What it is',
      paragraphs: [
        'Diffusion models are generative models trained by adding noise to data and learning to reverse that noising process. They became central to image generation because the training target is stable, the samples are high quality, and the method scales well with large neural denoisers.',
        'The local document corpus has a diffusion-model investigation, and this module turns the core mechanism into an animation: forward corruption is fixed, reverse denoising is learned, and sampling is many small refinement steps from noise to structure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The forward process gradually corrupts a clean example x0 into noisy xt and eventually xT, which is close to pure noise. Because the corruption process is known, training can ask the neural network to predict the noise added at a timestep or an equivalent clean-sample direction. The timestep is an input because the denoising problem changes with noise level.',
        'Generation runs the process backward. Start from random noise. At each step, the denoiser predicts how to remove a little noise, and the sampler updates the sample. After many steps, a structured image, audio sample, molecule, or latent representation emerges.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Diffusion quality often comes from iterative computation, so sampling latency can be expensive. Fewer steps reduce cost but can hurt detail. Classifier-free guidance improves prompt adherence but can reduce diversity or create artifacts when pushed too hard. Latent diffusion reduces pixel-space cost by generating in a compressed latent representation, but it depends on an autoencoder and decoder quality.',
        'The training loop also has subtle choices: noising schedule, prediction target, architecture, conditioning, loss weighting, and sampler. Gradient Descent and Backpropagation still do the optimization work, but the generative framing is different from autoregressive language modeling.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Diffusion models are used for text-to-image generation, image editing, inpainting, super-resolution, video generation, 3D asset generation, molecule design, audio generation, and some recent language-model experiments. The important general lesson is broader than images: hard generation can be made easier by learning a sequence of local denoising moves.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Diffusion models do not store one training image and retrieve it by default, but they can still memorize or reproduce sensitive training examples if training data and safeguards are weak. They are also not automatically faithful to prompts. Guidance improves conditioning but can create overconfident or distorted samples. Evaluation remains difficult because likelihood, FID, human preference, safety, and diversity do not always agree.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Denoising Diffusion Probabilistic Models at https://proceedings.neurips.cc/paper_files/paper/2020/hash/4c5bcfec8584af0d967f1ab10179ca4b-Abstract.html and https://arxiv.org/abs/2006.11239, Deep Unsupervised Learning using Nonequilibrium Thermodynamics at https://arxiv.org/abs/1503.03585, Score-Based Generative Modeling through Stochastic Differential Equations at https://arxiv.org/abs/2011.13456, and Classifier-Free Diffusion Guidance at https://arxiv.org/abs/2207.12598. Study Gradient Descent, Backpropagation, Convolution, Softmax & Temperature, and Batch Size Scaling next.',
      ],
    },
  ],
};
