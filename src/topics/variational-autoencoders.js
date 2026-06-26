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
  const nodeIds = ['x', 'enc', 'mu', 'sigma', 'eps', 'z', 'dec', 'xhat'];
  const edgeIds = ['e-x-enc', 'e-enc-mu', 'e-enc-sigma', 'e-mu-z', 'e-sigma-z', 'e-eps-z', 'e-z-dec', 'e-dec-xhat'];
  const nodeCount = nodeIds.length;
  const edgeCount = edgeIds.length;

  yield {
    state: vaeGraph('A VAE encodes x into a distribution over z'),
    highlight: { active: ['x', 'enc', 'mu', 'sigma', 'e-x-enc', 'e-enc-mu', 'e-enc-sigma'], compare: ['dec'] },
    explanation: `A normal autoencoder maps x to a single code. A variational autoencoder uses ${nodeCount} nodes and ${edgeCount} edges to map x to a distribution over latent codes: mean mu and scale sigma. The decoder learns to reconstruct from samples drawn from that distribution.`,
  };

  const formula = 'mu + sigma * epsilon';
  const reparamParts = ['mu', 'sigma', 'epsilon'];

  yield {
    state: vaeGraph('Reparameterization moves randomness outside the network'),
    highlight: { active: ['eps', 'mu', 'sigma', 'z', 'e-eps-z', 'e-mu-z', 'e-sigma-z'], found: ['dec', 'xhat'] },
    explanation: `The reparameterization trick writes z = ${formula}, where ${reparamParts[2]} is random noise independent of the encoder. Gradients can flow through ${reparamParts[0]} and ${reparamParts[1]} because the sampling operation has been separated from the learned parameters.`,
    invariant: `Randomness stays across all ${reparamParts.length} components; the gradient path becomes usable.`,
  };

  const elboRows = ['recon', 'kl', 'sample', 'collapse'];
  const elboCols = ['pressure', 'failure'];

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
    explanation: `The VAE objective balances ${elboRows.length} concerns across ${elboCols.length} columns: reconstruction versus a KL penalty that pulls the encoder distribution toward a simple prior. That makes the latent space sampleable instead of a scattered lookup table.`,
  };

  const models = ['VAE', 'GAN', 'normalizing flow', 'diffusion'];

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
    explanation: `Among ${models.length} generative families (${models.join(', ')}), VAEs are the cleanest bridge between representation learning and generation. They are not always the sharpest sampler, but their latent structure is useful for interpolation, compression, anomaly detection, and latent diffusion.`,
  };
}

