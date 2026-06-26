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
  const pipelineSteps = 5;
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
    explanation: `Read the ${pipelineSteps}-stage graph as a change in the unit of optimization. Adam treats parameters coordinate by coordinate; Muon treats many hidden-layer weights as matrices. It builds a momentum-like matrix update, approximately orthogonalizes it, then applies a step meant to spread motion across directions instead of letting one direction dominate.`,
  };

  const optimizerCount = 4;
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
    explanation: `The comparison table is the mental map across ${optimizerCount} optimizers. SGD follows raw velocity, Adam rescales coordinates, Lion keeps sign direction, and Muon changes the matrix geometry. It is not Adam with a new beta; it is a different preconditioning choice for matrix-shaped weights.`,
    invariant: `Each of the ${optimizerCount} optimizers is choosing a geometry for parameter motion.`,
  };

  const paramGroupCount = 4;
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
    explanation: `This table prevents the common misuse across ${paramGroupCount} parameter groups. Muon is usually aimed at hidden matrix weights where orthogonalized updates make sense. Embeddings, output heads, biases, and normalization parameters often stay on AdamW or simpler updates because their structure and failure modes are different.`,
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
    explanation: `The curve compares ${optimizerCount} optimizer families and shows the kind of win Muon claims: faster loss reduction under a tuned recipe. The correct read is not "Muon always wins." Ask whether AdamW was equally tuned, whether extra matrix multiplications changed wall-clock cost, and whether final validation quality improved, not just early training loss.`,
  };
}

