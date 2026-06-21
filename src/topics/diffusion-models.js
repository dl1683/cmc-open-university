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
      heading: 'How to read the animation',
      paragraphs: [
        `The forward-noising view starts with a clean 5x5 matrix representing an image -- a diamond pattern where high values form the shape and low values sit at the edges. Each frame adds more Gaussian noise. Active cells (highlighted) show where the noise perturbation is largest right now. Found cells mark values that still resemble the original pattern. Watch the diamond dissolve: that dissolution is the forward process, and the model's entire job is to learn how to reverse it.`,
        {type: `callout`, text: `Diffusion turns generation into many supervised denoising steps, so the model learns the reverse path from noise back to data.`},
        `The reverse-denoising view starts from near-pure noise and runs backward. Active cells show where the denoiser is making its largest corrections. Found cells mark values that have converged close to the clean target. The training table highlights the denoiser and loss rows as found because those are the learned components; the input and timestep rows are active because they are given conditioning, not learned.`,
        `At each frame, ask two questions: how much original structure survives at this noise level, and what kind of prediction must the denoiser make -- fine texture cleanup (low noise) or coarse structure inference (high noise)?`,
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Generating realistic images means sampling from a distribution over hundreds of thousands of pixel values where almost every possible combination is meaningless noise. The model must produce outputs that are both diverse (not memorized copies) and plausible (not blur or nonsense). Sohl-Dickstein et al. (2015) proposed a thermodynamic solution: destroy data gradually with a known noising process, then train a neural network to reverse the destruction one small step at a time. The idea languished because the original formulation was expensive and the results were modest.`,
        {type: `image`, src: `https://lilianweng.github.io/posts/2021-07-11-diffusion-models/diffusion-example.png`, alt: `Forward and reverse diffusion examples showing data gradually becoming noise and being denoised`, caption: `The core picture is gradual corruption followed by a learned reverse path, not one-shot decoding from a latent vector. Source: https://lilianweng.github.io/posts/2021-07-11-diffusion-models/diffusion-example.png`},
        `Ho et al. (2020) made it practical with DDPM -- Denoising Diffusion Probabilistic Models. They showed that a U-Net trained with a simple mean-squared-error loss on predicted noise, conditioned on timestep, produces samples that rival GANs without adversarial training. Song et al. (2021) unified diffusion models with score-based generative modeling through stochastic differential equations (SDEs), revealing that DDPM, score matching, and Langevin dynamics are different views of the same underlying process: learning the score function -- the gradient of the log probability density, which points from any noisy location toward the nearest data.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `GANs (Generative Adversarial Networks) were the dominant generative method before diffusion. A generator network learns to produce samples that fool a discriminator network trained to distinguish real from fake. When training succeeds, GANs produce sharp, high-resolution images in a single forward pass -- fast and visually impressive. StyleGAN2 could generate photorealistic faces at 1024x1024 in under 50 milliseconds.`,
        `VAEs (Variational Autoencoders) take a different route: encode data into a latent space with a Gaussian prior, then decode back. The KL divergence penalty keeps the latent space smooth, making training stable and mode coverage reliable. Both approaches had years of engineering investment and strong results on specific domains.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `GANs have two structural problems. First, mode collapse: if the generator finds a few outputs that fool the discriminator, it can ignore the rest of the data distribution. A GAN might generate convincing faces but only a handful of distinct ones. Second, training instability: the generator and discriminator must stay balanced, and small imbalances cascade. If the discriminator dominates, gradients vanish and the generator stops learning. If the generator dominates, the discriminator cannot catch mode collapse. Hyperparameter sensitivity, learning rate schedules, and architecture choices all affect whether training converges at all.`,
        `VAEs avoid mode collapse but produce blurry outputs. The Gaussian decoder assumption averages over plausible reconstructions rather than committing to sharp details. A VAE learns the broad shape of the distribution but smears the fine textures that make images look real.`,
        `The deeper problem behind both failures is credit assignment. A GAN's global adversarial loss on an entire image gives the generator almost no signal about which pixels or structures caused the output to be wrong. It must learn coarse layout, mid-level structure, and fine texture from a single gradient. No local, per-pixel, per-noise-level training signal exists.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Diffusion creates its own supervision. Take a real image x0. Pick a random timestep t. Add noise at the level prescribed by a fixed schedule to produce xt. Because training created the noisy example, it knows the exact noise that was added. The denoiser predicts that noise (epsilon-prediction), and the loss is the mean squared error between predicted and actual noise. Every training pair is synthetic, every gradient is local, and every noise level gets its own supervised task.`,
        {type: `image`, src: `https://lilianweng.github.io/posts/2021-07-11-diffusion-models/DDPM.png`, alt: `DDPM graphical model showing forward noising and reverse denoising chains`, caption: `DDPM frames generation as a Markov chain with a fixed forward process and learned reverse transitions. Source: https://lilianweng.github.io/posts/2021-07-11-diffusion-models/DDPM.png`},
        `Generation becomes learned reverse thermodynamics: a known corruption path from data to noise (forward), and a learned path from noise back to data (reverse). The network learns the score function -- the gradient of the log data density, written as the nabla of log p(x). At any point in the noisy space, the score points toward higher-probability regions. Following the score iteratively moves a noisy sample toward the data manifold. Score matching (Hyvarinen 2005, Song and Ermon 2019) showed how to estimate this gradient without knowing the normalizing constant of p(x). DDPM's epsilon-prediction is equivalent to score estimation: predicting the noise epsilon is the same as estimating the score, up to a scaling factor that depends on the noise level.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The forward process adds Gaussian noise over T timesteps. The noisy version at step t is x_t = sqrt(alpha_bar_t) * x0 + sqrt(1 - alpha_bar_t) * epsilon, where epsilon is standard Gaussian noise and alpha_bar_t is the cumulative product of the noise schedule. The reparameterization trick means any noise level can be reached in one jump from x0 -- no need to simulate each intermediate step during training.`,
        {type: `image`, src: `https://lilianweng.github.io/posts/2021-07-11-diffusion-models/generative-overview.png`, alt: `Overview comparing generative modeling approaches including GAN VAE flow and diffusion`, caption: `Diffusion sits beside GANs, VAEs, and flows as a distinct generative path: iterative denoising rather than adversarial scoring or direct latent decoding. Source: https://lilianweng.github.io/posts/2021-07-11-diffusion-models/generative-overview.png`},
        `The noise schedule controls how fast information is destroyed. DDPM used a linear schedule where beta increases from 0.0001 to 0.02 across 1,000 steps; this destroys signal too quickly in early steps. Nichol and Dhariwal (2021) introduced a cosine schedule that spreads destruction more evenly and preserves useful structure longer. The schedule choice matters because it determines how much of each denoising step is fine detail work versus coarse structure inference.`,
        `Training: sample a random image x0, random timestep t, and random noise epsilon. Create x_t with the reparameterization formula. Feed (x_t, t) into a U-Net. Compute MSE between the predicted noise and the actual epsilon. No adversary, no reconstruction bottleneck. The model trains on millions of independent (x_t, t, epsilon) triples.`,
        `Sampling: start from pure Gaussian noise x_T. At each step, the U-Net predicts epsilon_theta(x_t, t). The sampler subtracts a scaled version of that prediction and optionally adds fresh noise to produce x_{t-1}. Repeat for T steps. The original DDPM sampler is stochastic and requires all 1,000 steps. Song et al. (2021) introduced DDIM, which reinterprets the same trained model as defining a deterministic ODE trajectory. Because the ODE is smooth, DDIM can skip timesteps and produce good samples in 20-50 steps. Same model, same weights -- only the sampler changes. DPM-Solver and consistency models push further toward single-step generation.`,
        `Classifier-free guidance (Ho and Salimans 2022) steers conditional generation. During training, the condition (text, class label) is randomly dropped some fraction of the time, so the model learns both conditional and unconditional denoising. At inference, the model runs twice per step: epsilon_guided = epsilon_uncond + w * (epsilon_cond - epsilon_uncond). The guidance scale w (typically 3 to 15) amplifies the difference between conditional and unconditional predictions. Higher w improves prompt adherence but reduces diversity and can introduce saturation artifacts.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Each denoising step is a small, tractable problem. Reversing the entire corruption in one step is ill-posed: many clean images map to the same noise. But reversing one small step is well-conditioned because the noisy sample still carries most of the information from the previous step. The Markov chain structure means each step inherits correctness from the one before it. If the model is accurate at every noise level, composing all steps produces a valid sample from the data distribution.`,
        `The mathematical justification is score matching. The score function -- the gradient of log p(x) -- points from any location in the data space toward higher-probability regions. A perfect score estimator, combined with Langevin dynamics or an equivalent SDE solver, will generate exact samples from the data distribution. Diffusion training approximates this score at every noise level via the denoising objective. Song et al. (2021) proved that the forward noising process and the reverse denoising process satisfy a pair of SDEs, and that solving the reverse SDE with the learned score function recovers the data distribution. The epsilon-prediction loss is a denoising score matching objective: minimizing MSE on predicted noise is equivalent to minimizing the Fisher divergence between the model score and the true score.`,
        `The noise schedule provides a curriculum. At high noise levels, the model learns coarse global structure (where objects are, what category). At low noise levels, it learns fine local detail (textures, edges, shading). This natural decomposition into "easy" and "hard" sub-problems lets a single network handle the full generation task without needing to solve it all at once.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Training is standard SGD on (noisy image, noise) pairs. Each step samples one (x0, t, epsilon) triple, runs one U-Net forward pass, computes one MSE loss, and backpropagates. This is embarrassingly parallel. Stable Diffusion 1.5 trained a U-Net with roughly 860 million parameters on 256 A100 GPUs for about 150,000 GPU-hours. The loss per step is cheap; convergence requires billions of steps.`,
        `Sampling is the bottleneck. DDPM requires 1,000 U-Net forward passes per image. At roughly 10ms per pass on a modern GPU, that is 10 seconds per image. DDIM reduces this to 20-50 steps (0.2-0.5 seconds) with minimal quality loss. Consistency distillation and progressive distillation push toward 1-4 steps. Compared to GANs, which generate in a single forward pass (tens of milliseconds), diffusion is fundamentally slower. The tradeoff: stable training, no mode collapse, better diversity, and richer conditioning at the cost of slower generation.`,
        `Classifier-free guidance doubles inference cost because each step requires two U-Net evaluations (conditional and unconditional). Latent diffusion (Rombach et al. 2022) cuts pixel-space work by 64x: a pretrained VAE encoder compresses a 512x512x3 image to a 64x64x4 latent, the U-Net denoises in latent space, and the VAE decoder maps the result back to pixels. This is the architecture behind Stable Diffusion and the reason diffusion models run on consumer GPUs.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Stable Diffusion, DALL-E 2 and 3, Imagen, and Midjourney produce text-to-image results that surpassed GANs on FID (Frechet Inception Distance) scores while maintaining far better mode coverage. Sora extends diffusion to video generation. RFdiffusion applies the same framework to protein structure design -- treating 3D coordinates as the "image" and iteratively denoising backbone positions. AudioLDM generates audio by running latent diffusion on mel-spectrogram representations.`,
        `The method fits any domain where the output is continuous, high-dimensional, and tolerant of iterative refinement: inpainting, super-resolution, image editing, 3D asset generation, molecular conformation search, and music synthesis. Rich conditioning is a particular strength -- the same backbone can condition on text, class labels, bounding boxes, segmentation maps, depth, edges, pose, or previous frames, turning one denoiser into a generator, editor, restorer, or controlled simulator.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Slow sampling is the original weakness: 1,000 steps per image in DDPM. DDIM, DPM-Solver, and consistency distillation partially fix this but still lag behind GANs. High compute cost persists for training -- Stable Diffusion XL required hundreds of thousands of GPU-hours. Mode memorization is a real risk: rare or duplicated training images can be reconstructed nearly verbatim if the dataset and training process allow it.`,
        `Controllability remains hard. A text prompt is a weak specification, and the model may satisfy surface cues while violating object counts, spatial relations, identities, or safety constraints. Hands, rendered text, object permanence in video, and exact geometry are persistent failure modes because the model optimizes learned visual plausibility, not a symbolic scene graph. Classifier-free guidance helps prompt adherence but is a partial fix -- it trades diversity for fidelity and can introduce oversaturation at high guidance scales.`,
        `Evaluation is not one number. FID measures distributional similarity but misses individual-sample quality. CLIP score measures text-image alignment but not realism. Human preference captures subjective quality but is expensive and inconsistent. Memorization tests, diversity audits, and safety filters each catch different failure modes that the others miss.`,
      ],
    },
    {
      heading: 'Worked example: 1D diffusion',
      paragraphs: [
        `Start with a single data point x0 = 3.0 from a one-dimensional distribution. Use a four-step noise schedule with alpha_bar = [0.9, 0.64, 0.36, 0.04].`,
        `Forward noising. At t=1: x_1 = sqrt(0.9) * 3.0 + sqrt(0.1) * epsilon = 2.846 + 0.316 * epsilon. Suppose epsilon = 0.5, so x_1 = 3.004. At t=2: x_2 = sqrt(0.64) * 3.0 + sqrt(0.36) * epsilon = 2.4 + 0.6 * epsilon. With epsilon = -0.8, x_2 = 1.92. At t=3: x_3 = sqrt(0.36) * 3.0 + sqrt(0.64) * epsilon = 1.8 + 0.8 * epsilon. With epsilon = 1.2, x_3 = 2.76. At t=4: x_4 = sqrt(0.04) * 3.0 + sqrt(0.96) * epsilon = 0.6 + 0.98 * epsilon. With epsilon = -0.3, x_4 = 0.306. The signal-to-noise ratio drops from 9:1 at step 1 to 0.04:1 at step 4 -- nearly pure noise.`,
        `Reverse denoising. The model starts at x_4 = 0.306. It predicts the noise component at t=4 (the network has learned that values near 0.6 are likely signal at this alpha_bar). Suppose it predicts epsilon_hat = -0.31, yielding an estimated x_3 of (0.306 - 0.98 * (-0.31)) / sqrt(0.04) is approximately 2.73. At t=3, it predicts the noise for the less-noisy sample and recovers an estimate of x_2. Continue backward through t=2 and t=1, each step a small regression problem. The full generation composes four easy predictions into one hard one: recovering the original value 3.0 from near-random noise.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: Sohl-Dickstein et al. 2015, Deep Unsupervised Learning using Nonequilibrium Thermodynamics -- the first diffusion generative model, framing generation as reversing thermodynamic diffusion. Ho et al. 2020, Denoising Diffusion Probabilistic Models (DDPM) -- simplified the loss to MSE on predicted noise, used a U-Net backbone, achieved GAN-competitive image quality. Song et al. 2021, Score-Based Generative Modeling through Stochastic Differential Equations -- unified diffusion and score matching, proved the forward and reverse SDEs, enabled continuous-time formulation. Song et al. 2021, Denoising Diffusion Implicit Models (DDIM) -- deterministic sampling that cuts 1,000 steps to 20-50. Nichol and Dhariwal 2021, Improved DDPM -- cosine noise schedule and learned variance. Ho and Salimans 2022, Classifier-Free Diffusion Guidance. Rombach et al. 2022, High-Resolution Image Synthesis with Latent Diffusion Models (Stable Diffusion).`,
        `Prerequisites: Neural Networks (the denoiser is a neural net trained with gradient descent), Gaussian noise (the forward process depends on Gaussians being closed under addition), basic probability (forward and reverse processes are Markov chains with learned transition kernels).`,
        `Study next: VAE (the autoencoder used in latent diffusion and a generative model in its own right -- learn it to understand the latent space Stable Diffusion operates in), GAN (the older adversarial approach -- faster sampling, unstable training; understanding GANs clarifies what diffusion fixes), U-Net (encoder-decoder with skip connections, the standard denoiser backbone), Attention Mechanism (cross-attention injects text conditioning; self-attention captures long-range spatial dependencies within the U-Net), Classifier-Free Guidance (the standard steering technique for conditional diffusion -- how unconditional and conditional predictions combine to control generation).`,
      ],
    },
  ],
};
