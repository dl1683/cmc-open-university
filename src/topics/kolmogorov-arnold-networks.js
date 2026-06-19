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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Edge functions vs neurons" shows the architectural difference between MLPs and KANs: where nonlinearity lives, what the graph looks like, and how one scalar weight becomes a learnable curve. "Training and interpretability" shows how spline coefficients are trained, how KANs compare to MLPs on smooth fitting tasks, and the interpretability workflow from dense network to candidate law.',
        'Active highlights mark the current decision point -- the edge function being evaluated or the coefficient being updated. Found markers show quantities that are now determined: a sum node that has collected its inputs, or a symbolic form that survived pruning. Compare markers contrast the MLP baseline against the KAN approach so you can see exactly what moved.',
        'At each frame, ask: what changed, what is the learned object on this edge, and would a scalar weight have captured the same shape?',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A standard multilayer perceptron learns one scalar weight per connection. The node applies a fixed nonlinearity -- ReLU, GELU, tanh -- and the learned structure disappears into a dense weight matrix. This design is fast, general, and supported by decades of optimized kernels. It is also opaque. If a physicist trains an MLP to predict drag force from airfoil geometry, the weight matrix rarely reveals which input feature matters through which functional relationship. The model predicts; it does not explain.',
        'Kolmogorov-Arnold Networks (KANs) relocate the nonlinearity from nodes to edges. Each connection learns its own one-dimensional function -- typically a B-spline -- instead of a single number. The receiving node sums the transformed inputs. A connection is no longer "multiply by 0.7." It is "evaluate this learned curve at the incoming value." That curve can be plotted, regularized, pruned, and sometimes matched to a symbolic expression like sin(x) or x^2.',
        'The motivation is not raw accuracy on large-scale benchmarks. It is interpretability and parameter efficiency on problems where the target function has smooth, low-dimensional structure that edge functions can capture directly.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is a larger MLP. If the model underfits, add width, depth, better activations, more data, or stronger optimization. MLPs are universal approximators. They batch efficiently. Modern GPUs are built around dense matrix multiplication, and the software ecosystem -- cuBLAS, cuDNN, compiler fusion -- makes MLP layers nearly free to accelerate. For most production workloads, a tuned MLP is the baseline any new architecture must beat.',
        'For interpretability, the standard toolkit is post-hoc: SHAP values, integrated gradients, attention maps, probing classifiers. These methods explain an existing model without changing its architecture. They work, within limits, and they do not require giving up the speed advantages of dense layers.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall has two faces. First, MLPs approximate smooth univariate relationships by combining many scalar-weighted features through fixed activations. A function that is naturally "a curve of x1 plus a different curve of x2" must be reconstructed from many ReLU kinks spread across hidden units. The approximation works, but it can require far more parameters than the underlying structure demands.',
        'Second, post-hoc interpretability methods tell you which features matter and roughly how much, but they rarely recover the functional form. SHAP says "x1 matters more than x2." It does not say "the effect of x1 is roughly sin(x1)." For scientific machine learning -- where the goal is not just prediction but discovery of governing equations -- knowing the shape of each input-output relationship is the entire point. That is what MLPs hide and KANs expose.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A KAN layer replaces the weight matrix W with a matrix of univariate functions. For input dimension i and output unit j, the edge carries a learnable function phi_ij. The forward pass evaluates every phi_ij on the corresponding input scalar, then sums the results at each output node. A two-layer KAN composes two such layers: the first layer learns inner functions phi, the second learns outer functions psi, and the output is a sum of compositions.',
        {
          type: 'diagram',
          label: 'MLP vs KAN: where the learned object lives',
          text: 'MLP:   x --[w * x]--> node --[ReLU]--> output\n            ^                  ^\n        scalar weight     fixed activation\n\nKAN:   x --[phi(x)]--> node --[sum]--> output\n            ^\n    learned spline (the activation IS the edge)',
        },
        'In the default implementation, each phi is a B-spline defined by a grid of knot points and a vector of learned coefficients. The spline is a weighted sum of basis functions, each of which is nonzero only over a local interval. This locality means a coefficient update changes the curve shape in one region without disturbing distant parts -- finer control than a single scalar weight provides.',
        {
          type: 'code',
          language: 'python',
          text: '# B-spline basis activation (simplified)\nimport torch\n\ndef b_spline_basis(x, grid, degree=3):\n    """Evaluate B-spline basis functions at x.\n    grid: tensor of knot positions, shape (num_knots,)\n    Returns: basis values, shape (*x.shape, num_basis)\n    """\n    x = x.unsqueeze(-1)          # (..., 1)\n    g = grid.unsqueeze(0)         # (1, num_knots)\n    # degree-0 bases: indicator functions between knots\n    bases = ((x >= g[:, :-1]) & (x < g[:, 1:])).float()\n    # Cox-de Boor recursion for higher degrees\n    for d in range(1, degree + 1):\n        left  = (x - g[:, :-(d+1)]) / (g[:, d:-1] - g[:, :-(d+1)] + 1e-8)\n        right = (g[:, d+1:] - x)    / (g[:, d+1:] - g[:, 1:-d]    + 1e-8)\n        bases = left * bases[:, :-1] + right * bases[:, 1:]\n    return bases  # shape: (*x.shape, num_coefficients)\n\n# Edge activation: dot product of basis values and learned coefficients\n# phi(x) = sum_k  c_k * B_k(x)\ncoeffs = torch.randn(num_basis)   # learned parameters\nphi_x  = (b_spline_basis(x, grid) * coeffs).sum(-1)',
        },
        'Backpropagation works unchanged. The loss gradient flows through the sum node into each edge function, then into that function\'s coefficients. A gradient step on coefficient c_k changes the curve only in the region where basis function B_k is nonzero. This is more expressive than updating a scalar weight, and also more expensive: every edge requires a basis evaluation, coefficient lookup, and weighted sum instead of a single multiply.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The theoretical foundation is the Kolmogorov-Arnold representation theorem (1957). It states that any continuous function of n variables on a bounded domain can be written as a finite composition of continuous functions of one variable and addition. Formally: f(x1, ..., xn) = sum over q of Phi_q( sum over p of phi_{q,p}(x_p) ). The inner functions phi and outer functions Phi are all univariate.',
        'The theorem is an existence result, not a constructive algorithm. The original univariate functions can be highly irregular -- nowhere-differentiable, fractal-like. KANs do not implement the theorem literally. They use the theorem as architectural inspiration: if multivariate functions decompose into univariate pieces in principle, then parameterizing each edge as a learnable univariate function is a reasonable inductive bias. The practical question is whether smooth, trainable splines can approximate the useful univariate components for a given task.',
        'KANs work well when the answer is yes -- when the target function has low-dimensional structure aligned with the input coordinates. A physical law like F = G * m1 * m2 / r^2 decomposes cleanly into univariate factors. A function that depends on complex interactions between many coordinates may not decompose so neatly, and a KAN offers no advantage over an MLP.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost difference between MLPs and KANs is paid on every edge, every forward pass.',
        {
          type: 'table',
          headers: ['Property', 'MLP', 'KAN'],
          rows: [
            ['Edge learned object', 'Scalar weight (1 param)', 'Spline coefficients (G+k params per edge)'],
            ['Node operation', 'Fixed activation (ReLU, GELU)', 'Sum (identity)'],
            ['Forward cost per edge', 'One multiply-add', 'Basis eval + weighted sum over G coefficients'],
            ['Kernel maturity', 'Decades of cuBLAS/cuDNN optimization', 'Early-stage; custom CUDA needed'],
            ['Interpretability', 'Post-hoc (SHAP, gradients)', 'Direct: plot edge curves, prune, fit symbols'],
            ['Scaling to large models', 'Proven (GPT, ViT, etc.)', 'Open research question'],
            ['Tuning surface', 'Width, depth, learning rate, activation', 'Width, depth, LR, spline degree, grid size, grid update, pruning threshold, symbolic fit'],
          ],
        },
        'A KAN with G grid intervals per edge and spline degree k stores (G + k) coefficients per edge instead of 1. For a layer connecting n_in inputs to n_out outputs, that is n_in * n_out * (G + k) parameters versus n_in * n_out for an MLP. The parameter count per layer grows linearly with grid resolution. More importantly, the forward pass replaces one fused multiply-add with a basis evaluation loop, which is harder to vectorize on current GPU architectures.',
        'A smaller KAN can match a larger MLP on smooth fitting tasks because each edge carries more local shape. But "fewer parameters" does not mean "faster." Wall-clock time depends on kernel efficiency, memory access patterns, and batch size. As of 2024-2025, KAN inference is significantly slower per parameter than MLP inference on GPU hardware.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'KANs are strongest in scientific machine learning, symbolic regression, and low-dimensional function fitting where interpretability matters as much as accuracy.',
        {
          type: 'bullets',
          items: [
            'Physics-informed regression: fitting drag coefficients, material stress curves, or thermodynamic potentials where the scientist needs the functional form, not just predictions.',
            'Symbolic discovery: train a dense KAN, prune weak edges, inspect surviving curves, fit symbolic candidates (sin, exp, x^2), and test the proposed formula on held-out data. KANs make the first step -- inspection -- trivial.',
            'Differential equation surrogates: replacing expensive PDE solvers with learned approximations where each input-output channel has interpretable physics.',
            'Tabular data with smooth features: small datasets where feature effects are monotone or smoothly curved, and the analyst wants to see each effect plotted.',
          ],
        },
        'In each case, the advantage is not raw speed. It is that the learned object -- a one-dimensional curve on each edge -- is human-readable. A plotted edge function can reveal a threshold, a saturation, a periodic component, or an approximate power law that would be buried inside an MLP weight matrix.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'KANs are a poor choice when hardware efficiency dominates and interpretability is not needed. Large language model feed-forward blocks, vision transformer patches, high-throughput inference systems, and massive batched training pipelines depend on dense kernels that are already highly optimized. Replacing scalar weights with per-edge spline evaluations loses more in throughput than it gains in expressiveness at that scale.',
        'They also fail when the curves are overread. A plotted edge function is easier to inspect than a weight matrix, but easy inspection is not automatic truth. The curve may reflect correlated inputs, insufficient regularization, a local optimum, or training noise. Symbolic fitting can turn noise into a neat formula if the validation discipline is weak. The interpretability workflow -- inspect, prune, fit, test on held-out data -- is necessary. Skipping the last step produces plausible nonsense.',
        {
          type: 'note',
          text: 'KANs do not scale to transformer-class models as of 2025. The architecture is a research tool for low-dimensional scientific problems, not a drop-in replacement for MLPs in large models.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: Liu et al., "KAN: Kolmogorov-Arnold Networks" (arXiv 2404.19756, 2024). Introduces the architecture, spline parameterization, grid extension, and symbolic regression workflow.',
            'Theorem background: Kolmogorov, "On the representation of continuous functions of many variables by superposition of continuous functions of one variable and addition" (1957). The existence result that inspired the architecture.',
            'Implementation: pykan (github.com/KindXiaoming/pykan). Reference codebase with spline layers, pruning, symbolic fitting, and visualization.',
          ],
        },
        'Study Neural Network Forward Pass and Activation Functions to understand the MLP baseline that KANs modify. Study Backpropagation to see how gradient descent trains spline coefficients with the same chain rule. Study Regularization to understand why flexible edge functions can overfit and how L1 penalties on coefficients enable pruning. For a contrasting approach to structured parameterization, study SVD and Low-Rank Approximation -- another way to put mathematical structure into a weight matrix for efficiency and interpretability.',
      ],
    },
  ],
};

