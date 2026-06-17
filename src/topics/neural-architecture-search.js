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
    explanation: 'Neural Architecture Search turns model design into an outer-loop optimization problem. Read the graph left to right: the search space is the human-written menu of possible blocks and wiring, the sampler proposes one model, the evaluator gives it a score, and selection pressure changes what gets tried next. The final node is deliberately separate because a discovered architecture is not real until it is retrained and evaluated outside the proxy loop.',
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
    explanation: 'The table is the naive-baseline check. Random search is simple and often hard to embarrass; evolution mutates winners; reinforcement learning trains a controller; differentiable NAS relaxes graph choices into weights. The important column is not the method name but the cost profile. A fancy searcher over a biased space is still just a fast way to rediscover the bias.',
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
    explanation: 'This is the danger zone. Proxy tasks, weight sharing, and short training exist because full NAS is expensive, but each can change the ranking. A candidate can look good because it learns early, shares lucky weights, or exploits a proxy dataset. The final retrain row is expensive because it removes those shortcuts; without it, the search may have optimized the evaluator rather than the architecture.',
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
    explanation: 'NAS belongs with Hyperparameter Search, Evolutionary Search, AutoML, and AlphaEvolve: generate candidates, score them, keep pressure on what works. What changes is the object being searched. Hyperparameter search tunes knobs around a fixed model; NAS changes the graph itself. That extra power is useful only when the score actually represents the deployment goal.',
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
    explanation: 'DARTS makes the discrete choice differentiable. Instead of choosing one edge operation now, the supernet runs a weighted mixture of candidate operations and learns the architecture weights with Gradient Descent. Read the alpha column as a temporary voting system, not the final model: high weight means this operation is winning inside the relaxed proxy.',
  };

  yield {
    state: searchGraph('Weights and architecture parameters alternate'),
    highlight: { active: ['train', 'mutate', 'e-train-select', 'e-select-mutate'], found: ['space'] },
    explanation: 'The loop has two jobs that must not be confused. One update trains ordinary model weights so each candidate operation gets a fair chance to perform; the other update changes the architecture weights. The supernet is a proxy arena, not the final product, which is why the selected graph must later be rebuilt and trained from scratch.',
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
    explanation: 'Here is where differentiable NAS can fool you. Cheap operations, shallow paths, or skip connections may win because they optimize early inside the relaxation, not because the final discrete architecture is best. The audit column tells you how to read any NAS result: equalize training, check depth bias, retrain the winner, and test transfer.',
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
    explanation: 'This protocol card is the practical takeaway. A NAS claim is incomplete until it beats random or hand-designed baselines, reports GPU days and trials, retrains the final architecture from scratch, and transfers beyond the exact proxy task. Otherwise the animation has shown candidate generation, not evidence of a better model family.',
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
      heading: 'Why neural architecture search exists',
      paragraphs: [
        `Neural architecture search exists because model architecture is a design space, not a single decision. A human designer chooses operations, widths, depths, skip connections, attention blocks, convolution sizes, normalization placement, branching patterns, and hardware constraints. Those choices interact. A deeper model may need different regularization. A mobile model may trade accuracy for latency. A skip connection may improve trainability only when the surrounding block is shaped correctly.`,
        `NAS turns part of that design problem into an outer-loop optimization problem. Instead of committing to one graph by hand, the engineer defines a search space of possible graphs and an evaluator that scores candidates. A search algorithm proposes architectures, the evaluator returns feedback, and the search pressure shifts toward better designs. The promise is that compute can discover useful combinations humans would not try. The danger is that the search can exploit every weakness in the search space and evaluator.`,
      ],
    },
    {
      heading: 'The naive approach and the wall',
      paragraphs: [
        `The naive approach is brute force: enumerate many architectures, train each from scratch, compare validation scores, and keep the best. That is the cleanest experiment because every candidate gets its own weights and its own training run. It is also brutally expensive. If one full training run takes a day and the space contains thousands of plausible models, exhaustive search is not an option.`,
        `The wall is evaluator cost. NAS needs a score for many candidate graphs, but honest scores require full training under the target protocol. Researchers therefore use shortcuts: smaller proxy datasets, fewer epochs, reduced image sizes, shared weights, early stopping, or surrogate predictors. These shortcuts make search possible, but they can also change the ranking. A model that learns quickly in ten epochs may not be the best after full training. A model that performs well with shared weights may fail when trained independently. The hard part of NAS is not candidate generation; it is knowing whether the score means what it claims to mean.`,
      ],
    },
    {
      heading: 'Core insight: the search space is the ceiling',
      paragraphs: [
        `A NAS system can only discover architectures that the search space can express. If the space contains only small convolutional cells, it will not discover a transformer. If every candidate is built from operations already chosen by the designer, the search is partly automated assembly of human priors. That is not a flaw by itself. A good search space encodes useful constraints. It becomes a flaw when a result is presented as open-ended discovery while most of the answer was already baked into the menu.`,
        `Search spaces can be macro-level or cell-level. A macro search changes whole-network depth, width, stage layout, and block placement. A cell search learns a repeated building block that is stacked into a larger model. Cell search is cheaper and easier to constrain, but it can overfit the benchmark style. Hardware-aware NAS adds latency, memory, power, or accelerator constraints directly into the objective. The more realistic the constraints, the more useful the final architecture, but the harder the search becomes.`,
      ],
    },
    {
      heading: 'Mechanism: search strategies',
      paragraphs: [
        `Random search is the first baseline. It samples architectures from the search space and trains or proxies them. It is simple, parallel, and often stronger than expected. If a NAS method cannot beat random search under the same budget, the clever searcher is not buying useful information.`,
        `Evolutionary search keeps a population of candidates, mutates them, and selects winners. It works naturally with discrete graph choices and parallel evaluation. Reinforcement-learning NAS trains a controller to propose architectures based on reward signals, but the feedback loop is expensive because each reward may require model training. Bayesian optimization can search architecture descriptors with a surrogate, though graph structure can be difficult to encode. Differentiable NAS changes the problem by relaxing discrete choices into continuous weights, making architecture search look more like gradient-based optimization.`,
      ],
    },
    {
      heading: 'Weight sharing and supernets',
      paragraphs: [
        `Weight sharing reduces cost by training one large supernet that contains many candidate subgraphs. Instead of training every architecture from scratch, each candidate reuses the weights along its path through the supernet. This makes it possible to evaluate many candidates cheaply. It also introduces a ranking problem: the score of a subgraph depends on how the shared weights were trained, which other candidates competed for those weights, and whether the subgraph received enough useful updates.`,
        `A shared-weight score is therefore a proxy, not a final result. It is useful for steering search, but it can favor architectures that fit the supernet training dynamics rather than architectures that train best from scratch. Responsible NAS treats the selected architecture as a hypothesis. The hypothesis becomes credible only after the final discrete graph is rebuilt, trained independently, and compared against strong baselines under the target protocol.`,
      ],
    },
    {
      heading: 'Differentiable NAS',
      paragraphs: [
        `DARTS-style methods make architecture search differentiable. Instead of choosing one operation for an edge, the supernet runs a weighted mixture of possible operations: a 3x3 convolution, a 5x5 convolution, a skip connection, or no edge, for example. The architecture weights say how strongly each operation participates during search. Ordinary model weights and architecture weights are updated in an alternating or bi-level procedure.`,
        `This relaxation is powerful because it replaces many discrete trials with gradient descent. It is also biased. Cheap operations can look good early because they optimize faster. Skip connections can dominate because they make the proxy network easier to train. Shallow paths can win even when deeper final models would perform better. The learned architecture weights are not the final model; they are signals produced inside a relaxed proxy. The final graph must be discretized and retrained before it means anything operational.`,
      ],
    },
    {
      heading: 'Why it works when the evaluator is honest',
      paragraphs: [
        `NAS optimizes whatever the evaluator rewards. If the evaluator uses a proxy dataset, the search may find an architecture specialized to that proxy. If it uses short training, it may reward early learners. If it uses validation accuracy without latency, the result may be unusable on the target device. If it uses latency on one accelerator, the result may not transfer to another. The evaluator is not a side detail; it is the definition of success.`,
        `This is why honest NAS papers report more than the final score. They report search budget, number of trials, proxy setup, final retraining protocol, variance across runs, baseline strength, and transfer behavior. They compare against random search and hand-designed models. They separate the search cost from the final model cost. Without that accounting, NAS can look like a miracle while hiding a large compute spend and a fragile validation procedure.`,
      ],
    },
    {
      heading: 'Production uses',
      paragraphs: [
        `NAS has been useful for image classifiers, object detection backbones, mobile networks, efficient convolutional blocks, recurrent cells, transformer variants, and hardware-aware model design. Its practical value is highest when the deployment constraints are clear and measurable. A phone model may need a strict latency limit. An edge device may need a memory cap. A datacenter model may need throughput per watt. NAS can encode those constraints and search for architectures that satisfy them.`,
        `The broader lesson applies even when a team never runs a giant NAS job. Define the design space. Define the evaluator. Compare against simple baselines. Audit whether shortcuts change the ranking. Retrain the winner honestly. Those practices improve manual model design too. NAS is best understood as a disciplined design-and-evaluation protocol, not only as an expensive AutoML technique.`,
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        `NAS fails when the search space is narrow, the evaluator is biased, the baselines are weak, or the final validation is missing. It can rediscover a known design and claim novelty because the baseline was outdated. It can overfit a benchmark. It can produce an architecture whose accuracy is good but whose memory access pattern is poor. It can consume more compute during search than the final gain justifies.`,
        `NAS also fails socially when the result is described without the protocol. A final architecture name is not enough. You need to know what was allowed, how many candidates were tried, what was measured, what was ignored, and whether the winner survived independent retraining. Treat a NAS result as a claim about a search procedure. Change the procedure and the claim may no longer hold.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `In the search-loop view, read left to right. The search space defines what is possible. The sampler proposes a candidate. The evaluator produces a proxy score. Selection pressure changes what gets tried next. The final retrain node is separate because proxy success is not the same as a validated architecture.`,
        `In the differentiable view, read architecture weights as temporary search variables. A high weight means an operation is winning inside the relaxed supernet, not that it should be trusted in deployment. The bias table is the audit checklist: cheap operations, shallow paths, skip connections, and proxy mismatch all need explicit checks before the discovered graph is taken seriously.`,
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        `Study Hyperparameter Search to see the simpler version of outer-loop optimization. Study Evolutionary Search for mutation and selection over discrete candidates. Study Gradient Descent and Backpropagation for the machinery behind differentiable NAS. Study Bayesian optimization for surrogate-guided expensive search. Study Batch Size Scaling, Regularization, and Hardware-Aware Inference because a discovered architecture is only useful when it trains reliably and runs within deployment constraints.`,
      ],
    },
  ],
};
