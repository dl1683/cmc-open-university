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
  const gridSize = BASE.length;
  const totalCells = gridSize * gridSize;
  const cleanNoise = 0.0;
  yield {
    state: imageMatrix('x0: a clean training example', cleanNoise),
    highlight: { active: ['r2:c2'], found: ['r1:c1', 'r1:c3', 'r3:c1', 'r3:c3'] },
    explanation: `A diffusion model starts with real data. This ${gridSize}x${gridSize} toy matrix (${totalCells} cells) stands in for an image at noise level ${cleanNoise}. Training does not ask the model to generate it in one jump; training creates many corrupted versions at different noise levels.`,
  };

  const moderateNoise = 0.35;
  yield {
    state: imageMatrix('xt at moderate noise', moderateNoise),
    highlight: { compare: ['r2:c2', 'r0:c0'], active: ['r1:c3', 'r3:c0'] },
    explanation: `The forward process is fixed and known: add a little Gaussian noise at each timestep. At noise level ${moderateNoise}, the original pattern across ${totalCells} cells is still visible, but every cell has been perturbed.`,
    invariant: `The forward process is not learned; only the reverse process reversing ${moderateNoise} noise back toward ${cleanNoise} is learned.`,
  };

  const heavyNoise = 0.9;
  yield {
    state: imageMatrix('xT: almost pure noise', heavyNoise),
    highlight: { removed: ['r2:c2'], compare: ['r0:c0', 'r4:c1', 'r2:c4'] },
    explanation: `After enough steps at noise level ${heavyNoise}, the ${gridSize}x${gridSize} sample is almost indistinguishable from noise. Generation will start from this kind of noise and run the learned reverse process back toward structured data.`,
  };

  const trainRows = [
    { id: 'input', label: 'noisy xt' },
    { id: 'time', label: 'timestep t' },
    { id: 'net', label: 'denoiser' },
    { id: 'loss', label: 'training loss' },
  ];
  yield {
    state: labelMatrix(
      'What the model learns at each timestep',
      trainRows,
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
    explanation: `The training target is available because we created the corruption. The network sees ${trainRows[0].label} and ${trainRows[1].label}, then predicts the noise that was added or the clean sample direction across all ${trainRows.length} components.`,
  };
}

