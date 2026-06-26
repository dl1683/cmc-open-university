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
  const loopNodeCount = 6;
  yield {
    state: searchGraph('NAS is a search loop over model designs'),
    highlight: { active: ['space', 'sample', 'train', 'select', 'e-space-sample', 'e-sample-train', 'e-train-select'], compare: ['final'] },
    explanation: `Neural Architecture Search turns model design into an outer-loop optimization problem. Read the ${loopNodeCount}-node graph left to right: the search space is the human-written menu of possible blocks and wiring, the sampler proposes one model, the evaluator gives it a score, and selection pressure changes what gets tried next. The final node is deliberately separate because a discovered architecture is not real until it is retrained and evaluated outside the proxy loop.`,
  };

  const strategyCount = 4;
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
    explanation: `The table is the naive-baseline check across ${strategyCount} strategies. Random search is simple and often hard to embarrass; evolution mutates winners; reinforcement learning trains a controller; differentiable NAS relaxes graph choices into weights. The important column is not the method name but the cost profile. A fancy searcher over a biased space is still just a fast way to rediscover the bias.`,
    invariant: `The search can only discover architectures expressible in the search space — all ${strategyCount} strategies share this ceiling.`,
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
    explanation: `This is the danger zone. Proxy tasks, weight sharing, and short training exist because full NAS is expensive, but each of ${strategyCount} evaluation shortcuts can change the ranking. A candidate can look good because it learns early, shares lucky weights, or exploits a proxy dataset. The final retrain row is expensive because it removes those shortcuts; without it, the search may have optimized the evaluator rather than the architecture.`,
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
    explanation: `NAS belongs with Hyperparameter Search, Evolutionary Search, AutoML, and AlphaEvolve: generate candidates, score them, keep pressure on what works across a ${loopNodeCount}-stage loop. What changes is the object being searched. Hyperparameter search tunes knobs around a fixed model; NAS changes the graph itself. That extra power is useful only when the score actually represents the deployment goal.`,
  };
}

