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
  const pointIds = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
  const numPoints = pointIds.length;

  yield {
    state: flowCloud('Start with a simple base density', false),
    highlight: { active: ['p0', 'p1', 'p2', 'p3'], compare: ['p4', 'p5', 'p6', 'p7'] },
    explanation: `A normalizing flow starts with a simple distribution, often a standard Gaussian. Here ${numPoints} sample points are drawn from the base density — sampling from it is easy and evaluating its density is easy.`,
  };

  yield {
    state: flowCloud('Apply an invertible transformation', true),
    highlight: { found: pointIds },
    explanation: `The flow warps all ${numPoints} base points into a more complex data-shaped density. The transform must be invertible so every data point x maps back to exactly one base point z.`,
    invariant: `No probability mass can vanish across the ${numPoints} points; it can only stretch or compress.`,
  };

  const covRows = [
    { id: 'base', label: 'base log p(z)' },
    { id: 'inverse', label: 'inverse x to z' },
    { id: 'jac', label: 'log determinant' },
    { id: 'data', label: 'log p(x)' },
  ];

  yield {
    state: labelMatrix(
      'The change-of-variables formula',
      covRows,
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
    explanation: `The ${covRows.length} components — base density, inverse map, Jacobian determinant, and data likelihood — combine into the change-of-variables formula. When the transform stretches space, density decreases; when it compresses, density increases.`,
  };

  const genRows = [
    { id: 'flow', label: 'normalizing flow' },
    { id: 'vae', label: 'VAE' },
    { id: 'gan', label: 'GAN' },
    { id: 'diff', label: 'diffusion' },
  ];

  yield {
    state: labelMatrix(
      'Flow tradeoffs versus other generators',
      genRows,
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
    explanation: `Comparing ${genRows.length} generative approaches: flows are attractive when density estimation matters. Their cost is architectural — layers must stay invertible and have tractable Jacobian determinants.`,
  };
}

function* couplingLayers() {
  const splitRows = [
    { id: 'x1', label: 'x1' },
    { id: 'x2', label: 'x2' },
    { id: 'net', label: 'scale/shift net' },
    { id: 'y', label: 'output y' },
  ];

  yield {
    state: labelMatrix(
      'A coupling layer updates only part of the vector',
      splitRows,
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
    explanation: `Coupling layers split the vector into ${splitRows.length} roles: ${splitRows.map(r => r.id).join(', ')}. Leave part unchanged, use it to compute scale and shift for the other part, then alternate masks across layers. The inverse stays cheap.`,
    invariant: `Expressiveness comes from stacking simple invertible layers — each split handles ${splitRows.length} components.`,
  };

  const jacRows = [
    { id: 'dense', label: 'arbitrary neural net' },
    { id: 'coupling', label: 'coupling layer' },
    { id: 'autoregressive', label: 'autoregressive flow' },
    { id: 'continuous', label: 'continuous flow' },
  ];

  yield {
    state: labelMatrix(
      'Why the Jacobian stays tractable',
      jacRows,
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
    explanation: `A generic neural network is not enough. These ${jacRows.length} approaches — ${jacRows.map(r => r.id).join(', ')} — show that flow layers must be designed so inverse and determinant are computationally feasible.`,
  };

  const cloudPoints = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];

  yield {
    state: flowCloud('Stacked coupling layers reshape the density', true),
    highlight: { found: cloudPoints },
    explanation: `One coupling layer is limited. Many layers, with permutations or masks between them, can bend ${cloudPoints.length} Gaussian samples into complex data distributions while preserving exact density accounting.`,
  };

  const appRows = [
    { id: 'density', label: 'density estimation' },
    { id: 'anomaly', label: 'anomaly detection' },
    { id: 'vae', label: 'richer VAE posterior' },
    { id: 'audio', label: 'audio/image models' },
  ];

  yield {
    state: labelMatrix(
      'Where flows are useful',
      appRows,
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
    explanation: `Across ${appRows.length} application areas — ${appRows.map(r => r.label).join(', ')} — flows are most valuable when the exact change in probability density matters.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The first view starts with points from a simple base distribution, usually a standard normal distribution. The transform bends those points into a data-shaped cloud, but each moved point still has exactly one origin. The safe inference is that no probability mass disappears; it only stretches or compresses through an invertible map.',
        'The coupling-layer view shows the engineering trick. One part of the vector is copied through, and that copied part computes scale and shift for the other part. The copy makes the inverse possible and makes the Jacobian determinant cheap.',
        {type: 'image', src: './assets/gifs/normalizing-flows.gif', alt: 'Animated walkthrough of the normalizing flows visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A generative model creates new samples, but many jobs also need a probability for an observed sample. Anomaly detection, density estimation, Bayesian inference, and compression all ask not only whether a sample looks plausible, but how much probability the model assigns to it. Normalizing flows exist for the case where exact likelihood matters.',
        {type: 'callout', text: 'A normalizing flow is useful because every generated point keeps a reversible path back to a base density and an exact volume correction.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg', alt: 'Normal distribution probability density functions', caption: 'The base distribution is intentionally simple; the learned flow spends its capacity on the reversible map from that base space into data space. Source: Wikimedia Commons, Inductiveload, public domain.'},
        'A flow starts from an easy density such as a Gaussian and learns a reversible chain of functions into data space. Because every step is invertible, a data point can be mapped backward to the base space and scored exactly with a volume correction.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to train an ordinary neural network that maps random noise to data. That can generate samples, and it gives the network maximum architectural freedom. GANs and diffusion models show that this direction can produce strong samples.',
        'Another obvious approach is a variational autoencoder. It has a latent space and likelihood terms, but training optimizes a lower bound rather than the exact marginal likelihood. These approaches are useful, but they do not give the simple reversible accounting that flows target.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is probability accounting. If the generator is not invertible, one data point may have many possible latent causes, or none that can be recovered cheaply. If the volume change of the map is expensive to compute, exact density becomes too slow.',
        'A generic neural network has a dense Jacobian matrix, which records how every output coordinate changes with every input coordinate. Computing a determinant for a large dense matrix costs O(d^3) in d dimensions. That cost destroys the appeal of exact likelihood for high-dimensional data.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Jacobian_determinant_and_distortion.svg', alt: 'Nonlinear map distorting a square into a curved parallelogram', caption: 'The Jacobian determinant measures local area change, which is the exact density correction flows add to the base log probability. Source: Wikimedia Commons, public domain.'},
        'The core insight is the change-of-variables formula. If x = f(z) and f is invertible, then p(x) = p(z) * absolute determinant of dz/dx. In log form, the model adds base log density and subtracts the log volume expansion.',
        'This turns generation into learned coordinate conversion. The base density is simple because the model spends its capacity on the reversible map. The determinant is the accounting term that turns a warp into a probability model.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A flow is easiest to audit as a directed chain of reversible maps; every edge must have an inverse and an accounting term. Source: Wikimedia Commons, David W., public domain.'},
        'A flow is a composition f_k after ... after f_1. Sampling runs forward: draw z, apply each layer, and output x. Likelihood runs backward: invert each layer, recover z, evaluate base log p(z), and add all log-determinant corrections.',
        'Coupling layers make this tractable. Split x into x_a and x_b, copy x_a, and use a small network of x_a to predict scale s and shift t for x_b. The output is y_a = x_a and y_b = x_b * exp(s) + t, so the inverse is x_b = (y_b - t) / exp(s).',
        'The Jacobian of a coupling layer is triangular because y_a is copied and y_b depends on x_b through a diagonal scale. A triangular determinant is the product of diagonal entries, so the log determinant is just the sum of scale values. Stacking layers with alternating masks gives dimensions chances to influence each other.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from invertibility and conservation of probability mass. Each layer maps one input point to one output point, so density can be moved but not lost. The determinant corrects for local stretching: twice as much volume means half as much density over that region.',
        'Composition preserves the argument. The inverse of a chain is the chain of inverses in reverse order, and log determinants add across layers. If every layer is invertible and every determinant is computed correctly, the final likelihood is exact under the model.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A flow pays for exact likelihood with architectural restriction. Each layer must have a cheap inverse and cheap determinant. Coupling layers make one pass O(d) plus the cost of the scale-shift network, but many layers may be needed for expressive density shapes.',
        'Cost also depends on direction. Some flows make sampling fast and density slower; autoregressive variants often make one direction sequential. Continuous normalizing flows use differential-equation solvers, so their cost is dominated by solver steps and trace estimates rather than one fixed stack of layers.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Flows are useful for density estimation, simulation, variational inference, richer VAE posteriors, and scientific inverse problems where a reversible map is natural. They also appear in audio and image models when exact likelihood or a fast inverse path is valuable. The fit is strongest when the probability number is part of the task, not just a training loss.',
        'They are also useful as components inside larger models. A flow posterior can make a variational model less rigid, and an invertible preprocessing map can turn difficult variables into easier ones. In those roles, the flow does not need to win a sample-quality contest by itself.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Flows fail when the invertibility constraint blocks the architecture needed for the data. Dimension changes, pooling, stochastic layers, and arbitrary attention are not free in a reversible model. The design must preserve exact inverses and tractable determinants.',
        'Exact likelihood can also mislead. A model may assign high likelihood to simple background statistics while failing semantic anomaly detection. For high-resolution images, diffusion and autoregressive models have often produced better samples even when flows give cleaner density accounting.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use a one-dimensional flow x = 2z + 3 with z from a standard normal distribution. The inverse is z = (x - 3) / 2, and the derivative dx/dz is 2. Because the map stretches lengths by 2, the output density is half the base density at the inverse point.',
        'At x = 5, the inverse is z = 1. The standard normal density at z = 1 is about 0.242. The flow density is 0.242 / 2 = 0.121, and the log density is log(0.242) - log(2) = -1.419 - 0.693 = -2.112. This same formula is what high-dimensional flows use with determinants instead of one derivative.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Rezende and Mohamed, Variational Inference with Normalizing Flows, 2015; Dinh, Sohl-Dickstein, and Bengio, Density Estimation using Real NVP, 2016; Kingma and Dhariwal, Glow, 2018; Chen et al., Neural Ordinary Differential Equations, 2018.',
        'Study Probability Density, Change of Variables, Jacobian Matrices, Determinants, Variational Autoencoders, Diffusion Models, and Autoregressive Models next. The target skill is to compute one inverse and one log determinant by hand before trusting a large architecture.',
      ],
    },
  ],
};
