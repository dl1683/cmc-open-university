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
    explanation: 'Read the matrix as a relocation of nonlinearity. A standard MLP keeps edges simple, just scalar weights, then bends the signal at the node with a fixed activation. A KAN moves the bending onto the edges: each connection can learn its own one-dimensional curve, while the node mostly sums. That is the whole architectural bet.',
  };

  yield {
    state: kanGraph('A KAN layer is a fully connected graph of edge functions'),
    highlight: { active: ['phi-11', 'phi-12', 'phi-21', 'phi-22'], found: ['h1', 'h2'] },
    explanation: 'Follow one input across the highlighted edges. Instead of multiplying x1 by one learned number, each phi edge passes x1 through a learned function, often a spline. The sum nodes collect those transformed values. The graph still looks like a fully connected layer, but the learned object on every edge is now a curve.',
    invariant: 'KAN parameters live inside edge functions rather than scalar edge weights.',
  };

  yield {
    state: splinePlot('One scalar weight becomes one learnable curve'),
    highlight: { active: ['phi'], compare: ['linear'], found: ['knot1', 'knot2'] },
    explanation: 'This plot is the most important contrast. The straight line is what a scalar weight can do: stretch, shrink, or flip. The spline can bend locally; the knots are handles that let different input ranges move differently. That extra shape is why KANs are interesting for smooth scientific functions and also why each edge is more expensive than a number.',
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
    explanation: 'The scorecard is deliberately mixed. KANs can fit useful local shape and expose edge curves humans can inspect, but they pay with spline evaluation, pruning work, and less mature kernels. The right question is not whether KAN replaces MLPs; it is whether edge functions buy enough accuracy or insight on this workload.',
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
    explanation: 'Training is still backpropagation, but the parameters have moved. Each coefficient controls part of the edge curve, so an update can lower the left region, flatten a transition, or lift the tail. That is more expressive than one scalar weight, and it also gives you more ways to overfit or create hard-to-accelerate computation.',
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
    explanation: 'Read this curve as a claim shape, not a universal ranking. A smaller KAN may beat a larger MLP on smooth fitting tasks because each edge carries more local shape. The fair comparison is same data, same tuning effort, same compute budget, and a tuned MLP baseline. Otherwise the curve is architecture marketing.',
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
    explanation: 'This graph is the interpretability workflow people often skip. A plotted edge curve is only a clue. You inspect, prune weak edges, fit symbolic candidates such as sin or x^2, and then test the proposed law on held-out data and domain knowledge. KANs make inspection easier; they do not make scientific truth automatic.',
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
    explanation: 'Use this checklist before believing a KAN result. Is the task low-dimensional or massive? Was the MLP tuned? Are the spline kernels fast enough? Does the symbolic formula survive new data? KANs are a serious idea, but the engineering question is where edge functions justify their cost.',
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
      heading: 'Why KANs exist',
      paragraphs: [
        `Kolmogorov-Arnold Networks exist because a standard multilayer perceptron hides most of its learned structure inside large matrices. An MLP edge learns one scalar weight. A node then applies a fixed nonlinearity such as ReLU, GELU, or tanh. This design is fast and general, but the learned object is hard to inspect. If a scientist wants to know what relationship the model discovered between one input coordinate and one intermediate quantity, a dense weight matrix rarely gives a readable answer.`,
        `KANs move some of that structure into a more visible place. Instead of learning a scalar weight on each edge, a KAN learns a one-dimensional function on each edge. The receiving node mostly sums the transformed inputs. A connection is no longer just "multiply by 0.7." It is "evaluate this learned curve at the incoming value." That curve can be plotted, regularized, pruned, or sometimes approximated by a symbolic expression.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious approach is to use a larger MLP. If the model cannot fit a smooth function, add width, depth, better activations, more data, or stronger optimization. That is not naive. MLPs are universal approximators, they batch well, and modern hardware is built around dense matrix multiplication. For many workloads, a tuned MLP is the baseline a new architecture must beat.`,
        `The wall appears when the question is not only predictive accuracy. A large MLP can fit the data while giving little insight into the learned relationship. It may also need many units to approximate a function whose useful structure is locally one-dimensional or smooth along each coordinate. KANs ask whether putting learnable curves directly on edges can fit some functions with fewer hidden units or with a representation a human can inspect after training.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is a relocation of nonlinearity. In an MLP, the edge is simple and the node bends the signal with a fixed activation. In a KAN, the edge bends the signal with a learned univariate function, and the node performs a sum. The architecture still builds a multivariate function by composition, but the learned pieces are small curves rather than only scalar weights.`,
        `This design is inspired by the Kolmogorov-Arnold representation theorem, which says that certain multivariate continuous functions can be represented through sums and compositions of univariate functions. The theorem is not a production recipe and not a guarantee that a practical KAN will beat a practical MLP. Its value here is conceptual: if complex multivariate behavior can be assembled from one-dimensional functions, then learning those functions directly may be a useful architectural bias.`,
      ],
    },
    {
      heading: 'Mechanism and data structures',
      paragraphs: [
        `A KAN layer can be stored as a graph of edge functions. For an input dimension i and output unit j, the edge has a function phi_ij. In spline-based implementations, phi_ij is represented by basis functions, knot locations or grid points, and learned coefficients. The forward pass evaluates the relevant edge functions on the incoming scalar values, then sums the results at each receiving node.`,
        `Backpropagation still applies. The loss gradient flows through the sum into each edge function, then into that function's coefficients. A coefficient update changes the shape of a local region of the curve. This is the main practical difference from a scalar weight update. An MLP update changes a line's slope for one connection. A KAN update can raise one part of an edge curve, flatten another, or alter a transition near a knot.`,
        `The data layout matters. Dense MLP layers store weights in arrays shaped for matrix multiplication. KAN layers store many small function parameter sets. That can make plotting and pruning easier, but it can make kernels harder to optimize. The representation is more structured for a human and less automatically aligned with the fastest hardware path.`,
      ],
    },
    {
      heading: 'Why it works when it works',
      paragraphs: [
        `KANs work best when the target function has useful low-dimensional structure that the edge functions can capture. A smooth physical law, a tabular relationship with monotone or curved effects, or a low-dimensional regression problem may be well served by learnable univariate pieces. The model does not need to discover all nonlinearity through fixed node activations and combinations of many scalar-weighted features.`,
        `The correctness argument is not a proof that training will find the best representation. It is a representational argument plus an optimization claim that must be tested. The architecture can express rich functions by composing and summing learned univariate functions. Gradient descent can tune the coefficients. Regularization, pruning, and validation decide whether the learned curves generalize or merely interpolate the training data.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The cost is paid on every edge. A scalar weight multiply is cheap and fuses naturally into a matrix multiplication. A spline evaluation may require basis lookup, interpolation, coefficient reads, and extra memory traffic. If a layer is wide, the number of edge functions can grow quickly. A smaller KAN may still be slower than a larger MLP if the KAN uses hardware poorly.`,
        `There are also model-selection costs. The rank or width of an MLP is not the only capacity knob anymore. A KAN has spline degree, grid size, coefficient regularization, pruning thresholds, update rules for grids, and sometimes symbolic fitting choices. These knobs can be valuable, but they widen the tuning surface. A fair comparison must include tuning effort and wall-clock compute, not only parameter count.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `KANs are most plausible in scientific machine learning, symbolic regression support, differential equation surrogates, low-dimensional regression, and tabular problems where feature effects are smooth enough to inspect. In those settings, a plotted edge function can be a useful clue. It may reveal a threshold, saturation curve, periodic component, or approximate polynomial relationship that would be buried inside an MLP.`,
        `They can also serve as research instruments. A dense KAN can be trained, weak edges can be pruned, and remaining curves can be compared with candidate symbolic forms. The result is not a discovered law by itself. It is a structured hypothesis generator. Domain tests, held-out data, dimensional analysis, and ablations still decide whether the pattern is real.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `KANs are a poor default when hardware efficiency dominates and interpretability is not needed. Large language model feed-forward blocks, high-throughput inference systems, and massive batched training pipelines depend on dense kernels that are already highly optimized. Replacing scalar weights with many small curve evaluations can lose more in throughput than it gains in expressiveness.`,
        `They also fail when the curves are overread. A one-dimensional edge function is easier to plot than an MLP weight matrix, but easy plotting is not automatic truth. The curve may reflect correlated inputs, data leakage, insufficient regularization, or a local optimum. Symbolic fitting can turn noise into a neat formula if the validation discipline is weak.`,
      ],
    },
    {
      heading: 'Evaluation signals',
      paragraphs: [
        `Evaluate KANs against strong baselines. Compare with tuned MLPs, splines, gradient-boosted trees for tabular data, and domain-specific models when available. Match data splits, tuning budget, parameter budget, and wall-clock budget. A KAN that wins only against an under-tuned MLP has not proved an architectural advantage.`,
        `Inspect more than validation error. Measure inference latency, training time, memory traffic, seed stability, calibration, extrapolation behavior, and robustness to feature scaling. For interpretability claims, test whether pruned edges stay pruned across seeds and whether symbolic candidates predict fresh data outside the training range. If the explanation changes whenever the seed changes, it is not yet a reliable explanation. The useful question is not whether KANs are elegant; it is whether the edge functions buy accuracy, speed, or insight on the actual workload.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Neural Network Forward Pass and Activation Functions to understand the MLP baseline that KANs modify. Study Backpropagation to see why spline coefficients can be trained with the same gradient machinery. Study SVD & Low-Rank Approximation and Matrix Completion for another example of putting structure into the parameterization. Study Regularization and Early Stopping because KANs can overfit through flexible curves. For primary context, read the KAN paper and a concrete implementation such as pykan, then reproduce comparisons before accepting broad claims.`,
      ],
    },
  ],
};