function* differentiableNas() {
  const opCount = 4;
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
    explanation: `DARTS makes the discrete choice differentiable. Instead of choosing one edge operation now, the supernet runs a weighted mixture of ${opCount} candidate operations and learns the architecture weights with Gradient Descent. Read the alpha column as a temporary voting system, not the final model: high weight means this operation is winning inside the relaxed proxy.`,
  };

  yield {
    state: searchGraph('Weights and architecture parameters alternate'),
    highlight: { active: ['train', 'mutate', 'e-train-select', 'e-select-mutate'], found: ['space'] },
    explanation: `The loop has two jobs that must not be confused. One update trains ordinary model weights so each of the ${opCount} candidate operations gets a fair chance to perform; the other update changes the architecture weights. The supernet is a proxy arena, not the final product, which is why the selected graph must later be rebuilt and trained from scratch.`,
    invariant: `The relaxed supernet mixing ${opCount} operations is a proxy for the final discrete architecture.`,
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
    explanation: `Here is where differentiable NAS can fool you. Among ${opCount} operation types, cheap operations, shallow paths, or skip connections may win because they optimize early inside the relaxation, not because the final discrete architecture is best. The audit column tells you how to read any NAS result: equalize training, check depth bias, retrain the winner, and test transfer.`,
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
    explanation: `This protocol card is the practical takeaway. A NAS claim is incomplete until it beats random or hand-designed baselines, reports GPU days and trials, retrains the final architecture from scratch, and transfers beyond the exact proxy task. All ${opCount} candidate operations must survive this ${opCount}-step protocol. Otherwise the animation has shown candidate generation, not evidence of a better model family.`,
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
    { heading: 'How to read the animation', paragraphs: ['The search-loop view shows NAS as an outer optimization loop. A search space defines legal architectures, a sampler proposes candidates, an evaluator scores them, and selection pressure changes what gets tried next. The final retrain node is separate because proxy scores are not final evidence.', {type: 'image', src: './assets/gifs/neural-architecture-search.gif', alt: 'Animated walkthrough of the neural architecture search visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    { heading: 'Why this exists', paragraphs: ['A neural architecture is the wiring plan of a model: layers, operations, widths, connections, and sometimes hardware constraints. Neural architecture search exists to treat part of model design as an optimization problem. The engineer defines what designs are allowed and how they will be scored, then the search process explores that space under a budget.', {type: 'callout', text: 'NAS is only as honest as its search space and evaluator; the algorithm optimizes exactly the game you define.'}]},
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is manual design. A researcher builds a model, trains it, reads the errors, changes the architecture, and repeats. Brute force is the cleaner version: train every candidate from scratch and keep the best, but that is usually impossible when each candidate needs hours or days of training.']},
    { heading: 'The wall', paragraphs: ['The wall is evaluator cost. NAS needs scores for many architectures, but an honest score requires full training under the target protocol. Shortcuts such as smaller data, fewer epochs, weight sharing, and surrogate predictors make search affordable, but they can change the ranking and reward the proxy instead of the final model.']},
    { heading: 'The core insight', paragraphs: ['The core insight is that the search space is the ceiling. A search algorithm cannot discover an operation, connection pattern, or hardware behavior that the search space does not permit. If the menu only contains convolutional cells, the result is a searched convolutional cell, not proof that the search would have found a transformer.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A NAS search space is a directed graph of allowed operations and connections; anything absent from that graph cannot be discovered. Source: Wikimedia Commons, David W., public domain.'}]},
    { heading: 'How it works', paragraphs: ['Random search samples architectures and is the baseline every NAS method must beat. Evolution keeps a population, mutates candidates, and selects winners. Differentiable NAS relaxes discrete choices into continuous weights inside a supernet, then discretizes and retrains the selected graph.']},
    { heading: 'Why it works', paragraphs: ['NAS works when candidate quality is correlated with evaluator score. If the proxy ranking matches the final ranking often enough, search pressure moves toward architectures that also work after full retraining. The selected architecture must still be rebuilt, trained from scratch, and tested against strong random and hand-designed baselines.']},
    { heading: 'Cost and complexity', paragraphs: ['Cost is measured in candidate evaluations, accelerator-days, and final retraining. If 500 candidates each train for 30 minutes on 8 GPUs, the search alone costs 500 * 0.5 * 8 = 2,000 GPU-hours. The more often the search queries an evaluator, the more it can overfit that evaluator.']},
    { heading: 'Real-world uses', paragraphs: ['NAS has been useful for mobile vision models, efficient convolutional blocks, detection backbones, recurrent cells, transformer variants, and hardware-aware design. It is most useful when the deployment objective is measurable, such as latency on a phone or memory on an edge device.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'NAS automates choices inside a neural-network design space, but the chosen layers and connections still have to train and run under real deployment constraints. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'}]},
    { heading: 'Where it fails', paragraphs: ['NAS fails when the baseline is weak, the search space bakes in the answer, or the evaluator rewards the wrong property. A cheap operation may win because it trains early, not because it gives the best final model. A discovered architecture can also be a bad investment if search cost exceeds deployment savings.']},
    { heading: 'Worked example', paragraphs: ['Suppose a search space has four operations per edge and six edges in a cell. That is 4 to the 6th power = 4,096 possible cells before choosing widths or depths. A brute-force run that trains each cell for 3 hours costs 4,096 * 3 = 12,288 GPU-hours, so a 200 GPU-hour supernet is cheaper but needs final retraining to prove its ranking was honest.']},
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Zoph and Le on reinforcement-learning NAS, Real et al. on evolutionary NAS, Liu et al. on DARTS, Pham et al. on ENAS, and hardware-aware NAS work such as MnasNet. Study hyperparameter search, evolutionary algorithms, validation leakage, and hardware-aware inference next.']},
  ],
};