function* reverseDenoising() {
  const gridSize = BASE.length;
  const startNoise = 1.0;
  yield {
    state: imageMatrix('Start generation from noise', startNoise),
    highlight: { active: ['r0:c0', 'r2:c4', 'r4:c1'], compare: ['r2:c2'] },
    explanation: `Sampling starts from random noise (level ${startNoise}) across a ${gridSize}x${gridSize} grid, not from a database lookup. The model then performs many reverse steps. Each step is small because the learned task is local: remove a little noise at this timestep.`,
  };

  const midNoise = 0.65;
  yield {
    state: imageMatrix('Reverse step: predict and subtract noise', midNoise),
    highlight: { active: ['r2:c2'], found: ['r1:c1', 'r1:c3', 'r3:c1', 'r3:c3'] },
    explanation: `The denoiser predicts the noise component at level ${midNoise} consistent with both the current ${gridSize}x${gridSize} sample and timestep. Subtracting that prediction nudges the sample toward the data manifold.`,
    invariant: `Sampling through noise levels ${startNoise} to ${midNoise} to 0 is iterative refinement, not one forward pass.`,
  };

  const lateNoise = 0.25;
  yield {
    state: imageMatrix('Later reverse step: structure reappears', lateNoise),
    highlight: { found: ['r2:c2', 'r1:c1', 'r1:c3', 'r3:c1', 'r3:c3'], compare: ['r0:c0'] },
    explanation: `As noise decreases to ${lateNoise}, global structure becomes visible across the ${gridSize}x${gridSize} grid. High-quality diffusion systems spend many steps here, although faster samplers reduce the number of steps by changing the numerical integration path.`,
  };

  const choiceRows = [
    { id: 'cfg', label: 'classifier-free guidance' },
    { id: 'steps', label: 'fewer steps' },
    { id: 'latent', label: 'latent diffusion' },
    { id: 'eval', label: 'evaluation' },
  ];
  yield {
    state: labelMatrix(
      'Guidance and sampler choices',
      choiceRows,
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
    explanation: `Modern diffusion systems add ${choiceRows.length} enhancements (${choiceRows.map(r => r.label).join(', ')}). The core idea remains the same: learn how to reverse a controlled corruption process.`,
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
        `The forward-noising view starts with a clean 5x5 matrix representing an image -- a diamond pattern where high values (around 0.9) form the shape and low values (around 0.1) sit at the edges. Each frame adds Gaussian noise at increasing strength. Active cells (highlighted) show where the noise perturbation is largest in the current step. Found cells mark values that still resemble the original pattern. Watch the diamond dissolve: by the final frame, the matrix is indistinguishable from random noise. That dissolution is the forward process, and the model\'s entire job is to learn how to reverse it.`,
        {type: `callout`, text: `Diffusion turns generation into many supervised denoising steps, so the model learns the reverse path from noise back to data.`},
        `The reverse-denoising view starts from near-pure noise and runs the process backward. Active cells show where the denoiser is making its largest corrections at each step. Found cells mark values that have converged close to the clean target. The training table highlights the denoiser and loss rows as found because those are the learned components; the input and timestep rows are active because they are given conditioning inputs, not learned parameters.`,
        `At each frame, track two things: how much original structure survives at this noise level, and what kind of prediction the denoiser must make. At high noise, the denoiser infers coarse structure (is this a diamond or a cross?). At low noise, it cleans up fine detail (exact pixel values at the edges). This coarse-to-fine hierarchy is central to why diffusion works.`,
        {type: 'image', src: './assets/gifs/diffusion-models.gif', alt: 'Animated walkthrough of the diffusion models visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Generating a realistic image means sampling from a probability distribution over hundreds of thousands of pixel values where almost every possible combination is meaningless noise. A 256x256 RGB image has 196,608 dimensions. The valid images -- photographs, artwork, coherent scenes -- occupy a vanishingly thin manifold within that space. A generative model must learn the shape of that manifold well enough to produce new points on it that are both diverse (not memorized copies of training data) and plausible (not blur, noise, or nonsensical composites).`,
        {type: `image`, src: `https://lilianweng.github.io/posts/2021-07-11-diffusion-models/diffusion-example.png`, alt: `Forward and reverse diffusion examples showing data gradually becoming noise and being denoised`, caption: `The core picture is gradual corruption followed by a learned reverse path, not one-shot decoding from a latent vector. Source: https://lilianweng.github.io/posts/2021-07-11-diffusion-models/diffusion-example.png`},
        `Sohl-Dickstein et al. (2015) proposed a thermodynamic approach: destroy data gradually by adding noise over many steps (a known, fixed forward process), then train a neural network to reverse the destruction one small step at a time (a learned reverse process). The idea is borrowed from non-equilibrium statistical mechanics, where a system driven out of equilibrium by a known perturbation can be reversed if you understand the dynamics well enough. The original formulation worked but was expensive and produced modest results.`,
        `Ho et al. (2020) made it practical with DDPM -- Denoising Diffusion Probabilistic Models. They showed that a U-Net (an encoder-decoder neural network with skip connections) trained with a simple mean-squared-error loss on predicted noise, conditioned on the timestep, produces samples rivaling GANs without adversarial training. Song et al. (2021) then unified diffusion with score-based generative modeling through stochastic differential equations, revealing that DDPM, score matching, and Langevin dynamics are different views of the same process: learning the score function -- the gradient of the log probability density -- which points from any noisy location toward the nearest data.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `GANs (Generative Adversarial Networks) were the dominant generative method before diffusion. A generator network learns to produce samples that fool a discriminator network trained to tell real from fake. When training works, GANs produce sharp images in a single forward pass -- StyleGAN2 generated photorealistic 1024x1024 faces in under 50 milliseconds. The approach is fast at inference and produces visually crisp outputs.`,
        `VAEs (Variational Autoencoders) take a different route: encode data into a lower-dimensional latent space constrained to follow a Gaussian prior, then decode back to pixel space. A KL divergence penalty keeps the latent space smooth, making training stable and ensuring the model covers all modes of the data distribution. Both VAEs and GANs had years of engineering investment, strong results on specific domains like faces and bedrooms, and clear architectural recipes.`,
        `A third natural idea is autoregressive generation: predict one pixel at a time, conditioned on all previous pixels, the way a language model predicts tokens. PixelCNN and Image Transformer showed this works but is extremely slow (one forward pass per pixel) and struggles to maintain global coherence because early pixel choices constrain all later ones.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `GANs suffer from two structural problems. Mode collapse occurs when the generator discovers a few outputs that consistently fool the discriminator and stops exploring the rest of the data distribution. A face-generating GAN might produce only a dozen distinct identities. Training instability compounds this: the generator and discriminator must stay balanced, and small imbalances cascade. If the discriminator gets too strong, gradients to the generator vanish and learning stalls. If the generator gets too strong, the discriminator cannot detect mode collapse, so the generator locks in.`,
        `VAEs avoid mode collapse but produce blurry outputs. The Gaussian decoder assumption forces the model to average over plausible reconstructions rather than committing to sharp details. A VAE learns the broad shape of a face but smears textures, hair strands, and fine edges into soft approximations. Increasing the latent dimension or using more expressive decoders helps partially, but the fundamental tension between the KL penalty (smoothness) and reconstruction loss (sharpness) persists.`,
        `The deeper problem behind both failures is credit assignment. A GAN\'s adversarial loss is global: one scalar ("real or fake") for the entire image. The generator gets almost no signal about which pixels, edges, or structures caused the failure. It must learn coarse layout, mid-level composition, and fine texture all from a single gradient. There is no mechanism to decompose the generation task into easier sub-problems with targeted supervision at each scale.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Diffusion creates its own training data. Take a real image x0. Pick a random timestep t from 1 to T. Add noise at the level prescribed by a fixed schedule to produce a noisy version x_t. Because the training procedure created x_t, it knows exactly which noise was added. The denoiser network predicts that noise (called epsilon-prediction), and the loss is the mean squared error between predicted and actual noise. Every training pair (x_t, epsilon) is synthetically generated, every gradient is local and well-defined, and every noise level gets its own supervised regression task.`,
        {type: `image`, src: `https://lilianweng.github.io/posts/2021-07-11-diffusion-models/DDPM.png`, alt: `DDPM graphical model showing forward noising and reverse denoising chains`, caption: `DDPM frames generation as a Markov chain with a fixed forward process and learned reverse transitions. Source: https://lilianweng.github.io/posts/2021-07-11-diffusion-models/DDPM.png`},
        `This reframes generation as learned reverse thermodynamics. The forward process is a known corruption path from data to noise. The reverse process is a learned path from noise back to data. The network learns the score function -- the gradient of the log probability density, written as nabla log p(x). At any point in the noisy data space, the score points toward regions of higher probability. Following the score iteratively moves a noisy sample toward the data manifold, like a ball rolling downhill on a probability landscape.`,
        `Score matching (Hyvarinen 2005, Song and Ermon 2019) showed how to estimate this gradient without knowing the normalizing constant of p(x), which is intractable for complex distributions. DDPM\'s epsilon-prediction is mathematically equivalent to score estimation: predicting the noise epsilon is the same as estimating the score, up to a scaling factor that depends on the noise level. This equivalence means a single U-Net trained to predict noise is simultaneously learning the geometry of the data distribution at every scale.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The forward process defines how to corrupt data. At each timestep t, a small amount of Gaussian noise is added. The key formula uses a reparameterization trick so any noise level can be reached in one jump: x_t = sqrt(alpha_bar_t) * x0 + sqrt(1 - alpha_bar_t) * epsilon, where epsilon is drawn from a standard Gaussian and alpha_bar_t is the cumulative product of (1 - beta_t) from step 1 to t. The betas form the noise schedule. When alpha_bar_t is near 1, x_t is mostly signal. When alpha_bar_t is near 0, x_t is mostly noise.`,
        {type: `image`, src: `https://lilianweng.github.io/posts/2021-07-11-diffusion-models/generative-overview.png`, alt: `Overview comparing generative modeling approaches including GAN VAE flow and diffusion`, caption: `Diffusion sits beside GANs, VAEs, and flows as a distinct generative path: iterative denoising rather than adversarial scoring or direct latent decoding. Source: https://lilianweng.github.io/posts/2021-07-11-diffusion-models/generative-overview.png`},
        `The noise schedule controls how fast information is destroyed. DDPM used a linear schedule where beta increases from 0.0001 to 0.02 across T = 1,000 steps. This destroys signal too quickly in the early steps, wasting capacity. Nichol and Dhariwal (2021) introduced a cosine schedule: alpha_bar_t = cos^2((t/T + s) / (1 + s) * pi/2), with s = 0.008. The cosine schedule spreads information destruction more evenly across timesteps, preserving useful structure longer and giving the denoiser more gradual transitions to learn.`,
        `Training is straightforward. Sample a random image x0 from the dataset. Sample a random timestep t uniformly from {1, ..., T}. Sample random noise epsilon from N(0, I). Compute x_t with the reparameterization formula. Feed (x_t, t) into a U-Net that outputs a noise prediction. Compute MSE between predicted and actual epsilon. Backpropagate. No adversary, no reconstruction bottleneck, no balancing act. The model trains on millions of independent (x_t, t, epsilon) triples.`,
        `Sampling reverses the process. Start from pure Gaussian noise x_T. At each step t from T down to 1, the U-Net predicts the noise epsilon_theta(x_t, t). The DDPM sampler computes: x_{t-1} = (1/sqrt(alpha_t)) * (x_t - (beta_t / sqrt(1 - alpha_bar_t)) * epsilon_theta) + sigma_t * z, where z is fresh Gaussian noise and sigma_t is a variance term. This is stochastic and requires all 1,000 steps. DDIM (Song et al. 2021) reinterprets the same trained model as defining a deterministic ODE trajectory, enabling step-skipping: 20-50 steps suffice for good samples. Same weights, different sampler. DPM-Solver and consistency models push further toward 1-4 step generation.`,
        `Classifier-free guidance (Ho and Salimans 2022) steers conditional generation without a separate classifier. During training, the conditioning signal (text embedding, class label) is randomly dropped with probability p_uncond (typically 0.1-0.2), so the model learns both conditional and unconditional denoising. At inference, each step runs the model twice: once with and once without the condition. The guided prediction is epsilon_guided = epsilon_uncond + w * (epsilon_cond - epsilon_uncond), where w is the guidance scale. Setting w = 1 recovers standard conditional generation. Setting w = 7.5 (a common default) amplifies the condition\'s influence, improving prompt adherence at the cost of reduced diversity.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Each denoising step is a small, well-conditioned regression problem. Reversing the entire corruption from noise to data in one step is ill-posed: many different clean images map to statistically indistinguishable noise. But reversing one small step is tractable because the noisy sample x_t still carries most of the information from x_{t-1}. The Markov chain structure means each step inherits correctness from the previous one. If the model is accurate at every noise level, composing all T steps produces a valid sample from the data distribution.`,
        `The mathematical foundation is the pair of stochastic differential equations proved by Song et al. (2021). The forward SDE dx = -0.5 * beta(t) * x * dt + sqrt(beta(t)) * dw defines a continuous-time noising process whose discretization matches DDPM\'s forward steps. The reverse SDE dx = [-0.5 * beta(t) * x - beta(t) * nabla_x log p_t(x)] * dt + sqrt(beta(t)) * dw_reverse shows that reversing the forward process requires exactly the score function nabla_x log p_t(x) at each noise level. The epsilon-prediction loss is a denoising score matching objective: minimizing MSE on predicted noise is equivalent to minimizing the Fisher divergence between the model\'s score and the true score.`,
        `The noise schedule provides a natural curriculum. At high noise levels (large t), almost all fine detail is destroyed, so the model learns only coarse global structure: where objects are, what category, rough layout. At low noise levels (small t), the sample is almost clean, so the model learns fine local corrections: textures, edges, shading, exact pixel values. This decomposition into scale-specific sub-problems lets one network handle the full generation without needing to solve everything at once.`,
        `Stability comes from the loss function. MSE on predicted noise is a single, smooth, well-behaved objective. There is no adversarial minimax, no mode-seeking versus mode-covering tension, no balancing between competing networks. The loss landscape has reliable gradients at every noise level, so training converges consistently. This is the core practical advantage over GANs: diffusion models train as reliably as classifiers.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Training cost per step is one U-Net forward pass plus one backward pass on a single (x_t, t, epsilon) triple. This is embarrassingly parallel across the batch. Stable Diffusion 1.5 trained a U-Net with roughly 860 million parameters on 256 A100 GPUs for about 150,000 GPU-hours total. Each individual step is cheap; convergence requires billions of steps because the model must learn accurate denoising at every noise level across the entire data distribution.`,
        `Sampling is the bottleneck for deployment. DDPM requires T = 1,000 sequential U-Net forward passes per image. At roughly 10ms per pass on a modern GPU, that is 10 seconds per image. DDIM reduces this to 20-50 steps (200-500ms) with minimal quality loss by exploiting the deterministic ODE interpretation. Consistency distillation and progressive distillation push toward 1-4 steps (10-40ms), approaching GAN-level speed. The tradeoff at each reduction: some sample quality or diversity is sacrificed for speed.`,
        `Latent diffusion (Rombach et al. 2022) provides the biggest efficiency gain. A pretrained VAE encoder compresses a 512x512x3 image (786,432 values) to a 64x64x4 latent (16,384 values) -- a 48x reduction in spatial dimensions. The U-Net denoises in this compact latent space, and the VAE decoder maps the result back to pixels. This is the architecture behind Stable Diffusion. It makes diffusion feasible on consumer GPUs: a 12GB card can generate 512x512 images because the U-Net never touches full-resolution pixel grids. Classifier-free guidance doubles per-step cost because each step requires two U-Net evaluations (conditional and unconditional).`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Text-to-image generation is the headline application. Stable Diffusion, DALL-E 2 and 3, Imagen, and Midjourney all use diffusion as their core generative mechanism. These systems surpassed GANs on FID (Frechet Inception Distance, a measure of distributional similarity between generated and real images) while maintaining far better mode coverage -- they generate diverse outputs rather than collapsing to a few templates. The conditioning flexibility means the same architecture handles text prompts, inpainting masks, depth maps, and edge sketches.`,
        `Video generation extends the same framework across time. Sora and similar systems treat video as a sequence of frames (or latent representations of frames) and run diffusion over the joint space. The denoiser must maintain temporal coherence -- objects should move smoothly, lighting should be consistent -- which adds architectural complexity (3D attention across space and time) but uses the same training principle: add noise, predict noise, reverse.`,
        `Beyond images and video, diffusion applies anywhere the output is continuous, high-dimensional, and tolerant of iterative refinement. RFdiffusion designs protein structures by denoising 3D backbone coordinates. AudioLDM generates audio by running latent diffusion on mel-spectrogram representations. Molecular conformation generation, 3D asset creation, music synthesis, and motion planning all use diffusion variants. The shared principle: if you can define a forward corruption and a denoising network, you can generate.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Slow sampling remains the fundamental weakness despite years of progress. Even with DDIM at 25 steps, generation takes 250ms per image -- 5-10x slower than a GAN\'s single forward pass. For interactive applications, video generation (thousands of frames), or large-scale batch generation, this cost multiplies. Consistency distillation narrows the gap but requires additional training and may sacrifice fine detail.`,
        `Controllability is limited by what the conditioning signal can express. A text prompt is a weak, ambiguous specification of a complex visual scene. The model may produce an image that matches surface keywords while violating spatial relationships ("a red ball on top of a blue cube"), exact counts ("three cats"), text rendering, hand anatomy, or physical plausibility. These failures occur because the model optimizes learned visual plausibility from training data, not a symbolic scene graph. Classifier-free guidance improves prompt adherence but trades diversity for fidelity and can introduce color oversaturation at high guidance scales.`,
        `Memorization is a real risk. When training data contains near-duplicates or when rare images appear disproportionately, the model can reproduce training examples nearly verbatim. This creates both copyright and privacy concerns. The risk scales with dataset repetition and model capacity: a large model trained on a dataset where some images appear hundreds of times will memorize those images. Deduplication, differential privacy during training, and post-hoc memorization detection are partial mitigations but none eliminates the problem.`,
        `Evaluation lacks a single reliable metric. FID measures distributional similarity but is insensitive to individual-sample quality. CLIP score measures text-image alignment but not visual realism. Human preference studies capture subjective quality but are expensive, inconsistent across annotators, and biased toward visual polish over factual accuracy. Memorization tests, diversity audits, and safety filters each catch different failure modes. No composite score exists, so evaluation requires a battery of measurements and qualitative inspection.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Work through a 1D diffusion process with x0 = 3.0 and a four-step schedule where alpha_bar = [0.9, 0.64, 0.36, 0.04]. The formula is x_t = sqrt(alpha_bar_t) * x0 + sqrt(1 - alpha_bar_t) * epsilon.`,
        `Forward noising. At t=1: x_1 = sqrt(0.9) * 3.0 + sqrt(0.1) * epsilon = 0.949 * 3.0 + 0.316 * epsilon. Draw epsilon = 0.5: x_1 = 2.847 + 0.158 = 3.005. Signal-to-noise ratio (SNR) = alpha_bar / (1 - alpha_bar) = 0.9/0.1 = 9.0. At t=2: x_2 = 0.8 * 3.0 + 0.6 * epsilon. Draw epsilon = -0.8: x_2 = 2.4 - 0.48 = 1.92. SNR = 0.64/0.36 = 1.78. At t=3: x_3 = 0.6 * 3.0 + 0.8 * epsilon. Draw epsilon = 1.2: x_3 = 1.8 + 0.96 = 2.76. SNR = 0.36/0.64 = 0.56. At t=4: x_4 = 0.2 * 3.0 + 0.98 * epsilon. Draw epsilon = -0.3: x_4 = 0.6 - 0.294 = 0.306. SNR = 0.04/0.96 = 0.042. The SNR drops from 9.0 to 0.042 -- from clear signal to near-pure noise.`,
        `Reverse denoising. Start at x_4 = 0.306. The model has learned (from training on many examples) that at alpha_bar = 0.04, most of the value is noise and the signal component is near sqrt(0.04) * x0 = 0.2 * x0. It predicts epsilon_hat = -0.31, yielding an estimated x0_hat = (x_4 - sqrt(0.96) * epsilon_hat) / sqrt(0.04) = (0.306 + 0.98 * 0.31) / 0.2 = (0.306 + 0.304) / 0.2 = 3.05. From this x0 estimate, the sampler reconstructs x_3. At t=3 with less noise, the model refines: the signal is clearer, so the noise prediction is more accurate. Each step is a small regression problem -- predict a noise residual of magnitude proportional to sqrt(1 - alpha_bar_t). After four reverse steps, the original value 3.0 is recovered within small error. The generation composed four easy predictions into one hard one.`,
        `The key observation: at high noise (t=4, SNR=0.042), the model\'s prediction carries the most uncertainty but also the most structural importance -- it determines the coarse value. At low noise (t=1, SNR=9.0), the prediction is precise but only adjusts fine detail. This is the same coarse-to-fine hierarchy that makes the method work for images: early reverse steps choose the scene layout, late steps refine textures.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: Sohl-Dickstein et al. 2015, "Deep Unsupervised Learning using Nonequilibrium Thermodynamics" -- the first diffusion generative model, framing generation as reversing thermodynamic diffusion. Ho et al. 2020, "Denoising Diffusion Probabilistic Models" (DDPM) -- simplified the loss to MSE on predicted noise, used a U-Net backbone, achieved GAN-competitive quality. Song et al. 2021, "Score-Based Generative Modeling through Stochastic Differential Equations" -- unified diffusion and score matching, proved the forward/reverse SDE pair. Song et al. 2021, "Denoising Diffusion Implicit Models" (DDIM) -- deterministic ODE sampler cutting 1,000 steps to 20-50. Nichol and Dhariwal 2021, "Improved DDPM" -- cosine schedule and learned variance. Ho and Salimans 2022, "Classifier-Free Diffusion Guidance." Rombach et al. 2022, "High-Resolution Image Synthesis with Latent Diffusion Models" (Stable Diffusion). Lilian Weng\'s blog post "What are Diffusion Models?" provides an accessible derivation of the full mathematical framework.`,
        `Prerequisites: Neural Networks (the denoiser is a neural net trained with gradient descent), Gaussian distributions (the forward process depends on Gaussians being closed under addition and scaling), Markov chains (the forward and reverse processes are defined as chains with conditional Gaussian transitions), and basic calculus (the score function is a gradient, and the SDE framework requires understanding derivatives of probability densities).`,
        `Study next: VAE (the autoencoder used in latent diffusion, and a generative model in its own right -- understanding the VAE\'s latent space clarifies how Stable Diffusion operates in a compressed representation), GAN (the older adversarial approach -- faster sampling, unstable training; understanding GANs makes clear exactly which problems diffusion solved), U-Net (the encoder-decoder architecture with skip connections that serves as the standard denoiser backbone), Attention Mechanism (cross-attention injects text conditioning into the U-Net; self-attention captures long-range spatial dependencies within each denoising step).`,
      ],
    },
  ],
};
