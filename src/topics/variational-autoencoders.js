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
      heading: 'What it is',
      paragraphs: [
        'A variational autoencoder is a generative model that combines an encoder, a decoder, and a probabilistic latent space. The encoder maps each input to a distribution over latent variables. The decoder maps a sampled latent variable back to an output. The training objective rewards reconstruction and regularizes the latent distribution toward a simple prior.',
        'This makes VAEs a useful bridge between Autoencoder-style compression, Diffusion Models, Normalizing Flows, and representation learning. They explain why a smooth latent space matters, not just a low reconstruction loss.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The encoder outputs mu and sigma for q(z|x). Sampling naively would break ordinary backpropagation because the sample is random. The reparameterization trick writes z = mu + sigma * epsilon, where epsilon is independent random noise. Gradients can then flow through mu and sigma while preserving stochastic sampling.',
        'The VAE objective is the evidence lower bound. The reconstruction term asks the decoder to reproduce the input. The KL term asks the encoder distribution to stay close to the prior. If the KL term is too weak, random sampling lands in holes. If it is too strong, the decoder may ignore z and posterior collapse can occur.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'VAEs are usually easier to train than GANs because they optimize a single differentiable objective. The tradeoff is sample sharpness and objective design. A simple pixel reconstruction loss can produce blurry outputs because averaging plausible futures is rewarded. Better decoders, perceptual losses, hierarchical latents, and latent diffusion can improve quality.',
        'Another cost is choosing the information bottleneck. A large latent code can reconstruct well while behaving less like a useful prior. A tiny latent code can regularize well while throwing away details. The KL schedule, decoder strength, and latent dimensionality all decide whether the model learns a meaningful representation or merely an expensive compression trick.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'VAEs are used for representation learning, anomaly detection, compression, molecule generation, recommender systems, controllable generation, and as the autoencoding substrate behind latent diffusion systems. They are especially useful when you want a structured latent code that can be sampled, interpolated, or audited.',
        'In practice, a VAE is often valuable even when it is not the final image generator. The encoder can compress inputs into a smaller manifold, the decoder can reconstruct normal behavior, and the latent coordinates can become features for downstream classifiers, retrieval, clustering, or simulation.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A VAE is not just an autoencoder with noise. The KL term is what makes the latent space sampleable. Another misconception is that the decoder must always reconstruct perfectly. A perfect reconstruction model with a broken latent prior is not a useful generator. The model needs both local fidelity and global latent coverage.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Auto-Encoding Variational Bayes at https://arxiv.org/abs/1312.6114 and beta-VAE at https://openreview.net/forum?id=Sy2fzU9gl. Study Neural Network Forward Pass, Backpropagation, Embeddings & Similarity, Diffusion Models, Normalizing Flows, Sparse Autoencoder Feature Dictionary Case Study, and Gradient Descent next.',
      ],
    },
  ],
};
