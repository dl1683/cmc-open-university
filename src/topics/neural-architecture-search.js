// Neural architecture search: search over model wiring, then validate whether
// the discovered architecture survives the real evaluation setting.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'neural-architecture-search',
  title: 'Neural Architecture Search',
  category: 'AI & ML',
  summary: 'Automating model design with search spaces, evaluators, weight sharing, differentiable relaxations, and bias audits.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['search loop', 'differentiable NAS'], defaultValue: 'search loop' },
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

function searchGraph(title) {
  return graphState({
    nodes: [
      { id: 'space', label: 'search space', x: 0.8, y: 3.8, note: 'ops and wiring' },
      { id: 'sample', label: 'sample model', x: 2.7, y: 2.4, note: 'candidate' },
      { id: 'train', label: 'train/eval', x: 4.8, y: 2.4, note: 'proxy score' },
      { id: 'select', label: 'select', x: 6.8, y: 3.8, note: 'keep best' },
      { id: 'mutate', label: 'mutate/update', x: 4.8, y: 5.3, note: 'new candidates' },
      { id: 'final', label: 'final retrain', x: 8.6, y: 3.8, note: 'real test' },
    ],
    edges: [
      { id: 'e-space-sample', from: 'space', to: 'sample', weight: 'draw' },
      { id: 'e-sample-train', from: 'sample', to: 'train', weight: 'score' },
      { id: 'e-train-select', from: 'train', to: 'select', weight: 'metric' },
      { id: 'e-select-mutate', from: 'select', to: 'mutate', weight: 'pressure' },
      { id: 'e-mutate-space', from: 'mutate', to: 'space', weight: 'revise' },
      { id: 'e-select-final', from: 'select', to: 'final', weight: 'export' },
    ],
  }, { title });
}