function* latentSpace() {
  const pointCount = 7;
  const axisMin = -3;
  const axisMax = 5;
  const unregShift = 2.4;

  yield {
    state: latentCloud('Without a prior penalty, codes can form isolated islands', false),
    highlight: { active: ['a0', 'a1', 'a2'], compare: ['b0', 'b1', 'b2'], removed: ['prior'] },
    explanation: `A plain autoencoder can learn separated code islands. With ${pointCount} points spread across axes ranging ${axisMin} to ${axisMax}, reconstruction is fine for known examples, but random latent samples may land in empty space the decoder never learned to handle.`,
  };

  const regShift = 0;

  yield {
    state: latentCloud('The KL term pulls codes toward a sampleable prior', true),
    highlight: { found: ['a0', 'a1', 'a2', 'b0', 'b1', 'b2', 'prior'] },
    explanation: `The KL term encourages the encoder distributions to live near a simple prior such as a unit Gaussian. With regularization the shift drops from ${unregShift} to ${regShift}, making interpolation and sampling meaningful: nearby z values decode to nearby outputs.`,
    invariant: `A generative latent space with ${pointCount} codes needs coverage, not only reconstruction.`,
  };

  const ops = ['interpolation', 'random sample', 'anomaly score', 'latent diffusion'];

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
    explanation: `VAEs make latent variables operational across ${ops.length} use cases (${ops.join(', ')}). The same geometry is why latent diffusion can generate in a compressed representation before decoding back to pixels.`,
  };

  const knobs = ['beta-VAE weight', 'latent capacity', 'decoder power', 'KL annealing'];

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
    explanation: `VAE behavior is sensitive to the balance between reconstruction and regularization across ${knobs.length} knobs. The model can memorize, blur, or ignore the latent code depending on architecture and schedules.`,
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
        'The reparameterization view shows a variational autoencoder, or VAE, as a dataflow graph. The encoder turns input x into a mean mu and standard deviation sigma, external noise epsilon is sampled, and the latent code is computed as z = mu + sigma * epsilon.',
        {
          type: 'callout',
          text: 'A VAE is trainable because randomness is sampled outside the encoder path while the latent sample remains differentiable with respect to mu and sigma.',
        },
        'The safe inference is about gradients. Because epsilon is outside the learned path, z is still a differentiable function of mu and sigma, so backpropagation can train the encoder even though the model samples.',
        'The latent-space view shows the second pressure. Points should reconstruct their inputs, but they are also pulled toward a simple prior distribution so random samples land in regions the decoder understands.',
      
        {type: 'image', src: './assets/gifs/variational-autoencoders.gif', alt: 'Animated walkthrough of the variational autoencoders visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A plain autoencoder compresses data into a code and decodes it back. It can learn useful features, but its latent space may be an irregular private coordinate system with gaps where the decoder produces nonsense.',
        'A VAE exists to make the code space usable for generation. It learns a distribution for each input and regularizes those distributions toward a shared prior, usually a standard normal distribution N(0, I).',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious compression baseline is PCA, which projects data onto directions of largest variance. PCA is fast and interpretable, but it only captures linear structure.',
        'A deterministic neural autoencoder is the next step. It uses nonlinear encoder and decoder networks, so it can reconstruct curved data manifolds better than PCA, but it still gives no reliable rule for sampling new latent points.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that reconstruction alone rewards memorization. If the encoder maps each training image to a tiny isolated island, the decoder can reconstruct known examples while random points between islands decode badly.',
        'Directly sampling from the encoder distribution creates another wall. A random draw is not differentiable with respect to the parameters that produced the distribution, so naive sampling blocks the gradient signal needed to train the encoder.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to optimize a lower bound with two forces. Reconstruction error asks the decoder to reproduce the input, while KL divergence asks the encoder distribution q(z|x) to stay close to the prior p(z).',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Reparameterized_Variational_Autoencoder.png', alt: 'Variational autoencoder dataflow after the reparameterization trick', caption: 'The reparameterized VAE separates probabilistic encoder outputs from external noise before the decoder reconstructs x. Source: Wikimedia Commons, Agustinus Kristiadi, CC BY-SA 4.0.'},
        'The reparameterization trick moves randomness into epsilon. The model samples epsilon from N(0, I), then computes z from learned mu and sigma, so the random path and the gradient path no longer collide.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The encoder outputs mu and log-variance. The model computes sigma = exp(0.5 * logvar), samples epsilon, and forms z = mu + sigma * epsilon.',
        'The decoder maps z back to an output distribution over x. For binary images this may be Bernoulli probabilities per pixel; for continuous data it may be Gaussian means.',
        'Training minimizes reconstruction error plus KL(q(z|x) || p(z)). For diagonal Gaussians, each latent dimension has KL = 0.5 * (sigma squared + mu squared - 1 - log(sigma squared)), which is cheap to compute exactly.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The bottleneck forces compression, but the KL term prevents arbitrary isolated codes. A code that moves far from zero pays a mu-squared penalty, and a code that becomes too certain pays through the log-variance term.',
        'The decoder learns to handle neighborhoods, not just points. Nearby z values decode to related outputs because training repeatedly samples around each encoded mean instead of only at one deterministic coordinate.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is the neural network forward and backward pass. The VAE-specific work, including two output heads, epsilon sampling, and closed-form KL, is usually small compared with convolution or transformer layers.',
        'Cost behaves with input size and latent size. Doubling image resolution increases encoder and decoder work sharply, while doubling latent dimension mostly doubles the small KL and sampling vectors plus the first decoder layer width.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'VAEs are useful for representation learning, anomaly detection, compressed generative modeling, and latent-space exploration. A high reconstruction error can mark a sample that falls off the learned training manifold.',
        'Latent diffusion systems use an autoencoder-style compression stage so the expensive generative process runs in a smaller latent grid instead of directly over pixels. The VAE idea also appears in recommender systems and molecular generation where a smooth latent space is useful.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'VAEs often produce blurry samples when the reconstruction loss rewards an average of many plausible outputs. If several sharp images could explain one latent point, squared error prefers the mean, which looks soft.',
        'Posterior collapse is another failure. A powerful decoder may ignore z, while the KL term pushes every q(z|x) toward the prior, leaving the latent code uninformative.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take a 28 by 28 MNIST image, so x has 784 pixel values, and use a latent dimension of 2 for easy arithmetic. Suppose the encoder outputs mu = [0.5, -0.3] and logvar = [-3.22, -1.78].',
        'Then sigma squared is about [0.04, 0.168], so sigma is about [0.20, 0.41]. If epsilon = [0.7, -0.5], then z = [0.5 + 0.20 * 0.7, -0.3 + 0.41 * -0.5] = [0.64, -0.505].',
        'The KL for dimension 1 is 0.5 * (0.04 + 0.25 - 1 - log(0.04)) = about 1.255. Dimension 2 is about 0.519, so these two dimensions add 1.774 nats before the reconstruction loss is included.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are Kingma and Welling, Auto-Encoding Variational Bayes (2014), and Rezende, Mohamed, and Wierstra, Stochastic Backpropagation and Approximate Inference in Deep Generative Models (2014). Rumelhart, Hinton, and Williams (1986) is the backpropagation foundation behind autoencoder training.',
        'Study backpropagation, PCA, probability distributions, KL divergence, beta-VAE, VQ-VAE, GANs, diffusion models, and latent diffusion. The contrast to remember is that VAEs buy a structured latent space by paying reconstruction sharpness and KL-balancing costs.',
      ],
    },
  ],
};
