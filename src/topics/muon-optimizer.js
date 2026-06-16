// Muon optimizer: momentum plus matrix orthogonalization for hidden-layer
// weight updates, usually approximated with Newton-Schulz iterations.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'muon-optimizer',
  title: 'Muon Optimizer',
  category: 'AI & ML',
  summary: 'A modern optimizer idea for hidden layers: orthogonalize momentum-like matrix updates with GPU-friendly Newton-Schulz iterations.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['orthogonalized momentum', 'Newton-Schulz tradeoffs'], defaultValue: 'orthogonalized momentum' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function* orthogonalizedMomentum() {
  yield {
    state: graphState({
      nodes: [
        { id: 'grad', label: 'grad', x: 0.9, y: 3.2, note: 'matrix' },
        { id: 'mom', label: 'mom', x: 2.8, y: 3.2, note: 'EMA' },
        { id: 'ortho', label: 'ortho', x: 4.9, y: 3.2, note: 'NS' },
        { id: 'update', label: 'step', x: 7.0, y: 3.2, note: 'balanced' },
        { id: 'weight', label: 'W', x: 8.9, y: 3.2, note: 'apply' },
      ],
      edges: [
        { id: 'e-grad-mom', from: 'grad', to: 'mom', weight: '' },
        { id: 'e-mom-ortho', from: 'mom', to: 'ortho', weight: '' },
        { id: 'e-ortho-update', from: 'ortho', to: 'update', weight: '' },
        { id: 'e-update-weight', from: 'update', to: 'weight', weight: '' },
      ],
    }, { title: 'Muon update path for matrix-shaped hidden weights' }),
    highlight: { active: ['mom', 'ortho'], found: ['update'] },
    explanation: 'Muon treats many hidden-layer parameters as matrices. It builds a momentum-like update, then approximately orthogonalizes that matrix before applying it. The intended effect is a balanced update across directions.',
  };

  yield {
    state: labelMatrix(
      'What changes from common optimizers',
      [
        { id: 'SGD', label: 'SGD' },
        { id: 'Adam', label: 'Adam' },
        { id: 'Lion', label: 'Lion' },
        { id: 'Muon', label: 'Muon' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'geometry', label: 'geometry' },
      ],
      [
        ['velocity', 'raw direction'],
        ['m and v', 'coordinate scale'],
        ['m only', 'sign direction'],
        ['momentum', 'matrix ortho'],
      ],
    ),
    highlight: { active: ['Muon:geometry'], compare: ['Adam:geometry', 'Lion:geometry'] },
    explanation: 'Muon is not Adam with a new coefficient. It changes the geometry of matrix updates by pushing them toward an orthogonalized direction.',
    invariant: 'The optimizer is choosing a geometry for parameter motion.',
  };

  yield {
    state: labelMatrix(
      'Where Muon is usually applied',
      [
        { id: 'hidden', label: 'hidden matrices' },
        { id: 'emb', label: 'embeddings' },
        { id: 'head', label: 'output head' },
        { id: 'bias', label: 'bias/norm' },
      ],
      [
        { id: 'choice', label: 'choice' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['Muon', 'matrix structure'],
        ['AdamW', 'sparse/special'],
        ['AdamW', 'logit-sensitive'],
        ['AdamW or SGD', 'not matrix'],
      ],
    ),
    highlight: { found: ['hidden:choice'], compare: ['emb:choice', 'head:choice'] },
    explanation: 'Practical Muon recipes often use it only for hidden-layer matrix weights and keep AdamW-style updates for embeddings, heads, biases, and normalization parameters.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'training step', min: 0, max: 100 }, y: { label: 'loss, lower is better', min: 0.3, max: 1.2 } },
      series: [
        { id: 'adam', label: 'AdamW recipe', points: [{ x: 0, y: 1.1 }, { x: 20, y: 0.82 }, { x: 40, y: 0.64 }, { x: 70, y: 0.50 }, { x: 100, y: 0.43 }] },
        { id: 'muon', label: 'Muon-style recipe', points: [{ x: 0, y: 1.1 }, { x: 20, y: 0.75 }, { x: 40, y: 0.56 }, { x: 70, y: 0.45 }, { x: 100, y: 0.39 }] },
      ],
    }),
    highlight: { active: ['muon'], compare: ['adam'] },
    explanation: 'The toy curve shows the claim shape: faster progress under a tuned recipe. Real Muon results are recipe- and scale-sensitive, so the correct comparison is controlled training budget plus final quality.',
  };
}

