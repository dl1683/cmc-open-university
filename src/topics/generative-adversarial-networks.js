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
  yield {
    state: ganGraph('GAN training is a two-player game'),
    highlight: { active: ['noise', 'gen', 'fake', 'e-noise-gen', 'e-gen-fake'], compare: ['real', 'disc'] },
    explanation: 'A GAN trains two neural networks. The generator turns random noise into fake samples. The discriminator sees real and fake samples and tries to classify them correctly.',
  };

  yield {
    state: ganGraph('The discriminator learns the boundary first'),
    highlight: { active: ['real', 'fake', 'disc', 'lossD', 'e-real-disc', 'e-fake-disc', 'e-disc-lossD'], compare: ['gen'] },
    explanation: 'The discriminator update is ordinary supervised learning: real examples should score real, generated examples should score fake. If D is too strong too early, the generator may receive weak or unstable gradients.',
    invariant: 'The training signal for G comes through D.',
  };

  yield {
    state: ganGraph('The generator updates to make D wrong'),
    highlight: { found: ['gen', 'lossG', 'e-disc-lossG'], active: ['disc', 'fake'] },
    explanation: 'The generator does not see the data likelihood directly. It receives gradients through the discriminator and learns to make samples that D classifies as real. That adversarial signal can produce sharp samples.',
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
    explanation: 'GANs changed generative modeling because they could produce sharp samples without an explicit pixel likelihood. The price is game dynamics: balance, oscillation, and collapse matter as much as architecture.',
  };
}

function* modeCollapse() {
  yield {
    state: dataModes(true),
    highlight: { active: ['g0', 'g1', 'g2', 'g3'], compare: ['r0', 'r1', 'r2', 'r3'] },
    explanation: 'Mode collapse happens when the generator finds one kind of sample that fools the discriminator and keeps producing variants of it. The samples may look realistic locally while missing most of the data distribution.',
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
    explanation: 'GAN samples can be photorealistic and still cover only a narrow slice of the real distribution. Evaluation needs both fidelity and diversity.',
    invariant: 'A generator must match the distribution, not only produce plausible examples.',
  };

  yield {
    state: dataModes(false),
    highlight: { found: ['g0', 'g1', 'g2', 'g3'], compare: ['r0', 'r1', 'r2', 'r3'] },
    explanation: 'A healthier generator spreads probability mass across modes. Techniques such as minibatch discrimination, Wasserstein objectives, gradient penalties, and architectural constraints were introduced to stabilize this coverage.',
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
    explanation: 'GAN engineering is about maintaining a useful game. If one player dominates, gradients become misleading. If evaluation is shallow, collapse can ship as quality.',
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
      heading: 'What it is',
      paragraphs: [
        'A Generative Adversarial Network trains a generator and discriminator together. The generator maps random noise to fake samples. The discriminator tries to distinguish real samples from generated samples. The generator improves by making the discriminator wrong.',
        'GANs are the classic adversarial generative model. They belong next to Diffusion Models, Variational Autoencoders, and Normalizing Flows because each family makes a different tradeoff between likelihood, sample quality, training stability, and sampling cost.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The discriminator update is supervised: real data should score real and generated data should score fake. The generator update uses the discriminator gradient: change generated samples so D classifies them as real. This is a minimax game, not a single fixed objective in the ordinary supervised-learning sense.',
        'At equilibrium, the generator distribution matches the data distribution and the discriminator cannot do better than chance. In practice, training may oscillate, one player may dominate, or the generator may collapse to a few modes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'GANs can produce sharp samples with fast one-pass generation, but training is unstable. The team has to tune generator and discriminator capacity, learning rates, update ratios, normalization, regularization, and evaluation metrics. A visually strong sample grid can hide low diversity or memorization.',
        'The debugging loop is harder than ordinary supervised learning because losses are not always interpretable. A rising generator loss may mean the discriminator improved, not that samples worsened. A falling discriminator loss may mean real progress or a collapsed generator. This is why GAN work historically invested heavily in diagnostics, fixed random seeds, sample grids over time, and diversity metrics.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'GANs have been used for image synthesis, super-resolution, style transfer, data augmentation, domain adaptation, simulation, and representation learning. Diffusion models displaced GANs in many image-generation workflows, but GANs remain a vital conceptual foundation for adversarial training and distribution matching.',
        'They also remain a useful mental model for any system that learns from an adaptive critic. Domain-Adversarial Neural Networks, adversarial robustness training, learned reward models, and red-team loops all share the same warning: once a model learns against a judge, it may exploit weaknesses in the judge.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The discriminator is not an evaluator you can trust after training. It is part of the game and can be exploited. Mode collapse is the central misconception trap: samples can look realistic while missing most of the distribution. Evaluation needs diversity, coverage, memorization checks, and human review when stakes are high.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Generative Adversarial Nets at https://papers.nips.cc/paper/5423-generative-adversarial-nets and the arXiv PDF at https://arxiv.org/abs/1406.2661. Study Neural Network Forward Pass, Backpropagation, Domain-Adversarial Neural Networks, Variational Autoencoders, Diffusion Models, and Loss Landscapes & Optimization Geometry next.',
      ],
    },
  ],
};