function* searchLoop() {
  yield {
    state: searchGraph('NAS is a search loop over model designs'),
    highlight: { active: ['space', 'sample', 'train', 'select', 'e-space-sample', 'e-sample-train', 'e-train-select'], compare: ['final'] },
    explanation: 'Neural Architecture Search turns model design into optimization. Define a search space, sample or update candidate architectures, train or proxy-score them, keep better candidates, and finally retrain the selected design honestly.',
  };

  yield {
    state: labelMatrix(
      'Search strategies',
      [
        { id: 'random', label: 'random search' },
        { id: 'evolution', label: 'evolution' },
        { id: 'rl', label: 'reinforcement learning' },
        { id: 'gradient', label: 'differentiable NAS' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'cost', label: 'cost profile' },
      ],
      [
        ['sample architectures', 'simple baseline'],
        ['mutate and select', 'parallel but many trials'],
        ['controller proposes models', 'expensive feedback loop'],
        ['relax choices to weights', 'cheap proxy but biased'],
      ],
    ),
    highlight: { active: ['random:move', 'evolution:move', 'gradient:move'], compare: ['rl:cost'] },
    explanation: 'NAS is not one algorithm. It is a family of search methods over a design space. The evaluator and search-space design often matter more than the name of the optimizer.',
    invariant: 'The search can only discover architectures expressible in the search space.',
  };

  yield {
    state: labelMatrix(
      'The evaluator is the danger zone',
      [
        { id: 'proxy', label: 'proxy task' },
        { id: 'shared', label: 'weight sharing' },
        { id: 'short', label: 'short training' },
        { id: 'final', label: 'final retrain' },
      ],
      [
        { id: 'why use it', label: 'why use it' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['cheap signal', 'does not transfer'],
        ['avoid training every model', 'ranking bias'],
        ['fast feedback', 'rewards early learners'],
        ['honest score', 'expensive but necessary'],
      ],
    ),
    highlight: { active: ['proxy:risk', 'shared:risk', 'short:risk'], found: ['final:why use it'] },
    explanation: 'The local corpus note on NAS bias is the right warning: cheap proxy choices can bias which wiring looks good. If the final retrain does not validate the discovery, the search found a proxy exploit.',
  };

  yield {
    state: labelMatrix(
      'Where NAS connects',
      [
        { id: 'hyper', label: 'hyperparameters' },
        { id: 'evolve', label: 'evolutionary search' },
        { id: 'auto', label: 'AutoML' },
        { id: 'alpha', label: 'AlphaEvolve' },
      ],
      [
        { id: 'shared idea', label: 'shared idea' },
        { id: 'difference', label: 'difference' },
      ],
      [
        ['outer-loop optimization', 'tunes knobs not wiring'],
        ['selection pressure', 'mutation over architectures'],
        ['pipeline search', 'includes data and features'],
        ['generate and evaluate', 'can search code or algorithms'],
      ],
    ),
    highlight: { found: ['hyper:shared idea', 'evolve:shared idea', 'alpha:shared idea'] },
    explanation: 'NAS is part of a larger pattern: generate candidates, evaluate them, and let the metric steer search. The hard part is making sure the metric represents the real goal.',
  };
}

function* differentiableNas() {
  yield {
    state: labelMatrix(
      'DARTS relaxes discrete choices into weighted mixtures',
      [
        { id: 'conv3', label: '3x3 conv' },
        { id: 'conv5', label: '5x5 conv' },
        { id: 'skip', label: 'skip connection' },
        { id: 'none', label: 'no edge' },
      ],
      [
        { id: 'alpha', label: 'architecture weight' },
        { id: 'meaning', label: 'meaning during search' },
      ],
      [
        ['0.50', 'strong candidate op'],
        ['0.20', 'weak candidate op'],
        ['0.25', 'cheap path'],
        ['0.05', 'almost removed'],
      ],
    ),
    highlight: { active: ['conv3:alpha', 'skip:alpha'], compare: ['none:alpha'] },
    explanation: 'Differentiable NAS replaces a hard operation choice with a soft mixture of candidate operations. Architecture weights become trainable variables, so Gradient Descent can optimize wiring.',
  };

  yield {
    state: searchGraph('Weights and architecture parameters alternate'),
    highlight: { active: ['train', 'mutate', 'e-train-select', 'e-select-mutate'], found: ['space'] },
    explanation: 'A common pattern alternates model-weight updates with architecture-parameter updates. One loop learns how candidate operations perform; the other loop changes the operation mixture.',
    invariant: 'The relaxed supernet is a proxy for the final discrete architecture.',
  };

  yield {
    state: labelMatrix(
      'Biases in differentiable NAS',
      [
        { id: 'op', label: 'operation bias' },
        { id: 'depth', label: 'depth bias' },
        { id: 'skip', label: 'skip bias' },
        { id: 'proxy', label: 'proxy bias' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'audit', label: 'audit' },
      ],
      [
        ['cheap ops look good early', 'compare equalized training'],
        ['shallow paths dominate', 'grow search depth gradually'],
        ['skip connections win proxy', 'check final retrain'],
        ['search task differs from eval', 'holdout architecture test'],
      ],
    ),
    highlight: { active: ['op:audit', 'depth:audit', 'skip:audit', 'proxy:audit'] },
    explanation: 'The relaxed search space can prefer operations that are easy to optimize during search, not architectures that are best after full training. Bias audits are not optional.',
  };

  yield {
    state: labelMatrix(
      'Responsible NAS protocol',
      [
        { id: 'baseline', label: 'strong baselines' },
        { id: 'budget', label: 'budget accounting' },
        { id: 'retrain', label: 'retrain from scratch' },
        { id: 'transfer', label: 'transfer test' },
      ],
      [
        { id: 'requirement', label: 'requirement' },
        { id: 'why', label: 'why' },
      ],
      [
        ['random and hand-designed', 'avoid fake wins'],
        ['GPU days and trials', 'cost is part of result'],
        ['final architecture only', 'remove supernet artifact'],
        ['new data or depth', 'detect overfit search space'],
      ],
    ),
    highlight: { found: ['baseline:why', 'budget:why', 'retrain:why', 'transfer:why'] },
    explanation: 'A NAS claim is not complete until it beats strong baselines under the same budget and survives final retraining. Otherwise it is just a proxy metric victory.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'search loop') yield* searchLoop();
  else if (view === 'differentiable NAS') yield* differentiableNas();
  else throw new InputError('Pick a NAS view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Neural Architecture Search automates part of model design. Instead of manually deciding every operation, skip connection, width, depth, or cell wiring pattern, NAS defines a search space and lets an optimizer explore candidate architectures. The optimizer may be random search, Evolutionary Search, reinforcement learning, Bayesian optimization, or differentiable relaxation.',
        'The promise is attractive: let compute discover architectures humans would miss. The danger is just as important: the search can exploit biased proxy tasks, weak baselines, cheap early-training signals, or a search space that smuggles in most of the answer. The evaluator is the product.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A NAS pipeline defines candidate operations and wiring rules, proposes architectures, scores them, and updates the proposal mechanism. Early systems trained many candidates from scratch, which was expensive. Weight-sharing methods train one supernet so candidates reuse parameters. DARTS made the search differentiable by replacing discrete operation choices with continuous architecture weights that can be optimized with Gradient Descent.',
        'After search, the selected architecture should be discretized and retrained from scratch under the same evaluation protocol used for baselines. That final retrain matters because the supernet or proxy may not rank architectures the same way as full training. Hyperparameter Search tunes knobs; NAS changes the model graph itself.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main costs are search compute, evaluator fidelity, implementation complexity, and reproducibility. A cheap proxy can search quickly but pick the wrong architecture. A full evaluator is honest but expensive. Weight sharing reduces cost but introduces ranking bias because candidates are not trained independently. Differentiable NAS reduces search time but can favor skip connections or cheap operations that optimize early.',
        'Good NAS papers report search budget, baselines, final retraining, variance across runs, and transfer tests. Without those, the result may be a metric artifact. This is the same lesson as AlphaEvolve Case Study and Hyperparameter Search: automated search amplifies the quality and weaknesses of the score function.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'NAS has been used for image classifiers, object detection backbones, mobile models, recurrent cells, efficient convolution blocks, hardware-aware model design, and AutoML products. The most durable production lesson is not that every team should run giant architecture searches. It is that search spaces, proxy metrics, and deployment constraints can be encoded explicitly and evaluated systematically.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'NAS does not remove human design. Humans design the search space, evaluator, constraints, budget, and validation protocol. A narrow search space can only rediscover its built-in assumptions. A weak evaluator rewards loopholes. A final architecture that wins on CIFAR search may fail when transferred to deeper ImageNet-scale training. Treat NAS results as claims about a protocol, not universal architecture truth.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: DARTS at https://arxiv.org/abs/1806.09055 and the Google Research DARTS page at https://research.google/pubs/darts-differentiable-architecture-search/. The local corpus note on NAS bias comes from the provided document set. Study Hyperparameter Search, Evolutionary Search, Gradient Descent, Backpropagation, Batch Size Scaling, and AlphaEvolve Case Study next.',
      ],
    },
  ],
};
