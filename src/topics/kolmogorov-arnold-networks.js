// Kolmogorov-Arnold Networks: replace scalar weights with learnable
// one-dimensional functions placed on edges.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'kolmogorov-arnold-networks',
  title: 'Kolmogorov-Arnold Networks',
  category: 'AI & ML',
  summary: 'KANs replace fixed node activations and scalar weights with learnable spline functions on edges, making every connection a tiny curve.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['edge functions vs neurons', 'training and interpretability'], defaultValue: 'edge functions vs neurons' },
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

function kanGraph(title) {
  return graphState({
    nodes: [
      { id: 'x1', label: 'x1', x: 0.8, y: 2.5, note: 'input' },
      { id: 'x2', label: 'x2', x: 0.8, y: 5.0, note: 'input' },
      { id: 'h1', label: 'sum', x: 4.6, y: 2.4, note: 'after edge funcs' },
      { id: 'h2', label: 'sum', x: 4.6, y: 5.1, note: 'after edge funcs' },
      { id: 'y', label: 'y', x: 8.4, y: 3.8, note: 'output' },
    ],
    edges: [
      { id: 'phi-11', from: 'x1', to: 'h1', weight: 'phi11' },
      { id: 'phi-12', from: 'x1', to: 'h2', weight: 'phi12' },
      { id: 'phi-21', from: 'x2', to: 'h1', weight: 'phi21' },
      { id: 'phi-22', from: 'x2', to: 'h2', weight: 'phi22' },
      { id: 'psi-1', from: 'h1', to: 'y', weight: 'psi1' },
      { id: 'psi-2', from: 'h2', to: 'y', weight: 'psi2' },
    ],
  }, { title });
}

function splinePlot(title, activeId = 'phi') {
  return plotState({
    axes: { x: { label: 'input to edge', min: -2, max: 2 }, y: { label: 'edge output', min: -2, max: 2 } },
    series: [
      { id: 'linear', label: 'scalar weight', points: [
        { x: -2, y: -1.2 }, { x: -1, y: -0.6 }, { x: 0, y: 0 }, { x: 1, y: 0.6 }, { x: 2, y: 1.2 },
      ] },
      { id: activeId, label: 'learned edge spline', points: [
        { x: -2, y: 0.8 }, { x: -1.5, y: -0.2 }, { x: -1, y: -1.0 }, { x: -0.5, y: -0.8 },
        { x: 0, y: 0.0 }, { x: 0.5, y: 0.9 }, { x: 1, y: 1.1 }, { x: 1.5, y: 0.5 }, { x: 2, y: 1.4 },
      ] },
    ],
    markers: [
      { id: 'knot1', x: -1, y: -1.0, label: 'knot' },
      { id: 'knot2', x: 0.5, y: 0.9, label: 'knot' },
    ],
  }, { title });
}

