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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/muon-optimizer.gif', alt: 'Animated walkthrough of the muon optimizer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why Muon Exists',
      paragraphs: [
        `Muon is an optimizer idea for neural-network hidden layers. Its popular form keeps momentum for matrix-shaped weights, then approximately orthogonalizes that momentum before applying the update. That sentence is the whole point: Muon treats a weight matrix as a matrix. AdamW, SGD, and Lion can be applied to matrix weights, but their usual mental model is coordinate-level. Muon changes the geometry of the update itself.`,
        `The motivation is practical. Modern networks are packed with dense matrix weights: projection matrices in transformers, MLP layers, attention blocks, and other hidden transformations. These matrices do not merely contain unrelated scalar parameters. Their rows, columns, singular directions, and input-output geometry matter. Muon asks whether an optimizer can exploit that structure by making the update more balanced across matrix directions instead of letting a few directions dominate.`,
        {type: 'callout', text: `Muon treats a hidden weight update as a matrix object, then spends cheap matmuls to balance its singular directions before stepping.`},
      ],
    },
    {
      heading: 'The Wall It Answers',
      paragraphs: [
        `The obvious optimizer approach is to flatten every tensor into coordinates and update each coordinate with some rule. SGD follows a velocity. AdamW keeps first and second moments and rescales coordinates. Lion keeps momentum and uses a sign direction. Those methods can train large models, but they are mostly blind to the fact that a hidden-layer tensor is often a linear map. A matrix update with a huge dominant direction can change one mode of the layer strongly while leaving other useful directions under-updated.`,
        `A direct fix would be to compute an exact matrix orthogonalization or SVD-like operation for every hidden-layer update. That would be mathematically clean and practically awful. Training already spends most of its time on forward passes, backward passes, communication, and memory movement. Inserting expensive decompositions into every step would erase the benefit. Muon's wall is therefore two-sided: use matrix geometry, but only through operations cheap enough to live inside a training loop.`,
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        `Muon's core insight is that the direction of a matrix update can be improved by pushing it toward an orthogonalized or balanced form. Orthogonal directions do not collapse all motion into one singular direction. If the raw momentum matrix says "move mostly along this one mode," an orthogonalized update spreads usable motion more evenly through the matrix geometry. This can change the simplicity bias of training: which solutions gradient-based optimization tends to find first.`,
        `The optimizer is not trying to make the weights themselves orthogonal at every step. It is shaping the update. That distinction matters. Regularizers that constrain weights and optimizers that transform updates are different tools. Muon says: keep momentum, transform the momentum matrix into a better-conditioned update direction, then apply it to selected hidden weights. It is a preconditioning choice, but one expressed through matrix operations rather than coordinate-wise variance estimates.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `For a hidden matrix weight W, Muon starts like a momentum optimizer. The training step computes the gradient for W. The optimizer updates a momentum buffer, usually an exponential moving average of recent gradients. Then Muon runs a small number of Newton-Schulz-style iterations on that momentum matrix to approximate a matrix sign or orthogonalized direction. The resulting balanced matrix becomes the update direction for W.`,
        `Newton-Schulz is the systems trick that makes the idea plausible. Exact orthogonalization would usually require decomposition machinery that is too slow and awkward for every training step. Newton-Schulz iterations use matrix multiplications, additions, and scaling. GPUs are built for matrix multiplication. A few iterations can produce an approximation that is good enough for optimization, even if it is not a perfect mathematical projection. In training, exactness is often less valuable than a cheap bias in the right direction.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Matrix_multiplication_diagram.svg/250px-Matrix_multiplication_diagram.svg.png', alt: 'Matrix multiplication diagram showing row and column products', caption: 'Newton-Schulz makes Muon practical because the extra optimizer work is built from matrix multiplications, the operation accelerators are designed to run quickly. Source: Wikiversity and Wikimedia Commons, CC BY-SA 3.0, https://fr.wikiversity.org/wiki/Matrice/Produit_matriciel.'},
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        `Imagine a 2 by 2 hidden weight matrix. The momentum update is also a 2 by 2 matrix. If that update is dominated by one row or one column direction, applying it directly may mostly stretch one mode of the layer. Muon rescales and iterates on the matrix so the update behaves more like a balanced direction. After that transformation, the step can affect multiple directions more evenly. This is the small-matrix picture behind the larger transformer case.`,
        `Now scale that picture up to a transformer MLP projection with thousands of rows and columns. The raw gradient momentum may contain strong singular directions. Muon's approximate orthogonalization tries to prevent the update from being controlled by only those dominant modes. The exact numerical result depends on shape, normalization, precision, and the chosen Newton-Schulz coefficients. The conceptual result is simple: use matrix structure to choose a better update than treating each coordinate independently.`,
      ],
    },
    {
      heading: 'Parameter Groups',
      paragraphs: [
        `Muon is usually not applied blindly to every parameter. Hidden matrix weights are the natural target because they have the structure the optimizer is exploiting. Embeddings can have sparse or token-frequency-specific behavior. Output heads can be sensitive because they connect directly to logits. Biases and normalization parameters are not matrix maps in the same sense. Many Muon recipes therefore use Muon for hidden matrices and AdamW, SGD, or another simpler update for the rest.`,
        `This parameter grouping is not housekeeping. It is part of the algorithm. A bad grouping can make Muon look worse than it is, or better than it deserves. If a benchmark says "Muon wins," ask which tensors received Muon, which tensors stayed on AdamW, what learning rates were used for each group, how weight decay was applied, and whether the baseline received comparable grouping and tuning attention. The optimizer claim is really a recipe claim.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `Muon can work because neural-network optimization is not only about choosing scalar step sizes. It is also about choosing a geometry. AdamW chooses a coordinate-wise adaptive geometry. Lion chooses sign-momentum geometry. Muon chooses a matrix-aware geometry for selected weights. If the training dynamics benefit from balanced matrix updates, Muon can reach useful representations faster or with fewer tokens than a strong coordinate-wise baseline.`,
        `There is also a hardware reason the idea is attractive. The extra work is mostly matrix multiplication, and modern accelerators are extremely good at matrix multiplication. That does not make the cost free, but it makes the tradeoff plausible. A few additional matmuls inside the optimizer may be worthwhile if they reduce total training steps or improve validation quality at the same step count. This is why Muon sits at the intersection of optimization, linear algebra, and systems engineering.`,
      ],
    },
    {
      heading: 'How The Visual Model Teaches It',
      paragraphs: [
        `The first graph shows the update path: gradient, momentum, orthogonalization, step, weight. The important transition is from momentum to orthogonalized update. That is where Muon stops being ordinary momentum and starts using matrix geometry. The comparison table then places Muon among familiar optimizers. SGD follows velocity. AdamW rescales coordinates. Lion uses sign direction. Muon reshapes the matrix update.`,
        `The Newton-Schulz view shows the tradeoff that decides whether the idea is practical. More iterations usually reduce approximation error, but each iteration costs more matrix multiplication. The target is not perfect orthogonalization. The target is enough approximation to improve training per unit wall-clock time. The final fair-comparison graph is the benchmark discipline: tune parameter groups, profile the added matmuls, run multiple seeds, and judge the full recipe.`,
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        `Muon's visible cost is the Newton-Schulz work. A few matrix multiplications per selected parameter group may be acceptable on GPUs, but it still competes with the rest of the training step. The cost depends on matrix shape, batch size, model architecture, precision, compiler behavior, and distributed training setup. A method that looks cheap on one GPU can become awkward when parameters are sharded or when the optimizer step adds synchronization pressure.`,
        `The hidden cost is complexity. Muon adds parameter grouping, matrix-shape handling, normalization choices, iteration counts, coefficient choices, learning-rate interactions, and fallback optimizer choices. It also makes profiling more important. A lower loss curve at the same number of steps is not enough if each step is much slower. Conversely, a slightly slower step can be worth it if the model reaches the target quality with many fewer tokens or less total compute.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/32/Rosenbrock_function.svg', alt: 'Rosenbrock function surface with curved valley', caption: 'Optimization geometry matters when gradients point across a valley instead of along it; Muon is one matrix-aware attempt to reshape the update direction. Source: Wikimedia Commons, Oleg Alexandrov, public domain.'},
      ],
    },
    {
      heading: 'Where It Wins And Fails',
      paragraphs: [
        `Muon is most compelling in training regimes with many dense hidden matrices, serious accelerator throughput, and enough engineering discipline to tune the full recipe. Transformer training, speedrun-style experiments, large-batch studies, and optimizer research are natural places to evaluate it. It is especially interesting when the team cares about reaching a quality threshold quickly, not merely minimizing optimizer elegance on paper.`,
        `Muon is less convincing for small models, non-matrix-heavy workloads, sparse embeddings, output heads without careful treatment, or teams that cannot profile and retune. It can also fail when matrix shapes are skinny or poorly conditioned for the chosen approximation. Approximate orthogonalization is not magic. If the update geometry is not the bottleneck, or if the added matmuls dominate runtime, AdamW or another mature baseline may be the better engineering choice.`,
      ],
    },
    {
      heading: 'Pitfalls And Misconceptions',
      paragraphs: [
        `The first misconception is that Muon is just AdamW with a new beta setting. It is not. AdamW's central move is coordinate-wise adaptive scaling. Muon's central move is matrix update shaping. The second misconception is that orthogonalization means the model weights are being forced into orthogonal matrices. In the usual Muon story, the optimizer orthogonalizes the update direction for selected matrices. That is different from imposing a hard constraint on W itself.`,
        `The third trap is benchmark theater. A carefully tuned Muon recipe should not be compared to a stale AdamW run. The baseline needs tuned learning rate, weight decay, schedule, batch size, precision, and parameter grouping where appropriate. Run seed sweeps, report wall-clock time, count tokens or examples, and include final validation quality. If Muon wins only on early loss but loses on final quality or cost, the win is not operational.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Primary sources: Keller Jordan's Muon writeup at https://kellerjordan.github.io/posts/muon/, Low-rank orthogonalization for large-scale matrix optimization at https://arxiv.org/html/2509.11983v1, and To Use or not to Use Muon at https://arxiv.org/html/2603.00742v1. Read them with a linear algebra notebook open. The useful exercise is to take a small matrix, inspect its singular directions, and compare a raw momentum step with an orthogonalized direction.`,
        `Study Momentum, Adam Optimizer, Lion Optimizer, SVD and Low-Rank Approximation, Matrix Multiplication on GPUs, Batch Size Scaling, Distributed Data Parallelism, and Benchmark Variance and Model Selection next. Muon is easiest to understand when you can connect three layers at once: the mathematical update, the accelerator operations that implement it, and the benchmark protocol that proves whether the recipe actually improves training.`,
      ],
    },
  ],
};
