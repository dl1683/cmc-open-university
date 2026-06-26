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
  const inputNodes = 2;   // x1, x2
  const hiddenNodes = 2;  // h1, h2
  const edgeFunctions = 6; // 4 phi + 2 psi
  const knotCount = 2;    // knots shown in the plot

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
    explanation: `Read the matrix as a relocation of nonlinearity. A standard MLP keeps edges simple, just scalar weights, then bends the signal at the node with a fixed activation. A KAN moves the bending onto the ${edgeFunctions} edges: each connection can learn its own one-dimensional curve, while the node mostly sums. That is the whole architectural bet.`,
  };

  yield {
    state: kanGraph('A KAN layer is a fully connected graph of edge functions'),
    highlight: { active: ['phi-11', 'phi-12', 'phi-21', 'phi-22'], found: ['h1', 'h2'] },
    explanation: `Follow one input across the highlighted edges. Instead of multiplying x1 by one learned number, each of the ${edgeFunctions} phi/psi edges passes x1 through a learned function, often a spline. The ${hiddenNodes} sum nodes collect those transformed values. The graph still looks like a fully connected layer, but the learned object on every edge is now a curve.`,
    invariant: `KAN parameters live inside ${edgeFunctions} edge functions rather than scalar edge weights.`,
  };

  yield {
    state: splinePlot('One scalar weight becomes one learnable curve'),
    highlight: { active: ['phi'], compare: ['linear'], found: ['knot1', 'knot2'] },
    explanation: `This plot is the most important contrast. The straight line is what a scalar weight can do: stretch, shrink, or flip. The spline can bend locally; the ${knotCount} knots are handles that let different input ranges move differently. That extra shape is why KANs are interesting for smooth scientific functions and also why each edge is more expensive than a number.`,
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
    explanation: `The scorecard is deliberately mixed. KANs can fit useful local shape and expose ${edgeFunctions} edge curves humans can inspect, but they pay with spline evaluation, pruning work, and less mature kernels. The right question is not whether KAN replaces MLPs; it is whether ${inputNodes + hiddenNodes}-node edge functions buy enough accuracy or insight on this workload.`,
  };
}

