// Normalizing flows: transform a simple density through invertible functions
// while tracking the Jacobian determinant exactly.

import { scatterState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'normalizing-flows',
  title: 'Normalizing Flows',
  category: 'AI & ML',
  summary: 'Exact likelihood generative modeling with invertible transforms, change-of-variables, and Jacobian determinants.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['change of variables', 'coupling layers'], defaultValue: 'change of variables' },
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

function flowCloud(title, transformed) {
  const base = [
    [-1.2, -0.8], [-0.9, 0.1], [-0.4, -1.1], [0.0, 0.2],
    [0.4, -0.3], [0.8, 0.6], [1.1, -0.4], [1.3, 0.9],
  ];
  const points = base.map(([x, y], i) => {
    if (!transformed) return { id: `p${i}`, x, y, clusterId: 'base' };
    return { id: `p${i}`, x: x + 0.6 * Math.sin(2 * y), y: y + 0.45 * x * x - 0.3, clusterId: 'flowed' };
  });
  return scatterState({
    axes: { x: { label: transformed ? 'data x1' : 'base z1', min: -2.2, max: 3.0 }, y: { label: transformed ? 'data x2' : 'base z2', min: -2.2, max: 2.5 } },
    points,
  }, { title });
}

function* changeOfVariables() {
  yield {
    state: flowCloud('Start with a simple base density', false),
    highlight: { active: ['p0', 'p1', 'p2', 'p3'], compare: ['p4', 'p5', 'p6', 'p7'] },
    explanation: 'A normalizing flow starts with a simple distribution, often a standard Gaussian. Sampling from it is easy and evaluating its density is easy.',
  };

  yield {
    state: flowCloud('Apply an invertible transformation', true),
    highlight: { found: ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'] },
    explanation: 'The flow warps the simple density into a more complex data-shaped density. The transform must be invertible so every data point x maps back to exactly one base point z.',
    invariant: 'No probability mass can vanish; it can only stretch or compress.',
  };

  yield {
    state: labelMatrix(
      'The change-of-variables formula',
      [
        { id: 'base', label: 'base log p(z)' },
        { id: 'inverse', label: 'inverse x to z' },
        { id: 'jac', label: 'log determinant' },
        { id: 'data', label: 'log p(x)' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['known density', 'cheap'],
        ['recover z', 'requires invertible map'],
        ['volume correction', 'must be tractable'],
        ['exact likelihood', 'sum the terms'],
      ],
    ),
    highlight: { found: ['base:role', 'jac:role', 'data:role'], compare: ['jac:cost'] },
    explanation: 'When the transform stretches space, density decreases; when it compresses space, density increases. The Jacobian determinant is the volume correction that makes exact likelihood possible.',
  };

  yield {
    state: labelMatrix(
      'Flow tradeoffs versus other generators',
      [
        { id: 'flow', label: 'normalizing flow' },
        { id: 'vae', label: 'VAE' },
        { id: 'gan', label: 'GAN' },
        { id: 'diff', label: 'diffusion' },
      ],
      [
        { id: 'advantage', label: 'advantage' },
        { id: 'constraint', label: 'constraint' },
      ],
      [
        ['exact likelihood', 'invertible architecture'],
        ['latent inference', 'lower bound only'],
        ['sharp samples', 'no likelihood'],
        ['high quality', 'iterative sampling'],
      ],
    ),
    highlight: { active: ['flow:advantage'], compare: ['flow:constraint', 'diff:constraint'] },
    explanation: 'Flows are attractive when density estimation matters. Their cost is architectural: layers must stay invertible and have tractable Jacobian determinants.',
  };
}

function* couplingLayers() {
  yield {
    state: labelMatrix(
      'A coupling layer updates only part of the vector',
      [
        { id: 'x1', label: 'x1' },
        { id: 'x2', label: 'x2' },
        { id: 'net', label: 'scale/shift net' },
        { id: 'y', label: 'output y' },
      ],
      [
        { id: 'forward', label: 'forward' },
        { id: 'inverse', label: 'inverse' },
      ],
      [
        ['copied through', 'known directly'],
        ['scaled and shifted', 'undo with copied x1'],
        ['conditioned on x1', 'recompute from y1'],
        ['triangular Jacobian', 'cheap determinant'],
      ],
    ),
    highlight: { active: ['x1:forward', 'x2:forward', 'net:forward'], found: ['y:forward'] },
    explanation: 'Coupling layers are a common flow design. Leave part of the vector unchanged, use it to compute scale and shift for the other part, then alternate masks across layers. The inverse stays cheap.',
    invariant: 'Expressiveness comes from stacking simple invertible layers.',
  };

  yield {
    state: labelMatrix(
      'Why the Jacobian stays tractable',
      [
        { id: 'dense', label: 'arbitrary neural net' },
        { id: 'coupling', label: 'coupling layer' },
        { id: 'autoregressive', label: 'autoregressive flow' },
        { id: 'continuous', label: 'continuous flow' },
      ],
      [
        { id: 'det', label: 'determinant cost' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['expensive', 'not directly usable'],
        ['cheap triangular', 'needs many layers'],
        ['structured', 'slow sample or density'],
        ['trace estimator', 'ODE solver cost'],
      ],
    ),
    highlight: { found: ['coupling:det'], compare: ['dense:det', 'continuous:tradeoff'] },
    explanation: 'A generic neural network is not enough. Flow layers are designed so inverse and determinant are computationally feasible. This is the central engineering constraint.',
  };

  yield {
    state: flowCloud('Stacked coupling layers reshape the density', true),
    highlight: { found: ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'] },
    explanation: 'One coupling layer is limited. Many layers, with permutations or masks between them, can bend a simple Gaussian into complex data distributions while preserving exact density accounting.',
  };

  yield {
    state: labelMatrix(
      'Where flows are useful',
      [
        { id: 'density', label: 'density estimation' },
        { id: 'anomaly', label: 'anomaly detection' },
        { id: 'vae', label: 'richer VAE posterior' },
        { id: 'audio', label: 'audio/image models' },
      ],
      [
        { id: 'why', label: 'why flow helps' },
        { id: 'warning', label: 'warning' },
      ],
      [
        ['exact log likelihood', 'likelihood can mislead'],
        ['low density flag', 'background bias'],
        ['flexible q(z|x)', 'extra compute'],
        ['fast inverse or sample path', 'architecture-specific'],
      ],
    ),
    highlight: { active: ['density:why', 'vae:why'], compare: ['anomaly:warning'] },
    explanation: 'Flows are most valuable when the exact change in probability density matters. That makes them a clean contrast with GANs and diffusion models.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'change of variables') yield* changeOfVariables();
  else if (view === 'coupling layers') yield* couplingLayers();
  else throw new InputError('Pick a normalizing-flow view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A normalizing flow is a generative model that transforms a simple base distribution into a complex data distribution through a sequence of invertible functions. Because every transformation is invertible and has a tractable Jacobian determinant, the model can compute exact likelihoods.',
        'This makes flows the exact-density neighbor of Variational Autoencoders, GANs, and Diffusion Models. VAEs optimize a lower bound. GANs avoid explicit likelihood. Diffusion models learn iterative denoising. Flows keep the likelihood equation explicit.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The change-of-variables formula says log p(x) equals log p(z) plus a volume correction from the inverse transform. If the transform expands a region, density falls. If it compresses a region, density rises. The log determinant of the Jacobian records that volume change.',
        'Flow layers are designed to be invertible and tractable. Coupling layers copy part of the vector through unchanged, use it to compute scale and shift for the remaining part, and alternate masks across layers. That gives a triangular Jacobian and a cheap determinant.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is architectural constraint. A flow cannot use arbitrary layers unless they preserve invertibility and tractable density. Expressiveness often requires many layers, permutations, or specialized designs. Exact likelihood is valuable, but high likelihood does not always align with human-perceived sample quality or anomaly detection.',
        'There is also a directionality tradeoff. Some flows make sampling fast and density slower; others make density fast and sampling slower. Autoregressive structure, coupling layers, continuous-time flows, and invertible convolutions all choose different points in that design space. The right design depends on whether the workload needs fast samples, fast likelihoods, or flexible posterior inference.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Normalizing flows are used for density estimation, anomaly detection, variational inference, simulation, scientific modeling, audio generation, and as flexible posterior families inside VAE-style systems. They are especially useful when you need both sampling and likelihood evaluation.',
        'They are also useful pedagogically because they make probability mass conservation explicit. When the model stretches a region, density must fall; when it compresses a region, density must rise. That mental model carries over to attention weights, calibration, Bayesian posteriors, and many other places where models reshape distributions.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Invertible does not mean universally expressive at fixed size. The constraints that make flows exact can limit architecture choices. Another trap is treating likelihood as the only quality metric. A model can assign high likelihood for reasons that do not match semantic quality or operational risk.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Variational Inference with Normalizing Flows at https://arxiv.org/abs/1505.05770 and the PMLR page at https://proceedings.mlr.press/v37/rezende15.html, plus Real NVP at https://arxiv.org/abs/1605.08803. Study Variational Autoencoders, Diffusion Models, Generative Adversarial Networks, Change-of-Variables intuition from probability, and Matrix Operations next.',
      ],
    },
  ],
};
