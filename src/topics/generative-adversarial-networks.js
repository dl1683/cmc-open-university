// GANs: train a generator and discriminator in a minimax game. The generator
// learns by making the discriminator wrong.

import { graphState, scatterState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'generative-adversarial-networks',
  title: 'Generative Adversarial Networks',
  category: 'AI & ML',
  summary: 'A generator and discriminator play a minimax game: sharp samples, unstable dynamics, and mode collapse.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['minimax game', 'mode collapse'], defaultValue: 'minimax game' },
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

function ganGraph(title) {
  return graphState({
    nodes: [
      { id: 'noise', label: 'noise z', x: 0.7, y: 5.0, note: 'random seed' },
      { id: 'gen', label: 'generator G', x: 2.8, y: 5.0, note: 'makes fake' },
      { id: 'fake', label: 'fake sample', x: 4.8, y: 5.0, note: 'candidate' },
      { id: 'real', label: 'real data', x: 4.8, y: 2.2, note: 'training sample' },
      { id: 'disc', label: 'discriminator D', x: 7.1, y: 3.6, note: 'real or fake' },
      { id: 'lossD', label: 'D loss', x: 9.0, y: 2.4, note: 'separate' },
      { id: 'lossG', label: 'G loss', x: 9.0, y: 4.8, note: 'fool D' },
    ],
    edges: [
      { id: 'e-noise-gen', from: 'noise', to: 'gen', weight: 'sample' },
      { id: 'e-gen-fake', from: 'gen', to: 'fake', weight: 'image' },
      { id: 'e-fake-disc', from: 'fake', to: 'disc', weight: 'fake?' },
      { id: 'e-real-disc', from: 'real', to: 'disc', weight: 'real?' },
      { id: 'e-disc-lossD', from: 'disc', to: 'lossD', weight: 'classify' },
      { id: 'e-disc-lossG', from: 'disc', to: 'lossG', weight: 'gradient to G' },
    ],
  }, { title });
}

function dataModes(collapsed) {
  const generated = collapsed
    ? [
      { id: 'g0', x: -1.0, y: -1.0, clusterId: 'generated' },
      { id: 'g1', x: -0.7, y: -1.2, clusterId: 'generated' },
      { id: 'g2', x: -1.2, y: -0.6, clusterId: 'generated' },
      { id: 'g3', x: -0.5, y: -0.8, clusterId: 'generated' },
    ]
    : [
      { id: 'g0', x: -1.0, y: -1.0, clusterId: 'generated' },
      { id: 'g1', x: 2.8, y: -0.7, clusterId: 'generated' },
      { id: 'g2', x: -0.8, y: 2.8, clusterId: 'generated' },
      { id: 'g3', x: 3.0, y: 2.7, clusterId: 'generated' },
    ];
  return scatterState({
    axes: { x: { label: 'feature 1', min: -3, max: 5 }, y: { label: 'feature 2', min: -3, max: 5 } },
    points: [
      { id: 'r0', x: -1.4, y: -1.1, clusterId: 'real' },
      { id: 'r1', x: 2.7, y: -1.0, clusterId: 'real' },
      { id: 'r2', x: -1.1, y: 3.0, clusterId: 'real' },
      { id: 'r3', x: 3.2, y: 2.6, clusterId: 'real' },
      ...generated,
    ],
  }, { title: collapsed ? 'Mode collapse: generator covers one real mode' : 'Healthy coverage: generator covers several modes' });
}

function* minimaxGame() {
  const numNodes = 7;
  const numEdges = 6;
  const generators = ['GAN', 'VAE', 'diffusion', 'flow'];

  yield {
    state: ganGraph('GAN training is a two-player game'),
    highlight: { active: ['noise', 'gen', 'fake', 'e-noise-gen', 'e-gen-fake'], compare: ['real', 'disc'] },
    explanation: `A GAN trains 2 neural networks connected through ${numNodes} nodes and ${numEdges} edges. The generator turns random noise into fake samples. The discriminator sees real and fake samples and tries to classify them correctly.`,
  };

  yield {
    state: ganGraph('The discriminator learns the boundary first'),
    highlight: { active: ['real', 'fake', 'disc', 'lossD', 'e-real-disc', 'e-fake-disc', 'e-disc-lossD'], compare: ['gen'] },
    explanation: `The discriminator update is ordinary supervised learning: real examples should score real, generated examples should score fake. If D is too strong too early, the generator may receive weak or unstable gradients.`,
    invariant: `The training signal for G comes through D — without the ${numEdges} edges connecting them, G has no learning signal.`,
  };

  yield {
    state: ganGraph('The generator updates to make D wrong'),
    highlight: { found: ['gen', 'lossG', 'e-disc-lossG'], active: ['disc', 'fake'] },
    explanation: `The generator does not see the data likelihood directly. It receives gradients through the discriminator across ${numEdges} edges and learns to make samples that D classifies as real. That adversarial signal can produce sharp samples.`,
  };

  yield {
    state: labelMatrix(
      'GAN dynamics compared with other generators',
      [
        { id: 'gan', label: 'GAN' },
        { id: 'vae', label: 'VAE' },
        { id: 'diff', label: 'diffusion' },
        { id: 'flow', label: 'flow' },
      ],
      [
        { id: 'training', label: 'training signal' },
        { id: 'pain', label: 'pain point' },
      ],
      [
        ['adversarial game', 'instability'],
        ['ELBO', 'blur or collapse'],
        ['denoising loss', 'sampling cost'],
        ['exact likelihood', 'invertibility constraints'],
      ],
    ),
    highlight: { active: ['gan:training'], compare: ['gan:pain', 'diff:pain', 'flow:pain'] },
    explanation: `GANs changed generative modeling because they could produce sharp samples without an explicit pixel likelihood. This table compares ${generators.length} approaches: ${generators.join(', ')}. The price is game dynamics: balance, oscillation, and collapse matter as much as architecture.`,
  };
}

function* modeCollapse() {
  const realModes = 4;
  const genSamples = 4;
  const stabilizers = ['G/D balance', 'Wasserstein loss', 'gradient penalty', 'evaluation'];

  yield {
    state: dataModes(true),
    highlight: { active: ['g0', 'g1', 'g2', 'g3'], compare: ['r0', 'r1', 'r2', 'r3'] },
    explanation: `Mode collapse happens when the generator finds one kind of sample that fools the discriminator and keeps producing variants of it. All ${genSamples} generated samples cluster near 1 of ${realModes} real modes, missing most of the data distribution.`,
  };

  yield {
    state: labelMatrix(
      'Why collapse can fool simple monitoring',
      [
        { id: 'quality', label: 'sample quality' },
        { id: 'coverage', label: 'mode coverage' },
        { id: 'diversity', label: 'diversity' },
        { id: 'metric', label: 'single metric' },
      ],
      [
        { id: 'observed', label: 'observed' },
        { id: 'problem', label: 'problem' },
      ],
      [
        ['sharp', 'looks good in cherry picks'],
        ['low', 'missing classes'],
        ['low', 'near-duplicates'],
        ['ambiguous', 'can hide failure'],
      ],
    ),
    highlight: { found: ['quality:observed'], removed: ['coverage:observed', 'diversity:observed'] },
    explanation: `GAN samples can be photorealistic and still cover only a narrow slice of the real distribution. With ${realModes} true modes, evaluation needs both fidelity and diversity to detect when ${realModes - 1} modes are missing.`,
    invariant: `A generator must match all ${realModes} modes of the distribution, not only produce plausible examples from one.`,
  };

  yield {
    state: dataModes(false),
    highlight: { found: ['g0', 'g1', 'g2', 'g3'], compare: ['r0', 'r1', 'r2', 'r3'] },
    explanation: `A healthier generator spreads probability mass across all ${realModes} modes. All ${genSamples} generated points now cover distinct clusters. Techniques such as minibatch discrimination, Wasserstein objectives, gradient penalties, and architectural constraints were introduced to stabilize this coverage.`,
  };

  yield {
    state: labelMatrix(
      'Practical GAN stabilization menu',
      [
        { id: 'balance', label: 'G/D balance' },
        { id: 'wgan', label: 'Wasserstein loss' },
        { id: 'gp', label: 'gradient penalty' },
        { id: 'eval', label: 'evaluation' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['keep game useful', 'sensitive schedules'],
        ['smoother objective', 'extra constraints'],
        ['regularize D', 'compute overhead'],
        ['FID plus diversity', 'metrics still imperfect'],
      ],
    ),
    highlight: { active: ['balance:purpose', 'wgan:purpose', 'gp:purpose'], compare: ['eval:tradeoff'] },
    explanation: `GAN engineering is about maintaining a useful game across ${stabilizers.length} stabilization levers: ${stabilizers.join(', ')}. If one player dominates, gradients become misleading. If evaluation is shallow, collapse can ship as quality.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'minimax game') yield* minimaxGame();
  else if (view === 'mode collapse') yield* modeCollapse();
  else throw new InputError('Pick a GAN view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The minimax game view draws the GAN as a data-flow graph with seven nodes: noise source, generator G, fake sample, real data, discriminator D, D loss, and G loss. Highlighted nodes show which network is updating. During the discriminator step, both the real-data node and the fake-sample node feed into D, which adjusts its classification boundary. During the generator step, gradients flow backward from D through the graph into G, shifting G\'s output distribution toward samples D would label real. Watch for the key invariant: G never sees a real example directly. Its only learning signal is the gradient that passes through D.',
        'The mode collapse view switches to a scatter plot. Four real-data clusters sit in different quadrants. Generated points should cover all four. In the collapsed state every generated point piles onto a single cluster -- the samples look sharp if you only inspect that cluster, but three-quarters of the distribution is missing. In the healthy state the generated cloud spreads across all four clusters. The visual test: does the generated distribution match the shape of the real distribution, or merely overlap one piece of it?',
        {type: 'callout', text: 'A GAN replaces a fixed reconstruction loss with a learned critic, so the generator is trained by whatever currently lets fake samples be detected.'},
        {type: 'image', src: './assets/gifs/generative-adversarial-networks.gif', alt: 'Animated walkthrough of the generative adversarial networks visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Before 2014, generative models -- neural networks that learn to produce new data resembling a training set -- faced a hard tradeoff. Models that computed explicit likelihoods, like variational autoencoders (VAEs) and normalizing flows, trained stably but produced blurry outputs because pixel-level reconstruction losses average over every plausible reconstruction. Models that produced sharp samples required hand-designed quality metrics that could not adapt as the generator improved.',
        'Goodfellow et al. (2014) reframed the problem as a two-player game. Instead of defining a fixed loss that measures sample quality, train a second neural network -- the discriminator -- to learn what distinguishes real from fake. The generator chases that learned critic. Because the critic adapts as the generator improves, the training signal stays fresh and always targets whatever currently looks wrong. This was the first framework that could produce sharp samples from a general-purpose neural network without an explicit density model.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The standard recipe for generative modeling is maximum likelihood: train the model to assign high probability to the real data, then sample from the learned distribution. A VAE (Kingma and Welling, 2014) does this through a variational bound. It encodes each data point into a latent vector z, decodes z back into a reconstruction, and optimizes the evidence lower bound (ELBO) -- a sum of reconstruction quality and latent-space regularity. The result is a valid density model with well-behaved gradients.',
        'The decoder, however, must reconstruct every training example from a compressed code. When multiple valid reconstructions exist -- different lighting, poses, fine textures -- the optimal L2 decoder averages over them. The average of two sharp images is a blurry image. Perceptual losses (comparing VGG features instead of raw pixels) help at the margins, but they do not fix the root cause: the loss is fixed and treats every pixel error equally, whether the error is perceptually obvious or invisible.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Fixed loss functions cannot capture perceptual quality. Pixel-wise mean squared error (MSE) penalizes a one-pixel shift of a sharp edge as harshly as a one-pixel color error in a flat region. L1 loss reduces blur slightly but still cannot distinguish "structurally wrong" from "slightly different." Perceptual losses from a pretrained classifier are better, but they remain frozen -- they cannot adapt to the specific failure modes of the current generator at the current stage of training.',
        'The deeper problem is that what makes an image look real is not a single metric. It involves texture statistics, spatial coherence, semantic plausibility, and fine detail, and the relative importance of each changes as the generator improves. A loss that is adequate at epoch 10 may miss the dominant artifact at epoch 1000. Generating high-quality samples requires a loss that learns alongside the generator, not one designed in advance and held constant.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Replace the hand-written loss with a learned one. Train a discriminator network D to classify inputs as real or fake. The generator G maps random noise z (drawn from a simple distribution like a standard Gaussian) to synthetic samples G(z). D receives both real data x and generated samples and outputs the probability that each input is real. G updates to make D wrong; D updates to get better at telling real from fake. The minimax objective is:',
        'min_G max_D  E_x[log D(x)] + E_z[log(1 - D(G(z)))]',
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/1406.2661/assets/x1.png', alt: 'GAN training diagram with data distribution, generator distribution, and discriminator curve', caption: 'The original GAN paper visualizes the game as a generator distribution moving toward the data distribution while the discriminator boundary adapts. Source: Goodfellow et al., Generative Adversarial Nets, ar5iv.'},
        'Goodfellow proved that if both networks have sufficient capacity and D is trained to optimality at each step, the global minimum occurs when the generator\'s distribution p_G equals the data distribution p_data. At that equilibrium D(x) = 0.5 for all x -- the discriminator cannot tell real from fake. This is the Nash equilibrium of the game: neither player can improve unilaterally.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Training alternates between two updates. Discriminator step: sample a minibatch of real examples x and a minibatch of noise vectors z, generate fakes G(z), and update D to maximize log D(x) + log(1 - D(G(z))). This is standard binary cross-entropy with real examples as positives and fakes as negatives. Generator step: sample fresh noise z, generate G(z), pass through D with D\'s weights frozen, and update G to maximize log D(G(z)). This non-saturating variant replaces the original min log(1 - D(G(z))), which produces near-zero gradients when G is weak and D is confident.',
        'The original objective measures Jensen-Shannon (JS) divergence between p_data and p_G. JS divergence saturates at log 2 when the two distributions have disjoint support -- a common situation early in training on high-dimensional data, because real images occupy a thin manifold and early fakes live nowhere near it. Saturation means zero gradient, so G cannot learn. Arjovsky et al. (2017) replaced JS divergence with the Wasserstein distance (Earth Mover\'s distance), which measures how much probability mass must move and how far. This provides smooth, informative gradients even when distributions do not overlap. The Wasserstein critic must satisfy a Lipschitz constraint -- originally enforced by weight clipping, later by a gradient penalty term (WGAN-GP, Gulrajani et al., 2017).',
        'Architecture-level stabilization includes spectral normalization (bounding D\'s Lipschitz constant per layer via the largest singular value of each weight matrix), progressive growing (Karras et al., 2018 -- start training at 4x4 resolution and add higher-resolution layers incrementally), and the style-based generator (StyleGAN, Karras et al., 2019 -- map z to an intermediate latent w through a mapping network, then inject w at each resolution to control style, disentangling pose from age from lighting).',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For fixed G, the optimal discriminator is D*(x) = p_data(x) / (p_data(x) + p_G(x)). Substituting D* into the value function yields 2 * JSD(p_data || p_G) - log 4, where JSD is Jensen-Shannon divergence. This expression is minimized when p_G = p_data, giving JSD = 0 and D*(x) = 0.5 everywhere. So the minimax game, if solved exactly with infinite-capacity networks, recovers the data distribution.',
        'The practical reason GANs produce sharp samples is that D acts as an adaptive loss. Pixel-level L2 penalizes all deviations equally and averages over modes, producing blur. D learns to penalize whatever currently distinguishes fake from real -- texture artifacts, color banding, spatial incoherence -- and G follows that adaptive gradient. As G improves, D shifts attention to subtler artifacts, creating an automatic curriculum of increasing difficulty without any manual loss engineering.',
        'Inference is a single forward pass through G. A StyleGAN2 generator produces a 1024x1024 face in roughly 25ms on one V100 GPU. This speed advantage made GANs practical for real-time applications years before diffusion models matched their quality, at 20-1000x the sampling cost (a diffusion model typically needs 20-1000 sequential denoising steps per image).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Per-step training cost: one forward pass through G, two forward passes through D (one on the real batch, one on the fake batch), plus backpropagation through both networks. Roughly 2x the cost of training a single supervised network of similar size per iteration. StyleGAN2 training on FFHQ (70,000 faces at 1024x1024) took approximately 9 days on 8 V100 GPUs -- about 51 GPU-days. At current cloud rates (~$2.50/hr for a V100), that is roughly $3,000 in compute.',
        'Generation cost is negligible: one forward pass through G. But the hidden cost is stability engineering. GAN losses are game signals, not straightforward progress indicators. A dropping D loss can mean D improved, G collapsed, or the game degenerated. A rising G loss can mean worse samples or a stronger discriminator. Practitioners monitor fixed-seed sample grids, FID (Frechet Inception Distance) trends, diversity metrics, and nearest-neighbor checks against the training set to catch memorization.',
        'Mode collapse is the most expensive failure mode because it hides. Cherry-picked samples look sharp, FID may even improve on the covered mode, and the missing modes only surface under systematic diversity evaluation. Training a GAN to convergence typically requires more hyperparameter tuning -- learning rate ratio between G and D, D-to-G update ratio, regularization strength, batch size -- than training a supervised model or a diffusion model of comparable size.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Face synthesis: StyleGAN (Karras et al., 2019) generates photorealistic 1024x1024 faces with disentangled control over pose, age, lighting, and hairstyle. The single-pass generator makes interactive exploration and latent-space editing practical -- slide one dimension of w and only the lighting changes, without affecting identity.',
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/1406.2661/assets/mnist_samples.png', alt: 'Generated MNIST digit samples from the original GAN paper', caption: 'The original GAN experiments included random MNIST samples with nearest training neighbors, a check against memorization. Source: Goodfellow et al., Generative Adversarial Nets, ar5iv.'},
        'Super-resolution: SRGAN and ESRGAN use a discriminator to ensure upscaled images contain realistic high-frequency detail rather than the smooth interpolation an L2 loss produces. The discriminator learns what sharp edges and textures in real photos look like and penalizes the generator for hallucinating the wrong texture pattern, yielding perceptually convincing 4x upscaling.',
        'Image-to-image translation: Pix2Pix (Isola et al., 2017) translates paired images (sketch to photo, satellite to map). CycleGAN (Zhu et al., 2017) extends this to unpaired domains (horse to zebra, summer to winter) by adding cycle-consistency losses -- translate A to B, then B back to A, and penalize if A changed. The adversarial term ensures outputs look like plausible members of the target domain, not averaged approximations.',
        'Data augmentation in low-data regimes: when labeled training data is scarce, GANs can synthesize additional examples. Medical imaging studies have generated rare pathologies (tumors, retinal lesions) to augment classifier training sets. The risk is that a collapsed GAN biases the augmented set toward only the modes it covers, which can harm rather than help downstream accuracy.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Training instability is the primary cost. Mode collapse can hide under sharp cherry-picked samples. Vanishing gradients can silently stall G when D becomes too strong. Oscillation between modes can prevent convergence entirely. Even with WGAN-GP, spectral normalization, and progressive growing, GAN training demands more hyperparameter tuning than supervised learning or diffusion training of comparable scale.',
        'GANs provide no density estimates. If you need the probability of a given sample under the model -- for anomaly detection, out-of-distribution detection, or calibrated uncertainty -- GANs cannot help. VAEs and normalizing flows give explicit densities; diffusion models give approximate log-likelihoods via the variational bound.',
        'Evaluation is an unsolved problem. FID fits Gaussians to Inception-v3 features of real and generated sets, then measures their Frechet distance. It rewards both fidelity and diversity but assumes Gaussian feature distributions, depends on reference set size (50k samples is standard), and can be gamed by generators tuned to the FID metric rather than to human perception. Inception Score (IS) measures only diversity and classifier confidence, not fidelity to the real distribution. No single scalar captures GAN quality reliably.',
        'For open-ended image generation, diffusion models (DALL-E 2, Stable Diffusion, Imagen) have largely displaced GANs since 2022. Diffusion training scales more predictably, converges more stably, and handles diverse conditioning (text, layout, depth maps) more naturally, despite requiring 20-1000 denoising steps per sample. GANs remain competitive in constrained domains where fast single-pass inference matters: real-time super-resolution, video frame prediction, neural avatar rendering, and game asset generation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace three training steps on a toy 1D GAN. The real data distribution is N(5, 1) -- a Gaussian centered at 5 with standard deviation 1. G starts by producing N(0, 1). D is a small two-layer fully connected classifier. We use the non-saturating loss (G maximizes log D(G(z))).',
        'Step 1 -- D learns the easy boundary. D trains on a batch: real samples clustered near 5, fakes clustered near 0. The means are 5 units apart with unit variance, so the distributions barely overlap. D achieves confident separation. D loss drops from ln(4) = 1.39 (random initialization, 50% accuracy) to 0.41 (high accuracy). G loss is 2.30 because D(G(z)) is near 0 for all fakes -- the non-saturating gradient through D tells G to shift outputs toward the region D labels real.',
        'Step 2 -- G moves halfway. G updates its mean and now produces N(2.5, 1). D retrains on real near 5, fakes near 2.5. The gap has halved to 2.5 standard deviations, so some overlap appears. D loss rises to 0.58; classification is harder. G loss drops to 1.20 because some fakes now score D(G(z)) around 0.3 instead of near 0. Both players\' jobs have gotten harder -- the game tightens.',
        'Step 3 -- distributions overlap. G shifts to N(4.2, 1). Real and fake distributions overlap substantially (means only 0.8 apart). D loss rises to 0.82. G loss drops to 0.75. D(G(z)) averages about 0.47, approaching the 0.5 that indicates a confused classifier. If training continues stably, G converges to N(5, 1) and D(x) approaches 0.5 everywhere -- the Nash equilibrium where the generator has recovered the data distribution.',
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/1406.2661/assets/1dsubspace.png', alt: 'GAN latent interpolation through generated digit samples', caption: 'Linear interpolation through latent space shows that the generator has learned a continuous sample manifold, not only isolated training images. Source: Goodfellow et al., Generative Adversarial Nets, ar5iv.'},
        'Mode collapse variant: suppose the real data is bimodal, a mixture of N(0, 1) and N(10, 1). G might converge to N(5, 1) -- the mean of the two modes. D flags samples near 5 as fake because no real data lives there. G shifts to N(0, 1). D adapts. G jumps to N(10, 1). The generator oscillates between modes without covering both simultaneously. This is precisely where the Wasserstein distance helps: it provides a gradient proportional to how far G is from the full distribution, not just a binary "caught or not caught" signal.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Goodfellow et al., 2014, "Generative Adversarial Nets" (https://arxiv.org/abs/1406.2661) -- the original framework, minimax formulation, and convergence proof. Arjovsky et al., 2017, "Wasserstein GAN" (https://arxiv.org/abs/1701.07875) -- replaced JS divergence with Earth Mover\'s distance for smooth gradients even without distributional overlap. Gulrajani et al., 2017, "Improved Training of Wasserstein GANs" (https://arxiv.org/abs/1704.00028) -- gradient penalty replacing weight clipping for Lipschitz enforcement. Karras et al., 2018, "Progressive Growing of GANs" (https://arxiv.org/abs/1710.10196) -- incremental resolution training for stable high-resolution synthesis. Karras et al., 2019, "A Style-Based Generator Architecture" (https://arxiv.org/abs/1812.04948) -- StyleGAN with disentangled latent control via a mapping network.',
        'Prerequisites: neural networks (forward pass and backpropagation -- you need to understand how D\'s gradient reaches G through the computational graph), loss functions (binary cross-entropy and log-likelihood -- the mathematical language of the GAN objective), and basic game theory (minimax games and Nash equilibrium -- the framework that guarantees convergence under ideal conditions).',
        'Study next: VAEs for the explicit-density alternative with stable training but blurrier outputs. Diffusion models for the current dominant approach to image generation -- stable training at the cost of multi-step sampling. Adversarial examples for a different use of adversarial optimization that attacks classifiers rather than training generators. Domain-adversarial networks for applying the adversarial idea to domain adaptation rather than generation.',
      ],
    },
  ],
};
