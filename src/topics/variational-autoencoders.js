// Variational autoencoders: encode an input into a distribution over latent
// variables, sample with the reparameterization trick, and decode back.

import { graphState, scatterState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'variational-autoencoders',
  title: 'Variational Autoencoders',
  category: 'AI & ML',
  summary: 'A generative model with an encoder, decoder, latent distribution, reparameterization trick, and KL regularizer.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['reparameterization', 'latent space'], defaultValue: 'reparameterization' },
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

function vaeGraph(title) {
  return graphState({
    nodes: [
      { id: 'x', label: 'input x', x: 0.7, y: 3.8, note: 'data' },
      { id: 'enc', label: 'encoder', x: 2.6, y: 3.8, note: 'recognition model' },
      { id: 'mu', label: 'mu', x: 4.3, y: 2.5, note: 'latent mean' },
      { id: 'sigma', label: 'sigma', x: 4.3, y: 5.1, note: 'latent scale' },
      { id: 'eps', label: 'epsilon', x: 5.9, y: 5.1, note: 'noise' },
      { id: 'z', label: 'z', x: 6.4, y: 3.8, note: 'latent sample' },
      { id: 'dec', label: 'decoder', x: 8.0, y: 3.8, note: 'generative model' },
      { id: 'xhat', label: 'x hat', x: 9.3, y: 3.8, note: 'reconstruction' },
    ],
    edges: [
      { id: 'e-x-enc', from: 'x', to: 'enc', weight: 'features' },
      { id: 'e-enc-mu', from: 'enc', to: 'mu', weight: 'mean' },
      { id: 'e-enc-sigma', from: 'enc', to: 'sigma', weight: 'scale' },
      { id: 'e-mu-z', from: 'mu', to: 'z', weight: 'shift' },
      { id: 'e-sigma-z', from: 'sigma', to: 'z', weight: 'scale' },
      { id: 'e-eps-z', from: 'eps', to: 'z', weight: 'randomness' },
      { id: 'e-z-dec', from: 'z', to: 'dec', weight: 'latent code' },
      { id: 'e-dec-xhat', from: 'dec', to: 'xhat', weight: 'pixels/tokens' },
    ],
  }, { title });
}

function latentCloud(title, regularized) {
  const shift = regularized ? 0 : 2.4;
  return scatterState({
    axes: { x: { label: 'z1', min: -3, max: 5 }, y: { label: 'z2', min: -3, max: 5 } },
    points: [
      { id: 'a0', x: -1.4 + shift, y: -0.8, clusterId: 'digit-0' },
      { id: 'a1', x: -1.0 + shift, y: -1.2, clusterId: 'digit-0' },
      { id: 'a2', x: -0.6 + shift, y: -0.6, clusterId: 'digit-0' },
      { id: 'b0', x: 0.8, y: 1.1 + shift, clusterId: 'digit-1' },
      { id: 'b1', x: 1.2, y: 1.6 + shift, clusterId: 'digit-1' },
      { id: 'b2', x: 1.5, y: 0.9 + shift, clusterId: 'digit-1' },
      { id: 'prior', x: 0.0, y: 0.0, clusterId: 'prior' },
    ],
  }, { title });
}

function* reparameterization() {
  yield {
    state: vaeGraph('A VAE encodes x into a distribution over z'),
    highlight: { active: ['x', 'enc', 'mu', 'sigma', 'e-x-enc', 'e-enc-mu', 'e-enc-sigma'], compare: ['dec'] },
    explanation: 'A normal autoencoder maps x to a single code. A variational autoencoder maps x to a distribution over latent codes: mean mu and scale sigma. The decoder learns to reconstruct from samples drawn from that distribution.',
  };

  yield {
    state: vaeGraph('Reparameterization moves randomness outside the network'),
    highlight: { active: ['eps', 'mu', 'sigma', 'z', 'e-eps-z', 'e-mu-z', 'e-sigma-z'], found: ['dec', 'xhat'] },
    explanation: 'The reparameterization trick writes z = mu + sigma * epsilon, where epsilon is random noise independent of the encoder. Gradients can flow through mu and sigma because the sampling operation has been separated from the learned parameters.',
    invariant: 'Randomness stays; the gradient path becomes usable.',
  };

  yield {
    state: labelMatrix(
      'The evidence lower bound has two jobs',
      [
        { id: 'recon', label: 'reconstruction loss' },
        { id: 'kl', label: 'KL to prior' },
        { id: 'sample', label: 'sampling quality' },
        { id: 'collapse', label: 'posterior collapse' },
      ],
      [
        { id: 'pressure', label: 'pressure' },
        { id: 'failure', label: 'failure mode' },
      ],
      [
        ['make x hat match x', 'blurry or wrong reconstructions'],
        ['keep z near simple prior', 'too strong can ignore z'],
        ['make random z decodable', 'holes in latent space'],
        ['decoder ignores latent', 'KL goes near zero'],
      ],
    ),
    highlight: { found: ['recon:pressure', 'kl:pressure'], compare: ['collapse:failure'] },
    explanation: 'The VAE objective balances reconstruction with a KL penalty that pulls the encoder distribution toward a simple prior. That makes the latent space sampleable instead of a scattered lookup table.',
  };

  yield {
    state: labelMatrix(
      'VAE compared with neighboring generative models',
      [
        { id: 'vae', label: 'VAE' },
        { id: 'gan', label: 'GAN' },
        { id: 'flow', label: 'normalizing flow' },
        { id: 'diff', label: 'diffusion' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['structured latent space', 'can be blurry'],
        ['sharp samples', 'unstable game'],
        ['exact likelihood', 'invertibility constraints'],
        ['high quality', 'many denoise steps'],
      ],
    ),
    highlight: { active: ['vae:strength'], compare: ['gan:tradeoff', 'flow:tradeoff', 'diff:tradeoff'] },
    explanation: 'VAEs are the cleanest bridge between representation learning and generation. They are not always the sharpest sampler, but their latent structure is useful for interpolation, compression, anomaly detection, and latent diffusion.',
  };
}

function* latentSpace() {
  yield {
    state: latentCloud('Without a prior penalty, codes can form isolated islands', false),
    highlight: { active: ['a0', 'a1', 'a2'], compare: ['b0', 'b1', 'b2'], removed: ['prior'] },
    explanation: 'A plain autoencoder can learn separated code islands. Reconstruction is fine for known examples, but random latent samples may land in empty space the decoder never learned to handle.',
  };

  yield {
    state: latentCloud('The KL term pulls codes toward a sampleable prior', true),
    highlight: { found: ['a0', 'a1', 'a2', 'b0', 'b1', 'b2', 'prior'] },
    explanation: 'The KL term encourages the encoder distributions to live near a simple prior such as a unit Gaussian. That makes interpolation and sampling meaningful: nearby z values decode to nearby outputs.',
    invariant: 'A generative latent space needs coverage, not only reconstruction.',
  };

  yield {
    state: labelMatrix(
      'Latent-space operations',
      [
        { id: 'interp', label: 'interpolation' },
        { id: 'sample', label: 'random sample' },
        { id: 'anomaly', label: 'anomaly score' },
        { id: 'latentdiff', label: 'latent diffusion' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'why', label: 'why it works' },
      ],
      [
        ['walk between z values', 'smooth decoder'],
        ['draw z from prior', 'KL-regularized space'],
        ['bad recon or low likelihood', 'input off manifold'],
        ['denoise compressed z', 'cheaper than pixels'],
      ],
    ),
    highlight: { found: ['interp:operation', 'sample:operation', 'latentdiff:operation'] },
    explanation: 'VAEs make latent variables operational. The same geometry is why latent diffusion can generate in a compressed representation before decoding back to pixels.',
  };

  yield {
    state: labelMatrix(
      'Practical tuning knobs',
      [
        { id: 'beta', label: 'beta-VAE weight' },
        { id: 'capacity', label: 'latent capacity' },
        { id: 'decoder', label: 'decoder power' },
        { id: 'anneal', label: 'KL annealing' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['disentanglement', 'too much blur'],
        ['compression control', 'too small loses detail'],
        ['quality', 'can ignore z'],
        ['avoid collapse', 'extra schedule'],
      ],
    ),
    highlight: { active: ['beta:helps', 'capacity:helps', 'anneal:helps'], compare: ['decoder:risk'] },
    explanation: 'VAE behavior is sensitive to the balance between reconstruction and regularization. The model can memorize, blur, or ignore the latent code depending on architecture and schedules.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'reparameterization') yield* reparameterization();
  else if (view === 'latent space') yield* latentSpace();
  else throw new InputError('Pick a VAE view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The reparameterization view traces a single input through the VAE dataflow graph. Highlighted nodes mark the active stage: input x enters the encoder, the encoder forks into two output heads (mu and sigma), noise epsilon arrives from outside the learned pathway, and z is assembled as mu + sigma * epsilon. The decoder then maps z back to a reconstruction x-hat. The critical thing to notice: epsilon has no incoming edge from the encoder. That separation is what makes gradients possible.',
        {
          type: 'callout',
          text: 'A VAE is trainable because randomness is sampled outside the encoder path while the latent sample remains differentiable with respect to mu and sigma.',
        },
        'The latent space view shows encoded inputs as scattered points in a two-dimensional latent plane. Without KL regularization, clusters drift into isolated islands with dead zones between them. With KL, clusters overlap near the origin, filling the space so that interpolation between known points and random sampling from the prior both produce coherent decoder outputs. The prior marker at (0, 0) shows where N(0, I) sits; a well-trained VAE surrounds it.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Autoencoders learn compressed representations of data. The idea traces to Rumelhart, Hinton, and Williams (1986), the same paper that popularized backpropagation: train a network whose hidden layer is narrower than its input, force it to reconstruct the input through that bottleneck, and the bottleneck learns the most informative features. A plain autoencoder compresses well but cannot generate new data, because its latent space has no structure a sampler can exploit.',
        'Kingma and Welling (2014) turned the autoencoder into a generative model by making the encoder output a probability distribution instead of a fixed code. The Variational Autoencoder (VAE) pairs reconstruction with a regularization term that keeps the latent distribution close to a simple prior. The result is a latent space you can sample from, interpolate through, and use for anomaly detection, representation learning, and generation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Before neural autoencoders, the standard tool for learning compressed representations was PCA: project data onto the directions of maximum variance. PCA is fast, closed-form, and produces orthogonal components that are easy to interpret. For data that varies mostly along linear axes, PCA captures the essential structure in a handful of components.',
        'A plain (deterministic) autoencoder extends PCA by allowing nonlinear mappings. An encoder network compresses input x into a fixed vector z, and a decoder reconstructs x from z. With enough capacity, the autoencoder can pack complex patterns into z and reconstruct training examples almost perfectly.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'PCA is linear. Real data -- images of faces, molecular structures, speech signals -- lives on curved, nonlinear manifolds. PCA cannot bend its projection axes to follow those curves, so it wastes dimensions modeling variance that a nonlinear encoder would capture in fewer latent variables.',
        'A plain autoencoder solves the nonlinearity problem but hits a different wall: its latent space is a private lookup table, not a continuous manifold. Two similar images can map to distant points. Random points between known codes land in regions the decoder never saw, producing garbage. There is no sampling distribution, no pressure to fill gaps, no guarantee that nearby latent points decode to related outputs. The autoencoder compresses but cannot generate.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The encoder takes input x and outputs two vectors: a mean mu and a log-variance logvar (log-variance rather than variance because it is numerically stable and can represent any positive variance after exponentiation). From these, sigma = exp(0.5 * logvar). The encoder does not output a single code; it describes a Gaussian cloud around where x should live in latent space.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Reparameterized_Variational_Autoencoder.png', alt: 'Variational autoencoder dataflow after the reparameterization trick', caption: 'The reparameterized VAE separates probabilistic encoder outputs from external noise before the decoder reconstructs x. Source: Wikimedia Commons, Agustinus Kristiadi, CC BY-SA 4.0.'},
        'The reparameterization trick makes this trainable. Instead of sampling z directly from the learned distribution (which blocks gradient flow), the model draws epsilon from a fixed N(0, I) and computes z = mu + sigma * epsilon. Randomness stays in the forward pass, but z is now a deterministic function of mu, sigma, and epsilon. The partial derivatives are clean: dz/dmu = 1, dz/dsigma = epsilon. Backpropagation flows through mu and sigma to the encoder weights.',
        'The decoder takes z and predicts the original input. For images, it might output Bernoulli probabilities per pixel (binary cross-entropy loss) or Gaussian means (MSE loss). The total loss is the Evidence Lower Bound (ELBO), which has two terms: Loss = reconstruction_error + KL(q(z|x) || p(z)). The reconstruction term rewards accurate outputs. The KL term measures how far the encoder distribution q(z|x) drifts from the prior p(z) = N(0, I). For Gaussian q and Gaussian prior, KL has a closed form per latent dimension j: KL_j = 0.5 * (sigma_j^2 + mu_j^2 - 1 - ln(sigma_j^2)). Sum across dimensions, average across the batch.',
        'A denoising autoencoder variant corrupts the input (adding noise, masking pixels, dropping features) and trains the decoder to reconstruct the clean original. This forces the encoder to learn robust features rather than memorizing surface patterns. The corruption acts as implicit regularization without a KL term.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The bottleneck forces compression. With fewer latent dimensions than input dimensions, the encoder cannot simply copy the input -- it must learn which features carry the most information. This is the same principle as PCA, but the nonlinear encoder can capture curved manifold structure that PCA misses.',
        'The KL term makes the latent space smooth and interpolatable. It charges the encoder for placing posteriors far from the prior or making them too narrow. If mu drifts far from zero, KL grows quadratically. If sigma shrinks toward zero (memorizing each input as a point), the ln(sigma^2) term explodes. The model must compromise: posteriors informative enough to reconstruct, but broad and centered enough that the prior N(0, I) covers the same region. Nearby z values decode to related outputs because the encoder was penalized for leaving gaps.',
        'The tension between the two loss terms is the VAE mechanism. Pure reconstruction wants each input to have its own precise, distant code. Pure KL wants every input to map to the same N(0, I). The trained model finds the sweet spot: codes spread enough to be distinguishable, regular enough to be sampleable.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The encoder and decoder are standard neural networks (fully connected, convolutional, or transformer-based), so their cost scales with parameter count and input resolution the same way any neural network does. The VAE-specific operations -- computing mu and logvar (two linear projections), sampling epsilon, computing closed-form KL -- are negligible compared to the network forward and backward passes.',
        'Memory for the reparameterization step scales as batch_size * latent_dim. Doubling latent dimension doubles the KL and sampling cost but barely affects total training time when the encoder and decoder dominate. Doubling image resolution hits the encoder and decoder quadratically (more pixels, more convolution work) while latent operations stay flat.',
        'Generation is cheap: sample z from N(0, I), run one forward pass through the decoder. No encoder needed. This single-pass generation is far faster than diffusion models, which require hundreds of sequential denoising steps. Training uses standard SGD (Adam is typical), with the ELBO as the loss. No adversarial game, no special optimizers.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Anomaly detection: encode an input, decode it, measure reconstruction error. Normal inputs reconstruct well because the model learned their manifold. Anomalies reconstruct poorly because they fall off the learned surface. This works for fraud detection, industrial defect inspection, and medical imaging screening.',
        'Representation learning: the latent space captures meaningful features without labels. Cluster structure in z often aligns with semantic categories. Downstream classifiers trained on z instead of raw input can be simpler and more data-efficient.',
        'Image generation: VAEs generate new images by sampling z from the prior and decoding. Stable Diffusion uses a VAE encoder to compress images into a latent grid, runs the diffusion process in that cheaper latent space, then decodes back to pixels. The VAE makes diffusion computationally feasible at high resolution.',
        'Recommender systems: encode user-item interaction vectors into a latent space, then decode to predict unseen interactions. The VAE prior regularizes the user representations, improving generalization on sparse data.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Blurry outputs. A Gaussian reconstruction loss (MSE) rewards the mean of all plausible outputs. When multiple sharp images could explain the data, the decoder hedges by producing a soft average. GANs and diffusion models produce sharper results because their losses reward individual sharp samples rather than the average.',
        'Posterior collapse. When the decoder is powerful enough to model data without using z (for example, an autoregressive decoder that can predict each pixel from previous pixels), the KL term drives q(z|x) to match the prior for every input. The encoder stops encoding, and the latent space becomes useless. Mitigations: KL annealing (start with KL weight at zero, slowly raise it), free bits (set a minimum KL per dimension below which no penalty applies), or deliberately weakening the decoder.',
        'Limited generation quality compared to GANs and diffusion. For tasks where sample sharpness is the primary metric (high-resolution photorealistic images, for example), VAEs alone are not competitive. Their strength is structured latent spaces, not raw output quality.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a 784-to-32-to-784 autoencoder on MNIST (28x28 grayscale digits, 784 pixels). The encoder is a two-layer network: 784 -> 256 -> two heads of size 32 (mu and logvar). The decoder mirrors it: 32 -> 256 -> 784. The bottleneck at 32 dimensions forces the network to compress 784 pixel values into 32 numbers.',
        'Encoding: feed a digit "7" image. The encoder outputs mu = [0.5, -0.3, ...] (32 values) and logvar = [-3.2, -1.8, ...] (32 values). Compute sigma = exp(0.5 * logvar) = [0.20, 0.41, ...]. The encoder says: "this 7 probably lives near mu, with uncertainty sigma in each direction."',
        'Sampling: draw epsilon = [0.7, -0.5, ...] from N(0, I). Compute z = mu + sigma * epsilon = [0.5 + 0.20 * 0.7, -0.3 + 0.41 * (-0.5), ...] = [0.64, -0.51, ...]. This z carries the input information plus controlled noise.',
        'KL for two dimensions: dimension 1 has sigma^2 = 0.04, mu^2 = 0.25, ln(0.04) = -3.22, giving KL_1 = 0.5 * (0.04 + 0.25 - 1 + 3.22) = 1.255 nats. Dimension 2 has sigma^2 = 0.168, mu^2 = 0.09, ln(0.168) = -1.78, giving KL_2 = 0.5 * (0.168 + 0.09 - 1 + 1.78) = 0.519 nats. Sum across all 32 dimensions for total KL. Add reconstruction error (binary cross-entropy between predicted pixel probabilities and true pixels) for the full ELBO loss.',
        'Reconstruction: the decoder maps z through 32 -> 256 -> 784, outputting a probability for each pixel. The result looks like a slightly fuzzy "7". Training adjusts encoder weights to lower KL (push mu toward 0, sigma toward 1) and decoder weights to lower reconstruction error. The two pressures compete: sharp codes help reconstruction, broad codes help KL.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Rumelhart, Hinton, and Williams, Learning Representations by Back-Propagating Errors (1986) -- autoencoders as a consequence of backpropagation through a bottleneck. Kingma and Welling, Auto-Encoding Variational Bayes (2014) -- the VAE paper, introducing the reparameterization trick and ELBO objective. Rezende, Mohamed, and Wierstra, Stochastic Backpropagation and Approximate Inference in Deep Generative Models (2014) -- independent co-discovery of the same ideas. Higgins et al., beta-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework (2017) -- disentangled representations via scaled KL weight.',
        'Prerequisite gaps: neural network basics (the encoder and decoder are standard feedforward or convolutional networks), backpropagation (gradients through the reparameterization trick). Natural extensions: beta-VAE and disentangled representations, VQ-VAE (discrete latent codes instead of continuous Gaussians). Production versions: latent diffusion (Stable Diffusion uses a VAE encoder-decoder wrapped around a diffusion core). Contrasting alternatives: GAN (sharper outputs, unstable adversarial training), diffusion models (highest quality generation, but hundreds of sequential steps), PCA (linear, closed-form, no generation, but fast and interpretable for linear data).',
      ],
    },
  ],
};
