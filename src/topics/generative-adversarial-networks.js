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
      heading: 'Why this exists',
      paragraphs: [
        'A Generative Adversarial Network exists because direct likelihood modeling is not the only way to learn a data distribution. Instead of asking the model to assign a probability to every possible image, sound, or example, a GAN asks whether generated samples can become indistinguishable from real samples under an adaptive critic.',
        'The original GAN paper changed generative modeling by turning distribution learning into a game. The generator maps random noise to fake samples. The discriminator receives real and fake samples and learns to tell them apart. The generator improves by changing its samples so the discriminator makes mistakes.',
        'This is why GANs belong next to Variational Autoencoders, Normalizing Flows, and Diffusion Models. Each family chooses a different training signal. VAEs optimize a variational likelihood bound. Flows preserve exact invertible likelihood. Diffusion models learn denoising steps. GANs learn through a critic that keeps adapting to the generator.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach to image generation is to model pixels directly: estimate the probability of the next pixel or reconstruct images from a compressed latent code. That can work, but pixel-level likelihood often rewards safe averages. The model can receive a good loss while producing blurry samples because averaging several plausible images is mathematically convenient but visually wrong.',
        'Another obvious approach is to write a hand-coded evaluator for realism. That fails because realism is too rich. A face, building, melody, or texture can be wrong in thousands of subtle ways. GANs replace the fixed evaluator with a learned discriminator that improves as the generator improves.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that adversarial training is not ordinary supervised learning. There is no fixed target function. The generator\'s loss depends on the discriminator, and the discriminator\'s loss depends on the generator. When one player changes, the other player\'s landscape changes too.',
        'If the discriminator becomes too strong, the generator may receive gradients that are weak, saturated, or unhelpful. If the discriminator is too weak, the generator learns from a poor critic. If the generator finds one kind of sample that fools the discriminator, it can overproduce that sample and ignore the rest of the distribution. That failure is mode collapse.',
        'The second wall is evaluation. A sample grid can look impressive while hiding missing classes, near duplicates, memorized training examples, or narrow diversity. GANs made sample quality exciting, but they also taught the field that visual cherry-picking is not measurement.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Train the generator against a learned discriminator rather than a hand-written likelihood. The discriminator supplies a moving training signal: it learns what currently separates fake from real, and the generator follows the gradient that would make fake samples look more real to that discriminator.',
        'At the ideal equilibrium, the generated distribution matches the data distribution, and the discriminator cannot do better than chance. That does not mean training literally reaches a calm equilibrium in practice. It means the game has a target shape: the generator should match the whole distribution, not only produce a few plausible examples.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The minimax view shows the two training updates. First the discriminator learns a supervised classification problem: real samples should score real, generated samples should score fake. Then the generator receives gradients through the discriminator and changes its output so the discriminator is more likely to call it real.',
        'The mode-collapse view shows why good-looking samples are not enough. A generator can cover one cluster of the real distribution and produce sharp variants from that cluster. Locally those samples may look plausible. Globally the model is wrong because it misses most of the data distribution.',
        'The important thing to watch is balance. GAN training works only while the discriminator is strong enough to teach and not so strong that the generator stops receiving useful signal. The animation is not just a diagram of two networks; it is a diagram of a coupled optimization problem.',
      ],
    },
    {
      heading: 'How the algorithm works',
      paragraphs: [
        'Training alternates between two updates. In the discriminator step, draw real examples from the dataset, draw noise vectors, let the generator turn those noise vectors into fake examples, and update the discriminator to separate the two groups. This is ordinary classification, except the negative examples come from the current generator.',
        'In the generator step, draw new noise vectors, generate fake examples, pass them through the discriminator, and update the generator so those fake examples receive a higher real score. The discriminator\'s parameters are held fixed for this update; its gradients become the learning signal for the generator.',
        'The original minimax objective can suffer from saturation when the discriminator confidently rejects fake samples. Practical GAN training often uses a non-saturating generator loss, Wasserstein objectives, gradient penalties, spectral normalization, careful architectures, and tuned update ratios. Those changes all serve the same goal: keep gradients useful and keep the game from becoming degenerate.',
        'This is also why GAN losses are hard to read. A lower discriminator loss can mean the discriminator improved, the generator collapsed, or the game became imbalanced. A generator loss spike can mean sample quality worsened, or it can mean the discriminator learned a better boundary. The losses are game signals, not simple progress meters.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine training a toy GAN on a dataset with four clusters. The generator starts from random noise and produces points in the wrong places. The discriminator easily separates real clusters from generated points. The generator then moves its points toward regions that the discriminator currently scores as real.',
        'Now suppose one generated cluster begins to fool the discriminator. The generator may discover that producing variations of that one cluster is enough to improve its immediate loss. If nothing in training punishes missing the other clusters, the generator can collapse to that single mode. The generated samples look sharp around one cluster and still fail the distribution.',
        'A healthier generator spreads probability mass across all four clusters. Techniques such as minibatch discrimination, Wasserstein distance, gradient penalty, diversity-aware evaluation, and architecture changes try to preserve that coverage. None of them removes the central fact: the generator is learning from an adaptive critic, so stability must be engineered.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'GANs work when the discriminator learns differences that matter and the generator can follow those gradients toward the real data manifold. The discriminator is a learned loss function. It can notice high-level structure that a hand-written pixel loss would miss, which is why GAN samples were historically much sharper than many likelihood-trained alternatives.',
        'They also work because generation is cheap after training. A generator is usually a single forward pass from noise or condition to sample. That made GANs attractive for real-time image synthesis, super-resolution, style transfer, and simulation long before diffusion models became dominant for high-end image generation.',
        'The mechanism is powerful but fragile. The critic must be informative, the generator must be expressive, the data must contain learnable structure, and the training schedule must keep the game from tipping too far toward one player.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'GANs can produce sharp samples with fast one-pass generation, but training is unstable. Teams tune generator and discriminator capacity, learning rates, update ratios, normalization, regularization, augmentations, and evaluation metrics. Small choices can decide whether a run learns, oscillates, collapses, or memorizes.',
        'The debugging loop is harder than ordinary supervised learning because the loss curves are relational. A rising generator loss may mean the discriminator improved. A falling discriminator loss may mean progress or collapse. Serious GAN work uses fixed latent seeds, sample grids over time, diversity checks, nearest-neighbor memorization checks, and metrics such as FID with clear caveats.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'GANs win when you need fast sampling and high perceptual sharpness, and when the domain is constrained enough for adversarial training to stabilize. They have been used for image synthesis, super-resolution, style transfer, domain translation, image-to-image tasks, simulation assets, representation learning, and data augmentation.',
        'They also remain important beyond image generation. The generator-versus-critic pattern appears in domain-adversarial neural networks, adversarial robustness training, learned reward models, synthetic data review loops, and red-team systems. The general lesson is that a model trained against a judge may learn to exploit weaknesses in the judge.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'GANs fail when the game becomes imbalanced. A dominating discriminator can starve the generator of useful gradients. A dominating generator can exploit the discriminator. Mode collapse can hide under good-looking examples. Memorization can masquerade as realism. Metrics can reward the wrong mixture of fidelity and diversity.',
        'GANs are also less natural when exact likelihood, calibrated probability, or broad coverage matters more than perceptual sharpness. Diffusion models displaced GANs in many open-ended image workflows because they are easier to scale and more stable to train, even though they usually cost more sampling steps.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'A GAN is not just "a generator plus a discriminator." It is a distribution-matching game where the training signal is learned. That is the source of both its power and its instability.',
        'The central question is not whether one sample looks real. The question is whether the generator covers the real distribution without memorizing it, while preserving fidelity, diversity, and controllability.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Generative Adversarial Nets at https://papers.nips.cc/paper/5423-generative-adversarial-nets and the arXiv PDF at https://arxiv.org/abs/1406.2661. Study Neural Network Forward Pass, Backpropagation, Loss Landscapes & Optimization Geometry, Domain-Adversarial Neural Networks, Variational Autoencoders, Normalizing Flows, Diffusion Models, and Calibration Curves next.',
      ],
    },
  ],
};
