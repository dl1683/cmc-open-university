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
      heading: 'Why Flows Exist',
      paragraphs: [
        `A normalizing flow is a generative model that turns a simple probability distribution into a complex one through a chain of invertible transformations. Start with something easy, usually a standard Gaussian. Pass samples through learned invertible layers. The output distribution can bend around real data. Because every step is reversible, any data point can be mapped back to one base point, and the model can compute its exact likelihood through the change-of-variables formula.`,
        `Flows exist because many generative models make a trade. GANs can produce sharp samples but do not give a usable likelihood. Variational autoencoders have latent variables and likelihood terms, but training optimizes a lower bound rather than the exact marginal likelihood. Diffusion models can produce excellent samples but usually require iterative denoising. Normalizing flows keep density estimation explicit. They are built for the case where you care not only about generating samples, but also about knowing how much probability the model assigns to an observation.`,
      ],
    },
    {
      heading: 'The Wall They Answer',
      paragraphs: [
        `The obvious way to build a flexible density model is to use a powerful neural network that maps noise to data. The wall appears when you ask for likelihood. If the network is not invertible, one output may have many possible inputs or no clean input at all. If the Jacobian determinant is expensive, the probability accounting becomes too slow. A generic neural network can be expressive, but expression alone is not enough for exact density.`,
        `Normalizing flows accept a narrower architecture in exchange for exact accounting. Every layer must be invertible, and the determinant of its Jacobian must be tractable. That constraint looks severe, and it is. But it buys a rare property: sampling and density evaluation are connected by one coherent probability equation. Probability mass is not created or destroyed. It is stretched, squeezed, and tracked.`,
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        `The core insight is the change-of-variables formula. If z comes from a simple base density and x is produced by an invertible function f(z), then the density of x can be computed by going backward: find z = f inverse of x, evaluate the base density at z, and correct for how much the transform stretched or compressed volume. In log form, the correction becomes a log absolute determinant of the Jacobian.`,
        `That volume correction is the heart of the model. If a transformation expands a small patch of space into a larger region, the density over that region must go down. If it compresses a larger region into a smaller one, density must go up. The determinant measures this local volume change. A flow is therefore not just a generator. It is a learned coordinate system where the model knows exactly how volume changes from base space to data space.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `A flow is a composition of invertible functions: f = f_k composed with ... composed with f_2 composed with f_1. Sampling runs forward. Draw z from the base distribution, apply the layers, and get x. Likelihood evaluation usually runs backward. Given x, invert each layer to recover z, add the base log density, and add all the log-determinant corrections. Because log determinants add across composed transformations, the model can accumulate exact likelihood one layer at a time.`,
        `Coupling layers are a common design because they make the inverse and determinant cheap. Split the input vector into two parts. Copy one part through unchanged. Use the copied part as input to a neural network that predicts scale and shift values for the other part. The changed part can be inverted because the copied part is still known. The Jacobian is triangular, so its determinant is just the product of diagonal terms, or the sum of log scales in log space. Stacking many such layers with masks or permutations creates expressiveness.`,
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        `Take a one-dimensional base variable z from a standard normal distribution and transform it with x = 2z + 3. This map is invertible: z = (x - 3) / 2. The derivative is 2, so the transformation stretches lengths by a factor of 2. The density at x is the base density at z multiplied by 1/2. Stretching space spreads probability mass out. In log form, log p(x) = log p(z) - log 2.`,
        `Real flows use many dimensions and nonlinear transformations, but the same accounting remains. A two-dimensional flow might twist a round Gaussian cloud into a banana-shaped distribution. Points that were close in base space move into data space. The model can still trace each point backward. Wherever the transform compresses area, density rises. Wherever it expands area, density falls. The visual warping is easy to enjoy, but the determinant is what makes it a probability model instead of just a drawing machine.`,
      ],
    },
    {
      heading: 'Why Coupling Works',
      paragraphs: [
        `A generic dense neural network has a dense Jacobian, and computing a determinant of a large dense matrix is expensive. Coupling layers avoid that by forcing structure. Because part of the vector is copied through and the other part is transformed using scale and shift functions conditioned on the copied part, the Jacobian becomes triangular. Triangular determinants are cheap. The neural network inside the coupling layer can be expressive, but the surrounding structure keeps the probability math tractable.`,
        `One coupling layer is limited because it leaves some dimensions unchanged. The standard fix is stacking. Alternate which dimensions are copied and which are transformed. Insert permutations, invertible convolutions, or other structured invertible layers between coupling layers. Over many layers, every dimension can influence every other dimension while each local determinant remains manageable. This is the normal flow bargain: many simple reversible layers can imitate complex density shapes while preserving exact accounting.`,
      ],
    },
    {
      heading: 'What The Animation Teaches',
      paragraphs: [
        `The first view shows the base cloud before and after transformation. The points are not being randomly replaced. They are being moved by an invertible map. That is why the invariant says probability mass cannot vanish. A region can stretch or compress, but mass is conserved. The change-of-variables table then names the accounting terms: recover z, evaluate the base log density, add the log determinant correction, and obtain log p(x).`,
        `The coupling-layer view shows the engineering trick behind many useful flows. Copy part of the vector, use that part to transform the rest, and keep the Jacobian triangular. The table comparing flows, VAEs, GANs, and diffusion models should be read as a tradeoff map. Flows win exact likelihood, but they pay with invertible architecture. Diffusion models often win sample quality, but sampling is iterative. GANs can sample quickly, but likelihood is not directly available. The right model depends on the job.`,
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        `The main cost of a flow is architectural constraint. You cannot freely drop in arbitrary attention blocks, pooling layers, dimension-changing projections, or stochastic operations unless the design preserves invertibility and tractable determinants. Expressiveness often requires many layers, careful masking, invertible convolutions, or specialized continuous-time machinery. This makes flows elegant but sometimes awkward compared with models that can use any differentiable network as a generator or score model.`,
        `There are also directionality tradeoffs. Some flow designs make sampling fast and likelihood evaluation slower. Others make density evaluation fast and sampling slower. Autoregressive flows, coupling flows, continuous normalizing flows, neural spline flows, and invertible residual networks choose different points in this space. Continuous flows may need ODE solvers and trace estimates. Coupling flows may need depth to become expressive. Exact likelihood is valuable, but it is never free.`,
      ],
    },
    {
      heading: 'Where They Win And Fail',
      paragraphs: [
        `Flows are useful for density estimation, anomaly detection experiments, simulation, Bayesian posterior modeling, variational inference, audio and image modeling, scientific inverse problems, and cases where sampling and likelihood both matter. They are especially valuable when the question is "how probable is this observation under the learned distribution?" rather than only "can the model produce a plausible sample?" They also make strong components inside larger systems, such as richer approximate posteriors for VAE-style models.`,
        `Flows are weaker when the data distribution requires extreme semantic abstraction and the architecture cannot express it efficiently. In images, diffusion models and autoregressive models have often produced stronger sample quality at scale. For anomaly detection, likelihood can be misleading because models may assign high likelihood to simple background statistics rather than semantic normality. A flow can be mathematically exact and still operationally wrong for the task metric. Exact density is a tool, not a guarantee of useful judgment.`,
      ],
    },
    {
      heading: 'Pitfalls And Misconceptions',
      paragraphs: [
        `The first misconception is that invertible means unlimited. Invertibility is a constraint. If the model must preserve dimensionality and compute determinants cheaply, it cannot use every architecture that works in ordinary deep learning. The second misconception is that exact likelihood means better samples. Likelihood measures probability under the model, not human perceptual quality. A model can score density well and still produce samples that look worse than a diffusion model.`,
        `The third trap is anomaly detection overconfidence. Low likelihood can flag unusual inputs, but high likelihood does not always mean semantically normal. Background texture, local statistics, and preprocessing can dominate density. Another pitfall is forgetting numerical stability. Scale terms in coupling layers, log determinants, and inverse computations can blow up or collapse if parameterized carelessly. The beautiful theory still needs careful implementation.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Primary sources: Variational Inference with Normalizing Flows at https://arxiv.org/abs/1505.05770 and the PMLR page at https://proceedings.mlr.press/v37/rezende15.html, plus Real NVP at https://arxiv.org/abs/1605.08803. Work through the one-dimensional change-of-variables equation first, then a two-dimensional coupling layer. If you can compute the inverse and log determinant by hand on a toy example, the architecture choices become much less mysterious.`,
        `Study Probability Density, Change of Variables, Jacobian Matrices, Determinants, Variational Autoencoders, Generative Adversarial Networks, Diffusion Models, Autoregressive Models, Matrix Operations, and Bayesian Inference next. Normalizing flows sit at the place where calculus, probability, and neural-network architecture meet. The study goal is to see why exact likelihood requires both mathematical reversibility and hardware-conscious design.`,
      ],
    },
  ],
};