function* newtonSchulzTradeoffs() {
  const nsStepCount = 4;
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
    explanation: `Newton-Schulz is the hardware trick. The ${nsStepCount}-step pipeline shows the flow: exact SVD-style orthogonalization would be too slow in a training loop, but a few matrix multiplications can approximate the desired matrix sign or orthogonalized direction. Muon exists because the approximation matches what GPUs are good at.`,
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
    explanation: `This error curve is the tradeoff in one line: more Newton-Schulz iterations reduce approximation error, but each one costs more matrix multiplication. In training across all ${nsStepCount} pipeline stages, exactness is not the goal. The useful point is the cheapest approximation that improves quality per unit time.`,
    invariant: `Approximate enough can beat exact but expensive — ${nsStepCount} stages are practical, more may not be.`,
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
    explanation: `Muon has ${nsStepCount} real engineering edges to audit. Skinny matrices, bad scaling, wrong parameter groups, or distributed matmul overhead can erase the optimizer gain. The control column is the deployment checklist: shape tests, normalization, explicit parameter groups, and GPU profiling.`,
  };

  const protocolNodeCount = 5;
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
    explanation: `The final ${protocolNodeCount}-node graph is the fair-comparison protocol. Start from a strong baseline recipe, define parameter groups, profile the added matmuls, run seed sweeps, then make the optimizer claim. Otherwise you may be measuring retuning effort or hardware overhead, not Muon.`,
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
    { heading: 'How to read the animation', paragraphs: [
      'The first view follows one matrix-shaped weight update. A gradient is accumulated into momentum, the momentum matrix is pushed toward an orthogonalized direction, and the result is applied to the weight. The Newton-Schulz view shows the approximation tradeoff: more iterations reduce error but each iteration costs matrix multiplications.',
      {type: 'image', src: './assets/gifs/muon-optimizer.gif', alt: 'Animated walkthrough of the muon optimizer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ]},
    { heading: 'Why this exists', paragraphs: [
      'An optimizer is the rule that turns gradients into parameter updates during training. Common optimizers such as SGD and AdamW mostly treat a weight tensor as coordinates: each scalar receives a step based on its gradient history. Muon exists because many hidden-layer weights are matrices, meaning they map input directions to output directions.',
      {type: 'callout', text: 'Muon treats a hidden weight update as a matrix object, then spends cheap matmuls to balance its singular directions before stepping.'},
    ]},
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is to use AdamW everywhere. AdamW keeps moving averages of gradients and squared gradients, rescales each coordinate, and adds decoupled weight decay. That recipe is reliable, so replacing it only makes sense when matrix update geometry matters beyond coordinate-wise rescaling.']},
    { heading: 'The wall', paragraphs: ['The wall is that a raw momentum matrix can be dominated by a few singular directions. A singular direction is a paired input-output direction along which a matrix stretches strongly. Exact singular value decomposition could rebalance the update, but doing it for many large matrices every training step is too expensive.']},
    { heading: 'The core insight', paragraphs: ['The core insight is to transform the update, not necessarily the weight. Muon builds a momentum-like update matrix, then approximately balances its singular directions before applying it. This is a matrix-aware preconditioner, meaning it reshapes the gradient before the learning-rate step.']},
    { heading: 'How it works', paragraphs: [
      'For a selected hidden matrix W, training computes a gradient G. Muon updates a momentum buffer M, normalizes it into a stable range, then runs a small fixed number of Newton-Schulz-style iterations to approximate an orthogonalized matrix direction. Newton-Schulz is useful here because it uses matrix multiplications, additions, and scaling.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Matrix_multiplication_diagram.svg/250px-Matrix_multiplication_diagram.svg.png', alt: 'Matrix multiplication diagram showing row and column products', caption: 'Newton-Schulz makes Muon practical because the extra optimizer work is built from matrix multiplications, the operation accelerators are designed to run quickly. Source: Wikiversity and Wikimedia Commons, CC BY-SA 3.0, https://fr.wikiversity.org/wiki/Matrice/Produit_matriciel.'},
    ]},
    { heading: 'Why it works', paragraphs: [
      'The correctness claim is not that Muon always minimizes loss faster. The narrower argument is that it applies a defined matrix transformation to selected updates, so the step is a controlled change in update geometry. If hidden-layer training is limited by badly balanced directions, orthogonalizing momentum can improve the optimization path.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/32/Rosenbrock_function.svg', alt: 'Rosenbrock function surface with curved valley', caption: 'Optimization geometry matters when gradients point across a valley instead of along it; Muon is one matrix-aware attempt to reshape the update direction. Source: Wikimedia Commons, Oleg Alexandrov, public domain.'},
    ]},
    { heading: 'Cost and complexity', paragraphs: ['A Muon step costs more than plain momentum because each selected matrix pays extra matrix multiplications. If five Newton-Schulz iterations are used, each selected matrix gets several additional matmul-like operations before the weight update is applied. The method wins only if fewer training steps or better validation quality repay that per-step cost.']},
    { heading: 'Real-world uses', paragraphs: ['Muon is mainly relevant to training models with many dense hidden matrices, such as transformer blocks and multilayer perceptrons. It is usually applied only to matrix-shaped hidden weights, while embeddings, output heads, biases, and normalization parameters often stay on AdamW or a simpler optimizer. A fair Muon claim is a full-recipe claim, not a single hyperparameter swap.']},
    { heading: 'Where it fails', paragraphs: ['Muon fails when update geometry is not the bottleneck. Small models, sparse parameters, output heads, skinny matrices, wrong parameter groups, or distributed matmul overhead can erase the advantage. It also fails as evidence when compared against an undertuned AdamW baseline.']},
    { heading: 'Worked example', paragraphs: ['Consider a 2 by 2 momentum update M = [[3, 0], [0, 0.3]]. The first direction is ten times larger than the second, so a raw step mostly changes one mode of the layer. If an orthogonalized approximation turns that direction into roughly [[1, 0], [0, 1]], a learning rate of 0.02 gives update magnitudes 0.02 and 0.02 instead of 0.06 and 0.006.']},
    { heading: 'Sources and study next', paragraphs: ['Study the Muon optimizer writeups and implementations, Newton-Schulz matrix iterations, matrix sign functions, Shampoo-style matrix preconditioning, AdamW, Lion, and singular value decomposition. Then study GPU matrix multiplication, distributed optimizer state, parameter grouping, and benchmark variance.']},
  ],
};