function* edgeFunctionsVsNeurons() {
  yield {
    state: labelMatrix(
      'MLP vs KAN: where nonlinearity lives',
      [
        { id: 'mlp', label: 'MLP' },
        { id: 'kan', label: 'KAN' },
      ],
      [
        { id: 'edge', label: 'edge' },
        { id: 'node', label: 'node' },
        { id: 'shape', label: 'shape' },
      ],
      [
        ['w', 'act', 'W'],
        ['f', 'sum', 'curve'],
      ],
    ),
    highlight: { active: ['mlp:node', 'kan:edge'], compare: ['mlp:edge', 'kan:node'] },
    explanation: 'A standard MLP learns scalar weights and applies a fixed activation at each neuron. A KAN puts learnable univariate functions on edges and lets nodes mostly sum their incoming transformed values.',
  };

  yield {
    state: kanGraph('A KAN layer is a fully connected graph of edge functions'),
    highlight: { active: ['phi-11', 'phi-12', 'phi-21', 'phi-22'], found: ['h1', 'h2'] },
    explanation: 'Each edge is no longer one number. It is a small function, often represented by a spline. The receiving node sums the outputs of those edge functions.',
    invariant: 'KAN parameters live inside edge functions rather than scalar edge weights.',
  };

  yield {
    state: splinePlot('One scalar weight becomes one learnable curve'),
    highlight: { active: ['phi'], compare: ['linear'], found: ['knot1', 'knot2'] },
    explanation: 'A scalar weight can only stretch or flip an input. A spline edge can learn a local curve, with knots controlling different regions of the input domain.',
  };

  yield {
    state: labelMatrix(
      'What this buys and what it costs',
      [
        { id: 'accuracy', label: 'function fitting' },
        { id: 'interpret', label: 'interpretability' },
        { id: 'compute', label: 'compute' },
        { id: 'scale', label: 'large models' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['more local shape per edge', 'many spline evaluations'],
        ['edge curves can be inspected', 'human pruning required'],
        ['fewer nodes may suffice', 'kernels less mature'],
        ['interesting research path', 'not a drop-in transformer swap'],
      ],
    ),
    highlight: { found: ['accuracy:benefit', 'interpret:benefit'], compare: ['compute:cost', 'scale:cost'] },
    explanation: 'KANs are best understood as a tradeoff: richer, inspectable edge functions in exchange for more expensive and less mature layer mechanics.',
  };
}

function* trainingAndInterpretability() {
  yield {
    state: labelMatrix(
      'A spline edge is trained by moving coefficients',
      [
        { id: 'basis1', label: 'basis 1' },
        { id: 'basis2', label: 'basis 2' },
        { id: 'basis3', label: 'basis 3' },
        { id: 'basis4', label: 'basis 4' },
      ],
      [
        { id: 'region', label: 'region' },
        { id: 'coefficient', label: 'coefficient' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['left', '-0.7', 'pull curve down'],
        ['middle-left', '0.2', 'flatten transition'],
        ['middle-right', '1.1', 'raise peak'],
        ['right', '0.6', 'lift tail'],
      ],
    ),
    highlight: { active: ['basis1:coefficient', 'basis3:coefficient'], found: ['basis3:effect'] },
    explanation: 'Training a KAN edge adjusts the coefficients of basis functions. Backpropagation still supplies gradients, but the learned object is a curve instead of one scalar.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'epoch', min: 0, max: 6 }, y: { label: 'validation error', min: 0, max: 1 } },
      series: [
        { id: 'mlp', label: 'larger MLP', points: [
          { x: 0, y: 0.92 }, { x: 1, y: 0.61 }, { x: 2, y: 0.40 }, { x: 3, y: 0.28 }, { x: 4, y: 0.22 }, { x: 5, y: 0.20 }, { x: 6, y: 0.19 },
        ] },
        { id: 'kan', label: 'smaller KAN', points: [
          { x: 0, y: 0.88 }, { x: 1, y: 0.47 }, { x: 2, y: 0.26 }, { x: 3, y: 0.18 }, { x: 4, y: 0.15 }, { x: 5, y: 0.14 }, { x: 6, y: 0.14 },
        ] },
      ],
      markers: [
        { id: 'caution', x: 6, y: 0.14, label: 'task-dependent' },
      ],
    }),
    highlight: { active: ['kan'], compare: ['mlp'], found: ['caution'] },
    explanation: 'The KAN paper reports strong results on some fitting and scientific tasks, but the claim is empirical. The fair question is whether a smaller KAN beats a tuned MLP under the same budget.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'dense', label: 'dense KAN', x: 0.9, y: 3.8, note: 'many edge curves' },
        { id: 'inspect', label: 'inspect curves', x: 3.0, y: 2.4, note: 'find simple forms' },
        { id: 'prune', label: 'prune edges', x: 5.1, y: 3.8, note: 'remove weak links' },
        { id: 'symbolic', label: 'symbolic fit', x: 7.2, y: 2.4, note: 'sin, x^2, exp' },
        { id: 'law', label: 'candidate law', x: 9.0, y: 3.8, note: 'human checks' },
      ],
      edges: [
        { id: 'e-dense-inspect', from: 'dense', to: 'inspect', weight: '' },
        { id: 'e-inspect-prune', from: 'inspect', to: 'prune', weight: '' },
        { id: 'e-prune-symbolic', from: 'prune', to: 'symbolic', weight: '' },
        { id: 'e-symbolic-law', from: 'symbolic', to: 'law', weight: '' },
      ],
    }, { title: 'Interpretability is an iterative workflow' }),
    highlight: { active: ['inspect', 'prune', 'symbolic'], found: ['law'] },
    explanation: 'KAN interpretability is not automatic. The workflow is inspect curves, simplify or prune them, fit symbolic candidates, and then have a human validate the proposed law.',
  };

  yield {
    state: labelMatrix(
      'Read KAN claims with these checks',
      [
        { id: 'task', label: 'task type' },
        { id: 'baseline', label: 'baseline strength' },
        { id: 'kernels', label: 'implementation' },
        { id: 'science', label: 'scientific discovery' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['low-dimensional fitting or massive model?', 'KAN strengths may be task-specific'],
        ['tuned MLP and splines?', 'avoid false wins'],
        ['GPU-friendly enough?', 'spline ops can bottleneck'],
        ['does formula survive tests?', 'symbolic fit can overread noise'],
      ],
    ),
    highlight: { found: ['task:question', 'baseline:question', 'kernels:question', 'science:question'] },
    explanation: 'KANs are a valuable architecture idea and a useful contrast to MLPs. The engineering question is where edge functions justify their cost.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'edge functions vs neurons') yield* edgeFunctionsVsNeurons();
  else if (view === 'training and interpretability') yield* trainingAndInterpretability();
  else throw new InputError('Pick a KAN view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Kolmogorov-Arnold Networks are a neural-network architecture inspired by the Kolmogorov-Arnold representation theorem. The operational idea is easy to state: where an MLP learns scalar weights on edges and uses fixed activations at nodes, a KAN learns a univariate function on each edge. In many implementations, that edge function is parameterized as a spline. The node then sums the outputs of incoming edge functions.',
        'This changes the unit of learning. In an MLP, a connection says "multiply this input by one number." In a KAN, a connection says "pass this input through a learnable curve." That curve can be inspected, pruned, or sometimes matched to a symbolic expression. This is why KANs are interesting for scientific modeling and low-dimensional function discovery, not only for raw benchmark chasing.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A KAN layer can still be drawn as a fully connected graph, but every edge has a function phi_ij rather than a scalar weight w_ij. The input coordinate flows through phi_ij, and the target node sums all incoming transformed values. Stacking layers composes these learned one-dimensional functions. Backpropagation still trains the parameters, but the parameters live in spline coefficients or similar function bases.',
        'The contrast with Neural Network Forward Pass and Activation Functions is the core teaching point. MLPs interleave matrix multiplication with fixed nonlinearities such as ReLU or GELU. KANs move nonlinear expressiveness onto edges. That can make individual learned relationships easier to visualize, because each edge curve is one-dimensional. It can also make computation less friendly to the dense matrix kernels that make MLPs extremely fast.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'KANs trade matrix-friendly scalar weights for richer edge functions. A small KAN may fit certain smooth functions with fewer nodes than a larger MLP, but every edge may require spline evaluation, grid updates, regularization, and interpretation. GPU utilization, batching, and implementation maturity matter. An architecture that is elegant on paper can lose in production if its kernels are slow or hard to scale.',
        'The right comparison is not "KAN beats MLP" in the abstract. It is "under the same data, budget, tuning, and implementation quality, does this KAN solve this task better or reveal a useful structure?" Low-dimensional scientific regression, PDE fitting, and symbolic law discovery are different workloads from massive language-model feed-forward blocks.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'KANs are being explored for scientific machine learning, symbolic formula discovery, differential equations, tabular fitting, low-data regimes, and interpretable surrogate models. They connect to Loss Landscapes because their parameterization changes optimization behavior. They connect to Regularization because spline smoothness and pruning become part of the model design. They connect to Neural Architecture Search because KAN layers are another candidate building block whose value depends on task and hardware.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The Kolmogorov-Arnold theorem is not a free performance guarantee. It motivates a representation, but practical KANs still depend on finite width, finite data, optimization, regularization, and implementation. Interpretability is also not automatic. A plotted edge curve is easier to inspect than a dense weight matrix, but turning that curve into a trustworthy scientific law requires pruning, symbolic fitting, holdout tests, and domain review.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: KAN: Kolmogorov-Arnold Networks at https://arxiv.org/abs/2404.19756, the OpenReview page at https://openreview.net/forum?id=Ozo7qJ5vZi, and the pykan documentation at https://kindxiaoming.github.io/pykan/. The pykan repository is at https://github.com/KindXiaoming/pykan. Study Neural Network Forward Pass, Activation Functions, Backpropagation, Regularization, Loss Landscapes, Neural Architecture Search, and Gradient Descent next.',
      ],
    },
  ],
};