function* newtonSchulzTradeoffs() {
  yield {
    state: labelMatrix(
      'Newton-Schulz approximation',
      [
        { id: 'input', label: 'input' },
        { id: 'scale', label: 'scale' },
        { id: 'iterate', label: 'iterate' },
        { id: 'output', label: 'output' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'purpose', label: 'purpose' },
      ],
      [
        ['momentum matrix', 'update candidate'],
        ['normalize', 'stable range'],
        ['few matmuls', 'approx sign/ortho'],
        ['balanced matrix', 'apply update'],
      ],
    ),
    highlight: { active: ['iterate:operation'], found: ['output:purpose'] },
    explanation: 'Muon became practical because Newton-Schulz-style iterations approximate the orthogonalized matrix using GPU-friendly matrix multiplications instead of exact SVD.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'Newton-Schulz iterations', min: 0, max: 8 }, y: { label: 'orthogonalization error', min: 0, max: 1.0 } },
      series: [
        { id: 'err', label: 'approx error', points: [
          { x: 0, y: 0.95 }, { x: 1, y: 0.62 }, { x: 2, y: 0.38 }, { x: 3, y: 0.22 }, { x: 5, y: 0.10 }, { x: 8, y: 0.06 },
        ] },
      ],
    }),
    highlight: { active: ['err'] },
    explanation: 'More iterations improve the approximation but cost more matmuls. Many recipes use a small fixed count because training speed matters more than exact orthogonalization.',
    invariant: 'Approximate enough can beat exact but expensive.',
  };

  yield {
    state: labelMatrix(
      'Tradeoff audit',
      [
        { id: 'shape', label: 'shape' },
        { id: 'scale', label: 'scale' },
        { id: 'params', label: 'params' },
        { id: 'dist', label: 'distributed' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'control', label: 'control' },
      ],
      [
        ['skinny matrices', 'shape tests'],
        ['NS instability', 'normalization'],
        ['wrong tensors', 'param groups'],
        ['extra matmuls', 'profile GPUs'],
      ],
    ),
    highlight: { found: ['shape:control', 'scale:control', 'params:control', 'dist:control'] },
    explanation: 'Muon has sharp engineering edges: matrix shape, normalization, parameter grouping, and GPU profiling all matter. That is why follow-up work studies robustness and hardware-aware Newton-Schulz variants.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'recipe', label: 'training recipe', x: 0.8, y: 3.8, note: 'baseline' },
        { id: 'groups', label: 'param groups', x: 2.8, y: 3.8, note: 'Muon/Adam' },
        { id: 'profile', label: 'profile', x: 4.8, y: 2.5, note: 'matmul cost' },
        { id: 'seeds', label: 'seed sweep', x: 4.8, y: 5.1, note: 'variance' },
        { id: 'claim', label: 'optimizer claim', x: 7.2, y: 3.8, note: 'defensible' },
      ],
      edges: [
        { id: 'e-recipe-groups', from: 'recipe', to: 'groups', weight: '' },
        { id: 'e-groups-profile', from: 'groups', to: 'profile', weight: '' },
        { id: 'e-groups-seeds', from: 'groups', to: 'seeds', weight: '' },
        { id: 'e-profile-claim', from: 'profile', to: 'claim', weight: '' },
        { id: 'e-seeds-claim', from: 'seeds', to: 'claim', weight: '' },
      ],
    }, { title: 'A fair Muon comparison is recipe-level' }),
    highlight: { active: ['groups', 'profile', 'seeds'], found: ['claim'] },
    explanation: 'Muon should be taught as an optimizer and as a benchmarking lesson. Compare end-to-end training cost, not only loss curves, and separate optimizer gains from retuning gains.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'orthogonalized momentum') yield* orthogonalizedMomentum();
  else if (view === 'Newton-Schulz tradeoffs') yield* newtonSchulzTradeoffs();
  else throw new InputError('Pick a Muon optimizer view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Muon is a modern optimizer idea for neural-network hidden layers. Its popular form maintains momentum for matrix-shaped weight gradients, then approximately orthogonalizes that momentum before applying the update. Instead of treating every parameter coordinate independently, Muon treats a hidden-layer weight matrix as a matrix and changes the geometry of the update.',
        'The public Muon writeup by Keller Jordan describes it as an optimizer for hidden layers and emphasizes training-speed records. Follow-up papers study why orthogonalized updates can work, when Muon changes simplicity bias, and how Newton-Schulz approximations behave across matrix shapes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a matrix weight, compute a gradient, update a momentum buffer, and run a few Newton-Schulz-style iterations to approximate an orthogonalized matrix update. The point of Newton-Schulz is hardware practicality: it uses matrix multiplications that GPUs like, avoiding an exact SVD in the training loop. Many recipes apply Muon to hidden matrix weights while keeping AdamW for embeddings, output heads, biases, and normalization parameters.',
        'The intuition is that orthogonalized matrix updates can avoid over-concentrating movement in a few directions. This is a geometry choice, just as Adam chooses coordinate-wise adaptive scaling and Lion chooses sign-momentum direction.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Muon adds matrix multiplications for Newton-Schulz iterations. That cost may be acceptable for hidden matrices on modern accelerators, but it must be profiled. The optimizer also adds recipe complexity: parameter grouping, matrix reshaping, learning-rate schedules, precision, distributed training, and fallback optimizer choices. Exact SVD-style orthogonalization would be too expensive; approximate orthogonalization is the practical compromise.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Muon is relevant to large-batch training experiments, transformer training recipes, speedrunning benchmarks, and optimizer research. It is a strong teaching case because it connects linear algebra, GPU kernels, optimizer state, and benchmark variance. It should be compared against AdamW, Lion, SGD with momentum, and tuned schedules under equal compute budgets.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not apply Muon blindly to every tensor. Embeddings, heads, biases, and normalization parameters often need different treatment. Do not compare a carefully tuned Muon recipe to an untuned AdamW baseline. Also, approximate orthogonalization can be sensitive to matrix shape and scaling. The right question is not whether Muon is fashionable; it is whether the full recipe improves quality per unit compute in your workload.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Keller Jordan Muon writeup at https://kellerjordan.github.io/posts/muon/, Low-rank orthogonalization for large-scale matrix optimization at https://arxiv.org/html/2509.11983v1, and To Use or not to Use Muon at https://arxiv.org/html/2603.00742v1. Study Lion Optimizer, Adam Optimizer, SVD & Low-Rank Approximation, GPU All-Reduce, Batch Size Scaling, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