function* trainingAndInterpretability() {
  const basisCount = 4;   // basis functions in the coefficient table
  const workflowSteps = 5; // dense, inspect, prune, symbolic, law
  const checkItems = 4;    // task type, baseline, kernels, science

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
    explanation: `Training is still backpropagation, but the parameters have moved. Each of the ${basisCount} coefficients controls part of the edge curve, so an update can lower the left region, flatten a transition, or lift the tail. That is more expressive than one scalar weight, and it also gives you ${basisCount} ways to overfit or create hard-to-accelerate computation.`,
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
    explanation: `Read this curve as a claim shape, not a universal ranking. A smaller KAN may beat a larger MLP on smooth fitting tasks because each edge carries more local shape. The fair comparison is same data, same tuning effort, same compute budget, and a tuned MLP baseline. Otherwise the curve over ${basisCount} basis coefficients per edge is architecture marketing.`,
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
    explanation: `This ${workflowSteps}-step graph is the interpretability workflow people often skip. A plotted edge curve is only a clue. You inspect, prune weak edges, fit symbolic candidates such as sin or x^2, and then test the proposed law on held-out data and domain knowledge. KANs make inspection easier across all ${workflowSteps} stages; they do not make scientific truth automatic.`,
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
    explanation: `Use this ${checkItems}-item checklist before believing a KAN result. Is the task low-dimensional or massive? Was the MLP tuned? Are the spline kernels fast enough? Does the symbolic formula survive new data? KANs are a serious idea, but across all ${checkItems} checks the engineering question is where edge functions justify their cost.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the MLP view and KAN view as a relocation of nonlinearity. In an MLP, edges hold scalar weights and nodes apply fixed activations; in a KAN, edges hold learnable one-dimensional functions and nodes mostly sum.',
        {
          type: 'callout',
          text: 'A KAN teaches each edge to be a small function, so interpretability starts at the connection rather than the node.',
        },
        'Active edges are the learned functions currently being evaluated, and compare marks the scalar-weight baseline. The safe inference rule is that a plotted edge curve is evidence about one learned connection, not automatic proof of a scientific law.',
        {type: 'image', src: './assets/gifs/kolmogorov-arnold-networks.gif', alt: 'Animated walkthrough of the kolmogorov arnold networks visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A standard multilayer perceptron, or MLP, learns scalar weights and uses fixed activation functions such as ReLU or GELU. That is fast and general, but the learned behavior is buried inside dense matrices.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg',
          alt: 'Layered neural network diagram with colored nodes and weighted connections',
          caption: 'A standard neural network hides learned behavior inside many scalar edge weights and node activations. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.',
        },
        'KANs exist for settings where the shape of a relationship matters, not only prediction accuracy. A scientist may want to see that one input behaves like a square, sine wave, threshold, or saturation curve.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to make the MLP wider or deeper. More hidden units can approximate more functions, and dense matrix multiplication is exactly what current accelerators run well.',
        'For interpretation, the obvious approach is post-hoc analysis such as feature importance, gradients, or SHAP values. These methods can say which inputs matter, but they often do not recover a clean functional form.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that scalar weights are blunt objects for smooth local shape. A curve that naturally bends differently in different input ranges may require many hidden units when each edge can only multiply by one number.',
        'Post-hoc explanations also have a ceiling. They may show that x1 matters, but not that the learned effect of x1 looks like sin(x1) or x1 squared over the range that matters.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Move the learnable nonlinear function onto each edge. Instead of y = w * x flowing across a connection, a KAN edge computes y = phi(x), where phi is a learned univariate function.',
        'This is inspired by the Kolmogorov-Arnold representation theorem, which says continuous multivariate functions can be represented using univariate functions and addition. KANs do not implement the theorem literally; they use it as an inductive bias.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A KAN layer contains a matrix of functions instead of a matrix of numbers. For each input coordinate i and output node j, the edge function phi_ij transforms the scalar input before the output node sums incoming values.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/B-spline_curve.svg/500px-B-spline_curve.svg.png',
          alt: 'B-spline curve controlled by local control points',
          caption: 'A B-spline curve shows the local-control idea behind many KAN edge functions: coefficients bend regions of the curve rather than the whole function at once. Source: Wikimedia Commons, File:B-spline curve.svg.',
        },
        'Most implementations parameterize phi with B-splines. A spline uses local basis functions and learned coefficients, so changing one coefficient bends one region of the curve more than distant regions.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Backpropagation still applies because spline evaluation is differentiable almost everywhere. The loss gradient flows into each edge function and updates the coefficients that shape that curve.',
        'KANs work best when the target function has low-dimensional smooth structure aligned with the inputs. In that case, one learned edge curve can replace many scalar-weighted hidden units.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'An MLP edge stores one scalar and costs one multiply-add. A KAN edge stores several spline coefficients and costs basis evaluation plus a weighted sum.',
        'For a layer with n_in inputs, n_out outputs, and G spline coefficients per edge, parameter count is roughly n_in * n_out * G instead of n_in * n_out. Fewer nodes can sometimes offset that, but per-parameter GPU efficiency is usually worse than dense MLP kernels.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'KANs are most natural in scientific machine learning, symbolic regression, low-dimensional tabular modeling, and smooth function fitting. The access pattern is small enough that inspecting curves is feasible and valuable.',
        'A practical workflow trains a dense KAN, plots edge functions, prunes weak edges, fits candidate symbolic forms, and tests those forms on held-out data. The model helps propose structure; the validation decides whether the structure is real.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'KANs are a poor fit when throughput dominates and interpretability is not needed. Large transformers, high-throughput vision models, and batched production inference depend on dense kernels that spline-heavy edges do not yet match.',
        'They also fail when curves are overread. A neat plotted edge can reflect correlation, noise, or a local optimum, so symbolic interpretation needs pruning, held-out tests, and domain checks.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the target is f(x1, x2) = x1^2 + sin(x2). An MLP can learn this, but it must assemble the square and sine behavior from many weighted activations.',
        'A small KAN can put a curve resembling x^2 on the edge from x1 and a curve resembling sin(x) on the edge from x2. The sum node then adds those transformed values directly.',
        'With x1 = 3 and x2 = 1.57, the target is 9 + 1 = 10. If the learned edge curves output 8.9 and 0.98, the KAN predicts 9.88 before later-layer corrections.',
        'The interpretability value is visible: the edge plots can suggest square and sine components. The correctness test is whether those components keep predicting well on held-out points, not whether the curves look familiar.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Liu et al., KAN: Kolmogorov-Arnold Networks, 2024, https://arxiv.org/abs/2404.19756. The paper introduces edge spline functions, grid extension, pruning, and symbolic-regression workflows.',
        'Study MLP forward passes and activation functions first, then backpropagation and B-splines. After that, study regularization, symbolic regression, and low-rank approximation as other ways to add structure to learned functions.',
      ],
    },
  ],
};
