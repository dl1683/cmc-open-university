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
      heading: `Why This Exists`,
      paragraphs: [
        `A variational autoencoder is a neural generative model built from three ideas: an encoder, a decoder, and a probability distribution over latent variables. The encoder receives an input such as an image, sequence, molecule, or feature vector and does not output one fixed code. It outputs the parameters of a distribution, usually a mean vector and a scale or log-variance vector. A latent sample is drawn from that distribution. The decoder receives the sampled latent variable and predicts the original input or a distribution over possible outputs.`,
        `The word variational points to the training objective. The model cannot directly compute the true posterior distribution over latent causes for each input, so it learns an approximate posterior. Training rewards reconstructions that explain the data while penalizing latent distributions that drift too far from a simple prior such as a standard normal Gaussian. The result is not only a compressor. It is a model that tries to make its compressed space continuous, regular, and sampleable.`,
      ],
    },
    {
      heading: `The Obvious Approach And The Wall`,
      paragraphs: [
        `The obvious approach is a plain autoencoder. Train an encoder to compress each input into a vector, train a decoder to reconstruct the input from that vector, and hope the middle vector becomes a useful representation. This works well for compression and denoising, but it has a generative wall. The latent codes may become isolated islands. Known examples reconstruct nicely, while random points between or around those islands decode into nonsense because the decoder never learned what to do there.`,
        `Another wall is sampling. A generator should let you draw a random latent vector and decode it into a plausible new example. A plain autoencoder gives no reason for random vectors to land in meaningful territory. It can build a lookup-like internal coordinate system that is efficient for reconstruction but hostile to generation. A VAE changes the contract. The encoder must describe a local probability cloud around each input, and those clouds are kept near a shared prior so the decoder sees a filled-in latent space rather than disconnected addresses.`,
      ],
    },
    {
      heading: `The Core Insight`,
      paragraphs: [
        `The core insight is to train reconstruction and latent regularity at the same time. For each input x, the encoder learns q(z given x), an approximate posterior over latent variables. The decoder learns p(x given z), a likelihood model that says what outputs are probable for a latent sample. The prior p(z), often a unit Gaussian, is the simple distribution we want to sample from later. The encoder is pushed to keep q(z given x) close enough to p(z) that prior samples remain decodable.`,
        `This creates an information bottleneck with a purpose. The latent variable must carry enough information to reconstruct the input, but it must not become an arbitrary private address. The KL penalty charges the model for using a posterior that is too specific or too far from the prior. The reconstruction term charges the model for throwing away too much information. Useful VAE behavior lives in the balance between those two pressures.`,
      ],
    },
    {
      heading: `Mechanism And Data Structures`,
      paragraphs: [
        `A practical VAE stores a batch of inputs, an encoder network, two latent-parameter tensors, a noise tensor, a sampled latent tensor, a decoder network, and loss terms. For a batch of B examples and a latent width L, the encoder produces mu with shape B by L and logvar with shape B by L. Log variance is common because it is numerically stable and can represent positive variance after exponentiation. A noise tensor epsilon is sampled from a standard normal distribution with the same shape.`,
        `The reparameterization trick is the key dataflow move. Instead of sampling z directly from a distribution whose parameters are learned, the model computes z = mu + sigma * epsilon, where sigma is derived from logvar and epsilon is independent noise. Randomness remains in the forward pass, but the path from loss back to mu and sigma is differentiable. Backpropagation can now adjust the encoder because z is a deterministic function of learned parameters plus external noise.`,
        `The decoder turns z into output parameters. For images, it might predict Bernoulli probabilities or Gaussian means for pixels. For continuous features, it may predict a Gaussian likelihood. For text or discrete tokens, the decoder architecture and likelihood need more care. Training then combines a reconstruction loss with a KL divergence between q(z given x) and the prior. The common Gaussian KL term can be computed per latent dimension and summed across the batch, which makes the objective efficient and easy to monitor.`,
      ],
    },
    {
      heading: `Why It Works`,
      paragraphs: [
        `VAEs work because they turn latent geometry into part of the loss. Reconstruction alone teaches the decoder to use codes near training examples. KL regularization teaches the encoder to place those codes in a region that resembles the prior. When the balance is good, nearby latent points decode to related outputs, interpolations become meaningful, and random samples from the prior have a chance of landing on the learned data manifold.`,
        `The method is also attractive because it trains with one differentiable objective rather than an adversarial game. GANs can produce sharper samples, but their training dynamics can be unstable and their latent coverage can be hard to diagnose. Normalizing flows provide exact likelihoods but require invertible architectures. Diffusion models often produce higher quality samples but spend many denoising steps. VAEs occupy a useful middle ground: tractable training, explicit latent variables, approximate likelihood, and a representation that downstream systems can inspect or reuse.`,
      ],
    },
    {
      heading: `Evaluation And Operational Signals`,
      paragraphs: [
        `A VAE should be monitored through several signals, not one loss curve. Track reconstruction loss to see whether the decoder can explain inputs. Track KL divergence to see whether the latent code is being used and how strongly it is being regularized. Track the evidence lower bound as the combined objective, but remember that better ELBO does not always mean better perceptual sample quality. Inspect reconstructions, unconditional samples from the prior, latent interpolations, and class or attribute structure when labels are available.`,
        `Posterior collapse is the failure signal to watch in powerful decoders. The KL term falls near zero because the encoder distribution matches the prior for every input, and the decoder learns to ignore z. Reconstructions may still look acceptable if the decoder can model local patterns from its own autoregressive context. KL annealing, free bits, weaker decoders, skip constraints, hierarchical latents, or capacity schedules are common responses. Another signal is holes in latent space: training reconstructions look good, but random prior samples are poor. That usually means the latent posterior family or KL weight is not producing enough coverage.`,
      ],
    },
    {
      heading: `Where VAEs Are Useful`,
      paragraphs: [
        `VAEs are useful when the latent representation matters as much as the final sample. They are used for anomaly detection, where unusual inputs may reconstruct poorly or receive low approximate likelihood. They are used for compression, denoising, missing-data imputation, molecule and protein design, recommender systems, semi-supervised learning, representation learning, and simulation. In image generation, a VAE-like autoencoder can compress pixels into a latent space where a diffusion model works more cheaply than it would at full resolution.`,
        `The model is also useful as a conceptual foundation. It teaches how a neural network can represent uncertainty, how sampling can be made differentiable, and how an objective can trade fidelity against structure. Even when a production system uses a diffusion model, flow, transformer, or custom latent model instead, the VAE vocabulary of encoder, decoder, prior, posterior, likelihood, and latent variable remains important.`,
      ],
    },
    {
      heading: `Where They Fail`,
      paragraphs: [
        `VAEs can produce blurry outputs when the likelihood rewards averaging. If many sharp images are plausible, a simple squared-error or Gaussian pixel loss may favor a soft average rather than a crisp sample. They can also learn entangled latent variables where dimensions do not correspond to clean human concepts. Beta-VAE variants increase the KL pressure to encourage disentanglement, but this often trades away reconstruction detail and is not guaranteed to discover the factors a person cares about.`,
        `A VAE can also be misused as an anomaly detector if reconstruction error is trusted blindly. Some anomalies reconstruct well because they are simple. Some normal examples reconstruct badly because they are rare. Likelihood can also be unintuitive in high-dimensional data. For operational use, VAE scores need calibration against labeled anomalies, slice analysis, and comparison with simpler baselines. A generative model is not automatically a reliable detector just because it learned a latent space.`,
      ],
    },
    {
      heading: `What To Study Next`,
      paragraphs: [
        `Study the neural network forward pass and backpropagation first, because VAEs rely on ordinary differentiable computation plus one sampling trick. Study probability distributions, KL divergence, maximum likelihood, and the evidence lower bound to understand the objective. Then compare VAEs with GANs, normalizing flows, diffusion models, and sparse autoencoders. For practical systems, study latent diffusion, calibration, anomaly detection metrics, and representation learning so the latent space is judged by usefulness rather than by attractive reconstructions alone.`,
      ],
    },
  ],
};
