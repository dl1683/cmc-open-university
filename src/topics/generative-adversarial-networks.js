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
        'The minimax game view shows the GAN as a data-flow graph. Highlighted nodes mark which network is updating. In the discriminator step, real data and fake samples both flow into D, which adjusts its classification boundary. In the generator step, gradients flow backward from D through to G, which shifts its output distribution. The key rule: G never sees real data. Its only learning signal is the gradient that passes through D.',
        'The mode collapse view uses a scatter plot. Real data points form four clusters. Generated points should cover all four. In the collapsed state, all generated points pile onto a single mode -- sharp-looking but missing three-quarters of the distribution. In the healthy state, generated points spread across all clusters. The visual check: does the generated cloud match the shape of the real cloud, or just overlap with a piece of it?',
        {type: 'callout', text: 'A GAN replaces a fixed reconstruction loss with a learned critic, so the generator is trained by whatever currently lets fake samples be detected.'},
      
        {type: 'image', src: './assets/gifs/generative-adversarial-networks.gif', alt: 'Animated walkthrough of the generative adversarial networks visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Before 2014, generative models faced a hard tradeoff. Models that computed explicit likelihoods (VAEs, normalizing flows) could be trained stably but produced blurry outputs, because pixel-level reconstruction losses average over all plausible outputs. Models that produced sharp samples required hand-designed quality metrics that could not adapt as the generator improved.',
        'Goodfellow et al. (2014) reframed the problem as a game. Instead of defining a fixed loss that measures sample quality, train a second neural network -- the discriminator -- to learn what distinguishes real from fake. The generator then chases that learned critic. The critic adapts as the generator improves, so the training signal is always fresh and always targets whatever currently looks wrong.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The standard way to build a generative model is maximum likelihood: train the model to assign high probability to real data, then sample from the learned distribution. VAEs (Kingma and Welling, 2014) do this through a variational bound -- encode data to a latent vector, decode back, optimize the evidence lower bound (ELBO). The result is a valid density model with well-behaved training.',
        'The decoder, however, must reconstruct every training example from a compressed latent code. When multiple valid reconstructions exist (different lighting, poses, fine textures), the optimal L2 decoder averages over them. The average of two sharp images is a blurry image. Adding perceptual losses helps at the margins but does not fix the root cause: the loss function is fixed and treats every pixel error equally, regardless of whether the error is perceptually obvious or invisible.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Fixed loss functions cannot capture perceptual quality. Pixel-wise MSE penalizes a one-pixel shift of an edge as harshly as a one-pixel color error in a flat region. L1 loss produces less blur but still cannot distinguish "structurally wrong" from "slightly different." Perceptual losses computed from a pretrained classifier help but remain frozen -- they cannot adapt to the specific failure modes of the current generator.',
        'The deeper problem: what makes an image look real is not a single metric. It involves texture statistics, spatial coherence, semantic plausibility, and fine detail, and the relative importance of each changes as the generator improves. A loss function that is adequate at epoch 10 may miss the dominant artifact at epoch 1000. Generation quality requires a loss that learns alongside the generator.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Replace the hand-written loss with a learned one. Train a discriminator network D to classify inputs as real or fake. The generator G maps random noise z to synthetic samples G(z). D receives both real data x and generated samples and outputs the probability each is real. G updates to make D wrong; D updates to get better at telling them apart. The minimax objective is:',
        'min_G max_D  E_x[log D(x)] + E_z[log(1 - D(G(z)))]',
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/1406.2661/assets/x1.png', alt: 'GAN training diagram with data distribution, generator distribution, and discriminator curve', caption: 'The original GAN paper visualizes the game as a generator distribution moving toward the data distribution while the discriminator boundary adapts. Source: Goodfellow et al., Generative Adversarial Nets, ar5iv.'},
        'Goodfellow proved that if both networks have enough capacity and D is trained to optimality at each step, the global minimum occurs when the generator\'s distribution p_G equals the data distribution p_data. At that point D(x) = 0.5 for all x -- the discriminator cannot tell real from fake. This is the Nash equilibrium of the game.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Training alternates between two updates. Discriminator step: sample a minibatch of real examples x and a minibatch of noise vectors z. Generate fakes G(z). Update D to maximize log D(x) + log(1 - D(G(z))). This is standard binary cross-entropy where real examples are positive and generated examples are negative.',
        'Generator step: sample fresh noise z, generate G(z), pass through D with D\'s weights frozen. Update G to maximize log D(G(z)). This is the non-saturating variant of the loss. The original formulation minimizes log(1 - D(G(z))), but when G is weak and D is confident, that gradient saturates near zero. Maximizing log D(G(z)) provides the same optimum but with stronger gradients early in training.',
        'The original JS-divergence objective breaks when the real and generated distributions have disjoint support, which is common early in training on high-dimensional data. The JS divergence saturates at log 2, producing zero gradient. Arjovsky et al. (2017) replaced it with the Wasserstein distance (Earth Mover\'s distance), which measures how much probability mass must move and how far, providing smooth gradients even for non-overlapping distributions. The WGAN critic must be Lipschitz-constrained -- originally enforced by weight clipping, later by a gradient penalty term (WGAN-GP, Gulrajani et al., 2017).',
        'Stabilization techniques beyond the loss function include spectral normalization (constraining D\'s Lipschitz constant per layer), progressive growing (Karras et al., 2018 -- start training at 4x4 resolution and gradually add layers), and the style-based generator (StyleGAN, Karras et al., 2019 -- map z to an intermediate latent w that controls style at each resolution, disentangling pose, age, and lighting).',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For fixed G, the optimal discriminator is D*(x) = p_data(x) / (p_data(x) + p_G(x)). Substituting D* into the value function yields 2 * JSD(p_data || p_G) - log 4, where JSD is the Jensen-Shannon divergence. This is minimized when p_G = p_data, giving JSD = 0 and D*(x) = 0.5 everywhere. So the minimax game, solved exactly, recovers the data distribution.',
        'The practical reason GANs produce sharp samples is that D is a learned loss. Pixel-level L2 penalizes all deviations equally and averages over modes, producing blur. D learns to penalize whatever currently distinguishes fake from real -- texture artifacts, color statistics, spatial coherence -- and G follows that adaptive gradient. As G improves, D shifts its attention to subtler artifacts, creating a curriculum of increasing difficulty.',
        'Inference is fast: one forward pass through G maps noise to a sample. A StyleGAN2 generator produces a 1024x1024 face in about 25ms on a single GPU. This made GANs practical for real-time applications years before diffusion models matched their quality at 20-1000x the sampling cost.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Per-step training cost: one forward pass through G, two forward passes through D (on real and fake batches), plus backpropagation through both networks. Roughly 2x the cost of training a single supervised network of similar size. StyleGAN2 training on FFHQ (1024x1024 faces) took about 9 days on 8 V100 GPUs.',
        'Generation cost: one forward pass through G. This is orders of magnitude cheaper than diffusion models. But the hidden cost is engineering stability. GAN losses are game signals, not progress indicators. A dropping D loss can mean D improved, G collapsed, or the game became degenerate. A rising G loss can mean worse samples or a stronger discriminator boundary. Practitioners monitor fixed-seed sample grids, FID (Frechet Inception Distance) trends, diversity metrics, and nearest-neighbor memorization checks.',
        'Mode collapse is the most expensive failure mode because it can hide: cherry-picked samples look sharp, FID may improve on the covered mode, and the missing modes only surface with systematic diversity evaluation. Training a GAN to convergence often requires more hyperparameter tuning (learning rate ratio, D-to-G update ratio, regularization strength) than training a supervised model or a diffusion model of comparable size.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Face synthesis: StyleGAN (Karras et al., 2019) generates photorealistic 1024x1024 faces with disentangled control over pose, age, lighting, and style. The single-pass generator makes interactive exploration and latent-space editing practical.',
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/1406.2661/assets/mnist_samples.png', alt: 'Generated MNIST digit samples from the original GAN paper', caption: 'The original GAN experiments included random MNIST samples with nearest training neighbors, a check against memorization. Source: Goodfellow et al., Generative Adversarial Nets, ar5iv.'},
        'Super-resolution: SRGAN and ESRGAN use a discriminator to ensure upscaled images contain realistic high-frequency detail. An L2-trained upsampler averages over possible textures and produces blur; the discriminator learns what sharp edges in real photos look like and penalizes the generator for hallucinating the wrong texture pattern.',
        'Image-to-image translation: Pix2Pix (Isola et al., 2017) translates paired images (sketch to photo, satellite to map). CycleGAN (Zhu et al., 2017) extends this to unpaired domains (horse to zebra, summer to winter) using cycle-consistency losses alongside adversarial losses. The adversarial term ensures outputs look like plausible members of the target domain rather than averaged approximations.',
        'Data augmentation: when labeled training data is scarce, GANs can synthesize examples to expand the dataset. Medical imaging studies have used GANs to generate rare pathologies for classifier training. The risk is that a collapsed GAN biases the augmented set toward the modes it covers.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Training instability is the primary tax. Mode collapse can hide under sharp cherry-picked samples. Vanishing gradients can silently stall G when D becomes too strong. Oscillation can prevent convergence entirely. Even with WGAN-GP, spectral normalization, and progressive growing, GAN training demands more hyperparameter tuning than supervised learning or diffusion training.',
        'GANs provide no density estimates. If you need the probability of a given sample under the model -- for anomaly detection, out-of-distribution detection, or calibrated uncertainty -- GANs are the wrong tool. VAEs and normalizing flows give explicit densities. Diffusion models give approximate log-likelihoods via the variational bound.',
        'Evaluation itself is hard. FID compares Gaussian fits to Inception features of real and generated sets. It rewards both fidelity and diversity but assumes Gaussian feature distributions, depends on reference set size, and can be gamed by generators tuned specifically to the FID metric. Inception Score (IS) measures only diversity and class confidence, not fidelity to the real distribution. No single scalar captures GAN quality.',
        'For open-ended image generation, diffusion models (DALL-E 2, Stable Diffusion, Imagen) have largely displaced GANs. Diffusion training scales more predictably, converges more stably, and handles diverse conditioning (text, layout, depth) more naturally, despite requiring 20-1000 denoising steps per sample. GANs remain competitive in constrained domains where fast single-pass inference matters: real-time super-resolution, video frame prediction, and game asset generation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace three training steps on a toy 1D GAN. Real data is N(5, 1). G starts producing N(0, 1). D is a small two-layer classifier. We use the non-saturating loss.',
        'Step 1 -- D learns the easy boundary. D trains on a batch: real samples clustered near 5, fakes clustered near 0. D learns "values near 5 are real" and achieves confident separation. D loss drops from 1.39 to 0.41. G loss is high at 2.30 because D(G(z)) is near 0 for all fakes. The gradient through D tells G: shift outputs toward the region D labels "real."',
        'Step 2 -- G moves halfway. G updates its parameters and now produces N(2.5, 1). D retrains: real samples near 5, fakes near 2.5. Separation is harder. D loss rises to 0.58. G loss drops to 1.20 because some fakes now score D(G(z)) around 0.3. The game tightens -- each player\'s job gets harder.',
        'Step 3 -- distributions overlap. G shifts to N(4.2, 1). Real and fake distributions now overlap substantially. D loss rises to 0.82 -- classification is difficult. G loss drops to 0.75. D(G(z)) averages about 0.47, approaching the 0.5 of a confused classifier. If training continues stably, G converges to N(5, 1) and D(x) approaches 0.5 everywhere -- the Nash equilibrium.',
        {type: 'image', src: 'https://ar5iv.labs.arxiv.org/html/1406.2661/assets/1dsubspace.png', alt: 'GAN latent interpolation through generated digit samples', caption: 'Linear interpolation through latent space shows that the generator has learned a continuous sample manifold, not only isolated training images. Source: Goodfellow et al., Generative Adversarial Nets, ar5iv.'},
        'Mode collapse variant: real data is bimodal, N(0, 1) and N(10, 1). G might converge to N(5, 1) -- the mean of the two modes. D flags this as fake because nothing real lives near 5. G shifts to N(0, 1). D adapts. G jumps to N(10, 1). The generator oscillates between modes without covering both. This is where the Wasserstein distance helps: it provides a gradient proportional to how far G is from the full distribution, not just a binary "caught or not caught."',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Goodfellow et al., 2014, "Generative Adversarial Nets" (https://arxiv.org/abs/1406.2661) -- the original framework and convergence proof. Arjovsky et al., 2017, "Wasserstein GAN" (https://arxiv.org/abs/1701.07875) -- replaced JS divergence with Earth Mover\'s distance for smooth gradients. Gulrajani et al., 2017, "Improved Training of Wasserstein GANs" (https://arxiv.org/abs/1704.00028) -- gradient penalty replacing weight clipping. Karras et al., 2018, "Progressive Growing of GANs" (https://arxiv.org/abs/1710.10196) -- resolution-growing training. Karras et al., 2019, "A Style-Based Generator Architecture" (https://arxiv.org/abs/1812.04948) -- StyleGAN with disentangled latent control.',
        'Prerequisites: neural networks (forward pass and backpropagation, so D\'s gradient flow to G makes sense), loss functions (cross-entropy and log-likelihood, the mathematical language of the GAN objective), and basic game theory (minimax and Nash equilibrium).',
        'Extensions: VAEs -- variational likelihood bound, explicit densities, blurrier samples, stable training. Diffusion models -- current state-of-the-art for image generation, stable training at the cost of multi-step sampling. Adversarial examples -- a different use of adversarial optimization, attacking classifiers rather than training generators. Domain-adversarial networks -- using the adversarial idea for domain adaptation rather than generation.',
      ],
    },
  ],
};
